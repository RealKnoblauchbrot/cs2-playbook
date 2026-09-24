import { create } from "zustand";

export interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  text: string;
}

interface ToastState {
  toasts: Toast[];
  push(kind: Toast["kind"], text: string): void;
  dismiss(id: number): void;
}

let seq = 0;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push(kind, text) {
    const id = ++seq;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === "error" ? 8000 : 3500);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  info: (t: string) => useToasts.getState().push("info", t),
  success: (t: string) => useToasts.getState().push("success", t),
  error: (t: string) => useToasts.getState().push("error", t),
};
