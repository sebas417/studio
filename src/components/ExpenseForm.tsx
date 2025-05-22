
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { Expense } from "@/lib/types";
import { extractData, type ExtractDataOutput } from "@/ai/flows/extract-data-from-receipt";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UploadCloud, Wand2, CirclePlay, Camera, VideoOff } from "lucide-react";

export const expenseFormSchema = z.object({
  date: z.date({ required_error: "Date is required." }),
  provider: z.string().min(1, "Provider is required."),
  patient: z.string().min(1, "Patient is required."),
  cost: z.coerce.number().positive("Cost must be a positive number."),
  isReimbursedInput: z.boolean().default(false).optional(),
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

  const [isCameraModalOpen, setIsCameraModalOpen] = React.useState(false);
  const [cameraDocType, setCameraDocType] = React.useState<"receipt" | "bill" | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          date: initialData.date ? new Date(initialData.date) : new Date(),
          isReimbursedInput: initialData.isReimbursed,
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
        setUploadedReceiptFileName(initialData.receiptImageUri.startsWith('data:') ? "Stored Receipt" : initialData.receiptImageUri);
      }
      if(initialData.billImageUri) {
        setUploadedBillFileName(initialData.billImageUri.startsWith('data:') ? "Stored Bill" : initialData.billImageUri);
      }
    }
  }, [initialData, form.reset, form]);

  // Camera permission and stream handling effect
  React.useEffect(() => {
    let stream: MediaStream | null = null;

    const getCameraStream = async () => {
      if (isCameraModalOpen && videoRef.current) {
        setHasCameraPermission(null); // Reset while requesting
        setCameraError(null);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play();
          }
          setHasCameraPermission(true);
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          if (error instanceof Error && error.name === "NotAllowedError") {
            setCameraError("Camera permission was denied. Please enable it in your browser settings.");
          } else {
            setCameraError("Could not access the camera. Please ensure it's connected and not in use by another app.");
          }
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
        }
      }
    };

    getCameraStream();

    return () => { // Cleanup function
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isCameraModalOpen, toast]);


  const handleAIDataPopulation = (extracted: ExtractDataOutput, documentType: "Receipt" | "Bill") => {
    if (extracted.date) form.setValue("date", new Date(extracted.date), { shouldValidate: true });
    if (extracted.provider) form.setValue("provider", extracted.provider, { shouldValidate: true });
    if (extracted.patient) form.setValue("patient", extracted.patient, { shouldValidate: true });
    if (extracted.cost) form.setValue("cost", extracted.cost, { shouldValidate: true });
    toast({ title: `Data Extracted from ${documentType}`, description: `Fields populated from ${documentType.toLowerCase()}. Please review.` });
  };

  const processImageForAI = async (dataUri: string, docType: "receipt" | "bill") => {
    const currentSetter = docType === "receipt" ? setIsExtractingReceipt : setIsExtractingBill;
    const currentFileNameSetter = docType === "receipt" ? setUploadedReceiptFileName : setUploadedBillFileName;
    
    currentSetter(true);
    currentFileNameSetter(`Captured ${docType}.png`);

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
      currentSetter(false);
    }
  };
  
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    docType: "receipt" | "bill"
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        await processImageForAI(dataUri, docType);
      };
      reader.readAsDataURL(file);
      if (docType === "receipt") setUploadedReceiptFileName(file.name);
      else setUploadedBillFileName(file.name);
    }
  };
  
  const handleTakePhotoClick = (docTypeToSet: "receipt" | "bill") => {
    setCameraDocType(docTypeToSet);
    setIsCameraModalOpen(true);
  };

  const handleCaptureImage = async () => {
    if (videoRef.current && canvasRef.current && cameraDocType && hasCameraPermission) {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/png');
        
        await processImageForAI(dataUri, cameraDocType);
      }
      setIsCameraModalOpen(false);
      setCameraDocType(null);
      setIsCapturing(false);
    } else {
      toast({ variant: "destructive", title: "Capture Failed", description: "Could not capture image. Camera might not be ready." });
    }
  };

  const handleGoogleDriveUpload = async (docType: "receipt" | "bill") => {
    toast({
      title: "Google Drive Upload (Placeholder)",
      description: `This feature is not fully implemented. Would upload ${docType} from Google Drive.`,
    });
    console.log(`Placeholder: Upload ${docType} from Google Drive`);
  };
  
  const isProcessing = isExtractingReceipt || isExtractingBill || isCapturing;

  const onFormSubmit = (data: ExpenseFormValues) => {
    onSubmit(data);
  };

  return (
    <>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Expense" : "Add New Expense"}</CardTitle>
          <CardDescription>
            {isEditing ? "Update the details of your expense." : "Fill in the details of your new expense. You can upload or take a photo of a receipt and/or a bill to automatically extract information."}
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <CardContent className="space-y-6">
              {/* Receipt Section */}
              <div className="space-y-2 p-4 border rounded-md shadow-sm">
                <Label htmlFor="receiptUpload" className="font-semibold">Receipt Document</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button type="button" onClick={() => (document.getElementById('receiptUpload') as HTMLInputElement)?.click()} variant="outline" disabled={isProcessing || isCameraModalOpen}>
                    {isExtractingReceipt && !isCapturing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                    Upload
                  </Button>
                  <Input id="receiptUpload" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, "receipt")} className="hidden" disabled={isProcessing || isCameraModalOpen}/>
                  <Button type="button" onClick={() => handleTakePhotoClick("receipt")} variant="outline" disabled={isProcessing || isCameraModalOpen}>
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                  <Button type="button" onClick={() => handleGoogleDriveUpload("receipt")} variant="outline" disabled={isProcessing || isCameraModalOpen}>
                    <CirclePlay className="h-4 w-4 mr-2" />
                    From Drive
                  </Button>
                </div>
                {uploadedReceiptFileName && !isExtractingReceipt && <p className="text-sm text-muted-foreground mt-1">File: {uploadedReceiptFileName}</p>}
                {form.getValues("receiptImageUri") && !uploadedReceiptFileName && isEditing && <p className="text-sm text-muted-foreground mt-1">Existing receipt present.</p>}
                {isExtractingReceipt && <p className="text-sm text-primary flex items-center mt-1"><Wand2 className="h-4 w-4 mr-2 animate-pulse" />Extracting from receipt...</p>}
              </div>

              {/* Bill Section */}
              <div className="space-y-2 p-4 border rounded-md shadow-sm">
                <Label htmlFor="billUpload" className="font-semibold">Bill Document</Label>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button type="button" onClick={() => (document.getElementById('billUpload') as HTMLInputElement)?.click()} variant="outline" disabled={isProcessing || isCameraModalOpen}>
                    {isExtractingBill && !isCapturing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                    Upload
                  </Button>
                   <Input id="billUpload" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, "bill")} className="hidden" disabled={isProcessing || isCameraModalOpen}/>
                  <Button type="button" onClick={() => handleTakePhotoClick("bill")} variant="outline" disabled={isProcessing || isCameraModalOpen}>
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                  <Button type="button" onClick={() => handleGoogleDriveUpload("bill")} variant="outline" disabled={isProcessing || isCameraModalOpen}>
                    <CirclePlay className="h-4 w-4 mr-2" />
                    From Drive
                  </Button>
                </div>
                {uploadedBillFileName && !isExtractingBill && <p className="text-sm text-muted-foreground mt-1">File: {uploadedBillFileName}</p>}
                {form.getValues("billImageUri") && !uploadedBillFileName && isEditing && <p className="text-sm text-muted-foreground mt-1">Existing bill present.</p>}
                {isExtractingBill && <p className="text-sm text-primary flex items-center mt-1"><Wand2 className="h-4 w-4 mr-2 animate-pulse" />Extracting from bill...</p>}
              </div>

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Service/Purchase</FormLabel>
                    <FormControl>
                      <DatePicker date={field.value} setDate={field.onChange} disabled={isProcessing || isCameraModalOpen} />
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
                      <Input placeholder="e.g., CVS Pharmacy, Dr. Smith" {...field} disabled={isProcessing || isCameraModalOpen} />
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
                      <Input placeholder="e.g., John Doe" {...field} disabled={isProcessing || isCameraModalOpen} />
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
                      <Input type="number" step="0.01" placeholder="0.00" {...field} disabled={isProcessing || isCameraModalOpen} />
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
                        disabled={isProcessing || isCameraModalOpen}
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
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isProcessing || isCameraModalOpen}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting || isProcessing || isCameraModalOpen}>
                {(form.formState.isSubmitting || isProcessing) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isEditing ? "Save Changes" : "Add Expense"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Dialog open={isCameraModalOpen} onOpenChange={(open) => {
          setIsCameraModalOpen(open);
          if (!open) { // Reset states if modal is closed manually
            setCameraDocType(null);
            setHasCameraPermission(null);
            setCameraError(null);
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }
          }
      }}>
        <DialogContent className="sm:max-w-[calc(100vw-2rem)] md:max-w-md lg:max-w-lg xl:max-w-xl w-full">
          <DialogHeader>
            <DialogTitle>Take Photo for {cameraDocType === "receipt" ? "Receipt" : "Bill"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {hasCameraPermission === null && !cameraError && (
              <div className="flex flex-col items-center justify-center p-4 min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-muted-foreground">Requesting camera access...</p>
              </div>
            )}
            {hasCameraPermission === false && cameraError && (
              <Alert variant="destructive">
                <VideoOff className="h-4 w-4" />
                <AlertTitle>Camera Error</AlertTitle>
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            )}
            {hasCameraPermission && (
              <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay playsInline muted />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
             <Button variant="outline" onClick={() => setIsCameraModalOpen(false)} disabled={isCapturing}>
              Cancel
            </Button>
            <Button onClick={handleCaptureImage} disabled={!hasCameraPermission || isCapturing}>
              {isCapturing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Capture Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
