"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface Creature {
  id: string;
  nickname: string | null;
  image_url: string;
  swim_speed: number;
  depth_layer: number;
  start_x: number;
  start_y: number;
  wiggle_amplitude: number;
  direction: number;
  created_at: string;
}

interface CreatureState {
  x: number;
  y: number;
  dir: number;
  targetDir: number;
  turnProgress: number; // 0-1, for smooth turning
  time: number;
  // Fish body animation
  tailPhase: number;
  // Vertical behavior
  baseY: number;
  verticalOffset: number;
  verticalTarget: number;
  // Speed variation
  currentSpeed: number;
  targetSpeed: number;
  // Drift / idle
  idleTimer: number;
  isIdling: boolean;
}

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  wobble: number;
}

export default function AquariumPage() {
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [loading, setLoading] = useState(true);
  const animationRef = useRef<number>(0);
  const creaturesStateRef = useRef<Map<string, CreatureState>>(new Map());
  const bubblesRef = useRef<Bubble[]>([]);
  const [, setTick] = useState(0);

  const fetchCreatures = useCallback(async () => {
    try {
      const res = await fetch("/api/creatures");
      const data = await res.json();
      setCreatures(data.creatures || []);
    } catch (err) {
      console.error("Failed to fetch creatures:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreatures();
    const interval = setInterval(fetchCreatures, 5000);
    return () => clearInterval(interval);
  }, [fetchCreatures]);

  // Initialize creature states
  useEffect(() => {
    creatures.forEach((c) => {
      if (!creaturesStateRef.current.has(c.id)) {
        const baseY = c.start_y * 100;
        creaturesStateRef.current.set(c.id, {
          x: c.start_x * 100,
          y: baseY,
          dir: c.direction,
          targetDir: c.direction,
          turnProgress: 1,
          time: Math.random() * Math.PI * 20,
          tailPhase: Math.random() * Math.PI * 2,
          baseY,
          verticalOffset: 0,
          verticalTarget: 0,
          currentSpeed: c.swim_speed,
          targetSpeed: c.swim_speed,
          idleTimer: Math.random() * 10,
          isIdling: false,
        });
      }
    });
  }, [creatures]);

  // Initialize bubbles
  useEffect(() => {
    const bubbles: Bubble[] = [];
    for (let i = 0; i < 25; i++) {
      bubbles.push({
        id: i,
        x: Math.random() * 100,
        y: 100 + Math.random() * 30,
        size: 2 + Math.random() * 10,
        speed: 0.15 + Math.random() * 0.5,
        opacity: 0.15 + Math.random() * 0.35,
        wobble: Math.random() * Math.PI * 2,
      });
    }
    bubblesRef.current = bubbles;
  }, []);

  // Animation loop
  useEffect(() => {
    let lastTime = performance.now();

    const animate = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.05); // cap delta to avoid jumps
      lastTime = now;

      creaturesStateRef.current.forEach((state, id) => {
        const creature = creatures.find((c) => c.id === id);
        if (!creature) return;

        state.time += delta;
        state.tailPhase += delta * (4 + creature.swim_speed * 3); // tail wag frequency

        // === Idle behavior (occasional pauses) ===
        state.idleTimer -= delta;
        if (state.idleTimer <= 0) {
          if (state.isIdling) {
            // Resume swimming
            state.isIdling = false;
            state.idleTimer = 5 + Math.random() * 15; // time before next idle
            state.targetSpeed = creature.swim_speed * (0.7 + Math.random() * 0.6);
          } else {
            // Start idling
            state.isIdling = true;
            state.idleTimer = 1 + Math.random() * 3; // idle duration
            state.targetSpeed = creature.swim_speed * 0.1;
          }
        }

        // === Smooth speed transitions ===
        state.currentSpeed += (state.targetSpeed - state.currentSpeed) * delta * 2;

        // === Horizontal movement ===
        const speed = state.currentSpeed * 4;
        state.x += state.dir * speed * delta;

        // === Hard clamp — never escape the aquarium ===
        if (state.x > 88) {
          state.x = 88;
          state.dir = -1;
          state.targetDir = -1;
          state.turnProgress = 1;
        } else if (state.x < 12) {
          state.x = 12;
          state.dir = 1;
          state.targetDir = 1;
          state.turnProgress = 1;
        }

        // === Smooth turning before edges ===
        if (state.x > 78 && state.dir > 0) {
          state.targetDir = -1;
          if (state.turnProgress >= 1) state.turnProgress = 0;
        } else if (state.x < 22 && state.dir < 0) {
          state.targetDir = 1;
          if (state.turnProgress >= 1) state.turnProgress = 0;
        }

        // Random direction changes (only in the middle zone)
        if (state.x > 25 && state.x < 75 && Math.random() < 0.0015 * delta * 60) {
          state.targetDir = state.dir * -1;
          state.turnProgress = 0;
        }

        // Animate turn
        if (state.turnProgress < 1) {
          state.turnProgress += delta * 2.5; // turn takes ~0.4s
          if (state.turnProgress >= 1) {
            state.turnProgress = 1;
            state.dir = state.targetDir;
          }
        }

        // === Vertical movement (organic bob + drift) ===
        // Pick new vertical targets periodically
        if (Math.random() < 0.005 * delta * 60) {
          state.verticalTarget =
            (Math.random() - 0.5) * creature.wiggle_amplitude * 5;
        }
        state.verticalOffset +=
          (state.verticalTarget - state.verticalOffset) * delta * 0.8;

        // Sine bob on top
        const bob = Math.sin(state.time * 1.5) * creature.wiggle_amplitude * 1.5;
        state.y = state.baseY + state.verticalOffset + bob;

        // Clamp vertical — keep fish well inside the aquarium
        state.y = Math.max(12, Math.min(78, state.y));
      });

      // Update bubbles
      bubblesRef.current.forEach((bubble) => {
        bubble.wobble += delta * 2;
        bubble.y -= bubble.speed * delta * 12;
        bubble.x += Math.sin(bubble.wobble) * 0.03;
        bubble.size *= 1 + delta * 0.02; // bubbles grow slightly as they rise

        if (bubble.y < -5) {
          bubble.y = 102 + Math.random() * 10;
          bubble.x = Math.random() * 100;
          bubble.size = 2 + Math.random() * 10;
          bubble.opacity = 0.15 + Math.random() * 0.35;
        }
      });

      setTick((t) => t + 1);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [creatures]);

  const getDepthStyles = (depthLayer: number) => {
    switch (depthLayer) {
      case 1:
        return { scale: 0.45, opacity: 0.55, zIndex: 1, blur: 1 };
      case 2:
        return { scale: 0.7, opacity: 0.8, zIndex: 2, blur: 0 };
      case 3:
        return { scale: 1.0, opacity: 1.0, zIndex: 3, blur: 0 };
      default:
        return { scale: 0.7, opacity: 0.8, zIndex: 2, blur: 0 };
    }
  };

  return (
    <main className="h-screen w-screen overflow-hidden relative">
      {/* Underwater background */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500 via-blue-600 via-60% to-indigo-950" />

      {/* Animated light rays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 left-[15%] w-40 h-[130%] bg-gradient-to-b from-yellow-100/12 to-transparent rotate-[8deg] blur-sm animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -top-20 left-[35%] w-28 h-[130%] bg-gradient-to-b from-cyan-100/10 to-transparent -rotate-[4deg] blur-sm animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute -top-20 left-[55%] w-20 h-[130%] bg-gradient-to-b from-sky-100/8 to-transparent rotate-[12deg] blur-sm animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
        <div className="absolute -top-20 right-[20%] w-32 h-[130%] bg-gradient-to-b from-yellow-100/8 to-transparent -rotate-[6deg] blur-sm animate-pulse" style={{ animationDuration: '7s', animationDelay: '0.5s' }} />
      </div>

      {/* Water caustics overlay (subtle) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_white_0%,_transparent_70%)] animate-pulse" style={{ animationDuration: '3s' }} />

      {/* Coral/reef at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-emerald-950/90 via-emerald-900/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1200 150" className="w-full h-28 fill-emerald-900/70">
          <path d="M0,150 C60,110 120,130 180,115 C240,100 280,80 340,90 C400,100 440,75 500,85 C560,95 600,70 660,80 C720,90 780,65 840,75 C900,85 940,100 1000,90 C1060,80 1100,95 1140,85 C1180,75 1200,90 1200,150 Z" />
        </svg>
        {/* Seaweed elements */}
        <div className="absolute bottom-0 left-[10%] w-3 h-20 bg-gradient-to-t from-green-800 to-green-600 rounded-t-full opacity-60 origin-bottom animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-0 left-[25%] w-2 h-16 bg-gradient-to-t from-green-900 to-emerald-600 rounded-t-full opacity-50 origin-bottom animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <div className="absolute bottom-0 right-[15%] w-3 h-24 bg-gradient-to-t from-green-800 to-teal-500 rounded-t-full opacity-55 origin-bottom animate-pulse" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }} />
        <div className="absolute bottom-0 right-[30%] w-2 h-14 bg-gradient-to-t from-green-900 to-green-500 rounded-t-full opacity-45 origin-bottom animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
      </div>

      {/* Bubbles */}
      {bubblesRef.current.map((bubble) => (
        <div
          key={bubble.id}
          className="absolute rounded-full border border-white/30"
          style={{
            left: `${bubble.x}%`,
            top: `${bubble.y}%`,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            opacity: bubble.opacity,
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), rgba(255,255,255,0.05))`,
          }}
        />
      ))}

      {/* Swimming creatures */}
      <div className="absolute inset-0">
        {creatures.map((creature) => {
          const state = creaturesStateRef.current.get(creature.id);
          if (!state) return null;

          const depth = getDepthStyles(creature.depth_layer);

          // Calculate fish body wiggle (tail wag effect)
          const tailWag = Math.sin(state.tailPhase) * 8 * (state.currentSpeed / creature.swim_speed);

          // Smooth scaleX for turning (-1 to 1)
          const scaleX =
            state.turnProgress < 1
              ? state.dir + (state.targetDir - state.dir) * easeInOutCubic(state.turnProgress)
              : state.dir;

          // Slight tilt based on vertical velocity and movement
          const tilt = Math.sin(state.time * 1.5) * 3 * state.currentSpeed;

          return (
            <div
              key={creature.id}
              className="absolute"
              style={{
                left: `${state.x}%`,
                top: `${state.y}%`,
                transform: `translate(-50%, -50%) scale(${depth.scale})`,
                opacity: depth.opacity,
                zIndex: depth.zIndex,
                filter: depth.blur ? `blur(${depth.blur}px)` : undefined,
              }}
            >
              {/* Fish body with swimming animation */}
              <div
                style={{
                  transform: `scaleX(${scaleX}) rotate(${tilt * scaleX}deg) skewY(${tailWag * 0.15}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <img
                  src={creature.image_url}
                  alt={creature.nickname || "Sea creature"}
                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                  draggable={false}
                />
              </div>
              {creature.nickname && (
                <p
                  className="absolute -bottom-5 left-1/2 text-[10px] text-white/70 whitespace-nowrap font-medium drop-shadow"
                  style={{ transform: `translateX(-50%) scaleX(${scaleX})` }}
                >
                  {creature.nickname}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Overlay UI */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-50">
        <h1 className="text-lg font-bold text-white/90 drop-shadow-lg">
          🐠 LIKHA-Reef
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/60 bg-black/20 backdrop-blur-sm px-2 py-1 rounded-full">
            {creatures.length} creatures
          </span>
          <Link
            href="/capture"
            className="px-4 py-2 text-sm font-medium rounded-full bg-teal-500/90 hover:bg-teal-400 text-white shadow-lg transition-all hover:scale-105 backdrop-blur-sm"
          >
            + Add Yours
          </Link>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-sky-950/50 backdrop-blur-sm">
          <div className="text-center space-y-3">
            <div className="animate-spin w-10 h-10 border-4 border-teal-400/30 border-t-teal-400 rounded-full mx-auto" />
            <p className="text-sky-300">Loading the reef...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && creatures.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <div className="text-center space-y-4 p-6 bg-sky-950/40 backdrop-blur-sm rounded-2xl">
            <p className="text-5xl">🐟</p>
            <p className="text-sky-200 text-lg">
              The reef is waiting for its first creature!
            </p>
            <Link
              href="/capture"
              className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium shadow-lg hover:scale-105 transition-transform"
            >
              Be the first to add one
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

// Easing function for smooth turns
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
