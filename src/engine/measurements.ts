import { AMMETER_INTERNAL_RESISTANCE } from "../constants/config";
import type { ACSolution, Analysis, C, DCSolution, Entity, PhasorItem, PhasorMode, Solution } from "../types";
import { worldTerminals } from "../utils/entities";
import { nodeColor, phasorColor } from "../utils/geometry";
import { C0, cAbs, cAdd, cArg, cDiv, cMul, cSub } from "../utils/math";
import { parsePhase, parseSI } from "../utils/parser";

const MIN_RESISTANCE = 1e-6;
const MIN_INDUCTANCE = 1e-9;

function getTermNodes(entity: Entity, nodeOf: Map<string, number>) {
  const terminals = worldTerminals(entity);
  return {
    nA: nodeOf.get(terminals[0]?.id || "") ?? 0,
    nB: nodeOf.get(terminals[1]?.id || "") ?? 0,
  };
}

export function getVoltagePhasor(entity: Entity, solution: Solution, analysis: Analysis): C | null {
  if (!solution.ok) return null;

  const terminals = worldTerminals(entity);
  if (terminals.length < 2) return C0(0, 0);

  const nA = solution.nodeOf.get(terminals[0].id) || 0;
  const nB = solution.nodeOf.get(terminals[1].id) || 0;

  if (analysis === "dc") {
    const dc = solution as DCSolution;
    return C0((dc.V.get(nA) || 0) - (dc.V.get(nB) || 0), 0);
  }

  const ac = solution as ACSolution;
  return cSub(ac.V.get(nA) || C0(0, 0), ac.V.get(nB) || C0(0, 0));
}

export function getCurrentPhasor(entity: Entity, solution: Solution, analysis: Analysis): C | null {
  if (!solution.ok) return null;

  const terminals = worldTerminals(entity);
  const nA = solution.nodeOf.get(terminals[0]?.id || "");
  const nB = solution.nodeOf.get(terminals[1]?.id || "");

  if (analysis === "dc") {
    const dc = solution as DCSolution;
    if (entity.type === "vmeter") return C0(0, 0);

    const Va = nA != null ? dc.V.get(nA) || 0 : 0;
    const Vb = nB != null ? dc.V.get(nB) || 0 : 0;
    const vab = Va - Vb;

    if (entity.type === "resistor") {
      const resistance = Math.max(parseSI(entity.value || "1k") || 0, MIN_RESISTANCE);
      return C0(vab / resistance, 0);
    }
    if (entity.type === "vsrc") {
      const index = dc.vsIndexOf.get(entity.id);
      return C0(index === undefined ? 0 : dc.Ivs[index] || 0, 0);
    }
    if (entity.type === "inductor") {
      const index = dc.vsIndexOf.get(entity.id);
      return C0(index === undefined ? 0 : dc.Ivs[index] || 0, 0);
    }
    if (entity.type === "isrc") return C0(parseSI(entity.amplitude || "0") || 0, 0);
    if (entity.type === "ameter") return C0(vab / AMMETER_INTERNAL_RESISTANCE, 0);
    return C0(0, 0);
  }

  const ac = solution as ACSolution;
  const Va = nA != null ? ac.V.get(nA) || C0(0, 0) : C0(0, 0);
  const Vb = nB != null ? ac.V.get(nB) || C0(0, 0) : C0(0, 0);
  const vab = cSub(Va, Vb);
  const omega = ac.omega;

  if (entity.type === "resistor") {
    const resistance = Math.max(parseSI(entity.value || "1k") || 0, MIN_RESISTANCE);
    return C0(vab.re / resistance, vab.im / resistance);
  }
  if (entity.type === "capacitor") {
    const capacitance = parseSI(entity.value || "1u") || 0;
    return cMul(C0(0, omega * capacitance), vab);
  }
  if (entity.type === "inductor") {
    const inductance = Math.max(parseSI(entity.value || "10m") || 0, MIN_INDUCTANCE);
    return cMul(cDiv(C0(1, 0), C0(0, omega * inductance)), vab);
  }
  if (entity.type === "vsrc") {
    const index = ac.vsIndexOf.get(entity.id);
    return index === undefined ? C0(0, 0) : ac.Ivs[index] || C0(0, 0);
  }
  if (entity.type === "isrc") {
    if (entity.wave !== "ac") return C0(0, 0);
    const amplitude = parseSI(entity.amplitude || "0") || 0;
    const phase = parsePhase(entity.phaseEnabled ? entity.phase : "0");
    return C0(amplitude * Math.cos(phase), amplitude * Math.sin(phase));
  }
  if (entity.type === "ameter") {
    return C0(vab.re / AMMETER_INTERNAL_RESISTANCE, vab.im / AMMETER_INTERNAL_RESISTANCE);
  }
  return C0(0, 0);
}

export function getVoltageInstant(entity: Entity, solution: Solution, analysis: Analysis, t: number) {
  if (!solution.ok) return null;
  const phasor = getVoltagePhasor(entity, solution, analysis);
  if (!phasor) return null;
  if (analysis === "dc") return phasor.re;
  const omega = (solution as ACSolution).omega;
  return phasor.re * Math.cos(omega * t) - phasor.im * Math.sin(omega * t);
}

export function getCurrentInstant(entity: Entity, solution: Solution, analysis: Analysis, t: number) {
  if (!solution.ok) return null;
  const phasor = getCurrentPhasor(entity, solution, analysis);
  if (!phasor) return null;
  if (analysis === "dc") return phasor.re;
  const omega = (solution as ACSolution).omega;
  return phasor.re * Math.cos(omega * t) - phasor.im * Math.sin(omega * t);
}

export function collectVoltagePhasors(entities: Entity[], ac: ACSolution, mode: PhasorMode): PhasorItem[] {
  if (!ac.ok) return [];

  if (mode === "components") {
    const items: PhasorItem[] = [];
    for (const entity of entities) {
      const ph = getVoltagePhasor(entity, ac, "ac");
      if (!ph || !Number.isFinite(cAbs(ph))) continue;
      const { nA, nB } = getTermNodes(entity, ac.nodeOf);
      const n1 = Math.min(nA, nB);
      const n2 = Math.max(nA, nB);
      const label = `V${n1}${n2} (${entity.label || entity.type})`;
      items.push({ label, ph, color: phasorColor(label) });
    }
    return items;
  }

  if (mode === "nodeGround") {
    return Array.from(new Set(ac.nodeOf.values()))
      .sort((a, b) => a - b)
      .filter((node) => node !== 0)
      .map((node) => ({
        label: `V${node}0`,
        ph: ac.V.get(node) || C0(0, 0),
        color: nodeColor(node),
      }));
  }

  const seen = new Set<string>();
  const items: PhasorItem[] = [];

  for (const entity of entities) {
    const { nA, nB } = getTermNodes(entity, ac.nodeOf);
    if (nA === nB) continue;
    const n1 = Math.min(nA, nB);
    const n2 = Math.max(nA, nB);
    const key = `${n1}-${n2}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const ph = cSub(ac.V.get(nA) || C0(0, 0), ac.V.get(nB) || C0(0, 0));
    const label = `V${n1}${n2}`;
    items.push({ label, ph, color: phasorColor(label) });
  }

  return items;
}

export function collectCurrentPhasors(entities: Entity[], ac: ACSolution, mode: PhasorMode): PhasorItem[] {
  if (!ac.ok) return [];

  if (mode === "components" || mode === "nodeGround") {
    const items: PhasorItem[] = [];
    for (const entity of entities) {
      if (entity.type === "vmeter") continue;
      const ph = getCurrentPhasor(entity, ac, "ac");
      if (!ph || !Number.isFinite(cAbs(ph))) continue;
      const label = entity.label || entity.type;
      items.push({ label, ph, color: phasorColor(label) });
    }
    return items;
  }

  const buckets = new Map<string, C>();
  const colors = new Map<string, string>();

  for (const entity of entities) {
    if (entity.type === "vmeter") continue;
    const ph = getCurrentPhasor(entity, ac, "ac");
    if (!ph || !Number.isFinite(cAbs(ph))) continue;

    const { nA, nB } = getTermNodes(entity, ac.nodeOf);
    if (nA === nB) continue;
    const n1 = Math.min(nA, nB);
    const n2 = Math.max(nA, nB);
    const key = `${n1}-${n2}`;
    buckets.set(key, cAdd(buckets.get(key) || C0(), ph));
    colors.set(key, phasorColor(`I-${key}`));
  }

  return Array.from(buckets.entries()).map(([key, ph]) => ({
    label: `I${key.replace("-", "")}`,
    ph,
    color: colors.get(key),
  }));
}

export function getMagnitudeAndAngle(phasor: C | null) {
  if (!phasor) return { magnitude: Number.NaN, angle: Number.NaN };
  return { magnitude: cAbs(phasor), angle: cArg(phasor) };
}
