const stripTrailingSlash = (value) => (value ? value.replace(/\/+$/, '') : value);

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'content-encoding',
  'host',
  'transfer-encoding',
]);

module.exports = async (req, res) => {
  const backendBaseUrl = stripTrailingSlash(
    process.env.REACT_APP_BACKEND_URL || process.env.BACKEND_URL
  );

  if (!backendBaseUrl) {
    res.status(500).json({
      error: 'BACKEND_URL is not configured for the Vercel proxy.',
    });
    return;
  }

  const rawPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
  const normalizedPath = String(rawPath || '').replace(/^\/+/, '');

  if (!normalizedPath) {
    res.status(400).json({
      error: 'Missing proxy path.',
    });
    return;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      continue;
    }
    if (value !== undefined) {
      query.append(key, value);
    }
  }

  const targetUrl = `${backendBaseUrl}/${normalizedPath}${query.toString() ? `?${query.toString()}` : ''}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (HOP_BY_HOP_HEADERS.has(String(key).toLowerCase())) continue;
    headers[key] = value;
  }

  let body;
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
      body = req.body;
    } else if (req.body && Object.keys(req.body).length > 0) {
      body = JSON.stringify(req.body);
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
    }
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'follow',
    });

    upstreamResponse.headers.forEach((value, key) => {
      if (HOP_BY_HOP_HEADERS.has(String(key).toLowerCase())) return;
      res.setHeader(key, value);
    });

    const payload = Buffer.from(await upstreamResponse.arrayBuffer());
    res.status(upstreamResponse.status).send(payload);
  } catch (error) {
    res.status(502).json({
      error: 'Backend proxy request failed.',
      details: error?.message || String(error),
      targetUrl,
    });
  }
};
