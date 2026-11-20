import { describe, expect, it } from "vitest";
import { dayLoad, stopTags, travelMinutes, isJourneyStop } from "./insights";

describe("stop tags", () => {
  it("reads booking, closing days, cash and early from the note", () => {
    const t = (notes: string) => stopTags({ notes, transport_note: null }).map((x) => x.label);
    expect(t("חובה להזמין חודשיים-שלושה מראש, 15 דקות בתוך החדר")).toEqual(["להזמין מראש"]);
    expect(t("סגור בימי שלישי! אמנות מודרנית")).toEqual(["סגור ביום שלישי"]);
    expect(t("העוף בחמאה. מזומן בלבד, מזמינים בטלפון")).toEqual(["מזומן בלבד"]);
    expect(t("להגיע לפני 9:00 לפני הקבוצות")).toEqual(["להגיע מוקדם"]);
    expect(t("Book ahead, timed entry")).toEqual(["להזמין מראש"]);
    expect(t("לכיפה צריך כרטיס, להזמין לפחות שבוע מראש")).toEqual(["להזמין מראש"]);
    expect(t("Ristorante קטן, מזמינים שולחן")).toEqual(["להזמין מראש"]);
    expect(t("כנסייה שקטה, כניסה חינם")).toEqual([]);
  });
});

describe("travel and load", () => {
  it("reads minutes out of how-to-get-there lines", () => {
    expect(travelMinutes("מטרו M3, 4 תחנות, 10 דק׳")).toBe(10);
    expect(travelMinutes("רכבת מהירה, 2:05")).toBe(125);
    expect(travelMinutes("מעבורת מהירה מקומו, שעה, כ-15 יורו")).toBe(60);
    expect(travelMinutes("אוטובוס דרך Poggibonsi, 1.5 שעות")).toBe(90);
    expect(travelMinutes("הליכה")).toBe(0);
  });
  it("leaves the journey itself out of how busy a day is", () => {
    expect(dayLoad([{ duration_min: 720, transport_note: null, label: "טיסה ליפן (Etihad)" }, { duration_min: 60, transport_note: null, label: "Hotel" }]).level).toBe("light");
    expect(dayLoad([{ duration_min: 145, transport_note: null, label: "Frecciarossa Milano → Venezia" }]).activity).toBe(0);
  });
  it("says how full a day is", () => {
    expect(dayLoad([{ duration_min: 90, transport_note: null }]).level).toBe("light");
    expect(dayLoad([{ duration_min: 180, transport_note: "שעה" }, { duration_min: 150, transport_note: "20 דק׳" }]).level).toBe("full");
    expect(dayLoad([{ duration_min: 300, transport_note: "1:15" }, { duration_min: 150, transport_note: "שעה" }, { duration_min: 60, transport_note: null }]).level).toBe("heavy");
  });
});

describe("optional stops", () => {
  it("reads 'optional' written by the import, and 'if we have energy'", () => {
    expect(stopTags({ notes: "אופציונלי. שוק Ameyoko", transport_note: null }).map((x) => x.kind)).toContain("optional");
    expect(stopTags({ notes: "אם יש כוח, ממשיכים לשוק", transport_note: null }).map((x) => x.kind)).toContain("optional");
    expect(stopTags({ notes: "ארוחת ערב", transport_note: null })).toEqual([]);
  });
});

describe("journeys don't make a day look busy", () => {
  it("counts express trains and buses as the journey, not an activity", () => {
    for (const s of ["Hida Express to Nagoya", "Limited Express Thunderbird", "רכבת לנגויה", "אוטובוס ל-Moto-Hakone", "Train to Osaka"]) expect(isJourneyStop(s), s).toBe(true);
    for (const s of ["Kyoto Railway Museum", "Nishiki Market", "Gion walk"]) expect(isJourneyStop(s), s).toBe(false);
  });
});
