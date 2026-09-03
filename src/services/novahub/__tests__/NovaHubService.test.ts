jest.mock('../AuthService', () => ({
  authService: {isAuthenticated: false, user: null},
}));

jest.mock('../NovaHubApiService', () => ({
  novaHubApiService: {
    getPal: jest.fn(),
  },
}));

describe('NovaHubService', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('checkPalOwnership returns owned=false when unauthenticated', async () => {
    jest.doMock('../AuthService', () => ({
      authService: {isAuthenticated: false, user: null},
    }));
    const {novaHubService} = require('../NovaHubService');
    await expect(novaHubService.checkPalOwnership('pal-1')).resolves.toEqual({
      owned: false,
    });
  });

  it('checkPalOwnership returns owned flag based on pal.is_owned', async () => {
    jest.doMock('../AuthService', () => ({
      authService: {isAuthenticated: true, user: {id: 'u1'}},
    }));
    const {novaHubApiService} = require('../NovaHubApiService');
    (novaHubApiService.getPal as jest.Mock).mockResolvedValue({
      id: 'pal-1',
      is_owned: true,
    });
    const {novaHubService} = require('../NovaHubService');

    await expect(novaHubService.checkPalOwnership('pal-1')).resolves.toEqual({
      owned: true,
      purchase_date: undefined,
    });

    (novaHubApiService.getPal as jest.Mock).mockResolvedValue({
      id: 'pal-1',
      is_owned: false,
    });
    await expect(novaHubService.checkPalOwnership('pal-1')).resolves.toEqual({
      owned: false,
      purchase_date: undefined,
    });
  });

  it('checkPalOwnership wraps unknown errors into NovaHubError', async () => {
    jest.doMock('../AuthService', () => ({
      authService: {isAuthenticated: true, user: {id: 'u1'}},
    }));
    const {novaHubApiService} = require('../NovaHubApiService');
    (novaHubApiService.getPal as jest.Mock).mockRejectedValue(
      new Error('boom'),
    );
    const {novaHubService, NovaHubError} = require('../NovaHubService');

    await expect(novaHubService.checkPalOwnership('pal-1')).rejects.toThrow(
      NovaHubError,
    );
    await expect(novaHubService.checkPalOwnership('pal-1')).rejects.toThrow(
      'Failed to check ownership: boom',
    );
  });
});
