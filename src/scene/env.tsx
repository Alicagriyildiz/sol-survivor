// The world around the base: sky (day / night with stars / storm / Sol-12 event), sun and
// fill light with soft shadows, rolling ground with colour variety and rover tracks,
// distant hill silhouettes, rocks (instanced + a few Kenney models), drifting dust and
// the storm dust wall. Deterministic: no Math.random, the world looks the same every time.
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorHex, colors } from '../ui/tokens';
import { Model, softDot, type ModelName } from './core';
import type { SceneLook } from './look';
import { AIRLOCK_OUT, GREENHOUSE_AT, GREENHOUSE_R, groundHeight, HAB_R, LANDING_AT, SHELTER_AT, SOLAR_AT, SPOTS, type V2, type V3 } from './world';

export type Quality = 'high' | 'low';

// Low afternoon sun: long, crisp shadows and a sun disc that is often in view.
export const SUN_DIR: V3 = [0.5, 0.3, 0.81];

// ------------------------------------------------------------------ sky

const SKY_VERT = `varying vec3 vDir; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vDir = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SKY_FRAG = `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform float sunAmt; uniform float night; uniform float event; uniform float storm; uniform float time; varying vec3 vDir;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
void main(){
  vec3 d = normalize(vDir); float h = clamp(d.y, -0.2, 1.0);
  // Three-stop gradient: warm rose horizon, lilac middle, deep blue-violet zenith.
  vec3 mid = mix(horizon, top, 0.45) + vec3(0.04, 0.0, 0.06);
  vec3 c = h < 0.18 ? mix(horizon, mid, smoothstep(0.0, 0.18, max(h,0.0))) : mix(mid, top, pow(smoothstep(0.18, 1.0, h), 0.7));
  // Bright glow band just above the horizon.
  c += vec3(1.0, 0.86, 0.84) * 0.16 * exp(-abs(h) * 10.0) * (1.0 - night);
  float s = max(dot(d, normalize(sunDir)), 0.0);
  // Mars sun: a clear white disc with a wide cool-blue halo (the real Martian sun glow is bluish).
  c += vec3(1.0, 0.98, 0.96) * smoothstep(0.9986, 0.9991, s) * 2.2 * sunAmt;
  c += vec3(0.78, 0.86, 1.0) * (pow(s, 40.0) * 0.55 + pow(s, 8.0) * 0.18 + pow(s, 2.0) * 0.05) * sunAmt;
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
    scene.fog = new THREE.Fog(horizon, look.storm ? 10 : 70, look.storm ? 60 : 420);
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
      fog.near += ((look.storm ? 6 : 70) - fog.near) * k;
      fog.far += ((look.storm ? 48 : 420) - fog.far) * k;
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
    gl.toneMappingExposure = 1.0;
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
    l.shadow.radius = 1.5;
    return () => void scene.remove(l.target);
  }, [scene, gl]);
  const skyTint = useMemo(() => new THREE.Color(), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = 1 - Math.exp(-dt * 1.6);
    // Strong warm sun against a cool, dimmer sky light: clear light / shadow contrast.
    const sunT = look.night ? 0.0 : look.storm ? 0.4 : 3.4;
    const hemiT = look.night ? 0.35 : look.storm ? 1.1 : 0.8;
    const fillT = look.night ? 0.25 : 0.6;
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
      <hemisphereLight ref={hemi} args={[colorHex.skyTop, 0x8a5e5a, 0.8]} />
      <directionalLight
        ref={sun}
        position={[10 + SUN_DIR[0] * 70, SUN_DIR[1] * 70, -2 + SUN_DIR[2] * 70]}
        color={look.solarEvent ? 0xf0e0f6 : 0xffe8de}
        intensity={3.4}
        castShadow={quality === 'high'}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      {/* Cool fill from the opposite side so shadowed faces are not black. */}
      <directionalLight ref={fill} position={[-40, 30, -50]} color={0x8299e6} intensity={0.5} />
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
    const basalt = new THREE.Color(0x5e4446);
    const pale = new THREE.Color(0xd8c4be);
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
      // Large dark basalt patches and pale dust drifts: colour variety at walking distance.
      const n3 = Math.sin(x * 0.11 + 2.1) * Math.sin(z * 0.13 - 0.7) + Math.sin((x + z) * 0.31) * 0.35;
      if (n3 > 0.45) tmp.lerp(basalt, Math.min(0.55, (n3 - 0.45) * 1.3));
      if (n3 < -0.55) tmp.lerp(pale, Math.min(0.5, (-n3 - 0.55) * 1.4));
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

/** One ring of hills around the base: a jagged silhouette, base colour to tip colour. */
function hillRing(R: number, hBase: number, hVar: number, phase: number, baseHex: number, tipHex: number) {
  const N = 180;
  const pos: number[] = [];
  const col: number[] = [];
  const base = new THREE.Color(baseHex);
  const tip = new THREE.Color(tipHex);
  const hAt = (i: number) => {
    const a = (i / N) * Math.PI * 2 + phase;
    return hBase + (Math.sin(a * 3 + 1) * 0.5 + Math.sin(a * 7 + 2) * 0.3 + Math.abs(Math.sin(a * 17)) * 0.35 + Math.sin(a * 31) * 0.12) * hVar;
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
}

/** Three layers of hills: blue-violet far range, dusty rose middle ridges, dark near dunes.
 *  Each layer is lighter and bluer with distance (aerial perspective), so the horizon has depth. */
export function Hills() {
  const [far, mid, near] = useMemo(
    () => [
      hillRing(400, 46, 44, 0.3, 0x8e8bb4, 0xb7b2d2),
      hillRing(240, 16, 20, 1.7, 0xa47c80, 0xc9a6a6),
      hillRing(125, 2, 7, 3.1, 0x6f4f50, 0x9a7472),
    ],
    [],
  );
  return (
    <group>
      <mesh geometry={far}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} fog={false} />
      </mesh>
      <mesh geometry={mid}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} fog={false} />
      </mesh>
      <mesh geometry={near}>
        <meshLambertMaterial vertexColors side={THREE.DoubleSide} fog />
      </mesh>
    </group>
  );
}

/** Kenney buildings and vehicles where the player actually walks: a gantry over the EVA path,
 *  a rover parked between the paths, a big hangar and a round hangar beside the base, a large
 *  dish on the ridge to the landing pad. */
export function Outpost() {
  const items: [ModelName, V3, number, number, Partial<Record<string, number>>?][] = [
    ['structure_detailed', [13.4, 0, -3.0], 2.6, 0],
    ['structure_detailed', [13.4, 0, 3.0], 2.6, Math.PI],
    ['rover', [19.6, 0, 1.2], 8, 2.2],
    ['hangar_largeA', [10.5, 0, 11.5], 2.8, 0.45, { metalRed: colorHex.warn }],
    ['hangar_roundA', [7.5, 0, -15.5], 2.6, -0.4],
    ['satelliteDish_large', [25, 0, 3], 4.2, -1.1],
    ['hangar_smallA', [-4.5, 0, -12.5], 2.4, 0.2],
  ];
  return (
    <group>
      {items.map(([name, p, sc, ry, tint], i) => (
        <Model key={i} name={name} position={[p[0], groundHeight(p[0], p[2]) + p[1], p[2]]} scale={sc} rotation={[0, ry, 0]} tint={tint} />
      ))}
    </group>
  );
}

/** Path markers along the EVA tracks: short posts with glowing caps, teal and yellow in turn,
 *  plus a ring of lights round the landing pad. Two instanced meshes, a handful of draw calls. */
export function PathLights() {
  const posts = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: { x: number; z: number; warn: boolean }[] = [];
    for (const tr of TRACKS) {
      let carry = 0;
      for (let i = 0; i + 1 < tr.length; i++) {
        const [ax, az] = tr[i]!;
        const [bx, bz] = tr[i + 1]!;
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        for (let d = carry; d < len; d += 3.2) {
          const t = d / len;
          const x = ax + (bx - ax) * t;
          const z = az + (bz - az) * t;
          const k = out.length;
          out.push({ x: x + nx * 1.5, z: z + nz * 1.5, warn: k % 4 === 0 });
          out.push({ x: x - nx * 1.5, z: z - nz * 1.5, warn: k % 4 === 0 });
          carry = d + 3.2 - len;
        }
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      out.push({ x: LANDING_AT[0] + Math.cos(a) * 7.2, z: LANDING_AT[1] + Math.sin(a) * 7.2, warn: i % 2 === 0 });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    spots.forEach((s, i) => {
      const y = groundHeight(s.x, s.z);
      m.makeTranslation(s.x, y + 0.25, s.z);
      posts.current?.setMatrixAt(i, m);
      m.makeTranslation(s.x, y + 0.56, s.z);
      caps.current?.setMatrixAt(i, m);
      caps.current?.setColorAt(i, c.setHex(s.warn ? colorHex.warn : colorHex.accent));
    });
    if (posts.current) posts.current.instanceMatrix.needsUpdate = true;
    if (caps.current) {
      caps.current.instanceMatrix.needsUpdate = true;
      if (caps.current.instanceColor) caps.current.instanceColor.needsUpdate = true;
    }
  }, [spots]);
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.5, 6]} />
        <meshStandardMaterial color={0x3a4157} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, spots.length]}>
        <sphereGeometry args={[0.09, 10, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
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
