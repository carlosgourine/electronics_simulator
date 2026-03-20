import { useState } from "react";
import { createEntity, createId } from "../utils/entities";
import { nearestFree } from "../utils/placement";
import type { Entity, EntityType, Selection, Wire } from "../types";

export function useCircuit() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selected, setSelected] = useState<Selection>({ kind: null, id: null });

  function addEntity(type: EntityType, x: number, y: number) {
    const entity = createEntity(type, entities, x, y);
    setEntities((current) => current.concat({ ...entity, ...nearestFree(entity.x, entity.y, current) }));
  }

  function updateEntity(entityId: string, patch: Partial<Entity>) {
    setEntities((current) => current.map((entity) => (entity.id === entityId ? { ...entity, ...patch } : entity)));
  }

  function moveEntity(entityId: string, x: number, y: number) {
    updateEntity(entityId, { x, y });
  }

  function snapEntityToGrid(entityId: string) {
    setEntities((current) =>
      current.map((entity) =>
        entity.id === entityId ? { ...entity, ...nearestFree(entity.x, entity.y, current, entityId) } : entity,
      ),
    );
  }

  function addWire(aTerm: string, bTerm: string) {
    if (aTerm === bTerm) return;

    setWires((current) => {
      const exists = current.some(
        (wire) => (wire.aTerm === aTerm && wire.bTerm === bTerm) || (wire.bTerm === aTerm && wire.aTerm === bTerm),
      );
      if (exists) return current;
      return current.concat({ id: createId(), aTerm, bTerm });
    });
  }

  function deleteEntity(entityId: string) {
    setEntities((current) => current.filter((entity) => entity.id !== entityId));
    setWires((current) => current.filter((wire) => !wire.aTerm.startsWith(`${entityId}:`) && !wire.bTerm.startsWith(`${entityId}:`)));
    setSelected({ kind: null, id: null });
  }

  function deleteWire(wireId: string) {
    setWires((current) => current.filter((wire) => wire.id !== wireId));
    setSelected({ kind: null, id: null });
  }

  return {
    entities,
    wires,
    selected,
    setSelected,
    addEntity,
    addWire,
    updateEntity,
    moveEntity,
    snapEntityToGrid,
    deleteEntity,
    deleteWire,
  };
}
