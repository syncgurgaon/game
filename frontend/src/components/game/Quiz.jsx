import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAudio } from "@/context/AudioContext";
import { haptic } from "@/lib/haptic";

export default function Quiz({ state, me, myPlayer }) {
  const q = state.question;
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(q.duration_s);
  const startTimeRef = useRef(Date.now());
  const { playSfx } = useAudio();
  const lastTickRef = useRef(null);

  const startedAt = useMemo(() => new Date(q.started_at).getTime(), [q.started_at]);

  useEffect(() => {
    setSelected(null);
    setAnswered(false);
    setSubmitting(false);
    startTimeRef.current = Date.now();
  }, [q.round]);

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, q.duration_s - elapsed);
      setTimeLeft(left);
      if (left <= 5 && Math.floor(left) !== lastTickRef.current && left > 0) {
        lastTickRef.current = Math.floor(left);
        playSfx("tick");
        haptic("tick");
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startedAt, q.duration_s, playSfx]);

  const handleSubmit = async (optionId) => {
    if (answered || submitting) return;
    setSelected(optionId);
    setSubmitting(true);
    haptic("medium");
    const timeTaken = Date.now() - startTimeRef.current;
    try {
      await api.post(`/rooms/${state.code}/answer`, {
        player_id: me.player_id,
        answer: optionId,
        time_taken_ms: timeTaken,
      });
      setAnswered(true);
      playSfx("click");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit");
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  };

  const pct = (timeLeft / q.duration_s) * 100;
  const isWarn = timeLeft <= 5;

  return (
    <div data-testid="quiz">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <span className="font-display text-sm uppercase tracking-widest bg-[var(--c-yellow)] border-4 border-[var(--ink)] px-3 py-1 shadow-[3px_3px_0_#1a1a1a]" data-testid="round-indicator">
          Round {q.round} / {q.total_rounds}
        </span>
        <span
          className={`font-display text-2xl ${isWarn ? "timer-warn" : ""}`}
          data-testid="timer"
        >
          {Math.ceil(timeLeft)}s
        </span>
        <span className="font-display text-sm uppercase tracking-widest bg-[var(--c-mint)] border-4 border-[var(--ink)] px-3 py-1 shadow-[3px_3px_0_#1a1a1a]" data-testid="my-score">
          Score: {myPlayer?.score ?? 0}
        </span>
      </div>

      {/* Timer bar */}
      <div className="h-6 rounded-full border-4 border-[var(--ink)] bg-[var(--bg-paper)] overflow-hidden shadow-[4px_4px_0_#1a1a1a] mb-8">
        <div
          className="h-full transition-[width] duration-100 ease-linear"
          style={{
            width: `${pct}%`,
            background: isWarn ? "var(--wrong)" : "var(--c-yellow)",
            borderRight: pct > 0 && pct < 100 ? "3px solid var(--ink)" : "none",
          }}
        />
      </div>

      <h2 className="font-display text-3xl sm:text-4xl uppercase text-center mb-6">
        Whose pic is this?
      </h2>

      {/* Polaroid */}
      <motion.div
        key={q.round}
        initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: -2, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="polaroid mx-auto"
        style={{ maxWidth: 360 }}
      >
        <span className="tape" />
        <img
          src={q.photo}
          alt="childhood"
          className="w-full aspect-square object-cover border-2 border-[var(--ink)]"
          data-testid="quiz-photo"
        />
        <p className="absolute bottom-3 left-0 right-0 text-center font-display uppercase text-base">
          ???
        </p>
      </motion.div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
        {q.options.map((opt, i) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              data-testid={`option-${i}`}
              disabled={answered || submitting}
              onClick={() => handleSubmit(opt.id)}
              className={`option-btn ${isSelected ? "selected" : ""}`}
            >
              <span className="inline-block w-8 h-8 mr-3 rounded-full border-2 border-[var(--ink)] bg-[var(--c-lavender)] text-center leading-7 font-display">
                {String.fromCharCode(65 + i)}
              </span>
              {opt.name}
            </button>
          );
        })}
      </div>

      {answered && (
        <p className="text-center font-body text-lg mt-6 text-[var(--ink)]/70" data-testid="answered-msg">
          Locked in! Waiting for everyone...
        </p>
      )}
    </div>
  );
}
