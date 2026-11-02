/**
 * web/src/render/extraHalfPlane.ts
 *
 * Visualizes the extra half-plane of atoms that defines an edge dislocation.
 * The half-plane lies perpendicular to the slip vector s, spanned by n and xi = s x n,
 * and terminates inside the crystal along the pink dislocation line xi at the core.
 *
 * Pure visual presentation: separate from physical simulation data.
 * Scene units = 1 nm (10^-9 m), Z-up.
 */
import * as THREE from "three";
import type { DislocationGeometry } from "../core/dislocation.ts";
import { createPillElement } from "./annotations.ts";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

const NM = 1e9;

export class ExtraHalfPlaneManager {
  private group = new THREE.Group();
  private atomsMesh?: THREE.InstancedMesh;
  private bondLines?: THREE.LineSegments;
  private planeSheet?: THREE.Mesh;
  private geom: DislocationGeometry;
  private a_nm: number;
  private b_nm: number;
  private box_nm: [number, number, number];
  private count = 0;
  private localPositions: number[] = [];
  public readonly halfPlaneLabel: CSS2DObject;
  public readonly perpLabel: CSS2DObject;

  constructor(geom: DislocationGeometry, a_m: number, b_m: number, box_m: [number, number, number]) {
    this.geom = geom;
    this.a_nm = a_m * NM;
    this.b_nm = b_m * NM;
    this.box_nm = [box_m[0] * NM, box_m[1] * NM, box_m[2] * NM];
    this.group.name = "extraHalfPlaneGroup";

    // Build the visual atoms and sheet of the extra half-plane
    this.build();

    // Labels
    this.halfPlaneLabel = new CSS2DObject(createPillElement("Extra half-plane of atoms"));
    this.perpLabel = new CSS2DObject(createPillElement("b ⟂ dislocation line"));
    this.group.add(this.halfPlaneLabel);
    this.group.add(this.perpLabel);
  }

  get mesh(): THREE.Group {
    return this.group;
  }

  private build() {
    const { s, n } = this.geom;
    const sVec = new THREE.Vector3(...s);
    const nVec = new THREE.Vector3(...n);
    const xiVec = new THREE.Vector3().crossVectors(sVec, nVec).normalize();

    // The half-plane extends from y = 0 (dislocation line) upward into the crystal (y > 0)
    // and spans across the crystal along xi (from -L_xi/2 to +L_xi/2).
    const d111 = this.a_nm / Math.sqrt(3); // spacing along normal
    const dXi = this.a_nm / Math.SQRT2;    // spacing along line direction

    const maxExtentN = Math.max(...this.box_nm) * 0.45;
    const maxExtentXi = Math.max(...this.box_nm) * 0.55;

    const nStepsY = Math.max(Math.floor(maxExtentN / d111), 3);
    const nStepsZ = Math.max(Math.floor(maxExtentXi / dXi), 3);

    const positions: THREE.Vector3[] = [];
    // Start at y = d111 * 0.5 (just above the slip plane/cut) up to nStepsY * d111
    for (let iy = 0; iy < nStepsY; iy++) {
      const y = (iy + 0.6) * d111;
      for (let iz = -nStepsZ; iz <= nStepsZ; iz++) {
        const z = iz * dXi;
        // Position relative to dislocation core point: y * n + z * xi
        const pos = new THREE.Vector3()
          .addScaledVector(nVec, y)
          .addScaledVector(xiVec, z);
        positions.push(pos);
      }
    }

    this.count = positions.length;
    this.localPositions = [];
    for (const p of positions) {
      this.localPositions.push(p.x, p.y, p.z);
    }

    // 1. High-tessellation spherical atoms (golden amber consistent with material)
    const atomRadius = this.a_nm * 0.088;
    const atomGeom = new THREE.SphereGeometry(atomRadius, 24, 18);
    const atomMat = new THREE.MeshStandardMaterial({
      color: 0xd4a843,
      roughness: 0.3,
      metalness: 0.3,
    });
    this.atomsMesh = new THREE.InstancedMesh(atomGeom, atomMat, this.count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.count; i++) {
      dummy.position.set(this.localPositions[3 * i], this.localPositions[3 * i + 1], this.localPositions[3 * i + 2]);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.atomsMesh.setMatrixAt(i, dummy.matrix);
    }
    this.atomsMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.atomsMesh);

    // 2. Subtle nearest-neighbour connecting lines between half-plane atoms
    const pairs: number[] = [];
    const limSq = (Math.max(d111, dXi) * 1.15) ** 2;
    for (let i = 0; i < this.count; i++) {
      for (let j = i + 1; j < this.count; j++) {
        const dx = this.localPositions[3 * i] - this.localPositions[3 * j];
        const dy = this.localPositions[3 * i + 1] - this.localPositions[3 * j + 1];
        const dz = this.localPositions[3 * i + 2] - this.localPositions[3 * j + 2];
        if (dx * dx + dy * dy + dz * dz < limSq) {
          pairs.push(i, j);
        }
      }
    }
    if (pairs.length > 0) {
      const lineGeom = new THREE.BufferGeometry();
      const posAttr = new Float32Array(pairs.length * 3);
      for (let k = 0; k < pairs.length; k++) {
        const idx = pairs[k];
        posAttr[3 * k] = this.localPositions[3 * idx];
        posAttr[3 * k + 1] = this.localPositions[3 * idx + 1];
        posAttr[3 * k + 2] = this.localPositions[3 * idx + 2];
      }
      lineGeom.setAttribute("position", new THREE.BufferAttribute(posAttr, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xe2b14e,
        transparent: true,
        opacity: 0.55,
      });
      this.bondLines = new THREE.LineSegments(lineGeom, lineMat);
      this.group.add(this.bondLines);
    }

    // 3. Subtle tinted translucent sheet showing the extra half-plane sheet surface
    const sheetW = (2 * nStepsZ + 0.5) * dXi;
    const sheetH = nStepsY * d111;
    const sheetGeom = new THREE.PlaneGeometry(sheetW, sheetH);
    const sheetMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.planeSheet = new THREE.Mesh(sheetGeom, sheetMat);
    // Orient sheet in the xi-n plane (normal is sVec)
    this.planeSheet.matrixAutoUpdate = false;
    this.planeSheet.matrix.makeBasis(xiVec, nVec, sVec);
    // Offset center of plane to mid-height along n
    const centerOffset = nVec.clone().multiplyScalar(sheetH / 2);
    this.planeSheet.matrix.setPosition(centerOffset.x, centerOffset.y, centerOffset.z);
    this.group.add(this.planeSheet);
  }

  /**
   * Updates position of the extra half-plane to match the moving dislocation core.
   */
  updateCorePosition(pos_m: number) {
    const { s, p0, n } = this.geom;
    const sVec = new THREE.Vector3(...s);
    const nVec = new THREE.Vector3(...n);
    const xiVec = new THREE.Vector3().crossVectors(sVec, nVec).normalize();

    // Core position in nanometres
    const coreNm = new THREE.Vector3(
      (p0[0] + pos_m * s[0]) * NM,
      (p0[1] + pos_m * s[1]) * NM,
      (p0[2] + pos_m * s[2]) * NM
    );

    this.group.position.copy(coreNm);

    // Anchor labels
    const maxExtentN = Math.max(...this.box_nm) * 0.45;
    this.halfPlaneLabel.position.copy(nVec.clone().multiplyScalar(maxExtentN * 0.85));
    this.perpLabel.position.copy(sVec.clone().multiplyScalar(this.b_nm * 1.8));
  }

  dispose() {
    this.atomsMesh?.geometry.dispose();
    if (this.atomsMesh?.material instanceof THREE.Material) {
      this.atomsMesh.material.dispose();
    }
    this.bondLines?.geometry.dispose();
    if (this.bondLines?.material instanceof THREE.Material) {
      this.bondLines.material.dispose();
    }
    this.planeSheet?.geometry.dispose();
    if (this.planeSheet?.material instanceof THREE.Material) {
      this.planeSheet.material.dispose();
    }
    this.halfPlaneLabel.element.remove();
    this.perpLabel.element.remove();
    this.group.clear();
  }
}
