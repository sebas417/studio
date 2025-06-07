
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
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { toast } from "@/hooks/use-toast";

const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileRegex.test(userAgent);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768; // Common tablet portrait width
  return isMobileUA || (isTouchDevice && isSmallScreen);
};

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  isSigningIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
let authProviderInstance: boolean = false;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(() => {
    if (typeof window !== 'undefined') {
      const wasSigningIn = localStorage.getItem('hsaShield_signingIn') === 'true';
      const signInTimestamp = localStorage.getItem('hsaShield_signInTimestamp');
      if (wasSigningIn && signInTimestamp && (Date.now() - parseInt(signInTimestamp) < 5 * 60 * 1000)) {
        return true;
      }
      localStorage.removeItem('hsaShield_signingIn');
      localStorage.removeItem('hsaShield_signInTimestamp');
    }
    return false;
  });
  
  const isInitialized = useRef(false);
  const redirectResultChecked = useRef(false);
  const authStateListenerSetup = useRef(false);

  useEffect(() => {
    if (authProviderInstance) {
      console.warn('[AuthContext] Multiple AuthProvider instances detected.');
      return;
    }
    authProviderInstance = true;
    if (!isInitialized.current) {
      console.log('[AuthContext] AuthProvider initialized', { timestamp: new Date().toISOString(), isClient: typeof window !== 'undefined' });
      isInitialized.current = true;
    }
    return () => { authProviderInstance = false; };
  }, []); 

  useEffect(() => {
    if (authStateListenerSetup.current) return;
    authStateListenerSetup.current = true;
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[AuthContext] Auth state changed. User:', user ? user.uid : null);
      setCurrentUser(user);
      setLoading(false);
      if (user) {
        setIsSigningIn(false); 
        localStorage.removeItem('hsaShield_signingIn');
        localStorage.removeItem('hsaShield_signInTimestamp');
      }
    });
    
    return () => { 
      authStateListenerSetup.current = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleRedirectResult = async () => {
      if (redirectResultChecked.current || typeof window === 'undefined') return;
      redirectResultChecked.current = true;
      
      const wasSigningIn = localStorage.getItem('hsaShield_signingIn') === 'true';
      const signInTimestamp = localStorage.getItem('hsaShield_signInTimestamp');

      if (wasSigningIn) {
        console.log('[AuthContext] Detected previous redirect sign-in attempt.');
        if (signInTimestamp && (Date.now() - parseInt(signInTimestamp) > 10 * 60 * 1000)) { // 10 min timeout
          console.log('[AuthContext] Sign-in attempt timed out.');
          localStorage.removeItem('hsaShield_signingIn');
          localStorage.removeItem('hsaShield_signInTimestamp');
          setIsSigningIn(false);
          return;
        }
        // No need to setIsSigningIn(true) here as it's set before calling signInWithRedirect
      } else {
        // If not expecting a redirect result, no need to call getRedirectResult unless currentUser is null and still loading
        // This avoids calling getRedirectResult unnecessarily on every page load after initial sign-in.
        if (currentUser || !loading) { // If user exists or initial loading is done, no pending redirect.
             console.log('[AuthContext] No pending sign-in redirect detected or already authenticated.');
             setIsSigningIn(false); // Ensure signingIn state is false if no redirect was pending
             localStorage.removeItem('hsaShield_signingIn'); // Clean up any stale flags
             localStorage.removeItem('hsaShield_signInTimestamp');
             return;
        }
      }
      
      try {
        console.log('[AuthContext] Attempting getRedirectResult...');
        // Add small delay for Firebase to initialize if needed, especially on mobile
        await new Promise(resolve => setTimeout(resolve, 200));
        const result = await getRedirectResult(auth);
        console.log('[AuthContext] getRedirectResult call completed. Raw Result:', result);

        if (result && result.user) {
          console.log("[AuthContext] Sign-in via redirect successful. User:", result.user.uid);
          // setCurrentUser will be called by onAuthStateChanged
          // No need to toast here, onAuthStateChanged and page navigation will handle user experience.
        } else {
          console.log('[AuthContext] No redirect result or no user in result.');
          if (wasSigningIn) { // Only show error if we were expecting a result
             toast({
              variant: 'destructive',
              title: "Sign-In Incomplete",
              description: "Could not finalize sign-in. Please try again. If this persists, ensure cookies are enabled.",
              duration: 7000,
            });
          }
        }
      } catch (error: any) {
        console.error("[AuthContext] Error during getRedirectResult call:", { code: error.code, message: error.message });
        if (wasSigningIn) { // Only show error if we were expecting a result
            toast({
              variant: 'destructive',
              title: "Sign-In Error",
              description: "An error occurred while finalizing sign-in. Please try again.",
              duration: 7000,
            });
        }
      } finally {
        if (wasSigningIn) { // Always clear flags if we attempted to process a redirect
            localStorage.removeItem('hsaShield_signingIn');
            localStorage.removeItem('hsaShield_signInTimestamp');
        }
        //setIsSigningIn(false); // isSigningIn is primarily for the *initiation* of sign-in
                               // and should be definitively set to false by onAuthStateChanged or if redirect fails early
      }
    };

    if (document.readyState === 'complete') {
        handleRedirectResult();
    } else {
        window.addEventListener('load', handleRedirectResult, { once: true });
        return () => window.removeEventListener('load', handleRedirectResult);
    }

  }, [currentUser, loading]); // Added currentUser and loading as dependencies

  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance is not available.");
      toast({ variant: 'destructive', title: "Service Error", description: "Authentication service unavailable. Try again later." });
      return;
    }
    if (currentUser) return; // Already signed in
    if (isSigningIn) return; // Sign-in already in progress

    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });

    const mobile = isMobileDevice();
    console.log(`[AuthContext] Starting Google sign-in. Mobile: ${mobile}`);

    if (mobile) {
      try {
        console.log("[AuthContext] Using signInWithRedirect for mobile.");
        localStorage.setItem('hsaShield_signingIn', 'true');
        localStorage.setItem('hsaShield_signInTimestamp', Date.now().toString());
        await signInWithRedirect(auth, provider);
        // Redirect will occur, result handled by handleRedirectResult
      } catch (error: any) {
        console.error("[AuthContext] signInWithRedirect error:", error);
        localStorage.removeItem('hsaShield_signingIn');
        localStorage.removeItem('hsaShield_signInTimestamp');
        setIsSigningIn(false);
        toast({ variant: 'destructive', title: "Sign-In Failed", description: "Could not start sign-in. Please try again." });
      }
    } else { // Desktop
      try {
        console.log("[AuthContext] Using signInWithPopup for desktop.");
        await signInWithPopup(auth, provider);
        // onAuthStateChanged will handle user update and reset isSigningIn
      } catch (error: any) {
        console.error("[AuthContext] signInWithPopup error:", error);
        setIsSigningIn(false);
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          toast({ title: "Sign-In Cancelled", description: "You closed the sign-in window. Please try again if you'd like to sign in." });
        } else if (error.code === 'auth/popup-blocked') {
          toast({ variant: 'destructive', title: "Popup Blocked", description: "Please allow popups for this site to sign in, or try a different browser." });
        } else {
          toast({ variant: 'destructive', title: "Sign-In Failed", description: "An error occurred. Please try again." });
        }
      }
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged will set currentUser to null
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
    } catch (error: any) {
      console.error("[AuthContext] Sign out error:", error);
      toast({ variant: 'destructive', title: "Sign-Out Error", description: "Could not sign out. Please try again." });
    }
  };

  const value = { currentUser, loading, signInWithGoogle, signOutUser, isSigningIn };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
