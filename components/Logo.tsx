import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rotera-logo-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#rotera-logo-bg)" />
      <circle
        cx="256"
        cy="256"
        r="178"
        fill="none"
        stroke="#ffffff"
        strokeWidth="8"
        strokeDasharray="20 16"
        opacity="0.25"
      />
      <circle cx="394" cy="150" r="14" fill="#ffffff" opacity="0.6" />
      <text
        x="256"
        y="364"
        fontSize="300"
        fontWeight="800"
        fill="#ffffff"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        R
      </text>
    </svg>
  );
}
