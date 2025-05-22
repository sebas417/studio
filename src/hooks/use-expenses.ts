
// src/hooks/use-expenses.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Expense } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "@/hooks/use-toast"; // Import toast

const STORAGE_KEY = 'hsaShieldExpenses';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedExpenses = localStorage.getItem(STORAGE_KEY);
      if (storedExpenses) {
        setExpenses(JSON.parse(storedExpenses));
      }
    } catch (error) {
      console.error("Failed to load expenses from localStorage:", error);
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        toast({
          variant: "destructive",
          title: "Storage Full During Load",
          description: "Could not load all expense data. Browser storage is full.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Load Error",
          description: "Failed to load expenses. Data might be corrupted.",
        });
      }
      // localStorage.removeItem(STORAGE_KEY); // Optionally clear corrupted storage
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) { // Only save when not initially loading
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
      } catch (error) {
        console.error("Failed to save expenses to localStorage:", error); // This log will be picked up by Next.js overlay
        if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          toast({
            variant: "destructive",
            title: "Storage Full",
            description: "Could not save image data as browser storage is full. Attempting to save other expense details. Please consider clearing some site data or reducing image uploads.",
            duration: 9000, 
          });
          // Attempt to save without images
          try {
            const expensesWithoutImages = expenses.map(exp => {
              const { receiptImageUri, billImageUri, ...rest } = exp;
              return rest; // isReimbursed and other fields are preserved in ...rest
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(expensesWithoutImages));
             toast({
              title: "Partial Save Successful",
              description: "Expense details (without images) have been saved.",
            });
          } catch (nestedError) {
            console.error("Failed to save expenses even without images:", nestedError);
            toast({
              variant: "destructive",
              title: "Save Failed",
              description: "Could not save any expense data due to critical storage issues. Even the fallback save without images failed.",
            });
          }
        } else {
           toast({
            variant: "destructive",
            title: "Save Error",
            description: "An unexpected error occurred while saving expenses.",
          });
        }
      }
    }
  }, [expenses, isLoading]);

  const addExpense = useCallback((data: Omit<Expense, 'id' | 'date'> & { date: Date; receiptImageUri?: string; billImageUri?: string; isReimbursedInput?: boolean }) => {
    setExpenses((prevExpenses) => {
      const newExpense: Expense = {
        id: uuidv4(),
        date: data.date.toISOString().split('T')[0], // Store date as YYYY-MM-DD string
        provider: data.provider,
        patient: data.patient,
        cost: data.cost,
        isReimbursed: data.isReimbursedInput !== undefined ? data.isReimbursedInput : (data as any).isReimbursed !== undefined ? (data as any).isReimbursed : false,
        receiptImageUri: data.receiptImageUri,
        billImageUri: data.billImageUri,
      };
      return [...prevExpenses, newExpense].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
  }, []);

  const updateExpense = useCallback((id: string, data: Omit<Expense, 'id' | 'date'> & { date: Date; isReimbursedInput?: boolean; receiptImageUri?: string; billImageUri?: string }) => {
    setExpenses((prevExpenses) =>
      prevExpenses.map((exp) =>
        exp.id === id ? {
          ...exp,
          ...data,
          date: data.date.toISOString().split('T')[0],
          isReimbursed: data.isReimbursedInput !== undefined ? data.isReimbursedInput : (data as any).isReimbursed !== undefined ? (data as any).isReimbursed : exp.isReimbursed,
          // Ensure existing image URIs are preserved if not explicitly overwritten by `data`
          receiptImageUri: data.receiptImageUri !== undefined ? data.receiptImageUri : exp.receiptImageUri,
          billImageUri: data.billImageUri !== undefined ? data.billImageUri : exp.billImageUri,
        } : exp
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prevExpenses) => prevExpenses.filter((exp) => exp.id !== id));
  }, []);

  const getExpenseById = useCallback((id: string): Expense | undefined => {
    return expenses.find((exp) => exp.id === id);
  }, [expenses]);

  const toggleReimbursement = useCallback((id: string) => {
    setExpenses((prevExpenses) =>
      prevExpenses.map((exp) =>
        exp.id === id ? { ...exp, isReimbursed: !exp.isReimbursed } : exp
      )
    );
  }, []);
  
  const getDashboardSummary = useCallback(() => {
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.cost, 0);
    const totalReimbursed = expenses
      .filter(exp => exp.isReimbursed)
      .reduce((sum, exp) => sum + exp.cost, 0);
    const totalUnreimbursed = totalExpenses - totalReimbursed;
    const countTotal = expenses.length;
    const countReimbursed = expenses.filter(exp => exp.isReimbursed).length;
    const countUnreimbursed = countTotal - countReimbursed;

    return {
      totalExpenses,
      totalReimbursed,
      totalUnreimbursed,
      countTotal,
      countReimbursed,
      countUnreimbursed,
    };
  }, [expenses]);


  return {
    expenses,
    isLoading,
    addExpense,
    updateExpense,
    deleteExpense,
    getExpenseById,
    toggleReimbursement,
    getDashboardSummary,
  };
}
