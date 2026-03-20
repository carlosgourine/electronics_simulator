const PREFIX_FACTORS: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  m: 1e-3,
  k: 1e3,
  M: 1e6,
  G: 1e9,
};

function normalize(raw: string | null | undefined) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/Âµ/g, "u")
    .replace(/µ/g, "u");
}

function parseScaledNumber(s: string): number | null {
  const last = s.slice(-1);
  const factor = PREFIX_FACTORS[last] ?? 1;
  const numeric = factor === 1 ? s : s.slice(0, -1);
  const value = parseFloat(numeric);
  return Number.isFinite(value) ? value * factor : null;
}

export function parseSI(raw: string | null | undefined): number | null {
  const normalized = normalize(raw)
    .replace(/ohm$/i, "")
    .replace(/Ω$/i, "")
    .replace(/[VAFHR]$/i, "");

  if (!normalized) return null;
  return parseScaledNumber(normalized);
}

export function parseHz(raw: string | null | undefined): number | null {
  const normalized = normalize(raw)
    .replace(/Hz$/i, "")
    .replace(/rad\/s$/i, "");

  if (!normalized) return null;
  return parseScaledNumber(normalized);
}

export function parsePhase(raw: string | null | undefined): number {
  const normalized = normalize(raw);
  if (!normalized) return 0;

  const value = parseFloat(normalized);
  if (!Number.isFinite(value)) return 0;

  if (/rad/i.test(normalized)) return value;
  return /deg|°/i.test(normalized) ? (value * Math.PI) / 180 : (value * Math.PI) / 180;
}
