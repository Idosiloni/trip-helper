// Applies supabase/migrations to an in-process Postgres (PGlite) with Supabase stubs
// and smoke-tests the RLS rules. No Docker needed. Run: npm run db:check
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? "supabase/migrations";
const db = new PGlite();
// Stubs for what Supabase provides.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create publication supabase_realtime;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`);
for (const f of fs.readdirSync(dir).sort()) {
  try { await db.exec(fs.readFileSync(path.join(dir, f), "utf8")); console.log("applied", f); }
  catch (e) { console.error("FAILED", f, e.message); process.exit(1); }
}
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222", C = "33333333-3333-3333-3333-333333333333";
await db.exec(`insert into auth.users (id) values ('${A}'),('${B}'),('${C}')`);
const as = async (uid, sql) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return { rows: (await db.query(sql)).rows }; } catch (e) { return { error: e.message }; }
};
let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : extra); };

const created = await as(A, `select * from public.create_trip('Japan')`);
const trip = created.rows?.[0]?.id; check("create_trip", !!trip, created.error ?? "");
{ const o = await as(A, `select public.my_trip_role('${trip}')::text r`); check("owner role", o.rows?.[0]?.r === "owner", JSON.stringify(o)); }
await db.exec(`reset role; insert into public.trip_members (trip_id,user_id,role) values ('${trip}','${B}','editor')`);
check("member reads trip", (await as(B, `select id from public.trips where id='${trip}'`)).rows?.length === 1);
check("stranger can't read trip", (await as(C, `select id from public.trips where id='${trip}'`)).rows?.length === 0);
check("stranger can't read members", (await as(C, `select 1 from public.trip_members where trip_id='${trip}'`)).rows?.length === 0);
check("stranger update affects 0", (await as(C, `update public.trips set name='x' where id='${trip}' returning id`)).rows?.length === 0);
check("editor renames", (await as(B, `update public.trips set name='Renamed' where id='${trip}' returning name`)).rows?.[0]?.name === "Renamed");
let r = await as(B, `update public.trips set archived_at=now() where id='${trip}'`); check("editor can't archive", !!r.error, r.error);
r = await as(A, `update public.trips set archived_at=now() where id='${trip}' returning id`); check("owner archives", r.rows?.length === 1, r.error ?? "");
r = await as(C, `insert into public.trip_members (trip_id,user_id,role) values ('${trip}','${C}','owner')`); check("self-join blocked", !!r.error, r.error);
r = await as(B, `update public.trip_members set role='owner' where trip_id='${trip}' and user_id='${B}'`); check("self-promote blocked", !!r.error, r.error);
r = await as(A, `delete from public.trip_members where trip_id='${trip}' and user_id='${A}'`); check("last owner can't leave", !!r.error, r.error);
r = await as(B, `delete from public.trip_members where trip_id='${trip}' and user_id='${B}' returning user_id`); check("editor can leave", r.rows?.length === 1, r.error ?? "");
await db.exec(`reset role; insert into public.trip_members (trip_id,user_id,role) values ('${trip}','${B}','editor')`);
check("profile auto-created", (await as(A, `select id from public.profiles where id='${A}'`)).rows?.length === 1);
check("fellow member profile visible", (await as(B, `select id from public.profiles where id='${A}'`)).rows?.length === 1);
check("stranger profile hidden", (await as(C, `select id from public.profiles where id='${A}'`)).rows?.length === 0);
check("can't edit others' profile", (await as(B, `update public.profiles set display_name='x' where id='${A}' returning id`)).rows?.length === 0);
r = await as(A, `select * from public.create_trip('Bad', '#FF5A36', '2027-05-10', '2027-05-01')`); check("date order enforced", !!r.error, r.error);

// ---------------------------------------------------------------- phase 1
const D = "44444444-4444-4444-4444-444444444444", E = "55555555-5555-5555-5555-555555555555";
await db.exec(`reset role; insert into auth.users (id) values ('${D}'),('${E}')`);
const one = async (uid, sql) => { const r = await as(uid, sql); return r.error ? { error: r.error } : r.rows?.[0]; };
const val = async (uid, sql) => { const r = await one(uid, sql); return r?.error ? r : r && Object.values(r)[0]; };

const tA = (await one(A, `insert into public.travelers (trip_id,label,linked_user_id,position) values ('${trip}','אבא','${A}','a0') returning id`)).id;
const tNoa = (await one(A, `insert into public.travelers (trip_id,label,age_group,position) values ('${trip}','נועה','child','a1') returning id`)).id;
check("editor adds travelers", !!tA && !!tNoa);
r = await as(C, `insert into public.travelers (trip_id,label,position) values ('${trip}','x','a2')`); check("stranger can't add travelers", !!r.error);

const token = await val(A, `insert into public.invites (trip_id, role) values ('${trip}','viewer') returning token`);
check("invite token is 64 hex chars", /^[0-9a-f]{64}$/.test(token ?? ""), String(token));
await db.exec(`reset role; set role anon;`);
const prev = (await db.query(`select * from public.invite_preview('${token}')`)).rows[0];
check("anon sees invite preview", prev?.status === "ok" && prev?.trip_name === "Renamed", JSON.stringify(prev));
await db.exec(`reset role;`);
check("bad token preview = not_found", (await one(C, `select status from public.invite_preview('nope')`))?.status === "not_found");
check("non-member can't read invites table", (await as(D, `select 1 from public.invites where trip_id='${trip}'`)).rows?.length === 0);
check("invite_travelers lists 2", (await as(D, `select * from public.invite_travelers('${token}')`)).rows?.length === 2);

r = await one(D, `select public.accept_invite('${token}', '${tNoa}') as t`); check("viewer joins via invite", r?.t === trip, JSON.stringify(r));
check("joined as viewer", (await val(D, `select public.my_trip_role('${trip}')::text`)) === "viewer");
check("traveler linked to joiner", (await val(A, `select linked_user_id from public.travelers where id='${tNoa}'`)) === D);
check("join is idempotent", (await one(D, `select public.accept_invite('${token}') as t`))?.t === trip);
r = await one(E, `select public.accept_invite('${token}', null, 'a2') as t`); check("second user joins, new traveler", r?.t === trip, JSON.stringify(r));
check("new traveler created for E", (await val(A, `select count(*)::int from public.travelers where trip_id='${trip}' and linked_user_id='${E}'`)) === 1);

const k1 = (await one(A, `insert into public.tasks (trip_id,title,assignee_traveler_id,position) values ('${trip}','להזמין מלון','${tNoa}','a0') returning id`)).id;
const k2 = (await one(A, `insert into public.tasks (trip_id,title,assignee_traveler_id,position) values ('${trip}','להוציא כסף','${tA}','a1') returning id`)).id;
check("editor creates tasks", !!k1 && !!k2);
r = await as(D, `insert into public.tasks (trip_id,title,position) values ('${trip}','x','a2')`); check("viewer can't create tasks", !!r.error);
r = await as(D, `update public.tasks set done=true where id='${k1}' returning done_by`); check("viewer checks off own task", r.rows?.[0]?.done_by === D, JSON.stringify(r));
r = await as(D, `update public.tasks set done=true where id='${k2}' returning id`); check("viewer can't check others' task", r.rows?.length === 0, JSON.stringify(r));
r = await as(D, `update public.tasks set title='x' where id='${k1}'`); check("viewer can't edit own task text", !!r.error);
r = await as(A, `insert into public.tasks (trip_id,title,link,position) values ('${trip}','x','javascript:alert(1)','a3')`); check("non-http link rejected", !!r.error);
r = await as(A, `insert into public.tasks (trip_id,title,link,position) values ('${trip}','x','https://example.com/a','a3') returning id`); check("https link ok", r.rows?.length === 1, r.error);

const bag = (await one(A, `insert into public.bags (trip_id,label,owner_traveler_id,position) values ('${trip}','תיק של נועה','${tNoa}','a0') returning id`)).id;
const it1 = (await one(A, `insert into public.packing_items (trip_id,title,bag_id,position) values ('${trip}','נעליים','${bag}','a0') returning id`)).id;
r = await as(D, `update public.packing_items set state='packed' where id='${it1}' returning packed_by`); check("viewer packs item in own bag", r.rows?.[0]?.packed_by === D, JSON.stringify(r));
check("bag fully packed logged", (await val(A, `select count(*)::int from public.activity where trip_id='${trip}' and type='bag.packed'`)) === 1);

const before = await val(A, `select count(*)::int from public.activity where trip_id='${trip}'`);
r = await one(A, `select public.commit_import('${trip}','packing','[{"title":"מעיל","qty":4,"position":"a1","category":"clothing"},{"title":"גרביים","position":"a2"}]'::jsonb,'raw answer','p04-packing',1,'ai','ChatGPT') as n`);
check("commit_import packing inserts 2", r?.n === 2, JSON.stringify(r));
r = await one(A, `select public.commit_import('${trip}','tasks','[{"title":"ויזה","position":"a5","assignee_traveler_id":"${tA}"},{"title":"ביטוח","position":"a6"}]'::jsonb,'raw','p03-tasks',1) as n`);
check("commit_import tasks inserts 2", r?.n === 2, JSON.stringify(r));
const after = await val(A, `select count(*)::int from public.activity where trip_id='${trip}'`);
check("imports log one feed row each", after - before === 2, `${before} -> ${after}`);
r = await as(D, `select public.commit_import('${trip}','tasks','[{"title":"x","position":"a9"}]'::jsonb,'raw')`); check("viewer can't import", !!r.error);
r = await as(C, `select public.commit_import('${trip}','tasks','[{"title":"x","position":"a9"}]'::jsonb,'raw')`); check("stranger can't import", !!r.error, JSON.stringify(r));
check("can_edit_trip is false (not null) for strangers", (await val(C, `select public.can_edit_trip('${trip}')`)) === false);
r = await as(A, `select public.commit_import('${trip}','tasks','[{"title":"x","position":"a9","assignee_traveler_id":"00000000-0000-0000-0000-000000000000"}]'::jsonb,'raw')`); check("import rejects foreign traveler", !!r.error);

r = await as(A, `update public.tasks set deleted_at=now() where id='${k2}' returning id`); check("soft delete", r.rows?.length === 1);
check("delete logged", (await val(A, `select count(*)::int from public.activity where type='task.deleted' and entity_id='${k2}'`)) === 1);
r = await as(A, `update public.tasks set deleted_at=null where id='${k2}' returning id`); check("restore", r.rows?.length === 1);

await as(A, `update public.invites set revoked_at=now() where token='${token}'`);
check("revoked preview", (await one(C, `select status from public.invite_preview('${token}')`))?.status === "revoked");
r = await as(C, `select public.accept_invite('${token}')`); check("revoked invite can't be accepted", !!r.error);
r = await as(A, `update public.invites set use_count=0 where token='${token}'`); check("use_count can't be edited", !!r.error);
check("stranger sees no activity", (await as(C, `select 1 from public.activity where trip_id='${trip}'`)).rows?.length === 0);

await as(A, `update public.trips set profile='{"luggage":{"suitcases":2},"answerLanguage":"he"}' where id='${trip}'`);
r = await one(A, `select public.patch_trip_profile('${trip}', '{"destinations":[{"country":"יפן"}]}') as p`);
check("profile patch merges top-level keys", r?.p?.luggage?.suitcases === 2 && r?.p?.destinations?.[0]?.country === "יפן", JSON.stringify(r));
r = await as(D, `select public.patch_trip_profile('${trip}', '{"answerLanguage":"en"}')`); check("viewer can't patch profile", !!r.error);
r = await as(C, `select public.patch_trip_profile('${trip}', '{"answerLanguage":"en"}')`); check("stranger can't patch profile", !!r.error);

// ---------------------------------------------------------------- phase 2
await as(A, `update public.trips set profile = profile || '{"destinations":[{"country":"יפן","cities":[{"name":"טוקיו","from":"2027-04-01","to":"2027-04-02"},{"name":"קיוטו","from":"2027-04-03","to":"2027-04-05"}]}]}' where id='${trip}'`);
r = await as(A, `update public.trips set start_date='2027-04-01', end_date='2027-04-04', archived_at=null where id='${trip}' returning id`);
check("set trip dates", r.rows?.length === 1, r.error ?? "");
check("days created from dates", (await val(A, `select count(*)::int from public.trip_days where trip_id='${trip}'`)) === 4);
check("day city from profile", (await val(A, `select city from public.trip_days where trip_id='${trip}' and date='2027-04-03'`)) === "קיוטו");
const day4 = await val(A, `select id from public.trip_days where trip_id='${trip}' and date='2027-04-04'`);
const day1 = await val(A, `select id from public.trip_days where trip_id='${trip}' and date='2027-04-01'`);

const pl = (await one(A, `insert into public.places (trip_id,name,category,city,position) values ('${trip}','פושימי אינארי','attraction','קיוטו','a0') returning id`)).id;
check("editor adds place", !!pl);
r = await as(D, `update public.places set status='visited', rating=5 where id='${pl}' returning id`); check("viewer marks visited + rates", r.rows?.length === 1, r.error ?? "");
r = await as(D, `update public.places set name='x' where id='${pl}'`); check("viewer can't rename place", !!r.error);
check("visit logged", (await val(A, `select count(*)::int from public.activity where type='place.visited' and entity_id='${pl}'`)) === 1);
r = await as(A, `insert into public.places (trip_id,name,lat,position) values ('${trip}','x',35.0,'a1')`); check("lat without lng rejected", !!r.error);

const st4 = (await one(A, `insert into public.stops (trip_id,day_id,place_id,position) values ('${trip}','${day4}','${pl}','a0') returning id`)).id;
check("stop on day 4", !!st4);
r = await as(A, `insert into public.stops (trip_id,day_id,position) values ('${trip}','${day1}','a1')`); check("stop needs place or text", !!r.error);
r = await as(D, `insert into public.stops (trip_id,day_id,free_text,position) values ('${trip}','${day1}','x','a1')`); check("viewer can't add stops", !!r.error);

await as(A, `update public.trips set end_date='2027-04-03' where id='${trip}'`);
check("shrinking dates removes the day", (await val(A, `select count(*)::int from public.trip_days where trip_id='${trip}'`)) === 3);
check("its stop moves to unscheduled", (await val(A, `select day_id from public.stops where id='${st4}'`)) === null);
check("unscheduled stop not deleted", (await val(A, `select deleted_at from public.stops where id='${st4}'`)) === null);

r = await as(A, `update public.trip_days set title='יום מקדשים' where id='${day1}' returning id`); check("editor titles a day", r.rows?.length === 1);
r = await as(A, `update public.trip_days set date='2030-01-01' where id='${day1}'`); check("day date can't be edited", !!r.error);
r = await as(D, `update public.trip_days set title='x' where id='${day1}' returning id`); check("viewer can't edit days", (r.rows?.length ?? 0) === 0 || !!r.error);
r = await as(A, `update public.trip_days set plan_b='גשם: מוזיאון' where id='${day1}' returning id`); check("editor writes a day's plan B", r.rows?.length === 1);
r = await as(A, `update public.trip_days set plan_b=repeat('x', 1001) where id='${day1}'`); check("plan B has a length cap", !!r.error);

r = await one(A, `insert into public.bookings (trip_id,kind,title,starts_at,starts_tz,ends_at,ends_tz,confirmation_code) values ('${trip}','flight','TLV → KIX','2027-03-31T20:00:00Z','Asia/Jerusalem','2027-04-01T13:00:00Z','Asia/Tokyo','AB12CD') returning id`);
check("editor adds booking", !!r?.id, JSON.stringify(r));
r = await as(A, `insert into public.bookings (trip_id,title,starts_at,ends_at) values ('${trip}','x','2027-04-02T00:00:00Z','2027-04-01T00:00:00Z')`); check("booking end before start rejected", !!r.error);
r = await as(D, `insert into public.bookings (trip_id,title) values ('${trip}','x')`); check("viewer can't add bookings", !!r.error);
check("booking logged", (await val(A, `select count(*)::int from public.activity where type='booking.created' and trip_id='${trip}'`)) === 1);

r = await one(A, `select public.commit_import('${trip}','places','[{"name":"ניסקי","category":"food","city":"קיוטו","position":"a2"},{"name":"קינקאקו-ג׳י","position":"a3","priority":"must"}]'::jsonb,'raw','p02-places',1) as n`);
check("import places", r?.n === 2, JSON.stringify(r));
check("imported places await pin", (await val(A, `select count(*)::int from public.places where trip_id='${trip}' and geocode_status='pending' and source='ai'`)) === 2);
const newPlace = "66666666-6666-6666-6666-666666666666";
const oldStop = (await one(A, `insert into public.stops (trip_id,day_id,free_text,position) values ('${trip}','${day1}','ארוחת בוקר','a0') returning id`)).id;
r = await one(A, `select public.commit_import('${trip}','itinerary','{"places":[{"id":"${newPlace}","name":"ארשיאמה","position":"a4"}],"stops":[{"day_id":"${day1}","place_id":"${newPlace}","time_of_day":"morning","duration_min":120,"position":"a0"},{"day_id":"${day1}","free_text":"ארוחת ערב בגיון","time_of_day":"evening","position":"a1"}],"replace_day_ids":["${day1}"]}'::jsonb,'raw','p07-review',1) as n`);
check("import itinerary (1 place + 2 stops)", r?.n === 3, JSON.stringify(r));
check("replaced day's old stop soft-deleted", (await val(A, `select deleted_at is not null from public.stops where id='${oldStop}'`)) === true);
check("new stop points at new place", (await val(A, `select count(*)::int from public.stops where place_id='${newPlace}' and day_id='${day1}'`)) === 1);
r = await as(D, `select public.commit_import('${trip}','places','[{"name":"x","position":"a9"}]'::jsonb,'raw')`); check("viewer can't import places", !!r.error);
// Undo the last paste: new stops and places go to the trash, the replaced stop comes back.
{
  const imp = await val(A, `select id from public.ai_imports where trip_id='${trip}' and kind='itinerary' order by created_at desc limit 1`);
  r = await as(D, `select public.undo_import('${imp}')`); check("viewer can't undo", !!r.error);
  r = await as(C, `select public.undo_import('${imp}')`); check("stranger can't undo", !!r.error);
  check("undo itinerary moves 3 rows to trash", (await val(A, `select public.undo_import('${imp}')`)) === 3);
  check("undo brings back the replaced stop", (await val(A, `select deleted_at is null from public.stops where id='${oldStop}'`)) === true);
  check("undo trashes the new place", (await val(A, `select deleted_at is not null from public.places where id='${newPlace}'`)) === true);
  r = await as(A, `select public.undo_import('${imp}')`); check("can't undo twice", !!r.error);
  // Put it back for the checks below.
  await db.exec(`reset role; update public.stops set deleted_at=null where ai_import_id='${imp}'; update public.places set deleted_at=null where id='${newPlace}'; update public.stops set deleted_at=now() where id='${oldStop}'`);
}

r = await as(C, `insert into public.geocode_cache (query_key,results,provider) values ('kyoto|japan','[]','nominatim') returning query_key`); check("signed-in user caches geocode", r.rows?.length === 1, r.error ?? "");
check("cache readable by signed-in", (await as(D, `select 1 from public.geocode_cache where query_key='kyoto|japan'`)).rows?.length === 1);
await db.exec(`reset role; set role anon;`);
let anonRead; try { anonRead = (await db.query(`select 1 from public.geocode_cache`)).rows.length; } catch { anonRead = 0; }
await db.exec(`reset role;`);
check("anon can't read geocode cache", anonRead === 0);

// Regression: days created before the profile has cities get them when the profile is saved.
const t2 = (await one(A, `select id from public.create_trip('Later cities', '#B8322A', '2027-05-01', '2027-05-02')`)).id;
check("new trip days have no city yet", (await val(A, `select count(*)::int from public.trip_days where trip_id='${t2}' and city is null`)) === 2);
await one(A, `select public.patch_trip_profile('${t2}', '{"destinations":[{"country":"יפן","cities":[{"name":"אוסקה","from":"2027-05-01","to":"2027-05-02"}]}]}')`);
check("profile save fills day cities", (await val(A, `select count(*)::int from public.trip_days where trip_id='${t2}' and city='אוסקה'`)) === 2);
await as(A, `update public.trip_days set city='נארה' where trip_id='${t2}' and date='2027-05-02'`);
await one(A, `select public.patch_trip_profile('${t2}', '{"style":{"pace":"relaxed"}}')`);
check("hand-set city is kept", (await val(A, `select city from public.trip_days where trip_id='${t2}' and date='2027-05-02'`)) === "נארה");

// Phase 11: a city that appears twice must not swallow the stays between (narrowest range wins).
const t3 = (await one(A, `select id from public.create_trip('Twice', '#B8322A', '2027-07-01', '2027-07-04')`)).id;
await one(A, `select public.patch_trip_profile('${t3}', '{"destinations":[{"country":"יפן","cities":[{"name":"טוקיו","from":"2027-07-01","to":"2027-07-04"},{"name":"קיוטו","from":"2027-07-02","to":"2027-07-03"}]}]}')`);
check("short stay wins over an overlapping long range", (await val(A, `select string_agg(city, ',' order by date) from public.trip_days where trip_id='${t3}'`)) === "טוקיו,קיוטו,קיוטו,טוקיו");

// ---------------------------------------------------------------- phase 2b (notifications)
const su = async (sql) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); return (await db.query(sql)).rows; };
// Phase 11 repair: a day whose city disagrees with most of its own stops gets their city back.
{
  const d2 = await val(A, `select id from public.trip_days where trip_id='${t3}' and date='2027-07-02'`);
  await as(A, `update public.trip_days set city='טוקיו' where id='${d2}'`);
  for (const [i, n] of ["Kinkaku-ji", "Ryoan-ji", "Nishiki"].entries()) {
    const pid = await val(A, `insert into public.places (trip_id, name, city, position) values ('${t3}', '${n}', 'קיוטו', 'p${i}') returning id`);
    await as(A, `insert into public.stops (trip_id, day_id, place_id, position) values ('${t3}', '${d2}', '${pid}', 's${i}')`);
  }
  const fixedN = (await su(`select public.repair_day_cities_from_stops() as n`))[0].n;
  check("repair restores the day's city from its stops", fixedN >= 1 && (await val(A, `select city from public.trip_days where id='${d2}'`)) === "קיוטו", String(fixedN));
  check("users can't run the repair", !!(await as(A, `select public.repair_day_cities_from_stops()`)).error);
  // Second pass: a city none of the day's stops are in is cleared (then refilled from the narrowest profile range).
  await as(A, `update public.trip_days set city='טוקיו' where id='${d2}'`);
  await as(A, `update public.places set city=case when name='Nishiki' then 'נארה' else city end where trip_id='${t3}'`);
  await as(A, `update public.places set city='אוסקה' where trip_id='${t3}' and name='Kinkaku-ji'`);
  await su(`select public.repair_day_cities_unmatched()`);
  check("second pass clears a city the day's stops aren't in, then refills from the profile", (await val(A, `select city from public.trip_days where id='${d2}'`)) === "קיוטו");
}
const sub = (u, n) => as(u, `select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/${n}', 'p256', 'auth', 'UTC', 'test')`);
await sub(A, "a"); await sub(B, "b"); await sub(D, "d");
check("user sees own subscription only", (await as(A, `select endpoint from public.push_subscriptions`)).rows?.length === 1);
r = await as(A, `insert into public.push_subscriptions (user_id,endpoint,p256dh,auth) values ('${A}','https://fcm.googleapis.com/fcm/send/x','p','a')`);
check("no direct subscription insert", !!r.error);
r = await as(A, `select * from public.notification_queue`); check("queue hidden from app", !!r.error || r.rows.length === 0);
// No quiet hours for these checks.
for (const u of [A, B, D]) await as(u, `insert into public.notification_settings (quiet_enabled) values (false)`);

const qcount = async (u, kind) => (await su(`select count(*)::int n from public.notification_queue where user_id='${u}' and kind='${kind}' and sent_at is null`))[0].n;
await as(B, `insert into public.tasks (trip_id,title,assignee_traveler_id,position) values ('${trip}','להזמין רכבת','${tA}','b0')`);
check("assignee gets 'assigned'", (await qcount(A, "assigned")) === 1);
check("actor doesn't get own event", (await qcount(B, "assigned")) === 0);
const kA = (await one(A, `insert into public.tasks (trip_id,title,position) values ('${trip}','לקנות מתאם','b1') returning id`)).id;
await as(B, `update public.tasks set done=true where id='${kA}'`);
check("creator gets 'done'", (await qcount(A, "done")) === 1);
await as(B, `update public.trip_members set notification_prefs = notification_prefs || '{"muted":true}' where trip_id='${trip}' and user_id='${B}'`);
await as(A, `update public.notification_settings set kinds='{"import":false}' where user_id='${A}'`);
await one(A, `select public.commit_import('${trip}','tasks','[{"title":"x1","position":"c0"},{"title":"x2","position":"c1"}]'::jsonb,'raw')`);
check("import notifies members", (await qcount(D, "import")) === 1);
check("muted trip gets nothing", (await qcount(B, "import")) === 0);
check("kind turned off gets nothing", (await qcount(A, "import")) === 0);
check("no notification without a device", (await su(`select count(*)::int n from public.notification_queue where user_id='${E}'`))[0].n === 0);

r = await as(A, `select public.claim_push_batch('wrong')`); check("app can't claim", !!r.error);
await db.exec(`reset role;`);
let wrong; try { await db.query(`select public.claim_push_batch('wrong')`); wrong = false; } catch { wrong = true; }
check("claim needs the secret", wrong);
const secret = (await su(`select value from private.config where key='push_secret'`))[0].value;
let batch = (await su(`select public.claim_push_batch('${secret}') b`))[0].b;
check("burst held for coalescing", batch.length === 0, JSON.stringify(batch));
await su(`update public.notification_queue set created_at = now() - interval '2 minutes', send_after = now() - interval '1 minute'`);
await as(A, `update public.notification_settings set quiet_enabled=true, quiet_start='00:00', quiet_end='23:59' where user_id='${A}'`);
batch = (await su(`select public.claim_push_batch('${secret}') b`))[0].b;
check("claim returns D's import", batch.some((m) => m.body.includes("נוספו 2 משימות") && m.subscriptions[0]?.endpoint === "https://fcm.googleapis.com/fcm/send/d"), JSON.stringify(batch));
check("quiet hours hold A's rows", !batch.some((m) => m.subscriptions[0]?.endpoint === "https://fcm.googleapis.com/fcm/send/a"));
check("A's two events wait together", (await su(`select count(*)::int n from public.notification_queue where user_id='${A}' and sent_at is null`))[0].n === 2);
await as(A, `update public.notification_settings set quiet_enabled=false where user_id='${A}'`);
batch = (await su(`select public.claim_push_batch('${secret}') b`))[0].b;
const forA = batch.find((m) => m.subscriptions[0]?.endpoint === "https://fcm.googleapis.com/fcm/send/a");
check("A's events coalesced into one message", forA?.body.startsWith("2 עדכונים") && forA.url.endsWith("/activity"), JSON.stringify(batch));
check("nothing left to claim", (await su(`select public.claim_push_batch('${secret}') b`))[0].b.length === 0);

await su(`insert into public.bookings (trip_id,kind,title,starts_at,starts_tz) values ('${trip}','flight','TLV → NRT', now() + interval '3 hours' - interval '1 minute','Asia/Jerusalem')`);
await su(`delete from public.notification_queue`);
await su(`select public.push_tick()`); await su(`select public.push_tick()`);
check("flight 3h reminder, once per member (B muted, E no device)", (await su(`select count(*)::int n from public.notification_queue where kind='bookings' and urgent`))[0].n === 2);
await sub(B, "a");
check("shared device moves to new user", (await as(A, `select 1 from public.push_subscriptions`)).rows?.length === 0 && (await as(B, `select 1 from public.push_subscriptions`)).rows?.length === 2);
await su(`select public.push_report('${secret}', array['https://fcm.googleapis.com/fcm/send/a'])`);
check("gone endpoint removed", (await as(B, `select 1 from public.push_subscriptions`)).rows?.length === 1);
check("test notification", (await val(D, `select public.send_test_notification()`)) === true);

r = await as(A, `select public.save_push_subscription('https://evil.example/x', 'p', 'a')`); check("only real push services accepted", !!r.error);
for (let i = 0; i < 7; i++) await sub(E, `e${i}`);
check("at most 5 devices per user", (await as(E, `select 1 from public.push_subscriptions`)).rows?.length === 5);
await val(D, `select public.send_test_notification()`);
check("one pending test at a time", (await su(`select count(*)::int n from public.notification_queue where user_id='${D}' and kind='test'`))[0].n === 1);

// ---------------------------------------------------------------- phase 3a
const pu = (await one(A, `insert into public.purchases (trip_id,title,for_whom,budget,position) values ('${trip}','KitKat matcha','Noa','20 ILS','a0') returning id`)).id;
check("editor adds purchase", !!pu);
r = await as(D, `update public.purchases set bought=true where id='${pu}' returning bought_by`); check("viewer marks bought (server sets who)", r.rows?.[0]?.bought_by === D, JSON.stringify(r));
r = await as(D, `update public.purchases set title='x' where id='${pu}'`); check("viewer can't edit purchase", !!r.error);
r = await as(A, `update public.purchases set bought_by='${B}' where id='${pu}' returning bought_by`); check("bought_by can't be forged", r.rows?.[0]?.bought_by === D, JSON.stringify(r));
check("bought logged", (await val(A, `select count(*)::int from public.activity where type='purchase.bought' and entity_id='${pu}'`)) === 1);
r = await as(C, `select 1 from public.purchases where trip_id='${trip}'`); check("stranger can't read purchases", r.rows?.length === 0);
r = await as(D, `insert into public.trip_notes (trip_id,title,position) values ('${trip}','x','a0')`); check("viewer can't add notes", !!r.error);
r = await one(A, `select public.commit_import('${trip}','notes','[{"kind":"phrase","title":"Thank you","body":"arigato","position":"a0"},{"title":"Emergency","kind":"emergency","position":"a1"}]'::jsonb,'raw','p06-notes',1) as n`);
check("import notes", r?.n === 2, JSON.stringify(r));
r = await one(A, `select public.commit_import('${trip}','purchases','[{"title":"Sake","for_whom":"Grandpa","budget":"3000 JPY","position":"a1"}]'::jsonb,'raw','p05-gifts',1) as n`);
check("import purchases", r?.n === 1, JSON.stringify(r));
r = await one(A, `select public.commit_import('${trip}','places','[{"name":"From my map","lat":"35.01","lng":"135.77","position":"a9"}]'::jsonb,'kml','kml',0,'google','Google My Maps') as n`);
check("kml places import", r?.n === 1, JSON.stringify(r));
check("kml place pinned & confirmed", (await val(A, `select geocode_status::text from public.places where name='From my map' and source='google' and lat=35.01`)) === "confirmed");
// phase 7a: Google Maps list import keeps the link to the exact place; bad links are dropped.
r = await one(A, `select public.commit_import('${trip}','places','[{"name":"From my list","lat":"35.66","lng":"139.7","maps_url":"https://maps.google.com/?cid=123","position":"b1"},{"name":"Bad link","lat":"35.6","lng":"139.6","maps_url":"javascript:alert(1)","position":"b2"}]'::jsonb,'link','gmaps-list',0,'google','Google Maps') as n`);
check("gmaps list import", r?.n === 2, JSON.stringify(r));
check("gmaps list keeps maps_url", (await val(A, `select maps_url from public.places where name='From my list'`)) === "https://maps.google.com/?cid=123");
check("gmaps list drops a non-https link", (await val(A, `select coalesce(maps_url,'none') from public.places where name='Bad link'`)) === "none");

// ---------------------------------------------------------------- phase 4a
const je = (await one(D, `insert into public.journal_entries (trip_id,body,rating,position) values ('${trip}','Great ramen',5,'a0') returning id`))?.id;
check("viewer writes a journal entry", !!je);
r = await as(D, `insert into public.journal_entries (trip_id,body,position,created_by) values ('${trip}','forged','a1','${A}')`); check("journal author can't be forged", !!r.error);
r = await as(C, `insert into public.journal_entries (trip_id,body,position) values ('${trip}','x','a1')`); check("stranger can't write journal", !!r.error);
check("stranger can't read journal", (await as(C, `select 1 from public.journal_entries where trip_id='${trip}'`)).rows?.length === 0);
const jeA = (await one(A, `insert into public.journal_entries (trip_id,body,position) values ('${trip}','Owner note','a1') returning id`))?.id;
r = await as(D, `update public.journal_entries set body='x' where id='${jeA}'`); check("viewer can't edit others' entry", !!r.error);
r = await as(D, `update public.journal_entries set body='Best ramen' where id='${je}' returning body`); check("viewer edits own entry", r.rows?.[0]?.body === "Best ramen", JSON.stringify(r));
r = await as(B, `update public.journal_entries set rating=4 where id='${je}' returning rating`); check("editor edits any entry", r.rows?.[0]?.rating === 4, JSON.stringify(r));
check("journal logged", (await val(A, `select count(*)::int from public.activity where type='journal.created'`)) === 2);

const tpl = await val(B, `select public.save_trip_as_template('${trip}', 'My template')`);
check("member saves trip as template", typeof tpl === "string", JSON.stringify(tpl));
check("template has the trip's tasks", (await val(B, `select jsonb_array_length(payload->'tasks') from public.templates where id='${tpl}'`)) === (await val(A, `select count(*)::int from public.tasks where trip_id='${trip}' and deleted_at is null`)));
check("others can't see my template", (await as(A, `select 1 from public.templates where id='${tpl}'`)).rows?.length === 0);
r = await as(C, `select public.save_trip_as_template('${trip}', 'x')`); check("stranger can't template a trip", !!r.error);
r = await as(A, `select payload::text p from public.templates`); check("no confirmation codes in templates", !(r.rows ?? []).some((x) => /AB12CD/.test(x.p)));

const payload = JSON.stringify(await val(B, `select payload from public.templates where id='${tpl}'`)).replace(/'/g, "''");
const nt = await one(C, `select * from public.create_trip_from_template('From tpl', '#B8322A', '2027-01-01', '2027-01-03', '${payload}'::jsonb)`);
check("create trip from template", !!nt?.id, JSON.stringify(nt));
check("template tasks reset", (await val(C, `select count(*)::int from public.tasks where trip_id='${nt.id}' and (done or assignee_traveler_id is not null or due_at is not null)`)) === 0);
check("template tasks copied", (await val(C, `select count(*)::int from public.tasks where trip_id='${nt.id}' and source='template'`)) > 0);
check("template packing all 'need'", (await val(C, `select count(*)::int from public.packing_items where trip_id='${nt.id}' and state<>'need'`)) === 0);
check("no notifications from template import", (await su(`select count(*)::int n from public.activity where trip_id='${nt.id}' and type like 'task.%'`))[0].n === 0);
r = await as(C, `select * from public.create_trip_from_template('Big', '#B8322A', null, null, jsonb_build_object('tasks', (select jsonb_agg(jsonb_build_object('title','t','position','a0')) from generate_series(1,600))))`);
check("oversized template refused", !!r.error);

const dup = await one(D, `select * from public.duplicate_trip('${trip}', 'Japan again', '2028-04-01', '2028-04-05')`);
check("member duplicates trip", !!dup?.id, JSON.stringify(dup));
check("duplicate: only caller is member", (await su(`select count(*)::int n from public.trip_members where trip_id='${dup.id}'`))[0].n === 1);
check("duplicate: caller is owner", (await val(D, `select public.my_trip_role('${dup.id}')::text`)) === "owner");
check("duplicate: no bookings", (await su(`select count(*)::int n from public.bookings where trip_id='${dup.id}'`))[0].n === 0);
check("duplicate: no stops / journal / purchases", (await su(`select (select count(*) from public.stops where trip_id='${dup.id}') + (select count(*) from public.journal_entries where trip_id='${dup.id}') + (select count(*) from public.purchases where trip_id='${dup.id}') as n`))[0].n == 0);
check("duplicate: travelers copied, only caller linked", (await su(`select count(*)::int n from public.travelers where trip_id='${dup.id}' and linked_user_id is not null and linked_user_id<>'${D}'`))[0].n === 0
  && (await su(`select count(*)::int n from public.travelers where trip_id='${dup.id}'`))[0].n === (await su(`select count(*)::int n from public.travelers where trip_id='${trip}' and deleted_at is null`))[0].n);
check("duplicate: places reset to want", (await su(`select count(*)::int n from public.places where trip_id='${dup.id}' and (status<>'want' or rating is not null)`))[0].n === 0
  && (await su(`select count(*)::int n from public.places where trip_id='${dup.id}'`))[0].n > 0);
check("duplicate: packing travelers remapped", (await su(`select count(*)::int n from public.packing_items p where p.trip_id='${dup.id}' and p.traveler_id is not null and not exists (select 1 from public.travelers t where t.id=p.traveler_id and t.trip_id='${dup.id}')`))[0].n === 0);
check("duplicate: days for new dates", (await su(`select count(*)::int n from public.trip_days where trip_id='${dup.id}'`))[0].n === 5);
r = await as(C, `select * from public.duplicate_trip('${trip}', 'steal')`); check("stranger can't duplicate", !!r.error);

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
