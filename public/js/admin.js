/**
 * VISION 4D — JavaScript Panel Admin
 */

'use strict';

/* ─── SIDEBAR TOGGLE (MOBILE) ──────────────────────────────── */
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.querySelector('.sidebar');

if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Fermer en cliquant hors de la sidebar
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

/* ─── ALERT AUTO-DISMISS ───────────────────────────────────── */
document.querySelectorAll('.alert').forEach(alert => {
    const close = alert.querySelector('.alert-close');
    if (close) close.addEventListener('click', () => alert.remove());

    setTimeout(() => {
        alert.style.opacity    = '0';
        alert.style.transition = 'opacity .4s ease';
        setTimeout(() => alert.remove(), 400);
    }, 4000);
});

/* ─── CONFIRM DELETE ────────────────────────────────────────── */
document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', (e) => {
        if (!confirm(el.dataset.confirm || 'Confirmer la suppression ?')) {
            e.preventDefault();
        }
    });
});

/* ─── ACTIVE NAV ────────────────────────────────────────────── */
const currentPath = window.location.pathname;
document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    if (href && currentPath.startsWith(href) && href !== '/admin') {
        item.classList.add('active');
    } else if (href === '/admin/dashboard' && currentPath === '/admin/dashboard') {
        item.classList.add('active');
    }
});

/* ─── IMAGE UPLOAD PREVIEW ─────────────────────────────────── */
document.querySelectorAll('.upload-zone').forEach(zone => {
    const input   = zone.querySelector('input[type="file"]');
    const preview = zone.querySelector('.upload-preview');
    const text    = zone.querySelector('.upload-text');

    if (!input) return;

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--teal)';
        zone.style.background  = 'rgba(92,191,190,.04)';
    });

    zone.addEventListener('dragleave', () => {
        zone.style.borderColor = '';
        zone.style.background  = '';
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = '';
        zone.style.background  = '';
        const file = e.dataTransfer.files[0];
        if (file) showPreview(file);
    });

    input.addEventListener('change', () => {
        if (input.files[0]) showPreview(input.files[0]);
    });

    function showPreview(file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (preview) {
                preview.src     = e.target.result;
                preview.style.display = 'block';
            }
            if (text) text.textContent = file.name;
        };
        reader.readAsDataURL(file);
    }
});

/* ─── SEARCH DEBOUNCE ───────────────────────────────────────── */
const searchInput = document.getElementById('search-input');
if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const form = searchInput.closest('form');
            if (form) form.submit();
        }, 500);
    });
}

/* ─── TARIFS EDITOR ─────────────────────────────────────────── */
document.querySelectorAll('.tarif-row input[type="number"]').forEach(input => {
    input.addEventListener('input', () => {
        const row    = input.closest('.tarif-row');
        const prixEl = row.querySelector('[data-base-prix]');
        const resEl  = row.querySelector('.tarif-result');
        if (!prixEl || !resEl) return;
        const prix   = parseFloat(prixEl.dataset.basePrix) || 0;
        const frais  = parseFloat(input.value) || 0;
        const total  = prix * (1 + frais / 100);
        resEl.textContent = Math.round(total).toLocaleString('fr-FR') + ' FCFA';
    });
});

/* ─── UTILS ─────────────────────────────────────────────────── */
function formatDate(d) {
    return new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

// Initialiser les dates
document.querySelectorAll('[data-date]').forEach(el => {
    el.textContent = formatDate(el.dataset.date);
});
