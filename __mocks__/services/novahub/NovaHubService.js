// Mock for src/services/novahub/NovaHubService.ts
// This mock avoids dependencies and provides a complete mock implementation

const mockNovaHubService = {
  // Methods
  getPals: jest.fn().mockResolvedValue({pals: [], total: 0}),
  getPal: jest.fn().mockResolvedValue(null),
  getMyPals: jest.fn().mockResolvedValue(null),
  getUserLibrary: jest.fn().mockResolvedValue([]),
  getUserCreatedPals: jest.fn().mockResolvedValue([]),
  addToLibrary: jest.fn().mockResolvedValue(undefined),
  removeFromLibrary: jest.fn().mockResolvedValue(undefined),
  createPal: jest.fn().mockResolvedValue(null),
  updatePal: jest.fn().mockResolvedValue(null),
  deletePal: jest.fn().mockResolvedValue(undefined),
  searchPals: jest.fn().mockResolvedValue({pals: [], total: 0}),
  getCategories: jest.fn().mockResolvedValue([]),
  getTags: jest.fn().mockResolvedValue([]),
  downloadPalImage: jest.fn().mockResolvedValue(null),
  getLibrary: jest.fn().mockResolvedValue(null),
  checkPalOwnership: jest.fn().mockResolvedValue(null),

  // Private methods (mocked for completeness)
  buildQuery: jest.fn().mockReturnValue({}),
  executeQuery: jest.fn().mockResolvedValue([]),
  transformPal: jest.fn().mockReturnValue({}),
  handleError: jest.fn(),
};

// Create a singleton instance
const novaHubService = mockNovaHubService;

// Export the mock service
export default novaHubService;

// Named export for compatibility
export {novaHubService};

// CommonJS compatibility
module.exports = novaHubService;
module.exports.default = novaHubService;
module.exports.novaHubService = novaHubService;
