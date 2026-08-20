import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MONTESSORI_COLORS = [
  "#f9a875", "#ffd166", "#95d5b2", "#74c2e8",
  "#c9b1e8", "#ff8fa3", "#a8d8a8", "#ffc8a2",
];

export function getRandomColor() {
  return MONTESSORI_COLORS[Math.floor(Math.random() * MONTESSORI_COLORS.length)];
}
