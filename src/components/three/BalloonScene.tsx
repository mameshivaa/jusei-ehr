"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

interface BalloonSceneProps {
  className?: string;
}

// Fullscreen particle field (no model, no HDR dependency)
const PARTICLE_COUNT = 16000;
const FIELD_RADIUS = 1800;
const FIELD_DEPTH = 2400;
const FORWARD_SPEED = 140;
const TWINKLE_SPEED = 1.1;
const PARTICLE_BASE_COLOR = "#1a1a1a";
const PARTICLE_SIZE = 2.4;

function FullscreenParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const i3 = i * 3;
      arr[i3] = THREE.MathUtils.randFloatSpread(FIELD_RADIUS);
      arr[i3 + 1] = THREE.MathUtils.randFloatSpread(FIELD_RADIUS);
      arr[i3 + 2] = -Math.random() * FIELD_DEPTH;
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const array = pts.geometry.getAttribute("position").array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const i3 = i * 3;
      array[i3 + 2] += FORWARD_SPEED * delta;
      if (array[i3 + 2] > 50) {
        array[i3] = THREE.MathUtils.randFloatSpread(FIELD_RADIUS);
        array[i3 + 1] = THREE.MathUtils.randFloatSpread(FIELD_RADIUS);
        array[i3 + 2] = -FIELD_DEPTH;
      }
    }
    pts.geometry.getAttribute("position").needsUpdate = true;

    // Mild camera drift for depth
    const t = state.clock.elapsedTime;
    state.camera.position.x = Math.sin(t * 0.18) * 3.2;
    state.camera.position.y = Math.sin(t * 0.21) * 2.6;
    state.camera.position.z = 10;
    state.camera.lookAt(0, 0, -60);

    // Twinkle
    const material = pts.material as THREE.PointsMaterial;
    material.size = THREE.MathUtils.lerp(
      PARTICLE_SIZE * 0.7,
      PARTICLE_SIZE * 1.2,
      (Math.sin(t * TWINKLE_SPEED) + 1) / 2,
    );
    material.opacity = THREE.MathUtils.lerp(
      0.35,
      0.9,
      (Math.cos(t * TWINKLE_SPEED * 1.4) + 1) / 2,
    );
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
        color={PARTICLE_BASE_COLOR}
        size={PARTICLE_SIZE}
        sizeAttenuation
        depthWrite={false}
        opacity={0.8}
        vertexColors={false}
      />
    </Points>
  );
}

export function BalloonScene({ className = "" }: BalloonSceneProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 10], fov: 80, near: 0.1, far: 4000 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={["transparent"]} />
        <FullscreenParticles />
      </Canvas>
    </div>
  );
}

export default BalloonScene;
