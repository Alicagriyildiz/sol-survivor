// Small helpers for the battery and greenhouse stations (station agent S1):
// a sagging cable made of instanced segments, and a directional particle jet
// (steam, water spray, bubbles). No allocations per frame.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { softDot } from '../core';

// ------------------------------------------------------------------ cable

export interface CableState {
  o: THREE.Object3D;
  c: THREE.Vector3;
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  dir: THREE.Vector3;
  up: THREE.Vector3;
}

export const makeCable = (): CableState => ({
  o: new THREE.Object3D(),
  c: new THREE.Vector3(),
  p0: new THREE.Vector3(),
  p1: new THREE.Vector3(),
  dir: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
});

function bez(out: THREE.Vector3, a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number) {
  const u = 1 - t;
  out.set(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z);
}

/** Lays the instanced cylinder segments of `mesh` along a sagging curve from `a` to `b` (local coords). */
export function layCable(mesh: THREE.InstancedMesh, s: CableState, a: THREE.Vector3, b: THREE.Vector3, sag: number, floor = 0.02) {
  const n = mesh.count;
  s.c.copy(a).add(b).multiplyScalar(0.5);
  s.c.y = Math.max(floor, s.c.y - sag);
  for (let i = 0; i < n; i++) {
    bez(s.p0, a, s.c, b, i / n);
    bez(s.p1, a, s.c, b, (i + 1) / n);
    s.dir.subVectors(s.p1, s.p0);
    const len = s.dir.length();
    s.o.position.copy(s.p0).add(s.p1).multiplyScalar(0.5);
    if (len > 1e-5) s.o.quaternion.setFromUnitVectors(s.up, s.dir.multiplyScalar(1 / len));
    s.o.scale.set(1, len * 1.15 + 0.002, 1);
    s.o.updateMatrix();
    mesh.setMatrixAt(i, s.o.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ particle jet

/**
 * Particles shot from `origin` along `dir` (both mutable, read every frame, local coords of
 * the parent). `rate()` is particles per frame-at-30fps (0 stops it).
 */
export function Jet({
  origin,
  dir,
  rate,
  color,
  size = 0.1,
  speed = 0.8,
  spread = 0.2,
  life = 1.2,
  gravity = 0,
  opacity = 0.75,
  max = 48,
}: {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  rate: () => number;
  color: number;
  size?: number;
  speed?: number;
  spread?: number;
  life?: number;
  gravity?: number;
  opacity?: number;
  max?: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const st = useMemo(() => ({ pos: new Float32Array(max * 3).fill(-999), vel: new Float32Array(max * 3), age: new Float32Array(max).fill(99), acc: 0, k: 0 }), [max]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    st.acc += Math.max(0, rate()) * dt * 30;
    while (st.acc >= 1) {
      st.acc -= 1;
      const i = st.k++ % max;
      const s1 = Math.sin(st.k * 12.9898);
      const s2 = Math.sin(st.k * 78.233);
      const s3 = Math.sin(st.k * 39.425);
      const v = speed * (0.75 + Math.abs(s3) * 0.5);
      st.pos[i * 3] = origin.x;
      st.pos[i * 3 + 1] = origin.y;
      st.pos[i * 3 + 2] = origin.z;
      st.vel[i * 3] = dir.x * v + s1 * spread;
      st.vel[i * 3 + 1] = dir.y * v + s3 * spread * 0.5;
      st.vel[i * 3 + 2] = dir.z * v + s2 * spread;
      st.age[i] = 0;
    }
    for (let i = 0; i < max; i++) {
      if (st.age[i]! > life) {
        st.pos[i * 3 + 1] = -999;
        continue;
      }
      st.age[i]! += dt;
      st.vel[i * 3 + 1]! -= gravity * dt;
      for (let k = 0; k < 3; k++) st.pos[i * 3 + k]! += st.vel[i * 3 + k]! * dt;
    }
    if (ref.current) (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[st.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} transparent opacity={opacity} depthWrite={false} map={softDot()} />
    </points>
  );
}

/** Spark/flash helper: a value that jumps to 1 and decays. */
export const decay = (v: number, dt: number, speed = 1.2) => Math.max(0, v - dt * speed);
