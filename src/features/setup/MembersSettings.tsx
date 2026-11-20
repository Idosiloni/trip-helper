"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/app/Avatar";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import { useAsync } from "@/lib/use-async";
import { copyText } from "../prompts/clipboard";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Member, Role } from "../trip-data/types";

type Invite = { id: string; token: string; role: Role; expires_at: string; use_count: number; revoked_at: string | null };

const inviteUrl = (token: string) => `${window.location.origin}/join/${token}`;

export function MembersSettings() {
  const t = useTranslations("members");
  const tc = useTranslations("common");
  const data = useTripData();
  const store = useTripStore();
  const router = useRouter();
  const canEdit = useCanEdit();
  const trip = data.trip!;
  const isOwner = data.me.role === "owner";
  const [newRole, setNewRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const invites = useAsync(async () => {
    if (!canEdit) return [] as Invite[];
    const { data: rows, error } = await supabase()
      .from("invites")
      .select("id, token, role, expires_at, use_count, revoked_at")
      .eq("trip_id", trip.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows as Invite[];
  }, `invites:${trip.id}:${canEdit}`);

  async function createInvite() {
    setBusy(true);
    const { data: row, error } = await supabase().from("invites").insert({ trip_id: trip.id, role: newRole }).select("token").single();
    setBusy(false);
    if (error || !row) return showToast({ message: tc("errorGeneric") });
    invites.reload();
    await share(row.token);
  }

  async function share(token: string) {
    const url = inviteUrl(token);
    const text = t("shareText", { trip: trip.name });
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name, text, url });
        return;
      } catch {
        /* cancelled: fall back to copy */
      }
    }
    if (await copyText(`${text}\n${url}`)) showToast({ message: t("linkCopied") });
  }

  async function revoke(id: string) {
    const { error } = await supabase().from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) return showToast({ message: tc("errorGeneric") });
    invites.reload();
  }

  async function setRole(m: Member, role: Role) {
    const { error } = await supabase().from("trip_members").update({ role }).eq("trip_id", trip.id).eq("user_id", m.user_id);
    if (error) showToast({ message: error.message.includes("owner") ? t("lastOwner") : tc("errorGeneric") });
    else void store.load();
  }

  async function removeMember(m: Member, self: boolean) {
    if (!window.confirm(self ? t("leaveConfirm", { trip: trip.name }) : t("removeConfirm", { name: m.profile?.display_name ?? "" }))) return;
    const { error } = await supabase().from("trip_members").delete().eq("trip_id", trip.id).eq("user_id", m.user_id);
    if (error) return showToast({ message: error.message.includes("owner") ? t("lastOwner") : tc("errorGeneric") });
    if (self) router.replace("/trips");
    else void store.load();
  }

  const base = `/trips/${trip.id}`;
  const roleOptions = (["owner", "editor", "viewer"] as const).map((r) => ({ value: r, label: t(`roles.${r}`) }));

  return (
    <div className="flex flex-col gap-6">
      <SubHeader title={t("title")} backHref={`${base}/settings`} backLabel={tc("back")} />

      <section className="flex flex-col">
        <ul className="flex flex-col border-t-2 border-ink">
          {data.members.map((m) => {
            const self = m.user_id === data.me.userId;
            return (
              <li key={m.user_id} className="flex flex-col gap-2 border-b border-hair py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={m.profile?.display_name ?? "?"} color={m.profile?.avatar_color ?? "#6e695f"} />
                  <span className="flex flex-1 flex-col">
                    <span className="text-lg font-bold">
                      {m.profile?.display_name || t("noName")} {self ? <span className="text-sm font-normal text-ink-2">({t("you")})</span> : null}
                    </span>
                    {!isOwner || self ? <span className="text-sm text-ink-2">{t(`roles.${m.role}`)}</span> : null}
                  </span>
                  {self ? (
                    <button type="button" onClick={() => removeMember(m, true)} className="min-h-11 px-2 text-sm font-bold text-danger underline underline-offset-4">
                      {t("leave")}
                    </button>
                  ) : isOwner ? (
                    <button type="button" aria-label={t("remove", { name: m.profile?.display_name ?? "" })} onClick={() => removeMember(m, false)} className="grid size-11 place-items-center">
                      <Icon name="trash" size={20} />
                    </button>
                  ) : null}
                </div>
                {isOwner && !self ? <Select label={t("role")} value={m.role} options={roleOptions} onChange={(e) => setRole(m, e.target.value as Role)} /> : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm text-ink-2">{t("rolesHelp")}</p>
      </section>

      {canEdit ? (
        <section className="flex flex-col gap-3 border-t-2 border-ink pt-4">
          <h3 className="text-lg font-extrabold">{t("invite")}</h3>
          <p className="text-ink-2">{t("inviteIntro")}</p>
          <Select
            label={t("inviteAs")}
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "editor" | "viewer")}
            options={[
              { value: "editor", label: t("roles.editor") },
              { value: "viewer", label: t("roles.viewer") },
            ]}
          />
          <Button size="lg" loading={busy} onClick={createInvite} icon={<Icon name="share" strokeWidth={2.4} />}>
            {t("createLink")}
          </Button>
          {invites.status === "ready" && invites.data.length ? (
            <ul className="flex flex-col gap-2">
              {invites.data.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2 border-2 border-ink bg-surface px-3 py-2">
                  <span className="flex flex-1 flex-col text-sm">
                    <span className="font-bold">{t("linkFor", { role: t(`roles.${inv.role}`) })}</span>
                    <span className="text-ink-2">{t("linkMeta", { uses: inv.use_count, date: new Date(inv.expires_at).toLocaleDateString("he-IL") })}</span>
                  </span>
                  <button type="button" onClick={() => share(inv.token)} aria-label={t("shareLink")} className="grid size-11 place-items-center">
                    <Icon name="share" size={20} />
                  </button>
                  <button type="button" onClick={() => revoke(inv.id)} className="min-h-11 px-2 text-sm font-bold underline underline-offset-4">
                    {t("revoke")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
