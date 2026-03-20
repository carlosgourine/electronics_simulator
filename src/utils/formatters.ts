export function trimZeros(value: string) {
  return value.replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
}

export function formatV(v: number) {
  const magnitude = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (magnitude >= 1) return `${sign}${trimZeros(magnitude.toFixed(3))} V`;
  if (magnitude >= 1e-3) return `${sign}${trimZeros((magnitude * 1e3).toFixed(3))} mV`;
  if (magnitude >= 1e-6) return `${sign}${trimZeros((magnitude * 1e6).toFixed(3))} uV`;
  return `${sign}${magnitude.toExponential(2)} V`;
}

export function formatI(v: number) {
  const magnitude = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (magnitude >= 1) return `${sign}${trimZeros(magnitude.toFixed(3))} A`;
  if (magnitude >= 1e-3) return `${sign}${trimZeros((magnitude * 1e3).toFixed(3))} mA`;
  if (magnitude >= 1e-6) return `${sign}${trimZeros((magnitude * 1e6).toFixed(3))} uA`;
  if (magnitude >= 1e-9) return `${sign}${trimZeros((magnitude * 1e9).toFixed(3))} nA`;
  return `${sign}${magnitude.toExponential(2)} A`;
}

export function formatDeg(rad: number) {
  return `${((rad * 180) / Math.PI).toFixed(1)}deg`;
}
