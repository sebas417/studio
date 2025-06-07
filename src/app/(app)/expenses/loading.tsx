"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ExpensesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      
      <Card>
        <CardHeader>
          <div className="rounded-lg border shadow-sm">
            <Skeleton className="h-12 w-full rounded-t-lg" />
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
        </CardHeader>
      </Card>
    </div>
  );
}