// 툴바 아이콘을 누르면 사이드 패널을 연다.
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
