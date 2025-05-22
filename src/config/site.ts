import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, ReceiptText, PlusCircle } from 'lucide-react';

export const siteConfig = {
  name: "HSA Shield",
  description: "Track your HSA expenses with ease. Scan receipts, manage reimbursements, and stay organized.",
  url: "http://localhost:9002", // Replace with actual URL when deployed
};

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
};

export const mainNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: ReceiptText,
  },
  {
    title: "Add Expense",
    href: "/expenses/add",
    icon: PlusCircle,
  },
];
