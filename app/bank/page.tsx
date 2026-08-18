import BusinessManagementApp from "@/components/bms/BusinessManagementApp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SmartFobs Bank Imports",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BankPage() {
  return <BusinessManagementApp initialSection="imports" />;
}
