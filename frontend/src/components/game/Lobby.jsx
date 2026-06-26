import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Play, Users, Crown } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const playerCardColors = ["var(--c-yellow)", "var(--c-mint)", "var(--c-lavender)", "var(--c-peach)", "var(--c-pink)", "var(--c-sky)"];

export default function Lobby({ state, me, isHost, myPlayer }) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const shareUrl = `${window.location.origin}/?code=${state.code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const startGame = async () => {
    setStarting(true);
    try {
      await api.post(`/rooms/${state.code}/start?player_id=${me.player_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div data-testid="lobby">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-display text-sm uppercase tracking-widest bg-[var(--c-yellow)] border-4 border-[var(--ink)] px-3 py-1 shadow-[3px_3px_0_#1a1a1a]">
          Lobby
        </span>
        {isHost && (
          <span className="font-display text-sm uppercase tracking-widest bg-[var(--c-peach)] border-4 border-[var(--ink)] px-3 py-1 shadow-[3px_3px_0_#1a1a1a] flex items-center gap-1">
            <Crown size={14} strokeWidth={3} /> You're the Host
          </span>
        )}
      </div>
      <h1 className="font-display text-4xl sm:text-6xl uppercase mt-3" data-testid="lobby-title">
        Room <span className="bg-[var(--c-mint)] border-4 border-[var(--ink)] px-3 inline-block rotate-[-1.5deg] shadow-[6px_6px_0_#1a1a1a]" data-testid="room-code-display">{state.code}</span>
      </h1>
      <p className="font-body text-lg mt-4 text-[var(--ink)]/70 max-w-2xl">
        Share the link below. Once friends join with their pics, hit Start.
      </p>

      <div className="nb-card p-5 sm:p-6 mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <code data-testid="share-link" className="font-body text-sm sm:text-base break-all bg-[var(--bg-base)] border-2 border-[var(--ink)] rounded-lg px-3 py-2 flex-1">
          {shareUrl}
        </code>
        <button
          data-testid="copy-link-btn"
          onClick={copyLink}
          className="nb-btn px-5 py-3 bg-[var(--c-lavender)] flex items-center gap-2 justify-center"
        >
          {copied ? <Check size={18} strokeWidth={3} /> : <Copy size={18} strokeWidth={3} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Users strokeWidth={3} />
          <h2 className="font-display text-2xl uppercase">
            Players ({state.players.length})
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {state.players.map((p, i) => (
            <motion.div
              key={p.id}
              data-testid={`player-card-${p.id}`}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="polaroid"
              style={{
                background: playerCardColors[i % playerCardColors.length],
                transform: `rotate(${(i % 2 === 0 ? -2 : 2)}deg)`,
              }}
            >
              <img src={p.photo} alt={p.name} className="w-full aspect-square object-cover border-2 border-[var(--ink)]" />
              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 px-2">
                {p.is_host && <Crown size={14} strokeWidth={3} />}
                <p className="font-display uppercase text-sm truncate">{p.name}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="mt-12 text-center">
          <button
            data-testid="start-game-btn"
            disabled={starting || state.players.length < 2}
            onClick={startGame}
            className="nb-btn px-10 py-5 bg-[var(--c-peach)] text-2xl inline-flex items-center gap-3"
          >
            <Play strokeWidth={3} /> {starting ? "Starting..." : "Start Game"}
          </button>
          {state.players.length < 2 && (
            <p className="font-body text-sm mt-3 text-[var(--ink)]/60">
              Need at least 2 players to begin
            </p>
          )}
        </div>
      )}
      {!isHost && (
        <p className="font-body text-center text-lg mt-12 text-[var(--ink)]/70" data-testid="waiting-host-msg">
          Waiting for the host to start the game...
        </p>
      )}
    </div>
  );
}
