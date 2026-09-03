/**
 * PalStore - Dynamic Parameter Pal Store
 *
 * This is the new pal store that replaces the legacy PalStore with a flexible,
 * schema-driven approach that supports dynamic parameters and custom pal types.
 *
 * KEY FEATURES:
 * - Dynamic parameter schemas: Create pals with any custom parameters
 * - Unified UI: Single PalSheet component works for all pal types
 * - NovaHub integration: Support for marketplace pals with custom parameters
 * - Extensible: Easy to add new parameter types (text, select, datetime_tag)
 * - Migration: Automatically migrates data from legacy PalStore on startup
 *
 * @see src/types/pal.ts for type definitions
 * @see src/utils/pal-migration.ts for migration utilities
 * @see src/components/PalsSheets/PalSheet.tsx for unified UI component
 */

import {v4 as uuidv4} from 'uuid';
import {makeAutoObservable, runInAction} from 'mobx';
import {Platform} from 'react-native';

import {HF_DOMAIN} from '../config/urls';

import {palRepository} from '../repositories/PalRepository';

import {hfAsModel} from '../utils';
import {resolveHFModelForDownload} from '../utils/hfResolve';
import {isUSStorefront} from '../utils/region';
import NativeExternalContentLink from '../specs/NativeExternalContentLink';
import {novaHubService} from '../services';
import {registerDefaultTalents} from '../services/talents';
import {LOOKIE_DEFAULT_MODEL} from './builtinPalModels';
import {chatTemplates} from '../utils/chat';
import {defaultCompletionParams} from '../utils/completionSettingsVersions';
import {parseNovaHubTemplate} from '../utils/novahub-template-parser';
import {getDisplayNameFromFilename} from '../utils/formatters';

import type {Pal, ParameterDefinition} from '../types/pal';
import type {
  ModelReference,
  NovaHubPal,
  SearchFilters,
  SyncState,
} from '../types/novahub';

import {ModelOrigin} from '../utils/types';
import type {Model} from '../utils/types';
import {downloadPalThumbnail, deletePalThumbnail} from '../utils/imageUtils';

class PalStore {
  // Core pals storage
  pals: Pal[] = [];

  // NovaHub integration state
  cachedNovaHubPals: NovaHubPal[] = [];
  userLibrary: NovaHubPal[] = [];
  userCreatedPals: NovaHubPal[] = [];
  isLoadingNovaHub: boolean = false;
  searchFilters: SearchFilters = {};
  syncState: SyncState = {status: 'idle'};

  // Checkout eligibility state
  isCheckoutEligible: boolean = false;

  // Migration state
  isMigrating: boolean = false;
  migrationComplete: boolean = false;
  migrationVersion: string = '1.0';

  constructor() {
    makeAutoObservable(this);
    this.initialize();
    console.log('Pal store initialized');
    console.log('Pals number: ', this.pals.length);
  }

  async initialize() {
    try {
      runInAction(() => {
        this.isMigrating = true;
      });

      // Migrate from JSON/AsyncStorage to database
      await palRepository.checkAndMigrateFromJSON();

      // Load pals from database
      await this.loadPalsFromDatabase();

      // Initialize Lookie pal after database is loaded
      await this.initializeLookiePal();

      // Initialize Pip pal (idempotent — see initializePipPal).
      await this.initializePipPal();

      // Register talent engines (idempotent)
      registerDefaultTalents();

      // Check checkout eligibility for buy button gating
      this.checkCheckoutEligibility();

      console.log('Pal store initialization completed');

      runInAction(() => {
        this.isMigrating = false;
        this.migrationComplete = true;
      });
    } catch (error) {
      console.error('Failed to initialize pal store:', error);
      runInAction(() => {
        this.isMigrating = false;
        this.migrationComplete = false;
      });
    }
  }

  private async checkCheckoutEligibility() {
    // E2E builds have no App Store storefront, so force eligibility to
    // exercise the buy button. Compiled out of prod (`__E2E__` is false).
    if (__E2E__) {
      runInAction(() => {
        this.isCheckoutEligible = true;
      });
      return;
    }

    try {
      // Gate on real purchase eligibility per platform, not device locale:
      // Android queries Play EXTERNAL_CONTENT_LINK availability; iOS keeps the
      // StoreKit storefront signal. A null Android module or a thrown probe
      // leaves the flag false (fail-closed → info-text fallback).
      const eligible =
        Platform.OS === 'android'
          ? await NativeExternalContentLink?.isExternalContentLinkAvailable()
          : await isUSStorefront();
      runInAction(() => {
        this.isCheckoutEligible = eligible === true;
      });
    } catch (error) {
      console.warn('Failed to check checkout eligibility:', error);
      runInAction(() => {
        this.isCheckoutEligible = false;
      });
    }
  }

  /**
   * Load pals from database into MobX store
   */
  private async loadPalsFromDatabase() {
    try {
      const pals = await palRepository.getAllPals();
      runInAction(() => {
        this.pals = pals;
      });
    } catch (error) {
      console.error('Error loading pals from database:', error);
    }
  }

  // Core unified pal management methods

  /**
   * Adds a pal to both repository and store (handles persistence + state)
   * This is the ONLY method that should handle repository + store updates
   */
  private addPal = async (
    palData: Omit<Pal, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Pal> => {
    const savedPal = await palRepository.createPal(palData);

    runInAction(() => {
      this.pals.push(savedPal);
    });

    return savedPal;
  };

  /**
   * Creates a new pal
   */
  createPal = async (
    palData: Omit<Pal, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Pal> => {
    return this.addPal(palData);
  };

  /**
   * Updates an existing pal
   */
  updatePal = async (id: string, updates: Partial<Pal>): Promise<void> => {
    try {
      const updatedPal = await palRepository.updatePal(id, updates);
      if (updatedPal) {
        runInAction(() => {
          const palIndex = this.pals.findIndex(p => p.id === id);
          if (palIndex !== -1) {
            this.pals[palIndex] = updatedPal;
          }
        });
      } else {
        throw new Error('Failed to update pal - no updated pal returned');
      }
    } catch (error) {
      console.error('Error updating pal:', error);
      throw error; // Re-throw so calling code can handle it
    }
  };

  /**
   * Deletes a pal
   */
  deletePal = async (id: string): Promise<void> => {
    try {
      // Find the pal to get its thumbnail path before deletion
      const palIndex = this.pals.findIndex(p => p.id === id);
      const pal = palIndex !== -1 ? this.pals[palIndex] : null;

      const success = await palRepository.deletePal(id);
      if (success) {
        // Clean up local thumbnail image if it exists
        if (pal?.thumbnail_url) {
          try {
            await deletePalThumbnail(pal.thumbnail_url);
          } catch (imageError) {
            console.warn('Failed to delete thumbnail image:', imageError);
            // Don't fail the entire deletion if image cleanup fails
          }
        }

        runInAction(() => {
          if (palIndex !== -1) {
            this.pals.splice(palIndex, 1);
          }
        });
      }
    } catch (error) {
      console.error('Error deleting pal:', error);
    }
  };

  /**
   * Gets all pals
   */
  getPals = (): Pal[] => {
    return this.pals;
  };

  /**
   * Gets a pal by ID
   */
  getPalById = (id: string): Pal | undefined => {
    return this.pals.find(p => p.id === id);
  };

  // NovaHub integration methods

  /**
   * Downloads a NovaHub pal and converts it to unified format
   */
  downloadNovaHubPal = async (novaHubPal: NovaHubPal): Promise<Pal> => {
    try {
      // For free pals, allow direct download without ownership check
      // For premium pals, check ownership first
      if (novaHubPal.price_cents > 0) {
        const ownership = await novaHubService.checkPalOwnership(novaHubPal.id);
        if (!ownership.owned) {
          throw new Error('You must own this Pal to download it');
        }
      }

      // Convert NovaHub pal to local format
      const pal = await this.createLocalPalFromNovaHub(novaHubPal);
      let relativeThumbnailPath: string | null = null;

      // Download thumbnail image if available
      if (novaHubPal.thumbnail_url) {
        try {
          console.log('Downloading thumbnail for pal:', pal.name);
          relativeThumbnailPath = await downloadPalThumbnail(
            pal.id,
            novaHubPal.thumbnail_url,
          );

          // Update the pal with the relative path (no file:// protocol)
          pal.thumbnail_url = relativeThumbnailPath;
          console.log(
            'Thumbnail downloaded successfully:',
            relativeThumbnailPath,
          );
        } catch (imageError) {
          console.warn(
            'Failed to download thumbnail, keeping remote URL:',
            imageError,
          );
          // Keep the original remote URL as fallback
          pal.thumbnail_url = novaHubPal.thumbnail_url;
        }
      }

      try {
        // Persist the pal to the database and add to store
        return await this.addPal(pal);
      } catch (dbError) {
        // If database save fails, clean up the downloaded image
        if (relativeThumbnailPath) {
          try {
            await deletePalThumbnail(relativeThumbnailPath);
            console.log(
              'Cleaned up thumbnail after database error:',
              relativeThumbnailPath,
            );
          } catch (cleanupError) {
            console.warn(
              'Failed to cleanup thumbnail after database error:',
              cleanupError,
            );
          }
        }
        throw dbError;
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Creates a Model object from NovaHub ModelReference with complete HF metadata
   */
  private createLocalModelFromPHModel = async (
    modelRef: ModelReference,
  ): Promise<Model> => {
    try {
      // Resolve via the shared canonical chain so the matched file carries a
      // populated /resolve/ download URL. modelRef values relax strictness when
      // the HF API response is incomplete (the NovaHub flow already has them).
      const {hfModel, modelFile} = await resolveHFModelForDownload(
        modelRef.repo_id,
        modelRef.filename,
        undefined,
        {
          author: modelRef.author,
          size: modelRef.size,
          downloadUrl: modelRef.downloadUrl,
        },
      );

      // Use the existing hfAsModel function to create a complete Model object
      return hfAsModel(hfModel, modelFile);
    } catch (error) {
      console.error('Failed to fetch complete model data from HF API:', error);

      // Fallback: create basic model with available data
      return this.createBasicModelFromReference(modelRef);
    }
  };

  /**
   * Creates a basic Model object from ModelReference (fallback when HF API fails)
   */
  private createBasicModelFromReference = (modelRef: any): Model => {
    // Extract model name from filename (remove .gguf extension)
    const modelName = getDisplayNameFromFilename(modelRef.filename);

    // Degraded fallback path: use the generic default chat template and
    // completion params (the GGUF-embedded template is applied at load time).
    const chatTemplate = {...chatTemplates.default};
    const completionSettings = {...defaultCompletionParams};
    const stopWords = completionSettings.stop ?? [];

    return {
      id: `${modelRef.repo_id}/${modelRef.filename}`,
      author: modelRef.author,
      name: modelName,
      size: modelRef.size,
      params: 0, // Will be fetched from HF API if needed
      isDownloaded: false,
      downloadUrl: modelRef.downloadUrl,
      hfUrl: `${HF_DOMAIN}/${modelRef.repo_id}`,
      progress: 0,
      filename: modelRef.filename,
      isLocal: false,
      origin: ModelOrigin.HF,
      defaultChatTemplate: {...chatTemplate},
      chatTemplate: {...chatTemplate},
      defaultCompletionSettings: {...completionSettings},
      completionSettings: {...completionSettings},
      defaultStopWords: [...stopWords],
      stopWords: [...stopWords],
    };
  };

  /**
   * Converts a NovaHub pal to local pal format
   */
  private createLocalPalFromNovaHub = async (
    novaHubPal: NovaHubPal,
  ): Promise<Pal> => {
    let parameterSchema: ParameterDefinition[] = [];
    let parameters: Record<string, any> = {};
    let systemPrompt = novaHubPal.system_prompt || '';

    // Parse system_prompt to extract parameter schema and default values
    // Parameters are embedded within the system_prompt field using Mustache templating
    // with JSON schema comments
    let originalSystemPrompt: string | undefined;
    if (systemPrompt && this.isTemplatedSystemPrompt(systemPrompt)) {
      // Parse the templated system prompt
      const parsed = parseNovaHubTemplate(systemPrompt);
      // CRITICAL: Preserve the original template for future editing
      originalSystemPrompt = systemPrompt;
      // Use the clean template with placeholders for the systemPrompt field
      systemPrompt = parsed.cleanSystemPrompt;
      parameterSchema = parsed.parameterSchema;
      parameters = parsed.defaultParameters;
    }
    // If no template found, use empty schema/parameters (assistant-style pal)

    // Convert NovaHub model_reference to Model object if available
    const defaultModel = novaHubPal.model_reference
      ? await this.createLocalModelFromPHModel(novaHubPal.model_reference)
      : undefined;

    // Strict-`=== true` so stringly-typed `required` becomes optional.
    // Drop talents that aren't objects with a non-empty string name.
    const wireTalents = novaHubPal.pact?.talents;
    const validTalents = Array.isArray(wireTalents)
      ? wireTalents.filter(
          t =>
            t != null &&
            typeof t === 'object' &&
            typeof t.name === 'string' &&
            t.name.length > 0,
        )
      : [];
    const pact =
      validTalents.length > 0
        ? {
            talents: validTalents.map(t => ({
              name: t.name,
              necessity: (t.required === true ? 'required' : 'optional') as
                | 'required'
                | 'optional',
            })),
          }
        : undefined;

    const wireGreeting = novaHubPal.greeting;
    const wireText = wireGreeting?.text;
    const wirePrompts = wireGreeting?.suggested_prompts;
    const validPrompts = Array.isArray(wirePrompts)
      ? wirePrompts.filter(
          (p): p is string => typeof p === 'string' && p.length > 0,
        )
      : [];
    const hasText = typeof wireText === 'string' && wireText.length > 0;
    const hasPrompts = validPrompts.length > 0;
    const greeting =
      hasText || hasPrompts
        ? {
            text: typeof wireText === 'string' ? wireText : '',
            ...(hasPrompts ? {suggestedPrompts: validPrompts} : {}),
          }
        : undefined;

    return {
      type: 'local',
      id: uuidv4(),
      name: novaHubPal.title,
      description: novaHubPal.description,
      thumbnail_url: novaHubPal.thumbnail_url,
      systemPrompt,
      originalSystemPrompt, // Preserve the original template for editing
      isSystemPromptChanged: false,
      useAIPrompt: false,
      defaultModel,
      parameters,
      parameterSchema,
      ...(pact ? {pact} : {}),
      ...(greeting ? {greeting} : {}),
      source: 'novahub',
      novahub_id: novaHubPal.id,
      creator_info: {
        id: novaHubPal.creator_id,
        name: novaHubPal.creator?.display_name,
        avatar_url: novaHubPal.creator?.avatar_url,
      },
      categories: novaHubPal.categories?.map((c: any) => c.name) || [],
      tags: novaHubPal.tags?.map((t: any) => t.name) || [],
      rating: novaHubPal.average_rating,
      review_count: novaHubPal.review_count,
      protection_level: novaHubPal.protection_level,
      price_cents: novaHubPal.price_cents,
      is_owned: true,
      rawNovahubGenerationSettings: novaHubPal.model_settings,
      created_at: novaHubPal.created_at,
      updated_at: novaHubPal.updated_at,
    };
  };

  /**
   * Checks if a system prompt contains parameter template definitions
   * Parameters are embedded within the system_prompt field using Mustache templating
   * with JSON schema comments
   */
  private isTemplatedSystemPrompt = (systemPrompt: string): boolean => {
    // Check for Mustache JSON schema pattern
    const mustacheSchemaPattern =
      /\{\{!\s*json-schema-start\s*[\s\S]*?\s*json-schema-end\s*\}\}/;

    return mustacheSchemaPattern.test(systemPrompt);
  };

  // NovaHub methods
  searchNovaHubPals = async (filters: any = {}) => {
    try {
      runInAction(() => {
        this.isLoadingNovaHub = true;
        this.syncState = {status: 'syncing'};
      });

      const response = await novaHubService.getPals(filters);

      runInAction(() => {
        this.cachedNovaHubPals = response.pals;
        this.isLoadingNovaHub = false;
        this.syncState = {status: 'success'};
      });

      return response;
    } catch (error) {
      console.warn(
        'NovaHub search failed (this is expected if not configured):',
        error,
      );
      runInAction(() => {
        this.cachedNovaHubPals = []; // Set empty array instead of failing
        this.isLoadingNovaHub = false;
        this.syncState = {status: 'success'}; // Don't show error state for missing config
      });

      // Return empty response instead of throwing
      return {
        pals: [],
        total_count: 0,
        page: 1,
        limit: filters.limit || 20,
        has_more: false,
      };
    }
  };

  loadUserLibrary = async () => {
    try {
      runInAction(() => {
        this.isLoadingNovaHub = true;
        this.syncState = {status: 'syncing'};
      });

      const response = await novaHubService.getLibrary();

      runInAction(() => {
        this.userLibrary = response.pals;
        this.isLoadingNovaHub = false;
        this.syncState = {status: 'success'};
      });

      return response;
    } catch (error) {
      console.warn(
        'User library load failed (this is expected if not configured):',
        error,
      );
      runInAction(() => {
        this.userLibrary = []; // Set empty array instead of failing
        this.isLoadingNovaHub = false;
        this.syncState = {status: 'success'}; // Don't show error state for missing config
      });

      // Return empty response instead of throwing
      return {
        pals: [],
        total_count: 0,
        page: 1,
        limit: 20,
        has_more: false,
      };
    }
  };

  loadUserCreatedPals = async () => {
    try {
      runInAction(() => {
        this.isLoadingNovaHub = true;
        this.syncState = {status: 'syncing'};
      });

      const response = await novaHubService.getMyPals();

      runInAction(() => {
        this.userCreatedPals = response.pals;
        this.isLoadingNovaHub = false;
        this.syncState = {status: 'success'};
      });

      return response;
    } catch (error) {
      console.warn(
        'User created pals load failed (this is expected if not configured):',
        error,
      );
      runInAction(() => {
        this.userCreatedPals = []; // Set empty array instead of failing
        this.isLoadingNovaHub = false;
        this.syncState = {status: 'success'}; // Don't show error state for missing config
      });

      // Return empty response instead of throwing
      return {
        pals: [],
        total_count: 0,
        page: 1,
        limit: 20,
        has_more: false,
      };
    }
  };

  getLocalPals = () => {
    return this.pals.filter(pal => pal.source === 'local' || !pal.source);
  };

  getDownloadedNovaHubPals = () => {
    return this.pals.filter(pal => pal.source === 'novahub');
  };

  // Capability-based filtering methods
  getVideoPals = () => {
    return this.pals.filter(pal => pal.capabilities?.video === true);
  };

  getAllPals = () => {
    return this.pals;
  };

  isNovaHubPalDownloaded = (novaHubId: string) => {
    return this.pals.some(pal => pal.novahub_id === novaHubId);
  };

  // Additional helper methods for NovaHub integration

  /**
   * Get categories from NovaHub
   */
  getCategories = async () => {
    try {
      return await novaHubService.getCategories();
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error;
    }
  };

  /**
   * Get tags from NovaHub
   */
  getTags = async (query?: any) => {
    try {
      return await novaHubService.getTags(query);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      throw error;
    }
  };

  /**
   * Get a specific pal from NovaHub
   */
  getNovaHubPal = async (id: string) => {
    try {
      return await novaHubService.getPal(id);
    } catch (error) {
      console.error('Failed to fetch pal:', error);
      throw error;
    }
  };

  /**
   * Check if user owns a specific pal
   */
  checkPalOwnership = async (palId: string) => {
    try {
      return await novaHubService.checkPalOwnership(palId);
    } catch (error) {
      console.error('Failed to check pal ownership:', error);
      throw error;
    }
  };

  /**
   * Initialize the default "Lookie" VideoPal if it doesn't exist
   */
  private async initializeLookiePal(): Promise<void> {
    try {
      // Check if Lookie already exists
      const lookiePal = this.pals.find(
        p => p.capabilities?.video === true && p.name === 'Lookie',
      );

      if (!lookiePal) {
        console.log('Creating default Lookie pal...');

        // Offline constant — no network resolve at pal init.
        const defaultModel = LOOKIE_DEFAULT_MODEL;

        // Create the Lookie pal with all the original properties
        const palData: Omit<Pal, 'id' | 'created_at' | 'updated_at'> = {
          type: 'local',
          name: 'Lookie',
          description:
            'Real-time video analysis assistant that provides concise descriptions of your camera feed.',
          systemPrompt:
            'You are Lookie, an AI assistant giving real-time, concise descriptions of a video feed. Use few words. If unsure, say so clearly.',
          isSystemPromptChanged: false,
          useAIPrompt: false,
          defaultModel: defaultModel, // Set the default model so users know what to download
          parameters: {
            captureInterval: '3000', // 3 seconds (original value) - stored as string for text input
          },
          parameterSchema: [
            {
              key: 'captureInterval',
              type: 'text',
              label: 'Capture Interval (ms)',
              required: false,
            },
          ],
          capabilities: {video: true},
          color: ['#9E204F', '#F6E1EA'], // Original Lookie colors
          source: 'local',
        };

        await this.addPal(palData);
      } else {
        console.log('Lookie pal already exists, skipping creation');
      }
    } catch (error) {
      console.error('Error initializing Lookie pal:', error);
    }
  }

  /**
   * Initialize the default "Pip" recommended pal if it doesn't exist.
   *
   * Idempotent: a re-entry never overwrites an existing Pip record, so a
   * `defaultModel` bound from a prior session (e.g. by the onboarding
   * recommended-pal picker) survives subsequent app starts.
   */
  private async initializePipPal(): Promise<void> {
    try {
      const existing = this.pals.find(
        p => p.name === 'Pip' && p.source === 'local',
      );
      if (existing) {
        return;
      }

      const palData: Omit<Pal, 'id' | 'created_at' | 'updated_at'> = {
        type: 'local',
        name: 'Pip',
        description:
          'A friendly general-purpose pal that runs entirely on your phone.',
        systemPrompt:
          'You are Pip, a friendly and helpful assistant who runs locally on the user’s phone. Keep replies concise and warm.',
        isSystemPromptChanged: false,
        useAIPrompt: false,
        defaultModel: undefined,
        parameters: {},
        parameterSchema: [],
        capabilities: {},
        color: ['#0E0D0C', '#FAFAFA'],
        source: 'local',
      };

      await this.addPal(palData);
    } catch (error) {
      console.error('Error initializing Pip pal:', error);
    }
  }
}

export const palStore = new PalStore();

// Export types for external use
export type {Pal} from '../types/pal';
export type {LegacyPalData} from '../utils/pal-migration';
