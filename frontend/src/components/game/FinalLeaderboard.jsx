import { motion } from "framer-motion";
import { Trophy, Home, RotateCcw, Download } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { generateShareCard } from "@/lib/shareCard";
import { haptic } from "@/lib/haptic";

const podiumColors = ["var(--c-yellow)", "var(--c-lavender)", "var(--c-peach)"];
const podiumLabels = ["1st", "2nd", "3rd"];

export default function FinalLeaderboard({ state, me, isHost }) {
  const navigate = useNavigate();
  const [rematching, setRematching] = useState(false);
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const winner = sorted[0];
  const isWinner = winner?.id === me.player_id;

  const goHome = () => {
    sessionStorage.removeItem(`room_${state.code}`);
    navigate("/");
  };

  const playAgain = async () => {
    setRematching(true);
    try {
      await api.post(`/rooms/${state.code}/rematch`, { player_id: me.player_id });
      toast.success("New round, same crew!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't start rematch");
    } finally {
      setRematching(false);
    }
  };

  const downloadCard = async () => {
    haptic("light");
    try {
      const blob = await generateShareCard(state, state.code);
      if (!blob) throw new Error("Could not generate image");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiz-${state.code}-results.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success("Card downloaded! Share it 📲");
    } catch (err) {
      toast.error("Couldn't generate card");
    }
  };

  return (
    <div data-testid="final-leaderboard">
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-flex items-center gap-2 bg-[var(--c-yellow)] border-4 border-[var(--ink)] px-5 py-2 shadow-[6px_6px_0_#1a1a1a]"
        >
          <Trophy strokeWidth={3} />
          <span className="font-display text-xl uppercase">Game Over</span>
        </motion.div>
        <h1 className="font-display text-5xl sm:text-7xl uppercase mt-6" data-testid="winner-title">
          {isWinner ? "You Won!" : `${winner?.name} Wins!`}
        </h1>
      </div>

      {/* Podium - top 3 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-2xl mx-auto mb-12">
        {[1, 0, 2].map((idx) => {
          const p = top3[idx];
          if (!p) return <div key={idx} />;
          const heights = ["h-32 sm:h-44", "h-44 sm:h-60", "h-24 sm:h-32"];
          return (
            <motion.div
              key={p.id}
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + idx * 0.15 }}
              className="flex flex-col items-center"
              data-testid={`podium-${idx + 1}`}
            >
              <img
                src={p.photo}
                alt={p.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[var(--ink)] object-cover shadow-[3px_3px_0_#1a1a1a]"
              />
              <p className="font-display uppercase mt-2 text-sm sm:text-base truncate max-w-full">{p.name}</p>
              <p className="font-display text-2xl">{p.score}</p>
              <div
                className={`mt-2 w-full ${heights[idx]} border-4 border-[var(--ink)] shadow-[4px_4px_0_#1a1a1a] rounded-t-xl flex items-center justify-center`}
                style={{ background: podiumColors[idx] }}
              >
                <span className="font-display text-2xl sm:text-3xl">{podiumLabels[idx]}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Full ranking */}
      {rest.length > 0 && (
        <div className="nb-card p-5 max-w-xl mx-auto">
          <h3 className="font-display uppercase text-lg mb-3">Also playing</h3>
          <div className="space-y-2">
            {rest.map((p, i) => (
              <div
                key={p.id}
                data-testid={`rank-${i + 4}`}
                className="flex items-center justify-between bg-[var(--bg-base)] border-2 border-[var(--ink)] rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm w-6">{i + 4}.</span>
                  <img src={p.photo} alt={p.name} className="w-8 h-8 rounded-full border-2 border-[var(--ink)] object-cover" />
                  <span className="font-body">{p.name}</span>
                </div>
                <span className="font-display">{p.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12 flex-wrap">
        <button
          data-testid="download-card-btn"
          onClick={downloadCard}
          className="nb-btn px-6 py-4 bg-[var(--c-lavender)] inline-flex items-center justify-center gap-2"
        >
          <Download strokeWidth={3} /> Download Share Card
        </button>
        {isHost ? (
          <button
            data-testid="play-again-btn"
            onClick={playAgain}
            disabled={rematching}
            className="nb-btn px-6 py-4 bg-[var(--c-mint)] inline-flex items-center justify-center gap-2"
          >
            <RotateCcw strokeWidth={3} /> {rematching ? "Restarting..." : "Play Again, Same Crew"}
          </button>
        ) : (
          <div
            data-testid="waiting-rematch-msg"
            className="font-body text-base text-[var(--ink)]/70 inline-flex items-center justify-center px-6 py-4"
          >
            Waiting for the host to start a rematch...
          </div>
        )}
        <button
          data-testid="go-home-btn"
          onClick={goHome}
          className="nb-btn px-6 py-4 bg-[var(--bg-paper)] inline-flex items-center justify-center gap-2"
        >
          <Home strokeWidth={3} /> Leave
        </button>
      </div>
    </div>
  );
}
