
export interface Expense {
  id: string;
  date: string; // Store as ISO string (YYYY-MM-DD) for simplicity in localStorage
  provider: string;
  patient: string;
  cost: number;
  isReimbursed: boolean;
  receiptImageUri?: string; // Optional: data URI of the uploaded receipt image
  billImageUri?: string; // Optional: data URI of the uploaded bill image
  dateOfPayment?: string; // Optional: Store as ISO string (YYYY-MM-DD)
}

export type ExpenseFormData = Omit<Expense, "id">;
