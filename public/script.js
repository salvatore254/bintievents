/* script.js - shared across pages
   - Mobile hamburger nav
   - Interactive card Book Now -> saves a draft and redirects to bookings
   - Prefill bookings form from draft
   - Live booking price calculation with backend integration
     * Stretch: 250 KES/m²
     * A-frame: 40k/section, B-line: 30k, Cheese: 15k
     * Lighting: 20k
     * Transport: Dynamic based on Nairobi zones or outside Nairobi regions
     * Site visit: 1.5k Nairobi, arrange outside
   - Real-time zone identification as user types location
   - Checkout loader (reads booking with breakdown data from localStorage)
   - loadPesapalIframe(orderRef) helper (placeholder)
*/

(function () {
  // --- Configuration: API Base URL
  // This allows frontend to be hosted on a different server than the backend
  const API_BASE_URL = window.API_BASE_URL || "/api";
  
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
    if (!form) return;

    const draftRaw = localStorage.getItem('bintiBookingDraft');
    let draft = null;
    try { if (draftRaw) draft = JSON.parse(draftRaw); } catch (e) { console.warn('Invalid draft', e); }

    // Elements we'll use
    const tentTypeEl = q('#tent-type');
    const stretchSizeEl = q('#stretch-size');
    const cheeseColorEl = q('#cheese-color');
    const aframeSectionsEl = q('#aframe-sections');
    const lightingEl = q('#lighting');
    const transportEl = q('#transport');
    const decorEl = q('#decor');
    const sitevisitEl = q('#sitevisit');
    const venueEl = q('#venue');
    const summaryBox = q('#booking-summary');

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
        sitevisit: sitevisitEl ? sitevisitEl.checked : false,
        venue: venueEl ? venueEl.value : '',
        sections: aframeSectionsEl ? aframeSectionsEl.value : '1'
      };

      // Send to backend for calculation (includes dynamic transport)
      const payload = {
        tentType: values.tentType,
        tentSize: values.stretchSize,
        lighting: values.lighting ? 'yes' : 'no',
        transport: values.transport ? 'yes' : 'no',
        siteVisit: values.sitevisit ? 'yes' : 'no',
        location: values.venue,
        sections: values.sections
      };

      // Show helpful message if no tent selected
      if (!values.tentType) {
        if (summaryBox) {
          summaryBox.innerHTML = `<p style="color: #999; text-align: center; padding: 20px;">
            <i class="fas fa-arrow-left"></i> Select a tent type to see live pricing
          </p>`;
        }
        return;
      }

      // If transport or site visit is checked, require location
      if ((values.transport || values.sitevisit) && !values.venue) {
        let html = '<p><em>Waiting for configuration...</em></p>';
        if (values.transport || values.sitevisit) {
          html += '<p style="color: #d9534f;"><strong>⚠️ Location Required:</strong> Please enter your venue location for transport & site visit pricing.</p>';
        }
        if (summaryBox) summaryBox.innerHTML = html;
        return;
      }

      // Call backend calculate endpoint
      fetch(`${API_BASE_URL}/bookings/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            let error = data.message || 'Calculation error';
            if (summaryBox) summaryBox.innerHTML = `<p style="color: #d9534f;"><strong>⚠️ Error:</strong> ${error}</p>`;
            return;
          }

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

          // Site visit
          if (breakdown.siteVisit) {
            const sv = breakdown.siteVisit;
            if (sv.cost > 0) {
              html += `<p><strong>Site visit (${sv.area}):</strong> KES ${sv.cost.toLocaleString()}</p>`;
            } else {
              html += `<p><strong>Site visit:</strong> Outside Nairobi - requires arrangements (we'll contact you)</p>`;
            }
          }

          // Decor
          if (values.decor) {
            html += `<p><strong>Decor:</strong> Upon Inquiry</p>`;
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
            sitevisit: values.sitevisit,
            venue: values.venue,
            fullname: q('#fullname') ? q('#fullname').value : '',
            phone: q('#phone') ? q('#phone').value : '',
            email: q('#email') ? q('#email').value : '',
            total: total,
            breakdown: breakdown
          };
          try { localStorage.setItem('bintiBooking', JSON.stringify(bookingSave)); } catch (e) { console.warn(e); }
        })
        .catch(err => {
          console.error('Booking calculation error:', err);
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
          fetch(`${API_BASE_URL}/bookings/identify-zone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: venueEl.value })
          })
            .then(res => res.json())
            .then(data => {
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
              }
            })
            .catch(() => { zoneInfoBox.style.display = 'none'; });
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
    [stretchSizeEl, cheeseColorEl, aframeSectionsEl, lightingEl, transportEl, decorEl, sitevisitEl, venueEl, q('#fullname'), q('#phone'), q('#email')].forEach(el => {
      if (!el) return;
      el.addEventListener('change', updateSummary);
      el.addEventListener('input', updateSummary);
    });

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
      // Validate minimal fields
      if (!q('#fullname').value || !q('#phone').value || !q('#email').value || !tentTypeEl.value) {
        alert('Please complete your name, phone, email and tent selection before proceeding.');
        return;
      }

      // If site visit chosen and location outside Nairobi -> redirect to contact page for arrangements
      if (sitevisitEl.checked) {
        const loc = (venueEl.value || '').toLowerCase();
        if (!loc.includes('nairobi')) {
          // redirect to contact page with parameter
          window.location.href = 'contact.html?sitevisit=outside';
          return;
        }
      }

      // booking saved already in updateSummary() to localStorage key 'bintiBooking'
      window.location.href = 'checkout.html';
    });

    // initial summary populate
    updateSummary();
  });

  // --- Checkout page: render booking and payment helpers
  onReady(() => {
    const orderSummary = q('#order-summary') || q('#booking-summary');
    if (!orderSummary) return;
    const raw = localStorage.getItem('bintiBooking');
    if (!raw) { orderSummary.innerHTML = '<p>No booking found. Please create a booking.</p>'; return; }
    let booking = {};
    try { booking = JSON.parse(raw); } catch (e) { console.warn(e); }
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
      const b = booking.breakdown;
      if (b.tent && b.tent.cost) html += `<p><strong>Tent cost:</strong> KES ${b.tent.cost.toLocaleString()}</p>`;
      if (b.lighting && b.lighting > 0) html += `<p><strong>Lighting:</strong> KES ${b.lighting.toLocaleString()}</p>`;
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
      if (b.siteVisit) {
        if (b.siteVisit.cost > 0) {
          html += `<p><strong>Site visit (${b.siteVisit.area}):</strong> KES ${b.siteVisit.cost.toLocaleString()}</p>`;
        } else if (b.siteVisit.note) {
          html += `<p><strong>Site visit:</strong> ${b.siteVisit.note}</p>`;
        }
      }
    } else {
      // Fallback to old calculation method
      const tentPrice = booking.total ? booking.total - (booking.lighting ? 20000 : 0) - (booking.transport ? 7000 : 0) - (booking.sitevisit && booking.venue && booking.venue.toLowerCase().includes('nairobi') ? 1500 : 0) : 0;
      if (booking.tentType) html += `<p><strong>Tent cost (approx):</strong> KES ${Math.max(0, tentPrice).toLocaleString()}</p>`;
      if (booking.lighting) html += `<p><strong>Lighting:</strong> KES 20,000</p>`;
      if (booking.transport) html += `<p><strong>Transport:</strong> KES 7,000</p>`;
      if (booking.sitevisit) {
        if (booking.venue && booking.venue.toLowerCase().includes('nairobi')) html += `<p><strong>Site visit (Nairobi):</strong> KES 1,500</p>`;
        else html += `<p><strong>Site visit:</strong> Please contact us — outside Nairobi requires arrangements.</p>`;
      }
    }
    
    if (booking.decor) html += `<p><strong>Decor:</strong> Upon Inquiry</p>`;

    html += `<hr><p><strong>Final total (calculated):</strong> KES ${ (booking.total || 0).toLocaleString() }</p>`;
    orderSummary.innerHTML = html;

    // Update checkout summary details
    const subtotalEl = q('#subtotal');
    const taxEl = q('#tax');
    const totalAmountEl = q('#total-amount');
    
    if (subtotalEl) subtotalEl.textContent = `KES ${(booking.total || 0).toLocaleString()}`;
    if (taxEl) taxEl.textContent = 'KES 0';
    if (totalAmountEl) totalAmountEl.textContent = `KES ${(booking.total || 0).toLocaleString()}`;
  });

  // --- Pesapal iframe helper (placeholder)
  window.loadPesapalIframe = function(orderRef) {
    const container = q('#pesapal-container') || q('#pesapalFrameContainer') || document.body;
    if (!container) return;
    container.innerHTML = '<div class="message-container"><p>Loading secure payment window…</p></div>';
    const iframe = document.createElement('iframe');
    iframe.width = '100%';
    iframe.height = '650';
    iframe.frameBorder = '0';
    // NOTE: In production, generate secure Pesapal iframe src from backend using Pesapal credentials.
    iframe.src = `https://www.pesapal.com/pesapal_iframe_placeholder?orderRef=${encodeURIComponent(orderRef)}`;
    container.innerHTML = '';
    container.appendChild(iframe);
  };
})();
