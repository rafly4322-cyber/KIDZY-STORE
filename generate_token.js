/**
 * 🎁 KIDZY STORE - INSTANT FREE GIVEAWAY TOKEN GENERATOR CLI TOOL
 * 
 * Penggunaan dari Terminal:
 *   node generate_token.js "Giveaway @Username"
 *   node generate_token.js
 */

const { db } = require('./data/db');

const args = process.argv.slice(2);
const note = args[0] || 'Free Giveaway Token';

const token = db.createToken({
    platform: 'saweria',
    plan: 'lifetime',
    note: `[FREE GIVEAWAY] ${note}`
});

console.log('\n=============================================================');
console.log('🎁 TOKEN FREE GIVEAWAY BERHASIL DIBUAT (LIFETIME PERMANEN)!');
console.log('=============================================================\n');

const discordFormat = `🎁 **TOKEN SAWERIA LIFETIME VIP (KIDZY STORE)**:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 **Kode Token**: \`${token.code}\`
👑 **Paket**: Lifetime (Permanen Seumur Hidup)
🌐 **Aktivasi di**: https://kidzy-store.vercel.app/activation.html
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Masukkan kode token & Universe ID game Roblox kamu di link aktivasi di atas untuk langsung aktif!*`;

console.log('📋 FORMAT SIAP KIRIM KE DISCORD (TINGGAL COPY & PASTE):');
console.log('-------------------------------------------------------------');
console.log(discordFormat);
console.log('-------------------------------------------------------------\n');
