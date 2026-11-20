import type { PromptContext } from "../context";

const TOD: Record<string, string> = { morning: "בוקר", noon: "צהריים", evening: "ערב" };

/** The current plan as plain text for prompts 1, 7 and 9. */
export function describePlan(ctx: PromptContext, opts: { onlyDates?: string[] } = {}): string {
  const plan = ctx.plan;
  if (!plan || plan.days.length === 0) return "עוד אין ימים במסלול.";
  return plan.days
    .filter((d) => !opts.onlyDates || opts.onlyDates.includes(d.date))
    .map((d) => {
      const head = `${d.date}${d.city ? ` · ${d.city}` : ""}${d.title ? ` · ${d.title}` : ""}${d.lodgingArea ? ` · לינה סגורה באזור ${d.lodgingArea}` : d.lodgingSet ? " · לינה סגורה" : ""}${d.weather ? ` · מזג אוויר: ${d.weather}` : ""}`;
      const stops = d.stops.length
        ? d.stops
            .map((s) => `  - ${s.start ?? (s.timeOfDay ? TOD[s.timeOfDay] : "")}${s.start || s.timeOfDay ? ": " : ""}${s.label}${s.minutes ? ` (${s.minutes} דק׳)` : ""}`)
            .join("\n")
        : "  (אין עצירות)";
      return `${head}\n${stops}`;
    })
    .join("\n");
}

export function describeBookings(ctx: PromptContext): string | null {
  const b = ctx.plan?.bookings ?? [];
  if (!b.length) return null;
  return b.map((x) => `- ${x.title}${x.local ? ` (${x.local})` : ""}`).join("\n");
}

export function describeWantedPlaces(ctx: PromptContext, city?: string): string | null {
  const list = (ctx.plan?.places ?? []).filter((p) => p.status === "want" && (!city || p.city === city));
  if (!list.length) return null;
  return list.map((p) => `- ${p.name}${p.city ? ` (${p.city}${p.area ? `, ${p.area}` : ""})` : ""}${p.priority === "must" ? " · חובה" : ""}`).join("\n");
}
