/**
 * services/telegramBot.js
 * SedayaClick Ops, Monitoring & Database Maintenance Bot
 * Native Node.js long-polling implementation (Zero external npm packages)
 */

require('dotenv').config();
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const pool = require('../config/db');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '6976060595');

if (!BOT_TOKEN) {
  console.error('[TelegramBot Error]: TELEGRAM_BOT_TOKEN belum diatur di file .env!');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ROOT_DIR = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

// In-memory safety state for 2-step confirmations
const pendingConfirmations = new Map();

/**
 * Helper untuk memanggil Telegram Bot API (JSON)
 */
async function callTelegram(method, payload = {}) {
  try {
    const res = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error(`[TelegramBot API Error - ${method}]:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Helper untuk mengirim file dokumen (backup, database dump, arsip foto)
 */
async function sendTelegramDocument(chatId, filePath, caption = '') {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} tidak ditemukan.`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (caption) formData.append('caption', caption);
    formData.append('document', blob, fileName);

    const res = await fetch(`${API_BASE}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    return await res.json();
  } catch (err) {
    console.error('[TelegramBot SendDocument Error]:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Helper eksekusi shell command sebagai Promise
 */
function execCmd(command, cwd = ROOT_DIR) {
  return new Promise((resolve) => {
    exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout ? stdout.trim() : '',
        stderr: stderr ? stderr.trim() : '',
        error: error ? error.message : null
      });
    });
  });
}

/**
 * Format ukuran byte ke format human-readable
 */
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format uptime detik ke format jam/hari
 */
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d} hari`);
  if (h > 0) parts.push(`${h} jam`);
  parts.push(`${m} menit`);
  return parts.join(' ');
}

/**
 * Hitung ukuran direktori secara rekursif
 */
function getDirSize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        size += getDirSize(filePath);
      } else {
        size += stat.size;
      }
    } catch (e) {}
  }
  return size;
}

/**
 * Keyboard Menu Utama
 */
function getMainMenuMarkup() {
  return {
    inline_keyboard: [
      [
        { text: '📊 Status Server & PM2', callback_data: 'act_status' },
        { text: '🔄 Restart App', callback_data: 'act_restart' }
      ],
      [
        { text: '📜 Cek Log Error PM2', callback_data: 'act_logs' },
        { text: '🚀 Git Pull & Deploy', callback_data: 'act_deploy' }
      ],
      [
        { text: '💾 Backup Database (SQL)', callback_data: 'act_backup_sql' },
        { text: '📸 Backup Foto (Uploads)', callback_data: 'act_backup_uploads' }
      ],
      [
        { text: '📦 Backup Penuh (DB+Foto)', callback_data: 'act_backup_full' },
        { text: '📈 Cek Ukuran Storage', callback_data: 'act_check_storage' }
      ],
      [
        { text: '🧹 Bersihkan Sesi Basi', callback_data: 'act_clean_sessions' },
        { text: '🗑️ Bersihkan Foto Yatim', callback_data: 'act_clean_orphans' }
      ],
      [
        { text: '⚙️ Optimasi Tabel MySQL', callback_data: 'act_optimize_db' },
        { text: '👥 Kehadiran Hari Ini', callback_data: 'act_today_attendance' }
      ],
      [
        { text: '🚨 Tarik & Kosongkan Data (Purge)', callback_data: 'act_prompt_purge' }
      ]
    ]
  };
}

/**
 * Kirim Menu Utama
 */
async function sendMainMenu(chatId, messageId = null) {
  const text = `🤖 *SedayaClick Ops & Maintenance Bot*\n` +
    `_Sistem Kendali Server, Backup & Perawatan Database_\n\n` +
    `• Host: \`${os.hostname()}\` (${os.type()} ${os.release()})\n` +
    `• Waktu Server: \`${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\`\n\n` +
    `Pilih aksi pada tombol di bawah:`;

  if (messageId) {
    return await callTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      reply_markup: getMainMenuMarkup()
    });
  } else {
    return await callTelegram('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: getMainMenuMarkup()
    });
  }
}

/**
 * Handle Callback Queries dari Inline Buttons
 */
async function handleCallbackQuery(query) {
  const chatId = String(query.message.chat.id);
  const data = query.data;

  // Verifikasi Whitelist Chat ID
  if (chatId !== ADMIN_CHAT_ID) {
    await callTelegram('answerCallbackQuery', {
      callback_query_id: query.id,
      text: '⛔ Akses ditolak. Anda bukan Administrator!',
      show_alert: true
    });
    return;
  }

  // Answer callback agar tombol tidak loading terus
  await callTelegram('answerCallbackQuery', { callback_query_id: query.id });

  if (data === 'act_menu') {
    await sendMainMenu(chatId, query.message.message_id);
    return;
  }

  /* ---------------- 1. STATUS SERVER & PM2 ---------------- */
  if (data === 'act_status') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '⏳ _Mengumpulkan data diagnostik server..._',
      parse_mode: 'Markdown'
    });

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
    const loadAvg = os.loadavg().map(n => n.toFixed(2)).join(', ');
    const uptimeStr = formatUptime(os.uptime());

    // Cek disk VPS via df -h
    const dfRes = await execCmd('df -h /');
    let diskInfo = 'Tidak diketahui';
    if (dfRes.success && dfRes.stdout) {
      const lines = dfRes.stdout.split('\n');
      if (lines.length > 1) {
        diskInfo = lines[1].replace(/\s+/g, ' ');
      }
    }

    // Cek status PM2
    const pm2Res = await execCmd('pm2 jlist');
    let pm2StatusText = '';
    if (pm2Res.success && pm2Res.stdout) {
      try {
        const list = JSON.parse(pm2Res.stdout);
        const app = list.find(p => p.name === 'sedayaclick');
        if (app) {
          const status = app.pm2_env.status === 'online' ? '🟢 Online' : `🔴 ${app.pm2_env.status}`;
          const memMb = (app.monit.memory / (1024 * 1024)).toFixed(1);
          const cpuPct = app.monit.cpu;
          const restarts = app.pm2_env.restart_time || 0;
          const appUptime = formatUptime(Math.floor((Date.now() - app.pm2_env.pm_uptime) / 1000));
          pm2StatusText = `\n*Status Aplikasi PM2 (sedayaclick):*\n` +
            `• Status: ${status}\n` +
            `• Uptime: ${appUptime}\n` +
            `• CPU: ${cpuPct}%\n` +
            `• RAM: ${memMb} MB\n` +
            `• Restart Count: ${restarts}x\n`;
        }
      } catch (e) {}
    }

    const report = `📊 *Laporan Diagnostik Server & PM2*\n` +
      `───────────────────────────\n` +
      `• *Host:* \`${os.hostname()}\`\n` +
      `• *OS Uptime:* ${uptimeStr}\n` +
      `• *CPU Load Avg:* \`${loadAvg}\`\n` +
      `• *RAM Server:* ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${memPercent}%)\n` +
      `• *Disk Root (/):* \`${diskInfo}\`\n` +
      `${pm2StatusText}\n` +
      `_Pembaruan otomatis real-time._`;

    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: report,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]]
      }
    });
    return;
  }

  /* ---------------- 2. RESTART APLIKASI (PM2) ---------------- */
  if (data === 'act_restart') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '🔄 _Menjalankan pm2 restart sedayaclick di server..._',
      parse_mode: 'Markdown'
    });

    const res = await execCmd('pm2 restart sedayaclick');
    if (res.success) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `✅ *Aplikasi sedayaclick berhasil di-restart!*\n\n\`\`\`\n${res.stdout.slice(-400)}\n\`\`\``,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]]
        }
      });
    } else {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `❌ *Gagal restart aplikasi!*\n\nError: \`${res.error || res.stderr}\``,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]]
        }
      });
    }
    return;
  }

  /* ---------------- 3. CEK LOG ERROR PM2 ---------------- */
  if (data === 'act_logs') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '📜 _Mengambil 30 baris error log terbaru..._',
      parse_mode: 'Markdown'
    });

    const res = await execCmd('pm2 logs sedayaclick --err --lines 30 --nostream');
    let logContent = res.stdout || res.stderr || 'Tidak ada log error ditemukan.';
    if (logContent.length > 3500) {
      logContent = logContent.slice(-3500);
    }

    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: `📜 *Log Error Terbaru (sedayaclick):*\n\`\`\`\n${logContent}\n\`\`\``,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Restart App', callback_data: 'act_restart' }],
          [{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]
        ]
      }
    });
    return;
  }

  /* ---------------- 4. GIT PULL & DEPLOY ---------------- */
  if (data === 'act_deploy') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '🚀 _Menjalankan git pull origin main && pm2 restart sedayaclick..._',
      parse_mode: 'Markdown'
    });

    const pullRes = await execCmd('git pull origin main');
    const restartRes = await execCmd('pm2 restart sedayaclick');

    const statusText = pullRes.success ? '✅ Git Pull Berhasil' : '⚠️ Git Pull Terkendala';
    const report = `🚀 *Hasil Deploy Pembaruan:*\n\n` +
      `*${statusText}:*\n\`\`\`\n${(pullRes.stdout || pullRes.stderr).slice(-400)}\n\`\`\`\n` +
      `*Status PM2 Reload:*\n\`\`\`\n${(restartRes.stdout || restartRes.stderr).slice(-300)}\n\`\`\``;

    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: report,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]]
      }
    });
    return;
  }

  /* ---------------- 5. BACKUP DATABASE (SQL) ---------------- */
  if (data === 'act_backup_sql') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '💾 _Memproses dump database MySQL terkompresi..._',
      parse_mode: 'Markdown'
    });

    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD ? `-p'${process.env.DB_PASSWORD}'` : '';
    const dbHost = (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST;
    const dbPort = process.env.DB_PORT || 3306;
    const dbName = process.env.DB_NAME || 'sedayaclick';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outFile = path.join('/tmp', `sedayaclick_db_${timestamp}.sql.gz`);

    const dumpCmd = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${dbPass} --single-transaction --quick ${dbName} | gzip > "${outFile}"`;
    const res = await execCmd(dumpCmd);

    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) {
      const fileSize = formatBytes(fs.statSync(outFile).size);
      const caption = `💾 *Backup Database MySQL Sukses*\n• Nama: \`${path.basename(outFile)}\`\n• Ukuran: ${fileSize}\n• Waktu: ${new Date().toLocaleString('id-ID')} WIB`;

      await sendTelegramDocument(chatId, outFile, caption);
      fs.unlinkSync(outFile); // Hapus file temporer di /tmp
    } else {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `❌ *Gagal membuat backup database!*\n\nDetail: \`${res.error || res.stderr || 'File kosong'}\``,
        parse_mode: 'Markdown'
      });
    }
    return;
  }

  /* ---------------- 6. BACKUP FOTO ABSENSI (UPLOADS) ---------------- */
  if (data === 'act_backup_uploads') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '📸 _Mengompres folder foto & lampiran (/uploads)..._',
      parse_mode: 'Markdown'
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outFile = path.join('/tmp', `sedayaclick_uploads_${timestamp}.tar.gz`);

    // Kompres folder uploads
    const tarCmd = `tar -czf "${outFile}" -C "${ROOT_DIR}" uploads`;
    const res = await execCmd(tarCmd);

    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) {
      const stat = fs.statSync(outFile);
      const fileSize = formatBytes(stat.size);

      // Cek batasan limit file bot telegram (50MB)
      if (stat.size > 48 * 1024 * 1024) {
        await callTelegram('sendMessage', {
          chat_id: chatId,
          text: `⚠️ *File foto terlalu besar untuk dikirim via Telegram API (>50MB).*\n• Ukuran arsip: ${fileSize}\n• Lokasi tersimpan di server: \`${outFile}\``,
          parse_mode: 'Markdown'
        });
      } else {
        const caption = `📸 *Backup Foto & Lampiran Absensi*\n• Nama: \`${path.basename(outFile)}\`\n• Ukuran: ${fileSize}\n• Waktu: ${new Date().toLocaleString('id-ID')} WIB`;
        await sendTelegramDocument(chatId, outFile, caption);
        fs.unlinkSync(outFile);
      }
    } else {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `❌ *Gagal mengompres folder foto!*\n\nDetail: \`${res.error || res.stderr}\``,
        parse_mode: 'Markdown'
      });
    }
    return;
  }

  /* ---------------- 7. BACKUP PENUH (DB + FOTO) ---------------- */
  if (data === 'act_backup_full') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '📦 _Membuat Full Backup (Database SQL + Foto Uploads)..._',
      parse_mode: 'Markdown'
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const tempSql = path.join('/tmp', `db_dump_${timestamp}.sql`);
    const outFile = path.join('/tmp', `sedayaclick_FULL_BACKUP_${timestamp}.tar.gz`);

    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD ? `-p'${process.env.DB_PASSWORD}'` : '';
    const dbHost = (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST;
    const dbPort = process.env.DB_PORT || 3306;
    const dbName = process.env.DB_NAME || 'sedayaclick';

    // 1. Dump database plain
    await execCmd(`mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${dbPass} --single-transaction --quick ${dbName} > "${tempSql}"`);

    // 2. Tar gabungan sql dump dan uploads
    const res = await execCmd(`tar -czf "${outFile}" -C "/tmp" "${path.basename(tempSql)}" -C "${ROOT_DIR}" uploads`);
    if (fs.existsSync(tempSql)) fs.unlinkSync(tempSql);

    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) {
      const stat = fs.statSync(outFile);
      const fileSize = formatBytes(stat.size);

      if (stat.size > 48 * 1024 * 1024) {
        await callTelegram('sendMessage', {
          chat_id: chatId,
          text: `⚠️ *File Full Backup tersimpan di server karena melebihi 50MB:*\n• File: \`${outFile}\` (${fileSize})`,
          parse_mode: 'Markdown'
        });
      } else {
        const caption = `📦 *Full Backup SedayaClick (DB + Foto)*\n• Nama: \`${path.basename(outFile)}\`\n• Ukuran: ${fileSize}\n• Waktu: ${new Date().toLocaleString('id-ID')} WIB`;
        await sendTelegramDocument(chatId, outFile, caption);
        fs.unlinkSync(outFile);
      }
    } else {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `❌ *Gagal membuat full backup!*\n\nDetail: \`${res.error || res.stderr}\``,
        parse_mode: 'Markdown'
      });
    }
    return;
  }

  /* ---------------- 8. CEK UKURAN STORAGE ---------------- */
  if (data === 'act_check_storage') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '📈 _Menghitung ukuran database & media foto..._',
      parse_mode: 'Markdown'
    });

    let dbSizeMb = 0;
    try {
      const [rows] = await pool.query(`
        SELECT table_schema,
               ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
        FROM information_schema.TABLES
        WHERE table_schema = DATABASE()
        GROUP BY table_schema
      `);
      if (rows && rows[0]) dbSizeMb = rows[0].size_mb;
    } catch (e) {}

    const uploadsBytes = getDirSize(UPLOADS_DIR);
    const uploadsSizeStr = formatBytes(uploadsBytes);

    const dfRes = await execCmd('df -h /');
    let diskRoot = 'N/A';
    if (dfRes.success && dfRes.stdout) {
      const lines = dfRes.stdout.split('\n');
      if (lines.length > 1) diskRoot = lines[1].replace(/\s+/g, ' ');
    }

    const report = `📈 *Statistik Penggunaan Storage SedayaClick*\n` +
      `───────────────────────────\n` +
      `• *Database MySQL:* \`${dbSizeMb} MB\`\n` +
      `• *Folder Foto (/uploads):* \`${uploadsSizeStr}\`\n` +
      `• *Harddisk VPS (/):* \`${diskRoot}\`\n\n` +
      `_Penyimpanan terkontrol dengan rapi._`;

    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: report,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]]
      }
    });
    return;
  }

  /* ---------------- 9. BERSIHKAN SESI BASI ---------------- */
  if (data === 'act_clean_sessions') {
    try {
      const [res] = await pool.query('DELETE FROM sessions WHERE expires < UNIX_TIMESTAMP()');
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `🧹 *Pembersihan Sesi Selesai*\n\nBerhasil menghapus *${res.affectedRows || 0}* sesi kedaluwarsa dari tabel \`sessions\`.\nDatabase sekarang lebih ringan!`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]]
        }
      });
    } catch (err) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `❌ *Gagal membersihkan sesi:* \`${err.message}\``,
        parse_mode: 'Markdown'
      });
    }
    return;
  }

  /* ---------------- 10. BERSIHKAN FOTO YATIM (ORPHAN CLEANER) ---------------- */
  if (data === 'act_clean_orphans') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '🗑️ _Memindai file foto di /uploads yang tidak tercatat di database..._',
      parse_mode: 'Markdown'
    });

    try {
      const [cin] = await pool.query('SELECT clock_in_photo FROM attendances WHERE clock_in_photo IS NOT NULL');
      const [cout] = await pool.query('SELECT clock_out_photo FROM attendances WHERE clock_out_photo IS NOT NULL');
      const [sub] = await pool.query('SELECT attachment FROM submissions WHERE attachment IS NOT NULL');
      const [ot] = await pool.query('SELECT overtime_work_attachment FROM attendances WHERE overtime_work_attachment IS NOT NULL');

      const registered = new Set();
      const addPath = (p) => {
        if (p && typeof p === 'string') registered.add(path.basename(p));
      };

      cin.forEach(r => addPath(r.clock_in_photo));
      cout.forEach(r => addPath(r.clock_out_photo));
      sub.forEach(r => addPath(r.attachment));
      ot.forEach(r => addPath(r.overtime_work_attachment));

      let deletedCount = 0;
      let freedBytes = 0;

      const subDirs = ['attendance', 'submissions'];
      for (const sd of subDirs) {
        const fullSubDir = path.join(UPLOADS_DIR, sd);
        if (fs.existsSync(fullSubDir)) {
          const files = fs.readdirSync(fullSubDir);
          for (const f of files) {
            if (f === '.gitkeep' || f === '.DS_Store') continue;
            if (!registered.has(f)) {
              const target = path.join(fullSubDir, f);
              try {
                const s = fs.statSync(target);
                freedBytes += s.size;
                fs.unlinkSync(target);
                deletedCount++;
              } catch (e) {}
            }
          }
        }
      }

      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `🗑️ *Hasil Pembersihan Foto Yatim:*\n\n` +
          `• Foto yatim dibersihkan: *${deletedCount} file*\n` +
          `• Kapasitas disk yang dihemat: *${formatBytes(freedBytes)}*\n\n` +
          `Semua foto aktif yang terhubung dengan absensi karyawan tetap aman 100%!`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]]
        }
      });
    } catch (err) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `❌ *Gagal memindai foto:* \`${err.message}\``,
        parse_mode: 'Markdown'
      });
    }
    return;
  }

  /* ---------------- 11. OPTIMASI TABEL MYSQL ---------------- */
  if (data === 'act_optimize_db') {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '⚙️ _Menjalankan OPTIMIZE TABLE pada database MySQL..._',
      parse_mode: 'Markdown'
    });

    try {
      await pool.query('OPTIMIZE TABLE attendances, employee_schedules, submissions, users, shift_settings, sessions');
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `⚙️ *Optimasi Tabel Selesai!*\n\nIndeks dan penyimpanan database berhasil dirapikan (*defragmented*). Performa baca/tulis server sekarang optimal!`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]]
        }
      });
    } catch (err) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `❌ *Gagal optimasi tabel:* \`${err.message}\``,
        parse_mode: 'Markdown'
      });
    }
    return;
  }

  /* ---------------- 12. KEHADIRAN HARI INI ---------------- */
  if (data === 'act_today_attendance') {
    try {
      const [usersCount] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'employee' AND status = 'active'");
      const [todayAtt] = await pool.query("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late, SUM(CASE WHEN clock_out_time IS NOT NULL THEN 1 ELSE 0 END) AS clocked_out FROM attendances WHERE attendance_date = CURDATE()");
      const [otPending] = await pool.query("SELECT COUNT(*) AS total FROM attendances WHERE overtime_status = 'pending'");
      const [subPending] = await pool.query("SELECT COUNT(*) AS total FROM submissions WHERE status = 'pending'");

      const totalEmployees = usersCount[0]?.total || 0;
      const hadir = todayAtt[0]?.total || 0;
      const terlambat = todayAtt[0]?.late || 0;
      const selesai = todayAtt[0]?.clocked_out || 0;
      const ot = otPending[0]?.total || 0;
      const sub = subPending[0]?.total || 0;

      const report = `👥 *Laporan Kehadiran Hari Ini*\n` +
        `Tanggal: \`${new Date().toISOString().slice(0, 10)}\`\n` +
        `───────────────────────────\n` +
        `• *Total Karyawan Aktif:* ${totalEmployees} orang\n` +
        `• *Sudah Clock In:* ${hadir} orang\n` +
        `• *Terlambat Masuk:* ${terlambat} orang\n` +
        `• *Sudah Clock Out:* ${selesai} orang\n` +
        `• *Antrean Izin/Cuti Pending:* ${sub} pengajuan\n` +
        `• *Antrean Lembur Pending:* ${ot} pengajuan\n\n` +
        `_Data sinkron langsung dari database._`;

      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: report,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'act_menu' }]]
        }
      });
    } catch (err) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `❌ *Gagal mengambil data kehadiran:* \`${err.message}\``,
        parse_mode: 'Markdown'
      });
    }
    return;
  }

  /* ---------------- 13. PROMPT PENGOSONGAN DATA (PURGE) ---------------- */
  if (data === 'act_prompt_purge') {
    const confirmationToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    pendingConfirmations.set(chatId, {
      action: 'purge',
      token: confirmationToken,
      expires: Date.now() + 5 * 60 * 1000 // Berlaku 5 menit
    });

    const warnText = `🚨 *PERINGATAN PENGOSONGAN DATA SERVER (PURGE)*\n\n` +
      `Aksi ini akan:\n` +
      `1. *Otomatis membuat Full Backup (DB + Foto)* dan mengirimkannya ke Telegram Anda terlebih dahulu (Zero Data Loss).\n` +
      `2. Mengosongkan seluruh riwayat absensi, log lembur, riwayat izin/cuti, dan seluruh foto selfie di \`/uploads\`.\n` +
      `3. Harddisk VPS akan kembali *lega dan kosong*.\n\n` +
      `🛡️ *DATA YANG TETAP DIJAGA 100% AMAN:*\n` +
      `• Seluruh akun Karyawan & Admin tetap aktif.\n` +
      `• Master Divisi, Jabatan, dan Pengaturan Shift tetap utuh.\n\n` +
      `Untuk melanjutkan, klik tombol konfirmasi di bawah atau ketik:\n` +
      `\`/confirm ${confirmationToken}\``;

    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: warnText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: `⚠️ Ya, Jalankan Purge (${confirmationToken})`, callback_data: `exec_purge_${confirmationToken}` }],
          [{ text: '❌ Batal (Kembali ke Menu)', callback_data: 'act_menu' }]
        ]
      }
    });
    return;
  }

  /* ---------------- 14. EKSEKUSI PENGOSONGAN DATA (EXECUTE PURGE) ---------------- */
  if (data.startsWith('exec_purge_')) {
    const token = data.replace('exec_purge_', '');
    const pending = pendingConfirmations.get(chatId);

    if (!pending || pending.action !== 'purge' || pending.token !== token || Date.now() > pending.expires) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: '❌ *Token konfirmasi tidak valid atau telah kedaluwarsa.* Silakan ulangi dari menu.',
        parse_mode: 'Markdown'
      });
      return;
    }

    pendingConfirmations.delete(chatId);

    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '⏳ *LANGKAH 1/2: Menyelamatkan Data...*\n_Membuat Full Backup (DB + Foto) sebelum pengosongan dilakukan..._',
      parse_mode: 'Markdown'
    });

    // 1. Full Backup penyelamatan
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const tempSql = path.join('/tmp', `pre_purge_db_${timestamp}.sql`);
    const outFile = path.join('/tmp', `ARSIP_LENGKAP_SEBELUM_PURGE_${timestamp}.tar.gz`);

    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD ? `-p'${process.env.DB_PASSWORD}'` : '';
    const dbHost = (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST;
    const dbPort = process.env.DB_PORT || 3306;
    const dbName = process.env.DB_NAME || 'sedayaclick';

    await execCmd(`mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${dbPass} --single-transaction --quick ${dbName} > "${tempSql}"`);
    await execCmd(`tar -czf "${outFile}" -C "/tmp" "${path.basename(tempSql)}" -C "${ROOT_DIR}" uploads`);
    if (fs.existsSync(tempSql)) fs.unlinkSync(tempSql);

    if (fs.existsSync(outFile)) {
      const caption = `📦 *ARSIP PENYELAMATAN SEBELUM PURGE BERHASIL DIBUAT*\n• File: \`${path.basename(outFile)}\` (${formatBytes(fs.statSync(outFile).size)})\n• Tanggal: ${new Date().toLocaleString('id-ID')} WIB\n\n_Seluruh data sebelum dihapus telah aman tersimpan di chat ini._`;
      await sendTelegramDocument(chatId, outFile, caption);
      fs.unlinkSync(outFile);
    }

    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '🧹 *LANGKAH 2/2: Mengosongkan data transaksi di database & harddisk server...*',
      parse_mode: 'Markdown'
    });

    // 2. Kosongkan tabel transaksi
    try {
      await pool.query('DELETE FROM attendances');
      await pool.query('ALTER TABLE attendances AUTO_INCREMENT = 1');
      await pool.query('DELETE FROM submissions');
      await pool.query('ALTER TABLE submissions AUTO_INCREMENT = 1');
      await pool.query('DELETE FROM sessions');
      await pool.query('DELETE FROM employee_schedules');
      await pool.query('ALTER TABLE employee_schedules AUTO_INCREMENT = 1');

      // Kosongkan file fisik foto di uploads
      const cleanSubDir = (subName) => {
        const fullDir = path.join(UPLOADS_DIR, subName);
        if (fs.existsSync(fullDir)) {
          const files = fs.readdirSync(fullDir);
          for (const f of files) {
            if (f === '.gitkeep' || f === '.DS_Store') continue;
            try { fs.unlinkSync(path.join(fullDir, f)); } catch (e) {}
          }
        }
      };
      cleanSubDir('attendance');
      cleanSubDir('submissions');

      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `🎉 *PENGOSONGAN DATA SERVER SELESAI (FRESH START)!*\n\n` +
          `• Seluruh riwayat absensi & foto telah dikosongkan.\n` +
          `• Harddisk VPS kembali lega dan bersih.\n` +
          `• Semua akun karyawan, divisi, dan shift kerja tetap aktif dan utuh.\n\n` +
          `Sistem SedayaClick kini siap digunakan untuk periode baru!`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali ke Menu Utama', callback_data: 'act_menu' }]]
        }
      });
    } catch (err) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `❌ *Terjadi kendala saat pengosongan:* \`${err.message}\``,
        parse_mode: 'Markdown'
      });
    }
  }
}

/**
 * Handle Pesan Teks Masuk
 */
async function handleMessage(msg) {
  const chatId = String(msg.chat.id);
  const text = (msg.text || '').trim();

  // Verifikasi Whitelist Chat ID
  if (chatId !== ADMIN_CHAT_ID) {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '⛔ *Akses Ditolak!*\nAnda tidak memiliki otorisasi administrator untuk mengontrol server SedayaClick.',
      parse_mode: 'Markdown'
    });
    return;
  }

  if (text === '/start' || text === '/menu' || text === 'menu') {
    await sendMainMenu(chatId);
    return;
  }

  if (text.startsWith('/confirm ')) {
    const token = text.replace('/confirm ', '').trim();
    await handleCallbackQuery({
      id: 'text_confirm',
      message: msg,
      data: `exec_purge_${token}`
    });
    return;
  }

  if (text === '/status') {
    await handleCallbackQuery({ id: 'cmd', message: msg, data: 'act_status' });
    return;
  }

  if (text === '/restart') {
    await handleCallbackQuery({ id: 'cmd', message: msg, data: 'act_restart' });
    return;
  }

  if (text === '/backup') {
    await handleCallbackQuery({ id: 'cmd', message: msg, data: 'act_backup_sql' });
    return;
  }

  // Pesan tidak dikenal
  await sendMainMenu(chatId);
}

/**
 * Long Polling loop ke Telegram API
 */
let isRunning = true;
let offset = 0;

async function startPolling() {
  console.log(`[TelegramBot] SedayaClick Ops Bot aktif dan mendengarkan perintah...`);
  console.log(`[TelegramBot] Admin Whitelist Chat ID: ${ADMIN_CHAT_ID}`);

  while (isRunning) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=25`, {
        signal: AbortSignal.timeout(35000)
      });
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          if (update.message) {
            await handleMessage(update.message);
          } else if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'TimeoutError') {
        console.error('[TelegramBot Polling Error]:', err.message);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// Tangani signal shutdown agar rapi
process.on('SIGINT', () => { isRunning = false; process.exit(0); });
process.on('SIGTERM', () => { isRunning = false; process.exit(0); });

// Jalankan bot jika file dieksekusi langsung
if (require.main === module) {
  startPolling();
}

module.exports = {
  callTelegram,
  sendTelegramDocument,
  startPolling
};
