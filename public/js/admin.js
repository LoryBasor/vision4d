/**
 * VISION 4D — JavaScript Panel Admin
 * Mobile-first, animations, sidebar responsive
 */

'use strict';

document.addEventListener('DOMContentLoaded', function() {

    /* ─── SIDEBAR MOBILE ────────────────────────────────────── */
    var toggle   = document.getElementById('sidebarToggle');
    var sidebar  = document.getElementById('adminSidebar');
    var overlay  = document.getElementById('sidebarOverlay');

    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('open');
        if (overlay) {
            overlay.style.display = 'block';
            setTimeout(function() { overlay.classList.add('active'); }, 10);
        }
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('open');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(function() { overlay.style.display = 'none'; }, 300);
        }
        document.body.style.overflow = '';
    }

    if (toggle)  toggle.addEventListener('click', openSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // Fermer avec Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeSidebar();
    });

    // Fermer quand on clique un lien sur mobile
    if (sidebar) {
        sidebar.querySelectorAll('.nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                if (window.innerWidth <= 900) closeSidebar();
            });
        });
    }

    /* ─── ACTIVE NAV ────────────────────────────────────────── */
    var currentPath = window.location.pathname;
    document.querySelectorAll('.nav-item').forEach(function(item) {
        var href = item.getAttribute('href') || '';
        if (href && href !== '/' && currentPath.startsWith(href)) {
            item.classList.add('active');
        } else if (href === '/admin/dashboard' && currentPath === '/admin/dashboard') {
            item.classList.add('active');
        }
    });

    /* ─── ALERT AUTO-DISMISS ────────────────────────────────── */
    document.querySelectorAll('.alert').forEach(function(alert) {
        setTimeout(function() {
            alert.style.transition = 'opacity .4s ease, transform .4s ease';
            alert.style.opacity    = '0';
            alert.style.transform  = 'translateY(-6px)';
            setTimeout(function() { if (alert.parentNode) alert.parentNode.removeChild(alert); }, 400);
        }, 4500);
    });

    /* ─── CONFIRM DELETE ────────────────────────────────────── */
    document.querySelectorAll('[data-confirm]').forEach(function(el) {
        el.addEventListener('click', function(e) {
            if (!confirm(el.dataset.confirm || 'Confirmer cette action ?')) {
                e.preventDefault();
            }
        });
    });

    /* ─── TABLES — scroll indicator ─────────────────────────── */
    document.querySelectorAll('.table-card').forEach(function(card) {
        var table = card.querySelector('table');
        if (!table) return;
        // Rendre la table scrollable
        if (!card.querySelector('.table-responsive')) {
            var wrapper = document.createElement('div');
            wrapper.className = 'table-responsive';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });

    /* ─── IMAGE UPLOAD PREVIEW (articles, produits) ─────────── */
    var adminAvatarInput = document.getElementById('adminAvatarInput');
    if (adminAvatarInput) {
        adminAvatarInput.addEventListener('change', function() {
            var file = this.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { alert('Maximum 5 Mo.'); this.value = ''; return; }
            var fnEl = document.getElementById('admin-avatar-filename');
            if (fnEl) { fnEl.textContent = '✅ ' + file.name; fnEl.style.color = 'var(--teal)'; }
            var reader = new FileReader();
            reader.onload = function(e) {
                var src = e.target.result;
                var wrap = document.getElementById('admin-avatar-wrap');
                var img  = document.getElementById('admin-avatar-img');
                var init = document.getElementById('admin-avatar-initials');
                if (wrap) {
                    if (!img) {
                        img = document.createElement('img');
                        img.id = 'admin-avatar-img';
                        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                        wrap.appendChild(img);
                    }
                    img.src = src; img.style.display = 'block';
                    if (init) init.style.display = 'none';
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // Preview image pour articles et produits
    document.querySelectorAll('input[type="file"][name="image"]').forEach(function(input) {
        input.addEventListener('change', function() {
            var file = this.files[0];
            if (!file) return;
            var preview = document.getElementById('image-preview');
            if (!preview) {
                preview = document.createElement('img');
                preview.id = 'image-preview';
                preview.style.cssText = 'max-width:200px;max-height:120px;object-fit:cover;border-radius:8px;margin-top:8px;display:block;';
                this.parentNode.appendChild(preview);
            }
            var reader = new FileReader();
            reader.onload = function(e) { preview.src = e.target.result; preview.style.display = 'block'; };
            reader.readAsDataURL(file);
        });
    });

    /* ─── COUNTERS ANIMÉS ────────────────────────────────────── */
    if ('IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                var el     = entry.target;
                var target = parseFloat(el.dataset.counter) || 0;
                var suffix = el.dataset.suffix || '';
                var start  = performance.now();
                var dur    = 1000;
                function update(now) {
                    var p = Math.min((now - start) / dur, 1);
                    var e = 1 - Math.pow(1 - p, 3);
                    el.textContent = Math.round(e * target).toLocaleString('fr-FR') + suffix;
                    if (p < 1) requestAnimationFrame(update);
                }
                requestAnimationFrame(update);
                obs.unobserve(el);
            });
        }, { threshold: 0.5 });
        document.querySelectorAll('[data-counter]').forEach(function(el) { obs.observe(el); });
    }

    /* ─── STAT CARDS ANIMATION ───────────────────────────────── */
    document.querySelectorAll('.stat-card').forEach(function(card, i) {
        card.style.animationDelay = (i * 0.08) + 's';
    });

});
