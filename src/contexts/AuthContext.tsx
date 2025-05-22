
"use client";

import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Using the initialized auth instance from our firebase lib
import { useRouter } from 'next/navigation'; // Using next/navigation for App Router
import { toast } from "@/hooks/use-toast"; // Added for toast notifications

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // Successful sign-in will be handled by onAuthStateChanged
      // Optionally redirect or show toast here
      router.push('/dashboard'); // Redirect to dashboard after sign-in
    } catch (error: any) { // Used 'any' to check error.code
      console.error("Error signing in with Google: ", error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast({
          title: "Sign-In Cancelled",
          description: "The Google Sign-In popup was closed before completing. Please try again.",
          variant: "default",
          duration: 5000,
        });
      } else if (error.code === 'auth/cancelled-popup-request') {
         toast({
          title: "Sign-In Cancelled",
          description: "Multiple sign-in popups may have been opened. Please try again.",
          variant: "default",
          duration: 5000,
        });
      } else {
        // Generic error for other cases
        toast({
          title: "Sign-In Failed",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      // Successful sign-out will be handled by onAuthStateChanged
      // Optionally redirect or show toast here
      router.push('/'); // Redirect to home or a public page after sign-out
    } catch (error: any) {
      console.error("Error signing out: ", error);
      toast({
        title: "Sign-Out Failed",
        description: error.message || "An unexpected error occurred during sign-out.",
        variant: "destructive",
      });
    }
  };

  const value = {
    currentUser,
    loading,
    signInWithGoogle,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
