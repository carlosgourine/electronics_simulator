import { useEffect, useState } from "react";
import { useTimeStore } from "../../store/useTimeStore";
import { ANALYSIS } from "../../types";
import { formatV } from "../../utils/formatters";
import { TraceChart } from "../charts/TraceChart";
import type { ACSolution, Analysis, DCSolution, TracePoint } from "../../types";

type ProbeModalProps = {
  nodeId: number;
  analysis: Analysis;
  sol: DCSolution | ACSolution;
  onClose: () => void;
};

export function ProbeModal({ nodeId, analysis, sol, onClose }: ProbeModalProps) {
  const t = useTimeStore((state) => state.t);
  const [trace, setTrace] = useState<TracePoint[]>([]);

  const voltage =
    !sol.ok
      ? null
      : analysis === ANALYSIS.DC
        ? (sol as DCSolution).V.get(nodeId) ?? 0
        : (() => {
            const ac = sol as ACSolution;
            const phasor = ac.V.get(nodeId);
            if (!phasor) return 0;
            return phasor.re * Math.cos(ac.omega * t) - phasor.im * Math.sin(ac.omega * t);
          })();

  useEffect(() => {
    setTrace([]);
  }, [nodeId]);

  useEffect(() => {
    if (voltage == null || !Number.isFinite(voltage)) return;

    setTrace((current) => {
      const point = { t, v: voltage };
      const next =
        current.length > 0 && current[current.length - 1].t === point.t
          ? current.slice(0, -1).concat(point)
          : current.concat(point);
      const maxPoints = 600;
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
  }, [t, voltage]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="min-w-[420px] rounded-2xl border border-white/10 bg-[#0b1020] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm uppercase tracking-wide text-white/70">Oscilloscope Probe (Node {nodeId})</div>
          <button className="rounded-lg border border-white/10 px-2 py-1 hover:border-white/30" onClick={onClose}>
            x
          </button>
        </div>

        <div className="mb-2 text-center text-5xl font-semibold text-white">{voltage == null ? "-" : formatV(voltage)}</div>
        <TraceChart points={trace} unit="V" />
      </div>
    </div>
  );
}
