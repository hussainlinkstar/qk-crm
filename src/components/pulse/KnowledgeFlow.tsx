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

export default function KnowledgeFlow({ blockTitle }: { blockTitle: string }) {
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
