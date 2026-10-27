import { useId } from "react";

/**
 * A gold wax seal with a keyhole. `broken` cracks it into two halves that
 * slide apart: the moment one payment is unsealed. Pure SVG and CSS
 * transforms, so it costs nothing to draw.
 */
export function WaxSeal({ broken = false, size = 96, label }: { broken?: boolean; size?: number; label?: string }) {
  const id = useId().replace(/:/g, "");
  // The crack: a jagged line down the middle of the seal.
  const crack = "M50 4 L46 18 L54 30 L45 44 L55 56 L47 70 L53 84 L50 96";
  const along = crack.replace(/^M/, "L");
  const leftClip = `M-10 -10 L50 -10 ${along} L50 110 L-10 110 Z`;
  const rightClip = `M110 -10 L50 -10 ${along} L50 110 L110 110 Z`;
  const wax = (
    <>
      <path
        d="M50 3c6 0 8 4 13 5s10-1 13 3 1 9 4 13 8 6 8 11-4 8-4 13 4 9 2 13-7 5-9 9-1 10-5 12-9-1-13 1-6 7-12 7-8-5-13-6-10 2-13-2-1-9-4-13-8-5-9-10 3-8 3-13-5-9-2-13 7-5 9-9 1-10 5-12 9 1 13-1 6-7 12-7z"
        fill={`url(#g${id})`}
        stroke="#7a4f00"
        strokeOpacity="0.7"
        strokeWidth="1.2"
      />
      <circle cx="50" cy="50" r="27" fill="none" stroke="#7a4f00" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="22" fill="none" stroke="#fff3c4" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 3" />
      <circle cx="50" cy="44" r="6.5" fill="#5c3d00" />
      <path d="M46.5 48l-2.5 13h12l-2.5-13z" fill="#5c3d00" />
    </>
  );
  return (
    <svg
      className={`wax-seal${broken ? " broken" : ""}`}
      width={size}
      height={size}
      viewBox="-8 -8 116 116"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        <radialGradient id={`g${id}`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.45" stopColor="#f4b728" />
          <stop offset="1" stopColor="#b77c06" />
        </radialGradient>
        <clipPath id={`l${id}`}>
          <path d={leftClip} />
        </clipPath>
        <clipPath id={`r${id}`}>
          <path d={rightClip} />
        </clipPath>
      </defs>
      <g className="half left" clipPath={`url(#l${id})`}>
        {wax}
      </g>
      <g className="half right" clipPath={`url(#r${id})`}>
        {wax}
      </g>
      <path className="crack" d={crack} fill="none" stroke="#5c3d00" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
