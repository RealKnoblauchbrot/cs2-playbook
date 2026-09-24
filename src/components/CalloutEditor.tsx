import type { Draft } from "immer";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Group, Image as KImage, Label, Layer, Stage, Tag, Text } from "react-konva";
import { getMap, radarUrl } from "../data/maps";
import { useImage } from "../lib/images";
import { measureText } from "./board/objects";
import { useSize } from "../lib/hooks";
import { newId } from "../model/factory";
import { builtinCallouts, getCallouts } from "../model/selectors";
import type { Callout, LevelId } from "../model/types";
import { updatePb, usePlaybook } from "../store/playbook";
import { confirmDialog, Segmented } from "./ui";

const S = 1024;

export function CalloutEditor({ mapId }: { mapId: string }) {
  const { t } = useTranslation();
  const pb = usePlaybook((s) => s.pb)!;
  const def = getMap(mapId)!;
  const callouts = useMemo(() => getCallouts(pb, mapId), [pb, mapId]);
  const custom = pb.maps.find((m) => m.id === mapId)?.callouts != null;
  const [level, setLevel] = useState<LevelId>("default");
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const radar = useImage(radarUrl(mapId, level));
  const [wrapRef, size] = useSize<HTMLDivElement>();

  const edit = (fn: (list: Draft<Callout>[]) => void, coalesce?: string) =>
    updatePb((d) => {
      const m = d.maps.find((x) => x.id === mapId);
      if (!m) return;
      m.callouts ??= builtinCallouts(mapId);
      fn(m.callouts);
    }, { coalesce });

  const reset = async () => {
    if (!(await confirmDialog({ title: t("callouts.resetConfirm"), danger: true, okLabel: t("callouts.reset") }))) return;
    updatePb((d) => {
      const m = d.maps.find((x) => x.id === mapId);
      if (m) m.callouts = null;
    });
  };

  const dim = Math.min(size.width, 760);
  const scale = dim / S;
  const shown = callouts.filter((c) => c.level === level);
  const listed = callouts.filter((c) => c.level === level && c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0, 760px) 1fr", gap: 18, alignItems: "start" }}>
      <div ref={wrapRef} className="card" style={{ overflow: "hidden", background: "#070a0e", position: "relative" }}>
        {dim > 0 && (
          <Stage
            width={dim}
            height={dim}
            style={{ cursor: adding ? "crosshair" : "default" }}
            onMouseDown={(e) => {
              if (!adding) {
                if (e.target.getClassName() === "Image") setSel(null);
                return;
              }
              const pos = e.target.getStage()!.getPointerPosition()!;
              const c: Callout = { id: newId(), name: t("callouts.newName"), x: pos.x / dim, y: pos.y / dim, level };
              edit((l) => void l.push(c));
              setSel(c.id);
              setAdding(false);
            }}
          >
            <Layer>
              <Group scaleX={scale} scaleY={scale}>
                {radar && <KImage image={radar} width={S} height={S} />}
                {shown.map((c) => (
                  <Label
                    key={c.id}
                    x={c.x * S}
                    y={c.y * S}
                    offsetX={measureText(c.name, 13, "600") / 2 + 3}
                    offsetY={10}
                    draggable
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      setSel(c.id);
                    }}
                    onDragEnd={(e) => {
                      // offset keeps the label centered, so x/y is the callout point itself
                      const x = e.target.x() / S;
                      const y = e.target.y() / S;
                      edit((l) => {
                        const it = l.find((i) => i.id === c.id);
                        if (it) Object.assign(it, { x, y });
                      });
                    }}
                  >
                    <Tag fill={sel === c.id ? "#29b6f6" : "rgba(6,10,15,0.75)"} cornerRadius={3} />
                    <Text text={c.name} fontSize={13} padding={3} fill={sel === c.id ? "#04121c" : "#e6edf3"} fontStyle="600" />
                  </Label>
                ))}
              </Group>
            </Layer>
          </Stage>
        )}
      </div>

      <div className="col" style={{ gap: 10 }}>
        <div className="row wrap">
          {def.levels.length > 1 && (
            <Segmented<LevelId> size="sm" value={level} onChange={setLevel} options={def.levels.map((l) => ({ value: l.id, label: t(`levels.${l.id}`) }))} />
          )}
          <button className={`btn sm ${adding ? "active" : ""}`} onClick={() => setAdding(!adding)}>
            <Plus size={14} /> {adding ? t("callouts.clickMap") : t("callouts.add")}
          </button>
          <div className="spacer" />
          {custom && (
            <button className="btn sm ghost" onClick={reset}>
              <RotateCcw size={14} /> {t("callouts.reset")}
            </button>
          )}
        </div>
        <div className="muted small">{t("callouts.hint")}</div>
        <input className="input sm" placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="card" style={{ maxHeight: 560, overflow: "auto" }}>
          {listed.map((c) => (
            <div
              key={c.id}
              className="row"
              style={{ padding: "5px 8px", borderBottom: "1px solid var(--border)", background: sel === c.id ? "var(--panel-2)" : undefined }}
              onClick={() => setSel(c.id)}
            >
              <input
                className="input sm ghost grow"
                value={c.name}
                onChange={(e) =>
                  edit((l) => {
                    const it = l.find((i) => i.id === c.id);
                    if (it) it.name = e.target.value;
                  }, `callout-${c.id}`)
                }
              />
              <button className="btn icon sm ghost" onClick={() => edit((l) => void l.splice(l.findIndex((i) => i.id === c.id), 1))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {listed.length === 0 && <div className="muted small" style={{ padding: 12 }}>{t("callouts.none")}</div>}
        </div>
      </div>
    </div>
  );
}
