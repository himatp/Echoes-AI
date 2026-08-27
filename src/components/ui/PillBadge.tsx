import React from 'react';
import { Priority } from '@/types';

interface PillBadgeProps {
  label?: string;
  priority?: Priority;
  variant?: 'priority' | 'status' | 'tag' | 'ai';
  size?: 'sm' | 'md';
  className?: string;
}

export const PillBadge: React.FC<PillBadgeProps> = ({
  label,
  priority,
  variant = 'priority',
  size = 'md',
  className = '',
}) => {
  const getPriorityStyle = (p?: Priority) => {
    switch (p) {
      case 'urgent':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-amber-500 text-white';
      case 'medium':
        return 'bg-sky-500 text-white';
      case 'low':
        return 'bg-emerald-500 text-white';
      default:
        return 'bg-zinc-700 text-white';
    }
  };

  const getVariantStyle = () => {
    if (variant === 'priority' && priority) {
      return getPriorityStyle(priority);
    }
    if (variant === 'ai') {
      return 'bg-indigo-600 text-white shadow-sm';
    }
    if (variant === 'tag') {
      return 'bg-zinc-200 text-zinc-700 font-medium';
    }
    return 'bg-zinc-100 text-zinc-800 border border-zinc-200';
  };

  const sizeStyle = size === 'sm' ? 'px-2 py-0.5 text-xs font-semibold' : 'px-2.5 py-1 text-xs font-semibold';

  const textLabel = label || (priority ? priority.toUpperCase() : '');

  return (
    <span className={`inline-flex items-center rounded-full tracking-wide transition-all ${sizeStyle} ${getVariantStyle()} ${className}`}>
      {textLabel}
    </span>
  );
};
