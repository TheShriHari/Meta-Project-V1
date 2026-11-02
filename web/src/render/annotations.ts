/**
 * web/src/render/annotations.ts
 *
 * World-space CSS2D annotations for HPSim 3D rendering.
 * Provides lightweight camera-facing HTML badges anchored to dislocation core,
 * grain boundary, slip plane, and Burgers vector arrow.
 */
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

export type AnnotationKey = "core" | "gb" | "slip" | "burgers";

/**
 * Builds a styled pill badge DOM element.
 */
export function createPillElement(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.background = "rgba(15, 23, 42, 0.85)";
  el.style.border = "1px solid rgba(148, 163, 184, 0.35)";
  el.style.borderRadius = "9999px";
  el.style.padding = "2px 8px";
  el.style.fontSize = "11px";
  el.style.fontWeight = "600";
  el.style.color = "#f8fafc";
  el.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";
  el.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.3)";
  el.style.whiteSpace = "nowrap";
  return el;
}

export class AnnotationManager {
  private renderer: CSS2DRenderer;
  public readonly coreLabel: CSS2DObject;
  public readonly gbLabel: CSS2DObject;
  public readonly slipLabel: CSS2DObject;
  public readonly burgersLabel: CSS2DObject;
  private labels: Record<AnnotationKey, CSS2DObject>;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new CSS2DRenderer();

    const dom = this.renderer.domElement;
    dom.style.position = "absolute";
    dom.style.top = "0";
    dom.style.left = "0";
    dom.style.width = "100%";
    dom.style.height = "100%";
    dom.style.pointerEvents = "none";
    dom.style.zIndex = "10";
    this.container.appendChild(dom);

    // 4 world-space annotations
    this.coreLabel = new CSS2DObject(createPillElement("Dislocation core (\u22A5)"));
    this.gbLabel = new CSS2DObject(createPillElement("Grain boundary"));
    this.slipLabel = new CSS2DObject(createPillElement("Slip plane"));
    this.burgersLabel = new CSS2DObject(createPillElement("b"));

    this.labels = {
      core: this.coreLabel,
      gb: this.gbLabel,
      slip: this.slipLabel,
      burgers: this.burgersLabel,
    };
  }

  /**
   * Retrieves the CSS2DObject for a given annotation key.
   */
  getLabel(labelKey: AnnotationKey): CSS2DObject {
    return this.labels[labelKey];
  }

  /**
   * Returns the underlying CSS2DRenderer domElement.
   */
  get domElement(): HTMLElement {
    return this.renderer.domElement;
  }

  /**
   * Attaches an annotation label to a target Object3D with an optional local position offset.
   */
  attachTo(target: THREE.Object3D, labelKey: AnnotationKey, offset?: THREE.Vector3): void {
    const label = this.labels[labelKey];
    if (!label || !target) return;

    if (label.parent) {
      label.parent.remove(label);
    }
    if (offset) {
      label.position.copy(offset);
    } else {
      label.position.set(0, 0, 0);
    }
    target.add(label);
  }

  /**
   * Controls visibility of an annotation label.
   */
  setVisible(labelKey: AnnotationKey, visible: boolean): void {
    const label = this.labels[labelKey];
    if (!label) return;
    label.visible = visible;
    label.element.style.display = visible ? "" : "none";
  }

  /**
   * Renders world-space CSS2D annotations using the current scene and camera.
   */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  /**
   * Resizes the CSS2D renderer dimensions.
   */
  resize(w: number, h: number): void {
    this.renderer.setSize(w, h);
  }

  /**
   * Teardown: removes all CSS2DObjects from parents and detaches domElement from container.
   */
  dispose(): void {
    for (const key of Object.keys(this.labels) as AnnotationKey[]) {
      const label = this.labels[key];
      if (label.parent) {
        label.parent.remove(label);
      }
      if (label.element.parentElement) {
        label.element.parentElement.removeChild(label.element);
      }
    }
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
