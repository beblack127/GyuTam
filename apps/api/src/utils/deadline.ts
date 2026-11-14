// 요청 시작 시각 하나로 단계별 마감을 정한다 (design "시간 예산").

export interface Deadlines {
  start: number;
  judgeEnd: number;
  interpretEnd: number;
  selectEnd: number;
  summaryEnd: number;
}

export type Clock = () => number;

export const systemClock: Clock = () => Date.now();

export const JUDGE_MS = 20_000;
export const INTERPRET_MS = 5_000;
export const SELECT_MS = 17_000;
export const SUMMARY_MS = 26_000;
/** 남은 시간이 이보다 적으면 LLM을 부르지 않는다. */
export const MIN_CALL_MS = 1_000;

export function createDeadlines(start: number): Deadlines {
  return {
    start,
    judgeEnd: start + JUDGE_MS,
    interpretEnd: start + INTERPRET_MS,
    selectEnd: start + SELECT_MS,
    summaryEnd: start + SUMMARY_MS,
  };
}

export function remainingMs(endsAt: number, clock: Clock = systemClock): number {
  return endsAt - clock();
}

/** 마감까지 기다리고, 마감이 지나면 `timeout` 오류로 끝낸다. SDK가 abort를 무시해도 기다리지 않는다. */
export async function beforeDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  endsAt: number,
  clock: Clock = systemClock,
): Promise<T> {
  const left = remainingMs(endsAt, clock);
  if (left < MIN_CALL_MS) throw new DeadlineError();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DeadlineError());
    }, left);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class DeadlineError extends Error {
  constructor() {
    super('timeout');
    this.name = 'DeadlineError';
  }
}
