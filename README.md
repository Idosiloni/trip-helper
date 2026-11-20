# Trip Helper

A family trip planner, built as a PWA. It's in Hebrew and right-to-left, and it works on a phone during the trip.

You don't type the whole trip into forms. The app writes a prompt for you, and you paste it into any AI chat (Claude, ChatGPT or Gemini). Then you paste the answer back. The app reads the ```` ```tripdata ```` block in that answer and turns it into tasks, packing lists, places, a day-by-day plan and bookings.

> אפליקציית תכנון טיולים משפחתית, בעברית, שעובדת גם מהטלפון בזמן הטיול. מעתיקים פרומט, מדביקים אותו בצ'אט, ומדביקים את התשובה בחזרה באפליקציה. היא מסדרת מהתשובה משימות, ציוד, מקומות, מסלול והזמנות.

## What it does

- **Today:** a countdown to the first flight before the trip. During the trip, it shows the trip day ("day 8 of 16"), the next train or flight, tonight's hotel, the day's stops, the weather and plan B. It also reminds you before free cancellation ends.
- **Plan:** days shown as a table, as cards or as a flowing document. Each day shows its activity hours, a book-ahead list and a lodging-per-city view. You can share a day to WhatsApp.
- **Bookings:** flights by leg, in local time zones. Hotels with check-in, check-out, address, price and the free-cancellation date. Confirmation codes are never sent to a chat.
- **Places:** grouped by city, with "near me" and Google Maps lists or KML import. Flights and trains stay out of the list.
- **Lists:** family tasks (shared by default), packing per bag and traveler, purchases and notes. An overdue task moves to tomorrow with one tap.
- **Paste safety:** a preview before anything is saved. It flags duplicates and similar tasks, and warns when a pasted hotel doesn't match a saved booking. You can undo the last paste.
- **Whole-plan import:** paste an existing trip doc, and one prompt splits it into every section.
- **Offline:** the last loaded trip opens without a connection. Changes made offline are sent when it comes back.
- **Family:** invite links, roles (owner, editor or viewer), realtime updates, an activity log and push notifications.

## Stack

- Next.js 16 (App Router), React 19, Tailwind CSS 4 and next-intl
- Supabase for Postgres, auth, Row Level Security, realtime and an Edge Function for push notifications
- MapLibre, Zod and Vitest
- Hosted on Vercel

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL and publishable key
npm run dev
```

The database lives in `supabase/migrations`. Apply it to your own project:

```bash
npx supabase link --project-ref <your-project-ref>
npm run db:push
```

> [!NOTE]
> One migration (`20261118200001_notifications.sql`) has this project's Supabase functions URL hard-coded. On your own project, change it to yours before you push, or push notifications will call the wrong URL.

## Checks

```bash
npm test            # unit tests (parsers, prompts, plan logic)
npm run typecheck
npm run db:check    # applies every migration to PGlite and runs RLS smoke checks, no Docker needed
npm run build
```

## Project layout

```
src/app/            routes (trips/[tripId]/today, plan, places, lists, settings…)
src/features/       screens and logic by area (itinerary, import, places, lists, trips, offline…)
src/lib/prompts/    the prompt templates
src/lib/tripdata/   the tripdata schema (it validates pasted answers and builds the prompt examples)
supabase/           migrations, Edge Functions and email templates
messages/he.json    all UI text
```

`SPEC.md` is the original product spec, in Hebrew.
