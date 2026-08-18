import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { guides, siteUrl } from "@/lib/public-site";

export function generateStaticParams() {
  return guides.map((guide) => {
    const [blog, slug] = guide.href.replace("/blogs/", "").split("/");
    return { blog, slug };
  });
}

function findGuide(blog: string, slug: string) {
  return guides.find((guide) => guide.href === `/blogs/${blog}/${slug}`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ blog: string; slug: string }>;
}): Promise<Metadata> {
  const { blog, slug } = await params;
  const guide = findGuide(blog, slug);

  if (!guide) return {};

  return {
    title: guide.title,
    description: `${guide.title} from Smartfobs technical guides.`,
    alternates: { canonical: `/blogs/${blog}/${slug}` },
    openGraph: {
      title: guide.title,
      description: `${guide.title} from Smartfobs technical guides.`,
      url: `/blogs/${blog}/${slug}`,
      images: [],
    },
    twitter: {
      title: guide.title,
      description: `${guide.title} from Smartfobs technical guides.`,
      images: [],
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ blog: string; slug: string }>;
}) {
  const { blog, slug } = await params;
  const guide = findGuide(blog, slug);

  if (!guide) notFound();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          url: `${siteUrl}/blogs/${blog}/${slug}`,
          publisher: {
            "@type": "Organization",
            name: "Smartfobs",
          },
        }}
      />
      <PublicPageShell
        eyebrow="Technical guide"
        title={guide.title}
        description="This article route is preserved for the Next.js preview. Full article content migration is planned for the next phase."
        body={[
          "Smartfobs guides help customers understand smart-key batteries, emergency PIN procedures, lost fob situations and pairing steps.",
          "The current first phase preserves the guide URL and page metadata while the detailed article body is migrated carefully from the live public site.",
        ]}
        links={[
          { label: "All guides", href: "/blogs/blog" },
          { label: "Contact Smartfobs", href: "/pages/contact" },
        ]}
      />
    </>
  );
}
