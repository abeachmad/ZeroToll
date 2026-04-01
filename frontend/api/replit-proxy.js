const DEFAULT_BACKEND_ORIGIN = 'https://e4c59705-5b3b-458d-b4ff-11c559aec6a8-00-2blo5t4sg8nr8.sisko.replit.dev';
const RETRYABLE_STATUS_CODES = new Set([404, 429, 500, 502, 503, 504]);
const SPLASH_MARKERS = [
  'Run this app to see the results here.',
  '<!DOCTYPE html>',
  '<html lang="en">',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeOrigin = (value) => (value ? value.replace(/\/+$/, '') : DEFAULT_BACKEND_ORIGIN);

const getPathParam = (queryPath) => {
  if (Array.isArray(queryPath)) {
    return queryPath.join('/');
  }
  return String(queryPath || '').replace(/^\/+/, '');
};

const shouldRetryResponse = (status, bodyText, contentType) => {
  if (RETRYABLE_STATUS_CODES.has(status)) {
    return true;
  }

  if ((contentType || '').includes('text/html')) {
    return SPLASH_MARKERS.some((marker) => bodyText.includes(marker));
  }

  return false;
};

module.exports = async function handler(req, res) {
  const origin = normalizeOrigin(process.env.BACKEND_URL || process.env.REACT_APP_BACKEND_URL);
  const path = getPathParam(req.query.path);
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item);
      }
    } else if (value !== undefined) {
      searchParams.append(key, value);
    }
  }

  const upstreamUrl = `${origin}/${path}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-port'];
  delete headers['x-forwarded-proto'];
  headers.accept = headers.accept || 'application/json';

  const requestBody =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? req.body
        : req.body
          ? JSON.stringify(req.body)
          : undefined;

  let lastResponse;
  let lastBody = '';

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: requestBody,
      redirect: 'follow',
    });

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const bodyText = await upstreamResponse.text();

    lastResponse = upstreamResponse;
    lastBody = bodyText;

    if (!shouldRetryResponse(upstreamResponse.status, bodyText, contentType)) {
      break;
    }

    if (attempt < 3) {
      await sleep(1200 * (attempt + 1));
    }
  }

  if (!lastResponse) {
    res.status(502).json({ detail: 'Backend proxy did not receive any response.' });
    return;
  }

  const responseContentType = lastResponse.headers.get('content-type') || 'text/plain; charset=utf-8';
  res.status(lastResponse.status);
  res.setHeader('content-type', responseContentType);
  res.setHeader('cache-control', 'no-store');
  res.send(lastBody);
};
