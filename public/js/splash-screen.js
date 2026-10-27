// public/js/splash-screen.js
// Branded Native Splash Screen untuk SedayaClick PWA

(function() {
  // Hanya buat jika belum ada di DOM
  if (document.getElementById('sedaya-splash-screen')) return;

  const splash = document.createElement('div');
  splash.id = 'sedaya-splash-screen';
  splash.className = 'fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-slate-950 text-white select-none transition-all duration-600 ease-out';
  splash.style.cssText = 'touch-action: none; overscroll-behavior: none;';

  splash.innerHTML = `
    <!-- Ambient Glow Effect -->
    <div class="absolute w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none animate-pulse"></div>
    <div class="absolute w-48 h-48 rounded-full bg-blue-500/15 blur-2xl pointer-events-none -top-10 -left-10"></div>

    <!-- Centered Brand Logo & Text -->
    <div class="relative z-10 flex flex-col items-center text-center px-6">
      <div class="relative w-20 h-20 mb-5 flex items-center justify-center">
        <!-- Logo Shimmer Ring -->
        <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-blue-500 opacity-80 blur-md animate-pulse"></div>
        <img src="/icons/icon-192.png" alt="SedayaClick Logo" class="relative w-16 h-16 rounded-2xl shadow-2xl object-cover ring-2 ring-white/20 transform hover:scale-105 transition-transform duration-300" />
      </div>

      <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5">
        Sedaya<span class="text-indigo-400">Click</span>
      </h1>
      <p class="text-xs text-slate-400 font-medium tracking-wide mt-1">Presensi & Penggajian Digital</p>

      <!-- Sleek Progress Bar Runner -->
      <div class="w-44 h-1.5 bg-slate-800/80 rounded-full mt-7 overflow-hidden relative border border-slate-700/50">
        <div class="sedaya-progress-runner absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-indigo-500 via-blue-400 to-indigo-500 rounded-full"></div>
      </div>

      <p class="text-[11px] text-slate-500 mt-3 font-mono">Menyiapkan ruang kerja...</p>
    </div>
  `;

  // Inject Keyframe CSS untuk runner
  const style = document.createElement('style');
  style.id = 'sedaya-splash-style';
  style.textContent = `
    @keyframes sedayaRun {
      0% { left: -35%; }
      50% { left: 40%; width: 50%; }
      100% { left: 105%; width: 25%; }
    }
    .sedaya-progress-runner {
      animation: sedayaRun 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
  `;
  document.head.appendChild(style);

  // Pasang splash langsung ke body atau html
  if (document.body) {
    document.body.appendChild(splash);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(splash));
  }

  // Fungsi untuk menutup splash screen dengan smooth fade-out
  window.dismissSedayaSplash = function(delayMs = 200) {
    setTimeout(() => {
      const el = document.getElementById('sedaya-splash-screen');
      if (el) {
        el.style.opacity = '0';
        el.style.transform = 'scale(1.03)';
        el.style.pointerEvents = 'none';
        setTimeout(() => {
          el.remove();
          const styleEl = document.getElementById('sedaya-splash-style');
          if (styleEl) styleEl.remove();
        }, 550);
      }
    }, delayMs);
  };

  // Default auto-dismiss setelah window load atau timeout 1.2 detik maksimal
  window.addEventListener('load', () => {
    window.dismissSedayaSplash(300);
  });
  setTimeout(() => {
    window.dismissSedayaSplash(0);
  }, 1200);
})();
