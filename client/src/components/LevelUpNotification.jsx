export default function LevelUpNotification({ level }) {
  return (
    <>
      <div style={{
        marginTop: 16, padding: '14px 20px', borderRadius: 14,
        background: 'linear-gradient(135deg, oklch(55% 0.20 290), oklch(50% 0.20 280))',
        color: 'white', animation: 'levelUpBounce 0.5s ease-out'
      }}>
        <div style={{ fontSize: 24 }}>🎉🎊🎉</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>LEVEL UP!</div>
        <div style={{ fontSize: 28, fontWeight: 900 }}>Lv.{level}</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>축하합니다! 레벨이 올랐습니다!</div>
      </div>
      <style>{`
        @keyframes levelUpBounce {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
