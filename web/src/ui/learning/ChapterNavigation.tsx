/**
 * web/src/ui/learning/ChapterNavigation.tsx
 * Thin top navigation bar with progress indicators and persistent Research Mode link.
 */
import { CHAPTERS, type ChapterId } from "./learningTypes.ts";

interface ChapterNavigationProps {
  currentChapter: ChapterId;
  unlockedChapters: Record<ChapterId, boolean>;
  completedChapters: Record<ChapterId, boolean>;
  onSelectChapter: (chapter: ChapterId) => void;
  onGoResearchMode: () => void;
}

export function ChapterNavigation({
  currentChapter,
  unlockedChapters,
  completedChapters,
  onSelectChapter,
  onGoResearchMode,
}: ChapterNavigationProps) {
  return (
    <header className="learning-nav-header">
      <div className="learning-nav-brand">
        <span className="nav-brand-title">HPSim</span>
        <span className="nav-brand-divider">/</span>
        <span className="nav-brand-tag">Intuitive Mechanics</span>
      </div>

      <nav className="learning-stepper" aria-label="Chapter progress">
        {CHAPTERS.map((ch, idx) => {
          const isCurrent = ch.id === currentChapter;
          const isUnlocked = unlockedChapters[ch.id];
          const isCompleted = completedChapters[ch.id];

          return (
            <div key={ch.id} className="stepper-item-wrap">
              {idx > 0 && (
                <div
                  className={`stepper-connector ${
                    completedChapters[CHAPTERS[idx - 1].id] ? "completed" : ""
                  }`}
                />
              )}
              <button
                className={`stepper-node ${isCurrent ? "current" : ""} ${
                  isCompleted ? "completed" : ""
                } ${!isUnlocked ? "locked" : ""}`}
                disabled={!isUnlocked}
                onClick={() => onSelectChapter(ch.id)}
                aria-label={`Chapter ${ch.number}: ${ch.title}`}
                title={
                  !isUnlocked
                    ? `Complete Chapter ${ch.number - 1} to unlock`
                    : `Chapter ${ch.number}: ${ch.title}`
                }
              >
                <span className="stepper-dot">
                  {isCompleted ? "✓" : ch.number}
                </span>
                <span className="stepper-label">{ch.title}</span>
              </button>
            </div>
          );
        })}
      </nav>

      <button
        className="nav-research-btn"
        onClick={onGoResearchMode}
        title="Open full research controls with Schmid glide, transmission fixtures, and EFN pileups"
      >
        Research Mode &rarr;
      </button>
    </header>
  );
}
