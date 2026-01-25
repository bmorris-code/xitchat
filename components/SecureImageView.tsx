
import React, { useState, useEffect } from 'react';
import { privacyService } from '../services/privacyService';
import { encryptionService } from '../services/encryptionService';
import { localStorageService } from '../services/localStorageService';
import { meshPermissions } from '../services/meshPermissions';

interface SecureImageViewProps {
  imageId: string;
  senderId: string;
  encryptedData?: any;
  className?: string;
  onPermissionDenied?: () => void;
  onImageLoaded?: (imageUrl: string) => void;
}

const SecureImageView: React.FC<SecureImageViewProps> = ({
  imageId,
  senderId,
  encryptedData,
  className = '',
  onPermissionDenied,
  onImageLoaded
}) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    checkPermission();
  }, [imageId]);

  useEffect(() => {
    if (hasPermission && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setHasPermission(false);
            setImageUrl(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [hasPermission, timeRemaining]);

  const checkPermission = async () => {
    try {
      // 1. Check user-level permission first (Nostr-integrated)
      const canViewProfile = meshPermissions.canViewProfile(senderId);
      if (!canViewProfile && senderId !== 'me') {
        // If we don't even have profile permission, we definitely need to request content permission
        console.log('User-level permission not found, checking content-level...');
      }

      // 2. Check content-level permission (Privacy Service)
      const canView = privacyService.canViewContent(imageId, 'image');

      if (canView) {
        setHasPermission(true);
        await loadImage();
      } else {
        // Request permission
        const granted = await privacyService.requestContentPermission(imageId, 'image', senderId);

        if (granted) {
          setHasPermission(true);
          await loadImage();
        } else {
          setHasPermission(false);
          setError('ACCESS_DENIED');
          onPermissionDenied?.();
        }
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      setError('PROTOCOL_ERROR');
    } finally {
      setIsLoading(false);
    }
  };

  const loadImage = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get encrypted image data
      let imageData = encryptedData;
      if (!imageData) {
        imageData = await localStorageService.getEncryptedImage(imageId);
      }

      if (!imageData) {
        throw new Error('DATA_NOT_FOUND');
      }

      // Decrypt the image
      const decryptedBuffer = await encryptionService.decryptImage(imageData.encrypted, senderId);

      // Create blob URL
      const blob = new Blob([decryptedBuffer], { type: imageData.metadata?.mimeType || 'image/jpeg' });
      const url = URL.createObjectURL(blob);

      setImageUrl(url);
      onImageLoaded?.(url);

      // Set time remaining based on privacy settings
      const settings = privacyService.getSettings();
      setTimeRemaining(settings.imageViewTimeout * 60); // Convert to seconds

    } catch (error) {
      console.error('Failed to load image:', error);
      setError('DECRYPTION_FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  const requestAccess = async () => {
    setIsLoading(true);
    await checkPermission();
  };

  const revokeAccess = () => {
    privacyService.revokePermission(imageId);
    setHasPermission(false);
    setImageUrl(null);
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-black/80 border border-current border-opacity-20 ${className}`}>
        <div className="text-center p-6">
          <div className="w-12 h-12 border-2 border-[#00ff41] border-t-transparent rounded-full animate-spin mx-auto mb-4 shadow-[0_0_15px_#00ff41]"></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ff41] animate-pulse">decrypting_payload...</p>
        </div>
      </div>
    );
  }

  if (error || !hasPermission) {
    return (
      <div className={`flex flex-col items-center justify-center bg-[#050505] border border-current border-opacity-10 relative overflow-hidden ${className}`}>
        {/* Scanning effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00ff41]/5 to-transparent h-1/2 w-full animate-scan pointer-events-none"></div>

        <div className="text-center p-8 relative z-10">
          <div className="w-16 h-16 border border-current border-opacity-20 flex items-center justify-center mx-auto mb-6 bg-black">
            <i className={`fa-solid ${error ? 'fa-triangle-exclamation text-red-500' : 'fa-lock text-[#00ff41]'} text-2xl`}></i>
          </div>
          <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-2 text-white">
            {error || 'SECURE_UPLINK_REQUIRED'}
          </h3>
          <p className="text-[9px] opacity-40 uppercase tracking-widest mb-6 max-w-[200px] mx-auto">
            {error ? 'Handshake failed or content corrupted.' : 'This transmission is encrypted and requires authorization.'}
          </p>
          <button
            onClick={requestAccess}
            className="terminal-btn active py-3 px-8 text-[10px] uppercase font-bold tracking-[0.2em]"
          >
            {error ? 'retry_handshake' : 'authorize_access'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black overflow-hidden group ${className}`}>
      {/* Security overlay */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3 bg-black/90 backdrop-blur-md px-3 py-2 border border-[#00ff41] border-opacity-30 shadow-[0_0_20px_rgba(0,255,65,0.1)]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#00ff41] rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black font-mono text-[#00ff41] tracking-tighter">
            {formatTimeRemaining(timeRemaining)}
          </span>
        </div>
        <div className="w-px h-3 bg-white/10"></div>
        <button
          onClick={revokeAccess}
          className="text-red-500 hover:text-red-400 transition-colors"
          title="Revoke access"
        >
          <i className="fa-solid fa-xmark text-[10px]"></i>
        </button>
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="w-full h-full relative">
          <img
            src={imageUrl}
            alt="Secure content"
            className="w-full h-full object-contain transition-all duration-700 group-hover:scale-105"
            onError={() => {
              setError('DISPLAY_ERROR');
              setHasPermission(false);
            }}
          />
          {/* Matrix scanline effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20"></div>
        </div>
      )}

      {/* Auto-delete warning */}
      <div className="absolute bottom-4 left-4 z-20 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-500 bg-black/90 backdrop-blur-md px-3 py-1.5 border border-amber-500/30">
        <i className="fa-solid fa-clock-rotate-left mr-2 animate-pulse"></i>
        auto_purge: {formatTimeRemaining(timeRemaining)}
      </div>
    </div>
  );
};

export default SecureImageView;
