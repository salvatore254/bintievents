# Backend: Email Sending Logic Fix

## Problem
Email is currently being sent when booking is created (`/api/bookings/confirm`), **BEFORE** payment is confirmed. It should only be sent **AFTER** payment confirmation.

## Current Flow (❌ Wrong)
```
Frontend: proceedToPaymentAfterModal()
    ↓
Backend: POST /api/bookings/confirm
    └─→ Creates booking
    └─→ Sends email ❌ (TOO EARLY)
    ↓ (Returns bookingId)
Frontend: triggerMpesaPayment(bookingId)
    ↓
M-Pesa: User enters PIN
    ↓
Backend: ??? (no webhook to confirm payment and send email)
```

## Required Changes

### 1. Modify `/api/bookings/confirm` Endpoint
**Current behavior:** Sends email when booking is created
**New behavior:** Create booking WITHOUT sending email

**Code change:**
```javascript
// controllers/bookingController.js
exports.confirmBooking = async (req, res) => {
  try {
    const bookingData = req.body;
    
    // Create booking in database
    const booking = await Booking.create(bookingData);
    
    // ❌ REMOVE THIS:
    // await sendConfirmationEmail(booking);
    
    // ✅ ONLY return booking confirmation
    res.json({
      success: true,
      bookingId: booking.id,
      message: 'Booking created. Awaiting payment confirmation.'
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
```

### 2. Create Payment Webhook Handler
**Add new endpoint:** `POST /api/payments/webhook`

This endpoint receives payment confirmation from M-Pesa/Pesapal through their notification system.

```javascript
// controllers/paymentController.js
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { bookingId, paymentStatus, transactionId } = req.body;
    
    if (paymentStatus === 'success') {
      // Update booking to mark as paid
      const booking = await Booking.findByIdAndUpdate(
        bookingId,
        { 
          paymentStatus: 'confirmed',
          transactionId: transactionId,
          paidAt: new Date()
        },
        { new: true }
      );
      
      // ✅ NOW send the confirmation email (AFTER payment confirmed)
      await sendConfirmationEmail(booking);
      
      res.json({ success: true, message: 'Payment confirmed and email sent' });
    } else {
      // Payment failed
      res.json({ success: false, message: 'Payment failed' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
```

### 3. Configure M-Pesa Webhook in Backend
In your M-Pesa integration (Safaricom Daraja API setup):
- **Callback URL**: `https://your-backend.com/api/payments/webhook`
- This tells M-Pesa where to send payment confirmation

### 4. Optional: Add Polling Fallback (if webhook is unreliable)
```javascript
// Check payment status every 5 seconds for 2 minutes
const checkPaymentInterval = setInterval(async () => {
  const booking = await Booking.findById(bookingId);
  
  if (booking.paymentStatus === 'confirmed') {
    // Email was already sent by webhook
    clearInterval(checkPaymentInterval);
  }
}, 5000);

setTimeout(() => {
  clearInterval(checkPaymentInterval);
  // If still no payment after 2 minutes, user will see timeout on frontend
}, 120000);
```

## Testing

1. **Before payment confirmation**: Email should NOT be sent yet
2. **After M-Pesa payment confirmation**: Email should be sent within seconds
3. **Email contents**: Should include booking details and booking ID

## Frontend Code (Already Correct)
No changes needed to frontend. The `triggerMpesaPayment()` function at line 1171 is already set up to:
- Show payment status modal
- Wait for payment response
- Handle timeout after 2 minutes

The backend just needs to complete the webhook integration to notify frontend of success and trigger email.

## Important Notes
- ✅ Modal appears correctly when "Proceed to Payment" is clicked
- ✅ All booking data is captured before payment
- ❌ Only fix needed: Email sending timing on backend
