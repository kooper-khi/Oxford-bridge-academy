import { useEffect, useRef, useState, useCallback } from "react";

/* ─── HELPERS ─── */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ─── ANIMATED COUNTER ─── */
function Counter({ target, suffix = "", duration = 2000 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const p = clamp((now - start) / duration, 0, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(ease * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ─── 3D WEBGL CANVAS ─── */
function ThreeCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    /* — shaders — */
    const vert = `
      attribute vec3 aPos;
      attribute vec3 aNorm;
      uniform mat4 uMVP;
      uniform mat4 uModel;
      varying vec3 vNorm;
      varying vec3 vWorld;
      void main(){
        vec4 w = uModel * vec4(aPos,1.0);
        vWorld = w.xyz;
        vNorm = mat3(uModel) * aNorm;
        gl_Position = uMVP * vec4(aPos,1.0);
      }
    `;
    const frag = `
      precision highp float;
      varying vec3 vNorm;
      varying vec3 vWorld;
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uAlpha;
      void main(){
        vec3 n = normalize(vNorm);
        vec3 l = normalize(vec3(1.0,2.0,1.5));
        float diff = max(dot(n,l),0.0)*0.7 + 0.3;
        float rim = pow(1.0 - abs(dot(n, normalize(vec3(0,0,1)))), 2.0)*0.4;
        vec3 col = uColor * diff + vec3(0.9,0.75,0.3)*rim;
        gl_FragColor = vec4(col, uAlpha);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s); return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog); gl.useProgram(prog);

    const loc = (n) => gl.getUniformLocation(prog, n);
    const uMVP = loc("uMVP"), uModel = loc("uModel"), uColor = loc("uColor"),
      uTime = loc("uTime"), uAlpha = loc("uAlpha");
    const aPos = gl.getAttribLocation(prog, "aPos");
    const aNorm = gl.getAttribLocation(prog, "aNorm");

    /* — geometry builders — */
    const sphere = (r, segs) => {
      const pos = [], nor = [], idx = [];
      for (let y = 0; y <= segs; y++) {
        const v = y / segs, phi = v * Math.PI;
        for (let x = 0; x <= segs; x++) {
          const u = x / segs, th = u * Math.PI * 2;
          const nx = Math.sin(phi) * Math.cos(th);
          const ny = Math.cos(phi);
          const nz = Math.sin(phi) * Math.sin(th);
          pos.push(nx * r, ny * r, nz * r);
          nor.push(nx, ny, nz);
        }
      }
      for (let y = 0; y < segs; y++) for (let x = 0; x < segs; x++) {
        const a = y * (segs + 1) + x, b = a + segs + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
    };

    const box = (w, h, d) => {
      const hx = w / 2, hy = h / 2, hz = d / 2;
      const faces = [
        [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]
      ];
      const pos = [], nor = [], idx = [];
      let vi = 0;
      const corners = [
        [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]],
        [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]],
        [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]],
        [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]],
        [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]],
        [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]],
      ];
      corners.forEach((c, i) => {
        const n = faces[i];
        c.forEach(v => { pos.push(...v); nor.push(...n); });
        idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        vi += 4;
      });
      return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
    };

    const makeBuf = (geo) => {
      const pb = gl.createBuffer(), nb = gl.createBuffer(), ib = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, geo.nor, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);
      return { pb, nb, ib, count: geo.idx.length };
    };

    const sphereGeo = makeBuf(sphere(1, 32));
    const boxGeo = makeBuf(box(1, 1, 1));

    /* — matrix math — */
    const m4 = {
      id: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
      mul: (a, b) => {
        const r = new Float32Array(16);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
          for (let k = 0; k < 4; k++) r[i*4+j] += a[i*4+k]*b[k*4+j];
        return r;
      },
      rotY: (a) => { const c=Math.cos(a),s=Math.sin(a); const r=m4.id(); r[0]=c;r[2]=s;r[8]=-s;r[10]=c; return r; },
      rotX: (a) => { const c=Math.cos(a),s=Math.sin(a); const r=m4.id(); r[5]=c;r[6]=-s;r[9]=s;r[10]=c; return r; },
      trans: (x,y,z) => { const r=m4.id(); r[12]=x;r[13]=y;r[14]=z; return r; },
      scale: (x,y,z) => { const r=m4.id(); r[0]=x;r[5]=y;r[10]=z; return r; },
      persp: (fov, asp, near, far) => {
        const f=1/Math.tan(fov/2), r=new Float32Array(16);
        r[0]=f/asp; r[5]=f; r[10]=(far+near)/(near-far);
        r[11]=-1; r[14]=2*far*near/(near-far); return r;
      },
    };

    const draw = (geo, model, color, alpha = 1) => {
      const asp = canvas.width / canvas.height;
      const proj = m4.persp(0.6, asp, 0.1, 100);
      const view = m4.trans(0, -1, -14);
      const mvp = m4.mul(m4.mul(proj, view), model);
      gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.uniformMatrix4fv(uModel, false, model);
      gl.uniform3fv(uColor, color);
      gl.uniform1f(uAlpha, alpha);
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.pb);
      gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.nb);
      gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ib);
      gl.drawElements(gl.TRIANGLES, geo.count, gl.UNSIGNED_SHORT, 0);
    };

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let t = 0, raf;
    const buildings = [
      { x: -5, y: 0, z: -2, w: 1.8, h: 4, d: 1.8, col: [0.08, 0.12, 0.22] },
      { x: -2.5, y: 0, z: -1, w: 1.4, h: 3, d: 1.4, col: [0.07, 0.10, 0.20] },
      { x: 0, y: 0, z: -3, w: 2.4, h: 5.5, d: 2, col: [0.06, 0.09, 0.18] },
      { x: 3, y: 0, z: -1.5, w: 1.6, h: 3.5, d: 1.6, col: [0.08, 0.12, 0.22] },
      { x: 5.5, y: 0, z: -2.5, w: 1.4, h: 4.5, d: 1.4, col: [0.07, 0.11, 0.20] },
    ];

    const tick = () => {
      t += 0.005;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const rot = m4.rotY(t * 0.3);

      /* ground plane as flat box */
      const ground = m4.mul(m4.mul(rot, m4.trans(0, -2, 0)), m4.scale(20, 0.1, 20));
      draw(boxGeo, ground, [0.04, 0.07, 0.14], 0.9);

      /* buildings */
      buildings.forEach(b => {
        const bfloat = Math.sin(t * 0.8 + b.x) * 0.03;
        const m = m4.mul(m4.mul(rot, m4.trans(b.x, b.y + b.h / 2 - 2 + bfloat, b.z)), m4.scale(b.w, b.h, b.d));
        draw(boxGeo, m, b.col, 1);
      });

      /* gold floating orbs */
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t * 0.4;
        const r = 6 + Math.sin(t + i) * 0.5;
        const y = Math.sin(t * 0.7 + i * 1.3) * 1.5 + 1;
        const orb = m4.mul(m4.mul(rot, m4.trans(Math.cos(angle) * r, y, Math.sin(angle) * r)), m4.scale(0.12, 0.12, 0.12));
        const bright = 0.7 + Math.sin(t * 2 + i) * 0.3;
        draw(sphereGeo, orb, [0.9 * bright, 0.72 * bright, 0.2 * bright], 0.9);
      }

      /* central spire */
      const spire = m4.mul(m4.mul(rot, m4.trans(0, 1, -3)), m4.scale(0.15, 4, 0.15));
      draw(boxGeo, spire, [0.9, 0.72, 0.2], 1);
      const ball = m4.mul(m4.mul(rot, m4.trans(0, 3 + Math.sin(t) * 0.1, -3)), m4.scale(0.35, 0.35, 0.35));
      draw(sphereGeo, ball, [1, 0.85, 0.3], 1);

      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

/* ─── PARALLAX MOUSE LAYER ─── */
function useMouseParallax() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef(null);
  useEffect(() => {
    const onMove = (e) => {
      target.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 30,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      };
    };
    const tick = () => {
      current.current.x = lerp(current.current.x, target.current.x, 0.05);
      current.current.y = lerp(current.current.y, target.current.y, 0.05);
      setPos({ x: current.current.x, y: current.current.y });
      raf.current = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    raf.current = requestAnimationFrame(tick);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf.current); };
  }, []);
  return pos;
}

/* ─── SCROLL REVEAL ─── */
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(48px)",
      transition: `opacity 0.9s ease ${delay}ms, transform 0.9s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

/* ─── NAV ─── */
function Nav({ active }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  const links = ["About", "Programmes", "Results", "Campus", "Apply"];
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      padding: "0 3rem",
      background: scrolled ? "rgba(4,8,20,0.92)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(180,148,50,0.2)" : "none",
      transition: "all 0.5s ease",
      display: "flex", alignItems: "center", height: "72px",
    }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", color: "#c9a84c", letterSpacing: "0.05em", flex: 1 }}>
        OBA
      </div>
      <div style={{ display: "flex", gap: "2.5rem" }}>
        {links.map(l => (
          <button key={l} onClick={() => document.getElementById(l.toLowerCase())?.scrollIntoView({ behavior: "smooth" })}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: active === l ? "#c9a84c" : "rgba(255,255,255,0.7)",
              fontSize: "0.8rem", letterSpacing: "0.15em", textTransform: "uppercase",
              fontFamily: "Georgia, serif",
              transition: "color 0.3s",
            }}
            onMouseEnter={e => e.target.style.color = "#c9a84c"}
            onMouseLeave={e => e.target.style.color = active === l ? "#c9a84c" : "rgba(255,255,255,0.7)"}
          >{l}</button>
        ))}
      </div>
    </nav>
  );
}

/* ─── HERO ─── */
function Hero({ mouse }) {
  return (
    <section id="about" style={{ position: "relative", height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* CSS illustrated background */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(160deg, #040814 0%, #071228 40%, #0a1a35 70%, #040c1e 100%)",
        transform: `translate(${mouse.x * 0.015}px, ${mouse.y * 0.015}px) scale(1.06)`,
        transition: "transform 0.1s linear",
      }}>
        {/* architectural grid lines */}
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.18 }} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          {/* perspective floor grid */}
          {[...Array(12)].map((_,i) => <line key={`h${i}`} x1="0" y1={500 + i*30} x2="1200" y2={500 + i*30} stroke="#c9a84c" strokeWidth="0.5"/>)}
          {[...Array(20)].map((_,i) => { const x = 600 + (i-10)*120; return <line key={`v${i}`} x1={x} y1="500" x2={600 + (i-10)*400} y2="900" stroke="#c9a84c" strokeWidth="0.5"/>; })}
          {/* grand building silhouette */}
          <rect x="350" y="180" width="500" height="320" fill="#0d1f3e" stroke="#c9a84c" strokeWidth="1"/>
          <rect x="420" y="130" width="360" height="60" fill="#0d1f3e" stroke="#c9a84c" strokeWidth="1"/>
          <rect x="520" y="80" width="160" height="60" fill="#0d1f3e" stroke="#c9a84c" strokeWidth="1"/>
          <rect x="575" y="30" width="50" height="60" fill="#0d1f3e" stroke="#c9a84c" strokeWidth="1"/>
          {/* windows */}
          {[380,440,500,560,620,680,740,800].map((x,i)=>[250,310,370,430].map((y,j)=><rect key={`w${i}${j}`} x={x} y={y} width="35" height="40" fill={Math.random()>0.4?"rgba(201,168,76,0.25)":"rgba(201,168,76,0.06)"} stroke="#c9a84c" strokeWidth="0.5"/>))}
          {/* pillars */}
          {[380,460,540,620,700,780].map((x,i)=><rect key={`p${i}`} x={x} y="180" width="18" height="320" fill="#0a1830" stroke="#c9a84c" strokeWidth="0.5"/>)}
          {/* steps */}
          <rect x="300" y="500" width="600" height="12" fill="#0d1f3e" stroke="#c9a84c" strokeWidth="0.5"/>
          <rect x="320" y="488" width="560" height="12" fill="#0a1830" stroke="#c9a84c" strokeWidth="0.5"/>
          {/* left wing */}
          <rect x="100" y="280" width="250" height="220" fill="#081526" stroke="#c9a84c" strokeWidth="0.8"/>
          {[120,160,200,240,280].map((x,i)=>[300,340,380,420].map((y,j)=><rect key={`lw${i}${j}`} x={x} y={y} width="25" height="28" fill="rgba(201,168,76,0.1)" stroke="#c9a84c" strokeWidth="0.4"/>))}
          {/* right wing */}
          <rect x="850" y="280" width="250" height="220" fill="#081526" stroke="#c9a84c" strokeWidth="0.8"/>
          {[870,910,950,990,1030].map((x,i)=>[300,340,380,420].map((y,j)=><rect key={`rw${i}${j}`} x={x} y={y} width="25" height="28" fill="rgba(201,168,76,0.1)" stroke="#c9a84c" strokeWidth="0.4"/>))}
          {/* dome on top */}
          <ellipse cx="600" cy="80" rx="60" ry="30" fill="none" stroke="#c9a84c" strokeWidth="1"/>
          <line x1="600" y1="50" x2="600" y2="10" stroke="#c9a84c" strokeWidth="1.5"/>
          <circle cx="600" cy="8" r="4" fill="#c9a84c"/>
          {/* trees */}
          {[200,280,900,980].map((x,i)=><g key={`t${i}`}><line x1={x} y1="500" x2={x} y2="430" stroke="#1a3520" strokeWidth="6"/><ellipse cx={x} cy="415" rx="30" ry="40" fill="#1a3520"/><ellipse cx={x} cy="400" rx="20" ry="30" fill="#1f4228"/></g>)}
        </svg>
        {/* warm glow behind building */}
        <div style={{ position:"absolute", left:"50%", top:"60%", transform:"translate(-50%,-50%)", width:"600px", height:"400px", background:"radial-gradient(ellipse, rgba(201,168,76,0.12) 0%, transparent 70%)", pointerEvents:"none" }}/>
      </div>
      {/* 3D canvas overlay */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
        <ThreeCanvas />
      </div>
      {/* dark vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, rgba(4,8,20,0.3) 0%, rgba(4,8,20,0.85) 100%)",
      }} />
      {/* content */}
      <div style={{
        position: "relative", zIndex: 10, textAlign: "center",
        transform: `translate(${mouse.x * -0.04}px, ${mouse.y * -0.04}px)`,
        transition: "transform 0.1s linear",
        padding: "0 2rem",
      }}>
        <div style={{ fontSize: "0.7rem", letterSpacing: "0.4em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.5rem", fontFamily: "Georgia, serif" }}>
          Est. London · Premier Academy
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(3.5rem, 9vw, 8rem)",
          fontWeight: 400,
          lineHeight: 1.0,
          color: "#fff",
          margin: "0 0 0.3em",
          textShadow: "0 4px 40px rgba(0,0,0,0.5)",
        }}>
          Oxford Bridge<br />
          <span style={{ color: "#c9a84c", fontStyle: "italic" }}>Academy</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,0.75)", maxWidth: "540px", margin: "1.5rem auto", fontSize: "1rem", lineHeight: 1.7, fontFamily: "Georgia, serif" }}>
          London's most distinguished academic institution — forging exceptional minds through GCSE, A-Level, and elite peer tutoring programmes.
        </p>
        <div style={{ display: "flex", gap: "1.2rem", justifyContent: "center", marginTop: "2.5rem" }}>
          <GoldButton onClick={() => document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" })}>Apply Now</GoldButton>
          <GhostButton onClick={() => document.getElementById("programmes")?.scrollIntoView({ behavior: "smooth" })}>Explore Programmes</GhostButton>
        </div>
      </div>
      {/* scroll indicator */}
      <div style={{ position: "absolute", bottom: "2.5rem", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ fontSize: "0.6rem", letterSpacing: "0.3em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Scroll</div>
        <div style={{ width: "1px", height: "48px", background: "linear-gradient(to bottom, rgba(201,168,76,0.8), transparent)", animation: "pulse 2s infinite" }} />
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #040814; color: #fff; font-family: Georgia, serif; overflow-x: hidden; }
        ::selection { background: rgba(201,168,76,0.3); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #040814; }
        ::-webkit-scrollbar-thumb { background: #c9a84c; border-radius: 3px; }
      `}</style>
    </section>
  );
}

function GoldButton({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.9rem 2.2rem",
        background: hov ? "#c9a84c" : "transparent",
        border: "1px solid #c9a84c",
        color: hov ? "#040814" : "#c9a84c",
        fontFamily: "Georgia, serif",
        fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase",
        cursor: "pointer", transition: "all 0.3s ease",
      }}>{children}</button>
  );
}

function GhostButton({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.9rem 2.2rem",
        background: hov ? "rgba(255,255,255,0.1)" : "transparent",
        border: "1px solid rgba(255,255,255,0.3)",
        color: "#fff",
        fontFamily: "Georgia, serif",
        fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase",
        cursor: "pointer", transition: "all 0.3s ease",
      }}>{children}</button>
  );
}

/* ─── MARQUEE STRIP ─── */
function Marquee() {
  const items = ["GCSE Excellence", "A-Level Mastery", "Peer Tutoring", "STEM Leadership", "University Placement", "98% Pass Rate", "Oxford Bridge Academy"];
  const text = [...items, ...items].join("  ·  ");
  return (
    <div style={{ overflow: "hidden", background: "#c9a84c", padding: "0.9rem 0" }}>
      <div style={{
        display: "inline-block", whiteSpace: "nowrap",
        animation: "marquee 28s linear infinite",
        fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase",
        color: "#040814", fontFamily: "Georgia, serif", fontWeight: 600,
      }}>
        {text}&nbsp;&nbsp;&nbsp;{text}
      </div>
      <style>{`@keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }`}</style>
    </div>
  );
}

/* ─── ABOUT ─── */
function About() {
  return (
    <section style={{ padding: "10rem 8vw", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "center" }}>
      <Reveal>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.4em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.5rem" }}>
          About the Academy
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.2rem, 4vw, 3.5rem)", fontWeight: 400, lineHeight: 1.2, marginBottom: "2rem" }}>
          Where Tradition<br />Meets<br /><em style={{ color: "#c9a84c" }}>Excellence</em>
        </h2>
        <p style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.9, marginBottom: "1.5rem", fontSize: "0.95rem" }}>
          Founded on the principles of academic rigour and personal development, Oxford Bridge Academy has been guiding London's brightest students to their full potential. Our unique peer-tutoring model, combined with expert faculty, creates an unparalleled learning environment.
        </p>
        <p style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.9, fontSize: "0.95rem" }}>
          From foundational GCSE pathways to advanced A-Level study, every programme is meticulously crafted to exceed expectations and open doors to the world's leading universities.
        </p>
      </Reveal>
      <Reveal delay={200}>
        <div style={{ position: "relative" }}>
          <div style={{ aspectRatio: "4/5", background: "linear-gradient(135deg, #081526 0%, #0d1f3e 60%, #071228 100%)", position: "relative", overflow: "hidden" }}>
            <svg width="100%" height="100%" viewBox="0 0 400 500" style={{ position:"absolute", inset:0 }}>
              {/* reading room scene */}
              <rect x="0" y="0" width="400" height="500" fill="#081526"/>
              {/* back wall */}
              <rect x="20" y="20" width="360" height="300" fill="#0a1830" stroke="#c9a84c" strokeWidth="0.5" strokeOpacity="0.4"/>
              {/* bookshelf rows */}
              {[40,80,120,160,200,240].map((y,i)=>(
                <g key={y}>
                  <rect x="30" y={y} width="340" height="35" fill="#071020" stroke="#c9a84c" strokeWidth="0.3" strokeOpacity="0.3"/>
                  {[...Array(18)].map((_,j)=>{
                    const colors=["#8B1A1A","#1A3A8B","#1A6B2A","#8B6B1A","#4B1A8B","#1A6B6B"];
                    return <rect key={j} x={32+j*18} y={y+3} width={14} height={28} fill={colors[(i+j)%colors.length]} opacity="0.7" rx="1"/>;
                  })}
                </g>
              ))}
              {/* desk */}
              <rect x="60" y="300" width="280" height="15" fill="#3d2b0a" stroke="#c9a84c" strokeWidth="0.5"/>
              <rect x="80" y="315" width="10" height="100" fill="#3d2b0a"/>
              <rect x="310" y="315" width="10" height="100" fill="#3d2b0a"/>
              {/* lamp */}
              <line x1="200" y1="260" x2="200" y2="300" stroke="#c9a84c" strokeWidth="2"/>
              <ellipse cx="200" cy="258" rx="30" ry="10" fill="none" stroke="#c9a84c" strokeWidth="1.5"/>
              <ellipse cx="200" cy="315" rx="50" ry="6" fill="rgba(201,168,76,0.15)"/>
              {/* open book on desk */}
              <path d="M150,305 Q200,298 250,305" stroke="#e8d9b0" strokeWidth="1" fill="none"/>
              <rect x="150" y="295" width="50" height="10" fill="#e8d9b0" opacity="0.8" rx="1"/>
              <rect x="200" y="295" width="50" height="10" fill="#f0e6c0" opacity="0.8" rx="1"/>
              {/* window with light */}
              <rect x="160" y="30" width="80" height="100" fill="rgba(201,168,76,0.08)" stroke="#c9a84c" strokeWidth="1"/>
              <line x1="200" y1="30" x2="200" y2="130" stroke="#c9a84c" strokeWidth="0.5"/>
              <line x1="160" y1="80" x2="240" y2="80" stroke="#c9a84c" strokeWidth="0.5"/>
              {/* floor */}
              <rect x="0" y="415" width="400" height="85" fill="#060e1e"/>
              {[0,40,80,120,160,200,240,280,320,360].map((x,i)=><line key={i} x1={x} y1="415" x2={x} y2="500" stroke="#c9a84c" strokeWidth="0.3" strokeOpacity="0.2"/>)}
              {[415,455,495].map((y,i)=><line key={i} x1="0" y1={y} x2="400" y2={y} stroke="#c9a84c" strokeWidth="0.3" strokeOpacity="0.2"/>)}
            </svg>
          </div>
          <div style={{
            position: "absolute", bottom: "-2rem", left: "-2rem",
            background: "rgba(201,168,76,0.12)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(201,168,76,0.3)",
            padding: "2rem", width: "220px",
          }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "3rem", color: "#c9a84c" }}>25+</div>
            <div style={{ fontSize: "0.75rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Years of Excellence</div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── PROGRAMMES ─── */
const progs = [
  {
    icon: "📘", title: "GCSE Core Curriculum", tag: "Years 10–11",
    desc: "Comprehensive coverage of all core and optional GCSE subjects with dedicated small-group and 1-to-1 support.",
    image: "gcse",
    subjects: ["Mathematics", "English Language & Literature", "Sciences (Biology, Chemistry, Physics)", "History & Geography", "Modern Foreign Languages", "Art & Design"],
    highlights: ["Max 8 students per class", "Weekly progress reports", "Mock exam series", "Parent consultation meetings"],
    duration: "2 years (Years 10–11)",
    outcome: "Targeted GCSE grades for top sixth form entry"
  },
  {
    icon: "🎓", title: "A-Level Advanced Studies", tag: "Years 12–13",
    desc: "Intensive A-Level preparation across Sciences, Humanities, and Arts. Designed for top university applications.",
    image: "alevel",
    subjects: ["Mathematics & Further Maths", "Physics, Chemistry & Biology", "English Literature", "Economics & Business", "History & Politics", "Psychology"],
    highlights: ["Oxbridge application support", "Personal statement coaching", "University open day trips", "Past paper mastery programme"],
    duration: "2 years (Years 12–13)",
    outcome: "93% of students achieve A–B grades"
  },
  {
    icon: "🤝", title: "Peer Tutoring System", tag: "All Years",
    desc: "Our award-winning peer tutor programme matches high-achieving students with those who need targeted support.",
    image: "peer",
    subjects: ["All GCSE subjects", "All A-Level subjects", "Study skills & revision technique", "Exam strategy sessions"],
    highlights: ["Carefully matched tutor pairs", "Flexible scheduling", "Senior student mentors", "Progress tracking dashboard"],
    duration: "Flexible — termly or full year",
    outcome: "Average 1.5 grade improvement per subject"
  },
  {
    icon: "🔬", title: "STEM Excellence Track", tag: "Enrichment",
    desc: "Extended curriculum in Mathematics, Physics, Chemistry, and Computer Science for future innovators.",
    image: "stem",
    subjects: ["Advanced Mathematics", "Applied Physics", "Computational Chemistry", "Computer Science & AI", "Engineering Principles", "Data Science"],
    highlights: ["Lab access & experiments", "UKMT & Olympiad preparation", "Industry guest speakers", "University research projects"],
    duration: "Year-round enrichment programme",
    outcome: "Pathway to top STEM university courses"
  },
  {
    icon: "📖", title: "Humanities & Arts", tag: "Core + Enrichment",
    desc: "English Literature, History, Philosophy, and Fine Arts developed within a rich cultural context.",
    image: "hum",
    subjects: ["English Literature", "History (British & World)", "Philosophy & Ethics", "Fine Art & Design", "Media Studies", "Classical Studies"],
    highlights: ["Museum & gallery visits", "Extended essay support", "Debate & public speaking", "Creative writing workshops"],
    duration: "Full academic year",
    outcome: "Critical thinking & cultural literacy for life"
  },
  {
    icon: "🏛️", title: "University Preparation", tag: "Sixth Form",
    desc: "From UCAS statements to Oxbridge interviews, we prepare every student for their next chapter.",
    image: "uni",
    subjects: ["UCAS application guidance", "Personal statement writing", "Interview preparation", "Admissions test coaching (LNAT, BMAT, MAT)", "Gap year planning", "Scholarship applications"],
    highlights: ["98% university placement rate", "Mock interview panels", "Alumni mentoring network", "One-to-one advisor sessions"],
    duration: "Year 12–13 (September–January)",
    outcome: "98% of students secure their first or second choice"
  },
];

/* ─── SVG ILLUSTRATED SCENES ─── */
function SceneIllustration({ type, height = 260 }) {
  const scenes = {
    gcse: (
      <svg width="100%" height={height} viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice">
        <rect width="900" height="260" fill="#081526"/>
        <rect x="0" y="160" width="900" height="100" fill="#060e1e"/>
        {/* classroom desks */}
        {[100,250,400,550,700].map((x,i)=>(
          <g key={i}>
            <rect x={x} y="155" width="120" height="8" fill="#3d2b0a"/>
            <rect x={x+10} y="163" width="8" height="40" fill="#3d2b0a"/>
            <rect x={x+102} y="163" width="8" height="40" fill="#3d2b0a"/>
            <rect x={x+20} y="148" width="80" height="3" fill="#e8d9b0" opacity="0.6"/>
          </g>
        ))}
        {/* board */}
        <rect x="30" y="40" width="840" height="90" fill="#0a2a0a" stroke="#c9a84c" strokeWidth="1"/>
        <text x="450" y="75" fill="#c9a84c" fontSize="18" textAnchor="middle" fontFamily="Georgia,serif">GCSE Core Curriculum</text>
        <text x="450" y="105" fill="rgba(255,255,255,0.5)" fontSize="12" textAnchor="middle" fontFamily="Georgia,serif">Mathematics · Sciences · English · Humanities</text>
        {/* formula decorations */}
        <text x="80" y="95" fill="rgba(201,168,76,0.4)" fontSize="14" fontFamily="Georgia,serif">E=mc²</text>
        <text x="770" y="95" fill="rgba(201,168,76,0.4)" fontSize="14" fontFamily="Georgia,serif">∫f(x)dx</text>
        {/* ceiling lights */}
        {[150,300,450,600,750].map((x,i)=>(
          <g key={i}><line x1={x} y1="0" x2={x} y2="25" stroke="#c9a84c" strokeWidth="1"/><ellipse cx={x} cy="28" rx="20" ry="6" fill="rgba(201,168,76,0.3)"/></g>
        ))}
      </svg>
    ),
    alevel: (
      <svg width="100%" height={height} viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice">
        <rect width="900" height="260" fill="#0a0f20"/>
        {/* library shelves background */}
        {[0,60,120,180,240].map((y,i)=>(
          <g key={i}>
            <rect x="0" y={y} width="900" height="55" fill={i%2===0?"#081020":"#060d1a"}/>
            {[...Array(30)].map((_,j)=>{
              const cols=["#8B1A1A","#1A3A8B","#1A6B2A","#8B6B1A","#4B1A8B","#c9a84c"];
              return <rect key={j} x={j*30+5} y={y+5} width="22" height="44" fill={cols[(i*3+j)%cols.length]} opacity="0.65" rx="1"/>;
            })}
          </g>
        ))}
        <rect x="0" y="0" width="900" height="260" fill="rgba(4,8,20,0.55)"/>
        {/* title overlay */}
        <rect x="250" y="90" width="400" height="80" fill="rgba(4,8,20,0.8)" stroke="rgba(201,168,76,0.4)" strokeWidth="1"/>
        <text x="450" y="127" fill="#c9a84c" fontSize="18" textAnchor="middle" fontFamily="Georgia,serif">A-Level Advanced Studies</text>
        <text x="450" y="152" fill="rgba(255,255,255,0.5)" fontSize="12" textAnchor="middle" fontFamily="Georgia,serif">Sciences · Humanities · Arts · Mathematics</text>
      </svg>
    ),
    peer: (
      <svg width="100%" height={height} viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice">
        <rect width="900" height="260" fill="#081526"/>
        {/* round table */}
        <ellipse cx="450" cy="180" rx="200" ry="60" fill="#2a1a06" stroke="#c9a84c" strokeWidth="1"/>
        {/* chairs / people as abstract figures */}
        {[0,72,144,216,288].map((angle,i)=>{
          const rad = (angle-90)*Math.PI/180;
          const x = 450 + 220*Math.cos(rad), y = 180 + 70*Math.sin(rad);
          return <g key={i}><circle cx={x} cy={y-30} r="18" fill={["#c9a84c","#4a8bc9","#8bc94a","#c94a8b","#4ac9c9"][i]} opacity="0.7"/><rect x={x-12} y={y-12} width="24" height="30" fill={["#c9a84c","#4a8bc9","#8bc94a","#c94a8b","#4ac9c9"][i]} opacity="0.5" rx="4"/></g>;
        })}
        {/* speech bubbles */}
        <rect x="160" y="60" width="140" height="40" fill="rgba(201,168,76,0.15)" stroke="rgba(201,168,76,0.4)" strokeWidth="1" rx="8"/>
        <text x="230" y="85" fill="#c9a84c" fontSize="11" textAnchor="middle" fontFamily="Georgia,serif">Study Together</text>
        <rect x="600" y="60" width="140" height="40" fill="rgba(74,139,201,0.15)" stroke="rgba(74,139,201,0.4)" strokeWidth="1" rx="8"/>
        <text x="670" y="85" fill="#4a8bc9" fontSize="11" textAnchor="middle" fontFamily="Georgia,serif">Peer Support</text>
        <text x="450" y="30" fill="#c9a84c" fontSize="16" textAnchor="middle" fontFamily="Georgia,serif">Peer Tutoring System</text>
      </svg>
    ),
    stem: (
      <svg width="100%" height={height} viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice">
        <rect width="900" height="260" fill="#050d1a"/>
        {/* circuit board pattern */}
        {[...Array(8)].map((_,i)=><line key={`h${i}`} x1="0" y1={i*35+10} x2="900" y2={i*35+10} stroke="#0a2a4a" strokeWidth="1"/>)}
        {[...Array(14)].map((_,i)=><line key={`v${i}`} x1={i*65+10} y1="0" x2={i*65+10} y2="260" stroke="#0a2a4a" strokeWidth="1"/>)}
        {/* atom */}
        <circle cx="450" cy="130" r="12" fill="#c9a84c"/>
        {[0,60,120].map((a,i)=><ellipse key={i} cx="450" cy="130" rx="80" ry="30" fill="none" stroke="rgba(201,168,76,0.5)" strokeWidth="1.5" transform={`rotate(${a} 450 130)`}/>)}
        {/* orbital electrons */}
        {[0,60,120].map((a,i)=>{
          const rad = (a)*Math.PI/180;
          return <circle key={i} cx={450+80*Math.cos(rad)} cy={130+30*Math.sin(rad)} r="5" fill="#4a8bc9"/>;
        })}
        {/* equation text */}
        <text x="120" y="50" fill="rgba(201,168,76,0.6)" fontSize="14" fontFamily="Georgia,serif">F = ma</text>
        <text x="700" y="50" fill="rgba(74,201,139,0.6)" fontSize="14" fontFamily="Georgia,serif">PV = nRT</text>
        <text x="100" y="220" fill="rgba(74,139,201,0.6)" fontSize="13" fontFamily="Georgia,serif">∇²ψ + k²ψ = 0</text>
        <text x="620" y="220" fill="rgba(201,139,74,0.6)" fontSize="13" fontFamily="Georgia,serif">e^(iπ) + 1 = 0</text>
        <text x="450" y="28" fill="#c9a84c" fontSize="16" textAnchor="middle" fontFamily="Georgia,serif">STEM Excellence Track</text>
        {/* microscope silhouette */}
        <rect x="760" y="100" width="15" height="80" fill="rgba(201,168,76,0.3)"/>
        <rect x="745" y="170" width="45" height="8" fill="rgba(201,168,76,0.3)"/>
        <ellipse cx="768" cy="100" rx="20" ry="15" fill="none" stroke="rgba(201,168,76,0.3)" strokeWidth="2"/>
        {/* beaker */}
        <path d="M120,140 L108,200 L152,200 L140,140 Z" fill="none" stroke="rgba(74,139,201,0.4)" strokeWidth="2"/>
        <path d="M112,185 L148,185" stroke="rgba(74,139,201,0.4)" strokeWidth="1.5"/>
        <ellipse cx="130" cy="185" rx="18" ry="5" fill="rgba(74,139,201,0.2)"/>
      </svg>
    ),
    hum: (
      <svg width="100%" height={height} viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice">
        <rect width="900" height="260" fill="#0d0a18"/>
        {/* art gallery wall */}
        <rect x="0" y="0" width="900" height="200" fill="#100d20"/>
        {/* picture frames */}
        {[[50,20,180,160],[270,30,200,140],[510,15,170,170],[720,25,150,150]].map(([x,y,w,h],i)=>(
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill="#080614" stroke="#c9a84c" strokeWidth="2"/>
            <rect x={x+8} y={y+8} width={w-16} height={h-16} fill={["#1a0a2e","#0a1a1a","#1a1a0a","#1a0a0a"][i]} stroke="rgba(201,168,76,0.2)" strokeWidth="1"/>
            {i===0 && <><ellipse cx={x+w/2} cy={y+h/2} rx="50" ry="60" fill="none" stroke="rgba(201,168,76,0.3)" strokeWidth="1"/><text x={x+w/2} y={y+h/2+5} fill="rgba(201,168,76,0.5)" fontSize="10" textAnchor="middle" fontFamily="Georgia,serif">Literature</text></>}
            {i===1 && <><path d={`M${x+20},${y+h-20} Q${x+w/2},${y+20} ${x+w-20},${y+h-20}`} fill="none" stroke="rgba(74,139,201,0.5)" strokeWidth="2"/><text x={x+w/2} y={y+h/2+5} fill="rgba(74,139,201,0.5)" fontSize="10" textAnchor="middle" fontFamily="Georgia,serif">History</text></>}
            {i===2 && <><text x={x+w/2} y={y+h/2-10} fill="rgba(139,74,201,0.6)" fontSize="28" textAnchor="middle">φ</text><text x={x+w/2} y={y+h/2+15} fill="rgba(139,74,201,0.4)" fontSize="10" textAnchor="middle" fontFamily="Georgia,serif">Philosophy</text></>}
            {i===3 && <><rect x={x+20} y={y+20} width={w-40} height={h-40} fill="rgba(201,74,74,0.1)"/><text x={x+w/2} y={y+h/2+5} fill="rgba(201,74,74,0.5)" fontSize="10" textAnchor="middle" fontFamily="Georgia,serif">Fine Art</text></>}
          </g>
        ))}
        {/* floor */}
        <rect x="0" y="200" width="900" height="60" fill="#080612"/>
        {[0,100,200,300,400,500,600,700,800,900].map((x,i)=><line key={i} x1={x} y1="200" x2={x} y2="260" stroke="#c9a84c" strokeWidth="0.3" strokeOpacity="0.2"/>)}
        <text x="450" y="245" fill="rgba(201,168,76,0.5)" fontSize="14" textAnchor="middle" fontFamily="Georgia,serif">Humanities & Arts</text>
      </svg>
    ),
    uni: (
      <svg width="100%" height={height} viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice">
        <rect width="900" height="260" fill="#070d1a"/>
        {/* grand hall columns */}
        {[80,200,320,580,700,820].map((x,i)=>(
          <g key={i}>
            <rect x={x} y="20" width="22" height="200" fill="#0d1f3e" stroke="#c9a84c" strokeWidth="0.8"/>
            <rect x={x-10} y="14" width="42" height="12" fill="#0d1f3e" stroke="#c9a84c" strokeWidth="0.8"/>
            <rect x={x-10} y="210" width="42" height="12" fill="#0d1f3e" stroke="#c9a84c" strokeWidth="0.8"/>
          </g>
        ))}
        {/* arch */}
        <path d="M320,20 Q450,0 580,20" fill="none" stroke="#c9a84c" strokeWidth="1.5"/>
        {/* mortarboard icons */}
        {[180,350,550,720].map((x,i)=>(
          <g key={i}>
            <rect x={x-20} y="90" width="40" height="6" fill="#c9a84c" opacity="0.7"/>
            <polygon points={`${x},80 ${x-22},92 ${x+22},92`} fill="#c9a84c" opacity="0.7"/>
            <line x1={x+20} y1="88" x2={x+28} y2="100" stroke="#c9a84c" strokeWidth="1.5" opacity="0.7"/>
            <circle cx={x+28} cy="103" r="3" fill="#c9a84c" opacity="0.7"/>
          </g>
        ))}
        {/* scroll/diploma */}
        <rect x="340" y="150" width="220" height="70" rx="4" fill="#e8d9b0" opacity="0.15" stroke="#c9a84c" strokeWidth="1"/>
        <text x="450" y="182" fill="#c9a84c" fontSize="13" textAnchor="middle" fontFamily="Georgia,serif">Oxbridge &amp; Russell Group</text>
        <text x="450" y="205" fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle" fontFamily="Georgia,serif">98% University Placement</text>
        {/* stars */}
        {[120,230,440,640,780].map((x,i)=><text key={i} x={x} y={40+i*10} fill="#c9a84c" fontSize="10" opacity="0.4">✦</text>)}
        <text x="450" y="40" fill="#c9a84c" fontSize="16" textAnchor="middle" fontFamily="Georgia,serif">University Preparation</text>
      </svg>
    ),
  };
  return scenes[type] || scenes.gcse;
}

/* ─── PROGRAMME MODAL ─── */
function ProgramModal({ prog, onClose }) {
  useEffect(() => {
  const fn = (e) => {
    if (e.key === "Escape") onClose();
  };

  document.addEventListener("keydown", fn);
  document.body.style.overflow = "hidden";

  return () => {
    document.removeEventListener("keydown", fn);
    document.body.style.overflow = "";
  };
}, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(4,8,20,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "2rem",
      animation: "fadeIn 0.3s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#080f1f",
        border: "1px solid rgba(201,168,76,0.3)",
        maxWidth: "860px", width: "100%",
        maxHeight: "90vh", overflowY: "auto",
        animation: "slideUp 0.35s ease",
      }}>
        {/* svg illustrated header */}
        <div style={{ height: "260px", position: "relative", overflow: "hidden" }}>
          <SceneIllustration type={prog.image} height={260} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, #080f1f 100%)" }} />
          <button onClick={onClose} style={{
            position: "absolute", top: "1.2rem", right: "1.2rem",
            background: "rgba(4,8,20,0.7)", border: "1px solid rgba(201,168,76,0.4)",
            color: "#c9a84c", width: "38px", height: "38px",
            fontSize: "1.2rem", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
          <div style={{ position: "absolute", bottom: "1.5rem", left: "2.5rem" }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.35em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "0.5rem" }}>{prog.tag}</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 400 }}>{prog.title}</h2>
          </div>
        </div>
        {/* body */}
        <div style={{ padding: "2.5rem" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.9, marginBottom: "2.5rem", fontSize: "1rem" }}>{prog.desc}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2.5rem", marginBottom: "2.5rem" }}>
            <div>
              <div style={{ fontSize: "0.6rem", letterSpacing: "0.3em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.2rem" }}>Subjects Covered</div>
              {prog.subjects.map(s => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.65rem", fontSize: "0.875rem", color: "rgba(255,255,255,0.65)" }}>
                  <div style={{ width: "16px", height: "1px", background: "#c9a84c", flexShrink: 0 }} />{s}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: "0.6rem", letterSpacing: "0.3em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.2rem" }}>Programme Highlights</div>
              {prog.highlights.map(h => (
                <div key={h} style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.65rem", fontSize: "0.875rem", color: "rgba(255,255,255,0.65)" }}>
                  <div style={{ width: "6px", height: "6px", background: "#c9a84c", flexShrink: 0, borderRadius: "50%" }} />{h}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2.5rem" }}>
            {[["Duration", prog.duration], ["Expected Outcome", prog.outcome]].map(([label, val]) => (
              <div key={label} style={{ padding: "1.2rem 1.5rem", border: "1px solid rgba(201,168,76,0.2)", background: "rgba(201,168,76,0.04)" }}>
                <div style={{ fontSize: "0.6rem", letterSpacing: "0.3em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "0.5rem" }}>{label}</div>
                <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <GoldButton onClick={() => { onClose(); setTimeout(() => document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" }), 300); }}>Apply for This Programme</GoldButton>
            <GhostButton onClick={onClose}>Close</GhostButton>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}

function ProgramCard({ p, delay, onOpen }) {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={delay}>
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        onClick={onOpen}
        style={{
          padding: "2.5rem",
          border: `1px solid ${hov ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.07)"}`,
          background: hov ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.02)",
          transition: "all 0.4s ease",
          transform: hov ? "translateY(-6px)" : "translateY(0)",
          cursor: "pointer",
          height: "100%",
          position: "relative",
        }}>
        <div style={{ fontSize: "2.2rem", marginBottom: "1.2rem" }}>{p.icon}</div>
        <div style={{ fontSize: "0.6rem", letterSpacing: "0.3em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "0.8rem" }}>{p.tag}</div>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.3rem", fontWeight: 400, marginBottom: "1rem" }}>{p.title}</h3>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", lineHeight: 1.8, marginBottom: "1.5rem" }}>{p.desc}</p>
        <div style={{
          fontSize: "0.7rem", letterSpacing: "0.2em", color: "#c9a84c", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: "0.5rem",
          opacity: hov ? 1 : 0.5, transition: "opacity 0.3s",
        }}>
          View Details <span style={{ fontSize: "1rem" }}>→</span>
        </div>
      </div>
    </Reveal>
  );
}

function Programmes() {
  const [selected, setSelected] = useState(null);
  return (
    <section id="programmes" style={{ padding: "10rem 8vw", background: "rgba(255,255,255,0.015)" }}>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "5rem" }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.4em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.2rem" }}>Academic Offerings</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 400 }}>Our Programmes</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", marginTop: "1rem", fontSize: "0.85rem" }}>Click any programme to explore full details</p>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {progs.map((p, i) => <ProgramCard key={p.title} p={p} delay={i * 80} onOpen={() => setSelected(p)} />)}
      </div>
      {selected && <ProgramModal prog={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

/* ─── STATS ─── */
const stats = [
  { val: 97, suffix: "%", label: "GCSE Pass Rate" },
  { val: 93, suffix: "%", label: "A-Level A–B Grades" },
  { val: 150, suffix: "+", label: "Peer Tutors" },
  { val: 98, suffix: "%", label: "University Placement" },
];

function Results() {
  return (
    <section id="results" style={{ padding: "10rem 8vw", position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: "600px", height: "600px",
        background: "radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "5rem" }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.4em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.2rem" }}>Academic Results</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 400 }}>
            Excellence in Numbers
          </h2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1px", border: "1px solid rgba(201,168,76,0.2)" }}>
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 100}>
            <div style={{
              padding: "4rem 2rem", textAlign: "center",
              borderRight: i < stats.length - 1 ? "1px solid rgba(201,168,76,0.15)" : "none",
            }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(3rem, 5vw, 4.5rem)", color: "#c9a84c", fontWeight: 400 }}>
                <Counter target={s.val} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: "0.7rem", letterSpacing: "0.25em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginTop: "0.8rem" }}>{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── GALLERY ─── */
const galleryPanels = [
  {
    label: "Libraries", tall: true,
    render: () => (
      <svg width="100%" height="100%" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="500" fill="#081020"/>
        {[0,55,110,165,220,275,330,385,440].map((y,i)=>(
          <g key={i}>
            <rect x="0" y={y} width="400" height="50" fill={i%2===0?"#070e1c":"#060c18"}/>
            {[...Array(16)].map((_,j)=>{
              const c=["#8B1A1A","#1A3A8B","#1A6B2A","#8B6B1A","#4B1A8B","#c9a84c","#1A6B6B","#8B3A1A"];
              return <rect key={j} x={j*25+2} y={y+4} width="19" height="42" fill={c[(i+j)%c.length]} opacity="0.72" rx="1"/>;
            })}
          </g>
        ))}
        <rect width="400" height="500" fill="rgba(4,8,20,0.45)"/>
        <rect x="60" y="200" width="280" height="100" fill="rgba(4,8,20,0.75)" stroke="rgba(201,168,76,0.4)" strokeWidth="1"/>
        <text x="200" y="242" fill="#c9a84c" fontSize="16" textAnchor="middle" fontFamily="Georgia,serif">Libraries</text>
        <text x="200" y="268" fill="rgba(255,255,255,0.5)" fontSize="11" textAnchor="middle" fontFamily="Georgia,serif">50,000+ volumes</text>
        <line x1="90" y1="282" x2="310" y2="282" stroke="rgba(201,168,76,0.3)" strokeWidth="0.5"/>
      </svg>
    )
  },
  {
    label: "Classrooms", tall: false,
    render: () => (
      <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="300" fill="#081526"/>
        <rect x="10" y="20" width="380" height="110" fill="#0a2a0a" stroke="#c9a84c" strokeWidth="1"/>
        <text x="200" y="60" fill="#c9a84c" fontSize="14" textAnchor="middle" fontFamily="Georgia,serif">Today's Lesson</text>
        <text x="200" y="85" fill="rgba(255,255,255,0.5)" fontSize="11" textAnchor="middle" fontFamily="Georgia,serif">Critical Analysis · Problem Solving</text>
        <text x="50" y="112" fill="rgba(201,168,76,0.4)" fontSize="12" fontFamily="Georgia,serif">y = mx + c</text>
        <text x="280" y="112" fill="rgba(201,168,76,0.4)" fontSize="12" fontFamily="Georgia,serif">∑∞</text>
        {[60,130,200,270,340].map((x,i)=>(
          <g key={i}>
            <rect x={x-25} y="165" width="50" height="6" fill="#3d2b0a"/>
            <rect x={x-20} y="145" width="40" height="3" fill="#e8d9b0" opacity="0.5"/>
            <rect x={x-6} y="171" width="5" height="30" fill="#3d2b0a"/>
            <rect x={x+1} y="171" width="5" height="30" fill="#3d2b0a"/>
          </g>
        ))}
        {[100,200,300].map((x,i)=>(
          <g key={i}><line x1={x} y1="0" x2={x} y2="20" stroke="#c9a84c" strokeWidth="0.8"/><ellipse cx={x} cy="23" rx="18" ry="5" fill="rgba(201,168,76,0.25)"/></g>
        ))}
        <text x="200" y="275" fill="rgba(201,168,76,0.4)" fontSize="11" textAnchor="middle" fontFamily="Georgia,serif">Classrooms</text>
      </svg>
    )
  },
  {
    label: "Collaboration", tall: false,
    render: () => (
      <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="300" fill="#07101e"/>
        <ellipse cx="200" cy="160" rx="120" ry="50" fill="#1a1005" stroke="#c9a84c" strokeWidth="1"/>
        {[0,72,144,216,288].map((a,i)=>{
          const r=(a-90)*Math.PI/180, x=200+140*Math.cos(r), y=160+55*Math.sin(r);
          const cols=["#c9a84c","#4a8bc9","#8bc94a","#c94a8b","#4ac9c9"];
          return <g key={i}><circle cx={x} cy={y-20} r="14" fill={cols[i]} opacity="0.6"/><rect x={x-9} y={y-6} width="18" height="22" fill={cols[i]} opacity="0.4" rx="3"/></g>;
        })}
        <circle cx="200" cy="140" r="20" fill="rgba(201,168,76,0.15)" stroke="rgba(201,168,76,0.5)" strokeWidth="1"/>
        <text x="200" y="145" fill="#c9a84c" fontSize="10" textAnchor="middle" fontFamily="Georgia,serif">OBA</text>
        <text x="200" y="35" fill="#c9a84c" fontSize="14" textAnchor="middle" fontFamily="Georgia,serif">Collaboration</text>
        <text x="200" y="270" fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="middle" fontFamily="Georgia,serif">Learning together, growing together</text>
      </svg>
    )
  },
  {
    label: "Campus", tall: true,
    render: () => (
      <svg width="100%" height="100%" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="500" fill="#060d1a"/>
        <rect x="0" y="280" width="400" height="220" fill="#050a14"/>
        {/* main building */}
        <rect x="80" y="120" width="240" height="160" fill="#0a1830" stroke="#c9a84c" strokeWidth="1"/>
        <rect x="110" y="80" width="180" height="50" fill="#0a1830" stroke="#c9a84c" strokeWidth="1"/>
        <rect x="155" y="50" width="90" height="40" fill="#0a1830" stroke="#c9a84c" strokeWidth="1"/>
        <rect x="185" y="20" width="30" height="38" fill="#0a1830" stroke="#c9a84c" strokeWidth="1"/>
        <circle cx="200" cy="16" r="5" fill="#c9a84c"/>
        {[100,130,160,190,220,250,280].map((x,i)=>[135,175,215,255].map((y,j)=><rect key={`${i}${j}`} x={x} y={y} width="22" height="26" fill={Math.sin(i*j)>0?"rgba(201,168,76,0.2)":"rgba(201,168,76,0.06)"} stroke="#c9a84c" strokeWidth="0.4"/>))}
        {[90,130,170,210,250,290].map((x,i)=><rect key={i} x={x} y="120" width="12" height="160" fill="#081020" stroke="#c9a84c" strokeWidth="0.4"/>)}
        {/* steps */}
        <rect x="60" y="280" width="280" height="8" fill="#0d1f3e" stroke="#c9a84c" strokeWidth="0.5"/>
        <rect x="70" y="272" width="260" height="8" fill="#0a1830" stroke="#c9a84c" strokeWidth="0.5"/>
        {/* path */}
        <rect x="175" y="288" width="50" height="120" fill="#090f1e"/>
        {[295,325,355,385].map((y,i)=><line key={i} x1="175" y1={y} x2="225" y2={y} stroke="#c9a84c" strokeWidth="0.3" strokeOpacity="0.3"/>)}
        {/* trees */}
        {[50,340].map((x,i)=><g key={i}><line x1={x} y1="360" x2={x} y2="300" stroke="#1a3520" strokeWidth="7"/><ellipse cx={x} cy="285" rx="28" ry="36" fill="#1a3520"/><ellipse cx={x} cy="268" rx="18" ry="26" fill="#1f4228"/></g>)}
        <text x="200" y="455" fill="#c9a84c" fontSize="14" textAnchor="middle" fontFamily="Georgia,serif">Campus</text>
      </svg>
    )
  },
  {
    label: "Science Labs", tall: false,
    render: () => (
      <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="300" fill="#050d18"/>
        {/* lab bench */}
        <rect x="20" y="180" width="360" height="10" fill="#1a2a3a" stroke="#4a8bc9" strokeWidth="0.5"/>
        {/* beakers */}
        <path d="M70,140 L55,178 L95,178 L80,140Z" fill="none" stroke="#4a8bc9" strokeWidth="1.5"/>
        <ellipse cx="75" cy="175" rx="20" ry="5" fill="rgba(74,139,201,0.3)"/>
        <path d="M60,165 Q75,160 90,165" stroke="#4a8bc9" strokeWidth="1" fill="none"/>
        {/* flask */}
        <path d="M155,130 L150,180 L190,180 L185,130Z" fill="rgba(74,201,74,0.1)" stroke="#4ac974" strokeWidth="1.5"/>
        <ellipse cx="170" cy="130" rx="15" ry="5" fill="none" stroke="#4ac974" strokeWidth="1.5"/>
        <ellipse cx="170" cy="175" rx="20" ry="5" fill="rgba(74,201,74,0.3)"/>
        {/* test tubes */}
        {[240,260,280].map((x,i)=>(
          <g key={i}>
            <rect x={x} y="140" width="14" height="40" rx="7" fill={["rgba(201,74,74,0.2)","rgba(201,168,74,0.2)","rgba(74,74,201,0.2)"][i]} stroke={["#c94a4a","#c9a84c","#4a4ac9"][i]} strokeWidth="1"/>
          </g>
        ))}
        {/* microscope */}
        <rect x="330" y="130" width="10" height="50" fill="rgba(201,168,76,0.4)"/>
        <rect x="318" y="175" width="34" height="6" fill="rgba(201,168,76,0.4)"/>
        <ellipse cx="335" cy="130" rx="16" ry="12" fill="none" stroke="rgba(201,168,76,0.4)" strokeWidth="1.5"/>
        {/* atom */}
        <circle cx="200" cy="80" r="8" fill="#c9a84c"/>
        {[0,60,120].map((a,i)=><ellipse key={i} cx="200" cy="80" rx="55" ry="20" fill="none" stroke="rgba(201,168,76,0.4)" strokeWidth="1" transform={`rotate(${a} 200 80)`}/>)}
        <text x="200" y="268" fill="rgba(201,168,76,0.5)" fontSize="11" textAnchor="middle" fontFamily="Georgia,serif">Science Labs</text>
      </svg>
    )
  },
  {
    label: "Halls", tall: false,
    render: () => (
      <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="300" fill="#08060f"/>
        {/* grand hall */}
        {[40,100,160,220,280,340].map((x,i)=>(
          <g key={i}>
            <rect x={x} y="20" width="14" height="200" fill="#100d20" stroke="#c9a84c" strokeWidth="0.6"/>
            <rect x={x-8} y="14" width="30" height="10" fill="#100d20" stroke="#c9a84c" strokeWidth="0.6"/>
          </g>
        ))}
        {/* arched ceiling */}
        <path d="M0,120 Q200,20 400,120" fill="none" stroke="#c9a84c" strokeWidth="1"/>
        <path d="M40,120 Q200,40 360,120" fill="none" stroke="rgba(201,168,76,0.3)" strokeWidth="0.5"/>
        {/* chandeliers */}
        {[133,266].map((x,i)=>(
          <g key={i}>
            <line x1={x} y1="40" x2={x} y2="80" stroke="#c9a84c" strokeWidth="1"/>
            <ellipse cx={x} cy="83" rx="22" ry="7" fill="rgba(201,168,76,0.2)" stroke="#c9a84c" strokeWidth="0.8"/>
            {[-15,-7,0,7,15].map((dx,j)=><line key={j} x1={x+dx} y1="83" x2={x+dx} y2="97" stroke="#c9a84c" strokeWidth="0.7"/>)}
            <ellipse cx={x} cy="100" rx="28" ry="6" fill="rgba(201,168,76,0.15)"/>
          </g>
        ))}
        {/* floor tiles */}
        <rect x="0" y="220" width="400" height="80" fill="#070510"/>
        {[0,50,100,150,200,250,300,350,400].map((x,i)=><line key={`v${i}`} x1={x} y1="220" x2={x} y2="300" stroke="#c9a84c" strokeWidth="0.3" strokeOpacity="0.2"/>)}
        {[240,270].map((y,i)=><line key={`h${i}`} x1="0" y1={y} x2="400" y2={y} stroke="#c9a84c" strokeWidth="0.3" strokeOpacity="0.2"/>)}
        <text x="200" y="270" fill="rgba(201,168,76,0.5)" fontSize="11" textAnchor="middle" fontFamily="Georgia,serif">Halls</text>
      </svg>
    )
  },
];

function Campus() {
  const [active, setActive] = useState(null);
  return (
    <section id="campus" style={{ padding: "10rem 8vw", background: "rgba(255,255,255,0.015)" }}>
      <Reveal>
        <div style={{ marginBottom: "4rem" }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.4em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.2rem" }}>Student Life</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 400 }}>Campus & Facilities</h2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
        {galleryPanels.map((panel, i) => (
          <Reveal key={i} delay={i * 60}>
            <div
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              style={{
                position: "relative", overflow: "hidden", cursor: "pointer",
                aspectRatio: panel.tall ? "4/5" : "4/3",
                border: `1px solid ${active === i ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.12)"}`,
                transition: "border-color 0.4s ease",
              }}>
              <div style={{
                position: "absolute", inset: 0,
                opacity: active === i ? 1 : 0.7,
                transition: "opacity 0.4s ease",
                transform: active === i ? "scale(1.03)" : "scale(1)",
                transition: "opacity 0.4s ease, transform 0.5s ease",
              }}>
                {panel.render()}
              </div>
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(4,8,20,0.9) 0%, rgba(4,8,20,0.1) 50%, transparent 100%)",
                display: "flex", alignItems: "flex-end", padding: "1.2rem",
              }}>
                <span style={{
                  fontSize: "0.7rem", letterSpacing: "0.25em", color: "#c9a84c",
                  textTransform: "uppercase",
                  opacity: active === i ? 1 : 0.7,
                  transform: active === i ? "translateY(0)" : "translateY(4px)",
                  transition: "all 0.35s ease",
                }}>{panel.label}</span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── TESTIMONIALS ─── */
const testimonials = [
  { name: "Sarah M.", role: "Oxford University, 2024", quote: "Oxford Bridge Academy gave me not just grades, but the intellectual confidence to thrive at Oxford. The peer tutoring programme was transformative.", grade: "A*A*A" },
  { name: "James T.", role: "Imperial College, 2024", quote: "The A-Level support here is unmatched. My tutors understood exactly what I needed and pushed me to exceed every expectation I had for myself.", grade: "A*AA" },
  { name: "Priya K.", role: "LSE Economics, 2023", quote: "From GCSE all the way through Sixth Form, OBA shaped how I think. I wouldn't be at LSE without everything this academy gave me.", grade: "AAA" },
];

function Testimonials() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setActive(a => (a + 1) % testimonials.length), 5000);
    return () => clearInterval(iv);
  }, []);
  const t = testimonials[active];
  return (
    <section style={{ padding: "10rem 8vw" }}>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.4em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.2rem" }}>Testimonials</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 400 }}>Student Stories</h2>
        </div>
      </Reveal>
      <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", minHeight: "260px", position: "relative" }}>
        <div key={active} style={{ animation: "fadeIn 0.6s ease" }}>
          <div style={{ fontSize: "4rem", color: "rgba(201,168,76,0.3)", fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>"</div>
          <p style={{ fontSize: "clamp(1.1rem, 2vw, 1.4rem)", color: "rgba(255,255,255,0.85)", lineHeight: 1.8, fontFamily: "'Playfair Display', serif", fontStyle: "italic", marginBottom: "2.5rem" }}>
            {t.quote}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.5rem" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem" }}>{t.name}</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginTop: "0.2rem" }}>{t.role}</div>
            </div>
            <div style={{ padding: "0.4rem 1rem", border: "1px solid rgba(201,168,76,0.4)", fontSize: "0.75rem", color: "#c9a84c", letterSpacing: "0.1em" }}>{t.grade}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.6rem", marginTop: "3rem" }}>
          {testimonials.map((_, i) => (
            <button key={i} onClick={() => setActive(i)}
              style={{
                width: i === active ? "2rem" : "0.5rem", height: "2px",
                background: i === active ? "#c9a84c" : "rgba(255,255,255,0.2)",
                border: "none", cursor: "pointer", transition: "all 0.3s ease",
              }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </section>
  );
}

/* ─── APPLY ─── */
function Apply() {
  const [data, setData] = useState({ name: "", email: "", year: "", programme: "" });
  const [done, setDone] = useState(false);
  const [focused, setFocused] = useState(null);

  const inputStyle = (field) => ({
    width: "100%", padding: "1rem 0",
    background: "transparent",
    border: "none", borderBottom: `1px solid ${focused === field ? "#c9a84c" : "rgba(255,255,255,0.2)"}`,
    color: "#fff", fontSize: "0.95rem", fontFamily: "Georgia, serif",
    outline: "none", transition: "border-color 0.3s",
  });

  return (
    <section id="apply" style={{ padding: "10rem 8vw", background: "rgba(255,255,255,0.015)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8rem", alignItems: "center", maxWidth: "1100px", margin: "0 auto" }}>
        <Reveal>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.4em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.5rem" }}>Admissions</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.2rem, 4vw, 3.5rem)", fontWeight: 400, lineHeight: 1.2, marginBottom: "1.5rem" }}>
            Begin Your<br /><em style={{ color: "#c9a84c" }}>Journey</em>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.9, marginBottom: "2rem", fontSize: "0.9rem" }}>
            We accept a limited number of students each academic year to ensure an exceptional experience for all. Applications for the 2025–26 academic year are now open.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
            {["Small class sizes (max 12)", "Expert and peer tutors", "Personalised learning plans", "University application support"].map(item => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
                <div style={{ width: "20px", height: "1px", background: "#c9a84c", flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
          <div style={{ padding: "1.2rem 1.5rem", border: "1px solid rgba(201,168,76,0.2)", background: "rgba(201,168,76,0.04)" }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.3em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "0.8rem" }}>Contact Us Directly</div>
            <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.4rem" }}>📧 dr.tahirasial@gmail.com</div>
            <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>📞 07356 081103</div>
          </div>
        </Reveal>
        <Reveal delay={150}>
          {!done ? (
            <div>
              {[
                { key: "name", label: "Full Name", type: "text", placeholder: "Alexandra Johnson" },
                { key: "email", label: "Email Address", type: "email", placeholder: "alex@example.com" },
                { key: "year", label: "Year Group", type: "text", placeholder: "Year 10 / Year 12 etc." },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: "2rem" }}>
                  <label style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: "#c9a84c", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>{f.label}</label>
                  <input
                    type={f.type} placeholder={f.placeholder}
                    style={inputStyle(f.key)}
                    onFocus={() => setFocused(f.key)} onBlur={() => setFocused(null)}
                    onChange={e => setData({ ...data, [f.key]: e.target.value })}
                  />
                </div>
              ))}
              <div style={{ marginBottom: "2.5rem" }}>
                <label style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: "#c9a84c", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>Programme</label>
                <select
                  style={{ ...inputStyle("programme"), backgroundImage: "none" }}
                  onFocus={() => setFocused("programme")} onBlur={() => setFocused(null)}
                  onChange={e => setData({ ...data, programme: e.target.value })}>
                  <option value="" style={{ background: "#040814" }}>Select a programme</option>
                  <option style={{ background: "#040814" }}>GCSE Core Curriculum</option>
                  <option style={{ background: "#040814" }}>A-Level Advanced Studies</option>
                  <option style={{ background: "#040814" }}>Peer Tutoring</option>
                  <option style={{ background: "#040814" }}>STEM Excellence Track</option>
                  <option style={{ background: "#040814" }}>University Preparation</option>
                </select>
              </div>
              <GoldButton onClick={() => {
                if (!data.name || !data.email) return alert("Please fill in your name and email.");
                setDone(true);
              }}>Submit Application</GoldButton>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "4rem 2rem", border: "1px solid rgba(201,168,76,0.3)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>✦</div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.8rem", fontWeight: 400, color: "#c9a84c", marginBottom: "1rem" }}>Application Received</h3>
              <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>Thank you, {data.name}. Our admissions team will contact you at {data.email} within 2–3 business days.</p>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer style={{ padding: "5rem 8vw 3rem", borderTop: "1px solid rgba(201,168,76,0.15)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "4rem", marginBottom: "4rem" }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", color: "#c9a84c", marginBottom: "1.2rem" }}>Oxford Bridge Academy</div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", lineHeight: 1.9, maxWidth: "300px" }}>
            A premier London academy dedicated to cultivating academic excellence, personal integrity, and the leaders of tomorrow.
          </p>
        </div>
        {[
          { head: "Programmes", items: ["GCSE", "A-Level", "Peer Tutoring", "STEM Track", "University Prep"] },
          { head: "Academy", items: ["About Us", "Faculty", "Results", "Campus", "News"] },
          { head: "Contact", items: ["dr.tahirasial@gmail.com", "07356 081103", "Central London", "Mon–Fri 8am–6pm"] },
        ].map(col => (
          <div key={col.head}>
            <div style={{ fontSize: "0.65rem", letterSpacing: "0.3em", color: "#c9a84c", textTransform: "uppercase", marginBottom: "1.5rem" }}>{col.head}</div>
            {col.items.map(item => (
              <div key={item} style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginBottom: "0.7rem" }}>{item}</div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.25)" }}>© 2025 Oxford Bridge Academy. All rights reserved.</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.25)" }}>Est. London</div>
      </div>
    </footer>
  );
}

/* ─── APP ─── */
export default function App() {
  const mouse = useMouseParallax();
  const [theme, setTheme] = useState("dark");
 
 useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  const isDark = theme === "dark";
return (
  <div
    data-theme={theme}
    style={{
      background: isDark ? "#040814" : "#f5f3ef",
           minHeight: "100vh",
      transition: "all 0.4s ease",
      paddingTop: "70px",
    }}
  >
    <Nav theme={theme} setTheme={setTheme} />
      {/* THEME TOGGLE */}
      <button
        onClick={() =>
          setTheme((prev) => (prev === "dark" ? "light" : "dark"))
        }
        style={{
          position: "fixed",
          top: "70px",
          right: "20px",
          zIndex: 9999,
          padding: "0.5rem 1rem",
          border: "1px solid rgba(201,168,76,0.4)",
          background: "transparent",
          cursor: "pointer",
          fontSize: "0.75rem",
          letterSpacing: "0.1em",
          color: "inherit",
        }}
      >
        {theme === "dark" ? "LIGHT ☀️" : "DARK 🌙"}
      </button>

      <Hero mouse={mouse} />
      <Marquee />
      <About />
      <Programmes />
      <Results />
      <Campus />
      <Testimonials />
      <Apply />
      <Footer />
    </div>
  );
}