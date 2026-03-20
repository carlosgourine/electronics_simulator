import type { PhasorItem } from "../../types";
import { formatDeg, formatI, formatV } from "../../utils/formatters";
import { cAbs, cArg } from "../../utils/math";

type PhasorLegendProps = {
  items: PhasorItem[];
  unit: "V" | "A";
};

export function PhasorLegend({ items, unit }: PhasorLegendProps) {
  const rows = items
    .map((item) => ({
      label: item.label,
      magnitude: cAbs(item.ph),
      angle: cArg(item.ph),
      color: item.color || "#ffd60a",
    }))
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 24);

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/80">
      {rows.map((row, index) => (
        <div key={`legend-${index}`} className="flex items-center justify-between rounded-lg bg-white/5 p-2">
          <div className="flex truncate items-center gap-2 pr-2">
            <span style={{ background: row.color, width: 10, height: 10, borderRadius: 3, display: "inline-block" }} />
            <span className="truncate">{row.label}</span>
          </div>
          <div className="whitespace-nowrap text-right">
            {unit === "V" ? formatV(row.magnitude) : formatI(row.magnitude)} • {formatDeg(row.angle)}
          </div>
        </div>
      ))}
    </div>
  );
}
