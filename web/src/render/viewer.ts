/**
 * web/src/render/viewer.ts - Three.js scientific viewer for HPSim.
 * Presentation only: reads physics state (core position) and writes only to Three.js objects.
 * Scene unit = 1 nm (10^-9 m), Z-up (crystal [001] = +Z).
 *
 * Physical invariants:
 * - Ideal coordinates (R_i^0) kept in demo.ideal (metres).
 * - Render coordinates r_i = R_i^0 + u(R_i^0; r_d) recomputed on CPU into renderPositions (metres).
 * - Atom centres move according to analytical Volterra displacement field; individual spheres are never stretched.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  applyViewPreset,
  applyDislocationView,
  saveCameraPose,
  restoreCameraPose,
  type CameraPose,
  type ViewName,
} from "./camera.ts";
import { displacedPositions } from "../core/dislocation.ts";
import type { Demo } from "../model/demo.ts";
import { AtomMeshManager } from "./atomMesh.ts";
import { createGrainBoundaryMesh, createSlipPlaneMesh } from "./boundaryMesh.ts";
import { AnnotationManager } from "./annotations.ts";
import { ExtraHalfPlaneManager } from "./extraHalfPlane.ts";

const NM = 1e9;
export type Layer =
  | "atoms"
  | "ghost"
  | "extraHalfPlane"
  | "bonds"
  | "cell"
  | "axes"
  | "slipPlane"
  | "burgers"
  | "core"
  | "boundary"
  | "outgoingCandidates";

export const LAYERS: Layer[] = [
  "atoms",
  "ghost",
  "extraHalfPlane",
  "bonds",
  "cell",
  "axes",
  "slipPlane",
  "burgers",
  "core",
  "boundary",
  "outgoingCandidates",
];

function disposeHierarchy(obj?: THREE.Object3D) {
  if (!obj) return;
  obj.traverse((child) => {
    if ((child as THREE.Mesh).geometry) {
      (child as THREE.Mesh).geometry.dispose();
    }
    const mat = (child as THREE.Mesh).material;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
  private controls: OrbitControls;
  private layers: Record<Layer, THREE.Object3D> = {} as Record<Layer, THREE.Object3D>;

  // Sub-managers
  private atomManager?: AtomMeshManager;
  private annotationManager: AnnotationManager;
  private extraHalfPlaneManager?: ExtraHalfPlaneManager;

  private bonds?: THREE.LineSegments;
  private bondPairs: Uint32Array = new Uint32Array(0);
  private burgers?: THREE.ArrowHelper;
  private coreLine?: THREE.Line;
  private coreMarker?: THREE.Mesh;
  private demo?: Demo;
  private center = new THREE.Vector3();
  private distance = 5;
  private raf = 0;
  private ro: ResizeObserver;
  private content = new THREE.Group();

  // Dislocation view camera state
  private isDislocationView = false;
  private savedPose?: CameraPose;
  private isInitialized = false;

  /** Last rendered displaced positions (metres): render state, separate from demo.ideal. */
  renderPositions: Float64Array = new Float64Array(0);

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0b1020);
    container.appendChild(this.renderer.domElement);

    // CSS2D Annotation Manager
    this.annotationManager = new AnnotationManager(container);

    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // 3-Point Scientific Lighting Setup
    // 1. Soft neutral ambient/hemisphere fill light
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));

    // 2. Warm directional key light
    const keyLight = new THREE.DirectionalLight(0xfff8eb, 1.8);
    keyLight.position.set(4, -5, 7);
    this.scene.add(keyLight);

    // 3. Cool secondary fill light from opposite quadrant
    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.7);
    fillLight.position.set(-4, 4, 3);
    this.scene.add(fillLight);

    // 4. Subtle indigo rim light from rear-below for crisp sphere edge separation
    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.5);
    rimLight.position.set(0, 5, -3);
    this.scene.add(rimLight);

    this.scene.add(this.content);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.annotationManager.render(this.scene, this.camera);
    };
    loop();
  }

  resize() {
    const w = Math.max(this.container.clientWidth, 1),
      h = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.annotationManager.resize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loadStructure(demo: Demo) {
    const isFirstLoad = !this.isInitialized;
    const oldCenter = this.center.clone();

    this.demo = demo;
    disposeHierarchy(this.content);
    this.content.clear();
    this.atomManager?.dispose();
    this.extraHalfPlaneManager?.dispose();

    const { ideal, a_m, b_m, box_m, geom } = demo;
    this.renderPositions = new Float64Array(ideal.length);
    const nAtoms = ideal.length / 3;
    const S = (v: number) => v * NM;

    // 1. AtomMeshManager: Perfect spherical atoms + ghost reference lattice + dynamic gold/cyan palette
    const pGbX = (geom.p0[0] + geom.tMax * geom.s[0]);
    this.atomManager = new AtomMeshManager(ideal, a_m, b_m, pGbX);
    this.layers.atoms = this.atomManager.atomsMesh;
    this.layers.ghost = this.atomManager.ghostMesh;

    // 2. Extra Half-Plane of Atoms
    this.extraHalfPlaneManager = new ExtraHalfPlaneManager(geom, a_m, b_m, box_m);
    this.layers.extraHalfPlane = this.extraHalfPlaneManager.mesh;

    // 3. Nearest-neighbour bonds from IDEAL geometry (a/sqrt2), drawn between displaced positions
    const nn = a_m / Math.SQRT2,
      lim = (nn * 1.05) ** 2;
    const pairs: number[] = [];
    for (let i = 0; i < nAtoms; i++) {
      for (let j = i + 1; j < nAtoms; j++) {
        const dx = ideal[3 * i] - ideal[3 * j],
          dy = ideal[3 * i + 1] - ideal[3 * j + 1],
          dz = ideal[3 * i + 2] - ideal[3 * j + 2];
        if (dx * dx + dy * dy + dz * dz < lim) pairs.push(i, j);
      }
    }
    this.bondPairs = Uint32Array.from(pairs);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pairs.length * 3), 3));
    this.bonds = new THREE.LineSegments(
      bg,
      new THREE.LineBasicMaterial({ color: 0x8aa0c8, transparent: true, opacity: 0.38 })
    );
    this.bonds.frustumCulled = false;
    this.layers.bonds = this.bonds;

    // 4. Conventional Unit Cell & Axes
    const cell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(S(a_m), S(a_m), S(a_m))),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    cell.position.set(S(a_m) / 2, S(a_m) / 2, S(a_m) / 2);
    this.layers.cell = cell;
    this.layers.axes = new THREE.AxesHelper(S(a_m) * 2);

    // 5. Slip Plane (Translucent Amber Plane with amber border)
    const s = new THREE.Vector3(...geom.s).normalize();
    const n = new THREE.Vector3(...geom.n).normalize();
    const xi = new THREE.Vector3().crossVectors(s, n).normalize();
    const diag = S(Math.hypot(...box_m)) * 1.15;
    const p0Vec = new THREE.Vector3(S(geom.p0[0]), S(geom.p0[1]), S(geom.p0[2]));

    this.layers.slipPlane = createSlipPlaneMesh(p0Vec, s, xi, n, diag);
    this.annotationManager.attachTo(
      this.layers.slipPlane,
      "slip",
      new THREE.Vector3(diag * 0.25, diag * 0.42, 0)
    );
    this.layers.slipPlane.updateMatrixWorld(true);

    // 6. Burgers Vector Arrow & Dislocation Core
    this.burgers = new THREE.ArrowHelper(
      s,
      new THREE.Vector3(),
      S(demo.b_m) * 1.8,
      0xf59e0b,
      S(demo.b_m) * 0.65,
      S(demo.b_m) * 0.42
    );
    this.layers.burgers = this.burgers;
    this.annotationManager.attachTo(
      this.burgers,
      "burgers",
      s.clone().multiplyScalar(S(demo.b_m) * 2.2)
    );

    const half = S(Math.max(...box_m)) * 0.6;
    const lg = new THREE.BufferGeometry().setFromPoints([
      xi.clone().multiplyScalar(-half),
      xi.clone().multiplyScalar(half),
    ]);
    this.coreLine = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 2 }));
    this.coreMarker = new THREE.Mesh(
      new THREE.SphereGeometry(S(demo.b_m) * 0.38, 24, 20),
      new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xec4899,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      })
    );
    const haloGeom = new THREE.SphereGeometry(S(demo.b_m) * 0.58, 24, 20);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.coreMarker.add(new THREE.Mesh(haloGeom, haloMat));

    const core = new THREE.Group();
    core.name = "coreGroup";
    core.add(this.coreLine, this.coreMarker);
    this.layers.core = core;
    this.annotationManager.attachTo(
      core,
      "core",
      xi.clone().multiplyScalar(half * 0.85)
    );

    // 7. Grain Boundary & Adjacent Grain (Grain 2)
    const boundaryGroup = new THREE.Group();
    boundaryGroup.name = "boundaryContainerGroup";

    const pGb = new THREE.Vector3(
      (geom.p0[0] + geom.tMax * geom.s[0]) * NM,
      (geom.p0[1] + geom.tMax * geom.s[1]) * NM,
      (geom.p0[2] + geom.tMax * geom.s[2]) * NM
    );

    const sProjXY = new THREE.Vector3(geom.s[0], geom.s[1], 0).normalize();
    const gbNormal = sProjXY.lengthSq() > 1e-4 ? sProjXY : new THREE.Vector3(1, 0, 0);
    const gbZ = new THREE.Vector3(0, 0, 1);
    const gbTangent = new THREE.Vector3().crossVectors(gbZ, gbNormal).normalize();

    const planeW = S(Math.hypot(box_m[0], box_m[1])) * 1.5;
    const planeH = S(box_m[2]) * 1.8;

    // Translucent indigo plane with glowing violet-white border
    const gbPlaneGroup = createGrainBoundaryMesh(
      new THREE.Vector3(pGb.x, pGb.y, S(box_m[2]) / 2),
      gbNormal,
      gbTangent,
      planeW,
      planeH
    );
    boundaryGroup.add(gbPlaneGroup);

    // Attach grain boundary label
    this.annotationManager.attachTo(
      boundaryGroup,
      "gb",
      new THREE.Vector3(pGb.x, pGb.y, S(box_m[2]) * 0.95)
    );

    // Adjacent Grain 2 bounding wireframe box (with bronze-gold tint consistent with palette)
    const g2BoxW = S(box_m[0]);
    const g2Box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(g2BoxW, S(box_m[1]), S(box_m[2]))),
      new THREE.LineBasicMaterial({ color: 0xb8912e, transparent: true, opacity: 0.55 })
    );
    const g2Center = pGb.clone().add(gbNormal.clone().multiplyScalar(g2BoxW / 2));
    g2Center.z = S(box_m[2]) / 2;
    g2Box.position.copy(g2Center);
    boundaryGroup.add(g2Box);

    // Outcome indicator at boundary arrival point
    const outcome = demo.transmission.outcome;
    let markerColor = 0xf59e0b; // unresolved = amber
    if (outcome === "transmitted") markerColor = 0x10b981; // emerald green
    else if (outcome === "pinned") markerColor = 0xef4444; // crimson red

    const outcomeMarker = new THREE.Mesh(
      new THREE.SphereGeometry(S(demo.b_m) * 0.5, 20, 16),
      new THREE.MeshBasicMaterial({ color: markerColor })
    );
    outcomeMarker.position.copy(pGb);
    boundaryGroup.add(outcomeMarker);

    this.layers.boundary = boundaryGroup;

    // 8. Outgoing Candidate Slip Systems
    const candidatesGroup = new THREE.Group();
    candidatesGroup.name = "candidatesGroup";
    for (const cand of demo.transmission.candidates) {
      const isSelected = demo.transmission.selectedCandidate?.systemIndex === cand.systemIndex;
      const sOutSpec = new THREE.Vector3(
        cand.sSpecimen[0],
        cand.sSpecimen[1],
        cand.sSpecimen[2]
      ).normalize();

      let arrowColor = 0x475569; // rejected = slate
      let arrowLen = S(demo.b_m) * 1.4;
      let headLen = S(demo.b_m) * 0.4;
      let headW = S(demo.b_m) * 0.25;

      if (isSelected) {
        arrowColor = 0x10b981; // bright emerald
        arrowLen = S(demo.b_m) * 2.8;
        headLen = S(demo.b_m) * 0.7;
        headW = S(demo.b_m) * 0.45;
      } else if (cand.passedMPrime && cand.passedTauOut) {
        arrowColor = 0x38bdf8; // qualifying = light blue
        arrowLen = S(demo.b_m) * 2.0;
        headLen = S(demo.b_m) * 0.5;
        headW = S(demo.b_m) * 0.35;
      }

      const arrow = new THREE.ArrowHelper(sOutSpec, pGb, arrowLen, arrowColor, headLen, headW);
      candidatesGroup.add(arrow);
    }
    this.layers.outgoingCandidates = candidatesGroup;

    for (const k of LAYERS) {
      if (this.layers[k]) {
        this.content.add(this.layers[k]);
      }
    }

    this.center.set(S(box_m[0]) / 2, S(box_m[1]) / 2, S(box_m[2]) / 2);
    // Camera distance pulled back to 4.0 for 15% breathing room
    this.distance = S(box_m[0]) * 4.0;

    if (isFirstLoad) {
      this.setView("isometric");
      this.isInitialized = true;
    } else if (this.isDislocationView) {
      // Preserve Dislocation View centered on the slip plane
      const g = demo.geom;
      const slipCenterNm = new THREE.Vector3(
        g.p0[0] * NM,
        g.p0[1] * NM,
        g.p0[2] * NM
      );
      applyDislocationView(this.camera, this.controls, g.s, g.n, slipCenterNm, this.distance * 0.9);
    } else {
      // Preserve current camera pose (position, target, up, zoom)
      const centerDelta = this.center.clone().sub(oldCenter);
      if (centerDelta.lengthSq() > 1e-8) {
        this.camera.position.add(centerDelta);
        this.controls.target.add(centerDelta);
        if (this.savedPose) {
          this.savedPose.position.add(centerDelta);
          this.savedPose.target.add(centerDelta);
        }
      }
      this.controls.update();
    }

    this.setCorePosition(demo.controller.state.pos_m);
  }

  /** Recompute DISPLAYED coordinates from the ideal lattice; never modifies physics state or ideal data. */
  setCorePosition(pos_m: number) {
    const d = this.demo;
    if (!d || !this.atomManager || !this.bonds) return;

    if (this.renderPositions.length !== d.ideal.length) {
      this.renderPositions = new Float64Array(d.ideal.length);
    }

    const r = displacedPositions(d.ideal, d.geom, pos_m, d.field, this.renderPositions);
    this.renderPositions = r;

    // Update atom instance matrices & dynamic displacement-gradient colors
    this.atomManager.update(r);

    // Update bonds
    const attr = this.bonds.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let k = 0; k < this.bondPairs.length; k++) {
      const a = this.bondPairs[k];
      attr.setXYZ(k, r[3 * a] * NM, r[3 * a + 1] * NM, r[3 * a + 2] * NM);
    }
    attr.needsUpdate = true;

    // Update dislocation core position
    const g = d.geom;
    const core = new THREE.Vector3(
      g.p0[0] + pos_m * g.s[0],
      g.p0[1] + pos_m * g.s[1],
      g.p0[2] + pos_m * g.s[2]
    ).multiplyScalar(NM);

    this.layers.core.position.copy(core);
    this.burgers?.position.copy(core);

    // Update extra half-plane position and anchored labels
    this.extraHalfPlaneManager?.updateCorePosition(pos_m);
    // Camera remains completely stationary during playback to accurately display defect migration
  }

  setLayer(layer: Layer, visible: boolean) {
    if (this.layers[layer]) {
      this.layers[layer].visible = visible;
    }

    // Sync annotation visibility
    if (layer === "core") this.annotationManager.setVisible("core", visible);
    if (layer === "boundary") this.annotationManager.setVisible("gb", visible);
    if (layer === "slipPlane") this.annotationManager.setVisible("slip", visible);
    if (layer === "burgers") this.annotationManager.setVisible("burgers", visible);
  }

  setView(view: ViewName) {
    if (this.isDislocationView) {
      this.isDislocationView = false;
    }
    applyViewPreset(this.camera, this.controls, view, this.center, this.distance);
  }

  resetCamera() {
    if (this.isDislocationView) {
      this.isDislocationView = false;
    }
    this.setView("isometric");
  }

  saveCameraState(): CameraPose {
    return saveCameraPose(this.camera, this.controls);
  }

  restoreCameraState(pose: CameraPose): void {
    restoreCameraPose(this.camera, this.controls, pose);
  }

  /**
   * Toggles the dedicated textbook-style Dislocation View:
   * - Projects Burgers vector s horizontally
   * - Projects dislocation line xi vertically
   * - Provides 3D thickness perspective of the extra half-plane
   * - Restores previous camera pose on deactivation
   */
  toggleDislocationView(): boolean {
    const d = this.demo;
    if (!d) return false;

    if (!this.isDislocationView) {
      // Save current camera pose before switching
      this.savedPose = saveCameraPose(this.camera, this.controls);

      const g = d.geom;
      const slipCenterNm = new THREE.Vector3(
        g.p0[0] * NM,
        g.p0[1] * NM,
        g.p0[2] * NM
      );

      applyDislocationView(this.camera, this.controls, g.s, g.n, slipCenterNm, this.distance * 0.9);
      this.isDislocationView = true;
      return true;
    } else {
      // Restore previously saved camera pose
      if (this.savedPose) {
        restoreCameraPose(this.camera, this.controls, this.savedPose);
      } else {
        this.setView("isometric");
      }
      this.isDislocationView = false;
      return false;
    }
  }

  isDislocationViewActive(): boolean {
    return this.isDislocationView;
  }

  updateTransmission(transmission: import("../core/boundary.ts").TransmissionResult) {
    const d = this.demo;
    if (!d) return;
    d.transmission = transmission;
    const S = (v: number) => v * NM;
    const geom = d.geom;
    const box_m = d.box_m;

    const visibleBoundary = this.layers.boundary ? this.layers.boundary.visible : true;
    const visibleCandidates = this.layers.outgoingCandidates
      ? this.layers.outgoingCandidates.visible
      : true;

    if (this.layers.boundary) {
      disposeHierarchy(this.layers.boundary);
      this.content.remove(this.layers.boundary);
    }
    if (this.layers.outgoingCandidates) {
      disposeHierarchy(this.layers.outgoingCandidates);
      this.content.remove(this.layers.outgoingCandidates);
    }

    // Build new boundary group with translucent indigo plane and glowing border
    const boundaryGroup = new THREE.Group();
    const pGb = new THREE.Vector3(
      (geom.p0[0] + geom.tMax * geom.s[0]) * NM,
      (geom.p0[1] + geom.tMax * geom.s[1]) * NM,
      (geom.p0[2] + geom.tMax * geom.s[2]) * NM
    );

    const sProjXY = new THREE.Vector3(geom.s[0], geom.s[1], 0).normalize();
    const gbNormal = sProjXY.lengthSq() > 1e-4 ? sProjXY : new THREE.Vector3(1, 0, 0);
    const gbZ = new THREE.Vector3(0, 0, 1);
    const gbTangent = new THREE.Vector3().crossVectors(gbZ, gbNormal).normalize();

    const planeW = S(Math.hypot(box_m[0], box_m[1])) * 1.5;
    const planeH = S(box_m[2]) * 1.8;

    const gbPlaneGroup = createGrainBoundaryMesh(
      new THREE.Vector3(pGb.x, pGb.y, S(box_m[2]) / 2),
      gbNormal,
      gbTangent,
      planeW,
      planeH
    );
    boundaryGroup.add(gbPlaneGroup);

    this.annotationManager.attachTo(
      boundaryGroup,
      "gb",
      new THREE.Vector3(pGb.x, pGb.y, S(box_m[2]) * 0.95)
    );

    const g2BoxW = S(box_m[0]);
    const g2Box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(g2BoxW, S(box_m[1]), S(box_m[2]))),
      new THREE.LineBasicMaterial({ color: 0xb8912e, transparent: true, opacity: 0.55 })
    );
    const g2Center = pGb.clone().add(gbNormal.clone().multiplyScalar(g2BoxW / 2));
    g2Center.z = S(box_m[2]) / 2;
    g2Box.position.copy(g2Center);
    boundaryGroup.add(g2Box);

    const outcome = transmission.outcome;
    let markerColor = 0xf59e0b;
    if (outcome === "transmitted") markerColor = 0x10b981;
    else if (outcome === "pinned") markerColor = 0xef4444;

    const outcomeMarker = new THREE.Mesh(
      new THREE.SphereGeometry(S(d.b_m) * 0.5, 20, 16),
      new THREE.MeshBasicMaterial({ color: markerColor })
    );
    outcomeMarker.position.copy(pGb);
    boundaryGroup.add(outcomeMarker);

    boundaryGroup.visible = visibleBoundary;
    this.layers.boundary = boundaryGroup;
    this.content.add(boundaryGroup);

    // Candidates group
    const candidatesGroup = new THREE.Group();
    for (const cand of transmission.candidates) {
      const isSelected = transmission.selectedCandidate?.systemIndex === cand.systemIndex;
      const sOutSpec = new THREE.Vector3(
        cand.sSpecimen[0],
        cand.sSpecimen[1],
        cand.sSpecimen[2]
      ).normalize();

      let arrowColor = 0x475569;
      let arrowLen = S(d.b_m) * 1.4;
      let headLen = S(d.b_m) * 0.4;
      let headW = S(d.b_m) * 0.25;

      if (isSelected) {
        arrowColor = 0x10b981;
        arrowLen = S(d.b_m) * 2.8;
        headLen = S(d.b_m) * 0.7;
        headW = S(d.b_m) * 0.45;
      } else if (cand.passedMPrime && cand.passedTauOut) {
        arrowColor = 0x38bdf8;
        arrowLen = S(d.b_m) * 2.0;
        headLen = S(d.b_m) * 0.5;
        headW = S(d.b_m) * 0.35;
      }

      const arrow = new THREE.ArrowHelper(sOutSpec, pGb, arrowLen, arrowColor, headLen, headW);
      candidatesGroup.add(arrow);
    }
    candidatesGroup.visible = visibleCandidates;
    this.layers.outgoingCandidates = candidatesGroup;
    this.content.add(candidatesGroup);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.atomManager?.dispose();
    this.extraHalfPlaneManager?.dispose();
    this.annotationManager.dispose();
    disposeHierarchy(this.content);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
