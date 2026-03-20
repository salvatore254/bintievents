# Architecture Diagram: Separation of Concerns

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                        │
│                    HTML/CSS/JavaScript (public/)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                   HTTP Requests
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (server.js)                        │
│                   Entry Point - Port 5000                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
    ┌───────────┐  ┌────────────┐  ┌──────────────┐
    │ Booking   │  │ Payment    │  │ Contact      │
    │ Routes    │  │ Routes     │  │ Routes       │
    └─────┬─────┘  └──────┬─────┘  └───────┬──────┘
          │               │               │
          └───────────────┼───────────────┘
                          │
                   (Route Definitions)
                          │
                          ▼
      ┌──────────────────────────────────────────┐
      │     BACKEND FOLDER (/backend/)           │
      │                                          │
      │  ┌────────────────────────────────────┐ │
      │  │      MIDDLEWARE LAYER              │ │
      │  │  - Error handling (errorHandler)   │ │
      │  │  - Validation middleware           │ │
      │  │  - Request logging                 │ │
      │  └────────────────────────────────────┘ │
      │               │                         │
      │               ▼                         │
      │  ┌────────────────────────────────────┐ │
      │  │  CONTROLLER LAYER (Logic)          │ │
      │  │  - bookingController.js            │ │
      │  │  - paymentController.js            │ │
      │  │  - Request handling                │ │
      │  │  - Response formatting             │ │
      │  └────────────────────────────────────┘ │
      │               │                         │
      │               ▼                         │
      │  ┌────────────────────────────────────┐ │
      │  │  SERVICE LAYER (Business Logic)    │ │
      │  │  - TransportService                │ │
      │  │  - Zone identification             │ │
      │  │  - Complex calculations            │ │
      │  │  - External integrations           │ │
      │  └────────────────────────────────────┘ │
      │               │                         │
      │               ▼                         │
      │  ┌────────────────────────────────────┐ │
      │  │   VALIDATOR LAYER (Data Validation)│ │
      │  │  - bookingValidator.js             │ │
      │  │  - Input sanitization              │ │
      │  │  - Business rule validation        │ │
      │  └────────────────────────────────────┘ │
      │               │                         │
      │               ▼                         │
      │  ┌────────────────────────────────────┐ │
      │  │   MODEL LAYER (Data Structures)    │ │
      │  │  - Booking.js                      │ │
      │  │  - Data definitions                │ │
      │  │  - Methods                         │ │
      │  └────────────────────────────────────┘ │
      │               │                         │
      │               ▼                         │
      │  ┌────────────────────────────────────┐ │
      │  │   PERSISTENCE LAYER (Database)     │ │
      │  │  - connection.js                   │ │
      │  │  - migrations/                     │ │
      │  │  - seeds/                          │ │
      │  └────────────────────────────────────┘ │
      │                                        │
      └────────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
        DATABASE              THIRD-PARTY
        (PostgreSQL)          SERVICES
    (Bookings, Users,   (M-Pesa, Pesapal,
     Payments, etc)      Email, etc)
```

## Request-Response Flow

```
CLIENT REQUEST
      │
      ▼
    server.js
      │
      ▼
    MIDDLEWARE LAYER (Validation, Error Handling)
      │
      ├─✓ Pass?──────► NEXT
      │                │
      └─✗ Fail?────► ERROR RESPONSE (422)
                       │
                       ▼
                    CLIENT

    NEXT (Routing)
      │
      ▼
    ROUTE HANDLER
      │
      ▼
    CONTROLLER
      │
      ├─ Validate input ─✓────► Continue
      │                  │
      │                  └─✗──► Return Error (400/422)
      │
      ▼
    SERVICE LAYER
      │
      ├─ Perform business logic
      ├─ External API calls
      └─ Complex calculations
      │
      ▼
    MODEL LAYER
      │
      ├─ Data formatting
      ├─ Method execution
      └─ Structure validation
      │
      ▼
    DATABASE (if needed)
      │
      ▼
    RESPONSE FORMATTER (utils/response.js)
      │
      ▼
    SUCCESS / ERROR RESPONSE
      │
      ▼
    CLIENT (JSON)
```

## Separation of Concerns

### 1. **Routes** (`backend/routes/`)
```javascript
// ONLY defines HTTP methods and endpoints
// Delegates all logic to controllers

router.post("/calculate", (req, res) => {
  // Call controller
  bookingController.calculate(req, res);
});
```
❌ No business logic
❌ No database queries
✅ Just endpoint definitions

### 2. **Controllers** (`backend/controllers/`)
```javascript
// Handles HTTP request/response
// Orchestrates services and validators
// Returns formatted responses

async function calculate(req, res) {
  validate(req.body);           // Call validator
  const result = service.calc(); // Call service
  return response.success(res, result);
}
```
✅ Request/response handling
✅ Input validation
✅ Service orchestration
❌ No direct DB queries (through service only)

### 3. **Services** (`backend/services/`)
```javascript
// Pure business logic
// Can be reused by multiple controllers
// No HTTP concerns

class TransportService {
  static calculateCost(location) {
    // Complex business logic
    // Zone mapping
    // Price calculation
  }
}
```
✅ Complex calculations
✅ Reusable logic
✅ External integrations
❌ No HTTP/database specifics

### 4. **Validators** (`backend/validators/`)
```javascript
// Input data validation
// Business rule validation
// Reusable across controllers

function validateBookingData(data) {
  // Check required fields
  // Validate formats
  // Check business rules
}
```
✅ Data validation
✅ Format checking
❌ No logic execution

### 5. **Models** (`backend/models/`)
```javascript
// Data structure definition
// Methods for model operations
// No HTTP, no validation

class Booking {
  constructor(data) { /* ... */ }
  toJSON() { /* ... */ }
  getSummary() { /* ... */ }
}
```
✅ Data structures
✅ Model methods
❌ No business logic
❌ No HTTP

### 6. **Utilities** (`backend/utils/`)
```javascript
// Helper functions used everywhere
// Logging
// Response formatting

logger.info("Message");
response.success(res, data);
```
✅ Reusable helpers
✅ Logging, formatting
❌ No business logic

### 7. **Middleware** (`backend/middleware/`)
```javascript
// Express middleware functions
// Request preprocessing
// Error handling
// Global operations

app.use(errorHandler);
app.use(validateInput);
```
✅ Request preprocessing
✅ Error handling
✅ Global operations
❌ No route-specific logic

## Data Flow Example: Booking Request

```
1. CLIENT
   POST /api/bookings/calculate
   Body: { tentType, location, ... }

2. SERVER.JS
   Routes request to bookingRoutes

3. BOOKING ROUTES
   router.post("/calculate", ...)

4. MIDDLEWARE
   ├─ Body parsing
   ├─ CORS checking
   └─ Error handler setup

5. CONTROLLER (bookingController)
   ├─ Receive parsed request
   ├─ Call validator
   │  └─ bookingValidator.validateBookingData()
   │     Returns: { isValid, errors }
   ├─ If invalid: return error response
   └─ If valid: call service

6. SERVICE (TransportService)
   ├─ calculateTransportCost(location)
   │  ├─ Identify zone
   │  ├─ Get zone cost
   │  └─ Return structured data
   └─ Return to controller

7. UTILS (response.js)
   ├─ Format response
   │  success: true,
   │  data: {...},
   │  timestamp: ...
   └─ Return strict JSON format

8. CONTROLLER
   ├─ Receives formatted data
   ├─ Logs success (logger.js)
   └─ Sends JSON response

9. CLIENT
   HTTP 200 OK
   Content-Type: application/json
   {
     "success": true,
     "data": {...},
     "timestamp": "2026-03-19T..."
   }
```

## Folder Dependencies

```
Routes
  │
  └─→ Controllers
        │
        ├─→ Services
        │     │
        │     └─→ Models (if needed)
        │
        ├─→ Validators
        │
        ├─→ Utils
        │     ├─→ Logger
        │     └─→ Response
        │
        └─→ Middleware
              ├─→ ErrorHandler
              └─→ Validation
```

## Adding a New Feature

### Step 1: Create Service
```javascript
// backend/services/NewService.js
class NewService {
  static doSomething() { /* logic */ }
}
```

### Step 2: Create Controller
```javascript
// backend/controllers/newController.js
const { doSomething } = require('../services/NewService');

async function handle(req, res) {
  const result = NewService.doSomething(req.body);
  return response.success(res, result);
}
```

### Step 3: Create Routes
```javascript
// backend/routes/newRoutes.js
const { handle } = require('../controllers/newController');

router.post('/', handle);
module.exports = router;
```

### Step 4: Register in server.js
```javascript
const newRoutes = require('./backend/routes/newRoutes');
app.use('/api/new', newRoutes);
```

## Import Patterns

### Within Backend Modules
```javascript
// From routes
const TransportService = require('../services/TransportService');

// From controllers
const response = require('../utils/response');
const logger = require('../utils/logger');
const { validateBookingData } = require('../validators/bookingValidator');

// From services
const Booking = require('../models/Booking');

// From any module
const config = require('../config/environment');
```

### From server.js
```javascript
const bookingRoutes = require('./backend/routes/bookingRoutes');
const { errorHandler } = require('./backend/middleware/errorHandler');
```

## Testing Strategy

```
UNIT TESTS
├─ Services
│  ├─ TransportService.calculateCost()
│  └─ TransportService.identifyZone()
│
├─ Validators
│  ├─ validateBookingData()
│  └─ validatePaymentData()
│
└─ Utils
   ├─ logger.error()
   └─ response.success()

INTEGRATION TESTS
├─ Routes
│  ├─ POST /api/bookings/calculate
│  ├─ GET /api/bookings/zones
│  └─ POST /api/bookings/identify-zone
│
└─ Controllers
   ├─ Validator → Service → Response flow
   └─ Error handling flow

E2E TESTS
├─ Client → Server → Response
├─ Full booking flow
└─ Payment flow
```

## Performance Optimization Points

1. **Validators** - Validate early to fail fast
2. **Services** - Cache expensive calculations
3. **Database** - Implement connection pooling
4. **Middleware** - Order matters (expensive last)
5. **Logging** - Log only what's needed

---

This architecture ensures:
- ✅ Easy to test (isolation)
- ✅ Easy to maintain (clear boundaries)
- ✅ Easy to scale (add features without touching other parts)
- ✅ Easy to debug (follow the flow)
- ✅ Industry standard (familiar to developers)

