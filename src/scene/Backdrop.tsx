// Title-screen background: the base seen from outside, the camera drifting slowly round it.
// Lazy-loaded; the title screen shows a plain dark backdrop until (or instead of) this.
import { Canvas, useFrame } from '@react-three/fiber';
import { Component, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { RT } from './core';
import { Dust, Ground, Hills, Lights, Outpost, PathLights, Rocks, Sky, type Quality } from './env';
import { Hab, Roof, Yard } from './hab';
import type { SceneLook } from './look';

const LOOK: SceneLook = { lights: 'on', storm: false, solarEvent: false, shelterBig: false, panelsDusty: false, night: false };

function stubRT(): RT {
  return {
    pos: new THREE.Vector3(0, -100, 0),
    yaw: 0,
    pitch: 0,
    tPos: new THREE.Vector3(),
    tYaw: 0,
    tPitch: 0,
    walk: null,
    at: 'hub',
    run: null,
    brush: new THREE.Vector3(),
    brushOn: false,
    fieldDust: 0,
    puff: () => {},
    cleared: 0,
    refill: () => {},
    erase: () => {},
    skipWalk: () => false,
  };
}

function detectQuality(): Quality {
  try {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    return touch && Math.min(window.innerWidth, window.innerHeight) < 820 ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

function reduceMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Very slow orbit round the base (about 0.6 degrees a second), low over the ground. The view is
 *  turned a little to the left of the base so the base sits right of centre (the title is on the left). */
const CENTER = new THREE.Vector3(9, 2.4, 2);
function Drift() {
  const still = useMemo(reduceMotion, []);
  useFrame(({ camera, clock }) => {
    const a = 2.15 + (still ? 0 : clock.elapsedTime * 0.011);
    camera.position.set(CENTER.x + Math.cos(a) * 31, 5.2, CENTER.z + Math.sin(a) * 31);
    camera.lookAt(CENTER.x, CENTER.y + 3.2, CENTER.z);
    if (window.innerWidth > 640) camera.rotateY(0.3);
  });
  return null;
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** `soft`: blurred background behind the text screens; lower resolution, no shadows (the CSS blurs it anyway). */
export default function Backdrop({ soft = false }: { soft?: boolean }) {
  const rt = useRef<RT>(stubRT());
  const quality = useMemo<Quality>(() => (soft ? 'low' : detectQuality()), [soft]);
  return (
    <Boundary>
      <Canvas
        className="title-canvas"
        shadows={quality === 'high' ? { type: THREE.PCFShadowMap } : false}
        dpr={soft ? 0.5 : quality === 'high' ? [1, 1.5] : [1, 1.25]}
        gl={{ antialias: true, powerPreference: 'default', alpha: false }}
        camera={{ fov: 50, near: 0.1, far: 800, position: [30, 5, 20] }}
      >
        <Sky look={LOOK} />
        <Lights look={LOOK} quality={quality} />
        <Dust look={LOOK} quality={quality} />
        <Ground />
        <Hills />
        <Rocks quality={quality} />
        <Hab rt={rt} look={LOOK} />
        <Roof />
        <Yard />
        <Outpost />
        <PathLights />
        <Drift />
      </Canvas>
    </Boundary>
  );
}
