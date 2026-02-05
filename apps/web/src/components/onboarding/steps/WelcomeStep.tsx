'use client';

import { motion } from 'framer-motion';
import { Sparkles, Zap, Shield, Brain } from 'lucide-react';
import type { StepProps } from '../OnboardingWizard';

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Assistant',
    description: 'Multiple specialized AI agents working together',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Local-first architecture for instant responses',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Your data stays on your device by default',
  },
];

export function WelcomeStep({ userName }: StepProps) {
  const greeting = userName ? `Welcome, ${userName}!` : 'Welcome to Q8!';

  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-neon-primary to-purple-600 flex items-center justify-center mb-8"
      >
        <Sparkles className="h-12 w-12 text-white" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold mb-4"
      >
        {greeting}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-lg text-text-muted mb-8"
      >
        Your personal AI assistant is ready to help you stay organized, productive, and connected.
      </motion.p>

      <div className="grid gap-4 w-full">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="flex items-center gap-4 p-4 rounded-xl bg-surface-2 border border-border-subtle text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-neon-primary/20 flex items-center justify-center flex-shrink-0">
              <feature.icon className="h-5 w-5 text-neon-primary" />
            </div>
            <div>
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-sm text-text-muted">{feature.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
