# Modal Testing & Verification Guide

## Modal Appearance - Testing Steps

### Setup
1. Open browser DevTools (F12)
2. Go to Console tab
3. Enable logging

### Test 1: Verify M-Pesa Modal Appears

**Steps:**
1. Go to `bookings.html`
2. Fill in the form:
   - Name: "Test User"
   - Phone: "0712345678"
   - Email: "test@example.com"
   - Select any tent
   - Fill venue, date, time
3. Click "Proceed to Checkout"
4. On `checkout.html`, select **M-Pesa** payment method
5. **Accept Terms** checkbox
6. Click "Proceed to Payment"

**Expected:**
- ✅ M-Pesa phone modal appears immediately
- ✅ Modal has:
  - Title: "M-Pesa Number"
  - Input field (should be focused)
  - Confirm & Cancel buttons
- ✅ Console shows: `[CHECKOUT] M-Pesa phone modal shown - waiting for user input`

### Test 2: Verify Modal Validation

**Steps:**
1. In the M-Pesa modal, type invalid phone: "12345"
2. Click "Confirm"

**Expected:**
- ❌ Modal stays open
- ✅ Error message appears: "Invalid format. Use: +254712345678"
- ✅ Can retry with valid phone

### Test 3: Verify Modal Closes After Valid Input

**Steps:**
1. In the M-Pesa modal, enter valid phone: "0712345678"
2. Click "Confirm"

**Expected:**
- ✅ Modal closes
- ✅ Proceeds to payment
- ✅ Console shows: `[CHECKOUT] M-Pesa phone confirmed`

### Test 4: Verify Pesapal Path (No Modal)

**Steps:**
1. Go to `checkout.html`
2. Select **Pesapal** payment method
3. Accept terms
4. Click "Proceed to Payment"

**Expected:**
- ✅ M-Pesa phone modal does NOT appear
- ✅ Pesapal iframe modal appears instead
- ✅ Console shows payment processing starting

---

## Email Verification - Pre-Backend Fix

Since the backend email fix hasn't been implemented yet, the email will still be sent at booking creation. 

**To verify this is an issue:**
1. Complete a test booking with email "your-email@gmail.com"
2. Check email immediately after "Proceed to Payment"
3. ❌ Email received = Confirms email sent too early (before payment confirmation)

**After backend fix:**
- ✅ Email will only arrive AFTER payment is confirmed

---

## Console Logs to Monitor

Watch for these logs in browser console during testing:

```
[CHECKOUT] proceedToPayment called
[CHECKOUT] M-Pesa phone modal shown - waiting for user input
[CHECKOUT] M-Pesa phone confirmed
[PAYMENT] Sending payment confirmation to backend
[PAYMENT] Calling booking confirm API
[PAYMENT] Backend confirm response
[PAYMENT] Initiating M-Pesa payment
[PAYMENT] STK push initiated successfully
[PAYMENT] Waiting for payment confirmation...
```

## Current Frontend Status

✅ **Modal Logic: CORRECT**
- M-Pesa phone modal shows when needed
- Validation works
- Proceeds to payment correctly
- All console logs are in place

❌ **Email Timing: ISSUE ON BACKEND**
- Email sent at booking creation (too early)
- Should be sent after payment webhook confirms
- Frontend is ready, backend needs webhook integration

## Quick Checklist

- [ ] M-Pesa modal appears on "Proceed to Payment"
- [ ] Modal validates phone numbers
- [ ] Modal closes after valid input
- [ ] Pesapal doesn't show phone modal
- [ ] Payment proceeds after modal confirmation
- [ ] Console shows all expected logs
- [ ] Backend fix implemented (send email only after webhook)

## Need Help?

If modal isn't appearing:
1. Check browser console for errors
2. Verify checkout.html has both modal divs (#mpesa-phone-modal and #pay-now-btn)
3. Run: `console.log(document.getElementById('mpesa-phone-modal'))` - should not be null
4. Check payment method selection - correct option must be active
5. Check terms checkbox is checked

Most common issues:
- ❌ Mobile view: Modal might be cut off. Check responsive design
- ❌ Terms not checked: Button validation blocks modal
- ❌ Wrong payment method selected: Pesapal won't trigger M-Pesa modal
