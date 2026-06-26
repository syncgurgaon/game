import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";

const EMOJIS = ["😂", "😱", "👍", "❤️", "🔥", "🤯", "😭", "🥹"];

export default function ReactionBar({ code, me }) {
  const [sending, setSending] = useState(false);

  const send = async (emoji) => {
    if (sending) return;
    setSending(true);
    haptic("light");
    try {
      await api.post(`/rooms/${code}/react`, { player_id: me.player_id, emoji });
    } catch (err) {
      console.warn("reaction send failed", err);
    } finally {
      setTimeout(() => setSending(false), 120);
    }
  };

  return (
    <div
      data-testid="reaction-bar"
      className="nb-card p-3 mt-8 mx-auto max-w-md flex flex-wrap justify-center gap-2"
    >
      {EMOJIS.map((e) => (
        <button
          key={e}
          data-testid={`react-${e}`}
          onClick={() => send(e)}
          className="w-11 h-11 flex items-center justify-center text-2xl bg-[var(--bg-base)] border-2 border-[var(--ink)] rounded-lg shadow-[2px_2px_0_#1a1a1a] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#1a1a1a] active:scale-95 transition-all"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export function FloatingReactions({ items }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" data-testid="floating-reactions">
      <AnimatePresence>
        {items.map((r) => (
          <motion.div
            key={r.key}
            initial={{ y: window.innerHeight - 100, x: r.x, opacity: 0, scale: 0.4 }}
            animate={{ y: 80, opacity: [0, 1, 1, 0], scale: 1, rotate: r.rot }}
            transition={{ duration: 2.4, ease: "easeOut" }}
            exit={{ opacity: 0 }}
            className="absolute text-5xl select-none"
            style={{ left: 0, top: 0 }}
          >
            <span>{r.emoji}</span>
            <span className="block font-display text-xs uppercase mt-1 bg-[var(--bg-paper)] border-2 border-[var(--ink)] px-2 py-0.5 rounded shadow-[2px_2px_0_#1a1a1a]">
              {r.name}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
