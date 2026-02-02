'use client';

import { CloudSun } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import type { WeatherData } from '../types';

interface WeatherCardProps {
  weather: WeatherData;
  isOpen: boolean;
  onToggle: () => void;
}

export function WeatherCard({ weather, isOpen, onToggle }: WeatherCardProps) {
  return (
    <CollapsibleSection
      icon={<CloudSun className="w-4 h-4 text-cyan-400" />}
      title="Weather"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="flex items-center gap-4">
        <span className="text-2xl font-light text-white">
          {weather.temp}&deg;F
        </span>
        <div className="text-sm text-white/70">
          <p>{weather.condition}</p>
          <p className="text-xs text-white/50">
            H: {weather.high}&deg; L: {weather.low}&deg;
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
