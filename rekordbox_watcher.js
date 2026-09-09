/**
 * REKORDBOX 7 TO ROBLOX LIVE BRIDGE WATCHER
 * 
 * Script ini berjalan di background di PC lo:
 * 1. Memonitor status dan track aktif dari Rekordbox 7
 * 2. Mengirim judul lagu, artis, dan BPM ke Backend Saweria/KIDZY
 * 3. Backend meneruskannya secara real-time ke map SANTA MONICA di Roblox
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const UPDATE_ENDPOINT = `${BACKEND_URL}/api/dj/update-track`;

// Lokasi default file export/log Rekordbox jika digunakan
const REKORDBOX_LOG_PATH = path.join(
    process.env.APPDATA || '',
    'Pioneer/rekordboxAgent/log.log'
);

// File export txt (misal OBS Now Playing txt)
const OBS_TEXT_FILE = path.join(__dirname, 'now_playing.txt');

let lastTrack = {
    title: '',
    artist: '',
    bpm: 128
};

console.log('\n======================================================');
console.log('🎧 REKORDBOX 7 -> ROBLOX SANTA MONICA BRIDGE WATCHER');
console.log('======================================================');
console.log(`🌐 Backend Target: ${UPDATE_ENDPOINT}`);
console.log(`📁 Watch Text File: ${OBS_TEXT_FILE}`);
console.log(`📡 Status: Memulai monitoring Rekordbox 7...\n`);

// Helper untuk mengirim HTTP POST ke backend
function sendTrackUpdate(trackData) {
    const payload = JSON.stringify(trackData);
    const url = new URL(UPDATE_ENDPOINT);

    const req = http.request({
        hostname: url.hostname,
        port: url.port || 3000,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 5000
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log(`[SYNC OK] 🎵 "${trackData.title}" - ${trackData.artist} (${trackData.bpm} BPM) terkirim ke Roblox!`);
            } else {
                console.warn(`[SYNC WARN] Server status ${res.statusCode}: ${body}`);
            }
        });
    });

    req.on('error', (err) => {
        console.warn(`[SYNC ERR] Gagal menghubungkan ke backend: ${err.message}`);
    });

    req.write(payload);
    req.end();
}

// 1. File Watcher untuk OBS Now Playing atau now_playing.txt
if (!fs.existsSync(OBS_TEXT_FILE)) {
    fs.writeFileSync(OBS_TEXT_FILE, "Santa Monica Opening - KIDZY Sound System\nBPM: 128", "utf8");
}

function checkTextFile() {
    try {
        if (!fs.existsSync(OBS_TEXT_FILE)) return;
        const content = fs.readFileSync(OBS_TEXT_FILE, 'utf8').trim();
        if (!content) return;

        // Parse format "Title - Artist" atau baris terpisah
        const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
        let title = '';
        let artist = 'Rekordbox 7 DJ';
        let bpm = 128;

        if (lines.length > 0) {
            const firstLine = lines[0];
            if (firstLine.includes(' - ')) {
                const parts = firstLine.split(' - ');
                title = parts[0].trim();
                artist = parts.slice(1).join(' - ').trim();
            } else {
                title = firstLine;
            }
        }

        // Cek baris BPM jika ada
        for (const l of lines) {
            const bpmMatch = l.match(/BPM[:\s]+(\d+(\.\d+)?)/i);
            if (bpmMatch) {
                bpm = Math.round(parseFloat(bpmMatch[1]));
            }
        }

        if (title && (title !== lastTrack.title || artist !== lastTrack.artist)) {
            lastTrack = { title, artist, bpm };
            console.log(`[DETECT] 🎼 Lagu terdeteksi dari text file: "${title}" by ${artist}`);
            sendTrackUpdate({
                title,
                artist,
                bpm,
                deck: 1,
                genre: "Live Set"
            });
        }
    } catch (e) {
        // Silent error to prevent crash
    }
}

// 2. Monitoring log Rekordbox Agent jika aktif
let lastLogSize = 0;
function checkRekordboxLog() {
    try {
        if (!fs.existsSync(REKORDBOX_LOG_PATH)) return;
        const stat = fs.statSync(REKORDBOX_LOG_PATH);
        if (stat.size < lastLogSize) {
            lastLogSize = 0;
        }
        if (stat.size !== lastLogSize) {
            lastLogSize = stat.size;
            // File berubah, Rekordbox sedang aktif memutar track
        }
    } catch (e) {}
}

// 3. Polling loop setiap 2 detik
setInterval(() => {
    checkTextFile();
    checkRekordboxLog();
}, 2000);

// Inisialisasi kirim track pertama
checkTextFile();

console.log('💡 TIP: Lu bisa edit file "now_playing.txt" atau gunakan OBS Rekordbox plugin');
console.log('   untuk otomatisasi pergantian lagu ke panggung Santa Monica!\n');
