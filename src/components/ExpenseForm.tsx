
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/datepicker";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Expense } from "@/lib/types";
import { extractData, type ExtractDataOutput } from "@/ai/flows/extract-data-from-receipt";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UploadCloud, Wand2, CirclePlay } from "lucide-react";

export const expenseFormSchema = z.object({
  date: z.date({ required_error: "Date is required." }),
  provider: z.string().min(1, "Provider is required."),
  patient: z.string().min(1, "Patient is required."),
  cost: z.coerce.number().positive("Cost must be a positive number."),
  isReimbursedInput: z.boolean().default(false).optional(), // Renamed to avoid conflict
  receiptImageUri: z.string().optional(),
  billImageUri: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  initialData?: Expense | null;
  onSubmit: (data: ExpenseFormValues) => void;
  isEditing?: boolean;
}

export function ExpenseForm({ initialData, onSubmit, isEditing = false }: ExpenseFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [isExtractingReceipt, setIsExtractingReceipt] = React.useState(false);
  const [uploadedReceiptFileName, setUploadedReceiptFileName] = React.useState<string | null>(null);
  const [isExtractingBill, setIsExtractingBill] = React.useState(false);
  const [uploadedBillFileName, setUploadedBillFileName] = React.useState<string | null>(null);
  
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          date: initialData.date ? new Date(initialData.date) : new Date(),
          isReimbursedInput: initialData.isReimbursed, // Map from Expense type to form type
        }
      : {
          date: new Date(),
          provider: "",
          patient: "",
          cost: 0,
          isReimbursedInput: false,
          receiptImageUri: undefined,
          billImageUri: undefined,
        },
  });

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        date: initialData.date ? new Date(initialData.date) : new Date(),
        isReimbursedInput: initialData.isReimbursed,
      });
      if(initialData.receiptImageUri) {
        // Attempt to derive a filename, or use a generic one
        setUploadedReceiptFileName(initialData.receiptImageUri.startsWith('data:') ? "Stored Receipt" : initialData.receiptImageUri);
      }
      if(initialData.billImageUri) {
        setUploadedBillFileName(initialData.billImageUri.startsWith('data:') ? "Stored Bill" : initialData.billImageUri);
      }
    }
  }, [initialData, form.reset, form]);


  const handleAIDataPopulation = (extracted: ExtractDataOutput, documentType: "Receipt" | "Bill") => {
    if (extracted.date) form.setValue("date", new Date(extracted.date), { shouldValidate: true });
    if (extracted.provider) form.setValue("provider", extracted.provider, { shouldValidate: true });
    if (extracted.patient) form.setValue("patient", extracted.patient, { shouldValidate: true });
    if (extracted.cost) form.setValue("cost", extracted.cost, { shouldValidate: true });
    toast({ title: `Data Extracted from ${documentType}`, description: `Fields populated from ${documentType.toLowerCase()}. Please review.` });
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    docType: "receipt" | "bill"
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (docType === "receipt") {
        setUploadedReceiptFileName(file.name);
        setIsExtractingReceipt(true);
      } else {
        setUploadedBillFileName(file.name);
        setIsExtractingBill(true);
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        if (docType === "receipt") {
          form.setValue("receiptImageUri", dataUri);
        } else {
          form.setValue("billImageUri", dataUri);
        }
        
        try {
          const extracted = await extractData({ photoDataUri: dataUri });
          handleAIDataPopulation(extracted, docType === "receipt" ? "Receipt" : "Bill");
        } catch (error) {
          console.error(`AI Extraction Error from ${docType}:`, error);
          toast({ variant: "destructive", title: `${docType === "receipt" ? "Receipt" : "Bill"} Extraction Failed`, description: `Could not extract data. Please enter manually.` });
        } finally {
          if (docType === "receipt") setIsExtractingReceipt(false);
          else setIsExtractingBill(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGoogleDriveUpload = async (docType: "receipt" | "bill") => {
    // This is a placeholder for Google Drive integration.
    // Full integration requires:
    // 1. Setting up Google Cloud Project & enabling Picker API.
    // 2. Handling OAuth 2.0 for user authentication.
    // 3. Using the Google Picker API to let users select files.
    // 4. Downloading the selected file (or its content) and converting to data URI.
    // 5. Then, calling the AI extraction similar to `handleFileUpload`.
    toast({
      title: "Google Drive Upload (Placeholder)",
      description: `This feature is not fully implemented. Would upload ${docType} from Google Drive.`,
    });
    console.log(`Placeholder: Upload ${docType} from Google Drive`);
  };
  
  const isAnyExtracting = isExtractingReceipt || isExtractingBill;

  const onFormSubmit = (data: ExpenseFormValues) => {
    onSubmit(data);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Expense" : "Add New Expense"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update the details of your expense." : "Fill in the details of your new expense. You can upload a receipt and/or a bill to automatically extract information."}
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)}>
          <CardContent className="space-y-6">
            {/* Receipt Upload Section */}
            <div className="space-y-2 p-4 border rounded-md shadow-sm">
              <Label htmlFor="receiptUpload" className="font-semibold">Receipt Document</Label>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <Input id="receiptUpload" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, "receipt")} className="flex-grow" disabled={isAnyExtracting}/>
                 <Button type="button" onClick={() => (document.getElementById('receiptUpload') as HTMLInputElement)?.click()} variant="outline" className="w-full sm:w-auto" disabled={isAnyExtracting}>
                  {isExtractingReceipt ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                  Upload Receipt
                </Button>
                <Button type="button" onClick={() => handleGoogleDriveUpload("receipt")} variant="outline" className="w-full sm:w-auto" disabled={isAnyExtracting}>
                  <CirclePlay className="h-4 w-4 mr-2" /> {/* Placeholder for Drive Icon */}
                  From Drive
                </Button>
              </div>
              {uploadedReceiptFileName && !isExtractingReceipt && <p className="text-sm text-muted-foreground mt-1">File: {uploadedReceiptFileName}</p>}
              {form.getValues("receiptImageUri") && !uploadedReceiptFileName && isEditing && <p className="text-sm text-muted-foreground mt-1">Existing receipt uploaded.</p>}
              {isExtractingReceipt && <p className="text-sm text-primary flex items-center mt-1"><Wand2 className="h-4 w-4 mr-2 animate-pulse" />Extracting data from receipt...</p>}
            </div>

            {/* Bill Upload Section */}
            <div className="space-y-2 p-4 border rounded-md shadow-sm">
              <Label htmlFor="billUpload" className="font-semibold">Bill Document</Label>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <Input id="billUpload" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, "bill")} className="flex-grow" disabled={isAnyExtracting}/>
                 <Button type="button" onClick={() => (document.getElementById('billUpload') as HTMLInputElement)?.click()} variant="outline" className="w-full sm:w-auto" disabled={isAnyExtracting}>
                  {isExtractingBill ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                  Upload Bill
                </Button>
                 <Button type="button" onClick={() => handleGoogleDriveUpload("bill")} variant="outline" className="w-full sm:w-auto" disabled={isAnyExtracting}>
                  <CirclePlay className="h-4 w-4 mr-2" /> {/* Placeholder for Drive Icon */}
                  From Drive
                </Button>
              </div>
              {uploadedBillFileName && !isExtractingBill && <p className="text-sm text-muted-foreground mt-1">File: {uploadedBillFileName}</p>}
              {form.getValues("billImageUri") && !uploadedBillFileName && isEditing && <p className="text-sm text-muted-foreground mt-1">Existing bill uploaded.</p>}
              {isExtractingBill && <p className="text-sm text-primary flex items-center mt-1"><Wand2 className="h-4 w-4 mr-2 animate-pulse" />Extracting data from bill...</p>}
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Service/Purchase</FormLabel>
                  <FormControl>
                    <DatePicker date={field.value} setDate={field.onChange} disabled={isAnyExtracting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider/Vendor Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., CVS Pharmacy, Dr. Smith" {...field} disabled={isAnyExtracting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="patient"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient/Person Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Doe" {...field} disabled={isAnyExtracting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Cost</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} disabled={isAnyExtracting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isReimbursedInput"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isAnyExtracting}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Reimbursed from HSA?</FormLabel>
                     <FormDescription>
                      Check this if you have already withdrawn funds from your HSA for this expense.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isAnyExtracting}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting || isAnyExtracting}>
              {(form.formState.isSubmitting || isAnyExtracting) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? "Save Changes" : "Add Expense"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

