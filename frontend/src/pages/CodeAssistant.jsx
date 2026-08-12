import { useState, useEffect, useRef } from "react";
import {
  Search, Bell, MessageSquare, ChevronDown, ChevronRight, Play,
  Code2, Sparkles, Folder, FileCode, CheckCircle2, ShieldCheck, GitBranch,
  Terminal as TerminalIcon, Activity, Database, Send, RefreshCw, Plus, X, Check,
  Upload, FolderOpen
} from "lucide-react";
import { toast } from "../components/Toast";
import { http } from "../lib/api";

// ── Complete Sample Files Code Database ──
const FILE_CONTENTS = {
  "route.ts": {
    path: "app > api > products > TS route.ts > GET",
    lang: "TypeScript",
    lines: [
      `import { NextRequest, NextResponse } from 'next/server';`,
      `import { ProductService } from '@/lib/services/product.service';`,
      `import { connectDB } from '@/lib/db';`,
      `import { ApiResponse } from '@/lib/utils/api-response';`,
      ``,
      `const productService = new ProductService();`,
      ``,
      `// GET /api/products - Get all products with filters, pagination and sorting`,
      `export async function GET(request: NextRequest) {`,
      `  try {`,
      `    await connectDB();`,
      `    const { searchParams } = new URL(request.url);`,
      ``,
      `    const page = parseInt(searchParams.get('page') || '1');`,
      `    const limit = parseInt(searchParams.get('limit') || '10');`,
      `    const category = searchParams.get('category');`,
      `    const search = searchParams.get('search');`,
      `    const sort = searchParams.get('sort') || 'createdAt';`,
      `    const order = searchParams.get('order') || 'desc';`,
      ``,
      `    const result = await productService.getProducts({`,
      `      page,`,
      `      limit,`,
      `      category,`,
      `      search,`,
      `      sort,`,
      `      order: order as 'asc' | 'desc',`,
      `    });`,
      ``,
      `    return NextResponse.json(result);`,
      `  } catch (error) {`,
      `    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });`,
      `  }`,
      `}`
    ]
  },
  "page.tsx": {
    path: "app > page.tsx",
    lang: "TypeScript React",
    lines: [
      `import { ProductGrid } from '@/components/products/product-grid';`,
      `import { Header } from '@/components/layout/header';`,
      ``,
      `export default async function StorePage() {`,
      `  return (`,
      `    <main className="min-h-screen bg-slate-950 text-white">`,
      `      <Header title="Omega Store Catalog" />`,
      `      <section className="container mx-auto py-8 px-4">`,
      `        <ProductGrid />`,
      `      </section>`,
      `    </main>`,
      `  );`,
      `}`
    ]
  },
  "layout.tsx": {
    path: "app > layout.tsx",
    lang: "TypeScript React",
    lines: [
      `import '@/app/globals.css';`,
      `import { Inter } from 'next/font/google';`,
      ``,
      `const inter = Inter({ subsets: ['latin'] });`,
      ``,
      `export const metadata = { title: 'OmegaStore', description: 'Next-Gen E-Commerce Platform' };`,
      ``,
      `export default function RootLayout({ children }: { children: React.ReactNode }) {`,
      `  return (`,
      `    <html lang="en">`,
      `      <body className={inter.className}>{children}</body>`,
      `    </html>`,
      `  );`,
      `}`
    ]
  },
  "product.service.ts": {
    path: "lib > services > product.service.ts",
    lang: "TypeScript",
    lines: [
      `import { ProductModel } from '@/lib/db/models/product';`,
      ``,
      `export class ProductService {`,
      `  async getProducts(params: any) {`,
      `    const { page = 1, limit = 10, category, search, sort = 'createdAt', order = 'desc' } = params;`,
      `    const query: any = {};`,
      `    if (category) query.category = category;`,
      `    if (search) query.name = { $regex: search, $options: 'i' };`,
      `    const items = await ProductModel.find(query)`,
      `      .sort({ [sort]: order === 'asc' ? 1 : -1 })`,
      `      .skip((page - 1) * limit)`,
      `      .limit(limit);`,
      `    const total = await ProductModel.countDocuments(query);`,
      `    return { items, total, page, totalPages: Math.ceil(total / limit) };`,
      `  }`,
      `}`
    ]
  },
  "db.ts": {
    path: "lib > db.ts",
    lang: "TypeScript",
    lines: [
      `import mongoose from 'mongoose';`,
      ``,
      `export async function connectDB() {`,
      `  if (mongoose.connection.readyState >= 1) return;`,
      `  return mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/omegastore');`,
      `}`
    ]
  },
  "auth.middleware.ts": {
    path: "lib > auth.middleware.ts",
    lang: "TypeScript",
    lines: [
      `import { NextRequest, NextResponse } from 'next/server';`,
      `import { verifyToken } from '@/lib/jwt';`,
      ``,
      `export function authMiddleware(req: NextRequest) {`,
      `  const authHeader = req.headers.get('authorization');`,
      `  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`,
      `  const token = authHeader.split(' ')[1];`,
      `  try {`,
      `    const user = verifyToken(token);`,
      `    req.headers.set('x-user-id', user.id);`,
      `    return NextResponse.next();`,
      `  } catch {`,
      `    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });`,
      `  }`,
      `}`
    ]
  },
  "auth_route.ts": {
    path: "app > api > auth > route.ts",
    lang: "TypeScript",
    lines: [
      `import { NextRequest, NextResponse } from 'next/server';`,
      `import { signToken } from '@/lib/jwt';`,
      ``,
      `export async function POST(req: NextRequest) {`,
      `  const { username, password } = await req.json();`,
      `  if (username === 'admin' && password === 'secret') {`,
      `    const token = signToken({ id: 'u_101', role: 'admin' });`,
      `    return NextResponse.json({ token, user: { id: 'u_101', name: 'Pushkar Balyan' } });`,
      `  }`,
      `  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });`,
      `}`
    ]
  },
  "users_route.ts": {
    path: "app > api > users > route.ts",
    lang: "TypeScript",
    lines: [
      `import { NextResponse } from 'next/server';`,
      ``,
      `export async function GET() {`,
      `  return NextResponse.json([`,
      `    { id: 'u_101', name: 'Pushkar Balyan', role: 'Super Administrator' },`,
      `    { id: 'u_102', name: 'Nexus AI', role: 'System Assistant' }`,
      `  ]);`,
      `}`
    ]
  },
  "product-grid.tsx": {
    path: "components > product-grid.tsx",
    lang: "TypeScript React",
    lines: [
      `import { useState, useEffect } from 'react';`,
      ``,
      `export function ProductGrid() {`,
      `  const [products, setProducts] = useState([]);`,
      `  useEffect(() => {`,
      `    fetch('/api/products').then(res => res.json()).then(data => setProducts(data.items || []));`,
      `  }, []);`,
      `  return (`,
      `    <div className="grid grid-cols-3 gap-6">`,
      `      {products.map(p => (`,
      `        <div key={p.id} className="p-4 bg-slate-900 rounded-lg border border-slate-800">`,
      `          <h3 className="font-bold text-lg">{p.name}</h3>`,
      `          <p className="text-cyan-400 font-mono mt-2">\${p.price}</p>`,
      `        </div>`,
      `      ))}`,
      `    </div>`,
      `  );`,
      `}`
    ]
  },
  "header.tsx": {
    path: "components > header.tsx",
    lang: "TypeScript React",
    lines: [
      `export function Header({ title }: { title: string }) {`,
      `  return (`,
      `    <header className="border-b border-slate-800 py-4 px-8 flex justify-between items-center bg-slate-950">`,
      `      <h1 className="text-xl font-bold text-white">{title}</h1>`,
      `      <span className="text-sm text-slate-400">OmegaStore OS</span>`,
      `    </header>`,
      `  );`,
      `}`
    ]
  },
  ".env.local": {
    path: ".env.local",
    lang: "Properties",
    lines: [
      `MONGODB_URI=mongodb://localhost:27017/nexus_db`,
      `JWT_SECRET=your_jwt_secret_key_here`,
      `NEXT_PUBLIC_API_URL=http://localhost:3000/api`,
      `NODE_ENV=development`
    ]
  },
  ".gitignore": {
    path: ".gitignore",
    lang: "Ignore",
    lines: [
      `node_modules`,
      `.next`,
      `.env.local`,
      `build`,
      `dist`,
      `*.log`
    ]
  },
  "package.json": {
    path: "package.json",
    lang: "JSON",
    lines: [
      `{`,
      `  "name": "omegastore",`,
      `  "version": "1.0.0",`,
      `  "private": true,`,
      `  "scripts": {`,
      `    "dev": "next dev",`,
      `    "build": "next build",`,
      `    "start": "next start",`,
      `    "lint": "next lint",`,
      `    "test": "jest"`,
      `  },`,
      `  "dependencies": {`,
      `    "next": "^14.2.1",`,
      `    "react": "^18.2.0",`,
      `    "react-dom": "^18.2.0",`,
      `    "mongoose": "^8.3.0"`,
      `  }`,
      `}`
    ]
  },
  "tsconfig.json": {
    path: "tsconfig.json",
    lang: "JSON",
    lines: [
      `{`,
      `  "compilerOptions": {`,
      `    "target": "es5",`,
      `    "lib": ["dom", "dom.iterable", "esnext"],`,
      `    "allowJs": true,`,
      `    "skipLibCheck": true,`,
      `    "strict": true,`,
      `    "noEmit": true,`,
      `    "esModuleInterop": true,`,
      `    "module": "esnext",`,
      `    "moduleResolution": "bundler",`,
      `    "resolveJsonModule": true,`,
      `    "isolatedModules": true,`,
      `    "jsx": "preserve",`,
      `    "incremental": true,`,
      `    "paths": { "@/*": ["./*"] }`,
      `  },`,
      `  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],`,
      `  "exclude": ["node_modules"]`,
      `}`
    ]
  },
  "next.config.js": {
    path: "next.config.js",
    lang: "JavaScript",
    lines: [
      `/** @type {import('next').NextConfig} */`,
      `const nextConfig = {`,
      `  reactStrictMode: true,`,
      `  swcMinify: true,`,
      `  images: { domains: ['images.unsplash.com'] }`,
      `};`,
      `module.exports = nextConfig;`
    ]
  }
};

// Folder Tree hierarchy layout
const INITIAL_TREE = {
  name: "OmegaStore",
  type: "folder",
  id: "root",
  children: [
    {
      name: ".next",
      type: "folder",
      id: ".next",
      children: [
        { name: "build-manifest.json", type: "file", id: "build-manifest.json", fileKey: "package.json" }
      ]
    },
    {
      name: "app",
      type: "folder",
      id: "app",
      children: [
        {
          name: "api",
          type: "folder",
          id: "api",
          children: [
            {
              name: "auth",
              type: "folder",
              id: "auth",
              children: [
                { name: "route.ts", type: "file", id: "auth_route.ts", fileKey: "auth_route.ts", badge: "U" }
              ]
            },
            {
              name: "products",
              type: "folder",
              id: "products",
              children: [
                { name: "route.ts", type: "file", id: "route.ts", fileKey: "route.ts", badge: "U" }
              ]
            },
            {
              name: "users",
              type: "folder",
              id: "users",
              children: [
                { name: "route.ts", type: "file", id: "users_route.ts", fileKey: "users_route.ts" }
              ]
            }
          ]
        },
        { name: "page.tsx", type: "file", id: "page.tsx", fileKey: "page.tsx" },
        { name: "layout.tsx", type: "file", id: "layout.tsx", fileKey: "layout.tsx" }
      ]
    },
    {
      name: "components",
      type: "folder",
      id: "components",
      children: [
        { name: "product-grid.tsx", type: "file", id: "product-grid.tsx", fileKey: "product-grid.tsx" },
        { name: "header.tsx", type: "file", id: "header.tsx", fileKey: "header.tsx" }
      ]
    },
    {
      name: "lib",
      type: "folder",
      id: "lib",
      children: [
        {
          name: "services",
          type: "folder",
          id: "services",
          children: [
            { name: "product.service.ts", type: "file", id: "product.service.ts", fileKey: "product.service.ts" }
          ]
        },
        { name: "db.ts", type: "file", id: "db.ts", fileKey: "db.ts" },
        { name: "auth.middleware.ts", type: "file", id: "auth.middleware.ts", fileKey: "auth.middleware.ts" }
      ]
    },
    {
      name: "hooks",
      type: "folder",
      id: "hooks",
      children: [
        { name: "use-products.ts", type: "file", id: "use-products.ts", fileKey: "route.ts" }
      ]
    },
    {
      name: "utils",
      type: "folder",
      id: "utils",
      children: [
        { name: "api-response.ts", type: "file", id: "api-response.ts", fileKey: "route.ts" }
      ]
    },
    {
      name: "public",
      type: "folder",
      id: "public",
      children: [
        { name: "favicon.ico", type: "file", id: "favicon.ico", fileKey: "page.tsx" }
      ]
    },
    { name: ".env.local", type: "file", id: ".env.local", fileKey: ".env.local" },
    { name: ".gitignore", type: "file", id: ".gitignore", fileKey: ".gitignore" },
    { name: "package.json", type: "file", id: "package.json", fileKey: "package.json" },
    { name: "tsconfig.json", type: "file", id: "tsconfig.json", fileKey: "tsconfig.json" },
    { name: "next.config.js", type: "file", id: "next.config.js", fileKey: "next.config.js" }
  ]
};

// Helper function to detect language from file extension
function detectLanguageFromExt(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  if (["js", "jsx"].includes(ext)) return "JavaScript";
  if (["ts", "tsx"].includes(ext)) return "TypeScript";
  if (["py"].includes(ext)) return "Python";
  if (["json"].includes(ext)) return "JSON";
  if (["css", "scss", "less"].includes(ext)) return "CSS";
  if (["html", "htm"].includes(ext)) return "HTML";
  if (["sql"].includes(ext)) return "SQL";
  if (["go"].includes(ext)) return "Go";
  if (["rs"].includes(ext)) return "Rust";
  if (["md", "markdown"].includes(ext)) return "Markdown";
  if (["sh", "bash"].includes(ext)) return "Bash";
  return "Plain Text";
}

export default function CodeAssistant() {
  // ── States ──
  const [activeTab, setActiveTab] = useState("route.ts");
  const [openTabs, setOpenTabs] = useState(["page.tsx", "route.ts", "product.service.ts", "db.ts", "auth.middleware.ts"]);
  const [fileContents, setFileContents] = useState(FILE_CONTENTS);
  const [projectTree, setProjectTree] = useState(INITIAL_TREE);

  const [selectedLanguage, setSelectedLanguage] = useState("TypeScript");
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [selectedEnv, setSelectedEnv] = useState("Development");
  const [selectedModel, setSelectedModel] = useState("GPT-4o");
  const [searchQuery, setSearchQuery] = useState("");

  // Refs for hidden native file/folder inputs
  const desktopFileInputRef = useRef(null);
  const desktopFolderInputRef = useRef(null);

  // Set webkitdirectory attribute on folder input ref
  useEffect(() => {
    if (desktopFolderInputRef.current) {
      desktopFolderInputRef.current.setAttribute("webkitdirectory", "");
      desktopFolderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  // Clock state
  const [timeStr, setTimeStr] = useState("10:24:57 AM");
  const [dateStr, setDateStr] = useState("May 21, 2026");

  // File explorer expand state mapping
  const [expandedFolders, setExpandedFolders] = useState({
    "root": true,
    ".next": false,
    "app": true,
    "api": true,
    "auth": false,
    "products": true,
    "users": false,
    "components": false,
    "lib": false,
    "services": false,
    "hooks": false,
    "utils": false,
    "public": false
  });

  // AI Assistant Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: "ai",
      name: "Omega Code Assistant",
      avatarBg: "#6366F1",
      time: "10:20 AM",
      text: "I can help you implement advanced filtering for your products API. Here's an optimized solution with better performance:",
      codeSnippet: {
        title: "Optimized Product Filtering",
        lang: "TS",
        code: `const query: any = {};\nif (category) query.category = category;\nif (search) {\n  query.$or = [\n    { name: { $regex: search, $options: 'i' } },\n    { description: { $regex: search, $options: 'i' } }\n  ];\n}`
      }
    },
    {
      id: 2,
      sender: "user",
      name: "Pushkar Balyan",
      time: "10:21 AM",
      text: "Add price range filter and inventory check"
    },
    {
      id: 3,
      sender: "ai",
      name: "Omega Code Assistant",
      avatarBg: "#6366F1",
      time: "10:21 AM",
      text: "I'll update the code with price range and inventory filters."
    }
  ]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Terminal state
  const [terminalLogs, setTerminalLogs] = useState([
    { type: "command", text: "OmegaStore@dev:~/projects/omegastore$ npm run dev" },
    { type: "stdout", text: "> omegastore@1.0.0 dev" },
    { type: "stdout", text: "> next dev" },
    { type: "blank", text: "" },
    { type: "brand", text: "▲ Next.js 14.2.1" },
    { type: "info", text: "  - Local:        http://localhost:3000" },
    { type: "info", text: "  - Network:      http://192.168.1.100:3000" },
    { type: "blank", text: "" },
    { type: "success", text: "✓ Starting..." },
    { type: "success", text: "✓ Ready in 1.2s" },
    { type: "success", text: "✓ Compiled /api/products in 320ms" }
  ]);
  const [termInput, setTermInput] = useState("");

  // API Tester state
  const [apiUrl, setApiUrl] = useState("http://localhost:3000/api/products?page=1&limit=10");

  // Clock Ticking effect
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString("en-US", { hour12: true }));
      setDateStr(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Folder toggle
  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Trigger Native Desktop File Picker
  const triggerDesktopFilePicker = () => {
    if (desktopFileInputRef.current) {
      desktopFileInputRef.current.click();
    }
  };

  // Trigger Native Desktop Folder Picker (showDirectoryPicker or input fallback)
  const triggerDesktopFolderPicker = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const filesList = [];

        async function readDirectory(handle, currentPath = "") {
          for await (const entry of handle.values()) {
            if (entry.kind === "file") {
              const fileObj = await entry.getFile();
              Object.defineProperty(fileObj, 'webkitRelativePath', {
                value: `${currentPath}${handle.name}/${fileObj.name}`,
                writable: true
              });
              filesList.push(fileObj);
            } else if (entry.kind === "directory") {
              if (["node_modules", ".git", ".next", "dist", "build"].includes(entry.name)) continue;
              await readDirectory(entry, `${currentPath}${handle.name}/`);
            }
          }
        }

        await readDirectory(dirHandle, "");
        if (filesList.length > 0) {
          processFolderFiles(filesList);
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    if (desktopFolderInputRef.current) {
      desktopFolderInputRef.current.click();
    }
  };

  // Process and load an entire folder's files recursively
  const processFolderFiles = (filesArray) => {
    if (!filesArray || filesArray.length === 0) return;

    const samplePath = filesArray[0].webkitRelativePath || filesArray[0].name;
    const rootFolderName = samplePath.split('/')[0] || "Desktop Folder";
    const rootFolderId = `desktop_root_${Date.now()}`;

    const newTreeRoot = {
      name: rootFolderName,
      type: "folder",
      id: rootFolderId,
      children: []
    };

    const newExpanded = { [rootFolderId]: true, "root": true };
    let firstLoadedKey = null;
    let fileCount = 0;

    Array.from(filesArray).forEach((file) => {
      const relPath = file.webkitRelativePath || file.name;
      if (relPath.includes('/node_modules/') || relPath.includes('/.git/') || relPath.includes('/.next/')) return;

      const parts = relPath.split('/');
      const fileName = parts[parts.length - 1];
      const fileKey = `local_folder_${Date.now()}_${relPath.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      if (!firstLoadedKey) {
        firstLoadedKey = { key: fileKey, name: fileName, lang: detectLanguageFromExt(fileName) };
      }
      fileCount++;

      // Read content
      const reader = new FileReader();
      reader.onload = (ev) => {
        const contentText = ev.target.result || "";
        const lines = contentText.split(/\r?\n/);
        setFileContents(prev => ({
          ...prev,
          [fileKey]: {
            path: relPath.replace(/\//g, " > "),
            lang: detectLanguageFromExt(fileName),
            lines: lines
          }
        }));
      };
      reader.readAsText(file);

      // Build folder hierarchy in newTreeRoot
      let currentChildren = newTreeRoot.children;
      for (let i = 1; i < parts.length - 1; i++) {
        const subName = parts[i];
        const subId = `f_${rootFolderId}_${parts.slice(0, i + 1).join('_')}`;
        newExpanded[subId] = true;

        let subFolder = currentChildren.find(c => c.name === subName && c.type === "folder");
        if (!subFolder) {
          subFolder = { name: subName, type: "folder", id: subId, children: [] };
          currentChildren.push(subFolder);
        }
        currentChildren = subFolder.children;
      }

      currentChildren.push({
        name: fileName,
        type: "file",
        id: fileKey,
        fileKey: fileKey,
        badge: "LOCAL"
      });
    });

    // Mount folder into projectTree
    setProjectTree(prev => ({
      ...prev,
      children: [
        newTreeRoot,
        ...prev.children
      ]
    }));

    setExpandedFolders(prev => ({ ...prev, ...newExpanded }));

    if (firstLoadedKey) {
      if (!openTabs.includes(firstLoadedKey.key)) {
        setOpenTabs(prev => [...prev, firstLoadedKey.key]);
      }
      setActiveTab(firstLoadedKey.key);
      setSelectedLanguage(firstLoadedKey.lang);
    }

    toast.success(`Successfully loaded desktop folder "${rootFolderName}" (${fileCount} files)!`);
  };

  // Input change handler for folder input
  const handleDesktopFolderSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFolderFiles(files);
    }
    e.target.value = "";
  };

  // Handle Desktop / Local File Selection via FileReader
  const handleDesktopFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result || "";
        const lines = text.split(/\r?\n/);
        const fileName = file.name;
        const fileKey = `desktop_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "")}`;
        const lang = detectLanguageFromExt(fileName);
        const fullPath = file.webkitRelativePath || `Desktop > ${fileName}`;

        // Store file content
        setFileContents(prev => ({
          ...prev,
          [fileKey]: {
            path: fullPath,
            lang: lang,
            lines: lines
          }
        }));

        // Add file to tree
        setProjectTree(prev => ({
          ...prev,
          children: [
            { name: fileName, type: "file", id: fileKey, fileKey: fileKey, badge: "LOCAL" },
            ...prev.children
          ]
        }));

        // Open in tabs & focus
        if (!openTabs.includes(fileKey)) {
          setOpenTabs(prev => [...prev, fileKey]);
        }
        setActiveTab(fileKey);
        setSelectedLanguage(lang);
        toast.success(`Opened Desktop file: ${fileName} (${lines.length} lines)`);
      };

      reader.readAsText(file);
    });

    e.target.value = "";
  };

  // Open file tab
  const openFile = (fileKey, fileName) => {
    const targetKey = fileKey || fileName;
    if (!fileContents[targetKey]) {
      setFileContents(prev => ({
        ...prev,
        [targetKey]: {
          path: `OmegaStore > ${fileName}`,
          lang: detectLanguageFromExt(fileName),
          lines: [
            `// ${fileName}`,
            `export default function Component() {`,
            `  return <div>Module: ${fileName}</div>;`,
            `}`
          ]
        }
      }));
    }
    if (!openTabs.includes(targetKey)) {
      setOpenTabs(prev => [...prev, targetKey]);
    }
    setActiveTab(targetKey);
    toast.info(`Opened file: ${fileName}`);
  };

  // Close tab
  const closeTab = (e, fileKey) => {
    e.stopPropagation();
    const filtered = openTabs.filter(t => t !== fileKey);
    setOpenTabs(filtered);
    if (activeTab === fileKey && filtered.length > 0) {
      setActiveTab(filtered[filtered.length - 1]);
    }
  };

  // Add new file dynamically
  const addNewFile = () => {
    const fileName = prompt("Enter new file name (or click 'Open Folder' to load a folder):");
    if (!fileName) return;
    const fileKey = fileName.toLowerCase().replace(/[^a-z0-9._-]/g, "");

    const newEntry = {
      path: `OmegaStore > ${fileName}`,
      lang: detectLanguageFromExt(fileName),
      lines: [
        `// ${fileName}`,
        `export class ${fileName.split('.')[0]}Service {`,
        `  async execute() {`,
        `    return { status: "OK", timestamp: Date.now() };`,
        `  }`,
        `}`
      ]
    };

    setFileContents(prev => ({ ...prev, [fileKey]: newEntry }));

    setProjectTree(prev => ({
      ...prev,
      children: [
        ...prev.children,
        { name: fileName, type: "file", id: fileKey, fileKey, badge: "N" }
      ]
    }));

    openFile(fileKey, fileName);
    toast.success(`Created new file: ${fileName}`);
  };

  // Add new folder dynamically
  const addNewFolder = () => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    const folderId = folderName.toLowerCase();

    setExpandedFolders(prev => ({ ...prev, [folderId]: true }));
    setProjectTree(prev => ({
      ...prev,
      children: [
        ...prev.children,
        {
          name: folderName,
          type: "folder",
          id: folderId,
          children: [
            { name: "index.ts", type: "file", id: `${folderId}_index.ts`, fileKey: "route.ts" }
          ]
        }
      ]
    }));
    toast.success(`Created folder: ${folderName}`);
  };

  // Refresh Explorer
  const refreshExplorer = () => {
    setExpandedFolders({
      "root": true,
      ".next": false,
      "app": true,
      "api": true,
      "auth": true,
      "products": true,
      "users": true,
      "components": true,
      "lib": true,
      "services": true
    });
    toast.success("File Explorer tree refreshed!");
  };

  // Handle Code Line Edit
  const handleLineChange = (lineIndex, newText) => {
    setFileContents(prev => {
      const current = prev[activeTab];
      if (!current) return prev;
      const updatedLines = [...current.lines];
      updatedLines[lineIndex] = newText;
      return {
        ...prev,
        [activeTab]: {
          ...current,
          lines: updatedLines
        }
      };
    });
  };

  // Handle AI Chat Submit
  const handleAiSubmit = async (e) => {
    e?.preventDefault();
    if (!aiPrompt.trim() || isAiThinking) return;

    const userText = aiPrompt;
    setAiPrompt("");

    const userMsg = {
      id: Date.now(),
      sender: "user",
      name: "Pushkar Balyan",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: userText
    };

    setChatMessages(prev => [...prev, userMsg]);
    setIsAiThinking(true);

    try {
      const currentCode = fileContents[activeTab]?.lines.join("\n") || "";
      const r = await http.post("/code/run", {
        prompt: userText,
        code: currentCode,
        language: selectedLanguage.toLowerCase(),
        action: "generate"
      });

      const responseText = r.data?.output || `Analyzed requested change for ${activeTab}. Optimized syntax and updated queries safely.`;
      
      setChatMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          name: "Omega Code Assistant",
          avatarBg: "#6366F1",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: responseText
        }
      ]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          name: "Omega Code Assistant",
          avatarBg: "#6366F1",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `Updated code logic for "${userText}". Integrated error boundaries and schema validation.`
        }
      ]);
    }
    setIsAiThinking(false);
  };

  // Run API Test
  const runApiTest = () => {
    toast.success("API Request Executed: 200 OK (246ms)");
  };

  // Run code command
  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    if (!termInput.trim()) return;
    const cmd = termInput.trim();
    setTermInput("");
    setTerminalLogs(prev => [
      ...prev,
      { type: "command", text: `OmegaStore@dev:~/projects/omegastore$ ${cmd}` }
    ]);

    setTimeout(() => {
      if (cmd.includes("test")) {
        setTerminalLogs(prev => [
          ...prev,
          { type: "success", text: "✓ PASS  tests/unit/product.test.ts (2.4s)" },
          { type: "success", text: "✓ PASS  tests/api/routes.test.ts (4.1s)" },
          { type: "blank", text: "" },
          { type: "success", text: "Test Suites: 2 passed, 2 total" }
        ]);
      } else if (cmd.includes("build")) {
        setTerminalLogs(prev => [
          ...prev,
          { type: "stdout", text: "Creating an optimized production build..." },
          { type: "success", text: "✓ Compiled successfully in 14.8s" }
        ]);
      } else {
        setTerminalLogs(prev => [
          ...prev,
          { type: "stdout", text: `Executed: ${cmd}` }
        ]);
      }
    }, 300);
  };

  const activeFileData = fileContents[activeTab] || FILE_CONTENTS["route.ts"];

  // Recursive Tree Component Node Renderer
  const renderTreeNode = (node, depth = 0) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nodeMatches = node.name.toLowerCase().includes(q);
      const childMatches = node.children && node.children.some(c => c.name.toLowerCase().includes(q));
      if (!nodeMatches && !childMatches) return null;
    }

    const isFolder = node.type === "folder";
    const isExpanded = expandedFolders[node.id];
    const indentPx = depth * 14 + 12;

    if (isFolder) {
      return (
        <div key={node.id}>
          <div
            onClick={() => toggleFolder(node.id)}
            style={{
              padding: `3px 12px 3px ${indentPx}px`,
              color: isExpanded ? "#CBD5E1" : "#94A3B8",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              userSelect: "none",
              transition: "all 0.1s ease"
            }}
          >
            {isExpanded ? <ChevronDown style={{ width: 11, height: 11, color: "#94A3B8" }} /> : <ChevronRight style={{ width: 11, height: 11, color: "#64748B" }} />}
            <Folder style={{ width: 12, height: 12, color: node.name.startsWith(".") ? "#64748B" : "#38BDF8" }} />
            <span style={{ fontWeight: isExpanded ? 700 : 500 }}>{node.name}</span>
          </div>

          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      const isSelected = activeTab === node.fileKey;
      return (
        <div
          key={node.id}
          onClick={() => openFile(node.fileKey, node.name)}
          style={{
            padding: `4px 12px 4px ${indentPx + 14}px`,
            color: isSelected ? "#38BDF8" : "#94A3B8",
            background: isSelected ? "rgba(56,189,248,0.12)" : "transparent",
            borderLeft: isSelected ? "2px solid #38BDF8" : "2px solid transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            userSelect: "none",
            fontSize: 11
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FileCode style={{ width: 12, height: 12, color: isSelected ? "#38BDF8" : node.name.endsWith(".tsx") ? "#60A5FA" : node.name.endsWith(".json") ? "#F59E0B" : "#94A3B8" }} />
            <span>{node.name}</span>
          </div>
          {node.badge && (
            <span style={{ fontSize: 9, color: node.badge === "LOCAL" ? "#10B981" : "#38BDF8", fontWeight: 800, background: "rgba(255,255,255,0.04)", padding: "1px 4px", borderRadius: 3 }}>
              {node.badge}
            </span>
          )}
        </div>
      );
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "calc(100vh - 85px)",
      background: "#070B14",
      color: "#E2E8F0",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      borderRadius: 14,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 20px 60px rgba(0,0,0,0.6)"
    }}>

      {/* Hidden Native File & Folder Inputs */}
      <input
        type="file"
        ref={desktopFileInputRef}
        onChange={handleDesktopFileSelect}
        multiple
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={desktopFolderInputRef}
        onChange={handleDesktopFolderSelect}
        multiple
        style={{ display: "none" }}
      />

      {/* ════════════════════════════════════════════════════════════════════
          1. HEADER BAR
         ════════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 18px",
        background: "#0C101D",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexWrap: "wrap",
        gap: 12
      }}>
        {/* Brand logo & title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 15px rgba(99,102,241,0.4)"
          }}>
            <Code2 style={{ width: 18, height: 18, color: "#FFFFFF" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.05em", color: "#FFFFFF", fontFamily: "'Unbounded', sans-serif" }}>
                CODE STUDIO
              </h1>
            </div>
            <p style={{ fontSize: 10, color: "#64748B", fontWeight: 500, letterSpacing: "0.02em" }}>
              Build • Debug • Deploy • Innovate
            </p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#13192B",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "6px 14px",
          width: 380,
          maxWidth: "100%"
        }}>
          <Search style={{ width: 14, height: 14, color: "#64748B" }} />
          <input
            type="text"
            placeholder="Search files, symbols, commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#E2E8F0",
              fontSize: 12,
              width: "100%"
            }}
          />
          <kbd style={{
            background: "#1E293B",
            color: "#94A3B8",
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: "monospace"
          }}>Ctrl K</kbd>
        </div>

        {/* Right Info Badges & User Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>System Time</div>
            <div style={{ fontSize: 11, color: "#CBD5E1", fontFamily: "monospace", fontWeight: 600 }}>
              {timeStr} <span style={{ color: "#64748B", fontSize: 10 }}>{dateStr}</span>
            </div>
          </div>

          <div style={{ height: 24, width: 1, background: "rgba(255,255,255,0.08)" }} />

          {/* AI Agent Status Pill */}
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 9, color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>AI Agent Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
              <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>Active (8)</span>
            </div>
          </div>

          {/* Quick Open Desktop Folder Action */}
          <button
            onClick={triggerDesktopFolderPicker}
            title="Open an entire folder from Desktop or Disk"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)",
              border: "none",
              borderRadius: 7,
              padding: "6px 12px",
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(56,189,248,0.3)"
            }}
          >
            <FolderOpen style={{ width: 13, height: 13, color: "#FFF" }} /> Open Desktop Folder
          </button>

          {/* Notification & Chat icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", cursor: "pointer" }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: "#1E293B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bell style={{ width: 14, height: 14, color: "#94A3B8" }} />
              </div>
              <span style={{ position: "absolute", top: -2, right: -2, background: "#EF4444", color: "#FFF", fontSize: 9, fontWeight: 800, borderRadius: 10, padding: "1px 5px" }}>12</span>
            </div>

            <div style={{ position: "relative", cursor: "pointer" }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: "#1E293B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageSquare style={{ width: 14, height: 14, color: "#94A3B8" }} />
              </div>
              <span style={{ position: "absolute", top: -2, right: -2, background: "#3B82F6", color: "#FFF", fontSize: 9, fontWeight: 800, borderRadius: 10, padding: "1px 5px" }}>7</span>
            </div>
          </div>

          {/* User Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #F43F5E 0%, #FB923C 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#FFF", border: "2px solid #1E293B" }}>
              PB
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#F8FAFC" }}>Pushkar Balyan</div>
              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 500 }}>Super Administrator</div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          2. SUB-HEADER TOOLBAR CONTROLS
         ════════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 18px",
        background: "#0A0E18",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap",
        gap: 10
      }}>
        {/* Left Toolbar Dropdowns & Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Language Picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#13192B", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px" }}>
            <span style={{ fontSize: 10, color: "#64748B" }}>Language</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#F1F5F9", fontSize: 11, fontWeight: 600, outline: "none", cursor: "pointer" }}
            >
              <option value="TypeScript" style={{ background: "#0F172A" }}>TypeScript</option>
              <option value="JavaScript" style={{ background: "#0F172A" }}>JavaScript</option>
              <option value="Python" style={{ background: "#0F172A" }}>Python</option>
              <option value="Go" style={{ background: "#0F172A" }}>Go</option>
              <option value="Rust" style={{ background: "#0F172A" }}>Rust</option>
              <option value="JSON" style={{ background: "#0F172A" }}>JSON</option>
              <option value="Plain Text" style={{ background: "#0F172A" }}>Plain Text</option>
            </select>
          </div>

          {/* Branch Picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#13192B", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px" }}>
            <GitBranch style={{ width: 12, height: 12, color: "#38BDF8" }} />
            <span style={{ fontSize: 10, color: "#64748B" }}>Branch</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#F1F5F9", fontSize: 11, fontWeight: 600, outline: "none", cursor: "pointer" }}
            >
              <option value="main" style={{ background: "#0F172A" }}>main</option>
              <option value="feature/auth" style={{ background: "#0F172A" }}>feature/auth</option>
              <option value="dev" style={{ background: "#0F172A" }}>dev</option>
            </select>
          </div>

          {/* Environment Picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#13192B", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px" }}>
            <span style={{ fontSize: 10, color: "#64748B" }}>Environment</span>
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#F1F5F9", fontSize: 11, fontWeight: 600, outline: "none", cursor: "pointer" }}
            >
              <option value="Development" style={{ background: "#0F172A" }}>Development</option>
              <option value="Staging" style={{ background: "#0F172A" }}>Staging</option>
              <option value="Production" style={{ background: "#0F172A" }}>Production</option>
            </select>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
            <button
              onClick={() => toast.success("Building & Executing OmegaStore code...")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 6,
                padding: "5px 14px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 0 12px rgba(16,185,129,0.3)"
              }}
            >
              <Play style={{ width: 12, height: 12, fill: "#FFF" }} /> Run
            </button>

            <button
              onClick={triggerDesktopFolderPicker}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#13192B",
                border: "1px solid rgba(56,189,248,0.3)",
                color: "#38BDF8",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <FolderOpen style={{ width: 12, height: 12, color: "#38BDF8" }} /> Open Desktop Folder
            </button>

            <button
              onClick={triggerDesktopFilePicker}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#13192B",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#CBD5E1",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <Upload style={{ width: 12, height: 12, color: "#CBD5E1" }} /> Open File
            </button>
          </div>
        </div>

        {/* Right AI Model Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 7,
            padding: "4px 12px"
          }}>
            <Sparkles style={{ width: 14, height: 14, color: "#818CF8" }} />
            <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>AI Model</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#818CF8", fontSize: 11, fontWeight: 700, outline: "none", cursor: "pointer" }}
            >
              <option value="GPT-4o" style={{ background: "#0F172A", color: "#FFF" }}>GPT-4o</option>
              <option value="Claude 3.5 Sonnet" style={{ background: "#0F172A", color: "#FFF" }}>Claude 3.5 Sonnet</option>
              <option value="Gemini 1.5 Pro" style={{ background: "#0F172A", color: "#FFF" }}>Gemini 1.5 Pro</option>
              <option value="DeepSeek Coder" style={{ background: "#0F172A", color: "#FFF" }}>DeepSeek Coder</option>
            </select>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          3. UPPER MAIN WORKSPACE GRID (4 PANELS)
         ════════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "220px 1.4fr 1.1fr 260px",
        gap: 1,
        background: "rgba(255,255,255,0.05)",
        flex: "1 1 auto",
        minHeight: 520
      }}>

        {/* ── PANEL 1: FULLY FUNCTIONAL FILE & FOLDER EXPLORER ── */}
        <div style={{ background: "#0A0D16", display: "flex", flexDirection: "column" }}>
          {/* Header & Quick Action Buttons */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#94A3B8" }}>EXPLORER</span>
            <div style={{ display: "flex", gap: 7, color: "#64748B" }}>
              <FolderOpen onClick={triggerDesktopFolderPicker} title="Open Desktop Folder (Recursively)" style={{ width: 13, height: 13, cursor: "pointer", color: "#38BDF8" }} />
              <Upload onClick={triggerDesktopFilePicker} title="Open Single/Multiple Files" style={{ width: 13, height: 13, cursor: "pointer", color: "#CBD5E1" }} />
              <Plus onClick={addNewFile} title="New Virtual File" style={{ width: 13, height: 13, cursor: "pointer", color: "#CBD5E1" }} />
              <Folder onClick={addNewFolder} title="New Virtual Folder" style={{ width: 13, height: 13, cursor: "pointer", color: "#CBD5E1" }} />
              <RefreshCw onClick={refreshExplorer} title="Refresh Tree" style={{ width: 12, height: 12, cursor: "pointer", color: "#CBD5E1" }} />
            </div>
          </div>

          {/* Desktop Direct Import Folder Banner */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 10px 4px 10px" }}>
            <button
              onClick={triggerDesktopFolderPicker}
              style={{
                width: "100%",
                padding: "6px 10px",
                background: "linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(99,102,241,0.15) 100%)",
                border: "1px solid rgba(56,189,248,0.3)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "#38BDF8",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <FolderOpen style={{ width: 13, height: 13, color: "#38BDF8" }} /> Open Desktop Folder
            </button>

            <button
              onClick={triggerDesktopFilePicker}
              style={{
                width: "100%",
                padding: "4px 8px",
                background: "#13192B",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                color: "#94A3B8",
                fontSize: 9,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <Upload style={{ width: 11, height: 11 }} /> Open Desktop Files
            </button>
          </div>

          {/* Project Tree Hierarchy */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0", fontSize: 11, fontFamily: "monospace" }}>
            {/* Root item */}
            <div
              onClick={() => toggleFolder("root")}
              style={{ padding: "4px 12px", color: "#F1F5F9", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              {expandedFolders["root"] ? <ChevronDown style={{ width: 12, height: 12, color: "#94A3B8" }} /> : <ChevronRight style={{ width: 12, height: 12, color: "#94A3B8" }} />}
              <Folder style={{ width: 13, height: 13, color: "#38BDF8" }} />
              <span>{projectTree.name}</span>
            </div>

            {/* Tree Children */}
            {expandedFolders["root"] && (
              <div>
                {projectTree.children.map(child => renderTreeNode(child, 1))}
              </div>
            )}
          </div>
        </div>

        {/* ── PANEL 2: MAIN CODE EDITOR ── */}
        <div style={{ background: "#0B0F19", display: "flex", flexDirection: "column" }}>
          {/* File Tabs */}
          <div style={{ display: "flex", alignItems: "center", background: "#070A12", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
            {openTabs.map(tabKey => {
              const tabName = tabKey.includes("/") ? tabKey.split("/").pop() : tabKey.replace(/^local_folder_\d+_|^desktop_\d+_/, '');

              return (
                <div
                  key={tabKey}
                  onClick={() => setActiveTab(tabKey)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 14px",
                    fontSize: 11,
                    fontFamily: "monospace",
                    cursor: "pointer",
                    color: activeTab === tabKey ? "#F8FAFC" : "#64748B",
                    background: activeTab === tabKey ? "#0B0F19" : "transparent",
                    borderTop: activeTab === tabKey ? "2px solid #38BDF8" : "2px solid transparent",
                    borderRight: "1px solid rgba(255,255,255,0.04)"
                  }}
                >
                  <span style={{ fontSize: 10, color: activeTab === tabKey ? "#38BDF8" : "#64748B", fontWeight: 700 }}>
                    {tabName.endsWith(".ts") ? "TS" : tabName.endsWith(".tsx") ? "TSX" : tabName.endsWith(".json") ? "JSON" : "DOC"}
                  </span>
                  <span>{tabName}</span>
                  <X
                    onClick={(e) => closeTab(e, tabKey)}
                    style={{ width: 11, height: 11, opacity: 0.5, borderRadius: 2 }}
                  />
                </div>
              );
            })}
          </div>

          {/* Breadcrumb Path */}
          <div style={{ padding: "5px 14px", fontSize: 10, color: "#64748B", fontFamily: "monospace", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{activeFileData.path}</span>
          </div>

          {/* Interactive Code Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.6, background: "#0B0F19", position: "relative" }}>
            {activeFileData.lines.map((lineText, idx) => (
              <div key={idx} style={{ display: "flex", padding: "0 16px" }}>
                <span style={{ width: 34, color: "#475569", userSelect: "none", fontSize: 11, textAlign: "right", paddingRight: 14 }}>
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={lineText}
                  onChange={(e) => handleLineChange(idx, e.target.value)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#E2E8F0",
                    fontFamily: "inherit",
                    fontSize: 12,
                    padding: 0
                  }}
                />
              </div>
            ))}

            {/* Code Minimap overlay simulation on right edge */}
            <div style={{
              position: "absolute",
              right: 2,
              top: 10,
              width: 45,
              bottom: 10,
              opacity: 0.25,
              background: "rgba(255,255,255,0.02)",
              pointerEvents: "none",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.04)"
            }} />
          </div>

          {/* Editor Footer Status Bar */}
          <div style={{ padding: "4px 14px", background: "#070A12", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "#64748B", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "monospace" }}>
            <div style={{ display: "flex", gap: 14 }}>
              <span>Ln {activeFileData.lines.length}, Col 1</span>
              <span>Spaces: 2</span>
              <span>UTF-8</span>
              <span>LF</span>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ color: "#38BDF8" }}>{activeFileData.lang}</span>
              <span style={{ color: "#10B981" }}>✓ Prettier</span>
            </div>
          </div>
        </div>

        {/* ── PANEL 3: AI CODE ASSISTANT ── */}
        <div style={{ background: "#0A0D16", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles style={{ width: 14, height: 14, color: "#818CF8" }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: "#F1F5F9" }}>AI CODE ASSISTANT</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, background: "rgba(99,102,241,0.2)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>
                {selectedModel}
              </span>
            </div>
          </div>

          {/* Chat History Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {chatMessages.map((msg) => (
              <div key={msg.id} style={{ display: "flex", gap: 10 }}>
                {/* Avatar */}
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: msg.sender === "ai" ? "linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)" : "linear-gradient(135deg, #F43F5E 0%, #FB923C 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#FFF",
                  flexShrink: 0
                }}>
                  {msg.sender === "ai" ? "Ω" : "PB"}
                </div>

                {/* Body */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: msg.sender === "ai" ? "#818CF8" : "#F8FAFC" }}>{msg.name}</span>
                    <span style={{ fontSize: 9, color: "#64748B" }}>{msg.time}</span>
                  </div>

                  <p style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.5, background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                    {msg.text}
                  </p>

                  {/* Optional Inline Code Card */}
                  {msg.codeSnippet && (
                    <div style={{
                      marginTop: 8,
                      background: "#070A12",
                      border: "1px solid rgba(99,102,241,0.3)",
                      borderRadius: 8,
                      overflow: "hidden"
                    }}>
                      <div style={{ padding: "6px 10px", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#818CF8" }}>{msg.codeSnippet.title}</span>
                        <span style={{ fontSize: 9, color: "#64748B", fontWeight: 700 }}>{msg.codeSnippet.lang}</span>
                      </div>
                      <pre style={{ padding: 10, margin: 0, fontSize: 10, fontFamily: "monospace", color: "#38BDF8", overflowX: "auto" }}>
                        {msg.codeSnippet.code}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Prompt Input Form */}
          <form onSubmit={handleAiSubmit} style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.06)", background: "#070A12" }}>
            <div style={{
              background: "#13192B",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 6
            }}>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleAiSubmit(e); }}
                placeholder="Ask me anything about your code..."
                rows={2}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#F8FAFC",
                  fontSize: 11,
                  resize: "none",
                  fontFamily: "inherit"
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 10, color: "#64748B", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>Model:</span>
                  <span style={{ color: "#818CF8", fontWeight: 600 }}>{selectedModel}</span>
                </div>
                <button
                  type="submit"
                  disabled={isAiThinking}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                    border: "none",
                    color: "#FFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 0 10px rgba(99,102,241,0.4)"
                  }}
                >
                  <Send style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* ── PANEL 4: AI MODELS & AGENT ACTIVITY ── */}
        <div style={{ background: "#070A12", display: "flex", flexDirection: "column", gap: 1, borderLeft: "1px solid rgba(255,255,255,0.06)" }}>

          {/* Top Card: AI MODELS */}
          <div style={{ background: "#0A0D16", padding: 12, flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "#94A3B8" }}>AI MODELS</span>
              <span style={{ fontSize: 9, color: "#64748B" }}>Model Router: <strong style={{ color: "#CBD5E1" }}>Balanced</strong></span>
            </div>

            {/* Models list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {[
                { name: "GPT-4o", provider: "OpenAI", status: "Active", statusColor: "#10B981", active: true },
                { name: "Claude 3.5 Sonnet", provider: "Anthropic", status: "Ready", statusColor: "#38BDF8", active: false },
                { name: "Gemini 1.5 Pro", provider: "Google", status: "Ready", statusColor: "#38BDF8", active: false },
                { name: "Code Llama 3", provider: "Meta", status: "Local", statusColor: "#A855F7", active: false },
                { name: "DeepSeek Coder", provider: "DeepSeek", status: "Ready", statusColor: "#38BDF8", active: false }
              ].map(m => (
                <div key={m.name} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: m.active ? "rgba(99,102,241,0.12)" : "#111726",
                  border: m.active ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.04)"
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: m.active ? "#818CF8" : "#E2E8F0" }}>{m.name}</div>
                    <div style={{ fontSize: 9, color: "#64748B" }}>{m.provider}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: m.statusColor, background: `${m.statusColor}18`, padding: "2px 6px", borderRadius: 4 }}>
                    {m.status}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => toast.info("Model Router configured for automatic fallback.")}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "6px",
                background: "#1E293B",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "#818CF8",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Manage Models
            </button>
          </div>

          {/* Bottom Card: AGENT ACTIVITY */}
          <div style={{ background: "#0A0D16", padding: 12, flex: 1.2, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "#94A3B8" }}>AGENT ACTIVITY</span>
              <span style={{ fontSize: 9, color: "#38BDF8", cursor: "pointer", fontWeight: 600 }}>View All</span>
            </div>

            {/* Active agents list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1, overflowY: "auto" }}>
              {[
                { title: "Code Architect", desc: "Designing system architecture", icon: "📐" },
                { title: "Code Reviewer", desc: "Reviewing Pull Request #45", icon: "🔍" },
                { title: "Test Generator", desc: "Generating unit tests", icon: "🧪" },
                { title: "Security Scanner", desc: "Scanning for vulnerabilities", icon: "🛡️" },
                { title: "Documentation AI", desc: "Updating documentation", icon: "📄" },
                { title: "Performance Analyzer", desc: "Analyzing performance", icon: "⚡" }
              ].map(a => (
                <div key={a.title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12 }}>{a.icon}</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#F1F5F9" }}>{a.title}</div>
                      <div style={{ fontSize: 9, color: "#64748B" }}>{a.desc}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: "#10B981", fontWeight: 700 }}>Active</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          4. LOWER DASHBOARD UTILITY MODULES (GRID OF PANELS)
         ════════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 12,
        padding: 14,
        background: "#050810",
        borderTop: "1px solid rgba(255,255,255,0.06)"
      }}>

        {/* ── CARD 1: TERMINAL ── */}
        <div style={{ background: "#0A0D16", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", padding: 12, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TerminalIcon style={{ width: 13, height: 13, color: "#10B981" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9" }}>TERMINAL</span>
            </div>
            <span style={{ fontSize: 9, color: "#64748B", fontFamily: "monospace" }}>bash ▾</span>
          </div>

          <div style={{ flex: 1, background: "#05070E", borderRadius: 6, padding: 8, fontFamily: "monospace", fontSize: 10, lineHeight: 1.5, overflowY: "auto", maxHeight: 120 }}>
            {terminalLogs.map((log, idx) => (
              <div key={idx} style={{
                color: log.type === "command" ? "#38BDF8" : log.type === "success" ? "#10B981" : log.type === "brand" ? "#C084FC" : "#94A3B8"
              }}>
                {log.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleTerminalSubmit} style={{ marginTop: 6, display: "flex", gap: 6 }}>
            <input
              type="text"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              placeholder="npm run test..."
              style={{ flex: 1, background: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "4px 8px", color: "#FFF", fontSize: 10, fontFamily: "monospace" }}
            />
          </form>
        </div>

        {/* ── CARD 2: BUILD & TEST ── */}
        <div style={{ background: "#0A0D16", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9" }}>BUILD & TEST</span>
            <CheckCircle2 style={{ width: 13, height: 13, color: "#10B981" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 10 }}>
            {[
              { name: "Linting", status: "Passed", time: "2.1s" },
              { name: "Type Checking", status: "Passed", time: "3.4s" },
              { name: "Unit Tests", status: "Passed", time: "12.8s" },
              { name: "Integration Tests", status: "Passed", time: "18.6s" },
              { name: "Build", status: "Passed", time: "24.3s" }
            ].map(t => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#94A3B8" }}>{t.name}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#10B981", fontWeight: 700 }}>● {t.status}</span>
                  <span style={{ color: "#64748B", fontFamily: "monospace" }}>{t.time}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, padding: "4px 8px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 4, fontSize: 9, color: "#10B981", fontWeight: 700, textAlign: "center" }}>
            🎉 All checks passed!
          </div>
        </div>

        {/* ── CARD 3: GIT & GITHUB ── */}
        <div style={{ background: "#0A0D16", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", padding: 12, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9" }}>GIT & GITHUB</span>
              <span style={{ fontSize: 9, color: "#10B981", fontWeight: 600 }}>+ Up to date</span>
            </div>

            <div style={{ fontSize: 9, color: "#64748B", marginBottom: 6 }}>Recent Commits</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
              <div style={{ color: "#E2E8F0", fontWeight: 600 }}>Add advanced product filtering</div>
              <div style={{ color: "#E2E8F0" }}>Fix authentication middleware</div>
              <div style={{ color: "#94A3B8" }}>Update UI components</div>
            </div>
          </div>

          <button
            onClick={() => toast.success("Pull Request #46 created successfully!")}
            style={{
              marginTop: 10,
              padding: "6px",
              background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)",
              border: "none",
              borderRadius: 6,
              color: "#FFF",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Create Pull Request
          </button>
        </div>

        {/* ── CARD 4: CI/CD PIPELINE ── */}
        <div style={{ background: "#0A0D16", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9" }}>CI/CD PIPELINE</span>
            <span style={{ fontSize: 9, color: "#10B981" }}>Live</span>
          </div>

          {/* Stepper nodes */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", margin: "14px 0" }}>
            {["Code", "Build", "Test", "Security", "Deploy"].map((step) => (
              <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 1 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 8px rgba(16,185,129,0.5)" }}>
                  <Check style={{ width: 11, height: 11, color: "#FFF" }} />
                </div>
                <span style={{ fontSize: 9, color: "#CBD5E1", fontWeight: 600 }}>{step}</span>
              </div>
            ))}
            {/* Connection line */}
            <div style={{ position: "absolute", top: 10, left: 10, right: 10, height: 2, background: "#10B981", zIndex: 0 }} />
          </div>

          <div style={{ fontSize: 9, color: "#64748B", textAlign: "center" }}>
            Production: Deployed successfully (2m ago)
          </div>
        </div>

        {/* ── CARD 5: API TESTER ── */}
        <div style={{ background: "#0A0D16", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9" }}>API TESTER</span>
            <span style={{ fontSize: 9, color: "#10B981", fontWeight: 700 }}>200 OK</span>
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            <span style={{ background: "#6366F1", color: "#FFF", fontSize: 9, fontWeight: 800, padding: "4px 6px", borderRadius: 4 }}>GET</span>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              style={{ flex: 1, background: "#05070E", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "3px 6px", color: "#94A3B8", fontSize: 9, fontFamily: "monospace" }}
            />
            <button
              onClick={runApiTest}
              style={{ background: "#10B981", border: "none", color: "#FFF", padding: "4px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer" }}
            >
              Send
            </button>
          </div>

          <div style={{ background: "#05070E", padding: 6, borderRadius: 4, fontSize: 9, color: "#38BDF8", fontFamily: "monospace", overflowX: "auto" }}>
            Time: 246ms | Size: 1.2KB
          </div>
        </div>

        {/* ── CARD 6: DATABASE EXPLORER ── */}
        <div style={{ background: "#0A0D16", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9" }}>DATABASE EXPLORER</span>
            <Database style={{ width: 13, height: 13, color: "#38BDF8" }} />
          </div>
          <div style={{ fontSize: 9, color: "#64748B", marginBottom: 6 }}>PostgreSQL: <strong style={{ color: "#CBD5E1" }}>omegastore_db</strong></div>

          <div style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "monospace" }}>
            <div style={{ fontWeight: 700, color: "#38BDF8" }}>▼ products (table)</div>
            <div style={{ paddingLeft: 12, color: "#94A3B8", fontSize: 9 }}>
              <div>id (uuid, PK)</div>
              <div>name (varchar)</div>
              <div>price (numeric)</div>
              <div>stock (integer)</div>
            </div>
          </div>
        </div>

        {/* ── CARD 7: CODE REVIEW ── */}
        <div style={{ background: "#0A0D16", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", padding: 12, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9" }}>CODE REVIEW</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#10B981" }}>92/100</span>
            </div>
            <div style={{ fontSize: 9, color: "#64748B" }}>Pull Request #45 - Excellent</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8, fontSize: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#94A3B8" }}>
                <span>Code Quality</span>
                <span style={{ color: "#10B981", fontWeight: 700 }}>Excellent</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#94A3B8" }}>
                <span>Security</span>
                <span style={{ color: "#10B981", fontWeight: 700 }}>Excellent</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => toast.info("Opening detailed code review metrics...")}
            style={{ marginTop: 10, padding: "5px", background: "#1E293B", border: "none", borderRadius: 4, color: "#CBD5E1", fontSize: 9, fontWeight: 700, cursor: "pointer" }}
          >
            View Review
          </button>
        </div>

        {/* ── CARD 8: SECURITY SCANNER ── */}
        <div style={{ background: "#0A0D16", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9" }}>SECURITY SCANNER</span>
            <ShieldCheck style={{ width: 13, height: 13, color: "#10B981" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, textAlign: "center" }}>
            <div style={{ background: "#111726", padding: 4, borderRadius: 4, border: "1px solid #EC4899" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#EC4899" }}>0</div>
              <div style={{ fontSize: 8, color: "#64748B" }}>Crit</div>
            </div>
            <div style={{ background: "#111726", padding: 4, borderRadius: 4, border: "1px solid #F59E0B" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#F59E0B" }}>1</div>
              <div style={{ fontSize: 8, color: "#64748B" }}>High</div>
            </div>
            <div style={{ background: "#111726", padding: 4, borderRadius: 4, border: "1px solid #EAB308" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#EAB308" }}>3</div>
              <div style={{ fontSize: 8, color: "#64748B" }}>Med</div>
            </div>
            <div style={{ background: "#111726", padding: 4, borderRadius: 4, border: "1px solid #3B82F6" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#3B82F6" }}>8</div>
              <div style={{ fontSize: 8, color: "#64748B" }}>Low</div>
            </div>
          </div>
        </div>

        {/* ── CARD 9: PERFORMANCE PROFILER ── */}
        <div style={{ background: "#0A0D16", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", padding: 12, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9" }}>PERFORMANCE PROFILER</span>
              <Activity style={{ width: 13, height: 13, color: "#A855F7" }} />
            </div>

            <div style={{ fontSize: 9, color: "#94A3B8" }}>Requests: <strong>1,246 (+8%)</strong></div>
            <div style={{ fontSize: 9, color: "#94A3B8" }}>Avg Latency: <strong>245ms</strong></div>

            {/* Sparkline chart SVG */}
            <svg viewBox="0 0 100 25" style={{ width: "100%", height: 26, marginTop: 6 }}>
              <path
                d="M0 20 Q 20 5, 40 18 T 80 8 T 100 15 L 100 25 L 0 25 Z"
                fill="rgba(168,85,247,0.15)"
              />
              <path
                d="M0 20 Q 20 5, 40 18 T 80 8 T 100 15"
                fill="none"
                stroke="#A855F7"
                strokeWidth="1.5"
              />
            </svg>
          </div>

          <button
            onClick={() => toast.info("Opening full performance profile...")}
            style={{ marginTop: 6, padding: "5px", background: "#1E293B", border: "none", borderRadius: 4, color: "#CBD5E1", fontSize: 9, fontWeight: 700, cursor: "pointer" }}
          >
            View Full Profile
          </button>
        </div>

      </div>

    </div>
  );
}
