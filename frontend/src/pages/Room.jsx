import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Wifi, WifiOff } from "lucide-react";
import { api, buildWsUrl } from "@/lib/api";
import Lobby from "@/components/game/Lobby";
import Quiz from "@/components/game/Quiz";
import RoundResult from "@/components/game/RoundResult";
import FinalLeaderboard from "@/components/game/FinalLeaderboard";
import { FloatingReactions } from "@/components/game/Reactions";
import { useAudio } from "@/context/AudioContext";
import { haptic } from "@/lib/haptic";

// Keep-alive: proxies (Render/Cloudflare) silently drop idle WebSockets, so we
// ping well under their idle timeout and force a reconnect if pongs stop coming.
const HEARTBEAT_INTERVAL_MS = 25000;
const PONG_TIMEOUT_MS = 70000;

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [me, setMe] = useState(null);
  const [connStatus, setConnStatus] = useState("connecting"); // connecting | connected | reconnecting
  const [reactions, setReactions] = useState([]);
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const closedByUserRef = useRef(false);
  const heartbeatRef = useRef(null);
  const lastPongRef = useRef(0);
  const { playSfx } = useAudio();
  const prevStatusRef = useRef(null);

  useEffect(() => {
    // localStorage survives tab closes so a dropped player can rejoin;
    // sessionStorage fallback covers sessions from before this change.
    const stored = localStorage.getItem(`room_${code}`) || sessionStorage.getItem(`room_${code}`);
    if (!stored) {
      navigate(`/?code=${code}`, { replace: true });
      return;
    }
    setMe(JSON.parse(stored));
  }, [code, navigate]);

  useEffect(() => {
    if (!me) return;
    closedByUserRef.current = false;

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const connect = () => {
      setConnStatus(reconnectAttemptsRef.current === 0 ? "connecting" : "reconnecting");
      const ws = new WebSocket(buildWsUrl(code, me.player_id));
      wsRef.current = ws;
      ws.onopen = () => {
        if (wsRef.current !== ws) {
          ws.close(); // a newer connection superseded this one while it was opening
          return;
        }
        reconnectAttemptsRef.current = 0;
        setConnStatus("connected");
        lastPongRef.current = Date.now();
        stopHeartbeat();
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (Date.now() - lastPongRef.current > PONG_TIMEOUT_MS) {
            // Server stopped answering — the socket is dead even if the
            // browser hasn't noticed. Close it to trigger the reconnect flow.
            ws.close();
            return;
          }
          ws.send(JSON.stringify({ type: "ping" }));
        }, HEARTBEAT_INTERVAL_MS);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "pong") {
            lastPongRef.current = Date.now();
            return;
          }
          if (msg.type === "presence") {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    players: prev.players.map((p) =>
                      p.id === msg.player_id ? { ...p, connected: msg.connected } : p
                    ),
                  }
                : prev
            );
            return;
          }
          if (msg.type === "host_changed") {
            toast.info(
              msg.host_id === me.player_id ? "You're the host now 👑" : `${msg.host_name} is now the host`
            );
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    host_id: msg.host_id,
                    players: prev.players.map((p) => ({ ...p, is_host: p.id === msg.host_id })),
                  }
                : prev
            );
            return;
          }
          if (msg.type === "kicked") {
            toast.error("You were removed by the host");
            closedByUserRef.current = true;
            localStorage.removeItem(`room_${code}`);
            sessionStorage.removeItem(`room_${code}`);
            setTimeout(() => navigate("/"), 1200);
            return;
          }
          if (msg.type === "reaction") {
            const key = `${msg.player_id}-${msg.ts}-${Math.random()}`;
            const item = {
              key,
              emoji: msg.emoji,
              name: msg.name,
              x: Math.floor(Math.random() * (window.innerWidth - 100)),
              rot: (Math.random() * 30) - 15,
            };
            setReactions((rs) => [...rs.slice(-12), item]);
            haptic("tick");
            setTimeout(() => {
              setReactions((rs) => rs.filter((r) => r.key !== key));
            }, 2600);
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
                  if (myAns) {
                    playSfx(myAns.correct ? "correct" : "wrong");
                    haptic(myAns.correct ? "success" : "error");
                  }
                }
                if (newStatus === "finished") {
                  playSfx("win");
                  haptic("success");
                }
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
        if (wsRef.current !== ws) return; // stale socket — a newer connection took over
        stopHeartbeat();
        if (closedByUserRef.current) return;
        if (ev.code === 4404) {
          toast.error("Room not found or you're not a member");
          localStorage.removeItem(`room_${code}`);
          sessionStorage.removeItem(`room_${code}`);
          navigate("/");
          return;
        }
        if (ev.code === 4403) {
          // kicked — already handled
          return;
        }
        if (ev.code === 4001) {
          // replaced by a newer connection (e.g. another tab) — don't fight it
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

    // Phones suspend sockets in background tabs; reconnect the moment the tab
    // is visible again instead of waiting out the backoff timer.
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || closedByUserRef.current) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectAttemptsRef.current = 0;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    api.get(`/rooms/${code}`).catch(() => {
      toast.error("Room not found");
      navigate("/");
    });
    connect();

    return () => {
      closedByUserRef.current = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
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
    <div className="min-h-screen px-4 py-8 max-w-5xl mx-auto relative z-10" data-testid="room-page">
      <FloatingReactions items={reactions} />
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
