// useLTPStore.js
import { create } from 'zustand';

const useLTPStore = create((set, get) => ({
  ltps: {},

  setLTP: (symbol, price) =>
    set((state) => ({
      ltps: { ...state.ltps, [symbol]: price },
    })),

  getLTP: (symbol) => get().ltps[symbol],
}));

export default useLTPStore;
