/** Only same-site paths are allowed after login; blocks "//evil.com" and "https://…". */
export function safeNext(next: string | null | undefined, fallback = "/trips"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
