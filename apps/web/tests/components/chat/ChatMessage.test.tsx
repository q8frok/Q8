/**
 * ChatMessage Component Tests
 *
 * Tests for the ChatMessage component covering:
 * - Renders user message with correct layout
 * - Renders agent/bot message with agent name
 * - Renders markdown content
 * - Shows correct status indicators
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      className,
      onMouseEnter,
      onMouseLeave,
      ...props
    }: React.HTMLAttributes<HTMLDivElement>) => (
      <div
        className={className}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        {...props}
      >
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    <img alt={alt} {...props} />
  ),
}));

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock syntax highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => <pre>{children}</pre>,
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

// Mock lucide-react icons used in ChatMessage
vi.mock('lucide-react', () => ({
  User: ({ className }: { className?: string }) => (
    <span data-testid="user-icon" className={className}>User</span>
  ),
  Check: ({ className }: { className?: string }) => (
    <span data-testid="check-icon" className={className}>Check</span>
  ),
  Copy: ({ className }: { className?: string }) => (
    <span data-testid="copy-icon" className={className}>Copy</span>
  ),
  Bot: ({ className }: { className?: string }) => (
    <span data-testid="bot-icon" className={className}>Bot</span>
  ),
  Code2: ({ className }: { className?: string }) => (
    <span data-testid="code-icon" className={className}>Code</span>
  ),
  Search: ({ className }: { className?: string }) => (
    <span data-testid="search-icon" className={className}>Search</span>
  ),
  Calendar: ({ className }: { className?: string }) => (
    <span data-testid="calendar-icon" className={className}>Calendar</span>
  ),
  Home: ({ className }: { className?: string }) => (
    <span data-testid="home-icon" className={className}>Home</span>
  ),
  DollarSign: ({ className }: { className?: string }) => (
    <span data-testid="dollar-icon" className={className}>Dollar</span>
  ),
  ImageIcon: ({ className }: { className?: string }) => (
    <span data-testid="image-icon" className={className}>Image</span>
  ),
  RefreshCw: ({ className }: { className?: string }) => (
    <span data-testid="refresh-icon" className={className}>Refresh</span>
  ),
  ThumbsUp: ({ className }: { className?: string }) => (
    <span data-testid="thumbsup-icon" className={className}>ThumbsUp</span>
  ),
  ThumbsDown: ({ className }: { className?: string }) => (
    <span data-testid="thumbsdown-icon" className={className}>ThumbsDown</span>
  ),
}));

// Mock the button component
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

import { ChatMessage } from '@/components/chat/ChatMessage';

describe('ChatMessage', () => {
  const baseTimestamp = new Date('2024-06-15T14:30:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    // Fix time so "Just now" works
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T14:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders user message with User icon', () => {
    render(
      <ChatMessage
        id="msg-1"
        role="user"
        content="Hello Q8"
        timestamp={baseTimestamp}
      />
    );

    expect(screen.getByTestId('user-icon')).toBeInTheDocument();
    expect(screen.getByTestId('markdown')).toHaveTextContent('Hello Q8');
  });

  it('renders user message with flex-row-reverse layout', () => {
    const { container } = render(
      <ChatMessage
        id="msg-1"
        role="user"
        content="Hello"
        timestamp={baseTimestamp}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('flex-row-reverse');
  });

  it('renders agent message with agent name', () => {
    render(
      <ChatMessage
        id="msg-2"
        role="coder"
        agentName="DevBot (Claude 4.5)"
        content="Here is the fix."
        timestamp={baseTimestamp}
      />
    );

    expect(screen.getByText('DevBot (Claude 4.5)')).toBeInTheDocument();
    expect(screen.getByTestId('markdown')).toHaveTextContent('Here is the fix.');
  });

  it('renders bot message with flex-row layout (not reversed)', () => {
    const { container } = render(
      <ChatMessage
        id="msg-2"
        role="orchestrator"
        content="Hello"
        timestamp={baseTimestamp}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('flex-row');
    expect(wrapper.className).not.toContain('flex-row-reverse');
  });

  it('falls back to agent config name when agentName not provided', () => {
    render(
      <ChatMessage
        id="msg-3"
        role="coder"
        content="Code review done."
        timestamp={baseTimestamp}
      />
    );

    // The display-config has name "DevBot" for coder role
    expect(screen.getByText('DevBot')).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    render(
      <ChatMessage
        id="msg-4"
        role="orchestrator"
        content="**Bold** and *italic*"
        timestamp={baseTimestamp}
      />
    );

    const markdownEl = screen.getByTestId('markdown');
    expect(markdownEl).toHaveTextContent('**Bold** and *italic*');
  });

  it('shows error status indicator', () => {
    render(
      <ChatMessage
        id="msg-5"
        role="user"
        content="Failed message"
        timestamp={baseTimestamp}
        status="error"
      />
    );

    expect(screen.getByText('Failed to send')).toBeInTheDocument();
  });

  it('shows sending status for bot messages', () => {
    render(
      <ChatMessage
        id="msg-6"
        role="orchestrator"
        content="Processing..."
        timestamp={baseTimestamp}
        status="sending"
      />
    );

    expect(screen.getByText('Sending...')).toBeInTheDocument();
  });

  it('displays timestamp for user messages', () => {
    render(
      <ChatMessage
        id="msg-7"
        role="user"
        content="Hello"
        timestamp={baseTimestamp}
      />
    );

    // Timestamp should be "Just now" since we set system time to same as message time
    expect(screen.getByText('Just now')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ChatMessage
        id="msg-8"
        role="user"
        content="Hello"
        timestamp={baseTimestamp}
        className="my-custom-class"
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('my-custom-class');
  });

  it('has correct displayName', () => {
    expect(ChatMessage.displayName).toBe('ChatMessage');
  });
});
