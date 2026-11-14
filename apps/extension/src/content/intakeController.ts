/**
 * content script 입고 조율. (design.md "content/intakeController.ts")
 * 메시지를 받고, 탭 세션을 확인하고, 어댑터를 실행하고, 결과를 저장하고 메시지를 보낸다.
 *
 * 모든 의존성(경로, 세션 읽기·쓰기·지우기, 메시지 전송, 어댑터와 그 의존성)을 주입받아
 * Node 테스트에서 DOM, chrome.* 없이 돌아간다. 리뷰 원문을 로그에 남기지 않는다.
 */
import { MAX_REVIEWS } from '../services/adapters/intakeConstants';
import type {
  IntakeDeps,
  IntakeErrorReason,
  IntakeMessage,
  IntakeResult,
  IntakeStopReason,
  ReviewAdapter,
  TabSession,
} from '../services/adapters/intakeTypes';

export interface ControllerDeps {
  getPathname: () => string;
  readSession: (tabId: number) => Promise<TabSession | null>;
  writeResult: (tabId: number, productId: string, r: IntakeResult, total: number) => Promise<void>;
  clearSession: (tabId: number) => Promise<void>;
  /** 패널이 닫혀 있으면 실패할 수 있다. 컨트롤러가 실패를 삼킨다. (Requirement 1.10) */
  send: (msg: IntakeMessage) => Promise<void>;
  adapter: ReviewAdapter;
  adapterDeps: Omit<IntakeDeps, 'onProgress'>;
}

export interface IntakeController {
  handleStart(tabId: number): Promise<void>;
}

interface Progress {
  done: number;
  total: number;
}

/**
 * 리뷰 0개로 멈췄을 때의 `intake:error` 이유. (Requirement 1.6)
 * `hidden_tab`은 MVP에서 나오지 않는다 (숨김 시 무기한 대기). 나오면 요청을 멈춘 경우라 `blocked`로 본다.
 */
export function toErrorReason(reason: IntakeStopReason): IntakeErrorReason {
  switch (reason) {
    case 'unexpected':
      return 'parse_failed';
    case 'blocked':
    case 'captcha':
    case 'hidden_tab':
      return 'blocked';
  }
}

export function createIntakeController(deps: ControllerDeps): IntakeController {
  /** 탭별 진행 중인 입고의 현재 진행률. 키가 있으면 진행 중. (Requirement 1.9) */
  const running = new Map<number, Progress>();

  /** 전송 실패(동기 예외, 거부)를 모두 무시한다. (Requirement 1.10) */
  const safeSend = async (msg: IntakeMessage): Promise<void> => {
    try {
      await deps.send(msg);
    } catch {
      // 받을 사이드 패널이 없다. 입고와 저장은 계속한다.
    }
  };

  async function runIntake(tabId: number, productId: string, progress: Progress): Promise<void> {
    // 3. 저장값 확인 (Requirements 2.3, 2.4)
    const saved = await deps.readSession(tabId);
    if (saved !== null && saved.productId === productId) {
      await safeSend({
        type: 'intake:done',
        tabId,
        reviews: saved.reviews,
        partial: saved.intake.partial,
        reason: saved.intake.reason,
        sources: saved.intake.sources,
      });
      return;
    }
    if (saved !== null) await deps.clearSession(tabId);

    // 4. 입고와 진행률 (Requirements 1.2, 1.3)
    let result: IntakeResult;
    try {
      result = await deps.adapter.run(productId, {
        ...deps.adapterDeps,
        onProgress: ({ done, total }) => {
          progress.done = done;
          progress.total = total;
          void safeSend({ type: 'intake:progress', tabId, done, total });
        },
      });
    } catch {
      // 어댑터는 예외를 던지지 않도록 만들어졌다. 그래도 던지면 읽은 것이 없으므로 parse_failed로 알린다.
      await safeSend({ type: 'intake:error', tabId, reason: 'parse_failed' });
      return;
    }

    // 5. 리뷰 0개 + 멈춤 → error, 저장하지 않음 (Requirement 1.6)
    if (result.reviews.length === 0 && result.reason !== null) {
      await safeSend({ type: 'intake:error', tabId, reason: toErrorReason(result.reason) });
      return;
    }

    // 리뷰 1개 이상, 또는 오류 없이 0개 → 저장 후 done (Requirements 1.4, 1.5, 2.1, 2.2)
    await deps.writeResult(tabId, productId, result, progress.total);
    await safeSend({
      type: 'intake:done',
      tabId,
      reviews: result.reviews,
      partial: result.partial,
      reason: result.reason,
      sources: result.sources,
    });
  }

  async function handleStart(tabId: number): Promise<void> {
    // 1. Product_Id (Requirement 1.7)
    const productId = deps.adapter.readProductId(deps.getPathname());
    if (productId === null) {
      await safeSend({ type: 'intake:error', tabId, reason: 'not_product_page' });
      return;
    }

    // 2. 진행 중이면 현재 진행률만 (Requirement 1.9)
    const current = running.get(tabId);
    if (current !== undefined) {
      await safeSend({ type: 'intake:progress', tabId, done: current.done, total: current.total });
      return;
    }

    // await 전에 진행 중으로 표시해 동시에 온 두 번째 시작을 막는다.
    const progress: Progress = { done: 0, total: MAX_REVIEWS };
    running.set(tabId, progress);
    try {
      await runIntake(tabId, productId, progress);
    } finally {
      // 6. 진행 중 표시 해제
      running.delete(tabId);
    }
  }

  return { handleStart };
}
