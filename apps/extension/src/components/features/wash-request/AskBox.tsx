import { useState, type FormEvent } from 'react';

interface Props {
  examples: string[];
  busy: boolean;
  disabled?: boolean;
  placeholder: string;
  onAsk: (request: string) => void;
}

// 부분 세탁 질문 창. 예시 칩을 누르면 입력칸에 들어간다.
function AskBox({ examples, busy, disabled, placeholder, onAsk }: Props) {
  const [text, setText] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy || disabled) return;
    onAsk(q);
    setText('');
  };

  return (
    <div className="ask">
      {examples.length > 0 && (
        <div className="ask-examples">
          {examples.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}
      <form className="ask-form" onSubmit={submit}>
        <label htmlFor="ask-input" className="sr-only">
          찾고 싶은 리뷰
        </label>
        <input
          id="ask-input"
          value={text}
          maxLength={200}
          placeholder={placeholder}
          disabled={busy || disabled}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={busy || disabled || !text.trim()}>
          {busy ? '찾는 중' : '찾기'}
        </button>
      </form>
    </div>
  );
}

export default AskBox;
