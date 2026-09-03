import DeviceInfo from 'react-native-device-info';

/**
 * User-Agent for outbound Hugging Face requests (API + model downloads).
 * The `(ai.novamind)` token is a fixed attribution key on both platforms.
 */
export const hfUserAgent = (): string =>
  `NovaMind/${DeviceInfo.getVersion()} (ai.novamind)`;
