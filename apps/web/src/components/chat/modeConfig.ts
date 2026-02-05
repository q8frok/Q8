import { Keyboard, Mic, Radio } from 'lucide-react';

export const MODE_CONFIG = {
  text: {
    icon: Keyboard,
    label: 'Text',
    description: 'Type your messages',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  voice: {
    icon: Mic,
    label: 'Voice',
    description: 'Push to talk',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
  },
  ambient: {
    icon: Radio,
    label: 'Ambient',
    description: 'Always listening',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
} as const;
