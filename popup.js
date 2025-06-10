const FOFA_KEY = 'a2aa22fe8983be8aa152dea907013571';         // 替换为你的FOFA API KEY

function getFingerprint() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;

    chrome.tabs.sendMessage(tabId, { action: 'getFingerprint', level: 3 }, (response) => {
      if (chrome.runtime.lastError || !response?.fingerprint) {
        document.getElementById('fingerprintResult').textContent = '提取失败';
        return;
      }

      const fingerprint = response.fingerprint;
      document.getElementById('fingerprintResult').textContent = fingerprint;

      searchFofa(fingerprint);  // 触发FOFA搜索
    });
  });
}

async function searchFofa(query) {
  const base64Query = btoa(query);
  const url = `https://fofa.info/api/v1/search/all?key=${FOFA_KEY}&qbase64=${base64Query}&size=5`;

  const resultDiv = document.getElementById('fofaResults');
  resultDiv.innerHTML = '正在查询 FOFA...';

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data || !data.results) {
      resultDiv.textContent = '查询失败或无结果';
      return;
    }

    // 渲染结果
    resultDiv.innerHTML = data.results.map(row => {
      const [host,ip, port] = row;
      return `<div style="margin-bottom: 5px;">
        🔗 <a href="${host}" target="_blank">${host}</a><br/>
        🌐 IP: ${ip} | 🎯 Port: ${port}
      </div>`;
    }).join('');
  } catch (e) {
    resultDiv.textContent = '请求 FOFA 出错: ' + e.message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reExtractButton').addEventListener('click', getFingerprint);
  getFingerprint();

  // ✅ 修复：添加点击事件监听器
  document.getElementById('searchFofaButton').addEventListener('click', () => {
    const manualInput = document.getElementById('manualFingerprint').value.trim();
    const resultDiv = document.getElementById('fofaResults');

    if (!manualInput) {
      resultDiv.textContent = '请先输入或粘贴指纹';
      return;
    }

    searchFofa(manualInput);
  });
});
