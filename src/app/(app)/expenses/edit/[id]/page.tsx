
"use client";

import { ExpenseForm, type expenseFormSchema } from "@/components/ExpenseForm";
import { useExpenses } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import type { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Added Button import

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { getExpenseById, updateExpense, isLoading } = useExpenses();
  const { toast } = useToast();

  const expenseId = typeof id === 'string' ? id : '';
  // getExpenseById might return undefined initially while loading, 
  // or if data is not yet available from Firestore
  const expense = getExpenseById(expenseId); 

  const handleSubmit = async (data: z.infer<typeof expenseFormSchema>) => {
    if (!expenseId) return;
    
    await updateExpense(expenseId, {
      date: data.date,
      dateOfPayment: data.dateOfPayment,
      provider: data.provider,
      patient: data.patient,
      cost: data.cost,
      isReimbursedInput: data.isReimbursedInput,
      receiptImageFile: data.receiptImageFile, // Pass new file if any
      billImageFile: data.billImageFile,       // Pass new file if any
      receiptImageUri: data.receiptImageUri,   // Pass existing URI if no new file
      billImageUri: data.billImageUri,         // Pass existing URI if no new file
    });
    // Toasting is now handled within updateExpense hook
    router.push("/expenses");
  };

  if (isLoading && !expense) { // Show loading skeleton only if expense data isn't available yet
     return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Card className="max-w-2xl mx-auto">
          <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
          <CardContent className="space-y-6">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
             <Skeleton className="h-20 w-full" />
             <div className="flex justify-end gap-2 pt-4">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-24" />
             </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!expense && !isLoading) { // Expense not found after loading attempt
    return (
      <div className="text-center py-10">
        <p className="text-xl text-muted-foreground">Expense not found.</p>
        <Button variant="link" onClick={() => router.push("/expenses")}>Go to Expenses</Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Edit Expense</h2>
      {/* Pass expense as initialData only when it's loaded */}
      {expense && <ExpenseForm initialData={expense} onSubmit={handleSubmit} isEditing />}
    </div>
  );
}
