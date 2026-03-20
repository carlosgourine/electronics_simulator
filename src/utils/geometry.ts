import { GRID, NODE_PALETTE } from "../constants/config";
import type { Terminal } from "../types";

export function rotatePoint(x: number, y: number, rot: number) {
  const r = ((rot % 360) + 360) % 360;
  if (r === 0) return { x, y };
  if (r === 90) return { x: y, y: -x };
  if (r === 180) return { x: -x, y: -y };
  if (r === 270) return { x: -y, y: x };
  return { x, y };
}

export const snap = (n: number) => Math.round(n / GRID) * GRID;

export function getMousePosition(svg: SVGSVGElement, event: React.MouseEvent | MouseEvent) {
  const rect = svg.getBoundingClientRect();
  return {
    x: snap(event.clientX - rect.left),
    y: snap(event.clientY - rect.top),
  };
}

export function hitTerminal(terminals: Iterable<Terminal>, mx: number, my: number, radius = 10) {
  const radiusSquared = radius * radius;
  for (const terminal of terminals) {
    const dx = mx - terminal.x;
    const dy = my - terminal.y;
    if (dx * dx + dy * dy <= radiusSquared) return { ...terminal };
  }
  return null;
}

export function nodeColor(nid: number) {
  if (nid === 0) return "#e5e7eb";
  return NODE_PALETTE[(Math.abs(nid) * 59) % NODE_PALETTE.length];
}

export function phasorColor(key: string, fallback = "#ffd60a") {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const index = Math.abs(hash) % NODE_PALETTE.length;
  return NODE_PALETTE[index] || fallback;
}
