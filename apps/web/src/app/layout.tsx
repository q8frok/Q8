'use client';

import './globals.css';
import { SessionManager } from '@/components/auth/SessionManager';
import { SyncStatus } from '@/components/shared/SyncStatus';
import { OfflineIndicator } from '@/components/shared/OfflineIndicator';
import { PWAInitializer } from '@/components/pwa/PWAInitializer';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
      </head>
      <body className="antialiased">
        <PWAInitializer />
        <SessionManager>
          {children}
          <SyncStatus />
          <OfflineIndicator />
        </SessionManager>
      </body>
    </html>
  );
}
