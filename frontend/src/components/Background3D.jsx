import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Environment, Html, Sphere, Torus, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/**
 * WebGL Background - GLOSSY "BEST EVER MADE"
 *
 * Architecture:
 * - Layer 1 & 2 (CSS): Warm animated gradient and ambient blobs.
 * - Layer 3 (WebGL): Ultra-premium glossy shapes (acrylic/glass candy) 
 *   and tasteful, small native 3D emojis.
 *
 * Animations:
 * - Smooth, luxurious drifting to feel like a high-end fun game.
 */

/* ─── Shared Base Layers (Pure CSS) ─── */
const BLOBS = [
  { color: "rgba(255,232,115,0.25)", x: "15%", y: "20%", size: 220, dur: 18, delay: 0 },
  { color: "rgba(180,162,254,0.2)",  x: "75%", y: "15%", size: 260, dur: 22, delay: 2 },
  { color: "rgba(123,241,168,0.2)",  x: "65%", y: "60%", size: 200, dur: 20, delay: 4 },
  { color: "rgba(255,138,91,0.18)",  x: "20%", y: "70%", size: 240, dur: 24, delay: 1 },
  { color: "rgba(168,220,255,0.2)",  x: "50%", y: "40%", size: 180, dur: 16, delay: 3 },
];

function ensureStyles() {
  if (document.getElementById("bg3d-styles")) return;
  const style = document.createElement("style");
  style.id = "bg3d-styles";
  style.textContent = `
    @keyframes bg3d-gradient {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes bg3d-blob {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25%      { transform: translate(30px, -20px) scale(1.05); }
      50%      { transform: translate(-20px, 15px) scale(0.95); }
      75%      { transform: translate(15px, 25px) scale(1.02); }
    }
    .floating-emoji {
      font-size: 2rem; /* SMALLER, tasteful emojis */
      user-select: none;
      pointer-events: none;
      filter: drop-shadow(0px 8px 16px rgba(0,0,0,0.15));
    }
  `;
  document.head.appendChild(style);
}

function BaseLayers() {
  return (
    <>
      <div
        style={{
          position: "absolute", inset: "-50%", zIndex: -2,
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
            position: "absolute", left: blob.x, top: blob.y, width: blob.size, height: blob.size,
            borderRadius: "50%", background: blob.color, filter: "blur(60px)", zIndex: -1,
            animation: `bg3d-blob ${blob.dur}s ease-in-out infinite`, animationDelay: `${blob.delay}s`,
            transform: "translate3d(0,0,0)",
          }}
        />
      ))}
    </>
  );
}

/* ─── Ultra Glossy Scene Elements ─── */

const SHAPE_DATA = [
  { type: "donut", position: [-3, 3, -2], color: "#ff8a5b", scale: 0.8, rot: [0.5, 0.2, 0.1] },
  { type: "emoji", content: "🤔", position: [3, 2.5, -1], scale: 1.0, rot: [-0.2, 0.8, 0] },
  { type: "sphere", position: [4, -1, -2], color: "#b4a2fe", scale: 0.6, rot: [0, 0, 0] },
  { type: "emoji", content: "📸", position: [-3, -2, 1], scale: 1.0, rot: [0, 0.5, -0.3] },
  { type: "roundedBox", position: [5, -3, -3], color: "#7bf1a8", scale: 1.0, rot: [0.3, -0.4, 0.5] },
  { type: "emoji", content: "😂", position: [0, 4, -4], scale: 1.0, rot: [0.1, 0.1, 0.1] },
  { type: "donut", position: [-1.5, -3.5, -1], color: "#ffe873", scale: 0.7, rot: [0.6, 0.2, -0.2] },
];

function PremiumGlossyShapes() {
  // Ultra-glossy, translucent candy/acrylic material
  const glossyMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    roughness: 0.05, // very smooth
    transmission: 0.8, // highly transparent/glassy
    thickness: 2.0, // lots of volume for refraction
    clearcoat: 1.0, // extra shiny coat on top
    clearcoatRoughness: 0.0,
    ior: 1.5, // glass index of refraction
    metalness: 0.1,
  }), []);

  return (
    <>
      {SHAPE_DATA.map((data, i) => {
        let contentNode = null;
        
        if (data.type === "emoji") {
          contentNode = (
            <Html transform sprite className="floating-emoji">
              {data.content}
            </Html>
          );
        } else {
          // Clone material to set unique vibrant color
          const mat = glossyMaterial.clone();
          mat.color.set(data.color);
          
          if (data.type === "donut") {
            contentNode = <Torus args={[0.8, 0.3, 16, 32]} material={mat} />;
          } else if (data.type === "sphere") {
            contentNode = <Sphere args={[1, 32, 32]} material={mat} />;
          } else if (data.type === "roundedBox") {
            contentNode = <RoundedBox args={[1.2, 1.2, 1.2]} radius={0.2} smoothness={4} material={mat} />;
          }
        }

        return (
          // Smooth, deep drifting animation
          <Float key={i} speed={1 + (i % 2)} rotationIntensity={0.8} floatIntensity={2} floatingRange={[-0.5, 0.5]}>
            <group position={data.position} rotation={data.rot} scale={data.scale}>
              {contentNode}
            </group>
          </Float>
        );
      })}
    </>
  );
}

function CameraRig({ isTouch }) {
  const { camera, size } = useThree();
  const mouse = useRef(new THREE.Vector2());
  const targetRot = useRef(new THREE.Vector2());
  const gyroActive = useRef(false);

  useEffect(() => {
    if (isTouch) {
      const handleOrientation = (e) => {
        const gamma = e.gamma ?? 0;
        const beta = e.beta ?? 0;
        targetRot.current.y = Math.max(-1, Math.min(1, gamma / 40)) * 0.3;
        targetRot.current.x = Math.max(-1, Math.min(1, (beta - 45) / 40)) * 0.3;
        gyroActive.current = true;
      };

      const startGyro = () => {
        window.addEventListener("deviceorientation", handleOrientation, { passive: true });
      };

      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission().then((perm) => {
          if (perm === "granted") startGyro();
        }).catch(() => {});
      } else {
        startGyro();
      }

      return () => window.removeEventListener("deviceorientation", handleOrientation);
    } else {
      const handleMove = (e) => {
        mouse.current.x = (e.clientX / size.width) * 2 - 1;
        mouse.current.y = -(e.clientY / size.height) * 2 + 1;
      };
      window.addEventListener("mousemove", handleMove, { passive: true });
      return () => window.removeEventListener("mousemove", handleMove);
    }
  }, [isTouch, size]);

  useFrame((state, delta) => {
    if (isTouch) {
      if (!gyroActive.current) {
        targetRot.current.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
        targetRot.current.y = Math.cos(state.clock.elapsedTime * 0.4) * 0.1;
      }
      camera.rotation.x += (targetRot.current.x - camera.rotation.x) * 4 * delta;
      camera.rotation.y += (targetRot.current.y - camera.rotation.y) * 4 * delta;
    } else {
      const targetX = mouse.current.x * 2;
      const targetY = mouse.current.y * 2;
      camera.position.x += (targetX - camera.position.x) * 3 * delta;
      camera.position.y += (targetY - camera.position.y) * 3 * delta;
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

/* ─── Scroll Freezer Hook ─── */
function ScrollFreezer() {
  const set = useThree((state) => state.set);
  const scrollTimeout = useRef(null);
  const isScrolling = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (!isScrolling.current) {
        isScrolling.current = true;
        set({ frameloop: "demand" });
      }
      clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        isScrolling.current = false;
        set({ frameloop: "always" });
      }, 250);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchmove", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchmove", onScroll);
      clearTimeout(scrollTimeout.current);
    };
  }, [set]);

  return null;
}

/* ─── Main Export ─── */
export default function Background3D() {
  const [enabled, setEnabled] = useState(true);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    ensureStyles();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setEnabled(false); return; }

    const fine = window.matchMedia?.("(pointer: fine)").matches;
    setIsTouch(!fine);
  }, []);

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
      <BaseLayers />
      
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45 }}
        dpr={[1, 2]} 
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      >
        <ScrollFreezer />
        <CameraRig isTouch={isTouch} />
        
        {/* Soft, vibrant lighting to highlight the gloss */}
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#b4a2fe" />
        
        {/* Studio HDRI Environment for ultra-realistic gloss reflections */}
        <Environment preset="studio" />
        
        <PremiumGlossyShapes />
      </Canvas>
    </div>
  );
}
