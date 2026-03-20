import type { C } from "../types";

export const C0 = (re = 0, im = 0): C => ({ re, im });

export const cAdd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
export const cSub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
export const cMul = (a: C, b: C): C => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

export const cDiv = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return { re: Number.NaN, im: Number.NaN };
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d,
  };
};

export const cConj = (a: C): C => ({ re: a.re, im: -a.im });
export const cAbs = (a: C): number => Math.hypot(a.re, a.im);
export const cArg = (a: C): number => Math.atan2(a.im, a.re);
