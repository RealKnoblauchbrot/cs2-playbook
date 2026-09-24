import type { Draft } from "immer";
import { ArrowLeft, Trash2, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { confirmDialog, Empty, Field, Segmented } from "../components/ui";
import { mapCoverUrl, mapIconUrl, mapName } from "../data/maps";
import { orderedMaps } from "../model/selectors";
import type { Playbook, Side, VetoAction, VetoFormat, VetoPlan, VetoStep, VetoTeam } from "../model/types";
import { updatePb, usePlaybook } from "../store/playbook";

/** Standard veto order for a pool of `n` maps. */
export function vetoSequence(format: VetoFormat, n: number): VetoAction[] {
  const seq: VetoAction[] = [];
  if (format === "bo1") for (let i = 0; i < n - 1; i++) seq.push("ban");
  else if (format === "bo3") {
    seq.push("ban", "ban", "pick", "pick");
    while (seq.length < n - 1) seq.push("ban");
  } else {
    seq.push("ban", "ban");
    while (seq.length < n - 1) seq.push("pick");
  }
  seq.push("decider");
  return seq.slice(Math.max(0, seq.length - n));
}

export function buildSteps(format: VetoFormat, weStart: boolean, n: number, old: VetoStep[] = []): VetoStep[] {
  return vetoSequence(format, n).map((action, i) => ({
    action,
    team: action === "decider" ? null : ((i % 2 === 0) === weStart ? "us" : "them") as VetoTeam,
    mapId: old[i]?.mapId ?? null,
    sideChoice: old[i]?.sideChoice ?? null,
  }));
}

/** Fill our own bans/picks from pool preferences (status + comfort). */
function autofill(pb: Playbook, v: Draft<VetoPlan>) {
  const pool = orderedMaps(pb, true);
  const score = (id: string) => {
    const m = pool.find((x) => x.def.id === id)!.data;
    const st = { pick: 3, neutral: 0, ban: -3, permaban: -6 }[m.status];
    return st + m.comfort - m.priority * 0.01;
  };
  const taken = new Set(v.steps.filter((s) => s.team === "them" && s.mapId).map((s) => s.mapId!));
  for (const s of v.steps) {
    if (s.team !== "us") {
      if (s.mapId) taken.add(s.mapId);
      continue;
    }
    const remaining = pool.map((m) => m.def.id).filter((id) => !taken.has(id));
    if (!remaining.length) break;
    remaining.sort((a, b) => score(a) - score(b));
    s.mapId = s.action === "ban" ? remaining[0] : remaining[remaining.length - 1];
    taken.add(s.mapId);
  }
  const left = pool.map((m) => m.def.id).filter((id) => !v.steps.some((s) => s.action !== "decider" && s.mapId === id));
  const decider = v.steps.find((s) => s.action === "decider");
  if (decider && left.length === 1) decider.mapId = left[0];
}

export default function VetoEditor() {
  const { vetoId } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const pb = usePlaybook((s) => s.pb)!;
  const v = pb.vetos.find((x) => x.id === vetoId);
  if (!v) return <div className="page"><Empty title={t("veto.notFound")} /></div>;

  const pool = orderedMaps(pb, true).map((m) => m.def);
  const upd = (fn: (d: Draft<VetoPlan>) => void, coalesce?: string) =>
    updatePb(
      (d) => {
        const x = d.vetos.find((y) => y.id === v.id);
        if (!x) return;
        fn(x);
        x.updatedAt = Date.now();
      },
      { coalesce },
    );

  const steps = v.steps.length ? v.steps : buildSteps(v.format, v.weStart, pool.length);
  const ensure = (d: Draft<VetoPlan>) => {
    if (!d.steps.length) d.steps = buildSteps(d.format, d.weStart, pool.length);
  };

  const setStep = (i: number, patch: Partial<VetoStep>) =>
    upd((d) => {
      ensure(d);
      Object.assign(d.steps[i], patch);
      // Auto-complete the decider when only one map remains.
      const used = new Set(d.steps.filter((s) => s.action !== "decider" && s.mapId).map((s) => s.mapId));
      const left = pool.filter((m) => !used.has(m.id));
      const dec = d.steps.find((s) => s.action === "decider");
      if (dec && left.length === 1) dec.mapId = left[0].id;
    });

  const played = steps.filter((s) => (s.action === "pick" || s.action === "decider") && s.mapId);

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn ghost icon" onClick={() => nav("/pool")}>
          <ArrowLeft size={18} />
        </button>
        <input
          className="input ghost title"
          style={{ maxWidth: 380 }}
          value={v.name}
          placeholder={t("veto.namePh")}
          onChange={(e) => upd((d) => void (d.name = e.target.value), "vname")}
        />
        <div className="spacer" />
        <button className="btn" onClick={() => upd((d) => { ensure(d); autofill(pb, d); })}>
          <Wand2 size={15} /> {t("veto.autofill")}
        </button>
        <button
          className="btn danger"
          onClick={async () => {
            if (!(await confirmDialog({ title: t("veto.deleteConfirm"), danger: true, okLabel: t("common.delete") }))) return;
            nav("/pool");
            updatePb((d) => void (d.vetos = d.vetos.filter((x) => x.id !== v.id)));
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="form-grid" style={{ marginBottom: 18 }}>
        <Field label={t("veto.opponent")}>
          <input className="input" value={v.opponent} onChange={(e) => upd((d) => void (d.opponent = e.target.value), "vopp")} />
        </Field>
        <Field label={t("veto.format")}>
          <Segmented<VetoFormat>
            value={v.format}
            onChange={(f) => upd((d) => { d.format = f; d.steps = buildSteps(f, d.weStart, pool.length, d.steps); })}
            options={[
              { value: "bo1", label: "BO1" },
              { value: "bo3", label: "BO3" },
              { value: "bo5", label: "BO5" },
            ]}
          />
        </Field>
        <Field label={t("veto.starts")}>
          <Segmented<"us" | "them">
            value={v.weStart ? "us" : "them"}
            onChange={(w) => upd((d) => { d.weStart = w === "us"; d.steps = buildSteps(d.format, d.weStart, pool.length, d.steps); })}
            options={[
              { value: "us", label: t("veto.us") },
              { value: "them", label: t("veto.them") },
            ]}
          />
        </Field>
      </div>

      {pool.length < 3 && <div className="muted" style={{ marginBottom: 12 }}>{t("veto.poolTooSmall")}</div>}

      <div className="veto-steps">
        {steps.map((s, i) => {
          const usedElsewhere = new Set(steps.filter((x, j) => j !== i && x.mapId).map((x) => x.mapId));
          const needsSide = s.action === "decider" || (s.action === "pick" && s.team === "them");
          return (
            <div key={i} className={`veto-step ${s.action === "decider" ? "decider" : s.team}`}>
              <span className="muted">{i + 1}</span>
              <b>{s.action === "decider" ? t("veto.decider") : s.team === "us" ? t("veto.us") : v.opponent || t("veto.them")}</b>
              <span className={`badge ${s.action === "ban" ? "ban" : "pick"}`}>{t(`veto.action.${s.action}`)}</span>
              <div className="row">
                {s.mapId && <img src={mapIconUrl(s.mapId)} alt="" style={{ width: 22, height: 22 }} />}
                <select className="select sm" value={s.mapId ?? ""} onChange={(e) => setStep(i, { mapId: e.target.value || null })}>
                  <option value="">{t("veto.chooseMap")}</option>
                  {pool.map((m) => (
                    <option key={m.id} value={m.id} disabled={usedElsewhere.has(m.id)}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              {needsSide ? (
                <select className="select sm" value={s.sideChoice ?? ""} onChange={(e) => setStep(i, { sideChoice: (e.target.value || null) as Side | null })}>
                  <option value="">{t("veto.ourSide")}</option>
                  <option value="T">{t("veto.startT")}</option>
                  <option value="CT">{t("veto.startCT")}</option>
                </select>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>

      {played.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>{t("veto.result")}</h2>
          </div>
          <div className="veto-result">
            {played.map((s, i) => (
              <div key={i} className="m">
                <div className="c" style={{ backgroundImage: `url(${mapCoverUrl(s.mapId!)})` }} />
                <div className="t">
                  <b>
                    {t("veto.mapN", { n: i + 1 })}: {mapName(s.mapId!)}
                  </b>
                  <div className="muted">
                    {s.action === "decider" ? t("veto.decider") : s.team === "us" ? t("veto.ourPick") : t("veto.theirPick")}
                    {s.sideChoice && ` · ${t("veto.startOn", { side: s.sideChoice })}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <Field label={t("veto.notes")}>
          <textarea className="textarea" style={{ minHeight: 140 }} placeholder={t("veto.notesPh")} value={v.notes} onChange={(e) => upd((d) => void (d.notes = e.target.value), "vnotes")} />
        </Field>
      </div>
    </div>
  );
}
