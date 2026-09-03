"use client";

import React, { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface LogoLoaderProps {
  size?: "sm" | "md" | "lg" | "fullscreen";
  label?: string;
  onComplete?: () => void;
}

export default function LogoLoader({ size = "md", onComplete }: LogoLoaderProps) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (size !== "fullscreen" || !onComplete) return;
    const timer = setTimeout(() => {
      onComplete();
    }, 1200);
    return () => clearTimeout(timer);
  }, [size, onComplete]);

  // Reduced motion accessible fallback
  if (prefersReducedMotion) {
    if (size === "fullscreen") {
      return (
        <div className="fixed inset-0 z-[9999] bg-[#09090B] flex items-center justify-center p-4">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500/50 border-t-indigo-500 animate-spin" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center p-2">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500/50 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  // Inline Loader (sm, md, lg)
  if (size !== "fullscreen") {
    return (
      <div className="flex items-center justify-center p-2">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
            className="w-7 h-7 rounded-full p-[1.5px] shadow-sm shadow-indigo-500/30"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0%, #6366f1 40%, #a855f7 70%, #10b981 100%)',
            }}
          >
            <div className="w-full h-full bg-[#09090B] rounded-full" />
          </motion.div>
          <motion.div
            animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.9, 0.3] }}
            transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
            className="absolute w-1.5 h-1.5 rounded-full bg-indigo-400"
          />
        </div>
      </div>
    );
  }

  // FULLSCREEN CONCEPT A: "The Eclipse Ring" (Pure Minimalist, Textless & Elegant)
  return (
    <div className="fixed inset-0 z-[9999] bg-[#09090B] text-white flex items-center justify-center overflow-hidden selection:bg-indigo-500">
      
      {/* Soft Breathing Radial Backdrop Aura */}
      <motion.div
        animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.12, 0.25, 0.12] }}
        transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
        className="absolute w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 rounded-full blur-[100px] pointer-events-none"
      />

      {/* Central Minimalist Eclipse Halo Ring */}
      <div className="relative z-10 flex items-center justify-center">
        
        {/* Outer Conic Halo Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[1.5px] shadow-2xl shadow-indigo-500/25"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0%, #6366f1 35%, #a855f7 70%, #10b981 100%)',
          }}
        >
          <div className="w-full h-full bg-[#09090B] rounded-full" />
        </motion.div>

        {/* Inner Breathing Core Pulse */}
        <motion.div
          animate={{ scale: [0.75, 1.25, 0.75], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
          className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-indigo-400 shadow-md shadow-indigo-400/60"
        />

      </div>

    </div>
  );
}
