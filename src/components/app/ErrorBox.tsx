"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

export function ErrorBox({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations("common");
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-ink-2">{t("errorGeneric")}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}
