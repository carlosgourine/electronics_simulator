import type { C } from "../types";
import { C0, cAbs, cDiv, cMul, cSub } from "../utils/math";

export function solveLinear(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((row, index) => row.slice(0, n).concat([b[index]]));

  for (let i = 0; i < n; i += 1) {
    let pivot = i;
    for (let r = i + 1; r < n; r += 1) {
      if (Math.abs(M[r][i]) > Math.abs(M[pivot][i])) pivot = r;
    }
    if (Math.abs(M[pivot][i]) < 1e-12) return null;
    if (pivot !== i) [M[i], M[pivot]] = [M[pivot], M[i]];

    const pivotValue = M[i][i];
    for (let c = i; c <= n; c += 1) M[i][c] /= pivotValue;

    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const factor = M[r][i];
      if (Math.abs(factor) < 1e-16) continue;
      for (let c = i; c <= n; c += 1) M[r][c] -= factor * M[i][c];
    }
  }

  return Array.from({ length: n }, (_, index) => M[index][n]);
}

export function solveLinearC(A: C[][], b: C[]) {
  const n = b.length;
  const M = A.map((row, index) => row.slice(0, n).concat([b[index]]));

  for (let i = 0; i < n; i += 1) {
    let pivot = i;
    for (let r = i + 1; r < n; r += 1) {
      if (cAbs(M[r][i]) > cAbs(M[pivot][i])) pivot = r;
    }
    if (cAbs(M[pivot][i]) < 1e-18) return null;
    if (pivot !== i) [M[i], M[pivot]] = [M[pivot], M[i]];

    const pivotValue = M[i][i];
    for (let c = i; c <= n; c += 1) M[i][c] = cDiv(M[i][c], pivotValue);

    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const factor = M[r][i];
      if (cAbs(factor) < 1e-18) continue;
      for (let c = i; c <= n; c += 1) M[r][c] = cSub(M[r][c], cMul(factor, M[i][c]));
    }
  }

  return Array.from({ length: n }, (_, index) => M[index][n] ?? C0());
}
