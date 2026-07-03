import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * Background3D — multi-layered decorative background.
 *
 * LAYER 1 (CSS-only): Warm animated gradient mesh — creates an ambient,
 *   living atmosphere. Runs 100% on the compositor thread.
 *
 * LAYER 2 (CSS-only): Soft, blurred organic blobs that drift slowly.
 *   These use CSS @keyframes so they never interfere with scroll.
 *
 * LAYER 3 (Desktop only): Neo-brutalist emoji shapes with cursor parallax
 *   via framer-motion. On mobile, shapes use pure CSS float animation.
 *
 * Psychology:
 *   - Warm gradient → social warmth & belonging (Lakens et al.)
 *   - Organic blob shapes → biophilic comfort (Kellert)
 *   - Layered depth → perceived premium quality
 *   - Gentle motion → "living" feel → sustained engagement
 */

/* ─── Emoji shapes (Layer 3) ─── */
const SHAPES = [
  { emoji: "📸", x: "8%", y: "18%", depth: 0.9, size: 76, rot: -12, color: "var(--c-yellow)" },
  { emoji: "🎉", x: "82%", y: "12%", depth: 0.7, size: 64, rot: 10, color: "var(--c-mint)" },
  { emoji: "⭐", x: "14%", y: "72%", depth: 0.55, size: 54, rot: -6, color: "var(--c-lavender)" },
  { emoji: "❓", x: "88%", y: "68%", depth: 0.85, size: 72, rot: 8, color: "var(--c-peach)" },
  { emoji: "💾", x: "50%", y: "8%", depth: 0.35, size: 46, rot: -4, color: "var(--c-sky)" },
  { emoji: "🖼️", x: "70%", y: "42%", depth: 0.5, size: 50, rot: 12, color: "var(--c-pink)" },
  { emoji: "✨", x: "30%", y: "40%", depth: 0.3, size: 40, rot: -10, color: "var(--c-mint)" },
  { emoji: "🔮", x: "44%", y: "82%", depth: 0.65, size: 58, rot: 6, color: "var(--c-lavender)" },
];

/* ─── Ambient blobs (Layer 2) — soft, blurred, organic ─── */
const BLOBS = [
  { color: "rgba(255,232,115,0.25)", x: "15%", y: "20%", size: 220, dur: 18, delay: 0 },
  { color: "rgba(180,162,254,0.2)",  x: "75%", y: "15%", size: 260, dur: 22, delay: 2 },
  { color: "rgba(123,241,168,0.2)",  x: "65%", y: "60%", size: 200, dur: 20, delay: 4 },
  { color: "rgba(255,138,91,0.18)",  x: "20%", y: "70%", size: 240, dur: 24, delay: 1 },
  { color: "rgba(168,220,255,0.2)",  x: "50%", y: "40%", size: 180, dur: 16, delay: 3 },
];

/* ─── Inject CSS keyframes once ─── */
function ensureStyles() {
  if (document.getElementById("bg3d-styles")) return;
  const style = document.createElement("style");
  style.id = "bg3d-styles";
  style.textContent = `
    /* Layer 1: Animated gradient mesh */
    @keyframes bg3d-gradient {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* Layer 2: Blob drift */
    @keyframes bg3d-blob {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25%      { transform: translate(30px, -20px) scale(1.05); }
      50%      { transform: translate(-20px, 15px) scale(0.95); }
      75%      { transform: translate(15px, 25px) scale(1.02); }
    }

    /* Layer 3 mobile: gentle float */
    @keyframes bg3d-float {
      0%, 100% { transform: translateY(0) rotate(var(--bg3d-rot)); }
      50%      { transform: translateY(-12px) rotate(var(--bg3d-rot-end)); }
    }
  `;
  document.head.appendChild(style);
}

/* ─── Desktop emoji shape (framer-motion parallax) ─── */
function DesktopShape({ shape, tiltX, tiltY }) {
  const { emoji, x, y, depth, size, rot, color } = shape;
  const px = useTransform(tiltX, (v) => v * depth * 40);
  const py = useTransform(tiltY, (v) => v * depth * 40);
  const translateZ = -160 + depth * 260;

  return (
    <motion.div
      style={{ position: "absolute", left: x, top: y, x: px, y: py, translateZ, zIndex: Math.round(depth * 10) }}
    >
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{
          opacity: 0.35 + depth * 0.5, scale: 1,
          y: [0, -14, 0], rotate: [rot, rot + 4, rot],
        }}
        transition={{
          opacity: { duration: 0.8 }, scale: { duration: 0.8 },
          y: { duration: 6 + depth * 4, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 8 + depth * 3, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{
          width: size, height: size,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.5, background: color,
          border: "4px solid var(--ink)", borderRadius: 16,
          boxShadow: `${6 * depth + 2}px ${6 * depth + 2}px 0 var(--ink)`,
          filter: depth < 0.5 ? `blur(${(0.5 - depth) * 3}px)` : "none",
          userSelect: "none",
        }}
      >
        {emoji}
      </motion.div>
    </motion.div>
  );
}

/* ─── Mobile emoji shape (pure CSS, zero JS animation) ─── */
function MobileShape({ shape }) {
  const { emoji, x, y, depth, size, rot, color } = shape;
  const dur = `${6 + depth * 5}s`;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute", left: x, top: y,
        zIndex: Math.round(depth * 10),
        opacity: 0.3 + depth * 0.45,
        animation: `bg3d-float ${dur} ease-in-out infinite`,
        "--bg3d-rot": `${rot}deg`,
        "--bg3d-rot-end": `${rot + 4}deg`,
      }}
    >
      <div
        style={{
          width: size * 0.85, height: size * 0.85,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.4, background: color,
          border: "3px solid var(--ink)", borderRadius: 14,
          boxShadow: `${4 * depth + 2}px ${4 * depth + 2}px 0 var(--ink)`,
          userSelect: "none",
        }}
      >
        {emoji}
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function Background3D() {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const tiltX = useSpring(rawX, { stiffness: 60, damping: 18 });
  const tiltY = useSpring(rawY, { stiffness: 60, damping: 18 });
  const [enabled, setEnabled] = useState(true);
  const [isTouch, setIsTouch] = useState(false);
  const driftRef = useRef();

  const stageRotX = useTransform(tiltY, (v) => v * -4);
  const stageRotY = useTransform(tiltX, (v) => v * 4);

  useEffect(() => {
    ensureStyles();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia?.("(pointer: fine)").matches;

    if (reduce) { setEnabled(false); return; }

    if (fine) {
      setIsTouch(false);
      const onMove = (e) => {
        rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
        rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
      };
      window.addEventListener("mousemove", onMove);
      return () => window.removeEventListener("mousemove", onMove);
    }

    setIsTouch(true);
    // No JS animation loop on mobile — everything is CSS-driven
  }, [rawX, rawY]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="bg-3d"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* LAYER 1: Warm animated gradient mesh */}
      <div
        style={{
          position: "absolute",
          inset: "-50%",
          background: `linear-gradient(
            135deg,
            rgba(255,232,115,0.18) 0%,
            rgba(255,179,199,0.12) 20%,
            rgba(180,162,254,0.14) 40%,
            rgba(123,241,168,0.12) 60%,
            rgba(168,220,255,0.14) 80%,
            rgba(255,138,91,0.16) 100%
          )`,
          backgroundSize: "300% 300%",
          animation: "bg3d-gradient 20s ease-in-out infinite",
        }}
      />

      {/* LAYER 2: Ambient organic blobs */}
      {BLOBS.map((blob, i) => (
        <div
          key={`blob-${i}`}
          style={{
            position: "absolute",
            left: blob.x,
            top: blob.y,
            width: blob.size,
            height: blob.size,
            borderRadius: "50%",
            background: blob.color,
            filter: "blur(60px)",
            animation: `bg3d-blob ${blob.dur}s ease-in-out infinite`,
            animationDelay: `${blob.delay}s`,
            transform: "translate3d(0,0,0)", /* GPU layer */
          }}
        />
      ))}

      {/* LAYER 3: Emoji shapes */}
      {isTouch ? (
        /* Mobile: pure CSS animation, no JS, no perspective */
        SHAPES.map((shape, i) => (
          <MobileShape key={i} shape={shape} />
        ))
      ) : (
        /* Desktop: framer-motion cursor parallax + 3D perspective */
        <div style={{ position: "absolute", inset: 0, perspective: "1000px" }}>
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              transformStyle: "preserve-3d",
              rotateX: stageRotX,
              rotateY: stageRotY,
            }}
          >
            {SHAPES.map((shape, i) => (
              <DesktopShape key={i} shape={shape} tiltX={tiltX} tiltY={tiltY} />
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}
