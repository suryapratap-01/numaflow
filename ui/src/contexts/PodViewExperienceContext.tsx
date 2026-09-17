import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  PodViewExperience,
  readPodViewPreference,
  writePodViewPreference,
} from "../utils/podViewExperience";
import { replaceObservabilityState } from "../utils/observabilityURLState";

interface PodViewExperienceContextValue {
  experience: PodViewExperience;
  setExperience: (experience: PodViewExperience) => void;
}

const PodViewExperienceContext = createContext<
  PodViewExperienceContextValue | undefined
>(undefined);

function readExperienceFromUrl(search: string): PodViewExperience | undefined {
  const experience = new URLSearchParams(search).get("podView");
  return experience === "classic" || experience === "next"
    ? experience
    : undefined;
}

export function PodViewExperienceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const history = useHistory();
  const location = useLocation();
  const [experience, setExperienceState] = useState<PodViewExperience>(
    () =>
      readExperienceFromUrl(location.search) ||
      readPodViewPreference() ||
      "classic"
  );

  useEffect(() => {
    const urlExperience = readExperienceFromUrl(location.search);
    if (urlExperience) {
      setExperienceState(urlExperience);
    }
  }, [location.search]);

  const setExperience = useCallback(
    (nextExperience: PodViewExperience) => {
      writePodViewPreference(nextExperience);
      setExperienceState(nextExperience);
      replaceObservabilityState(history, location, {
        podView: nextExperience,
      });
    },
    [history, location]
  );

  const value = useMemo(
    () => ({ experience, setExperience }),
    [experience, setExperience]
  );

  return (
    <PodViewExperienceContext.Provider value={value}>
      {children}
    </PodViewExperienceContext.Provider>
  );
}

export function usePodViewExperience(): PodViewExperienceContextValue {
  const context = useContext(PodViewExperienceContext);
  if (!context) {
    throw new Error(
      "usePodViewExperience must be used within a PodViewExperienceProvider"
    );
  }
  return context;
}
