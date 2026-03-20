import { GRID } from "../constants/config";
import type { Entity } from "../types";
import { snap } from "./geometry";

export function nearestFree(startX: number, startY: number, entities: Entity[], ignoreId: string | null = null) {
  const isOccupied = (x: number, y: number) =>
    entities.some((entity) => entity.id !== ignoreId && entity.x === x && entity.y === y);

  const snappedX = snap(startX);
  const snappedY = snap(startY);

  if (!isOccupied(snappedX, snappedY)) return { x: snappedX, y: snappedY };

  for (let radius = 1; radius <= 25; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

        const checkX = snappedX + dx * GRID;
        const checkY = snappedY + dy * GRID;
        if (!isOccupied(checkX, checkY)) return { x: checkX, y: checkY };
      }
    }
  }

  return { x: snappedX, y: snappedY };
}
