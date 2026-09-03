import {isLocalPal, isNovaHubPal, handlePalByType} from '../pal-type-guards';
import type {Pal} from '../../types/pal';
import type {NovaHubPal} from '../../types/novahub';

describe('pal-type-guards', () => {
  const mockLocalPal: Pal = {
    type: 'local',
    id: 'local-pal-1',
    name: 'Test Local Pal',
    systemPrompt: 'You are a helpful assistant',
    isSystemPromptChanged: false,
    useAIPrompt: false,
    parameters: {},
    parameterSchema: [],
    source: 'local',
  };

  const mockNovaHubPal: NovaHubPal = {
    type: 'novahub',
    id: 'novahub-pal-1',
    title: 'Test NovaHub Pal',
    description: 'A test pal from NovaHub',
    creator: {
      id: 'creator-1',
      full_name: 'Test Creator',
      provider: '',
      created_at: '',
      updated_at: '',
    },
    protection_level: 'public',
    price_cents: 0,
    allow_fork: true,
    review_count: 0,
    is_owned: false,
    categories: [],
    tags: [],
    creator_id: '',
    created_at: '',
    updated_at: '',
  };

  describe('isLocalPal', () => {
    it('should return true for local pals', () => {
      expect(isLocalPal(mockLocalPal)).toBe(true);
    });

    it('should return false for NovaHub pals', () => {
      expect(isLocalPal(mockNovaHubPal)).toBe(false);
    });
  });

  describe('isNovaHubPal', () => {
    it('should return true for NovaHub pals', () => {
      expect(isNovaHubPal(mockNovaHubPal)).toBe(true);
    });

    it('should return false for local pals', () => {
      expect(isNovaHubPal(mockLocalPal)).toBe(false);
    });
  });

  describe('handlePalByType', () => {
    it('should call onLocalPal handler for local pals', () => {
      const handlers = {
        onLocalPal: jest.fn(),
        onNovaHubPal: jest.fn(),
      };

      handlePalByType(mockLocalPal, handlers);

      expect(handlers.onLocalPal).toHaveBeenCalledWith(mockLocalPal);
      expect(handlers.onNovaHubPal).not.toHaveBeenCalled();
    });

    it('should call onNovaHubPal handler for NovaHub pals', () => {
      const handlers = {
        onLocalPal: jest.fn(),
        onNovaHubPal: jest.fn(),
      };

      handlePalByType(mockNovaHubPal, handlers);

      expect(handlers.onNovaHubPal).toHaveBeenCalledWith(mockNovaHubPal);
      expect(handlers.onLocalPal).not.toHaveBeenCalled();
    });

    it('should log warning for unknown pal types', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const handlers = {
        onLocalPal: jest.fn(),
        onNovaHubPal: jest.fn(),
      };

      // Create a pal with invalid type
      const invalidPal = {...mockLocalPal, type: 'invalid'} as any;

      handlePalByType(invalidPal, handlers);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown pal type:', invalidPal);
      expect(handlers.onLocalPal).not.toHaveBeenCalled();
      expect(handlers.onNovaHubPal).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
