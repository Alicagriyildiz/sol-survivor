// "3D / simple" view choice, WebGL detection and the error boundary that falls back
// to the simple card view whenever the 3D scene cannot run.
import { Component, type ReactNode } from 'react';

export type View = '3d' | '2d';

const KEY = 'sol-survivor.view';

let webgl: boolean | null = null;
/** Set once the 3D scene failed (load error, crash, lost context): stay on cards for this page. */
let broken = false;
export const sceneBroken = () => broken;
export const markSceneBroken = () => {
  broken = true;
};
/** True if this browser can create a WebGL context (checked once). */
export function webglAvailable(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    webgl = !!gl;
    // Free the probe context right away.
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Initial view: `?view=2d|3d` in the URL, then the saved choice, then 3D if WebGL works. */
export function initialView(): View {
  try {
    const q = new URLSearchParams(window.location.search).get('view');
    if (q === '2d' || q === '3d') return q;
    const saved = window.localStorage.getItem(KEY);
    if (saved === '2d' || saved === '3d') return saved;
  } catch {
    // Storage can be blocked; the default still works.
  }
  return webglAvailable() ? '3d' : '2d';
}

export function saveView(v: View) {
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    // Not saved; the choice still holds for this session.
  }
}

/** Shows `fallback` (the card view) if anything inside throws. */
export class SceneBoundary extends Component<{ fallback: ReactNode; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('3D scene failed, using the simple view:', error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

