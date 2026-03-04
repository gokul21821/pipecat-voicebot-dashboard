"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

  const updateState = (patch: Partial<CallState>) =>
    setState((prev) => ({ ...prev, ...patch }));

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

      const res = await fetch("/start", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("[VoiceCall] Session request failed:", res.status, err);
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      // Session-broker normalises dailyRoom→url, dailyToken→token; support both
      const url = data.url ?? data.dailyRoom;
      const token = data.token ?? data.dailyToken;

      // Log transport type: Daily room vs SmallWebRTC/other (for debugging)
      const isDailyRoom = typeof url === "string" && url.includes("daily.co");
      const transportType = isDailyRoom ? "Daily" : "SmallWebRTC/other";
      console.log("[VoiceCall] Session response:", {
        hasUrl: !!url,
        urlPreview: url ? `${String(url).slice(0, 50)}...` : null,
        hasToken: !!token,
        sessionId: data.sessionId ?? null,
        transportType,
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
        updateState({ status: "connected" });
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
        for (const [id, p] of Object.entries(participants)) {
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

      callFrame.on("left-meeting", () => {
        console.log("[VoiceCall] Left meeting");
        updateState({
          status: "idle",
          agentJoined: false,
          participantCount: 0,
          duration: 0,
          sessionId: null,
          transcripts: [],
          turnLatencies: [],
          lastTurnLatencyMs: null,
        });
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = event?.data as any;
        if (!msg || typeof msg !== "object") return;

        const label = msg?.label;
        const type: string = msg?.type ?? "";

        // Client-side latency: user-stopped-speaking → bot-started-speaking
        if (label === "rtvi-ai") {
          if (type === "user-stopped-speaking") {
            userStopTsRef.current = Date.now();
          } else if (type === "bot-started-speaking" && userStopTsRef.current !== null) {
            const latencyMs = Date.now() - userStopTsRef.current;
            userStopTsRef.current = null;
            setState((prev) => ({
              ...prev,
              turnLatencies: [...prev.turnLatencies, latencyMs],
              lastTurnLatencyMs: latencyMs,
            }));
          }
        }

        // Transcripts
        const isTranscript =
          label === "rtvi-ai" || type === "user-transcription" || type === "bot-transcription";
        if (!isTranscript) return;

        const text: string = msg?.data?.text ?? msg?.text ?? "";
        // User transcriptions have data.final; bot-transcription has no final field (always complete)
        const isFinal: boolean =
          type === "bot-transcription" ||
          msg?.data?.final === true ||
          msg?.final === true;

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
        await callFrame.leave();
        await callFrame.destroy();
      }
    } catch {
      // Ensure cleanup even if leave/destroy throws
    } finally {
      // Always clean up refs and DOM so next startCall works
      callFrameRef.current = null;
      if (remoteAudioRef.current?.parentNode) {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
      }
      remoteAudioRef.current = null;
      setState({ ...INITIAL_STATE });
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
