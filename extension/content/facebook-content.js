/**
 * GroupBase Content Script for Facebook Groups
 *
 * Runs on Facebook group pages and automatically captures member data
 * when admins approve membership requests.
 *
 * Strategy:
 * 1. Listen for clicks on "Approve" buttons via multiple detection methods
 * 2. Walk up the DOM to find the member request card container
 * 3. Extract member info (name, profile URL, question answers)
 * 4. Send captured data to the background service worker
 * 5. Inject visual confirmation badge
 *
 * Facebook's DOM is heavily obfuscated and changes frequently.
 * We use multiple fallback strategies for resilience.
 */

(function () {
  'use strict';

  const CONFIG = {
    BADGE_CLASS: 'groupbase-approved-badge',
    NOTIFICATION_CLASS: 'groupbase-notification',
    DEBUG: true,
    // How far up the DOM to walk looking for the member card container
    MAX_PARENT_WALK: 20,
    // Delay after approve click before scraping (let FB process first)
    SCRAPE_DELAY: 200,
  };

  const logger = {
    log: (...args) => CONFIG.DEBUG && console.log('[GroupBase]', ...args),
    error: (...args) => console.error('[GroupBase]', ...args),
    warn: (...args) => console.warn('[GroupBase]', ...args),
  };

  // Track which members we've already captured to avoid duplicates
  const capturedMembers = new Set();

  // ============================================
  // GROUP INFO EXTRACTION
  // ============================================

  function getGroupInfo() {
    const pathname = window.location.pathname;
    const groupMatch = pathname.match(/\/groups\/([^/]+)/);
    const fbGroupId = groupMatch ? groupMatch[1] : null;

    // Try multiple selectors for group name (Facebook changes these)
    let fbGroupName = null;
    const nameSelectors = [
      'h1 a[href*="/groups/"]',
      'h1[class]',
      '[role="banner"] h1',
      '[role="main"] h1',
      'a[aria-label][href*="/groups/"] span',
    ];

    for (const selector of nameSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length > 0 && text.length < 100) {
          fbGroupName = text;
          break;
        }
      }
    }

    return {
      fbGroupId,
      fbGroupName,
      fbGroupUrl: fbGroupId
        ? `https://www.facebook.com/groups/${fbGroupId}`
        : window.location.href,
    };
  }

  // ============================================
  // APPROVE BUTTON DETECTION
  // ============================================

  /**
   * Check if an element is an "Approve" button using multiple strategies.
   * Facebook obfuscates class names, so we rely on:
   * - aria-label attributes
   * - Text content
   * - Role attributes
   */
  function isApproveButton(element) {
    if (!element) return false;

    // Strategy 1: aria-label contains "Approve" (most reliable)
    const ariaLabel = element.getAttribute('aria-label') || '';
    if (/approve/i.test(ariaLabel) && !/disapprove/i.test(ariaLabel)) {
      return true;
    }

    // Strategy 2: Button/link text content is exactly "Approve"
    const text = element.textContent?.trim();
    if (text === 'Approve' || text === 'Approve member') {
      // Make sure it's a clickable element
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute('role') || '';
      if (
        tag === 'button' ||
        tag === 'a' ||
        role === 'button' ||
        element.closest('[role="button"]')
      ) {
        return true;
      }
    }

    // Strategy 3: Check parent elements for approve button patterns
    // Facebook sometimes wraps button text in spans
    if (element.tagName === 'SPAN' && text === 'Approve') {
      const parent = element.closest('[role="button"], button');
      if (parent) return true;
    }

    return false;
  }

  /**
   * Find the approve button that was clicked (walking up from click target)
   */
  function findApproveButton(clickTarget) {
    let el = clickTarget;
    let depth = 0;

    while (el && depth < 6) {
      if (isApproveButton(el)) return el;
      el = el.parentElement;
      depth++;
    }

    return null;
  }

  // ============================================
  // MEMBER CARD CONTAINER DETECTION
  // ============================================

  /**
   * Walk up from the approve button to find the member request card container.
   * The container holds the member's name, profile link, and question answers.
   */
  function findMemberContainer(approveButton) {
    let container = approveButton;
    let bestContainer = null;

    for (let i = 0; i < CONFIG.MAX_PARENT_WALK; i++) {
      if (!container.parentElement) break;
      container = container.parentElement;

      // Look for semantic markers
      const role = container.getAttribute('role') || '';
      if (role === 'listitem' || role === 'article' || role === 'row') {
        bestContainer = container;
        break;
      }

      // Facebook uses data-visualcompletion on card containers
      if (container.hasAttribute('data-visualcompletion')) {
        bestContainer = container;
        // Don't break — keep looking for a better semantic container
      }

      // Look for containers that have both a profile link and approve/decline buttons
      const hasProfileLink = container.querySelector(
        'a[href*="facebook.com/"], a[href^="/"]'
      );
      const hasButtons = container.querySelectorAll(
        '[role="button"], button'
      ).length >= 2;

      if (hasProfileLink && hasButtons && !bestContainer) {
        bestContainer = container;
      }
    }

    // Fallback: walk up 8 levels from button
    if (!bestContainer) {
      bestContainer = approveButton;
      for (let i = 0; i < 8; i++) {
        if (bestContainer.parentElement) {
          bestContainer = bestContainer.parentElement;
        }
      }
      logger.warn('Using fallback container (8 levels up)');
    }

    return bestContainer;
  }

  // ============================================
  // MEMBER DATA EXTRACTION
  // ============================================

  function extractMemberData(memberContainer) {
    try {
      const groupInfo = getGroupInfo();
      const memberData = {
        name: null,
        profileUrl: null,
        fbUserId: null,
        answers: [],
        capturedAt: new Date().toISOString(),
        ...groupInfo,
      };

      // --- Extract name and profile URL ---
      // Facebook member request cards contain multiple links: profile, location, mutual friends, etc.
      // Location links appear BEFORE profile links in DOM order, so we must filter them out.
      // Location URLs look like: /pages/City-Name/123, /City-State-123/, or contain geographic slugs.
      // Profile URLs look like: /profile.php?id=123 or /vanity.username
      const links = memberContainer.querySelectorAll('a[href]');

      // Helper: detect if a URL is a location/place link (not a person profile)
      function isLocationOrPlaceLink(href, fullHref) {
        const url = fullHref || href;
        // Facebook place/location pages: /pages/Category/City-Name/id
        if (/\/pages\//i.test(url)) return true;
        // Location slugs: /City-State-123456/ (capitalized words joined by hyphens followed by digits)
        if (/facebook\.com\/[A-Z][a-zA-Z]+-[A-Z][a-zA-Z]+-\d+/i.test(url)) return true;
        // Location-style paths with multiple hyphens and digits at end
        if (/facebook\.com\/[A-Za-z]+-[A-Za-z]+-[A-Za-z]+-\d+/.test(url)) return true;
        // Place IDs (all-digit paths that aren't profile.php)
        if (/facebook\.com\/\d+\/?$/.test(url) && !url.includes('profile.php')) return true;
        return false;
      }

      // Helper: detect if link text looks like a location name
      function isLocationText(text) {
        if (!text) return false;
        // "City, State" or "City, Country" pattern
        if (/^[A-Z][a-zA-Z\s]+,\s+[A-Z][a-zA-Z\s]+$/.test(text)) return true;
        // Common location suffixes
        if (/,\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)$/i.test(text)) return true;
        return false;
      }

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const fullHref = link.href || '';

        // Skip group links, hashtags, and action links
        if (
          href.includes('/groups/') ||
          href === '#' ||
          href.includes('?__cft__') ||
          href.startsWith('javascript:')
        ) {
          continue;
        }

        // Skip location/place links
        if (isLocationOrPlaceLink(href, fullHref)) {
          continue;
        }

        // Must be a Facebook profile link
        if (
          fullHref.includes('facebook.com/') ||
          href.startsWith('/')
        ) {
          const text = link.textContent?.trim();

          // Skip buttons, actions, and location-like text
          if (
            !text ||
            text.length <= 1 ||
            text.length >= 80 ||
            ['Approve', 'Decline', 'Report', 'Delete', 'Block', 'More', 'See more'].includes(text) ||
            isLocationText(text)
          ) {
            continue;
          }

          // Skip links that look like "X mutual friends" or other metadata
          if (/^\d+\s+(mutual\s+friend|friend|follower)/i.test(text)) {
            continue;
          }

          memberData.name = text;
          memberData.profileUrl = fullHref.startsWith('http')
            ? fullHref
            : `https://www.facebook.com${href}`;

          // Try to extract numeric user ID or vanity username
          const idMatch = fullHref.match(
            /facebook\.com\/(?:profile\.php\?id=)?(\d+)/
          );
          if (idMatch) {
            memberData.fbUserId = idMatch[1];
          } else {
            // Extract vanity username (e.g. facebook.com/tony.roark)
            const vanityMatch = fullHref.match(
              /facebook\.com\/([a-zA-Z0-9._-]+)\/?(?:\?|$)/
            );
            if (vanityMatch && !['groups', 'pages', 'events', 'photo', 'photos', 'videos', 'watch', 'marketplace', 'gaming', 'search'].includes(vanityMatch[1])) {
              memberData.fbUserId = vanityMatch[1];
            }
          }
          break;
        }
      }

      // Fallback name extraction from headings
      if (!memberData.name) {
        const headingSelectors = [
          'h3', 'h4', 'strong', '[role="heading"]',
          'span[dir="auto"]',
        ];
        for (const sel of headingSelectors) {
          const el = memberContainer.querySelector(sel);
          if (el) {
            const text = el.textContent?.trim();
            if (text && text.length > 1 && text.length < 80) {
              memberData.name = text;
              break;
            }
          }
        }
      }

      // --- Extract membership question answers ---
      // Facebook shows Q&A in the member request card.
      // Strategy: collect text nodes but aggressively filter out non-Q&A content
      // like accessibility labels, button text, metadata, location info, etc.
      const allText = [];
      const walker = document.createTreeWalker(
        memberContainer,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            // Skip text inside buttons, links we already processed, and aria-hidden elements
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;

            // Skip text inside interactive elements (buttons, action links)
            const closestButton = parent.closest('button, [role="button"]');
            if (closestButton) return NodeFilter.FILTER_REJECT;

            // Skip text inside elements with aria-label (accessibility wrappers)
            if (parent.getAttribute('aria-label') || parent.closest('[aria-label]')) {
              // But allow if it's deep inside the Q&A area (span[dir="auto"] often wraps answers)
              if (!parent.closest('span[dir="auto"]') && !parent.matches('span[dir="auto"]')) {
                return NodeFilter.FILTER_REJECT;
              }
            }

            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      while (walker.nextNode()) {
        const text = walker.currentNode.textContent?.trim();
        if (text && text.length > 3 && text.length < 1000) {
          allText.push(text);
        }
      }

      // Comprehensive skip list for non-Q&A content
      const skipTexts = new Set([
        memberData.name,
        'Approve',
        'Decline',
        'Report',
        'Delete',
        'Block',
        'More',
        'Edit',
        'See more',
        'See less',
        'Requested',
        'Invited',
        groupInfo.fbGroupName,
        'Member requests',
        'No pending members',
        'Approve member',
        'Decline member',
        'Approve request',
        'Decline request',
      ]);

      const answers = [];
      for (const text of allText) {
        // Skip exact matches
        if (skipTexts.has(text)) continue;
        // Must be meaningful length
        if (text.length <= 5) continue;
        // Skip date/time strings
        if (/^\d+\s+(hours?|minutes?|days?|weeks?|months?|years?)\s+ago$/i.test(text)) continue;
        if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(text)) continue;
        // Skip filter/UI labels
        if (['Questions', 'Gender', 'Request age', 'Join Facebook date', 'More filters', 'Clear filters', 'Newest first', 'Oldest first', 'Pending', 'Pre-approved'].includes(text)) continue;
        // Skip accessibility labels and descriptions
        if (/^Accessibility/i.test(text)) continue;
        if (/^This\s+(button|link|image|icon|element)\s/i.test(text)) continue;
        // Skip location-like text (City, State patterns)
        if (/^[A-Z][a-zA-Z\s]+,\s+[A-Z][a-zA-Z\s]+$/.test(text)) continue;
        // Skip friend count text
        if (/^\d+\s+(mutual\s+friend|friend|follower)/i.test(text)) continue;
        // Skip "Joined Facebook in YYYY" or "Joined in YYYY"
        if (/^Joined\s+(Facebook\s+)?in\s+\d{4}/i.test(text)) continue;
        // Skip "Lives in City" or "From City"
        if (/^(Lives\s+in|From)\s+/i.test(text)) continue;
        // Skip "Requested X ago" status text
        if (/^Requested\s+/i.test(text)) continue;
        // Skip "Invited by" text
        if (/^Invited\s+by\s+/i.test(text)) continue;
        // Skip numeric-only text (like counts)
        if (/^\d+$/.test(text)) continue;
        // Skip very short generic words that slip through
        if (/^(Admin|Member|Moderator|Contributor|Group\s+rules?)$/i.test(text)) continue;

        answers.push(text);
      }

      // Deduplicate and limit answers
      memberData.answers = [...new Set(answers)].slice(0, 10);

      logger.log('Extracted member data:', memberData);
      return memberData;
    } catch (error) {
      logger.error('Error extracting member data:', error);
      return null;
    }
  }

  // ============================================
  // VISUAL FEEDBACK
  // ============================================

  function injectApprovedBadge(memberContainer) {
    try {
      if (memberContainer.querySelector(`.${CONFIG.BADGE_CLASS}`)) return;

      const badge = document.createElement('div');
      badge.className = CONFIG.BADGE_CLASS;
      badge.textContent = 'GroupBase';
      badge.title = 'Member data captured by GroupBase';

      // Try to insert near the top of the container
      const firstChild = memberContainer.firstElementChild || memberContainer.firstChild;
      if (firstChild) {
        memberContainer.insertBefore(badge, firstChild);
      } else {
        memberContainer.appendChild(badge);
      }
    } catch (error) {
      logger.error('Error injecting badge:', error);
    }
  }

  function showNotification(message, type = 'success') {
    // Remove existing notification
    const existing = document.querySelector(`.${CONFIG.NOTIFICATION_CLASS}`);
    if (existing) existing.remove();

    const notif = document.createElement('div');
    notif.className = CONFIG.NOTIFICATION_CLASS;
    notif.textContent = message;
    notif.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e53e3e'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 99999;
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
    `;

    document.body.appendChild(notif);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notif.style.transition = 'opacity 0.3s';
      notif.style.opacity = '0';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }

  // ============================================
  // COMMUNICATION WITH BACKGROUND
  // ============================================

  function sendMemberDataToBackground(memberData) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'MEMBER_APPROVED', payload: memberData },
          (response) => {
            if (chrome.runtime.lastError) {
              logger.error('Error sending to background:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              logger.log('Background response:', response);
              resolve(response || { success: false });
            }
          }
        );
      } catch (error) {
        logger.error('Error sending member data:', error);
        resolve({ success: false, error: error.message });
      }
    });
  }

  async function checkAuthStatus() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ authenticated: false });
          } else {
            resolve(response || { authenticated: false });
          }
        });
      } catch {
        resolve({ authenticated: false });
      }
    });
  }

  // ============================================
  // MAIN APPROVAL HANDLER
  // ============================================

  async function handleApprovalClick(event) {
    try {
      const approveButton = findApproveButton(event.target);
      if (!approveButton) {
        logger.warn('Could not identify approve button');
        return;
      }

      // Check if user is authenticated
      const authState = await checkAuthStatus();
      if (!authState.authenticated) {
        showNotification('Sign in to GroupBase extension to capture members', 'error');
        return;
      }

      // Find the member card container
      const container = findMemberContainer(approveButton);
      if (!container) {
        logger.warn('Could not find member container');
        return;
      }

      // Extract member data
      const memberData = extractMemberData(container);
      if (!memberData || !memberData.name) {
        logger.warn('Could not extract member name');
        return;
      }

      // Dedup check
      const dedupeKey = `${memberData.name}-${memberData.profileUrl || ''}`;
      if (capturedMembers.has(dedupeKey)) {
        logger.log('Member already captured, skipping:', dedupeKey);
        return;
      }
      capturedMembers.add(dedupeKey);

      logger.log('Capturing member:', memberData.name);

      // Send to background service worker
      const result = await sendMemberDataToBackground(memberData);

      if (result.success) {
        injectApprovedBadge(container);
        updateCaptureCount();
        showNotification(`✓ ${memberData.name} captured by GroupBase`);
        logger.log('Member captured successfully:', memberData.name);
      } else {
        if (result.queued) {
          showNotification(`${memberData.name} queued (will retry)`, 'error');
        } else {
          showNotification(`Failed to capture ${memberData.name}`, 'error');
        }
        logger.error('Failed to capture member:', result.error);
      }
    } catch (error) {
      logger.error('Error in handleApprovalClick:', error);
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  function setupEventDelegation() {
    // Use capture phase to catch clicks before Facebook handlers
    document.addEventListener(
      'click',
      (event) => {
        // Quick check: is this anywhere near an approve button?
        const target = event.target;
        const approveBtn = findApproveButton(target);

        if (approveBtn) {
          logger.log('Approve button click detected');
          // Delay to let Facebook process the approval first
          setTimeout(() => handleApprovalClick(event), CONFIG.SCRAPE_DELAY);
        }
      },
      true // capture phase
    );

    // Also listen for keyboard activation (Enter/Space on focused approve button)
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          const target = event.target;
          if (isApproveButton(target)) {
            logger.log('Approve button activated via keyboard');
            setTimeout(() => handleApprovalClick(event), CONFIG.SCRAPE_DELAY);
          }
        }
      },
      true
    );

    logger.log('Event delegation ready');
  }

  /**
   * MutationObserver to track dynamic content loading.
   * Facebook loads member requests dynamically via infinite scroll.
   */
  function setupMutationObserver() {
    let debounceTimer;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Count potential member request items
        const items = document.querySelectorAll(
          '[role="listitem"], [role="article"], [role="row"]'
        );
        if (items.length > 0) {
          logger.log(`DOM updated: ${items.length} potential member items`);
        }
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  // ============================================
  // STATUS BANNER
  // ============================================

  // Track captured count for the session
  let sessionCaptureCount = 0;

  async function showStatusBanner() {
    // Remove old indicator/banner if present
    const old = document.getElementById('groupbase-status');
    if (old) old.remove();
    const oldBanner = document.getElementById('groupbase-banner');
    if (oldBanner) oldBanner.remove();

    const authState = await checkAuthStatus();
    const groupInfo = getGroupInfo();
    const isAuthenticated = authState.authenticated;

    const banner = document.createElement('div');
    banner.id = 'groupbase-banner';
    banner.className = 'groupbase-banner';

    banner.innerHTML = `
      <div class="groupbase-banner-dot ${isAuthenticated ? '' : 'disconnected'}"></div>
      <div class="groupbase-banner-logo">G</div>
      <div class="groupbase-banner-text">
        <span class="groupbase-banner-title">GroupBase ${isAuthenticated ? 'Active' : 'Disconnected'}</span>
        <span class="groupbase-banner-subtitle">${
          isAuthenticated
            ? 'Approvals will be captured automatically'
            : 'Click extension icon to sign in'
        }</span>
      </div>
      <span id="groupbase-capture-count" class="groupbase-banner-counter" style="display:none;">0</span>
      <button class="groupbase-banner-close" title="Minimize">×</button>
    `;

    document.body.appendChild(banner);

    // Close button minimizes to small dot
    const closeBtn = banner.querySelector('.groupbase-banner-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      banner.remove();
      showMiniBanner(isAuthenticated);
    });
  }

  function showMiniBanner(isAuthenticated) {
    const mini = document.createElement('div');
    mini.id = 'groupbase-banner-mini';
    mini.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 10px rgba(102,126,234,0.4);
      z-index: 99999;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s;
    `;
    mini.innerHTML = `
      <span style="width:8px;height:8px;border-radius:50%;background:${isAuthenticated ? '#48bb78' : '#fc8181'};"></span>
      GB
      <span id="groupbase-mini-count" style="display:${sessionCaptureCount > 0 ? 'inline' : 'none'};">(${sessionCaptureCount})</span>
    `;

    mini.addEventListener('click', () => {
      mini.remove();
      showStatusBanner();
    });

    mini.addEventListener('mouseenter', () => {
      mini.style.transform = 'scale(1.05)';
    });
    mini.addEventListener('mouseleave', () => {
      mini.style.transform = 'scale(1)';
    });

    document.body.appendChild(mini);
  }

  function updateCaptureCount() {
    sessionCaptureCount++;

    // Update full banner counter
    const counter = document.getElementById('groupbase-capture-count');
    if (counter) {
      counter.textContent = sessionCaptureCount;
      counter.style.display = 'inline';
    }

    // Update mini banner counter
    const miniCount = document.getElementById('groupbase-mini-count');
    if (miniCount) {
      miniCount.textContent = `(${sessionCaptureCount})`;
      miniCount.style.display = 'inline';
    }
  }

  // ============================================
  // INITIALIZE
  // ============================================

  function init() {
    if (!window.location.pathname.includes('/groups/')) {
      return;
    }

    logger.log('GroupBase content script initializing...');
    logger.log('URL:', window.location.href);
    logger.log('Group info:', getGroupInfo());

    setupEventDelegation();
    setupMutationObserver();

    // Only show status indicator on member-requests pages
    if (
      window.location.pathname.includes('member-requests') ||
      window.location.pathname.includes('members')
    ) {
      showStatusBanner();
    }

    logger.log('GroupBase content script ready — listening for Approve clicks');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
