"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface RecognitionEvent {
  results: ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }>;
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function join(base: string, extra: string) {
  const spoken = extra.replace(/\s+/g, " ").trim();
  if (!spoken) return base;
  if (!base.trim()) return spoken;
  return `${base.replace(/\s+$/, "")} ${spoken}`;
}

const ENGLISH = "en-GB";
export const WAVE_BARS = 11;

/** Live English dictation via the browser speech API, plus microphone levels for the waveform. */
export function useDictation() {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => recognitionCtor() !== null);
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<number[]>(() => Array(WAVE_BARS).fill(0.16));
  const prefixRef = useRef("");
  const listeningRef = useRef(false);
  const generation = useRef(0);
  const recognitionRef = useRef<Recognition | null>(null);
  const onTextRef = useRef<(value: string) => void>(() => {});
  const meterSession = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const frameRef = useRef(0);

  const closeMeter = useCallback(() => {
    meterSession.current += 1;
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio && audio.state !== "closed") void audio.close();
    setLevels(Array(WAVE_BARS).fill(0.16));
  }, []);

  const stop = useCallback(() => {
    listeningRef.current = false;
    generation.current += 1;
    setListening(false);
    closeMeter();
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
  }, [closeMeter]);

  const bind = useCallback((recognition: Recognition) => {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = ENGLISH;
    recognition.onresult = (event) => {
      const gen = generation.current;
      let finalText = "";
      let interimText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const piece = event.results[index][0]?.transcript ?? "";
        if (event.results[index].isFinal) finalText += piece;
        else interimText += piece;
      }
      if (gen !== generation.current) return;
      onTextRef.current(join(prefixRef.current, `${finalText} ${interimText}`));
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      listeningRef.current = false;
      generation.current += 1;
      setListening(false);
      closeMeter();
      setError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Allow the microphone to transcribe a voice note." : "Speech recognition needs a connection. You can still type the summary.");
    };
    recognition.onend = () => {
      if (!listeningRef.current) {
        setListening(false);
        return;
      }
      recognition.lang = ENGLISH;
      try {
        recognition.start();
      } catch {
        listeningRef.current = false;
        setListening(false);
      }
    };
  }, [closeMeter]);

  const openMeter = useCallback(async () => {
    const session = ++meterSession.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!listeningRef.current || session !== meterSession.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const audio = new AudioContext();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.62;
      audio.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      audioRef.current = audio;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!listeningRef.current || session !== meterSession.current) return;
        analyser.getByteFrequencyData(data);
        const next = Array.from({ length: WAVE_BARS }, (_, index) => {
          const bin = 2 + index * 2;
          const loud = (data[bin] ?? 0) / 255;
          return Math.max(0.14, Math.min(1, loud * 1.65));
        });
        setLevels(next);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch {
      // Speech recognition still transcribes if the level meter cannot open.
    }
  }, []);

  const start = useCallback((currentText: string, onText: (value: string) => void) => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("Voice notes work in Chrome or Edge.");
      return;
    }
    setError("");
    prefixRef.current = currentText;
    onTextRef.current = onText;
    listeningRef.current = true;
    generation.current += 1;
    setListening(true);

    if (!recognitionRef.current) recognitionRef.current = new Ctor();
    const recognition = recognitionRef.current;
    bind(recognition);
    try {
      recognition.start();
    } catch {
      try {
        recognition.stop();
      } catch {
        listeningRef.current = false;
        setListening(false);
        setError("Couldn't start the microphone. You can still type the summary.");
      }
    }
    void openMeter();
  }, [bind, openMeter]);

  const noteTyped = useCallback((value: string) => {
    prefixRef.current = value;
    if (!listeningRef.current || !recognitionRef.current) return;
    generation.current += 1;
    try {
      recognitionRef.current.stop();
    } catch {
      // onend restarts the session against the edited text.
    }
  }, []);

  useEffect(() => () => {
    listeningRef.current = false;
    generation.current += 1;
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current && audioRef.current.state !== "closed") void audioRef.current.close();
    try {
      recognitionRef.current?.abort();
    } catch {
      // Modal closed.
    }
  }, []);

  return { listening, supported, error, levels, start, stop, noteTyped, clearError: () => setError("") };
}
