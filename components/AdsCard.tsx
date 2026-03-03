"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * 広告専用カードのスケルトン。
 * 後から Google AdSense のコードを差し込むためのプレースホルダーです。
 * デザインを崩さないよう、タスクカードと同じ rounded-2xl / shadow-sm で統一。
 */
export function AdsCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden",
        "min-h-[120px] flex items-center justify-center",
        "border-l-4 border-l-slate-200",
        className
      )}
      data-ad-slot
      aria-label="Advertisement"
    >
      {/* 後で Google AdSense の script / ins をここに差し込む */}
      <div className="w-full h-[120px] flex items-center justify-center bg-slate-50/50 text-slate-400 text-xs">
        Ad
      </div>
    </div>
  );
}
