import { useMemo } from "react";
import { getProbeValue } from "../../engine/measurements";
import { useTimeStore } from "../../store/useTimeStore";
import { ANALYSIS } from "../../types";
import { cArg } from "../../utils/math";
import { TraceChart } from "./TraceChart";
import type { Entity, ProbeData, Solution, TracePoint } from "../../types";

type SmoothTraceProps = {
  probeData: ProbeData;
  entities: Entity[];
  analysis: "dc" | "ac";
  sol: Solution;
};

const AC_TRACE_POINTS = 150;
const AC_TRACE_CYCLES = 3;
const DC_TRACE_WINDOW_S = 1;

export function SmoothTrace({ probeData, entities, analysis, sol }: SmoothTraceProps) {
  const t = useTimeStore((state) => state.t);

  const trace = useMemo<TracePoint[]>(() => {
    if (!sol.ok || probeData.type === "i-node") return [];

    const { value, phasor } = getProbeValue(probeData, sol, entities, analysis, t);

    if (analysis === ANALYSIS.AC) {
      const omega = "omega" in sol ? sol.omega : 0;
      if (!(omega > 0)) return [];

      const magnitude = Math.hypot(phasor.re, phasor.im);
      const phase = cArg(phasor);
      const period = (2 * Math.PI) / omega;
      const windowTime = period * AC_TRACE_CYCLES;

      return Array.from({ length: AC_TRACE_POINTS + 1 }, (_, index) => {
        const tau = t - windowTime + (index / AC_TRACE_POINTS) * windowTime;
        return {
          t: tau,
          v: magnitude * Math.cos(omega * tau + phase),
        };
      });
    }

    return [
      { t: Math.max(0, t - DC_TRACE_WINDOW_S), v: value },
      { t, v: value },
    ];
  }, [analysis, entities, probeData, sol, t]);

  return <TraceChart points={trace} unit={probeData.type.startsWith("v") ? "V" : "A"} />;
}
