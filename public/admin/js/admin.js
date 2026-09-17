// public/admin/js/admin.js
import { apiGet, apiPost, apiPatch } from '../../js/api.js';

const alertBox = document.getElementById('alert-box');
const alertMsg = document.getElementById('alert-msg');
const btnCloseAlert = document.getElementById('btn-close-alert');

function showAlert(message, type = 'error') {
  if (alertMsg) alertMsg.textContent = message;
  else alertBox.textContent = message;

  alertBox.classList.remove('hidden', 'bg-rose-50', 'text-rose-700', 'border-rose-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
  alertBox.classList.add(
    type === 'error' ? 'bg-rose-50' : 'bg-emerald-50',
    type === 'error' ? 'text-rose-700' : 'text-emerald-700',
    type === 'error' ? 'border-rose-200' : 'border-emerald-200'
  );
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function hideAlert() {
  if (alertBox) alertBox.classList.add('hidden');
}

if (btnCloseAlert) {
  btnCloseAlert.addEventListener('click', hideAlert);
}

// Check session
(async () => {
  try {
    const { loggedIn, user } = await apiGet('/auth/session');
    if (!loggedIn || user.role !== 'admin_manager') {
      window.location.href = '/index.html';
      return;
    }
    document.getElementById('admin-name').textContent = user.full_name;
    const roleInfo = document.getElementById('admin-role-info');
    if (roleInfo) roleInfo.textContent = `Divisi ${user.division_name || 'Umum'}`;

    loadPending();
  } catch (e) {
    window.location.href = '/index.html';
  }
})();

// Logout Handler
document.getElementById('btn-logout').addEventListener('click', async () => {
  await apiPost('/auth/logout');
  window.location.href = '/index.html';
});

/* Tab Switching (Pending & History) */
const tabs = document.querySelectorAll('.tab-btn');
const panels = { pending: 'panel-pending', history: 'panel-history' };
tabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabs.forEach((b) => {
      b.classList.remove('active', 'text-brand-600');
      b.classList.add('text-slate-500');
    });
    btn.classList.add('active', 'text-brand-600');
    btn.classList.remove('text-slate-500');

    Object.entries(panels).forEach(([key, id]) => {
      const panel = document.getElementById(id);
      if (panel) panel.classList.toggle('hidden', key !== btn.dataset.tab);
    });

    if (btn.dataset.tab === 'pending') loadPending();
    if (btn.dataset.tab === 'history') loadHistory();
  });
});

const TYPE_LABEL = { izin: 'Izin Khusus', cuti: 'Cuti Tahunan', sakit: 'Sakit' };
const STATUS_STYLE = { approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60', rejected: 'bg-rose-50 text-rose-700 border border-rose-200/60' };
const STATUS_LABEL = { approved: 'Disetujui', rejected: 'Ditolak' };

/* ---------------------------------------------------------
   Pengajuan Pending
--------------------------------------------------------- */
async function loadPending() {
  const container = document.getElementById('pending-list');
  if (!container) return;
  try {
    const { submissions } = await apiGet('/admin/submissions/pending');
    if (!submissions || submissions.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-2xl border border-slate-100 p-6 text-center shadow-xs">
          <p class="text-xs text-slate-400 font-medium">Tidak ada pengajuan yang menunggu persetujuan saat ini.</p>
        </div>`;
      return;
    }
    container.innerHTML = submissions.map((s) => `
      <div class="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span class="font-bold text-slate-900 text-sm sm:text-base">${s.full_name}</span>
          </div>
          <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-200/60 uppercase tracking-wide">${TYPE_LABEL[s.type] || s.type}</span>
        </div>

        <div class="text-xs text-slate-600 space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
          <p><span class="font-bold text-slate-700">Jabatan:</span> ${s.position_name || '-'}</p>
          <p><span class="font-bold text-slate-700">Periode:</span> ${s.start_date} s/d ${s.end_date}</p>
          <p><span class="font-bold text-slate-700">Alasan:</span> ${s.reason || '-'}</p>
          ${s.attachment ? `<div class="pt-1"><a href="${s.attachment}" target="_blank" class="text-brand-600 font-bold hover:underline inline-flex items-center gap-1">📎 Lihat Lampiran Bukti</a></div>` : ''}
        </div>

        <div class="flex gap-2.5 pt-1">
          <button class="btn-approve flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full py-2.5 shadow-sm active:scale-[0.98] transition-all" data-id="${s.id}" data-name="${s.full_name}">Setujui</button>
          <button class="btn-reject flex-1 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-full py-2.5 border border-rose-200/60 active:scale-[0.98] transition-all" data-id="${s.id}" data-name="${s.full_name}">Tolak</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.btn-approve').forEach((b) => b.addEventListener('click', () => openDecisionModal(b.dataset.id, b.dataset.name, 'approved')));
    document.querySelectorAll('.btn-reject').forEach((b) => b.addEventListener('click', () => openDecisionModal(b.dataset.id, b.dataset.name, 'rejected')));
  } catch (err) {
    container.innerHTML = `<p class="text-rose-500 text-center py-4 text-xs font-semibold">${err.message}</p>`;
  }
}

/* Modal Keputusan */
const modal = document.getElementById('decision-modal');
const decisionNote = document.getElementById('decision-note');
let activeDecision = null;

function openDecisionModal(id, name, decision) {
  activeDecision = { id, decision };
  decisionNote.value = '';
  document.getElementById('decision-title').textContent =
    `${decision === 'approved' ? 'Setujui' : 'Tolak'} pengajuan ${name}`;
  modal.classList.remove('hidden');
}

const btnCancelModal = document.getElementById('btn-cancel-decision');
if (btnCancelModal) {
  btnCancelModal.addEventListener('click', () => modal.classList.add('hidden'));
}

const btnConfirmModal = document.getElementById('btn-confirm-decision');
if (btnConfirmModal) {
  btnConfirmModal.addEventListener('click', async () => {
    hideAlert();
    if (!decisionNote.value.trim()) {
      showAlert('Catatan alasan wajib diisi.');
      return;
    }
    try {
      const result = await apiPatch(`/admin/submissions/${activeDecision.id}/decision`, {
        decision: activeDecision.decision,
        review_note: decisionNote.value.trim()
      });
      modal.classList.add('hidden');
      showAlert(result.message, 'success');
      loadPending();
    } catch (err) {
      showAlert(err.message);
    }
  });
}

/* ---------------------------------------------------------
   Riwayat Persetujuan
--------------------------------------------------------- */
async function loadHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  try {
    const { submissions } = await apiGet('/admin/submissions/history');
    if (!submissions || submissions.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-2xl border border-slate-100 p-6 text-center shadow-xs">
          <p class="text-xs text-slate-400 font-medium">Belum ada riwayat persetujuan pengajuan.</p>
        </div>`;
      return;
    }
    container.innerHTML = submissions.map((s) => `
      <div class="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-xs space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-900 text-sm sm:text-base">${s.full_name}</span>
          <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-600'}">${STATUS_LABEL[s.status] || s.status}</span>
        </div>
        <p class="text-xs text-slate-500 font-medium"><span class="font-bold text-slate-700">${TYPE_LABEL[s.type] || s.type}</span> · ${s.start_date} s/d ${s.end_date}</p>
        ${s.review_note ? `<p class="text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 italic"><span class="font-bold not-italic text-slate-700">Catatan Review:</span> ${s.review_note}</p>` : ''}
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-rose-500 text-center py-4 text-xs font-semibold">${err.message}</p>`;
  }
}
