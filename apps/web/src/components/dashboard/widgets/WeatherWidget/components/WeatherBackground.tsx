'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getWeatherBackground, getWeatherEmoji } from '@/lib/utils/weather';

interface WeatherBackgroundProps {
  condition: string;
  isDay?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function WeatherBackground({ 
  condition, 
  isDay = true, 
  children,
  className 
}: WeatherBackgroundProps) {
  // Add error handling
  let background;
  let emoji;
  
  try {
    background = getWeatherBackground(condition, isDay);
    emoji = getWeatherEmoji(condition);
  } catch (error) {
    // Fallback to default
    background = { gradient: 'from-gray-400 via-gray-300 to-gray-200', particles: 'none' as const, intensity: 'medium' as const };
    emoji = '☁️';
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Gradient Background */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br transition-all duration-1000',
        background?.gradient || 'from-gray-400 via-gray-300 to-gray-200'
      )} />

      {/* Weather Particles */}
      {background?.particles === 'rain' && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-0.5 h-4 bg-white/30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
              }}
              animate={{
                y: ['0vh', '120vh'],
              }}
              transition={{
                duration: 0.5 + Math.random() * 0.5,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: 'linear',
              }}
            />
          ))}
        </div>
      )}

      {background?.particles === 'snow' && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-80"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
              }}
              animate={{
                y: ['0vh', '120vh'],
                x: ['-10px', '10px', '-10px'],
              }}
              transition={{
                y: {
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 3,
                  ease: 'linear',
                },
                x: {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
            />
          ))}
        </div>
      )}

      {/* Weather Icon */}
      <div className="absolute top-4 right-4 text-4xl opacity-20">
        {emoji}
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
