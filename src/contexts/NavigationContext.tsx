"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface NavigationContextType {
  isNavigating: boolean;
  setIsNavigating: (loading: boolean) => void;
  navigateWithLoading: (href: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Reset navigation state when pathname changes
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const navigateWithLoading = (href: string) => {
    if (href === pathname) return; // Don't navigate to the same page
    
    setIsNavigating(true);
    router.push(href);
    
    // Fallback timeout to reset loading state in case navigation fails
    setTimeout(() => {
      setIsNavigating(false);
    }, 10000);
  };

  return (
    <NavigationContext.Provider value={{ isNavigating, setIsNavigating, navigateWithLoading }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};