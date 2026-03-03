"use client";

import { CallStatus } from "@/app/hooks/useVoiceCall";

const STATUS_CONFIG: Record<CallStatus, { label: string; dot: string; text: string; bg: string }> = {
  idle:          { label: "Ready",        dot: "bg-zinc-300",   text: "text-zinc-500",  bg: "bg-zinc-50 border border-zinc-200" },
  requesting:    { label: "Requesting…",  dot: "bg-zinc-400 animate-pulse",  text: "text-zinc-600",  bg: "bg-zinc-50 border border-zinc-200" },
  connecting:    { label: "Connecting…",  dot: "bg-amber-400 animate-pulse", text: "text-amber-700",  bg: "bg-amber-50 border border-amber-200" },
  connected:     { label: "Live",         dot: "bg-red-500 animate-pulse",   text: "text-red-700",    bg: "bg-red-50 border border-red-200" },
  disconnecting: { label: "Ending…",      dot: "bg-zinc-400 animate-pulse",  text: "text-zinc-500",  bg: "bg-zinc-50 border border-zinc-200" },
  error:         { label: "Error",        dot: "bg-red-600",   text: "text-red-700",    bg: "bg-red-50 border border-red-300" },
};

interface StatusBadgeProps {
  status: CallStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
