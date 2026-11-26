/* Navegação do funil e acesso aos checkouts configurados para cada kit. */
(() => {
  'use strict';
  if (window.CasaLunearNavigation) return;
  const root = new URL('.', document.baseURI);
  const draftKey = 'casa-lunear:pedido-em-revisao';
  const product = window.MP_OFERTA?.product;
  const checkouts = window.MP_OFERTA?.checkouts || {};
  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  function resolve(value) {
    try {
      if (!value || typeof value !== 'string') return null;
      const url = new URL(value, root);
      if (url.protocol !== root.protocol || url.origin !== root.origin || url.username || url.password) return null;
      if (!url.pathname.startsWith(root.pathname)) return null;
      return url;
    } catch { return null; }
  }
  function resolveCheckout(value) {
    try {
      const url = new URL(value, root);
      return url.protocol === 'https:' && !url.username && !url.password && Object.values(checkouts).includes(url.href) ? url : null;
    } catch { return null; }
  }
  function checkoutLink(variant) { return resolveCheckout(checkouts[String(variant)])?.href || ''; }
  function go(value) { const url = resolve(value) || resolveCheckout(value); if (!url) return false; location.assign(url.href); return true; }
  function readDraft() {
    let data = {};
    try { data = JSON.parse(sessionStorage.getItem(draftKey) || '{}'); } catch {}
    const query = new URL(location.href).searchParams;
    const id = query.get('variant') || query.get('id') || data.variant;
    const variant = product?.variants.find(item => String(item.id) === String(id)) || product?.variants[0];
    let quantity = Number(query.get('quantity') || data.quantity || 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(quantity * (variant?.price || 0))) quantity = 1;
    return { variant, quantity };
  }
  function saveDraft(variant, quantity) {
    const number = Number(quantity);
    const value = { variant: String(variant.id), quantity: Number.isSafeInteger(number) && number > 0 ? number : 1 };
    try { sessionStorage.setItem(draftKey, JSON.stringify(value)); } catch {}
    document.querySelectorAll('[data-local-cart-count]').forEach(el => { el.textContent = value.quantity; });
    return value;
  }
  function currentSelection() {
    const selected = document.querySelector('.product-form__variants input[name="option1"]:checked');
    const radio = document.querySelector('.mpl__opts input:checked');
    const variant = product?.variants.find(v => v.title === selected?.value) || product?.variants.find(v => String(v.id) === radio?.value) || readDraft().variant;
    const quantity = Math.max(1, Math.floor(Number(document.querySelector('.product-form__quantity input[name="quantity"]')?.value) || 1));
    return { variant, quantity };
  }
  function reviewOrder() {
    const selection = currentSelection();
    if (!selection.variant) return go('index.html#oferta');
    const data = saveDraft(selection.variant, selection.quantity);
    return go(checkoutLink(data.variant) || `pages/checkout.html?variant=${encodeURIComponent(data.variant)}&quantity=${data.quantity}`);
  }
  window.CasaLunearNavigation = { root: root.href, resolve, isInternal: value => !!resolve(value), checkoutLink, go, readDraft, saveDraft, reviewOrder };
  const originalOpen = window.open.bind(window);
  window.open = (value, target, features) => { const url = resolve(value) || resolveCheckout(value); return url ? originalOpen(url.href, '_self', features) : null; };
  window.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (link && !resolve(link.getAttribute('href')) && !resolveCheckout(link.getAttribute('href'))) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  function routeForm(form, event) {
    const search = form.matches('.predictive-search__form, [data-local-search]');
    const order = form.matches('.shopify-product-form') || form.querySelector('[data-product-add-to-cart-button], .mpl__btn');
    const contact = form.matches('[data-contact-composer]');
    if (!search && !order && !contact) return false;
    event?.preventDefault();
    if (contact) return true;
    event?.stopImmediatePropagation();
    if (search) {
      const query = form.querySelector('[name="q"]')?.value.trim() || '';
      go('pages/busca.html?q=' + encodeURIComponent(query));
    } else reviewOrder();
    return true;
  }
  window.addEventListener('submit', event => { if (event.target instanceof HTMLFormElement) routeForm(event.target, event); }, true);
  // Formulários auxiliares mantêm o envio nativo, inclusive quando usam um iframe.
  const originalSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () { if (!routeForm(this)) return originalSubmit.call(this); };
  function normalize(text) { return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function matchesProduct(query) { return !query.trim() || normalize(query).split(/\s+/).every(word => normalize(product?.searchText || product?.title || '').includes(word)); }
  function searchPreview(input) {
    const scope = input.closest('.predictive-search, #search-drawer');
    const result = scope?.querySelector('.predictive-search__results');
    if (!result) return;
    scope.querySelectorAll('.predictive-search__loading-state, .drawer__footer').forEach(el => { el.hidden = true; });
    result.replaceChildren();
    if (!input.value.trim()) { result.hidden = true; return; }
    const text = document.createElement(matchesProduct(input.value) ? 'a' : 'p');
    if (text instanceof HTMLAnchorElement) { text.href = new URL('index.html#oferta', root).href; text.className = 'cl-search-result'; text.textContent = `${product.title} — a partir de ${money(product.variants[0].price)}`; }
    else text.textContent = 'Nenhum produto encontrado. Experimente buscar por kit, sacos a vácuo ou bomba.';
    result.appendChild(text); result.hidden = false;
  }
  for (const type of ['input', 'change']) window.addEventListener(type, event => {
    if (event.target instanceof Element && event.target.matches('.predictive-search__form [name="q"]')) { event.stopImmediatePropagation(); searchPreview(event.target); }
  }, true);
  // As bibliotecas do tema continuam locais e os componentes de cabeçalho não
  // precisam das rotas de carrinho da antiga loja para abrir estas páginas.
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, document.baseURI);
      if (/\/cart\.(?:js|json)$/.test(url.pathname)) {
        return Promise.resolve(new Response(JSON.stringify({ item_count: 0, items: [], total_price: 0, currency: 'BRL' }), { headers: { 'Content-Type': 'application/json' } }));
      }
    } catch {}
    return originalFetch(input, options);
  };
  if (window.themeVariables) {
    Object.assign(window.themeVariables.libs, { flickity: new URL('js/flickity.js', root).href, photoswipe: new URL('js/photoswipe.js', root).href });
    Object.assign(window.themeVariables.routes, { host: location.host, rootUrl: root.pathname, rootUrlWithoutSlash: root.pathname.replace(/\/$/, ''), cartUrl: new URL('cart', root).href, searchUrl: new URL('pages/busca.html', root).href });
  }
  async function copyText(text, status, success) {
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true; } } catch {}
    if (!copied) {
      const field = document.createElement('textarea'); field.value = text; field.setAttribute('readonly', ''); field.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(field); field.select();
      try { copied = document.execCommand('copy'); } catch {} field.remove();
    }
    if (status) status.textContent = copied ? success : 'Selecione e copie o texto na página; a cópia automática não ficou disponível.';
  }
  function ready() {
    let stored; try { stored = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); } catch {}
    document.querySelectorAll('[data-local-cart-count]').forEach(el => { el.textContent = stored?.quantity || 0; });
    document.querySelectorAll('[data-copy-email]').forEach(button => button.addEventListener('click', () => copyText('contato@vonnix.store', document.querySelector('[data-contact-status]'), 'E-mail de atendimento copiado.')));
    const composer = document.querySelector('[data-contact-composer]');
    if (composer) {
      const query = new URL(location.href).searchParams;
      const subject = composer.querySelector('[name="assunto"]');
      if (['pedido', 'rastreamento', 'compra', 'privacidade', 'troca', 'avaliacao'].includes(query.get('assunto'))) subject.value = query.get('assunto');
      async function prepare(event) {
        event?.preventDefault(); if (!composer.reportValidity()) return;
        const order = composer.querySelector('[name="pedido"]').value.trim();
        const message = composer.querySelector('[name="mensagem"]').value.trim();
        const text = `Assunto: ${subject.selectedOptions[0].textContent}\n${order ? `Pedido: ${order}\n` : ''}\n${message}`;
        const output = document.querySelector('[data-contact-preview]'); output.value = text; output.hidden = false;
        await copyText(text, document.querySelector('[data-contact-status]'), 'Solicitação copiada. Envie o texto ao e-mail de atendimento informado nesta página.');
      }
      composer.addEventListener('submit', prepare);
      composer.querySelector('[data-copy-message]').addEventListener('click', prepare);
    }
    const search = document.querySelector('[data-search-content]');
    if (search && product) {
      const query = new URL(location.href).searchParams.get('q') || '';
      const input = document.querySelector('[data-local-search] [name="q"]'); if (input) input.value = query;
      document.querySelector('[data-search-query]').textContent = query ? `Busca por “${query}”` : 'Produto disponível';
      document.querySelector('[data-product-result]').hidden = !matchesProduct(query);
      document.querySelector('[data-no-results]').hidden = matchesProduct(query);
    }
    const review = document.querySelector('[data-order-review]');
    if (review && product) {
      const select = review.querySelector('[data-review-variant]');
      product.variants.forEach(variant => { const option = document.createElement('option'); option.value = variant.id; option.textContent = variant.title; option.disabled = !variant.available; select.appendChild(option); });
      const initial = readDraft(); select.value = initial.variant.id;
      const count = review.querySelector('[data-review-quantity]'); count.value = initial.quantity;
      function update() {
        const variant = product.variants.find(v => String(v.id) === select.value);
        if (!count.checkValidity() || !Number.isSafeInteger(Number(count.value)) || !Number.isSafeInteger(Number(count.value) * variant.price)) return;
        const quantity = Number(count.value); saveDraft(variant, quantity);
        review.querySelector('[data-review-unit]').textContent = money(variant.price);
        review.querySelector('[data-review-total]').textContent = money(variant.price * quantity);
        review.querySelector('[data-review-pix]').textContent = money(Math.round(variant.price * quantity * .9));
        const checkout = document.querySelector('[data-review-checkout]');
        if (checkout) checkout.href = checkoutLink(variant.id);
        const url = new URL(location.href); url.searchParams.set('variant', variant.id); url.searchParams.set('quantity', quantity);
        if (url.protocol !== 'file:') history.replaceState(history.state, '', url.href);
      }
      select.addEventListener('change', update); count.addEventListener('input', update); update();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true }); else ready();
})();
