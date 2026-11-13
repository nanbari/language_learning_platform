"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  /** Compte famille : d'autres profils (frères et sœurs) s'ouvrent depuis /login sans mot de passe. */
  family: boolean;
  login: (user: User, family?: boolean) => void;
  logout: () => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      family: false,
      login: (user, family = false) => set({ user, family }),
      logout: () => set({ user: null, family: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: "monte-souris-auth" }
  )
);
