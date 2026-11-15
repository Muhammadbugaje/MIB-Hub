/* EE Hub Messages: photos are made smaller in the browser before upload (round 7, M11), and voice notes
 * are recorded as compact Opus audio. Exposes window.EEChatMedia.
 *   compress(file, {maxPx: 1600, targetKB: 350}) -> Promise<{file, original, width, height}>
 *     longest side maxPx; WebP (or JPEG) quality stepped down until the file is near targetKB (200-400 KB);
 *     the server then keeps the lightest faithful format and makes the 320 px thumbnail.
 *   recorder() -> {start(), stop() -> Promise<{blob, seconds}>, cancel()}
 */
(function () {
  "use strict";

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      if (window.createImageBitmap) {
        createImageBitmap(file, { imageOrientation: "from-image" }).then(resolve).catch(function () { viaImg(); });
      } else viaImg();
      function viaImg() {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("not an image")); };
        img.src = url;
      }
    });
  }

  function toBlob(canvas, type, q) {
    return new Promise(function (resolve) {
      if (canvas.convertToBlob) canvas.convertToBlob({ type: type, quality: q }).then(resolve, function () { resolve(null); });
      else canvas.toBlob(resolve, type, q);
    });
  }

  function supportsWebp() {
    try { var c = document.createElement("canvas"); c.width = c.height = 1; return c.toDataURL("image/webp").indexOf("image/webp") === 5; }
    catch (e) { return false; }
  }
  var WEBP = supportsWebp();

  function compress(file, opts) {
    opts = opts || {};
    var maxPx = opts.maxPx || 1600, target = (opts.targetKB || 350) * 1024;
    if (!/^image\//.test(file.type) || /gif|svg/.test(file.type)) return Promise.resolve({ file: file, original: file.size });
    return loadImage(file).then(function (img) {
      var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      var scale = Math.min(1, maxPx / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      var canvas = (window.OffscreenCanvas && !/Safari/.test(navigator.userAgent)) ? new OffscreenCanvas(cw, ch) : Object.assign(document.createElement("canvas"), { width: cw, height: ch });
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);       // no transparent JPEG corners
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, cw, ch);
      if (img.close) img.close();
      var type = WEBP ? "image/webp" : "image/jpeg", ext = WEBP ? ".webp" : ".jpg";
      var qs = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
      var i = 0, best = null;
      function step() {
        return toBlob(canvas, type, qs[i]).then(function (b) {
          if (b && (!best || b.size < best.size)) best = b;
          if (!b || b.size <= target * 1.15 || ++i >= qs.length) return best;
          return step();
        });
      }
      return step().then(function (blob) {
        if (!blob || blob.size >= file.size) return { file: file, original: file.size, width: w, height: h };
        var name = (file.name || "photo").replace(/\.[^.]+$/, "") + ext;
        var out;
        try { out = new File([blob], name, { type: type }); } catch (e) { out = blob; out.name = name; }
        return { file: out, original: file.size, width: cw, height: ch };
      });
    }).catch(function () { return { file: file, original: file.size }; });
  }

  function recorder() {
    var rec = null, chunks = [], stream = null, started = 0, mime = "";
    var types = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"];
    for (var i = 0; i < types.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { mime = types[i]; break; }
    }
    return {
      supported: !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      start: function () {
        return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }).then(function (s) {
          stream = s; chunks = [];
          rec = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
          rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          rec.start(250);
          started = Date.now();
        });
      },
      elapsed: function () { return started ? (Date.now() - started) / 1000 : 0; },
      stop: function () {
        return new Promise(function (resolve) {
          if (!rec) return resolve(null);
          rec.onstop = function () {
            stream.getTracks().forEach(function (t) { t.stop(); });
            var type = (rec.mimeType || mime || "audio/webm").split(";")[0];
            resolve({ blob: new Blob(chunks, { type: type }), seconds: Math.round((Date.now() - started) / 1000), type: type });
            rec = null;
          };
          rec.stop();
        });
      },
      cancel: function () { try { if (rec) rec.stop(); } catch (e) {} if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); rec = null; }
    };
  }

  window.EEChatMedia = { compress: compress, recorder: recorder };
})();
