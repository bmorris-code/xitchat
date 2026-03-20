import React, { useEffect, useMemo, useState } from 'react';
import { identityService } from '../services/identityService';
import { trustStore } from '../services/trustStore';

interface VerifyPeerModalProps {
  isOpen: boolean;
  peerPk?: string | null;
  peerLabel?: string;
  onClose: () => void;
  onVerified?: () => void;
}

export default function VerifyPeerModal({ isOpen, peerPk, peerLabel, onClose, onVerified }: VerifyPeerModalProps) {
  const [myPk, setMyPk] = useState<string>('');
  const [safety, setSafety] = useState<string>('');
  const [pasteSafety, setPasteSafety] = useState<string>('');
  const [status, setStatus] = useState<'unknown' | 'verified' | 'unverified'>('unknown');
  const normalizedPeerPk = useMemo(() => (peerPk || '').replace(/^0x/i, '').toLowerCase(), [peerPk]);

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      const pk = await identityService.getPublicKeyHex();
      setMyPk(pk);
      if (normalizedPeerPk) {
        setSafety(await identityService.getSafetyNumber(normalizedPeerPk));
        setStatus((await trustStore.isVerified(normalizedPeerPk)) ? 'verified' : 'unverified');
      } else {
        setSafety('');
        setStatus('unknown');
      }
    })();
  }, [isOpen, normalizedPeerPk]);

  if (!isOpen) return null;

  const copyMyPk = async () => {
    try {
      await navigator.clipboard.writeText(myPk);
    } catch {
      // no-op
    }
  };

  const handleVerify = async () => {
    if (!normalizedPeerPk) return;
    const expected = safety.trim();
    const received = pasteSafety.trim();
    if (!expected || !received) return;
    if (expected !== received) {
      alert('Safety number mismatch. Do not verify unless you checked in-person.');
      return;
    }
    await trustStore.verify(normalizedPeerPk, peerLabel);
    setStatus('verified');
    onVerified?.();
  };

  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-xl w-full border border-current border-opacity-30 bg-[#050505] p-6 font-mono">
        <div className="flex items-start justify-between gap-4 border-b border-current border-opacity-20 pb-4 mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-black uppercase tracking-widest glow-text">verify_peer.exe</h3>
            <p className="text-[10px] opacity-50 uppercase tracking-[0.2em]">
              {peerLabel ? `target: ${peerLabel}` : 'target: unknown'}
            </p>
          </div>
          <button onClick={onClose} className="terminal-btn px-3 py-2 text-[10px] uppercase font-bold">
            close
          </button>
        </div>

        <div className="space-y-4">
          <div className="border border-current border-opacity-20 p-4 bg-black/40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] opacity-50 uppercase tracking-widest">my_public_key</p>
                <p className="text-[10px] break-all text-white/70">{myPk || 'loading...'}</p>
              </div>
              <button onClick={copyMyPk} className="terminal-btn active px-3 py-2 text-[10px] uppercase font-bold">
                copy
              </button>
            </div>
          </div>

          <div className="border border-current border-opacity-20 p-4 bg-black/40">
            <p className="text-[10px] opacity-50 uppercase tracking-widest mb-2">safety_number</p>
            <p className="text-sm font-black tracking-widest text-[#00ff41]">{safety || 'n/a'}</p>
            <p className="text-[10px] opacity-40 mt-2">
              Verify this number in-person (or via a trusted channel). If it matches, messages can’t be spoofed without detection.
            </p>
          </div>

          <div className="border border-current border-opacity-20 p-4 bg-black/40 space-y-2">
            <p className="text-[10px] opacity-50 uppercase tracking-widest">confirm_match</p>
            <input
              value={pasteSafety}
              onChange={(e) => setPasteSafety(e.target.value)}
              placeholder="paste_their_safety_number_here..."
              className="w-full bg-black border border-current border-opacity-20 px-3 py-2 text-[10px] text-white/80 placeholder-white/20 outline-none focus:border-opacity-60"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-widest opacity-60">
                status:{' '}
                <span className={status === 'verified' ? 'text-[#00ff41]' : status === 'unverified' ? 'text-amber-400' : 'text-white/40'}>
                  {status}
                </span>
              </div>
              <button
                onClick={handleVerify}
                disabled={!normalizedPeerPk || !safety}
                className="terminal-btn active px-4 py-2 text-[10px] uppercase font-bold disabled:opacity-40"
              >
                mark_verified
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

