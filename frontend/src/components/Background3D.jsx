import { useEffect, useRef, useState, useCallback } from "react";
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
 * LAYER 3 (Emoji shapes):
 *   Desktop: Neo-brutalist emoji shapes with cursor parallax via framer-motion.
 *   Mobile:  DeviceOrientation (gyroscope) tracking with a direct-DOM-write
 *            rAF loop to prevent React re-renders. Paused during scroll to
 *            ensure buttery smooth scrolling.
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

    /* Layer 3: Bob & rotate (used on mobile inside JS-translated wrappers) */
    @keyframes bg3d-bob {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-14px); }
    }
    @keyframes bg3d-rotate {
      0%, 100% { rotate: var(--bg3d-rot); }
      50%      { rotate: var(--bg3d-rot-end); }
    }
    /* Scroll freeze */
    .bg3d-frozen .bg3d-shape-inner {
      animation-play-state: paused !important;
    }
  `;
  document.head.appendChild(style);
}

/* ─── Shared Base Layers (Gradient & Blobs) ─── */
function BaseLayers() {
  return (
    <>
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
            transform: "translate3d(0,0,0)",
          }}
        />
      ))}
    </>
  );
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

/* ─── Mobile Background (Gyro parallax via direct DOM writes) ─── */
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
    const container = containerRef.current;

    // Scroll freeze: pause CSS animations + skip JS writes
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

    // Lerp loop
    const LERP = 0.06;
    let running = true;

    const tick = () => {
      if (!running) return;

      if (!isScrolling.current) {
        current.current.x += (target.current.x - current.current.x) * LERP;
        current.current.y += (target.current.y - current.current.y) * LERP;

        const cx = current.current.x;
        const cy = current.current.y;

        for (let i = 0; i < SHAPES.length; i++) {
          const el = shapeRefs.current[i];
          if (!el) continue;
          const depth = SHAPES[i].depth;
          const dx = cx * depth * 28;
          const dy = cy * depth * 28;
          el.style.transform = `translate3d(${dx}px,${dy}px,0)`;
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    // Gyroscope tracking
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

    // Fallback drift if gyro not available
    const fallbackTimer = setTimeout(() => {
      if (!gyroAvailable.current) {
        let t = 0;
        const drift = () => {
          if (!running) return;
          t += 0.004;
          target.current.x = Math.sin(t) * 0.35;
          target.current.y = Math.cos(t * 0.7) * 0.35;
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
        position: "fixed", inset: 0, zIndex: 0,
        pointerEvents: "none", overflow: "hidden"
      }}
    >
      <BaseLayers />
      
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
              className="bg3d-shape-inner"
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

/* ─── Main component ─── */
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
    ensureStyles();
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
      <BaseLayers />
      
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
