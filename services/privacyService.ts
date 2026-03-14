
// Privacy Service - User permission controls for viewing messages and images
// All data stays local on device with user-controlled access

export interface PrivacySettings {
  requireAuthForMessages: boolean;
  requireAuthForImages: boolean;
  autoDeleteMessages: boolean; // Auto-delete after viewing
  autoDeleteImages: boolean;  // Auto-delete images after viewing
  messageViewTimeout: number; // Minutes before auto-deletion
  imageViewTimeout: number;   // Minutes before auto-deletion
  hideContentFromNotifications: boolean;
  requireVerificationForNewChats: boolean;
}

export interface ContentPermission {
  contentId: string;
  contentType: 'message' | 'image';
  grantedAt: number;
  expiresAt: number;
  requiresReauth: boolean;
}

export interface AuthSession {
  isActive: boolean;
  expiresAt: number;
  method: 'pin' | 'biometric' | 'password';
}

class PrivacyService {
  private static instance: PrivacyService;
  private settings: PrivacySettings;
  private permissions: Map<string, ContentPermission> = new Map();
  private authSession: AuthSession | null = null;
  private viewTimers: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): PrivacyService {
    if (!PrivacyService.instance) {
      PrivacyService.instance = new PrivacyService();
    }
    return PrivacyService.instance;
  }

  constructor() {
    this.settings = this.loadSettings();
    this.cleanupExpiredPermissions();
  }

  // Load privacy settings from local storage
  private loadSettings(): PrivacySettings {
    try {
      const saved = localStorage.getItem('xitchat_privacy_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load privacy settings:', error);
    }

    // Default privacy settings
    return {
      requireAuthForMessages: false,
      requireAuthForImages: true,
      autoDeleteMessages: false,
      autoDeleteImages: true,
      messageViewTimeout: 5,
      imageViewTimeout: 2,
      hideContentFromNotifications: true,
      requireVerificationForNewChats: true
    };
  }

  // Save privacy settings to local storage
  saveSettings(): void {
    try {
      localStorage.setItem('xitchat_privacy_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    }
  }

  // Update privacy settings
  updateSettings(newSettings: Partial<PrivacySettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  // Get current settings
  getSettings(): PrivacySettings {
    return { ...this.settings };
  }

  // Check if user needs to authenticate for content
  requiresAuthentication(contentType: 'message' | 'image'): boolean {
    if (this.authSession && this.authSession.isActive && Date.now() < this.authSession.expiresAt) {
      return false; // Active session
    }

    return contentType === 'message'
      ? this.settings.requireAuthForMessages
      : this.settings.requireAuthForImages;
  }

  // Authenticate user (PIN, biometric, etc.)
  async authenticate(method: 'pin' | 'biometric' | 'password', credential: string): Promise<boolean> {
    try {
      if (method === 'pin') {
        const storedPin = localStorage.getItem('xitchat_auth_pin');
        
        if (!storedPin) {
          console.warn('⚠️ No PIN set. Please set a PIN in Privacy Settings.');
          return false;
        }

        if (credential === storedPin) {
          this.authSession = {
            isActive: true,
            expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
            method
          };
          window.dispatchEvent(new CustomEvent('authSessionStarted', { detail: { method } }));
          return true;
        }
      }

      if (method === 'biometric') {
        // Biometric is currently not implemented for web. 
        // Rejects by default to prevent "Security Theater"
        console.warn('❌ Biometric authentication not yet configured for this platform.');
        return false;
      }

      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  // Set or update the PIN
  setPin(newPin: string): boolean {
    if (!newPin || newPin.length < 4) return false;
    localStorage.setItem('xitchat_auth_pin', newPin);
    return true;
  }

  // Check if a PIN has been set
  hasPin(): boolean {
    return !!localStorage.getItem('xitchat_auth_pin');
  }

  // Request permission to view content
  async requestContentPermission(
    contentId: string,
    contentType: 'message' | 'image',
    senderId?: string
  ): Promise<boolean> {
    const existingPermission = this.permissions.get(contentId);
    if (existingPermission && existingPermission.expiresAt > Date.now()) {
      return true;
    }

    if (this.requiresAuthentication(contentType)) {
      const authenticated = await this.showAuthDialog(contentType);
      if (!authenticated) {
        return false;
      }
    }

    if (this.settings.requireVerificationForNewChats && senderId) {
      const verified = await this.verifySender(senderId);
      if (!verified) {
        return false;
      }
    }

    const timeout = contentType === 'message'
      ? this.settings.messageViewTimeout
      : this.settings.imageViewTimeout;

    const permission: ContentPermission = {
      contentId,
      contentType,
      grantedAt: Date.now(),
      expiresAt: Date.now() + (timeout * 60 * 1000),
      requiresReauth: this.requiresAuthentication(contentType)
    };

    this.permissions.set(contentId, permission);

    if ((contentType === 'message' && this.settings.autoDeleteMessages) ||
      (contentType === 'image' && this.settings.autoDeleteImages)) {
      this.scheduleAutoDelete(contentId, timeout);
    }

    return true;
  }

  // Check if content can be viewed
  canViewContent(contentId: string, contentType: 'message' | 'image'): boolean {
    const permission = this.permissions.get(contentId);
    if (!permission) {
      return false;
    }

    if (permission.expiresAt <= Date.now()) {
      this.permissions.delete(contentId);
      return false;
    }

    if (permission.requiresReauth && (!this.authSession || !this.authSession.isActive)) {
      return false;
    }

    return true;
  }

  // Revoke permission for content
  revokePermission(contentId: string): void {
    this.permissions.delete(contentId);

    const timer = this.viewTimers.get(contentId);
    if (timer) {
      clearTimeout(timer);
      this.viewTimers.delete(contentId);
    }
  }

  // Show authentication dialog with Matrix styling
  private async showAuthDialog(contentType: 'message' | 'image'): Promise<boolean> {
    const hasPin = this.hasPin();

    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-[400] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300';
      modal.innerHTML = `
        <div class="max-w-sm w-full border-2 border-[#00ff41] bg-[#050505] p-8 shadow-[0_0_50px_rgba(0,255,65,0.2)] relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-b from-[#00ff41]/5 to-transparent pointer-events-none"></div>
          <div class="relative z-10">
            <h3 class="text-xl font-black uppercase tracking-[0.2em] mb-6 text-center glow-text">
              ${hasPin ? 'auth_required.exe' : 'no_pin_detected.exe'}
            </h3>
            <p class="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-8 text-center px-4">
              ${hasPin ? `Secure access to ${contentType} payload requires PIN verification.` : `Critical: No security PIN has been established. You must set a PIN in Settings.`}
            </p>
            ${hasPin ? `
              <input type="password" id="auth-pin" maxlength="4" 
                     class="w-full bg-black border border-[#00ff41] border-opacity-30 px-4 py-4 text-center font-mono text-2xl mb-8 text-[#00ff41] outline-none focus:border-opacity-100 transition-all"
                     placeholder="****" autocomplete="off">
            ` : `
              <div class="p-6 border border-dashed border-amber-500/30 text-amber-500 text-[10px] uppercase font-bold text-center mb-8">
                UNPROTECTED_TRANSMISSION
              </div>
            `}
            <div class="grid grid-cols-2 gap-4">
              <button id="auth-cancel" class="terminal-btn py-3 text-[10px] uppercase font-bold">abort</button>
              <button id="auth-submit" class="terminal-btn active py-3 text-[10px] uppercase font-bold">
                ${hasPin ? 'unlock' : 'settings'}
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const pinInput = modal.querySelector('#auth-pin') as HTMLInputElement;
      const cancelBtn = modal.querySelector('#auth-cancel') as HTMLButtonElement;
      const submitBtn = modal.querySelector('#auth-submit') as HTMLButtonElement;

      if (pinInput) pinInput.focus();

      const cleanup = () => {
        if (pinInput) pinInput.value = ''; // Security: clear PIN from DOM
        document.body.removeChild(modal);
      };

      const handleSubmit = async () => {
        if (!hasPin) {
          // Redirect or signal to open settings
          window.dispatchEvent(new CustomEvent('open-settings'));
          cleanup();
          resolve(false);
          return;
        }

        const pin = pinInput.value;
        const success = await this.authenticate('pin', pin);
        if (success) {
          cleanup();
          resolve(true);
        } else {
          pinInput.value = '';
          pinInput.classList.add('border-red-500');
          setTimeout(() => pinInput.classList.remove('border-red-500'), 500);
        }
      };

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      submitBtn.addEventListener('click', handleSubmit);
      pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSubmit();
        }
      });

      pinInput.focus();
    });
  }

  // Verify sender for new chats with Matrix styling
  private async verifySender(senderId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-[400] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300';
      modal.innerHTML = `
        <div class="max-w-sm w-full border-2 border-amber-500 bg-[#050505] p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none"></div>
          <div class="relative z-10">
            <h3 class="text-xl font-black uppercase tracking-[0.2em] mb-6 text-center text-amber-500">unverified_node.exe</h3>
            <p class="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-8 text-center">
              Incoming transmission from unverified node: ${senderId.substring(0, 12)}...
            </p>
            <div class="grid grid-cols-2 gap-4">
              <button id="verify-deny" class="terminal-btn py-3 text-[10px] uppercase font-bold border-red-500 text-red-500">block_node</button>
              <button id="verify-allow" class="terminal-btn active py-3 text-[10px] uppercase font-bold bg-amber-500 border-amber-500">allow_uplink</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const cleanup = () => {
        document.body.removeChild(modal);
      };

      modal.querySelector('#verify-deny')?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      modal.querySelector('#verify-allow')?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
    });
  }

  // Schedule auto-deletion of content
  private scheduleAutoDelete(contentId: string, timeoutMinutes: number): void {
    const timer = setTimeout(() => {
      this.revokePermission(contentId);
      window.dispatchEvent(new CustomEvent('contentAutoDeleted', { detail: { contentId } }));
    }, timeoutMinutes * 60 * 1000);

    this.viewTimers.set(contentId, timer);
  }

  // Clean up expired permissions
  private cleanupExpiredPermissions(): void {
    const now = Date.now();
    for (const [contentId, permission] of this.permissions.entries()) {
      if (permission.expiresAt <= now) {
        this.permissions.delete(contentId);
      }
    }
  }

  // Clear all permissions and auth sessions
  clearAllPermissions(): void {
    this.permissions.clear();
    this.authSession = null;
    for (const timer of this.viewTimers.values()) {
      clearTimeout(timer);
    }
    this.viewTimers.clear();
  }

  // Get active auth session info
  getAuthSession(): AuthSession | null {
    if (!this.authSession || this.authSession.expiresAt <= Date.now()) {
      this.authSession = null;
    }
    return this.authSession ? { ...this.authSession } : null;
  }

  // Logout (clear auth session)
  logout(): void {
    this.authSession = null;
    window.dispatchEvent(new CustomEvent('authSessionEnded'));
  }
}

export const privacyService = PrivacyService.getInstance();
