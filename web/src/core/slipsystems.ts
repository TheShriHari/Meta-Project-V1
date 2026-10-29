/**
 * web/src/core/slipsystems.ts - Crystallographic slip systems in pure TypeScript.
 * Matches Python hpsim.core.slipsystems definitions.
 */

import type { Vec3 } from "./vectors.ts";
import { normalizeVector, vectorDot } from "./vectors.ts";

export interface SlipSystem {
  index: number;
  planeMiller: [number, number, number];
  directionMiller: [number, number, number];
  n: Vec3;
  s: Vec3;
  planeFamily: string;
  directionFamily: string;
}

export function getFccSlipSystems(): SlipSystem[] {
  const definitions: [
    [number, number, number],
    [number, number, number][]
  ][] = [
    [
      [1, 1, 1],
      [
        [0, 1, -1],
        [-1, 0, 1],
        [1, -1, 0],
      ],
    ],
    [
      [-1, 1, 1],
      [
        [0, 1, -1],
        [1, 0, 1],
        [1, 1, 0],
      ],
    ],
    [
      [1, -1, 1],
      [
        [0, 1, 1],
        [1, 0, -1],
        [1, 1, 0],
      ],
    ],
    [
      [1, 1, -1],
      [
        [0, 1, 1],
        [1, 0, 1],
        [1, -1, 0],
      ],
    ],
  ];

  const systems: SlipSystem[] = [];
  let idx = 0;
  for (const [plane, dirs] of definitions) {
    const n = normalizeVector(plane);
    for (const d of dirs) {
      const s = normalizeVector(d);
      if (Math.abs(vectorDot(s, n)) > 1e-12) {
        throw new Error(`Slip direction not orthogonal to plane: ${d} . ${plane}`);
      }
      systems.push({
        index: idx++,
        planeMiller: plane,
        directionMiller: d,
        n,
        s,
        planeFamily: "{111}",
        directionFamily: "<110>",
      });
    }
  }
  return systems;
}

export function getBccSlipSystems(): SlipSystem[] {
  const definitions: [
    [number, number, number],
    [number, number, number][]
  ][] = [
    [
      [1, 1, 0],
      [
        [1, -1, 1],
        [1, -1, -1],
      ],
    ],
    [
      [1, 0, 1],
      [
        [1, 1, -1],
        [1, -1, -1],
      ],
    ],
    [
      [0, 1, 1],
      [
        [1, 1, -1],
        [-1, 1, -1],
      ],
    ],
    [
      [1, -1, 0],
      [
        [1, 1, 1],
        [1, 1, -1],
      ],
    ],
    [
      [1, 0, -1],
      [
        [1, 1, 1],
        [1, -1, 1],
      ],
    ],
    [
      [0, 1, -1],
      [
        [1, 1, 1],
        [-1, 1, 1],
      ],
    ],
  ];

  const systems: SlipSystem[] = [];
  let idx = 0;
  for (const [plane, dirs] of definitions) {
    const n = normalizeVector(plane);
    for (const d of dirs) {
      const s = normalizeVector(d);
      if (Math.abs(vectorDot(s, n)) > 1e-12) {
        throw new Error(`Slip direction not orthogonal to plane: ${d} . ${plane}`);
      }
      systems.push({
        index: idx++,
        planeMiller: plane,
        directionMiller: d,
        n,
        s,
        planeFamily: "{110}",
        directionFamily: "<111>",
      });
    }
  }
  return systems;
}

export function calculateBurgersMagnitude(
  latticeParameterA: number,
  structure: "FCC" | "BCC" | string
): number {
  if (latticeParameterA <= 0) {
    throw new Error(`Lattice parameter must be positive: ${latticeParameterA}`);
  }
  const struct = structure.toUpperCase();
  if (struct === "FCC") {
    return latticeParameterA / Math.SQRT2;
  } else if (struct === "BCC") {
    return (latticeParameterA * Math.sqrt(3)) / 2;
  } else {
    throw new Error(`Unsupported crystal structure: ${structure}`);
  }
}
