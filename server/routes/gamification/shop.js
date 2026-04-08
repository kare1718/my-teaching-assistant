const express = require('express');
const router = express.Router();
const { runQuery, runInsert, getOne, getAll, runBatch } = require('../../db/database');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// 게임 참여 가능한 사용자인지 확인 (조교/선생님만 차단, 관리자는 허용)
async function getGameStudent(req) {
  let student = await getOne("SELECT s.id, s.school FROM students s WHERE s.user_id = ? AND s.academy_id = ?", [req.user.id, req.academyId]);
  if (!student && req.user.role === 'admin') {
    await runQuery("INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      [req.user.id, '관리자', '관리자', '', '', req.academyId]);
    student = await getOne("SELECT s.id, s.school FROM students s WHERE s.user_id = ? AND s.academy_id = ?", [req.user.id, req.academyId]);
  }
  if (student && ['조교', '선생님'].includes(student.school)) return null;
  return student || null;
}

// === Student Shop ===

// 상점 아이템 목록
router.get('/shop/items', authenticateToken, async (req, res) => {
  const items = await getAll('SELECT * FROM shop_items WHERE is_active = 1 AND academy_id = ? ORDER BY price ASC', [req.academyId]);
  res.json(items);
});

// 상점 구매
// 상점 구매 중복 방지 락
const purchaseLocks = new Set();

router.post('/shop/purchase', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  // 동시 구매 방지
  if (purchaseLocks.has(student.id)) {
    return res.status(429).json({ error: '구매 처리 중입니다. 잠시 후 다시 시도하세요.' });
  }
  purchaseLocks.add(student.id);

  try {
    const { itemId } = req.body;

    const result = await runBatch(async (tx) => {
      // Check item exists and is active (within transaction)
      const item = await tx.getOne('SELECT * FROM shop_items WHERE id = ? AND is_active = 1 AND academy_id = ?', [itemId, req.academyId]);
      if (!item) return { error: '상품을 찾을 수 없습니다.', status: 404 };

      if (item.stock !== null && item.stock <= 0) {
        return { error: '재고가 없습니다.', status: 400 };
      }

      // Check points (within same transaction)
      const sc = await tx.getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
      if (!sc) return { error: '캐릭터 정보가 없습니다.', status: 404 };

      if (sc.points < item.price) {
        return { error: '포인트가 부족합니다.', status: 400 };
      }

      // Atomic point deduction
      await tx.run('UPDATE student_characters SET points = points - ? WHERE student_id = ? AND academy_id = ?', [item.price, student.id, req.academyId]);

      // Atomic stock decrement
      if (item.stock !== null) {
        await tx.run('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND stock > 0 AND academy_id = ?', [item.id, req.academyId]);
      }

      // Insert purchase record
      await tx.insert("INSERT INTO shop_purchases (student_id, item_id, price_paid, status, academy_id) VALUES (?, ?, ?, 'pending', ?)",
        [student.id, item.id, item.price, req.academyId]);

      // Insert XP log
      await tx.insert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'shop_purchase', ?, ?)",
        [student.id, -item.price, `상점 구매: ${item.name}`, req.academyId]);

      return { success: true, remainingPoints: sc.points - item.price };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ success: true, remainingPoints: result.remainingPoints });
  } finally {
    purchaseLocks.delete(student.id);
  }
});

// 내 구매 내역
router.get('/shop/my-purchases', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const purchases = await getAll(
    `SELECT sp.*, si.name, si.icon FROM shop_purchases sp
     JOIN shop_items si ON sp.item_id = si.id
     WHERE sp.student_id = ? AND sp.academy_id = ? ORDER BY sp.created_at DESC`,
    [student.id, req.academyId]
  );
  res.json(purchases);
});

// === Admin Shop ===

router.get('/admin/shop', authenticateToken, requireAdmin, async (req, res) => {
  const items = await getAll('SELECT * FROM shop_items WHERE academy_id = ? ORDER BY created_at DESC', [req.academyId]);
  res.json(items);
});

router.post('/admin/shop', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, icon, price, stock, imageUrl } = req.body;
  const id = await runInsert(
    'INSERT INTO shop_items (name, description, icon, price, stock, image_url, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, description || '', icon || '', price || 0, stock !== undefined ? stock : null, imageUrl || '', req.academyId]
  );
  res.json({ message: '상품이 추가되었습니다.', id });
});

router.put('/admin/shop/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, icon, price, stock, isActive, imageUrl } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }
  if (price !== undefined) { fields.push('price = ?'); values.push(price); }
  if (stock !== undefined) { fields.push('stock = ?'); values.push(stock); }
  if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive); }
  if (imageUrl !== undefined) { fields.push('image_url = ?'); values.push(imageUrl); }

  if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

  values.push(parseInt(req.params.id));
  values.push(req.academyId);
  await runQuery(`UPDATE shop_items SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, values);
  res.json({ message: '상품이 수정되었습니다.' });
});

router.delete('/admin/shop/:id', authenticateToken, requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM shop_items WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '상품이 삭제되었습니다.' });
});

// 구매 내역 (관리자)
router.get('/admin/shop/purchases', authenticateToken, requireAdmin, async (req, res) => {
  const purchases = await getAll(
    `SELECT sp.*, si.name as item_name, si.icon, u.name as student_name, s.school, s.grade
     FROM shop_purchases sp
     JOIN shop_items si ON sp.item_id = si.id
     JOIN students s ON sp.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE sp.academy_id = ? ORDER BY sp.created_at DESC`,
    [req.academyId]
  );
  res.json(purchases);
});

// 구매 상태 변경
router.put('/admin/shop/purchases/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { status, admin_note } = req.body;

  // 메모만 업데이트하는 경우
  if (admin_note !== undefined) {
    await runQuery('UPDATE shop_purchases SET admin_note = ? WHERE id = ? AND academy_id = ?', [admin_note, parseInt(req.params.id), req.academyId]);
  }

  if (!status) {
    return res.json({ message: '메모가 저장되었습니다.' });
  }
  const purchase = await getOne('SELECT * FROM shop_purchases WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  if (!purchase) return res.status(404).json({ error: '구매 내역을 찾을 수 없습니다.' });

  // 거절 시 포인트 환불
  if (status === 'rejected' && purchase.status !== 'rejected') {
    const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [purchase.student_id, req.academyId]);
    if (sc) {
      await runQuery('UPDATE student_characters SET points = points + ? WHERE student_id = ? AND academy_id = ?', [purchase.price_paid, purchase.student_id, req.academyId]);
      await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'shop_refund', ?, ?)",
        [purchase.student_id, purchase.price_paid, `구매 거절 환불: ${purchase.price_paid}P`, req.academyId]);

      // 재고 복구
      const item = await getOne('SELECT * FROM shop_items WHERE id = ? AND academy_id = ?', [purchase.item_id, req.academyId]);
      if (item && item.stock !== null) {
        await runQuery('UPDATE shop_items SET stock = stock + 1 WHERE id = ? AND academy_id = ?', [purchase.item_id, req.academyId]);
      }

      // 알림
      const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [purchase.student_id, req.academyId]);
      if (user) {
        await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
          [user.user_id, 'shop', '🔄 구매 거절 안내', `상점 구매가 거절되어 ${purchase.price_paid}P가 환불되었습니다.`, req.academyId]);
      }
    }
  }

  // 지급 완료 시 알림
  if (status === 'completed' && purchase.status !== 'completed') {
    const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [purchase.student_id, req.academyId]);
    if (user) {
      const item = await getOne('SELECT name FROM shop_items WHERE id = ? AND academy_id = ?', [purchase.item_id, req.academyId]);
      await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
        [user.user_id, 'shop', '🎁 상품 지급 완료!', `${item?.name || '상품'}이(가) 지급 완료되었습니다. 선생님께 확인하세요!`, req.academyId]);
    }
  }

  await runQuery('UPDATE shop_purchases SET status = ? WHERE id = ? AND academy_id = ?', [status, parseInt(req.params.id), req.academyId]);
  res.json({ message: status === 'rejected' ? '구매가 거절되고 포인트가 환불되었습니다.' : '구매 상태가 변경되었습니다.' });
});

module.exports = router;
