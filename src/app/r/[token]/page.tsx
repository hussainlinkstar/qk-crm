"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { OutcomeGrid, PageHero, WorkPanel } from "@/components/ui/workspace";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import signal from "@/app/(workspace)/growth/signal.module.css";

function pdf(lines: string[]) {
  const safe = lines.map((line) => line.replace(/[^\x20-\x7E]/g, " ").replace(/[()\\]/g, "\\$&"));
  const stream = safe.map((line, index) => `BT /F1 12 Tf 48 ${740 - index * 18} Td (${line}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
    "2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj\n",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj\n`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  body += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([body], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "signal-audit.pdf";
  link.click();
  URL.revokeObjectURL(url);
}

function ReportPage() {
  const params = useParams<{ token: string }>();
  const state = useGrowth();
  const [message, setMessage] = useState("");
  const lead = state?.leads.find((item) => item.audit?.token === params.token);

  useEffect(() => {
    if (params.token) growth.markViewed(params.token);
  }, [params.token]);

  if (!state) return <main className={signal.report}><p className="subtitle">Loading the report…</p></main>;
  if (!lead?.audit || lead.audit.unreadable) {
    return (
      <main className={signal.report}>
        <PageHero kicker="Qiko Signal" title="This report is not available" lede="It was held because the site could not be read." />
      </main>
    );
  }

  const audit = lead.audit;
  return (
    <main className={signal.report}>
      <PageHero kicker="Qiko Signal · free report" title={lead.company} lede={lead.website} />
      {message && <div className="demo-banner" role="status">{message}</div>}
      <OutcomeGrid
        label="Scores"
        tiles={[
          { key: "aio", label: "AIO", value: audit.aio ?? "—", sub: "Answer engine", icon: "sparkles", iconTone: "qiko", tone: "qiko" },
          { key: "seo", label: "SEO", value: audit.seo ?? "—", sub: "Search", icon: "search", iconTone: "brand", tone: "brand" },
        ]}
      />
      <WorkPanel id="holding" title="What is holding you back">
        <p>{audit.topProblem}</p>
        <h3 style={{ marginTop: 16, fontSize: 15 }}>Fixes you can see</h3>
        <ol>{audit.fixes.slice(0, 6).map((fix) => <li key={fix}>{fix}</li>)}</ol>
        <div className={signal.locked} aria-hidden="true">
          <p>The remaining {audit.lockedCount} fixes, the page-by-page notes, and the questions you lost.</p>
        </div>
        <div className="page-actions" style={{ marginTop: 16 }}>
          <Button
            variant="secondary"
            onClick={() => {
              pdf([`${lead.company} Signal audit`, `AIO ${audit.aio ?? "-"}`, `SEO ${audit.seo ?? "-"}`, audit.topProblem, ...audit.fixes.slice(0, 6)]);
              growth.downloadAudit(lead.id);
            }}
          >
            Download PDF
          </Button>
          <Button onClick={() => setMessage(growth.claimReport(params.token))}>Claim your full report</Button>
          <Link href="/login?next=/growth" className="text-link">Sign in to the workspace</Link>
        </div>
      </WorkPanel>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className={signal.report}><p className="subtitle">Loading the report…</p></main>}>
      <ReportPage />
    </Suspense>
  );
}
