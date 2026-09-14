// Copied from QuoteMGR src/components/PhotoPositionEditor.tsx (read-only reference).
import React, { useEffect, useRef, useState } from 'react';

interface Props {
    photoUrl: string;
    /** Current zoom multiplier, e.g. 1 = 100% (fills the frame edge to edge, like object-fit: cover). */
    zoom: number;
    /** Focal point as a percentage of the photo's own rendered size (0-100), NOT of the frame. */
    offsetX: number;
    offsetY: number;
    onZoomChange: (zoom: number) => void;
    onOffsetChange: (offsetX: number, offsetY: number) => void;
    /** 'circle' for avatar-style photos (e.g. sales rep headshot), 'rect' for wide photos (e.g. cover photo). */
    shape: 'circle' | 'rect';
    /** Height in px of the live editor surface. Defaults to a sensible size per shape. */
    editorHeight?: number;
    /** Optional override for the minimum zoom. Defaults to whatever fits the whole photo in the frame. */
    zoomMin?: number;
    zoomMax?: number;
    hint?: string;
}

/**
 * A live, WYSIWYG photo-position editor: shows the photo at its actual zoom level
 * (not a flat/unzoomed thumbnail) and lets the user drag directly on it to set the
 * focal point (offsetX/offsetY), plus a slider to zoom in or out.
 *
 * zoom = 1 fills the frame edge to edge (like `object-fit: cover`). Zooming out goes
 * below that down to a photo-specific minimum — computed from the photo's own aspect
 * ratio — at which point the ENTIRE photo fits inside the frame with no cropping at
 * all. When the photo is smaller than the frame in a dimension, the visible box itself
 * shrinks to hug the photo in that dimension (instead of leaving a blank/letterboxed
 * gap around it), so zooming out visually shrinks the photo rather than adding a
 * border around it.
 *
 * This is the exact same math (computeFramedLayout, including the box-shrink
 * behavior) used by the native mobile app's editor and by the customer-facing
 * proposal renderer (quoteHtmlRenderer.ts), so what you set here is exactly what
 * ships everywhere else — no separate, disconnected "crop section" preview, and no
 * drift between platforms.
 *
 * Uses Pointer Events (with pointer capture) so dragging is unified and reliable
 * across mouse and touch input, which matters most on mobile.
 */
const PhotoPositionEditor: React.FC<Props> = ({
    photoUrl,
    zoom,
    offsetX,
    offsetY,
    onZoomChange,
    onOffsetChange,
    shape,
    editorHeight,
    zoomMin: zoomMinProp,
    zoomMax = 3,
    hint,
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const [frameW, setFrameW] = useState(0);
    const [natSize, setNatSize] = useState({ w: 0, h: 0 });

    const height = editorHeight ?? (shape === 'circle' ? 200 : 176);
    const frameH = height;

    // Measure the editor's actual rendered width (it's `w-full`, so this can't be
    // known in advance) and re-measure on resize.
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        const measure = () => setFrameW(el.clientWidth);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (!photoUrl) {
            setNatSize({ w: 0, h: 0 });
            return;
        }
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled) setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.src = photoUrl;
        return () => {
            cancelled = true;
        };
    }, [photoUrl]);

    // zoom = 1 -> "cover" (fills frame, crops the longer dimension).
    // zoomMin -> "contain" (whole photo visible, letterboxed on the shorter side
    // before the box-shrink below removes the letterbox).
    let coverScale = 0;
    let zoomMinComputed = 1;
    if (frameW && frameH && natSize.w && natSize.h) {
        coverScale = Math.max(frameW / natSize.w, frameH / natSize.h);
        const containScale = Math.min(frameW / natSize.w, frameH / natSize.h);
        zoomMinComputed = Math.min(1, containScale / coverScale);
    }
    const zoomMin = zoomMinProp ?? zoomMinComputed;
    const effectiveZoom = Math.max(zoomMin, Math.min(zoomMax, zoom));
    const imgW = natSize.w * coverScale * effectiveZoom;
    const imgH = natSize.h * coverScale * effectiveZoom;

    // The visible box shrinks to hug the photo in any dimension where the photo is
    // smaller than the frame, instead of leaving a blank gap — same box-shrink
    // behavior as the native app editor and the customer-facing PDF renderer. A
    // circle can't shrink each axis independently (that would clip the photo into
    // an off-center ellipse instead of a centered circle), so both are pinned to
    // the same, smaller dimension.
    let boxW: number;
    let boxH: number;
    if (shape === 'circle') {
        const boxD = frameW ? Math.min(imgW, imgH, frameW, frameH) : 0;
        boxW = boxD;
        boxH = boxD;
    } else {
        boxW = frameW ? Math.min(imgW, frameW) : 0;
        boxH = Math.min(imgH, frameH);
    }
    const imgLeft = boxW >= imgW ? 0 : boxW / 2 - (offsetX / 100) * imgW;
    const imgTop = boxH >= imgH ? 0 : boxH / 2 - (offsetY / 100) * imgH;

    const dragStart = useRef({ x: offsetX, y: offsetY, clientX: 0, clientY: 0 });

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        dragStart.current = { x: offsetX, y: offsetY, clientX: e.clientX, clientY: e.clientY };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragging || !imgW || !imgH) return;
        const dx = e.clientX - dragStart.current.clientX;
        const dy = e.clientY - dragStart.current.clientY;
        // Only an axis where the box is actually smaller than the photo has any
        // room to pan — matches the box-shrink behavior above.
        const nextX = boxW >= imgW ? offsetX : Math.max(0, Math.min(100, dragStart.current.x - (dx / imgW) * 100));
        const nextY = boxH >= imgH ? offsetY : Math.max(0, Math.min(100, dragStart.current.y - (dy / imgH) * 100));
        onOffsetChange(Math.round(nextX), Math.round(nextY));
    };

    const stopDragging = () => setDragging(false);

    return (
        <div className="space-y-2">
            <div
                ref={editorRef}
                className={`relative w-full flex items-center justify-center bg-gray-100 select-none overflow-hidden ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
                style={{
                    height,
                    ...(shape === 'circle' ? { width: height, maxWidth: '100%', margin: '0 auto' } : {}),
                    cursor: dragging ? 'grabbing' : 'grab',
                    touchAction: 'none',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDragging}
                onPointerLeave={stopDragging}
                onPointerCancel={stopDragging}
            >
                {!!photoUrl && !!natSize.w && !!frameW && (
                    <div
                        className={`relative overflow-hidden ${shape === 'circle' ? 'rounded-full' : ''}`}
                        style={{ width: boxW, height: boxH }}
                    >
                        <img
                            src={photoUrl}
                            alt=""
                            draggable={false}
                            className="absolute pointer-events-none"
                            style={{ width: imgW, height: imgH, left: imgLeft, top: imgTop }}
                        />
                    </div>
                )}
                {/* Fixed center reticle — this is always the point in the photo that
                    onOffsetChange reports, since dragging moves the photo underneath it. */}
                <div
                    className="absolute left-1/2 top-1/2 pointer-events-none w-2.5 h-2.5 rounded-full bg-white shadow border border-black/20"
                    style={{ transform: 'translate(-50%, -50%)' }}
                />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">🔍</span>
                <input
                    type="range"
                    min={zoomMin}
                    max={zoomMax}
                    step={0.05}
                    value={effectiveZoom}
                    onChange={e => onZoomChange(parseFloat(e.target.value))}
                    className="flex-1 accent-[#ff6b35]"
                />
                <span className="text-xs text-gray-400 w-10 text-right">{Math.round(effectiveZoom * 100)}%</span>
            </div>
            <p className="text-xs text-gray-400 leading-tight">
                {hint ?? 'Drag the photo to reposition · use the slider to zoom in or out'}
            </p>
        </div>
    );
};

export default PhotoPositionEditor;

interface FramedPhotoPreviewProps {
    photoUrl: string;
    zoom: number;
    offsetX: number;
    offsetY: number;
    /** Sizing/shape/positioning classes for the outer frame (e.g. "w-full h-44" or "absolute inset-0 w-full h-full"). */
    className?: string;
    /** 'circle' keeps the visible box a perfect (shrinking) circle instead of an
     * independently-shrinking rect — use for avatar-style photos. Defaults to 'rect'. */
    shape?: 'rect' | 'circle';
}

/**
 * A small, non-interactive, read-only preview that renders a photo using the exact
 * same natural-size-aware zoom/offset math (and box-shrink behavior) as
 * PhotoPositionEditor, so quick-glance thumbnails elsewhere in the app never drift
 * out of sync with the live editor or the customer-facing PDF.
 */
export const FramedPhotoPreview: React.FC<FramedPhotoPreviewProps> = ({ photoUrl, zoom, offsetX, offsetY, className, shape = 'rect' }) => {
    const frameRef = useRef<HTMLDivElement>(null);
    const [frame, setFrame] = useState({ w: 0, h: 0 });
    const [natSize, setNatSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const el = frameRef.current;
        if (!el) return;
        const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (!photoUrl) {
            setNatSize({ w: 0, h: 0 });
            return;
        }
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled) setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.src = photoUrl;
        return () => {
            cancelled = true;
        };
    }, [photoUrl]);

    let imgW = 0;
    let imgH = 0;
    let boxW = frame.w;
    let boxH = frame.h;
    if (frame.w && frame.h && natSize.w && natSize.h) {
        const coverScale = Math.max(frame.w / natSize.w, frame.h / natSize.h);
        const containScale = Math.min(frame.w / natSize.w, frame.h / natSize.h);
        const zoomMin = Math.min(1, containScale / coverScale);
        const z = Math.max(zoomMin, Math.min(3, zoom));
        imgW = natSize.w * coverScale * z;
        imgH = natSize.h * coverScale * z;
        // Same uniform-diameter box-shrink as PhotoPositionEditor: a circle can't
        // shrink each axis independently without clipping into an ellipse.
        if (shape === 'circle') {
            const boxD = Math.min(imgW, imgH, frame.w, frame.h);
            boxW = boxD;
            boxH = boxD;
        } else {
            boxW = Math.min(imgW, frame.w);
            boxH = Math.min(imgH, frame.h);
        }
    }
    const imgLeft = boxW >= imgW ? 0 : boxW / 2 - (offsetX / 100) * imgW;
    const imgTop = boxH >= imgH ? 0 : boxH / 2 - (offsetY / 100) * imgH;

    return (
        <div ref={frameRef} className={`flex items-center justify-center overflow-hidden bg-gray-100 ${className ?? ''}`}>
            {!!photoUrl && !!natSize.w && !!frame.w && (
                <div
                    className={`relative overflow-hidden ${shape === 'circle' ? 'rounded-full' : ''}`}
                    style={{ width: boxW, height: boxH }}
                >
                    <img
                        src={photoUrl}
                        alt=""
                        draggable={false}
                        className="absolute pointer-events-none"
                        style={{ width: imgW, height: imgH, left: imgLeft, top: imgTop }}
                    />
                </div>
            )}
        </div>
    );
};
