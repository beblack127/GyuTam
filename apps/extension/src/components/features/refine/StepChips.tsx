import type { Step } from '@star-laundry/core';

import { fmtRating } from '@/utils/format';

interface Props {
  baseLabel: string;
  baseCount: number;
  baseAverage: number | null;
  steps: Step[];
  onBase: () => void;
  onPop: () => void;
  onReset: () => void;
}

const star = (avg: number | null) => (avg === null ? '' : ` ★${fmtRating(avg)}`);

// 조건 칩 줄: 🧺 기본 96 ★4.3 › 사진 있음 31 ★4.1 › 발열 4 ★2.3
function StepChips({ baseLabel, baseCount, baseAverage, steps, onBase, onPop, onReset }: Props) {
  return (
    <div className="steps">
      <ol className="steps-row" aria-label="찾은 조건">
        <li>
          <button type="button" className="step-chip step-chip--base" onClick={onBase} title="세탁 영수증 보기">
            {baseLabel} <span className="tabular">{baseCount}{star(baseAverage)}</span>
          </button>
        </li>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={`${s.request}-${i}`}>
              <span className="steps-sep" aria-hidden="true">
                ›
              </span>
              <span className={last ? 'step-chip is-current' : 'step-chip'}>
                {s.label} <span className="tabular">{s.rating.count}{star(s.rating.average)}</span>
                {last && (
                  <button type="button" className="step-x" aria-label={`${s.label} 조건 지우기`} onClick={onPop}>
                    ✕
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {steps.length > 0 && (
        <button type="button" className="link-btn" onClick={onReset}>
          처음부터
        </button>
      )}
    </div>
  );
}

export default StepChips;
