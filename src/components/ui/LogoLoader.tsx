"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import AmbientIcons from "@/components/ui/AmbientIcons";

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

  // FULLSCREEN REFINED TEXT SPLASH SCENE
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
