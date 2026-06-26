import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, Calendar, Search, Star } from "lucide-react";
import { api } from "@/lib/api";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function History() {
  const [games, setGames] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/games?limit=50"),
      api.get("/stats/players?limit=12"),
    ])
      .then(([g, s]) => { setGames(g.data.games || []); setStats(s.data.players || []); })
      .catch((e) => setError(e.message || "Failed to load"));
  }, []);

  const filtered = useMemo(() => {
    if (!games) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) =>
      (g.code || "").toLowerCase().includes(q) ||
      (g.results || []).some((r) => (r.name || "").toLowerCase().includes(q))
    );
  }, [games, filter]);

  return (
    <div className="min-h-screen px-4 py-10 max-w-4xl mx-auto" data-testid="history-page">
      <Link to="/" data-testid="history-back-btn" className="font-body text-sm uppercase tracking-widest inline-flex items-center gap-2 mb-6 hover:underline">
        <ArrowLeft size={16} strokeWidth={3} /> Back
      </Link>
      <h1 className="font-display text-4xl sm:text-6xl uppercase">
        Hall of <span className="bg-[var(--c-yellow)] border-4 border-[var(--ink)] px-3 inline-block rotate-[-2deg] shadow-[6px_6px_0_#1a1a1a]">Fame</span>
      </h1>
      <p className="font-body text-base sm:text-lg mt-4 text-[var(--ink)]/70">
        Every finished game, freshest first. Bragging rights eternal.
      </p>

      {error && <div className="nb-card p-5 mt-8 bg-[var(--wrong)] text-white" data-testid="history-error">{error}</div>}

      {/* Top Players */}
      {stats && stats.length > 0 && (
        <div className="mt-8" data-testid="top-players">
          <h2 className="font-display text-2xl uppercase mb-3 inline-flex items-center gap-2">
            <Star size={20} strokeWidth={3} /> Top Players
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {stats.map((p, i) => (
              <div key={`${p.name}-${i}`} data-testid={`top-player-${i}`} className="nb-card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-display uppercase text-lg truncate">{i + 1}. {p.name}</p>
                  <span className="font-display text-xs bg-[var(--c-yellow)] border-2 border-[var(--ink)] px-2 py-0.5">
                    {p.wins}W
                  </span>
                </div>
                <p className="font-body text-sm mt-1 text-[var(--ink)]/70">
                  {p.games_played} games · avg {Math.round(p.avg_score)} · best {p.best_score}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mt-10 relative">
        <Search size={18} strokeWidth={3} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/60" />
        <input
          data-testid="history-filter"
          className="nb-input pl-10"
          placeholder="Filter by room code or player name"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {!games && !error && <p className="font-display uppercase mt-8" data-testid="history-loading">Loading...</p>}

      {games && filtered.length === 0 && !error && (
        <div className="nb-card p-8 mt-6 text-center" data-testid="history-empty">
          <p className="font-display uppercase text-2xl">No games match</p>
          <p className="font-body mt-3 text-[var(--ink)]/70">
            {games.length === 0 ? "Finish one with your crew and it'll show up here." : "Try a different room code or name."}
          </p>
        </div>
      )}

      {games && filtered.length > 0 && (
        <div className="space-y-4 mt-6" data-testid="history-list">
          {filtered.map((g, idx) => {
            const winner = g.results?.[0];
            return (
              <div key={`${g.code}-${g.finished_at}-${idx}`} data-testid={`history-item-${idx}`} className="nb-card p-5 sm:p-6">
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
                    <div key={r.id} className="bg-[var(--bg-base)] border-2 border-[var(--ink)] rounded-lg px-2 py-1.5 flex items-center justify-between gap-2">
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
