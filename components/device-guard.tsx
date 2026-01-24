'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const WIDTH_THRESHOLD = 768;

export default function DeviceGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/unsupported-device') return;

    const isSmall = () => {
      if (typeof window === 'undefined') return false;
      return (
        window.innerWidth < WIDTH_THRESHOLD ||
        window.matchMedia?.(`(max-width: ${WIDTH_THRESHOLD - 1}px)`).matches
      );
    };

    const check = () => {
      if (isSmall()) router.replace('/unsupported-device');
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [pathname, router]);

  return null;
}
