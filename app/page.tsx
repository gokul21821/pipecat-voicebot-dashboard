"use client";

import { useCallback } from "react";
import { useVoiceCall } from "@/app/hooks/useVoiceCall";
import { StatusOrb } from "@/app/components/StatusOrb";
import { CallControls } from "@/app/components/CallControls";
import { StatusBadge } from "@/app/components/StatusBadge";
import { SessionInfo } from "@/app/components/SessionInfo";
import { MetricsPanel } from "@/app/components/MetricsPanel";
import { ErrorBanner } from "@/app/components/ErrorBanner";
import { FeatureCard } from "@/app/components/FeatureCard";
import { TranscriptFeed } from "@/app/components/TranscriptFeed";

export default function DashboardPage() {
  const { state, startCall, endCall, toggleMute } = useVoiceCall();

  const handleDismissError = useCallback(() => {
    // Resetting via a fresh start attempt is handled by startCall
    // For dismiss we just reset to idle without starting
    // We abuse startCall to reset — but we can also just reload
    window.location.reload();
  }, []);

  const isActive = state.status === "connected";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5M12 18.75a6 6 0 01-6-6v-1.5M12 18.75v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <span className="font-bold text-black tracking-tight text-lg">VoiceBot</span>
          <span className="hidden sm:inline text-xs font-medium text-zinc-400 px-2 py-0.5 bg-zinc-100 rounded-full">AI Assistant</span>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={state.status} />
          <a
            href="https://docs.pipecat.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            Docs
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M2.5 9.5L9.5 2.5M5.5 2.5H9.5v4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </header>

      {/* Main content */}
      <main
        className={
          isActive
            ? "flex-1 flex flex-col lg:flex-row gap-6 px-6 py-8 min-h-0"
            : "flex-1 flex flex-col items-center justify-center px-4 py-12 gap-10"
        }
      >
        {isActive ? (
          <>
            {/* Left side — ~60%: orb, controls, session info, transcript */}
            <div className="min-w-0 flex flex-col gap-6 flex-[3]">
              <div className="flex flex-col items-center gap-4 shrink-0">
                <h1 className="text-2xl font-extrabold tracking-tight text-black">
                  Session in Progress
                </h1>
                <StatusOrb status={state.status} agentJoined={state.agentJoined} />
                <CallControls
                  status={state.status}
                  isMuted={state.isMuted}
                  onStart={startCall}
                  onEnd={endCall}
                  onToggleMute={toggleMute}
                />
                <SessionInfo
                  sessionId={state.sessionId}
                  duration={state.duration}
                  participantCount={state.participantCount}
                />
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <TranscriptFeed transcripts={state.transcripts} />
              </div>
            </div>

            {/* Right side — ~40%: metrics panel */}
            <div className="shrink-0 flex flex-col flex-[2]">
              <MetricsPanel
                turnLatencies={state.turnLatencies}
                lastTurnLatencyMs={state.lastTurnLatencyMs}
              />
            </div>
          </>
        ) : (
          <>
            {/* Idle state — centered layout */}
            <div className="flex flex-col items-center text-center gap-3 max-w-md">
              <h1 className="text-3xl font-extrabold tracking-tight text-black">
                Voice AI Assistant
              </h1>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Start a session to speak with your AI assistant. Audio is end-to-end processed in real-time.
              </p>
            </div>

            <StatusOrb status={state.status} agentJoined={state.agentJoined} />

            {state.status === "error" && state.errorMessage && (
              <ErrorBanner message={state.errorMessage} onDismiss={handleDismissError} />
            )}

            <CallControls
              status={state.status}
              isMuted={state.isMuted}
              onStart={startCall}
              onEnd={endCall}
              onToggleMute={toggleMute}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-sm sm:max-w-xl mt-2">
              <FeatureCard
                icon={<BoltIcon />}
                title="Low Latency"
                description="Streaming STT, LLM, and TTS for sub-second response times."
              />
              <FeatureCard
                icon={<ShieldIcon />}
                title="Private"
                description="Your audio is processed server-side. Keys never touch the browser."
              />
              <FeatureCard
                icon={<WaveIcon />}
                title="Barge-in"
                description="Interrupt naturally. The agent stops and listens immediately."
              />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 px-6 py-4 flex items-center justify-between text-xs text-zinc-400">
        <span>Powered by <span className="font-semibold text-zinc-600">Pipecat</span> · <span className="font-semibold text-zinc-600">Daily.co</span></span>
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-red-500 animate-pulse" : "bg-zinc-300"}`} />
          <span>{isActive ? "Live" : "Offline"}</span>
        </div>
      </footer>
    </div>
  );
}

function BoltIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
    </svg>
  );
}
