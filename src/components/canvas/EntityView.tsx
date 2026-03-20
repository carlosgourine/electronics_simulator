import type React from "react";
import { getCurrentInstant } from "../../engine/measurements";
import { useTimeStore } from "../../store/useTimeStore";
import type { Analysis, Entity, Solution } from "../../types";
import { worldTerminals } from "../../utils/entities";
import { EntityIcon } from "./EntityIcon";

type EntityViewProps = {
  entity: Entity;
  selected: boolean;
  onMouseDown: (entity: Entity, event: React.MouseEvent) => void;
  onClick: () => void;
  analysis: Analysis;
  sol: Solution;
};

export function EntityView({ entity, selected, onMouseDown, onClick, analysis, sol }: EntityViewProps) {
  const t = useTimeStore((state) => state.t);
  const running = useTimeStore((state) => state.running);
  const current = running ? getCurrentInstant(entity, sol, analysis, t) : null;
  const terminals = worldTerminals(entity);
  const A = terminals[0];
  const B = terminals[1];
  const flow = current ?? 0;
  const direction = Math.sign(flow) || 1;
  const dash = 10;
  const dashOffset = ((t * 60) * direction) % (dash * 2);

  return (
    <g
      onMouseDown={(event) => onMouseDown(entity, event)}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      style={{ cursor: "move" }}
    >
      {selected && <rect x={entity.x - 26} y={entity.y - 26} width={52} height={52} fill="none" stroke="#ffd60a" strokeDasharray="4 3" />}
      {running && A && B && Number.isFinite(flow) && Math.abs(flow) > 0 && (
        <line
          x1={A.x}
          y1={A.y}
          x2={B.x}
          y2={B.y}
          stroke="#ffd60a"
          strokeWidth={3}
          strokeDasharray={`${dash} ${dash}`}
          strokeDashoffset={dashOffset}
          opacity={0.6}
        />
      )}
      <EntityIcon entity={entity} />
    </g>
  );
}
