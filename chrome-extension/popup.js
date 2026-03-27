const API_BASE = 'http://127.0.0.1:3000/api/tia';
const statusIndicator = document.getElementById('status-indicator');
const positionSelect = document.getElementById('position-select');
const importBtn = document.getElementById('import-btn');
const toast = document.getElementById('toast');

let activeTabDetails = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkConnectionAndLoadPositions();
  
  // Get active tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const url = tabs[0].url;
      if (url.includes('zhipin.com') || url.includes('liepin.com') || url.includes('maimai.cn')) {
        activeTabDetails = tabs[0];
        // Test if content script responds
        chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            importBtn.textContent = '无法注入脚本 (请刷新页面再试)';
            importBtn.disabled = true;
          }
        });
      } else {
        importBtn.textContent = '请打开支持的招聘网站主页';
        importBtn.disabled = true;
      }
    }
  });
});

async function checkConnectionAndLoadPositions() {
  try {
    const res = await fetch(`${API_BASE}/positions`);
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    
    statusIndicator.className = 'status connected';
    
    // Load last selected
    const { lastPositionId } = await chrome.storage.local.get('lastPositionId');
    
    positionSelect.innerHTML = '<option value="">(选择目标职位或放入全局公海)</option>';
    data.items.forEach(pos => {
      const option = document.createElement('option');
      option.value = pos.id;
      option.textContent = pos.title + (pos.clientName ? ` (${pos.clientName})` : '');
      if (pos.id === lastPositionId) option.selected = true;
      positionSelect.appendChild(option);
    });
    
    positionSelect.disabled = false;
    if (!importBtn.disabled && importBtn.textContent !== '请打开支持的招聘网站主页') {
      importBtn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    statusIndicator.className = 'status error';
    positionSelect.innerHTML = '<option value="">TIA 未启动/连接失败</option>';
  }
}

positionSelect.addEventListener('change', (e) => {
  chrome.storage.local.set({ lastPositionId: e.target.value });
});

importBtn.addEventListener('click', async () => {
  if (!activeTabDetails) return;
  const positionId = positionSelect.value || null;
  
  importBtn.disabled = true;
  importBtn.textContent = '解析中...';
  
  chrome.tabs.sendMessage(activeTabDetails.id, { type: 'EXTRACT_PROFILE' }, (candidate) => {
    if (chrome.runtime.lastError || !candidate) {
      showToast('数据提取失败', true);
      resetBtn();
      return;
    }
    
    if (!candidate.name && !candidate.current_company) {
      showToast('未找到有效简历字段', true);
      resetBtn();
      return;
    }
    
    document.getElementById('candidate-preview').classList.remove('hidden');
    document.getElementById('preview-name').textContent = candidate.name || '未知姓名';
    document.getElementById('preview-desc').textContent = `${candidate.current_company || ''} · ${candidate.current_title || ''}`;
    
    candidate.position_id = positionId;
    
    importBtn.textContent = '导入至 TIA...';
    
    chrome.runtime.sendMessage({ type: 'TIA_IMPORT_CANDIDATE', payload: candidate }, (response) => {
      if (response && response.success) {
        showToast('✅ 导入成功！');
        importBtn.textContent = '抓取当前页面简历';
        importBtn.disabled = false;
      } else {
        showToast('导入失败: ' + (response?.error || 'Unknown'), true);
        resetBtn();
      }
    });
  });
});

function resetBtn() {
  importBtn.textContent = '抓取当前页面简历';
  importBtn.disabled = false;
}

function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.style.background = isError ? 'var(--red)' : 'var(--green)';
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hidden');
  }, 3000);
}
