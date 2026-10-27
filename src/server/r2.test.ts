import { describe, it, expect } from "vitest";
import { collectMediaUrls, keyFromPublicUrl } from "./r2";

const BASE = "https://pub-abc.r2.dev";

describe("keyFromPublicUrl", () => {
  it("ne reconnaît que les URLs du bucket, sans query ni traversée", () => {
    expect(keyFromPublicUrl(`${BASE}/media/2026/x-photo.webp`, BASE)).toBe("media/2026/x-photo.webp");
    expect(keyFromPublicUrl(`${BASE}/media/2026/x.mp3?v=2#t`, BASE + "/")).toBe("media/2026/x.mp3");
    expect(keyFromPublicUrl("https://evil.invalid/media/x.mp3", BASE)).toBeNull();
    expect(keyFromPublicUrl(`${BASE}/../secret`, BASE)).toBeNull();
    expect(keyFromPublicUrl(`${BASE}/x`, undefined)).toBeNull();
  });
});

describe("collectMediaUrls", () => {
  it("rassemble les médias d'une leçon, une fois chacun, et ignore le reste", () => {
    const lesson = {
      blocks: [
        { type: "slideshow", slides: [{ imageDataUrl: `${BASE}/media/a.webp`, audioDataUrl: `${BASE}/media/a.mp3` }, { imageDataUrl: `${BASE}/media/a.webp` }] },
        { type: "exercise", exercise: { options: [{ imageDataUrl: "https://images.example/other.png" }, { text: "pas une url" }] } },
      ],
      live: { slides: [{ kind: "flashcard", word: { imageUrl: `${BASE}/media/b.webp` } }] },
    };
    expect(collectMediaUrls(lesson, BASE).sort()).toEqual([`${BASE}/media/a.mp3`, `${BASE}/media/a.webp`, `${BASE}/media/b.webp`]);
    expect(collectMediaUrls(null, BASE)).toEqual([]);
  });
});
