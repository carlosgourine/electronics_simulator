import { useEffect, useMemo, useState } from "react";
import { getCurrentInstant, getCurrentPhasor, getMagnitudeAndAngle, getVoltageInstant, getVoltagePhasor } from "../../engine/measurements";
import { useTimeStore } from "../../store/useTimeStore";
import { TraceChart } from "../charts/TraceChart";
import type { Analysis, Entity, Solution, TracePoint } from "../../types";
import { formatDeg, formatI, formatV } from "../../utils/formatters";
import { C0, cAbs } from "../../utils/math";
import { ENTITY_TYPE } from "../../types";

type MeterModalProps = {
  entity: Entity;
  analysis: Analysis;
  sol: Solution;
  onClose: () => void;
};

export function MeterModal({ entity, analysis, sol, onClose }: MeterModalProps) {
  const t = useTimeStore((state) => state.t);
  const isVoltage = entity.type === ENTITY_TYPE.VMETER;
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const instant = isVoltage ? getVoltageInstant(entity, sol, analysis, t) : getCurrentInstant(entity, sol, analysis, t);
  const voltagePhasor = useMemo(() => getVoltagePhasor(entity, sol, analysis), [analysis, entity, sol]);
  const currentPhasor = useMemo(() => getCurrentPhasor(entity, sol, analysis), [analysis, entity, sol]);
  const { angle } = useMemo(
    () => getMagnitudeAndAngle(isVoltage ? voltagePhasor : currentPhasor),
    [currentPhasor, isVoltage, voltagePhasor],
  );

  useEffect(() => {
    setTrace([]);
  }, [entity.id]);

  useEffect(() => {
    if (!sol.ok || instant == null || !Number.isFinite(instant)) return;

    setTrace((current) => {
      const point = { t, v: instant };
      const next =
        current.length > 0 && current[current.length - 1].t === point.t
          ? current.slice(0, -1).concat(point)
          : current.concat(point);
      const maxPoints = 600;
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
  }, [instant, sol.ok, t]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="min-w-[420px] max-w-[700px] rounded-2xl border border-white/10 bg-[#0b1020] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm uppercase tracking-wide text-white/70">
            {isVoltage ? "Voltmeter" : "Ammeter"} Reading ({analysis.toUpperCase()})
          </div>
          <button className="rounded-lg border border-white/10 px-2 py-1 hover:border-white/30" onClick={onClose}>
            x
          </button>
        </div>

        {sol.ok ? (
          <>
            <div className="mb-2 text-center text-5xl font-semibold text-white">
              {instant == null ? "-" : isVoltage ? formatV(instant) : formatI(instant)}
            </div>
            <div className="text-center text-xs text-white/70">A-&gt;B orientation • Live</div>
            {analysis === "ac" && (
              <div className="mt-1 text-center text-sm text-white/80">
                |{isVoltage ? "V" : "I"}| ={" "}
                <b>{isVoltage ? formatV(cAbs(voltagePhasor || C0())) : formatI(cAbs(currentPhasor || C0()))}</b> • angle{" "}
                {Number.isFinite(angle) ? formatDeg(angle) : "-"}
              </div>
            )}
            <TraceChart points={trace} unit={isVoltage ? "V" : "A"} />
          </>
        ) : (
          <div className="text-sm text-[#ffadad]">{sol.reason || "Solver not ready (check GND/loop)."}</div>
        )}

        <div className="mt-4 text-center text-xs text-white/60">Tip: Press <b>Esc</b> or click outside to close. Press <b>Enter</b> with a meter selected to open.</div>
      </div>
    </div>
  );
}
