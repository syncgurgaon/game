import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const AudioContext = createContext(null);

const AUDIO_BASE = "/audio";
const SFX_MAP = {
  correct: `${AUDIO_BASE}/correct.mp3`,
  wrong: `${AUDIO_BASE}/wrong.mp3`,
  tick: `${AUDIO_BASE}/tick.mp3`,
  click: `${AUDIO_BASE}/click.mp3`,
  win: `${AUDIO_BASE}/win.mp3`,
};
const MUSIC_URL = `${AUDIO_BASE}/music.mp3`;

// Procedural warm "join" chime — nostalgic major-6th arpeggio with long decay.
// Pure sine waves, gentle attack, no percussion. ~1.4s tail.
function playJoinChimeWebAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  // If suspended by autoplay policy, we'll just silently fail (called after user interaction so should resume)
  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);

  // Simple analog-style delay for a room-y feel (nostalgic warmth)
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.18;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(master);

  const now = ctx.currentTime;
  // Notes: E5, G5, B5 (a warm minor-major flavor)
  const notes = [
    { f: 659.25, t: 0.0 },
    { f: 783.99, t: 0.12 },
    { f: 987.77, t: 0.24 },
  ];
  notes.forEach(({ f, t }) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.9, now + t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 1.2);
    osc.connect(g);
    g.connect(master);
    g.connect(delay);
    osc.start(now + t);
    osc.stop(now + t + 1.25);
  });

  // Auto-close context to free resources
  setTimeout(() => {
    try { ctx.close(); } catch { /* noop */ }
  }, 2000);
}

export function AudioProvider({ children }) {
  const [musicOn, setMusicOn] = useState(false);
  const musicRef = useRef(null);
  const sfxBufRef = useRef({}); // kind -> HTMLAudioElement pool

  // Preload SFX (pooled so rapid plays don't cut each other off)
  useEffect(() => {
    Object.entries(SFX_MAP).forEach(([kind, url]) => {
      const pool = [];
      for (let i = 0; i < 3; i++) {
        const a = new Audio(url);
        a.preload = "auto";
        a.volume = kind === "tick" ? 0.35 : 0.6;
        pool.push(a);
      }
      sfxBufRef.current[kind] = { pool, idx: 0 };
    });
    // Music element
    const m = new Audio(MUSIC_URL);
    m.loop = true;
    m.volume = 0.14; // gentler waiting-room volume
    m.preload = "auto";
    musicRef.current = m;
    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current = null;
      }
    };
  }, []);

  const toggleMusic = useCallback(() => {
    const m = musicRef.current;
    if (!m) return;
    if (musicOn) {
      m.pause();
      setMusicOn(false);
    } else {
      // browsers require user gesture; this fn is called from a click handler
      const p = m.play();
      if (p && p.catch) p.catch(() => {});
      setMusicOn(true);
    }
  }, [musicOn]);

  const playSfx = useCallback((kind) => {
    if (kind === "join") {
      // Procedural warm nostalgic chime (replaces the harsh car-engine mp3)
      try {
        playJoinChimeWebAudio();
      } catch (err) {
        console.warn("join chime failed", err);
      }
      return;
    }
    const entry = sfxBufRef.current[kind];
    if (!entry) return;
    const a = entry.pool[entry.idx % entry.pool.length];
    entry.idx += 1;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch((err) => console.warn("sfx play failed", kind, err));
    } catch (err) {
      console.warn("sfx error", kind, err);
    }
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
