import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession, isStaff } from "@/server/auth";

/**
 * Route protection.
 *
 *  /teacher/*   → enseignants et admins
 *  /teacher/letters (sons des lettres) → admins seulement
 *  /student/*   → élèves et admins (aperçu des leçons)
 *  /arabic/*    → comme /student : les exercices d'arabe (et les voix
 *                 enregistrées par les enseignants) font partie de la
 *                 plateforme privée, pas du site public.
 *
 * Unauthenticated users are redirected to /login with a ?next= param so they
 * land back on the requested page after signing in. /login stays reachable
 * when a session exists: the page itself offers to continue or to switch
 * account (shared computers), like most authenticated sites.
 *
 * Ce filtre ne lit que le cookie signé : il décide de l'affichage des pages,
 * qui sont des coquilles sans donnée privée. Toute donnée passe par les
 * routes /api, qui relisent le profil en base à chaque requête
 * (lib/serverSession) : c'est là que l'autorisation fait foi.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySession(token);

  const isTeacherArea = pathname.startsWith("/teacher");
  const isStudentArea = pathname.startsWith("/student") || pathname.startsWith("/arabic");

  if ((isTeacherArea || isStudentArea) && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (isTeacherArea && session && !isStaff(session)) {
    return NextResponse.redirect(new URL("/student", req.url));
  }

  if (pathname.startsWith("/teacher/letters") && session && !session.isAdmin) {
    return NextResponse.redirect(new URL("/teacher", req.url));
  }

  if (isStudentArea && session && session.role !== "student" && !session.isAdmin) {
    return NextResponse.redirect(new URL("/teacher", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/teacher/:path*", "/student/:path*", "/arabic/:path*"],
};
