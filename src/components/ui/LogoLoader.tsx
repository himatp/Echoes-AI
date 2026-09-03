"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import AmbientIcons from "@/components/ui/AmbientIcons";

interface LogoLoaderProps {
  size?: "sm" | "md" | "lg" | "fullscreen";
  variant?: "splash" | "minimal";
  label?: string;
  onComplete?: () => void;
}

const LETTERS = ["E", "c", "h", "o", "e", "s"];

export default function LogoLoader({
  size = "md",
  variant = "splash",
  label,
  onComplete,
}: LogoLoaderProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showAmbient, setShowAmbient] = useState(false);

  useEffect(() => {
    if (size !== "fullscreen" || variant !== "splash") return;

    const ambientTimer = setTimeout(() => {
      setShowAmbient(true);
    }, 800);

    const duration = prefersReducedMotion ? 500 : 2500;
    const completeTimer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, duration);

    return () => {
      clearTimeout(ambientTimer);
      clearTimeout(completeTimer);
    };
  }, [size, variant, onComplete, prefersReducedMotion]);

  // Reduced motion accessible fallback
  if (prefersReducedMotion) {
    if (size === "fullscreen") {
      return (
        <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center p-4">
          <h1 className="text-4xl sm:text-6xl font-semibold text-zinc-100 tracking-[0.012em]">Echoes</h1>
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

  // FULLSCREEN VARIANT 1: Minimalist Eclipse Ring (For Page Refreshes to hide 1-1.5s flicker)
  if (variant === "minimal") {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#09090B] text-white flex items-center justify-center overflow-hidden selection:bg-indigo-500">
        <motion.div
          animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.12, 0.25, 0.12] }}
          transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
          className="absolute w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 rounded-full blur-[100px] pointer-events-none"
        />

        <div className="relative z-10 flex items-center justify-center">
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

          <motion.div
            animate={{ scale: [0.75, 1.25, 0.75], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
            className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-indigo-400 shadow-md shadow-indigo-400/60"
          />
        </div>
      </div>
    );
  }

  // FULLSCREEN VARIANT 2: EXACT AUG 29 SPLASH SCREEN (Commit 4d2d911)
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.15,
      },
    },
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 text-white flex flex-col items-center justify-center overflow-hidden selection:bg-indigo-500">
      
      {/* Soft Centered Radial Indigo Glow Behind Text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] sm:w-[600px] sm:h-[600px] bg-gradient-to-tr from-indigo-900/20 via-indigo-950/10 to-transparent rounded-full blur-[100px] sm:blur-[130px] pointer-events-none" />

      {/* AMBIENT BACKGROUND ELEMENTS (Sequenced to fade in at 0.8s) */}
      {showAmbient && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          {/* Shared Ambient Floating Icons (Icons only) */}
          <AmbientIcons />

          {/* ALL 4 Faded Feature Phrases (Splash Screen Exclusive) */}
          <div className="absolute top-[18%] left-6 text-[8px] md:top-1/4 md:left-1/4 md:text-[11px] font-mono tracking-widest text-zinc-500 opacity-6 uppercase block">
            Live Transcription
          </div>
          <div className="absolute top-[25%] right-5 text-[8px] md:top-1/3 md:right-1/4 md:text-[11px] font-mono tracking-widest text-zinc-500 opacity-6 uppercase block">
            Task Extraction
          </div>
          <div className="absolute bottom-[27%] left-5 text-[8px] md:bottom-1/3 md:left-1/3 md:text-[11px] font-mono tracking-widest text-zinc-500 opacity-6 uppercase block">
            Meeting Health Score
          </div>
          <div className="absolute bottom-[20%] right-6 text-[8px] md:bottom-1/4 md:right-1/3 md:text-[11px] font-mono tracking-widest text-zinc-500 opacity-6 uppercase block">
            Multi-tenant RLS
          </div>
        </motion.div>
      )}

      {/* CENTRAL REFINED TEXT ANIMATION SCENE */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4">
        {/* Soft Outer Glow Pulse Container */}
        <motion.div
          initial={{ scale: 1, filter: "brightness(1) drop-shadow(0 0 20px rgba(79,70,229,0.35))" }}
          animate={{
            scale: [1, 1, 1.02, 1],
            filter: [
              "brightness(1) drop-shadow(0 0 20px rgba(79,70,229,0.35))",
              "brightness(1) drop-shadow(0 0 20px rgba(79,70,229,0.35))",
              "brightness(1.18) drop-shadow(0 0 34px rgba(99,102,241,0.65))",
              "brightness(1) drop-shadow(0 0 24px rgba(79,70,229,0.4))",
            ],
          }}
          transition={{
            duration: 0.9,
            times: [0, 0.3, 0.6, 1],
            ease: "easeInOut",
          }}
          className="flex items-center"
        >
          {/* Staggered Letter Reveal */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center space-x-[1px]"
          >
            {LETTERS.map((char, index) => (
              <motion.span
                key={index}
                variants={letterVariants}
                className="text-4xl sm:text-6xl font-semibold tracking-[0.012em] text-zinc-100 select-none font-sans"
              >
                {char}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </div>

    </div>
  );
}
