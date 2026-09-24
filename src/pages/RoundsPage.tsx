import type { Draft } from "immer";
import { Coins, ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { confirmDialog, Empty, Field, Segmented, SideBadge } from "../components/ui";
import { EQUIPMENT, equipmentIconUrl, getEquipment, LOSS_BONUS, type EquipCategory } from "../data/equipment";
import { mapName } from "../data/maps";
import { newRoundPlan } from "../model/factory";
import { getRoleAssignment, orderedMaps } from "../model/selectors";
import type { RoundCategory, RoundPlan, Side } from "../model/types";
import { updatePb, usePlaybook } from "../store/playbook";

export const ROUND_CATEGORIES: RoundCategory[] = ["pistol", "anti-eco", "eco", "force", "bonus", "full", "save", "rules"];
const CATS: EquipCategory[] = ["pistol", "smg", "heavy", "rifle", "sniper", "gear", "grenade"];

export default function RoundsPage() {
  const { t } = useTranslation();
  const pb = usePlaybook((s) => s.pb)!;
  const [sel, setSel] = useState<string | null>(pb.rounds[0]?.id ?? null);
  const [side, setSide] = useState<"all" | Side>("all");
  const plan = pb.rounds.find((r) => r.id === sel);

  const create = () => {
    const r = newRoundPlan();
    r.name = t("rounds.newName");
    r.side = side === "all" ? "T" : side;
    const ra = getRoleAssignment(pb, "default", r.side as Side);
    r.buys.forEach((b, i) => (b.playerId = ra?.slots[i]?.playerId ?? pb.players[i]?.id ?? null));
    updatePb((d) => void d.rounds.push(r));
    setSel(r.id);
  };

  const list = pb.rounds.filter((r) => side === "all" || r.side === side || r.side === "both");

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("nav.rounds")}</h1>
        <span className="muted">{t("rounds.subtitle")}</span>
        <div className="spacer" />
        <Segmented
          size="sm"
          value={side}
          onChange={setSide}
          options={[
            { value: "all", label: t("common.all") },
            { value: "T", label: "T", className: "t" },
            { value: "CT", label: "CT", className: "ct" },
          ]}
        />
        <button className="btn primary" onClick={create}>
          <Plus size={15} /> {t("rounds.new")}
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
        <div className="col" style={{ gap: 14 }}>
          <div className="card">
            {list.length === 0 && <div className="muted small" style={{ padding: 14 }}>{t("rounds.none")}</div>}
            {ROUND_CATEGORIES.map((c) => {
              const items = list.filter((r) => r.category === c);
              if (!items.length) return null;
              return (
                <div key={c}>
                  <div className="import-group">{t(`roundCat.${c}`)}</div>
                  {items.map((r) => (
                    <div
                      key={r.id}
                      className="row"
                      style={{ padding: "8px 12px", cursor: "pointer", background: r.id === sel ? "var(--panel-2)" : undefined, borderBottom: "1px solid var(--border)" }}
                      onClick={() => setSel(r.id)}
                    >
                      <span className="grow ellipsis">{r.name || t("common.untitled")}</span>
                      {r.mapId && <span className="muted small">{mapName(r.mapId)}</span>}
                      <SideBadge side={r.side} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="card pad">
            <div className="row" style={{ marginBottom: 8 }}>
              <Coins size={16} color="var(--warning)" />
              <h3>{t("rounds.lossBonus")}</h3>
            </div>
            <table className="table">
              <tbody>
                {LOSS_BONUS.map((v, i) => (
                  <tr key={i}>
                    <td className="muted">{t("rounds.lossN", { n: i + 1 })}</td>
                    <td style={{ textAlign: "right" }}>${v.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="muted small" style={{ marginTop: 8 }}>{t("rounds.econHint")}</div>
          </div>
        </div>

        {plan ? <PlanEditor key={plan.id} plan={plan} onDeleted={() => setSel(null)} /> : <Empty icon={<ListChecks size={30} />} title={t("rounds.select")} text={t("rounds.selectText")} />}
      </div>
    </div>
  );
}

function PlanEditor({ plan, onDeleted }: { plan: RoundPlan; onDeleted(): void }) {
  const { t } = useTranslation();
  const pb = usePlaybook((s) => s.pb)!;
  const [picking, setPicking] = useState<number | null>(null);
  const upd = (fn: (d: Draft<RoundPlan>) => void, coalesce?: string) =>
    updatePb(
      (d) => {
        const r = d.rounds.find((x) => x.id === plan.id);
        if (!r) return;
        fn(r);
        r.updatedAt = Date.now();
      },
      { coalesce },
    );
  const sideForItems: Side = plan.side === "CT" ? "CT" : "T";
  const cost = (items: string[]) => items.reduce((s, id) => s + (getEquipment(id)?.price ?? 0), 0);
  const total = plan.buys.reduce((s, b) => s + cost(b.items), 0);
  const tactics = pb.tactics.filter((x) => (plan.side === "both" || x.side === plan.side) && (!plan.mapId || x.mapId === plan.mapId));

  return (
    <div className="card pad col" style={{ gap: 14 }}>
      <div className="row">
        <input className="input title ghost grow" value={plan.name} placeholder={t("rounds.namePh")} onChange={(e) => upd((d) => void (d.name = e.target.value), `rname-${plan.id}`)} />
        <button
          className="btn icon danger"
          onClick={async () => {
            if (!(await confirmDialog({ title: t("rounds.deleteConfirm"), danger: true, okLabel: t("common.delete") }))) return;
            onDeleted();
            updatePb((d) => void (d.rounds = d.rounds.filter((x) => x.id !== plan.id)));
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="form-grid">
        <Field label={t("rounds.category")}>
          <select className="select sm" value={plan.category} onChange={(e) => upd((d) => void (d.category = e.target.value as RoundCategory))}>
            {ROUND_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`roundCat.${c}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("tactic.side")}>
          <Segmented<Side | "both">
            size="sm"
            value={plan.side}
            onChange={(v) => upd((d) => void (d.side = v))}
            options={[
              { value: "T", label: "T", className: "t" },
              { value: "CT", label: "CT", className: "ct" },
              { value: "both", label: t("common.both") },
            ]}
          />
        </Field>
        <Field label={t("rounds.map")}>
          <select className="select sm" value={plan.mapId ?? ""} onChange={(e) => upd((d) => void (d.mapId = e.target.value || null))}>
            <option value="">{t("rounds.allMaps")}</option>
            {orderedMaps(pb, true).map(({ def }) => (
              <option key={def.id} value={def.id}>
                {def.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("rounds.minMoney")}>
          <input
            className="input sm"
            type="number"
            step={100}
            value={plan.minTeamMoney ?? ""}
            placeholder="$"
            onChange={(e) => upd((d) => void (d.minTeamMoney = e.target.value ? Number(e.target.value) : null), `rmoney-${plan.id}`)}
          />
        </Field>
      </div>
      <Field label={t("rounds.description")}>
        <textarea className="textarea" style={{ minHeight: 100 }} placeholder={t("rounds.descriptionPh")} value={plan.description} onChange={(e) => upd((d) => void (d.description = e.target.value), `rdesc-${plan.id}`)} />
      </Field>

      {plan.category !== "rules" && (
        <div className="col" style={{ gap: 8 }}>
          <div className="row">
            <h3 className="grow">{t("rounds.buys")}</h3>
            <span className="muted">{t("rounds.teamCost", { cost: total.toLocaleString() })}</span>
          </div>
          {plan.buys.map((b, i) => {
            const player = pb.players.find((p) => p.id === b.playerId);
            return (
              <div key={i} className="card" style={{ padding: 10, background: "var(--panel-2)" }}>
                <div className="row">
                  <PlayerAvatar player={player} size={28} fallback={`P${i + 1}`} />
                  <select className="select sm" style={{ width: 150 }} value={b.playerId ?? ""} onChange={(e) => upd((d) => void (d.buys[i].playerId = e.target.value || null))}>
                    <option value="">{t("editor.noPlayer")}</option>
                    {pb.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="equip-list grow" onClick={() => setPicking(picking === i ? null : i)} style={{ cursor: "pointer" }}>
                    {b.items.length === 0 && <span className="muted small">{t("rounds.clickToBuy")}</span>}
                    {b.items.map((id, j) => (
                      <img key={j} src={equipmentIconUrl(id)} alt={id} title={getEquipment(id)?.name} />
                    ))}
                  </div>
                  <span className="mono small">${cost(b.items).toLocaleString()}</span>
                </div>
                <input className="input sm" style={{ marginTop: 6 }} placeholder={t("rounds.buyNotePh")} value={b.note} onChange={(e) => upd((d) => void (d.buys[i].note = e.target.value), `rbuy-${plan.id}-${i}`)} />
                {picking === i && (
                  <div className="col" style={{ gap: 6, marginTop: 8 }}>
                    {CATS.map((c) => (
                      <div key={c} className="equip-picker">
                        {EQUIPMENT.filter((e) => e.category === c && (e.side === "both" || plan.side === "both" || e.side === sideForItems)).map((e) => {
                          const on = b.items.includes(e.id);
                          return (
                            <button
                              key={e.id}
                              className={`equip ${on ? "on" : ""}`}
                              title={`${e.name} · $${e.price}`}
                              onClick={() =>
                                upd((d) => {
                                  const buy = d.buys[i];
                                  const count = buy.items.filter((x) => x === e.id).length;
                                  // Flashes cycle 0 -> 1 -> 2 -> 0 (two can be carried); everything else toggles.
                                  const max = e.id === "flashbang" ? 2 : 1;
                                  if (count < max) buy.items.push(e.id);
                                  else buy.items = buy.items.filter((x) => x !== e.id);
                                })
                              }
                            >
                              <img src={equipmentIconUrl(e.id)} alt="" />
                              {e.name}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Field label={t("rounds.linkedTactics")}>
        <div className="row wrap" style={{ gap: 6 }}>
          {tactics.length === 0 && <span className="muted small">{t("rounds.noTactics")}</span>}
          {tactics.map((x) => {
            const on = plan.tacticIds.includes(x.id);
            return (
              <button
                key={x.id}
                className={`btn sm ${on ? "active" : ""}`}
                onClick={() => upd((d) => void (d.tacticIds = on ? d.tacticIds.filter((id) => id !== x.id) : [...d.tacticIds, x.id]))}
              >
                {mapName(x.mapId)} · {x.name}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}
