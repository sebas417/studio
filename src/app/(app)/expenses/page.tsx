"use client";

import { Button } from "@/components/ui/button";
import { ExpensesTable } from "@/components/ExpensesTable";
import { useExpenses } from "@/hooks/use-expenses";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptText, PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


export default function ExpensesPage() {
  const { expenses, isLoading } = useExpenses();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-1/4" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-lg border shadow-sm">
           <Skeleton className="h-12 w-full rounded-t-lg" /> {/* TableHeader */}
           {[...Array(5)].map((_, i) => (
             <div key={i} className="flex items-center p-4 border-b">
               <Skeleton className="h-6 w-[100px] mr-4" />
               <Skeleton className="h-6 flex-1 mr-4" />
               <Skeleton className="h-6 flex-1 mr-4" />
               <Skeleton className="h-6 w-20 mr-4" />
               <Skeleton className="h-6 w-6 mr-4 rounded-sm" />
               <Skeleton className="h-8 w-8 rounded-md" />
             </div>
           ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold tracking-tight">My Expenses</h2>
        <Button asChild>
          <Link href="/expenses/add">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Expense
          </Link>
        </Button>
      </div>
      {expenses.length > 0 ? (
        <ExpensesTable expenses={expenses} />
      ) : (
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-center">No Expenses Yet!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <ReceiptText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">You haven't added any expenses. Click the button above to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
