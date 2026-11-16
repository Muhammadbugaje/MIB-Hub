/**
 * The page's shared full screen, window.MIBFull (public/play/_shared/mib/mib-full.js,
 * loaded by /play/<slug>), typed for the TypeScript side (GameHost and the games).
 */

/** The parts of mib-full.js that TypeScript code uses. */
export interface FullScreen {
  attach(
    stage: HTMLElement,
    opts: { title?: string; icon?: string; landscape?: boolean; pause?: () => boolean; resume?: () => void },
  ): FullScreen;
  /** Show the cover: "play" before the first start, "resume" after leaving full screen. */
  cover(mode: "play" | "resume"): void;
  coverOpen(): boolean;
  /** Go full screen. Call it inside a tap or click. */
  enter(): void;
  active(): boolean;
}

/** window.MIBFull, or null (server side, or the script did not load). */
export const fullScreen = (): FullScreen | null =>
  typeof window !== "undefined" ? ((window as { MIBFull?: FullScreen }).MIBFull ?? null) : null;
