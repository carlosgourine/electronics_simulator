import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { TraceChart } from "./components/charts/TraceChart";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EntityView } from "./components/canvas/EntityView";
import { Editor } from "./components/panels/Editor";
import { ResultsPanel } from "./components/panels/ResultsPanel";
import { PhasorTabs } from "./components/phasor/PhasorTabs";
import { CANVAS_H, CANVAS_W, GRID, PALETTE } from "./constants/config";
import {
  collectCurrentPhasors,
  collectVoltagePhasors,
  getCurrentInstant,
  getCurrentPhasor,
  getMagnitudeAndAngle,
  getVoltageInstant,
  getVoltagePhasor,
} from "./engine/measurements";
import { solveAC } from "./engine/solveAC";
import { solveDC } from "./engine/solveDC";
import { useKey } from "./hooks/useKey";
import type { Analysis, Entity, EntityType, PhasorMode, Selection, Terminal, Tool, TracePoint, Wire } from "./types";
import { createEntity, niceId, worldTerminals } from "./utils/entities";
import { formatDeg, formatI, formatV } from "./utils/formatters";
import { hitTerminal, nodeColor, snap } from "./utils/geometry";
import { C0, cAbs } from "./utils/math";
import { parseHz, parseSI } from "./utils/parser";

function getMouse(svg: SVGSVGElement, event: React.MouseEvent | MouseEvent) {
  const rect = svg.getBoundingClientRect();
  return {
    x: snap(event.clientX - rect.left),
    y: snap(event.clientY - rect.top),
  };
}

function nearestFree(x: number, y: number, entities: Entity[], ignoreId: string | null = null) {
  const sx = snap(x);
  const sy = snap(y);
  const occupied = (px: number, py: number) => entities.some((entity) => entity.id !== ignoreId && entity.x === px && entity.y === py);

  if (!occupied(sx, sy)) return { x: sx, y: sy };

  for (let r = 1; r <= 25; r += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const px = sx + dx * GRID;
        const py = sy + dy * GRID;
        if (!occupied(px, py)) return { x: px, y: py };
      }
    }
  }

  return { x: sx, y: sy };
}

export default function App() {
  const [tool, setTool] = useState<Tool>("select");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selected, setSelected] = useState<Selection>({ kind: null, id: null });
  const [pendingWire, setPendingWire] = useState<{ aTerm: string } | null>(null);
  const [hoverTerm, setHoverTerm] = useState<Terminal | null>(null);
  const [running, setRunning] = useState(false);
  const [t, setT] = useState(0);
  const [showNodes, setShowNodes] = useState(false);
  const [meterViewId, setMeterViewId] = useState<string | null>(null);
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const [analysis, setAnalysis] = useState<Analysis>("dc");
  const [acFreq, setAcFreq] = useState("1kHz");
  const [phasorOpen, setPhasorOpen] = useState(false);
  const [phasorMode, setPhasorMode] = useState<PhasorMode>("components");

  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const selectedEntity = entities.find((entity) => selected.kind === "entity" && entity.id === selected.id) || null;

  const termIndex = useMemo(() => {
    const map = new Map<string, Terminal>();
    entities.forEach((entity) => {
      worldTerminals(entity).forEach((terminal) => map.set(terminal.id, terminal));
    });
    return map;
  }, [entities]);

  const dc = useMemo(() => solveDC(entities, wires), [entities, wires]);
  const ac = useMemo(() => solveAC(entities, wires, parseHz(acFreq) || 1000), [entities, wires, acFreq]);
  const sol = analysis === "dc" ? dc : ac;

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
      setT((value) => value + dt);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  useEffect(() => {
    if (meterViewId) setTrace([]);
  }, [meterViewId]);

  useEffect(() => {
    if (!meterViewId || !sol.ok) return;
    const entity = entities.find((item) => item.id === meterViewId);
    if (!entity) return;

    const value =
      entity.type === "vmeter"
        ? getVoltageInstant(entity, sol, analysis, t)
        : getCurrentInstant(entity, sol, analysis, t);

    if (value == null || !Number.isFinite(value)) return;

    setTrace((current) => {
      const point = { t, v: value };
      const next =
        current.length > 0 && current[current.length - 1].t === point.t
          ? current.slice(0, -1).concat(point)
          : current.concat(point);
      const maxPoints = 600;
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
  }, [analysis, entities, meterViewId, sol, t]);

  useKey((event) => {
    const active = document.activeElement as HTMLElement | null;
    const tag = active?.tagName;
    const isField = Boolean(active && (active.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"));
    if (isField) return;

    if (event.key.toLowerCase() === "r" && selectedEntity) {
      event.preventDefault();
      setEntities((current) =>
        current.map((entity) =>
          entity.id === selectedEntity.id ? { ...entity, rotation: ((entity.rotation || 0) + 90) % 360 } : entity,
        ),
      );
    }

    if (event.key === "Enter" && selectedEntity && (selectedEntity.type === "vmeter" || selectedEntity.type === "ameter")) {
      setMeterViewId(selectedEntity.id);
    }

    if (event.key.toLowerCase() === "p" && analysis === "ac") {
      event.preventDefault();
      setPhasorOpen((value) => !value);
    }

    if (event.key === "Escape" && meterViewId) setMeterViewId(null);

    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (selected.kind === "entity" && selected.id) {
      const id = selected.id;
      setEntities((current) => current.filter((entity) => entity.id !== id));
      setWires((current) => current.filter((wire) => !wire.aTerm.startsWith(`${id}:`) && !wire.bTerm.startsWith(`${id}:`)));
      setSelected({ kind: null, id: null });
      return;
    }

    if (selected.kind === "wire" && selected.id) {
      const id = selected.id;
      setWires((current) => current.filter((wire) => wire.id !== id));
      setSelected({ kind: null, id: null });
    }
  });

  function addEntity(type: EntityType, x: number, y: number) {
    const entity = createEntity(type, entities, x, y);
    setEntities((current) => current.concat({ ...entity, ...nearestFree(entity.x, entity.y, current) }));
  }

  function updateSelected(patch: Partial<Entity>) {
    if (!selectedEntity) return;
    setEntities((current) => current.map((entity) => (entity.id === selectedEntity.id ? { ...entity, ...patch } : entity)));
  }

  function onCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;

    const point = getMouse(svg, event);

    if (tool !== "wire") {
      if (tool !== "select") addEntity(tool as EntityType, point.x, point.y);
      else setSelected({ kind: null, id: null });
      return;
    }

    if (hoverTerm) {
      if (!pendingWire) {
        setPendingWire({ aTerm: hoverTerm.id });
      } else if (hoverTerm.id !== pendingWire.aTerm) {
        const exists = wires.some(
          (wire) =>
            (wire.aTerm === pendingWire.aTerm && wire.bTerm === hoverTerm.id) ||
            (wire.bTerm === pendingWire.aTerm && wire.aTerm === hoverTerm.id),
        );
        if (!exists) setWires((current) => current.concat({ id: niceId(), aTerm: pendingWire.aTerm, bTerm: hoverTerm.id }));
        setPendingWire(null);
      }
      return;
    }

    setPendingWire(null);
    setSelected({ kind: null, id: null });
  }

  function onMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const point = getMouse(svg, event);
    setHoverTerm(hitTerminal(termIndex.values(), point.x, point.y));
  }

  function startDrag(entity: Entity, event: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;

    event.stopPropagation();
    setTool("select");
    setSelected({ kind: "entity", id: entity.id });

    const start = getMouse(svg, event);
    const ox = entity.x - start.x;
    const oy = entity.y - start.y;

    const onMove = (nativeEvent: MouseEvent) => {
      const point = getMouse(svg, nativeEvent);
      setEntities((current) =>
        current.map((item) => (item.id === entity.id ? { ...item, x: point.x + ox, y: point.y + oy } : item)),
      );
    };

    const onUp = () => {
      setEntities((current) =>
        current.map((item) =>
          item.id === entity.id ? { ...item, ...nearestFree(item.x, item.y, current, entity.id) } : item,
        ),
      );
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    console.assert(parseSI("1k") === 1000, "parseSI 1k");
    console.assert(Math.abs((parseHz("1kHz") || 0) - 1000) < 1e-9, "parseHz 1kHz");

    const ground: Entity = { id: "g", type: "ground", x: 0, y: 0, rotation: 0 };
    const source: Entity = { id: "v", type: "vsrc", x: 0, y: 0, rotation: 0, wave: "dc", amplitude: "5V" };
    const resistor: Entity = { id: "r", type: "resistor", x: 0, y: 0, rotation: 0, value: "1k" };
    const testWires: Wire[] = [];
    const [vA, vB] = worldTerminals(source);
    const [rA, rB] = worldTerminals(resistor);
    const [gT] = worldTerminals(ground);

    testWires.push({ id: "w1", aTerm: vA.id, bTerm: rA.id });
    testWires.push({ id: "w2", aTerm: rB.id, bTerm: gT.id });
    testWires.push({ id: "w3", aTerm: vB.id, bTerm: gT.id });

    const solution = solveDC([ground, source, resistor], testWires);
    if (!solution.ok) return;

    const nodeA = solution.nodeOf.get(rA.id)!;
    const nodeB = solution.nodeOf.get(rB.id)!;
    const voltage = (solution.V.get(nodeA) || 0) - (solution.V.get(nodeB) || 0);
    console.assert(Math.abs(voltage - 5) < 1e-6, "DC solve Vr=5V");
  }, []);

  const voltagePhasors = useMemo(() => collectVoltagePhasors(entities, ac, phasorMode), [ac, entities, phasorMode]);
  const currentPhasors = useMemo(() => collectCurrentPhasors(entities, ac, phasorMode), [ac, entities, phasorMode]);

  const meterEntity = meterViewId ? entities.find((entity) => entity.id === meterViewId) || null : null;
  const meterIsVoltage = meterEntity?.type === "vmeter";
  const meterVoltagePhasor = meterEntity ? getVoltagePhasor(meterEntity, sol, analysis) : null;
  const meterCurrentPhasor = meterEntity ? getCurrentPhasor(meterEntity, sol, analysis) : null;
  const meterInstant = meterEntity
    ? meterIsVoltage
      ? getVoltageInstant(meterEntity, sol, analysis, t)
      : getCurrentInstant(meterEntity, sol, analysis, t)
    : null;
  const meterMeta = getMagnitudeAndAngle(meterIsVoltage ? meterVoltagePhasor : meterCurrentPhasor);

  return (
    <ErrorBoundary>
      <div className="flex h-full w-full bg-[#0b1020] text-[#e6ecff]">
        <div className="w-80 border-r border-white/10 bg-[#121a33]/60 p-3">
          <h2 className="mb-2 text-lg font-semibold">Palette</h2>
          <div className="grid grid-cols-1 gap-2">
            {PALETTE.map((item) => (
              <button
                key={item.type}
                onClick={() => setTool(item.type as Tool)}
                className={`rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/30 ${tool === item.type ? "bg-white/10" : "bg-black/20"}`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setTool("select")}
              className={`rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/30 ${tool === "select" ? "bg-white/10" : "bg-black/20"}`}
            >
              Select/Move
            </button>
          </div>

          <div className="mt-6 space-y-2">
            <h3 className="text-sm uppercase tracking-wide text-white/70">Analysis</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded border border-white/10 bg-black/20 px-2 py-1"
                value={analysis}
                onChange={(event) => setAnalysis(event.currentTarget.value as Analysis)}
              >
                <option value="dc">DC</option>
                <option value="ac">AC (phasor)</option>
              </select>

              {analysis === "ac" && (
                <>
                  <span className="text-xs text-white/70">f:</span>
                  <input
                    className="w-24 rounded border border-white/10 bg-black/20 px-2 py-1"
                    value={acFreq}
                    onChange={(event) => setAcFreq(event.currentTarget.value)}
                  />
                  <button className="rounded border border-white/10 px-2 py-1 hover:border-white/30" onClick={() => setPhasorOpen(true)}>
                    Phasors...
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRunning((value) => !value)}
                className={`rounded-xl border px-3 py-2 transition ${running ? "border-[#19c37d]/40 bg-[#19c37d]/20 hover:border-[#19c37d]/60" : "border-white/10 hover:border-white/30"}`}
              >
                {running ? "Stop" : "Run"}
              </button>
              {analysis === "ac" && <span className="text-xs text-white/60">(Press <b>P</b> to toggle phasors)</span>}
            </div>

            {!sol.ok && <div className="mt-1 text-xs text-[#ffadad]">{sol.reason || "Add GND and close the loop"}</div>}
            {analysis === "ac" && sol.ok && <div className="text-xs text-white/60">omega = {ac.omega.toFixed(2)} rad/s</div>}
          </div>

          <div className="mt-4">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showNodes} onChange={(event) => setShowNodes(event.currentTarget.checked)} />
              Show node IDs (debug)
            </label>
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-sm uppercase tracking-wide text-white/70">Selection</h3>
            {selectedEntity ? (
              <Editor entity={selectedEntity} updateSelected={updateSelected} />
            ) : (
              <div className="text-sm text-white/60">Nothing selected. Tip: click a part to edit; R to rotate; Delete to remove.</div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-sm uppercase tracking-wide text-white/70">Result (select a part)</h3>
            {selectedEntity ? (
              <ResultsPanel entity={selectedEntity} sol={sol} analysis={analysis} />
            ) : (
              <div className="text-xs text-white/60">Select a component to see its voltage/current.</div>
            )}
          </div>
        </div>

        <div className="relative flex-1">
          <svg
            ref={svgRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="h-full w-full cursor-crosshair"
            onClick={onCanvasClick}
            onMouseMove={onMouseMove}
          >
            <defs>
              <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" />

            {wires.map((wire) => {
              const a = termIndex.get(wire.aTerm);
              const b = termIndex.get(wire.bTerm);
              if (!a || !b) return null;
              const selectedWire = selected.kind === "wire" && selected.id === wire.id;
              return (
                <g key={wire.id} onMouseDown={(event) => { event.stopPropagation(); setSelected({ kind: "wire", id: wire.id }); }}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selectedWire ? "#ffd60a" : "#93a1c6"} strokeWidth={selectedWire ? 4 : 3} />
                </g>
              );
            })}

            {tool === "wire" && pendingWire && hoverTerm && (() => {
              const a = termIndex.get(pendingWire.aTerm);
              if (!a) return null;
              return <line x1={a.x} y1={a.y} x2={hoverTerm.x} y2={hoverTerm.y} stroke="#ffd60a" strokeDasharray="6 4" strokeWidth={2} />;
            })()}

            {entities.map((entity) => (
              <EntityView
                key={entity.id}
                entity={entity}
                selected={selected.kind === "entity" && selected.id === entity.id}
                onMouseDown={startDrag}
                onClick={() => {
                  setSelected({ kind: "entity", id: entity.id });
                  setTool("select");
                  if (entity.type === "vmeter" || entity.type === "ameter") setMeterViewId(entity.id);
                }}
                running={running}
                t={t}
                current={running ? getCurrentInstant(entity, sol, analysis, t) : null}
                voltage={running ? getVoltageInstant(entity, sol, analysis, t) : null}
              />
            ))}

            {hoverTerm && <circle cx={hoverTerm.x} cy={hoverTerm.y} r={6} fill="#ffd60a" opacity={0.8} />}

            {showNodes &&
              Array.from(termIndex.values()).map((terminal) => {
                const nodeId = sol.nodeOf.get(terminal.id);
                if (nodeId === undefined) return null;
                return (
                  <g key={`node-${terminal.id}`}>
                    <circle cx={terminal.x} cy={terminal.y - 12} r={7} fill={nodeColor(nodeId)} />
                    <text
                      x={terminal.x}
                      y={terminal.y - 9}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#0b1020"
                      style={{ userSelect: "none", fontWeight: 600 }}
                    >
                      {nodeId}
                    </text>
                  </g>
                );
              })}
          </svg>

          {meterEntity && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setMeterViewId(null)}>
              <div
                className="min-w-[420px] max-w-[700px] rounded-2xl border border-white/10 bg-[#0b1020] p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm uppercase tracking-wide text-white/70">
                    {meterIsVoltage ? "Voltmeter" : "Ammeter"} Reading ({analysis.toUpperCase()})
                  </div>
                  <button className="rounded-lg border border-white/10 px-2 py-1 hover:border-white/30" onClick={() => setMeterViewId(null)}>
                    x
                  </button>
                </div>

                {sol.ok ? (
                  <>
                    <div className="mb-2 text-center text-5xl font-semibold text-white">
                      {meterInstant == null ? "-" : meterIsVoltage ? formatV(meterInstant) : formatI(meterInstant)}
                    </div>
                    <div className="text-center text-xs text-white/70">A-&gt;B orientation • Live</div>
                    {analysis === "ac" && (
                      <div className="mt-1 text-center text-sm text-white/80">
                        |{meterIsVoltage ? "V" : "I"}| ={" "}
                        <b>{meterIsVoltage ? formatV(cAbs(meterVoltagePhasor || C0())) : formatI(cAbs(meterCurrentPhasor || C0()))}</b> • angle{" "}
                        {Number.isFinite(meterMeta.angle) ? formatDeg(meterMeta.angle) : "-"}
                      </div>
                    )}
                    <TraceChart points={trace} unit={meterIsVoltage ? "V" : "A"} />
                  </>
                ) : (
                  <div className="text-sm text-[#ffadad]">{sol.reason || "Solver not ready (check GND/loop)."}</div>
                )}

                <div className="mt-4 text-center text-xs text-white/60">Tip: Press <b>Esc</b> or click outside to close. Press <b>Enter</b> with a meter selected to open.</div>
              </div>
            </div>
          )}

          {phasorOpen && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPhasorOpen(false)}>
              <div
                className="min-w-[760px] max-w-[900px] rounded-2xl border border-white/10 bg-[#0b1020] p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm uppercase tracking-wide text-white/70">Circuit Phasors</div>
                  <button className="rounded-lg border border-white/10 px-2 py-1 hover:border-white/30" onClick={() => setPhasorOpen(false)}>
                    x
                  </button>
                </div>

                {analysis !== "ac" ? (
                  <div className="text-sm text-[#ffadad]">Switch analysis to AC to view phasors.</div>
                ) : !ac.ok ? (
                  <div className="text-sm text-[#ffadad]">{ac.reason || "AC solve failed (check frequency and connections)."}</div>
                ) : (
                  <PhasorTabs Vlist={voltagePhasors} Ilist={currentPhasors} mode={phasorMode} setMode={setPhasorMode} />
                )}

                <div className="mt-3 text-center text-xs text-white/60">
                  Reference is ground node (n0). Vectors are drawn to scale; legend shows magnitude and angle.
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/70">
            <div>
              Mode: <span className="text-white">{tool === "select" ? "Select/Move" : tool === "wire" ? "Wire" : `Place ${tool}`}</span>
              {pendingWire && <span className="ml-3 text-[#ffd60a]">(click another terminal to finish wire)</span>}
            </div>
            <div>Tips: R to rotate • Delete to remove • Snap {GRID}px</div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
