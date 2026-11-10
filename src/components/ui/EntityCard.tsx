"use client";

import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import Icon from "./Icon";
import styles from "./EntityCard.module.css";

type CommonProps = {
  title: string;
  subtitle?: string;
  metric?: string;
  hint?: string;
  meta?: ReactNode;
  onOpen?: () => void;
  className?: string;
};

type BoardCardProps = CommonProps & {
  variant?: "board";
  draggable?: boolean;
  dragData?: { type: string; id: string };
};

type ListRowProps = CommonProps & {
  variant: "list";
  trail?: ReactNode;
};

export type EntityCardProps = BoardCardProps | ListRowProps;

export default function EntityCard(props: EntityCardProps) {
  const { title, subtitle, metric, hint, meta, onOpen, className } = props;
  const isList = props.variant === "list";

  const activate = () => onOpen?.();

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  };

  if (isList) {
    return (
      <button
        type="button"
        className={`${styles.listRow} ${className ?? ""}`}
        onClick={activate}
        onKeyDown={onKeyDown}
      >
        <span className={styles.listMain}>
          <span className={styles.title}>{title}</span>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
          {hint ? <span className={styles.hint}>{hint}</span> : null}
        </span>
        <span className={styles.listSide}>{meta}</span>
        {metric ? <span className={styles.listMetric}>{metric}</span> : <span />}
        <span className={styles.listTrail}>
          {props.trail}
          <Icon name="chevronRight" size={14} />
        </span>
      </button>
    );
  }

  const dragData = props.dragData;
  const onDragStart = (event: DragEvent<HTMLElement>) => {
    if (!dragData) return;
    event.dataTransfer.setData(dragData.type, dragData.id);
    event.dataTransfer.effectAllowed = "move";
    event.currentTarget.dataset.dragging = "true";
  };

  const onDragEnd = (event: DragEvent<HTMLElement>) => {
    delete event.currentTarget.dataset.dragging;
  };

  const stopDragClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a,button,select,input")) return;
  };

  return (
    <article
      className={`${styles.card} ${props.draggable ? styles.grab : ""} ${className ?? ""}`}
      draggable={Boolean(props.draggable && dragData)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        stopDragClick(event);
        activate();
      }}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className={styles.top}>
        <span className={styles.title}>{title}</span>
        {metric ? <span className={styles.metric}>{metric}</span> : null}
      </div>
      {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      {meta ? <div className={styles.meta}>{meta}</div> : null}
      {hint ? <div className={styles.hint}>{hint}</div> : null}
    </article>
  );
}
