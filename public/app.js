(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const form = $('#service-form');
  const startedAt = $('#form-started-at'); if (startedAt) startedAt.value = String(Date.now());
  const menu = $('.menu-toggle');
  const nav = $('#main-nav');
  const phone = '+905550853017';
  const year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  // Mobile navigation
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!open));
    nav?.classList.toggle('open', !open);
    document.body.classList.toggle('menu-open', !open);
  });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open'); menu?.setAttribute('aria-expanded','false'); document.body.classList.remove('menu-open');
  }));

  // Contact links are real links; no JavaScript interception. Add prefilled WhatsApp text only to the WhatsApp shortcut.
  document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a => {
    if (!a.href.includes('?')) a.href = `https://wa.me/${phone.replace('+','')}?text=${encodeURIComponent('Merhaba, Hatay Elektrik ile görüşmek istiyorum.')}`;
  });

  const photo = $('#photo'), preview = $('#file-preview'), fileName = $('#file-name');
  photo?.addEventListener('change', () => {
    const f = photo.files?.[0];
    if (!f) { preview.hidden = true; return; }
    if (!['image/jpeg','image/png','image/webp'].includes(f.type) || f.size > 5*1024*1024) {
      photo.value=''; preview.hidden=true; showMessage('Lütfen JPG, PNG veya WebP türünde, 5 MB’tan küçük bir fotoğraf seçin.', 'error'); return;
    }
    fileName.textContent = `${f.name} · ${(f.size/1024/1024).toFixed(2)} MB`; preview.hidden=false;
  });
  $('#remove-photo')?.addEventListener('click', () => { photo.value=''; preview.hidden=true; });

  const status = $('#location-status'), lat = $('#latitude'), lng = $('#longitude'), mapLink = $('#map-preview-link');
  $('#use-location')?.addEventListener('click', () => {
    if (!navigator.geolocation) { status.textContent='Bu cihaz konum özelliğini desteklemiyor.'; return; }
    status.textContent='Konum alınıyor…';
    navigator.geolocation.getCurrentPosition(pos => {
      lat.value = pos.coords.latitude.toFixed(6); lng.value = pos.coords.longitude.toFixed(6);
      status.textContent='Konum eklendi. Haritada kontrol edebilirsiniz.';
      mapLink.href=`https://www.google.com/maps?q=${lat.value},${lng.value}`; mapLink.hidden=false;
    }, err => { status.textContent = err.code === 1 ? 'Konum izni verilmedi. Adresi elle yazabilirsiniz.' : 'Konum alınamadı. Adresi elle yazabilirsiniz.'; }, {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
  });

  // Service cards preselect the requested service.
  document.querySelectorAll('[data-service]').forEach(a => a.addEventListener('click', () => {
    const select = form?.elements.namedItem('service'); if (select) select.value = a.dataset.service;
  }));

  function showMessage(message, type='info') {
    const box = $('#form-result'); if (!box) return;
    box.hidden=false; box.className=`form-result full-width ${type}`; box.textContent=message;
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const submit = $('.form-submit', form), help = $('#form-help');
    submit.disabled=true; submit.classList.add('loading'); $('span',submit).textContent='Talebiniz gönderiliyor…';
    if (help) help.textContent='Bilgileriniz güvenli bağlantı üzerinden gönderiliyor.';
    try {
      const response = await fetch('/api/requests', {method:'POST', body:new FormData(form), headers:{'Accept':'application/json'}});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || 'Talep gönderilemedi. Lütfen tekrar deneyin.');
      form.reset(); if (startedAt) startedAt.value = String(Date.now()); if (preview) preview.hidden=true; if (mapLink) mapLink.hidden=true;
      if (status) status.textContent='İsterseniz konum ekleyebilirsiniz.';
      showMessage(`Talebiniz başarıyla kaydedildi. Talep numaranız: ${data.reference}. Hatay Elektrik ekibi sizinle telefonla iletişime geçecektir.`, 'success');
      if (help) help.textContent='Talebiniz sisteme kaydedildi.';
    } catch (err) {
      showMessage(err.message || 'Bir hata oluştu. Telefonla veya WhatsApp üzerinden ulaşabilirsiniz.', 'error');
      if (help) help.textContent='Gönderim başarısız olduysa bilgilerinizi kontrol edip tekrar deneyin.';
    } finally {
      submit.disabled=false; submit.classList.remove('loading'); $('span',submit).textContent='Servis talebini gönder';
    }
  });
})();
