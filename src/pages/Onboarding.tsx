import { produce } from "immer";
import { FileUp, Plus, Rocket, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "../components/ui";
import i18n, { LOCALES } from "../i18n";
import type { PickedFile } from "../lib/platform";
import { pickFiles } from "../lib/media";
import { analyzeImport, applyImport, readShareFile, SHARE_EXT, writeImportedMedia } from "../lib/share";
import { createPlaybook } from "../model/factory";
import { usePlaybook } from "../store/playbook";
import { useSettings } from "../store/settings";
import { toast } from "../store/toast";

/** Create a fresh playbook from a teammate's share file (welcome screen / double-click). */
export async function startFromShareFile(file: PickedFile) {
  try {
    const contents = readShareFile(file.bytes);
    await writeImportedMedia(contents);
    const base = createPlaybook(contents.manifest.teamName || i18n.t("onboarding.defaultTeam"));
    const pb = produce(base, (d) => applyImport(d, contents, analyzeImport(base, contents)));
    await usePlaybook.getState().replace(pb, "init");
    toast.success(i18n.t("onboarding.imported", { team: pb.team.name }));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

export default function Onboarding() {
  const { t } = useTranslation();
  const settings = useSettings();
  const [team, setTeam] = useState("");
  const [players, setPlayers] = useState<string[]>(["", "", "", "", ""]);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    await usePlaybook.getState().replace(createPlaybook(team.trim() || t("onboarding.defaultTeam"), players), "init");
  };

  const importFile = async () => {
    const [file] = await pickFiles(`.${SHARE_EXT}`);
    if (!file) return;
    setBusy(true);
    await startFromShareFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    setBusy(false);
  };

  return (
    <div className="onboarding">
      <div className="card box">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <div className="grow">
            <h1>{t("onboarding.welcome")}</h1>
            <div className="muted">{t("onboarding.tagline")}</div>
          </div>
          <select className="select sm" style={{ width: 120 }} value={settings.language} onChange={(e) => settings.set("language", e.target.value)}>
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="card pad" style={{ background: "var(--panel-2)", marginBottom: 18 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <FileUp size={18} color="var(--accent)" />
            <h3>{t("onboarding.joinTitle")}</h3>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>{t("onboarding.joinText")}</p>
          <button className="btn" disabled={busy} onClick={importFile}>
            <FileUp size={15} /> {t("onboarding.importButton")}
          </button>
        </div>

        <div className="row" style={{ marginBottom: 10 }}>
          <Rocket size={18} color="var(--accent)" />
          <h3>{t("onboarding.createTitle")}</h3>
        </div>
        <div className="col" style={{ gap: 12 }}>
          <Field label={t("onboarding.teamName")}>
            <input className="input" value={team} placeholder={t("onboarding.teamNamePh")} onChange={(e) => setTeam(e.target.value)} autoFocus />
          </Field>
          <Field label={t("onboarding.players")}>
            <div className="col" style={{ gap: 6 }}>
              {players.map((p, i) => (
                <div key={i} className="row">
                  <input
                    className="input sm"
                    value={p}
                    placeholder={t("onboarding.playerPh", { n: i + 1 })}
                    onChange={(e) => setPlayers(players.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {players.length > 1 && (
                    <button className="btn icon sm ghost" onClick={() => setPlayers(players.filter((_, j) => j !== i))}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button className="btn sm ghost" style={{ alignSelf: "flex-start" }} onClick={() => setPlayers([...players, ""])}>
                <Plus size={14} /> {t("onboarding.addPlayer")}
              </button>
            </div>
          </Field>
          <div className="muted small">{t("onboarding.photosLater")}</div>
          <button className="btn primary" disabled={busy} onClick={create}>
            <Rocket size={15} /> {t("onboarding.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
