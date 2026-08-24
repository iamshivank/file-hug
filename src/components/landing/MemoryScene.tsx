'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

function ArchiveObject() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.08;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.35) * 0.04 - 0.08;
  });

  return (
    <group ref={group} rotation={[-0.08, -0.35, 0.02]}>
      <Float speed={1.6} rotationIntensity={0.12} floatIntensity={0.35}>
        <RoundedBox args={[3.6, 2.3, 0.22]} radius={0.14} smoothness={5} position={[0, 0, 0]}>
          <meshStandardMaterial color="#fffaf0" roughness={0.72} metalness={0.02} />
        </RoundedBox>
        <RoundedBox args={[3.12, 0.22, 0.035]} radius={0.04} position={[-0.05, 0.62, 0.14]}>
          <meshStandardMaterial color="#ff5a1f" />
        </RoundedBox>
        <RoundedBox args={[2.35, 0.14, 0.035]} radius={0.035} position={[-0.43, 0.18, 0.14]}>
          <meshStandardMaterial color="#24201b" />
        </RoundedBox>
        <RoundedBox args={[1.72, 0.1, 0.035]} radius={0.03} position={[-0.74, -0.12, 0.14]}>
          <meshStandardMaterial color="#8a8175" />
        </RoundedBox>
        {[-0.62, 0, 0.62].map((x) => (
          <RoundedBox key={x} args={[0.48, 0.24, 0.035]} radius={0.1} position={[x, -0.68, 0.14]}>
            <meshStandardMaterial color={x === 0 ? '#ff5a1f' : '#efe2cf'} />
          </RoundedBox>
        ))}
      </Float>

      <Float speed={2.1} rotationIntensity={0.2} floatIntensity={0.5}>
        <RoundedBox args={[2.35, 1.42, 0.18]} radius={0.12} smoothness={5} position={[1.05, -1.28, 0.72]} rotation={[0.02, -0.08, -0.1]}>
          <meshStandardMaterial color="#ff5a1f" roughness={0.64} />
        </RoundedBox>
        <RoundedBox args={[1.55, 0.12, 0.04]} radius={0.03} position={[0.76, -1.09, 0.83]} rotation={[0.02, -0.08, -0.1]}>
          <meshStandardMaterial color="#2a1810" />
        </RoundedBox>
      </Float>

      <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.42}>
        <mesh position={[-2.08, 1.12, 0.38]} rotation={[0.7, 0.15, 0.05]}>
          <torusGeometry args={[0.42, 0.115, 18, 64]} />
          <meshStandardMaterial color="#ffad84" roughness={0.5} />
        </mesh>
      </Float>

      <Float speed={2.4} rotationIntensity={0.3} floatIntensity={0.52}>
        <mesh position={[2.14, 1.22, -0.1]} rotation={[0.25, 0.3, 0.2]}>
          <octahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial color="#28231e" roughness={0.36} />
        </mesh>
      </Float>
    </group>
  );
}

export default function MemoryScene() {
  return (
    <div className="landing-scene" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 6.4], fov: 42 }} dpr={[1, 1.6]} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={2.1} />
        <directionalLight position={[4, 5, 6]} intensity={3.2} color="#fff4df" />
        <pointLight position={[-3, -2, 4]} intensity={16} color="#ff5a1f" distance={9} />
        <ArchiveObject />
      </Canvas>
    </div>
  );
}
