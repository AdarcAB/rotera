"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 70;
const MAX_PULL = 140;

export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (window.scrollY !== 0) return;
      startYRef.current = e.touches[0]?.clientY ?? null;
      activeRef.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (refreshing) return;
      if (startYRef.current === null) return;
      if (window.scrollY !== 0) {
        startYRef.current = null;
        setPull(0);
        return;
      }
      const dy = (e.touches[0]?.clientY ?? 0) - startYRef.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      activeRef.current = true;
      // Rubber-band the pull distance
      const eased = Math.min(MAX_PULL, dy * 0.6);
      setPull(eased);
    };
    const onTouchEnd = () => {
      if (refreshing) return;
      const reached = pull >= THRESHOLD && activeRef.current;
      startYRef.current = null;
      activeRef.current = false;
      if (reached) {
        setRefreshing(true);
        setPull(THRESHOLD);
        // Give the indicator a frame to render, then refresh
        setTimeout(() => {
          router.refresh();
          setTimeout(() => {
            setRefreshing(false);
            setPull(0);
          }, 600);
        }, 80);
      } else {
        setPull(0);
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull, refreshing, router]);

  const visible = pull > 0 || refreshing;
  const progress = Math.min(1, pull / THRESHOLD);
  const spinning = refreshing || pull >= THRESHOLD;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        transform: `translate(-50%, ${Math.max(-30, pull - 30)}px)`,
        transition: refreshing || pull === 0 ? "transform 200ms ease" : "none",
        zIndex: 40,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="mt-2 bg-white border border-border shadow-sm rounded-full w-10 h-10 flex items-center justify-center"
        style={{
          opacity: Math.max(0.4, progress),
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#16a34a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: spinning
              ? "rotate(360deg)"
              : `rotate(${progress * 270}deg)`,
            animation: refreshing ? "rotera-ptr-spin 0.9s linear infinite" : "none",
            transition: refreshing ? "none" : "transform 120ms",
          }}
        >
          <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.3-2.6L3 17" />
          <path d="M3 17v-5h5" />
        </svg>
      </div>
      <style>{`
        @keyframes rotera-ptr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
