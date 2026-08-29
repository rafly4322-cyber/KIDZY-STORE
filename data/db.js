const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'db.json');

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

// Generate 32-char alphanumeric secret key (like menSecRt0: qddqfoBXKQBT3ytew1o7urevCUE9Lxdl)
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
                id: 'tok_demo_1',
                code: 'MS-SAW-DEMO-2026',
                platform: 'saweria',
                plan: 'lifetime',
                status: 'unused',
                note: 'Sample Lifetime Saweria Token',
                createdAt: now,
                usedAt: null,
                usedBy: null,
                expiresAt: null
            },
            {
                id: 'tok_demo_2',
                code: 'MS-30D-TEST-9999',
                platform: 'saweria',
                plan: '30d',
                status: 'unused',
                note: 'Sample 30-Day Token',
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
            bankName: 'BNI',
            bankAccount: '1788342779',
            bankHolder: 'Ahmad Taufik',
            qrisImage: '/assets/qris.png',
            prices: {
                saweria: { plan30d: 90000, lifetime: 300000 },
                bagibagi: { plan30d: 90000, lifetime: 300000 },
                sociabuzz: { plan30d: 90000, lifetime: 300000 }
            },
            robloxApiKey: process.env.ROBLOX_API_KEY || '',
            universeIds: process.env.UNIVERSE_IDS ? process.env.UNIVERSE_IDS.split(',').map(s => s.trim()) : []
        }
    };
}

class Database {
    constructor() {
        this.data = null;
        this.init();
    }

    init() {
        try {
            if (fs.existsSync(DB_PATH)) {
                const raw = fs.readFileSync(DB_PATH, 'utf-8');
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
                this.save();
            }
        } catch (err) {
            console.error('⚠️ Failed reading db.json, creating clean initial state:', err.message);
            this.data = getInitialData();
            this.save();
        }
    }

    save() {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
        } catch (err) {
            console.error('❌ Failed to save db.json:', err.message);
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
        const trimmed = code.trim();
        const upper = trimmed.toUpperCase();
        return this.data.tokens.find(t => 
            t.code.toUpperCase() === upper || 
            (t.slug && t.slug === trimmed)
        ) || null;
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

        const newService = {
            id: 'svc_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            tokenCode: token ? token.code : (tokenCode || 'MANUAL-ENTRY'),
            slug: token && token.slug ? token.slug : generateSecretSlug(),
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
            details: donation.details || {}
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
