import { useState } from "react";
import type { PhasorItem, PhasorMode } from "../../types";
import { PhasorLegend } from "./PhasorLegend";
import { PhasorPlot } from "./PhasorPlot";

type PhasorTabsProps = {
  Vlist: PhasorItem[];
  Ilist: PhasorItem[];
  mode: PhasorMode;
  setMode: (mode: PhasorMode) => void;
};

export function PhasorTabs({ Vlist, Ilist, mode, setMode }: PhasorTabsProps) {
  const [tab, setTab] = useState<"V" | "I">("V");
  const items = tab === "V" ? Vlist : Ilist;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          className={`rounded-lg border px-3 py-1 ${tab === "V" ? "border-white/30 bg-white/10" : "border-white/10 hover:border-white/30"}`}
          onClick={() => setTab("V")}
        >
          Voltages
        </button>
        <button
          className={`rounded-lg border px-3 py-1 ${tab === "I" ? "border-white/30 bg-white/10" : "border-white/10 hover:border-white/30"}`}
          onClick={() => setTab("I")}
        >
          Currents
        </button>
        <span className="ml-4 text-xs opacity-70">View:</span>
        <select
          className="rounded border border-white/10 bg-black/20 px-2 py-1 text-sm"
          value={mode}
          onChange={(event) => setMode(event.currentTarget.value as PhasorMode)}
          title="How to organize phasors"
        >
          <option value="components">Separate (per component)</option>
          <option value="nodeGround">Structured (node vs ground)</option>
          <option value="nodePairs">Node pairs (adjacent)</option>
        </select>
      </div>
      <PhasorPlot items={items} unit={tab === "V" ? "V" : "A"} />
      <PhasorLegend items={items} unit={tab === "V" ? "V" : "A"} />
    </div>
  );
}
