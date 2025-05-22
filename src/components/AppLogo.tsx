import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { siteConfig } from '@/config/site';

export function AppLogo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-primary hover:text-primary/90 transition-colors duration-200">
      <ShieldCheck className="h-7 w-7" />
      {!collapsed && <span className="whitespace-nowrap">{siteConfig.name}</span>}
    </Link>
  );
}
