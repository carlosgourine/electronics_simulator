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
import { useCircuit } from "./hooks/useCircuit";
import { useDraggable } from "./hooks/useDraggable";
import { useKey } from "./hooks/useKey";
import { useTimeStore } from "./store/useTimeStore";
import type { Analysis, Entity, EntityType, PhasorMode, Terminal, Tool } from "./types";
import { ANALYSIS, ENTITY_TYPE, TOOL } from "./types";
import { worldTerminals } from "./utils/entities";
import { hitTerminal, snap } from "./utils/geometry";
import { parseHz } from "./utils/parser";

function getMouse(svg: SVGSVGElement, event: React.MouseEvent | MouseEvent) {
  const rect = svg.getBoundingClientRect();
  return {
    x: snap(event.clientX - rect.left),
    y: snap(event.clientY - rect.top),
  };
}

export default function App() {
  const [tool, setTool] = useState<Tool>(TOOL.SELECT);
  const {
    entities,
    wires,
    selected,
    setSelected,
    addEntity,
    addWire,
    updateEntity,
    moveEntity,
    snapEntityToGrid,
    deleteEntity: deleteCircuitEntity,
    deleteWire,
  } = useCircuit();
  const [pendingWire, setPendingWire] = useState<{ aTerm: string } | null>(null);
  const [hoverTerm, setHoverTerm] = useState<Terminal | null>(null);
  const [showNodes, setShowNodes] = useState(false);
  const [meterViewId, setMeterViewId] = useState<string | null>(null);
  const [probeData, setProbeData] = useState<
    { type: "v-node" | "v-entity" | "i-node" | "i-entity"; id: string } | null
  >(null);
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

  const terminalMap = useMemo(() => {
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
    deleteCircuitEntity(entityId);
    if (meterViewId === entityId) setMeterViewId(null);
    if ((probeData?.type === "i-entity" || probeData?.type === "v-entity") && probeData.id === entityId) setProbeData(null);
  }

  function rotateSelectedEntity() {
    if (!selectedEntity) return;
    updateEntity(selectedEntity.id, { rotation: ((selectedEntity.rotation || 0) + 90) % 360 });
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
        if (selectedEntity && (selectedEntity.type === ENTITY_TYPE.VMETER || selectedEntity.type === ENTITY_TYPE.AMETER)) {
          setMeterViewId(selectedEntity.id);
        }
        break;
      case "p":
        if (analysis !== ANALYSIS.AC) break;
        event.preventDefault();
        setPhasorOpen((value) => !value);
        break;
      case "escape":
        setMeterViewId(null);
        setProbeData(null);
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

  function updateSelected(patch: Partial<Entity>) {
    if (!selectedEntity) return;
    updateEntity(selectedEntity.id, patch);
  }

  function onCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;

    const point = getMouse(svg, event);

    if (tool === TOOL.PROBE_V) {
      if (hoverTerm) {
        const nodeId = sol.nodeOf.get(hoverTerm.id);
        if (nodeId !== undefined) setProbeData({ type: "v-node", id: String(nodeId) });
      } else {
        setProbeData(null);
      }
      return;
    }

    if (tool === TOOL.PROBE_I) {
      if (hoverTerm) setProbeData({ type: "i-node", id: hoverTerm.id });
      else setProbeData(null);
      return;
    }

    if (hoverTerm) {
      if (!pendingWire) {
        setPendingWire({ aTerm: hoverTerm.id });
      } else if (hoverTerm.id !== pendingWire.aTerm) {
        addWire(pendingWire.aTerm, hoverTerm.id);
        setPendingWire(null);
      }
      return;
    }

    if (tool !== TOOL.SELECT) {
      addEntity(tool as EntityType, point.x, point.y);
      return;
    }

    setSelected({ kind: null, id: null });
    setPendingWire(null);
  }

  function onMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const point = getMouse(svg, event);
    setHoverTerm(hitTerminal(terminalMap.values(), point.x, point.y));
  }

  const startDrag = useDraggable({
    getMouseCoord: (event) => {
      const svg = svgRef.current;
      return svg ? getMouse(svg, event) : { x: 0, y: 0 };
    },
    moveEntity,
    finishDrag: snapEntityToGrid,
    onDragStart: (entity) => {
      setTool(TOOL.SELECT);
      setSelected({ kind: "entity", id: entity.id });
    },
  });

  const voltagePhasors = useMemo(() => collectVoltagePhasors(entities, ac, phasorMode), [ac, entities, phasorMode]);
  const currentPhasors = useMemo(() => collectCurrentPhasors(entities, ac, phasorMode), [ac, entities, phasorMode]);

  const meterEntity = meterViewId ? entities.find((entity) => entity.id === meterViewId) || null : null;
  const omegaText = analysis === ANALYSIS.AC && sol.ok ? `omega = ${ac.omega.toFixed(2)} rad/s` : null;

  function handleContextMenu(event: React.MouseEvent<SVGSVGElement>) {
    event.preventDefault();
    setTool(TOOL.SELECT);
    setPendingWire(null);
    setProbeData(null);
  }

  function handleWireMouseDown(wireId: string, event: React.MouseEvent) {
    event.stopPropagation();
    setSelected({ kind: "wire", id: wireId });
  }

  function handleEntityMouseDown(entity: Entity, event: React.MouseEvent) {
    if (tool === TOOL.PROBE_I || tool === TOOL.PROBE_V) {
      event.stopPropagation();
      return;
    }
    startDrag(entity, event);
  }

  function handleEntityClick(entity: Entity) {
    if (tool === TOOL.PROBE_V) {
      setProbeData({ type: "v-entity", id: entity.id });
      return;
    }
    if (tool === TOOL.PROBE_I) {
      setProbeData({ type: "i-entity", id: entity.id });
      return;
    }

    setSelected({ kind: "entity", id: entity.id });
    setTool(TOOL.SELECT);

    if (entity.type === ENTITY_TYPE.VMETER || entity.type === ENTITY_TYPE.AMETER) {
      setMeterViewId(entity.id);
    }
  }

  function handleTerminalClick(terminal: Terminal) {
    if (tool === TOOL.PROBE_V) {
      const nodeId = sol.nodeOf.get(terminal.id);
      if (nodeId !== undefined) setProbeData({ type: "v-node", id: String(nodeId) });
      return;
    }

    if (tool === TOOL.PROBE_I) {
      setProbeData({ type: "i-node", id: terminal.id });
      return;
    }

    if (!pendingWire) {
      setPendingWire({ aTerm: terminal.id });
      return;
    }

    if (terminal.id === pendingWire.aTerm) return;

    addWire(pendingWire.aTerm, terminal.id);
    setPendingWire(null);
  }

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
            terminalMap={terminalMap}
            pendingWire={pendingWire}
            hoverTerm={hoverTerm}
            showNodes={showNodes}
            sol={sol}
            onCanvasClick={onCanvasClick}
            onMouseMove={onMouseMove}
            onContextMenu={handleContextMenu}
            onWireMouseDown={handleWireMouseDown}
            onEntityMouseDown={handleEntityMouseDown}
            onEntityClick={handleEntityClick}
            onTerminalClick={handleTerminalClick}
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

          {probeData && <ProbeModal probeData={probeData} entities={entities} analysis={analysis} sol={sol} onClose={() => setProbeData(null)} />}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/70">
            <div>
              Mode: <span className="text-white">{tool === TOOL.SELECT ? "Select/Move" : tool === TOOL.PROBE_V ? "Probe Voltage" : tool === TOOL.PROBE_I ? "Probe Current" : `Place ${tool}`}</span>
              {pendingWire && <span className="ml-3 text-[#ffd60a]">(click another terminal to finish wire)</span>}
            </div>
            <div>Tips: R to rotate • Right-click to cancel • Snap {GRID}px</div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
