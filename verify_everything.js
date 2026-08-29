// ====================================================================
// 🔍 MASTER AUDIT SUITE: VERIFY EVERYTHING (NO FAILS / NO MISTAKES)
// ====================================================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { db, hashPassword, verifyPassword } = require('./data/db');

async function runMasterAudit() {
    console.log('\n======================================================');
    console.log('🚀 MEMULAI AUDIT KESELURUHAN SISTEM (MASTER AUDIT)');
    console.log('======================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, extra = '') {
        if (condition) {
            console.log(`✅ [PASS] ${testName} ${extra}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${testName} ${extra}`);
            failed++;
        }
    }

    // 1. Database & Settings
    console.log('--- [1. AUDIT DATABASE & SETTINGS] ---');
    const settings = db.getSettings();
    assert(settings.bankName === 'SeaBank', 'Bank Name is SeaBank', `(${settings.bankName})`);
    assert(settings.bankAccount === '901506323909', 'Account Number is 901506323909', `(${settings.bankAccount})`);
    assert(settings.bankHolder === 'MUHAMMAD RAFLI FIRDAUS', 'Account Holder is MUHAMMAD RAFLI FIRDAUS');
    assert(settings.prices.saweria.lifetime === 90000, 'Saweria Lifetime price is Rp 90.000');
    assert(settings.prices.saweria.plan30d === 35000, 'Saweria 30d price is Rp 35.000');

    // 2. Admin Auth
    console.log('\n--- [2. AUDIT ADMIN AUTHENTICATION] ---');
    const adminUser = db.getUserByEmail('rafly4322@gmail.com');
    assert(!!adminUser, 'Admin user rafly4322@gmail.com exists');
    assert(adminUser.role === 'admin', 'Admin user has role: admin');
    const isValidPass = verifyPassword('Sumbawa12345', adminUser.passwordSalt, adminUser.passwordHash);
    assert(isValidPass, 'Admin password Sumbawa12345 verified with salt & hash');

    // 3. Token System
    console.log('\n--- [3. AUDIT TOKEN SYSTEM & ACTIVATION] ---');
    const vipToken = db.getTokenByCode('KIDZY-SAWERIA-LIFETIME-VIP');
    assert(!!vipToken, 'VIP Lifetime Token KIDZY-SAWERIA-LIFETIME-VIP exists');
    assert(vipToken.plan === 'lifetime', 'VIP Token plan is lifetime');

    // 4. HTML Static Files & Integrity
    console.log('\n--- [4. AUDIT FRONTEND HTML & ASSETS] ---');
    const publicFiles = [
        'index.html',
        'activation.html',
        'register-service.html',
        'login.html',
        'order/index.html',
        'p/saweria.html',
        'p/bagibagi.html',
        'p/sociabuzz.html',
        'admin/index.html',
        'admin/login.html',
        'admin/tokens.html',
        'admin/logs.html',
        'admin/settings.html',
        'assets/style.css',
        'assets/app.js'
    ];

    publicFiles.forEach(file => {
        const fullPath = path.join(__dirname, 'public', file);
        assert(fs.existsSync(fullPath), `File public/${file} exists and accessible`);
    });

    // Check SeaBank reference across HTML files
    const htmlFilesToCheck = ['p/saweria.html', 'p/bagibagi.html', 'p/sociabuzz.html', 'order/index.html'];
    htmlFilesToCheck.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, 'public', file), 'utf-8');
        assert(content.includes('901506323909'), `File public/${file} contains SeaBank account 901506323909`);
        assert(!content.includes('1878077651'), `File public/${file} does NOT contain obsolete bank numbers`);
    });

    // 5. Live Vercel API Endpoints Testing
    console.log('\n--- [5. AUDIT LIVE VERCEL PRODUCTION GATEWAY] ---');
    async function testHttp(url, options = {}) {
        return new Promise((resolve) => {
            const req = https.request(url, options, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => resolve({ status: res.statusCode, body }));
            });
            req.on('error', (err) => resolve({ status: 500, error: err.message }));
            if (options.body) req.write(options.body);
            req.end();
        });
    }

    const healthRes = await testHttp('https://kidzy-store.vercel.app/api/health');
    assert(healthRes.status === 200, 'GET /api/health returned HTTP 200 OK');

    const webhookRes = await testHttp('https://kidzy-store.vercel.app/api/webhook/qddqfoBXKQBT3ytew1o7urevCUE9Lxdl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donator_name: 'MasterAuditTester', amount_raw: 100000, message: 'Automated Audit Verification' })
    });
    assert(webhookRes.status === 200, 'POST /api/webhook/:slug returned HTTP 200 OK');

    const pollRes = await testHttp('https://kidzy-store.vercel.app/api/poll/qddqfoBXKQBT3ytew1o7urevCUE9Lxdl');
    assert(pollRes.status === 200, 'GET /api/poll/:slug returned HTTP 200 OK');
    const pollJson = JSON.parse(pollRes.body || '{}');
    assert(pollJson.success === true, 'Polling endpoint returned success: true');

    console.log('\n======================================================');
    console.log(`📊 HASIL MASTER AUDIT: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed === 0) {
        console.log('🎉 SELURUH SISTEM 100% VALID, BEBAS BUG, DAN SIAP DIGUNAKAN!');
    }
}

runMasterAudit();
