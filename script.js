/* =============================================
   INFAMOUS AI v1.1 — FRONTEND SCRIPT
   ============================================= */

'use strict';

// =============================================
// CONFIG
// =============================================
const API_BASE = '/api';

// =============================================
// STATE
// =============================================
const state = {
  token: localStorage.getItem('infamous_token') || null,
  user: JSON.parse(localStorage.getItem('infamous_user') || 'null'),
  currentChatId: null,
  chats: [],
  isTyping: false,
  sidebarOpen: false,
};

// =============================================
// API HELPER
// =============================================
async function api(method, path, body = null, requiresAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (requiresAuth && state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json();

  if (res.status === 401) {
    logout();
    throw new Error('Session expired. Please login again.');
  }

  return { ok: res.ok, status: res.status, data };
}

// =============================================
// TOAST NOTIFICATIONS
// =============================================
function toast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// =============================================
// AUTH FUNCTIONS
// =============================================
function initAuth() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabs = document.querySelectorAll('.auth-tab');

  // Tab switching
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('active'));
      document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
      clearErrors();
    });
  });

  // Password toggles
  document.querySelectorAll('.toggle-pass').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    setButtonLoading(btn, true);
    errEl.textContent = '';

    try {
      const { ok, data } = await api('POST', '/auth/login', { email, password }, false);
      if (!ok) throw new Error(data.message || 'Login failed');
      onAuthSuccess(data);
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      setButtonLoading(btn, false);
    }
  });

  // Signup
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('signup-btn');
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const errEl = document.getElementById('signup-error');

    if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

    setButtonLoading(btn, true);
    errEl.textContent = '';

    try {
      const { ok, data } = await api('POST', '/auth/signup', { username, email, password }, false);
      if (!ok) throw new Error(data.message || 'Signup failed');
      onAuthSuccess(data);
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

function onAuthSuccess(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('infamous_token', data.token);
  localStorage.setItem('infamous_user', JSON.stringify(data.user));

  switchToApp();
}

function setButtonLoading(btn, loading) {
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

function clearErrors() {
  document.getElementById('login-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}

function logout() {
  state.token = null;
  state.user = null;
  state.currentChatId = null;
  state.chats = [];
  localStorage.removeItem('infamous_token');
  localStorage.removeItem('infamous_user');
  switchToAuth();
}

// =============================================
// APP INITIALIZATION
// =============================================
function switchToApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  initApp();
}

function switchToAuth() {
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
}

async function initApp() {
  // Re-fetch user data
  try {
    const { ok, data } = await api('GET', '/auth/me');
    if (ok) {
      state.user = data.user;
      localStorage.setItem('infamous_user', JSON.stringify(data.user));
    }
  } catch (e) {}

  renderUserInfo();
  setupAppListeners();
  await loadChatHistory();
  setupAdminPanel();
}

// =============================================
// USER INFO
// =============================================
function renderUserInfo() {
  const u = state.user;
  if (!u) return;

  const initial = (u.username || 'U')[0].toUpperCase();
  document.getElementById('uic-avatar').textContent = initial;
  document.getElementById('uic-name').textContent = u.username;
  document.getElementById('uic-email').textContent = u.email;
  document.getElementById('plan-badge').textContent = u.plan.toUpperCase();
  document.getElementById('msg-remaining').textContent = `${u.remaining ?? u.messageLimit - u.messageCount} left`;
  document.getElementById('usage-display').textContent = `${u.messageCount ?? 0}/${u.messageLimit ?? 10} msgs used`;

  // Show admin button if admin
  if (u.isAdmin) {
    document.querySelectorAll('.admin-only').forEach((el) => el.classList.add('visible'));
  }

  updateLimitWarning();
}

function updateLimitWarning() {
  const u = state.user;
  if (!u) return;
  const remaining = u.remaining ?? (u.messageLimit - u.messageCount);
  const limitBar = document.getElementById('limit-warning');

  if (remaining <= 3 && remaining > 0) {
    limitBar.classList.remove('hidden');
    document.getElementById('limit-warning-text').textContent = `⚠ ${remaining} message${remaining === 1 ? '' : 's'} remaining today`;
  } else if (remaining <= 0) {
    limitBar.classList.remove('hidden');
    document.getElementById('limit-warning-text').textContent = '🚫 Daily limit reached. Upgrade to continue.';
  } else {
    limitBar.classList.add('hidden');
  }
}

function updateUsageAfterMessage(data) {
  if (!state.user) return;
  state.user.messageCount = data.messageCount;
  state.user.remaining = data.remaining;
  state.user.messageLimit = data.limit;
  localStorage.setItem('infamous_user', JSON.stringify(state.user));
  renderUserInfo();
}

// =============================================
// APP LISTENERS
// =============================================
function setupAppListeners() {
  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Exit session?')) logout();
  });

  // New chat
  document.getElementById('new-chat-btn').addEventListener('click', startNewChat);

  // Upgrade
  document.getElementById('upgrade-btn').addEventListener('click', openUpgradeModal);
  document.getElementById('limit-upgrade-btn').addEventListener('click', openUpgradeModal);

  // Admin panel
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) adminBtn.addEventListener('click', openAdminModal);

  // Send message
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Textarea auto-resize + char count
  const input = document.getElementById('message-input');
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    document.getElementById('char-count').textContent = `${input.value.length}/8000`;
    document.getElementById('send-btn').disabled = !input.value.trim() || state.isTyping;
  });

  // Suggestion cards
  document.querySelectorAll('.ws-card').forEach((card) => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      document.getElementById('message-input').value = prompt;
      document.getElementById('message-input').dispatchEvent(new Event('input'));
      sendMessage();
    });
  });

  // Mobile sidebar
  document.getElementById('open-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
  });

  document.getElementById('close-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.modal).classList.add('hidden');
    });
  });

  // Upgrade plan selection
  document.querySelectorAll('.pc-select-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.plan-card');
      const planName = card.dataset.plan;
      selectPlan(planName, card);
    });
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

// =============================================
// CHAT FUNCTIONS
// =============================================
function startNewChat() {
  state.currentChatId = null;
  document.getElementById('messages-container').innerHTML = '';
  document.getElementById('welcome-screen').style.display = '';
  document.getElementById('topbar-title').textContent = 'INFAMOUS AI v1.1';
  document.getElementById('message-input').value = '';
  document.getElementById('message-input').style.height = 'auto';
  document.getElementById('char-count').textContent = '0/8000';
  document.getElementById('send-btn').disabled = true;

  document.querySelectorAll('.chat-item').forEach((el) => el.classList.remove('active'));
  document.getElementById('sidebar').classList.remove('open');
}

async function loadChatHistory() {
  try {
    const { ok, data } = await api('GET', '/chat/history');
    if (!ok) return;

    state.chats = data.chats || [];
    renderChatList();
  } catch (e) {}
}

function renderChatList() {
  const list = document.getElementById('chat-list');
  if (!state.chats.length) {
    list.innerHTML = '<div class="chat-list-empty">No chats yet. Start one!</div>';
    return;
  }

  list.innerHTML = state.chats
    .map(
      (chat) => `
    <div class="chat-item ${chat.id === state.currentChatId ? 'active' : ''}" data-id="${chat.id}">
      <div class="chat-item-content">
        <div class="chat-item-title">${escapeHtml(chat.title)}</div>
        <div class="chat-item-meta">${chat.messageCount} msgs · ${timeAgo(chat.updatedAt)}</div>
      </div>
      <button class="chat-item-del" data-id="${chat.id}" title="Delete">✕</button>
    </div>
  `
    )
    .join('');

  // Event listeners for chat items
  list.querySelectorAll('.chat-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('chat-item-del')) return;
      loadChat(item.dataset.id);
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  list.querySelectorAll('.chat-item-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChat(btn.dataset.id);
    });
  });
}

async function loadChat(chatId) {
  try {
    const { ok, data } = await api('GET', `/chat/${chatId}`);
    if (!ok) { toast('Failed to load chat', 'error'); return; }

    state.currentChatId = chatId;
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('topbar-title').textContent = data.chat.title;
    document.getElementById('messages-container').innerHTML = '';

    data.chat.messages.forEach((msg) => appendMessage(msg.role, msg.content, false));

    document.querySelectorAll('.chat-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === chatId);
    });

    scrollToBottom();
  } catch (e) {
    toast('Failed to load chat', 'error');
  }
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  if (!message || state.isTyping) return;

  // Check remaining messages
  if (state.user && state.user.remaining === 0) {
    openUpgradeModal();
    return;
  }

  // Hide welcome screen
  document.getElementById('welcome-screen').style.display = 'none';

  // Append user message
  appendMessage('user', message);

  // Clear input
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('char-count').textContent = '0/8000';
  document.getElementById('send-btn').disabled = true;

  // Show typing
  showTyping();

  state.isTyping = true;

  try {
    const { ok, data } = await api('POST', '/chat/send', {
      message,
      chatId: state.currentChatId || undefined,
    });

    removeTyping();

    if (!ok) {
      if (data.limitReached) {
        toast(`Limit reached! Upgrade your ${data.plan?.toUpperCase()} plan.`, 'warning', 5000);
        openUpgradeModal();
      } else {
        toast(data.message || 'Failed to get response', 'error');
        appendErrorMessage(data.message || 'AI service error. Please try again.');
      }
      return;
    }

    // Update chat ID
    if (!state.currentChatId) {
      state.currentChatId = data.chatId;
      document.getElementById('topbar-title').textContent = data.title || 'New Chat';
      await loadChatHistory(); // Refresh list
    } else {
      // Update title in list
      const chatItem = document.querySelector(`.chat-item[data-id="${state.currentChatId}"] .chat-item-title`);
      if (chatItem && data.title) chatItem.textContent = data.title;
    }

    appendMessage('assistant', data.response);
    updateUsageAfterMessage(data);

  } catch (err) {
    removeTyping();
    toast('Network error. Please check connection.', 'error');
    appendErrorMessage('Connection error. Please try again.');
  } finally {
    state.isTyping = false;
    document.getElementById('send-btn').disabled = !document.getElementById('message-input').value.trim();
  }
}

function appendMessage(role, content, scroll = true) {
  const container = document.getElementById('messages-container');
  const initial = role === 'user'
    ? (state.user?.username?.[0] || 'U').toUpperCase()
    : 'AI';

  const div = document.createElement('div');
  div.className = `message ${role}`;

  const formattedContent = role === 'assistant' ? formatMarkdown(content) : escapeHtml(content).replace(/\n/g, '<br>');

  div.innerHTML = `
    <div class="msg-avatar">${initial}</div>
    <div class="msg-bubble">${formattedContent}</div>
  `;

  container.appendChild(div);

  // Add copy buttons to code blocks
  div.querySelectorAll('pre').forEach((pre) => {
    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.textContent = 'COPY';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.textContent || pre.textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'COPIED!';
        setTimeout(() => (btn.textContent = 'COPY'), 2000);
      });
    });
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });

  if (scroll) scrollToBottom();
}

function appendErrorMessage(text) {
  const container = document.getElementById('messages-container');
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.innerHTML = `
    <div class="msg-avatar" style="border-color: var(--danger); color: var(--danger);">✕</div>
    <div class="msg-bubble" style="border-color: rgba(255,59,59,0.3); color: var(--danger);">
      ⚠ ${escapeHtml(text)}
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function showTyping() {
  const container = document.getElementById('messages-container');
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.id = 'typing-msg';
  div.innerHTML = `
    <div class="msg-avatar" style="border-color: var(--info); color: var(--info);">AI</div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function removeTyping() {
  document.getElementById('typing-msg')?.remove();
}

function scrollToBottom() {
  const chatArea = document.getElementById('chat-area');
  requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

async function deleteChat(chatId) {
  if (!confirm('Delete this chat?')) return;
  try {
    const { ok } = await api('DELETE', `/chat/${chatId}`);
    if (!ok) { toast('Failed to delete', 'error'); return; }

    if (state.currentChatId === chatId) startNewChat();
    state.chats = state.chats.filter((c) => c.id !== chatId);
    renderChatList();
    toast('Chat deleted');
  } catch (e) {
    toast('Failed to delete chat', 'error');
  }
}

// =============================================
// MARKDOWN FORMATTER
// =============================================
function formatMarkdown(text) {
  // Escape HTML first but preserve code blocks
  let result = text;

  // Code blocks with language (```lang\n...\n```)
  result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang ? ` <span style="font-size:9px;color:var(--text-muted);letter-spacing:0.1em;">${lang.toUpperCase()}</span>` : '';
    return `<pre${langLabel ? '' : ''}><code>${escapeHtml(code.trim())}</code>${langLabel ? `<div style="position:absolute;top:6px;left:10px">${langLabel}</div>` : ''}</pre>`;
  });

  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
  result = result.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Horizontal rule
  result = result.replace(/^---+$/gm, '<hr>');

  // Unordered lists
  result = result.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
  result = result.replace(/(<li>.*<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  result = result.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Paragraphs (double newline = paragraph break)
  result = result
    .split('\n\n')
    .map((para) => {
      para = para.trim();
      if (!para) return '';
      if (para.startsWith('<h') || para.startsWith('<pre') || para.startsWith('<ul') || para.startsWith('<ol') || para.startsWith('<hr')) return para;
      return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  return result;
}

// =============================================
// UPGRADE MODAL
// =============================================
function openUpgradeModal() {
  const modal = document.getElementById('upgrade-modal');
  modal.classList.remove('hidden');

  // Update current plan badge
  const currentPlan = state.user?.plan || 'free';
  document.querySelectorAll('.plan-card').forEach((card) => {
    card.classList.remove('selected');
    const existing = card.querySelector('.pc-badge.current');
    if (existing) existing.remove();

    if (card.dataset.plan === currentPlan) {
      const badge = document.createElement('div');
      badge.className = 'pc-badge current';
      badge.textContent = '✓ ACTIVE';
      card.appendChild(badge);
    }
  });
}

function selectPlan(planName, card) {
  document.querySelectorAll('.plan-card').forEach((c) => c.classList.remove('selected'));
  card.classList.add('selected');

  const plans = {
    dirt: { name: 'DIRT', price: '₹69 (~$0.83)', limit: '25 msgs/day' },
    stone: { name: 'STONE', price: '₹149 (~$1.79)', limit: '50 msgs/day' },
    obsidian: { name: 'OBSIDIAN', price: '₹229 (~$2.75)', limit: '80 msgs/day' },
    bedrock: { name: 'BEDROCK', price: '₹299 (~$3.60)', limit: '150 msgs/day' },
  };

  if (plans[planName]) {
    const section = document.getElementById('payment-section');
    section.classList.remove('hidden');
    document.getElementById('selected-plan-name').textContent = plans[planName].name + ` (${plans[planName].limit})`;
    document.getElementById('selected-plan-price').textContent = plans[planName].price;
  }
}

// =============================================
// ADMIN PANEL
// =============================================
function openAdminModal() {
  document.getElementById('admin-modal').classList.remove('hidden');
  loadAdminData();
}

async function loadAdminData() {
  try {
    // Load stats
    const { ok: sOk, data: sData } = await api('GET', '/admin/stats');
    if (sOk) {
      document.getElementById('stat-users').textContent = sData.stats.totalUsers;
      document.getElementById('stat-chats').textContent = sData.stats.totalChats;
      document.getElementById('stat-logins').textContent = sData.stats.recentLogins;
    }

    // Load users
    const { ok, data } = await api('GET', '/admin/users');
    if (!ok) throw new Error(data.message);
    renderAdminTable(data.users);
  } catch (e) {
    document.getElementById('admin-table-body').innerHTML = `<tr><td colspan="5" class="loading-row" style="color:var(--danger)">Error: ${e.message}</td></tr>`;
  }
}

function renderAdminTable(users) {
  const tbody = document.getElementById('admin-table-body');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = users
    .map(
      (u) => `
    <tr data-user-id="${u.id}">
      <td>
        <span style="color:var(--text-primary)">${escapeHtml(u.username)}</span>
        ${u.isAdmin ? '<span class="user-tag-admin">ADMIN</span>' : ''}
      </td>
      <td style="color:var(--text-muted)">${escapeHtml(u.email)}</td>
      <td>
        <select class="admin-plan-select" data-user-id="${u.id}">
          ${['free','dirt','stone','obsidian','bedrock'].map(p => `<option value="${p}" ${u.plan === p ? 'selected' : ''}>${p.toUpperCase()}</option>`).join('')}
        </select>
      </td>
      <td>
        <span style="color:${u.remaining === 0 ? 'var(--danger)' : 'var(--neon)'}">
          ${u.messageCount}/${u.messageLimit}
        </span>
        <span style="color:var(--text-muted);font-size:9px;margin-left:4px">(${u.remaining} left)</span>
      </td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="admin-reset-btn" data-user-id="${u.id}">RESET</button>
        ${!u.isAdmin ? `<button class="admin-del-btn" data-user-id="${u.id}" data-username="${escapeHtml(u.username)}">DEL</button>` : ''}
      </td>
    </tr>
  `
    )
    .join('');

  // Plan change
  tbody.querySelectorAll('.admin-plan-select').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const userId = sel.dataset.userId;
      const newPlan = sel.value;
      try {
        const { ok, data } = await api('PUT', `/admin/users/${userId}/plan`, { plan: newPlan });
        if (!ok) throw new Error(data.message);
        toast(`Plan updated → ${newPlan.toUpperCase()}`);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  // Reset limit
  tbody.querySelectorAll('.admin-reset-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      try {
        const { ok, data } = await api('PUT', `/admin/users/${userId}/reset`);
        if (!ok) throw new Error(data.message);
        toast('Limit reset!');
        loadAdminData();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  // Delete user
  tbody.querySelectorAll('.admin-del-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete user "${btn.dataset.username}"? This is irreversible.`)) return;
      const userId = btn.dataset.userId;
      try {
        const { ok, data } = await api('DELETE', `/admin/users/${userId}`);
        if (!ok) throw new Error(data.message);
        toast('User deleted', 'warning');
        loadAdminData();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

// Admin search filter
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('admin-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      document.querySelectorAll('#admin-table-body tr').forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  const refreshBtn = document.getElementById('admin-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadAdminData);
  }
});

function setupAdminPanel() {
  document.getElementById('admin-refresh')?.addEventListener('click', loadAdminData);
}

// =============================================
// UTILITY FUNCTIONS
// =============================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// =============================================
// STARTUP
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  // Check if already logged in
  if (state.token && state.user) {
    switchToApp();
  }

  // Prevent form submission reload
  document.querySelectorAll('form').forEach((f) => {
    f.addEventListener('submit', (e) => e.preventDefault());
  });
});
