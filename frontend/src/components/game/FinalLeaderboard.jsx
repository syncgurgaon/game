import { motion } from "framer-motion";
import { Trophy, Home, RotateCcw, Download, Zap, Brain, Share2, Copy, Link } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { generateShareCard, generateStoryCard } from "@/lib/shareCard";
import { haptic } from "@/lib/haptic";

const podiumColors = ["var(--c-yellow)", "var(--c-lavender)", "var(--c-peach)"];
const podiumLabels = ["1st", "2nd", "3rd"];

export default function FinalLeaderboard({ state, me, isHost }) {
  const navigate = useNavigate();
  const [rematching, setRematching] = useState(false);
  const [sharing, setSharing] = useState(false);
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const winner = sorted[0];
  const isWinner = winner?.id === me.player_id;

  const zineStats = useMemo(() => {
    const history = state.round_history || [];
    if (history.length === 0) return null;
    // Most chaotic: highest wrong_count (guessed wrong the most)
    const chaotic = [...history].sort((a, b) => b.wrong_count - a.wrong_count)[0];
    // Hardest to guess: lowest correct rate (min correct/answered)
    const hardest = [...history].sort((a, b) => {
      const ra = a.answered_count ? a.correct_count / a.answered_count : 1;
      const rb = b.answered_count ? b.correct_count / b.answered_count : 1;
      return ra - rb;
    })[0];
    return { chaotic, hardest };
  }, [state.round_history]);

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

  const appUrl = window.location.origin;

  const shareToInsta = async () => {
    haptic("medium");
    setSharing(true);
    try {
      // Generate the story-sized card
      const blob = await generateStoryCard(state, state.code);
      if (!blob) throw new Error("Could not generate story image");

      const file = new File([blob], `whose-pic-${state.code}.png`, { type: "image/png" });

      // Try native Web Share API (works on mobile — lets user pick Instagram)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Whose Pic Is It?!",
          text: `I just played Whose Pic Is It?! 🎮🔥 Play with your crew: ${appUrl}`,
        });
        toast.success("Shared! 🎉");
      } else {
        // Desktop fallback: download image + copy link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `whose-pic-${state.code}-story.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);

        // Also copy the app link
        try {
          await navigator.clipboard.writeText(`I just played Whose Pic Is It?! 🎮🔥 Play with your crew: ${appUrl}`);
          toast.success("Story card downloaded & link copied! Paste in your Instagram story ✨");
        } catch {
          toast.success("Story card downloaded! Share it on Instagram 📲");
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        toast.error("Couldn't share — try downloading instead");
      }
    } finally {
      setSharing(false);
    }
  };

  const copyLink = async () => {
    haptic("light");
    try {
      await navigator.clipboard.writeText(`Play Whose Pic Is It?! with me 🎮 ${appUrl}`);
      toast.success("Link copied! 📋");
    } catch {
      toast.error("Couldn't copy link");
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

      {/* Afterparty Zine — chaotic + hardest cards */}
      {zineStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto mb-10" data-testid="afterparty-zine">
          <div data-testid="most-chaotic-card" className="nb-card p-5 bg-[var(--c-peach)]">
            <div className="flex items-center gap-2">
              <Zap size={18} strokeWidth={3} />
              <p className="font-display text-xs uppercase tracking-widest">Most Chaotic Pic</p>
            </div>
            <img src={zineStats.chaotic.photo} alt="chaotic" className="w-full aspect-square object-cover border-4 border-[var(--ink)] rounded-lg mt-3" />
            <p className="font-display uppercase text-lg mt-2 truncate">{zineStats.chaotic.target_name}</p>
            <p className="font-body text-xs text-[var(--ink)]/70">{zineStats.chaotic.wrong_count} wrong guesses</p>
          </div>
          <div data-testid="hardest-guess-card" className="nb-card p-5 bg-[var(--c-lavender)]">
            <div className="flex items-center gap-2">
              <Brain size={18} strokeWidth={3} />
              <p className="font-display text-xs uppercase tracking-widest">Hardest to Guess</p>
            </div>
            <img src={zineStats.hardest.photo} alt="hardest" className="w-full aspect-square object-cover border-4 border-[var(--ink)] rounded-lg mt-3" />
            <p className="font-display uppercase text-lg mt-2 truncate">{zineStats.hardest.target_name}</p>
            <p className="font-body text-xs text-[var(--ink)]/70">
              {zineStats.hardest.answered_count > 0
                ? `${Math.round((zineStats.hardest.correct_count / zineStats.hardest.answered_count) * 100)}% guessed right`
                : "no answers"}
            </p>
          </div>
        </div>
      )}

      {/* Podium - top 3 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-2xl mx-auto mb-12">
        {[1, 0, 2].map((idx) => {
          const p = top3[idx];
          if (!p) return <div key={idx} />;
          const heights = ["h-44 sm:h-60", "h-32 sm:h-44", "h-24 sm:h-32"];
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
          data-testid="share-insta-btn"
          onClick={shareToInsta}
          disabled={sharing}
          className="nb-btn px-6 py-4 text-white inline-flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }}
        >
          <Share2 strokeWidth={3} /> {sharing ? "Generating..." : "Share on Insta"}
        </button>
        <button
          data-testid="copy-link-btn"
          onClick={copyLink}
          className="nb-btn px-6 py-4 bg-[var(--c-sky)] inline-flex items-center justify-center gap-2"
        >
          <Link strokeWidth={3} /> Copy Game Link
        </button>
        <button
          data-testid="download-card-btn"
          onClick={downloadCard}
          className="nb-btn px-6 py-4 bg-[var(--c-lavender)] inline-flex items-center justify-center gap-2"
        >
          <Download strokeWidth={3} /> Download Card
        </button>
        {isHost ? (
          <button
            data-testid="play-again-btn"
            onClick={playAgain}
            disabled={rematching}
            className="nb-btn px-6 py-4 bg-[var(--c-mint)] inline-flex items-center justify-center gap-2"
          >
            <RotateCcw strokeWidth={3} /> {rematching ? "Restarting..." : "Play Again"}
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
