import { describe, expect, it } from 'vitest';

import type { IntakeResult, Review } from '../services/adapters/intakeTypes';
import { readTabSession, tabKey, writeIntakeResult, type SessionArea } from './sessionStore';

function memoryArea(initial: Record<string, unknown> = {}): SessionArea & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    get: (async (key: string) => (key in data ? { [key]: data[key] } : {})) as SessionArea['get'],
    set: (async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    }) as SessionArea['set'],
    remove: (async (key: string) => {
      delete data[key];
    }) as SessionArea['remove'],
  };
}

function review(n: number): Review {
  return {
    id: `cp-${n}`,
    rating: 5,
    date: '2026-01-01',
    text: `가상 리뷰 ${n}`,
    badges: [],
    hasPhoto: false,
    photos: [],
    option: null,
    source: 'best',
  };
}

function result(count: number, partial: boolean): IntakeResult {
  return {
    reviews: Array.from({ length: count }, (_, i) => review(i + 1)),
    partial,
    reason: partial ? 'blocked' : null,
    sources: { best: count, latest: 0, duplicates: 0 },
    requests: 10,
  };
}

describe('writeIntakeResult', () => {
  it('끝까지 읽으면 total을 실제 리뷰 수로 맞춘다 (중복 제외 96개, 예상 최대치 100)', async () => {
    const area = memoryArea();
    await writeIntakeResult(7, '123', result(96, false), 100, area);
    const saved = await readTabSession(7, area);
    expect(saved?.intake.done).toBe(96);
    expect(saved?.intake.total).toBe(96);
    expect(saved?.intake.partial).toBe(false);
  });

  it('중간에 멈추면 total은 예상 최대치를 그대로 둔다', async () => {
    const area = memoryArea();
    await writeIntakeResult(7, '123', result(20, true), 100, area);
    const saved = await readTabSession(7, area);
    expect(saved?.intake.done).toBe(20);
    expect(saved?.intake.total).toBe(100);
    expect(saved?.intake.partial).toBe(true);
  });

  it('같은 상품이면 wash와 steps를 보존하고, 다른 상품이면 버린다', async () => {
    const area = memoryArea({
      [tabKey(7)]: { productId: '123', reviews: [], intake: {}, wash: { w: 1 }, steps: [1] },
    });
    await writeIntakeResult(7, '123', result(3, false), 100, area);
    expect(area.data[tabKey(7)]).toMatchObject({ wash: { w: 1 }, steps: [1] });

    await writeIntakeResult(7, '999', result(3, false), 100, area);
    expect(area.data[tabKey(7)]).not.toHaveProperty('wash');
    expect(area.data[tabKey(7)]).not.toHaveProperty('steps');
  });
});
