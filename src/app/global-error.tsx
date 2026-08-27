"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-[#F7F7F9] font-sans antialiased text-zinc-900">
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-lg border border-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Application Error</h2>
            <p className="text-xs text-zinc-500 mb-6 font-medium">
              {error?.message || "A global error occurred."}
            </p>
            <button
              onClick={() => reset()}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs"
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
