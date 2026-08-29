# 🚀 KIDZY Store — Sistem Webhook & Polling Donasi Roblox (Saweria, BagiBagi, SociaBuzz)

Sistem lengkap Webhook Gateway & Toko Publik untuk integrasi donasi Roblox dengan fitur modern:
- **Live Vercel Gateway**: `https://kidzy-store.vercel.app`
- **Dashboard Admin**: `https://kidzy-store.vercel.app/login.html` (Akun: `rafly4322@gmail.com` / `Sumbawa12345`)
- **Roblox Open Cloud DataStore Integration**: Auto-sync `SaweriaDonations / AllDonations`
- **In-Game Roblox Studio Features**:
  - ✨ Luxury `CanvasGroup` Glassmorphism Donation UI
  - 💫 3D Server Orbit VFX with glowing light, trails & sparkles around donor avatar
  - 👑 In-Game Admin Panel integrated with TopbarPlus (`Icon`)
  - 🏆 3D Leaderboard Display in Workspace

---

## 📁 Struktur Proyek

```
saweria-backend/
├── api/
│   └── index.js              # Serverless Function & Express Gateway untuk Vercel
├── data/
│   ├── db.js                 # Handler Database JSON (Token, Akun, Services, Log Donasi)
│   └── db.json               # Data persisten sistem
├── public/
│   ├── index.html            # Landing Page Toko Publik KIDZY Store
│   ├── login.html            # Halaman Login Admin & Klien
│   ├── register.html         # Halaman Registrasi Pengguna
│   ├── register-service.html # Halaman Aktivasi Token Layanan
│   ├── admin/                # Dashboard Admin (Stats, Logs, Simulator, Tokens, Roblox, Settings)
│   ├── p/                    # Halaman detail paket Saweria, BagiBagi, SociaBuzz
│   ├── order/                # Halaman pembayaran & invoice QRIS / Transfer
│   ├── assets/               # CSS Glassmorphism, JavaScript, Logo, Gambar QRIS
│   └── downloads/            # File model Roblox (.rbxm) & zip produk
├── services/
│   └── roblox.js             # Integrasi Roblox Open Cloud DataStore API
├── server.js                 # Server lokal Node.js (Port 3000)
├── vercel.json               # Konfigurasi deployment Vercel
└── package.json              # Dependensi Node.js
```

---

## 🛠️ Menjalankan Server Lokal

```powershell
npm install
node server.js
```

Akses lokal di: `http://localhost:3000`

---

## 📡 Daftar Endpoint Webhook & API

| Endpoint | Method | Keterangan |
| :--- | :--- | :--- |
| `/api/webhook/:slug` | `POST` | Webhook receiver Saweria/BagiBagi dengan token slug 32 karakter |
| `/api/saweria` | `POST` | Universal Webhook Saweria |
| `/api/poll/:slug` | `GET` | Polling endpoint live untuk `HttpService` Roblox Studio |
| `/api/health` | `GET` | Status server & active services check |
| `/api/store-info` | `GET` | Informasi toko, rekening, QRIS, & harga paket |
| `/api/admin/*` | `GET/POST` | API Admin (Stats, Logs, Tokens, Services, Settings) |

---

## 👑 Lisensi & Kepemilikan

Dibuat khusus untuk **Muhammad Rafly (KIDZY Store)**.
Universe ID: `10764300084`
© 2026 KIDZY Store. All rights reserved.
