import type { Metadata } from "next";
import GrowthBoot from "@/components/growth/GrowthBoot";

export const metadata: Metadata = { title: "Signal growth" };

export default function GrowthLayout({ children }: { children: React.ReactNode }) {
  return <GrowthBoot>{children}</GrowthBoot>;
}
