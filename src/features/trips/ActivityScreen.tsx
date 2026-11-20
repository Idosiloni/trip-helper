"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/app/Avatar";
import { SubHeader } from "@/components/app/SubHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTripData } from "../trip-data/TripDataProvider";
import type { Activity } from "../trip-data/types";

const KNOWN = ["task.created", "task.done", "task.deleted", "task.restored", "import.committed", "member.joined", "bag.packed", "packing.deleted", "place.created", "place.visited", "place.deleted", "booking.created", "purchase.bought", "purchase.deleted", "note.created", "note.deleted", "journal.created", "journal.deleted", "trip.duplicated", "trip.from_template"] as const;
type Known = (typeof KNOWN)[number];

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

/** Activity feed (SPEC §11): "אמא הוסיפה 12 פריטים לרשימת הציוד מ-ChatGPT". */
export function ActivityScreen() {
  const t = useTranslations("activity");
  const tc = useTranslations("common");
  const snap = useTripData();
  const base = `/trips/${snap.trip!.id}`;
  const profileOf = (id: string | null) => snap.members.find((m) => m.user_id === id)?.profile;

  function describe(a: Activity): string {
    const p = (a.payload ?? {}) as Record<string, unknown>;
    if (!(KNOWN as readonly string[]).includes(a.type)) return t("other");
    const type = a.type as Known;
    if (type === "import.committed") {
      const via = typeof p.via === "string" && p.via ? p.via : null;
      const KIND: Record<string, string> = { packing: "Packing", places: "Places", itinerary: "Itinerary", purchases: "Purchases", notes: "Notes" };
      const kind = KIND[String(p.kind)] ?? "Tasks";
      const key = `import${kind}${via ? "Via" : ""}` as "importTasks";
      return t(key, { n: Number(p.count ?? 0), via: via ?? "", stops: Number(p.stops ?? 0), places: Number(p.places ?? 0) });
    }
    return t(type.replace(".", "_") as "task_created", { title: String(p.title ?? p.label ?? p.from ?? "") });
  }

  const groups: { day: string; items: Activity[] }[] = [];
  for (const a of snap.activity) {
    const d = dayKey(a.created_at);
    const last = groups.at(-1);
    if (last?.day === d) last.items.push(a);
    else groups.push({ day: d, items: [a] });
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader title={t("title")} backHref={`${base}/today`} backLabel={tc("back")} />
      {groups.length === 0 ? (
        <EmptyState icon="activity" title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        groups.map((g) => (
          <section key={g.day} className="flex flex-col">
            <h3 className="border-b-2 border-ink pb-1 text-sm font-extrabold">{g.day}</h3>
            <ul>
              {g.items.map((a) => {
                const who = profileOf(a.actor_id);
                return (
                  <li key={a.id} className="flex items-start gap-3 border-b border-hair py-3">
                    <Avatar name={who?.display_name ?? "?"} color={who?.avatar_color ?? "#6e695f"} size={34} />
                    <p className="flex-1 text-[15px]">
                      <span className="font-extrabold">{who?.display_name || t("someone")}</span> {describe(a)}
                    </p>
                    <time dateTime={a.created_at} className="text-xs tabular-nums text-ink-2">
                      {new Date(a.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
