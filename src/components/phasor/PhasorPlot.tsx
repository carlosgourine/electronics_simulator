import type { PhasorItem } from "../../types";
import { formatDeg, formatI, formatV } from "../../utils/formatters";
import { cAbs, cArg } from "../../utils/math";

type PhasorPlotProps = {
  items: PhasorItem[];
  unit: "V" | "A";
  width?: number;
  height?: number;
};

export function PhasorPlot({ items, unit, width = 700, height = 420 }: PhasorPlotProps) {
  const magnitudes = items.map((item) => cAbs(item.ph));
  const maxMagnitude = Math.max(1e-12, ...magnitudes);
  const margin = 40;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - margin;
  const scale = (value: number) => (value / maxMagnitude) * radius;
  const axes = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

  const pointFor = (item: PhasorItem) => {
    const r = scale(cAbs(item.ph));
    const angle = cArg(item.ph);
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),
    };
  };

  return (
    <svg width={width} height={height} className="mx-auto block">
      <rect x={0} y={0} width={width} height={height} fill="#0c1430" rx={8} />
      <line x1={margin / 2} y1={cy} x2={width - margin / 2} y2={cy} stroke="#ffffff22" />
      <line x1={cx} y1={margin / 2} x2={cx} y2={height - margin / 2} stroke="#ffffff22" />
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#ffffff10" />
      <circle cx={cx} cy={cy} r={radius * 0.5} fill="none" stroke="#ffffff10" />
      {axes.map((angle, index) => (
        <g key={`axis-${index}`}>
          <line x1={cx} y1={cy} x2={cx + radius * Math.cos(angle)} y2={cy - radius * Math.sin(angle)} stroke="#ffffff08" />
          <text
            x={cx + (radius + 12) * Math.cos(angle)}
            y={cy - (radius + 12) * Math.sin(angle)}
            fontSize={10}
            fill="#9fb0d0"
            textAnchor="middle"
          >
            {formatDeg(angle)}
          </text>
        </g>
      ))}
      {items.map((item, index) => {
        const point = pointFor(item);
        const color = item.color || "#ffd60a";
        return (
          <g key={`phasor-${index}`}>
            <line x1={cx} y1={cy} x2={point.x} y2={point.y} stroke={color} strokeWidth={2} />
            <circle cx={point.x} cy={point.y} r={3} fill={color} />
            <text x={point.x} y={point.y} dx={5} dy={-4} fontSize={10} fill={color}>
              {item.label}
            </text>
          </g>
        );
      })}
      <text x={8} y={16} fontSize={10} fill="#9fb0d0">
        max |{unit}| = {unit === "V" ? formatV(maxMagnitude) : formatI(maxMagnitude)}
      </text>
    </svg>
  );
}
