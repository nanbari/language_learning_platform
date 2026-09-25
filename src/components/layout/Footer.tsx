import Link from "next/link";
import { Logo, Wordmark } from "./Header";

const navigation = [
  ["Accueil", "/"],
  ["Nos cours", "/courses"],
  ["Notre approche", "/about"],
  ["Actualités", "/news"],
  ["Contact", "/contact"],
];

const platform = [
  ["Connexion", "/login"],
  ["Espace élève", "/student"],
  ["Espace enseignant", "/teacher"],
];

export default function Footer() {
  return (
    <footer className="border-t border-ms-sand bg-ms-sand/60">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-12">

        <div className="md:col-span-6">
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <Wordmark className="text-lg" />
          </div>
          <p className="mt-4 max-w-[42ch] text-sm leading-relaxed text-ms-ink/65">
            Cours particuliers de mathématiques inspirés de la pédagogie Montessori. À domicile à Bruxelles pour les 3-12 ans, en visio pour les 12-15 ans.
          </p>
          <address className="mt-4 space-y-1 text-sm not-italic text-ms-ink/65">
            <p>Rue Edmond Tollenaere, 1020 Bruxelles</p>
            <p><a href="tel:+32499289766" className="transition-colors hover:text-ms-moss">+32 499 28 97 66</a></p>
            <p>
              <a
                href="mailto:nabilaanbari@zohomail.eu"
                className="font-semibold text-ms-moss underline decoration-ms-moss/30 underline-offset-4 transition-colors hover:decoration-ms-moss"
              >
                nabilaanbari@zohomail.eu
              </a>
            </p>
          </address>
        </div>

        <div className="md:col-span-3">
          <h3 className="font-display text-base font-semibold text-ms-ink">Navigation</h3>
          <ul className="mt-4 space-y-2 text-sm text-ms-ink/65">
            {navigation.map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="transition-colors hover:text-ms-moss">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <h3 className="font-display text-base font-semibold text-ms-ink">Plateforme</h3>
          <ul className="mt-4 space-y-2 text-sm text-ms-ink/65">
            {platform.map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="transition-colors hover:text-ms-moss">{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-ms-sand">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-ms-ink/50 sm:px-6">
          © {new Date().getFullYear()} Monte & Souris ASBL, Bruxelles. Cours de mathématiques.
        </p>
      </div>
    </footer>
  );
}
