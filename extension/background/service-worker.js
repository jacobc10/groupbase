/**
 * GroupBase Background Service Worker
 *
 * Handles:
 * - Receiving member data from content scripts
 * - Managing authentication state (login, logout, token refresh)
 * - Sending data to the Supabase REST API
 * - Queueing failed requests for retry
 * - Auto-creating groups when first member is captured
 */

'use strict';

// Configuration
const CONFIG = {
  SUPABASE_URL: 'https://bpbombdtzrthhbqoxlao.supabase.co',
  SUPABASE_REST_URL: 'https://bpbombdtzrthhbqoxlao.supabase.co/rest/v1',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYm9tYmR0enJ0aGhicW94bGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzkxNDIsImV4cCI6MjA5MDY1NTE0Mn0.OSUerkMXCHRk2YiiSeflZryUvkV9dMeNVzahzzDtaZM',
  DASHBOARD_URL: 'https://groupbase.vercel.app',
  API_TIMEOUT: 10000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
  DEBUG: true,
};

// In-memory queue for failed requests
const REQUEST_QUEUE = [];

const logger = {
  log: (...args) => CONFIG.DEBUG && console.log('[GroupBase SW]', ...args),
  error: (...args) => console.error('[GroupBase SW]', ...args),
  warn: (...args) => console.warn('[GroupBase SW]', ...args),
};

// ============================================
// AUTH HELPERS
// ============================================

async function getAuthToken() {
  try {
    const result = await chrome.storage.local.get([
      'authToken',
      'userId',
      'refreshToken',
      'tokenExpiry',
    ]);

    // Check if token is expired or about to expire (5 min buffer)
    if (result.authToken && result.tokenExpiry) {
      const now = Date.now();
      const expiry = result.tokenExpiry;
      if (now > expiry - 5 * 60 * 1000) {
        logger.log('Token expired or expiring soon, refreshing...');
        const refreshed = await refreshAuthToken(result.refreshToken);
        if (refreshed) {
          return {
            token: refreshed.token,
            userId: refreshed.userId,
          };
        }
        // If refresh failed, clear auth
        await clearAuthData();
        return { token: null, userId: null };
      }
    }

    return {
      token: result.authToken || null,
      userId: result.userId || null,
    };
  } catch (error) {
    logger.error('Error retrieving auth token:', error);
    return { token: null, userId: null };
  }
}

async function setAuthData(token, userId, refreshToken, expiresIn) {
  try {
    const tokenExpiry = Date.now() + (expiresIn || 3600) * 1000;
    await chrome.storage.local.set({
      authToken: token,
      userId,
      refreshToken,
      tokenExpiry,
    });
    logger.log('Auth data stored, expires:', new Date(tokenExpiry).toISOString());
  } catch (error) {
    logger.error('Error storing auth data:', error);
  }
}

async function clearAuthData() {
  try {
    await chrome.storage.local.remove([
      'authToken',
      'userId',
      'refreshToken',
      'tokenExpiry',
    ]);
    logger.log('Auth data cleared');
  } catch (error) {
    logger.error('Error clearing auth data:', error);
  }
}

async function refreshAuthToken(refreshToken) {
  if (!refreshToken) return null;

  try {
    logger.log('Refreshing auth token...');
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    if (!response.ok) {
      logger.error('Token refresh failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.access_token) {
      await setAuthData(
        data.access_token,
        data.user?.id,
        data.refresh_token,
        data.expires_in
      );
      logger.log('Token refreshed successfully');
      return { token: data.access_token, userId: data.user?.id };
    }

    return null;
  } catch (error) {
    logger.error('Error refreshing token:', error);
    return null;
  }
}

async function performLogin(email, password) {
  try {
    logger.log('Attempting login for:', email);

    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error_description ||
          errorData.msg ||
          `Login failed: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.access_token) {
      await setAuthData(
        data.access_token,
        data.user?.id,
        data.refresh_token,
        data.expires_in
      );
      logger.log('Login successful, user:', data.user?.id);
      return {
        success: true,
        token: data.access_token,
        userId: data.user?.id,
      };
    } else {
      throw new Error('No token received from server');
    }
  } catch (error) {
    logger.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

async function performLogout() {
  try {
    await clearAuthData();
    return { success: true };
  } catch (error) {
    logger.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// GROUP HELPERS
// ============================================

/**
 * Find or create a group by Facebook group ID/URL.
 * The extension detects which FB group the admin is on and maps it to a GroupBase group.
 */
async function findOrCreateGroup(authToken, userId, fbGroupInfo) {
  try {
    const { fbGroupId, fbGroupName, fbGroupUrl } = fbGroupInfo;

    // Strategy 1: Find by fb_group_id
    if (fbGroupId) {
      const findRes = await fetch(
        `${CONFIG.SUPABASE_REST_URL}/groups?select=id,name&fb_group_id=eq.${encodeURIComponent(fbGroupId)}`,
        {
          headers: {
            apikey: CONFIG.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${authToken}`,
          },
          signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
        }
      );

      if (findRes.ok) {
        const groups = await findRes.json();
        if (groups.length > 0) {
          logger.log('Found existing group by fb_group_id:', groups[0].id);
          return groups[0].id;
        }
      }
    }

    // Strategy 2: Find by fb_group_url
    if (fbGroupUrl) {
      const findRes = await fetch(
        `${CONFIG.SUPABASE_REST_URL}/groups?select=id,name&fb_group_url=eq.${encodeURIComponent(fbGroupUrl)}`,
        {
          headers: {
            apikey: CONFIG.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${authToken}`,
          },
          signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
        }
      );

      if (findRes.ok) {
        const groups = await findRes.json();
        if (groups.length > 0) {
          logger.log('Found existing group by fb_group_url:', groups[0].id);
          return groups[0].id;
        }
      }
    }

    // Strategy 3: Use first available group ONLY if user has exactly one group
    // and we have a valid FB group name (not a page title like "Notifications")
    const INVALID_GROUP_NAMES = [
      'notifications', 'facebook', 'home', 'watch', 'marketplace',
      'groups', 'gaming', 'menu', 'settings', 'messages', 'events',
    ];
    const nameIsValid = fbGroupName &&
      fbGroupName.length > 2 &&
      !INVALID_GROUP_NAMES.includes(fbGroupName.toLowerCase().trim());

    const anyGroupRes = await fetch(
      `${CONFIG.SUPABASE_REST_URL}/groups?select=id`,
      {
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
        },
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    if (anyGroupRes.ok) {
      const anyGroups = await anyGroupRes.json();
      // Only use fallback if user has exactly one group
      if (anyGroups.length === 1) {
        logger.log('Using only available group:', anyGroups[0].id);
        return anyGroups[0].id;
      }
    }

    // Strategy 4: Create new group only if we have a valid FB group name
    if (!nameIsValid) {
      logger.error('Cannot create group — invalid or missing FB group name:', fbGroupName);
      throw new Error('Could not determine Facebook group. Please navigate to your Facebook group page and try again.');
    }
    logger.log('Creating new group:', fbGroupName);
    const createRes = await fetch(`${CONFIG.SUPABASE_REST_URL}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authToken}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        name: fbGroupName || 'Facebook Group',
        fb_group_id: fbGroupId || null,
        fb_group_url: fbGroupUrl || null,
        owner_id: userId,
      }),
      signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
    });

    if (createRes.ok) {
      const newGroups = await createRes.json();
      if (newGroups.length > 0) {
        logger.log('Created new group:', newGroups[0].id);
        return newGroups[0].id;
      }
    } else {
      const errText = await createRes.text();
      logger.error('Group creation failed:', createRes.status, errText);
    }

    throw new Error('Could not find or create group');
  } catch (error) {
    logger.error('Error in findOrCreateGroup:', error);
    return null;
  }
}

// ============================================
// MEMBER DATA
// ============================================

/**
 * Send member data to Supabase.
 * Schema columns: name, fb_profile_url, fb_user_id, answers (jsonb),
 *   group_id, tags, status, approved_at
 */
async function sendMemberDataToSupabase(memberData, authToken, userId) {
  try {
    if (!authToken) throw new Error('Not authenticated');

    // Resolve the group
    const groupId = await findOrCreateGroup(authToken, userId, {
      fbGroupId: memberData.fbGroupId || null,
      fbGroupName: memberData.fbGroupName || null,
      fbGroupUrl: memberData.fbGroupUrl || null,
    });

    if (!groupId) throw new Error('Could not resolve group');

    logger.log('Sending member data to Supabase for group:', groupId);

    // Extract fb_user_id from profile URL if not already set
    let fbUserId = memberData.fbUserId || null;
    if (!fbUserId && memberData.profileUrl) {
      const match = memberData.profileUrl.match(
        /facebook\.com\/(?:profile\.php\?id=)?(\d+)/
      );
      if (match) fbUserId = match[1];
    }

    const payload = {
      group_id: groupId,
      name: memberData.name || 'Unknown',
      fb_profile_url: memberData.profileUrl || null,
      fb_user_id: fbUserId,
      answers: memberData.answers || [],
      tags: [],
      status: 'new',
      approved_at: memberData.capturedAt || new Date().toISOString(),
    };

    const response = await fetch(`${CONFIG.SUPABASE_REST_URL}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authToken}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try refreshing token
        const stored = await chrome.storage.local.get(['refreshToken']);
        const refreshed = await refreshAuthToken(stored.refreshToken);
        if (refreshed) {
          // Retry with new token
          return sendMemberDataToSupabase(memberData, refreshed.token, refreshed.userId);
        }
        await clearAuthData();
        throw new Error('Authentication failed — please sign in again');
      }
      const errBody = await response.text();
      throw new Error(`API request failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();
    logger.log('Member data sent successfully:', data);

    // Log the activity
    if (data.length > 0) {
      await fetch(`${CONFIG.SUPABASE_REST_URL}/activity_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          member_id: data[0].id,
          group_id: groupId,
          action: 'member_approved',
          details: { source: 'chrome_extension', fb_name: memberData.name },
          performed_by: userId,
        }),
      }).catch((err) => logger.warn('Activity log failed:', err));
    }

    return { success: true, data };
  } catch (error) {
    logger.error('Error sending member data:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// REQUEST QUEUE
// ============================================

function queueRequest(request, retryCount = 0) {
  const queuedRequest = {
    ...request,
    retryCount,
    queuedAt: new Date().toISOString(),
  };
  REQUEST_QUEUE.push(queuedRequest);
  logger.log('Request queued for retry:', queuedRequest);

  if (retryCount < CONFIG.MAX_RETRIES) {
    setTimeout(() => processQueue(), CONFIG.RETRY_DELAY);
  }
}

async function processQueue() {
  if (REQUEST_QUEUE.length === 0) return;
  logger.log(`Processing queue (${REQUEST_QUEUE.length} items)`);

  const { token: authToken, userId } = await getAuthToken();
  if (!authToken) {
    logger.warn('Cannot process queue: not authenticated');
    return;
  }

  const processed = [];
  for (let i = 0; i < REQUEST_QUEUE.length; i++) {
    const request = REQUEST_QUEUE[i];
    if (request.type === 'MEMBER_DATA') {
      const result = await sendMemberDataToSupabase(
        request.payload,
        authToken,
        userId
      );
      if (result.success) {
        processed.push(i);
      } else if (request.retryCount < CONFIG.MAX_RETRIES) {
        request.retryCount++;
      } else {
        processed.push(i);
        logger.error('Request exceeded max retries');
      }
    }
  }

  // Remove processed items (reverse order to preserve indices)
  for (let i = processed.length - 1; i >= 0; i--) {
    REQUEST_QUEUE.splice(processed[i], 1);
  }
}

// ============================================
// STATS
// ============================================

async function getStats(authToken) {
  try {
    // Get groups
    const groupsRes = await fetch(
      `${CONFIG.SUPABASE_REST_URL}/groups?select=id,name,fb_group_id`,
      {
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
        },
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    let groupsCount = 0;
    let groups = [];
    if (groupsRes.ok) {
      groups = await groupsRes.json();
      groupsCount = groups.length;
    }

    // Get today's members count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const membersRes = await fetch(
      `${CONFIG.SUPABASE_REST_URL}/members?select=id&created_at=gte.${today.toISOString()}`,
      {
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    const membersToday = parseInt(
      membersRes.headers.get('content-range')?.split('/')[1] || '0'
    );

    // Get total members count
    const totalRes = await fetch(
      `${CONFIG.SUPABASE_REST_URL}/members?select=id`,
      {
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    const totalMembers = parseInt(
      totalRes.headers.get('content-range')?.split('/')[1] || '0'
    );

    return {
      success: true,
      data: { groupsCount, membersToday, totalMembers, groups },
    };
  } catch (error) {
    logger.error('Error getting stats:', error);
    return {
      success: false,
      data: { groupsCount: 0, membersToday: 0, totalMembers: 0, groups: [] },
    };
  }
}

// ============================================
// STATUS SUMMARY
// ============================================

async function getStatusSummary(authToken) {
  try {
    // Get count of members by status
    const newRes = await fetch(
      `${CONFIG.SUPABASE_REST_URL}/members?select=id&status=eq.new`,
      {
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    const newCount = parseInt(newRes.headers.get('content-range')?.split('/')[1] || '0');

    const contactedRes = await fetch(
      `${CONFIG.SUPABASE_REST_URL}/members?select=id&status=eq.contacted`,
      {
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    const contacted = parseInt(
      contactedRes.headers.get('content-range')?.split('/')[1] || '0'
    );

    const qualifiedRes = await fetch(
      `${CONFIG.SUPABASE_REST_URL}/members?select=id&status=eq.qualified`,
      {
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    const qualified = parseInt(
      qualifiedRes.headers.get('content-range')?.split('/')[1] || '0'
    );

    return {
      success: true,
      data: { new: newCount, contacted, qualified },
    };
  } catch (error) {
    logger.error('Error getting status summary:', error);
    return {
      success: false,
      data: { new: 0, contacted: 0, qualified: 0 },
    };
  }
}

// ============================================
// RECENT CAPTURES
// ============================================

async function getRecentCaptures() {
  try {
    const result = await chrome.storage.session.get('recentCaptures');
    const captures = result.recentCaptures || [];
    return {
      success: true,
      data: captures,
    };
  } catch (error) {
    logger.error('Error getting recent captures:', error);
    return {
      success: false,
      data: [],
    };
  }
}

async function saveCaptureToSession(memberData) {
  try {
    const result = await chrome.storage.session.get('recentCaptures');
    const captures = result.recentCaptures || [];

    // Create capture record
    const capture = {
      name: memberData.name || 'Unknown',
      timestamp: new Date().toISOString(),
      fbUserId: memberData.fbUserId || null,
      profileUrl: memberData.profileUrl || null,
    };

    // Add to beginning and keep only last 10
    captures.unshift(capture);
    captures.splice(10);

    await chrome.storage.session.set({ recentCaptures: captures });
    logger.log('Capture saved to session:', capture);
  } catch (error) {
    logger.error('Error saving capture to session:', error);
  }
}

// ============================================
// ADD TAG TO LAST CAPTURE
// ============================================

async function addTagToLastCapture(tag, authToken) {
  try {
    if (!tag || !authToken) {
      return { success: false, error: 'Invalid tag or authentication' };
    }

    // Get the last capture from session storage
    const result = await chrome.storage.session.get('recentCaptures');
    const captures = result.recentCaptures || [];

    if (captures.length === 0) {
      return { success: false, error: 'No recent captures to tag' };
    }

    const lastCapture = captures[0];
    const fbUserId = lastCapture.fbUserId;

    if (!fbUserId) {
      return { success: false, error: 'Could not identify member to tag' };
    }

    // Fetch the member from Supabase by fb_user_id
    const memberRes = await fetch(
      `${CONFIG.SUPABASE_REST_URL}/members?select=id,tags&fb_user_id=eq.${encodeURIComponent(fbUserId)}`,
      {
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
        },
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    if (!memberRes.ok) {
      return { success: false, error: 'Could not find member' };
    }

    const members = await memberRes.json();
    if (members.length === 0) {
      return { success: false, error: 'Member not found' };
    }

    const member = members[0];
    const currentTags = member.tags || [];

    // Add tag if not already present
    if (!currentTags.includes(tag)) {
      currentTags.push(tag);
    }

    // Update member with new tags
    const updateRes = await fetch(
      `${CONFIG.SUPABASE_REST_URL}/members?id=eq.${member.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ tags: currentTags }),
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
      }
    );

    if (!updateRes.ok) {
      const errBody = await updateRes.text();
      throw new Error(`Failed to update member: ${updateRes.status} ${errBody}`);
    }

    logger.log('Tag added to member:', { memberId: member.id, tag });
    return { success: true, data: { memberId: member.id, tag } };
  } catch (error) {
    logger.error('Error adding tag to last capture:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.log('Message received:', request.action);

  switch (request.action) {
    case 'MEMBER_APPROVED': {
      (async () => {
        try {
          const { token: authToken, userId } = await getAuthToken();
          if (!authToken) {
            sendResponse({ success: false, error: 'Not authenticated' });
            return;
          }
          const result = await sendMemberDataToSupabase(
            request.payload,
            authToken,
            userId
          );
          if (result.success) {
            // Save capture to session storage
            await saveCaptureToSession(request.payload);
            sendResponse({ success: true, data: result.data });
          } else {
            queueRequest(
              { type: 'MEMBER_DATA', payload: request.payload },
              0
            );
            sendResponse({
              success: false,
              error: result.error,
              queued: true,
            });
          }
        } catch (error) {
          logger.error('Error handling MEMBER_APPROVED:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Keep message channel open for async response
    }

    case 'LOGIN': {
      (async () => {
        try {
          const result = await performLogin(request.email, request.password);
          sendResponse(result);
          if (result.success) await processQueue();
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }

    case 'LOGOUT': {
      (async () => {
        try {
          const result = await performLogout();
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }

    case 'GET_AUTH_STATE': {
      (async () => {
        try {
          const { token } = await getAuthToken();
          sendResponse({ authenticated: !!token });
        } catch (error) {
          sendResponse({ authenticated: false });
        }
      })();
      return true;
    }

    case 'GET_STATS': {
      (async () => {
        try {
          const { token: authToken } = await getAuthToken();
          if (!authToken) {
            sendResponse({ success: false, error: 'Not authenticated' });
            return;
          }
          const result = await getStats(authToken);
          sendResponse(result);
        } catch (error) {
          sendResponse({
            success: false,
            data: { groupsCount: 0, membersToday: 0, totalMembers: 0, groups: [] },
          });
        }
      })();
      return true;
    }

    case 'GET_STATUS_SUMMARY': {
      (async () => {
        try {
          const { token: authToken } = await getAuthToken();
          if (!authToken) {
            sendResponse({ success: false, error: 'Not authenticated' });
            return;
          }
          const result = await getStatusSummary(authToken);
          sendResponse(result);
        } catch (error) {
          sendResponse({
            success: false,
            data: { new: 0, contacted: 0, qualified: 0 },
          });
        }
      })();
      return true;
    }

    case 'GET_RECENT_CAPTURES': {
      (async () => {
        try {
          const result = await getRecentCaptures();
          sendResponse(result);
        } catch (error) {
          sendResponse({
            success: false,
            data: [],
          });
        }
      })();
      return true;
    }

    case 'ADD_TAG_TO_LAST': {
      (async () => {
        try {
          const { token: authToken } = await getAuthToken();
          if (!authToken) {
            sendResponse({ success: false, error: 'Not authenticated' });
            return;
          }
          const result = await addTagToLastCapture(request.tag, authToken);
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }

    case 'GET_QUEUE_STATUS': {
      sendResponse({ queueLength: REQUEST_QUEUE.length, queue: REQUEST_QUEUE });
      break;
    }

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Process queue on service worker startup
setTimeout(() => processQueue(), 2000);

logger.log('GroupBase service worker loaded');
