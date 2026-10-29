/**
 * web/src/render/viewer.ts - Three.js viewer. Presentation only: it READS physics state (core position)
 * and writes only to Three.js objects. Scene unit = 1 nm, Z-up (crystal [001] = +Z).
 * Ideal coordinates (R_i) are kept in `ideal`; render coordinates r_i = R_i + u(R_i; r_d) are recomputed
 * by the core `displacedPositions` into a separate array each update.
 * The displacement is an analytical continuum visualization, not molecular dynamics.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { applyViewPreset, type ViewName } from "./camera.ts";
import { displacedPositions } from "../core/dislocation.ts";
import type { Demo } from "../model/demo.ts";

const NM = 1e9;
export type Layer = "atoms" | "bonds" | "cell" | "axes" | "slipPlane" | "burgers" | "core" | "boundary" | "outgoingCandidates";
export const LAYERS: Layer[] = ["atoms", "bonds", "cell", "axes", "slipPlane", "burgers", "core", "boundary", "outgoingCandidates"];

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
  private controls: OrbitControls;
  private layers: Record<Layer, THREE.Object3D> = {} as Record<Layer, THREE.Object3D>;
  private atoms?: THREE.InstancedMesh;
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
  private dummy = new THREE.Object3D();
  private content = new THREE.Group();
  /** Last rendered displaced positions (metres): render state, separate from `demo.ideal`. */
  renderPositions: Float64Array = new Float64Array(0);

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0b1020);
    container.appendChild(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(3, -4, 6); this.scene.add(d);
    this.scene.add(this.content);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.controls.update(); this.renderer.render(this.scene, this.camera); };
    loop();
  }

  resize() {
    const w = Math.max(this.container.clientWidth, 1), h = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%"; this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  loadStructure(demo: Demo) {
    this.demo = demo;
    this.content.clear();
    const { ideal, a_m, box_m, geom } = demo;
    const nAtoms = ideal.length / 3;
    const S = (v: number) => v * NM;

    // atoms (instanced), coloured by side of the slip plane (static, from ideal positions)
    const radius = S(a_m) * 0.09;
    this.atoms = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 14, 10),
      new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }), nAtoms);
    const cUp = new THREE.Color(0x5ec8ff), cDn = new THREE.Color(0xffb35e);
    for (let i = 0; i < nAtoms; i++) {
      const y = (ideal[3 * i] - geom.p0[0]) * geom.n[0] + (ideal[3 * i + 1] - geom.p0[1]) * geom.n[1] + (ideal[3 * i + 2] - geom.p0[2]) * geom.n[2];
      this.atoms.setColorAt(i, y > 0 ? cUp : cDn);
    }
    this.layers.atoms = this.atoms;

    // nearest-neighbour bonds from IDEAL geometry (a/sqrt2), drawn between displaced positions
    const nn = a_m / Math.SQRT2, lim = (nn * 1.05) ** 2;
    const pairs: number[] = [];
    for (let i = 0; i < nAtoms; i++) for (let j = i + 1; j < nAtoms; j++) {
      const dx = ideal[3 * i] - ideal[3 * j], dy = ideal[3 * i + 1] - ideal[3 * j + 1], dz = ideal[3 * i + 2] - ideal[3 * j + 2];
      if (dx * dx + dy * dy + dz * dz < lim) pairs.push(i, j);
    }
    this.bondPairs = Uint32Array.from(pairs);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pairs.length * 3), 3));
    this.bonds = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0x8aa0c8, transparent: true, opacity: 0.55 }));
    this.bonds.frustumCulled = false;
    this.layers.bonds = this.bonds;

    // unit cell (first conventional cell), axes
    const cell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(S(a_m), S(a_m), S(a_m))),
      new THREE.LineBasicMaterial({ color: 0xffffff }));
    cell.position.set(S(a_m) / 2, S(a_m) / 2, S(a_m) / 2);
    this.layers.cell = cell;
    this.layers.axes = new THREE.AxesHelper(S(a_m) * 2);

    // slip plane, basis (s, xi = s x n, n) right-handed
    const s = new THREE.Vector3(...geom.s), n = new THREE.Vector3(...geom.n), xi = new THREE.Vector3().crossVectors(s, n);
    const diag = S(Math.hypot(...box_m));
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(diag, diag),
      new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    plane.matrixAutoUpdate = false;
    plane.matrix.makeBasis(s, xi, n).setPosition(S(geom.p0[0]), S(geom.p0[1]), S(geom.p0[2]));
    this.layers.slipPlane = plane;

    // Burgers vector arrow, dislocation line and core marker (positions set in setCorePosition)
    this.burgers = new THREE.ArrowHelper(s, new THREE.Vector3(), S(demo.b_m) * 1.6, 0xff9f1c, S(demo.b_m) * 0.6, S(demo.b_m) * 0.4);
    this.layers.burgers = this.burgers;
    const half = S(Math.max(...box_m)) * 0.6;
    const lg = new THREE.BufferGeometry().setFromPoints([xi.clone().multiplyScalar(-half), xi.clone().multiplyScalar(half)]);
    this.coreLine = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xff3b5c }));
    this.coreMarker = new THREE.Mesh(new THREE.SphereGeometry(S(demo.b_m) * 0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff3b5c }));
    const core = new THREE.Group(); core.add(this.coreLine, this.coreMarker);
    this.layers.core = core;

    // Phase 4: Controlled columnar boundary & adjacent grain (Grain 2)
    const boundaryGroup = new THREE.Group();
    // Intersection of slip line with the grain boundary at tMax
    const pGb = new THREE.Vector3(
      (geom.p0[0] + geom.tMax * geom.s[0]) * NM,
      (geom.p0[1] + geom.tMax * geom.s[1]) * NM,
      (geom.p0[2] + geom.tMax * geom.s[2]) * NM
    );

    // Columnar boundary plane: vertical plane passing through pGb with normal perpendicular to Z (columnar axis)
    const sProjXY = new THREE.Vector3(geom.s[0], geom.s[1], 0).normalize();
    const gbNormal = sProjXY.lengthSq() > 1e-4 ? sProjXY : new THREE.Vector3(1, 0, 0);
    const gbZ = new THREE.Vector3(0, 0, 1);
    const gbTangent = new THREE.Vector3().crossVectors(gbZ, gbNormal).normalize();

    const planeW = S(Math.hypot(box_m[0], box_m[1])) * 1.5;
    const planeH = S(box_m[2]) * 1.8;
    const gbGeom = new THREE.PlaneGeometry(planeW, planeH);
    const gbMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const gbPlane = new THREE.Mesh(gbGeom, gbMat);
    gbPlane.matrixAutoUpdate = false;
    gbPlane.matrix.makeBasis(gbTangent, gbZ, gbNormal).setPosition(pGb.x, pGb.y, S(box_m[2]) / 2);
    boundaryGroup.add(gbPlane);

    // Border around boundary plane
    const gbEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(gbGeom),
      new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6 })
    );
    gbEdges.matrixAutoUpdate = false;
    gbEdges.matrix.copy(gbPlane.matrix);
    boundaryGroup.add(gbEdges);

    // Adjacent Grain 2 bounding wireframe box
    const g2BoxW = S(box_m[0]);
    const g2Box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(g2BoxW, S(box_m[1]), S(box_m[2]))),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
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
      new THREE.SphereGeometry(S(demo.b_m) * 0.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: markerColor })
    );
    outcomeMarker.position.copy(pGb);
    boundaryGroup.add(outcomeMarker);

    this.layers.boundary = boundaryGroup;

    // Phase 4: Outgoing candidate slip systems
    const candidatesGroup = new THREE.Group();
    for (const cand of demo.transmission.candidates) {
      const isSelected = demo.transmission.selectedCandidate?.systemIndex === cand.systemIndex;
      const sOutSpec = new THREE.Vector3(cand.sSpecimen[0], cand.sSpecimen[1], cand.sSpecimen[2]).normalize();

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

    for (const k of LAYERS) this.content.add(this.layers[k]);
    this.center.set(S(box_m[0]) / 2, S(box_m[1]) / 2, S(box_m[2]) / 2);
    this.distance = S(box_m[0]) * 3.4;
    this.setView("isometric");
    this.setCorePosition(demo.controller.state.pos_m);
  }

  /** Recompute DISPLAYED coordinates from the ideal lattice; never modifies physics state or ideal data. */
  setCorePosition(pos_m: number) {
    const d = this.demo; if (!d || !this.atoms || !this.bonds) return;
    const r = displacedPositions(d.ideal, d.geom, pos_m, d.field);
    this.renderPositions = r;
    for (let i = 0; i < r.length / 3; i++) {
      this.dummy.position.set(r[3 * i] * NM, r[3 * i + 1] * NM, r[3 * i + 2] * NM);
      this.dummy.updateMatrix();
      this.atoms.setMatrixAt(i, this.dummy.matrix);
    }
    this.atoms.instanceMatrix.needsUpdate = true;
    if (this.atoms.instanceColor) this.atoms.instanceColor.needsUpdate = true;
    const attr = this.bonds.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let k = 0; k < this.bondPairs.length; k++) {
      const a = this.bondPairs[k];
      attr.setXYZ(k, r[3 * a] * NM, r[3 * a + 1] * NM, r[3 * a + 2] * NM);
    }
    attr.needsUpdate = true;
    const g = d.geom;
    const core = new THREE.Vector3(g.p0[0] + pos_m * g.s[0], g.p0[1] + pos_m * g.s[1], g.p0[2] + pos_m * g.s[2]).multiplyScalar(NM);
    this.layers.core.position.copy(core);
    this.burgers?.position.copy(core);
  }

  setLayer(layer: Layer, visible: boolean) { this.layers[layer].visible = visible; }
  setView(view: ViewName) { applyViewPreset(this.camera, this.controls, view, this.center, this.distance); }
  resetCamera() { this.setView("isometric"); }

  updateTransmission(transmission: import("../core/boundary.ts").TransmissionResult) {
    const d = this.demo;
    if (!d) return;
    d.transmission = transmission;
    const S = (v: number) => v * NM;
    const geom = d.geom;
    const box_m = d.box_m;

    const visibleBoundary = this.layers.boundary ? this.layers.boundary.visible : true;
    const visibleCandidates = this.layers.outgoingCandidates ? this.layers.outgoingCandidates.visible : true;

    if (this.layers.boundary) this.content.remove(this.layers.boundary);
    if (this.layers.outgoingCandidates) this.content.remove(this.layers.outgoingCandidates);

    // Build new boundary group
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
    const gbGeom = new THREE.PlaneGeometry(planeW, planeH);
    const gbMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const gbPlane = new THREE.Mesh(gbGeom, gbMat);
    gbPlane.matrixAutoUpdate = false;
    gbPlane.matrix.makeBasis(gbTangent, gbZ, gbNormal).setPosition(pGb.x, pGb.y, S(box_m[2]) / 2);
    boundaryGroup.add(gbPlane);

    const gbEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(gbGeom),
      new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6 })
    );
    gbEdges.matrixAutoUpdate = false;
    gbEdges.matrix.copy(gbPlane.matrix);
    boundaryGroup.add(gbEdges);

    const g2BoxW = S(box_m[0]);
    const g2Box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(g2BoxW, S(box_m[1]), S(box_m[2]))),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
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
      new THREE.SphereGeometry(S(d.b_m) * 0.5, 16, 12),
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
      const sOutSpec = new THREE.Vector3(cand.sSpecimen[0], cand.sSpecimen[1], cand.sSpecimen[2]).normalize();

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
    cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

