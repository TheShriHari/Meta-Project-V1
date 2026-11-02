/**
 * web/src/render/atomMesh.ts - High-fidelity atom rendering and static ghost lattice manager.
 *
 * Implements:
 * 1) atomsMesh: Displaced physical atoms with high-tessellation sphere geometry, PBR standard material,
 *    and dynamic per-atom color blending based on displacement magnitude ||u_i|| = ||r_i - R_i^0||.
 * 2) ghostMesh: Static unperturbed reference lattice of faint white spheres positioned at demo.ideal,
 *    initialized once with zero per-frame CPU/GPU overhead.
 */
import * as THREE from "three";

const NM = 1e9;

// Base palette
export const COLOR_GRAIN1 = new THREE.Color(0xd4a843);     // Warm gold #D4A843
export const COLOR_GRAIN2 = new THREE.Color(0xb8912e);     // Bronze-gold #B8912E

// Displacement strain palette (cyan to pale cyan-white)
export const COLOR_CYAN = new THREE.Color(0x38bdf8);       // Cyan #38bdf8
export const COLOR_CYAN_WHITE = new THREE.Color(0xe0f2fe); // Cyan-white #e0f2fe

export class AtomMeshManager {
  private readonly _atomsMesh: THREE.InstancedMesh;
  private readonly _ghostMesh: THREE.InstancedMesh;
  private readonly ideal: Float64Array;
  private readonly a_m: number;
  private readonly b_m: number;
  private readonly count: number;
  private readonly splitX?: number;

  // Pre-allocated scratch objects to eliminate per-frame GC pressure
  private readonly dummy = new THREE.Object3D();
  private readonly dispColor = new THREE.Color();
  private readonly finalColor = new THREE.Color();

  constructor(ideal: Float64Array, a_m: number, b_m: number, grain2SplitX?: number) {
    this.ideal = ideal;
    this.a_m = a_m;
    this.b_m = b_m;
    this.count = Math.floor(ideal.length / 3);

    // Support split boundary in either SI metres or scene nanometres
    this.splitX =
      grain2SplitX !== undefined
        ? Math.abs(grain2SplitX) > 1e-4 && a_m < 1e-4
          ? grain2SplitX * 1e-9
          : grain2SplitX
        : undefined;

    const radius = a_m * NM * 0.09;

    // 1) atomsMesh: displaced physical atoms
    const atomGeometry = new THREE.SphereGeometry(radius, 32, 24);
    const atomMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.32,
      metalness: 0.25,
    });
    this._atomsMesh = new THREE.InstancedMesh(atomGeometry, atomMaterial, this.count);

    // 2) ghostMesh: faint static reference lattice of original unperturbed positions
    const ghostGeometry = new THREE.SphereGeometry(radius * 0.85, 16, 12);
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    this._ghostMesh = new THREE.InstancedMesh(ghostGeometry, ghostMaterial, this.count);

    // Static initialization: set ghostMesh instance matrices once from ideal positions
    for (let i = 0; i < this.count; i++) {
      const idx = 3 * i;
      this.dummy.position.set(
        this.ideal[idx] * NM,
        this.ideal[idx + 1] * NM,
        this.ideal[idx + 2] * NM
      );
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this._ghostMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this._ghostMesh.instanceMatrix.needsUpdate = true;

    // Initialize atomsMesh with ideal positions (unperturbed base gold colors)
    this.update(ideal);
  }

  get atomsMesh(): THREE.InstancedMesh {
    return this._atomsMesh;
  }

  get ghostMesh(): THREE.InstancedMesh {
    return this._ghostMesh;
  }

  /**
   * Updates atomsMesh instance matrices and instance colors from current displaced positions.
   * @param displaced Flat Float64Array [x0, y0, z0, x1, ...] of atomic coordinates in metres.
   */
  update(displaced: Float64Array): void {
    const nAtoms = Math.min(this.count, Math.floor(displaced.length / 3));
    const bm = this.b_m > 0 ? this.b_m : 1e-10;

    for (let i = 0; i < nAtoms; i++) {
      const idx = 3 * i;
      const rx = displaced[idx];
      const ry = displaced[idx + 1];
      const rz = displaced[idx + 2];

      const ix = this.ideal[idx];
      const iy = this.ideal[idx + 1];
      const iz = this.ideal[idx + 2];

      // Explicit dummy reset: rotation (0,0,0) and scale (1,1,1) ensure perfect spheres (never capsule/stretched)
      this.dummy.position.set(rx * NM, ry * NM, rz * NM);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this._atomsMesh.setMatrixAt(i, this.dummy.matrix);

      // Displacement magnitude ||u_i|| = ||r_i - R_i^0||
      const dx = rx - ix;
      const dy = ry - iy;
      const dz = rz - iz;
      const magnitude = Math.hypot(dx, dy, dz);

      // Normalized strain metric t in [0, 1] relative to Burgers magnitude
      const t = Math.min(Math.max(magnitude / bm, 0.0), 1.0);

      // Base color: Warm gold #D4A843 for Grain 1; Bronze-gold #B8912E for Grain 2 (if atom is past boundary or in Grain 2)
      const isGrain2 =
        this.splitX !== undefined && (ix >= this.splitX || rx >= this.splitX);
      const baseColor = isGrain2 ? COLOR_GRAIN2 : COLOR_GRAIN1;

      // Displacement color: Cyan-white gradient (#38bdf8 to #e0f2fe)
      this.dispColor.lerpColors(COLOR_CYAN, COLOR_CYAN_WHITE, t);

      // Blend smoothly from base gold to cyan-white
      this.finalColor.lerpColors(baseColor, this.dispColor, t);
      this._atomsMesh.setColorAt(i, this.finalColor);
    }

    this._atomsMesh.instanceMatrix.needsUpdate = true;
    if (this._atomsMesh.instanceColor) {
      this._atomsMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Disposes geometries and materials for both managed instanced meshes.
   */
  dispose(): void {
    this._atomsMesh.geometry.dispose();
    if (Array.isArray(this._atomsMesh.material)) {
      this._atomsMesh.material.forEach((m) => m.dispose());
    } else {
      this._atomsMesh.material.dispose();
    }

    this._ghostMesh.geometry.dispose();
    if (Array.isArray(this._ghostMesh.material)) {
      this._ghostMesh.material.forEach((m) => m.dispose());
    } else {
      this._ghostMesh.material.dispose();
    }
  }
}
