"use client";

import { CodeLoginForm } from "./CodeLoginForm";
import { PasswordLoginForm } from "./PasswordLoginForm";

// Which sign-in the app offers. "password" until SMTP is set up (no emails are
// sent); "otp" brings back the 6-digit email code from SPEC §11.
const AUTH_METHOD = process.env.NEXT_PUBLIC_AUTH_METHOD === "otp" ? "otp" : "password";

export function LoginForm() {
  return AUTH_METHOD === "otp" ? <CodeLoginForm /> : <PasswordLoginForm />;
}
