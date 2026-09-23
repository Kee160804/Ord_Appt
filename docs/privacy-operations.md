# Privacy operations runbook

This runbook supports the public privacy-request form and the protected
**Super Admin → Privacy Requests** queue. It is an operational baseline, not a
substitute for advice from Belize-qualified counsel.

## Request workflow

1. Open the case and confirm the request type, relationship, business
   reference, target date, and supplied details.
2. Move the case to **Identity verification** before disclosing, exporting,
   correcting, or deleting information.
3. Verify the requester using information already associated with the account
   or transaction. Do not ask for passwords, card details, or unnecessary
   identity documents.
4. Identify whether YuhBusiness or the named business controls the requested
   data. Coordinate with the business when it controls the customer record.
5. Record the systems searched, decision, actions, exceptions, and completion
   date in the internal resolution notes.
6. Use **Denied** only with a documented reason. Use **Completed** only after
   the response or action has actually been delivered.
7. Communicate using the request reference code. Do not include unrelated
   personal data in email.

The queue uses a 30-day internal target to make overdue work visible. Counsel
should confirm the legally required response period and any permitted
extensions.

## Identity verification

- Account holders: verify control of the registered account email and confirm
  recent non-sensitive account information.
- Business owners or staff: verify the authenticated account, tenant
  membership, and role.
- Storefront customers: match the email plus a limited order or appointment
  reference. Do not reveal whether unrelated records exist.
- If identity cannot be verified, mark **Failed**, document the attempts, and
  do not disclose or delete data.

## Data map and retention decisions

Maintain an approved schedule for at least these groups:

| Record group                                       | Primary systems                | Default action pending counsel                                                        |
| -------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| Accounts, memberships, legal acceptances           | Supabase Auth and Postgres     | Retain while active; preserve acceptance and security evidence as required            |
| Orders, appointments, invoices, payment references | Postgres and payment provider  | Retain for fulfilment, accounting, disputes, fraud controls, and applicable law       |
| Customer profiles and contact messages             | Postgres                       | Review for deletion or anonymisation when no longer operationally or legally required |
| Transactional email records                        | Postgres and Resend            | Retain only delivery metadata needed for support and abuse investigation              |
| Rate-limit and security records                    | Postgres and hosting logs      | Keep for a short documented security window                                           |
| Uploaded storefront media                          | Supabase Storage               | Remove after tenant deletion unless preservation is required                          |
| Backups                                            | Supabase and hosting providers | Ensure deletion follows the provider backup-expiry cycle                              |

Never run bulk deletion directly from an unverified public request. Use
tenant-scoped, reviewed operations and preserve financial, fraud, dispute,
security, and legal records when required.

## Incident response

1. Contain access without destroying evidence.
2. Record when the incident was detected, affected systems and tenants, data
   categories, approximate people affected, and current risk.
3. Rotate exposed credentials and review service-role, admin, and authentication
   logs.
4. Coordinate with affected businesses and vendors.
5. Obtain legal guidance on regulator and individual notifications.
6. Record decisions, corrective work, and the post-incident review.

## Recurring controls

- Monthly: review open/overdue privacy requests and failed email delivery.
- Quarterly: review super-admin access, tenant roles, service-role use, MFA,
  vendor access, and data exports.
- Twice yearly: test account/tenant deletion, customer export, backup recovery,
  and incident-response contacts.
- Annually or after material product/vendor changes: refresh the data map,
  retention schedule, processor agreements, privacy policy, and risk
  assessment.
