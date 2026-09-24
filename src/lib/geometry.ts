/** Ramer–Douglas–Peucker simplification on a flat [x0,y0,x1,y1,...] array. */
export function simplify(points: number[], epsilon: number): number[] {
  const n = points.length / 2;
  if (n <= 2) return points;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = points[a * 2],
      ay = points[a * 2 + 1],
      bx = points[b * 2],
      by = points[b * 2 + 1];
    const dx = bx - ax,
      dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let maxD = -1,
      idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i * 2] - dx * points[i * 2 + 1] + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsilon && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i * 2], points[i * 2 + 1]);
  return out;
}

export function pathLength(points: number[]): number {
  let len = 0;
  for (let i = 2; i < points.length; i += 2) len += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
  return len;
}

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
