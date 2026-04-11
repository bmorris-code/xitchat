// GemmaSetupView — shown automatically on first install when Gemma model
// has not been downloaded yet. User taps one button and it downloads + inits.
// After completion the flag is saved and this screen never shows again.

import React, { useState } from 'react';
import {
  GEMMA_MODEL_URL,
  downloadGemmaModel,
  initializeGemmaLocal,
  markGemmaSetupDone
} from '../services/gemma-local';

interface GemmaSetupViewProps {
  onComplete: () => void; // called when done (or skipped)
}

type Phase = 'idle' | 'downloading' | 'loading' | 'done' | 'error';

const GemmaSetupView: React.FC<GemmaSetupViewProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const formatMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(0);

  const handleDownload = async () => {
    setPhase('downloading');
    setProgress(0);

    const ok = await downloadGemmaModel(
      GEMMA_MODEL_URL,
      (pct, dl, tot) => {
        setProgress(pct);
        setDownloaded(dl);
        setTotal(tot);
      }
    );

    if (!ok) {
      setPhase('error');
      setErrorMsg('Download failed. Check your internet connection and try again.');
      return;
    }

    setPhase('loading');
    const initialized = await initializeGemmaLocal();

    if (!initialized) {
      setPhase('error');
      setErrorMsg('Model downloaded but failed to load. Your device may not have enough RAM.');
      return;
    }

    markGemmaSetupDone();
    setPhase('done');
    setTimeout(onComplete, 1200);
  };

  return (
    <div className="h-full w-full bg-black flex items-center justify-center p-6 font-mono">
      <div className="max-w-md w-full border border-[#00ff41]/30 bg-[#050505] p-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <i className="fa-solid fa-microchip text-2xl text-[#00ff41]"></i>
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest text-[#00ff41]">XitBot AI Setup</h2>
            <p className="text-[10px] text-[#00ff41]/50 uppercase tracking-widest">one-time install · works offline</p>
          </div>
        </div>

        {/* Description */}
        {phase === 'idle' && (
          <>
            <p className="text-xs text-[#00ff41]/70 leading-relaxed mb-4">
              XitBot runs directly on your device so you can chat with AI even without internet or mobile data.
            </p>
            <div className="bg-[#00ff41]/5 border border-[#00ff41]/20 p-3 mb-6 text-[10px] text-[#00ff41]/60 space-y-1">
              <div>&#x25B6; Size: ~1 GB download (one time only)</div>
              <div>&#x25B6; Runs fully offline after install</div>
              <div>&#x25B6; Your conversations never leave your device</div>
              <div>&#x25B6; Works alongside Bluetooth &amp; WiFi mesh chat</div>
            </div>
            <button
              onClick={handleDownload}
              className="w-full py-3 bg-[#00ff41]/10 border border-[#00ff41]/50 text-[#00ff41] text-xs font-bold uppercase tracking-widest hover:bg-[#00ff41]/20 transition-all mb-3"
            >
              <i className="fa-solid fa-download mr-2"></i>
              Download XitBot AI (~1 GB)
            </button>
            <button
              onClick={onComplete}
              className="w-full py-2 text-[10px] text-[#00ff41]/30 hover:text-[#00ff41]/50 uppercase tracking-widest transition-colors"
            >
              Skip for now (use cloud AI when online)
            </button>
          </>
        )}

        {/* Downloading */}
        {phase === 'downloading' && (
          <>
            <p className="text-[10px] text-[#00ff41]/60 uppercase tracking-widest mb-3">
              Downloading model... {progress}%
            </p>
            <div className="w-full h-2 bg-[#00ff41]/10 border border-[#00ff41]/20 mb-2">
              <div
                className="h-full bg-[#00ff41] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {total > 0 && (
              <p className="text-[9px] text-[#00ff41]/40">
                {formatMB(downloaded)} MB / {formatMB(total)} MB
              </p>
            )}
          </>
        )}

        {/* Loading into RAM */}
        {phase === 'loading' && (
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-gear fa-spin text-[#00ff41]"></i>
            <p className="text-xs text-[#00ff41]/70 uppercase tracking-widest">
              Loading model into memory...
            </p>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-circle-check text-[#00ff41] text-xl"></i>
            <p className="text-sm font-bold text-[#00ff41] uppercase tracking-widest">
              XitBot AI ready — fully offline!
            </p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <>
            <p className="text-xs text-red-400 mb-4">{errorMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setPhase('idle'); setProgress(0); }}
                className="flex-1 py-2 border border-[#00ff41]/40 text-[#00ff41] text-xs uppercase tracking-widest hover:bg-[#00ff41]/10"
              >
                Retry
              </button>
              <button
                onClick={onComplete}
                className="flex-1 py-2 border border-gray-600 text-gray-400 text-xs uppercase tracking-widest hover:bg-white/5"
              >
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GemmaSetupView;
