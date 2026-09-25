// Transaction fixture, not a substitute for Firefox IndexedDB persistence/quota QA.
module.exports = function fakeIndexedDB() {
  const records = new Map();
  let initialized = false;
  const factory = { failNext: null, records, open() {
    const request = {};
    const db = {
      createObjectStore() { initialized = true; },
      close() {},
      transaction() {
        const tx = { objectStore: () => Object.fromEntries(['add', 'get', 'delete'].map(op => [op, value => {
          const operation = {};
          queueMicrotask(() => {
            const failure = factory.failNext;
            factory.failNext = null;
            if (failure || (op === 'add' && records.has(value.id))) {
              tx.error = operation.error = new Error(failure || 'ConstraintError');
              tx.onabort?.(); return;
            }
            if (op === 'add') { records.set(value.id, structuredClone(value)); operation.result = value.id; }
            if (op === 'get') operation.result = structuredClone(records.get(value));
            if (op === 'delete') records.delete(value);
            operation.onsuccess?.();
            tx.oncomplete?.();
          });
          return operation;
        }])) };
        return tx;
      },
    };
    queueMicrotask(() => {
      request.result = db;
      if (!initialized) request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  } };
  return factory;
};
