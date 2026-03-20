import { create } from "zustand";

type TimeStore = {
  t: number;
  running: boolean;
  toggleRunning: () => void;
  tick: (dt: number) => void;
};

export const useTimeStore = create<TimeStore>((set) => ({
  t: 0,
  running: false,
  toggleRunning: () => set((state) => ({ running: !state.running })),
  tick: (dt) => set((state) => ({ t: state.t + dt })),
}));
