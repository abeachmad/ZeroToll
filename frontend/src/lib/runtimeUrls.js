const stripTrailingSlash = (value) => (value ? value.replace(/\/+$/, '') : value);

const isVercelHost = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname || '';
  return hostname === 'zerotoll.vercel.app' || hostname.endsWith('.vercel.app');
};

export const getBackendUrl = () => {
  const configuredUrl = stripTrailingSlash(process.env.REACT_APP_BACKEND_URL);

  // In production, prefer an explicit public backend URL when provided.
  // This keeps Vercel working even if serverless proxy routing is unavailable.
  if (configuredUrl) {
    return configuredUrl;
  }

  if (isVercelHost()) {
    return '/api/backend';
  }

  return 'http://localhost:8000';
};

export const getRelayerUrl = () => {
  const candidates = [
    process.env.REACT_APP_RELAYER_URL,
    process.env.REACT_APP_GASLESS_API_URL,
    'http://localhost:3002',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === 'http://localhost:3001') continue;
    if (candidate === 'http://localhost:8000') continue;
    return stripTrailingSlash(candidate);
  }

  return 'http://localhost:3002';
};
