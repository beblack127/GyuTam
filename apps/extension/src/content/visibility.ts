/**
 * 탭 표시 상태 대기.
 * 탭이 보이면 바로 끝나고, 숨겨져 있으면 다시 보일 때까지 기다린다.
 * DOM은 읽기만 한다. 테스트에서 DOM 없이 쓸 수 있도록 최소 구조 타입을 받는다.
 */

export interface VisibilitySource {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export function waitUntilVisible(doc: VisibilitySource = document): Promise<void> {
  if (doc.visibilityState === 'visible') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const onChange = (): void => {
      if (doc.visibilityState !== 'visible') return;
      doc.removeEventListener('visibilitychange', onChange);
      resolve();
    };
    doc.addEventListener('visibilitychange', onChange);
  });
}
