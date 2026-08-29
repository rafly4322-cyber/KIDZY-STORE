/**
 * KIDZY Store — Universal Modern Client Library (2026 Edition)
 * Background: #08090D | Card: #11131A | Accent: Violet / Electric Blue / Cyan
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

// Toast Notifications
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
    toast.style.cssText = 'pointer-events: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.6); transition: all 0.3s ease;';
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warn') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Copy to Clipboard (with universal fallback)
function copyText(text, btn) {
    if (!text || text.includes('Loading')) return;
    
    function onSuccess() {
        showToast('Tersalin ke clipboard!', 'success');
        if (btn) {
            const original = btn.textContent;
            btn.textContent = '✨ Tersalin!';
            setTimeout(() => {
                btn.textContent = original;
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

// Format Rupiah
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
    setToken(token) {
        localStorage.setItem('auth_token', token);
    },
    setUser(user) {
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

// Global alias for compatibility
const apiFetch = (url, options) => API.request(url, options);
