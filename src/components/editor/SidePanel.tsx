import type { Draft } from "immer";
import { Copy, Crosshair, MapPinOff, Star, Trash2, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UTILITY_KINDS } from "../../data/equipment";
import { getMap } from "../../data/maps";
import type {
  BoardObject,
  BuyType,
  ID,
  LevelId,
  Lineup,
  Player,
  Playbook,
  RoleDef,
  Step,
  Tactic,
  TacticType,
  UtilityKind,
} from "../../model/types";
import { ColorPicker, Field, Segmented, TagInput } from "../ui";
import { PlayerAvatar } from "../PlayerAvatar";
import { MARKER_ICONS } from "../board/tools";
import { getRoleAssignment } from "../../model/selectors";

export type PanelTab = "players" | "object" | "step" | "info";

export const TACTIC_TYPES: TacticType[] = [
  "default",
  "execute",
  "rush",
  "split",
  "fake",
  "contact",
  "pistol",
  "anti-eco",
  "force",
  "setup",
  "stack",
  "aggression",
  "retake",
  "other",
];
export const BUY_TYPES: BuyType[] = ["any", "pistol", "eco", "force", "full"];

interface Props {
  tab: PanelTab;
  onTab(t: PanelTab): void;
  tactic: Tactic;
  step: Step;
  pb: Playbook;
  selected: BoardObject[];
  armedSlot: ID | null;
  onArm(slotId: ID | null): void;
  updTactic(fn: (t: Draft<Tactic>) => void, coalesce?: string): void;
  changeObject(id: ID, patch: Partial<BoardObject>, coalesce?: string): void;
  removeObjects(ids: ID[]): void;
  duplicateSelected(): void;
  onDuplicateTactic(): void;
  onDeleteTactic(): void;
}

export function SidePanel(p: Props) {
  const { t } = useTranslation();
  return (
    <div className="side-panel">
      <div className="tabs">
        {(["players", "object", "step", "info"] as PanelTab[]).map((k) => (
          <button key={k} className={p.tab === k ? "on" : ""} onClick={() => p.onTab(k)}>
            {t(`editor.tab.${k}`)}
            {k === "object" && p.selected.length > 0 && <span className="badge accent">{p.selected.length}</span>}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {p.tab === "players" && <PlayersTab {...p} />}
        {p.tab === "object" && <ObjectTab {...p} />}
        {p.tab === "step" && <StepTab {...p} />}
        {p.tab === "info" && <InfoTab {...p} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Players

function PlayersTab(p: Props) {
  const { t } = useTranslation();
  const { tactic, pb, step } = p;
  const players = pb.players;
  const roles = pb.roles.filter((r) => r.side === "both" || r.side === tactic.side);

  const applyDefaults = () => {
    const ra = getRoleAssignment(pb, tactic.mapId, tactic.side);
    if (!ra) return;
    p.updTactic((d) => {
      ra.slots.forEach((rs, i) => {
        const slot = d.slots[i];
        if (!slot) return;
        if (rs.playerId) slot.playerId = rs.playerId;
        const name = pb.roles.find((r) => r.id === rs.roleId)?.name;
        if (name) slot.role = name;
      });
    });
  };

  return (
    <>
      <div className="row">
        <span className="muted small grow">{t("editor.playersHint")}</span>
        <button className="btn sm" onClick={applyDefaults} title={t("editor.applyDefaultsHint")}>
          <Wand2 size={14} /> {t("editor.applyDefaults")}
        </button>
      </div>
      <datalist id="role-names">
        {roles.map((r: RoleDef) => (
          <option key={r.id} value={r.name} />
        ))}
      </datalist>
      {tactic.slots.map((slot, i) => {
        const player = players.find((x) => x.id === slot.playerId);
        const placed = step.objects.some((o) => o.kind === "player" && o.slotId === slot.id);
        const armed = p.armedSlot === slot.id;
        return (
          <div key={slot.id} className={`slot-row ${armed ? "armed" : ""}`}>
            <div className="col" style={{ alignItems: "center", gap: 6 }}>
              <button
                style={{ border: 0, background: "none", padding: 0, cursor: "pointer" }}
                title={t("editor.armSlot")}
                onClick={() => p.onArm(armed ? null : slot.id)}
              >
                <PlayerAvatar player={player} size={36} fallback={`P${i + 1}`} />
              </button>
              <span className="small muted">{i + 1}</span>
            </div>
            <div className="slot-fields">
              <div className="row">
                <select
                  className="select sm grow"
                  value={slot.playerId ?? ""}
                  onChange={(e) => p.updTactic((d) => void (d.slots[i].playerId = e.target.value || null))}
                >
                  <option value="">{t("editor.noPlayer")}</option>
                  {players.map((pl: Player) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name}
                      {pl.status !== "main" ? ` (${t(`roster.status.${pl.status}`)})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  className={`btn icon sm ${armed ? "active" : ""}`}
                  title={placed ? t("editor.movePlayer") : t("editor.placePlayer")}
                  onClick={() => p.onArm(slot.id)}
                >
                  <Crosshair size={14} />
                </button>
                {placed && (
                  <button
                    className="btn icon sm ghost"
                    title={t("editor.removeFromStep")}
                    onClick={() =>
                      p.removeObjects(step.objects.filter((o) => o.kind === "player" && o.slotId === slot.id).map((o) => o.id))
                    }
                  >
                    <MapPinOff size={14} />
                  </button>
                )}
              </div>
              <input
                className="input sm"
                list="role-names"
                placeholder={t("editor.role")}
                value={slot.role}
                onChange={(e) => p.updTactic((d) => void (d.slots[i].role = e.target.value), `role-${slot.id}`)}
              />
              <textarea
                className="textarea"
                style={{ minHeight: 64 }}
                placeholder={t("editor.playerNotes")}
                value={slot.notes}
                onChange={(e) => p.updTactic((d) => void (d.slots[i].notes = e.target.value), `notes-${slot.id}`)}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------ Object

function ObjectTab(p: Props) {
  const { t } = useTranslation();
  const { selected, tactic, pb } = p;
  if (selected.length === 0) return <div className="muted">{t("editor.nothingSelected")}</div>;
  if (selected.length > 1) {
    return (
      <>
        <div>{t("editor.multiSelected", { count: selected.length })}</div>
        <div className="row">
          <button className="btn sm" onClick={p.duplicateSelected}>
            <Copy size={14} /> {t("common.duplicate")}
          </button>
          <button className="btn sm danger" onClick={() => p.removeObjects(selected.map((o) => o.id))}>
            <Trash2 size={14} /> {t("common.delete")}
          </button>
        </div>
      </>
    );
  }
  const o = selected[0];
  const ch = (patch: Partial<BoardObject>, key?: string) => p.changeObject(o.id, patch, key ? `${o.id}-${key}` : undefined);
  const map = getMap(tactic.mapId);
  const slotOptions = (
    <>
      <option value="">{t("editor.nobody")}</option>
      {tactic.slots.map((s, i) => (
        <option key={s.id} value={s.id}>
          {pb.players.find((x) => x.id === s.playerId)?.name ?? s.role ?? `P${i + 1}`}
        </option>
      ))}
    </>
  );

  let fields = null;
  switch (o.kind) {
    case "player":
      fields = (
        <>
          <Field label={t("editor.slot")}>
            <select className="select sm" value={o.slotId} onChange={(e) => ch({ slotId: e.target.value })}>
              {tactic.slots.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {pb.players.find((x) => x.id === s.playerId)?.name ?? `P${i + 1}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("editor.facing")}>
            <div className="row">
              <input
                type="range"
                min={-180}
                max={180}
                className="grow"
                value={o.facing ?? 0}
                disabled={o.facing == null}
                onChange={(e) => ch({ facing: Number(e.target.value) }, "facing")}
              />
              <label className="checkbox small">
                <input type="checkbox" checked={o.facing != null} onChange={(e) => ch({ facing: e.target.checked ? 0 : null })} />
                {t("common.show")}
              </label>
            </div>
          </Field>
        </>
      );
      break;
    case "enemy":
      fields = (
        <Field label={t("editor.label")}>
          <input className="input sm" value={o.label} onChange={(e) => ch({ label: e.target.value }, "label")} />
        </Field>
      );
      break;
    case "utility": {
      const lineups = pb.lineups.filter((l: Lineup) => l.mapId === tactic.mapId && l.util === o.util);
      fields = (
        <>
          <Field label={t("editor.utility")}>
            <select className="select sm" value={o.util} onChange={(e) => ch({ util: e.target.value as UtilityKind })}>
              {UTILITY_KINDS.map((u) => (
                <option key={u} value={u}>
                  {t(`util.${u}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("editor.thrower")}>
            <select className="select sm" value={o.slotId ?? ""} onChange={(e) => ch({ slotId: e.target.value || null })}>
              {slotOptions}
            </select>
          </Field>
          <Field label={t("editor.lineupLink")}>
            <select className="select sm" value={o.lineupId ?? ""} onChange={(e) => ch({ lineupId: e.target.value || null })}>
              <option value="">{t("editor.noLineup")}</option>
              {lineups.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name || t("lineups.unnamed")}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("editor.note")}>
            <input className="input sm" value={o.note} placeholder={t("editor.utilNotePh")} onChange={(e) => ch({ note: e.target.value }, "note")} />
          </Field>
          {o.from ? (
            <button className="btn sm" onClick={() => ch({ from: null })}>
              {t("editor.removeThrowSpot")}
            </button>
          ) : (
            <button className="btn sm" onClick={() => ch({ from: { x: Math.max(0, o.x - 0.06), y: Math.min(1, o.y + 0.06) } })}>
              {t("editor.addThrowSpot")}
            </button>
          )}
        </>
      );
      break;
    }
    case "arrow":
      fields = (
        <>
          <Field label={t("editor.color")}>
            <ColorPicker value={o.color} onChange={(c) => ch({ color: c })} />
          </Field>
          <Field label={t("editor.width")}>
            <input type="range" min={1} max={12} value={o.width} onChange={(e) => ch({ width: Number(e.target.value) }, "width")} />
          </Field>
          <div className="row wrap" style={{ gap: 14 }}>
            <label className="checkbox small">
              <input type="checkbox" checked={o.dashed} onChange={(e) => ch({ dashed: e.target.checked })} /> {t("editor.dashed")}
            </label>
            <label className="checkbox small">
              <input type="checkbox" checked={o.head} onChange={(e) => ch({ head: e.target.checked })} /> {t("editor.arrowHead")}
            </label>
            <label className="checkbox small">
              <input type="checkbox" checked={o.curved} onChange={(e) => ch({ curved: e.target.checked })} /> {t("editor.curved")}
            </label>
          </div>
          <Field label={t("editor.assignedTo")}>
            <select className="select sm" value={o.slotId ?? ""} onChange={(e) => ch({ slotId: e.target.value || null })}>
              {slotOptions}
            </select>
          </Field>
        </>
      );
      break;
    case "draw":
      fields = (
        <>
          <Field label={t("editor.color")}>
            <ColorPicker value={o.color} onChange={(c) => ch({ color: c })} />
          </Field>
          <Field label={t("editor.width")}>
            <input type="range" min={1} max={14} value={o.width} onChange={(e) => ch({ width: Number(e.target.value) }, "width")} />
          </Field>
        </>
      );
      break;
    case "zone":
      fields = (
        <>
          <Field label={t("editor.label")}>
            <input className="input sm" value={o.label} onChange={(e) => ch({ label: e.target.value }, "label")} />
          </Field>
          <Field label={t("editor.color")}>
            <ColorPicker value={o.color} onChange={(c) => ch({ color: c })} />
          </Field>
          <Field label={t("editor.opacity")}>
            <input
              type="range"
              min={0.05}
              max={0.9}
              step={0.05}
              value={o.opacity}
              onChange={(e) => ch({ opacity: Number(e.target.value) }, "opacity")}
            />
          </Field>
          <Segmented
            size="sm"
            value={o.shape}
            onChange={(v) => ch({ shape: v })}
            options={[
              { value: "rect", label: t("tools.zone-rect") },
              { value: "circle", label: t("tools.zone-circle") },
            ]}
          />
        </>
      );
      break;
    case "text":
      fields = (
        <>
          <Field label={t("editor.text")}>
            <textarea className="textarea" value={o.text} onChange={(e) => ch({ text: e.target.value }, "text")} autoFocus />
          </Field>
          <Field label={t("editor.color")}>
            <ColorPicker value={o.color} onChange={(c) => ch({ color: c })} />
          </Field>
          <Field label={t("editor.size")}>
            <input type="range" min={10} max={48} value={o.size} onChange={(e) => ch({ size: Number(e.target.value) }, "size")} />
          </Field>
        </>
      );
      break;
    case "icon":
      fields = (
        <>
          <Field label={t("editor.icon")}>
            <select className="select sm" value={o.icon} onChange={(e) => ch({ icon: e.target.value as typeof o.icon })}>
              {MARKER_ICONS.map((i) => (
                <option key={i} value={i}>
                  {t(`icons.${i}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("editor.color")}>
            <ColorPicker value={o.color} onChange={(c) => ch({ color: c })} />
          </Field>
        </>
      );
      break;
    case "vision":
      fields = (
        <>
          <Field label={t("editor.spread")}>
            <input type="range" min={10} max={180} value={o.spread} onChange={(e) => ch({ spread: Number(e.target.value) }, "spread")} />
          </Field>
          <Field label={t("editor.assignedTo")}>
            <select className="select sm" value={o.slotId ?? ""} onChange={(e) => ch({ slotId: e.target.value || null })}>
              {slotOptions}
            </select>
          </Field>
          {!o.slotId && (
            <Field label={t("editor.color")}>
              <ColorPicker value={o.color} onChange={(c) => ch({ color: c })} />
            </Field>
          )}
        </>
      );
      break;
  }

  return (
    <>
      <h3>{t(`objects.${o.kind}`)}</h3>
      {fields}
      {map && map.levels.length > 1 && (
        <Field label={t("editor.level")}>
          <Segmented
            size="sm"
            value={o.level}
            onChange={(v: LevelId) => ch({ level: v })}
            options={map.levels.map((l) => ({ value: l.id, label: t(`levels.${l.id}`, { defaultValue: l.name }) }))}
          />
        </Field>
      )}
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn sm" onClick={p.duplicateSelected}>
          <Copy size={14} /> {t("common.duplicate")}
        </button>
        <button className="btn sm danger" onClick={() => p.removeObjects([o.id])}>
          <Trash2 size={14} /> {t("common.delete")}
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Step

function StepTab(p: Props) {
  const { t } = useTranslation();
  const idx = p.tactic.steps.findIndex((s) => s.id === p.step.id);
  const upd = (fn: (s: Draft<Step>) => void, key: string) =>
    p.updTactic((d) => {
      const s = d.steps.find((x) => x.id === p.step.id);
      if (s) fn(s);
    }, key);
  return (
    <>
      <Field label={t("editor.stepName")}>
        <input className="input" value={p.step.name} onChange={(e) => upd((s) => void (s.name = e.target.value), `stepname-${p.step.id}`)} />
      </Field>
      <Field label={t("editor.stepNotes")}>
        <textarea
          className="textarea"
          style={{ minHeight: 160 }}
          placeholder={t("editor.stepNotesPh")}
          value={p.step.notes}
          onChange={(e) => upd((s) => void (s.notes = e.target.value), `stepnotes-${p.step.id}`)}
        />
      </Field>
      <div className="muted small">
        {t("editor.stepInfo", { n: idx + 1, total: p.tactic.steps.length, objects: p.step.objects.length })}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Info

function InfoTab(p: Props) {
  const { t } = useTranslation();
  const { tactic } = p;
  return (
    <>
      <div className="row">
        <Field label={t("tactic.type")} style={{ flex: 1 }}>
          <select className="select sm" value={tactic.type} onChange={(e) => p.updTactic((d) => void (d.type = e.target.value as TacticType))}>
            {TACTIC_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`tacticType.${ty}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("tactic.buy")} style={{ flex: 1 }}>
          <select className="select sm" value={tactic.buy} onChange={(e) => p.updTactic((d) => void (d.buy = e.target.value as BuyType))}>
            {BUY_TYPES.map((b) => (
              <option key={b} value={b}>
                {t(`buy.${b}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t("tactic.description")}>
        <textarea
          className="textarea"
          style={{ minHeight: 140 }}
          placeholder={t("tactic.descriptionPh")}
          value={tactic.description}
          onChange={(e) => p.updTactic((d) => void (d.description = e.target.value), `desc-${tactic.id}`)}
        />
      </Field>
      <Field label={t("tactic.tags")}>
        <TagInput value={tactic.tags} onChange={(v) => p.updTactic((d) => void (d.tags = v))} placeholder={t("tactic.tagsPh")} />
      </Field>
      <label className="checkbox">
        <input type="checkbox" checked={tactic.favorite} onChange={(e) => p.updTactic((d) => void (d.favorite = e.target.checked))} />
        <Star size={14} /> {t("tactic.favorite")}
      </label>
      <div className="muted small">
        {t("tactic.updated", { date: new Date(tactic.updatedAt).toLocaleString() })}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={p.onDuplicateTactic}>
          <Copy size={14} /> {t("tactic.duplicate")}
        </button>
        <button className="btn sm danger" onClick={p.onDeleteTactic}>
          <Trash2 size={14} /> {t("tactic.delete")}
        </button>
      </div>
    </>
  );
}
