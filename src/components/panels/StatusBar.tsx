import { GRID } from "../../constants/config";
import { TOOL } from "../../types";
import type { Tool } from "../../types";

type StatusBarProps = {
  tool: Tool;
  pendingWire: boolean;
};

export function StatusBar({ tool, pendingWire }: StatusBarProps) {
  return (
    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/70">
      <div>
        Mode:{" "}
        <span className="text-white">
          {tool === TOOL.SELECT ? "Select/Move" : tool === TOOL.PROBE_V ? "Probe Voltage" : tool === TOOL.PROBE_I ? "Probe Current" : `Place ${tool}`}
        </span>
        {pendingWire && <span className="ml-3 text-[#ffd60a]">(click another terminal to finish wire)</span>}
      </div>
      <div>Tips: R to rotate - Right-click to cancel - Snap {GRID}px</div>
    </div>
  );
}
