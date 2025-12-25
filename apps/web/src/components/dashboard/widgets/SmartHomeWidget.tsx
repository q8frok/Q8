'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Thermometer,
  Lightbulb,
  Tv,
  Volume2,
  VolumeX,
  Volume1,
  Speaker,
  Sun,
  Moon,
  Sofa,
  Power,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  RefreshCw,
  Droplets,
  Monitor,
  Gamepad2,
  Film,
  Waves,
  Zap,
  Bath,
  Sparkles,
  CircleDot,
  AlertTriangle,
  Bed,
  UtensilsCrossed,
  DoorOpen,
  Lamp,
  Square,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Entity IDs from Home Assistant dashboard config
const ENTITIES = {
  climate: 'climate.simon_aire_inc',
  scenes: {
    evening: 'scene.bedroom_evening',
    relax: 'scene.bedroom_relax',
    rest: 'scene.bedroom_rest',
    bright: 'scene.bedroom_bright',
    night: 'scene.bedroom_nightlight',
    allOff: 'scene.all_lights_off',
  },
  remotes: {
    appleTV: 'remote.living_room',
    samsungTV: 'remote.tv_samsung_7_series_65',
    padMode: 'input_select.remote_pad_mode',
  },
  media: {
    appleTV: 'media_player.living_room',
    sonos: 'media_player.sonos',
  },
  syncBox: {
    power: 'switch.sync_box_power',
    lightSync: 'switch.sync_box_light_sync',
    dolbyVision: 'switch.sync_box_dolby_vision_compatibility',
    hdmiInput: 'select.sync_box_hdmi_input',
    syncMode: 'select.sync_box_sync_mode',
    intensity: 'select.sync_box_intensity',
    brightness: 'number.sync_box_brightness',
  },
  covers: {
    left: 'cover.left_blind',
    right: 'cover.right_blind',
  },
  switches: {
    bathroom: 'switch.bathroom',
    kitchen: 'switch.kitchen',
  },
  lights: {
    bedroomGroup: 'light.bedroom_group',
    bedside: 'light.bedside',
    bedLED: 'light.elk_bledom02',
    deskLED: 'light.elk_bledom0c',
    kitchenBar: 'light.kitchen_bar',
    entry: 'light.entry',
    entertainment: 'light.entertainment',
  },
  sonos: {
    audioDelay: 'number.sonos_audio_delay',
    balance: 'number.sonos_balance',
    bass: 'number.sonos_bass',
    crossfade: 'switch.sonos_crossfade',
    loudness: 'switch.sonos_loudness',
  },
};

type HAState = Record<string, { state: string; attributes: Record<string, any> }>;
type TabType = 'home' | 'lights' | 'media' | 'climate';

interface SmartHomeWidgetProps {
  colSpan?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2 | 3 | 4;
  className?: string;
}

export function SmartHomeWidget({
  colSpan = 2,
  rowSpan = 3,
  className,
}: SmartHomeWidgetProps) {
  const [states, setStates] = useState<HAState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStates = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const allEntities = [
        ENTITIES.climate,
        ...Object.values(ENTITIES.scenes),
        ...Object.values(ENTITIES.remotes),
        ...Object.values(ENTITIES.media),
        ...Object.values(ENTITIES.syncBox),
        ...Object.values(ENTITIES.covers),
        ...Object.values(ENTITIES.switches),
        ...Object.values(ENTITIES.lights),
        ...Object.values(ENTITIES.sonos),
      ];

      const response = await fetch(
        `/api/homeassistant?entities=${allEntities.join(',')}`
      );

      if (!response.ok) throw new Error('Failed to fetch states');

      const data = await response.json();
      const stateMap: HAState = {};
      data.states?.forEach((s: any) => {
        stateMap[s.entity_id] = { state: s.state, attributes: s.attributes };
      });
      setStates(stateMap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStates();
    const interval = setInterval(fetchStates, 10000);
    return () => clearInterval(interval);
  }, [fetchStates]);

  const callService = async (
    domain: string,
    service: string,
    entityId?: string | null,
    data?: Record<string, any>
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/homeassistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, service, entity_id: entityId, data }),
      });
      const result = await response.json();
      if (!response.ok) {
        console.error('Service call failed:', result.error);
        return false;
      }
      setTimeout(fetchStates, 500);
      return true;
    } catch (err) {
      console.error('Service call failed:', err);
      return false;
    }
  };

  const getState = (entityId: string) => states[entityId]?.state || 'unavailable';
  const getAttr = (entityId: string, attr: string) => states[entityId]?.attributes?.[attr];
  const isOn = (entityId: string) => getState(entityId) === 'on';
  const toggleEntity = (domain: string, entityId: string) => callService(domain, 'toggle', entityId);
  const activateScene = (entityId: string) => callService('scene', 'turn_on', entityId);

  const sonosVolume = Math.round((getAttr(ENTITIES.media.sonos, 'volume_level') || 0) * 100);
  const sonosMuted = getAttr(ENTITIES.media.sonos, 'is_volume_muted');
  const setVolume = (level: number) => callService('media_player', 'volume_set', ENTITIES.media.sonos, { volume_level: level / 100 });
  const toggleMute = () => callService('media_player', 'volume_mute', ENTITIES.media.sonos, { is_volume_muted: !sonosMuted });

  const tabs: { id: TabType; icon: any; label: string }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'lights', icon: Lightbulb, label: 'Lights' },
    { id: 'media', icon: Tv, label: 'Media' },
    { id: 'climate', icon: Thermometer, label: 'Climate' },
  ];

  // Map colSpan to Tailwind classes - full width on mobile, specified span on md+
  const colSpanClasses: Record<number, string> = {
    1: 'col-span-1',
    2: 'col-span-1 md:col-span-2',
    3: 'col-span-1 md:col-span-3',
    4: 'col-span-1 md:col-span-4',
  };

  // Map rowSpan to Tailwind classes
  const rowSpanClasses: Record<number, string> = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
    4: 'row-span-4',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('glass-panel rounded-xl overflow-hidden flex flex-col w-full', colSpanClasses[colSpan], rowSpanClasses[rowSpan], className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-neon-primary" />
          <h3 className="font-semibold text-sm">Smart Home</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={fetchStates}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-glass-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'text-neon-primary border-b-2 border-neon-primary'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchStates}>
              Retry
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {activeTab === 'home' && (
                <HomeTab
                  isOn={isOn}
                  activateScene={activateScene}
                  toggleEntity={toggleEntity}
                  sonosVolume={sonosVolume}
                  sonosMuted={sonosMuted}
                  setVolume={setVolume}
                  toggleMute={toggleMute}
                  callService={callService}
                />
              )}
              {activeTab === 'lights' && (
                <LightsTab
                  isOn={isOn}
                  toggleEntity={toggleEntity}
                  activateScene={activateScene}
                  callService={callService}
                />
              )}
              {activeTab === 'media' && (
                <MediaTab
                  isOn={isOn}
                  getState={getState}
                  getAttr={getAttr}
                  callService={callService}
                  toggleEntity={toggleEntity}
                  sonosVolume={sonosVolume}
                  sonosMuted={sonosMuted}
                  setVolume={setVolume}
                  toggleMute={toggleMute}
                />
              )}
              {activeTab === 'climate' && (
                <ClimateTab
                  getState={getState}
                  getAttr={getAttr}
                  callService={callService}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// ============ Home Tab ============
function HomeTab({ isOn, activateScene, toggleEntity, sonosVolume, sonosMuted, setVolume, toggleMute, callService }: any) {
  return (
    <>
      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Scenes</h4>
        <div className="grid grid-cols-3 gap-2">
          <SceneButton icon={Moon} label="Evening" gradient="from-purple-600 to-fuchsia-600" onClick={() => activateScene(ENTITIES.scenes.evening)} />
          <SceneButton icon={Sofa} label="Relax" gradient="from-cyan-500 to-blue-600" onClick={() => activateScene(ENTITIES.scenes.relax)} />
          <SceneButton icon={Bed} label="Rest" gradient="from-pink-500 to-orange-500" onClick={() => activateScene(ENTITIES.scenes.rest)} />
          <SceneButton icon={Sun} label="Bright" gradient="from-amber-400 to-yellow-500" onClick={() => activateScene(ENTITIES.scenes.bright)} />
          <SceneButton icon={Sparkles} label="Night" gradient="from-indigo-500 to-purple-600" onClick={() => activateScene(ENTITIES.scenes.night)} />
          <SceneButton icon={Power} label="All Off" gradient="from-slate-600 to-slate-800" onClick={() => activateScene(ENTITIES.scenes.allOff)} />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Room Lights</h4>
        <div className="grid grid-cols-2 gap-2">
          <EntityButton icon={Bath} label="Bathroom" isActive={isOn(ENTITIES.switches.bathroom)} activeColor="cyan" onClick={() => toggleEntity('switch', ENTITIES.switches.bathroom)} />
          <EntityButton icon={UtensilsCrossed} label="Kitchen" isActive={isOn(ENTITIES.switches.kitchen)} activeColor="amber" onClick={() => toggleEntity('switch', ENTITIES.switches.kitchen)} />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Blinds</h4>
        <div className="grid grid-cols-3 gap-2">
          <ActionButton icon={ChevronUp} label="All Open" gradient="from-emerald-500 to-green-600" onClick={() => callService('cover', 'open_cover', null, { entity_id: [ENTITIES.covers.left, ENTITIES.covers.right] })} />
          <ActionButton icon={Droplets} label="Privacy" gradient="from-orange-500 to-amber-600" onClick={() => callService('cover', 'set_cover_position', null, { entity_id: [ENTITIES.covers.left, ENTITIES.covers.right], position: 100 })} />
          <ActionButton icon={ChevronDown} label="All Closed" gradient="from-rose-500 to-pink-600" onClick={() => callService('cover', 'close_cover', null, { entity_id: [ENTITIES.covers.left, ENTITIES.covers.right] })} />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sonos Volume</h4>
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div
                animate={!sonosMuted ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Speaker className="h-5 w-5 text-blue-400" />
              </motion.div>
              <span className="text-base font-semibold">{sonosMuted ? 'Muted' : `${sonosVolume}%`}</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center transition-all',
                sonosMuted
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-glass-bg border border-glass-border hover:border-white/20'
              )}
            >
              {sonosMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </motion.button>
          </div>
          <div className="h-2 bg-glass-border rounded-full overflow-hidden mb-4">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
              animate={{ width: `${sonosMuted ? 0 : sonosVolume}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { level: 15, label: 'Sleep', color: 'from-purple-600 to-violet-600' },
              { level: 20, label: 'Chat', color: 'from-cyan-500 to-teal-500' },
              { level: 40, label: 'Music', color: 'from-orange-500 to-amber-500' },
              { level: 70, label: 'Party', color: 'from-green-500 to-emerald-500' },
              { level: 90, label: 'Max', color: 'from-red-500 to-rose-500' },
            ].map((preset) => (
              <motion.button
                key={preset.level}
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setVolume(preset.level)}
                className={cn(
                  'py-2.5 rounded-lg text-[10px] font-semibold transition-all bg-gradient-to-br text-white shadow-md',
                  'border border-white/10 hover:shadow-lg',
                  preset.color,
                  sonosVolume === preset.level && 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-105'
                )}
              >
                {preset.label}
              </motion.button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// ============ Lights Tab ============
function LightsTab({ isOn, toggleEntity, activateScene, callService }: any) {
  return (
    <>
      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Light Scenes</h4>
        <div className="grid grid-cols-4 gap-2">
          <SceneButton icon={Sun} label="Bright" gradient="from-amber-400 to-yellow-500" onClick={() => activateScene(ENTITIES.scenes.bright)} size="sm" />
          <SceneButton icon={Sofa} label="Relax" gradient="from-pink-500 to-rose-500" onClick={() => activateScene(ENTITIES.scenes.relax)} size="sm" />
          <SceneButton icon={Moon} label="Evening" gradient="from-orange-500 to-red-500" onClick={() => activateScene(ENTITIES.scenes.evening)} size="sm" />
          <SceneButton icon={Sparkles} label="Night" gradient="from-blue-500 to-indigo-600" onClick={() => activateScene(ENTITIES.scenes.night)} size="sm" />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bedroom</h4>
        <div className="space-y-2">
          <EntityButton icon={Lightbulb} label="Bedroom Group" isActive={isOn(ENTITIES.lights.bedroomGroup)} activeColor="teal" onClick={() => toggleEntity('light', ENTITIES.lights.bedroomGroup)} fullWidth />
          <div className="grid grid-cols-2 gap-2">
            <EntityButton icon={Lamp} label="Bedside Lamp" isActive={isOn(ENTITIES.lights.bedside)} activeColor="amber" onClick={() => toggleEntity('light', ENTITIES.lights.bedside)} />
            <EntityButton icon={Waves} label="Bed LED Strip" isActive={isOn(ENTITIES.lights.bedLED)} activeColor="violet" onClick={() => toggleEntity('light', ENTITIES.lights.bedLED)} />
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Other Areas</h4>
        <div className="grid grid-cols-2 gap-2">
          <EntityButton icon={UtensilsCrossed} label="Kitchen Bar" isActive={isOn(ENTITIES.lights.kitchenBar)} activeColor="orange" onClick={() => toggleEntity('light', ENTITIES.lights.kitchenBar)} />
          <EntityButton icon={DoorOpen} label="Entry" isActive={isOn(ENTITIES.lights.entry)} activeColor="sky" onClick={() => toggleEntity('light', ENTITIES.lights.entry)} />
          <EntityButton icon={Bath} label="Bathroom" isActive={isOn(ENTITIES.switches.bathroom)} activeColor="cyan" onClick={() => toggleEntity('switch', ENTITIES.switches.bathroom)} />
          <EntityButton icon={Lightbulb} label="Kitchen" isActive={isOn(ENTITIES.switches.kitchen)} activeColor="yellow" onClick={() => toggleEntity('switch', ENTITIES.switches.kitchen)} />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Desk LED Effects</h4>
        <EntityButton icon={Monitor} label="Desk LED Strip" isActive={isOn(ENTITIES.lights.deskLED)} activeColor="fuchsia" onClick={() => toggleEntity('light', ENTITIES.lights.deskLED)} fullWidth />
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { name: 'Gaming', color: '#FF0000', gradient: 'from-red-600 to-red-800' },
            { name: 'Chill', color: '#0064FF', gradient: 'from-blue-500 to-blue-700' },
            { name: 'Focus', temp: 4500, gradient: 'from-gray-100 to-gray-300', dark: true },
            { name: 'Night', color: '#FF3200', gradient: 'from-orange-600 to-red-700' },
          ].map((mode) => (
            <motion.button
              key={mode.name}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => {
                if (mode.color) {
                  const r = parseInt(mode.color.slice(1, 3), 16);
                  const g = parseInt(mode.color.slice(3, 5), 16);
                  const b = parseInt(mode.color.slice(5, 7), 16);
                  callService('light', 'turn_on', ENTITIES.lights.deskLED, { rgb_color: [r, g, b], brightness_pct: 80 });
                } else if (mode.temp) {
                  callService('light', 'turn_on', ENTITIES.lights.deskLED, { color_temp_kelvin: mode.temp, brightness_pct: 85 });
                }
              }}
              className={cn(
                'py-3 rounded-xl text-[11px] font-semibold bg-gradient-to-br text-white shadow-md hover:shadow-lg',
                'border border-white/10 transition-all',
                mode.gradient,
                mode.dark && 'text-gray-800'
              )}
            >
              {mode.name}
            </motion.button>
          ))}
        </div>
      </section>
    </>
  );
}

// ============ Media Tab ============
function MediaTab({ isOn, getState, callService, toggleEntity, sonosVolume, sonosMuted, setVolume, toggleMute }: any) {
  const syncBoxPower = isOn(ENTITIES.syncBox.power);
  const lightSync = isOn(ENTITIES.syncBox.lightSync);
  const dolbyVision = isOn(ENTITIES.syncBox.dolbyVision);
  const syncMode = getState(ENTITIES.syncBox.syncMode);
  const intensity = getState(ENTITIES.syncBox.intensity);

  return (
    <>
      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Controls</h4>
        <div className="grid grid-cols-3 gap-2">
          <ActionButton icon={Tv} label="TV Power" gradient="from-red-500 to-rose-600" onClick={() => callService('homeassistant', 'toggle', ENTITIES.remotes.samsungTV)} />
          <ActionButton icon={CircleDot} label="Apple TV" gradient="from-gray-700 to-gray-900" onClick={async () => {
            // Turn on Samsung TV
            await callService('remote', 'turn_on', ENTITIES.remotes.samsungTV);
            // Turn on Hue Sync Box
            await callService('switch', 'turn_on', ENTITIES.syncBox.power);
            // Set HDMI input to Apple TV
            await callService('select', 'select_option', ENTITIES.syncBox.hdmiInput, { option: 'APPLE TV' });
            // Wake Apple TV and go to home
            await callService('remote', 'turn_on', ENTITIES.remotes.appleTV);
            setTimeout(() => callService('remote', 'send_command', ENTITIES.remotes.appleTV, { command: 'home' }), 1000);
          }} />
          <ActionButton icon={Gamepad2} label="Nintendo" gradient="from-red-600 to-red-800" onClick={async () => {
            // Turn on Samsung TV
            await callService('remote', 'turn_on', ENTITIES.remotes.samsungTV);
            // Turn on Hue Sync Box
            await callService('switch', 'turn_on', ENTITIES.syncBox.power);
            // Set HDMI input to Nintendo Switch
            await callService('select', 'select_option', ENTITIES.syncBox.hdmiInput, { option: 'Nintendo Switch' });
          }} />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Apple TV Remote</h4>
        <div className="glass-panel rounded-xl p-4">
          {/* D-Pad Navigation */}
          <div className="relative flex items-center justify-center mb-4">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-36 h-36 rounded-full bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-glass-border" />
            </div>
            <div className="grid grid-cols-3 gap-1 place-items-center relative z-10 p-2">
              <div />
              <RemoteButton icon={ChevronUp} onClick={() => callService('remote', 'send_command', ENTITIES.remotes.appleTV, { command: 'up' })} />
              <div />
              <RemoteButton icon={ChevronLeft} onClick={() => callService('remote', 'send_command', ENTITIES.remotes.appleTV, { command: 'left' })} />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                onClick={() => callService('remote', 'send_command', ENTITIES.remotes.appleTV, { command: 'select' })}
                className="h-16 w-16 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 border-2 border-gray-500/50 shadow-xl flex items-center justify-center hover:border-white/30 transition-all"
              >
                <Play className="h-6 w-6 text-white" />
              </motion.button>
              <RemoteButton icon={ChevronRight} onClick={() => callService('remote', 'send_command', ENTITIES.remotes.appleTV, { command: 'right' })} />
              <div />
              <RemoteButton icon={ChevronDown} onClick={() => callService('remote', 'send_command', ENTITIES.remotes.appleTV, { command: 'down' })} />
              <div />
            </div>
          </div>
          {/* App Shortcuts */}
          <div className="grid grid-cols-4 gap-2">
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => callService('media_player', 'select_source', ENTITIES.media.appleTV, { source: 'YouTube' })}
              className="py-3 rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white shadow-lg hover:shadow-xl border border-white/10 text-[11px] font-semibold"
            >
              YouTube
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => callService('media_player', 'select_source', ENTITIES.media.appleTV, { source: 'Netflix' })}
              className="py-3 rounded-xl bg-gradient-to-br from-red-700 to-red-900 text-white shadow-lg hover:shadow-xl border border-white/10 text-[11px] font-semibold"
            >
              Netflix
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => callService('media_player', 'select_source', ENTITIES.media.appleTV, { source: 'Disney+' })}
              className="py-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg hover:shadow-xl border border-white/10 text-[11px] font-semibold"
            >
              Disney+
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => callService('remote', 'send_command', ENTITIES.remotes.appleTV, { command: 'menu' })}
              className="py-3 rounded-xl bg-glass-bg border border-glass-border hover:border-white/20 text-white shadow-md hover:shadow-lg text-[11px] font-semibold flex items-center justify-center gap-1.5"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Back
            </motion.button>
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Hue Sync Box</h4>
        <div className="glass-panel rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <EntityButton icon={Power} label="Power" isActive={syncBoxPower} activeColor="green" onClick={() => toggleEntity('switch', ENTITIES.syncBox.power)} />
            <EntityButton icon={Zap} label="Sync" isActive={lightSync} activeColor="fuchsia" onClick={() => toggleEntity('switch', ENTITIES.syncBox.lightSync)} />
            <EntityButton icon={Film} label="Dolby" isActive={dolbyVision} activeColor="amber" onClick={() => toggleEntity('switch', ENTITIES.syncBox.dolbyVision)} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-2 block">Sync Mode: <span className="text-white font-medium capitalize">{syncMode}</span></span>
            <div className="grid grid-cols-3 gap-2">
              {['video', 'music', 'game'].map((mode) => (
                <motion.button
                  key={mode}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => callService('select', 'select_option', ENTITIES.syncBox.syncMode, { option: mode })}
                  className={cn(
                    'py-2.5 rounded-lg text-xs font-medium transition-all capitalize',
                    syncMode === mode
                      ? 'bg-neon-primary text-white shadow-lg shadow-neon-primary/30 border border-white/20'
                      : 'bg-glass-bg border border-glass-border text-muted-foreground hover:text-white hover:border-white/20'
                  )}
                >
                  {mode}
                </motion.button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-2 block">Intensity: <span className="text-amber-400 font-medium capitalize">{intensity}</span></span>
            <div className="grid grid-cols-4 gap-2">
              {['subtle', 'moderate', 'high', 'intense'].map((level) => (
                <motion.button
                  key={level}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => callService('select', 'select_option', ENTITIES.syncBox.intensity, { option: level })}
                  className={cn(
                    'py-2 rounded-lg text-[10px] font-medium transition-all capitalize',
                    intensity === level
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 border border-white/20'
                      : 'bg-glass-bg border border-glass-border text-muted-foreground hover:text-white hover:border-white/20'
                  )}
                >
                  {level}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sonos Volume</h4>
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setVolume(Math.max(0, sonosVolume - 5))}
              className="h-10 w-10 rounded-full bg-glass-bg border border-glass-border hover:border-white/20 flex items-center justify-center transition-all"
            >
              <Volume1 className="h-4 w-4" />
            </motion.button>
            <div className="flex-1 relative">
              <input
                type="range"
                min={0}
                max={100}
                value={sonosMuted ? 0 : sonosVolume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="w-full h-3 bg-glass-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-blue-500 [&::-webkit-slider-thumb]:to-cyan-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/30"
                style={{ background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(34 211 238) ${sonosMuted ? 0 : sonosVolume}%, rgba(255,255,255,0.15) ${sonosMuted ? 0 : sonosVolume}%)` }}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setVolume(Math.min(100, sonosVolume + 5))}
              className="h-10 w-10 rounded-full bg-glass-bg border border-glass-border hover:border-white/20 flex items-center justify-center transition-all"
            >
              <Volume2 className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center transition-all',
                sonosMuted
                  ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                  : 'bg-glass-bg border border-glass-border hover:border-white/20'
              )}
              title={sonosMuted ? 'Unmute' : 'Mute'}
            >
              {sonosMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </motion.button>
          </div>
          <div className="text-center mt-2 text-sm font-medium">{sonosMuted ? <span className="text-red-400">Muted</span> : `${sonosVolume}%`}</div>
        </div>
      </section>
    </>
  );
}

// ============ Climate Tab ============
function ClimateTab({ getState, getAttr, callService }: any) {
  const currentTemp = getAttr(ENTITIES.climate, 'current_temperature');
  const targetTemp = getAttr(ENTITIES.climate, 'temperature');
  const hvacMode = getState(ENTITIES.climate);
  const hvacAction = getAttr(ENTITIES.climate, 'hvac_action');

  const setClimateTemp = (temp: number) => callService('climate', 'set_temperature', ENTITIES.climate, { temperature: temp });

  return (
    <>
      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Thermostat</h4>
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-3xl font-bold">{currentTemp || '--'}°</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-2xl font-semibold text-neon-primary">{targetTemp || '--'}°</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mb-5">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setClimateTemp((targetTemp || 70) - 1)}
              className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center hover:border-blue-400/50 transition-all shadow-lg"
            >
              <ChevronDown className="h-7 w-7 text-blue-400" />
            </motion.button>
            <div className="flex flex-col items-center">
              <motion.div
                animate={hvacAction === 'heating' || hvacAction === 'cooling' ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Thermometer className={cn('h-10 w-10 mb-2', hvacAction === 'heating' && 'text-orange-500', hvacAction === 'cooling' && 'text-blue-500', hvacAction === 'idle' && 'text-muted-foreground')} />
              </motion.div>
              <span className={cn(
                'text-sm font-medium capitalize',
                hvacAction === 'heating' && 'text-orange-400',
                hvacAction === 'cooling' && 'text-blue-400',
                hvacAction === 'idle' && 'text-muted-foreground'
              )}>{hvacAction || hvacMode}</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setClimateTemp((targetTemp || 70) + 1)}
              className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-500/30 flex items-center justify-center hover:border-orange-400/50 transition-all shadow-lg"
            >
              <ChevronUp className="h-7 w-7 text-orange-400" />
            </motion.button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['off', 'heat', 'cool', 'auto'].map((mode) => (
              <motion.button
                key={mode}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => callService('climate', 'set_hvac_mode', ENTITIES.climate, { hvac_mode: mode })}
                className={cn(
                  'py-2.5 rounded-xl text-xs font-medium transition-all capitalize',
                  hvacMode === mode
                    ? 'bg-neon-primary text-white shadow-lg shadow-neon-primary/30 border border-white/20'
                    : 'bg-glass-bg border border-glass-border text-muted-foreground hover:text-white hover:border-white/20'
                )}
              >
                {mode}
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Blinds</h4>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <CoverControl label="Left Blind" state={getState(ENTITIES.covers.left)} onOpen={() => callService('cover', 'open_cover', ENTITIES.covers.left)} onClose={() => callService('cover', 'close_cover', ENTITIES.covers.left)} onStop={() => callService('cover', 'stop_cover', ENTITIES.covers.left)} />
            <CoverControl label="Right Blind" state={getState(ENTITIES.covers.right)} onOpen={() => callService('cover', 'open_cover', ENTITIES.covers.right)} onClose={() => callService('cover', 'close_cover', ENTITIES.covers.right)} onStop={() => callService('cover', 'stop_cover', ENTITIES.covers.right)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ActionButton icon={ChevronUp} label="All Open" gradient="from-emerald-500 to-green-600" onClick={() => callService('cover', 'open_cover', null, { entity_id: [ENTITIES.covers.left, ENTITIES.covers.right] })} />
            <ActionButton icon={Droplets} label="Privacy" gradient="from-orange-500 to-amber-600" onClick={() => callService('cover', 'set_cover_position', null, { entity_id: [ENTITIES.covers.left, ENTITIES.covers.right], position: 100 })} />
            <ActionButton icon={ChevronDown} label="All Closed" gradient="from-rose-500 to-pink-600" onClick={() => callService('cover', 'close_cover', null, { entity_id: [ENTITIES.covers.left, ENTITIES.covers.right] })} />
          </div>
        </div>
      </section>
    </>
  );
}

// ============ Reusable Components ============

function SceneButton({ icon: Icon, label, gradient, onClick, size = 'md' }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={cn(
        'rounded-xl bg-gradient-to-br text-white flex flex-col items-center justify-center gap-1.5 transition-all shadow-lg hover:shadow-xl',
        'active:shadow-md backdrop-blur-sm border border-white/10',
        gradient,
        size === 'sm' ? 'py-3 px-3 min-h-[52px]' : 'py-4 px-4 min-h-[64px]'
      )}
    >
      <Icon className={cn('drop-shadow-sm', size === 'sm' ? 'h-5 w-5' : 'h-6 w-6')} />
      <span className={cn('font-semibold tracking-wide', size === 'sm' ? 'text-[10px]' : 'text-xs')}>{label}</span>
    </motion.button>
  );
}

function EntityButton({ icon: Icon, label, isActive, activeColor = 'neon', onClick, fullWidth = false }: any) {
  const activeClasses: Record<string, string> = {
    cyan: 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/40',
    amber: 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/40',
    teal: 'bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/40',
    violet: 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/40',
    fuchsia: 'bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-fuchsia-500/40',
    orange: 'bg-gradient-to-br from-orange-500 to-red-600 shadow-orange-500/40',
    sky: 'bg-gradient-to-br from-sky-400 to-blue-500 shadow-sky-500/40',
    yellow: 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-yellow-500/40',
    green: 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/40',
    neon: 'bg-neon-primary shadow-neon-primary/40',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={cn(
        'rounded-xl py-3.5 px-4 flex items-center gap-3 transition-all min-h-[48px]',
        fullWidth && 'w-full justify-center',
        isActive
          ? `${activeClasses[activeColor]} text-white shadow-lg border border-white/20`
          : 'bg-glass-bg border border-glass-border text-muted-foreground hover:text-white hover:border-white/20 hover:bg-glass-border/50'
      )}
    >
      <motion.div
        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <Icon className={cn('h-5 w-5', isActive && 'drop-shadow-sm')} />
      </motion.div>
      <span className="text-sm font-medium">{label}</span>
    </motion.button>
  );
}

function ActionButton({ icon: Icon, label, gradient, onClick }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={cn(
        'rounded-xl py-3.5 px-4 bg-gradient-to-br text-white flex flex-col items-center justify-center gap-1.5 min-h-[56px]',
        'shadow-lg hover:shadow-xl active:shadow-md border border-white/10 backdrop-blur-sm',
        gradient
      )}
    >
      <Icon className="h-5 w-5 drop-shadow-sm" />
      <span className="text-[11px] font-semibold tracking-wide">{label}</span>
    </motion.button>
  );
}

function RemoteButton({ icon: Icon, label, onClick, size = 'md', color }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={cn(
        'rounded-xl flex items-center justify-center transition-all gap-1.5',
        size === 'lg' ? 'h-14 w-14 shadow-lg' : 'h-11 min-w-[44px]',
        label && !Icon && 'px-4',
        label && Icon && 'px-3',
        color
          ? `bg-gradient-to-br ${color} text-white shadow-md hover:shadow-lg border border-white/10`
          : 'bg-glass-bg border border-glass-border hover:bg-glass-border hover:border-white/20'
      )}
    >
      {Icon && <Icon className={cn(size === 'lg' ? 'h-6 w-6' : 'h-4 w-4')} />}
      {label && <span className="text-[11px] font-semibold">{label}</span>}
    </motion.button>
  );
}

function CoverControl({ label, state, onOpen, onClose, onStop }: any) {
  const isOpen = state === 'open';
  const isClosed = state === 'closed';
  
  return (
    <div className="glass-panel rounded-xl p-3">
      <p className="text-xs font-medium mb-1 text-center">{label}</p>
      <p className={cn(
        'text-[10px] text-center capitalize mb-3 font-medium',
        isOpen && 'text-emerald-400',
        isClosed && 'text-rose-400',
        !isOpen && !isClosed && 'text-muted-foreground'
      )}>{state}</p>
      <div className="flex justify-center gap-2">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onOpen}
          className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center transition-all',
            isOpen
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-glass-bg border border-glass-border hover:border-white/20'
          )}
        >
          <ChevronUp className="h-4 w-4" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onStop}
          className="h-9 w-9 rounded-lg flex items-center justify-center bg-glass-bg border border-glass-border hover:border-amber-500/50 hover:bg-amber-500/10 transition-all"
        >
          <Square className="h-3.5 w-3.5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center transition-all',
            isClosed
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'bg-glass-bg border border-glass-border hover:border-white/20'
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}

SmartHomeWidget.displayName = 'SmartHomeWidget';
