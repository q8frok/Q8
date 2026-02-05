/**
 * ErrorBoundary Component Tests
 *
 * Tests for the ErrorBoundary component covering:
 * - Renders children when no error occurs
 * - Renders fallback UI when a child throws
 * - Calls onError callback with error info
 * - Renders default fallback when no custom fallback provided
 * - Try Again button resets the error state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Component that throws on demand
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error from child');
  }
  return <div data-testid="child-content">Working fine</div>;
}

// Suppress console.error for expected error boundary triggers
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders default fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Should not render the child
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();

    // Should show default error UI
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error from child')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();

    // Default fallback should not be shown
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('calls onError callback when error is caught', () => {
    const onErrorMock = vi.fn();

    render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalledTimes(1);

    // First argument should be the Error
    const [error, errorInfo] = onErrorMock.mock.calls[0]!;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error from child');

    // Second argument should be ErrorInfo with componentStack
    expect(errorInfo).toHaveProperty('componentStack');
  });

  it('resets error state when Try Again is clicked', () => {
    // Use a stateful wrapper to control the throw behavior
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) {
        throw new Error('Resettable error');
      }
      return <div data-testid="recovered">Recovered!</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    // Error state should be shown
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Stop throwing before clicking Try Again
    shouldThrow = false;

    // Click Try Again
    fireEvent.click(screen.getByText('Try Again'));

    // Should re-render children successfully
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('does not call onError when no error occurs', () => {
    const onErrorMock = vi.fn();

    render(
      <ErrorBoundary onError={onErrorMock}>
        <div>No errors here</div>
      </ErrorBoundary>
    );

    expect(onErrorMock).not.toHaveBeenCalled();
  });
});
