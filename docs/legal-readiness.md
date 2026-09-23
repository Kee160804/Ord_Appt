# YuhBusiness legal and privacy readiness

The public Privacy Policy and Terms of Service describe the application as it
currently operates. They are a product baseline, not legal advice or a claim
that every operational compliance task is complete.

## Implemented in the application

- Public `/privacy` and `/terms` pages with versioned effective dates.
- Required Terms and Privacy acknowledgement during owner registration.
- Acceptance timestamp and policy versions carried in Supabase Auth user
  metadata and copied at signup into the server-owned, append-only
  `legal_acceptances` audit table. Demo-mode acceptance is stored in local
  browser storage.
- Privacy and Terms notices at order, appointment, and contact submission
  points.
- Legal links on the marketing, login, registration, and invitation surfaces.
- Clear disclosure that mock payments do not move money or collect card data.
- Legal pages included in the public sitemap.
- A rate-limited public privacy-request form with reference codes and Resend
  acknowledgements.
- A protected super-admin request queue with identity-verification state,
  target dates, resolution notes, and an append-only case event trail.
- A documented privacy operations and incident-response runbook.

## Required before accepting real payments

1. Replace references to “YuhBusiness” as the operator with the operator's full
   registered legal name, principal geographic address, registration details,
   and a working telephone or electronic contact.
2. Have Belize-qualified counsel review the Privacy Policy, Terms, plan billing
   language, liability language, governing law, dispute forum, refunds,
   cancellations, and business/customer allocation of responsibility.
3. Confirm whether the planned payment flow makes the operator a regulated
   payment service provider. Use an appropriately licensed payment provider and
   do not take custody of customer funds unless specifically authorised.
4. Publish the payment provider name, fees, settlement timing, chargeback and
   dispute flow, supported payment methods, and provider privacy terms before
   enabling its checkout option.
5. Require each business to publish accurate fulfilment, cancellation, return,
   exchange, and refund rules at checkout. Do not rely only on the platform-wide
   Terms for business-specific consumer obligations.
6. Provision working `privacy@yuhbusiness.com` and `legal@yuhbusiness.com`
   inboxes and define an owner and response-time target for each.

Apply `supabase/migrations/202609140001_legal_acceptance_audit.sql` before
opening production registration so new acceptances are written to the audit
table.

## Data protection operations

1. Create and maintain a data inventory covering Supabase, hosting, Resend,
   monitoring, backups, local storage, and the future payment provider.
2. Record the purpose, lawful basis, data fields, recipients, location, access
   roles, and retention period for each processing activity.
3. Execute appropriate processor/vendor agreements and document international
   transfer safeguards.
4. Operate and periodically test the implemented workflow for access,
   correction, erasure, objection, restriction, consent withdrawal, export,
   and business-to-platform privacy requests.
5. Establish record-specific retention schedules and automated deletion or
   anonymisation where appropriate. Ensure backup expiry follows the schedule.
6. Maintain an incident-response plan covering containment, investigation,
   evidence, affected-business coordination, and legally required notifications.
7. Review tenant roles regularly, require multi-factor authentication for
   privileged accounts, rotate secrets, and audit service-role access.
8. Complete a data protection impact/risk assessment before introducing real
   payments, sensitive service notes, large-scale monitoring, or new analytics.

## Belize reference points for counsel

- [Data Protection Act, 2021 (Act No. 45 of 2021)](https://www.nationalassembly.gov.bz/wp-content/uploads/2021/12/Act-No-45-of-2021-Data-Protection-Act.pdf)
- [Electronic Transactions Act, Chapter 229:03](https://www.centralbank.org.bz/docs/default-source/2.10-national-payment-system-act/regulatory-framework/cap-229-03-electronic-transactions-act.pdf)
- [National Payment System Act and regulatory framework](https://www.centralbank.org.bz/about-the-bank/laws-and-regulations/national-payment-system-act)
- [Central Bank list of licensed payment service providers](https://www.centralbank.org.bz/home/core-functions/prudential-supervision/payment-service-providers)
