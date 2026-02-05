'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WelcomeStep } from './steps/WelcomeStep';
import { IntegrationsStep } from './steps/IntegrationsStep';
import { VoiceSetupStep } from './steps/VoiceSetupStep';
import { GridCustomizeStep } from './steps/GridCustomizeStep';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<StepProps>;
  skippable: boolean;
}

export interface StepProps {
  onNext: () => void;
  onSkip: () => void;
  userName?: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Get started with Q8',
    component: WelcomeStep,
    skippable: false,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect your services',
    component: IntegrationsStep,
    skippable: true,
  },
  {
    id: 'voice',
    title: 'Voice Setup',
    description: 'Test voice interaction',
    component: VoiceSetupStep,
    skippable: true,
  },
  {
    id: 'grid',
    title: 'Customize',
    description: 'Choose your layout',
    component: GridCustomizeStep,
    skippable: true,
  },
];

interface OnboardingWizardProps {
  userName?: string;
  onComplete: () => void;
  onSkipAll?: () => void;
}

export function OnboardingWizard({ userName, onComplete, onSkipAll }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const step = STEPS[currentStep]!;
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    setCompletedSteps(prev => new Set([...prev, step.id]));
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [step.id, isLastStep, onComplete]);

  const handleSkip = useCallback(() => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, onComplete]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  const StepComponent = step.component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-neon-primary/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-neon-primary" />
          </div>
          <span className="text-lg font-semibold">Q8 Setup</span>
        </div>
        {onSkipAll && (
          <Button variant="ghost" size="sm" onClick={onSkipAll} className="text-text-muted">
            <X className="h-4 w-4 mr-1" />
            Skip Setup
          </Button>
        )}
      </header>

      {/* Progress */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  i < currentStep || completedSteps.has(s.id)
                    ? 'bg-neon-primary text-white'
                    : i === currentStep
                    ? 'bg-neon-primary/20 text-neon-primary border-2 border-neon-primary'
                    : 'bg-surface-3 text-text-muted'
                )}
              >
                {completedSteps.has(s.id) ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2',
                    i < currentStep ? 'bg-neon-primary' : 'bg-surface-3'
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'text-xs',
                i === currentStep ? 'text-text-primary' : 'text-text-muted'
              )}
              style={{ width: `${100 / STEPS.length}%`, textAlign: i === 0 ? 'left' : i === STEPS.length - 1 ? 'right' : 'center' }}
            >
              {s.title}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 flex flex-col px-6 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1">{step.title}</h1>
              <p className="text-text-muted">{step.description}</p>
            </div>
            <div className="flex-1">
              <StepComponent onNext={handleNext} onSkip={handleSkip} userName={userName} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <footer className="p-6 border-t border-white/10 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={isFirstStep}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          {step.skippable && (
            <Button variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
          )}
          <Button onClick={handleNext} className="gap-1 bg-neon-primary hover:bg-neon-primary/90">
            {isLastStep ? 'Finish' : 'Continue'}
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </footer>
    </div>
  );
}
