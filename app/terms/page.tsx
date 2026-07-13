import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | SmartFobs",
};

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service">
      <LegalSection title="Who operates SmartFobs">
        <p>SmartFobs is operated by D Byrne as a sole trader.</p>
      </LegalSection>

      <LegalSection title="Purpose of the application">
        <p>
          The application is intended for internal business bookkeeping and administration, including job records, expense records,
          reports, bank transaction review and related business record keeping.
        </p>
      </LegalSection>

      <LegalSection title="User responsibilities">
        <p>Users remain responsible for:</p>
        <LegalList
          items={[
            "Checking the accuracy of imported transactions",
            "Correctly categorising income and expenses",
            "Keeping supporting receipts and records",
            "Checking tax calculations",
            "Submitting correct information to HMRC",
          ]}
        />
      </LegalSection>

      <LegalSection title="Reports and tax estimates">
        <p>
          Reports and tax estimates are informational only. They are not professional accounting or tax advice, and should be checked
          before relying on them for any filing, payment or business decision.
        </p>
      </LegalSection>

      <LegalSection title="Bank information">
        <p>
          Bank information may be imported only after permission is granted. The application must not be used to initiate unauthorised
          transactions or access another person’s account.
        </p>
      </LegalSection>

      <LegalSection title="Availability">
        <p>
          Availability is not guaranteed. The application and supporting services may occasionally be interrupted, delayed or unavailable
          because of maintenance, service provider issues or technical faults.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          SmartFobs is provided as a practical bookkeeping and administration tool. To the fullest extent permitted by law, the business
          owner is not responsible for losses caused by inaccurate entries, incorrect categorisation, interrupted availability, user error
          or reliance on reports without independent checking.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>These terms are governed by the laws of England and Wales.</p>
      </LegalSection>

      <p className="border-t border-[#3a404d] pt-6 text-sm text-[#8d929e]">Last updated: July 2026</p>
    </LegalPage>
  );
}
