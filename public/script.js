/* script.js - shared across pages
   - Mobile hamburger nav
   - Interactive card Book Now -> saves a draft and redirects to bookings
   - Prefill bookings form from draft
   - Live booking price calculation with backend integration
     * Stretch: 250 KES/m²
     * A-frame: 40k/section, B-line: 30k, Cheese: 15k
     * Ambient Lighting: 12k
     * Transport: Dynamic based on Nairobi zones or outside Nairobi regions
   - PA Sound System, Dance Floor, Stage & Podium, Welcome Signs add-ons
   - Site visit requests redirect to contact form
   - Real-time zone identification as user types location
   - Checkout loader (reads booking with breakdown data from localStorage)
   - loadPesapalIframe(bookingId) helper (secure iframe from backend)
   
   IMPROVEMENTS (v2):
   - Timeout handling (10s default on all API calls)
   - Better error handling and user feedback
   - Kenya phone validation (+254, 0, or 254 prefix)
   - Auto-clear booking after successful payment
   - Loading states on async operations
   - localStorage quota safe handling
   - Enhanced error messages
*/

(function () {
  // --- Configuration: API Base URL & Timeouts
  const API_BASE_URL = window.API_BASE_URL || "/api";
  const API_TIMEOUT = 10000; // 10 seconds for all API calls
  
  // --- Logging utility for debugging
  const log = {
    info: (category, message, data) => {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = `[${timestamp}] [${category}]`;
      console.log(prefix, message, data || '');
    },
    error: (category, message, error) => {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = `[${timestamp}] [${category}] `;
      console.error(prefix, message, error || '');
    },
    warn: (category, message, data) => {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = `[${timestamp}] [${category}] `;
      console.warn(prefix, message, data || '');
    }
  };
  
  // Make logger global for debugging in console
  window.BintiLog = log;
  
  // --- API Utility with Timeout & Error Handling
  const apiCall = async (url, options = {}) => {
    const timeout = options.timeout || API_TIMEOUT;
    const method = options.method || 'GET';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      log.info('API', `${method} ${url}`, { timeout });
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        log.error('API', `HTTP ${response.status} from ${url}`);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }
      
      const data = await response.json();
      log.info('API', `Success: ${method} ${url}`, data);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        log.error('API', `Timeout (${timeout}ms) on ${method} ${url}`);
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      
      log.error('API', `Error on ${method} ${url}`, error);
      throw error;
    }
  };
  
  window.BintiApi = { call: apiCall }; // Expose for debugging
  
  // Log initial setup
  log.info('INIT', 'Binti Events script loaded', { API_BASE_URL, API_TIMEOUT });
  log.info('INIT', 'Environment info', {
    currentOrigin: window.location.origin,
    currentPath: window.location.pathname,
    currentProtocol: window.location.protocol
  });

  // ============================================
  // UTILITY FUNCTIONS - Reduce Code Redundancy
  // ============================================
  
  // Check if required form fields are filled
  const getFormValidationState = () => {
    const fullnameInput = document.getElementById('fullname');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');
    return {
      hasFullname: fullnameInput && fullnameInput.value && fullnameInput.value.trim(),
      hasPhone: phoneInput && phoneInput.value && phoneInput.value.trim(),
      hasEmail: emailInput && emailInput.value && emailInput.value.trim()
    };
  };

  // Clear all booking-related localStorage
  const clearAllBookingData = () => {
    localStorage.removeItem('bintiBooking');
    localStorage.removeItem('bintiBookingDraft');
    localStorage.removeItem('bintiSelectedPackage');
    log.info('BOOKING', 'All booking data cleared from localStorage');
  };

  // Expose utilities globally for use in functions
  window._getFormValidationState = getFormValidationState;
  window._clearAllBookingData = clearAllBookingData;
  
  // --- helpers
  function onReady(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function q(sel, ctx=document){ return ctx.querySelector(sel); }
  function qa(sel, ctx=document){ return Array.from(ctx.querySelectorAll(sel)); }

  // --- Initialize AOS (Animate On Scroll)
  onReady(() => {
    if (typeof AOS !== 'undefined') {
      log.info('INIT', 'Initializing AOS animations');
      AOS.init({ 
        duration: 800, 
        offset: 100,
        once: true 
      });
    } else {
      log.warn('INIT', 'AOS library not loaded');
    }
  });

  // --- Kenya Phone Validation Utility
  const validateKenyaPhone = (phone) => {
    if (!phone) return false;
    // Accept: 0712345678, +254712345678, 254712345678
    // Must be 9-13 digits and start with 0, +254, or 254
    const cleaned = phone.replace(/\s+/g, '');
    return /^(?:0|\+254|254)[17]\d{8}$/.test(cleaned);
  };
  
  const formatPhoneDisplay = (phone) => {
    const cleaned = phone.replace(/\s+/g, '');
    if (cleaned.startsWith('0')) return cleaned;
    if (cleaned.startsWith('+254')) return '0' + cleaned.slice(4);
    if (cleaned.startsWith('254')) return '0' + cleaned.slice(3);
    return cleaned;
  };
  
  // --- localStorage Safe Utility (with quota handling)
  const safeSetItem = (key, value) => {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      log.info('STORAGE', `Saved ${key} (${serialized.length} bytes)`);
      return true;
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        log.error('STORAGE', 'localStorage quota exceeded', err);
        // Try to clear old data
        try {
          localStorage.removeItem('bintiBookingDraft');
          localStorage.setItem(key, JSON.stringify(value));
          log.info('STORAGE', 'Retried after clearing draft');
          return true;
        } catch (retryErr) {
          log.error('STORAGE', 'Failed to save even after cleanup', retryErr);
          return false;
        }
      }
      log.error('STORAGE', `Failed to save ${key}`, err);
      return false;
    }
  };
  
  const safeGetItem = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      log.error('STORAGE', `Failed to parse ${key}`, err);
      return null;
    }
  };
  
  // --- mobile nav
  onReady(() => {
    const hamburger = q('#hamburger');
    const navLinks = q('.nav-links');
    if (hamburger && navLinks) {
      hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('show');
        hamburger.classList.toggle('active');
      });
      // Close menu when a link is clicked
      qa('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('show');
          hamburger.classList.remove('active');
        });
      });
    }
  });

  // --- Transparent navbar scroll detection
  window.addEventListener('scroll', () => {
    const header = document.querySelector('.site-header');
    if (header) {
      if (window.scrollY > 80) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  });

  // --- Card Book Now clicks: save a draft and redirect to bookings
  onReady(() => {
    qa('.btn-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ds = e.currentTarget.dataset;
        const draft = { source: 'card', timestamp: Date.now() };
        if (ds.tent) draft.tentType = ds.tent;
        if (ds.size) draft.stretchSize = ds.size;
        if (ds.color) draft.cheeseColor = ds.color;
        if (ds.sections) draft.aframeSections = ds.sections;
        if (ds.service) draft.service = ds.service;
        
        // save draft with safe storage
        if (!safeSetItem('bintiBookingDraft', draft)) {
          alert('Could not save selection. Please try again.');
          return;
        }

        // visual feedback then redirect
        const orig = btn.textContent;
        btn.textContent = 'Preparing…';
        btn.disabled = true;
        setTimeout(() => { window.location.href = 'bookings.html'; }, 250);
      });
    });
  });

  // --- Prefill bookings form from draft and add behaviour
  onReady(() => {
    const form = q('#booking-form');
    if (!form) {
      log.info('BOOKING', 'Not on booking form page');
      return;
    }
    
    log.info('BOOKING', 'Initializing booking form');

    // Clear any old booking data to start fresh
    localStorage.removeItem('bintiBooking');

    const draftRaw = localStorage.getItem('bintiBookingDraft');
    let draft = null;
    try { if (draftRaw) draft = JSON.parse(draftRaw); } catch (e) { log.error('BOOKING', 'Invalid draft JSON', e); }
    if (draft) log.info('BOOKING', 'Draft loaded from localStorage', draft);

    // --- Load selected package if user came from package page
    const packageRaw = localStorage.getItem('bintiSelectedPackage');
    let selectedPackage = null;
    let isPackageFlow = false; // Track which flow user is in
    try { if (packageRaw) selectedPackage = JSON.parse(packageRaw); } catch (e) { log.error('BOOKING', 'Invalid package JSON', e); }
    if (selectedPackage) log.info('BOOKING', 'Selected package loaded', selectedPackage);

    // Determine booking flow: package-only vs tent-only
    if (selectedPackage && selectedPackage.name) {
      isPackageFlow = true;
      const packageSection = q('#package-section');
      const tentSection = q('#tent-section');
      const addonsSection = q('.form-section:has(#ambient-lighting)'); // Find add-ons section
      
      if (packageSection) {
        packageSection.style.display = 'block';
        const packageName = q('#selected-package-name');
        if (packageName) packageName.textContent = selectedPackage.name;
        log.info('BOOKING', 'Package flow enabled - package section displayed', selectedPackage.name);
      }
      
      // Hide tent section for package flow
      if (tentSection) tentSection.style.display = 'none';
      
      // Show add-ons section for package customization (optional)
      if (addonsSection) addonsSection.style.display = 'block';
    } else {
      // Tent-only flow - hide package section
      isPackageFlow = false;
      const packageSection = q('#package-section');
      const tentSection = q('#tent-section');
      
      if (packageSection) packageSection.style.display = 'none';
      if (tentSection) tentSection.style.display = 'none'; // Hidden initially, shows when details filled
      
      log.info('BOOKING', 'Tent flow enabled - user will select tents');
    }

    // Elements we'll use
    const tentTypeEl = q('#tent-type');
    const stretchSizeEl = q('#stretch-size');
    const cheeseColorEl = q('#cheese-color');
    const aframeSectionsEl = q('#aframe-sections');
    const lightingEl = q('#ambient-lighting');
    const transportEl = q('#transport');
    const decorEl = q('#decor');
    const pasoundEl = q('#pasound');
    const dancefloorEl = q('#dancefloor');
    const stagepodiumEl = q('#stage-podium');
    const welcomesignsEl = q('#welcome-signs');
    const venueEl = q('#venue');
    const eventDateEl = q('#event-date');
    const setupTimeEl = q('#setup-time');
    const additionalInfoEl = q('#additional-info');
    const summaryBox = q('#booking-summary');
    const siteVisitBtn = q('#site-visit-btn');
    const tentConfigsContainer = q('#tent-configurations');
    const addTentConfigBtn = q('#add-tent-config-btn');

    // Character counter setup for additional info
    const charCountEl = q('#char-count');
    const MAX_CHARS = 500;
    
    if (additionalInfoEl && charCountEl) {
      // Initialize counter display
      charCountEl.textContent = `0/${MAX_CHARS}`;
      charCountEl.className = 'char-counter normal';
      
      // Add input event listener for real-time counting
      additionalInfoEl.addEventListener('input', () => {
        const currentLength = additionalInfoEl.value.length;
        
        // Prevent exceeding max length
        if (currentLength > MAX_CHARS) {
          additionalInfoEl.value = additionalInfoEl.value.substring(0, MAX_CHARS);
          return;
        }
        
        // Update counter display
        charCountEl.textContent = `${currentLength}/${MAX_CHARS}`;
        
        // Change color based on character count
        if (currentLength <= 250) {
          // Normal state - up to 250 chars
          charCountEl.className = 'char-counter normal';
        } else if (currentLength <= 400) {
          // Warning state - 250-400 chars (gold)
          charCountEl.className = 'char-counter warning';
        } else {
          // Danger state - 400-500 chars (rose/pink)
          charCountEl.className = 'char-counter danger';
        }
        
        // Trigger summary update on input
        updateSummary();
      });
      
      log.info('BOOKING', 'Character counter initialized for additional info', { MAX_CHARS });
    }

    // Log element references for debugging
    log.info('BOOKING', 'Form elements found', {
      hasEventDateEl: !!eventDateEl,
      hasSetupTimeEl: !!setupTimeEl,
      eventDateValue: eventDateEl ? eventDateEl.value : 'N/A',
      setupTimeValue: setupTimeEl ? setupTimeEl.value : 'N/A'
    });

    // Track multiple tent configurations
    let tentConfigs = [];
    let nextConfigId = 1;

    function getTentConfigDisplay(config) {
      if (config.type === 'stretch') {
        return `${config.size} Stretch`;
      } else if (config.type === 'cheese') {
        return `Cheese${config.color ? ' (' + config.color + ')' : ''}`;
      } else if (config.type === 'aframe') {
        return `A-frame (${config.sections || 1} section${config.sections > 1 ? 's' : ''})`;
      } else if (config.type === 'bline') {
        return 'B-line';
      }
      return 'Tent';
    }

    function renderTentConfigs() {
      if (!tentConfigsContainer) return;
      
      if (tentConfigs.length === 0) {
        tentConfigsContainer.innerHTML = '';
        if (addTentConfigBtn) addTentConfigBtn.style.display = 'none';
        return;
      }
      
      let html = '<div style="margin-top: 15px;">';
      tentConfigs.forEach((config, idx) => {
        html += `<div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">`;
        html += `<span style="font-weight: 600; color: #333;">Tent ${idx + 1}: ${getTentConfigDisplay(config)}</span>`;
        html += `<button type="button" class="remove-tent-config-btn" data-id="${config.id}" style="background: #d9534f; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">Remove</button>`;
        html += `</div>`;
      });
      html += '</div>';
      
      tentConfigsContainer.innerHTML = html;
      
      // Add event listeners to remove buttons
      const removeButtons = tentConfigsContainer.querySelectorAll('.remove-tent-config-btn');
      removeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const configId = parseInt(btn.getAttribute('data-id'));
          tentConfigs = tentConfigs.filter(c => c.id !== configId);
          renderTentConfigs();
          updateSummary();
        });
      });
      
      // Update add button text and visibility
      if (addTentConfigBtn) {
        if (tentConfigs.length >= 4) {
          addTentConfigBtn.style.display = 'none';
        } else if (tentConfigs.length > 0) {
          addTentConfigBtn.innerHTML = '<i class="fas fa-plus"></i> Add Another Tent';
        }
      }
    }

    function addTentConfig() {
      const tentType = tentTypeEl ? tentTypeEl.value : '';
      
      if (!tentType) {
        alert('Please select a tent type first');
        return;
      }
      
      // Switch to tent flow when adding first tent
      if (tentConfigs.length === 0) {
        isPackageFlow = false;
        log.info('BOOKING', 'Switched from package flow to tent flow - first tent being added');
      }
      
      const config = {
        id: nextConfigId++,
        type: tentType
      };
      
      // Get the specific details based on tent type
      if (tentType === 'stretch') {
        const size = stretchSizeEl ? stretchSizeEl.value : '';
        if (!size) {
          alert('Please select a stretch tent size');
          return;
        }
        config.size = size;
      } else if (tentType === 'cheese') {
        const color = cheeseColorEl ? cheeseColorEl.value : '';
        if (!color) {
          alert('Please select a cheese tent color');
          return;
        }
        config.color = color;
      } else if (tentType === 'aframe') {
        config.sections = aframeSectionsEl ? aframeSectionsEl.value : '1';
      }
      // bline has no options, just add it
      
      tentConfigs.push(config);
      renderTentConfigs();
      showConditional(); // Update button visibility
      log.info('BOOKING', 'Tent config added', config);
      updateSummary();
    }

    function showConditional() {
      const val = tentTypeEl.value;
      
      // Update checkbox visibility with new class-based conditional sections
      const stretchOptions = q('#stretch-options');
      const cheeseOptions = q('#cheese-options');
      const aframeOptions = q('#aframe-options');
      
      if (stretchOptions) {
        stretchOptions.style.display = val === 'stretch' ? 'block' : 'none';
        stretchOptions.setAttribute('aria-hidden', val !== 'stretch');
      }
      
      if (cheeseOptions) {
        cheeseOptions.style.display = val === 'cheese' ? 'block' : 'none';
        cheeseOptions.setAttribute('aria-hidden', val !== 'cheese');
      }
      
      if (aframeOptions) {
        aframeOptions.style.display = val === 'aframe' ? 'block' : 'none';
        aframeOptions.setAttribute('aria-hidden', val !== 'aframe');
      }
      
      // Show add button when tent type is selected and we have less than 4 tents
      if (addTentConfigBtn) {
        addTentConfigBtn.style.display = (val && tentConfigs.length < 4) ? 'block' : 'none';
      }
    }

    function parseSizeArea(size) {
      if (!size) return 0;
      const parts = size.split('x').map(p => parseFloat(p));
      if (parts.length !== 2) return 0;
      return parts[0] * parts[1];
    }

    // Function to manage tent section visibility based on form details
    function updateTentSectionVisibility() {
      const tentSection = q('#tent-section');
      const tentSectionNotice = q('#tent-section-notice');
      const packageSection = q('#package-section');
      const fullnameInput = q('#fullname');
      const phoneInput = q('#phone');
      const emailInput = q('#email');
      
      if (!tentSection) return;
      
      // If a package is selected, keep tent section hidden
      if (packageSection && packageSection.style.display !== 'none') {
        tentSection.style.display = 'none';
        return;
      }
      
      // Check if all details are filled
      const hasFullname = fullnameInput && fullnameInput.value && fullnameInput.value.trim();
      const hasPhone = phoneInput && phoneInput.value && phoneInput.value.trim();
      const hasEmail = emailInput && emailInput.value && emailInput.value.trim();
      
      // Always show tent section in tent-flow mode, but with notice when details incomplete
      tentSection.style.display = 'block';
      
      if (hasFullname && hasPhone && hasEmail) {
        // All details filled - enable tent selection and hide notice
        if (tentSectionNotice) tentSectionNotice.style.display = 'none';
        if (tentTypeEl) tentTypeEl.disabled = false;
        log.info('BOOKING', 'Tent section enabled - all details filled');
      } else {
        // Details missing - show notice and disable tent selection
        if (tentSectionNotice) tentSectionNotice.style.display = 'block';
        if (tentTypeEl) tentTypeEl.disabled = true;
        log.info('BOOKING', 'Tent section disabled - incomplete details');
      }
    }

    // Zone info display helper
    const zoneInfoBox = document.createElement('div');
    zoneInfoBox.id = 'zone-info-display';
    zoneInfoBox.style.cssText = 'padding: 10px; margin: 10px 0; background: #f0f8ff; border-left: 4px solid #007bff; border-radius: 4px; display: none; font-size: 0.9em;';

    function updateSummary() {
      try {
        const values = {
          tentType: tentTypeEl ? tentTypeEl.value : '',
          tentConfigs: tentConfigs,
          stretchSize: stretchSizeEl ? stretchSizeEl.value : '',
          cheeseColor: cheeseColorEl ? cheeseColorEl.value : '',
          aframeSections: aframeSectionsEl ? aframeSectionsEl.value : '1',
          lighting: lightingEl && lightingEl.checked ? true : false,
          transport: transportEl && transportEl.checked ? true : false,
          decor: decorEl && decorEl.checked ? true : false,
          pasound: pasoundEl && pasoundEl.checked ? true : false,
          dancefloor: dancefloorEl && dancefloorEl.checked ? true : false,
          stagepodium: stagepodiumEl && stagepodiumEl.checked ? true : false,
          welcomesigns: welcomesignsEl && welcomesignsEl.checked ? true : false,
          venue: venueEl ? venueEl.value : '',
          eventDate: eventDateEl ? eventDateEl.value : '',
          setupTime: setupTimeEl ? setupTimeEl.value : '',
          sections: aframeSectionsEl ? aframeSectionsEl.value : '1',
          additionalInfo: q('#additional-info') ? q('#additional-info').value.trim() : ''
        };

        log.info('BOOKING', 'Form values updated', values);
        
        // Explicit logging for date/time fields
        if (!values.eventDate) log.warn('BOOKING', 'Event date is EMPTY in updateSummary');
        if (!values.setupTime) log.warn('BOOKING', 'Setup time is EMPTY in updateSummary');
        if (values.eventDate && values.setupTime) {
          log.info('BOOKING', '✓ Date and time captured successfully', { eventDate: values.eventDate, setupTime: values.setupTime });
        }

      // GUARD: Different validation based on booking flow
      if (isPackageFlow) {
        // Package flow: Just show package info without needing tent configs
        log.info('BOOKING', 'Package flow - skipping tent requirement check');
      } else {
        // Tent flow: Need at least one tent configuration
        if (tentConfigs.length === 0) {
          log.warn('BOOKING', 'No tent configurations selected - skipping API call');
          if (summaryBox) {
            summaryBox.innerHTML = `<p style="color: #999; text-align: center; padding: 20px;">
              <i class="fas fa-arrow-left"></i> Select and add a tent to see live pricing
            </p>`;
          }
          return;
        }
      }

      // GUARD: For stretch tents, ensure size is selected (only for tent flow without package)
      if (!isPackageFlow && values.tentType === 'stretch' && !values.stretchSize) {
        log.warn('BOOKING', 'Stretch tent selected but size not chosen - skipping API call');
        if (summaryBox) {
          summaryBox.innerHTML = `<p style="color: #999; text-align: center; padding: 20px;">
            <i class="fas fa-arrow-left"></i> Select a tent size
          </p>`;
        }
        return;
      }

      // GUARD: For transport, ensure location is provided
      if (values.transport && !values.venue) {
        log.warn('BOOKING', 'Transport checked but venue not entered - skipping API call');
        if (summaryBox) {
          summaryBox.innerHTML = `<p style="color: #d9534f; padding: 15px; border-radius: 4px; background: #ffe6e6;">
            <strong> Location Required:</strong> Please enter your venue location for transport pricing.
          </p>`;
        }
        return;
      }

      // Payload construction - supports all flow types
      const payload = {
        bookingFlow: isPackageFlow ? 'package' : 'tent', // Can be enhanced to 'package-plus-tents' later
        // Always send tentConfigs - backend will calculate only if present
        tentConfigs: tentConfigs, 
        // Always send package info - backend will calculate only if present
        lighting: values.lighting ? 'yes' : 'no',
        transport: values.transport ? 'yes' : 'no',
        pasound: values.pasound ? 'yes' : 'no',
        dancefloor: values.dancefloor ? 'yes' : 'no',
        stagepodium: values.stagepodium ? 'yes' : 'no',
        welcomesigns: values.welcomesigns ? 'yes' : 'no',
        decor: values.decor ? 'yes' : 'no',
        location: values.venue,
        sections: values.sections,
        eventDate: values.eventDate,
        setupTime: values.setupTime,
        packageName: selectedPackage ? selectedPackage.name : null,
        packageBasePrice: selectedPackage ? selectedPackage.basePrice : 0
      };

      log.info('BOOKING', 'Sending calculation payload to backend', payload);

      // Call backend calculate endpoint
      const calcUrl = `${API_BASE_URL}/bookings/calculate`;
      log.info('BOOKING', 'Calling calculation API', { url: calcUrl });
      
      apiCall(calcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: API_TIMEOUT
      })
        .then(data => {
          log.info('BOOKING', 'Calculation response', data);
          
          if (!data.success) {
            const error = data.message || 'Calculation error';
            log.error('BOOKING', 'Calculation failed', error);
            if (summaryBox) summaryBox.innerHTML = `<p style="color: #d9534f;"><strong> Error:</strong> ${error}</p>`;
            return;
          }

          log.info('BOOKING', 'Calculation successful', { breakdown: data.breakdown, total: data.total });

          const breakdown = data.breakdown;
          let html = '';
          const total = data.total;

          // Show selected package if applicable
          if (selectedPackage && selectedPackage.name) {
            html += `<p style="background: rgba(212, 175, 55, 0.15); padding: 8px 12px; border-radius: 4px; margin-bottom: 12px;"><strong>📦 Package:</strong> ${selectedPackage.name}</p>`;
          }

          // Event date and setup time
          if (values.eventDate) {
            html += `<p><strong>Event Date:</strong> ${values.eventDate}</p>`;
          }
          if (values.setupTime) {
            html += `<p><strong>Setup Time:</strong> ${values.setupTime}</p>`;
          }

          // Tent - show all selected tent configurations
          if (values.tentConfigs && values.tentConfigs.length > 0) {
            const configurations = values.tentConfigs.map(cfg => getTentConfigDisplay(cfg)).join(' + ');
            html += `<p><strong>Tent:</strong> ${configurations}</p>`;
            
            if (breakdown.tent) {
              html += `<p><strong>Tent cost:</strong> KES ${breakdown.tent.cost.toLocaleString()}</p>`;
            }
          } else if (!selectedPackage) {
            html += `<p style="color: #ccc;"><em>🔔 Please select and add a tent to see pricing</em></p>`;
          }

          // Lighting
          if (breakdown.lighting) {
            html += `<p><strong>Lighting:</strong> KES ${breakdown.lighting.toLocaleString()}</p>`;
          }

          // Transport with zone info
          if (breakdown.transport) {
            const transport = breakdown.transport;
            html += `<p><strong>Transport:</strong> KES ${transport.cost.toLocaleString()}</p>`;
            const zoneInfo = transport.zoneInfo || {};
            if (transport.serviceArea === 'nairobi') {
              html += `<p style="margin-left: 10px; font-size: 0.85em; color: rgba(255,255,255,0.85);"><em>Zone: ${transport.zone}</em></p>`;
            } else if (transport.serviceArea === 'outside-nairobi') {
              html += `<p style="margin-left: 10px; font-size: 0.85em; color: rgba(255,255,255,0.85);"><em>Region: ${zoneInfo.region}, Distance: ${zoneInfo.distance}</em></p>`;
            }
          }

          // Decor
          if (values.decor) {
            html += `<p><strong>Decor:</strong> Upon Inquiry</p>`;
          }

          // PA Sound System
          if (values.pasound) {
            html += `<p><strong>PA Sound System:</strong> KES 8,000</p>`;
          }

          // Dance Floor
          if (values.dancefloor) {
            html += `<p><strong>Dance Floor:</strong> KES 10,000</p>`;
          }

          // Stage & Podium
          if (values.stagepodium) {
            html += `<p><strong>Stage & Podium:</strong> KES 15,000</p>`;
          }

          // Welcome Signs
          if (values.welcomesigns) {
            html += `<p><strong>Welcome Signs:</strong> KES 3,000</p>`;
          }

          html += `<hr style="margin: 16px 0;">`;
          html += `<div style="background: linear-gradient(135deg, rgba(120, 81, 169, 0.1), rgba(212, 175, 55, 0.1)); padding: 16px; border-radius: 8px; border: 1px solid rgba(120, 81, 169, 0.2);">`;
          html += `<p style="margin: 0; font-size: 0.95rem; color: #5A4A5F;">Estimated Total</p>`;
          html += `<p style="margin: 8px 0 0 0; font-size: 1.3rem; font-weight: 700; color: #7851A9;">KES ${total.toLocaleString()}</p>`;
          html += `</div>`;
          html += `<p class="muted" style="font-size: 0.85rem; color: #999; margin-top: 10px;">Note: Decor and special arrangements are handled on inquiry.</p>`;

          if (summaryBox) summaryBox.innerHTML = html;

          // Save current booking partial into localStorage for checkout use
          const bookingSave = {
            bookingFlow: isPackageFlow ? 'package' : 'tent',
            tentConfigs: tentConfigs, // Always save tent configs if they exist
            tentType: values.tentType,
            stretchSize: values.stretchSize,
            cheeseColor: values.cheeseColor,
            aframeSections: values.aframeSections,
            tentConfigurations: tentConfigs && tentConfigs.length > 0 ? tentConfigs.map(cfg => getTentConfigDisplay(cfg)).join(' + ') : '',
            lighting: values.lighting,
            transport: values.transport,
            decor: values.decor,
            pasound: values.pasound,
            dancefloor: values.dancefloor,
            stagepodium: values.stagepodium,
            welcomesigns: values.welcomesigns,
            venue: values.venue,
            location: values.venue, // Duplicate for backend compatibility
            eventDate: values.eventDate,
            setupTime: values.setupTime,
            sections: values.sections, // Add sections field
            additionalInfo: values.additionalInfo,
            fullname: q('#fullname') ? q('#fullname').value : '',
            phone: q('#phone') ? q('#phone').value : '',
            email: q('#email') ? q('#email').value : '',
            total: total,
            breakdown: breakdown,
            selectedPackage: selectedPackage ? selectedPackage.name : null,
            selectedPackageData: selectedPackage || null
          };
          if (!safeSetItem('bintiBooking', bookingSave)) {
            log.warn('BOOKING', 'Could not save booking to localStorage - quota may be exceeded');
          } else {
            log.info('BOOKING', 'Booking saved to localStorage with date/time', {
              eventDate: bookingSave.eventDate,
              setupTime: bookingSave.setupTime,
              fullname: bookingSave.fullname,
              phone: bookingSave.phone,
              total: bookingSave.total
            });
          }
        })
        .catch(err => {
          log.error('BOOKING', 'Calculation API error', err);
          if (summaryBox) {
            const errorMsg = err.message || 'Could not calculate booking price';
            summaryBox.innerHTML = `<p style="color: #d9534f;"><strong>Error:</strong> ${errorMsg}</p>`;
          }
        });;
      } catch (err) {
        log.error('BOOKING', 'updateSummary error', err);
        if (summaryBox) summaryBox.innerHTML = '<p style="color: #d9534f;"><strong>Error:</strong> Form processing error. Please refresh and try again.</p>';
      }
    }

    // Real-time zone identification
    if (venueEl) {
      let zoneIdentifyTimeout;
      venueEl.addEventListener('input', () => {
        clearTimeout(zoneIdentifyTimeout);
        if (!venueEl.value) {
          zoneInfoBox.style.display = 'none';
          return;
        }

        zoneIdentifyTimeout = setTimeout(() => {
          const zoneUrl = `${API_BASE_URL}/bookings/identify-zone`;
          log.info('BOOKING', 'Calling zone identification API', { url: zoneUrl, location: venueEl.value });
          
          apiCall(zoneUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: venueEl.value }),
            timeout: API_TIMEOUT
          })
            .then(data => {
              log.info('BOOKING', 'Zone identification response', data);
              if (data.success) {
                const info = data;
                let infoHtml = `<strong>Zone: ${info.zoneName}</strong><br>`;
                if (info.serviceArea === 'nairobi') {
                  infoHtml += `Nairobi zone - Transport: KES ${info.transportCost.toLocaleString()}`;
                } else {
                  const zoneInfo = info.zoneInfo || {};
                  infoHtml += `${zoneInfo.region} (${zoneInfo.distance}) - Transport: KES ${info.transportCost.toLocaleString()}`;
                }
                zoneInfoBox.innerHTML = infoHtml;
                zoneInfoBox.style.display = 'block';
              } else {
                log.warn('BOOKING', 'Zone identification failed', data);
              }
            })
            .catch(err => {
              log.error('BOOKING', 'Zone identification API error', err);
              zoneInfoBox.style.display = 'none';
            });
        }, 300);
      });
    }

    // Insert zone info display after venue field
    if (venueEl && venueEl.parentNode) {
      venueEl.parentNode.insertBefore(zoneInfoBox, venueEl.nextSibling);
    }

    // Color picker synchronization for cheese tent
    qa('input[name="cheese_color_picker"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (cheeseColorEl) {
          cheeseColorEl.value = e.target.value;
          // Trigger updateSummary
          const event = new Event('change', { bubbles: true });
          cheeseColorEl.dispatchEvent(event);
        }
      });
    });

    // show/hide conditional inputs based on selection
    tentTypeEl.addEventListener('change', () => { showConditional(); updateSummary(); });
    [stretchSizeEl, cheeseColorEl, aframeSectionsEl, lightingEl, transportEl, decorEl, pasoundEl, dancefloorEl, stagepodiumEl, welcomesignsEl, venueEl, eventDateEl, setupTimeEl, q('#fullname'), q('#phone'), q('#email')].forEach(el => {
      if (!el) return;
      el.addEventListener('change', updateSummary);
      el.addEventListener('input', updateSummary);
    });

    // Add event listener for "Add Another Tent Size" button
    if (addTentConfigBtn) {
      addTentConfigBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addTentConfig();
      });
    }

    // Add separate listeners for form details to control tent section visibility
    const fullnameEl = q('#fullname');
    const phoneEl = q('#phone');
    const emailEl = q('#email');
    
      if (fullnameEl) {
        fullnameEl.addEventListener('change', updateTentSectionVisibility);
        fullnameEl.addEventListener('input', updateTentSectionVisibility);
      }
      if (phoneEl) {
        phoneEl.addEventListener('change', updateTentSectionVisibility);
        phoneEl.addEventListener('input', updateTentSectionVisibility);
      }
      if (emailEl) {
        emailEl.addEventListener('change', updateTentSectionVisibility);
        emailEl.addEventListener('input', updateTentSectionVisibility);
      }

    // Site visit button: redirect to contact form
    if (siteVisitBtn) {
      siteVisitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        log.info('BOOKING', 'Site visit request button clicked - redirecting to contact form');
        window.location.href = 'contact.html?subject=site-visit-request';
      });
    }

    // initial display states
    showConditional();

    // Customize package button: show tent section when clicked
    const customizeBtn = q('#customize-package-btn');
    if (customizeBtn) {
      customizeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Allow adding tents to package (don't switch flows)
        log.info('BOOKING', 'User clicked customize tent - allowing package + tent combination');
        const tentSection = q('#tent-section');
        if (tentSection) {
          tentSection.style.display = 'block';
          tentSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          log.info('BOOKING', 'Customize tent section revealed');
        }
      });
    }

    // Prefill from draft if present
    if (draft) {
      if (draft.tentConfigs && Array.isArray(draft.tentConfigs)) {
        tentConfigs = draft.tentConfigs.map(cfg => ({ ...cfg }));
        nextConfigId = (Math.max(...tentConfigs.map(c => c.id || 0)) || 0) + 1;
        renderTentConfigs();
      } else if (draft.tentType) {
        // Old format support
        tentTypeEl.value = draft.tentType;
      }
      if (draft.stretchSize && stretchSizeEl) stretchSizeEl.value = draft.stretchSize;
      if (draft.cheeseColor && cheeseColorEl) cheeseColorEl.value = draft.cheeseColor;
      if (draft.aframeSections && aframeSectionsEl) aframeSectionsEl.value = draft.aframeSections;
      // call showConditional and update summary
      showConditional();
      // IMPORTANT: Refresh summary after pre-fill so it displays correct data
      setTimeout(() => updateSummary(), 100);
    }

    // Also call updateTentSectionVisibility initially to show tent section if form fields are filled
    updateTentSectionVisibility();

    // Submit handler - validate based on flow type
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      try {
        // Validate minimal fields with proper null checks
        const fullNameInput = q('#fullname');
        const phoneInput = q('#phone');
        const emailInput = q('#email');
        
        if (!fullNameInput || !phoneInput || !emailInput) {
          log.error('BOOKING', 'Required form inputs not found');
          alert('Form validation error. Please refresh the page and try again.');
          return;
        }
        
        // Get validation state using helper function
        const validation = window._getFormValidationState();
        
        // Validate Kenya phone format
        if (validation.hasPhone && !validateKenyaPhone(validation.hasPhone)) {
          log.error('BOOKING', 'Invalid phone format', { phone: validation.hasPhone });
          alert('Please enter a valid Kenyan phone number (e.g., 0712345678, +254712345678)');
          if (phoneInput) phoneInput.focus();
          return;
        }
        
        // Check event date and time (required for both flows)
        const hasEventDate = eventDateEl && eventDateEl.value;
        const hasSetupTime = setupTimeEl && setupTimeEl.value;
        if (!hasEventDate || !hasSetupTime) {
          alert('Please select event date and setup time before proceeding.');
          log.error('BOOKING', 'Form validation failed - missing date/time', { hasEventDate, hasSetupTime });
          return;
        }

        // Validation differs based on flow type
        if (isPackageFlow) {
          // Package flow: only need name, phone, email
          if (!validation.hasFullname || !validation.hasPhone || !validation.hasEmail) {
            alert('Please complete your name, phone, and email before proceeding.');
            log.error('BOOKING', 'Form validation failed (package flow)', validation);
            return;
          }
          log.info('BOOKING', 'Package flow validation passed');
        } else {
          // Tent flow: need name, phone, email + at least one tent
          const hasTentConfigs = tentConfigs && tentConfigs.length > 0;
          if (!validation.hasFullname || !validation.hasPhone || !validation.hasEmail || !hasTentConfigs) {
            alert('Please complete your name, phone, email and add at least one tent before proceeding.');
            log.error('BOOKING', 'Form validation failed (tent flow)', { ...validation, hasTentConfigs });
            return;
          }
          log.info('BOOKING', 'Tent flow validation passed');
        }

        // booking saved already in updateSummary() to localStorage key 'bintiBooking'
        log.info('BOOKING', 'Form submitted successfully, redirecting to checkout');
        window.location.href = 'checkout.html?t=' + Date.now(); // Cache bust
      } catch (err) {
        log.error('BOOKING', 'Form submission error', err);
        alert('An error occurred. Please try again.');
      }
    });

    // initial summary populate
    updateSummary();
  });

  // --- Checkout page: render booking and payment helpers
  onReady(() => {
    const orderSummary = q('#order-summary') || q('#booking-summary');
    if (!orderSummary) {
      log.info('CHECKOUT', 'Not on checkout page');
      return;
    }
    
    log.info('CHECKOUT', 'Loading order summary from localStorage');
    
    const raw = localStorage.getItem('bintiBooking');
    if (!raw) {
      log.warn('CHECKOUT', 'No booking found in localStorage');
      orderSummary.innerHTML = '<p>No booking found. Please create a booking.</p>';
      return;
    }
    
    let booking = {};
    try { 
      booking = JSON.parse(raw);
      log.info('CHECKOUT', 'Booking loaded from localStorage', booking);
      log.info('CHECKOUT', 'Date/Time data in booking', {
        eventDate: booking.eventDate,
        setupTime: booking.setupTime,
        hasEventDate: !!booking.eventDate,
        hasSetupTime: !!booking.setupTime
      });
    } catch (e) { 
      log.error('CHECKOUT', 'Failed to parse booking JSON', e);
    }
    
    let html = '';
    
    // Show selected package if applicable
    if (booking.selectedPackage) {
      html += `<p style="background: rgba(212, 175, 55, 0.15); padding: 8px 12px; border-radius: 4px; margin-bottom: 12px;"><strong> Package:</strong> ${booking.selectedPackage}</p>`;
    }
    
    html += `<p><strong>Name:</strong> ${booking.fullname || '—'}</p>`;
    html += `<p><strong>Phone:</strong> ${booking.phone || '—'}</p>`;
    html += `<p><strong>Email:</strong> ${booking.email || '—'}</p>`;
    html += `<p><strong>Venue:</strong> ${booking.venue || '—'}</p>`;
    
    // Event Date - with better formatting
    const eventDateDisplay = booking.eventDate ? new Date(booking.eventDate).toLocaleDateString('en-KE') : '—';
    log.info('CHECKOUT', 'Event Date Processing', { 
      rawValue: booking.eventDate, 
      displayValue: eventDateDisplay,
      isEmpty: !booking.eventDate 
    });
    html += `<p style="background: rgba(212, 175, 55, 0.1); padding: 8px 12px; border-radius: 4px; margin: 8px 0;"><i class="fas fa-calendar-alt" style="color: #D4AF37; margin-right: 8px;"></i><strong>Event Date:</strong> ${eventDateDisplay}</p>`;
    
    // Setup Time - with better formatting
    const setupTimeDisplay = booking.setupTime || '—';
    log.info('CHECKOUT', 'Setup Time Processing', { 
      rawValue: booking.setupTime,
      displayValue: setupTimeDisplay,
      isEmpty: !booking.setupTime 
    });
    html += `<p style="background: rgba(120, 81, 169, 0.1); padding: 8px 12px; border-radius: 4px; margin: 8px 0;"><i class="fas fa-clock" style="color: #7851A9; margin-right: 8px;"></i><strong>Setup Time:</strong> ${setupTimeDisplay}</p>`;
    
    // Display tent configurations
    if (booking.tentConfigurations) {
      html += `<p><strong>Tent:</strong> ${booking.tentConfigurations}</p>`;
    } else if (booking.tentType) {
      // Old format fallback
      html += `<p><strong>Tent:</strong> ${booking.tentType}`;
      if (booking.tentType === 'stretch' && booking.stretchSize) html += ` (${booking.stretchSize})`;
      if (booking.tentType === 'cheese' && booking.cheeseColor) html += ` (Color: ${booking.cheeseColor})`;
      if (booking.tentType === 'aframe') html += ` (${booking.aframeSections || 1} section(s))`;
      html += `</p>`;
    }
    
    
    // Use breakdown data if available (new system with TransportService)
    if (booking.breakdown) {
      log.info('CHECKOUT', 'Using breakdown data from backend');
      const b = booking.breakdown;
      if (b.tent && b.tent.cost) html += `<p><strong>Tent cost:</strong> KES ${b.tent.cost.toLocaleString()}</p>`;
      if (b.lighting && b.lighting > 0) html += `<p><strong>Ambient Lighting:</strong> KES ${b.lighting.toLocaleString()}</p>`;
      if (b.pasound && b.pasound > 0) html += `<p><strong>PA Sound System:</strong> KES ${b.pasound.toLocaleString()}</p>`;
      if (b.dancefloor && b.dancefloor > 0) html += `<p><strong>Dance Floor:</strong> KES ${b.dancefloor.toLocaleString()}</p>`;
      if (b.stagepodium && b.stagepodium > 0) html += `<p><strong>Stage & Podium:</strong> KES ${b.stagepodium.toLocaleString()}</p>`;
      if (b.welcomesigns && b.welcomesigns > 0) html += `<p><strong>Welcome Signs:</strong> KES ${b.welcomesigns.toLocaleString()}</p>`;
      if (b.transport && b.transport.cost) {
        html += `<p><strong>Transport:</strong> KES ${b.transport.cost.toLocaleString()}`;
        if (b.transport.serviceArea === 'nairobi') {
          html += ` <em>(${b.transport.zone})</em>`;
        } else if (b.transport.serviceArea === 'outside-nairobi') {
          const zoneInfo = b.transport.zoneInfo || {};
          html += ` <em>(${zoneInfo.region}, ${zoneInfo.distance})</em>`;
        }
        html += `</p>`;
      }
      if (b.decor === 'Upon Inquiry') html += `<p><strong>Decor:</strong> Upon Inquiry</p>`;
      // Site Visit is no longer part of add-ons - users request via contact form
    } else {
      log.warn('CHECKOUT', 'No breakdown data - using fallback calculation');
      // Fallback to old calculation method
      const tentPrice = booking.total ? booking.total - (booking.lighting ? 12000 : 0) - (booking.transport ? 7000 : 0) : 0;
      if (booking.tentType) html += `<p><strong>Tent cost (approx):</strong> KES ${Math.max(0, tentPrice).toLocaleString()}</p>`;
      if (booking.lighting) html += `<p><strong>Ambient Lighting:</strong> KES 12,000</p>`;
      if (booking.transport) html += `<p><strong>Transport:</strong> KES 7,000</p>`;
    }
    
    if (booking.decor) html += `<p><strong>Decor:</strong> Upon Inquiry</p>`;
    if (booking.pasound) html += `<p><strong>PA Sound System:</strong> KES 8,000</p>`;
    if (booking.dancefloor) html += `<p><strong>Dance Floor:</strong> KES 10,000</p>`;
    if (booking.stagepodium) html += `<p><strong>Stage & Podium:</strong> KES 15,000</p>`;
    if (booking.welcomesigns) html += `<p><strong>Welcome Signs:</strong> KES 3,000</p>`;

    html += `<hr style="margin: 16px 0;">`;
    html += `<div style="background: linear-gradient(135deg, rgba(120, 81, 169, 0.1), rgba(212, 175, 55, 0.1)); padding: 16px; border-radius: 8px; border: 1px solid rgba(120, 81, 169, 0.2);">`;
    html += `<p style="margin: 0; font-size: 0.95rem; color: #5A4A5F;">Final Total</p>`;
    html += `<p style="margin: 8px 0 0 0; font-size: 1.3rem; font-weight: 700; color: #7851A9;">KES ${(booking.total || 0).toLocaleString()}</p>`;
    html += `</div>`;
    orderSummary.innerHTML = html;

    // Update checkout summary details
    const subtotalEl = q('#subtotal');
    const taxEl = q('#tax');
    const totalAmountEl = q('#total-amount');
    
    if (subtotalEl) subtotalEl.textContent = `KES ${(booking.total || 0).toLocaleString()}`;
    if (taxEl) taxEl.textContent = 'KES 0';
    if (totalAmountEl) totalAmountEl.textContent = `KES ${(booking.total || 0).toLocaleString()}`;
    
    log.info('CHECKOUT', 'Order summary rendered', { total: booking.total });
  });

  // --- M-Pesa payment trigger with actual backend integration
  window.triggerMpesaPayment = function(bookingId, phone, amount, mpesaPhone, bookingData) {
    const paymentPhone = mpesaPhone || phone;
    const booking = bookingData || safeGetItem('bintiBooking') || {};
    
    // Create payment status modal
    const modal = document.createElement('div');
    modal.id = 'payment-status-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    modal.innerHTML = `
      <div style="background: white; padding: 40px; border-radius: 16px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
        <div style="background: linear-gradient(135deg, #25D366, #00b842); padding: 35px 30px; border-radius: 12px; margin-bottom: 28px; position: relative; overflow: hidden;">
          <div style="position: absolute; top: 10px; right: 10px; width: 80px; height: 80px; background: rgba(255,255,255,0.1); border-radius: 50%; animation: pulse 2s infinite;"></div>
          <div style="position: relative; z-index: 1;">
            <div class="loader" style="width: 60px; height: 60px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; margin: 0 auto 16px; animation: spin 1s linear infinite;"></div>
            <p style="color: white; margin: 0; font-size: 1.1em; font-weight: 600;">Initiating Payment</p>
          </div>
        </div>
        <p style="margin: 20px 0; font-size: 1.05em; color: #333; line-height: 1.6;">
          <strong>Amount:</strong> KES ${amount.toLocaleString()}<br>
          <strong>Phone:</strong> ${paymentPhone}
        </p>
        <p style="color: #666; margin: 20px 0; background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #25D366; line-height: 1.5;">
          <i class="fas fa-info-circle" style="color: #25D366; margin-right: 8px;"></i> 
          A payment prompt will be sent to your M-Pesa registered phone. Enter your PIN to complete.
        </p>
        <p style="color: #999; margin: 20px 0; font-size: 0.9em;"><i class="fas fa-lock" style="color: #25D366;"></i> Your payment is secure and encrypted</p>
        <small style="color: #999;">Do not close this window until payment is complete.</small>
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.5; } 50% { opacity: 0.3; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      </style>
    `;
    document.body.appendChild(modal);
    
    log.info('PAYMENT', 'Initiating M-Pesa STK push via backend', { phone: paymentPhone, amount });
    
    // Send STK push request to backend
    const mpesaPaymentData = {
      phone: paymentPhone,
      amount: amount,
      accountRef: booking.id || bookingId || 'BOOKING_' + Date.now(),
      description: `Binti Events Booking - ${booking.fullname || 'Guest'}`,
      // Include booking details for confirmation email
      fullName: booking.fullname || booking.fullName || 'Guest',
      email: booking.email || '',
      contactPhone: booking.phone || '',
      venue: booking.venue || '',
      eventDate: booking.eventDate || '',
      setupTime: booking.setupTime || '',
      tentType: booking.tentType || 'Package + Tent',
      bookingType: booking.bookingType || booking.tentType || 'Package + Tent'
    };
    
    apiCall(`${API_BASE_URL}/payments/mpesa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mpesaPaymentData),
      timeout: API_TIMEOUT
    })
      .then(data => {
        log.info('PAYMENT', 'STK push initiated successfully', data);
        
        // Update modal to show waiting for M-Pesa response
        modal.innerHTML = `
          <div style="background: white; padding: 40px; border-radius: 16px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
            <div style="background: linear-gradient(135deg, #25D366, #00b842); padding: 35px 30px; border-radius: 12px; margin-bottom: 28px; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 10px; right: 10px; width: 80px; height: 80px; background: rgba(255,255,255,0.1); border-radius: 50%; animation: pulse 2s infinite;"></div>
              <div style="position: relative; z-index: 1;">
                <div class="loader" style="width: 60px; height: 60px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; margin: 0 auto 16px; animation: spin 1s linear infinite;"></div>
                <p style="color: white; margin: 0; font-size: 1.1em; font-weight: 600;">Waiting for M-Pesa</p>
              </div>
            </div>
            <p style="margin: 20px 0; font-size: 1em; color: #333; line-height: 1.6;">
              STK push sent to <strong>${paymentPhone}</strong>
            </p>
            <p style="color: #666; margin: 20px 0; background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #25D366; line-height: 1.5;">
              <i class="fas fa-mobile-alt" style="color: #25D366; margin-right: 8px;"></i> 
              Check your M-Pesa prompt on your phone. Enter your PIN to complete payment.
            </p>
            <p style="color: #999; font-size: 0.9em;">Waiting for payment confirmation...</p>
          </div>
          <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes pulse { 0% { transform: scale(1); opacity: 0.5; } 50% { opacity: 0.3; } 100% { transform: scale(1.5); opacity: 0; } }
            @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          </style>
        `;
        
        // TODO: In production, implement polling or webhook to check payment status
        // For now, show a timeout after 2 minutes
        const timeoutMs = 120000; // 2 minutes
        const startTime = Date.now();
        
        const checkStatusInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          if (elapsed > timeoutMs) {
            clearInterval(checkStatusInterval);
            // Show timeout message
            modal.innerHTML = `
              <div style="background: white; padding: 40px; border-radius: 16px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
                <div style="background: linear-gradient(135deg, #ffc107, #ff9800); padding: 35px 30px; border-radius: 12px; margin-bottom: 28px;">
                  <i class="fas fa-clock" style="font-size: 3.5em; color: white; display: block; margin-bottom: 16px;"></i>
                  <p style="color: white; margin: 0; font-size: 1.3em; font-weight: 700;">Payment Timeout</p>
                </div>
                <p style="margin: 20px 0; font-size: 1em; color: #333; line-height: 1.6;">
                  We didn't receive a response from M-Pesa within 2 minutes.
                </p>
                <p style="color: #666; font-size: 0.95em; margin: 20px 0; background: #fff3cd; padding: 12px; border-radius: 6px; border-left: 4px solid #ffc107;">
                  <i class="fas fa-info-circle" style="margin-right: 6px;"></i> If you completed the payment, it may still be processing. Check your M-Pesa account or try again.
                </p>
                <div style="display: flex; gap: 12px; margin-top: 20px;">
                  <button onclick="document.getElementById('payment-status-modal').remove();" style="flex: 1; background: #28a745; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-check" style="margin-right: 6px;"></i> Continue
                  </button>
                  <button onclick="document.getElementById('payment-status-modal').remove(); window.proceedToPayment();" style="flex: 1; background: #25D366; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-redo" style="margin-right: 6px;"></i> Try Again
                  </button>
                </div>
              </div>
              <style>
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
              </style>
            `;
          }
        }, 1000);
      })
      .catch(error => {
        log.error('PAYMENT', 'STK push failed', error);
        clearInterval(checkStatusInterval);
        
        modal.innerHTML = `
          <div style="background: white; padding: 40px; border-radius: 16px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
            <div style="background: linear-gradient(135deg, #dc3545, #c82333); padding: 35px 30px; border-radius: 12px; margin-bottom: 28px;">
              <i class="fas fa-times-circle" style="font-size: 3.5em; color: white; display: block; margin-bottom: 16px; animation: shake 0.6s ease-out;"></i>
              <p style="color: white; margin: 0; font-size: 1.3em; font-weight: 700;">Payment Failed</p>
            </div>
            <p style="margin: 20px 0; font-size: 1em; color: #333; line-height: 1.6;">
              We couldn't send the M-Pesa prompt to your phone.
            </p>
            <p style="color: #666; font-size: 0.95em; margin: 20px 0; background: #fdf2f1; padding: 12px; border-radius: 6px; border-left: 4px solid #dc3545;">
              <i class="fas fa-info-circle" style="margin-right: 6px;"></i> ${error.message || 'Please check your phone number and try again.'}
            </p>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
              <button onclick="document.getElementById('payment-status-modal').remove(); window.proceedToPayment();" style="flex: 1; background: #25D366; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95em;">
                <i class="fas fa-redo" style="margin-right: 6px;"></i> Try Again
              </button>
              <button onclick="window.location.href='checkout.html'" style="flex: 1; background: #6c757d; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95em;">
                <i class="fas fa-arrow-left" style="margin-right: 6px;"></i> Back
              </button>
            </div>
          </div>
          <style>
            @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
            @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          </style>
        `;
      });
  };

  // --- Pesapal iframe helper with proper error handling
  window.loadPesapalIframe = function(bookingId) {
    const container = q('#pesapal-container') || q('#pesapalFrameContainer') || document.body;
    if (!container) return;
    
    container.innerHTML = '<div class="message-container"><p><i class="fas fa-spinner fa-spin"></i> Loading secure payment window…</p></div>';
    
    // Fetch the secure iframe URL from backend
    apiCall(`${API_BASE_URL}/bookings/pesapal-iframe?bookingId=${encodeURIComponent(bookingId)}`, {
      timeout: API_TIMEOUT
    })
      .then(data => {
        if (!data.iframeUrl) {
          throw new Error('Invalid response from server');
        }
        const iframe = document.createElement('iframe');
        iframe.width = '100%';
        iframe.height = '650';
        iframe.frameBorder = '0';
        iframe.src = data.iframeUrl;
        container.innerHTML = '';
        container.appendChild(iframe);
        log.info('PAYMENT', 'Pesapal iframe loaded successfully');
      })
      .catch(err => {
        log.error('PAYMENT', 'Failed to load Pesapal iframe', err);
        container.innerHTML = `<p style="color: red;"><strong>Error:</strong> ${err.message || 'Failed to load payment window. Please try again.'}</p>`;
      });
  };

  // --- Payment validation: Ensure terms are accepted before proceeding
  window.proceedToPayment = function() {
    log.info('PAYMENT', 'proceedToPayment called');
    
    const termsCheckbox = q('#accept-terms');
    
    // If terms checkbox doesn't exist (not on checkout page), proceed normally
    if (!termsCheckbox) {
      log.info('PAYMENT', 'Terms checkbox not found - not on checkout page');
      return true;
    }
    
    // If button is disabled, don't allow proceed
    if (q('#pay-now-btn')?.disabled) {
      log.warn('PAYMENT', 'Payment button is disabled - validation failed');
      return false;
    }
    
    // Get payment method FIRST
    const paymentMethod = q('input[name="payment-method"]:checked')?.value || 'mpesa';
    
    // If M-Pesa is selected, show the M-Pesa phone modal and wait for user input
    if (paymentMethod === 'mpesa') {
      const mpesaModal = document.getElementById('mpesa-phone-modal');
      const mpesaPhoneInput = document.getElementById('mpesa-phone');
      
      if (mpesaModal) {
        // Show the modal for user to enter/confirm phone number
        mpesaModal.style.display = 'flex';
        if (mpesaPhoneInput) {
          mpesaPhoneInput.focus();
        }
        log.info('PAYMENT', 'M-Pesa phone modal shown - waiting for user input');
        return false; // Don't proceed until modal is confirmed
      }
    }
    
    // For non-M-Pesa payment methods, or M-Pesa if modal not available, proceed directly
    window.proceedToPaymentAfterModal();
    return false;
  };

  /**
   * Proceed with payment after M-Pesa phone modal has been confirmed
   * This function does the actual payment processing
   */
  window.proceedToPaymentAfterModal = function() {
    log.info('PAYMENT', 'proceedToPaymentAfterModal called');
    
    const paymentMethod = q('input[name="payment-method"]:checked')?.value || 'mpesa';
    const paymentAmount = q('input[name="payment-amount"]:checked')?.value || 'deposit';
    const booking = safeGetItem('bintiBooking') || {};
    
    // Calculate payment amount
    const totalAmount = booking.total || 0;
    const depositAmount = Math.round(totalAmount * 0.8);
    const amountToPay = paymentAmount === 'deposit' ? depositAmount : totalAmount;
    
    log.info('PAYMENT', 'Proceeding with payment after modal', { paymentMethod, amountToPay });
    
    // Get M-Pesa phone from input (already validated)
    let mpesaPhone = '';
    if (paymentMethod === 'mpesa') {
      mpesaPhone = q('#mpesa-phone')?.value?.trim() || '';
    }
    
    // Create payment request
    const paymentData = {
      fullname: booking.fullname,
      phone: booking.phone,
      email: booking.email,
      venue: booking.venue,
      location: booking.location || booking.venue, // Backend compatibility
      tentType: booking.tentType || 'none',
      tentConfigs: booking.tentConfigs || [],
      packageName: booking.selectedPackage || booking.packageName,
      packageBasePrice: booking.packageBasePrice || 0,
      mpesaPhone: mpesaPhone ? formatPhoneDisplay(mpesaPhone) : '',
      eventDate: booking.eventDate,
      setupTime: booking.setupTime,
      sections: booking.sections || booking.aframeSections, // Include sections
      lighting: booking.lighting,
      transport: booking.transport,
      decor: booking.decor,
      pasound: booking.pasound,
      dancefloor: booking.dancefloor,
      stagepodium: booking.stagepodium,
      welcomesigns: booking.welcomesigns,
      additionalInfo: booking.additionalInfo || '',
      bookingDetails: {
        tentType: booking.tentType,
        stretchSize: booking.stretchSize,
        cheeseColor: booking.cheeseColor,
        aframeSections: booking.aframeSections,
        venue: booking.venue,
        location: booking.location || booking.venue,
        sections: booking.sections || booking.aframeSections,
        lighting: booking.lighting,
        transport: booking.transport,
        decor: booking.decor,
        pasound: booking.pasound,
        dancefloor: booking.dancefloor,
        stagepodium: booking.stagepodium,
        welcomesigns: booking.welcomesigns,
        total: booking.total,
        additionalInfo: booking.additionalInfo || ''
      },
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      paymentMethod: paymentMethod,
      paymentAmount: paymentAmount,
      amountToPay: amountToPay,
      depositAmount: depositAmount,
      remainingAmount: totalAmount - depositAmount
    };
    
    log.info('PAYMENT', 'Sending payment confirmation to backend', paymentData);
    
    // Show loading state
    const payButton = q('#pay-now-btn');
    if (payButton) {
      payButton.disabled = true;
      payButton.textContent = 'Processing...';
    }
    
    // Send to backend to create booking and initiate payment
    const confirmUrl = `${API_BASE_URL}/bookings/confirm`;
    log.info('PAYMENT', 'Calling booking confirm API', { url: confirmUrl });
    
    apiCall(confirmUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData),
      timeout: API_TIMEOUT
    })
      .then(data => {
        log.info('PAYMENT', 'Backend confirm response', data);
        
        if (data.success) {
          log.info('PAYMENT', 'Booking created successfully', { bookingId: data.bookingId });
          // Successfully created booking
          if (paymentMethod === 'mpesa') {
            log.info('PAYMENT', 'Initiating M-Pesa payment');
            // Trigger M-Pesa STK push with calculated amount and booking details
            window.triggerMpesaPayment(data.bookingId, booking.phone, amountToPay, mpesaPhone, booking);
          } else if (paymentMethod === 'pesapal') {
            log.info('PAYMENT', 'Loading Pesapal iframe');
            // Load Pesapal iframe
            window.loadPesapalIframe(data.bookingId);
          } else {
            log.error('PAYMENT', 'Unknown payment method', paymentMethod);
            alert('Payment method not recognized. Please contact support.');
          }
        } else {
          log.error('PAYMENT', 'Booking creation failed', data);
          alert(`Booking creation failed: ${data.message || 'Unknown error'}`);
        }
      })
      .catch(err => {
        log.error('PAYMENT', 'Payment processing error', err);
        alert(`Payment processing failed: ${err.message}`);
      })
      .finally(() => {
        // Reset button state
        if (payButton) {
          payButton.disabled = false;
          payButton.textContent = 'Proceed to Payment';
        }
      });
    
    return true;
  };

  // --- Update payment amounts based on total (80% deposit, 100% full)
  window.updatePaymentAmounts = function() {
    log.info('PAYMENT', 'updatePaymentAmounts called');
    try {
      const bookingRaw = localStorage.getItem('bintiBooking');
      log.info('PAYMENT', 'Raw booking data from localStorage:', bookingRaw);
      
      const booking = JSON.parse(bookingRaw || '{}');
      const total = booking.total || 0;
      log.info('PAYMENT', 'Total amount from booking:', total);
      
      const deposit = Math.round(total * 0.8);
      const full = total;
      
      log.info('PAYMENT', 'Calculated values - Deposit (80%):', deposit, 'Full (100%):', full);
      
      const depositEl = q('#deposit-amount');
      const fullEl = q('#full-amount');
      
      log.info('PAYMENT', 'Found elements - depositEl:', !!depositEl, 'fullEl:', !!fullEl);
      
      if (depositEl) {
        const newText = 'KES ' + deposit.toLocaleString();
        depositEl.textContent = newText;
        log.info('PAYMENT', 'Updated #deposit-amount to:', newText);
      } else {
        log.warn('PAYMENT', 'WARNING: #deposit-amount element not found!');
      }
      
      if (fullEl) {
        const newText = 'KES ' + full.toLocaleString();
        fullEl.textContent = newText;
        log.info('PAYMENT', 'Updated #full-amount to:', newText);
      } else {
        log.warn('PAYMENT', 'WARNING: #full-amount element not found!');
      }
      
    } catch (err) {
      log.error('PAYMENT', 'ERROR in updatePaymentAmounts:', err);
    }
  };

  // --- Update payment button state based on terms checkbox only
  // M-Pesa phone validation happens in the modal after button is clicked
  window.updatePaymentButtonState = function() {
    const termsCheckbox = q('#accept-terms');
    const payButton = q('#pay-now-btn');
    
    if (!termsCheckbox || !payButton) {
      log.warn('CHECKOUT', 'Button state elements not found', {
        hasCheckbox: !!termsCheckbox,
        hasButton: !!payButton
      });
      return;
    }
    
    // Button is enabled only if terms are accepted
    const termsAccepted = termsCheckbox.checked;
    
    log.info('CHECKOUT', 'Button state check', {
      checkboxElement: termsCheckbox.id,
      checkboxChecked: termsAccepted,
      shouldEnable: termsAccepted
    });
    
    const icon = payButton.querySelector('i');
    
    if (termsAccepted) {
      // Enable button
      payButton.disabled = false;
      payButton.style.opacity = '1';
      payButton.style.cursor = 'pointer';
      // Change icon to unlocked
      if (icon) {
        icon.className = 'fas fa-unlock';
      }
      log.info('CHECKOUT', '✓ Button ENABLED - terms accepted');
    } else {
      // Disable button
      payButton.disabled = true;
      payButton.style.opacity = '0.5';
      payButton.style.cursor = 'not-allowed';
      // Change icon to locked
      if (icon) {
        icon.className = 'fas fa-lock';
      }
      log.warn('CHECKOUT', '✗ Button DISABLED - terms not accepted');
    }
  };

  // Debug helper: Check terms checkbox state directly
  window.checkTermsState = function() {
    const checkbox = q('#accept-terms');
    if (!checkbox) {
      console.log('❌ Terms checkbox not found in DOM');
      return;
    }
    console.log('===== TERMS CHECKBOX STATE =====');
    console.log('Element ID:', checkbox.id);
    console.log('Checked:', checkbox.checked);
    console.log('Type:', checkbox.type);
    console.log('Value:', checkbox.value);
    console.log('Visible:', checkbox.offsetParent !== null);
    console.log('Disabled:', checkbox.disabled);
    console.log('================================');
  };
  
  // --- Clear booking from both pages
  window.clearBooking = function() {
    log.info('CHECKOUT', 'clearBooking function called');
    
    if (confirm('Are you sure you want to clear all booking details? This cannot be undone.')) {
      try {
        log.info('CHECKOUT', 'User confirmed clearing booking');
        
        // Remove booking data from localStorage
        localStorage.removeItem('bintiBooking');
        log.info('CHECKOUT', 'Booking data removed from localStorage');
        
        // Remove package data as well
        localStorage.removeItem('bintiSelectedPackage');
        log.info('CHECKOUT', 'Package data removed from localStorage');
        
        // Reset form fields if on bookings page
        const bookingForm = q('#booking-form');
        if (bookingForm) {
          log.info('CHECKOUT', 'Resetting booking form');
          bookingForm.reset();
          // Clear all form inputs
          qa('input, select, textarea').forEach(field => {
            field.value = '';
          });
          log.info('CHECKOUT', 'Booking form fields cleared');
        }
        
        // Reset checkout form if on checkout page
        const termsCheckbox = q('#accept-terms');
        if (termsCheckbox) {
          log.info('CHECKOUT', 'Resetting checkout form');
          termsCheckbox.checked = false;
          const mpesaPhoneInput = q('#mpesa-phone');
          if (mpesaPhoneInput) mpesaPhoneInput.value = '';
          // Reset deposit/full amounts display
          const depositEl = q('#deposit-amount');
          const fullEl = q('#full-amount');
          if (depositEl) depositEl.textContent = 'KES 0';
          if (fullEl) fullEl.textContent = 'KES 0';
          // Reset button state
          if (window.updatePaymentButtonState) {
            window.updatePaymentButtonState();
          }
          log.info('CHECKOUT', 'Checkout form cleared');
        }
        
        log.info('CHECKOUT', 'All data cleared - redirecting to bookings.html');
        alert('Booking cleared successfully. Redirecting to booking form...');
        // Small delay to ensure logs are written before redirect
        setTimeout(() => {
          window.location.href = 'bookings.html';
        }, 100);
      } catch (error) {
        log.error('CHECKOUT', 'Error clearing booking', error);
        alert('Error clearing booking: ' + error.message);
      }
    } else {
      log.info('CHECKOUT', 'User cancelled clear operation');
    }
  };

  // Initialize checkout page button state on load
  onReady(() => {
    const termsCheckbox = q('#accept-terms');
    const payButton = q('#pay-now-btn');
    
    if (!termsCheckbox || !payButton) {
      log.info('CHECKOUT', 'Not on checkout page');
      return;
    }
    
    log.info('CHECKOUT', 'Initializing checkout page');
    
    // Initialize button state and payment amounts
    log.info('CHECKOUT', 'Calling updatePaymentButtonState()');
    window.updatePaymentButtonState();
    
    log.info('CHECKOUT', 'Calling updatePaymentAmounts()');
    window.updatePaymentAmounts();
    
    log.info('CHECKOUT', 'Initial checkout state', {
      termsChecked: termsCheckbox.checked,
      buttonDisabled: payButton.disabled
    });
    
    // Don't show M-Pesa modal on page load - only show when user clicks "Proceed to Payment"
    
    // Add change listener to terms checkbox
    termsCheckbox.addEventListener('change', () => {
      log.info('CHECKOUT', 'Terms checkbox changed event fired', { 
        checked: termsCheckbox.checked,
        DOMElement: termsCheckbox,
        checkboxAttribute: termsCheckbox.getAttribute('checked')
      });
      window.updatePaymentButtonState();
    });
    
    // Also add click listener as fallback (some browsers may not fire change reliably)
    termsCheckbox.addEventListener('click', () => {
      log.info('CHECKOUT', 'Terms checkbox clicked event', { 
        checked: termsCheckbox.checked,
        offsetParent: termsCheckbox.offsetParent
      });
      // Immediate check of checkbox state
      setTimeout(() => {
        log.info('CHECKOUT', 'After 50ms timeout - checkbox state', { 
          checked: termsCheckbox.checked,
          value: termsCheckbox.value,
          disabled: termsCheckbox.disabled
        });
        window.updatePaymentButtonState();
      }, 50);
    });
    
    // Handle payment method changes - just update button state, don't show modal
    document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        log.info('CHECKOUT', 'Payment method changed', { method: e.target.value });
        
        // Update visual state - remove active class from all payment options
        document.querySelectorAll('.payment-option').forEach(option => {
          option.classList.remove('active');
        });
        
        // Add active class to the selected payment option
        const selectedPaymentOption = e.target.closest('.payment-option');
        if (selectedPaymentOption) {
          selectedPaymentOption.classList.add('active');
          log.info('CHECKOUT', 'Updated visual state for payment method', { element: e.target.value });
        }
        
        // When switching away from M-Pesa, clear the modal and phone input
        if (e.target.value !== 'mpesa') {
          const modal = document.getElementById('mpesa-phone-modal');
          if (modal) modal.style.display = 'none';
          const mpesaPhoneInput = document.getElementById('mpesa-phone');
          if (mpesaPhoneInput) mpesaPhoneInput.value = '';
          const mpesaError = document.getElementById('mpesa-phone-error');
          if (mpesaError) mpesaError.style.display = 'none';
        }
        
        // Update button state when payment method changes
        window.updatePaymentButtonState();
        // Also update payment amounts display when method changes
        window.updatePaymentAmounts();
      });
    });

    // M-Pesa modal handlers
    const mpesaPhoneInput = document.getElementById('mpesa-phone');
    const mpesaConfirmBtn = document.getElementById('mpesa-confirm-btn');
    const mpesaCancelBtn = document.getElementById('mpesa-cancel-btn');
    const mpesaModal = document.getElementById('mpesa-phone-modal');
    
    if (mpesaConfirmBtn) {
      mpesaConfirmBtn.addEventListener('click', () => {
        const phone = mpesaPhoneInput?.value?.trim() || '';
        const mpesaError = document.getElementById('mpesa-phone-error');
        const mpesaErrorText = document.getElementById('mpesa-phone-error-text');
        
        // Validate phone format
        if (!phone || !/^\+?[0-9]{10,15}$/.test(phone)) {
          if (mpesaErrorText) mpesaErrorText.textContent = 'Invalid format. Use: +254712345678';
          if (mpesaError) mpesaError.style.display = 'block';
          return;
        }
        
        // Valid phone - hide error, close modal, and proceed with payment
        if (mpesaError) mpesaError.style.display = 'none';
        if (mpesaModal) mpesaModal.style.display = 'none';
        log.info('CHECKOUT', 'M-Pesa phone confirmed', { phone: `***${phone.slice(-4)}` });
        window.updatePaymentButtonState();
        
        // Now proceed with the payment after modal is closed
        setTimeout(() => {
          window.proceedToPaymentAfterModal();
        }, 100);
      });
    }
    
    if (mpesaCancelBtn) {
      mpesaCancelBtn.addEventListener('click', () => {
        // Hide modal and let user change payment method or try again
        if (mpesaModal) mpesaModal.style.display = 'none';
        mpesaPhoneInput.value = '';
        const mpesaError = document.getElementById('mpesa-phone-error');
        if (mpesaError) mpesaError.style.display = 'none';
        log.info('CHECKOUT', 'M-Pesa phone modal cancelled');
      });
    }
    
    // Allow Enter key to confirm in modal
    if (mpesaPhoneInput) {
      mpesaPhoneInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          mpesaConfirmBtn?.click();
        }
      });
    }
    
    // Close modal when clicking outside (on backdrop)
    if (mpesaModal) {
      mpesaModal.addEventListener('click', (e) => {
        if (e.target === mpesaModal) {
          mpesaCancelBtn?.click();
        }
      });
    }



    // Attach click handler to "Proceed to Payment" button
    const paymentButton = q('#pay-now-btn');
    if (paymentButton) {
      paymentButton.addEventListener('click', (e) => {
        log.info('CHECKOUT', 'Pay button clicked');
        // Prevent default and check disabled state before proceeding
        if (paymentButton.disabled) {
          log.warn('CHECKOUT', 'Payment button is disabled - blocking click');
          e.preventDefault();
          e.stopPropagation();
          alert('Please accept the Terms and Conditions before proceeding with payment.');
          return false;
        }
        // Also validate terms checkbox directly
        if (!termsCheckbox.checked) {
          log.warn('CHECKOUT', 'Terms not accepted - blocking payment');
          e.preventDefault();
          e.stopPropagation();
          alert('Please accept the Terms and Conditions before proceeding with payment.');
          return false;
        }
        window.proceedToPayment();
      });
      log.info('CHECKOUT', 'Pay button listener attached');
    } else {
      log.warn('CHECKOUT', 'Pay button not found on page');
    }
    
    // Attach click handler to "Clear Booking" button
    const clearBookingBtn = q('#clear-booking-btn');
    if (clearBookingBtn) {
      log.info('CHECKOUT', 'Attaching listener to #clear-booking-btn');
      clearBookingBtn.addEventListener('click', (e) => {
        log.info('CHECKOUT', 'Clear button clicked');
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.clearBooking === 'function') {
          log.info('CHECKOUT', 'Calling window.clearBooking()');
          window.clearBooking();
        } else {
          log.error('CHECKOUT', 'window.clearBooking is not a function!');
        }
      });
      log.info('CHECKOUT', 'Listener attached to clear button. Button state - disabled:', clearBookingBtn.disabled);
    } else {
      log.error('CHECKOUT', 'ERROR: #clear-booking-btn not found on page!');
    }
    
    log.info('CHECKOUT', 'Checkout page initialized - all listeners attached');
  });

  // --- Contact Form Handler
  onReady(() => {
    const contactForm = q('#contact-form');
    if (!contactForm) {
      log.info('CONTACT', 'Not on contact page');
      return;
    }
    
    log.info('CONTACT', 'Initializing contact form');
    
    // Pre-fill subject from URL parameter if present
    const urlParams = new URLSearchParams(window.location.search);
    const subjectParam = urlParams.get('subject');
    if (subjectParam) {
      log.info('CONTACT', 'URL subject parameter found', { subject: subjectParam });
      const subjectSelect = q('#subject', contactForm);
      if (subjectSelect) {
        // Check if the option exists in the dropdown
        const optionExists = Array.from(subjectSelect.options).some(opt => opt.value === subjectParam);
        if (optionExists) {
          subjectSelect.value = subjectParam;
          log.info('CONTACT', 'Subject pre-filled from URL', { subject: subjectParam });
        } else {
          log.warn('CONTACT', 'Subject option not found in dropdown', { subject: subjectParam });
        }
      }
      
      // Auto-scroll to form for better UX
      setTimeout(() => {
        contactForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        log.info('CONTACT', 'Auto-scrolled to form');
      }, 100);
    }
    
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      log.info('CONTACT', 'Contact form submitted');
      
      const formMessage = q('#form-message');
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      
      try {
        // Get form data
        const name = q('#name', contactForm).value.trim();
        const email = q('#email', contactForm).value.trim();
        const phone = q('#phone', contactForm).value.trim();
        const subject = q('#subject', contactForm).value;
        const message = q('#message', contactForm).value.trim();
        
        log.info('CONTACT', 'Form data collected', { name, email, phone, subject });
        
        // Validate required fields
        if (!name || !email || !subject || !message) {
          const missingFields = [];
          if (!name) missingFields.push('name');
          if (!email) missingFields.push('email');
          if (!subject) missingFields.push('subject');
          if (!message) missingFields.push('message');
          log.error('CONTACT', 'Validation failed - missing fields', missingFields);
          throw new Error('Please fill in all required fields.');
        }
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        const contactUrl = `${API_BASE_URL}/contact`;
        log.info('CONTACT', 'Sending contact form to backend', { url: contactUrl });
        
        // Send to backend
        const response = await apiCall(contactUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, subject, message }),
          timeout: API_TIMEOUT
        });
        
        log.info('CONTACT', 'Backend response', response);
        const result = response;
        
        if (result.success) {
          log.info('CONTACT', 'Message sent successfully');
          // Show success message
          formMessage.style.display = 'block';
          formMessage.style.backgroundColor = '#d4edda';
          formMessage.style.color = '#155724';
          formMessage.style.borderLeft = '4px solid #28a745';
          formMessage.innerHTML = '<strong>✓ Success!</strong> Your message has been sent. We will respond within 24 hours.';
          
          // Reset form
          contactForm.reset();
          
          // Scroll to message
          formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          log.error('CONTACT', 'Backend returned error', result);
          throw new Error(result.message || 'Failed to send message.');
        }
      } catch (err) {
        log.error('CONTACT', 'Contact form error', err);
        
        // Show error message
        formMessage.style.display = 'block';
        formMessage.style.backgroundColor = '#f8d7da';
        formMessage.style.color = '#721c24';
        formMessage.style.borderLeft = '4px solid #f5c6cb';
        formMessage.innerHTML = `<strong>✗ Error:</strong> ${err.message}`;
        
        // Scroll to message
        formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
    
    log.info('CONTACT', 'Contact form event listeners attached');
  });

  // --- Pesapal iframe loader
  window.loadPesapalIframe = function(bookingId) {
    const container = document.getElementById('pesapal-container');
    if (!container) {
      log.error('PAYMENT', 'Pesapal container not found (#pesapal-container)');
      alert('Error: Payment container not found on page');
      return;
    }
    
    // Show loading state
    container.style.display = 'block';
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 2em; color: #0066CC;"></i><p>Loading secure payment window…</p></div>';
    
    // Get booking data from localStorage
    const booking = safeGetItem('bintiBooking') || {};
    const paymentAmount = document.querySelector('input[name="payment-amount"]:checked')?.value || 'deposit';
    const totalAmount = booking.total || 0;
    const depositAmount = Math.round(totalAmount * 0.8);
    const amountToPay = paymentAmount === 'deposit' ? depositAmount : totalAmount;
    
    // Prepare payment data for Pesapal
    const pesapalPaymentData = {
      amount: amountToPay,
      email: booking.email,
      phone: booking.phone,
      firstName: booking.fullname ? booking.fullname.split(' ')[0] : 'Customer',
      lastName: booking.fullname ? booking.fullname.split(' ').slice(1).join(' ') : 'Name',
      orderRef: bookingId || booking.id || 'BOOKING_' + Date.now(),
      description: `Binti Events Booking - ${booking.fullname || 'Guest'}`
    };
    
    log.info('PAYMENT', 'Creating Pesapal payment order', { 
      amount: pesapalPaymentData.amount,
      orderRef: pesapalPaymentData.orderRef
    });
    
    // Call Pesapal payment creation endpoint
    apiCall(`${API_BASE_URL}/payments/pesapal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pesapalPaymentData),
      timeout: API_TIMEOUT
    })
      .then(data => {
        log.info('PAYMENT', 'Pesapal order created', data);
        
        if (!data.success || !data.iframe_url) {
          throw new Error(data.message || 'Failed to create payment order');
        }
        
        // Create and load the iframe
        const iframe = document.createElement('iframe');
        iframe.id = 'pesapal-payment-iframe';
        iframe.width = '100%';
        iframe.height = '700';
        iframe.frameBorder = '0';
        iframe.src = data.iframe_url;
        iframe.style.marginTop = '20px';
        
        container.innerHTML = '';
        container.appendChild(iframe);
        
        // Scroll to payment
        setTimeout(() => {
          container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
        
        log.info('PAYMENT', 'Pesapal iframe loaded successfully');
      })
      .catch(err => {
        log.error('PAYMENT', 'Pesapal iframe loading failed', err);
        container.innerHTML = `
          <div style="padding: 40px; background: #f8d7da; border-radius: 8px; border-left: 4px solid #f5c6cb;">
            <p style="color: #721c24; font-weight: 600; margin: 0 0 12px 0;">
              <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> Payment Error
            </p>
            <p style="color: #721c24; margin: 0;">${err.message || 'Failed to load payment window. Please try again.'}</p>
            <button type="button" onclick="window.location.reload()" style="margin-top: 16px; padding: 10px 20px; background: #721c24; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Try Again
            </button>
          </div>
        `;
      });
  };
})();
