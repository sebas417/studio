"use client";

import { useExpenses } from '@/hooks/use-expenses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ListChecks, ReceiptText, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
  const { getDashboardSummary, isLoading } = useExpenses();
  const summary = getDashboardSummary();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
         <Card>
          <CardHeader>
            <CardTitle>Reimbursement Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const reimbursementPercentage = summary.totalExpenses > 0 ? (summary.totalReimbursed / summary.totalExpenses) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <Button asChild>
          <Link href="/expenses/add">Add New Expense</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">{summary.countTotal} expenses recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reimbursed</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalReimbursed)}</div>
            <p className="text-xs text-muted-foreground">{summary.countReimbursed} expenses reimbursed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reimbursement</CardTitle>
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalUnreimbursed)}</div>
            <p className="text-xs text-muted-foreground">{summary.countUnreimbursed} expenses pending</p>
          </CardContent>
        </Card>
      </div>

      {summary.countTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reimbursement Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={reimbursementPercentage} aria-label={`${reimbursementPercentage.toFixed(0)}% Reimbursed`} />
            <p className="text-sm text-muted-foreground">
              {formatCurrency(summary.totalReimbursed)} of {formatCurrency(summary.totalExpenses)} reimbursed ({reimbursementPercentage.toFixed(0)}%)
            </p>
          </CardContent>
        </Card>
      )}
       {summary.countTotal === 0 && (
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-center">No Expenses Yet!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <ReceiptText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Start by adding your first HSA expense.</p>
            <Button asChild>
              <Link href="/expenses/add">Add Expense</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
