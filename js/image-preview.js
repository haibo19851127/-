/* ============================================================
 * image-preview.js · 图片懒加载 + 全屏大图预览（全站共用）
 * 所有文章 / 列表页面引入即可，无需手动初始化。
 *
 * 用法（给 <img> 加 class="lazy-img zoomable"，真实地址写 data-src）：
 *   <img class="lazy-img zoomable"
 *        data-src="assets/images/xxx.svg"
 *        alt="图片说明" />
 *
 *   - lazy-img ：进入视口后才把 data-src 赋给 src（懒加载）
 *   - zoomable ：点击弹出全屏大图，点空白 / 关闭按钮 / 按 Esc 关闭
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 1. 图片懒加载（IntersectionObserver） ---------------- */
  function initLazyLoad() {
    var lazyImages = document.querySelectorAll('img.lazy-img[data-src]');
    if (!lazyImages.length) return;

    // 不支持 IntersectionObserver 的老浏览器：直接全部加载，保证内容不丢
    if (!('IntersectionObserver' in window)) {
      lazyImages.forEach(loadImage);
      return;
    }

    var io = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        loadImage(entry.target);
        observer.unobserve(entry.target); // 加载一次即可，停止观察
      });
    }, {
      rootMargin: '120px 0px', // 提前 120px 开始加载，滑动到跟前几乎无感
      threshold: 0.01
    });

    lazyImages.forEach(function (img) { io.observe(img); });
  }

  // 把 data-src 搬到 src，加载完成后淡入
  function loadImage(img) {
    if (img.dataset.loaded) return;
    img.dataset.loaded = '1';
    var src = img.getAttribute('data-src');
    if (!src) return;

    // 同时给一层原生懒加载兜底（浏览器支持时）
    img.setAttribute('loading', 'lazy');
    img.addEventListener('load', function onLoad() {
      img.classList.add('loaded');
      img.removeEventListener('load', onLoad);
    });
    img.src = src;
    // 缓存命中时 load 可能已结束
    if (img.complete && img.naturalWidth > 0) img.classList.add('loaded');
  }

  /* ---------------- 2. 全屏大图预览弹窗（事件委托） ---------------- */
  var overlay = null;

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'img-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<button class="lightbox-close" type="button" aria-label="关闭">×</button>' +
      '<img class="lightbox-img" alt="" />' +
      '<div class="lightbox-caption"></div>';
    document.body.appendChild(overlay);

    // 点击遮罩空白处关闭（点图片本身不关闭）
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('lightbox-close')) {
        closeLightbox();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeLightbox();
    });
  }

  function openLightbox(src, alt) {
    if (!overlay) buildOverlay();
    var big = overlay.querySelector('.lightbox-img');
    big.src = src;
    big.alt = alt || '';
    overlay.querySelector('.lightbox-caption').textContent = alt || '';
    overlay.classList.add('open');
    document.body.classList.add('lightbox-on'); // 锁背景滚动
  }

  function closeLightbox() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.classList.remove('lightbox-on');
  }

  function initPreview() {
    // 委托：列表缩略图 / 正文图片都能点，且对后续动态插入的图片同样生效
    document.addEventListener('click', function (e) {
      var img = e.target.closest ? e.target.closest('img.zoomable') : null;
      if (!img) return;
      // 懒加载图片尚未载入时，取 data-src 作为大图地址
      var src = img.getAttribute('src') || img.getAttribute('data-src');
      if (!src) return;
      e.preventDefault();
      openLightbox(src, img.alt);
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    initLazyLoad();
    initPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
