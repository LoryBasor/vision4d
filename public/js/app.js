/**
 * VISION 4D — Frontend JavaScript
 * Mobile-first, animations fluides
 */

'use strict';

document.addEventListener('DOMContentLoaded', function() {

    /* ─── NAVBAR SCROLL ──────────────────────────────────────── */
    var navbar = document.getElementById('mainNav');
    if (navbar) {
        function onScroll() {
            navbar.classList.toggle('scrolled', window.scrollY > 60);
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ─── DRAWER MOBILE ──────────────────────────────────────── */
    var drawerToggle  = document.getElementById('drawerToggle');
    var drawer        = document.getElementById('mobileDrawer');
    var drawerClose   = document.getElementById('drawerClose');
    var drawerBackdrop= document.getElementById('drawerBackdrop');

    function openDrawer() {
        if (!drawer) return;
        drawer.style.display = 'block';
        // Force reflow pour que la transition s'applique
        drawer.offsetHeight;
        drawer.classList.add('is-open');
        if (drawerToggle) {
            drawerToggle.classList.add('is-open');
            drawerToggle.setAttribute('aria-expanded', 'true');
        }
        document.body.classList.add('drawer-open');
    }

    function closeDrawer() {
        if (!drawer) return;
        drawer.classList.remove('is-open');
        if (drawerToggle) {
            drawerToggle.classList.remove('is-open');
            drawerToggle.setAttribute('aria-expanded', 'false');
        }
        document.body.classList.remove('drawer-open');
        // Cacher après la transition
        setTimeout(function() {
            if (!drawer.classList.contains('is-open')) {
                drawer.style.display = 'none';
            }
        }, 350);
    }

    if (drawerToggle)   drawerToggle.addEventListener('click', openDrawer);
    if (drawerClose)    drawerClose.addEventListener('click', closeDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

    // Fermer avec Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
            closeDrawer();
        }
    });

    // Fermer en cliquant un lien du drawer
    if (drawer) {
        drawer.querySelectorAll('a').forEach(function(a) {
            a.addEventListener('click', closeDrawer);
        });
    }

    /* ─── PAGE LOADER ────────────────────────────────────────── */
    var loader = document.querySelector('.loader-overlay');
    if (loader) {
        window.addEventListener('load', function() {
            setTimeout(function() { loader.classList.add('hidden'); }, 300);
        });
    }

    /* ─── SCROLL ANIMATIONS (Intersection Observer) ─────────── */
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry, i) {
                if (entry.isIntersecting) {
                    var el = entry.target;
                    // Délai progressif pour les éléments dans une grille
                    var siblings = el.parentElement ? el.parentElement.querySelectorAll('.fade-in') : [];
                    var idx = Array.prototype.indexOf.call(siblings, el);
                    setTimeout(function() {
                        el.classList.add('visible');
                    }, idx * 80);
                    observer.unobserve(el);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.fade-in').forEach(function(el) {
            observer.observe(el);
        });
    } else {
        // Fallback si pas d'IntersectionObserver
        document.querySelectorAll('.fade-in').forEach(function(el) {
            el.classList.add('visible');
        });
    }

    /* ─── COUNTERS ANIMÉS ────────────────────────────────────── */
    var counterObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (!entry.isIntersecting) return;
            var el     = entry.target;
            var target = parseFloat(el.dataset.target) || 0;
            var suffix = el.dataset.suffix || '';
            var start  = performance.now();
            var dur    = 1400;

            function update(now) {
                var progress = Math.min((now - start) / dur, 1);
                var eased    = 1 - Math.pow(1 - progress, 3);
                var val      = Math.round(eased * target);
                el.textContent = val.toLocaleString('fr-FR') + suffix;
                if (progress < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
            counterObserver.unobserve(el);
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-counter]').forEach(function(el) {
        counterObserver.observe(el);
    });

    /* ─── ALERT AUTO-DISMISS ─────────────────────────────────── */
    document.querySelectorAll('.alert').forEach(function(alert) {
        setTimeout(function() {
            alert.style.transition = 'opacity .4s ease, transform .4s ease';
            alert.style.opacity    = '0';
            alert.style.transform  = 'translateY(-8px)';
            setTimeout(function() { if (alert.parentNode) alert.parentNode.removeChild(alert); }, 400);
        }, 4500);
    });

    /* ─── CONFIRM DELETE ─────────────────────────────────────── */
    document.querySelectorAll('[data-confirm]').forEach(function(el) {
        el.addEventListener('click', function(e) {
            if (!confirm(el.dataset.confirm || 'Confirmer cette action ?')) {
                e.preventDefault();
            }
        });
    });

    /* ─── IMAGE PREVIEW (upload avatar) ─────────────────────── */
    var avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', function() {
            var file = this.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                alert('La photo est trop grande. Maximum 5 Mo.');
                this.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function(e) {
                var src = e.target.result;
                // Grand avatar
                var mainWrap = document.getElementById('main-avatar-wrap');
                var mainImg  = document.getElementById('main-avatar-img');
                var mainInit = document.getElementById('main-avatar-initials');
                if (mainWrap) {
                    if (!mainImg) {
                        mainImg = document.createElement('img');
                        mainImg.id = 'main-avatar-img';
                        mainImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                        mainWrap.appendChild(mainImg);
                    }
                    mainImg.src = src;
                    mainImg.style.display = 'block';
                    if (mainInit) mainInit.style.display = 'none';
                }
                // Petit preview formulaire
                var formPrev = document.getElementById('form-avatar-preview');
                var formInit = document.getElementById('form-avatar-initials');
                if (formPrev) {
                    formPrev.src = src;
                    formPrev.style.display = 'block';
                    if (formInit) formInit.style.display = 'none';
                }
                // Nom du fichier
                var fnEl = document.getElementById('avatar-filename');
                if (fnEl) { fnEl.textContent = '✅ ' + file.name; fnEl.style.color = 'var(--teal)'; }
            };
            reader.readAsDataURL(file);
        });
    }

    /* ─── PASSWORD TOGGLE ────────────────────────────────────── */
    document.querySelectorAll('.pw-toggle').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var target = document.querySelector(btn.dataset.target);
            if (!target) return;
            var show = target.type === 'password';
            target.type     = show ? 'text' : 'password';
            btn.textContent = show ? '🙈' : '👁 Afficher';
        });
    });

    /* ─── FORMULE SELECTOR ───────────────────────────────────── */
    var formulesGrid = document.getElementById('formules-grid');
    if (formulesGrid) {
        formulesGrid.addEventListener('click', function(e) {
            var card = e.target.closest('[data-formule-id]');
            if (!card) return;
            formulesGrid.querySelectorAll('[data-formule-id]').forEach(function(c) {
                c.classList.remove('selected');
            });
            card.classList.add('selected');
            var fIdEl = document.getElementById('formule_id');
            if (fIdEl) fIdEl.value = card.dataset.formuleId;
            window._selectedFormulePrix = parseFloat(card.dataset.prix) || 0;
            window._selectedFormuleName = (card.querySelector('.formule-name') || {}).textContent || '';
            if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
        });
    }

    /* ─── TRANCHE SELECTOR ───────────────────────────────────── */
    var tranchesGrid = document.getElementById('tranches-grid');
    if (tranchesGrid) {
        // Sélectionner 1 tranche par défaut
        var first = tranchesGrid.querySelector('[data-nb]');
        if (first) {
            first.style.borderColor = 'var(--teal)';
            first.style.background  = 'rgba(92,191,190,.08)';
            first.style.color       = 'var(--teal)';
        }
        tranchesGrid.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-nb]');
            if (!btn) return;
            tranchesGrid.querySelectorAll('[data-nb]').forEach(function(b) {
                b.style.borderColor = 'var(--gray-200)';
                b.style.background  = 'var(--white)';
                b.style.color       = 'var(--navy)';
            });
            btn.style.borderColor = 'var(--teal)';
            btn.style.background  = 'rgba(92,191,190,.08)';
            btn.style.color       = 'var(--teal)';
            window._selectedTranches = parseInt(btn.dataset.nb) || 1;
            window._selectedFrais    = parseFloat(btn.dataset.frais) || 0;
            var nbEl = document.getElementById('nombre_tranches');
            if (nbEl) nbEl.value = window._selectedTranches;
            if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
        });
    }

    /* ─── SUBSCRIPTION UI UPDATE ────────────────────────────── */
    window._selectedFormulePrix = 0;
    window._selectedFormuleName = '';
    window._selectedTranches    = 1;
    window._selectedFrais       = 0;

    window.updateSubscriptionUI = function() {
        var prix = window._selectedFormulePrix;
        var nb   = window._selectedTranches;
        var frais= window._selectedFrais;
        var btn  = document.getElementById('submitBtn');
        var help = document.getElementById('help-msg');
        var sim  = document.getElementById('simulation-box');

        if (!prix) {
            if (btn)  { btn.disabled = true; btn.style.opacity = '.5'; btn.style.cursor = 'not-allowed'; }
            if (help) help.style.display = 'block';
            if (sim)  sim.style.display  = 'none';
            return;
        }

        var total = prix * (1 + frais / 100);
        var par   = Math.ceil(total / nb);

        if (document.getElementById('sim-total'))       document.getElementById('sim-total').textContent       = Math.round(total).toLocaleString('fr-FR') + ' FCFA';
        if (document.getElementById('sim-par-tranche')) document.getElementById('sim-par-tranche').textContent = par.toLocaleString('fr-FR') + ' FCFA';
        if (document.getElementById('sim-frais'))       document.getElementById('sim-frais').textContent       = frais + '%';
        if (document.getElementById('sim-nb'))          document.getElementById('sim-nb').textContent          = nb + ' tranche' + (nb > 1 ? 's' : '');
        if (document.getElementById('sim-formule'))     document.getElementById('sim-formule').textContent     = 'Canal+ ' + window._selectedFormuleName;

        if (sim)  sim.style.display  = 'block';
        if (help) help.style.display = 'none';

        if (btn) {
            btn.disabled      = false;
            btn.style.opacity = '1';
            btn.style.cursor  = 'pointer';
            btn.textContent   = '💳 Payer la 1ère tranche — ' + par.toLocaleString('fr-FR') + ' FCFA';
        }
    };

    /* ─── SMOOTH SCROLL pour ancres ─────────────────────────── */
    document.querySelectorAll('a[href^="#"]').forEach(function(a) {
        a.addEventListener('click', function(e) {
            var target = document.querySelector(a.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

});
