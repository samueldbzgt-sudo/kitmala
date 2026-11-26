/* Correções funcionais do layout ORIGINAL. Não adiciona CSS nem substitui seções. */
(() => {
  'use strict';
  if (window.mpOriginalCorrections) return;
  const configElement = document.getElementById('mp-correcoes-config');
  if (!configElement) return;
  let config;
  try { config = JSON.parse(configElement.textContent); } catch { return; }
  const product = config.product;
  if (!product?.variants?.length) return;
  window.mpOriginalCorrections = true;

  // A cópia local não tem as rotas Ajax de uma loja Shopify. Os dados do próprio
  // produto são usados apenas nela; na Shopify o fetch original é preservado.
  if (config.localPreview) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
      let url;
      try { url = new URL(typeof input === 'string' ? input : input.url, location.href); } catch { return originalFetch(input, options); }
      if (url.pathname.endsWith(`/products/${product.handle}.js`) || url.pathname.endsWith(`/products/${product.handle}.json`)) {
        return Promise.resolve(new Response(JSON.stringify(product), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (/\/cart\.(?:js|json)$/.test(url.pathname)) {
        return Promise.resolve(new Response(JSON.stringify({ token: '', item_count: 0, items: [], total_price: 0, currency: 'BRL' }), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (/\/variants\/\d+$/.test(url.pathname) && url.searchParams.get('section_id') === 'store-availability') {
        return Promise.resolve(new Response('<div id="shopify-section-store-availability"></div>', { headers: { 'Content-Type': 'text/html' } }));
      }
      return originalFetch(input, options);
    };
    if (window.themeVariables?.libs) {
      window.themeVariables.libs.flickity = new URL('js/flickity.js', location.href).href;
      window.themeVariables.libs.photoswipe = new URL('js/photoswipe.js', location.href).href;
    }
  }

  // Deve executar antes de theme.min.js: mantém o carrossel original do tema.
  document.querySelectorAll('flickity-carousel[flickity-config]').forEach(carousel => {
    try { JSON.parse(carousel.getAttribute('flickity-config')); }
    catch {
      if (!carousel.closest('product-media')) return;
      carousel.setAttribute('flickity-config', JSON.stringify({ adaptiveHeight: true, dragThreshold: 10, initialIndex: '.is-initial-selected', fade: true, draggable: '>1', contain: true, cellSelector: '.product__media-item:not(.is-filtered)', percentPosition: false, pageDots: false, prevNextButtons: false }));
    }
  });
  const repeatedButtons = [...document.querySelectorAll('[id="StickyAddToCart"]')];
  repeatedButtons.filter(button => button.closest('product-sticky-form')).forEach((button, i) => { button.id = `StickyAddToCartBar-${i + 1}`; });

  const variants = product.variants;
  const format = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: config.currency || 'BRL' });
  const money = cents => format.format(cents / 100);
  const mainForm = document.querySelector('form[is="product-form"]') || document.querySelector('form[action*="/cart/add"]');
  let syncing = false;
  let selected = variants.find(variant => String(variant.id) === new URL(location.href).searchParams.get('variant')) || variants.find(variant => variant.available) || variants[0];

  function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
  function syncPrice() {
    // Mantém os mesmos elementos, classes e rótulos do preço original.
    const meta = document.querySelector('product-meta');
    const current = meta?.querySelector('[data-product-price-list] .price:not(.price--compare)');
    const compare = meta?.querySelector('.price--compare');
    function updatePrice(element, cents) {
      if (!element) return;
      const label = element.querySelector('.visually-hidden');
      element.replaceChildren(...(label ? [label] : []), document.createTextNode(money(cents)));
    }
    updatePrice(current, selected.price);
    updatePrice(compare, selected.compare_at_price || 0);
    const hasDiscount = selected.compare_at_price > selected.price;
    if (compare) compare.hidden = !hasDiscount;
    current?.classList.toggle('price--highlight', hasDiscount);
    const discount = meta?.querySelector('[data-product-label-list] .label');
    if (discount) { discount.hidden = !hasDiscount; discount.textContent = `- ${Math.round(100 * (selected.compare_at_price - selected.price) / selected.compare_at_price)}%`; }
  }
  function quantity() {
    const input = document.querySelector('.product-form__quantity input[name="quantity"]');
    return Math.max(1, Math.floor(Number(input?.value) || 1));
  }
  function syncPayments() {
    const total = selected.price * quantity();
    const multiplier = Number(document.getElementById('pixdesc')?.textContent || config.pixMultiplier || .9);
    setText('total-a-vista', money(total));
    setText('total-pix', money(Math.round(total * multiplier)));
    setText('total-boleto', money(total));
    const ordinals = ['primeira','segunda','terceira','quarta','quinta','sexta','setima','oitava','nona','decima','decima-primeira','decima-segunda'];
    ordinals.forEach((ordinal, index) => {
      const installments = index + 1;
      const rate = Number(document.getElementById(`juros${installments}`)?.textContent) || 1;
      setText(`taxa-${ordinal}-parcela`, money(Math.round(total * rate / installments)));
      setText(`total-${ordinal}-parcela`, money(Math.round(total * rate)));
    });
    const rate12 = Number(document.getElementById('juros')?.textContent) || 1.2161;
    setText('parcela', money(Math.round(selected.price * rate12 / 12)));
    document.querySelectorAll('[data-mp-payment]').forEach(card => {
      const pix = card.querySelector('[data-mp-pix]');
      const regular = card.querySelector('[data-mp-regular]');
      if (pix) pix.textContent = money(Math.round(selected.price * (Number(card.dataset.multiplier) || .9)));
      if (regular) regular.textContent = money(selected.price);
    });
  }

  function selectVariant(variant, notify = true) {
    if (!variant || syncing) return;
    syncing = true;
    selected = variant;
    document.querySelectorAll('.mpl__opts input[name="id"]').forEach(input => { input.checked = input.value === String(variant.id); });
    document.querySelectorAll('product-variants input[type="radio"][name^="option"]').forEach(input => {
      const index = Number(input.name.slice(6)) - 1;
      input.checked = input.value === variant.options[index];
    });
    document.querySelectorAll('product-variants select[name^="option"]').forEach(select => {
      const index = Number(select.name.slice(6)) - 1;
      select.value = variant.options[index];
      select.closest('combo-box')?.querySelectorAll('[role="option"]').forEach(button => button.setAttribute('aria-selected', String(button.value === select.value)));
    });
    document.querySelectorAll('.product-form__option-value, .product-sticky-form__variants .select__selected-value').forEach(el => { el.textContent = variant.title; });
    if (mainForm) mainForm.querySelectorAll('input[name="id"]').forEach(input => { input.disabled = false; input.value = String(variant.id); });
    document.querySelectorAll('.product-sticky-form__price').forEach(el => { el.textContent = money(variant.price); });
    if (notify && mainForm) mainForm.dispatchEvent(new CustomEvent('variant:changed', { bubbles: true, detail: { variant } }));
    syncPrice();
    syncPayments();
    if (location.protocol !== 'file:') {
      const url = new URL(location.href);
      url.searchParams.set('variant', variant.id);
      history.replaceState(history.state, '', url.href);
    }
    syncing = false;
  }

  function variantFromControl(control) {
    if (control.matches('.mpl__opts input[name="id"]')) return variants.find(v => String(v.id) === control.value);
    if (control.matches('product-variants input[name^="option"], product-variants select[name^="option"]')) {
      const index = Number(control.name.slice(6)) - 1;
      return variants.find(v => v.options[index] === control.value && v.options.every((option, i) => i === index || option === selected.options[i]));
    }
  }
  document.addEventListener('change', event => {
    if (!(event.target instanceof Element)) return;
    const variant = variantFromControl(event.target);
    if (variant) selectVariant(variant);
    else if (event.target.matches('input[name="quantity"]')) syncPayments();
  }, true);
  document.addEventListener('variant:changed', event => {
    if (!syncing && event.detail?.variant) selectVariant(variants.find(v => String(v.id) === String(event.detail.variant.id)), false);
  });
  window.addEventListener('popstate', () => {
    const id = new URL(location.href).searchParams.get('variant');
    selectVariant(variants.find(v => String(v.id) === id) || variants[0]);
  });

  function checkoutLink() {
    if (!selected.available) { window.alert('Esta opção está esgotada no momento.'); return ''; }
    const navigation = window.CasaLunearNavigation;
    if (!navigation) return '';
    const order = navigation.saveDraft(selected, quantity());
    return navigation.checkoutLink(order.variant) || navigation.resolve(`pages/checkout.html?variant=${encodeURIComponent(order.variant)}&quantity=${order.quantity}`).href;
  }
  function purchase(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const url = checkoutLink();
    if (url) window.CasaLunearNavigation.go(url);
  }
  // Captura antes dos componentes do tema e dos scripts de carrinho existentes.
  window.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-product-add-to-cart-button], .mpl__offer button[type="submit"]') : null;
    if (button) purchase(event);
  }, true);
  window.addEventListener('submit', event => {
    if (event.target instanceof HTMLFormElement && /\/cart\/add(?:\?|$)/.test(new URL(event.target.action, location.href).pathname)) purchase(event);
  }, true);

  function ready() {
    const backdrop = document.getElementById('backdrop-modal-parcel');
    const modal = document.getElementById('modal-parcel');
    const open = document.getElementById('modal-open-button');
    const close = document.getElementById('modal-close-button');
    let previousFocus;
    function closeModal() {
      document.body.classList.remove('active-modal');
      open?.setAttribute('aria-expanded', 'false');
      previousFocus?.focus();
    }
    function toggleModal() {
      if (document.body.classList.contains('active-modal')) { closeModal(); return; }
      previousFocus = document.activeElement;
      document.body.classList.add('active-modal');
      open?.setAttribute('aria-expanded', 'true');
      close?.focus();
    }
    window.toggleModal = toggleModal;
    window.closeModal = closeModal;
    if (backdrop && modal) {
      document.body.appendChild(backdrop);
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Formas de pagamento');
      open?.removeAttribute('onclick');
      open?.setAttribute('aria-expanded', 'false');
      open?.addEventListener('click', event => { event.preventDefault(); toggleModal(); });
      close?.removeAttribute('onclick');
      close?.setAttribute('role', 'button');
      close?.setAttribute('tabindex', '0');
      close?.setAttribute('aria-label', 'Fechar formas de pagamento');
      close?.addEventListener('click', closeModal);
      close?.addEventListener('keydown', event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); closeModal(); } });
      backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
      document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('active-modal')) closeModal(); });
    }
    selectVariant(selected);
    // Os blocos mantêm o markup original. Apenas corrigimos seus dados.
    document.querySelectorAll('.mpl__opts input[name="id"]').forEach(input => { input.disabled = !variants.find(v => String(v.id) === input.value)?.available; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
