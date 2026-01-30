'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, LogOut } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { LanguageSwitcher } from '@/components/language-switcher';
import { signOut } from '@/app/(login)/actions';

type HeaderUser = {
  id: number;
  email: string;
  name: string | null;
} | null;

function UserMenu({ user }: { user: HeaderUser }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  if (!user) {
    return (
      <Button asChild>
        <Link href="/sign-up">Sign Up</Link>
      </Button>
    );
  }

  const initials = user.email
    .split(' ')
    .map((n) => n[0])
    .join('');

  return (
    <DropdownMenu
      open={isMenuOpen}
      onOpenChange={setIsMenuOpen}
      trigger={
        <Avatar
          className="cursor-pointer size-9"
          alt={user.name || ''}
          fallback={initials}
        />
      }
      contentProps={{ align: 'end', className: 'flex flex-col gap-1' }}
      items={[
        {
          type: 'item',
          asChild: true,
          className: 'cursor-pointer',
          label: (
            <Link href="/dashboard" className="flex w-full items-center">
              <Home className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          )
        },
        {
          type: 'item',
          className: 'cursor-pointer',
          onSelect: () => void handleSignOut(),
          label: (
            <>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </>
          )
        }
      ]}
    />
  );
}

export default function DashboardHeader({ user }: { user: HeaderUser }) {
  return (
    <header className="h-[68px] border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full w-full max-w-[1400px] items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold text-foreground">Contexa</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
