'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StepProps } from '../OnboardingWizard';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  connectUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'google',
    name: 'Google',
    description: 'Calendar, Gmail, Drive',
    icon: '🔵',
    connected: false,
    connectUrl: '/api/auth/link-google',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Pull requests, issues, repos',
    icon: '⚫',
    connected: false,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Music playback, playlists',
    icon: '🟢',
    connected: false,
    connectUrl: '/api/spotify/auth',
  },
  {
    id: 'homeassistant',
    name: 'Home Assistant',
    description: 'Smart home control',
    icon: '🏠',
    connected: false,
  },
];

export function IntegrationsStep({ onNext: _onNext }: StepProps) {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (id: string) => {
    const integration = integrations.find(i => i.id === id);
    if (!integration) return;

    if (integration.connectUrl) {
      // OAuth flow - redirect
      setConnecting(id);
      window.location.href = integration.connectUrl;
    } else {
      // Simulate connection for demo
      setConnecting(id);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIntegrations(prev =>
        prev.map(i => (i.id === id ? { ...i, connected: true } : i))
      );
      setConnecting(null);
    }
  };

  const connectedCount = integrations.filter(i => i.connected).length;

  return (
    <div className="max-w-lg mx-auto">
      <p className="text-text-muted mb-6">
        Connect your favorite services to unlock Q8&apos;s full potential. You can always add more later in Settings.
      </p>

      <div className="grid gap-3 mb-6">
        {integrations.map((integration, i) => (
          <motion.div
            key={integration.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between p-4 rounded-xl bg-surface-2 border border-border-subtle"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{integration.icon}</span>
              <div>
                <h3 className="font-medium">{integration.name}</h3>
                <p className="text-sm text-text-muted">{integration.description}</p>
              </div>
            </div>
            {integration.connected ? (
              <div className="flex items-center gap-2 text-green-500">
                <Check className="h-4 w-4" />
                <span className="text-sm">Connected</span>
              </div>
            ) : (
              <Button
                variant="subtle"
                size="sm"
                onClick={() => handleConnect(integration.id)}
                disabled={connecting === integration.id}
                className="gap-1"
              >
                {connecting === integration.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Connect
              </Button>
            )}
          </motion.div>
        ))}
      </div>

      {connectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-text-muted"
        >
          {connectedCount} of {integrations.length} integrations connected
        </motion.div>
      )}
    </div>
  );
}
