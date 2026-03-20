import { getCurrentPhasor, getMagnitudeAndAngle, getVoltagePhasor } from "../../engine/measurements";
import type { Analysis, Entity, Solution } from "../../types";
import { formatDeg, formatI, formatV } from "../../utils/formatters";

type ResultsPanelProps = {
  entity: Entity;
  sol: Solution;
  analysis: Analysis;
};

export function ResultsPanel({ entity, sol, analysis }: ResultsPanelProps) {
  if (!sol.ok) return <div className="text-xs text-[#ffadad]">{sol.reason || "Not solved"}</div>;

  const voltage = getVoltagePhasor(entity, sol, analysis);
  const current = getCurrentPhasor(entity, sol, analysis);

  if (analysis === "dc") {
    const V = voltage?.re ?? Number.NaN;
    const I = current?.re ?? Number.NaN;
    return (
      <div className="text-sm">
        <div>
          V<sub>AB</sub>: <b>{Number.isFinite(V) ? formatV(V) : "-"}</b>
        </div>
        <div>
          I: <b>{Number.isFinite(I) ? formatI(I) : "-"}</b>
        </div>
      </div>
    );
  }

  const voltageMeta = getMagnitudeAndAngle(voltage);
  const currentMeta = getMagnitudeAndAngle(current);

  return (
    <div className="text-sm">
      <div>
        V: <b>{Number.isFinite(voltageMeta.magnitude) ? formatV(voltageMeta.magnitude) : "-"}</b> • angle{" "}
        {Number.isFinite(voltageMeta.angle) ? formatDeg(voltageMeta.angle) : "-"}
      </div>
      <div>
        I: <b>{Number.isFinite(currentMeta.magnitude) ? formatI(currentMeta.magnitude) : "-"}</b> • angle{" "}
        {Number.isFinite(currentMeta.angle) ? formatDeg(currentMeta.angle) : "-"}
      </div>
    </div>
  );
}
