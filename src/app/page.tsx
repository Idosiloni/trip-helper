import { redirect } from "next/navigation";

// The proxy normally redirects "/" (to /trips or /login); this covers setups without Supabase env.
export default function RootPage() {
  redirect("/trips");
}
