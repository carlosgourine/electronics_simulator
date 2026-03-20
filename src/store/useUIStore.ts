import { create } from "zustand";
import type { Analysis, Tool } from "../types";
import { ANALYSIS, TOOL } from "../types";

type UIStore = {
  tool: Tool;
  setTool: (tool: Tool) => void;
  analysis: Analysis;
  setAnalysis: (analysis: Analysis) => void;
  showNodes: boolean;
  setShowNodes: (showNodes: boolean) => void;
  acFreq: string;
  setAcFreq: (acFreq: string) => void;
};

export const useUIStore = create<UIStore>((set) => ({
  tool: TOOL.SELECT,
  setTool: (tool) => set({ tool }),
  analysis: ANALYSIS.DC,
  setAnalysis: (analysis) => set({ analysis }),
  showNodes: false,
  setShowNodes: (showNodes) => set({ showNodes }),
  acFreq: "1kHz",
  setAcFreq: (acFreq) => set({ acFreq }),
}));
