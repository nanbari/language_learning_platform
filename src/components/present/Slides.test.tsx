// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/soundPlayer", () => ({ playSound: async () => true, stopSound: () => {} }));
vi.mock("@/lib/vocabSound", () => ({ playVocabSound: async () => false, INSTRUCTION_ID: "_instruction" }));

import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import type { Slide } from "@/lib/presentation";
import { SlideView } from "@/components/present/Slides";

const [alif, ba, ta] = ARABIC_ALPHABET;
afterEach(cleanup);

describe("SlideView — jeux du cours en direct", () => {
  it("« Où est la lettre ? » : une carte fausse est signalée puis ignorée, la bonne résout l'écran", () => {
    const onPick = vi.fn();
    const slide: Slide = { kind: "findLetter", target: ba, choices: [alif, ba, ta] };
    render(<SlideView slide={slide} step={0} game={{ onPick }} />);
    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(3);

    fireEvent.click(cards[0]!); // alif : faux
    expect(onPick).toHaveBeenLastCalledWith(String(alif.id), false);
    fireEvent.click(cards[0]!); // une carte déjà fausse ne compte plus
    expect(onPick).toHaveBeenCalledTimes(1);

    fireEvent.click(cards[1]!); // ba : juste
    expect(onPick).toHaveBeenLastCalledWith(String(ba.id), true);
    fireEvent.click(cards[2]!); // écran résolu : plus aucun essai
    expect(onPick).toHaveBeenCalledTimes(2);
  });

  it("la solution révélée par l'enseignant fige l'écran et affiche le décompte des premiers essais", () => {
    const onPick = vi.fn();
    const slide: Slide = { kind: "findLetter", target: ba, choices: [alif, ba, ta] };
    render(<SlideView slide={slide} step={0} game={{ onPick, revealed: true, counts: { [String(ba.id)]: 4, [String(alif.id)]: 1 } }} />);
    fireEvent.click(screen.getAllByRole("button")[2]!);
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("QCM de l'enseignant : la réponse est identifiée par son id, l'exactitude par correctId", () => {
    const onPick = vi.fn();
    const slide: Slide = {
      kind: "qcm", color: "#6B705C",
      qcm: { id: "q1", question: "أين التفاحة؟", options: [{ id: "r1", text: "موز" }, { id: "r2", text: "تفاحة" }], correctId: "r2" },
    };
    render(<SlideView slide={slide} step={0} game={{ onPick }} />);
    fireEvent.click(screen.getByText("موز"));
    expect(onPick).toHaveBeenLastCalledWith("r1", false);
    fireEvent.click(screen.getByText("تفاحة"));
    expect(onPick).toHaveBeenLastCalledWith("r2", true);
  });

  it("un écran sans jeu (lettre présentée) n'envoie jamais de réponse", () => {
    const onPick = vi.fn();
    render(<SlideView slide={{ kind: "letter", letter: ba }} step={0} game={{ onPick }} />);
    screen.queryAllByRole("button").forEach((b) => fireEvent.click(b));
    expect(onPick).not.toHaveBeenCalled();
  });
});
