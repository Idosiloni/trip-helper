// Sets a new password for an existing user (admin, via SUPABASE_SECRET_KEY in .env.local).
// Passwords are stored hashed and can't be read back; this replaces one.
// Usage: node scripts/set-password.mjs you@example.com   (asks for the new password, hidden)
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import readline from "node:readline";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/set-password.mjs <email>");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : "");
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
const user = data.users.find((u) => u.email?.toLowerCase() === email);
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}
const pw = await askHidden("New password (at least 6 characters): ");
if (pw.length < 6) {
  console.error("Too short.");
  process.exit(1);
}
const again = await askHidden("Again: ");
if (pw !== again) {
  console.error("Passwords don't match.");
  process.exit(1);
}
const { error: e2 } = await admin.auth.admin.updateUserById(user.id, { password: pw });
if (e2) throw e2;
console.log(`Password updated for ${email}. Sign in with it now.`);
