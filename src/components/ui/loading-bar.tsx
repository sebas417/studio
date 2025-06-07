"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingBarProps {
  isLoading: boolean;
  className?: string;
}

export function LoadingBar({ isLoading, className }: LoadingBarProps) {
  if (!isLoading) return null;

  return (
    <div className={cn("fixed top-0 left-0 right-0 z-50", className)}>
      <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse">
        <div className="h-full bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  };

  return (
    <div className={cn("animate-spin rounded-full border-2 border-gray-300 border-t-blue-600", sizeClasses[size], className)} />
  );
}