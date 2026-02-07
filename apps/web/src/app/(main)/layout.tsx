'use client';

import { AnimatedBackground } from '@/components/shared/AnimatedBackground';
import { PageTransition } from '@/components/navigation/PageTransition';
import { SwipeBackProvider } from '@/components/navigation/SwipeBackProvider';
import { Sidebar } from '@/components/navigation/Sidebar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AnimatedBackground />
      <Sidebar />
      <div className="relative z-10 min-h-screen pb-[calc(49px+env(safe-area-inset-bottom,0px))] lg:pb-0 xl:pl-14">
        <SwipeBackProvider>
          <PageTransition>
            {children}
          </PageTransition>
        </SwipeBackProvider>
      </div>
    </>
  );
}
