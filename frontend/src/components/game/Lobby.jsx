import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Play, Users, Crown, X, Settings, EyeOff, Camera } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import InitialAvatar from "@/components/InitialAvatar";
import PhotoUpload from "@/components/PhotoUpload";

const playerCardColors = [
  "var(--c-yellow)",
  "var(--c-mint)",
  "var(--c-lavender)",
  "var(--c-peach)",
  "var(--c-pink)",
  "var(--c-sky)",
];

const DURATIONS = [10, 15, 20, 30];

export default function Lobby({ state, me, isHost }) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);
  const [newPhoto, setNewPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const shareUrl = `${window.location.origin}/?code=${state.code}`;
  const duration = state.round_duration_s || 15;
  const roundsSetting = state.rounds_count_setting || 0; // 0 = all players
  const myPlayer = state.players.find((p) => p.id === me.player_id);
  const needsPhoto = myPlayer && !myPlayer.photo_ready;
  const pendingCount = state.players.filter((p) => !p.photo_ready).length;
  const canStart = state.players.length >= 2 && pendingCount === 0;

  const uploadPhoto = async () => {
    if (!newPhoto) return;
    setUploading(true);
    try {
      await api.post(`/rooms/${state.code}/photo`, { player_id: me.player_id, photo: newPhoto });
      toast.success("Photo uploaded!");
      setNewPhoto("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

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

  const updateSetting = async (patch) => {
    setSavingSetting(true);
    try {
      await api.post(`/rooms/${state.code}/settings`, { player_id: me.player_id, ...patch });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update");
    } finally {
      setSavingSetting(false);
    }
  };

  const kickPlayer = async (targetId, name) => {
    try {
      await api.post(`/rooms/${state.code}/kick?player_id=${me.player_id}&target_id=${targetId}`);
      toast.success(`${name} removed`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to kick");
    }
  };

  return (
    <div data-testid="lobby">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="font-display text-sm uppercase tracking-widest bg-[var(--c-yellow)] border-4 border-[var(--ink)] px-3 py-1 shadow-[3px_3px_0_#1a1a1a]">
          Lobby
        </span>
        {isHost && (
          <span className="font-display text-sm uppercase tracking-widest bg-[var(--c-peach)] border-4 border-[var(--ink)] px-3 py-1 shadow-[3px_3px_0_#1a1a1a] flex items-center gap-1">
            <Crown size={14} strokeWidth={3} /> You&apos;re the Host
          </span>
        )}
      </div>
      <h1 className="font-display text-4xl sm:text-6xl uppercase mt-3" data-testid="lobby-title">
        Room{" "}
        <span
          className="bg-[var(--c-mint)] border-4 border-[var(--ink)] px-3 inline-block rotate-[-1.5deg] shadow-[6px_6px_0_#1a1a1a]"
          data-testid="room-code-display"
        >
          {state.code}
        </span>
      </h1>
      <p className="font-body text-lg mt-4 text-[var(--ink)]/70 max-w-2xl">
        Share the link. Everyone drops any pic from their phone — meme, screenshot, throwback, anything. Pics stay <span className="font-display uppercase">hidden</span> until their round!
      </p>

      {needsPhoto && (
        <div className="nb-card p-5 sm:p-6 mt-6 bg-[var(--c-peach)]" data-testid="reupload-card">
          <div className="flex items-center gap-2 mb-3">
            <Camera strokeWidth={3} size={20} />
            <h3 className="font-display uppercase text-xl">Drop Your Pic</h3>
          </div>
          <p className="font-body text-sm mb-4">Anything from your phone — meme, screenshot, throwback, chaotic selfie. The crew will guess it&apos;s you.</p>
          <PhotoUpload value={newPhoto} onChange={setNewPhoto} testId="reupload" />
          {newPhoto && (
            <button
              data-testid="reupload-submit-btn"
              disabled={uploading}
              onClick={uploadPhoto}
              className="nb-btn mt-4 w-full py-3 bg-[var(--c-mint)]"
            >
              {uploading ? "Uploading..." : "Submit Photo"}
            </button>
          )}
        </div>
      )}

      <div className="nb-card p-5 sm:p-6 mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <code
          data-testid="share-link"
          className="font-body text-sm sm:text-base break-all bg-[var(--bg-base)] border-2 border-[var(--ink)] rounded-lg px-3 py-2 flex-1"
        >
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

      {/* Host Settings */}
      {isHost && (
        <div className="nb-card p-5 sm:p-6 mt-6" data-testid="host-settings">
          <div className="flex items-center gap-2 mb-4">
            <Settings strokeWidth={3} size={20} />
            <h3 className="font-display uppercase text-xl">Game Settings</h3>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="font-display text-xs uppercase tracking-widest mb-2">
                Round Duration
              </p>
              <div className="flex flex-wrap gap-2" data-testid="duration-options">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    data-testid={`duration-${d}`}
                    disabled={savingSetting}
                    onClick={() => updateSetting({ round_duration_s: d })}
                    className={`nb-btn px-3 py-2 text-sm ${
                      duration === d ? "bg-[var(--c-yellow)]" : "bg-[var(--bg-paper)]"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-display text-xs uppercase tracking-widest mb-2">
                Number of Rounds
              </p>
              <div className="flex flex-wrap gap-2" data-testid="rounds-options">
                <button
                  data-testid="rounds-all"
                  disabled={savingSetting}
                  onClick={() => updateSetting({ rounds_count: 0 })}
                  className={`nb-btn px-3 py-2 text-sm ${
                    roundsSetting === 0 ? "bg-[var(--c-mint)]" : "bg-[var(--bg-paper)]"
                  }`}
                >
                  All players ({state.players.length})
                </button>
                {[3, 5, 8].map((n) =>
                  n < state.players.length ? (
                    <button
                      key={n}
                      data-testid={`rounds-${n}`}
                      disabled={savingSetting}
                      onClick={() => updateSetting({ rounds_count: n })}
                      className={`nb-btn px-3 py-2 text-sm ${
                        roundsSetting === n ? "bg-[var(--c-mint)]" : "bg-[var(--bg-paper)]"
                      }`}
                    >
                      {n}
                    </button>
                  ) : null
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Users strokeWidth={3} />
          <h2 className="font-display text-2xl uppercase">
            Players ({state.players.length})
          </h2>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-body text-[var(--ink)]/60 uppercase tracking-widest">
            <EyeOff size={14} strokeWidth={3} /> Photos hidden
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {state.players.map((p, i) => (
            <motion.div
              key={p.id}
              data-testid={`player-card-${p.id}`}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: p.connected ? 1 : 0.5 }}
              className="nb-card p-5 flex flex-col items-center gap-3 relative"
              style={{
                background: playerCardColors[i % playerCardColors.length],
                transform: `rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)`,
                filter: p.connected ? "none" : "grayscale(0.6)",
              }}
            >
              {isHost && p.id !== me.player_id && (
                <button
                  data-testid={`kick-${p.id}`}
                  onClick={() => kickPlayer(p.id, p.name)}
                  className="absolute -top-3 -right-3 bg-[var(--wrong)] text-white border-4 border-[var(--ink)] rounded-full w-9 h-9 flex items-center justify-center shadow-[2px_2px_0_#1a1a1a] hover:scale-105 transition-transform"
                  aria-label={`Kick ${p.name}`}
                >
                  <X size={18} strokeWidth={3} />
                </button>
              )}
              <InitialAvatar name={p.name} size={64} testId={`avatar-${p.id}`} />
              <div className="flex items-center gap-1.5">
                {p.is_host && <Crown size={14} strokeWidth={3} />}
                <p className="font-display uppercase text-sm truncate max-w-[120px]">{p.name}</p>
              </div>
              <p className="font-body text-xs uppercase tracking-widest text-[var(--ink)]/60">
                {!p.connected ? "Left" : p.photo_ready ? "Photo locked" : "Uploading..."}
              </p>
              {!p.connected && (
                <span
                  data-testid={`disconnected-${p.id}`}
                  className="absolute top-2 left-2 bg-[var(--wrong)] text-white border-2 border-[var(--ink)] rounded-full px-2 py-0.5 text-[10px] font-display uppercase shadow-[2px_2px_0_#1a1a1a]"
                >
                  Left
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="mt-12 text-center">
          <button
            data-testid="start-game-btn"
            disabled={starting || !canStart}
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
          {state.players.length >= 2 && pendingCount > 0 && (
            <p data-testid="pending-photos-msg" className="font-body text-sm mt-3 text-[var(--ink)]/60">
              Waiting for {pendingCount} player{pendingCount > 1 ? "s" : ""} to upload a photo...
            </p>
          )}
        </div>
      )}
      {!isHost && (
        <p
          className="font-body text-center text-lg mt-12 text-[var(--ink)]/70"
          data-testid="waiting-host-msg"
        >
          Waiting for the host to start the game...
        </p>
      )}
    </div>
  );
}
