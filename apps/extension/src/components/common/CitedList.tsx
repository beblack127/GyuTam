import type { Cited } from '@star-laundry/core';

interface Props {
  title: string;
  items: Cited[];
  tone?: 'plain' | 'pro' | 'con';
  onCite: (ids: string[]) => void;
}

// 요약·장점·단점 문장. 문장마다 근거 리뷰가 있고, 누르면 그 리뷰 카드로 이동한다.
function CitedList({ title, items, tone = 'plain', onCite }: Props) {
  if (items.length === 0) return null;
  return (
    <section className={`cited cited--${tone}`}>
      <h3 className="cited-title">{title}</h3>
      <ul className="cited-list">
        {items.map((c) => (
          <li key={c.text}>
            <button type="button" className="cited-row" onClick={() => onCite(c.reviewIds)}>
              <span className="cited-text">{c.text}</span>
              <span className="cited-count">근거 {c.reviewIds.length}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CitedList;
