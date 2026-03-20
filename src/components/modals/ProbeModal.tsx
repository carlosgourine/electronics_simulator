import { useEffect, useState } from "react";
import { getCurrentInstant } from "../../engine/measurements";
import { useTimeStore } from "../../store/useTimeStore";
import { ANALYSIS } from "../../types";
import { formatI, formatV } from "../../utils/formatters";
import { TraceChart } from "../charts/TraceChart";
import type { ACSolution, Analysis, DCSolution, Entity, TracePoint } from "../../types";

type VoltageProbeProps = {
  mode: "v";
  nodeId: number;
  analysis: Analysis;
  sol: DCSolution | ACSolution;
  onClose: () => void;
};

type CurrentProbeProps = {
  mode: "i";
  entity: Entity;
  analysis: Analysis;
  sol: DCSolution | ACSolution;
  onClose: () => void;
};

type ProbeModalProps = VoltageProbeProps | CurrentProbeProps;

export function ProbeModal(props: ProbeModalProps) {
  const { analysis, sol, onClose } = props;
  const t = useTimeStore((state) => state.t);
  const [trace, setTrace] = useState<TracePoint[]>([]);

  const isVoltageProbe = props.mode === "v";

  const reading =
    !sol.ok
      ? null
      : isVoltageProbe
        ? analysis === ANALYSIS.DC
          ? (sol as DCSolution).V.get(props.nodeId) ?? 0
          : (() => {
              const ac = sol as ACSolution;
              const phasor = ac.V.get(props.nodeId);
              if (!phasor) return 0;
              return phasor.re * Math.cos(ac.omega * t) - phasor.im * Math.sin(ac.omega * t);
            })()
        : getCurrentInstant(props.entity, sol, analysis, t);

  useEffect(() => {
    setTrace([]);
  }, [isVoltageProbe, props.mode, props.mode === "v" ? props.nodeId : props.entity.id]);

  useEffect(() => {
    if (reading == null || !Number.isFinite(reading)) return;

    setTrace((current) => {
      const point = { t, v: reading };
      const next =
        current.length > 0 && current[current.length - 1].t === point.t
          ? current.slice(0, -1).concat(point)
          : current.concat(point);
      const maxPoints = 600;
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
  }, [reading, t]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="min-w-[420px] rounded-2xl border border-white/10 bg-[#0b1020] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm uppercase tracking-wide text-white/70">
            {isVoltageProbe ? `🔍 Voltage Probe (Node ${props.nodeId})` : `🔍 Current Probe (${props.entity.label || props.entity.type})`}
          </div>
          <button className="rounded-lg border border-white/10 px-2 py-1 hover:border-white/30" onClick={onClose}>
            x
          </button>
        </div>

        <div className="mb-2 text-center text-5xl font-semibold text-white">
          {reading == null ? "-" : isVoltageProbe ? formatV(reading) : formatI(reading)}
        </div>
        {isVoltageProbe && <div className="mb-2 text-center text-xs text-white/50">Measured relative to Ground (Node 0)</div>}
        <TraceChart points={trace} unit={isVoltageProbe ? "V" : "A"} />
      </div>
    </div>
  );
}
