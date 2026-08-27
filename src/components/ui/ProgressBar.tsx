"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number; // 0 - 100
  label?: string;
  sublabel?: string;
  showPercentage?: boolean;
  barColor?: string;
  height?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  sublabel,
  showPercentage = true,
  barColor = 'bg-indigo-600',
  height = 'h-2.5',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1.5 text-xs font-semibold text-zinc-700">
          <span className="flex items-center gap-1.5">
            {label}
            {sublabel && <span className="text-zinc-400 font-normal">({sublabel})</span>}
          </span>
          {showPercentage && <span className="text-zinc-900 font-bold">{Math.round(clampedValue)}%</span>}
        </div>
      )}
      <div className={`w-full bg-zinc-100 rounded-full overflow-hidden ${height} border border-zinc-200/60 p-0.5`}>
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
};
