(() => {
  'use strict';
  function createStore(factory = indexedDB) {
    let opening;
    function open() {
      if (!opening) opening = new Promise((resolve, reject) => {
        const request = factory.open('hanbi-recordings', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('recordings', { keyPath: 'id' });
        request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opening = null; }; resolve(db); };
        request.onerror = () => { opening = null; reject(request.error); };
      });
      return opening;
    }
    async function transaction(mode, action) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('recordings', mode);
        const request = action(tx.objectStore('recordings'));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = tx.onabort = () => reject(tx.error || request.error || new Error('녹화 저장 실패'));
      });
    }
    return {
      put: recording => transaction('readwrite', store => store.add(recording)),
      get: id => transaction('readonly', store => store.get(id)),
      delete: id => transaction('readwrite', store => store.delete(id)),
    };
  }
  globalThis.HanbiRecordingStore = { createStore };
  if (typeof module !== 'undefined') module.exports = { createStore };
})();
