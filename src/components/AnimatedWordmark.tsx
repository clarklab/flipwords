import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

export type AnimatedWordmarkHandle = {
  flip: () => void;
};

type Props = {
  text?: string;
  className?: string;
  /** Run the flip animation automatically on mount. */
  autoplay?: boolean;
};

/**
 * The FLIPWORDS wordmark, split into per-letter spans so each character can
 * spin on a random axis (X or Y) with a randomized direction and stagger.
 * Overlapping cascade creates a quick flipboard feel.
 *
 * Triggered via the imperative `flip()` handle — caller fires it on page
 * load, after closing the tutorial, or whatever else. Hover also retriggers.
 */
const AnimatedWordmark = forwardRef<AnimatedWordmarkHandle, Props>(function AnimatedWordmark(
  { text = "FLIPWORDS", className, autoplay = true },
  ref
) {
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const letters = Array.from(text);

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

  useEffect(() => {
    if (!autoplay) return;
    // Brief delay so the font (Mona Sans) has a chance to swap in before the
    // first cascade — otherwise the very first frame can show fallback metrics.
    const t = window.setTimeout(flip, 220);
    return () => window.clearTimeout(t);
  }, [autoplay, flip]);

  return (
    <h1
      className={cn(
        "font-wide leading-none tracking-wide inline-flex pointer-events-auto cursor-default select-none",
        className
      )}
      onMouseEnter={flip}
      style={{ perspective: 900 }}
      aria-label={text}
    >
      {letters.map((char, i) => (
        <span
          key={i}
          ref={(el) => {
            letterRefs.current[i] = el;
          }}
          className="inline-block"
          style={{
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
          aria-hidden="true"
        >
          {/* nbsp keeps any literal spaces in the wordmark from collapsing */}
          {char === " " ? " " : char}
        </span>
      ))}
    </h1>
  );
});

export default AnimatedWordmark;
