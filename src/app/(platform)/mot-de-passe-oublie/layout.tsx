import { authFontVariables } from "@/components/auth/authFonts";

/* Typographie partagée des pages de compte (DM Sans, Noto Naskh Arabic). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${authFontVariables} contents`}>{children}</div>;
}
