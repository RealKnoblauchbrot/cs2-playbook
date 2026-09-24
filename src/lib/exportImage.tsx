import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { createRef } from "react";
import { Board, type BoardHandle } from "../components/board/Board";
import { utilityIcon } from "../components/board/objects";
import { equipmentIconUrl } from "../data/equipment";
import { getMap, mapName, radarUrl } from "../data/maps";
import { getCallouts } from "../model/selectors";
import type { LevelId, Playbook, Step, Tactic } from "../model/types";
import { useSettings } from "../store/settings";
import { loadImage, preloadMedia } from "./images";
import { platform } from "./platform";
import i18n from "../i18n";

const MARKER_EQUIP: Record<string, string> = { bomb: "c4", defuse: "defuser", awp: "awp" };

async function preloadFor(pb: Playbook, tactic: Tactic, steps: Step[]) {
  const urls = new Set<string>();
  const map = getMap(tactic.mapId);
  for (const l of map?.levels ?? [{ id: "default" as LevelId }]) urls.add(radarUrl(tactic.mapId, l.id));
  for (const s of steps)
    for (const o of s.objects) {
      if (o.kind === "utility") urls.add(equipmentIconUrl(utilityIcon(o.util, tactic.side)));
      if (o.kind === "icon" && MARKER_EQUIP[o.icon]) urls.add(equipmentIconUrl(MARKER_EQUIP[o.icon]));
    }
  const players = tactic.slots.map((s) => pb.players.find((p) => p.id === s.playerId)).filter(Boolean);
  await Promise.all([
    ...[...urls].map(loadImage),
    preloadMedia(players.flatMap((p) => [p!.cutout, p!.avatar])),
  ]);
}

export function levelsUsed(tactic: Tactic, step: Step): LevelId[] {
  const map = getMap(tactic.mapId);
  if (!map || map.levels.length < 2) return ["default"];
  const used = new Set(step.objects.map((o) => o.level));
  const levels = map.levels.map((l) => l.id).filter((l) => used.has(l));
  return levels.length ? levels : ["default"];
}

/** Serialize offscreen renders so thumbnails don't stall the UI. */
let queue: Promise<unknown> = Promise.resolve();

export function renderStepBoard(
  pb: Playbook,
  tactic: Tactic,
  step: Step,
  opts: { level?: LevelId; size?: number; callouts?: boolean } = {},
): Promise<HTMLCanvasElement> {
  const job = queue.then(async () => {
    await preloadFor(pb, tactic, [step]);
    const size = opts.size ?? 1024;
    const settings = useSettings.getState();
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-99999px;top:0;pointer-events:none";
    document.body.appendChild(host);
    const root = createRoot(host);
    const ref = createRef<BoardHandle>();
    try {
      flushSync(() =>
        root.render(
          <Board
            ref={ref}
            mapId={tactic.mapId}
            level={opts.level ?? "default"}
            side={tactic.side}
            objects={step.objects}
            slots={tactic.slots}
            players={pb.players}
            width={size}
            height={size}
            callouts={(opts.callouts ?? settings.showCallouts) ? getCallouts(pb, tactic.mapId) : null}
            tokenStyle={settings.tokenStyle}
            tokenScale={settings.tokenScale}
            background="#0b1016"
            hideOtherLevels
          />,
        ),
      );
      const canvas = ref.current?.toCanvas(1);
      if (!canvas) throw new Error("Render failed");
      return canvas;
    } finally {
      root.unmount();
      host.remove();
    }
  });
  queue = job.catch(() => undefined);
  return job;
}

// ------------------------------------------------------------------ Thumbnails

const thumbCache = new Map<string, Promise<string>>();

export function tacticThumbnail(pb: Playbook, tactic: Tactic): Promise<string> {
  const { tokenStyle, showCallouts } = useSettings.getState();
  const key = `${tactic.id}:${tactic.updatedAt}:${tokenStyle}:${showCallouts}`;
  let p = thumbCache.get(key);
  if (!p) {
    p = renderStepBoard(pb, tactic, tactic.steps[0], { size: 512, callouts: false }).then((c) => {
      const out = document.createElement("canvas");
      out.width = out.height = 320;
      out.getContext("2d")!.drawImage(c, 0, 0, 320, 320);
      return out.toDataURL("image/webp", 0.85);
    });
    thumbCache.set(key, p);
  }
  return p;
}

// ------------------------------------------------------------------ Composite image (board + notes table)

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

const FONT = '"Segoe UI", Inter, sans-serif';

export async function composeTacticImage(pb: Playbook, tactic: Tactic, stepIdx: number): Promise<HTMLCanvasElement> {
  const t = i18n.t.bind(i18n);
  const step = tactic.steps[stepIdx];
  const levels = levelsUsed(tactic, step);
  const boards = [];
  for (const level of levels) boards.push(await renderStepBoard(pb, tactic, step, { level }));

  const B = 1024;
  const W = B * boards.length;
  const pad = 28;
  const colW = (W - pad * 2) / 5;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `15px ${FONT}`;
  const noteLines = tactic.slots.map((s) => wrap(measure, s.notes || "", colW - 24));
  const utilCount = Math.max(...tactic.slots.map((s) => step.objects.filter((o) => o.kind === "utility" && o.slotId === s.id).length), 0);
  const tableH = 70 + (utilCount ? 28 : 0) + Math.max(1, ...noteLines.map((l) => l.length)) * 20 + 20;
  const stepNoteLines = step.notes ? wrap(measure, step.notes, W - pad * 2 - 20) : [];
  const stepNotesH = stepNoteLines.length ? stepNoteLines.length * 20 + 44 : 0;
  const headerH = 92;
  const H = headerH + B + stepNotesH + tableH + 34;

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b1016";
  g.fillRect(0, 0, W, H);

  // header
  g.fillStyle = "#0f151d";
  g.fillRect(0, 0, W, headerH);
  g.fillStyle = tactic.side === "T" ? "#e9a23b" : "#5aa2e0";
  g.fillRect(0, 0, 6, headerH);
  g.fillStyle = "#e6edf3";
  g.font = `bold 32px ${FONT}`;
  g.fillText(tactic.name || t("tactic.untitled"), pad, 44);
  g.font = `18px ${FONT}`;
  g.fillStyle = "#9aa7b6";
  const stepLabel = tactic.steps.length > 1 ? ` · ${t("steps.stepN", { n: stepIdx + 1, total: tactic.steps.length })}: ${step.name}` : "";
  g.fillText(`${mapName(tactic.mapId)} · ${tactic.side} · ${t(`tacticType.${tactic.type}`)}${stepLabel}`, pad, 74);
  g.textAlign = "right";
  g.font = `bold 20px ${FONT}`;
  g.fillStyle = "#29b6f6";
  g.fillText(pb.team.name, W - pad, 44);
  g.textAlign = "left";

  boards.forEach((b, i) => g.drawImage(b, i * B, headerH, B, B));
  if (boards.length > 1) {
    g.font = `bold 16px ${FONT}`;
    levels.forEach((l, i) => {
      g.fillStyle = "rgba(0,0,0,0.6)";
      g.fillRect(i * B + 12, headerH + 12, 90, 28);
      g.fillStyle = "#fff";
      g.fillText(t(`levels.${l}`), i * B + 22, headerH + 32);
    });
  }

  let y = headerH + B;
  if (stepNoteLines.length) {
    g.fillStyle = "#141b24";
    g.fillRect(pad, y + 14, W - pad * 2, stepNotesH - 20);
    g.fillStyle = "#c9d3de";
    g.font = `15px ${FONT}`;
    stepNoteLines.forEach((l, i) => g.fillText(l, pad + 12, y + 40 + i * 20));
    y += stepNotesH;
  }

  // per-player table
  y += 14;
  const icons = new Map<string, HTMLImageElement | null>();
  for (const s of tactic.slots)
    for (const o of step.objects)
      if (o.kind === "utility" && o.slotId === s.id) {
        const url = equipmentIconUrl(utilityIcon(o.util, tactic.side));
        if (!icons.has(url)) icons.set(url, await loadImage(url));
      }
  tactic.slots.forEach((slot, i) => {
    const x = pad + i * colW;
    const pl = pb.players.find((p) => p.id === slot.playerId);
    g.fillStyle = "#141b24";
    g.fillRect(x + 4, y, colW - 8, tableH - 14);
    g.fillStyle = pl?.color ?? "#78909c";
    g.fillRect(x + 4, y, colW - 8, 4);
    g.fillStyle = "#e6edf3";
    g.font = `bold 18px ${FONT}`;
    g.fillText(pl?.name ?? `P${i + 1}`, x + 16, y + 32);
    g.fillStyle = "#8b98a9";
    g.font = `14px ${FONT}`;
    g.fillText(slot.role, x + 16, y + 54);
    let ny = y + 76;
    const utils = step.objects.filter((o) => o.kind === "utility" && o.slotId === slot.id);
    if (utils.length) {
      let ix = x + 16;
      for (const u of utils) {
        if (u.kind !== "utility") continue;
        const img = icons.get(equipmentIconUrl(utilityIcon(u.util, tactic.side)));
        if (img) {
          const h = 18;
          const w = (h * img.width) / img.height;
          g.drawImage(img, ix, ny - 14, w, h);
          ix += w + 10;
        }
      }
      ny += 28;
    }
    g.fillStyle = "#c9d3de";
    g.font = `15px ${FONT}`;
    noteLines[i].forEach((l, li) => g.fillText(l, x + 16, ny + li * 20));
  });

  g.fillStyle = "#4d5b6b";
  g.font = `12px ${FONT}`;
  g.textAlign = "right";
  g.fillText("CS2 Playbook", W - pad, H - 12);
  return c;
}

export async function canvasToPng(c: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) throw new Error("PNG encoding failed");
  return new Uint8Array(await blob.arrayBuffer());
}

const fileSafe = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "tactic";

export async function saveTacticImage(pb: Playbook, tactic: Tactic, stepIdx: number): Promise<boolean> {
  const png = await canvasToPng(await composeTacticImage(pb, tactic, stepIdx));
  const suffix = tactic.steps.length > 1 ? `_step${stepIdx + 1}` : "";
  return platform.saveFile(`${fileSafe(mapName(tactic.mapId))}_${fileSafe(tactic.name)}${suffix}.png`, [{ name: "PNG", extensions: ["png"] }], png);
}

export async function copyTacticImage(pb: Playbook, tactic: Tactic, stepIdx: number): Promise<void> {
  const png = await canvasToPng(await composeTacticImage(pb, tactic, stepIdx));
  await platform.copyImage(png);
}
