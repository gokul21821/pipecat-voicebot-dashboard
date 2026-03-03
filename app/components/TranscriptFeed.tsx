"use client";

import { useEffect, useRef } from "react";
import { TranscriptEntry } from "@/app/hooks/useVoiceCall";

interface TranscriptFeedProps {
  transcripts: TranscriptEntry[];
}

export function TranscriptFeed({ transcripts }: TranscriptFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  if (transcripts.length === 0) {
    return (
      <div className="w-full h-full min-h-[200px] border border-zinc-100 rounded-2xl bg-white p-6 text-center text-sm text-zinc-400 flex items-center justify-center">
        Transcripts will appear here once the conversation starts…
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[200px] border border-zinc-100 rounded-2xl bg-white overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center gap-2 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Live Transcript
        </span>
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1 min-h-0 overflow-y-auto">
        {transcripts.map((entry) => (
          <div
            key={entry.id}
            className={[
              "flex gap-2 items-start",
              entry.speaker === "user" ? "flex-row-reverse" : "flex-row",
            ].join(" ")}
          >
            {/* Speaker label */}
            <span
              className={[
                "shrink-0 text-[9px] font-bold uppercase tracking-widest mt-0.5",
                entry.speaker === "user" ? "text-zinc-400" : "text-red-500",
              ].join(" ")}
            >
              {entry.speaker === "user" ? "You" : "Bot"}
            </span>

            {/* Bubble */}
            <span
              className={[
                "text-sm leading-relaxed px-3 py-2 rounded-xl max-w-[90%]",
                entry.final ? "opacity-100" : "opacity-60 italic",
                entry.speaker === "user"
                  ? "bg-zinc-100 text-zinc-700 rounded-tr-sm"
                  : "bg-black text-white rounded-tl-sm",
              ].join(" ")}
            >
              {entry.text}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
