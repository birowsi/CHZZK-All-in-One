(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  let features = null;
  function publish() {
    if (features) document.dispatchEvent(new CustomEvent('hanbi-playback-settings', { detail: JSON.stringify({ gridBypass: features.gridBypass !== false }) }));
  }
  api.storage.local.get('features').then(data => { features = data.features || {}; publish(); });
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.features) { features = changes.features.newValue || {}; publish(); }
  });
  document.addEventListener('hanbi-playback-ready', publish);
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest?.('.pzp-setting-quality-pane__list-container, [class*="quality-item"]')) return;
    document.dispatchEvent(new CustomEvent('hanbi-quality-manual'));
    api.runtime.sendMessage({ type: 'quality-manual', path: location.pathname }).catch(() => {});
  }, true);
  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || !event.target.closest?.('.pzp-setting-quality-pane__list-container, [class*="quality-item"]')) return;
    document.dispatchEvent(new CustomEvent('hanbi-quality-manual'));
    api.runtime.sendMessage({ type: 'quality-manual', path: location.pathname }).catch(() => {});
  }, true);
})();
