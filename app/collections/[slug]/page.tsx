import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/public/Footer";
import { PublicHeader } from "@/components/public/Header";
import { products } from "@/lib/public-site";

const collectionTitles: Record<string, string> = {
  all: "All Smartfobs Services",
  "honda-products": "Honda Products",
  "yamaha-products": "Yamaha Products",
  "suzuki-products": "Suzuki Products",
};

export function generateStaticParams() {
  return Object.keys(collectionTitles).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = collectionTitles[slug] ?? "Smartfobs Services";
  const description =
    "Smartfobs smart key programming, lost key recovery, PIN recovery and replacement fob services.";

  return {
    title,
    description,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: { title, description, url: `/collections/${slug}`, images: [] },
    twitter: { title, description, images: [] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = collectionTitles[slug] ?? "Smartfobs Services";
  const maker = slug.includes("honda")
    ? "Honda"
    : slug.includes("yamaha")
      ? "Yamaha"
      : slug.includes("suzuki")
        ? "Suzuki"
        : "";
  const rows = maker ? products.filter((product) => product.maker.includes(maker)) : products;

  return (
    <>
      <PublicHeader />
      <main className="public-site">
        <section className="plain-hero">
          <div className="site-shell">
            <p className="eyebrow">Collection</p>
            <h1>{title}</h1>
            <p>Browse Smartfobs smart-key programming, lost-key recovery and PIN recovery services for supported models.</p>
          </div>
        </section>
        <section className="site-shell product-section">
          <div className="product-grid">
            {rows.map((product) => (
              <Link className="product-card" href={product.href} key={product.href}>
                <span>{product.maker}</span>
                <h3>{product.title}</h3>
                <p>{product.price}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
