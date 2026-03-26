import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { CircuitCanvas } from "./components/canvas/CircuitCanvas";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PhasorModal } from "./components/modals/PhasorModal";
import { ProbeModal } from "./components/modals/ProbeModal";
import { Sidebar } from "./components/panels/Sidebar";
import { StatusBar } from "./components/panels/StatusBar";
import { collectCurrentPhasors, collectVoltagePhasors } from "./engine/measurements";
import { solveAC } from "./engine/solveAC";
import { solveDC } from "./engine/solveDC";
import { useCircuit } from "./hooks/useCircuit";
import { useDraggable } from "./hooks/useDraggable";
import { useKey } from "./hooks/useKey";
import { useTimeStore } from "./store/useTimeStore";
import { useUIStore } from "./store/useUIStore";
import type { Entity, EntityType, PhasorMode, ProbeData, Terminal } from "./types";
import { ANALYSIS, TOOL } from "./types";
import { worldTerminals } from "./utils/entities";
import { getMousePosition, hitTerminal } from "./utils/geometry";
import { parseHz } from "./utils/parser";

export default function App() {
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
  const tool = useUIStore((state) => state.tool);
  const setTool = useUIStore((state) => state.setTool);
  const analysis = useUIStore((state) => state.analysis);
  const acFreq = useUIStore((state) => state.acFreq);
  const [pendingWire, setPendingWire] = useState<{ aTerm: string } | null>(null);
  const [hoverTerm, setHoverTerm] = useState<Terminal | null>(null);
  const [probeData, setProbeData] = useState<ProbeData | null>(null);
  const [phasorOpen, setPhasorOpen] = useState(false);
  const [phasorMode, setPhasorMode] = useState<PhasorMode>("components");

  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const running = useTimeStore((state) => state.running);
  const tick = useTimeStore((state) => state.tick);
  const toggleRunning = useTimeStore((state) => state.toggleRunning);

  const selectedEntity = entities.find((entity) => selected.kind === "entity" && entity.id === selected.id) || null;

  // Build a fast lookup of all visible terminals so the canvas can hit-test wires and probe targets.
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
    // Time only advances while "Run" is enabled. Charts and instantaneous AC probe values read from this store.
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
    if ((probeData?.type === "i-entity" || probeData?.type === "v-entity") && probeData.id === entityId) {
      setProbeData(null);
    }
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
      case "p":
        if (analysis !== ANALYSIS.AC) break;
        event.preventDefault();
        setPhasorOpen((value) => !value);
        break;
      case "escape":
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

    const point = getMousePosition(svg, event);

    if (tool === TOOL.PROBE_V) {
      // Voltage probes resolve to either a node ID or a component-level measurement target.
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
      // A two-click interaction builds wires terminal-to-terminal.
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
    const point = getMousePosition(svg, event);
    setHoverTerm(hitTerminal(terminalMap.values(), point.x, point.y));
  }

  const startDrag = useDraggable({
    getMouseCoord: (event) => {
      const svg = svgRef.current;
      return svg ? getMousePosition(svg, event) : { x: 0, y: 0 };
    },
    moveEntity,
    finishDrag: snapEntityToGrid,
    onDragStart: (entity) => {
      setTool(TOOL.SELECT);
      setSelected({ kind: "entity", id: entity.id });
    },
  });

  // These collections are derived views of the active AC solution for the phasor modal.
  const voltagePhasors = useMemo(() => collectVoltagePhasors(entities, ac, phasorMode), [ac, entities, phasorMode]);
  const currentPhasors = useMemo(() => collectCurrentPhasors(entities, ac, phasorMode), [ac, entities, phasorMode]);
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
          running={running}
          onToggleRunning={toggleRunning}
          setPhasorOpen={setPhasorOpen}
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
            terminalMap={terminalMap}
            pendingWire={pendingWire}
            hoverTerm={hoverTerm}
            sol={sol}
            onCanvasClick={onCanvasClick}
            onMouseMove={onMouseMove}
            onContextMenu={handleContextMenu}
            onWireMouseDown={handleWireMouseDown}
            onEntityMouseDown={handleEntityMouseDown}
            onEntityClick={handleEntityClick}
            onTerminalClick={handleTerminalClick}
          />

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

          <StatusBar tool={tool} pendingWire={Boolean(pendingWire)} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
