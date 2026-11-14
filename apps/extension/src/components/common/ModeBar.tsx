export type ModeKey = 'basic' | 'strict' | 'refine';

interface Props {
  active: ModeKey;
  onChange: (mode: ModeKey) => void;
  disabled?: boolean;
}

const MODES: { key: ModeKey; icon: string; label: string }[] = [
  { key: 'basic', icon: '🧺', label: '기본' },
  { key: 'strict', icon: '🔍', label: '섬세' },
  { key: 'refine', icon: '🎯', label: '부분' },
];

// 결과 화면 위쪽의 세탁 방식 전환. 기본 ↔ 섬세는 판정을 다시 하지 않는다.
function ModeBar({ active, onChange, disabled }: Props) {
  return (
    <nav className="modebar" aria-label="세탁 방식">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          className={m.key === active ? 'modebar-btn is-active' : 'modebar-btn'}
          aria-pressed={m.key === active}
          disabled={disabled}
          onClick={() => onChange(m.key)}
        >
          <span aria-hidden="true">{m.icon}</span> {m.label} 세탁
        </button>
      ))}
    </nav>
  );
}

export default ModeBar;
