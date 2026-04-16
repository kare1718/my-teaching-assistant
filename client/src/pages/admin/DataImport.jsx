import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { apiPost } from '../../api';

const TYPE_DEFS = {
  students: {
    label: '학생 명단',
    desc: '이름 / 학교 / 학년 / 보호자 이름 / 보호자 전화',
    fields: [
      { key: 'name', label: '이름', required: true },
      { key: 'school', label: '학교', required: true },
      { key: 'grade', label: '학년', required: true },
      { key: 'parentName', label: '보호자 이름', required: true },
      { key: 'parentPhone', label: '보호자 전화', required: true },
      { key: 'memo', label: '메모', required: false },
    ],
  },
  tuition: {
    label: '수강료 명단',
    desc: '학생 이름 / 금액 / 납기일 (YYYY-MM-DD)',
    fields: [
      { key: 'studentName', label: '학생 이름', required: true },
      { key: 'amount', label: '금액', required: true },
      { key: 'dueDate', label: '납기일 (YYYY-MM-DD)', required: true },
    ],
  },
  attendance: {
    label: '출결 기록',
    desc: '학생 이름 / 날짜 (YYYY-MM-DD) / 상태 (출석|결석|지각|조퇴)',
    fields: [
      { key: 'studentName', label: '학생 이름', required: true },
      { key: 'date', label: '날짜 (YYYY-MM-DD)', required: true },
      { key: 'status', label: '상태', required: true },
    ],
  },
};

export default function DataImport() {
  const [type, setType] = useState('students');
  const [rawRows, setRawRows] = useState([]); // 원본 엑셀 행 (object 배열)
  const [headers, setHeaders] = useState([]); // 엑셀 헤더
  const [mapping, setMapping] = useState({}); // { fieldKey: excelHeader }
  const [validation, setValidation] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('upload'); // upload → preview → map → validate → result

  const def = TYPE_DEFS[type];

  const handleFile = async (e) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!json.length) throw new Error('파일이 비어있습니다.');
      setRawRows(json);
      setHeaders(Object.keys(json[0]));
      // auto-mapping: 필드 라벨과 같은 이름의 헤더 자동 매핑
      const auto = {};
      for (const f of def.fields) {
        const match = Object.keys(json[0]).find(h =>
          h.toLowerCase().replace(/\s/g, '') === f.label.replace(/\s/g, '').toLowerCase() ||
          h.toLowerCase() === f.key.toLowerCase()
        );
        if (match) auto[f.key] = match;
      }
      setMapping(auto);
      setStage('preview');
    } catch (err) {
      setError(`파일을 읽을 수 없습니다: ${err.message}`);
    }
  };

  const mappedRows = useMemo(() => {
    return rawRows.map(row => {
      const mapped = {};
      for (const f of def.fields) {
        const col = mapping[f.key];
        mapped[f.key] = col ? row[col] : '';
      }
      return mapped;
    });
  }, [rawRows, mapping, def]);

  const runValidate = async () => {
    setError('');
    try {
      const res = await apiPost('/data-import/validate', { type, rows: mappedRows });
      setValidation(res);
      setStage('validate');
    } catch (err) {
      setError(err.message);
    }
  };

  const runCommit = async () => {
    setError('');
    setCommitting(true);
    try {
      const res = await apiPost('/data-import/commit', { type, rows: mappedRows });
      setResult(res);
      setStage('result');
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  };

  const reset = () => {
    setRawRows([]); setHeaders([]); setMapping({}); setValidation(null); setResult(null); setStage('upload');
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-extrabold text-[var(--primary)] tracking-tight mb-2">데이터 가져오기</h1>
      <p className="text-slate-500 mb-6">엑셀(.xlsx) 또는 CSV 파일로 기존 학원 데이터를 한 번에 불러옵니다.</p>

      {/* 유형 선택 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-4">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">가져오기 유형</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.entries(TYPE_DEFS).map(([key, t]) => (
            <button
              key={key}
              onClick={() => { setType(key); reset(); }}
              className={`p-4 rounded-lg border text-left transition-all ${
                type === key ? 'border-[var(--cta)] bg-[#f0f4ff]' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-[var(--primary)]">{t.label}</div>
              <div className="text-xs text-slate-500 mt-1">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-[#ba1a1a] rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      {stage === 'upload' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">1단계 · 파일 업로드</div>
          <label className="inline-block cursor-pointer">
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <span className="inline-block px-6 py-3 bg-[var(--primary)] text-white font-bold rounded-lg hover:bg-[var(--cta)]">
              파일 선택 (.xlsx / .csv)
            </span>
          </label>
          <p className="text-xs text-slate-400 mt-4">필수 컬럼: {def.fields.filter(f => f.required).map(f => f.label).join(', ')}</p>
        </div>
      )}

      {stage !== 'upload' && stage !== 'result' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">2단계 · 컬럼 매핑</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {def.fields.map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <div className="w-32 text-sm font-semibold text-[var(--primary)]">
                  {f.label} {f.required && <span className="text-[#ba1a1a]">*</span>}
                </div>
                <select
                  value={mapping[f.key] || ''}
                  onChange={e => setMapping({ ...mapping, [f.key]: e.target.value })}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm"
                >
                  <option value="">— 선택 —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* 미리보기 */}
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-5 mb-2">미리보기 (첫 10행)</div>
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {def.fields.map(f => (
                    <th key={f.key} className="px-3 py-2 text-left font-bold text-slate-500">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mappedRows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {def.fields.map(f => (
                      <td key={f.key} className="px-3 py-2 text-slate-700">{row[f.key] || <span className="text-slate-300">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={reset} className="px-5 py-2.5 border border-slate-200 rounded-lg font-bold text-[var(--primary)] hover:bg-slate-50">
              다시 선택
            </button>
            <button
              onClick={runValidate}
              className="px-5 py-2.5 bg-[var(--cta)] text-white rounded-lg font-bold hover:bg-[#0037b8]"
            >
              검증하기
            </button>
          </div>
        </div>
      )}

      {stage === 'validate' && validation && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">3단계 · 검증 결과</div>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 bg-emerald-50 rounded-lg p-4 text-center">
              <div className="text-xs font-bold text-emerald-600 uppercase">정상</div>
              <div className="text-2xl font-extrabold text-emerald-700">{validation.summary.valid}</div>
            </div>
            <div className="flex-1 bg-red-50 rounded-lg p-4 text-center">
              <div className="text-xs font-bold text-[#ba1a1a] uppercase">오류</div>
              <div className="text-2xl font-extrabold text-[#ba1a1a]">{validation.summary.invalid}</div>
            </div>
            <div className="flex-1 bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-xs font-bold text-slate-500 uppercase">총</div>
              <div className="text-2xl font-extrabold text-[var(--primary)]">{validation.summary.total}</div>
            </div>
          </div>

          {validation.rows.some(r => r.errors.length > 0) && (
            <div className="mb-4 max-h-48 overflow-y-auto border border-red-100 rounded-lg p-3 bg-red-50/30 text-xs">
              {validation.rows.filter(r => r.errors.length > 0).slice(0, 20).map(r => (
                <div key={r.index} className="mb-1">
                  <span className="font-bold text-[#ba1a1a]">행 {r.index + 1}:</span>{' '}
                  <span className="text-slate-600">{r.errors.join(', ')}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStage('preview')} className="px-5 py-2.5 border border-slate-200 rounded-lg font-bold text-[var(--primary)] hover:bg-slate-50">
              매핑 수정
            </button>
            <button
              onClick={runCommit}
              disabled={committing || validation.summary.valid === 0}
              className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg font-bold hover:bg-[var(--cta)] disabled:opacity-50"
            >
              {committing ? '가져오는 중...' : `${validation.summary.valid}건 가져오기`}
            </button>
          </div>
        </div>
      )}

      {stage === 'result' && result && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 mx-auto flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2 className="text-xl font-extrabold text-[var(--primary)] mb-4">가져오기 완료</h2>
          <div className="flex justify-center gap-6 mb-6">
            <div><div className="text-xs text-slate-400 uppercase font-bold">성공</div><div className="text-2xl font-extrabold text-emerald-600">{result.summary.success}</div></div>
            <div><div className="text-xs text-slate-400 uppercase font-bold">실패</div><div className="text-2xl font-extrabold text-[#ba1a1a]">{result.summary.failed}</div></div>
            <div><div className="text-xs text-slate-400 uppercase font-bold">스킵</div><div className="text-2xl font-extrabold text-slate-500">{result.summary.skipped}</div></div>
          </div>
          <button onClick={reset} className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg font-bold hover:bg-[var(--cta)]">
            다른 파일 가져오기
          </button>
        </div>
      )}
    </div>
  );
}
