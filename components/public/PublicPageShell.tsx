import Link from "next/link";
import { PublicFooter } from "@/components/public/Footer";
import { PublicHeader } from "@/components/public/Header";

export function PublicPageShell({
  eyebrow,
  title,
  description,
  body,
  links = [],
}: {
  eyebrow: string;
  title: string;
  description: string;
  body: string[];
  links?: { label: string; href: string }[];
}) {
  return (
    <>
      <PublicHeader />
      <main className="public-site">
        <section className="plain-hero">
          <div className="site-shell">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </section>
        <section className="site-shell content-page">
          {body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {links.length ? (
            <div className="hero-actions">
              {links.map((link, index) => (
                <Link
                  className={index === 0 ? "button-primary" : "button-secondary"}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
