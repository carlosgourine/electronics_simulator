import { AMMETER_INTERNAL_RESISTANCE } from "../constants/config";
import type { ACSolution, Entity, Wire } from "../types";
import { worldTerminals } from "../utils/entities";
import { C0, cAdd, cDiv, cMul, cSub } from "../utils/math";
import { parseHz, parsePhase, parseSI } from "../utils/parser";
import { solveLinearC } from "./matrix";
import { buildNodeMap } from "./nodes";

const GMIN = C0(1e-9, 0);
const MIN_RESISTANCE = 1e-6;
const MIN_INDUCTANCE = 1e-9;

/**
 * Solves the circuit in AC steady state using phasor-domain MNA.
 * DC current sources open out and DC voltage sources become 0 V constraints.
 */
export function solveAC(entities: Entity[], wires: Wire[], freqDefaultHz: number): ACSolution {
  const acSources = entities.filter(
    (entity) => (entity.type === "vsrc" || entity.type === "isrc") && entity.wave === "ac",
  );

  let frequency = freqDefaultHz;
  const sourceFrequencies = acSources
    .map((source) => parseHz(source.frequency || ""))
    .filter((value): value is number => Boolean(value) && Number.isFinite(value));

  if (sourceFrequencies.length > 0) {
    const first = sourceFrequencies[0];
    const mismatch = sourceFrequencies.some((value) => Math.abs(value - first) > 1e-9);
    if (mismatch) {
      return {
        ok: false,
        reason: "All AC sources must share the same frequency.",
        nodeOf: new Map(),
        V: new Map(),
        vsIndexOf: new Map(),
        Ivs: [],
        omega: 0,
      };
    }
    frequency = first;
  }

  if (!frequency || !Number.isFinite(frequency) || frequency <= 0) {
    return {
      ok: false,
      reason: "AC frequency must be > 0 Hz.",
      nodeOf: new Map(),
      V: new Map(),
      vsIndexOf: new Map(),
      Ivs: [],
      omega: 0,
    };
  }

  const omega = 2 * Math.PI * frequency;
  const nodeOf = buildNodeMap(entities, wires, false);
  const hasGround = entities.some((entity) => entity.type === "ground");
  const nodes = Array.from(new Set(nodeOf.values())).sort((a, b) => a - b);
  const nonGroundNodes = nodes.filter((node) => node !== 0);
  const nodeIndex = new Map<number, number>();
  nonGroundNodes.forEach((node, index) => nodeIndex.set(node, index));

  const voltageSources = entities.filter((entity) => entity.type === "vsrc");
  const sourceCount = voltageSources.length;
  const vsIndexOf = new Map<string, number>();
  voltageSources.forEach((entity, index) => vsIndexOf.set(entity.id, index));

  const nodeCount = nonGroundNodes.length;
  const G = Array.from({ length: nodeCount }, () => Array.from({ length: nodeCount }, () => C0()));
  const I = Array.from({ length: nodeCount }, () => C0());
  const B = Array.from({ length: nodeCount }, () => Array.from({ length: sourceCount }, () => C0()));
  const E = Array.from({ length: sourceCount }, () => C0());
  for (let i = 0; i < nodeCount; i += 1) G[i][i] = cAdd(G[i][i], GMIN);

  const matrixIndex = (node: number | undefined): number | null => {
    if (node === undefined || node === 0) return null;
    const index = nodeIndex.get(node);
    return typeof index === "number" ? index : null;
  };

  const stampAdmittance = (n1: number | undefined, n2: number | undefined, admittance: ReturnType<typeof C0>) => {
    const i1 = matrixIndex(n1);
    const i2 = matrixIndex(n2);
    if (i1 !== null) G[i1][i1] = cAdd(G[i1][i1], admittance);
    if (i2 !== null) G[i2][i2] = cAdd(G[i2][i2], admittance);
    if (i1 !== null && i2 !== null) {
      G[i1][i2] = cSub(G[i1][i2], admittance);
      G[i2][i1] = cSub(G[i2][i1], admittance);
    }
  };

  const stampCurrentSource = (nPos: number | undefined, nNeg: number | undefined, current: ReturnType<typeof C0>) => {
    const iPos = matrixIndex(nPos);
    const iNeg = matrixIndex(nNeg);
    if (iPos !== null) I[iPos] = cAdd(I[iPos], current);
    if (iNeg !== null) I[iNeg] = cSub(I[iNeg], current);
  };

  const stampVoltageSource = (k: number, nPos: number | undefined, nNeg: number | undefined, voltage: ReturnType<typeof C0>) => {
    const iPos = matrixIndex(nPos);
    const iNeg = matrixIndex(nNeg);
    if (iPos !== null) B[iPos][k] = cAdd(B[iPos][k], C0(1, 0));
    if (iNeg !== null) B[iNeg][k] = cSub(B[iNeg][k], C0(1, 0));
    E[k] = voltage;
  };

  const j = C0(0, 1);
  const termNode = new Map<string, number>();
  entities.forEach((entity) => {
    worldTerminals(entity).forEach((terminal) => termNode.set(terminal.id, nodeOf.get(terminal.id)!));
  });

  if (!hasGround) {
    return {
      ok: false,
      reason: "No GND placed (add a ground symbol)",
      nodeOf,
      V: new Map(),
      vsIndexOf,
      Ivs: [],
      omega,
    };
  }

  for (const entity of entities) {
    const terminals = worldTerminals(entity);
    const n1 = termNode.get(terminals[0]?.id || "");
    const n2 = termNode.get(terminals[1]?.id || "");

    if (entity.type === "resistor") {
      const resistance = Math.max(parseSI(entity.value || "1k") || 0, MIN_RESISTANCE);
      stampAdmittance(n1, n2, C0(1 / resistance, 0));
      continue;
    }

    if (entity.type === "capacitor") {
      const capacitance = parseSI(entity.value || "1u");
      if (capacitance && capacitance > 0) stampAdmittance(n1, n2, cMul(j, C0(omega * capacitance, 0)));
      continue;
    }

    if (entity.type === "inductor") {
      const inductance = Math.max(parseSI(entity.value || "10m") || 0, MIN_INDUCTANCE);
      stampAdmittance(n1, n2, cDiv(C0(1, 0), cMul(j, C0(omega * inductance, 0))));
      continue;
    }

    if (entity.type === "ameter") {
      stampAdmittance(n1, n2, C0(1 / AMMETER_INTERNAL_RESISTANCE, 0));
      continue;
    }

    if (entity.type === "vmeter") continue;

    if (entity.type === "isrc") {
      if (entity.wave !== "ac") continue;
      const amplitude = parseSI(entity.amplitude || "0") || 0;
      const phase = parsePhase(entity.phaseEnabled ? entity.phase : "0");
      stampCurrentSource(n1, n2, C0(amplitude * Math.cos(phase), amplitude * Math.sin(phase)));
    }
  }

  for (const source of voltageSources) {
    const terminals = worldTerminals(source);
    const n1 = termNode.get(terminals[0]?.id || "");
    const n2 = termNode.get(terminals[1]?.id || "");
    let phasor = C0(0, 0);

    if (source.wave === "ac") {
      const amplitude = parseSI(source.amplitude || "0") || 0;
      const phase = parsePhase(source.phaseEnabled ? source.phase : "0");
      phasor = C0(amplitude * Math.cos(phase), amplitude * Math.sin(phase));
    }

    stampVoltageSource(vsIndexOf.get(source.id)!, n1, n2, phasor);
  }

  const size = nodeCount + sourceCount;
  const A = Array.from({ length: size }, () => Array.from({ length: size }, () => C0()));
  const rhs = Array.from({ length: size }, () => C0());

  for (let row = 0; row < nodeCount; row += 1) {
    for (let col = 0; col < nodeCount; col += 1) A[row][col] = G[row][col];
    for (let k = 0; k < sourceCount; k += 1) A[row][nodeCount + k] = B[row][k];
    rhs[row] = I[row];
  }

  for (let k = 0; k < sourceCount; k += 1) {
    for (let col = 0; col < nodeCount; col += 1) A[nodeCount + k][col] = B[col][k];
    rhs[nodeCount + k] = E[k];
  }

  const solution = solveLinearC(A, rhs);
  if (!solution) {
    return {
      ok: false,
      reason: "Singular (check shorts/opens or missing frequency)",
      nodeOf,
      V: new Map(),
      vsIndexOf,
      Ivs: [],
      omega,
    };
  }

  const V = new Map<number, ReturnType<typeof C0>>();
  nonGroundNodes.forEach((node, index) => V.set(node, solution[index]));
  V.set(0, C0(0, 0));

  return {
    ok: true,
    nodeOf,
    V,
    vsIndexOf,
    Ivs: solution.slice(nodeCount),
    omega,
  };
}
