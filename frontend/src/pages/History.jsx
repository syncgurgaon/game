import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, Calendar } from "lucide-react";
import { api } from "@/lib/api";

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function History() {
  const [games, setGames] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/games?limit=30")
      .then((r) => setGames(r.data.games || []))
      .catch((e) => setError(e.message || "Failed to load"));
  }, []);

  return (
    <div className="min-h-screen px-4 py-10 max-w-4xl mx-auto" data-testid="history-page">
      <Link
        to="/"
        data-testid="history-back-btn"
        className="font-body text-sm uppercase tracking-widest inline-flex items-center gap-2 mb-6 hover:underline"
      >
        <ArrowLeft size={16} strokeWidth={3} /> Back
      </Link>
      <h1 className="font-display text-4xl sm:text-6xl uppercase">
        Hall of{" "}
        <span className="bg-[var(--c-yellow)] border-4 border-[var(--ink)] px-3 inline-block rotate-[-2deg] shadow-[6px_6px_0_#1a1a1a]">
          Fame
        </span>
      </h1>
      <p className="font-body text-base sm:text-lg mt-4 text-[var(--ink)]/70">
        Every finished game, freshest first. Bragging rights eternal.
      </p>

      {error && (
        <div className="nb-card p-5 mt-8 bg-[var(--wrong)] text-white" data-testid="history-error">
          {error}
        </div>
      )}

      {!games && !error && (
        <p className="font-display uppercase mt-8" data-testid="history-loading">Loading...</p>
      )}

      {games && games.length === 0 && (
        <div className="nb-card p-8 mt-8 text-center" data-testid="history-empty">
          <p className="font-display uppercase text-2xl">No games yet</p>
          <p className="font-body mt-3 text-[var(--ink)]/70">
            Finish one with your crew and it'll show up here.
          </p>
        </div>
      )}

      {games && games.length > 0 && (
        <div className="space-y-4 mt-8" data-testid="history-list">
          {games.map((g, idx) => {
            const winner = g.results?.[0];
            return (
              <div
                key={`${g.code}-${g.finished_at}-${idx}`}
                data-testid={`history-item-${idx}`}
                className="nb-card p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-display text-xs uppercase tracking-widest text-[var(--ink)]/60 flex items-center gap-1">
                      <Calendar size={12} strokeWidth={3} /> {formatDate(g.finished_at)} · Room {g.code}
                    </p>
                    <p className="font-display text-2xl uppercase mt-1 flex items-center gap-2">
                      <Trophy size={20} strokeWidth={3} /> {winner?.name || "?"} won
                    </p>
                  </div>
                  <span className="font-display text-sm bg-[var(--c-mint)] border-4 border-[var(--ink)] px-3 py-1 shadow-[3px_3px_0_#1a1a1a]">
                    {g.rounds_played} rounds
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {(g.results || []).slice(0, 8).map((r, i) => (
                    <div
                      key={r.id}
                      className="bg-[var(--bg-base)] border-2 border-[var(--ink)] rounded-lg px-2 py-1.5 flex items-center justify-between gap-2"
                    >
                      <span className="font-body text-sm truncate">{i + 1}. {r.name}</span>
                      <span className="font-display text-sm">{r.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
