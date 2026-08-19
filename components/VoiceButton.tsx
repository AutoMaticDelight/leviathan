"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Voice input via the browser's built-in Web Speech API.
 * Works in Chrome and Edge. No key, no service, no cost.
 *
 * TODO(you): Firefox and Safari don't support this. If that matters, the
 * fallback is recording audio and posting it to a transcription model.
 */
export default function VoiceButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const ref = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      onTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    ref.current = rec;
    return () => rec.stop();
  }, [onTranscript]);

  if (!supported) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Ask by voice"}
      onClick={() => {
        if (!ref.current) return;
        if (listening) {
          ref.current.stop();
          setListening(false);
        } else {
          ref.current.start();
          setListening(true);
        }
      }}
      className={`flex h-12 w-12 shrink-0 items-center justify-center border transition-colors disabled:opacity-40 ${
        listening
          ? "border-live text-live live-dot"
          : "border-rule text-dim hover:border-faint hover:text-ink"
      }`}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
      </svg>
    </button>
  );
}
