// Copied from QuoteMGR src/components/SignatureCanvas.tsx (read-only reference).
import React, { useRef, useState, useEffect } from 'react';
import { Pen, Type, RotateCcw, Check, Shield } from 'lucide-react';

interface SignatureCanvasProps {
  onSign: (signatureData: string, signerName: string) => void;
  signerName?: string;
  existingSignature?: string | null;
  signatureConsentText?: string;
  cancelTitle?: string;
  cancelInstructionText?: string;
  hideCancelNotice?: boolean;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  onSign,
  signerName: initialName = '',
  existingSignature,
  signatureConsentText,
  cancelTitle,
  cancelInstructionText,
  hideCancelNotice = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState(initialName);
  const [signerName, setSignerName] = useState(initialName);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    const pos = getPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSubmit = () => {
    if (!signerName.trim()) return;
    
    let signatureData: string;
    
    if (mode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      signatureData = canvas.toDataURL('image/png');
    } else {
      // Create typed signature on canvas
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Transparent background — no fillRect so the PNG has no white box
      ctx.font = 'italic 48px "Georgia", serif';
      ctx.fillStyle = '#1e3a5f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, 300, 100);
      signatureData = canvas.toDataURL('image/png');
    }
    
    onSign(signatureData, signerName);
  };

  if (existingSignature) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Check className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-semibold text-green-800">Document Signed</h3>
        </div>
        <img src={existingSignature} alt="Signature" className="max-w-xs mx-auto border border-green-200 rounded-lg bg-white p-2" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Signer Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Legal Name</label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Enter your full legal name"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
        />
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('draw')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'draw' ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Pen className="w-4 h-4" />
          Draw Signature
        </button>
        <button
          onClick={() => setMode('type')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'type' ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Type className="w-4 h-4" />
          Type Signature
        </button>
      </div>

      {/* Signature Area */}
      {mode === 'draw' ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-40 border-2 border-gray-200 rounded-xl bg-white cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
          />
          <div className="absolute bottom-3 left-3 right-3 border-b border-gray-300" />
          <button
            onClick={clearCanvas}
            className="absolute top-2 right-2 p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </button>
          {!hasDrawn && (
            <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              Sign here
            </p>
          )}
        </div>
      ) : (
        <div className="border-2 border-gray-200 rounded-xl p-6 bg-white">
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your name"
            className="w-full text-center text-3xl font-serif italic text-[#1e3a5f] border-b-2 border-gray-200 pb-2 outline-none focus:border-[#1e3a5f]"
          />
        </div>
      )}

      {/* Agreement */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
        />
        <span className="text-sm text-gray-600">
          {signatureConsentText || 'I agree that this electronic signature is the legal equivalent of my manual signature and acknowledge any applicable cancellation rights under federal or state law.'}
        </span>
      </label>

      {/* 3-Day Right to Cancel Notice — hidden for completion certificates */}
      {!hideCancelNotice && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-800">{cancelTitle || 'Notice of Right to Cancel'}</h4>
              <p className="text-xs text-amber-700 mt-1">
                {cancelInstructionText || 'You may have a right to cancel this transaction under applicable federal or state law. Review the cancellation notice on this document for instructions and deadlines.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!signerName.trim() || !agreed || (mode === 'draw' && !hasDrawn) || (mode === 'type' && !typedName.trim())}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Check className="w-5 h-5" />
        Sign Document
      </button>
    </div>
  );
};

export default SignatureCanvas;
