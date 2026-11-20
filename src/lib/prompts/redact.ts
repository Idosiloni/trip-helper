// Prompts leave the app for an external chat (SPEC §9). They're built only from
// non-sensitive fields, and as a second line of defense every prompt passes
// through redact(): emails, phone numbers and long digit/code runs (booking
// confirmations, passport numbers) are replaced before copying.

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// 9+ digits allowing spaces/dashes/dots/parentheses between them, optional +country.
const PHONE = /\+?\(?\d[\d\s().-]{7,}\d/g;
// Booking/confirmation-like codes: 6+ chars mixing letters and digits, all caps.
const CODE = /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\b/g;

// Dates and times look like phone numbers to PHONE ("4.12 - 8.12", "14.12.2026",
// "2027-04-01–2027-04-05", "12:30 - 14:00"). Such matches are kept.
const DATES = /\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?|\d{1,2}:\d{2}/g;
// After removing dates, phone numbers still have a run of 3+ digits ("054", "1234567");
// what's left of a date + time cut by the match ("2027-04-01 14") doesn't.
const isDates = (m: string) => !/\d{3}/.test(m.replace(DATES, ""));

export function redact(text: string): string {
  return text
    .replace(EMAIL, "[הוסר]")
    .replace(CODE, "[הוסר]")
    .replace(PHONE, (m) => (isDates(m) ? m : "[הוסר]"));
}
