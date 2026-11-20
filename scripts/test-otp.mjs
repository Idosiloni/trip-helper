// Dev helper: prints a fresh 6-digit sign-in code for a TEST address (…@example.test)
// using the admin API, so the login UI can be exercised without an inbox.
// Usage: node --env-file=.env.local scripts/test-otp.mjs rls-ui@example.test
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email?.endsWith("@example.test")) {
  console.error("Only @example.test addresses are allowed.");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(data.properties.email_otp);
