import { useMemo } from "react";
import { getCurrentInstant, getCurrentPhasor, getVoltagePhasor } from "../../engine/measurements";
import { useTimeStore } from "../../store/useTimeStore";
import { ANALYSIS } from "../../types";
import { C0, cArg } from "../../utils/math";
import { TraceChart } from "./TraceChart";
import type { ACSolution, DCSolution, Entity, Solution, TracePoint } from "../../types";

type ProbeData =
  | { type: "v-node"; id: string }
  | { type: "v-entity"; id: string }
  | { type: "i-node"; id: string }
  | { type: "i-entity"; id: string };

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

  const probedEntity = useMemo(
    () => (probeData.type.endsWith("entity") ? entities.find((entity) => entity.id === probeData.id) || null : null),
    [entities, probeData],
  );

  const trace = useMemo<TracePoint[]>(() => {
    if (!sol.ok || probeData.type === "i-node") return [];

    if (analysis === ANALYSIS.AC) {
      const ac = sol as ACSolution;
      if (!(ac.omega > 0)) return [];

      let phasor = C0(0, 0);

      if (probeData.type === "v-node") {
        phasor = ac.V.get(Number(probeData.id)) || C0(0, 0);
      } else if (probeData.type === "v-entity") {
        if (!probedEntity) return [];
        phasor = getVoltagePhasor(probedEntity, sol, analysis) || C0(0, 0);
      } else if (probeData.type === "i-entity") {
        if (!probedEntity) return [];
        phasor = getCurrentPhasor(probedEntity, sol, analysis) || C0(0, 0);
      }

      const magnitude = Math.hypot(phasor.re, phasor.im);
      const phase = cArg(phasor);
      const period = (2 * Math.PI) / ac.omega;
      const windowTime = period * AC_TRACE_CYCLES;

      return Array.from({ length: AC_TRACE_POINTS + 1 }, (_, index) => {
        const tau = t - windowTime + (index / AC_TRACE_POINTS) * windowTime;
        return {
          t: tau,
          v: magnitude * Math.cos(ac.omega * tau + phase),
        };
      });
    }

    const dc = sol as DCSolution;
    let value = 0;

    if (probeData.type === "v-node") {
      value = dc.V.get(Number(probeData.id)) || 0;
    } else if (probeData.type === "v-entity") {
      if (!probedEntity) return [];
      value = getVoltagePhasor(probedEntity, sol, analysis)?.re || 0;
    } else if (probeData.type === "i-entity") {
      if (!probedEntity) return [];
      value = getCurrentInstant(probedEntity, sol, analysis, t) || 0;
    }

    return [
      { t: Math.max(0, t - DC_TRACE_WINDOW_S), v: value },
      { t, v: value },
    ];
  }, [analysis, probeData, probedEntity, sol, t]);

  return <TraceChart points={trace} unit={probeData.type.startsWith("v") ? "V" : "A"} />;
}
