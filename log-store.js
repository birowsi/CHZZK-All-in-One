(() => {
  'use strict';
  function validate(logs) {
    if (!Array.isArray(logs) || logs.some(l => !l || typeof l !== 'object' || Array.isArray(l)
      || typeof l.channelId !== 'string' || !l.channelId || typeof l.channelName !== 'string'
      || !Number.isFinite(l.amount) || typeof l.method !== 'string' || !l.method
      || typeof l.timestamp !== 'string' || !Number.isFinite(Date.parse(l.timestamp)))) {
      throw new Error('로그의 채널·날짜·금액·획득 종류를 확인해 주세요.');
    }
    return logs;
  }
  function changes(before, after) {
    const previous = new Map(before.map(l => [l.id, l]));
    return { op: 'changes', remove: before.filter(l => !after.some(n => n.id === l.id)),
      updates: after.filter(l => JSON.stringify(l) !== JSON.stringify(previous.get(l.id))).map(l => ({ before: previous.get(l.id), after: l })) };
  }
  function createStore(api, uuid = () => crypto.randomUUID()) {
    let queue = Promise.resolve();
    return function execute(request) {
      const run = async () => {
        const { powerLogs = [] } = await api.storage.local.get('powerLogs');
        if (!Array.isArray(powerLogs) || powerLogs.some(l => !l || typeof l !== 'object')) throw new Error('기존 로그 형식이 잘못되었습니다. 원본은 보존했습니다.');
        const ids = new Set();
        const logs = powerLogs.map(l => {
          const id = typeof l.id === 'string' && l.id && !ids.has(l.id) ? l.id : uuid();
          ids.add(id); return { ...l, id };
        });
        let next = logs;
        if (request.op === 'append') {
          validate([request.log]);
          const duplicate = logs.some(l => l.channelId === request.log.channelId && (
            (request.log.eventKey && l.eventKey === request.log.eventKey) ||
            (request.log.method === 'view' && l.method === 'view' && Math.abs(Date.parse(l.timestamp) - Date.parse(request.log.timestamp)) < 60_000)
          ));
          if (!duplicate) next = [{ ...request.log, id: uuid() }, ...logs];
          const { maxLogs = 10000 } = await api.storage.sync.get('maxLogs');
          next = next.slice(0, Number.isFinite(maxLogs) && maxLogs > 0 ? Math.floor(maxLogs) : 10000);
        } else if (request.op === 'changes') {
          if (!Array.isArray(request.remove) || !Array.isArray(request.updates)) throw new Error('잘못된 로그 변경 요청');
          for (const old of request.remove) {
            const current = logs.find(l => l.id === old?.id);
            if (!current || JSON.stringify(current) !== JSON.stringify(old)) throw new Error('다른 창에서 수정된 로그입니다. 새로고침해 주세요.');
          }
          next = logs.filter(l => !request.remove.some(old => old.id === l.id));
          for (const { before, after } of request.updates) {
            validate([after]);
            if (!before) { next.unshift({ ...after, id: uuid() }); continue; }
            if (before.id !== after.id) throw new Error('로그 ID는 변경할 수 없습니다.');
            const index = next.findIndex(l => l.id === before.id);
            if (index < 0) throw new Error('다른 창에서 삭제된 로그입니다. 새로고침해 주세요.');
            const merged = { ...next[index] };
            for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
              if (key === 'id' || JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
              if (JSON.stringify(merged[key]) !== JSON.stringify(before[key]) && JSON.stringify(merged[key]) !== JSON.stringify(after[key])) throw new Error('다른 창에서 수정된 로그입니다. 새로고침해 주세요.');
              if (after[key] === undefined) delete merged[key]; else merged[key] = after[key];
            }
            next[index] = merged;
          }
        } else if (request.op === 'replace') {
          validate(request.logs);
          next = request.logs.map(l => ({ ...l, id: uuid() })).sort((a,b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
        } else if (request.op === 'clear') next = [];
        else if (request.op !== 'read') throw new Error('지원하지 않는 로그 작업');
        if (JSON.stringify(next) !== JSON.stringify(powerLogs)) await api.storage.local.set({ powerLogs: next });
        return { powerLogs: next };
      };
      // ponytail: one background queue serializes the existing storage array; use IDB records if logs outgrow it.
      const result = queue.then(run); queue = result.catch(() => {}); return result;
    };
  }
  const api = globalThis.browser ?? globalThis.chrome;
  const send = request => api.runtime.sendMessage({ type: 'power-logs', ...request }).then(result => {
    if (!result?.ok) throw new Error(result?.error || '로그를 저장하지 못했습니다.');
    return result;
  });
  const logic = { validate, changes, createStore, read: () => send({ op: 'read' }),
    append: log => send({ op: 'append', log }), commit: (before, after) => send(changes(before, after)),
    replace: logs => { validate(logs); return send({ op: 'replace', logs }); }, clear: () => send({ op: 'clear' }) };
  globalThis.HanbiLogs = logic;
  if (typeof module !== 'undefined') module.exports = logic;
})();
