import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { lineupToObj } from "../components/LineupsView";
import { getEquipment } from "../data/equipment";
import { mapName } from "../data/maps";
import i18n from "../i18n";
import { getMediaUrl } from "./media";
import { getRoleAssignment, orderedMaps } from "../model/selectors";
import type { Playbook, Side, Tactic } from "../model/types";
import { levelsUsed, renderStepBoard } from "./exportImage";

export interface PdfOptions {
  mapIds: string[];
  cover: boolean;
  lineups: boolean;
  rounds: boolean;
  onProgress?: (done: number, total: number) => void;
}

const M = 14; // page margin (mm)
const ACCENT: [number, number, number] = [33, 150, 243];
const T_COLOR: [number, number, number] = [214, 140, 30];
const CT_COLOR: [number, number, number] = [60, 130, 200];

function toJpeg(c: HTMLCanvasElement, size = 900): string {
  const out = document.createElement("canvas");
  out.width = out.height = size;
  out.getContext("2d")!.drawImage(c, 0, 0, size, size);
  return out.toDataURL("image/jpeg", 0.86);
}

async function blobUrlToDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

// jsPDF's built-in fonts only cover WinAnsi; strip anything else (emoji etc.).
const clean = (s: string) => s.replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff€]/g, "");

export async function buildPlaybookPdf(pb: Playbook, opts: PdfOptions): Promise<Uint8Array> {
  const t = i18n.t.bind(i18n);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const CW = W - M * 2;
  let y = M;
  let first = true;

  const newPage = () => {
    if (!first) doc.addPage();
    first = false;
    y = M;
  };
  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, size: number, opts2: { bold?: boolean; color?: [number, number, number]; x?: number; maxW?: number } = {}) => {
    doc.setFont("helvetica", opts2.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts2.color ?? [30, 30, 30]));
    const lines = doc.splitTextToSize(clean(s), opts2.maxW ?? CW) as string[];
    const lh = size * 0.42;
    for (const l of lines) {
      ensure(lh);
      doc.text(l, opts2.x ?? M, y + lh * 0.8);
      y += lh;
    }
  };
  const sideColor = (s: Side | "both") => (s === "T" ? T_COLOR : s === "CT" ? CT_COLOR : ACCENT);
  const playerName = (id: string | null) => pb.players.find((p) => p.id === id)?.name ?? "";

  const maps = orderedMaps(pb).filter((m) => opts.mapIds.includes(m.def.id));
  const tactics = maps.flatMap((m) =>
    pb.tactics.filter((x) => x.mapId === m.def.id).sort((a, b) => a.side.localeCompare(b.side) || a.name.localeCompare(b.name)),
  );
  const totalSteps = tactics.reduce((s, x) => s + x.steps.length, 0) + (opts.lineups ? maps.length : 0);
  let done = 0;
  const tick = () => opts.onProgress?.(++done, totalSteps);

  // ---------------------------------------------------------------- cover
  if (opts.cover) {
    newPage();
    doc.setFillColor(15, 21, 29);
    doc.rect(0, 0, W, 62, "F");
    if (pb.team.logo) {
      const url = await getMediaUrl(pb.team.logo);
      if (url) {
        try {
          doc.addImage(await blobUrlToDataUrl(url), M, 12, 38, 38);
        } catch {
          /* unsupported logo format */
        }
      }
    }
    const tx = pb.team.logo ? M + 46 : M;
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(clean(pb.team.name), tx, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(170, 185, 200);
    doc.text(clean(`${t("pdf.playbook")} · ${new Date().toLocaleDateString()}`), tx, 42);
    y = 74;

    text(t("home.mapPool"), 15, { bold: true });
    y += 2;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [[t("pdf.map"), t("pdf.status"), t("pdf.comfort"), "T", "CT", t("pdf.note")]],
      body: orderedMaps(pb, true).map(({ def, data }) => [
        def.name,
        t(`pool.status.${data.status}`),
        data.comfort ? `${data.comfort}/5` : "-",
        String(pb.tactics.filter((x) => x.mapId === def.id && x.side === "T").length),
        String(pb.tactics.filter((x) => x.mapId === def.id && x.side === "CT").length),
        clean(data.poolNote),
      ]),
      headStyles: { fillColor: ACCENT },
      styles: { fontSize: 9 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    for (const side of ["T", "CT"] as Side[]) {
      const ra = getRoleAssignment(pb, "default", side);
      if (!ra || ra.slots.every((s) => !s.roleId && !s.playerId)) continue;
      ensure(30);
      text(t("pdf.defaultRoles", { side }), 13, { bold: true });
      y += 2;
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [ra.slots.map((s) => clean(pb.roles.find((r) => r.id === s.roleId)?.name ?? "-"))],
        body: [ra.slots.map((s) => clean(playerName(s.playerId)))],
        headStyles: { fillColor: sideColor(side) },
        styles: { fontSize: 10, halign: "center" },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }
  }

  // ---------------------------------------------------------------- tactics per map
  for (const { def } of maps) {
    const mapTactics = tactics.filter((x) => x.mapId === def.id);
    for (const tac of mapTactics) await tacticPages(tac);

    if (opts.lineups) {
      const lineups = pb.lineups.filter((l) => l.mapId === def.id);
      if (lineups.length) {
        newPage();
        header(`${def.name} · ${t("nav.lineups")}`, ACCENT);
        const fake: Tactic = {
          id: "lineups",
          mapId: def.id,
          side: "T",
          name: "",
          type: "other",
          buy: "any",
          tags: [],
          description: "",
          favorite: false,
          slots: [],
          steps: [{ id: "s", name: "", notes: "", objects: lineups.filter((l) => l.level === "default").map(lineupToObj) }],
          createdAt: 0,
          updatedAt: 0,
        };
        const board = await renderStepBoard(pb, fake, fake.steps[0], { callouts: true });
        const size = 120;
        doc.addImage(toJpeg(board), "JPEG", M + (CW - size) / 2, y, size, size);
        y += size + 6;
        autoTable(doc, {
          startY: y,
          margin: { left: M, right: M },
          head: [[t("lineups.name"), t("editor.utility"), t("tactic.side"), t("lineups.technique"), t("lineups.description")]],
          body: lineups.map((l) => [clean(l.name), t(`util.${l.util}`), l.side === "both" ? "T/CT" : l.side, t(`technique.${l.technique}`), clean(l.description)]),
          headStyles: { fillColor: ACCENT },
          styles: { fontSize: 8.5 },
          columnStyles: { 4: { cellWidth: 70 } },
        });
        tick();
      }
    }
  }

  // ---------------------------------------------------------------- round plans
  if (opts.rounds && pb.rounds.length) {
    newPage();
    header(t("nav.rounds"), ACCENT);
    for (const r of pb.rounds) {
      ensure(30);
      text(`${r.name}  ·  ${t(`roundCat.${r.category}`)}  ·  ${r.side === "both" ? "T/CT" : r.side}${r.mapId ? `  ·  ${mapName(r.mapId)}` : ""}`, 12, { bold: true, color: sideColor(r.side) });
      if (r.minTeamMoney) text(t("pdf.minMoney", { money: r.minTeamMoney }), 9, { color: [110, 110, 110] });
      if (r.description) text(r.description, 9.5);
      if (r.category !== "rules" && r.buys.some((b) => b.items.length || b.note)) {
        y += 1;
        autoTable(doc, {
          startY: y,
          margin: { left: M, right: M },
          head: [[t("pdf.player"), t("rounds.buys"), t("editor.note")]],
          body: r.buys.map((b, i) => [
            clean(playerName(b.playerId) || `P${i + 1}`),
            b.items.map((id) => getEquipment(id)?.name ?? id).join(", "),
            clean(b.note),
          ]),
          headStyles: { fillColor: [80, 90, 100] },
          styles: { fontSize: 8.5 },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
      }
      y += 7;
    }
  }

  // page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(clean(`${pb.team.name} · CS2 Playbook`), M, H - 6);
    doc.text(`${i} / ${pages}`, W - M, H - 6, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));

  // ---------------------------------------------------------------- helpers

  function header(title: string, color: [number, number, number]) {
    doc.setFillColor(...color);
    doc.rect(M, y, CW, 1.2, "F");
    y += 4;
    text(title, 10, { bold: true, color });
    y += 1;
  }

  async function tacticPages(tac: Tactic) {
    newPage();
    header(`${mapName(tac.mapId)} · ${tac.side === "T" ? t("common.tSide") : t("common.ctSide")} · ${t(`tacticType.${tac.type}`)}`, sideColor(tac.side));
    text(tac.name || t("tactic.untitled"), 18, { bold: true });
    if (tac.tags.length) text(tac.tags.map((x) => `#${x}`).join("  "), 9, { color: [120, 120, 120] });
    y += 1;
    if (tac.description) {
      text(tac.description, 10);
      y += 2;
    }

    const single = tac.steps.length === 1 && levelsUsed(tac, tac.steps[0]).length === 1;
    const size = single ? 130 : (CW - 6) / 2;
    let col = 0;
    for (const [si, step] of tac.steps.entries()) {
      for (const level of levelsUsed(tac, step)) {
        const board = await renderStepBoard(pb, tac, step, { level });
        const noteLines = step.notes ? (doc.setFontSize(8.5), (doc.splitTextToSize(clean(step.notes), size) as string[])) : [];
        const blockH = size + 7 + noteLines.length * 3.6;
        if (col === 0) ensure(blockH);
        const x = single ? M + (CW - size) / 2 : M + col * (size + 6);
        const top = y;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
        const levelLabel = level === "lower" ? ` (${t("levels.lower")})` : "";
        if (!single) doc.text(clean(`${si + 1}. ${step.name}${levelLabel}`), x, top + 3.5);
        doc.addImage(toJpeg(board), "JPEG", x, top + (single ? 0 : 5), size, size);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(70, 70, 70);
        noteLines.forEach((l, i) => doc.text(l, x, top + size + (single ? 4 : 9) + i * 3.6));
        if (single || col === 1) {
          y = top + blockH + 2;
          col = 0;
        } else col = 1;
      }
      tick();
    }
    if (col === 1) y += size + 9;

    ensure(30);
    autoTable(doc, {
      startY: y + 2,
      margin: { left: M, right: M },
      head: [[t("pdf.player"), t("editor.role"), t("pdf.utility"), t("pdf.instructions")]],
      body: tac.slots.map((s, i) => {
        // Utility carried over between steps keeps its id - list each throw once.
        const seen = new Set<string>();
        const utils = tac.steps
          .flatMap((st) => st.objects)
          .filter((o) => o.kind === "utility" && o.slotId === s.id && !seen.has(o.id) && seen.add(o.id));
        const utilText = utils.map((u) => (u.kind === "utility" ? `${t(`util.${u.util}`)}${u.note ? ` (${u.note})` : ""}` : "")).join(", ");
        return [clean(playerName(s.playerId) || `P${i + 1}`), clean(s.role), clean(utilText), clean(s.notes)];
      }),
      headStyles: { fillColor: sideColor(tac.side) },
      styles: { fontSize: 9, valign: "top" },
      columnStyles: { 0: { cellWidth: 26, fontStyle: "bold" }, 1: { cellWidth: 24 }, 2: { cellWidth: 38 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }
}
