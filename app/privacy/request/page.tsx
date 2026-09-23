import type { Metadata } from "next";

import { LegalDocument } from "@/app/components/LegalDocument";
import { PrivacyRequestForm } from "@/app/components/PrivacyRequestForm";
import { PRIVACY_CONTACT_EMAIL, PRIVACY_EFFECTIVE_DATE } from "@/app/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Request | YuhBusiness",
  description:
    "Submit a personal-data access, correction, deletion, export, objection, restriction, or consent-withdrawal request to YuhBusiness.",
  alternates: { canonical: "/privacy/request" },
};

export default function PrivacyRequestPage() {
  return (
    <LegalDocument
      title="Submit a privacy request"
      summary={
        "Use this secure form to exercise a privacy right or ask how YuhBusiness handles your information. You may also email " +
        PRIVACY_CONTACT_EMAIL +
        "."
      }
      effectiveDate={PRIVACY_EFFECTIVE_DATE}
    >
      <PrivacyRequestForm />
    </LegalDocument>
  );
}
