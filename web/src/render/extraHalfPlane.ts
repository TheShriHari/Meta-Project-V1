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
  private planeSheet?: THREE.Mesh;
  private planeBorder?: THREE.Line;
  private geom: DislocationGeometry;
  private a_nm: number;
  private b_nm: number;
  private box_nm: [number, number, number];
  public readonly halfPlaneLabel: CSS2DObject;

  constructor(geom: DislocationGeometry, a_m: number, b_m: number, box_m: [number, number, number]) {
    this.geom = geom;
    this.a_nm = a_m * NM;
    this.b_nm = b_m * NM;
    this.box_nm = [box_m[0] * NM, box_m[1] * NM, box_m[2] * NM];
    this.group.name = "extraHalfPlaneGroup";

    // Build the visual sheet of the extra half-plane
    this.build();

    // Prominent world-space annotation anchored to upper edge of extra half-plane
    this.halfPlaneLabel = new CSS2DObject(createPillElement("Extra half-plane of atoms"));
    this.group.add(this.halfPlaneLabel);
  }

  get mesh(): THREE.Group {
    return this.group;
  }

  private build() {
    const { s, n } = this.geom;
    const sVec = new THREE.Vector3(...s);
    const nVec = new THREE.Vector3(...n);
    const xiVec = new THREE.Vector3().crossVectors(sVec, nVec).normalize();

    // Extents matching crystal box boundaries
    const maxExtentN = Math.max(...this.box_nm) * 0.48;
    const maxExtentXi = Math.max(...this.box_nm) * 0.58;

    const sheetW = maxExtentXi * 2;
    const sheetH = maxExtentN;

    // 1. Tinted translucent amber sheet showing the extra half-plane surface terminating on the core line
    const sheetGeom = new THREE.PlaneGeometry(sheetW, sheetH);
    const sheetMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.planeSheet = new THREE.Mesh(sheetGeom, sheetMat);
    this.planeSheet.matrixAutoUpdate = false;
    this.planeSheet.matrix.makeBasis(xiVec, nVec, sVec);
    const centerOffset = nVec.clone().multiplyScalar(sheetH / 2);
    this.planeSheet.matrix.setPosition(centerOffset.x, centerOffset.y, centerOffset.z);
    this.group.add(this.planeSheet);

    // 2. Delineating border around top and sides of the half-plane (bottom edge terminates at pink core line)
    const borderPoints = [
      xiVec.clone().multiplyScalar(-sheetW / 2),
      xiVec.clone().multiplyScalar(-sheetW / 2).addScaledVector(nVec, sheetH),
      xiVec.clone().multiplyScalar(sheetW / 2).addScaledVector(nVec, sheetH),
      xiVec.clone().multiplyScalar(sheetW / 2),
    ];
    const borderGeom = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.55,
      linewidth: 1.5,
    });
    this.planeBorder = new THREE.Line(borderGeom, borderMat);
    this.group.add(this.planeBorder);
  }

  /**
   * Updates position of the extra half-plane to match the moving dislocation core.
   */
  updateCorePosition(pos_m: number) {
    const { s, p0, n } = this.geom;
    const nVec = new THREE.Vector3(...n);

    // Core position in nanometres
    const coreNm = new THREE.Vector3(
      (p0[0] + pos_m * s[0]) * NM,
      (p0[1] + pos_m * s[1]) * NM,
      (p0[2] + pos_m * s[2]) * NM
    );

    this.group.position.copy(coreNm);

    // Anchor label to upper edge of extra half-plane
    const maxExtentN = Math.max(...this.box_nm) * 0.48;
    this.halfPlaneLabel.position.copy(nVec.clone().multiplyScalar(maxExtentN * 0.95));
  }

  dispose() {
    this.planeSheet?.geometry.dispose();
    if (this.planeSheet?.material instanceof THREE.Material) {
      this.planeSheet.material.dispose();
    }
    this.planeBorder?.geometry.dispose();
    if (this.planeBorder?.material instanceof THREE.Material) {
      this.planeBorder.material.dispose();
    }
    this.halfPlaneLabel.element.remove();
    this.group.clear();
  }
}
