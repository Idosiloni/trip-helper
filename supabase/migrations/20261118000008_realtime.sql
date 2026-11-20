-- Live updates (SPEC 11): the client subscribes per trip with filter trip_id=eq.<id>.
-- postgres_changes applies RLS to each subscriber. Deletes are soft (an UPDATE),
-- so subscribers always get the full new row.
-- TODO(verify): Supabase may recommend Broadcast-from-Database for scale; for a family app this is plenty.

alter publication supabase_realtime add table
  public.trips,
  public.trip_members,
  public.travelers,
  public.task_groups,
  public.tasks,
  public.bags,
  public.packing_items,
  public.activity;
