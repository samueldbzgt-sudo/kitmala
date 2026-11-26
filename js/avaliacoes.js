/* Avaliações publicadas no produto de origem, com fotos e navegação locais. */
(() => {
  'use strict';
  const section = document.querySelector('[data-local-reviews]');
  if (!section) return;
  const grid = section.querySelector('[data-review-grid]');
  const filter = section.querySelector('[data-review-filter]');
  const empty = section.querySelector('[data-review-empty]');
  const cards = [...grid.querySelectorAll('[data-review-card]')].sort((a, b) => Number(a.dataset.reviewOrder) - Number(b.dataset.reviewOrder));
  const columnClass = grid.firstElementChild.className;
  let lastColumns = 0;
  filter.value = 'published';

  function columns() { return innerWidth < 1200 ? 2 : 4; }
  function matches(card) {
    if (filter.value === 'withImages') return card.dataset.reviewImages === '1';
    if (filter.value === 'withoutImages') return card.dataset.reviewImages === '0';
    if (/^[1-5]star$/.test(filter.value)) return Number(card.dataset.reviewRating) === Number(filter.value[0]);
    return true;
  }
  function layout() {
    const count = columns();
    const shown = cards.filter(matches);
    const containers = Array.from({ length: count }, () => {
      const element = document.createElement('div');
      element.className = columnClass;
      element.dataset.reviewColumn = '';
      element.setAttribute('role', 'presentation');
      return element;
    });
    shown.forEach((card, index) => containers[index % count].appendChild(card));
    grid.replaceChildren(...containers);
    grid.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;
    grid.hidden = shown.length === 0;
    empty.hidden = shown.length > 0;
    lastColumns = count;
  }
  filter.addEventListener('change', layout);
  window.addEventListener('resize', () => { if (columns() !== lastColumns) layout(); });
  layout();

  const dialog = document.createElement('dialog');
  dialog.id = 'cl-review-dialog';
  dialog.className = 'bk-reviews cl-review-dialog';
  dialog.setAttribute('aria-labelledby', 'cl-review-dialog-title');
  dialog.innerHTML = '<button type="button" class="cl-review-dialog-close" aria-label="Fechar avaliação">×</button><div class="cl-review-dialog-frame"><img class="cl-review-dialog-photo" alt="" hidden><div class="cl-review-dialog-copy"><div class="cl-review-dialog-stars" role="img"></div><h2 id="cl-review-dialog-title"></h2><p></p></div></div>';
  document.body.appendChild(dialog);
  let previousFocus;
  function close() { dialog.close(); }
  function open(id, trigger) {
    const card = cards.find(item => item.dataset.reviewCard === id);
    if (!card) return;
    const author = card.querySelector('span.tw-font-bold').textContent.trim();
    const image = card.querySelector('img');
    const photo = dialog.querySelector('img');
    if (image) { photo.src = image.src; photo.alt = image.alt; photo.hidden = false; }
    else { photo.removeAttribute('src'); photo.hidden = true; }
    dialog.querySelector('h2').textContent = `Avaliação de ${author}`;
    dialog.querySelector('p').textContent = card.querySelector('p').textContent.trim();
    const stars = dialog.querySelector('.cl-review-dialog-stars');
    stars.replaceChildren(...[...card.querySelectorAll('svg')].map(svg => svg.cloneNode(true)));
    stars.setAttribute('aria-label', `${card.dataset.reviewRating} de 5 estrelas`);
    previousFocus = trigger;
    document.documentElement.classList.add('cl-review-modal-open');
    dialog.showModal();
    dialog.querySelector('button').focus();
  }
  section.addEventListener('click', event => {
    const trigger = event.target.closest('[data-review-open]');
    if (trigger) { event.preventDefault(); open(trigger.dataset.reviewOpen, trigger); }
  });
  section.addEventListener('keydown', event => {
    const trigger = event.target.closest('[data-review-open][role="button"]');
    if (trigger && ['Enter', ' '].includes(event.key)) { event.preventDefault(); open(trigger.dataset.reviewOpen, trigger); }
  });
  dialog.querySelector('button').addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('cl-review-modal-open');
    previousFocus?.focus({ preventScroll: true });
  });
  section.querySelector('[data-review-write]').addEventListener('click', () => {
    window.CasaLunearNavigation.go('pages/contato.html?assunto=avaliacao#atendimento');
  });
})();
