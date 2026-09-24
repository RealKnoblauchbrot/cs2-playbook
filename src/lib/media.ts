import { useEffect, useState } from "react";
import type { MediaID } from "../model/types";
import { platform } from "./platform";

/**
 * Media (player photos, lineup screenshots/videos, logos) is stored as files
 * named by content hash: "<hash>.<ext>". Same file => same id on every PC,
 * so share files never duplicate media.
 */

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},video/mp4,video/webm`;

export const mediaExt = (id: MediaID) => id.split(".").pop()?.toLowerCase() ?? "";
export const mediaMime = (id: MediaID) => MIME[mediaExt(id)] ?? "application/octet-stream";
export const isVideo = (id: MediaID) => mediaMime(id).startsWith("video/");

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

function extFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (MIME[fromName]) return fromName === "jpeg" ? "jpg" : fromName;
  const found = Object.entries(MIME).find(([, m]) => m === file.type);
  return found ? found[0] : "bin";
}

export async function putMediaBytes(bytes: Uint8Array, ext: string): Promise<MediaID> {
  const id = `${await hashBytes(bytes)}.${ext}`;
  if (!(await platform.hasMedia(id))) await platform.writeMedia(id, bytes);
  return id;
}

export async function putMediaFile(file: File): Promise<MediaID> {
  return putMediaBytes(new Uint8Array(await file.arrayBuffer()), extFor(file));
}

const urlCache = new Map<MediaID, Promise<string | null>>();

export function getMediaUrl(id: MediaID): Promise<string | null> {
  let p = urlCache.get(id);
  if (!p) {
    p = platform.readMedia(id).then((bytes) =>
      bytes ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: mediaMime(id) })) : null,
    );
    urlCache.set(id, p);
  }
  return p;
}

export function useMediaUrl(id: MediaID | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!id) {
      setUrl(null);
      return;
    }
    getMediaUrl(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

/** Open a native file picker (works in Tauri's WebView too). */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.oncancel = () => resolve([]);
    input.click();
  });
}
