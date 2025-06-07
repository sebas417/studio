
"use client";

import React, { createContext, useState, useEffect, useContext, useRef, type ReactNode } from 'react';
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

// Utility function to detect mobile devices with enhanced logging
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') {
    console.log('[AuthContext] isMobileDevice: window is undefined (SSR)');
    return false;
  }
  
  const userAgent = window.navigator.userAgent;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  
  // Check for mobile user agent
  const isMobileUA = mobileRegex.test(userAgent);
  
  // Also check for touch capability and screen size
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  
  // Additional checks for mobile browsers that might not be caught by regex
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isMobileSafari = isIOS && /Safari/i.test(userAgent) && !/CriOS|FxiOS/i.test(userAgent);
  const isMobileChrome = /Chrome/i.test(userAgent) && /Mobile/i.test(userAgent);
  
  // Log detailed device information for debugging
  console.log('[AuthContext] Device Detection Details:', {
    userAgent: userAgent,
    isMobileUA: isMobileUA,
    isTouchDevice: isTouchDevice,
    isSmallScreen: isSmallScreen,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    maxTouchPoints: maxTouchPoints,
    devicePixelRatio: window.devicePixelRatio || 1,
    platform: navigator.platform || 'unknown',
    vendor: navigator.vendor || 'unknown',
    isAndroid: isAndroid,
    isIOS: isIOS,
    isMobileSafari: isMobileSafari,
    isMobileChrome: isMobileChrome
  });
  
  // Primary detection: mobile user agent
  // Secondary detection: touch device with small screen (for edge cases)
  // Tertiary detection: specific mobile browser patterns
  const isMobile = isMobileUA || (isTouchDevice && isSmallScreen) || isMobileSafari || isMobileChrome;
  
  console.log(`[AuthContext] Final mobile detection result: ${isMobile}`);
  
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

// Global flag to prevent multiple AuthProvider instances
let authProviderInstance: boolean = false;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Initialize isSigningIn from localStorage if available
  const [isSigningIn, setIsSigningIn] = useState(() => {
    if (typeof window !== 'undefined') {
      const wasSigningIn = localStorage.getItem('hsaShield_signingIn') === 'true';
      const signInTimestamp = localStorage.getItem('hsaShield_signInTimestamp');
      
      if (wasSigningIn && signInTimestamp) {
        const timeDiff = Date.now() - parseInt(signInTimestamp);
        // If less than 5 minutes, restore the signing in state
        if (timeDiff < 5 * 60 * 1000) {
          return true;
        } else {
          // Clear old state
          localStorage.removeItem('hsaShield_signingIn');
          localStorage.removeItem('hsaShield_signInTimestamp');
        }
      }
    }
    return false;
  });
  const router = useRouter();
  
  // Use refs to track initialization and prevent race conditions
  const isInitialized = useRef(false);
  const redirectResultChecked = useRef(false);
  const authStateListenerSetup = useRef(false);

  // Prevent multiple AuthProvider instances
  useEffect(() => {
    if (authProviderInstance) {
      console.warn('[AuthContext] Multiple AuthProvider instances detected. This may cause authentication issues.');
      return;
    }
    authProviderInstance = true;
    
    // Log initialization only once
    if (!isInitialized.current) {
      console.log('[AuthContext] AuthProvider initialized', {
        timestamp: new Date().toISOString(),
        isClient: typeof window !== 'undefined',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
        url: typeof window !== 'undefined' ? window.location.href : 'SSR'
      });
      isInitialized.current = true;
    }

    return () => {
      authProviderInstance = false;
    };
  }, []); 

  useEffect(() => {
    if (authStateListenerSetup.current) {
      console.log('[AuthContext] Auth state listener already setup, skipping');
      return;
    }
    
    console.log('[AuthContext] Setting up auth state listener');
    authStateListenerSetup.current = true;
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[AuthContext] Auth state changed:', {
        hasUser: !!user,
        userId: user?.uid || null,
        email: user?.email || null,
        displayName: user?.displayName || null,
        emailVerified: user?.emailVerified || null,
        isAnonymous: user?.isAnonymous || null,
        providerData: user?.providerData?.map(p => ({
          providerId: p.providerId,
          uid: p.uid
        })) || null,
        timestamp: new Date().toISOString()
      });
      
      setCurrentUser(user);
      setLoading(false);
      
      if (user) {
        console.log('[AuthContext] User authenticated, resetting signing in state');
        setIsSigningIn(false); // Reset signing in state when user is authenticated
      } else {
        console.log('[AuthContext] User signed out or not authenticated');
      }
    });
    
    return () => {
      console.log('[AuthContext] Cleaning up auth state listener');
      authStateListenerSetup.current = false;
      unsubscribe();
    }
  }, []);

  // Handle redirect result on component mount
  useEffect(() => {
    const handleRedirectResult = async () => {
      if (redirectResultChecked.current) {
        console.log('[AuthContext] Redirect result already checked, skipping');
        return;
      }
      
      console.log('[AuthContext] Checking for redirect result on component mount');
      redirectResultChecked.current = true;
      
      // Check if we were in the middle of a sign-in process
      const wasSigningIn = typeof window !== 'undefined' ? localStorage.getItem('hsaShield_signingIn') === 'true' : false;
      const signInTimestamp = typeof window !== 'undefined' ? localStorage.getItem('hsaShield_signInTimestamp') : null;
      
      if (wasSigningIn) {
        console.log('[AuthContext] Detected previous sign-in attempt, checking for redirect result');
        setIsSigningIn(true); // Set signing in state while we check
        
        // Check if the sign-in attempt is too old (more than 5 minutes)
        if (signInTimestamp) {
          const timeDiff = Date.now() - parseInt(signInTimestamp);
          if (timeDiff > 5 * 60 * 1000) { // 5 minutes
            console.log('[AuthContext] Sign-in attempt is too old, clearing state');
            localStorage.removeItem('hsaShield_signingIn');
            localStorage.removeItem('hsaShield_signInTimestamp');
            setIsSigningIn(false);
            return;
          }
        }
      }
      
      try {
        // Add a small delay to ensure Firebase Auth is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await getRedirectResult(auth);
        
        if (result) {
          // User successfully signed in via redirect
          console.log("[AuthContext] Sign-in via redirect successful:", {
            user: {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              emailVerified: result.user.emailVerified
            },
            operationType: result.operationType,
            timestamp: new Date().toISOString()
          });
          
          // Clear localStorage on successful sign-in
          if (typeof window !== 'undefined') {
            localStorage.removeItem('hsaShield_signingIn');
            localStorage.removeItem('hsaShield_signInTimestamp');
          }
          
          setIsSigningIn(false);
          
          // Show success message for mobile users
          toast({
            title: "Welcome!",
            description: "You have been successfully signed in.",
            duration: 3000,
          });
        } else {
          console.log('[AuthContext] No redirect result found');
          
          if (wasSigningIn) {
            console.log('[AuthContext] Expected redirect result but none found, clearing state');
            if (typeof window !== 'undefined') {
              localStorage.removeItem('hsaShield_signingIn');
              localStorage.removeItem('hsaShield_signInTimestamp');
            }
            setIsSigningIn(false);
          }
        }
      } catch (error: any) {
        console.error("[AuthContext] Error handling redirect result:", {
          code: error.code,
          message: error.message,
          stack: error.stack,
          customData: error.customData,
          timestamp: new Date().toISOString(),
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
          url: typeof window !== 'undefined' ? window.location.href : 'unknown'
        });
        
        // Clear localStorage on error
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hsaShield_signingIn');
          localStorage.removeItem('hsaShield_signInTimestamp');
        }
        
        setIsSigningIn(false);
        
        // Handle redirect-specific errors
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          console.log('[AuthContext] Redirect cancelled by user');
          toast({
            variant: 'destructive',
            title: "Sign-In Interrupted",
            description: "The sign-in process was cancelled. Please try again.",
            duration: 7000,
          });
        } else {
          console.log('[AuthContext] Unexpected redirect error, showing generic error message');
          toast({
            variant: 'destructive',
            title: "Sign-In Failed",
            description: "An error occurred during sign-in. Please try again.",
            duration: 7000,
          });
        }
      }
    };

    // Only run if we're on the client side and haven't checked yet
    if (typeof window !== 'undefined' && !redirectResultChecked.current) {
      handleRedirectResult();
    }
  }, []);

  const signInWithGoogle = async () => {
    console.log('[AuthContext] signInWithGoogle called');
    
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

    // Check if user is already authenticated
    if (currentUser) {
      console.log("[AuthContext] User already authenticated, skipping sign-in");
      return;
    }

    console.log('[AuthContext] Starting sign-in process');
    setIsSigningIn(true);

    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    console.log('[AuthContext] Google Auth Provider configured with scopes:', ['profile', 'email']);

    const isMobile = isMobileDevice();
    console.log(`[AuthContext] Device type determined: ${isMobile ? 'Mobile' : 'Desktop'}`);

    // Log browser capabilities for mobile debugging
    if (typeof window !== 'undefined') {
      console.log('[AuthContext] Browser capabilities:', {
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        language: navigator.language,
        languages: navigator.languages,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory || 'unknown',
        connection: (navigator as any).connection ? {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt
        } : 'unknown',
        storage: {
          localStorage: !!window.localStorage,
          sessionStorage: !!window.sessionStorage,
          indexedDB: !!window.indexedDB
        },
        location: {
          protocol: window.location.protocol,
          host: window.location.host,
          pathname: window.location.pathname
        }
      });
    }

    // For mobile devices, use redirect method directly as it's more reliable
    if (isMobile) {
      try {
        console.log("[AuthContext] Using signInWithRedirect for mobile device");
        console.log('[AuthContext] About to call signInWithRedirect...');
        
        // Store sign-in state in localStorage to persist across redirects
        if (typeof window !== 'undefined') {
          localStorage.setItem('hsaShield_signingIn', 'true');
          localStorage.setItem('hsaShield_signInTimestamp', Date.now().toString());
        }
        
        await signInWithRedirect(auth, provider);
        
        console.log('[AuthContext] signInWithRedirect call completed, redirect should be happening...');
        // The redirect will happen, and the result will be handled in the useEffect
        return;
      } catch (error: any) {
        console.error("[AuthContext] Error during signInWithRedirect:", {
          code: error.code,
          message: error.message,
          stack: error.stack,
          customData: error.customData,
          timestamp: new Date().toISOString(),
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
        });
        
        // Clear localStorage on error
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hsaShield_signingIn');
          localStorage.removeItem('hsaShield_signInTimestamp');
        }
        
        setIsSigningIn(false);
        
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
      console.log('[AuthContext] About to call signInWithPopup...');
      
      const result = await signInWithPopup(auth, provider);
      
      console.log("[AuthContext] Sign-in with popup successful:", {
        user: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          emailVerified: result.user.emailVerified
        },
        operationType: result.operationType,
        timestamp: new Date().toISOString()
      });
      
      setIsSigningIn(false);
      // Successful sign-in will be handled by onAuthStateChanged
    } catch (error: any) {
      console.error("[AuthContext] Error during signInWithPopup:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
        customData: error.customData,
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
      });
      
      // If popup fails due to being closed by user or other popup-related issues, 
      // fall back to redirect method
      if (error.code === 'auth/popup-closed-by-user' || 
          error.code === 'auth/cancelled-popup-request' ||
          error.code === 'auth/popup-blocked') {
        
        console.log("[AuthContext] Popup failed, falling back to redirect method. Error details:", {
          code: error.code,
          reason: 'popup_blocked_or_closed'
        });
        
        toast({
          title: "Switching Sign-In Method",
          description: "Popup was blocked or closed. Redirecting to Google sign-in page...",
          duration: 3000,
        });

        try {
          console.log('[AuthContext] Attempting fallback signInWithRedirect...');
          await signInWithRedirect(auth, provider);
          console.log('[AuthContext] Fallback signInWithRedirect call completed, redirect should be happening...');
          // The redirect will happen, and the result will be handled in the useEffect
          return;
        } catch (redirectError: any) {
          console.error("[AuthContext] Error during fallback signInWithRedirect:", {
            code: redirectError.code,
            message: redirectError.message,
            stack: redirectError.stack,
            customData: redirectError.customData,
            timestamp: new Date().toISOString(),
            originalError: error.code
          });
          
          setIsSigningIn(false);
          
          toast({
            variant: 'destructive',
            title: "Sign-In Failed",
            description: "Unable to complete sign-in. Please try again or contact support if the issue persists.",
            duration: 10000,
          });
        }
      } else if (error.code === 'auth/unauthorized-domain') {
        console.log('[AuthContext] Unauthorized domain error - configuration issue');
        setIsSigningIn(false);
        toast({
          variant: 'destructive',
          title: "Sign-In Configuration Issue",
          description: "There seems to be a configuration problem with sign-in. Please contact support if this issue persists.",
          duration: 10000,
        });
      } else {
        console.log('[AuthContext] Unexpected error during popup sign-in:', error.code);
        setIsSigningIn(false);
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
    console.log('[AuthContext] signOutUser called');
    
    try {
      console.log('[AuthContext] Attempting to sign out user');
      await signOut(auth);
      console.log('[AuthContext] Sign out successful');
      
      // Navigation to home or login page can be handled by the layout/page components
      // observing the currentUser state change.
      // router.push('/'); 
    } catch (error: any) {
      console.error("[AuthContext] Error signing out:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
      });
      
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
