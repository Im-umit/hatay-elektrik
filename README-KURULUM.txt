HATAY ELEKTRİK — CLOUDFLARE PAGES + FUNCTIONS
==============================================

BU SÜRÜMDE
- public/: Kurumsal web sitesi, servis talep formu, admin paneli, KVKK ve gizlilik sayfaları
- functions/: Cloudflare Pages Functions API uçları
- migrations/: D1 veritabanı şeması ve admin giriş koruması
- wrangler.toml: Pages ve D1 yapılandırması

FOTOĞRAF AKIŞI
- Web sitesi üzerinden fotoğraf dosyası yüklenmez.
- Ziyaretçi önce servis talebini gönderir.
- Talep başarıyla kaydedilince kişiye özel talep numarasıyla WhatsApp fotoğraf bağlantısı açılır.
- Fotoğrafı kullanıcı WhatsApp sohbetine kendisi ekler.
- Bu akışta site tarafında R2 kullanılmaz; mevcut R2 kovası bu sürümde devre dışıdır.

CLOUDFLARE KURULUMU
1. Pages projesi GitHub deposunun main dalına bağlı olmalı.
2. Build command boş; Build output directory public olmalı.
3. wrangler.toml içindeki D1 database_id mevcut Cloudflare D1 UUID'si olmalı.
4. D1 > hatay-elektrik-db > Console bölümünde migrations/0001_init.sql ve migrations/0002_admin_login_rate_limit.sql SQL dosyalarını sırayla çalıştırın.
   Alternatif: proje kökünde `npx wrangler d1 migrations apply hatay-elektrik-db --remote`.
   0001 servis talepleri tablosunu, 0002 yönetici giriş denemeleri tablosunu oluşturur.
5. Pages projesi > Settings > Variables and Secrets > Production bölümünde şu üç değeri Secret olarak ekleyin:
   ADMIN_PASSWORD   = uzun ve benzersiz yönetici parolası
   SESSION_SECRET   = en az 32 rastgele karakterlik gizli anahtar
   RATE_LIMIT_SALT  = en az 32 rastgele karakterlik farklı gizli anahtar
6. Değişkenleri ekledikten sonra yeniden dağıtım yapın.

ÖNEMLİ
- CLOUDFLARE_API_TOKEN bu web uygulamasının çalışma zamanı için gerekli değildir.
- D1 migration uygulanmazsa servis formu ve yönetim girişi kayıt tablolarını bulamaz.
- RATE_LIMIT_SALT tanımlı değilse servis formu ve yönetici girişi yapılandırma hatası verir.
- Yönetici girişi IP başına 15 dakikada en fazla 5 hatalı denemeyle sınırlandırılmıştır; 0002 migration uygulanmalıdır.
- ADMIN_PASSWORD ve SESSION_SECRET tanımlı değilse yönetim paneli açılmaz.
- E-posta/SMS/otomatik WhatsApp bildirimi bu sürümde bulunmaz. Talepler /admin.html panelinden takip edilir.
- Fotoğraf gönderimi WhatsApp uygulamasında kullanıcı tarafından yapılır; web sitesi fotoğraf saklamaz.

TEST SIRASI
1. Ana sayfa ve mobil menü açılıyor mu?
2. Telefon ve WhatsApp bağlantıları doğru mu?
3. Servis talebi gönderilince HE-... referansı geliyor mu?
4. /admin.html üzerinden yönetici girişi yapılabiliyor mu?
5. Yeni talep panelde görünüyor ve durum değişikliği kaydoluyor mu?
6. Başarı ekranındaki WhatsApp fotoğraf bağlantısı talep numarasını içeriyor mu?
7. KVKK ve gizlilik metinleri gerçek veri işleme/aktarım süreçleriyle uyumlu mu?

ADMIN PANELİ
- URL: https://hatay-elektrik.pages.dev/admin.html
- Yönetici parolası Cloudflare ADMIN_PASSWORD Secret değişkenidir.
- Oturum 8 saat geçerlidir; HttpOnly, Secure ve SameSite=Strict cookie kullanılır.
- Panel son 200 talebi listeler. Durumlar: Yeni, İletişime geçildi, Tamamlandı, İptal edildi.

YAYIN ÖNCESİ
- Veri sorumlusunun resmî unvanı/adı, başvuru adresi ve saklama-imha süreleri doğrulanmalı.
- Cloudflare ve WhatsApp/Meta kullanımı nedeniyle olası yurt dışı aktarım koşulları KVKK m.9 kapsamında değerlendirilip uygun mekanizma kurulmalı.
- İşletmenin gerçekten hizmet verdiği ilçeler ve hizmet kapsamı doğrulanmalı.
- Özel alan adı alınırsa canonical, sitemap.xml, robots.txt ve Google Search Console ayarları o alan adına göre güncellenmeli.
- İlk test talepleri gerçek müşteri verisi kullanılmadan oluşturulmalı ve test sonunda temizlenmeli.
