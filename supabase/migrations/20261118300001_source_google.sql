-- Places imported from a Google My Maps KML/KMZ file (SPEC 6.5 "מאיפה").
-- Own migration: a new enum value can't be used in the transaction that adds it.
alter type public.item_source add value if not exists 'google';
