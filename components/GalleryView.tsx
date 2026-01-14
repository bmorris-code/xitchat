import React, { useState, useEffect, useRef } from 'react';

interface GalleryImage {
  id: string;
  url: string;
  caption: string;
  timestamp: number;
  uploader: string;
  likes: number;
  isLiked: boolean;
}

interface GalleryViewProps {
  onBack?: () => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({ onBack }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // const [forceRemount, setForceRemount] = useState(0); // This state was unused, removed for cleanliness
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset selectedImage when component unmounts
  useEffect(() => {
    return () => {
      setSelectedImage(null);
    };
  }, []);

  useEffect(() => {
    const savedImages = localStorage.getItem('xitchat_gallery_images');
    if (savedImages) {
      try {
        setImages(JSON.parse(savedImages));
      } catch (error) {
        console.error('Failed to load gallery images:', error);
        loadDefaultImages();
      }
    } else {
      loadDefaultImages();
    }
  }, []);

  const loadDefaultImages = () => {
    const defaultImages: GalleryImage[] = [
      {
        id: 'default-1',
        url: 'https://picsum.photos/seed/cyberpunk1/400/300',
        caption: 'Neon city streets at midnight',
        timestamp: Date.now() - 86400000,
        uploader: 'node_alpha',
        likes: 42,
        isLiked: false
      },
      {
        id: 'default-2',
        url: 'https://picsum.photos/seed/tech1/400/300',
        caption: 'Retro terminal interface',
        timestamp: Date.now() - 172800000,
        uploader: 'mesh_node_7',
        likes: 28,
        isLiked: false
      },
      {
        id: 'default-3',
        url: 'https://picsum.photos/seed/matrix1/400/300',
        caption: 'Digital rain patterns',
        timestamp: Date.now() - 259200000,
        uploader: 'system_admin',
        likes: 15,
        isLiked: false
      },
      {
        id: 'default-4',
        url: 'https://picsum.photos/seed/space1/400/300',
        caption: 'Satellite mesh network',
        timestamp: Date.now() - 345600000,
        uploader: 'space_station',
        likes: 67,
        isLiked: false
      },
      {
        id: 'default-5',
        url: 'https://picsum.photos/seed/abstract1/400/300',
        caption: 'Glitch art visualization',
        timestamp: Date.now() - 432000000,
        uploader: 'digital_artist',
        likes: 33,
        isLiked: false
      },
      {
        id: 'default-6',
        url: 'https://picsum.photos/seed/nature1/400/300',
        caption: 'Hidden forest node',
        timestamp: Date.now() - 518400000,
        uploader: 'nature_node',
        likes: 51,
        isLiked: false
      },
      {
        id: 'default-7',
        url: 'https://picsum.photos/seed/urban1/400/300',
        caption: 'Underground network access',
        timestamp: Date.now() - 604800000,
        uploader: 'urban_explorer',
        likes: 29,
        isLiked: false
      },
      {
        id: 'default-8',
        url: 'https://picsum.photos/seed/minimal1/400/300',
        caption: 'Clean interface design',
        timestamp: Date.now() - 691200000,
        uploader: 'ui_designer',
        likes: 44,
        isLiked: false
      },
      {
        id: 'default-9',
        url: 'https://picsum.photos/seed/retro1/400/300',
        caption: 'Vintage computer setup',
        timestamp: Date.now() - 777600000,
        uploader: 'retro_hacker',
        likes: 38,
        isLiked: false
      },
      {
        id: 'default-10',
        url: 'https://picsum.photos/seed/future1/400/300',
        caption: 'Future city concept',
        timestamp: Date.now() - 864000000,
        uploader: 'future_vision',
        likes: 72,
        isLiked: false
      },
      {
        id: 'default-11',
        url: 'https://picsum.photos/seed/code1/400/300',
        caption: 'Binary code waterfall',
        timestamp: Date.now() - 950400000,
        uploader: 'code_master',
        likes: 56,
        isLiked: false
      },
      {
        id: 'default-12',
        url: 'https://picsum.photos/seed/network1/400/300',
        caption: 'Node connection map',
        timestamp: Date.now() - 1036800000,
        uploader: 'network_admin',
        likes: 41,
        isLiked: false
      }
    ];
    setImages(defaultImages);
    localStorage.setItem('xitchat_gallery_images', JSON.stringify(defaultImages));
  };

  const saveImages = (newImages: GalleryImage[]) => {
    setImages(newImages);
    localStorage.setItem('xitchat_gallery_images', JSON.stringify(newImages));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setSelectedFile(dataUrl);
        setUploadModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (!caption.trim() || !selectedFile) return;
    
    setIsUploading(true);
    
    setTimeout(() => {
      const newImage: GalleryImage = {
        id: `img-${Date.now()}`,
        url: selectedFile, 
        caption: caption.trim(),
        timestamp: Date.now(),
        uploader: 'me',
        likes: 0,
        isLiked: false
      };
      
      const newImages = [newImage, ...images];
      saveImages(newImages);
      
      setCaption('');
      setUploadModal(false);
      setIsUploading(false);
      setSelectedFile(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, 1500);
  };

  const handleShare = async (image: GalleryImage) => {
    try {
      const shareData = {
        title: image.caption,
        text: `Check out this image from @${image.uploader} on XitChat!`,
        url: window.location.href
      };

      // Use Web Share API if available
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        // Fallback: copy to clipboard if clipboard API is available
        const textToCopy = `${image.caption} - Shared by @${image.uploader} on XitChat`;
        await navigator.clipboard.writeText(textToCopy);
        alert('Link copied to clipboard!');
      } else {
        // Final fallback: create temporary textarea to copy text
        const textToCopy = `${image.caption} - Shared by @${image.uploader} on XitChat`;
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Share failed:', error);
      // Final fallback: try to copy image URL
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(image.url);
          alert('Image URL copied to clipboard!');
        } else {
          // Fallback for clipboard API not available
          const textarea = document.createElement('textarea');
          textarea.value = image.url;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          alert('Image URL copied to clipboard!');
        }
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
        alert('Share functionality is not available in your browser. Please copy the link manually.');
      }
    }
  };

  const handleSave = async (image: GalleryImage) => {
    try {
      // Create a temporary link to download the image
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `xitchat_${image.id}_${image.caption.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
      alert('Image saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save image');
    }
  };

  const handleLike = (imageId: string) => {
    const newImages = images.map(img => {
      if (img.id === imageId) {
        return {
          ...img,
          likes: img.isLiked ? img.likes - 1 : img.likes + 1,
          isLiked: !img.isLiked
        };
      }
      return img;
    });
    saveImages(newImages);
  };

  const handleDelete = (imageId: string) => {
    if (confirm('Delete this image from gallery?')) {
      const newImages = images.filter(img => img.id !== imageId);
      saveImages(newImages);
      if (selectedImage?.id === imageId) {
        setSelectedImage(null);
      }
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // --- IMAGE VIEWER VIEW ---
  if (selectedImage) {
    return (
      <div className="flex-1 flex flex-col bg-black text-current font-mono">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-current border-opacity-20">
          <div className="flex items-center gap-4">
             {/* FIXED: Back button now closes the viewer (setSelectedImage(null)) */}
             <button onClick={() => setSelectedImage(null)}
               className="terminal-btn px-2 py-0 h-8 text-[10px] uppercase">back_to_grid</button>
            <div>
              <h2 className="text-xl font-bold">IMAGE_VIEWER</h2>
              <p className="text-xs opacity-60">Node Transmission</p>
            </div>
          </div>
          <button onClick={() => handleDelete(selectedImage.id)} className="terminal-btn text-xs px-2 py-1 h-8 min-h-0 uppercase text-red-400">delete</button>
        </div>

        {/* Image Viewer */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-4xl w-full">
            <div className="mb-4">
              <img 
                src={selectedImage.url} 
                alt={selectedImage.caption}
                className="w-full h-auto max-h-[60vh] object-contain border border-current border-opacity-30"
              />
            </div>
            
            {/* Image Info */}
            <div className="text-center space-y-4">
              <h3 className="text-lg font-bold">{selectedImage.caption}</h3>
              <div className="flex justify-center items-center gap-6 text-xs opacity-60">
                <span>by @{selectedImage.uploader}</span>
                <span>•</span>
                <span>{formatTimestamp(selectedImage.timestamp)}</span>
                <span>•</span>
                <span>{selectedImage.likes} likes</span>
              </div>
              
              {/* Actions */}
              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => handleLike(selectedImage.id)}
                  className={`terminal-btn px-4 py-2 text-sm ${selectedImage.isLiked ? 'text-red-400' : ''}`}
                >
                  {selectedImage.isLiked ? '❤️ liked' : '🤍 like'}
                </button>
                <button 
                  onClick={() => handleShare(selectedImage)}
                  className="terminal-btn px-4 py-2 text-sm"
                >
                  🔗 share
                </button>
                <button 
                  onClick={() => handleSave(selectedImage)}
                  className="terminal-btn px-4 py-2 text-sm"
                >
                  💾 save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- GALLERY GRID VIEW ---
  return (
    <div className="flex-1 flex flex-col bg-black text-current font-mono">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-current border-opacity-20">
        <div className="flex items-center gap-4">
            {/* Back button here calls onBack to go to the Hub */}
            <button onClick={onBack} className="terminal-btn text-xs px-2 py-1 h-8 min-h-0 uppercase">back_to_hub</button>
          
          <div>
            <h2 className="text-lg font-bold">pics_gallery.exe</h2>
            <p className="text-xs opacity-60">Shared node transmissions</p>
          </div>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="terminal-btn text-xs px-2 py-1 h-8 min-h-0 uppercase"
        >
          upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              onClick={() => setSelectedImage(image)}
              className="aspect-square border border-current border-opacity-30 overflow-hidden cursor-pointer group hover:border-opacity-100 transition-all relative"
            >
              <img
                src={image.url}
                alt={image.caption}
                className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-xs text-white truncate">{image.caption}</p>
                  <div className="flex justify-between items-center text-xs text-white/60">
                    <span>@{image.uploader}</span>
                    <span>❤️ {image.likes}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {images.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📷</div>
              <h3 className="text-xl font-bold mb-2">No images yet</h3>
              <p className="text-sm opacity-60 mb-4">Be the first to share a node transmission!</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="terminal-btn active px-4 py-2"
              >
                upload_first_image
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-6">
            <h3 className="text-lg font-bold mb-4">UPLOAD_TRANSMISSION</h3>
            
            {/* Image Preview */}
            {selectedFile && (
              <div className="mb-4">
                <label className="block text-xs opacity-60 mb-2">PREVIEW</label>
                <div className="border border-current border-opacity-30 p-2">
                  <img 
                    src={selectedFile} 
                    alt="Upload preview" 
                    className="w-full h-48 object-cover"
                  />
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-xs opacity-60 mb-2">CAPTION</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Enter image caption..."
                className="w-full bg-black border border-current border-opacity-30 p-2 text-sm font-mono resize-none"
                rows={3}
                maxLength={200}
              />
              <div className="text-xs opacity-40 mt-1">{caption.length}/200</div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={!caption.trim() || !selectedFile || isUploading}
                className="terminal-btn active flex-1 py-2 disabled:opacity-50"
              >
                {isUploading ? 'uploading...' : 'upload'}
              </button>
              <button
                onClick={() => {
                  setUploadModal(false);
                  setCaption('');
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="terminal-btn flex-1 py-2"
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryView;