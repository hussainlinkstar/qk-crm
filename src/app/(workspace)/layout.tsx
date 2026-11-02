import { Suspense } from "react";
import AppShell, { ShellSplash } from "@/components/shell/AppShell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSplash />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
