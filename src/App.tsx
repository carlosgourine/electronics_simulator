import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { CircuitCanvas } from "./components/canvas/CircuitCanvas";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MeterModal } from "./components/modals/MeterModal";
import { PhasorModal } from "./components/modals/PhasorModal";
import { ProbeModal } from "./components/modals/ProbeModal";
import { Sidebar } from "./components/panels/Sidebar";
import { GRID } from "./constants/config";
import {
  collectCurrentPhasors,
  collectVoltagePhasors,
} from "./engine/measurements";
import { solveAC } from "./engine/solveAC";
import { solveDC } from "./engine/solveDC";
import { useDraggable } from "./hooks/useDraggable";
import { useKey } from "./hooks/useKey";
import { useTimeStore } from "./store/useTimeStore";
import type { Analysis, Entity, EntityType, PhasorMode, Selection, Terminal, Tool, Wire } from "./types";
import { ANALYSIS, ENTITY_TYPE, TOOL } from "./types";
import { createEntity, niceId, worldTerminals } from "./utils/entities";
import { hitTerminal, snap } from "./utils/geometry";
import { parseHz, parseSI } from "./utils/parser";
import { nearestFree } from "./utils/placement";

function getMouse(svg: SVGSVGElement, event: React.MouseEvent | MouseEvent) {
  const rect = svg.getBoundingClientRect();
  return {
    x: snap(event.clientX - rect.left),
    y: snap(event.clientY - rect.top),
  };
}

export default function App() {
  const [tool, setTool] = useState<Tool>(TOOL.SELECT);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selected, setSelected] = useState<Selection>({ kind: null, id: null });
  const [pendingWire, setPendingWire] = useState<{ aTerm: string } | null>(null);
  const [hoverTerm, setHoverTerm] = useState<Terminal | null>(null);
  const [showNodes, setShowNodes] = useState(false);
  const [meterViewId, setMeterViewId] = useState<string | null>(null);
  const [probedNode, setProbedNode] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>(ANALYSIS.DC);
  const [acFreq, setAcFreq] = useState("1kHz");
  const [phasorOpen, setPhasorOpen] = useState(false);
  const [phasorMode, setPhasorMode] = useState<PhasorMode>("components");

  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const running = useTimeStore((state) => state.running);
  const tick = useTimeStore((state) => state.tick);
  const toggleRunning = useTimeStore((state) => state.toggleRunning);

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
  const sol = analysis === ANALYSIS.DC ? dc : ac;

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
      tick(dt);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, tick]);

  function deleteEntity(entityId: string) {
    setEntities((current) => current.filter((entity) => entity.id !== entityId));
    setWires((current) => current.filter((wire) => !wire.aTerm.startsWith(`${entityId}:`) && !wire.bTerm.startsWith(`${entityId}:`)));
    if (meterViewId === entityId) setMeterViewId(null);
    setSelected({ kind: null, id: null });
  }

  function deleteWire(wireId: string) {
    setWires((current) => current.filter((wire) => wire.id !== wireId));
    setSelected({ kind: null, id: null });
  }

  function rotateSelectedEntity() {
    if (!selectedEntity) return;
    setEntities((current) =>
      current.map((entity) =>
        entity.id === selectedEntity.id ? { ...entity, rotation: ((entity.rotation || 0) + 90) % 360 } : entity,
      ),
    );
  }

  function openSelectedMeter() {
    if (!selectedEntity) return;
    if (selectedEntity.type !== ENTITY_TYPE.VMETER && selectedEntity.type !== ENTITY_TYPE.AMETER) return;
    setMeterViewId(selectedEntity.id);
  }

  useKey((event) => {
    const active = document.activeElement as HTMLElement | null;
    const tag = active?.tagName;
    const isField = Boolean(active && (active.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"));
    if (isField) return;

    switch (event.key.toLowerCase()) {
      case "r":
        if (!selectedEntity) break;
        event.preventDefault();
        rotateSelectedEntity();
        break;
      case "enter":
        openSelectedMeter();
        break;
      case "p":
        if (analysis !== ANALYSIS.AC) break;
        event.preventDefault();
        setPhasorOpen((value) => !value);
        break;
      case "escape":
        setMeterViewId(null);
        setProbedNode(null);
        setPendingWire(null);
        break;
      case "delete":
      case "backspace":
        if (selected.kind === "entity" && selected.id) {
          deleteEntity(selected.id);
        } else if (selected.kind === "wire" && selected.id) {
          deleteWire(selected.id);
        }
        break;
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

    if (tool === TOOL.PROBE) {
      if (hoverTerm) {
        const nodeId = sol.nodeOf.get(hoverTerm.id);
        if (nodeId !== undefined) setProbedNode(nodeId);
      }
      return;
    }

    if (tool !== TOOL.SELECT && tool !== TOOL.WIRE) {
      addEntity(tool as EntityType, point.x, point.y);
      return;
    }

    if (tool === TOOL.SELECT) {
      setSelected({ kind: null, id: null });
      return;
    }

    if (!hoverTerm) {
      setPendingWire(null);
      setSelected({ kind: null, id: null });
      return;
    }

    if (!pendingWire) {
      setPendingWire({ aTerm: hoverTerm.id });
      return;
    }

    if (hoverTerm.id === pendingWire.aTerm) return;

    const wireAlreadyExists = wires.some(
      (wire) =>
        (wire.aTerm === pendingWire.aTerm && wire.bTerm === hoverTerm.id) ||
        (wire.bTerm === pendingWire.aTerm && wire.aTerm === hoverTerm.id),
    );

    if (!wireAlreadyExists) {
      setWires((current) => current.concat({ id: niceId(), aTerm: pendingWire.aTerm, bTerm: hoverTerm.id }));
    }
    setPendingWire(null);
  }

  function onMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const point = getMouse(svg, event);
    setHoverTerm(hitTerminal(termIndex.values(), point.x, point.y));
  }

  const moveEntity = (entityId: string, x: number, y: number) => {
    setEntities((current) => current.map((entity) => (entity.id === entityId ? { ...entity, x, y } : entity)));
  };

  const finishDrag = (entityId: string) => {
    setEntities((current) =>
      current.map((entity) =>
        entity.id === entityId ? { ...entity, ...nearestFree(entity.x, entity.y, current, entityId) } : entity,
      ),
    );
  };

  const startDrag = useDraggable({
    getMouseCoord: (event) => {
      const svg = svgRef.current;
      return svg ? getMouse(svg, event) : { x: 0, y: 0 };
    },
    moveEntity,
    finishDrag,
    onDragStart: (entity) => {
      setTool(TOOL.SELECT);
      setSelected({ kind: "entity", id: entity.id });
    },
  });

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
  const omegaText = analysis === ANALYSIS.AC && sol.ok ? `omega = ${ac.omega.toFixed(2)} rad/s` : null;

  return (
    <ErrorBoundary>
      <div className="flex h-full w-full bg-[#0b1020] text-[#e6ecff]">
        <Sidebar
          tool={tool}
          setTool={setTool}
          analysis={analysis}
          setAnalysis={setAnalysis}
          acFreq={acFreq}
          setAcFreq={setAcFreq}
          running={running}
          onToggleRunning={toggleRunning}
          setPhasorOpen={setPhasorOpen}
          showNodes={showNodes}
          setShowNodes={setShowNodes}
          selectedEntity={selectedEntity}
          updateSelected={updateSelected}
          sol={sol}
          omegaText={omegaText}
        />

        <div className="relative flex-1">
          <CircuitCanvas
            svgRef={svgRef}
            entities={entities}
            wires={wires}
            selected={selected}
            analysis={analysis}
            termIndex={termIndex}
            tool={tool}
            pendingWire={pendingWire}
            hoverTerm={hoverTerm}
            showNodes={showNodes}
            sol={sol}
            onCanvasClick={onCanvasClick}
            onMouseMove={onMouseMove}
            onWireMouseDown={(wireId, event) => {
              event.stopPropagation();
              setSelected({ kind: "wire", id: wireId });
            }}
            onEntityMouseDown={startDrag}
            onEntityClick={(entity) => {
              setSelected({ kind: "entity", id: entity.id });
              setTool(TOOL.SELECT);
              if (entity.type === ENTITY_TYPE.VMETER || entity.type === ENTITY_TYPE.AMETER) setMeterViewId(entity.id);
            }}
          />

          {meterEntity && (
            <MeterModal
              entity={meterEntity}
              analysis={analysis}
              sol={sol}
              onClose={() => setMeterViewId(null)}
            />
          )}

          <PhasorModal
            analysis={analysis}
            ac={ac}
            open={phasorOpen}
            voltagePhasors={voltagePhasors}
            currentPhasors={currentPhasors}
            phasorMode={phasorMode}
            setPhasorMode={setPhasorMode}
            onClose={() => setPhasorOpen(false)}
          />

          {probedNode !== null && (
            <ProbeModal
              nodeId={probedNode}
              analysis={analysis}
              sol={sol}
              onClose={() => setProbedNode(null)}
            />
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/70">
            <div>
              Mode: <span className="text-white">{tool === TOOL.SELECT ? "Select/Move" : tool === TOOL.WIRE ? "Wire" : `Place ${tool}`}</span>
              {pendingWire && <span className="ml-3 text-[#ffd60a]">(click another terminal to finish wire)</span>}
            </div>
            <div>Tips: R to rotate • Delete to remove • Snap {GRID}px</div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
