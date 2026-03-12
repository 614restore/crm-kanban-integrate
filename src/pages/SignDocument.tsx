// SignDocument.tsx
// Public page — customer opens their sign link, reviews the document,
// draws/types their signature, and submits. No login required.

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, PenLine, Type, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getDocumentSendByToken,
  markDocumentViewed,
  submitDocumentSignature,
  type DocumentSend,
} from '@/lib/documentSends';
import { sendEmail } from '@/lib/emailApi';

type SignMode = 'draw' | 'type';

const SignDocument: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [send, setSend] = useState<DocumentSend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'review' | 'sign' | 'done'>('review');
  const [signMode, setSignMode] = useState<SignMode>('draw');
  const [typedName, setTypedName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Canvas drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasDraw, setHasDraw] = useState(false);

  // Load the document
  useEffect(() => {
    if (!token) { setError('Invalid link.'); setLoading(false); return; }
    (async () => {
      const doc = await getDocumentSendByToken(token);
      if (!doc) { setError('This signing link is invalid or has expired.'); setLoading(false); return; }
      if (doc.status === 'signed') { setStep('done'); setSend(doc); setLoading(false); return; }
      setSend(doc);
      setLoading(false);
      // Mark viewed
      await markDocumentViewed(token);
    })();
  }, [token]);

  // Canvas helpers
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    const canvas = canvasRef.current!;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (lastPos.current) {
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
    }
    ctx.stroke();
    lastPos.current = pos;
    setHasDraw(true);
  };

  const stopDraw = () => { drawing.current = false; lastPos.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDraw(false);
  };

  const getSignatureData = (): string => {
    if (signMode === 'draw') {
      return canvasRef.current?.toDataURL('image/png') ?? '';
    }
    // Render typed name to canvas
    const canvas = document.createElement('canvas');
    canvas.width = 500; canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 500, 120);
    ctx.font = 'italic 52px Georgia, serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(typedName, 20, 80);
    return canvas.toDataURL('image/png');
  };

  const handleSubmit = async () => {
    if (!send || !token) return;
    const signedName = signMode === 'type' ? typedName : typedName;
    if (!signedName.trim()) { alert('Please enter your full name.'); return; }
    if (signMode === 'draw' && !hasDraw) { alert('Please draw your signature.'); return; }

    setSubmitting(true);
    try {
      const sigData = getSignatureData();
      await submitDocumentSignature({ token, signature_data: sigData, signed_name: signedName });

      // Notify the contractor via email
      await sendEmail({
        to: send.sent_to_email, // contractor email stored separately — use company email fallback
        subject: `✅ Document Signed: ${send.template_name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px">
            <div style="background:#16a34a;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center">
              <h2 style="margin:0">Document Signed</h2>
            </div>
            <div style="background:#f9fafb;padding:25px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <p style="font-size:16px;color:#374151">Good news! <strong>${signedName}</strong> has signed the document:</p>
              <div style="background:#fff;border:1px solid #d1fae5;border-left:4px solid #16a34a;padding:15px;border-radius:6px;margin:15px 0">
                <strong style="color:#065f46">${send.template_name}</strong><br>
                <span style="color:#6b7280;font-size:14px">Signed on ${new Date().toLocaleString()}</span>
              </div>
              <p style="color:#6b7280;font-size:14px">Log in to your CRM to view the signed document and download a copy.</p>
            </div>
          </div>
        `,
      }).catch(() => {}); // non-blocking — don't fail the sign flow if email fails

      setSend(prev => prev ? { ...prev, status: 'signed', signed_name: signedName } : prev);
      setStep('done');
    } catch (err) {
      alert('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Not Found</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // ── Done state ──
  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Document Signed!</h2>
          <p className="text-gray-500 mb-6">
            Thank you, <strong>{send?.signed_name ?? 'you'}</strong>. A copy has been sent to the contractor.
          </p>
          <p className="text-sm text-gray-400">You may now close this window.</p>
        </div>
      </div>
    );
  }

  // ── Review step ──
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Banner */}
        <div className="bg-green-700 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow">
          <div>
            <div className="font-bold text-lg">{send?.template_name}</div>
            <div className="text-green-200 text-sm">Please review this document before signing</div>
          </div>
          <Button
            className="bg-white text-green-700 hover:bg-green-50 font-bold px-6"
            onClick={() => setStep('sign')}
          >
            <PenLine className="w-4 h-4 mr-2" />
            Proceed to Sign
          </Button>
        </div>

        {/* Document */}
        <div className="flex-1 overflow-auto py-8 px-4">
          <div
            className="bg-white max-w-4xl mx-auto shadow-lg rounded-lg p-10"
            dangerouslySetInnerHTML={{ __html: send?.document_html ?? '' }}
          />
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-center">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white px-10 py-3 text-base font-bold"
            onClick={() => setStep('sign')}
          >
            <PenLine className="w-5 h-5 mr-2" />
            Sign This Document
          </Button>
        </div>
      </div>
    );
  }

  // ── Sign step ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Sign Document</h2>
        <p className="text-sm text-gray-500 mb-6">{send?.template_name}</p>

        {/* Full name */}
        <div className="mb-5">
          <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Full Name <span className="text-red-500">*</span></Label>
          <Input
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
            placeholder="Type your full legal name"
            className="focus:ring-green-500 focus:border-green-500"
          />
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSignMode('draw')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              signMode === 'draw'
                ? 'bg-green-600 text-white border-green-600'
                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <PenLine className="w-4 h-4" /> Draw
          </button>
          <button
            onClick={() => setSignMode('type')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              signMode === 'type'
                ? 'bg-green-600 text-white border-green-600'
                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Type className="w-4 h-4" /> Type
          </button>
        </div>

        {/* Signature input */}
        {signMode === 'draw' ? (
          <div className="mb-5">
            <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 relative">
              <canvas
                ref={canvasRef}
                width={460}
                height={160}
                className="w-full touch-none cursor-crosshair"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              {!hasDraw && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-gray-400 text-sm">Draw your signature here</span>
                </div>
              )}
            </div>
            <button onClick={clearCanvas} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
          </div>
        ) : (
          <div className="mb-5">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50 text-center"
              style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '2rem', color: '#1a1a2e', minHeight: 80 }}
            >
              {typedName || <span className="text-gray-300 text-base not-italic" style={{ fontFamily: 'inherit' }}>Your signature will appear here</span>}
            </div>
          </div>
        )}

        {/* Legal notice */}
        <p className="text-xs text-gray-400 mb-6">
          By clicking "Submit Signature" you agree that this electronic signature is the legal equivalent of your handwritten signature.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('review')} className="flex-1">Back to Review</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !typedName.trim() || (signMode === 'draw' && !hasDraw)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {submitting ? 'Submitting…' : 'Submit Signature'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SignDocument;
