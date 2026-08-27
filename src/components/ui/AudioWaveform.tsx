"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface AudioWaveformProps {
  isRecording?: boolean;
  barCount?: number;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording = true,
  barCount = 16,
  className = '',
}) => {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <div className={`flex items-center gap-1 h-8 ${className}`}>
      {bars.map((bar) => {
        const duration = 0.6 + (bar % 5) * 0.15;
        const delay = (bar % 4) * 0.1;
        return (
          <motion.div
            key={bar}
            className="w-1 bg-indigo-500 rounded-full"
            animate={
              isRecording
                ? {
                    height: ['20%', '90%', '35%', '100%', '20%'],
                  }
                : { height: '20%' }
            }
            transition={{
              duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay,
            }}
            style={{ height: '20%' }}
          />
        );
      })}
    </div>
  );
};
