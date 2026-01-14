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
      // In a real implementation, this would verify against stored credentials
      // For demo, we'll use a simple PIN verification
      const storedPin = localStorage.getItem('xitchat_auth_pin') || '1234';
      
      if (method === 'pin' && credential === storedPin) {
        this.authSession = {
          isActive: true,
          expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
          method
        };
        return true;
      }

      // Biometric authentication would use Web Authentication API
      if (method === 'biometric') {
        // Simplified biometric check
        this.authSession = {
          isActive: true,
          expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
          method
        };
        return true;
      }

      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  // Request permission to view content
  async requestContentPermission(
    contentId: string, 
    contentType: 'message' | 'image',
    senderId?: string
  ): Promise<boolean> {
    // Check if permission already exists and is valid
    const existingPermission = this.permissions.get(contentId);
    if (existingPermission && existingPermission.expiresAt > Date.now()) {
      return true;
    }

    // Check if authentication is required
    if (this.requiresAuthentication(contentType)) {
      const authenticated = await this.showAuthDialog(contentType);
      if (!authenticated) {
        return false;
      }
    }

    // For new chats, require verification
    if (this.settings.requireVerificationForNewChats && senderId) {
      const verified = await this.verifySender(senderId);
      if (!verified) {
        return false;
      }
    }

    // Grant permission
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

    // Set auto-deletion timer if enabled
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
    
    // Clear auto-delete timer
    const timer = this.viewTimers.get(contentId);
    if (timer) {
      clearTimeout(timer);
      this.viewTimers.delete(contentId);
    }
  }

  // Show authentication dialog
  private async showAuthDialog(contentType: 'message' | 'image'): Promise<boolean> {
    return new Promise((resolve) => {
      // Create modal dialog for authentication
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-6';
      modal.innerHTML = `
        <div class="max-w-sm w-full border border-current bg-[#050505] p-6 text-center">
          <h3 class="text-lg font-bold uppercase mb-4">Authentication Required</h3>
          <p class="text-xs opacity-60 mb-6">Enter PIN to view ${contentType}</p>
          <input type="password" id="auth-pin" maxlength="4" 
                 class="w-full bg-black border border-current px-3 py-2 text-center font-mono text-lg mb-4"
                 placeholder="****" autocomplete="off">
          <div class="grid grid-cols-2 gap-2">
            <button id="auth-cancel" class="terminal-btn py-2 text-xs">Cancel</button>
            <button id="auth-submit" class="terminal-btn active py-2 text-xs">Unlock</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const pinInput = modal.querySelector('#auth-pin') as HTMLInputElement;
      const cancelBtn = modal.querySelector('#auth-cancel') as HTMLButtonElement;
      const submitBtn = modal.querySelector('#auth-submit') as HTMLButtonElement;

      const cleanup = () => {
        document.body.removeChild(modal);
      };

      const handleSubmit = async () => {
        const pin = pinInput.value;
        const success = await this.authenticate('pin', pin);
        cleanup();
        resolve(success);
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

  // Verify sender for new chats
  private async verifySender(senderId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-6';
      modal.innerHTML = `
        <div class="max-w-sm w-full border border-current bg-[#050505] p-6 text-center">
          <h3 class="text-lg font-bold uppercase mb-4">New Contact</h3>
          <p class="text-xs opacity-60 mb-6">Allow content from new contact?</p>
          <div class="grid grid-cols-2 gap-2">
            <button id="verify-deny" class="terminal-btn py-2 text-xs">Block</button>
            <button id="verify-allow" class="terminal-btn active py-2 text-xs">Allow</button>
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
      // Emit event for UI to update
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
    
    // Clear all timers
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
