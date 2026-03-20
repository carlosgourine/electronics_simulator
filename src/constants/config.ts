import type { Entity, EntityType } from "../types";

export const GRID = 16;
export const CANVAS_W = 1200;
export const CANVAS_H = 720;

export const AMMETER_INTERNAL_RESISTANCE = 1e-6;

export const PALETTE: { type: EntityType | "wire" | "probe"; label: string }[] = [
  { type: "ground", label: "Ground" },
  { type: "resistor", label: "Resistor" },
  { type: "capacitor", label: "Capacitor" },
  { type: "inductor", label: "Inductor" },
  { type: "vsrc", label: "V Source" },
  { type: "isrc", label: "I Source" },
  { type: "vmeter", label: "Voltmeter" },
  { type: "ameter", label: "Ammeter" },
  { type: "wire", label: "Wire" },
  { type: "probe", label: "Probe" },
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
  vmeter: { label: "Vm" },
  ameter: { label: "Am" },
};

export const TYPE_PREFIX: Partial<Record<EntityType, string>> = {
  resistor: "R",
  capacitor: "C",
  inductor: "L",
  vsrc: "V",
  isrc: "I",
  vmeter: "VM",
  ameter: "AM",
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
