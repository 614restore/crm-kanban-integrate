// Copied from QuoteMGR src/components/PhotoMarkupEditor.tsx (read-only reference).
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Pen, ArrowRight, Circle, Square, Type, Trash2, Undo2, Check, Minus, Plus, Move, Crop } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Tool = 'pen' | 'arrow' | 'circle' | 'rectangle' | 'text' | 'move';

const COLORS = [
    { label: 'Red',    value: '#ef4444' },
    { label: 'Yellow', value: '#f59e0b' },
    { label: 'Green',  value: '#22c55e' },
    { label: 'Blue',   value: '#3b82f6' },
    { label: 'White',  value: '#ffffff' },
    { label: 'Black',  value: '#000000' },
];

interface Stroke {
    tool: Exclude<Tool, 'text'>;
    color: string;
    lineWidth: number;
    points?: { x: number; y: number }[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
}

/** Text annotations live as floating HTML elements so they can be dragged */
interface TextAnnotation {
    id: string;
    text: string;
    x: number; // canvas-coordinate x
    y: number; // canvas-coordinate y (baseline)
    color: string;
    fontSize: number;
}

interface Props {
    photoUrl: string;
    photoId: string;
    onSave: (annotatedUrl: string) => void;
    onClose: () => void;
    /** Called when user clicks "Crop" in the toolbar — parent should open crop modal */
    onCrop?: () => void;
}

const PhotoMarkupEditor: React.FC<Props> = ({ photoUrl, photoId, onSave, onClose, onCrop }) => {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const [tool, setTool]           = useState<Tool>('pen');
    const [color, setColor]         = useState('#ef4444');
    const [lineWidth, setLineWidth] = useState(3);
    const [strokes, setStrokes]     = useState<Stroke[]>([]);
    const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);

    const [isDrawing, setIsDrawing]   = useState(false);
    const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
    const [startPos, setStartPos]     = useState<{ x: number; y: number } | null>(null);
    const [saving, setSaving]         = useState(false);

    // Pending text input
    const [textPos, setTextPos]     = useState<{ x: number; y: number } | null>(null);
    const [textInput, setTextInput] = useState('');

    // Dragging a placed text annotation
    const [draggingId, setDraggingId]           = useState<string | null>(null);
    const [dragOffset, setDragOffset]           = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Moving a canvas stroke (move tool)
    const [movingStrokeIdx, setMovingStrokeIdx] = useState<number | null>(null);
    const moveStartPosRef                        = useRef<{ x: number; y: number } | null>(null);
    const moveStrokeSnapshotRef                  = useRef<Stroke | null>(null);
    const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
    const [editingText, setEditingText]         = useState('');

    const [imgLoaded, setImgLoaded]   = useState(false);
    const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

    // ── Load image ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = photoUrl;
        img.onload = () => {
            imgRef.current = img;
            const maxW = Math.min(window.innerWidth - 80, 1200);
            const maxH = window.innerHeight - 200;
            const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
            setCanvasSize({ w: Math.round(img.naturalWidth * ratio), h: Math.round(img.naturalHeight * ratio) });
            setImgLoaded(true);
        };
    }, [photoUrl]);

    // ── Redraw strokes (text is HTML, not drawn here) ────────────────────────
    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        const img    = imgRef.current;
        if (!canvas || !img || !imgLoaded) return;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        strokes.forEach(stroke => {
            ctx.strokeStyle = stroke.color;
            ctx.fillStyle   = stroke.color;
            ctx.lineWidth   = stroke.lineWidth;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';

            if (stroke.tool === 'pen' && stroke.points && stroke.points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            } else if (stroke.tool === 'arrow' && stroke.start && stroke.end) {
                drawArrow(ctx, stroke.start, stroke.end, stroke.lineWidth);
            } else if (stroke.tool === 'circle' && stroke.start && stroke.end) {
                const rx = Math.abs(stroke.end.x - stroke.start.x) / 2;
                const ry = Math.abs(stroke.end.y - stroke.start.y) / 2;
                const cx = Math.min(stroke.start.x, stroke.end.x) + rx;
                const cy = Math.min(stroke.start.y, stroke.end.y) + ry;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (stroke.tool === 'rectangle' && stroke.start && stroke.end) {
                ctx.beginPath();
                ctx.strokeRect(
                    Math.min(stroke.start.x, stroke.end.x),
                    Math.min(stroke.start.y, stroke.end.y),
                    Math.abs(stroke.end.x - stroke.start.x),
                    Math.abs(stroke.end.y - stroke.start.y)
                );
            }
        });
    }, [strokes, imgLoaded]);

    useEffect(() => { redraw(); }, [redraw]);

    // ── Arrow helper ─────────────────────────────────────────────────────────
    function drawArrow(
        ctx: CanvasRenderingContext2D,
        from: { x: number; y: number },
        to:   { x: number; y: number },
        lw: number
    ) {
        const headLen = Math.max(15, lw * 4);
        const angle   = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 7), to.y - headLen * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 7), to.y - headLen * Math.sin(angle + Math.PI / 7));
        ctx.lineTo(to.x, to.y);
        ctx.fill();
    }

    // ── Move-tool helpers ─────────────────────────────────────────────────────
    const distToSegment = (
        p: { x: number; y: number },
        a: { x: number; y: number },
        b: { x: number; y: number }
    ): number => {
        const dx = b.x - a.x, dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    };

    const hitTestStrokes = (pos: { x: number; y: number }, ss: Stroke[]): number => {
        for (let i = ss.length - 1; i >= 0; i--) {
            const s   = ss[i];
            const pad = Math.max(s.lineWidth * 2, 12);
            if ((s.tool === 'circle' || s.tool === 'rectangle') && s.start && s.end) {
                const minX = Math.min(s.start.x, s.end.x) - pad;
                const maxX = Math.max(s.start.x, s.end.x) + pad;
                const minY = Math.min(s.start.y, s.end.y) - pad;
                const maxY = Math.max(s.start.y, s.end.y) + pad;
                if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) return i;
            } else if (s.tool === 'arrow' && s.start && s.end) {
                if (distToSegment(pos, s.start, s.end) <= pad) return i;
            } else if (s.tool === 'pen' && s.points) {
                for (const p of s.points) {
                    if (Math.abs(p.x - pos.x) <= pad && Math.abs(p.y - pos.y) <= pad) { return i; }
                }
            }
        }
        return -1;
    };

    const translateStroke = (stroke: Stroke, dx: number, dy: number): Stroke => {
        if (stroke.points) {
            return { ...stroke, points: stroke.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        }
        return {
            ...stroke,
            start: stroke.start ? { x: stroke.start.x + dx, y: stroke.start.y + dy } : undefined,
            end:   stroke.end   ? { x: stroke.end.x   + dx, y: stroke.end.y   + dy } : undefined,
        };
    };

    // ── Get canvas-space position from a pointer event ───────────────────────
    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top)  * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY,
        };
    };

    // ── Drawing handlers ──────────────────────────────────────────────────────
    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (tool === 'text') return;
        const pos = getPos(e);

        // Move tool: hit-test strokes and start drag
        if (tool === 'move') {
            const idx = hitTestStrokes(pos, strokes);
            if (idx >= 0) {
                setMovingStrokeIdx(idx);
                moveStartPosRef.current      = pos;
                const s = strokes[idx];
                moveStrokeSnapshotRef.current = {
                    ...s,
                    points: s.points ? s.points.map(p => ({ ...p })) : undefined,
                    start:  s.start  ? { ...s.start } : undefined,
                    end:    s.end    ? { ...s.end }   : undefined,
                };
            }
            return;
        }

        setIsDrawing(true);
        setStartPos(pos);
        setCurrentPoints([pos]);
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        // Move tool: translate the grabbed stroke live
        if (tool === 'move') {
            if (movingStrokeIdx === null || !moveStartPosRef.current || !moveStrokeSnapshotRef.current) return;
            const pos = getPos(e);
            const dx  = pos.x - moveStartPosRef.current.x;
            const dy  = pos.y - moveStartPosRef.current.y;
            const moved = translateStroke(moveStrokeSnapshotRef.current, dx, dy);
            setStrokes(s => s.map((stroke, i) => i === movingStrokeIdx ? moved : stroke));
            return;
        }

        if (!isDrawing || tool === 'text') return;
        const pos = getPos(e);

        if (tool === 'pen') {
            setCurrentPoints(pts => [...pts, pos]);
            const oc = overlayRef.current;
            if (oc) {
                const ctx = oc.getContext('2d')!;
                ctx.strokeStyle = color;
                ctx.lineWidth   = lineWidth;
                ctx.lineCap     = 'round';
                ctx.lineJoin    = 'round';
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }
        } else {
            const oc = overlayRef.current;
            if (!oc || !startPos) return;
            const ctx = oc.getContext('2d')!;
            ctx.clearRect(0, 0, oc.width, oc.height);
            ctx.strokeStyle = color;
            ctx.fillStyle   = color;
            ctx.lineWidth   = lineWidth;
            ctx.lineCap     = 'round';
            if (tool === 'arrow') drawArrow(ctx, startPos, pos, lineWidth);
            else if (tool === 'circle') {
                const rx = Math.abs(pos.x - startPos.x) / 2;
                const ry = Math.abs(pos.y - startPos.y) / 2;
                ctx.beginPath();
                ctx.ellipse(Math.min(startPos.x, pos.x) + rx, Math.min(startPos.y, pos.y) + ry, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (tool === 'rectangle') {
                ctx.beginPath();
                ctx.strokeRect(
                    Math.min(startPos.x, pos.x), Math.min(startPos.y, pos.y),
                    Math.abs(pos.x - startPos.x), Math.abs(pos.y - startPos.y)
                );
            }
        }
    };

    const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
        // Move tool: finalize stroke position
        if (tool === 'move') {
            setMovingStrokeIdx(null);
            moveStartPosRef.current      = null;
            moveStrokeSnapshotRef.current = null;
            return;
        }

        if (!isDrawing || tool === 'text') return;
        const pos = getPos(e);
        setIsDrawing(false);
        const oc = overlayRef.current;
        if (oc) oc.getContext('2d')!.clearRect(0, 0, oc.width, oc.height);
        if (tool === 'pen' && currentPoints.length > 1) {
            setStrokes(s => [...s, { tool, color, lineWidth, points: [...currentPoints, pos] }]);
        } else if (startPos && (tool === 'arrow' || tool === 'circle' || tool === 'rectangle')) {
            setStrokes(s => [...s, { tool, color, lineWidth, start: startPos, end: pos }]);
        }
        setCurrentPoints([]);
        setStartPos(null);
    };

    // ── Text: click canvas to place ───────────────────────────────────────────
    const handleCanvasClick = (e: React.MouseEvent) => {
        if (tool !== 'text' || movingStrokeIdx !== null) return;
        // Don't create a new text if we were just finishing a drag
        if (draggingId) return;
        const pos = getPos(e);
        setTextPos(pos);
        setTextInput('');
    };

    const commitText = () => {
        if (!textPos || !textInput.trim()) { setTextPos(null); return; }
        setTextAnnotations(prev => [...prev, {
            id:       `txt-${Date.now()}`,
            text:     textInput.trim(),
            x:        textPos.x,
            y:        textPos.y,
            color,
            fontSize: lineWidth * 5 + 10,
        }]);
        setTextPos(null);
        setTextInput('');
    };

    // ── Text drag ─────────────────────────────────────────────────────────────
    // We track dragging on the HTML overlay elements using canvas-space coords.
    const handleTextMouseDown = (e: React.MouseEvent, ann: TextAnnotation) => {
        e.stopPropagation();
        e.preventDefault();
        const canvas = canvasRef.current!;
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseCanvasX = (e.clientX - rect.left) * scaleX;
        const mouseCanvasY = (e.clientY - rect.top)  * scaleY;
        setDraggingId(ann.id);
        setDragOffset({ x: mouseCanvasX - ann.x, y: mouseCanvasY - ann.y });
    };

    // Touch mirror of handleTextMouseDown — without this, dragging a text
    // label on a touchscreen (tablet/phone, the usual device in the field)
    // never starts, since only mouse events were wired up here.
    const handleTextTouchStart = (e: React.TouchEvent, ann: TextAnnotation) => {
        e.stopPropagation();
        const touch = e.touches[0];
        if (!touch) return;
        const canvas = canvasRef.current!;
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const touchCanvasX = (touch.clientX - rect.left) * scaleX;
        const touchCanvasY = (touch.clientY - rect.top)  * scaleY;
        setDraggingId(ann.id);
        setDragOffset({ x: touchCanvasX - ann.x, y: touchCanvasY - ann.y });
    };

    const handleMouseMoveGlobal = useCallback((e: MouseEvent) => {
        if (!draggingId) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const newX = (e.clientX - rect.left) * scaleX - dragOffset.x;
        const newY = (e.clientY - rect.top)  * scaleY - dragOffset.y;
        setTextAnnotations(prev => prev.map(a =>
            a.id === draggingId
                ? { ...a, x: Math.max(0, Math.min(canvas.width - 10, newX)), y: Math.max(a.fontSize, Math.min(canvas.height, newY)) }
                : a
        ));
    }, [draggingId, dragOffset]);

    const handleTouchMoveGlobal = useCallback((e: TouchEvent) => {
        if (!draggingId) return;
        const touch = e.touches[0];
        if (!touch) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        e.preventDefault();
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const newX = (touch.clientX - rect.left) * scaleX - dragOffset.x;
        const newY = (touch.clientY - rect.top)  * scaleY - dragOffset.y;
        setTextAnnotations(prev => prev.map(a =>
            a.id === draggingId
                ? { ...a, x: Math.max(0, Math.min(canvas.width - 10, newX)), y: Math.max(a.fontSize, Math.min(canvas.height, newY)) }
                : a
        ));
    }, [draggingId, dragOffset]);

    const handleMouseUpGlobal = useCallback(() => {
        setDraggingId(null);
    }, []);

    useEffect(() => {
        if (draggingId) {
            window.addEventListener('mousemove', handleMouseMoveGlobal);
            window.addEventListener('mouseup',   handleMouseUpGlobal);
            window.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
            window.addEventListener('touchend',  handleMouseUpGlobal);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMoveGlobal);
            window.removeEventListener('mouseup',   handleMouseUpGlobal);
            window.removeEventListener('touchmove', handleTouchMoveGlobal);
            window.removeEventListener('touchend',  handleMouseUpGlobal);
        };
    }, [draggingId, handleMouseMoveGlobal, handleTouchMoveGlobal, handleMouseUpGlobal]);

    // ── Inline edit of placed text ────────────────────────────────────────────
    const startEditAnnotation = (e: React.MouseEvent, ann: TextAnnotation) => {
        e.stopPropagation();
        setEditingAnnotationId(ann.id);
        setEditingText(ann.text);
    };

    const commitEditAnnotation = () => {
        if (!editingAnnotationId) return;
        if (!editingText.trim()) {
            setTextAnnotations(prev => prev.filter(a => a.id !== editingAnnotationId));
        } else {
            setTextAnnotations(prev => prev.map(a =>
                a.id === editingAnnotationId ? { ...a, text: editingText.trim() } : a
            ));
        }
        setEditingAnnotationId(null);
        setEditingText('');
    };

    const removeAnnotation = (id: string) => {
        setTextAnnotations(prev => prev.filter(a => a.id !== id));
    };

    // ── Undo / clear ─────────────────────────────────────────────────────────
    const undo = () => {
        // Undo either the last stroke or the last text annotation
        if (textAnnotations.length > 0 && (strokes.length === 0 || true)) {
            // Check which was added more recently by id/timestamp — simplest: pop last text if strokes is same length
            setTextAnnotations(prev => prev.slice(0, -1));
        } else {
            setStrokes(s => s.slice(0, -1));
        }
    };

    const undoStroke = () => setStrokes(s => s.slice(0, -1));
    const undoText   = () => setTextAnnotations(t => t.slice(0, -1));
    const clear = () => { setStrokes([]); setTextAnnotations([]); };

    // ── Save: flatten text onto canvas, then upload ───────────────────────────
    // canvas 2D fillText never wraps on its own — it always draws on one line no
    // matter how long the string is. Break the text into lines that fit within
    // maxWidth ourselves, matching the wrapping the live <span> preview does.
    const wrapCanvasText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
        const lines: string[] = [];
        for (const paragraph of text.split('\n')) {
            const words = paragraph.split(' ');
            let line = '';
            for (const word of words) {
                const candidate = line ? `${line} ${word}` : word;
                if (line && ctx.measureText(candidate).width > maxWidth) {
                    lines.push(line);
                    line = word;
                } else {
                    line = candidate;
                }
            }
            lines.push(line);
        }
        return lines;
    };

    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setSaving(true);
        try {
            // Draw text annotations onto the persistent canvas before exporting
            const ctx = canvas.getContext('2d')!;
            textAnnotations.forEach(ann => {
                ctx.font        = `bold ${ann.fontSize}px sans-serif`;
                ctx.fillStyle   = ann.color;
                ctx.shadowColor = ann.color === '#ffffff' ? '#000' : '#fff';
                ctx.shadowBlur  = 3;
                const maxWidth  = Math.max(120, canvas.width - ann.x - 10);
                const lineHeight = ann.fontSize * 1.15;
                const lines = wrapCanvasText(ctx, ann.text, maxWidth);
                lines.forEach((line, i) => ctx.fillText(line, ann.x, ann.y + i * lineHeight));
                ctx.shadowBlur  = 0;
            });

            const blob = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas empty')), 'image/jpeg', 0.92)
            );
            // Flat filename with NO embedded UUID — the quote-photos storage policy
            // allows uploads whose path contains no UUID at all (see storage_path_has_no_uuid),
            // same convention as the plain photo upload in PhotoUploader.tsx. Embedding photoId
            // (a quote_photos.id, not the quote's id) here used to trip the ownership check and
            // get the save rejected by row-level security.
            const fileName = `annotated-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            const { error } = await supabase.storage.from('quote-photos').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(fileName);
            onSave(urlData.publicUrl);
            toast.success('Annotated photo saved!');
        } catch {
            toast.error('Failed to save annotated photo');
        } finally {
            setSaving(false);
        }
    };

    const hasAnnotations = strokes.length > 0 || textAnnotations.length > 0;

    const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
        { id: 'pen',       icon: <Pen className="w-4 h-4" />,       label: 'Pen' },
        { id: 'arrow',     icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
        { id: 'circle',    icon: <Circle className="w-4 h-4" />,     label: 'Oval' },
        { id: 'rectangle', icon: <Square className="w-4 h-4" />,     label: 'Box' },
        { id: 'text',      icon: <Type className="w-4 h-4" />,       label: 'Text' },
        { id: 'move',      icon: <Move className="w-4 h-4" />,       label: 'Move' },
    ];

    // Scale factor for converting canvas coords → CSS pixels for text overlay
    const cssScaleX = canvasSize.w > 0 ? 1 : 1; // elements use the same coordinate space — we scale via transform
    void cssScaleX;

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-700 flex-wrap">
                <span className="text-white font-semibold text-sm mr-2">Photo Markup</span>

                <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                    {tools.map(t => (
                        <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                tool === t.id ? 'bg-[#1e3a5f] text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}>
                            {t.icon}
                            <span className="hidden sm:inline">{t.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex gap-1.5 ml-2">
                    {COLORS.map(c => (
                        <button key={c.value} onClick={() => setColor(c.value)} title={c.label}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c.value ? 'border-white scale-125' : 'border-gray-600 hover:border-gray-400'}`}
                            style={{ backgroundColor: c.value }} />
                    ))}
                </div>

                <div className="flex items-center gap-1.5 ml-2">
                    <button onClick={() => setLineWidth(w => Math.max(1, w - 1))} className="text-gray-400 hover:text-white"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="text-white text-xs w-4 text-center">{lineWidth}</span>
                    <button onClick={() => setLineWidth(w => Math.min(12, w + 1))} className="text-gray-400 hover:text-white"><Plus className="w-3.5 h-3.5" /></button>
                </div>

                <div className="flex-1" />

                <button onClick={undoText} disabled={textAnnotations.length === 0} title="Undo last text"
                    className="flex items-center gap-1 px-2 py-1.5 text-gray-400 hover:text-white disabled:opacity-40 text-xs rounded-md hover:bg-gray-700">
                    <Type className="w-3.5 h-3.5" /><Undo2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={undoStroke} disabled={strokes.length === 0} title="Undo last stroke"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-gray-400 hover:text-white disabled:opacity-40 text-xs rounded-md hover:bg-gray-700">
                    <Undo2 className="w-4 h-4" />
                </button>
                <button onClick={clear} disabled={!hasAnnotations} title="Clear all"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-gray-400 hover:text-red-400 disabled:opacity-40 text-xs rounded-md hover:bg-gray-700">
                    <Trash2 className="w-4 h-4" />
                </button>
                {onCrop && (
                    <button onClick={() => { onClose(); onCrop(); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-semibold transition-colors"
                        title="Switch to crop tool">
                        <Crop className="w-4 h-4" />
                        <span className="hidden sm:inline">Crop</span>
                    </button>
                )}
                <button onClick={handleSave} disabled={saving || !hasAnnotations}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#ff6b35] hover:bg-[#e55a2b] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
                    <Check className="w-4 h-4" />
                    {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={onClose} className="text-gray-400 hover:text-white ml-1"><X className="w-5 h-5" /></button>
            </div>

            {/* Canvas area */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-4" ref={containerRef}>
                {imgLoaded && (
                    <div className="relative select-none" style={{ width: canvasSize.w, height: canvasSize.h }}>
                        {/* Base canvas */}
                        <canvas
                            ref={canvasRef}
                            width={canvasSize.w}
                            height={canvasSize.h}
                            className="absolute inset-0 rounded-lg"
                            style={{
                                cursor: tool === 'move'
                                    ? (movingStrokeIdx !== null ? 'grabbing' : 'grab')
                                    : 'crosshair',
                                touchAction: 'none',
                            }}
                            onMouseDown={handlePointerDown}
                            onMouseMove={handlePointerMove}
                            onMouseUp={handlePointerUp}
                            onMouseLeave={handlePointerUp}
                            onClick={handleCanvasClick}
                            onTouchStart={handlePointerDown}
                            onTouchMove={handlePointerMove}
                            onTouchEnd={handlePointerUp}
                        />
                        {/* Overlay canvas (live preview) */}
                        <canvas ref={overlayRef} width={canvasSize.w} height={canvasSize.h}
                            className="absolute inset-0 pointer-events-none" />

                        {/* ── Draggable text annotations ── */}
                        {textAnnotations.map(ann => {
                            // Convert canvas coords to CSS pixels (canvas is displayed at canvasSize.w CSS px but internally is canvasSize.w px too → scale = 1)
                            const cssFontSize = ann.fontSize;
                            const cssX = ann.x;
                            const cssY = ann.y - ann.fontSize; // position top-left of the element at baseline

                            return (
                                <div
                                    key={ann.id}
                                    className="absolute group"
                                    style={{
                                        left: cssX,
                                        top:  cssY,
                                        cursor: draggingId === ann.id ? 'grabbing' : 'grab',
                                        userSelect: 'none',
                                    }}
                                    onMouseDown={e => handleTextMouseDown(e, ann)}
                                    onTouchStart={e => handleTextTouchStart(e, ann)}
                                    onDoubleClick={e => startEditAnnotation(e, ann)}
                                >
                                    {editingAnnotationId === ann.id ? (
                                        <div className="flex items-center gap-1 bg-gray-900/90 border border-gray-600 rounded-lg px-2 py-1 shadow-xl"
                                             onMouseDown={e => e.stopPropagation()}>
                                            <input
                                                autoFocus
                                                value={editingText}
                                                onChange={e => setEditingText(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') commitEditAnnotation(); if (e.key === 'Escape') setEditingAnnotationId(null); }}
                                                className="bg-gray-800 text-white text-sm px-2 py-0.5 rounded outline-none w-36"
                                            />
                                            <button onClick={commitEditAnnotation} className="text-xs bg-[#ff6b35] text-white px-2 py-0.5 rounded">✓</button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            {/* The visible text label — wraps within the remaining canvas
                                                width instead of running off in one line. */}
                                            <span
                                                style={{
                                                    fontFamily: 'sans-serif',
                                                    fontWeight: 'bold',
                                                    fontSize:   cssFontSize,
                                                    color:      ann.color,
                                                    textShadow: ann.color === '#ffffff' ? '0 0 3px #000, 0 0 3px #000' : '0 0 3px #fff, 0 0 3px #fff',
                                                    lineHeight: 1.15,
                                                    display:    'block',
                                                    maxWidth:   Math.max(120, canvasSize.w - cssX - 10),
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak:  'break-word',
                                                    pointerEvents: 'none',
                                            }}>
                                                {ann.text}
                                            </span>

                                            {/* Controls shown on hover */}
                                            <div className="absolute -top-5 right-0 hidden group-hover:flex items-center gap-0.5 bg-gray-900/80 rounded px-1 py-0.5"
                                                 onMouseDown={e => e.stopPropagation()}>
                                                <span className="text-gray-400 text-xs mr-1 flex items-center gap-0.5">
                                                    <Move className="w-2.5 h-2.5" /> drag
                                                </span>
                                                <button onClick={e => { e.stopPropagation(); startEditAnnotation(e, ann); }}
                                                    className="text-gray-300 hover:text-white text-xs px-1">✎</button>
                                                <button onClick={() => removeAnnotation(ann.id)}
                                                    className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* ── Pending text input (before placing) ── */}
                        {textPos && (
                            <div
                                className="absolute z-10 flex gap-2 items-center bg-gray-900 border border-gray-600 rounded-lg p-2 shadow-xl"
                                style={{ left: Math.min(textPos.x, canvasSize.w - 260), top: Math.max(0, textPos.y - 54) }}
                            >
                                <input
                                    autoFocus
                                    value={textInput}
                                    onChange={e => setTextInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextPos(null); }}
                                    placeholder="Type label…"
                                    className="bg-gray-800 text-white text-sm px-2 py-1 rounded outline-none w-40"
                                />
                                <button onClick={commitText} className="text-xs bg-[#ff6b35] hover:bg-[#e55a2b] text-white px-2 py-1 rounded">Add</button>
                                <button onClick={() => setTextPos(null)} className="text-gray-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                            </div>
                        )}
                    </div>
                )}
                {!imgLoaded && (
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="w-10 h-10 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                        <p className="text-sm">Loading photo…</p>
                    </div>
                )}
            </div>

            {/* Hint bar */}
            <div className="text-center py-2 text-gray-500 text-xs">
                {tool === 'pen'       && 'Click and drag to draw freehand'}
                {tool === 'arrow'     && 'Click and drag to draw an arrow'}
                {tool === 'circle'    && 'Click and drag to draw an oval — great for highlighting damage areas'}
                {tool === 'rectangle' && 'Click and drag to draw a box'}
                {tool === 'text'      && 'Click to place a label · Drag to reposition · Double-click to edit · Hover for delete'}
                {tool === 'move'      && 'Click and drag any shape, arrow, or drawing to reposition it'}
            </div>
        </div>
    );
};

export default PhotoMarkupEditor;
