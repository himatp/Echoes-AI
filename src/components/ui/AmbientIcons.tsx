"use client";

import React from "react";
import { motion } from "framer-motion";
import { Mic, CheckSquare, Video, Users, FileText, Activity } from "lucide-react";

/**
 * AmbientIcons Component
 * Reusable low-opacity floating background icons (icons only, no text labels).
 * Rendered behind splash screen and login page UI.
 */
export default function AmbientIcons() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Icon 1: Mic (High Upper-Left) */}
      <motion.div
        animate={{ x: [-8, 8, -8], y: [-12, 10, -12] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-4 left-5 opacity-10 sm:top-16 sm:left-12 text-indigo-400 block"
      >
        <Mic className="w-5 h-5 sm:w-9 sm:h-9" />
      </motion.div>

      {/* Icon 2: CheckSquare (Mid Upper-Right) */}
      <motion.div
        animate={{ x: [10, -10, 10], y: [-8, 14, -8] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-8 right-6 opacity-12 sm:top-20 sm:right-16 text-indigo-400 block"
      >
        <CheckSquare className="w-5 h-5 sm:w-10 sm:h-10" />
      </motion.div>

      {/* Icon 3: Video (Lower-Left) */}
      <motion.div
        animate={{ x: [-12, 10, -12], y: [10, -10, 10] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-10 left-6 opacity-10 sm:bottom-24 sm:left-16 text-indigo-400 block"
      >
        <Video className="w-5 h-5 sm:w-9 sm:h-9" />
      </motion.div>

      {/* Icon 4: Users (Lowest Bottom-Right) */}
      <motion.div
        animate={{ x: [8, -12, 8], y: [-14, 8, -14] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-5 right-4 opacity-12 sm:bottom-28 sm:right-20 text-indigo-400 block"
      >
        <Users className="w-5 h-5 sm:w-10 sm:h-10" />
      </motion.div>

      {/* Icon 5: FileText (Mid-Upper Left Edge) */}
      <motion.div
        animate={{ x: [-10, 8, -10], y: [-6, 10, -6] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[35%] left-4 opacity-10 lg:top-1/2 lg:left-8 text-indigo-400 block"
      >
        <FileText className="w-4 h-4 lg:w-8 lg:h-8" />
      </motion.div>

      {/* Icon 6: Activity (Mid-Lower Right Edge) */}
      <motion.div
        animate={{ x: [12, -8, 12], y: [8, -12, 8] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[60%] right-4 opacity-12 lg:top-1/2 lg:right-10 text-indigo-400 block"
      >
        <Activity className="w-4 h-4 lg:w-8 lg:h-8" />
      </motion.div>
    </div>
  );
}
