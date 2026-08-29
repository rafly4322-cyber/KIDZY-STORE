const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const { db, hashPassword, verifyPassword } = require('../data/db');
const { 
    saveDonationToUniverse, 
    testRobloxConnection, 
    getDataStoreValue, 
    setDataStoreValue 
} = require('../services/roblox');

const app = express();

// ============================================
// ENTERPRISE SECURITY & RATE LIMITING SHIELDS
// ============================================
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

// In-Memory Rate Limiter & IP Tracking Map
const rateLimitMap = new Map();
const loginFailMap = new Map();

// Periodic cleanup every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitMap.entries()) {
        if (now - data.startTime > 60000) rateLimitMap.delete(ip);
    }
    for (const [ip, data] of loginFailMap.entries()) {
        if (now - data.startTime > 300000) loginFailMap.delete(ip);
    }
}, 300000);

// Global Rate Limiting & DDoS Shield Middleware
app.use((req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // 1. Prototype Pollution Defense
    if (req.body && typeof req.body === 'object') {
        const bodyStr = JSON.stringify(req.body);
        if (bodyStr.includes('__proto__') || bodyStr.includes('constructor') || bodyStr.includes('prototype')) {
            return res.status(400).json({ success: false, message: 'Invalid payload attributes (Security Blocked).' });
        }
    }

    // 2. Global Rate Limiter (Max 200 reqs/min per IP)
    let rateData = rateLimitMap.get(clientIp);
    if (!rateData || now - rateData.startTime > 60000) {
        rateData = { count: 1, startTime: now };
        rateLimitMap.set(clientIp, rateData);
    } else {
        rateData.count++;
        if (rateData.count > 200) {
            return res.status(429).json({ success: false, message: 'Too many requests. Please slow down.' });
        }
    }

    // 3. Security Headers (OWASP Recommended)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Prevent caching for dynamic API responses
    if (req.url.startsWith('/api') || req.url.startsWith('/poll') || req.url.startsWith('/webhook')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Normalize URL on Vercel so both /api/xxx and /xxx match Express routes
app.use((req, res, next) => {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/assets') && !req.url.startsWith('/downloads')) {
        req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    next();
});

// HTML Entity Sanitizer Helper (XSS Protection)
function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Serve static assets from public folder
const PUBLIC_DIR = path.join(__dirname, '../public');
if (fs.existsSync(PUBLIC_DIR)) {
    app.use(express.static(PUBLIC_DIR, {
        maxAge: '1d',
        etag: true
    }));
}

// Memory queue for in-game polling
let donationQueue = [];

// Auth Middleware Helper
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (req.query.auth_token) {
        token = req.query.auth_token;
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Silakan login.' });
    }

    const session = db.getSession(token);
    if (!session) {
        return res.status(401).json({ success: false, message: 'Sesi telah berakhir atau tidak valid. Silakan login ulang.' });
    }

    req.user = session;
    next();
}

function requireAdmin(req, res, next) {
    authenticate(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Akses khusus administrator / owner.' });
        }
        next();
    });
}

// ============================================
// PUBLIC & STORE ENDPOINTS
// ============================================

// Store general information
app.get('/api/store-info', (req, res) => {
    const settings = db.getSettings();
    res.json({
        success: true,
        storeName: settings.storeName,
        logoText: settings.logoText,
        discordUrl: settings.discordUrl,
        bankName: settings.bankName,
        bankAccount: settings.bankAccount,
        bankHolder: settings.bankHolder,
        qrisImage: settings.qrisImage,
        prices: settings.prices
    });
});

// Service Activation (Token Redeem - Supports both endpoints & field naming)
const handleServiceRegistration = (req, res) => {
    const token = req.body.token || req.body.code;
    const universe_id = req.body.universe_id || req.body.universeId;
    const roblox_api_key = req.body.roblox_api_key || req.body.robloxApiKey || 'default-global-key';
    const client_name = req.body.client_name || req.body.name || req.body.clientName || 'Pengguna';
    const platform = req.body.platform;

    if (!token || !universe_id) {
        return res.status(400).json({
            success: false,
            message: 'Token aktivasi dan Universe ID wajib diisi.'
        });
    }

    const tokenObj = db.getTokenByCode(token);
    if (!tokenObj) {
        return res.status(400).json({
            success: false,
            message: 'Token aktivasi tidak ditemukan atau tidak valid.'
        });
    }

    if (tokenObj.status === 'active' || tokenObj.status === 'expired') {
        return res.status(400).json({
            success: false,
            message: `Token ini sudah pernah digunakan pada ${tokenObj.usedAt || 'waktu sebelumnya'}.`
        });
    }

    const service = db.createService({
        tokenCode: tokenObj.code,
        universeId: universe_id,
        robloxApiKey: roblox_api_key,
        clientName: client_name,
        platform: tokenObj.platform || platform || 'saweria',
        plan: tokenObj.plan || 'lifetime'
    });

    const origin = req.headers.host ? `${req.protocol || 'https'}://${req.headers.host}` : 'https://kidzy-store.vercel.app';
    service.webhookUrl = `${origin}/api/webhook/${service.webhookSlug || service.tokenCode}`;
    service.pollUrl = `${origin}/api/poll/${service.webhookSlug || service.tokenCode}`;

    res.json({
        success: true,
        message: 'Layanan berhasil diaktifkan!',
        service: service
    });
};

app.post('/api/register-service', handleServiceRegistration);
app.post('/api/services/register', handleServiceRegistration);

// ============================================
// AUTH ENDPOINTS
// ============================================

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }

    const user = db.getUserByEmail(email);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const isValid = verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!isValid) {
        return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const sessionToken = db.createSession(user);

    res.json({
        success: true,
        message: 'Login berhasil.',
        token: sessionToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        }
    });
});

app.post('/api/auth/register', (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }

    const existing = db.getUserByEmail(email);
    if (existing) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar. Silakan login.' });
    }

    const pass = hashPassword(password);
    const newUser = db.createUser({
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        passwordHash: pass.hash,
        passwordSalt: pass.salt,
        role: 'client'
    });

    const sessionToken = db.createSession(newUser);

    res.json({
        success: true,
        message: 'Pendaftaran berhasil.',
        token: sessionToken,
        user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role
        }
    });
});

app.get('/api/auth/me', authenticate, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        db.deleteSession(authHeader.substring(7));
    }
    res.json({ success: true, message: 'Logout berhasil.' });
});

app.post('/api/auth/change-password', authenticate, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Password saat ini dan password baru wajib diisi.' });
    }

    const user = db.getUserByEmail(req.user.email);
    if (!user || !verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)) {
        return res.status(400).json({ success: false, message: 'Password saat ini tidak cocok.' });
    }

    db.updateUserPassword(req.user.email, newPassword);
    res.json({ success: true, message: 'Password berhasil diubah!' });
});

// ============================================
// WEBHOOK RECEIVERS (SAWERIA / BAGIBAGI / SOCIABUZZ)
// ============================================

async function handleIncomingDonation(donationData, platform = 'saweria') {
    const settings = db.getSettings();
    const activeServices = db.getServices().filter(s => s.status === 'active' && s.platform === platform);
    
    // Also include default global settings if configured
    const globalRobloxApiKey = settings.robloxApiKey || process.env.ROBLOX_API_KEY || '';
    const globalUniverseIds = settings.universeIds || (process.env.UNIVERSE_IDS ? process.env.UNIVERSE_IDS.split(',') : []);

    const universesToUpdate = [];

    // Add registered services
    activeServices.forEach(s => {
        if (s.universeId && s.robloxApiKey) {
            universesToUpdate.push({
                serviceId: s.id,
                universeId: s.universeId,
                apiKey: s.robloxApiKey
            });
        }
    });

    // Add global default if not already included
    if (globalRobloxApiKey && Array.isArray(globalUniverseIds)) {
        globalUniverseIds.forEach(uId => {
            const trimmed = String(uId).trim();
            if (trimmed && !universesToUpdate.some(u => u.universeId === trimmed)) {
                universesToUpdate.push({
                    serviceId: 'global',
                    universeId: trimmed,
                    apiKey: globalRobloxApiKey
                });
            }
        });
    }

    console.log(`\n📥 [${platform.toUpperCase()}] Processing donation: ${donationData.nama} - Rp ${donationData.amount.toLocaleString('id-ID')}`);
    console.log(`Target universes count: ${universesToUpdate.length}`);

    const results = [];
    for (const target of universesToUpdate) {
        try {
            const res = await saveDonationToUniverse(target.universeId, target.apiKey, donationData);
            results.push(res);
            if (target.serviceId !== 'global' && res.success) {
                const s = db.getServiceById(target.serviceId);
                if (s) {
                    db.updateService(target.serviceId, {
                        lastDonationAt: new Date().toISOString(),
                        donationCount: (s.donationCount || 0) + 1,
                        totalDonationsAmount: (s.totalDonationsAmount || 0) + donationData.amount
                    });
                }
            }
        } catch (err) {
            results.push({ universeId: target.universeId, success: false, error: err.message });
        }
    }

    // Save to local database
    const savedDonation = db.addDonation({
        ...donationData,
        platform,
        status: results.some(r => r.success) || universesToUpdate.length === 0 ? 'success' : 'failed',
        details: { targetUniverses: universesToUpdate.length, results }
    });

    // Push to polling queue
    donationQueue.push(donationData);

    return {
        donation: savedDonation,
        universesUpdated: results.filter(r => r.success).length,
        totalUniverses: universesToUpdate.length,
        results
    };
}

// Universal Saweria webhook
app.post(['/api/saweria', '/api/webhook/saweria', '/api/webhook'], async (req, res) => {
    try {
        const donationData = {
            nama: req.body.donator_name || req.body.donater_name || req.body.name || req.body.nama || 'Anonymous',
            amount: parseInt(req.body.amount_raw) || parseInt(req.body.amount) || 0,
            message: req.body.message || req.body.pesan || 'Terima kasih atas dukungannya!',
            timestamp: req.body.created_at || new Date().toISOString(),
            id: req.body.id || ('saw_' + Date.now()),
            email: req.body.donator_email || req.body.email || ''
        };

        if (donationData.amount <= 0) {
            return res.status(400).json({ success: false, message: 'Nominal donasi tidak valid.' });
        }

        const result = await handleIncomingDonation(donationData, 'saweria');

        res.status(200).json({
            success: true,
            message: `Donasi berhasil diproses (${result.universesUpdated}/${result.totalUniverses} game terupdate).`,
            data: donationData,
            result
        });
    } catch (err) {
        console.error('❌ Saweria Webhook Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// BagiBagi webhook
app.post(['/api/bagibagi', '/api/webhook/bagibagi'], async (req, res) => {
    try {
        const donationData = {
            nama: req.body.name || req.body.sender || req.body.donator_name || 'Anonymous',
            amount: parseInt(req.body.amount) || 0,
            message: req.body.message || 'Terima kasih atas dukungannya!',
            timestamp: req.body.timestamp || new Date().toISOString(),
            id: req.body.id || ('bagi_' + Date.now()),
            email: req.body.email || ''
        };

        if (donationData.amount <= 0) {
            return res.status(400).json({ success: false, message: 'Nominal donasi tidak valid.' });
        }

        const result = await handleIncomingDonation(donationData, 'bagibagi');
        res.json({ success: true, message: 'Donasi BagiBagi berhasil diproses.', data: donationData, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// SociaBuzz webhook
app.post(['/api/sociabuzz', '/api/webhook/sociabuzz'], async (req, res) => {
    try {
        const donationData = {
            nama: req.body.name || req.body.supporter_name || 'Anonymous',
            amount: parseInt(req.body.amount) || 0,
            message: req.body.message || 'Terima kasih atas dukungannya!',
            timestamp: req.body.created_at || new Date().toISOString(),
            id: req.body.id || ('socia_' + Date.now()),
            email: req.body.email || ''
        };

        if (donationData.amount <= 0) {
            return res.status(400).json({ success: false, message: 'Nominal donasi tidak valid.' });
        }

        const result = await handleIncomingDonation(donationData, 'sociabuzz');
        res.json({ success: true, message: 'Donasi SociaBuzz berhasil diproses.', data: donationData, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Token-specific webhook receiver
app.post('/api/webhook/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const donationData = {
            nama: req.body.donator_name || req.body.donater_name || req.body.name || req.body.nama || 'Anonymous',
            amount: parseInt(req.body.amount_raw) || parseInt(req.body.amount) || 0,
            message: req.body.message || req.body.pesan || 'Terima kasih atas dukungannya!',
            timestamp: req.body.created_at || new Date().toISOString(),
            id: req.body.id || ('wh_' + Date.now()),
            email: req.body.donator_email || req.body.email || ''
        };

        if (donationData.amount <= 0) {
            return res.status(400).json({ success: false, message: 'Nominal donasi tidak valid.' });
        }

        const result = await handleIncomingDonation(donationData, 'saweria');
        res.status(200).json({
            success: true,
            message: `Donasi webhook berhasil diproses (${result.universesUpdated}/${result.totalUniverses} game terupdate).`,
            data: donationData,
            token,
            result
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Polling Endpoints (supports /api/poll/:token, /api/poll, /api/saweria/get-donations)
app.get(['/api/poll', '/api/poll/:token', '/api/saweria/get-donations', '/api/webhook/get-donations'], (req, res) => {
    const donations = [...donationQueue];
    donationQueue = [];
    res.json({ success: true, count: donations.length, donations: donations });
});

// Health check
app.get('/api/health', (req, res) => {
    const settings = db.getSettings();
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'KIDZY Saweria Roblox Webhook Gateway',
        version: '2.5.0',
        activeServices: db.getServices().filter(s => s.status === 'active').length,
        hasGlobalRobloxApiKey: !!(settings.robloxApiKey || process.env.ROBLOX_API_KEY),
        queue: donationQueue.length
    });
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const stats = db.getStats();
    res.json({ success: true, stats });
});

app.get('/api/admin/tokens', requireAdmin, (req, res) => {
    res.json({ success: true, tokens: db.getTokens() });
});

app.post('/api/admin/tokens', requireAdmin, (req, res) => {
    const { platform, plan, note, customCode } = req.body;
    const token = db.createToken({
        platform: platform || 'saweria',
        plan: plan || 'lifetime',
        note: note || '',
        customCode: customCode || ''
    });
    res.json({ success: true, message: 'Token baru berhasil dibuat!', token });
});

app.delete('/api/admin/tokens/:id', requireAdmin, (req, res) => {
    const removed = db.deleteToken(req.params.id);
    if (removed) {
        res.json({ success: true, message: 'Token berhasil dihapus.' });
    } else {
        res.status(404).json({ success: false, message: 'Token tidak ditemukan.' });
    }
});

app.get('/api/admin/services', requireAdmin, (req, res) => {
    res.json({ success: true, services: db.getServices() });
});

app.post('/api/admin/services', requireAdmin, (req, res) => {
    const { universeId, robloxApiKey, clientName, platform, plan } = req.body;
    if (!universeId || !robloxApiKey) {
        return res.status(400).json({ success: false, message: 'Universe ID dan Roblox API Key wajib diisi.' });
    }

    const service = db.createService({
        tokenCode: 'MANUAL-ADMIN-' + Math.floor(Math.random() * 10000),
        universeId,
        robloxApiKey,
        clientName: clientName || 'Manual Client',
        platform: platform || 'saweria',
        plan: plan || 'lifetime'
    });

    res.json({ success: true, message: 'Layanan berhasil ditambahkan.', service });
});

app.put('/api/admin/services/:id', requireAdmin, (req, res) => {
    const updated = db.updateService(req.params.id, req.body);
    if (updated) {
        res.json({ success: true, message: 'Layanan berhasil diupdate.', service: updated });
    } else {
        res.status(404).json({ success: false, message: 'Layanan tidak ditemukan.' });
    }
});

app.delete('/api/admin/services/:id', requireAdmin, (req, res) => {
    const removed = db.deleteService(req.params.id);
    if (removed) {
        res.json({ success: true, message: 'Layanan berhasil dihapus.' });
    } else {
        res.status(404).json({ success: false, message: 'Layanan tidak ditemukan.' });
    }
});

app.get('/api/admin/donations', requireAdmin, (req, res) => {
    res.json({ success: true, donations: db.getDonations(200) });
});

app.delete('/api/admin/donations', requireAdmin, (req, res) => {
    db.clearDonations();
    res.json({ success: true, message: 'Riwayat donasi berhasil dibersihkan.' });
});

// Donation Test Simulator
app.post('/api/admin/simulate-donation', requireAdmin, async (req, res) => {
    try {
        const { nama, amount, message, platform, targetUniverseId, robloxApiKey } = req.body;

        const donationData = {
            nama: nama || 'Penguji Donasi',
            amount: parseInt(amount) || 100000,
            message: message || 'Uji coba donasi simulator berhasil! ✨',
            timestamp: new Date().toISOString(),
            id: 'sim_' + Date.now()
        };

        let customUpdateResult = null;
        if (targetUniverseId && robloxApiKey) {
            customUpdateResult = await saveDonationToUniverse(targetUniverseId, robloxApiKey, donationData);
        }

        const handleResult = await handleIncomingDonation(donationData, platform || 'saweria');

        res.json({
            success: true,
            message: 'Simulasi donasi berhasil dieksekusi!',
            data: donationData,
            handleResult,
            customUpdateResult
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Roblox Open Cloud Inspector & Tester
app.post('/api/admin/roblox/test-connection', requireAdmin, async (req, res) => {
    const { universeId, robloxApiKey } = req.body;
    const result = await testRobloxConnection(universeId, robloxApiKey);
    res.json(result);
});

app.post('/api/admin/roblox/datastore', requireAdmin, async (req, res) => {
    const { universeId, robloxApiKey } = req.body;
    const result = await getDataStoreValue(universeId, robloxApiKey);
    res.json(result);
});

app.post('/api/admin/roblox/clear-datastore', requireAdmin, async (req, res) => {
    const { universeId, robloxApiKey } = req.body;
    const result = await setDataStoreValue(universeId, robloxApiKey, []);
    res.json(result);
});

// Settings Endpoints
app.get('/api/admin/settings', requireAdmin, (req, res) => {
    res.json({ success: true, settings: db.getSettings() });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
    const updated = db.updateSettings(req.body);
    res.json({ success: true, message: 'Pengaturan toko berhasil diperbarui.', settings: updated });
});

// ============================================
// ASSET DOWNLOADS & ADMIN CLEAN ROUTES
// ============================================

app.get(['/admin/download', '/api/download/zip'], (req, res) => {
    const zipPath = path.join(PUBLIC_DIR, 'downloads/Saweria_lifetime.zip');
    if (fs.existsSync(zipPath)) {
        res.download(zipPath, 'Saweria_lifetime.zip');
    } else {
        const modelPath = path.join(PUBLIC_DIR, 'downloads/Saweria_V2_Roblox_Model.rbxm');
        if (fs.existsSync(modelPath)) {
            res.download(modelPath, 'Saweria_lifetime.rbxm');
        } else {
            res.status(404).send('File download tidak ditemukan.');
        }
    }
});

app.get('/api/download/model', (req, res) => {
    const modelPath = path.join(PUBLIC_DIR, 'downloads/Saweria_V2_Roblox_Model.rbxm');
    if (fs.existsSync(modelPath)) {
        res.download(modelPath, 'Saweria_V2_KIDZY_Model.rbxm');
    } else {
        res.status(404).send('File model Roblox tidak ditemukan.');
    }
});

app.get('/api/download/script', (req, res) => {
    const scriptPath = path.join(PUBLIC_DIR, 'downloads/TestDatastore.lua');
    if (fs.existsSync(scriptPath)) {
        res.download(scriptPath, 'Saweria_Datastore_Example.lua');
    } else {
        res.status(404).send('File script tidak ditemukan.');
    }
});

// Admin Clean Route Mappings
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin/index.html')));
app.get('/admin/send', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin/send.html')));
app.get('/admin/logs', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin/logs.html')));
app.get('/admin/settings', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin/settings.html')));
app.get('/admin/tokens', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin/tokens.html')));
app.get('/admin/services', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin/services.html')));
app.get('/admin/roblox', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin/roblox.html')));
app.get('/admin/downloads', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin/downloads.html')));
app.get('/logout', (req, res) => res.redirect('/login.html'));
app.get('/admin/logout', (req, res) => res.redirect('/login.html'));

// Fallback for SPA routing if needed
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
    }
    next();
});

module.exports = app;
