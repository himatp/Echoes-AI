"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mic, CheckSquare, Video, Users, FileText, Activity } from "lucide-react";

interface LogoLoaderProps {
  size?: "sm" | "md" | "lg" | "fullscreen";
  label?: string;
  onComplete?: () => void;
}

const LETTERS = ["E", "c", "h", "o", "e", "s"];

export default function LogoLoader({ size = "md", label, onComplete }: LogoLoaderProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showAmbient, setShowAmbient] = useState(false);

  useEffect(() => {
    if (size !== "fullscreen") return;

    // Sequence 1: Ambient background elements fade in at 0.8s after text settles
    const ambientTimer = setTimeout(() => {
      setShowAmbient(true);
    }, 800);

    // Sequence 2: Hard gate completed trigger at 3.5s total duration (snappy reveal + extended hold)
    const completeTimer = setTimeout(() => {
      if (onComplete) {
        console.log("[LogoLoader Splash] 3.5s splash animation & extended hold complete. Firing onComplete hard gate.");
        onComplete();
      }
    }, 3500);

    return () => {
      clearTimeout(ambientTimer);
      clearTimeout(completeTimer);
    };
  }, [size, onComplete]);

  // REDUCED MOTION ACCESSIBILITY BRANCH
  if (prefersReducedMotion) {
    if (size === "fullscreen") {
      return (
        <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center p-4">
          <h1 className="text-4xl sm:text-6xl font-semibold text-zinc-100 tracking-[0.012em]">Echoes</h1>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-3">
        <span className="text-xl font-semibold text-zinc-100 tracking-[0.012em]">Echoes</span>
        {label && <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>}
      </div>
    );
  }

  // INLINE LOADER (sm, md, lg) — Clean branded spinner for async waits
  if (size !== "fullscreen") {
    return (
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 animate-pulse">
          <span className="text-white font-extrabold text-xl tracking-tighter">E</span>
        </div>
        {label && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 animate-pulse">{label}</p>
        )}
      </div>
    );
  }

  // Motion variants for deliberate, smooth 3.5s total splash sequence
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08, // 80ms stagger between letters for deliberate, premium reveal
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

  // FULLSCREEN REFINED TEXT SPLASH SCENE (1.5s TOTAL TIMING)
  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 text-white flex flex-col items-center justify-center overflow-hidden selection:bg-indigo-500">
      
      {/* Soft Centered Radial Indigo Glow Behind Text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] sm:w-[600px] sm:h-[600px] bg-gradient-to-tr from-indigo-900/20 via-indigo-950/10 to-transparent rounded-full blur-[130px] pointer-events-none" />

      {/* AMBIENT BACKGROUND ELEMENTS (Sequenced to fade in at 0.5s) */}
      {showAmbient && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          {/* Floating Product Feature Icons (Low Opacity 10-12%, Slow Independent Drift) */}
          <motion.div
            animate={{ x: [-8, 8, -8], y: [-12, 10, -12] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-16 left-12 text-indigo-400 opacity-10 hidden sm:block"
          >
            <Mic className="w-9 h-9" />
          </motion.div>

          <motion.div
            animate={{ x: [10, -10, 10], y: [-8, 14, -8] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 right-16 text-indigo-400 opacity-12 hidden sm:block"
          >
            <CheckSquare className="w-10 h-10" />
          </motion.div>

          <motion.div
            animate={{ x: [-12, 10, -12], y: [10, -10, 10] }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-24 left-16 text-indigo-400 opacity-10 hidden sm:block"
          >
            <Video className="w-9 h-9" />
          </motion.div>

          <motion.div
            animate={{ x: [8, -12, 8], y: [-14, 8, -14] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-28 right-20 text-indigo-400 opacity-12 hidden sm:block"
          >
            <Users className="w-10 h-10" />
          </motion.div>

          <motion.div
            animate={{ x: [-10, 8, -10], y: [-6, 10, -6] }}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-8 -translate-y-1/2 text-indigo-400 opacity-10 hidden lg:block"
          >
            <FileText className="w-8 h-8" />
          </motion.div>

          <motion.div
            animate={{ x: [12, -8, 12], y: [8, -12, 8] }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 right-10 -translate-y-1/2 text-indigo-400 opacity-12 hidden lg:block"
          >
            <Activity className="w-8 h-8" />
          </motion.div>

          {/* Faded Background Product Feature Phrases (Faint Opacity 6%) */}
          <div className="absolute top-1/4 left-1/4 text-[11px] font-mono tracking-widest text-zinc-500 opacity-6 uppercase hidden md:block">
            Live Transcription
          </div>
          <div className="absolute top-1/3 right-1/4 text-[11px] font-mono tracking-widest text-zinc-500 opacity-6 uppercase hidden md:block">
            Task Extraction
          </div>
          <div className="absolute bottom-1/3 left-1/3 text-[11px] font-mono tracking-widest text-zinc-500 opacity-6 uppercase hidden md:block">
            Meeting Health Score
          </div>
          <div className="absolute bottom-1/4 right-1/3 text-[11px] font-mono tracking-widest text-zinc-500 opacity-6 uppercase hidden md:block">
            Multi-tenant RLS
          </div>
        </motion.div>
      )}

      {/* CENTRAL REFINED TEXT ANIMATION SCENE */}
      <div className="relative z-10 flex flex-col items-center justify-center">
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
