/**
 * KIDZY / Rafly Store — Core Client Logic
 */

// Theme Management
(function initTheme() {
    const saved = localStorage.getItem('app_theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
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
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warn') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

// Copy to Clipboard
function copyText(text, btn) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Tersalin ke clipboard!', 'success');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '✓ Tersalin';
            setTimeout(() => {
                btn.innerHTML = original;
            }, 1800);
        }
    }).catch(err => {
        showToast('Gagal menyalin: ' + err.message, 'error');
    });
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
        if (!this.isLoggedIn()) {
            window.location.href = '/login.html';
            return false;
        }
        if (!this.isAdmin()) {
            window.location.href = '/';
            return false;
        }
        return true;
    }
};

// API Fetch Helper with Auth Headers
async function apiFetch(url, options = {}) {
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
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || data.error || 'Terjadi kesalahan pada server');
        }
        return data;
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
}

// Global Nav User Info setup
document.addEventListener('DOMContentLoaded', () => {
    const user = Auth.getUser();
    const navAuthContainer = document.getElementById('nav-auth');
    if (navAuthContainer) {
        if (user) {
            navAuthContainer.innerHTML = `
                ${user.role === 'admin' ? '<a class="btn btn-sm btn-primary" href="/admin/index.html">Dashboard Admin</a>' : '<span class="small font-bold">' + user.name + '</span>'}
                <button class="btn btn-sm btn-ghost" onclick="Auth.logout()">Keluar</button>
            `;
        } else {
            navAuthContainer.innerHTML = `
                <a class="nav-link" href="/login.html">Login</a>
                <a class="btn btn-sm btn-primary" href="/register.html">Register</a>
            `;
        }
    }
});

