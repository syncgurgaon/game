import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import InitialAvatar from "@/components/InitialAvatar";

export default function RoundResult({ state, me }) {
  const q = state.question;
  const correctId = q.correct_id;
  const correctPlayer = state.players.find((p) => p.id === correctId);
  const myAns = state.round_answers?.[me.player_id];
  const isCorrect = myAns?.correct;

  return (
    <div data-testid="round-result">
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`pop-in inline-flex items-center gap-3 px-5 py-2 border-4 border-[var(--ink)] shadow-[5px_5px_0_#1a1a1a] ${
            isCorrect ? "bg-[var(--c-mint)]" : "bg-[var(--wrong)] text-white"
          }`}
        >
          {isCorrect ? <CheckCircle2 strokeWidth={3} /> : <XCircle strokeWidth={3} />}
          <span className="font-display text-xl uppercase">
            {myAns ? (isCorrect ? `Correct! +${myAns.points}` : "Wrong!") : "Time's up!"}
          </span>
        </motion.div>
      </div>

      <h2 className="font-display text-3xl sm:text-4xl uppercase text-center mb-6">
        That was{" "}
        <span className="bg-[var(--c-yellow)] border-4 border-[var(--ink)] px-3 inline-block rotate-[-2deg] shadow-[5px_5px_0_#1a1a1a]" data-testid="correct-name">
          {correctPlayer?.name || "Unknown"}
        </span>
      </h2>

      <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
        <motion.div
          initial={{ rotate: -8, opacity: 0 }}
          animate={{ rotate: -2, opacity: 1 }}
          className="polaroid"
          style={{ maxWidth: 280 }}
        >
          <span className="tape" />
          <img src={q.photo} alt="childhood" className="w-full aspect-square object-cover border-2 border-[var(--ink)]" />
          <p className="absolute bottom-3 left-0 right-0 text-center font-display uppercase text-sm">
            Now
          </p>
        </motion.div>
        {correctPlayer && (
          <motion.div
            initial={{ rotate: 8, opacity: 0 }}
            animate={{ rotate: 2, opacity: 1 }}
            className="polaroid"
            style={{ maxWidth: 280, background: "var(--c-lavender)" }}
          >
            <div className="w-full aspect-square bg-[var(--bg-paper)] border-2 border-[var(--ink)] flex items-center justify-center font-display text-6xl">
              {correctPlayer.name.charAt(0).toUpperCase()}
            </div>
            <p className="absolute bottom-3 left-0 right-0 text-center font-display uppercase text-base">
              {correctPlayer.name}
            </p>
          </motion.div>
        )}
      </div>

      {/* Mini leaderboard */}
      <div className="mt-10 max-w-md mx-auto nb-card p-5">
        <h3 className="font-display uppercase text-xl mb-4">Standings</h3>
        <div className="space-y-2">
          {[...state.players]
            .sort((a, b) => b.score - a.score)
            .map((p, i) => (
              <div
                key={p.id}
                data-testid={`standings-${p.id}`}
                className="flex items-center justify-between gap-3 bg-[var(--bg-base)] border-2 border-[var(--ink)] rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display text-sm w-6">{i + 1}.</span>
                  <InitialAvatar name={p.name} size={32} />
                  <span className="font-body truncate">{p.name}</span>
                </div>
                <span className="font-display text-lg">{p.score}</span>
              </div>
            ))}
        </div>
      </div>

      <p className="text-center font-body text-base mt-6 text-[var(--ink)]/60">
        Next round in a moment...
      </p>
    </div>
  );
}
