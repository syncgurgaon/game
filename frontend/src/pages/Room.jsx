import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, buildWsUrl } from "@/lib/api";
import Lobby from "@/components/game/Lobby";
import Quiz from "@/components/game/Quiz";
import RoundResult from "@/components/game/RoundResult";
import FinalLeaderboard from "@/components/game/FinalLeaderboard";
import { useAudio } from "@/context/AudioContext";

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [me, setMe] = useState(null);
  const [needsJoin, setNeedsJoin] = useState(false);
  const wsRef = useRef(null);
  const { playSfx } = useAudio();
  const prevStatusRef = useRef(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(`room_${code}`);
    if (!stored) {
      // Not joined yet - redirect to home with prefilled code
      navigate(`/?code=${code}`, { replace: true });
      setNeedsJoin(true);
      return;
    }
    setMe(JSON.parse(stored));
  }, [code, navigate]);

  useEffect(() => {
    if (!me) return;
    const url = buildWsUrl(code, me.player_id);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "kicked") {
          toast.error("You were removed by the host");
          sessionStorage.removeItem(`room_${code}`);
          setTimeout(() => navigate("/"), 1200);
          return;
        }
        if (msg.type === "state") {
          setState((prev) => {
            // play sound effects on transitions
            const prevStatus = prevStatusRef.current;
            const newStatus = msg.state.status;
            if (prevStatus !== newStatus) {
              if (newStatus === "playing") playSfx("click");
              if (newStatus === "round_result") {
                const myAns = msg.state.round_answers?.[me.player_id];
                if (myAns) playSfx(myAns.correct ? "correct" : "wrong");
              }
              if (newStatus === "finished") playSfx("win");
              prevStatusRef.current = newStatus;
            }
            // also: detect new player joined while in lobby
            if (prev && prev.status === "lobby" && newStatus === "lobby") {
              if (msg.state.players.length > prev.players.length) playSfx("join");
            }
            return msg.state;
          });
        }
      } catch (e) {
        console.error("WS parse error", e);
      }
    };
    ws.onerror = () => toast.error("Connection issue. Trying to reconnect...");
    ws.onclose = (ev) => {
      if (ev.code === 4404) {
        toast.error("Room not found or you're not a member");
        sessionStorage.removeItem(`room_${code}`);
        navigate("/");
      } else if (ev.code === 4403) {
        // already handled by 'kicked' message
      }
    };
    // Also fetch initial state via REST
    api.get(`/rooms/${code}`).catch(() => {
      toast.error("Room not found");
      navigate("/");
    });

    return () => ws.close();
  }, [me, code, navigate, playSfx]);

  if (needsJoin || !me) return null;
  if (!state)
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="room-loading">
        <div className="nb-card px-8 py-6">
          <p className="font-display uppercase text-xl">Connecting...</p>
        </div>
      </div>
    );

  const myPlayer = state.players.find((p) => p.id === me.player_id);
  const isHost = state.host_id === me.player_id;

  return (
    <div className="min-h-screen px-4 py-8 max-w-5xl mx-auto" data-testid="room-page">
      {state.status === "lobby" && (
        <Lobby state={state} me={me} isHost={isHost} myPlayer={myPlayer} />
      )}
      {state.status === "playing" && state.question && (
        <Quiz state={state} me={me} myPlayer={myPlayer} />
      )}
      {state.status === "round_result" && state.question && (
        <RoundResult state={state} me={me} />
      )}
      {state.status === "finished" && (
        <FinalLeaderboard state={state} me={me} />
      )}
    </div>
  );
}
