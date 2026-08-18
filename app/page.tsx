import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicFooter } from "@/components/public/Footer";
import { PublicHeader } from "@/components/public/Header";
import {
  contact,
  guides,
  manufacturerCards,
  products,
  services,
  siteUrl,
  trustEvidence,
} from "@/lib/public-site";

const heroImage =
  "https://smartfobs.co.uk/cdn/shop/files/all_lost_keys-smart_key_remote_fob_nmax_xmax.jpg?v=1749931096&width=1500";

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "AutomotiveBusiness",
    name: "Smartfobs",
    url: siteUrl,
    email: contact.email,
    telephone: contact.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: "102 Wolseley road",
      addressLocality: "Brighton",
      postalCode: "BN1 9ET",
      addressCountry: "GB",
    },
    areaServed: ["United Kingdom", "United States", "European Union"],
    description:
      "Motorcycle and scooter smart key programming, lost key recovery, PIN recovery and SCU/ECU data services.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Smartfobs",
    url: siteUrl,
  },
];

export default function Page() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <PublicHeader />
      <main className="public-site">
        <section className="hero-section">
          <div className="site-shell hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Motorcycle electronics and keyless security</p>
              <h1>Motorcycle Smart Key Programming & Lost Key Recovery</h1>
              <p className="service-line">
                All Keys Lost • PIN Recovery • SCU/ECU Services • Replacement Smart Fobs
              </p>
              <p className="hero-lede">
                Smartfobs specialises in Honda, Yamaha, Suzuki and
                Piaggio/Vespa smart-key systems, helping riders recover access
                when smart keys, PIN codes or keyless-system data are missing.
              </p>
              <div className="hero-facts" aria-label="Service facts">
                <span>UK-based postal service</span>
                <span>Worldwide support</span>
                <span>Tracked component return</span>
              </div>
              <div className="hero-actions" aria-label="Primary actions">
                <Link className="button-primary" href="#find-service">
                  Find your service
                </Link>
                <Link className="button-secondary" href="/collections/all">
                  Shop smart keys
                </Link>
                <Link className="button-text" href="/pages/what-to-send">
                  What do I need to send?
                </Link>
              </div>
            </div>
            <div className="hero-media" aria-label="Smart key remote fobs">
              <Image
                src={heroImage}
                alt="Smart key remote fobs for motorcycle keyless systems"
                fill
                sizes="(max-width: 900px) 100vw, 44vw"
                priority
              />
              <div className="diagnostic-card">
                <span>Typical service route</span>
                <strong>SCU / ECU / original fob</strong>
                <p>Smartfobs confirms the correct part for your model before you send anything.</p>
              </div>
            </div>
          </div>
          <dl className="site-shell trust-strip">
            <div>
              <dt>Specialist keyless systems</dt>
              <dd>Smart key programming, PIN recovery and SCU/ECU data services.</dd>
            </div>
            <div>
              <dt>Manufacturer knowledge</dt>
              <dd>Honda, Yamaha, Suzuki and Piaggio/Vespa pages with model-specific routes.</dd>
            </div>
            <div>
              <dt>Clear postal process</dt>
              <dd>Identify the service, send the required component, receive it back ready for the next step.</dd>
            </div>
          </dl>
        </section>

        <section className="section-band" id="find-service">
          <div className="site-shell section-heading">
            <p className="eyebrow">Choose manufacturer</p>
            <h2>Start with your bike or scooter brand.</h2>
            <p>
              Each manufacturer page points customers toward the correct lost
              key, PIN recovery or smart fob programming route.
            </p>
          </div>
          <div className="site-shell manufacturer-grid">
            {manufacturerCards.map((maker) => (
              <Link className="manufacturer-card" key={maker.name} href={maker.href}>
                <div className="manufacturer-image">
                  <Image
                    src={maker.image}
                    alt={`${maker.name} smart key fob and keyless system service image`}
                    fill
                    sizes="(max-width: 900px) 50vw, 25vw"
                  />
                </div>
                <div className="manufacturer-copy">
                  <span>{maker.name}</span>
                  <h3>{maker.models}</h3>
                  <p>{maker.summary}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="site-shell split-section">
          <div className="section-heading align-start">
            <p className="eyebrow">Specialist services</p>
            <h2>Clear help for lost smart keys and immobiliser data issues.</h2>
            <p>
              Smartfobs works with the smart controller, ECU or original fob
              specified for the exact model and service, avoiding guesswork
              before components are posted.
            </p>
          </div>
          <div className="service-grid">
            {services.map((service) => (
              <Link className="service-card" key={service.title} href={service.href}>
                <span>{service.kicker}</span>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="process-section">
          <div className="site-shell process-grid">
            <div>
              <p className="eyebrow">How it works</p>
              <h2>A postal service built around the component your model needs.</h2>
            </div>
            <ol className="process-list">
              <li>
                <span className="step-number">01</span>
                <strong>Identify your motorcycle and service.</strong>
                <span>Choose your manufacturer, product or contact Smartfobs with your model details.</span>
              </li>
              <li>
                <span className="step-number">02</span>
                <strong>Send the required part by tracked post.</strong>
                <span>Depending on the model this may be the SCU, ECU, original smart key or other specified component.</span>
              </li>
              <li>
                <span className="step-number">03</span>
                <strong>Smartfobs completes the programming or data work.</strong>
                <span>PIN recovery, keycode recovery, fob preparation and programming are handled for supported systems.</span>
              </li>
              <li>
                <span className="step-number">04</span>
                <strong>Components are returned ready for the next step.</strong>
                <span>Parts are sent back for reinstallation or pairing as appropriate for the supported model.</span>
              </li>
            </ol>
          </div>
        </section>

        <section className="site-shell product-section">
          <div className="section-heading">
            <p className="eyebrow">Popular routes</p>
            <h2>Common services customers look for first.</h2>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <Link className="product-card" key={product.title} href={product.href}>
                <div className="product-image">
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    sizes="(max-width: 900px) 50vw, 33vw"
                  />
                </div>
                <div className="product-copy">
                  <span>{product.maker}</span>
                  <h3>{product.title}</h3>
                  <p>{product.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="support-section">
          <div className="site-shell support-grid">
            <div>
              <p className="eyebrow">Technical support</p>
              <h2>Useful guides before you remove or send anything.</h2>
              <p>
                Smartfobs already has practical articles on smart key batteries,
                emergency PIN procedures, Honda pairing and what to do when a
                fob is lost.
              </p>
            </div>
            <div className="guide-feature-grid">
              {guides.map((guide, index) => (
                <Link
                  key={guide.href}
                  className={index === 0 ? "guide-card guide-card-featured" : "guide-card"}
                  href={guide.href}
                >
                  <div className="guide-image">
                    <Image
                      src={guide.image}
                      alt={guide.title}
                      fill
                      sizes={index === 0 ? "(max-width: 900px) 100vw, 54vw" : "(max-width: 900px) 50vw, 22vw"}
                    />
                  </div>
                  <div>
                    <span>Guide</span>
                    <h3>{guide.title}</h3>
                    <p>{guide.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="evidence-section">
          <div className="site-shell section-heading">
            <p className="eyebrow">Why customers use Smartfobs</p>
            <h2>Specialist keyless support with a clear postal process.</h2>
            <p>
              Smartfobs focuses on motorcycle and scooter smart-key systems,
              with model-specific guidance before customers remove or post any
              electronics.
            </p>
          </div>
          <div className="site-shell evidence-grid">
            {trustEvidence.map((item) => (
              <article className="evidence-card" key={item.title}>
                <div className="evidence-image">
                  <Image
                    src={item.image}
                    alt={`${item.title} at Smartfobs`}
                    fill
                    sizes="(max-width: 900px) 100vw, 33vw"
                  />
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="site-shell faq-section">
          <div className="section-heading">
            <p className="eyebrow">FAQ</p>
            <h2>Quick answers for first-time customers.</h2>
          </div>
          <div className="faq-grid">
            <article>
              <h3>I have lost all smart keys. What happens first?</h3>
              <p>
                Send your bike make, model and year. Smartfobs can confirm the
                likely service and what needs to be sent before you post anything.
              </p>
            </article>
            <article>
              <h3>What does the SCU look like?</h3>
              <p>
                Use the What to Send and SCU Location pages for model-specific
                examples before removing parts from the motorcycle or scooter.
              </p>
            </article>
            <article>
              <h3>Can PIN codes be recovered?</h3>
              <p>
                For supported Honda, Yamaha and Suzuki systems, Smartfobs can
                recover or read the original PIN code directly from an original
                smart key fob.
              </p>
            </article>
          </div>
        </section>

        <section className="final-cta">
          <div className="site-shell final-cta-inner">
            <div>
              <p className="eyebrow">Ready to check compatibility?</p>
              <h2>Tell Smartfobs your make, model, year and key situation.</h2>
            </div>
            <div className="hero-actions">
              <Link className="button-primary" href="/pages/contact">
                Contact Smartfobs
              </Link>
              <Link className="button-secondary" href="/pages/compatibility">
                Check compatibility
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
