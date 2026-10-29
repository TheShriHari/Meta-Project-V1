/**
 * web/src/core/playback.ts - Presentation pacing only.
 * Converts elapsed wall-clock frame time into a whole number of FIXED physics steps.
 * speed scales how many steps are consumed per second of wall time; it never alters dt, the
 * velocity, or any step's numerical result.
 */
export function framesToSteps(
  accumulator: number, frameDt_s: number, speed: number, baseStepsPerSecond: number
): { steps: number; accumulator: number } {
  if (!(speed >= 0) || !(baseStepsPerSecond > 0) || !(frameDt_s >= 0)) throw new Error("invalid playback arguments");
  const total = accumulator + frameDt_s * speed * baseStepsPerSecond;
  const steps = Math.floor(total + 1e-9);
  return { steps, accumulator: Math.max(total - steps, 0) };
}
