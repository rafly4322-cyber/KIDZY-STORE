const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// File path for persisting DJ state
const DATA_DIR = path.join(__dirname, '../data');
const STATE_FILE = path.join(DATA_DIR, 'dj_state.json');

// Default initial DJ state
let djState = {
    title: "Santa Monica Vibes",
    artist: "KIDZY Sound System",
    album: "Summer Live Set",
    bpm: 128,
    deck: 1,
    genre: "House / EDM",
    duration: 210,
    elapsed: 0,
    isPlaying: true,
    djName: "raflykidzz",
    updatedAt: Date.now(),
    history: []
};

// Load saved state if exists
try {
    if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        djState = { ...djState, ...parsed };
    }
} catch (e) {
    console.warn('[DJ Service] Could not load persisted DJ state:', e.message);
}

function saveState() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(STATE_FILE, JSON.stringify(djState, null, 2), 'utf8');
    } catch (e) {
        console.error('[DJ Service] Failed to save DJ state:', e.message);
    }
}

/**
 * GET /api/dj/now-playing
 * Polled by Roblox HttpService & Admin Dashboard
 */
router.get('/now-playing', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
        success: true,
        data: {
            title: djState.title,
            artist: djState.artist,
            album: djState.album,
            bpm: djState.bpm,
            deck: djState.deck,
            genre: djState.genre,
            duration: djState.duration,
            elapsed: djState.elapsed,
            isPlaying: djState.isPlaying,
            djName: djState.djName,
            updatedAt: djState.updatedAt
        }
    });
});

/**
 * POST /api/dj/update-track
 * Receives track changes from Rekordbox Watcher or Admin Panel
 */
router.post('/update-track', (req, res) => {
    const { title, artist, album, bpm, deck, genre, duration, isPlaying, djName } = req.body || {};

    if (!title && !artist) {
        return res.status(400).json({ success: false, message: 'Minimal judul lagu atau artis harus diisi.' });
    }

    const previousTrack = `${djState.title} - ${djState.artist}`;
    const newTrack = `${title || djState.title} - ${artist || djState.artist}`;

    // Add to history if track actually changed
    if (previousTrack !== newTrack) {
        if (!Array.isArray(djState.history)) djState.history = [];
        djState.history.unshift({
            title: djState.title,
            artist: djState.artist,
            bpm: djState.bpm,
            playedAt: djState.updatedAt
        });
        // Keep max 20 history
        if (djState.history.length > 20) {
            djState.history = djState.history.slice(0, 20);
        }
    }

    djState.title = title !== undefined ? String(title).trim() : djState.title;
    djState.artist = artist !== undefined ? String(artist).trim() : djState.artist;
    djState.album = album !== undefined ? String(album).trim() : djState.album;
    djState.bpm = bpm ? Number(bpm) : djState.bpm;
    djState.deck = deck ? Number(deck) : djState.deck;
    djState.genre = genre !== undefined ? String(genre).trim() : djState.genre;
    djState.duration = duration ? Number(duration) : djState.duration;
    djState.isPlaying = isPlaying !== undefined ? Boolean(isPlaying) : true;
    if (djName) djState.djName = String(djName).trim();
    djState.updatedAt = Date.now();

    saveState();

    console.log(`[DJ Rekordbox] 🎵 Track Updated: "${djState.title}" by ${djState.artist} (${djState.bpm} BPM) [Deck ${djState.deck}]`);

    res.json({
        success: true,
        message: 'Track berhasil diperbarui.',
        data: djState
    });
});

/**
 * GET /api/dj/status
 * Detailed status for Admin Dashboard
 */
router.get('/status', (req, res) => {
    res.json({
        success: true,
        state: djState
    });
});

/**
 * POST /api/dj/set-dj
 * Updates active DJ player username
 */
router.post('/set-dj', (req, res) => {
    const { djName } = req.body || {};
    if (!djName) {
        return res.status(400).json({ success: false, message: 'Username DJ diperlukan.' });
    }
    djState.djName = String(djName).trim();
    djState.updatedAt = Date.now();
    saveState();

    console.log(`[DJ System] 🎧 Active DJ set to: ${djState.djName}`);
    res.json({ success: true, djName: djState.djName });
});

module.exports = router;
