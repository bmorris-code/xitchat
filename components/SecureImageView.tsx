import React, { useState, useEffect } from 'react';
import { privacyService } from '../services/privacyService';
import { encryptionService } from '../services/encryptionService';
import { localStorageService } from '../services/localStorageService';

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
  const [requiresAuth, setRequiresAuth] = useState(false);
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
      // Check if user can view this image
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
          setError('Permission denied');
          onPermissionDenied?.();
        }
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      setError('Failed to check permissions');
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
        throw new Error('Image data not found');
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
      setError('Failed to load image');
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
      <div className={`flex items-center justify-center bg-black/50 border border-current border-dashed ${className}`}>
        <div className="text-center p-4">
          <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-xs opacity-60">Loading secure image...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-black/50 border border-current border-dashed ${className}`}>
        <div className="text-center p-4">
          <i className="fas fa-lock text-2xl mb-2 opacity-40"></i>
          <p className="text-xs opacity-60 mb-3">{error}</p>
          <button 
            onClick={requestAccess}
            className="terminal-btn active py-2 px-4 text-xs"
          >
            Request Access
          </button>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className={`flex flex-col items-center justify-center bg-black/50 border border-current border-dashed ${className}`}>
        <div className="text-center p-4">
          <i className="fas fa-eye-slash text-2xl mb-2 opacity-40"></i>
          <p className="text-xs opacity-60 mb-3">Secure content - authentication required</p>
          <button 
            onClick={requestAccess}
            className="terminal-btn active py-2 px-4 text-xs"
          >
            Unlock Image
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Security overlay */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-black/80 px-2 py-1 rounded border border-current border-opacity-30">
        <i className="fas fa-shield-alt text-green-400 text-xs"></i>
        <span className="text-xs font-mono text-green-400">
          {formatTimeRemaining(timeRemaining)}
        </span>
        <button 
          onClick={revokeAccess}
          className="text-red-400 hover:text-red-300 transition-colors"
          title="Revoke access"
        >
          <i className="fas fa-times text-xs"></i>
        </button>
      </div>

      {/* Image */}
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt="Secure content"
          className="w-full h-full object-contain"
          onLoad={() => {
            // Image loaded successfully
          }}
          onError={() => {
            setError('Failed to display image');
            setHasPermission(false);
          }}
        />
      )}

      {/* Auto-delete warning */}
      <div className="absolute bottom-2 left-2 text-xs text-yellow-400 bg-black/80 px-2 py-1 rounded border border-yellow-400/30">
        <i className="fas fa-clock mr-1"></i>
        Auto-delete in {formatTimeRemaining(timeRemaining)}
      </div>
    </div>
  );
};

export default SecureImageView;
