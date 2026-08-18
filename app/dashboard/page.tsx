import type { Metadata } from "next";
import BusinessManagementApp from "@/components/bms/BusinessManagementApp";

export const metadata: Metadata = {
  title: "SmartFobs Dashboard",
  description: "Internal SmartFobs bookkeeping dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardPage() {
  return <BusinessManagementApp />;
}
