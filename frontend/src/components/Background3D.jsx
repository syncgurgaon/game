import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * Background3D — decorative parallax layer.
 *
 * Input modes:
 *   Desktop  → cursor-driven parallax via framer-motion springs
 *   Mobile   → DeviceOrientation (gyroscope) OR gentle sine drift fallback
 *
 * MOBILE PERFORMANCE ARCHITECTURE:
 *   React setState is too slow for 60fps animation. On mobile, the parallax
 *   offset is written DIRECTLY to each shape's DOM node via a single rAF loop,
 *   completely bypassing React's reconciliation cycle. The bob/rotate
 *   animations are pure CSS @keyframes running on the compositor thread.
 *   No perspective, no preserve-3d, no framer-motion on mobile at all.
 */

const SHAPES = [
  { emoji: "📸", x: "8%",  y: "18%", depth: 0.9,  size: 76, rot: -12, color: "var(--c-yellow)" },
  { emoji: "🎉", x: "82%", y: "12%", depth: 0.7,  size: 64, rot: 10,  color: "var(--c-mint)" },
  { emoji: "⭐", x: "14%", y: "72%", depth: 0.55, size: 54, rot: -6,  color: "var(--c-lavender)" },
  { emoji: "❓", x: "88%", y: "68%", depth: 0.85, size: 72, rot: 8,   color: "var(--c-peach)" },
  { emoji: "💾", x: "50%", y: "8%",  depth: 0.35, size: 46, rot: -4,  color: "var(--c-sky)" },
  { emoji: "🖼️", x: "70%", y: "42%", depth: 0.5,  size: 50, rot: 12,  color: "var(--c-pink)" },
  { emoji: "✨", x: "30%", y: "40%", depth: 0.3,  size: 40, rot: -10, color: "var(--c-mint)" },
  { emoji: "🔮", x: "44%", y: "82%", depth: 0.65, size: 58, rot: 6,   color: "var(--c-lavender)" },
];

/* ─────────────── CSS keyframes (injected once) ─────────────── */
function ensureMobileKeyframes() {
  if (document.getElementById("bg3d-keyframes")) return;
  const style = document.createElement("style");
  style.id = "bg3d-keyframes";
  style.textContent = `
    @keyframes bg3d-bob {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-14px); }
    }
    @keyframes bg3d-rotate {
      0%, 100% { rotate: var(--bg3d-rot); }
      50%      { rotate: var(--bg3d-rot-end); }
    }
  `;
  document.head.appendChild(style);
}

/* ─────────────── Desktop shape (framer-motion) ─────────────── */
function DesktopShape({ shape, tiltX, tiltY }) {
  const { emoji, x, y, depth, size, rot, color } = shape;
  const px = useTransform(tiltX, (v) => v * depth * 40);
  const py = useTransform(tiltY, (v) => v * depth * 40);
  const translateZ = -160 + depth * 260;

  return (
    <motion.div
      style={{
        position: "absolute", left: x, top: y, x: px, y: py, translateZ,
        zIndex: Math.round(depth * 10),
        willChange: "transform", backfaceVisibility: "hidden",
      }}
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

/* ─────────────── Mobile background (zero React re-renders) ─────────────── */
function MobileBackground() {
  const containerRef = useRef(null);
  // Store refs to each shape wrapper so we can write transforms directly
  const shapeRefs = useRef([]);
  const animFrameRef = useRef(null);
  const gyroAvailable = useRef(false);

  // Animation state lives entirely outside React
  const target = useRef({ x: 0, y: 0 });   // where we want to be
  const current = useRef({ x: 0, y: 0 });   // where we are now (lerped)

  useEffect(() => {
    ensureMobileKeyframes();

    // ── Lerp loop: runs every frame, writes directly to DOM ──
    const LERP = 0.08; // 0 = frozen, 1 = instant. 0.08 = very smooth
    let running = true;

    const tick = () => {
      if (!running) return;
      // Lerp current toward target
      current.current.x += (target.current.x - current.current.x) * LERP;
      current.current.y += (target.current.y - current.current.y) * LERP;

      const cx = current.current.x;
      const cy = current.current.y;

      // Write transforms directly — no setState, no re-render
      for (let i = 0; i < SHAPES.length; i++) {
        const el = shapeRefs.current[i];
        if (!el) continue;
        const depth = SHAPES[i].depth;
        const dx = cx * depth * 28;
        const dy = cy * depth * 28;
        el.style.transform = `translate3d(${dx}px,${dy}px,0)`;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    // ── Gyroscope input ──
    const handleOrientation = (e) => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      target.current.x = Math.max(-1, Math.min(1, gamma / 35));
      target.current.y = Math.max(-1, Math.min(1, (beta - 40) / 35));
      gyroAvailable.current = true;
    };

    const startGyro = () => {
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    };

    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then((perm) => { if (perm === "granted") startGyro(); })
        .catch(() => {});
    } else {
      startGyro();
    }

    // ── Fallback: if gyro never fires after 1.5s, use sine drift ──
    const fallbackTimer = setTimeout(() => {
      if (!gyroAvailable.current) {
        let t = 0;
        const drift = () => {
          if (!running) return;
          t += 0.004;
          target.current.x = Math.sin(t) * 0.35;
          target.current.y = Math.cos(t * 0.7) * 0.35;
          // drift updates are picked up by the tick loop above
          requestAnimationFrame(drift);
        };
        requestAnimationFrame(drift);
      }
    }, 1500);

    return () => {
      running = false;
      window.removeEventListener("deviceorientation", handleOrientation);
      clearTimeout(fallbackTimer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="bg-3d"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        contain: "strict",
        isolation: "isolate",
      }}
    >
      {SHAPES.map((shape, i) => {
        const { emoji, x, y, depth, size, rot, color } = shape;
        const bobDuration = `${6 + depth * 4}s`;
        const rotateDuration = `${8 + depth * 3}s`;
        return (
          <div
            key={i}
            ref={(el) => { shapeRefs.current[i] = el; }}
            style={{
              position: "absolute",
              left: x,
              top: y,
              zIndex: Math.round(depth * 10),
              transform: "translate3d(0,0,0)",
              willChange: "transform",
            }}
          >
            <div
              style={{
                width: size, height: size,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: size * 0.5, background: color,
                border: "4px solid var(--ink)", borderRadius: 16,
                boxShadow: `${6 * depth + 2}px ${6 * depth + 2}px 0 var(--ink)`,
                filter: depth < 0.5 ? `blur(${(0.5 - depth) * 3}px)` : "none",
                userSelect: "none",
                opacity: 0.35 + depth * 0.5,
                animation: `bg3d-bob ${bobDuration} ease-in-out infinite, bg3d-rotate ${rotateDuration} ease-in-out infinite`,
                "--bg3d-rot": `${rot}deg`,
                "--bg3d-rot-end": `${rot + 4}deg`,
              }}
            >
              {emoji}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── Main export ─────────────── */
export default function Background3D() {
  const [enabled, setEnabled] = useState(true);
  const [isTouch, setIsTouch] = useState(false);

  // Desktop hooks (always declared for stable hook order)
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const tiltX = useSpring(rawX, { stiffness: 40, damping: 24, mass: 1.2 });
  const tiltY = useSpring(rawY, { stiffness: 40, damping: 24, mass: 1.2 });
  const stageRotX = useTransform(tiltY, (v) => v * -4);
  const stageRotY = useTransform(tiltX, (v) => v * 4);
  const rafRef = useRef(null);

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
    if (reduce) { setEnabled(false); return; }

    const fine = window.matchMedia?.("(pointer: fine)").matches;
    if (fine) {
      setIsTouch(false);
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    }

    setIsTouch(true);
  }, [onMouseMove]);

  if (!enabled) return null;

  if (isTouch) return <MobileBackground />;

  return (
    <div
      aria-hidden="true"
      data-testid="bg-3d"
      style={{
        position: "fixed", inset: 0, zIndex: 0,
        pointerEvents: "none", overflow: "hidden",
        perspective: "1000px",
        willChange: "transform", backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        contain: "layout style paint",
        transform: "translateZ(0)", isolation: "isolate",
      }}
    >
      <motion.div
        style={{
          position: "absolute", inset: 0,
          transformStyle: "preserve-3d", transformOrigin: "center center",
          rotateX: stageRotX, rotateY: stageRotY,
          willChange: "transform", backfaceVisibility: "hidden",
        }}
      >
        {SHAPES.map((shape, i) => (
          <DesktopShape key={i} shape={shape} tiltX={tiltX} tiltY={tiltY} />
        ))}
      </motion.div>
    </div>
  );
}
