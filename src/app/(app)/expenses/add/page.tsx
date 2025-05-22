
"use client";

import { ExpenseForm, type expenseFormSchema } from "@/components/ExpenseForm";
import { useExpenses } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { z } from "zod";

export default function AddExpensePage() {
  const router = useRouter();
  const { addExpense, isLoading } = useExpenses(); // Add isLoading
  const { toast } = useToast();

  const handleSubmit = async (data: z.infer<typeof expenseFormSchema>) => {
    // The data from expenseFormSchema now includes receiptImageFile and billImageFile
    await addExpense({
      date: data.date,
      dateOfPayment: data.dateOfPayment,
      provider: data.provider,
      patient: data.patient,
      cost: data.cost,
      isReimbursedInput: data.isReimbursedInput,
      receiptImageFile: data.receiptImageFile, // Pass the file
      billImageFile: data.billImageFile,     // Pass the file
    });
    // Toasting is now handled within addExpense hook after successful Firestore operation
    router.push("/expenses");
  };

  return (
    <div className="space-y-6">
       <h2 className="text-3xl font-bold tracking-tight">Add New Expense</h2>
      <ExpenseForm onSubmit={handleSubmit} />
    </div>
  );
}
