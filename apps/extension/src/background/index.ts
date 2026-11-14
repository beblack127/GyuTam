// 툴바 아이콘을 누르면 사이드 패널을 연다.
import { registerIntakeRelay } from './intakeRelay';

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 패널의 intake:start를 탭의 content script로 전달하고, 탭별 입고 결과를 정리한다 (review-intake).
registerIntakeRelay();
