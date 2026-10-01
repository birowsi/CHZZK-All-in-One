(() => {
  if (typeof document === "undefined" || typeof AudioNode === "undefined") return;
  const orig = AudioNode.prototype.connect;
  const taps = new WeakMap();
  AudioNode.prototype.connect = function (dest, ...rest) {
    const result = orig.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode) {
      const ctx = this.context;
      let analyser = taps.get(ctx);
      if (!analyser) {
        analyser = ctx.createAnalyser(); analyser.fftSize = 2048; taps.set(ctx, analyser);
        const buf = new Float32Array(2048); const samples = [];
        setInterval(() => {
          analyser.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v;
          samples.push(Math.sqrt(s / buf.length)); if (samples.length > 200) samples.shift();
          document.documentElement.dataset.probe = JSON.stringify({ state: ctx.state, samples: samples.slice(-80) });
        }, 50);
      }
      orig.call(this, analyser);
    }
    return result;
  };
})();
