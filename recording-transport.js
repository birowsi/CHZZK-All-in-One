(() => {
  'use strict';
  const chunkSize = 256 * 1024;
  const isChrome = api => !!api.runtime.getManifest?.().background?.service_worker;
  const encode = bytes => {
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(text);
  };
  const decode = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
  async function request(api, message) {
    const result = await api.runtime.sendMessage(message);
    if (result?.__hanbiError) throw new Error(result.__hanbiError);
    return result;
  }
  async function save(api, recording) {
    if (!isChrome(api)) return request(api, { type: 'recording-complete', recording });
    const { blob, ...metadata } = recording;
    const { id } = await request(api, { type: 'recording-upload-start', metadata, size: blob.size });
    try {
      for (let offset = 0, sequence = 0; offset < blob.size; offset += chunkSize, sequence++) {
        const data = encode(new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer()));
        await request(api, { type: 'recording-upload-chunk', id, sequence, data });
      }
      return await request(api, { type: 'recording-upload-finish', id });
    } catch (error) {
      await request(api, { type: 'recording-upload-abort', id }).catch(() => {});
      throw error;
    }
  }
  async function read(api, id) {
    const recording = await request(api, { type: 'get-recording', id });
    if (!recording || !isChrome(api)) return recording;
    const parts = [];
    for (let offset = 0; offset < recording.size; offset += chunkSize) {
      const { data } = await request(api, { type: 'recording-read-chunk', id, offset });
      const bytes = decode(data);
      if (bytes.length !== Math.min(chunkSize, recording.size - offset)) throw new Error('녹화 데이터 일부를 받지 못했습니다.');
      parts.push(bytes);
    }
    return { ...recording, blob: new Blob(parts, { type: recording.mimeType }) };
  }
  function createReceiver(store, openResult, uuid = () => crypto.randomUUID()) {
    const uploads = new Map();
    const owner = sender => `${sender.tab?.id ?? 'extension'}:${sender.documentId ?? sender.frameId ?? 0}`;
    const owned = (id, sender) => {
      const upload = uploads.get(id);
      if (!upload || upload.owner !== owner(sender)) throw new Error('녹화 전송이 중단됐습니다. 원본 저장을 확인하세요.');
      return upload;
    };
    const receive = function(message, sender) {
      if (message.type === 'recording-upload-start') return (async () => {
        for (const [id, upload] of uploads) if (Date.now() - upload.touched > 300000) uploads.delete(id);
        if (!Number.isSafeInteger(message.size) || message.size <= 0 || uploads.size >= 4) throw new Error('녹화 전송을 시작할 수 없습니다.');
        const id = uuid();
        uploads.set(id, { owner: owner(sender), metadata: message.metadata, size: message.size, received: 0, chunks: [], touched: Date.now() });
        return { id };
      })();
      if (message.type === 'recording-upload-chunk') return (async () => {
        const upload = owned(message.id, sender);
        if (message.sequence !== upload.chunks.length || typeof message.data !== 'string' || message.data.length > Math.ceil(chunkSize / 3) * 4) throw new Error('녹화 전송 순서가 잘못됐습니다.');
        const bytes = decode(message.data);
        if (!bytes.length || bytes.length > chunkSize || upload.received + bytes.length > upload.size) throw new Error('녹화 전송 크기가 잘못됐습니다.');
        upload.chunks.push(new Blob([bytes])); upload.received += bytes.length; upload.touched = Date.now();
        return { ok: true };
      })();
      if (message.type === 'recording-upload-finish') return (async () => {
        const upload = owned(message.id, sender);
        if (upload.received !== upload.size) throw new Error('녹화 데이터가 불완전합니다.');
        const recording = { ...upload.metadata, id: message.id, blob: new Blob(upload.chunks, { type: upload.metadata?.mimeType || 'video/webm' }) };
        await store.put(recording);
        uploads.delete(message.id);
        await openResult(message.id);
        return { id: message.id };
      })();
      if (message.type === 'recording-upload-abort') return (async () => {
        owned(message.id, sender); uploads.delete(message.id); return { ok: true };
      })();
      if (message.type === 'get-recording') return (async () => {
        const recording = await store.get(message.id);
        if (!recording) return null;
        const { blob, ...metadata } = recording;
        return { ...metadata, size: blob.size };
      })();
      if (message.type === 'recording-read-chunk') return (async () => {
        if (!Number.isSafeInteger(message.offset) || message.offset < 0) throw new Error('잘못된 녹화 위치입니다.');
        const recording = await store.get(message.id);
        if (!recording?.blob) throw new Error('보관된 녹화가 없습니다.');
        return { data: encode(new Uint8Array(await recording.blob.slice(message.offset, message.offset + chunkSize).arrayBuffer())) };
      })();
      return undefined;
    };
    receive.cancelTab = tabId => { for (const [id, upload] of uploads) if (upload.owner.startsWith(`${tabId}:`)) uploads.delete(id); };
    return receive;
  }
  const transport = { isChrome, save, read, request, createReceiver, chunkSize };
  globalThis.HanbiRecordingTransport = transport;
  if (typeof module !== 'undefined') module.exports = transport;
})();
