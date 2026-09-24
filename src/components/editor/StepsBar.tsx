import { ChevronLeft, ChevronRight, CopyPlus, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Step } from "../../model/types";

interface Props {
  steps: Step[];
  index: number;
  playing: boolean;
  readOnly?: boolean;
  onSelect(i: number): void;
  onAdd(): void;
  onDuplicate(): void;
  onDelete(i: number): void;
  onRename(i: number): void;
  onMove(from: number, to: number): void;
  onPlay(): void;
  onStop(): void;
}

export function StepsBar(p: Props) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState<number | null>(null);
  return (
    <div className="steps-bar">
      <button className="btn icon sm" title={t("steps.prev")} disabled={p.index === 0} onClick={() => p.onSelect(p.index - 1)}>
        <ChevronLeft size={16} />
      </button>
      <button
        className={`btn sm ${p.playing ? "active" : ""}`}
        title={t("steps.playHint")}
        onClick={p.playing ? p.onStop : p.onPlay}
        disabled={p.steps.length < 2}
      >
        {p.playing ? <Pause size={14} /> : <Play size={14} />} {p.playing ? t("steps.stop") : t("steps.play")}
      </button>
      <button
        className="btn icon sm"
        title={t("steps.next")}
        disabled={p.index >= p.steps.length - 1}
        onClick={() => p.onSelect(p.index + 1)}
      >
        <ChevronRight size={16} />
      </button>
      <div style={{ width: 1, height: 26, background: "var(--border)", margin: "0 4px" }} />
      {p.steps.map((s, i) => (
        <button
          key={s.id}
          className={`step-chip ${i === p.index ? "on" : ""} ${drag === i ? "dragging" : ""}`}
          onClick={() => p.onSelect(i)}
          onDoubleClick={() => !p.readOnly && p.onRename(i)}
          draggable={!p.readOnly}
          onDragStart={() => setDrag(i)}
          onDragEnd={() => setDrag(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (drag != null && drag !== i) p.onMove(drag, i);
            setDrag(null);
          }}
          title={t("steps.renameHint")}
        >
          <span className="n">{i + 1}</span>
          {s.name || t("steps.untitled")}
        </button>
      ))}
      {!p.readOnly && (
        <>
          <button className="btn sm" onClick={p.onAdd} title={t("steps.addHint")}>
            <Plus size={14} /> {t("steps.add")}
          </button>
          <button className="btn icon sm ghost" onClick={p.onDuplicate} title={t("steps.duplicate")}>
            <CopyPlus size={15} />
          </button>
          <button
            className="btn icon sm ghost danger"
            onClick={() => p.onDelete(p.index)}
            disabled={p.steps.length < 2}
            title={t("steps.delete")}
          >
            <Trash2 size={15} />
          </button>
        </>
      )}
    </div>
  );
}
