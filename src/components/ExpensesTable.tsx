
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit3, Trash2, Eye, FileText } from "lucide-react";
import type { Expense } from "@/lib/types";
import { useExpenses } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";


interface ExpensesTableProps {
  expenses: Expense[];
}

export function ExpensesTable({ expenses }: ExpensesTableProps) {
  const router = useRouter();
  const { deleteExpense, toggleReimbursement } = useExpenses();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [expenseToDelete, setExpenseToDelete] = React.useState<string | null>(null);

  const handleDeleteConfirmation = (id: string) => {
    setExpenseToDelete(id);
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (expenseToDelete) {
      const expense = expenses.find(exp => exp.id === expenseToDelete);
      deleteExpense(expenseToDelete);
      toast({
        title: "Expense Deleted",
        description: `Expense for ${expense?.provider} on ${formatDate(expense?.date || new Date().toISOString())} has been deleted.`,
        variant: "destructive"
      });
      setExpenseToDelete(null);
    }
    setDialogOpen(false);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch (e) {
      return dateString; // Fallback if date is invalid
    }
  };

  return (
    <>
      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-center w-[150px]">Reimbursed</TableHead>
              <TableHead className="text-right w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No expenses recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{formatDate(expense.date)}</TableCell>
                  <TableCell>{expense.provider}</TableCell>
                  <TableCell>{expense.patient}</TableCell>
                  <TableCell className="text-right">{formatCurrency(expense.cost)}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={expense.isReimbursed}
                      onCheckedChange={() => toggleReimbursement(expense.id)}
                      aria-label={expense.isReimbursed ? "Mark as not reimbursed" : "Mark as reimbursed"}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/expenses/edit/${expense.id}`)}>
                          <Edit3 className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {(expense.receiptImageUri || expense.billImageUri) && <DropdownMenuSeparator />}
                        {expense.receiptImageUri && (
                           <DropdownMenuItem onClick={() => window.open(expense.receiptImageUri, '_blank')}>
                             <Eye className="mr-2 h-4 w-4" />
                             View Receipt
                           </DropdownMenuItem>
                        )}
                        {expense.billImageUri && (
                           <DropdownMenuItem onClick={() => window.open(expense.billImageUri, '_blank')}>
                             <FileText className="mr-2 h-4 w-4" />
                             View Bill
                           </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteConfirmation(expense.id)}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the expense.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExpenseToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={buttonVariants({ variant: "destructive" })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Helper, as ShadCN doesn't export buttonVariants by default sometimes.
// This might not be needed if your setup exports it.
const buttonVariants = ({ variant }: { variant: "destructive" | "outline" | "default" | "secondary" | "ghost" | "link" }) => {
  if (variant === "destructive") return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
  if (variant === "outline") return "border border-input bg-background hover:bg-accent hover:text-accent-foreground";
  return "";
};
