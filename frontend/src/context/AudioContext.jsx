import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const AudioContext = createContext(null);

const AUDIO_BASE = "/audio";
const SFX_MAP = {
  correct: `${AUDIO_BASE}/correct.mp3`,
  wrong: `${AUDIO_BASE}/wrong.mp3`,
  tick: `${AUDIO_BASE}/tick.mp3`,
  click: `${AUDIO_BASE}/click.mp3`,
  join: `${AUDIO_BASE}/join.mp3`,
  win: `${AUDIO_BASE}/win.mp3`,
};
const MUSIC_URL = `${AUDIO_BASE}/music.mp3`;

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
