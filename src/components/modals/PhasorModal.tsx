import { PhasorTabs } from "../phasor/PhasorTabs";
import type { ACSolution, Analysis, PhasorItem, PhasorMode } from "../../types";
import { ANALYSIS } from "../../types";

type PhasorModalProps = {
  analysis: Analysis;
  ac: ACSolution;
  open: boolean;
  voltagePhasors: PhasorItem[];
  currentPhasors: PhasorItem[];
  phasorMode: PhasorMode;
  setPhasorMode: (mode: PhasorMode) => void;
  onClose: () => void;
};

export function PhasorModal({
  analysis,
  ac,
  open,
  voltagePhasors,
  currentPhasors,
  phasorMode,
  setPhasorMode,
  onClose,
}: PhasorModalProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="min-w-[760px] max-w-[900px] rounded-2xl border border-white/10 bg-[#0b1020] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm uppercase tracking-wide text-white/70">Circuit Phasors</div>
          <button className="rounded-lg border border-white/10 px-2 py-1 hover:border-white/30" onClick={onClose}>
            x
          </button>
        </div>

        {analysis !== ANALYSIS.AC ? (
          <div className="text-sm text-[#ffadad]">Switch analysis to AC to view phasors.</div>
        ) : !ac.ok ? (
          <div className="text-sm text-[#ffadad]">{ac.reason || "AC solve failed (check frequency and connections)."}</div>
        ) : (
          <PhasorTabs Vlist={voltagePhasors} Ilist={currentPhasors} mode={phasorMode} setMode={setPhasorMode} />
        )}

        <div className="mt-3 text-center text-xs text-white/60">
          Reference is ground node (n0). Vectors are drawn to scale; legend shows magnitude and angle.
        </div>
      </div>
    </div>
  );
}
