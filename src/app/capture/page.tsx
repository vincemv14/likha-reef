"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type CameraState = "idle" | "streaming" | "preview" | "error";

export default function CapturePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const startCamera = useCallback(async () => {
    try {
      // iOS Safari needs simpler constraints first
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.setAttribute("autoplay", "");
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.srcObject = stream;

        // Wait for video to be ready before showing UI
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.play().then(resolve).catch(resolve);
          };
          // Fallback if metadata already loaded
          if (video.readyState >= 1) {
            video.play().then(resolve).catch(resolve);
          }
        });
      }
      setCameraState("streaming");
    } catch (err) {
      console.error("Camera error:", err);
      setCameraState("error");
      setErrorMessage(
        "Camera access denied or not available. Please allow camera permissions and try again, or upload a photo instead."
      );
    }
  }, []);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    setCapturedImage(dataUrl);
    setCameraState("preview");

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setCameraState("idle");
  }, []);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCapturedImage(dataUrl);
        setCameraState("preview");

        // Stop camera if it was streaming
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };
      reader.readAsDataURL(file);

      // Reset the input so the same file can be re-selected
      e.target.value = "";
    },
    []
  );

  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      // Store in sessionStorage for the transform page
      sessionStorage.setItem("likha-reef-capture", capturedImage);
      router.push("/transform");
    }
  }, [capturedImage, router]);

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-sky-900 to-sky-950">
      {/* Header */}
      <header className="p-4 text-center">
        <h1 className="text-2xl font-bold text-cyan-300">📸 Capture</h1>
        <p className="text-sm text-sky-300 mt-1">
          Take a photo or upload your sea creature drawing
        </p>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        {cameraState === "idle" && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={startCamera}
              className="px-8 py-4 text-lg font-semibold rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white shadow-lg transition-all hover:scale-105"
            >
              📷 Open Camera
            </button>
            <div className="flex items-center gap-3 text-sky-400 text-sm">
              <span className="h-px w-10 bg-sky-700" />
              or
              <span className="h-px w-10 bg-sky-700" />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-4 text-lg font-semibold rounded-2xl border-2 border-sky-400/50 hover:bg-sky-800/50 text-sky-200 transition-all"
            >
              🖼️ Upload a Photo
            </button>
          </div>
        )}

        {cameraState === "error" && (
          <div className="max-w-sm text-center space-y-4">
            <div className="p-4 rounded-xl bg-red-900/50 border border-red-500/50">
              <p className="text-red-200">{errorMessage}</p>
            </div>
            <button
              onClick={() => {
                setCameraState("idle");
                setErrorMessage("");
              }}
              className="px-6 py-3 rounded-xl bg-sky-700 hover:bg-sky-600 text-white transition-colors"
            >
              Try Again
            </button>
            <p className="text-sky-400 text-sm">or upload a photo instead</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-xl border-2 border-sky-400/50 hover:bg-sky-800/50 text-sky-200 transition-all"
            >
              🖼️ Upload a Photo
            </button>
          </div>
        )}

        {cameraState === "streaming" && (
          <div className="w-full max-w-lg space-y-4">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-sky-500/30">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                webkit-playsinline="true"
                className="w-full aspect-[4/3] object-cover"
                style={{ background: "transparent" }}
              />
            </div>
            <div className="flex justify-center">
              <button
                onClick={takePhoto}
                className="w-20 h-20 rounded-full bg-white border-4 border-cyan-400 shadow-lg shadow-cyan-400/30 hover:scale-110 transition-transform flex items-center justify-center"
                aria-label="Take photo"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500" />
              </button>
            </div>
          </div>
        )}

        {cameraState === "preview" && capturedImage && (
          <div className="w-full max-w-lg space-y-4">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-teal-400/50">
              <img
                src={capturedImage}
                alt="Captured drawing"
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={retake}
                className="px-6 py-3 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-medium transition-colors"
              >
                ↩ Retake
              </button>
              <button
                onClick={confirmPhoto}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-medium shadow-lg transition-all hover:scale-105"
              >
                ✓ Use This Photo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </main>
  );
}
