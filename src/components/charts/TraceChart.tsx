import { useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { TracePoint } from "../../types";
import { formatI, formatV } from "../../utils/formatters";

type TraceChartProps = {
  points: TracePoint[];
  unit: "V" | "A";
  width?: number;
  height?: number;
};

export function TraceChart({ points, unit, width = 560, height = 160 }: TraceChartProps) {
  const [frozenPoints, setFrozenPoints] = useState<TracePoint[] | null>(null);
  const [cursorX, setCursorX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const activePoints = frozenPoints ?? points;
  const padL = 34;
  const padR = 6;
  const padT = 10;
  const padB = 20;
  const W = width - padL - padR;
  const H = height - padT - padB;

  const count = activePoints.length;
  const t0 = count ? activePoints[0].t : 0;
  const t1 = count ? activePoints[count - 1].t : 1;
  const rawMin = count ? Math.min(...activePoints.map((point) => point.v)) : 0;
  const rawMax = count ? Math.max(...activePoints.map((point) => point.v)) : 1;
  const eps = Math.max(1e-9, Math.abs(rawMax || 1) * 0.02);
  const min = rawMin === rawMax ? rawMin - eps : rawMin;
  const max = rawMin === rawMax ? rawMax + eps : rawMax;
  const dt = Math.max(1e-6, t1 - t0);

  const mapX = (t: number) => padL + ((t - t0) / dt) * W;
  const mapY = (v: number) => padT + (1 - (v - min) / (max - min)) * H;
  const polyline = count ? activePoints.map((point) => `${mapX(point.t)},${mapY(point.v)}`).join(" ") : "";

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, index) => min + (index * (max - min)) / ticks);
  const xTicks = Array.from({ length: ticks + 1 }, (_, index) => t0 + (index * dt) / ticks);

  const handleDoubleClick = () => {
    if (frozenPoints) {
      setFrozenPoints(null);
      setCursorX(null);
      return;
    }

    setFrozenPoints([...points]);
  };

  const handleMouseMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!frozenPoints || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x >= padL && x <= padL + W) {
      setCursorX(x);
      return;
    }

    setCursorX(null);
  };

  const handleMouseLeave = () => {
    setCursorX(null);
  };

  let cursorPoint: TracePoint | null = null;
  if (cursorX !== null && count > 0) {
    const hoveredTime = t0 + ((cursorX - padL) / W) * dt;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const point of activePoints) {
      const distance = Math.abs(point.t - hoveredTime);
      if (distance < closestDistance) {
        closestDistance = distance;
        cursorPoint = point;
      }
    }
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="mx-auto block"
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: frozenPoints ? "crosshair" : "default", userSelect: "none" }}
    >
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
      {cursorPoint && (() => {
        const cx = mapX(cursorPoint.t);
        const cy = mapY(cursorPoint.v);
        const showLeft = cx > padL + W - 90;
        const showBelow = cy - 36 < padT;
        const rectX = showLeft ? cx - 88 : cx + 8;
        const textX = showLeft ? cx - 82 : cx + 14;
        const rectY = showBelow ? cy + 4 : cy - 36;
        const textY = showBelow ? cy + 18 : cy - 20;

        return (
          <g style={{ pointerEvents: "none" }}>
            <line x1={cx} y1={padT} x2={cx} y2={padT + H} stroke="#ffffff88" strokeWidth={1} strokeDasharray="4 2" />
            <circle cx={cx} cy={cy} r={4} fill="#ffd60a" />
            <rect x={rectX} y={rectY} width={80} height={32} fill="#000000bb" rx={4} />
            <text x={textX} y={textY} fontSize={10} fill="#ffffff">
              {unit === "V" ? formatV(cursorPoint.v) : formatI(cursorPoint.v)}
            </text>
            <text x={textX} y={textY + 14} fontSize={10} fill="#a1a1aa">
              t: {cursorPoint.t.toFixed(3)}s
            </text>
          </g>
        );
      })()}
      {frozenPoints && !cursorPoint && (
        <text x={padL + W / 2} y={padT + 10} fontSize={10} fill="#ffd60a" textAnchor="middle" style={{ pointerEvents: "none" }}>
          Paused (Double-click to resume)
        </text>
      )}
      <text x={padL + W / 2} y={height - 4} fontSize={10} fill="#9fb0d0" textAnchor="middle">
        time (s)
      </text>
      <text x={8} y={12} fontSize={10} fill="#9fb0d0">
        {unit}
      </text>
    </svg>
  );
}
