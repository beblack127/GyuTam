// 세탁기 그림. spin = 세탁 중(드럼 회전, 얼룩 점이 사라짐), done = 세탁 끝(멈춤, 도장).
// 움직임 줄이기 설정을 켠 사용자에게는 CSS에서 애니메이션을 끈다.
interface Props {
  state: 'spin' | 'done' | 'idle';
  size?: number;
  label?: string;
}

function Star({ x, y, s, fill = false }: { x: number; y: number; s: number; fill?: boolean }) {
  return (
    <svg
      className={fill ? 'wm-star wm-star--fill' : 'wm-star'}
      style={{ left: `${x}em`, top: `${y}em`, width: `${s}em`, height: `${s}em` }}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" />
    </svg>
  );
}

function Sparkle({ x, y, s, delay }: { x: number; y: number; s: number; delay: number }) {
  return (
    <svg
      className="wm-sparkle"
      style={{ left: `${x}em`, top: `${y}em`, width: `${s}em`, height: `${s}em`, animationDelay: `${delay}s` }}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z" />
    </svg>
  );
}

function WashingMachine({ state, size = 160, label }: Props) {
  const done = state === 'done';
  if (state === 'idle') {
    return (
      <div className="wm wm--idle" style={{ fontSize: `${size / 20}px` }} role="img" aria-label={label ?? '쉬고 있는 세탁기'}>
        <div className="wm-body">
          <div className="wm-panel">
            <span className="wm-dial" />
            <span className="wm-spacer" />
            <span className="wm-display" />
          </div>
          <div className="wm-door">
            <div className="wm-glass" />
          </div>
        </div>
        <span className="wm-foot" style={{ left: '3.4em' }} />
        <span className="wm-foot" style={{ left: '14.6em' }} />
      </div>
    );
  }
  return (
    <div
      className={`wm ${done ? 'wm--done' : 'wm--spin'}`}
      style={{ fontSize: `${size / 20}px` }}
      role="img"
      aria-label={label ?? (done ? '세탁이 끝난 세탁기' : '리뷰를 세탁하고 있는 세탁기')}
    >
      {done ? (
        <>
          <Sparkle x={0.4} y={3} s={2.2} delay={0} />
          <Sparkle x={17.6} y={0.6} s={1.8} delay={0.5} />
          <Sparkle x={18} y={15} s={1.6} delay={1} />
        </>
      ) : (
        <>
          <span className="wm-bubble wm-bubble--out" style={{ left: '15em', top: '1.8em', width: '1em', height: '1em' }} />
          <span className="wm-bubble wm-bubble--out" style={{ left: '16.6em', top: '2.2em', width: '0.7em', height: '0.7em', animationDelay: '0.7s' }} />
          <span className="wm-bubble wm-bubble--out" style={{ left: '13.8em', top: '2.2em', width: '0.6em', height: '0.6em', animationDelay: '1.3s' }} />
        </>
      )}
      <div className="wm-body">
        <div className="wm-panel">
          <span className="wm-dial" />
          <span className="wm-spacer" />
          <span className="wm-led" />
          <span className="wm-display">
            <span>{done ? '끝' : '세탁'}</span>
          </span>
        </div>
        <div className="wm-door">
          <div className="wm-rim" />
          <div className="wm-glass">
            {done ? (
              <div className="wm-drum wm-drum--settle">
                <Star x={2.4} y={2.4} s={4} fill />
                <Star x={1} y={1.2} s={1.4} />
                <Star x={6} y={5.6} s={1.4} />
              </div>
            ) : (
              <>
                <svg className="wm-water" viewBox="0 0 220 46" aria-hidden="true">
                  <path d="M0 12q15-10 30 0t30 0 30 0 30 0 30 0 30 0 30 0V46H0z" />
                </svg>
                <div className="wm-drum">
                  <Star x={1.2} y={1.8} s={1.8} />
                  <Star x={5.4} y={4.8} s={1.8} />
                  <span className="wm-card" />
                  <span className="wm-stain" style={{ left: '2.2em', top: '5.4em' }} />
                  <span className="wm-stain" style={{ left: '6.6em', top: '3.4em', width: '0.7em', height: '0.7em', animationDelay: '1.2s' }} />
                </div>
                <span className="wm-bubble" style={{ left: '2em', top: '6.2em', width: '0.8em', height: '0.8em' }} />
                <span className="wm-bubble" style={{ left: '5.8em', top: '6.6em', width: '0.6em', height: '0.6em', animationDelay: '0.9s' }} />
              </>
            )}
          </div>
        </div>
      </div>
      <span className="wm-foot" style={{ left: '3.4em' }} />
      <span className="wm-foot" style={{ left: '14.6em' }} />
      {done && <span className="wm-stamp">세탁 끝</span>}
    </div>
  );
}

export default WashingMachine;
