import Link from "next/link";
import { contact, navigation } from "@/lib/public-site";

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-grid">
        <div>
          <p className="footer-kicker">Smartfobs</p>
          <h2>Specialist smart-key support by post.</h2>
          <p>
            UK-based motorcycle and scooter smart key programming, PIN recovery,
            SCU/ECU data work and replacement fob support.
          </p>
        </div>
        <div>
          <h3>Services</h3>
          {navigation.slice(0, 5).map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <div>
          <h3>Contact</h3>
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
          <a href={`tel:${contact.phoneHref}`}>{contact.phone}</a>
          <address>
            {contact.address.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </address>
        </div>
      </div>
      <div className="site-shell footer-bottom">
        <span>© 2026 Smartfobs</span>
        <Link href="/pages/contact">Contact Smartfobs</Link>
      </div>
    </footer>
  );
}
