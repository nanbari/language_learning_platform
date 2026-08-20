import { describe, it, expect } from "vitest";
import { cn, getRandomColor, MONTESSORI_COLORS } from "./utils";

describe("cn", () => {
  it("fusionne les classes et déduplique les utilitaires Tailwind en conflit", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", false && "hidden", "font-bold")).toBe("text-red-500 font-bold");
  });
});

describe("getRandomColor", () => {
  it("retourne toujours une couleur de la palette Montessori", () => {
    for (let i = 0; i < 50; i++) {
      expect(MONTESSORI_COLORS).toContain(getRandomColor());
    }
  });
});
