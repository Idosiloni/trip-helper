"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "@/components/app/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { OtpInput } from "@/components/ui/OtpInput";
import { Segmented } from "@/components/ui/Segmented";
import { Stamp } from "@/components/ui/Stamp";
import { TextField } from "@/components/ui/TextField";
import { Ticket } from "@/components/ui/Ticket";
import { PALETTE, applyTheme, type ThemeChoice } from "@/lib/theme";

const ICONS: IconName[] = ["sun", "route", "pin", "lists", "plus", "copy", "paste", "settings", "back", "user", "logout", "check", "plane", "mail"];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t-2 border-ink pt-3">
      <h2 className="text-sm font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export function UiGallery() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [code, setCode] = useState("12");
  return (
    <main className="pt-safe mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-6" style={{ "--trip": color } as CSSProperties}>
      <h1 className="display print-offset text-[5rem]">רכיבים</h1>
      <Segmented
        label="מראה"
        value={theme}
        onChange={(v) => {
          setTheme(v);
          applyTheme(v);
        }}
        options={[
          { value: "system", label: "לפי המכשיר" },
          { value: "light", label: "בהיר" },
          { value: "dark", label: "כהה" },
        ]}
      />
      <ColorPicker label="צבע הטיול" value={color} onChange={setColor} />
      <Block title="כרטיס טיול">
        <Ticket
          main={
            <div className="relative px-4 pb-3 pt-4">
              <span className="halftone absolute -end-8 -top-8 size-28 rounded-full opacity-50" />
              <p className="display relative text-[3.4rem]">יפן 2027</p>
              <p className="relative text-ink-2">טוקיו · קיוטו · אוסקה</p>
            </div>
          }
          stub={
            <div className="flex items-center justify-between px-4 py-2">
              <span className="flex items-baseline gap-1.5 font-bold">
                עוד <span className="display text-[3.25rem] leading-[0.8] text-trip-ink">135</span> ימים
              </span>
              <Stamp>7/12 משימות</Stamp>
            </div>
          }
        />
      </Block>
      <Block title="כפתורים">
        <Button icon={<Icon name="plus" strokeWidth={3} />}>טיול חדש</Button>
        <Button size="lg" block>
          כפתור ראשי ברוחב מלא
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1">
            העתק פרומט
          </Button>
          <Button variant="secondary" className="flex-1">
            הדבק תשובה
          </Button>
        </div>
        <Button variant="ghost">שקוף</Button>
        <Button variant="danger">מחיקה</Button>
        <Button loading>טוען</Button>
        <Button disabled>מושבת</Button>
      </Block>
      <Block title="רשימה">
        <div className="flex flex-col divide-y divide-hair">
          <Checkbox label="להזמין מלון בקיוטו" />
          <Checkbox label="להוציא ין במזומן" />
          <Checkbox label="לבדוק תוקף דרכונים" defaultChecked />
        </div>
        <div className="flex gap-3">
          <Stamp>מה חסר</Stamp>
          <Stamp tone="ink" tilt={3}>
            חסר · בקניות
          </Stamp>
          <Stamp tone="muted">הסתיים</Stamp>
        </div>
      </Block>
      <Block title="שדות">
        <TextField label="שם הטיול" placeholder="יפן 2027" />
        <TextField label="עם שגיאה" defaultValue="abc" error="המייל הזה לא נראה תקין" />
        <OtpInput label="קוד" value={code} onChange={setCode} />
      </Block>
      <Block title="אווטרים ואייקונים">
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c, i) => (
            <Avatar key={c} name={["אבא", "אמא", "נועה", "יואב", "סבתא", "Dan"][i]} color={c} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {ICONS.map((n) => (
            <span key={n} title={n} className="grid size-11 place-items-center border-2 border-ink bg-surface">
              <Icon name={n} />
            </span>
          ))}
        </div>
      </Block>
      <EmptyState icon="plane" title="עוד אין טיולים" body="יוצרים טיול, מזמינים את המשפחה ומתכננים יחד." action={<Button>טיול חדש</Button>} />
    </main>
  );
}
