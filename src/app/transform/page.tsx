"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function TransformPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nickname, setNickname] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("likha-reef-capture");
    if (!stored) {
      router.push("/capture");
      return;
    }
    setOriginalImage(stored);
  }, [router]);

  useEffect(() => {
    if (originalImage) {
      processImage(originalImage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImage]);

  const processImage = useCallback(async (dataUrl: string) => {
    setProcessing(true);

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Work at a reasonable size for performance
      const maxSize = 800;
      let w = img.width;
      let h = img.height;
      if (w > maxSize || h > maxSize) {
        const scale = maxSize / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // ===== FLOOD FILL FROM EDGES =====
      // Only remove white/bright pixels connected to the border.
      // This preserves white areas INSIDE the drawing.
      
      const threshold = 200; // luminance above this is considered "paper"
      const visited = new Uint8Array(w * h);
      const toRemove = new Uint8Array(w * h);

      const getLuminance = (idx: number) => {
        return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      };

      const isBackground = (pixelIdx: number) => {
        const dataIdx = pixelIdx * 4;
        return getLuminance(dataIdx) > threshold;
      };

      // BFS flood fill from all border pixels
      const queue: number[] = [];

      // Seed from all 4 edges
      for (let x = 0; x < w; x++) {
        // Top edge
        const topIdx = x;
        if (isBackground(topIdx)) {
          queue.push(topIdx);
          visited[topIdx] = 1;
          toRemove[topIdx] = 1;
        }
        // Bottom edge
        const botIdx = (h - 1) * w + x;
        if (isBackground(botIdx)) {
          queue.push(botIdx);
          visited[botIdx] = 1;
          toRemove[botIdx] = 1;
        }
      }
      for (let y = 0; y < h; y++) {
        // Left edge
        const leftIdx = y * w;
        if (isBackground(leftIdx)) {
          queue.push(leftIdx);
          visited[leftIdx] = 1;
          toRemove[leftIdx] = 1;
        }
        // Right edge
        const rightIdx = y * w + (w - 1);
        if (isBackground(rightIdx)) {
          queue.push(rightIdx);
          visited[rightIdx] = 1;
          toRemove[rightIdx] = 1;
        }
      }

      // Process BFS queue
      let head = 0;
      while (head < queue.length) {
        const pixelIdx = queue[head++];
        const x = pixelIdx % w;
        const y = Math.floor(pixelIdx / w);

        // Check 4-connected neighbors
        const neighbors = [
          y > 0 ? pixelIdx - w : -1,       // up
          y < h - 1 ? pixelIdx + w : -1,   // down
          x > 0 ? pixelIdx - 1 : -1,       // left
          x < w - 1 ? pixelIdx + 1 : -1,   // right
        ];

        for (const nIdx of neighbors) {
          if (nIdx < 0 || visited[nIdx]) continue;
          visited[nIdx] = 1;
          if (isBackground(nIdx)) {
            toRemove[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }

      // Apply transparency — only for flood-filled background pixels
      for (let i = 0; i < w * h; i++) {
        if (toRemove[i]) {
          const dataIdx = i * 4;
          const lum = getLuminance(dataIdx);
          // Soft edge: pixels near the threshold get partial transparency
          if (lum > threshold + 20) {
            data[dataIdx + 3] = 0; // fully transparent
          } else {
            // Feather the edge
            const alpha = Math.round(255 * (1 - (lum - threshold) / 40));
            data[dataIdx + 3] = Math.max(0, Math.min(255, alpha));
          }
        }
      }

      // ===== POSTERIZE for sticker look =====
      const posterizeLevels = 8;
      const step = 255 / (posterizeLevels - 1);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 30) {
          // Slight posterize — not too aggressive to keep the drawing looking nice
          data[i] = Math.round(Math.round(data[i] / step) * step);
          data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
          data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
        }
      }

      // ===== AUTO-CROP to bounding box =====
      let minX = w, minY = h, maxX = 0, maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (data[idx + 3] > 20) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      // Add padding
      const padding = 10;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(w - 1, maxX + padding);
      maxY = Math.min(h - 1, maxY + padding);

      ctx.putImageData(imageData, 0, 0);

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;

      if (cropW <= 0 || cropH <= 0) {
        const result = canvas.toDataURL("image/png");
        setProcessedImage(result);
        setProcessing(false);
        return;
      }

      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const croppedCtx = croppedCanvas.getContext("2d");
      if (!croppedCtx) return;

      croppedCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

      const result = croppedCanvas.toDataURL("image/png");
      setProcessedImage(result);
      setProcessing(false);
    };
    img.src = dataUrl;
  }, []);

  const handleConfirm = async () => {
    if (!processedImage) return;
    setUploading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/creatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: processedImage,
          nickname: nickname.trim() || null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `Upload failed (${response.status})`);
      }

      // Clear session storage
      sessionStorage.removeItem("likha-reef-capture");
      router.push("/aquarium");
    } catch (error) {
      console.error("Upload error:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      setErrorMsg(`Upload failed: ${msg}`);
      setUploading(false);
    }
  };

  if (!originalImage) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-900 to-sky-950">
        <p className="text-sky-300">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-sky-900 to-sky-950">
      <header className="p-4 text-center">
        <h1 className="text-2xl font-bold text-cyan-300">✨ Transform</h1>
        <p className="text-sm text-sky-300 mt-1">
          We&apos;re turning your drawing into a swimming creature!
        </p>
      </header>

      <div className="flex-1 flex flex-col items-center p-4 gap-6">
        {/* Before/After comparison */}
        <div className="w-full max-w-lg grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-xs text-sky-400 text-center font-medium">
              Original
            </p>
            <div className="rounded-xl overflow-hidden border border-sky-700/50 bg-sky-900/50 aspect-square flex items-center justify-center">
              <img
                src={originalImage}
                alt="Original photo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-teal-400 text-center font-medium">
              Processed
            </p>
            <div className="rounded-xl overflow-hidden border border-teal-500/50 aspect-square flex items-center justify-center bg-[url('/checkerboard.svg')] bg-repeat bg-[length:20px_20px]">
              {processing ? (
                <div className="animate-pulse text-sky-400">
                  <svg
                    className="w-8 h-8 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
              ) : processedImage ? (
                <img
                  src={processedImage}
                  alt="Processed cutout"
                  className="max-w-full max-h-full object-contain"
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="w-full max-w-sm p-3 rounded-xl bg-red-900/50 border border-red-500/50 text-red-200 text-sm text-center">
            {errorMsg}
          </div>
        )}

        {/* Nickname input & actions */}
        {!processing && processedImage && (
          <div className="w-full max-w-sm space-y-4">
            <div>
              <label
                htmlFor="nickname"
                className="block text-sm text-sky-300 mb-1"
              >
                Name your creature (optional)
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Bubbles, Nemo Jr..."
                maxLength={100}
                className="w-full px-4 py-3 rounded-xl bg-sky-800/50 border border-sky-600/50 text-white placeholder-sky-500 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/capture")}
                className="flex-1 px-4 py-3 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-medium transition-colors"
              >
                ↩ Retake
              </button>
              <button
                onClick={handleConfirm}
                disabled={uploading}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-medium shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                {uploading ? "Adding..." : "🌊 Add to Aquarium"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
