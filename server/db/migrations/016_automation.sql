-- 016: 자동화 엔진

-- 1. automation_rules (자동화 규칙)
CREATE TABLE IF NOT EXISTS automation_rules (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  name VARCHAR(200) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  conditions JSONB DEFAULT '{}',
  action_type VARCHAR(50) NOT NULL,
  action_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_rules_academy ON automation_rules(academy_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_type);

-- 2. automation_logs (실행 이력)
CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES automation_rules(id),
  academy_id INTEGER REFERENCES academies(id),
  trigger_data JSONB,
  action_result JSONB,
  status VARCHAR(20),
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_academy ON automation_logs(academy_id);

-- 3. task_queue (업무 큐)
CREATE TABLE IF NOT EXISTS task_queue (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  task_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  related_student_id INTEGER,
  related_entity_type VARCHAR(50),
  related_entity_id INTEGER,
  assigned_to INTEGER,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_queue_academy ON task_queue(academy_id);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_assigned ON task_queue(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON task_queue(priority);
