import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Wifi, WifiOff } from "lucide-react";
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
  const [connStatus, setConnStatus] = useState("connecting"); // connecting | connected | reconnecting
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const closedByUserRef = useRef(false);
  const { playSfx } = useAudio();
  const prevStatusRef = useRef(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(`room_${code}`);
    if (!stored) {
      navigate(`/?code=${code}`, { replace: true });
      return;
    }
    setMe(JSON.parse(stored));
  }, [code, navigate]);

  useEffect(() => {
    if (!me) return;
    closedByUserRef.current = false;

    const connect = () => {
      setConnStatus(reconnectAttemptsRef.current === 0 ? "connecting" : "reconnecting");
      const ws = new WebSocket(buildWsUrl(code, me.player_id));
      wsRef.current = ws;
      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnStatus("connected");
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "kicked") {
            toast.error("You were removed by the host");
            closedByUserRef.current = true;
            sessionStorage.removeItem(`room_${code}`);
            setTimeout(() => navigate("/"), 1200);
            return;
          }
          if (msg.type === "state") {
            setState((prev) => {
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
      ws.onerror = () => {
        // onclose will follow; don't toast here to avoid noise
      };
      ws.onclose = (ev) => {
        if (closedByUserRef.current) return;
        if (ev.code === 4404) {
          toast.error("Room not found or you're not a member");
          sessionStorage.removeItem(`room_${code}`);
          navigate("/");
          return;
        }
        if (ev.code === 4403) {
          // kicked — already handled
          return;
        }
        // Auto-reconnect with backoff
        const attempt = ++reconnectAttemptsRef.current;
        if (attempt > 8) {
          setConnStatus("reconnecting");
          toast.error("Couldn't reconnect. Please refresh the page.");
          return;
        }
        setConnStatus("reconnecting");
        const delay = Math.min(8000, 600 * Math.pow(1.6, attempt - 1));
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    api.get(`/rooms/${code}`).catch(() => {
      toast.error("Room not found");
      navigate("/");
    });
    connect();

    return () => {
      closedByUserRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [me, code, navigate, playSfx]);

  if (!me) return null;
  if (!state)
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="room-loading">
        <div className="nb-card px-8 py-6">
          <p className="font-display uppercase text-xl">Connecting...</p>
        </div>
      </div>
    );

  const isHost = state.host_id === me.player_id;
  const myPlayer = state.players.find((p) => p.id === me.player_id);

  return (
    <div className="min-h-screen px-4 py-8 max-w-5xl mx-auto" data-testid="room-page">
      {connStatus === "reconnecting" && (
        <div
          data-testid="reconnect-banner"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-[var(--c-yellow)] border-4 border-[var(--ink)] shadow-[4px_4px_0_#1a1a1a] px-4 py-2 flex items-center gap-2 rounded-lg"
        >
          <WifiOff size={18} strokeWidth={3} />
          <span className="font-display uppercase text-sm">Reconnecting...</span>
        </div>
      )}
      {connStatus === "connected" && state.status !== "lobby" && (
        <div className="fixed bottom-4 left-4 z-30 bg-[var(--c-mint)] border-2 border-[var(--ink)] rounded-full px-3 py-1 flex items-center gap-1 shadow-[2px_2px_0_#1a1a1a]" data-testid="conn-ok">
          <Wifi size={14} strokeWidth={3} />
          <span className="font-display uppercase text-[10px]">Live</span>
        </div>
      )}
      {state.status === "lobby" && <Lobby state={state} me={me} isHost={isHost} />}
      {state.status === "playing" && state.question && (
        <Quiz state={state} me={me} myPlayer={myPlayer} />
      )}
      {state.status === "round_result" && state.question && (
        <RoundResult state={state} me={me} />
      )}
      {state.status === "finished" && (
        <FinalLeaderboard state={state} me={me} isHost={isHost} />
      )}
    </div>
  );
}
