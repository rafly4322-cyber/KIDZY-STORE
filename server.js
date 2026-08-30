const app = require('./api/index');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('\n======================================================');
    console.log('🚀 SAWERIA & ROBLOX WEBHOOK STORE RUNNING');
    console.log('======================================================');
    console.log(`🌐 Web Server:       http://localhost:${PORT}`);
    console.log(`🔑 Admin Panel:      http://localhost:${PORT}/admin`);
    console.log(`📦 Webhook Gateway:  http://localhost:${PORT}/api/saweria`);
    console.log(`📡 Polling Engine:   http://localhost:${PORT}/api/saweria/get-donations`);
    console.log('======================================================\n');
});
