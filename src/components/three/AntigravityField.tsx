"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

interface AntigravityFieldProps {
  className?: string;
  density?: number; // 0.0 - 2.0: particle density multiplier
  speed?: number; // 0.5 - 2.0: global speed multiplier
  size?: number; // particle size
}

const BASE_COUNT = 6000;
const BASE_RADIUS = 2200;
const BASE_DEPTH = 200;
const BASE_SPEED = 40;
const BASE_SIZE = 4.0;
const ATTRACTION = 0.0025;
const DAMPING = 0.992;

type AntigravityPointsProps = Omit<
  Required<AntigravityFieldProps>,
  "className"
>;

function AntigravityPoints({
  density = 1,
  speed = 1,
  size = BASE_SIZE,
}: AntigravityPointsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const velRef = useRef<Float32Array | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const count = Math.floor(BASE_COUNT * density);
  const radius = BASE_RADIUS;
  const depth = BASE_DEPTH;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      // uniform disk on XY plane, slight depth jitter
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      arr[i3] = Math.cos(theta) * r;
      arr[i3 + 1] = Math.sin(theta) * r;
      arr[i3 + 2] = -Math.random() * depth;
    }
    velRef.current = new Float32Array(count * 3);
    return arr;
  }, [count, radius, depth]);

  useFrame((state, delta) => {
    if (!pointsRef.current || !velRef.current) return;
    const array = pointsRef.current.geometry.getAttribute("position")
      .array as Float32Array;
    const vel = velRef.current;
    const t = state.clock.elapsedTime;

    const mouse = mouseRef.current;
    // mouse normalized space: center at 0,0
    const attractX = mouse.x * radius * 0.5;
    const attractY = mouse.y * radius * 0.5;

    // gather / disperse pulse
    const pulse = Math.sin(t * 0.8);
    const gather = Math.max(0, pulse);
    const repel = Math.max(0, -pulse);

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      let x = array[i3];
      let y = array[i3 + 1];
      let z = array[i3 + 2];

      // velocity
      let vx = vel[i3];
      let vy = vel[i3 + 1];
      let vz = vel[i3 + 2];

      // attraction / repulsion toward mouse on plane
      const dx = attractX - x;
      const dy = attractY - y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const force = ATTRACTION * speed;
      vx += (dx / dist) * force * (0.5 + gather * 1.0);
      vy += (dy / dist) * force * (0.5 + gather * 1.0);
      vx -= (dx / dist) * force * 0.5 * repel;
      vy -= (dy / dist) * force * 0.5 * repel;

      // forward motion in z
      vz += BASE_SPEED * speed * delta * 0.05;

      // apply velocity
      x += vx * delta * 60;
      y += vy * delta * 60;
      z += vz * delta * 60;

      // damping
      vx *= DAMPING;
      vy *= DAMPING;
      vz *= DAMPING;

      // recycle
      if (z > 30) {
        let rx = Math.random() * 2 - 1;
        let ry = Math.random() * 2 - 1;
        let rz = Math.random() * 2 - 1;
        const lenr = Math.hypot(rx, ry, rz) || 1;
        rx /= lenr;
        ry /= lenr;
        rz /= lenr;
        const rr = Math.cbrt(Math.random()) * radius;
        x = rx * rr;
        y = ry * rr;
        z = -depth;
        vx = 0;
        vy = 0;
        vz = 0;
      }

      array[i3] = x;
      array[i3 + 1] = y;
      array[i3 + 2] = z;
      vel[i3] = vx;
      vel[i3 + 1] = vy;
      vel[i3 + 2] = vz;
    }

    pointsRef.current.geometry.getAttribute("position").needsUpdate = true;

    // Camera gentle drift
    const cam = state.camera;
    cam.position.x = Math.sin(t * 0.12) * 3.4;
    cam.position.y = Math.sin(t * 0.16) * 2.6;
    cam.position.z = 10;
    cam.lookAt(0, 0, -70);
  });

  // track mouse
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current = { x, y };
    };
    window.addEventListener("pointermove", handler);
    return () => window.removeEventListener("pointermove", handler);
  }, []);

  return (
    <Points
      ref={pointsRef}
      positions={positions}
      stride={3}
      frustumCulled={false}
    >
      <PointMaterial
        transparent
        color="#000000"
        size={size}
        sizeAttenuation
        depthWrite={false}
        opacity={0.9}
        vertexColors={false}
        blending={THREE.NormalBlending}
      />
    </Points>
  );
}

export function AntigravityField({
  className,
  density = 1,
  speed = 1,
  size = BASE_SIZE,
}: AntigravityFieldProps) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 ${className ?? ""}`}
      style={{
        background: "#f8fafc",
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 10], fov: 80, near: 0.1, far: 5000 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ width: "100vw", height: "100vh", background: "transparent" }}
      >
        <color attach="background" args={["#f8fafc"]} />
        <AntigravityPoints density={density} speed={speed} size={size} />
      </Canvas>
    </div>
  );
}

export default AntigravityField;
