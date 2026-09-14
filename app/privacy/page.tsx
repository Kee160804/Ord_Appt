import type { Metadata } from "next";
import { LegalDocument } from "@/app/components/LegalDocument";
import { LEGAL_EFFECTIVE_DATE, PRIVACY_CONTACT_EMAIL } from "@/app/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | YuhBusiness",
  description:
    "How YuhBusiness collects, uses, shares, retains, and protects personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      summary="This policy explains how personal data is handled when businesses use YuhBusiness and when customers place orders, request appointments, or contact those businesses."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <section>
        <h2>1. Who this policy covers</h2>
        <p>
          YuhBusiness provides storefront, appointment, ordering, retail,
          customer-management, notification, analytics, and transaction-record
          tools to participating businesses. This policy covers business owners,
          staff, storefront visitors, customers, and people who contact us.
        </p>
        <p>
          YuhBusiness determines how account, subscription, platform-security,
          and service-usage data is used. A participating business generally
          determines why it collects its customers&apos; booking, order,
          contact, and fulfilment information. In that context, the business is
          responsible for its customer relationship and YuhBusiness processes
          information to provide the requested platform service.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <ul className="space-y-2">
          <li>
            Account details such as name, email address, phone number, login
            identifiers, role, and business membership.
          </li>
          <li>
            Business details such as business name, location, hours, contact
            information, staff, catalogues, services, prices, and settings.
          </li>
          <li>
            Customer transaction details such as name, email, phone, requested
            service or products, appointment time, delivery or pickup details,
            notes, discounts, totals, status, and transaction references.
          </li>
          <li>Messages submitted through a storefront or support channel.</li>
          <li>
            Technical and security information such as IP-derived request data,
            device/browser information, authentication events, timestamps, and
            abuse-prevention records.
          </li>
          <li>
            Subscription, invoice, refund, and payment-status records needed for
            accounting, reconciliation, fraud prevention, and support.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Payment information</h2>
        <p>
          The current YuhBusiness test payment mode is simulated. It does not
          request or store real card numbers, card security codes, or bank-login
          credentials. Before real payments are enabled, payment credentials
          will be collected and processed by an identified, appropriately
          authorised payment provider under that provider&apos;s privacy terms.
          YuhBusiness may retain payment references, amounts, currency, status,
          timestamps, fees, refunds, and reconciliation information, but should
          not receive raw card security data from the provider.
        </p>
      </section>

      <section>
        <h2>4. Why we use information</h2>
        <ul className="space-y-2">
          <li>
            Provide accounts, storefronts, orders, appointments, notifications,
            subscriptions, and support.
          </li>
          <li>
            Complete requested transactions and communicate status changes.
          </li>
          <li>
            Authenticate users, enforce tenant permissions, prevent abuse,
            investigate incidents, and protect the platform.
          </li>
          <li>
            Maintain transaction and consent records, comply with law, and
            resolve disputes.
          </li>
          <li>
            Measure service performance and improve features using aggregated or
            appropriately protected information.
          </li>
        </ul>
        <p>
          Processing is based, as applicable, on providing the requested
          service, legitimate operational and security interests, legal
          obligations, and consent where consent is required.
        </p>
      </section>

      <section>
        <h2>5. When information is shared</h2>
        <p>
          Information may be shared with the business a customer chooses to
          transact with; authorised staff of that business; hosting, database,
          authentication, email, monitoring, and payment vendors that help
          operate the service; professional advisers; and authorities or other
          parties where legally required or necessary to protect rights and
          safety. We do not sell personal data.
        </p>
        <p>
          Vendors are given only the information reasonably needed for their
          role and are expected to apply suitable confidentiality and security
          controls.
        </p>
      </section>

      <section>
        <h2>6. International processing</h2>
        <p>
          Cloud and service providers may process information outside Belize. We
          take reasonable steps to use contractual and technical protections
          appropriate to the information and applicable law when information is
          transferred or remotely accessed.
        </p>
      </section>

      <section>
        <h2>7. Retention</h2>
        <p>
          We retain information only as long as reasonably needed for the
          purposes described here, including account operation, transaction
          fulfilment, tax/accounting records, fraud prevention, backups,
          disputes, and legal obligations. Retention periods vary by record type
          and business need. Information may be deleted, anonymised, or isolated
          when it is no longer required. Businesses are responsible for setting
          lawful retention rules for customer information they control.
        </p>
      </section>

      <section>
        <h2>8. Security and incidents</h2>
        <p>
          We use access controls, tenant separation, restricted server
          credentials, encrypted network transport, logging, backups, and other
          organisational and technical safeguards appropriate to the service. No
          online service can guarantee absolute security. If a material incident
          occurs, we will investigate and provide notifications required by
          applicable law.
        </p>
      </section>

      <section>
        <h2>9. Your choices and rights</h2>
        <p>
          Depending on applicable law and the context, a person may request
          access, correction, erasure, restriction, or information about the use
          of their personal data; object to certain processing; or withdraw
          consent where processing relies on consent. Some records may be
          retained where required for a transaction, security, legal claim, or
          legal obligation.
        </p>
        <p>
          Storefront customers should first contact the business involved
          because that business controls the customer transaction. Requests
          concerning a YuhBusiness account or the platform may be sent to{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
            {PRIVACY_CONTACT_EMAIL}
          </a>
          . We may need to verify identity before completing a request.
        </p>
      </section>

      <section>
        <h2>10. Cookies and local storage</h2>
        <p>
          YuhBusiness uses authentication cookies and browser storage needed to
          keep users signed in, remember security/session choices, preserve a
          cart or interface preference, and operate the application. We do not
          currently describe these necessary technologies as advertising
          cookies. If optional analytics or advertising technologies are
          introduced, this policy and any required consent controls must be
          updated before they are enabled.
        </p>
      </section>

      <section>
        <h2>11. Children</h2>
        <p>
          Business accounts are not intended for people under 18. A parent or
          legal guardian should submit and manage a booking or order involving a
          child where required. Businesses must not use YuhBusiness to collect
          children&apos;s data without an appropriate lawful basis and any
          required guardian consent.
        </p>
      </section>

      <section>
        <h2>12. Changes and contact</h2>
        <p>
          We may update this policy as the service, vendors, or legal
          requirements change. Material changes will be identified by a new
          effective date and, where appropriate, an in-product or email notice.
          Questions and privacy requests may be sent to{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
            {PRIVACY_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalDocument>
  );
}
