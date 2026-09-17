// public/js/api.js
// Helper terpusat untuk memanggil backend, supaya kredensial (cookie session)
// selalu ikut terkirim dan penanganan error konsisten di semua halaman.

const BASE = '/api';

async function handleResponse(res) {
  let body;
  try {
    body = await res.json();
  } catch (e) {
    throw new Error('Respons server tidak valid.');
  }
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Terjadi kesalahan (${res.status}).`);
  }
  return body;
}

export async function apiGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  return handleResponse(res);
}

export async function apiPost(path, data = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse(res);
}

export async function apiPatch(path, data = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse(res);
}

export async function apiPut(path, data = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse(res);
}

export async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include' });
  return handleResponse(res);
}

/**
 * Untuk endpoint yang menerima multipart/form-data (upload foto/berkas).
 * `formData` harus berupa instance FormData yang sudah diisi.
 */
export async function apiPostForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  return handleResponse(res);
}

/**
 * Mengunduh file hasil ekspor (CSV/XLSX) yang dikirim server sebagai blob.
 */
export async function apiDownload(path, params = {}, fallbackFilename = 'download') {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Gagal mengunduh file.');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : fallbackFilename;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
