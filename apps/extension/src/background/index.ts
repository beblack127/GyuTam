// 서비스 워커가 시작될 때마다 최상위에서 실행한다.
// onInstalled 안에만 두면 브라우저나 서비스 워커가 재시작된 뒤에는 다시 실행되지 않는다.
import { registerIntakeRelay } from './intakeRelay';

// content script(규리)가 `tab:{tabId}` 레코드를 chrome.storage.session에 직접 쓴다 (intake.md).
// storage.session은 기본적으로 신뢰된 컨텍스트(확장 페이지, 서비스 워커)만 접근할 수 있어
// content script에서도 읽고 쓸 수 있도록 접근 수준을 연다.
// 실패해도 사이드 패널 동작은 막지 않는다. 오류 종류만 남기고 리뷰 데이터는 로그에 남기지 않는다.
chrome.storage.session
  .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  .catch((err: unknown) => {
    console.warn('[background] storage.session setAccessLevel 실패:', err instanceof Error ? err.name : typeof err);
  });

// 툴바 아이콘을 누르면 사이드 패널을 연다. 같은 값을 다시 설정해도 결과가 같으므로 최상위에서 호출한다.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => {
    console.warn('[background] sidePanel setPanelBehavior 실패:', err instanceof Error ? err.name : typeof err);
  });

// 패널의 intake:start를 탭의 content script로 전달하고, 탭별 입고 결과를 정리한다 (review-intake).
registerIntakeRelay();
