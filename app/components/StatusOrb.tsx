"use client";

import { CallStatus } from "@/app/hooks/useVoiceCall";

interface StatusOrbProps {
  status: CallStatus;
  agentJoined: boolean;
}

export function StatusOrb({ status, agentJoined }: StatusOrbProps) {
  const isActive = status === "connected";
  const isConnecting = status === "connecting" || status === "requesting";

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Orb */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        {isActive && (
          <span className="absolute inline-flex h-36 w-36 rounded-full bg-red-500/20 animate-ping" />
        )}

        {/* Main orb */}
        <div
          className={[
            "relative flex items-center justify-center w-28 h-28 rounded-full transition-all duration-500",
            isActive
              ? "bg-black animate-pulse-ring shadow-[0_0_40px_rgba(220,38,38,0.4)]"
              : isConnecting
              ? "bg-zinc-800"
              : status === "error"
              ? "bg-red-50 border-2 border-red-500"
              : "bg-zinc-100 border border-zinc-200 animate-pulse-ring-idle",
          ].join(" ")}
        >
          {/* Inner icon */}
          {isConnecting ? (
            <svg
              className="w-10 h-10 text-white animate-connecting"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
              <circle cx="12" cy="12" r="4" strokeOpacity={0.4} />
            </svg>
          ) : isActive ? (
            <WaveVisualizer />
          ) : status === "error" ? (
            <svg className="w-10 h-10 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          ) : (
            <MicIcon />
          )}
        </div>
      </div>

      {/* Agent presence */}
      {isActive && (
        <div className="flex items-center gap-2">
          <span
            className={[
              "inline-block w-2 h-2 rounded-full",
              agentJoined ? "bg-red-500 animate-pulse" : "bg-zinc-300",
            ].join(" ")}
          />
          <span className="text-xs font-medium tracking-wide uppercase text-zinc-500">
            {agentJoined ? "Agent active" : "Waiting for agent…"}
          </span>
        </div>
      )}
    </div>
  );
}

function WaveVisualizer() {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {[1, 1, 1, 1, 1, 1, 1].map((_, i) => (
        <div
          key={i}
          className="wave-bar w-[3px] bg-white rounded-full"
          style={{ height: "100%" }}
        />
      ))}
    </div>
  );
}

function MicIcon() {
  return (
    <svg className="w-10 h-10 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}
