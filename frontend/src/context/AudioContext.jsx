import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const AudioContext = createContext(null);

// Procedural sound effects via WebAudio (no asset hosting needed)
function createTone(audioCtx, freq, duration, type = "sine", volume = 0.15) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// Nostalgic-feeling music loop using a simple gentle melody (lo-fi style)
function startMusicLoop(audioCtx, masterGain) {
  // Simple A-minor pentatonic-ish nostalgic chimes
  const notes = [392, 440, 523.25, 587.33, 659.25, 523.25, 440, 392]; // G, A, C, D, E, C, A, G
  const stepMs = 650;
  let i = 0;
  const interval = setInterval(() => {
    if (!masterGain) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = notes[i % notes.length];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(g).connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.6);

    // soft bass every 4 notes
    if (i % 4 === 0) {
      const b = audioCtx.createOscillator();
      const bg = audioCtx.createGain();
      b.type = "sine";
      b.frequency.value = 110;
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.exponentialRampToValueAtTime(0.05, t + 0.05);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      b.connect(bg).connect(masterGain);
      b.start(t);
      b.stop(t + 1.3);
    }
    i++;
  }, stepMs);
  return interval;
}

export function AudioProvider({ children }) {
  const [musicOn, setMusicOn] = useState(false);
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const musicIntervalRef = useRef(null);

  const ensureCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtxRef.current = new Ctx();
      const g = audioCtxRef.current.createGain();
      g.gain.value = 0.7;
      g.connect(audioCtxRef.current.destination);
      masterGainRef.current = g;
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const toggleMusic = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (musicOn) {
      if (musicIntervalRef.current) clearInterval(musicIntervalRef.current);
      musicIntervalRef.current = null;
      setMusicOn(false);
    } else {
      musicIntervalRef.current = startMusicLoop(ctx, masterGainRef.current);
      setMusicOn(true);
    }
  }, [musicOn, ensureCtx]);

  const playSfx = useCallback(
    (kind) => {
      const ctx = ensureCtx();
      if (!ctx) return;
      if (kind === "correct") {
        createTone(ctx, 660, 0.12, "triangle", 0.18);
        setTimeout(() => createTone(ctx, 880, 0.18, "triangle", 0.18), 110);
      } else if (kind === "wrong") {
        createTone(ctx, 220, 0.18, "sawtooth", 0.18);
        setTimeout(() => createTone(ctx, 160, 0.22, "sawtooth", 0.18), 120);
      } else if (kind === "tick") {
        createTone(ctx, 1200, 0.04, "square", 0.08);
      } else if (kind === "click") {
        createTone(ctx, 520, 0.05, "square", 0.1);
      } else if (kind === "join") {
        createTone(ctx, 523, 0.1, "triangle", 0.15);
        setTimeout(() => createTone(ctx, 784, 0.14, "triangle", 0.15), 90);
      } else if (kind === "win") {
        [523, 659, 784, 1046].forEach((f, i) =>
          setTimeout(() => createTone(ctx, f, 0.22, "triangle", 0.2), i * 130)
        );
      }
    },
    [ensureCtx]
  );

  useEffect(() => {
    return () => {
      if (musicIntervalRef.current) clearInterval(musicIntervalRef.current);
    };
  }, []);

  return (
    <AudioContext.Provider value={{ musicOn, toggleMusic, playSfx }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be inside AudioProvider");
  return ctx;
}
