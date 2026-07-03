import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * Background3D — decorative parallax layer with three input modes:
 *
 * 1. **Desktop (pointer: fine)** → cursor-driven parallax (rAF-throttled)
 * 2. **Mobile with gyroscope**   → DeviceOrientation (beta/gamma) drives the tilt
 *    so shapes respond when the user physically rotates their phone.
 * 3. **Mobile without gyro**     → gentle autonomous sine-wave drift (fallback)
 *
 * Scroll-jank fix (mobile):
 * - The outer wrapper uses NO `perspective` or `preserve-3d` on mobile.
 *   Instead every shape gets a simple 2D translate offset proportional to depth.
 *   This avoids forcing the mobile compositor to re-layer the entire fixed
 *   element on every scroll frame — the #1 cause of the "stuck" feeling.
 * - All transforms use `translate3d(0,0,0)` to promote to GPU layers.
 * - Container uses `contain: strict` so repaints never propagate to the page.
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

/* ── Desktop shape: uses framer-motion transforms for cursor parallax ── */
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
        willChange: "transform",
        backfaceVisibility: "hidden",
      }}
    >
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{
          opacity: 0.35 + depth * 0.5, scale: 1,
          y: [0, -14, 0],
          rotate: [rot, rot + 4, rot],
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

/* ── Mobile shape: pure CSS animation + JS parallax offset via style ── */
/* No framer-motion spring transforms → zero conflict with scroll compositor */
function MobileShape({ shape, offsetX, offsetY }) {
  const { emoji, x, y, depth, size, rot, color } = shape;
  // Parallax: deeper shapes move more
  const dx = offsetX * depth * 28;
  const dy = offsetY * depth * 28;
  const bobDuration = `${6 + depth * 4}s`;
  const rotateDuration = `${8 + depth * 3}s`;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: Math.round(depth * 10),
        /* GPU-promoted 2D offset — never triggers layout or scroll re-comp */
        transform: `translate3d(${dx}px, ${dy}px, 0)`,
        transition: "transform 0.15s linear",
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
          /* Pure CSS bob + rotate — runs on compositor, never blocks scroll */
          animation: `bg3d-bob ${bobDuration} ease-in-out infinite, bg3d-rotate ${rotateDuration} ease-in-out infinite`,
          "--bg3d-rot": `${rot}deg`,
          "--bg3d-rot-end": `${rot + 4}deg`,
        }}
      >
        {emoji}
      </div>
    </div>
  );
}

/* ── Inject the CSS keyframes once (mobile path only) ── */
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

/* ── Main component ── */
export default function Background3D() {
  const [enabled, setEnabled] = useState(true);
  const [isTouch, setIsTouch] = useState(false);

  // Desktop motion values (always declared to keep hook order stable)
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const tiltX = useSpring(rawX, { stiffness: 40, damping: 24, mass: 1.2 });
  const tiltY = useSpring(rawY, { stiffness: 40, damping: 24, mass: 1.2 });
  const stageRotX = useTransform(tiltY, (v) => v * -4);
  const stageRotY = useTransform(tiltX, (v) => v * 4);

  // Mobile: simple numeric offsets (no spring, no motion values)
  const [mobileOffset, setMobileOffset] = useState({ x: 0, y: 0 });
  const driftRef = useRef();
  const rafRef = useRef(null);
  const gyroAvailable = useRef(false);

  // Smooth the gyroscope with a simple low-pass filter
  const smoothRef = useRef({ x: 0, y: 0 });

  // Desktop mouse handler (rAF-throttled)
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
      // ─── Desktop: cursor parallax ───
      setIsTouch(false);
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    }

    // ─── Mobile / touch ───
    setIsTouch(true);
    ensureMobileKeyframes();

    // Low-pass filter constant: 0 = no smoothing, 1 = frozen
    const SMOOTH = 0.82;

    const handleOrientation = (e) => {
      // gamma: left-right tilt (-90..90), beta: front-back tilt (-180..180)
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      // Normalise to -1..1 range, clamped
      const nx = Math.max(-1, Math.min(1, gamma / 35));
      const ny = Math.max(-1, Math.min(1, (beta - 40) / 35)); // 40° is natural hand-hold angle
      // Low-pass filter for silky smooth output
      smoothRef.current.x = smoothRef.current.x * SMOOTH + nx * (1 - SMOOTH);
      smoothRef.current.y = smoothRef.current.y * SMOOTH + ny * (1 - SMOOTH);
      gyroAvailable.current = true;
      setMobileOffset({ x: smoothRef.current.x, y: smoothRef.current.y });
    };

    // Try to get gyroscope access
    const startGyro = () => {
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    };

    // iOS 13+ requires explicit permission
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then((perm) => { if (perm === "granted") startGyro(); })
        .catch(() => { /* permission denied — fall through to drift */ });
    } else {
      // Android / other — just listen
      startGyro();
    }

    // Fallback drift: if after 1.5s gyro never fired, start a gentle sine drift
    const fallbackTimer = setTimeout(() => {
      if (!gyroAvailable.current) {
        let t = 0;
        const tick = () => {
          t += 0.006;
          setMobileOffset({
            x: Math.sin(t) * 0.45,
            y: Math.cos(t * 0.7) * 0.45,
          });
          driftRef.current = requestAnimationFrame(tick);
        };
        driftRef.current = requestAnimationFrame(tick);
      }
    }, 1500);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      clearTimeout(fallbackTimer);
      if (driftRef.current) cancelAnimationFrame(driftRef.current);
    };
  }, [rawX, rawY, onMouseMove]);

  if (!enabled) return null;

  /* ── Mobile render path: NO perspective, NO preserve-3d, NO framer spring ── */
  if (isTouch) {
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
          /* No perspective or preserve-3d — these kill mobile scroll perf */
          contain: "strict",
          isolation: "isolate",
        }}
      >
        {SHAPES.map((shape, i) => (
          <MobileShape
            key={i}
            shape={shape}
            offsetX={mobileOffset.x}
            offsetY={mobileOffset.y}
          />
        ))}
      </div>
    );
  }

  /* ── Desktop render path: full 3D perspective + framer-motion springs ── */
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
        perspective: "1000px",
        willChange: "transform",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        contain: "layout style paint",
        transform: "translateZ(0)",
        isolation: "isolate",
      }}
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
          <DesktopShape key={i} shape={shape} tiltX={tiltX} tiltY={tiltY} />
        ))}
      </motion.div>
    </div>
  );
}
