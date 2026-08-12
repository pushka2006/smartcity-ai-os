import { useState, useEffect, useRef, useCallback } from "react";
import { ScanFace, Zap, X, Cpu, Radio, RefreshCw, Download } from "lucide-react";

const FACE_OVAL  = [[10,338],[338,297],[297,332],[332,284],[284,251],[251,389],[389,356],[356,454],[454,323],[323,361],[361,288],[288,397],[397,365],[365,379],[379,378],[378,400],[400,377],[377,152],[152,148],[148,176],[176,149],[149,150],[150,136],[136,172],[172,58],[58,132],[132,93],[93,234],[234,127],[127,162],[162,21],[21,54],[54,103],[103,67],[67,109],[109,10]];
const LEFT_EYE   = [[362,382],[382,381],[381,380],[380,374],[374,373],[373,390],[390,249],[249,263],[263,466],[466,388],[388,387],[387,386],[386,385],[385,384],[384,398],[398,362]];
const RIGHT_EYE  = [[33,7],[7,163],[163,144],[144,145],[145,153],[153,154],[154,155],[155,133],[133,173],[173,157],[157,158],[158,159],[159,160],[160,161],[161,246],[246,33]];
const LEFT_BROW  = [[336,296],[296,334],[334,293],[293,300],[300,276],[276,283],[283,282],[282,295],[295,285]];
const RIGHT_BROW = [[46,53],[53,52],[52,65],[65,55],[55,107],[107,66],[66,105],[105,63],[63,70]];
const NOSE       = [[168,6],[6,197],[197,195],[195,5],[5,4],[4,1],[1,19],[19,94]];
const LIPS_OUT   = [[61,146],[146,91],[91,181],[181,84],[84,17],[17,314],[314,405],[405,321],[321,375],[375,291],[291,409],[409,270],[270,269],[269,267],[267,0],[0,37],[37,39],[39,40],[40,185],[185,61]];
const LIPS_IN    = [[78,95],[95,88],[88,178],[178,87],[87,14],[14,317],[317,402],[402,318],[318,324],[324,308],[308,415],[415,310],[310,311],[311,312],[312,13],[13,82],[82,81],[81,80],[80,191],[191,78]];
const KEY_DOTS   = [1,4,9,10,33,61,93,127,132,133,152,162,172,176,234,263,291,297,338,356,362,389,397,454];

function makeGenericFace() {
  const lm = {};
  const ovalIdx=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
  ovalIdx.forEach((idx,i)=>{const a=(i/ovalIdx.length)*Math.PI*2-Math.PI/2;lm[idx]={x:0.5+Math.cos(a)*0.31,y:0.48+Math.sin(a)*0.40,z:0};});
  const leIdx=[362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
  leIdx.forEach((idx,i)=>{const a=(i/leIdx.length)*Math.PI*2;lm[idx]={x:0.35+Math.cos(a)*0.054,y:0.38+Math.sin(a)*0.030,z:0.06};});
  const reIdx=[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
  reIdx.forEach((idx,i)=>{const a=(i/reIdx.length)*Math.PI*2;lm[idx]={x:0.65+Math.cos(a)*0.054,y:0.38+Math.sin(a)*0.030,z:0.06};});
  const lbIdx=[336,296,334,293,300,276,283,282,295,285];
  lbIdx.forEach((idx,i)=>{const t=i/(lbIdx.length-1);lm[idx]={x:0.27+t*0.13,y:0.29-Math.sin(t*Math.PI)*0.022,z:0.04};});
  const rbIdx=[46,53,52,65,55,107,66,105,63,70];
  rbIdx.forEach((idx,i)=>{const t=i/(rbIdx.length-1);lm[idx]={x:0.60+t*0.13,y:0.29-Math.sin(t*Math.PI)*0.022,z:0.04};});
  const noseIdx=[168,6,197,195,5,4,1,19,94];
  noseIdx.forEach((idx,i)=>{const t=i/(noseIdx.length-1);lm[idx]={x:0.5,y:0.37+t*0.20,z:0.05+t*0.09};});
  const loIdx=[61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185];
  loIdx.forEach((idx,i)=>{const a=(i/loIdx.length)*Math.PI*2;lm[idx]={x:0.5+Math.cos(a)*0.098,y:0.65+Math.sin(a)*0.042,z:0.09};});
  const liIdx=[78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191];
  liIdx.forEach((idx,i)=>{const a=(i/liIdx.length)*Math.PI*2;lm[idx]={x:0.5+Math.cos(a)*0.062,y:0.65+Math.sin(a)*0.026,z:0.10};});
  const result=[];
  for(let i=0;i<468;i++){
    if(lm[i]){result.push(lm[i]);continue;}
    const u=(i/468)*Math.PI*4.5;const v=(((i*7)%468)/468)*Math.PI;
    result.push({x:0.5+Math.sin(v)*Math.cos(u)*0.26,y:0.48+Math.cos(v)*0.36+Math.sin(v)*Math.sin(u)*0.08,z:Math.sin(v)*Math.cos(u)*0.09});
  }
  return result;
}
const GENERIC_FACE = makeGenericFace();

function loadScript(src){
  return new Promise((res,rej)=>{
    if(document.querySelector(`script[src="${src}"]`)){res();return;}
    const s=document.createElement("script");s.src=src;s.crossOrigin="anonymous";
    s.onload=res;s.onerror=rej;document.head.appendChild(s);
  });
}

export default function VirtualFace() {
  const [phase,setPhase]               = useState("idle");
  const [scanPct,setScanPct]           = useState(0);
  const [faceConf,setFaceConf]         = useState(0);
  const [lmCount,setLmCount]           = useState(0);
  const [hologramBuilt,setHologramBuilt] = useState(false);
  const [camError,setCamError]         = useState("");
  const [simMode,setSimMode]           = useState(false);

  const [autoRotate,setAutoRotate]     = useState(true);

  const videoRef      = useRef(null);
  const scanCanvasRef = useRef(null);
  const holoCanvasRef = useRef(null);
  const landmarksRef  = useRef(null);
  const phaseRef      = useRef("idle");
  const faceMeshRef   = useRef(null);
  const cameraRef     = useRef(null);
  const streamRef     = useRef(null);
  const scanPosRef    = useRef(60);
  const scanDirRef    = useRef(1);
  const ringRotRef    = useRef(0);
  const simModeRef    = useRef(false);
  const autoRotateRef  = useRef(true);
  const rotYRef        = useRef(0);
  const rotXRef        = useRef(0.15);
  const isDraggingRef  = useRef(false);
  const prevMouseRef   = useRef({ x: 0, y: 0 });
  const detectTimeoutRef = useRef(null);
  const topologyBuiltRef = useRef(false);
  const liveTopologyRef   = useRef([]);
  const genericTopologyRef = useRef([]);

  useEffect(()=>{phaseRef.current=phase;},[phase]);
  useEffect(()=>{simModeRef.current=simMode;},[simMode]);
  useEffect(()=>{autoRotateRef.current=autoRotate;},[autoRotate]);

  const buildFaceTopology = useCallback((lm) => {
    if (!lm || lm.length === 0) return [];
    const conns = [];
    const visited = new Set();
    for (let i = 0; i < lm.length; i++) {
      const pi = lm[i];
      if (!pi) continue;
      const candidates = [];
      for (let j = 0; j < lm.length; j++) {
        if (i === j) continue;
        const pj = lm[j];
        if (!pj) continue;
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const dz = (pi.z || 0) - (pj.z || 0);
        const dist = dx*dx + dy*dy + dz*dz;
        candidates.push({ index: j, dist });
      }
      candidates.sort((a, b) => a.dist - b.dist);
      const nearest = candidates.slice(0, 3);
      nearest.forEach(n => {
        const key = i < n.index ? `${i}-${n.index}` : `${n.index}-${i}`;
        if (!visited.has(key)) {
          visited.add(key);
          conns.push([i, n.index]);
        }
      });
    }
    return conns;
  }, []);

  useEffect(() => {
    genericTopologyRef.current = buildFaceTopology(GENERIC_FACE);
  }, [buildFaceTopology]);

  const initMediaPipe = useCallback(async()=>{
    try{
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js");
      const fm=new window.FaceMesh({locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${f}`});
      fm.setOptions({maxNumFaces:1,refineLandmarks:true,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
      fm.onResults((results)=>{
        if(results.multiFaceLandmarks?.length>0){
          const lm = results.multiFaceLandmarks[0];
          landmarksRef.current=lm;
          setLmCount(lm.length);
          setFaceConf(0.97+Math.random()*0.025);
          if(!topologyBuiltRef.current){
            liveTopologyRef.current = buildFaceTopology(lm);
            topologyBuiltRef.current = true;
          }
          if(phaseRef.current==="detecting"){setHologramBuilt(true);setPhase("live");setScanPct(100);}
        }
      });
      await fm.initialize();
      faceMeshRef.current=fm;
      return true;
    }catch(e){console.warn("MediaPipe CDN failed:",e);return false;}
  },[buildFaceTopology]);

  const startScan = useCallback(async()=>{
    setPhase("scanning");setScanPct(0);setCamError("");
    setHologramBuilt(false);setLmCount(0);setFaceConf(0);setSimMode(false);
    landmarksRef.current=null;
    topologyBuiltRef.current=false;
    liveTopologyRef.current=[];

    let camOk=false;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:"user"},audio:false});
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      camOk=true;
    }catch{setCamError("Camera unavailable — hologram will use simulation mode.");camOk=false;}

    let pct=0;
    const iv=setInterval(async()=>{
      pct+=Math.random()*2.2+0.6;
      if(pct>=100){
        clearInterval(iv);setScanPct(100);setPhase("detecting");
        const mpOk=await initMediaPipe();
        if(mpOk&&camOk&&videoRef.current&&window.Camera){
          const cam=new window.Camera(videoRef.current,{
            onFrame:async()=>{if(faceMeshRef.current&&videoRef.current)await faceMeshRef.current.send({image:videoRef.current});},
            width:640,height:480,
          });
          cam.start();cameraRef.current=cam;

          if(detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
          detectTimeoutRef.current = setTimeout(()=>{
            if(phaseRef.current==="detecting"&&!landmarksRef.current){
              setSimMode(true);landmarksRef.current=GENERIC_FACE;
              setLmCount(468);setFaceConf(0.88);setHologramBuilt(true);setPhase("live");
              setCamError("No face detected in video feed — engaging simulation fallback.");
            }
          },5500);
        }else{
          setTimeout(()=>{
            setSimMode(true);landmarksRef.current=GENERIC_FACE;
            setLmCount(468);setFaceConf(0.88);setHologramBuilt(true);setPhase("live");
          },1300);
        }
      }else{setScanPct(pct);}
    },55);
  },[initMediaPipe]);

  const reset = useCallback(()=>{
    if(detectTimeoutRef.current){clearTimeout(detectTimeoutRef.current);detectTimeoutRef.current=null;}
    if(cameraRef.current){try{cameraRef.current.stop();}catch{}cameraRef.current=null;}
    if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}
    if(faceMeshRef.current){try{faceMeshRef.current.close();}catch{}faceMeshRef.current=null;}
    landmarksRef.current=null;
    topologyBuiltRef.current=false;
    liveTopologyRef.current=[];
    setPhase("idle");setScanPct(0);setFaceConf(0);setLmCount(0);setHologramBuilt(false);setCamError("");setSimMode(false);
  },[]);

  const captureHologram = useCallback(() => {
    const canvas = holoCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "nexus_hologram_face.png";
    link.href = dataUrl;
    link.click();
  }, []);

  useEffect(()=>()=>{
    if(cameraRef.current)try{cameraRef.current.stop();}catch{}
    if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());
  },[]);

  // ── SCANNER CANVAS LOOP ──────────────────────────────────────────────────
  useEffect(()=>{
    const canvas=scanCanvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");let raf;
    const loop=()=>{
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      const ph=phaseRef.current;
      const color=ph==="live"?"#00FF88":ph==="detecting"?"#6E56FF":"#00F5FF";
      ctx.fillStyle="#010810";ctx.fillRect(0,0,W,H);
      const vid=videoRef.current;
      const hasVideo=vid&&vid.readyState>=2&&streamRef.current;
      if(hasVideo){
        ctx.save();ctx.translate(W,0);ctx.scale(-1,1);ctx.drawImage(vid,0,0,W,H);ctx.restore();
        ctx.fillStyle="rgba(1,8,16,0.20)";ctx.fillRect(0,0,W,H);
      }else{
        const t=Date.now()*0.001;
        ctx.strokeStyle="rgba(0,245,255,0.05)";ctx.lineWidth=1;
        for(let x=0;x<W;x+=22){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
        for(let y=0;y<H;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
        const cx=W/2,cy=H/2-10;
        ctx.strokeStyle="rgba(0,245,255,0.28)";ctx.lineWidth=1.5;
        ctx.beginPath();ctx.ellipse(cx,cy,64,84,Math.sin(t*0.4)*0.04,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle="rgba(0,245,255,0.10)";ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(cx-64,cy);ctx.lineTo(cx+64,cy);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx,cy-84);ctx.lineTo(cx,cy+84);ctx.stroke();
        ctx.fillStyle="#00FF88";ctx.beginPath();
        ctx.arc(cx-22,cy-20,4.5,0,Math.PI*2);ctx.arc(cx+22,cy-20,4.5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle="#FF2E8877";ctx.lineWidth=1.5;
        ctx.beginPath();ctx.ellipse(cx,cy+32,22,9,0,0,Math.PI*2);ctx.stroke();
      }
      const lm=landmarksRef.current;
      if(lm&&["scanning","detecting","live"].includes(ph)){
        const px=(idx)=>{
          if(idx>=lm.length||!lm[idx])return null;
          const rawX=hasVideo?(1-lm[idx].x):lm[idx].x;
          return{x:rawX*W,y:lm[idx].y*H};
        };
        const drawConns=(conns,col,lw=1)=>{
          ctx.strokeStyle=col;ctx.lineWidth=lw;
          conns.forEach(([a,b])=>{const pa=px(a),pb=px(b);if(!pa||!pb)return;ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();});
        };
        drawConns(FACE_OVAL,`${color}55`);
        drawConns(LEFT_EYE,`${color}cc`,1.2);drawConns(RIGHT_EYE,`${color}cc`,1.2);
        drawConns(LEFT_BROW,`${color}88`);drawConns(RIGHT_BROW,`${color}88`);
        drawConns(NOSE,`${color}77`);
        drawConns(LIPS_OUT,"#FF2E88aa",1.3);drawConns(LIPS_IN,"#FF2E8866");
        KEY_DOTS.forEach(idx=>{const p=px(idx);if(!p)return;ctx.fillStyle="#FF2E88";ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();});
      }
      if(["scanning","detecting"].includes(ph)){
        scanPosRef.current+=scanDirRef.current*2.5;
        if(scanPosRef.current>H-36)scanDirRef.current=-1;
        if(scanPosRef.current<36)scanDirRef.current=1;
        const g=ctx.createLinearGradient(0,scanPosRef.current-13,0,scanPosRef.current+13);
        g.addColorStop(0,"rgba(0,245,255,0)");g.addColorStop(0.5,`${color}44`);g.addColorStop(1,"rgba(0,245,255,0)");
        ctx.fillStyle=g;ctx.fillRect(0,scanPosRef.current-13,W,26);
        ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.setLineDash([3,6]);
        ctx.beginPath();ctx.moveTo(0,scanPosRef.current);ctx.lineTo(W,scanPosRef.current);ctx.stroke();
        ctx.setLineDash([]);
      }
      if(ph!=="idle"){
        ringRotRef.current+=0.012;
        ctx.save();ctx.translate(W/2,H/2);ctx.rotate(ringRotRef.current);
        ctx.strokeStyle=`${color}22`;ctx.lineWidth=1;ctx.setLineDash([5,16]);
        ctx.beginPath();ctx.arc(0,0,Math.min(W,H)*0.47,0,Math.PI*2);ctx.stroke();
        ctx.setLineDash([]);ctx.restore();
      }
      const bL=20,bP=10;ctx.strokeStyle=color;ctx.lineWidth=2.2;
      [[bP,bP,1,1],[W-bP,bP,-1,1],[bP,H-bP,1,-1],[W-bP,H-bP,-1,-1]].forEach(([x,y,dx,dy])=>{
        ctx.beginPath();ctx.moveTo(x+dx*bL,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*bL);ctx.stroke();
      });
      ctx.fillStyle=`${color}99`;ctx.font="9px 'JetBrains Mono',monospace";ctx.textAlign="left";
      const st=ph==="live"?"FACE LOCKED — TRACKING":ph==="detecting"?"EXTRACTING LANDMARKS":ph==="scanning"?"SCANNING BIOMETRICS":"STANDBY";
      ctx.fillText(st,bP+4,H-bP-4);ctx.textAlign="right";
      ctx.fillText(`LM:${lm?lm.length:"000"}/468`,W-bP-4,H-bP-4);
      raf=requestAnimationFrame(loop);
    };
    loop();return()=>cancelAnimationFrame(raf);
  },[]);

  // ── HOLOGRAM CANVAS LOOP ─────────────────────────────────────────────────
  useEffect(()=>{
    const canvas=holoCanvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");let raf,t=0,autoRot=0;
    const proj=(lm,idx,rY,rX,scale,cX,cY)=>{
      const pt=lm[idx];if(!pt)return null;
      const center = lm[4] || { x: 0.5, y: 0.5, z: 0 };
      let x=-(pt.x-center.x)*1.85,y=-(pt.y-center.y)*1.85,z=((pt.z||0)-(center.z||0))*1.4;
      const pulse=1+Math.sin(t*2+idx*0.01)*0.007;x*=pulse;y*=pulse;
      const cY2=Math.cos(rY),sY=Math.sin(rY),x1=x*cY2-z*sY,z1=x*sY+z*cY2;
      const cX2=Math.cos(rX),sX=Math.sin(rX),y2=y*cX2-z1*sX,z2=y*sX+z1*cX2;
      const d=2.3,camZ=3.1;
      return{x:(x1*d*scale)/(z2+camZ)+cX,y:(-y2*d*scale)/(z2+camZ)+cY,depth:z2};
    };
    const h2=(v)=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0");
    const drawConns=(lm,conns,color,lw,rY,rX,scale,cX,cY,glow)=>{
      if(glow){ctx.shadowColor=color;ctx.shadowBlur=6;}
      ctx.strokeStyle=color;ctx.lineWidth=lw;
      conns.forEach(([a,b])=>{
        const pa=proj(lm,a,rY,rX,scale,cX,cY),pb=proj(lm,b,rY,rX,scale,cX,cY);
        if(!pa||!pb)return;if(pa.depth>0.85&&pb.depth>0.85)return;
        ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
      });
      if(glow)ctx.shadowBlur=0;
    };
    const loop=()=>{
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);t+=0.016;autoRot+=0.007;
      const ph=phaseRef.current;
      const color=ph==="live"?"#00F5FF":ph==="detecting"?"#6E56FF":"#00F5FF";
      ctx.fillStyle="#010810";ctx.fillRect(0,0,W,H);
      if(ph==="idle"){
        const pr=58+Math.sin(t*1.8)*7;
        ctx.strokeStyle="rgba(0,245,255,0.10)";ctx.lineWidth=1;ctx.setLineDash([4,12]);
        ctx.beginPath();ctx.arc(W/2,H/2,pr,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.arc(W/2,H/2,pr*0.55,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle="rgba(0,245,255,0.10)";ctx.font="bold 10px monospace";ctx.textAlign="center";
        ctx.fillText("HOLOGRAM OFFLINE",W/2,H/2+4);
        ctx.font="8px monospace";ctx.fillStyle="rgba(0,245,255,0.05)";
        ctx.fillText("SCAN FACE TO ACTIVATE",W/2,H/2+18);
        raf=requestAnimationFrame(loop);return;
      }
      const lm=landmarksRef.current;
      if(!lm){raf=requestAnimationFrame(loop);return;}
      const cX=W/2,cY=H/2-12,scale=Math.min(W,H)*0.40;
      let rY,rX;
      if(autoRotateRef.current){
        rY=autoRot;
        rX=0.13+Math.sin(t*0.32)*0.055;
        rotYRef.current=autoRot;
        rotXRef.current=rX;
      }else{
        rY=rotYRef.current;
        rX=rotXRef.current;
      }
      const buildAlpha=ph==="detecting"?Math.min(1,(t%3)/1.8):1;
      // Projector base
      const pY=H-18,pRx=scale*0.87,pRy=11;
      const coneGrad=ctx.createLinearGradient(cX,pY,cX,cY+25);
      coneGrad.addColorStop(0,`${color}26`);coneGrad.addColorStop(0.45,`${color}0e`);coneGrad.addColorStop(1,`${color}00`);
      ctx.fillStyle=coneGrad;ctx.beginPath();
      ctx.moveTo(cX-pRx*0.55,pY);ctx.lineTo(cX-scale*0.37,cY+25);ctx.lineTo(cX+scale*0.37,cY+25);ctx.lineTo(cX+pRx*0.55,pY);
      ctx.closePath();ctx.fill();
      ctx.strokeStyle=`${color}50`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cX,pY,pRx,pRy,0,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=`${color}22`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(cX,pY,pRx*0.65,pRy*0.65,0,0,Math.PI*2);ctx.stroke();
      const cp=1+Math.sin(t*7)*0.12;
      ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=14;
      ctx.beginPath();ctx.ellipse(cX,pY,pRx*0.16*cp,pRy*0.16*cp,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      for(let i=-3;i<=3;i++){ctx.strokeStyle=`${color}08`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cX+i*(pRx*0.15),pY);ctx.lineTo(cX+i*(scale*0.08),cY-20);ctx.stroke();}
      // Face wireframe
      const A=(v)=>h2(buildAlpha*v);
      
      // Dense pre-calculated wireframe grid for sci-fi look (looks like a real detailed face)
      const activeTopology = simModeRef.current ? genericTopologyRef.current : liveTopologyRef.current;
      ctx.strokeStyle=`${color}${A(42)}`;
      ctx.lineWidth=0.55;
      if(activeTopology && activeTopology.length > 0){
        activeTopology.forEach(([a, b])=>{
          const pa=proj(lm,a,rY,rX,scale,cX,cY);
          const pb=proj(lm,b,rY,rX,scale,cX,cY);
          if(!pa||!pb)return;
          if(pa.depth>0.75&&pb.depth>0.75)return;
          ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
        });
      }

      drawConns(lm,FACE_OVAL,`${color}${A(90)}`,1.1,rY,rX,scale,cX,cY);
      drawConns(lm,LEFT_EYE,`${color}${A(240)}`,1.8,rY,rX,scale,cX,cY,true);
      drawConns(lm,RIGHT_EYE,`${color}${A(240)}`,1.8,rY,rX,scale,cX,cY,true);
      drawConns(lm,LEFT_BROW,`${color}${A(180)}`,1.2,rY,rX,scale,cX,cY);
      drawConns(lm,RIGHT_BROW,`${color}${A(180)}`,1.2,rY,rX,scale,cX,cY);
      drawConns(lm,NOSE,`${color}${A(160)}`,1.0,rY,rX,scale,cX,cY);
      drawConns(lm,LIPS_OUT,`#FF2E88${A(220)}`,1.8,rY,rX,scale,cX,cY,true);
      drawConns(lm,LIPS_IN,`#FF2E88${A(130)}`,1.0,rY,rX,scale,cX,cY);
      // Glow nodes
      KEY_DOTS.forEach(idx=>{
        const pt=proj(lm,idx,rY,rX,scale,cX,cY);
        if(!pt||pt.depth>0.55)return;
        const alpha=Math.max(0,1-pt.depth)*buildAlpha;
        ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=10;
        ctx.beginPath();ctx.arc(pt.x,pt.y,2.2,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;ctx.globalAlpha=1;
      });
      // HUD rings
      const br=scale*1.24;
      ctx.strokeStyle=`${color}16`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(cX,cY,br,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([5,16]);ctx.strokeStyle=`${color}24`;ctx.beginPath();ctx.arc(cX,cY,br*1.08,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      // Corner brackets
      ctx.strokeStyle=`${color}42`;ctx.lineWidth=1.5;
      [[cX-br,cY-br,1,1],[cX+br,cY-br,-1,1],[cX-br,cY+br,1,-1],[cX+br,cY+br,-1,-1]].forEach(([ox,oy,dx,dy])=>{
        ctx.beginPath();ctx.moveTo(ox+dx*14,oy);ctx.lineTo(ox,oy);ctx.lineTo(ox,oy+dy*14);ctx.stroke();
      });
      if(ph==="detecting"){const sy=cY-br+((t*52)%(br*2));ctx.fillStyle=`${color}10`;ctx.fillRect(cX-br,sy,br*2,3);}
      if(ph==="live"){const scanY=(t*40)%H;const grL=ctx.createLinearGradient(0,scanY,0,scanY+3);grL.addColorStop(0,"rgba(0,245,255,0)");grL.addColorStop(0.5,"rgba(0,245,255,0.04)");grL.addColorStop(1,"rgba(0,245,255,0)");ctx.fillStyle=grL;ctx.fillRect(0,scanY,W,3);}
      ctx.fillStyle=`${color}55`;ctx.font="7.5px 'JetBrains Mono',monospace";
      ctx.textAlign="left";ctx.fillText(`ROT-Y: ${((autoRot%(Math.PI*2))*57.3).toFixed(1)}°`,cX-br+8,cY-br+14);
      ctx.fillText(`LM: ${lm.length}/468`,cX-br+8,cY-br+24);
      ctx.fillText(`SYS: ${simModeRef.current?"SIM-FACE":"LIVE-TRACK"}`,cX-br+8,cY+br-8);
      ctx.textAlign="right";ctx.fillText(`DEPTH: ${(Math.sin(t+0.8)*0.5+0.5).toFixed(3)}`,cX+br-8,cY-br+14);
      ctx.fillText("MESH: 3D-WIRE",cX+br-8,cY+br-8);
      raf=requestAnimationFrame(loop);
    };
    loop();return()=>cancelAnimationFrame(raf);
  },[]);

  const mainColor=phase==="live"?"#00FF88":phase==="detecting"?"#6E56FF":"#00F5FF";
  const card={background:"rgba(2,6,23,0.65)",border:"1px solid rgba(0,245,255,0.12)",backdropFilter:"blur(16px)",borderRadius:14};

  return(
    <div style={{minHeight:"calc(100vh - 112px)",display:"flex",flexDirection:"column",gap:14}}>

      {/* Header */}
      <div style={{...card,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(0,245,255,0.08)",border:"1px solid rgba(0,245,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <ScanFace style={{width:18,height:18,color:"#00F5FF"}}/>
          </div>
          <div>
            <div style={{fontFamily:"monospace",fontSize:13,color:"#00F5FF",letterSpacing:"0.16em",fontWeight:700}}>VIRTUAL FACE</div>
            <div style={{fontFamily:"monospace",fontSize:8,color:"rgba(148,163,184,0.4)",letterSpacing:"0.12em",marginTop:2}}>HOLOGRAPHIC IDENTITY PROJECTION SYSTEM</div>
          </div>
        </div>
        <div style={{display:"flex",gap:28}}>
          {[["LANDMARKS",lmCount?`${lmCount}/468`:"---/468",phase==="live"?"#00FF88":"#00F5FF"],["CONFIDENCE",faceConf?`${(faceConf*100).toFixed(1)}%`:"0.0%",phase==="live"?"#00FF88":"#00F5FF"],["STATUS",phase.toUpperCase(),mainColor],["HOLOGRAM",hologramBuilt?"LIVE":"OFFLINE",hologramBuilt?"#00FF88":"rgba(148,163,184,0.3)"],...(simMode?[["MODE","SIMULATION","#FFC857"]]:[])].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontFamily:"monospace",fontSize:8,color:"rgba(148,163,184,0.38)",letterSpacing:"0.1em",marginBottom:2}}>{l}</div>
              <div style={{fontFamily:"monospace",fontSize:11,color:c,fontWeight:700}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Two panels */}
      <div style={{display:"flex",gap:14,flex:1}}>

        {/* SCANNER */}
        <div style={{...card,flex:1,padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Radio style={{width:11,height:11,color:mainColor}}/>
              <span style={{fontFamily:"monospace",fontSize:9,color:mainColor,letterSpacing:"0.14em"}}>BIOMETRIC SCANNER</span>
            </div>
            <span style={{fontFamily:"monospace",fontSize:9,color:phase==="live"?"#00FF88":"rgba(148,163,184,0.35)"}}>
              {phase==="live"?"● FACE LOCKED":phase==="detecting"?"◉ DETECTING":phase==="scanning"?"◎ SCANNING":"○ STANDBY"}
            </span>
          </div>
          <div style={{flex:1,borderRadius:10,overflow:"hidden",minHeight:340,border:`1px solid rgba(${phase==="live"?"0,255,136":"0,245,255"},0.15)`,position:"relative"}}>
            <canvas ref={scanCanvasRef} width={480} height={360} style={{width:"100%",height:"100%",display:"block"}}/>
            <video ref={videoRef} style={{display:"none"}} width={640} height={480} playsInline muted/>
          </div>
          {camError&&<div style={{fontSize:9,color:"#fbbf24",fontFamily:"monospace",padding:"5px 10px",background:"rgba(251,191,36,0.07)",borderRadius:6,border:"1px solid rgba(251,191,36,0.18)"}}>⚠ {camError}</div>}
          {["scanning","detecting"].includes(phase)&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontFamily:"monospace",fontSize:8,color:"rgba(148,163,184,0.45)"}}>
                <span>{phase==="detecting"?"EXTRACTING FACIAL GEOMETRY":"BIOMETRIC SCAN IN PROGRESS"}</span>
                <span>{Math.round(scanPct)}%</span>
              </div>
              <div style={{height:3,background:"rgba(0,245,255,0.08)",borderRadius:2}}>
                <div style={{height:"100%",width:`${scanPct}%`,background:phase==="detecting"?"#6E56FF":"#00F5FF",borderRadius:2,transition:"width 0.08s",boxShadow:`0 0 8px ${phase==="detecting"?"#6E56FF":"#00F5FF"}`}}/>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            {phase==="idle"?(
              <button onClick={startScan} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"11px 16px",background:"rgba(0,245,255,0.10)",border:"1px solid rgba(0,245,255,0.30)",borderRadius:9,color:"#00F5FF",cursor:"pointer",fontFamily:"monospace",fontSize:11,letterSpacing:"0.12em",transition:"all 0.15s",boxShadow:"0 0 20px rgba(0,245,255,0.08)"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,245,255,0.20)";e.currentTarget.style.boxShadow="0 0 28px rgba(0,245,255,0.18)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,245,255,0.10)";e.currentTarget.style.boxShadow="0 0 20px rgba(0,245,255,0.08)";}}>
                <Zap style={{width:13,height:13}}/> INITIATE FACE SCAN
              </button>
            ):(
              <>
                <button onClick={reset} style={{display:"flex",alignItems:"center",gap:6,padding:"11px 18px",background:"rgba(255,77,77,0.08)",border:"1px solid rgba(255,77,77,0.25)",borderRadius:9,color:"#FF4D4D",cursor:"pointer",fontFamily:"monospace",fontSize:11,transition:"all 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,77,77,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,77,77,0.08)"}>
                  <X style={{width:12,height:12}}/> RESET
                </button>
                {phase==="live"&&<button onClick={startScan} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"11px 16px",background:"rgba(0,245,255,0.06)",border:"1px solid rgba(0,245,255,0.18)",borderRadius:9,color:"#00F5FF",cursor:"pointer",fontFamily:"monospace",fontSize:11,transition:"all 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(0,245,255,0.14)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,245,255,0.06)"}>
                  <RefreshCw style={{width:12,height:12}}/> RESCAN
                </button>}
              </>
            )}
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",color:"rgba(0,245,255,0.25)",fontSize:24,userSelect:"none",flexShrink:0}}>›</div>

        {/* HOLOGRAM */}
        <div style={{...card,flex:1,padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Cpu style={{width:11,height:11,color:"#00F5FF"}}/>
              <span style={{fontFamily:"monospace",fontSize:9,color:"#00F5FF",letterSpacing:"0.14em"}}>HOLOGRAPHIC PROJECTION ENGINE</span>
              {hologramBuilt && (
                <button
                  onClick={() => setAutoRotate(r => !r)}
                  style={{
                    marginLeft: 8, padding: "2px 6px", background: autoRotate ? "rgba(0,245,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${autoRotate ? "rgba(0,245,255,0.22)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 4, color: autoRotate ? "#00F5FF" : "rgba(148,163,184,0.45)",
                    cursor: "pointer", fontSize: 8, fontFamily: "monospace"
                  }}
                >
                  {autoRotate ? "AUTO SPIN" : "DRAG ROTATE"}
                </button>
              )}
            </div>
            <span style={{fontFamily:"monospace",fontSize:9,color:hologramBuilt?"#00FF88":"rgba(148,163,184,0.3)"}}>
              {hologramBuilt?"● HOLOGRAM LIVE":"○ AWAITING DATA"}
            </span>
          </div>
          <div style={{flex:1,borderRadius:10,overflow:"hidden",minHeight:340,border:`1px solid rgba(${hologramBuilt?"0,255,136":"0,245,255"},0.15)`,position:"relative",background:"#010810"}}>
            <canvas
              ref={holoCanvasRef}
              width={480}
              height={360}
              onMouseDown={(e)=>{
                if(!hologramBuilt) return;
                setAutoRotate(false);
                isDraggingRef.current=true;
                prevMouseRef.current={x:e.clientX,y:e.clientY};
              }}
              onMouseMove={(e)=>{
                if(!isDraggingRef.current) return;
                const dx=e.clientX-prevMouseRef.current.x;
                const dy=e.clientY-prevMouseRef.current.y;
                rotYRef.current+=dx*0.008;
                rotXRef.current=Math.max(-Math.PI/2.5,Math.min(Math.PI/2.5,rotXRef.current+dy*0.008));
                prevMouseRef.current={x:e.clientX,y:e.clientY};
              }}
              onMouseUp={()=>{isDraggingRef.current=false;}}
              onMouseLeave={()=>{isDraggingRef.current=false;}}
              style={{
                width:"100%",height:"100%",display:"block",
                cursor: !hologramBuilt ? "default" : autoRotate ? "default" : "grab"
              }}
            />
            {phase==="live"&&<div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,245,255,0.013) 2px,rgba(0,245,255,0.013) 4px)",pointerEvents:"none",borderRadius:10}}/>}
            {phase==="detecting"&&<div style={{position:"absolute",inset:0,background:"rgba(110,86,255,0.04)",pointerEvents:"none",borderRadius:10,animation:"nx-pulse 2s infinite"}}/>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1.3fr",gap:8}}>
            {[["MESH POINTS",hologramBuilt?"468":"---","#00F5FF"],["PROJECTION",hologramBuilt?"3D WIRE":"OFFLINE",hologramBuilt?"#6E56FF":"rgba(148,163,184,0.22)"],["RENDER",hologramBuilt?"REALTIME":"STANDBY",hologramBuilt?"#00FF88":"rgba(148,163,184,0.22)"]].map(([l,v,c])=>(
              <div key={l} style={{background:"rgba(0,245,255,0.03)",border:"1px solid rgba(0,245,255,0.08)",borderRadius:8,padding:"8px",textAlign:"center"}}>
                <div style={{fontFamily:"monospace",fontSize:7.5,color:"rgba(148,163,184,0.38)",letterSpacing:"0.1em",marginBottom:3}}>{l}</div>
                <div style={{fontFamily:"monospace",fontSize:11,color:c,fontWeight:700}}>{v}</div>
              </div>
            ))}
            <button
              onClick={captureHologram}
              disabled={!hologramBuilt}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px", background: hologramBuilt ? "rgba(0,245,255,0.10)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${hologramBuilt ? "rgba(0,245,255,0.28)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 8, color: hologramBuilt ? "#00F5FF" : "rgba(148,163,184,0.3)",
                cursor: hologramBuilt ? "pointer" : "not-allowed", fontFamily: "monospace", fontSize: 10.5,
                transition: "all 0.15s"
              }}
              onMouseEnter={e => { if(hologramBuilt) e.currentTarget.style.background="rgba(0,245,255,0.18)" }}
              onMouseLeave={e => { if(hologramBuilt) e.currentTarget.style.background="rgba(0,245,255,0.10)" }}
            >
              <Download style={{ width: 12, height: 12 }} />
              EXPORT PNG
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry bar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {[["FACE OVAL","CONTOUR LOCKED"],["LEFT EYE","IRIS TRACKED"],["RIGHT EYE","IRIS TRACKED"],["LIPS MESH","MOTION ACTIVE"],["NOSE BRIDGE","DEPTH MAPPED"]].map(([label,sub])=>{
          const active=phase==="live";
          return(
            <div key={label} style={{background:"rgba(0,245,255,0.03)",border:`1px solid rgba(0,245,255,${active?"0.14":"0.06"})`,borderRadius:9,padding:"9px 12px",display:"flex",alignItems:"center",gap:9,transition:"all 0.4s"}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:active?"#00FF88":"rgba(148,163,184,0.15)",flexShrink:0,display:"block",boxShadow:active?"0 0 8px #00FF88":"none",transition:"all 0.4s"}}/>
              <div>
                <div style={{fontFamily:"monospace",fontSize:8,color:"rgba(148,163,184,0.38)",letterSpacing:"0.08em"}}>{label}</div>
                <div style={{fontFamily:"monospace",fontSize:10,color:active?"#00FF88":"rgba(148,163,184,0.2)",fontWeight:700,marginTop:1}}>{active?sub:"OFFLINE"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
