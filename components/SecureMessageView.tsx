
import React, { useState, useEffect } from 'react';
import { encryptionService } from '../services/encryptionService';

interface SecureMessageViewProps {
    text: string;
    senderId: string;
    encryptedData?: {
        data: string;
        iv: string;
        salt: string;
    };
}

const SecureMessageView: React.FC<SecureMessageViewProps> = ({ text, senderId, encryptedData }) => {
    const [decryptedText, setDecryptedText] = useState<string | null>(null);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (encryptedData) {
            decrypt();
        }
    }, [encryptedData, senderId]);

    const decrypt = async () => {
        try {
            setIsDecrypting(true);
            setError(null);

            // Ensure we have keys for 'me'
            if (!encryptionService.hasUserKeys('me')) {
                await encryptionService.initializeUser('me');
            }

            const decrypted = await encryptionService.decryptMessage(encryptedData!, senderId);
            setDecryptedText(decrypted);
        } catch (err) {
            console.error('Decryption failed:', err);
            setError('DECRYPTION_FAILED');
        } finally {
            setIsDecrypting(false);
        }
    };

    if (!encryptedData) {
        return <p className="text-current break-words">{text}</p>;
    }

    if (isDecrypting) {
        return (
            <div className="flex items-center gap-2 text-[10px] opacity-40 italic animate-pulse">
                <i className="fa-solid fa-unlock-keyhole text-[8px]"></i>
                <span>decrypting_transmission...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col gap-1">
                <p className="text-red-500/50 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i> {error}
                </p>
                <p className="text-current opacity-20 break-words text-[10px] italic">{text}</p>
            </div>
        );
    }

    return (
        <div className="relative group">
            <p className="text-slate-100 break-words leading-relaxed group-hover:text-white transition-colors">
                {decryptedText}
            </p>
            <div className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-20 transition-opacity">
                <i className="fa-solid fa-lock text-[8px] text-[#00ff41]"></i>
            </div>
        </div>
    );
};

export default SecureMessageView;
