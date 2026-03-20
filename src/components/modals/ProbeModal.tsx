import { useMemo } from "react";
import { getProbeValue } from "../../engine/measurements";
import { SmoothTrace } from "../charts/SmoothTrace";
import { useTimeStore } from "../../store/useTimeStore";
import { ANALYSIS } from "../../types";
import { formatI, formatV } from "../../utils/formatters";
import { cAbs } from "../../utils/math";
import type { Entity, ProbeData, Solution } from "../../types";

type ProbeModalProps = {
  probeData: ProbeData;
  entities: Entity[];
  analysis: "dc" | "ac";
  sol: Solution;
  onClose: () => void;
};

export function ProbeModal({ probeData, entities, analysis, sol, onClose }: ProbeModalProps) {
  const t = useTimeStore((state) => state.t);
  const { value, phasor, entity } = useMemo(
    () => getProbeValue(probeData, sol, entities, analysis, t),
    [analysis, entities, probeData, sol, t],
  );

  const title = probeData.type.startsWith("v") ? "Voltage Probe" : "Current Probe";

  const renderBody = () => {
    if (!sol.ok) {
      return <div className="text-sm text-[#ffadad]">{sol.reason || "Solver not ready."}</div>;
    }

    if (probeData.type === "v-node") {
      return (
        <>
          <div className="mb-2 text-center text-5xl font-semibold text-white">{formatV(value)}</div>
          <div className="mb-2 text-center text-xs text-white/50">Node {probeData.id} (Relative to Ground)</div>
          <SmoothTrace probeData={probeData} entities={entities} analysis={analysis} sol={sol} />
        </>
      );
    }

    if (probeData.type === "v-entity") {
      const label = entity?.label || entity?.type || "component";
      return (
        <>
          <div className="mb-2 text-center text-5xl font-semibold text-white">{formatV(value)}</div>
          <div className="mb-2 text-center text-xs text-white/50">Voltage drop across {label}</div>
          <SmoothTrace probeData={probeData} entities={entities} analysis={analysis} sol={sol} />
        </>
      );
    }

    if (probeData.type === "i-entity") {
      const label = entity?.label || entity?.type || "component";
      return (
        <>
          <div className="mb-2 text-center text-5xl font-semibold text-[#ffd60a]">{formatI(value)}</div>
          <div className="mb-2 text-center text-xs text-white/50">Current through {label}</div>
          {analysis === ANALYSIS.AC && (
            <div className="mb-2 text-center text-xs text-white/50">
              |I| = {formatI(cAbs(phasor))}
            </div>
          )}
          <SmoothTrace probeData={probeData} entities={entities} analysis={analysis} sol={sol} />
        </>
      );
    }

    return (
      <>
        <div className="mb-2 text-center text-5xl font-semibold text-[#ffd60a]">{formatI(0)}</div>
        <div className="text-center text-xs text-white/50">Node {probeData.id} (Sum of current at a node is always 0A)</div>
      </>
    );
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="min-w-[420px] rounded-2xl border border-white/10 bg-[#0b1020] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm uppercase tracking-wide text-white/70">{title}</div>
          <button className="text-white/60 hover:text-white" onClick={onClose}>
            x
          </button>
        </div>
        {renderBody()}
      </div>
    </div>
  );
}
