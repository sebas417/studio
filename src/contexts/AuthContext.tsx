
"use client";

import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Using the initialized auth instance from our firebase lib
import { useRouter } from 'next/navigation';
import { toast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Utility function to detect if we're on a mobile device
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Utility function to detect if popups might be blocked
const isPopupLikelyBlocked = (): boolean => {
  // Mobile devices often have issues with popups
  if (isMobileDevice()) {
    return true;
  }
  
  try {
    // Try to open a test popup
    const testPopup = window.open('', '_blank', 'width=1,height=1');
    if (testPopup) {
      testPopup.close();
      return false;
    }
    return true;
  } catch (error) {
    return true;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter(); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // Check for redirect result on component mount
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // User signed in via redirect
          console.log("[AuthContext] User signed in via redirect");
        }
      } catch (error: any) {
        console.error("[AuthContext] Error getting redirect result:", error);
        // Handle redirect errors
        if (error.code === 'auth/unauthorized-domain') {
          toast({
            variant: 'destructive',
            title: "Configuration Issue",
            description: "This domain is not authorized for authentication. Please contact support.",
            duration: 10000,
          });
        }
      }
    };

    checkRedirectResult();

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

    // Check if popups are likely to be blocked
    if (isPopupLikelyBlocked()) {
      console.log("[AuthContext] Popup likely blocked, suggesting redirect method");
      const isMobile = isMobileDevice();
      toast({
        variant: 'destructive',
        title: isMobile ? "Mobile Device Detected" : "Popup Blocked",
        description: isMobile 
          ? "For the best experience on mobile devices, we'll use the redirect sign-in method."
          : "Your browser appears to block popups. We'll use the redirect method instead for a better experience.",
        duration: 5000,
      });
      // Use redirect method instead
      return signInWithGoogleRedirect();
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
          description: "The sign-in popup was closed. Would you like to try signing in with a redirect instead? Click the sign-in button again or try the redirect option.",
          duration: 10000,
        });
      } else if (error.code === 'auth/popup-blocked') {
        toast({
          variant: 'destructive',
          title: "Popup Blocked",
          description: "Your browser blocked the sign-in popup. Please allow popups for this site or try the redirect sign-in option below.",
          duration: 10000,
        });
        // Automatically try redirect as fallback
        console.log("[AuthContext] Popup blocked, attempting redirect fallback");
        setTimeout(() => signInWithGoogleRedirect(), 2000);
      } else if (error.code === 'auth/unauthorized-domain') {
        toast({
          variant: 'destructive',
          title: "Domain Not Authorized",
          description: "This domain is not authorized for authentication. Please contact support if this issue persists.",
          duration: 10000,
        });
      } else if (error.code === 'auth/operation-not-allowed') {
        toast({
          variant: 'destructive',
          title: "Sign-In Method Disabled",
          description: "Google sign-in is currently disabled. Please contact support.",
          duration: 10000,
        });
      } else if (error.code === 'auth/too-many-requests') {
        toast({
          variant: 'destructive',
          title: "Too Many Attempts",
          description: "Too many failed sign-in attempts. Please wait a moment before trying again.",
          duration: 10000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: "Sign-In Failed",
          description: "An unexpected error occurred while trying to sign you in. Please try again or use the redirect option.",
          duration: 7000,
        });
      }
    }
  };

  const signInWithGoogleRedirect = async () => {
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
      await signInWithRedirect(auth, provider);
      // The redirect will happen immediately, and the result will be handled
      // by getRedirectResult in the useEffect
    } catch (error: any) {
      console.error("[AuthContext] Error during signInWithRedirect: ", error.code, error.message);
      
      toast({
        variant: 'destructive',
        title: "Redirect Sign-In Failed",
        description: "Unable to redirect for sign-in. Please check your internet connection and try again.",
        duration: 7000,
      });
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
    signInWithGoogleRedirect,
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
