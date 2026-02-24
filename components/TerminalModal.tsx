
import React, { useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger' | 'ghost';
}

interface TerminalModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    actions: ModalAction[];
    onClose?: () => void;
    icon?: string; // FontAwesome icon class e.g. 'fa-triangle-exclamation'
    variant?: 'default' | 'danger' | 'success' | 'sos';
}

// ─── Toast Notification (non-blocking replacement for alert) ─────────────────

interface ToastItem {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

let toastDispatch: ((toast: ToastItem) => void) | null = null;

export const showToast = (message: string, type: ToastItem['type'] = 'info') => {
    const id = `toast-${Date.now()}`;
    if (toastDispatch) {
        toastDispatch({ id, message, type });
    } else {
        // Fallback: queue as global event
        window.dispatchEvent(new CustomEvent('xitToast', { detail: { id, message, type } }));
    }
};

// ─── Toast Container ──────────────────────────────────────────────────────────

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = React.useState<ToastItem[]>([]);

    useEffect(() => {
        // Register dispatcher
        toastDispatch = (toast) => {
            setToasts(prev => [...prev, toast]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== toast.id));
            }, 3500);
        };

        // Also listen for window events (from non-React contexts)
        const handler = (e: CustomEvent) => {
            const toast = e.detail as ToastItem;
            setToasts(prev => [...prev, toast]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== toast.id));
            }, 3500);
        };
        window.addEventListener('xitToast', handler as EventListener);

        return () => {
            toastDispatch = null;
            window.removeEventListener('xitToast', handler as EventListener);
        };
    }, []);

    const colorMap = {
        success: 'border-[#00ff41] text-[#00ff41]',
        error: 'border-red-500 text-red-500',
        info: 'border-current text-current',
        warning: 'border-amber-400 text-amber-400',
    };

    const iconMap = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        info: 'fa-circle-info',
        warning: 'fa-triangle-exclamation',
    };

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
            flex items-center gap-3 px-4 py-3 bg-black border font-mono text-[11px] uppercase tracking-wider
            shadow-2xl animate-in slide-in-from-right-4 fade-in duration-300
            ${colorMap[toast.type]}
          `}
                >
                    <i className={`fa-solid ${iconMap[toast.type]} text-sm`}></i>
                    <span className="font-bold">{toast.message}</span>
                    <span className="opacity-30 ml-2 text-[8px]">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── Terminal Modal (replaces confirm()) ──────────────────────────────────────

const TerminalModal: React.FC<TerminalModalProps> = ({
    isOpen,
    title,
    message,
    actions,
    onClose,
    icon,
    variant = 'default',
}) => {
    const firstBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => firstBtnRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape' && onClose) onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const borderColor = {
        default: 'border-current',
        danger: 'border-red-500',
        success: 'border-[#00ff41]',
        sos: 'border-red-500',
    }[variant];

    const titleColor = {
        default: 'text-current',
        danger: 'text-red-500',
        success: 'text-[#00ff41]',
        sos: 'text-red-500',
    }[variant];

    const defaultIcon = {
        default: 'fa-terminal',
        danger: 'fa-triangle-exclamation',
        success: 'fa-circle-check',
        sos: 'fa-siren',
    }[variant];

    const getActionClass = (a: ModalAction) => {
        if (a.variant === 'danger') return 'bg-red-900/40 border border-red-500 text-red-400 hover:bg-red-500 hover:text-white';
        if (a.variant === 'primary') return 'bg-current text-black hover:opacity-80';
        return 'border border-current border-opacity-30 text-current hover:border-opacity-100 hover:bg-white/5';
    };

    return (
        <div
            className="fixed inset-0 z-[9000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in"
            onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
        >
            <div className={`w-full max-w-sm bg-[#050505] border-2 ${borderColor} p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200`}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <i className={`fa-solid ${icon || defaultIcon} ${titleColor} text-lg`}></i>
                    <h3 className={`font-bold uppercase tracking-widest text-sm ${titleColor}`}>
                        {title}
                    </h3>
                </div>

                {/* Divider */}
                <div className={`h-px ${borderColor} opacity-30 mb-6`}></div>

                {/* Message */}
                <p className="text-white/70 text-xs font-mono leading-relaxed mb-8">
                    {message}
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    {actions.map((action, i) => (
                        <button
                            key={i}
                            ref={i === 0 ? firstBtnRef : undefined}
                            onClick={action.onClick}
                            className={`w-full py-3 px-4 font-bold uppercase text-[10px] tracking-[0.3em] transition-all ${getActionClass(action)}`}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TerminalModal;
