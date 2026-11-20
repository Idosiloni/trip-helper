import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, deleteUsers, hasRlsEnv, makeUser } from "./helpers";

type U = Awaited<ReturnType<typeof makeUser>>;

describe.skipIf(!hasRlsEnv)("RLS: trips, trip_members, profiles", () => {
  let owner: U;
  let editor: U;
  let stranger: U;
  let tripId: string;

  beforeAll(async () => {
    [owner, editor, stranger] = await Promise.all([makeUser("owner"), makeUser("editor"), makeUser("stranger")]);
    const { data, error } = await owner.db.rpc("create_trip", { p_name: "RLS test trip" });
    if (error) throw error;
    tripId = data.id;
    // Phase 1 replaces this with accept_invite(); members can't self-insert.
    const { error: addError } = await admin().from("trip_members").insert({ trip_id: tripId, user_id: editor.id, role: "editor" } as never);
    if (addError) throw addError;
  }, 30_000);

  afterAll(async () => {
    if (tripId) await admin().from("trips").delete().eq("id", tripId);
    await deleteUsers([owner, editor, stranger].filter(Boolean).map((u) => u.id));
  });

  it("create_trip makes the caller the owner", async () => {
    const { data } = await owner.db.rpc("my_trip_role", { p_trip_id: tripId });
    expect(data).toBe("owner");
  });

  it("members can read the trip; strangers can't, even by id", async () => {
    expect((await owner.db.from("trips").select("id").eq("id", tripId)).data).toHaveLength(1);
    expect((await editor.db.from("trips").select("id").eq("id", tripId)).data).toHaveLength(1);
    expect((await stranger.db.from("trips").select("id").eq("id", tripId)).data).toHaveLength(0);
    expect((await stranger.db.from("trip_members").select("user_id").eq("trip_id", tripId)).data).toHaveLength(0);
  });

  it("strangers can't update the trip", async () => {
    const { data } = await stranger.db.from("trips").update({ name: "hacked" }).eq("id", tripId).select("id");
    expect(data).toHaveLength(0);
  });

  it("editors can update fields but can't archive or delete", async () => {
    const ok = await editor.db.from("trips").update({ name: "Renamed" }).eq("id", tripId).select("name");
    expect(ok.data?.[0]?.name).toBe("Renamed");
    const archive = await editor.db.from("trips").update({ archived_at: new Date().toISOString() }).eq("id", tripId);
    expect(archive.error).not.toBeNull();
  });

  it("users can't add themselves to a trip", async () => {
    const { error } = await stranger.db
      .from("trip_members")
      .insert({ trip_id: tripId, user_id: stranger.id, role: "owner" } as never);
    expect(error).not.toBeNull();
  });

  it("a non-owner can't promote themselves", async () => {
    const { error } = await editor.db.from("trip_members").update({ role: "owner" }).eq("trip_id", tripId).eq("user_id", editor.id);
    expect(error).not.toBeNull();
  });

  it("the last owner can't leave", async () => {
    const { error } = await owner.db.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", owner.id);
    expect(error).not.toBeNull();
  });

  it("fellow members see each other's profiles; strangers don't", async () => {
    expect((await editor.db.from("profiles").select("id").eq("id", owner.id)).data).toHaveLength(1);
    expect((await stranger.db.from("profiles").select("id").eq("id", owner.id)).data).toHaveLength(0);
  });

  it("users can't edit someone else's profile", async () => {
    const { data } = await editor.db.from("profiles").update({ display_name: "x" }).eq("id", owner.id).select("id");
    expect(data).toHaveLength(0);
  });
});
