/**
 * web/src/ui/learning/LearningExperience.tsx
 * Orchestrating shell for the Four-Chapter Interactive Learning Experience.
 */
import { useLearningSession } from "./learningState.ts";
import { ChapterNavigation } from "./ChapterNavigation.tsx";
import { NarrationStrip } from "./NarrationStrip.tsx";
import { ExperimentLog } from "./ExperimentLog.tsx";
import { Chapter1Defect } from "../chapters/Chapter1Defect.tsx";
import { Chapter2Wall } from "../chapters/Chapter2Wall.tsx";
import { Chapter3Strength } from "../chapters/Chapter3Strength.tsx";
import { Chapter4Equation } from "../chapters/Chapter4Equation.tsx";

interface LearningExperienceProps {
  onGoResearchMode: () => void;
}

export function LearningExperience({ onGoResearchMode }: LearningExperienceProps) {
  const session = useLearningSession();

  const handleCompleteCurrent = () => {
    session.completeChapter(session.currentChapter);
  };

  return (
    <div
      className={`learning-experience-root chapter-${session.currentChapter}`}
      data-chapter={session.currentChapter}
    >
      {/* Top Thin Chapter Stepper Bar */}
      <ChapterNavigation
        currentChapter={session.currentChapter}
        unlockedChapters={session.unlockedChapters}
        completedChapters={session.completedChapters}
        onSelectChapter={session.setCurrentChapter}
        onGoResearchMode={onGoResearchMode}
      />

      {/* Main Chapter Scene Viewport */}
      <main className="learning-main-viewport">
        {session.currentChapter === "defect" && (
          <Chapter1Defect
            onCompleteChapter={handleCompleteCurrent}
            onNavigateChapter={session.setCurrentChapter}
            onLogExperiment={session.logExperiment}
            setNarration={session.setActiveNarration}
            experimentLog={session.experimentLog}
            material={session.selectedMaterial}
            onChangeMaterial={session.setSelectedMaterial}
          />
        )}

        {session.currentChapter === "wall" && (
          <Chapter2Wall
            onCompleteChapter={handleCompleteCurrent}
            onNavigateChapter={session.setCurrentChapter}
            onLogExperiment={session.logExperiment}
            setNarration={session.setActiveNarration}
            experimentLog={session.experimentLog}
            material={session.selectedMaterial}
            onChangeMaterial={session.setSelectedMaterial}
          />
        )}

        {session.currentChapter === "strength" && (
          <Chapter3Strength
            onCompleteChapter={handleCompleteCurrent}
            onNavigateChapter={session.setCurrentChapter}
            onLogExperiment={session.logExperiment}
            setNarration={session.setActiveNarration}
            experimentLog={session.experimentLog}
            material={session.selectedMaterial}
            onChangeMaterial={session.setSelectedMaterial}
          />
        )}

        {session.currentChapter === "equation" && (
          <Chapter4Equation
            onCompleteChapter={handleCompleteCurrent}
            onNavigateChapter={session.setCurrentChapter}
            onLogExperiment={session.logExperiment}
            setNarration={session.setActiveNarration}
            experimentLog={session.experimentLog}
            material={session.selectedMaterial}
            onChangeMaterial={session.setSelectedMaterial}
            onGoResearchMode={onGoResearchMode}
          />
        )}
      </main>

      {/* Prominent Large Narration Strip */}
      <NarrationStrip text={session.activeNarration} />

      {/* Bottom-Left Collapsible Experiment Log Drawer */}
      <ExperimentLog
        runs={session.experimentLog}
        isOpen={session.isExperimentLogOpen}
        onToggle={() => session.setIsExperimentLogOpen((open) => !open)}
      />
    </div>
  );
}
