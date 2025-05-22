"use client";

import { ExpenseForm, type expenseFormSchema } from "@/components/ExpenseForm";
import { useExpenses } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { z } from "zod";

export default function AddExpensePage() {
  const router = useRouter();
  const { addExpense } = useExpenses();
  const { toast } = useToast();

  const handleSubmit = (data: z.infer<typeof expenseFormSchema>) => {
    addExpense(data);
    toast({
      title: "Expense Added",
      description: `${data.provider} for $${data.cost.toFixed(2)} has been added.`,
    });
    router.push("/expenses");
  };

  return (
    <div className="space-y-6">
       <h2 className="text-3xl font-bold tracking-tight">Add New Expense</h2>
      <ExpenseForm onSubmit={handleSubmit} />
    </div>
  );
}
