import React, { useEffect, useMemo, useRef, useState } from "react";

// ================= Error Boundary =================
type ErrorBoundaryProps = React.PropsWithChildren<{}>;

class ErrorBoundary extends React.Component<ErrorBoundaryProps, { error: any }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("Preview runtime error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui', color: '#fff', background: '#1f2937', height: '100%' }}>
          <div style={{ background: '#991b1b', padding: 8, borderRadius: 8, marginBottom: 12 }}>Runtime error</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error && (this.state.error.message || this.state.error))}</pre>
          <div style={{ opacity: 0.8, marginTop: 8 }}>Open the browser console for full stack trace.</div>
        </div>
      );
    }
    return this.props.children as any;
  }
}


// ================= Types =================
type Wave = "dc" | "ac";
type EntityType =
  | "ground"
  | "resistor"
  | "capacitor"
  | "inductor"
  | "vsrc"
  | "isrc"
  | "vmeter"
  | "ameter";

type Entity = {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  rotation: number;
  label?: string;
  value?: string; // for R/C/L e.g. 1kΩ, 1µF, 10mH
  wave?: Wave;
  amplitude?: string;
  frequency?: string; // for sources
  phaseEnabled?: boolean;
  phase?: string; // AC only e.g. 30° or 0.52 rad
};

type Wire = { id: string; aTerm: string; bTerm: string };

type Terminal = { id: string; x: number; y: number; key: string; entityId: string };

type DCSolution =
  | { ok: true; nodeOf: Map<string, number>; V: Map<number, number>; vsIndexOf: Map<string, number>; Ivs: number[] }
  | { ok: false; reason: string; nodeOf: Map<string, number>; V: Map<number, number>; vsIndexOf: Map<string, number>; Ivs: number[] };

type C = { re: number; im: number };

type ACSolution =
  | { ok: true; nodeOf: Map<string, number>; V: Map<number, C>; vsIndexOf: Map<string, number>; Ivs: C[]; omega: number }
  | { ok: false; reason: string; nodeOf: Map<string, number>; V: Map<number, C>; vsIndexOf: Map<string, number>; Ivs: C[]; omega: number };

// ================= UI constants =================
const GRID = 16;
const CANVAS_W = 1200;
const CANVAS_H = 720;

const palette: { type: EntityType | "wire"; label: string }[] = [
  { type: "ground", label: "Ground" },
  { type: "resistor", label: "Resistor" },
  { type: "capacitor", label: "Capacitor" },
  { type: "inductor", label: "Inductor" },
  { type: "vsrc", label: "V Source" },
  { type: "isrc", label: "I Source" },
  { type: "vmeter", label: "Voltmeter" },
  { type: "ameter", label: "Ammeter" },
  { type: "wire", label: "Wire" },
];
type Tool = EntityType | "wire" | "select";
type Analysis = 'dc' | 'ac';

const niceId = () => Math.random().toString(36).slice(2, 9);

const DEFAULTS: Record<string, Partial<Entity>> = {
  resistor: { value: "1kΩ", label: "R" },
  capacitor: { value: "1µF", label: "C" },
  inductor: { value: "10mH", label: "L" },
  vsrc: { wave: "dc", amplitude: "5V", frequency: "1kHz", phaseEnabled: false, phase: "0°", label: "V" },
  isrc: { wave: "dc", amplitude: "10mA", frequency: "1kHz", phaseEnabled: false, phase: "0°", label: "I" },
  ground: { label: "GND" },
  vmeter: { label: "Vm" },
  ameter: { label: "Am" },
};

// ================= Helpers =================
function terminalsFor(type: EntityType) {
  if (type === "ground") return [{ key: "G", x: 0, y: -8 }];
  return [
    { key: "A", x: -32, y: 0 },
    { key: "B", x: 32, y: 0 }
  ];
}

function rotatePoint(x: number, y: number, rot: number) {
  const r = ((rot % 360) + 360) % 360;
  if (r === 0) return { x, y };
  if (r === 90) return { x: y, y: -x };
  if (r === 180) return { x: -x, y: -y };
  if (r === 270) return { x: -y, y: x };
  return { x, y };
}

function worldTerminals(entity: Entity): Terminal[] {
  const tdefs = terminalsFor(entity.type);
  return tdefs.map((t) => {
    const p = rotatePoint(t.x, t.y, entity.rotation || 0);
    return { id: entity.id + ":" + t.key, x: entity.x + p.x, y: entity.y + p.y, key: t.key, entityId: entity.id };
  });
}

const snap = (n: number) => Math.round(n / GRID) * GRID;

function useKey(handler: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handler(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}

// ================= SI parser =================
function parseSI(raw: string | null | undefined): number | null {
  if (!raw) return null;
  let s = String(raw).trim();
  s = s.replace(/\s+/g, "");
  s = s.replace("µ", "u");
  // remove trailing unit like V/A/Ω/F/H/R (ohms)
  if (/[VAΩFHR]$/i.test(s)) s = s.slice(0, -1);
  let factor = 1;
  const last = s.slice(-1);
  if ("pnumkMG".includes(last)) {
    s = s.slice(0, -1);
    if (last === "p") factor = 1e-12;
    else if (last === "n") factor = 1e-9;
    else if (last === "u") factor = 1e-6;
    else if (last === "m") factor = 1e-3;
    else if (last === "k") factor = 1e3;
    else if (last === "M") factor = 1e6;
    else if (last === "G") factor = 1e9;
  }
  const val = parseFloat(s);
  return isFinite(val) ? val * factor : null;
}

function parseHz(raw: string | null | undefined): number | null {
  if (!raw) return null;
  let s = String(raw).trim();
  s = s.replace(/\s+/g, "");
  s = s.replace(/µ/g, 'u');
  s = s.replace(/(Hz|hz)$/,'');
  s = s.replace(/(rad\/s)$/i,'');
  let factor = 1;
  const last = s.slice(-1);
  if ("pnumkMG".includes(last)) {
    s = s.slice(0, -1);
    if (last === "p") factor = 1e-12;
    else if (last === "n") factor = 1e-9;
    else if (last === "u") factor = 1e-6;
    else if (last === "m") factor = 1e-3;
    else if (last === "k") factor = 1e3;
    else if (last === "M") factor = 1e6;
    else if (last === "G") factor = 1e9;
  }
  const val = parseFloat(s);
  return isFinite(val) ? val * factor : null;
}

function parsePhase(raw: string | null | undefined): number {
  // radians
  if (!raw) return 0;
  const s = String(raw).trim();
  if (/deg|°/i.test(s)) {
    const num = parseFloat(s);
    return isFinite(num) ? (num * Math.PI) / 180 : 0;
  }
  if (/rad/i.test(s)) {
    const num = parseFloat(s);
    return isFinite(num) ? num : 0;
  }
  const num = parseFloat(s);
  return isFinite(num) ? (num * Math.PI) / 180 : 0; // default degrees if bare
}

// ================= Complex helpers =================
const C0 = (re=0, im=0): C => ({ re, im });
const cAdd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
const cSub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
const cMul = (a: C, b: C): C => ({ re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re });
const cDiv = (a: C, b: C): C => {
  const d = b.re*b.re + b.im*b.im;
  if (d === 0) return { re: NaN, im: NaN };
  return { re: (a.re*b.re + a.im*b.im)/d, im: (a.im*b.re - a.re*b.im)/d };
};
const cConj = (a: C): C => ({ re: a.re, im: -a.im });
const cAbs = (a: C): number => Math.hypot(a.re, a.im);
const cArg = (a: C): number => Math.atan2(a.im, a.re); // radians

// ================= Formatting =================
function trimZeros(s: string) {
  return s.replace(/(\.[0-9]*?)0+$/,'$1').replace(/\.$/,'');
}
function formatV(v: number) {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1) return sign + trimZeros(a.toFixed(3)) + " V";
  if (a >= 1e-3) return sign + trimZeros((a * 1e3).toFixed(3)) + " mV";
  if (a >= 1e-6) return sign + trimZeros((a * 1e6).toFixed(3)) + " µV";
  return sign + a.toExponential(2) + " V";
}
function formatI(v: number) {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1) return sign + trimZeros(a.toFixed(3)) + " A";
  if (a >= 1e-3) return sign + trimZeros((a * 1e3).toFixed(3)) + " mA";
  if (a >= 1e-6) return sign + trimZeros((a * 1e6).toFixed(3)) + " µA";
  if (a >= 1e-9) return sign + trimZeros((a * 1e9).toFixed(3)) + " nA";
  return sign + a.toExponential(2) + " A";
}
function formatDeg(rad: number) { return (rad * 180 / Math.PI).toFixed(1) + '°'; }

// ================= Colors & labeling helpers =================
const NODE_PALETTE = [
  '#4ade80','#60a5fa','#f472b6','#f59e0b','#34d399','#a78bfa','#f87171',
  '#22d3ee','#c084fc','#fb923c','#93c5fd','#fca5a5','#10b981','#e879f9'
];

function nodeColor(nid:number) {
  if (nid === 0) return '#e5e7eb'; // ground → light gray
  return NODE_PALETTE[(Math.abs(nid)*59) % NODE_PALETTE.length];
}

function phasorColor(key:string, fallback='#ffd60a') {
  let h=0; for (let i=0;i<key.length;i++) h=(h*31 + key.charCodeAt(i))|0;
  const i = Math.abs(h) % NODE_PALETTE.length;
  return NODE_PALETTE[i] || fallback;
}

// Auto-indexed labels
const TYPE_PREFIX: Partial<Record<EntityType,string>> = {
  resistor:'R', capacitor:'C', inductor:'L', vsrc:'V', isrc:'I', vmeter:'VM', ameter:'AM', ground:'GND'
};
function nextLabel(entities:Entity[], type:EntityType){
  const p = TYPE_PREFIX[type] || type.toUpperCase();
  if (type==='ground') return 'GND';
  const n = 1 + entities.filter(e=> (e.type===type) && (e.label||'').startsWith(p)).length;
  return `${p}${n}`;
}

// ================= Node map =================
function buildNodeMap(entities: Entity[], wires: Wire[], treatInductorAsShort: boolean): Map<string, number> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  wires.forEach((w) => add(w.aTerm, w.bTerm));
  if (treatInductorAsShort) {
    entities.filter((e) => e.type === "inductor").forEach((L) => {
      const ts = worldTerminals(L);
      if (ts.length === 2) add(ts[0].id, ts[1].id);
    });
  }

  const nodeOf = new Map<string, number>();
  const visited = new Set<string>();
  const allTerms: string[] = [];
  entities.forEach((e) => worldTerminals(e).forEach((t) => allTerms.push(t.id)));

  function bfsAssign(start: string, nid: number) {
    const q: string[] = [start];
    visited.add(start);
    nodeOf.set(start, nid);
    while (q.length) {
      const u = q.shift()!;
      const nbrs = adj.get(u);
      if (!nbrs) continue;
      for (const v of nbrs) if (!visited.has(v)) {
        visited.add(v);
        nodeOf.set(v, nid);
        q.push(v);
      }
    }
  }

  const groundTerms: string[] = [];
  entities.filter((e) => e.type === "ground").forEach((g) => {
    const t = worldTerminals(g)[0];
    if (t) groundTerms.push(t.id);
  });

  for (const tid of groundTerms) if (!visited.has(tid)) bfsAssign(tid, 0);

  let nid = 1;
  for (const tid of allTerms) if (!visited.has(tid)) bfsAssign(tid, nid++);
  return nodeOf;
}

// ================= Linear solvers =================
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let i = 0; i < n; i++) A[i] = A[i].slice(0, n).concat([b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if (Math.abs(A[p][i]) < 1e-12) return null;
    if (p !== i) { const tmp = A[i]; A[i] = A[p]; A[p] = tmp; }
    const piv = A[i][i];
    for (let c = i; c <= n; c++) A[i][c] /= piv;
    for (let r = 0; r < n; r++) if (r !== i) {
      const f = A[r][i];
      if (Math.abs(f) < 1e-16) continue;
      for (let c = i; c <= n; c++) A[r][c] -= f * A[i][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) x[i] = A[i][n];
  return x;
}

function solveLinearC(A: C[][], b: C[]): C[] | null {
  const n = b.length;
  for (let i = 0; i < n; i++) A[i] = A[i].slice(0, n).concat([b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (cAbs(A[r][i]) > cAbs(A[p][i])) p = r;
    if (cAbs(A[p][i]) < 1e-18) return null;
    if (p !== i) { const tmp = A[i]; A[i] = A[p]; A[p] = tmp; }
    const piv = A[i][i];
    for (let c = i; c <= n; c++) A[i][c] = cDiv(A[i][c], piv);
    for (let r = 0; r < n; r++) if (r !== i) {
      const f = A[r][i];
      if (cAbs(f) < 1e-18) continue;
      for (let c = i; c <= n; c++) A[r][c] = cSub(A[r][c], cMul(f, A[i][c]));
    }
  }
  const x = new Array(n).fill(C0());
  for (let i = 0; i < n; i++) x[i] = A[i][n];
  return x;
}

// ================= DC solver (MNA) =================
function solveDC(entities: Entity[], wires: Wire[]): DCSolution {
  const nodeOf = buildNodeMap(entities, wires, /*treatLAsShort*/ true);
  const hasGND = entities.some((e) => e.type === "ground");
  const nodes = Array.from(new Set(Array.from(nodeOf.values()))).sort((a, b) => a - b);
  const nonGround = nodes.filter((n) => n !== 0);
  const nodeIndex = new Map<number, number>();
  nonGround.forEach((n, i) => nodeIndex.set(n, i));

  const vDC = entities.filter((e) => e.type === "vsrc" && e.wave !== "ac");
  const M = vDC.length;
  const vsIndexOf = new Map<string, number>();
  vDC.forEach((e, k) => vsIndexOf.set(e.id, k));

  const N = nonGround.length;
  const G: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const I: number[] = new Array(N).fill(0);
  const B: number[][] = Array.from({ length: N }, () => new Array(M).fill(0));
  const E: number[] = new Array(M).fill(0);

  const idx = (node: number | undefined): number | null => {
    if (node === undefined || node === 0) return null;
    const i = nodeIndex.get(node as number);
    return typeof i === "number" ? i : null;
  };

  function stampRes(n1: number | undefined, n2: number | undefined, R: number) {
    if (!isFinite(R) || R <= 0) return;
    const g = 1 / R;
    const i1 = idx(n1), i2 = idx(n2);
    if (i1 !== null) G[i1][i1] += g;
    if (i2 !== null) G[i2][i2] += g;
    if (i1 !== null && i2 !== null) {
      G[i1][i2] -= g;
      G[i2][i1] -= g;
    }
  }

  function stampIsrc(nPos: number | undefined, nNeg: number | undefined, Iamp: number) {
    const iP = idx(nPos), iN = idx(nNeg);
    if (iP !== null) I[iP] += Iamp;
    if (iN !== null) I[iN] -= Iamp;
  }

  function stampVsrc(k: number, nPos: number | undefined, nNeg: number | undefined, Vval: number) {
    const iP = idx(nPos), iN = idx(nNeg);
    if (iP !== null) B[iP][k] += 1;
    if (iN !== null) B[iN][k] -= 1;
    E[k] = Vval;
  }

  const termNode = new Map<string, number>();
  entities.forEach((e) => worldTerminals(e).forEach((t) => termNode.set(t.id, nodeOf.get(t.id)!)));

  // specific pre-checks
  for (const e of vDC) {
    const ts = worldTerminals(e);
    const nA = termNode.get(ts[0].id);
    const nB = termNode.get(ts[1].id);
    if (nA === nB) return { ok: false, reason: `Voltage source '${e.label || 'V'}' is shorted (both pins on node ${nA}).`, nodeOf, V: new Map(), vsIndexOf, Ivs: [] };
  }

  if (!hasGND) return { ok: false, reason: "No GND placed (add a ground symbol)", nodeOf, V: new Map(), vsIndexOf, Ivs: [] };

  const AMMETER_R = 1e-6; // ~short
  for (const e of entities) {
    if (e.type === "resistor") {
      const ts = worldTerminals(e);
      const R = parseSI(e.value || "1k");
      if (R !== null) stampRes(termNode.get(ts[0].id), termNode.get(ts[1].id), R);
    } else if (e.type === "capacitor") {
      /* open in DC */
    } else if (e.type === "inductor") {
      /* short handled in node map */
    } else if (e.type === "isrc") {
      if (e.wave === "ac") continue;
      const ts = worldTerminals(e);
      const Iamp = parseSI(e.amplitude || "0");
      const nP = termNode.get(ts[0].id);
      const nN = termNode.get(ts[1].id);
      if (Iamp !== null) stampIsrc(nP, nN, Iamp);
    } else if (e.type === "vsrc") {
      if (e.wave === "ac") continue;
      const ts = worldTerminals(e);
      const Vv = parseSI(e.amplitude || "0");
      const k = vsIndexOf.get(e.id)!;
      if (Vv !== null) stampVsrc(k, termNode.get(ts[0].id), termNode.get(ts[1].id), Vv);
    } else if (e.type === "ameter") {
      const ts = worldTerminals(e);
      stampRes(termNode.get(ts[0].id), termNode.get(ts[1].id), AMMETER_R);
    } else if (e.type === "vmeter") {
      /* ideal open */
    }
  }

  const Ntot = N + M;
  const A: number[][] = Array.from({ length: Ntot }, () => new Array(Ntot).fill(0));
  const rhs: number[] = new Array(Ntot).fill(0);

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) A[r][c] = G[r][c];
    for (let k = 0; k < M; k++) A[r][N + k] = B[r][k];
    rhs[r] = I[r];
  }
  for (let k = 0; k < M; k++) {
    for (let c = 0; c < N; c++) A[N + k][c] = B[c][k];
    rhs[N + k] = E[k];
  }

  const x = solveLinear(A, rhs);
  if (!x) return { ok: false, reason: "Singular system (check for shorts or opens; make sure the loop closes)", nodeOf, V: new Map(), vsIndexOf, Ivs: [] };

  const V = new Map<number, number>();
  for (let i = 0; i < N; i++) V.set(nonGround[i], x[i]);
  V.set(0, 0);
  const Ivs = x.slice(N);
  return { ok: true, nodeOf, V, vsIndexOf, Ivs };
}

// ================= AC solver (phasor MNA) =================
function solveAC(entities: Entity[], wires: Wire[], freqDefaultHz: number): ACSolution {
  // pick omega: if any AC source has frequency, they must match; else use freqDefaultHz
  const acSrcs = entities.filter(e => (e.type === 'vsrc' || e.type === 'isrc') && e.wave === 'ac');
  let freq = freqDefaultHz;
  const found: number[] = [];
  for (const s of acSrcs) {
    const f = parseHz(s.frequency || '');
    if (f && isFinite(f)) found.push(f);
  }
  if (found.length > 0) {
    const f0 = found[0];
    const mismatch = found.some(f => Math.abs(f - f0) > 1e-9);
    if (mismatch) return { ok: false, reason: 'All AC sources must share the same frequency.', nodeOf: new Map(), V: new Map(), vsIndexOf: new Map(), Ivs: [], omega: 0 };
    freq = f0;
  }
  if (!freq || !isFinite(freq) || freq <= 0) return { ok: false, reason: 'AC frequency must be > 0 Hz.', nodeOf: new Map(), V: new Map(), vsIndexOf: new Map(), Ivs: [], omega: 0 };

  const omega = 2 * Math.PI * freq;
  const nodeOf = buildNodeMap(entities, wires, /*treatLAsShort*/ false);
  const hasGND = entities.some((e) => e.type === "ground");
  const nodes = Array.from(new Set(Array.from(nodeOf.values()))).sort((a, b) => a - b);
  const nonGround = nodes.filter((n) => n !== 0);
  const nodeIndex = new Map<number, number>();
  nonGround.forEach((n, i) => nodeIndex.set(n, i));

  const vSRCs = entities.filter((e) => e.type === "vsrc");
  const M = vSRCs.length;
  const vsIndexOf = new Map<string, number>();
  vSRCs.forEach((e, k) => vsIndexOf.set(e.id, k));

  const N = nonGround.length;
  const G: C[][] = Array.from({ length: N }, () => new Array(N).fill(C0()));
  const I: C[] = new Array(N).fill(C0());
  const B: C[][] = Array.from({ length: N }, () => new Array(M).fill(C0()));
  const E: C[] = new Array(M).fill(C0());

  const idx = (node: number | undefined): number | null => {
    if (node === undefined || node === 0) return null;
    const i = nodeIndex.get(node as number);
    return typeof i === "number" ? i : null;
  };

  function stampAdmittance(n1: number | undefined, n2: number | undefined, Y: C) {
    const i1 = idx(n1), i2 = idx(n2);
    if (i1 !== null) G[i1][i1] = cAdd(G[i1][i1], Y);
    if (i2 !== null) G[i2][i2] = cAdd(G[i2][i2], Y);
    if (i1 !== null && i2 !== null) {
      G[i1][i2] = cSub(G[i1][i2], Y);
      G[i2][i1] = cSub(G[i2][i1], Y);
    }
  }
  function stampIsrc(nPos: number | undefined, nNeg: number | undefined, Iph: C) {
    const iP = idx(nPos), iN = idx(nNeg);
    if (iP !== null) I[iP] = cAdd(I[iP], Iph);
    if (iN !== null) I[iN] = cSub(I[iN], Iph);
  }
  function stampVsrc(k: number, nPos: number | undefined, nNeg: number | undefined, Vph: C) {
    const iP = idx(nPos), iN = idx(nNeg);
    if (iP !== null) B[iP][k] = cAdd(B[iP][k], C0(1,0));
    if (iN !== null) B[iN][k] = cSub(B[iN][k], C0(1,0));
    E[k] = Vph;
  }

  const j = C0(0, 1);
  const termNode = new Map<string, number>();
  entities.forEach((e) => worldTerminals(e).forEach((t) => termNode.set(t.id, nodeOf.get(t.id)!)));

  if (!hasGND) return { ok: false, reason: 'No GND placed (add a ground symbol)', nodeOf, V: new Map(), vsIndexOf, Ivs: [], omega };

  // Stamp components
  const AMMETER_R = 1e-6; // ~short
  for (const e of entities) {
    const ts = worldTerminals(e);
    const n1 = termNode.get(ts[0]?.id || '');
    const n2 = termNode.get(ts[1]?.id || '');
    if (e.type === 'resistor') {
      const R = parseSI(e.value || '1k');
      if (R && R > 0) stampAdmittance(n1, n2, C0(1/R, 0));
    } else if (e.type === 'capacitor') {
      const Cval = parseSI(e.value || '1u');
      if (Cval && Cval > 0) stampAdmittance(n1, n2, cMul(j, C0(omega*Cval, 0)));
    } else if (e.type === 'inductor') {
      const L = parseSI(e.value || '10m');
      if (L && L > 0) {
        const Y = cDiv(C0(1,0), cMul(j, C0(omega*L, 0)));
        stampAdmittance(n1, n2, Y);
      }
    } else if (e.type === 'ameter') {
      stampAdmittance(n1, n2, C0(1/AMMETER_R, 0));
    } else if (e.type === 'vmeter') {
      /* ideal open circuit */
    } else if (e.type === 'isrc') {
      if (e.wave === 'ac') {
        const Iamp = parseSI(e.amplitude || '0') || 0;
        const ph = parsePhase(e.phaseEnabled ? e.phase : '0');
        const Iph = C0(Iamp*Math.cos(ph), Iamp*Math.sin(ph));
        stampIsrc(n1, n2, Iph);
      }
      // DC current sources are open in AC small-signal → contribute 0
    }
  }

  for (const e of vSRCs) {
    const ts = worldTerminals(e);
    const n1 = termNode.get(ts[0]?.id || ''), n2 = termNode.get(ts[1]?.id || '');
    let Vph = C0(0,0);
    if (e.wave === 'ac') {
      const Vamp = parseSI(e.amplitude || '0') || 0;
      const ph = parsePhase(e.phaseEnabled ? e.phase : '0');
      Vph = C0(Vamp*Math.cos(ph), Vamp*Math.sin(ph));
    }
    // DC voltage source acts as short for AC small-signal ⇒ V=0 still imposes equality via MNA rows
    const k = vsIndexOf.get(e.id)!;
    stampVsrc(k, n1, n2, Vph);
  }

  const Ntot = N + M;
  const A: C[][] = Array.from({ length: Ntot }, () => new Array(Ntot).fill(C0()));
  const rhs: C[] = new Array(Ntot).fill(C0());

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) A[r][c] = G[r][c];
    for (let k = 0; k < M; k++) A[r][N + k] = B[r][k];
    rhs[r] = I[r];
  }
  for (let k = 0; k < M; k++) {
    for (let c = 0; c < N; c++) A[N + k][c] = B[c][k];
    rhs[N + k] = E[k];
  }

  const x = solveLinearC(A, rhs);
  if (!x) return { ok: false, reason: 'Singular (check shorts/opens or missing frequency)', nodeOf, V: new Map(), vsIndexOf, Ivs: [], omega };

  const V = new Map<number, C>();
  for (let i = 0; i < N; i++) V.set(nonGround[i], x[i]);
  V.set(0, C0(0,0));
  const Ivs = x.slice(N);
  return { ok: true, nodeOf, V, vsIndexOf, Ivs, omega };
}

// ================= Drawing helpers =================
function drawLabel(e: Entity) {
  return (
    <text x={e.x} y={e.y - 18} textAnchor="middle" fontSize={10} fill="#c7d2fe" style={{ userSelect: 'none' }}>
      {e.label || e.type.toUpperCase()}
    </text>
  );
}

function EntityIcon({ e }: { e: Entity }) {
  const t = worldTerminals(e);
  const [A,B] = t;
  const g = [] as any[];

  if (e.type === 'ground') {
    const x = e.x, y = e.y;
    g.push(<line key="g1" x1={x} y1={y-8} x2={x} y2={y} stroke="#9fb0d0" strokeWidth={2}/>);
    g.push(<line key="g2" x1={x-8} y1={y} x2={x+8} y2={y} stroke="#9fb0d0" strokeWidth={2}/>);
    g.push(<line key="g3" x1={x-6} y1={y+4} x2={x+6} y2={y+4} stroke="#9fb0d0" strokeWidth={2}/>);
    g.push(<line key="g4" x1={x-4} y1={y+8} x2={x+4} y2={y+8} stroke="#9fb0d0" strokeWidth={2}/>);
  } else if (e.type === 'resistor') {
    const w = 36, h = 12;
    const cx = e.x, cy = e.y;
    g.push(<line key="r1" x1={A.x} y1={A.y} x2={cx - w/2} y2={cy} stroke="#9fb0d0" strokeWidth={2}/>);
    g.push(<rect key="r2" x={cx - w/2} y={cy - h/2} width={w} height={h} fill="#314070" stroke="#9fb0d0"/>);
    g.push(<line key="r3" x1={cx + w/2} y1={cy} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2}/>);
  } else if (e.type === 'capacitor') {
    const cx = e.x, cy = e.y;
    const gap = 8;
    const plate = 10;
    g.push(<line key="c1" x1={A.x} y1={A.y} x2={cx - gap} y2={cy} stroke="#9fb0d0" strokeWidth={2}/>);
    g.push(<line key="c2" x1={cx - gap} y1={cy - plate} x2={cx - gap} y2={cy + plate} stroke="#9fb0d0" strokeWidth={2}/>);
    g.push(<line key="c3" x1={cx + gap} y1={cy - plate} x2={cx + gap} y2={cy + plate} stroke="#9fb0d0" strokeWidth={2}/>);
    g.push(<line key="c4" x1={cx + gap} y1={cy} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2}/>);
  } else if (e.type === 'inductor') {
    const cx = e.x, cy = e.y;
    const r = 6;
    const k = 4;
    g.push(<line key="l1" x1={A.x} y1={A.y} x2={cx - (k*r)} y2={cy} stroke="#9fb0d0" strokeWidth={2}/>);
    for (let i=0;i<k;i++) {
      const x = cx - (k-1)*r + i*2*r;
      g.push(<path key={'arc'+i} d={`M ${x-r} ${cy} a ${r} ${r} 0 1 0 ${2*r} 0`} fill="none" stroke="#9fb0d0" strokeWidth={2}/>);
    }
    g.push(<line key="l2" x1={cx + (k*r)} y1={cy} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2}/>);
  } else if (e.type === 'vsrc' || e.type === 'isrc') {
    const cx = e.x, cy = e.y;
    const r = 14;
    g.push(<line key="s1" x1={A.x} y1={A.y} x2={cx - r} y2={cy} stroke="#9fb0d0" strokeWidth={2}/>);
    g.push(<circle key="s2" cx={cx} cy={cy} r={r} fill="#0b1020" stroke="#9fb0d0"/>);
    if (e.type === 'vsrc') {
      g.push(<text key="pl" x={cx-5} y={cy-2} fontSize={12} fill="#9fb0d0">+</text>);
      g.push(<text key="mi" x={cx+2} y={cy+10} fontSize={12} fill="#9fb0d0">−</text>);
    } else {
      g.push(<polygon key="arr" points={`${cx-4},${cy} ${cx+4},${cy} ${cx},${cy-8}`} fill="#9fb0d0"/>);
    }
    g.push(<line key="s3" x1={cx + r} y1={cy} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2}/>);
  } else if (e.type === 'vmeter' || e.type === 'ameter') {
    const cx = e.x, cy = e.y;
    const r = 14;
    g.push(<line key="m1" x1={A.x} y1={A.y} x2={cx - r} y2={cy} stroke="#9fb0d0" strokeWidth={2}/>);
    g.push(<circle key="m2" cx={cx} cy={cy} r={r} fill="#0b1020" stroke="#ffd60a"/>);
    g.push(<text key="mt" x={cx} y={cy+4} textAnchor="middle" fontSize={12} fill="#ffd60a">{e.type==='vmeter'?'V':'A'}</text>);
    g.push(<line key="m3" x1={cx + r} y1={cy} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2}/>);
  }

  return <g>{g}{drawLabel(e)}</g>;
}

// Flow/selection wrapper
function EntityView(props: {
  entity: Entity;
  selected: boolean;
  onMouseDown: (e: Entity, ev: React.MouseEvent) => void;
  onClick: () => void;
  running: boolean;
  t: number;
  current: number | null;
  voltage: number | null;
}) {
  const { entity: e, selected, onMouseDown, onClick, running, t, current } = props;
  const ts = worldTerminals(e);
  const A = ts[0], B = ts[1];
  const flow = current ?? 0;
  const dir = Math.sign(flow) || 1;
  const dash = 10;
  const offset = ((t * 60) * dir) % (dash * 2);

  return (
    <g
      onMouseDown={(ev)=>onMouseDown(e, ev)}
      onClick={(ev)=>{
        ev.stopPropagation();
        onClick();
      }}
      style={{ cursor: 'move' }}
    >
      {selected && (<rect x={e.x-26} y={e.y-26} width={52} height={52} fill="none" stroke="#ffd60a" strokeDasharray="4 3" />)}
      {running && A && B && isFinite(flow) && Math.abs(flow) > 0 && (
        <line
          x1={A.x} y1={A.y} x2={B.x} y2={B.y}
          stroke="#ffd60a" strokeWidth={3}
          strokeDasharray={`${dash} ${dash}`}
          strokeDashoffset={offset}
          opacity={0.6}
        />
      )}
      <EntityIcon e={e} />
    </g>
  );
}

// ===== Minimal Editor panel =====
function Editor({ entity, updateSelected }: { entity: Entity; updateSelected: (p: Partial<Entity>) => void }) {
  const isSource = entity.type === 'vsrc' || entity.type === 'isrc';
  const isPassive = entity.type === 'resistor' || entity.type === 'capacitor' || entity.type === 'inductor';

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-20 opacity-70">Label</div>
        <input
          className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1"
          value={entity.label||''}
          onChange={(e)=>updateSelected({ label: (e.target as HTMLInputElement).value })}
        />
      </div>

      {isPassive && (
        <div className="flex items-center gap-2">
          <div className="w-20 opacity-70">Value</div>
          <input
            className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1"
            placeholder={entity.type==='resistor'?'1kΩ':entity.type==='capacitor'?'1µF':'10mH'}
            value={entity.value||''}
            onChange={(e)=>updateSelected({ value: (e.target as HTMLInputElement).value })}
          />
        </div>
      )}

      {isSource && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-20 opacity-70">Wave</div>
            <select
              className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1"
              value={entity.wave||'dc'}
              onChange={(e)=>updateSelected({ wave: (e.target as HTMLSelectElement).value as Wave })}
            >
              <option value="dc">DC</option>
              <option value="ac">AC</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-20 opacity-70">Amplitude</div>
            <input
              className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1"
              placeholder={entity.type==='vsrc'?'5V':'10mA'}
              value={entity.amplitude||''}
              onChange={(e)=>updateSelected({ amplitude: (e.target as HTMLInputElement).value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="w-20 opacity-70">Frequency</div>
            <input
              className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1"
              placeholder="1kHz"
              value={entity.frequency||''}
              onChange={(e)=>updateSelected({ frequency: (e.target as HTMLInputElement).value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!entity.phaseEnabled}
                onChange={(e)=>updateSelected({ phaseEnabled: e.currentTarget.checked })}
              />
              Use phase
            </label>
            <input
              className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1"
              placeholder="30°"
              disabled={!entity.phaseEnabled}
              value={entity.phase||''}
              onChange={(e)=>updateSelected({ phase: (e.target as HTMLInputElement).value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ===== Results panel =====
function ResultsPanel({ entity, sol, analysis }: { entity: Entity; sol: any; analysis: Analysis }) {
  function vPh(): C | null {
    const ts = worldTerminals(entity);
    if (ts.length < 2) return C0(0,0);
    const nA = sol.nodeOf.get(ts[0].id) || 0;
    const nB = sol.nodeOf.get(ts[1].id) || 0;
    if (!sol.ok) return null;
    if (analysis === 'dc') {
      const Va = sol.V.get(nA) || 0;
      const Vb = sol.V.get(nB) || 0;
      return C0(Va - Vb, 0);
    }
    const Va = sol.V.get(nA) || C0(0,0);
    const Vb = sol.V.get(nB) || C0(0,0);
    return cSub(Va, Vb);
  }

  function iPh(): C | null {
    if (!sol.ok) return null;
    const ts = worldTerminals(entity);
    const nA = sol.nodeOf.get(ts[0]?.id || '');
    const nB = sol.nodeOf.get(ts[1]?.id || '');
    if (analysis === 'dc') {
      if (entity.type === 'vmeter') return C0(0,0);
      const Va = nA != null ? (sol.V.get(nA) || 0) : 0;
      const Vb = nB != null ? (sol.V.get(nB) || 0) : 0;
      const Vab = Va - Vb;
      if (entity.type === 'resistor') {
        const R = parseSI(entity.value || '1k') || 1e9;
        return C0(Vab / R, 0);
      }
      if (entity.type === 'vsrc') {
        const idx = sol.vsIndexOf.get(entity.id);
        if (idx === undefined) return C0(0,0);
        const I = sol.Ivs[idx] || 0;
        return C0(I, 0);
      }
      if (entity.type === 'isrc') {
        const Iamp = parseSI(entity.amplitude || '0') || 0;
        return C0(Iamp, 0);
      }
      if (entity.type === 'ameter') {
        const AMMETER_R = 1e-6;
        return C0(Vab / AMMETER_R, 0);
      }
      return C0(0,0);
    } else {
      const Va = nA != null ? (sol.V.get(nA) || C0(0,0)) : C0(0,0);
      const Vb = nB != null ? (sol.V.get(nB) || C0(0,0)) : C0(0,0);
      const Vab = cSub(Va, Vb);
      const w = (sol.omega as number) || 0;

      if (entity.type === 'resistor') {
        const R = parseSI(entity.value || '1k') || 1e9;
        return C0(Vab.re / R, Vab.im / R);
      }
      if (entity.type === 'capacitor') {
        const Cval = parseSI(entity.value || '1u') || 0;
        return cMul(C0(0,w*Cval), Vab);
      }
      if (entity.type === 'inductor') {
        const L = parseSI(entity.value || '10m') || 0;
        const Y = cDiv(C0(1,0), C0(0,w*L));
        return cMul(Y, Vab);
      }
      if (entity.type === 'vsrc') {
        const idx = sol.vsIndexOf.get(entity.id);
        if (idx === undefined) return C0(0,0);
        return sol.Ivs[idx] || C0(0,0);
      }
      if (entity.type === 'isrc') {
        if (entity.wave === 'ac') {
          const Iamp = parseSI(entity.amplitude || '0') || 0;
          const ph = parsePhase(entity.phaseEnabled ? entity.phase : '0');
          return C0(Iamp*Math.cos(ph), Iamp*Math.sin(ph));
        }
        return C0(0,0);
      }
      if (entity.type === 'ameter') {
        const AMMETER_R = 1e-6;
        return C0(Vab.re / AMMETER_R, Vab.im / AMMETER_R);
      }
      return C0(0,0);
    }
  }

  if (!sol.ok) return <div className="text-xs text-[#ffadad]">{sol.reason || 'Not solved'}</div>;

  if (analysis === 'dc') {
    const v = vPh();
    const i = iPh();
    const V = v? v.re : NaN;
    const I = i? i.re : NaN;
    return <div className="text-sm"><div>V<sub>AB</sub>: <b>{isFinite(V)?formatV(V):'—'}</b></div><div>I: <b>{isFinite(I)?formatI(I):'—'}</b></div></div>;
  } else {
    const v = vPh();
    const i = iPh();
    const Vm = v? cAbs(v):NaN;
    const Va = v? cArg(v):NaN;
    const Im = i? cAbs(i):NaN;
    const Ia = i? cArg(i):NaN;
    return <div className="text-sm"><div>V: <b>{isFinite(Vm)?formatV(Vm):'—'}</b> • ∠ {isFinite(Va)?formatDeg(Va):'—'}</div><div>I: <b>{isFinite(Im)?formatI(Im):'—'}</b> • ∠ {isFinite(Ia)?formatDeg(Ia):'—'}</div></div>;
  }
}

// ================= Simple live chart =================
function TraceChart({ points, unit, width = 560, height = 160 }: { points: { t: number; v: number }[]; unit: 'V' | 'A'; width?: number; height?: number }) {
  const padL = 34, padR = 6, padT = 10, padB = 20;
  const W = width - padL - padR;
  const H = height - padT - padB;

  const n = points.length;
  const t0 = n ? points[0].t : 0;
  const t1 = n ? points[n - 1].t : 1;

  const vMin0 = n ? Math.min(...points.map(p => p.v)) : 0;
  const vMax0 = n ? Math.max(...points.map(p => p.v)) : 1;
  const epsV = Math.max(1e-9, Math.abs(vMax0 || 1) * 0.02);
  const vMin = vMin0 === vMax0 ? vMin0 - epsV : vMin0;
  const vMax = vMin0 === vMax0 ? vMax0 + epsV : vMax0;

  const dt = Math.max(1e-6, t1 - t0);
  const mapX = (t: number) => padL + ((t - t0) / dt) * W;
  const mapY = (v: number) => padT + (1 - (v - vMin) / (vMax - vMin)) * H;

  const d = n ? points.map(p => `${mapX(p.t)},${mapY(p.v)}`).join(' ') : '';

  const ticks = 4;
  const yTicks = Array.from({length: ticks + 1}, (_,i)=> vMin + (i*(vMax-vMin)/ticks));
  const xTicks = Array.from({length: ticks + 1}, (_,i)=> t0 + (i*dt/ticks));

  return (
    <svg width={width} height={height} className="block mx-auto">
      <rect x={0} y={0} width={width} height={height} fill="#0c1430" rx={8} />
      <line x1={padL} y1={padT} x2={padL} y2={padT + H} stroke="#ffffff22" />
      <line x1={padL} y1={padT + H} x2={padL + W} y2={padT + H} stroke="#ffffff22" />
      {yTicks.map((v, i) => (
        <g key={'y'+i}>
          <line x1={padL} y1={mapY(v)} x2={padL + W} y2={mapY(v)} stroke="#ffffff10" />
          <text x={padL - 6} y={mapY(v) + 3} fontSize={10} fill="#9fb0d0" textAnchor="end">{unit === 'V' ? formatV(v) : formatI(v)}</text>
        </g>
      ))}
      {xTicks.map((t, i) => (
        <g key={'x'+i}>
          <line x1={mapX(t)} y1={padT} x2={mapX(t)} y2={padT + H} stroke="#ffffff10" />
          <text x={mapX(t)} y={padT + H + 12} fontSize={10} fill="#9fb0d0" textAnchor="middle">{(t - t0).toFixed(1)}s</text>
        </g>
      ))}
      {n > 0 && <polyline points={d} fill="none" stroke="#ffd60a" strokeWidth={2} />}
      <text x={padL + W/2} y={height - 4} fontSize={10} fill="#9fb0d0" textAnchor="middle">time (s)</text>
      <text x={8} y={12} fontSize={10} fill="#9fb0d0">{unit}</text>
    </svg>
  );
}

// ================= Phasor UI =================
function PhasorTabs({
  Vlist, Ilist, mode, setMode
}: {
  Vlist: {label:string; ph:C; color?:string}[];
  Ilist: {label:string; ph:C; color?:string}[];
  mode: 'components'|'nodeGround'|'nodePairs';
  setMode: (m:'components'|'nodeGround'|'nodePairs')=>void;
}) {
  const [tab, setTab] = useState<'V'|'I'>('V');
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button className={"px-3 py-1 rounded-lg border " + (tab==='V' ? 'bg-white/10 border-white/30' : 'border-white/10 hover:border-white/30')} onClick={()=>setTab('V')}>Voltages</button>
        <button className={"px-3 py-1 rounded-lg border " + (tab==='I' ? 'bg-white/10 border-white/30' : 'border-white/10 hover:border-white/30')} onClick={()=>setTab('I')}>Currents</button>
        <span className="ml-4 text-xs opacity-70">View:</span>
        <select
          className="bg-black/20 border border-white/10 rounded px-2 py-1 text-sm"
          value={mode}
          onChange={(e)=>setMode(e.target.value as any)}
          title="How to organize phasors"
        >
          <option value="components">Separate (per component)</option>
          <option value="nodeGround">Structured (node vs ground)</option>
          <option value="nodePairs">Node pairs (adjacent)</option>
        </select>
      </div>
      <PhasorPlot items={tab==='V'?Vlist:Ilist} unit={tab==='V'?'V':'A'} />
      <PhasorLegend items={tab==='V'?Vlist:Ilist} unit={tab==='V'?'V':'A'} />
    </div>
  );
}

function PhasorPlot({ items, unit, width=700, height=420 }: { items: {label:string; ph:C; color?:string}[]; unit: 'V'|'A'; width?: number; height?: number }) {
  const mags = items.map(it => cAbs(it.ph));
  const maxMag = Math.max(1e-12, ...mags);
  const margin = 40;
  const cx = width/2, cy = height/2;
  const R = Math.min(width, height)/2 - margin;
  const scale = (val:number) => (val / maxMag) * R;
  const radial = (ph:C) => {
    const r = scale(cAbs(ph));
    const ang = cArg(ph);
    return { x: cx + r*Math.cos(ang), y: cy - r*Math.sin(ang) };
  };
  const polarTicks = [0, Math.PI/2, Math.PI, -Math.PI/2];

  return (
    <svg width={width} height={height} className="block mx-auto">
      <rect x={0} y={0} width={width} height={height} fill="#0c1430" rx={8} />
      <line x1={margin/2} y1={cy} x2={width-margin/2} y2={cy} stroke="#ffffff22" />
      <line x1={cx} y1={margin/2} x2={cx} y2={height-margin/2} stroke="#ffffff22" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#ffffff10" />
      <circle cx={cx} cy={cy} r={R*0.5} fill="none" stroke="#ffffff10" />
      {polarTicks.map((a,i)=> (
        <g key={i}>
          <line x1={cx} y1={cy} x2={cx + R*Math.cos(a)} y2={cy - R*Math.sin(a)} stroke="#ffffff08" />
          <text x={cx + (R+12)*Math.cos(a)} y={cy - (R+12)*Math.sin(a)} fontSize={10} fill="#9fb0d0" textAnchor="middle">{formatDeg(a)}</text>
        </g>
      ))}
      {items.map((it, idx) => {
        const tip = radial(it.ph);
        const col = it.color || phasorColor(it.label);
        return (
          <g key={idx}>
            <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={col} strokeWidth={2} />
            <circle cx={tip.x} cy={tip.y} r={3} fill={col} />
            <text x={tip.x} y={tip.y} fontSize={10} fill={col} dx={5} dy={-4}>{it.label}</text>
          </g>
        );
      })}
      <text x={8} y={16} fontSize={10} fill="#9fb0d0">max |{unit}| = {unit==='V'?formatV(maxMag):formatI(maxMag)}</text>
    </svg>
  );
}

function PhasorLegend({ items, unit }: { items: {label:string; ph:C; color?:string}[]; unit: 'V'|'A' }) {
  const rows = items
    .map(it => ({ label: it.label, mag: cAbs(it.ph), ang: cArg(it.ph), color: it.color || phasorColor(it.label) }))
    .sort((a,b)=> b.mag - a.mag)
    .slice(0, 24);

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/80">
      {rows.map((r,i)=> (
        <div key={i} className="bg-white/5 rounded-lg p-2 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate pr-2">
            <span style={{background:r.color,width:10,height:10,borderRadius:3,display:'inline-block'}} />
            <span className="truncate">{r.label}</span>
          </div>
          <div className="text-right whitespace-nowrap">
            {unit==='V'?formatV(r.mag):formatI(r.mag)} • {formatDeg(r.ang)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ================= App =================
export default function App() {
  const [tool, setTool] = useState<Tool>("select");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selected, setSelected] = useState<{ kind: null | "entity" | "wire"; id: string | null }>({ kind: null, id: null });
  const [pendingWire, setPendingWire] = useState<{ aTerm: string } | null>(null);
  const [hoverTerm, setHoverTerm] = useState<Terminal | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [running, setRunning] = useState(false);
  const [t, setT] = useState(0);
  const rafRef = useRef<number | null>(null);
  const [showNodes, setShowNodes] = useState(false);
  const [meterViewId, setMeterViewId] = useState<string | null>(null);
  const [trace, setTrace] = useState<Array<{ t: number; v: number }>>([]);
  const [analysis, setAnalysis] = useState<Analysis>('dc');
  const [acFreq, setAcFreq] = useState<string>('1kHz');
  const [phasorOpen, setPhasorOpen] = useState(false);
  const [phasorMode, setPhasorMode] = useState<'components'|'nodeGround'|'nodePairs'>('components');

  // Build fast terminal lookup
  const termIndex = useMemo(() => {
    const map = new Map<string, Terminal>();
    entities.forEach((e) => worldTerminals(e).forEach((t) => map.set(t.id, t)));
    return map;
  }, [entities]);

  const dc = useMemo(() => solveDC(entities, wires), [entities, wires]);
  const ac = useMemo(() => solveAC(entities, wires, parseHz(acFreq) || 1000), [entities, wires, acFreq]);
  const sol = analysis === 'dc' ? dc : ac;

  // time loop when running (used also to animate AC instantaneous values)
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setT((v) => v + dt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  // reset trace when opening a meter
  useEffect(() => {
    if (meterViewId) setTrace([]);
  }, [meterViewId]);

  // sample the selected meter each frame while overlay is open
  useEffect(() => {
    if (!meterViewId || !sol.ok) return;
    const ent = entities.find(x => x.id === meterViewId);
    if (!ent) return;
    const isV = ent.type === 'vmeter';
    const val = isV ? voltageInstant(ent) : currentInstant(ent);
    if (val == null || !isFinite(val)) return;

    setTrace((arr) => {
      const p = { t, v: val };
      const next = arr.length > 0 && arr[arr.length - 1].t === p.t ? arr.slice(0, -1).concat(p) : arr.concat(p);
      const MAX = 600;
      return next.length > MAX ? next.slice(next.length - MAX) : next;
    });
  }, [t, meterViewId, entities, wires, analysis, (sol as any).ok]);

  useKey((e) => {
    const ae: any = document.activeElement;
    const tag = ae && ae.tagName;
    const isField = ae && (ae.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");
    if (isField) return;

    if (e.key.toLowerCase() === "r" && selected.kind === "entity") {
      e.preventDefault();
      rotateSelected();
    }
    if (e.key === "Enter" && selected.kind === "entity" && selected.id) {
      const ent = entities.find(x => x.id === selected.id);
      if (ent && (ent.type === 'vmeter' || ent.type === 'ameter')) setMeterViewId(ent.id);
    }
    if (e.key.toLowerCase() === 'p' && analysis === 'ac') {
      e.preventDefault();
      setPhasorOpen(v=>!v);
    }
    if (e.key === "Escape" && meterViewId) setMeterViewId(null);

    if (e.key === "Delete" || e.key === "Backspace") {
      if (selected.kind === "entity" && selected.id) {
        const id = selected.id;
        setEntities((arr) => arr.filter((x) => x.id !== id));
        setWires((ws) => ws.filter((w) => w.aTerm.indexOf(id + ":") !== 0 && w.bTerm.indexOf(id + ":") !== 0));
        setSelected({ kind: null, id: null });
      } else if (selected.kind === "wire" && selected.id) {
        const id = selected.id;
        setWires((ws) => ws.filter((w) => w.id !== id));
        setSelected({ kind: null, id: null });
      }
    }
  });

  // quick key (P) to toggle phasor panel in AC mode (duplicate-safe)
  useKey((e) => {
    if (e.key && e.key.toLowerCase() === 'p' && analysis === 'ac') {
      e.preventDefault();
      setPhasorOpen((v)=>!v);
    }
  });

  const isOccupied = (x: number, y: number, ignoreId: string | null = null) => entities.some((e) => e.id !== ignoreId && e.x === x && e.y === y);

  const nearestFree = (x: number, y: number, ignoreId: string | null = null) => {
    let sx = snap(x), sy = snap(y);
    if (!isOccupied(sx, sy, ignoreId)) return { x: sx, y: sy };
    for (let r = 1; r <= 25; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = sx + dx * GRID;
          const ny = sy + dy * GRID;
          if (!isOccupied(nx, ny, ignoreId)) return { x: nx, y: ny };
        }
      }
    }
    return { x: sx, y: sy };
  };

  function onCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    const pt = getMouse(svgRef.current!, e);
    if (tool !== "wire") {
      if (tool !== "select") addEntity(tool as EntityType, pt.x, pt.y);
      else setSelected({ kind: null, id: null });
      return;
    }
    if (hoverTerm) {
      if (!pendingWire) setPendingWire({ aTerm: hoverTerm.id });
      else if (pendingWire && hoverTerm.id !== pendingWire.aTerm) {
        const exists = wires.some((w) => (w.aTerm === pendingWire.aTerm && w.bTerm === hoverTerm.id) || (w.bTerm === pendingWire.aTerm && w.aTerm === hoverTerm.id));
        if (!exists) setWires((ws) => ws.concat({ id: niceId(), aTerm: pendingWire.aTerm, bTerm: hoverTerm.id }));
        setPendingWire(null);
      }
      return;
    }
    setPendingWire(null);
    setSelected({ kind: null, id: null });
  }

  function getMouse(svg: SVGSVGElement, evt: React.MouseEvent) {
    const rect = svg.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    return { x: snap(x), y: snap(y) };
  }

  function hitTerminal(mx: number, my: number) {
    const R = 10;
    let best: Terminal | null = null;
    termIndex.forEach((t) => {
      const dx = mx - t.x;
      const dy = my - t.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= R * R && !best) best = { ...t } as Terminal;
    });
    return best;
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const pt = getMouse(svgRef.current!, e);
    setHoverTerm(hitTerminal(pt.x, pt.y));
  }

  function startDrag(entity: Entity, e: React.MouseEvent) {
    e.stopPropagation();
    setTool("select");
    setSelected({ kind: "entity", id: entity.id });

    const start = getMouse(svgRef.current!, e);
    const ox = entity.x - start.x;
    const oy = entity.y - start.y;

    function onMove(ev: MouseEvent) {
      const rect = svgRef.current!.getBoundingClientRect();
      const px = snap(ev.clientX - rect.left) + ox;
      const py = snap(ev.clientY - rect.top) + oy;
      setEntities((arr) => arr.map((it) => (it.id === entity.id ? { ...it, x: px, y: py } : it)));
    }
    function onUp() {
      setEntities((arr) => arr.map((it) => (it.id === entity.id ? { ...it, ...nearestFree(it.x, it.y, entity.id) } : it)));
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const selectedEntity = entities.find((e) => selected.kind === "entity" && e.id === selected.id);

  function updateSelected(patch: Partial<Entity>) {
    if (!selectedEntity) return;
    setEntities((arr) => arr.map((e) => (e.id === selectedEntity.id ? ({ ...e, ...(patch as any) }) : e)));
  }

  const pathD = (g: number) => "M " + g + " 0 L 0 0 0 " + g;
  const l = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });

  function addEntity(type: EntityType, x: number, y: number) {
    const base: Entity = {
      id: niceId(),
      type,
      x: snap(x),
      y: snap(y),
      rotation: 0,
      label: nextLabel(entities, type), // auto-label (R1, C1, ...)
      value: DEFAULTS[type]?.value as any,
      wave: (DEFAULTS[type]?.wave as any) || undefined,
      amplitude: DEFAULTS[type]?.amplitude,
      frequency: DEFAULTS[type]?.frequency,
      phaseEnabled: DEFAULTS[type]?.phaseEnabled,
      phase: DEFAULTS[type]?.phase
    };
    setEntities((arr) => arr.concat({ ...base, ...nearestFree(base.x, base.y) }));
  }

  function rotateSelected() {
    if (!selectedEntity) return;
    updateSelected({ rotation: ((selectedEntity.rotation || 0) + 90) % 360 });
  }

  function voltagePhasor(e: Entity): C | null {
    if (!sol.ok) return null;
    const ts = worldTerminals(e);
    if (ts.length < 2) return C0(0,0);
    const nA = sol.nodeOf.get(ts[0].id) || 0;
    const nB = sol.nodeOf.get(ts[1].id) || 0;
    if (analysis === 'dc') {
      const Va = (sol as any).V.get(nA) || 0;
      const Vb = (sol as any).V.get(nB) || 0;
      return C0(Va - Vb, 0);
    } else {
      const Va = (sol as any).V.get(nA) || C0(0,0);
      const Vb = (sol as any).V.get(nB) || C0(0,0);
      return cSub(Va, Vb);
    }
  }

  function currentPhasor(e: Entity): C | null {
    if (!sol.ok) return null;
    const ts = worldTerminals(e);
    const nA = sol.nodeOf.get(ts[0]?.id || "");
    const nB = sol.nodeOf.get(ts[1]?.id || "");
    if (analysis === 'dc') {
      if (e.type === 'vmeter') return C0(0,0);
      const Va = nA != null ? ((sol as any).V.get(nA) || 0) : 0;
      const Vb = nB != null ? ((sol as any).V.get(nB) || 0) : 0;
      const Vab = Va - Vb;
      if (e.type === 'resistor') {
        const R = parseSI(e.value || '1k') || 1e9;
        return C0(Vab / R, 0);
      }
      if (e.type === 'vsrc') {
        const idx = (sol as any).vsIndexOf.get(e.id);
        if (idx === undefined) return C0(0,0);
        const I = (sol as any).Ivs[idx] || 0;
        return C0(I, 0);
      }
      if (e.type === 'isrc') {
        const Iamp = parseSI(e.amplitude || '0') || 0;
        return C0(Iamp, 0);
      }
      if (e.type === 'ameter') {
        const AMMETER_R = 1e-6;
        return C0(Vab / AMMETER_R, 0);
      }
      if (e.type === 'capacitor' || e.type === 'inductor') return C0(0,0);
      return C0(0,0);
    } else {
      const Va = nA != null ? ((sol as any).V.get(nA) || C0(0,0)) : C0(0,0);
      const Vb = nB != null ? ((sol as any).V.get(nB) || C0(0,0)) : C0(0,0);
      const Vab = cSub(Va, Vb);
      const w = (sol as any).omega as number;

      if (e.type === 'resistor') {
        const R = parseSI(e.value || '1k') || 1e9;
        return C0(Vab.re / R, Vab.im / R);
      }
      if (e.type === 'capacitor') {
        const Cval = parseSI(e.value || '1u') || 0;
        const I = cMul(C0(0,w*Cval), Vab);
        return I;
      }
      if (e.type === 'inductor') {
        const L = parseSI(e.value || '10m') || 0;
        const Y = cDiv(C0(1,0), C0(0,w*L));
        return cMul(Y, Vab);
      }
      if (e.type === 'vsrc') {
        const idx = (sol as any).vsIndexOf.get(e.id);
        if (idx === undefined) return C0(0,0);
        return (sol as any).Ivs[idx] || C0(0,0);
      }
      if (e.type === 'isrc') {
        if (e.wave === 'ac') {
          const Iamp = parseSI(e.amplitude || '0') || 0;
          const ph = parsePhase(e.phaseEnabled ? e.phase : '0');
          return C0(Iamp*Math.cos(ph), Iamp*Math.sin(ph));
        }
        return C0(0,0);
      }
      if (e.type === 'ameter') {
        const AMMETER_R = 1e-6;
        return C0(Vab.re / AMMETER_R, Vab.im / AMMETER_R);
      }
      if (e.type === 'vmeter') return C0(0,0);
      return C0(0,0);
    }
  }

  function currentInstant(e: Entity): number | null {
    if (!sol.ok) return null;
    if (analysis === 'dc') {
      const iPh = currentPhasor(e); // real only
      return iPh ? iPh.re : null;
    }
    const iPh = currentPhasor(e);
    if (!iPh) return null;
    const w = (sol as any).omega as number;
    return iPh.re * Math.cos(w * t) - iPh.im * Math.sin(w * t); // Re{I * e^{jωt}}
  }

  function voltageInstant(e: Entity): number | null {
    if (!sol.ok) return null;
    if (analysis === 'dc') {
      const vPh = voltagePhasor(e);
      return vPh ? vPh.re : null;
    }
    const vPh = voltagePhasor(e);
    if (!vPh) return null;
    const w = (sol as any).omega as number;
    return vPh.re * Math.cos(w * t) - vPh.im * Math.sin(w * t);
  }

  // ===== helpers for collectors =====
  function termNodesOf(ent:Entity, nodeOf:Map<string,number>) {
    const ts = worldTerminals(ent);
    const nA = nodeOf.get(ts[0]?.id || '') ?? 0;
    const nB = nodeOf.get(ts[1]?.id || '') ?? 0;
    return { nA, nB };
  }

  // ===== Phasor collections for overlay (with V12 labels & colors) =====
  function collectVoltagePhasors(mode:'components'|'nodeGround'|'nodePairs'): { label: string; ph: C; color?:string }[] {
    if (analysis !== 'ac' || !(ac as any).ok) return [];
    const out: {label:string; ph:C; color?:string}[] = [];
    const nodeOf: Map<string,number> = (ac as any).nodeOf;

    if (mode==='components') {
      for (const e of entities) {
        const v = voltagePhasor(e);
        if (!v || !isFinite(cAbs(v))) continue;
        const { nA, nB } = termNodesOf(e, nodeOf);
        const n1 = Math.min(nA, nB), n2 = Math.max(nA, nB);
        const lab = `V${n1}${n2} (${e.label||e.type})`;
        out.push({ label: lab, ph: v, color: phasorColor(lab) });
      }
    } else if (mode==='nodeGround') {
      const nodes = new Set<number>();
      (ac as any).nodeOf.forEach((nid:number)=>nodes.add(nid));
      Array.from(nodes).sort((a,b)=>a-b).forEach((nid)=>{
        if (nid===0) return;
        const Vn = (ac as any).V.get(nid) as C || C0(0,0);
        const lab = `V${nid}0`;
        out.push({ label: lab, ph: Vn, color: nodeColor(nid) });
      });
    } else {
      const seen = new Set<string>();
      for (const e of entities) {
        const { nA, nB } = termNodesOf(e, nodeOf);
        if (nA===nB) continue;
        const n1 = Math.min(nA, nB), n2 = Math.max(nA, nB);
        const key = `${n1}-${n2}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const Va = (ac as any).V.get(nA) as C || C0(0,0);
        const Vb = (ac as any).V.get(nB) as C || C0(0,0);
        const v = cSub(Va, Vb);
        const lab = `V${n1}${n2}`;
        out.push({ label: lab, ph: v, color: phasorColor(lab) });
      }
    }
    return out;
  }

  function collectCurrentPhasors(mode:'components'|'nodeGround'|'nodePairs'): { label: string; ph: C; color?:string }[] {
    if (analysis !== 'ac' || !(ac as any).ok) return [];
    const out: {label:string; ph:C; color?:string}[] = [];
    if (mode==='nodeGround') mode = 'components'; // not meaningful for I

    if (mode==='components') {
      for (const e of entities) {
        if (e.type === 'vmeter') continue;
        const I = currentPhasor(e);
        if (!I || !isFinite(cAbs(I))) continue;
        const lab = `${e.label || e.type}`;
        out.push({ label: lab, ph: I, color: phasorColor(lab) });
      }
    } else {
      const nodeOf: Map<string,number> = (ac as any).nodeOf;
      const buckets = new Map<string, C>();
      const colors = new Map<string,string>();
      for (const e of entities) {
        if (e.type === 'vmeter') continue;
        const I = currentPhasor(e);
        if (!I || !isFinite(cAbs(I))) continue;
        const { nA, nB } = termNodesOf(e, nodeOf);
        if (nA===nB) continue;
        const n1 = Math.min(nA,nB), n2 = Math.max(nA,nB);
        const key = `${n1}-${n2}`;
        buckets.set(key, cAdd(buckets.get(key)||C0(), I));
        colors.set(key, phasorColor(`I-${key}`));
      }
      for (const [key, ph] of buckets) {
        const lab = `I${key.replace('-','')}`;
        out.push({ label: lab, ph, color: colors.get(key) });
      }
    }
    return out;
  }

  // ==================== Self-tests (non-blocking) ====================
  useEffect(() => {
    // Simple parser tests
    console.assert(parseSI('1k') === 1000, 'parseSI 1k');
    console.assert(Math.abs((parseHz('1kHz')||0) - 1000) < 1e-9, 'parseHz 1kHz');

    // Tiny DC circuit test: 5V -> 1k -> GND
    const g: Entity = { id:'g', type:'ground', x:0, y:0, rotation:0 };
    const v: Entity = { id:'v', type:'vsrc', x:0, y:0, rotation:0, wave:'dc', amplitude:'5V' };
    const r: Entity = { id:'r', type:'resistor', x:0, y:0, rotation:0, value:'1k' };
    const ws: Wire[] = [];
    const [vA,vB] = worldTerminals(v), [rA,rB] = worldTerminals(r), [gT] = worldTerminals(g);
    ws.push({id:'w1', aTerm:vA.id, bTerm:rA.id});
    ws.push({id:'w2', aTerm:rB.id, bTerm:gT.id});
    ws.push({id:'w3', aTerm:vB.id, bTerm:gT.id});
    const s = solveDC([g,v,r], ws);
    if (s.ok) {
      const nRA = s.nodeOf.get(rA.id)!;
      const nRB = s.nodeOf.get(rB.id)!;
      const Vr = (s.V.get(nRA)||0)-(s.V.get(nRB)||0);
      console.assert(Math.abs(Vr - 5) < 1e-6, 'DC solve Vr=5V');
    }
  }, []);

  return (
    <ErrorBoundary>
      <div className="w-full h-full flex bg-[#0b1020] text-[#e6ecff]">
        <div className="w-80 p-3 border-r border-white/10 bg-[#121a33]/60">
          <h2 className="text-lg font-semibold mb-2">Palette</h2>
          <div className="grid grid-cols-1 gap-2">
            {palette.map((p) => (
              <button
                key={p.type}
                onClick={() => setTool(p.type as Tool)}
                className={"px-3 py-2 rounded-xl border border-white/10 hover:border-white/30 transition " + (tool === p.type ? "bg-white/10" : "bg-black/20")}
              >{p.label}</button>
            ))}
            <button
              onClick={() => setTool("select")}
              className={"px-3 py-2 rounded-xl border border-white/10 hover:border-white/30 transition " + (tool === "select" ? "bg-white/10" : "bg-black/20")}
            >
              Select/Move
            </button>
          </div>

          <div className="mt-6 space-y-2">
            <h3 className="text-sm uppercase tracking-wide text-white/70">Analysis</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="bg-black/20 border border-white/10 rounded px-2 py-1"
                value={analysis}
                onChange={(e)=>setAnalysis(e.target.value as Analysis)}
              >
                <option value="dc">DC</option>
                <option value="ac">AC (phasor)</option>
              </select>

              {analysis==='ac' && (
                <>
                  <span className="text-xs text-white/70">f:</span>
                  <input
                    className="w-24 bg-black/20 border border-white/10 rounded px-2 py-1"
                    value={acFreq}
                    onChange={(e)=>setAcFreq((e.target as HTMLInputElement).value)}
                  />
                  <button className="px-2 py-1 rounded border border-white/10 hover:border-white/30" onClick={()=>setPhasorOpen(true)}>Phasors…</button>
                </>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={() => setRunning((v) => !v)}
                className={"px-3 py-2 rounded-xl border transition " + (running ? "bg-[#19c37d]/20 border-[#19c37d]/40 hover:border-[#19c37d]/60" : "border-white/10 hover:border-white/30")}
              >
                {running ? "■ Stop" : "▶ Run"}
              </button>
              {analysis==='ac' && <span className="text-xs text-white/60">(Press <b>P</b> to toggle phasors)</span>}
            </div>

            {!sol.ok && <div className="text-xs text-[#ffadad] mt-1">{(sol as any).reason || "Add GND and close the loop"}</div>}
            {analysis==='ac' && sol.ok && <div className="text-xs text-white/60">ω = {(ac as any).omega?.toFixed(2)} rad/s</div>}
          </div>

          <div className="mt-4">
            <label className="text-xs inline-flex items-center gap-2">
              <input type="checkbox" checked={showNodes} onChange={(e) => setShowNodes(e.currentTarget.checked)} /> Show node IDs (debug)
            </label>
          </div>

          <div className="mt-6">
            <h3 className="text-sm uppercase tracking-wide text-white/70 mb-2">Selection</h3>
            {selectedEntity ? (
              <Editor entity={selectedEntity} updateSelected={updateSelected} />
            ) : (
              <div className="text-sm text-white/60">Nothing selected. Tip: click a part to edit; R to rotate; Delete to remove.</div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-sm uppercase tracking-wide text-white/70 mb-2">Result (select a part)</h3>
            {selectedEntity ? (
              <ResultsPanel entity={selectedEntity} sol={sol} analysis={analysis} />
            ) : <div className="text-xs text-white/60">Select a component to see its voltage/current.</div>}
          </div>
        </div>

        <div className="flex-1 relative">
          <svg
            ref={svgRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full h-full cursor-crosshair"
            onClick={onCanvasClick}
            onMouseMove={onMouseMove}
          >
            <defs>
              <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={pathD(GRID)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" />

            {wires.map((w) => {
              const a = termIndex.get(w.aTerm);
              const b = termIndex.get(w.bTerm);
              if (!a || !b) return null;
              const sel = selected.kind === "wire" && selected.id === w.id;
              const props = l(a.x, a.y, b.x, b.y);
              return (
                <g key={w.id} onMouseDown={(e) => { e.stopPropagation(); setSelected({ kind: "wire", id: w.id }); }}>
                  <line {...props} stroke={sel ? "#ffd60a" : "#93a1c6"} strokeWidth={sel ? 4 : 3} />
                </g>
              );
            })}

            {tool === "wire" && pendingWire && hoverTerm && (() => {
              const a = termIndex.get(pendingWire.aTerm)!;
              const b = hoverTerm!;
              const props = l(a.x, a.y, b.x, b.y);
              return (<line {...props} stroke="#ffd60a" strokeDasharray="6 4" strokeWidth={2} />);
            })()}

            {entities.map((e) => (
              <EntityView
                key={e.id}
                entity={e}
                selected={selected.kind === "entity" && selected.id === e.id}
                onMouseDown={startDrag}
                onClick={() => {
                  setSelected({ kind: "entity", id: e.id });
                  setTool("select");
                  if (e.type === 'vmeter' || e.type === 'ameter') setMeterViewId(e.id);
                }}
                running={running}
                t={t}
                current={running ? currentInstant(e) : null}
                voltage={running ? voltageInstant(e) : null}
              />
            ))}

            {hoverTerm && <circle cx={hoverTerm.x} cy={hoverTerm.y} r={6} fill="#ffd60a" opacity={0.8} />}

            {/* Node debug overlay */}
            {showNodes && Array.from(termIndex.values()).map((t) => {
              const nid = sol.nodeOf.get(t.id);
              if (nid === undefined) return null;
              return (
                <g key={"nid-" + t.id}>
                  <circle cx={t.x} cy={t.y - 12} r={7} fill={nodeColor(nid)} />
                  <text x={t.x} y={t.y - 9} textAnchor="middle" fontSize={9} fill="#0b1020" style={{ userSelect: "none", fontWeight:600 }}>{nid}</text>
                </g>
              );
            })}
          </svg>

          {/* Meter Fullscreen Readout */}
          {meterViewId && (() => {
            const ent = entities.find(x => x.id === meterViewId);
            if (!ent) return null;
            const isV = ent.type === 'vmeter';
            const vPh = voltagePhasor(ent);
            const iPh = currentPhasor(ent);
            const valInstant = isV ? voltageInstant(ent) : currentInstant(ent);
            const txt = !sol.ok ? '—' : (isV ? (valInstant==null?'—':formatV(valInstant)) : (valInstant==null?'—':formatI(valInstant)));

            const magPhase = analysis==='ac' ? (
              <div className="text-center text-sm text-white/80 mt-1">
                |{isV?'V':'I'}| = <b>{isV?formatV(cAbs(vPh||C0())):formatI(cAbs(iPh||C0()))}</b> • ∠ {((vPh && isV)?(cArg(vPh)*180/Math.PI):(iPh? (cArg(iPh)*180/Math.PI):0)).toFixed(1)}°
              </div>
            ) : null;

            return (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setMeterViewId(null)}>
                <div className="min-w-[420px] max-w-[700px] bg-[#0b1020] border border-white/10 rounded-2xl p-5 shadow-xl" onClick={(e)=>e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm uppercase tracking-wide text-white/70">{isV ? 'Voltmeter' : 'Ammeter'} Reading ({analysis.toUpperCase()})</div>
                    <button className="px-2 py-1 rounded-lg border border-white/10 hover:border-white/30" onClick={()=>setMeterViewId(null)}>✕</button>
                  </div>

                  {sol.ok ? (
                    <>
                      <div className="text-5xl font-semibold text-white text-center mb-2">{txt}</div>
                      <div className="text-xs text-white/70 text-center">A→B orientation • Live</div>
                      {magPhase}
                      <TraceChart points={trace} unit={isV ? 'V' : 'A'} />
                    </>
                  ) : (
                    <div className="text-sm text-[#ffadad]">{(sol as any).reason || 'Solver not ready (check GND/loop).'}</div>
                  )}

                  <div className="mt-4 text-xs text-white/60 text-center">Tip: Press <b>Esc</b> or click outside to close. Press <b>Enter</b> with a meter selected to open.</div>
                </div>
              </div>
            );
          })()}

          {/* ======= PHASOR OVERLAY ======= */}
          {phasorOpen && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={()=>setPhasorOpen(false)}>
              <div className="min-w-[760px] max-w-[900px] bg-[#0b1020] border border-white/10 rounded-2xl p-5 shadow-xl" onClick={(e)=>e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm uppercase tracking-wide text-white/70">Circuit Phasors</div>
                  <button className="px-2 py-1 rounded-lg border border-white/10 hover:border-white/30" onClick={()=>setPhasorOpen(false)}>✕</button>
                </div>

                {analysis!=='ac' ? (
                  <div className="text-sm text-[#ffadad]">Switch analysis to AC to view phasors.</div>
                ) : (!ac.ok ? (
                  <div className="text-sm text-[#ffadad]">{(ac as any).reason || 'AC solve failed (check frequency and connections).'}</div>
                ) : (
                  <PhasorTabs
                    Vlist={collectVoltagePhasors(phasorMode)}
                    Ilist={collectCurrentPhasors(phasorMode)}
                    mode={phasorMode}
                    setMode={setPhasorMode}
                  />
                ))}

                <div className="mt-3 text-xs text-white/60 text-center">Reference is ground node (n0). Vectors are drawn to scale; legend shows magnitude &amp; angle.</div>
              </div>
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/70">
            <div>
              Mode: <span className="text-white">{tool === "select" ? "Select/Move" : tool === "wire" ? "Wire" : "Place " + tool}</span>
              {pendingWire && <span className="ml-3 text-[#ffd60a]">(click another terminal to finish wire)</span>}
            </div>
            <div>Tips: R to rotate • Delete to remove • Snap {GRID}px</div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
