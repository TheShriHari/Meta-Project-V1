/**
 * web/src/ui/learning/learningState.ts
 * React hook for managing state across the four-chapter learning experience.
 */
import { useState, useCallback } from "react";
import type { ChapterId, ExperimentRun, LearningSessionState } from "./learningTypes.ts";

const STORAGE_KEY_PROGRESS = "hpsim_learning_progress_v1";

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

export function useLearningSession() {
  const [initialProgress] = useState<StoredProgress>(loadInitialProgress);

  const [currentChapter, setCurrentChapter] = useState<ChapterId>("defect");
  const [unlockedChapters, setUnlockedChapters] = useState<Record<ChapterId, boolean>>(
    initialProgress.unlockedChapters
  );
  const [completedChapters, setCompletedChapters] = useState<Record<ChapterId, boolean>>(
    initialProgress.completedChapters
  );
  const [experimentLog, setExperimentLog] = useState<ExperimentRun[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<"aluminium" | "copper">("aluminium");
  const [activeNarration, setActiveNarration] = useState<string>(
    "Something is different in this crystal."
  );
  const [isExperimentLogOpen, setIsExperimentLogOpen] = useState<boolean>(false);

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
        return [...prev, newRun];
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
