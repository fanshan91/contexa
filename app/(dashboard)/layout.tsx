'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Home, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut } from '@/app/(login)/actions';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/db/types';
import useSWR, { mutate } from 'swr';
import { SessionKeepAlive } from './session-keep-alive';
import { LogoMark } from '@/components/brand/logo-mark';

const fetcher = (url: string) =>
  fetch(url)
    .then((res) => res.json())
    .then((json) => (json?.ok ? json.data : null));

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  if (!user) {
    return (
      <>
        <Button asChild>
          <Link href="/sign-up">Sign Up</Link>
        </Button>
      </>
    );
  }

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger>
        <Avatar className="cursor-pointer size-9">
          <AvatarImage alt={user.name || ''} />
          <AvatarFallback>
            {user.email
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex flex-col gap-1">
        <DropdownMenuItem className="cursor-pointer">
          <Link href="/dashboard" className="flex w-full items-center">
            <Home className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <form action={handleSignOut} className="w-full">
          <button type="submit" className="flex w-full">
            <DropdownMenuItem className="w-full flex-1 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { LanguageSwitcher } from '@/components/language-switcher';

function Header() {
  return (
    <header className="h-[68px] border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full w-full max-w-[1400px] items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold text-foreground">Contexa</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Suspense fallback={<div className="h-9" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-[100dvh] flex-col overflow-hidden">
      <SessionKeepAlive />
      <Header />
      {children}
    </section>
  );
}
