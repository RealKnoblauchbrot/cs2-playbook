import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef } from "react";
import { Arrow, Circle, Ellipse, Group, Image as KImage, Label, Line, Rect, Tag, Text, Transformer, Wedge } from "react-konva";
import { equipmentIconUrl, UTILITY } from "../../data/equipment";
import { useImage, useMediaImage } from "../../lib/images";
import type {
  ArrowObj,
  BoardObject,
  DrawObj,
  EnemyObj,
  IconObj,
  ID,
  Player,
  PlayerObj,
  Side,
  TacticSlot,
  TextObj,
  UtilityObj,
  VisionObj,
  ZoneObj,
} from "../../model/types";
import type { TokenStyle } from "../../store/settings";
import { initials } from "../PlayerAvatar";

export const S = 1024;
const ACCENT = "#29b6f6";

export interface RenderCtx {
  side: Side;
  slots: Map<ID, TacticSlot>;
  slotIndex: Map<ID, number>;
  players: Map<ID, Player>;
  tokenStyle: TokenStyle;
  tokenScale: number;
  /** Multiply UI-ish sizes (handles) by this so they stay constant on screen. */
  handleScale: number;
}

export interface ObjProps<T extends BoardObject> {
  obj: T;
  ctx: RenderCtx;
  selected: boolean;
  draggable: boolean;
  opacity: number;
  listening: boolean;
  onSelect: (e: KonvaEventObject<MouseEvent>) => void;
  onChange: (patch: Partial<T>) => void;
}

const selGlow = (on: boolean) =>
  on ? { shadowColor: ACCENT, shadowBlur: 16, shadowOpacity: 1, shadowForStrokeEnabled: true } : { shadowBlur: 0 };

/** Dashed ring drawn around selected point objects. */
function SelRing({ r }: { r: number }) {
  return <Circle radius={r} stroke={ACCENT} strokeWidth={2.5} dash={[6, 4]} listening={false} />;
}

let measureCtx: CanvasRenderingContext2D | null = null;
export function measureText(text: string, size: number, weight = "700"): number {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  measureCtx!.font = `${weight} ${size}px "Segoe UI", sans-serif`;
  return measureCtx!.measureText(text).width;
}

const pinned = (e: KonvaEventObject<DragEvent>) => ({ x: e.target.x() / S, y: e.target.y() / S });

function useSnapNode(x: number, y: number) {
  // After a drag we reset the node to the stored position (store update re-renders it anyway).
  const ref = useRef<Konva.Group>(null);
  useEffect(() => {
    ref.current?.position({ x: x * S, y: y * S });
  }, [x, y]);
  return ref;
}

export function playerLabel(ctx: RenderCtx, slotId: ID): { name: string; color: string; player?: Player } {
  const slot = ctx.slots.get(slotId);
  const player = slot?.playerId ? ctx.players.get(slot.playerId) : undefined;
  const idx = ctx.slotIndex.get(slotId) ?? 0;
  return {
    name: player?.name ?? (slot?.role || `P${idx + 1}`),
    color: player?.color ?? "#78909c",
    player,
  };
}

// ------------------------------------------------------------------ Player

export function PlayerToken(p: ObjProps<PlayerObj>) {
  const { obj, ctx } = p;
  const { name, color, player } = playerLabel(ctx, obj.slotId);
  const cutout = useMediaImage(player?.cutout);
  const avatar = useMediaImage(player?.avatar);
  const ref = useSnapNode(obj.x, obj.y);
  const s = ctx.tokenScale;
  const useCutout = ctx.tokenStyle === "cutout" && !!cutout;
  const r = 19 * s;

  const labelSize = 13 * s;
  const labelW = measureText(name, labelSize) + 10 * s;
  const labelY = useCutout ? 9 * s : r + 6 * s;

  let body;
  if (useCutout) {
    const h = 74 * s;
    const w = (h * cutout.width) / cutout.height;
    body = (
      <>
        <Ellipse radiusX={17 * s} radiusY={6.5 * s} fill={color} opacity={0.95} stroke="#000" strokeWidth={1} />
        <KImage image={cutout} width={w} height={h} x={-w / 2} y={-h + 3 * s} shadowColor="#000" shadowBlur={6} shadowOpacity={0.7} />
      </>
    );
  } else {
    const img = avatar ?? cutout;
    let imgNode = null;
    if (img) {
      if (avatar) {
        const k = Math.max((2 * r) / img.width, (2 * r) / img.height);
        imgNode = <KImage image={img} width={img.width * k} height={img.height * k} x={(-img.width * k) / 2} y={(-img.height * k) / 2} />;
      } else {
        // Cutout as avatar: zoom onto the head.
        const w = 2.5 * r;
        const h = (w * img.height) / img.width;
        imgNode = <KImage image={img} width={w} height={h} x={-w / 2} y={-r * 1.15} />;
      }
    }
    body = (
      <>
        <Circle radius={r + 3 * s} fill={color} shadowColor="#000" shadowBlur={6} shadowOpacity={0.6} />
        <Group clipFunc={(c) => c.arc(0, 0, r, 0, Math.PI * 2)}>
          <Circle radius={r} fill={img ? "#1c2632" : color} />
          {imgNode ?? (
            <Text
              text={initials(name)}
              fontSize={15 * s}
              fontStyle="bold"
              fill="#0b1016"
              width={2 * r}
              height={2 * r}
              x={-r}
              y={-r}
              align="center"
              verticalAlign="middle"
            />
          )}
        </Group>
      </>
    );
  }

  return (
    <Group
      ref={ref}
      x={obj.x * S}
      y={obj.y * S}
      opacity={p.opacity}
      listening={p.listening}
      draggable={p.draggable}
      onMouseDown={p.onSelect}
      onDragStart={p.onSelect}
      onDragEnd={(e) => p.onChange(pinned(e))}
      {...selGlow(p.selected)}
    >
      {obj.facing != null && (
        <Wedge
          radius={(useCutout ? 34 : r + 16) * s}
          angle={50}
          rotation={obj.facing - 25}
          fill={color}
          opacity={0.35}
          listening={false}
        />
      )}
      {p.selected && !useCutout && <SelRing r={r + 8} />}
      {body}
      {p.selected && useCutout && <SelRing r={22 * s} />}
      <Label x={-labelW / 2} y={labelY}>
        <Tag fill={color} cornerRadius={4 * s} stroke={p.selected ? "#fff" : undefined} strokeWidth={1.5} />
        <Text text={name} fontSize={labelSize} fontStyle="bold" fill="#0b1016" padding={2.5 * s} width={labelW} align="center" />
      </Label>
    </Group>
  );
}

// ------------------------------------------------------------------ Enemy

export function EnemyToken(p: ObjProps<EnemyObj>) {
  const { obj } = p;
  const ref = useSnapNode(obj.x, obj.y);
  const color = p.ctx.side === "T" ? "#5aa2e0" : "#e9a23b";
  return (
    <Group
      ref={ref}
      x={obj.x * S}
      y={obj.y * S}
      opacity={p.opacity}
      listening={p.listening}
      draggable={p.draggable}
      onMouseDown={p.onSelect}
      onDragStart={p.onSelect}
      onDragEnd={(e) => p.onChange(pinned(e))}
      {...selGlow(p.selected)}
    >
      {p.selected && <SelRing r={19} />}
      <Circle radius={13} fill="#1b0f10" stroke={color} strokeWidth={3} />
      <Line points={[-6, -6, 6, 6]} stroke="#ef5350" strokeWidth={3.5} lineCap="round" />
      <Line points={[6, -6, -6, 6]} stroke="#ef5350" strokeWidth={3.5} lineCap="round" />
      {obj.label && (
        <Text
          text={obj.label}
          fontSize={12}
          fontStyle="bold"
          fill="#ffcdd2"
          y={16}
          width={120}
          x={-60}
          align="center"
          shadowColor="#000"
          shadowBlur={3}
        />
      )}
    </Group>
  );
}

// ------------------------------------------------------------------ Utility

export function utilityIcon(util: UtilityObj["util"], side: Side): string {
  if (util === "molotov") return side === "CT" ? "incgrenade" : "molotov";
  return UTILITY[util].icon;
}

export function UtilityMarker(p: ObjProps<UtilityObj> & { throwerColor?: string }) {
  const { obj, ctx } = p;
  const def = UTILITY[obj.util];
  const icon = useImage(equipmentIconUrl(utilityIcon(obj.util, ctx.side)));
  const ref = useSnapNode(obj.x, obj.y);
  const thrower = obj.slotId ? playerLabel(ctx, obj.slotId) : null;
  const hs = ctx.handleScale;
  const iconH = 22;
  const iconW = icon ? (iconH * icon.width) / icon.height : 0;

  return (
    <Group opacity={p.opacity} listening={p.listening}>
      {obj.from && (
        <>
          <Line
            points={[obj.from.x * S, obj.from.y * S, obj.x * S, obj.y * S]}
            stroke={def.color}
            strokeWidth={2}
            dash={[7, 6]}
            opacity={0.85}
            listening={false}
          />
          <Circle
            x={obj.from.x * S}
            y={obj.from.y * S}
            radius={p.selected ? 7 * Math.max(1, hs) : 5}
            fill={thrower?.color ?? def.color}
            stroke="#000"
            strokeWidth={1.5}
            draggable={p.draggable && p.selected}
            onMouseDown={p.onSelect}
            onDragMove={(e) => {
              // Live-update the trajectory line while dragging the throw spot.
              const line = e.target.getParent()?.findOne("Line") as Konva.Line | undefined;
              line?.points([e.target.x(), e.target.y(), obj.x * S, obj.y * S]);
            }}
            onDragEnd={(e) => p.onChange({ from: pinned(e) } as Partial<UtilityObj>)}
          />
        </>
      )}
      <Group
        ref={ref}
        x={obj.x * S}
        y={obj.y * S}
        draggable={p.draggable}
        onMouseDown={p.onSelect}
        onDragStart={p.onSelect}
        onDragMove={(e) => {
          if (!obj.from) return;
          const line = e.target.getParent()?.findOne("Line") as Konva.Line | undefined;
          line?.points([obj.from.x * S, obj.from.y * S, e.target.x(), e.target.y()]);
        }}
        onDragEnd={(e) => p.onChange(pinned(e))}
        {...selGlow(p.selected)}
      >
        {p.selected && <SelRing r={def.radius + 6} />}
        <Circle radius={def.radius} fill={def.color} opacity={obj.util === "smoke" ? 0.42 : 0.3} />
        <Circle radius={def.radius} stroke={def.color} strokeWidth={2} opacity={0.9} />
        {icon && (
          <KImage
            image={icon}
            width={iconW}
            height={iconH}
            x={-iconW / 2}
            y={-iconH / 2}
            shadowColor="#000"
            shadowBlur={4}
            shadowOpacity={0.9}
          />
        )}
        {thrower && (
          <Circle x={def.radius * 0.72} y={-def.radius * 0.72} radius={5} fill={thrower.color} stroke="#000" strokeWidth={1} />
        )}
      </Group>
    </Group>
  );
}

// ------------------------------------------------------------------ Arrow / line / draw

function flatToBoard(points: number[]) {
  return points.map((v) => v * S);
}

export function ArrowShape(p: ObjProps<ArrowObj>) {
  const { obj } = p;
  const pts = flatToBoard(obj.points);
  const common = {
    points: pts,
    stroke: obj.color,
    strokeWidth: obj.width,
    dash: obj.dashed ? [obj.width * 3, obj.width * 2.2] : undefined,
    tension: obj.curved ? 0.45 : 0,
    lineCap: "round" as const,
    lineJoin: "round" as const,
    hitStrokeWidth: Math.max(18, obj.width + 12),
  };
  const hs = p.ctx.handleScale;
  return (
    <Group opacity={p.opacity} listening={p.listening}>
      <Group
        draggable={p.draggable}
        onMouseDown={p.onSelect}
        onDragStart={p.onSelect}
        onDragEnd={(e) => {
          const dx = e.target.x() / S;
          const dy = e.target.y() / S;
          e.target.position({ x: 0, y: 0 });
          p.onChange({ points: obj.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) });
        }}
        {...selGlow(p.selected)}
      >
        {obj.head ? (
          <Arrow {...common} fill={obj.color} pointerLength={obj.width * 3.4 + 4} pointerWidth={obj.width * 3 + 4} />
        ) : (
          <Line {...common} />
        )}
      </Group>
      {p.selected &&
        p.draggable &&
        Array.from({ length: obj.points.length / 2 }, (_, i) => (
          <Circle
            key={i}
            x={pts[i * 2]}
            y={pts[i * 2 + 1]}
            radius={6 * hs}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={2 * hs}
            draggable
            onDragEnd={(e) => {
              const next = [...obj.points];
              next[i * 2] = e.target.x() / S;
              next[i * 2 + 1] = e.target.y() / S;
              p.onChange({ points: next });
            }}
          />
        ))}
    </Group>
  );
}

export function DrawShape(p: ObjProps<DrawObj>) {
  const { obj } = p;
  return (
    <Group
      opacity={p.opacity}
      listening={p.listening}
      draggable={p.draggable}
      onMouseDown={p.onSelect}
      onDragStart={p.onSelect}
      onDragEnd={(e) => {
        const dx = e.target.x() / S;
        const dy = e.target.y() / S;
        e.target.position({ x: 0, y: 0 });
        p.onChange({ points: obj.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) });
      }}
      {...selGlow(p.selected)}
    >
      <Line
        points={flatToBoard(obj.points)}
        stroke={obj.color}
        strokeWidth={obj.width}
        tension={0.4}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={Math.max(16, obj.width + 10)}
      />
    </Group>
  );
}

// ------------------------------------------------------------------ Zone

export function ZoneShape(p: ObjProps<ZoneObj>) {
  const { obj } = p;
  const nodeRef = useRef<Konva.Rect & Konva.Ellipse>(null);
  const trRef = useRef<Konva.Transformer>(null);
  useEffect(() => {
    if (p.selected && p.draggable && trRef.current && nodeRef.current) {
      trRef.current.nodes([nodeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [p.selected, p.draggable]);

  const w = obj.w * S;
  const h = obj.h * S;
  const shapeProps = {
    fill: obj.color,
    opacity: obj.opacity,
    stroke: obj.color,
    strokeWidth: 2,
    draggable: p.draggable,
    onMouseDown: p.onSelect,
    onDragStart: p.onSelect,
    ...selGlow(p.selected),
  };
  const commitTransform = (node: Konva.Node, isCircle: boolean) => {
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scale({ x: 1, y: 1 });
    const nw = (isCircle ? (node as Konva.Ellipse).radiusX() * 2 : node.width()) * sx;
    const nh = (isCircle ? (node as Konva.Ellipse).radiusY() * 2 : node.height()) * sy;
    const x = isCircle ? node.x() - nw / 2 : node.x();
    const y = isCircle ? node.y() - nh / 2 : node.y();
    p.onChange({ x: x / S, y: y / S, w: nw / S, h: nh / S });
  };

  return (
    <Group opacity={p.opacity} listening={p.listening}>
      {obj.shape === "rect" ? (
        <Rect
          ref={nodeRef}
          x={obj.x * S}
          y={obj.y * S}
          width={w}
          height={h}
          cornerRadius={4}
          {...shapeProps}
          onDragEnd={(e) => p.onChange({ x: e.target.x() / S, y: e.target.y() / S })}
          onTransformEnd={(e) => commitTransform(e.target, false)}
        />
      ) : (
        <Ellipse
          ref={nodeRef}
          x={obj.x * S + w / 2}
          y={obj.y * S + h / 2}
          radiusX={w / 2}
          radiusY={h / 2}
          {...shapeProps}
          onDragEnd={(e) => p.onChange({ x: (e.target.x() - w / 2) / S, y: (e.target.y() - h / 2) / S })}
          onTransformEnd={(e) => commitTransform(e.target, true)}
        />
      )}
      {obj.label && (
        <Text
          text={obj.label}
          x={obj.x * S}
          y={obj.y * S}
          width={w}
          height={h}
          align="center"
          verticalAlign="middle"
          fontSize={15}
          fontStyle="bold"
          fill="#fff"
          shadowColor="#000"
          shadowBlur={4}
          listening={false}
        />
      )}
      {p.selected && p.draggable && (
        <Transformer ref={trRef} rotateEnabled={false} keepRatio={false} borderStroke={ACCENT} anchorStroke={ACCENT} anchorSize={9} />
      )}
    </Group>
  );
}

// ------------------------------------------------------------------ Text

export function TextShape(p: ObjProps<TextObj>) {
  const { obj } = p;
  const ref = useSnapNode(obj.x, obj.y);
  return (
    <Group
      ref={ref}
      x={obj.x * S}
      y={obj.y * S}
      opacity={p.opacity}
      listening={p.listening}
      draggable={p.draggable}
      onMouseDown={p.onSelect}
      onDragStart={p.onSelect}
      onDragEnd={(e) => p.onChange(pinned(e))}
      {...selGlow(p.selected)}
    >
      <Text
        text={obj.text || "Text"}
        fontSize={obj.size}
        fontStyle="bold"
        fill={obj.color}
        shadowColor="#000"
        shadowBlur={5}
        shadowOpacity={1}
        offsetX={measureText(obj.text || "Text", obj.size) / 2}
        offsetY={obj.size / 2}
      />
    </Group>
  );
}

// ------------------------------------------------------------------ Icons

const GLYPHS: Record<string, string> = {
  eye: "◉",
  star: "★",
  warning: "!",
  x: "✕",
  question: "?",
  timer: "⏱",
};
const EQUIP_ICONS: Record<string, string> = { bomb: "c4", defuse: "defuser", awp: "awp" };

export function IconShape(p: ObjProps<IconObj>) {
  const { obj } = p;
  const ref = useSnapNode(obj.x, obj.y);
  const equip = EQUIP_ICONS[obj.icon];
  const img = useImage(equip ? equipmentIconUrl(equip) : null);
  const r = 15;
  let inner = null;
  if (equip && img) {
    const maxW = obj.icon === "awp" ? 40 : 20;
    const k = Math.min(maxW / img.width, 20 / img.height);
    inner = <KImage image={img} width={img.width * k} height={img.height * k} x={(-img.width * k) / 2} y={(-img.height * k) / 2} />;
  } else if (!equip) {
    inner = (
      <Text
        text={GLYPHS[obj.icon] ?? "?"}
        fontSize={18}
        fontStyle="bold"
        fill="#fff"
        width={2 * r}
        height={2 * r}
        x={-r}
        y={-r + 1}
        align="center"
        verticalAlign="middle"
      />
    );
  }
  return (
    <Group
      ref={ref}
      x={obj.x * S}
      y={obj.y * S}
      opacity={p.opacity}
      listening={p.listening}
      draggable={p.draggable}
      onMouseDown={p.onSelect}
      onDragStart={p.onSelect}
      onDragEnd={(e) => p.onChange(pinned(e))}
      {...selGlow(p.selected)}
    >
      {p.selected && <SelRing r={obj.icon === "awp" ? 32 : r + 6} />}
      {obj.icon === "awp" ? (
        <Rect x={-26} y={-r} width={52} height={2 * r} cornerRadius={r} fill={obj.color} stroke="#000" strokeWidth={1.5} />
      ) : (
        <Circle radius={r} fill={obj.color} stroke="#000" strokeWidth={1.5} />
      )}
      {inner}
    </Group>
  );
}

// ------------------------------------------------------------------ Vision cone

export function VisionShape(p: ObjProps<VisionObj>) {
  const { obj } = p;
  const ref = useSnapNode(obj.x, obj.y);
  const color = obj.slotId ? playerLabel(p.ctx, obj.slotId).color : obj.color;
  const len = obj.length * S;
  const rad = (obj.angle * Math.PI) / 180;
  const hs = p.ctx.handleScale;
  return (
    <Group opacity={p.opacity} listening={p.listening}>
      <Group
        ref={ref}
        x={obj.x * S}
        y={obj.y * S}
        draggable={p.draggable}
        onMouseDown={p.onSelect}
        onDragStart={p.onSelect}
        onDragEnd={(e) => p.onChange(pinned(e))}
        {...selGlow(p.selected)}
      >
        <Wedge radius={len} angle={obj.spread} rotation={obj.angle - obj.spread / 2} fill={color} opacity={0.2} />
        <Line
          points={[
            0,
            0,
            Math.cos(rad - (obj.spread * Math.PI) / 360) * len,
            Math.sin(rad - (obj.spread * Math.PI) / 360) * len,
          ]}
          stroke={color}
          strokeWidth={1.5}
          opacity={0.8}
        />
        <Line
          points={[
            0,
            0,
            Math.cos(rad + (obj.spread * Math.PI) / 360) * len,
            Math.sin(rad + (obj.spread * Math.PI) / 360) * len,
          ]}
          stroke={color}
          strokeWidth={1.5}
          opacity={0.8}
        />
        <Circle radius={4} fill={color} />
        {p.selected && <SelRing r={10} />}
      </Group>
      {p.selected && p.draggable && (
        <Circle
          x={obj.x * S + Math.cos(rad) * len}
          y={obj.y * S + Math.sin(rad) * len}
          radius={7 * hs}
          fill="#fff"
          stroke={ACCENT}
          strokeWidth={2 * hs}
          draggable
          onDragEnd={(e) => {
            const dx = e.target.x() - obj.x * S;
            const dy = e.target.y() - obj.y * S;
            p.onChange({
              angle: (Math.atan2(dy, dx) * 180) / Math.PI,
              length: Math.max(0.01, Math.hypot(dx, dy) / S),
            });
          }}
        />
      )}
    </Group>
  );
}

// ------------------------------------------------------------------ Dispatcher

export function BoardObjectNode(p: ObjProps<BoardObject>) {
  switch (p.obj.kind) {
    case "player":
      return <PlayerToken {...(p as ObjProps<PlayerObj>)} />;
    case "enemy":
      return <EnemyToken {...(p as ObjProps<EnemyObj>)} />;
    case "utility":
      return <UtilityMarker {...(p as ObjProps<UtilityObj>)} />;
    case "arrow":
      return <ArrowShape {...(p as ObjProps<ArrowObj>)} />;
    case "draw":
      return <DrawShape {...(p as ObjProps<DrawObj>)} />;
    case "zone":
      return <ZoneShape {...(p as ObjProps<ZoneObj>)} />;
    case "text":
      return <TextShape {...(p as ObjProps<TextObj>)} />;
    case "icon":
      return <IconShape {...(p as ObjProps<IconObj>)} />;
    case "vision":
      return <VisionShape {...(p as ObjProps<VisionObj>)} />;
  }
}

/** Draw order: area shapes at the bottom, players on top. */
const Z: Record<BoardObject["kind"], number> = {
  zone: 0,
  vision: 1,
  draw: 2,
  arrow: 3,
  utility: 4,
  icon: 5,
  enemy: 6,
  text: 7,
  player: 8,
};
export const zOrder = (a: BoardObject, b: BoardObject) => Z[a.kind] - Z[b.kind];
