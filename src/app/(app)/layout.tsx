
"use client";

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
import { cn } from '@/lib/utils';
import { mainNav, siteConfig } from '@/config/site';
import { AppLogo } from '@/components/AppLogo';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, LogOut } from 'lucide-react'; // Added LogIn
import { useAuth } from '@/contexts/AuthContext'; // Added
import { Skeleton } from '@/components/ui/skeleton'; // Added

function UserNav() {
  const { currentUser, loading, signInWithGoogle, signOutUser } = useAuth(); // Added
  const router = useRouter(); // Added

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Button onClick={signInWithGoogle} variant="outline">
        <LogIn className="mr-2 h-4 w-4" />
        Sign in with Google
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage 
              src={currentUser.photoURL || `https://placehold.co/40x40.png?text=${currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0) || 'U'}`} 
              alt={currentUser.displayName || "User Avatar"} 
              data-ai-hint="user avatar" 
            />
            <AvatarFallback>{currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{currentUser.displayName || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOutUser}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


function MainSidebarContent() {
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === 'collapsed';
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
       <>
        <SidebarHeader className={cn("p-4", isCollapsed && "p-2")}>
         <AppLogo collapsed={isCollapsed} />
        </SidebarHeader>
        <ScrollArea className="flex-grow">
          <SidebarContent>
            <SidebarMenu>
              {[...Array(3)].map((_, i) => (
                <SidebarMenuItem key={i}>
                  <div className={cn("flex items-center p-2 gap-2", isCollapsed ? "justify-center" : "justify-start")}>
                    <Skeleton className="h-5 w-5" />
                    {!isCollapsed && <Skeleton className="h-5 w-24" />}
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </ScrollArea>
      </>
    )
  }
  
  // If not logged in, you might want to show a different sidebar or hide it
  // For now, it will show, but links might not work as expected or lead to login prompts (future enhancement)
  // if (!currentUser && !loading) return null; // Or some placeholder

  return (
    <>
      <SidebarHeader className={cn("p-4", isCollapsed && "p-2")}>
        <AppLogo collapsed={isCollapsed} />
      </SidebarHeader>
      <ScrollArea className="flex-grow">
        <SidebarContent>
          <SidebarMenu>
            {mainNav.map((item) => (
              <SidebarMenuItem key={item.href} className={!currentUser && !loading ? 'opacity-50 pointer-events-none' : ''}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                    tooltip={isCollapsed ? item.title : undefined}
                    className="justify-start"
                    disabled={!currentUser && !loading && item.href !== '/'} // Disable if not logged in, adjust as needed
                  >
                    <item.icon className="h-5 w-5" />
                    {!isCollapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </ScrollArea>
      <SidebarFooter className={cn("p-4 mt-auto border-t border-sidebar-border", isCollapsed && "p-2")}>
        {!isCollapsed && <p className="text-xs text-sidebar-foreground/70">&copy; {new Date().getFullYear()} {siteConfig.name}</p>}
      </SidebarFooter>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !currentUser && pathname !== '/') { // Assuming '/' is a public page or redirects to login
      // If there's no dedicated login page, signing in will happen via UserNav
      // This check is more for if you had protected routes that shouldn't be accessible at all without login
      // router.push('/'); // Or a dedicated login page e.g. /login
    }
  }, [loading, currentUser, router, pathname]);

  if (loading) {
     return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" /> 
      </div>
    );
  }
  
  // Basic protection: if not loading and no user, and not on a public page, redirect or show minimal layout
  // For now, we allow access, and UserNav handles sign-in prompt
  // A more robust solution would involve route guarding.

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen">
        {currentUser && ( // Only show sidebar if user is logged in
          <Sidebar collapsible="icon" className="border-r border-sidebar-border">
            <MainSidebarContent />
          </Sidebar>
        )}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-6">
            <div className="flex items-center gap-2">
               {currentUser && <SidebarTrigger className="md:hidden" />} {/* Hamburger for mobile only if logged in */}
               <h1 className="text-xl font-semibold tracking-tight">
                {/* This could be dynamic based on page */}
               </h1>
            </div>
            <UserNav />
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            {currentUser ? children : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <AppLogo />
                <p className="mt-4 text-lg text-muted-foreground">Please sign in to continue.</p>
                {/* The UserNav in the header already provides the sign-in button */}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Helper for loading spinner, assuming Loader2 is available
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
    className={cn("animate-spin", className)}
    {...props}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
