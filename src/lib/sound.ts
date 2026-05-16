// Tiny synthesized sound engine. One shared AudioContext, a master gain that
// can be muted, and a few helper primitives (tone, noise burst). Each exported
// `play*` function composes those into a characterful effect for one of the
// game's actions. Lazy-init so we never touch `window` on the server, and
// resume() on every play to dodge the autoplay gate on browsers that suspend
// the context until a user gesture.

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _muted = false;

const getCtx = (): { ctx: AudioContext; master: GainNode } | null => {
  if (_muted) return null;
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try {
      const Ctx: typeof AudioContext =
        (window.AudioContext || (window as any).webkitAudioContext) as any;
      if (!Ctx) return null;
      _ctx = new Ctx();
      _master = _ctx.createGain();
      _master.gain.value = 0.55;
      _master.connect(_ctx.destination);
    } catch {
      _muted = true;
      return null;
    }
  }
  if (_ctx.state === "suspended") {
    _ctx.resume().catch(() => {});
  }
  return { ctx: _ctx, master: _master! };
};

type ToneOpts = {
  freq: number | [number, number];
  type?: OscillatorType;
  duration?: number;
  delay?: number;
  gain?: number;
  attack?: number;
  rampType?: "exponential" | "linear";
};

const tone = (
  ctx: AudioContext,
  out: AudioNode,
  opts: ToneOpts
) => {
  const start = ctx.currentTime + (opts.delay ?? 0);
  const dur = opts.duration ?? 0.15;
  const attack = opts.attack ?? 0.004;
  const peak = opts.gain ?? 0.15;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "sine";
  if (typeof opts.freq === "number") {
    osc.frequency.setValueAtTime(opts.freq, start);
  } else {
    osc.frequency.setValueAtTime(opts.freq[0], start);
    if (opts.rampType === "linear") {
      osc.frequency.linearRampToValueAtTime(opts.freq[1], start + dur);
    } else {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(opts.freq[1], 0.0001),
        start + dur
      );
    }
  }
  osc.connect(gain);
  gain.connect(out);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.02);
};

type NoiseOpts = {
  duration?: number;
  delay?: number;
  gain?: number;
  filterType?: BiquadFilterType;
  filterStart?: number;
  filterEnd?: number;
  filterQ?: number;
};

const noise = (ctx: AudioContext, out: AudioNode, opts: NoiseOpts) => {
  const start = ctx.currentTime + (opts.delay ?? 0);
  const dur = opts.duration ?? 0.18;
  const peak = opts.gain ?? 0.08;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType ?? "bandpass";
  filter.frequency.setValueAtTime(opts.filterStart ?? 1800, start);
  if (opts.filterEnd !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(opts.filterEnd, 1),
      start + dur
    );
  }
  filter.Q.value = opts.filterQ ?? 4;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(start);
  src.stop(start + dur);
};

const safe = (fn: (h: { ctx: AudioContext; master: GainNode }) => void) => {
  const handles = getCtx();
  if (!handles) return;
  try {
    fn(handles);
  } catch {
    /* swallow — audio is decorative */
  }
};

// Tile lands in a slot — woody thunk with a hint of click on top.
export const playTileDrop = () =>
  safe(({ ctx, master }) => {
    tone(ctx, master, {
      freq: [420, 150],
      type: "triangle",
      duration: 0.11,
      gain: 0.22,
    });
    tone(ctx, master, {
      freq: [220, 90],
      type: "sine",
      duration: 0.13,
      gain: 0.12,
    });
    noise(ctx, master, {
      duration: 0.04,
      filterStart: 1400,
      filterQ: 2,
      gain: 0.05,
    });
  });

// Tile lifted off a slot — quick upward chirp.
export const playTilePickup = () =>
  safe(({ ctx, master }) => {
    tone(ctx, master, {
      freq: [380, 680],
      type: "triangle",
      duration: 0.07,
      gain: 0.14,
      rampType: "linear",
    });
  });

// Tile flip — paper rustle plus a tiny tick at the end of the rotation.
export const playTileFlip = () =>
  safe(({ ctx, master }) => {
    noise(ctx, master, {
      duration: 0.22,
      filterStart: 3800,
      filterEnd: 700,
      filterQ: 1.6,
      gain: 0.07,
    });
    tone(ctx, master, {
      freq: 920,
      type: "square",
      duration: 0.04,
      gain: 0.06,
      delay: 0.16,
    });
  });

// Board rotates 90° — swept whoosh plus a rising sine that lands on a soft thud.
export const playBoardRotate = () =>
  safe(({ ctx, master }) => {
    noise(ctx, master, {
      duration: 0.5,
      filterStart: 500,
      filterEnd: 2400,
      filterQ: 3,
      gain: 0.09,
    });
    tone(ctx, master, {
      freq: [200, 520],
      type: "sine",
      duration: 0.46,
      gain: 0.09,
      rampType: "linear",
    });
    // Settling thud at the end of the rotation
    tone(ctx, master, {
      freq: [320, 140],
      type: "triangle",
      duration: 0.12,
      gain: 0.14,
      delay: 0.42,
    });
  });

// Hint applied — sparkle: three quick ascending bell tones.
export const playHint = () =>
  safe(({ ctx, master }) => {
    const notes = [988, 1175, 1568]; // B5, D6, G6
    notes.forEach((f, i) => {
      tone(ctx, master, {
        freq: f,
        type: "sine",
        duration: 0.36,
        gain: 0.1,
        delay: i * 0.055,
      });
      tone(ctx, master, {
        freq: f * 2,
        type: "sine",
        duration: 0.2,
        gain: 0.04,
        delay: i * 0.055,
      });
    });
  });

// "Correct!" judge verdict — bright ascending major arpeggio.
export const playCorrect = () =>
  safe(({ ctx, master }) => {
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      tone(ctx, master, {
        freq: f,
        type: "triangle",
        duration: 0.2,
        gain: 0.14,
        delay: i * 0.075,
      });
    });
  });

// "Not yet" — descending two-tone buzz.
export const playIncorrect = () =>
  safe(({ ctx, master }) => {
    tone(ctx, master, {
      freq: [330, 220],
      type: "sawtooth",
      duration: 0.18,
      gain: 0.14,
    });
    tone(ctx, master, {
      freq: [220, 120],
      type: "sawtooth",
      duration: 0.34,
      gain: 0.11,
      delay: 0.14,
    });
  });

// Puzzle solved — celebration fanfare: arpeggio rolls into a sustained chord
// with a high bell on top.
export const playPuzzleComplete = () =>
  safe(({ ctx, master }) => {
    const arp = [523, 659, 784, 1047]; // C E G C
    arp.forEach((f, i) => {
      tone(ctx, master, {
        freq: f,
        type: "triangle",
        duration: 0.14,
        gain: 0.12,
        delay: i * 0.06,
      });
    });
    // Sustained chord (C major add 9)
    const chord = [523, 659, 784, 988, 1175];
    chord.forEach((f) => {
      tone(ctx, master, {
        freq: f,
        type: "sine",
        duration: 0.85,
        gain: 0.06,
        delay: 0.26,
        attack: 0.04,
      });
    });
    // High bell topper
    tone(ctx, master, {
      freq: 2093, // C7
      type: "triangle",
      duration: 0.6,
      gain: 0.09,
      delay: 0.48,
    });
  });

// Session complete — bigger, longer fanfare than a single puzzle solve.
export const playSessionComplete = () =>
  safe(({ ctx, master }) => {
    // Two ascending runs that climb past where puzzleComplete tops out
    const seq: Array<[number, number]> = [
      [523, 0.0], // C5
      [659, 0.09], // E5
      [784, 0.18], // G5
      [1047, 0.28], // C6
      [988, 0.46], // B5
      [1175, 0.55], // D6
      [1397, 0.65], // F6
      [1568, 0.74], // G6
    ];
    seq.forEach(([f, t]) => {
      tone(ctx, master, {
        freq: f,
        type: "triangle",
        duration: 0.22,
        gain: 0.12,
        delay: t,
      });
    });
    // Wide sustained chord
    [523, 784, 1047, 1319, 1568].forEach((f) => {
      tone(ctx, master, {
        freq: f,
        type: "sine",
        duration: 1.2,
        gain: 0.05,
        delay: 0.84,
        attack: 0.06,
      });
    });
  });

// Earned star — bright "zing" with an upward swoop into a bell strike and a
// shimmery overtone. Use the index to pitch each successive zing higher so a
// 3-star ascent climbs.
export const playStarZing = (index: number = 0) =>
  safe(({ ctx, master }) => {
    const notes = [1047, 1319, 1568]; // C6 E6 G6
    const f = notes[Math.min(Math.max(index, 0), notes.length - 1)];
    // Upward swoop into the bell strike
    tone(ctx, master, {
      freq: [f * 0.55, f],
      type: "triangle",
      duration: 0.1,
      gain: 0.09,
      rampType: "exponential",
    });
    // Main bell body
    tone(ctx, master, {
      freq: f,
      type: "triangle",
      duration: 0.32,
      gain: 0.14,
      delay: 0.05,
    });
    // Bright shimmer one octave up
    tone(ctx, master, {
      freq: f * 2,
      type: "sine",
      duration: 0.26,
      gain: 0.06,
      delay: 0.05,
    });
    // Sparkle on top
    tone(ctx, master, {
      freq: f * 3,
      type: "sine",
      duration: 0.14,
      gain: 0.035,
      delay: 0.05,
    });
  });

// Missed star — deflated downward "pop". The wah-wah cousin of the zing for
// every empty slot in the rating.
export const playStarMiss = () =>
  safe(({ ctx, master }) => {
    tone(ctx, master, {
      freq: [500, 180],
      type: "triangle",
      duration: 0.22,
      gain: 0.1,
      rampType: "exponential",
    });
    tone(ctx, master, {
      freq: [260, 95],
      type: "sine",
      duration: 0.24,
      gain: 0.06,
      rampType: "exponential",
    });
    noise(ctx, master, {
      duration: 0.05,
      filterStart: 900,
      filterQ: 1.4,
      gain: 0.04,
    });
  });
