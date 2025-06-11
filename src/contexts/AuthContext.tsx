
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
  isSigningIn: boolean; 
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
    // console.log('[AuthContext] AuthProvider initialized', { timestamp: new Date().toISOString(), isClient: typeof window !== 'undefined' });
    // console.log('[AuthContext] Firebase App Name:', firebaseApp.name, 'Auth Domain:', auth?.config?.authDomain || "Auth not fully initialized");
  }, []);

  useEffect(() => {
    // console.log('[AuthContext] Setting up Firebase onAuthStateChanged listener.');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // const authStateLog = {
      //   hasUser: !!user,
      //   userId: user?.uid || null,
      //   email: user?.email || null,
      //   timestamp: new Date().toISOString(),
      // };
      // console.log('[AuthContext] Firebase onAuthStateChanged event.', authStateLog);

      setCurrentUser(user);
      setLoading(false);
      setIsSigningIn(false); 
      // if (user) {
      //   console.log('[AuthContext] User authenticated.');
      // } else {
      //   console.log('[AuthContext] User signed out or not authenticated.');
      // }
    });
    
    return () => { 
      // console.log('[AuthContext] Cleaning up Firebase onAuthStateChanged listener.');
      unsubscribe();
    };
  }, []);

  const signUpWithEmailPassword = async (email: string, password: string): Promise<boolean> => {
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance is not available for signUp.");
      toast({ variant: 'destructive', title: "Sign-Up Error", description: "Authentication service unavailable. Please refresh and try again." });
      setIsSigningIn(false);
      return false;
    }
    if (isSigningIn) {
      // toast({ title: "Processing...", description: "An authentication attempt is already in progress." });
      return false; // Silently prevent multiple submissions
    }

    setIsSigningIn(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast({ title: "Sign-Up Successful!", description: "Welcome! Your account has been created." });
      // onAuthStateChanged will handle setCurrentUser and setting isSigningIn to false.
      return true;
    } catch (error: any) {
      console.error("[AuthContext] signUpWithEmailPassword raw error object:", error);
      const errorCode = error?.code;
      const errorMessage = error?.message;
      // The console.error below is for debugging, it's okay if it shows empty for non-Firebase errors
      console.error("[AuthContext] signUpWithEmailPassword extracted details:", { code: errorCode, message: errorMessage });

      let description = "An unexpected sign-up error occurred. Please try again.";
      if (errorCode === 'auth/email-already-in-use') {
        description = "This email address is already in use. Please try signing in or use a different email.";
      } else if (errorCode === 'auth/invalid-email') {
        description = "The email address is not valid. Please check and try again.";
      } else if (errorCode === 'auth/weak-password') {
        description = "The password is too weak. Please choose a stronger password (at least 6 characters).";
      } else if (errorMessage) {
        description = `Sign-up failed: ${errorMessage}`;
      }
      toast({ variant: 'destructive', title: "Sign-Up Failed", description });
      setIsSigningIn(false);
      return false;
    }
  };

  const signInWithEmailPassword = async (email: string, password: string): Promise<boolean> => {
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance is not available for signIn.");
      toast({ variant: 'destructive', title: "Sign-In Error", description: "Authentication service unavailable. Please refresh and try again." });
      setIsSigningIn(false);
      return false;
    }
     if (isSigningIn) {
      // toast({ title: "Processing...", description: "An authentication attempt is already in progress." });
      return false; // Silently prevent multiple submissions
    }

    setIsSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Sign-In Successful!", description: "Welcome back!" });
      // onAuthStateChanged will handle setCurrentUser and setting isSigningIn to false.
      return true;
    } catch (error: any) {
      console.error("[AuthContext] signInWithEmailPassword raw error object:", error);
      const errorCode = error?.code;
      const errorMessage = error?.message;
      // The console.error below is for debugging
      console.error("[AuthContext] signInWithEmailPassword extracted details:", { code: errorCode, message: errorMessage });

      let description = "An unexpected sign-in error occurred. Please try again.";
      if (errorCode === 'auth/invalid-email' || errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
        description = "Invalid email or password. Please check your credentials and try again.";
      } else if (errorCode === 'auth/user-disabled') {
         description = "This account has been disabled. Please contact support.";
      } else if (errorMessage) {
        description = `Sign-in failed: ${errorMessage}`;
      }
      toast({ variant: 'destructive', title: "Sign-In Failed", description });
      setIsSigningIn(false);
      return false;
    }
  };

  const signOutUser = async () => {
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance is not available for signOut.");
      toast({ variant: 'destructive', title: "Sign-Out Error", description: "Authentication service unavailable." });
      return;
    }
    setIsSigningIn(true); 
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      // onAuthStateChanged will set isSigningIn to false
    } catch (error: any) {
      console.error("[AuthContext] Sign out raw error object:", error);
      const errorCode = error?.code;
      const errorMessage = error?.message;
      console.error("[AuthContext] Sign out extracted details:", { code: errorCode, message: errorMessage });
      toast({ variant: 'destructive', title: "Sign-Out Error", description: errorMessage || "Could not sign you out. Please try again." });
      setIsSigningIn(false); 
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
