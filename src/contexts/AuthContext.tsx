
"use client";

import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  type User 
} from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Using the initialized auth instance from our firebase lib
import { useRouter } from 'next/navigation';
import { toast } from "@/hooks/use-toast";

// Utility function to detect mobile devices with improved accuracy
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  
  // Check for mobile user agent
  const isMobileUA = mobileRegex.test(userAgent);
  
  // Also check for touch capability and screen size
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  
  // Check for specific mobile indicators
  const hasCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const isMobileViewport = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  
  // More comprehensive mobile detection
  const isMobile = isMobileUA || 
                   (isTouchDevice && isSmallScreen) || 
                   (hasCoarsePointer && isMobileViewport);
  
  console.log("[AuthContext] Mobile detection:", {
    userAgent: userAgent.substring(0, 50) + "...",
    isMobileUA,
    isTouchDevice,
    isSmallScreen,
    hasCoarsePointer,
    isMobileViewport,
    finalResult: isMobile
  });
  
  return isMobile;
};

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  isSigningIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  // Restore signing-in state on page load (important for mobile redirects)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const wasSigningIn = localStorage.getItem('hsashield_signing_in');
      if (wasSigningIn) {
        console.log("[AuthContext] Restoring signing-in state from localStorage");
        setIsSigningIn(true);
      }
    }
  }, []); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[AuthContext] Auth state changed:", user ? `User: ${user.email}` : "No user");
      setCurrentUser(user);
      setLoading(false);
      if (user) {
        setIsSigningIn(false); // Reset signing in state when user is authenticated
        
        // Clear any stored signing-in state when user is successfully authenticated
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hsashield_signing_in');
        }
      }
    });
    return () => {
      unsubscribe();
    }
  }, []);

  // Handle redirect result on component mount with improved error handling and retry logic
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const handleRedirectResult = async () => {
      try {
        console.log("[AuthContext] Checking for redirect result...");
        const result = await getRedirectResult(auth);
        if (result) {
          // User successfully signed in via redirect
          console.log("[AuthContext] Sign-in via redirect successful", {
            user: result.user.email,
            providerId: result.providerId
          });
          setIsSigningIn(false);
          
          // Clear any stored signing-in state
          if (typeof window !== 'undefined') {
            localStorage.removeItem('hsashield_signing_in');
          }
        } else {
          console.log("[AuthContext] No redirect result found");
          // Check if we were in the middle of signing in
          if (typeof window !== 'undefined') {
            const wasSigningIn = localStorage.getItem('hsashield_signing_in');
            if (wasSigningIn) {
              console.log("[AuthContext] Was signing in but no redirect result - clearing state");
              localStorage.removeItem('hsashield_signing_in');
              setIsSigningIn(false);
            }
          }
        }
      } catch (error: any) {
        console.error("[AuthContext] Error handling redirect result:", error.code, error.message);
        
        // Retry logic for transient errors
        if (retryCount < maxRetries && (
          error.code === 'auth/network-request-failed' ||
          error.code === 'auth/timeout' ||
          error.code === 'auth/internal-error'
        )) {
          retryCount++;
          console.log(`[AuthContext] Retrying redirect result check (${retryCount}/${maxRetries}) in ${retryDelay}ms`);
          setTimeout(handleRedirectResult, retryDelay);
          return;
        }
        
        setIsSigningIn(false);
        
        // Clear any stored signing-in state
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hsashield_signing_in');
        }
        
        // Handle redirect-specific errors
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          toast({
            variant: 'destructive',
            title: "Sign-In Interrupted",
            description: "The sign-in process was cancelled. Please try again.",
            duration: 7000,
          });
        } else if (error.code === 'auth/unauthorized-domain') {
          toast({
            variant: 'destructive',
            title: "Configuration Error",
            description: "This domain is not authorized for Google sign-in. Please contact support.",
            duration: 10000,
          });
        } else {
          toast({
            variant: 'destructive',
            title: "Sign-In Failed",
            description: "An error occurred during sign-in. Please try again.",
            duration: 7000,
          });
        }
      }
    };

    // Add a small delay to ensure the page has fully loaded
    const timer = setTimeout(handleRedirectResult, 100);
    
    return () => clearTimeout(timer);
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

    if (isSigningIn) {
      console.log("[AuthContext] Sign-in already in progress, ignoring duplicate request");
      return;
    }

    setIsSigningIn(true);

    // Store signing-in state for mobile redirect persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('hsashield_signing_in', 'true');
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const isMobile = isMobileDevice();
    console.log(`[AuthContext] Device type: ${isMobile ? 'Mobile' : 'Desktop'}`);

    // For mobile devices, use redirect method directly as it's more reliable
    if (isMobile) {
      try {
        console.log("[AuthContext] Using signInWithRedirect for mobile device");
        
        // Add additional mobile-specific configuration
        provider.setCustomParameters({
          prompt: 'select_account',
          // Force mobile-optimized flow
          display: 'touch'
        });
        
        await signInWithRedirect(auth, provider);
        // The redirect will happen, and the result will be handled in the useEffect
        // Note: setIsSigningIn(false) will be called in the redirect result handler
        return;
      } catch (error: any) {
        console.error("[AuthContext] Error during signInWithRedirect:", error.code, error.message);
        setIsSigningIn(false);
        
        // Clear stored state on error
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hsashield_signing_in');
        }
        
        toast({
          variant: 'destructive',
          title: "Sign-In Failed",
          description: "Unable to start the sign-in process. Please try again.",
          duration: 7000,
        });
        return;
      }
    }

    // For desktop devices, try popup first with fallback to redirect
    try {
      console.log("[AuthContext] Attempting signInWithPopup for desktop device");
      await signInWithPopup(auth, provider);
      setIsSigningIn(false);
      
      // Clear stored state on success
      if (typeof window !== 'undefined') {
        localStorage.removeItem('hsashield_signing_in');
      }
      
      console.log("[AuthContext] Sign-in with popup successful");
      // Successful sign-in will be handled by onAuthStateChanged
    } catch (error: any) {
      console.error("[AuthContext] Error during signInWithPopup:", error.code, error.message);
      
      // If popup fails due to being closed by user or other popup-related issues, 
      // fall back to redirect method
      if (error.code === 'auth/popup-closed-by-user' || 
          error.code === 'auth/cancelled-popup-request' ||
          error.code === 'auth/popup-blocked') {
        
        console.log("[AuthContext] Popup failed, falling back to redirect method");
        
        toast({
          title: "Switching Sign-In Method",
          description: "Popup was blocked or closed. Redirecting to Google sign-in page...",
          duration: 3000,
        });

        try {
          await signInWithRedirect(auth, provider);
          // The redirect will happen, and the result will be handled in the useEffect
          // Note: setIsSigningIn(false) will be called in the redirect result handler
          return;
        } catch (redirectError: any) {
          console.error("[AuthContext] Error during fallback signInWithRedirect:", redirectError.code, redirectError.message);
          setIsSigningIn(false);
          
          // Clear stored state on error
          if (typeof window !== 'undefined') {
            localStorage.removeItem('hsashield_signing_in');
          }
          
          toast({
            variant: 'destructive',
            title: "Sign-In Failed",
            description: "Unable to complete sign-in. Please try again or contact support if the issue persists.",
            duration: 10000,
          });
        }
      } else if (error.code === 'auth/unauthorized-domain') {
        setIsSigningIn(false);
        
        // Clear stored state on error
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hsashield_signing_in');
        }
        
        toast({
          variant: 'destructive',
          title: "Sign-In Configuration Issue",
          description: "There seems to be a configuration problem with sign-in. Please contact support if this issue persists.",
          duration: 10000,
        });
      } else {
        setIsSigningIn(false);
        
        // Clear stored state on error
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hsashield_signing_in');
        }
        
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
    isSigningIn,
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
