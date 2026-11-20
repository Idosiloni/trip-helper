"use client";

import { createContext, use } from "react";
import type { PromptId, PromptParams } from "@/lib/prompts/registry";

/** Lets any trip screen open the prompt sheet, optionally on a specific prompt with parameters. */
export const PromptSheetContext = createContext<(id?: PromptId, params?: PromptParams) => void>(() => {});

export function useOpenPrompt() {
  return use(PromptSheetContext);
}
