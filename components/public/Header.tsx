import Image from "next/image";
import Link from "next/link";
import { navigation } from "@/lib/public-site";

export function PublicHeader() {
  return (
    <header className="site-header">
      <div className="site-shell header-inner">
        <Link className="brand-mark" href="/" aria-label="Smartfobs home">
          <Image src="/smartfobs-logo.png" alt="Smartfobs" width={54} height={54} priority />
          <span>
            <strong>Smartfobs</strong>
            <small>All lost keys programming service</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.slice(0, 6).map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="nav-cta" href="/pages/contact">
          Get help
        </Link>

        <details className="mobile-menu">
          <summary aria-label="Open menu">Menu</summary>
          <div>
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </header>
  );
}
