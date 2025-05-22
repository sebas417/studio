
// src/hooks/use-expenses.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Expense } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "@/hooks/use-toast";
import { db, storage } from '@/lib/firebase';
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
  // writeBatch, // Not used yet
  // getDoc, // Not used directly here for expense data, onSnapshot handles it
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Define a type for the data coming from Firestore, which might use Timestamps
interface FirestoreExpenseDoc {
  id?: string;
  date: Timestamp;
  dateOfPayment?: Timestamp | null;
  provider: string;
  patient: string;
  cost: number;
  isReimbursed: boolean;
  receiptImageUri?: string | null; // Can be string or null
  billImageUri?: string | null;   // Can be string or null
  createdAt: Timestamp;
  // userId: string; // TODO: Add when authentication is implemented
}


export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const expensesCollectionRef = collection(db, 'expenses');
    // Query requires a composite index on (date desc, createdAt desc)
    const q = query(expensesCollectionRef, orderBy('date', 'desc'), orderBy('createdAt', 'desc'));

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
          receiptImageUri: data.receiptImageUri || undefined, // Convert null from DB to undefined for type consistency
          billImageUri: data.billImageUri || undefined,     // Convert null from DB to undefined for type consistency
        });
      });
      setExpenses(expensesData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching expenses from Firestore:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Expenses",
        description: "Could not fetch expenses from the database. " + error.message,
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addExpense = useCallback(async (
    data: Omit<Expense, 'id' | 'date' | 'dateOfPayment'> & { 
      date: Date; 
      dateOfPayment?: Date | null; 
      receiptImageFile?: File | Blob;
      billImageFile?: File | Blob;
      isReimbursedInput?: boolean 
    }
  ) => {
    setIsLoading(true);
    try {
      let receiptImageUrl: string | undefined = undefined;
      let billImageUrl: string | undefined = undefined;

      if (data.receiptImageFile) {
        const receiptFileName = (data.receiptImageFile instanceof File) ? data.receiptImageFile.name : 'receipt.jpg';
        const receiptRef = ref(storage, `expense_images/receipts/${uuidv4()}-${receiptFileName}`);
        await uploadBytes(receiptRef, data.receiptImageFile);
        receiptImageUrl = await getDownloadURL(receiptRef);
      }
      if (data.billImageFile) {
        const billFileName = (data.billImageFile instanceof File) ? data.billImageFile.name : 'bill.jpg';
        const billRef = ref(storage, `expense_images/bills/${uuidv4()}-${billFileName}`);
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
        receiptImageUri: receiptImageUrl || null, // Ensure null instead of undefined
        billImageUri: billImageUrl || null,       // Ensure null instead of undefined
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'expenses'), newExpenseData);
      toast({ title: "Expense Added", description: "Successfully added to database."});
    } catch (error: any) {
      console.error("Error adding expense to Firestore:", error);
      toast({ variant: "destructive", title: "Error Adding Expense", description: error.message || String(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateExpense = useCallback(async (
    id: string, 
    data: Omit<Expense, 'id' | 'date' | 'dateOfPayment'> & { 
      date: Date; 
      dateOfPayment?: Date | null; 
      receiptImageFile?: File | Blob; 
      billImageFile?: File | Blob; 
      isReimbursedInput?: boolean;
      receiptImageUri?: string; // Existing URI from form state
      billImageUri?: string;   // Existing URI from form state
    }
  ) => {
    setIsLoading(true);
    const expenseRef = doc(db, 'expenses', id);
    try {
      let finalReceiptImageUrl: string | null | undefined = data.receiptImageUri; // Start with existing URI from form
      let finalBillImageUrl: string | null | undefined = data.billImageUri;       // Start with existing URI from form


      if (data.receiptImageFile) {
        // Optional: Delete old image from storage if replacing
        // const currentExpense = expenses.find(exp => exp.id === id);
        // if (currentExpense?.receiptImageUri) { try { await deleteObject(ref(storage, currentExpense.receiptImageUri)); } catch(e) { /* ignore */ } }
        const receiptFileName = (data.receiptImageFile instanceof File) ? data.receiptImageFile.name : 'receipt.jpg';
        const receiptRef = ref(storage, `expense_images/receipts/${uuidv4()}-${receiptFileName}`);
        await uploadBytes(receiptRef, data.receiptImageFile);
        finalReceiptImageUrl = await getDownloadURL(receiptRef);
      }

      if (data.billImageFile) {
        // Optional: Delete old image from storage
        // const currentExpense = expenses.find(exp => exp.id === id);
        // if (currentExpense?.billImageUri) { try { await deleteObject(ref(storage, currentExpense.billImageUri)); } catch(e) { /* ignore */ } }
        const billFileName = (data.billImageFile instanceof File) ? data.billImageFile.name : 'bill.jpg';
        const billRef = ref(storage, `expense_images/bills/${uuidv4()}-${billFileName}`);
        await uploadBytes(billRef, data.billImageFile);
        finalBillImageUrl = await getDownloadURL(billRef);
      }
      
      const updatedFields: Partial<FirestoreExpenseDoc> = {
        date: Timestamp.fromDate(data.date),
        provider: data.provider,
        patient: data.patient,
        cost: data.cost,
        isReimbursed: data.isReimbursedInput ?? (data as any).isReimbursed ?? false,
        // Set to null if undefined, otherwise use the value for image URIs
        receiptImageUri: (finalReceiptImageUrl === undefined) ? null : finalReceiptImageUrl,
        billImageUri: (finalBillImageUrl === undefined) ? null : finalBillImageUrl,
      };

      // Handle dateOfPayment carefully for updates:
      // - If data.dateOfPayment is a Date, convert to Timestamp.
      // - If data.dateOfPayment is null (form field cleared), set to null in Firestore.
      // - If data.dateOfPayment is undefined (form field not touched and was not initially set), do not include in update.
      if (data.dateOfPayment instanceof Date) {
        updatedFields.dateOfPayment = Timestamp.fromDate(data.dateOfPayment);
      } else if (data.dateOfPayment === null) {
        updatedFields.dateOfPayment = null;
      }
      // If data.dateOfPayment is undefined, it's omitted from updatedFields, meaning "no change".

      await updateDoc(expenseRef, updatedFields);
      toast({ title: "Expense Updated", description: "Changes saved to database." });
    } catch (error: any) {
      console.error("Error updating expense in Firestore:", error);
      toast({ variant: "destructive", title: "Error Updating Expense", description: error.message || String(error) });
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed 'expenses' from dependency array as direct mutation is avoided; using onSnapshot for updates.

  const deleteExpense = useCallback(async (id: string) => {
    setIsLoading(true);
    const expenseRef = doc(db, 'expenses', id);
    try {
      const expenseToDelete = expenses.find(exp => exp.id === id); // Find from local state to get URIs
      if (expenseToDelete?.receiptImageUri) {
        try { await deleteObject(ref(storage, expenseToDelete.receiptImageUri)); }
        catch (e) { console.warn("Error deleting receipt image from Storage or already deleted:", e); }
      }
      if (expenseToDelete?.billImageUri) {
         try { await deleteObject(ref(storage, expenseToDelete.billImageUri)); }
         catch (e) { console.warn("Error deleting bill image from Storage or already deleted:", e); }
      }

      await deleteDoc(expenseRef);
      // Toast is handled by onSnapshot updates triggering UI change, but explicit toast is fine too.
      // toast({ title: "Expense Deleted", description: "Removed from database.", variant: "destructive" });
    } catch (error: any) {
      console.error("Error deleting expense from Firestore:", error);
      toast({ variant: "destructive", title: "Error Deleting Expense", description: error.message || String(error) });
    } finally {
      setIsLoading(false);
    }
  }, [expenses]); // Keep 'expenses' here if used to find URIs for deletion

  const getExpenseById = useCallback((id: string): Expense | undefined => {
    return expenses.find((exp) => exp.id === id);
  }, [expenses]);

  const toggleReimbursement = useCallback(async (id: string) => {
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
  }, [expenses]);
  
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

