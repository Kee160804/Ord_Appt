# Belize Bank subscription checkout

This integration is intentionally limited to monthly YuhBusiness subscription
payments made by business owners. It does not process or route storefront
customer payments for orders, appointments, or retail purchases.

## Payment flow

1. The authenticated business owner selects a YuhBusiness plan and staff seats.
2. The server recalculates the official BZD price and creates a pending checkout
   session.
3. The server submits an `application/x-www-form-urlencoded` request to Belize
   Bank's `/register.do` endpoint using server-only platform credentials.
4. The browser is redirected to the returned Belize Bank hosted payment page.
5. Belize Bank collects all card information. YuhBusiness never receives a card
   number, expiry date, or CVV.
6. Belize Bank posts payment events to the callback route.
7. Because the integration guide does not document callback signing,
   YuhBusiness treats the callback only as a notification and independently
   queries `/getOrderStatusExtended.do` with the platform credentials.
8. Only status `2` with the exact expected minor-unit amount activates the
   subscription and creates the paid invoice and payment-ledger record.

The return URL performs the same authenticated status verification. Returning
from the hosted page is never accepted as proof of payment.

## Required migration

Apply:

`supabase/migrations/202610150003_belize_bank_subscription_checkout.sql`

The migration creates a server-only checkout-session table. Pending gateway
registrations remain separate from the paid subscription ledger.

## Sandbox configuration

Configure these server-side variables in the deployment environment:

```text
BILLING_PROVIDER=belize_bank
BELIZE_BANK_PAYMENT_URL=https://sandbox.belizebank.com/payment/rest
BELIZE_BANK_USERNAME=<sandbox username from Belize Bank>
BELIZE_BANK_PASSWORD=<sandbox password from Belize Bank>
NEXT_PUBLIC_APP_URL=https://your-public-https-domain.example
```

Do not prefix credentials with `NEXT_PUBLIC_`, commit them, place them in client
code, or print them in application logs. Belize Bank supplies sandbox usernames
and passwords separately from the integration guide.

The callback registered with Belize Bank is:

```text
https://your-public-https-domain.example/api/billing/belize-bank/callback
```

Localhost cannot receive a bank callback. Use a controlled HTTPS preview or
tunnel for sandbox certification and configure `NEXT_PUBLIC_APP_URL` to that
origin during the test.

## Production configuration

After Belize Bank certifies the sandbox integration, set:

```text
BILLING_PROVIDER=belize_bank
BELIZE_BANK_PAYMENT_URL=https://gateway.belizebank.com/payment/rest
BELIZE_BANK_USERNAME=<production username from Belize Bank>
BELIZE_BANK_PASSWORD=<production password from Belize Bank>
NEXT_PUBLIC_APP_URL=https://yuhbusiness.com
```

Use separate sandbox and production environment values. Never deploy sandbox
credentials to production.

## Status mapping

| Bank status | Meaning                       | YuhBusiness result                                             |
| ----------- | ----------------------------- | -------------------------------------------------------------- |
| `0`         | Registered but unpaid         | Pending                                                        |
| `1`         | Pre-authorized                | Pending; subscriptions do not use pre-authorization            |
| `2`         | Fully authorized              | Subscription activated after amount verification               |
| `3`         | Cancelled                     | Checkout cancelled                                             |
| `4`         | Refunded                      | Payment ledger marked refunded; access is not silently revoked |
| `5`         | Issuer authentication started | Pending                                                        |
| `6`         | Declined                      | Checkout failed                                                |

## Current recurring-billing boundary

The supplied guide documents hosted one-time authorization and tokenized-card
payments, but it does not define a compliant unattended recurring-payment
mandate. The implementation therefore charges one month through hosted checkout
and does not automatically rebill a saved card. Automatic renewal must wait for
written Belize Bank guidance covering stored credentials, customer consent,
merchant-initiated transactions, retries, and cancellation.

## Sandbox acceptance checklist

- Successful test card activates exactly one subscription period.
- A declined card does not activate access or create a paid invoice.
- A 3-D Secure transaction remains pending until the verified status becomes
  fully authorized.
- Replaying a callback does not create a second invoice or extend the period
  twice.
- A forged callback cannot activate access because status is re-queried.
- A mismatched amount fails closed and does not activate access.
- Refreshing or retrying a checkout request does not create a duplicate bank
  registration.
- No raw card data, gateway password, or full gateway response is logged or
  stored.
