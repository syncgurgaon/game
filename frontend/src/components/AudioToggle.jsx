import { Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/context/AudioContext";

export default function AudioToggle() {
  const { musicOn, toggleMusic } = useAudio();
  return (
    <button
      data-testid="audio-toggle-btn"
      onClick={toggleMusic}
      className="nb-btn fixed top-4 right-4 z-50 px-4 py-3 bg-[var(--c-lavender)] flex items-center gap-2"
      aria-label="Toggle music"
    >
      {musicOn ? <Volume2 size={20} strokeWidth={3} /> : <VolumeX size={20} strokeWidth={3} />}
      <span className="text-sm hidden sm:inline">{musicOn ? "Music On" : "Music Off"}</span>
    </button>
  );
}
