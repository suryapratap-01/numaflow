import { Capabilities } from "../api/v2/types";
import {
  resolvePodViewExperience,
  writePodViewPreference,
  readPodViewPreference,
  POD_VIEW_EXPERIENCE_STORAGE_KEY,
} from "./podViewExperience";

const capabilities = (
  mode: Capabilities["podView"]["mode"],
  overrides: Partial<Capabilities["podView"]> = {}
): Capabilities => ({
  apiVersion: "v2",
  operations: [],
  limits: {
    defaultPageSize: 50,
    maximumPageSize: 200,
    maximumLogLines: 1000,
    maximumMetricPoints: 2000,
  },
  podView: {
    mode,
    eligible: mode !== "disabled",
    defaultExperience:
      mode === "default" || mode === "required" ? "next" : "classic",
    allowClassicFallback: mode !== "required",
    ...overrides,
  },
});

describe("Pod View experience resolution", () => {
  beforeEach(() => localStorage.clear());

  it("keeps ineligible and disabled users on classic", () => {
    expect(resolvePodViewExperience(capabilities("disabled"), "next")).toBe(
      "classic"
    );
    expect(
      resolvePodViewExperience(
        capabilities("optIn", { eligible: false }),
        "next"
      )
    ).toBe("classic");
  });

  it("uses URL, then stored preference, then server default", () => {
    expect(resolvePodViewExperience(capabilities("optIn"), "next")).toBe(
      "next"
    );
    expect(resolvePodViewExperience(capabilities("optIn"), null, "next")).toBe(
      "next"
    );
    expect(resolvePodViewExperience(capabilities("default"), null)).toBe(
      "next"
    );
  });

  it("does not allow classic fallback in required mode", () => {
    expect(resolvePodViewExperience(capabilities("required"), "classic")).toBe(
      "next"
    );
  });

  it("persists only valid preferences", () => {
    writePodViewPreference("next");
    expect(localStorage.getItem(POD_VIEW_EXPERIENCE_STORAGE_KEY)).toBe("next");
    expect(readPodViewPreference()).toBe("next");
    localStorage.setItem(POD_VIEW_EXPERIENCE_STORAGE_KEY, "invalid");
    expect(readPodViewPreference()).toBeUndefined();
  });
});
