
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
  const router = useRouter(); // router can be used if needed for navigation after auth actions

  useEffect(() => {
    console.log("[AuthContext] Setting up onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("[AuthContext] onAuthStateChanged: User is signed in.", user.uid, user.email);
      } else {
        console.log("[AuthContext] onAuthStateChanged: User is signed out.");
      }
      setCurrentUser(user);
      setLoading(false);
    });
    return () => {
      console.log("[AuthContext] Cleaning up onAuthStateChanged listener.");
      unsubscribe();
    }
  }, []);

  const signInWithGoogle = async () => {
    console.log("[AuthContext] signInWithGoogle function CALLED.");

    if (!auth) {
      console.error("[AuthContext] Firebase auth instance from '@/lib/firebase' is not available. Cannot sign in.");
      toast({
        variant: 'destructive',
        title: "Authentication Service Error",
        description: "The Firebase authentication service is not properly initialized. Please contact support or try again later.",
        duration: 7000,
      });
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    // Prompt for account selection to help with stale cookie/session issues
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    console.log("[AuthContext] Attempting to sign in with Google using provider:", provider);

    try {
      const result = await signInWithPopup(auth, provider);
      console.log("[AuthContext] Google Sign-In successful. UserCredential Result:", result);
      // Successful sign-in will be handled by onAuthStateChanged
    } catch (error: any) {
      console.error("[AuthContext] Error during signInWithPopup: ", error);
      console.error("[AuthContext] Error Code:", error.code);
      console.error("[AuthContext] Error Message:", error.message);
      
      if (error.code === 'auth/popup-closed-by-user') {
        toast({
          variant: 'destructive',
          title: "Sign-In Popup Closed",
          description: "The Google Sign-In popup closed before completion. This can happen due to browser settings (e.g., strict privacy, third-party cookie blocking), or if you manually closed it. If persistent, try clearing browser cookies for Google and this site, or check your Google Cloud OAuth consent screen settings.",
          duration: 10000,
        });
      } else if (error.code === 'auth/cancelled-popup-request') {
         toast({
          variant: 'destructive',
          title: "Sign-In Request Cancelled",
          description: "Multiple sign-in popups may have been opened or the request was cancelled. This can also be related to browser settings or OAuth consent screen issues. Please try again.",
          duration: 10000,
        });
      } else if (error.code === 'auth/unauthorized-domain') {
        toast({
          variant: 'destructive',
          title: "Domain Not Authorized for Sign-In",
          description: "This domain is not authorized for Google Sign-In. Please check Firebase console settings under Authentication > Settings > Authorized domains. Ensure your current development URL (including any specific port) is listed.",
          duration: 10000,
        });
      }
      else {
        toast({
          variant: 'destructive',
          title: "Sign-In Failed",
          description: `Error: ${error.message || "An unexpected error occurred. Please try again."}`,
          duration: 7000,
        });
      }
    }
  };

  const signOutUser = async () => {
    console.log("[AuthContext] Attempting to sign out current user:", currentUser?.uid);
    try {
      await signOut(auth);
      console.log("[AuthContext] Sign-out successful via signOutUser function.");
      // router.push('/'); // Optional: redirect to home page after sign out
    } catch (error: any) {
      console.error("[AuthContext] Error signing out: ", error);
      toast({
        variant: 'destructive',
        title: "Sign-Out Failed",
        description: error.message || "An unexpected error occurred during sign-out.",
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

