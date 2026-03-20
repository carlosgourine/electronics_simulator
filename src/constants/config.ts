import type { Entity, EntityType, Tool } from "../types";

export const GRID = 16;
export const CANVAS_W = 1200;
export const CANVAS_H = 720;

export const PALETTE: { type: EntityType | Tool; label: string }[] = [
  { type: "probe-v", label: "🔍 Probe Voltage (Node)" },
  { type: "probe-i", label: "🔍 Probe Current (Part)" },
  { type: "ground", label: "Ground" },
  { type: "resistor", label: "Resistor" },
  { type: "capacitor", label: "Capacitor" },
  { type: "inductor", label: "Inductor" },
  { type: "vsrc", label: "V Source" },
  { type: "isrc", label: "I Source" },
];

export const DEFAULTS: Record<string, Partial<Entity>> = {
  resistor: { value: "1kohm", label: "R" },
  capacitor: { value: "1uF", label: "C" },
  inductor: { value: "10mH", label: "L" },
  vsrc: {
    wave: "dc",
    amplitude: "5V",
    frequency: "1kHz",
    phaseEnabled: false,
    phase: "0deg",
    label: "V",
  },
  isrc: {
    wave: "dc",
    amplitude: "10mA",
    frequency: "1kHz",
    phaseEnabled: false,
    phase: "0deg",
    label: "I",
  },
  ground: { label: "GND" },
};

export const TYPE_PREFIX: Partial<Record<EntityType, string>> = {
  resistor: "R",
  capacitor: "C",
  inductor: "L",
  vsrc: "V",
  isrc: "I",
  ground: "GND",
};

export const NODE_PALETTE = [
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#f59e0b",
  "#34d399",
  "#a78bfa",
  "#f87171",
  "#22d3ee",
  "#c084fc",
  "#fb923c",
  "#93c5fd",
  "#fca5a5",
  "#10b981",
  "#e879f9",
];
