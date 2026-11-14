import type { ReactNode } from 'react';

import WashingMachine from './WashingMachine';

interface Props {
  title: string;
  body: string;
  children?: ReactNode;
}

// 쿠팡 상품 페이지가 아닐 때, 세탁이 실패했을 때.
function StatusScreen({ title, body, children }: Props) {
  return (
    <div className="screen status">
      <div className="status-art" aria-hidden="true">
        <WashingMachine state="idle" size={96} />
      </div>
      <h1 className="status-title">{title}</h1>
      <p className="muted">{body}</p>
      <div className="status-actions">{children}</div>
    </div>
  );
}

export default StatusScreen;
