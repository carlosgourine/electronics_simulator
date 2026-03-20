import { TraceChart } from "../charts/TraceChart";
import type { Analysis, C, Entity, TracePoint } from "../../types";
import { formatDeg, formatI, formatV } from "../../utils/formatters";
import { C0, cAbs } from "../../utils/math";
import { ENTITY_TYPE } from "../../types";

type MeterModalProps = {
  entity: Entity;
  analysis: Analysis;
  ok: boolean;
  reason?: string;
  instant: number | null;
  voltagePhasor: C | null;
  currentPhasor: C | null;
  angle: number;
  trace: TracePoint[];
  onClose: () => void;
};

export function MeterModal({
  entity,
  analysis,
  ok,
  reason,
  instant,
  voltagePhasor,
  currentPhasor,
  angle,
  trace,
  onClose,
}: MeterModalProps) {
  const isVoltage = entity.type === ENTITY_TYPE.VMETER;

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

        {ok ? (
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
          <div className="text-sm text-[#ffadad]">{reason || "Solver not ready (check GND/loop)."}</div>
        )}

        <div className="mt-4 text-center text-xs text-white/60">Tip: Press <b>Esc</b> or click outside to close. Press <b>Enter</b> with a meter selected to open.</div>
      </div>
    </div>
  );
}
