"use client";

interface SessionInfoProps {
  sessionId: string | null;
  duration: number;
  participantCount: number;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function SessionInfo({ sessionId, duration, participantCount }: SessionInfoProps) {
  return (
    <div className="grid grid-cols-3 divide-x divide-zinc-100 border border-zinc-100 rounded-2xl overflow-hidden bg-white">
      <InfoCell
        label="Duration"
        value={duration > 0 ? formatDuration(duration) : "—"}
        highlight={duration > 0}
      />
      <InfoCell
        label="Participants"
        value={participantCount > 0 ? String(participantCount + 1) : "—"}
      />
      <InfoCell
        label="Session ID"
        value={sessionId ? sessionId.slice(0, 8) + "…" : "—"}
        mono
      />
    </div>
  );
}

function InfoCell({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col items-center py-4 px-3 gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
      <span
        className={[
          "text-sm font-bold",
          highlight ? "text-red-600" : "text-zinc-800",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
