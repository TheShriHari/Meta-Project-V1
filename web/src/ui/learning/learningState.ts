/**
 * web/src/ui/learning/learningState.ts
 * React hook for managing state across the four-chapter learning experience.
 */
import { useState, useCallback, useEffect } from "react";
import type { ChapterId, ExperimentRun, LearningSessionState } from "./learningTypes.ts";

const STORAGE_KEY_PROGRESS = "hpsim_learning_progress_v1";
const STORAGE_KEY_LOG = "hpsim_learning_log_v1";
const STORAGE_KEY_CHAPTER = "hpsim_learning_chapter_v1";

interface StoredProgress {
  unlockedChapters: Record<ChapterId, boolean>;
  completedChapters: Record<ChapterId, boolean>;
}

function loadInitialProgress(): StoredProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.unlockedChapters) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage issues
  }
  return {
    unlockedChapters: {
      defect: true,
      wall: false,
      strength: false,
      equation: false,
    },
    completedChapters: {
      defect: false,
      wall: false,
      strength: false,
      equation: false,
    },
  };
}

function loadInitialLog(): ExperimentRun[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_LOG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage issues
  }
  return [];
}

function loadInitialChapter(unlocked: Record<ChapterId, boolean>): ChapterId {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CHAPTER);
    if (raw && (raw === "defect" || raw === "wall" || raw === "strength" || raw === "equation")) {
      if (unlocked[raw as ChapterId]) {
        return raw as ChapterId;
      }
    }
  } catch {
    // Ignore storage issues
  }
  return "defect";
}

export const CHAPTER_INITIAL_NARRATION: Record<ChapterId, string> = {
  defect: "Something is different in this crystal. A line of misaligned atoms disturbs the perfect grid.",
  wall: "A glowing grain boundary cuts through the crystal — the interface where two differently tilted grains meet.",
  strength: "In polycrystalline metals, millions of crystal grains meet at atomic interfaces. How does grain size affect strength?",
  equation: "There is an exact mathematical pattern in what you measured: finer grains resist deformation according to the Hall–Petch relationship.",
};

export function useLearningSession() {
  const [initialProgress] = useState<StoredProgress>(loadInitialProgress);

  const [currentChapter, setCurrentChapter] = useState<ChapterId>(() =>
    loadInitialChapter(initialProgress.unlockedChapters)
  );
  const [unlockedChapters, setUnlockedChapters] = useState<Record<ChapterId, boolean>>(
    initialProgress.unlockedChapters
  );
  const [completedChapters, setCompletedChapters] = useState<Record<ChapterId, boolean>>(
    initialProgress.completedChapters
  );
  const [experimentLog, setExperimentLog] = useState<ExperimentRun[]>(loadInitialLog);
  const [selectedMaterial, setSelectedMaterial] = useState<"aluminium" | "copper">("aluminium");
  const [activeNarration, setActiveNarration] = useState<string>(() => {
    const ch = loadInitialChapter(initialProgress.unlockedChapters);
    return CHAPTER_INITIAL_NARRATION[ch];
  });
  const [isExperimentLogOpen, setIsExperimentLogOpen] = useState<boolean>(false);

  // Guarantee clean narration reset whenever chapter changes (no stale messages from prior chapter)
  useEffect(() => {
    setActiveNarration(CHAPTER_INITIAL_NARRATION[currentChapter]);
  }, [currentChapter]);

  const persistProgress = useCallback(
    (unlocked: Record<ChapterId, boolean>, completed: Record<ChapterId, boolean>) => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY_PROGRESS,
          JSON.stringify({ unlockedChapters: unlocked, completedChapters: completed })
        );
      } catch {
        // Storage unavailable
      }
    },
    []
  );

  const completeChapter = useCallback(
    (chapter: ChapterId) => {
      setCompletedChapters((prevComp) => {
        if (prevComp[chapter]) return prevComp;
        const nextCompleted = { ...prevComp, [chapter]: true };
        setUnlockedChapters((prevUnl) => {
          const nextUnlocked = { ...prevUnl };
          if (chapter === "defect") nextUnlocked.wall = true;
          else if (chapter === "wall") nextUnlocked.strength = true;
          else if (chapter === "strength") nextUnlocked.equation = true;
          persistProgress(nextUnlocked, nextCompleted);
          return nextUnlocked;
        });
        return nextCompleted;
      });
    },
    [persistProgress]
  );

  const navigateToChapter = useCallback(
    (chapter: ChapterId) => {
      if (unlockedChapters[chapter]) {
        setCurrentChapter(chapter);
        setActiveNarration(CHAPTER_INITIAL_NARRATION[chapter]);
        try {
          window.localStorage.setItem(STORAGE_KEY_CHAPTER, chapter);
        } catch {
          // ignore
        }
      }
    },
    [unlockedChapters]
  );

  const logExperiment = useCallback(
    (runData: Omit<ExperimentRun, "id" | "runNumber" | "timestamp">) => {
      setExperimentLog((prev) => {
        const newRun: ExperimentRun = {
          ...runData,
          id: `run_${Date.now()}_${prev.length + 1}`,
          runNumber: prev.length + 1,
          timestamp: Date.now(),
        };
        const next = [...prev, newRun];
        try {
          window.localStorage.setItem(STORAGE_KEY_LOG, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  return {
    currentChapter,
    unlockedChapters,
    completedChapters,
    experimentLog,
    selectedMaterial,
    activeNarration,
    isExperimentLogOpen,
    setCurrentChapter: navigateToChapter,
    completeChapter,
    logExperiment,
    setSelectedMaterial,
    setActiveNarration,
    setIsExperimentLogOpen,
  };
}
