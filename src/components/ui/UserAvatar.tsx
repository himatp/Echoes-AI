"use client";

import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  sizeClassName?: string;
  textSizeClassName?: string;
  className?: string;
  onClick?: () => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  sizeClassName = "w-9 h-9",
  textSizeClassName = "text-sm",
  className = "",
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  const initial = (name || 'U')[0].toUpperCase();

  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={name || "Profile"}
        onError={() => setImageError(true)}
        onClick={onClick}
        className={`${sizeClassName} rounded-full object-cover ring-2 ring-white dark:ring-zinc-800 shadow-md shadow-indigo-500/20 transition-all duration-150 hover:scale-105 cursor-pointer ${className}`}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${sizeClassName} rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 ring-2 ring-white dark:ring-zinc-800 shadow-md shadow-indigo-500/20 flex items-center justify-center text-white font-semibold ${textSizeClassName} transition-all duration-150 hover:scale-105 cursor-pointer ${className}`}
    >
      {initial}
    </div>
  );
};
