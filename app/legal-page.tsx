import Link from "next/link";
import { type ReactNode } from "react";

const sections = "space-y-8";
const heading = "text-xl font-black text-[#f2f2f2]";
const copy = "mt-3 space-y-3 text-sm leading-7 text-[#b8bcc6] sm:text-base";
const list = "mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#b8bcc6] sm:text-base";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#252a34] px-4 py-8 text-[#f2f2f2] sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[#3a404d] bg-[#111317] p-5 shadow-2xl sm:p-8">
        <Link href="/" className="text-sm font-bold text-[#d7d7d7] underline-offset-4 hover:underline">
          ← Back to SmartFobs
        </Link>
        <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <div className={`mt-8 ${sections}`}>{children}</div>
      </article>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className={heading}>{title}</h2>
      <div className={copy}>{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className={list}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
