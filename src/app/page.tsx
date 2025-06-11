
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react'; // Re-using existing Loader2

export default function RootPage() {
  const { currentUser, loading, signUpWithEmailPassword, signInWithEmailPassword, isSigningIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // To toggle between Sign In and Sign Up form

  useEffect(() => {
    if (!loading && currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, loading, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSigningIn) return;

    let success = false;
    if (isSignUp) {
      success = await signUpWithEmailPassword(email, password);
    } else {
      success = await signInWithEmailPassword(email, password);
    }
    // If successful, useEffect will redirect. If not, toast is shown by AuthContext.
  };

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <AppLogo />
        <Card className="w-full max-w-sm mt-8">
          <CardHeader>
            <CardTitle className="text-2xl">{isSignUp ? 'Create Account' : 'Sign In'}</CardTitle>
            <CardDescription>
              {isSignUp ? 'Enter your email and password to create an account.' : 'Enter your credentials to access your account.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSigningIn}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSigningIn}
                  minLength={isSignUp ? 6 : undefined} // Enforce minLength for signup
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSigningIn}>
                {isSigningIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => setIsSignUp(!isSignUp)}
                disabled={isSigningIn}
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // This part should ideally not be reached if redirect works correctly (or currentUser exists)
  return null; 
}
