/**
 * web/src/render/boundaryMesh.ts
 *
 * Renders grain boundary and slip plane meshes for HPSim 3D visual fidelity.
 * Presentation only: reads geometry coordinates and returns Three.js groups.
 * Scene unit = 1 nm (10^-9 m), Z-up.
 */
import * as THREE from "three";

/**
 * Creates a translucent indigo grain boundary plane with a bright violet-white glowing border.
 * Rendered only in multi-grain scenes with real boundaries (e.g. Chapter 2+).
 *
 * @param pGb Boundary plane anchor/intersection position in scene units (nm)
 * @param gbNormal Normal vector of grain boundary plane
 * @param gbTangent Tangent vector of grain boundary plane
 * @param planeW Width of boundary plane in scene units (nm)
 * @param planeH Height of boundary plane in scene units (nm)
 */
export function createGrainBoundaryMesh(
  pGb: THREE.Vector3,
  gbNormal: THREE.Vector3,
  gbTangent: THREE.Vector3,
  planeW: number,
  planeH: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = "grainBoundaryGroup";

  // Translucent indigo plane: 0x818cf8, opacity 0.12, DoubleSide, depthWrite: false
  const planeGeom = new THREE.PlaneGeometry(planeW, planeH);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x818cf8,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const planeMesh = new THREE.Mesh(planeGeom, planeMat);
  planeMesh.name = "grainBoundaryPlane";

  // Bright violet-white glowing border: 0xc7d2fe, opacity 0.75 using EdgesGeometry
  const edgesGeom = new THREE.EdgesGeometry(planeGeom);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xc7d2fe,
    transparent: true,
    opacity: 0.75,
  });
  const borderLines = new THREE.LineSegments(edgesGeom, edgeMat);
  borderLines.name = "grainBoundaryBorder";

  group.add(planeMesh);
  group.add(borderLines);

  // Correct matrix transformation: basis = [gbTangent, (0, 0, 1), gbNormal], position = pGb
  group.matrixAutoUpdate = false;
  group.matrix
    .makeBasis(gbTangent, new THREE.Vector3(0, 0, 1), gbNormal)
    .setPosition(pGb.x, pGb.y, pGb.z);
  group.matrixWorldNeedsUpdate = true;

  return group;
}

/**
 * Creates a translucent warm amber slip plane mesh with a warm amber outline border.
 *
 * @param p0 Slip plane anchor point on slip plane in scene units (nm)
 * @param s Unit slip direction vector
 * @param xi Unit dislocation line vector (xi = s x n)
 * @param n Unit slip plane normal vector
 * @param diag Diagonal dimension of the slip plane in scene units (nm)
 */
export function createSlipPlaneMesh(
  p0: THREE.Vector3,
  s: THREE.Vector3,
  xi: THREE.Vector3,
  n: THREE.Vector3,
  diag: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = "slipPlaneGroup";

  // Translucent warm amber plane: 0xf59e0b, opacity 0.14, DoubleSide, depthWrite: false
  const planeGeom = new THREE.PlaneGeometry(diag, diag);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const planeMesh = new THREE.Mesh(planeGeom, planeMat);
  planeMesh.name = "slipPlaneMesh";

  // Warm amber border: EdgesGeometry, color 0xf59e0b, opacity 0.45
  const edgesGeom = new THREE.EdgesGeometry(planeGeom);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.45,
  });
  const borderLines = new THREE.LineSegments(edgesGeom, edgeMat);
  borderLines.name = "slipPlaneBorder";

  group.add(planeMesh);
  group.add(borderLines);

  // Matrix transformation: basis = [s, xi, n], position = p0
  group.matrixAutoUpdate = false;
  group.matrix
    .makeBasis(s, xi, n)
    .setPosition(p0.x, p0.y, p0.z);
  group.matrixWorldNeedsUpdate = true;

  return group;
}
