import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { routeContent } from "@/lib/public-site";

export function generateStaticParams() {
  return Object.keys(routeContent).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = routeContent[slug];

  if (!page) return {};

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: `/pages/${slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `/pages/${slug}`,
      images: [],
    },
    twitter: {
      title: page.title,
      description: page.description,
      images: [],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = routeContent[slug];

  if (!page) notFound();

  return (
    <PublicPageShell
      eyebrow="Smartfobs service page"
      title={page.title}
      description={page.description}
      body={page.body}
      links={page.links}
    />
  );
}
