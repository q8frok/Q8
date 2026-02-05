import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Setup | Q8',
  description: 'Set up your Q8 personal assistant',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
