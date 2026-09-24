import { Star, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { create } from "zustand";

// ------------------------------------------------------------------ Modal

export function Modal(props: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "normal" | "wide" | "xl";
  dismissable?: boolean;
}) {
  const { dismissable = true } = props;
  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissable, props.onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => dismissable && e.target === e.currentTarget && props.onClose()}>
      <div className={`modal ${props.size && props.size !== "normal" ? props.size : ""}`} role="dialog">
        <div className="modal-head">
          <h2>{props.title}</h2>
          {dismissable && (
            <button className="btn ghost icon sm" onClick={props.onClose}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="modal-body">{props.children}</div>
        {props.footer && <div className="modal-foot">{props.footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ Confirm / prompt dialogs

interface DialogReq {
  kind: "confirm" | "prompt";
  title: string;
  text?: string;
  okLabel?: string;
  danger?: boolean;
  initial?: string;
  resolve: (v: string | boolean | null) => void;
}

const useDialog = create<{ req: DialogReq | null }>(() => ({ req: null }));

export function confirmDialog(opts: { title: string; text?: string; okLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) =>
    useDialog.setState({ req: { kind: "confirm", ...opts, resolve: (v) => resolve(v === true) } }),
  );
}

export function promptDialog(opts: { title: string; text?: string; initial?: string; okLabel?: string }): Promise<string | null> {
  return new Promise((resolve) =>
    useDialog.setState({
      req: { kind: "prompt", ...opts, resolve: (v) => resolve(typeof v === "string" ? v : null) },
    }),
  );
}

export function DialogHost() {
  const { t } = useTranslation();
  const req = useDialog((s) => s.req);
  const [value, setValue] = useState("");
  useEffect(() => setValue(req?.initial ?? ""), [req]);
  if (!req) return null;
  const close = (v: string | boolean | null) => {
    useDialog.setState({ req: null });
    req.resolve(v);
  };
  const ok = () => close(req.kind === "prompt" ? value.trim() || null : true);
  return (
    <Modal
      title={req.title}
      onClose={() => close(null)}
      footer={
        <>
          <button className="btn ghost" onClick={() => close(null)}>
            {t("common.cancel")}
          </button>
          <button className={`btn ${req.danger ? "danger" : "primary"}`} onClick={ok} autoFocus={req.kind === "confirm"}>
            {req.okLabel ?? t("common.ok")}
          </button>
        </>
      }
    >
      {req.text && <p className="muted" style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{req.text}</p>}
      {req.kind === "prompt" && (
        <input
          className="input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ok()}
        />
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ Small components

export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: ReactNode; className?: string; title?: string }[];
  onChange: (v: T) => void;
  size?: "sm";
}) {
  return (
    <div className={`seg ${props.size ?? ""}`}>
      {props.options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          className={`${props.value === o.value ? "on" : ""} ${o.className ?? ""}`}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>(props: {
  value: T;
  tabs: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs">
      {props.tabs.map((tb) => (
        <button key={tb.value} className={props.value === tb.value ? "on" : ""} onClick={() => props.onChange(tb.value)}>
          {tb.label}
        </button>
      ))}
    </div>
  );
}

export const SWATCHES = [
  "#ffffff",
  "#29b6f6",
  "#ffca28",
  "#ef5350",
  "#66bb6a",
  "#ab47bc",
  "#ff8a65",
  "#26c6da",
  "#d4e157",
  "#90a4ae",
  "#000000",
];

export function ColorPicker(props: { value: string; onChange: (c: string) => void; colors?: string[] }) {
  const colors = props.colors ?? SWATCHES;
  const custom = !colors.includes(props.value);
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button
          key={c}
          className={`swatch ${props.value === c ? "on" : ""}`}
          style={{ background: c }}
          onClick={() => props.onChange(c)}
        />
      ))}
      <label className={`swatch custom ${custom ? "on" : ""}`} title="Custom">
        <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function TagInput(props: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const tag = draft.trim().replace(/,$/, "");
    if (tag && !props.value.includes(tag)) props.onChange([...props.value, tag]);
    setDraft("");
  };
  return (
    <div className="col" style={{ gap: 6 }}>
      {props.value.length > 0 && (
        <div className="row wrap" style={{ gap: 4 }}>
          {props.value.map((tag) => (
            <span key={tag} className="tag">
              {tag}
              <button onClick={() => props.onChange(props.value.filter((x) => x !== tag))}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input sm"
        value={draft}
        placeholder={props.placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

export function Stars(props: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={n <= props.value ? "on" : ""}
          onClick={() => props.onChange?.(n === props.value ? 0 : n)}
          disabled={!props.onChange}
        >
          <Star size={props.size ?? 16} fill={n <= props.value ? "currentColor" : "none"} />
        </button>
      ))}
    </span>
  );
}

export function Empty(props: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {props.icon}
      <div style={{ color: "var(--text-2)", fontWeight: 600 }}>{props.title}</div>
      {props.text && <div className="small">{props.text}</div>}
      {props.action}
    </div>
  );
}

export function Field(props: { label: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="field" style={props.style}>
      <label>{props.label}</label>
      {props.children}
    </div>
  );
}

export function SideBadge({ side }: { side: "T" | "CT" | "both" }) {
  if (side === "both") return <span className="badge">T / CT</span>;
  return <span className={`badge ${side.toLowerCase()}`}>{side}</span>;
}
