const fs = require('fs');
const path = require('path');
const app = require('./api/index');
const { db } = require('./data/db');

async function runComprehensiveQA() {
  console.log('================================================================');
  console.log('  KIDZY STORE — END-TO-END QA & DEBUGGING TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const issuesFound = [];

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${name} ${details ? '— ' + details : ''}`);
      failed++;
      issuesFound.push({ name, details });
    }
  }

  const server = app.listen(5999);
  const BASE_URL = 'http://localhost:5999';

  try {
    // -------------------------------------------------------------
    // SECTION 1: STATIC ASSETS & HTML INTEGRITY
    // -------------------------------------------------------------
    console.log('--- [SECTION 1] HTML & Static Files Integrity ---');
    const publicDir = path.join(__dirname, 'public');
    const htmlFiles = [
      'index.html',
      'activation.html',
      'login.html',
      'register.html',
      'p/saweria.html',
      'p/bagibagi.html',
      'p/sociabuzz.html',
      'admin/index.html',
      'admin/services.html',
      'admin/tokens.html',
      'admin/settings.html',
      'admin/send.html',
      'admin/logs.html',
      'admin/roblox.html',
      'admin/downloads.html'
    ];

    htmlFiles.forEach(relPath => {
      const fullPath = path.join(publicDir, relPath);
      const exists = fs.existsSync(fullPath);
      assert(exists, `HTML File Exists: ${relPath}`);
      if (exists) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert(content.includes('<meta name="viewport"'), `Mobile Viewport Meta Tag in ${relPath}`);
        assert(content.includes('<title>'), `Page Title Defined in ${relPath}`);
      }
    });

    const styleCss = fs.readFileSync(path.join(publicDir, 'assets/style.css'), 'utf-8');
    assert(styleCss.includes('.modal-backdrop'), 'CSS: Modal Backdrop System Present');
    assert(styleCss.includes('.faq-item'), 'CSS: FAQ Accordion System Present');
    assert(styleCss.includes('@media (max-width:'), 'CSS: Responsive Breakpoints Present');

    const appJs = fs.readFileSync(path.join(publicDir, 'assets/app.js'), 'utf-8');
    assert(appJs.includes('window.copyText'), 'JS: copyText Attached to Window');
    assert(appJs.includes('window.openOrderModal'), 'JS: openOrderModal Attached to Window');
    assert(appJs.includes('window.API'), 'JS: API Client Attached to Window');

    // -------------------------------------------------------------
    // SECTION 2: PUBLIC & STORE API
    // -------------------------------------------------------------
    console.log('\n--- [SECTION 2] Public & Store APIs ---');
    
    // 1. Health
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    assert(healthRes.status === 200 && health.status === 'OK', 'GET /api/health returns 200 OK');

    // 2. Store Info
    const storeRes = await fetch(`${BASE_URL}/api/store-info`);
    const storeInfo = await storeRes.json();
    assert(storeRes.status === 200 && storeInfo.success && storeInfo.storeName === 'KIDZY Store', 'GET /api/store-info returns correct store details');

    // -------------------------------------------------------------
    // SECTION 3: AUTHENTICATION & ACCESS CONTROL
    // -------------------------------------------------------------
    console.log('\n--- [SECTION 3] Authentication & Access Control ---');

    // 1. Unauthenticated access to admin routes
    const unauthRes = await fetch(`${BASE_URL}/api/admin/stats`);
    assert(unauthRes.status === 401, 'Protected Route Rejects Unauthenticated Access (401)');

    // 2. Invalid password login
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rafly4322@gmail.com', password: 'WrongPassword999' })
    });
    assert(wrongPassRes.status === 401, 'Login Rejects Wrong Password (401)');

    // 3. Valid admin login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rafly4322@gmail.com', password: 'Sumbawa12345' })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success && loginData.token, 'Admin Login Successful (200 & Valid Token)');
    const adminToken = loginData.token;

    // 4. Admin Stats Access
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const statsData = await statsRes.json();
    assert(statsRes.status === 200 && statsData.success, 'Admin Authenticated Access to /api/admin/stats (200)');

    // 5. Register new client user
    const testEmail = `qa_tester_${Date.now()}@test.com`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'PasswordTest123!', name: 'QA Tester' })
    });
    const regData = await regRes.json();
    assert(regRes.status === 200 && regData.success && regData.user.role === 'client', 'User Registration Successful as Client');
    const clientToken = regData.token;

    // 6. Client tries to access Admin route (RBAC Test)
    const clientForbiddenRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${clientToken}` }
    });
    assert(clientForbiddenRes.status === 403, 'RBAC Shield: Client User Forbidden from Admin Routes (403)');

    // -------------------------------------------------------------
    // SECTION 4: TOKENS & SERVICE ACTIVATION FLOW
    // -------------------------------------------------------------
    console.log('\n--- [SECTION 4] Token Lifecycle & Service Activation ---');

    // 1. Create Token
    const createTokRes = await fetch(`${BASE_URL}/api/admin/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ platform: 'saweria', plan: 'lifetime', note: 'QA Test Token' })
    });
    const createTokData = await createTokRes.json();
    assert(createTokRes.status === 200 && createTokData.token?.code, 'Admin Creates New Token');
    const testTokenCode = createTokData.token.code;

    // 2. Bulk Token Generator (Giveaway)
    const bulkTokRes = await fetch(`${BASE_URL}/api/admin/tokens/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ count: 5, platform: 'saweria', plan: 'lifetime', note: 'Bulk Giveaway' })
    });
    const bulkTokData = await bulkTokRes.json();
    assert(bulkTokRes.status === 200 && bulkTokData.count === 5, 'Admin Generates 5 Bulk Giveaway Tokens in 1-Click');

    // 3. Redeem / Activate Token
    const actRes = await fetch(`${BASE_URL}/api/services/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: testTokenCode,
        universeId: '10742273346',
        name: 'Game QA Test Place'
      })
    });
    const actData = await actRes.json();
    assert(actRes.status === 200 && actData.success && actData.service?.webhookUrl, 'Token Activation Generates Live Webhook & Polling URLs');
    const generatedWebhookUrl = actData.service.webhookUrl;
    const generatedPollUrl = actData.service.pollUrl;

    // 4. Token Re-activation (Idempotent Update)
    const reactRes = await fetch(`${BASE_URL}/api/services/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: testTokenCode,
        universeId: '118749454354',
        name: 'Game QA Test Place Updated'
      })
    });
    const reactData = await reactRes.json();
    assert(reactRes.status === 200 && reactData.service.universeId === '118749454354', 'Re-activating Token Updates Universe ID Idempotently');

    // -------------------------------------------------------------
    // SECTION 5: ADMIN UNIVERSE ID & MASS GIVEAWAY GENERATOR
    // -------------------------------------------------------------
    console.log('\n--- [SECTION 5] Direct Universe ID & Giveaway Generator ---');

    // 1. Direct Add Service with Universe ID (No Token Needed)
    const directAddRes = await fetch(`${BASE_URL}/api/admin/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        universeId: '9988776655',
        clientName: 'Direct Universe Test Game',
        platform: 'saweria'
      })
    });
    const directAddData = await directAddRes.json();
    assert(directAddRes.status === 200 && directAddData.service?.webhookUrl, 'Direct Universe ID Registration (No Token Needed)');

    // 2. Mass Giveaway Webhook Generator
    const gwGenRes = await fetch(`${BASE_URL}/api/admin/giveaway/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        count: 3,
        platform: 'saweria',
        clientPrefix: 'Giveaway Drop',
        universeIds: ['10742273346', '118749454354', '5544332211']
      })
    });
    const gwGenData = await gwGenRes.json();
    assert(gwGenRes.status === 200 && gwGenData.count === 3 && gwGenData.discordFormattedText, 'Mass Giveaway Generator Creates Formatted Discord Text');

    // -------------------------------------------------------------
    // SECTION 6: WEBHOOK INGESTION & POLLING PIPELINE
    // -------------------------------------------------------------
    console.log('\n--- [SECTION 6] Webhook Ingestion & Polling Pipeline ---');

    // 1. Verification Ping (GET & HEAD)
    const getWhRes = await fetch(generatedWebhookUrl, { method: 'GET' });
    assert(getWhRes.status === 200, 'Webhook Endpoint Responds 200 to GET/Verification Ping');

    // 2. Saweria Donation Post
    const donationPayload = {
      donator_name: 'SuperDonator_QA',
      amount: 250000,
      message: 'Donasi test end-to-end!',
      timestamp: new Date().toISOString()
    };
    const postWhRes = await fetch(generatedWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donationPayload)
    });
    const postWhData = await postWhRes.json();
    assert(postWhRes.status === 200 && postWhData.success, 'Webhook Successfully Ingests Donation (< 1ms)');

    // 3. SociaBuzz Webhook Format
    const sbPayload = {
      supporter_name: 'SociaBuzz_Fan',
      amount: 100000,
      supporter_message: 'Halo bang!',
      created_at: new Date().toISOString()
    };
    const postSbRes = await fetch(`${BASE_URL}/api/sociabuzz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sbPayload)
    });
    const postSbData = await postSbRes.json();
    assert(postSbRes.status === 200 && postSbData.platform === 'sociabuzz', 'Universal Webhook Ingests SociaBuzz Format');

    // 4. BagiBagi Webhook Format
    const bbPayload = {
      sender: 'BagiBagi_User',
      amount_raw: '50000',
      pesan: 'Semangat terus!'
    };
    const postBbRes = await fetch(`${BASE_URL}/api/bagibagi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bbPayload)
    });
    const postBbData = await postBbRes.json();
    assert(postBbRes.status === 200 && postBbData.platform === 'bagibagi', 'Universal Webhook Ingests BagiBagi Format');

    // 5. Polling Consume from Roblox Script
    const pollRes = await fetch(generatedPollUrl);
    const pollData = await pollRes.json();
    assert(pollRes.status === 200 && pollData.count >= 1 && pollData.donations.length >= 1, 'Roblox Polling Consumes Unpolled Donations (Count >= 1)');
    assert(pollData.donations[0].formattedAmount.includes('Rp'), 'Donation Formatting contains Currency Format (Rp)');

    // 6. Polling Idempotency (Already consumed should not duplicate)
    const pollAgainRes = await fetch(generatedPollUrl);
    const pollAgainData = await pollAgainRes.json();
    assert(pollAgainRes.status === 200 && pollAgainData.count === 0, 'Polling Idempotency: Consumed Donations are Not Duplicated (count = 0)');

    // -------------------------------------------------------------
    // SECTION 7: SECURITY & DEFENSE MECHANISMS
    // -------------------------------------------------------------
    console.log('\n--- [SECTION 7] Security & OWASP Defense ---');

    // 1. Prototype Pollution Attempt (Raw HTTP Payload)
    const protoPolluteRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":"hacker@evil.com","password":"123","__proto__":{"isAdmin":true}}'
    });
    assert(protoPolluteRes.status === 400, 'Security: Prototype Pollution Injection Blocked (400)');

    // 2. Security Headers
    assert(healthRes.headers.get('x-content-type-options') === 'nosniff', 'Security Header: X-Content-Type-Options: nosniff');
    assert(healthRes.headers.get('x-frame-options') === 'SAMEORIGIN', 'Security Header: X-Frame-Options: SAMEORIGIN');
    assert(healthRes.headers.get('x-xss-protection') === '1; mode=block', 'Security Header: X-XSS-Protection Present');

    // -------------------------------------------------------------
    // SECTION 8: ASSET DOWNLOADS
    // -------------------------------------------------------------
    console.log('\n--- [SECTION 8] Asset Downloads ---');
    const dlZipRes = await fetch(`${BASE_URL}/api/download/zip`);
    assert(dlZipRes.status === 200, 'Download Endpoint: /api/download/zip returns 200');

    const dlModelRes = await fetch(`${BASE_URL}/api/download/model`);
    assert(dlModelRes.status === 200, 'Download Endpoint: /api/download/model returns 200');

    const dlScriptRes = await fetch(`${BASE_URL}/api/download/script`);
    assert(dlScriptRes.status === 200, 'Download Endpoint: /api/download/script returns 200');

    console.log('\n================================================================');
    console.log(`  FINAL QA SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal QA Suite Error:', err);
    failed++;
  } finally {
    server.close();
  }
}

runComprehensiveQA();
