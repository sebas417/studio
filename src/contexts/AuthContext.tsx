
"use client";

import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Using the initialized auth instance from our firebase lib
import { useRouter } from 'next/navigation'; // Using next/navigation for App Router
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
    console.log("[AuthContext] Setting up onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[AuthContext] onAuthStateChanged triggered. User:", user);
      setCurrentUser(user);
      setLoading(false);
    });
    return () => {
      console.log("[AuthContext] Cleaning up onAuthStateChanged listener.");
      unsubscribe();
    }
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    console.log("[AuthContext] Attempting to sign in with Google...");
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("[AuthContext] Google Sign-In successful. Result:", result);
      // Successful sign-in will be handled by onAuthStateChanged, which updates currentUser.
      // Other components (like RootPage or AppLayout) will react to currentUser change for redirection.
    } catch (error: any) {
      console.error("[AuthContext] Error signing in with Google: ", error);
      console.error("[AuthContext] Error Code:", error.code);
      console.error("[AuthContext] Error Message:", error.message);
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
    console.log("[AuthContext] Attempting to sign out...");
    try {
      await signOut(auth);
      console.log("[AuthContext] Sign-out successful.");
      router.push('/'); // Redirect to home or a public page after sign-out
    } catch (error: any) {
      console.error("[AuthContext] Error signing out: ", error);
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
