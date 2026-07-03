import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * Background3D — decorative parallax layer.
 *
 * MOBILE: During scroll, EVERYTHING freezes — no JS writes, no CSS animations.
 * The fixed container becomes a completely static image. After scroll settles,
 * animations resume via a CSS class toggle. Fewer shapes, no blur, smaller sizes.
 */

const SHAPES_DESKTOP = [
  { emoji: "📸", x: "8%",  y: "18%", depth: 0.9,  size: 76, rot: -12, color: "var(--c-yellow)" },
  { emoji: "🎉", x: "82%", y: "12%", depth: 0.7,  size: 64, rot: 10,  color: "var(--c-mint)" },
  { emoji: "⭐", x: "14%", y: "72%", depth: 0.55, size: 54, rot: -6,  color: "var(--c-lavender)" },
  { emoji: "❓", x: "88%", y: "68%", depth: 0.85, size: 72, rot: 8,   color: "var(--c-peach)" },
  { emoji: "💾", x: "50%", y: "8%",  depth: 0.35, size: 46, rot: -4,  color: "var(--c-sky)" },
  { emoji: "🖼️", x: "70%", y: "42%", depth: 0.5,  size: 50, rot: 12,  color: "var(--c-pink)" },
  { emoji: "✨", x: "30%", y: "40%", depth: 0.3,  size: 40, rot: -10, color: "var(--c-mint)" },
  { emoji: "🔮", x: "44%", y: "82%", depth: 0.65, size: 58, rot: 6,   color: "var(--c-lavender)" },
];

// Mobile: fewer shapes, pulled away from edges, smaller sizes, no deep blur
const SHAPES_MOBILE = [
  { emoji: "📸", x: "6%",  y: "12%", depth: 0.8, size: 52, rot: -8,  color: "var(--c-yellow)" },
  { emoji: "🎉", x: "75%", y: "8%",  depth: 0.6, size: 44, rot: 6,   color: "var(--c-mint)" },
  { emoji: "⭐", x: "10%", y: "65%", depth: 0.5, size: 40, rot: -4,  color: "var(--c-lavender)" },
  { emoji: "❓", x: "78%", y: "55%", depth: 0.7, size: 48, rot: 5,   color: "var(--c-peach)" },
  { emoji: "🔮", x: "40%", y: "80%", depth: 0.55, size: 42, rot: 3,  color: "var(--c-sky)" },
];

/* ─────────────── CSS (injected once) ─────────────── */
function ensureMobileStyles() {
  if (document.getElementById("bg3d-styles")) return;
  const style = document.createElement("style");
  style.id = "bg3d-styles";
  style.textContent = `
    @keyframes bg3d-bob {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-10px); }
    }
    @keyframes bg3d-rotate {
      0%, 100% { rotate: var(--bg3d-rot); }
      50%      { rotate: var(--bg3d-rot-end); }
    }
    /* During scroll: freeze ALL animations instantly */
    .bg3d-frozen .bg3d-shape-inner {
      animation-play-state: paused !important;
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

/* ─────────────── Mobile background ─────────────── */
function MobileBackground() {
  const containerRef = useRef(null);
  const shapeRefs = useRef([]);
  const animFrameRef = useRef(null);
  const gyroAvailable = useRef(false);

  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const isScrolling = useRef(false);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    ensureMobileStyles();
    const container = containerRef.current;

    // ── Scroll freeze: pause CSS animations + skip JS writes ──
    const freeze = () => {
      if (!isScrolling.current) {
        isScrolling.current = true;
        if (container) container.classList.add("bg3d-frozen");
      }
      clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        isScrolling.current = false;
        if (container) container.classList.remove("bg3d-frozen");
      }, 250);
    };

    window.addEventListener("scroll", freeze, { passive: true });
    window.addEventListener("touchmove", freeze, { passive: true });

    // ── Lerp loop ──
    const LERP = 0.05;
    let running = true;

    const tick = () => {
      if (!running) return;

      if (!isScrolling.current) {
        current.current.x += (target.current.x - current.current.x) * LERP;
        current.current.y += (target.current.y - current.current.y) * LERP;

        const cx = current.current.x;
        const cy = current.current.y;

        for (let i = 0; i < SHAPES_MOBILE.length; i++) {
          const el = shapeRefs.current[i];
          if (!el) continue;
          const depth = SHAPES_MOBILE[i].depth;
          const dx = cx * depth * 20;
          const dy = cy * depth * 20;
          el.style.transform = `translate3d(${dx}px,${dy}px,0)`;
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    // ── Gyroscope ──
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

    // ── Fallback drift ──
    const fallbackTimer = setTimeout(() => {
      if (!gyroAvailable.current) {
        let t = 0;
        const drift = () => {
          if (!running) return;
          t += 0.003;
          target.current.x = Math.sin(t) * 0.3;
          target.current.y = Math.cos(t * 0.7) * 0.3;
          requestAnimationFrame(drift);
        };
        requestAnimationFrame(drift);
      }
    }, 1500);

    return () => {
      running = false;
      window.removeEventListener("scroll", freeze);
      window.removeEventListener("touchmove", freeze);
      window.removeEventListener("deviceorientation", handleOrientation);
      clearTimeout(fallbackTimer);
      clearTimeout(scrollTimeout.current);
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
      }}
    >
      {SHAPES_MOBILE.map((shape, i) => {
        const { emoji, x, y, depth, size, rot, color } = shape;
        const bobDur = `${7 + depth * 5}s`;
        const rotDur = `${9 + depth * 4}s`;
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
            }}
          >
            <div
              className="bg3d-shape-inner"
              style={{
                width: size, height: size,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: size * 0.45, background: color,
                border: "3px solid var(--ink)", borderRadius: 14,
                boxShadow: `${4 * depth + 2}px ${4 * depth + 2}px 0 var(--ink)`,
                userSelect: "none",
                opacity: 0.3 + depth * 0.4,
                animation: `bg3d-bob ${bobDur} ease-in-out infinite, bg3d-rotate ${rotDur} ease-in-out infinite`,
                "--bg3d-rot": `${rot}deg`,
                "--bg3d-rot-end": `${rot + 3}deg`,
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
        {SHAPES_DESKTOP.map((shape, i) => (
          <DesktopShape key={i} shape={shape} tiltX={tiltX} tiltY={tiltY} />
        ))}
      </motion.div>
    </div>
  );
}
