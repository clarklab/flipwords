import { useEffect, useRef } from "react";
import { motion, PanInfo } from "framer-motion";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { Tile as TileType } from "@/game/types";

type Props = {
  tile: TileType;
  onClick?: () => void;
  onFlip?: (e: React.MouseEvent) => void;
  inSlot?: boolean;
  draggable?: boolean;
  onDragEnd?: (e: any, info: PanInfo) => void;
  boardRotation?: number;
  size?: "default" | "small";
};

export default function Tile({
  tile,
  onClick,
  onFlip,
  inSlot = false,
  draggable = false,
  onDragEnd,
  boardRotation = 0,
  size = "default",
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!innerRef.current) return;
    gsap.to(innerRef.current, {
      rotateX: tile.isFlipped ? 180 : 0,
      duration: 0.55,
      ease: "back.out(1.3)",
      overwrite: "auto",
    });
  }, [tile.isFlipped]);

  const dimensions =
    size === "small"
      ? "w-16 h-32 md:w-20 md:h-40"
      : "w-20 h-40 md:w-24 md:h-48";

  return (
    <motion.div
      layoutId={tile.id}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      whileDrag={{ scale: 1.08, zIndex: 100, rotate: 0 }}
      onClick={onClick}
      drag={draggable}
      dragSnapToOrigin={draggable}
      onDragEnd={onDragEnd}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={cn(
        "relative cursor-pointer select-none touch-none flex-shrink-0 group gpu rounded-2xl",
        dimensions,
        inSlot ? "shadow-tile-lift" : "shadow-tile hover:shadow-tile-hover"
      )}
      style={{ perspective: 1200 }}
    >
      <div
        ref={innerRef}
        className="preserve-3d absolute inset-0 rounded-2xl"
      >
        {/* Front face */}
        <TileFace
          top={tile.top}
          bottom={tile.bottom}
          inSlot={inSlot}
          boardRotation={boardRotation}
        />
        {/* Back face (visible when flipped 180°) */}
        <div
          className="absolute inset-0"
          style={{ transform: "rotateX(180deg)", backfaceVisibility: "hidden" }}
        >
          <TileFace
            top={tile.bottom}
            bottom={tile.top}
            inSlot={inSlot}
            boardRotation={boardRotation}
          />
        </div>
      </div>

      {/* Flip button — appears on hover/tap */}
      {onFlip && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFlip(e);
          }}
          aria-label="Flip tile"
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-md transition-opacity duration-200 z-10",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
            inSlot
              ? "bg-accent text-white"
              : "bg-tile-face text-ink border border-tile-edge"
          )}
        >
          <span className="material-icons text-[18px]">swap_vert</span>
        </button>
      )}
    </motion.div>
  );
}

function TileFace({
  top,
  bottom,
  inSlot,
  boardRotation,
}: {
  top: string;
  bottom: string;
  inSlot: boolean;
  boardRotation: number;
}) {
  const counter = -boardRotation;
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col rounded-2xl overflow-hidden bg-tile-face border",
        inSlot ? "border-accent/40" : "border-tile-edge"
      )}
      style={{ backfaceVisibility: "hidden" }}
    >
      {/* paper texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "repeating-linear-gradient(135deg, rgba(120,90,40,0.03) 0px, rgba(120,90,40,0.03) 1px, transparent 1px, transparent 6px)",
        }}
      />
      {/* soft top highlight */}
      <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none rounded-t-2xl bg-gradient-to-b from-white/55 to-transparent" />
      <div
        className="flex-1 flex items-center justify-center px-2 text-center font-normal-tile text-ink select-none"
        style={{ transform: `rotate(${counter}deg)` }}
      >
        <span className="text-[clamp(0.85rem,3.5vw,1.15rem)] leading-none break-all">
          {top}
        </span>
      </div>
      <div className="relative h-px w-full">
        <div className="absolute inset-x-2 h-px bg-paper-line/60" />
        {/* tactile center divots */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-[3px] h-[7px] w-[7px] rounded-full bg-tile-edge shadow-inner" />
      </div>
      <div
        className="flex-1 flex items-center justify-center px-2 text-center font-normal-tile text-ink select-none"
        style={{ transform: `rotate(${counter}deg)` }}
      >
        <span className="text-[clamp(0.85rem,3.5vw,1.15rem)] leading-none break-all">
          {bottom}
        </span>
      </div>
    </div>
  );
}
