import type { Metadata } from "next";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { products, siteUrl } from "@/lib/public-site";

export function generateStaticParams() {
  return products.map((product) => ({
    slug: product.href.replace("/products/", ""),
  }));
}

function findProduct(slug: string) {
  return products.find((product) => product.href === `/products/${slug}`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = findProduct(slug);
  const title = product?.title ?? "Smartfobs Service";
  const description =
    product?.title ??
    "Smartfobs motorcycle smart key programming, PIN recovery and lost key service.";

  return {
    title,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: { title, description, url: `/products/${slug}`, images: [] },
    twitter: { title, description, images: [] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = findProduct(slug);
  const title = product?.title ?? "Smartfobs Service";
  const price = product?.price ?? "Confirm price with Smartfobs";

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: title,
          brand: "Smartfobs",
          description: `${title}. ${price}.`,
          url: `${siteUrl}/products/${slug}`,
        }}
      />
      <PublicPageShell
        eyebrow={product?.maker ?? "Smartfobs"}
        title={title}
        description={`${price}. Confirm compatibility with Smartfobs before sending any components.`}
        body={[
          "This service is for supported motorcycle and scooter smart-key systems.",
          "Before ordering or sending components, confirm the exact make, model, year and key situation with Smartfobs.",
        ]}
        links={[
          { label: "Contact Smartfobs", href: "/pages/contact" },
          { label: "What to send", href: "/pages/what-to-send" },
        ]}
      />
    </>
  );
}
