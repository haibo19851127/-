/* ============================================================
 * nav.js · 全站公共导航组件（顶部多级菜单 + 左侧栏目树 + 面包屑）
 * 所有页面共用，禁止复制菜单代码。
 *
 * 页面需要的占位元素（缺哪个就不渲染哪个，互不影响）：
 *   <div id="site-nav"></div>         顶部主导航（必需）
 *   <div id="site-breadcrumb"></div>  面包屑（放在内容区顶部）
 *   <div id="site-sidebar"></div>     左侧栏目树（首页等列表页使用）
 *
 * 【如何新增栏目】只需在下方 SITE_TREE 里加节点：
 *   { id:'唯一ID', label:'显示名' }                      纯分类（用于筛选文章）
 *   { id:'...', label:'...', href:'about.html' }         带链接的栏目
 *   { id:'...', label:'...', children:[ ... ] }          带子栏目（可继续嵌套到三级）
 * 新增分类后，在文章卡片上加 data-cat="该分类ID" 即可被筛选。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 基础路径：articles 子目录下回退一级 ---------- */
  var inSubDir = /\/articles\//.test(location.pathname);
  var root = inSubDir ? '../' : './';

  /* 品牌文字（左上角） */
  var BRAND_TEXT = 'ENGINEERING BLOG';

  /* ============================================================
   * 全站栏目树（一处定义，顶部导航 / 侧边栏树 / 面包屑共用）
   * 层级：一级 → 二级 → 三级（参考 0099 多级栏目结构）
   * ============================================================ */
  var SITE_TREE = [
    { id: 'home', label: '首页', href: 'index.html' },

    {
      id: 'notes', label: '技术笔记', children: [
        {
          id: 'frontend', label: '前端开发', children: [
            { id: 'threejs', label: 'Three.js 3D' },   // 三级分类：筛选对应文章
            { id: 'htmlcss', label: 'HTML / CSS' }
          ]
        },
        {
          id: 'engineering', label: '工程实践', children: [
            { id: 'deploy', label: '部署运维' },
            { id: 'toolchain', label: '工具链' }
          ]
        }
      ]
    },

    {
      id: 'cases', label: '项目案例', children: [
        { id: 'webcase', label: 'Web 应用' },
        { id: 'labs', label: '实验项目' }
      ]
    },

    // 图片功能查看栏：独立图库页，复用懒加载 + 点击大图预览组件
    { id: 'gallery', label: '图片库', href: 'gallery.html' },

    {
      id: 'about', label: '关于', href: 'about.html', children: [
        { id: 'about-site', label: '关于本站', href: 'about.html' },
        { id: 'contact', label: '联系方式', href: 'about.html#contact' }
      ]
    }
  ];

  /* 文章详情页文件名 → 所属三级分类 ID（用于面包屑与菜单高亮） */
  var PAGE_CATEGORY = {
    'article-1.html': 'threejs'
  };

  var currentFile = location.pathname.split('/').pop() || 'index.html';

  /* ---------------- 工具函数 ---------------- */

  // 把节点链接补全为相对路径（href 为空表示纯分类节点）
  function nodeHref(node) {
    return node.href ? root + node.href : null;
  }

  // 分类节点在首页的筛选链接（hash 形式，首页读取后执行筛选）
  function filterHref(id) {
    return root + 'index.html#cat=' + id;
  }

  // 深度优先查找某个 id 节点，返回从根到它的路径数组（用于面包屑 / 高亮祖先）
  function findPath(nodes, id, trail) {
    trail = trail || [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var next = trail.concat(n);
      if (n.id === id) return next;
      if (n.children) {
        var found = findPath(n.children, id, next);
        if (found) return found;
      }
    }
    return null;
  }

  // 取某节点下所有后代分类 id（含自身），点父栏目时可整组筛选
  function subtreeIds(node) {
    var ids = [node.id];
    (function walk(list) {
      list.forEach(function (n) {
        ids.push(n.id);
        if (n.children) walk(n.children);
      });
    })(node.children || []);
    return ids;
  }

  // 当前页对应的“当前栏目 id”
  function currentCategoryId() {
    // 首页优先识别 hash：index.html#cat=threejs
    var hashMatch = location.hash.match(/cat=([\w-]+)/);
    if (currentFile === 'index.html' && hashMatch) return hashMatch[1];
    if (PAGE_CATEGORY[currentFile]) return PAGE_CATEGORY[currentFile];
    if (currentFile === 'gallery.html') return 'gallery';
    if (currentFile === 'about.html') return 'about';
    if (currentFile === 'index.html') return 'home';
    return null;
  }

  /* ============================================================
   * 顶部主导航（一级横排，hover 下拉二级，三级右弹）
   * ============================================================ */
  function renderTopNav() {
    var activeId = currentCategoryId();
    var activePath = activeId ? findPath(SITE_TREE, activeId) : null;

    var items = SITE_TREE.map(function (node) {
      var inActivePath = activePath && activePath.indexOf(node) !== -1;
      var cls = 'nav-item' + (node.children ? ' has-drop' : '') +
                (inActivePath ? ' active' : '');

      // 一级标题：有链接用 a，纯分类父节点用 button（移动端点击可展开下拉）
      var title;
      var href = nodeHref(node);
      if (href) {
        title = '<a class="nav-label" href="' + href + '">' + node.label + '</a>';
      } else {
        title = '<button class="nav-label" type="button">' + node.label + '</button>';
      }

      var dropdown = '';
      if (node.children) dropdown = '<ul class="dropdown">' +
        node.children.map(renderNavLevel2).join('') + '</ul>';

      return '<li class="' + cls + '">' + title + dropdown + '</li>';
    }).join('');

    return (
      '<nav class="site-nav">' +
        '<a class="nav-brand" href="' + root + 'index.html">' + BRAND_TEXT + '</a>' +
        '<button class="nav-toggle" type="button" aria-label="展开菜单">≡</button>' +
        '<ul class="nav-links">' + items + '</ul>' +
      '</nav>'
    );
  }

  // 二级：若含三级则右侧弹出子菜单
  function renderNavLevel2(node) {
    var href = nodeHref(node);
    var title = href
      ? '<a class="nav-label" href="' + href + '">' + node.label + '</a>'
      : '<button class="nav-label" type="button">' + node.label + '</button>';

    var sub = '';
    if (node.children) {
      sub = '<ul class="submenu">' + node.children.map(function (leaf) {
        var leafHref = nodeHref(leaf) || filterHref(leaf.id);
        return '<li><a href="' + leafHref + '">' + leaf.label + '</a></li>';
      }).join('') + '</ul>';
      return '<li class="has-sub">' + title + sub + '</li>';
    }
    // 无子级：纯分类节点跳到首页并按分类筛选
    if (!href) {
      title = '<a class="nav-label" href="' + filterHref(node.id) + '">' +
              node.label + '</a>';
    }
    return '<li>' + title + '</li>';
  }

  /* ============================================================
   * 左侧栏目树（可展开 / 折叠，点击分类筛选首页文章）
   * ============================================================ */
  function renderSidebar() {
    // “全部文章”固定置顶
    var allActive = (currentFile === 'index.html' && !/cat=/.test(location.hash));
    var head =
      '<div class="sidebar-head">' +
        '<span>栏目目录</span>' +
        '<button class="sidebar-collapse" type="button" title="收起侧栏">‹</button>' +
      '</div>';

    var allItem = '<li class="tree-node">' +
      '<a class="tree-leaf' + (allActive ? ' active' : '') +
      '" href="' + root + 'index.html">全部文章</a></li>';

    return '<aside class="sidebar" id="sidebar">' +
      head +
      '<ul class="tree" id="category-tree">' +
        allItem + SITE_TREE.map(renderTreeNode).join('') +
      '</ul>' +
    '</aside>';
  }

  // 递归渲染树节点（二级、三级）
  function renderTreeNode(node, depth) {
    depth = depth || 0;
    var activeId = currentCategoryId();
    var path = activeId ? findPath(SITE_TREE, activeId) : null;
    var inPath = path && path.indexOf(node) !== -1;

    var hasChildren = !!node.children;
    var rowCls = 'tree-row' + (inPath ? ' active' : '');
    var styleAttr = depth ? ' style="padding-left:' + (12 + depth * 14) + 'px"' : '';

    // 箭头按钮：仅展开 / 折叠，不触发跳转
    var arrow = hasChildren
      ? '<button class="tree-arrow" type="button" aria-label="折叠">▸</button>'
      : '<span class="tree-dot"></span>';

    var href = nodeHref(node) || (hasChildren ? null : filterHref(node.id));
    var label = href
      ? '<a class="tree-label" href="' + href + '">' + node.label + '</a>'
      : '<button class="tree-label" type="button">' + node.label + '</button>';

    var row = '<div class="' + rowCls + '"' + styleAttr + '>' +
              arrow + label + '</div>';

    var childHtml = '';
    if (hasChildren) {
      // 当前栏目所在分支默认展开
      childHtml = '<ul class="tree-children' + (inPath ? ' open' : '') + '">' +
        node.children.map(function (c) { return renderTreeNode(c, depth + 1); }).join('') +
        '</ul>';
    }
    return '<li class="tree-node' + (hasChildren ? ' has-children' : '') +
           (inPath ? ' branch-active' : '') + '" data-id="' + node.id + '"' +
           (node.href ? ' data-page="1"' : '') + '>' +
           row + childHtml + '</li>';
  }

  /* ============================================================
   * 面包屑
   * ============================================================ */
  function renderBreadcrumb() {
    var activeId = currentCategoryId();
    var path = activeId ? findPath(SITE_TREE, activeId) : null;

    var parts = [{ label: '首页', href: root + 'index.html' }];
    if (path) {
      path.forEach(function (n, i) {
        if (n.id === 'home') return; // 首页已在 parts 首位
        var href = nodeHref(n) || (!n.children ? filterHref(n.id) : null);
        parts.push({ label: n.label, href: href });
      });
    }
    // 文章详情页：末尾补当前文章标题（取自页面 h1）
    if (PAGE_CATEGORY[currentFile]) {
      var h1 = document.querySelector('.page-title');
      if (h1) parts.push({ label: h1.textContent.trim(), href: null });
    }

    var html = parts.map(function (p, i) {
      var last = i === parts.length - 1;
      if (last || !p.href) return '<span class="crumb-current">' + p.label + '</span>';
      return '<a href="' + p.href + '">' + p.label + '</a>';
    }).join('<span class="crumb-sep">/</span>');

    return '<nav class="breadcrumb">' + html + '</nav>';
  }

  /* ============================================================
   * 首页文章筛选：点击左侧栏目树 → 切换右侧图文卡片
   * ============================================================ */
  function initCategoryFilter() {
    var listEl = document.querySelector('.article-list');
    if (!listEl) return;
    var cards = Array.prototype.slice.call(listEl.querySelectorAll('.article-card'));
    var titleEl = document.getElementById('list-title');
    var countEl = document.getElementById('list-count');

    function applyFilter(id, label) {
      // 点到父栏目时，匹配它整棵子树下的全部分类
      var matchIds = [id];
      var path = findPath(SITE_TREE, id);
      if (path && path.length) {
        var node = path[path.length - 1];
        if (node.children) matchIds = subtreeIds(node);
      }
      var shown = 0;
      cards.forEach(function (card) {
        var cats = (card.getAttribute('data-cat') || '').split(/\s+/);
        var hit = false;
        for (var i = 0; i < matchIds.length; i++) {
          if (cats.indexOf(matchIds[i]) !== -1) { hit = true; break; }
        }
        var match = (id === 'all') || hit;
        card.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      if (titleEl && label) titleEl.textContent = label;
      if (countEl) countEl.textContent = shown + ' 篇';
      // 空栏目提示
      var empty = document.getElementById('list-empty');
      if (empty) empty.style.display = shown ? 'none' : '';
    }

    // 依据 hash（含从其他页面点三级菜单跳回）执行筛选
    function syncFromHash() {
      var m = location.hash.match(/cat=([\w-]+)/);
      if (!m) {
        applyFilter('all', '全部文章');
        return;
      }
      var path = findPath(SITE_TREE, m[1]);
      var label = path ? path[path.length - 1].label : '全部文章';
      applyFilter(m[1], label);
    }

    window.addEventListener('hashchange', syncFromHash);
    syncFromHash();

    // 暴露给树节点点击（事件委托，见 bindInteractions）
    window.__siteFilter = applyFilter;
  }

  /* ============================================================
   * 交互绑定：汉堡菜单 / 树展开 / 侧栏收起 / 移动端下拉手风琴
   * ============================================================ */
  function bindInteractions() {
    var navMount = document.getElementById('site-nav');
    if (navMount) {
      var toggle = navMount.querySelector('.nav-toggle');
      var links = navMount.querySelector('.nav-links');

      // 汉堡按钮（移动端）：展开 / 收起整个导航
      toggle.addEventListener('click', function () {
        links.classList.toggle('open');
      });

      // 移动端：点纯分类父节点（button.nav-label）改为手风琴展开，不跳转
      links.addEventListener('click', function (e) {
        if (window.matchMedia('(max-width: 768px)').matches) {
          // 一级父菜单：技术笔记 / 项目案例
          var topBtn = e.target.closest ? e.target.closest('.nav-item > .nav-label') : null;
          if (topBtn && topBtn.tagName === 'BUTTON') {
            e.preventDefault();
            topBtn.parentNode.classList.toggle('open');
          }
          // 二级父菜单：前端开发 / 工程实践（右侧弹三级的那一层）
          var subBtn = e.target.closest ? e.target.closest('.has-sub > .nav-label') : null;
          if (subBtn && subBtn.tagName === 'BUTTON') {
            e.preventDefault();
            subBtn.parentNode.classList.toggle('open');
          }
        }
        // 点具体链接后收起移动菜单
        if (e.target.tagName === 'A') links.classList.remove('open');
      });
    }

    // 左侧栏目树交互
    var tree = document.getElementById('category-tree');
    if (tree) {
      tree.addEventListener('click', function (e) {
        // 箭头：展开折叠子树
        var arrow = e.target.closest ? e.target.closest('.tree-arrow') : null;
        if (arrow) {
          e.preventDefault();
          var li = arrow.closest('.tree-node');
          var childBox = li.querySelector('.tree-children');
          if (childBox) {
            childBox.classList.toggle('open');
            arrow.classList.toggle('open');
          }
          return;
        }
        // 父分类标题（button.tree-label）：移动端/桌面都允许展开；
        // 在首页同时按该分支整组筛选
        var parentLabel = e.target.closest ? e.target.closest('button.tree-label') : null;
        if (parentLabel) {
          e.preventDefault();
          var nodeLi = parentLabel.closest('.tree-node');
          var childBox2 = nodeLi.querySelector('.tree-children');
          if (childBox2) {
            childBox2.classList.toggle('open');
            var ar = nodeLi.querySelector('.tree-arrow');
            if (ar) ar.classList.toggle('open');
          }
          if (window.__siteFilter) {
            var id = nodeLi.getAttribute('data-id');
            window.__siteFilter(id, parentLabel.textContent.trim());
            history.replaceState(null, '', '#cat=' + id);
          }
          return;
        }
        // 叶子分类链接：首页不跳转，直接筛选
        var leaf = e.target.closest ? e.target.closest('a.tree-label, a.tree-leaf') : null;
        if (leaf && currentFile === 'index.html' && window.__siteFilter) {
          // “全部文章”：清除筛选与 hash
          if (leaf.classList.contains('tree-leaf')) {
            e.preventDefault();
            window.__siteFilter('all', '全部文章');
            history.replaceState(null, '', location.pathname);
            return;
          }
          var nodeLi2 = leaf.closest('.tree-node');
          if (nodeLi2) {
            // 指向真实页面的节点（首页 / 关于）：放行默认跳转，不做筛选
            if (nodeLi2.getAttribute('data-page') === '1') return;
            e.preventDefault();
            var lid = nodeLi2.getAttribute('data-id');
            if (lid) {
              window.__siteFilter(lid, leaf.textContent.trim());
              history.replaceState(null, '', '#cat=' + lid);
            }
          }
        }
      });
    }

    // 侧栏整体收起 / 展开（记忆用户选择）
    var collapseBtn = document.querySelector('.sidebar-collapse');
    var layout = document.querySelector('.layout');
    if (collapseBtn && layout) {
      if (localStorage.getItem('sidebar-collapsed') === '1') {
        layout.classList.add('sidebar-collapsed');
      }
      collapseBtn.addEventListener('click', function () {
        var collapsed = layout.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
      });
    }
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    var navMount = document.getElementById('site-nav');
    if (navMount) navMount.innerHTML = renderTopNav();

    var crumbMount = document.getElementById('site-breadcrumb');
    if (crumbMount) crumbMount.innerHTML = renderBreadcrumb();

    var sideMount = document.getElementById('site-sidebar');
    if (sideMount) sideMount.innerHTML = renderSidebar();

    initCategoryFilter();
    bindInteractions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
