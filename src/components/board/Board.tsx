import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Group, Image as KImage, Label, Layer, Rect, Stage, Tag, Text } from "react-konva";
import { radarUrl } from "../../data/maps";
import { useImage } from "../../lib/images";
import type { BoardObject, Callout, ID, LevelId, Player, Side, TacticSlot } from "../../model/types";
import type { TokenStyle } from "../../store/settings";
import { BoardObjectNode, measureText, S, zOrder, type RenderCtx } from "./objects";
import type { Pt } from "./tools";

export interface View {
  zoom: number;
  panX: number;
  panY: number;
}
export const DEFAULT_VIEW: View = { zoom: 1, panX: 0, panY: 0 };

export interface BoardInteraction {
  /** Objects can be dragged/selected (select tool). */
  editable: boolean;
  /** Clicks go to objects (select/eraser) instead of the stage handler. */
  objectsListen: boolean;
  selectedIds: Set<ID>;
  cursor?: string;
  /** Left-drag on empty map pans the view (select tool). */
  panOnBackground?: boolean;
  onBackgroundDown?(): void;
  onObjectDown?(id: ID, e: KonvaEventObject<MouseEvent>): void;
  onObjectChange?(id: ID, patch: Partial<BoardObject>): void;
  onObjectDblClick?(id: ID): void;
  onPointerDown?(p: Pt, e: KonvaEventObject<MouseEvent>): void;
  onPointerMove?(p: Pt, e: KonvaEventObject<MouseEvent>): void;
  onPointerUp?(p: Pt, e: KonvaEventObject<MouseEvent>): void;
  draft?: BoardObject | null;
}

export interface BoardProps {
  mapId: string;
  level: LevelId;
  side: Side;
  objects: BoardObject[];
  slots: TacticSlot[];
  players: Player[];
  width: number;
  height: number;
  callouts?: Callout[] | null;
  tokenStyle: TokenStyle;
  tokenScale: number;
  interaction?: BoardInteraction;
  /** Tween from these objects (matched by id) using `progress` 0..1. */
  prevObjects?: BoardObject[] | null;
  progress?: number;
  view?: View;
  onViewChange?(v: View): void;
  background?: string;
  /** Hide objects from other levels instead of fading them. */
  hideOtherLevels?: boolean;
}

export interface BoardHandle {
  stage(): Konva.Stage | null;
  /** Render just the board area (1024x1024 board units) to a canvas. */
  toCanvas(pixelRatio?: number): HTMLCanvasElement | null;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function tween(objects: BoardObject[], prev: BoardObject[] | null | undefined, progress: number) {
  if (!prev || progress >= 1) return objects.map((o) => ({ o, alpha: 1 }));
  const k = ease(progress);
  const prevById = new Map(prev.map((o) => [o.id, o]));
  const prevBySlot = new Map(prev.filter((o) => o.kind === "player").map((o) => [(o as { slotId: ID }).slotId, o]));
  return objects.map((o) => {
    const from = prevById.get(o.id) ?? (o.kind === "player" ? prevBySlot.get(o.slotId) : undefined);
    if (!from || from.kind !== o.kind || !("x" in from) || !("x" in o)) return { o, alpha: k };
    const f = from as { x: number; y: number };
    return { o: { ...o, x: f.x + (o.x - f.x) * k, y: f.y + (o.y - f.y) * k } as BoardObject, alpha: 1 };
  });
}

export const Board = forwardRef<BoardHandle, BoardProps>(function Board(props, ref) {
  const { width, height, interaction: ix } = props;
  const stageRef = useRef<Konva.Stage>(null);
  const worldRef = useRef<Konva.Group>(null);
  const [innerView, setInnerView] = useState<View>(DEFAULT_VIEW);
  const view = props.view ?? innerView;
  const setView = props.onViewChange ?? setInnerView;
  const radar = useImage(radarUrl(props.mapId, props.level));
  const panning = useRef<{ x: number; y: number; view: View } | null>(null);

  const fit = (Math.min(width, height) / S) * 0.97;
  const scale = fit * view.zoom;
  const ox = width / 2 - (S / 2) * scale + view.panX;
  const oy = height / 2 - (S / 2) * scale + view.panY;

  useImperativeHandle(ref, () => ({
    stage: () => stageRef.current,
    toCanvas(pixelRatio = 1) {
      const world = worldRef.current;
      if (!world) return null;
      return world.toCanvas({
        x: ox,
        y: oy,
        width: S * scale,
        height: S * scale,
        pixelRatio: pixelRatio / scale,
      });
    },
  }));

  const ctx: RenderCtx = useMemo(
    () => ({
      side: props.side,
      slots: new Map(props.slots.map((s) => [s.id, s])),
      slotIndex: new Map(props.slots.map((s, i) => [s.id, i])),
      players: new Map(props.players.map((p) => [p.id, p])),
      tokenStyle: props.tokenStyle,
      tokenScale: props.tokenScale,
      handleScale: 1 / Math.max(scale, 0.2),
    }),
    [props.side, props.slots, props.players, props.tokenStyle, props.tokenScale, scale],
  );

  const toBoard = useCallback((): Pt | null => {
    const stage = stageRef.current;
    const world = worldRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos || !world) return null;
    const p = world.getAbsoluteTransform().copy().invert().point(pos);
    return { x: p.x / S, y: p.y / S };
  }, []);

  const shown = useMemo(() => {
    const sorted = [...props.objects].sort(zOrder);
    return tween(sorted, props.prevObjects, props.progress ?? 1);
  }, [props.objects, props.prevObjects, props.progress]);

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    if (!props.onViewChange && !ix) return;
    e.evt.preventDefault();
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const factor = e.evt.deltaY < 0 ? 1.15 : 1 / 1.15;
    const zoom = Math.min(8, Math.max(0.5, view.zoom * factor));
    const nextScale = fit * zoom;
    // keep the point under the cursor fixed
    const bx = (pos.x - ox) / scale;
    const by = (pos.y - oy) / scale;
    const nox = pos.x - bx * nextScale;
    const noy = pos.y - by * nextScale;
    setView({
      zoom,
      panX: nox - (width / 2 - (S / 2) * nextScale),
      panY: noy - (height / 2 - (S / 2) * nextScale),
    });
  };

  const isBackground = (e: KonvaEventObject<MouseEvent>) =>
    e.target === stageRef.current || e.target.name() === "radar" || e.target.name() === "bg";

  const startPan = (e: KonvaEventObject<MouseEvent>) => {
    panning.current = { x: e.evt.clientX, y: e.evt.clientY, view };
  };

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const btn = e.evt.button;
    if (btn === 1 || btn === 2) return startPan(e);
    if (btn !== 0) return;
    if (ix?.objectsListen && !isBackground(e)) return; // an object handles it
    if (!ix?.onPointerDown || ix.panOnBackground) {
      ix?.onBackgroundDown?.();
      if (ix || props.onViewChange) startPan(e);
      return;
    }
    const p = toBoard();
    if (p) ix.onPointerDown(p, e);
  };

  const onMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (panning.current) {
      const pv = panning.current;
      setView({ ...pv.view, panX: pv.view.panX + e.evt.clientX - pv.x, panY: pv.view.panY + e.evt.clientY - pv.y });
      return;
    }
    const p = ix?.onPointerMove ? toBoard() : null;
    if (p) ix!.onPointerMove!(p, e);
  };

  const onMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (panning.current) {
      panning.current = null;
      return;
    }
    const p = ix?.onPointerUp ? toBoard() : null;
    if (p) ix!.onPointerUp!(p, e);
  };

  const noop = () => {};

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => (panning.current = null)}
      onContextMenu={(e) => e.evt.preventDefault()}
      style={{ cursor: panning.current ? "grabbing" : ix?.cursor ?? "default" }}
    >
      <Layer>
        <Group ref={worldRef} x={ox} y={oy} scaleX={scale} scaleY={scale}>
          {props.background && <Rect name="bg" x={0} y={0} width={S} height={S} fill={props.background} />}
          {radar && <KImage name="radar" image={radar} width={S} height={S} />}

          {props.callouts && (
            <Group listening={false}>
              {props.callouts
                .filter((c) => c.level === props.level)
                .map((c) => (
                  <Label key={c.id} x={c.x * S} y={c.y * S} offsetX={measureText(c.name, 11, "600") / 2 + 2} offsetY={8} opacity={0.9}>
                    <Tag fill="rgba(6,10,15,0.62)" cornerRadius={3} pointerDirection="none" />
                    <Text text={c.name} fontSize={11} fill="#dfe7ef" padding={2} fontStyle="600" />
                  </Label>
                ))}
            </Group>
          )}

          <Group>
            {shown.map(({ o, alpha }) => {
              const other = o.level !== props.level;
              if (other && props.hideOtherLevels) return null;
              const listening = !other && !!ix?.objectsListen;
              return (
                <Group key={o.id} onDblClick={ix?.onObjectDblClick ? () => ix.onObjectDblClick!(o.id) : undefined}>
                  <BoardObjectNode
                    obj={o}
                    ctx={ctx}
                    selected={!!ix?.selectedIds.has(o.id)}
                    draggable={listening && !!ix?.editable}
                    listening={listening}
                    opacity={(other ? 0.22 : 1) * alpha}
                    onSelect={(e) => {
                      if (e.evt && "button" in e.evt && e.evt.button !== 0) return;
                      ix?.onObjectDown?.(o.id, e);
                    }}
                    onChange={ix?.onObjectChange ? (patch) => ix.onObjectChange!(o.id, patch) : noop}
                  />
                </Group>
              );
            })}
          </Group>

          {ix?.draft && (
            <Group listening={false} opacity={0.85}>
              <BoardObjectNode
                obj={ix.draft}
                ctx={ctx}
                selected={false}
                draggable={false}
                listening={false}
                opacity={1}
                onSelect={noop}
                onChange={noop}
              />
            </Group>
          )}
        </Group>
      </Layer>
    </Stage>
  );
});
