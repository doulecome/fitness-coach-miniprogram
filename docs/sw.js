/* 健身教练 Service Worker · cache fit-d1e0cc8fe5（由 build_site.js 生成，勿手改） */
var CV = 'fit-d1e0cc8fe5';
var SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CV).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CV; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return; // 只管同源 GET
  if (u.pathname.indexOf('/media/') >= 0) {
    // GIF 媒体：缓存优先，首次取回后入缓存（离线可跟练的关键）
    e.respondWith(caches.open(CV).then(function (c) {
      return c.match(e.request).then(function (r) {
        if (r) return r;
        return fetch(e.request).then(function (resp) {
          if (resp.ok) c.put(e.request, resp.clone());
          return resp;
        });
      });
    }));
    return;
  }
  // 页面/资产：网络优先（保证更新），断网回退缓存；导航请求兜底到 index.html
  e.respondWith(fetch(e.request).then(function (resp) {
    if (resp.ok) { var cl = resp.clone(); caches.open(CV).then(function (c) { c.put(e.request, cl); }); }
    return resp;
  }).catch(function () {
    return caches.match(e.request).then(function (r) {
      return r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined);
    });
  }));
});
