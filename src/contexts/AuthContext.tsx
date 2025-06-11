
"use client";

import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  type User 
} from 'firebase/auth';
import { auth, app as firebaseApp } from '@/lib/firebase';
import { toast } from "@/hooks/use-toast";

// Helper function to determine if it's a mobile device (can still be used for logging or other UI hints if needed)
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.screen.width <= 768;
};

const getDeviceDetails = (): Record<string, any> => {
  if (typeof window === 'undefined') return { userAgent: "SSR" };
  const { navigator, screen, visualViewport } = window;
  return {
    userAgent: navigator.userAgent,
    isMobileUA: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    isSmallScreen: screen.width <= 768,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: visualViewport?.width,
    viewportHeight: visualViewport?.height,
    devicePixelRatio: window.devicePixelRatio,
    platform: navigator.platform,
    vendor: navigator.vendor,
    maxTouchPoints: navigator.maxTouchPoints,
  };
};

const getBrowserCapabilities = (): Record<string, any> => {
  if (typeof window === 'undefined') return { environment: "SSR" };
  const { navigator, localStorage, sessionStorage, document, indexedDB } = window;
  let connectionDetails = {};
  if ('connection' in navigator) {
    const conn = navigator.connection as any;
    connectionDetails = {
      effectiveType: conn?.effectiveType,
      rtt: conn?.rtt,
      downlink: conn?.downlink,
      saveData: conn?.saveData,
    };
  }
  return {
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    language: navigator.language,
    languages: navigator.languages,
    doNotTrack: navigator.doNotTrack,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    storage: {
      localStorage: !!localStorage,
      sessionStorage: !!sessionStorage,
      indexedDB: !!indexedDB,
    },
    location: {
      protocol: document.location.protocol,
      host: document.location.host,
      pathname: document.location.pathname,
    },
    connection: connectionDetails,
  };
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
  const [isSigningIn, setIsSigningIn] = useState(false); // Simplified: no pending redirect state
  
  useEffect(() => {
    console.log('[AuthContext] AuthProvider initialized', { timestamp: new Date().toISOString(), isClient: typeof window !== 'undefined' });
    console.log('[AuthContext] Firebase App Name:', firebaseApp.name, 'Auth Domain:', auth.config.authDomain);
    console.log('[AuthContext] Device Details:', getDeviceDetails());
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
      if (user) {
        setIsSigningIn(false); 
        console.log('[AuthContext] User authenticated, isSigningIn set to false.');
      } else {
        console.log('[AuthContext] User signed out or not authenticated.');
      }
    });
    
    return () => { 
      console.log('[AuthContext] Cleaning up Firebase onAuthStateChanged listener.');
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    console.log("[AuthContext] signInWithGoogle (popup) initiated.");
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance is not available for sign-in.");
      toast({ variant: 'destructive', title: "Sign-In Error", description: "Authentication service unavailable. Please refresh." });
      return;
    }
    if (currentUser) {
      console.log("[AuthContext] User already signed in. Aborting new sign-in.");
      return; 
    }
    if (isSigningIn) {
      console.log("[AuthContext] Sign-in already in progress. Aborting new sign-in.");
      toast({ title: "Sign-In In Progress", description: "Please wait..."});
      return;
    }

    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });

    console.log("[AuthContext] Browser Capabilities at sign-in attempt:", getBrowserCapabilities());
      
    try {
      console.log("[AuthContext] Attempting signInWithPopup...");
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle setCurrentUser and setting isSigningIn to false.
      toast({ title: "Sign-In Successful!", description: "Welcome!" });
    } catch (error: any) {
      console.error("[AuthContext] signInWithPopup error:", {code: error.code, message: error.message});
      setIsSigningIn(false); // Crucial: reset on error
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        toast({ 
          variant: 'destructive', 
          title: "Sign-In Cancelled", 
          description: "The sign-in window was closed. If this was not intentional, please ensure popups are allowed and try again." 
        });
      } else if (error.code === 'auth/popup-blocked') {
        toast({ 
          variant: 'destructive', 
          title: "Popup Blocked", 
          description: "Your browser blocked the sign-in popup. Please allow popups for this site and try again." 
        });
      } else if (error.code === 'auth/unauthorized-domain') {
         toast({ 
           variant: 'destructive', 
           title: "Sign-In Error", 
           description: "This website is not authorized for sign-in with Google. Please contact support if this issue persists."
         });
      } else {
        toast({ 
          variant: 'destructive', 
          title: "Sign-In Failed", 
          description: "An unexpected error occurred. Please try again. If the problem continues, check your internet connection and browser settings." 
        });
      }
    }
  };

  const signOutUser = async () => {
    console.log("[AuthContext] signOutUser initiated.");
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      // onAuthStateChanged will set currentUser to null and isSigningIn to false.
    } catch (error: any) {
      console.error("[AuthContext] Sign out error:", {code: error.code, message: error.message});
      toast({ variant: 'destructive', title: "Sign-Out Error", description: "Could not sign you out. Please try again." });
    }
  };

  const value = { currentUser, loading, signInWithGoogle, signOutUser, isSigningIn };

  if (typeof window !== 'undefined') {
    (window as any).hsaAuthContextDebug = value; 
    (window as any).hsaAuthInstanceDebug = auth;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
