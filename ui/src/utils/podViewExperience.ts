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
  if (podView?.mode === "required") {
    return "next";
  }

  const requested = parseExperience(urlOverride);
  if (requested) {
    return requested;
  }
  if (storedPreference) {
    return storedPreference;
  }
  return "classic";
}

function parseExperience(value: string | null): PodViewExperience | undefined {
  return value === "classic" || value === "next" ? value : undefined;
}
