const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean = (v, max=500) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const validPhone = v => /^\+?[0-9 ()-]{10,20}$/.test(v) && v.replace(/\D/g,'').length >= 10;
const allowedServices = ['Elektrik tesisatı','Su tesisatı','Uydu sistemleri','İnternet ve bağlantı','Diğer teknik işler'];
const allowedDistricts = ['Antakya','Defne','Arsuz','Altınözü','Belen','Dörtyol','Erzin','Hassa','İskenderun','Kırıkhan','Kumlu','Payas','Reyhanlı','Samandağ','Yayladağı'];

export async function onRequestPost({request, env}) {
  if (!env.DB || !env.PHOTOS) return json({error:'Talep sistemi henüz yapılandırılmadı. Lütfen telefonla iletişime geçin.'},503);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({error:'İstek kaynağı doğrulanamadı.'},403);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  try {
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM requests WHERE ip_hash = ? AND created_at > ?').bind(await hash(ip, env.RATE_LIMIT_SALT), now-60*60*1000).first();
    if ((recent?.n || 0) >= 8) return json({error:'Çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin.'},429);
    const form = await request.formData();
    if (clean(form.get('website'),100)) return json({ok:true,reference:'alındı'}); // honeypot
    const started = Number(form.get('formStartedAt') || 0);
    // Soft bot check; reject instant submissions but don't rely on this as the only spam control.
    if (started && now-started < 1800) return json({error:'Lütfen formu kontrol edip tekrar gönderin.'},400);
    const name = clean(form.get('name'),90), phone = clean(form.get('phone'),24), service = clean(form.get('service'),60);
    const district = clean(form.get('district'),40), neighborhood = clean(form.get('neighborhood'),100), address = clean(form.get('address'),500), details = clean(form.get('details'),2000);
    if (name.length < 3 || !validPhone(phone) || !allowedServices.includes(service) || !allowedDistricts.includes(district) || neighborhood.length < 2 || address.length < 5 || details.length < 5 || form.get('privacyConsent') !== 'on') return json({error:'Zorunlu alanları kontrol edin. Telefon numarası ve adres bilgileri eksik veya hatalı olabilir.'},400);
    const latitude = Number(form.get('latitude')), longitude = Number(form.get('longitude'));
    const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude)<=90 && Math.abs(longitude)<=180;
    const file = form.get('photo'); let photoKey = null;
    if (file && typeof file === 'object' && file.size > 0) {
      if (file.size > 5*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) return json({error:'Fotoğraf JPG, PNG veya WebP olmalı ve 5 MB’ı geçmemelidir.'},400);
      const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];
      photoKey = `${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;
      await env.PHOTOS.put(photoKey, file.stream(), {httpMetadata:{contentType:file.type, cacheControl:'private, no-store'}});
    }
    const reference = `HE-${now.toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
    await env.DB.prepare(`INSERT INTO requests (reference,name,phone,service,district,neighborhood,address,details,latitude,longitude,photo_key,status,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(reference,name,phone,service,district,neighborhood,address,details,hasCoords?latitude:null,hasCoords?longitude:null,photoKey,'new',await hash(ip, env.RATE_LIMIT_SALT),now).run();
    return json({ok:true,reference},201);
  } catch (e) {
    return json({error:'Talep kaydedilirken bir sorun oluştu. Lütfen tekrar deneyin veya telefonla ulaşın.'},500);
  }
}
async function hash(value, salt) { if (!salt) throw new Error('RATE_LIMIT_SALT missing'); const bytes = new TextEncoder().encode(value + salt); const digest=await crypto.subtle.digest('SHA-256',bytes); return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
