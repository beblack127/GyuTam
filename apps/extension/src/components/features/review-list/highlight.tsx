import type { ReactNode } from 'react';

interface Mark {
  phrase: string;
  className: string;
}

// 본문에서 근거 문장(얼룩 근거, 부분 세탁 quote)을 찾아 표시한다. 원문에 있는 문장만 표시된다.
export function highlight(text: string, marks: Mark[]): ReactNode[] {
  const ranges: { start: number; end: number; className: string }[] = [];
  for (const m of marks) {
    if (!m.phrase) continue;
    const start = text.indexOf(m.phrase);
    if (start < 0) continue;
    const end = start + m.phrase.length;
    if (ranges.some((r) => start < r.end && end > r.start)) continue;
    ranges.push({ start, end, className: m.className });
  }
  ranges.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) out.push(text.slice(cursor, r.start));
    out.push(
      <mark key={i} className={r.className}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}
