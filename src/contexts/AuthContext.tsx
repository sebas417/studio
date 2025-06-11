
"use client";

import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signOut, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type User 
} from 'firebase/auth';
import { auth, app as firebaseApp } from '@/lib/firebase';
import { toast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isSigningIn: boolean; // General flag for any auth operation in progress
  signUpWithEmailPassword: (email: string, password: string) => Promise<boolean>;
  signInWithEmailPassword: (email: string, password: string) => Promise<boolean>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  useEffect(() => {
    console.log('[AuthContext] AuthProvider initialized', { timestamp: new Date().toISOString(), isClient: typeof window !== 'undefined' });
    console.log('[AuthContext] Firebase App Name:', firebaseApp.name, 'Auth Domain:', auth.config.authDomain);
  }, []);

  useEffect(() => {
    console.log('[AuthContext] Setting up Firebase onAuthStateChanged listener.');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const authStateLog = {
        hasUser: !!user,
        userId: user?.uid || null,
        email: user?.email || null,
        timestamp: new Date().toISOString(),
      };
      console.log('[AuthContext] Firebase onAuthStateChanged event.', authStateLog);

      setCurrentUser(user);
      setLoading(false);
      setIsSigningIn(false); // Reset signing in flag whenever auth state changes
      if (user) {
        console.log('[AuthContext] User authenticated.');
      } else {
        console.log('[AuthContext] User signed out or not authenticated.');
      }
    });
    
    return () => { 
      console.log('[AuthContext] Cleaning up Firebase onAuthStateChanged listener.');
      unsubscribe();
    };
  }, []);

  const signUpWithEmailPassword = async (email: string, password: string): Promise<boolean> => {
    console.log("[AuthContext] signUpWithEmailPassword initiated.");
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance is not available.");
      toast({ variant: 'destructive', title: "Sign-Up Error", description: "Authentication service unavailable. Please refresh." });
      return false;
    }
    if (isSigningIn) {
      toast({ title: "Processing...", description: "An authentication process is already underway." });
      return false;
    }

    setIsSigningIn(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle setCurrentUser and setting isSigningIn to false.
      toast({ title: "Sign-Up Successful!", description: "Welcome! Your account has been created." });
      return true;
    } catch (error: any) {
      console.error("[AuthContext] signUpWithEmailPassword error:", {code: error.code, message: error.message});
      let description = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        description = "This email address is already in use. Please try signing in or use a different email.";
      } else if (error.code === 'auth/invalid-email') {
        description = "The email address is not valid. Please check and try again.";
      } else if (error.code === 'auth/weak-password') {
        description = "The password is too weak. Please choose a stronger password (at least 6 characters).";
      }
      toast({ variant: 'destructive', title: "Sign-Up Failed", description });
      setIsSigningIn(false);
      return false;
    }
  };

  const signInWithEmailPassword = async (email: string, password: string): Promise<boolean> => {
    console.log("[AuthContext] signInWithEmailPassword initiated.");
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance is not available.");
      toast({ variant: 'destructive', title: "Sign-In Error", description: "Authentication service unavailable. Please refresh." });
      return false;
    }
     if (isSigningIn) {
      toast({ title: "Processing...", description: "An authentication process is already underway." });
      return false;
    }

    setIsSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle setCurrentUser and setting isSigningIn to false.
      toast({ title: "Sign-In Successful!", description: "Welcome back!" });
      return true;
    } catch (error: any) {
      console.error("[AuthContext] signInWithEmailPassword error:", {code: error.code, message: error.message});
      let description = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/invalid-email' || error.code === 'auth/invalid-credential') {
        description = "Invalid email or password. Please check your credentials and try again.";
      } else if (error.code === 'auth/user-disabled') {
         description = "This account has been disabled. Please contact support.";
      }
      toast({ variant: 'destructive', title: "Sign-In Failed", description });
      setIsSigningIn(false);
      return false;
    }
  };

  const signOutUser = async () => {
    console.log("[AuthContext] signOutUser initiated.");
    setIsSigningIn(true); // Indicate an auth operation is in progress
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      // onAuthStateChanged will set currentUser to null. setIsSigningIn(false) is handled there.
    } catch (error: any) {
      console.error("[AuthContext] Sign out error:", {code: error.code, message: error.message});
      toast({ variant: 'destructive', title: "Sign-Out Error", description: "Could not sign you out. Please try again." });
      setIsSigningIn(false); // Explicitly reset if signOut fails before onAuthStateChanged does
    }
  };

  const value: AuthContextType = { 
    currentUser, 
    loading, 
    isSigningIn,
    signUpWithEmailPassword,
    signInWithEmailPassword,
    signOutUser, 
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
