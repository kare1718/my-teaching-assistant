-- 021: 법적 고지 정보 (전자상거래법/개인정보보호법 필수 표시)

CREATE TABLE IF NOT EXISTS legal_info (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name VARCHAR(100),
  ceo_name VARCHAR(50),
  business_number VARCHAR(30),
  ecommerce_number VARCHAR(30),
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(100),
  privacy_officer VARCHAR(50),
  privacy_officer_email VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO legal_info (id, company_name, ceo_name, business_number, ecommerce_number, address, phone, email, privacy_officer, privacy_officer_email)
VALUES (1, '나만의 조교', '대표자명 (미설정)', '000-00-00000', '제0000-서울-0000호', '주소 미설정', '02-0000-0000', 'support@najogyo.com', '개인정보보호책임자 (미설정)', 'privacy@najogyo.com')
ON CONFLICT (id) DO NOTHING;
