"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

/**
 * Utilisateur courant de l'espace enseignant. Le store persiste l'utilisateur
 * de la dernière connexion ; on le resynchronise avec la session serveur
 * (droit admin donné entre-temps…).
 */
export function useTeacherSession() {
  const { user, logout, login } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data: { user: { id: string; email: string; name: string; role: "teacher" | "student"; isAdmin: boolean } | null }) => {
        if (data.user) login(data.user);
      })
      .catch(() => {});
  }, [login]);

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    logout();
    router.push("/login");
  };

  return { user, isAdmin: user?.isAdmin === true, handleLogout };
}
