import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { useEdition } from "@/edition";

export type AnimatedWordmarkHandle = {
  flip: () => void;
};

type Props = {
  /** Defaults to the active edition's wordmark. */
  text?: string;
  className?: string;
  /** Run the flip animation automatically on mount. */
  autoplay?: boolean;
};

/**
 * The wordmark, split into per-letter spans so each character can spin on a
 * random axis (X or Y) with a randomized direction and stagger. Overlapping
 * cascade creates a quick flipboard feel.
 *
 * Type resolves through `.font-display`, which is Mona Sans (wide + heavy, via
 * `.display-wide`) under FlipWords and Grifinito — Texas Monthly's didone
 * register — under the Texas edition. That single class is what makes the
 * masthead read as a magazine rather than an app.
 *
 * Triggered via the imperative `flip()` handle — caller fires it on page
 * load, after closing the tutorial, or whatever else. Hover also retriggers.
 */
const AnimatedWordmark = forwardRef<AnimatedWordmarkHandle, Props>(function AnimatedWordmark(
  { text, className, autoplay },
  ref
) {
  // No caller should have to know which edition is live — the default comes
  // from the registry, per the one rule in docs/edition-architecture.md.
  const { config, edition } = useEdition();
  const label = text ?? config.wordmark;
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const letters = Array.from(label);

  const flip = useCallback(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    letterRefs.current.forEach((el, i) => {
      if (!el) return;
      // Random axis per letter per call so successive triggers feel fresh.
      const axisIsY = Math.random() < 0.5;
      const property = axisIsY ? "rotateY" : "rotateX";
      const direction = Math.random() < 0.5 ? 360 : -360;
      const duration = 0.55 + Math.random() * 0.2;
      const delay = i * 0.055 + Math.random() * 0.04;
      gsap.fromTo(
        el,
        { [property]: 0 },
        {
          [property]: direction,
          duration,
          delay,
          ease: "power2.inOut",
          overwrite: "auto",
        }
      );
    });
  }, []);

  useImperativeHandle(ref, () => ({ flip }), [flip]);

  // A magazine masthead does not move. Under Texas Monthly the wordmark is a
  // logotype, so it never autoplays and never flips on hover — the letter-flip
  // is FlipWords' own brand idea (the game is *called* FlipWords) and reading
  // it as "TEXAS TWO STEP" mid-cascade rendered the masthead illegible.
  const animated = autoplay ?? edition !== 'texas';

  useEffect(() => {
    if (!animated) return;
    // Brief delay so the display face has a chance to swap in before the first
    // cascade — otherwise the very first frame can show fallback metrics.
    const t = window.setTimeout(flip, 220);
    return () => window.clearTimeout(t);
  }, [animated, flip]);

  return (
    <h1
      // `font-display` is deliberately kept OUT of cn(): tailwind-merge treats
      // every `font-*` class as one family group, so a caller passing
      // `font-wide` would silently drop it and the wordmark would lose the
      // display face. `.display-wide` puts Mona Sans' wdth/wght axes back for
      // FlipWords; Grifinito, being a static CFF, ignores them.
      className={
        "wordmark font-display display-wide " +
        cn(
          "leading-none inline-flex pointer-events-auto cursor-default select-none",
          className
        )
      }
      onMouseEnter={animated ? flip : undefined}
      style={{ perspective: 900 }}
      aria-label={label}
    >
      {letters.map((char, i) => {
        // Word spaces are drawn as a fixed em gap rather than a space glyph:
        // Grifinito's trial charset has no U+00A0, so a literal nbsp would be
        // served by the fallback face at the fallback's advance width.
        const isSpace = char === " ";
        return (
          <span
            key={i}
            ref={(el) => {
              letterRefs.current[i] = el;
            }}
            className="inline-block"
            style={{
              transformStyle: "preserve-3d",
              willChange: "transform",
              width: isSpace ? "0.3em" : undefined,
            }}
            aria-hidden="true"
          >
            {isSpace ? "" : char}
          </span>
        );
      })}
    </h1>
  );
});

export default AnimatedWordmark;
