(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  let features = null;
  function publish() {
    if (!features) return;
    // page.js가 다음 페이지 로드 때 설정 도착 전부터 같은 값을 쓰도록 페이지 저장소에 기억한다.
    try { localStorage.setItem('hanbi_grid_bypass', String(features.gridBypass !== false)); } catch (_) {}
    document.dispatchEvent(new CustomEvent('hanbi-playback-settings', { detail: JSON.stringify({ gridBypass: features.gridBypass !== false }) }));
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
