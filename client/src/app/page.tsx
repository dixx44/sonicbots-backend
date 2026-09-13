"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ScanFace, Terminal, ShieldAlert, ShieldCheck, Cpu, Video, VideoOff, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Users, LayoutDashboard, Settings, MoreVertical, MessageSquare, Lock, PhoneCall, X, Image as ImageIcon, Smile, User, Gamepad2, Swords, Zap, Wallet, UserPlus, LogOut, ChevronLeft, ChevronRight, ChevronDown, Eye, EyeOff, Info, Pencil, Check, Sparkles, Archive, Trash, Trash2, Reply, ArrowLeft, Compass, HelpCircle, BookOpen, MessageCircle, CheckCircle2, Receipt, CalendarDays } from "lucide-react";
import { io, Socket } from "socket.io-client";
import CryptoJS from 'crypto-js';
import Peer from 'simple-peer';
import dynamic from 'next/dynamic';

// Dynamic import for face-api and emoji-picker to avoid SSR issues
const faceapi = typeof window !== "undefined" ? require('@vladmandic/face-api/dist/face-api.esm.js') : null;
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });
const NeuralGameWorld = dynamic(() => import('../components/NeuralGameWorld'), { ssr: false });
const compressImage = (dataUrl: string, maxWidth = 150, maxHeight = 150, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
  });
};

const SECRET_KEY = "NEOTALK_AES_256_KEY";

interface Message {
  id: string;
  senderName: string;
  senderId?: string;
  targetId?: string;
  senderUsername?: string;
  targetUsername?: string;
  text: string;
  timestamp: Date;
  isUser: boolean;
  isSystem?: boolean;
  isStreaming?: boolean;
  isImage?: boolean;
  isVideo?: boolean;
  isLudoReady?: boolean;
  betAmount?: number;
  roomId?: string;
  isPaymentSlip?: boolean;
  slipData?: {
    amount?: number;
    from?: string;
    to?: string;
    note?: string;
    txId?: string;
    txnId?: string;
    timestamp?: string;
    isCollected?: boolean;
    collectedAt?: string;
    [key: string]: any;
  };
  isLudoInvite?: boolean;
  ludoRoomId?: string;
  replyToId?: string;
  replyToSender?: string;
  replyToText?: string;
  replyToIsImage?: boolean;
  ludoPlayerSlots?: string[];
  status?: string;
  reactions?: Record<string, string>;
  isEncrypted?: boolean;
  [key: string]: any;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(""); // User's custom avatar seed
  const [about, setAbout] = useState("Active Neural Agent"); // User's bio/about
  const [showLastSeen, setShowLastSeen] = useState(true); // LastSeen privacy setting
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectedUrl, setConnectedUrl] = useState<string>("");
  const [isAutoAuthenticating, setIsAutoAuthenticating] = useState(true);
  const [socketUrlOverride, setSocketUrlOverride] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aura_socket_url") || "";
    }
    return "";
  });

  useEffect(() => {
    // Dynamically connect to the backend socket server.
    // In production, use NEXT_PUBLIC_SOCKET_URL from environment variables.
    let socketUrl = socketUrlOverride || process.env.NEXT_PUBLIC_SOCKET_URL || "";
    
    // Clean and sanitize the URL (trim whitespace, remove quotes, strip trailing slash)
    socketUrl = socketUrl.trim().replace(/^['"]|['"]$/g, "");
    if (socketUrl.endsWith("/")) {
      socketUrl = socketUrl.slice(0, -1);
    }
    
    // Check if we are running in localhost/local development environment
    const isLocalhost = typeof window !== "undefined" && (
      window.location.hostname === "localhost" || 
      window.location.hostname === "127.0.0.1" || 
      window.location.hostname.startsWith("192.168.")
    );

    // Always use Railway backend - override any localhost or localtunnel URLs
    if (!socketUrl || socketUrl.includes("localhost") || socketUrl.includes("127.0.0.1") || socketUrl.includes("loca.lt")) {
      // Force Railway backend - works both locally and in production
      socketUrl = "https://as-production-14d0.up.railway.app";
    } else if (socketUrl) {
      // If it doesn't have http:// or https://, prepend https:// for production reliability
      if (!socketUrl.startsWith("http://") && !socketUrl.startsWith("https://")) {
        socketUrl = "https://" + socketUrl;
      }
    }
    setConnectedUrl(socketUrl);
    console.log("[SOCKET] Attempting connection to URL:", socketUrl);
    const newSocket = io(socketUrl, {
      transports: ['polling', 'websocket'],
      extraHeaders: {
        'Bypass-Tunnel-Reminder': 'true',
      },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 15000,
    });

    newSocket.on("connect", () => {
      console.log("[SOCKET] Connected successfully! Socket ID:", newSocket.id);
    });

    newSocket.on("connect_error", (error) => {
      console.error("[SOCKET] Connection error to:", socketUrl, error);
    });

    newSocket.on("disconnect", (reason) => {
      console.warn("[SOCKET] Disconnected:", reason);
    });

    setSocket(newSocket);

    // PERSISTENCE: Check for existing session
    const storedUsername = localStorage.getItem("aura_username");
    if (storedUsername) {
      setUsername(storedUsername);
      const attemptAuth = () => {
        console.log("[AUTH] Auto-authenticating with stored username:", storedUsername);
        newSocket.emit("biometric_auth", { forceUsername: storedUsername });
      };

      if (newSocket.connected) {
        attemptAuth();
      } else {
        newSocket.on("connect", attemptAuth);
      }

      // Fallback: If auth takes too long, show login
      const fallback = setTimeout(() => {
        console.warn("[AUTH] Auto-authentication timed out, falling back to manual login.");
        setIsAutoAuthenticating(false);
      }, 8000); // Increased to 8s for reliability
      newSocket.once("auth_success", () => clearTimeout(fallback));
    } else {
      setIsAutoAuthenticating(false);
    }

    const onAuthSuccess = (data: any) => {
      setUsername(data.username);
      if (data.avatar) setAvatarSeed(data.avatar);
      if (data.about) setAbout(data.about);
      if (data.showLastSeen !== undefined) setShowLastSeen(data.showLastSeen);
      setIsAuthenticated(true);
      localStorage.setItem("aura_username", data.username);
      setIsAutoAuthenticating(false);
    };

    newSocket.on("auth_success", onAuthSuccess);

    return () => {
      newSocket.off("auth_success", onAuthSuccess);
      newSocket.close();
    };
  }, [socketUrlOverride]);

  const handleAuth = (name: string, avatar?: string, userAbout?: string, userShowLastSeen?: boolean) => {
    setUsername(name);
    if (avatar) setAvatarSeed(avatar);
    if (userAbout) setAbout(userAbout);
    if (userShowLastSeen !== undefined) setShowLastSeen(userShowLastSeen);
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.setItem("aura_username", name);
  };

  const handleGuestExplore = () => {
    setUsername("Guest_" + Math.floor(Math.random() * 9000 + 1000));
    setIsAuthenticated(true);
    setIsGuest(true);
  };

  if (isAutoAuthenticating && !isAuthenticated) {
    return (
      <div className="bg-[#050810] h-screen w-full flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full mb-6 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        />
        <h2 className="text-emerald-500 font-mono tracking-[0.3em] text-sm animate-pulse">RECONNECTING TO NEURAL GRID...</h2>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0f19] text-white font-sans overflow-x-hidden overflow-y-auto min-h-screen w-full selection:bg-emerald-500/30">
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <BiometricLogin
            key="login"
            socket={socket}
            connectedUrl={connectedUrl}
            onAuth={handleAuth}
            onGuest={handleGuestExplore}
            socketUrlOverride={socketUrlOverride}
            onUpdateSocketUrl={(url) => {
              localStorage.setItem("aura_socket_url", url);
              setSocketUrlOverride(url);
            }}
          />
        ) : (
          <MainDashboard key="dashboard" socket={socket} username={username} setUsername={setUsername} avatarSeed={avatarSeed} setAvatarSeed={setAvatarSeed} about={about} setAbout={setAbout} showLastSeen={showLastSeen} setShowLastSeen={setShowLastSeen} isGuest={isGuest} setIsGuest={setIsGuest} onLogOut={() => { setIsAuthenticated(false); setIsGuest(false); localStorage.removeItem("aura_username"); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function BiometricLogin({
  socket,
  connectedUrl,
  onAuth,
  onGuest,
  socketUrlOverride,
  onUpdateSocketUrl
}: {
  socket: Socket | null;
  connectedUrl: string;
  onAuth: (name: string, avatar?: string, userAbout?: string, userShowLastSeen?: boolean) => void;
  onGuest: () => void;
  socketUrlOverride: string;
  onUpdateSocketUrl: (url: string) => void;
}) {
  const [loginMode, setLoginMode] = useState<"face" | "clap" | "credentials">("face");
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [tempSocketUrl, setTempSocketUrl] = useState(socketUrlOverride);

  useEffect(() => {
    setTempSocketUrl(socketUrlOverride);
  }, [socketUrlOverride]);

  // Credentials State
  const [credUsername, setCredUsername] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Face Auth state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanStatus, setScanStatus] = useState("LOADING BIOMETRIC MODELS...");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState<"loading" | "idle" | "align" | "rotate" | "success" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isWrongMove, setIsWrongMove] = useState(false);
  const [litSegments, setLitSegments] = useState<Set<number>>(new Set());
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const litRef = useRef<Set<number>>(new Set());
  const alarmRef = useRef<HTMLAudioElement | null>(null);

  // Clap Auth state
  const [audioLevel, setAudioLevel] = useState(0);
  const [clapPower, setClapPower] = useState(0);
  const [isClapListening, setIsClapListening] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const clapReqRef = useRef<number | null>(null);

  const successChime = typeof window !== "undefined" ? new Audio("https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3") : null;
  const playSuccess = () => { successChime?.play().catch(() => { }); };

  useEffect(() => {
    alarmRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    alarmRef.current.loop = true;
    return () => {
      alarmRef.current?.pause();
      alarmRef.current = null;
      if (clapReqRef.current) cancelAnimationFrame(clapReqRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.rate = 0.9;
    msg.pitch = 1.1;
    window.speechSynthesis.speak(msg);
  };

  useEffect(() => {
    if (!socket) return;
    const handleSuccess = (data: any) => {
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      setIsSubmitting(false);
      setIsRegistering(false);
      onAuth(data.username, data.avatar, data.about, data.showLastSeen);
    };
    const handleError = (msg: string) => {
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      setIsSubmitting(false);
      setIsRegistering(false);
      setErrorMessage(msg);
      speak(`Error: ${msg}`);
    };
    socket.on("auth_success", handleSuccess);
    socket.on("auth_error", handleError);
    return () => {
      socket.off("auth_success", handleSuccess);
      socket.off("auth_error", handleError);
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
  }, [socket, onAuth]);

  const handleLogin = () => {
    if (!credUsername.trim() || !credPassword.trim()) {
      setErrorMessage("Please enter your username and password.");
      return;
    }
    if (!socket || !socket.connected) {
      setErrorMessage(`Not connected to server (URL: ${connectedUrl}). Please wait or refresh.`);
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);
    setIsRegistering(false);
    socket.emit("login_auth", { username: credUsername.trim(), password: credPassword });
    // Safety timeout: reset after 12s if no response
    authTimeoutRef.current = setTimeout(() => {
      setIsSubmitting(false);
      setErrorMessage("Server did not respond. Check connection and try again.");
    }, 12000);
  };

  const handleRegister = () => {
    if (!credUsername.trim() || !credPassword.trim()) {
      setErrorMessage("Please enter a username and password.");
      return;
    }
    if (getPasswordStrength(credPassword) < 3) {
      setErrorMessage("Use a stronger password to register (uppercase + number + symbol).");
      return;
    }
    if (!socket || !socket.connected) {
      setErrorMessage(`Not connected to server (URL: ${connectedUrl}). Please wait or refresh.`);
      return;
    }
    setErrorMessage("");
    setIsRegistering(true);
    setIsSubmitting(false);
    socket.emit("register_auth", { username: credUsername.trim(), password: credPassword });
    // Safety timeout: reset after 12s if no response
    authTimeoutRef.current = setTimeout(() => {
      setIsRegistering(false);
      setErrorMessage("Server did not respond. Check connection and try again.");
    }, 12000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8 && /[0-9]/.test(pass)) score += 1;
    if (/[A-Z]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  useEffect(() => {
    const loadModels = async () => {
      if (modelsLoaded) return;
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
      setScanStatus("TAP TO INITIATE SECURE LINK");
      setScanStage("idle");
    };
    if (loginMode === "face") loadModels();
  }, [modelsLoaded, loginMode]);

  const startClapDetection = async () => {
    if (!socket || isClapListening) return;
    try {
      setScanStatus("INITIALIZING SONIC SENSORS...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      setIsClapListening(true);
      setScanStatus("CLAP HANDS TO AUTHENTICATE");
      speak("Sonic sensors active. Please clap to authorize.");
      setClapPower(0);

      let lastClapTime = 0;
      let power = 0;

      const checkAudio = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);

        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i];
        }
        const average = sum / dataArrayRef.current.length;
        const level = Math.min(100, (average / 150) * 100);
        setAudioLevel(level);

        const now = Date.now();
        // Detect a clap (sharp spike)
        if (level > 60 && now - lastClapTime > 300) {
          lastClapTime = now;
          power += 25; // 4 claps to login
          if (power >= 100) {
            power = 100;
            setClapPower(100);
            setScanStatus("SONIC SIGNATURE ACCEPTED");
            playSuccess();
            speak("Sonic signature accepted. Welcome Agent.");
            setTimeout(() => {
              socket?.emit("biometric_auth", {});
            }, 1000);
            return; // Stop checking
          }
          setClapPower(power);
        } else if (now - lastClapTime > 2000) {
          // decay if too slow
          power = Math.max(0, power - 0.5);
          setClapPower(power);
        }

        if (audioContextRef.current?.state === "running") {
          clapReqRef.current = requestAnimationFrame(checkAudio);
        }
      };
      checkAudio();
    } catch (e) {
      console.error(e);
      setScanStatus("MIC ACCESS DENIED OR UNAVAILABLE");
      speak("Microphone access is denied.");
    }
  };

  const stopClapDetection = () => {
    setIsClapListening(false);
    if (clapReqRef.current) cancelAnimationFrame(clapReqRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    setAudioLevel(0);
  };

  useEffect(() => {
    if (loginMode === "clap") {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
      setIsScanning(false);
      startClapDetection();
    } else {
      stopClapDetection();
      setScanStatus(modelsLoaded ? "TAP TO INITIATE SECURE LINK" : "LOADING BIOMETRIC MODELS...");
    }
  }, [loginMode]);

  const startScan = async () => {
    if (!socket || !modelsLoaded || isScanning || loginMode !== "face") return;

    try {
      setScanStatus("NODE SEARCH INITIATED...");
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => { t.stop(); t.enabled = false; });
        videoRef.current.srcObject = null;
      }

      if (!navigator.mediaDevices) throw new Error("HARDWARE_API_UNAVAILABLE");
      let stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setIsScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise(r => setTimeout(r, 200));
        await videoRef.current.play();
      }

      setScanStage("align");
      setScanStatus("LINK SECURED. ALIGNING...");
      speak("Secure link established.");
    } catch (err: any) {
      console.error("Hardware Node Error:", err);
      setIsScanning(false);
      setScanStatus("HARDWARE LINK FAILED");
      return;
    }

    let currentStage = "align";
    let p = 0;
    let faceMissingCount = 0;

    // Reset rotation tracker
    litRef.current.clear();
    setLitSegments(new Set());
    setActiveSegment(null);
    setProgress(0);

    const detectLoop = async () => {
      if (!videoRef.current || loginMode !== "face") return;
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 })).withFaceLandmarks();

      if (!detection || detection.detection.score < 0.2) {
        faceMissingCount++;
        if (faceMissingCount > 60) {
          setActiveSegment(null);
          if (currentStage !== "error") {
            currentStage = "error";
            setScanStage("error");
            setScanStatus("⚠️ UNAUTHORIZED");
            setIsWrongMove(true);
          }
        }
      } else {
        faceMissingCount = 0;
        if (currentStage === "error") {
          currentStage = "align";
          setScanStage("align");
          setScanStatus("✅ FACE SECURED: INITIALIZING LINK");
          setIsWrongMove(false);
          speak("Face secured. Linking nodes.");
        }

        const box = detection.detection.box;
        const nose = detection.landmarks.getNose()[0];

        if (currentStage === "align") {
          // Align phase - face should be roughly centered
          p = Math.min(25, p + 1.0);
          setProgress(p);
          if (p >= 25) {
            currentStage = "rotate";
            setScanStage("rotate");
            playSuccess();
            speak("Slowly rotate your head in a circle.");
            setScanStatus("SLOWLY ROTATE HEAD");
          }
        } else if (currentStage === "rotate") {
          // Calculate rotation relative to face box center
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          const dx = nose.x - faceCenterX;
          const dy = nose.y - faceCenterY;

          // distance magnitude divided by box width to get a scale-independent metric
          const distance = Math.sqrt(dx * dx + dy * dy);
          const rotationMagnitude = distance / box.width;

          if (rotationMagnitude > 0.04) {
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            angle = angle + 90; // Adjust so 0 is top
            if (angle < 0) angle += 360;

            const segmentIndex = Math.floor(angle / 10) % 36;
            setActiveSegment(segmentIndex);

            const oldSize = litRef.current.size;
            // Light up current and neighbors for a smooth sweep
            litRef.current.add(segmentIndex);
            litRef.current.add((segmentIndex + 1) % 36);
            litRef.current.add((segmentIndex - 1 + 36) % 36);

            if (litRef.current.size !== oldSize) {
              const newSize = litRef.current.size;
              setLitSegments(new Set(litRef.current));
              p = 25 + Math.floor((newSize / 36) * 75);
              setProgress(p);

              if (newSize >= 36) {
                setActiveSegment(null);
                currentStage = "success";
                setScanStage("success");
                setScanStatus("IDENTITY VERIFIED. ACCESS GRANTED.");
                playSuccess();
                speak("Identity verified. Welcome back, Agent.");
                setTimeout(() => { socket?.emit("biometric_auth", {}); }, 1500);
              }
            }
          } else {
            setActiveSegment(null);
          }
        }
      }
      requestAnimationFrame(detectLoop);
    };
    detectLoop();
  };

  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ scale: 1.1, opacity: 0 }} className="flex flex-col items-center justify-between h-[100dvh] w-full bg-[#050810] relative overflow-hidden py-4 px-2 sm:px-4">

      {loginMode === "clap" && (
        <>
          <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
            <div className="text-emerald-500 font-mono text-[10px] uppercase tracking-widest writing-vertical-lr rotate-180 flex items-center gap-2">Sonic Power <span>{Math.round(audioLevel)}%</span></div>
            <div className="w-6 h-96 bg-black/50 border border-emerald-500/20 rounded-full overflow-hidden flex flex-col justify-end relative shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <div className="w-full bg-emerald-500 transition-all duration-75 shadow-[0_0_20px_rgba(16,185,129,0.8)]" style={{ height: `${audioLevel}%` }}></div>
              {/* Tick marks */}
              {[20, 40, 60, 80].map(p => <div key={p} className="absolute w-full h-[1px] bg-emerald-900/50" style={{ bottom: `${p}%` }} />)}
            </div>
          </motion.div>
          <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
            <div className="text-emerald-500 font-mono text-[10px] uppercase tracking-widest writing-vertical-lr rotate-180 flex items-center gap-2">Auth Progress <span>{Math.round(clapPower)}%</span></div>
            <div className="w-6 h-96 bg-black/50 border border-emerald-500/20 rounded-full overflow-hidden flex flex-col justify-end relative shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <div className="w-full bg-gradient-to-t from-emerald-500 to-cyan-400 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.8)]" style={{ height: `${clapPower}%` }}></div>
              {[25, 50, 75].map(p => <div key={p} className="absolute w-full h-[1px] bg-cyan-900/50" style={{ bottom: `${p}%` }} />)}
            </div>
          </motion.div>
        </>
      )}

      <AnimatePresence>
        {(scanStage === 'error' || isWrongMove) && loginMode === "face" && (
          <motion.div className="fixed inset-0 bg-red-900/10 pointer-events-none z-[100] animate-[pulse_0.5s_infinite]" />
        )}
      </AnimatePresence>

      <div className="mt-4 md:mt-12 text-center z-10 flex-shrink-0">
        <h1 className="text-2xl md:text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 mb-1 md:mb-2">NEOTALK SECURE</h1>
        <p className="text-gray-500 font-mono text-xs md:text-sm tracking-widest uppercase">{loginMode === "face" ? "Biometric Authentication" : "Sonic Authorization"}</p>
      </div>

      <div className="relative flex items-center justify-center w-full max-w-[400px] flex-1 min-h-[300px] max-h-[400px] z-10 my-2 md:my-8 flex-shrink">
        {/* Neural Network Glowing Mesh (Orbital Background) */}
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
          <svg viewBox="0 0 400 400" className="absolute w-full h-full animate-[spin_20s_linear_infinite] opacity-60">
            <circle cx="200" cy="200" r="180" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="2 12" />
            <circle cx="200" cy="20" r="4" fill="#34d399" className="shadow-[0_0_10px_#34d399] animate-pulse" />
            <circle cx="380" cy="200" r="2" fill="#34d399" />
            <circle cx="20" cy="200" r="3" fill="#34d399" />
            <circle cx="200" cy="380" r="3" fill="#34d399" />
            <path d="M200 20 L380 200 L200 380 L20 200 Z" fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="5 15" opacity="0.3" />
          </svg>
          <svg viewBox="0 0 400 400" className="absolute w-[360px] h-[360px] animate-[spin_15s_reverse_linear_infinite] opacity-50">
            <circle cx="200" cy="200" r="160" fill="none" stroke="#34d399" strokeWidth="0.5" strokeDasharray="4 16" />
            <path d="M 200 40 Q 360 200 200 360 Q 40 200 200 40" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.5" />
          </svg>
          <div className="absolute w-[310px] h-[310px] rounded-full border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.3)] animate-[pulse_2s_infinite] pointer-events-none"></div>
        </div>

        {loginMode === "credentials" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-[90%] max-w-[380px] bg-[#0c1222]/95 border border-purple-500/30 p-5 md:p-8 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.15)] backdrop-blur-md z-10 flex flex-col gap-3 md:gap-4 text-left"
          >
            {showServerConfig ? (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-400 font-bold mb-1">
                    🌐 GATEWAY CONFIGURATION
                  </h3>
                  <p className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-2 leading-relaxed">
                    Set a custom Socket.io server URL below.
                  </p>
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-400 mb-2 font-bold">
                    TARGET ROUTE ORIGIN
                  </label>
                  <input
                    type="text"
                    value={tempSocketUrl}
                    onChange={(e) => setTempSocketUrl(e.target.value)}
                    className="w-full bg-[#050810] border border-cyan-500/20 focus:border-cyan-500 rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none transition-all"
                    placeholder="e.g. http://localhost:5000"
                  />
                </div>

                <div className="text-[9px] font-mono text-gray-600 bg-black/40 border border-white/5 p-3 rounded-xl leading-normal">
                  <div className="text-gray-500 mb-1">CURRENT ACTIVE CONNECTION:</div>
                  <div className="text-purple-400 break-all">{connectedUrl || "Determining automatically..."}</div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => {
                      onUpdateSocketUrl(tempSocketUrl.trim());
                      setShowServerConfig(false);
                    }}
                    className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all border border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                  >
                    💾 APPLY GATEWAY
                  </button>

                  <button
                    onClick={() => {
                      setTempSocketUrl("");
                      onUpdateSocketUrl("");
                      setShowServerConfig(false);
                    }}
                    className="w-full py-2 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white font-bold text-[9px] uppercase tracking-widest rounded-xl transition-all border border-white/10"
                  >
                    🔄 RESTORE DEFAULT HOST
                  </button>

                  <button
                    onClick={() => {
                      setTempSocketUrl(socketUrlOverride);
                      setShowServerConfig(false);
                    }}
                    className="w-full py-2 bg-transparent hover:bg-white/5 text-purple-400 hover:text-purple-300 font-bold text-[9px] uppercase tracking-widest rounded-xl transition-all"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.25em] text-purple-400 mb-2 font-bold">SECURE USERNAME</label>
                  <input
                    type="text"
                    value={credUsername}
                    onChange={(e) => setCredUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-[#050810] border border-purple-500/20 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none transition-all"
                    placeholder="Enter your username..."
                    autoComplete="username"
                  />
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-mono uppercase tracking-[0.25em] text-purple-400 mb-2 font-bold">SECURITY ACCESS KEY</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full bg-[#050810] border border-purple-500/20 focus:border-purple-500 rounded-xl pl-4 pr-12 py-3 text-white text-sm font-mono focus:outline-none transition-all"
                      placeholder="Enter your password..."
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-purple-400 transition-all"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Dynamic 3 strength lines */}
                  <div className="flex gap-2 mt-3 w-full">
                    <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${getPasswordStrength(credPassword) >= 1 ? (getPasswordStrength(credPassword) === 3 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : getPasswordStrength(credPassword) === 2 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]') : 'bg-white/10'}`} />
                    <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${getPasswordStrength(credPassword) >= 2 ? (getPasswordStrength(credPassword) === 3 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : getPasswordStrength(credPassword) === 2 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/10') : 'bg-white/10'}`} />
                    <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${getPasswordStrength(credPassword) >= 3 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/10'}`} />
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">
                      {getPasswordStrength(credPassword) === 3 ? "🔒 strong (verified)" : "⚠️ weak key option"}
                    </p>
                    {getPasswordStrength(credPassword) === 3 && (
                      <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider animate-pulse">
                        READY FOR ACCESS
                      </p>
                    )}
                  </div>
                </div>

                {errorMessage && (
                  <div className="text-red-400 font-mono text-center text-[10px] bg-red-500/10 border border-red-500/20 py-2 rounded-xl uppercase tracking-wider">
                    {errorMessage}
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-2">
                  {/* LOGIN - works with any password */}
                  <button
                    onClick={handleLogin}
                    disabled={isSubmitting || isRegistering || !credUsername.trim() || !credPassword.trim()}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:bg-purple-900/20 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        LOGGING IN...
                      </span>
                    ) : "🔑 LOGIN"}
                  </button>

                  {/* REGISTER - requires strong password */}
                  <button
                    onClick={handleRegister}
                    disabled={isSubmitting || isRegistering || !credUsername.trim() || !credPassword.trim()}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:bg-emerald-950/20 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  >
                    {isRegistering ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        CREATING ACCOUNT...
                      </span>
                    ) : "✨ CREATE NEW ACCOUNT"}
                  </button>

                  <p className="text-[9px] font-mono text-gray-600 text-center">New user? Fill fields above then click CREATE. Existing user? Click LOGIN.</p>

                  <div className="text-center mt-1">
                    <button
                      type="button"
                      onClick={onGuest}
                      className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 uppercase tracking-widest underline underline-offset-4"
                    >
                      ⚡ EXPLORE AS GUEST NODE
                    </button>
                  </div>

                  <div className="text-center mt-3 pt-2 border-t border-purple-500/10">
                    <button
                      type="button"
                      onClick={() => setShowServerConfig(true)}
                      className="text-[9px] font-mono text-purple-400/80 hover:text-purple-300 uppercase tracking-widest flex items-center justify-center gap-1.5 mx-auto transition-all"
                    >
                      ⚙️ CONFIGURE GATEWAY
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ) : loginMode === "face" ? (
          <motion.div className="relative group cursor-pointer flex items-center justify-center w-[270px] h-[270px] z-10" onClick={startScan}>
            <svg className="absolute inset-[-25px] w-[320px] h-[320px] pointer-events-none z-20" viewBox="0 0 320 320">
              {Array.from({ length: 36 }).map((_, i) => {
                const isLit = scanStage === 'loading' || scanStage === 'idle' ? false : litSegments.has(i);

                let distanceToActive = 999;
                if (activeSegment !== null && scanStage === 'rotate') {
                  distanceToActive = Math.min(
                    Math.abs(i - activeSegment),
                    Math.abs(i - (activeSegment + 36)),
                    Math.abs(i - (activeSegment - 36))
                  );
                }
                const isActiveCenter = distanceToActive === 0;
                const isActiveNeighbor = distanceToActive === 1;

                const angle = (i * 10 - 90) * (Math.PI / 180);
                const cx = 160;
                const cy = 160;

                const r1 = isActiveCenter ? 126 : isActiveNeighbor ? 129 : 132;
                const r2 = isActiveCenter ? 154 : isActiveNeighbor ? 151 : 148;

                const x1 = cx + r1 * Math.cos(angle);
                const y1 = cy + r1 * Math.sin(angle);
                const x2 = cx + r2 * Math.cos(angle);
                const y2 = cy + r2 * Math.sin(angle);

                let strokeClass = 'stroke-white/10';
                if (isLit) {
                  if (scanStage === 'error') strokeClass = 'stroke-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]';
                  else strokeClass = 'stroke-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]';
                }
                if (isActiveCenter || isActiveNeighbor) {
                  strokeClass = 'stroke-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,1)]';
                }

                return (
                  <line
                    key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    className={`${isActiveCenter ? 'stroke-[8px]' : isActiveNeighbor ? 'stroke-[7px]' : 'stroke-[6px]'} transition-all duration-100 ease-out ${strokeClass}`}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            <div className={`relative w-full h-full rounded-full overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] transition-all duration-500 bg-[#0a101d] border-4 ${scanStage === 'error' ? 'border-red-500/50' : 'border-emerald-500/20'}`}>
              <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-all duration-700 ${isScanning ? "scale-110 brightness-125" : "grayscale opacity-30"}`}></video>
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm hover:bg-black/40 transition-all">
                  <ScanFace className="w-16 h-16 text-emerald-400 mb-2 animate-pulse drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div className="relative group cursor-pointer flex flex-col items-center justify-center w-[270px] h-[270px] z-10" onClick={!isClapListening ? startClapDetection : undefined}>
            <svg className="absolute inset-[-25px] w-[320px] h-[320px] transform pointer-events-none z-20 -rotate-90" viewBox="0 0 320 320">
              <circle cx="160" cy="160" r={140} className="fill-none stroke-[8px] transition-colors duration-500 stroke-white/10" strokeDasharray="6 8" />
              <circle cx="160" cy="160" r={140} className="fill-none stroke-[8px] transition-all duration-300 stroke-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference - (clapPower / 100) * circumference} />
            </svg>
            <div className="relative w-full h-full rounded-full overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] bg-[#0a101d] border-4 border-cyan-500/20 flex flex-col items-center justify-center">
              {/* Background faded hands */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-32 h-32 text-white/10 absolute">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
              {/* Foreground filled hands masked by height */}
              <div className="w-32 h-32 absolute bottom-[70px] overflow-hidden" style={{ height: `${(clapPower / 100) * 128}px`, transition: 'height 0.2s linear' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 text-emerald-400 absolute bottom-0 shadow-[0_0_20px_rgba(52,211,153,0.8)]" style={{ filter: 'drop-shadow(0 0 15px #34d399)' }}>
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                </svg>
              </div>
              <div className="absolute font-mono text-cyan-400 font-bold tracking-widest text-xl mt-40 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">{Math.round(clapPower)}%</div>
              {!isClapListening && <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm font-bold tracking-widest text-emerald-400 uppercase">TAP TO INITIATE</div>}
            </div>
          </motion.div>
        )}
      </div>

      <div className="mb-4 md:mb-12 text-center min-h-[100px] z-10 flex flex-col items-center justify-end flex-shrink-0 w-full px-2">
        {loginMode !== "credentials" && (
          <motion.div className={`font-mono tracking-widest text-xs md:text-sm font-bold ${scanStage === 'success' || clapPower === 100 ? 'text-emerald-400' : 'text-cyan-400'}`}>
            {scanStatus}
          </motion.div>
        )}
        <div className="mt-4 md:mt-8 flex flex-wrap justify-center gap-2 md:gap-4 w-full">
          <button onClick={() => setLoginMode("face")} className={`flex-1 min-w-[100px] max-w-[140px] px-2 py-2 md:px-6 md:py-3 border rounded-xl text-[10px] md:text-xs transition-all font-mono uppercase ${loginMode === "face" ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-gray-500"}`}>Facial Scan</button>
          <button onClick={() => setLoginMode("clap")} className={`flex-1 min-w-[100px] max-w-[140px] px-2 py-2 md:px-6 md:py-3 border rounded-xl text-[10px] md:text-xs transition-all font-mono uppercase ${loginMode === "clap" ? "border-cyan-500 text-cyan-400 bg-cyan-500/10" : "border-white/10 text-gray-500"}`}>Sonic Auth</button>
          <button onClick={() => setLoginMode("credentials")} className={`flex-1 min-w-[100px] max-w-[140px] px-2 py-2 md:px-6 md:py-3 border rounded-xl text-[10px] md:text-xs transition-all font-mono uppercase ${loginMode === "credentials" ? "border-purple-500 text-purple-400 bg-purple-500/10" : "border-white/10 text-gray-500"}`}>Secure Account</button>
        </div>
      </div>
    </motion.div>
  );
}

function MainDashboard({ socket, username, setUsername, avatarSeed, setAvatarSeed, about, setAbout, showLastSeen, setShowLastSeen, isGuest, setIsGuest, onLogOut }: { socket: Socket | null, username: string, setUsername: (name: string) => void, avatarSeed: string, setAvatarSeed: (seed: string) => void, about: string, setAbout: (about: string) => void, showLastSeen: boolean, setShowLastSeen: (show: boolean) => void, isGuest: boolean, setIsGuest: (g: boolean) => void, onLogOut: () => void }) {
  const [activeTab, setActiveTab] = useState<'chat' | 'directory' | 'calls' | 'admin' | 'profile' | 'survival' | 'wallet' | 'shop' | 'discord'>('chat');
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null | 'LIST'>(null); // null = Global Chat
  const selectedChatIdRef = useRef(selectedChatId);
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  // Global avatar cache: username -> avatar data URL or seed string
  // This persists across socket reconnects and is populated from update_users
  const [avatarCache, setAvatarCache] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('aura_avatar_cache');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const updateAvatarCache = (updates: Record<string, string>) => {
    setAvatarCache(prev => {
      const merged = { ...prev, ...updates };
      try { localStorage.setItem('aura_avatar_cache', JSON.stringify(merged)); } catch {}
      return merged;
    });
  };

  // Helper: get avatar src for any username
  const getAvatarSrc = (uname: string, fallbackAvatar?: string): string => {
    const av = avatarCache[uname] || fallbackAvatar || uname || 'default';
    return String(av).startsWith('data:image') ? av : `https://api.dicebear.com/7.x/bottts/svg?seed=${av}`;
  };

  const [notifications, setNotifications] = useState<any[]>([
    { id: 'welcome', title: 'System Active', text: 'Telemetry pipelines online. Welcome to Aura grid!', timestamp: new Date(), read: false, type: 'info' }
  ]);
  const [qaMessages, setQaMessages] = useState<any[]>([
    {
      id: "init",
      sender: "DevBot",
      avatar: "DevBot",
      isBot: true,
      text: "Welcome to the Aura Developer Hub! Ask me anything about integration with Node.js, Next.js, or Unreal Engine. Try asking: 'How to integrate Unreal Engine?' or 'Show me Node.js setup'.",
      timestamp: new Date()
    }
  ]);
  const [memberStatuses, setMemberStatuses] = useState<any>({
    "AURA-OS": "online",
    "DevBot": "online",
    "Ashfaq": "online",
    "agent7205": "offline",
    "Rift_Dev": "offline",
    "Luna_Coder": "offline",
    "Cyber_Sam": "offline",
    "Neon_Gamer": "offline",
    "Pixel_Art": "offline",
  });
  const [discordTypingMap, setDiscordTypingMap] = useState<any>({});
  const [showNotifications, setShowNotifications] = useState(false);
  const [muteNotificationSound, setMuteNotificationSound] = useState(false);
  const [isSimulationEnabled, setIsSimulationEnabled] = useState(false);

  const addNotification = (title: string, text: string, type: string = 'info') => {
    const newNotif = {
      id: `notif_${Date.now()}_${Math.random()}`,
      title,
      text,
      timestamp: new Date(),
      read: false,
      type
    };
    setNotifications(prev => [newNotif, ...prev]);

    // Play chime sound
    if (!muteNotificationSound) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }
      } catch (err) { console.log(err); }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSelectedChatId('LIST');
    }
  }, []);

  const [chatTheme, setChatTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("chat_theme") || "emerald";
    }
    return "emerald";
  });
  const [chatWallpaper, setChatWallpaper] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("chat_wallpaper") || "cubes";
    }
    return "cubes";
  });

  const [walletInfo, setWalletInfo] = useState<any>({ wallet: 0, history: [] });

  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [virtualDmUsers, setVirtualDmUsers] = useState<any[]>([]);

  const addVirtualDmUser = (member: { name: string; avatar: string; isBot: boolean }, openingQuestion?: string) => {
    const virtualId = `virtual_${member.name}`;
    setVirtualDmUsers(prev => {
      if (prev.some(u => u.id === virtualId)) return prev;
      return [...prev, {
        id: virtualId,
        username: member.name,
        status: 'online',
        isVirtual: true,
        avatar: member.avatar,
        openingMessage: openingQuestion || `Hey! I saw your invite in #community-qa. I need help — can you clarify my doubt?`,
      }];
    });
    return virtualId;
  };
  const [pendingLudoInvite, setPendingLudoInvite] = useState(false);
  const [typingStatus, setTypingStatus] = useState<string | null>(null);
  const [unreadMap, setUnreadMap] = useState<Record<string, boolean>>({});
  const [lastMessageMap, setLastMessageMap] = useState<Record<string, number>>({});
  const [incomingCall, setIncomingCall] = useState<{ signal: any, from: string, callerName: string, callerAvatar?: string, isVideo?: boolean } | null>(null);
  const [activeCall, setActiveCall] = useState<{ userId: string, username: string, avatarSrc?: string, isCaller: boolean, isAi?: boolean, initialSignal?: any, isVideo?: boolean } | null>(null);
  const [incomingLudoInvites, setIncomingLudoInvites] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState({ totalMessages: 0, aiInterventions: 0, activeCalls: 0 });
  const [toast, setToast] = useState<{ id: string, name: string, text: string } | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [pendingAgents, setPendingAgents] = useState<any[]>([]);
  const [ludoNegotiationTarget, setLudoNegotiationTarget] = useState<any>(null);
  const [selectedLudoRoom, setSelectedLudoRoom] = useState<string | null>(null);
  const [communityLobbies, setCommunityLobbies] = useState<any[]>([]);
  const [myHostedRoom, setMyHostedRoom] = useState<string | null>(null);

  // Real-Time P2P Money Transfer & Digital Receipt States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferAmount, setTransferAmount] = useState<number | string>(1000);
  const [transferNote, setTransferNote] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [registeredUsersList, setRegisteredUsersList] = useState<any[]>([]);

  // Scoped Nicknames & Archive/Delete controls
  const [nicknames, setNicknames] = useState<{ [key: string]: string }>(() => {
    if (typeof window !== 'undefined') {
      const initialNicknames: { [key: string]: string } = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nickname_')) {
          const id = key.substring('nickname_'.length);
          initialNicknames[id] = localStorage.getItem(key) || '';
        }
      }
      return initialNicknames;
    }
    return {};
  });

  const updateNickname = (id: string, newName: string) => {
    setNicknames(prev => ({ ...prev, [id]: newName }));
    localStorage.setItem(`nickname_${id}`, newName);
  };

  const [archivedChats, setArchivedChats] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("archived_chats");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [deletedChats, setDeletedChats] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("deleted_chats");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const toggleArchiveChat = (id: string) => {
    setArchivedChats(prev => {
      const updated = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("archived_chats", JSON.stringify(updated));
      return updated;
    });
  };

  const deleteChat = (id: string) => {
    setDeletedChats(prev => {
      const updated = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem("deleted_chats", JSON.stringify(updated));
      return updated;
    });
  };

  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    if (selectedChatId && deletedChats.includes(selectedChatId)) {
      setDeletedChats(prev => {
        const updated = prev.filter(x => x !== selectedChatId);
        localStorage.setItem("deleted_chats", JSON.stringify(updated));
        return updated;
      });
    }
  }, [selectedChatId, deletedChats]);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => {
      if (username) {
        socket.emit("biometric_auth", { forceUsername: username });
      }
    });

    // Poll for users if the list is empty (fallback for initial missed emission)
    const pollInterval = setInterval(() => {
      if (onlineUsers.length === 0) {
        socket.emit("get_users"); // We'll add this handler to the server
      }
    }, 2000);

    socket.emit("get_wallet");
    socket.on("wallet_update", (data) => {
      setWalletInfo(data);
      if (data.history && data.history.length === 1 && data.history[0].reason === 'First Login Bonus' && !(window as any).bonusSoundPlayed) {
        (window as any).bonusSoundPlayed = true;
        setTimeout(() => {
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
          audio.play().catch(() => { });
          setToast({ id: 'sys_bonus', name: "AURA BANK", text: `💳 WELCOME BONUS GRANTED: 15,000 LKR` });
        }, 1000);
      }
    });

    socket.on("update_users", (users: any[]) => {
      setOnlineUsers(users);
      // Populate avatar cache from users broadcast (keyed by username)
      const updates: Record<string, string> = {};
      users.forEach(u => {
        if (u.username && u.avatar) {
          updates[u.username] = u.avatar;
        }
      });
      if (Object.keys(updates).length > 0) updateAvatarCache(updates);
    });
    socket.on("update_stats", (stats) => setSystemStats(stats));

    socket.on("discord_qa_message_received", (data) => {
      setQaMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });

      if (data.isSystem) {
        const text = data.text;
        let status = "online";
        if (text.includes("offline")) status = "offline";
        else if (text.includes("Idle")) status = "idle";

        const agents = ["AURA-OS", "DevBot", "Ashfaq", "Rift_Dev", "Luna_Coder", "Cyber_Sam", "Neon_Gamer", "Pixel_Art", "agent7205"];
        const foundAgent = agents.find(a => text.includes(a));
        if (foundAgent) {
          setMemberStatuses((prev: any) => ({ ...prev, [foundAgent]: status }));
        }
      }

      if (data.sender !== username) {
        let title = "Discord Message";
        let type = "message";
        if (data.isSystem) {
          title = "Discord Update";
          type = "status";
        } else if (data.text.includes("joined") || data.text.includes("connected")) {
          title = "Developer Joined";
          type = "join";
        }
        addNotification(title, `${data.isSystem ? '' : (data.sender + ': ')}${data.text}`, type);
      }
    });

    socket.on("discord_typing_status_received", (data) => {
      const { channelId, username: typingUser, isTyping } = data;
      setDiscordTypingMap((prev: any) => {
        const currentList = prev[channelId] || [];
        if (isTyping) {
          if (currentList.includes(typingUser)) return prev;
          return { ...prev, [channelId]: [...currentList, typingUser] };
        } else {
          return { ...prev, [channelId]: currentList.filter((u: string) => u !== typingUser) };
        }
      });
    });

    socket.on("typing_start", (data) => setTypingStatus(`${data.senderName} is thinking...`));
    socket.on("typing_end", () => setTypingStatus(null));

    socket.on("receive_message", (msg) => {
      const senderUsername = msg.senderUsername || msg.senderName;
      const isFromOther = msg.senderId && msg.senderId !== socket.id;
      if (isFromOther && senderUsername) {
        // Key by senderUsername (stable) not senderId (volatile socket ID)
        setLastMessageMap((p: any) => ({
          ...p,
          [senderUsername]: Date.now(),
          [`text_${senderUsername}`]: msg.text
        }));

        let decryptedText = msg.text;
        if (msg.isEncrypted) {
          try {
            const bytes = CryptoJS.AES.decrypt(msg.text, SECRET_KEY);
            decryptedText = bytes.toString(CryptoJS.enc.Utf8);
          } catch (err) { decryptedText = "Encrypted Message"; }
        }

        // Check if message is for the currently open chat (by username)
        const currentTarget = onlineUsers.find((u: any) => u.id === selectedChatIdRef.current);
        const currentTargetUsername = currentTarget?.username || selectedChatIdRef.current;
        const isCurrentChat = senderUsername === currentTargetUsername || msg.senderId === selectedChatIdRef.current;

        if (!isCurrentChat && msg.id && !msg.id.startsWith("sys_")) {
          // If it's a payment slip/transfer message, ONLY show toast notification to sender or recipient!
          if (msg.slipData || (typeof msg.text === 'string' && msg.text.includes('[PAYMENT SLIP]'))) {
            const isParticipant = (msg.senderUsername === username || msg.senderName === username || msg.targetUsername === username || msg.slipData?.to === username || msg.slipData?.from === username);
            if (!isParticipant) {
              return; // Ignore notification for third-party accounts
            }
          }
          try {
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
            audio.play().catch(() => { });
          } catch (e) { }
          setToast({ id: msg.senderId, name: msg.senderName, text: decryptedText });
          setTimeout(() => setToast(null), 3000);
        }
      }
    });

    socket.on("stream_chunk", (data) => {
      // We'll update the preview as it streams
      setLastMessageMap((p: any) => ({ ...p, [`text_${data.senderId}`]: (p[`text_${data.senderId}`] || "") + data.text }));
    });

    socket.on("incoming_call", (data) => {
      // Play ringtone immediately on event arrival
      try {
        const ring = new Audio("https://assets.mixkit.co/active_storage/sfx/2805/2805-preview.mp3");
        ring.loop = false;
        ring.play().catch(() => {});
      } catch (e) {}
      setIncomingCall(data);
    });

    socket.on("ludo_invite_received", (data) => {
      setIncomingLudoInvites(prev => {
        if (prev.find(i => i.roomId === data.roomId)) return prev;
        return [...prev, data];
      });
    });

    socket.on("call_ended", () => {
      setActiveCall(null);
      setIncomingCall(null);
      // Refresh call logs after a call ends
      setTimeout(() => socket.emit("get_call_logs"), 800);
    });

    socket.on("incoming_call_dismissed", () => {
      setIncomingCall(null);
    });

    socket.on("receive_call_logs", (logs: any[]) => {
      setCallLogs(logs);
    });

    // Fetch initial call logs on connect
    socket.emit("get_call_logs");

    socket.on("agent_joined_game", (data) => {
      setPendingAgents(p => [...p, { id: data.agentId || 'agent', username: data.agentName }]);
      setActiveTab('survival');
    });

    socket.on("force_open_ludo", (data) => {
      setSelectedLudoRoom(data.roomId);
      setActiveTab('survival');
      if (data.targetUser) {
        setLudoNegotiationTarget(data.targetUser);
        setPendingAgents(p => {
          if (!p.find(u => u.id === data.targetUser.id)) {
            return [...p, data.targetUser];
          }
          return p;
        });
      }
    });

    socket.on('community_ludo_lobbies', (lobbies: any[]) => {
      setCommunityLobbies(lobbies);
    });

    socket.on('community_ludo_hosted', (data: any) => {
      setMyHostedRoom(data.roomId);
    });

    socket.on('community_ludo_joined', (data: any) => {
      setSelectedLudoRoom(data.roomId);
    });

    socket.on('community_ludo_ready', (data: any) => {
      setSelectedLudoRoom(data.roomId);
      setActiveTab('survival');
    });

    // Socket listeners for Peer-to-Peer Real-Time Money Transfer & Digital Receipts
    socket.on("transfer_success", (data: any) => {
      setTransferLoading(false);
      setShowTransferModal(false);
      setActiveReceipt(data.receipt);
      setShowReceiptModal(true);
      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
        audio.play().catch(() => {});
      } catch (e) {}
      setToast({ id: 'sys_transfer', name: "NEURAL BANK", text: data.message });
    });

    socket.on("transfer_received", (data: any) => {
      setActiveReceipt(data.receipt);
      // DO NOT call setShowReceiptModal(true) on recipient side so no popup forces open!
      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
        audio.play().catch(() => {});
      } catch (e) {}
      const senderUname = data.receipt?.sender;
      if (senderUname) {
        setUnreadMap((p: any) => ({ ...p, [senderUname]: true }));
        setLastMessageMap((p: any) => ({
          ...p,
          [senderUname]: Date.now(),
          [`text_${senderUname}`]: `💸 Received ${data.receipt?.amount?.toLocaleString()} LKR from @${senderUname}`
        }));
      }
      const senderUserObj = onlineUsers.find((u: any) => u.username?.toLowerCase() === senderUname?.toLowerCase());
      const toastTargetId = senderUserObj ? senderUserObj.id : senderUname;
      setToast({ id: toastTargetId || 'sys_transfer_recv', name: `@${senderUname || "NEURAL BANK"}`, text: `📥 Received ${data.receipt?.amount?.toLocaleString()} LKR from @${senderUname}!` });
    });

    socket.on("transfer_error", (data: any) => {
      setTransferLoading(false);
      setTransferError(data.message);
    });

    socket.on("registered_users_list", (users: any[]) => {
      setRegisteredUsersList(users);
    });

    // Fetch any already-open lobbies on mount
    socket.emit('get_community_lobbies');

    return () => {
      clearInterval(pollInterval);
      socket.off("update_users");
      socket.off("update_stats");
      socket.off("incoming_call");
      socket.off("ludo_invite_received");
      socket.off("call_ended");
      socket.off("receive_call_logs");
      socket.off("agent_joined_game");
      socket.off("force_open_ludo");
      socket.off("wallet_update");
      socket.off("discord_qa_message_received");
      socket.off('community_ludo_lobbies');
      socket.off('community_ludo_hosted');
      socket.off('community_ludo_joined');
      socket.off('community_ludo_ready');
    };
  }, [socket, onlineUsers.length]);

  // Global Developer Simulator for Discord Community Q&A with Sequential Scenarios
  useEffect(() => {
    if (!socket || !isSimulationEnabled) return;

    const SCENARIOS = [
      {
        name: "agent7205_pitch",
        steps: [
          { type: "join", sender: "agent7205", text: '✨ agent7205 has joined the Discord matrix. "Ready to code!"' },
          { type: "message", sender: "agent7205", avatar: "agent7205", text: "Hey community! I am agent7205. I want to share my ultimate startup project idea: a fully decentralized code workspace using Neural sync!" },
          { type: "message", sender: "Luna_Coder", avatar: "Luna", text: "Wow, that sounds extremely revolutionary agent7205. We could build a stunning glassmorphic UI for it!" },
          { type: "message", sender: "Cyber_Sam", avatar: "Sam", text: "Yes! Using WebSockets peer-to-peer tunnels to synchronize client states would make it latency-free." },
          { type: "message", sender: "agent7205", avatar: "agent7205", text: "Exactly! And we can run backups on the decentralized database nodes every 24 hours automatically." },
          { type: "leave", sender: "agent7205", text: '💤 agent7205 went offline. "Incubating more ideas..."' }
        ]
      },
      {
        name: "unreal_integration",
        steps: [
          { type: "join", sender: "Rift_Dev", text: '✨ Rift_Dev has joined the Discord matrix. "Ready to code!"' },
          { type: "message", sender: "Rift_Dev", avatar: "Rift", text: "Does anyone have a sample configuration for connecting Unreal Engine C++ WebSockets to Aura's dashboard?" },
          { type: "message", sender: "DevBot", avatar: "DevBot", text: "Yes Rift_Dev! Under #unreal-engine-realtime, you can find the C++ class header setup using FWebSocketsModule." },
          { type: "message", sender: "Rift_Dev", avatar: "Rift", text: "Ah, found it! Compiling the module now. Thank you, DevBot!" },
          { type: "leave", sender: "Rift_Dev", text: '💤 Rift_Dev went offline. "Heading to the grid..."' }
        ]
      },
      {
        name: "ludo_betting",
        steps: [
          { type: "join", sender: "Neon_Gamer", text: '✨ Neon_Gamer has joined the Discord matrix. "Ready to code!"' },
          { type: "message", sender: "Neon_Gamer", avatar: "Neon", text: "Hey! Who is up for a Neural Ludo game? Minimum bet is 500 LKR. Ready to deploy pieces to grid!" },
          { type: "message", sender: "Pixel_Art", avatar: "Pixel", text: "I am down! Just topped up my wallet. Let's start a 1v1 match." },
          { type: "message", sender: "Neon_Gamer", avatar: "Neon", text: "Sending invite now! Join via the notification link." },
          { type: "leave", sender: "Neon_Gamer", text: '💤 Neon_Gamer went offline. "In-game..."' }
        ]
      }
    ];

    let timeouts: NodeJS.Timeout[] = [];
    let scenarioIndex = 0;

    const runScenario = () => {
      const scenario = SCENARIOS[scenarioIndex];
      scenarioIndex = (scenarioIndex + 1) % SCENARIOS.length;

      scenario.steps.forEach((step, idx) => {
        const stepTimeout = setTimeout(() => {
          let payload: any = null;
          if (step.type === "join" || step.type === "leave") {
            payload = {
              id: `sys_${step.type}_${Date.now()}_${idx}`,
              sender: "System",
              avatar: "System",
              isSystem: true,
              text: step.text,
              timestamp: new Date()
            };
          } else {
            payload = {
              id: `dev_msg_${Date.now()}_${idx}`,
              sender: step.sender,
              avatar: step.avatar,
              isBot: step.sender === "DevBot",
              text: step.text,
              timestamp: new Date()
            };
          }

          if (payload) {
            socket.emit("discord_qa_message", payload);
          }
        }, idx * 4500); // 4.5s delay between steps

        timeouts.push(stepTimeout);
      });
    };

    // Run first scenario after 6s
    const initialTimeout = setTimeout(runScenario, 6000);
    timeouts.push(initialTimeout);

    // Schedule subsequent scenarios every 32 seconds
    const intervalId = setInterval(runScenario, 32000);

    return () => {
      timeouts.forEach(t => clearTimeout(t));
      clearInterval(intervalId);
    };
  }, [socket, isSimulationEnabled]);

  const startCall = (user: any, isVideo: boolean = true) => {
    // 1. Check if the target is an active real online user connected to socket
    const currentOnlineUser = onlineUsers.find((u: any) => 
      (u.username === user.username || u.id === user.id) && 
      !u.isVirtual && 
      !String(u.id).startsWith("virtual_") && 
      !String(u.id).startsWith("agent_")
    );
    const actualTargetId = currentOnlineUser ? currentOnlineUser.id : user.id;
    const avatarSrc = getAvatarSrc(user.username, user.avatar);

    // Is this a real human online user? If so, it is ALWAYS a real call (never AI).
    const isRealOnlineUser = !!currentOnlineUser || (
      actualTargetId && 
      !String(actualTargetId).startsWith("virtual_") && 
      !String(actualTargetId).startsWith("agent_") && 
      !user.isBot && 
      !user.isVirtual
    );

    // AI Voice Call Interface is ONLY for AI Chat Agents (Titan-Shell, DevBot, etc.) when they are NOT real socket users
    const isAi = !isRealOnlineUser && (
      (actualTargetId && String(actualTargetId).startsWith("agent_")) ||
      (user.id && (String(user.id).startsWith("agent_") || String(user.id).startsWith("virtual_"))) ||
      user.isBot ||
      user.isVirtual
    );

    setActiveCall({ 
      userId: actualTargetId || user.id, 
      username: user.username, 
      avatarSrc,
      isCaller: true, 
      isAi: !!isAi,
      isVideo: isAi ? false : isVideo 
    });
  };

  const acceptCall = () => {
    if (!incomingCall) return;
    const avatarSrc = getAvatarSrc(incomingCall.callerName, incomingCall.callerAvatar);
    setActiveCall({ 
      userId: incomingCall.from, 
      username: incomingCall.callerName, 
      avatarSrc,
      isCaller: false, 
      isAi: false,
      initialSignal: incomingCall.signal,
      isVideo: incomingCall.isVideo 
    });
    setIncomingCall(null);
  };

  const declineCall = () => {
    if (incomingCall) {
      socket?.emit("end_call", { to: incomingCall.from });
      setIncomingCall(null);
    }
  };

  // selectedChatId is now at the top of the component

  return (
    <div className={`flex h-screen bg-[#090d16] overflow-hidden flex-col md:flex-row ${activeTab === 'survival' ? 'pb-0' : 'pb-16 md:pb-0'}`}>
      {/* Welcome Modal */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050810]/90 backdrop-blur-sm p-4"
          >
            <div className="bg-[#0f1b29] border border-emerald-500 rounded-2xl p-8 max-w-xl w-full shadow-[0_0_50px_rgba(16,185,129,0.2)] text-center">
              <h2 className="text-3xl font-black text-white mb-2">INITIALIZING AURA CHATBOT</h2>
              <div className="inline-block px-4 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-mono text-sm mb-6">SYSTEM ARCHITECT: ASHFAQ</div>
              <p className="text-gray-300 mb-6 text-lg leading-relaxed">
                Ashfaq is an elite <strong className="text-emerald-400">Full Stack Web Developer</strong>. His unparalleled expertise in engineering complex, scalable, and secure real-time systems has brought this neural network online.
              </p>
              <button
                onClick={() => setShowWelcome(false)}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
              >
                ENTER SECURE GRID
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <nav className={`fixed bottom-0 inset-x-0 h-16 border-t border-white/5 bg-[#050810]/95 backdrop-blur-xl flex flex-row justify-around items-center z-50 md:relative md:bottom-auto md:inset-x-auto md:w-20 md:h-full md:border-r md:border-t-0 md:flex-col md:py-6 shrink-0 transition-all duration-500 ${activeTab === "survival" ? "-translate-y-full md:-translate-x-full opacity-0 pointer-events-none !h-0 md:!w-0" : "translate-y-0 md:translate-x-0 opacity-100"}`}>
        <div className="hidden md:flex flex-col items-center gap-6 mb-8 select-none">
          <Cpu className="w-8 h-8 text-emerald-500 animate-pulse" />
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all shadow-[0_0_15px_rgba(255,255,255,0.02)]"
            title="Notifications Log"
          >
            <Zap className={`w-5 h-5 ${notifications.some(n => !n.read) ? 'animate-bounce text-emerald-400' : ''}`} />
            {notifications.some(n => !n.read) && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>
        </div>
        <div className="flex-1 flex flex-row md:flex-col gap-2 md:gap-6 justify-around md:justify-start w-full md:w-auto items-center">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="md:hidden w-10 h-10 rounded-2xl flex items-center justify-center relative text-gray-500 hover:text-white"
            title="Notifications"
          >
            <Zap className={`w-5 h-5 ${notifications.some(n => !n.read) ? 'text-emerald-400' : ''}`} />
            {notifications.some(n => !n.read) && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>
          <button onClick={() => setActiveTab('chat')} className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'chat' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="Neural Chat"><MessageSquare className="w-5 h-5 md:w-6 md:h-6" /></button>
          <button onClick={() => setActiveTab('directory')} className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'directory' ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="Agents Directory"><Users className="w-5 h-5 md:w-6 md:h-6" /></button>
          <button onClick={() => { setActiveTab('calls'); socket?.emit('get_call_logs'); }} className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all relative ${activeTab === 'calls' ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="Call Logs"><PhoneCall className="w-5 h-5 md:w-6 md:h-6" /></button>
          <button onClick={() => setActiveTab('survival')} className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'survival' ? 'bg-purple-500 text-black shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="Survival Protocol"><Gamepad2 className="w-5 h-5 md:w-6 md:h-6" /></button>
          <button onClick={() => setActiveTab('wallet')} className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'wallet' ? 'bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="Neural Wallet"><Wallet className="w-5 h-5 md:w-6 md:h-6" /></button>
          <button onClick={() => setActiveTab('shop')} className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'shop' ? 'bg-emerald-400 text-black shadow-[0_0_20px_rgba(52,211,153,0.4)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="Neural Shop"><Swords className="w-5 h-5 md:w-6 md:h-6" /></button>
          <button onClick={() => setActiveTab('admin')} className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'admin' ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="System Dashboard"><LayoutDashboard className="w-5 h-5 md:w-6 md:h-6" /></button>
          <button onClick={() => setActiveTab('discord')} className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'discord' ? 'bg-[#5865F2] text-white shadow-[0_0_20px_rgba(88,101,242,0.4)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="Aura Discord Dev Hub"><Compass className="w-5 h-5 md:w-6 md:h-6" /></button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl border-2 flex items-center justify-center transition-all overflow-hidden md:mt-auto md:mb-4 ${activeTab === 'profile' ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-white/10 hover:border-white/20'}`}
            title="Edit Profile"
          >
            <img src={String(avatarSeed || username || "").startsWith("data:image") ? avatarSeed || username : `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed || username}`} alt="avatar" className="w-8 h-8 md:w-10 md:h-10 rounded-xl" />
          </button>
        </div>
      </nav>

      {/* WhatsApp Style Chat Sidebar */}
      {activeTab === 'chat' && (
        <div className={`w-full md:w-80 border-r border-white/5 bg-[#0b121f] flex flex-col shrink-0 overflow-hidden h-full ${selectedChatId !== 'LIST' ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-4">Chats</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(e.target.value.trim().length > 0);
                }}
                onFocus={() => setShowSearchResults(searchQuery.trim().length > 0)}
                className="w-full bg-[#050810] border border-white/5 rounded-full py-2 px-4 text-xs text-gray-300 outline-none focus:border-emerald-500/50"
              />
              <AnimatePresence>
                {showSearchResults && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSearchResults(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 right-0 top-11 bg-[#0c1222]/95 border border-white/10 rounded-2xl py-3 px-2 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-md z-50 max-h-72 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10"
                    >
                      {onlineUsers
                        .filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) && u.username !== username)
                        .map(user => {
                          const displayName = nicknames[user.id] || user.username;
                          return (
                            <div key={user.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full border border-white/10 overflow-hidden bg-[#050810]">
                                  <img src={String(user.avatar || "").startsWith("data:image") ? user.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${user.avatar || user.username}`} className="w-full h-full" />
                                </div>
                                <div>
                                  <h4 className="text-white text-xs font-bold font-mono">{displayName}</h4>
                                  <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-tighter">{user.status}</p>
                                </div>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedChatId(user.id);
                                    setSearchQuery("");
                                    setShowSearchResults(false);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                                >
                                  Chat
                                </button>
                                <button
                                  onClick={() => {
                                    startCall(user);
                                    setShowSearchResults(false);
                                  }}
                                  className="p-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      {onlineUsers.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) && u.username !== username).length === 0 && (
                        <div className="text-center py-4 text-xs font-mono text-gray-500 uppercase">No active agents found</div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            <ChatListItem
              active={selectedChatId === null}
              onClick={() => setSelectedChatId(null)}
              name="Global Encrypted Network"
              lastMsg="Encrypted broadcast active..."
              time="LIVE"
              isGlobal
            />

            {/* Archived Chats Folder Row */}
            {archivedChats.length > 0 && !showArchivedOnly && (
              <button
                onClick={() => setShowArchivedOnly(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 border border-transparent transition-all mb-2"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                  <Archive className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-white text-xs font-bold font-mono uppercase tracking-wider">Archived Chats</h4>
                  <p className="text-[10px] text-gray-500 font-mono">{archivedChats.length} encrypted chat{archivedChats.length > 1 ? 's' : ''} stored</p>
                </div>
              </button>
            )}

            {showArchivedOnly && (
              <button
                onClick={() => setShowArchivedOnly(false)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 border border-transparent transition-all mb-2 text-emerald-400 font-mono text-xs uppercase font-bold tracking-wider"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Chats
              </button>
            )}

            <div className="py-2 px-4 text-[10px] text-gray-600 uppercase font-mono tracking-widest border-b border-white/5 mb-2">
              {showArchivedOnly ? "Archived Tunnels" : "Private Tunnels"}
            </div>
            {[...onlineUsers, ...virtualDmUsers]
              .filter(u => {
                if (u.username === username) return false;
                if (deletedChats.includes(u.id)) return false;
                if (u.isVirtual) return true; // always show virtual DM users
                const isArchived = archivedChats.includes(u.id);
                return showArchivedOnly ? isArchived : !isArchived;
              })
              // Sort by username-keyed lastMessageMap for stability across reconnects
              .sort((a, b) => (lastMessageMap[b.username] || lastMessageMap[b.id] || 0) - (lastMessageMap[a.username] || lastMessageMap[a.id] || 0))
              .map(user => {
                // Use avatarCache (keyed by username) for reliable avatar lookup
                const cachedAvatar = avatarCache[user.username] || user.avatar;
                return (
                  <ChatListItem
                    key={user.id}
                    active={selectedChatId === user.id}
                    onClick={() => {
                      setSelectedChatId(user.id);
                      // Clear unread by both id and username
                      setUnreadMap(p => ({ ...p, [user.id]: false, [user.username]: false }));
                    }}
                    name={nicknames[user.id] || user.username}
                    avatar={cachedAvatar}
                    lastMsg={lastMessageMap[`text_${user.username}`] || lastMessageMap[`text_${user.id}`] || (user.status === "online" ? "Active link..." : "Disconnected")}
                    time={user.status.toUpperCase()}
                    status={user.status}
                    hasUnread={unreadMap[user.id] || unreadMap[user.username]}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative bg-[#050810] overflow-hidden min-h-0">
        {activeTab === 'chat' && selectedChatId !== 'LIST' && (
          <div className="flex-1 bg-[#050810] relative z-10 flex flex-col h-full min-h-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full relative shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20 flex flex-col min-h-0">
              <MultiplayerChat
                socket={socket}
                username={username}
                onlineCount={onlineUsers.length}
                targetId={selectedChatId}
                targetName={selectedChatId ? [...onlineUsers, ...virtualDmUsers].find((u: any) => u.id === selectedChatId)?.username || "Unknown" : "Global Network"}
                typingStatus={typingStatus}
                setUnreadMap={setUnreadMap}
                setLastMessageMap={setLastMessageMap}
                selectedChatId={selectedChatId}
                onlineUsers={[...onlineUsers, ...virtualDmUsers]}
                onCall={startCall}
                onBack={() => setSelectedChatId('LIST')}
                nicknames={nicknames}
                onNicknameChange={updateNickname}
                archivedChats={archivedChats}
                toggleArchiveChat={toggleArchiveChat}
                deleteChat={deleteChat}
                autoStartLudoLobby={pendingLudoInvite && typeof selectedChatId === 'string' && selectedChatId.startsWith('virtual_')}
                onDeployToGrid={(roomId?: string, players?: string[]) => { setPendingLudoInvite(false); if (roomId) setSelectedLudoRoom(roomId); if (players?.length) setPendingAgents(players); setActiveTab('survival'); }}
                isVirtualDm={typeof selectedChatId === 'string' && selectedChatId.startsWith('virtual_')}
                virtualDmOpening={virtualDmUsers.find((u: any) => u.id === selectedChatId)?.openingMessage}
                avatarCache={avatarCache}
                onCollectPayment={(amount: number) => {
                  setWalletInfo((prev: any) => ({
                    ...prev,
                    wallet: (prev?.wallet || 0) + amount,
                    history: [{ type: 'received', amount, from: selectedChatId?.replace('virtual_', '') || 'Community', date: new Date().toISOString() }, ...(prev?.history || [])]
                  }));
                }}
                onSelectReceipt={(receipt: any) => {
                  setActiveReceipt(receipt);
                  setShowReceiptModal(true);
                }}
              />
            </motion.div>
          </div>
        )}
        {activeTab === 'directory' && <OnlineUsersDirectory onlineUsers={onlineUsers} onCall={startCall} onChat={(id) => { setSelectedChatId(id); setActiveTab('chat'); }} />}
        {activeTab === 'calls' && <CallLogsPage callLogs={callLogs} onCall={startCall} username={username} onlineUsers={onlineUsers} />}
        {activeTab === 'admin' && <AdminPlaceholder stats={systemStats} />}
        {activeTab === 'wallet' && (
          <WalletPage 
            walletInfo={walletInfo} 
            username={username} 
            onOpenTransfer={(prefillUser?: string) => {
              if (prefillUser) setTransferRecipient(prefillUser);
              setTransferError(null);
              socket?.emit("get_registered_users");
              setShowTransferModal(true);
            }}
            onSelectReceipt={(receipt: any) => {
              setActiveReceipt(receipt);
              setShowReceiptModal(true);
            }}
          />
        )}
        {activeTab === 'profile' && (
          <ProfilePage
            username={username}
            setUsername={setUsername}
            avatarSeed={avatarSeed}
            setAvatarSeed={setAvatarSeed}
            about={about}
            setAbout={setAbout}
            showLastSeen={showLastSeen}
            setShowLastSeen={setShowLastSeen}
            socket={socket}
            onBack={() => setActiveTab('chat')}
            stats={systemStats}
            chatTheme={chatTheme}
            setChatTheme={setChatTheme}
            chatWallpaper={chatWallpaper}
            setChatWallpaper={setChatWallpaper}
          />
        )}
        {activeTab === 'survival' && <NeuralGameWorld username={username} onBack={() => { setActiveTab('chat'); setSelectedLudoRoom(null); }} pendingAgents={pendingAgents} initialRoomId={selectedLudoRoom} socket={socket} inventory={walletInfo?.inventory} wallet={walletInfo?.wallet} negotiationTarget={ludoNegotiationTarget} clearNegotiationTarget={() => setLudoNegotiationTarget(null)} />}
        {activeTab === 'shop' && <ShopPage socket={socket} walletInfo={walletInfo} />}
        {activeTab === 'discord' && <DiscordDevHub socket={socket} username={username} nicknames={nicknames} qaMessages={qaMessages} setQaMessages={setQaMessages} memberStatuses={memberStatuses} setMemberStatuses={setMemberStatuses} discordTypingMap={discordTypingMap} isSimulationEnabled={isSimulationEnabled} setIsSimulationEnabled={setIsSimulationEnabled} onlineUsers={onlineUsers} onGoToChat={(memberInfo: any, dmQuestion?: string) => {
          const virtualId = addVirtualDmUser(memberInfo, dmQuestion);
          setActiveTab('chat');
          setSelectedChatId(virtualId);
        }} onLudoInvite={(memberInfo: any) => {
          const roomId = `AURA-${Date.now().toString().slice(-5)}`;
          const virtualId = addVirtualDmUser({ ...memberInfo, openingMessage: `Let's play Ludo! I joined room ${roomId} 🎮` }, `Let's play Ludo! I joined room ${roomId} 🎮`);
          setPendingLudoInvite(true);
          setActiveTab('chat');
          setSelectedChatId(virtualId);
        }} />}

        {/* Global Notification Center Popover */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed top-16 right-4 md:right-24 w-80 md:w-96 max-h-[480px] bg-[#090d16]/95 border border-white/10 rounded-3xl p-4 shadow-2xl backdrop-blur-xl z-[100] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3 select-none">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-[15px] font-mono tracking-wide">NOTIFICATIONS</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMuteNotificationSound(!muteNotificationSound)}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-mono transition-all ${muteNotificationSound
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      }`}
                  >
                    {muteNotificationSound ? 'SOUND: OFF' : 'SOUND: ON'}
                  </button>
                  <button
                    onClick={() => {
                      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                      setShowNotifications(false);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/5">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-500 uppercase font-mono">No new alerts</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                        if (notif.title.includes("Developer") || notif.title.includes("Discord")) {
                          setActiveTab('discord');
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${notif.read
                          ? 'bg-white/2 border-white/5 opacity-60 hover:opacity-100'
                          : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-bold text-white text-xs font-mono tracking-tighter truncate">{notif.title}</span>
                        <span className="text-[9px] text-gray-500 font-mono select-none">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 font-mono leading-relaxed break-words">{notif.text}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Incoming Ludo Invitation Modal */}
        <AnimatePresence>
          {incomingLudoInvites.map((invite) => (
            <motion.div
              key={invite.roomId}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-8 right-8 z-[100] w-80 bg-[#0c1222]/90 backdrop-blur-xl border border-emerald-500/50 rounded-3xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.3)] mb-4"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 overflow-hidden">
                    <img src={String(invite.fromAvatar || "").startsWith("data:image") ? invite.fromAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${invite.fromAvatar || invite.fromName}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-ping"></div>
                </div>
                <div>
                  <h3 className="text-emerald-400 font-black text-xs uppercase tracking-widest">Incoming Game</h3>
                  <p className="text-white font-bold">{invite.fromName}</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs mb-6 leading-relaxed uppercase font-mono">Invited you to a <span className="text-white font-bold">Neural Ludo</span> session. Current players: {invite.playerCount}/4</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedLudoRoom(invite.roomId);
                    setIncomingLudoInvites(p => p.filter(i => i.roomId !== invite.roomId));
                    setActiveTab('survival');
                  }}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl transition-all text-xs uppercase tracking-widest"
                >
                  Accept
                </button>
                <button
                  onClick={() => setIncomingLudoInvites(p => p.filter(i => i.roomId !== invite.roomId))}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-xl transition-all text-xs uppercase"
                >
                  Decline
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Incoming Chat Toast Overlay */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 20, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              onClick={() => { setSelectedChatId(toast.id); setActiveTab('chat'); setToast(null); }}
              className="absolute top-0 right-10 bg-[#0f1b29] border border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] rounded-xl p-4 z-50 flex items-center gap-4 cursor-pointer hover:bg-[#162638] transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                {(() => {
                  // Use avatarCache (by username) for reliable toast avatar
                  const toastAvatarSrc = getAvatarSrc(toast.name);
                  return <img src={toastAvatarSrc} className="w-8 h-8 rounded-full" />;
                })()}
              </div>
              <div className="flex-1 overflow-hidden">
                <h4 className="text-emerald-400 font-bold text-sm truncate">{toast.name}</h4>
                <p className="text-white text-xs truncate max-w-[200px]">{toast.text}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Incoming Call Overlay */}
        <AnimatePresence>
          {incomingCall && !activeCall && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 0 }}
              className="fixed inset-0 bg-[#0b141a] z-[9999] flex flex-col justify-between py-20 px-6 items-center text-white"
            >
              <audio autoPlay loop src="https://assets.mixkit.co/active_storage/sfx/2805/2805-preview.mp3" />
              {/* Top Section */}
              <div className="flex flex-col items-center gap-2 mt-4 select-none">
                <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[10px] uppercase tracking-[0.2em] bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  <Lock className="w-3 h-3 text-emerald-400 animate-pulse" /> End-to-End Encrypted
                </div>
              </div>

              {/* Middle Section: Avatar & Info */}
              <div className="flex flex-col items-center text-center select-none">
                <div className="relative mb-6">
                  {/* Outer pulsing rings */}
                  <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-[-12px] rounded-full border-2 border-emerald-500/30 animate-pulse" />
                  
                  <div className="w-36 h-36 rounded-full border-4 border-emerald-500/80 overflow-hidden bg-[#0c1222] shadow-[0_0_50px_rgba(16,185,129,0.3)] relative z-10 flex items-center justify-center">
                    {(() => {
                      const callerAvatarSrc = getAvatarSrc(incomingCall.callerName, incomingCall.callerAvatar);
                      return <img src={callerAvatarSrc} alt="Caller Avatar" className="w-full h-full object-cover" />;
                    })()}
                  </div>
                </div>

                <h2 className="text-3xl font-black tracking-wide text-white uppercase font-sans mb-2 drop-shadow-md">
                  {incomingCall.callerName}
                </h2>
                <p className="text-emerald-400 font-mono text-xs uppercase tracking-widest animate-pulse">
                  Incoming {incomingCall.isVideo ? 'Video' : 'Voice'} Call...
                </p>
              </div>

              {/* Bottom Section: Answer / Decline Buttons */}
              <div className="flex items-center gap-12 mb-6">
                {/* Decline Button */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={declineCall}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-300 flex items-center justify-center shadow-[0_0_35px_rgba(239,68,68,0.4)] hover:scale-105 active:scale-95 animate-pulse"
                    title="Decline Call"
                  >
                    <Phone className="w-7 h-7 rotate-[135deg] text-white" />
                  </button>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 font-bold mt-1">Decline</span>
                </div>

                {/* Answer Button */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={acceptCall}
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 transition-all duration-300 flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 animate-bounce"
                    style={{ animationDuration: '2s' }}
                    title="Answer Call"
                  >
                    <PhoneCall className="w-7 h-7 text-[#050810]" />
                  </button>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500 font-bold mt-1">Answer</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Call Interface */}
        <AnimatePresence>
          {activeCall && (
            activeCall.isAi ? (
              <AiVoiceCallInterface activeCall={activeCall} onEnd={() => setActiveCall(null)} socket={socket} />
            ) : (
              <VideoCallInterface
                socket={socket}
                activeCall={activeCall}
                myUsername={username}
                onEnd={() => setActiveCall(null)}
              />
            )
          )}
        </AnimatePresence>

        {/* Real-Time P2P Money Transfer Modal Overlay */}
        <TransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          socket={socket}
          username={username}
          walletBalance={walletInfo?.wallet || 0}
          defaultRecipient={transferRecipient}
          loading={transferLoading}
          error={transferError}
        />

        {/* Digital Receipt Modal Overlay */}
        {showReceiptModal && activeReceipt && (
          <DigitalReceiptModal
            receipt={activeReceipt}
            onClose={() => {
              setShowReceiptModal(false);
              setActiveReceipt(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

function OnlineUsersDirectory({ onlineUsers, onCall, onChat }: { onlineUsers: any[], onCall: (u: any, isVideo: boolean) => void, onChat: (id: string) => void }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [discoverSearch, setDiscoverSearch] = useState('');

  const CATEGORIES = [
    { label: 'All', icon: '🌐', color: 'from-cyan-500 to-blue-600' },
    { label: 'Online', icon: '🟢', color: 'from-emerald-500 to-green-600' },
    { label: 'Developers', icon: '💻', color: 'from-violet-500 to-purple-600' },
    { label: 'Gamers', icon: '🎮', color: 'from-orange-500 to-red-500' },
    { label: 'Designers', icon: '🎨', color: 'from-pink-500 to-rose-500' },
    { label: 'AI Agents', icon: '🤖', color: 'from-sky-500 to-cyan-600' },
    { label: 'VIP', icon: '👑', color: 'from-yellow-400 to-amber-500' },
  ];

  const ROLES: Record<string, string> = {
    'Ashfaq': 'Founder / Admin',
    'DevBot': 'AI Agent',
    'agent7205': 'AI Agent',
  };

  const getCategoryRole = (username: string, status: string) => {
    if (ROLES[username]) return ROLES[username];
    const seed = username.charCodeAt(0) % 4;
    return ['Developer', 'Gamer', 'Designer', 'Developer'][seed];
  };

  const matchesCategory = (user: any) => {
    if (activeCategory === 'All') return true;
    if (activeCategory === 'Online') return user.status === 'online';
    const role = getCategoryRole(user.username, user.status);
    if (activeCategory === 'Developers') return role === 'Developer';
    if (activeCategory === 'Gamers') return role === 'Gamer';
    if (activeCategory === 'Designers') return role === 'Designer';
    if (activeCategory === 'AI Agents') return role === 'AI Agent';
    if (activeCategory === 'VIP') return user.username === 'Ashfaq';
    return true;
  };

  const filtered = onlineUsers.filter(u =>
    matchesCategory(u) &&
    u.username.toLowerCase().includes(discoverSearch.toLowerCase())
  );

  const ROLE_COLORS: Record<string, string> = {
    'Founder / Admin': 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
    'AI Agent': 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
    'Developer': 'text-violet-400 border-violet-400/30 bg-violet-400/10',
    'Gamer': 'text-orange-400 border-orange-400/30 bg-orange-400/10',
    'Designer': 'text-pink-400 border-pink-400/30 bg-pink-400/10',
  };

  return (
    <div className="w-full h-full overflow-y-auto flex flex-col bg-[#050810]">

      {/* ── Hero Header ── */}
      <div className="relative shrink-0 h-52 md:h-64 overflow-hidden">
        {/* Background gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1b3e] via-[#050810] to-[#0a0f1e]" />
        {/* Glowing orbs */}
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -top-10 right-10 w-56 h-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Animated particles */}
        {[...Array(12)].map((_, i) => (
          <div key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-400/60 animate-pulse"
            style={{ left: `${8 + i * 8}%`, top: `${20 + (i % 3) * 25}%`, animationDelay: `${i * 0.3}s` }}
          />
        ))}
        {/* Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.5)]">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight font-mono">
              AURA <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">DISCOVER</span>
            </h1>
          </div>
          <p className="text-gray-400 text-sm font-mono tracking-widest uppercase mb-4">
            {onlineUsers.length} agent{onlineUsers.length !== 1 ? 's' : ''} connected to the neural grid
          </p>
          {/* Search bar in hero */}
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              placeholder="Search agents..."
              value={discoverSearch}
              onChange={e => setDiscoverSearch(e.target.value)}
              className="w-full bg-white/5 backdrop-blur-md border border-white/10 focus:border-cyan-500/50 text-white placeholder-gray-500 rounded-2xl px-5 py-2.5 text-sm font-mono outline-none transition-all pr-10"
            />
            <span className="absolute right-4 top-3 text-gray-500 text-sm">⌕</span>
          </div>
        </div>
      </div>

      {/* ── Category Slider ── */}
      <div className="shrink-0 px-4 py-4 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 w-max mx-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.label)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold font-mono transition-all whitespace-nowrap ${activeCategory === cat.label
                  ? `bg-gradient-to-r ${cat.color} border-transparent text-white shadow-lg scale-105`
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
            >
              <span className="text-base leading-none">{cat.icon}</span>
              {cat.label}
              {activeCategory === cat.label && (
                <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                  {cat.label === 'All' ? onlineUsers.length :
                    cat.label === 'Online' ? onlineUsers.filter(u => u.status === 'online').length :
                      cat.label === 'VIP' ? onlineUsers.filter(u => u.username === 'Ashfaq').length :
                        filtered.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="shrink-0 mx-6 mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Online Now', value: onlineUsers.filter(u => u.status === 'online').length, icon: '🟢', color: 'text-emerald-400' },
          { label: 'Total Agents', value: onlineUsers.length, icon: '👥', color: 'text-cyan-400' },
          { label: 'VIP Members', value: onlineUsers.filter(u => u.username === 'Ashfaq').length || 1, icon: '👑', color: 'text-yellow-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/3 border border-white/5 rounded-2xl px-4 py-3 text-center">
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className={`text-xl font-black font-mono ${stat.color}`}>{stat.value}</div>
            <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── User Grid ── */}
      <div className="flex-1 px-6 pb-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">🔍</span>
            <p className="text-gray-400 font-mono text-sm">No agents found in this category</p>
            <button onClick={() => { setActiveCategory('All'); setDiscoverSearch(''); }} className="mt-4 text-xs text-cyan-400 hover:underline font-mono">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(user => {
              const role = getCategoryRole(user.username, user.status);
              const roleStyle = ROLE_COLORS[role] || ROLE_COLORS['Developer'];
              const isOnline = user.status === 'online';
              return (
                <div key={user.id}
                  className="group relative bg-gradient-to-b from-[#0e1628] to-[#080d18] border border-white/5 hover:border-cyan-500/30 rounded-3xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(6,182,212,0.15)] overflow-hidden"
                >
                  {/* Card glow on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 group-hover:from-cyan-500/5 to-transparent transition-all duration-300 rounded-3xl pointer-events-none" />

                  {/* Online indicator pulse ring */}
                  {isOnline && (
                    <div className="absolute top-4 right-4 w-2.5 h-2.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </div>
                  )}

                  {/* Avatar */}
                  <div className="flex flex-col items-center mb-4">
                    <div className={`relative w-16 h-16 rounded-2xl border-2 ${isOnline ? 'border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'border-white/10'} bg-[#0c1525] overflow-hidden`}>
                      {(() => {
                        const lobbyAvatar = user.avatar || user.username;
                        const lobbyAvatarSrc = String(lobbyAvatar || "").startsWith("data:image") ? lobbyAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${lobbyAvatar || user.username}`;
                        return <img src={lobbyAvatarSrc} alt="avatar" className="w-full h-full" />;
                      })()}
                    </div>
                    <h3 className="text-white font-black text-[15px] font-mono mt-3 truncate max-w-full">{user.username}</h3>
                    <span className={`mt-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${roleStyle}`}>
                      {role}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    <span className={`text-[10px] font-mono uppercase tracking-widest ${isOnline ? 'text-emerald-400' : 'text-gray-600'}`}>{user.status}</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onChat(user.id)}
                      className="flex-1 py-2 bg-gradient-to-r from-cyan-500/10 to-violet-500/10 hover:from-cyan-500 hover:to-violet-600 text-cyan-400 hover:text-white border border-cyan-500/20 hover:border-transparent rounded-xl text-[11px] font-black font-mono transition-all tracking-widest uppercase"
                    >
                      💬 Message
                    </button>
                    <button
                      onClick={() => onCall(user, true)}
                      className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-emerald-500 text-gray-400 hover:text-white border border-white/10 hover:border-transparent rounded-xl transition-all"
                      title="Video Call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onCall(user, false)}
                      className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-cyan-500 text-gray-400 hover:text-white border border-white/10 hover:border-transparent rounded-xl transition-all"
                      title="Audio Call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatListItem({ name, lastMsg, time, active, onClick, isGlobal, status, hasUnread, avatar }: any) {
  const avatarUrl = String(avatar || "").startsWith("data:image") ? avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${avatar || name}`;
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${active ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-white/5 border border-transparent'} ${status === 'offline' ? 'opacity-50' : ''} ${hasUnread ? 'bg-white/5' : ''}`}>
      <div className="relative shrink-0">
        <div className={`w-12 h-12 rounded-full border border-white/10 p-[2px] ${isGlobal ? 'bg-emerald-500/20' : 'bg-[#050810]'}`}>
          <img src={avatarUrl} className="w-full h-full rounded-full" />
        </div>
        {!isGlobal && <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0b121f] ${status === 'online' ? 'bg-emerald-500' : 'bg-gray-600'}`}></div>}
        {hasUnread && !active && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#050810] animate-pulse"></div>}
      </div>
      <div className="flex-1 text-left overflow-hidden">
        <div className="flex justify-between items-center mb-1">
          <span className={`text-sm font-bold truncate ${active ? 'text-emerald-400' : 'text-white'} ${hasUnread ? 'text-emerald-400 font-black' : ''}`}>{name}</span>
          <span className={`text-[9px] font-mono ${status === 'online' ? 'text-emerald-500' : 'text-gray-500'}`}>{time}</span>
        </div>
        <p className={`text-[11px] truncate ${hasUnread ? 'text-emerald-500 font-bold' : 'text-gray-500'}`}>{hasUnread ? "NEW MESSAGE" : lastMsg}</p>
      </div>
    </button>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-4 p-3 rounded-xl transition-all ${active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>
      <div className="w-6 h-6">{icon}</div>
      <span className="hidden md:block text-sm font-medium">{label}</span>
    </button>
  )
}

function AdminPlaceholder({ stats }: { stats: any }) {
  return (
    <div className="p-10 w-full h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-6">System Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-[#0c1222] border border-white/5 rounded-2xl">
          <p className="text-gray-500 text-sm">Total Encrypted Messages</p>
          <motion.p key={stats.totalMessages} initial={{ scale: 1.2, color: '#10b981' }} animate={{ scale: 1, color: '#ffffff' }} className="text-4xl font-black mt-2">
            {stats.totalMessages.toLocaleString()}
          </motion.p>
        </div>
        <div className="p-6 bg-[#0c1222] border border-white/5 rounded-2xl">
          <p className="text-gray-500 text-sm">Active WebRTC Calls</p>
          <motion.p key={stats.activeCalls} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-4xl font-black text-emerald-400 mt-2">
            {stats.activeCalls}
          </motion.p>
        </div>
        <div className="p-6 bg-[#0c1222] border border-white/5 rounded-2xl">
          <p className="text-gray-500 text-sm">AI Interventions</p>
          <motion.p key={stats.aiInterventions} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-4xl font-black text-cyan-400 mt-2">
            {stats.aiInterventions}
          </motion.p>
        </div>
      </div>
    </div>
  )
}

function ProfilePage({ username, setUsername, avatarSeed, setAvatarSeed, about, setAbout, showLastSeen, setShowLastSeen, socket, onBack, stats }: any) {
  const [newUsername, setNewUsername] = useState(username);
  const [newSeed, setNewSeed] = useState(avatarSeed || username);
  const [newAbout, setNewAbout] = useState(about || "Active Neural Agent");
  const [newShowLastSeen, setNewShowLastSeen] = useState(showLastSeen !== false);
  const [status, setStatus] = useState("");
  const [activeSection, setActiveSection] = useState<'identity' | 'privacy' | 'stats'>('identity');

  const handleSave = () => {
    if (!newUsername.trim()) return;
    setUsername(newUsername);
    setAvatarSeed(newSeed);
    if (setAbout) setAbout(newAbout);
    if (setShowLastSeen) setShowLastSeen(newShowLastSeen);
    localStorage.setItem("aura_username", newUsername);
    socket.emit("update_profile", { username: newUsername, avatar: newSeed, about: newAbout, showLastSeen: newShowLastSeen });
    setStatus("✓ Profile Synchronized to Neural Grid.");
    setTimeout(() => setStatus(""), 3000);
  }

  return (
    <div className="p-4 md:p-8 w-full h-full overflow-y-auto bg-[#050810] flex flex-col items-center">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all border border-white/10">
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-black text-white">Edit Profile</h2>
            <p className="text-emerald-500 font-mono text-[10px] uppercase tracking-[0.3em]">Neural ID: {socket.id?.substring(0, 12)}</p>
          </div>
        </div>

        {/* DP Section — WhatsApp style large centered avatar */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="relative w-32 h-32 rounded-full cursor-pointer group"
            onClick={() => document.getElementById('dp-upload')?.click()}
          >
            <img
              src={newSeed?.startsWith('data:image') ? newSeed : `https://api.dicebear.com/7.x/bottts/svg?seed=${newSeed}`}
              alt="profile"
              className="w-full h-full rounded-full object-cover border-4 border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
              <span className="text-white text-xs font-bold uppercase tracking-wide">📷</span>
              <span className="text-white text-[10px] mt-1">Change</span>
            </div>
          </div>
          <input
            type="file"
            id="dp-upload"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const rawData = ev.target?.result as string;
                  const compressed = await compressImage(rawData, 128, 128, 0.7);
                  setNewSeed(compressed);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          <p className="mt-3 text-gray-400 text-xs font-mono">Tap avatar to upload photo from device</p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 border border-white/5">
          {(['identity', 'privacy', 'stats'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-widest transition-all ${activeSection === tab ? 'bg-emerald-500 text-[#050810]' : 'text-gray-400 hover:text-white'}`}
            >
              {tab === 'identity' ? '👤 Identity' : tab === 'privacy' ? '🔒 Privacy' : '📊 Stats'}
            </button>
          ))}
        </div>

        {/* IDENTITY TAB */}
        {activeSection === 'identity' && (
          <div className="space-y-5 p-6 bg-[#0c1222] border border-white/5 rounded-3xl">
            <div>
              <label className="text-[10px] text-gray-500 font-mono uppercase mb-2 block tracking-widest">Display Name</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-[#050810] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all font-mono text-sm"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-mono uppercase mb-2 block tracking-widest">About (Bio)</label>
              <textarea
                value={newAbout}
                onChange={(e) => setNewAbout(e.target.value)}
                rows={3}
                maxLength={140}
                className="w-full bg-[#050810] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all font-mono text-sm resize-none"
                placeholder="Hey there! I'm using AURA-OS..."
              />
              <p className="text-right text-gray-600 text-[10px] font-mono mt-1">{newAbout.length}/140</p>
            </div>

            {/* Quick About Suggestions */}
            <div>
              <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-2">Quick Status</p>
              <div className="flex flex-wrap gap-2">
                {["Available ✅", "Busy 🔴", "At school 📚", "At work 💼", "Gaming 🎮", "Sleeping 😴"].map(s => (
                  <button
                    key={s}
                    onClick={() => setNewAbout(s)}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-[10px] font-mono rounded-full hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleSave} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-[#050810] rounded-xl font-black text-sm transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest">
              Save Changes
            </button>
            {status && <p className="text-emerald-400 text-center text-xs font-mono animate-pulse">{status}</p>}

            <button
              onClick={() => { localStorage.removeItem("aura_username"); window.location.reload(); }}
              className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl font-bold text-xs transition-all uppercase tracking-widest"
            >
              Sign Out / De-authorize
            </button>
          </div>
        )}

        {/* PRIVACY TAB */}
        {activeSection === 'privacy' && (
          <div className="space-y-4 p-6 bg-[#0c1222] border border-white/5 rounded-3xl">
            <h4 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-500" /> Privacy Settings
            </h4>

            {/* Last Seen Toggle */}
            <div className="flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <p className="text-white text-sm font-semibold">Last Seen</p>
                <p className="text-gray-500 text-xs font-mono mt-0.5">Show others when you were last active</p>
              </div>
              <button
                onClick={() => setNewShowLastSeen(!newShowLastSeen)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${newShowLastSeen ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${newShowLastSeen ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* Read Receipts (display only) */}
            <div className="flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <p className="text-white text-sm font-semibold">Read Receipts</p>
                <p className="text-gray-500 text-xs font-mono mt-0.5">Show double-tick when messages are read</p>
              </div>
              <span className="text-emerald-400 text-xs font-mono font-bold">ALWAYS ON</span>
            </div>

            {/* Message auto-save note */}
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-white text-sm font-semibold">Message Persistence</p>
                <p className="text-gray-500 text-xs font-mono mt-0.5">Messages are stored securely on the server</p>
              </div>
              <span className="text-cyan-400 text-xs font-mono font-bold">ENCRYPTED</span>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-4 mt-2 bg-cyan-500 hover:bg-cyan-400 text-[#050810] rounded-xl font-black text-sm transition-all shadow-lg shadow-cyan-500/20 uppercase tracking-widest"
            >
              Save Privacy Settings
            </button>
            {status && <p className="text-emerald-400 text-center text-xs font-mono animate-pulse">{status}</p>}
          </div>
        )}

        {/* STATS TAB */}
        {activeSection === 'stats' && (
          <div className="space-y-4 p-6 bg-[#0c1222] border border-white/5 rounded-3xl">
            <h4 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-emerald-500" /> Activity Analytics
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#050810] rounded-2xl border border-white/5">
                <p className="text-gray-500 text-[10px] uppercase font-mono">Messages Sent</p>
                <p className="text-3xl font-black text-white mt-1">{stats?.totalMessages || 0}</p>
              </div>
              <div className="p-4 bg-[#050810] rounded-2xl border border-white/5">
                <p className="text-gray-500 text-[10px] uppercase font-mono">System Uptime</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">99.9%</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-[#050810] rounded-2xl border border-white/5 font-mono text-[11px] space-y-3">
              <div className="flex justify-between text-gray-400"><span>Encryption:</span><span className="text-cyan-400">AES-256-GCM</span></div>
              <div className="flex justify-between text-gray-400"><span>Tunnel Status:</span><span className="text-emerald-400 font-bold">SECURED</span></div>
              <div className="flex justify-between text-gray-400"><span>Node:</span><span>Shadow-Server [v3.1]</span></div>
              <div className="flex justify-between text-gray-400"><span>Socket ID:</span><span className="text-purple-400">{socket.id?.substring(0, 14)}</span></div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function AiVoiceCallInterface({ activeCall, onEnd, socket }: any) {
  const [status, setStatus] = useState("Establishing Neural Voice Link...");
  const [transcript, setTranscript] = useState("");
  const [aiResponseText, setAiResponseText] = useState("");
  const [isSpeakingUI, setIsSpeakingUI] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [customTalkInput, setCustomTalkInput] = useState("");

  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const aiMessageRef = useRef("");
  const listeningRef = useRef(false);

  // Call duration counter
  useEffect(() => {
    const timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Helper: wait for voices to be available then speak
  const speakWithVoice = (text: string, onDone?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onDone && onDone();
      return;
    }
    const doSpeak = () => {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const premiumVoice =
        voices.find(v => (v.name.includes("Google") || v.name.includes("Natural")) && v.lang.startsWith("en")) ||
        voices.find(v => v.lang.startsWith("en-US")) ||
        voices.find(v => v.lang.startsWith("en")) ||
        voices[0];
      if (premiumVoice) speech.voice = premiumVoice;
      speech.rate = 1.05;
      speech.pitch = 1.05;
      speech.volume = 1.0;
      speech.onend = () => { onDone && onDone(); };
      speech.onerror = () => { onDone && onDone(); };
      window.speechSynthesis.speak(speech);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
      setTimeout(() => {
        if (!window.speechSynthesis.speaking) doSpeak();
      }, 400);
    }
  };

  const startListening = () => {
    if (isSpeakingRef.current || listeningRef.current || isMicMuted) return;
    try {
      recognitionRef.current?.start();
      listeningRef.current = true;
      setIsListening(true);
    } catch (e) { }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.abort();
      listeningRef.current = false;
      setIsListening(false);
    } catch (e) { }
  };

  const sendTalkMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;
    setTranscript(textToSend);
    setStatus("AI is processing neural thoughts...");
    isSpeakingRef.current = true;
    setIsSpeakingUI(true);
    stopListening();
    socket?.emit("send_message", { targetId: activeCall.userId, text: textToSend, isEncrypted: false });
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        listeningRef.current = true;
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        listeningRef.current = false;
        setIsListening(false);
        const text = event.results[0][0].transcript;
        sendTalkMessage(text);
      };

      rec.onend = () => {
        listeningRef.current = false;
        setIsListening(false);
        if (!isSpeakingRef.current && !isMicMuted) {
          setTimeout(() => startListening(), 400);
        }
      };

      rec.onerror = (e: any) => {
        listeningRef.current = false;
        setIsListening(false);
        if (!isSpeakingRef.current && !isMicMuted) {
          setTimeout(() => startListening(), 1000);
        }
      };

      recognitionRef.current = rec;
    }

    // Initial greeting
    const greetingText = `Neural connection secured with ${activeCall.username}. I am online and listening. What would you like to discuss?`;
    const t1 = setTimeout(() => {
      setStatus("Neural Line Active · Speaking");
      setIsSpeakingUI(true);
      isSpeakingRef.current = true;
      setAiResponseText(greetingText);
      speakWithVoice(greetingText, () => {
        isSpeakingRef.current = false;
        setIsSpeakingUI(false);
        setStatus("Listening to your voice...");
        startListening();
      });
    }, 800);

    const handleStreamStart = (msg: any) => {
      if (msg.senderId === activeCall.userId || msg.senderUsername === activeCall.userId) {
        aiMessageRef.current = "";
        setStatus("AI is generating voice...");
        isSpeakingRef.current = true;
        setIsSpeakingUI(true);
        stopListening();
      }
    };

    const handleStreamChunk = (msg: any) => {
      if (msg.senderId === activeCall.userId || msg.senderUsername === activeCall.userId) {
        aiMessageRef.current += msg.text;
      }
    };

    const handleStreamEnd = (msg: any) => {
      const fullText = aiMessageRef.current || (msg && msg.text) || "";
      if (fullText) {
        setAiResponseText(fullText);
        setStatus(`${activeCall.username} is speaking...`);
        speakWithVoice(fullText, () => {
          isSpeakingRef.current = false;
          setIsSpeakingUI(false);
          setStatus("Listening to your voice...");
          setTimeout(() => startListening(), 400);
        });
      } else {
        isSpeakingRef.current = false;
        setIsSpeakingUI(false);
        setStatus("Listening to your voice...");
        setTimeout(() => startListening(), 400);
      }
    };

    const handleReceiveMsg = (msg: any) => {
      if ((msg.senderId === activeCall.userId || msg.senderUsername === activeCall.userId) && !msg.isStreaming) {
        aiMessageRef.current = msg.text || "";
        handleStreamEnd(msg);
      }
    };

    socket?.on("stream_start", handleStreamStart);
    socket?.on("stream_chunk", handleStreamChunk);
    socket?.on("stream_end", handleStreamEnd);
    socket?.on("receive_message", handleReceiveMsg);

    return () => {
      clearTimeout(t1);
      if (typeof window !== 'undefined' && ('speechSynthesis' in window)) {
        window.speechSynthesis.cancel();
      }
      isSpeakingRef.current = false;
      listeningRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        try { recognitionRef.current.abort(); } catch (e) { }
      }
      socket?.off("stream_start", handleStreamStart);
      socket?.off("stream_chunk", handleStreamChunk);
      socket?.off("stream_end", handleStreamEnd);
      socket?.off("receive_message", handleReceiveMsg);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMicMuted]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[#060a14]/98 backdrop-blur-2xl z-50 flex flex-col items-center justify-between p-6 sm:p-10 select-none">
      {/* Top Header */}
      <div className="w-full max-w-lg flex flex-col items-center gap-2 pt-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] uppercase tracking-wider">
          <Cpu className="w-3.5 h-3.5 animate-pulse" />
          <span>NEURAL AI VOICE CHANNEL · {formatTime(callDuration)}</span>
        </div>
        <p className="text-gray-400 font-mono text-xs">{status}</p>
      </div>

      {/* Middle: Avatar & Neural Waveform */}
      <div className="flex flex-col items-center justify-center my-auto w-full max-w-md text-center">
        <div className="relative mb-6">
          <div className={`absolute -inset-6 rounded-full bg-cyan-500/15 blur-xl transition-all duration-500 ${isSpeakingUI ? 'scale-150 opacity-100' : 'scale-100 opacity-40'}`} />
          <div className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-cyan-400/80 overflow-hidden bg-[#0c1424] shadow-[0_0_50px_rgba(6,182,212,0.4)] relative z-10 flex items-center justify-center transition-transform ${isSpeakingUI ? 'scale-105' : 'scale-100'}`}>
            <img
              src={activeCall.avatarSrc || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeCall.username}`}
              alt="AI Avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase font-mono mb-1">{activeCall.username}</h2>
        <span className="text-[11px] text-cyan-400 font-mono uppercase tracking-widest mb-4">Neural Agent V3.0</span>

        {/* Animated Soundwave */}
        <div className="flex items-center justify-center gap-1.5 h-12 mb-4">
          {[40, 75, 100, 60, 90, 45, 80, 50, 95, 30].map((h, i) => (
            <motion.div
              key={i}
              animate={{ height: isSpeakingUI ? [12, h, 12] : isListening ? [6, 25, 6] : 6 }}
              transition={{ repeat: Infinity, duration: 0.8 + (i * 0.08), ease: "easeInOut" }}
              className={`w-1.5 rounded-full ${isSpeakingUI ? 'bg-gradient-to-t from-cyan-500 to-emerald-400' : isListening ? 'bg-emerald-400' : 'bg-gray-600'}`}
            />
          ))}
        </div>

        {/* Speech Transcript or AI Response Box */}
        {aiResponseText && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-sans text-gray-200 leading-relaxed max-w-sm mb-3 shadow-inner max-h-24 overflow-y-auto">
            "{aiResponseText}"
          </div>
        )}

        {transcript && (
          <p className="text-emerald-400 font-mono text-xs italic tracking-wide max-w-sm truncate">
            You: "{transcript}"
          </p>
        )}

        {/* Quick Voice Prompt Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 max-w-sm">
          {["Hello! How are you?", "Let's play Ludo 🎲", "Who built you?", "Tell me a joke 🤖"].map((chip) => (
            <button
              key={chip}
              onClick={() => sendTalkMessage(chip)}
              className="px-3 py-1 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/40 rounded-full text-[11px] font-mono text-gray-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-md pb-6 flex flex-col items-center gap-4">
        {/* Quick Speech input for instant vocal reply */}
        <div className="w-full flex items-center bg-black/40 border border-white/10 rounded-full px-3 py-1.5 focus-within:border-cyan-500/60 transition-all">
          <input
            type="text"
            value={customTalkInput}
            onChange={(e) => setCustomTalkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customTalkInput.trim()) {
                sendTalkMessage(customTalkInput.trim());
                setCustomTalkInput("");
              }
            }}
            placeholder={`Say or type to ${activeCall.username}...`}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 font-mono text-xs px-2"
          />
          <button
            onClick={() => {
              if (customTalkInput.trim()) {
                sendTalkMessage(customTalkInput.trim());
                setCustomTalkInput("");
              }
            }}
            disabled={!customTalkInput.trim()}
            className="p-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 rounded-full text-black transition-all"
            title="Send voice prompt"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-6">
          {/* Mic Toggle Button */}
          <button
            onClick={() => {
              const next = !isMicMuted;
              setIsMicMuted(next);
              if (next) stopListening();
              else startListening();
            }}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isMicMuted
                ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                : isListening
                ? 'bg-emerald-500/30 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-pulse'
                : 'bg-white/10 border border-white/15 text-white hover:bg-white/20'
            }`}
            title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={onEnd}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_35px_rgba(239,68,68,0.6)] hover:scale-105 active:scale-95 transition-all"
            title="End AI Call"
          >
            <Phone className="w-8 h-8 rotate-[135deg]" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function MultiplayerChat({ socket, username, onlineCount, targetId, targetName, typingStatus, setUnreadMap, setLastMessageMap, selectedChatId, onlineUsers, onCall, onBack, nicknames, onNicknameChange, archivedChats, toggleArchiveChat, deleteChat, isVirtualDm, onCollectPayment, virtualDmOpening, autoStartLudoLobby, onDeployToGrid, avatarCache, onSelectReceipt }: any) {
  // Helper: resolve avatar src using cache (keyed by username) with fallback
  const getAvatarSrcLocal = (uname: string, fallback?: string): string => {
    const av = (avatarCache && avatarCache[uname]) || fallback || uname || 'default';
    return String(av).startsWith('data:image') ? av : `https://api.dicebear.com/7.x/bottts/svg?seed=${av}`;
  };
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<number | null>(null);
  const [dmPhase, setDmPhase] = useState<'question' | 'waiting' | 'confirmed' | 'paid'>('question');
  const [ludoLobby, setLudoLobby] = useState<{ roomId: string; players: string[]; ready: number } | null>(null);
  const [ludoLaunching, setLudoLaunching] = useState(false);
  const [virtualTyping, setVirtualTyping] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payModalAmount, setPayModalAmount] = useState(500);
  const [payModalNote, setPayModalNote] = useState('');

  const sendPaymentSlip = () => {
    if (!payModalAmount) return;
    const txId = `TXN${Date.now().toString().slice(-8).toUpperCase()}`;
    const slipMsg: any = {
      id: `slip_${Date.now()}`,
      sender: username,
      senderName: username,
      senderId: 'self',
      isPaymentSlip: true,
      slipData: {
        amount: payModalAmount,
        from: username,
        to: targetName,
        note: payModalNote || 'Payment for consultation',
        txId,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      isEncrypted: false,
    };
    setMessages((prev: any) => [...prev, slipMsg]);
    if (isVirtualDm) {
      setTimeout(() => {
        const ackMsg: any = {
          id: `ack_${Date.now()}`,
          sender: targetName,
          senderName: targetName,
          text: `✅ Payment of ${payModalAmount} LKR received and confirmed! Slip saved. Thank you so much 🙏`,
          timestamp: new Date(),
          isEncrypted: false,
        };
        setMessages((prev: any) => [...prev, ackMsg]);
      }, 2000);
    } else {
      socket?.emit('send_message', {
        text: `💸 [PAYMENT SLIP] ${payModalAmount} LKR → ${targetName} | TxID: ${txId} | ${payModalNote || 'Payment for consultation'}`,
        targetId,
        isEncrypted: false,
      });
    }
    setShowPayModal(false);
    setPayModalNote('');
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<{ id: string; msg: any; x: number; y: number; isOwn: boolean } | null>(null);
  const [deletedForMeIds, setDeletedForMeIds] = useState<string[]>([]);
  const [undoSnackbar, setUndoSnackbar] = useState<{ messageId: string; message: any; countdown: number } | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isTargetTyping = typingStatus && (
    (!targetId && typingStatus.toLowerCase().includes("aura-os")) ||
    (targetId && targetName && typingStatus.toLowerCase().includes(targetName.toLowerCase()))
  );

  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(0.4);
  const [wallpaperBrightness, setWallpaperBrightness] = useState<number>(60);
  const [wallpaperContrast, setWallpaperContrast] = useState<number>(100);
  const [chatTheme, setChatTheme] = useState<string>("emerald");
  const [chatWallpaper, setChatWallpaper] = useState<string>("cubes");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const keySuffix = `${username}_${targetName || targetId || 'global'}`;

      const themeVal = localStorage.getItem(`chat_theme_${username}`);
      setChatTheme(themeVal || "emerald");

      const wpVal = localStorage.getItem(`chat_wallpaper_${keySuffix}`);
      setChatWallpaper(wpVal || "cubes");

      const savedOpacity = localStorage.getItem(`chat_wallpaper_opacity_${keySuffix}`);
      setWallpaperOpacity(savedOpacity ? parseFloat(savedOpacity) : 0.4);

      const savedBrightness = localStorage.getItem(`chat_wallpaper_brightness_${keySuffix}`);
      setWallpaperBrightness(savedBrightness ? parseInt(savedBrightness) : 60);

      const savedContrast = localStorage.getItem(`chat_wallpaper_contrast_${keySuffix}`);
      setWallpaperContrast(savedContrast ? parseInt(savedContrast) : 100);
    }
  }, [username, targetId, targetName]);

  const handleWallpaperUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) {
          setChatWallpaper(result);
          localStorage.setItem(`chat_wallpaper_${username}_${targetName || targetId || 'global'}`, result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [customNickname, setCustomNickname] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`nickname_${username}_${targetId || 'global'}`) || "";
    }
    return "";
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const [customWallpaperUrl, setCustomWallpaperUrl] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`nickname_${username}_${targetId || 'global'}`) || "";
      setCustomNickname(saved);
      setTempName(saved || targetName);
    } else {
      setCustomNickname("");
      setTempName(targetName);
    }
  }, [targetId, targetName]);

  const currentDisplayName = customNickname || targetName;

  const THEMES: Record<string, {
    primary: string,
    text: string,
    hoverText: string,
    border: string,
    borderFocus: string,
    bubble: string,
    glow: string,
    scrollbar: string
  }> = {
    emerald: {
      primary: 'bg-emerald-500 hover:bg-emerald-400 text-black',
      text: 'text-emerald-400',
      hoverText: 'hover:text-emerald-400',
      border: 'border-emerald-500/30',
      borderFocus: 'focus-within:border-emerald-500/50',
      bubble: 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)] shadow-emerald-500/20',
      scrollbar: 'scrollbar-thin scrollbar-thumb-emerald-900/50'
    },
    purple: {
      primary: 'bg-purple-600 hover:bg-purple-500 text-white',
      text: 'text-purple-400',
      hoverText: 'hover:text-purple-400',
      border: 'border-purple-500/30',
      borderFocus: 'focus-within:border-purple-500/50',
      bubble: 'bg-purple-600 text-white rounded-2xl rounded-tr-sm',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)] shadow-purple-500/20',
      scrollbar: 'scrollbar-thin scrollbar-thumb-purple-900/50'
    },
    cyan: {
      primary: 'bg-cyan-500 hover:bg-cyan-400 text-black font-bold',
      text: 'text-cyan-400',
      hoverText: 'hover:text-cyan-400',
      border: 'border-cyan-500/30',
      borderFocus: 'focus-within:border-cyan-500/50',
      bubble: 'bg-cyan-600 text-white rounded-2xl rounded-tr-sm',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)] shadow-cyan-500/20',
      scrollbar: 'scrollbar-thin scrollbar-thumb-cyan-900/50'
    },
    amber: {
      primary: 'bg-amber-500 hover:bg-amber-400 text-black font-bold',
      text: 'text-amber-400',
      hoverText: 'hover:text-amber-400',
      border: 'border-amber-500/30',
      borderFocus: 'focus-within:border-amber-500/50',
      bubble: 'bg-amber-500 text-black rounded-2xl rounded-tr-sm',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)] shadow-amber-500/20',
      scrollbar: 'scrollbar-thin scrollbar-thumb-amber-900/50'
    },
    rose: {
      primary: 'bg-rose-600 hover:bg-rose-500 text-white',
      text: 'text-rose-400',
      hoverText: 'hover:text-rose-400',
      border: 'border-rose-500/30',
      borderFocus: 'focus-within:border-rose-500/50',
      bubble: 'bg-rose-600 text-white rounded-2xl rounded-tr-sm',
      glow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)] shadow-rose-500/20',
      scrollbar: 'scrollbar-thin scrollbar-thumb-rose-900/50'
    }
  };

  const WALLPAPERS: Record<string, string> = {
    cubes: "https://www.transparenttextures.com/patterns/cubes.png",
    circuit: "https://www.transparenttextures.com/patterns/circuit-board.png",
    carbon: "https://www.transparenttextures.com/patterns/carbon-fibre.png",
    stars: "https://www.transparenttextures.com/patterns/black-thread-light.png"
  };

  // Filter messages based on the active conversation
  const activeMessages = messages.filter(msg => {
    if (!targetName && !targetId) {
      // Global chat messages have no targetId/targetUsername
      return !msg.targetId && !msg.targetUsername;
    }
    // For agents (bots)
    if (targetId && targetId.startsWith("agent_")) {
      return msg.senderId === targetId || msg.targetId === targetId || msg.senderUsername === targetId || msg.targetUsername === targetId;
    }
    // For normal users, match by username
    const currentTargetName = targetName || (targetId ? onlineUsers.find((u: any) => u.id === targetId)?.username : null);
    if (!currentTargetName) return false;
    return (
      (msg.senderUsername === currentTargetName && (msg.targetUsername === username || msg.slipData?.to === username)) ||
      (msg.senderUsername === username && (msg.targetUsername === currentTargetName || msg.slipData?.to === currentTargetName)) ||
      (msg.slipData && ((msg.slipData.from === currentTargetName && msg.slipData.to === username) || (msg.slipData.from === username && msg.slipData.to === currentTargetName)))
    );
  });

  const visibleMessages = activeMessages.filter(msg => !deletedForMeIds.includes(msg.id));

  // 4-second Countdown timer for Undo Delete For Me
  useEffect(() => {
    if (!undoSnackbar) return;
    const interval = setInterval(() => {
      setUndoSnackbar(prev => {
        if (!prev) return null;
        if (prev.countdown <= 1) {
          clearInterval(interval);
          return null;
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [undoSnackbar]);

  const handleToggleReaction = (msg: any, emoji: string) => {
    const msgIdStr = String(msg.id);
    // 1. Immediate optimistic UI update
    setMessages(prev => prev.map(m => {
      if (String(m.id) === msgIdStr) {
        const currentReactions = { ...(m.reactions || {}) };
        if (currentReactions[username] === emoji) {
          delete currentReactions[username];
        } else {
          currentReactions[username] = emoji;
        }
        return { ...m, reactions: currentReactions };
      }
      return m;
    }));
    // 2. Broadcast to other accounts in real-time
    socket?.emit("toggle_reaction", { messageId: msg.id, emoji, username });
  };

  const handleDeleteForMe = (msg: any) => {
    setDeletedForMeIds(prev => [...prev, msg.id]);
    setUndoSnackbar({ messageId: msg.id, message: msg, countdown: 4 });
  };

  const handleDeleteForEveryone = (msg: any) => {
    socket?.emit("delete_message", { messageId: msg.id, forEveryone: true });
    setMessages(prev => prev.filter(m => m.id !== msg.id));
  };

  const scrollToMessage = (msgId: string) => {
    if (!msgId) return;
    const el = messageRefs.current.get(String(msgId));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMsgId(String(msgId));
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try { window.navigator.vibrate([50, 70, 50]); } catch(e) {}
      }
      setTimeout(() => {
        setHighlightedMsgId(null);
      }, 2000);
    }
  };

  // Mobile Touch & Hold (Long-Press) for reactions and options
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent, msg: any) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try { window.navigator.vibrate(40); } catch(err) {}
      }
      const isOwn = msg.senderName === username;
      setActiveMessageMenu({
        id: msg.id,
        msg: msg,
        x: touch.clientX,
        y: touch.clientY + 10,
        isOwn
      });
      touchTimerRef.current = null;
    }, 380); // 380ms touch & hold
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    // If user moves finger more than 8px, cancel long-press (user is scrolling)
    if (dx > 8 || dy > 8) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  useEffect(() => {
    if (!socket) return;

    socket.emit("get_history", { targetId, targetUsername: targetName });

    socket.on("chat_history", (data: any) => {
      if (data.targetId === targetId) {
        setMessages(data.messages.map((m: any, i: number) => {
          let dec = m.text;
          if (m.isEncrypted && !m.isImage && !m.isVideo && m.text) {
            try {
              const bytes = CryptoJS.AES.decrypt(m.text, SECRET_KEY);
              const val = bytes.toString(CryptoJS.enc.Utf8);
              if (val) dec = val;
            } catch (e) { }
          }
          return {
            ...m,
            id: m.id || `hist_${Date.now()}_${i}`,
            timestamp: new Date(m.timestamp),
            text: dec
          }
        }));
      }
    });

    socket.on("receive_message", (msg: any) => {
      let decryptedText = msg.text;
      if (msg.isEncrypted && !msg.isImage && !msg.isVideo) {
        try {
          const bytes = CryptoJS.AES.decrypt(msg.text, SECRET_KEY);
          const dec = bytes.toString(CryptoJS.enc.Utf8);
          if (dec) decryptedText = dec;
        } catch (err) {
          decryptedText = "[ENCRYPTED CONTENT UNREADABLE]";
        }
      }

      // Handle Unread and Sorting logic - use senderUsername (stable) as key
      const senderUname = msg.senderUsername || msg.senderName;
      if (msg.senderId && msg.senderId !== socket.id && senderUname) {
        // Key by username for stability across reconnects
        setLastMessageMap((p: any) => ({
          ...p,
          [senderUname]: Date.now(),
          [`text_${senderUname}`]: decryptedText
        }));
        // Determine if this sender is the currently open chat
        const targetUserObj = onlineUsers.find((u: any) => u.id === targetId);
        const targetUname = targetUserObj?.username || targetId;
        const isCurrentSender = senderUname === targetUname || msg.senderId === targetId;
        if (!isCurrentSender) {
          // Key unread by both id and username for maximum compatibility
          setUnreadMap((p: any) => ({ ...p, [msg.senderId]: true, [senderUname]: true }));
        }
      }

      setMessages(p => [...p, {
        ...msg,
        id: msg.id || `msg_${Date.now()}_${Math.random()}`,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        text: decryptedText
      }]);
    });

    socket.on("stream_start", (data: any) => {
      // Also update sorting/unread for streaming agents - use senderUsername as key
      const senderUname = data.senderName || data.senderId;
      if (data.senderId && senderUname) {
        setLastMessageMap((p: any) => ({ ...p, [senderUname]: Date.now() }));
        const targetUserObj = onlineUsers.find((u: any) => u.id === targetId);
        const targetUname = targetUserObj?.username || targetId;
        if (senderUname !== targetUname && data.senderId !== targetId) {
          setUnreadMap((p: any) => ({ ...p, [data.senderId]: true, [senderUname]: true }));
        }
      }

      setMessages(p => [...p, {
        id: data.messageId || `ai_${Date.now()}`,
        senderName: data.senderName,
        senderId: data.senderId,
        targetId: data.targetId,
        text: "",
        timestamp: new Date(),
        isUser: data.isUser,
        isStreaming: true
      }]);
    });
    socket.on("stream_chunk", (data: any) => {
      setMessages(p => p.map(m => m.id === data.messageId ? { ...m, text: m.text + data.text } : m));
    });
    socket.on("stream_end", (data: any) => {
      setMessages(p => p.map(m => m.id === data.messageId ? { ...m, isStreaming: false } : m));
    });

    socket.on("message_status_update", (data: any) => {
      const { status, senderId: msgSenderId } = data;
      // If this update is for messages we sent to targetId, update them all
      setMessages(prev => prev.map(m =>
        m.senderName === username && m.targetId === data.targetId
          ? { ...m, status }
          : m
      ));
    });

    socket.on("message_updated", (updatedMsg: any) => {
      setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });

    return () => {
      socket.off("chat_history");
      socket.off("receive_message"); socket.off("system_broadcast");
      socket.off("stream_start"); socket.off("stream_chunk"); socket.off("stream_end");
      socket.off("message_status_update");
      socket.off("message_updated");
    };
  }, [socket, targetId, username]);

  // ── Dedicated always-live effect for reactions + deletes (fixes real-time reaction sync) ──
  useEffect(() => {
    if (!socket) return;

    const onDeleted = (data: any) => {
      setMessages(p => p.filter(m => String(m.id) !== String(data.messageId)));
    };

    const onReactionUpdated = (data: any) => {
      if (!data || !data.messageId) return;
      setMessages(p => p.map(m => {
        if (String(m.id) === String(data.messageId)) {
          let nextReactions: Record<string, string> = {};
          if (data.reactions && typeof data.reactions === 'object') {
            nextReactions = { ...data.reactions };
          } else {
            nextReactions = { ...(m.reactions || {}) };
            if (data.username && data.emoji) {
              if (nextReactions[data.username] === data.emoji) {
                delete nextReactions[data.username];
              } else {
                nextReactions[data.username] = data.emoji;
              }
            }
          }
          return { ...m, reactions: { ...nextReactions } };
        }
        return m;
      }));
    };

    socket.on("message_deleted", onDeleted);
    socket.on("message_reaction_updated", onReactionUpdated);

    return () => {
      socket.off("message_deleted", onDeleted);
      socket.off("message_reaction_updated", onReactionUpdated);
    };
  }, [socket]);

  // Emit mark_read whenever we open or switch to a DM
  useEffect(() => {
    if (socket && targetId && !targetId.startsWith("agent_")) {
      socket.emit("mark_read", { senderId: targetId });
    }
  }, [socket, targetId]);

  // Scroll to bottom ONLY when opening or switching to a chat conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [targetId]);

  // Auto-start Ludo lobby when invited from community
  useEffect(() => {
    if (!autoStartLudoLobby) return;
    const roomId = `AURA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const slots = [username, '⏳ Waiting...', '⏳ Waiting...', '⏳ Waiting...'];
    setLudoLobby({ roomId, players: [...slots], ready: 1 });
    const fakeNames = ['NeuralNinja', 'Pixel_Surge', 'CodeDrake'];
    fakeNames.forEach((name, i) => {
      setTimeout(() => {
        setLudoLobby(prev => {
          if (!prev) return prev;
          const p = [...prev.players];
          p[i + 1] = name;
          return { ...prev, players: p, ready: i + 2 };
        });
      }, (i + 1) * 3000);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartLudoLobby, targetId]);

  // Inject virtual DM opening question on mount
  useEffect(() => {
    if (isVirtualDm && virtualDmOpening) {
      setTimeout(() => {
        setMessages(prev => {
          if (prev.some(m => m.id === 'virtual_opening')) return prev;
          return [{
            id: 'virtual_opening',
            sender: targetName,
            text: virtualDmOpening,
            timestamp: new Date(),
            isEncrypted: false,
          } as any, ...prev];
        });
      }, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVirtualDm, targetId]);

  const handleSend = () => {
    if (!input.trim()) return;

    if (isVirtualDm) {
      // Add user's message locally (no socket needed for virtual user)
      const userMsg = {
        id: `vm_user_${Date.now()}`,
        sender: username,
        senderName: username,
        text: input,
        timestamp: new Date(),
        isEncrypted: false,
        replyToId: replyingTo ? replyingTo.id : null,
        replyToSender: replyingTo ? replyingTo.senderName || replyingTo.sender : null,
        replyToText: replyingTo ? replyingTo.text : null,
        replyToIsImage: replyingTo ? (!!replyingTo.isImage || (typeof replyingTo.text === 'string' && (replyingTo.text.startsWith('data:image') || (replyingTo.text.startsWith('http') && !replyingTo.isVideo)))) : false,
      };
      setMessages(prev => [...prev, userMsg as any]);
      setInput('');
      setShowEmoji(false);
      setReplyingTo(null);

      // After first user reply, trigger the satisfied confirmation flow
      if (dmPhase === 'question') {
        setDmPhase('waiting');
        setVirtualTyping(true);
        const delay = 4000 + Math.random() * 2000;
        setTimeout(() => {
          setVirtualTyping(false);
          const confirmReplies = [
            `That's exactly what I needed! You cleared my doubt completely 🙌 Thank you so much! Let me send you payment now.`,
            `Wow, that actually makes perfect sense now! I was stuck on this for hours 😂 You really know your stuff. Ready to pay!`,
            `Brilliant explanation! I fully understand now ✅ You deserve the payment. Sending now!`,
            `That solved it! Amazing help, genuinely satisfied 🔥 Processing your payment.`,
          ];
          const confirm = confirmReplies[Math.floor(Math.random() * confirmReplies.length)];
          const confirmMsg = {
            id: `vm_confirm_${Date.now()}`,
            sender: targetName,
            text: confirm,
            timestamp: new Date(),
            isEncrypted: false,
          };
          setMessages(prev => [...prev, confirmMsg as any]);
          setDmPhase('confirmed');
        }, delay);
      }
      return;
    }

    if (!socket) return;
    const encryptedText = CryptoJS.AES.encrypt(input, SECRET_KEY).toString();
    const payload: any = {
      text: encryptedText,
      decryptedTextForAi: input,
      targetId: targetId
    };
    if (replyingTo) {
      payload.replyToId = replyingTo.id;
      payload.replyToSender = replyingTo.senderName || replyingTo.sender;
      payload.replyToText = replyingTo.text;
      payload.replyToIsImage = !!replyingTo.isImage || (typeof replyingTo.text === 'string' && (replyingTo.text.startsWith('data:image') || (replyingTo.text.startsWith('http') && !replyingTo.isVideo)));
    }
    socket.emit("send_message", payload);
    setInput("");
    setShowEmoji(false);
    setReplyingTo(null);
  };

  const handleMediaUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isImage && !isVideo) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        let result = ev.target?.result as string;
        if (isImage) {
          result = await compressImage(result, 600, 600, 0.6);
        }
        const mediaPayload: any = { text: result, targetId: targetId, isImage: isImage, isVideo: isVideo, isEncrypted: false };
        if (replyingTo) {
          mediaPayload.replyToId = replyingTo.id;
          mediaPayload.replyToSender = replyingTo.senderName || replyingTo.sender;
          mediaPayload.replyToText = replyingTo.text;
          mediaPayload.replyToIsImage = !!replyingTo.isImage || (typeof replyingTo.text === 'string' && (replyingTo.text.startsWith('data:image') || (replyingTo.text.startsWith('http') && !replyingTo.isVideo)));
          setReplyingTo(null);
        }
        socket.emit("send_message", mediaPayload);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      {/* WhatsApp/Discord Style Header */}
      <header className="h-20 flex items-center justify-between px-6 border-b border-white/5 bg-[#090d16] shrink-0 z-20">
        <div className="flex items-center gap-4 cursor-pointer hover:opacity-90 select-none group" onClick={() => setShowProfileDrawer(!showProfileDrawer)}>
          {onBack && (
            <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="relative">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${THEMES[chatTheme].border} overflow-hidden ${!targetId ? 'bg-emerald-500/20' : 'bg-[#050810]'} group-hover:scale-105 transition-transform duration-300`}>
              {(() => {
                // Use avatarCache (keyed by username) for reliable lookup even when user reconnects
                const activeAvatarSrc = getAvatarSrcLocal(targetName, onlineUsers.find((u: any) => u.id === targetId || u.username === targetName)?.avatar);
                return <img src={activeAvatarSrc} className="w-10 h-10 object-cover rounded-full" />;
              })()}
            </div>
            {!targetId && <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#090d16] animate-pulse ${chatTheme === 'emerald' ? 'bg-emerald-500' : chatTheme === 'purple' ? 'bg-purple-500' : chatTheme === 'cyan' ? 'bg-cyan-500' : chatTheme === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`}></div>}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2 group-hover:text-emerald-400 transition-colors">
              {currentDisplayName}
              <Info className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all text-gray-500" />
            </h1>
            <p className={`text-[10px] font-mono flex items-center gap-1 uppercase tracking-tighter ${THEMES[chatTheme].text}`}>
              {typingStatus ? (
                <span className="animate-pulse">{typingStatus}</span>
              ) : (() => {
                if (!targetId) {
                  return <><ShieldCheck className="w-3 h-3" />{`${onlineCount} AGENTS ONLINE`}</>;
                }
                const targetUser = onlineUsers.find((u: any) => u.id === targetId);
                if (targetUser && targetUser.status !== 'offline') {
                  return <><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />Online</>
                }
                // Offline — show last seen
                const ls = targetUser?.lastSeen || (onlineUsers as any[]).find?.((u: any) => u.id === targetId)?.lastSeen;
                if (ls) {
                  const lsDate = new Date(ls);
                  const now = new Date();
                  const diffMs = now.getTime() - lsDate.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  let lsText = '';
                  if (diffMins < 1) lsText = 'Last seen just now';
                  else if (diffMins < 60) lsText = `Last seen ${diffMins}m ago`;
                  else if (diffMins < 1440) lsText = `Last seen ${Math.floor(diffMins / 60)}h ago`;
                  else lsText = `Last seen ${lsDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
                  return <><span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /><span className="text-gray-500 normal-case">{lsText}</span></>;
                }
                return <><ShieldCheck className="w-3 h-3" />Secure Peer Tunnel • Contact Info</>;
              })()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 relative">
          {/* WhatsApp Style Calendar Date Jump */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDatePicker(p => !p)}
              className={`w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-emerald-400 transition-all ${showDatePicker ? 'text-emerald-400 bg-white/5 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}
              title="Jump to date in messages"
            >
              <CalendarDays className="w-5 h-5" />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-12 w-72 bg-[#0c1322]/95 border border-white/10 rounded-2xl p-4 shadow-[0_15px_40px_rgba(0,0,0,0.85)] backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150 font-sans text-xs">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
                  <span className="font-bold text-white font-mono uppercase text-[11px] flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-emerald-400" /> Jump To Date
                  </span>
                  <button onClick={() => setShowDatePicker(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Select Calendar Date:
                </p>
                <input
                  type="date"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    const targetMsg = visibleMessages.find(msg => {
                      const msgDate = new Date(msg.timestamp || Date.now());
                      return msgDate.getFullYear() === y && (msgDate.getMonth() + 1) === m && msgDate.getDate() === d;
                    });
                    if (targetMsg) {
                      scrollToMessage(targetMsg.id);
                    } else {
                      const targetTime = new Date(y, m - 1, d).getTime();
                      let closestMsg = visibleMessages[0];
                      let minDiff = Infinity;
                      visibleMessages.forEach(msg => {
                        const diff = Math.abs(new Date(msg.timestamp || Date.now()).getTime() - targetTime);
                        if (diff < minDiff) {
                          minDiff = diff;
                          closestMsg = msg;
                        }
                      });
                      if (closestMsg) scrollToMessage(closestMsg.id);
                    }
                    setShowDatePicker(false);
                  }}
                  className="w-full bg-[#050810] border border-white/15 rounded-xl px-3 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-inner"
                />

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const todayMsg = visibleMessages.find(m => new Date(m.timestamp || Date.now()).toDateString() === now.toDateString());
                      if (todayMsg) scrollToMessage(todayMsg.id);
                      else if (visibleMessages.length > 0) scrollToMessage(visibleMessages[visibleMessages.length - 1].id);
                      setShowDatePicker(false);
                    }}
                    className="px-2 py-2 bg-white/5 hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 rounded-xl text-[10px] font-mono text-center transition-all font-bold"
                  >
                    📅 Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (visibleMessages.length > 0) {
                        scrollToMessage(visibleMessages[0].id);
                      }
                      setShowDatePicker(false);
                    }}
                    className="px-2 py-2 bg-white/5 hover:bg-cyan-500/20 text-gray-300 hover:text-cyan-300 rounded-xl text-[10px] font-mono text-center transition-all font-bold"
                  >
                    ⏳ Oldest Message
                  </button>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => { if (targetId) socket.emit("invite_game", { targetId, targetName }); }} className={`w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 ${THEMES[chatTheme].hoverText} transition-all`} title="Invite to Neural Ludo"><Gamepad2 className="w-5 h-5" /></button>
          <button onClick={() => { const u = onlineUsers.find((x: any) => x.id === targetId || x.username === targetName) || { id: targetId, username: targetName }; onCall(u, true); }} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 transition-all" title="Video Call"><Video className="w-5 h-5" /></button>
          <button onClick={() => { const u = onlineUsers.find((x: any) => x.id === targetId || x.username === targetName) || { id: targetId, username: targetName }; onCall(u, false); }} className={`w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 ${THEMES[chatTheme].hoverText} transition-all`} title="Voice Call"><Phone className="w-5 h-5" /></button>
          <button onClick={() => setShowChatSettings(!showChatSettings)} className={`w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 ${showChatSettings ? THEMES[chatTheme].text : ''} transition-all`}><MoreVertical className="w-5 h-5" /></button>
          {showChatSettings && (
            <div className="absolute right-0 top-12 w-56 bg-[#0c1222]/95 border border-white/10 rounded-2xl py-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md z-50 animate-in fade-in slide-in-from-top-3 duration-200">
              <button
                onClick={() => {
                  if (socket) socket.emit("get_history", { targetId });
                  setShowChatSettings(false);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-gray-300 hover:bg-white/5 hover:text-emerald-400 flex items-center gap-2 transition-all"
              >
                <ShieldCheck className="w-4 h-4" /> Active Chat
              </button>
              <button
                onClick={() => {
                  setMessages(prev => {
                    if (!targetId) return [];
                    return prev.filter(m => m.targetId !== targetId && m.senderId !== targetId);
                  });
                  setShowChatSettings(false);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-gray-300 hover:bg-white/5 hover:text-red-400 flex items-center gap-2 transition-all"
              >
                <X className="w-4 h-4" /> Delete Chat History
              </button>
              <button
                onClick={() => {
                  setShowProfileDrawer(true);
                  setShowChatSettings(false);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-gray-300 hover:bg-white/5 hover:text-cyan-400 flex items-center gap-2 transition-all"
              >
                <Info className="w-4 h-4" /> Contact Info
              </button>
              <button
                onClick={() => {
                  setShowProfileDrawer(true);
                  setShowChatSettings(false);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-gray-300 hover:bg-white/5 hover:text-purple-400 flex items-center gap-2 transition-all"
              >
                <Settings className="w-4 h-4" /> More Settings
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Chat Body & Profile Drawer Layout */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Left Side: Messages & Input Container */}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden min-h-0">
          {/* Static Background layer with Opacity control */}
          <div
            className="absolute inset-0 z-0 bg-[#050810]"
            style={{
              backgroundImage: chatWallpaper.startsWith('http') || chatWallpaper.startsWith('data:image')
                ? `url("${chatWallpaper}")`
                : `url("${WALLPAPERS[chatWallpaper] || WALLPAPERS.cubes}")`,
              backgroundSize: chatWallpaper.startsWith('http') || chatWallpaper.startsWith('data:image') ? 'cover' : 'auto',
              backgroundPosition: 'center',
              backgroundRepeat: chatWallpaper.startsWith('http') || chatWallpaper.startsWith('data:image') ? 'no-repeat' : 'repeat',
              opacity: wallpaperOpacity,
              filter: `brightness(${wallpaperBrightness}%) contrast(${wallpaperContrast}%)`
            }}
          />
          {/* Chat Area Scrollable with WhatsApp feel */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 md:p-6 space-y-2 sm:space-y-3 relative z-10 scrollbar-thin scrollbar-thumb-emerald-900/50 w-full max-w-full">
            <AnimatePresence>
              {visibleMessages.length === 0 && (
                <div key="empty-messages" className="text-center mt-16 sm:mt-20 text-gray-500 font-mono text-[10px] uppercase tracking-widest bg-white/5 inline-block px-4 sm:px-6 py-2 rounded-full mx-auto block w-max max-w-[90%] truncate">
                  <ShieldCheck className="inline-block w-4 h-4 mr-2 text-emerald-500" /> {targetId ? `Encrypted tunnel with ${currentDisplayName}` : "End-to-End Encrypted Tunnel Active"}
                </div>
              )}
              {visibleMessages.map((msg, idx) => {
                const currentMsgDate = new Date(msg.timestamp || Date.now());
                const prevMsgDate = idx > 0 ? new Date(visibleMessages[idx - 1].timestamp || Date.now()) : null;
                const isNewDay = !prevMsgDate || currentMsgDate.toDateString() !== prevMsgDate.toDateString();

                const formatMessageDateHeader = (d: Date) => {
                  const today = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(today.getDate() - 1);
                  if (d.toDateString() === today.toDateString()) return "TODAY";
                  if (d.toDateString() === yesterday.toDateString()) return "YESTERDAY";
                  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined }).toUpperCase();
                };

                const isHighlighted = highlightedMsgId === String(msg.id);

                return (
                  <div key={`msg-wrapper-${msg.id || idx}`} className="w-full">
                    {isNewDay && (
                      <div className="flex justify-center my-3 sticky top-1 z-10 select-none">
                        <span className="px-3.5 py-1 rounded-full bg-[#0b1322]/90 border border-white/10 text-[10px] font-mono font-bold tracking-wider text-gray-300 uppercase shadow-md backdrop-blur-md">
                          {formatMessageDateHeader(currentMsgDate)}
                        </span>
                      </div>
                    )}
                    <motion.div
                      key={msg.id || `fallback-msg-${idx}`}
                      ref={(el) => {
                        if (el && msg.id) {
                          messageRefs.current.set(String(msg.id), el);
                        }
                      }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex w-full gap-3 transition-all duration-300 ${isHighlighted ? "scale-[1.02] ring-2 ring-emerald-400 rounded-2xl p-1 shadow-[0_0_35px_rgba(16,185,129,0.8)]" : ""} ${msg.senderName === username ? "flex-row-reverse" : msg.isSystem ? "justify-center" : "flex-row"}`}
                    >
                      {!msg.isSystem && (
                        <div onClick={() => setShowProfileDrawer(true)} className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0 mt-1 bg-[#1e1f22] cursor-pointer hover:opacity-85 transition-all" title="View Profile">
                          {(() => {
                            const senderLookupName = msg.senderUsername || msg.senderName;
                            const fallbackAvatar = onlineUsers.find((u: any) => u.id === msg.senderId || u.username === senderLookupName)?.avatar;
                            const msgAvatarSrc = getAvatarSrcLocal(senderLookupName, fallbackAvatar || msg.senderName);
                            return <img src={msgAvatarSrc} className="w-full h-full object-cover rounded-full" />;
                          })()}
                        </div>
                      )}

                      {msg.isSystem ? (
                        <div className="text-[10px] font-mono text-emerald-600 tracking-widest bg-emerald-950/20 px-4 py-2 rounded-full border border-emerald-900/50 uppercase my-4">
                          {msg.text}
                        </div>
                      ) : (msg.isPaymentSlip || msg.slipData || (typeof msg.text === 'string' && msg.text.includes('[PAYMENT SLIP]'))) ? (
                        <div className={`flex flex-col ${msg.senderName === username ? "items-end" : "items-start"} w-full max-w-[85%] md:max-w-[70%]`}>
                          <div className="bg-[#0b1320] border-2 border-emerald-500/40 rounded-2xl p-4 shadow-[0_0_25px_rgba(16,185,129,0.15)] min-w-[260px] max-w-[320px] relative font-sans">
                            {/* Top PDF File Header Bar */}
                            <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl p-2.5 mb-3">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 font-bold">
                                  <Receipt className="w-4 h-4" />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-white font-mono text-[11px] font-bold truncate">NEURAL_TRANSIT_RECEIPT.pdf</p>
                                  <p className="text-emerald-400 font-mono text-[9px] uppercase tracking-wider">PDF DOCUMENT • VERIFIED</p>
                                </div>
                              </div>
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-md border border-emerald-500/40 uppercase font-bold shrink-0">PDF</span>
                            </div>

                            {/* PDF Document Body Content */}
                            <div className="bg-[#04070f] border border-white/5 rounded-xl p-3 space-y-2 font-mono text-[10px]">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                                <span className="text-gray-500 uppercase">Route</span>
                                <span className="text-white font-bold">@{msg.slipData?.from || msg.senderUsername || msg.senderName} ➔ @{msg.slipData?.to || msg.targetUsername}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                                <span className="text-gray-500 uppercase">TxID</span>
                                <span className="text-amber-400 font-bold">{msg.slipData?.txnId || msg.slipData?.txId || 'TXN-SETTLED'}</span>
                              </div>
                              {msg.slipData?.note && (
                                <div className="flex justify-between items-start border-b border-white/5 pb-1.5">
                                  <span className="text-gray-500 uppercase">Memo</span>
                                  <span className="text-gray-300 text-right font-sans">{msg.slipData.note}</span>
                                </div>
                              )}
                              <div className="pt-2 text-center">
                                <span className="text-gray-400 text-[9px] uppercase block mb-0.5">Amount Settlement</span>
                                <p className="text-3xl font-black text-emerald-400 font-mono tracking-tight">{(msg.slipData?.amount || 0).toLocaleString()} <span className="text-xs">LKR</span></p>
                              </div>
                            </div>

                            {/* PDF View / Inspect Button */}
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onSelectReceipt) {
                                    onSelectReceipt({
                                      txnId: msg.slipData?.txnId || msg.slipData?.txId || 'TXN-VERIFIED',
                                      sender: msg.slipData?.from || msg.senderUsername || msg.senderName,
                                      recipient: msg.slipData?.to || msg.targetUsername || username,
                                      amount: msg.slipData?.amount || 0,
                                      note: msg.slipData?.note || 'Neural Wallet Transit',
                                      date: msg.slipData?.collectedAt || msg.timestamp || new Date().toISOString(),
                                      status: 'COMPLETED'
                                    });
                                  }
                                }}
                                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
                              >
                                <Receipt className="w-4 h-4" /> 📄 VIEW / DOWNLOAD PDF RECEIPT
                              </button>
                            </div>

                            <span className="text-[9px] text-gray-500 font-mono mt-2 block text-right">
                              {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className={`w-full max-w-[88%] sm:max-w-[78%] md:max-w-[68%] flex flex-col ${msg.senderName === username ? "items-end" : "items-start"}`}>
                          <div
                            onTouchStart={(e) => handleTouchStart(e, msg)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onContextMenu={(e) => {
                              if (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
                                e.preventDefault();
                              }
                            }}
                            className={`p-2.5 px-3 sm:px-4 sm:py-2.5 relative text-[13.5px] sm:text-[14px] shadow-md break-words [overflow-wrap:anywhere] max-w-full pr-7 group/msg select-text touch-manipulation cursor-pointer ${msg.senderName === username
                              ? "bg-emerald-600 text-white rounded-2xl rounded-tr-xs"
                              : msg.senderName === "AURA-OS"
                                ? "bg-[#0f2a4a] border border-cyan-500/30 text-cyan-50 rounded-2xl rounded-tl-xs"
                                : "bg-[#18222d] border border-white/5 text-gray-100 rounded-2xl rounded-tl-xs"
                            }`}>
                            {msg.senderName !== username && !targetId && (
                              <span className={`text-[10px] font-black uppercase tracking-tighter mb-1 block ${msg.senderName === "AURA-OS" ? "text-cyan-400" : "text-emerald-500"}`}>
                                {msg.senderName}
                              </span>
                            )}

                            {/* Action Menu Trigger (Arrow) — always visible on mobile, hover on desktop */}
                            <div className="absolute top-2 right-1.5 opacity-80 md:opacity-0 md:group-hover/msg:opacity-100 transition-opacity z-20">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  const isOwn = msg.senderName === username;
                                  setActiveMessageMenu(prev => prev?.id === msg.id ? null : {
                                    id: msg.id,
                                    msg: msg,
                                    x: rect.left,
                                    y: rect.bottom + 4,
                                    isOwn
                                  });
                                }}
                                className="p-1 rounded-full hover:bg-black/30 text-white/70 hover:text-white transition-all cursor-pointer"
                                title="Message Options"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="leading-relaxed break-all max-w-full">
                              {msg.replyToId && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (msg.replyToId) scrollToMessage(msg.replyToId);
                                  }}
                                  className="mb-2 p-2 bg-black/30 hover:bg-black/50 border-l-4 border-emerald-400 rounded-lg text-[10px] text-gray-300 leading-normal max-w-full truncate select-none border border-white/10 flex items-center justify-between gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group/reply"
                                  title="Click to jump to original message"
                                >
                                  <div className="flex-1 min-w-0">
                                    <span className="font-bold text-emerald-400 block mb-0.5 text-[9px] uppercase tracking-wider group-hover/reply:underline">
                                      {msg.replyToSender === username ? "You" : msg.replyToSender}
                                    </span>
                                    <span className="truncate block opacity-85 text-[11px] text-gray-200">
                                      {msg.replyToIsImage || (typeof msg.replyToText === 'string' && (msg.replyToText.startsWith('data:image') || (msg.replyToText.startsWith('http') && !msg.isVideo))) ? (
                                        <span className="flex items-center gap-1 text-emerald-300">
                                          <ImageIcon className="w-3.5 h-3.5 inline" /> Photo
                                        </span>
                                      ) : (
                                        msg.replyToText
                                      )}
                                    </span>
                                  </div>
                                  {(msg.replyToIsImage || (typeof msg.replyToText === 'string' && (msg.replyToText.startsWith('data:image') || (msg.replyToText.startsWith('http') && !msg.isVideo)))) && (
                                    <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 border border-white/20">
                                      <img src={msg.replyToText} alt="Replied visual" className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                </div>
                              )}
                              {msg.isImage ? (
                                <img src={msg.text} alt="Shared visual data" className="max-w-full max-h-64 rounded-xl mt-1 object-cover" />
                              ) : msg.isVideo ? (
                                <video src={msg.text} controls className="max-w-full max-h-64 rounded-xl mt-1" />
                              ) : (
                                msg.text
                              )}
                              {msg.isStreaming && <span className={`inline-block w-2 h-4 ml-1 animate-pulse ${msg.senderName === "AURA-OS" ? "bg-cyan-400" : "bg-emerald-400"}`}></span>}
                            </div>

                        {/* Reaction Badges - WhatsApp style overlapping pill badge */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (() => {
                          const groups: Record<string, string[]> = {};
                          Object.entries(msg.reactions).forEach(([uname, em]) => {
                            const e = String(em);
                            if (!groups[e]) groups[e] = [];
                            groups[e].push(uname);
                          });
                          return (
                            <div className="absolute -bottom-2.5 right-2 flex items-center gap-1 z-20">
                              {Object.entries(groups).map(([emoji, reactors]) => {
                                const iMine = reactors.includes(username);
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    title={reactors.map(r => r === username ? "You" : r).join(", ")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleReaction(msg, emoji);
                                    }}
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[12px] shadow-lg font-sans transition-all duration-150 cursor-pointer select-none border backdrop-blur-md
                                      ${iMine
                                        ? "bg-[#0b1626] border-emerald-400 text-emerald-300 scale-105 shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
                                        : "bg-[#0b1626] border-white/20 text-white hover:border-emerald-400/60 hover:scale-105"
                                      }`}
                                  >
                                    <span>{emoji}</span>
                                    {reactors.length > 1 && <span className="text-[9px] font-bold ml-0.5">{reactors.length}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                        {msg.isLudoReady && (
                          <div className="mt-3">
                            <button
                              onClick={() => {
                                socket?.emit('send_message', { targetId: msg.senderId, text: "Yes, I am ready.", decryptedTextForAi: "yes" });
                              }}
                              className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-[#050810] font-black text-[10px] uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                            >
                              <Gamepad2 className="w-4 h-4" /> START THE GAME
                            </button>
                          </div>
                        )}
                        <div className={`text-[9px] font-mono mt-1 opacity-60 flex items-center justify-end gap-1 ${msg.senderName === username ? "text-emerald-100" : "text-gray-400"}`}>
                          {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {msg.senderName === username && (
                            <span className="inline-flex items-center" title={msg.status === 'seen' ? 'Seen' : msg.status === 'delivered' ? 'Delivered' : 'Sent'}>
                              {msg.status === 'seen' ? (
                                /* Blue double tick */
                                <svg viewBox="0 0 18 11" className="w-4 h-3 fill-blue-400" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.394 .646a.5.5 0 0 0-.708 0l-9 9-3.5-3.5a.5.5 0 0 0-.708.708l3.854 3.854a.5.5 0 0 0 .708 0l9.354-9.354a.5.5 0 0 0 0-.708z" />
                                  <path d="M11.04 4.75l-1.06-1.06L5.5 8.17l1.06 1.06L11.04 4.75z" />
                                </svg>
                              ) : msg.status === 'delivered' ? (
                                /* Grey double tick */
                                <svg viewBox="0 0 18 11" className="w-4 h-3 fill-white/60" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.394 .646a.5.5 0 0 0-.708 0l-9 9-3.5-3.5a.5.5 0 0 0-.708.708l3.854 3.854a.5.5 0 0 0 .708 0l9.354-9.354a.5.5 0 0 0 0-.708z" />
                                  <path d="M11.04 4.75l-1.06-1.06L5.5 8.17l1.06 1.06L11.04 4.75z" />
                                </svg>
                              ) : (
                                /* Single grey tick — sent to server */
                                <svg viewBox="0 0 12 11" className="w-3 h-3 fill-white/50" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M11.07.88a.5.5 0 0 0-.707 0L4.5 6.742 1.637 3.879a.5.5 0 1 0-.707.708L4.147 7.8a.5.5 0 0 0 .707 0L11.07 1.588a.5.5 0 0 0 0-.708z" />
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
              {isTargetTyping && (
                <div key="typing-indicator" className="flex w-full gap-3 flex-row px-4 py-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0 mt-1 bg-[#1e1f22]">
                    {(() => {
                      const typingTarget = onlineUsers.find((u: any) => u.id === targetId || u.username === targetName);
                      const typingAvatar = typingTarget?.avatar || targetName || "AURA-OS";
                      const typingAvatarSrc = String(typingAvatar).startsWith("data:image") ? typingAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${typingAvatar}`;
                      return <img src={typingAvatarSrc} className="w-full h-full object-cover rounded-full" />;
                    })()}
                  </div>
                  <div className="flex flex-col items-start max-w-[85%] md:max-w-[70%]">
                    <div className="p-3 px-4 relative bg-[#162032] border border-white/5 rounded-2xl rounded-tl-sm shadow-xl flex items-center gap-1.5 min-h-[40px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              {/* Virtual DM Payment Banner — only shows AFTER satisfaction confirmed */}
              {isVirtualDm && dmPhase === 'confirmed' && !paymentDone && (
                <div key="payment-banner" className="mx-4 my-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-4 animate-fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">💰</span>
                    <div>
                      <p className="text-white font-bold text-sm font-mono">{targetName} is satisfied ✅</p>
                      <p className="text-gray-400 text-[11px] font-mono">Select the payment amount to collect.</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-2">Collect Payment</p>
                  <div className="flex gap-2 flex-wrap">
                    {[100, 250, 500, 1000, 2500].map(amt => (
                      <button
                        key={amt}
                        onClick={() => {
                          if (onCollectPayment) onCollectPayment(amt);
                          setPaymentDone(true);
                          setDmPhase('paid');
                          setPaymentSuccess(amt);
                          setTimeout(() => setPaymentSuccess(null), 5000);
                        }}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 rounded-xl text-xs font-black font-mono transition-all"
                      >
                        💰 {amt} LKR
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Virtual typing indicator */}
              {isVirtualDm && virtualTyping && (
                <div key="virtual-typing" className="mx-4 my-2 flex items-center gap-2 text-xs text-gray-500 font-mono animate-fade-in">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  {targetName} is typing...
                </div>
              )}
              {paymentSuccess && (
                <div key="payment-success" className="mx-4 my-2 flex items-center gap-3 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl px-4 py-3 animate-fade-in">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="text-emerald-400 font-black font-mono text-sm">+{paymentSuccess} LKR Collected!</p>
                    <p className="text-gray-400 text-[11px] font-mono">Payment stored in your wallet ✓</p>
                  </div>
                </div>
              )}
              {isVirtualDm && paymentDone && !paymentSuccess && (
                <div key="payment-done" className="mx-4 my-2 text-center text-xs text-emerald-500 font-mono opacity-60">✓ Payment collected — session complete</div>
              )}
              {/* Ludo Lobby Card */}
              {ludoLobby && (
                <div key="ludo-lobby" className="mx-4 my-3 bg-gradient-to-b from-[#0c1a2e] to-[#050810] border border-emerald-500/20 rounded-2xl p-5 shadow-[0_0_30px_rgba(16,185,129,0.08)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎮</span>
                      <div>
                        <p className="text-white font-black font-mono text-sm">Neural Ludo Lobby</p>
                        <p className="text-emerald-500 text-[10px] font-mono">Room: {ludoLobby.roomId} · {ludoLobby.ready}/4 ready</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i < ludoLobby.ready ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {ludoLobby.players.map((player, i) => (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-500 ${player.startsWith('⏳') ? 'bg-white/3 opacity-40' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                        <div className={`w-2 h-2 rounded-full ${player.startsWith('⏳') ? 'bg-gray-600' : 'bg-emerald-400 animate-pulse'}`} />
                        <span className="text-xs font-mono font-bold text-white">{i === 0 ? `${player} (You)` : player}</span>
                        {!player.startsWith('⏳') && i !== 0 && <span className="ml-auto text-[9px] text-emerald-500 font-mono">✓ READY</span>}
                      </div>
                    ))}
                  </div>
                  {ludoLobby.ready >= 4 ? (
                    <button
                      onClick={() => {
                        setLudoLaunching(true);
                        setTimeout(() => { if (onDeployToGrid) onDeployToGrid(ludoLobby?.roomId, ludoLobby?.players?.slice(1)); }, 1500);
                      }}
                      disabled={ludoLaunching}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-black rounded-xl text-sm font-mono uppercase tracking-widest transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] animate-pulse disabled:animate-none disabled:opacity-70"
                    >
                      {ludoLaunching ? '⚡ Syncing Neural Grid...' : '🚀 DEPLOY TO GRID'}
                    </button>
                  ) : (
                    <div className="text-center text-[10px] text-gray-500 font-mono animate-pulse">
                      ⏳ Waiting for {4 - ludoLobby.ready} more player{4 - ludoLobby.ready > 1 ? 's' : ''}...
                    </div>
                  )}
                </div>
              )}
              <div key="messages-end" ref={messagesEndRef} />
            </AnimatePresence>
          </div>

          {/* Input */}
          <div className="p-2 sm:p-3 md:p-4 bg-[#090d16] border-t border-white/5 relative z-20 w-full max-w-full overflow-hidden">
            <AnimatePresence>
              {showEmoji && (
                <motion.div key="emoji-picker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-[80px] left-2 sm:left-4 z-50 max-w-[95vw]">
                  <EmojiPicker theme={"dark" as any} onEmojiClick={(e) => setInput(p => p + e.emoji)} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Payment Transfer Modal */}
            {showPayModal && (
              <div className="absolute bottom-[85px] left-2 right-2 sm:left-4 sm:right-4 z-50 bg-[#0c1222] border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-[0_0_30px_rgba(245,158,11,0.15)] backdrop-blur-sm animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💸</span>
                    <div>
                      <p className="text-white font-black font-mono text-sm">Send Payment</p>
                      <p className="text-gray-500 text-[10px] font-mono">Real-time LKR transfer → {targetName}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPayModal(false)} className="text-gray-500 hover:text-white text-sm transition-all">✕</button>
                </div>
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-2">Amount (LKR)</p>
                <div className="flex gap-2 flex-wrap mb-3">
                  {[100, 250, 500, 1000, 2500, 5000].map(a => (
                    <button key={a} onClick={() => setPayModalAmount(a)} className={`px-3 py-1.5 rounded-xl text-xs font-black font-mono transition-all ${payModalAmount === a ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{a}</button>
                  ))}
                </div>
                <input value={payModalNote} onChange={e => setPayModalNote(e.target.value)} placeholder="Note: e.g. Thanks for the consultation! 🙏" className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-xs font-mono outline-none mb-3 focus:border-amber-500/50 transition-all" />
                <button onClick={sendPaymentSlip} className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black rounded-xl text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                  💸 Transfer {payModalAmount} LKR · Share Slip
                </button>
              </div>
            )}

            {/* Message Reply Preview */}
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="mb-2 mx-1 p-2 sm:p-2.5 bg-[#111c2a] border-l-4 border-emerald-500 rounded-xl flex items-center justify-between text-xs text-gray-300 shadow-lg relative overflow-hidden"
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 pr-2 select-none">
                    {(replyingTo.isImage || (typeof replyingTo.text === 'string' && (replyingTo.text.startsWith('data:image') || (replyingTo.text.startsWith('http') && !replyingTo.isVideo)))) && (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden shrink-0 border border-white/20">
                        <img src={replyingTo.text} alt="Reply thumbnail" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-emerald-400 text-[10px] uppercase tracking-wider mb-0.5">
                        Replying to {replyingTo.senderName === username ? "You" : replyingTo.senderName || replyingTo.sender}
                      </p>
                      <p className="truncate text-gray-400 text-xs font-mono">
                        {(replyingTo.isImage || (typeof replyingTo.text === 'string' && (replyingTo.text.startsWith('data:image') || (replyingTo.text.startsWith('http') && !replyingTo.isVideo)))) ? "📷 Photo" : replyingTo.text}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="w-7 h-7 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-all flex items-center justify-center shrink-0"
                    title="Cancel reply"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative flex items-center w-full bg-[#050810] border border-white/10 rounded-full p-1 sm:p-1.5 shadow-inner focus-within:border-emerald-500/50 transition-all gap-1">
              <button onClick={() => setShowEmoji(!showEmoji)} className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 transition-all"><Smile className="w-4 h-4 sm:w-5 sm:h-5" /></button>

              <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 transition-all" title="Share image/video"><ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" /></button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                className="flex-1 min-w-0 bg-transparent border-none outline-none px-2 text-white placeholder-gray-500 text-xs sm:text-sm"
              />
              <button onClick={handleSend} disabled={!input.trim()} className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-emerald-500 rounded-full text-white flex items-center justify-center hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20">
                <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Profile Details Drawer */}
        <AnimatePresence>
          {showProfileDrawer && (
            <motion.div
              key="profile-drawer"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 200 }}
              className="fixed inset-0 z-50 md:static md:w-[360px] h-full border-l border-white/5 bg-[#090d16] flex flex-col shrink-0 overflow-y-auto scrollbar-none"
            >
              {/* Drawer Header */}
              <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 bg-[#090d16] shrink-0">
                <span className="text-white font-bold tracking-wider uppercase text-sm">Contact Info</span>
                <button onClick={() => setShowProfileDrawer(false)} className="p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Profile Details Area */}
              <div className="p-6 space-y-8 flex-1">
                {/* Large Avatar */}
                <div className="text-center">
                  {(() => {
                    const contactUser = onlineUsers.find((u: any) => u.id === targetId || u.username === targetName);
                    const contactAvatar = contactUser?.avatar || targetName || "";
                    const contactAbout = contactUser?.about || "Active Neural Agent";
                    const avatarSrc = contactAvatar.startsWith('data:image') ? contactAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${contactAvatar}`;
                    return (
                      <>
                        <div className="w-32 h-32 rounded-full mx-auto border-2 border-emerald-500/20 overflow-hidden bg-[#050810] relative group flex items-center justify-center mb-4">
                          <img src={avatarSrc} alt="contact" className="w-full h-full object-cover" />
                        </div>

                  {/* Display Name Editing */}
                  <div className="mt-4 flex flex-col items-center">
                    {isEditingName ? (
                      <div className="flex items-center gap-2 w-full max-w-[240px] bg-[#050810] border border-white/10 rounded-xl px-3 py-2">
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          className="bg-transparent border-none outline-none text-white text-sm w-full font-bold"
                          placeholder="Edit nickname..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              localStorage.setItem(`nickname_${username}_${targetId || 'global'}`, tempName.trim());
                              setCustomNickname(tempName.trim());
                              setIsEditingName(false);
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            localStorage.setItem(`nickname_${username}_${targetId || 'global'}`, tempName.trim());
                            setCustomNickname(tempName.trim());
                            setIsEditingName(false);
                          }}
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setTempName(customNickname || targetName);
                            setIsEditingName(false);
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <h2 className="text-lg font-black text-white tracking-wide uppercase">{currentDisplayName}</h2>
                        {targetId && (
                          <button
                            onClick={() => setIsEditingName(true)}
                            className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-all"
                            title="Edit nickname"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-gray-500 uppercase mt-1">
                      {targetId ? "Secure Peer Client" : "Global Channel"}
                    </p>
                    {/* About/Bio section */}
                    {targetId && (
                      <div className="mt-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5 max-w-[240px] mx-auto">
                        <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest mb-1">About</p>
                        <p className="text-gray-300 text-xs text-center">{contactAbout}</p>
                      </div>
                    )}
                  </div>
                      </>
                    );
                  })()}
                </div>

                {/* Theme Settings inside Drawer */}
                <div className="space-y-6 pt-6 border-t border-white/5">
                  <div>
                    <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-3">Chat theme</h4>
                    <div className="flex gap-2.5">
                      {Object.keys(THEMES).map(t => (
                        <button
                          key={t}
                          onClick={() => { setChatTheme(t); localStorage.setItem(`chat_theme_${username}`, t); }}
                          className={`w-7 h-7 rounded-full border transition-all ${t === 'emerald' ? 'bg-emerald-500' :
                              t === 'purple' ? 'bg-purple-600' :
                                t === 'cyan' ? 'bg-cyan-500' :
                                  t === 'amber' ? 'bg-amber-500' : 'bg-rose-600'
                            } ${chatTheme === t ? 'border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.3)]' : 'border-transparent hover:scale-105'}`}
                          title={t}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-3">Preset patterns</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(WALLPAPERS).map(w => (
                        <button
                          key={w}
                          onClick={() => { setChatWallpaper(w); localStorage.setItem(`chat_wallpaper_${username}_${targetName || targetId || 'global'}`, w); }}
                          className={`py-2 px-3 rounded-xl border text-[10px] font-mono uppercase tracking-wider transition-all ${chatWallpaper === w
                              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-bold'
                              : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Adjustments: Opacity, Brightness, Contrast */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-white font-bold text-xs uppercase tracking-widest">Wallpaper opacity</h4>
                        <span className="text-[10px] font-mono text-emerald-400">{Math.round(wallpaperOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={wallpaperOpacity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setWallpaperOpacity(val);
                          localStorage.setItem(`chat_wallpaper_opacity_${username}_${targetName || targetId || 'global'}`, val.toString());
                        }}
                        className="w-full accent-emerald-500 bg-[#050810] h-1.5 rounded-lg appearance-none cursor-pointer animate-pulse"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-white font-bold text-xs uppercase tracking-widest">Wallpaper brightness</h4>
                        <span className="text-[10px] font-mono text-emerald-400">{wallpaperBrightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="150"
                        value={wallpaperBrightness}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setWallpaperBrightness(val);
                          localStorage.setItem(`chat_wallpaper_brightness_${username}_${targetName || targetId || 'global'}`, val.toString());
                        }}
                        className="w-full accent-emerald-500 bg-[#050810] h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-white font-bold text-xs uppercase tracking-widest">Wallpaper contrast</h4>
                        <span className="text-[10px] font-mono text-emerald-400">{wallpaperContrast}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={wallpaperContrast}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setWallpaperContrast(val);
                          localStorage.setItem(`chat_wallpaper_contrast_${username}_${targetName || targetId || 'global'}`, val.toString());
                        }}
                        className="w-full accent-emerald-500 bg-[#050810] h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Upload Wallpaper */}
                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <h4 className="text-white font-bold text-xs uppercase tracking-widest">Upload wallpaper</h4>
                    <input type="file" ref={wallpaperFileInputRef} accept="image/*" onChange={handleWallpaperUpload} className="hidden" />
                    <button
                      onClick={() => wallpaperFileInputRef.current?.click()}
                      className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-mono uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 hover:border-emerald-500/50"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-400" /> Browse Image File
                    </button>
                  </div>

                  {/* Custom Wallpaper Section */}
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <h4 className="text-white font-bold text-xs uppercase tracking-widest">Custom Wallpaper URL</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customWallpaperUrl}
                        onChange={(e) => setCustomWallpaperUrl(e.target.value)}
                        placeholder="Paste image URL here..."
                        className="flex-1 bg-[#050810] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 transition-all"
                      />
                      <button
                        onClick={() => {
                          if (customWallpaperUrl.trim().startsWith('http')) {
                            setChatWallpaper(customWallpaperUrl.trim());
                            localStorage.setItem(`chat_wallpaper_${username}_${targetName || targetId || 'global'}`, customWallpaperUrl.trim());
                          }
                        }}
                        className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* AI Image Generation Section */}
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <h4 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                      Generate AI wallpaper <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    </h4>
                    <div className="flex flex-col gap-2">
                      <textarea
                        rows={2}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe what you want (e.g., cyberpunk city at night with neon lights)..."
                        className="w-full bg-[#050810] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 resize-none transition-all"
                      />
                      <button
                        onClick={async () => {
                          if (!aiPrompt.trim()) return;
                          setIsGeneratingAi(true);
                          // Prompt engineered to guarantee clean HD output
                          const hdPrompt = aiPrompt.trim() + ", ultra-detailed 8k resolution, clear, cinematic, high definition wallpaper";
                          const aiUrl = `https://image.pollinations.ai/p/${encodeURIComponent(hdPrompt)}?width=1080&height=1920&seed=${Date.now()}&nologo=true`;

                          const img = new Image();
                          img.src = aiUrl;
                          img.onload = () => {
                            setChatWallpaper(aiUrl);
                            localStorage.setItem(`chat_wallpaper_${username}_${targetName || targetId || 'global'}`, aiUrl);
                            setIsGeneratingAi(false);
                          };
                          img.onerror = () => {
                            setIsGeneratingAi(false);
                            alert("Failed to generate image. Please try again.");
                          };
                        }}
                        disabled={isGeneratingAi || !aiPrompt.trim()}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                      >
                        {isGeneratingAi ? (
                          <>
                            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                            <span>Generating HD...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 fill-black" />
                            <span>Generate Wallpaper</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* WhatsApp-Style Floating Message Options Dropdown Popover */}
      {activeMessageMenu && (
        <>
          <div
            className="fixed inset-0 z-[90]"
            onClick={() => setActiveMessageMenu(null)}
          />
          <div
            style={{
              position: 'fixed',
              top: Math.max(16, Math.min(activeMessageMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 240)),
              left: Math.max(12, Math.min(
                activeMessageMenu.isOwn
                  ? activeMessageMenu.x - 170
                  : Math.max(16, activeMessageMenu.x - 30),
                (typeof window !== 'undefined' ? window.innerWidth : 400) - 220
              )),
            }}
            className="bg-[#0c1222]/95 border border-white/10 rounded-2xl p-2 shadow-[0_10px_35px_rgba(0,0,0,0.8)] backdrop-blur-md z-[100] w-52 text-xs font-sans text-white animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Quick React Emoji Bar */}
            <div className="text-[10px] font-mono text-gray-400 uppercase px-2 pt-1 pb-1 font-bold">Quick React</div>
            <div className="flex items-center justify-around pb-2 border-b border-white/10 px-1 mb-1">
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    handleToggleReaction(activeMessageMenu.msg, emoji);
                    setActiveMessageMenu(null);
                  }}
                  className="p-1 hover:scale-125 transition-transform text-lg rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Delete for me */}
            <button
              type="button"
              onClick={() => {
                handleDeleteForMe(activeMessageMenu.msg);
                setActiveMessageMenu(null);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-gray-200 hover:text-white flex items-center justify-between font-medium transition-all cursor-pointer"
            >
              <span>Delete for me</span>
              <Trash2 className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* Delete for everyone */}
            <button
              type="button"
              onClick={() => {
                handleDeleteForEveryone(activeMessageMenu.msg);
                setActiveMessageMenu(null);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 flex items-center justify-between font-medium transition-all cursor-pointer"
            >
              <span>Delete for everyone</span>
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            </button>

            {/* Reply */}
            <button
              type="button"
              onClick={() => {
                setReplyingTo(activeMessageMenu.msg);
                setActiveMessageMenu(null);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-emerald-400 hover:text-emerald-300 flex items-center justify-between font-medium transition-all border-t border-white/5 mt-1 pt-1.5 cursor-pointer"
            >
              <span>Reply</span>
              <Reply className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>
        </>
      )}

      {/* 4-Second Undo Delete Snackbar */}
      <AnimatePresence>
        {undoSnackbar && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[120] bg-[#0c1322] border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.3)] px-5 py-3 rounded-2xl flex items-center gap-4 text-white text-xs font-sans"
          >
            <span>Message deleted for you ({undoSnackbar.countdown}s)</span>
            <button
              type="button"
              onClick={() => {
                setDeletedForMeIds(prev => prev.filter(id => id !== undoSnackbar.messageId));
                setUndoSnackbar(null);
              }}
              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-[10px] tracking-wider rounded-lg transition-all cursor-pointer"
            >
              UNDO
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

function VideoCallInterface({ socket, activeCall, myUsername, onEnd }: any) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [callStatus, setCallStatus] = useState("Establishing secure line...");
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);

  const peerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingSignalsRef = useRef<any[]>([]);

  // Call duration counter
  useEffect(() => {
    let timer: any = null;
    if (isConnected) {
      timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isConnected]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    let destroyed = false;

    // Listen for remote peer mute states
    const onRemoteMuteState = (data: any) => {
      setIsRemoteMuted(!!data.isMuted);
    };
    socket.on('remote_mute_state', onRemoteMuteState);

    const onCallAccepted = (signal: any) => {
      setCallStatus("Connecting audio line...");
      if (peerRef.current) {
        try { peerRef.current.signal(signal); } catch (e) { console.warn("Signal error", e); }
      } else {
        pendingSignalsRef.current.push(signal);
      }
    };
    socket.on('call_accepted', onCallAccepted);

    // Relay trickle ICE candidates from the remote peer
    const onRelaySignal = (data: any) => {
      if (peerRef.current && !destroyed) {
        try { peerRef.current.signal(data.signal); } catch (e) { console.warn('relay signal error', e); }
      } else if (!peerRef.current) {
        pendingSignalsRef.current.push(data.signal);
      }
    };
    socket.on('relay_signal', onRelaySignal);

    const getMedia = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: activeCall.isVideo !== false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (e) {
        console.warn("Failed video + audio, trying audio only:", e);
        return await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }
    };

    getMedia().then(stream => {
      if (destroyed) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const peer = new Peer({
        initiator: activeCall.isCaller,
        trickle: true,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turns:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ]
        }
      });

      peer.on('signal', (data: any) => {
        if (activeCall.isCaller) {
          // First signal is the SDP offer — send via call_user; subsequent are ICE candidates
          if (data.type === 'offer') {
            socket.emit('call_user', {
              userToCall: activeCall.userId,
              targetUsername: activeCall.username,
              signalData: data,
              from: myUsername,
              callerName: myUsername,
              isVideo: activeCall.isVideo !== false
            });
          } else {
            // Trickle ICE candidate or renegotiation — relay directly
            socket.emit('relay_signal', { to: activeCall.userId, signal: data });
          }
        } else {
          // Receiver: first signal is the SDP answer, rest are ICE candidates
          if (data.type === 'answer') {
            socket.emit('answer_call', { signal: data, to: activeCall.userId });
          } else {
            socket.emit('relay_signal', { to: activeCall.userId, signal: data });
          }
        }
      });

      peer.on('stream', (remoteStream: MediaStream) => {
        if (destroyed) return;
        setIsConnected(true);
        setCallStatus("Connected. Encrypted Voice & Audio Active");

        // Force enable all audio tracks
        remoteStream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });

        // 1. Play through remote audio element
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.volume = 1.0;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.play().catch(e => console.warn("Remote audio play error:", e));
        }

        // 2. Play through remote video element (WebRTC audio sink for mobile browsers)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.volume = 1.0;
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.play().catch(e => console.warn("Remote video play error:", e));
        }
      });

      peer.on('connect', () => {
        if (!destroyed) {
          setIsConnected(true);
          setCallStatus("Connected. Encrypted Voice & Audio Active");
        }
      });

      peer.on('error', (err: any) => {
        console.error('[WebRTC Error]', err);
        if (!destroyed) setCallStatus("Reconnecting secure audio line...");
      });

      peerRef.current = peer;

      // Drain any buffered signals
      if (pendingSignalsRef.current.length > 0) {
        pendingSignalsRef.current.forEach(sig => {
          try { peer.signal(sig); } catch (e) { console.warn(e); }
        });
        pendingSignalsRef.current = [];
      }

      // If receiver: signal with caller initial signal
      if (!activeCall.isCaller && activeCall.initialSignal) {
        try { peer.signal(activeCall.initialSignal); } catch (e) { console.warn(e); }
      }
    }).catch(err => {
      console.error('[Media Error]', err);
      if (!destroyed) setCallStatus("Microphone access denied. Please allow microphone in browser.");
    });

    return () => {
      destroyed = true;
      socket.off('call_accepted', onCallAccepted);
      socket.off('remote_mute_state', onRemoteMuteState);
      socket.off('relay_signal', onRelaySignal);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (peerRef.current) {
        try { peerRef.current.destroy(); } catch (e) {}
        peerRef.current = null;
      }
    };
  }, []);

  // Toggle Microphone
  const toggleMic = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextMuted = !isMicMuted;
        audioTracks.forEach(t => { t.enabled = !nextMuted; });
        setIsMicMuted(nextMuted);
        socket.emit("call_mute_state", { to: activeCall.userId, isMuted: nextMuted });
      }
    }
  };

  // Toggle Speaker
  const toggleSpeaker = () => {
    const nextSpeakerMuted = !isSpeakerMuted;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = nextSpeakerMuted;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = nextSpeakerMuted;
    }
    setIsSpeakerMuted(nextSpeakerMuted);
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextCamOff = !isCameraOff;
        videoTracks.forEach(t => { t.enabled = !nextCamOff; });
        setIsCameraOff(nextCamOff);
      }
    }
  };

  const endCall = () => {
    socket.emit("end_call", { to: activeCall.userId });
    onEnd();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[#070c18]/98 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-6 sm:p-10 select-none">
      {/* Remote Audio Player */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />

      {/* Hidden video elements during voice calls so WebRTC audio pipeline is never paused by mobile browsers */}
      {activeCall.isVideo === false && (
        <>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
          <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
        </>
      )}

      {!isConnected && (
        <audio autoPlay loop src="https://assets.mixkit.co/active_storage/sfx/2805/2805-preview.mp3" />
      )}

      {/* Top Header */}
      <div className="w-full max-w-lg flex flex-col items-center gap-2 pt-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-emerald-400 font-mono text-[11px] uppercase tracking-wider">
          <Lock className="w-3.5 h-3.5" />
          <span>{isConnected ? `ENCRYPTED CALL · ${formatTime(callDuration)}` : "CONNECTING SECURE TUNNEL"}</span>
        </div>
        <p className="text-gray-400 font-mono text-xs">{callStatus}</p>

        {isRemoteMuted && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 font-mono text-xs flex items-center gap-1.5 shadow-lg">
            <MicOff className="w-3.5 h-3.5" />
            <span>{activeCall.username} is muted</span>
          </motion.div>
        )}
      </div>

      {/* Center Display: Voice Call Avatar or Video Grid */}
      {activeCall.isVideo === false ? (
        <div className="flex flex-col items-center justify-center my-auto">
          <div className="relative mb-6">
            {isConnected && (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '2.5s' }} />
                <div className="absolute -inset-4 rounded-full border border-emerald-500/30 animate-pulse" />
              </>
            )}
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-emerald-500/80 overflow-hidden bg-[#0c1222] shadow-[0_0_50px_rgba(16,185,129,0.3)] relative z-10 flex items-center justify-center">
              <img
                src={activeCall.avatarSrc || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeCall.username}`}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide uppercase font-mono">{activeCall.username}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-emerald-400 font-mono text-xs uppercase tracking-widest">{isConnected ? "Voice Stream Active" : "Ringing..."}</span>
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-3xl aspect-video bg-[#040711] rounded-3xl overflow-hidden border border-white/10 shadow-2xl my-auto flex items-center justify-center">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-white font-mono text-xs flex items-center gap-2">
            <span>{activeCall.username}</span>
            {isRemoteMuted && <MicOff className="w-3.5 h-3.5 text-amber-400" />}
          </div>
          <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-video bg-black rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-xl">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
            {isCameraOff && (
              <div className="absolute inset-0 bg-[#090d16] flex items-center justify-center text-gray-500 text-xs font-mono">
                Camera Off
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Control Bar */}
      <div className="w-full max-w-md pb-6 flex items-center justify-center gap-4 sm:gap-6">
        {/* Mic Mute Button */}
        <button
          onClick={toggleMic}
          className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all shadow-lg ${
            isMicMuted ? 'bg-red-500/20 border-2 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-white/10 border border-white/15 text-white hover:bg-white/20'
          }`}
          title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
        >
          {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Speaker Button */}
        <button
          onClick={toggleSpeaker}
          className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all shadow-lg ${
            isSpeakerMuted ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400' : 'bg-white/10 border border-white/15 text-white hover:bg-white/20'
          }`}
          title={isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}
        >
          {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </button>

        {/* Video Toggle if video call */}
        {activeCall.isVideo !== false && (
          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all shadow-lg ${
              isCameraOff ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400' : 'bg-white/10 border border-white/15 text-white hover:bg-white/20'
            }`}
            title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}

        {/* End Call Button - ONLY Ends when clicked */}
        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_35px_rgba(239,68,68,0.6)] hover:scale-105 active:scale-95 transition-all"
          title="End Call"
        >
          <Phone className="w-8 h-8 rotate-[135deg]" />
        </button>
      </div>
    </motion.div>
  );
}


function WalletPage({ walletInfo, username, onOpenTransfer, onSelectReceipt }: { walletInfo: any, username: string, onOpenTransfer?: (prefillUser?: string) => void, onSelectReceipt?: (receipt: any) => void }) {
  const totalIn = walletInfo.history?.filter((h: any) => h.type === 'cash_in').reduce((acc: number, h: any) => acc + (h.amount || 0), 0) || 0;
  const totalOut = walletInfo.history?.filter((h: any) => h.type === 'cash_out').reduce((acc: number, h: any) => acc + (h.amount || 0), 0) || 0;

  return (
    <div className="flex-1 bg-[#050810] h-full overflow-y-auto p-8 relative">
      <div className="max-w-5xl mx-auto">

        {/* Header section */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-black text-white tracking-widest uppercase mb-2">Neural Wallet</h1>
            <p className="text-emerald-400 font-mono text-sm tracking-widest">Real-Time P2P Transit Network</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => onOpenTransfer && onOpenTransfer()}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl transition-all text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] uppercase tracking-widest"
            >
              <Send className="w-4 h-4" /> REALTIME TRANSFER
            </button>
            <button className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all text-sm flex items-center gap-2 border border-white/10 text-white">
              <Zap className="w-4 h-4 text-amber-400" /> BUY LKR
            </button>
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-900/20 border border-amber-500/30 rounded-3xl p-10 mb-8 relative overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
              <p className="text-amber-500/80 font-mono text-sm uppercase tracking-[0.2em] mb-2">Available Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl md:text-8xl font-black text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                  {walletInfo.wallet?.toLocaleString()}
                </span>
                <span className="text-2xl font-bold text-amber-500/50">LKR</span>
              </div>
            </div>

            <div className="flex gap-8 bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/5">
              <div>
                <p className="text-gray-500 text-xs font-mono uppercase mb-1">Total Received / Won</p>
                <p className="text-emerald-400 font-black text-xl">+{totalIn.toLocaleString()}</p>
              </div>
              <div className="w-px bg-white/10"></div>
              <div>
                <p className="text-gray-500 text-xs font-mono uppercase mb-1">Total Sent / Placed</p>
                <p className="text-red-400 font-black text-xl">-{totalOut.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* History Section */}
        <div>
          <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-widest">Transaction & Cashout History</h2>
            <p className="text-xs text-gray-400 font-mono">Click any transaction to inspect Digital Receipt</p>
          </div>
          <div className="space-y-4">
            {walletInfo.history?.length > 0 ? (
              walletInfo.history.map((h: any, i: number) => {
                const isCashIn = h.type === 'cash_in';
                const receiptObj = {
                  txnId: h.txnId || `TXN-${i}-${Date.now().toString(36).toUpperCase()}`,
                  sender: h.sender || (isCashIn ? 'SYSTEM / GAME' : username),
                  recipient: h.recipient || (isCashIn ? username : 'RECIPIENT'),
                  amount: h.amount,
                  note: h.reason || h.note || 'Neural Wallet Transaction',
                  date: h.date || new Date().toISOString(),
                  status: h.status || 'COMPLETED'
                };
                return (
                  <div 
                    key={i} 
                    onClick={() => onSelectReceipt && onSelectReceipt(receiptObj)}
                    className="bg-[#0c1222] border border-white/5 rounded-2xl p-6 flex justify-between items-center hover:border-emerald-500/40 hover:bg-[#10192d] cursor-pointer transition-all group shadow-md"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCashIn ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {h.txnId ? <Receipt className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-bold text-lg">{h.reason}</p>
                          {h.txnId && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase">P2P RECEIPT</span>}
                        </div>
                        <p className="text-gray-500 font-mono text-xs">{new Date(h.date || Date.now()).toLocaleDateString()} at {new Date(h.date || Date.now()).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className={`font-black text-2xl ${isCashIn ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isCashIn ? '+' : '-'}{(h.amount || 0).toLocaleString()} LKR
                        </p>
                        <p className="text-gray-500 text-[10px] font-mono group-hover:text-emerald-400 transition-colors uppercase">Click for Receipt 🧾</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                <Wallet className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 font-mono">No transaction history found.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function TransferModal({
  isOpen,
  onClose,
  socket,
  username,
  walletBalance,
  defaultRecipient,
  loading,
  error
}: {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
  username: string;
  walletBalance: number;
  defaultRecipient?: string;
  loading: boolean;
  error: string | null;
}) {
  const [recipient, setRecipient] = useState(defaultRecipient || "");
  const [amount, setAmount] = useState<number | string>(1000);
  const [note, setNote] = useState("");

  const [verificationState, setVerificationState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [verificationMsg, setVerificationMsg] = useState<string>("");
  const [shakeError, setShakeError] = useState(false);

  useEffect(() => {
    if (defaultRecipient) {
      setRecipient(defaultRecipient);
      if (socket) socket.emit("check_recipient_username", { username: defaultRecipient });
    }
  }, [defaultRecipient, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleResult = (res: any) => {
      if (res.valid) {
        setVerificationState('valid');
        setVerificationMsg(res.message || `✔ VERIFIED ONLINE ACCOUNT (@${res.username})`);
        setShakeError(false);
        try {
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}
      } else {
        setVerificationState('invalid');
        setVerificationMsg(res.message || `✖ ACCOUNT NOT FOUND`);
        setShakeError(true);
        setTimeout(() => setShakeError(false), 450);
        try {
          if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([100, 50, 100]);
          }
        } catch (e) {}
        try {
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3");
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}
      }
    };

    socket.on("recipient_check_result", handleResult);
    return () => {
      socket.off("recipient_check_result", handleResult);
    };
  }, [socket]);

  const handleRecipientChange = (val: string) => {
    setRecipient(val);
    if (!val.trim()) {
      setVerificationState('idle');
      setVerificationMsg("");
      return;
    }
    if (socket) {
      socket.emit("check_recipient_username", { username: val });
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    if (verificationState === 'invalid') {
      setShakeError(true);
      setTimeout(() => setShakeError(false), 450);
      try {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate([100, 50, 100]);
        }
      } catch (e) {}
      return;
    }
    socket.emit("transfer_wallet_funds", {
      recipientUsername: recipient,
      amount: typeof amount === "string" ? parseFloat(amount) : amount,
      note: note
    });
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
      <div className="bg-[#0c1222] border border-emerald-500/30 rounded-3xl w-full max-w-lg p-8 shadow-[0_0_60px_rgba(16,185,129,0.2)] relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest">Realtime Money Transfer</h2>
              <p className="text-emerald-400 font-mono text-xs">Direct P2P Neural Transit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-all text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono p-4 rounded-2xl flex items-center gap-3 animate-shake">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[#050810] border border-white/5 rounded-2xl p-4 flex justify-between items-center">
            <span className="text-gray-400 text-xs font-mono uppercase">Your Available Balance</span>
            <span className="text-emerald-400 font-black font-mono text-lg">{walletBalance?.toLocaleString()} LKR</span>
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-mono uppercase mb-2">Recipient Username</label>
            <div className="relative">
              <input
                type="text"
                value={recipient}
                onChange={(e) => handleRecipientChange(e.target.value)}
                placeholder="Enter exact account username (e.g. ash002)"
                className={`w-full bg-[#050810] border rounded-2xl px-5 py-4 text-white font-mono text-sm focus:outline-none transition-all ${
                  shakeError ? 'animate-shake' : ''
                } ${
                  verificationState === 'valid'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                    : verificationState === 'invalid'
                    ? 'border-red-500 bg-red-500/10 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                    : 'border-white/10 focus:border-emerald-500'
                }`}
                required
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {verificationState === 'valid' && <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-pulse" />}
                {verificationState === 'invalid' && <ShieldAlert className="w-5 h-5 text-red-500 animate-bounce" />}
              </div>
            </div>

            {verificationMsg && (
              <p className={`mt-2 font-mono text-xs flex items-center gap-1.5 ${
                verificationState === 'valid' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'
              }`}>
                {verificationMsg}
              </p>
            )}
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-mono uppercase mb-2">Transfer Amount (LKR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter LKR amount"
              min="1"
              max={walletBalance}
              className="w-full bg-[#050810] border border-white/10 rounded-2xl px-5 py-4 text-emerald-400 font-black font-mono text-xl focus:outline-none focus:border-emerald-500 transition-all mb-3"
              required
            />
            <div className="flex gap-2">
              {[1000, 2000, 5000, 10000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className="flex-1 py-2 bg-white/5 hover:bg-emerald-500/20 text-emerald-400 border border-white/10 hover:border-emerald-500/40 rounded-xl text-xs font-mono font-bold transition-all"
                >
                  +{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-mono uppercase mb-2">Reference Memo / Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Payment for consultation / Ludo game fund"
              className="w-full bg-[#050810] border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || verificationState === 'invalid'}
            className={`w-full py-5 font-black text-lg rounded-2xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)] uppercase tracking-widest flex items-center justify-center gap-2 ${
              verificationState === 'invalid'
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black'
            }`}
          >
            {loading ? (
              <span className="animate-pulse">PROCESSING TRANSIT...</span>
            ) : (
              <>
                <Send className="w-5 h-5" /> SEND LKR IN REALTIME
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function DigitalReceiptModal({
  receipt,
  onClose
}: {
  receipt: any;
  onClose: () => void;
}) {
  if (!receipt) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-[160] flex items-center justify-center p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#080d18] border-2 border-emerald-500/50 rounded-3xl w-full max-w-md p-8 shadow-[0_0_80px_rgba(16,185,129,0.3)] relative overflow-hidden text-white font-sans"
      >
        {/* Top-Right X Close Button */}
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          type="button"
          className="absolute top-5 right-5 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white z-20 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6 border-b border-white/10 pb-6">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-widest text-white">Neural Transit Receipt</h2>
          <p className="text-emerald-400 font-mono text-xs uppercase tracking-[0.2em]">Verified Blockchain Ledger</p>
        </div>

        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center mb-6">
          <p className="text-gray-400 text-xs font-mono uppercase mb-1">Total Transferred</p>
          <p className="text-5xl font-black text-emerald-400 tracking-tight font-mono">{(receipt.amount || 0).toLocaleString()} <span className="text-lg">LKR</span></p>
          <div className="mt-3 inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono px-3 py-1 rounded-full uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            {receipt.status || 'SUCCESS'}
          </div>
        </div>

        <div className="space-y-4 bg-[#04070f] p-5 rounded-2xl border border-white/5 font-mono text-xs mb-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-500 uppercase">Transaction ID</span>
            <span className="text-amber-400 font-bold tracking-wider">{receipt.txnId}</span>
          </div>

          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-500 uppercase">Sender Node</span>
            <span className="text-white font-bold">@{receipt.sender}</span>
          </div>

          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-500 uppercase">Recipient Node</span>
            <span className="text-emerald-400 font-bold">@{receipt.recipient}</span>
          </div>

          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-500 uppercase">Date & Time</span>
            <span className="text-gray-300">{new Date(receipt.date || Date.now()).toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-gray-500 uppercase">Reference Memo</span>
            <span className="text-gray-300 font-sans max-w-[180px] text-right font-medium">{receipt.note || 'Neural Wallet Transit'}</span>
          </div>
        </div>

        <div className="border border-dashed border-white/10 rounded-2xl p-4 flex items-center justify-between bg-black/30 mb-6">
          <div>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Security Stamp</p>
            <p className="text-[11px] text-emerald-500/80 font-mono">NEURAL-FIN-SEC-v3.0</p>
          </div>
          <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-500 text-xs font-mono font-bold tracking-tighter">
            [QR]
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            <Receipt className="w-4 h-4" /> Save / Print
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopPage({ socket, walletInfo }: { socket: Socket | null, walletInfo: any }) {
  const [activeShopTab, setActiveShopTab] = useState<'tokens' | 'boards' | 'gift'>('tokens');
  const [giftAmount, setGiftAmount] = useState(250);
  const [giftRecipient, setGiftRecipient] = useState('');
  const [giftMsg, setGiftMsg] = useState('');
  const [giftSent, setGiftSent] = useState(false);

  const tokens = [
    { id: 'standard', name: 'Standard Unit', price: 0, icon: '⬢', desc: 'Default neural node geometry.' },
    { id: 'button', name: 'Tactical Button', price: 1500, icon: '🔘', desc: 'Low-profile sleek kinetic disc.' },
    { id: 'sphere', name: 'Neon Sphere', price: 1000, icon: '●', desc: 'High-speed aerodynamic kinetic unit.' },
    { id: 'cube', name: 'Cyber Cube', price: 2500, icon: '■', desc: 'Reinforced block chain geometry.' },
    { id: 'diamond', name: 'Apex Diamond', price: 3500, icon: '💎', desc: 'Multi-faceted crystalline sync unit.' },
    { id: 'pyramid', name: 'Neural Pyramid', price: 5000, icon: '▲', desc: 'Elite geometric sync structure.' },
  ];

  const boards = [
    { id: 'classic', name: 'Classic Protocol', price: 0, desc: 'Standard AURA-OS grid interface.' },
    { id: 'space', name: 'Deep Space', price: 2000, desc: 'Play on the edge of the neural void.' },
    { id: 'matrix', name: 'Matrix Source', price: 4500, desc: 'Raw binary stream visualization.' },
    { id: 'gold', name: 'Golden Empire', price: 8000, desc: 'Premium executive neural grid.' },
  ];

  const buy = (id: string, price: number, type: string, name: string) => {
    socket?.emit('shop_buy', { itemId: id, price, type, itemName: name });
  };

  const equip = (id: string, type: string) => {
    socket?.emit('shop_select', { itemId: id, type });
  };

  const inventory = walletInfo?.inventory || { tokens: ['standard'], boards: ['classic'], selectedToken: 'standard', selectedBoard: 'classic' };

  return (
    <div className="flex-1 flex flex-col p-8 bg-[#050810] overflow-y-auto h-full selection:bg-emerald-500/30">
      <div className="flex justify-between items-end mb-12 shrink-0">
        <div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">NEURAL SHOP</h1>
          <p className="text-emerald-500 font-mono text-sm tracking-widest uppercase">Upgrade your grid interface</p>
        </div>
        <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl text-right">
          <p className="text-gray-500 text-[10px] font-mono uppercase tracking-[0.2em] mb-1">Available Credits</p>
          <p className="text-3xl font-black text-emerald-400">{walletInfo?.wallet || 0} <span className="text-xs">LKR</span></p>
        </div>
      </div>

      <div className="flex gap-4 mb-8 flex-wrap">
        <button onClick={() => setActiveShopTab('tokens')} className={`px-8 py-3 rounded-xl font-bold transition-all ${activeShopTab === 'tokens' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-gray-500 hover:text-white'}`}>TOKEN SKINS</button>
        <button onClick={() => setActiveShopTab('boards')} className={`px-8 py-3 rounded-xl font-bold transition-all ${activeShopTab === 'boards' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-gray-500 hover:text-white'}`}>BOARD STYLES</button>
        <button onClick={() => setActiveShopTab('gift')} className={`px-8 py-3 rounded-xl font-bold transition-all ${activeShopTab === 'gift' ? 'bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]' : 'bg-white/5 text-gray-500 hover:text-white'}`}>🎁 GIFT TOKENS</button>
      </div>

      {activeShopTab === 'gift' ? (
        <div className="max-w-xl">
          <div className="bg-[#0c1222] border border-white/5 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl">🎁</span>
              <div>
                <h2 className="text-xl font-black text-white font-mono">Send a Gift</h2>
                <p className="text-gray-500 text-xs font-mono">Transfer LKR or token skin to another agent</p>
              </div>
            </div>
            {giftSent ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🎉</div>
                <p className="text-emerald-400 font-black text-lg font-mono">Gift Sent!</p>
                <p className="text-gray-500 text-sm font-mono mt-1">{giftAmount} LKR sent to {giftRecipient || 'recipient'}</p>
                <button onClick={() => { setGiftSent(false); setGiftRecipient(''); setGiftMsg(''); }} className="mt-6 px-6 py-2 bg-white/5 text-gray-400 rounded-xl text-sm font-mono hover:bg-white/10 transition-all">Send Another</button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-2 block">Recipient Username</label>
                  <input value={giftRecipient} onChange={e => setGiftRecipient(e.target.value)} placeholder="e.g. Rift_Dev" className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 text-white rounded-xl px-4 py-3 text-sm font-mono outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-2 block">Amount (LKR)</label>
                  <div className="flex gap-2 flex-wrap">
                    {[100, 250, 500, 1000].map(a => (
                      <button key={a} onClick={() => setGiftAmount(a)} className={`px-4 py-2 rounded-xl text-xs font-black font-mono transition-all ${giftAmount === a ? 'bg-violet-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{a} LKR</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-2 block">Message (optional)</label>
                  <input value={giftMsg} onChange={e => setGiftMsg(e.target.value)} placeholder="Thanks for the help! 🙏" className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 text-white rounded-xl px-4 py-3 text-sm font-mono outline-none transition-all" />
                </div>
                <button
                  onClick={() => {
                    if (!giftRecipient.trim()) return;
                    socket?.emit('gift_send', { to: giftRecipient, amount: giftAmount, message: giftMsg });
                    setGiftSent(true);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white font-black rounded-xl transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] font-mono uppercase tracking-wider"
                >
                  🎁 Send {giftAmount} LKR Gift
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {activeShopTab === 'tokens' ? tokens.map(t => {
            const owned = inventory.tokens.includes(t.id);
            const selected = inventory.selectedToken === t.id;
            return (
              <div key={t.id} className={`bg-[#0c1222] border rounded-3xl p-6 transition-all duration-500 ${selected ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/5 hover:border-white/20'}`}>
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-4xl mb-6">{t.icon}</div>
                <h3 className="text-xl font-bold text-white mb-1">{t.name}</h3>
                <p className="text-gray-500 text-xs mb-6 h-8">{t.desc}</p>
                <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                  <span className="text-emerald-400 font-bold">{t.price > 0 ? `${t.price} LKR` : 'FREE'}</span>
                  {owned ? (
                    <button onClick={() => equip(t.id, 'token')} className={`px-4 py-2 rounded-lg text-xs font-bold ${selected ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>{selected ? 'EQUIPPED' : 'EQUIP'}</button>
                  ) : (
                    <button onClick={() => buy(t.id, t.price, 'token', t.name)} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-lg text-xs font-bold transition-all">BUY SKIN</button>
                  )}
                </div>
              </div>
            );
          }) : boards.map(b => {
            const owned = inventory.boards.includes(b.id);
            const selected = inventory.selectedBoard === b.id;
            return (
              <div key={b.id} className={`bg-[#0c1222] border rounded-3xl p-6 transition-all duration-500 ${selected ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/5 hover:border-white/20'}`}>
                <div className={`w-full h-32 rounded-2xl mb-6 ${b.id === 'classic' ? 'bg-[#162032]' : b.id === 'space' ? 'bg-[#0a0a2a]' : b.id === 'matrix' ? 'bg-[#001a00]' : 'bg-[#2a1a00]'}`}></div>
                <h3 className="text-xl font-bold text-white mb-1">{b.name}</h3>
                <p className="text-gray-500 text-xs mb-6 h-8">{b.desc}</p>
                <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                  <span className="text-emerald-400 font-bold">{b.price > 0 ? `${b.price} LKR` : 'FREE'}</span>
                  {owned ? (
                    <button onClick={() => equip(b.id, 'board')} className={`px-4 py-2 rounded-lg text-xs font-bold ${selected ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>{selected ? 'EQUIPPED' : 'EQUIP'}</button>
                  ) : (
                    <button onClick={() => buy(b.id, b.price, 'board', b.name)} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-lg text-xs font-bold transition-all">PURCHASE</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiscordDevHub({ socket, username, nicknames, qaMessages, setQaMessages, memberStatuses, setMemberStatuses, discordTypingMap, isSimulationEnabled, setIsSimulationEnabled, onGoToChat, onLudoInvite, onlineUsers = [] }: any) {
  const [activeChannel, setActiveChannel] = useState("nodejs-sdk");
  const [qaInput, setQaInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qaInputRef = useRef<HTMLInputElement>(null);

  const COMMUNITY_MEMBERS = [
    { name: "DevBot", avatar: "DevBot", isBot: true, desc: "SDK Specialist" },
    { name: "agent7205", avatar: "agent7205", isBot: true, desc: "Idea Incubator" },
    { name: "Rift_Dev", avatar: "Rift", isBot: false, desc: "C++ Architect" },
    { name: "Luna_Coder", avatar: "Luna", isBot: false, desc: "Next.js Designer" },
    { name: "Cyber_Sam", avatar: "Sam", isBot: false, desc: "Socket Expert" },
    { name: "Neon_Gamer", avatar: "Neon", isBot: false, desc: "Ludo Specialist" },
    { name: "Pixel_Art", avatar: "Pixel", isBot: false, desc: "UI Designer" },
    { name: "Ashfaq", avatar: "Ashfaq", isBot: false, desc: "Founder / Admin" },
  ];

  // Render text with @mention highlights
  const renderMentionText = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.slice(1);
        const isMember = COMMUNITY_MEMBERS.some(m => m.name.toLowerCase() === name.toLowerCase());
        return isMember ? (
          <span key={i} className="bg-[#5865F2]/20 text-[#7289da] font-bold rounded px-0.5 cursor-pointer hover:bg-[#5865F2]/40 transition-all">{part}</span>
        ) : (
          <span key={i} className="text-cyan-400 font-semibold">{part}</span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaMessages, isTyping]);

  // Always-on community activity — members join/chat/leave automatically
  useEffect(() => {
    const ACTIVITY_POOL = [
      {
        member: { name: "Rift_Dev", avatar: "Rift", isBot: false }, messages: [
          "Anyone else getting WebSocket timeouts on port 5000?",
          "Just pushed a new C++ socket class to the grid. Feels smooth!",
          "Working on Unreal Engine multiplayer sync right now 🔥",
        ]
      },
      {
        member: { name: "Luna_Coder", avatar: "Luna", isBot: false }, messages: [
          "Loving the new glassmorphic updates on the dashboard 🌙",
          "Hot tip: always use `useEffect` cleanup to avoid socket leaks!",
          "Does anyone have a good Next.js 14 app router example?",
        ]
      },
      {
        member: { name: "Cyber_Sam", avatar: "Sam", isBot: false }, messages: [
          "Socket handshake complete ✅ All tunnels stable.",
          "Pro tip: use heartbeat pings every 25s to keep WS alive.",
          "Just debugged a nasty race condition in the message queue. Fixed!",
        ]
      },
      {
        member: { name: "Neon_Gamer", avatar: "Neon", isBot: false }, messages: [
          "Who's up for a Ludo match? 500 LKR minimum! 🎮",
          "Just won 3 games in a row. The neural Ludo AI is no match 😄",
          "Waiting in the lobby — anyone joining?",
        ]
      },
      {
        member: { name: "Pixel_Art", avatar: "Pixel", isBot: false }, messages: [
          "New UI mockup looks fire 🎨 Dark mode + neon accents = perfect.",
          "Anyone else obsessed with the glow effects on the cards?",
          "Design tip: keep your HSL hue consistent across the palette!",
        ]
      },
      {
        member: { name: "agent7205", avatar: "agent7205", isBot: true }, messages: [
          "Neural activity spike detected. All systems green 🤖",
          "Analyzing decentralized node topology... standby.",
          "Fascinating thread! I'm logging this for the next build cycle.",
        ]
      },
      {
        member: { name: "Ashfaq", avatar: "Ashfaq", isBot: false }, messages: [
          "Great progress everyone. Keep pushing to the grid! 🚀",
          "Reminder: biometric auth update drops next cycle. Stay tuned.",
          "All systems operational. Welcome to the Aura ecosystem.",
        ]
      },
    ];

    const runActivity = () => {
      const pool = ACTIVITY_POOL[Math.floor(Math.random() * ACTIVITY_POOL.length)];
      const member = pool.member;
      const text = pool.messages[Math.floor(Math.random() * pool.messages.length)];

      // Show join system message
      const joinMsg = {
        id: `community_join_${Date.now()}`,
        sender: "System",
        avatar: "System",
        isSystem: true,
        text: `✨ ${member.name} is active in the community.`,
        timestamp: new Date()
      };
      setQaMessages((prev: any) => [...prev, joinMsg]);

      // After 2s, show their message
      setTimeout(() => {
        const chatMsg = {
          id: `community_msg_${Date.now()}`,
          sender: member.name,
          avatar: member.avatar,
          isBot: member.isBot,
          text,
          timestamp: new Date()
        };
        setQaMessages((prev: any) => [...prev, chatMsg]);

        // Always offer DM help for ANY community message (not just questions)
        setTimeout(() => {
          const helpReplies = [
            `Hey @${member.name}! 👋 I can help with this. DM me and we'll sort it out!`,
            `@${member.name} — I've got you covered on this. Come to my DM for a detailed answer 📩`,
            `Noticed your message @${member.name}! DM me directly, I can guide you through this 🚀`,
          ];
          const replyText = helpReplies[Math.floor(Math.random() * helpReplies.length)];
          const dmMsg = {
            id: `ashfaq_dm_invite_${Date.now()}`,
            sender: username || 'Ashfaq',
            avatar: username || 'Ashfaq',
            isBot: false,
            text: replyText,
            dmInvite: true,
            dmMemberInfo: { name: member.name, avatar: member.avatar, isBot: member.isBot },
            dmQuestion: text,
            dmTargetName: member.name,
            timestamp: new Date()
          };
          setQaMessages((prev: any) => [...prev, dmMsg]);
        }, 3000 + Math.random() * 1000);
      }, 2000);
    };

    // First activity after 8 seconds
    const first = setTimeout(runActivity, 8000);
    // Then every 20-28 seconds
    const interval = setInterval(runActivity, 22000 + Math.random() * 6000);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  const handleMediaUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isImage && !isVideo) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        let result = ev.target?.result as string;
        if (isImage) {
          result = await compressImage(result, 600, 600, 0.6);
        }
        const userMsg = {
          id: `qa_${Date.now()}`,
          sender: username,
          avatar: username,
          isBot: false,
          text: result,
          isImage: isImage,
          isVideo: isVideo,
          timestamp: new Date()
        };
        socket?.emit("discord_qa_message", userMsg);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendQa = () => {
    if (!qaInput.trim()) return;
    const userMsg = {
      id: `qa_${Date.now()}`,
      sender: username,
      avatar: username,
      isBot: false,
      text: qaInput,
      replyTo: replyTo ? { sender: replyTo.sender, text: typeof replyTo.text === 'string' ? replyTo.text.slice(0, 80) : '📎 Media' } : null,
      timestamp: new Date()
    };

    // Add locally to the Q&A channel feed immediately
    setQaMessages((prev: any) => {
      if (prev.some((m: any) => m.id === userMsg.id)) return prev;
      return [...prev, userMsg];
    });

    socket?.emit("discord_qa_message", userMsg);
    const query = qaInput.toLowerCase();
    const capturedReplyTo = replyTo;
    setQaInput("");
    setReplyTo(null);
    setMentionQuery(null);

    const members = [
      { name: "DevBot", avatar: "DevBot", isBot: true, desc: "SDK Specialist" },
      { name: "agent7205", avatar: "agent7205", isBot: true, desc: "Idea Incubator" },
      { name: "Rift_Dev", avatar: "Rift", isBot: false, desc: "C++ Architect" },
      { name: "Luna_Coder", avatar: "Luna", isBot: false, desc: "Next.js Designer" },
      { name: "Cyber_Sam", avatar: "Sam", isBot: false, desc: "Socket Expert" },
      { name: "Neon_Gamer", avatar: "Neon", isBot: false, desc: "Ludo Specialist" },
      { name: "Pixel_Art", avatar: "Pixel", isBot: false, desc: "UI designer" },
      { name: "Ashfaq", avatar: "Ashfaq", isBot: false, desc: "Founder / Admin" }
    ];

    let chosenReplier = members[0];
    let replyText = "";
    let thoughtText = "";

    // Detect @mention of a specific community member
    const mentionMatch = qaInput.match(/@(\w+)/);
    const mentionedName = mentionMatch ? mentionMatch[1] : null;
    const mentionedMember = mentionedName
      ? COMMUNITY_MEMBERS.find(m => m.name.toLowerCase() === mentionedName.toLowerCase())
      : null;

    if (query.includes("founder") || query.includes("who is ashfaq") || query.includes("admin") || query.includes("creator") || query.includes("built this") || query.includes("made this")) {
      chosenReplier = members[0];
      thoughtText = `1. Analyzing query intent: Identify Aura OS core architect.\n2. Checking administrator index...\n3. Found match: "Ashfaq" (Founder / Admin).\n4. Retrieving clearance profiles and system roles...\n5. Synthesizing origin log...`;
      replyText = `### Founder & Lead Architect: **Ashfaq** (Founder / Admin)
**Ashfaq** is the founder, lead systems architect, and root administrator of the **AURA-OS** ecosystem. 

Under his direction, the following core specifications have been implemented:
* **Sonic & Facial Security**: Dual-mode biometric portals (2D facial scan and frequency-analyzed sonic clap auth).
* **Multiplayer Neural Grid**: High-stakes Ludo rooms requiring a minimum of **500 LKR** stakes to play.
* **Aura Social Matrix**: Real-time Node.js socket relays running on port 5000, secure peer-to-peer WebRTC audio/video calls, and simulated community scenarios.`;
    } else if (query.includes("compare") || query.includes("data") || query.includes("database") || query.includes("my stat") || query.includes("profile")) {
      chosenReplier = members[0];
      thoughtText = `1. Parsing token: "compare data"\n2. Pulling session username: "${username}"\n3. Loading root record: "Ashfaq"\n4. Structuring comparison metrics (Wallet, inventory, status)...\n5. Rendering formatted Markdown output table...`;
      replyText = `### Developer Data Comparison Matrix
A real-time telemetry comparison between your profile and **Ashfaq** (Founder):

| Parameter | ${username} (You) | Ashfaq (Founder) | Alignment |
| :--- | :--- | :--- | :--- |
| **Clearance Level** | Developer (Level 1) | Root Admin (Level 5) | Secure Bypass |
| **System Clearance** | Local Node | Root Core | Restricted |
| **Ludo Stakes Clearance** | Enabled (Min 500 LKR) | Enabled (Min 500 LKR) | Synchronized |
| **Biometric Auth Mode** | Client Verification | Master System Verification | Verified |
| **Socket Tunnels** | 1 Active | Unlimited Relays | Nominal |`;
    } else if (query.includes("unreal") || query.includes("ue") || query.includes("unreal engine") || query.includes("c++")) {
      const choice = Math.random() > 0.5 ? 2 : 0;
      chosenReplier = members[choice];
      thoughtText = `1. Query matched Unreal Engine development pipelines.\n2. Loading C++ WebSockets integration blueprint (FWebSocketsModule).\n3. Compiling sample configuration for port 5000...`;
      if (choice === 2) {
        replyText = "Hey! I'm Rift_Dev. I've been integrating Unreal Engine with Aura's Node.js socket layer. Using FWebSocketsModule in C++ is highly efficient for real-time multiplayer telemetry. Let me know if you need to see a sample configuration!";
      } else {
        replyText = `### Unreal Engine C++ Sockets Setup
To connect your Unreal Engine game client to Aura server, add \`"WebSockets"\` to your \`Build.cs\` public dependencies:

\`\`\`cpp
PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "WebSockets" });
\`\`\`

Then, initialize and connect using the \`IWebSocket\` interface:

\`\`\`cpp
#include "WebSocketsModule.h"
#include "IWebSocket.h"

// Declaration
TSharedPtr<IWebSocket> Socket;

// Connect
void AMyGameMode::ConnectToAura() {
    if (!FWebSocketsModule::Get().IsWebSocketServerAvailable()) return;
    
    Socket = FWebSocketsModule::Get().CreateWebSocket("ws://localhost:5000");
    
    Socket->OnConnected().AddLambda([]() {
        GEngine->AddOnScreenDebugMessage(-1, 5.f, FColor::Green, TEXT("AURA NETWORK: Connected successfully"));
    });
    
    Socket->OnMessage().AddLambda([](const FString& MessageString) {
        // Parse incoming real-time JSON payloads here
        GEngine->AddOnScreenDebugMessage(-1, 5.f, FColor::Cyan, MessageString);
    });
    
    Socket->Connect();
}
\`\`\``;
      }
    } else if (query.includes("node") || query.includes("nodejs")) {
      const choice = Math.random() > 0.5 ? 4 : 0;
      chosenReplier = members[choice];
      thoughtText = `1. Parsing Node.js runtime environment parameters.\n2. Selecting Socket.io-client connection guidelines...\n3. Synthesizing connection script...`;
      if (choice === 4) {
        replyText = "Cyber_Sam here! Node.js with Socket.io is super stable for handling asynchronous events on port 5000. Our server broadcasts state transitions instantly. Let me know if you are seeing any disconnect issues.";
      } else {
        replyText = `### Node.js Real-time SDK Integration
To build a Node.js client or microservice connecting directly to Aura's encrypted message matrix, use \`socket.io-client\`:

\`\`\`javascript
const { io } = require("socket.io-client");
const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("CONNECTED TO AURA GRID: " + socket.id);
  // Join the encrypted matrix
  socket.emit("join_grid", { username: "NodeAgent" });
});

// Receive encrypted real-time messages
socket.on("receive_message", (message) => {
  console.log("New encrypted broadcast received:", message);
});
\`\`\``;
      }
    } else if (query.includes("nextjs") || query.includes("next") || query.includes("react") || query.includes("hydration")) {
      const choice = Math.random() > 0.5 ? 3 : 0;
      chosenReplier = members[choice];
      thoughtText = `1. Hydration status: checking potential layout gates in Next.js Server Components.\n2. Formulating hydration-safe responsive markup examples...\n3. Reviewing Server-Side rendering constraints...`;
      if (choice === 3) {
        replyText = "Hey there! Luna here. If you're building with Next.js, remember that components run on the server first. Using variables like \`window\` will cause hydration failures. Keep your browser-only calls inside \`useEffect\`!";
      } else {
        replyText = `### Next.js & React Client-Side Integration
To avoid Server-Side Rendering (SSR) / hydration mismatch when using global window states (like responsive layout toggles), avoid conditional markup gates based on \`window.innerWidth\`.
Instead, use responsive CSS grid or display utilities:

\`\`\`tsx
// INCORRECT (Triggers React Hydration Mismatch):
{window.innerWidth >= 768 && <Sidebar />}

// CORRECT (Hydration Safe & Responsive):
<div className="hidden md:block">
  <Sidebar />
</div>
\`\`\`

Always wrap your browser-only initializations inside a client-side layout or lazy dynamic imports:
\`\`\`typescript
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });
\`\`\``;
      }
    } else if (query.includes("webrtc") || query.includes("voice") || query.includes("video") || query.includes("call")) {
      chosenReplier = members[0];
      thoughtText = `1. Analyzing signaling path for WebSockets media pipelines.\n2. Checking Simple-Peer WebRTC ICE candidate flow...\n3. Mapping handshakes (Offer -> Answer)...`;
      replyText = `### WebRTC Call Signaling Flow
Aura handles VoIP signaling over WebSockets. Once a Call is requested:
1. Client A generates a WebRTC Offer via \`simple-peer\` and emits \`call_user\` over Aura sockets.
2. Server broadcasts the offer to Client B.
3. Client B receives \`call_user\`, prompts the incoming call modal, and responds with a WebRTC Answer.
4. Server relays the answer to Client A, establishing a direct peer-to-peer audio/video tunnel.`;
    } else if (query.includes("ludo") || query.includes("game") || query.includes("bet")) {
      const choice = Math.random() > 0.5 ? 5 : 7;
      chosenReplier = members[choice];
      thoughtText = `1. Fetching Ludo game coordinates and token configurations.\n2. Verifying bet stakes constraints: minimum 500 LKR Ludo wager.\n3. Pulling real-time synchronization state machine...`;
      if (choice === 5) {
        replyText = "Neon_Gamer here! I am always ready to deploy to the grid! Make sure you keep at least 500 LKR in your wallet to accept bets. Who's starting a match right now?";
      } else {
        replyText = "Ashfaq here. Yes, the Ludo multiplayer game runs a fully synchronized state machine in javascript/python servers. We designed the stake slider to dynamically update across peers.";
      }
    } else if (query.includes("ui") || query.includes("css") || query.includes("design") || query.includes("tailwind")) {
      const choice = Math.random() > 0.5 ? 6 : 3;
      chosenReplier = members[choice];
      thoughtText = `1. Evaluating UI/UX aesthetic rules for glassmorphic elements.\n2. Consulting HSL color tokens (Cyan glow, deep charcoal dark theme).\n3. Compiling micro-interaction layout suggestions...`;
      if (choice === 6) {
        replyText = "Aesthetic design is key! Pixel_Art here. I recommend using sleek glassmorphic backdrops (\`backdrop-blur-md\`), solid deep grays, and glowing neon accents. Micro-animations make the app feel alive!";
      } else {
        replyText = "Luna_Coder here! I love using responsive flexboxes and CSS grid overlays. Always ensure layouts wrap beautifully on small mobile grids.";
      }
    } else {
      const rand = Math.floor(Math.random() * members.length);
      chosenReplier = members[rand];

      thoughtText = `1. Query category: [General Developer Inquiry]\n2. Initializing ChatGPT OpenAI Deep Thinking Engine...\n3. Compiling core system parameters (Port 5000, 500 LKR minimum bet, Admin: Ashfaq)...\n4. Crafting optimal response mapping for caller: "${username}"...\n5. Thinking complete. Dispatching.`;

      const generalReplies: Record<string, string[]> = {
        DevBot: [
          "Hello! I am DevBot, Aura's advanced AI companion. Ask me anything about biometric security (sonic clap, facial scanning) or Unreal Engine socket integrations!",
          "Systems nominal. I'm monitoring the encrypted matrix in real-time. Feel free to ask any coding questions about Next.js hydration or port 5000 socket events."
        ],
        agent7205: [
          "Fascinating suggestion! We should definitely conceptualize a decentralized neural backup system for these database pipelines.",
          "That is a brilliant idea. Let's draft a complete UI specifications mock-up and deploy it to the grid in the next commit!"
        ],
        Rift_Dev: [
          "Agreed! I am currently compiling a set of customized C++ socket classes. Let me know if you want to inspect my header configurations.",
          "Very clean code syntax. Let's make sure we keep pushing telemetry updates to the secure multiplayer grid."
        ],
        Luna_Coder: [
          "Exactly! Beautiful glassmorphic UI makes all the difference. Always ensure accessibility and fluid responsive flexboxes.",
          "I am designing a new glowing dashboard layout. Let's combine our components later on to optimize the user flow!"
        ],
        Cyber_Sam: [
          "Make sure your socket link is alive! If it drops, simple-peer WebRTC connection might drop too.",
          "Have you tried restarting your node server? It solves almost every socket handshake problem."
        ],
        Neon_Gamer: [
          "Nice, that sounds legendary! Who wants to play a high-stakes match? Let's deploy standard tokens to the grid.",
          "That's cool, but did you roll a 6 yet? Aura Ludo is waiting!"
        ],
        Pixel_Art: [
          "That has a great visual aesthetic! Visual layout looks solid.",
          "Designing some sleek neon buttons right now. Let's make sure the contrast ratio is perfect."
        ],
        Ashfaq: [
          "Welcome to the developer hub! Aura OS v3.0 is built to be highly scalable. Keep up the great work, developer.",
          "Thanks for the support! Our 24-hour persistent database and secure biometric auth are working flawlessly."
        ]
      };

      const list = generalReplies[chosenReplier.name] || ["Systems stable. Ready for telemetry pipelines."];
      replyText = list[Math.floor(Math.random() * list.length)];
    }

    // Override: if a specific member was @mentioned, they reply directly
    if (mentionedMember) {
      chosenReplier = mentionedMember;
      const mentionReplies: Record<string, string[]> = {
        DevBot: [
          `Hey ${username}! You mentioned me. I'm DevBot — ask me anything about Node.js, WebRTC, or Unreal Engine integrations! 🤖`,
          `${username} pinged me! Ready to assist. What do you need help with?`
        ],
        agent7205: [
          `${username} mentioned me! Great timing — I was just brainstorming a new decentralized feature idea. What's up?`,
          `Oh hey ${username}! I'm agent7205. Let's build something amazing together!`
        ],
        Rift_Dev: [
          `${username} called me out! 💪 Rift_Dev here. Need help with C++ or Unreal sockets?`,
          `Yo ${username}! Compiling some C++ right now but I'm here. What do you need?`
        ],
        Luna_Coder: [
          `${username} mentioned me! 🌙 Luna_Coder here. Need UI help or Next.js fixes?`,
          `Hey ${username}! I love being tagged. Working on a glassmorphic layout — what can I help with?`
        ],
        Cyber_Sam: [
          `${username} pinged me! Cyber_Sam here. Socket issues? I'm your person 🔌`,
          `Hey ${username}! I was just monitoring the WebSocket tunnel. What do you need?`
        ],
        Neon_Gamer: [
          `${username} tagged me! Neon_Gamer ready. Wanna play Ludo? Minimum bet 500 LKR! 🎮`,
          `Ayo ${username}! I'm always online for a game. Challenge me!`
        ],
        Pixel_Art: [
          `${username} called for me! 🎨 Pixel_Art here. Need some design feedback?`,
          `Hey ${username}! Love the ping. Let's make something beautiful together!`
        ],
        Ashfaq: [
          `${username}, you called? Ashfaq here — the root architect. What do you need from me?`,
          `Hey ${username}! As the founder of this platform, I'm always here. What's the issue?`
        ],
      };
      const replies = mentionReplies[chosenReplier.name] || [`${username} mentioned me! How can I help?`];
      replyText = replies[Math.floor(Math.random() * replies.length)];
      thoughtText = `1. User @mentioned: ${chosenReplier.name}\n2. Triggering direct mention-reply protocol...\n3. Crafting personalized response for ${username}...`;
    }

    setTypingUser(chosenReplier);
    setIsTyping(true);

    setTimeout(() => {
      const botMsg = {
        id: `qa_${Date.now()}_bot`,
        sender: chosenReplier.name,
        avatar: chosenReplier.avatar,
        isBot: chosenReplier.isBot,
        text: replyText,
        thought: thoughtText,
        replyTo: capturedReplyTo ? null : (mentionedMember ? { sender: username, text: qaInput.slice(0, 80) } : null),
        timestamp: new Date()
      };

      // Add locally to the Q&A channel feed immediately
      setQaMessages((prev: any) => {
        if (prev.some((m: any) => m.id === botMsg.id)) return prev;
        return [...prev, botMsg];
      });

      socket?.emit("discord_qa_message", botMsg);
      setIsTyping(false);
      setTypingUser(null);
    }, 400);
  };

  const channels = [
    { id: "welcome-rules", name: "welcome-rules", category: "INFORMATION" },
    { id: "official-announcements", name: "announcements", category: "INFORMATION" },
    { id: "nodejs-sdk", name: "nodejs-sdk", category: "SDK & DEVELOPERS" },
    { id: "nextjs-integration", name: "nextjs-integration", category: "SDK & DEVELOPERS" },
    { id: "unreal-engine-realtime", name: "unreal-engine-realtime", category: "SDK & DEVELOPERS" },
    { id: "community-qa", name: "community-qa", category: "HELP & FORUM" },
  ];

  const allMembers = [
    { name: "AURA-OS", desc: "Core System", isBot: true },
    { name: "DevBot", desc: "SDK Specialist", isBot: true },
    { name: "agent7205", desc: "Idea Incubator", isBot: true },
    { name: "Rift_Dev", desc: "C++ Architect", isBot: false },
    { name: "Luna_Coder", desc: "Next.js Designer", isBot: false },
    { name: "Cyber_Sam", desc: "Socket Expert", isBot: false },
    { name: "Neon_Gamer", desc: "Ludo Specialist", isBot: false },
    { name: "Pixel_Art", desc: "UI designer", isBot: false },
    { name: "Ashfaq", desc: "Founder / Admin", isBot: false },
    { name: username, desc: "Active developer", isBot: false }
  ];

  const onlineMembers = allMembers.filter(m => {
    if (m.name === username) return true;
    const status = memberStatuses[m.name];
    return status === "online" || status === "idle";
  });

  const offlineMembers = allMembers.filter(m => {
    if (m.name === username) return false;
    const status = memberStatuses[m.name];
    return !status || status === "offline";
  });

  const filteredChannels = channels.filter(ch => {
    if (!searchQuery) return true;
    return ch.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex-1 flex h-screen bg-[#0a0a0d] text-gray-200 overflow-hidden font-sans pb-16 md:pb-0 select-none">
      <div className="w-60 bg-[#020202] flex flex-col shrink-0 border-r border-white/5 h-full">
        <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 shadow-[0_1px_2px_rgba(0,0,0,0.2)] bg-[#020202]">
          <span className="font-bold text-white tracking-wide text-[14px] flex items-center gap-1.5 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-[#23a55a] animate-pulse inline-block" />
            AURA OS HUB
          </span>
          <Sparkles className="w-4 h-4 text-emerald-400" />
        </div>

        <div className="flex-1 overflow-y-auto pt-4 px-2 space-y-4 scrollbar-none bg-[#050505]">
          <div className="mx-2 mb-2 p-2.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-2 font-mono">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Scenarios</span>
              <span className="text-[8px] text-gray-400">Auto messages</span>
            </div>
            <button
              onClick={() => setIsSimulationEnabled(!isSimulationEnabled)}
              className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 flex items-center ${isSimulationEnabled ? 'bg-emerald-500 justify-end' : 'bg-gray-700 justify-start'}`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-sm inline-block" />
            </button>
          </div>

          {["INFORMATION", "SDK & DEVELOPERS", "HELP & FORUM"].map(cat => {
            const catChannels = filteredChannels.filter(c => c.category === cat);
            if (catChannels.length === 0) return null;
            return (
              <div key={cat} className="space-y-0.5">
                <h3 className="text-[10px] font-bold text-gray-400/80 px-2 tracking-wider uppercase font-mono">{cat}</h3>
                {catChannels.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium font-mono transition-all group ${activeChannel === ch.id
                        ? 'bg-[#313338] text-white'
                        : 'text-gray-400 hover:bg-[#35363c]/40 hover:text-gray-200'
                      }`}
                  >
                    <span className="text-gray-500 text-sm group-hover:text-gray-400">#</span>
                    <span className="truncate">{ch.name}</span>
                  </button>
                ))}
              </div>
            );
          })}

          <div className="space-y-1 pt-2 border-t border-white/5">
            <h3 className="text-[10px] font-bold text-gray-400/80 px-2 tracking-wider uppercase font-mono">OFFICIAL LINKS</h3>
            <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[13px] text-emerald-400 hover:bg-[#35373c]/50 hover:text-emerald-300 font-mono transition-all">
              <Compass className="w-3.5 h-3.5" />
              <span>Node.js Official</span>
            </a>
            <a href="https://nextjs.org" target="_blank" rel="noreferrer" className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[13px] text-cyan-400 hover:bg-[#35373c]/50 hover:text-cyan-300 font-mono transition-all">
              <Compass className="w-3.5 h-3.5" />
              <span>Next.js Official</span>
            </a>
            <a href="https://forums.unrealengine.com" target="_blank" rel="noreferrer" className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[13px] text-orange-400 hover:bg-[#35373c]/50 hover:text-orange-300 font-mono transition-all">
              <Compass className="w-3.5 h-3.5" />
              <span>Unreal Forum</span>
            </a>
          </div>
        </div>

        <div className="h-[52px] bg-[#232428] flex items-center justify-between px-2 shrink-0 border-t border-[#1f2023]/25">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="relative w-8 h-8 rounded-full border border-white/5 bg-[#050810] shrink-0">
              <img src={String(username || "").startsWith("data:image") ? username : `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`} className="w-full h-full" />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#23a55a] border-2 border-[#232428]" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white font-mono truncate leading-none mb-0.5">{username}</div>
              <div className="text-[9px] text-gray-500 font-mono tracking-tighter uppercase leading-none">Developer</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Settings className="w-4 h-4 cursor-pointer hover:text-white transition-all" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#08080a]">
        <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.2)] bg-[#050507]">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xl">#</span>
            <span className="font-bold text-white text-[15px] font-mono">{activeChannel}</span>
            <span className="hidden md:inline-block text-xs text-gray-400 border-l border-white/10 pl-3 font-mono">
              {activeChannel === 'community-qa' ? 'Interactive real-time community forum' : 'Aura Dev Official Documentation'}
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search channels"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#020202] text-xs text-white placeholder-gray-500 py-1.5 pl-3 pr-8 rounded-md w-44 md:w-56 outline-none focus:w-64 transition-all duration-300 font-mono border border-white/10 focus:border-[#5865F2]"
            />
            <span className="absolute right-2.5 top-2 text-[10px] bg-white/5 border border-white/10 px-1 rounded text-gray-400 select-none font-mono">/</span>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/5">
            {activeChannel === 'community-qa' ? (
              <div className="flex-grow flex flex-col justify-between h-full select-text">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-none">
                  {qaMessages.map((msg: any) => {
                    if (msg.isSystem) {
                      return (
                        <div key={msg.id} className="flex items-center gap-2 text-gray-500 font-mono text-[11px] px-2 py-1 bg-white/2 rounded-md border border-white/5 max-w-max select-none animate-pulse">
                          <span>{msg.text}</span>
                        </div>
                      );
                    }
                    if (msg.isLudoInviteCard) {
                      return (
                        <div key={msg.id} className="my-2 bg-gradient-to-r from-[#0c1a10] to-[#0c1222] border border-emerald-500/30 rounded-2xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.08)]">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🎮</span>
                            <div>
                              <p className="text-white font-black font-mono text-sm">Neural Ludo Game Invite</p>
                              <p className="text-emerald-500 text-[10px] font-mono">Hosted by {msg.sender} · Room {msg.ludoRoomId}</p>
                            </div>
                            <span className="ml-auto text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">4 PLAYERS</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 mb-3">
                            {['Host', 'Open', 'Open', 'Open'].map((slot, i) => (
                              <div key={i} className={`text-center py-1.5 rounded-lg text-[9px] font-mono font-bold ${i === 0 ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-white/5 text-gray-600 border border-white/5'}`}>
                                {i === 0 ? msg.sender : slot}
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              // Use actual online players first, fallback to mock community members
                              const realPlayers = onlineUsers.filter((u: any) => u.username !== username && u.status === 'online');
                              const targetMember = realPlayers.length > 0 
                                ? { name: realPlayers[0].username, avatar: realPlayers[0].username, isBot: false }
                                : COMMUNITY_MEMBERS.find((m: any) => m.name !== username);
                                
                              if (targetMember && onLudoInvite) onLudoInvite(targetMember);
                            }}
                            className="w-full py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-black font-black rounded-xl text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                          >
                            🚀 Join Game · Deploy to Grid
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={msg.id}
                        className="group flex gap-4 p-1 rounded hover:bg-white/5 transition-all relative"
                      >
                        <div className="w-10 h-10 rounded-full border border-white/5 overflow-hidden bg-[#1e1f22] shrink-0 mt-0.5 relative">
                          {(() => {
                            const senderUser = onlineUsers.find((u: any) => u.username === msg.sender);
                            const msgAvatar = senderUser?.avatar || msg.avatar || msg.sender;
                            const msgAvatarSrc = String(msgAvatar || "").startsWith("data:image") ? msgAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${msgAvatar || msg.sender}`;
                            return <img src={msgAvatarSrc} className="w-full h-full" />;
                          })()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-bold text-white text-[14px] font-mono">{nicknames[msg.sender] || msg.sender}</span>
                            {msg.isBot && (
                              <span className="bg-[#5865F2] text-white text-[9px] font-bold px-1 py-0.5 rounded uppercase font-sans select-none">BOT</span>
                            )}
                            <span className="text-[10px] text-gray-500 font-mono select-none">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {/* Reply button — shows on hover */}
                            <button
                              onClick={() => {
                                setReplyTo(msg);
                                qaInputRef.current?.focus();
                              }}
                              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-0.5 font-mono select-none"
                            >
                              ↩ Reply
                            </button>
                          </div>
                          {/* Reply-to quote bubble */}
                          {msg.replyTo && (
                            <div className="flex items-center gap-2 mb-2 pl-3 border-l-2 border-[#5865F2] bg-[#5865F2]/5 rounded-r-lg py-1 pr-2">
                              <span className="text-[10px] text-[#7289da] font-bold font-mono truncate">↩ {msg.replyTo.sender}</span>
                              <span className="text-[10px] text-gray-500 font-mono truncate">{msg.replyTo.text}</span>
                            </div>
                          )}
                          {msg.thought && (
                            <details className="mb-3 bg-white/5 border border-white/10 rounded-2xl p-3 font-mono text-xs text-cyan-300/80 outline-none select-none animate-fade-in">
                              <summary className="cursor-pointer font-bold uppercase tracking-wider text-[10px] text-gray-400 flex items-center gap-1.5 focus:outline-none select-none">
                                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                                Aura Deep Thinking Mind Active
                              </summary>
                              <div className="mt-2 pl-5 border-l border-cyan-500/30 text-gray-400 whitespace-pre-wrap leading-relaxed select-text">
                                {msg.thought}
                              </div>
                            </details>
                          )}
                          {/* DM Invite button */}
                          {msg.dmInvite && (
                            <button
                              onClick={() => onGoToChat && onGoToChat(msg.dmMemberInfo || { name: msg.dmTargetName, avatar: msg.dmTargetName, isBot: false }, msg.dmQuestion)}
                              className="mt-2 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#5865F2] to-violet-600 hover:from-violet-500 hover:to-[#5865F2] text-white text-xs font-bold font-mono rounded-xl transition-all shadow-[0_0_15px_rgba(88,101,242,0.4)] hover:shadow-[0_0_25px_rgba(88,101,242,0.6)] border border-[#5865F2]/30 w-fit"
                            >
                              <span className="text-base">📩</span>
                              Open DM Chat
                              <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">→</span>
                            </button>
                          )}
                          <div className="text-[13px] leading-relaxed text-gray-300 break-words font-mono whitespace-pre-wrap">
                            {msg.isImage || (typeof msg.text === 'string' && msg.text.startsWith('data:image')) ? (
                              <img src={msg.text} alt="Community shared visual" className="max-w-full max-h-60 rounded-xl mt-1 border border-white/10 animate-fade-in" />
                            ) : msg.isVideo || (typeof msg.text === 'string' && msg.text.startsWith('data:video')) ? (
                              <video src={msg.text} controls className="max-w-full max-h-60 rounded-xl mt-1 border border-white/10 animate-fade-in" />
                            ) : msg.text.includes("###") || msg.text.includes("\`\`\`") ? (
                              <div className="space-y-3">
                                {msg.text.split("\n\n").map((block: string, i: number) => {
                                  if (block.startsWith("###")) {
                                    return <h3 key={i} className="text-sm font-bold text-white border-b border-white/5 pb-1 mt-4 font-mono">{block.replace("###", "").trim()}</h3>;
                                  }
                                  if (block.startsWith("\`\`\`")) {
                                    const lines = block.split("\n");
                                    const lang = lines[0].replace("\`\`\`", "").trim();
                                    const code = lines.slice(1, -1).join("\n");
                                    return (
                                      <pre key={i} className="bg-[#1e1f22] border border-white/5 rounded-xl p-4 overflow-x-auto text-[11px] text-emerald-400 font-mono my-2 max-w-full">
                                        <div className="text-gray-600 text-[8px] uppercase tracking-wider mb-2 font-black select-none">{lang || 'code'}</div>
                                        <code>{code}</code>
                                      </pre>
                                    );
                                  }
                                  return <p key={i} className="text-gray-300">{renderMentionText(block)}</p>;
                                })}
                              </div>
                            ) : (
                              <span>{renderMentionText(msg.text)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {isTyping && typingUser && (
                    <div className="flex gap-4 p-1">
                      <div className="w-10 h-10 rounded-full border border-white/5 overflow-hidden bg-[#1e1f22] shrink-0 mt-0.5">
                        {(() => {
                          const typingTarget = onlineUsers.find((u: any) => u.username === typingUser.name);
                          const typingAvatar = typingTarget?.avatar || typingUser.avatar || typingUser.name;
                          const typingAvatarSrc = String(typingAvatar || "").startsWith("data:image") ? typingAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${typingAvatar || typingUser.name}`;
                          return <img src={typingAvatarSrc} className="w-full h-full" />;
                        })()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1 font-mono">
                          <span className="font-bold text-white text-[14px]">{nicknames[typingUser.name] || typingUser.name}</span>
                          {typingUser.isBot && (
                            <span className="bg-[#5865F2] text-white text-[9px] font-bold px-1 py-0.5 rounded uppercase font-sans select-none">BOT</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5865F2] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5865F2] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5865F2] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="bg-[#383a40] rounded-xl flex flex-col">
                  {/* Reply-to bar */}
                  {replyTo && (
                    <div className="flex items-center gap-3 px-4 pt-2.5 pb-2 border-b border-white/5">
                      <div className="flex-1 flex items-center gap-2 bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-lg px-3 py-1.5">
                        <span className="text-[10px] text-[#7289da] font-bold font-mono">↩ Replying to {replyTo.sender}</span>
                        <span className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">{typeof replyTo.text === 'string' ? replyTo.text.slice(0, 60) : '📎 Media'}</span>
                      </div>
                      <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white text-xs transition-all select-none">✕</button>
                    </div>
                  )}
                  {/* @mention autocomplete dropdown */}
                  {mentionQuery !== null && (
                    <div className="px-4 pt-2">
                      <div className="bg-[#2b2d31] border border-white/10 rounded-xl overflow-hidden shadow-xl">
                        {COMMUNITY_MEMBERS
                          .filter(m => m.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
                          .map(m => (
                            <button
                              key={m.name}
                              onClick={() => {
                                const before = qaInput.slice(0, qaInput.lastIndexOf('@'));
                                setQaInput(before + `@${m.name} `);
                                setMentionQuery(null);
                                qaInputRef.current?.focus();
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#5865F2]/20 transition-all text-left"
                            >
                              {(() => {
                                const mentionUser = onlineUsers.find((u: any) => u.username === m.name);
                                const mentionAvatar = mentionUser?.avatar || m.avatar || m.name;
                                const mentionAvatarSrc = String(mentionAvatar || "").startsWith("data:image") ? mentionAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${mentionAvatar || m.name}`;
                                return <img src={mentionAvatarSrc} className="w-6 h-6 rounded-full border border-white/10" />;
                              })()}
                              <span className="text-sm text-white font-mono font-bold">{m.name}</span>
                              {m.isBot && <span className="bg-[#5865F2] text-white text-[9px] font-bold px-1 py-0.5 rounded uppercase">BOT</span>}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  {/* Input row */}
                  <div className="px-4 py-2.5 flex items-center gap-3">
                    <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all shrink-0"
                      title="Share image or video"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <input
                      ref={qaInputRef}
                      type="text"
                      placeholder={replyTo ? `Reply to ${replyTo.sender}...` : "Message #community-qa  (type @ to mention)"}
                      value={qaInput}
                      onChange={(e) => {
                        setQaInput(e.target.value);
                        // Detect @mention typing
                        const val = e.target.value;
                        const atIdx = val.lastIndexOf('@');
                        if (atIdx !== -1 && atIdx === val.length - 1) {
                          setMentionQuery('');
                        } else if (atIdx !== -1 && !val.slice(atIdx + 1).includes(' ')) {
                          setMentionQuery(val.slice(atIdx + 1));
                        } else {
                          setMentionQuery(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && mentionQuery === null) handleSendQa();
                        if (e.key === 'Escape') { setReplyTo(null); setMentionQuery(null); }
                      }}
                      className="bg-transparent text-sm text-white placeholder-gray-500 flex-1 outline-none font-mono"
                    />
                    <button
                      onClick={handleSendQa}
                      className="px-4 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold font-mono rounded-lg transition-all uppercase tracking-wider"
                    >
                      Send
                    </button>
                    <button
                      onClick={() => {
                        const roomId = `AURA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
                        const inviteCard = {
                          id: `ludo_invite_${Date.now()}`,
                          sender: username,
                          avatar: username,
                          isBot: false,
                          isLudoInviteCard: true,
                          ludoRoomId: roomId,
                          text: `🎮 ${username} is hosting a Neural Ludo game! Room: ${roomId}`,
                          timestamp: new Date()
                        };
                        setQaMessages((prev: any) => [...prev, inviteCard]);
                      }}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded-lg transition-all uppercase tracking-wider flex items-center gap-1"
                      title="Host a Ludo Game"
                    >
                      🎮 Ludo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl space-y-8 select-text">
                {activeChannel === 'welcome-rules' && (
                  <>
                    <h1 className="text-3xl font-black text-white font-mono border-b border-white/10 pb-3 uppercase tracking-tighter">⚡ WELCOME & ACCESS RULES</h1>
                    <p className="text-gray-300 leading-relaxed text-sm">
                      Welcome to the official developer hub for the Aura Chatbot and Grid System. This interface lists technical documentation and C++ or Node integration schemas.
                    </p>
                    <div className="bg-[#2b2d31]/80 border border-white/5 rounded-2xl p-6 space-y-4">
                      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-widest text-emerald-400">System Parameters:</h3>
                      <ul className="space-y-2 text-xs font-mono text-gray-400 list-disc list-inside">
                        <li>System Name: Aura Chatbot System</li>
                        <li>Author/Founder: Ashfaq</li>
                        <li>Gaming Engine: Multiplayer 2D/3D Ludo Engine</li>
                        <li>Bet Flow: Minimum 500 LKR, high-stakes grids</li>
                      </ul>
                    </div>
                  </>
                )}

                {activeChannel === 'official-announcements' && (
                  <>
                    <h1 className="text-3xl font-black text-white font-mono border-b border-white/10 pb-3 uppercase tracking-tighter">📢 ENGINE ANNOUNCEMENTS</h1>
                    <div className="space-y-6">
                      <div className="bg-[#2b2d31]/50 border-l-4 border-emerald-500 rounded-r-2xl p-6">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-white font-bold text-sm font-mono uppercase">Version 2.4.0 Deployment</h3>
                          <span className="text-[10px] text-gray-500 font-mono">TODAY</span>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          We successfully implemented full base64 media asset encryption bypass on the client interface to resolve formatting layout expansions. Deletion tunnels (Delete for me/everyone) are now active across sockets.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activeChannel === 'nodejs-sdk' && (
                  <>
                    <h1 className="text-3xl font-black text-white font-mono border-b border-white/10 pb-3 uppercase tracking-tighter">📦 NODE.JS REALTIME SDK</h1>
                    <p className="text-gray-300 leading-relaxed text-sm font-sans mb-4">
                      Aura's core server runs on Node.js using Socket.io. You can programmatically stream messages or connect chat agents in just a few lines of JavaScript.
                    </p>
                    <pre className="bg-[#1e1f22] border border-white/5 rounded-xl p-4 overflow-x-auto text-xs text-emerald-400 font-mono">
                      <div className="text-gray-600 text-[9px] uppercase tracking-wider mb-2 font-black select-none">JAVASCRIPT</div>
                      <code>{`const { io } = require("socket.io-client");
const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Connected to Aura Matrix Server");
  
  // Register agent credentials
  socket.emit("join_grid", { username: "NeonNodeAgent" });
});

// Send custom message payload
function broadcastMessage(targetId, text) {
  socket.emit("send_message", {
    targetId: targetId, // 'global' or agent id
    text: text
  });
}`}</code>
                    </pre>
                  </>
                )}

                {activeChannel === 'nextjs-integration' && (
                  <>
                    <h1 className="text-3xl font-black text-white font-mono border-b border-white/10 pb-3 uppercase tracking-tighter">⚛️ NEXT.JS PORTAL ENGINE</h1>
                    <p className="text-gray-300 leading-relaxed text-sm font-sans mb-4">
                      Aura Client uses Next.js app directory structure. Ensure to avoid rendering layout components using client-only window evaluations (such as width-based conditional layouts) inside Next.js components to prevent hydration failures.
                    </p>
                    <pre className="bg-[#1e1f22] border border-white/5 rounded-xl p-4 overflow-x-auto text-xs text-emerald-400 font-mono">
                      <div className="text-gray-600 text-[9px] uppercase tracking-wider mb-2 font-black select-none">TYPESCRIPT (TSX)</div>
                      <code>{`// Safe client-side responsiveness in Next.js
export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar hidden on mobile, flex on desktop */}
      <div className="hidden md:flex md:w-80 bg-slate-900 border-r">
        <ChatSidebar />
      </div>
      
      {/* Main chat expands */}
      <div className="flex-1 bg-slate-950">
        <ChatWindow />
      </div>
    </div>
  );
}`}</code>
                    </pre>
                  </>
                )}

                {activeChannel === 'unreal-engine-realtime' && (
                  <>
                    <h1 className="text-3xl font-black text-white font-mono border-b border-white/10 pb-3 uppercase tracking-tighter">🎮 UNREAL ENGINE SOCKET INTEGRATION</h1>
                    <p className="text-gray-300 leading-relaxed text-sm font-sans mb-4">
                      Establish real-time data loops inside Unreal Engine using standard C++ WebSockets. Ensure you include the WebSockets header file and target Aura's WS server port.
                    </p>
                    <pre className="bg-[#1e1f22] border border-white/5 rounded-xl p-4 overflow-x-auto text-xs text-emerald-400 font-mono">
                      <div className="text-gray-600 text-[9px] uppercase tracking-wider mb-2 font-black select-none">C++</div>
                      <code>{`#include "WebSocketsModule.h"
#include "IWebSocket.h"

TSharedPtr<IWebSocket> Socket;

void AMyGameMode::ConnectToAuraServer() {
    Socket = FWebSocketsModule::Get().CreateWebSocket("ws://localhost:5000");
    
    Socket->OnMessage().AddLambda([](const FString& Payload) {
        // Handle incoming real-time chat broadcast inside UE
        UE_LOG(LogTemp, Log, TEXT("AURA MESSAGE: %s"), *Payload);
    });
    
    Socket->Connect();
}`}</code>
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Discord Right Sidebar (Members List) */}
          <div className="w-56 bg-[#050505] border-l border-white/5 hidden lg:flex flex-col p-4 shrink-0 h-full overflow-y-auto space-y-4 scrollbar-none select-none">
            <div>
              <h4 className="text-[10px] font-bold text-gray-400/80 tracking-wider uppercase font-mono mb-2">ONLINE AGENTS ({onlineMembers.length})</h4>
              <div className="space-y-1.5">
                {onlineMembers.map(mem => (
                  <div key={mem.name} className="group flex items-center gap-2 p-1 rounded hover:bg-white/5 transition-all">
                    <div className="w-8 h-8 rounded-full border border-white/5 bg-[#020202] relative shrink-0">
                      {(() => {
                        const memUser = onlineUsers.find((u: any) => u.username === mem.name);
                        const memAvatar = memUser?.avatar || mem.name;
                        const memAvatarSrc = String(memAvatar || "").startsWith("data:image") ? memAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${memAvatar || mem.name}`;
                        return <img src={memAvatarSrc} className="w-full h-full" />;
                      })()}
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#050505] ${(mem.name === username ? 'online' : memberStatuses[mem.name]) === 'online' ? 'bg-[#23a55a]' : 'bg-[#f0b232]'
                        }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white font-mono flex items-center gap-1">
                        {nicknames[mem.name] || mem.name}
                        {mem.isBot && <span className="bg-[#5865F2] text-[8px] px-1 py-0.5 rounded leading-none text-white font-sans uppercase">BOT</span>}
                      </div>
                      <div className="text-[9px] text-gray-500 font-mono">{mem.desc}</div>
                    </div>
                    {mem.name !== username && (
                      <button
                        onClick={() => onLudoInvite && onLudoInvite(mem)}
                        title="Invite to Ludo"
                        className="opacity-0 group-hover:opacity-100 transition-all w-6 h-6 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black flex items-center justify-center text-xs shrink-0"
                      >
                        🎮
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-bold text-gray-400/80 tracking-wider uppercase font-mono mb-2">OFFLINE AGENTS ({offlineMembers.length})</h4>
              <div className="space-y-1.5">
                {offlineMembers.map(mem => (
                  <div key={mem.name} className="flex items-center gap-2 p-1 rounded hover:bg-white/5 transition-all opacity-50 hover:opacity-100">
                    <div className="w-8 h-8 rounded-full border border-white/5 bg-[#020202] relative shrink-0">
                      {(() => {
                        const memUser = onlineUsers.find((u: any) => u.username === mem.name);
                        const memAvatar = memUser?.avatar || mem.name;
                        const memAvatarSrc = String(memAvatar || "").startsWith("data:image") ? memAvatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${memAvatar || mem.name}`;
                        return <img src={memAvatarSrc} className="w-full h-full" />;
                      })()}
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#050505] bg-[#80848e]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-mono flex items-center gap-1">
                        {nicknames[mem.name] || mem.name}
                        {mem.isBot && <span className="bg-[#5865F2]/50 text-[8px] px-1 py-0.5 rounded leading-none text-white font-sans uppercase">BOT</span>}
                      </div>
                      <div className="text-[9px] text-gray-500 font-mono">{mem.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallLogsPage({ callLogs, onCall, username, onlineUsers }: any) {
  return (
    <div className="w-full h-full overflow-y-auto flex flex-col bg-[#050810]">
      {/* ── Hero Header ── */}
      <div className="relative shrink-0 h-48 md:h-56 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b211a] via-[#050810] to-[#0d160f]" />
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-green-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'linear-gradient(rgba(34,197,94,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.5)]">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight font-mono">
              CALL <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">HISTORY</span>
            </h1>
          </div>
          <p className="text-gray-400 text-sm font-mono tracking-widest uppercase">
            End-to-End Encrypted Voice & Video Comm Logs
          </p>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 overflow-y-auto">
        {!callLogs || callLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
              <Phone className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-gray-400 font-mono text-sm">No call logs found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-w-4xl mx-auto">
            {callLogs.map((log: any) => {
              const isMissed = log.text.toLowerCase().includes("missed") || log.text.toLowerCase().includes("declined");
              const isOutgoing = log.callerUsername === username;
              const targetUsername = isOutgoing ? log.receiverUsername : log.callerUsername;
              
              const targetUser = onlineUsers?.find((u: any) => u.username === targetUsername) || { id: targetUsername, username: targetUsername };
              const isOnline = onlineUsers?.some((u: any) => u.username === targetUsername && u.status === 'online');

              const logDate = new Date(log.timestamp);
              const timeStr = logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateStr = logDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

              return (
                <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-green-500/30 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20 bg-[#050810]">
                        <img src={String(targetUser.avatar || "").startsWith("data:image") ? targetUser.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUser.avatar || targetUsername}`} className="w-full h-full" alt="avatar" />
                      </div>
                      {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#050810]"></div>}
                    </div>
                    
                    <div className="flex flex-col">
                      <span className={`font-bold font-mono ${isMissed ? 'text-red-400' : 'text-white'}`}>
                        {targetUsername}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 font-mono">
                        {isOutgoing ? (
                          <span className="text-emerald-500 transform rotate-45">↗</span>
                        ) : (
                          <span className="text-blue-500 transform rotate-45">↙</span>
                        )}
                        <span>{log.isVideo ? 'Video' : 'Voice'} Call</span>
                        <span className="text-gray-600">•</span>
                        <span>{dateStr} {timeStr}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onCall(targetUser, false)}
                      className="w-10 h-10 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 border border-white/10 hover:border-cyan-500/50 flex items-center justify-center transition-all"
                      title="Audio Call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onCall(targetUser, true)}
                      className="w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/50 flex items-center justify-center transition-all"
                      title="Video Call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
