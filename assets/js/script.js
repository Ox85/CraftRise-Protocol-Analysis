(function () {
  'use strict';

  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressBar.style.width = '0%';
  document.body.appendChild(progressBar);

  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + '%';
  }

  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const block = btn.closest('.code-block');
      const pre = block ? block.querySelector('pre code') : null;
      if (!pre) return;
      navigator.clipboard.writeText(pre.innerText).then(function () {
        btn.classList.add('copied');
        btn.innerHTML = '&#10003; Kopyalandı';
        setTimeout(function () {
          btn.classList.remove('copied');
          btn.innerHTML = '&#128203; Kopyala';
        }, 1800);
      });
    });
  });

  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });

    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });

    sidebar.querySelectorAll('.sidebar-link').forEach(function (link) {
      link.addEventListener('click', function () {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    });
  }

  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const sections = Array.from(document.querySelectorAll('[data-section]'));
  const sidebarLinks = Array.from(document.querySelectorAll('.sidebar-link[href^="#"]'));
  const tocLinks = Array.from(document.querySelectorAll('.toc-list a[href^="#"]'));

  function getActiveSection() {
    const scrollY = window.scrollY + 80;
    let active = null;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= scrollY) {
        active = sections[i].getAttribute('data-section');
      }
    }
    return active;
  }

  function updateActiveLinks() {
    const active = getActiveSection();
    sidebarLinks.forEach(function (link) {
      const href = link.getAttribute('href').slice(1);
      link.classList.toggle('active', href === active);
    });
    tocLinks.forEach(function (link) {
      const href = link.getAttribute('href').slice(1);
      link.classList.toggle('toc-active', href === active);
    });
  }

  const searchData = [];
  sections.forEach(function (sec) {
    const id = sec.getAttribute('data-section');
    const titleEl = sec.querySelector('h2, h3, .section-title');
    const title = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : id;
    const bodyText = sec.textContent.replace(/\s+/g, ' ').toLowerCase();
    searchData.push({ id: id, title: title, body: bodyText });
  });

  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', function () {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        searchResults.classList.remove('open');
        searchResults.innerHTML = '';
        return;
      }

      const hits = searchData.filter(function (item) {
        return item.title.toLowerCase().includes(q) || item.body.includes(q);
      }).slice(0, 8);

      if (hits.length === 0) {
        searchResults.innerHTML = '<div class="search-empty">Sonuç bulunamadı.</div>';
      } else {
        searchResults.innerHTML = hits.map(function (h) {
          const excerpt = getExcerpt(h.body, q);
          return '<a class="search-result-item" href="#' + h.id + '">' +
            '<span class="search-result-title">' + h.title + '</span>' +
            '<span class="search-result-ctx">' + excerpt + '</span>' +
            '</a>';
        }).join('');

        searchResults.querySelectorAll('a').forEach(function (a) {
          a.addEventListener('click', function () {
            searchResults.classList.remove('open');
            searchInput.value = '';
          });
        });
      }

      searchResults.classList.add('open');
    });

    document.addEventListener('click', function (e) {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.remove('open');
      }
    });

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        searchResults.classList.remove('open');
        searchInput.value = '';
      }
    });
  }

  function getExcerpt(body, q) {
    const idx = body.indexOf(q);
    if (idx === -1) return '';
    const start = Math.max(0, idx - 30);
    const end = Math.min(body.length, idx + q.length + 60);
    let excerpt = (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
    return excerpt.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), function (m) {
      return '<mark class="highlight">' + m + '</mark>';
    });
  }

  function onScroll() {
    updateProgress();
    updateActiveLinks();
    if (backToTop) {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.querySelectorAll('a.sidebar-link[href^="#"], a.toc-list a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) {
        e.preventDefault();
        const offset = target.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: offset, behavior: 'smooth' });
      }
    });
  });
})();
