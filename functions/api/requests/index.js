const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

const clean = (value, max = 500) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .trim()
  .slice(0, max);

const validPhone = (value) => /^\+?[0-9 ()-]{10,20}$/.test(value)
  && value.replace(/\D/g, '').length >= 10;

const allowedServices = [
  'Elektrik tesisatı',
  'Su tesisatı',
  'Uydu sistemleri',
  'İnternet ve bağlantı',
  'Diğer teknik işler'
];

const allowedDistricts = [
  'Antakya', 'Defne', 'Arsuz', 'Altınözü', 'Belen', 'Dörtyol', 'Erzin',
  'Hassa', 'İskenderun', 'Kırıkhan', 'Kumlu', 'Payas', 'Reyhanlı',
  'Samandağ', 'Yayladağı'
];

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ error: 'Servis talep sistemi henüz veritabanına bağlanmadı. Lütfen telefonla iletişime geçin.' }, 503);
  }
  if (!env.RATE_LIMIT_SALT) {
    return json({ error: 'Servis talep sistemi henüz tamamlanmadı. Lütfen telefonla iletişime geçin.' }, 503);
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: 'İstek kaynağı doğrulanamadı.' }, 403);
  }

  try {
    const form = await request.formData();
    if (clean(form.get('website'), 100)) {
      return json({ ok: true, reference: 'alındı' });
    }

    // Site artık fotoğraf dosyası kabul etmez. Fotoğraflar, kayıt sonrasında WhatsApp ile paylaşılır.
    const uploadedPhoto = form.get('photo');
    if (uploadedPhoto && typeof uploadedPhoto === 'object' && uploadedPhoto.size > 0) {
      return json({ error: 'Fotoğrafları web sitesine yüklemeyin. Talebinizi gönderdikten sonra WhatsApp bağlantısını kullanın.' }, 400);
    }

    const now = Date.now();
    const startedAt = Number(form.get('formStartedAt') || 0);
    if (startedAt && (!Number.isFinite(startedAt) || now - startedAt < 1500 || now - startedAt > 12 * 60 * 60 * 1000)) {
      return json({ error: 'Lütfen formu kontrol edip tekrar gönderin.' }, 400);
    }

    const name = clean(form.get('name'), 90);
    const phone = clean(form.get('phone'), 24);
    const service = clean(form.get('service'), 60);
    const district = clean(form.get('district'), 40);
    const neighborhood = clean(form.get('neighborhood'), 100);
    const address = clean(form.get('address'), 500);
    const details = clean(form.get('details'), 2000);

    if (
      name.length < 3 || !validPhone(phone) || !allowedServices.includes(service)
      || !allowedDistricts.includes(district) || neighborhood.length < 2
      || address.length < 5 || details.length < 5 || form.get('privacyConsent') !== 'on'
    ) {
      return json({ error: 'Zorunlu alanları kontrol edin. Telefon numarası ve adres bilgileri eksik veya hatalı olabilir.' }, 400);
    }

    // Empty form values must remain NULL; Number('') would incorrectly become 0,0.
    const latRaw = clean(form.get('latitude'), 32);
    const lngRaw = clean(form.get('longitude'), 32);
    const latitude = latRaw === '' ? NaN : Number(latRaw);
    const longitude = lngRaw === '' ? NaN : Number(lngRaw);
    const hasCoords = latRaw !== '' && lngRaw !== ''
      && Number.isFinite(latitude) && Number.isFinite(longitude)
      && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await hash(ip, env.RATE_LIMIT_SALT);
    const recent = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM requests WHERE ip_hash = ? AND created_at > ?'
    ).bind(ipHash, now - 60 * 60 * 1000).first();

    if ((recent?.n || 0) >= 8) {
      return json({ error: 'Çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin.' }, 429);
    }

    const reference = `HE-${now.toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    await env.DB.prepare(`
      INSERT INTO requests (
        reference, name, phone, service, district, neighborhood, address,
        details, latitude, longitude, status, ip_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      reference,
      name,
      phone,
      service,
      district,
      neighborhood,
      address,
      details,
      hasCoords ? latitude : null,
      hasCoords ? longitude : null,
      'new',
      ipHash,
      now
    ).run();

    return json({ ok: true, reference }, 201);
  } catch (error) {
    // Full detail stays in Cloudflare logs; never expose SQL or infrastructure details to visitors.
    console.error('[Hatay Elektrik] Servis talebi kaydedilemedi:', error);
    return json({
      error: 'Talep şu anda kaydedilemedi. Veritabanı kurulumu ve sunucu ayarları kontrol edilmeli. Lütfen telefonla veya WhatsApp üzerinden ulaşın.'
    }, 503);
  }
}

async function hash(value, salt) {
  const bytes = new TextEncoder().encode(`${value}${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
