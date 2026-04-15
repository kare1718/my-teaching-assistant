import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';

export default function Shop() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [charData, setCharData] = useState(null);
  const [tab, setTab] = useState('shop'); // shop, history
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);

  const load = () => {
    Promise.all([
      api('/gamification/shop/items'),
      api('/gamification/shop/my-purchases'),
      api('/gamification/my-character'),
    ]).then(([it, pur, ch]) => {
      setItems(it);
      setPurchases(pur);
      setCharData(ch);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handlePurchase = async (item) => {
    if (buying) return;
    if (!charData || charData.points < item.price) {
      alert('포인트가 부족합니다!');
      return;
    }
    if (!confirm(`${item.name}을(를) ${item.price} 포인트로 구매하시겠습니까?`)) return;
    setBuying(item.id);
    try {
      await apiPost('/gamification/shop/purchase', { itemId: item.id });
      alert('구매 완료! 선생님께 확인 후 수령하세요.');
      load();
    } catch (e) {
      alert(e.message);
    }
    setBuying(null);
  };

  if (loading) return <div className="content" style={{ textAlign: 'center', padding: 40 }}>로딩 중...</div>;

  return (
    <div className="content" style={{ paddingBottom: 80 }}>
      {/* 헤더 */}
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>🛒 포인트 상점</h2>
        <div style={{
          display: 'inline-block', padding: '6px 16px', marginTop: 6,
          background: 'linear-gradient(135deg, oklch(80% 0.14 85), var(--warning))',
          color: 'oklch(30% 0.10 75)', borderRadius: 12, fontWeight: 700, fontSize: 16
        }}>
          💰 {charData?.points?.toLocaleString() || 0} P
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button
          onClick={() => setTab('shop')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 14,
            background: tab === 'shop' ? 'var(--primary)' : 'var(--muted)',
            color: tab === 'shop' ? 'white' : 'var(--foreground)'
          }}
        >🏪 상품</button>
        <button
          onClick={() => setTab('history')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 14,
            background: tab === 'history' ? 'var(--primary)' : 'var(--muted)',
            color: tab === 'history' ? 'white' : 'var(--foreground)'
          }}
        >📦 구매 내역</button>
      </div>

      {tab === 'shop' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {items.map(item => {
            const canBuy = charData && charData.points >= item.price;
            const soldOut = item.stock !== null && item.stock <= 0;
            return (
              <div key={item.id} className="card" style={{
                padding: 0, overflow: 'hidden', opacity: soldOut ? 0.5 : 1,
                display: 'flex', flexDirection: 'column'
              }}>
                {/* 상품 이미지/아이콘 */}
                <div style={{
                  height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, var(--secondary), var(--border))',
                  position: 'relative', overflow: 'hidden'
                }}>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                    />
                  ) : null}
                  <span style={{
                    fontSize: 48,
                    display: item.image_url ? 'none' : 'block'
                  }}>{item.icon || '🎁'}</span>
                  {soldOut && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: 'rgba(0,0,0,0.4)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 16
                    }}>품절</div>
                  )}
                  {item.stock !== null && item.stock > 0 && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(0,0,0,0.6)', color: 'white',
                      fontSize: 10, padding: '2px 6px', borderRadius: 8
                    }}>남은 수량: {item.stock}</div>
                  )}
                </div>
                <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{item.name}</div>
                  {item.description && (
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8, flex: 1 }}>
                      {item.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                    <span style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 15 }}>
                      {(item.price || 0).toLocaleString()} P
                    </span>
                    <button
                      onClick={() => handlePurchase(item)}
                      disabled={!canBuy || soldOut || buying === item.id}
                      style={{
                        padding: '6px 12px', borderRadius: 6, border: 'none',
                        background: canBuy && !soldOut ? 'var(--primary)' : 'var(--muted)',
                        color: canBuy && !soldOut ? 'white' : 'var(--muted-foreground)',
                        fontWeight: 600, fontSize: 12, cursor: canBuy && !soldOut ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {buying === item.id ? '...' : soldOut ? '품절' : '구매'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 30, color: 'var(--muted-foreground)' }}>
              등록된 상품이 없습니다.
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {purchases.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
              borderBottom: i < purchases.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <span style={{ fontSize: 24 }}>{p.icon || '🎁'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {new Date(p.created_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>
                  {p.price_paid?.toLocaleString()} P
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: p.status === 'completed' ? 'var(--success)' : 'var(--warning)'
                }}>
                  {p.status === 'completed' ? '수령 완료' : '대기 중'}
                </div>
              </div>
            </div>
          ))}
          {purchases.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted-foreground)' }}>
              구매 내역이 없습니다.
            </div>
          )}
        </div>
      )}

      {/* 포인트 만료 안내 */}
      <div style={{
        marginTop: 12, padding: '12px 14px', borderRadius: 10,
        background: 'linear-gradient(135deg, var(--warning-light), oklch(92% 0.10 90))',
        border: '1px solid oklch(80% 0.14 85)',
        fontSize: 12, color: 'oklch(35% 0.12 75)', lineHeight: 1.6
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ 포인트 만료 안내</div>
        <div>포인트는 <b>6개월 이내</b>에 사용하지 않으면 자동으로 소멸됩니다.</div>
        <div style={{ fontSize: 11, marginTop: 2, color: 'oklch(45% 0.12 70)' }}>
          퀴즈 풀기, 코드 입력, 상품 구매 등 활동이 6개월간 없으면 보유 포인트가 초기화됩니다.
        </div>
      </div>

      <button className="btn btn-outline" onClick={() => navigate('/student/game')}
        style={{ width: '100%', marginTop: 8 }}>← 게임 홈</button>
      <BottomTabBar />
    </div>
  );
}
