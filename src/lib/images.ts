import { useEffect, useState } from "react";
import type { MediaID } from "../model/types";
import { getMediaUrl } from "./media";

/** HTMLImageElement cache shared by all canvases (editor, thumbnails, exports). */
const cache = new Map<string, Promise<HTMLImageElement | null>>();
const loaded = new Map<string, HTMLImageElement>();

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        loaded.set(src, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

export function getLoadedImage(src: string | null | undefined): HTMLImageElement | undefined {
  return src ? loaded.get(src) : undefined;
}

/** Load an image by URL; returns the cached element synchronously when ready. */
export function useImage(src: string | null | undefined): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(() => getLoadedImage(src));
  useEffect(() => {
    let alive = true;
    if (!src) {
      setImg(undefined);
      return;
    }
    const ready = loaded.get(src);
    if (ready) {
      setImg(ready);
      return;
    }
    loadImage(src).then((i) => alive && setImg(i ?? undefined));
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}

/** Media ids resolve to blob URLs asynchronously; keep a sync map for canvas rendering. */
const mediaSrc = new Map<MediaID, string>();

export async function preloadMedia(ids: (MediaID | null | undefined)[]): Promise<void> {
  await Promise.all(
    ids.filter((x): x is MediaID => !!x).map(async (id) => {
      const url = await getMediaUrl(id);
      if (url) {
        mediaSrc.set(id, url);
        await loadImage(url);
      }
    }),
  );
}

export function useMediaImage(id: MediaID | null | undefined): HTMLImageElement | undefined {
  const [src, setSrc] = useState<string | undefined>(() => (id ? mediaSrc.get(id) : undefined));
  useEffect(() => {
    let alive = true;
    if (!id) {
      setSrc(undefined);
      return;
    }
    getMediaUrl(id).then((u) => {
      if (!alive || !u) return;
      mediaSrc.set(id, u);
      setSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return useImage(src);
}
