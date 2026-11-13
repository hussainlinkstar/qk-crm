import styles from "@/app/(workspace)/pulse/pulse.module.css";

const STEPS = [
  {
    label: "Sources",
    title: "CRM · Network · Requirements · Assignments",
    detail: "Salesforce-style Tessiant records and staffing activity",
  },
  {
    label: "Knowledge block",
    title: "Tessiant knowledge module",
    detail: "Business question this block is configured to answer",
  },
  {
    label: "Intelligence",
    title: "Rules & processing",
    detail: "Deterministic signals over verified capacity and demand",
  },
  {
    label: "Insights",
    title: "Recommendations",
    detail: "Reviewable findings with evidence and suggested next steps",
  },
  {
    label: "Actions",
    title: "Approved to-dos",
    detail: "Accepted insights become tracked operational work",
  },
  {
    label: "Value",
    title: "Recorded outcomes",
    detail: "Pipeline, agreed, realised and savings kept separate",
  },
] as const;

export default function KnowledgeFlow({
  blockTitle,
  sources = [],
  variant = "default",
}: {
  blockTitle: string;
  sources?: readonly string[];
  variant?: "default" | "overview";
}) {
  if (variant === "overview") {
    const visibleSources = sources.slice(0, 7);
    return (
      <div className={styles.workerFlow} aria-label={`How ${blockTitle} produces intelligence`}>
        <div className={styles.workerFlowLabels} aria-hidden>
          <span>Systems / sources</span>
          <span>Knowledge block</span>
          <span>Insights</span>
          <span>Outcomes</span>
        </div>
        <div className={styles.workerFlowTrack}>
          <div className={styles.workerFlowSources}>
            {visibleSources.map((source) => (
              <span key={source}>{source}</span>
            ))}
          </div>
          <div className={styles.workerFlowConnector} aria-hidden />
          <div className={styles.workerFlowNode} data-kind="worker">
            <span className={styles.workerFlowIcon}>Q</span>
            <span>
              <b>{blockTitle}</b>
              <small>Worker · grounded intelligence</small>
            </span>
          </div>
          <div className={styles.workerFlowConnector} aria-hidden />
          <div className={styles.workerFlowNode} data-kind="insight">
            <b>Surfaces</b>
            <small>Insights</small>
          </div>
          <div className={styles.workerFlowConnector} aria-hidden />
          <div className={styles.workerFlowNode} data-kind="outcome">
            <b>Tracked</b>
            <small>Outcomes</small>
          </div>
        </div>
        <p className={styles.workerFlowNote}>
          Sources on the left power this worker. Insights remain reviewable, and only approved actions create tracked outcomes.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.flowDiagram} aria-label="How this knowledge block produces intelligence">
      <div className={styles.flowRow}>
        {STEPS.slice(0, 3).map((step, index) => (
          <div key={step.label} className={`${styles.flowNode} ${index === 1 ? styles.flowNodePrimary : ""}`}>
            <label>{step.label}</label>
            <b>{index === 1 ? blockTitle : step.title}</b>
            <small>{step.detail}</small>
          </div>
        ))}
      </div>
      <div className={styles.flowArrow} aria-hidden>
        ↓
      </div>
      <div className={styles.flowRow}>
        {STEPS.slice(3).map((step) => (
          <div key={step.label} className={styles.flowNode}>
            <label>{step.label}</label>
            <b>{step.title}</b>
            <small>{step.detail}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
