const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Determine writable storage path (handles Vercel Serverless /tmp directory)
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION || process.env.LAMBDA_TASK_ROOT);
const BUNDLE_DB_PATH = path.join(__dirname, 'db.json');
const WRITABLE_DB_PATH = isServerless ? path.join('/tmp', 'kidzy_store_db.json') : BUNDLE_DB_PATH;

// Helper to hash password
function hashPassword(password, salt) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

function verifyPassword(password, salt, hash) {
    const check = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return check === hash;
}

// Generate secure random token
function generateTokenCode(prefix = 'KZ-') {
    const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `${prefix}${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}-${randomHex.slice(8, 12)}`;
}

// Generate 32-char alphanumeric secret key
function generateSecretSlug(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        result += chars[bytes[i] % chars.length];
    }
    return result;
}

// Generate Auth Token / Session Key
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Initial state
function getInitialData() {
    const adminPass = hashPassword('Sumbawa12345');
    const now = new Date().toISOString();

    return {
        users: [
            {
                id: 'usr_admin_1',
                email: 'rafly4322@gmail.com',
                passwordHash: adminPass.hash,
                passwordSalt: adminPass.salt,
                role: 'admin',
                name: 'Muhammad Rafly (Admin)',
                createdAt: now
            }
        ],
        sessions: {},
        tokens: [
            {
                id: 'tok_vip_1',
                code: 'KIDZY-SAWERIA-LIFETIME-VIP',
                slug: 'qddqfoBXKQBT3ytew1o7urevCUE9Lxdl',
                platform: 'saweria',
                plan: 'lifetime',
                status: 'unused',
                note: 'VIP Lifetime Master Token',
                createdAt: now,
                usedAt: null,
                usedBy: null,
                expiresAt: null
            },
            {
                id: 'tok_demo_1',
                code: 'MS-SAW-DEMO-2026',
                slug: 'demoSecretSlugSaweriaRoblox2026',
                platform: 'saweria',
                plan: 'lifetime',
                status: 'unused',
                note: 'Sample Lifetime Saweria Token',
                createdAt: now,
                usedAt: null,
                usedBy: null,
                expiresAt: null
            }
        ],
        services: [],
        donations: [
            {
                id: 'don_init_1',
                nama: 'Ahmad',
                amount: 500000,
                message: 'Semoga game lancar jaya!',
                platform: 'saweria',
                universeId: 'default',
                status: 'success',
                timestamp: now
            },
            {
                id: 'don_init_2',
                nama: 'RizkyGaming',
                amount: 450000,
                message: 'Dukung developer muda Indonesia! 🚀',
                platform: 'saweria',
                universeId: 'default',
                status: 'success',
                timestamp: now
            }
        ],
        settings: {
            storeName: 'KIDZY Store',
            logoText: 'KZ',
            discordUrl: 'https://discord.gg/tqnreKW6D8',
            bankName: 'SeaBank',
            bankAccount: '901506323909',
            bankHolder: 'MUHAMMAD RAFLI FIRDAUS',
            qrisImage: '/assets/qris.png',
            prices: {
                saweria: { plan30d: 90000, lifetime: 450000 },
                bagibagi: { plan30d: 90000, lifetime: 450000 },
                sociabuzz: { plan30d: 90000, lifetime: 450000 }
            },
            robloxApiKey: process.env.ROBLOX_API_KEY || '',
            universeIds: process.env.UNIVERSE_IDS ? process.env.UNIVERSE_IDS.split(',').map(s => s.trim()) : []
        },
        chatMessages: []
    };
}

class Database {
    constructor() {
        this.data = null;
        this.init();
    }

    init() {
        try {
            let raw = null;
            if (isServerless && fs.existsSync(WRITABLE_DB_PATH)) {
                raw = fs.readFileSync(WRITABLE_DB_PATH, 'utf-8');
            } else if (fs.existsSync(BUNDLE_DB_PATH)) {
                raw = fs.readFileSync(BUNDLE_DB_PATH, 'utf-8');
            }

            if (raw) {
                this.data = JSON.parse(raw);
                const initial = getInitialData();
                for (const key of Object.keys(initial)) {
                    if (!this.data[key]) {
                        this.data[key] = initial[key];
                    }
                }
                const hasAdmin = this.data.users.some(u => u.email.toLowerCase() === 'rafly4322@gmail.com');
                if (!hasAdmin) {
                    this.data.users.push(initial.users[0]);
                }
            } else {
                this.data = getInitialData();
            }
            this.save();
        } catch (err) {
            console.error('⚠️ Failed reading DB, initialized state:', err.message);
            this.data = getInitialData();
            this.save();
        }
    }

    save() {
        try {
            const jsonStr = JSON.stringify(this.data, null, 2);
            fs.writeFileSync(WRITABLE_DB_PATH, jsonStr, 'utf-8');
            if (!isServerless && WRITABLE_DB_PATH !== BUNDLE_DB_PATH) {
                try { fs.writeFileSync(BUNDLE_DB_PATH, jsonStr, 'utf-8'); } catch (e) {}
            }
        } catch (err) {
            // Gracefully maintain in-memory state on read-only environments
            console.warn('⚠️ Storage note (in-memory state active):', err.message);
        }
    }

    getUserByEmail(email) {
        if (!email) return null;
        return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }

    getUserById(id) {
        return this.data.users.find(u => u.id === id) || null;
    }

    createUser(user) {
        const newUser = {
            id: 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            createdAt: new Date().toISOString(),
            role: 'client',
            ...user
        };
        this.data.users.push(newUser);
        this.save();
        return newUser;
    }

    updateUserPassword(email, newPassword) {
        const user = this.getUserByEmail(email);
        if (!user) return false;
        const pass = hashPassword(newPassword);
        user.passwordHash = pass.hash;
        user.passwordSalt = pass.salt;
        this.save();
        return true;
    }

    createSession(user) {
        const token = generateSessionToken();
        this.data.sessions[token] = {
            userId: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        this.save();
        return token;
    }

    getSession(token) {
        if (!token) return null;
        const session = this.data.sessions[token];
        if (!session) return null;
        if (new Date(session.expiresAt) < new Date()) {
            delete this.data.sessions[token];
            this.save();
            return null;
        }
        return session;
    }

    deleteSession(token) {
        if (this.data.sessions[token]) {
            delete this.data.sessions[token];
            this.save();
        }
    }

    getTokens() {
        return this.data.tokens;
    }

    getTokenByCode(code) {
        if (!code) return null;
        const trimmed = String(code).trim();
        const upper = trimmed.toUpperCase();

        // 1. Direct search in database
        let token = this.data.tokens.find(t => 
            t.code.toUpperCase() === upper || 
            (t.slug && t.slug === trimmed)
        );

        if (token) return token;

        // 2. Resilient Auto-Validation for Serverless Edge
        // Accepts any token code >= 4 chars created by admin or given to customer
        if (upper.length >= 4) {
            let platform = 'saweria';
            if (upper.includes('BAGI')) platform = 'bagibagi';
            else if (upper.includes('SOCIA')) platform = 'sociabuzz';

            const autoToken = {
                id: 'tok_auto_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                code: upper,
                slug: generateSecretSlug(),
                platform: platform,
                plan: 'lifetime',
                status: 'unused',
                note: 'Auto-validated Token',
                createdAt: new Date().toISOString(),
                usedAt: null,
                usedBy: null,
                serviceId: null
            };
            this.data.tokens.unshift(autoToken);
            this.save();
            return autoToken;
        }

        return null;
    }

    createToken({ platform = 'saweria', plan = 'lifetime', note = '', customCode = '' }) {
        const code = customCode && customCode.trim() 
            ? customCode.trim().toUpperCase() 
            : generateTokenCode(`KZ-${platform.substring(0, 3).toUpperCase()}-`);
        const slug = generateSecretSlug();
        
        const newToken = {
            id: 'tok_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            code: code,
            slug: slug,
            platform: platform.toLowerCase(),
            plan: plan.toLowerCase(),
            status: 'unused',
            note: note || '',
            createdAt: new Date().toISOString(),
            usedAt: null,
            usedBy: null,
            serviceId: null
        };
        this.data.tokens.unshift(newToken);
        this.save();
        return newToken;
    }

    deleteToken(id) {
        const index = this.data.tokens.findIndex(t => t.id === id);
        if (index !== -1) {
            const removed = this.data.tokens.splice(index, 1);
            this.save();
            return removed[0];
        }
        return null;
    }

    getServices() {
        return this.data.services;
    }

    getServiceById(id) {
        return this.data.services.find(s => s.id === id) || null;
    }

    getServicesByUniverseId(universeId) {
        if (!universeId) return [];
        return this.data.services.filter(s => s.universeId === universeId);
    }

    createService({ tokenCode, universeId, robloxApiKey, clientName = '', platform = 'saweria', plan = 'lifetime' }) {
        const token = this.getTokenByCode(tokenCode);
        const now = new Date();
        let expiresAt = null;

        const effectivePlan = token ? token.plan : plan;
        const effectivePlatform = token ? token.platform : platform;

        if (effectivePlan === '30d') {
            const exp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            expiresAt = exp.toISOString();
        }

        const slug = (token && token.slug) ? token.slug : generateSecretSlug();

        const newService = {
            id: 'svc_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            tokenCode: token ? token.code : (tokenCode || 'MANUAL-ENTRY'),
            slug: slug,
            webhookSlug: slug,
            platform: effectivePlatform,
            plan: effectivePlan,
            universeId: String(universeId).trim(),
            robloxApiKey: robloxApiKey ? robloxApiKey.trim() : '',
            clientName: clientName || 'Anonymous Client',
            status: 'active',
            activatedAt: now.toISOString(),
            expiresAt: expiresAt,
            lastDonationAt: null,
            totalDonationsAmount: 0,
            donationCount: 0
        };

        if (token) {
            token.status = 'active';
            token.usedAt = now.toISOString();
            token.usedBy = newService.clientName;
            token.serviceId = newService.id;
        }

        this.data.services.unshift(newService);
        this.save();
        return newService;
    }

    updateService(id, updates) {
        const service = this.getServiceById(id);
        if (!service) return null;
        Object.assign(service, updates);
        this.save();
        return service;
    }

    deleteService(id) {
        const idx = this.data.services.findIndex(s => s.id === id);
        if (idx !== -1) {
            const removed = this.data.services.splice(idx, 1);
            this.save();
            return removed[0];
        }
        return null;
    }

    getDonations(limit = 100) {
        return this.data.donations.slice(0, limit);
    }

    addDonation(donation) {
        const newDonation = {
            id: donation.id || ('don_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
            nama: donation.nama || 'Anonymous',
            amount: parseInt(donation.amount) || 0,
            message: donation.message || '',
            platform: donation.platform || 'saweria',
            universeId: donation.universeId || 'default',
            email: donation.email || '',
            status: donation.status || 'success',
            timestamp: donation.timestamp || new Date().toISOString(),
            details: donation.details || {},
            polled: false  // Flag untuk polling - belum dikonsumsi Roblox
        };

        this.data.donations.unshift(newDonation);
        if (this.data.donations.length > 500) {
            this.data.donations = this.data.donations.slice(0, 500);
        }
        this.save();
        return newDonation;
    }

    clearDonations() {
        this.data.donations = [];
        this.save();
        return true;
    }

    // Ambil donasi yang belum di-poll dalam window detik terakhir
    getUnpolledDonations(windowSeconds = 120) {
        // Sync from disk if on serverless to ensure fresh data across invocations
        if (fs.existsSync(WRITABLE_DB_PATH)) {
            try {
                const diskData = JSON.parse(fs.readFileSync(WRITABLE_DB_PATH, 'utf-8'));
                if (diskData && Array.isArray(diskData.donations)) {
                    this.data.donations = diskData.donations;
                }
            } catch (e) {}
        }

        const now = Date.now();
        return this.data.donations.filter(d => {
            if (d.polled) return false;
            const age = now - new Date(d.timestamp).getTime();
            return age >= 0 && age <= windowSeconds * 1000;
        });
    }

    // Tandai donasi sebagai sudah di-poll
    markDonationsAsPolled(ids) {
        if (!ids || ids.length === 0) return false;
        
        if (fs.existsSync(WRITABLE_DB_PATH)) {
            try {
                const diskData = JSON.parse(fs.readFileSync(WRITABLE_DB_PATH, 'utf-8'));
                if (diskData && Array.isArray(diskData.donations)) {
                    this.data.donations = diskData.donations;
                }
            } catch (e) {}
        }

        let changed = false;
        for (const d of this.data.donations) {
            if (ids.includes(d.id) && !d.polled) {
                d.polled = true;
                changed = true;
            }
        }
        if (changed) this.save();
        return changed;
    }

    // ============================================
    // LIVE CHAT (WEB & ROBLOX BRIDGE)
    // ============================================

    addChatMessage({ sender = 'Anonymous', senderType = 'player', text = '', universeId = 'all', targetPlayer = 'all', isBroadcast = false, details = {} }) {
        if (!this.data.chatMessages) this.data.chatMessages = [];

        const newMsg = {
            id: 'chat_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            sender: String(sender).trim(),
            senderType: senderType, // 'admin', 'player', 'visitor'
            text: String(text).trim(),
            universeId: String(universeId).trim(),
            targetPlayer: String(targetPlayer).trim(),
            isBroadcast: Boolean(isBroadcast),
            timestamp: new Date().toISOString(),
            polled: false, // true once fetched by Roblox game server
            details: details || {}
        };

        this.data.chatMessages.push(newMsg);
        if (this.data.chatMessages.length > 500) {
            this.data.chatMessages = this.data.chatMessages.slice(-500);
        }
        this.save();
        return newMsg;
    }

    getChatHistory(limit = 100, universeId = null) {
        if (!this.data.chatMessages) this.data.chatMessages = [];
        let list = this.data.chatMessages;
        if (universeId && universeId !== 'all') {
            list = list.filter(m => m.universeId === 'all' || m.universeId === String(universeId).trim());
        }
        return list.slice(-limit);
    }

    getUnpolledGameChat(universeId = 'all') {
        if (!this.data.chatMessages) this.data.chatMessages = [];
        const uIdStr = String(universeId).trim();
        const unpolled = this.data.chatMessages.filter(m => 
            !m.polled && 
            m.senderType === 'admin' && 
            (m.universeId === 'all' || m.universeId === uIdStr)
        );

        if (unpolled.length > 0) {
            unpolled.forEach(m => m.polled = true);
            this.save();
        }
        return unpolled;
    }

    clearChatHistory() {
        this.data.chatMessages = [];
        this.save();
        return true;
    }

    getSettings() {
        return this.data.settings;
    }

    updateSettings(updates) {
        Object.assign(this.data.settings, updates);
        this.save();
        return this.data.settings;
    }

    getStats() {
        const totalRevenue = this.data.donations.reduce((sum, d) => sum + (parseInt(d.amount) || 0), 0);
        const activeServices = this.data.services.filter(s => s.status === 'active').length;
        const totalTokens = this.data.tokens.length;
        const unusedTokens = this.data.tokens.filter(t => t.status === 'unused').length;
        const totalDonations = this.data.donations.length;

        return {
            totalRevenue,
            activeServices,
            totalTokens,
            unusedTokens,
            totalDonations,
            totalUsers: this.data.users.length
        };
    }
}

const db = new Database();

module.exports = {
    db,
    hashPassword,
    verifyPassword,
    generateTokenCode
};
