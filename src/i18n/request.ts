import { getRequestConfig } from "next-intl/server";

// Hebrew only for now (SPEC §13). English becomes messages/en.json plus a
// locale read from the user's profile; no locale segment in the URL.
export const DEFAULT_LOCALE = "he";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    timeZone: "Asia/Jerusalem",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
