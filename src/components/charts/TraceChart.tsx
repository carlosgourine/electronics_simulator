import type { TracePoint } from "../../types";
import { formatI, formatV } from "../../utils/formatters";

type TraceChartProps = {
  points: TracePoint[];
  unit: "V" | "A";
  width?: number;
  height?: number;
};

export function TraceChart({ points, unit, width = 560, height = 160 }: TraceChartProps) {
  const padL = 34;
  const padR = 6;
  const padT = 10;
  const padB = 20;
  const W = width - padL - padR;
  const H = height - padT - padB;

  const count = points.length;
  const t0 = count ? points[0].t : 0;
  const t1 = count ? points[count - 1].t : 1;
  const rawMin = count ? Math.min(...points.map((point) => point.v)) : 0;
  const rawMax = count ? Math.max(...points.map((point) => point.v)) : 1;
  const eps = Math.max(1e-9, Math.abs(rawMax || 1) * 0.02);
  const min = rawMin === rawMax ? rawMin - eps : rawMin;
  const max = rawMin === rawMax ? rawMax + eps : rawMax;
  const dt = Math.max(1e-6, t1 - t0);

  const mapX = (t: number) => padL + ((t - t0) / dt) * W;
  const mapY = (v: number) => padT + (1 - (v - min) / (max - min)) * H;
  const polyline = count ? points.map((point) => `${mapX(point.t)},${mapY(point.v)}`).join(" ") : "";

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, index) => min + (index * (max - min)) / ticks);
  const xTicks = Array.from({ length: ticks + 1 }, (_, index) => t0 + (index * dt) / ticks);

  return (
    <svg width={width} height={height} className="mx-auto block">
      <rect x={0} y={0} width={width} height={height} fill="#0c1430" rx={8} />
      <line x1={padL} y1={padT} x2={padL} y2={padT + H} stroke="#ffffff22" />
      <line x1={padL} y1={padT + H} x2={padL + W} y2={padT + H} stroke="#ffffff22" />
      {yTicks.map((value, index) => (
        <g key={`y-${index}`}>
          <line x1={padL} y1={mapY(value)} x2={padL + W} y2={mapY(value)} stroke="#ffffff10" />
          <text x={padL - 6} y={mapY(value) + 3} fontSize={10} fill="#9fb0d0" textAnchor="end">
            {unit === "V" ? formatV(value) : formatI(value)}
          </text>
        </g>
      ))}
      {xTicks.map((value, index) => (
        <g key={`x-${index}`}>
          <line x1={mapX(value)} y1={padT} x2={mapX(value)} y2={padT + H} stroke="#ffffff10" />
          <text x={mapX(value)} y={padT + H + 12} fontSize={10} fill="#9fb0d0" textAnchor="middle">
            {(value - t0).toFixed(1)}s
          </text>
        </g>
      ))}
      {count > 0 && <polyline points={polyline} fill="none" stroke="#ffd60a" strokeWidth={2} />}
      <text x={padL + W / 2} y={height - 4} fontSize={10} fill="#9fb0d0" textAnchor="middle">
        time (s)
      </text>
      <text x={8} y={12} fontSize={10} fill="#9fb0d0">
        {unit}
      </text>
    </svg>
  );
}
