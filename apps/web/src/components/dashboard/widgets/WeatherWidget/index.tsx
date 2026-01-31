'use client';

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, Wind, Sunrise, Sunset, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWeatherData, useTemperatureConversion } from './hooks';
import {
  WidgetHeader,
  CurrentWeather,
  WeatherMetric,
  ForecastStrip,
  WeatherBackground,
} from './components';
import { WeatherCommandCenter } from './expanded';
import { isDay } from '@/lib/utils/weather';
import { CONDITION_GRADIENTS } from './constants';
import type { WeatherWidgetProps, TemperatureUnit } from './types';

export function WeatherWidget({
  location,
  lat,
  lon,
  unit: initialUnit = 'fahrenheit',
  showForecast = true,
  colSpan = 2,
  rowSpan = 2,
  className,
}: WeatherWidgetProps) {
  const [unit, setUnit] = useState<TemperatureUnit>(initialUnit);
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading, isRefreshing, error, lastUpdated, refresh } = useWeatherData({
    location,
    lat,
    lon,
    showForecast,
    extended: true,
    includeHourly: true,
    includeAlerts: true,
    includeAirQuality: true,
  });

  const { convertTemp } = useTemperatureConversion(unit);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleUnitChange = useCallback((newUnit: TemperatureUnit) => {
    setUnit(newUnit);
  }, []);

  const isDaytime = data?.current?.sunrise && data?.current?.sunset
    ? isDay(
        typeof data.current.sunrise === 'number' ? data.current.sunrise : parseInt(data.current.sunrise),
        typeof data.current.sunset === 'number' ? data.current.sunset : parseInt(data.current.sunset)
      )
    : true;

  const colSpanClasses: Record<number, string> = {
    1: 'col-span-1',
    2: 'col-span-1 md:col-span-2',
    3: 'col-span-1 md:col-span-3',
    4: 'col-span-1 md:col-span-4',
  };

  const rowSpanClasses: Record<number, string> = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
    4: 'row-span-4',
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'surface-matte relative overflow-hidden w-full',
          colSpanClasses[colSpan],
          rowSpanClasses[rowSpan],
          className
        )}
      >
        {/* Loading State */}
        {isLoading && (
          <div className="relative h-full flex items-center justify-center p-4">
            <RefreshCw className="h-8 w-8 animate-spin text-text-muted" />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="relative h-full flex items-center justify-center p-4">
            <div className="empty-state">
              <AlertTriangle className="empty-state-icon text-warning" />
              <p className="empty-state-title">Unable to load weather</p>
              <p className="empty-state-description">{error}</p>
              <button onClick={refresh} className="btn-ghost focus-ring mt-2">
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Weather Data with Dynamic Background */}
        {data && !isLoading && !error && (
          <WeatherBackground
            condition={data.current.condition}
            isDay={isDaytime}
            className="h-full"
          >
            <div className="flex flex-col p-4">
              {/* Header with Location & Refresh */}
              <WidgetHeader
                cityName={data.current.cityName}
                onRefresh={refresh}
                onExpand={toggleExpanded}
                isRefreshing={isRefreshing}
                lastUpdated={lastUpdated}
              />

              {/* Current Weather */}
              <div className="mb-4">
                <CurrentWeather
                  current={data.current}
                  unit={unit}
                  convertTemp={convertTemp}
                />
              </div>

              {/* Weather Details Grid */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <WeatherMetric
                  icon={Droplets}
                  label="Humidity"
                  value={data.current.humidity}
                  unit="%"
                  color="text-info"
                />
                <WeatherMetric
                  icon={Wind}
                  label="Wind"
                  value={Math.round(data.current.windSpeed)}
                  unit="mph"
                  color="text-success"
                />
                <WeatherMetric
                  icon={Sunrise}
                  label="Sunrise"
                  value={data.current.sunrise}
                  color="text-warning"
                />
                <WeatherMetric
                  icon={Sunset}
                  label="Sunset"
                  value={data.current.sunset}
                  color="text-neon-primary"
                />
              </div>

              {/* 5-Day Forecast */}
              {showForecast && data.forecast && data.forecast.length > 0 && (
                <ForecastStrip
                  forecast={data.forecast}
                  unit={unit}
                  convertTemp={convertTemp}
                />
              )}

              {/* High/Low for Today */}
              <div className="flex items-center justify-center gap-4 mt-2 text-caption">
                <span>H: {convertTemp(data.current.tempMax)}°</span>
                <span>L: {convertTemp(data.current.tempMin)}°</span>
              </div>
            </div>
          </WeatherBackground>
        )}
      </motion.div>

      {/* Expanded WeatherCommandCenter - Portal to body */}
      {typeof document !== 'undefined' &&
        data &&
        createPortal(
          <AnimatePresence>
            {isExpanded && (
              <WeatherCommandCenter
                onClose={toggleExpanded}
                data={data}
                unit={unit}
                onUnitChange={handleUnitChange}
                onRefresh={refresh}
                isRefreshing={isRefreshing}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

WeatherWidget.displayName = 'WeatherWidget';

export default WeatherWidget;

export type { WeatherWidgetProps } from './types';
