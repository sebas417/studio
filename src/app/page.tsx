
"use client"; // Make this a client component to use hooks

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

// Helper for loading spinner
const Loader2 = ({ className, ...props }: React.ComponentProps<typeof LogIn>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className} // Removed animate-spin here, apply it where used
    {...props}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);


export default function RootPage() {
  const { currentUser, loading, signInWithGoogle, isSigningIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && currentUser) {
      router.replace('/dashboard'); // Use replace to avoid back button to this page
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <AppLogo />
        <Loader2 className="h-12 w-12 animate-spin text-primary mt-8" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
        <AppLogo />
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Welcome to HSA Shield
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Track your HSA expenses with ease. Scan receipts, manage reimbursements, and stay organized.
        </p>
        <Button 
          onClick={signInWithGoogle} 
          size="lg" 
          className="mt-8" 
          disabled={isSigningIn}
        >
          {isSigningIn ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-5 w-5" />
              Sign in with Google to Get Started
            </>
          )}
        </Button>
      </div>
    );
  }

  // This part should ideally not be reached if redirect works correctly
  return null; 
}
