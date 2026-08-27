"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Root Error Boundary Caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F7F7F9] flex items-center justify-center p-6 text-center">
      <div className="card-white p-8 max-w-md w-full shadow-card">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
          !
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
        <p className="text-xs text-zinc-500 mb-6 font-medium">
          {error?.message || "An unexpected error occurred while rendering the page."}
        </p>
        <button
          onClick={() => reset()}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-hero transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
