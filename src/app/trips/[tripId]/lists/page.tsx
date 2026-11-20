"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// /lists opens on the tasks tab.
export default function ListsIndex() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  useEffect(() => router.replace(`/trips/${tripId}/lists/tasks`), [router, tripId]);
  return null;
}
