// Mock for src/services/novahub/index.ts
// This mock re-exports all the individual novahub service mocks

// Import the individual service mocks
const {authService} = require('./AuthService');
const {syncService} = require('./SyncService');
const {novaHubService} = require('./NovaHubService');
const {
  supabase,
  getAuthHeaders,
  isAuthenticated,
  getCurrentUser,
} = require('./supabase');

// Create mock implementations for other services
const cacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  has: jest.fn().mockResolvedValue(false),
  size: jest.fn().mockResolvedValue(0),
};

const purchaseService = {
  isAvailable: jest.fn().mockResolvedValue(false),
  getProducts: jest.fn().mockResolvedValue([]),
  purchaseProduct: jest.fn().mockResolvedValue(null),
  restorePurchases: jest.fn().mockResolvedValue([]),
  validateReceipt: jest.fn().mockResolvedValue(false),
};

const NovaHubErrorHandler = {
  handleError: jest.fn(),
  logError: jest.fn(),
  reportError: jest.fn(),
};

const RetryHandler = {
  retry: jest.fn().mockResolvedValue(null),
  withRetry: jest.fn().mockResolvedValue(null),
};

// Export all services
module.exports = {
  authService,
  syncService,
  novaHubService,
  cacheService,
  purchaseService,
  NovaHubErrorHandler,
  RetryHandler,
  supabase,
  getAuthHeaders,
  isAuthenticated,
  getCurrentUser,
};

// Named exports for ES6 compatibility
module.exports.authService = authService;
module.exports.syncService = syncService;
module.exports.novaHubService = novaHubService;
module.exports.cacheService = cacheService;
module.exports.purchaseService = purchaseService;
module.exports.NovaHubErrorHandler = NovaHubErrorHandler;
module.exports.RetryHandler = RetryHandler;
module.exports.supabase = supabase;
module.exports.getAuthHeaders = getAuthHeaders;
module.exports.isAuthenticated = isAuthenticated;
module.exports.getCurrentUser = getCurrentUser;
