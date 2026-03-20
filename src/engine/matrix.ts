import type { C } from "../types";
import { C0, cAbs, cDiv, cMul, cSub } from "../utils/math";

const REAL_SINGULAR_THRESHOLD = 1e-12;
const REAL_ELIMINATION_THRESHOLD = 1e-16;
const COMPLEX_SINGULAR_THRESHOLD = 1e-18;

/**
 * Solves a real-valued system of linear equations (Ax = b)
 * using Gaussian elimination with partial pivoting.
 */
export function solveLinear(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((row, index) => row.slice(0, n).concat([b[index]]));

  for (let i = 0; i < n; i += 1) {
    let pivotRow = i;
    for (let r = i + 1; r < n; r += 1) {
      if (Math.abs(M[r][i]) > Math.abs(M[pivotRow][i])) pivotRow = r;
    }
    if (Math.abs(M[pivotRow][i]) < REAL_SINGULAR_THRESHOLD) return null;
    if (pivotRow !== i) [M[i], M[pivotRow]] = [M[pivotRow], M[i]];

    const pivotValue = M[i][i];
    for (let c = i; c <= n; c += 1) M[i][c] /= pivotValue;

    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const factor = M[r][i];
      if (Math.abs(factor) < REAL_ELIMINATION_THRESHOLD) continue;
      for (let c = i; c <= n; c += 1) M[r][c] -= factor * M[i][c];
    }
  }

  return Array.from({ length: n }, (_, index) => M[index][n]);
}

/**
 * Complex-number variant of Gaussian elimination with partial pivoting.
 */
export function solveLinearC(A: C[][], b: C[]) {
  const n = b.length;
  const M = A.map((row, index) => row.slice(0, n).concat([b[index]]));

  for (let i = 0; i < n; i += 1) {
    let pivotRow = i;
    for (let r = i + 1; r < n; r += 1) {
      if (cAbs(M[r][i]) > cAbs(M[pivotRow][i])) pivotRow = r;
    }
    if (cAbs(M[pivotRow][i]) < COMPLEX_SINGULAR_THRESHOLD) return null;
    if (pivotRow !== i) [M[i], M[pivotRow]] = [M[pivotRow], M[i]];

    const pivotValue = M[i][i];
    for (let c = i; c <= n; c += 1) M[i][c] = cDiv(M[i][c], pivotValue);

    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const factor = M[r][i];
      if (cAbs(factor) < COMPLEX_SINGULAR_THRESHOLD) continue;
      for (let c = i; c <= n; c += 1) M[r][c] = cSub(M[r][c], cMul(factor, M[i][c]));
    }
  }

  return Array.from({ length: n }, (_, index) => M[index][n] ?? C0());
}
