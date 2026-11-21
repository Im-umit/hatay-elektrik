const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers
  }
});

export async function onRequestPost({ request, env }) {
  const missingBindings = [];
  if (!env.DB) missingBindings.push('DB');
  if (!env.ADMIN_PASSWORD) missingBindings.push('ADMIN_PASSWORD');
  if (!env.SESSION_SECRET) missingBindings.push('SESSION_SECRET');
  if (!env.RATE_LIMIT_SALT) missingBindings.push('RATE_LIMIT_SALT');

  if (missingBindings.length) {
    return json({
      error: `Yönetim paneli yapılandırması tamamlanmadı. Eksik: ${missingBindings.join(', ')}`
    }, 503);
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: 'Kaynak doğrulanamadı.' }, 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.password !== 'string' || body.password.length > 300) {
    return json({ error: 'Geçerli bir yönetici şifresi girin.' }, 400);
  }

  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await hash(ip, env.RATE_LIMIT_SALT);
    const now = Date.now();
    // 24 saatten eski başarısız giriş kayıtları hız sınırına katkı sağlamaz.
    await env.DB.prepare(
      'DELETE FROM admin_login_attempts WHERE created_at < ?'
    ).bind(now - 24 * 60 * 60 * 1000).run();

    const attempts = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM admin_login_attempts WHERE ip_hash = ? AND created_at > ?'
    ).bind(ipHash, now - 15 * 60 * 1000).first();

    if ((attempts?.n || 0) >= 5) {
      return json({ error: 'Çok fazla hatalı giriş denemesi. 15 dakika sonra tekrar deneyin.' }, 429);
    }

    if (!constantTimeEqual(body.password, env.ADMIN_PASSWORD)) {
      await env.DB.prepare(
        'INSERT INTO admin_login_attempts (ip_hash, created_at) VALUES (?, ?)'
      ).bind(ipHash, now).run();
      return json({ error: 'Şifre hatalı.' }, 401);
    }

    await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash = ?').bind(ipHash).run();
    const payload = btoa(JSON.stringify({ exp: now + 8 * 60 * 60 * 1000, sub: 'admin' })).replace(/=/g, '');
    const signature = await sign(payload, env.SESSION_SECRET);
    return json({ ok: true }, 200, {
      'set-cookie': `he_admin=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`
    });
  } catch (error) {
    console.error('[Hatay Elektrik] Yönetici girişi başarısız:', error);
    return json({ error: 'Yönetim paneli veritabanı kurulumu tamamlanmamış olabilir.' }, 503);
  }
}

async function hash(value, salt) {
  const bytes = new TextEncoder().encode(`${value}${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}
