import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/public/Footer";
import { PublicHeader } from "@/components/public/Header";
import { guides } from "@/lib/public-site";

export const metadata: Metadata = {
  title: "Smartfobs Technical Guides",
  description:
    "Guides for smart key batteries, emergency PIN procedures, Honda pairing and lost smart key support.",
  alternates: { canonical: "/blogs/blog" },
  openGraph: {
    title: "Smartfobs Technical Guides",
    description:
      "Guides for smart key batteries, emergency PIN procedures, Honda pairing and lost smart key support.",
    url: "/blogs/blog",
    images: [],
  },
  twitter: {
    title: "Smartfobs Technical Guides",
    description:
      "Guides for smart key batteries, emergency PIN procedures, Honda pairing and lost smart key support.",
    images: [],
  },
};

export default function Page() {
  return (
    <>
      <PublicHeader />
      <main className="public-site">
        <section className="plain-hero">
          <div className="site-shell">
            <p className="eyebrow">Technical guides</p>
            <h1>Smartfobs Blog</h1>
            <p>Helpful public guides from the existing Smartfobs site, ready for fuller article migration in the next phase.</p>
          </div>
        </section>
        <section className="site-shell content-page">
          <div className="guide-list">
            {guides.map((guide) => (
              <Link key={guide.href} href={guide.href}>
                {guide.title}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
