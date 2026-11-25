/**
 * Google Drive, 네이버 MYBOX(N드라이브), PDF/이미지 해설 파일 URL 파서 및 안전 검증 유틸
 */

export function sanitizeExternalUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function parseExplanationFileUrl(rawUrl, page = null) {
  const safeUrl = sanitizeExternalUrl(rawUrl);
  if (!safeUrl) return null;

  let urlObj;
  try {
    urlObj = new URL(safeUrl);
  } catch {
    return null;
  }

  const host = urlObj.hostname.toLowerCase();
  const pathname = urlObj.pathname;
  const pageNum = page && Number(page) > 0 ? Math.floor(Number(page)) : null;

  // 1. Google Drive 파일 링크
  if (host === 'drive.google.com' || host.endsWith('.drive.google.com')) {
    let fileId = null;
    const fileMatch = pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    } else if (urlObj.searchParams.get('id')) {
      fileId = urlObj.searchParams.get('id');
    }

    if (fileId) {
      const previewBase = `https://drive.google.com/file/d/${fileId}/preview`;
      return {
        provider: 'google_drive',
        providerLabel: 'Google Drive',
        canEmbed: true,
        embedType: 'iframe',
        embedUrl: pageNum ? `${previewBase}#page=${pageNum}` : previewBase,
        openUrl: safeUrl,
        helperNote: '구글 드라이브 공유 설정이 "링크가 있는 모든 사용자(뷰어)"여야 학생 앱에서 바로 보입니다.',
      };
    }

    // 폴더 링크 등 fileId가 없는 구글 드라이브 링크
    return {
      provider: 'google_drive',
      providerLabel: 'Google Drive',
      canEmbed: false,
      embedType: 'link',
      embedUrl: safeUrl,
      openUrl: safeUrl,
      helperNote: '개별 파일 공유 링크를 입력하면 앱 안에서 바로 미리보기로 열립니다.',
    };
  }

  // 2. Google Docs / Slides / Sheets
  if (host === 'docs.google.com') {
    const docMatch = pathname.match(/\/(document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) {
      const [, docType, docId] = docMatch;
      const typeLabel = docType === 'document' ? 'Google 문서' : docType === 'presentation' ? 'Google 슬라이드' : 'Google 시트';
      const embedUrl = docType === 'presentation'
        ? `https://docs.google.com/presentation/d/${docId}/embed`
        : `https://docs.google.com/${docType}/d/${docId}/preview`;
      return {
        provider: 'google_docs',
        providerLabel: typeLabel,
        canEmbed: true,
        embedType: 'iframe',
        embedUrl,
        openUrl: safeUrl,
        helperNote: 'Google 문서 공유 설정이 "링크가 있는 모든 사용자(뷰어)"여야 바로 보입니다.',
      };
    }
  }

  // 3. 네이버 MYBOX (구 N드라이브) / naver.me 공유 링크
  if (
    host === 'mybox.naver.com' ||
    host.endsWith('.mybox.naver.com') ||
    host === 'ndrive.naver.com' ||
    host === 'cloud.naver.com' ||
    host === 'naver.me'
  ) {
    return {
      provider: 'naver_mybox',
      providerLabel: '네이버 MYBOX (N드라이브)',
      canEmbed: false,
      embedType: 'link',
      embedUrl: safeUrl,
      openUrl: safeUrl,
      helperNote: '네이버 MYBOX(N드라이브) 공유 링크는 보안 정책상 새 창(또는 MYBOX 앱)으로 선명하게 열립니다.',
    };
  }

  // 4. 이미지 직접 링크
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(pathname)) {
    return {
      provider: 'image',
      providerLabel: '이미지 해설',
      canEmbed: true,
      embedType: 'image',
      embedUrl: safeUrl,
      openUrl: safeUrl,
      helperNote: '이미지 파일이 화면 안에 바로 표시됩니다.',
    };
  }

  // 5. PDF 직접 링크
  if (/\.pdf$/i.test(pathname)) {
    const cleanBase = safeUrl.split('#')[0];
    return {
      provider: 'pdf',
      providerLabel: 'PDF 해설지',
      canEmbed: true,
      embedType: 'iframe',
      embedUrl: pageNum ? `${cleanBase}#page=${pageNum}` : cleanBase,
      openUrl: pageNum ? `${cleanBase}#page=${pageNum}` : safeUrl,
      helperNote: 'PDF 파일이 앱 안에서 바로 열리며 문항별 페이지 이동을 지원합니다.',
    };
  }

  // 6. 기타 외부 클라우드/문서 링크
  return {
    provider: 'external',
    providerLabel: '외부 해설 링크',
    canEmbed: false,
    embedType: 'link',
    embedUrl: safeUrl,
    openUrl: safeUrl,
    helperNote: '연동된 외부 링크로 해설 파일을 엽니다.',
  };
}
