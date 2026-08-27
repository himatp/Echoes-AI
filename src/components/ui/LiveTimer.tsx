"use client";

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface LiveTimerProps {
  initialSeconds?: number;
  isRunning?: boolean;
  className?: string;
  label?: string;
}

export const LiveTimer: React.FC<LiveTimerProps> = ({
  initialSeconds = 0,
  isRunning = true,
  className = '',
  label = 'ACTIVE RECORDING'
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium tracking-wide shadow-sm border border-zinc-700/50 ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
      </span>
      <Clock className="w-3.5 h-3.5 text-zinc-300" />
      <span className="font-mono font-bold text-zinc-100">{formatTime(seconds)}</span>
      {label && <span className="text-[10px] uppercase font-semibold text-zinc-400 border-l border-zinc-700 pl-2">{label}</span>}
    </div>
  );
};
