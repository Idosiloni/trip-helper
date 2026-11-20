import { useTranslations } from "next-intl";

export function SetupNotice() {
  const t = useTranslations("setup");
  return (
    <div role="alert" className="border-2 border-dashed border-ink bg-surface p-4 text-sm">
      <p className="font-bold">{t("missingEnvTitle")}</p>
      <p className="mt-1 text-ink-2" dir="auto">
        {t("missingEnvBody")}
      </p>
    </div>
  );
}
