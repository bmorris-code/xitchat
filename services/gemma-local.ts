// On-device Gemma inference via MediaPipe LLM Inference API (Android/iOS)
// The model is downloaded automatically on first install via GemmaSetupView.
// After the one-time download it works 100% offline — no internet needed.

/**
 * URL of the quantized Gemma model to download on first run.
 * Replace with your own CDN URL hosting the .bin file, or leave as-is
 * and direct users to download from Kaggle/HuggingFace.
 *
 * Recommended model: gemma-3-1b-it-cpu-int4.bin (~1 GB, works on all modern Android)
 * Available from: https://www.kaggle.com/models/google/gemma/tfLite
 */
export const GEMMA_MODEL_URL = ''; // Set to a hosted .bin URL to enable on-device AI

const GEMMA_SETUP_KEY = 'xitchat_gemma_setup_done';

import { Capacitor, registerPlugin } from '@capacitor/core';

// ---------------------------------------------------------------------------
// Plugin interface
// ---------------------------------------------------------------------------

interface GemmaLocalPlugin {
  initialize(options: { modelPath?: string }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    modelPath?: string;
  }>;
  generate(options: { prompt: string }): Promise<{ response: string }>;
  getStatus(): Promise<{
    isReady: boolean;
    isInitializing: boolean;
    modelPath: string | null;
    modelExists: boolean;
    defaultModelPath: string;
  }>;
  downloadModel(options: { url: string }): Promise<{ success: boolean; modelPath: string }>;
  addListener(
    event: 'downloadProgress',
    cb: (data: { progress: number; bytesDownloaded: number; totalBytes: number }) => void
  ): Promise<{ remove: () => void }>;
}

const GemmaLocal = registerPlugin<GemmaLocalPlugin>('GemmaLocal');

// ---------------------------------------------------------------------------
// Gemma chat template (matches Gemma-2 / Gemma-3 instruction format)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  `You are XitBot, the helpful and witty mascot for XitChat. ` +
  `XitChat is a modern chat application inspired by the nostalgic Mxit and BitChat. ` +
  `It features location-based discovery, mesh networking, and decentralized communication. ` +
  `Be friendly, slightly retro (using '80s and '90s slang occasionally), ` +
  `and very helpful. Keep answers concise as it's a mobile-focused chat app.`;

const buildChatPrompt = (userMessage: string): string =>
  `<start_of_turn>system\n${SYSTEM_PROMPT}<end_of_turn>\n` +
  `<start_of_turn>user\n${userMessage}<end_of_turn>\n` +
  `<start_of_turn>model\n`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _isReady = false;
let _initAttempted = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Auto-initialise the model if not yet loaded. Returns true when ready. */
export const initializeGemmaLocal = async (modelPath?: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const result = await GemmaLocal.initialize({ modelPath: modelPath ?? '' });
    _isReady = result.success;
    return result.success;
  } catch {
    return false;
  }
};

/** Returns true when the model is loaded and ready to infer. */
export const isGemmaLocalReady = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  if (_isReady) return true;

  if (!_initAttempted) {
    _initAttempted = true;
    return initializeGemmaLocal();
  }

  return false;
};

/**
 * Raw plugin status — useful for UI (show a "download model" prompt if
 * modelExists === false, or a spinner while isInitializing === true).
 */
export const getGemmaLocalStatus = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await GemmaLocal.getStatus();
  } catch {
    return null;
  }
};

/** Chat response — throws if Gemma is not ready so the caller can fall back. */
export const getXitBotResponseGemmaLocal = async (userMessage: string): Promise<string> => {
  if (!(await isGemmaLocalReady())) throw new Error('Gemma not ready');
  const { response } = await GemmaLocal.generate({ prompt: buildChatPrompt(userMessage) });
  return response.trim();
};

/**
 * Streaming-compatible wrapper (delivers the full response as a single token
 * since MediaPipe synchronous API doesn't stream yet).
 */
export const streamXitBotResponseGemmaLocal = async (
  userMessage: string,
  onToken: (token: string, fullText: string) => void
): Promise<string> => {
  const response = await getXitBotResponseGemmaLocal(userMessage);
  onToken(response, response);
  return response;
};

/** True if the model is already loaded (synchronous, no await needed). */
export const isGemmaReadySync = () => _isReady;

/**
 * Download the quantized Gemma model onto the device.
 * @param url  Direct HTTPS link to the .bin model file
 * @param onProgress  Called with 0-100 as download proceeds
 *
 * Recommended free model (~1 GB, CPU INT4):
 *   https://storage.googleapis.com/mediapipe-models/llm_inference/gemma-2-2b-it-gpu-int8/float16/1/gemma-2-2b-it-gpu-int8.bin
 * Or download from Kaggle/HuggingFace and host on your own CDN / local server.
 */
export const downloadGemmaModel = async (
  url: string,
  onProgress?: (pct: number, downloaded: number, total: number) => void
): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;

  let listener: { remove: () => void } | null = null;

  try {
    if (onProgress) {
      listener = await GemmaLocal.addListener('downloadProgress', (data) => {
        onProgress(data.progress, data.bytesDownloaded, data.totalBytes);
      });
    }

    const result = await GemmaLocal.downloadModel({ url });
    return result.success;
  } catch {
    return false;
  } finally {
    listener?.remove();
  }
};

/** Quick replies — parses pipe-delimited output from Gemma. */
export const getQuickRepliesGemmaLocal = async (lastMessage: string): Promise<string[]> => {
  if (!(await isGemmaLocalReady())) throw new Error('Gemma not ready');

  const prompt = buildChatPrompt(
    `Suggest exactly 3 very short quick replies (1–3 words each) for this message: "${lastMessage}". ` +
    `Reply with ONLY the 3 options separated by | and nothing else.`
  );

  const { response } = await GemmaLocal.generate({ prompt });
  const parts = response.split('|').map(s => s.trim()).filter(Boolean);
  return parts.length >= 3 ? parts.slice(0, 3) : ['Rad!', 'On it.', '10-4'];
};

// ---------------------------------------------------------------------------
// First-run helpers (used by GemmaSetupView + App.tsx)
// ---------------------------------------------------------------------------

/** True if the model has already been downloaded on this device. */
export const isGemmaSetupDone = () =>
  localStorage.getItem(GEMMA_SETUP_KEY) === 'true';

/** Call this once the model is downloaded + initialized successfully. */
export const markGemmaSetupDone = () =>
  localStorage.setItem(GEMMA_SETUP_KEY, 'true');
