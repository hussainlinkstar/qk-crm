import type { Metadata } from "next";
import { Suspense } from "react";
import ConfirmView from "./ConfirmView";

export const metadata: Metadata = { title: "Confirm your availability" };

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmView />
    </Suspense>
  );
}
