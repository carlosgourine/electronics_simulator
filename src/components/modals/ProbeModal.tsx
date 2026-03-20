import { useMemo } from "react";
import { getCurrentInstant, getCurrentPhasor, getVoltagePhasor } from "../../engine/measurements";
import { SmoothTrace } from "../charts/SmoothTrace";
import { useTimeStore } from "../../store/useTimeStore";
import { ANALYSIS } from "../../types";
import { formatI, formatV } from "../../utils/formatters";
import { C0, cAbs } from "../../utils/math";
import type { ACSolution, DCSolution, Entity, Solution } from "../../types";

type ProbeData =
  | { type: "v-node"; id: string }
  | { type: "v-entity"; id: string }
  | { type: "i-node"; id: string }
  | { type: "i-entity"; id: string };

type ProbeModalProps = {
  probeData: ProbeData;
  entities: Entity[];
  analysis: "dc" | "ac";
  sol: Solution;
  onClose: () => void;
};

export function ProbeModal({ probeData, entities, analysis, sol, onClose }: ProbeModalProps) {
  const t = useTimeStore((state) => state.t);

  const probedEntity = useMemo(
    () => (probeData.type.endsWith("entity") ? entities.find((entity) => entity.id === probeData.id) || null : null),
    [entities, probeData],
  );
  const dcSol = analysis === ANALYSIS.DC ? (sol as DCSolution) : null;
  const acSol = analysis === ANALYSIS.AC ? (sol as ACSolution) : null;

  const reading = useMemo(() => {
    if (!sol.ok) return null;

    if (probeData.type === "v-node") {
      const nodeId = Number(probeData.id);
      if (dcSol) return dcSol.V.get(nodeId) || 0;
      const phasor = acSol?.V.get(nodeId) || C0(0, 0);
      const omega = acSol?.omega || 0;
      return phasor.re * Math.cos(omega * t) - phasor.im * Math.sin(omega * t);
    }

    if (probeData.type === "v-entity") {
      if (!probedEntity) return null;
      const phasor = getVoltagePhasor(probedEntity, sol, analysis);
      if (!phasor) return null;
      if (dcSol) return phasor.re;
      const omega = acSol?.omega || 0;
      return phasor.re * Math.cos(omega * t) - phasor.im * Math.sin(omega * t);
    }

    if (probeData.type === "i-entity") {
      if (!probedEntity) return null;
      return getCurrentInstant(probedEntity, sol, analysis, t);
    }

    return 0;
  }, [acSol, analysis, dcSol, probeData, probedEntity, sol, t]);

  const title = probeData.type.startsWith("v") ? "Voltage Probe" : "Current Probe";

  const renderBody = () => {
    if (!sol.ok) {
      return <div className="text-sm text-[#ffadad]">{sol.reason || "Solver not ready."}</div>;
    }

    if (probeData.type === "v-node") {
      return (
        <>
          <div className="mb-2 text-center text-5xl font-semibold text-white">{formatV(reading || 0)}</div>
          <div className="mb-2 text-center text-xs text-white/50">Node {probeData.id} (Relative to Ground)</div>
          <SmoothTrace probeData={probeData} entities={entities} analysis={analysis} sol={sol} />
        </>
      );
    }

    if (probeData.type === "v-entity") {
      const label = probedEntity?.label || probedEntity?.type || "component";
      return (
        <>
          <div className="mb-2 text-center text-5xl font-semibold text-white">{formatV(reading || 0)}</div>
          <div className="mb-2 text-center text-xs text-white/50">Voltage drop across {label}</div>
          <SmoothTrace probeData={probeData} entities={entities} analysis={analysis} sol={sol} />
        </>
      );
    }

    if (probeData.type === "i-entity") {
      const label = probedEntity?.label || probedEntity?.type || "component";
      const phasor = probedEntity ? getCurrentPhasor(probedEntity, sol, analysis) : null;
      const isAC = analysis === ANALYSIS.AC && phasor;
      return (
        <>
          <div className="mb-2 text-center text-5xl font-semibold text-[#ffd60a]">{formatI(reading || 0)}</div>
          <div className="mb-2 text-center text-xs text-white/50">Current through {label}</div>
          {isAC && (
            <div className="mb-2 text-center text-xs text-white/50">
              |I| = {formatI(cAbs(phasor || C0()))}
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
