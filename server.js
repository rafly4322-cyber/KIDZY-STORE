const app = require('./api/index');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('\n======================================================');
    console.log('🚀 SAWERIA & ROBLOX WEBHOOK STORE RUNNING');
    console.log('======================================================');
    console.log(`🌐 Local Web Server: http://localhost:${PORT}`);
    console.log(`🔑 Admin Login:      http://localhost:${PORT}/login.html`);
    console.log(`   Email:            rafly4322@gmail.com`);
    console.log(`   Password:         Sumbawa12345`);
    console.log(`📦 Webhook URL:      http://localhost:${PORT}/api/saweria`);
    console.log(`📡 Polling URL:      http://localhost:${PORT}/api/saweria/get-donations`);
    console.log('======================================================\n');
});
