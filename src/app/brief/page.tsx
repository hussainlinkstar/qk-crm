import type { Metadata } from "next";
import { Suspense } from "react";
import BriefView from "./BriefView";

export const metadata: Metadata = { title: "Morning brief" };

export default function BriefPage() {
  return (
    <Suspense fallback={null}>
      <BriefView />
    </Suspense>
  );
}
