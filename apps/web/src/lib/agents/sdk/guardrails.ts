/**
 * Input Guardrails
 * Lightweight pre-run validation checks.
 *
 * When SDK-native guardrails ship (inputGuardrails / outputGuardrails),
 * these can be migrated to the Agent definition.
 */

import { logger } from '@/lib/logger';

export interface GuardrailResult {
  passed: boolean;
  guardrail: string;
  message?: string;
}

/**
 * Run all input guardrails on a user message.
 * Returns the first failure, or a pass result.
 */
export function checkInputGuardrails(message: string): GuardrailResult {
  // 1. Message length check
  if (message.length > 50_000) {
    return {
      passed: false,
      guardrail: 'message_length',
      message: 'Message is too long. Please keep messages under 50,000 characters.',
    };
  }

  // 2. Empty message check
  if (message.trim().length === 0) {
    return {
      passed: false,
      guardrail: 'empty_message',
      message: 'Message cannot be empty.',
    };
  }

  // 3. Prompt injection heuristic — detect common injection patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
    /you\s+are\s+now\s+(a|an)\s+/i,
    /system\s*:\s*(you|ignore|forget|override)/i,
    /\[SYSTEM\]/i,
    /<<\s*SYS\s*>>/i,
    /OVERRIDE\s+INSTRUCTIONS/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(message)) {
      logger.warn('[Guardrail] Potential prompt injection detected', {
        pattern: pattern.source,
        messagePreview: message.slice(0, 100),
      });
      return {
        passed: false,
        guardrail: 'injection_detection',
        message: "I can't process that request. Please rephrase your question.",
      };
    }
  }

  return { passed: true, guardrail: 'all' };
}
