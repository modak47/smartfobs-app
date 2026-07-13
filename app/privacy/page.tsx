import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | SmartFobs",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <LegalSection title="Who operates SmartFobs">
        <p>SmartFobs is operated by D Byrne as a sole trader.</p>
      </LegalSection>

      <LegalSection title="Information processed">
        <p>The SmartFobs bookkeeping application may process information needed to run and administer the business, including:</p>
        <LegalList
          items={[
            "Customer names and contact details",
            "Job and vehicle information",
            "Income and expense records",
            "Bank transaction information",
            "Uploaded receipts and invoices",
          ]}
        />
      </LegalSection>

      <LegalSection title="How information is used">
        <p>Information is used for legitimate business administration and record keeping, including:</p>
        <LegalList
          items={[
            "Managing jobs",
            "Maintaining business and tax records",
            "Producing financial reports",
            "Matching and categorising bank transactions",
            "Meeting legal and HMRC record-keeping obligations",
          ]}
        />
      </LegalSection>

      <LegalSection title="Storage and service providers">
        <p>
          Data is stored using secure third-party infrastructure, including Supabase and Vercel. These services help provide database,
          hosting and application infrastructure for SmartFobs.
        </p>
      </LegalSection>

      <LegalSection title="Banking data">
        <p>
          Banking data will only be accessed after the account holder gives explicit consent. SmartFobs will not initiate payments and
          will not sell personal information. Bank access permission can be withdrawn.
        </p>
      </LegalSection>

      <LegalSection title="Data retention">
        <p>
          Financial records may be retained for the period required by UK tax law and for as long as reasonably needed to meet legal,
          accounting and HMRC record-keeping obligations.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Depending on the circumstances and legal requirements, users may have rights including:</p>
        <LegalList
          items={[
            "Access to personal information",
            "Correction of inaccurate information",
            "Deletion where legally permitted",
            "Restriction of processing",
            "Withdrawal of consent",
          ]}
        />
      </LegalSection>

      <LegalSection title="Contact">
        <p>For privacy enquiries, contact the SmartFobs business owner.</p>
      </LegalSection>

      <p className="border-t border-[#3a404d] pt-6 text-sm text-[#8d929e]">Last updated: July 2026</p>
    </LegalPage>
  );
}
