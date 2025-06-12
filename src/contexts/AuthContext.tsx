
"use client";

import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Using the initialized auth instance from our firebase lib
import { useRouter } from 'next/navigation';
import { toast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithEmailAndPassword: (email: string, password: string) => Promise<void>;
  createUserWithEmailAndPassword: (email: string, password: string) => Promise<void>;
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
    return () => {
      unsubscribe();
    }
  }, []);

  const signInWithEmailAndPasswordHandler = async (email: string, password: string) => {
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance from '@/lib/firebase' is not available.");
      toast({
        variant: 'destructive',
        title: "Authentication Service Error",
        description: "The authentication service is currently unavailable. Please try again later.",
        duration: 7000,
      });
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Successful sign-in will be handled by onAuthStateChanged
      // User will be redirected by logic in page.tsx or layout.tsx based on currentUser state
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
        duration: 3000,
      });
    } catch (error: any) {
      console.error("[AuthContext] Error during signInWithEmailAndPassword: ", error.code, error.message);
      
      if (error.code === 'auth/user-not-found') {
        toast({
          variant: 'destructive',
          title: "User Not Found",
          description: "No account found with this email address. Please check your email or create a new account.",
          duration: 7000,
        });
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast({
          variant: 'destructive',
          title: "Invalid Credentials",
          description: "The email or password you entered is incorrect. Please try again.",
          duration: 7000,
        });
      } else if (error.code === 'auth/invalid-email') {
        toast({
          variant: 'destructive',
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          duration: 7000,
        });
      } else if (error.code === 'auth/too-many-requests') {
        toast({
          variant: 'destructive',
          title: "Too Many Attempts",
          description: "Too many failed sign-in attempts. Please try again later.",
          duration: 7000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: "Sign-In Failed",
          description: "An unexpected error occurred while trying to sign you in. Please try again.",
          duration: 7000,
        });
      }
    }
  };

  const createUserWithEmailAndPasswordHandler = async (email: string, password: string) => {
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance from '@/lib/firebase' is not available.");
      toast({
        variant: 'destructive',
        title: "Authentication Service Error",
        description: "The authentication service is currently unavailable. Please try again later.",
        duration: 7000,
      });
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Successful account creation will be handled by onAuthStateChanged
      toast({
        title: "Account Created!",
        description: "Your account has been created successfully. Welcome!",
        duration: 3000,
      });
    } catch (error: any) {
      console.error("[AuthContext] Error during createUserWithEmailAndPassword: ", error.code, error.message);
      
      if (error.code === 'auth/email-already-in-use') {
        toast({
          variant: 'destructive',
          title: "Email Already in Use",
          description: "An account with this email address already exists. Please sign in instead.",
          duration: 7000,
        });
      } else if (error.code === 'auth/weak-password') {
        toast({
          variant: 'destructive',
          title: "Weak Password",
          description: "Password should be at least 6 characters long.",
          duration: 7000,
        });
      } else if (error.code === 'auth/invalid-email') {
        toast({
          variant: 'destructive',
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          duration: 7000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: "Account Creation Failed",
          description: "An unexpected error occurred while creating your account. Please try again.",
          duration: 7000,
        });
      }
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      // Navigation to home or login page can be handled by the layout/page components
      // observing the currentUser state change.
      // router.push('/'); 
    } catch (error: any) {
      console.error("[AuthContext] Error signing out: ", error);
      toast({
        variant: 'destructive',
        title: "Sign-Out Failed",
        description: "An unexpected error occurred during sign-out. Please try again.",
      });
    }
  };

  const value = {
    currentUser,
    loading,
    signInWithEmailAndPassword: signInWithEmailAndPasswordHandler,
    createUserWithEmailAndPassword: createUserWithEmailAndPasswordHandler,
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
