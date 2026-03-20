export type Wave = "dc" | "ac";

export type EntityType =
  | "ground"
  | "resistor"
  | "capacitor"
  | "inductor"
  | "vsrc"
  | "isrc"
  | "vmeter"
  | "ameter";

export type Tool = EntityType | "wire" | "select";
export type Analysis = "dc" | "ac";
export type PhasorMode = "components" | "nodeGround" | "nodePairs";

export const ENTITY_TYPE = {
  GROUND: "ground",
  RESISTOR: "resistor",
  CAPACITOR: "capacitor",
  INDUCTOR: "inductor",
  VSRC: "vsrc",
  ISRC: "isrc",
  VMETER: "vmeter",
  AMETER: "ameter",
} as const;

export const TOOL = {
  SELECT: "select",
  WIRE: "wire",
} as const;

export const ANALYSIS = {
  DC: "dc",
  AC: "ac",
} as const;

export type Entity = {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  rotation: number;
  label?: string;
  value?: string;
  wave?: Wave;
  amplitude?: string;
  frequency?: string;
  phaseEnabled?: boolean;
  phase?: string;
};

export type Wire = {
  id: string;
  aTerm: string;
  bTerm: string;
};

export type Terminal = {
  id: string;
  x: number;
  y: number;
  key: string;
  entityId: string;
};

export type Selection = {
  kind: null | "entity" | "wire";
  id: string | null;
};

export type TracePoint = {
  t: number;
  v: number;
};

export type C = {
  re: number;
  im: number;
};

export type DCSolution =
  | {
      ok: true;
      nodeOf: Map<string, number>;
      V: Map<number, number>;
      vsIndexOf: Map<string, number>;
      Ivs: number[];
    }
  | {
      ok: false;
      reason: string;
      nodeOf: Map<string, number>;
      V: Map<number, number>;
      vsIndexOf: Map<string, number>;
      Ivs: number[];
    };

export type ACSolution =
  | {
      ok: true;
      nodeOf: Map<string, number>;
      V: Map<number, C>;
      vsIndexOf: Map<string, number>;
      Ivs: C[];
      omega: number;
    }
  | {
      ok: false;
      reason: string;
      nodeOf: Map<string, number>;
      V: Map<number, C>;
      vsIndexOf: Map<string, number>;
      Ivs: C[];
      omega: number;
    };

export type Solution = DCSolution | ACSolution;

export type PhasorItem = {
  label: string;
  ph: C;
  color?: string;
};
