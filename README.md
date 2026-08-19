# DukaKonnect

*biashara yako, siku kwa siku*

DukaKonnect keeps the books for small shops in Kenya — the kind of business in Voi,
Oyugis or Kilifi that runs on a paper daybook and a good memory. It records
sales, tracks stock, follows up deni, and tells the owner what they actually took
home that day.

The name is Swahili, from the Arabic *tārīkh*: a date, and a record kept over
time. That is what the app is — a dated book, one day at a time.

## What it does

- **Sell** — tap an item, set the quantity, stock adjusts itself
- **Negotiated prices** — staff can agree a price with a customer, but only
  within a range the owner sets on each item
- **Deni** — credit sales and repayments, with a dated payment history
- **Stock** — restock records raise stock, update the average unit cost, and log
  the spend in one step
- **Spending** — one-off, variable and recurring expenses, with the option to
  spread a big monthly bill across the days it covers
- **Reports** — sales, purchases and expenses over any range, exportable to CSV
- **Staff** — each person gets their own login and chooses their own password;
  they can sell and see stock, but never cost prices, expenses or profit

## Running it

```sh
npm install
npm run dev
```

Requires a `.env` (see `.env.example`) with the Supabase project URL and
publishable key. Those are safe in a browser bundle — row level security is what
protects the data.

## Deploying

- **Frontend** — pushes to `main` deploy via Vercel. Environment variables live
  in the Vercel project settings.
- **Database** — SQL in `supabase/migrations/`, applied through the Supabase
  dashboard SQL editor, in filename order.
- **Edge Functions** — `supabase/functions/*`, deployed through the Supabase
  dashboard. `create-employee` and `remove-employee` need the service role key,
  which the platform injects automatically.

## How it is put together

Vite, React, TypeScript, Tailwind, shadcn/ui, Supabase.

Two rules worth knowing before changing anything:

1. **Money moves through database functions, not the client.** Selling,
   restocking, voiding a sale and recording a deni payment all run as
   `SECURITY DEFINER` RPCs that lock the row they touch. That is what stops two
   phones on the same counter from overwriting each other.
2. **`shop_members` is not writable from the client.** Membership is created by
   `create_shop_with_owner()` and the `create-employee` function, and removed by
   `remove-employee`. Adding a client-side INSERT policy there would reopen a
   cross-tenant hole that has already been closed once.

## Brand

Terracotta `#c85a2e`, sage `#4f9469`, paper `#f8f7f5`. The mark is a T built from
a ledger rule — the crossbar is the ruled line, the sage bar is an entry written
at the end of it. Sources are in `public/*.svg`; the PNGs are generated from them.

Interfaces follow the same idea: ruled sheets rather than cards, aligned figures,
one number per screen that matters more than the rest.
