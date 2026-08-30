const app = require('./api/index');
const http = require('http');

async function runFullAudit() {
    console.log('🚀 STARTING COMPREHENSIVE BACKEND AUDIT...\n');

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(4899, resolve));
    const baseUrl = 'http://localhost:4899';

    try {
        // 1. Test Health
        console.log('1️⃣ Testing /api/health ...');
        const healthRes = await fetch(`${baseUrl}/api/health`);
        const healthData = await healthRes.json();
        console.log('Health Result:', healthData);
        if (healthData.status !== 'OK') throw new Error('Health check failed');

        // 2. Test Activation with a brand new token
        console.log('\n2️⃣ Testing Token Activation (/api/services/register) ...');
        const activateRes = await fetch(`${baseUrl}/api/services/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: 'KZ-TEST-NEW-TOKEN-2026',
                universeId: '10742273346',
                name: 'Auditor_Test_Game'
            })
        });
        const activateData = await activateRes.json();
        console.log('Activation Result:', activateData);
        if (!activateData.success) throw new Error('Activation failed: ' + activateData.message);

        const webhookUrl = activateData.service.webhookUrl;
        const pollUrl = activateData.service.pollUrl;
        const slug = activateData.service.slug;
        console.log(`Generated Webhook: ${webhookUrl}`);
        console.log(`Generated Poll URL: ${pollUrl}`);

        // 3. Test Webhook with Saweria format
        console.log('\n3️⃣ Testing Webhook POST (Saweria Format) to /api/webhook/' + slug + ' ...');
        const saweriaWebhookRes = await fetch(`${baseUrl}/api/webhook/${slug}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                donator_name: 'Sultan Tester Saweria',
                amount_raw: 250000,
                message: 'Test donasi Saweria 250rb lancar!'
            })
        });
        const saweriaResData = await saweriaWebhookRes.json();
        console.log('Saweria Webhook Result:', saweriaResData);
        if (!saweriaResData.success) throw new Error('Saweria Webhook failed');

        // 4. Test Webhook with SociaBuzz format
        console.log('\n4️⃣ Testing Webhook POST (SociaBuzz Format) to /api/sociabuzz ...');
        const sociaRes = await fetch(`${baseUrl}/api/sociabuzz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supporter_name: 'Sultan Tester SociaBuzz',
                amount: 150000,
                message: 'Test donasi SociaBuzz 150rb mantap!'
            })
        });
        const sociaData = await sociaRes.json();
        console.log('SociaBuzz Webhook Result:', sociaData);
        if (!sociaData.success) throw new Error('SociaBuzz Webhook failed');

        // 5. Test Webhook with BagiBagi format
        console.log('\n5️⃣ Testing Webhook POST (BagiBagi Format) to /api/bagibagi ...');
        const bagiRes = await fetch(`${baseUrl}/api/bagibagi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: 'Sultan Tester BagiBagi',
                amount: 75000,
                message: 'Test donasi BagiBagi 75rb jos!'
            })
        });
        const bagiData = await bagiRes.json();
        console.log('BagiBagi Webhook Result:', bagiData);
        if (!bagiData.success) throw new Error('BagiBagi Webhook failed');

        // 6. Test Polling Endpoint
        console.log('\n6️⃣ Testing Polling GET (/api/poll/' + slug + ') ...');
        const pollRes = await fetch(`${baseUrl}/api/poll/${slug}`);
        const pollData = await pollRes.json();
        console.log('Poll Result:', JSON.stringify(pollData, null, 2));
        if (!pollData.success || pollData.count < 3) throw new Error('Poll failed or missed donations!');

        // 7. Test Second Poll (Should be empty because marked as polled)
        console.log('\n7️⃣ Testing Second Polling (Should be consumed) ...');
        const poll2Res = await fetch(`${baseUrl}/api/poll/${slug}`);
        const poll2Data = await poll2Res.json();
        console.log('Poll 2 Result:', poll2Data);
        if (poll2Data.count !== 0) throw new Error('Donations were not marked as consumed!');

        console.log('\n🎉 ALL 7 AUDIT CHECKS PASSED WITH 100% SUCCESS!');
    } finally {
        server.close();
    }
}

runFullAudit().catch(err => {
    console.error('❌ AUDIT ERROR:', err);
    process.exit(1);
});
