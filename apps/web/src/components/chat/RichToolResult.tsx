'use client';

import {
  Cloud, Sun, CloudRain, Snowflake, CloudLightning, Wind,
  Calendar, Clock, MapPin, Users,
  Music, Disc3, Play,
  DollarSign, TrendingUp, TrendingDown,
  Github, GitPullRequest, CircleDot,
  Thermometer, Moon, Activity,
  Home, Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface RichToolResultProps {
  toolName: string;
  result: unknown;
  className?: string;
}

// =============================================================================
// DISPATCHER
// =============================================================================

/**
 * Determines if a tool result can be rendered with a rich card.
 * Returns false for raw/unrecognized results (falls back to ToolResultPreview).
 */
export function hasRichRenderer(toolName: string, result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const name = toolName.toLowerCase();
  return (
    name.includes('weather') ||
    name.includes('calendar') ||
    name.includes('spotify') ||
    name.includes('finance') || name.includes('spending') || name.includes('balance') || name.includes('net_worth') ||
    name.includes('github') ||
    name.includes('oura') || name.includes('sleep') || name.includes('readiness') ||
    name.includes('ha_') || name.includes('control_device') || name.includes('discover')
  );
}

/**
 * RichToolResult — dispatches to the right mini-card based on tool name.
 */
export function RichToolResult({ toolName, result, className }: RichToolResultProps) {
  const name = toolName.toLowerCase();
  const data = result as Record<string, unknown>;

  if (name.includes('weather')) return <WeatherCard data={data} className={className} />;
  if (name.includes('calendar')) return <CalendarCard data={data} className={className} />;
  if (name.includes('spotify')) return <SpotifyCard data={data} toolName={name} className={className} />;
  if (name.includes('finance') || name.includes('spending') || name.includes('balance') || name.includes('net_worth'))
    return <FinanceCard data={data} toolName={name} className={className} />;
  if (name.includes('github')) return <GithubCard data={data} toolName={name} className={className} />;
  if (name.includes('oura') || name.includes('sleep') || name.includes('readiness'))
    return <OuraCard data={data} className={className} />;
  if (name.includes('ha_') || name.includes('control_device') || name.includes('discover'))
    return <HomeCard data={data} className={className} />;

  return null;
}

// =============================================================================
// SHARED
// =============================================================================

function CardShell({ children, className, accent = 'border-border-subtle' }: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-3 text-sm bg-surface-2',
      accent,
      className,
    )}>
      {children}
    </div>
  );
}

function Kv({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {icon}
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary ml-auto">{value}</span>
    </div>
  );
}

// =============================================================================
// WEATHER
// =============================================================================

function getWeatherIcon(condition: string) {
  const c = (condition || '').toLowerCase();
  if (c.includes('rain') || c.includes('drizzle')) return <CloudRain className="h-5 w-5 text-blue-400" />;
  if (c.includes('snow')) return <Snowflake className="h-5 w-5 text-cyan-300" />;
  if (c.includes('thunder') || c.includes('storm')) return <CloudLightning className="h-5 w-5 text-yellow-400" />;
  if (c.includes('cloud') || c.includes('overcast')) return <Cloud className="h-5 w-5 text-zinc-400" />;
  if (c.includes('wind')) return <Wind className="h-5 w-5 text-teal-400" />;
  return <Sun className="h-5 w-5 text-amber-400" />;
}

function WeatherCard({ data, className }: { data: Record<string, unknown>; className?: string }) {
  const temp = data.temperature ?? data.temp;
  const condition = String(data.condition ?? data.description ?? data.weather ?? '');
  const city = String(data.city ?? data.location ?? '');
  const humidity = data.humidity;
  const feelsLike = data.feels_like ?? data.feelsLike;

  return (
    <CardShell className={className} accent="border-blue-500/20">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {getWeatherIcon(condition)}
            <span className="text-lg font-semibold text-text-primary">
              {temp != null ? `${temp}°` : '—'}
            </span>
          </div>
          {condition && <p className="text-xs text-text-secondary capitalize">{condition}</p>}
          {city && <p className="text-xs text-text-muted mt-0.5">{city}</p>}
        </div>
        <div className="space-y-1 text-right">
          {feelsLike != null && <p className="text-xs text-text-muted">Feels like {String(feelsLike)}°</p>}
          {humidity != null && <p className="text-xs text-text-muted">Humidity {String(humidity)}%</p>}
        </div>
      </div>
    </CardShell>
  );
}

// =============================================================================
// CALENDAR
// =============================================================================

function CalendarCard({ data, className }: { data: Record<string, unknown>; className?: string }) {
  const events = Array.isArray(data.events) ? data.events : Array.isArray(data) ? data : [data];
  const items = events.slice(0, 5) as Array<Record<string, unknown>>;

  return (
    <CardShell className={className} accent="border-green-500/20">
      <div className="flex items-center gap-1.5 mb-2">
        <Calendar className="h-4 w-4 text-green-400" />
        <span className="text-xs font-medium text-green-400">
          {items.length} event{items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((ev, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <Clock className="h-3 w-3 text-text-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-text-primary truncate">{String(ev.summary ?? ev.title ?? 'Untitled')}</p>
              <div className="flex items-center gap-2 text-text-muted">
                {ev.start != null && <span>{String(ev.start).slice(0, 16)}</span>}
                {ev.location != null && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />
                    {String(ev.location).slice(0, 30)}
                  </span>
                )}
                {ev.attendees != null && <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{String(ev.attendees)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

// =============================================================================
// SPOTIFY
// =============================================================================

function SpotifyCard({ data, toolName, className }: { data: Record<string, unknown>; toolName: string; className?: string }) {
  const isSearch = toolName.includes('search');
  const isNowPlaying = toolName.includes('now_playing');

  if (isNowPlaying || data.is_playing !== undefined) {
    const track = String(data.track ?? data.name ?? '');
    const artist = String(data.artist ?? data.artists ?? '');
    const album = String(data.album ?? '');
    const isPlaying = data.is_playing === true;
    return (
      <CardShell className={className} accent="border-green-500/20">
        <div className="flex items-center gap-2">
          {isPlaying ? <Play className="h-4 w-4 text-green-500" /> : <Music className="h-4 w-4 text-text-muted" />}
          <div className="min-w-0">
            <p className="font-medium text-text-primary truncate">{track || 'Nothing playing'}</p>
            {artist && <p className="text-xs text-text-muted truncate">{artist}{album ? ` · ${album}` : ''}</p>}
          </div>
        </div>
      </CardShell>
    );
  }

  if (isSearch && Array.isArray(data.tracks)) {
    const tracks = (data.tracks as Array<Record<string, unknown>>).slice(0, 5);
    return (
      <CardShell className={className} accent="border-green-500/20">
        <div className="flex items-center gap-1.5 mb-2">
          <Music className="h-4 w-4 text-green-500" />
          <span className="text-xs font-medium text-green-400">{tracks.length} results</span>
        </div>
        <div className="space-y-1.5">
          {tracks.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <Disc3 className="h-3 w-3 text-text-muted shrink-0" />
              <span className="font-medium text-text-primary truncate">{String(t.name ?? '')}</span>
              <span className="text-text-muted truncate ml-auto">{String(t.artist ?? t.artists ?? '')}</span>
            </div>
          ))}
        </div>
      </CardShell>
    );
  }

  // Generic Spotify result
  const msg = String(data.message ?? data.status ?? JSON.stringify(data).slice(0, 100));
  return (
    <CardShell className={className} accent="border-green-500/20">
      <div className="flex items-center gap-2">
        <Music className="h-4 w-4 text-green-500" />
        <span className="text-xs text-text-secondary">{msg}</span>
      </div>
    </CardShell>
  );
}

// =============================================================================
// FINANCE
// =============================================================================

function FinanceCard({ data, toolName, className }: { data: Record<string, unknown>; toolName: string; className?: string }) {
  const fmt = (v: unknown) => {
    if (v == null) return '—';
    const n = Number(v);
    return isNaN(n) ? String(v) : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Net worth / balance
  if (toolName.includes('balance') || toolName.includes('net_worth') || data.net_worth !== undefined) {
    const nw = data.net_worth ?? data.balance ?? data.total;
    const change = data.change ?? data.change_pct;
    const isPositive = Number(change) >= 0;
    return (
      <CardShell className={className} accent="border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <span className="text-lg font-semibold text-text-primary">{fmt(nw)}</span>
          </div>
          {change != null && (
            <span className={cn('text-xs font-medium flex items-center gap-0.5', isPositive ? 'text-green-400' : 'text-red-400')}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? '+' : ''}{String(change)}%
            </span>
          )}
        </div>
      </CardShell>
    );
  }

  // Spending categories
  if (Array.isArray(data.categories) || Array.isArray(data.spending)) {
    const cats = ((data.categories ?? data.spending) as Array<Record<string, unknown>>).slice(0, 6);
    return (
      <CardShell className={className} accent="border-amber-500/20">
        <div className="space-y-1.5">
          {cats.map((c, i) => (
            <Kv key={i} label={String(c.category ?? c.name ?? '')} value={String(fmt(c.amount ?? c.total))} />
          ))}
        </div>
      </CardShell>
    );
  }

  // Fallback: show key-value pairs
  const entries = Object.entries(data).slice(0, 6);
  return (
    <CardShell className={className} accent="border-amber-500/20">
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <Kv key={k} label={k.replace(/_/g, ' ')} value={String(typeof v === 'number' ? fmt(v) : String(v ?? '').slice(0, 50))} />
        ))}
      </div>
    </CardShell>
  );
}

// =============================================================================
// GITHUB
// =============================================================================

function GithubCard({ data, toolName, className }: { data: Record<string, unknown>; toolName: string; className?: string }) {
  const isPR = toolName.includes('pr') || toolName.includes('pull');
  const isIssue = toolName.includes('issue');

  const title = String(data.title ?? data.name ?? '');
  const number = data.number ?? data.id;
  const state = String(data.state ?? '');
  const url = String(data.html_url ?? data.url ?? '');
  const repo = String(data.repo ?? data.repository ?? '');

  const StateIcon = isPR ? GitPullRequest : CircleDot;
  const stateColor = state === 'open' ? 'text-green-400' : state === 'closed' || state === 'merged' ? 'text-purple-400' : 'text-text-muted';

  return (
    <CardShell className={className} accent="border-zinc-500/20">
      <div className="flex items-start gap-2">
        {isPR || isIssue ? (
          <StateIcon className={cn('h-4 w-4 mt-0.5 shrink-0', stateColor)} />
        ) : (
          <Github className="h-4 w-4 mt-0.5 shrink-0 text-text-muted" />
        )}
        <div className="min-w-0">
          <p className="font-medium text-text-primary truncate">
            {title || 'Untitled'}{number ? ` #${number}` : ''}
          </p>
          <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
            {repo && <span>{repo}</span>}
            {state && <span className={cn('capitalize', stateColor)}>{state}</span>}
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-0.5 inline-block">
              View on GitHub →
            </a>
          )}
        </div>
      </div>
    </CardShell>
  );
}

// =============================================================================
// OURA (Sleep/Readiness)
// =============================================================================

function OuraCard({ data, className }: { data: Record<string, unknown>; className?: string }) {
  const score = data.score ?? data.sleep_score ?? data.readiness_score;
  const duration = data.duration ?? data.total_sleep;
  const deep = data.deep ?? data.deep_sleep;
  const rem = data.rem ?? data.rem_sleep;
  const hrv = data.hrv ?? data.average_hrv;
  const restingHr = data.resting_hr ?? data.resting_heart_rate;

  const scoreNum = Number(score);
  const scoreColor = scoreNum >= 85 ? 'text-green-400' : scoreNum >= 70 ? 'text-amber-400' : 'text-red-400';

  return (
    <CardShell className={className} accent="border-purple-500/20">
      <div className="flex items-center gap-3 mb-2">
        <Moon className="h-4 w-4 text-purple-400" />
        {score != null && (
          <span className={cn('text-lg font-semibold', scoreColor)}>{scoreNum}/100</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {duration != null && <Kv label="Duration" value={String(duration)} icon={<Clock className="h-3 w-3 text-text-muted" />} />}
        {deep != null && <Kv label="Deep" value={String(deep)} />}
        {rem != null && <Kv label="REM" value={String(rem)} />}
        {hrv != null && <Kv label="HRV" value={`${hrv} ms`} icon={<Activity className="h-3 w-3 text-text-muted" />} />}
        {restingHr != null && <Kv label="Resting HR" value={`${restingHr} bpm`} />}
      </div>
    </CardShell>
  );
}

// =============================================================================
// HOME ASSISTANT
// =============================================================================

function HomeCard({ data, className }: { data: Record<string, unknown>; className?: string }) {
  const entity = String(data.entity_id ?? data.entity ?? '');
  const state = String(data.state ?? data.status ?? '');
  const friendly = String(data.friendly_name ?? data.name ?? entity.split('.').pop() ?? '');
  const attributes = data.attributes as Record<string, unknown> | undefined;
  const temp = attributes?.temperature ?? attributes?.current_temperature;
  const brightness = attributes?.brightness;

  const isOn = state === 'on' || state === 'playing';

  return (
    <CardShell className={className} accent="border-cyan-500/20">
      <div className="flex items-center gap-2">
        {entity.includes('light') ? (
          <Lightbulb className={cn('h-4 w-4', isOn ? 'text-amber-400' : 'text-text-muted')} />
        ) : entity.includes('climate') ? (
          <Thermometer className="h-4 w-4 text-orange-400" />
        ) : (
          <Home className="h-4 w-4 text-cyan-400" />
        )}
        <div className="min-w-0">
          <p className="font-medium text-text-primary truncate">{friendly}</p>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className={cn(isOn ? 'text-green-400' : 'text-text-muted')}>{state}</span>
            {temp != null && <span>{String(temp)}°</span>}
            {brightness != null && <span>{Math.round(Number(brightness) / 2.55)}%</span>}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

RichToolResult.displayName = 'RichToolResult';
