
// src/hooks/use-expenses.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Expense } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid'; // Still useful for generating Storage file names
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
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Define a type for the data coming from Firestore, which might use Timestamps
interface FirestoreExpenseDoc {
  id?: string; // Firestore document ID will be set after retrieval or on creation by Firestore
  date: Timestamp | string; // Firestore stores as Timestamp, form might use string initially
  dateOfPayment?: Timestamp | string | null;
  provider: string;
  patient: string;
  cost: number;
  isReimbursed: boolean;
  receiptImageUri?: string;
  billImageUri?: string;
  createdAt: Timestamp; // For ordering or auditing
  // userId: string; // TODO: Add when authentication is implemented
}


export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // TODO: When auth is added, query should be user-specific:
    // const q = query(collection(db, 'users', userId, 'expenses'), orderBy('date', 'desc'));
    const expensesCollectionRef = collection(db, 'expenses');
    const q = query(expensesCollectionRef, orderBy('date', 'desc'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const expensesData: Expense[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreExpenseDoc;
        expensesData.push({
          id: docSnap.id,
          date: data.date instanceof Timestamp ? data.date.toDate().toISOString().split('T')[0] : data.date as string,
          dateOfPayment: data.dateOfPayment ? (data.dateOfPayment instanceof Timestamp ? data.dateOfPayment.toDate().toISOString().split('T')[0] : data.dateOfPayment as string) : undefined,
          provider: data.provider,
          patient: data.patient,
          cost: data.cost,
          isReimbursed: data.isReimbursed,
          receiptImageUri: data.receiptImageUri,
          billImageUri: data.billImageUri,
        });
      });
      setExpenses(expensesData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching expenses from Firestore:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Expenses",
        description: "Could not fetch expenses from the database.",
      });
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, []); // TODO: Add userId as dependency when auth is added

  const addExpense = useCallback(async (
    data: Omit<Expense, 'id' | 'date' | 'dateOfPayment'> & { 
      date: Date; 
      dateOfPayment?: Date | null; 
      receiptImageFile?: File | Blob; // Changed from URI to File/Blob
      billImageFile?: File | Blob;   // Changed from URI to File/Blob
      isReimbursedInput?: boolean 
    }
  ) => {
    setIsLoading(true);
    try {
      let receiptImageUrl: string | undefined = undefined;
      let billImageUrl: string | undefined = undefined;

      // TODO: Add userId to path when auth is implemented
      if (data.receiptImageFile) {
        const receiptRef = ref(storage, `expense_images/receipts/${uuidv4()}-${(data.receiptImageFile as File).name || 'receipt.jpg'}`);
        await uploadBytes(receiptRef, data.receiptImageFile);
        receiptImageUrl = await getDownloadURL(receiptRef);
      }
      if (data.billImageFile) {
        const billRef = ref(storage, `expense_images/bills/${uuidv4()}-${(data.billImageFile as File).name || 'bill.jpg'}`);
        await uploadBytes(billRef, data.billImageFile);
        billImageUrl = await getDownloadURL(billRef);
      }

      const newExpenseDoc: Omit<FirestoreExpenseDoc, 'id' | 'createdAt'> = {
        // userId: "current_user_id", // TODO: Replace with actual user ID
        date: Timestamp.fromDate(data.date),
        dateOfPayment: data.dateOfPayment ? Timestamp.fromDate(data.dateOfPayment) : null,
        provider: data.provider,
        patient: data.patient,
        cost: data.cost,
        isReimbursed: data.isReimbursedInput ?? false,
        receiptImageUri: receiptImageUrl,
        billImageUri: billImageUrl,
      };
      
      const docRef = await addDoc(collection(db, 'expenses'), {
        ...newExpenseDoc,
        createdAt: serverTimestamp() // Let Firestore set the creation timestamp
      });
      // No need to setExpenses manually, onSnapshot will update
      toast({ title: "Expense Added", description: "Successfully added to database."});
    } catch (error) {
      console.error("Error adding expense to Firestore:", error);
      toast({ variant: "destructive", title: "Error Adding Expense", description: String(error) });
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
      // Include original URIs to know if they should be preserved or replaced
      receiptImageUri?: string;
      billImageUri?: string;
    }
  ) => {
    setIsLoading(true);
    const expenseRef = doc(db, 'expenses', id);
    try {
      let newReceiptImageUrl = data.receiptImageUri; // Keep old if no new file
      let newBillImageUrl = data.billImageUri;     // Keep old if no new file

      // TODO: Handle deletion of old images from Storage if replaced. This is complex.
      // For simplicity, this version will just upload new images and update URLs.
      // Old images might become orphaned in Storage.

      if (data.receiptImageFile) {
        // If there was an old image, consider deleting it from storage first
        // const oldReceiptUrl = (await getDoc(expenseRef)).data()?.receiptImageUri;
        // if (oldReceiptUrl) { try { await deleteObject(ref(storage, oldReceiptUrl)); } catch(e){ console.warn("Old receipt not found or deletion failed", e);}}

        const receiptRef = ref(storage, `expense_images/receipts/${uuidv4()}-${(data.receiptImageFile as File).name || 'receipt.jpg'}`);
        await uploadBytes(receiptRef, data.receiptImageFile);
        newReceiptImageUrl = await getDownloadURL(receiptRef);
      }

      if (data.billImageFile) {
        // const oldBillUrl = (await getDoc(expenseRef)).data()?.billImageUri;
        // if (oldBillUrl) { try { await deleteObject(ref(storage, oldBillUrl)); } catch(e){ console.warn("Old bill not found or deletion failed", e);}}

        const billRef = ref(storage, `expense_images/bills/${uuidv4()}-${(data.billImageFile as File).name || 'bill.jpg'}`);
        await uploadBytes(billRef, data.billImageFile);
        newBillImageUrl = await getDownloadURL(billRef);
      }
      
      const updatedFields: Partial<FirestoreExpenseDoc> = {
        date: Timestamp.fromDate(data.date),
        dateOfPayment: data.dateOfPayment === undefined ? undefined : (data.dateOfPayment === null ? null : Timestamp.fromDate(data.dateOfPayment)),
        provider: data.provider,
        patient: data.patient,
        cost: data.cost,
        isReimbursed: data.isReimbursedInput ?? (data as any).isReimbursed ?? false,
        receiptImageUri: newReceiptImageUrl,
        billImageUri: newBillImageUrl,
      };

      await updateDoc(expenseRef, updatedFields);
      toast({ title: "Expense Updated", description: "Changes saved to database." });
    } catch (error) {
      console.error("Error updating expense in Firestore:", error);
      toast({ variant: "destructive", title: "Error Updating Expense", description: String(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    setIsLoading(true);
    const expenseRef = doc(db, 'expenses', id);
    try {
      // Optional: Delete associated images from Firebase Storage
      const expenseDoc = expenses.find(exp => exp.id === id);
      if (expenseDoc?.receiptImageUri) {
        try { await deleteObject(ref(storage, expenseDoc.receiptImageUri)); }
        catch (e) { console.warn("Error deleting receipt image from Storage or already deleted:", e); }
      }
      if (expenseDoc?.billImageUri) {
         try { await deleteObject(ref(storage, expenseDoc.billImageUri)); }
         catch (e) { console.warn("Error deleting bill image from Storage or already deleted:", e); }
      }

      await deleteDoc(expenseRef);
      toast({ title: "Expense Deleted", description: "Removed from database.", variant: "destructive" });
    } catch (error) {
      console.error("Error deleting expense from Firestore:", error);
      toast({ variant: "destructive", title: "Error Deleting Expense", description: String(error) });
    } finally {
      setIsLoading(false);
    }
  }, [expenses]);

  const getExpenseById = useCallback((id: string): Expense | undefined => {
    // This might not be strictly necessary if `expenses` state is always current
    // due to onSnapshot. But can be kept for direct access if needed.
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
      // Toast can be added here, or rely on onSnapshot to update UI
    } catch (error) {
      console.error("Error toggling reimbursement status:", error);
      toast({ variant: "destructive", title: "Update Error", description: "Could not change reimbursement status." });
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
