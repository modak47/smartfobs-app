import BusinessManagementApp from "@/components/bms/BusinessManagementApp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SmartFobs Internal App",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SmartFobsPage() {
  return <BusinessManagementApp />;
}
