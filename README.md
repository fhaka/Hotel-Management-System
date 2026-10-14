# Hotel Imperial — Hotel Management System

A full-stack hotel management system: a public booking website for guests and an operations suite for staff
(front desk, reservations, housekeeping, billing, reports). Built as a fully working **demo** — payments are
simulated and the data is generated — and designed so a real payment provider, real data and production
hosting can be plugged in without rework.

## Quick start

Requirements: **Node.js 20+** and **Docker Desktop**.

```bash
npm install
npm run setup      # starts Postgres + Mailpit, runs migrations, seeds demo data
npm run dev        # http://localhost:3000
```

| Service | URL |
| --- | --- |
| Website | http://localhost:3000 |
| Staff operations | http://localhost:3000/admin |
| Demo email inbox (Mailpit) | http://localhost:8025 |

Other scripts: `npm run db:seed` (reset to fresh demo data), `npm run db:studio` (browse the database),
`npm test` (unit tests), `npm run lint`, `npm run typecheck`, `npm run build`.

## Demo accounts

All demo accounts share the password defined in `src/lib/demo.ts`. While `DEMO_MODE` is on, the login page
offers one-click sign-in for each role.

| Role | Email | Can access |
| --- | --- | --- |
| Administrator | admin@hotelimperial.al | Everything, incl. staff accounts and settings |
| Manager | manager@hotelimperial.al | Operations, rates & seasons, services, refunds, reports |
| Receptionist | reception@hotelimperial.al | Front desk, reservations, guests, billing, messages |
| Housekeeping | housekeeping@hotelimperial.al | Room status and housekeeping tasks |
| Guest | guest@example.com | Website account: bookings, invoices, profile |

**Test cards** (demo payment gateway, any future expiry and any CVC):
`4242 4242 4242 4242` succeeds · `4000 0000 0000 0002` is declined · `4000 0000 0000 9995` has insufficient funds.

## Features

**Guest website**
- Landing page, rooms & suites, room details, dining & spa, contact form (with map)
- Live availability search and pricing (weekday/weekend rates, seasons, city tax, VAT-inclusive)
- **Multi-room bookings**: pick several rooms (and room types) in one booking, set guests and a name per room
- **Company invoices**: guests can request an invoice to their company (name, NIPT / VAT ID, address)
- Checkout with add-ons (breakfast, transfers, spa…), pay now by card or pay at the hotel
- Instant confirmation page + confirmation email
- Manage booking with confirmation number + email: view bill, download PDF invoice, cancel (policy-aware refunds)
- Guest accounts: booking history, profile, password

**Operations suite** (role-based)
- **Dashboard** — occupancy tonight, guests in house, ADR, RevPAR, MTD revenue vs last month, 28-day occupancy chart,
  30-day revenue chart, room status, today's arrivals/departures, latest bookings
- **Room calendar** — rooms × dates tape chart; click an empty night to book
- **Front desk** — arrivals, departures, in-house, overdue; one-click check-in/out; pre-arrival reminder emails
- **Reservations** — search & filters, CSV export, new booking with live availability/price, detail page with
  modify stay (auto re-pricing), room moves, folio (post/void charges & discounts), payments, refunds,
  PDF invoice, emails, activity history
- **Group bookings** — several rooms under one booker and one confirmation code (`HG…`), one combined bill by default
  (rooms can depart with open charges; the group is settled and invoiced when the last room leaves), group payment split
  across rooms, check in all rooms at once, add rooms later, cancel the whole group
- **Guests** — CRM with VIP flag, preferences, ID details, stay history, lifetime value
- **Companies** — corporate accounts with tax number, contact and billing details; stays, revenue and open balances;
  bill any reservation or group to a company
- **Rooms & rates** — live room grid by floor, status & out-of-order, room types & rates editor, seasonal pricing
- **Housekeeping** — task board (to do / in progress / done), auto-tasks on check-out and out-of-order,
  stayover generation, assignment; completing a task updates the room status
- **Services** — catalogue of extras used at booking and on folios, with 30-day revenue
- **Billing** — payments, invoices, open balances, CSV export
- **Reports** — date-range KPIs (occupancy, ADR, RevPAR), daily charts, room-type performance, channels,
  guest origin, cancellation/no-show rates, CSV exports
- **Staff, activity log, settings** — user & role management, full audit trail, hotel profile/taxes/policies,
  email log

## Business rules

- A room can never be double-booked: enforced by a PostgreSQL exclusion constraint on `(roomId, stay dates)`,
  not just application checks. Concurrent bookings retry on the next free room.
- Stay dates are calendar dates; "today" is evaluated in the hotel time zone (Europe/Tirane).
- Rates are VAT-inclusive (20% by default); city tax (€1 per adult per night) is VAT-exempt.
- Free cancellation until 48h before arrival; later cancellations and no-shows are charged the first night.
  Prepayments are refunded automatically to the original card.
- Check-in requires the arrival date, an available room that is not out of order, and (unless overridden) clean;
  it is blocked while a departing guest is still in the room.
- Group bookings: per-guest extras apply to every room, other extras once; a payment is split across rooms with an
  open balance. With one bill, only the last departure needs a settled group balance and it issues one group invoice.
- Invoices are addressed to the company (with its NIPT / VAT ID) when the stay or group is billed to one.
- Check-out requires a settled folio. Early departures are re-priced to the nights used. Check-out issues the invoice,
  emails it as a PDF, marks the room dirty and creates a cleaning task.
- All settings above are editable in **Settings**.

## Architecture

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS 4, Radix primitives, lucide icons, Recharts, Sonner |
| Data | PostgreSQL 17, Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Auth | Signed JWT session cookie (`jose`), bcrypt passwords, role-based permissions |
| Email | Nodemailer over SMTP (Mailpit locally), HTML templates, every send logged |
| PDF | `@react-pdf/renderer` invoices |
| Tests | Vitest unit tests for pricing, folio, dates and the payment gateway |

```
prisma/              schema, migrations (incl. no-double-booking constraint), seed
src/app/(site)/      public website, booking flow, manage booking, guest account
src/app/(auth)/      login, registration
src/app/admin/       operations suite (one folder per module, each with its own server actions)
src/app/api/         invoice PDFs and CSV exports
src/lib/             domain logic: reservations, pricing, availability, folio, analytics, payments, email, auth
src/components/      design system and shared UI
tests/               unit tests
```

Security: every page and server action re-checks the user's role against the database (the proxy only does a
fast pre-check); inputs are validated with Zod; guest booking access uses signed cookies, never emails in URLs;
CSV exports are protected against formula injection; all staff actions are written to the audit log.

## Going live checklist

1. **Payments** — implement `PaymentProvider` (`src/lib/payments/types.ts`) for Stripe, register it in
   `src/lib/payments/index.ts`, set `PAYMENT_PROVIDER=stripe` and the Stripe keys.
2. **Email** — point `SMTP_*` and `MAIL_FROM` at the hotel's mail provider (e.g. Postmark, SES, Google Workspace).
3. **Data** — replace demo data: update Settings, room types/rates, rooms and services in the admin, create staff
   accounts, then remove the demo users (or run migrations on an empty database without the seed).
4. **Secrets & mode** — generate a new `AUTH_SECRET`, set `DEMO_MODE="false"`, set `APP_URL` to the public domain.
5. **Hosting** — any Node host (or Docker) with managed PostgreSQL; run `npm run build` and `npm run db:migrate`.
6. **Images** — swap the Unsplash photos for the hotel's own photography (room type editor accepts URLs or `/public` paths).
