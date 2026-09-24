import { Layers, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { mapName } from "../data/maps";
import { tacticThumbnail } from "../lib/exportImage";
import type { Tactic } from "../model/types";
import { usePlaybook } from "../store/playbook";
import { useSettings } from "../store/settings";
import { PlayerAvatar } from "./PlayerAvatar";
import { SideBadge } from "./ui";

export function TacticCard({ tactic, showMap }: { tactic: Tactic; showMap?: boolean }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const pb = usePlaybook((s) => s.pb)!;
  const tokenStyle = useSettings((s) => s.tokenStyle);
  const [thumb, setThumb] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Render thumbnails only when the card scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      tacticThumbnail(pb, tactic).then((u) => alive && setThumb(u)).catch(() => {});
    });
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
    // pb players/photos affect thumbnails; tactic.updatedAt covers edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tactic.id, tactic.updatedAt, tokenStyle, pb.players]);

  const players = tactic.slots.map((s) => pb.players.find((p) => p.id === s.playerId));

  return (
    <div ref={ref} className="card hover tactic-card" onClick={() => nav(`/tactic/${tactic.id}`)}>
      <div className="thumb">{thumb ? <img src={thumb} alt="" /> : null}</div>
      <div className="body">
        <div className="row">
          <span className="name grow ellipsis">{tactic.name || t("tactic.untitled")}</span>
          {tactic.favorite && <Star size={14} className="fav" fill="currentColor" />}
        </div>
        <div className="row wrap" style={{ gap: 5 }}>
          <SideBadge side={tactic.side} />
          <span className="badge">{t(`tacticType.${tactic.type}`)}</span>
          {showMap && <span className="badge">{mapName(tactic.mapId)}</span>}
          {tactic.steps.length > 1 && (
            <span className="badge" title={t("steps.count", { count: tactic.steps.length })}>
              <Layers size={10} /> {tactic.steps.length}
            </span>
          )}
        </div>
        <div className="row" style={{ gap: 3 }}>
          {players.map((p, i) => (
            <PlayerAvatar key={i} player={p} size={20} fallback={`P${i + 1}`} ring={false} />
          ))}
        </div>
      </div>
    </div>
  );
}
