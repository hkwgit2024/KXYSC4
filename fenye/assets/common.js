const MODE_KEY = 'site_mode';
const btn = document.getElementById('modeToggleBtn');
let searchBox = document.getElementById('search');
let mainCard = document.querySelector('.main-card');
let navTabs = document.getElementById('navTabs');

const API_DOMAINS = [
  { tag: "备份一线", base: "https://0.12yue.de5.net/tvbox/" },
  { tag: "备份二线", base: "https://0.cdz.qzz.io/tvbox/" },
  { tag: "备份三线", base: "https://0.wdzb.eu.cc/tvbox/" }
];

const LIVE_DOMAINS = [
  { tag: "备份一线", base: "https://0.12yue.de5.net/tvbox/" },
  { tag: "备份二线", base: "https://0.cdz.qzz.io/tvbox/" },
  { tag: "备份三线", base: "https://0.wdzb.eu.cc/tvbox/" }
];

const API_WEIGHTS = {
  "轮替占位.json": 1, "幸福年年.json": 2, "饭太硬.json": 4, "肥猫.json": 5,
  "摸鱼.json": 6, "王二小.json": 7, "集多.json": 8, "潇洒.json": 9,
  "小米.json": 10, "嗷呜.json": 11, "南风.json": 12, "小虎斑.json": 13
};

const ROTATE_KEYWORDS = ["模糊搜索","模糊搜索"];

let currentMode = localStorage.getItem(MODE_KEY) || 'simple';
let currentTabId = 'api';
let topSeed = Date.now();
let DOWNLOAD_SOURCES = [];
let DANMU_SOURCES = [];
let SITE_CONFIG = null;
let rawListText = null;
let rawLiveText = null;

document.addEventListener('click', function(e) {
  const copyBtn = e.target.closest('.copy-btn');
  if (!copyBtn) return;
  e.preventDefault(); e.stopPropagation();
  const url = copyBtn.getAttribute('data-url');
  if (!url) return;
  const done = () => {
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅ 已复制';
    copyBtn.classList.add('copied');
    setTimeout(() => { copyBtn.textContent = originalText; copyBtn.classList.remove('copied'); }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(fallbackCopy);
  } else { fallbackCopy(); }
  function fallbackCopy() {
    const input = document.createElement('input');
    input.value = url; input.style.position = 'fixed'; input.style.opacity = '0';
    document.body.appendChild(input); input.focus(); input.select();
    try { document.execCommand('copy'); } catch(_) {}
    document.body.removeChild(input); done();
  }
});

function getTopItem(rotateItems) {
  if (!rotateItems || !rotateItems.length) return null;
  if (rotateItems.length === 1) return rotateItems[0];
  const idx = Math.abs(Math.floor(Math.sin(topSeed) * 10000)) % rotateItems.length;
  return rotateItems[idx];
}

function formatDateToChinese(d) {
  if (!d || d.length !== 8) return '----';
  return d.slice(0,4) + '年' + d.slice(4,6) + '月' + d.slice(6,8) + '日';
}

function isRecent(d) {
  if (!d || d.length !== 8) return false;
  const y = parseInt(d.slice(0,4));
  const m = parseInt(d.slice(4,6)) - 1;
  const day = parseInt(d.slice(6,8));
  return (Date.now() - new Date(y, m, day).getTime()) / 86400000 <= 2;
}

function getInitials(name) {
  if (!name) return '?';
  return name.slice(0,1).toUpperCase();
}

async function loadConfig() {
  try {
    const res = await fetch('config.json?t=' + Date.now() + '&r=' + Math.random(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    SITE_CONFIG = await res.json();
    DOWNLOAD_SOURCES = Array.isArray(SITE_CONFIG.downloadSources) ? SITE_CONFIG.downloadSources : [];
    DANMU_SOURCES = Array.isArray(SITE_CONFIG.danmuSources) ? SITE_CONFIG.danmuSources : [];
    renderContributors(SITE_CONFIG.about && SITE_CONFIG.about.contributors);
  } catch(e) { DOWNLOAD_SOURCES = []; DANMU_SOURCES = []; renderContributors([]); }
}

function renderContributors(list) {
  const container = document.getElementById('contributors-list');
  if (!container) return;
  if (!Array.isArray(list) || !list.length) {
    container.innerHTML = '<div class="error-msg">暂无合作共创人员</div>';
    return;
  }
  container.innerHTML = list.map(c => `
    <div class="contributor-card" data-name="${(c.name || '').toLowerCase()}">
      ${c.avatar ? `<img class="contributor-avatar" src="${c.avatar}" alt="${c.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="contributor-avatar" style="display:none">${getInitials(c.name)}</div>` : `<div class="contributor-avatar">${getInitials(c.name)}</div>`}
      <div class="contributor-info">
        <div class="contributor-name" title="${c.name}">${c.name}</div>
        ${c.role ? `<div class="contributor-role">${c.role}</div>` : ''}
        ${c.desc ? `<div class="contributor-desc">${c.desc}</div>` : ''}
        ${c.social ? `<div class="contributor-social">${c.social}</div>` : ''}
      </div>
    </div>`).join('');
}

async function fetchListText() {
  if (rawListText !== null) return rawListText;
  const res = await fetch('list.txt?t=' + Date.now() + '&r=' + Math.random(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  rawListText = await res.text();
  return rawListText;
}

function parseItems(text) {
  if (!text || !text.trim()) return [];
  return text.trim().split('\n').filter(l => l.trim()).map(line => {
    const p = line.split('|').map(s => s.trim());
    if (!p[0]) return null;
    return { file: p[0], name: p[0].replace(/\.json$/i, ''), date: p[1] || '', size: p[2] || '', origUrl: p[3] || '', weight: API_WEIGHTS.hasOwnProperty(p[0]) ? API_WEIGHTS[p[0]] : 999 };
  }).filter(Boolean);
}

function renderApi() {
  const container = document.getElementById('listContainer');
  if (!container) return;
  fetchListText().then(text => {
    const tip = document.getElementById('apiLoading');
    if (tip) tip.style.display = 'none';
    let items = parseItems(text);
    if (!items.length) { container.innerHTML = '<div class="error-msg">⚠️ 接口列表为空</div>'; return; }
    const ri = items.filter(i => { const lower = i.name.toLowerCase(); return ROTATE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase())); });
    const top = getTopItem(ri);
    if (top) top.weight = Number.MIN_SAFE_INTEGER;
    items.sort((a, b) => a.weight - b.weight);
    let html = '';
    items.forEach(it => {
      const isNew = isRecent(it.date);
      let lines = '';
      if (it.origUrl) lines += `<div class="url-line"><span class="url-tag">原始线路</span><span class="url-text">${it.origUrl}</span><button class="copy-btn" data-url="${it.origUrl}">复制</button></div>`;
      API_DOMAINS.forEach(d => {
        const u = d.base + it.name + '.json';
        lines += `<div class="url-line"><span class="url-tag">${d.tag}</span><span class="url-text">${u}</span><button class="copy-btn" data-url="${u}">复制</button></div>`;
      });
      html += `<div class="api-item" data-name="${it.name.toLowerCase()}"><div class="api-item-header"><div class="api-item-name" title="${it.name}">${it.name}</div><div class="api-item-meta"><span class="${isNew ? 'badge-new' : 'badge-old'}">备份时间 ${formatDateToChinese(it.date)}</span>${it.size ? '&nbsp;&nbsp;' + it.size : ''}</div></div><div class="api-item-urls">${lines}</div></div>`;
    });
    container.innerHTML = html;
  }).catch(err => {
    const tip = document.getElementById('apiLoading');
    if (tip) tip.style.display = 'none';
    container.innerHTML = `<div class="error-msg">❌ ${err.message || err}</div>`;
  });
}

async function fetchLiveText() {
  if (rawLiveText !== null) return rawLiveText;
  const res = await fetch('livelist.txt?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  rawLiveText = await res.text();
  return rawLiveText;
}

function parseLiveItems(text) {
  if (!text || !text.trim()) return [];
  return text.trim().split('\n').filter(l => l.trim()).map(line => {
    const p = line.split('|').map(s => s.trim());
    if (!p[0]) return null;
    return { name: p[0] || '', displayName: p[0].replace(/\.[^.]+$/, ''), date: p[1] || '', size: p[2] || '', origUrl: p[3] || '', source: p[4] || '', ua: p[5] || '' };
  }).filter(Boolean);
}

function renderLiveList() {
  const container = document.getElementById('liveListContainer');
  if (!container) return;
  const loading = document.getElementById('liveLoading');
  fetchLiveText().then(text => {
    if (loading) loading.style.display = 'none';
    const items = parseLiveItems(text);
    if (!items.length) { container.innerHTML = '<div class="error-msg">⚠️ 直播列表为空</div>'; return; }
    let html = '';
    items.forEach(it => {
      const isNew = isRecent(it.date);
      let urls = '';
      if (it.origUrl) {
        urls += `<div class="live-url-line"><div class="live-info-inline"><span>来源：${it.source || '未知'}</span>${it.ua ? `<span class="sep">|</span><span>UA：${it.ua}</span>` : ''}</div><div class="live-url-body"><span class="live-url-tag">原始线路</span><span class="live-url-text">${it.origUrl}</span><button class="copy-btn" data-url="${it.origUrl}">复制</button></div></div>`;
      }
      LIVE_DOMAINS.forEach(d => {
        const u = d.base + it.name;
        urls += `<div class="live-url-line"><div class="live-url-body"><span class="live-url-tag">${d.tag}</span><span class="live-url-text">${u}</span><button class="copy-btn" data-url="${u}">复制</button></div></div>`;
      });
      html += `<div class="live-item" data-name="${it.displayName.toLowerCase()}"><div class="live-item-header"><div class="live-item-name" title="${it.displayName}">${it.displayName}</div><div class="live-item-meta"><span class="${isNew ? 'live-badge-new' : 'live-badge-old'}">备份时间 ${formatDateToChinese(it.date)}</span>${it.size ? '&nbsp;&nbsp;' + it.size : ''}</div></div><div class="live-item-urls">${urls}</div></div>`;
    });
    container.innerHTML = html;
  }).catch(err => {
    if (loading) loading.style.display = 'none';
    container.innerHTML = `<div class="error-msg">❌ ${err.message || err}</div>`;
  });
}

async function renderDownloads(force) {
  const container = document.getElementById('downloads-content');
  if (!container || (container.dataset.rendered && !force)) return;
  container.dataset.rendered = 'true';
  container.innerHTML = '<div class="loading">⏳ 正在加载下载资源...</div>';
  if (!DOWNLOAD_SOURCES.length) { container.innerHTML = '<div class="error-msg">⚠️ 未配置下载源</div>'; return; }
  let html = '';
  for (const src of DOWNLOAD_SOURCES) {
    try {
      const res = await fetch(src.url + '?t=' + Date.now() + '&r=' + Math.random(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.text();
      const cleaned = raw.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/：/g, ':').replace(/，/g, ',');
      const data = JSON.parse(cleaned);
      let section = `<div style="background:#f8fafc;border-radius:12px;padding:12px 14px;margin-bottom:12px;border:1px solid #eef2f7;">`;
      if (src.name) section += `<div style="font-size:.95rem;font-weight:600;color:#0b1e33;margin-bottom:2px;">${src.name}</div>`;
      if (src.description) section += `<div style="font-size:.7rem;color:#8b9eb0;margin-bottom:10px;">${src.description}</div>`;
      section += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;width:100%;max-width:100%;overflow:hidden;">`;
      (data.list || data).forEach(group => {
        (group.list || []).forEach(i => {
          section += `<a class="download-card" href="${i.url || '#'}" target="_blank" rel="noopener noreferrer" data-name="${(i.name || '').toLowerCase()}"><img src="${i.icon || ''}" onerror="this.style.visibility='hidden'" style="width:90%;max-width:100%;height:auto;aspect-ratio:1/1;border-radius:10px;margin-bottom:14px;object-fit:cover;background:#f0f3f8;"><div style="flex:1;width:100%;margin-top:auto;"><div style="font-size:.76rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.name || ''}</div>${i.version ? `<div style="font-size:.6rem;color:#8b9eb0;margin-top:2px;">${i.version}</div>` : ''}</div></a>`;
        });
      });
      html += section + '</div></div>';
    } catch(e) { html += `<div class="error-msg">❌ ${src.name} ${e.message}</div>`; }
  }
  container.innerHTML = html;
}

function renderDanmu() {
  const container = document.getElementById('danmu-content');
  if (!container) return;
  if (!DANMU_SOURCES.length) { container.innerHTML = '<div class="error-msg">⚠️ 未配置弹幕源</div>'; return; }
  let rows = '';
  DANMU_SOURCES.forEach(s => {
    rows += `<div class="danmu-item" data-name="${s.name.toLowerCase()}" style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:#fff;border-radius:50px;border:1px solid #e0e6ed;margin-top:8px"><span style="flex:0 0 auto;font-size:.78rem;font-weight:600;color:#0b1e33">${s.name}</span><span style="flex:1;font-size:.75rem;color:#2563eb;word-break:break-all">${s.url}</span><button class="copy-btn" data-url="${s.url}">复制</button></div>`;
  });
  container.innerHTML = `<div style="background:#f8fafc;border-radius:12px;padding:14px 16px;border:1px solid #eef2f7"><h3 style="font-size:.92rem;font-weight:600;color:#0b1e33;margin-bottom:4px">💬 弹幕接口</h3><p style="font-size:.76rem;color:#5a6f88;margin-bottom:4px">共 ${DANMU_SOURCES.length} 条，点击「复制」把地址填入播放器的弹幕接口。</p>${rows}</div>`;
}

const tabsData = [
  { id: "api", label: "点播", hideSearch: false },
  { id: "live", label: "直播", hideSearch: false },
  { id: "download", label: "下载", hideSearch: false },
  { id: "danmu", label: "弹幕", hideSearch: true },
  { id: "about", label: "关于", hideSearch: true }
];

function renderTabs() {
  const nav = document.getElementById('navTabs');
  if (!nav) return;
  nav.innerHTML = tabsData.map(t => `<button class="nav-tab ${t.id === currentTabId ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');
  nav.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      nav.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      currentTabId = this.getAttribute('data-tab');
      showPanel(currentTabId);
    });
  });
}

function showPanel(tabId) {
  searchBox = document.getElementById('search');
  if (searchBox) {
    searchBox.value = '';
    document.querySelectorAll('#api-panel .api-item.hidden').forEach(e => e.classList.remove('hidden'));
    document.querySelectorAll('#live-panel .live-item.hidden').forEach(e => e.classList.remove('hidden'));
    document.querySelectorAll('.download-card.hidden').forEach(e => e.classList.remove('hidden'));
    document.querySelectorAll('#danmu-panel .danmu-item.hidden').forEach(e => e.classList.remove('hidden'));
    document.querySelectorAll('.contributor-card.hidden').forEach(e => e.classList.remove('hidden'));
  }
  if (tabId === 'api') { topSeed = Date.now() + Math.random(); renderApi(); }
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(tabId + '-panel');
  if (panel) panel.classList.add('active');
  if (tabId === 'live') renderLiveList();
  if (tabId === 'download') renderDownloads();
  if (tabId === 'danmu') renderDanmu();
  const t = tabsData.find(t => t.id === tabId);
  if (searchBox) searchBox.style.display = (t && t.hideSearch) ? 'none' : '';
}

function globalSearch() {
  searchBox = document.getElementById('search');
  if (!searchBox) return;
  const kw = (searchBox.value || '').toLowerCase().trim();
  document.querySelectorAll('#api-panel .api-item').forEach(e => { const n = e.getAttribute('data-name') || ''; e.classList.toggle('hidden', !n.includes(kw)); });
  document.querySelectorAll('#live-panel .live-item').forEach(e => { const n = e.getAttribute('data-name') || ''; e.classList.toggle('hidden', !n.includes(kw)); });
  if (currentMode !== 'simple') {
    document.querySelectorAll('.download-card').forEach(c => { const n = c.getAttribute('data-name') || ''; c.classList.toggle('hidden', !n.includes(kw)); });
    document.querySelectorAll('#danmu-panel .danmu-item').forEach(e => { const n = e.getAttribute('data-name') || ''; e.classList.toggle('hidden', !n.includes(kw)); });
    document.querySelectorAll('.contributor-card').forEach(c => { const n = c.getAttribute('data-name') || ''; c.classList.toggle('hidden', !n.includes(kw)); });
  }
}

function positionSearchBox() {
  searchBox = document.getElementById('search');
  if (!searchBox) return;
  if (currentMode === 'simple') {
    if (searchBox.parentNode !== mainCard.parentNode) mainCard.parentNode.insertBefore(searchBox, mainCard);
  } else {
    if (navTabs && searchBox.parentNode !== navTabs.parentNode) navTabs.insertAdjacentElement('afterend', searchBox);
  }
}

function updateBtnText() {
  if (!btn) return;
  btn.innerHTML = currentMode === 'simple' ? '切换<br>全能版' : '切换<br>简洁版';
}

if (btn) {
  btn.addEventListener('click', () => {
    topSeed = Date.now() + Math.random();
    currentMode = currentMode === 'simple' ? 'full' : 'simple';
    localStorage.setItem(MODE_KEY, currentMode);
    document.body.className = currentMode + '-mode';
    updateBtnText();
    if (currentMode !== 'simple') { positionSearchBox(); renderTabs(); showPanel(currentTabId); }
    else { if (searchBox) searchBox.style.display = ''; positionSearchBox(); renderApi(); }
  });
}