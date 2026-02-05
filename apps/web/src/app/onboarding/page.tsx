'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/components/onboarding';
import { useAuth } from '@/hooks/useAuth';

const ONBOARDING_COMPLETE_KEY = 'q8_onboarding_complete';

export default function OnboardingPage() {
  const router = useRouter();
  const { userId, fullName, isLoading } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check if onboarding was already completed
    const completed = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (completed === 'true') {
      router.replace('/');
      return;
    }
    setShouldShow(true);
  }, [router]);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    router.push('/');
  };

  const handleSkipAll = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    router.push('/');
  };

  // Show loading or redirect if auth is loading
  if (isLoading || !shouldShow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!userId) {
    router.replace('/login');
    return null;
  }

  return (
    <OnboardingWizard
      userName={fullName || undefined}
      onComplete={handleComplete}
      onSkipAll={handleSkipAll}
    />
  );
}
