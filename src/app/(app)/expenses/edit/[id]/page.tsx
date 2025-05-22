"use client";

import { ExpenseForm, type expenseFormSchema } from "@/components/ExpenseForm";
import { useExpenses } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import type { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { getExpenseById, updateExpense, isLoading } = useExpenses();
  const { toast } = useToast();

  const expenseId = typeof id === 'string' ? id : '';
  const expense = getExpenseById(expenseId);

  const handleSubmit = (data: z.infer<typeof expenseFormSchema>) => {
    if (!expenseId) return;
    updateExpense(expenseId, data);
    toast({
      title: "Expense Updated",
      description: `${data.provider} for $${data.cost.toFixed(2)} has been updated.`,
    });
    router.push("/expenses");
  };

  if (isLoading) {
     return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Card className="max-w-2xl mx-auto">
          <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
          <CardContent className="space-y-6">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
             <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!expense && !isLoading) {
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
      {expense && <ExpenseForm initialData={expense} onSubmit={handleSubmit} isEditing />}
    </div>
  );
}
