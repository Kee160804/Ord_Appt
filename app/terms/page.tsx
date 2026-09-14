import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/app/components/LegalDocument";
import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE } from "@/app/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | YuhBusiness",
  description:
    "Terms governing business accounts, storefront transactions, subscriptions, and use of YuhBusiness.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      summary="These terms govern access to YuhBusiness by business account holders, staff, storefront visitors, and customers."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <section>
        <h2>1. Agreement and eligibility</h2>
        <p>
          By creating an account, joining a business workspace, or using a
          storefront, you agree to these Terms and acknowledge the{" "}
          <Link href="/privacy">Privacy Policy</Link>. You must be at least 18
          and able to enter a binding agreement to own or administer a business
          account. If you act for a company or business, you represent that you
          have authority to bind it.
        </p>
      </section>

      <section>
        <h2>2. The platform&apos;s role</h2>
        <p>
          YuhBusiness supplies software for businesses to publish storefronts,
          manage staff, accept appointment requests and orders, keep operational
          and transaction records, send notifications, and manage subscriptions.
          Unless expressly stated otherwise for a future service, YuhBusiness is
          not the seller, service professional, delivery provider, bank, card
          issuer, or payment service provider in a customer-to-business
          transaction. The participating business is responsible for the goods
          or services it offers and for completing its customer transactions.
        </p>
      </section>

      <section>
        <h2>3. Accounts and security</h2>
        <p>
          Account information must be accurate and kept current. Users must
          protect credentials, use only their assigned account, and promptly
          report suspected unauthorised access. Business owners control staff
          access and are responsible for assigning appropriate roles and
          removing access when it is no longer needed. Activity performed
          through an account may be treated as authorised unless the compromise
          was reported promptly.
        </p>
      </section>

      <section>
        <h2>4. Business responsibilities</h2>
        <ul className="space-y-2">
          <li>
            Provide accurate identity, contact, pricing, tax, availability,
            delivery, cancellation, return, refund, and fulfilment information.
          </li>
          <li>
            Obtain licences, registrations, insurance, and permissions required
            for the business and its goods or services.
          </li>
          <li>
            Use customer data only for lawful, disclosed purposes and respond to
            customer privacy requests.
          </li>
          <li>
            Honour confirmed commitments or clearly communicate changes, delays,
            cancellations, substitutions, and refunds.
          </li>
          <li>
            Keep regulated, dangerous, counterfeit, infringing, discriminatory,
            deceptive, or illegal offerings off the platform.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Customer orders and appointments</h2>
        <p>
          An order or appointment request is submitted to the identified
          business. Acceptance, preparation, service quality, delivery,
          cancellation, returns, and refunds are governed by the information
          presented by that business and applicable law. Customers must provide
          accurate contact and fulfilment information and review prices, taxes,
          fees, timing, payment method, and business policies before submitting.
        </p>
      </section>

      <section>
        <h2>6. Payments and transaction records</h2>
        <p>
          Features labelled mock, simulated, demo, or test do not move real
          money and must not be represented as completed payment. Before real
          payment processing is enabled, the applicable provider, fees,
          settlement flow, dispute process, and additional terms must be
          disclosed. Real payment services must be supplied by an appropriately
          authorised provider. Businesses remain responsible for taxes,
          receipts, reconciliation, refunds, chargebacks, and legally required
          transaction records.
        </p>
      </section>

      <section>
        <h2>7. Plans, trials, and billing</h2>
        <p>
          Plan prices, currency, included usage, staff limits, billing
          frequency, and trial terms are shown before purchase. Unless a
          checkout states otherwise, subscriptions renew for the displayed
          period until cancelled. A cancellation stops future renewal but does
          not automatically reverse charges already incurred. Statutory rights
          and any refund terms shown at checkout continue to apply. We may
          suspend paid features after failed or overdue payment while preserving
          access required by law or for export.
        </p>
      </section>

      <section>
        <h2>8. Acceptable use</h2>
        <p>
          You may not interfere with the platform, bypass access controls,
          scrape protected data, send spam, distribute malware, test
          vulnerabilities without written permission, impersonate others, abuse
          customer contact details, or use YuhBusiness for fraud, money
          laundering, illegal sales, or infringement. Reasonable rate limits and
          protective controls may be applied to prevent abuse.
        </p>
      </section>

      <section>
        <h2>9. Content and intellectual property</h2>
        <p>
          Businesses retain ownership of content they provide and grant
          YuhBusiness a limited licence to host, reproduce, format, and display
          it to operate the service. The business warrants that it has the
          necessary rights to its names, images, descriptions, catalogues, and
          other content. YuhBusiness software, branding, and platform materials
          remain protected by applicable intellectual-property laws.
        </p>
      </section>

      <section>
        <h2>10. Privacy and confidentiality</h2>
        <p>
          Personal data is handled as described in the Privacy Policy. Each
          business must restrict customer data to staff who need it, maintain
          confidentiality, use reasonable security controls, and notify
          YuhBusiness promptly of a suspected compromise involving platform
          data.
        </p>
      </section>

      <section>
        <h2>11. Availability and changes</h2>
        <p>
          We work to provide a reliable service but do not promise uninterrupted
          or error-free availability. Features may change for security, legal,
          operational, or product reasons. Planned material changes that
          adversely affect paid service will be communicated when reasonably
          practicable. Users are responsible for maintaining appropriate copies
          of records they are legally required to keep.
        </p>
      </section>

      <section>
        <h2>12. Suspension and termination</h2>
        <p>
          Access may be limited or suspended to address a security threat,
          unlawful activity, non-payment, material breach, or risk to customers
          or the platform. An account holder may stop using the service and
          request account closure, subject to outstanding charges and lawful
          record-retention needs. Provisions concerning payments, ownership,
          liability, disputes, and retained records survive termination where
          necessary.
        </p>
      </section>

      <section>
        <h2>13. Disclaimers and liability</h2>
        <p>
          To the extent permitted by law, the platform is provided on an “as
          available” basis. YuhBusiness does not warrant a business&apos;s
          goods, services, professional qualifications, delivery, or customer
          conduct. Neither party excludes liability that cannot lawfully be
          excluded. Any additional limitation of liability, indemnity, or
          dispute clause should be reviewed against the legal identity and
          operating jurisdiction of the YuhBusiness operator before commercial
          launch.
        </p>
      </section>

      <section>
        <h2>14. Governing rules, updates, and contact</h2>
        <p>
          These Terms are intended to operate consistently with applicable
          Belize law, including rules governing electronic consumer transactions
          and data protection. The operator&apos;s full legal name, physical
          service address, governing-law clause, and dispute forum must be
          confirmed before taking real payments. Material updates will use a new
          effective date and may require renewed acceptance. Questions may be
          sent to{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalDocument>
  );
}
