// The world around the base: sky (day / night with stars / storm / Sol-12 event), sun and
// fill light with soft shadows, rolling ground with colour variety and rover tracks,
// distant hill silhouettes, rocks (instanced + a few Kenney models), drifting dust and
// the storm dust wall. Deterministic: no Math.random, the world looks the same every time.
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorHex, colors } from '../ui/tokens';
import { Model, softDot } from './core';
import type { SceneLook } from './look';
import { AIRLOCK_OUT, GREENHOUSE_AT, GREENHOUSE_R, groundHeight, HAB_R, LANDING_AT, SHELTER_AT, SOLAR_AT, SPOTS, type V2, type V3 } from './world';

export type Quality = 'high' | 'low';

export const SUN_DIR: V3 = [0.42, 0.55, 0.72];

// ------------------------------------------------------------------ sky

const SKY_VERT = `varying vec3 vDir; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vDir = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SKY_FRAG = `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform float sunAmt; uniform float night; uniform float event; uniform float storm; uniform float time; varying vec3 vDir;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
void main(){
  vec3 d = normalize(vDir); float h = clamp(d.y, -0.2, 1.0);
  vec3 c = mix(horizon, top, pow(max(h,0.0), 0.5));
  // Soft glow band just above the horizon.
  c += horizon * 0.10 * exp(-abs(h) * 14.0) * (1.0 - night);
  float s = max(dot(d, normalize(sunDir)), 0.0);
  // Small bluish-white Mars sun with a halo (the real Martian sunset glow is bluish).
  c += vec3(0.92,0.96,1.0) * (smoothstep(0.9993, 0.9997, s) * 1.6 + pow(s, 22.0) * 0.22 + pow(s, 4.0) * 0.06) * sunAmt;
  // Stars at night.
  if (night > 0.01 && d.y > 0.0) {
    vec2 g = floor(vec2(atan(d.z, d.x) * 140.0, d.y * 220.0));
    float r = h21(g);
    float tw = 0.6 + 0.4 * sin(time * 2.0 + r * 40.0);
    c += vec3(0.85, 0.9, 1.0) * step(0.9965, r) * tw * night * smoothstep(0.0, 0.25, d.y);
  }
  // Solar particle event: slow violet curtains high in the sky.
  if (event > 0.01) {
    float band = sin(atan(d.z, d.x) * 6.0 + time * 0.35) * 0.5 + 0.5;
    float hband = smoothstep(0.15, 0.55, h) * (1.0 - smoothstep(0.55, 0.95, h));
    c += vec3(0.55, 0.32, 0.75) * band * hband * 0.35 * event;
  }
  // Storm: flat murky haze.
  c = mix(c, horizon * 0.95, storm * 0.6);
  gl_FragColor = vec4(c, 1.0);
}`;

function skyColors(look: SceneLook): [string, string] {
  if (look.night) return [colors.skyNightTop, colors.skyNightHorizon];
  if (look.storm) return [colors.skyStormTop, colors.skyStormHorizon];
  if (look.solarEvent) return [colors.skyEventTop, colors.skyEventHorizon];
  return [colors.skyTop, colors.skyHorizon];
}

export function Sky({ look }: { look: SceneLook }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { scene } = useThree();
  const [top, horizon] = skyColors(look);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(top) },
          horizon: { value: new THREE.Color(horizon) },
          sunDir: { value: new THREE.Vector3(...SUN_DIR) },
          sunAmt: { value: 1 },
          night: { value: look.night ? 1 : 0 },
          event: { value: look.solarEvent ? 1 : 0 },
          storm: { value: look.storm ? 1 : 0 },
          time: { value: 0 },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const target = useMemo(() => ({ top: new THREE.Color(top), horizon: new THREE.Color(horizon) }), [top, horizon]);
  useLayoutEffect(() => {
    scene.fog = new THREE.Fog(horizon, look.storm ? 10 : 60, look.storm ? 60 : 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = 1 - Math.exp(-dt * 1.6);
    const u = mat.uniforms;
    (u.top!.value as THREE.Color).lerp(target.top, k);
    (u.horizon!.value as THREE.Color).lerp(target.horizon, k);
    u.sunAmt!.value += ((look.storm ? 0.1 : look.night ? 0 : 1) - u.sunAmt!.value) * k;
    u.night!.value += ((look.night ? 1 : 0) - u.night!.value) * k;
    u.event!.value += ((look.solarEvent ? 1 : 0) - u.event!.value) * k;
    u.storm!.value += ((look.storm ? 1 : 0) - u.storm!.value) * k;
    u.time!.value = st.clock.elapsedTime;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.color.copy(u.horizon!.value as THREE.Color);
      fog.near += ((look.storm ? 6 : 60) - fog.near) * k;
      fog.far += ((look.storm ? 48 : 300) - fog.far) * k;
    }
    if (mesh.current) mesh.current.position.copy(st.camera.position);
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[480, 32, 16]} />
    </mesh>
  );
}

// ------------------------------------------------------------------ light

export function Lights({ look, quality }: { look: SceneLook; quality: Quality }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const { scene, gl } = useThree();
  useLayoutEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    const l = sun.current;
    if (!l) return;
    l.target.position.set(10, 0, -2);
    scene.add(l.target);
    const c = l.shadow.camera;
    c.left = -36;
    c.right = 36;
    c.top = 36;
    c.bottom = -36;
    c.near = 1;
    c.far = 160;
    c.updateProjectionMatrix();
    l.shadow.radius = 3;
    return () => void scene.remove(l.target);
  }, [scene, gl]);
  const skyTint = useMemo(() => new THREE.Color(), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = 1 - Math.exp(-dt * 1.6);
    const sunT = look.night ? 0.0 : look.storm ? 0.35 : 2.4;
    const hemiT = look.night ? 0.35 : look.storm ? 1.1 : 0.95;
    const fillT = look.night ? 0.25 : 0.35;
    if (sun.current) sun.current.intensity += (sunT - sun.current.intensity) * k;
    if (hemi.current) {
      hemi.current.intensity += (hemiT - hemi.current.intensity) * k;
      skyTint.setHex(look.night ? 0x3a4a80 : look.solarEvent ? colorHex.skyEventTop : colorHex.skyTop);
      hemi.current.color.lerp(skyTint, k);
    }
    if (fill.current) fill.current.intensity += (fillT - fill.current.intensity) * k;
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={[colorHex.skyTop, colorHex.marsBrown, 0.95]} />
      <directionalLight
        ref={sun}
        position={[10 + SUN_DIR[0] * 70, SUN_DIR[1] * 70, -2 + SUN_DIR[2] * 70]}
        color={look.solarEvent ? 0xf0e0f6 : 0xfff3ee}
        intensity={2.4}
        castShadow={quality === 'high'}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      {/* Cool fill from the opposite side so shadowed faces are not black. */}
      <directionalLight ref={fill} position={[-40, 30, -50]} color={0xb9c6ea} intensity={0.35} />
    </>
  );
}

// ------------------------------------------------------------------ ground

/** Tracks: two thin darker lines along the EVA paths (rover and boots). */
const TRACKS: V2[][] = [
  [AIRLOCK_OUT, [17.5, -5], SPOTS.solar!.stand, [SOLAR_AT[0] - 9, SOLAR_AT[1] + 2]],
  [AIRLOCK_OUT, [18.5, 7], SPOTS.landing!.stand, LANDING_AT],
];

function distToTracks(x: number, z: number): number {
  let best = 1e9;
  for (const t of TRACKS)
    for (let i = 1; i < t.length; i++) {
      const a = t[i - 1]!;
      const b = t[i]!;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - a[0] - dx * u, z - a[1] - dz * u));
    }
  return best;
}

export function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(700, 700, 160, 160);
    g.rotateX(-Math.PI / 2);
    g.translate(10, 0, 0);
    const pos = g.attributes.position!;
    const col = new Float32Array(pos.count * 3);
    const ground = new THREE.Color(colors.marsGround);
    const rose = new THREE.Color(colors.marsRose);
    const brown = new THREE.Color(colors.marsBrown);
    const dust = new THREE.Color(colors.marsDust);
    const far = new THREE.Color(colors.skyHorizon);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = groundHeight(x, z);
      pos.setY(i, y);
      const n1 = Math.sin(x * 0.21 + z * 0.13) * 0.5 + Math.sin(x * 0.05 - z * 0.09 + 1.3) * 0.5;
      const n2 = Math.sin(x * 0.9 + z * 1.3) * Math.sin(x * 0.4 - z * 0.7);
      tmp.copy(ground).lerp(rose, 0.5 + 0.5 * n1);
      if (n2 > 0.55) tmp.lerp(brown, (n2 - 0.55) * 1.4);
      if (n2 < -0.6) tmp.lerp(dust, (-n2 - 0.6) * 1.2);
      // Higher ground catches more light; far hills fade towards the sky colour.
      tmp.lerp(dust, Math.min(0.35, Math.max(0, y / 60)));
      const r = Math.hypot(x - 10, z);
      tmp.lerp(far, Math.min(0.45, Math.max(0, (r - 120) / 260)));
      const tr = distToTracks(x, z);
      if (tr < 1.6) tmp.lerp(brown, 0.28 * (1 - tr / 1.6));
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading />
    </mesh>
  );
}

/** Ring of far mountains: a jagged silhouette that melts into the fog. */
export function Hills() {
  const geo = useMemo(() => {
    const N = 160;
    const R = 330;
    const pos: number[] = [];
    const col: number[] = [];
    const base = new THREE.Color(colors.marsRose).lerp(new THREE.Color(colors.skyHorizon), 0.45);
    const tip = new THREE.Color(colors.marsDust).lerp(new THREE.Color(colors.skyHorizon), 0.3);
    const hAt = (i: number) => {
      const a = (i / N) * Math.PI * 2;
      return 26 + Math.sin(a * 3 + 1) * 14 + Math.sin(a * 7 + 2) * 8 + Math.abs(Math.sin(a * 17)) * 9 + Math.sin(a * 31) * 3;
    };
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 1) / N) * Math.PI * 2;
      const p = (a: number, y: number) => [10 + Math.cos(a) * R, y, Math.sin(a) * R];
      const q = [p(a0, -5), p(a1, -5), p(a1, hAt(i + 1)), p(a0, hAt(i))];
      for (const idx of [0, 1, 2, 0, 2, 3]) {
        pos.push(...q[idx]!);
        const c = idx >= 2 ? tip : base;
        col.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} fog />
    </mesh>
  );
}

// ------------------------------------------------------------------ rocks

function nearPath(x: number, z: number, d: number) {
  return distToTracks(x, z) < d;
}

/** Deterministic rock list, kept off paths and buildings. */
function rockList(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; out.length < 230 && i < 3000; i++) {
    const h = Math.sin(i * 12.9898) * 43758.5453;
    const r1 = h - Math.floor(h);
    const h2 = Math.sin(i * 78.233) * 12543.123;
    const r2 = h2 - Math.floor(h2);
    const ang = r1 * Math.PI * 2;
    const rad = 8 + Math.pow(r2, 0.9) * 130;
    const x = 10 + Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (Math.hypot(x, z) < HAB_R + 3) continue;
    if (Math.hypot(x - GREENHOUSE_AT[0], z - GREENHOUSE_AT[1]) < GREENHOUSE_R + 2) continue;
    if (Math.hypot(x - SHELTER_AT[0], z - SHELTER_AT[1]) < 5.5) continue;
    if (Math.abs(x - SOLAR_AT[0]) < 10 && Math.abs(z - SOLAR_AT[1]) < 6.5) continue;
    if (Math.hypot(x - LANDING_AT[0], z - LANDING_AT[1]) < 7.5) continue;
    if (x > HAB_R && x < 13.5 && Math.abs(z) < 3.2) continue;
    if (nearPath(x, z, 2.8)) continue;
    const s = 0.12 + Math.pow((r1 * 7.3) % 1, 3) * (rad > 30 ? 1.8 : 0.75);
    out.push([x, z, s, i]);
  }
  return out;
}

export function Rocks({ quality }: { quality: Quality }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const list = useMemo(rockList, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    list.forEach(([x, z, s, i], k) => {
      o.position.set(x, groundHeight(x, z) + s * 0.2, z);
      o.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      o.scale.set(s * 1.25, s * 0.7, s);
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
      c.setHex(i % 3 === 0 ? colorHex.marsBrown : i % 3 === 1 ? 0x8a6a66 : 0x6d5452);
      m.setColorAt(k, c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [list]);
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, list.length]} castShadow={quality === 'high'} receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
      {/* Hand-placed detail near the walk paths and the base. */}
      {(
        [
          ['rock_largeA', [15, -9], 2.6, 0.4],
          ['rock_largeB', [20.5, 3.5], 2.2, 1.9],
          ['rocks_smallA', [14.5, 3.5], 2.5, 0.3],
          ['rocks_smallB', [24, -5.5], 2.4, 2.4],
          ['craterLarge', [36, 4], 9, 0],
          ['crater', [8, -14], 6, 1],
          ['rock_largeA', [-14, 9], 3.2, 2.8],
          ['rocks_smallA', [-3, -10], 2.6, 1.2],
          ['rock_largeB', [4, 12], 2.8, 0.6],
          ['rocks_smallB', [33, -8], 2.6, 0.9],
        ] as const
      ).map(([name, [x, z], s, ry], i) => (
        <Model key={i} name={name} position={[x, groundHeight(x, z) - 0.02, z]} scale={s} rotation={[0, ry, 0]} shadows={quality === 'high'} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ dust

/** Drifting dust around the camera; many more, faster grains in a storm. */
export function Dust({ look, quality }: { look: SceneLook; quality: Quality }) {
  const N = quality === 'high' ? 420 : 160;
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.sin(i * 91.7) * 0.5 + 0.5) * 40 - 20;
      p[i * 3 + 1] = (Math.sin(i * 47.3) * 0.5 + 0.5) * 7;
      p[i * 3 + 2] = (Math.sin(i * 13.1) * 0.5 + 0.5) * 40 - 20;
    }
    return p;
  }, [N]);
  const mat = useRef<THREE.PointsMaterial>(null);
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const pts = ref.current;
    if (!pts) return;
    const arr = (pts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const wind = look.storm ? 9 : 0.5;
    const c = st.camera.position;
    const t = st.clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      let x = arr[i * 3]! + wind * dt;
      let y = arr[i * 3 + 1]! + Math.sin(t * 0.7 + i) * 0.08 * dt;
      let z = arr[i * 3 + 2]! + wind * 0.35 * dt;
      if (x - c.x > 20) x -= 40;
      if (x - c.x < -20) x += 40;
      if (z - c.z > 20) z -= 40;
      if (z - c.z < -20) z += 40;
      if (y < 0) y += 7;
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    pts.geometry.attributes.position!.needsUpdate = true;
    const m = mat.current;
    if (m) {
      m.opacity += ((look.storm ? 0.85 : 0.4) - m.opacity) * (1 - Math.exp(-dt * 2));
      m.size += ((look.storm ? 0.16 : 0.07) - m.size) * (1 - Math.exp(-dt * 2));
    }
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} map={softDot()} color={colorHex.marsDust} size={0.07} transparent opacity={0.4} depthWrite={false} />
    </points>
  );
}

/** Storm: a moving wall of dust around the camera (only while the storm lasts). */
export function DustWall({ look }: { look: SceneLook }) {
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 260; i++) {
      const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 256;
      const y = (Math.sin(i * 78.233) * 0.5 + 0.5) * 64;
      const r = 6 + (i % 7) * 4;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(201,179,174,0.55)');
      grd.addColorStop(1, 'rgba(201,179,174,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(4, 1);
    return t;
  }, []);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    tex.offset.x -= dt * 0.05;
    if (mesh.current) mesh.current.position.set(st.camera.position.x, 0, st.camera.position.z);
    if (mat.current) {
      mat.current.opacity += ((look.storm ? 0.75 : 0) - mat.current.opacity) * (1 - Math.exp(-dt * 1.5));
      if (mesh.current) mesh.current.visible = mat.current.opacity > 0.01;
    }
  });
  return (
    <mesh ref={mesh} visible={false} renderOrder={1}>
      <cylinderGeometry args={[26, 26, 18, 32, 1, true]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} side={THREE.BackSide} depthWrite={false} fog={false} color={colorHex.marsDust} />
    </mesh>
  );
}
