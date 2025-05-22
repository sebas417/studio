"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
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
import { Loader2, UploadCloud, Wand2 } from "lucide-react";

export const expenseFormSchema = z.object({
  date: z.date({ required_error: "Date is required." }),
  provider: z.string().min(1, "Provider is required."),
  patient: z.string().min(1, "Patient is required."),
  cost: z.coerce.number().positive("Cost must be a positive number."),
  isReimbursed: z.boolean().default(false),
  receiptImageUri: z.string().optional(),
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
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          date: initialData.date ? new Date(initialData.date) : new Date(),
        }
      : {
          date: new Date(),
          provider: "",
          patient: "",
          cost: 0,
          isReimbursed: false,
        },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      setIsExtracting(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        form.setValue("receiptImageUri", dataUri); // Store for potential later use
        try {
          const extracted = await extractData({ photoDataUri: dataUri });
          if (extracted.date) form.setValue("date", new Date(extracted.date), { shouldValidate: true });
          if (extracted.provider) form.setValue("provider", extracted.provider, { shouldValidate: true });
          if (extracted.patient) form.setValue("patient", extracted.patient, { shouldValidate: true });
          if (extracted.cost) form.setValue("cost", extracted.cost, { shouldValidate: true });
          toast({ title: "Data Extracted", description: "Fields populated from receipt." });
        } catch (error) {
          console.error("AI Extraction Error:", error);
          toast({ variant: "destructive", title: "Extraction Failed", description: "Could not extract data from image. Please enter manually." });
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onFormSubmit = (data: ExpenseFormValues) => {
    onSubmit(data);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Expense" : "Add New Expense"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update the details of your expense." : "Fill in the details of your new expense. You can upload a receipt to automatically extract information."}
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="receiptUpload">Upload Receipt (Optional)</Label>
              <div className="flex items-center gap-2">
                <Input id="receiptUpload" type="file" accept="image/*" onChange={handleFileUpload} className="flex-grow" disabled={isExtracting}/>
                <Button type="button" onClick={() => (document.getElementById('receiptUpload') as HTMLInputElement)?.click()} variant="outline" disabled={isExtracting}>
                  {isExtracting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                  Upload
                </Button>
              </div>
              {uploadedFileName && !isExtracting && <p className="text-sm text-muted-foreground">Uploaded: {uploadedFileName}</p>}
              {isExtracting && <p className="text-sm text-primary flex items-center"><Wand2 className="h-4 w-4 mr-2 animate-pulse" />Extracting data...</p>}
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <DatePicker date={field.value} setDate={field.onChange} />
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
                  <FormLabel>Provider</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., CVS Pharmacy, Dr. Smith" {...field} />
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
                  <FormLabel>Patient</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Doe" {...field} />
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
                  <FormLabel>Cost</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isReimbursed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
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
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting || isExtracting}>
              {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? "Save Changes" : "Add Expense"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
