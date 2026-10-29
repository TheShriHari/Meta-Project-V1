/**
 * web/src/render/camera.ts - Camera view presets. Presentation only: touches the camera/controls,
 * never any physics state. Z-up scene (crystal [001] = scene +Z). Directions point from the target to
 * the camera. 'top' is tilted by ~0.06 deg to avoid the pole singularity of orbit controls.
 */
import { Vector3, type PerspectiveCamera } from "three";

export const VIEW_PRESETS = {
  front: new Vector3(0, -1, 0),
  top: new Vector3(0, -0.001, 1).normalize(),
  side: new Vector3(1, 0, 0),
  isometric: new Vector3(1, -1, 0.8).normalize(),
} as const;

export type ViewName = keyof typeof VIEW_PRESETS;

export interface OrbitLike { target: Vector3; update(): void }

export function applyViewPreset(
  camera: PerspectiveCamera, controls: OrbitLike, view: ViewName, center: Vector3, distance: number
): void {
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(VIEW_PRESETS[view], distance);
  camera.lookAt(center);
  controls.update();
}
