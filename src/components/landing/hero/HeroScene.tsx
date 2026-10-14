'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, RoundedBox } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import {
  CARD_SPECS,
  FEATURED_KIND,
  smoothstep,
  type CardKind,
  type HeroStore,
} from './heroStore';
import { createCardTexture, createGlowTexture, repaintCardTexture } from './cardArt';

type Quality = 'high' | 'low';
type Theme = 'light' | 'dark';

export interface HeroSceneProps {
  storeRef: RefObject<HeroStore>;
  kinds: readonly CardKind[];
  quality: Quality;
  theme: Theme;
  reduced: boolean;
  /** False while the hero is off-screen — the render loop stops entirely. */
  active: boolean;
  onSaved: (kind: CardKind) => void;
}

/* ------------------------------------------------------------- palette */

const PALETTES = {
  dark: {
    bg: '#0c0a09',
    ambient: 0.35,
    key: 0.9,
    env: 0.9,
    glass: '#f1e4d6',
    glassAtten: '#ffbf8a',
    glassLow: '#2b221c',
    glow: '#ff8a3d',
    glowBlending: THREE.AdditiveBlending,
    glowStrength: 0.85,
    faceEmissive: 0.3,
    shadowColor: '#000000',
    shadowOpacity: 0.75,
    coreAtten: '#ff9b52',
    heart: '#ff6a1f',
    heartEmissive: 0.75,
    coreLight: 7,
    ring: '#cdb59a',
    dust: '#ffc998',
    dustOpacity: 0.5,
    backGlow: '#ff7a2f',
    backGlowOpacity: 0.26,
  },
  light: {
    bg: '#faf6f0',
    ambient: 0.65,
    key: 1.2,
    env: 1,
    glass: '#ffffff',
    glassAtten: '#ffdcbf',
    glassLow: '#ffffff',
    glow: '#ff7a2f',
    glowBlending: THREE.NormalBlending,
    glowStrength: 0.5,
    faceEmissive: 0.1,
    shadowColor: '#4a2a12',
    shadowOpacity: 0.4,
    coreAtten: '#ffb47a',
    heart: '#f0641f',
    heartEmissive: 0.35,
    coreLight: 4,
    ring: '#9c8466',
    dust: '#d9631a',
    dustOpacity: 0.32,
    backGlow: '#ffb27a',
    backGlowOpacity: 0.4,
  },
} as const;

type Palette = (typeof PALETTES)[Theme];

/* -------------------------------------------------------------- layout */

interface Layout {
  fov: number;
  camZ: number;
  offset: readonly [number, number];
  s: number;
  homes: THREE.Vector3[];
  orbitR: number;
  featured: THREE.Vector3;
  featuredScale: number;
  floorY: number;
}

function computeLayout(width: number, height: number, kinds: readonly CardKind[]): Layout {
  const aspect = width / Math.max(1, height);
  const narrow = aspect < 1.05;
  const fov = narrow ? 46 : 35;
  const camZ = 9.5;
  const visH = 2 * camZ * Math.tan((fov * Math.PI) / 360);
  const visW = visH * aspect;

  const s = narrow
    ? Math.min(1, visW / 4.6, (visH * 0.42) / (kinds.length > 4 ? 5.6 : 4.4))
    : Math.min(1, visH / 6.3, visW / 12);
  const offset: readonly [number, number] = narrow
    ? [0, -visH * 0.19]
    : [visW * (aspect > 1.45 ? 0.2 : 0.14), -0.05];

  return {
    fov,
    camZ,
    offset,
    s,
    homes: kinds.map((k) => {
      const h = narrow ? CARD_SPECS[k].homeNarrow : CARD_SPECS[k].home;
      return new THREE.Vector3(h[0], h[1], h[2]).multiplyScalar(s);
    }),
    orbitR: 1.75 * s,
    featured: narrow ? new THREE.Vector3(0, -0.2, 2.2) : new THREE.Vector3(-0.4, 0.15, 2.7),
    featuredScale: s * (narrow ? 0.85 : 1.05),
    floorY: -3.05 * s,
  };
}

/* ---------------------------------------------------------- simulation */

type Mode = 'free' | 'drag' | 'absorb' | 'stored';

interface Body {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  scale: number;
  scaleVel: number;
  mode: Mode;
  modeT: number;
  hover: number;
  glint: number;
  /** Seconds since the user let go of this card (Infinity if never thrown). */
  sinceThrow: number;
}

interface DragState {
  index: number;
  pointerId: number;
  plane: THREE.Plane;
  offset: THREE.Vector3;
  target: THREE.Vector3;
  startX: number;
  startY: number;
  startT: number;
  moved: boolean;
  samples: { x: number; y: number; z: number; t: number }[];
}

interface Ctl {
  key: string;
  bodies: Body[];
  drag: DragState | null;
  hover: number;
  pulse: number;
  /** Last frame's absorb amount — gates grabbing/saving to the capture phase. */
  absorbAmount: number;
  scale: number;
  reduced: boolean;
}

function createCtl(kinds: readonly CardKind[]): Ctl {
  return {
    key: kinds.join(),
    bodies: kinds.map(() => ({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Vector3(),
      scale: 0,
      scaleVel: 0,
      mode: 'free' as Mode,
      modeT: 0,
      hover: 0,
      glint: 0,
      sinceThrow: Infinity,
    })),
    drag: null,
    hover: -1,
    pulse: 0,
    absorbAmount: 0,
    scale: 1,
    reduced: false,
  };
}

function setCursor(storeRef: RefObject<HeroStore>, value: '' | 'grab' | 'grabbing') {
  const el = storeRef.current?.cursorTarget;
  if (el) el.dataset.cursor = value;
}

/* ---------------------------------------------------------- components */

interface CardParts {
  group: THREE.Group;
  glow: THREE.MeshBasicMaterial;
  face: THREE.MeshPhysicalMaterial;
}

interface CardProps {
  kind: CardKind;
  index: number;
  quality: Quality;
  pal: Palette;
  glowTexture: THREE.Texture;
  register: (index: number, parts: CardParts | null) => void;
  onGrab: (index: number, e: ThreeEvent<PointerEvent>) => void;
  onHover: (index: number, over: boolean) => void;
}

const noRaycast = () => null;

function MemoryCard({ kind, index, quality, pal, glowTexture, register, onGrab, onHover }: CardProps) {
  const [w, h] = CARD_SPECS[kind].size;
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const face = useRef<THREE.MeshPhysicalMaterial>(null);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
  const texture = useMemo(() => createCardTexture(kind, quality, anisotropy), [kind, quality, anisotropy]);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      repaintCardTexture(texture, kind);
      invalidate();
    });
    return () => {
      alive = false;
      texture.dispose();
    };
  }, [texture, kind, invalidate]);

  useEffect(() => {
    if (group.current && glow.current && face.current) {
      register(index, { group: group.current, glow: glow.current, face: face.current });
    }
    return () => register(index, null);
  }, [index, register]);

  const pad = 0.075;

  return (
    <group
      ref={group}
      scale={0.0001}
      onPointerDown={(e) => onGrab(index, e)}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(index, true);
      }}
      onPointerOut={() => onHover(index, false)}
    >
      <mesh position={[0, 0, -0.09]} raycast={noRaycast}>
        <planeGeometry args={[w * 2, h * 1.7]} />
        <meshBasicMaterial
          ref={glow}
          map={glowTexture}
          color={pal.glow}
          transparent
          opacity={0}
          depthWrite={false}
          blending={pal.glowBlending}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <RoundedBox args={[w + pad * 2, h + pad * 2, 0.08]} radius={0.07} smoothness={4}>
        {quality === 'high' ? (
          <meshPhysicalMaterial
            color={pal.glass}
            transmission={1}
            thickness={0.45}
            roughness={0.18}
            ior={1.45}
            clearcoat={1}
            clearcoatRoughness={0.06}
            attenuationColor={pal.glassAtten}
            attenuationDistance={1.6}
          />
        ) : (
          <meshPhysicalMaterial
            color={pal.glassLow}
            roughness={0.24}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.1}
            transparent
            opacity={0.75}
          />
        )}
      </RoundedBox>
      <mesh position={[0, 0, 0.042]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial
          ref={face}
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={pal.faceEmissive}
          roughness={0.42}
          clearcoat={1}
          clearcoatRoughness={0.08}
          alphaTest={0.5}
        />
      </mesh>
    </group>
  );
}

interface CoreParts {
  group: THREE.Group;
  heart: THREE.Mesh;
  heartMat: THREE.MeshPhysicalMaterial;
  light: THREE.PointLight;
  ringA: THREE.Mesh;
  ringB: THREE.Mesh;
  scan: THREE.Mesh;
  scanMat: THREE.MeshBasicMaterial;
  wave: THREE.Mesh;
  waveMat: THREE.MeshBasicMaterial;
}

function createHeartGeometry() {
  // The File Hug mark, extruded and bevelled — the "paperweight" in the vault.
  const shape = new THREE.Shape();
  shape.moveTo(0.25, 0.25);
  shape.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  shape.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  shape.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  shape.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  shape.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  shape.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 8,
    curveSegments: 40,
  });
  geometry.center();
  geometry.rotateZ(Math.PI);
  return geometry;
}

function Core({ quality, pal, register }: { quality: Quality; pal: Palette; register: (p: CoreParts | null) => void }) {
  const group = useRef<THREE.Group>(null);
  const heart = useRef<THREE.Mesh>(null);
  const heartMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const scan = useRef<THREE.Mesh>(null);
  const scanMat = useRef<THREE.MeshBasicMaterial>(null);
  const wave = useRef<THREE.Mesh>(null);
  const waveMat = useRef<THREE.MeshBasicMaterial>(null);
  const heartGeometry = useMemo(() => createHeartGeometry(), []);

  useEffect(() => () => heartGeometry.dispose(), [heartGeometry]);

  useEffect(() => {
    if (
      group.current && heart.current && heartMat.current && light.current && ringA.current &&
      ringB.current && scan.current && scanMat.current && wave.current && waveMat.current
    ) {
      register({
        group: group.current,
        heart: heart.current,
        heartMat: heartMat.current,
        light: light.current,
        ringA: ringA.current,
        ringB: ringB.current,
        scan: scan.current,
        scanMat: scanMat.current,
        wave: wave.current,
        waveMat: waveMat.current,
      });
    }
    return () => register(null);
  }, [register]);

  return (
    <group ref={group}>
      <mesh raycast={noRaycast}>
        <sphereGeometry args={[0.84, 72, 72]} />
        {quality === 'high' ? (
          <meshPhysicalMaterial
            color="#ffffff"
            transmission={1}
            thickness={0.5}
            roughness={0.14}
            ior={1.22}
            clearcoat={1}
            clearcoatRoughness={0.02}
            attenuationColor={pal.coreAtten}
            attenuationDistance={6}
            iridescence={0.25}
            iridescenceIOR={1.3}
          />
        ) : (
          <meshPhysicalMaterial color={pal.glassLow} roughness={0.08} clearcoat={1} transparent opacity={0.3} />
        )}
      </mesh>
      <mesh ref={heart} geometry={heartGeometry} scale={0.6} raycast={noRaycast}>
        <meshPhysicalMaterial
          ref={heartMat}
          color={pal.heart}
          emissive={pal.heart}
          emissiveIntensity={pal.heartEmissive}
          roughness={0.22}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </mesh>
      <pointLight ref={light} color="#ff8a3d" intensity={pal.coreLight} distance={7} decay={2} />
      <mesh ref={ringA} raycast={noRaycast}>
        <torusGeometry args={[1.18, 0.012, 16, 180]} />
        <meshStandardMaterial color={pal.ring} metalness={1} roughness={0.22} />
      </mesh>
      <mesh ref={ringB} raycast={noRaycast}>
        <torusGeometry args={[1.36, 0.008, 16, 180]} />
        <meshStandardMaterial color={pal.ring} metalness={1} roughness={0.3} />
      </mesh>
      <mesh ref={scan} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <torusGeometry args={[1, 0.006, 8, 160]} />
        <meshBasicMaterial ref={scanMat} color={pal.glow} transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={wave} raycast={noRaycast}>
        <torusGeometry args={[0.9, 0.018, 12, 160]} />
        <meshBasicMaterial ref={waveMat} color={pal.glow} transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return (a - 1) / 2147483646;
  };
}

function Dust({ count, pal, sprite, reduced }: { count: number; pal: Palette; sprite: THREE.Texture; reduced: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rand = seeded(1234);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rand() - 0.5) * 20;
      arr[i * 3 + 1] = (rand() - 0.5) * 11;
      arr[i * 3 + 2] = -7 + rand() * 10;
    }
    return arr;
  }, [count]);

  useFrame((state, delta) => {
    const p = points.current;
    if (!p || reduced) return;
    p.rotation.y += Math.min(delta, 0.05) * 0.012;
    p.position.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.18;
  });

  return (
    <points ref={points} raycast={noRaycast}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        map={sprite}
        color={pal.dust}
        transparent
        opacity={pal.dustOpacity}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function StudioLights({ intensity }: { intensity: number }) {
  // A softbox studio built from Lightformers — no HDRI download, works offline.
  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      <Lightformer form="rect" intensity={2.4} color="#fff4e8" position={[0, 6, -1]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 5, 1]} />
      <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[-6, 1, 2]} rotation={[0, Math.PI / 2, 0]} scale={[7, 1.4, 1]} />
      <Lightformer form="rect" intensity={2} color="#ffe2c8" position={[6, 0.5, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[7, 1.8, 1]} />
      <Lightformer form="ring" intensity={1.8} color="#ff8a3d" position={[0, 0, -7]} scale={5} />
      <Lightformer form="rect" intensity={1.1} color="#ffb070" position={[0, -5, 3]} rotation={[-Math.PI / 2, 0, 0]} scale={[10, 3, 1]} />
      <Lightformer form="circle" intensity={1.4} color="#ffffff" position={[3, 3, 8]} scale={2} />
    </Environment>
  );
}

/* ---------------------------------------------------------------- rig */

const tmpTarget = new THREE.Vector3();
const tmpOrbit = new THREE.Vector3();
const tmpRot = new THREE.Vector3();
const tmpCam = new THREE.Vector3();
const tmpAcc = new THREE.Vector3();

function Rig({ storeRef, kinds, quality, theme, reduced, onSaved }: Omit<HeroSceneProps, 'active'>) {
  const pal = PALETTES[theme];
  const root = useRef<THREE.Group>(null);
  const cardParts = useRef<(CardParts | null)[]>([]);
  const coreParts = useRef<CoreParts | null>(null);
  const ctl = useRef<Ctl | null>(null);
  const savedRef = useRef(onSaved);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const layout = useMemo(() => computeLayout(size.width, size.height, kinds), [size.width, size.height, kinds]);
  const glowTexture = useMemo(() => createGlowTexture(), []);

  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  useEffect(() => {
    savedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    const s = storeRef.current;
    s.invalidate = invalidate;
    return () => {
      s.invalidate = () => {};
    };
  }, [storeRef, invalidate]);

  const getCtl = useCallback((): Ctl => {
    const key = kinds.join();
    if (!ctl.current || ctl.current.key !== key) ctl.current = createCtl(kinds);
    return ctl.current;
  }, [kinds]);

  const registerCard = useCallback((index: number, parts: CardParts | null) => {
    cardParts.current[index] = parts;
  }, []);
  const registerCore = useCallback((parts: CoreParts | null) => {
    coreParts.current = parts;
  }, []);

  const onHover = useCallback(
    (index: number, over: boolean) => {
      const c = getCtl();
      if (over) c.hover = index;
      else if (c.hover === index) c.hover = -1;
      if (!c.drag) setCursor(storeRef, c.hover >= 0 && c.absorbAmount < 0.1 ? 'grab' : '');
      invalidate();
    },
    [getCtl, storeRef, invalidate]
  );

  const onGrab = useCallback(
    (index: number, e: ThreeEvent<PointerEvent>) => {
      const c = getCtl();
      const b = c.bodies[index];
      const group = root.current;
      if (!group || !b || c.drag || b.mode !== 'free' || b.scale < 0.45 * c.scale) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();

      const world = group.localToWorld(b.pos.clone());
      const normal = e.camera.getWorldDirection(new THREE.Vector3()).negate();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, world);
      const hit = e.ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit) return;

      c.drag = {
        index,
        pointerId: e.pointerId,
        plane,
        offset: world.sub(hit),
        target: b.pos.clone(),
        startX: e.nativeEvent.clientX,
        startY: e.nativeEvent.clientY,
        startT: performance.now(),
        moved: false,
        samples: [],
      };
      b.mode = 'drag';
      // Read synchronously by the hero's touchstart listener to block page scroll.
      storeRef.current.grabbing = true;
      setCursor(storeRef, 'grabbing');
      invalidate();
    },
    [getCtl, storeRef, invalidate]
  );

  // Drag tracking lives on window so a throw can leave the canvas.
  useEffect(() => {
    const ndc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const hit = new THREE.Vector3();

    const move = (e: PointerEvent) => {
      const c = ctl.current;
      const d = c?.drag;
      const group = root.current;
      if (!c || !d || !group || e.pointerId !== d.pointerId) return;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(d.plane, hit)) return;
      hit.add(d.offset);
      group.worldToLocal(hit);
      d.target.copy(hit);
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) d.moved = true;
      d.samples.push({ x: hit.x, y: hit.y, z: hit.z, t: performance.now() });
      if (d.samples.length > 6) d.samples.shift();
      invalidate();
    };

    const end = (e: PointerEvent) => {
      const c = ctl.current;
      const d = c?.drag;
      if (!c || !d || e.pointerId !== d.pointerId) return;
      c.drag = null;
      storeRef.current.grabbing = false;
      setCursor(storeRef, c.hover >= 0 ? 'grab' : '');
      const b = c.bodies[d.index];
      if (!b) return;
      b.mode = 'free';
      if (e.type === 'pointercancel') return;
      b.sinceThrow = 0;

      const now = performance.now();
      const recent = d.samples.filter((s) => now - s.t < 90);
      if (!c.reduced && recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        const secs = Math.max(0.016, (last.t - first.t) / 1000);
        b.vel.set((last.x - first.x) / secs, (last.y - first.y) / secs, (last.z - first.z) / secs).clampLength(0, 14);
      }
      const tap = !d.moved && now - d.startT < 350;
      // Dropped onto the vault (judged where the pointer let go — the card itself lags on a spring).
      if (tap || d.target.length() < 0.95 * c.scale) storeRef.current.absorbQueue.push(d.index);
      invalidate();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [camera, gl, invalidate, storeRef]);

  useFrame((state, rawDelta) => {
    const group = root.current;
    if (!group) return;
    const c = getCtl();
    const st = storeRef.current;
    const L = layout;
    const dt = Math.min(rawDelta, 1 / 30);
    const t = state.clock.elapsedTime;
    const motion = reduced ? 0 : 1;
    const ease = (rate: number) => (reduced ? 1 : 1 - Math.exp(-rate * dt));

    c.scale = L.s;
    c.reduced = reduced;

    const cam = state.camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - L.fov) > 0.01) {
      cam.fov = L.fov;
      cam.updateProjectionMatrix();
    }

    const p = st.progress;
    const a = smoothstep(0.2, 0.42, p);
    const r = smoothstep(0.6, 0.78, p);
    c.absorbAmount = a;

    // Cinematic camera: drifts toward the cursor, dollies in while indexing.
    tmpCam.set(state.pointer.x * 0.45 * motion, 0.15 + state.pointer.y * 0.25 * motion, L.camZ - a * 1.1 + r * 0.7);
    cam.position.lerp(tmpCam, ease(2.4));
    cam.lookAt(0, 0, 0);
    group.position.set(L.offset[0], L.offset[1], 0);

    // Save requests from taps, drops near the vault, and the keyboard chips.
    while (st.absorbQueue.length) {
      const i = st.absorbQueue.shift() as number;
      const b = c.bodies[i];
      if (!b || b.mode !== 'free' || a > 0.1 || b.scale < 0.4 * L.s) continue;
      if (reduced) {
        b.glint = 1;
        savedRef.current(kinds[i]);
      } else {
        b.mode = 'absorb';
        b.modeT = 0;
      }
    }

    c.pulse = Math.max(0, c.pulse - dt * 1.1);
    const n = kinds.length;

    for (let i = 0; i < n; i++) {
      const b = c.bodies[i];
      const parts = cardParts.current[i];
      if (!b || !parts) continue;
      const kind = kinds[i];
      const spec = CARD_SPECS[kind];
      const home = L.homes[i];
      const featured = kind === FEATURED_KIND;
      const phase = i * 1.37;

      // Where it wants to be: scattered → orbiting the vault → (featured) pulled forward.
      tmpTarget.set(
        home.x + Math.sin(t * 0.55 + phase) * 0.07 * motion,
        home.y + Math.cos(t * 0.47 + phase) * 0.1 * motion,
        home.z
      );
      const ang = (i / n) * Math.PI * 2 + t * 0.3 * motion;
      tmpOrbit.set(Math.cos(ang) * L.orbitR, Math.sin(ang) * L.orbitR * 0.3 + 0.05, Math.sin(ang) * L.orbitR * 0.6);
      tmpTarget.lerp(tmpOrbit, a);
      let scale = THREE.MathUtils.lerp(L.s, L.s * 0.24, a);
      if (featured) {
        tmpTarget.lerp(L.featured, r);
        scale = THREE.MathUtils.lerp(scale, L.featuredScale, r);
      }

      const hovered = (c.hover === i || st.focus === i) && b.mode !== 'absorb' && a < 0.5;
      b.hover += ((hovered ? 1 : 0) - b.hover) * ease(10);
      tmpTarget.z += b.hover * 0.35 * L.s;
      scale *= 1 + b.hover * 0.05;

      if (b.mode === 'drag' && c.drag?.index === i) tmpTarget.copy(c.drag.target);
      if (b.mode === 'absorb') {
        tmpTarget.set(0, 0, 0);
        scale = 0;
        b.modeT += dt;
      }
      if (b.mode === 'stored') {
        scale = 0;
        b.modeT += dt;
        if (b.modeT > 1.4) {
          b.mode = 'free';
          b.pos.set(0, 0, 0);
          b.vel.set(0, 0, 0);
          b.scale = 0.02;
          b.glint = 1;
        }
      }

      // Damped springs — a drag is stiff, a resting card is a little bouncy.
      if (reduced) {
        b.pos.copy(tmpTarget);
        b.vel.set(0, 0, 0);
        b.scale = b.mode === 'stored' ? 0 : scale;
      } else {
        const k = b.mode === 'drag' ? 260 : b.mode === 'absorb' ? 80 : 55;
        const damping = b.mode === 'drag' ? 30 : b.mode === 'absorb' ? 13 : 9.5;
        tmpAcc.subVectors(tmpTarget, b.pos).multiplyScalar(k).addScaledVector(b.vel, -damping);
        b.vel.addScaledVector(tmpAcc, dt);
        b.pos.addScaledVector(b.vel, dt);
        if (b.mode !== 'stored') {
          b.scaleVel += ((scale - b.scale) * 90 - b.scaleVel * 14) * dt;
          b.scale = Math.max(0, b.scale + b.scaleVel * dt);
        }
      }

      if (b.mode === 'absorb' && (b.pos.length() < 0.14 * L.s || b.modeT > 1.1)) {
        b.mode = 'stored';
        b.modeT = 0;
        b.scale = 0;
        b.scaleVel = 0;
        c.pulse = 1;
        savedRef.current(kind);
      }

      // Thrown into the vault: save it. Only user throws heading inward count —
      // cards emerging from the vault also move fast near it.
      b.sinceThrow += dt;
      if (
        b.mode === 'free' &&
        a < 0.08 &&
        b.sinceThrow < 1.2 &&
        b.vel.lengthSq() > 9 &&
        b.vel.dot(b.pos) < 0 &&
        b.pos.length() < 1.05 * L.s
      ) {
        b.sinceThrow = Infinity;
        b.mode = 'absorb';
        b.modeT = 0;
      }

      // Orientation: resting pose, idle sway, cursor tilt, and lean into motion.
      const rest = 1 - a;
      tmpRot.set(spec.rot[0] * rest, spec.rot[1] * rest + a * Math.cos(ang) * 0.5, spec.rot[2] * rest);
      if (featured) tmpRot.multiplyScalar(1 - r);
      tmpRot.x += Math.sin(t * 0.4 + phase) * 0.04 * motion;
      tmpRot.y += Math.cos(t * 0.35 + phase) * 0.05 * motion;
      const attention = Math.max(b.hover, featured ? r : 0) * motion;
      tmpRot.x -= state.pointer.y * 0.22 * attention;
      tmpRot.y += state.pointer.x * 0.3 * attention;
      tmpRot.y += THREE.MathUtils.clamp(b.vel.x * 0.07, -0.6, 0.6);
      tmpRot.x -= THREE.MathUtils.clamp(b.vel.y * 0.07, -0.6, 0.6);
      tmpRot.z -= THREE.MathUtils.clamp(b.vel.x * 0.03, -0.3, 0.3);
      b.rot.lerp(tmpRot, ease(7));

      parts.group.position.copy(b.pos);
      parts.group.rotation.set(b.rot.x, b.rot.y, b.rot.z);
      parts.group.scale.setScalar(Math.max(b.scale, 0.0001));
      parts.group.visible = b.scale > 0.012;

      if (!reduced) b.glint = Math.max(0, b.glint - dt * 0.55);
      const glow = Math.max(b.hover * 0.55, featured ? r * 0.95 : 0, b.glint * 0.9, b.mode === 'drag' ? 0.5 : 0);
      parts.glow.opacity = glow * pal.glowStrength;
      parts.face.emissiveIntensity = pal.faceEmissive + b.glint * 0.35 + (featured ? r * 0.12 : 0);
    }

    const core = coreParts.current;
    if (core) {
      const breathe = Math.sin(t * 1.6) * 0.08 * motion;
      core.group.scale.setScalar(L.s * (1 + c.pulse * 0.07));
      core.heart.rotation.set(0, Math.sin(t * 0.5) * 0.5 * motion + a * Math.PI * 2 * motion, 0);
      core.heartMat.emissiveIntensity = pal.heartEmissive * (1 + breathe + c.pulse * 1.6 + a * 0.5);
      core.light.intensity = pal.coreLight * (1 + c.pulse * 2 + a * 0.8);
      core.ringA.rotation.set(1.2 + a * 0.25, t * 0.22 * motion, 0.25);
      core.ringB.rotation.set(-0.55 - a * 0.2, 0.4 - t * 0.17 * motion, t * 0.08 * motion);
      core.scan.position.y = Math.sin(t * 1.3) * 0.72 * motion;
      core.scanMat.opacity = a * (1 - r) * 0.85;
      core.scan.visible = core.scanMat.opacity > 0.01;
      core.wave.scale.setScalar(1 + (1 - c.pulse) * 1.9);
      core.waveMat.opacity = c.pulse * 0.75;
      core.wave.visible = c.pulse > 0.01;
    }
  });

  return (
    <group ref={root}>
      <Core quality={quality} pal={pal} register={registerCore} />
      {kinds.map((kind, i) => (
        <MemoryCard
          key={kind}
          kind={kind}
          index={i}
          quality={quality}
          pal={pal}
          glowTexture={glowTexture}
          register={registerCard}
          onGrab={onGrab}
          onHover={onHover}
        />
      ))}
      <mesh position={[0, 0.2, -6]} raycast={noRaycast}>
        <planeGeometry args={[18, 14]} />
        <meshBasicMaterial
          map={glowTexture}
          color={pal.backGlow}
          transparent
          opacity={pal.backGlowOpacity}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <Dust count={quality === 'high' ? 220 : 90} pal={pal} sprite={glowTexture} reduced={reduced} />
      {quality === 'high' && (
        <ContactShadows
          position={[0, layout.floorY, 0]}
          scale={16}
          blur={2.6}
          far={5}
          resolution={512}
          opacity={pal.shadowOpacity}
          color={pal.shadowColor}
        />
      )}
    </group>
  );
}

export default function HeroScene(props: HeroSceneProps) {
  const { quality, reduced, active, theme } = props;
  const pal = PALETTES[theme];

  return (
    <Canvas
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.5]}
      frameloop={active ? (reduced ? 'demand' : 'always') : 'never'}
      camera={{ position: [0, 0.15, 9.5], fov: 35, near: 0.1, far: 60 }}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[pal.bg]} />
      <fog attach="fog" args={[pal.bg, 11, 24]} />
      <ambientLight intensity={pal.ambient} />
      <directionalLight position={[4, 6, 5]} intensity={pal.key} color="#fff1e0" />
      <StudioLights intensity={pal.env} />
      <Rig
        storeRef={props.storeRef}
        kinds={props.kinds}
        quality={quality}
        theme={theme}
        reduced={reduced}
        onSaved={props.onSaved}
      />
    </Canvas>
  );
}
