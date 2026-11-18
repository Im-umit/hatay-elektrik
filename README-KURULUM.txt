HATAY ELEKTRİK — CLOUDFLARE PAGES + FUNCTIONS PAKETİ
====================================================

BU PAKETTE NELER VAR?
- public/: Web sitesi, servis formu, admin paneli, gizlilik ve KVKK bilgilendirme sayfaları
- functions/: Cloudflare Pages Functions API uçları
- migrations/: D1 veritabanı şeması
- wrangler.toml: Pages, D1 ve R2 yapılandırması

ÖNEMLİ GERÇEKLER
1) Bu paket kaynak kodudur; Cloudflare hesabına kendiliğinden kurulmuş değildir.
2) Formun canlı çalışması için D1 veritabanı, R2 bucket ve üç gizli değişken tanımlanmalıdır.
3) Pages Functions kullandığımız için yalnızca Cloudflare panelindeki basit "Statik dosyalarınızı yükleyin" sürükle-bırak akışı yeterli değildir. GitHub bağlantısı veya Wrangler CLI ile Pages projesi dağıtılmalıdır.
4) Admin paneli /admin.html adresindedir. Şifre hiçbir HTML/JS dosyasına yazılmaz; Cloudflare secret olarak tanımlanır.
5) E-posta/SMS/WhatsApp otomatik bildirimi bu sürümde yoktur. Yeni talepler /admin.html panelinde görünür; işletme paneli kontrol etmelidir.

CLOUDFLARE KURULUMU (BİR KEZ)
A. D1 veritabanı oluştur:
   npx wrangler d1 create hatay-elektrik-db
   Komutun verdiği database_id değerini wrangler.toml içindeki REPLACE_WITH_D1_DATABASE_ID yerine yaz.

B. R2 bucket oluştur:
   npx wrangler r2 bucket create hatay-elektrik-photos

C. D1 tablosunu oluştur:
   npx wrangler d1 migrations apply hatay-elektrik-db --remote

D. GitHub'a bu klasörün tamamını (public, functions, migrations, wrangler.toml) yükle.
   Cloudflare > Workers & Pages > Create application > Pages > Connect to Git seç.
   Build command: boş bırak (statik derleme yok)
   Build output directory: public
   Proje ayarlarında Wrangler yapılandırmasının wrangler.toml dosyasını kullandığını doğrula.
   Cloudflare Pages Functions D1/R2 binding'lerini wrangler.toml üzerinden alır.

E. Cloudflare Pages projesi > Settings > Variables and Secrets > Production bölümünde şu SECRET değerlerini ekle:
   ADMIN_PASSWORD      = uzun, benzersiz yönetici şifresi
   SESSION_SECRET      = en az 32 rastgele karakterlik gizli anahtar
   RATE_LIMIT_SALT     = en az 32 rastgele karakterlik ayrı gizli anahtar
   Bunları kaynak koduna veya GitHub'a yazma. Şifreleri kimseyle sohbet üzerinden paylaşma.
   Secret ekledikten sonra yeniden deploy et.

F. Test:
   - / sayfası açılıyor mu?
   - /api/requests formu gerçek kaydı oluşturuyor mu?
   - /admin.html giriş yapılıyor mu?
   - Test kaydı panelde görünüyor mu?
   - Fotoğraf yükleniyor ve yalnızca giriş yapan admin görebiliyor mu?
   - Durum güncellemesi kaydoluyor mu?
   - Telefon/WhatsApp/Instagram/adres bağlantıları doğru mu?

ADMIN PANELİ
- URL: https://SITEN-ADRESI/admin.html
- Şifre Cloudflare ADMIN_PASSWORD secret'ıdır.
- Oturum 8 saat geçerlidir; HttpOnly, Secure ve SameSite=Strict cookie kullanılır.
- Panel son 200 talebi listeler. Talep durumları: Yeni, İletişime geçildi, Tamamlandı, İptal edildi.

FORM VE GÜVENLİK
- Zorunlu alan doğrulaması, hizmet/ilçe allowlist, 5 MB fotoğraf limiti, MIME kontrolü,
  honeypot, basit IP bazlı hız sınırı ve prepared SQL statements uygulanır.
- Konum isteğe bağlıdır; yalnızca ziyaretçi butona basıp tarayıcı izni verirse alınır.
- Fotoğraflar herkese açık URL ile sunulmaz; yönetici oturumu gerektirir.
- Bu önlemler temel korumadır; spam için ileride Turnstile gibi ek koruma düşünülebilir.

YAYINA ÇIKMADAN ÖNCE MUTLAKA TAMAMLANACAKLAR
- KVKK metnindeki veri sorumlusunun resmî adı/ticaret unvanı ve başvuru adresi işletme sahibi tarafından doğrulanmalı.
- Kayıt türlerine göre saklama-imha takvimi belirlenmeli; Cloudflare altyapısının yurt dışı aktarım şartları KVKK m.9 kapsamında değerlendirilip uygun mekanizma kurulmalı.
- KVKK sayfası işletme bilgileri ve gerçek altyapı ayarlarıyla son kez gözden geçirilmeli; gerekirse hukuk uzmanından görüş alınmalı.
- Gerçek hizmet verilen ilçeler ve hizmet kapsamı. Şu an formda Hatay ilçeleri listelenmiştir;
  işletmenin hizmet vermediği ilçeler listeden çıkarılmalıdır.
- Domain satın alındıktan sonra sitemap.xml ve robots.txt içindeki gerçek alan adı güncellenmelidir.
- İşletme sahibine admin paneli kullanımı ve talep kontrol sıklığı anlatılmalıdır.
- Gerçek test talebi oluşturulup ardından silinmeli/iptal edilmelidir.

TEKNİK NOT
Cloudflare Pages Functions, Pages projesine functions/ dizini eklenerek dağıtılır. D1 ve R2
binding'leri wrangler.toml veya Cloudflare dashboard üzerinden tanımlanabilir. Cloudflare
belgeleri: https://developers.cloudflare.com/pages/functions/bindings/
https://developers.cloudflare.com/pages/functions/wrangler-configuration/
