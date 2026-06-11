/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // 기존 CDN 설정과 동일하게 preflight 비활성 (index.css 전역 리셋과 충돌 방지)
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        cta: 'var(--cta)',
        navy: '#102044',
        'nav-bg': 'var(--nav-bg)',
      },
      fontFamily: {
        display: ['Paperlogy', 'KoPub Dotum', 'Noto Sans KR', 'sans-serif'],
        body: ['KoPub Dotum', 'Paperlogy', 'Noto Sans KR', 'sans-serif'],
      },
    },
  },
};
