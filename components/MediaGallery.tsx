
import React from 'react';

interface MediaGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (img: any) => void;
    sampleImages: any[];
    imageInputRef: React.RefObject<HTMLInputElement>;
    videoInputRef: React.RefObject<HTMLInputElement>;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({
    isOpen,
    onClose,
    onSelect,
    sampleImages,
    imageInputRef,
    videoInputRef
}) => {
    if (!isOpen) return null;

    const handlePreview = (img: any) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-6 cursor-pointer';
        modal.innerHTML = `
      <div class="relative max-w-4xl max-h-full">
        <img src="${img.url}" class="max-w-full max-h-full rounded" alt="${img.caption}" />
        <div class="absolute bottom-0 left-0 right-0 bg-black/80 p-4 rounded-b">
          <h3 class="text-white font-bold">${img.caption}</h3>
          <p class="text-white/60 text-sm">${img.category} • ${img.size}</p>
        </div>
        <button class="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded">Close</button>
      </div>
    `;
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.body.appendChild(modal);
    };

    const savedImages = JSON.parse(localStorage.getItem('xitchat_gallery_images') || '[]');

    return (
        <div className="absolute inset-x-0 bottom-0 top-0 bg-black bg-opacity-90 z-50 p-6 flex flex-col animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6 border-b border-current pb-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold uppercase tracking-widest text-xs">image_gallery</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={() => imageInputRef.current?.click()} className="terminal-btn active px-3 py-1 text-[10px] uppercase"><i className="fas fa-upload mr-1"></i>upload</button>
                        <button onClick={() => videoInputRef.current?.click()} className="terminal-btn px-3 py-1 text-[10px] uppercase"><i className="fas fa-camera mr-1"></i>camera</button>
                    </div>
                </div>
                <button onClick={onClose} className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100">close_menu</button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="mb-6">
                    <h4 className="text-xs font-bold uppercase opacity-60 mb-3">sample_images</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {sampleImages.map((img) => (
                            <div key={img.id} onClick={() => onSelect(img)} className="aspect-square border border-current border-opacity-30 overflow-hidden cursor-pointer group hover:border-opacity-100 transition-all relative">
                                <img src={img.url} alt={img.caption} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all">
                                    <div className="absolute bottom-0 left-0 right-0 p-2">
                                        <p className="text-xs text-white truncate">{img.caption}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[8px] opacity-70">{img.category}</span>
                                            <span className="text-[8px] opacity-70">{img.size}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handlePreview(img); }} className="absolute top-2 right-2 p-1 bg-black/50 rounded text-xs hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-eye"></i></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold uppercase opacity-60 mb-3">your_images</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {savedImages.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-12 border-2 border-dashed border-current border-opacity-30 rounded">
                                <p className="text-xs opacity-60 mb-4">No uploaded images yet</p>
                                <button onClick={() => imageInputRef.current?.click()} className="terminal-btn active px-3 py-1 text-[10px] uppercase">upload_first_image</button>
                            </div>
                        ) : (
                            savedImages.map((img: any) => (
                                <div key={img.id} onClick={() => onSelect(img)} className="aspect-square border border-current border-opacity-30 overflow-hidden cursor-pointer group hover:border-opacity-100 transition-all relative">
                                    <img src={img.url} alt={img.caption} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all">
                                        <div className="absolute bottom-0 left-0 right-0 p-2">
                                            <p className="text-xs text-white truncate">{img.caption}</p>
                                            <p className="text-[8px] opacity-70">{new Date(img.timestamp).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaGallery;
