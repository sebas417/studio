
"use client";

import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Using the initialized auth instance from our firebase lib
import { useRouter } from 'next/navigation';
import { toast } from "@/hooks/use-toast";

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
    return () => {
      unsubscribe();
    }
  }, []);

  const signInWithGoogle = async () => {
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

    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    try {
      await signInWithPopup(auth, provider);
      // Successful sign-in will be handled by onAuthStateChanged
      // User will be redirected by logic in page.tsx or layout.tsx based on currentUser state
    } catch (error: any) {
      console.error("[AuthContext] Error during signInWithPopup: ", error.code, error.message);
      
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        toast({
          variant: 'destructive',
          title: "Sign-In Interrupted",
          description: "The sign-in process didn't complete. This can sometimes happen due to browser settings or if the window was closed prematurely. Please try again. If the issue persists, try clearing browser cookies.",
          duration: 10000,
        });
      } else if (error.code === 'auth/unauthorized-domain') {
        // This error is primarily for the developer during setup.
        // A user ideally shouldn't see this if the app is correctly configured.
        // We'll show a generic error to the user for other cases.
         toast({
          variant: 'destructive',
          title: "Sign-In Configuration Issue",
          description: "There seems to be a configuration problem with sign-in. Please contact support if this issue persists.",
          duration: 10000,
        });
      }
      else {
        toast({
          variant: 'destructive',
          title: "Sign-In Failed",
          description: "An unexpected error occurred while trying to sign you in. Please try again.",
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
