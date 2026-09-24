import type { Draft } from "immer";
import { ArrowLeft, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Board, DEFAULT_VIEW, type View } from "../components/board/Board";
import { lineupToObj, MediaThumb } from "../components/LineupsView";
import { confirmDialog, Empty, Field, Segmented, TagInput } from "../components/ui";
import { UTILITY_KINDS } from "../data/equipment";
import { getMap, levelForZ, mapIconUrl, parseSetpos, worldToRadar } from "../data/maps";
import { useSize } from "../lib/hooks";
import { MEDIA_ACCEPT, pickFiles, putMediaFile } from "../lib/media";
import { getCallouts } from "../model/selectors";
import type { LevelId, Lineup, Side, ThrowTechnique, UtilityKind, UtilityObj } from "../model/types";
import { updatePb, usePlaybook } from "../store/playbook";
import { useSettings } from "../store/settings";
import { toast } from "../store/toast";

export const TECHNIQUES: ThrowTechnique[] = ["left", "right", "left-right", "jump", "run-jump", "walk-jump", "crouch", "run", "walk"];

export default function LineupEditor() {
  const { lineupId } = useParams();
  const { t } = useTranslation();
  const lineup = usePlaybook((s) => s.pb!.lineups.find((l) => l.id === lineupId));
  if (!lineup) return <div className="page"><Empty title={t("lineups.notFound")} /></div>;
  return <Editor lineup={lineup} />;
}

function Editor({ lineup }: { lineup: Lineup }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const pb = usePlaybook((s) => s.pb)!;
  const settings = useSettings();
  const map = getMap(lineup.mapId);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [wrapRef, size] = useSize<HTMLDivElement>();
  const [selected, setSelected] = useState(true);
  const [setposDraft, setSetposDraft] = useState(lineup.setpos);

  const upd = (fn: (l: Draft<Lineup>) => void, coalesce?: string) =>
    updatePb(
      (d) => {
        const l = d.lineups.find((x) => x.id === lineup.id);
        if (!l) return;
        fn(l);
        l.updatedAt = Date.now();
      },
      { coalesce },
    );

  const addFiles = async (files: File[]) => {
    const ids: string[] = [];
    for (const f of files) {
      if (f.size > 200 * 1024 * 1024) {
        toast.error(t("lineups.tooBig", { name: f.name }));
        continue;
      }
      ids.push(await putMediaFile(f));
    }
    if (ids.length) upd((l) => void l.media.push(...ids.filter((id) => !l.media.includes(id))));
  };

  // Paste screenshots straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const applySetpos = (text: string) => {
    setSetposDraft(text);
    const pos = parseSetpos(text);
    upd((l) => void (l.setpos = text), "setpos");
    if (pos && map) {
      const p = worldToRadar(map, pos.x, pos.y);
      if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) {
        upd((l) => {
          l.throwPos = p;
          l.level = levelForZ(map, pos.z);
        });
        toast.success(t("lineups.setposApplied"));
      }
    }
  };

  const del = async () => {
    if (!(await confirmDialog({ title: t("lineups.deleteConfirm"), danger: true, okLabel: t("common.delete") }))) return;
    nav(`/map/${lineup.mapId}?tab=lineups`);
    updatePb((d) => {
      d.lineups = d.lineups.filter((l) => l.id !== lineup.id);
      for (const tac of d.tactics)
        for (const s of tac.steps)
          for (const o of s.objects) if (o.kind === "utility" && o.lineupId === lineup.id) o.lineupId = null;
    });
  };

  const obj = lineupToObj(lineup);
  const usedIn = pb.tactics.filter((tac) => tac.steps.some((s) => s.objects.some((o) => o.kind === "utility" && o.lineupId === lineup.id)));

  return (
    <div className="editor">
      <div className="editor-top">
        <button className="btn ghost icon" onClick={() => nav(-1)}>
          <ArrowLeft size={18} />
        </button>
        <img src={mapIconUrl(lineup.mapId)} alt="" style={{ width: 26, height: 26 }} />
        <input
          className="input ghost title name-input"
          value={lineup.name}
          placeholder={t("lineups.namePh")}
          onChange={(e) => upd((l) => void (l.name = e.target.value), `name-${lineup.id}`)}
          autoFocus={!lineup.name}
        />
        <Segmented<Side | "both">
          size="sm"
          value={lineup.side}
          onChange={(v) => upd((l) => void (l.side = v))}
          options={[
            { value: "T", label: "T", className: "t" },
            { value: "CT", label: "CT", className: "ct" },
            { value: "both", label: t("common.both") },
          ]}
        />
        <div className="spacer" />
        <button className="btn sm danger" onClick={del}>
          <Trash2 size={14} /> {t("common.delete")}
        </button>
      </div>
      <div className="editor-body" style={{ gridTemplateColumns: "1fr 400px" }}>
        <div className="board-wrap" ref={wrapRef}>
          {size.width > 0 && (
            <Board
              mapId={lineup.mapId}
              level={lineup.level}
              side={lineup.side === "CT" ? "CT" : "T"}
              objects={[obj]}
              slots={[]}
              players={[]}
              width={size.width}
              height={size.height}
              callouts={settings.showCallouts ? getCallouts(pb, lineup.mapId) : null}
              tokenStyle={settings.tokenStyle}
              tokenScale={1}
              view={view}
              onViewChange={setView}
              interaction={{
                editable: true,
                objectsListen: true,
                panOnBackground: true,
                selectedIds: new Set(selected ? [lineup.id] : []),
                onBackgroundDown: () => setSelected(true),
                onObjectDown: () => setSelected(true),
                onObjectChange: (_id, patch) => {
                  const p = patch as Partial<UtilityObj>;
                  upd((l) => {
                    if (p.x != null && p.y != null) l.landPos = { x: p.x, y: p.y };
                    if (p.from) l.throwPos = p.from;
                  });
                },
              }}
            />
          )}
          <div className="overlay tl">
            <div className="glass hint">{t("lineups.dragHint")}</div>
          </div>
          {map && map.levels.length > 1 && (
            <div className="overlay tr">
              <div className="glass">
                <Segmented<LevelId>
                  size="sm"
                  value={lineup.level}
                  onChange={(v) => upd((l) => void (l.level = v))}
                  options={map.levels.map((l) => ({ value: l.id, label: t(`levels.${l.id}`) }))}
                />
              </div>
            </div>
          )}
        </div>
        <div className="side-panel">
          <div className="panel-body">
            <div className="row">
              <Field label={t("editor.utility")} style={{ flex: 1 }}>
                <select className="select sm" value={lineup.util} onChange={(e) => upd((l) => void (l.util = e.target.value as UtilityKind))}>
                  {UTILITY_KINDS.map((u) => (
                    <option key={u} value={u}>
                      {t(`util.${u}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("lineups.technique")} style={{ flex: 1 }}>
                <select className="select sm" value={lineup.technique} onChange={(e) => upd((l) => void (l.technique = e.target.value as ThrowTechnique))}>
                  {TECHNIQUES.map((x) => (
                    <option key={x} value={x}>
                      {t(`technique.${x}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t("lineups.description")}>
              <textarea
                className="textarea"
                style={{ minHeight: 110 }}
                placeholder={t("lineups.descriptionPh")}
                value={lineup.description}
                onChange={(e) => upd((l) => void (l.description = e.target.value), `desc-${lineup.id}`)}
              />
            </Field>
            <Field label={t("lineups.setpos")}>
              <input className="input sm mono" placeholder="setpos x y z;setang p y r" value={setposDraft} onChange={(e) => applySetpos(e.target.value)} />
              <span className="muted small">{t("lineups.setposHint")}</span>
            </Field>
            <Field label={t("tactic.tags")}>
              <TagInput value={lineup.tags} onChange={(v) => upd((l) => void (l.tags = v))} />
            </Field>
            <Field label={t("lineups.media")}>
              <div className="lineup-media">
                {lineup.media.map((m) => (
                  <div key={m} style={{ position: "relative" }}>
                    <MediaThumb id={m} />
                    <button
                      className="btn icon sm"
                      style={{ position: "absolute", top: 4, right: 4 }}
                      onClick={() => upd((l) => void (l.media = l.media.filter((x) => x !== m)))}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={async () => addFiles(await pickFiles(MEDIA_ACCEPT, true))}>
                <ImagePlus size={14} /> {t("lineups.addMedia")}
              </button>
              <span className="muted small">{t("lineups.pasteHint")}</span>
            </Field>
            {usedIn.length > 0 && (
              <Field label={t("lineups.usedIn")}>
                <div className="col" style={{ gap: 4 }}>
                  {usedIn.map((tac) => (
                    <a key={tac.id} onClick={() => nav(`/tactic/${tac.id}`)} style={{ cursor: "pointer" }}>
                      {tac.name}
                    </a>
                  ))}
                </div>
              </Field>
            )}
          </div>
        </div>
      </div>
      <div />
    </div>
  );
}
