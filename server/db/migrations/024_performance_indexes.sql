-- 024: 성능 최적화 복합 인덱스
-- 기존 단일 인덱스는 유지하고, 자주 조회되는 조합에만 복합 인덱스 추가
-- 모든 인덱스는 IF NOT EXISTS 로 멱등성 보장

-- ============================================================
-- attendance (academy_id, student_id, date / class_session_id)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_academy_student_date
  ON attendance(academy_id, student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_academy_session
  ON attendance(academy_id, class_session_id);

-- ============================================================
-- tuition_records
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tuition_records_academy_student_status
  ON tuition_records(academy_id, student_id, status);
CREATE INDEX IF NOT EXISTS idx_tuition_records_academy_status_due
  ON tuition_records(academy_id, status, due_date);

-- ============================================================
-- consultation_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_consultation_academy_student_date
  ON consultation_logs(academy_id, student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultation_academy_followup
  ON consultation_logs(academy_id, follow_up_date, follow_up_done);

-- ============================================================
-- student_events
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_student_events_academy_student_date
  ON student_events(academy_id, student_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_events_academy_type
  ON student_events(academy_id, event_type);

-- ============================================================
-- leads
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_academy_status_next
  ON leads(academy_id, status, next_contact_date);
CREATE INDEX IF NOT EXISTS idx_leads_academy_assigned
  ON leads(academy_id, assigned_to);

-- ============================================================
-- audit_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_academy_user_created
  ON audit_logs(academy_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_academy_action
  ON audit_logs(academy_id, action);

-- ============================================================
-- analytics_events
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_analytics_academy_type_created
  ON analytics_events(academy_id, event_type, created_at DESC);

-- ============================================================
-- class_sessions
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_class_sessions_academy_class_date
  ON class_sessions(academy_id, class_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_sessions_academy_date
  ON class_sessions(academy_id, session_date);

-- ============================================================
-- task_queue
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_task_queue_academy_status_priority
  ON task_queue(academy_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_task_queue_academy_assigned_status
  ON task_queue(academy_id, assigned_to, status);

-- ============================================================
-- tuition_adjustments
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tuition_adjustments_academy_record
  ON tuition_adjustments(academy_id, tuition_record_id);

-- ============================================================
-- tuition_refunds
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tuition_refunds_academy_status_created
  ON tuition_refunds(academy_id, status, created_at DESC);

-- ============================================================
-- sms_send_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_academy_created
  ON sms_send_logs(academy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_academy_status
  ON sms_send_logs(academy_id, status);
