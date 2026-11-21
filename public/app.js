(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const form = $('#service-form');
  const startedAt = $('#form-started-at');
  const menu = $('.menu-toggle');
  const nav = $('#main-nav');
  const phone = '905550853017';
  const year = $('#year');
  const photoWhatsAppLink = $('#photo-whatsapp-link');
  const locationStatus = $('#location-status');
  const latitude = $('#latitude');
  const longitude = $('#longitude');
  const mapLink = $('#map-preview-link');

  if (year) year.textContent = String(new Date().getFullYear());
  if (startedAt) startedAt.value = String(Date.now());

  const makeWhatsAppUrl = (message) => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  document.querySelectorAll('a[href^="https://wa.me/"]').forEach((link) => {
    if (!link.id && !link.href.includes('?')) {
      link.href = makeWhatsAppUrl('Merhaba, Hatay Elektrik ile görüşmek istiyorum.');
    }
  });

  const closeMenu = () => {
    if (!menu || !nav) return;
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
    document.body.classList.remove('menu-open');
  };

  menu?.addEventListener('click', () => {
    const isOpen = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!isOpen));
    nav?.classList.toggle('open', !isOpen);
    document.body.classList.toggle('menu-open', !isOpen);
  });
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
  document.addEventListener('click', (event) => {
    if (nav?.classList.contains('open') && !nav.contains(event.target) && !menu?.contains(event.target)) closeMenu();
  });

  $('#use-location')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      if (locationStatus) locationStatus.textContent = 'Bu cihaz konum özelliğini desteklemiyor. Adresi elle yazabilirsiniz.';
      return;
    }
    if (locationStatus) locationStatus.textContent = 'Konum alınıyor…';
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      if (latitude) latitude.value = lat;
      if (longitude) longitude.value = lng;
      if (locationStatus) locationStatus.textContent = 'Konum eklendi. İsterseniz haritada kontrol edin.';
      if (mapLink) {
        mapLink.href = `https://www.google.com/maps?q=${lat},${lng}`;
        mapLink.hidden = false;
      }
    }, (error) => {
      if (locationStatus) {
        locationStatus.textContent = error.code === 1
          ? 'Konum izni verilmedi. Adresi elle yazabilirsiniz.'
          : 'Konum alınamadı. Adresi elle yazabilirsiniz.';
      }
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });

  document.querySelectorAll('[data-service]').forEach((link) => {
    link.addEventListener('click', () => {
      const serviceSelect = form?.elements.namedItem('service');
      if (serviceSelect) serviceSelect.value = link.dataset.service || '';
    });
  });

  function showMessage(message, type = 'info') {
    const box = $('#form-result');
    if (!box) return;
    box.hidden = false;
    box.className = `form-result full-width ${type}`;
    box.textContent = message;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const submitButton = $('.form-submit', form);
    const submitLabel = $('span', submitButton);
    const help = $('#form-help');
    const originalLabel = submitLabel?.textContent || 'Servis talebini gönder';
    const details = new FormData(form);
    const requestSummary = {
      name: String(details.get('name') || '').trim(),
      service: String(details.get('service') || '').trim(),
      district: String(details.get('district') || '').trim(),
      neighborhood: String(details.get('neighborhood') || '').trim()
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add('loading');
    }
    if (submitLabel) submitLabel.textContent = 'Talebiniz gönderiliyor…';
    if (help) help.textContent = 'Bilgileriniz güvenli bağlantı üzerinden kaydediliyor. Lütfen sayfayı kapatmayın.';
    if (photoWhatsAppLink) photoWhatsAppLink.hidden = true;

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        body: details,
        headers: { Accept: 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Talep gönderilemedi. Lütfen telefonla veya WhatsApp üzerinden ulaşın.');

      const reference = String(data.reference || '').trim();
      if (photoWhatsAppLink && reference) {
        const message = [
          'Merhaba Hatay Elektrik, web sitesi üzerinden servis talebi oluşturdum.',
          `Talep numaram: ${reference}`,
          `Ad Soyad: ${requestSummary.name}`,
          `Hizmet: ${requestSummary.service}`,
          `İlçe: ${requestSummary.district}`,
          `Mahalle: ${requestSummary.neighborhood}`,
          'Arıza fotoğrafını bu WhatsApp mesajına ekliyorum.'
        ].join('\n');
        photoWhatsAppLink.href = makeWhatsAppUrl(message);
        photoWhatsAppLink.hidden = false;
      }

      form.reset();
      if (startedAt) startedAt.value = String(Date.now());
      if (latitude) latitude.value = '';
      if (longitude) longitude.value = '';
      if (mapLink) mapLink.hidden = true;
      if (locationStatus) locationStatus.textContent = 'İsteğe bağlı · Konum paylaşmak zorunda değilsiniz.';
      showMessage(`Talebiniz başarıyla kaydedildi. Talep numaranız: ${reference}. Ekibimiz sizinle telefonla iletişime geçecektir. Fotoğraf göndermek isterseniz aşağıdaki WhatsApp düğmesini kullanın.`, 'success');
      if (help) help.textContent = 'Talebiniz sisteme kaydedildi.';
    } catch (error) {
      showMessage(error.message || 'Bir sorun oluştu. Telefonla veya WhatsApp üzerinden ulaşabilirsiniz.', 'error');
      if (help) help.textContent = 'Talep kaydedilemedi. Bilgilerinizi kontrol edip tekrar deneyin veya doğrudan arayın.';
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
      }
      if (submitLabel) submitLabel.textContent = originalLabel;
    }
  });
})();
