/**
 * web/src/render/camera.ts - Camera view presets and pose management.
 * Presentation only: touches camera/controls, never modifies physics state.
 * Scene unit = 1 nm (10^-9 m), Z-up.
 */
import { Vector3, type PerspectiveCamera } from "three";

export const VIEW_PRESETS = {
  front: new Vector3(0, -1, 0),
  top: new Vector3(0, -0.001, 1).normalize(),
  side: new Vector3(1, 0, 0),
  isometric: new Vector3(1, -1, 0.8).normalize(),
} as const;

export type ViewName = keyof typeof VIEW_PRESETS;

export interface OrbitLike {
  target: Vector3;
  update(): void;
}

export interface CameraPose {
  position: Vector3;
  target: Vector3;
  up: Vector3;
}

export function saveCameraPose(camera: PerspectiveCamera, controls: OrbitLike): CameraPose {
  return {
    position: camera.position.clone(),
    target: controls.target.clone(),
    up: camera.up.clone(),
  };
}

export function restoreCameraPose(camera: PerspectiveCamera, controls: OrbitLike, pose: CameraPose): void {
  controls.target.copy(pose.target);
  camera.up.copy(pose.up);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  controls.update();
}

export function applyViewPreset(
  camera: PerspectiveCamera,
  controls: OrbitLike,
  view: ViewName,
  center: Vector3,
  distance: number
): void {
  camera.up.set(0, 0, 1);
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(VIEW_PRESETS[view], distance);
  camera.lookAt(center);
  controls.update();
}

/**
 * Applies a textbook-style edge dislocation camera perspective:
 * - Centres on the dislocation core.
 * - Projects Burgers vector s horizontally across the screen.
 * - Projects dislocation line xi = s x n vertically on the screen.
 * - Uses an oblique viewing angle to reveal the 3D thickness of the extra half-plane.
 */
export function applyDislocationView(
  camera: PerspectiveCamera,
  controls: OrbitLike,
  s: [number, number, number],
  n: [number, number, number],
  corePosNm: Vector3,
  distance: number
): void {
  const sVec = new Vector3(...s).normalize();
  const nVec = new Vector3(...n).normalize();
  const xiVec = new Vector3().crossVectors(sVec, nVec).normalize();

  // Target is the dislocation core
  controls.target.copy(corePosNm);

  // Set camera up to the dislocation line xi, ensuring xi is vertical on screen
  camera.up.copy(xiVec);

  // Oblique view vector: look down the normal with an offset along -s and slight xi tilt
  const viewDir = new Vector3()
    .addScaledVector(sVec, -0.28)
    .addScaledVector(nVec, -0.88)
    .addScaledVector(xiVec, 0.38)
    .normalize();

  camera.position.copy(corePosNm).addScaledVector(viewDir, distance);
  camera.lookAt(corePosNm);
  controls.update();
}
