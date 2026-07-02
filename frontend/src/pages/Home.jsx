import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Users, ArrowRight, History as HistoryIcon, Shuffle } from "lucide-react";
import { toast } from "sonner";
import PhotoDeck from "@/components/PhotoDeck";
import { api } from "@/lib/api";
import { useAudio } from "@/context/AudioContext";
import { randomPrompt } from "@/lib/prompts";

const cardColors = ["var(--c-yellow)", "var(--c-mint)", "var(--c-lavender)", "var(--c-peach)", "var(--c-pink)", "var(--c-sky)"];

export default function Home() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialCode = (params.get("code") || "").toUpperCase();
  const [mode, setMode] = useState(initialCode ? "join" : null);
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState([]);
  const [code, setCode] = useState(initialCode);
  const [submitting, setSubmitting] = useState(false);
  const [prompt, setPrompt] = useState(() => randomPrompt());
  const { playSfx } = useAudio();

  useEffect(() => {
    if (!mode) setPrompt(randomPrompt(prompt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleCreate = async () => {
    if (!name.trim() || photos.length === 0) {
      toast.error("Please enter your name and add at least one pic");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/rooms", { name: name.trim(), photos });
      sessionStorage.setItem(`room_${res.data.code}`, JSON.stringify(res.data));
      playSfx("join");
      navigate(`/room/${res.data.code}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create room");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    const normCode = code.trim().toUpperCase();
    if (!normCode) return toast.error("Enter a room code");
    if (!name.trim() || photos.length === 0) return toast.error("Please enter your name and add at least one pic");
    setSubmitting(true);
    try {
      const res = await api.post(`/rooms/${normCode}/join`, { name: name.trim(), photos });
      sessionStorage.setItem(`room_${res.data.code}`, JSON.stringify(res.data));
      playSfx("join");
      navigate(`/room/${res.data.code}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to join room");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:py-16 max-w-5xl mx-auto" data-testid="home-page">
      {/* Hero */}
      {!mode && (
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-[var(--c-yellow)] border-4 border-[var(--ink)] rounded-full px-4 py-1.5 shadow-[4px_4px_0_#1a1a1a] mb-6"
          >
            <Sparkles size={18} strokeWidth={3} />
            <span className="font-display uppercase text-sm tracking-wider">Real-time Multiplayer</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-5xl sm:text-7xl md:text-8xl uppercase leading-[0.95]"
            data-testid="home-title"
          >
            Whose
            <br />
            <span className="inline-block bg-[var(--c-peach)] border-4 border-[var(--ink)] px-4 py-1 rotate-[-2deg] mt-3 shadow-[8px_8px_0_#1a1a1a]">
              Pic Is It?!
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="font-body text-lg sm:text-xl mt-8 max-w-2xl mx-auto text-[var(--ink)]"
          >
            Everyone drops a pic from their phone — a chaotic meme, a random screenshot, a childhood throwback, anything. A pic appears. Four names. Tap the culprit fast. Whoever spots their squad first wins the night.
          </motion.p>

          <div className="grid sm:grid-cols-2 gap-5 mt-12 max-w-2xl mx-auto">
            <motion.button
              data-testid="create-room-btn"
              whileHover={{ scale: 1.02 }}
              onClick={() => { playSfx("click"); setMode("create"); }}
              className="nb-btn px-6 py-6 bg-[var(--c-yellow)] text-xl flex items-center justify-center gap-3"
            >
              <Sparkles strokeWidth={3} /> Create Room
            </motion.button>
            <motion.button
              data-testid="join-room-btn"
              whileHover={{ scale: 1.02 }}
              onClick={() => { playSfx("click"); setMode("join"); }}
              className="nb-btn px-6 py-6 bg-[var(--c-mint)] text-xl flex items-center justify-center gap-3"
            >
              <Users strokeWidth={3} /> Join Room
            </motion.button>
          </div>

          <Link
            to="/history"
            data-testid="history-link"
            className="font-display uppercase tracking-widest text-sm mt-6 inline-flex items-center gap-1 hover:underline"
          >
            <HistoryIcon size={14} strokeWidth={3} /> View Past Games
          </Link>

          {/* Sample polaroids decoration */}
          <div className="hidden md:flex justify-center gap-10 mt-20">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="polaroid"
                style={{
                  width: 150,
                  background: cardColors[i + 1],
                  transform: `rotate(${(i - 1) * 6}deg)`,
                }}
              >
                <div className="w-full aspect-square bg-[var(--bg-paper)] border-2 border-[var(--ink)] flex items-center justify-center text-3xl font-display">
                  ?
                </div>
                <p className="absolute bottom-3 left-0 right-0 text-center font-display uppercase text-xs">
                  Who?
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Join form */}
      {mode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="nb-card p-6 sm:p-10 mt-4 max-w-xl mx-auto"
          data-testid={`${mode}-form`}
        >
          <button
            onClick={() => setMode(null)}
            data-testid="back-btn"
            className="font-body text-sm uppercase tracking-widest mb-4 hover:underline"
          >
            ← Back
          </button>
          <h2 className="font-display text-3xl sm:text-4xl uppercase mb-2">
            {mode === "create" ? "Start the Party" : "Join the Party"}
          </h2>
          <p className="font-body text-base mb-6 text-[var(--ink)]/70">
            {mode === "create"
              ? "You'll be the host. Share the link after."
              : "Hop into a friend's room and drop your pic."}
          </p>

          <div className="space-y-5">
            {mode === "join" && (
              <div>
                <label className="font-display text-sm uppercase tracking-widest block mb-2">Room Code</label>
                <input
                  data-testid="room-code-input"
                  className="nb-input uppercase tracking-widest"
                  placeholder="ABC12"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6}
                />
              </div>
            )}
            <div>
              <label className="font-display text-sm uppercase tracking-widest block mb-2">Your Name</label>
              <input
                data-testid="player-name-input"
                className="nb-input"
                placeholder="e.g. Maya"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 30))}
                maxLength={30}
              />
            </div>
            <div>
              <label className="font-display text-sm uppercase tracking-widest block mb-2">Your Safe Deck</label>
              <div data-testid="prompt-card" className="mb-3 nb-card p-4 bg-[var(--c-yellow)]">
                <div className="flex items-start gap-2">
                  <Sparkles size={18} strokeWidth={3} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-display text-[10px] uppercase tracking-widest text-[var(--ink)]/70">Time Capsule Prompt</p>
                    <p className="font-body font-bold text-base mt-1" data-testid="prompt-text">{prompt}</p>
                  </div>
                  <button
                    type="button"
                    data-testid="prompt-shuffle-btn"
                    onClick={() => setPrompt(randomPrompt(prompt))}
                    className="nb-btn px-2 py-1 bg-[var(--bg-paper)] text-xs flex items-center gap-1"
                  >
                    <Shuffle size={12} strokeWidth={3} />
                  </button>
                </div>
              </div>
              <PhotoDeck value={photos} onChange={setPhotos} max={10} testId="photo-deck" />
            </div>
            <button
              data-testid={`submit-${mode}-btn`}
              disabled={submitting}
              onClick={mode === "create" ? handleCreate : handleJoin}
              className="nb-btn w-full py-5 bg-[var(--c-peach)] text-xl flex items-center justify-center gap-2"
            >
              {submitting ? "Hold on..." : mode === "create" ? "Create & Get Link" : "Jump In"}
              {!submitting && <ArrowRight strokeWidth={3} />}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
