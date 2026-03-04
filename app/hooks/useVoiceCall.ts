"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = lo + 1;
  const frac = idx - lo;
  if (hi >= sorted.length) return sorted[lo];
  return sorted[lo] + frac * (sorted[hi] - sorted[lo]);
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function maybeSecondsToMs(value: number): number {
  // Pipecat MetricsFrame timings are typically in seconds.
  return value < 20 ? Math.round(value * 1000) : Math.round(value);
}

function extractProviderName(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const obj = item as Record<string, unknown>;
  const processor = typeof obj.processor === "string" ? obj.processor : "";
  const model = typeof obj.model === "string" ? obj.model : "";
  return `${processor} ${model}`.toLowerCase();
}

function extractUsageAndTtfb(data: Record<string, unknown>): {
  llmTokens: number;
  llmPromptTokens: number;
  llmCompletionTokens: number;
  ttsChars: number;
  llmTtfbMs: number[];
  ttsTtfbMs: number[];
  llmProcessingMs: number[];
  ttsProcessingMs: number[];
} {
  let llmTokens = 0;
  let llmPromptTokens = 0;
  let llmCompletionTokens = 0;
  let ttsChars = 0;
  const llmTtfbMs: number[] = [];
  const ttsTtfbMs: number[] = [];
  const llmProcessingMs: number[] = [];
  const ttsProcessingMs: number[] = [];

  const directPrompt = toNumber(data.prompt_tokens);
  const directCompletion = toNumber(data.completion_tokens);
  const directChars = toNumber(data.tts_characters);
  const directLlmTtfbMs = toNumber(data.llm_ttfb_ms);
  const directTtsTtfbMs = toNumber(data.tts_ttfb_ms);
  if (directPrompt) {
    llmPromptTokens += directPrompt;
    llmTokens += directPrompt;
  }
  if (directCompletion) {
    llmCompletionTokens += directCompletion;
    llmTokens += directCompletion;
  }
  if (directChars) ttsChars += directChars;
  if (directLlmTtfbMs !== null && directLlmTtfbMs > 0) llmTtfbMs.push(Math.round(directLlmTtfbMs));
  if (directTtsTtfbMs !== null && directTtsTtfbMs > 0) ttsTtfbMs.push(Math.round(directTtsTtfbMs));

  const tokens = Array.isArray(data.tokens) ? data.tokens : [];
  for (const m of tokens) {
    const obj = m && typeof m === "object" ? (m as Record<string, unknown>) : null;
    if (!obj) continue;

    // Pipecat standard keys for LLM usage (LLMUsageMetricsData / LLMTokenUsage)
    // Check top-level first, then nested value/usage (RTVI serialization variants)
    const valueOrUsage = (obj.value ?? obj.usage) as Record<string, unknown> | undefined;
    const p = toNumber(obj.prompt_tokens) ?? (valueOrUsage && typeof valueOrUsage === "object" ? toNumber(valueOrUsage.prompt_tokens) : null);
    const c = toNumber(obj.completion_tokens) ?? (valueOrUsage && typeof valueOrUsage === "object" ? toNumber(valueOrUsage.completion_tokens) : null);
    const total = toNumber(obj.total_tokens) ?? (valueOrUsage && typeof valueOrUsage === "object" ? toNumber(valueOrUsage.total_tokens) : null) ?? ((p ?? 0) + (c ?? 0));

    if (p) llmPromptTokens += p;
    if (c) llmCompletionTokens += c;
    if (total) llmTokens += total;
  }

  const characters = Array.isArray(data.characters) ? data.characters : [];
  for (const charItem of characters) {
    if (typeof charItem === "number") {
      ttsChars += charItem;
      continue;
    }
    if (!charItem || typeof charItem !== "object") continue;
    const charObj = charItem as Record<string, unknown>;
    const v = toNumber(charObj.value ?? charObj.characters);
    if (v) ttsChars += v;
  }

  const ttfb = Array.isArray(data.ttfb) ? data.ttfb : [];
  for (const ttfbItem of ttfb) {
    if (!ttfbItem || typeof ttfbItem !== "object") continue;
    const ttfbObj = ttfbItem as Record<string, unknown>;
    const raw = toNumber(ttfbObj.value);
    if (raw === null) continue;
    const valueMs = maybeSecondsToMs(raw);
    if (valueMs <= 0) continue;
    const provider = extractProviderName(ttfbItem);
    if (provider.includes("tts") || provider.includes("cartesia") || provider.includes("elevenlabs")) {
      ttsTtfbMs.push(valueMs);
    } else {
      llmTtfbMs.push(valueMs);
    }
  }

  const processing = Array.isArray(data.processing) ? data.processing : [];
  for (const procItem of processing) {
    if (!procItem || typeof procItem !== "object") continue;
    const procObj = procItem as Record<string, unknown>;
    const raw = toNumber(procObj.value);
    if (raw === null) continue;
    const valueMs = maybeSecondsToMs(raw);
    if (valueMs <= 0) continue;
    const provider = extractProviderName(procItem);
    if (provider.includes("tts") || provider.includes("cartesia") || provider.includes("elevenlabs")) {
      ttsProcessingMs.push(valueMs);
    } else {
      llmProcessingMs.push(valueMs);
    }
  }

  return { llmTokens, llmPromptTokens, llmCompletionTokens, ttsChars, llmTtfbMs, ttsTtfbMs, llmProcessingMs, ttsProcessingMs };
}

function downloadBenchmarkReport(prev: CallState, networkStatsOverride: unknown | null): void {
  const turnCount = prev.turnLatencies.length;
  const networkStats = networkStatsOverride ?? prev.networkStats;
  const report = {
    sessionId: prev.sessionId,
    sessionStartTime: prev.sessionStartTime,
    sessionEndTime: Date.now(),
    sessionDurationSec: prev.duration,
    turnCount,
    confidence: turnCount >= 30 ? "High" : "Low (Insufficient Data)",
    turnLatenciesMs: prev.turnLatencies,
    p50Ms: Math.round(percentile(prev.turnLatencies, 50)),
    p95Ms: Math.round(percentile(prev.turnLatencies, 95)),
    playbackLatenciesMs: prev.playbackLatenciesMs,
    playbackLatencyP50Ms:
      prev.playbackLatenciesMs.length > 0
        ? Math.round(percentile(prev.playbackLatenciesMs, 50))
        : null,
    playbackLatencyP95Ms:
      prev.playbackLatenciesMs.length > 0
        ? Math.round(percentile(prev.playbackLatenciesMs, 95))
        : null,
    usage: prev.usage,
    ttfbMetrics: prev.ttfbMetrics,
    processingMetrics: prev.processingMetrics,
    llmTtfbP50Ms:
      prev.ttfbMetrics.llm.length > 0 ? Math.round(percentile(prev.ttfbMetrics.llm, 50)) : null,
    llmTtfbP95Ms:
      prev.ttfbMetrics.llm.length > 0 ? Math.round(percentile(prev.ttfbMetrics.llm, 95)) : null,
    ttsTtfbP50Ms:
      prev.ttfbMetrics.tts.length > 0 ? Math.round(percentile(prev.ttfbMetrics.tts, 50)) : null,
    ttsTtfbP95Ms:
      prev.ttfbMetrics.tts.length > 0 ? Math.round(percentile(prev.ttfbMetrics.tts, 95)) : null,
    llmProcessingP50Ms:
      prev.processingMetrics.llm.length > 0
        ? Math.round(percentile(prev.processingMetrics.llm, 50))
        : null,
    llmProcessingP95Ms:
      prev.processingMetrics.llm.length > 0
        ? Math.round(percentile(prev.processingMetrics.llm, 95))
        : null,
    ttsProcessingP50Ms:
      prev.processingMetrics.tts.length > 0
        ? Math.round(percentile(prev.processingMetrics.tts, 50))
        : null,
    ttsProcessingP95Ms:
      prev.processingMetrics.tts.length > 0
        ? Math.round(percentile(prev.processingMetrics.tts, 95))
        : null,
    orchestrationTimeMs: prev.orchestrationTimeMs,
    connectionEstablishmentMs: prev.connectionEstablishmentMs,
    networkStats,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `benchmark_report_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Play remote participant audio (bot) — createCallObject does not auto-play; we must attach tracks.
function attachRemoteTrackToAudio(track: MediaStreamTrack, audioEl: HTMLAudioElement) {
  const stream = new MediaStream([track]);
  audioEl.srcObject = stream;
  audioEl.play().catch(() => {});
}

export type CallStatus =
  | "idle"
  | "requesting"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export interface TranscriptEntry {
  id: number;
  speaker: "user" | "bot";
  text: string;
  final: boolean;
}

export interface CallState {
  status: CallStatus;
  sessionId: string | null;
  errorMessage: string | null;
  agentJoined: boolean;
  isMuted: boolean;
  participantCount: number;
  duration: number;
  transcripts: TranscriptEntry[];
  /** Client-side turn latencies (user_stop → bot_start) in ms */
  turnLatencies: number[];
  lastTurnLatencyMs: number | null;
  ttfbMetrics: { llm: number[]; tts: number[] };
  processingMetrics: { llm: number[]; tts: number[] };
  usage: { sttMinutes: number; llmTokens: number; promptTokens: number; completionTokens: number; ttsChars: number };
  botStoppedSpeakingTs: number[];
  /** Bot start → first audio playback (need.md §1) */
  playbackLatenciesMs: number[];
  sessionStartTime: number | null;
  orchestrationTimeMs: number | null;
  connectionEstablishmentMs: number | null;
  networkStats: unknown | null;
}

const INITIAL_STATE: CallState = {
  status: "idle",
  sessionId: null,
  errorMessage: null,
  agentJoined: false,
  isMuted: false,
  participantCount: 0,
  duration: 0,
  transcripts: [],
  turnLatencies: [],
  lastTurnLatencyMs: null,
  ttfbMetrics: { llm: [], tts: [] },
  processingMetrics: { llm: [], tts: [] },
  usage: { sttMinutes: 0, llmTokens: 0, promptTokens: 0, completionTokens: 0, ttsChars: 0 },
  botStoppedSpeakingTs: [],
  playbackLatenciesMs: [],
  sessionStartTime: null,
  orchestrationTimeMs: null,
  connectionEstablishmentMs: null,
  networkStats: null,
};

export function useVoiceCall() {
  const [state, setState] = useState<CallState>(INITIAL_STATE);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callFrameRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const transcriptIdRef = useRef<number>(0);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const userStopTsRef = useRef<number | null>(null);
  const botStartTsRef = useRef<number | null>(null);
  const joinStartRef = useRef<number | null>(null);
  const networkStatsRef = useRef<unknown | null>(null);
  const reportDataRef = useRef<CallState | null>(null);

  const updateState = (patch: Partial<CallState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    reportDataRef.current = state;
  }, [state]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        updateState({ duration: Math.floor((Date.now() - startTimeRef.current) / 1000) });
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  const startCall = useCallback(async () => {
    updateState({ status: "requesting", errorMessage: null });
    console.log("[VoiceCall] Requesting session from /start...");

    try {
      // Dynamically import daily-js to avoid SSR issues
      const DailyIframe = (await import("@daily-co/daily-js")).default;

      // Daily allows only one call instance per window. Destroy any existing instance
      // before creating a new one to avoid "duplicate dailyiframe instances not allowed".
      const existingCall = DailyIframe.getCallInstance?.() ?? callFrameRef.current;
      if (existingCall && !existingCall.isDestroyed?.()) {
        console.log("[VoiceCall] Cleaning up existing call before starting new one");
        try {
          await existingCall.leave?.();
          await existingCall.destroy?.();
        } catch {
          // Best-effort cleanup
        }
        callFrameRef.current = null;
        if (remoteAudioRef.current?.parentNode) {
          remoteAudioRef.current.srcObject = null;
          remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
        }
        remoteAudioRef.current = null;
      }

      const orchestrationStart = performance.now();
      const res = await fetch("/api/start", { method: "POST" });
      const orchestrationTimeMs = Math.round(performance.now() - orchestrationStart);
      updateState({ orchestrationTimeMs, sessionStartTime: Date.now() });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("[VoiceCall] Session request failed:", res.status, err);
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      // Session-broker normalises dailyRoom→url, dailyToken→token; support both
      const url = data.url ?? data.dailyRoom;
      const token = data.token ?? data.dailyToken;

      // Log session response (url/token from local runner or Pipecat Cloud)
      const isDailyRoom = typeof url === "string" && url.includes("daily.co");
      const transportType = isDailyRoom ? "Daily" : "SmallWebRTC/other";
      const backendSource = data.source ?? (url?.includes("cloud-") ? "cloud" : "unknown");
      console.log("[VoiceCall] Session response:", {
        hasUrl: !!url,
        urlPreview: url ? `${String(url).slice(0, 50)}...` : null,
        hasToken: !!token,
        sessionId: data.sessionId ?? null,
        transportType,
        backendSource, // "local" = local bot, "cloud" = Pipecat Cloud
        rawKeys: Object.keys(data),
      });

      if (!url || !token) {
        console.error("[VoiceCall] Invalid session: missing url or token. Response keys:", Object.keys(data));
        throw new Error("Invalid session response from broker");
      }

      updateState({ status: "connecting", sessionId: data.sessionId ?? null });
      console.log("[VoiceCall] Joining with", transportType, "transport...");

      const callFrame = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
        subscribeToTracksAutomatically: true,
      });
      callFrameRef.current = callFrame;

      // Create hidden audio element to play remote (bot) audio — createCallObject does not auto-play.
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.style.position = "absolute";
      audioEl.style.left = "-9999px";
      audioEl.onplaying = () => {
        if (botStartTsRef.current !== null) {
          const playbackLatencyMs = Math.round(performance.now() - botStartTsRef.current);
          botStartTsRef.current = null;
          setState((prev) => ({
            ...prev,
            playbackLatenciesMs: [...prev.playbackLatenciesMs, playbackLatencyMs],
          }));
        }
      };
      document.body.appendChild(audioEl);
      remoteAudioRef.current = audioEl;

      callFrame.on("track-started", (event: { participant?: { local: boolean } | null; track?: MediaStreamTrack }) => {
        if (!event.participant || event.participant.local) return;
        if (event.track?.kind === "audio" && remoteAudioRef.current) {
          console.log("[VoiceCall] Remote audio track started, attaching to playback");
          attachRemoteTrackToAudio(event.track, remoteAudioRef.current);
        }
      });

      callFrame.on("joined-meeting", () => {
        console.log("[VoiceCall] Joined meeting successfully");
        if (joinStartRef.current !== null) {
          const connectionEstablishmentMs = Math.round(performance.now() - joinStartRef.current);
          joinStartRef.current = null;
          updateState({ status: "connected", connectionEstablishmentMs });
        } else {
          updateState({ status: "connected" });
        }
        startTimer();
        // Ensure local mic is published so the bot receives user audio
        callFrame.setLocalAudio(true);
        // Send RTVI client-ready so bot waits before greeting (avoids missing first message)
        try {
          callFrame.sendAppMessage(
            {
              label: "rtvi-ai",
              type: "client-ready",
              id: crypto.randomUUID(),
              data: { version: "1.2.0", about: { library: "voicebot-dashboard" } },
            },
            "*"
          );
          console.log("[VoiceCall] Sent RTVI client-ready");
        } catch {
          // Non-fatal; bot may greet immediately if no client-ready
        }
        // Attach any existing remote audio tracks (e.g. bot joined before us)
        const participants = callFrame.participants();
        for (const [, p] of Object.entries(participants)) {
          if (!p.local && (p as { tracks?: { audio?: { track?: MediaStreamTrack } } }).tracks?.audio?.track && remoteAudioRef.current) {
            attachRemoteTrackToAudio((p as { tracks: { audio: { track: MediaStreamTrack } } }).tracks.audio.track, remoteAudioRef.current);
            break; // one remote audio source (the bot)
          }
        }
      });

      callFrame.on("participant-joined", (event: { participant: { local: boolean } }) => {
        if (!event.participant.local) {
          console.log("[VoiceCall] Bot/agent joined");
          setState((prev) => ({
            ...prev,
            agentJoined: true,
            participantCount: prev.participantCount + 1,
          }));
        }
      });

      callFrame.on("participant-left", (event: { participant: { local: boolean } }) => {
        if (!event.participant.local) {
          console.log("[VoiceCall] Bot/agent left");
          setState((prev) => ({
            ...prev,
            agentJoined: false,
            participantCount: Math.max(0, prev.participantCount - 1),
          }));
        }
      });

      callFrame.on("left-meeting", async () => {
        console.log("[VoiceCall] Left meeting");
        botStartTsRef.current = null;
        userStopTsRef.current = null;
        joinStartRef.current = null;

        const reportState = reportDataRef.current;
        let latestNetworkStats = networkStatsRef.current;
        const getStats =
          typeof callFrame.getNetworkStats === "function"
            ? callFrame.getNetworkStats
            : (callFrame as { getStats?: () => Promise<unknown> }).getStats;
        if (!latestNetworkStats && typeof getStats === "function") {
          try {
            latestNetworkStats = await getStats();
            networkStatsRef.current = latestNetworkStats;
          } catch {
            // Non-fatal; report can still be exported without network stats
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));

        downloadBenchmarkReport(reportState ?? INITIAL_STATE, latestNetworkStats);
        networkStatsRef.current = null;
        setState({ ...INITIAL_STATE, status: "idle" });
        stopTimer();
        if (remoteAudioRef.current?.parentNode) {
          remoteAudioRef.current.srcObject = null;
          remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
        }
        remoteAudioRef.current = null;
        callFrameRef.current = null;
      });

      callFrame.on("error", (event: { error?: { message?: string } }) => {
        console.error("[VoiceCall] Call error:", event?.error?.message ?? event);
        updateState({
          status: "error",
          errorMessage: event?.error?.message || "Call error",
        });
        stopTimer();
      });

      // Pipecat sends transcripts and RTVI events via Daily app-messages.
      callFrame.on("app-message", (event: { data?: unknown }) => {
        const msg = event?.data as { label?: string; type?: string; data?: Record<string, unknown> };
        if (!msg || typeof msg !== "object") return;

        const label = msg?.label;
        const type: string = msg?.type ?? "";

        // RTVI events: latency, bot-stopped-speaking, metrics
        if (label === "rtvi-ai") {
          if (type === "user-stopped-speaking") {
            userStopTsRef.current = performance.now();
          } else if (type === "bot-started-speaking") {
            botStartTsRef.current = performance.now();
            if (userStopTsRef.current !== null) {
              const e2eLatency = Math.round(performance.now() - userStopTsRef.current);
              userStopTsRef.current = null;
              setState((prev) => ({
                ...prev,
                turnLatencies: [...prev.turnLatencies, e2eLatency],
                lastTurnLatencyMs: e2eLatency,
              }));
            }
          } else if (type === "bot-stopped-speaking") {
            setState((prev) => ({
              ...prev,
              botStoppedSpeakingTs: [...prev.botStoppedSpeakingTs, performance.now()],
            }));
          } else if (type === "metrics" && msg.data) {
            console.log("📊 METRIC:", msg.data);
            const d = msg.data as Record<string, unknown>;
            const parsed = extractUsageAndTtfb(d);
            setState((prev) => {
              const next = { ...prev };
              if (parsed.llmTtfbMs.length > 0 || parsed.ttsTtfbMs.length > 0) {
                next.ttfbMetrics = {
                  llm: [...prev.ttfbMetrics.llm, ...parsed.llmTtfbMs],
                  tts: [...prev.ttfbMetrics.tts, ...parsed.ttsTtfbMs],
                };
              }
              if (parsed.llmProcessingMs.length > 0 || parsed.ttsProcessingMs.length > 0) {
                next.processingMetrics = {
                  llm: [...prev.processingMetrics.llm, ...parsed.llmProcessingMs],
                  tts: [...prev.processingMetrics.tts, ...parsed.ttsProcessingMs],
                };
              }
              if (parsed.llmTokens > 0 || parsed.llmPromptTokens > 0 || parsed.llmCompletionTokens > 0 || parsed.ttsChars > 0) {
                next.usage = {
                  ...prev.usage,
                  llmTokens: prev.usage.llmTokens + parsed.llmTokens,
                  promptTokens: prev.usage.promptTokens + parsed.llmPromptTokens,
                  completionTokens: prev.usage.completionTokens + parsed.llmCompletionTokens,
                  ttsChars: prev.usage.ttsChars + parsed.ttsChars,
                };
              }
              return next;
            });
          }
        }

        // Transcripts
        const isTranscript =
          label === "rtvi-ai" || type === "user-transcription" || type === "bot-transcription";
        if (!isTranscript) return;

        const m = msg as { data?: { text?: string; final?: boolean }; text?: string; final?: boolean };
        const text: string = String(m?.data?.text ?? m?.text ?? "");
        const isFinal =
          type === "bot-transcription" || m?.data?.final === true || m?.final === true;

        if (!text?.trim()) return;

        const speaker: "user" | "bot" =
          type === "user-transcription" ? "user" : "bot";

        if (!isFinal) return;

        setState((prev) => {
          const entries = [...prev.transcripts];
          entries.push({ id: ++transcriptIdRef.current, speaker, text: text.trim(), final: true });
          return { ...prev, transcripts: entries };
        });
      });

      console.log("[VoiceCall] Calling join() with url and token...");
      joinStartRef.current = performance.now();
      await callFrame.join({ url, token });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start call";
      console.error("[VoiceCall] startCall failed:", err);
      updateState({ status: "error", errorMessage: msg });
    }
  }, [startTimer, stopTimer]);

  const endCall = useCallback(async () => {
    const callFrame = callFrameRef.current;
    if (!callFrame) return;

    console.log("[VoiceCall] Ending call...");
    updateState({ status: "disconnecting" });
    stopTimer();

    try {
      if (!callFrame.isDestroyed?.()) {
        const getStats =
          typeof callFrame.getNetworkStats === "function"
            ? callFrame.getNetworkStats
            : (callFrame as { getStats?: () => Promise<unknown> }).getStats;
        if (typeof getStats === "function") {
          try {
            const stats = await getStats();
            networkStatsRef.current = stats;
            updateState({ networkStats: stats });
          } catch {
            // Non-fatal; network stats optional
          }
        }
        await callFrame.leave();
        await callFrame.destroy();
      }
    } catch {
      // Ensure cleanup even if leave/destroy throws
    } finally {
      callFrameRef.current = null;
      if (remoteAudioRef.current?.parentNode) {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
      }
      remoteAudioRef.current = null;
    }
  }, [stopTimer]);

  const toggleMute = useCallback(async () => {
    if (!callFrameRef.current) return;
    const newMuted = !state.isMuted;
    await callFrameRef.current.setLocalAudio(!newMuted);
    updateState({ isMuted: newMuted });
  }, [state.isMuted]);

  useEffect(() => {
    return () => {
      stopTimer();
      if (remoteAudioRef.current?.parentNode) {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
      }
      remoteAudioRef.current = null;
      if (callFrameRef.current) {
        callFrameRef.current.destroy().catch(() => {});
      }
    };
  }, [stopTimer]);

  return { state, startCall, endCall, toggleMute };
}
