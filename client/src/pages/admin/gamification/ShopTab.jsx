import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../../api';

export default function ShopTab() {
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [subTab, setSubTab] = useState('items');
  const [form, setForm] = useState({ name: '', description: '', icon: '🎁', price: '', stock: '', imageUrl: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '', icon: '', price: '', stock: '', imageUrl: '' });

  const load = () => {
    api('/gamification/admin/shop').then(setItems).catch(console.error);
    api('/gamification/admin/shop/purchases').then(setPurchases).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await apiPost('/gamification/admin/shop', {
        ...form,
        price: parseInt(form.price) || 0,
        stock: form.stock ? parseInt(form.stock) : null
      });
      setShowForm(false);
      setForm({ name: '', description: '', icon: '🎁', price: '', stock: '', imageUrl: '' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 상품을 삭제하시겠습니까?')) return;
    await apiDelete(`/gamification/admin/shop/${id}`);
    load();
  };

  const handleToggle = async (item) => {
    await apiPut(`/gamification/admin/shop/${item.id}`, { isActive: item.is_active ? 0 : 1 });
    load();
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name || '',
      description: item.description || '',
      icon: item.icon || '🎁',
      price: item.price?.toString() || '',
      stock: item.stock !== null ? item.stock.toString() : '',
      imageUrl: item.image_url || ''
    });
  };

  const handleEdit = async () => {
    try {
      await apiPut(`/gamification/admin/shop/${editingId}`, {
        name: editForm.name,
        description: editForm.description,
        icon: editForm.icon,
        price: parseInt(editForm.price) || 0,
        stock: editForm.stock ? parseInt(editForm.stock) : null,
        imageUrl: editForm.imageUrl
      });
      setEditingId(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const handlePurchaseStatus = async (purchaseId, status) => {
    await apiPut(`/gamification/admin/shop/purchases/${purchaseId}`, { status });
    load();
  };

  // 구매 수정 모달
  const [editPurchase, setEditPurchase] = useState(null);
  const [editPurchaseForm, setEditPurchaseForm] = useState({ status: '', admin_note: '' });

  const openEditPurchase = (p) => {
    setEditPurchase(p);
    setEditPurchaseForm({ status: p.status, admin_note: p.admin_note || '' });
  };

  const saveEditPurchase = async () => {
    if (!editPurchase) return;
    await apiPut(`/gamification/admin/shop/purchases/${editPurchase.id}`, {
      status: editPurchaseForm.status,
      admin_note: editPurchaseForm.admin_note,
    });
    setEditPurchase(null);
    load();
  };

  const pendingCount = purchases.filter(p => p.status === 'pending').length;
  const inputStyle = { padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, width: '100%', boxSizing: 'border-box' };

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
        <button onClick={() => setSubTab('items')} style={{
          flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          background: subTab === 'items' ? 'var(--primary)' : 'var(--muted)',
          color: subTab === 'items' ? 'white' : 'var(--foreground)'
        }}>상품 관리</button>
        <button onClick={() => setSubTab('purchases')} style={{
          flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          background: subTab === 'purchases' ? 'var(--primary)' : 'var(--muted)',
          color: subTab === 'purchases' ? 'white' : 'var(--foreground)',
          position: 'relative'
        }}>
          구매 내역
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: 'var(--destructive)', color: 'white',
              borderRadius: '50%', width: 18, height: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10
            }}>{pendingCount}</span>
          )}
        </button>
      </div>

      {subTab === 'items' && (
        <>
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); }} style={{ width: '100%', marginBottom: 'var(--space-2)' }}>
            + 상품 추가
          </button>

          {showForm && (
            <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 10 }}>새 상품 추가</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <input placeholder="상품명" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                <input placeholder="설명" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input placeholder="아이콘 (이모지)" value={form.icon}
                    onChange={e => setForm({ ...form, icon: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" placeholder="가격 (P)" value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" placeholder="재고" value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={() => setForm({ ...form, stock: '' })} style={{
                    padding: 'var(--space-2) var(--space-3)', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', background: !form.stock ? 'var(--primary-lighter)' : 'var(--card)', cursor: 'pointer', whiteSpace: 'nowrap',
                    color: !form.stock ? 'var(--primary)' : 'var(--foreground)'
                  }}>∞ 무제한</button>
                </div>
                <input placeholder="이미지 URL (선택)" value={form.imageUrl}
                  onChange={e => setForm({ ...form, imageUrl: e.target.value })} style={inputStyle} />
                <button className="btn btn-primary" onClick={handleCreate}>추가</button>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((item, i) => (
              <div key={item.id} style={{
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: item.is_active ? 1 : 0.5
              }}>
                {editingId === item.id ? (
                  <div style={{ padding: 14 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>✏️ 상품 수정</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input placeholder="상품명" value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} />
                      <input placeholder="설명" value={editForm.description}
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={inputStyle} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input placeholder="아이콘" value={editForm.icon}
                          onChange={e => setEditForm({ ...editForm, icon: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                        <input type="number" placeholder="가격 (P)" value={editForm.price}
                          onChange={e => setEditForm({ ...editForm, price: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="number" placeholder="재고" value={editForm.stock}
                          onChange={e => setEditForm({ ...editForm, stock: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                        <button type="button" onClick={() => setEditForm({ ...editForm, stock: '' })} style={{
                          padding: 'var(--space-2) 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', background: !editForm.stock ? 'var(--primary-lighter)' : 'var(--card)', cursor: 'pointer', whiteSpace: 'nowrap',
                          color: !editForm.stock ? 'var(--primary)' : 'var(--foreground)'
                        }}>∞ 무제한</button>
                      </div>
                      <input placeholder="이미지 URL" value={editForm.imageUrl}
                        onChange={e => setEditForm({ ...editForm, imageUrl: e.target.value })} style={inputStyle} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary" onClick={handleEdit} style={{ flex: 1 }}>저장</button>
                        <button className="btn btn-outline" onClick={() => setEditingId(null)} style={{ flex: 1 }}>취소</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <span style={{ fontSize: 24 }}>{item.icon || '🎁'}</span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {item.price}P · 재고: {item.stock !== null ? item.stock : '∞'}
                        {item.description && ` · ${item.description}`}
                      </div>
                    </div>
                    <button onClick={() => { startEdit(item); setShowForm(false); }} style={{
                      padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--primary)',
                      borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--primary)', cursor: 'pointer'
                    }}>수정</button>
                    <button onClick={() => handleToggle(item)} style={{
                      padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', background: 'var(--card)', cursor: 'pointer'
                    }}>{item.is_active ? '비활성' : '활성'}</button>
                    <button onClick={() => handleDelete(item.id)} style={{
                      padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--destructive)',
                      borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
                    }}>삭제</button>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>상품이 없습니다.</div>}
          </div>
        </>
      )}

      {subTab === 'purchases' && (() => {
        const rejectedCount = purchases.filter(p => p.status === 'rejected').length;
        const completedCount = purchases.filter(p => p.status === 'completed').length;
        return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {purchases.length > 0 && (
            <div style={{ padding: '8px 14px', background: 'var(--muted)', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', display: 'flex', gap: 10 }}>
              <span style={{ color: pendingCount > 0 ? 'var(--warning)' : 'var(--muted-foreground)' }}>대기 {pendingCount}건</span>
              <span style={{ color: 'var(--success)' }}>완료 {completedCount}건</span>
              {rejectedCount > 0 && <span style={{ color: 'var(--destructive)' }}>거절 {rejectedCount}건</span>}
            </div>
          )}
          {purchases.map((p, i) => (
            <div key={p.id} style={{
              padding: '10px 14px', borderBottom: i < purchases.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              background: p.status === 'pending' ? 'var(--warning-light)' : p.status === 'rejected' ? 'var(--destructive-light)' : 'transparent',
              opacity: p.status === 'rejected' ? 0.7 : 1,
            }}>
              <span style={{ fontSize: 20 }}>{p.icon || '🎁'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.student_name} · {p.item_name}
                  {p.status === 'pending' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', fontWeight: 600 }}>대기</span>}
                  {p.status === 'completed' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600 }}>지급완료</span>}
                  {p.status === 'rejected' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--destructive-light)', color: 'var(--destructive)', fontWeight: 600 }}>거절됨</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {p.school} {p.grade} · {new Date(p.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {p.price_paid}P
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
                {p.status === 'pending' && (
                  <>
                    <button onClick={() => handlePurchaseStatus(p.id, 'completed')}
                      className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>
                      지급 완료
                    </button>
                    <button onClick={() => { if (confirm(`${p.student_name}의 ${p.item_name} 구매를 거절하고 ${p.price_paid}P를 환불하시겠습니까?`)) handlePurchaseStatus(p.id, 'rejected'); }}
                      className="btn btn-danger btn-sm" style={{ fontSize: 11 }}>
                      거절
                    </button>
                  </>
                )}
                {p.status === 'completed' && (
                  <button onClick={() => handlePurchaseStatus(p.id, 'pending')}
                    className="btn btn-outline btn-sm" style={{ fontSize: 11 }}>
                    대기로
                  </button>
                )}
                {p.status === 'rejected' && (
                  <button onClick={() => handlePurchaseStatus(p.id, 'pending')}
                    className="btn btn-outline btn-sm" style={{ fontSize: 11 }}>
                    복구
                  </button>
                )}
                <button onClick={() => openEditPurchase(p)}
                  className="btn btn-outline btn-sm" style={{ fontSize: 11 }}>
                  수정
                </button>
              </div>
              {p.admin_note && (
                <div style={{ width: '100%', marginTop: 'var(--space-1)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--neutral-100)', fontSize: 11, color: 'var(--muted-foreground)' }}>
                  📝 {p.admin_note}
                </div>
              )}
            </div>
          ))}
          {purchases.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>구매 내역이 없습니다.</div>}
        </div>
        );
      })()}

      {/* 구매 수정 모달 */}
      {editPurchase && (
        <>
          <div onClick={() => setEditPurchase(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: 380, maxWidth: '90vw', zIndex: 10001,
            boxShadow: 'var(--shadow-md)',
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>구매 수정</h3>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--neutral-50)', borderRadius: 'var(--radius)' }}>
              <strong>{editPurchase.student_name}</strong> · {editPurchase.item_name} · {editPurchase.price_paid}P
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>상태</label>
              <select value={editPurchaseForm.status} onChange={e => setEditPurchaseForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: 'var(--space-2) 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13 }}>
                <option value="pending">대기</option>
                <option value="completed">지급 완료</option>
                <option value="rejected">거절 (환불)</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>관리자 메모</label>
              <textarea value={editPurchaseForm.admin_note} onChange={e => setEditPurchaseForm(f => ({ ...f, admin_note: e.target.value }))}
                placeholder="메모 입력 (선택)"
                rows={3} style={{ width: '100%', padding: 'var(--space-2) 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-outline" onClick={() => setEditPurchase(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={saveEditPurchase} style={{ flex: 1 }}>저장</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
