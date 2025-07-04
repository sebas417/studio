
"use client";

import React from "react";
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
import { Loader2, UploadCloud, Wand2 } from "lucide-react";

export const expenseFormSchema = z.object({
  date: z.date({ required_error: "Date of Service/Purchase is required." }),
  dateOfPayment: z.date().optional().nullable(),
  provider: z.string().min(1, "Provider is required."),
  patient: z.string().min(1, "Patient is required."),
  cost: z.coerce.number().positive("Cost must be a positive number."),
  isReimbursedInput: z.boolean().default(false).optional(),
  receiptImageFile: z.custom<File | Blob>().optional(),
  billImageFile: z.custom<File | Blob>().optional(),
  receiptImageUri: z.string().optional(), 
  billImageUri: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  initialData?: Expense | null;
  onSubmit: (data: ExpenseFormValues & { receiptImageFile?: File | Blob, billImageFile?: File | Blob }) => void;
  isEditing?: boolean;
}

const parseDateStringToLocal = (dateStr: string | undefined): Date | undefined => {
  if (dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; 
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
  }
  return undefined; 
};

async function processAndCompressImage(
  file: File, 
  maxWidth: number = 1024, 
  maxHeight: number = 1024, 
  quality: number = 0.7
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error('Failed to get canvas context'));
        }

        ctx.filter = 'grayscale(100%)';
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = (err) => reject(new Error(`Image load error: ${err}`));
      if (event.target?.result) {
        img.src = event.target.result as string;
      } else {
        reject(new Error('Failed to read image for compression'));
      }
    };
    reader.onerror = (err) => reject(new Error(`File read error: ${err}`));
    reader.readAsDataURL(file);
  });
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
          date: parseDateStringToLocal(initialData.date) || new Date(),
          dateOfPayment: parseDateStringToLocal(initialData.dateOfPayment) || null,
          isReimbursedInput: initialData.isReimbursed,
          receiptImageUri: initialData.receiptImageUri,
          billImageUri: initialData.billImageUri,
          receiptImageFile: undefined,
          billImageFile: undefined,
        }
      : {
          date: new Date(),
          dateOfPayment: null,
          provider: "",
          patient: "",
          cost: 0,
          isReimbursedInput: false,
          receiptImageFile: undefined,
          billImageFile: undefined,
          receiptImageUri: undefined,
          billImageUri: undefined,
        },
  });

  const { formState: { dirtyFields } } = form;

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        date: parseDateStringToLocal(initialData.date) || new Date(),
        dateOfPayment: parseDateStringToLocal(initialData.dateOfPayment) || null,
        isReimbursedInput: initialData.isReimbursed,
        receiptImageUri: initialData.receiptImageUri,
        billImageUri: initialData.billImageUri,
        receiptImageFile: undefined,
        billImageFile: undefined,
      });
      if (initialData.receiptImageUri) setUploadedReceiptFileName("Existing Receipt");
      if (initialData.billImageUri) setUploadedBillFileName("Existing Bill");
    }
  }, [initialData, form]);

  const handleAIDataPopulation = (extracted: ExtractDataOutput, documentType: "Receipt" | "Bill") => {
    if (extracted.date && !dirtyFields.date) {
        const parsedDate = parseDateStringToLocal(extracted.date);
        if (parsedDate) form.setValue("date", parsedDate, { shouldValidate: true });
    }
    if (extracted.dateOfPayment && !dirtyFields.dateOfPayment && documentType === "Receipt") {
        const parsedPaymentDate = parseDateStringToLocal(extracted.dateOfPayment);
        if (parsedPaymentDate) form.setValue("dateOfPayment", parsedPaymentDate, { shouldValidate: true });
    }
    if (extracted.provider && !dirtyFields.provider) {
      form.setValue("provider", extracted.provider, { shouldValidate: true });
    }
    if (extracted.patient && !dirtyFields.patient) {
      form.setValue("patient", extracted.patient, { shouldValidate: true });
    }
    if (extracted.cost && extracted.cost > 0 && !dirtyFields.cost) {
      form.setValue("cost", extracted.cost, { shouldValidate: true });
    }
    toast({ title: `Data Extracted from ${documentType}`, description: `Fields populated from ${documentType.toLowerCase()}. Please review.` });
  };

  const processImageForAI = async (dataUriForAIScan: string, docType: "receipt" | "bill") => {
    const currentSetter = docType === "receipt" ? setIsExtractingReceipt : setIsExtractingBill;
    
    const currentFormValues = form.getValues();
    const isScanWorthSkipping = 
        (dirtyFields.provider || (currentFormValues.provider && currentFormValues.provider !== "")) &&
        (dirtyFields.patient || (currentFormValues.patient && currentFormValues.patient !== "")) &&
        (dirtyFields.cost || (currentFormValues.cost && currentFormValues.cost > 0)) &&
        (dirtyFields.date) && 
        (docType === "receipt" ? (dirtyFields.dateOfPayment || currentFormValues.dateOfPayment) : true);

    if (isScanWorthSkipping) {
      toast({
        title: "Fields Already Populated",
        description: "AI extraction skipped as key fields are filled. To re-extract, please clear fields first.",
        duration: 5000,
      });
      currentSetter(false);
      return;
    }
    
    try {
      const extracted = await extractData({ photoDataUri: dataUriForAIScan });
      handleAIDataPopulation(extracted, docType === "receipt" ? "Receipt" : "Bill");
    } catch (error) {
      console.error(`AI Extraction Error from ${docType}:`, error);
      toast({ variant: "destructive", title: `${docType === "receipt" ? "Receipt" : "Bill"} Extraction Failed`, description: `Could not extract data. Please enter manually.` });
    } finally {
      currentSetter(false);
    }
  };
  
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    docType: "receipt" | "bill"
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const currentSetterLoading = docType === "receipt" ? setIsExtractingReceipt : setIsExtractingBill;
      const currentFileNameSetter = docType === "receipt" ? setUploadedReceiptFileName : setUploadedBillFileName;
      
      currentSetterLoading(true); 
      currentFileNameSetter(file.name);

      let fileForUpload: File | Blob = file;
      let dataUriForAIScan: string;

      if (file.type.startsWith("image/")) {
        try {
          toast({ title: "Processing Image...", description: "Compressing and preparing your image.", duration: 3000 });
          const compressedBlob = await processAndCompressImage(file);
          fileForUpload = compressedBlob;
          
          dataUriForAIScan = await new Promise<string>((resolve, reject) => {
             const reader = new FileReader();
             reader.onloadend = () => resolve(reader.result as string);
             reader.onerror = reject;
             reader.readAsDataURL(compressedBlob); // Use compressed blob for AI scan URI
           });

        } catch (compressionError) {
          console.error("Image processing error:", compressionError);
          toast({ variant: "destructive", title: "Image Processing Failed", description: "Could not process the image. Please try again." });
          currentSetterLoading(false);
          currentFileNameSetter(null);
          if (docType === "receipt") form.setValue("receiptImageFile", undefined); else form.setValue("billImageFile", undefined);
          return;
        }
      } else if (file.type === "application/pdf") {
         // For PDFs, use the original file for upload and generate data URI from it for AI scan
         fileForUpload = file;
         dataUriForAIScan = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
      } else {
        toast({ variant: "destructive", title: "Unsupported File Type", description: "Please upload an image (JPG, PNG, etc.) or a PDF." });
        currentSetterLoading(false);
        currentFileNameSetter(null); 
        if (docType === "receipt") form.setValue("receiptImageFile", undefined); else form.setValue("billImageFile", undefined);
        return;
      }

      // Set the file (original PDF or compressed image Blob) for upload
      if (docType === "receipt") {
        form.setValue("receiptImageFile", fileForUpload);
        form.setValue("receiptImageUri", undefined); // Clear old URI if new file is uploaded
      } else {
        form.setValue("billImageFile", fileForUpload);
        form.setValue("billImageUri", undefined); // Clear old URI
      }
      
      await processImageForAI(dataUriForAIScan, docType);
    }
  };
    
  const isProcessingImage = isExtractingReceipt || isExtractingBill; 

  const onFormSubmit = (data: ExpenseFormValues) => {
    const submissionData = {
      ...data,
      receiptImageFile: data.receiptImageFile,
      billImageFile: data.billImageFile,
      receiptImageUri: data.receiptImageFile ? undefined : data.receiptImageUri,
      billImageUri: data.billImageFile ? undefined : data.billImageUri,
    };
    onSubmit(submissionData);
  };

  return (
    <>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Expense" : "Add New Expense"}</CardTitle>
          <CardDescription>
            {isEditing ? "Update the details of your expense." : "Fill in the details of your new expense. You can upload a receipt (image/PDF) and/or a bill (image/PDF) to automatically extract information."}
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <CardContent className="space-y-6">
              <div className="space-y-2 p-4 border rounded-md shadow-sm">
                <Label htmlFor="receiptUploadTrigger" className="font-semibold">Receipt Document (Image or PDF)</Label>
                <div className="grid grid-cols-1 gap-2">
                  <Button type="button" id="receiptUploadTrigger" onClick={() => (document.getElementById('receiptUpload') as HTMLInputElement)?.click()} variant="outline" disabled={isProcessingImage}>
                    {isExtractingReceipt ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                    Upload Receipt
                  </Button>
                  <Input id="receiptUpload" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, "receipt")} className="hidden" disabled={isProcessingImage}/>
                </div>
                {uploadedReceiptFileName && !isExtractingReceipt && <p className="text-sm text-muted-foreground mt-1">File: {uploadedReceiptFileName}</p>}
                {form.getValues("receiptImageUri") && !uploadedReceiptFileName && isEditing && <p className="text-sm text-muted-foreground mt-1">Current: <a href={form.getValues("receiptImageUri")} target="_blank" rel="noopener noreferrer" className="underline">View Stored Receipt</a></p>}
                {isExtractingReceipt && <p className="text-sm text-primary flex items-center mt-1"><Wand2 className="h-4 w-4 mr-2 animate-pulse" />Processing receipt...</p>}
              </div>

              <div className="space-y-2 p-4 border rounded-md shadow-sm">
                <Label htmlFor="billUploadTrigger" className="font-semibold">Bill Document (Image or PDF)</Label>
                 <div className="grid grid-cols-1 gap-2">
                  <Button type="button" id="billUploadTrigger" onClick={() => (document.getElementById('billUpload') as HTMLInputElement)?.click()} variant="outline" disabled={isProcessingImage}>
                    {isExtractingBill ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                    Upload Bill
                  </Button>
                   <Input id="billUpload" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, "bill")} className="hidden" disabled={isProcessingImage}/>
                </div>
                {uploadedBillFileName && !isExtractingBill && <p className="text-sm text-muted-foreground mt-1">File: {uploadedBillFileName}</p>}
                {form.getValues("billImageUri") && !uploadedBillFileName && isEditing && <p className="text-sm text-muted-foreground mt-1">Current: <a href={form.getValues("billImageUri")} target="_blank" rel="noopener noreferrer" className="underline">View Stored Bill</a></p>}
                {isExtractingBill && <p className="text-sm text-primary flex items-center mt-1"><Wand2 className="h-4 w-4 mr-2 animate-pulse" />Processing bill...</p>}
              </div>

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Service/Purchase</FormLabel>
                    <FormControl>
                      <DatePicker date={field.value} setDate={field.onChange} disabled={isProcessingImage} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfPayment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Payment (from Receipt)</FormLabel>
                    <FormControl>
                       <DatePicker date={field.value || undefined} setDate={(date) => field.onChange(date || null)} disabled={isProcessingImage} />
                    </FormControl>
                    <FormDescription>Optional. The date payment was made, if shown on the receipt.</FormDescription>
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
                      <Input placeholder="e.g., CVS Pharmacy, Dr. Smith" {...field} disabled={isProcessingImage} />
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
                      <Input placeholder="e.g., John Doe" {...field} disabled={isProcessingImage} />
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
                      <Input type="number" step="0.01" placeholder="0.00" {...field} disabled={isProcessingImage} />
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
                        disabled={isProcessingImage}
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
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isProcessingImage || form.formState.isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting || isProcessingImage}>
                {(form.formState.isSubmitting || isProcessingImage) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isEditing ? "Save Changes" : "Add Expense"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </>
  );
}
