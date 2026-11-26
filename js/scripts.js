(function() {
  var __sections__ = {};
  (function() {
    for(var i = 0, s = document.getElementById('sections-script').getAttribute('data-sections').split(','); i < s.length; i++)
      __sections__[s[i]] = true;
    })();
    (function() {
  if (!__sections__["footer"]) return;
  try {
    
function mpSetupFooter(){
 document.querySelectorAll('.mp-footer-accordion').forEach(function(detail){
  if(detail.dataset.mpReady)return;
  detail.dataset.mpReady='true';
  var media=window.matchMedia('(min-width:741px)');
  function sync(){detail.open=media.matches || detail.classList.contains("mp-footer-policies");}
  sync();media.addEventListener('change',sync);
 });
}
mpSetupFooter();
document.addEventListener('shopify:section:load',mpSetupFooter);

  } catch(e) { console.error(e); }
})();
})();
