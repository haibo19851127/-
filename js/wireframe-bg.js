/* ============================================================
 * wireframe-bg.js · 全站公共 Three.js 线框 3D 背景（ES Module）
 * 用法：页面放置 <canvas id="wireframe-canvas"></canvas> 即可自动渲染
 *
 * 想调整效果，直接改下面「可调参数区」CONFIG 里的值：
 *   wireColor 线框颜色 / gridSize 网格大小 / boxSize 立方体大小
 *   torusRadius 圆环大小 / rotSpeed 自转速度
 *   parallax 鼠标跟随幅度 / parallaxFollow 跟随响应速度（两个都越大越灵敏）
 * ============================================================ */
import * as THREE from 'three';

/* ---------------- 可调参数区（改这里即可） ---------------- */
const CONFIG = {
  wireColor: 0x4a88c8,   // 线框颜色（工程蓝，与 CSS --wire 对应）
  gridOpacity: 0.32,     // 网格地面透明度
  gridSize: 60,          // 网格地面总尺寸（越大越开阔）
  gridDivisions: 60,     // 网格分段数（越大格子越密）
  boxSize: 2.1,          // 立方体边长
  torusRadius: 1.25,     // 圆环外半径
  torusTube: 0.42,       // 圆环管半径
  rotSpeed: 0.0022,      // 几何体自转速度（每帧弧度）
  parallax: 1.6,         // 鼠标视角跟随幅度（0 = 不跟随；越大位移越明显，原 1.0）
  parallaxFollow: 0.09,  // 跟随响应速度 lerp 系数（0~1，越大跟得越快，原 0.05）
  fadeScrollRatio: 0.8,  // 滚动淡出距离占视口高度的比例（0.8 = 滚 80% 屏高完全淡出）
  dprCap: 2              // 设备像素比上限，防止高分屏 / 移动端性能压力
};
/* --------------------------------------------------------- */

(function initBackground() {
  const canvas = document.getElementById('wireframe-canvas');
  if (!canvas) return;

  // 允许在 canvas 标签上用 data-wire-color 覆盖线框颜色，例如
  // <canvas id="wireframe-canvas" data-wire-color="#66aadd"></canvas>
  const customColor = canvas.dataset.wireColor;
  if (customColor) CONFIG.wireColor = new THREE.Color(customColor).getHex();

  // WebGL 不可用时静默降级：隐藏画布，页面仍显示纯 CSS 深色底
  try {
    const testGL = document.createElement('canvas').getContext('webgl') ||
                   document.createElement('canvas').getContext('experimental-webgl');
    if (!testGL) { canvas.style.display = 'none'; return; }
  } catch (err) {
    canvas.style.display = 'none';
    return;
  }

  /* ---------- 渲染器 / 场景 / 相机 ---------- */
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,      // 透明背景，透出 CSS 的页面底色 #080b10
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.dprCap));
  // 第三个参数 false：只设置绘图缓冲区分辨率，不写 canvas 的内联宽高，
  // 画布显示尺寸完全交给 CSS（100% / dvh），避免手机地址栏收放时尺寸错位
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();

  // 透视相机：初始位置略抬高，俯视网格地面
  const camera = new THREE.PerspectiveCamera(
    52, window.innerWidth / window.innerHeight, 0.1, 200
  );
  const cameraBase = { x: 0, y: 3.0, z: 7.4 }; // 相机基准位置（鼠标跟随围绕它偏移）
  camera.position.set(cameraBase.x, cameraBase.y, cameraBase.z);
  const lookTarget = new THREE.Vector3(0, 0.9, 0); // 视线焦点
  camera.lookAt(lookTarget);

  // 统一的线框材质
  const lineMaterial = new THREE.LineBasicMaterial({ color: CONFIG.wireColor });

  /* ---------- 网格地面 ---------- */
  const grid = new THREE.GridHelper(
    CONFIG.gridSize,
    CONFIG.gridDivisions,
    CONFIG.wireColor, // 中心线颜色
    CONFIG.wireColor  // 普通格线颜色
  );
  grid.material.transparent = true;
  grid.material.opacity = CONFIG.gridOpacity;
  scene.add(grid);

  /* ---------- 线框立方体（EdgesGeometry 只画棱边，更像工程制图） ---------- */
  const boxGeo = new THREE.BoxGeometry(CONFIG.boxSize, CONFIG.boxSize, CONFIG.boxSize);
  const boxEdges = new THREE.EdgesGeometry(boxGeo);
  const box = new THREE.LineSegments(boxEdges, lineMaterial);
  box.position.set(0.6, 1.35, 0);
  scene.add(box);

  /* ---------- 线框圆环（WireframeGeometry 画完整线框） ---------- */
  const torusGeo = new THREE.TorusGeometry(CONFIG.torusRadius, CONFIG.torusTube, 12, 32);
  const torusWire = new THREE.WireframeGeometry(torusGeo);
  const torus = new THREE.LineSegments(torusWire, lineMaterial);
  torus.position.set(-3.0, 1.7, -0.8);
  torus.rotation.set(0.9, 0.3, 0); // 初始倾斜角度
  scene.add(torus);

  /* ---------- 指针移动：归一化坐标，相机平滑跟随偏移 ----------
   * 桌面端监听 mousemove；移动端监听 touchstart / touchmove，
   * 用第一根手指的位置映射成与鼠标完全一致的 -1 ~ 1 坐标。
   * 注意：触摸监听使用 passive:true 且不 preventDefault，
   * 因此页面原生滚动 / 滚出淡出效果不受影响——手指滑动页面时相机同步跟随。
   */
  const mouse = { x: 0, y: 0 }; // 目标值（-1 ~ 1）
  const view = { x: 0, y: 0 };  // 当前值（lerp 平滑后的结果）

  // 把客户端坐标换算为归一化设备坐标（横、纵均为 -1 ~ 1）
  function updatePointer(clientX, clientY) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  // 桌面端：鼠标移动
  window.addEventListener('mousemove', function (e) {
    updatePointer(e.clientX, e.clientY);
  });

  // 移动端：手指按下 / 滑动时取第一根触摸点（单指控制，忽略多指避免跳动）
  function handleTouch(e) {
    if (e.touches.length > 0) {
      updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    }
  }
  window.addEventListener('touchstart', handleTouch, { passive: true });
  window.addEventListener('touchmove', handleTouch, { passive: true });

  /* ---------- 窗口尺寸变化：同步画布与相机（含移动端横竖屏 / 地址栏收放） ---------- */
  window.addEventListener('resize', onResize);
  // iOS / 安卓浏览器地址栏收起、展开时不一定触发 window resize，
  // 监听 visualViewport 才能拿到实时可视区尺寸，防止画布高度异常
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
  }
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.dprCap));
    renderer.setSize(w, h, false); // 同样不写内联样式
  }

  /* ---------- 页面隐藏时暂停渲染，节省电量 / GPU ---------- */
  let rafId = null;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      // 离开页面：取消待执行帧，停止循环
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (rafId === null) {
      // 回到页面：仅在没有循环在跑时重启，避免 rAF 链重复调度
      animate();
    }
  });

  // 尊重系统「减少动态效果」偏好：开启后几何体不再自转
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 主循环：自转 + 鼠标视差 + 滚动淡出 ---------- */
  function animate() {
    rafId = requestAnimationFrame(animate);

    // 几何体缓慢自转（两个几何体轴向不同，避免运动雷同）
    if (!reduceMotion) {
      box.rotation.x += CONFIG.rotSpeed * 0.7;
      box.rotation.y += CONFIG.rotSpeed;
      torus.rotation.x += CONFIG.rotSpeed * 0.5;
      torus.rotation.y += CONFIG.rotSpeed * 0.9;
    }

    // 相机视角平滑跟随鼠标（parallaxFollow 越小越柔和、越大越跟手灵敏）
    view.x += (mouse.x - view.x) * CONFIG.parallaxFollow;
    view.y += (mouse.y - view.y) * CONFIG.parallaxFollow;
    camera.position.x = cameraBase.x + view.x * 1.2 * CONFIG.parallax;
    camera.position.y = cameraBase.y + view.y * 0.8 * CONFIG.parallax;
    camera.lookAt(lookTarget);

    // 滚动时画布线性淡出：滚过 fadeScrollRatio 比例的视口高度后完全透明
    const fadeDistance = window.innerHeight * CONFIG.fadeScrollRatio;
    const opacity = Math.max(0, 1 - window.scrollY / fadeDistance);
    canvas.style.opacity = String(opacity);

    renderer.render(scene, camera);
  }

  animate();
})();
