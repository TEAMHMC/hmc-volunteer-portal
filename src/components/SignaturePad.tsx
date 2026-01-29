import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

interface SignaturePadProps {
  width?: number;
  height?: number;
}

export interface SignaturePadRef {
  clear: () => void;
  getSignature: () => string | null; // Returns base64 data URL
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(({ width = 400, height = 200 }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getCoords = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (e instanceof MouseEvent) {
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      }
      return null;
    };
    
    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawing.current = true;
      lastPoint.current = getCoords(e);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing.current || !lastPoint.current) return;
      e.preventDefault();
      const currentPoint = getCoords(e);
      if (!currentPoint) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();
      
      lastPoint.current = currentPoint;
    };

    const stopDrawing = () => {
      isDrawing.current = false;
      lastPoint.current = null;
    };

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    // Touch events
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
      canvas.removeEventListener('touchcancel', stopDrawing);
    };
  }, [width, height]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    },
    getSignature: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Check if canvas is blank
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        if (canvas.toDataURL() === blank.toDataURL()) {
            return null;
        }
        return canvas.toDataURL('image/png');
      }
      return null;
    }
  }));

  return (
    <canvas
      ref={canvasRef}
      className="bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-lg cursor-crosshair"
    />
  );
});

export default SignaturePad;