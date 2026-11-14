import { beforeDeadline, systemClock } from '../../utils/deadline.ts';
import type { Clock } from '../../utils/deadline.ts';

export const BATCH_SIZE = 25;

export function chunk<T>(items: T[], size: number = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** 묶음을 병렬로 호출한다. 실패하거나 마감을 넘긴 묶음은 `failed`로 센다. 예외를 던지지 않는다. */
export async function runBatches<T, R>(
  batches: T[][],
  call: (batch: T[], signal: AbortSignal) => Promise<R>,
  endsAt: number,
  clock: Clock = systemClock,
): Promise<{ ok: R[]; failed: number; errorKinds: string[] }> {
  const settled = await Promise.allSettled(batches.map((b) => beforeDeadline((s) => call(b, s), endsAt, clock)));
  const ok: R[] = [];
  const errorKinds: string[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') ok.push(r.value);
    else errorKinds.push(errorKind(r.reason));
  }
  return { ok, failed: errorKinds.length, errorKinds };
}

export function errorKind(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { kind?: unknown; name?: unknown; message?: unknown };
    if (typeof e.kind === 'string') return e.kind;
    if (e.name === 'DeadlineError') return 'timeout';
    if (typeof e.name === 'string') return e.name;
  }
  return 'unknown';
}
