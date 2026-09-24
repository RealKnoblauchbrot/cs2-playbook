import { useMediaUrl } from "../lib/media";
import type { Player } from "../model/types";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export function PlayerAvatar(props: { player: Player | null | undefined; size?: number; fallback?: string; ring?: boolean }) {
  const { player, size = 32 } = props;
  const avatarUrl = useMediaUrl(player?.avatar);
  const cutoutUrl = useMediaUrl(player?.avatar ? null : player?.cutout);
  const url = avatarUrl ?? cutoutUrl;
  const color = player?.color ?? "#56687c";
  return (
    <span
      className={`avatar ${!avatarUrl && cutoutUrl ? "cutout" : ""}`}
      style={{
        width: size,
        height: size,
        background: url ? "#1c2632" : color,
        fontSize: size * 0.38,
        boxShadow: props.ring !== false ? `0 0 0 2px ${color}` : undefined,
      }}
      title={player?.name}
    >
      {url ? <img src={url} alt="" draggable={false} /> : initials(player?.name ?? props.fallback ?? "?")}
    </span>
  );
}
