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
*/

(function () {
  // --- Configuration: API Base URL
  // This allows frontend to be hosted on a different server than the backend
  const API_BASE_URL = window.API_BASE_URL || "/api";
  
  // --- Logging utility for debugging
  const log = {
    info: (category, message, data) => {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = `[${timestamp}] [${category}]`;
      console.log(prefix, message, data || '');
    },
    error: (category, message, error) => {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = `[${timestamp}] [${category}] ❌`;
      console.error(prefix, message, error || '');
    },
    warn: (category, message, data) => {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = `[${timestamp}] [${category}] ⚠️`;
      console.warn(prefix, message, data || '');
    }
  };
  
  // Make logger global for debugging in console
  window.BintiLog = log;
  
  // Log initial setup
  log.info('INIT', 'Binti Events script loaded', { API_BASE_URL });
  log.info('INIT', 'Environment info', {
    currentOrigin: window.location.origin,
    currentPath: window.location.pathname,
    currentProtocol: window.location.protocol
  });
  
  // --- helpers
  function onReady(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function q(sel, ctx=document){ return ctx.querySelector(sel); }
  function qa(sel, ctx=document){ return Array.from(ctx.querySelectorAll(sel)); }

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
        // save draft
        try { localStorage.setItem('bintiBookingDraft', JSON.stringify(draft)); }
        catch (err) { console.warn('Could not save draft', err); }

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

    const draftRaw = localStorage.getItem('bintiBookingDraft');
    let draft = null;
    try { if (draftRaw) draft = JSON.parse(draftRaw); } catch (e) { log.error('BOOKING', 'Invalid draft JSON', e); }
    if (draft) log.info('BOOKING', 'Draft loaded from localStorage', draft);

    // --- Load selected package if user came from package page
    const packageRaw = localStorage.getItem('bintiSelectedPackage');
    let selectedPackage = null;
    try { if (packageRaw) selectedPackage = JSON.parse(packageRaw); } catch (e) { log.error('BOOKING', 'Invalid package JSON', e); }
    if (selectedPackage) log.info('BOOKING', 'Selected package loaded', selectedPackage);

    // Display selected package if it exists
    if (selectedPackage && selectedPackage.name) {
      const packageSection = q('#package-section');
      const packageName = q('#selected-package-name');
      if (packageSection && packageName) {
        packageSection.style.display = 'block';
        packageName.textContent = selectedPackage.name;
        log.info('BOOKING', 'Package section displayed', selectedPackage.name);
      }
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
    const summaryBox = q('#booking-summary');
    const siteVisitBtn = q('#site-visit-btn');

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
    }

    function parseSizeArea(size) {
      if (!size) return 0;
      const parts = size.split('x').map(p => parseFloat(p));
      if (parts.length !== 2) return 0;
      return parts[0] * parts[1];
    }

    // Zone info display helper
    const zoneInfoBox = document.createElement('div');
    zoneInfoBox.id = 'zone-info-display';
    zoneInfoBox.style.cssText = 'padding: 10px; margin: 10px 0; background: #f0f8ff; border-left: 4px solid #007bff; border-radius: 4px; display: none; font-size: 0.9em;';

    function updateSummary() {
      const values = {
        tentType: tentTypeEl.value,
        stretchSize: stretchSizeEl ? stretchSizeEl.value : '',
        cheeseColor: cheeseColorEl ? cheeseColorEl.value : '',
        aframeSections: aframeSectionsEl ? aframeSectionsEl.value : '1',
        lighting: lightingEl ? lightingEl.checked : false,
        transport: transportEl ? transportEl.checked : false,
        decor: decorEl ? decorEl.checked : false,
        pasound: pasoundEl ? pasoundEl.checked : false,
        dancefloor: dancefloorEl ? dancefloorEl.checked : false,
        stagepodium: stagepodiumEl ? stagepodiumEl.checked : false,
        welcomesigns: welcomesignsEl ? welcomesignsEl.checked : false,
        venue: venueEl ? venueEl.value : '',
        sections: aframeSectionsEl ? aframeSectionsEl.value : '1'
      };

      log.info('BOOKING', 'Form values updated', values);

      // Send to backend for calculation (includes dynamic transport)
      const payload = {
        tentType: values.tentType,
        tentSize: values.stretchSize,
        lighting: values.lighting ? 'yes' : 'no',
        transport: values.transport ? 'yes' : 'no',
        pasound: values.pasound ? 'yes' : 'no',
        dancefloor: values.dancefloor ? 'yes' : 'no',
        stagepodium: values.stagepodium ? 'yes' : 'no',
        welcomesigns: values.welcomesigns ? 'yes' : 'no',
        decor: values.decor ? 'yes' : 'no',
        location: values.venue,
        sections: values.sections
      };

      log.info('BOOKING', 'Sending calculation payload to backend', payload);

      // Show helpful message if no tent selected
      if (!values.tentType) {
        log.warn('BOOKING', 'No tent type selected');
        if (summaryBox) {
          summaryBox.innerHTML = `<p style="color: #999; text-align: center; padding: 20px;">
            <i class="fas fa-arrow-left"></i> Select a tent type to see live pricing
          </p>`;
        }
        return;
      }

      // If transport is checked, require location
      if (values.transport && !values.venue) {
        let html = '<p><em>Waiting for configuration...</em></p>';
        if (values.transport) {
          html += '<p style="color: #d9534f;"><strong>⚠️ Location Required:</strong> Please enter your venue location for transport pricing.</p>';
        }
        if (summaryBox) summaryBox.innerHTML = html;
        return;
      }

      // Call backend calculate endpoint
      const calcUrl = `${API_BASE_URL}/bookings/calculate`;
      log.info('BOOKING', 'Calling calculation API', { url: calcUrl });
      
      fetch(calcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => {
          log.info('BOOKING', `API response received with status ${res.status}`);
          return res.json();
        })
        .then(data => {
          log.info('BOOKING', 'Calculation response', data);
          
          if (!data.success) {
            const error = data.message || 'Calculation error';
            log.error('BOOKING', 'Calculation failed', error);
            if (summaryBox) summaryBox.innerHTML = `<p style="color: #d9534f;"><strong>⚠️ Error:</strong> ${error}</p>`;
            return;
          }

          log.info('BOOKING', 'Calculation successful', { breakdown: data.breakdown, total: data.total });

          const breakdown = data.breakdown;
          let html = '';
          const total = data.total;

          // Tent
          if (breakdown.tent) {
            const tentInfo = breakdown.tent;
            if (tentInfo.type === 'stretch') {
              html += `<p><strong>Tent:</strong> Stretch (${values.stretchSize})</p>`;
            } else if (tentInfo.type === 'aframe') {
              html += `<p><strong>Tent:</strong> A-frame (${tentInfo.sections} section${tentInfo.sections > 1 ? 's' : ''})</p>`;
            } else if (tentInfo.type === 'cheese') {
              html += `<p><strong>Tent:</strong> Cheese${values.cheeseColor ? ' (Color: '+values.cheeseColor+')' : ''}</p>`;
            } else {
              html += `<p><strong>Tent:</strong> ${tentInfo.type}</p>`;
            }
            html += `<p><strong>Tent cost:</strong> KES ${tentInfo.cost.toLocaleString()}</p>`;
          } else {
            html += `<p style="color: #ccc;"><em>🔔 Please select a tent type to see pricing</em></p>`;
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

          html += `<hr><p><strong>Total (calculated):</strong> KES ${total.toLocaleString()}</p>`;
          html += `<p class="muted">Note: Decor and special arrangements are handled on inquiry.</p>`;

          if (summaryBox) summaryBox.innerHTML = html;

          // Save current booking partial into localStorage for checkout use
          const bookingSave = {
            tentType: values.tentType,
            stretchSize: values.stretchSize,
            cheeseColor: values.cheeseColor,
            aframeSections: values.aframeSections,
            lighting: values.lighting,
            transport: values.transport,
            decor: values.decor,
            pasound: values.pasound,
            dancefloor: values.dancefloor,
            stagepodium: values.stagepodium,
            welcomesigns: values.welcomesigns,
            venue: values.venue,
            fullname: q('#fullname') ? q('#fullname').value : '',
            phone: q('#phone') ? q('#phone').value : '',
            email: q('#email') ? q('#email').value : '',
            total: total,
            breakdown: breakdown,
            selectedPackage: selectedPackage ? selectedPackage.name : null
          };
          try { 
            localStorage.setItem('bintiBooking', JSON.stringify(bookingSave));
            log.info('BOOKING', 'Booking saved to localStorage', bookingSave);
          } catch (e) { 
            log.error('BOOKING', 'Failed to save booking to localStorage', e);
          }
        })
        .catch(err => {
          log.error('BOOKING', 'Calculation API error', err);
          if (summaryBox) summaryBox.innerHTML = '<p style="color: #d9534f;"><strong>Error:</strong> Could not calculate booking. Please try again.</p>';
        });
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
          
          fetch(zoneUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: venueEl.value })
          })
            .then(res => {
              log.info('BOOKING', `Zone API response status: ${res.status}`);
              return res.json();
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
    [stretchSizeEl, cheeseColorEl, aframeSectionsEl, lightingEl, transportEl, decorEl, pasoundEl, dancefloorEl, stagepodiumEl, welcomesignsEl, venueEl, q('#fullname'), q('#phone'), q('#email')].forEach(el => {
      if (!el) return;
      el.addEventListener('change', updateSummary);
      el.addEventListener('input', updateSummary);
    });

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

    // Prefill from draft if present
    if (draft) {
      if (draft.tentType) tentTypeEl.value = draft.tentType;
      if (draft.stretchSize && stretchSizeEl) stretchSizeEl.value = draft.stretchSize;
      if (draft.cheeseColor && cheeseColorEl) cheeseColorEl.value = draft.cheeseColor;
      if (draft.aframeSections && aframeSectionsEl) aframeSectionsEl.value = draft.aframeSections;
      // call showConditional and update summary
      showConditional();
    }

    // Submit handler
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Validate minimal fields with proper null checks
      const fullNameInput = q('#fullname');
      const phoneInput = q('#phone');
      const emailInput = q('#email');
      
      const hasFullName = fullNameInput && fullNameInput.value.trim();
      const hasPhone = phoneInput && phoneInput.value.trim();
      const hasEmail = emailInput && emailInput.value.trim();
      const hasTentType = tentTypeEl && tentTypeEl.value;
      
      if (!hasFullName || !hasPhone || !hasEmail || !hasTentType) {
        alert('Please complete your name, phone, email and tent selection before proceeding.');
        log.error('BOOKING', 'Form validation failed', { hasFullName, hasPhone, hasEmail, hasTentType });
        return;
      }

      // booking saved already in updateSummary() to localStorage key 'bintiBooking'
      log.info('BOOKING', 'Form submitted successfully, redirecting to checkout');
      window.location.href = 'checkout.html';
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
    } catch (e) { 
      log.error('CHECKOUT', 'Failed to parse booking JSON', e);
    }
    
    let html = '';
    html += `<p><strong>Name:</strong> ${booking.fullname || '—'}</p>`;
    html += `<p><strong>Phone:</strong> ${booking.phone || '—'}</p>`;
    html += `<p><strong>Email:</strong> ${booking.email || '—'}</p>`;
    html += `<p><strong>Venue:</strong> ${booking.venue || '—'}</p>`;
    html += `<p><strong>Tent:</strong> ${booking.tentType || '—'}`;
    if (booking.tentType === 'stretch' && booking.stretchSize) html += ` (${booking.stretchSize})`;
    if (booking.tentType === 'cheese' && booking.cheeseColor) html += ` (Color: ${booking.cheeseColor})`;
    if (booking.tentType === 'aframe') html += ` (${booking.aframeSections || 1} section(s))`;
    html += `</p>`;
    
    // Use breakdown data if available (new system with TransportService)
    if (booking.breakdown) {
      log.info('CHECKOUT', 'Using breakdown data from backend');
      const b = booking.breakdown;
      if (b.tent && b.tent.cost) html += `<p><strong>Tent cost:</strong> KES ${b.tent.cost.toLocaleString()}</p>`;
      if (b.lighting && b.lighting > 0) html += `<p><strong>Ambient Lighting:</strong> KES ${b.lighting.toLocaleString()}</p>`;
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

    html += `<hr><p><strong>Final total (calculated):</strong> KES ${ (booking.total || 0).toLocaleString() }</p>`;
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

  // --- M-Pesa payment trigger
  window.triggerMpesaPayment = function(bookingId, phone, amount, mpesaPhone) {
    // Use M-Pesa phone if provided, otherwise use contact phone
    const paymentPhone = mpesaPhone || phone;
    const message = `M-Pesa payment initiated for booking #${bookingId.substring(0, 8)}...\n\nAmount: KES ${amount.toLocaleString()}\nPhone: ${paymentPhone}\n\nA payment prompt will be sent to your M-Pesa registered phone number. Please enter your M-Pesa PIN to complete the payment.`;
    
    // Show payment instruction modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    modal.innerHTML = `
      <div style="background: white; padding: 40px; border-radius: 12px; max-width: 500px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #25D366, #00b842); padding: 30px; border-radius: 12px; margin-bottom: 24px;">
          <span style="font-size: 3.5em; font-weight: bold; color: white;">M</span>
          <p style="color: white; margin: 12px 0 0 0; font-size: 1.1em;">M-Pesa Payment</p>
        </div>
        <p style="margin: 20px 0; font-size: 1.05em; color: #333; line-height: 1.6;">
          <strong>Amount:</strong> KES ${amount.toLocaleString()}<br>
          <strong>Phone:</strong> ${paymentPhone}
        </p>
        <p style="color: #666; margin: 20px 0; background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #25D366;">
          A payment prompt will be sent to your M-Pesa registered phone number. Please enter your M-Pesa PIN to complete the payment.
        </p>
        <p style="color: #666; margin: 20px 0;"><i class="fas fa-spinner fa-spin"></i> Waiting for payment confirmation...</p>
        <small style="color: #999;">Do not close this window until payment is complete.</small>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(modal);
    
    // In production, backend would send actual STK push to phone
    // For now, simulate after 5 seconds
    setTimeout(() => {
      const confirmed = confirm('Did you complete the M-Pesa payment?');
      modal.remove();
      if (confirmed) {
        const successMsg = 'Thank you! Your payment has been received. Your booking is confirmed. You will receive a confirmation email shortly.';
        const successModal = document.createElement('div');
        successModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        successModal.innerHTML = `
          <div style="background: white; padding: 40px; border-radius: 12px; max-width: 500px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div style="background: linear-gradient(135deg, #28a745, #20c997); padding: 30px; border-radius: 12px; margin-bottom: 24px;">
              <i class="fas fa-check-circle" style="font-size: 3em; color: white;"></i>
              <p style="color: white; margin: 12px 0 0 0; font-size: 1.1em;">Payment Successful</p>
            </div>
            <p style="margin: 20px 0; font-size: 1em; color: #333; line-height: 1.6;">${successMsg}</p>
            <button onclick="window.location.href='index.html'" style="background: #28a745; color: white; border: none; padding: 12px 28px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 1em;">
              Back to Home
            </button>
          </div>
        `;
        document.body.appendChild(successModal);
        localStorage.removeItem('bintiBooking');
      } else {
        alert('Please verify your payment status. If you completed the payment, your booking will be confirmed shortly.');
      }
    }, 5000);
  };

  // --- Pesapal iframe helper
  window.loadPesapalIframe = function(bookingId) {
    const container = q('#pesapal-container') || q('#pesapalFrameContainer') || document.body;
    if (!container) return;
    container.innerHTML = '<div class="message-container"><p>Loading secure payment window…</p></div>';
    
    // Fetch the secure iframe URL from backend
    fetch(`${API_BASE_URL}/bookings/pesapal-iframe?bookingId=${encodeURIComponent(bookingId)}`)
      .then(res => res.json())
      .then(data => {
        const iframe = document.createElement('iframe');
        iframe.width = '100%';
        iframe.height = '650';
        iframe.frameBorder = '0';
        iframe.src = data.iframeUrl;
        container.innerHTML = '';
        container.appendChild(iframe);
      })
      .catch(err => {
        console.error('Failed to load Pesapal iframe:', err);
        container.innerHTML = '<p style="color: red;">Failed to load payment window. Please try again.</p>';
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
      log.warn('PAYMENT', 'Payment button is disabled - terms not accepted');
      alert('Please accept the Terms and Conditions before proceeding with payment.');
      return false;
    }
    
    // Terms accepted - proceed with payment
    const paymentMethod = q('input[name="payment-method"]:checked')?.value || 'mpesa';
    const paymentAmount = q('input[name="payment-amount"]:checked')?.value || 'deposit';
    const booking = JSON.parse(localStorage.getItem('bintiBooking') || '{}');
    
    log.info('PAYMENT', 'Payment form values', { paymentMethod, paymentAmount, booking });
    
    // Calculate payment amount
    const totalAmount = booking.total || 0;
    const depositAmount = Math.round(totalAmount * 0.8);
    const amountToPay = paymentAmount === 'deposit' ? depositAmount : totalAmount;
    
    log.info('PAYMENT', 'Amount calculation', { totalAmount, depositAmount, amountToPay });
    
    if (!booking.fullname || !booking.phone || !booking.email) {
      log.error('PAYMENT', 'Booking information incomplete', booking);
      alert('Booking information is incomplete. Please go back and complete your booking details.');
      return false;
    }

    // Validate M-Pesa phone if M-Pesa is selected
    let mpesaPhone = '';
    if (paymentMethod === 'mpesa') {
      mpesaPhone = q('#mpesa-phone')?.value?.trim() || '';
      log.info('PAYMENT', 'M-Pesa phone validation', { mpesaPhone });
      
      if (!mpesaPhone) {
        log.warn('PAYMENT', 'M-Pesa phone empty');
        alert('Please enter your M-Pesa registered phone number.');
        q('#mpesa-phone')?.focus();
        return false;
      }
      // Basic phone validation
      if (!/^\+?[0-9]{10,15}$/.test(mpesaPhone)) {
        log.error('PAYMENT', 'M-Pesa phone invalid format', mpesaPhone);
        alert('Please enter a valid phone number (e.g., +254712345678 or 0712345678).');
        q('#mpesa-phone')?.focus();
        return false;
      }
      log.info('PAYMENT', 'M-Pesa phone valid');
    }
    
    // Create payment request with terms acceptance and payment amount choice
    const paymentData = {
      fullname: booking.fullname,
      phone: booking.phone,
      email: booking.email,
      mpesaPhone: mpesaPhone,
      bookingDetails: {
        tentType: booking.tentType,
        stretchSize: booking.stretchSize,
        cheeseColor: booking.cheeseColor,
        aframeSections: booking.aframeSections,
        venue: booking.venue,
        lighting: booking.lighting,
        transport: booking.transport,
        decor: booking.decor,
        pasound: booking.pasound,
        dancefloor: booking.dancefloor,
        stagepodium: booking.stagepodium,
        welcomesigns: booking.welcomesigns,
        total: booking.total
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
    
    // Send to backend to create booking and initiate payment
    const confirmUrl = `${API_BASE_URL}/bookings/confirm`;
    log.info('PAYMENT', 'Calling booking confirm API', { url: confirmUrl });
    
    fetch(confirmUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    })
      .then(res => {
        log.info('PAYMENT', `Booking confirm API response status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        log.info('PAYMENT', 'Backend confirm response', data);
        
        if (data.success) {
          log.info('PAYMENT', 'Booking created successfully', { bookingId: data.bookingId });
          // Successfully created booking
          if (paymentMethod === 'mpesa') {
            log.info('PAYMENT', 'Initiating M-Pesa payment');
            // Trigger M-Pesa STK push with calculated amount
            window.triggerMpesaPayment(data.bookingId, booking.phone, amountToPay, mpesaPhone);
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
        alert('Payment processing failed. Please check your connection and try again.');
      });
    
    return true;
  };

  // --- Update payment amounts based on total (80% deposit, 100% full)
  window.updatePaymentAmounts = function() {
    console.log('[UPDATE AMOUNTS] Function called');
    try {
      const bookingRaw = localStorage.getItem('bintiBooking');
      console.log('[UPDATE AMOUNTS] Raw booking data from localStorage:', bookingRaw);
      
      const booking = JSON.parse(bookingRaw || '{}');
      const total = booking.total || 0;
      console.log('[UPDATE AMOUNTS] Total amount from booking:', total);
      
      const deposit = Math.round(total * 0.8);
      const full = total;
      
      console.log('[UPDATE AMOUNTS] Calculated values - Deposit (80%):', deposit, 'Full (100%):', full);
      
      const depositEl = q('#deposit-amount');
      const fullEl = q('#full-amount');
      
      console.log('[UPDATE AMOUNTS] Found elements - depositEl:', !!depositEl, 'fullEl:', !!fullEl);
      
      if (depositEl) {
        const newText = 'KES ' + deposit.toLocaleString();
        depositEl.textContent = newText;
        console.log('[UPDATE AMOUNTS] Updated #deposit-amount to:', newText);
      } else {
        console.warn('[UPDATE AMOUNTS] WARNING: #deposit-amount element not found!');
      }
      
      if (fullEl) {
        const newText = 'KES ' + full.toLocaleString();
        fullEl.textContent = newText;
        console.log('[UPDATE AMOUNTS] Updated #full-amount to:', newText);
      } else {
        console.warn('[UPDATE AMOUNTS] WARNING: #full-amount element not found!');
      }
      
    } catch (err) {
      console.error('[UPDATE AMOUNTS] ERROR:', err);
    }
  };

  // --- Update payment button state based on terms checkbox and M-Pesa phone
  window.updatePaymentButtonState = function() {
    const termsCheckbox = q('#accept-terms');
    const payButton = q('#pay-now-btn');
    
    if (!termsCheckbox || !payButton) {
      console.log('Button state elements not found');
      return;
    }
    
    const paymentMethod = q('input[name="payment-method"]:checked')?.value || 'mpesa';
    const mpesaPhone = q('#mpesa-phone')?.value?.trim() || '';
    
    console.log('Updating button state - Terms checked:', termsCheckbox.checked, 'Payment method:', paymentMethod, 'M-Pesa phone:', mpesaPhone);
    
    // Check if all conditions are met for enabling button
    const termsAccepted = termsCheckbox.checked;
    const mpesaPhoneFilled = paymentMethod === 'mpesa' ? mpesaPhone.length > 0 : true;
    const shouldEnable = termsAccepted && mpesaPhoneFilled;
    
    const icon = payButton.querySelector('i');
    
    if (shouldEnable) {
      // Enable button
      payButton.disabled = false;
      payButton.style.opacity = '1';
      payButton.style.cursor = 'pointer';
      // Change icon to unlocked
      if (icon) {
        icon.className = 'fas fa-unlock';
      }
      console.log('Button enabled - all conditions met');
    } else {
      // Disable button
      payButton.disabled = true;
      payButton.style.opacity = '0.5';
      payButton.style.cursor = 'not-allowed';
      // Change icon to locked
      if (icon) {
        icon.className = 'fas fa-lock';
      }
      console.log('Button disabled - conditions not met');
    }
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
    
    // Add change listener to terms checkbox
    termsCheckbox.addEventListener('change', () => {
      log.info('CHECKOUT', 'Terms checkbox changed', { checked: termsCheckbox.checked });
      window.updatePaymentButtonState();
    });
    
    // Show/hide M-Pesa phone field based on payment method selection
    document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        log.info('CHECKOUT', 'Payment method changed', { method: e.target.value });
        const mpesaPhoneSection = document.getElementById('mpesa-phone-section');
        if (e.target.value === 'mpesa') {
          mpesaPhoneSection.style.display = 'block';
          // Focus on M-Pesa phone input
          setTimeout(() => document.getElementById('mpesa-phone')?.focus(), 100);
        } else {
          mpesaPhoneSection.style.display = 'none';
          // Clear error when switching away from M-Pesa
          const mpesaError = document.getElementById('mpesa-phone-error');
          if (mpesaError) mpesaError.style.display = 'none';
          // Clear M-Pesa phone value when switching away
          const mpesaPhoneInput = document.getElementById('mpesa-phone');
          if (mpesaPhoneInput) mpesaPhoneInput.value = '';
        }
        // Update button state when payment method changes
        window.updatePaymentButtonState();
        // Also update payment amounts display when method changes
        window.updatePaymentAmounts();
      });
    });

    // M-Pesa phone input listeners
    const mpesaPhoneInput = document.getElementById('mpesa-phone');
    if (mpesaPhoneInput) {
      mpesaPhoneInput.addEventListener('input', () => {
        console.log('M-Pesa phone input changed');
        const mpesaError = document.getElementById('mpesa-phone-error');
        if (mpesaError) mpesaError.style.display = 'none';
        // Update button state when phone input changes
        window.updatePaymentButtonState();
      });
      
      // Validate on blur
      mpesaPhoneInput.addEventListener('blur', () => {
        const value = mpesaPhoneInput.value.trim();
        const mpesaError = document.getElementById('mpesa-phone-error');
        const mpesaErrorText = document.getElementById('mpesa-phone-error-text');
        
        if (value && !/^\+?[0-9]{10,15}$/.test(value)) {
          if (mpesaErrorText) {
            mpesaErrorText.textContent = 'Invalid format. Use: +254712345678, 0712345678, or 254712345678';
          }
          if (mpesaError) mpesaError.style.display = 'block';
        }
      });
    }

    // Use contact phone button - populate from booking details
    const useContactPhoneBtn = document.getElementById('use-contact-phone');
    if (useContactPhoneBtn) {
      useContactPhoneBtn.addEventListener('click', () => {
        try {
          const booking = JSON.parse(localStorage.getItem('bintiBooking') || '{}');
          if (booking.phone) {
            document.getElementById('mpesa-phone').value = booking.phone;
            alert('Phone number populated: ' + booking.phone);
            // Clear error when populated
            const mpesaError = document.getElementById('mpesa-phone-error');
            if (mpesaError) mpesaError.style.display = 'none';
            // Trigger button state update
            window.updatePaymentButtonState();
          } else {
            alert('No contact phone number found. Please enter your M-Pesa phone number manually.');
          }
        } catch (e) {
          console.error('Error loading phone number:', e);
          alert('Error loading phone number. Please enter manually.');
        }
      });
    }
    
    // Attach click handler to "Proceed to Payment" button
    const paymentButton = q('#pay-now-btn');
    if (paymentButton) {
      paymentButton.addEventListener('click', (e) => {
        console.log('Pay button clicked');
        // Prevent default and check disabled state before proceeding
        if (paymentButton.disabled) {
          console.log('Payment button is disabled - blocking click');
          e.preventDefault();
          e.stopPropagation();
          alert('Please accept the Terms and Conditions before proceeding with payment.');
          return false;
        }
        // Also validate terms checkbox directly
        if (!termsCheckbox.checked) {
          console.log('Terms not accepted - blocking payment');
          e.preventDefault();
          e.stopPropagation();
          alert('Please accept the Terms and Conditions before proceeding with payment.');
          return false;
        }
        window.proceedToPayment();
      });
      console.log('Pay button listener attached');
    } else {
      console.log('Pay button not found on page');
    }
    
    // Attach click handler to "Clear Booking" button
    const clearBookingBtn = q('#clear-booking-btn');
    if (clearBookingBtn) {
      console.log('[BUTTON SETUP] Attaching listener to #clear-booking-btn');
      clearBookingBtn.addEventListener('click', (e) => {
        console.log('[CLEAR BTN CLICKED] Button was clicked!');
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.clearBooking === 'function') {
          console.log('[CLEAR BTN CLICKED] Calling window.clearBooking()');
          window.clearBooking();
        } else {
          console.error('[CLEAR BTN CLICKED] window.clearBooking is not a function!');
        }
      });
      console.log('[BUTTON SETUP] Listener attached. Button state - disabled:', clearBookingBtn.disabled, 'classes:', clearBookingBtn.className);
    } else {
      console.error('[BUTTON SETUP] ERROR: #clear-booking-btn not found on page!');
    }
    
    console.log('Checkout page initialized - all listeners attached');
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
        const response = await fetch(contactUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, subject, message })
        });
        
        log.info('CONTACT', `Contact API response received with status ${response.status}`);
        
        const result = await response.json();
        
        log.info('CONTACT', 'Backend response', result);
        
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
})();
