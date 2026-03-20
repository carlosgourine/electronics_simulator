import { PALETTE } from "../../constants/config";
import type { Analysis, Entity, Solution, Tool } from "../../types";
import { ANALYSIS, TOOL } from "../../types";
import { Editor } from "./Editor";
import { ResultsPanel } from "./ResultsPanel";

type SidebarProps = {
  tool: Tool;
  setTool: (tool: Tool) => void;
  analysis: Analysis;
  setAnalysis: (analysis: Analysis) => void;
  acFreq: string;
  setAcFreq: (freq: string) => void;
  running: boolean;
  onToggleRunning: () => void;
  setPhasorOpen: (open: boolean) => void;
  showNodes: boolean;
  setShowNodes: (show: boolean) => void;
  selectedEntity: Entity | null;
  updateSelected: (patch: Partial<Entity>) => void;
  sol: Solution;
  omegaText?: string | null;
};

export function Sidebar({
  tool,
  setTool,
  analysis,
  setAnalysis,
  acFreq,
  setAcFreq,
  running,
  onToggleRunning,
  setPhasorOpen,
  showNodes,
  setShowNodes,
  selectedEntity,
  updateSelected,
  sol,
  omegaText,
}: SidebarProps) {
  return (
    <div className="w-80 border-r border-white/10 bg-[#121a33]/60 p-3 overflow-y-auto">
      <h2 className="mb-2 text-lg font-semibold">Palette</h2>
      <div className="grid grid-cols-1 gap-2">
        {PALETTE.map((item) => (
          <button
            key={item.type}
            onClick={() => setTool(item.type as Tool)}
            className={`rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/30 ${tool === item.type ? "bg-white/10" : "bg-black/20"}`}
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={() => setTool(TOOL.SELECT)}
          className={`rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/30 ${tool === TOOL.SELECT ? "bg-white/10" : "bg-black/20"}`}
        >
          Select/Move
        </button>
      </div>

      <div className="mt-6 space-y-2">
        <h3 className="text-sm uppercase tracking-wide text-white/70">Analysis</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-white/10 bg-black/20 px-2 py-1"
            value={analysis}
            onChange={(event) => setAnalysis(event.currentTarget.value as Analysis)}
          >
            <option value={ANALYSIS.DC}>DC</option>
            <option value={ANALYSIS.AC}>AC (phasor)</option>
          </select>

          {analysis === ANALYSIS.AC && (
            <>
              <span className="text-xs text-white/70">f:</span>
              <input
                className="w-24 rounded border border-white/10 bg-black/20 px-2 py-1"
                value={acFreq}
                onChange={(event) => setAcFreq(event.currentTarget.value)}
              />
              <button className="rounded border border-white/10 px-2 py-1 hover:border-white/30" onClick={() => setPhasorOpen(true)}>
                Phasors...
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleRunning}
            className={`rounded-xl border px-3 py-2 transition ${running ? "border-[#19c37d]/40 bg-[#19c37d]/20 hover:border-[#19c37d]/60" : "border-white/10 hover:border-white/30"}`}
          >
            {running ? "Stop" : "Run"}
          </button>
          {analysis === ANALYSIS.AC && <span className="text-xs text-white/60">(Press <b>P</b> to toggle phasors)</span>}
        </div>

        {!sol.ok && <div className="mt-1 text-xs text-[#ffadad]">{sol.reason || "Add GND and close the loop"}</div>}
        {analysis === ANALYSIS.AC && sol.ok && omegaText && <div className="text-xs text-white/60">{omegaText}</div>}
      </div>

      <div className="mt-4">
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={showNodes} onChange={(event) => setShowNodes(event.currentTarget.checked)} />
          Show node IDs (debug)
        </label>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm uppercase tracking-wide text-white/70">Selection</h3>
        {selectedEntity ? (
          <Editor entity={selectedEntity} updateSelected={updateSelected} />
        ) : (
          <div className="text-sm text-white/60">Nothing selected. Tip: click a part to edit; R to rotate; Delete to remove.</div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm uppercase tracking-wide text-white/70">Result (select a part)</h3>
        {selectedEntity ? (
          <ResultsPanel entity={selectedEntity} sol={sol} analysis={analysis} />
        ) : (
          <div className="text-xs text-white/60">Select a component to see its voltage/current.</div>
        )}
      </div>
    </div>
  );
}
