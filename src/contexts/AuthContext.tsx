
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
import { auth, app as firebaseApp } from '@/lib/firebase'; // Import firebaseApp
import { toast } from "@/hooks/use-toast";

// Helper function to determine if it's a mobile device
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
  const [isSigningIn, setIsSigningIn] = useState(() => {
    if (typeof window !== 'undefined') {
      const wasSigningIn = localStorage.getItem('hsaShield_signingIn') === 'true';
      const signInTimestamp = localStorage.getItem('hsaShield_signInTimestamp');
      if (wasSigningIn && signInTimestamp && (Date.now() - parseInt(signInTimestamp) < 10 * 60 * 1000)) { // 10 min timeout
        return true;
      }
      localStorage.removeItem('hsaShield_signingIn');
      localStorage.removeItem('hsaShield_signInTimestamp');
    }
    return false;
  });
  
  const redirectResultChecked = useRef(false);
  const authStateListenerSetup = useRef(false);

  useEffect(() => {
    console.log('[AuthContext] AuthProvider instance created/updated.', { timestamp: new Date().toISOString(), isClient: typeof window !== 'undefined' });
    console.log('[AuthContext] Firebase App Name:', firebaseApp.name);
    console.log('[AuthContext] Firebase Auth Domain:', auth.config.authDomain);
    const deviceDetails = getDeviceDetails();
    console.log('[AuthContext] Device Detection Details:', deviceDetails);
  }, []);

  useEffect(() => {
    if (authStateListenerSetup.current) {
      console.log('[AuthContext] Auth state listener already setup, skipping.');
      return;
    }
    authStateListenerSetup.current = true;
    console.log('[AuthContext] Setting up Firebase onAuthStateChanged listener.');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const authStateLog = {
        hasUser: !!user,
        userId: user?.uid || null,
        email: user?.email || null,
        displayName: user?.displayName || null,
        emailVerified: user?.emailVerified || null,
        isAnonymous: user?.isAnonymous || null,
        providerData: user?.providerData?.map(p => ({ providerId: p.providerId, uid: p.uid, email: p.email })) || [],
        timestamp: new Date().toISOString(),
      };
      console.log('[AuthContext] Firebase onAuthStateChanged event. User data:', authStateLog);

      setCurrentUser(user);
      setLoading(false);
      if (user) {
        setIsSigningIn(false); 
        localStorage.removeItem('hsaShield_signingIn');
        localStorage.removeItem('hsaShield_signInTimestamp');
        console.log('[AuthContext] User authenticated, cleared signingIn flags.');
      } else {
        console.log('[AuthContext] User signed out or not authenticated.');
      }
    });
    
    return () => { 
      console.log('[AuthContext] Cleaning up Firebase onAuthStateChanged listener.');
      authStateListenerSetup.current = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleRedirectResult = async () => {
      if (redirectResultChecked.current) {
        console.log('[AuthContext] Redirect result already checked this session, skipping.');
        return;
      }
      redirectResultChecked.current = true; // Mark as checked early to prevent re-runs from HMR etc.
      
      const wasSigningInFlag = localStorage.getItem('hsaShield_signingIn') === 'true';
      const signInTimestamp = localStorage.getItem('hsaShield_signInTimestamp');
      console.log('[AuthContext] handleRedirectResult called.', { wasSigningInFlag, signInTimestamp, readyState: document.readyState });
      console.log('[AuthContext] Browser Capabilities at redirect check:', getBrowserCapabilities());


      if (wasSigningInFlag) {
        console.log('[AuthContext] Detected previous redirect sign-in attempt.');
        if (signInTimestamp && (Date.now() - parseInt(signInTimestamp) > 10 * 60 * 1000)) { // 10 min timeout
          console.warn('[AuthContext] Sign-in attempt timed out. Clearing flags.');
          localStorage.removeItem('hsaShield_signingIn');
          localStorage.removeItem('hsaShield_signInTimestamp');
          setIsSigningIn(false);
          return;
        }
        // No need to setIsSigningIn(true) here as it's set by initial state or signInWithRedirect call
      } else {
        console.log('[AuthContext] No pending sign-in redirect detected based on localStorage flags.');
        // If not expecting a sign-in, ensure isSigningIn is false.
        // This can happen if the page is reloaded after a failed attempt or timeout.
        setIsSigningIn(false); 
        localStorage.removeItem('hsaShield_signingIn');
        localStorage.removeItem('hsaShield_signInTimestamp');
        return;
      }
      
      try {
        console.log('[AuthContext] Waiting 500ms before calling getRedirectResult...');
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[AuthContext] Attempting getRedirectResult...');
        const result = await getRedirectResult(auth);
        console.log('[AuthContext] getRedirectResult call completed. Raw Result:', result);

        if (result && result.user) {
          console.log("[AuthContext] Sign-in via redirect successful. User from result:", result.user.uid);
          // onAuthStateChanged will handle setCurrentUser and clearing flags.
        } else {
          console.warn('[AuthContext] No redirect result or no user in result.');
          // Only show error if we were genuinely expecting a result from an active sign-in attempt
          // and onAuthStateChanged hasn't already set a user.
          if (wasSigningInFlag && !auth.currentUser) { 
             toast({
              variant: 'destructive',
              title: "Sign-In Incomplete",
              description: "We couldn't finalize your sign-in. Please try signing in again. Ensure cookies and site data are allowed for this website.",
              duration: 9000,
            });
          }
        }
      } catch (error: any) {
        console.error("[AuthContext] Error during getRedirectResult or post-processing:", { code: error.code, message: error.message, stack: error.stack });
        if (wasSigningInFlag && !auth.currentUser) {
            toast({
              variant: 'destructive',
              title: "Sign-In Error",
              description: "An unexpected error occurred while finalizing your sign-in. Please try again.",
              duration: 9000,
            });
        }
      } finally {
        // Clear flags regardless of outcome, as the attempt has been processed.
        // onAuthStateChanged will be the source of truth for user state.
        console.log('[AuthContext] Clearing localStorage signingIn flags after redirect attempt.');
        localStorage.removeItem('hsaShield_signingIn');
        localStorage.removeItem('hsaShield_signInTimestamp');
        // Let onAuthStateChanged handle setIsSigningIn(false) if a user is successfully set.
        // If no user comes through onAuthStateChanged, and we were signing in,
        // we should ensure isSigningIn becomes false to allow another attempt.
        if (wasSigningInFlag && !auth.currentUser) {
            console.log("[AuthContext] No user from redirect and no current user, explicitly setting isSigningIn to false.");
            setIsSigningIn(false);
        }
      }
    };

    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') {
          handleRedirectResult();
      } else {
          window.addEventListener('load', handleRedirectResult, { once: true });
          return () => window.removeEventListener('load', handleRedirectResult);
      }
    }
  }, []); 

  const signInWithGoogle = async () => {
    console.log("[AuthContext] signInWithGoogle function CALLED.");
    if (!auth) {
      console.error("[AuthContext] Firebase auth instance is not available.");
      toast({ variant: 'destructive', title: "Service Error", description: "Authentication service is not properly initialized. Please refresh and try again." });
      return;
    }
    if (currentUser) {
      console.log("[AuthContext] User already signed in. Aborting new sign-in.");
      return; 
    }
    if (isSigningIn) {
      console.log("[AuthContext] Sign-in already in progress. Aborting new sign-in.");
      toast({ title: "Sign-In In Progress", description: "Please wait, sign-in is already underway."});
      return;
    }

    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });

    const mobile = isMobileDevice();
    console.log(`[AuthContext] Attempting to sign in with Google. Mobile device detected: ${mobile}`);
    console.log("[AuthContext] Browser Capabilities at sign-in attempt:", getBrowserCapabilities());

    if (mobile) {
      try {
        console.log("[AuthContext] Using signInWithRedirect for mobile device.");
        localStorage.setItem('hsaShield_signingIn', 'true');
        localStorage.setItem('hsaShield_signInTimestamp', Date.now().toString());
        await signInWithRedirect(auth, provider);
      } catch (error: any) {
        console.error("[AuthContext] signInWithRedirect error:", {code: error.code, message: error.message});
        localStorage.removeItem('hsaShield_signingIn');
        localStorage.removeItem('hsaShield_signInTimestamp');
        setIsSigningIn(false);
        toast({ variant: 'destructive', title: "Sign-In Failed", description: "Could not start the sign-in process. Please check your connection and try again." });
      }
    } else { 
      try {
        console.log("[AuthContext] Using signInWithPopup for desktop.");
        await signInWithPopup(auth, provider);
        toast({ title: "Sign-In Successful!", description: "Welcome!" });
      } catch (error: any) {
        console.error("[AuthContext] signInWithPopup error:", {code: error.code, message: error.message});
        setIsSigningIn(false);
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          toast({ title: "Sign-In Cancelled", description: "You may have closed the sign-in window. If not, please check your browser settings for popups and third-party cookies." });
        } else if (error.code === 'auth/popup-blocked') {
          toast({ variant: 'destructive', title: "Popup Blocked", description: "Please allow popups for this site to sign in with Google." });
        } else if (error.code === 'auth/unauthorized-domain') {
           toast({ variant: 'destructive', title: "Website Not Authorized", description: "This website is not authorized for Google Sign-In. Please contact support."});
        } else {
          toast({ variant: 'destructive', title: "Sign-In Failed", description: "An unknown error occurred during sign-in. Please try again." });
        }
      }
    }
  };

  const signOutUser = async () => {
    console.log("[AuthContext] signOutUser function CALLED.");
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
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
