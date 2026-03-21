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
   - loadPesapalIframe(bookingId) helper (secure iframe from backend)
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
    const termsCheckbox = q('#accept-terms');
    
    // If terms checkbox doesn't exist (not on checkout page), proceed normally
    if (!termsCheckbox) {
      console.log('Terms checkbox not found, proceeding with payment');
      return true;
    }
    
    // If button is disabled, don't allow proceed
    if (q('#pay-now-btn')?.disabled) {
      alert('Please accept the Terms and Conditions before proceeding with payment.');
      return false;
    }
    
    // Terms accepted - proceed with payment
    const paymentMethod = q('input[name="payment-method"]:checked')?.value || 'mpesa';
    const booking = JSON.parse(localStorage.getItem('bintiBooking') || '{}');
    
    console.log('Payment method selected:', paymentMethod);
    
    if (!booking.fullname || !booking.phone || !booking.email) {
      alert('Booking information is incomplete. Please go back and complete your booking details.');
      return false;
    }

    // Validate M-Pesa phone if M-Pesa is selected
    let mpesaPhone = '';
    if (paymentMethod === 'mpesa') {
      mpesaPhone = q('#mpesa-phone')?.value?.trim() || '';
      if (!mpesaPhone) {
        alert('Please enter your M-Pesa registered phone number.');
        q('#mpesa-phone')?.focus();
        return false;
      }
      // Basic phone validation
      if (!/^\+?[0-9]{10,15}$/.test(mpesaPhone)) {
        alert('Please enter a valid phone number (e.g., +254712345678 or 0712345678).');
        q('#mpesa-phone')?.focus();
        return false;
      }
    }
    
    // Create payment request with terms acceptance
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
        total: booking.total
      },
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      paymentMethod: paymentMethod
    };
    
    // Send to backend to create booking and initiate payment
    fetch(`${API_BASE_URL}/bookings/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Successfully created booking
          if (paymentMethod === 'mpesa') {
            // Trigger M-Pesa STK push with M-Pesa phone
            window.triggerMpesaPayment(data.bookingId, booking.phone, booking.total, mpesaPhone);
          } else if (paymentMethod === 'pesapal') {
            // Load Pesapal iframe
            window.loadPesapalIframe(data.bookingId);
          } else {
            alert('Payment method not recognized. Please contact support.');
          }
        } else {
          alert(`Booking creation failed: ${data.message || 'Unknown error'}`);
        }
      })
      .catch(err => {
        console.error('Payment error:', err);
        alert('Payment processing failed. Please check your connection and try again.');
      });
    
    return true;
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
      payButton.style.pointerEvents = 'auto';
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
      payButton.style.pointerEvents = 'none';
      // Change icon to locked
      if (icon) {
        icon.className = 'fas fa-lock';
      }
      console.log('Button disabled - conditions not met');
    }
  };
  
  // --- Clear booking from both pages
  window.clearBooking = function() {
    if (confirm('Are you sure you want to clear all booking details? This cannot be undone.')) {
      // Remove booking data from localStorage
      localStorage.removeItem('bintiBooking');
      
      // Reset form fields if on bookings page
      const bookingForm = q('#booking-form');
      if (bookingForm) {
        bookingForm.reset();
        // Clear all form inputs
        qa('input, select, textarea').forEach(field => {
          field.value = '';
        });
        console.log('Booking form cleared');
      }
      
      // Reset checkout form if on checkout page
      const termsCheckbox = q('#accept-terms');
      if (termsCheckbox) {
        termsCheckbox.checked = false;
        const mpesaPhoneInput = q('#mpesa-phone');
        if (mpesaPhoneInput) mpesaPhoneInput.value = '';
        // Reset button state
        if (window.updatePaymentButtonState) window.updatePaymentButtonState();
        console.log('Checkout form cleared');
      }
      
      alert('Booking cleared successfully. Redirecting to booking form...');
      window.location.href = 'bookings.html';
    }
  };

  // Initialize checkout page button state on load
  onReady(() => {
    const termsCheckbox = q('#accept-terms');
    const payButton = q('#pay-now-btn');
    
    if (!termsCheckbox || !payButton) {
      console.log('Checkout page elements not found');
      return;
    }
    
    // Initialize button state
    window.updatePaymentButtonState();
    
    // Add change listener to terms checkbox
    termsCheckbox.addEventListener('change', () => {
      console.log('Terms checkbox changed');
      window.updatePaymentButtonState();
    });
    
    // Show/hide M-Pesa phone field based on payment method selection
    document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        console.log('Payment method changed to:', e.target.value);
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
    const payButton = q('#pay-now-btn');
    if (payButton) {
      payButton.addEventListener('click', () => {
        console.log('Pay button clicked');
        window.proceedToPayment();
      });
    }
    
    // Attach click handler to "Clear Booking" button
    const clearBookingBtn = q('#clear-booking-btn');
    if (clearBookingBtn) {
      clearBookingBtn.addEventListener('click', () => {
        console.log('Clear booking button clicked');
        window.clearBooking();
      });
    }
    
    console.log('Checkout page initialized - all listeners attached');
  });

  // --- Contact Form Handler
  onReady(() => {
    const contactForm = q('#contact-form');
    if (!contactForm) return; // Not on contact page
    
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
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
        
        // Validate required fields
        if (!name || !email || !subject || !message) {
          throw new Error('Please fill in all required fields.');
        }
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        // Send to backend
        const response = await fetch(`${API_BASE_URL}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, subject, message })
        });
        
        const result = await response.json();
        
        if (result.success) {
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
          throw new Error(result.message || 'Failed to send message.');
        }
      } catch (err) {
        console.error('Contact form error:', err);
        
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
    
    console.log('Contact form initialized');
  });
})();
