// content.js

const EXCLUDE_API = ['/', '//', '/favicon.ico', '/login', '/register', '/login.html', '/register.html'];
const EXCLUDE_LIBS = ['bootstrap', 'chosen', 'bootbox', 'awesome', 'animate', 'picnic', 'cirrus', 'iconfont', 'jquery', 'layui', 'swiper'];

// 请求css文件，返回class名列表
async function fetchCssClasses(cssUrl) {
  try {
    const resp = await fetch(cssUrl);
    if (!resp.ok) return [];
    const cssText = await resp.text();
    const regex = /\.([\w\-]+)\s*\{/g;
    let classes = new Set();
    let match;
    while ((match = regex.exec(cssText)) !== null) {
      classes.add(match[1]);
    }
    return Array.from(classes);
  } catch (e) {
    return [];
  }
}

// 从源码提取api接口
function extractApis(htmlText) {
  const regex = /['"]((\/|\.\/)[^\n\r'";]+)([\?;][^\n\r'" ]*)?['"]/g;
  let apis = new Set();
  let match;
  while ((match = regex.exec(htmlText)) !== null) {
    let api = match[1];
    if (EXCLUDE_API.includes(api)) continue;
    if (EXCLUDE_LIBS.some(lib => api.includes(lib))) continue;
    apis.add(api);
  }
  return Array.from(apis);
}

// 从源码中提取所有class名
function extractClassesFromHtml(htmlText) {
  let div = document.createElement('div');
  div.innerHTML = htmlText;
  let allClasses = new Set();
  div.querySelectorAll('[class]').forEach(el => {
    el.classList.forEach(cls => allClasses.add(cls));
  });
  return Array.from(allClasses);
}

// 获取页面加载的css文件（过滤排除库）
function extractCssLinks(htmlText) {
  let parser = new DOMParser();
  let doc = parser.parseFromString(htmlText, 'text/html');
  let links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
  return links.filter(link => !EXCLUDE_LIBS.some(lib => link.includes(lib)));
}

// 构造指纹函数，参数level控制采样数量
async function constructFingerprint(level = 4) {
  let htmlText = document.documentElement.outerHTML;

  // 提取api接口
  let apis = extractApis(htmlText);
  let staticApis = apis.filter(api => /\.(jpg|png|css|js|ico|svg|gif)$/i.test(api));
  let otherApis = apis.filter(api => !/\.(jpg|png|css|js|ico|svg|gif)$/i.test(api));

  // 随机采样
  let sampleOtherApis = otherApis.length > 4 ? shuffleArray(otherApis).slice(0, 4) : otherApis;
  let sampleStaticApis = staticApis.length > 2 ? shuffleArray(staticApis).slice(0, 2) : staticApis;
  let combinedApis = sampleOtherApis.concat(sampleStaticApis);
  if (combinedApis.length > level + 1) {
    combinedApis = shuffleArray(combinedApis).slice(0, level + 1);
  }
  let joinedApis = combinedApis.join('" && "');

  // 提取css类名
  let cssLinks = extractCssLinks(htmlText);
  let allCssClasses = new Set();
  for (const cssLink of cssLinks) {
    let classes = await fetchCssClasses(cssLink);
    classes.forEach(c => allCssClasses.add(c));
  }

  // 提取html中的类名
  let htmlClasses = extractClassesFromHtml(htmlText);

  // 交集
  let commonClasses = htmlClasses.filter(c => allCssClasses.has(c));
  let sampleClasses = commonClasses.length > level + 1 ? shuffleArray(commonClasses).slice(0, level + 1) : commonClasses;
  let joinedClasses = sampleClasses.join('" && "');

  // power by 提取 (简化版)
  let powerByMatch = htmlText.match(/(?:powered by|power by)\s+(<a[^>]*href="([^"]+)"[^>]*>|[^<>\s]+)/i);
  let powerByStr = powerByMatch ? (powerByMatch[2] || powerByMatch[1]) : '';

  // 组合指纹
  let fingerprint = '';
  if (joinedClasses && joinedApis) {
    fingerprint = `("${joinedApis}") || ("${joinedClasses}")`;
  } else if (joinedApis) {
    fingerprint = `"${joinedApis}"`;
  } else if (joinedClasses) {
    fingerprint = `"${joinedClasses}"`;
  }
  if (powerByStr) {
    fingerprint = `( ${fingerprint} ) && "${powerByStr}"`;
  }

  return fingerprint || '未构造出指纹信息';
}

// 简单洗牌函数
function shuffleArray(array) {
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 监听来自popup的消息，返回指纹
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getFingerprint') {
    constructFingerprint(request.level).then(fp => {
      sendResponse({ fingerprint: fp });
    });
    return true; // 表示异步回复
  }
});
