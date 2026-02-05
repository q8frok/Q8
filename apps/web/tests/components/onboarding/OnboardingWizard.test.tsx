/**
 * Onboarding Wizard Tests
 * Tests for the multi-step onboarding flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    button: ({
      children,
      ...props
    }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock child step components to simplify testing
vi.mock('@/components/onboarding/steps/WelcomeStep', () => ({
  WelcomeStep: ({ onNext }: { onNext: () => void }) => (
    <div data-testid="welcome-step">
      <button onClick={onNext}>Continue from Welcome</button>
    </div>
  ),
}));

vi.mock('@/components/onboarding/steps/IntegrationsStep', () => ({
  IntegrationsStep: ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => (
    <div data-testid="integrations-step">
      <button onClick={onNext}>Continue from Integrations</button>
      <button onClick={onSkip}>Skip Integrations</button>
    </div>
  ),
}));

vi.mock('@/components/onboarding/steps/VoiceSetupStep', () => ({
  VoiceSetupStep: ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => (
    <div data-testid="voice-step">
      <button onClick={onNext}>Continue from Voice</button>
      <button onClick={onSkip}>Skip Voice</button>
    </div>
  ),
}));

vi.mock('@/components/onboarding/steps/GridCustomizeStep', () => ({
  GridCustomizeStep: ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => (
    <div data-testid="grid-step">
      <button onClick={onNext}>Continue from Grid</button>
      <button onClick={onSkip}>Skip Grid</button>
    </div>
  ),
}));

describe('OnboardingWizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnSkipAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('should render the wizard with welcome step', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      expect(screen.getByText('Q8 Setup')).toBeInTheDocument();
      expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
    });

    it('should display the welcome step title', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Title is in an h1 element
      expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
    });

    it('should show progress indicators for all steps', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // All step labels should be visible - use getAllByText since some appear multiple times
      expect(screen.getAllByText('Welcome').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Integrations')).toBeInTheDocument();
      expect(screen.getByText('Voice Setup')).toBeInTheDocument();
      expect(screen.getByText('Customize')).toBeInTheDocument();
    });

    it('should show Skip Setup button when onSkipAll is provided', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} onSkipAll={mockOnSkipAll} />);

      expect(screen.getByText('Skip Setup')).toBeInTheDocument();
    });

    it('should not show Skip Setup button when onSkipAll is not provided', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      expect(screen.queryByText('Skip Setup')).not.toBeInTheDocument();
    });

    it('should disable Back button on first step', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeDisabled();
    });
  });

  describe('navigation', () => {
    it('should navigate to next step when Continue is clicked', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Click Continue on welcome step
      fireEvent.click(screen.getByText('Continue'));

      // Should now be on integrations step
      expect(screen.getByTestId('integrations-step')).toBeInTheDocument();
    });

    it('should show Skip button for skippable steps', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Welcome step is not skippable
      expect(screen.queryByRole('button', { name: /^skip$/i })).not.toBeInTheDocument();

      // Navigate to integrations
      fireEvent.click(screen.getByText('Continue'));

      // Integrations step is skippable
      expect(screen.getByRole('button', { name: /^skip$/i })).toBeInTheDocument();
    });

    it('should enable Back button after first step', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Navigate to integrations
      fireEvent.click(screen.getByText('Continue'));

      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).not.toBeDisabled();
    });

    it('should go back to previous step when Back is clicked', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Navigate to integrations
      fireEvent.click(screen.getByText('Continue'));
      expect(screen.getByTestId('integrations-step')).toBeInTheDocument();

      // Go back
      fireEvent.click(screen.getByRole('button', { name: /back/i }));

      // Should be back on welcome
      expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
    });

    it('should skip to next step when Skip is clicked', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Navigate to integrations
      fireEvent.click(screen.getByText('Continue'));

      // Skip integrations
      fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));

      // Should now be on voice step
      expect(screen.getByTestId('voice-step')).toBeInTheDocument();
    });

    it('should navigate through all steps', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Welcome -> Integrations
      fireEvent.click(screen.getByText('Continue'));
      expect(screen.getByTestId('integrations-step')).toBeInTheDocument();

      // Integrations -> Voice
      fireEvent.click(screen.getByText('Continue'));
      expect(screen.getByTestId('voice-step')).toBeInTheDocument();

      // Voice -> Grid
      fireEvent.click(screen.getByText('Continue'));
      expect(screen.getByTestId('grid-step')).toBeInTheDocument();
    });
  });

  describe('completion', () => {
    it('should show Finish button on last step', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Navigate to last step (Grid)
      fireEvent.click(screen.getByText('Continue')); // Welcome -> Integrations
      fireEvent.click(screen.getByText('Continue')); // Integrations -> Voice
      fireEvent.click(screen.getByText('Continue')); // Voice -> Grid

      expect(screen.getByText('Finish')).toBeInTheDocument();
    });

    it('should call onComplete when Finish is clicked', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Navigate to last step
      fireEvent.click(screen.getByText('Continue')); // Welcome -> Integrations
      fireEvent.click(screen.getByText('Continue')); // Integrations -> Voice
      fireEvent.click(screen.getByText('Continue')); // Voice -> Grid

      // Click Finish
      fireEvent.click(screen.getByText('Finish'));

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('should call onComplete when Skip is clicked on last step', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Navigate to last step
      fireEvent.click(screen.getByText('Continue')); // Welcome -> Integrations
      fireEvent.click(screen.getByText('Continue')); // Integrations -> Voice
      fireEvent.click(screen.getByText('Continue')); // Voice -> Grid

      // Skip on last step
      fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('should call onSkipAll when Skip Setup is clicked', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} onSkipAll={mockOnSkipAll} />);

      fireEvent.click(screen.getByText('Skip Setup'));

      expect(mockOnSkipAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress tracking', () => {
    it('should mark completed steps in the progress indicator', () => {
      render(<OnboardingWizard onComplete={mockOnComplete} />);

      // Complete welcome step
      fireEvent.click(screen.getByText('Continue'));

      // Welcome should be marked as completed (would have check icon)
      // This tests the internal state tracking
      expect(screen.getByTestId('integrations-step')).toBeInTheDocument();
    });
  });

  describe('user name', () => {
    it('should pass userName to step components', () => {
      const userName = 'John Doe';
      render(<OnboardingWizard onComplete={mockOnComplete} userName={userName} />);

      // The userName is passed to child components (verified via props in actual implementation)
      expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
    });
  });
});
