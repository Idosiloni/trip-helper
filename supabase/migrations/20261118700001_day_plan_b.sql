-- A day's "plan B": what to do if it rains, a ropeway closes or everyone is tired.
-- Written by the chat (prompt 1 / 13) or by hand. Same access rules as the rest of the day.
alter table public.trip_days add column plan_b text check (char_length(plan_b) <= 1000);
