import { GetStore } from "../localStore/GetStore";
import { SetStore } from "../localStore/SetStore";
import { Capabilities } from "../api/v2/types";

export type PodViewExperience = "classic" | "next";

export const POD_VIEW_EXPERIENCE_STORAGE_KEY = "numaflow.podView.experience";

export function readPodViewPreference(): PodViewExperience | undefined {
  if (typeof window === "undefined") return undefined;
  return parseExperience(GetStore(POD_VIEW_EXPERIENCE_STORAGE_KEY));
}

export function writePodViewPreference(experience: PodViewExperience): void {
  SetStore(POD_VIEW_EXPERIENCE_STORAGE_KEY, experience);
}

export function resolvePodViewExperience(
  capabilities: Capabilities | undefined,
  urlOverride: string | null,
  storedPreference = readPodViewPreference()
): PodViewExperience {
  const podView = capabilities?.podView;
  if (!podView || !podView.eligible || podView.mode === "disabled") {
    return "classic";
  }
  if (podView.mode === "required") {
    return "next";
  }

  const requested = parseExperience(urlOverride);
  if (requested && (requested === "next" || podView.allowClassicFallback)) {
    return requested;
  }
  if (
    storedPreference &&
    (storedPreference === "next" || podView.allowClassicFallback)
  ) {
    return storedPreference;
  }
  return podView.defaultExperience;
}

function parseExperience(value: string | null): PodViewExperience | undefined {
  return value === "classic" || value === "next" ? value : undefined;
}
