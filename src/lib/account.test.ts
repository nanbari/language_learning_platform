import { describe, it, expect } from "vitest";
import { normaliseEmail } from "@/lib/account";

describe("normaliseEmail", () => {
  it("met en minuscules et retire les espaces", () => {
    expect(normaliseEmail("  A@B.Be ")).toBe("a@b.be");
  });
});
