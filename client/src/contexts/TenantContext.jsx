import { createContext, useContext, useState, useEffect } from 'react';
import { apiGet, isLoggedIn } from '../api';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [config, setConfig] = useState(getDefaultConfig());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn()) {
      apiGet('/academies/my')
        .then(data => {
          const settings = typeof data.settings === 'string' ? JSON.parse(data.settings) : (data.settings || {});
          setConfig(buildConfig(data));
          setLoading(false);
        })
        .catch(() => {
          setConfig(getDefaultConfig());
          setLoading(false);
        });
    } else {
      setConfig(getDefaultConfig());
      setLoading(false);
    }

    const handler = () => {
      if (isLoggedIn()) {
        apiGet('/academies/my')
          .then(data => {
            setConfig(buildConfig(data));
          })
          .catch(() => {});
      } else {
        setConfig(getDefaultConfig());
      }
    };
    window.addEventListener('auth-changed', handler);
    return () => window.removeEventListener('auth-changed', handler);
  }, []);

  return (
    <TenantContext.Provider value={{ config, loading, setConfig }}>
      {children}
    </TenantContext.Provider>
  );
}

function buildConfig(data) {
  const settings = typeof data.settings === 'string' ? JSON.parse(data.settings) : (data.settings || {});
  return {
    academyId: data.id,
    academyName: data.name,
    slug: data.slug,
    tier: data.subscription_tier,
    schools: settings.schools || [],
    examTypes: settings.examTypes || [],
    siteTitle: settings.siteTitle || data.name || '나만의 조교',
    mainTitle: settings.mainTitle || '',
    branding: settings.branding || {},
    academyInfo: settings.academyInfo || {},
    subject: settings.subject || null,
    clinicSettings: settings.clinicSettings || {},
  };
}

function getDefaultConfig() {
  return {
    academyId: null,
    academyName: '나만의 조교',
    slug: '',
    tier: 'trial',
    schools: [],
    examTypes: [],
    siteTitle: '나만의 조교',
    mainTitle: '나만의 조교로 학원 운영을 더욱 편리하게',
    branding: {},
    academyInfo: {},
    subject: null,
    clinicSettings: {},
  };
}

export function useTenantConfig() {
  const ctx = useContext(TenantContext);
  if (!ctx) return { config: getDefaultConfig(), loading: false };
  return ctx;
}

export function getAllGrades(schoolName, schools) {
  if (!schools || !schoolName) return [];
  const school = schools.find(s => s.name === schoolName);
  return school ? school.grades : [];
}
