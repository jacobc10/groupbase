/**
 * GroupBase Extension Popup Script
 *
 * Handles:
 * - Checking authentication state
 * - Displaying login form or dashboard
 * - Handling user login/logout
 * - Fetching and displaying quick stats
 * - Navigation to full dashboard
 */

'use strict';

const CONFIG = {
  DASHBOARD_URL: 'https://groupbase.vercel.app/dashboard',
  SETTINGS_URL: 'https://groupbase.vercel.app/dashboard/integrations',
  DEBUG: true,
};

const logger = {
  log: (...args) => CONFIG.DEBUG && console.log('[GroupBase Popup]', ...args),
  error: (...args) => console.error('[GroupBase Popup]', ...args),
};

// DOM elements
const loginForm = document.getElementById('loginForm');
const dashboard = document.getElementById('dashboard');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const openDashboardBtn = document.getElementById('openDashboardBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const messageEl = document.getElementById('message');
const groupsCountEl = document.getElementById('groupsCount');
const membersTodayEl = document.getElementById('membersToday');
const totalMembersEl = document.getElementById('totalMembers');
const groupsListEl = document.getElementById('groupsList');
const quickSearchInput = document.getElementById('quickSearchInput');
const statusSummaryEl = document.getElementById('statusSummary');
const statusSummaryContentEl = document.getElementById('statusSummaryContent');
const recentCapturesEl = document.getElementById('recentCaptures');
const recentCapturesContentEl = document.getElementById('recentCapturesContent');
const tagInput = document.getElementById('tagInput');
const addTagBtn = document.getElementById('addTagBtn');

function showMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.className = `message active ${type}`;
  if (type === 'success') {
    setTimeout(() => messageEl.classList.remove('active'), 3000);
  }
}

function hideMessage() {
  messageEl.classList.remove('active');
}

function showLoginForm() {
  loginForm.classList.add('active');
  dashboard.classList.remove('active');
  hideMessage();
  emailInput.focus();
}

async function showDashboard() {
  loginForm.classList.remove('active');
  dashboard.classList.add('active');
  hideMessage();
  await loadStats();
}

async function loadStats() {
  try {
    showMessage('Loading...', 'loading');

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_STATS' }, resolve);
    });

    if (response.success && response.data) {
      groupsCountEl.textContent = response.data.groupsCount || 0;
      membersTodayEl.textContent = response.data.membersToday || 0;
      if (totalMembersEl) {
        totalMembersEl.textContent = response.data.totalMembers || 0;
      }

      // Show connected groups list
      if (groupsListEl && response.data.groups?.length > 0) {
        groupsListEl.innerHTML = response.data.groups
          .map(
            (g) =>
              `<div class="group-item">
                <span class="group-name">${escapeHtml(g.name)}</span>
                <span class="group-id">${g.fb_group_id ? '#' + g.fb_group_id : ''}</span>
              </div>`
          )
          .join('');
        groupsListEl.style.display = 'block';
      }

      hideMessage();
      logger.log('Stats loaded:', response.data);
    } else {
      groupsCountEl.textContent = '0';
      membersTodayEl.textContent = '0';
      if (totalMembersEl) totalMembersEl.textContent = '0';
      hideMessage();
    }

    // Load status summary
    await loadStatusSummary();

    // Load recent captures
    await loadRecentCaptures();
  } catch (error) {
    logger.error('Error loading stats:', error);
    hideMessage();
    groupsCountEl.textContent = '0';
    membersTodayEl.textContent = '0';
    if (totalMembersEl) totalMembersEl.textContent = '0';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadStatusSummary() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_STATUS_SUMMARY' }, resolve);
    });

    if (response.success && response.data) {
      const { new: newCount, contacted, qualified } = response.data;
      statusSummaryContentEl.textContent = `${newCount || 0} new, ${contacted || 0} contacted, ${qualified || 0} qualified`;
      statusSummaryEl.style.display = 'block';
      logger.log('Status summary loaded:', response.data);
    } else {
      statusSummaryEl.style.display = 'none';
    }
  } catch (error) {
    logger.error('Error loading status summary:', error);
    statusSummaryEl.style.display = 'none';
  }
}

async function loadRecentCaptures() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_RECENT_CAPTURES' }, resolve);
    });

    if (response.success && response.data && response.data.length > 0) {
      const captures = response.data.slice(0, 3); // Show last 3
      const html = captures
        .map((capture) => {
          const timeStr = formatTime(new Date(capture.timestamp));
          return `<div class="capture-item">
            <span class="capture-name" title="${escapeHtml(capture.name)}">${escapeHtml(capture.name)}</span>
            <span class="capture-time">${timeStr}</span>
          </div>`;
        })
        .join('');
      recentCapturesContentEl.innerHTML = html;
      recentCapturesEl.style.display = 'block';
      logger.log('Recent captures loaded:', captures);
    } else {
      recentCapturesContentEl.innerHTML = '<div class="captures-empty">No captures yet</div>';
      recentCapturesEl.style.display = 'block';
    }
  } catch (error) {
    logger.error('Error loading recent captures:', error);
    recentCapturesEl.style.display = 'none';
  }
}

function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Login handler
loginBtn.addEventListener('click', async () => {
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showMessage('Please enter email and password', 'error');
      return;
    }

    if (!email.includes('@')) {
      showMessage('Please enter a valid email address', 'error');
      return;
    }

    showMessage('Signing in...', 'loading');
    loginBtn.disabled = true;

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'LOGIN', email, password },
        resolve
      );
    });

    if (response.success) {
      showMessage('Signed in!', 'success');
      emailInput.value = '';
      passwordInput.value = '';
      setTimeout(() => showDashboard(), 500);
    } else {
      showMessage(response.error || 'Sign in failed', 'error');
    }
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    loginBtn.disabled = false;
  }
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
  try {
    showMessage('Signing out...', 'loading');
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'LOGOUT' }, resolve);
    });

    if (response.success) {
      showMessage('Signed out', 'success');
      setTimeout(() => showLoginForm(), 500);
    } else {
      showMessage('Sign out failed', 'error');
    }
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

// Navigation handlers
openDashboardBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: CONFIG.DASHBOARD_URL });
});

openSettingsBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: CONFIG.SETTINGS_URL });
});

// Enter key to login
passwordInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') loginBtn.click();
});

emailInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') passwordInput.focus();
});

// Quick search handler
quickSearchInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    const query = quickSearchInput.value.trim();
    if (query) {
      const searchUrl = `${CONFIG.DASHBOARD_URL}/members?search=${encodeURIComponent(query)}`;
      chrome.tabs.create({ url: searchUrl });
      quickSearchInput.value = '';
      logger.log('Opened dashboard with search query:', query);
    }
  }
});

// Add tag handler
addTagBtn.addEventListener('click', async () => {
  try {
    const tag = tagInput.value.trim();
    if (!tag) {
      showMessage('Please enter a tag', 'error');
      return;
    }

    addTagBtn.disabled = true;
    showMessage('Adding tag...', 'loading');

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'ADD_TAG_TO_LAST', tag }, resolve);
    });

    if (response.success) {
      showMessage(`Tag "${tag}" added!`, 'success');
      tagInput.value = '';
      logger.log('Tag added:', tag);
    } else {
      showMessage(response.error || 'Failed to add tag', 'error');
    }
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    addTagBtn.disabled = false;
  }
});

// Allow Enter key to add tag
tagInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') addTagBtn.click();
});

// Check auth state on popup open
async function checkAuthState() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ authenticated: false });
        } else {
          resolve(response);
        }
      });
    });

    if (response.authenticated) {
      showDashboard();
    } else {
      showLoginForm();
    }
  } catch (error) {
    showLoginForm();
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAuthState);
} else {
  checkAuthState();
}
