"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STUDENT_ICON } from "@/components/student/StudentShell";

const STROKE = 1.75;

/** Lien de retour, à la taille d'un doigt d'enfant. */
export function BackToLessons({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  return (
    <Link href="/student" data-variant={variant} className="ms-button">
      <ArrowLeft size={STUDENT_ICON} strokeWidth={STROKE} aria-hidden="true" /> Retour à mes leçons
    </Link>
  );
}
