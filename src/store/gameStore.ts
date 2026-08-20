"use client";
import { create } from "zustand";

interface GameState {
  score: number;
  streak: number;
  totalPoints: number;
  lastAnswer: "correct" | "incorrect" | null;
  badges: string[];
  addPoints: (pts: number) => void;
  setAnswer: (answer: "correct" | "incorrect") => void;
  resetGame: () => void;
  addBadge: (badge: string) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  score: 0,
  streak: 0,
  totalPoints: 0,
  lastAnswer: null,
  badges: [],

  addPoints: (pts) => {
    const { streak, totalPoints } = get();
    const bonus = streak >= 3 ? pts * 1.5 : pts;
    set({ score: get().score + pts, totalPoints: totalPoints + bonus, streak: streak + 1 });
  },

  setAnswer: (answer) => {
    if (answer === "incorrect") set({ streak: 0 });
    set({ lastAnswer: answer });
    setTimeout(() => set({ lastAnswer: null }), 800);
  },

  resetGame: () => set({ score: 0, streak: 0, lastAnswer: null }),

  addBadge: (badge) => {
    const { badges } = get();
    if (!badges.includes(badge)) set({ badges: [...badges, badge] });
  },
}));
