"use client";

import { useEffect } from "react";
import { flushDue } from "@/lib/signal-growth/store";

export default function GrowthBoot({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    flushDue();
  }, []);
  return children;
}
