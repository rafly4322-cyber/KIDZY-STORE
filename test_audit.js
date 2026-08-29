const https = require('https');

async function request(url, options = {}, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
                } catch(e) {
                    resolve({ status: res.statusCode, data: data, headers: res.headers });
                }
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runAudit() {
    console.log('====================================================');
    console.log('MEMULAI SYSTEM & ENDPOINT AUDIT (KIDZY STORE)');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    // 1. Health Check
    try {
        const res = await request('https://kidzy-store.vercel.app/api/health');
        if (res.status === 200 && res.data.status === 'OK') {
            console.log('[OK] [1/9] GET /api/health — Status 200 OK');
            passed++;
        } else {
            console.log('[FAIL] [1/9] GET /api/health — FAILED:', res);
            failed++;
        }
    } catch(e) { console.log('[FAIL] [1/9] Health error:', e.message); failed++; }

    // 2. Store Info
    try {
        const res = await request('https://kidzy-store.vercel.app/api/store-info');
        if (res.status === 200 && res.data.success && res.data.storeName) {
            console.log('[OK] [2/9] GET /api/store-info — OK (Store: ' + res.data.storeName + ')');
            passed++;
        } else {
            console.log('[FAIL] [2/9] GET /api/store-info — FAILED:', res);
            failed++;
        }
    } catch(e) { console.log('[FAIL] [2/9] Store info error:', e.message); failed++; }

    // 3. Admin Login
    let authToken = null;
    try {
        const loginData = { email: 'rafly4322@gmail.com', password: 'Sumbawa12345' };
        const res = await request('https://kidzy-store.vercel.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, loginData);
        if (res.status === 200 && res.data.success && res.data.token) {
            authToken = res.data.token;
            console.log('[OK] [3/9] POST /api/auth/login — OK (Admin Authenticated)');
            passed++;
        } else {
            console.log('[FAIL] [3/9] POST /api/auth/login — FAILED:', res);
            failed++;
        }
    } catch(e) { console.log('[FAIL] [3/9] Login error:', e.message); failed++; }

    // 4. Admin Stats
    if (authToken) {
        try {
            const res = await request('https://kidzy-store.vercel.app/api/admin/stats', {
                headers: { 'Authorization': 'Bearer ' + authToken }
            });
            if (res.status === 200 && res.data.success) {
                console.log('[OK] [4/9] GET /api/admin/stats — OK (Stats retrieved)');
                passed++;
            } else {
                console.log('[FAIL] [4/9] GET /api/admin/stats — FAILED:', res);
                failed++;
            }
        } catch(e) { console.log('[FAIL] [4/9] Stats error:', e.message); failed++; }
    }

    // 5. Admin Tokens List
    if (authToken) {
        try {
            const res = await request('https://kidzy-store.vercel.app/api/admin/tokens', {
                headers: { 'Authorization': 'Bearer ' + authToken }
            });
            if (res.status === 200 && res.data.success && Array.isArray(res.data.tokens)) {
                console.log('[OK] [5/9] GET /api/admin/tokens — OK (' + res.data.tokens.length + ' tokens found)');
                passed++;
            } else {
                console.log('[FAIL] [5/9] GET /api/admin/tokens — FAILED:', res);
                failed++;
            }
        } catch(e) { console.log('[FAIL] [5/9] Tokens error:', e.message); failed++; }
    }

    // 6. Admin Services List
    if (authToken) {
        try {
            const res = await request('https://kidzy-store.vercel.app/api/admin/services', {
                headers: { 'Authorization': 'Bearer ' + authToken }
            });
            if (res.status === 200 && res.data.success && Array.isArray(res.data.services)) {
                console.log('[OK] [6/9] GET /api/admin/services — OK (' + res.data.services.length + ' services active)');
                passed++;
            } else {
                console.log('[FAIL] [6/9] GET /api/admin/services — FAILED:', res);
                failed++;
            }
        } catch(e) { console.log('[FAIL] [6/9] Services error:', e.message); failed++; }
    }

    // 7. Webhook Ingestion Test
    try {
        const webhookPayload = {
            donator_name: 'Muhammad Rafly Audit Test',
            amount_raw: '50000',
            message: 'Testing Webhook Pipeline Live'
        };
        const res = await request('https://kidzy-store.vercel.app/api/webhook/qddqfoBXKQBT3ytew1o7urevCUE9Lxdl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, webhookPayload);
        if (res.status === 200 && res.data.success) {
            console.log('[OK] [7/9] POST /api/webhook/:slug — OK (Donation ingested into queue)');
            passed++;
        } else {
            console.log('[FAIL] [7/9] POST /api/webhook/:slug — FAILED:', res);
            failed++;
        }
    } catch(e) { console.log('[FAIL] [7/9] Webhook error:', e.message); failed++; }

    // 8. In-Game Polling Retrieval Test
    try {
        const res = await request('https://kidzy-store.vercel.app/api/poll/qddqfoBXKQBT3ytew1o7urevCUE9Lxdl');
        if (res.status === 200 && res.data.success && Array.isArray(res.data.donations)) {
            console.log('[OK] [8/9] GET /api/poll/:slug — OK (' + res.data.donations.length + ' donations dequeued)');
            passed++;
        } else {
            console.log('[FAIL] [8/9] GET /api/poll/:slug — FAILED:', res);
            failed++;
        }
    } catch(e) { console.log('[FAIL] [8/9] Polling error:', e.message); failed++; }

    // 9. Static Assets & Download Check
    try {
        const res = await request('https://kidzy-store.vercel.app/downloads/Saweria_lifetime.zip', { method: 'HEAD' });
        if (res.status === 200 || res.status === 302 || res.status === 304) {
            console.log('[OK] [9/9] GET /downloads/Saweria_lifetime.zip — Status ' + res.status + ' OK');
            passed++;
        } else {
            console.log('[FAIL] [9/9] Download check — FAILED:', res.status);
            failed++;
        }
    } catch(e) { console.log('[FAIL] [9/9] Download error:', e.message); failed++; }

    console.log('\n====================================================');
    console.log('HASIL AUDIT: ' + passed + ' PASSED, ' + failed + ' FAILED');
    console.log('====================================================');
}

runAudit();
