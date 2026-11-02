/**
 * web/src/ui/learning/learningTypes.ts
 * Types and contracts for the Four-Chapter Interactive Learning Experience.
 */

export type ChapterId = "defect" | "wall" | "strength" | "equation";

export interface ChapterMeta {
  id: ChapterId;
  number: number;
  title: string;
  subtitle: string;
}

export const CHAPTERS: ChapterMeta[] = [
  { id: "defect", number: 1, title: "The Defect", subtitle: "What is a dislocation?" },
  { id: "wall", number: 2, title: "The Wall", subtitle: "Grain boundaries as obstacles" },
  { id: "strength", number: 3, title: "More Walls, More Strength", subtitle: "Smaller grains resist deformation" },
  { id: "equation", number: 4, title: "The Pattern Has a Name", subtitle: "The Hall–Petch relationship" },
];

export interface ExperimentRun {
  id: string;
  runNumber: number;
  chapter: ChapterId;
  timestamp: number;
  materialKey: "aluminium" | "copper";
  grainSizeUm?: number;
  appliedStressMpa?: number;
  misalignmentDeg?: number;
  calculatedStrengthMpa?: number;
  outcome: string;
  prediction?: "stronger" | "weaker";
  wasPredictionCorrect?: boolean;
  notes?: string;
}

export interface LearningSessionState {
  currentChapter: ChapterId;
  unlockedChapters: Record<ChapterId, boolean>;
  completedChapters: Record<ChapterId, boolean>;
  experimentLog: ExperimentRun[];
  selectedMaterial: "aluminium" | "copper";
  activeNarration: string;
  isExperimentLogOpen: boolean;
}

export interface ChapterProps {
  onCompleteChapter: () => void;
  onNavigateChapter: (chapter: ChapterId) => void;
  onLogExperiment: (run: Omit<ExperimentRun, "id" | "runNumber" | "timestamp">) => void;
  setNarration: (text: string) => void;
  experimentLog: ExperimentRun[];
  material: "aluminium" | "copper";
  onChangeMaterial: (mat: "aluminium" | "copper") => void;
  onGoResearchMode?: () => void;
}
