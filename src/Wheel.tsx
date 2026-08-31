import { PRIZES } from "./prizes";

type Props = {
  rotation: number;
  spinning: boolean;
};

export default function Wheel({ rotation, spinning }: Props) {
  const background = PRIZES.map((prize, index) => {
    const slice = 100 / PRIZES.length;
    const start = index * slice;
    return `${prize.color} ${start}% ${start + slice}%`;
  }).join(", ");

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" aria-hidden="true" />
      <div
        className={`wheel ${spinning ? "is-spinning" : ""}`}
        style={{
          background: `conic-gradient(${background})`,
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <div className="wheel-hub" aria-hidden="true">
          🎁
        </div>
        {PRIZES.map((prize, index) => {
          const angle = (360 / PRIZES.length) * index + 360 / PRIZES.length / 2;
          return (
            <span
              key={prize.id}
              className="wheel-label"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <span className="wheel-label-inner">
                <span className="gift-icon" aria-hidden="true">
                  🎁
                </span>
                <span>{prize.label}</span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
