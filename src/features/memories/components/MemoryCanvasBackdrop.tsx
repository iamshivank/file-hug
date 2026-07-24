'use client';

import { useEffect, useRef } from 'react';

/**
 * A deliberately quiet Three.js layer for the library. It is one shared canvas
 * behind the grid (not a WebGL canvas in every card), so the interaction feels
 * tactile without making saved content harder to scan.
 */
export default function MemoryCanvasBackdrop() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!host || reducedMotion.matches) return;

    let disposed = false;
    let frame = 0;
    let renderer: import('three').WebGLRenderer | undefined;
    let resizeObserver: ResizeObserver | undefined;

    void import('three').then((THREE) => {
      if (disposed || !host) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 8);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.appendChild(renderer.domElement);

      const pointCount = 56;
      const positions = new Float32Array(pointCount * 3);
      for (let index = 0; index < pointCount; index += 1) {
        const offset = index * 3;
        positions[offset] = (Math.random() - 0.5) * 11;
        positions[offset + 1] = (Math.random() - 0.5) * 6.5;
        positions[offset + 2] = (Math.random() - 0.5) * 2;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: 0xfb8b3d,
        size: 0.042,
        transparent: true,
        opacity: 0.44,
        sizeAttenuation: true,
      });
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        if (!renderer || width === 0 || height === 0) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const render = (time: number) => {
        const drift = time * 0.00012;
        particles.rotation.y = drift;
        particles.rotation.z = Math.sin(drift * 2) * 0.05;
        renderer?.render(scene, camera);
        frame = window.requestAnimationFrame(render);
      };
      frame = window.requestAnimationFrame(render);

      (host as HTMLDivElement & { __disposeThree?: () => void }).__disposeThree = () => {
        geometry.dispose();
        material.dispose();
      };
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      const typedHost = host as HTMLDivElement & { __disposeThree?: () => void };
      typedHost.__disposeThree?.();
      typedHost.__disposeThree = undefined;
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="memory-canvas" aria-hidden="true" />;
}
