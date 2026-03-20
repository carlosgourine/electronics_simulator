import type { DCSolution, Entity, Wire } from "../types";
import { worldTerminals } from "../utils/entities";
import { parseSI } from "../utils/parser";
import { solveLinear } from "./matrix";
import { buildNodeMap } from "./nodes";

const GMIN = 1e-9;
const MIN_RESISTANCE = 1e-6;

/**
 * Solves the circuit in DC using Modified Nodal Analysis (MNA).
 * Inductors are modeled as 0 V sources so their branch current remains measurable.
 */
export function solveDC(entities: Entity[], wires: Wire[]): DCSolution {
  const nodeOf = buildNodeMap(entities, wires, false);
  const hasGround = entities.some((entity) => entity.type === "ground");
  const nodes = Array.from(new Set(nodeOf.values())).sort((a, b) => a - b);
  const nonGroundNodes = nodes.filter((node) => node !== 0);
  const nodeIndex = new Map<number, number>();
  nonGroundNodes.forEach((node, index) => nodeIndex.set(node, index));

  const dcVoltageSources = entities.filter(
    (entity) => (entity.type === "vsrc" && entity.wave !== "ac") || entity.type === "inductor",
  );
  const sourceCount = dcVoltageSources.length;
  const vsIndexOf = new Map<string, number>();
  dcVoltageSources.forEach((entity, index) => vsIndexOf.set(entity.id, index));

  const nodeCount = nonGroundNodes.length;
  const G = Array.from({ length: nodeCount }, () => new Array(nodeCount).fill(0));
  const I = new Array(nodeCount).fill(0);
  const B = Array.from({ length: nodeCount }, () => new Array(sourceCount).fill(0));
  const E = new Array(sourceCount).fill(0);
  for (let i = 0; i < nodeCount; i += 1) G[i][i] += GMIN;

  const matrixIndex = (node: number | undefined): number | null => {
    if (node === undefined || node === 0) return null;
    const index = nodeIndex.get(node);
    return typeof index === "number" ? index : null;
  };

  const stampResistor = (n1: number | undefined, n2: number | undefined, resistance: number) => {
    if (!Number.isFinite(resistance)) return;
    const safeResistance = Math.max(resistance, MIN_RESISTANCE);
    const conductance = 1 / safeResistance;
    const i1 = matrixIndex(n1);
    const i2 = matrixIndex(n2);
    if (i1 !== null) G[i1][i1] += conductance;
    if (i2 !== null) G[i2][i2] += conductance;
    if (i1 !== null && i2 !== null) {
      G[i1][i2] -= conductance;
      G[i2][i1] -= conductance;
    }
  };

  const stampCurrentSource = (nPos: number | undefined, nNeg: number | undefined, current: number) => {
    const iPos = matrixIndex(nPos);
    const iNeg = matrixIndex(nNeg);
    if (iPos !== null) I[iPos] += current;
    if (iNeg !== null) I[iNeg] -= current;
  };

  const stampVoltageSource = (k: number, nPos: number | undefined, nNeg: number | undefined, voltage: number) => {
    const iPos = matrixIndex(nPos);
    const iNeg = matrixIndex(nNeg);
    if (iPos !== null) B[iPos][k] += 1;
    if (iNeg !== null) B[iNeg][k] -= 1;
    E[k] = voltage;
  };

  const termNode = new Map<string, number>();
  entities.forEach((entity) => {
    worldTerminals(entity).forEach((terminal) => termNode.set(terminal.id, nodeOf.get(terminal.id)!));
  });

  for (const source of dcVoltageSources) {
    const terminals = worldTerminals(source);
    const nA = termNode.get(terminals[0].id);
    const nB = termNode.get(terminals[1].id);
    if (nA === nB) {
      return {
        ok: false,
        reason: `Voltage-defined branch '${source.label || source.type}' is shorted (both pins on node ${nA}).`,
        nodeOf,
        V: new Map(),
        vsIndexOf,
        Ivs: [],
      };
    }
  }

  if (!hasGround) {
    return {
      ok: false,
      reason: "No GND placed (add a ground symbol)",
      nodeOf,
      V: new Map(),
      vsIndexOf,
      Ivs: [],
    };
  }

  for (const entity of entities) {
    if (entity.type === "resistor") {
      const terminals = worldTerminals(entity);
      const resistance = parseSI(entity.value || "1k");
      if (resistance !== null) stampResistor(termNode.get(terminals[0].id), termNode.get(terminals[1].id), resistance);
      continue;
    }

    if (entity.type === "capacitor") continue;

    if (entity.type === "isrc") {
      if (entity.wave === "ac") continue;
      const terminals = worldTerminals(entity);
      const current = parseSI(entity.amplitude || "0");
      if (current !== null) stampCurrentSource(termNode.get(terminals[0].id), termNode.get(terminals[1].id), current);
      continue;
    }

    if (entity.type === "vsrc") {
      if (entity.wave === "ac") continue;
      const terminals = worldTerminals(entity);
      const voltage = parseSI(entity.amplitude || "0");
      const sourceIndex = vsIndexOf.get(entity.id)!;
      if (voltage !== null) stampVoltageSource(sourceIndex, termNode.get(terminals[0].id), termNode.get(terminals[1].id), voltage);
      continue;
    }

    if (entity.type === "inductor") {
      const terminals = worldTerminals(entity);
      stampVoltageSource(vsIndexOf.get(entity.id)!, termNode.get(terminals[0].id), termNode.get(terminals[1].id), 0);
      continue;
    }
  }

  const size = nodeCount + sourceCount;
  const A = Array.from({ length: size }, () => new Array(size).fill(0));
  const rhs = new Array(size).fill(0);

  for (let row = 0; row < nodeCount; row += 1) {
    for (let col = 0; col < nodeCount; col += 1) A[row][col] = G[row][col];
    for (let k = 0; k < sourceCount; k += 1) A[row][nodeCount + k] = B[row][k];
    rhs[row] = I[row];
  }

  for (let k = 0; k < sourceCount; k += 1) {
    for (let col = 0; col < nodeCount; col += 1) A[nodeCount + k][col] = B[col][k];
    rhs[nodeCount + k] = E[k];
  }

  const solution = solveLinear(A, rhs);
  if (!solution) {
    return {
      ok: false,
      reason: "Singular matrix (check for shorted voltage-defined branches)",
      nodeOf,
      V: new Map(),
      vsIndexOf,
      Ivs: [],
    };
  }

  const V = new Map<number, number>();
  nonGroundNodes.forEach((node, index) => V.set(node, solution[index]));
  V.set(0, 0);

  return {
    ok: true,
    nodeOf,
    V,
    vsIndexOf,
    Ivs: solution.slice(nodeCount),
  };
}
