'use client';

import './globals.css';
import { SessionManager } from '@/components/auth/SessionManager';
import { SyncStatus } from '@/components/shared/SyncStatus';
import { OfflineIndicator } from '@/components/shared/OfflineIndicator';
import { PWAInitializer } from '@/components/pwa/PWAInitializer';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { inter } from '@/lib/fonts';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <title>Q8 - The Omni-Model Personal Assistant</title>
        <meta name="description" content="Local-First Multi-Agent AI Dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#8B5CF6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Q8" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* iPhone 17 Pro Max splash screen (1320x2868 @3x) */}
        <link
          rel="apple-touch-startup-image"
          media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash/iphone-17-promax.png"
        />
        {/* iPhone 16 Pro Max splash screen (1290x2796 @3x) */}
        <link
          rel="apple-touch-startup-image"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash/iphone-16-promax.png"
        />
      </head>
      <body className="antialiased">
        <PWAInitializer />
        <ErrorBoundary>
          <SessionManager>
            {children}
            <SyncStatus />
            <OfflineIndicator />
          </SessionManager>
        </ErrorBoundary>
      </body>
    </html>
  );
}
