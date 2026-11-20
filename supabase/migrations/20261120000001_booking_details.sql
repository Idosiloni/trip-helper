-- Bookings carry what a family checks before and during the trip (feedback 2026-11-20):
-- the free-cancellation deadline (shown on Today from 3 days before), the address, the price.
-- All optional; nothing existing changes. Prices are free text ("¥48,000", "$310 total").
alter table public.bookings
  add column cancel_by date,
  add column address   text check (char_length(address) <= 300),
  add column price     text check (char_length(price) <= 60);
