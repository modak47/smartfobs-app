import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://smartfobs.co.uk"),
  title: {
    default: "Motorcycle Smart Key & PIN Code Recovery | Smartfobs",
    template: "%s | Smartfobs",
  },
  description:
    "Smartfobs provides motorcycle and scooter smart key programming, all-keys-lost recovery, immobiliser PIN recovery and SCU/ECU data services for Honda, Yamaha, Suzuki and Piaggio/Vespa.",
  alternates: {
    canonical: "/",
    languages: {
      "en-GB": "/",
      "en-US": "/en-us/",
      "en-EU": "/en-eu/",
    },
  },
  openGraph: {
    title: "Motorcycle Smart Key & PIN Code Recovery | Smartfobs",
    description:
      "Specialist smart-key programming, PIN recovery and SCU/ECU services for Honda, Yamaha, Suzuki and Piaggio/Vespa motorcycles and scooters.",
    url: "/",
    siteName: "Smartfobs",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Motorcycle Smart Key & PIN Code Recovery | Smartfobs",
    description:
      "Specialist smart-key programming, PIN recovery and SCU/ECU services for keyless motorcycles and scooters.",
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
