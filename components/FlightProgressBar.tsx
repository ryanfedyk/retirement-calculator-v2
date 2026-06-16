"use client";
import { Plane } from "lucide-react";
import { C } from "@/config/colors";

interface Props { progress: number; retirementDate: Date; startYear: number; }

export default function FlightProgressBar({ progress, retirementDate, startYear }: Props) {
  return (
    <div style={{ background: C.bgCard, borderBottom: `1px solid ${C.border}` }} className="px-8 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3 text-[10px] uppercase tracking-widest"
             style={{ color: C.inkFaint }}>
          <span>{startYear}</span>
          <span>Corporate Journey</span>
          <span>{retirementDate.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}</span>
        </div>
        <div className="relative h-px" style={{ background: C.border }}>
          <div className="absolute top-0 left-0 h-full transition-all duration-1000"
               style={{ width: `${progress}%`, background: C.tealDark }} />
          <div className="absolute -top-2.5 transition-all duration-1000"
               style={{ left: `calc(${progress}% - 8px)` }}>
            <Plane size={14} style={{ color: C.teal, fill: C.teal }} />
          </div>
        </div>
        <div className="flex justify-center mt-3">
          <span style={{ color: C.inkSoft }} className="text-[11px]">{progress}% of the journey behind you</span>
        </div>
      </div>
    </div>
  );
}
