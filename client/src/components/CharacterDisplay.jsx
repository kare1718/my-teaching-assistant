import { getStageInfo } from '../utils/gamification';

const stageStyles = {
  none: {},
  sparkle: {
    filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.5))',
  },
  glow: {
    filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))',
  },
  star: {
    filter: 'drop-shadow(0 0 10px rgba(147,51,234,0.6))',
  },
  crown: {
    filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.7))',
  },
  fire: {
    filter: 'drop-shadow(0 0 14px rgba(255,69,0,0.7))',
    animation: 'charFirePulse 1.5s ease-in-out infinite',
  },
  rainbow: {
    animation: 'charRainbow 2s linear infinite',
  },
};

export default function CharacterDisplay({ emoji, level, size = 64, showBadge = true }) {
  const stage = getStageInfo(level);
  const glowStyle = stageStyles[stage.glow] || {};

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* 배경 원 */}
      <div style={{
        width: size + 16, height: size + 16,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${stage.color}22, ${stage.color}44)`,
        border: `2px solid ${stage.color}66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...glowStyle,
      }}>
        <span style={{ fontSize: size * 0.7, lineHeight: 1 }}>{emoji}</span>
      </div>

      {/* 단계 뱃지 */}
      {showBadge && (
        <span style={{
          position: 'absolute', bottom: -4, right: -4,
          background: stage.color, color: 'white',
          fontSize: Math.max(9, size * 0.16), fontWeight: 700,
          padding: '2px 6px', borderRadius: 8,
          border: '2px solid white',
          whiteSpace: 'nowrap',
        }}>
          Lv.{level}
        </span>
      )}

      <style>{`
        @keyframes charFirePulse {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(255,69,0,0.5)); }
          50% { filter: drop-shadow(0 0 20px rgba(255,69,0,0.9)); }
        }
        @keyframes charRainbow {
          0% { filter: drop-shadow(0 0 10px red); }
          16% { filter: drop-shadow(0 0 12px orange); }
          33% { filter: drop-shadow(0 0 14px yellow); }
          50% { filter: drop-shadow(0 0 14px lime); }
          66% { filter: drop-shadow(0 0 12px cyan); }
          83% { filter: drop-shadow(0 0 10px violet); }
          100% { filter: drop-shadow(0 0 10px red); }
        }
      `}</style>
    </div>
  );
}
