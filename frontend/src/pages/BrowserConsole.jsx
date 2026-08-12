import { useState, useEffect, useRef, useCallback } from "react";
import { http } from "../lib/api";
import { toast } from "../components/Toast";
import ReactMarkdown from "react-markdown";
import {
  Globe, Play, Loader, Copy, RefreshCw, Search, Mic, Camera,
  ChevronRight, X, Clock, Bookmark, Sparkles, Zap, Star,
  MapPin, ArrowLeft, ArrowRight, RotateCcw, Shield, Wand2, Download,
  ImageIcon, CheckCircle, AlertCircle, Trash2
} from "lucide-react";

const QUICK_SITES = [
  { label: "YouTube",   url: "https://youtube.com",       bg: "#FF0000", icon: "▶" },
  { label: "Google",    url: "https://google.com",        bg: "#4285F4", icon: "G" },
  { label: "GitHub",    url: "https://github.com",        bg: "#24292e", icon: "⌥" },
  { label: "Wikipedia", url: "https://wikipedia.org",     bg: "#f8f9fa", icon: "W", dark: true },
  { label: "Gmail",     url: "https://mail.google.com",   bg: "#EA4335", icon: "M" },
  { label: "Drive",     url: "https://drive.google.com",  bg: "#0F9D58", icon: "△" },
];

const AI_SUGGESTIONS = [
  { label: "Best AI tools in 2025",  icon: "🤖" },
  { label: "Top Tech News Today",    icon: "📰" },
  { label: "Latest Space Updates",   icon: "🚀" },
  { label: "Stock Market Live",      icon: "📈" },
];

const INITIAL_RECENTS = [
  "Artificial Intelligence",
  "Quantum Computing",
  "NASA Latest Updates",
  "Elon Musk News",
  "Python Programming",
];

const BOOKMARKS = [
  { label: "AI OS Dashboard",     icon: "🖥", url: "/" },
  { label: "Research Paper.pdf",  icon: "📄", url: "#" },
  { label: "My Projects",         icon: "📁", url: "#" },
  { label: "Code Repository",     icon: "💻", url: "https://github.com" },
];

// Fallback static trending (used if live fetch fails)
const TRENDING_FALLBACK = [
  { category: "Technology", cc: "#a78bfa", title: "AI Breakthrough in 2025 Shocks the World",  time: "2 hours ago", img: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=320&h=180&fit=crop", url: "https://news.google.com/search?q=AI+breakthrough+2025" },
  { category: "Science",    cc: "#34d399", title: "New Exoplanet Discovered Beyond Milky Way",  time: "4 hours ago", img: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=320&h=180&fit=crop", url: "https://news.google.com/search?q=exoplanet+discovery" },
  { category: "India",      cc: "#f87171", title: "India Launches New Satellite Mission",        time: "6 hours ago", img: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=320&h=180&fit=crop", url: "https://news.google.com/search?q=India+satellite+mission" },
  { category: "Climate",    cc: "#fbbf24", title: "Record Temperatures Hit Multiple Continents", time: "8 hours ago", img: "https://images.unsplash.com/photo-1504608524841-42584120d693?w=320&h=180&fit=crop", url: "https://news.google.com/search?q=climate+record+temperatures" },
  { category: "Space",      cc: "#60a5fa", title: "SpaceX Starship Completes Full Orbital Test", time: "10 hours ago", img: "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=320&h=180&fit=crop", url: "https://news.google.com/search?q=SpaceX+Starship+orbital" },
  { category: "Business",   cc: "#34d399", title: "Global Markets Rally on Strong Jobs Report",  time: "12 hours ago", img: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=320&h=180&fit=crop", url: "https://news.google.com/search?q=global+markets+jobs+report" },
];

// Category color map for live news
const CAT_COLORS = {
  "technology": "#a78bfa", "science": "#34d399", "health": "#f472b6",
  "business": "#fbbf24",   "sports": "#60a5fa",  "entertainment": "#fb923c",
  "world": "#94a3b8",      "india": "#f87171",   "politics": "#f87171",
  "space": "#60a5fa",      "climate": "#34d399",  "default": "#a78bfa",
};

const SEARCH_TABS = ["All", "Images", "Videos", "News", "Maps", "Shopping", "More"];

export default function BrowserConsole() {
  const [searchQuery, setSearchQuery]     = useState("");
  const [activeSearchTab, setActiveSearchTab] = useState("All");
  const [recents, setRecents]             = useState(INITIAL_RECENTS);
  const [currentTime, setCurrentTime]     = useState(new Date());
  const [showPlanner, setShowPlanner]     = useState(false);
  const [trending, setTrending]           = useState(TRENDING_FALLBACK);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Custom Quick Access sites (persisted to localStorage)
  const [quickSites, setQuickSites] = useState(() => {
    try {
      const saved = localStorage.getItem("nx_quick_sites");
      return saved ? JSON.parse(saved) : QUICK_SITES;
    } catch { return QUICK_SITES; }
  });

  // Add-site modal state
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteUrl, setNewSiteUrl]   = useState("");
  const [newSiteIcon, setNewSiteIcon] = useState("🌐");
  const [newSiteBg, setNewSiteBg]     = useState("#6E56FF");
  const [hoveredSite, setHoveredSite] = useState(null);

  // URL nav bar history
  const [navUrl, setNavUrl]             = useState("nexus://os/browser");
  const [navInput, setNavInput]         = useState("");
  const [navHistory, setNavHistory]     = useState(["nexus://os/browser"]);
  const [navIndex, setNavIndex]         = useState(0);

  const [showImgGen, setShowImgGen]       = useState(false);

  // Image generation state
  const [imgPrompt, setImgPrompt]         = useState("");
  const [imgStyle, setImgStyle]           = useState("photorealistic");
  const [imgWidth, setImgWidth]           = useState(1024);
  const [imgHeight, setImgHeight]         = useState(768);
  const [imgGenerating, setImgGenerating] = useState(false);
  const [imgGallery, setImgGallery]       = useState([]);
  const [imgError, setImgError]           = useState("");

  const [goal, setGoal]             = useState("");
  const [startUrl, setStartUrl]     = useState("");
  const [plan, setPlan]             = useState("");
  const [loading, setLoading]       = useState(false);
  const [fetchResult, setFetchResult] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [activeTab, setActiveTab]   = useState("metadata");

  // Voice search state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Camera search state
  const [showCamera, setShowCamera]   = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Stop camera stream when component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    };
  }, [cameraStream]);

  // ── Voice Search (Web Speech API) ──────────────────────────────────────
  const startVoiceSearch = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error("Voice search not supported in this browser. Try Chrome."); return; }
    if (isListening) {
      try { recognitionRef.current && recognitionRef.current.stop(); } catch {}
      setIsListening(false);
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart  = () => { setIsListening(true); toast.info("Listening… speak now!"); };
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
      // Auto-search after voice input
      setTimeout(() => {
        if (transcript.trim()) {
          openSearch(transcript.trim(), activeSearchTab);
        }
      }, 400);
    };
    rec.onerror  = (e) => {
      setIsListening(false);
      if (e.error === "no-speech") toast.warn("No speech detected. Try again.");
      else if (e.error === "not-allowed") toast.error("Microphone access denied. Allow mic in browser settings.");
      else toast.error("Voice error: " + e.error);
    };
    rec.onend = () => setIsListening(false);
    rec.start();
  }, [isListening, activeSearchTab]);

  // ── Camera Search (getUserMedia + Google Lens) ─────────────────────────
  const openCameraSearch = useCallback(async () => {
    setCapturedPhoto(null);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setCameraStream(stream);
      // Attach stream to video element (after modal renders)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 150);
    } catch (err) {
      setShowCamera(false);
      if (err.name === "NotAllowedError") toast.error("Camera access denied. Allow camera in browser settings.");
      else toast.error("Could not open camera: " + err.message);
    }
  }, []);

  const closeCameraModal = useCallback(() => {
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCapturedPhoto(null);
    setShowCamera(false);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width  = v.videoWidth  || 640;
    c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    setCapturedPhoto(dataUrl);
    // Stop camera after capture
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    setCameraStream(null);
  }, [cameraStream]);

  const searchWithLens = useCallback(() => {
    // Open Google Lens where user can upload the captured photo manually
    window.open("https://lens.google.com/", "_blank", "noopener");
    toast.info("Google Lens opened — paste or drag your captured photo there!");
  }, []);

  // ── URL Navigation helpers ─────────────────────────────────────────────
  const navigate = (url) => {
    if (!url || url === navUrl) return;
    // Trim forward history when branching
    const newHistory = [...navHistory.slice(0, navIndex + 1), url];
    setNavHistory(newHistory);
    setNavIndex(newHistory.length - 1);
    setNavUrl(url);
    setNavInput("");
    // Open the URL in a new tab unless it's a nexus:// internal URL
    if (!url.startsWith("nexus://")) {
      let full = url;
      if (!full.startsWith("http://") && !full.startsWith("https://")) full = "https://" + full;
      window.open(full, "_blank", "noopener noreferrer");
    }
  };

  const navBack = () => {
    if (navIndex <= 0) return;
    const newIdx = navIndex - 1;
    setNavIndex(newIdx);
    setNavUrl(navHistory[newIdx]);
    setNavInput("");
    if (!navHistory[newIdx].startsWith("nexus://")) {
      window.open(navHistory[newIdx], "_blank", "noopener noreferrer");
    }
  };

  const navForward = () => {
    if (navIndex >= navHistory.length - 1) return;
    const newIdx = navIndex + 1;
    setNavIndex(newIdx);
    setNavUrl(navHistory[newIdx]);
    setNavInput("");
    if (!navHistory[newIdx].startsWith("nexus://")) {
      window.open(navHistory[newIdx], "_blank", "noopener noreferrer");
    }
  };

  const navReload = () => {
    if (navUrl.startsWith("nexus://")) {
      toast.info("Reloading NEXUS browser home…");
      window.location.reload();
    } else {
      toast.info("Reloading: " + navUrl);
      window.open(navUrl, "_blank", "noopener noreferrer");
    }
  };

  const handleNavSubmit = (e) => {
    e.preventDefault();
    const q = navInput.trim();
    if (!q) return;
    // Detect URL vs search query
    const looksLikeUrl = /^(https?:\/\/|www\.)|(\.[a-z]{2,}(\/|$))/i.test(q);
    if (looksLikeUrl) {
      navigate(q);
    } else {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      navigate(searchUrl);
    }
  };

  // Persist quick sites to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem("nx_quick_sites", JSON.stringify(quickSites)); } catch {}
  }, [quickSites]);

  // Add Site helpers
  const ICON_PRESETS = ["🌐","🎮","📧","🛒","📰","🎵","🎬","📸","💼","🏦","📚","🔬","🏠","✈","🍕","⚽","🤖","💻","🔗","🌍"];
  const COLOR_PRESETS = ["#6E56FF","#00F5FF","#f472b6","#34d399","#fbbf24","#f87171","#60a5fa","#fb923c","#a78bfa","#4285F4","#FF0000","#0F9D58","#EA4335","#24292e","#1DA1F2"];

  const addSite = () => {
    if (!newSiteName.trim() || !newSiteUrl.trim()) { toast.error("Please fill in both Name and URL"); return; }
    let url = newSiteUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
    const site = { label: newSiteName.trim(), url, icon: newSiteIcon, bg: newSiteBg, custom: true };
    setQuickSites(s => [...s, site]);
    setShowAddSite(false);
    setNewSiteName(""); setNewSiteUrl(""); setNewSiteIcon("🌐"); setNewSiteBg("#6E56FF");
    toast.success(`"${site.label}" added to Quick Access!`);
  };

  const removeSite = (idx) => {
    setQuickSites(s => s.filter((_, i) => i !== idx));
    toast.info("Site removed");
  };

  // Fetch live trending news from Google News RSS via rss2json
  const fetchTrending = async () => {
    setTrendingLoading(true);
    try {
      const feeds = [
        { url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZxYUdjU0FtVnVHZ0pKVGlnQVAB", label: "Top Stories" },
        { url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pKVGlnQVAB", label: "Technology" },
      ];
      const feed = feeds[Math.floor(Math.random() * feeds.length)];
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=6`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.status === "ok" && data.items && data.items.length > 0) {
        const unsplashFallbacks = [
          "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=320&h=180&fit=crop",
          "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=320&h=180&fit=crop",
          "https://images.unsplash.com/photo-1504608524841-42584120d693?w=320&h=180&fit=crop",
          "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=320&h=180&fit=crop",
          "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=320&h=180&fit=crop",
          "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=320&h=180&fit=crop",
        ];
        const items = data.items.slice(0, 6).map((item, idx) => {
          const cats = (item.categories || []);
          const cat = cats[0] || "World";
          const catKey = cat.toLowerCase();
          const cc = CAT_COLORS[catKey] || CAT_COLORS.default;
          // Time formatting
          const pub = new Date(item.pubDate);
          const diffMin = Math.round((Date.now() - pub.getTime()) / 60000);
          const timeStr = diffMin < 60 ? `${diffMin}m ago` : diffMin < 1440 ? `${Math.round(diffMin/60)}h ago` : `${Math.round(diffMin/1440)}d ago`;
          // Image: use enclosure, or thumbnail, or fallback
          const img = (item.enclosure?.link) || item.thumbnail || unsplashFallbacks[idx % unsplashFallbacks.length];
          return { category: cat, cc, title: item.title, time: timeStr, img, url: item.link };
        });
        setTrending(items);
      }
    } catch (err) {
      // Keep fallback data on error
      console.warn("Trending news fetch failed, using fallback:", err.message);
    }
    setTrendingLoading(false);
  };

  useEffect(() => { fetchTrending(); }, []);

  const fmtTime = (d) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const fmtDate = (d) => d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Map search tabs to Google URL builders
  const TAB_URLS = {
    "All":      (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    "Images":   (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=isch`,
    "Videos":   (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=vid`,
    "News":     (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=nws`,
    "Maps":     (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)}`,
    "Shopping": (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=shop`,
    "More":     (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  };

  const openSearch = (q, tab) => {
    const t = tab || activeSearchTab;
    const urlFn = TAB_URLS[t] || TAB_URLS["All"];
    if (!recents.includes(q)) setRecents(r => [q, ...r.slice(0, 4)]);
    const url = urlFn(q);
    // Push to nav history
    setNavHistory(h => { const nh = [...h.slice(0, navIndex + 1), url]; setNavIndex(nh.length - 1); setNavUrl(url); return nh; });
    window.open(url, "_blank", "noopener");
    toast.success(`Searching ${t !== "All" ? t + " for" : "for"} "${q}"…`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    openSearch(searchQuery.trim(), activeSearchTab);
  };

  const handleTabClick = (tab) => {
    setActiveSearchTab(tab);
    if (searchQuery.trim()) {
      openSearch(searchQuery.trim(), tab);
    } else {
      const fallbacks = {
        "Images":   "https://images.google.com",
        "Videos":   "https://www.google.com/videohp",
        "News":     "https://news.google.com",
        "Maps":     "https://maps.google.com",
        "Shopping": "https://shopping.google.com",
      };
      if (fallbacks[tab]) {
        window.open(fallbacks[tab], "_blank", "noopener");
        toast.info(`Opening Google ${tab}…`);
      }
    }
  };

  const generate = async () => {
    if (!goal.trim()) { toast.error("Please describe a goal"); return; }
    setLoading(true); setPlan("");
    try {
      const r = await http.post("/browser/plan", { goal, start_url: startUrl || undefined });
      setPlan(r.data.plan);
    } catch { toast.error("Failed to generate plan — is the backend running?"); }
    setLoading(false);
  };

  const fetchPage = async () => {
    if (!startUrl.trim()) { toast.error("Please enter a Start URL to fetch"); return; }
    setFetching(true); setFetchResult(null);
    try {
      const r = await http.get(`/browser/fetch?url=${encodeURIComponent(startUrl)}`);
      setFetchResult(r.data);
      toast.success("Page fetched successfully!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to fetch page");
    }
    setFetching(false);
  };

  // ── Image Generation via Pollinations.ai (free, no API key) ──────────────
  const IMG_STYLES = [
    { id: "photorealistic", label: "Photorealistic" },
    { id: "anime",          label: "Anime" },
    { id: "digital-art",    label: "Digital Art" },
    { id: "oil-painting",   label: "Oil Painting" },
    { id: "watercolor",     label: "Watercolor" },
    { id: "cyberpunk",      label: "Cyberpunk" },
    { id: "fantasy",        label: "Fantasy" },
    { id: "minimalist",     label: "Minimalist" },
  ];

  const buildImgUrl = (prompt, style, w, h, seed) => {
    const styleMap = {
      "anime":       "anime, vibrant colors",
      "digital-art": "digital art, trending on artstation",
      "oil-painting":"oil painting, impressionist, textured",
      "watercolor":  "watercolor painting, soft colors",
      "cyberpunk":   "cyberpunk, neon lights, futuristic city",
      "fantasy":     "fantasy art, magical, epic",
      "minimalist":  "minimalist design, clean, simple",
    };
    const styleTag = styleMap[style] || "";
    const full = styleTag ? `${prompt}, ${styleTag}` : prompt;
    const encoded = encodeURIComponent(full);
    const s = seed || Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&seed=${s}&nologo=true&model=flux`;
  };

  const generateImage = async () => {
    if (!imgPrompt.trim()) { toast.error("Please enter a prompt first!"); return; }
    setImgGenerating(true);
    setImgError("");
    const seed = Math.floor(Math.random() * 999999);
    const url = buildImgUrl(imgPrompt.trim(), imgStyle, imgWidth, imgHeight, seed);
    const entry = { id: seed, url, prompt: imgPrompt.trim(), style: imgStyle, w: imgWidth, h: imgHeight, loading: true, failed: false, ts: Date.now() };
    setImgGallery(g => [entry, ...g.slice(0, 11)]);
    setImgGenerating(false);
    toast.success("Image generating… it will appear shortly!");
  };

  const downloadImg = async (url, prompt) => {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = prompt.slice(0, 40).replace(/[^a-z0-9]/gi, "_") + ".jpg";
      a.target = "_blank";
      a.click();
    } catch { toast.error("Download failed. Right-click the image to save."); }
  };

  const iS = { width: "100%", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 12, fontFamily: "monospace", outline: "none" };

  return (
    <div style={{ position: "relative", color: "#e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>

      {/* ===== Browser Chrome Bar ===== */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(8,12,24,0.97)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: "8px 8px 0 0", padding: "7px 16px", fontSize: 12, color: "#00F5FF", fontFamily: "monospace", fontWeight: 600 }}>
          <Globe style={{ width: 13, height: 13 }} /> AI Browser
          <span style={{ marginLeft: 4, fontSize: 9, color: "rgba(148,163,184,0.4)", cursor: "pointer" }}>✕</span>
        </div>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(148,163,184,0.4)", fontSize: 14 }}>+</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,rgba(0,245,255,0.18),rgba(110,86,255,0.18))", border: "1px solid rgba(0,245,255,0.3)", borderRadius: 8, padding: "5px 13px", fontSize: 12, fontWeight: 700, color: "#00F5FF", cursor: "pointer", fontFamily: "monospace" }}>
            <Globe style={{ width: 11, height: 11 }} /> AI Assistant
          </div>
          <span style={{ fontSize: 16, cursor: "pointer", opacity: 0.7 }}>🎙</span>
          <span style={{ fontSize: 16, cursor: "pointer", opacity: 0.7 }}>🔔</span>
          <span style={{ fontSize: 16, cursor: "pointer", opacity: 0.7 }}>⚙</span>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#00F5FF,#6E56FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
        </div>
      </div>

      {/* ===== URL / Nav Bar ===== */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(10,15,30,0.98)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "6px 14px" }}>
        {/* Back */}
        <button
          onClick={navBack}
          disabled={navIndex <= 0}
          title="Go back"
          style={{ width: 26, height: 26, borderRadius: 6, background: "none", border: "none", cursor: navIndex <= 0 ? "not-allowed" : "pointer", color: navIndex <= 0 ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.65)", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s" }}
          onMouseEnter={e => { if (navIndex > 0) e.currentTarget.style.color = "#00F5FF"; }}
          onMouseLeave={e => { e.currentTarget.style.color = navIndex <= 0 ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.65)"; }}
        ><ArrowLeft style={{ width: 13, height: 13 }} /></button>
        {/* Forward */}
        <button
          onClick={navForward}
          disabled={navIndex >= navHistory.length - 1}
          title="Go forward"
          style={{ width: 26, height: 26, borderRadius: 6, background: "none", border: "none", cursor: navIndex >= navHistory.length - 1 ? "not-allowed" : "pointer", color: navIndex >= navHistory.length - 1 ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.65)", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s" }}
          onMouseEnter={e => { if (navIndex < navHistory.length - 1) e.currentTarget.style.color = "#00F5FF"; }}
          onMouseLeave={e => { e.currentTarget.style.color = navIndex >= navHistory.length - 1 ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.65)"; }}
        ><ArrowRight style={{ width: 13, height: 13 }} /></button>
        {/* Reload */}
        <button
          onClick={navReload}
          title="Reload page"
          style={{ width: 26, height: 26, borderRadius: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.65)", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = "#00F5FF"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(148,163,184,0.65)"}
        ><RotateCcw style={{ width: 13, height: 13 }} /></button>
        {/* URL Bar */}
        <form onSubmit={handleNavSubmit} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 12px" }}>
          <Shield style={{ width: 11, height: 11, color: "#34d399", flexShrink: 0 }} />
          <input
            value={navInput || navUrl}
            onChange={e => setNavInput(e.target.value)}
            onFocus={e => { setNavInput(navUrl); e.target.select(); }}
            onBlur={() => setNavInput("")}
            placeholder="Search or type URL…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 12, fontFamily: "monospace", color: "rgba(148,163,184,0.75)" }}
          />
          <Star style={{ width: 11, height: 11, color: "rgba(148,163,184,0.25)", cursor: "pointer" }} />
          <Globe style={{ width: 11, height: 11, color: "#6E56FF", cursor: "pointer" }} />
          <Sparkles style={{ width: 11, height: 11, color: "#00F5FF", cursor: "pointer" }} />
        </form>
        <button
          onClick={() => { setShowPlanner(s => !s); setShowImgGen(false); }}
          style={{ padding: "5px 13px", borderRadius: 8, fontSize: 11, fontFamily: "monospace", background: showPlanner ? "rgba(110,86,255,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${showPlanner ? "rgba(110,86,255,0.4)" : "rgba(255,255,255,0.08)"}`, color: showPlanner ? "#a78bfa" : "rgba(148,163,184,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <Zap style={{ width: 11, height: 11 }} /> Planner
        </button>
        <button
          onClick={() => { setShowImgGen(s => !s); setShowPlanner(false); }}
          style={{ padding: "5px 13px", borderRadius: 8, fontSize: 11, fontFamily: "monospace", background: showImgGen ? "rgba(236,72,153,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${showImgGen ? "rgba(236,72,153,0.5)" : "rgba(255,255,255,0.08)"}`, color: showImgGen ? "#f472b6" : "rgba(148,163,184,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <Wand2 style={{ width: 11, height: 11 }} /> Image AI
        </button>
      </div>

      {/* ===== Main Grid ===== */}
      <div style={{ display: "grid", gridTemplateColumns: showPlanner ? "1fr" : "1fr 260px", position: "relative", minHeight: 640 }}>

        {/* CENTER PANEL */}
        <div style={{ position: "relative", background: "linear-gradient(180deg,#040c1a 0%,#030a18 50%,#04081a 100%)", overflow: "hidden" }}>
          {/* Atmosphere glow */}
          <div style={{ position: "absolute", bottom: "5%", left: "50%", transform: "translateX(-50%)", width: "150%", height: 280, background: "radial-gradient(ellipse 80% 50% at 50% 100%,rgba(0,80,220,0.5) 0%,rgba(0,40,160,0.25) 40%,transparent 70%)", filter: "blur(18px)", borderRadius: "50%", zIndex: 1 }} />
          {/* Stars */}
          {Array.from({ length: 70 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", width: i % 9 === 0 ? 2 : 1, height: i % 9 === 0 ? 2 : 1, borderRadius: "50%", background: "#fff", top: `${(i * 73 + 11) % 100}%`, left: `${(i * 61.8) % 100}%`, opacity: 0.15 + (i % 6) * 0.05, zIndex: 1 }} />
          ))}

          <div style={{ position: "relative", zIndex: 2, padding: "22px 36px 28px" }}>
            {/* Time + Weather */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                  <Clock style={{ width: 13, height: 13, color: "rgba(148,163,184,0.45)" }} />
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "monospace", letterSpacing: "0.04em" }}>{fmtTime(currentTime)}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "rgba(148,163,184,0.45)", fontFamily: "monospace", paddingLeft: 20 }}>{fmtDate(currentTime)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>32°C</span>
                  <span style={{ fontSize: 18 }}>⛅</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
                  <MapPin style={{ width: 9, height: 9, color: "rgba(148,163,184,0.35)" }} />
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,0.45)", fontFamily: "monospace" }}>New Delhi, India</span>
                </div>
              </div>
            </div>

            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: 26 }}>
              <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, background: "linear-gradient(135deg,#6ee7ff 0%,#60a5fa 50%,#818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                Search the World ✦
              </h1>
              <p style={{ marginTop: 8, color: "rgba(148,163,184,0.5)", fontSize: 13 }}>Powered by AI. Fast. Private. Intelligent.</p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(0,245,255,0.4)", borderRadius: 40, padding: "11px 20px", boxShadow: "0 0 32px rgba(0,245,255,0.14),0 0 60px rgba(0,80,255,0.08)", backdropFilter: "blur(20px)" }}>
                <Search style={{ width: 17, height: 17, color: "rgba(148,163,184,0.4)", flexShrink: 0 }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search anything..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e8f0", fontSize: 15 }} />
                <button
                  type="button"
                  onClick={startVoiceSearch}
                  title={isListening ? "Stop listening" : "Voice search"}
                  style={{ background: isListening ? "rgba(0,245,255,0.12)" : "none", border: isListening ? "1px solid rgba(0,245,255,0.4)" : "none", borderRadius: "50%", cursor: "pointer", padding: 5, color: isListening ? "#00F5FF" : "rgba(148,163,184,0.4)", display: "flex", transition: "all 0.2s", animation: isListening ? "nx-pulse 1.2s infinite" : "none" }}>
                  <Mic style={{ width: 17, height: 17 }} />
                </button>
                <button
                  type="button"
                  onClick={openCameraSearch}
                  title="Visual search with camera"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 5, color: "rgba(148,163,184,0.4)", display: "flex", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#00F5FF"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(148,163,184,0.4)"}>
                  <Camera style={{ width: 17, height: 17 }} />
                </button>
              </div>
            </form>

            {/* Search Tabs */}
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
              {SEARCH_TABS.map(tab => (
                <button key={tab} onClick={() => handleTabClick(tab)} style={{ padding: "6px 15px", borderRadius: 20, fontSize: 12, cursor: "pointer", background: activeSearchTab === tab ? "linear-gradient(135deg,rgba(0,245,255,0.3),rgba(110,86,255,0.3))" : "rgba(255,255,255,0.04)", border: `1px solid ${activeSearchTab === tab ? "rgba(0,245,255,0.4)" : "rgba(255,255,255,0.1)"}`, color: activeSearchTab === tab ? "#00F5FF" : "rgba(148,163,184,0.6)", fontWeight: activeSearchTab === tab ? 700 : 400, transition: "all 0.18s" }}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Quick Access */}
            <div style={{ marginBottom: 30 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Quick Access 🚀</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                {quickSites.map((site, idx) => (
                  <div key={idx} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}
                    onMouseEnter={() => setHoveredSite(idx)}
                    onMouseLeave={() => setHoveredSite(null)}
                  >
                    <a href={site.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                      <div
                        style={{ width: 52, height: 52, borderRadius: 14, background: site.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: site.dark ? "#222" : "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.35)", transition: "transform 0.15s,box-shadow 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.35)"; }}
                      >
                        {site.icon}
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(148,163,184,0.65)" }}>{site.label}</span>
                    </a>
                    {hoveredSite === idx && (
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); removeSite(idx); }}
                        style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#f87171", border: "none", color: "#fff", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)", zIndex: 5 }}
                        title="Remove site"
                      >✕</button>
                    )}
                  </div>
                ))}
                <div
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer" }}
                  onClick={() => setShowAddSite(true)}
                >
                  <div
                    style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "2px dashed rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "rgba(148,163,184,0.4)", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.4)"; e.currentTarget.style.color = "#00F5FF"; e.currentTarget.style.background = "rgba(0,245,255,0.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "rgba(148,163,184,0.4)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  >+</div>
                  <span style={{ fontSize: 11, color: "rgba(148,163,184,0.4)" }}>Add</span>
                </div>
              </div>

              {/* ── Add Site Modal ── */}
              {showAddSite && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
                  onClick={e => { if (e.target === e.currentTarget) setShowAddSite(false); }}
                >
                  <div style={{ background: "rgba(8,12,28,0.98)", border: "1px solid rgba(0,245,255,0.25)", borderRadius: 18, padding: "28px 28px 24px", width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(0,245,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                      <div>
                        <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(0,245,255,0.7)", fontFamily: "monospace", marginBottom: 4 }}>QUICK ACCESS</div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e2e8f0" }}>Add New Site</h3>
                      </div>
                      <button onClick={() => setShowAddSite(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(148,163,184,0.6)", width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 13, background: newSiteBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>{newSiteIcon}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{newSiteName || "Site Name"}</div>
                        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", marginTop: 2 }}>{newSiteUrl || "https://example.com"}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(0,245,255,0.7)", fontFamily: "monospace", marginBottom: 7 }}>SITE NAME</label>
                      <input
                        value={newSiteName}
                        onChange={e => setNewSiteName(e.target.value)}
                        placeholder="e.g. Reddit"
                        autoFocus
                        style={{ width: "100%", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onKeyDown={e => { if (e.key === "Enter") addSite(); }}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(0,245,255,0.7)", fontFamily: "monospace", marginBottom: 7 }}>URL</label>
                      <input
                        value={newSiteUrl}
                        onChange={e => setNewSiteUrl(e.target.value)}
                        placeholder="https://reddit.com"
                        style={{ width: "100%", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onKeyDown={e => { if (e.key === "Enter") addSite(); }}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(0,245,255,0.7)", fontFamily: "monospace", marginBottom: 8 }}>ICON</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {ICON_PRESETS.map(ic => (
                          <button key={ic} onClick={() => setNewSiteIcon(ic)}
                            style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${newSiteIcon === ic ? "rgba(0,245,255,0.5)" : "rgba(255,255,255,0.08)"}`, background: newSiteIcon === ic ? "rgba(0,245,255,0.1)" : "rgba(255,255,255,0.03)", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>
                            {ic}
                          </button>
                        ))}
                      </div>
                      <input
                        value={newSiteIcon}
                        onChange={e => setNewSiteIcon(e.target.value.slice(0, 2) || "🌐")}
                        placeholder="Or type any emoji"
                        style={{ width: "100%", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.15)", borderRadius: 8, color: "#e2e8f0", padding: "7px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>

                    <div style={{ marginBottom: 22 }}>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(0,245,255,0.7)", fontFamily: "monospace", marginBottom: 8 }}>BACKGROUND COLOR</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {COLOR_PRESETS.map(col => (
                          <button key={col} onClick={() => setNewSiteBg(col)}
                            style={{ width: 28, height: 28, borderRadius: 8, background: col, border: `2px solid ${newSiteBg === col ? "#fff" : "transparent"}`, cursor: "pointer", transition: "transform 0.12s", transform: newSiteBg === col ? "scale(1.2)" : "scale(1)" }}
                          />
                        ))}
                        <input type="color" value={newSiteBg} onChange={e => setNewSiteBg(e.target.value)}
                          style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", padding: 1, background: "none" }}
                          title="Custom color"
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={addSite}
                        style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "linear-gradient(135deg,rgba(0,245,255,0.25),rgba(110,86,255,0.25))", border: "1px solid rgba(0,245,255,0.4)", color: "#00F5FF", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "monospace", transition: "all 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(0,245,255,0.25)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                      >✦ Add Site</button>
                      <button onClick={() => setShowAddSite(false)}
                        style={{ padding: "11px 18px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.6)", cursor: "pointer", fontSize: 13, fontFamily: "monospace" }}
                      >Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Trending Now */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 7 }}>
                  Trending Now
                  {trendingLoading && <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid rgba(0,245,255,0.4)", borderTopColor: "#00F5FF", display: "inline-block", animation: "nx-spin-slow 0.8s linear infinite" }} />}
                </div>
                <button
                  onClick={fetchTrending}
                  disabled={trendingLoading}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.55)", cursor: trendingLoading ? "not-allowed" : "pointer", fontSize: 10, fontFamily: "monospace", opacity: trendingLoading ? 0.5 : 1, transition: "all 0.15s" }}
                  onMouseEnter={e => { if (!trendingLoading) { e.currentTarget.style.borderColor = "rgba(0,245,255,0.25)"; e.currentTarget.style.color = "#00F5FF"; }}}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(148,163,184,0.55)"; }}
                >
                  <RotateCcw style={{ width: 9, height: 9 }} /> Refresh
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {trending.map((item, i) => (
                  <div key={i}
                    style={{ borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "transform 0.18s,border-color 0.18s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.22)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                    onClick={() => window.open(item.url, "_blank", "noopener noreferrer")}
                  >
                    <div style={{ height: 95, overflow: "hidden", background: "rgba(0,0,0,0.3)" }}>
                      <img src={item.img} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
                        onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
                        onMouseLeave={e => e.target.style.transform = ""}
                        onError={e => e.target.style.display = "none"}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div style={{ padding: "10px 12px" }}>
                      <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: `${item.cc}22`, color: item.cc, fontSize: 9, fontWeight: 700, fontFamily: "monospace", marginBottom: 6, border: `1px solid ${item.cc}44` }}>{item.category}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4, marginBottom: 5 }}>{item.title}</div>
                      <div style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        {!showPlanner && (
          <div style={{ background: "rgba(6,11,22,0.98)", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            {/* AI Suggestions */}
            <div style={{ padding: "16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles style={{ width: 13, height: 13, color: "#00F5FF" }} /><span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>AI Suggestions</span></div>
                <X style={{ width: 12, height: 12, color: "rgba(148,163,184,0.3)", cursor: "pointer" }} />
              </div>
              {AI_SUGGESTIONS.map((s, i) => (
                <div key={i} onClick={() => { setSearchQuery(s.label); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 5, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,245,255,0.07)"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13 }}>{s.icon}</span><span style={{ fontSize: 11, color: "#cbd5e1" }}>{s.label}</span></div>
                  <ChevronRight style={{ width: 11, height: 11, color: "rgba(148,163,184,0.3)" }} />
                </div>
              ))}
            </div>

            {/* Recent Searches */}
            <div style={{ padding: "16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Recent Searches</span>
                <span style={{ fontSize: 14, color: "rgba(148,163,184,0.3)", cursor: "pointer" }}>—</span>
              </div>
              {recents.map((r, i) => (
                <div key={i} onClick={() => setSearchQuery(r)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 8px", borderRadius: 6, cursor: "pointer", transition: "background 0.15s", marginBottom: 2 }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Clock style={{ width: 10, height: 10, color: "rgba(148,163,184,0.3)" }} /><span style={{ fontSize: 11, color: "rgba(148,163,184,0.65)" }}>{r}</span></div>
                  <X style={{ width: 10, height: 10, color: "rgba(148,163,184,0.25)", cursor: "pointer" }} onClick={e => { e.stopPropagation(); setRecents(rs => rs.filter((_, j) => j !== i)); }} />
                </div>
              ))}
            </div>

            {/* Bookmarks */}
            <div style={{ padding: "16px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Bookmark style={{ width: 12, height: 12, color: "#fbbf24" }} /><span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Bookmarks</span></div>
                <X style={{ width: 12, height: 12, color: "rgba(148,163,184,0.3)", cursor: "pointer" }} />
              </div>
              {BOOKMARKS.map((b, i) => (
                <a key={i} href={b.url} target={b.url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px", borderRadius: 6, textDecoration: "none", transition: "background 0.15s", marginBottom: 2 }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{b.icon}</span>
                  <span style={{ fontSize: 11, color: "rgba(148,163,184,0.65)" }}>{b.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* CAMERA SEARCH MODAL */}
        {showCamera && (
          <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
            onClick={e => { if (e.target === e.currentTarget) closeCameraModal(); }}>
            <div style={{ background: "rgba(6,10,24,0.98)", border: "1px solid rgba(0,245,255,0.25)", borderRadius: 20, padding: "24px", width: 520, boxShadow: "0 24px 70px rgba(0,0,0,0.8), 0 0 50px rgba(0,245,255,0.07)" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(0,245,255,0.7)", fontFamily: "monospace", marginBottom: 4 }}>VISUAL SEARCH</div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e2e8f0" }}>📷 Camera Search</h3>
                </div>
                <button onClick={closeCameraModal} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(148,163,184,0.6)", width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>

              {/* Video or captured photo */}
              <div style={{ borderRadius: 14, overflow: "hidden", background: "#000", marginBottom: 16, position: "relative", minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {!capturedPhoto ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block", borderRadius: 14 }} />
                    <div style={{ position: "absolute", top: 10, left: 10, fontSize: 10, fontFamily: "monospace", color: "rgba(0,245,255,0.7)", background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f87171", display: "inline-block", animation: "nx-pulse 1.2s infinite" }} />
                      LIVE
                    </div>
                  </>
                ) : (
                  <img src={capturedPhoto} alt="Captured" style={{ width: "100%", display: "block", borderRadius: 14 }} />
                )}
              </div>

              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {/* Actions */}
              {!capturedPhoto ? (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={capturePhoto}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "linear-gradient(135deg,rgba(0,245,255,0.25),rgba(110,86,255,0.25))", border: "1px solid rgba(0,245,255,0.4)", color: "#00F5FF", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>
                    📸 Capture Photo
                  </button>
                  <button onClick={closeCameraModal}
                    style={{ padding: "11px 18px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.6)", cursor: "pointer", fontSize: 13, fontFamily: "monospace" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", marginBottom: 12, textAlign: "center" }}>Photo captured! Choose what to do with it:</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={searchWithLens}
                      style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "linear-gradient(135deg,rgba(0,245,255,0.2),rgba(66,133,244,0.2))", border: "1px solid rgba(66,133,244,0.4)", color: "#60a5fa", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>
                      🔍 Search with Google Lens
                    </button>
                    <button onClick={() => { setCapturedPhoto(null); openCameraSearch(); }}
                      style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.6)", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                      🔄 Retake
                    </button>
                    <button onClick={() => {
                      const a = document.createElement("a");
                      a.href = capturedPhoto;
                      a.download = "camera_capture.jpg";
                      a.click();
                    }} style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                      💾 Save
                    </button>
                    <button onClick={closeCameraModal}
                      style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                      ✕ Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* IMAGE GENERATION OVERLAY */}
        {showImgGen && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(4,6,18,0.98)", backdropFilter: "blur(20px)", overflowY: "auto", padding: "24px 28px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(244,114,182,0.7)", fontFamily: "monospace", marginBottom: 4 }}>AI IMAGE GENERATION</div>
                <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, background: "linear-gradient(135deg,#f9a8d4,#f472b6,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  ✦ Create with AI
                </h2>
                <p style={{ marginTop: 4, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>Powered by Pollinations AI · Free · No limits</p>
              </div>
              <button onClick={() => setShowImgGen(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(148,163,184,0.6)", padding: "7px 14px", cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}>✕ Close</button>
            </div>

            {/* Prompt + Controls */}
            <div style={{ background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
              {/* Prompt */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(244,114,182,0.8)", fontFamily: "monospace", marginBottom: 8 }}>DESCRIBE YOUR IMAGE</label>
                <div style={{ position: "relative" }}>
                  <textarea
                    value={imgPrompt}
                    onChange={e => setImgPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generateImage(); }}
                    placeholder="e.g. A futuristic city at night with neon lights and flying cars, ultra-detailed, cinematic..."
                    rows={3}
                    style={{ width: "100%", background: "rgba(15,10,30,0.8)", border: "1px solid rgba(236,72,153,0.25)", borderRadius: 10, color: "#f1f5f9", padding: "12px 14px", fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
                  />
                  <span style={{ position: "absolute", bottom: 8, right: 10, fontSize: 9, color: "rgba(148,163,184,0.3)", fontFamily: "monospace" }}>Ctrl+Enter to generate</span>
                </div>
              </div>

              {/* Style + Size row */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(244,114,182,0.8)", fontFamily: "monospace", marginBottom: 8 }}>STYLE</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[
                      { id: "photorealistic", label: "📷 Photo" },
                      { id: "anime",          label: "🎌 Anime" },
                      { id: "digital-art",    label: "🎨 Digital" },
                      { id: "oil-painting",   label: "🖼 Oil" },
                      { id: "watercolor",     label: "💧 Water" },
                      { id: "cyberpunk",      label: "🤖 Cyber" },
                      { id: "fantasy",        label: "🧙 Fantasy" },
                      { id: "minimalist",     label: "◻ Minimal" },
                    ].map(s => (
                      <button key={s.id} onClick={() => setImgStyle(s.id)}
                        style={{ padding: "5px 11px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontFamily: "monospace", background: imgStyle === s.id ? "rgba(236,72,153,0.25)" : "rgba(255,255,255,0.04)", border: `1px solid ${imgStyle === s.id ? "rgba(236,72,153,0.5)" : "rgba(255,255,255,0.1)"}`, color: imgStyle === s.id ? "#f472b6" : "rgba(148,163,184,0.6)", fontWeight: imgStyle === s.id ? 700 : 400, transition: "all 0.15s" }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ minWidth: 160 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(244,114,182,0.8)", fontFamily: "monospace", marginBottom: 8 }}>SIZE</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {[
                      { label: "🖼 Landscape (1024×768)",  w: 1024, h: 768 },
                      { label: "📱 Portrait (768×1024)",   w: 768,  h: 1024 },
                      { label: "⬛ Square (1024×1024)",    w: 1024, h: 1024 },
                      { label: "🎬 Widescreen (1280×720)", w: 1280, h: 720 },
                    ].map(sz => (
                      <button key={sz.label} onClick={() => { setImgWidth(sz.w); setImgHeight(sz.h); }}
                        style={{ padding: "5px 10px", borderRadius: 7, fontSize: 10, cursor: "pointer", fontFamily: "monospace", textAlign: "left", background: imgWidth === sz.w && imgHeight === sz.h ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${imgWidth === sz.w && imgHeight === sz.h ? "rgba(236,72,153,0.4)" : "rgba(255,255,255,0.08)"}`, color: imgWidth === sz.w && imgHeight === sz.h ? "#f9a8d4" : "rgba(148,163,184,0.6)", transition: "all 0.15s" }}>
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={generateImage}
                disabled={imgGenerating || !imgPrompt.trim()}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 28px", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "monospace", cursor: imgGenerating || !imgPrompt.trim() ? "not-allowed" : "pointer", opacity: imgGenerating || !imgPrompt.trim() ? 0.5 : 1, background: "linear-gradient(135deg, rgba(236,72,153,0.35), rgba(192,38,211,0.35))", border: "1px solid rgba(236,72,153,0.5)", color: "#f9a8d4", boxShadow: "0 0 20px rgba(236,72,153,0.2)", transition: "all 0.2s" }}
                onMouseEnter={e => { if (!imgGenerating && imgPrompt.trim()) e.currentTarget.style.boxShadow = "0 0 32px rgba(236,72,153,0.4)"; }}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(236,72,153,0.2)"}
              >
                {imgGenerating ? <Loader style={{ width: 16, height: 16, animation: "nx-spin-slow 1s linear infinite" }} /> : <Wand2 style={{ width: 16, height: 16 }} />}
                {imgGenerating ? "Generating…" : "✦ Generate Image"}
              </button>
            </div>

            {/* Gallery */}
            {imgGallery.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ImageIcon style={{ width: 14, height: 14, color: "#f472b6" }} />
                    Generated Images
                    <span style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", fontWeight: 400 }}>({imgGallery.length} image{imgGallery.length !== 1 ? "s" : ""})</span>
                  </div>
                  <button
                    onClick={() => { if (window.confirm("Delete all generated images?")) setImgGallery([]); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", cursor: "pointer", fontSize: 11, fontFamily: "monospace", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.18)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.5)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.25)"; }}
                  >
                    <Trash2 style={{ width: 11, height: 11 }} /> Clear All
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {imgGallery.map((item) => (
                    <div key={item.id} style={{ borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(236,72,153,0.15)", transition: "transform 0.2s, border-color 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(236,72,153,0.35)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "rgba(236,72,153,0.15)"; }}>
                      {/* Image display */}
                      <div style={{ position: "relative", minHeight: 200, background: "linear-gradient(135deg, rgba(20,10,40,0.8), rgba(10,5,25,0.9))", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <img
                          src={item.url}
                          alt={item.prompt}
                          style={{ width: "100%", display: "block", objectFit: "cover", opacity: 0, transition: "opacity 0.4s ease" }}
                          onLoad={e => {
                            e.target.style.opacity = 1;
                            setImgGallery(g => g.map(i => i.id === item.id ? { ...i, loading: false } : i));
                          }}
                          onError={e => {
                            e.target.style.display = "none";
                            setImgGallery(g => g.map(i => i.id === item.id ? { ...i, failed: true, loading: false } : i));
                          }}
                          loading="eager"
                          referrerPolicy="no-referrer"
                        />
                        {item.loading && !item.failed && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                            <Loader style={{ width: 28, height: 28, color: "#f472b6", animation: "nx-spin-slow 1s linear infinite" }} />
                            <span style={{ fontSize: 11, color: "rgba(244,114,182,0.7)", fontFamily: "monospace" }}>Generating…</span>
                          </div>
                        )}
                        {item.failed && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 }}>
                            <AlertCircle style={{ width: 24, height: 24, color: "#f87171" }} />
                            <span style={{ fontSize: 11, color: "rgba(248,113,113,0.8)", fontFamily: "monospace", textAlign: "center" }}>Failed to load. Try again.</span>
                            <button onClick={() => {
                              const newUrl = buildImgUrl(item.prompt, item.style, item.w, item.h, Date.now());
                              setImgGallery(g => g.map(i => i.id === item.id ? { ...i, url: newUrl, failed: false, loading: true } : i));
                            }} style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>Retry</button>
                          </div>
                        )}
                      </div>
                      {/* Footer */}
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.4, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.prompt}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 9, color: "rgba(244,114,182,0.6)", fontFamily: "monospace", background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 4, padding: "2px 7px" }}>{item.style}</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => {
                              const newUrl = buildImgUrl(item.prompt, item.style, item.w, item.h, Date.now());
                              const newEntry = { ...item, id: Date.now(), url: newUrl, loading: true, failed: false, ts: Date.now() };
                              setImgGallery(g => [newEntry, ...g.slice(0, 11)]);
                              toast.info("Generating variation…");
                            }} style={{ padding: "4px 9px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.6)", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>
                              ↺ Vary
                            </button>
                            <button onClick={() => downloadImg(item.url, item.prompt)}
                              style={{ padding: "4px 9px", borderRadius: 6, background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.3)", color: "#f472b6", cursor: "pointer", fontSize: 10, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                              <Download style={{ width: 10, height: 10 }} /> Save
                            </button>
                            <button
                              onClick={() => setImgGallery(g => g.filter(i => i.id !== item.id))}
                              title="Delete image"
                              style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", cursor: "pointer", fontSize: 10, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 3, transition: "all 0.15s" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.2)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.5)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.25)"; }}
                            >
                              <Trash2 style={{ width: 10, height: 10 }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {imgGallery.length === 0 && (
              <div style={{ textAlign: "center", padding: "50px 20px", color: "rgba(148,163,184,0.35)" }}>
                <div style={{ fontSize: 48, marginBottom: 16, filter: "grayscale(0.5)" }}>🎨</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No images yet</div>
                <div style={{ fontSize: 12, fontFamily: "monospace" }}>Type a prompt above and click Generate Image</div>
              </div>
            )}
          </div>
        )}

        {/* PLANNER OVERLAY */}
        {showPlanner && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(4,8,20,0.98)", backdropFilter: "blur(20px)", overflowY: "auto", padding: "28px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div className="hud-label" style={{ marginBottom: 4 }}>BROWSER AGENT</div>
                <h2 className="font-display nx-neon-cyan" style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Browser Automation Planner</h2>
                <p style={{ marginTop: 4, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>Describe a task → AI generates a Playwright step-by-step automation plan or fetch direct page elements.</p>
              </div>
              <button onClick={() => setShowPlanner(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(148,163,184,0.6)", padding: "7px 14px", cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}>✕ Close</button>
            </div>
            <div className="nx-glass" style={{ borderRadius: 12, padding: "18px 20px", marginBottom: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="hud-label" style={{ display: "block", marginBottom: 5 }}>AUTOMATION GOAL</label>
                  <textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Search for 'AI news' on Google, extract the top 5 headlines" rows={3} style={{ ...iS, resize: "vertical" }} />
                </div>
                <div>
                  <label className="hud-label" style={{ display: "block", marginBottom: 5 }}>START URL</label>
                  <input value={startUrl} onChange={e => setStartUrl(e.target.value)} placeholder="https://..." style={iS} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={generate} disabled={loading || !goal.trim()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 9, background: "rgba(0,245,255,0.14)", border: "1px solid rgba(0,245,255,0.35)", color: "#00F5FF", cursor: "pointer", fontSize: 13, fontFamily: "monospace", opacity: loading || !goal.trim() ? 0.5 : 1 }}>
                    {loading ? <Loader style={{ width: 14, height: 14, animation: "nx-spin-slow 1s linear infinite" }} /> : <Play style={{ width: 14, height: 14 }} />}
                    {loading ? "Generating..." : "Generate Plan"}
                  </button>
                  <button onClick={fetchPage} disabled={fetching || !startUrl.trim()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 9, background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.35)", color: "#00FF88", cursor: "pointer", fontSize: 13, fontFamily: "monospace", opacity: fetching || !startUrl.trim() ? 0.5 : 1 }}>
                    {fetching ? <Loader style={{ width: 14, height: 14, animation: "nx-spin-slow 1s linear infinite" }} /> : <Globe style={{ width: 14, height: 14 }} />}
                    {fetching ? "Fetching..." : "Fetch Live Content"}
                  </button>
                  {(plan || fetchResult) && (
                    <button onClick={() => { setPlan(""); setFetchResult(null); setGoal(""); setStartUrl(""); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 9, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.6)", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                      <RefreshCw style={{ width: 13, height: 13 }} /> Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
            {plan && (
              <div className="nx-glass nx-fadein" style={{ borderRadius: 12, padding: "16px 20px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Globe style={{ width: 13, height: 13, color: "#00F5FF" }} /><span className="hud-label">AUTOMATION PLAN</span></div>
                  <button onClick={() => navigator.clipboard.writeText(plan).then(() => toast.success("Plan copied!"))} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.2)", color: "#00F5FF", cursor: "pointer", fontSize: 11, fontFamily: "monospace" }}>
                    <Copy style={{ width: 11, height: 11 }} /> Copy Plan
                  </button>
                </div>
                <div className="nx-md" style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}><ReactMarkdown>{plan}</ReactMarkdown></div>
              </div>
            )}
            {fetchResult && (
              <div className="nx-glass nx-fadein" style={{ borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Globe style={{ width: 15, height: 15, color: "#00FF88" }} /><span className="hud-label" style={{ color: "#00FF88" }}>LIVE FETCH RESULTS</span></div>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(148,163,184,0.7)" }}>
                    Status: <strong style={{ color: fetchResult.status_code === 200 ? "#00FF88" : "#FF4D4D" }}>{fetchResult.status_code}</strong>
                    {" "}• Size: <strong>{(fetchResult.content_length / 1024).toFixed(2)} KB</strong>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {["metadata","links","text"].map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid", borderColor: activeTab === t ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.05)", background: activeTab === t ? "rgba(0,255,136,0.08)" : "transparent", color: activeTab === t ? "#00FF88" : "rgba(148,163,184,0.6)", cursor: "pointer", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase" }}>
                      {t === "text" ? "Page Content" : t}
                    </button>
                  ))}
                </div>
                <div style={{ background: "rgba(15,23,42,0.4)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", padding: 14 }}>
                  {activeTab === "metadata" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12, fontFamily: "monospace" }}>
                      <div><span style={{ color: "rgba(148,163,184,0.5)", display: "block", marginBottom: 3 }}>PAGE TITLE</span><span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{fetchResult.title}</span></div>
                      <div><span style={{ color: "rgba(148,163,184,0.5)", display: "block", marginBottom: 3 }}>META DESCRIPTION</span><span style={{ color: "#cbd5e1", lineHeight: 1.5 }}>{fetchResult.description}</span></div>
                      <div><span style={{ color: "rgba(148,163,184,0.5)", display: "block", marginBottom: 3 }}>FINAL URL</span><a href={fetchResult.url} target="_blank" rel="noopener noreferrer" style={{ color: "#00F5FF", textDecoration: "underline", wordBreak: "break-all" }}>{fetchResult.url}</a></div>
                    </div>
                  )}
                  {activeTab === "links" && (
                    <div style={{ maxHeight: 250, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                      {fetchResult.links.length === 0
                        ? <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 11, fontFamily: "monospace", textAlign: "center", padding: 10 }}>No anchor links found.</div>
                        : fetchResult.links.map((link, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)", gap: 10 }}>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                              <span style={{ color: "#00FF88", fontSize: 10, marginRight: 6, fontFamily: "monospace" }}>[{idx + 1}]</span>
                              <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 500, marginRight: 8 }}>{link.text}</span>
                              <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(148,163,184,0.6)", fontSize: 10, textDecoration: "none", fontFamily: "monospace" }}>{link.href}</a>
                            </div>
                            <button onClick={() => { navigator.clipboard.writeText(link.href); toast.success("Link copied"); }} style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 4, color: "#00FF88", padding: "2px 6px", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}>Copy</button>
                          </div>
                        ))
                      }
                    </div>
                  )}
                  {activeTab === "text" && (
                    <textarea readOnly value={fetchResult.text_preview} rows={10} style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 6, color: "#cbd5e1", padding: 10, fontSize: 11, fontFamily: "monospace", resize: "none", outline: "none", lineHeight: 1.5 }} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
