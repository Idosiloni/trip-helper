import { Suspense } from "react";
import { TasksScreen } from "@/features/lists/TasksScreen";

export default function TasksPage() {
  return (
    <Suspense>
      <TasksScreen />
    </Suspense>
  );
}
