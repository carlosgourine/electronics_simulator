import { DEFAULTS, TYPE_PREFIX } from "../constants/config";
import type { Entity, EntityType, Terminal } from "../types";
import { rotatePoint, snap } from "./geometry";

export function createId() {
  return Math.random().toString(36).slice(2, 9);
}

export function terminalsFor(type: EntityType) {
  if (type === "ground") return [{ key: "G", x: 0, y: -8 }];
  return [
    { key: "A", x: -32, y: 0 },
    { key: "B", x: 32, y: 0 },
  ];
}

export function worldTerminals(entity: Entity): Terminal[] {
  return terminalsFor(entity.type).map((terminal) => {
    const point = rotatePoint(terminal.x, terminal.y, entity.rotation || 0);
    return {
    id: `${entity.id}:${terminal.key}`,
      x: entity.x + point.x,
      y: entity.y + point.y,
      key: terminal.key,
      entityId: entity.id,
    };
  });
}

export function nextLabel(entities: Entity[], type: EntityType) {
  const prefix = TYPE_PREFIX[type] || type.toUpperCase();
  if (type === "ground") return "GND";
  const count = entities.filter((entity) => entity.type === type && (entity.label || "").startsWith(prefix)).length;
  return `${prefix}${count + 1}`;
}

export function createEntity(type: EntityType, entities: Entity[], x: number, y: number): Entity {
  return {
    id: createId(),
    type,
    x: snap(x),
    y: snap(y),
    rotation: 0,
    label: nextLabel(entities, type),
    value: DEFAULTS[type]?.value,
    wave: DEFAULTS[type]?.wave,
    amplitude: DEFAULTS[type]?.amplitude,
    frequency: DEFAULTS[type]?.frequency,
    phaseEnabled: DEFAULTS[type]?.phaseEnabled,
    phase: DEFAULTS[type]?.phase,
  };
}
