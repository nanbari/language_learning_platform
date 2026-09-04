import { describe, it, expect } from "vitest";
import { encodePcmToMp3, needsMp3Transcode, MP3_SAMPLE_RATE } from "./audioTranscode";

describe("needsMp3Transcode", () => {
  it("convertit les enregistrements WebM, OGG et MP4 mais pas le MP3 ni les images", () => {
    expect(needsMp3Transcode("audio/webm")).toBe(true);
    expect(needsMp3Transcode("audio/ogg")).toBe(true);
    expect(needsMp3Transcode("audio/mp4")).toBe(true);
    expect(needsMp3Transcode("audio/mpeg")).toBe(false);
    expect(needsMp3Transcode("image/png")).toBe(false);
    expect(needsMp3Transcode("video/webm")).toBe(false);
  });
});

describe("encodePcmToMp3", () => {
  it("produit un flux MP3 valide à partir d'une sinusoïde", () => {
    // 0,5 s de la 440 Hz
    const n = MP3_SAMPLE_RATE / 2;
    const pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) pcm[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / MP3_SAMPLE_RATE) * 12000);

    const parts = encodePcmToMp3(pcm);
    const total = parts.reduce((s, p) => s + p.length, 0);
    expect(total).toBeGreaterThan(1000);
    // À 48 kbps, 0,5 s ≈ 3 Ko : on vérifie l'ordre de grandeur
    expect(total).toBeLessThan(6000);

    // Chaque flux MP3 commence par un mot de synchronisation (11 bits à 1)
    const first = parts[0];
    expect(first[0]).toBe(0xff);
    expect(first[1] & 0xe0).toBe(0xe0);
  });
});
