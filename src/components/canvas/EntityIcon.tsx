import type { Entity } from "../../types";
import { worldTerminals } from "../../utils/entities";

function drawLabel(entity: Entity) {
  return (
    <text
      x={entity.x}
      y={entity.y - 18}
      textAnchor="middle"
      fontSize={10}
      fill="#c7d2fe"
      style={{ userSelect: "none" }}
    >
      {entity.label || entity.type.toUpperCase()}
    </text>
  );
}

export function EntityIcon({ entity }: { entity: Entity }) {
  const terminals = worldTerminals(entity);
  const [A, B] = terminals;
  const shapes: React.ReactNode[] = [];

  if (entity.type === "ground") {
    const { x, y } = entity;
    shapes.push(<line key="g1" x1={x} y1={y - 8} x2={x} y2={y} stroke="#9fb0d0" strokeWidth={2} />);
    shapes.push(<line key="g2" x1={x - 8} y1={y} x2={x + 8} y2={y} stroke="#9fb0d0" strokeWidth={2} />);
    shapes.push(<line key="g3" x1={x - 6} y1={y + 4} x2={x + 6} y2={y + 4} stroke="#9fb0d0" strokeWidth={2} />);
    shapes.push(<line key="g4" x1={x - 4} y1={y + 8} x2={x + 4} y2={y + 8} stroke="#9fb0d0" strokeWidth={2} />);
  } else if (entity.type === "resistor") {
    const w = 36;
    const h = 12;
    shapes.push(<line key="r1" x1={A.x} y1={A.y} x2={entity.x - w / 2} y2={entity.y} stroke="#9fb0d0" strokeWidth={2} />);
    shapes.push(<rect key="r2" x={entity.x - w / 2} y={entity.y - h / 2} width={w} height={h} fill="#314070" stroke="#9fb0d0" />);
    shapes.push(<line key="r3" x1={entity.x + w / 2} y1={entity.y} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2} />);
  } else if (entity.type === "capacitor") {
    const gap = 8;
    const plate = 10;
    shapes.push(<line key="c1" x1={A.x} y1={A.y} x2={entity.x - gap} y2={entity.y} stroke="#9fb0d0" strokeWidth={2} />);
    shapes.push(
      <line key="c2" x1={entity.x - gap} y1={entity.y - plate} x2={entity.x - gap} y2={entity.y + plate} stroke="#9fb0d0" strokeWidth={2} />,
    );
    shapes.push(
      <line key="c3" x1={entity.x + gap} y1={entity.y - plate} x2={entity.x + gap} y2={entity.y + plate} stroke="#9fb0d0" strokeWidth={2} />,
    );
    shapes.push(<line key="c4" x1={entity.x + gap} y1={entity.y} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2} />);
  } else if (entity.type === "inductor") {
    const r = 6;
    const loops = 4;
    shapes.push(
      <line key="l1" x1={A.x} y1={A.y} x2={entity.x - loops * r} y2={entity.y} stroke="#9fb0d0" strokeWidth={2} />,
    );
    for (let i = 0; i < loops; i += 1) {
      const x = entity.x - (loops - 1) * r + i * 2 * r;
      shapes.push(
        <path
          key={`arc-${i}`}
          d={`M ${x - r} ${entity.y} a ${r} ${r} 0 1 0 ${2 * r} 0`}
          fill="none"
          stroke="#9fb0d0"
          strokeWidth={2}
        />,
      );
    }
    shapes.push(
      <line key="l2" x1={entity.x + loops * r} y1={entity.y} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2} />,
    );
  } else if (entity.type === "vsrc" || entity.type === "isrc") {
    const r = 14;
    shapes.push(<line key="s1" x1={A.x} y1={A.y} x2={entity.x - r} y2={entity.y} stroke="#9fb0d0" strokeWidth={2} />);
    shapes.push(<circle key="s2" cx={entity.x} cy={entity.y} r={r} fill="#0b1020" stroke="#9fb0d0" />);
    if (entity.type === "vsrc") {
      shapes.push(
        <text key="plus" x={entity.x - 5} y={entity.y - 2} fontSize={12} fill="#9fb0d0">
          +
        </text>,
      );
      shapes.push(
        <text key="minus" x={entity.x + 2} y={entity.y + 10} fontSize={12} fill="#9fb0d0">
          -
        </text>,
      );
    } else {
      shapes.push(
        <polygon key="arrow" points={`${entity.x - 4},${entity.y} ${entity.x + 4},${entity.y} ${entity.x},${entity.y - 8}`} fill="#9fb0d0" />,
      );
    }
    shapes.push(<line key="s3" x1={entity.x + r} y1={entity.y} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2} />);
  } else if (entity.type === "vmeter" || entity.type === "ameter") {
    const r = 14;
    shapes.push(<line key="m1" x1={A.x} y1={A.y} x2={entity.x - r} y2={entity.y} stroke="#9fb0d0" strokeWidth={2} />);
    shapes.push(<circle key="m2" cx={entity.x} cy={entity.y} r={r} fill="#0b1020" stroke="#ffd60a" />);
    shapes.push(
      <text key="m3" x={entity.x} y={entity.y + 4} textAnchor="middle" fontSize={12} fill="#ffd60a">
        {entity.type === "vmeter" ? "V" : "A"}
      </text>,
    );
    shapes.push(<line key="m4" x1={entity.x + r} y1={entity.y} x2={B.x} y2={B.y} stroke="#9fb0d0" strokeWidth={2} />);
  }

  return (
    <g>
      {shapes}
      {drawLabel(entity)}
    </g>
  );
}
