/**
 * KIDZY Store — Universal Modern Client Library (2026 Edition)
 * Rich interactive features: Live Roblox In-Game Simulator, Modals, 1-Click Copy & Toast
 */

// Theme Management
(function initTheme() {
    const saved = localStorage.getItem('app_theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('app_theme', target);
}

// Mobile Nav Toggle
function toggleMobileNav() {
    const nav = document.querySelector('.nav');
    if (nav) {
        nav.classList.toggle('is-open');
    }
}

// Toast Notifications System
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; pointer-events: none; max-width: 90vw;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
    toast.style.cssText = 'pointer-events: auto; box-shadow: 0 16px 36px rgba(0,0,0,0.8); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); transform: translateY(15px); opacity: 0;';
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✨';
    if (type === 'error') icon = '❌';
    if (type === 'warn') icon = '⚠️';

    toast.innerHTML = `<span style="font-size: 16px;">${icon}</span> <span style="font-weight: 500;">${message}</span>`;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// 1-Click Copy to Clipboard
function copyText(text, btn) {
    if (!text || text.includes('Loading')) return;
    
    function onSuccess() {
        showToast('Tersalin ke clipboard!', 'success');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '✨ Tersalin!';
            btn.style.borderColor = '#10B981';
            setTimeout(() => {
                btn.innerHTML = original;
                btn.style.borderColor = '';
            }, 2000);
        }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
            fallbackCopy(text, onSuccess);
        });
    } else {
        fallbackCopy(text, onSuccess);
    }
}

function fallbackCopy(text, cb) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (cb) cb();
    } catch (e) {
        showToast('Gagal menyalin otomatis. Silakan salin manual.', 'warn');
    }
}

// Rupiah & Date Formatters
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number || 0);
}

function formatDate(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Modal Management
function openOrderModal(platform = 'Saweria', price = 'Rp 450.000') {
    const modal = document.getElementById('order-modal');
    if (!modal) return;
    
    const platformEl = document.getElementById('modal-platform-name');
    const priceEl = document.getElementById('modal-price-display');
    if (platformEl) platformEl.textContent = platform;
    if (priceEl) priceEl.textContent = price;

    modal.classList.add('is-active');
}

function closeModal(modalId = 'order-modal') {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('is-active');
    }
}

// FAQ Accordion
function toggleFaq(headEl) {
    const item = headEl.closest('.faq-item');
    if (item) {
        item.classList.toggle('is-open');
    }
}

// Live In-Game Roblox Alert Simulator
function runSimAlert() {
    const donorInput = document.getElementById('sim-donor-input');
    const amountInput = document.getElementById('sim-amount-input');
    const msgInput = document.getElementById('sim-msg-input');
    const screen = document.getElementById('sim-screen-container');

    const donor = (donorInput && donorInput.value.trim()) || 'SultanRoblox_VIP';
    const amount = (amountInput && parseInt(amountInput.value)) || 100000;
    const msg = (msgInput && msgInput.value.trim()) || 'Semoga gamenya makin rame bang! 🔥';

    if (!screen) return;

    // Trigger visual pop-up inside simulator
    screen.innerHTML = `
        <div class="roblox-notif">
            <div class="roblox-notif-title">⭐ SAWERIA DONATION ALERT ⭐</div>
            <div class="roblox-notif-donor">${donor}</div>
            <div class="roblox-notif-amount">${formatRupiah(amount)}</div>
            <div class="roblox-notif-msg">"${msg}"</div>
            <div style="margin-top: 8px; font-size: 11px; color: #94A3B8;">✨ Orbit Camera VFX &amp; Leaderboard Synced!</div>
        </div>
    `;

    showToast(`Donasi dari ${donor} (${formatRupiah(amount)}) berhasil disimulasikan!`, 'success');
}

// Auth Manager
const Auth = {
    getToken() {
        return localStorage.getItem('auth_token');
    },
    getUser() {
        try {
            return JSON.parse(localStorage.getItem('auth_user') || 'null');
        } catch {
            return null;
        }
    },
    setAuth(token, user) {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    },
    clearAuth() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    },
    isLoggedIn() {
        return !!this.getToken();
    },
    isAdmin() {
        const user = this.getUser();
        return user && user.role === 'admin';
    },
    async logout() {
        const token = this.getToken();
        if (token) {
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {}
        }
        this.clearAuth();
        window.location.href = '/login.html';
    },
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    },
    requireAdmin() {
        if (!this.isLoggedIn() || !this.isAdmin()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }
};

// Universal API Client
const API = {
    async request(url, options = {}) {
        const token = Auth.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const res = await fetch(url, { ...options, headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || data.error || `HTTP Error ${res.status}`);
            }
            return data;
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    },
    get(url, options) {
        return this.request(url, { ...options, method: 'GET' });
    },
    post(url, body, options) {
        return this.request(url, { ...options, method: 'POST', body: JSON.stringify(body) });
    },
    put(url, body, options) {
        return this.request(url, { ...options, method: 'PUT', body: JSON.stringify(body) });
    },
    delete(url, options) {
        return this.request(url, { ...options, method: 'DELETE' });
    }
};

// Floating Live Chat Widget for Website Support
function initLiveChatWidget() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('kidzy-live-chat-widget') || window.location.pathname.startsWith('/admin')) return;

    const widget = document.createElement('div');
    widget.id = 'kidzy-live-chat-widget';
    widget.innerHTML = `
        <button class="live-chat-bubble-btn" id="chat-toggle-btn" onclick="toggleLiveChatBox()" aria-label="Open Live Chat">
            <span id="chat-btn-icon">💬</span>
            <span class="live-chat-ping"></span>
        </button>

        <div class="live-chat-box" id="live-chat-box">
            <div class="live-chat-box-head">
                <div class="row" style="gap: 10px; align-items: center;">
                    <div class="live-chat-head-avatar">👑</div>
                    <div>
                        <b style="font-size: 14px; color: #FFFFFF;">KIDZY Live Support</b>
                        <div style="font-size: 11px; color: #34D399; display: flex; align-items: center; gap: 4px;">
                            <span style="width: 6px; height: 6px; border-radius: 50%; background: #10B981; display: inline-block;"></span> Online &bull; Hubungkan ke Owner
                        </div>
                    </div>
                </div>
                <button class="modal-close" style="position: static; width: 28px; height: 28px; font-size: 16px;" onclick="toggleLiveChatBox()">&times;</button>
            </div>

            <div class="live-chat-box-body" id="live-chat-feed">
                <div class="chat-bubble is-admin" style="max-width: 90%;">
                    <div class="chat-avatar">👑</div>
                    <div class="chat-bubble-body" style="font-size: 13px;">
                        Halo! Ada yang bisa kami bantu seputar aktivasi Saweria / BagiBagi Roblox kamu? Silakan tinggalkan pesan di sini! ✨
                    </div>
                </div>
            </div>

            <form class="live-chat-box-footer" onsubmit="handleSendPublicChat(event)">
                <input class="input" id="live-chat-input" placeholder="Ketik pesan kamu..." style="font-size: 13px; height: 38px;" required autocomplete="off" />
                <button class="btn btn-primary btn-sm" type="submit" style="height: 38px; padding: 0 14px;">Kirim</button>
            </form>
        </div>
    `;

    document.body.appendChild(widget);
}

function toggleLiveChatBox() {
    const box = document.getElementById('live-chat-box');
    if (box) {
        box.classList.toggle('is-open');
        if (box.classList.contains('is-open')) {
            const input = document.getElementById('live-chat-input');
            if (input) setTimeout(() => input.focus(), 150);
        }
    }
}

async function handleSendPublicChat(e) {
    e.preventDefault();
    const input = document.getElementById('live-chat-input');
    const text = input.value.trim();
    if (!text) return;

    const feed = document.getElementById('live-chat-feed');
    input.value = '';

    // Append user message immediately
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble';
    userBubble.style.alignSelf = 'flex-end';
    userBubble.innerHTML = `
        <div class="chat-bubble-body" style="background: rgba(99, 102, 241, 0.25); border-color: rgba(99, 102, 241, 0.5); font-size: 13px;">
            ${text}
        </div>
    `;
    feed.appendChild(userBubble);
    feed.scrollTop = feed.scrollHeight;

    try {
        await fetch('/api/chat/web-support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Pengunjung Web', message: text })
        });

        // Bot / owner auto-ack
        setTimeout(() => {
            const replyBubble = document.createElement('div');
            replyBubble.className = 'chat-bubble is-admin';
            replyBubble.innerHTML = `
                <div class="chat-avatar">👑</div>
                <div class="chat-bubble-body" style="font-size: 13px;">
                    Pesan kamu sudah masuk ke Owner! Untuk respon instan, kamu juga bisa langsung DM Discord: <b style="color:#A5B4FC;">kidddzyyaj</b> atau join server kami.
                </div>
            `;
            feed.appendChild(replyBubble);
            feed.scrollTop = feed.scrollHeight;
        }, 1000);
    } catch (err) {
        showToast('Gagal mengirim pesan chat', 'error');
    }
}

// Auto close modal on backdrop click & auto init widget
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        document.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
                e.target.classList.remove('is-active');
            }
        });
        initLiveChatWidget();
    });
}

// Global alias for compatibility & window exports
const apiFetch = (url, options) => API.request(url, options);

if (typeof window !== 'undefined') {
    window.API = API;
    window.Auth = Auth;
    window.apiFetch = apiFetch;
    window.showToast = showToast;
    window.copyText = copyText;
    window.formatRupiah = formatRupiah;
    window.formatDate = formatDate;
    window.openOrderModal = openOrderModal;
    window.closeModal = closeModal;
    window.toggleFaq = toggleFaq;
    window.toggleMobileNav = toggleMobileNav;
    window.toggleTheme = toggleTheme;
    window.runSimAlert = runSimAlert;
    window.toggleLiveChatBox = toggleLiveChatBox;
    window.handleSendPublicChat = handleSendPublicChat;
}
