export type RealtimeTurnDetectionMode = 'server_vad' | 'semantic_vad' | 'none';

export interface RealtimeSessionPolicy {
  allowedVoices: readonly string[];
  turnDetectionMode: RealtimeTurnDetectionMode;
  transcriptionModel: string;
  maxSessionTtlSeconds: number;
  allowedToolCapabilities: readonly string[];
  allowedEventCapabilities: readonly string[];
}

export interface VersionedRealtimeConfig {
  version: string;
  migrationTag: string;
  rolloutPercent: number;
  model: string;
  fallbackModels: readonly string[];
  defaultInstructions: string;
  policy: RealtimeSessionPolicy;
}

export interface RealtimeNegotiatedMetadata {
  version: string;
  migrationTag: string;
  model: string;
  voice: string;
  turnDetectionMode: RealtimeTurnDetectionMode;
  transcriptionModel: string;
  maxSessionTtlSeconds: number;
  allowedToolCapabilities: readonly string[];
  allowedEventCapabilities: readonly string[];
}

export interface ResolveRealtimeSessionConfigParams {
  userId?: string;
  requestedVoice?: string;
  requestedInstructions?: string;
}

export interface RealtimeSessionOpenAIConfig {
  model: string;
  voice: string;
  instructions: string;
  input_audio_transcription: { model: string };
  turn_detection: { type: RealtimeTurnDetectionMode };
}

const GLOBAL_FALLBACK_MODEL = 'gpt-4o-realtime-preview-2024-12-17';
const DEFAULT_INSTRUCTIONS =
  'You are Q8, a helpful AI personal assistant. Be concise and friendly.';
const DEFAULT_ALLOWED_TOOL_CAPABILITIES = ['none'] as const;
const DEFAULT_ALLOWED_EVENT_CAPABILITIES = [
  'input_audio_buffer.speech_started',
  'input_audio_buffer.speech_stopped',
  'conversation.item.input_audio_transcription.completed',
  'response.audio.started',
  'response.audio.done',
  'response.audio_transcript.delta',
  'response.audio_transcript.done',
  'error',
] as const;

const REALTIME_CONFIG_VERSIONS: readonly VersionedRealtimeConfig[] = [
  {
    version: '2025-01-voice-ga',
    migrationTag: 'realtime-ga-stable',
    rolloutPercent: 100,
    model: 'gpt-4o-realtime-preview-2024-12-17',
    fallbackModels: ['gpt-4o-mini-realtime-preview-2024-12-17'],
    defaultInstructions: DEFAULT_INSTRUCTIONS,
    policy: {
      allowedVoices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'nova', 'sage', 'shimmer', 'verse'],
      turnDetectionMode: 'server_vad',
      transcriptionModel: 'whisper-1',
      maxSessionTtlSeconds: 900,
      allowedToolCapabilities: DEFAULT_ALLOWED_TOOL_CAPABILITIES,
      allowedEventCapabilities: DEFAULT_ALLOWED_EVENT_CAPABILITIES,
    },
  },
  {
    version: '2026-01-voice-upgrade-canary',
    migrationTag: 'realtime-canary-2026-01',
    rolloutPercent: 0,
    model: 'gpt-4o-realtime-preview-2024-12-17',
    fallbackModels: ['gpt-4o-mini-realtime-preview-2024-12-17'],
    defaultInstructions: DEFAULT_INSTRUCTIONS,
    policy: {
      allowedVoices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'nova', 'sage', 'shimmer', 'verse'],
      turnDetectionMode: 'server_vad',
      transcriptionModel: 'whisper-1',
      maxSessionTtlSeconds: 1200,
      allowedToolCapabilities: DEFAULT_ALLOWED_TOOL_CAPABILITIES,
      allowedEventCapabilities: DEFAULT_ALLOWED_EVENT_CAPABILITIES,
    },
  },
] as const;

function parseCommaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function clampRolloutPercent(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.floor(parsed)));
}

function isValidModelName(model: string): boolean {
  return /^[a-zA-Z0-9._:-]{3,128}$/.test(model);
}

function isAllowedTurnDetectionMode(value: string): value is RealtimeTurnDetectionMode {
  return value === 'server_vad' || value === 'semantic_vad' || value === 'none';
}

function hashToPercent(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

function resolveConfigVersion(userId?: string): VersionedRealtimeConfig {
  const forcedVersion = process.env.Q8_REALTIME_CONFIG_VERSION?.trim();
  if (forcedVersion) {
    const forced = REALTIME_CONFIG_VERSIONS.find((config) => config.version === forcedVersion);
    if (forced) return forced;
  }

  const userRolloutBucket = hashToPercent(userId ?? 'anonymous');

  for (const config of [...REALTIME_CONFIG_VERSIONS].reverse()) {
    const envOverride = clampRolloutPercent(
      process.env[`Q8_REALTIME_ROLLOUT_${config.version.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`],
      config.rolloutPercent,
    );

    if (userRolloutBucket < envOverride) {
      return config;
    }
  }

  return REALTIME_CONFIG_VERSIONS[0] ?? {
    version: 'fallback',
    migrationTag: 'fallback',
    rolloutPercent: 100,
    model: GLOBAL_FALLBACK_MODEL,
    fallbackModels: [],
    defaultInstructions: DEFAULT_INSTRUCTIONS,
    policy: {
      allowedVoices: ['nova'],
      turnDetectionMode: 'server_vad',
      transcriptionModel: 'whisper-1',
      maxSessionTtlSeconds: 900,
      allowedToolCapabilities: DEFAULT_ALLOWED_TOOL_CAPABILITIES,
      allowedEventCapabilities: DEFAULT_ALLOWED_EVENT_CAPABILITIES,
    },
  };
}

function pickModel(versionConfig: VersionedRealtimeConfig): string {
  const envPrimary = process.env.Q8_REALTIME_MODEL?.trim();
  const envFallbacks = parseCommaList(process.env.Q8_REALTIME_MODEL_FALLBACKS);

  const candidateChain = [
    envPrimary,
    versionConfig.model,
    ...envFallbacks,
    ...versionConfig.fallbackModels,
    GLOBAL_FALLBACK_MODEL,
  ];

  return candidateChain.find((candidate): candidate is string => !!candidate && isValidModelName(candidate)) ?? GLOBAL_FALLBACK_MODEL;
}

function resolveVoice(versionConfig: VersionedRealtimeConfig, requestedVoice?: string): string {
  const envVoice = process.env.Q8_REALTIME_VOICE?.trim();
  const allowedVoices = versionConfig.policy.allowedVoices;
  const candidateChain = [requestedVoice?.trim(), envVoice, allowedVoices[0], 'nova'];

  return candidateChain.find((candidate): candidate is string => !!candidate && allowedVoices.includes(candidate)) ?? 'nova';
}

function resolveTurnDetectionMode(versionConfig: VersionedRealtimeConfig): RealtimeTurnDetectionMode {
  const envMode = process.env.Q8_REALTIME_TURN_DETECTION_MODE?.trim();
  if (envMode && isAllowedTurnDetectionMode(envMode)) {
    return envMode;
  }
  return versionConfig.policy.turnDetectionMode;
}

function resolveTranscriptionModel(versionConfig: VersionedRealtimeConfig): string {
  const envModel = process.env.Q8_REALTIME_TRANSCRIPTION_MODEL?.trim();
  if (envModel && isValidModelName(envModel)) {
    return envModel;
  }
  return versionConfig.policy.transcriptionModel;
}

function resolveMaxTtl(versionConfig: VersionedRealtimeConfig): number {
  const envTtl = Number(process.env.Q8_REALTIME_MAX_SESSION_TTL_SECONDS);
  const ttl = Number.isFinite(envTtl) ? envTtl : versionConfig.policy.maxSessionTtlSeconds;
  return Math.max(60, Math.min(3600, Math.floor(ttl)));
}

function resolveAllowedCapabilities(
  envValue: string | undefined,
  allowedByPolicy: readonly string[],
): readonly string[] {
  const requested = parseCommaList(envValue);
  if (!requested.length) return allowedByPolicy;

  const filtered = requested.filter((capability) => allowedByPolicy.includes(capability));
  return filtered.length ? filtered : allowedByPolicy;
}

export function resolveRealtimeSessionConfig(params: ResolveRealtimeSessionConfigParams = {}) {
  const versionConfig = resolveConfigVersion(params.userId);

  const model = pickModel(versionConfig);
  const voice = resolveVoice(versionConfig, params.requestedVoice);
  const turnDetectionMode = resolveTurnDetectionMode(versionConfig);
  const transcriptionModel = resolveTranscriptionModel(versionConfig);
  const maxSessionTtlSeconds = resolveMaxTtl(versionConfig);

  const allowedToolCapabilities = resolveAllowedCapabilities(
    process.env.Q8_REALTIME_ALLOWED_TOOL_CAPABILITIES,
    versionConfig.policy.allowedToolCapabilities,
  );

  const allowedEventCapabilities = resolveAllowedCapabilities(
    process.env.Q8_REALTIME_ALLOWED_EVENT_CAPABILITIES,
    versionConfig.policy.allowedEventCapabilities,
  );

  const instructions = params.requestedInstructions?.trim() || versionConfig.defaultInstructions;

  const openAIConfig: RealtimeSessionOpenAIConfig = {
    model,
    voice,
    instructions,
    input_audio_transcription: { model: transcriptionModel },
    turn_detection: { type: turnDetectionMode },
  };

  const metadata: RealtimeNegotiatedMetadata = {
    version: versionConfig.version,
    migrationTag: versionConfig.migrationTag,
    model,
    voice,
    turnDetectionMode,
    transcriptionModel,
    maxSessionTtlSeconds,
    allowedToolCapabilities,
    allowedEventCapabilities,
  };

  return {
    openAIConfig,
    metadata,
  };
}
