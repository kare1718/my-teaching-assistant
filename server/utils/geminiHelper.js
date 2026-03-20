const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function isConfigured() {
  return !!GEMINI_API_KEY;
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // 정상 응답
          if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
            resolve(json.candidates[0].content.parts[0].text.trim());
            return;
          }
          // 에러 응답 (API 키 오류, 할당량 초과 등)
          if (json.error) {
            reject(new Error(`Gemini API: ${json.error.message || json.error.status || '알 수 없는 오류'}`));
            return;
          }
          // 안전 필터로 차단된 경우
          if (json.candidates && json.candidates[0]?.finishReason === 'SAFETY') {
            reject(new Error('Gemini: 안전 필터에 의해 차단됨'));
            return;
          }
          // promptFeedback 차단
          if (json.promptFeedback?.blockReason) {
            reject(new Error(`Gemini: 프롬프트 차단 (${json.promptFeedback.blockReason})`));
            return;
          }
          console.error('Gemini 예상치 못한 응답:', JSON.stringify(json).slice(0, 500));
          reject(new Error('Gemini 응답 형식 오류 - 서버 로그를 확인하세요'));
        } catch (e) {
          console.error('Gemini 응답 파싱 실패, raw:', data.slice(0, 500));
          reject(new Error('Gemini 응답 파싱 실패'));
        }
      });
    });
    req.on('error', (e) => reject(new Error('Gemini 네트워크 오류: ' + e.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini API 타임아웃 (30초)')); });
    req.write(body);
    req.end();
  });
}

async function generateReportComment({ studentName, school, grade, items, templateFields }) {
  const fieldDescriptions = (templateFields || []).map(f => {
    const val = items[f.key];
    if (val === undefined || val === '') return null;
    if (f.type === 'auto_score' && typeof val === 'object') {
      return `${f.label}: ${val.exam_name} ${val.score}점/${val.max_score}점 (${val.rank_num}등)`;
    }
    return `${f.label}: ${val}`;
  }).filter(Boolean).join('\n');

  const prompt = `당신은 "강인한 국어 연구소"의 전문 국어 강사입니다.
다음은 ${studentName} 학생(${school} ${grade})의 수업 레포트 데이터입니다.

${fieldDescriptions}

위 데이터를 바탕으로 학부모에게 보내는 종합 코멘트를 작성해주세요.
규칙:
- 200자 내외로 간결하게
- 학생의 강점을 먼저 언급하고, 개선점은 긍정적 관점에서 제안
- 격식체(~습니다)로 작성
- 구체적인 데이터를 자연스럽게 언급
- 따뜻하고 전문적인 톤 유지`;

  return await callGemini(prompt);
}

module.exports = { isConfigured, callGemini, generateReportComment };
