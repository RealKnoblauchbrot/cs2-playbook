import type { Draft } from "immer";
import {
  ArrowLeft,
  ClipboardCopy,
  Download,
  Layers,
  Maximize,
  MonitorPlay,
  PenSquare,
  Redo2,
  Share2,
  Tags,
  Undo2,
  UserSquare,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Board, DEFAULT_VIEW, type BoardHandle, type View } from "../components/board/Board";
import { CARRY_OVER, TOOL_KEYS, type Tool } from "../components/board/tools";
import { PresentTable } from "../components/editor/PresentTable";
import { SidePanel, type PanelTab } from "../components/editor/SidePanel";
import { StepsBar } from "../components/editor/StepsBar";
import { Toolbar } from "../components/editor/Toolbar";
import { ToolOptions } from "../components/editor/ToolOptions";
import { DEFAULT_STYLE, useBoardTools, type ToolStyle } from "../components/editor/useBoardTools";
import { LineupDetails } from "../components/LineupsView";
import { confirmDialog, Empty, Modal, promptDialog, Segmented } from "../components/ui";
import { openExportDialog } from "../components/share/ExportDialog";
import { getMap, mapIconUrl } from "../data/maps";
import { copyTacticImage, saveTacticImage } from "../lib/exportImage";
import { useHotkeys, useSize } from "../lib/hooks";
import { cloneTactic, newId, newStep } from "../model/factory";
import { getCallouts } from "../model/selectors";
import type { BoardObject, ID, LevelId, Side, Step, Tactic } from "../model/types";
import { updatePb, usePb, usePlaybook } from "../store/playbook";
import { useSettings } from "../store/settings";
import { toast } from "../store/toast";

const TRANSITION_MS = 850;
const HOLD_MS = 1300;

export default function TacticEditor() {
  const { tacticId } = useParams();
  const tactic = usePb((pb) => pb.tactics.find((t) => t.id === tacticId));
  const { t } = useTranslation();
  if (!tactic) return <div className="page"><Empty title={t("tactic.notFound")} /></div>;
  return <Editor key={tactic.id} tactic={tactic} />;
}

function Editor({ tactic }: { tactic: Tactic }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const pb = usePlaybook((s) => s.pb)!;
  const canUndo = usePlaybook((s) => s.past.length > 0);
  const canRedo = usePlaybook((s) => s.future.length > 0);
  const settings = useSettings();
  const map = getMap(tactic.mapId);

  const [stepIdx, setStepIdx] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [style, setStyleState] = useState<ToolStyle>(DEFAULT_STYLE);
  const [selected, setSelected] = useState<Set<ID>>(new Set());
  const [level, setLevel] = useState<LevelId>("default");
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [armedSlot, setArmedSlot] = useState<ID | null>(tactic.slots[0]?.id ?? null);
  const [tab, setTab] = useState<PanelTab>("players");
  const [present, setPresent] = useState(false);
  const [anim, setAnim] = useState<{ prev: BoardObject[]; progress: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [lineupView, setLineupView] = useState<ID | null>(null);
  const boardRef = useRef<BoardHandle>(null);
  const [wrapRef, size] = useSize<HTMLDivElement>();

  const safeIdx = Math.min(stepIdx, tactic.steps.length - 1);
  const step = tactic.steps[safeIdx];
  const callouts = useMemo(() => (settings.showCallouts ? getCallouts(pb, tactic.mapId) : null), [pb, tactic.mapId, settings.showCallouts]);

  // ---------------------------------------------------------------- mutations

  const updTactic = useCallback(
    (fn: (d: Draft<Tactic>) => void, coalesce?: string) =>
      updatePb(
        (d) => {
          const tt = d.tactics.find((x) => x.id === tactic.id);
          if (!tt) return;
          fn(tt);
          tt.updatedAt = Date.now();
        },
        { coalesce },
      ),
    [tactic.id],
  );

  const updStep = useCallback(
    (fn: (s: Draft<Step>) => void, coalesce?: string) =>
      updTactic((d) => {
        const s = d.steps.find((x) => x.id === step.id);
        if (s) fn(s);
      }, coalesce),
    [updTactic, step.id],
  );

  const addObject = (o: BoardObject) => updStep((s) => void s.objects.push(o));
  const changeObject = (id: ID, patch: Partial<BoardObject>, coalesce?: string) =>
    updStep((s) => {
      const o = s.objects.find((x) => x.id === id);
      if (o) Object.assign(o, patch);
    }, coalesce);
  const removeObjects = (ids: ID[]) => {
    const set = new Set(ids);
    updStep((s) => void (s.objects = s.objects.filter((o) => !set.has(o.id))));
    setSelected(new Set());
  };
  const duplicateSelected = () => {
    const copies = step.objects
      .filter((o) => selected.has(o.id) && o.kind !== "player")
      .map((o) => shiftObject({ ...structuredClone(o), id: newId() }, 0.02));
    if (!copies.length) return;
    updStep((s) => void s.objects.push(...copies));
    setSelected(new Set(copies.map((c) => c.id)));
  };

  // ---------------------------------------------------------------- steps

  const goStep = useCallback(
    (i: number, animate = present) => {
      if (i < 0 || i >= tactic.steps.length || i === safeIdx) return;
      setSelected(new Set());
      if (animate) setAnim({ prev: tactic.steps[safeIdx].objects, progress: 0 });
      setStepIdx(i);
    },
    [tactic.steps, safeIdx, present],
  );

  const addStep = (duplicateAll = false) => {
    const objs = step.objects.filter((o) => duplicateAll || CARRY_OVER.includes(o.kind)).map((o) => structuredClone(o));
    const s = { ...newStep(t("steps.defaultName", { n: tactic.steps.length + 1 })), objects: objs };
    updTactic((d) => void d.steps.splice(safeIdx + 1, 0, s));
    setStepIdx(safeIdx + 1);
    setSelected(new Set());
  };

  const deleteStep = async (i: number) => {
    if (tactic.steps.length < 2) return;
    if (!(await confirmDialog({ title: t("steps.deleteConfirm"), danger: true, okLabel: t("common.delete") }))) return;
    updTactic((d) => void d.steps.splice(i, 1));
    setStepIdx(Math.max(0, i - 1));
  };

  const renameStep = async (i: number) => {
    const name = await promptDialog({ title: t("steps.rename"), initial: tactic.steps[i].name });
    if (name != null) updTactic((d) => void (d.steps[i].name = name));
  };

  const moveStep = (from: number, to: number) => {
    updTactic((d) => {
      const [s] = d.steps.splice(from, 1);
      d.steps.splice(to, 0, s);
    });
    setStepIdx(to);
  };

  // ---------------------------------------------------------------- animation

  useEffect(() => {
    if (!anim || anim.progress >= 1) return;
    let raf = 0;
    const t0 = performance.now() - anim.progress * TRANSITION_MS;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - t0) / TRANSITION_MS);
      setAnim((a) => (a ? { ...a, progress } : a));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim?.prev]);

  useEffect(() => {
    if (!playing) return;
    if (anim && anim.progress < 1) return;
    if (safeIdx >= tactic.steps.length - 1) {
      const id = setTimeout(() => setPlaying(false), HOLD_MS);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => goStep(safeIdx + 1, true), HOLD_MS);
    return () => clearTimeout(id);
  }, [playing, anim, safeIdx, tactic.steps.length, goStep]);

  const play = () => {
    setSelected(new Set());
    setAnim(null);
    setStepIdx(0);
    setPlaying(true);
  };

  // ---------------------------------------------------------------- tools

  const armNext = (placed: ID) => {
    const order = tactic.slots.map((s) => s.id);
    const placedIds = new Set(step.objects.filter((o) => o.kind === "player").map((o) => (o as { slotId: ID }).slotId));
    placedIds.add(placed);
    const next = order.find((id) => !placedIds.has(id));
    setArmedSlot(next ?? placed);
  };

  const interaction = useBoardTools({
    tool,
    style,
    level,
    armedSlot,
    slots: tactic.slots,
    objects: step.objects,
    selected,
    setSelected,
    add: addObject,
    change: (id, patch) => changeObject(id, patch),
    remove: removeObjects,
    onPlayerPlaced: armNext,
    requestText: async (p) => {
      const text = await promptDialog({ title: t("tools.text") });
      if (text) addObject({ id: newId(), kind: "text", level, x: p.x, y: p.y, text, color: style.color, size: 18 });
    },
    onObjectSelected: () => setTab("object"),
  });

  const pickTool = (tl: Tool) => {
    setTool(tl);
    if (tl !== "select") setSelected(new Set());
  };

  useHotkeys(
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          duplicateSelected();
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size) {
        e.preventDefault();
        removeObjects([...selected]);
        return;
      }
      if (e.key === "Escape") {
        if (present) setPresent(false);
        setTool("select");
        setSelected(new Set());
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown") return goStep(safeIdx + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") return goStep(safeIdx - 1);
      if (e.key === " ") {
        e.preventDefault();
        return playing ? setPlaying(false) : play();
      }
      if (/^[1-5]$/.test(e.key)) {
        const slot = tactic.slots[Number(e.key) - 1];
        if (slot) setArmedSlot(slot.id);
        return;
      }
      if (present) return;
      const entry = Object.entries(TOOL_KEYS).find(([, k]) => k === e.key.toUpperCase());
      if (entry) pickTool(entry[0] as Tool);
    },
    [selected, step, safeIdx, present, playing, tactic],
  );

  // ---------------------------------------------------------------- actions

  const onDuplicateTactic = () => {
    const copy = cloneTactic(tactic, `${tactic.name} (${t("common.copy")})`);
    updatePb((d) => void d.tactics.push(copy));
    nav(`/tactic/${copy.id}`);
    toast.success(t("tactic.duplicated"));
  };

  const onDeleteTactic = async () => {
    if (!(await confirmDialog({ title: t("tactic.deleteConfirm", { name: tactic.name }), danger: true, okLabel: t("common.delete") }))) return;
    nav(`/map/${tactic.mapId}`);
    updatePb((d) => void (d.tactics = d.tactics.filter((x) => x.id !== tactic.id)));
  };

  const exportPng = async (copy: boolean) => {
    try {
      if (copy) {
        await copyTacticImage(pb, tactic, safeIdx);
        toast.success(t("export.copied"));
      } else if (await saveTacticImage(pb, tactic, safeIdx)) toast.success(t("export.saved"));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const selectedObjs = step.objects.filter((o) => selected.has(o.id));
  const openLinkedLineup = (id: ID) => {
    const o = step.objects.find((x) => x.id === id);
    if (o?.kind === "utility" && o.lineupId && pb.lineups.some((l) => l.id === o.lineupId)) setLineupView(o.lineupId);
  };
  const presentInteraction = {
    editable: false,
    objectsListen: true,
    selectedIds: new Set<ID>(),
    panOnBackground: true,
    onObjectDown: openLinkedLineup,
  };
  const shownLineup = pb.lineups.find((l) => l.id === lineupView);
  const undo = usePlaybook((s) => s.undo);
  const redo = usePlaybook((s) => s.redo);
  const hasLower = (map?.levels.length ?? 1) > 1;

  return (
    <div className="editor">
      <div className="editor-top">
        <button className="btn ghost icon" title={t("common.back")} onClick={() => nav(`/map/${tactic.mapId}`)}>
          <ArrowLeft size={18} />
        </button>
        <img src={mapIconUrl(tactic.mapId)} alt="" style={{ width: 26, height: 26 }} />
        {present ? (
          <h2 className="ellipsis" style={{ maxWidth: 360 }}>{tactic.name}</h2>
        ) : (
          <input
            className="input ghost title name-input"
            value={tactic.name}
            placeholder={t("tactic.namePh")}
            onChange={(e) => updTactic((d) => void (d.name = e.target.value), `name-${tactic.id}`)}
          />
        )}
        <Segmented<Side>
          size="sm"
          value={tactic.side}
          onChange={(v) => !present && updTactic((d) => void (d.side = v))}
          options={[
            { value: "T", label: "T", className: "t" },
            { value: "CT", label: "CT", className: "ct" },
          ]}
        />
        <span className="badge">{t(`tacticType.${tactic.type}`)}</span>
        <div className="spacer" />
        {!present && (
          <>
            <button className="btn icon sm ghost" title={`${t("common.undo")} (Ctrl+Z)`} disabled={!canUndo} onClick={undo}>
              <Undo2 size={16} />
            </button>
            <button className="btn icon sm ghost" title={`${t("common.redo")} (Ctrl+Y)`} disabled={!canRedo} onClick={redo}>
              <Redo2 size={16} />
            </button>
          </>
        )}
        <button className="btn sm" title={t("export.copyPngHint")} onClick={() => exportPng(true)}>
          <ClipboardCopy size={14} /> {t("export.copyPng")}
        </button>
        <button className="btn icon sm" title={t("export.savePng")} onClick={() => exportPng(false)}>
          <Download size={15} />
        </button>
        <button className="btn sm" title={t("export.shareHint")} onClick={() => openExportDialog({ tacticIds: [tactic.id] })}>
          <Share2 size={14} /> {t("export.share")}
        </button>
        <button className={`btn sm ${present ? "primary" : ""}`} onClick={() => { setPresent(!present); setTool("select"); setSelected(new Set()); }}>
          {present ? <PenSquare size={14} /> : <MonitorPlay size={14} />} {present ? t("editor.edit") : t("editor.present")}
        </button>
      </div>

      <div className={`editor-body ${present ? "present" : ""}`}>
        {!present && <Toolbar tool={tool} side={tactic.side} onTool={pickTool} />}
        <div style={{ display: "grid", gridTemplateRows: "1fr auto", minHeight: 0, minWidth: 0 }}>
          <div className="board-wrap" ref={wrapRef}>
            {size.width > 0 && (
              <Board
                ref={boardRef}
                mapId={tactic.mapId}
                level={level}
                side={tactic.side}
                objects={step.objects}
                slots={tactic.slots}
                players={pb.players}
                width={size.width}
                height={size.height}
                callouts={callouts}
                tokenStyle={settings.tokenStyle}
                tokenScale={settings.tokenScale}
                interaction={present ? presentInteraction : { ...interaction, onObjectDblClick: openLinkedLineup }}
                prevObjects={anim?.prev}
                progress={anim?.progress ?? 1}
                view={view}
                onViewChange={setView}
              />
            )}
            {!present && (
              <div className="overlay tl">
                <ToolOptions
                  tool={tool}
                  style={style}
                  onStyle={(s) => setStyleState((prev) => ({ ...prev, ...s }))}
                  slots={tactic.slots}
                  players={pb.players}
                  armedSlot={armedSlot}
                  onArm={setArmedSlot}
                />
              </div>
            )}
            <div className="overlay tr">
              <div className="glass">
                {hasLower && (
                  <Segmented<LevelId>
                    size="sm"
                    value={level}
                    onChange={setLevel}
                    options={map!.levels.map((l) => ({ value: l.id, label: <><Layers size={13} /> {t(`levels.${l.id}`)}</> }))}
                  />
                )}
                <button
                  className={`btn icon sm ghost ${settings.showCallouts ? "active" : ""}`}
                  title={t("editor.toggleCallouts")}
                  onClick={() => settings.set("showCallouts", !settings.showCallouts)}
                >
                  <Tags size={15} />
                </button>
                <button
                  className="btn icon sm ghost"
                  title={t("editor.toggleTokenStyle")}
                  onClick={() => settings.set("tokenStyle", settings.tokenStyle === "cutout" ? "avatar" : "cutout")}
                >
                  <UserSquare size={15} />
                </button>
                <button className="btn icon sm ghost" title={t("editor.resetView")} onClick={() => setView(DEFAULT_VIEW)}>
                  <Maximize size={15} />
                </button>
              </div>
            </div>
            {step.notes && (present || tool === "select") && (
              <div className="overlay bl" style={{ maxWidth: "min(460px, 45%)" }}>
                <div className="glass" style={{ padding: "8px 12px", display: "block", whiteSpace: "pre-wrap", color: "var(--text-2)" }}>
                  <b style={{ color: "var(--text)" }}>{step.name}</b>
                  <div className="small">{step.notes}</div>
                </div>
              </div>
            )}
            {present && tactic.steps.length > 1 && (
              <div className="overlay br">
                <div className="glass hint">
                  <span className="kbd">←</span> <span className="kbd">→</span> {t("editor.presentKeys")} · <span className="kbd">Space</span> {t("steps.play")}
                </div>
              </div>
            )}
          </div>
          {present && <PresentTable tactic={tactic} step={step} players={pb.players} />}
        </div>
        {!present && (
          <SidePanel
            tab={tab}
            onTab={setTab}
            tactic={tactic}
            step={step}
            pb={pb}
            selected={selectedObjs}
            armedSlot={armedSlot}
            onArm={(id) => {
              setArmedSlot(id);
              if (id) setTool("player");
            }}
            updTactic={updTactic}
            changeObject={changeObject}
            removeObjects={removeObjects}
            duplicateSelected={duplicateSelected}
            onDuplicateTactic={onDuplicateTactic}
            onDeleteTactic={onDeleteTactic}
          />
        )}
      </div>

      {shownLineup && (
        <Modal title={shownLineup.name || t("lineups.unnamed")} onClose={() => setLineupView(null)} size="wide">
          <LineupDetails lineup={shownLineup} />
        </Modal>
      )}

      <StepsBar
        steps={tactic.steps}
        index={safeIdx}
        playing={playing}
        readOnly={present}
        onSelect={(i) => goStep(i)}
        onAdd={() => addStep(false)}
        onDuplicate={() => addStep(true)}
        onDelete={deleteStep}
        onRename={renameStep}
        onMove={moveStep}
        onPlay={play}
        onStop={() => setPlaying(false)}
      />
    </div>
  );
}

function shiftObject<T extends BoardObject>(o: T, d: number): T {
  if ("points" in o) o.points = o.points.map((v) => v + d);
  if ("x" in o) {
    o.x += d;
    o.y += d;
  }
  if (o.kind === "utility" && o.from) o.from = { x: o.from.x + d, y: o.from.y + d };
  return o;
}
