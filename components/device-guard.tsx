'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const DEVICE_SHORT_EDGE_THRESHOLD = 768;

function isUnsupportedDevice() {
  if (typeof window === 'undefined') return false;

  const screenWidth = window.screen?.width ?? window.innerWidth;
  const screenHeight = window.screen?.height ?? window.innerHeight;
  const shortEdge = Math.min(screenWidth, screenHeight);

  const hasCoarsePointer =
    window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const hasNoHover = window.matchMedia?.('(hover: none)')?.matches ?? false;
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const isTouchDevice = hasCoarsePointer || hasNoHover || maxTouchPoints > 0;

  return isTouchDevice && shortEdge < DEVICE_SHORT_EDGE_THRESHOLD;
}

export default function DeviceGuard() {
  const t = useTranslations('unsupportedDevice');
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      if (pathname === '/unsupported-device') {
        setOpen(false);
        return;
      }
      setOpen(isUnsupportedDevice());
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
      <Card
        className="w-full max-w-md"
        headerClassName="items-center gap-3 text-center"
        header={
          <>
            <div className="flex items-center justify-center gap-2">
              <LogoMark className="h-8 w-8 text-primary" />
              <span className="text-lg font-semibold text-foreground">Contexa TMS</span>
            </div>
            <div className="text-xl leading-none font-semibold">{t('title')}</div>
          </>
        }
        contentClassName="space-y-2 text-center"
        footerClassName="justify-center"
        footer={
          <Button className="w-full" onClick={() => router.replace('/')}>
            {t('backHome')}
          </Button>
        }
      >
        <p className="text-muted-foreground">{t('description')}</p>
        <p className="text-muted-foreground">{t('hint')}</p>
      </Card>
    </div>
  );
}
