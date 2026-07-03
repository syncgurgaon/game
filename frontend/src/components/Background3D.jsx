import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * Background3D — a decorative, GPU-friendly parallax "3D" layer.
 *
 * Floating neo-brutalist shapes sit at different simulated depths. The whole
 * scene lives on a perspective stage that tilts toward the cursor (or, on
 * touch/reduced-motion, drifts on its own), so nearer shapes swing further than
 * far ones — a cheap-but-convincing 3D parallax with zero external libraries.
 *
 * Purely decorative: aria-hidden, pointer-events: none, fixed behind everything.
 *
 * Scroll-glitch fix:
 * - The outer container uses `will-change: transform`, `backface-visibility: hidden`,
 *   and `contain: layout style paint` to force GPU-composited layers and isolate
 *   any repaint from the rest of the page.
 * - Mouse tracking is throttled to one rAF per frame so rapid scroll + mouse
 *   events don't thrash layout.
 */

const SHAPES = [
  // depth: 0 (far) .. 1 (near) — drives size, parallax strength and blur
  { emoji: "📸", x: "8%", y: "18%", depth: 0.9, size: 76, rot: -12, color: "var(--c-yellow)" },
  { emoji: "🎉", x: "82%", y: "12%", depth: 0.7, size: 64, rot: 10, color: "var(--c-mint)" },
  { emoji: "⭐", x: "14%", y: "72%", depth: 0.55, size: 54, rot: -6, color: "var(--c-lavender)" },
  { emoji: "❓", x: "88%", y: "68%", depth: 0.85, size: 72, rot: 8, color: "var(--c-peach)" },
  { emoji: "💾", x: "50%", y: "8%", depth: 0.35, size: 46, rot: -4, color: "var(--c-sky)" },
  { emoji: "🖼️", x: "70%", y: "42%", depth: 0.5, size: 50, rot: 12, color: "var(--c-pink)" },
  { emoji: "✨", x: "30%", y: "40%", depth: 0.3, size: 40, rot: -10, color: "var(--c-mint)" },
  { emoji: "🔮", x: "44%", y: "82%", depth: 0.65, size: 58, rot: 6, color: "var(--c-lavender)" },
];

function FloatingShape({ shape, tiltX, tiltY }) {
  const { emoji, x, y, depth, size, rot, color } = shape;
  // Nearer shapes (higher depth) travel further with the tilt → parallax.
  const px = useTransform(tiltX, (v) => v * depth * 40);
  const py = useTransform(tiltY, (v) => v * depth * 40);
  const translateZ = -160 + depth * 260; // far shapes pushed back in Z

  return (
    <motion.div
      style={{
        position: "absolute",
        left: x,
        top: y,
        x: px,
        y: py,
        translateZ,
        zIndex: Math.round(depth * 10),
        willChange: "transform",
        backfaceVisibility: "hidden",
      }}
    >
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{
          opacity: 0.35 + depth * 0.5,
          scale: 1,
          y: [0, -14, 0],
          rotate: [rot, rot + 4, rot],
        }}
        transition={{
          opacity: { duration: 0.8 },
          scale: { duration: 0.8 },
          y: { duration: 6 + depth * 4, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 8 + depth * 3, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.5,
          background: color,
          border: "4px solid var(--ink)",
          borderRadius: 16,
          boxShadow: `${6 * depth + 2}px ${6 * depth + 2}px 0 var(--ink)`,
          filter: depth < 0.5 ? `blur(${(0.5 - depth) * 3}px)` : "none",
          userSelect: "none",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
        {emoji}
      </motion.div>
    </motion.div>
  );
}

export default function Background3D() {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  // Softer spring with higher damping → no jitter on scroll
  const tiltX = useSpring(rawX, { stiffness: 40, damping: 24, mass: 1.2 });
  const tiltY = useSpring(rawY, { stiffness: 40, damping: 24, mass: 1.2 });
  const [enabled, setEnabled] = useState(true);
  const driftRef = useRef();
  const rafRef = useRef(null);

  // Whole stage counter-tilts slightly for a parallax "camera" feel.
  // Declared before any early return to keep hook order stable.
  const stageRotX = useTransform(tiltY, (v) => v * -4);
  const stageRotY = useTransform(tiltX, (v) => v * 4);

  // Throttle mouse tracking to one rAF per frame — prevents scroll-thrash.
  const pendingMouse = useRef({ x: 0, y: 0 });
  const onMouseMove = useCallback(
    (e) => {
      pendingMouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pendingMouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rawX.set(pendingMouse.current.x);
          rawY.set(pendingMouse.current.y);
          rafRef.current = null;
        });
      }
    },
    [rawX, rawY],
  );

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    if (reduce) {
      setEnabled(false);
      return;
    }

    if (fine) {
      // Cursor-driven parallax on desktop (rAF-throttled).
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    }

    // Touch / coarse-pointer devices: gentle autonomous drift.
    let t = 0;
    const tick = () => {
      t += 0.008;
      rawX.set(Math.sin(t) * 0.6);
      rawY.set(Math.cos(t * 0.8) * 0.6);
      driftRef.current = requestAnimationFrame(tick);
    };
    driftRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(driftRef.current);
  }, [rawX, rawY, onMouseMove]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        perspective: "1000px",
        /* GPU compositing hints — eliminates scroll glitching */
        willChange: "transform",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        contain: "layout style paint",
        transform: "translateZ(0)",
        isolation: "isolate",
      }}
      data-testid="bg-3d"
    >
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transformOrigin: "center center",
          rotateX: stageRotX,
          rotateY: stageRotY,
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
        {SHAPES.map((shape, i) => (
          <FloatingShape key={i} shape={shape} tiltX={tiltX} tiltY={tiltY} />
        ))}
      </motion.div>
    </div>
  );
}
