
// src/hooks/use-expenses.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Expense } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "@/hooks/use-toast";
import { db, storage, auth as firebaseAuth } from '@/lib/firebase'; // Added firebaseAuth
import { useAuth } from '@/contexts/AuthContext'; // Added
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  where, // Added
  // writeBatch,
  // getDoc, 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

interface FirestoreExpenseDoc {
  id?: string;
  date: Timestamp;
  dateOfPayment?: Timestamp | null;
  provider: string;
  patient: string;
  cost: number;
  isReimbursed: boolean;
  receiptImageUri?: string | null;
  billImageUri?: string | null;
  createdAt: Timestamp;
  userId: string; // Added userId
}


export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { currentUser } = useAuth(); // Added

  useEffect(() => {
    if (!currentUser) {
      setExpenses([]);
      setIsLoading(false);
      return; // Don't fetch if no user
    }

    setIsLoading(true);
    const expensesCollectionRef = collection(db, 'expenses');
    // Query now includes where clause for userId and requires a composite index
    // Index: userId ASC, date DESC, createdAt DESC
    const q = query(
      expensesCollectionRef,
      where('userId', '==', currentUser.uid),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const expensesData: Expense[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreExpenseDoc;
        expensesData.push({
          id: docSnap.id,
          date: data.date.toDate().toISOString().split('T')[0],
          dateOfPayment: data.dateOfPayment ? data.dateOfPayment.toDate().toISOString().split('T')[0] : undefined,
          provider: data.provider,
          patient: data.patient,
          cost: data.cost,
          isReimbursed: data.isReimbursed,
          receiptImageUri: data.receiptImageUri || undefined,
          billImageUri: data.billImageUri || undefined,
          // userId is implicitly handled by the query
        });
      });
      setExpenses(expensesData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching expenses from Firestore:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Expenses",
        description: "Could not fetch expenses. " + error.message,
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]); // Re-run when currentUser changes

  const addExpense = useCallback(async (
    data: Omit<Expense, 'id' | 'date' | 'dateOfPayment'> & { 
      date: Date; 
      dateOfPayment?: Date | null; 
      receiptImageFile?: File | Blob;
      billImageFile?: File | Blob;
      isReimbursedInput?: boolean 
    }
  ) => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to add an expense." });
      return;
    }
    setIsLoading(true);
    try {
      let receiptImageUrl: string | undefined = undefined;
      let billImageUrl: string | undefined = undefined;

      if (data.receiptImageFile) {
        const receiptFileName = (data.receiptImageFile instanceof File) ? data.receiptImageFile.name : 'receipt.jpg';
        // Path now includes userId
        const receiptRef = ref(storage, `expense_images/${currentUser.uid}/receipts/${uuidv4()}-${receiptFileName}`);
        await uploadBytes(receiptRef, data.receiptImageFile);
        receiptImageUrl = await getDownloadURL(receiptRef);
      }
      if (data.billImageFile) {
        const billFileName = (data.billImageFile instanceof File) ? data.billImageFile.name : 'bill.jpg';
        // Path now includes userId
        const billRef = ref(storage, `expense_images/${currentUser.uid}/bills/${uuidv4()}-${billFileName}`);
        await uploadBytes(billRef, data.billImageFile);
        billImageUrl = await getDownloadURL(billRef);
      }

      const newExpenseData: Omit<FirestoreExpenseDoc, 'id' | 'createdAt'> & { createdAt: any } = {
        date: Timestamp.fromDate(data.date),
        dateOfPayment: data.dateOfPayment ? Timestamp.fromDate(data.dateOfPayment) : null,
        provider: data.provider,
        patient: data.patient,
        cost: data.cost,
        isReimbursed: data.isReimbursedInput ?? false,
        receiptImageUri: receiptImageUrl || null,
        billImageUri: billImageUrl || null,
        userId: currentUser.uid, // Added userId
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'expenses'), newExpenseData);
      toast({ title: "Expense Added", description: "Successfully added."});
    } catch (error: any) {
      console.error("Error adding expense to Firestore:", error);
      toast({ variant: "destructive", title: "Error Adding Expense", description: error.message || String(error) });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  const updateExpense = useCallback(async (
    id: string, 
    data: Omit<Expense, 'id' | 'date' | 'dateOfPayment'> & { 
      date: Date; 
      dateOfPayment?: Date | null; 
      receiptImageFile?: File | Blob; 
      billImageFile?: File | Blob; 
      isReimbursedInput?: boolean;
      receiptImageUri?: string; 
      billImageUri?: string;
    }
  ) => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to update an expense." });
      return;
    }
    setIsLoading(true);
    const expenseRef = doc(db, 'expenses', id);
    try {
      // Important: Add a check here to ensure the user owns this document before updating in a real app (using security rules is better)
      let finalReceiptImageUrl: string | null | undefined = data.receiptImageUri; 
      let finalBillImageUrl: string | null | undefined = data.billImageUri;       

      const currentExpense = expenses.find(exp => exp.id === id);

      if (data.receiptImageFile) {
        if (currentExpense?.receiptImageUri) { 
          try { 
            const oldReceiptRef = ref(storage, currentExpense.receiptImageUri);
            await deleteObject(oldReceiptRef); 
          } catch(e) { console.warn("Old receipt image not found or deletion failed", e); } 
        }
        const receiptFileName = (data.receiptImageFile instanceof File) ? data.receiptImageFile.name : 'receipt.jpg';
        const receiptRef = ref(storage, `expense_images/${currentUser.uid}/receipts/${uuidv4()}-${receiptFileName}`);
        await uploadBytes(receiptRef, data.receiptImageFile);
        finalReceiptImageUrl = await getDownloadURL(receiptRef);
      }

      if (data.billImageFile) {
         if (currentExpense?.billImageUri) { 
          try { 
            const oldBillRef = ref(storage, currentExpense.billImageUri);
            await deleteObject(oldBillRef);
          } catch(e) { console.warn("Old bill image not found or deletion failed", e); } 
        }
        const billFileName = (data.billImageFile instanceof File) ? data.billImageFile.name : 'bill.jpg';
        const billRef = ref(storage, `expense_images/${currentUser.uid}/bills/${uuidv4()}-${billFileName}`);
        await uploadBytes(billRef, data.billImageFile);
        finalBillImageUrl = await getDownloadURL(billRef);
      }
      
      const updatedFields: Partial<Omit<FirestoreExpenseDoc, 'id' | 'createdAt' | 'userId'>> = { // userId should not be updated here
        date: Timestamp.fromDate(data.date),
        provider: data.provider,
        patient: data.patient,
        cost: data.cost,
        isReimbursed: data.isReimbursedInput ?? (currentExpense as any)?.isReimbursed ?? false,
        receiptImageUri: (finalReceiptImageUrl === undefined) ? null : finalReceiptImageUrl,
        billImageUri: (finalBillImageUrl === undefined) ? null : finalBillImageUrl,
      };

      if (data.dateOfPayment instanceof Date) {
        updatedFields.dateOfPayment = Timestamp.fromDate(data.dateOfPayment);
      } else if (data.dateOfPayment === null) { // Explicitly cleared
        updatedFields.dateOfPayment = null;
      }
      // If undefined, it's not included, so no change to dateOfPayment unless specified

      await updateDoc(expenseRef, updatedFields);
      toast({ title: "Expense Updated", description: "Changes saved." });
    } catch (error: any) {
      console.error("Error updating expense in Firestore:", error);
      toast({ variant: "destructive", title: "Error Updating Expense", description: error.message || String(error) });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, expenses]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to delete an expense." });
      return;
    }
    setIsLoading(true);
    const expenseRef = doc(db, 'expenses', id);
    try {
      const expenseToDelete = expenses.find(exp => exp.id === id); 
      if (expenseToDelete?.receiptImageUri) {
        try { await deleteObject(ref(storage, expenseToDelete.receiptImageUri)); }
        catch (e) { console.warn("Error deleting receipt image from Storage or already deleted:", e); }
      }
      if (expenseToDelete?.billImageUri) {
         try { await deleteObject(ref(storage, expenseToDelete.billImageUri)); }
         catch (e) { console.warn("Error deleting bill image from Storage or already deleted:", e); }
      }

      await deleteDoc(expenseRef);
      // Toast handled by onSnapshot updates, or add one here if preferred
    } catch (error: any) {
      console.error("Error deleting expense from Firestore:", error);
      toast({ variant: "destructive", title: "Error Deleting Expense", description: error.message || String(error) });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, expenses]);

  const getExpenseById = useCallback((id: string): Expense | undefined => {
    // This will only find expenses already loaded for the current user
    return expenses.find((exp) => exp.id === id);
  }, [expenses]);

  const toggleReimbursement = useCallback(async (id: string) => {
    if (!currentUser) return;
    const expense = expenses.find((exp) => exp.id === id);
    if (!expense) return;

    const expenseRef = doc(db, 'expenses', id);
    try {
      await updateDoc(expenseRef, {
        isReimbursed: !expense.isReimbursed,
      });
    } catch (error: any) {
      console.error("Error toggling reimbursement status:", error);
      toast({ variant: "destructive", title: "Update Error", description: "Could not change reimbursement status: " + error.message });
    }
  }, [currentUser, expenses]);
  
  const getDashboardSummary = useCallback(() => {
    // This summary is now based on the current user's loaded expenses
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
