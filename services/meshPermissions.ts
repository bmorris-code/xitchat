import { bluetoothMesh, MeshNode } from './bluetoothMesh';
import { nostrService } from './nostrService';

export interface UserPermissions {
  nodeId: string;
  handle: string;
  grantedPermissions: {
    profileView: boolean;      // Can see my profile
    chatAccess: boolean;       // Can chat with me
    marketplaceView: boolean;  // Can see my marketplace listings
    proximityData: boolean;   // Can see my proximity/location
    nodeStatus: boolean;       // Can see if I'm online
  };
  lastUpdated: number;
}

export interface PermissionRequest {
  id: string;
  fromNode: string;
  toNode: string;
  requestedPermissions: string[];
  message: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  expiresAt: number;
}

class MeshPermissionsService {
  private myPermissions: UserPermissions;
  private grantedToOthers: Map<string, UserPermissions> = new Map();
  private receivedRequests: PermissionRequest[] = [];
  private sentRequests: PermissionRequest[] = [];
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  constructor() {
    this.initializePermissions();
    this.loadPermissions();
    this.subscribeToNostrSignals();
  }

  private subscribeToNostrSignals() {
    // Listen for permission requests via Nostr
    nostrService.subscribe('messageReceived', (message) => {
      try {
        const data = JSON.parse(message.content);
        if (data.type === 'permission_request') {
          this.handlePermissionRequest(data.payload);
        } else if (data.type === 'permission_approved') {
          this.handlePermissionApproved(data.payload);
        } else if (data.type === 'permission_denied') {
          this.handlePermissionDenied(data.payload);
        }
      } catch (e) {
        // Not a permission message
      }
    });
  }

  private initializePermissions() {
    // Default permissions for current user
    this.myPermissions = {
      nodeId: nostrService.getPublicKey() || 'me',
      handle: localStorage.getItem('xitchat_handle') || '@symbolic', // Current user handle
      grantedPermissions: {
        profileView: true,      // Everyone can see basic profile
        chatAccess: false,     // Must grant chat access
        marketplaceView: true, // Everyone can see marketplace
        proximityData: false,  // Must grant proximity access
        nodeStatus: true       // Everyone can see online status
      },
      lastUpdated: Date.now()
    };
  }

  private loadPermissions() {
    try {
      const saved = localStorage.getItem('mesh_permissions');
      if (saved) {
        const data = JSON.parse(saved);
        this.myPermissions = data.myPermissions || this.myPermissions;
        this.grantedToOthers = new Map(data.grantedToOthers || []);
        this.receivedRequests = data.receivedRequests || [];
        this.sentRequests = data.sentRequests || [];
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  }

  private savePermissions() {
    localStorage.setItem('mesh_permissions', JSON.stringify({
      myPermissions: this.myPermissions,
      grantedToOthers: Array.from(this.grantedToOthers.entries()),
      receivedRequests: this.receivedRequests,
      sentRequests: this.sentRequests
    }));
  }

  // PERMISSION MANAGEMENT
  updateMyPermissions(permissions: Partial<UserPermissions['grantedPermissions']>) {
    this.myPermissions.grantedPermissions = {
      ...this.myPermissions.grantedPermissions,
      ...permissions
    };
    this.myPermissions.lastUpdated = Date.now();
    this.savePermissions();
    this.broadcastPermissionUpdate();
    this.notifyListeners('permissionsUpdated', this.myPermissions);
  }

  private broadcastPermissionUpdate() {
    const message = {
      type: 'permission_update',
      payload: this.myPermissions,
      timestamp: Date.now()
    };

    // 1. Broadcast to local mesh
    const peers = bluetoothMesh.getPeers();
    for (const peer of peers) {
      bluetoothMesh.sendMessage(peer.id, JSON.stringify(message));
    }

    // 2. Broadcast to Nostr (cross-device sync)
    nostrService.broadcastMessage(JSON.stringify(message));
  }

  // GRANT PERMISSIONS TO SPECIFIC USER
  grantPermissionsToUser(nodeId: string, handle: string, permissions: UserPermissions['grantedPermissions']) {
    const userPermission: UserPermissions = {
      nodeId,
      handle,
      grantedPermissions: permissions,
      lastUpdated: Date.now()
    };

    this.grantedToOthers.set(nodeId, userPermission);
    this.savePermissions();
    this.notifyListeners('permissionsGranted', userPermission);

    // Send permission confirmation to user
    const confirmation = {
      type: 'permission_granted',
      payload: {
        fromNode: 'me',
        toNode: nodeId,
        permissions
      },
      timestamp: Date.now()
    };
    // 1. Send via local mesh
    bluetoothMesh.sendMessage(nodeId, JSON.stringify(confirmation));

    // 2. Send via Nostr (if it's a Nostr pubkey)
    if (nodeId.length === 64) {
      nostrService.sendDirectMessage(nodeId, JSON.stringify(confirmation));
    }
  }

  // REQUEST PERMISSIONS FROM USER
  async requestPermissions(nodeId: string, handle: string, requestedPermissions: string[], message: string): Promise<string> {
    const requestId = `perm_${Date.now()}`;

    const request: PermissionRequest = {
      id: requestId,
      fromNode: 'me',
      toNode: nodeId,
      requestedPermissions,
      message,
      timestamp: Date.now(),
      status: 'pending',
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    this.sentRequests.push(request);

    // Send permission request via mesh
    const meshMessage = {
      type: 'permission_request',
      payload: request
    };

    // 1. Send via local mesh
    await bluetoothMesh.sendMessage(nodeId, JSON.stringify(meshMessage));

    // 2. Send via Nostr (if it's a Nostr pubkey)
    if (nodeId.length === 64) {
      await nostrService.sendDirectMessage(nodeId, JSON.stringify(meshMessage));
    }

    this.savePermissions();
    this.notifyListeners('permissionRequestSent', request);

    return requestId;
  }

  private handlePermissionApproved(payload: any) {
    const request = this.sentRequests.find(r => r.id === payload.requestId);
    if (request) {
      request.status = 'approved';
      this.savePermissions();
      this.notifyListeners('permissionRequestApproved', request);
    }
  }

  private handlePermissionDenied(payload: any) {
    const request = this.sentRequests.find(r => r.id === payload.requestId);
    if (request) {
      request.status = 'denied';
      this.savePermissions();
      this.notifyListeners('permissionRequestDenied', request);
    }
  }

  // HANDLE INCOMING PERMISSION REQUEST
  handlePermissionRequest(request: PermissionRequest): 'approve' | 'deny' {
    // Add to received requests
    this.receivedRequests.push(request);
    this.savePermissions();
    this.notifyListeners('permissionRequestReceived', request);

    // Auto-deny if user hasn't explicitly approved
    return 'deny';
  }

  // APPROVE PERMISSION REQUEST
  approvePermissionRequest(requestId: string, grantedPermissions: string[]) {
    const request = this.receivedRequests.find(r => r.id === requestId);
    if (!request) return;

    request.status = 'approved';

    // Grant permissions to requesting user
    const permissions: UserPermissions['grantedPermissions'] = {
      profileView: grantedPermissions.includes('profileView'),
      chatAccess: grantedPermissions.includes('chatAccess'),
      marketplaceView: grantedPermissions.includes('marketplaceView'),
      proximityData: grantedPermissions.includes('proximityData'),
      nodeStatus: grantedPermissions.includes('nodeStatus')
    };

    this.grantPermissionsToUser(request.fromNode, '', permissions);

    // Send approval confirmation
    const approval = {
      type: 'permission_approved',
      payload: {
        requestId,
        fromNode: 'me',
        toNode: request.fromNode,
        grantedPermissions
      },
      timestamp: Date.now()
    };
    bluetoothMesh.sendMessage(request.fromNode, JSON.stringify(approval));
  }

  // DENY PERMISSION REQUEST
  denyPermissionRequest(requestId: string) {
    const request = this.receivedRequests.find(r => r.id === requestId);
    if (!request) return;

    request.status = 'denied';

    // Send denial
    const denial = {
      type: 'permission_denied',
      payload: {
        requestId,
        fromNode: 'me',
        toNode: request.fromNode
      },
      timestamp: Date.now()
    };
    bluetoothMesh.sendMessage(request.fromNode, JSON.stringify(denial));

    this.savePermissions();
    this.notifyListeners('permissionRequestDenied', request);
  }

  // PERMISSION CHECKS
  canViewProfile(nodeId: string): boolean {
    if (nodeId === 'me') return true; // Can always view own profile

    const userPermission = this.grantedToOthers.get(nodeId);
    return userPermission?.grantedPermissions.profileView || false;
  }

  canChatWith(nodeId: string): boolean {
    if (nodeId === 'me') return true;

    const userPermission = this.grantedToOthers.get(nodeId);
    return userPermission?.grantedPermissions.chatAccess || false;
  }

  canViewMarketplace(nodeId: string): boolean {
    if (nodeId === 'me') return true;

    const userPermission = this.grantedToOthers.get(nodeId);
    return userPermission?.grantedPermissions.marketplaceView || false;
  }

  canViewProximity(nodeId: string): boolean {
    if (nodeId === 'me') return true;

    const userPermission = this.grantedToOthers.get(nodeId);
    return userPermission?.grantedPermissions.proximityData || false;
  }

  canViewNodeStatus(nodeId: string): boolean {
    if (nodeId === 'me') return true;

    const userPermission = this.grantedToOthers.get(nodeId);
    return userPermission?.grantedPermissions.nodeStatus || false;
  }

  // GETTERS
  getMyPermissions(): UserPermissions {
    return this.myPermissions;
  }

  getGrantedPermissions(): UserPermissions[] {
    return Array.from(this.grantedToOthers.values());
  }

  getReceivedRequests(): PermissionRequest[] {
    return this.receivedRequests.filter(r => r.status === 'pending');
  }

  getSentRequests(): PermissionRequest[] {
    return this.sentRequests;
  }

  // EVENT LISTENERS
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // CLEANUP
  cleanupExpiredRequests() {
    const now = Date.now();

    this.receivedRequests = this.receivedRequests.filter(r =>
      r.status === 'pending' ? r.expiresAt > now : true
    );

    this.sentRequests = this.sentRequests.filter(r =>
      r.status === 'pending' ? r.expiresAt > now : true
    );

    this.savePermissions();
  }
}

export const meshPermissions = new MeshPermissionsService();
