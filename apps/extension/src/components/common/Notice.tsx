import type { ReactNode } from 'react';

interface Props {
  tone?: 'info' | 'warn';
  children: ReactNode;
}

function Notice({ tone = 'info', children }: Props) {
  return (
    <p className={`notice notice--${tone}`} role={tone === 'warn' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export default Notice;
