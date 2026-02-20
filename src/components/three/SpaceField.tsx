"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

interface SpaceFieldProps {
  className?: string;
  density?: number; // 0-1 scale to tune particle count
  speed?: number; // global speed multiplier
  size?: number; // particle base size
}

const BASE_COUNT = 30000;
const BASE_RADIUS = 3000;
const BASE_DEPTH = 3600;
const BASE_SPEED = 180;
const BASE_SIZE = 5.0;
type SpacePointsProps = Required<Omit<SpaceFieldProps, "className">>;

function SpacePoints({
  density = 1,
  speed = 1,
  size = BASE_SIZE,
}: SpacePointsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = Math.floor(BASE_COUNT * density);
  const radius = BASE_RADIUS;
  const depth = BASE_DEPTH;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      arr[i3] = THREE.MathUtils.randFloatSpread(radius);
      arr[i3 + 1] = THREE.MathUtils.randFloatSpread(radius);
      arr[i3 + 2] = -Math.random() * depth;
    }
    return arr;
  }, [count, radius, depth]);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const array = pts.geometry.getAttribute("position").array as Float32Array;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      let x = array[i3];
      let y = array[i3 + 1];
      let z = array[i3 + 2];

      // Drift with mild vortex toward center
      const dx = -x * 0.00012;
      const dy = -y * 0.00012;
      const swirl = 0.00035;
      x += dx * delta * 60 + -y * swirl * delta * 60;
      y += dy * delta * 60 + x * swirl * delta * 60;

      z += BASE_SPEED * speed * delta;
      if (z > 40) {
        x = THREE.MathUtils.randFloatSpread(radius);
        y = THREE.MathUtils.randFloatSpread(radius);
        z = -depth;
      }

      array[i3] = x;
      array[i3 + 1] = y;
      array[i3 + 2] = z;
    }

    pts.geometry.getAttribute("position").needsUpdate = true;

    // Camera subtle drift
    const cam = state.camera;
    cam.position.x = Math.sin(t * 0.14) * 3.2;
    cam.position.y = Math.sin(t * 0.18) * 2.4;
    cam.position.z = 10;
    cam.lookAt(0, 0, -80);
  });

  return (
    <Points
      ref={pointsRef}
      positions={positions}
      stride={3}
      frustumCulled={false}
    >
      <PointMaterial
        transparent
        color="#dff7ff"
        size={size}
        sizeAttenuation
        depthWrite={false}
        opacity={1}
        vertexColors={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

export function SpaceField({
  className,
  density = 1,
  speed = 1,
  size = BASE_SIZE,
}: SpaceFieldProps) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 ${className ?? ""}`}
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(3, 6, 16, 0.92) 0%, rgba(1, 2, 8, 0.98) 65%, rgba(0, 1, 5, 1) 100%)",
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 10], fov: 82, near: 0.1, far: 5000 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.2} color="#bcd7ff" />
        <SpacePoints density={density} speed={speed} size={size} />
      </Canvas>
    </div>
  );
}

export default SpaceField;
