import type { Metadata } from "next";
import BusinessManagementApp from "@/components/bms/BusinessManagementApp";

export const metadata: Metadata = {
  title: "SmartFobs Business OS",
  description: "DWB Trading bookkeeping, stock, mileage and tax dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function InternalAppPage() {
  return <BusinessManagementApp />;
}
