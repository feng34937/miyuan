import { Lightning, ShieldChevron, Scan } from "@phosphor-icons/react";
import type { LegendId } from "../game/types";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 52 50"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="26" cy="25" r="19" stroke="currentColor" strokeWidth="2"/><circle cx="26" cy="25" r="4" fill="currentColor"/>{[0,120,240].map(a=><path key={a} transform={`rotate(${a} 26 25)`} d="M25 19V5l11 5-6 11z" fill="currentColor"/>)}
    </svg>
  );
}

export function LegendIcon({ id, size = 20 }: { id: LegendId; size?: number }) {
  const Icon =
    id === "tavi" ? Lightning : id === "boren" ? ShieldChevron : Scan;
  return <Icon size={size} weight="regular" />;
}

export function WeaponSilhouette({
  variant = "carbine",
}: {
  variant?: string;
}) {
  return (
    <svg viewBox="0 0 240 70" fill="currentColor" aria-hidden="true">
      <path
        d={
          variant === "longshot"
            ? "M8 28h34v-5h58v-9h39v9h48v8h47v7h-62v9h-37l-8 16h-16l5-16H73l-8 17H52l8-26H24L8 44V28Z"
            : variant === "breacher"
              ? "M9 27h55v-5h104v6h62v10h-61v6h-41l-8 17H98l5-17H66L56 59H42l6-22H24L9 42V27Z"
              : "M9 26h39v-6h30v-7h14v7h82v7h52v7h-51v8h-44l5 22h-22l-6-22H85L76 63H62l6-24H30L9 47V26Z"
        }
      />
      <path d="M94 25h57v4H94zm62 7h14v4h-14z" fill="#283134" opacity=".65" />
    </svg>
  );
}
