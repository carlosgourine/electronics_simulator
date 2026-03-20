import type React from "react";
import { CANVAS_H, CANVAS_W, GRID } from "../../constants/config";
import type { Entity, Selection, Solution, Terminal, Tool, Wire } from "../../types";
import { TOOL } from "../../types";
import { nodeColor } from "../../utils/geometry";
import { EntityView } from "./EntityView";

type CircuitCanvasProps = {
  svgRef: React.RefObject<SVGSVGElement | null>;
  entities: Entity[];
  wires: Wire[];
  selected: Selection;
  termIndex: Map<string, Terminal>;
  tool: Tool;
  pendingWire: { aTerm: string } | null;
  hoverTerm: Terminal | null;
  running: boolean;
  t: number;
  showNodes: boolean;
  sol: Solution;
  onCanvasClick: (event: React.MouseEvent<SVGSVGElement>) => void;
  onMouseMove: (event: React.MouseEvent<SVGSVGElement>) => void;
  onWireMouseDown: (wireId: string, event: React.MouseEvent) => void;
  onEntityMouseDown: (entity: Entity, event: React.MouseEvent) => void;
  onEntityClick: (entity: Entity) => void;
  getEntityCurrent: (entity: Entity) => number | null;
  getEntityVoltage: (entity: Entity) => number | null;
};

export function CircuitCanvas({
  svgRef,
  entities,
  wires,
  selected,
  termIndex,
  tool,
  pendingWire,
  hoverTerm,
  running,
  t,
  showNodes,
  sol,
  onCanvasClick,
  onMouseMove,
  onWireMouseDown,
  onEntityMouseDown,
  onEntityClick,
  getEntityCurrent,
  getEntityVoltage,
}: CircuitCanvasProps) {
  return (
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

        const isSelected = selected.kind === "wire" && selected.id === wire.id;
        return (
          <g key={wire.id} onMouseDown={(event) => onWireMouseDown(wire.id, event)}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isSelected ? "#ffd60a" : "#93a1c6"} strokeWidth={isSelected ? 4 : 3} />
          </g>
        );
      })}

      {tool === TOOL.WIRE && pendingWire && hoverTerm && (() => {
        const a = termIndex.get(pendingWire.aTerm);
        if (!a) return null;
        return <line x1={a.x} y1={a.y} x2={hoverTerm.x} y2={hoverTerm.y} stroke="#ffd60a" strokeDasharray="6 4" strokeWidth={2} />;
      })()}

      {entities.map((entity) => (
        <EntityView
          key={entity.id}
          entity={entity}
          selected={selected.kind === "entity" && selected.id === entity.id}
          onMouseDown={onEntityMouseDown}
          onClick={() => onEntityClick(entity)}
          running={running}
          t={t}
          current={getEntityCurrent(entity)}
          voltage={getEntityVoltage(entity)}
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
  );
}
