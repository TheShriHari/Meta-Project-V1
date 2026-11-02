/**
 * web/src/ui/learning/NarrationStrip.tsx
 * Bottom-anchored prominent narration strip for museum-style storytelling.
 */
import { useEffect, useState } from "react";

interface NarrationStripProps {
  text: string;
}

export function NarrationStrip({ text }: NarrationStripProps) {
  const [displayText, setDisplayText] = useState(text);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (text === displayText) return;
    setFading(true);
    const timeout = setTimeout(() => {
      setDisplayText(text);
      setFading(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [text, displayText]);

  if (!displayText) return null;

  return (
    <div className="narration-strip-container" role="status" aria-live="polite">
      <p className={`narration-strip-text ${fading ? "fade-out" : "fade-in"}`}>
        {displayText}
      </p>
    </div>
  );
}
