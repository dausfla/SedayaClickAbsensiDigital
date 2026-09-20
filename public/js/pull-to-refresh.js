// public/js/pull-to-refresh.js
// Komponen Pull-to-Refresh universal untuk PWA SedayaClick pada seluruh role dashboard.

(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Elemen indikator Pull to Refresh
  let indicator = null;
  let spinner = null;
  let text = null;

  let startY = 0;
  let currentY = 0;
  let pullDistance = 0;
  let isPulling = false;
  let isRefreshing = false;
  const THRESHOLD = 65; // Jarak tarik piksel untuk memicu refresh

  function createIndicator() {
    if (document.getElementById('ptr-indicator')) return;

    indicator = document.createElement('div');
    indicator.id = 'ptr-indicator';
    indicator.className = 'fixed top-0 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-transform duration-150 ease-out -translate-y-full pt-3';
    indicator.innerHTML = `
      <div class="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 shadow-2xl rounded-full px-4 py-2 flex items-center gap-2.5 text-xs font-extrabold select-none">
        <svg id="ptr-spinner" class="w-4 h-4 text-brand-600 dark:text-brand-400 transition-transform duration-200" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span id="ptr-text" class="text-[11px] font-bold text-slate-700 dark:text-slate-200">Tarik ke bawah...</span>
      </div>
    `;

    document.body.appendChild(indicator);
    spinner = document.getElementById('ptr-spinner');
    text = document.getElementById('ptr-text');
  }

  function onTouchStart(e) {
    if (isRefreshing) return;
    // Pemicu hanya aktif bila pengguna berada di paling atas halaman (scrollY <= 0)
    if (window.scrollY <= 2 || document.documentElement.scrollTop <= 2) {
      startY = e.touches[0].clientY;
      isPulling = true;
      pullDistance = 0;
    } else {
      isPulling = false;
    }
  }

  function onTouchMove(e) {
    if (!isPulling || isRefreshing) return;

    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    // Jika menarik ke bawah dan posisi scroll tetap di paling atas
    if (deltaY > 0 && (window.scrollY <= 2 || document.documentElement.scrollTop <= 2)) {
      // Terapkan efek tahanan elastis (resistance ratio 0.4)
      pullDistance = Math.min(deltaY * 0.42, 90);

      if (pullDistance > 10) {
        if (!indicator) createIndicator();
        indicator.style.transform = `translate(-50%, ${pullDistance}px)`;

        if (pullDistance >= THRESHOLD) {
          if (text) text.textContent = 'Lepas untuk memuat ulang';
          if (spinner) spinner.classList.add('rotate-180', 'animate-spin');
        } else {
          if (text) text.textContent = 'Tarik ke bawah...';
          if (spinner) spinner.classList.remove('rotate-180', 'animate-spin');
        }
      }
    } else {
      resetIndicator();
    }
  }

  function onTouchEnd() {
    if (!isPulling || isRefreshing) return;

    if (pullDistance >= THRESHOLD) {
      triggerRefresh();
    } else {
      resetIndicator();
    }
    isPulling = false;
  }

  function triggerRefresh() {
    isRefreshing = true;
    if (indicator) {
      indicator.style.transform = `translate(-50%, ${THRESHOLD}px)`;
      if (text) text.textContent = 'Memuat ulang...';
      if (spinner) spinner.classList.add('animate-spin');
    }

    // Berikan efek umpan balik visual singkat lalu reload halaman
    setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  function resetIndicator() {
    pullDistance = 0;
    if (indicator) {
      indicator.style.transform = 'translate(-50%, -100%)';
    }
    if (spinner) {
      spinner.classList.remove('animate-spin', 'rotate-180');
    }
  }

  // Inisialisasi event listener saat dokumen siap
  document.addEventListener('DOMContentLoaded', () => {
    createIndicator();
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
  });
})();
