// Service worker của Lạc Niên — cache-on-fetch để mở lại được khi mất mạng.
//
// Flutter từ 3.35 không còn sinh service worker cache nữa; file
// flutter_service_worker.js đi kèm chỉ tự gỡ mình. Không có cái này thì
// "thêm vào màn hình chính" xong, bật máy bay là màn trắng.
//
// Luật: cùng gốc (/app/…) → cache trước, mạng sau; hai CDN đã biết
// (Sentry, font Google) → cache trước, lưu cả phản hồi opaque; Supabase và
// mọi thứ khác → mạng trước, không cache. Không precache danh sách cứng:
// lần mở đầu có mạng là đủ nạp những gì cần, và không phải sinh lại danh
// sách mỗi lần build.
const TEN = 'lac-nien-web-v1';
const CDN = ['https://browser.sentry-cdn.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== TEN).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cungGoc = url.origin === self.location.origin;
  const laCdn = CDN.some((c) => req.url.startsWith(c));
  if (!cungGoc && !laCdn) return; // Supabase v.v.: để trình duyệt tự lo.

  // Điều hướng (mở /app/ hay /app/index.html) luôn về cùng một trang.
  const khoa = req.mode === 'navigate' ? new Request(self.registration.scope) : req;

  e.respondWith(
    caches.open(TEN).then(async (cache) => {
      const co = await cache.match(khoa, { ignoreSearch: req.mode === 'navigate' });
      const tuMang = fetch(req).then((r) => {
        if (r && (r.ok || r.type === 'opaque')) cache.put(khoa, r.clone());
        return r;
      });
      // Có sẵn thì trả ngay và cập nhật ngầm; chưa có thì chờ mạng.
      return co ? (tuMang.catch(() => {}), co) : tuMang;
    }),
  );
});
