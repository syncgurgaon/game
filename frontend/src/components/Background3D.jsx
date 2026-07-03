import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Outlines, Text3D, Center } from "@react-three/drei";
import * as THREE from "three";

/**
 * WebGL Background - NEO-BRUTALIST VIBE
 *
 * Architecture:
 * - Layer 1 & 2 (CSS): Warm animated gradient and ambient blobs (free for GPU).
 * - Layer 3 (WebGL): Neo-brutalist 3D shapes (blocks, polaroids, stars) with
 *   thick black outlines (Hull technique) and flat shading for buttery smoothness.
 *
 * Animations:
 * - Playful "jitter" rotation (stop-motion feel) to match the brutalist aesthetic.
 * - Strict Scroll Freeze: The WebGL loop pauses entirely during scroll.
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

/* ─── WebGL Scene Elements (Neo-Brutalist) ─── */

const SHAPE_DATA = [
  { type: "polaroid", position: [-4, 3, -2], color: "#ffe873", scale: 1.2, rot: [0.5, 0.2, 0.1] },
  { type: "block", position: [4, 2, -1], color: "#7bf1a8", scale: 1.0, rot: [-0.2, 0.8, 0] },
  { type: "star", position: [-3, -2, 1], color: "#b4a2fe", scale: 0.9, rot: [0, 0.5, -0.3] },
  { type: "polaroid", position: [5, -3, -3], color: "#ff8a5b", scale: 1.4, rot: [0.3, -0.4, 0.5] },
  { type: "block", position: [0, 4, -4], color: "#a8dcff", scale: 0.8, rot: [0.1, 0.1, 0.1] },
  { type: "star", position: [2, 0, 2], color: "#ffb3c7", scale: 0.7, rot: [-0.5, -0.1, 0.8] },
  { type: "block", position: [-2, -4, -1], color: "#7bf1a8", scale: 1.1, rot: [0.6, 0.2, -0.2] },
];

const OUTLINE_THICKNESS = 0.04;
const OUTLINE_COLOR = "#1a1a1a";

// A custom jitter component that wraps elements and steps their rotation
function JitterFloat({ children, speed, ...props }) {
  const groupRef = useRef();
  const timeRef = useRef(0);
  const targetRot = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    timeRef.current += delta;
    // Step animation (update target every 0.15s) for a stop-motion feel
    if (timeRef.current > 0.15) {
      timeRef.current = 0;
      targetRot.current.x += (Math.random() - 0.5) * 0.1;
      targetRot.current.y += (Math.random() - 0.5) * 0.1;
      targetRot.current.z += (Math.random() - 0.5) * 0.1;
    }
    
    // Lerp to the stepped target for a snappy "jitter" effect
    if (groupRef.current) {
      groupRef.current.rotation.x += (targetRot.current.x - groupRef.current.rotation.x) * 0.2;
      groupRef.current.rotation.y += (targetRot.current.y - groupRef.current.rotation.y) * 0.2;
      groupRef.current.rotation.z += (targetRot.current.z - groupRef.current.rotation.z) * 0.2;
    }
  });

  return (
    <Float speed={speed} rotationIntensity={0} floatIntensity={1.5} floatingRange={[-0.4, 0.4]} {...props}>
      <group ref={groupRef}>
        {children}
      </group>
    </Float>
  );
}

function BrutalistShapes() {
  // Ultra-cheap material, no heavy shader compiling
  const baseMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: "#fff" }), []);

  return (
    <>
      {SHAPE_DATA.map((data, i) => {
        const mat = baseMaterial.clone();
        mat.color.set(data.color);

        let geometryNode = null;
        if (data.type === "block") {
          geometryNode = (
            <mesh material={mat}>
              <boxGeometry args={[1, 1, 1]} />
              <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
            </mesh>
          );
        } else if (data.type === "polaroid") {
          // A flat block representing a polaroid
          geometryNode = (
            <mesh material={mat}>
              <boxGeometry args={[1.2, 1.4, 0.2]} />
              <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
              {/* Fake inner photo area */}
              <mesh position={[0, 0.1, 0.11]}>
                <boxGeometry args={[1.0, 1.0, 0.01]} />
                <meshLambertMaterial color="#fffdf9" />
                <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
              </mesh>
            </mesh>
          );
        } else if (data.type === "star") {
          geometryNode = (
            <mesh material={mat}>
              <coneGeometry args={[0.7, 1.2, 4]} />
              <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
            </mesh>
          );
        }

        return (
          <JitterFloat key={i} speed={1.5 + (i % 2)}>
            <group position={data.position} rotation={data.rot} scale={data.scale}>
              {geometryNode}
            </group>
          </JitterFloat>
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
      
      {/* Flat shading prevents expensive lighting calculations */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      >
        <ScrollFreezer />
        <CameraRig isTouch={isTouch} />
        
        {/* Simple, flat lighting */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} />
        
        <BrutalistShapes />
      </Canvas>
    </div>
  );
}
