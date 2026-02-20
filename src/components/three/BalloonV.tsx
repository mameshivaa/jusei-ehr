"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Center } from "@react-three/drei";
import * as THREE from "three";

interface BalloonVProps {
  scale?: number;
  color?: string;
}

const DEFAULT_BALLOON_COLOR = "#f0ffff"; // light cyan tint
const ATTENUATION_COLOR = "#f0ffff";
const METALNESS = 0.0;
const ROUGHNESS = 0.004; // max gloss before artifacts
const TRANSMISSION = 0.85; // add slight body tint so color is visible
const THICKNESS = 0.018; // slightly thicker film to hold tint
const ENVMAP_INTENSITY = 3.0; // stronger reflections for rainbowy sheen
const ATTENUATION_DISTANCE = 14.0;
const CLEARCOAT = 1.0;
const CLEARCOAT_ROUGHNESS = 0.008;
const IOR = 1.33;
const IRIDESCENCE_STRENGTH = 1.0; // boost rainbow for reflective look
const IRIDESCENCE_FREQUENCY = 8.5;
const IRIDESCENCE_THICKNESS_MIN = 100;
const IRIDESCENCE_THICKNESS_MAX = 650;
const FILM_THICKNESS = 380.0;
const FRESNEL_POWER = 3.6; // rim emphasis while keeping center lighter

/**
 * 3D Balloon "V" Component
 * Loads a custom GLB model with floating animation
 */
export function BalloonV({
  scale = 1,
  color = DEFAULT_BALLOON_COLOR,
}: BalloonVProps) {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const angularVelocity = useRef({ x: 0, y: 0 });
  const accumulatedRotation = useRef({ x: 0, y: 0 });
  const { scene } = useGLTF("/models/balloon-v.glb");

  // Apply glossy material to all meshes in the model
  useEffect(() => {
    const baseColor = new THREE.Color(color ?? DEFAULT_BALLOON_COLOR);
    const attenuationColor = new THREE.Color(ATTENUATION_COLOR);

    const baseMaterial = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: METALNESS,
      roughness: ROUGHNESS,
      transmission: TRANSMISSION,
      ior: IOR,
      thickness: THICKNESS,
      attenuationColor,
      attenuationDistance: ATTENUATION_DISTANCE,
      clearcoat: CLEARCOAT,
      clearcoatRoughness: CLEARCOAT_ROUGHNESS,
      reflectivity: 1.0,
      envMapIntensity: ENVMAP_INTENSITY,
      iridescence: 1.0,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [
        IRIDESCENCE_THICKNESS_MIN,
        IRIDESCENCE_THICKNESS_MAX,
      ],
      emissive: new THREE.Color(0x000000),
      transparent: true,
    });

    baseMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uBaseColor = { value: baseColor };
      shader.uniforms.uIriStrength = { value: IRIDESCENCE_STRENGTH };
      shader.uniforms.uIriFreq = { value: IRIDESCENCE_FREQUENCY };
      shader.uniforms.uFilmThickness = { value: FILM_THICKNESS };
      shader.uniforms.uFresnelPower = { value: FRESNEL_POWER };

      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `
        #include <common>
        varying vec3 vWorldPos;
        varying vec3 vNormalW;
        uniform vec3 uBaseColor;
        uniform float uIriStrength;
        uniform float uIriFreq;
        uniform float uFilmThickness;
        uniform float uFresnelPower;
        `,
      );

      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        `
        varying vec3 vNormalW;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vWorldPos = worldPos.xyz;
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `
        vec3 viewDir = normalize(vViewPosition);
        float angle = clamp(dot(normalize(vNormalW), viewDir), -1.0, 1.0);
        float iri = pow(1.0 - abs(angle), 0.5) * uIriStrength;

        // Thin-film oscillation to mimic soap-bubble interference
        float film = 0.5 + 0.5 * sin(uFilmThickness * angle);

        vec3 rainbow = vec3(
          0.55 + 0.45 * sin(uIriFreq * angle + 0.0 + film * 0.6),
          0.55 + 0.45 * sin(uIriFreq * angle + 2.094 + film * 0.6),
          0.55 + 0.45 * sin(uIriFreq * angle + 4.188 + film * 0.6)
        );

        // Desaturate rainbow slightly, then rim-weight with Fresnel * iri
        rainbow = mix(vec3(1.0), rainbow, 0.4);

        float fresnel = pow(1.0 - abs(angle), uFresnelPower);
        float mixFactor = clamp(fresnel * iri, 0.0, 1.0);
        vec3 base = vec3(1.0);
        vec3 finalColor = mix(base, rainbow, mixFactor); // rainbow sits on reflective edges
        vec4 diffuseColor = vec4(finalColor, opacity);
        `,
      );
    };

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        child.material = baseMaterial.clone();
        child.material.needsUpdate = true;
      }
    });
  }, [scene, color]);

  // Animation: gentle rotation and floating
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;
    const damping = 4.5; // higher = faster decay
    const autoSpin = 0.5; // rad/sec baseline spin (visible steady spin)

    // Apply damping to angular velocity
    const decay = Math.exp(-damping * delta);
    angularVelocity.current.x *= decay;
    angularVelocity.current.y *= decay;

    // Integrate rotation with auto spin + velocity
    accumulatedRotation.current.y +=
      autoSpin * delta + angularVelocity.current.y * delta;
    accumulatedRotation.current.x += angularVelocity.current.x * delta;

    // Limit tilt to reasonable range
    accumulatedRotation.current.x = THREE.MathUtils.clamp(
      accumulatedRotation.current.x,
      -Math.PI / 4,
      Math.PI / 4,
    );

    // Add subtle breathing tilt
    const baseTiltX = Math.sin(time * 0.3) * 0.05;

    groupRef.current.rotation.y = accumulatedRotation.current.y;
    groupRef.current.rotation.x = baseTiltX + accumulatedRotation.current.x;

    // Gentle floating motion (not mouse-dependent)
    groupRef.current.position.y = Math.sin(time * 0.8) * 0.12;
  });

  return (
    <Center>
      <group
        ref={groupRef}
        scale={scale}
        onPointerDown={(e) => {
          isDragging.current = true;
          lastPointer.current = { x: e.pointer.x, y: e.pointer.y };
          e.stopPropagation();
        }}
        onPointerMove={(e) => {
          if (!isDragging.current || !lastPointer.current) return;
          const dx = e.pointer.x - lastPointer.current.x;
          const dy = e.pointer.y - lastPointer.current.y;
          // Scale deltas to angular velocity (radians per second-esque)
          angularVelocity.current.y += dx * 2.2;
          angularVelocity.current.x += dy * 1.6;
          lastPointer.current = { x: e.pointer.x, y: e.pointer.y };
        }}
        onPointerUp={() => {
          isDragging.current = false;
          lastPointer.current = null;
        }}
        onPointerLeave={() => {
          isDragging.current = false;
          lastPointer.current = null;
        }}
      >
        <primitive object={scene} />
      </group>
    </Center>
  );
}

// Preload the model
useGLTF.preload("/models/balloon-v.glb");

export default BalloonV;
