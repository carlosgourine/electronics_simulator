import type { Entity, Wire } from "../types";
import { worldTerminals } from "../utils/entities";

export function buildNodeMap(entities: Entity[], wires: Wire[], treatInductorAsShort: boolean) {
  const adjacency = new Map<string, Set<string>>();

  const connect = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  wires.forEach((wire) => connect(wire.aTerm, wire.bTerm));

  if (treatInductorAsShort) {
    entities
      .filter((entity) => entity.type === "inductor")
      .forEach((inductor) => {
        const terminals = worldTerminals(inductor);
        if (terminals.length === 2) connect(terminals[0].id, terminals[1].id);
      });
  }

  const nodeOf = new Map<string, number>();
  const visited = new Set<string>();
  const allTerms = entities.flatMap((entity) => worldTerminals(entity).map((terminal) => terminal.id));

  function assignNode(start: string, nodeId: number) {
    const queue = [start];
    visited.add(start);
    nodeOf.set(start, nodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        nodeOf.set(neighbor, nodeId);
        queue.push(neighbor);
      }
    }
  }

  const groundTerms = entities
    .filter((entity) => entity.type === "ground")
    .map((ground) => worldTerminals(ground)[0]?.id)
    .filter((id): id is string => Boolean(id));

  for (const groundTerm of groundTerms) {
    if (!visited.has(groundTerm)) assignNode(groundTerm, 0);
  }

  let nextNodeId = 1;
  for (const terminalId of allTerms) {
    if (!visited.has(terminalId)) assignNode(terminalId, nextNodeId++);
  }

  return nodeOf;
}
