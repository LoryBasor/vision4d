/**
 * VISION 4D — Frontend JavaScript
 */

'use strict';

/* ─── NAVBAR SCROLL ────────────────────────────────────────── */
const navbar = document.querySelector('.navbar');
if (navbar) {
    const onScroll = () => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

/* ─── HAMBURGER MENU ───────────────────────────────────────── */
const toggle = document.querySelector('.navbar-toggle');
const links  = document.querySelector('.navbar-links');

if (toggle && links) {
    toggle.addEventListener('click', () => {
        links.classList.toggle('open');
        document.body.classList.toggle('no-scroll');

        const spans = toggle.querySelectorAll('span');
        if (links.classList.contains('open')) {
            spans[0].style.transform = 'translateY(7px) rotate(45deg)';
            spans[1].style.opacity   = '0';
            spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
        } else {
            spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
        }
    });

    // Fermer en cliquant sur un lien
    links.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            links.classList.remove('open');
            document.body.classList.remove('no-scroll');
        });
    });
}

/* ─── PAGE LOADER ──────────────────────────────────────────── */
const loader = document.querySelector('.loader-overlay');
if (loader) {
    window.addEventListener('load', () => {
        setTimeout(() => loader.classList.add('hidden'), 400);
    });
}

/* ─── SCROLL ANIMATIONS ────────────────────────────────────── */
const fadeEls = document.querySelectorAll('.fade-in');
if (fadeEls.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('visible'), i * 80);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    fadeEls.forEach(el => observer.observe(el));
}

/* ─── FORMULE SELECTOR ─────────────────────────────────────── */
const formuleCards = document.querySelectorAll('.formule-card[data-formule]');
const formuleInput = document.getElementById('formule_id');

formuleCards.forEach(card => {
    card.addEventListener('click', () => {
        formuleCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (formuleInput) formuleInput.value = card.dataset.formule;
        updateSimulation();
    });
});

/* ─── TRANCHE SELECTOR ─────────────────────────────────────── */
const trancheButtons = document.querySelectorAll('.tranche-btn');
const trancheInput   = document.getElementById('nombre_tranches');

trancheButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        trancheButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (trancheInput) trancheInput.value = btn.dataset.tranches;
        updateSimulation();
    });
});

/* ─── SIMULATION DE PAIEMENT ────────────────────────────────── */
function updateSimulation() {
    const selectedCard = document.querySelector('.formule-card.selected');
    const selectedBtn  = document.querySelector('.tranche-btn.active');

    if (!selectedCard || !selectedBtn) return;

    const prix           = parseFloat(selectedCard.dataset.prix) || 0;
    const tranches       = parseInt(selectedBtn.dataset.tranches) || 1;
    const frais          = parseFloat(selectedBtn.dataset.frais)  || 0;
    const totalAvecFrais = prix * (1 + frais / 100);
    const parTranche     = Math.ceil(totalAvecFrais / tranches);

    const elTotal    = document.getElementById('sim-total');
    const elTranche  = document.getElementById('sim-par-tranche');
    const elFrais    = document.getElementById('sim-frais');
    const elNb       = document.getElementById('sim-nb');

    if (elTotal)   elTotal.textContent   = formatXAF(totalAvecFrais);
    if (elTranche) elTranche.textContent = formatXAF(parTranche);
    if (elFrais)   elFrais.textContent   = `${frais}%`;
    if (elNb)      elNb.textContent      = `${tranches} tranche${tranches > 1 ? 's' : ''}`;

    const simBox = document.getElementById('simulation-box');
    if (simBox) {
        simBox.style.display = 'block';
        simBox.style.animation = 'none';
        simBox.offsetHeight; // reflow
        simBox.style.animation = 'fadeSlide .3s ease';
    }
}

/* ─── COUNTER ANIMATION ────────────────────────────────────── */
function animateCounter(el) {
    const target = parseFloat(el.dataset.target) || 0;
    const duration = 1200;
    const start = performance.now();

    const update = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);
        el.textContent = el.dataset.suffix
            ? current + el.dataset.suffix
            : formatXAF(current);
        if (progress < 1) requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
}

document.querySelectorAll('[data-counter]').forEach(el => {
    const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
            animateCounter(el);
            obs.unobserve(el);
        }
    }, { threshold: .5 });
    obs.observe(el);
});

/* ─── ALERT AUTO-DISMISS ───────────────────────────────────── */
document.querySelectorAll('.alert').forEach(alert => {
    setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transform = 'translateY(-10px)';
        alert.style.transition = 'all .4s ease';
        setTimeout(() => alert.remove(), 400);
    }, 4500);
});

/* ─── CONFIRM DELETE ────────────────────────────────────────── */
document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', (e) => {
        if (!confirm(el.dataset.confirm || 'Confirmer cette action ?')) {
            e.preventDefault();
        }
    });
});

/* ─── IMAGE PREVIEW ─────────────────────────────────────────── */
const imageInputs = document.querySelectorAll('input[type="file"][data-preview]');
imageInputs.forEach(input => {
    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        const preview = document.getElementById(input.dataset.preview);
        if (!preview) return;
        const reader = new FileReader();
        reader.onload = e => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
});

/* ─── PASSWORD TOGGLE ───────────────────────────────────────── */
document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.querySelector(btn.dataset.target);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁';
    });
});

/* ─── UTILS ─────────────────────────────────────────────────── */
function formatXAF(amount) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
}

/* Keyframes dynamiques */
const style = document.createElement('style');
style.textContent = `
@keyframes fadeSlide {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(style);
