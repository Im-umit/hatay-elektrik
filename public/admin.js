(() => {
  const $ = (selector) => document.querySelector(selector);
  const login = $('#login-card');
  const dashboard = $('#dashboard');
  const message = $('#login-message');
  const list = $('#requests');
  const statuses = {
    new: 'Yeni',
    contacted: 'İletişime geçildi',
    completed: 'Tamamlandı',
    cancelled: 'İptal edildi'
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'İşlem başarısız.');
    return data;
  }

  async function load() {
    try {
      const data = await api('/api/admin/requests', { method: 'GET' });
      login.classList.add('hidden');
      dashboard.classList.remove('hidden');
      render(data.requests || []);
    } catch (error) {
      login.classList.remove('hidden');
      dashboard.classList.add('hidden');
      if (message && error.message !== 'Oturum gerekli.') message.textContent = error.message;
    }
  }

  function render(items) {
    if (!items.length) {
      list.innerHTML = '<div class="admin-card">Henüz servis talebi bulunmuyor.</div>';
      return;
    }

    list.innerHTML = items.map((item) => `
      <article class="request-item">
        <div class="request-top">
          <strong>${escapeHtml(item.reference)} · ${escapeHtml(item.name)}</strong>
          <span class="muted">${new Date(item.created_at).toLocaleString('tr-TR')}</span>
        </div>
        <p>
          <b>Telefon:</b> <a href="tel:${escapeHtml(item.phone)}">${escapeHtml(item.phone)}</a><br>
          <b>Hizmet:</b> ${escapeHtml(item.service)}<br>
          <b>Adres:</b> Hatay / ${escapeHtml(item.district)} / ${escapeHtml(item.neighborhood)} / ${escapeHtml(item.address)}<br>
          <b>Açıklama:</b> ${escapeHtml(item.details)}
        </p>
        ${item.latitude !== null && item.longitude !== null
          ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(`${item.latitude},${item.longitude}`)}" target="_blank" rel="noopener noreferrer">Konumu haritada aç ↗</a>`
          : ''}
        <div class="request-top request-status-row">
          <label>Durum
            <select data-ref="${escapeHtml(item.reference)}">
              ${Object.entries(statuses).map(([key, label]) => `<option value="${key}" ${item.status === key ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>
          <span class="muted" data-status-message>Durumu değiştirince kaydedilir.</span>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('select[data-ref]').forEach((select) => {
      select.addEventListener('change', async () => {
        const statusMessage = select.closest('.request-status-row')?.querySelector('[data-status-message]');
        select.disabled = true;
        if (statusMessage) statusMessage.textContent = 'Kaydediliyor…';
        try {
          await api('/api/admin/requests', {
            method: 'PATCH',
            body: JSON.stringify({ reference: select.dataset.ref, status: select.value })
          });
          if (statusMessage) statusMessage.textContent = 'Kaydedildi';
          select.classList.add('saved');
        } catch (error) {
          if (statusMessage) statusMessage.textContent = error.message;
          alert(error.message);
        } finally {
          select.disabled = false;
        }
      });
    });
  }

  $('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (message) message.textContent = 'Kontrol ediliyor…';
    try {
      const password = new FormData(event.currentTarget).get('password');
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      if (message) message.textContent = '';
      await load();
    } catch (error) {
      if (message) {
        message.textContent = error.message;
        message.className = 'admin-error';
      }
    }
  });

  $('#logout')?.addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST', body: '{}' }).catch(() => {});
    dashboard.classList.add('hidden');
    login.classList.remove('hidden');
  });

  load();
})();
