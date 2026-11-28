/**
 * PDF / 이미지 정답표 AI 자동 인식 서비스 (Gemini 2.5 Flash 멀티모달)
 * - PDF(스캔본 포함) 및 정답표 사진(PNG/JPG/WebP)에서 문항별 객관식 정답, 배점, 영역, 해설지 쪽수 추출
 * - Google Drive 공유 링크(링크가 있는 모든 사용자 뷰어) 직접 다운로드 지원 (SSRF 차단: drive.google.com fileId 전용)
 */

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const CIRCLED_TO_NUM = {
  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
  'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5,
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5,
};

function detectMimeFromBuffer(buf, fallbackMime = '') {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  // PDF: %PDF-
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return 'application/pdf';
  }
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'image/jpeg';
  }
  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  const lower = String(fallbackMime || '').toLowerCase();
  if (ALLOWED_MIMES.has(lower)) return lower === 'image/jpg' ? 'image/jpeg' : lower;
  return null;
}

function normalizeChoiceAnswer(raw, maxChoices = 5) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw >= 1 && raw <= maxChoices ? raw : null;
  }
  const str = String(raw).trim();
  if (CIRCLED_TO_NUM[str] !== undefined) {
    const n = CIRCLED_TO_NUM[str];
    return n >= 1 && n <= maxChoices ? n : null;
  }
  // 예: "③번", "3번", "(3)" 등
  const circledMatch = str.match(/[①②③④⑤]/);
  if (circledMatch) {
    const n = CIRCLED_TO_NUM[circledMatch[0]];
    return n >= 1 && n <= maxChoices ? n : null;
  }
  const digitMatch = str.match(/^[\(\[\s]*([1-5])[\)\]\s번.]*$/);
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    return n >= 1 && n <= maxChoices ? n : null;
  }
  return null;
}

function parseGeminiJSON(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  try { return JSON.parse(cleaned); } catch {}
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return { questions: JSON.parse(arrMatch[0]) }; } catch {}
  }
  return null;
}

/**
 * Gemini 추출 JSON을 서버에서 안전하게 정규화·검증
 */
function sanitizeParsedAnswerKey(rawParsed, options = {}) {
  const warnings = [];
  if (!rawParsed || typeof rawParsed !== 'object') {
    throw new Error('PDF에서 정답표 구조를 인식하지 못했습니다. 선명한 정답표 PDF 또는 사진으로 다시 시도해 주세요.');
  }
  if (rawParsed.error) {
    throw new Error(String(rawParsed.error));
  }

  const rawList = Array.isArray(rawParsed.questions)
    ? rawParsed.questions
    : Array.isArray(rawParsed)
      ? rawParsed
      : [];

  let numChoices = Number(rawParsed.numChoices || options.expectedNumChoices || 5);
  if (![3, 4, 5].includes(numChoices)) numChoices = 5;

  const subjectiveSet = new Set();
  if (Array.isArray(rawParsed.subjectiveQuestions)) {
    rawParsed.subjectiveQuestions.forEach(n => {
      const parsed = parseInt(n, 10);
      if (parsed >= 1 && parsed <= 100) subjectiveSet.add(parsed);
    });
  }

  const byNum = new Map();
  let maxChoiceSeen = 0;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const num = parseInt(item.num ?? item.number ?? item.questionNum, 10);
    if (!Number.isInteger(num) || num < 1 || num > 100) continue;

    if (item.subjective === true || item.isSubjective === true) {
      subjectiveSet.add(num);
      continue;
    }

    const ans = normalizeChoiceAnswer(item.answer, 5);
    if (ans === null) {
      // 정답이 숫자가 아닌 서술형 텍스트일 수 있음
      if (item.answer && String(item.answer).trim().length > 0) {
        subjectiveSet.add(num);
      }
      continue;
    }
    if (ans > maxChoiceSeen) maxChoiceSeen = ans;

    let points = null;
    if (item.points !== null && item.points !== undefined && item.points !== '') {
      const p = Number(item.points);
      if (Number.isFinite(p) && p >= 0 && p <= 100) {
        points = Math.round(p * 100) / 100;
      }
    }

    let page = null;
    if (item.page !== null && item.page !== undefined && item.page !== '') {
      const pg = parseInt(item.page, 10);
      if (Number.isInteger(pg) && pg >= 1 && pg <= 500) page = pg;
    }

    const category = typeof item.category === 'string' && item.category.trim()
      ? item.category.trim().slice(0, 30)
      : null;

    const explanation = typeof item.explanation === 'string' && item.explanation.trim()
      ? item.explanation.trim().slice(0, 500)
      : null;

    byNum.set(num, {
      num,
      answer: ans,
      ...(points !== null ? { points } : {}),
      ...(page !== null ? { page } : {}),
      ...(category ? { category } : {}),
      ...(explanation ? { explanation } : {}),
    });
  }

  if (maxChoiceSeen > numChoices) {
    numChoices = maxChoiceSeen <= 4 ? 4 : 5;
  }

  const questions = Array.from(byNum.values()).sort((a, b) => a.num - b.num);
  if (questions.length === 0) {
    throw new Error('객관식 정답(①~⑤ / 1~5)을 찾지 못했습니다. 정답표가 포함된 페이지의 PDF나 이미지를 올려주세요.');
  }

  const maxQuestionNum = questions[questions.length - 1].num;
  const declaredNumQuestions = parseInt(rawParsed.numQuestions, 10);
  const numQuestions = Math.max(
    maxQuestionNum,
    Number.isInteger(declaredNumQuestions) && declaredNumQuestions >= maxQuestionNum && declaredNumQuestions <= 100
      ? declaredNumQuestions
      : maxQuestionNum
  );

  // 누락 문항 검출 (서술형으로 분류된 문항 제외)
  const missingQuestions = [];
  for (let i = 1; i <= numQuestions; i++) {
    if (!byNum.has(i) && !subjectiveSet.has(i)) {
      missingQuestions.push(i);
    }
  }
  if (missingQuestions.length > 0) {
    warnings.push(`인식 누락 문항 (${missingQuestions.length}개): ${missingQuestions.slice(0, 15).join(', ')}번${missingQuestions.length > 15 ? ' 외' : ''} — 직접 확인해 주세요.`);
  }

  const subjectiveQuestions = Array.from(subjectiveSet).sort((a, b) => a - b);
  if (subjectiveQuestions.length > 0) {
    warnings.push(`서술형·단답형 문항 제외 (${subjectiveQuestions.length}개): ${subjectiveQuestions.slice(0, 15).join(', ')}번`);
  }

  if (Array.isArray(rawParsed.warnings)) {
    rawParsed.warnings.forEach(w => {
      const s = String(w || '').trim();
      if (s && !warnings.includes(s)) warnings.push(s.slice(0, 160));
    });
  }

  // 배점 방식 자동 판별
  const withPoints = questions.filter(q => q.points !== undefined && q.points !== null);
  const uniquePointVals = new Set(withPoints.map(q => q.points));
  const hasIndividualPoints = withPoints.length >= Math.max(2, Math.floor(questions.length * 0.5)) && uniquePointVals.size > 1;
  const scoringType = hasIndividualPoints ? 'individual' : 'equal';

  let maxScore = Number(rawParsed.maxScore);
  if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) {
    if (withPoints.length === questions.length) {
      const sum = withPoints.reduce((acc, q) => acc + q.points, 0);
      maxScore = Math.round(sum * 100) / 100;
    } else {
      maxScore = 100;
    }
  }

  const pagesDetected = questions.filter(q => q.page !== undefined).length;
  const categoriesDetected = questions.filter(q => q.category).length;

  return {
    numQuestions,
    numChoices,
    maxScore,
    scoringType,
    recognizedCount: questions.length,
    pointsDetectedCount: withPoints.length,
    pagesDetectedCount: pagesDetected,
    categoriesDetectedCount: categoriesDetected,
    questions,
    missingQuestions,
    subjectiveQuestions,
    warnings,
    summaryNote: typeof rawParsed.summary === 'string' ? rawParsed.summary.trim().slice(0, 120) : '',
  };
}

/**
 * Google Drive 공유 링크에서 fileId 추출 (SSRF 방지: drive.google.com 도메인만 허용)
 */
function extractGoogleDriveFileId(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  const host = parsed.hostname.toLowerCase();
  if (host !== 'drive.google.com' && host !== 'docs.google.com') return null;

  const pathMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (pathMatch) return pathMatch[1];
  const idParam = parsed.searchParams.get('id');
  if (idParam && /^[a-zA-Z0-9_-]{10,}$/.test(idParam)) return idParam;
  return null;
}

async function fetchGoogleDrivePdfBuffer(rawUrl) {
  const fileId = extractGoogleDriveFileId(rawUrl);
  if (!fileId) {
    throw new Error('유효한 Google Drive 파일 공유 링크가 아닙니다. 파일을 직접 업로드해 주세요.');
  }

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(downloadUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`Google Drive 파일을 내려받지 못했습니다 (HTTP ${res.status}). "링크가 있는 모든 사용자(뷰어)" 권한인지 확인하거나 PDF를 직접 업로드해 주세요.`);
    }
    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength > MAX_FILE_BYTES) {
      throw new Error('파일 크기가 15MB를 초과합니다. 정답표 페이지만 추출한 PDF나 캡처 이미지를 업로드해 주세요.');
    }
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length > MAX_FILE_BYTES) {
      throw new Error('파일 크기가 15MB를 초과합니다. 정답표 페이지만 추출한 PDF나 캡처 이미지를 업로드해 주세요.');
    }
    const mimeType = detectMimeFromBuffer(buffer);
    if (!mimeType) {
      throw new Error('Google Drive 링크가 비공개이거나 PDF/이미지 형식이 아닙니다. "링크가 있는 모든 사용자" 공개 설정을 확인하거나 PDF 파일을 직접 올려주세요.');
    }
    return { buffer, mimeType };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Google Drive 다운로드 시간이 초과되었습니다. PDF 파일을 직접 업로드해 주세요.');
    }
    throw err;
  }
}

/**
 * Gemini 2.5 Flash로 PDF/이미지 정답표 자동 인식
 */
async function parseAnswerKeyFromFile({ buffer, mimeType, expectedNumQuestions, expectedNumChoices }) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    const err = new Error('서버에 GEMINI_API_KEY가 설정되어 있지 않습니다. 관리자 환경변수에 GEMINI_API_KEY를 등록해 주세요.');
    err.statusCode = 503;
    throw err;
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('업로드된 파일이 비어 있습니다.');
    err.statusCode = 400;
    throw err;
  }
  if (buffer.length > MAX_FILE_BYTES) {
    const err = new Error('파일 크기는 최대 15MB까지 지원합니다.');
    err.statusCode = 400;
    throw err;
  }

  const detectedMime = detectMimeFromBuffer(buffer, mimeType);
  if (!detectedMime) {
    const err = new Error('PDF 또는 이미지 파일(PNG, JPG, WebP)만 인식할 수 있습니다.');
    err.statusCode = 400;
    throw err;
  }

  const hintLines = [];
  if (expectedNumQuestions) hintLines.push(`- 참고(현재 설정된 문항 수): ${expectedNumQuestions}문항 (문서 실제 문항 수와 다르면 문서 기준으로 추출)`);
  if (expectedNumChoices) hintLines.push(`- 참고(선지 수): ${expectedNumChoices}지선다`);

  const prompt = `너는 한국 중·고등 내신, 모의고사, 수능 시험지 및 빠른 정답표·해설지 PDF에서 객관식 정답표를 100% 정확하게 추출하는 전문 OCR/파싱 엔진이다.

첨부된 PDF 또는 이미지를 꼼꼼히 분석해 객관식 문항의 정답을 JSON으로 추출하라.
${hintLines.join('\n')}

핵심 규칙:
1. 문서에 '빠른 정답표'(표 형태)와 '문항별 해설'이 모두 있으면, 빠른 정답표를 우선 기준으로 삼고 해설에서 영역·배점·해설 시작 쪽수(page)를 보강하라.
2. 원문자(①=1, ②=2, ③=3, ④=4, ⑤=5)나 알파벳(A=1..E=5)은 반드시 정수 1~5로 변환하라.
3. 문항 번호(num)는 1부터 시작하는 정수로 추출하라. 표가 가로/세로 다단(예: 1~15, 16~30, 31~45)으로 나뉘어 있어도 문항 번호와 정답이 1칸도 밀리지 않도록 정확히 매칭하라.
4. 서술형·단답형·주관식 문항(객관식 1~5번 선택지가 아닌 문항)은 questions에 넣지 말고 subjectiveQuestions 배열에 문항 번호만 기록하라.
5. 배점(예: 2점, 3점, 3.2점, 4.1점 등)이 적혀 있으면 points에 숫자(소수 가능)로 넣어라. 없으면 null.
6. 영역(예: 독서, 문학, 문법, 화법과 작문, 언어와 매체 등)이 구분되어 있으면 category에 간결하게 넣어라. 없으면 null.
7. PDF 해설지인 경우 각 문항의 해설이 시작되는 PDF 페이지 번호(1부터 시작)를 알 수 있으면 page에 정수로 넣어라.
8. 절대 추측하거나 지어내지 마라. 글자가 흐리거나 복수정답·오타가 의심되면 warnings 배열에 문항 번호와 이유를 적어라.
9. 시험 정답표나 해설지가 전혀 아닌 문서라면 {"error": "문서에서 시험 정답표를 찾을 수 없습니다."}만 반환하라.

반드시 아래 JSON 스키마만 출력하라 (마크다운 코드블록·설명 텍스트 금지):
{
  "summary": "감지된 시험/정답표 한 줄 요약 (예: 고1 국어 중간고사 객관식 24문항)",
  "numQuestions": 24,
  "numChoices": 5,
  "maxScore": 100,
  "questions": [
    { "num": 1, "answer": 3, "points": 3.5, "page": 1, "category": "문학", "explanation": null }
  ],
  "subjectiveQuestions": [25, 26],
  "warnings": []
}`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: detectedMime,
              data: buffer.toString('base64'),
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if ((response.status === 429 || response.status === 503) && attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`AI 인식 요청 실패 (HTTP ${response.status})${errText ? `: ${errText.slice(0, 140)}` : ''}`);
      }

      const json = await response.json();
      const parts = json?.candidates?.[0]?.content?.parts || [];
      const text = parts.filter(p => p.text).map(p => p.text).join('').trim();
      if (!text) {
        throw new Error('AI 응답이 비어 있습니다. 다시 시도해 주세요.');
      }

      const parsed = parseGeminiJSON(text);
      return sanitizeParsedAnswerKey(parsed, { expectedNumQuestions, expectedNumChoices });
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (err.name === 'AbortError') {
        lastError = new Error('PDF 인식 시간이 초과되었습니다(60초). 페이지 수가 많은 경우 정답표 페이지만 추출해 올려주세요.');
      }
      if (attempt >= 2) break;
    }
  }

  throw lastError || new Error('PDF 정답 자동 인식 중 오류가 발생했습니다.');
}

module.exports = {
  MAX_FILE_BYTES,
  detectMimeFromBuffer,
  normalizeChoiceAnswer,
  sanitizeParsedAnswerKey,
  extractGoogleDriveFileId,
  fetchGoogleDrivePdfBuffer,
  parseAnswerKeyFromFile,
};
