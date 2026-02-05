'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/pwa/haptics';

interface AITaskGeneratorProps {
  onGenerate: (prompt: string, parentTaskId?: string) => Promise<void>;
  parentTaskId?: string;
  onClose?: () => void;
}

export function AITaskGenerator({ onGenerate, parentTaskId, onClose }: AITaskGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    haptics.medium();

    try {
      await onGenerate(prompt, parentTaskId);
      setPrompt('');
      haptics.success();
      onClose?.();
    } catch (_err) {
      setError('Failed to generate tasks. Please try again.');
      haptics.error();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-4 bg-gradient-to-br from-neon-primary/10 to-purple-500/10 border border-neon-primary/30 rounded-lg space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-neon-primary" />
          <h4 className="text-sm font-medium text-white">AI Task Generator</h4>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleGenerate();
            }
          }}
          placeholder={parentTaskId 
            ? "Describe subtasks for this task..." 
            : "Describe what you want to accomplish..."
          }
          className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-neon-primary resize-none"
          rows={3}
          disabled={isGenerating}
        />

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-white/60">
            {parentTaskId ? 'Generate subtasks' : 'Break down your goal into tasks'}
          </p>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-2',
              'bg-neon-primary/20 text-neon-primary hover:bg-neon-primary/30',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>

      <div className="text-xs text-white/40 space-y-1">
        <p>Examples:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>&ldquo;Plan a birthday party for 20 people&rdquo;</li>
          <li>&ldquo;Launch a new product feature&rdquo;</li>
          <li>&ldquo;Organize a team offsite&rdquo;</li>
        </ul>
      </div>
    </motion.div>
  );
}
