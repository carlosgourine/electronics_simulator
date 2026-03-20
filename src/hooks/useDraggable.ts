import { useCallback } from "react";
import type React from "react";
import type { Entity } from "../types";

type UseDraggableOptions = {
  getMouseCoord: (event: React.MouseEvent | MouseEvent) => { x: number; y: number };
  moveEntity: (entityId: string, x: number, y: number) => void;
  finishDrag: (entityId: string) => void;
  onDragStart?: (entity: Entity) => void;
};

export function useDraggable({ getMouseCoord, moveEntity, finishDrag, onDragStart }: UseDraggableOptions) {
  return useCallback(
    (entity: Entity, event: React.MouseEvent) => {
      event.stopPropagation();
      onDragStart?.(entity);

      const start = getMouseCoord(event);
      const offsetX = entity.x - start.x;
      const offsetY = entity.y - start.y;

      const onMove = (nativeEvent: MouseEvent) => {
        const point = getMouseCoord(nativeEvent);
        moveEntity(entity.id, point.x + offsetX, point.y + offsetY);
      };

      const onUp = () => {
        finishDrag(entity.id);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [finishDrag, getMouseCoord, moveEntity, onDragStart],
  );
}
