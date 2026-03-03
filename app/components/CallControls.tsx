"use client";

import { CallStatus } from "@/app/hooks/useVoiceCall";

interface CallControlsProps {
  status: CallStatus;
  isMuted: boolean;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

export function CallControls({
  status,
  isMuted,
  onStart,
  onEnd,
  onToggleMute,
}: CallControlsProps) {
  const isIdle = status === "idle" || status === "error";
  const isActive = status === "connected";
  const isConnecting = status === "connecting" || status === "requesting" || status === "disconnecting";

  if (isIdle) {
    return (
      <button
        onClick={onStart}
        className="group flex items-center gap-3 px-8 py-4 bg-black text-white font-semibold rounded-full text-sm tracking-wide transition-all duration-200 hover:bg-zinc-800 hover:shadow-lg hover:shadow-black/20 active:scale-95 cursor-pointer"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 group-hover:scale-110 transition-transform" />
        Start Session
      </button>
    );
  }

  if (isConnecting) {
    return (
      <button
        disabled
        className="flex items-center gap-3 px-8 py-4 bg-zinc-100 text-zinc-400 font-semibold rounded-full text-sm tracking-wide cursor-not-allowed"
      >
        <svg className="w-4 h-4 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
        {status === "disconnecting" ? "Ending…" : "Connecting…"}
      </button>
    );
  }

  if (isActive) {
    return (
      <div className="flex items-center gap-3">
        {/* Mute button */}
        <button
          onClick={onToggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className={[
            "flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 active:scale-95 cursor-pointer",
            isMuted
              ? "border-red-500 bg-red-50 text-red-500"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50",
          ].join(" ")}
        >
          {isMuted ? <MicOffIcon /> : <MicOnIcon />}
        </button>

        {/* End call button */}
        <button
          onClick={onEnd}
          className="flex items-center gap-3 px-8 py-4 bg-red-600 text-white font-semibold rounded-full text-sm tracking-wide transition-all duration-200 hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/25 active:scale-95 cursor-pointer"
        >
          <PhoneDownIcon />
          End Session
        </button>
      </div>
    );
  }

  return null;
}

function MicOnIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M9 9v3a3 3 0 005.12 2.12M15 9.34V4.5a3 3 0 00-5.94-.6M17.25 12.75a6 6 0 01-11.93 1.04M12 18.75v3.75m-3.75 0h7.5" />
    </svg>
  );
}

function PhoneDownIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.44 6.44C4.34 8.32 3 11.01 3 14c0 .53.04 1.05.12 1.56m2.02 3.38c1.56 1.06 3.44 1.68 5.47 1.68 2.03 0 3.9-.61 5.46-1.67m0 0A8.96 8.96 0 0021 14c0-2.99-1.34-5.68-3.44-7.56M16.5 16.5l-3-3m0 0l-3-3m3 3l3-3m-3 3l-3 3" />
    </svg>
  );
}
