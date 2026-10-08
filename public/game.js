const MOB = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
/* ================= 미니 WebGL2 엔진: 수학 · 지오메트리 · GL 도우미 ================= */
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const M4 = {
  I() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
    return o;
  },
  persp(fy, asp, n, f) {
    const t = 1 / Math.tan(fy / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  },
  ortho(l, r, b, t, n, f) {
    const o = new Float32Array(16);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
  },
  look(e, at, up) {
    const z = V3.norm(V3.sub(e, at)); let x = V3.cross(up, z); if (V3.len(x) < 1e-5) x = [1, 0, 0]; x = V3.norm(x);
    const y = V3.cross(z, x), o = new Float32Array(16);
    o[0] = x[0]; o[1] = y[0]; o[2] = z[0]; o[4] = x[1]; o[5] = y[1]; o[6] = z[1]; o[8] = x[2]; o[9] = y[2]; o[10] = z[2];
    o[12] = -V3.dot(x, e); o[13] = -V3.dot(y, e); o[14] = -V3.dot(z, e); o[15] = 1; return o;
  },
  trs(p, r, s) {              // 이동, 회전(YXZ 오일러), 크기
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    s = s || [1, 1, 1];
    const m00 = cy * cz + sy * sx * sz, m01 = -cy * sz + sy * sx * cz, m02 = sy * cx;
    const m10 = cx * sz, m11 = cx * cz, m12 = -sx;
    const m20 = -sy * cz + cy * sx * sz, m21 = sy * sz + cy * sx * cz, m22 = cy * cx;
    return new Float32Array([m00 * s[0], m10 * s[0], m20 * s[0], 0, m01 * s[1], m11 * s[1], m21 * s[1], 0, m02 * s[2], m12 * s[2], m22 * s[2], 0, p[0], p[1], p[2], 1]);
  },
  seg(a, b, r) {              // 단위 원기둥(y 0~1, 반지름 1)을 a→b 선분으로
    const d = V3.sub(b, a), L = V3.len(d) || 1e-6, y = [d[0] / L, d[1] / L, d[2] / L];
    let x = V3.cross(Math.abs(y[1]) > .95 ? [1, 0, 0] : [0, 1, 0], y); x = V3.norm(x); const z = V3.cross(x, y);
    return new Float32Array([x[0] * r, x[1] * r, x[2] * r, 0, d[0], d[1], d[2], 0, z[0] * r, z[1] * r, z[2] * r, 0, a[0], a[1], a[2], 1]);
  },
  basis(x, y, z, p) { return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, p[0], p[1], p[2], 1]); },
  nm(m) {                     // 법선 행렬(여인수)
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    return new Float32Array([e * i - f * h, f * g - d * i, d * h - e * g, c * h - b * i, a * i - c * g, b * g - a * h, b * f - c * e, c * d - a * f, a * e - b * d]);
  },
  pt(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
};
const hex = s => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const cmix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

/* ----- 지오메트리 빌더 (위치·법선·색 + 인덱스) ----- */
function Geo() { return { p: [], n: [], c: [], i: [] }; }
function gv(g, p, n, c) { g.p.push(p[0], p[1], p[2]); g.n.push(n[0], n[1], n[2]); g.c.push(c[0], c[1], c[2]); return g.p.length / 3 - 1; }
function colAt(col, p, n) { return typeof col === 'function' ? col(p, n) : col; }
function gLathe(g, prof, seg, col, m) {         // prof: [[반지름, y], ...] 아래→위
  m = m || M4.I(); const nm = M4.nm(m), base = g.p.length / 3;
  const nors = prof.map((q, j) => {
    const a = prof[Math.max(0, j - 1)], b = prof[Math.min(prof.length - 1, j + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1; return [dy / l, -dr / l];
  });
  for (let j = 0; j < prof.length; j++) for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const lp = [prof[j][0] * ca, prof[j][1], prof[j][0] * sa], ln = [nors[j][0] * ca, nors[j][1], nors[j][0] * sa];
    const wp = M4.pt(m, lp), wn = V3.norm([nm[0] * ln[0] + nm[3] * ln[1] + nm[6] * ln[2], nm[1] * ln[0] + nm[4] * ln[1] + nm[7] * ln[2], nm[2] * ln[0] + nm[5] * ln[1] + nm[8] * ln[2]]);
    gv(g, wp, wn, colAt(col, wp, wn));
  }
  for (let j = 0; j < prof.length - 1; j++) for (let k = 0; k < seg; k++) {
    const a = base + j * (seg + 1) + k, b = a + 1, c = a + seg + 1, d = c + 1; g.i.push(a, c, b, b, c, d);
  }
}
function profSphere(r, rings) { const o = []; for (let j = 0; j <= rings; j++) { const t = -Math.PI / 2 + j / rings * Math.PI; o.push([Math.cos(t) * r, Math.sin(t) * r]); } o[0][0] = 0; o[rings][0] = 0; return o; }
function gSphere(g, c, rad, col, m0, seg, rings) {   // rad: 숫자 또는 [rx,ry,rz]
  const r = typeof rad === 'number' ? [rad, rad, rad] : rad, ms = M4.trs(c, [0, 0, 0], r);
  gLathe(g, profSphere(1, rings || 9), seg || 14, col, m0 ? M4.mul(m0, ms) : ms);
}
function gCyl(g, a, b, r0, r1, col, seg, caps) {     // a→b 원뿔대
  const m = M4.seg(a, b, 1), pr = [];
  if (caps) pr.push([0, 0]);
  pr.push([r0, 0], [r1, 1]); if (caps) pr.push([0, 1]);
  gLathe(g, pr, seg || 12, col, m);
}
function gBox(g, c, s, col, m0) {
  const m = m0 ? M4.mul(m0, M4.trs(c, [0, 0, 0])) : M4.trs(c, [0, 0, 0]), nm = M4.nm(m), hx = s[0] / 2, hy = s[1] / 2, hz = s[2] / 2;
  const faces = [[[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]], [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
    [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]], [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
    [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]], [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]]];
  for (const [n, vs] of faces) {
    const wn = V3.norm([nm[0] * n[0] + nm[3] * n[1] + nm[6] * n[2], nm[1] * n[0] + nm[4] * n[1] + nm[7] * n[2], nm[2] * n[0] + nm[5] * n[1] + nm[8] * n[2]]);
    const idx = vs.map(v => { const wp = M4.pt(m, v); return gv(g, wp, wn, colAt(col, wp, wn)); });
    g.i.push(idx[0], idx[1], idx[2], idx[0], idx[2], idx[3]);
  }
}
function gMerge(dst, src, m) {
  const base = dst.p.length / 3, nm = m ? M4.nm(m) : null;
  for (let k = 0; k < src.p.length; k += 3) {
    let p = [src.p[k], src.p[k + 1], src.p[k + 2]], n = [src.n[k], src.n[k + 1], src.n[k + 2]];
    if (m) { p = M4.pt(m, p); n = V3.norm([nm[0] * n[0] + nm[3] * n[1] + nm[6] * n[2], nm[1] * n[0] + nm[4] * n[1] + nm[7] * n[2], nm[2] * n[0] + nm[5] * n[1] + nm[8] * n[2]]); }
    gv(dst, p, n, [src.c[k], src.c[k + 1], src.c[k + 2]]);
  }
  for (const i of src.i) dst.i.push(base + i);
}
function rnd(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function noise3(x, y, z) { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); }

/* ----- GL 컨텍스트와 프로그램 ----- */
let gl = null, GLC = null;
function glInit(canvas) {
  GLC = canvas;
  gl = canvas.getContext('webgl2', { antialias: !MOB, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  return !!gl;
}
function mkProg(vs, fs, uniforms) {
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(o) + '\n' + s.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n')); return o; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {}; for (const n of uniforms) u[n] = gl.getUniformLocation(p, n);
  return { p, u };
}
function mkMesh(g, dynamic) {
  const n = g.p.length / 3, data = new Float32Array(n * 9);
  for (let k = 0; k < n; k++) { data.set(g.p.slice(k * 3, k * 3 + 3), k * 9); data.set(g.n.slice(k * 3, k * 3 + 3), k * 9 + 3); data.set(g.c.slice(k * 3, k * 3 + 3), k * 9 + 6); }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  for (let a = 0; a < 3; a++) { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 36, a * 12); }
  const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.i), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, vbo, n: g.i.length, data, nv: n, dyn: !!dynamic };
}
function meshUpload(m) { gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.data); }
function meshFree(m) { if (!m) return; gl.deleteVertexArray(m.vao); gl.deleteBuffer(m.vbo); }

/* 가변 굵기 튜브 (낚싯대 · 낚싯줄용). pts: [[x,y,z],...], rad(i,n) → 반지름 */
function tubeGeo(nPts, radial) {
  const g = Geo(); for (let j = 0; j < nPts; j++) for (let k = 0; k <= radial; k++) gv(g, [0, 0, 0], [0, 1, 0], [1, 1, 1]);
  for (let j = 0; j < nPts - 1; j++) for (let k = 0; k < radial; k++) { const a = j * (radial + 1) + k, b = a + 1, c = a + radial + 1, d = c + 1; g.i.push(a, c, b, b, c, d); }
  return g;
}
function tubeFill(m, pts, radius, radial, colFn) {
  const n = pts.length; let prevX = null;
  for (let j = 0; j < n; j++) {
    const a = pts[Math.max(0, j - 1)], b = pts[Math.min(n - 1, j + 1)];
    const t = V3.norm(V3.sub(b, a));
    let e1 = prevX ? V3.sub(prevX, V3.mul(t, V3.dot(prevX, t))) : V3.cross(Math.abs(t[1]) > .9 ? [1, 0, 0] : [0, 1, 0], t);
    e1 = V3.norm(e1); const e2 = V3.cross(t, e1); prevX = e1;
    const r = typeof radius === 'function' ? radius(j / (n - 1)) : radius, col = colFn ? colFn(j / (n - 1)) : [1, 1, 1];
    for (let k = 0; k <= radial; k++) {
      const an = k / radial * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an), nx = e1[0] * ca + e2[0] * sa, ny = e1[1] * ca + e2[1] * sa, nz = e1[2] * ca + e2[2] * sa;
      const o = (j * (radial + 1) + k) * 9;
      m.data[o] = pts[j][0] + nx * r; m.data[o + 1] = pts[j][1] + ny * r; m.data[o + 2] = pts[j][2] + nz * r;
      m.data[o + 3] = nx; m.data[o + 4] = ny; m.data[o + 5] = nz; m.data[o + 6] = col[0]; m.data[o + 7] = col[1]; m.data[o + 8] = col[2];
    }
  }
  meshUpload(m);
}

/* ================= 셰이더: 하늘 · 바다 · 라이팅 · 단면 ================= */
const GLSL_COMMON = `
uniform vec3 uSunDir, uMoonDir, uSunCol, uSkyTop, uSkyHor;
uniform float uNight, uCloud, uTime, uSunI;
uniform float uQ;
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
float rn3(vec3 p){ return (vnoise(p.xy+p.z*.37)+vnoise(p.yz+p.x*.41)+vnoise(p.zx+p.y*.29))*.3333; }
vec3 grade(vec3 c){ vec3 a=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14); c=mix(c,a,.5); float l=dot(c,vec3(.299,.587,.114)); return mix(vec3(l),c,1.07); }
vec3 skyGrad(vec3 d){
  float h=max(d.y,0.);
  vec3 col=mix(uSkyHor,uSkyTop,pow(h,.5));
  col=mix(col,uSkyHor*1.08,pow(1.-h,7.)*.55);
  float s0=max(dot(d,uSunDir),0.);
  col+=uSunCol*uSunI*(1.-uNight)*(pow(s0,3.)*.10+pow(s0,10.)*.10)*pow(1.-h,2.5);   // 태양 쪽 대기 산란
  col*=1.-.16*smoothstep(.35,1.,h);                                                 // 천정 쪽을 조금 더 깊게
  float s=max(dot(d,uSunDir),0.);
  col+=uSunCol*(pow(s,5.)*.16+pow(s,48.)*.30+pow(s,600.)*1.2)*uSunI*(1.-uNight);
  float m=max(dot(d,uMoonDir),0.);
  col+=vec3(.55,.62,.8)*(pow(m,40.)*.12)*uNight;
  return col;
}
`;

const CLOUD_GLSL = `
vec4 clouds(vec3 d){
  if(d.y<=.0) return vec4(0.);
  vec2 p=d.xz/(d.y*.55+.14)*.5+vec2(uTime*.006,uTime*.002);
  float n=fbm(p*1.25), n2=fbm(p*1.25+uSunDir.xz*.12+3.1);
  float cov=uCloud, th=1.-cov*1.05;
  float c=smoothstep(th,th+.3,n); c*=smoothstep(.0,.22,d.y);
  float thick=clamp((n-th)*3.2,0.,1.);
  float shade=clamp((n-n2)*5.+.55,0.,1.);
  float s=max(dot(d,uSunDir),0.);
  vec3 lit=uSunCol*.9*uSunI+uSkyHor*.5+.12, dark=uSkyTop*.6+uSkyHor*.16+.03;
  vec3 cc=mix(dark,lit,shade*(1.-.45*thick)+.15*(1.-thick));
  cc+=uSunCol*uSunI*pow(s,7.)*(1.-thick)*.55*(1.-uNight);          // 구름 가장자리 은빛 테두리
  cc=mix(cc,vec3(.35,.38,.43)*(.25+.75*uSunI),uRain*.7);
  cc*=mix(1.,.38,uNight);
  float a=c*(.82+.12*uRain);
  vec2 q=d.xz/(d.y+.12); float ci=fbm(vec2(q.x*.35+uTime*.004,q.y*1.9))*fbm(q*.6+7.3);   // 높은 권운
  float ca=smoothstep(.22,.5,ci)*.38*(1.-uCloud*.45)*smoothstep(.04,.3,d.y)*(1.-uRain);
  vec3 cir=(uSunCol*uSunI*.7+uSkyHor*.6+.1)*mix(1.,.35,uNight);
  cc=mix(cir,cc,a/(a+ca+1e-4)); a=1.-(1.-a)*(1.-ca);
  return vec4(cc,a);
}
`;
const VS_SKY = `#version 300 es
out vec2 vUV;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUV=p*2.-1.; gl_Position=vec4(vUV,.9999,1.); }`;
const FS_SKY = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform vec3 uCR, uCU, uCF; uniform float uTan, uAsp, uRain;
${GLSL_COMMON}
${CLOUD_GLSL}
void main(){
  vec3 d=normalize(uCF+uCR*vUV.x*uTan*uAsp+uCU*vUV.y*uTan);
  vec3 col=skyGrad(d);
  float m=max(dot(d,uMoonDir),0.);
  col=mix(col,vec3(.93,.95,1.),smoothstep(.99935,.9996,m)*uNight);
  float s=max(dot(d,uSunDir),0.);
  col=mix(col,uSunCol*1.6+.3,smoothstep(.99965,.99985,s)*(1.-uNight)*uSunI);
  if(uNight>.02&&d.y>0.){
    vec2 uv=d.xz/(d.y+.25)*90.; vec2 id=floor(uv); float r=hash21(id);
    float st=step(.9935,r)*smoothstep(.5,0.,length(fract(uv)-.5)) * (.6+.4*sin(uTime*2.+r*60.));
    col+=vec3(.85,.9,1.)*st*uNight*(1.-uCloud*.6)*smoothstep(.0,.15,d.y);
  }
  vec4 cl=clouds(d); col=mix(col,cl.rgb,cl.a);
  col=grade(col);
  col+=(hash21(gl_FragCoord.xy)-.5)/255.;
  o=vec4(col,1.);
}`;

const WAVE_FN = `
vec2 warpP(vec2 p){ return p+vec2(sin(p.y*.071+uTime*.13),cos(p.x*.059-uTime*.1))*1.7; }
float modA(vec2 p){ return 1.+.32*sin(.11*uTime+.021*p.x)*sin(.07*uTime+.016*p.y+1.3)+.14*sin(.23*uTime-.04*p.x+.03*p.y); }
float brA(int i){ return 1.+.3*sin(uTime*(.07+.031*float(i))+float(i)*1.9); }
`;
const VS_OCEAN = `#version 300 es
layout(location=0) in vec2 aXZ;
uniform mat4 uVP; uniform float uTime, uAmp;
${WAVE_FN}
out vec3 vW; out float vH; out vec2 vP;
const vec2 WD[5]=vec2[5](vec2(.97,.24),vec2(.74,-.67),vec2(-.31,.95),vec2(.5,.87),vec2(-.9,.43));
const float WK[5]=float[5](.42,.78,1.35,2.2,3.6);
const float WA[5]=float[5](.34,.2,.11,.055,.03);
void main(){
  vec2 q=warpP(aXZ); float m=modA(aXZ);
  float h=0.; vec2 dx=vec2(0.);
  for(int i=0;i<5;i++){ float k=WK[i]; float br=brA(i); float ph=k*dot(WD[i],q)+sqrt(9.8*k)*uTime; h+=WA[i]*br*sin(ph); dx+=WD[i]*WA[i]*br*cos(ph)*.55*uAmp*m; }   // 뾰족한 파도 마루(수평 변위) · 불규칙한 너울
  h*=m; vH=h/.75; vP=aXZ; vW=vec3(aXZ.x-dx.x,h*uAmp,aXZ.y-dx.y);
  gl_Position=uVP*vec4(vW,1.);
}`;
const FS_OCEAN = `#version 300 es
precision highp float;
in vec3 vW; in float vH; in vec2 vP; out vec4 o;
uniform vec3 uCam, uDeep, uShallow, uFogCol; uniform float uFog, uAmp, uSlab, uRain;
${GLSL_COMMON}
${CLOUD_GLSL}
${WAVE_FN}
const vec2 WD[5]=vec2[5](vec2(.97,.24),vec2(.74,-.67),vec2(-.31,.95),vec2(.5,.87),vec2(-.9,.43));
const float WK[5]=float[5](.42,.78,1.35,2.2,3.6);
const float WA[5]=float[5](.34,.2,.11,.055,.03);
const vec2 DD[4]=vec2[4](vec2(.6,.8),vec2(-.8,.6),vec2(.2,-.98),vec2(-.55,-.83));
const float DK[4]=float[4](6.5,9.3,13.7,19.)  ;
const float DA[4]=float[4](.016,.010,.006,.004);
void main(){
  if(uSlab>.5&&(vW.x<-4.||vW.x>4.||vW.z<-8.||vW.z>46.)) discard;
  vec2 p=warpP(vP); vec2 g=vec2(0.);
  for(int i=0;i<5;i++){ float k=WK[i]; g+=WA[i]*brA(i)*k*cos(k*dot(WD[i],p)+sqrt(9.8*k)*uTime)*WD[i]; }
  float dist=length(uCam-vW);
  float det=1./(1.+dist*.035)*(1.+uRain*.8);
  for(int i=0;i<4;i++){ float k=DK[i]; g+=DA[i]*k*cos(k*dot(DD[i],p)+sqrt(9.8*k)*uTime*1.1+float(i))*DD[i]*det; }
  g*=uAmp*modA(vP);
  vec3 N=normalize(vec3(-g.x,1.,-g.y));
  vec3 V=normalize(uCam-vW);
  float ndv=clamp(dot(N,V),0.,1.);
  vec3 R=reflect(-V,N); R.y=abs(R.y)+.01;
  float F=.025+.975*pow(1.-ndv,5.);
  vec3 Rn=normalize(R); vec3 refl=skyGrad(Rn);
  if(uQ>.5){ vec4 rc=clouds(Rn); refl=mix(refl,rc.rgb,rc.a*.85); }
  float sp=max(dot(R,uSunDir),0.);
  refl+=uSunCol*(pow(sp,900.)*.09+pow(sp,220.)*.05+pow(sp,50.)*.05)*uSunI*(1.-uNight);
  float mp=max(dot(R,uMoonDir),0.);
  refl+=vec3(.7,.8,1.)*(pow(mp,500.)*2.+pow(mp,60.)*.1)*uNight;
  float hh=clamp(vH*.5+.5,0.,1.);
  vec3 body=mix(uDeep,uShallow,hh*.55+.2*(1.-ndv));
  float sss=pow(clamp(dot(V,-uSunDir)*.5+.5,0.,1.),3.)*smoothstep(.3,1.,hh);
  body+=uSunCol*vec3(.04,.14,.11)*sss*uSunI*(1.-uNight);
  body+=uShallow*.3*pow(clamp(vH*.5+.5,0.,1.),3.)*(.3+.7*(1.-ndv))*(.25+.75*(1.-uNight));   // 파도 마루의 투과광
  vec3 col=mix(body,refl,F);
  float fn=vnoise(p*1.9+vec2(uTime*.3,0.))*.5+vnoise(p*5.3-vec2(0.,uTime*.45))*.3+vnoise(p*11.+vec2(uTime*.2,uTime*.1))*.2;
  float foam=smoothstep(.9,1.45,vH*(.5+.5*uAmp)+.5*(fn-.5)+uRain*.05)*(1.-F*.5);
  float lace=smoothstep(.35,.7,vnoise(p*7.5+fn*3.))*.6+.4;                                  // 거품 결
  col=mix(col,vec3(.94,.97,1.)*(.3+.7*clamp(uSunI+uNight*.2,0.,1.)),foam*.3*lace);
  float fg=1.-exp(-dist*uFog); col=mix(col,uFogCol,fg);
  col=grade(col);
  col+=(hash21(gl_FragCoord.xy)-.5)/255.;
  o=vec4(col,1.);
}`;

const VS_LIT = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol;
uniform mat4 uVP, uModel, uLightVP; uniform mat3 uNM;
uniform float uSway, uSwayH, uPhase, uTime;
out vec3 vN; out vec3 vCol; out vec3 vW; out vec4 vLS;
void main(){
  vec3 p=aPos;
  if(uSway>0.){ float f=pow(max(p.y,0.)/uSwayH,1.4); p.x+=sin(uTime*1.25+p.y*1.4+uPhase)*uSway*f; p.z+=cos(uTime*.9+p.y*1.1+uPhase)*uSway*.6*f; }
  vec4 w=uModel*vec4(p,1.); vW=w.xyz; vN=normalize(uNM*aNor); vCol=aCol; vLS=uLightVP*w;
  gl_Position=uVP*w;
}`;
const FS_LIT = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vCol; in vec3 vW; in vec4 vLS; out vec4 o;
uniform vec3 uCam, uSkyAmb, uGndAmb, uFogCol, uTint, uEmisCol, uDeepCol;
uniform float uFog, uEmis, uSpec, uRim, uAlpha, uWater, uShOn, uMoonI, uDetail, uRain;
uniform highp sampler2DShadow uShadow;
${GLSL_COMMON}
float shadowF(vec4 ls,float nl){
  if(uShOn<.5) return 1.;
  vec3 p=ls.xyz/ls.w*.5+.5;
  if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.;
  float bias=.0012+.003*(1.-nl); float s=0.; float tx=1./2048.;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) s+=texture(uShadow,vec3(p.xy+vec2(float(i),float(j))*tx*1.4,p.z-bias));
  return s/9.;
}
float caustic(vec2 p,float t){
  for(int i=0;i<3;i++){ p+=vec2(sin(p.y*1.7+t*.8+float(i)),cos(p.x*1.3-t*.7+float(i)*2.))*.55; }
  float c=sin(p.x*3.)*sin(p.y*3.); return pow(1.-abs(c),7.);
}
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uCam-vW);
  if(dot(N,V)<0.) N=-N;
  vec3 base=vCol*uTint; float wet=0., sp2=0.;
  if(uDetail>0.){
    vec3 q=vW; float k=9.;
    if(uQ>.5){ float h0=rn3(q*k), hx=rn3((q+vec3(.035,0.,0.))*k), hy=rn3((q+vec3(0.,.035,0.))*k), hz=rn3((q+vec3(0.,0.,.035))*k);
    vec3 gr=vec3(hx-h0,hy-h0,hz-h0)/.035; gr-=N*dot(gr,N);
    N=normalize(N-gr*.045*uDetail); }                                                      // 바위 표면 요철
    float big=rn3(q*1.4), mid=rn3(q*4.), fine=rn3(q*24.);
    base*=(.62+.7*big)*(.82+.36*mid)*(.9+.2*fine);                                         // 얼룩 · 결 · 미세한 입자
    wet=(1.-smoothstep(.2,1.3,q.y+.25*mid))*(1.-uRain*0.)+uRain*.55;                       // 물에 젖은 부분 / 비 오는 날
    wet=clamp(wet,0.,1.);
    float band=smoothstep(1.7,.25,q.y)*smoothstep(-1.2,-.2,q.y);
    float alg=band*smoothstep(.42,.7,mid+.25*big);
    base=mix(base,vec3(.1,.2,.07)*(.6+.8*fine),alg*.6*uDetail);                           // 이끼
    float bar=band*smoothstep(.78,.86,rn3(q*34.));
    base=mix(base,vec3(.78,.76,.68),bar*.55*uDetail);                                     // 따개비
    base*=1.-.38*wet*uDetail; sp2=wet*uDetail;
  }
  float nl=dot(N,uSunDir); float diff=max(nl,0.);
  float sh=shadowF(vLS,max(nl,0.));
  vec3 hemi=mix(uGndAmb,uSkyAmb,N.y*.5+.5);
  vec3 lightC=uSunCol*uSunI*(1.-uNight)+vec3(.45,.55,.8)*uMoonI*uNight;
  vec3 col=base*(hemi+lightC*diff*sh);
  vec3 H=normalize(uSunDir+V);
  col+=lightC*pow(max(dot(N,H),0.),48.)*uSpec*sh*step(0.,nl);
  col+=lightC*pow(max(dot(N,H),0.),70.)*sp2*.55*sh*step(0.,nl)+uSkyAmb*sp2*pow(1.-max(dot(N,V),0.),3.)*.5;
  col+=uSkyAmb*pow(1.-max(dot(N,V),0.),3.)*uRim;
  col+=base*uEmis*uEmisCol;
  float dist=length(uCam-vW);
  if(uWater>.5&&vW.y<0.){
    float d=clamp(-vW.y/16.,0.,1.);
    float c=caustic(vW.xz*.6,uTime)*(1.-d)*max(N.y,0.)*.5;
    col=mix(col,uDeepCol,clamp(d*.85+.12,0.,1.));
    col+=vec3(.25,.55,.6)*c*(.4+.6*(1.-uNight));
  }
  col=mix(col,uFogCol,1.-exp(-dist*uFog));
  col=grade(col);
  o=vec4(col,uAlpha);
}`;
const VS_DEPTH = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uLightVP, uModel;
void main(){ gl_Position=uLightVP*uModel*vec4(aPos,1.); }`;
const FS_DEPTH = `#version 300 es
precision mediump float; out vec4 o; void main(){ o=vec4(1.); }`;

/* 단면 유리 (카메라 쪽 앞면): 물결을 따라 위쪽 경계가 출렁임 */
const VS_GLASS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=2) in vec3 aCol;
uniform mat4 uVP; uniform float uTime, uAmp;
out vec3 vW; out float vDepth;
const vec2 WD[5]=vec2[5](vec2(.97,.24),vec2(.74,-.67),vec2(-.31,.95),vec2(.5,.87),vec2(-.9,.43));
const float WK[5]=float[5](.42,.78,1.35,2.2,3.6);
const float WA[5]=float[5](.34,.2,.11,.055,.03);
void main(){
  float h=0.; vec2 p=aPos.xz;
  for(int i=0;i<5;i++){ float k=WK[i]; h+=WA[i]*sin(k*dot(WD[i],p)+sqrt(9.8*k)*uTime); }
  vec3 w=aPos; if(aCol.x>.5) w.y=h*uAmp; vW=w; vDepth=-w.y;
  gl_Position=uVP*vec4(w,1.);
}`;
const FS_GLASS = `#version 300 es
precision highp float;
in vec3 vW; in float vDepth; out vec4 o;
uniform vec3 uDeep, uShallow, uFogCol; uniform float uSunI, uNight, uTime;
void main(){
  float d=clamp(vDepth/14.,0.,1.);
  vec3 col=mix(uShallow,uDeep,1.-exp(-d*2.4));
  float a=mix(.16,.5,d);
  float edge=smoothstep(.0,.28,vDepth);
  col=mix(vec3(.85,.97,1.)*(.4+.6*uSunI),col,edge);
  a=mix(.78,a,edge);
  a+=smoothstep(.12,0.,abs(vDepth-.05))*.35;
  o=vec4(col,a);
}`;
const VS_WALL = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP; out vec3 vW;
void main(){ vW=aPos; gl_Position=uVP*vec4(aPos,1.); }`;
const FS_WALL = `#version 300 es
precision highp float;
in vec3 vW; out vec4 o;
uniform vec3 uDeep, uShallow, uFogCol, uSunDir; uniform float uTime, uSunI, uNight, uSeabed;
${GLSL_COMMON.replace('uniform vec3 uSunDir, uMoonDir, uSunCol, uSkyTop, uSkyHor;','uniform vec3 uMoonDir, uSunCol, uSkyTop, uSkyHor;').replace('uniform float uNight, uCloud, uTime, uSunI;','uniform float uCloud;')}
void main(){
  float depth=max(-vW.y,0.);
  vec3 col=mix(uShallow*1.05,uDeep,1.-exp(-depth*.2));
  col=mix(col,uFogCol*.55+col*.5,smoothstep(8.,40.,vW.z)*.45);
  float s1=sin(vW.z*.55-vW.y*.42+uTime*.13+fbm(vec2(vW.z*.08,uTime*.02))*4.);
  float s2=sin(vW.z*1.3-vW.y*.9-uTime*.1+2.);
  float ray=pow(clamp(.5+.5*s1,0.,1.),5.)*.7+pow(clamp(.5+.5*s2,0.,1.),8.)*.4;
  ray*=exp(-depth*.16)*smoothstep(0.,1.5,depth)*uSunI*(1.-uNight*.9);
  col+=vec3(.5,.85,.8)*ray*.28;
  float bed=smoothstep(0.,2.,depth-(uSeabed-2.));
  col=mix(col,col*.55,bed);
  o=vec4(col,1.);
}`;

/* 점 스프라이트 (물보라 · 기포 · 플랑크톤 · 빛무리) */
const VS_PTS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in float aSize;
uniform mat4 uVP; uniform float uPx;
out vec4 vCol;
void main(){ vec4 c=uVP*vec4(aPos,1.); gl_Position=c; vCol=aCol; gl_PointSize=clamp(aSize*uPx/max(c.w,.1),1.,220.); }`;
const FS_PTS = `#version 300 es
precision mediump float;
in vec4 vCol; out vec4 o; uniform float uSoft;
void main(){ float d=length(gl_PointCoord-.5)*2.; float a=smoothstep(1.,uSoft,d)*vCol.a; if(a<.003) discard; o=vec4(vCol.rgb,a); }`;

/* 물결 링 */
const VS_RING = `#version 300 es
layout(location=0) in vec2 aUV; uniform mat4 uVP; uniform vec3 uC; uniform float uR;
out vec2 vUV;
void main(){ vUV=aUV; gl_Position=uVP*vec4(uC.x+aUV.x*uR,uC.y,uC.z+aUV.y*uR,1.); }`;
const FS_RING = `#version 300 es
precision mediump float;
in vec2 vUV; out vec4 o; uniform vec4 uCol; uniform float uW;
void main(){ float d=length(vUV); float r=smoothstep(1.-uW,1.-uW*.5,d)*smoothstep(1.,1.-uW*.5,d); float f=smoothstep(1.,0.,d)*.08; o=vec4(uCol.rgb,(r+f)*uCol.a); if(o.a<.003) discard; }`;

/* ----- 프로그램 생성 ----- */
const ENV_U = ['uSunDir', 'uMoonDir', 'uSunCol', 'uSkyTop', 'uSkyHor', 'uNight', 'uCloud', 'uTime', 'uSunI', 'uRain', 'uFog', 'uFogCol', 'uSkyAmb', 'uGndAmb', 'uCam', 'uDeep', 'uShallow', 'uDeepCol', 'uMoonI', 'uAmp', 'uQ'];
const PR = {};
function buildPrograms() {
  PR.sky = mkProg(VS_SKY, FS_SKY, [...ENV_U, 'uCR', 'uCU', 'uCF', 'uTan', 'uAsp']);
  PR.ocean = mkProg(VS_OCEAN, FS_OCEAN, [...ENV_U, 'uVP', 'uSlab']);
  PR.lit = mkProg(VS_LIT, FS_LIT, [...ENV_U, 'uVP', 'uModel', 'uLightVP', 'uNM', 'uSway', 'uSwayH', 'uPhase', 'uTint', 'uEmisCol', 'uEmis', 'uSpec', 'uRim', 'uAlpha', 'uWater', 'uShOn', 'uShadow', 'uDetail']);
  PR.depth = mkProg(VS_DEPTH, FS_DEPTH, ['uLightVP', 'uModel']);
  PR.glass = mkProg(VS_GLASS, FS_GLASS, [...ENV_U, 'uVP']);
  PR.wall = mkProg(VS_WALL, FS_WALL, [...ENV_U, 'uVP', 'uSeabed']);
  PR.pts = mkProg(VS_PTS, FS_PTS, ['uVP', 'uPx', 'uSoft']);
  PR.ring = mkProg(VS_RING, FS_RING, ['uVP', 'uC', 'uR', 'uCol', 'uW']);
}
const ENV = { q: 1, sunDir: [0, 1, 0], moonDir: [0, -1, 0], sunCol: [1, 1, 1], skyTop: [.2, .4, .8], skyHor: [.7, .8, .9], night: 0, cloud: .3, rain: 0, sunI: 1, moonI: .3, fog: .002, fogCol: [.7, .8, .9], skyAmb: [.5, .55, .6], gndAmb: [.25, .25, .25], deep: [.02, .12, .2], shallow: [.1, .5, .6], deepCol: [.02, .1, .16], amp: 1, time: 0 };
function applyEnv(P, cam) {
  const u = P.u, s3 = (n, v) => { if (u[n]) gl.uniform3fv(u[n], v); }, s1 = (n, v) => { if (u[n]) gl.uniform1f(u[n], v); };
  s3('uSunDir', ENV.sunDir); s3('uMoonDir', ENV.moonDir); s3('uSunCol', ENV.sunCol); s3('uSkyTop', ENV.skyTop); s3('uSkyHor', ENV.skyHor); s3('uFogCol', ENV.fogCol);
  s3('uSkyAmb', ENV.skyAmb); s3('uGndAmb', ENV.gndAmb); s3('uDeep', ENV.deep); s3('uShallow', ENV.shallow); s3('uDeepCol', ENV.deepCol);
  s1('uNight', ENV.night); s1('uCloud', ENV.cloud); s1('uTime', ENV.time); s1('uSunI', ENV.sunI); s1('uRain', ENV.rain); s1('uFog', ENV.fog); s1('uMoonI', ENV.moonI); s1('uAmp', ENV.amp); s1('uQ', ENV.q);
  if (cam && u.uCam) gl.uniform3fv(u.uCam, cam);
}

/* ----- 시간대 · 날씨 → 환경 값 ----- */
const KEYS = [
  [0, '#04081a', '#0b1634', '#000000', 0], [4.6, '#081030', '#17224a', '#000000', 0], [5.6, '#27346a', '#e98660', '#ff9a68', .45], [6.7, '#4a7cc0', '#f7c78f', '#ffcf94', .85],
  [8.5, '#2f78d2', '#a8d3ef', '#fff2d8', 1.15], [12, '#1b6ccf', '#9ed1f0', '#fff6e4', 1.25], [16, '#2a74cf', '#a4d2ee', '#fff0d8', 1.1], [17.8, '#4b78b8', '#f3b676', '#ffbf80', .9],
  [18.9, '#383874', '#df6f5a', '#ff8a60', .45], [19.9, '#12183e', '#5b3b66', '#c06a6a', .12], [21.2, '#060c22', '#142046', '#000000', 0], [24, '#04081a', '#0b1634', '#000000', 0]];
function updateEnv(h, wx, t) {
  let a = KEYS[0], b = KEYS[1];
  for (let i = 0; i < KEYS.length - 1; i++) if (h >= KEYS[i][0] && h <= KEYS[i + 1][0]) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  const u = (h - a[0]) / (b[0] - a[0] || 1);
  let top = cmix(hex(a[1]), hex(b[1]), u), hor = cmix(hex(a[2]), hex(b[2]), u), sunCol = cmix(hex(a[3]), hex(b[3]), u), sunI = lerp(a[4], b[4], u);
  const rain = wx === 'rain' ? 1 : 0, cloud = wx === 'clear' ? .3 : wx === 'calm' ? .16 : wx === 'cloud' ? .6 : wx === 'rough' ? .72 : .78;
  const gray = [(top[0] + top[1] + top[2]) / 3, 0, 0]; const gk = wx === 'rain' ? .55 : wx === 'rough' ? .4 : wx === 'cloud' ? .25 : 0;
  const dl = clamp(sunI / 1.1, 0, 1);
  top = cmix(top, cmul([.5, .55, .62], .25 + .75 * dl), gk); hor = cmix(hor, cmul([.62, .66, .72], .25 + .75 * dl), gk);
  sunI *= wx === 'rain' ? .42 : wx === 'rough' ? .6 : wx === 'cloud' ? .75 : 1;
  const el = Math.sin(Math.PI * (h - 6) / 12) * 1.08, azS = .35, elS = (h >= 5.5 && h <= 18.5) ? el : -.2;
  ENV.sunDir = V3.norm([Math.sin(azS) * Math.cos(elS), Math.sin(elS), Math.cos(azS) * Math.cos(elS)]);
  const hm = h < 6 ? h + 24 : h, um = (hm - 18) / 12, elM = Math.sin(Math.PI * clamp(um, 0, 1)) * .95 + .05;
  ENV.moonDir = V3.norm([Math.sin(-.4) * Math.cos(elM), Math.sin(elM), Math.cos(-.4) * Math.cos(elM)]);
  ENV.night = 1 - smooth(.05, .4, dl);
  ENV.skyTop = top; ENV.skyHor = hor; ENV.sunCol = sunCol; ENV.sunI = Math.max(sunI, 0); ENV.cloud = cloud; ENV.rain = rain; ENV.time = t;
  ENV.moonI = .55 * (1 - smooth(.0, .3, dl)) * (wx === 'clear' || wx === 'calm' ? 1 : .65);
  ENV.fog = wx === 'rain' ? .0075 : wx === 'rough' ? .0046 : wx === 'cloud' ? .0034 : wx === 'calm' ? .0018 : .0024; ENV.fogCol = cmix(hor, cmul(hor, .8), .3);
  const sk = cmix(top, hor, .35); ENV.skyAmb = cmul(cmix(sk, [.55, .6, .68], .25), .38 + .45 * dl + .1 * ENV.night); ENV.gndAmb = cmul(cmix([.2, .3, .34], hor, .3), .22 + .3 * dl);
  ENV.deep = cmix(hex('#031017'), hex('#04283a'), dl); ENV.shallow = cmix(hex('#0a2236'), hex('#17808f'), dl); ENV.deepCol = cmix(hex('#010710'), hex('#06293a'), dl);
  ENV.shallow = cmix(ENV.shallow, cmul(hor, .5), gk * .9);
  ENV.amp = wx === 'rain' ? 1.8 : wx === 'rough' ? 2.7 : wx === 'cloud' ? 1.2 : wx === 'calm' ? .2 : 1;
  ENV.light = ENV.sunI > .08 && elS > .02 ? ENV.sunDir : ENV.moonDir;
  ENV.dl = dl;
}

/* ================= 렌더 코어: 카메라 · 바다 메시 · 패스 ================= */
const CAMR = { pos: [1.5, 4.8, -6.8], tgt: [1.5, 1.4, 12], fov: .74, near: .1, far: 1600, vp: null, view: null, proj: null, fwd: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0], asp: 16 / 9 };
const RS = { w: 960, h: 540, dpr: 1, ocean: null, quad: null, shadow: null, pts: null, ptsN: 0, ptsBuf: null, ptsVao: null, slab: false, showOcean: true };

function camUpdate() {
  CAMR.view = M4.look(CAMR.pos, CAMR.tgt, [0, 1, 0]); CAMR.proj = M4.persp(CAMR.fov, CAMR.asp, CAMR.near, CAMR.far); CAMR.vp = M4.mul(CAMR.proj, CAMR.view);
  const f = V3.norm(V3.sub(CAMR.tgt, CAMR.pos)); let r = V3.cross(f, [0, 1, 0]); if (V3.len(r) < 1e-4) r = [1, 0, 0]; r = V3.norm(r);
  CAMR.fwd = f; CAMR.right = r; CAMR.up = V3.cross(r, f);
}
function project(p) {           // 월드 → 화면(CSS px)
  const v = CAMR.vp, x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12], y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13], w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
  return { x: (x / w * .5 + .5) * RS.w, y: (1 - (y / w * .5 + .5)) * RS.h, w, s: RS.h / (2 * Math.tan(CAMR.fov / 2)) / Math.max(w, .01) };
}

/* 파도 높이 (셰이더와 같은 식) */
const WV = [[.97, .24, .42, .34], [.74, -.67, .78, .2], [-.31, .95, 1.35, .11], [.5, .87, 2.2, .055], [-.9, .43, 3.6, .03]];
const wWarp = (x, z, t) => [x + Math.sin(z * .071 + t * .13) * 1.7, z + Math.cos(x * .059 - t * .1) * 1.7];
const wMod = (x, z, t) => 1 + .32 * Math.sin(.11 * t + .021 * x) * Math.sin(.07 * t + .016 * z + 1.3) + .14 * Math.sin(.23 * t - .04 * x + .03 * z);
const wBr = (i, t) => 1 + .3 * Math.sin(t * (.07 + .031 * i) + i * 1.9);
function waveH(x, z, t) { const [px, pz] = wWarp(x, z, t); let h = 0; WV.forEach((w, i) => { h += w[3] * wBr(i, t) * Math.sin(w[2] * (w[0] * px + w[1] * pz) + Math.sqrt(9.8 * w[2]) * t); }); return h * wMod(x, z, t) * ENV.amp; }
function waveSlope(x, z, t) { const [px, pz] = wWarp(x, z, t), m = wMod(x, z, t); let gx = 0, gz = 0; WV.forEach((w, i) => { const c = w[3] * wBr(i, t) * w[2] * Math.cos(w[2] * (w[0] * px + w[1] * pz) + Math.sqrt(9.8 * w[2]) * t) * ENV.amp * m; gx += c * w[0]; gz += c * w[1]; }); return [gx, gz]; }

function buildOcean() {
  const NR = 150, NA = 256, rMax = 1100, r0 = .25, kk = Math.log(rMax / r0 + 1) / NR, pos = new Float32Array((NR + 1) * (NA + 1) * 2), idx = [];
  for (let i = 0; i <= NR; i++) { const r = r0 * (Math.exp(i * kk) - 1); for (let j = 0; j <= NA; j++) { const a = j / NA * Math.PI * 2, o = (i * (NA + 1) + j) * 2; pos[o] = Math.cos(a) * r; pos[o + 1] = Math.sin(a) * r; } }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW); gl.bindVertexArray(null);
  RS.ocean = { vao, n: idx.length };
  const qv = gl.createVertexArray(); gl.bindVertexArray(qv); const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
  RS.quad = { vao: qv, n: 6 };
  const sv = gl.createVertexArray(); RS.skyVao = sv;
}

/* 그림자 맵 */
const SH = { size: MOB ? 1024 : 2048, tex: null, fbo: null, vp: M4.I(), on: true };
function buildShadow() {
  SH.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, SH.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SH.size, SH.size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  SH.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, SH.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, SH.tex, 0);
  gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function shadowUpdate() {
  const L = ENV.light, c = [0, 1.8, 1.5], eye = V3.add(c, V3.mul(L, 24));
  SH.vp = M4.mul(M4.ortho(-7, 7, -7, 7, 1, 50), M4.look(eye, c, Math.abs(L[1]) > .95 ? [0, 0, 1] : [0, 1, 0]));
  SH.on = ENV.light[1] > .08;
}

/* 점 스프라이트 배치 */
function buildPoints() {
  RS.ptsCap = 4096; RS.ptsData = new Float32Array(RS.ptsCap * 8);
  RS.ptsVao = gl.createVertexArray(); gl.bindVertexArray(RS.ptsVao); RS.ptsBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, RS.ptsBuf);
  gl.bufferData(gl.ARRAY_BUFFER, RS.ptsData.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28);
  gl.bindVertexArray(null); RS.ptsN = 0;
}
function pt(x, y, z, r, g, b, a, size) { if (RS.ptsN >= RS.ptsCap) return; const o = RS.ptsN++ * 8, d = RS.ptsData; d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = r; d[o + 4] = g; d[o + 5] = b; d[o + 6] = a; d[o + 7] = size; }
function flushPoints(additive, soft) {
  if (!RS.ptsN) return;
  gl.useProgram(PR.pts.p); gl.uniformMatrix4fv(PR.pts.u.uVP, false, CAMR.vp); gl.uniform1f(PR.pts.u.uPx, RS.h * RS.dpr / (2 * Math.tan(CAMR.fov / 2))); gl.uniform1f(PR.pts.u.uSoft, soft == null ? .2 : soft);
  gl.enable(gl.BLEND); gl.blendFunc(additive ? gl.SRC_ALPHA : gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.bindVertexArray(RS.ptsVao); gl.bindBuffer(gl.ARRAY_BUFFER, RS.ptsBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, RS.ptsData, 0, RS.ptsN * 8);
  gl.drawArrays(gl.POINTS, 0, RS.ptsN); gl.bindVertexArray(null); gl.depthMask(true); RS.ptsN = 0;
}

/* 메시 그리기 */
function drawMesh(m, model, o) {
  if (RS.depthPass) { gl.uniformMatrix4fv(PR.depth.u.uModel, false, model); gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0); return; }
  o = o || {}; const P = PR.lit, u = P.u;
  gl.uniformMatrix4fv(u.uModel, false, model); gl.uniformMatrix3fv(u.uNM, false, M4.nm(model));
  gl.uniform3fv(u.uTint, o.tint || [1, 1, 1]); gl.uniform1f(u.uEmis, o.emis || 0); gl.uniform3fv(u.uEmisCol, o.emisCol || [1, 1, 1]); gl.uniform1f(u.uSpec, o.spec || 0); gl.uniform1f(u.uRim, o.rim || 0);
  gl.uniform1f(u.uAlpha, o.alpha == null ? 1 : o.alpha); gl.uniform1f(u.uSway, o.sway || 0); gl.uniform1f(u.uSwayH, o.swayH || 1); gl.uniform1f(u.uPhase, o.phase || 0); gl.uniform1f(u.uDetail, o.detail || 0);
  gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0);
}
function beginLit(shadowOn, water) {
  const P = PR.lit; gl.useProgram(P.p); applyEnv(P, CAMR.pos); gl.uniform3fv(P.u.uSunDir, ENV.light);
  gl.uniformMatrix4fv(P.u.uVP, false, CAMR.vp); gl.uniformMatrix4fv(P.u.uLightVP, false, SH.vp);
  gl.uniform1f(P.u.uShOn, shadowOn && SH.on ? 1 : 0); gl.uniform1f(P.u.uWater, water ? 1 : 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, SH.tex); gl.uniform1i(P.u.uShadow, 0);
}
function drawSky() {
  const P = PR.sky; gl.useProgram(P.p); applyEnv(P, CAMR.pos);
  gl.uniform3fv(P.u.uCR, CAMR.right); gl.uniform3fv(P.u.uCU, CAMR.up); gl.uniform3fv(P.u.uCF, CAMR.fwd); gl.uniform1f(P.u.uTan, Math.tan(CAMR.fov / 2)); gl.uniform1f(P.u.uAsp, CAMR.asp);
  gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(RS.skyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.enable(gl.DEPTH_TEST);
}
function drawOcean(slab) {
  const P = PR.ocean; gl.useProgram(P.p); applyEnv(P, CAMR.pos); gl.uniformMatrix4fv(P.u.uVP, false, CAMR.vp); gl.uniform1f(P.u.uSlab, slab ? 1 : 0);
  gl.bindVertexArray(RS.ocean.vao); gl.drawElements(gl.TRIANGLES, RS.ocean.n, gl.UNSIGNED_INT, 0);
}
function drawRing(cx, cy, cz, r, col, w) {
  const P = PR.ring; gl.useProgram(P.p); gl.uniformMatrix4fv(P.u.uVP, false, CAMR.vp); gl.uniform3f(P.u.uC, cx, cy, cz); gl.uniform1f(P.u.uR, r); gl.uniform4fv(P.u.uCol, col); gl.uniform1f(P.u.uW, w || .12);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.bindVertexArray(RS.quad.vao); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.depthMask(true);
}

function resizeGL() {
  const r = GLC.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, ENV.q > .5 ? 2 : 1.25);
  RS.w = Math.max(2, r.width); RS.h = Math.max(2, r.height); RS.dpr = dpr;
  const W = Math.round(RS.w * dpr), H = Math.round(RS.h * dpr);
  if (GLC.width !== W || GLC.height !== H) { GLC.width = W; GLC.height = H; }
  CAMR.asp = RS.w / RS.h;
}

/* ================= 모델: 부두 · 바위 · 낚시꾼 · 찌 · 물고기 · 수중 단면 ================= */
const MODELS = { spot: [], spotIdx: -1, unitCyl: null, unitSph: null };

function woodCol(seed) { const r = rnd(seed); return () => { const v = .82 + r() * .3; return [.56 * v, .42 * v, .29 * v]; }; }

/* ----- 포인트 지형 ----- */
function gBlob(g, c, rad, seed, colFn, seg, rings) {
  const R = rnd(seed), ph = [R() * 6, R() * 6, R() * 6]; seg = seg || 22; rings = rings || 14; const base = g.p.length / 3;
  const P = [];
  for (let j = 0; j <= rings; j++) {
    const t = -Math.PI / 2 + j / rings * Math.PI;
    for (let k = 0; k <= seg; k++) {
      const a = k / seg * Math.PI * 2, d = [Math.cos(t) * Math.cos(a), Math.sin(t), Math.cos(t) * Math.sin(a)];
      const n1 = 1 + .22 * Math.sin(d[0] * 3.1 + ph[0]) * Math.cos(d[2] * 2.7 + ph[1]) + .12 * Math.sin(d[1] * 5. + d[0] * 4. + ph[2]) + .06 * Math.sin(d[0] * 9 + d[2] * 8 + ph[0]);
      const rv = rad.map(x => x * n1);
      P.push([c[0] + d[0] * rv[0], c[1] + d[1] * rv[1], c[2] + d[2] * rv[2]]);
    }
  }
  for (let j = 0; j <= rings; j++) for (let k = 0; k <= seg; k++) {
    const p = P[j * (seg + 1) + k], pk = P[j * (seg + 1) + (k + 1) % (seg + 1)], pj = P[Math.min(rings, j + 1) * (seg + 1) + k], pjm = P[Math.max(0, j - 1) * (seg + 1) + k], pkm = P[j * (seg + 1) + (k + seg) % (seg + 1)];
    let n = V3.cross(V3.sub(pj, pjm), V3.sub(pk, pkm)); n = V3.norm(n); if (V3.dot(n, V3.sub(p, c)) < 0) n = V3.mul(n, -1);
    gv(g, p, n, colFn(p, n));
  }
  for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) { const a = base + j * (seg + 1) + k, b = a + 1, cc = a + seg + 1, d = cc + 1; g.i.push(a, cc, b, b, cc, d); }
}
function rockCol(seed) {
  const R = rnd(seed);
  return (p, n) => {
    const v = .8 + noise3(p[0] * 3, p[1] * 3, p[2] * 3) * .35; let c = [.34 * v, .33 * v, .32 * v];
    if (p[1] < .5) c = cmix(c, [.1, .2, .17], smooth(.5, -.4, p[1]) * .8);           // 물에 젖은 아랫부분
    if (n[1] > .55 && p[1] > .6) c = cmix(c, [.24, .36, .16], smooth(.55, .9, n[1]) * .65);   // 이끼
    return c;
  };
}
/* 테트라포드 하나 (다리 4개) */
function gTetra(g, c, rot, sc, colFn) {
  const dirs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], M = M4.trs([0, 0, 0], rot);
  for (const d of dirs) { const v = V3.norm(d), e = M4.pt(M, v); gCyl(g, c, [c[0] + e[0] * sc, c[1] + e[1] * sc, c[2] + e[2] * sc], sc * .36, sc * .22, colFn, 6, true); }
  gSphere(g, c, sc * .38, [.62, .6, .57], colFn, 6, 5);
}
function concrete(seed) {
  const R = rnd(seed);
  return (p, n) => {
    const v = .8 + noise3(p[0] * 5, p[1] * 5, p[2] * 5) * .3; let c = [.64 * v, .62 * v, .58 * v];
    if (p[1] < .9) c = cmix(c, [.26, .34, .3], smooth(.9, -.3, p[1]) * .85);
    if (p[1] > .05 && p[1] < .9 && noise3(p[0] * 14, p[1] * 14, p[2] * 14) > .72) c = cmix(c, [.86, .86, .8], .6);
    return c;
  };
}
function buildSpot(si) {
  const sp = SPOTS[si], out = [], Y = sp.stand, g = Geo();
  if (sp.type === 'tetra') {
    const cc = concrete(si * 7 + 3), R = rnd(si * 131 + 17), W = 3.7;
    // 방파제 상판(육지 쪽) + 난간벽
    gBox(g, [0, Y - .55, -4.6], [7.6, 1.1, 6.8], cmix([.55, .54, .52], [.5, .5, .48], .5));
    gBox(g, [0, Y + .3, -7.9], [7.6, .6, .4], [.5, .5, .48]);
    gBox(g, [0, Y - .02, -1.4], [7.6, .06, .2], [.78, .76, .5]);               // 노란 가장자리 선
    // 바닥에 닿을 때까지 쌓인 테트라포드 + 빈틈 메우는 돌무더기
    const slope = .42, y0 = Y - .75;
    gBlob(g, [0, Y - 3.4, 2.2], [W + .2, 2.0, 3.8], si * 5 + 1, () => [.22, .24, .22], 14, 9);
    for (let layer = 0; layer < 2; layer++) for (let z = -1.2 + layer * .5; z < 13; z += 1.1) for (let x = -W + (layer ? .6 : 0) + (Math.floor((z + 1.2) / 1.1) % 2) * .6; x <= W; x += 1.25) {
      const y = y0 - (z + 1.2) * slope - layer * .55 + (R() - .5) * .25, bed = bedY(z, sp.depth, si);
      if (y < bed + .3) continue;
      gTetra(g, [x + (R() - .5) * .3, y, z + (R() - .5) * .3], [R() * 6.28, R() * 6.28, R() * 6.28], .98 + R() * .2, cc);
    }
    // 낚시꾼이 서 있는 테트라포드 윗면
    gTetra(g, [-.35, Y - .55, -.15], [.3, .7, .2], 1.0, cc); gTetra(g, [.4, Y - .6, .3], [1, .2, .5], 1.0, cc);
    gBox(g, [0, Y - .13, .05], [.95, .26, 1.1], [.6, .58, .55]);
    out.push({ geo: g, opts: { spec: .03 } });
    const prop = Geo();                                             // 양동이, 쿨러, 가로등
    gCyl(prop, [-1.0, Y, -2.0], [-1.0, Y + .32, -2.0], .17, .2, [.16, .38, .62], 14, true); gCyl(prop, [-1.0, Y + .3, -2.0], [-1.0, Y + .33, -2.0], .19, .2, [.1, .26, .45], 14, true);
    gBox(prop, [-1.5, Y + .24, -3.1], [.82, .42, .5], [.78, .8, .82]); gBox(prop, [-1.5, Y + .47, -3.1], [.86, .08, .54], [.2, .42, .66]);
    gCyl(prop, [-3.4, Y, -4.2], [-3.4, Y + 2.6, -4.2], .05, .04, [.2, .2, .22], 8, true); gBox(prop, [-3.4, Y + 2.7, -4.2], [.26, .2, .26], [1, .9, .6]);
    gCyl(prop, [1.9, Y, -1.8], [1.9, Y + .28, -1.8], .09, .08, [.2, .22, .24], 10, true); gSphere(prop, [1.9, Y + .3, -1.8], .1, [.22, .24, .27]);
    if (sp.tier !== 'small') { gBox(prop, [3.0, Y + .3, -2.6], [.5, .6, .5], [.85, .45, .15]); gCyl(prop, [3.4, Y, -6.5], [3.4, Y + 3.2, -6.5], .06, .05, [.2, .2, .22], 8, true); gBox(prop, [3.4, Y + 3.3, -6.5], [.3, .22, .3], [1, .9, .6]); }
    out.push({ geo: prop, opts: { spec: .15 } });
    out.push({ lamp: [-3.4, Y + 2.7, -4.2] });
  } else {
    const cf = rockCol(si * 31 + 5), k = 1 + ((si * 13) % 7) / 25;
    if (sp.type === 'rock') {
      gBlob(g, [0, Y - 1.5, -.3], [3.4 * k, 1.55, 3.6], 11 + si, cf); gBlob(g, [-1.6, Y - 1.2, -2.2], [1.8, 1.1, 1.8], 23 + si, cf); gBlob(g, [1.8, Y - 1.5, -1.6], [1.6, 1.2, 1.6], 37 + si, cf);
      gBlob(g, [.7, Y - 1.2, 2.3], [1.6, .9, 1.1], 41 + si, cf); gBlob(g, [-1.4, Y - .55, 1.1], [.9, .55, .8], 53 + si, cf); gBlob(g, [-.9, Y - .2, -1.2], [.6, .3, .5], 67 + si, cf);
      gBlob(g, [2.0, Y - .3, 0], [.8, .5, .7], 77 + si, cf);
    } else {
      gBlob(g, [0, Y - 2.4, -.2], [2.6 * k, 2.4, 2.6], 71 + si, cf); gBlob(g, [1.3, Y - 1.8, 1.2], [1.4, 1.5, 1.2], 83 + si, cf); gBlob(g, [-1.4, Y - 1.6, -1.4], [1.3, 1.4, 1.3], 97 + si, cf);
      gBlob(g, [0, Y - 1.7, 2.7], [1.5, 1.1, 1.0], 101 + si, cf); gBlob(g, [-1.1, Y - .6, .9], [.7, .5, .6], 113 + si, cf); gBlob(g, [1.9, Y - 1.0, -.4], [.9, .9, .8], 127 + si, cf);
    }
    out.push({ geo: g, opts: { spec: .06 } });
    const prop = Geo(); gCyl(prop, [-.95, Y - .05, .5], [-.95, Y + .3, .5], .17, .2, [.16, .38, .62], 14, true); gBox(prop, [-1.2, Y + .18, -.5], [.8, .38, .5], [.78, .8, .82]); gBox(prop, [-1.2, Y + .4, -.5], [.84, .08, .54], [.2, .42, .66]);
    out.push({ geo: prop, opts: { spec: .15 } });
  }
  return out;
}
function ensureSpot(si) {
  if (MODELS.spotIdx === si) return;
  for (const s of MODELS.spot) meshFree(s.mesh); MODELS.spot = []; MODELS.lamp = null;
  for (const part of buildSpot(si)) { if (part.lamp) { MODELS.lamp = part.lamp; continue; } MODELS.spot.push({ mesh: mkMesh(part.geo, false), opts: part.opts }); }
  MODELS.spotIdx = si;
}

/* ----- 낚시꾼 ----- */
let HATSTYLE = 'cap'; const ROD_C = { g: [.8, .2, .15], a: [.1, .12, .14], b: [.28, .3, .32] };
const SKIN = [.93, .72, .57], SHIRT = [.28, .42, .56], VEST = [.9, .42, .17], PANTS = [.17, .22, .3], BOOT = [.09, .1, .12], HAT = [.96, .78, .22], HAIR = [.2, .12, .09];
function buildAngler() {
  const A = {};
  const t = Geo();                                             // 몸통(조끼) — 엉덩이 기준 로컬 좌표
  gLathe(t, [[0, 0], [.14, .02], [.165, .12], [.18, .26], [.205, .42], [.215, .54], [.2, .62], [.12, .68], [.06, .71], [.055, .76]], 20, (p, n) => {
    return p[1] > .66 ? SKIN : cmix(VEST, [VEST[0] * .7, VEST[1] * .7, VEST[2] * .7], smooth(.2, .0, p[1]) * .6 + (n[2] < -.6 ? .12 : 0));
  }, M4.trs([0, 0, 0], [0, 0, 0], [1.1, 1, .78]));
  gBox(t, [-.09, .45, .155], [.1, .12, .06], [.76, .33, .12]); gBox(t, [.09, .45, .155], [.1, .12, .06], [.76, .33, .12]);   // 가슴 주머니
  gBox(t, [0, .32, .16], [.3, .1, .05], [.7, .3, .1]);
  gCyl(t, [0, .13, 0], [0, .19, 0], .19, .19, [.14, .1, .08], 20, false);                       // 벨트
  A.torso = mkMesh(t, false);
  const h = Geo();                                             // 머리: 목 위 기준
  gCyl(h, [0, -.1, 0], [0, .03, 0], .066, .058, SKIN, 12);                                   // 굵은 목
  gSphere(h, [0, .075, .075], [.128, .095, .115], SKIN, null, 16, 10);                          // 각진 턱
  gSphere(h, [0, .07, .088], [.122, .075, .1], [.46, .36, .32], null, 16, 8);                   // 수염 자국
  gSphere(h, [0, .17, 0], [.152, .165, .162], SKIN, null, 18, 12);
  gSphere(h, [-.15, .15, 0], [.022, .04, .03], SKIN); gSphere(h, [.15, .15, 0], [.022, .04, .03], SKIN);
  gSphere(h, [0, .14, .15], [.022, .026, .028], cmix(SKIN, [.8, .45, .38], .3));              // 코
  gSphere(h, [-.062, .185, .14], .021, [.97, .97, .97]); gSphere(h, [.062, .185, .14], .021, [.97, .97, .97]);
  gSphere(h, [-.062, .185, .157], .013, [.08, .06, .06]); gSphere(h, [.062, .185, .157], .013, [.08, .06, .06]);
  gSphere(h, [-.062, .222, .14], [.042, .013, .024], HAIR); gSphere(h, [.062, .222, .14], [.042, .013, .024], HAIR);   // 짙은 눈썹
  gSphere(h, [0, .095, .14], [.045, .012, .02], cmix(SKIN, [.7, .35, .32], .5));              // 입
  gSphere(h, [0, .19, -.03], [.162, .13, .165], HAIR, null, 16, 10);                              // 머리카락
  gLathe(h, [[.0, .0], [.158, .0], [.168, .04], [.16, .11], [.12, .17], [.05, .205], [0, .21]], 20, HAT, M4.trs([0, .24, 0], [0, 0, 0]));   // 모자 윗부분
  if (HATSTYLE === 'cap') gSphere(h, [0, .245, .185], [.15, .018, .16], HAT, null, 14, 6);                                // 챙
  else gSphere(h, [0, .245, 0], HATSTYLE === 'wide' ? [.36, .02, .36] : [.26, .02, .26], HAT, null, 20, 6);
  gCyl(h, [0, .245, -.02], [0, .26, -.02], .17, .17, [.2, .2, .22], 20);                           // 모자 밴드
  gSphere(h, [-.15, .12, .02], [.03, .06, .05], HAIR); gSphere(h, [.15, .12, .02], [.03, .06, .05], HAIR);   // 구레나룻
  gSphere(h, [0, .08, -.15], [.14, .1, .06], HAIR, null, 12, 8);                                  // 짧은 뒷머리
  A.head = mkMesh(h, false);
  const b = Geo();
  gLathe(b, [[0, .07], [.066, .07], [.07, .15], [.078, .26], [.096, .38], [.1, .4], [.09, .405], [0, .405]], 16, BOOT, null);          // 장화 목(위로 갈수록 넓어짐)
  gSphere(b, [0, .06, .075], [.072, .058, .16], BOOT, null, 14, 9);                                                                  // 발등 · 앞코
  gBox(b, [0, .014, .07], [.15, .028, .31], [.045, .045, .05]);                                                                       // 밑창
  gBox(b, [0, .014, -.04], [.14, .03, .09], [.04, .04, .045]);                                                                        // 뒷굽
  gCyl(b, [0, .385, 0], [0, .405, 0], .104, .104, [.16, .17, .19], 16);                                                                // 장화 윗단
  A.boot = mkMesh(b, false);
  const cy = Geo(); gLathe(cy, [[0, 0], [1, 0], [1, 1], [0, 1]], 14, [1, 1, 1], null); A.cyl = mkMesh(cy, false);
  const cn = Geo(); gLathe(cn, [[0, 0], [1, 0], [.7, 1], [0, 1]], 14, [1, 1, 1], null); A.cone = mkMesh(cn, false);   // 끝으로 갈수록 가는 팔다리
  const sp = Geo(); gSphere(sp, [0, 0, 0], 1, [1, 1, 1], null, 14, 9); A.sph = mkMesh(sp, false);
  // 낚싯대: 동적 튜브
  A.rodN = 20; A.rodG = tubeGeo(A.rodN, 7); A.rod = mkMesh(A.rodG, true);
  const rl = Geo(); gLathe(rl, [[0, -.04], [.055, -.04], [.06, -.02], [.06, .02], [.055, .04], [0, .04]], 14, [.78, .8, .82], M4.trs([0, 0, 0], [0, 0, Math.PI / 2]));
  gCyl(rl, [0, -.06, -.05], [0, -.14, -.05], .012, .012, [.2, .2, .22], 6); gSphere(rl, [0, -.15, -.05], .026, [.9, .3, .2]);
  A.reel = mkMesh(rl, false);
  const gp = Geo(); gCyl(gp, [0, 0, 0], [0, 1, 0], .03, .024, [.16, .2, .15], 10, true); A.grip = mkMesh(gp, false);
  return A;
}
function ik2(a, b, l1, l2, pole) {
  const d = V3.sub(b, a); let L = V3.len(d); const maxL = l1 + l2 - .001; if (L > maxL) { b = V3.add(a, V3.mul(d, maxL / L)); L = maxL; }
  const dn = V3.mul(d, 1 / (L || 1)), c = (l1 * l1 - l2 * l2 + L * L) / (2 * L || 1), hgt = Math.sqrt(Math.max(l1 * l1 - c * c, 0));
  let pv = V3.sub(pole, V3.mul(dn, V3.dot(pole, dn))); pv = V3.norm(pv);
  return { elbow: V3.add(V3.add(a, V3.mul(dn, c)), V3.mul(pv, hgt)), end: b };
}
const rotX = a => M4.trs([0, 0, 0], [a, 0, 0]);
const GLOVE = [.15, .16, .18];
function drawAngler(A, g, standY, dl) {
  const t = ENV.time || 0, bendA = (typeof A3 !== 'undefined' ? A3.bend : 0) || 0;
  const lean = g.lean, la = lean * .42, calm = clamp(1 - Math.abs(lean - .1) * 2.2, 0, 1);
  const breath = Math.sin(t * 1.5) * .5 + .5, sway = (Math.sin(t * .55) * .014 + Math.sin(t * 1.3 + 1) * .004) * calm;
  const tw = (g.twist || 0) + Math.sin(t * .31) * .035 * calm;
  const hip = [sway, standY + .95 - .004 * breath - .05 * clamp(bendA, 0, 1), -.04 + .1 * lean];
  const T0 = M4.mul(M4.trs(hip, [0, tw, 0]), rotX(la));
  const T = M4.mul(T0, M4.trs([0, 0, 0], [0, 0, 0], [1 + .006 * breath, 1 + .01 * breath, 1 + .006 * breath]));
  const draw = (m, M, col, o) => drawMesh(m, M, Object.assign({ tint: col }, o));
  const unit = (a, b, r, col, o) => draw(A.cyl, M4.seg(a, b, r), col, o), cone = (a, b, r, col, o) => draw(A.cone, M4.seg(a, b, r), col, o), ball = (p, r, col, o) => draw(A.sph, M4.trs(p, [0, 0, 0], [r, r, r]), col, o);
  /* 다리: 발을 어깨너비로 모으고 살짝 바깥쪽으로 */
  for (const sx of [-1, 1]) {
    const foot = [sx * .125, standY, sx > 0 ? .09 + .04 * lean : -.06], hj = [sx * .085 + sway * .6, hip[1] - .03, hip[2]];
    const k = ik2(hj, V3.add(foot, [0, .13, 0]), .45, .44, [sx * .12, 0, 1]);
    cone(hj, k.elbow, .106, PANTS, { spec: .04 }); cone(k.elbow, k.end, .086, PANTS, { spec: .04 }); ball(k.elbow, .078, PANTS);
    drawMesh(A.boot, M4.trs([foot[0], foot[1], foot[2]], [0, sx * .2, 0]), { tint: [1, 1, 1], spec: .35, rim: .1 });
  }
  ball([sway * .6, hip[1] - .02, hip[2]], .13, PANTS, { spec: .04 });
  /* 몸통 · 머리 */
  drawMesh(A.torso, T, { tint: [1, 1, 1], spec: .08, rim: .15 });
  const neck = M4.pt(T, [0, .74, 0]);
  const glance = Math.sin(t * .23) * Math.sin(t * .37 + 2) * .3 * calm, nod = (Math.sin(t * .5) * .03 + Math.sin(t * .17) * .04) * calm;
  drawMesh(A.head, M4.mul(M4.trs(neck, [0, tw * .5 + glance, 0]), rotX(la * .3 + (g.headPitch || 0) + nod)), { tint: [1, 1, 1], spec: .1, rim: .12 });
  /* 팔 */
  for (const [sx, hand] of [[-1, g.hf], [1, g.hr]]) {
    const sh = M4.pt(T, [sx * .245, .65, 0]), e = ik2(sh, hand, .28, .27, [sx * .6, -1, -.25]);
    cone(sh, e.elbow, .07, SHIRT, { rim: .1 }); cone(e.elbow, e.end, .06, SHIRT, { rim: .1 }); ball(e.elbow, .056, SHIRT); ball(sh, .074, VEST);
    ball(e.end, .05, GLOVE, { spec: .2 }); ball(V3.add(e.end, [sx * .02, -.02, .035]), .022, GLOVE, { spec: .2 });
  }
}
function rodFill(A, g) {
  const n = A.rodN, pts = []; for (let i = 0; i < n; i++) { const u = i / (n - 1), a = 1 - u; pts.push([a * a * g.G0[0] + 2 * a * u * g.ctrl[0] + u * u * g.tip[0], a * a * g.G0[1] + 2 * a * u * g.ctrl[1] + u * u * g.tip[1], a * a * g.G0[2] + 2 * a * u * g.ctrl[2] + u * u * g.tip[2]]); }
  tubeFill(A.rod, pts, u => .021 - .0165 * Math.pow(u, .8), 7, u => u < .06 ? ROD_C.g : cmix(ROD_C.a, ROD_C.b, u));
  return pts;
}

/* ----- 찌 ----- */
function buildFloat() {
  const g = Geo();
  gLathe(g, [[0, -.17], [.05, -.15], [.085, -.09], [.095, -.02], [.085, .05], [.055, .11], [.025, .15], [.014, .17]], 16, (p) => p[1] < -.03 ? [.95, .28, .12] : p[1] < .03 ? [.97, .97, .96] : [.96, .35, .13]);
  gLathe(g, [[.014, .165], [.012, .2], [.012, .5], [.006, .55]], 8, (p) => p[1] > .38 ? [.9, 1, .2] : p[1] > .3 ? [.95, .25, .15] : [.95, .95, .9]);
  return mkMesh(g, false);
}
function buildFloats() {
  const mk = (prof, stick) => { const g = Geo(); gLathe(g, prof, 14, p => p[1] < -.02 ? [.95, .3, .12] : [.97, .97, .96]); gLathe(g, stick, 8, p => (Math.floor(p[1] * 9) % 2 ? [.95, .25, .15] : [.98, .95, .6])); return mkMesh(g, false); };
  return {
    hole: buildFloat(),
    self: mk([[0, -.2], [.04, -.18], [.062, -.08], [.062, .1], [.045, .22], [.02, .3], [.012, .32]], [[.012, .31], [.011, .35], [.011, .95], [.006, 1.0]]),
    non: mk([[0, -.34], [.022, -.32], [.03, -.22], [.03, .08], [.02, .2], [.011, .26]], [[.011, .25], [.01, .3], [.01, .85], [.005, .9]])
  };
}
function buildHook() { const g = Geo(); gSphere(g, [0, 0, 0], .06, [1, 1, 1], null, 10, 7); return mkMesh(g, false); }

/* ----- 물고기 ----- */
const FSTYLE = {
  hak: { back: '#3d6f94', side: '#c9d9e0', belly: '#f2f6f6', fin: '#a9c2cf' }, aji: { back: '#3f6a86', side: '#a8bcc6', belly: '#eef1f0', fin: '#b79a4d', tail: '#d5b24a' },
  mang: { back: '#4a4630', side: '#8b7a50', belly: '#c9b98d', fin: '#6b5d3a' }, nore: { back: '#4b3d28', side: '#7a6a45', belly: '#b8a67a', fin: '#5f5035', spots: '#2f2616' },
  jwi: { back: '#6b6a5c', side: '#a2a08c', belly: '#d2cfb8', fin: '#7d7b68', spots: '#4d4c40' }, bol: { back: '#6a2a1c', side: '#a8573b', belly: '#d89a78', fin: '#7a3320' },
  ureok: { back: '#2c2a22', side: '#5d5a4c', belly: '#9d9884', fin: '#3a382e', spots: '#1d1c17' }, beng: { back: '#2d3a34', side: '#5b6459', belly: '#9aa296', fin: '#3a4540' },
  gam: { back: '#4f5964', side: '#9aa6b0', belly: '#e6ebee', fin: '#5a6670', band: '#222a30' }, nong: { back: '#4a5a60', side: '#aebfc4', belly: '#f0f3f3', fin: '#6b7a80', spots: '#38464a' },
  cham: { back: '#c4635f', side: '#e58a86', belly: '#f6d3cf', fin: '#d4726e', spots: '#5db0d8' }, dol: { back: '#161a1c', side: '#c9d3d6', belly: '#e9eeef', fin: '#2a3033', stripes: true },
  bok: { back: '#7a7656', side: '#b9b59a', belly: '#eee6c8', fin: '#8a8566', spots: '#4a4a36' },
  mi: { back: '#4a2f22', side: '#8a5a3c', belly: '#cfa27a', fin: '#6a4028', spots: '#2f1c12' }, dok: { back: '#5f6a3a', side: '#a3a864', belly: '#e0dcaa', fin: '#c9b24a', spots: '#6b6f3f' },
  hwang: { back: '#5a5a3c', side: '#a8a37a', belly: '#e6dfb8', fin: '#d9683a', band: '#d9683a' }, godeung: { back: '#1f5a66', side: '#8fb4bb', belly: '#eef3f1', fin: '#3f7f8a', spots: '#163d44' },
  nol: { back: '#3f6a3a', side: '#7a9f5a', belly: '#d6dca6', fin: '#d98a3a', spots: '#2f4f2a' }, jwinore: { back: '#3f3220', side: '#6b5230', belly: '#b09a70', fin: '#4a3a24', spots: '#2a2014' },
  sung: { back: '#52605f', side: '#aeb9ba', belly: '#f1f3f1', fin: '#6f7b7c' }, bori: { back: '#8f845c', side: '#d6c9a5', belly: '#f4efe0', fin: '#b5a97f' },
  yeol: { back: '#8a2a20', side: '#c24a3a', belly: '#eaa58a', fin: '#9a3326' }, gal: { back: '#8fa0a6', side: '#d4dde0', belly: '#f1f5f6', fin: '#aebcc2' },
  sam: { back: '#4f6672', side: '#8fa0aa', belly: '#e8eef0', fin: '#5f7480', spots: '#3a4c56' }, jeon: { back: '#4d6a74', side: '#9db5bd', belly: '#f1f5f5', fin: '#7f9aa4', spots: '#35505a' },
  seong: { back: '#8a3a28', side: '#c96a4a', belly: '#ecc2a4', fin: '#3f8f6a', spots: '#6a2a1c' }
};
function fishEnv(s) { return Math.pow(Math.sin(Math.PI * Math.pow(clamp(s, 0, 1), .72)), .72); }
function buildFishGeo(f) {
  const st = FSTYLE[f.id] || FSTYLE.aji, back = hex(st.back), side = hex(st.side), belly = hex(st.belly), finC = hex(st.fin), tailC = st.tail ? hex(st.tail) : finC, spotC = st.spots ? hex(st.spots) : null;
  const NS = 40, M = 16, HH = f.h * .5, g = Geo(), S = [], R = rnd(f.id.charCodeAt(0) * 17);
  const zOf = s => .5 - s, push = (p, n, c, s) => { const i = gv(g, p, n, c); S[i] = s; return i; };
  const sMax = .95;
  for (let j = 0; j <= NS; j++) {
    const s = j / NS * sMax, e = fishEnv(s), hh = Math.max(e * HH, .002), ww = hh * (f.id === 'bok' ? .95 : .6);
    for (let k = 0; k <= M; k++) {
      const a = k / M * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), y = hh * sa * (sa < 0 ? .85 : 1) + hh * .05;
      let c = sa > .35 ? cmix(side, back, smooth(.35, .8, sa)) : sa < -.25 ? cmix(side, belly, smooth(-.25, -.65, sa)) : side;
      if (st.stripes) { const bandv = Math.sin(s * 34 + .6); if (bandv > .25 && s > .14 && s < .88) c = cmix(c, [.1, .12, .13], smooth(.25, .6, bandv) * .92); }
      if (st.band && s > .12 && s < .24) c = cmix(c, hex(st.band), .55);
      if (spotC && noise3(s * 40, ca * 5, sa * 5) > .8 && sa > -.2) c = cmix(c, spotC, .6);
      if (f.id === 'cham' && noise3(s * 55, ca * 7, 1) > .9) c = cmix(c, spotC, .8);
      if (s < .06) c = cmix(c, side, .0);
      const nrm = V3.norm([ca / Math.max(ww, .004), sa / Math.max(hh, .004), 0]);
      push([ww * ca, y, zOf(s)], nrm, c, s);
    }
  }
  for (let j = 0; j < NS; j++) for (let k = 0; k < M; k++) { const a = j * (M + 1) + k, b = a + 1, c = a + M + 1, d = c + 1; g.i.push(a, c, b, b, c, d); }
  const fin = (pts, col) => {                                      // 팬 모양 지느러미
    const idx = pts.map(p => push(p, [1, 0, 0], col, .5 - p[2])); for (let q = 1; q < idx.length - 1; q++) g.i.push(idx[0], idx[q], idx[q + 1]);
  };
  const hbT = Math.max(fishEnv(.9) * HH, .004), tH = Math.max(HH * 2.1, .09), z0 = zOf(.92);
  fin([[0, hbT, z0], [0, tH, z0 - .1], [0, 0, z0 - .045], [0, -tH, z0 - .1], [0, -hbT, z0]], tailC);
  const dz = s => zOf(s);
  fin([[0, fishEnv(.26) * HH, dz(.26)], [0, fishEnv(.3) * HH + HH * .55, dz(.3)], [0, fishEnv(.45) * HH + HH * .65, dz(.45)], [0, fishEnv(.6) * HH + HH * .3, dz(.6)], [0, fishEnv(.64) * HH * .98, dz(.64)]], finC);
  fin([[0, -fishEnv(.62) * HH * .8, dz(.62)], [0, -fishEnv(.7) * HH * .8 - HH * .4, dz(.7)], [0, -fishEnv(.8) * HH * .8, dz(.8)]], finC);
  for (const sx of [-1, 1]) { const wx = fishEnv(.26) * HH * .6 * sx; fin([[wx, -HH * .25, dz(.25)], [wx + sx * .05, -HH * .5, dz(.31)], [wx, -HH * .1, dz(.32)]], finC); }
  const eyeS = .075, ee = fishEnv(eyeS) * HH, er = Math.max(.012, HH * .13);
  for (const sx of [-1, 1]) { const ex = ee * .6 * sx, ey = ee * .25 + HH * .05;
    const gi = Geo(); gSphere(gi, [ex * 1.05, ey, zOf(eyeS)], er, [.96, .96, .92], null, 8, 6); gSphere(gi, [ex * 1.12, ey, zOf(eyeS) + er * .3], er * .6, [.04, .04, .05], null, 8, 6); const off = g.p.length / 3;
    for (let q = 0; q < gi.p.length; q += 3) { const i = gv(g, [gi.p[q], gi.p[q + 1], gi.p[q + 2]], [gi.n[q], gi.n[q + 1], gi.n[q + 2]], [gi.c[q], gi.c[q + 1], gi.c[q + 2]]); S[i] = eyeS; }
    for (const ix of gi.i) g.i.push(off + ix); }
  g.S = S; return g;
}
function fishNew(f) {
  const g = buildFishGeo(f), m = mkMesh(g, true);
  return { f, mesh: m, base: Float32Array.from(m.data), S: Float32Array.from(g.S), L: 1 };
}
function fishPose(fi, t, amp, freq, ph, bend) {
  const m = fi.mesh, d = m.data, b = fi.base, S = fi.S, n = m.nv;
  for (let i = 0; i < n; i++) {
    const s = S[i], w = Math.pow(s, 1.5) * (Math.sin((s * 3.2 - t * freq) * 2 + ph)) * amp + (bend || 0) * s * s;
    d[i * 9] = b[i * 9] + w; d[i * 9 + 1] = b[i * 9 + 1]; d[i * 9 + 2] = b[i * 9 + 2];
  }
  meshUpload(m);
}

/* ----- 수중 단면 (유리 · 뒷벽 · 해저 · 해초) ----- */
const DIO = { glass: null, wall: null, bed: null, skirt: null, kelp: [], rocks: null, spotIdx: -1, depth: 6, maxD: 14 };
function bedY(z, depthMax, si) {
  const slope = smooth(-1.5, 11 + si * 2, z), base = -(.9 + (depthMax - .9) * slope);
  const bump = Math.sin(z * .7 + si) * .18 + Math.sin(z * 1.9) * .08 + (si > 0 ? Math.sin(z * 1.3 + 2) * .3 * slope : 0);
  return base + bump;
}
function buildDiorama(si, depthMax) {
  const D = DIO; for (const k of ['glass', 'bed', 'skirt', 'rocks']) { if (D[k]) meshFree(D[k]); D[k] = null; } for (const k of D.kelp) meshFree(k.mesh); D.kelp = [];
  D.depth = depthMax;
  const gg = Geo(), ZN = 160, z0 = -9, z1 = 52;                      // 유리: 위 가장자리는 파도를 따라감
  for (let i = 0; i <= ZN; i++) { const z = z0 + (z1 - z0) * i / ZN; gv(gg, [-3.97, 0, z], [-1, 0, 0], [1, 0, 0]); gv(gg, [-3.97, -22, z], [-1, 0, 0], [0, 0, 0]); }
  for (let i = 0; i < ZN; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; gg.i.push(a, b, c, c, b, d); }
  D.glass = mkMesh(gg, false);
  const R = rnd(si * 13 + 3), sandCol = (y, depth) => { const dd = clamp(-y / 14, 0, 1), v = .9; return cmix([.78 * v, .7 * v, .5 * v], [.34 * v, .36 * v, .36 * v], dd * .85); };
  const bg = Geo(), NX = 6, NZ = 110;
  for (let ix = 0; ix <= NX; ix++) for (let iz = 0; iz <= NZ; iz++) {
    const x = -4 + 8 * ix / NX, z = z0 + (z1 - z0) * iz / NZ, y = bedY(z, depthMax, si) + Math.sin(x * 1.3 + z * .5) * .12;
    gv(bg, [x, y, z], [0, 1, 0], sandCol(y)); }
  for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NZ; iz++) { const a = ix * (NZ + 1) + iz, b = a + 1, c = a + NZ + 1, d = c + 1; bg.i.push(a, b, c, b, d, c); }
  for (let k = 0; k < bg.p.length; k += 3) { const iz = (k / 3) % (NZ + 1), ix = Math.floor(k / 3 / (NZ + 1)); const zp = Math.min(NZ, iz + 1), zm = Math.max(0, iz - 1), xp = Math.min(NX, ix + 1), xm = Math.max(0, ix - 1);
    const pz = bg.p[(ix * (NZ + 1) + zp) * 3 + 1] - bg.p[(ix * (NZ + 1) + zm) * 3 + 1], px = bg.p[(xp * (NZ + 1) + iz) * 3 + 1] - bg.p[(xm * (NZ + 1) + iz) * 3 + 1];
    const n = V3.norm([-px / 3, 1, -pz / ((z1 - z0) * (zp - zm) / NZ)]); bg.n[k] = n[0]; bg.n[k + 1] = n[1]; bg.n[k + 2] = n[2]; }
  D.bed = mkMesh(bg, false);
  const sk = Geo(), bottom = -(depthMax + 5);                         // 단면 앞면(퇴적층)
  for (let iz = 0; iz <= NZ; iz++) { const z = z0 + (z1 - z0) * iz / NZ, y = bedY(z, depthMax, si) + Math.sin(-4 * 1.3 + z * .5) * .12; gv(sk, [-4, y, z], [-1, 0, 0], sandCol(y)); gv(sk, [-4, y - 1.1, z], [-1, 0, 0], [.55, .42, .28]); gv(sk, [-4, y - 2.6, z], [-1, 0, 0], [.32, .24, .17]); gv(sk, [-4, bottom, z], [-1, 0, 0], [.16, .12, .09]); }
  for (let iz = 0; iz < NZ; iz++) for (let r = 0; r < 3; r++) { const a = iz * 4 + r, b = a + 1, c = a + 4, d = c + 1; sk.i.push(a, b, c, b, d, c); }
  D.skirt = mkMesh(sk, false);
  const rg = Geo(), rr = rnd(si * 7 + 1), cf = (p, n) => { const v = .7 + noise3(p[0] * 4, p[1] * 4, p[2] * 4) * .4; return cmix([.3 * v, .32 * v, .33 * v], [.12, .3, .2], smooth(.4, .9, n[1]) * .5 * (rr() > .5 ? 1 : .5)); };
  for (let i = 0; i < 16; i++) { const z = z0 + 2 + rr() * (z1 - z0 - 4), x = (rr() - .5) * 5.5, r = .35 + rr() * .9; gBlob(rg, [x, bedY(z, depthMax, si) + r * .15, z], [r * 1.2, r * .75, r], i * 19 + si, cf, 14, 9); }
  D.rocks = mkMesh(rg, false);
  const kr = rnd(si * 5 + 9);
  for (let i = 0; i < 26; i++) {                                         // 해초
    const z = z0 + 3 + kr() * (z1 - z0 - 6), x = (kr() - .5) * 6, h = 1.1 + kr() * 2.2, g = Geo();
    for (let b = 0; b < 4; b++) { const a = b * 1.57 + kr(), w = .07 + kr() * .05, segs = 7;
      for (let j = 0; j <= segs; j++) { const u = j / segs, y = u * h, off = Math.sin(u * 2 + b) * .06 * u, col = cmix([.12, .32, .18], [.45, .62, .25], u * u);
        gv(g, [Math.cos(a) * (off - w * (1 - u * .7)), y, Math.sin(a) * (off - w * (1 - u * .7))], [0, 0, 1], col); gv(g, [Math.cos(a) * (off + w * (1 - u * .7)), y, Math.sin(a) * (off + w * (1 - u * .7))], [0, 0, 1], col); }
      const base = g.p.length / 3 - (segs + 1) * 2; for (let j = 0; j < segs; j++) { const q = base + j * 2; g.i.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
    D.kelp.push({ mesh: mkMesh(g, false), pos: [x, bedY(z, depthMax, si), z], h, phase: kr() * 6 });
  }
  D.spotIdx = si;
  if (!D.wallVao) {
    const v = gl.createVertexArray(); gl.bindVertexArray(v); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([4, -30, -10, 4, -30, 60, 4, 0, 60, 4, -30, -10, 4, 0, 60, 4, 0, -10]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null); D.wallVao = v;
  }
}

/* ----- 장비(옷·모자·신발·조끼·낚싯대) 적용 ----- */
function setC(dst, c) { dst[0] = c[0]; dst[1] = c[1]; dst[2] = c[2]; }
function outfitKey() { const e = G.equip; return [e.rod, e.hat, e.top, e.vest, e.boots].join('|'); }
function applyOutfit() {
  const e = G.equip, hat = itemById(e.hat), top = itemById(e.top), vest = itemById(e.vest), boots = itemById(e.boots), rod = itemById(e.rod);
  setC(HAT, hat.c); HATSTYLE = hat.style; setC(SHIRT, top.c); setC(PANTS, top.p); setC(VEST, vest.c); setC(BOOT, boots.c);
  ROD_C.g = rod.cg; ROD_C.a = rod.ca; ROD_C.b = rod.cb;
  if (SC.A) for (const k in SC.A) { const m = SC.A[k]; if (m && m.vao) meshFree(m); }
  SC.A = buildAngler(); SC.outKey = outfitKey();
}

'use strict';
/* ================= 게임 데이터 =================
   Claude가 알고 있는 일반 지식으로 잡은 근사치입니다. 실제 조황과 다를 수 있으니 값은 자유롭게 고쳐 쓰세요.
   depth  : 잘 무는 수심(m) [최소, 최대]
   baits  : 미끼별 선호도 (0이면 안 묾)
   time   : 시간대별 활성도 (dawn 04~07, day 07~17, dusk 17~20, night 20~04)
   peak   : 제철 달(월)
   size   : 크기 범위(cm)    k: 무게 계수 (kg = k * (cm/100)^3)    price: 1kg당 원
   power  : 저항 세기 0~1    bite: 입질 유형    chum: 밑밥 반응 배수    base: 기본 개체 밀도 */

const BAITS = [
  { id: 'krill',  name: '크릴',       price: 300, note: '만능 미끼. 밑밥과 함께 쓰면 좋아요' },
  { id: 'worm',   name: '청갯지렁이', price: 500, note: '바닥권과 야간에 강해요' },
  { id: 'mussel', name: '홍합살',     price: 400, note: '감성돔·돌돔이 좋아해요' },
  { id: 'crab',   name: '소형 게',    price: 800, note: '돌돔·대물 노릴 때' }
];

/* 포인트: 레벨(lv)이 오르면 더 크고 유명한 포인트로 갈 수 있어요 */
const TIERS = {
  small: { label: '소형 방파제', type: 'tetra', stand: 1.9, depth: [5, 7], flow: [.5, .7], zone: .28, exp: 2.4, base: { hak: 1.5, aji: 1.5, mang: 1.5, nore: 1.2, jwi: 1, bol: 1.6, ureok: 1, beng: .3, gam: .5, nong: .5, cham: .05, dol: 0, bok: 1 } },
  mid:   { label: '중형 방파제', type: 'tetra', stand: 2.5, depth: [8, 9], flow: [.8, .9], zone: .24, exp: 2.1, base: { hak: 1.2, aji: 1.4, mang: 1.2, nore: 1.1, jwi: 1.1, bol: 1.4, ureok: 1.1, beng: .8, gam: 1, nong: .8, cham: .3, dol: .2, bok: 1 } },
  rock:  { label: '도보 갯바위', type: 'rock', stand: 1.35, depth: [9, 11], flow: [1, 1.1], zone: .2, exp: 1.9, base: { hak: .8, aji: 1, mang: .8, nore: .8, jwi: 1.2, bol: 1.2, ureok: 1.2, beng: 1.6, gam: 1.5, nong: 1, cham: .8, dol: .7, bok: 1 } },
  big:   { label: '대형 방파제', type: 'tetra', stand: 3.2, depth: [11, 12], flow: [1.1, 1.2], zone: .18, exp: 1.7, base: { hak: .6, aji: 1.1, mang: .6, nore: .7, jwi: 1.1, bol: 1.1, ureok: 1.2, beng: 1.4, gam: 1.4, nong: 1.2, cham: 1, dol: .8, bok: .9 } },
  yeo:   { label: '간출여 · 명소', type: 'yeo', stand: 2.0, depth: [13, 16], flow: [1.3, 1.5], zone: .15, exp: 1.5, base: { hak: .3, aji: .8, mang: .3, nore: .5, jwi: 1, bol: 1, ureok: 1.4, beng: 1.3, gam: 1.4, nong: 1.3, cham: 1.8, dol: 1.5, bok: 1 } }
};
const REGION = {
  '동해': { beng: 1.3, gam: .4, cham: .5, dol: 1.2, hak: 1.2 }, '서해': { nong: 1.3, hak: .5, gam: .5, dol: 0, cham: .6 },
  '남해': { gam: 1.3, bol: 1.2, cham: 1.1 }, '제주': { gam: 1.3, dol: 1.5, cham: 1.3, mang: .7 }
};
const SPOT_DEFS = [
  ['sacheon', '강릉 사천항 방파제', '동해', 'small', 1, '입문용 작은 방파제. 잔챙이가 잘 붙어요'],
  ['sinjin', '태안 신진도 방파제', '서해', 'small', 1, '조용한 서해 소형 방파제'],
  ['guryongpo', '포항 구룡포 방파제', '동해', 'small', 3, '볼락과 전갱이가 모여요'],
  ['samdeok', '통영 삼덕항 방파제', '남해', 'small', 5, '남해 소형 방파제. 입질이 잦아요'],
  ['daepo', '거제 대포항 방파제', '남해', 'mid', 8, '중형 방파제. 중층 떼고기가 좋아요'],
  ['imwon', '삼척 임원항 방파제', '동해', 'mid', 10, '수심이 나와 벵에돔이 가끔 보여요'],
  ['ando', '여수 안도 방파제', '남해', 'mid', 12, '조류가 살아 감성돔 기회가 있어요'],
  ['hupo', '울진 후포 도보 갯바위', '동해', 'rock', 14, '걸어 들어가는 갯바위. 조류가 살아 있어요'],
  ['mijo', '남해 미조 도보 갯바위', '남해', 'rock', 16, '감성돔 낚시 명소로 알려진 갯바위'],
  ['seogwipo', '제주 서귀포 도보 갯바위', '제주', 'rock', 18, '제주의 맑은 물. 벵에돔과 돌돔을 노려요'],
  ['gadeok', '부산 가덕도 대형 방파제', '남해', 'big', 21, '큰 방파제. 대물 감성돔·농어가 나와요'],
  ['yeongil', '포항 영일만 대형 방파제', '동해', 'big', 24, '거센 조류. 대형 어종이 노려요'],
  ['geomun', '거문도 간출여', '남해', 'yeo', 27, '물이 빠지면 드러나는 여. 대물 포인트'],
  ['chuja', '추자도 간출여', '제주', 'yeo', 30, '전국구 명소. 감성돔·돌돔 대물이 나와요'],
  ['hongdo', '홍도 간출여', '서해', 'yeo', 34, '최고 난도의 명소. 참돔 대물이 노려요'],
  ['jukbyeon', '울진 죽변항 방파제', '동해', 'small', 2, '울진 방파제. 감성돔·벵에돔을 노리면 미역치·황어·고등어 같은 잡어가 함께 올라와요'],
  ['anheung', '태안 안흥항 방파제', '서해', 'small', 2, '서해 항구. 숭어·전어·보리멸이 자주 올라와요'],
  ['jangho', '삼척 장호항 방파제', '동해', 'small', 4, '불볼락과 황어가 잘 붙는 동해 작은 항구'],
  ['mukho', '동해 묵호항 방파제', '동해', 'mid', 7, '고등어·삼치 떼가 들어오고 쥐노래미도 나와요'],
  ['hanlim', '제주 한림항 방파제', '제주', 'mid', 9, '제주 방파제. 독가시치·용치놀래기가 잔뜩 붙어요'],
  ['bieung', '군산 비응항 방파제', '서해', 'mid', 11, '전어·숭어·성대가 올라오는 서해 중형 방파제'],
  ['homigot', '포항 호미곶 도보 갯바위', '동해', 'rock', 15, '동해 끝자락 갯바위. 벵에돔·돌돔과 불볼락이 나와요'],
  ['taejong', '부산 태종대 도보 갯바위', '남해', 'rock', 17, '갈치·독가시치가 많고 감성돔도 기대할 수 있어요'],
  ['cheongsan', '완도 청산도 도보 갯바위', '남해', 'rock', 19, '맑은 남해 갯바위. 감성돔과 용치놀래기가 올라와요'],
  ['seongsan', '제주 성산 도보 갯바위', '제주', 'rock', 20, '돌돔 명소. 독가시치와 삼치도 섞여요'],
  ['ganjeol', '울산 간절곶 대형 방파제', '동해', 'big', 22, '삼치와 고등어 떼가 몰리는 큰 방파제'],
  ['jisimdo', '거제 지심도 도보 갯바위', '남해', 'rock', 23, '감성돔 포인트. 쥐노래미와 성대도 올라와요'],
  ['ulleung', '울릉도 저동항 대형 방파제', '동해', 'big', 26, '먼 바다 항구. 불볼락·삼치·대형 어종이 노려요'],
  ['heuksan', '흑산도 간출여', '서해', 'yeo', 32, '서해 외딴 섬의 여. 우럭·농어 대물이 나와요']
];
/* 조수간만의 차로 생기는 수위 변화 (m, 한쪽 방향 최대치). 게임 시간이 빨라서 일부러 작게 잡았어요 */
const TIDE_AMP = { '서해': .6, '남해': .4, '제주': .25, '동해': .1 };

/* 포인트별 단골 어종 (곱셈 배수). 지역·포인트 크기와 별개로 그 포인트에서 특히 잘 올라오는 고기 */
const SPOT_LOC = {
  sacheon: { hwang: 1.5, mi: 1.3, godeung: 1.3 }, sinjin: { sung: 1.4, jeon: 1.3, bori: 1.4 }, guryongpo: { bol: 1.3, yeol: 1.3, godeung: 1.3 }, samdeok: { nol: 1.3, dok: 1.2, gal: 1.2 },
  daepo: { aji: 1.3, gal: 1.3, nol: 1.2 }, imwon: { beng: 1.3, mi: 1.3, jwinore: 1.2 }, ando: { dok: 1.3, jwinore: 1.2, gam: 1.2 }, hupo: { beng: 1.5, mi: 1.3, hwang: 1.2, yeol: 1.2 },
  mijo: { gam: 1.3, nol: 1.2 }, seogwipo: { dok: 1.5, dol: 1.2 }, gadeok: { gal: 1.3, sam: 1.2 }, yeongil: { godeung: 1.3, sam: 1.3 },
  jukbyeon: { gam: 6, beng: 5, mi: 1.5, hwang: 1.4, mang: 1.3, bol: 1.2, bok: 1.2, aji: 1.2, godeung: 1.5, ureok: 1.1 }, anheung: { sung: 1.4, jeon: 1.3, bori: 1.2, nong: 1.2 },
  jangho: { yeol: 1.5, bol: 1.4, hwang: 1.2 }, mukho: { godeung: 1.4, sam: 1.3, jwinore: 1.3 }, hanlim: { dok: 1.5, nol: 1.5, beng: 1.3, bok: 1.3 }, bieung: { jeon: 1.5, sung: 1.5, seong: 1.4 },
  homigot: { beng: 1.3, dol: 1.3, yeol: 1.3 }, taejong: { gal: 1.6, dok: 1.4, nol: 1.3, gam: 1.2 }, cheongsan: { gam: 1.4, nol: 1.4, dok: 1.3 }, seongsan: { dol: 1.4, dok: 1.5, sam: 1.3, cham: 1.2 },
  ganjeol: { sam: 1.5, godeung: 1.4, nong: 1.2 }, jisimdo: { gam: 1.5, jwinore: 1.2, seong: 1.2 }, ulleung: { cham: .8, dol: 1.3, yeol: 1.5, sam: 1.5 }, heuksan: { ureok: 1.5, nong: 1.4, bol: 1.2, sung: 1.2 }
};

/* 레벨: 누적 경험치 50 × (레벨-1)² */
const xpFor = L => 50 * (L - 1) * (L - 1);
const MAX_LV = 40, TEST_MAXLEVEL = false;   // 테스트용: true면 항상 만렙에서 시작 (정식 출시 전에 false로)
const levelOf = xp => { let L = 1; while (xp >= xpFor(L + 1) && L < MAX_LV) L++; return L; };

/* 입질 유형: nib=탐색 입질 시간(초), sink=찌가 가라앉는 시간, hold=잠긴 채 머무는 시간,
   depth=찌가 잠기는 깊이(1이면 수면까지), early=챔질이 먹히기 시작하는 시점(가라앉는 진행률) */
const BEHAV = {
  tick:  { nib: [.8, 2.0],  sink: .30, hold: .70, depth: .55, early: .25 },
  slow:  { nib: [1.2, 2.8], sink: 1.50, hold: .80, depth: 1.05, early: .35 },
  sharp: { nib: [.4, 1.0],  sink: .25, hold: 1.10, depth: 1.25, early: .50 },
  dive:  { nib: [.1, .4],   sink: .40, hold: .90, depth: 1.60, early: .40 },
  thief: { nib: [3.0, 4.2], sink: .10, hold: .10, depth: .40, early: 0 }
};

const FISH = [
  { id: 'hak',   name: '학꽁치', depth: [0, 1.5],  baits: { krill: 1, worm: .4 }, time: { dawn: 1, day: 1.2, dusk: 1, night: .1 }, peak: [9, 10, 11], size: [20, 38], k: 4,  price: 9000,  power: .25, bite: 'tick',  base: 1.2, chum: 1.5, col: '#c9dfe6', h: .08, tip: '표층을 무리 지어 다녀요. 찌 바로 아래에서 입질합니다.' },
  { id: 'aji',   name: '전갱이', depth: [2, 7],    baits: { krill: 1 },           time: { dawn: 1, day: 1, dusk: 1.1, night: .8 }, peak: [7, 8, 9, 10], size: [15, 32], k: 13, price: 8000,  power: .35, bite: 'tick',  base: 1.3, chum: 1.6, col: '#9bb5c2', h: .14, tip: '중층 떼고기. 밑밥에 잘 모여요.' },
  { id: 'mang',  name: '망상어', depth: [1, 6],    baits: { worm: 1, mussel: .7, krill: .6 }, time: { dawn: 1, day: 1, dusk: 1, night: .7 }, peak: [4, 5, 10, 11], size: [12, 24], k: 17, price: 6000, power: .25, bite: 'slow', base: 1.2, chum: 1.2, col: '#8a7d6b', h: .22, tip: '방파제 단골. 새끼를 낳는 물고기예요.' },
  { id: 'nore',  name: '노래미', depth: [5, 14],   baits: { worm: 1, mussel: .6, crab: .5 }, time: { dawn: 1, day: 1, dusk: 1, night: 1.1 }, peak: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], size: [18, 40], k: 13, price: 14000, power: .4, bite: 'sharp', base: 1, chum: 1, col: '#7a6a45', h: .17, tip: '바닥 가까이에 붙어 있어요. 수심을 깊게 주세요.' },
  { id: 'jwi',   name: '쥐치',   depth: [1, 8],    baits: { mussel: 1, worm: .8, krill: .3 }, time: { dawn: .9, day: 1, dusk: 1, night: .3 }, peak: [9, 10, 11], size: [18, 32], k: 16, price: 15000, power: .4, bite: 'tick', base: .9, chum: 1.1, col: '#a4a08f', h: .3, tip: '입이 작아 조심스럽게 깨작거려요.' },
  { id: 'bol',   name: '볼락',   depth: [3, 9],    baits: { krill: 1, worm: .9 }, time: { dawn: 1.2, day: .4, dusk: 1.3, night: 1.6 }, peak: [11, 12, 1, 2, 3, 4], size: [15, 32], k: 16, price: 20000, power: .4, bite: 'slow', base: 1, chum: 1.3, col: '#a8573b', h: .2, tip: '밤과 해질녘에 활발해요. 구조물 근처를 좋아해요.' },
  { id: 'ureok', name: '우럭',   depth: [6, 14],   baits: { worm: .8, crab: .8, krill: .5 }, time: { dawn: 1, day: .9, dusk: 1, night: 1.2 }, peak: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], size: [22, 50], k: 14, price: 24000, power: .55, bite: 'sharp', base: .8, chum: 1, col: '#5d5a4c', h: .24, tip: '바닥권 육식어. 묵직하게 끌고 가요.' },
  { id: 'beng',  name: '벵에돔', depth: [1, 6],    baits: { krill: 1 }, time: { dawn: 1, day: 1.4, dusk: .8, night: .2 }, peak: [9, 10, 11, 12], size: [25, 55], k: 19, price: 25000, power: .65, bite: 'slow', base: .8, chum: 2.6, col: '#5b5f54', h: .27, tip: '밑밥이 있어야 떠올라요. 낮에 찌를 서서히 끌고 들어갑니다.' },
  { id: 'gam',   name: '감성돔', depth: [3, 10],   baits: { worm: 1, mussel: 1, krill: .7, crab: .6 }, time: { dawn: 1.5, day: .6, dusk: 1.4, night: 1 }, peak: [4, 5, 10, 11], size: [28, 58], k: 20, price: 33000, power: .78, bite: 'slow', base: .55, chum: 1.3, col: '#8d98a2', h: .26, tip: '갯바위 낚시의 꽃. 물이 움직이는 새벽과 해질녘에 노려요.' },
  { id: 'nong',  name: '농어',   depth: [.5, 5],   baits: { worm: 1, krill: .4 }, time: { dawn: 1.3, day: .4, dusk: 1.2, night: 1.5 }, peak: [8, 9, 10, 11], size: [45, 95], k: 10, price: 22000, power: .9, bite: 'dive', base: .35, chum: 1.1, col: '#aebfc4', h: .17, tip: '얕은 곳에서 갑자기 차고 나가요. 힘이 엄청나요.' },
  { id: 'cham',  name: '참돔',   depth: [5, 14],   baits: { krill: 1, mussel: .4 }, time: { dawn: 1.3, day: .9, dusk: 1.3, night: .3 }, peak: [4, 5, 10, 11], size: [30, 80], k: 16, price: 32000, power: .85, bite: 'dive', base: .35, chum: 1.8, col: '#e58a86', h: .3, tip: '조류가 센 깊은 곳에서 찌를 확 끌고 들어가요.' },
  { id: 'dol',   name: '돌돔',   depth: [3, 10],   baits: { crab: 1.3, mussel: 1 }, time: { dawn: .9, day: 1.3, dusk: .7, night: .2 }, peak: [7, 8, 9, 10], size: [28, 60], k: 20, price: 70000, power: .95, bite: 'sharp', base: .2, chum: 1, col: '#c9d3d6', h: .32, stripes: true, tip: '바다낚시의 대물. 게나 홍합살로 노려요. 줄이 터지기 쉬워요.' },
  { id: 'bok',   name: '복어',   depth: [.5, 9],   baits: { krill: 1, worm: 1, mussel: 1, crab: .6 }, time: { dawn: 1, day: 1, dusk: 1, night: 1 }, peak: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], size: [12, 28], k: 25, price: 0, power: .2, bite: 'thief', base: 1, chum: 1.2, col: '#b9b59a', h: .4, thief: true, tip: '미끼만 뜯어가는 불청객. 독이 있어 놓아줘요.' },
  /* ---- 잡어 · 부수 어종 (지역마다 자주 올라오는 고기) ---- */
  { id: 'mi',      name: '미역치',   junk: true, depth: [.5, 6], baits: { worm: 1, krill: .8, mussel: .6 }, time: { dawn: 1, day: 1, dusk: 1, night: 1.2 }, peak: [5, 6, 7, 8, 9, 10, 11], size: [8, 18], k: 20, price: 3000, power: .15, bite: 'tick', base: 1.1, chum: 1.1, col: '#8a5a3c', h: .22, reg: { '동해': 1.6, '남해': 1.2, '서해': .4, '제주': .8 }, tiers: { small: 1.3, mid: 1.3, yeo: .6 }, tip: '등지느러미에 독가시가 있어요! 바닥 근처에서 미끼를 깨작거리는 방파제 단골 잡어.' },
  { id: 'dok',     name: '독가시치', junk: true, depth: [1, 8], baits: { krill: 1, worm: .7, mussel: .4 }, time: { dawn: 1, day: 1, dusk: 1, night: .5 }, peak: [7, 8, 9, 10, 11], size: [15, 35], k: 18, price: 5000, power: .3, bite: 'slow', base: .9, chum: 1.4, col: '#8a8f5a', h: .3, reg: { '동해': .5, '남해': 1.3, '서해': 0, '제주': 1.6 }, tiers: { rock: 1.2, yeo: 1.2 }, tip: '남쪽 바다 잡어. 지느러미 독가시를 조심하세요. 크릴 밑밥에 잘 올라와요.' },
  { id: 'hwang',   name: '황어',     junk: true, depth: [.5, 4], baits: { worm: 1, krill: .8, mussel: .3 }, time: { dawn: 1.2, day: 1, dusk: 1.1, night: .3 }, peak: [2, 3, 4, 5, 11, 12], size: [20, 40], k: 14, price: 6000, power: .35, bite: 'tick', base: 1, chum: 1.2, col: '#a8a37a', h: .22, reg: { '동해': 1.8, '남해': .3, '서해': .3, '제주': 0 }, tiers: { small: 1.4, mid: 1.2, rock: .8, big: .6, yeo: .3 }, tip: '동해안 하구 근처 방파제에서 올라와요. 산란기엔 몸에 주황 줄이 들어요.' },
  { id: 'godeung', name: '고등어',   junk: true, depth: [1, 7], baits: { krill: 1, worm: .3 }, time: { dawn: 1.4, day: .9, dusk: 1.4, night: .6 }, peak: [8, 9, 10, 11], size: [22, 42], k: 10, price: 7000, power: .5, bite: 'sharp', base: 1.1, chum: 2.2, col: '#4a7f8c', h: .16, reg: { '동해': 1.5, '남해': 1.3, '서해': .5, '제주': 1 }, tip: '무리를 지어 몰려다녀요. 밑밥을 치면 우르르 올라와요. 손맛이 좋아요.' },
  { id: 'nol',     name: '용치놀래기', junk: true, depth: [1, 6], baits: { worm: 1, mussel: .8, krill: .5 }, time: { dawn: .8, day: 1.3, dusk: .8, night: .1 }, peak: [6, 7, 8, 9, 10], size: [10, 22], k: 16, price: 3500, power: .2, bite: 'tick', base: 1.2, chum: 1.1, col: '#6a8f5a', h: .24, reg: { '동해': 1, '남해': 1.4, '서해': .6, '제주': 1.3 }, tip: '알록달록한 잡어. 낮에만 활동하고 밤엔 모래에 숨어요.' },
  { id: 'jwinore', name: '쥐노래미', junk: true, depth: [4, 12], baits: { worm: 1, crab: .8, mussel: .6 }, time: { dawn: 1, day: 1, dusk: 1, night: 1.2 }, peak: [10, 11, 12, 1, 2, 3], size: [20, 45], k: 14, price: 18000, power: .5, bite: 'sharp', base: .8, chum: 1, col: '#6b5230', h: .22, reg: { '동해': 1.2, '남해': 1, '서해': .8, '제주': .5 }, tip: '바위틈에 숨어 있다가 확 물고 들어가요. 회로 인기가 좋은 부수입 어종.' },
  { id: 'sung',    name: '숭어',     junk: true, depth: [0, 3], baits: { worm: .8, krill: .5 }, time: { dawn: 1, day: 1.3, dusk: 1, night: .3 }, peak: [9, 10, 11, 12, 1], size: [30, 70], k: 11, price: 9000, power: .6, bite: 'slow', base: .6, chum: 1.8, col: '#9aa5a8', h: .2, reg: { '동해': .6, '남해': 1, '서해': 1.5, '제주': .3 }, tiers: { small: 1.3, mid: 1.2, rock: .5, yeo: .3 }, tip: '항구 안쪽 표층을 떼로 다녀요. 점프도 하고 힘이 좋아요.' },
  { id: 'bori',    name: '보리멸',   junk: true, depth: [1, 5], baits: { worm: 1, krill: .5 }, time: { dawn: 1, day: 1.3, dusk: .9, night: .1 }, peak: [6, 7, 8, 9], size: [15, 28], k: 12, price: 12000, power: .25, bite: 'tick', base: .9, chum: 1.2, col: '#d6c9a5', h: .1, reg: { '동해': 1, '남해': 1, '서해': 1.5, '제주': .5 }, tiers: { small: 1.3, mid: 1.2, rock: .6, yeo: .3 }, tip: '모래 바닥을 좋아하는 날씬한 고기. 튀김용으로 인기가 좋아요.' },
  { id: 'yeol',    name: '불볼락',   junk: true, depth: [4, 12], baits: { krill: 1, worm: .9 }, time: { dawn: 1.2, day: .5, dusk: 1.4, night: 1.5 }, peak: [10, 11, 12, 1, 2, 3, 4], size: [15, 30], k: 17, price: 16000, power: .35, bite: 'slow', base: .8, chum: 1.3, col: '#c24a3a', h: .2, reg: { '동해': 1.6, '남해': 1.2, '서해': .3, '제주': .6 }, tip: '열기라고도 불러요. 빨간 몸으로 밤과 해질녘에 잘 올라와요.' },
  { id: 'gal',     name: '갈치',     junk: true, depth: [1, 8], baits: { krill: 1, worm: .6 }, time: { dawn: 1, day: .2, dusk: 1.3, night: 1.8 }, peak: [8, 9, 10, 11], size: [60, 110], k: 1.2, price: 22000, power: .45, bite: 'sharp', base: .6, chum: 1.4, col: '#c9d4d8', h: .06, reg: { '동해': .3, '남해': 1.4, '서해': .6, '제주': 1.3 }, tiers: { rock: 1.2, big: 1.3, yeo: 1.1 }, tip: '밤에 불빛 아래로 올라오는 은빛 칼. 이빨이 날카로워 줄이 잘 터져요.' },
  { id: 'sam',     name: '삼치',     junk: true, depth: [1, 6], baits: { krill: .5, worm: .5 }, time: { dawn: 1.5, day: .6, dusk: 1.4, night: .2 }, peak: [9, 10, 11], size: [45, 90], k: 6, price: 15000, power: .8, bite: 'dive', base: .35, chum: 1.3, col: '#7d8f9a', h: .14, reg: { '동해': 1.4, '남해': 1.2, '서해': .5, '제주': .8 }, tiers: { small: .4, mid: .8, rock: 1.2, big: 1.4, yeo: 1.3 }, tip: '가을에 몰려드는 빠른 사냥꾼. 차고 나가는 힘이 대단해요.' },
  { id: 'jeon',    name: '전어',     junk: true, depth: [1, 5], baits: { krill: 1, worm: .4 }, time: { dawn: 1, day: 1.1, dusk: 1.1, night: .4 }, peak: [8, 9, 10, 11], size: [15, 30], k: 13, price: 9000, power: .25, bite: 'tick', base: 1.2, chum: 2, col: '#9db5bd', h: .26, reg: { '동해': .2, '남해': 1.3, '서해': 1.6, '제주': .2 }, tiers: { small: 1.3, mid: 1.2, rock: .5, yeo: .3 }, tip: '가을 전어! 밑밥에 떼로 모여요. 가을철 효자 어종.' },
  { id: 'seong',   name: '성대',     junk: true, depth: [6, 14], baits: { worm: 1, krill: .6, crab: .5 }, time: { dawn: .8, day: 1, dusk: 1, night: 1.2 }, peak: [5, 6, 7, 8, 9, 10], size: [20, 40], k: 13, price: 7000, power: .3, bite: 'slow', base: .7, chum: 1, col: '#c96a4a', h: .2, reg: { '동해': .8, '남해': 1.3, '서해': 1.2, '제주': .5 }, tip: '바닥을 기어 다니는 큰 가슴지느러미 물고기. 바닥을 긁으면 올라와요.' }
];
SPOT_DEFS.sort((a, b) => a[4] - b[4]);
const SPOTS = SPOT_DEFS.map(([id, name, region, tier, lv, desc], i) => {
  const T = TIERS[tier], r = REGION[region] || {}, mult = {}, u = (i * 37 % 10) / 9, loc = SPOT_LOC[id] || {};
  for (const k in T.base) mult[k] = Math.round(T.base[k] * (r[k] == null ? 1 : r[k]) * (loc[k] == null ? 1 : loc[k]) * 100) / 100;
  for (const f of FISH) if (f.reg) { const m = (f.reg[region] || 0) * (f.tiers && f.tiers[tier] != null ? f.tiers[tier] : 1) * (loc[f.id] == null ? 1 : loc[f.id]); if (m > 0) mult[f.id] = Math.round(m * 100) / 100; }
  return { tideAmp: TIDE_AMP[region] || .1, id, name, region, tier, tierLabel: T.label, type: T.type, stand: T.stand, lv, desc, mult, zone: T.zone, exp: T.exp, seed: i,
    depth: Math.round(T.depth[0] + (T.depth[1] - T.depth[0]) * u), flow: Math.round((T.flow[0] + (T.flow[1] - T.flow[0]) * u) * 100) / 100 };
});


const WX = {
  calm:  { name: '잔잔', bite: .95 },
  clear: { name: '맑음', bite: 1 },
  cloud: { name: '흐림', bite: 1.12 },
  rough: { name: '파도 거침', bite: .9 },
  rain:  { name: '비',   bite: 1.2 }
};

const BAIT_COLOR = { krill: '#ff8a6b', worm: '#c76a8b', mussel: '#e0a35c', crab: '#b7835a' };
const SNAP_COST = 1500, CHUM_MAX = 10, CHUM_SECONDS = 60;
/* 밑밥 재료: 직접 조합해서 만들어요. bonus = 어종별 반응 (수가 클수록 그 고기가 더 모여요) */
const CHUM_ING = [
  { id: 'krill', name: '크릴', price: 300, note: '만능 유인. 대부분의 어종이 반응', col: '#ff8f7a' },
  { id: 'bread', name: '빵가루', price: 100, note: '넓게 퍼지고 오래가요. 잔챙이·복어도 모여요', col: '#e6c88a' },
  { id: 'pgam', name: '감성돔용 파우더', price: 800, note: '감성돔을 집중 유인', col: '#9fd8ff' },
  { id: 'pbeng', name: '벵에돔용 파우더', price: 800, note: '벵에돔을 집중 유인', col: '#c9b3ff' }
];
const CHUM_BONUS = {
  bread: { hak: .9, aji: .6, mang: .8, nore: .1, jwi: .8, bol: .5, ureok: .1, beng: .6, gam: .4, nong: 0, cham: .1, dol: 0, bok: 1 },
  pgam: { gam: 2.8, nong: .3, cham: .5, dol: .3, beng: .15, bol: .2, aji: .3, mang: .3, jwi: .3, ureok: .3, nore: .3, hak: .05, bok: .2 },
  pbeng: { beng: 2.8, mang: .6, jwi: .6, aji: .5, hak: .3, gam: .25, bol: .3, nore: .1, ureok: .1, nong: .1, cham: .2, dol: .1, bok: .2 }
};
const CHUM_PRESETS = [
  { name: '만능', r: { krill: 3, bread: 2, pgam: 0, pbeng: 0 } },
  { name: '감성돔', r: { krill: 2, bread: 2, pgam: 2, pbeng: 0 } },
  { name: '벵에돔', r: { krill: 1, bread: 3, pgam: 0, pbeng: 1 } },
  { name: '떼고기(전갱이)', r: { krill: 4, bread: 1, pgam: 0, pbeng: 0 } }
];


/* ================= 상점: 브랜드 · 낚싯대 · 장비 (게임 속 가상 브랜드) ================= */
const BRANDS = {
  dina:   { name: '다이나',   col: '#3b7cf0', tag: '안정적인 올라운더' },
  sinano: { name: '시나노',   col: '#22b88a', tag: '장거리 캐스팅 · 가벼움' },
  gamak:  { name: '가마쿠츠', col: '#e8a020', tag: '하이엔드 · 파이팅 최강' }
};
const SLOTS = { rod: '낚싯대', reel: '릴', hat: '모자', top: '옷', vest: '구명조끼', boots: '신발' };   // 장착 슬롯
/* rod: ease=파이팅 쉬움(0~.5) cast=캐스팅 거리 배수 | 장비: 색/모양 */
const SHOP_ITEMS = [
  { id: 'rod0', slot: 'rod', brand: null, name: '입문 낚싯대', price: 0, lv: 1, ease: 0, cast: 1, desc: '기본 장비', cg: [.8, .2, .15], ca: [.1, .12, .14], cb: [.28, .3, .32] },
  { id: 'rod_d1', slot: 'rod', brand: 'dina', name: '다이나 해풍 1호', price: 80000, lv: 3, ease: .08, cast: 1.02, desc: '튼튼한 입문 상위대', cg: [.2, .4, .9], ca: [.08, .14, .3], cb: [.2, .3, .6] },
  { id: 'rod_s1', slot: 'rod', brand: 'sinano', name: '시나노 갯바위 1호', price: 120000, lv: 6, ease: .06, cast: 1.08, desc: '가볍고 멀리 던져요', cg: [.15, .7, .5], ca: [.08, .2, .18], cb: [.2, .5, .42] },
  { id: 'rod_g1', slot: 'rod', brand: 'gamak', name: '가마쿠츠 마스터 1호', price: 250000, lv: 10, ease: .14, cast: 1, desc: '대물에도 버텨요', cg: [.9, .65, .15], ca: [.06, .06, .07], cb: [.22, .2, .14] },
  { id: 'rod_d2', slot: 'rod', brand: 'dina', name: '다이나 인테그랄 1.25호', price: 280000, lv: 12, ease: .17, cast: 1.04, desc: '탄력 좋은 중급대', cg: [.2, .4, .9], ca: [.06, .12, .36], cb: [.25, .4, .75] },
  { id: 'rod_s2', slot: 'rod', brand: 'sinano', name: '시나노 비스트 1.25호', price: 480000, lv: 16, ease: .14, cast: 1.15, desc: '원투에 강한 중급대', cg: [.15, .7, .5], ca: [.06, .24, .2], cb: [.25, .62, .5] },
  { id: 'rod_d3', slot: 'rod', brand: 'dina', name: '다이나 소울 에이전트 1.5호', price: 950000, lv: 25, ease: .27, cast: 1.06, desc: '고급 올라운더', cg: [.2, .4, .9], ca: [.05, .1, .4], cb: [.3, .5, .9] },
  { id: 'rod_s3', slot: 'rod', brand: 'sinano', name: '시나노 제로 1.5호', price: 1600000, lv: 30, ease: .22, cast: 1.25, desc: '최상급 원투 전용', cg: [.15, .7, .5], ca: [.05, .3, .26], cb: [.35, .85, .68] },
  { id: 'rod_g2', slot: 'rod', brand: 'gamak', name: '가마쿠츠 로열 1.5호', price: 2200000, lv: 34, ease: .33, cast: 1.03, desc: '큰 고기도 지치지 않아요', cg: [.9, .65, .15], ca: [.05, .05, .06], cb: [.5, .38, .12] },
  { id: 'rod_g3', slot: 'rod', brand: 'gamak', name: '가마쿠츠 레전드 2호', price: 4000000, lv: 40, ease: .45, cast: 1.05, desc: '전설의 파이팅 로드', cg: [1, .8, .2], ca: [.04, .04, .05], cb: [.85, .65, .2] },

  { id: 'hat0', slot: 'hat', brand: null, name: '기본 캡', price: 0, lv: 1, c: [.96, .78, .22], style: 'cap', desc: '노란 캡 모자' },
  { id: 'hat_d', slot: 'hat', brand: 'dina', name: '다이나 바이저 캡', price: 15000, lv: 2, c: [.12, .22, .6], style: 'cap', desc: '곤색 바이저 캡' },
  { id: 'hat_s', slot: 'hat', brand: 'sinano', name: '시나노 버킷햇', price: 20000, lv: 5, c: [.12, .6, .5], style: 'bucket', desc: '챙이 둥근 버킷햇' },
  { id: 'hat_g', slot: 'hat', brand: 'gamak', name: '가마쿠츠 와이드햇', price: 35000, lv: 9, c: [.1, .1, .12], style: 'wide', desc: '챙이 넓은 검정 모자' },

  { id: 'top0', slot: 'top', brand: null, name: '기본 작업복', price: 0, lv: 1, c: [.28, .42, .56], p: [.17, .22, .3], desc: '파란 상하의' },
  { id: 'top_d', slot: 'top', brand: 'dina', name: '다이나 윈드브레이커', price: 60000, lv: 4, c: [.14, .22, .62], p: [.1, .12, .22], desc: '방풍 상하의' },
  { id: 'top_s', slot: 'top', brand: 'sinano', name: '시나노 방한 상하의', price: 90000, lv: 8, c: [.12, .6, .52], p: [.14, .17, .19], desc: '따뜻한 청록 방한복' },
  { id: 'top_g', slot: 'top', brand: 'gamak', name: '가마쿠츠 프로 수트', price: 150000, lv: 13, c: [.13, .13, .15], p: [.2, .16, .1], desc: '검정+골드 프로 수트' },

  { id: 'vest0', slot: 'vest', brand: null, name: '기본 구명조끼', price: 0, lv: 1, c: [.9, .42, .17], desc: '주황 구명조끼' },
  { id: 'vest_d', slot: 'vest', brand: 'dina', name: '다이나 구명조끼', price: 40000, lv: 3, c: [.85, .12, .16], desc: '빨강 구명조끼' },
  { id: 'vest_s', slot: 'vest', brand: 'sinano', name: '시나노 구명조끼', price: 55000, lv: 7, c: [.55, .8, .2], desc: '라임 구명조끼' },
  { id: 'vest_g', slot: 'vest', brand: 'gamak', name: '가마쿠츠 구명조끼', price: 80000, lv: 11, c: [.95, .72, .1], desc: '골드 구명조끼' },

  { id: 'boots0', slot: 'boots', brand: null, name: '기본 장화', price: 0, lv: 1, c: [.09, .1, .12], desc: '검정 장화' },
  { id: 'boots_d', slot: 'boots', brand: 'dina', name: '다이나 갯바위 장화', price: 50000, lv: 5, c: [.1, .25, .62], desc: '파랑 갯바위 장화' },
  { id: 'boots_s', slot: 'boots', brand: 'sinano', name: '시나노 펠트 장화', price: 70000, lv: 9, c: [.1, .42, .32], desc: '초록 펠트 장화' },
  { id: 'boots_g', slot: 'boots', brand: 'gamak', name: '가마쿠츠 스파이크 부츠', price: 110000, lv: 14, c: [.28, .2, .06], desc: '골드 갈색 스파이크 부츠' }
];
const itemById = id => SHOP_ITEMS.find(x => x.id === id);


/* ================= 릴 (다이나 · 시나노만) =================
   type: drag=일반 드랙릴 / lever=브레이크레버릴(Lv15~)   q: 드랙 품질 0~1 (소리 · 부드러움)   speed: 감기 속도 보너스 */
SHOP_ITEMS.push(
  { id: 'reel0', slot: 'reel', brand: null, type: 'drag', name: '입문 릴', price: 0, lv: 1, q: .05, speed: 0, desc: '기본 드랙릴', c: [.5, .5, .55] },
  { id: 'reel_d1', slot: 'reel', brand: 'dina', type: 'drag', name: '다이나 해풍 2500', price: 70000, lv: 4, q: .25, speed: .05, desc: '튼튼한 드랙릴', c: [.2, .4, .9] },
  { id: 'reel_s1', slot: 'reel', brand: 'sinano', type: 'drag', name: '시나노 갯바위 2500', price: 90000, lv: 6, q: .3, speed: .05, desc: '가벼운 드랙릴', c: [.15, .7, .5] },
  { id: 'reel_d2', slot: 'reel', brand: 'dina', type: 'drag', name: '다이나 인테그랄 3000', price: 220000, lv: 12, q: .5, speed: .1, desc: '부드러운 드랙', c: [.15, .3, .75] },
  { id: 'reel_s2', slot: 'reel', brand: 'sinano', type: 'drag', name: '시나노 비스트 3000', price: 300000, lv: 14, q: .55, speed: .11, desc: '맑은 드랙음', c: [.1, .6, .45] },
  { id: 'reel_dl1', slot: 'reel', brand: 'dina', type: 'lever', name: '다이나 레버 LB 소울', price: 450000, lv: 16, q: .6, speed: .14, desc: '브레이크 레버로 즉시 줄을 풀어줘요', c: [.3, .5, 1] },
  { id: 'reel_sl1', slot: 'reel', brand: 'sinano', type: 'lever', name: '시나노 레버 LB 비스트', price: 650000, lv: 20, q: .7, speed: .15, desc: '정밀한 브레이크 레버', c: [.2, .8, .6] },
  { id: 'reel_d3', slot: 'reel', brand: 'dina', type: 'drag', name: '다이나 소울 4000', price: 700000, lv: 26, q: .78, speed: .16, desc: '고급 드랙릴', c: [.1, .25, .85] },
  { id: 'reel_dl2', slot: 'reel', brand: 'dina', type: 'lever', name: '다이나 레버 LB 소울 SP', price: 1400000, lv: 28, q: .85, speed: .2, desc: '고급 레버릴', c: [.4, .6, 1] },
  { id: 'reel_s3', slot: 'reel', brand: 'sinano', type: 'drag', name: '시나노 제로 4000', price: 1100000, lv: 32, q: .9, speed: .18, desc: '카랑카랑한 최상급 드랙', c: [.1, .9, .65] },
  { id: 'reel_sl2', slot: 'reel', brand: 'sinano', type: 'lever', name: '시나노 레버 LB 제로', price: 2600000, lv: 36, q: .97, speed: .26, desc: '최상급 레버릴', c: [.3, 1, .75] }
);
const LEVER_MIN_LV = 15;

/* ================= 가방 · 태클박스 · 낚싯대 가방 (보유 중 가장 큰 용량이 자동 적용) ================= */
SHOP_ITEMS.push(
  { id: 'tbox_d1', slot: 'tbox', brand: 'dina', name: '다이나 소형 태클박스', price: 40000, lv: 2, cap: 24, desc: '채비 24개 보관' },
  { id: 'tbox_s1', slot: 'tbox', brand: 'sinano', name: '시나노 중형 태클박스', price: 110000, lv: 8, cap: 40, desc: '채비 40개 보관' },
  { id: 'tbox_d2', slot: 'tbox', brand: 'dina', name: '다이나 대형 태클박스', price: 300000, lv: 16, cap: 70, desc: '채비 70개 보관' },
  { id: 'tbox_g1', slot: 'tbox', brand: 'gamak', name: '가마쿠츠 프로 태클박스', price: 800000, lv: 26, cap: 120, desc: '채비 120개 보관' },
  { id: 'tbox_g2', slot: 'tbox', brand: 'gamak', name: '가마쿠츠 마스터 태클박스', price: 2000000, lv: 38, cap: 200, desc: '채비 200개 보관' },
  { id: 'bag_d1', slot: 'bag', brand: 'dina', name: '다이나 숄더 낚시가방', price: 50000, lv: 3, cap: 14, desc: '밑밥 재료를 14개까지 담아요' },
  { id: 'bag_s1', slot: 'bag', brand: 'sinano', name: '시나노 백팩 낚시가방', price: 140000, lv: 9, cap: 18, desc: '밑밥 재료 18개' },
  { id: 'bag_g1', slot: 'bag', brand: 'gamak', name: '가마쿠츠 프로 낚시가방', price: 400000, lv: 20, cap: 24, desc: '밑밥 재료 24개' },
  { id: 'bag_s2', slot: 'bag', brand: 'sinano', name: '시나노 하이엔드 낚시가방', price: 900000, lv: 30, cap: 30, desc: '밑밥 재료 30개' },
  { id: 'case_d1', slot: 'case', brand: 'dina', name: '다이나 소프트 로드케이스', price: 35000, lv: 2, cap: 3, desc: '낚싯대 3개까지 보유' },
  { id: 'case_s1', slot: 'case', brand: 'sinano', name: '시나노 로드케이스', price: 90000, lv: 8, cap: 4, desc: '낚싯대 4개 보유' },
  { id: 'case_g1', slot: 'case', brand: 'gamak', name: '가마쿠츠 로드케이스', price: 260000, lv: 18, cap: 6, desc: '낚싯대 6개 보유' },
  { id: 'case_d2', slot: 'case', brand: 'dina', name: '다이나 하드 로드케이스', price: 600000, lv: 28, cap: 8, desc: '낚싯대 8개 보유' },
  { id: 'case_g2', slot: 'case', brand: 'gamak', name: '가마쿠츠 마스터 로드케이스', price: 1500000, lv: 38, cap: 12, desc: '낚싯대 12개 보유' }
);
const BOX_BASE = { tbox: 12, bag: 10, case: 2 };
const BOX_NAME = { tbox: '태클박스', bag: '낚시가방', case: '낚싯대 가방' };

/* ================= 채비 (태클박스에 담는 소모품) =================
   기본(free) 채비는 무한. 나머지는 묶음(pack)으로 사서 태클박스 칸(1개=1칸)을 차지해요 */
const TACKLE_TYPE = { hook: '바늘', float: '찌', swivel: '도래', leader: '목줄', main: '원줄' };
const TACKLE = [
  { id: 'hk0', type: 'hook', brand: null, name: '기본 바늘 #6', free: true, g: 0, desc: '기본형' },
  { id: 'hk_d', type: 'hook', brand: 'dina', name: '다이나 감성돔 바늘 #5', price: 3000, pack: 5, lv: 2, g: 1, desc: '챔질이 조금 관대해요' },
  { id: 'hk_s', type: 'hook', brand: 'sinano', name: '시나노 벵에돔 바늘 #6', price: 4500, pack: 5, lv: 8, g: 2, desc: '챔질 관대 · 바늘 빠짐 감소' },
  { id: 'hk_g', type: 'hook', brand: 'gamak', name: '가마쿠츠 칸바리 #7', price: 9000, pack: 5, lv: 14, g: 3, desc: '걸리면 잘 안 빠져요' },
  { id: 'hk_g2', type: 'hook', brand: 'gamak', name: '가마쿠츠 마스터 #7', price: 18000, pack: 5, lv: 28, g: 4, desc: '최고급 바늘' },
  { id: 'ld0', type: 'leader', brand: null, name: '기본 목줄 2호', free: true, str: 0, bite: 0, desc: '기본형' },
  { id: 'ld_d15', type: 'leader', brand: 'dina', name: '다이나 목줄 1.5호', price: 2500, pack: 3, lv: 2, str: -.03, bite: .08, desc: '가늘어서 입질이 좋아요 · 약해요' },
  { id: 'ld_d3', type: 'leader', brand: 'dina', name: '다이나 목줄 3호', price: 3500, pack: 3, lv: 5, str: .05, bite: -.06, desc: '조금 더 강해요' },
  { id: 'ld_s4', type: 'leader', brand: 'sinano', name: '시나노 목줄 4호', price: 5000, pack: 3, lv: 12, str: .09, bite: -.12, desc: '대물용 · 입질은 줄어요' },
  { id: 'ld_g5', type: 'leader', brand: 'gamak', name: '가마쿠츠 목줄 5호', price: 8000, pack: 3, lv: 20, str: .13, bite: -.18, desc: '초강력 · 입질은 더 줄어요' },
  { id: 'mn0', type: 'main', brand: null, name: '기본 원줄 2호', free: true, str: 0, cast: 0, desc: '기본형' },
  { id: 'mn_s15', type: 'main', brand: 'sinano', name: '시나노 원줄 1.5호', price: 6000, pack: 1, lv: 4, str: -.03, cast: .04, desc: '가늘어서 멀리 날아가요' },
  { id: 'mn_d25', type: 'main', brand: 'dina', name: '다이나 원줄 2.5호', price: 7000, pack: 1, lv: 6, str: .03, cast: 0, desc: '균형형' },
  { id: 'mn_s3', type: 'main', brand: 'sinano', name: '시나노 원줄 3호', price: 9000, pack: 1, lv: 12, str: .06, cast: -.02, desc: '튼튼한 원줄' },
  { id: 'mn_g5', type: 'main', brand: 'gamak', name: '가마쿠츠 원줄 5호', price: 16000, pack: 1, lv: 24, str: .12, cast: -.05, desc: '대물용 굵은 원줄' },
  { id: 'sw0', type: 'swivel', brand: null, name: '기본 도래', free: true, over: 0, desc: '기본형' },
  { id: 'sw_d', type: 'swivel', brand: 'dina', name: '다이나 베어링 도래', price: 3500, pack: 5, lv: 5, over: .15, desc: '줄 꼬임 감소 · 과부하가 천천히 쌓여요' },
  { id: 'sw_s', type: 'swivel', brand: 'sinano', name: '시나노 베어링 도래', price: 6000, pack: 5, lv: 13, over: .25, desc: '매끄럽게 돌아요' },
  { id: 'sw_g', type: 'swivel', brand: 'gamak', name: '가마쿠츠 베어링 도래', price: 12000, pack: 5, lv: 25, over: .4, desc: '최고급 도래' },
  { id: 'fl_h0', type: 'float', brand: null, kind: 'hole', name: '구멍찌', free: true, dist: 1, vis: 1, desc: '기본 구멍찌' },
  { id: 'fl_s0', type: 'float', brand: null, kind: 'self', name: '자립 막대찌', free: true, dist: 1, vis: 1, desc: '기본 자립 막대찌' },
  { id: 'fl_n0', type: 'float', brand: null, kind: 'non', name: '비자립 막대찌', free: true, dist: 1, vis: 1, desc: '기본 비자립 막대찌' },
  { id: 'fl_h_d', type: 'float', brand: 'dina', kind: 'hole', name: '다이나 구멍찌', price: 20000, pack: 1, lv: 4, dist: 1.04, vis: 1.12, desc: '시인성이 좋은 구멍찌' },
  { id: 'fl_n_d', type: 'float', brand: 'dina', kind: 'non', name: '다이나 비자립 막대찌', price: 30000, pack: 1, lv: 8, dist: 1.05, vis: 1.15, desc: '입질이 또렷하게 보여요' },
  { id: 'fl_s_d', type: 'float', brand: 'dina', kind: 'self', name: '다이나 자립 막대찌', price: 40000, pack: 1, lv: 9, dist: 1.1, vis: 1.05, desc: '멀리 날아가는 자립찌' },
  { id: 'fl_h_s', type: 'float', brand: 'sinano', kind: 'hole', name: '시나노 구멍찌', price: 35000, pack: 1, lv: 10, dist: 1.1, vis: 1.1, desc: '원투가 좋은 구멍찌' },
  { id: 'fl_s_g', type: 'float', brand: 'gamak', kind: 'self', name: '가마쿠츠 자립 막대찌', price: 60000, pack: 1, lv: 16, dist: 1.14, vis: 1.0, desc: '고급 자립찌' },
  { id: 'fl_n_s', type: 'float', brand: 'sinano', kind: 'non', name: '시나노 비자립 막대찌', price: 55000, pack: 1, lv: 18, dist: 1.1, vis: 1.25, desc: '예민한 고급 비자립찌' }
];
const tackleById = id => TACKLE.find(x => x.id === id);

/* ================= 게임 상태 ================= */
const TS = 2; // 현실 1초 = 게임 2분
const START = new Date();
const G = {
  mode: 'idle',            // idle | casting | flying | waiting | bite | fight
  t: 0,
  min: START.getHours() * 60 + START.getMinutes(),
  date: START, month: START.getMonth() + 1,
  money: (typeof TEST_MAXLEVEL !== 'undefined' && TEST_MAXLEVEL) ? 100000000 : 30000, owned: { rod0: true, reel0: true, hat0: true, top0: true, vest0: true, boots0: true }, equip: { rod: 'rod0', reel: 'reel0', hat: 'hat0', top: 'top0', vest: 'vest0', boots: 'boots0' }, earned: 0,
  spotId: 'sacheon', xp: (typeof TEST_MAXLEVEL !== 'undefined' && TEST_MAXLEVEL) ? xpFor(MAX_LV) : 0, baitId: null, baited: false, floatKind: 'hole', rodType: 'self', depth: 3.5, dragAuto: true, dragBase: .6, depthMode: 'm', depthPct: 70, tide: 0, stock: {}, rig: { hook: 'hk0', leader: 'ld0', main: 'mn0', swivel: 'sw0', float: 'fl_h0' }, drag: .67, lever: false, chum: 0, chumMax: 60, chumMul: {}, recipe: { krill: 2, bread: 2, pgam: 0, pbeng: 0 },
  wx: pickWx(), wxTimer: 0,
  cast: { pos: 0, dir: 1, zone: [.5, .75], speed: 1.15 },
  zoneBonus: 1, floatX: .6, sink: 0,
  fly: null, cool: 0, bite: null, fight: null, reeling: false,
  catches: [], dex: {}, unlocked: {}, ripples: [], pop: []
};

function pickWx() { const r = Math.random(); return r < .22 ? 'calm' : r < .5 ? 'clear' : r < .68 ? 'cloud' : r < .82 ? 'rough' : 'rain'; }
const FLOATS = {
  hole: { name: '구멍찌', dist: 1, vis: 1, note: '무난한 기본형. 던지기도 보기도 평균' },
  self: { name: '자립 막대찌', dist: 1.22, vis: .7, note: '멀리 날아가요. 대신 입질이 작게 보여요' },
  non: { name: '비자립 막대찌', dist: .72, vis: 1.8, note: '잘 안 날아가요. 입질은 크게 보여요' }
};
const floatKey = () => G.floatKind === 'hole' ? 'hole' : G.rodType;
const rigItem = t => { const it = tackleById(G.rig[t]); return (it && (it.free || (G.stock[it.id] || 0) > 0)) ? it : TACKLE.find(x => x.type === t && x.free && (t !== 'float' || x.kind === floatKey())); };
const FT = () => { const b = FLOATS[floatKey()], f = rigItem('float'); return { name: b.name, note: b.note, dist: b.dist * (f.dist || 1), vis: b.vis * (f.vis || 1) }; };
const reelItem = () => itemById(G.equip.reel) || SHOP_ITEMS.find(x => x.id === 'reel0');
const bestCap = slot => Math.max(BOX_BASE[slot], ...SHOP_ITEMS.filter(x => x.slot === slot && G.owned[x.id]).map(x => x.cap));
const boxCap = () => bestCap('tbox'), chumCap = () => bestCap('bag'), rodCap = () => bestCap('case');
const boxUsed = () => Object.values(G.stock).reduce((a, b) => a + b, 0);
const rodCount = () => SHOP_ITEMS.filter(x => x.slot === 'rod' && G.owned[x.id]).length;
function rigFix() { for (const t in TACKLE_TYPE) { const it = tackleById(G.rig[t]); if (!it || (!it.free && (G.stock[it.id] || 0) <= 0)) { const d = TACKLE.find(x => x.type === t && x.free && (t !== 'float' || x.kind === floatKey())); if (it && !it.free) say(it.name + '이(가) 떨어져 기본 채비로 바꿨어요'); G.rig[t] = d.id; } } }
function useTackle(t) { const it = tackleById(G.rig[t]); if (it && !it.free) { G.stock[it.id] = Math.max(0, (G.stock[it.id] || 0) - 1); if (!G.stock[it.id]) delete G.stock[it.id]; } }
const sfx = (n, ...a) => { try { if (typeof SFX !== 'undefined') SFX[n](...a); } catch (e) {} };
const rodItem = () => itemById(G.equip.rod) || SHOP_ITEMS[0];
const spot = () => SPOTS.find(s => s.id === G.spotId);
const spotIdx = () => SPOTS.findIndex(s => s.id === G.spotId);
const effDepth = () => spot().depth + (G.tide || 0);          // 물때에 따른 현재 수심
const rigDepth = () => G.depthMode === 'pct' ? Math.max(.3, effDepth() * G.depthPct / 100 - .0) : Math.min(G.depth, effDepth() - .3);
const won = n => '₩' + Math.round(n).toLocaleString('ko-KR');

/* ================= 시간 · 물때 ================= */
function moonAge(d) {
  const jd = d.getTime() / 86400000 + 2440587.5, p = 29.530588853;
  return (((jd - 2451550.1) % p) + p) % p;
}
// 1~15물 (남해 기준 근사). 조류 세기 배수
const FLOW = [0, .45, .55, .7, .85, .95, 1, 1.05, 1.05, 1.1, 1.05, .95, .8, .6, .45, .4];
function tideInfo() {
  const age = moonAge(G.date), m = (Math.floor(age) + 7) % 15 + 1;
  const per = 745, t0 = (age * 50 + 480) % per;
  const ph = ((((G.min - t0) % per) + per) % per) / per;   // 0 = 만조
  const s = Math.sin(ph * 2 * Math.PI);
  const flow = Math.abs(s) * FLOW[m];
  const rising = s < 0;
  const stage = Math.abs(s) < .22 ? '정조' : (rising ? '들물' : '날물');
  const size = (m >= 7 && m <= 11) ? '사리' : (m >= 13 || m <= 1) ? '조금' : '중물';
  const hf = Math.cos(ph * 2 * Math.PI);                        // +1 만조 ~ -1 간조
  return { m, flow, rising, stage, size, hf, sz: size === '사리' ? 1 : size === '중물' ? .75 : .5 };
}
function tideTarget() { const T = tideInfo(); return Math.round(T.hf * T.sz * spot().tideAmp * 100) / 100; }
function band() {
  const h = (G.min / 60) % 24;
  return h >= 4 && h < 7 ? 'dawn' : h >= 7 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
}
const BAND_KO = { dawn: '새벽', day: '낮', dusk: '해질녘', night: '밤' };

/* ================= 입질 확률 ================= */
function depthFit(d, r) { const o = d < r[0] ? r[0] - d : d > r[1] ? d - r[1] : 0; return Math.exp(-o * o / 2.2); }
function candidates() {
  const sp = spot(), b = band(), rd = rigDepth(), out = [];
  for (const f of FISH) {
    const sm = sp.mult[f.id] || 0, bm = f.baits[G.baitId] || 0;
    if (!sm || !bm) continue;
    const w = f.base * sm * bm * depthFit(rd, f.depth) * f.time[b] *
      (f.peak.includes(G.month) ? 1.25 : .7) * (G.chum > 0 ? (G.chumMul[f.id] || 1) : 1) * G.zoneBonus * (1 + rigItem('leader').bite);
    out.push({ f, w });
  }
  return out;
}
function biteRate(c) {
  const T = tideInfo();
  return c.reduce((s, x) => s + x.w, 0) * (.5 + .9 * T.flow) * WX[G.wx].bite * .09;
}
function pickWeighted(c) {
  let r = Math.random() * c.reduce((s, x) => s + x.w, 0);
  for (const x of c) { r -= x.w; if (r <= 0) return x.f; }
  return c[c.length - 1].f;
}

/* ================= 캐스팅 ================= */
function startCast() {
  if (G.mode !== 'idle') return;
  rigFix();
  if (!G.baited) {
    const b = BAITS.find(x => x.id === G.baitId); if (!b) return say('먼저 미끼를 고르세요');
    if (G.money < b.price) return say('돈이 모자라요');
    G.money -= b.price; G.baited = true; save();
  }
  const L = levelOf(G.xp), w = Math.max(.12, .30 - .0045 * (L - 1)), c = .5 + Math.random() * .3;   // 레벨이 오를수록 적정 구간이 좁아짐 (Lv1 30% → Lv40 약 12%)
  G.cast = { pos: 0, dir: 1, zone: [c - w / 2, c + w / 2], speed: 1.15 };
  G.mode = 'casting';
}
function throwCast() {
  const { pos, zone } = G.cast, nice = pos >= zone[0] && pos <= zone[1];
  G.zoneBonus = nice ? 1.35 : 1;
  G.fly = { t: 0, swing: .42, rel: .34, air: 1.15, hold: .75, dur: 2.24, x1: Math.min(.97, .36 + pos * .5 * FT().dist * rodItem().cast * (1 + rigItem('main').cast)), nice, landed: false };
  G.mode = 'flying'; sfx('cast');
}
function retrieve() {
  if (G.mode === 'waiting' || G.mode === 'bite') { G.bite = null; G.sink = 0; G.mode = 'idle'; G.retr = { t: 0, x: G.floatX }; }
}

/* ================= 입질과 챔질 ================= */
function startBite(f) {
  const b = BEHAV[f.bite], nib = b.nib[0] + Math.random() * (b.nib[1] - b.nib[0]);
  G.bite = { f, b, t: 0, nib, end: nib + b.sink + b.hold, rippled: false };
  G.mode = 'bite';
}
function endBite(lostBait) {
  G.bite = null; G.sink = 0;
  if (lostBait) { G.baited = false; G.mode = 'idle'; say('미끼가 떨어졌어요. 다음 캐스팅 때 같은 미끼를 새로 끼워요'); }
  else { G.mode = 'waiting'; G.cool = 3; }
}
function biteSink(B) {
  if (B.f.thief) return B.t > .3 ? (.1 + .18 * Math.abs(Math.sin(B.t * 13))) * (Math.sin(B.t * 2.3) > -.3 ? 1 : .2) : 0;
  if (B.t < B.nib) {
    const k = B.f.bite === 'dive' ? .02 : 1;
    return k * (.08 + .16 * Math.abs(Math.sin(B.t * (B.f.bite === 'tick' ? 16 : 8)))) * (Math.sin(B.t * 3.1) > -.2 ? 1 : .3);
  }
  const u = B.t - B.nib, p = Math.min(u / B.b.sink, 1), e = 1 - Math.pow(1 - p, 2);
  let s = e * B.b.depth;
  if (B.f.bite === 'tick' && u > B.b.sink + .25) s *= Math.max(0, 1 - (u - B.b.sink - .25) / .35);
  return s;
}
function strike() {
  if (G.mode === 'waiting') { G.cool = Math.max(G.cool, 2.5); say('헛챔질. 찌가 움직일 때 채세요'); return; }
  if (G.mode !== 'bite') return;
  const B = G.bite, u = B.t - B.nib;
  if (B.f.thief) {
    if (B.t > 1 && Math.random() < .45) return hooked(B.f);
    say('복어를 놓쳤어요'); return endBite(false);
  }
  if (u < 0) { say('너무 일렀어요. 아직 덜 물었어요'); return endBite(Math.random() < .4); }
  if (u < B.b.sink * B.b.early) {
    if (Math.random() < .5 + rigItem('hook').g * .1) return hooked(B.f);
    say('챔질이 일렀어요'); return endBite(Math.random() < .6);
  }
  hooked(B.f);
}
function hooked(f) {
  sfx('strike');
  const exp = SPOTS[spotIdx()].exp;
  const frac = Math.pow(Math.random(), exp);
  const L = +(f.size[0] + (f.size[1] - f.size[0]) * frac).toFixed(1);
  G.fight = newFight(f, L, frac);
  G.fight.x0 = G.floatX; G.fight.y0 = rigDepth();
  G.bite = null; G.mode = 'fight'; G.reeling = false; G.lever = false;
  G.fight.manual = !G.dragAuto;
  if (G.fight.manual) G.drag = clamp(G.dragBase, 0, 1);
  addRipple(G.floatX, 1.4);
  say(G.fight.big ? (G.fight.manual ? '대물이다! 드랙을 조절하세요 (▲▼)' : '대물이다! 릴이 알아서 버텨요') : '걸렸다! 저항하면 줄을 풀어주세요');
}

/* ================= 파이팅 ================= */
function newFight(f, L, frac) {
  return { f, L, frac, big: f.power >= .85 && frac > .55, dist: 1, tension: .2, stamina: 1,
    power: Math.min(.98, f.power * (.7 + .4 * frac)),
    run: false, runT: 0, next: 1.2 + Math.random() * 1.2, warn: false, over: 0, slack: 0, t: 0, pull: 0, st: 'rest', stT: 0, dir: Math.random() < .5 ? -1 : 1, lat: 0, latT: 0, evt: null, nextTurn: false };
}
function fightStep(F, reel, dt) {
  const e = rodItem().ease, R = reelItem(), hk = rigItem('hook'), SN = .8 + e * .15 + rigItem('leader').str + rigItem('main').str, lev = G.lever && R.type === 'lever';
  F.t += dt; F.next -= dt;
  /* 물고기의 밀고 당기기: 쉬기 → 질주(좌우로 달아남) → 방향 틀어 달려듦(줄이 느슨해짐) / 머리 흔들기 */
  if (F.st === 'rest' && F.next <= 0) {
    if (F.f.power > .45 && Math.random() < .22) { F.st = 'shake'; F.stT = .8 + Math.random() * .6; F.evt = 'shake'; }
    else { F.st = 'run'; F.runT = (.9 + Math.random() * .9 + F.power * .5) * (1 - e * .4); F.dir = Math.random() < .7 ? -Math.sign(F.lat || F.dir) || 1 : F.dir; F.latT = F.dir * (.55 + Math.random() * .45); F.evt = 'run'; }
  } else if (F.st === 'run') {
    F.runT -= dt;
    if (F.runT <= 0) { if (Math.random() < .45) { F.st = 'turn'; F.stT = .9 + Math.random() * .7; F.latT = -F.lat * .6; F.evt = 'turn'; } else { F.st = 'rest'; F.next = 1.1 + Math.random() * 1.5 * (1.2 - F.power * .5); F.latT = F.lat * .3; } }
  } else if (F.st === 'turn' || F.st === 'shake') {
    F.stT -= dt;
    if (F.stT <= 0) { F.st = 'rest'; F.next = .8 + Math.random() * 1.2 * (1.2 - F.power * .5); F.latT = F.lat * .3; }
  }
  F.run = F.st === 'run';
  { const tt = (F.st === 'shake' ? 1 : F.st === 'run' ? .62 : F.st === 'turn' ? .45 : .22 * (.4 + .6 * F.stamina)) + F.tension * .25; F.thr = (F.thr || 0) + (tt - (F.thr || 0)) * Math.min(1, dt * 6); }
  F.lat += (F.latT - F.lat) * Math.min(1, dt * (F.st === 'run' ? 2.2 : 1.4));
  F.warn = F.st === 'rest' && F.next < .4;
  F.pull = (F.run ? F.power * (.96 + .06 * Math.sin(F.t * 9)) : F.st === 'shake' ? F.power * .6 : F.st === 'turn' ? .05 : F.power * .2 + .03 * Math.sin(F.t * 3)) * (1 - e * .6) * (F.big ? 1.15 : 1);
  let target = reel ? .30 + F.pull * .85 : F.pull * .38;
  if (F.st === 'shake') target += (Math.sin(F.t * 34) > 0 ? .2 : -.12) * (.5 + F.power * .6);   // 머리를 흔들 때 장력이 요동쳐요
  if (F.st === 'turn') { F.dist -= (.10 + F.power * .08) * dt; target = reel ? .22 : -.05; }       // 헤엄쳐 다가와요: 빨리 감지 않으면 느슨해져요
  F.tension += (target - F.tension) * Math.min(1, dt * 7);
  { const ft = clamp((F.tension - .25) * 2.2 + (F.run ? .35 : 0), 0, 1.5) * (.35 + .65 * clamp(F.dist, 0, 1)); F.fsink = (F.fsink || 0) + (ft - (F.fsink || 0)) * Math.min(1, dt * 4); }   // 팽팽해지면 찌가 끌려 들어가요
  if (reel && !lev) F.dist -= .30 * (1 + e * .5) * (1 + R.speed) * (1.15 - F.stamina * .6) * (1 - F.pull * .55) * dt;
  else F.dist += F.pull * .10 * F.stamina * (F.run ? 1.6 : .3) * dt;
  F.dist = Math.min(1.15, F.dist);
  /* 드랙: 장력이 설정값을 넘으면 줄이 풀려나가요. 보통 어종은 자동 세팅, 아주 큰 대물은 직접 조절 */
  const thr = F.manual ? .35 + G.drag * .55 : .72 + R.q * .08 + e * .05;
  F.dragOut = 0;
  if (lev) { F.tension += (.1 - F.tension) * Math.min(1, dt * 9); F.dist += F.pull * .08 * dt; F.dragOut = .25 + F.pull * .4; }
  else if (F.tension > thr) { const sl = F.tension - thr; F.tension = thr + sl * .15; F.dist += sl * .55 * dt; F.stamina = Math.max(.12, F.stamina - sl * dt * .12); F.dragOut = Math.min(1, sl * 3 + .15); }
  F.dist = Math.min(1.15, F.dist);
  F.SN = SN;
  F.over = F.tension > SN ? F.over + dt * (F.tension - SN) * 5 * (1 - rigItem('swivel').over) : Math.max(0, F.over - dt * 1.2);
  F.slack = (!reel && !lev && F.tension < .1) ? F.slack + dt : Math.max(0, F.slack - dt * 2);
  if ((reel && F.tension > .4 && F.tension < .8) || (!reel && F.run))
    F.stamina = Math.max(.12, F.stamina - dt * (reel ? .07 : .04) * (1 + e * .8) / (.5 + F.frac));
  if (F.over > .6) return 'snap';
  if (F.slack > 2.4 + e * 3 + hk.g * .4) return 'off';
  if (F.dist <= 0) return 'won';
  return null;
}
function finishFight(res) {
  const F = G.fight; G.fight = null; G.reeling = false; G.baited = false; G.mode = 'idle'; G.sink = 0; G.retr = { t: 0, x: G.floatX };
  if (res === 'won') return landFish(F);
  if (res === 'snap') { const free = tackleById(G.rig.leader).free; useTackle('leader'); useTackle('hook'); sfx('snap'); if (free) { G.money = Math.max(0, G.money - SNAP_COST); say('줄이 터졌어요! 채비 교체 ' + won(SNAP_COST)); } else say('줄이 터졌어요! 목줄과 바늘을 잃었어요'); }
  else { useTackle('hook'); say('바늘이 빠졌어요. 줄이 너무 느슨했어요'); }
  rigFix();
  save();
}
function landFish(F) {
  const f = F.f, kg = f.k * Math.pow(F.L / 100, 3), value = f.price ? Math.max(100, Math.round(kg * f.price / 100) * 100) : 0;
  const d = G.dex[f.id] || (G.dex[f.id] = { n: 0, maxL: 0, maxKg: 0 });
  const record = F.L > d.maxL && d.n > 0;
  const first = d.n === 0;
  d.n++; d.maxL = Math.max(d.maxL, F.L); d.maxKg = Math.max(d.maxKg, kg);
  G.money += value; G.earned += value; sfx('jingle');
  G.catches.unshift({ id: f.id, name: f.name, L: F.L, kg, value, spot: spot().name });
  G.catches = G.catches.slice(0, 40);
  const gain = Math.round(15 + value / 400 + (first ? 40 : 0) + (record ? 15 : 0)), L0 = levelOf(G.xp); G.xp += gain; const L1 = levelOf(G.xp);
  F.gain = gain;
  if (L1 > L0) { const ns = SPOTS.filter(s => s.lv > L0 && s.lv <= L1); setTimeout(() => say('레벨 업! Lv.' + L1 + (ns.length ? ' · 새 포인트: ' + ns.map(s => s.name).join(', ') : ''), 4200), 3800); }
  showResult({ f, L: F.L, kg, value, first, record, gain });
  save();
}

/* ================= 밑밥 · 미끼 ================= */
function chooseBait(id) {
  if (G.mode !== 'idle') return;
  const b = BAITS.find(x => x.id === id);
  if (G.baited && G.baitId === id) return;
  if (G.money < b.price) return say('돈이 모자라요');
  G.money -= b.price; G.baitId = id; G.baited = true; save();
}
/* 밑밥 배합 → 어종별 반응 배수 */
function chumMix(r) {
  const T = CHUM_ING.reduce((a, g) => a + (r[g.id] || 0), 0), out = { T, cost: 0, dur: 0, mul: {}, warn: '' };
  for (const g of CHUM_ING) out.cost += (r[g.id] || 0) * g.price;
  if (!T) return out;
  const k = r.krill || 0, b = r.bread || 0, pw = (r.pgam || 0) + (r.pbeng || 0);
  const str = Math.min(1.3, .5 + T * .16), dur = 30 + T * 7 + b * 4;
  let adj = 1;
  if (pw / T > .6 && (k + b) / T < .4) { adj *= .7; out.warn = '파우더만 많으면 뭉쳐서 잘 퍼지지 않아요'; }
  if (k >= 1 && b >= 1 && pw >= 1) adj *= 1.1;
  out.dur = Math.round(dur);
  for (const f of FISH) {
    let sum = k * ((f.chum - 1) * .5 + .15) + b * CHUM_BONUS.bread[f.id] + (r.pgam || 0) * CHUM_BONUS.pgam[f.id] + (r.pbeng || 0) * CHUM_BONUS.pbeng[f.id];
    out.mul[f.id] = Math.round((1 + str * sum / T * adj) * 100) / 100;
  }
  return out;
}
function throwChum() {
  if (G.mode === 'casting' || G.mode === 'fight' || G.mode === 'flying') return;
  const m = chumMix(G.recipe);
  if (!m.T) return say('밑밥 재료를 먼저 담아주세요');
  if (G.money < m.cost) return say('돈이 모자라요');
  G.money -= m.cost; G.chum = G.chumMax = m.dur; G.chumMul = m.mul; say('밑밥을 뿌렸어요 · 효과 ' + m.dur + '초'); save();
}

/* ================= 프레임 갱신 ================= */
function addRipple(x, scale) { G.ripples.push({ x, t: 0, dur: 1.2, s: scale || 1 }); }
function update(dt) {
  G.t += dt; G.min = (G.min + dt * TS) % 1440;
  { const tg = tideTarget(), d = tg - (G.tide || 0); G.tide = Math.abs(d) > .8 ? tg : (G.tide || 0) + Math.max(-.02 * dt, Math.min(.02 * dt, d)); }   // 수위는 천천히만 변함
  G.wxTimer += dt * TS;
  if (G.wxTimer > 180) { G.wxTimer = 0; if (Math.random() < .25) G.wx = pickWx(); }
  if (G.chum > 0) G.chum = Math.max(0, G.chum - dt);
  G.ripples = G.ripples.filter(r => (r.t += dt) < r.dur);
  if (G.retr && (G.retr.t += dt) > .55) G.retr = null;
  const T = tideInfo();

  if (G.mode === 'casting') {
    const c = G.cast; c.pos += c.dir * c.speed * dt;
    if (c.pos >= 1) { c.pos = 1; c.dir = -1; } else if (c.pos <= 0) { c.pos = 0; c.dir = 1; }
  } else if (G.mode === 'flying') {
    const f = G.fly; f.t += dt;
    if (!f.landed && f.t >= f.rel + f.air) {
      f.landed = true; G.floatX = f.x1;
      say(f.nice ? '포인트에 안착! 입질이 좋아져요' : '캐스팅 완료');
    }
    if (f.t >= f.dur) { G.fly = null; G.mode = 'waiting'; G.cool = 2.2; addRipple(G.floatX, 1); }
  } else if (G.mode === 'waiting') {
    G.sink = Math.sin(G.t * 1.6) * .03 + .04;
    G.floatX = Math.min(.92, Math.max(.3, G.floatX + (T.rising ? -1 : 1) * T.flow * spot().flow * .002 * dt));
    G.cool -= dt;
    if (G.cool <= 0) {
      const c = candidates(), R = biteRate(c);
      if (R > 0 && Math.random() < 1 - Math.exp(-R * dt)) startBite(pickWeighted(c));
    }
  } else if (G.mode === 'bite') {
    const B = G.bite; B.t += dt;
    G.sink = biteSink(B);
    if (!B.rippled && B.t >= B.nib) { B.rippled = true; addRipple(G.floatX, .7); }
    if (B.f.thief) {
      if (B.t >= B.nib) { say('복어가 미끼를 뜯어갔어요'); endBite(true); }
    } else if (B.t >= B.end) {
      say('놓쳤어요. 너무 늦었네요'); endBite(Math.random() < .65);
    }
  } else if (G.mode === 'fight') {
    const res = fightStep(G.fight, G.reeling, dt);
    G.sink = 0;
    if (res) finishFight(res);
  } else {
    G.sink = 0;
  }
}

/* ================= 장면 구성: 게임 상태 → 3D 장면 ================= */
const DEG = Math.PI / 180, TARGET_X = 1.5, ROD_L = 2.7;
const zOfX = x1 => 8 + (x1 - .36) / .5 * 16;               // 게임 가로 위치(0.3~0.92) → 바다 쪽 거리(m)
const zOfPos = p => 8 + p * 16;                              // 캐스팅 미터(0~1) → 거리(m)
const SC = {
  view: '', A: null, flt: null, hook: null, lineMesh: null, leader: null, amb: [], ambSpot: -1, pool: {}, curFish: null, curFishId: '',
  rope: null, ropeLen: 1, drops: [], rings: [], trail: [], tipTrail: [], launch: null, lx: TARGET_X, landed: false, spin: 0, swung: false,
  shake: 0, fpos: [0, 0, 0], fkind: 'hang', fade: 0, snap: null, lastMode: 'idle', rodPts: null, glowOn: false, bobT: 0, camMode: 'cast', sideW: 24
};
const A3 = { th: 28 * DEG, v: 0, lean: .1, lv: 0, bend: .06, bv: 0 };
const R_N = 36;

function sceneInit(cv) {
  if (!glInit(cv)) return false;
  buildPrograms(); buildOcean(); buildShadow(); buildPoints(); resizeGL();
  SC.A = buildAngler(); SC.flt = buildFloats(); SC.hook = buildHook();
  SC.lineMesh = mkMesh(tubeGeo(R_N, 5), true); SC.leader = mkMesh(tubeGeo(16, 5), true);
  return true;
}

/* ----- 낚시꾼 자세 ----- */
function stepAngler3(dt) {
  const sp = (k, vk, tg, h, kk, cc) => { A3[vk] += (kk * (tg - A3[k]) - cc * A3[vk]) * h; A3[k] += A3[vk] * h; };
  const m = G.mode;
  if (m === 'flying' && G.fly.t < G.fly.swing) {
    const t = G.fly.t / G.fly.swing, e = Math.pow(t, 1.8), de = 1.8 * Math.pow(Math.max(t, .001), .8) / G.fly.swing;
    A3.th = (-42 + 112 * e) * DEG; A3.v = 112 * DEG * de * .5; A3.lean = -.85 + 1.5 * e; A3.lv = 1.5 * de * .5;
    A3.bend = -.9 * Math.sin(Math.PI * Math.min(1, t * .95)); A3.bv = 0; SC.swung = true; return;
  }
  if (SC.swung) { SC.swung = false; A3.bv = 8; }
  let tg;
  if (m === 'casting') tg = { th: -44 * DEG + Math.sin(G.t * 6) * 1.6 * DEG, lean: -.85 - .15 * G.cast.pos, bend: -.16 };
  else if (m === 'fight') { const F = G.fight; tg = { th: (38 - F.tension * 10) * DEG, lean: -.2 * F.tension - (F.run ? .22 : 0), bend: .12 + F.tension * .85 }; }
  else if (m === 'bite') tg = { th: 36 * DEG, lean: .1, bend: .08 + clamp(G.sink, 0, 1.6) * .3 };
  else if (m === 'waiting') tg = { th: 36 * DEG, lean: .1, bend: .08 };
  else tg = { th: 28 * DEG, lean: .1, bend: .06 };
  const n = Math.max(1, Math.ceil(dt / .016)), h = dt / n;
  for (let i = 0; i < n; i++) { sp('th', 'v', tg.th, h, 110, 13); sp('lean', 'lv', tg.lean, h, 90, 12); sp('bend', 'bv', tg.bend, h, 160, 9); }
}
function geom3(Ys) {
  { const lt = (G.mode === 'fight' && G.fight) ? G.fight.lat : 0; A3.lat = (A3.lat || 0) + (lt - (A3.lat || 0)) * .08; }
  const lat = A3.lat || 0, lean = A3.lean, th = A3.th, bend = A3.bend, G0 = [.13, Ys + 1.32, .42 + .28 * lean], d = [0, Math.cos(th), Math.sin(th)], tha = th + bend * .65;
  return {
    G0, lean, th, twist: -lat * .32, tip: [G0[0] + lat * (.2 + bend) * .85, G0[1] + Math.cos(tha) * ROD_L, G0[2] + Math.sin(tha) * ROD_L], ctrl: [G0[0] + lat * (.2 + bend) * .3, G0[1] + d[1] * ROD_L * .55, G0[2] + d[2] * ROD_L * .55],
    butt: [G0[0], G0[1] - d[1] * .38, G0[2] - d[2] * .38], hf: [.09, G0[1] + d[1] * .3, G0[2] + d[2] * .3], hr: [.15, G0[1] - d[1] * .1, G0[2] - d[2] * .1], d
  };
}

/* ----- 낚싯줄 (3D) ----- */
function ropeInit(a, b) {
  SC.rope = Array.from({ length: R_N }, (_, i) => {
    const u = i / (R_N - 1), x = b ? a[0] + (b[0] - a[0]) * u : a[0], y = b ? a[1] + (b[1] - a[1]) * u : a[1] - u * .9, z = b ? a[2] + (b[2] - a[2]) * u : a[2];
    return { x, y, z, px: x, py: y, pz: z };
  });
}
function ropeStep(dt, a, b, len, g, Ys) {
  const P = SC.rope, N = R_N, seg = len / (N - 1), subs = 4, h = dt / subs, hasB = !!b;
  for (let s = 0; s < subs; s++) {
    for (let i = 1; i < N; i++) {
      if (hasB && i === N - 1) continue;
      const p = P[i], vx = (p.x - p.px) * .996, vy = (p.y - p.py) * .996, vz = (p.z - p.pz) * .996;
      p.px = p.x; p.py = p.y; p.pz = p.z; p.x += vx; p.y += vy - g * h * h; p.z += vz;
    }
    const A = P[0]; A.x = A.px = a[0]; A.y = A.py = a[1]; A.z = A.pz = a[2];
    if (hasB) { const E = P[N - 1]; E.x = E.px = b[0]; E.y = E.py = b[1]; E.z = E.pz = b[2]; }
    for (let it = 0; it < 10; it++) for (let i = 0; i < N - 1; i++) {
      const p = P[i], q = P[i + 1], dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, d = Math.hypot(dx, dy, dz) || 1e-6, diff = (d - seg) / d;
      const wa = i === 0 ? 0 : 1, wb = (hasB && i + 1 === N - 1) ? 0 : 1, ws = wa + wb; if (!ws) continue;
      p.x += dx * diff * wa / ws; p.y += dy * diff * wa / ws; p.z += dz * diff * wa / ws; q.x -= dx * diff * wb / ws; q.y -= dy * diff * wb / ws; q.z -= dz * diff * wb / ws;
    }
    for (let i = 1; i < N; i++) {
      const p = P[i], wy = SC.view === 'side' ? 0 : waveH(p.x, p.z, ENV.time);
      if (p.z < 1.3 && p.z > -6 && p.x > -1.7 && p.x < 1.7 && p.y < Ys && p.y > Ys - .8) { p.y = Ys; p.py = p.y; }
      else if (p.y < wy) { p.y = wy; p.py = wy; p.px = p.x - (p.x - p.px) * .5; p.pz = p.z - (p.z - p.pz) * .5; }
    }
  }
}

/* ----- 파티클 · 링 ----- */
function splash(p, n, power) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = (.4 + Math.random() * 2.2) * (power || 1); SC.drops.push({ x: p[0], y: p[1], z: p[2], vx: Math.cos(a) * sp, vy: (3 + Math.random() * 5.5) * (power || 1), vz: Math.sin(a) * sp, life: 0, max: .7 + Math.random() * .5 }); }
}
function ringAdd(x, z, dur, rmax, delay, nice) { SC.rings.push({ x, z, t: 0, dur, rmax, delay: delay || 0, nice: !!nice }); }
function landing3(p, nice) { sfx('splash'); splash([p[0], waveH(p[0], p[2], ENV.time), p[2]], 34, 1); ringAdd(p[0], p[2], 1.5, 3.2, 0); ringAdd(p[0], p[2], 1.8, 4.6, .18); ringAdd(p[0], p[2], 1.3, 2, .36); if (nice) ringAdd(p[0], p[2], 1.1, 5.4, 0, true); SC.shake = .6; }

/* ----- 물고기 풀 ----- */
function fishFrom(id) { if (!SC.pool[id]) SC.pool[id] = fishNew(FISH.find(x => x.id === id)); return SC.pool[id]; }
function buildAmbient(si) {
  SC.amb = []; SC.ambSpot = si; const sp = SPOTS[si], list = FISH.filter(f => sp.mult[f.id] > 0 && !f.thief), R = rnd(si * 99 + 7), maxD = sp.depth;
  for (let i = 0; i < 14; i++) {
    const f = list[Math.floor(R() * list.length)], lo = Math.max(.8, f.depth[0]), hi = Math.min(maxD - .6, f.depth[1]); if (hi < lo) continue;
    const L = (f.size[0] + (f.size[1] - f.size[0]) * R() * .6) / 100 * 4.2, dir = R() < .5 ? 1 : -1;
    SC.amb.push({ fi: fishNew(f), x: (R() - .5) * 3.4, y: -(lo + R() * (hi - lo)), z: 2 + R() * 28, v: (.5 + R() * .9) * dir, ph: R() * 6, L, f });
  }
}

/* ----- 카메라 ----- */
function camTargets(Ys, kind, fpos) {
  if (kind === 'fly') return { pos: [fpos[0] * .8 + .3, fpos[1] + 2, fpos[2] - 5.2], tgt: fpos, fov: .8, rate: 11, look: true };
  if (kind === 'land') return { pos: [fpos[0] + .5, Math.max(2.4, fpos[1] + 2.3), fpos[2] - 5.4], tgt: [fpos[0], fpos[1] + .1, fpos[2]], fov: .72, rate: 2.4, look: true };
  if (SC.view === 'side') return sideCam(Ys);
  return { pos: [TARGET_X, Ys + 3.2, -6.8], tgt: [TARGET_X - .1, Ys - 1.1, 11], fov: .74, rate: 6 };
}
function sideCam(Ys) {
  const asp = CAMR.asp, sp = spot(), depthV = Math.min(sp.depth + G.tide, 14.6) + 1.4, top = Ys + 4.4;
  let width = SC.sideW; let Hs = width / asp; const need = top + depthV; if (Hs < need) { Hs = need; width = Hs * asp; }
  const z0 = -3.2, zc = z0 + width / 2, yc = top - Hs / 2, D = 70, fov = 2 * Math.atan(Hs / 2 / D);
  return { pos: [-D, yc + .5, zc], tgt: [0, yc, zc], fov, rate: 30 };
}

/* ----- 한 프레임 갱신 ----- */
function sceneStep(dt) {
  resizeGL();
  const m = G.mode, f = G.fly, t = G.t, si = spotIdx(), Ys = SPOTS[si].stand - G.tide, sp = SPOTS[si];
  const kindView = (m === 'idle' || m === 'casting' || m === 'flying') ? '3d' : 'side';
  if (kindView !== SC.view) {
    if (SC.view) { if (!SC.snap) SC.snap = document.getElementById('fade'); SC.snap.width = GLC.width; SC.snap.height = GLC.height; SC.snap.getContext('2d').drawImage(GLC, 0, 0); SC.fade = .45; }
    SC.view = kindView; SC.rope = null; SC.trail = []; SC.launch = null; SC.landed = false; SC.camSnap = true;
    if (kindView === '3d') { SC.drops = []; SC.rings = []; }
  }
  if (MODELS.spotIdx !== si) { ensureSpot(si); }
  if (SC.outKey !== outfitKey()) applyOutfit();
  if (SCN.spotIdx !== si) buildScenery(si);
  if (DIO.spotIdx !== si) { buildDiorama(si, sp.depth); }
  if (SC.ambSpot !== si) buildAmbient(si);
  ENV.time = t; updateEnv((G.min / 60) % 24, G.wx, t); shadowUpdate();
  stepAngler3(dt);
  const g3 = geom3(Ys), tip = g3.tip, hangLen = 1;
  let pin = null, tgtLen = hangLen, kind = 'hang', fpos = null;
  const zL = f ? zOfX(f.x1) : 0;

  if (m === 'flying' && f.t >= f.rel) {
    const pe = SC.rope ? SC.rope[R_N - 1] : { x: tip[0], y: tip[1] - hangLen, z: tip[2] };
    if (!SC.launch) { SC.launch = [pe.x, pe.y, pe.z]; SC.trail = []; SC.landed = false; SC.lx = TARGET_X + (Math.random() - .5); }
    const u = Math.min(1, (f.t - f.rel) / f.air), L0 = SC.launch;
    if (u < 1) { const arc = 2.4 + .2 * Math.max(0, zL - L0[2]); fpos = [L0[0] + (SC.lx - L0[0]) * u, L0[1] * (1 - u) + arc * 4 * u * (1 - u), L0[2] + (zL - L0[2]) * u]; kind = 'fly'; }
    else { const k = f.t - f.rel - f.air; fpos = [SC.lx, waveH(SC.lx, zL, t) + Math.sin(k * 7) * .05 * Math.exp(-k * 3.2), zL]; kind = 'land'; if (!SC.landed) { SC.landed = true; landing3(fpos, f.nice); } }
    pin = fpos; tgtLen = Math.hypot(pin[0] - tip[0], pin[1] - tip[1], pin[2] - tip[2]) * 1.04 + .8;
  } else if (m === 'idle' && G.retr) {
    const u = Math.min(1, G.retr.t / .55), e = 1 - Math.pow(1 - u, 2), z0 = zOfX(G.retr.x), hy = tip[1] - hangLen;
    pin = [SC.lx * (1 - e) + tip[0] * e, hy * e + Math.sin(Math.PI * e) * 2, z0 + (tip[2] - z0) * e]; fpos = pin; kind = 'retr'; tgtLen = Math.hypot(pin[0] - tip[0], pin[1] - tip[1], pin[2] - tip[2]) * 1.05 + .8;
  } else if (m === 'waiting' || m === 'bite') {
    const z = zOfX(G.floatX); fpos = [SC.lx, waveH(SC.lx, z, t) + .02, z]; pin = fpos; kind = 'water';
    tgtLen = Math.hypot(pin[0] - tip[0], pin[1] - tip[1], pin[2] - tip[2]) * 1.025 + .5;
  } else if (m === 'fight') {
    const F = G.fight, d = clamp(F.dist, 0, 1), zs = zOfX(F.x0), z = 1.6 + (zs - 1.6) * d; const th = F.thr || 0, fx = SC.lx + F.lat * (.8 + 5.5 * d) + (Math.sin(t * 12.3) * .16 + Math.sin(t * 5.1) * .1) * th, zz = z + Math.cos(t * 9.1) * .1 * th; fpos = [fx, waveH(fx, zz, t) + .02, zz]; pin = fpos; kind = 'fight';
    if (F.evt) { if (F.evt !== 'turn') { splash(fpos, F.evt === 'shake' ? 18 : 10, .7); ringAdd(fpos[0], fpos[2], 1.1, F.evt === 'shake' ? 3 : 2.2, 0); sfx('splash', false); } F.evt = null; }
    tgtLen = Math.hypot(pin[0] - tip[0], pin[1] - tip[1], pin[2] - tip[2]) * (1 + (1 - clamp(F.tension, 0, 1)) * .09) + .3;
  }
  if (m !== 'flying') { SC.launch = null; SC.landed = false; }
  if (kind === 'hang' || kind === 'retr') SC.trail = [];
  SC.fkind = kind; SC.fpos = fpos || [0, 0, 0];

  if (!SC.rope) { ropeInit(tip, pin); SC.ropeLen = tgtLen; }
  SC.ropeLen += (tgtLen - SC.ropeLen) * Math.min(1, dt * (kind === 'fly' ? 20 : 8));
  ropeStep(dt, tip, pin, SC.ropeLen, 16, Ys);

  /* 카메라 */
  const T = camTargets(Ys, kind, fpos), k = Math.min(1, T.rate * dt);
  if (SC.camSnap) { CAMR.pos = T.pos.slice(); CAMR.tgt = T.tgt.slice(); CAMR.fov = T.fov; SC.camSnap = false; }
  else {
    for (let i = 0; i < 3; i++) { CAMR.pos[i] += (T.pos[i] - CAMR.pos[i]) * k; CAMR.tgt[i] += (T.tgt[i] - CAMR.tgt[i]) * (T.look ? Math.min(1, 14 * dt) : k); }
    CAMR.fov += (T.fov - CAMR.fov) * k;
  }
  if (SC.shake > .01) { SC.shake *= Math.pow(.02, dt); }
  CAMR.far = SC.view === 'side' ? 400 : 4000; camUpdate();

  /* 효과 갱신 */
  SC.rings = SC.rings.filter(r => (r.t += dt) < r.delay + r.dur);
  SC.drops = SC.drops.filter(d => { d.life += dt; d.vy -= 14 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; return d.life < d.max && d.y > -.1; });
  if (SC.fade > 0) SC.fade -= dt;
  /* 입질 이펙트 */
  SC.biteFx = 0; SC.biteBig = false;
  if (m === 'bite' && G.bite && fpos) {
    const B = G.bite, big = B.t >= B.nib, vis = FT().vis; SC.biteBig = big; SC.biteFx = big ? 1 : .55;
    SC.biteAcc = (SC.biteAcc || 0) - dt;
    if (SC.biteAcc <= 0) { sfx('bite', big); SC.biteAcc = big ? .24 : .34; ringAdd(fpos[0], fpos[2], big ? 1.1 : .8, (big ? 2.4 : 1.1) * Math.min(1.4, .6 + vis * .5), 0, big); splash([fpos[0], fpos[1], fpos[2]], big ? 8 : 3, big ? .8 : .4); }
  } else SC.biteAcc = 0;
  if (FX && FX.last === 'bite' && m === 'fight') splash(SC.fpos, 14, .7);
  FX.last = m;
  SC.g3 = g3; SC.Ys = Ys; SC.si = si;
  /* 물고기 */
  if (SC.view === 'side') {
    for (const a of SC.amb) { a.z += a.v * dt; if (a.z > 36) { a.v = -Math.abs(a.v); } if (a.z < -4) { a.v = Math.abs(a.v); } }
  }
  if (m === 'bite' && G.bite) { if (SC.curFishId !== G.bite.f.id) { SC.curFishId = G.bite.f.id; SC.curFish = fishFrom(G.bite.f.id); } }
  if (m === 'fight') { const id = G.fight.f.id; if (SC.curFishId !== id) { SC.curFishId = id; SC.curFish = fishFrom(id); } }
}
const FX = { last: 'idle' };

/* ================= 장면 그리기 ================= */
function sceneFx(dt) {
  if (SC.fkind === 'fly') { for (let i = 0; i < 2; i++) SC.trail.push({ p: SC.fpos.slice(), life: 0, max: .5 + Math.random() * .3, o: [(Math.random() - .5) * .15, (Math.random() - .5) * .15, 0] }); }
  SC.trail = SC.trail.filter(t => (t.life += dt) < t.max);
}
function drawSpotAndAngler() {
  const TM = M4.trs([0, -G.tide, 0], [0, 0, 0]);
  for (const s of MODELS.spot) drawMesh(s.mesh, TM, Object.assign({ detail: 1 }, s.opts || {}));
  drawAngler(SC.A, SC.g3, SC.Ys, 0);
  rodFill(SC.A, SC.g3); meshUpload(SC.A.rod);
  drawMesh(SC.A.rod, M4.I(), { spec: .5, rim: .2 });
  const g = SC.g3, d = g.d;
  drawMesh(SC.A.reel, M4.trs([g.G0[0] + .03, g.G0[1] + d[1] * .08, g.G0[2] + d[2] * .08], [g.th - Math.PI / 2 * 0 + 0, 0, 0]), { spec: .6, tint: (c => { const m = Math.max(...c); return c.map(v => .35 + .65 * v / m); })(reelItem().c) });
  drawMesh(SC.A.grip, M4.seg([g.G0[0], g.G0[1] - d[1] * .32, g.G0[2] - d[2] * .32], [g.G0[0], g.G0[1] + d[1] * .42, g.G0[2] + d[2] * .42], .03), { spec: .05 });
}
function fishMatrix(p, L, yaw, pitch, roll) { return M4.trs(p, [pitch || 0, yaw, roll || 0], [L, L, L]); }
function hookPoint() {
  const m = G.mode, z = SC.fpos[2], x = SC.fpos[0], dep = Math.min(rigDepth(), -bedY(z, spot().depth, SC.si) + G.tide - .25);
  const sway = Math.sin(G.t * .7) * .05;
  if (m === 'fight' && G.fight) { const F = G.fight, d = clamp(F.dist, 0, 1), th = F.thr || 0, tt = G.t; return [x + (Math.sin(tt * 13.1) * .14 + Math.sin(tt * 6.7) * .1) * th, -(.5 + (dep - .5) * (.3 + .7 * d) * (1 - F.tension * .3)) + Math.sin(tt * 9) * .1 * th + Math.sin(tt * 4.3) * .08 * th, z + Math.cos(tt * 10.7) * .12 * th]; }
  return [x + sway, -dep, z + .15];
}
function sceneRender() {
  resizeGL(); const W = GLC.width, H = GLC.height, side = SC.view === 'side', t = G.t;
  /* 그림자 패스 */
  if (SH.on && !side) {
    RS.depthPass = true; gl.bindFramebuffer(gl.FRAMEBUFFER, SH.fbo); gl.viewport(0, 0, SH.size, SH.size); gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
    gl.colorMask(false, false, false, false); gl.useProgram(PR.depth.p); gl.uniformMatrix4fv(PR.depth.u.uLightVP, false, SH.vp);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4); drawSpotAndAngler(); gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true); RS.depthPass = false;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
  drawSky();
  const hook = hookPoint(), fp = SC.fpos, kind = SC.fkind;
  if (side) {
    gl.disable(gl.CULL_FACE);
    gl.useProgram(PR.wall.p); applyEnv(PR.wall, CAMR.pos); gl.uniformMatrix4fv(PR.wall.u.uVP, false, CAMR.vp); gl.uniform1f(PR.wall.u.uSeabed, effDepth() + 1); gl.bindVertexArray(DIO.wallVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    /* 수중 불투명 */
    beginLit(false, true);
    const TM = M4.trs([0, -G.tide, 0], [0, 0, 0]); drawMesh(DIO.bed, TM, {}); drawMesh(DIO.skirt, TM, {}); drawMesh(DIO.rocks, TM, { spec: .05 });
    for (const k of DIO.kelp) drawMesh(k.mesh, M4.trs([k.pos[0], k.pos[1] - G.tide, k.pos[2]], [0, 0, 0]), { sway: .3, swayH: k.h, phase: k.phase });
    for (const a of SC.amb) {
      const yaw = a.v > 0 ? 0 : Math.PI, wob = Math.sin(t * 1.3 + a.ph) * .15; fishPose(a.fi, t, .05, 5.5, a.ph, 0);
      drawMesh(a.fi.mesh, fishMatrix([a.x, a.y * (1 + G.tide / spot().depth) + wob * .2, a.z], a.L, yaw, wob * .2), { spec: .35, rim: .15 });
    }
    if ((G.mode === 'bite' || G.mode === 'fight') && SC.curFish) {
      const fi = SC.curFish, f = fi.f; let L, yaw, c, pitch = 0, amp = .06, fr = 5;
      let roll = 0, bendF = 0;
      if (G.mode === 'fight') { const F = G.fight, th = F.thr || 0; L = F.L / 100 * 4.2; yaw = (F.run ? 0 : Math.PI) + F.lat * .35 + Math.sin(t * 11.5) * .45 * th * th + Math.sin(t * 6.1) * .2 * th; amp = .08 + F.tension * .1 + th * .16; fr = 7 + F.tension * 6 + th * 9; pitch = (F.run ? -.2 : .3) + Math.sin(t * 8.3) * .3 * th; roll = Math.sin(t * 14) * .55 * th * th + Math.sin(t * 5.3) * .25 * th; bendF = Math.sin(t * 15.5) * .55 * th * th; c = [hook[0], hook[1], hook[2] - Math.cos(yaw) * .5 * L * .92]; }
      else { const B = G.bite; L = (f.size[0] + f.size[1]) / 200 * 4.2; yaw = Math.PI; const nib = B.t < B.nib; c = [hook[0], hook[1] + (nib ? Math.sin(t * 7) * .06 : 0), hook[2] + .5 * L * .95 + (nib ? .15 + .25 * Math.abs(Math.sin(t * 5)) : 0)]; amp = .05; }
      fishPose(fi, t, amp, fr, 0, G.mode === 'fight' ? Math.sin(t * 8) * G.fight.tension * .12 + bendF : 0);
      drawMesh(fi.mesh, fishMatrix(c, L, yaw, pitch, roll), { spec: .4, rim: .2 });
    }
    drawSpotAndAngler(); drawOcean(true);
  } else { drawOcean(false); gl.disable(gl.CULL_FACE); beginLit(true, false); drawSpotAndAngler(); drawScenery(t); }
  /* 찌 · 줄 */
  beginLit(!side, side && false);
  const R = SC.rope; if (R) { tubeFill(SC.lineMesh, R.map(p => [p.x, p.y, p.z]), side ? .02 : .0075, 5, () => [.92, .95, .9]); drawMesh(SC.lineMesh, M4.I(), { emis: .35, spec: .2 }); }
  if (kind !== 'hang' && fp) {
    const FF = kind === 'fight' && G.fight ? G.fight : null, sink = (kind === 'water' || kind === 'bite') ? clamp(G.sink, 0, 1.6) : 0, inWater = kind === 'water' || kind === 'fight' || kind === 'land';
    const fk = floatKey(), vis = FT().vis, sc = side ? 2.2 : 1, depthK = fk === 'hole' ? .09 : fk === 'self' ? .2 : .3;
    let fy = fp[1] - (inWater ? depthK * sc + sink * .32 * vis * sc + (FF ? (FF.fsink || 0) * .75 * sc : 0) : 0); const tilt = kind === 'fly' ? Math.sin(t * 20) * .3 : 0;
    const lie = FF ? clamp(FF.tension * 1.3, 0, 1.2) + Math.sin(t * 13) * .12 * (FF.thr || 0) : 0;
    drawMesh(SC.flt[fk], M4.trs([fp[0], fy, fp[2]], [kind === 'fly' ? .6 : tilt * .1 + lie, 0, 0], [sc, sc, sc]), { spec: .5, rim: .2, emis: .12 });
    if (kind === 'water' || kind === 'fight') {
      const th = FF ? FF.thr || 0 : 0, slk = FF ? 1 - clamp(FF.tension, 0, 1) : .4, ly = []; for (let i = 0; i < 16; i++) { const u = i / 15, wob = Math.sin(t * 14 - u * 6) * .07 * th * Math.sin(Math.PI * u); ly.push([fp[0] + (hook[0] - fp[0]) * u + wob, fy + (hook[1] - fy) * u - Math.sin(Math.PI * u) * .12 * slk * slk, fp[2] + (hook[2] - fp[2]) * u + Math.sin(u * 3) * .12 * (1 - u) * slk + wob * .6]); }
      if (side) { tubeFill(SC.leader, ly, .012, 5, () => [.85, .9, .88]); drawMesh(SC.leader, M4.I(), { emis: .4 }); drawMesh(SC.hook, M4.trs(hook, [0, 0, 0], [.7, .7, .7]), { spec: .6, emis: .2 }); }
    }
  }
  /* 포물선 타깃 링 (캐스팅) */
  if (!side && G.mode === 'casting') {
    const c = G.cast, zc = zOfPos((c.zone[0] + c.zone[1]) / 2), zr = (c.zone[1] - c.zone[0]) / 2 * 16, y = waveH(TARGET_X, zc, t) + .12, pul = .5 + .5 * Math.sin(t * 5);
    drawRing(TARGET_X, y, zc, zr * 1.05, [1, .92, .35, .9], .1); drawRing(TARGET_X, y, zc, zr * .66, [.5, 1, .55, .9], .1); drawRing(TARGET_X, y, zc, zr * .3, [1, 1, 1, .8 * (.5 + .5 * pul)], .14);
    const zp = zOfPos(c.pos); drawRing(TARGET_X, waveH(TARGET_X, zp, t) + .12, zp, 1.1, [1, .5, .25, .95], .22);
  }
  for (const r of SC.rings) { const p = (r.t - r.delay) / r.dur; if (p < 0) continue; const e = 1 - Math.pow(1 - p, 2); drawRing(r.x, waveH(r.x, r.z, t) + .09, r.z, r.rmax * e, r.nice ? [1, .85, .3, (1 - p) * .9] : [1, 1, 1, (1 - p) * .55], .07 + .1 * (1 - p)); }
  if (G.mode === 'waiting' || G.mode === 'bite') for (const r of G.ripples) { const p = r.t / r.dur; if (p < 1) drawRing(SC.lx, waveH(SC.lx, fp[2], t) + .09, fp[2], (.3 + 2.6 * p) * r.s, [1, 1, 1, (1 - p) * .6], .09); }
  /* 입질 신호: 수면 물방울 */
  /* 파티클 */
  for (const d of SC.drops) { const a = 1 - d.life / d.max; pt(d.x, d.y, d.z, .85, .95, 1, a * .9, .09 + .05 * a); }
  for (const tr of SC.trail) { const a = 1 - tr.life / tr.max; pt(tr.p[0] + tr.o[0], tr.p[1] + tr.o[1], tr.p[2], 1, .95, .7, a * .8, .11 * a + .03); }
  if (side && G.chum > 0 && fp) { const fade = Math.min(1, G.chum / 6); for (let i = 0; i < 46; i++) { const ph = (t * (.25 + (i % 6) * .05) + i * .37) % 1, g = CHUM_ING[i % 4], c = hex(g.col); pt(fp[0] - 1 + (i * .53 % 2), -ph * (effDepth() * .5) - .2, fp[2] - 3 + (i * 1.9 % 6) + Math.sin(t + i) * .3, c[0], c[1], c[2], .8 * fade * (1 - ph * .6), .12); } }
  if (side) { for (let i = 0; i < 40; i++) { const z = 2 + (i * 7.3 + t * (.3 + (i % 5) * .08)) % 32, y = -((i * 3.7 + t * .5) % (effDepth() - 1)) - .4; pt(-3.5 + (i * 1.7 % 7), y, z, .8, .95, .95, .25, .05); } }
  if (SC.biteFx && fp) { const k = SC.biteFx, pu = .55 + .45 * Math.sin(t * 18); pt(fp[0], fp[1] + .1, fp[2], 1, SC.biteBig ? .75 : .9, SC.biteBig ? .2 : .55, .75 * k * pu, (side ? 1.6 : .9) * k * FT().vis * .9 + .3); flushPoints(true, .6); }
  flushPoints(false, .3);
  /* 단면 유리 · 벽 */
  if (side) {
    gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(PR.glass.p); applyEnv(PR.glass, CAMR.pos); gl.uniformMatrix4fv(PR.glass.u.uVP, false, CAMR.vp); gl.bindVertexArray(DIO.glass.vao); gl.drawElements(gl.TRIANGLES, DIO.glass.n, gl.UNSIGNED_INT, 0);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
}

/* ================= 수평선 풍경: 섬 · 선박 (포인트별) ================= */
/* 실제 해도(GIS) 데이터가 아니라, 각 해역의 지리를 바탕으로 한 근사 배치입니다.
   islands: [옆으로 떨어진 거리(m, +오른쪽), 앞쪽 거리(m), 반폭, 높이, 모양]   ships: 자주 다니는 배의 종류별 수 */
const SCENE = {
  sacheon:   { islands: [], ships: { fish: 3, cargo: 1 } },
  sinjin:    { islands: [[260, 420, 90, 38, 'round'], [-380, 800, 60, 26, 'round'], [150, 960, 45, 20, 'round']], ships: { fish: 4, cargo: 1 } },
  guryongpo: { islands: [], ships: { fish: 4, cargo: 2, anch: 1 } },
  samdeok:   { islands: [[-300, 520, 150, 60, 'ridge'], [180, 380, 70, 35, 'round'], [420, 800, 200, 80, 'ridge'], [-120, 900, 120, 50, 'round']], ships: { fish: 3, ferry: 1 } },
  daepo:     { islands: [[-380, 640, 110, 50, 'ridge'], [300, 900, 160, 70, 'ridge']], ships: { cargo: 2, tanker: 1, fish: 2 } },
  imwon:     { islands: [], ships: { fish: 3, tanker: 1 } },
  ando:      { islands: [[-240, 460, 90, 40, 'round'], [200, 620, 140, 60, 'ridge'], [420, 900, 100, 45, 'round'], [-450, 880, 170, 70, 'ridge'], [40, 980, 60, 28, 'round']], ships: { cargo: 3, tanker: 1, ferry: 1, fish: 2 } },
  hupo:      { islands: [], ships: { fish: 3 } },
  mijo:      { islands: [[260, 430, 60, 28, 'round'], [-300, 700, 120, 55, 'ridge'], [460, 900, 180, 75, 'ridge']], ships: { fish: 3, cargo: 1 } },
  seogwipo:  { islands: [[230, 340, 70, 70, 'round'], [-130, 520, 90, 55, 'round'], [420, 520, 50, 60, 'stack']], ships: { fish: 4, tanker: 1 } },
  gadeok:    { islands: [[-420, 700, 150, 60, 'ridge']], ships: { cargo: 5, anch: 2, tanker: 1, fish: 1, ferry: 1 } },
  yeongil:   { islands: [], ships: { cargo: 4, anch: 2, tanker: 1, fish: 2 } },
  geomun:    { islands: [[-200, 400, 110, 70, 'ridge'], [330, 360, 90, 55, 'ridge'], [480, 900, 70, 60, 'stack']], ships: { ferry: 1, fish: 3 } },
  chuja:     { islands: [[250, 380, 120, 75, 'ridge'], [-330, 640, 90, 50, 'round'], [100, 950, 60, 30, 'round']], ships: { fish: 4, ferry: 1 } },
  hongdo:    { islands: [[-300, 380, 110, 85, 'stack'], [200, 420, 60, 70, 'stack'], [400, 620, 90, 70, 'ridge'], [-450, 980, 160, 90, 'ridge']], ships: { ferry: 1, fish: 3 } }
};
const SCN = { spotIdx: -1, islands: [], ships: [], types: null };

function islandCol(seed) {
  return (p, n) => {
    const v = .85 + noise3(p[0] * .05, p[1] * .08, p[2] * .05) * .3, up = smooth(.35, .8, n[1]), hy = smooth(2, 18, p[1]);
    let c = cmix([.36 * v, .34 * v, .31 * v], [.17 * v, .33 * v, .15 * v], clamp(up * hy * 1.2, 0, 1));
    return p[1] < 3 ? cmix(c, [.2, .2, .2], .5) : c;
  };
}
function buildIsland(d, seed) {
  const [dx, dz, w, h, style] = d, g = Geo(), cf = islandCol(seed), R = rnd(seed + 5);
  if (style === 'stack') {
    for (let i = 0; i < 3; i++) gBlob(g, [dx + (R() - .5) * w * 1.2, 0, dz + (R() - .5) * w * .5], [w * (.25 + R() * .2), h * (.6 + R() * .5), w * (.2 + R() * .15)], seed + i * 7, cf, 12, 9);
  } else if (style === 'ridge') {
    gBlob(g, [dx, 0, dz], [w, h, w * .55], seed, cf, 22, 12); gBlob(g, [dx - w * .55, 0, dz + 6], [w * .5, h * .7, w * .4], seed + 3, cf, 16, 9); gBlob(g, [dx + w * .6, 0, dz - 5], [w * .45, h * .55, w * .35], seed + 9, cf, 16, 9);
  } else { gBlob(g, [dx, 0, dz], [w, h, w * .8], seed, cf, 20, 11); gBlob(g, [dx + w * .5, 0, dz + 5], [w * .4, h * .5, w * .35], seed + 4, cf, 12, 8); }
  return mkMesh(g, false);
}
function buildShipTypes() {
  const T = {}, box = (g, c, s, col) => gBox(g, c, s, col);
  const cargo = (hull, boxes) => {
    const g = Geo(); box(g, [0, 4, -8], [20, 8, 104], hull); box(g, [0, 4, 52], [15, 8, 12], hull); box(g, [0, 4, 61], [8, 8, 8], hull); box(g, [0, 8.1, -8], [20, .3, 104], [.18, .18, .2]);
    box(g, [0, 17, -56], [17, 18, 14], [.93, .93, .9]); box(g, [0, 28, -56], [13, 4, 10], [.9, .9, .88]); box(g, [0, 31, -56], [12, 1, 9], [.2, .22, .25]); box(g, [4, 31, -62], [3, 6, 3], hull);
    const R = rnd(boxes); const cc = [[.85, .3, .2], [.2, .45, .75], [.9, .75, .2], [.25, .6, .4], [.7, .7, .72], [.55, .25, .2]];
    for (let z = -44; z < 46; z += 8.4) for (const x of [-5.4, 0, 5.4]) { const n = 1 + Math.floor(R() * 3); for (let y = 0; y < n; y++) box(g, [x, 9.7 + y * 2.9, z], [5, 2.8, 8], cc[Math.floor(R() * cc.length)]); }
    return g;
  };
  T.cargoA = mkMesh(cargo([.62, .16, .13], 3), false); T.cargoB = mkMesh(cargo([.12, .2, .38], 8), false);
  const tg = Geo(); box(tg, [0, 4.5, -8], [24, 9, 118], [.14, .14, .16]); box(tg, [0, 3.5, -8], [24.2, 7, 118.2], [.5, .14, .12]); box(tg, [0, 4.5, 58], [16, 9, 14], [.14, .14, .16]);
  box(tg, [0, 9.5, -8], [24, .4, 118], [.3, .3, .32]); box(tg, [0, 17, -60], [20, 16, 14], [.93, .93, .9]); box(tg, [0, 27, -60], [16, 4, 10], [.9, .9, .88]); box(tg, [0, 11, -6], [1.2, 1.4, 90], [.7, .7, .7]);
  for (let z = -45; z < 40; z += 16) { gCyl(tg, [0, 9.7, z], [0, 11.2, z], 5, 4.2, [.35, .35, .38], 8, true); } T.tanker = mkMesh(tg, false);
  const fish = (hc) => { const g = Geo(); box(g, [0, 1.2, 0], [6, 2.4, 20], hc); box(g, [0, 1.2, 11], [4.2, 2.4, 4], hc); box(g, [0, 1.2, 14], [2, 2.4, 3], hc); box(g, [0, 1.25, -1], [6.1, .3, 20.1], [.15, .15, .18]);
    box(g, [0, 4.2, -3], [4.4, 3.6, 6.5], [.95, .95, .92]); box(g, [0, 6.2, -3], [4.6, .5, 6.8], [.2, .2, .22]); gCyl(g, [0, 5, -7.5], [0, 12, -7.5], .22, .15, [.7, .7, .7], 6, true); gCyl(g, [0, 5, 6], [0, 11, 6], .15, .1, [.7, .7, .7], 6, true); gCyl(g, [0, 10, -7.5], [0, 10, 6], .06, .06, [.7, .7, .7], 4, true); return g; };
  T.fishA = mkMesh(fish([.15, .35, .6]), false); T.fishB = mkMesh(fish([.85, .85, .82]), false);
  const fg = Geo(); box(fg, [0, 3, 0], [14, 6, 58], [.95, .95, .95]); box(fg, [0, 3.2, 0], [14.2, 1.2, 58.2], [.15, .35, .7]); box(fg, [0, 6.2, 56 - 28], [10, 3, 12], [.9, .9, .92]); box(fg, [0, 8, -2], [12, 4, 38], [.96, .96, .96]); box(fg, [0, 11, -4], [10, 3, 26], [.95, .95, .95]); box(fg, [0, 11.5, 14], [8, 2.6, 6], [.2, .25, .3]); gCyl(fg, [0, 12, -16], [0, 17, -16], 1.6, 1.4, [.85, .3, .2], 8, true); T.ferry = mkMesh(fg, false);
  return T;
}
const SHIP_LIGHTS = { cargoA: [[0, 33, -56], [0, 14, 62]], cargoB: [[0, 33, -56], [0, 14, 62]], tanker: [[0, 30, -60], [0, 14, 62]], fishA: [[0, 12.5, -7.5], [0, 12, 6], [0, 8, 0]], fishB: [[0, 12.5, -7.5], [0, 12, 6], [0, 8, 0]], ferry: [[0, 18, -16], [0, 14, 20], [0, 8, 28]] };
function buildScenery(si) {
  for (const i of SCN.islands) meshFree(i); SCN.islands = []; SCN.ships = []; if (!SCN.types) SCN.types = buildShipTypes();
  const id = SPOTS[si].id, sc = SCENE[id] || { islands: [], ships: {} }, R = rnd(si * 77 + 11);
  sc.islands.forEach((d, i) => SCN.islands.push(buildIsland(d, si * 31 + i * 7 + 1)));
  const add = (kind, n, anch) => { for (let i = 0; i < n; i++) { const dir = R() < .5 ? 1 : -1, z = 420 + R() * 520, v = anch ? 0 : kind === 'fish' ? 4 + R() * 3 : kind === 'ferry' ? 9 + R() * 2 : 6 + R() * 3;
    let type = kind === 'cargo' ? (R() < .5 ? 'cargoA' : 'cargoB') : kind === 'fish' ? (R() < .5 ? 'fishA' : 'fishB') : kind;
    SCN.ships.push({ type, kind, dir, z, v, x0: (R() - .5) * 1600, ph: R() * 6, anch: !!anch, ax: (R() - .5) * 700 }); } };
  add('cargo', (sc.ships.cargo || 0) - (sc.ships.anch || 0) > 0 ? sc.ships.cargo - (sc.ships.anch || 0) : 0); add('cargo', sc.ships.anch || 0, true);
  add('tanker', sc.ships.tanker || 0); add('fish', sc.ships.fish || 0); add('ferry', sc.ships.ferry || 0);
  SCN.spotIdx = si;
}
function drawScenery(t) {
  const P = PR.lit; gl.uniform1f(P.u.uFog, ENV.fog * .4);
  for (const m of SCN.islands) drawMesh(m, M4.I(), { spec: 0 });
  const night = ENV.night;
  for (const s of SCN.ships) {
    const x = s.anch ? s.ax : ((s.x0 + s.dir * s.v * t + 1000) % 2000 + 2000) % 2000 - 1000, yaw = s.anch ? s.ph : s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const y = s.kind === 'fish' ? Math.sin(t * .9 + s.ph) * .5 : Math.sin(t * .5 + s.ph) * .25, M = M4.trs([x, y - (s.kind === 'cargo' || s.kind === 'tanker' ? 2 : .4), s.z], [Math.sin(t * .6 + s.ph) * .012, yaw, Math.sin(t * .45 + s.ph) * .02]);
    drawMesh(SCN.types[s.type], M, { spec: .1 });
    if (night > .15) for (const l of SHIP_LIGHTS[s.type]) { const p = M4.pt(M, l); pt(p[0], p[1], p[2], 1, .95, .75, night * .95, s.kind === 'fish' ? 5 : 9); }
  }
  gl.uniform1f(P.u.uFog, ENV.fog);
}

/* ================= 2D 오버레이: 전환 페이드 · 비 · 속도선 ================= */
const FXC = { cv: null, c: null, rain: null };
function overlayDraw(dt) {
  if (!FXC.cv) { FXC.cv = document.getElementById('fx'); FXC.c = FXC.cv.getContext('2d'); FXC.rain = Array.from({ length: 170 }, () => ({ x: Math.random(), y: Math.random(), s: .7 + Math.random() * .8 })); }
  const cv = FXC.cv, c = FXC.c, W = GLC.width, H = GLC.height;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  c.clearRect(0, 0, W, H);
  const fd = document.getElementById('fade'); fd.style.opacity = SC.fade > 0 ? Math.min(1, SC.fade / .45) : 0;
  if (ENV.rain > .5) {
    c.strokeStyle = 'rgba(200,220,235,.38)'; c.lineWidth = Math.max(1, W / 900); c.beginPath();
    for (const r of FXC.rain) { r.y += dt * 1.5 * r.s; r.x -= dt * .22 * r.s; if (r.y > 1.05) { r.y = -.05; r.x = Math.random() * 1.2; } if (r.x < -.05) r.x += 1.1; const x = r.x * W, y = r.y * H, l = H * .045 * r.s; c.moveTo(x, y); c.lineTo(x - l * .15, y + l); }
    c.stroke();
  }
  if (SC.biteFx && SC.fpos && G.mode === 'bite') {
    const q = project([SC.fpos[0], SC.fpos[1] + (SC.view === 'side' ? 1.1 : .6), SC.fpos[2]]), d = RS.dpr, bob = Math.sin(G.t * 16) * 3 * d, r = (SC.biteBig ? 22 : 13) * d;
    if (q.w > 0) {
      c.save(); c.translate(q.x * d, q.y * d + bob);
      c.fillStyle = SC.biteBig ? 'rgba(255,92,50,.95)' : 'rgba(255,200,80,.85)'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2 * d; c.stroke();
      c.fillStyle = '#fff'; c.font = '900 ' + Math.round(r * 1.25) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(SC.biteBig ? '!' : '·', 0, SC.biteBig ? 1 * d : -r * .2);
      c.restore();
    }
  }
  if (SC.fkind === 'fly' && G.fly) {
    const u = clamp((G.fly.t - G.fly.rel) / G.fly.air, 0, 1), a = Math.sin(u * Math.PI) * .32, cx = W / 2, cy = H * .48; c.lineWidth = Math.max(1, W / 700);
    for (let i = 0; i < 26; i++) { const an = (i * 2.399 + G.t * .3) % 6.283, r0 = Math.min(W, H) * (.38 + (i % 5) * .05), r1 = r0 + Math.min(W, H) * (.2 + (i % 3) * .1); c.strokeStyle = 'rgba(255,255,255,' + a * (.4 + (i % 4) * .15) + ')'; c.beginPath(); c.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * .7); c.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1 * .7); c.stroke(); }
  }
}

/* ================= 효과음 (WebAudio 합성 · 외부 파일 없음) ================= */
const SFX = {
  ctx: null, master: null, on: true, noise: null, dr: null, crankT: 0, prof: null,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.on ? .55 : 0; this.master.connect(this.ctx.destination);
    const n = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = n;
  },
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? .55 : 0, this.ctx.currentTime, .05); },
  _env(g, t, a, d, peak) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); },
  _noise(t, dur, type, f0, f1, peak, q) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); f.Q.value = q || 1;
    const g = c.createGain(); this._env(g, t, .01, dur, peak); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + .05);
  },
  _tone(t, freq, dur, type, peak, f1) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this._env(g, t, .005, dur, peak); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .05);
  },
  cast() { if (!this.ctx) return; const t = this.ctx.currentTime; this._noise(t, .55, 'bandpass', 400, 2600, .5, 2.2); },
  /* 찌가 수면에 떨어지는 소리: 첨벙(물보라) + 퐁(저음) + 방울 */
  splash(big) {
    if (!this.ctx) return; const t = this.ctx.currentTime, k = big === false ? .6 : 1;
    this._noise(t, .42, 'bandpass', 1900, 480, .8 * k, .9);
    this._noise(t + .01, .7, 'lowpass', 2400, 260, .55 * k, .7);
    this._tone(t, 190, .22, 'sine', .55 * k, 55);
    for (let i = 0; i < 3; i++) { const d = .05 + i * .07 + Math.random() * .04, f = 520 + Math.random() * 500; this._tone(t + d, f, .09, 'sine', .22 * k, f * 2.1); }
  },
  bite(strong) { if (!this.ctx) return; const t = this.ctx.currentTime, p = strong ? .32 : .14; this._tone(t, 880, .09, 'sine', p); if (strong) { this._tone(t + .1, 1320, .14, 'sine', p); } },
  strike() { if (!this.ctx) return; const t = this.ctx.currentTime; this._noise(t, .09, 'highpass', 3000, 1500, .5, .8); this._tone(t, 300, .1, 'triangle', .25, 120); },
  snap() { if (!this.ctx) return; const t = this.ctx.currentTime; this._noise(t, .25, 'highpass', 4500, 2500, .7, .8); this._tone(t, 900, .35, 'sawtooth', .2, 120); },
  jingle() { if (!this.ctx) return; const t = this.ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => this._tone(t + i * .1, f, .35, 'triangle', .22)); },
  lever() { if (!this.ctx) return; const t = this.ctx.currentTime; this._tone(t, 1800, .04, 'square', .12, 900); },
  crank() { if (!this.ctx) return; const t = this.ctx.currentTime; this._noise(t, .025, 'bandpass', 2600, 2200, .22, 4); },
  /* 드랙음: 릴 품질(q)이 높을수록 높고 맑고 경쾌한 소리, 낮을수록 낮고 거친 소리 */
  _mkDrag() {
    const c = this.ctx, d = {};
    d.o1 = c.createOscillator(); d.o1.type = 'sawtooth'; d.o2 = c.createOscillator(); d.o2.type = 'square';
    d.g1 = c.createGain(); d.g2 = c.createGain(); d.ns = c.createBufferSource(); d.ns.buffer = this.noise; d.ns.loop = true; d.nf = c.createBiquadFilter(); d.nf.type = 'bandpass'; d.ng = c.createGain();
    d.click = c.createGain(); d.click.gain.value = .5; d.lfo = c.createOscillator(); d.lfo.type = 'square'; d.lfoG = c.createGain(); d.lfoG.gain.value = .5; d.lfo.connect(d.lfoG); d.lfoG.connect(d.click.gain);
    d.hp = c.createBiquadFilter(); d.hp.type = 'highpass'; d.out = c.createGain(); d.out.gain.value = 0;
    d.o1.connect(d.g1); d.o2.connect(d.g2); d.ns.connect(d.nf); d.nf.connect(d.ng); d.g1.connect(d.click); d.g2.connect(d.click); d.ng.connect(d.click); d.click.connect(d.hp); d.hp.connect(d.out); d.out.connect(this.master);
    d.o1.start(); d.o2.start(); d.ns.start(); d.lfo.start(); this.dr = d;
  },
  setDrag(level, q) {
    if (!this.ctx) return; if (!this.dr) this._mkDrag(); const d = this.dr, t = this.ctx.currentTime, k = .08;
    const f0 = 520 + q * 1500, bright = 700 + q * 5200, noiseMix = .55 - .45 * q, clickHz = (14 + q * 22) * (.6 + level * .8);
    d.o1.frequency.setTargetAtTime(f0 * (1 + level * .45), t, k); d.o2.frequency.setTargetAtTime(f0 * 2.01 * (1 + level * .45), t, k);
    d.g1.gain.setTargetAtTime(.6, t, k); d.g2.gain.setTargetAtTime(.1 + .5 * q, t, k);
    d.nf.frequency.setTargetAtTime(1500 + q * 3500, t, k); d.nf.Q.value = 1.2; d.ng.gain.setTargetAtTime(noiseMix * 1.2, t, k);
    d.lfo.frequency.setTargetAtTime(clickHz, t, k); d.lfoG.gain.setTargetAtTime(.35 + .15 * q, t, k); d.hp.frequency.setTargetAtTime(bright, t, k);
    d.out.gain.setTargetAtTime(level > .02 ? .12 + .45 * Math.min(1, level) : 0, t, .04);
  },
  update(dt) {
    if (!this.ctx) return; const m = G.mode;
    if (m === 'fight' && G.fight) {
      const F = G.fight, R = reelItem(); this.setDrag(F.dragOut || 0, R.q);
      this._duck = this._warn ? 2 : (F.dragOut || 0) > .05 ? 1 : 0;
      if (G.reeling && !(G.lever && R.type === 'lever')) { this.crankT -= dt; if (this.crankT <= 0) { this.crank(); this.crankT = .085 - Math.min(.03, R.speed * .1); } }
    } else { this._duck = 0; if (this.dr) this.setDrag(0, .5); }
    if (this.mus && this.musicOn && (this._duck || 0) !== this._duckS) { this._duckS = this._duck || 0; this.mus.gain.setTargetAtTime([.5, .14, .05][this._duckS], this.ctx.currentTime, this._duckS ? .06 : .5); }
  }
};
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => SFX.unlock(), { passive: true }));

/* ================= 배경음악 · 파도 소리 · 터치음 ================= */
Object.assign(SFX, {
  musicOn: true, mus: null, mt: null, nextT: 0, step: 0, chordN: 0, prog: null, stepLen: .42,
  tap(kind) {
    if (!this.ctx || !this.on) return; const t = this.ctx.currentTime;
    this._noise(t, .035, 'bandpass', kind ? 3200 : 4200, kind ? 2200 : 3000, .32, 1.4);     // 척
    this._tone(t, kind ? 260 : 340, .05, 'sine', .22, kind ? 140 : 200);
    this._tone(t + .012, kind ? 1500 : 1900, .025, 'square', .04);
  },
  _bus() {
    if (this.mus) return; const c = this.ctx;
    this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? .5 : 0; this.mus.connect(this.master);
    this.dl = c.createDelay(1.2); this.dl.delayTime.value = .46; const fb = c.createGain(); fb.gain.value = .4;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; const wet = c.createGain(); wet.gain.value = .55;
    this.dl.connect(lp); lp.connect(fb); fb.connect(this.dl); lp.connect(wet); wet.connect(this.mus);
    this.send = c.createGain(); this.send.gain.value = .7; this.send.connect(this.dl);
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; this.ambF = c.createBiquadFilter(); this.ambF.type = 'lowpass'; this.ambF.frequency.value = 700;
    this.ambG = c.createGain(); this.ambG.gain.value = 0; s.connect(this.ambF); this.ambF.connect(this.ambG); this.ambG.connect(this.master); s.start();
  },
  musicStart() { if (!this.ctx || this.mt) return; this._bus(); this.nextT = this.ctx.currentTime + .4; this.step = 0; this.mt = setInterval(() => this._sched(), 120); },
  setMusic(v) { this.musicOn = v; if (this.ctx) { this._bus(); this.mus.gain.setTargetAtTime(v ? .5 : 0, this.ctx.currentTime, .4); if (v) this.musicStart(); } },
  _mood() { if (G.mode === 'fight') return 'fight'; const n = ENV.night > .5, w = G.wx; return n ? 'night' : (w === 'rain' || w === 'rough') ? 'dark' : w === 'cloud' ? 'mellow' : 'bright'; },
  _sched() { if (!this.ctx || !this.musicOn) return; const c = this.ctx; while (this.nextT < c.currentTime + .6) { this._step(this.nextT); this.nextT += this.stepLen; } },
  _f(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  _voice(t, freq, dur, peak, att, type, out) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.setTargetAtTime(0, t + att + dur * .55, dur * .22);
    o.connect(g); g.connect(out || this.mus); if (!out || !out._nosend) g.connect(this.send); o.start(t); o.stop(t + att + dur + .3);
  },
  _gbus() {
    if (this.gIn) return; const c = this.ctx; this.gIn = c.createGain(); this.gIn.gain.value = 1;
    const ws = c.createWaveShaper(), n = 1024, cv = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(x * 7) * .9 + Math.sin(x * 9) * .03; } ws.curve = cv; ws.oversample = '4x';
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110; const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1500; pk.gain.value = 5; pk.Q.value = .8;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; this.gOut = c.createGain(); this.gOut.gain.value = .5;
    this.gIn.connect(hp); hp.connect(ws); ws.connect(pk); pk.connect(lp); lp.connect(this.gOut); this.gOut.connect(this.mus); this.gOut.connect(this.send);
  },
  /* 일렉기타: 파워코드 / 리드 */
  _gtr(t, m, dur, v, mute, bend) {
    this._gbus(); const c = this.ctx, f = this._f(m);
    [1, 1.006].forEach((d, k) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(bend ? f * Math.pow(2, -bend / 12) : f * d, t); if (bend) o.frequency.exponentialRampToValueAtTime(f * d, t + .06);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.setTargetAtTime(0, t + (mute ? .03 : dur * .6), mute ? .03 : dur * .2);
      o.connect(g); g.connect(this.gIn); o.start(t); o.stop(t + dur + .4); });
  },
  _power(t, root, dur, v, mute) { this._gtr(t, root, dur, v, mute); this._gtr(t, root + 7, dur, v * .9, mute); this._gtr(t, root + 12, dur, v * .7, mute); },
  _lead(t, m, dur, v) {
    this._gbus(); const c = this.ctx, f = this._f(m), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lf = c.createOscillator(), lg = c.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(f * .94, t); o.frequency.exponentialRampToValueAtTime(f, t + .07); o2.frequency.setValueAtTime(f * .94, t); o2.frequency.exponentialRampToValueAtTime(f * 1.002, t + .07);
    lf.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .012, t + dur * .6); lf.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.setTargetAtTime(0, t + dur * .75, dur * .12);
    const g2 = c.createGain(); g2.gain.value = .5; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.gIn); [o, o2, lf].forEach(x => { x.start(t); x.stop(t + dur + .4); });
  },
  _drum(fn) { const m = this.master; this.master = this.mus; try { fn(); } finally { this.master = m; } },
  _kick(t, v) { this._drum(() => { this._tone(t, 150, .13, 'sine', .62 * v, 42); this._noise(t, .02, 'highpass', 3000, 2500, .12 * v, .8); }); },
  _clap(t, v) { this._drum(() => { this._noise(t, .13, 'bandpass', 1900, 1300, .32 * v, .9); this._noise(t + .012, .08, 'highpass', 4500, 3500, .12 * v, .8); }); },
  _hat(t, v) { this._drum(() => this._noise(t, .045, 'highpass', 7500, 6500, .11 * v, .7)); },
  _step(t) {
    const mood = this._mood();
    const PROG = { bright: [[48, 'M'], [43, 'M'], [45, 'm'], [41, 'M']], mellow: [[48, 'M'], [43, 'M'], [45, 'm'], [41, 'M']], dark: [[41, 'M'], [48, 'M'], [43, 'M'], [45, 'm']], night: [[48, 'M'], [45, 'm'], [41, 'M'], [43, 'M']], fight: [[50, 'M'], [45, 'M'], [47, 'm'], [43, 'M']] };
    const BPM = { bright: 108, mellow: 98, dark: 92, night: 88, fight: 142 };
    if (this.lastMood !== mood) {
      const fadeP = (this.lastMood === 'fight') !== (mood === 'fight');
      if (fadeP || !this.lastMood) { this.step = 0; this.chordN = 0; if (this.padG) this.padG.gain.setTargetAtTime(0, t, .12); }
      this.lastMood = mood;
    }
    const fight = mood === 'fight', clen = fight ? 8 : 16, pos = this.step++ % clen, bp = pos % 8;
    this.stepLen = 60 / BPM[mood] / 2;
    const sl = this.stepLen;
    if (pos === 0) {
      const pg = PROG[mood], ch = pg[this.chordN++ % 4]; this.cur = ch;
      const iv = ch[1] === 'M' ? [0, 7, 11, 16] : [0, 7, 10, 15], dur = sl * clen;
      const g = this.ctx.createGain(); g.gain.value = 1; g._nosend = true; g.connect(this.mus); g.connect(this.send); this.padG = g;
      iv.forEach((x, i) => { const f = this._f(ch[0] + 12 + x), lv = (mood === 'night' ? .03 : fight ? .02 : .045) * (i === 0 ? 1.1 : .9); this._voice(t, f * 1.003, dur, lv, fight ? .08 : .5, fight ? 'sawtooth' : 'triangle', g); this._voice(t, f * .997, dur, lv, fight ? .08 : .5, 'triangle', g); });
    }
    const ch = this.cur || [48, 'M'], root = ch[0], maj = ch[1] === 'M';
    /* 리듬 */
    const lowKick = mood === 'dark' || mood === 'night';
    if (fight) { if (pos % 2 === 0) this._kick(t, 1); if (pos % 4 === 2) this._clap(t, 1); if (pos % 2 === 1) this._hat(t, .9); else if (pos % 4 === 0) this._hat(t, .35); }
    else { if (bp === 0 || bp === 4 || (bp === 3 && mood === 'bright')) this._kick(t, lowKick ? .6 : .85); if (bp === 4 && !lowKick) this._clap(t, .6); if (pos % 2 === 1) this._hat(t, lowKick ? .5 : .75); }
    /* 베이스 */
    const bn = root - 12;
    if (fight) this._voice(t, this._f(bn + (pos % 2 ? 12 : 0)), sl * .9, .17, .006, 'triangle', this.mus);
    else if (bp === 0 || bp === 3 || bp === 6) this._voice(t, this._f(bn + (bp === 3 ? 12 : 0)), sl * 1.5, .19, .008, 'triangle', this.mus);
    /* 아르페지오 · 멜로디 */
    const tones = [0, maj ? 4 : 3, 7, 12, maj ? 16 : 15, 19];
    if (fight) {
      const a = [0, 2, 4, 2, 1, 3, 5, 3][pos % 8], f = this._f(root + 24 + tones[a] - (a > 4 ? 12 : 0));
      this._voice(t, f, sl * 1.1, .02, .004, 'square');
      const gr = root - 12;   // 리듬 기타: 팜뮤트 칭칭 + 열린 코드
      if (pos === 0) this._power(t, gr, sl * 3.2, .1, false); else if (pos === 4) this._power(t, gr, sl * 2.2, .09, false); else if (pos === 3 || pos === 7) this._power(t, gr, sl * .6, .06, true); else this._power(t, gr, sl * .5, pos % 2 ? .06 : .08, true);
      if (pos % 2 === 0 && Math.random() < .85) { const bl = [0, 3, 5, 7, 10, 12, 15, 17], n = bl[Math.floor(Math.random() * bl.length)]; this._lead(t, root + 24 + n - (maj && n === 3 ? -1 : 0), sl * (Math.random() < .35 ? 3 : 1.6), .07); }
    } else {
      const pent = [0, 2, 4, 7, 9, 12, 14], pr = mood === 'bright' ? .7 : mood === 'mellow' ? .6 : .5;
      if (pos % 2 === 0 ? Math.random() < pr : Math.random() < pr * .3) {
        const n = pent[Math.floor(Math.random() * pent.length)], f = this._f(root + 24 + (maj ? n : n === 4 ? 3 : n));
        this._voice(t, f, sl * 3, mood === 'night' ? .07 : .1, .006, 'triangle'); this._voice(t, f * 2, sl * 1.2, .025, .006, 'sine');
      }
      if (mood === 'bright' && pos % 4 === 2) { const f = this._f(root + 24 + tones[(pos >> 2) % 3]); this._voice(t, f, sl * 1.2, .04, .004, 'square'); }
    }
  },
  _amb(dt) {
    if (!this.ambG) return; const a = clamp(ENV.amp / 2.7, 0, 1), t = ENV.time || 0;
    const sw = .55 + .45 * Math.sin(t * .62) * Math.sin(t * .37 + 1);
    this.ambG.gain.setTargetAtTime((.012 + .1 * a) * sw, this.ctx.currentTime, .3); this.ambF.frequency.setTargetAtTime(380 + 900 * a, this.ctx.currentTime, .4);
  }
});
{
  const _ul = SFX.unlock.bind(SFX), _up = SFX.update.bind(SFX);
  SFX.unlock = function () { const had = !!this.ctx; _ul(); if (this.ctx && !had) { this._bus(); if (this.musicOn) this.musicStart(); } };
  SFX.update = function (dt) { _up(dt); if (this.ctx) this._amb(dt); };
}

const hx = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
function drawFish(c, x, y, len, dir, f, alpha) {
  const h = len * f.h;
  c.save(); c.translate(x, y); c.scale(dir, 1); c.globalAlpha = alpha; c.fillStyle = f.col;
  c.beginPath(); c.moveTo(len / 2, 0);
  c.quadraticCurveTo(len * .2, -h, -len * .26, -h * .3);
  c.lineTo(-len / 2, -h * .6); c.lineTo(-len * .4, 0); c.lineTo(-len / 2, h * .6); c.lineTo(-len * .26, h * .3);
  c.quadraticCurveTo(len * .2, h, len / 2, 0); c.closePath(); c.fill();
  if (f.stripes) {
    c.strokeStyle = 'rgba(10,20,25,.55)'; c.lineWidth = Math.max(1, len * .035);
    for (let i = 0; i < 5; i++) { const sx = len * (.28 - i * .12); c.beginPath(); c.moveTo(sx, -h * .7); c.lineTo(sx - len * .03, h * .7); c.stroke(); }
  }
  c.fillStyle = 'rgba(10,20,25,.8)'; c.beginPath(); c.arc(len * .33, -h * .12, Math.max(1, len * .022), 0, 7); c.fill();
  c.restore();
}

/* 주변을 헤엄치는 물고기 */
/* 조과 카드용 물고기 그림 */
function drawResultFish(f, L) {
  const rc = document.getElementById('res-fish'), c = rc.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, rc.width, rc.height);
  const rel = (L - f.size[0]) / (f.size[1] - f.size[0]), len = Math.min(210 + rel * 150, rc.height * .42 / f.h);
  drawFish(c, rc.width / 2, rc.height / 2, len, 1, f, 1);
}

/* ===== 도감 · 상점 이미지 (캔버스로 그려서 dataURL 캐시) ===== */
const ICON_CACHE = {};
function mkCv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
const rgbs = (c, k = 1, a = 1) => 'rgba(' + c.map(v => Math.round(Math.min(1, v * k) * 255)).join(',') + ',' + a + ')';
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); return 'rgb(' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(',') + ')'; }
function lerpHex(a, b, t) { const p = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }, A = p(a), B = p(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }

/* ---- 물고기 ---- */
const FISH_LOOK = {
  hak:   { len: 1, H: .09, beak: .2, tail: 'fork', dors: 'back', spots: 0 },
  aji:   { len: 1, H: .2, tail: 'fork', dors: 'two', scute: 1 },
  mang:  { len: .86, H: .42, tail: 'fork', dors: 'long' },
  nore:  { len: 1, H: .27, tail: 'round', dors: 'long', spots: 'dots', big: 1 },
  jwi:   { len: .8, H: .62, tail: 'round', dors: 'spine', diamond: 1 },
  bol:   { len: .9, H: .36, tail: 'round', dors: 'long', eye: 1.5, bars: 1 },
  ureok: { len: 1, H: .38, tail: 'round', dors: 'long', mouth: 1.4, spots: 'dots' },
  beng:  { len: .92, H: .46, tail: 'fork', dors: 'long', lips: 1 },
  gam:   { len: .9, H: .5, tail: 'fork', dors: 'long', sheen: 1 },
  nong:  { len: 1, H: .28, tail: 'fork', dors: 'two', spots: 'fine', mouth: 1.2 },
  cham:  { len: .92, H: .52, tail: 'fork', dors: 'long', spots: 'blue', forehead: 1 },
  dol:   { len: .86, H: .56, tail: 'round', dors: 'spine', bandsN: 6, mouth: .8 },
  bok:   { len: .72, H: .6, tail: 'round', dors: 'small', puff: 1, spots: 'dots' }
};
function drawFishIcon(ctx, f, W, H, sil) {
  const L = FISH_LOOK[f.id] || { len: 1, H: .3, tail: 'fork', dors: 'long' };
  const ml = W * .72 * L.len, mh = ml * L.H, cx = W * .5 + W * .03, cy = H * .54;
  const x0 = cx - ml * .5, x1 = cx + ml * .5;                      // 꼬리쪽 x0, 머리쪽 x1
  const top = x => { const t = (x - x0) / ml; let v = Math.pow(Math.sin(Math.PI * Math.pow(t, .72)), .8); if (L.diamond) v = Math.pow(Math.sin(Math.PI * Math.pow(t, .9)), 1.05); if (L.puff) v = Math.pow(Math.sin(Math.PI * Math.pow(t, .55)), .6); return v; };
  const pts = [], bot = [], N = 40;
  for (let i = 0; i <= N; i++) { const x = x0 + ml * i / N, t = i / N, v = top(x); let up = mh * .5 * v * (L.puff ? .95 : .88), dn = mh * .5 * v * (L.puff ? 1.05 : 1.0); if (L.forehead && t > .8) up *= 1 + (t - .8) * 1.2; if (t > .9 && !L.puff) { up *= 1 - (t - .9) * 1.2; } pts.push([x, cy - up]); bot.push([x, cy + dn]); }
  const col = f.col, light = lerpHex(col, '#ffffff', .55), dark = shade(col, .62);
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => ctx.lineTo(p[0], p[1])); if (L.beak) ctx.lineTo(x1 + ml * L.beak, cy + mh * .1); for (let i = N; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]); ctx.closePath(); };
  const fillC = sil ? '#0b1a22' : null;
  // 꼬리
  const tw = ml * .22, th = mh * (L.tail === 'fork' ? .95 : .62), tailPath = () => { ctx.beginPath(); ctx.moveTo(x0 + ml * .06, cy - mh * .05); if (L.tail === 'fork') { ctx.lineTo(x0 - tw, cy - th); ctx.lineTo(x0 - tw * .45, cy); ctx.lineTo(x0 - tw, cy + th); } else { ctx.bezierCurveTo(x0 - tw * .6, cy - th, x0 - tw * 1.2, cy - th * .6, x0 - tw * 1.1, cy); ctx.bezierCurveTo(x0 - tw * 1.2, cy + th * .6, x0 - tw * .6, cy + th, x0 + ml * .06, cy + mh * .05); } ctx.closePath(); };
  // 지느러미 (등 / 뒷)
  const dorsal = () => { ctx.beginPath(); const a = .3, b = L.dors === 'two' ? .5 : .72; const ya = i => pts[Math.round(N * i)];
    if (L.dors === 'two') { let p = ya(.34); ctx.moveTo(p[0], p[1] + 2); ctx.lineTo(p[0] + ml * .04, p[1] - mh * .3); ctx.lineTo(ya(.52)[0], ya(.52)[1] + 2); ctx.closePath(); p = ya(.6); ctx.moveTo(p[0], p[1] + 2); ctx.quadraticCurveTo(p[0] + ml * .04, p[1] - mh * .2, ya(.72)[0], ya(.72)[1] + 2); ctx.closePath(); }
    else if (L.dors === 'spine') { const p = ya(.4); ctx.moveTo(ya(.28)[0], ya(.28)[1] + 3); ctx.lineTo(ya(.4)[0], ya(.4)[1] - mh * .42); ctx.lineTo(ya(.62)[0], ya(.62)[1] - mh * .28); ctx.lineTo(ya(.78)[0], ya(.78)[1] + 3); ctx.closePath(); }
    else if (L.dors === 'small') { ctx.moveTo(ya(.5)[0], ya(.5)[1] + 3); ctx.lineTo(ya(.58)[0], ya(.58)[1] - mh * .16); ctx.lineTo(ya(.66)[0], ya(.66)[1] + 3); ctx.closePath(); }
    else if (L.dors === 'back') { ctx.moveTo(ya(.18)[0], ya(.18)[1] + 2); ctx.lineTo(ya(.22)[0], ya(.22)[1] - mh * .45); ctx.lineTo(ya(.34)[0], ya(.34)[1] + 2); ctx.closePath(); }
    else { ctx.moveTo(ya(.2)[0], ya(.2)[1] + 3); ctx.quadraticCurveTo(ya(.36)[0], ya(.36)[1] - mh * .34, ya(.62)[0], ya(.62)[1] - mh * .1); ctx.lineTo(ya(.8)[0], ya(.8)[1] + 3); ctx.closePath(); } };
  const anal = () => { ctx.beginPath(); const p = bot[Math.round(N * .3)], q = bot[Math.round(N * .5)]; ctx.moveTo(p[0], p[1] - 3); ctx.quadraticCurveTo((p[0] + q[0]) / 2, p[1] + mh * .26, q[0], q[1] - 3); ctx.closePath(); };
  const pect = () => { ctx.beginPath(); const p = pts[Math.round(N * .7)]; const y = cy + mh * .1; ctx.moveTo(p[0], y); ctx.quadraticCurveTo(p[0] - ml * .1, y + mh * .28, p[0] - ml * .14, y + mh * .26); ctx.quadraticCurveTo(p[0] - ml * .1, y + mh * .08, p[0] - ml * .06, y - mh * .05); ctx.closePath(); };
  ctx.save();
  ctx.lineJoin = 'round';
  const fins = [tailPath, dorsal, anal];
  fins.forEach(fn => { fn(); ctx.fillStyle = sil ? fillC : shade(col, .8); ctx.fill(); if (!sil) { ctx.strokeStyle = shade(col, .5); ctx.lineWidth = 1; ctx.stroke(); } });
  path(); const g = ctx.createLinearGradient(0, cy - mh * .5, 0, cy + mh * .55);
  if (sil) { g.addColorStop(0, '#0b1a22'); g.addColorStop(1, '#0b1a22'); } else if (L.bars) { g.addColorStop(0, shade(col, .9)); g.addColorStop(1, lerpHex(col, '#ffd6a0', .5)); } else { g.addColorStop(0, dark); g.addColorStop(.42, col); g.addColorStop(1, light); }
  ctx.fillStyle = g; ctx.fill();
  if (!sil) {
    ctx.save(); path(); ctx.clip();
    if (L.bandsN) for (let i = 0; i < L.bandsN; i++) { const x = x0 + ml * (.2 + i * .12); ctx.fillStyle = 'rgba(20,28,32,.78)'; ctx.fillRect(x, cy - mh, ml * .055, mh * 2); }
    if (L.bars) for (let i = 0; i < 4; i++) { const x = x0 + ml * (.28 + i * .13); ctx.fillStyle = 'rgba(70,20,10,.4)'; ctx.fillRect(x, cy - mh, ml * .05, mh * 2); }
    if (L.spots) { const rnd = (i => () => (i = (i * 9301 + 49297) % 233280) / 233280)(f.id.length * 77 + 5); const n = L.spots === 'fine' ? 22 : L.spots === 'blue' ? 16 : 14; for (let i = 0; i < n; i++) { const x = x0 + ml * (.2 + rnd() * .65), y = cy - mh * .4 + rnd() * mh * .6; ctx.beginPath(); ctx.arc(x, y, L.spots === 'fine' ? 1.1 : L.spots === 'blue' ? 1.6 : 2.4, 0, 7); ctx.fillStyle = L.spots === 'blue' ? 'rgba(90,190,255,.85)' : L.spots === 'fine' ? 'rgba(30,40,48,.5)' : 'rgba(25,20,10,.5)'; ctx.fill(); } }
    if (L.scute) { ctx.strokeStyle = 'rgba(60,70,60,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + ml * .15, cy); ctx.lineTo(x0 + ml * .62, cy); ctx.stroke(); }
    if (L.sheen || !L.bars) { ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.beginPath(); ctx.ellipse(cx, cy - mh * .12, ml * .36, mh * .09, 0, 0, 7); ctx.fill(); }
    // 아가미 · 비늘 느낌
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x1 - ml * .24, cy, mh * .34, -1.1, 1.1); ctx.stroke();
    ctx.restore();
    pect(); ctx.fillStyle = shade(col, .75); ctx.fill(); ctx.strokeStyle = shade(col, .45); ctx.lineWidth = 1; ctx.stroke();
    const ex = x1 - ml * .13, ey = cy - mh * .1, er = Math.max(2.6, mh * .075) * (L.eye || 1);
    ctx.beginPath(); ctx.arc(ex, ey, er * 1.35, 0, 7); ctx.fillStyle = '#f4f4f0'; ctx.fill(); ctx.beginPath(); ctx.arc(ex + er * .15, ey, er * .85, 0, 7); ctx.fillStyle = '#10161a'; ctx.fill(); ctx.beginPath(); ctx.arc(ex - er * .1, ey - er * .3, er * .25, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.3; ctx.beginPath(); const mx = x1 + (L.beak ? ml * L.beak : 0) - 1; ctx.moveTo(mx - ml * .06, cy + mh * .14); ctx.lineTo(mx, cy + mh * .1); ctx.stroke();
    if (L.lips) { ctx.fillStyle = 'rgba(200,120,110,.7)'; ctx.beginPath(); ctx.ellipse(x1 - 2, cy + mh * .1, 3, 4, 0, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
function fishURL(f, sil) {
  const k = 'f' + f.id + (sil ? 's' : ''); if (ICON_CACHE[k]) return ICON_CACHE[k];
  const [c, x] = mkCv(240, 140); drawFishIcon(x, f, 240, 140, sil);
  return ICON_CACHE[k] = c.toDataURL('image/png');
}

/* ---- 장비 ---- */
function drawItem(x, it, kind, W, H) {
  const br = it.brand ? BRANDS[it.brand].col : '#8a97a0', c0 = it.c ? hexOf(it.c) : br, cx = W / 2, cy = H / 2;
  x.lineJoin = 'round'; x.lineCap = 'round';
  const grad = (a, b, y0, y1) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const ptag = (tx, ty) => { if (!it.brand) return; x.fillStyle = br; x.beginPath(); x.roundRect(tx - 13, ty - 5, 26, 10, 3); x.fill(); x.fillStyle = '#fff'; x.fillRect(tx - 8, ty - 1, 16, 2); };
  if (kind === 'rod') {
    const g = hexOf(it.cg), a = hexOf(it.ca), b = hexOf(it.cb);
    x.save(); x.translate(cx, cy); x.rotate(-.72);
    const Lh = W * .56;
    x.lineWidth = 3.4; x.strokeStyle = a; x.beginPath(); x.moveTo(-Lh, 0); x.lineTo(Lh * .6, 0); x.stroke();
    x.lineWidth = 2.2; x.strokeStyle = b; x.beginPath(); x.moveTo(Lh * .6, 0); x.quadraticCurveTo(Lh * 1.0, -4, Lh * 1.1, -14); x.stroke();
    x.lineWidth = 6; x.strokeStyle = g; x.beginPath(); x.moveTo(-Lh, 0); x.lineTo(-Lh * .62, 0); x.stroke();
    x.lineWidth = 7; x.strokeStyle = '#1a1f24'; x.beginPath(); x.moveTo(-Lh * .62, 0); x.lineTo(-Lh * .54, 0); x.stroke();
    x.lineWidth = 4; x.strokeStyle = br; x.beginPath(); x.moveTo(Lh * .08, 0); x.lineTo(Lh * .13, 0); x.stroke(); x.beginPath(); x.moveTo(Lh * .58, 0); x.lineTo(Lh * .62, 0); x.stroke();
    x.lineWidth = 1.3; x.strokeStyle = '#d8e0e4'; for (let i = 0; i < 5; i++) { const px = -Lh * .35 + i * Lh * .3; x.beginPath(); x.arc(px, 5 + i * .4, 2.6, 0, 7); x.stroke(); }
    x.restore(); ptag(W - 26, H - 14); return;
  }
  if (kind === 'reel') {
    const lev = it.type === 'lever', d = hexOf(it.c);
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(cx, H - 10, W * .3, 5, 0, 0, 7); x.fill();
    x.fillStyle = '#2a323a'; x.fillRect(cx - 4, 8, 8, 26);                                 // 릴 시트 다리
    x.fillStyle = grad(shade(d, 1.25), shade(d, .55), 28, 74); x.beginPath(); x.ellipse(cx, 50, W * .3, 22, 0, 0, 7); x.fill(); x.strokeStyle = shade(d, .4); x.lineWidth = 1.5; x.stroke();   // 바디
    x.fillStyle = grad('#f1f4f6', '#9aa5ab', 52, 84); x.beginPath(); x.ellipse(cx, 66, W * .26, 15, 0, 0, 7); x.fill(); x.strokeStyle = '#6a757c'; x.stroke();          // 스풀
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(cx + i * 9, 57); x.lineTo(cx + i * 9, 76); x.stroke(); }
    x.strokeStyle = '#cfd6db'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - W * .3, 46); x.quadraticCurveTo(cx - W * .42, 66, cx - W * .12, 80); x.stroke();                    // 베일
    x.strokeStyle = '#2a323a'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx + W * .28, 48); x.lineTo(cx + W * .44, 38); x.stroke(); x.fillStyle = br; x.beginPath(); x.arc(cx + W * .45, 36, 6, 0, 7); x.fill();   // 핸들
    if (lev) { x.fillStyle = '#e8c33a'; x.beginPath(); x.moveTo(cx - W * .24, 30); x.lineTo(cx - W * .42, 20); x.lineTo(cx - W * .4, 14); x.lineTo(cx - W * .16, 26); x.closePath(); x.fill(); x.strokeStyle = '#7a6410'; x.lineWidth = 1; x.stroke(); }
    x.fillStyle = '#fff'; x.font = '700 9px sans-serif'; x.textAlign = 'center'; x.fillText(it.brand === 'dina' ? 'DINA' : it.brand === 'sinano' ? 'SINANO' : 'BASIC', cx, 54);
    return;
  }
  if (kind === 'hat') {
    x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(cx, H - 12, W * .34, 6, 0, 0, 7); x.fill();
    const hc = hexOf(it.c);
    if (it.style === 'cap') { x.fillStyle = grad(shade(hc, 1.2), shade(hc, .75), 18, 60); x.beginPath(); x.moveTo(cx - 30, 62); x.bezierCurveTo(cx - 30, 20, cx + 28, 20, cx + 30, 62); x.closePath(); x.fill(); x.fillStyle = shade(hc, .55); x.beginPath(); x.ellipse(cx + 22, 64, 34, 8, .05, 0, 7); x.fill(); x.fillStyle = '#1b2127'; x.fillRect(cx - 30, 56, 60, 6); x.fillStyle = shade(hc, 1.3); x.beginPath(); x.arc(cx, 22, 3, 0, 7); x.fill(); }
    else if (it.style === 'bucket') { x.fillStyle = shade(hc, .7); x.beginPath(); x.ellipse(cx, 62, 46, 11, 0, 0, 7); x.fill(); x.fillStyle = grad(shade(hc, 1.2), shade(hc, .8), 22, 62); x.beginPath(); x.moveTo(cx - 28, 60); x.lineTo(cx - 24, 28); x.quadraticCurveTo(cx, 18, cx + 24, 28); x.lineTo(cx + 28, 60); x.closePath(); x.fill(); x.fillStyle = '#1b2127'; x.fillRect(cx - 28, 52, 56, 6); }
    else { x.fillStyle = shade(hc, .75); x.beginPath(); x.ellipse(cx, 62, 58, 13, 0, 0, 7); x.fill(); x.fillStyle = grad(shade(hc, 1.5), shade(hc, .9), 24, 62); x.beginPath(); x.moveTo(cx - 24, 62); x.bezierCurveTo(cx - 24, 24, cx + 24, 24, cx + 24, 62); x.closePath(); x.fill(); x.fillStyle = '#c8a24a'; x.fillRect(cx - 24, 52, 48, 6); }
    ptag(cx, 14); return;
  }
  if (kind === 'top') {
    const sc = hexOf(it.c), pc = hexOf(it.p);
    x.fillStyle = grad(shade(pc, 1.2), shade(pc, .7), 60, 100); x.beginPath(); x.moveTo(cx - 24, 62); x.lineTo(cx + 24, 62); x.lineTo(cx + 26, 100); x.lineTo(cx + 4, 100); x.lineTo(cx, 74); x.lineTo(cx - 4, 100); x.lineTo(cx - 26, 100); x.closePath(); x.fill(); x.strokeStyle = shade(pc, .5); x.lineWidth = 1; x.stroke();
    x.fillStyle = grad(shade(sc, 1.25), shade(sc, .75), 14, 66); x.beginPath(); x.moveTo(cx - 16, 14); x.lineTo(cx - 44, 30); x.lineTo(cx - 38, 52); x.lineTo(cx - 28, 46); x.lineTo(cx - 26, 66); x.lineTo(cx + 26, 66); x.lineTo(cx + 28, 46); x.lineTo(cx + 38, 52); x.lineTo(cx + 44, 30); x.lineTo(cx + 16, 14); x.quadraticCurveTo(cx, 24, cx - 16, 14); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(cx - 26, 56, 52, 3);
    ptag(cx, 8); return;
  }
  if (kind === 'vest') {
    const vc = hexOf(it.c);
    x.fillStyle = grad(shade(vc, 1.25), shade(vc, .72), 12, 100); x.beginPath(); x.moveTo(cx - 22, 12); x.lineTo(cx - 40, 18); x.lineTo(cx - 36, 52); x.lineTo(cx - 30, 100); x.lineTo(cx + 30, 100); x.lineTo(cx + 36, 52); x.lineTo(cx + 40, 18); x.lineTo(cx + 22, 12); x.lineTo(cx + 8, 40); x.lineTo(cx, 22); x.lineTo(cx - 8, 40); x.closePath(); x.fill(); x.strokeStyle = shade(vc, .45); x.lineWidth = 1.2; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(cx - 34, 66, 68, 5); x.fillStyle = shade(vc, .55); x.fillRect(cx - 1.5, 40, 3, 60);
    x.fillStyle = shade(vc, .6); x.fillRect(cx - 28, 76, 18, 14); x.fillRect(cx + 10, 76, 18, 14);
    return;
  }
  if (kind === 'boots') {
    const bc = hexOf(it.c);
    x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(cx, H - 12, W * .36, 6, 0, 0, 7); x.fill();
    x.fillStyle = grad(shade(bc, 1.3), shade(bc, .7), 10, 96); x.beginPath(); x.moveTo(cx - 26, 10); x.lineTo(cx + 8, 10); x.lineTo(cx + 10, 62); x.quadraticCurveTo(cx + 44, 62, cx + 46, 86); x.lineTo(cx + 46, 92); x.lineTo(cx - 30, 92); x.lineTo(cx - 28, 60); x.closePath(); x.fill(); x.strokeStyle = shade(bc, .45); x.lineWidth = 1.2; x.stroke();
    x.fillStyle = '#1a1d21'; x.fillRect(cx - 32, 88, 80, 8); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(cx - 20, 14, 5, 40);
    if (it.id === 'boots_g') { x.fillStyle = '#d8d8d8'; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(cx - 28 + i * 12, 96); x.lineTo(cx - 24 + i * 12, 102); x.lineTo(cx - 20 + i * 12, 96); x.fill(); } }
    ptag(cx - 6, 24); return;
  }
  if (kind === 'tbox') {
    x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(cx, H - 10, W * .34, 5, 0, 0, 7); x.fill();
    x.fillStyle = grad(shade(br, 1.1), shade(br, .6), 28, 92); x.beginPath(); x.roundRect(cx - 44, 36, 88, 56, 7); x.fill(); x.strokeStyle = shade(br, .4); x.lineWidth = 1.5; x.stroke();
    x.fillStyle = shade(br, .8); x.beginPath(); x.roundRect(cx - 48, 28, 96, 18, 6); x.fill(); x.stroke();
    x.strokeStyle = '#2a323a'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - 18, 28); x.quadraticCurveTo(cx, 8, cx + 18, 28); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(cx - 40, 62, 80, 2); x.fillStyle = '#e8d070'; x.fillRect(cx - 5, 44, 10, 8);
    const n = Math.min(5, 2 + (it.cap > 40 ? 1 : 0) + (it.cap > 100 ? 2 : 0)); x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < n; i++) x.fillRect(cx - 36 + i * 15, 72, 10, 14);
    return;
  }
  if (kind === 'bag') {
    x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(cx, H - 10, W * .32, 5, 0, 0, 7); x.fill();
    const big = it.cap > 20;
    x.strokeStyle = shade(br, .5); x.lineWidth = 5; x.beginPath(); x.moveTo(cx - 22, 34); x.quadraticCurveTo(cx, big ? 2 : 6, cx + 22, 34); x.stroke();
    x.fillStyle = grad(shade(br, 1.2), shade(br, .6), 24, 94); x.beginPath(); x.roundRect(cx - 40, 30, 80, 64, 14); x.fill(); x.strokeStyle = shade(br, .4); x.lineWidth = 1.5; x.stroke();
    x.fillStyle = shade(br, .75); x.beginPath(); x.roundRect(cx - 30, 58, 60, 28, 7); x.fill(); x.stroke();
    x.fillStyle = '#2a323a'; x.fillRect(cx - 38, 44, 76, 4); x.fillStyle = '#e8d070'; x.fillRect(cx - 4, 40, 8, 12);
    if (big) { x.fillStyle = shade(br, .7); x.fillRect(cx - 52, 46, 12, 34); x.fillRect(cx + 40, 46, 12, 34); }
    return;
  }
  if (kind === 'case') {
    x.save(); x.translate(cx, cy + 4); x.rotate(-.5);
    x.fillStyle = grad(shade(br, 1.15), shade(br, .6), -14, 14); x.beginPath(); x.roundRect(-W * .46, -13, W * .92, 26, 12); x.fill(); x.strokeStyle = shade(br, .4); x.lineWidth = 1.5; x.stroke();
    x.fillStyle = '#2a323a'; x.fillRect(-W * .2, -13, 4, 26); x.fillRect(W * .16, -13, 4, 26);
    x.fillStyle = '#e8d070'; x.fillRect(W * .34, -4, 10, 8); x.strokeStyle = '#2a323a'; x.lineWidth = 3; x.beginPath(); x.moveTo(-W * .1, -13); x.quadraticCurveTo(0, -26, W * .1, -13); x.stroke();
    x.restore(); return;
  }
  /* 채비 */
  const t = it.type;
  if (t === 'hook') {
    x.strokeStyle = br; x.lineWidth = 3.5; x.beginPath(); x.moveTo(cx + 8, 12); x.lineTo(cx + 8, 64); x.arc(cx - 6, 64, 14, 0, Math.PI * .95); x.lineTo(cx - 26, 52); x.stroke();
    x.strokeStyle = '#d9e0e4'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(cx + 5, 14); x.lineTo(cx + 5, 60); x.stroke();
    x.beginPath(); x.arc(cx + 8, 12, 5, 0, 7); x.strokeStyle = '#d9e0e4'; x.lineWidth = 2.4; x.stroke(); x.fillStyle = br; x.beginPath(); x.moveTo(cx - 26, 52); x.lineTo(cx - 32, 62); x.lineTo(cx - 20, 58); x.fill();
    x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '700 10px sans-serif'; x.textAlign = 'center'; x.fillText((it.name.match(/#\d/) || [''])[0], cx + 24, 90); ptag(cx - 28, 92); return;
  }
  if (t === 'swivel') {
    x.strokeStyle = '#cfd6db'; x.lineWidth = 3.4; x.beginPath(); x.ellipse(cx, 26, 10, 12, 0, 0, 7); x.stroke(); x.beginPath(); x.ellipse(cx, 84, 10, 12, 0, 0, 7); x.stroke();
    x.fillStyle = grad(br, shade(br, .55), 40, 70); x.beginPath(); x.roundRect(cx - 9, 36, 18, 38, 8); x.fill(); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(cx - 9, 54, 18, 3);
    ptag(cx + 30, 92); return;
  }
  if (t === 'leader' || t === 'main') {
    const thick = t === 'main' ? 1 : .7;
    x.fillStyle = grad(shade(br, 1.1), shade(br, .55), 24, 90); x.beginPath(); x.ellipse(cx, 30, 36, 10, 0, 0, 7); x.fill(); x.fillStyle = grad(shade(br, .9), shade(br, .5), 30, 90); x.fillRect(cx - 36, 30, 72, 52); x.beginPath(); x.ellipse(cx, 82, 36, 10, 0, 0, Math.PI); x.fill();
    x.fillStyle = t === 'main' ? '#e9eef0' : '#cfe6df'; x.globalAlpha = .95; for (let i = 0; i < 6; i++) { x.fillRect(cx - 33, 36 + i * 7.4, 66, 4.4); } x.globalAlpha = 1;
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.3 * thick; x.beginPath(); x.moveTo(cx + 36, 30); x.quadraticCurveTo(cx + 54, 44, cx + 40, 62); x.stroke();
    x.fillStyle = '#fff'; x.font = '700 10px sans-serif'; x.textAlign = 'center'; x.fillText((it.name.match(/\d(\.\d)?호/) || [''])[0], cx, 100); ptag(cx - 36, 12); return;
  }
  if (t === 'float') {
    const k = it.kind;
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(cx, H - 10, 22, 4, 0, 0, 7); x.fill();
    if (k === 'hole') { x.fillStyle = grad('#ffe14a', '#e0a010', 18, 80); x.beginPath(); x.ellipse(cx, 52, 24, 28, 0, 0, 7); x.fill(); x.strokeStyle = '#7a5200'; x.lineWidth = 1.4; x.stroke(); x.fillStyle = br; x.fillRect(cx - 22, 40, 44, 7); x.fillStyle = '#10161a'; x.beginPath(); x.ellipse(cx, 52, 6, 28, 0, 0, 7); x.globalAlpha = .75; x.fill(); x.globalAlpha = 1; x.fillStyle = '#e8eef0'; x.fillRect(cx - 2, 8, 4, 12); }
    else { const self = k === 'self'; x.fillStyle = '#e8eef0'; x.fillRect(cx - 2, 10, 4, 14); x.fillStyle = '#ff5a3c'; x.fillRect(cx - 4, 24, 8, 24); x.fillStyle = '#fff3a0'; x.fillRect(cx - 4, 48, 8, 8); x.fillStyle = grad('#f7f2e4', '#bdb49a', 56, 88); x.beginPath(); x.ellipse(cx, 70, 11, 18, 0, 0, 7); x.fill(); x.strokeStyle = br; x.lineWidth = 3; x.beginPath(); x.ellipse(cx, 70, 11, 18, 0, 0, 7); x.stroke(); if (self) { x.fillStyle = '#4a5560'; x.fillRect(cx - 3, 84, 6, 12); } else { x.strokeStyle = '#8a97a0'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx, 88); x.lineTo(cx, 98); x.stroke(); } }
    ptag(cx + 28, 94); return;
  }
}
function itemURL(it, kind) {
  const k = 'i' + it.id; if (ICON_CACHE[k]) return ICON_CACHE[k];
  const [c, x] = mkCv(120, 110); x.clearRect(0, 0, 120, 110);
  const g = x.createRadialGradient(60, 55, 6, 60, 55, 70); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 120, 110);
  try { drawItem(x, it, kind || it.slot || it.type, 120, 110); } catch (e) { }
  return ICON_CACHE[k] = c.toDataURL('image/png');
}

/* ================= UI 연결 ================= */
const $ = id => document.getElementById(id);
const el = {
  time: $('hud-time'), date: $('hud-date'), tide: $('hud-tide'), wx: $('hud-wx'), money: $('hud-money'), cond: $('hud-cond'),
  toast: $('toast'), meter: $('meter'), mzone: $('meter-zone'), mcur: $('meter-cur'),
  gauge: $('gauge'), gstate: $('g-state'), glen: $('g-len'), gneedle: $('g-needle'), gdist: $('g-dist'),
  result: $('result'), spots: $('spots'), baits: $('baits'), baitState: $('bait-state'),
  depth: $('depth'), depthVal: $('depth-val'), depthHint: $('depth-hint'), chum: $('chum'),
  main: $('btn-main'), alt: $('btn-alt'), pCatch: $('p-catch'), pDex: $('p-dex')
};

let toastT = 0;
function say(msg, ms) {
  el.toast.textContent = msg; el.toast.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('on'), ms || 2200);
}

/* 저장 */
const KEY = 'jjinaksi.v1';
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ stock: G.stock, rig: G.rig, owned: G.owned, equip: G.equip, recipe: G.recipe, xp: G.xp, spotId: G.spotId, baitId: G.baitId, floatKind: G.floatKind, rodType: G.rodType, money: G.money, earned: G.earned, dex: G.dex, unlocked: G.unlocked, catches: G.catches, dragAuto: G.dragAuto, dragBase: G.dragBase, depthMode: G.depthMode, depthPct: G.depthPct, depth: G.depth })); } catch (e) {}
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!s) return;
    if (typeof s.dragAuto === 'boolean') G.dragAuto = s.dragAuto; if (s.dragBase >= 0 && s.dragBase <= 1) G.dragBase = s.dragBase;
    if (s.depthMode === 'pct' || s.depthMode === 'm') G.depthMode = s.depthMode; if (s.depthPct >= 10 && s.depthPct <= 95) G.depthPct = s.depthPct | 0; if (s.depth >= .5 && s.depth <= 30) G.depth = s.depth;
    if (typeof s.money === 'number') G.money = TEST_MAXLEVEL ? Math.max(s.money, 100000000) : s.money;
    if (s.recipe && typeof s.recipe === 'object') for (const g of CHUM_ING) G.recipe[g.id] = Math.max(0, Math.min(40, s.recipe[g.id] | 0));
    if (s.owned && typeof s.owned === 'object') for (const k in s.owned) if (itemById(k) && s.owned[k]) G.owned[k] = true;
    if (s.equip && typeof s.equip === 'object') for (const sl in SLOTS) { const it = itemById(s.equip[sl]); if (it && it.slot === sl && G.owned[it.id]) G.equip[sl] = it.id; }
    if (s.stock && typeof s.stock === 'object') for (const k in s.stock) if (tackleById(k) && (s.stock[k] | 0) > 0) G.stock[k] = s.stock[k] | 0;
    if (s.rig && typeof s.rig === 'object') for (const t in TACKLE_TYPE) { const it = tackleById(s.rig[t]); if (it && it.type === t) G.rig[t] = it.id; }
    if (typeof s.xp === 'number') G.xp = TEST_MAXLEVEL ? Math.max(s.xp, xpFor(MAX_LV)) : s.xp;
    if (SPOTS.some(x => x.id === s.spotId) && SPOTS.find(x => x.id === s.spotId).lv <= levelOf(G.xp)) G.spotId = s.spotId;
    if (BAITS.some(b => b.id === s.baitId)) G.baitId = s.baitId;
    if (s.floatKind === 'hole' || s.floatKind === 'rod') G.floatKind = s.floatKind;
    if (s.rodType === 'self' || s.rodType === 'non') G.rodType = s.rodType;
    if (typeof s.earned === 'number') G.earned = s.earned;
    if (s.dex && typeof s.dex === 'object') G.dex = s.dex;
    if (s.unlocked && typeof s.unlocked === 'object') G.unlocked = Object.assign({ jetty: true }, s.unlocked);
    if (Array.isArray(s.catches)) G.catches = s.catches;
  } catch (e) {}
}

/* 조과 카드 */
let resT = 0;
function showResult(r) {
  $('res-name').textContent = r.f.name;
  $('res-meta').textContent = r.L + 'cm · ' + r.kg.toFixed(2) + 'kg';
  $('res-val').textContent = r.value ? won(r.value) : '놓아주기';
  $('res-note').textContent = r.f.thief ? '독이 있어 놓아줬어요' : (r.first ? '도감에 새로 등록! ' : r.record ? '나의 최대 기록! ' : '') + (r.gain ? '+' + r.gain + ' XP' : '');
  drawResultFish(r.f, r.L);
  el.result.hidden = false; clearTimeout(resT); resT = setTimeout(() => { el.result.hidden = true; }, 3600);
  renderCatch(); renderDex(); renderSpots();
}
el.result.addEventListener('pointerdown', () => { el.result.hidden = true; });

/* 패널 */
function renderSpots() {
  el.spots.innerHTML = ''; const lv = levelOf(G.xp); let tier = '';
  SPOTS.forEach(s => {
    if (s.tier !== tier) { tier = s.tier; const h = document.createElement('div'); h.className = 'seg-h'; h.textContent = s.tierLabel + (s.type === 'tetra' ? ' · 테트라포드' : s.type === 'rock' ? ' · 갯바위' : ' · 여'); el.spots.appendChild(h); }
    const b = document.createElement('button'), ok = s.lv <= lv;
    b.className = 'seg-btn' + (G.spotId === s.id ? ' on' : ''); b.title = s.desc;
    b.innerHTML = '<b>' + s.name + '</b><small>' + (ok ? s.region + ' · 수심 ' + s.depth + 'm · ' + s.desc : '🔒 Lv.' + s.lv + ' 필요 · ' + s.region) + '</small>';
    b.disabled = !ok || G.mode !== 'idle'; if (!ok) b.classList.add('lock');
    b.onclick = () => {
      if (G.mode !== 'idle') return;
      G.spotId = s.id; G.depth = Math.min(G.depth, s.depth - .5); G.baited = false;
      renderSpots(); syncDepth(); save(); $('menu').hidden = true; say(s.name + ' · ' + s.desc, 3000);
    };
    el.spots.appendChild(b);
  });
}
function renderBaits() {
  el.baits.innerHTML = '';
  BAITS.forEach(b => {
    const n = document.createElement('button');
    n.className = 'bait' + (G.baitId === b.id ? ' on' : '');
    n.innerHTML = '<span class="pr mono">' + won(b.price) + '</span><b>' + b.name + '</b><small>' + b.note + '</small>';
    n.disabled = G.mode !== 'idle';
    n.onclick = () => { if (G.mode !== 'idle' || G.baitId === b.id) return; G.baitId = b.id; G.baited = false; renderBaits(); save(); say(b.name + ' 선택 · 다음 캐스팅부터 계속 사용해요'); };
    el.baits.appendChild(n);
  });
  el.baitState.textContent = G.baitId ? (G.baited ? '끼워짐' : '새로 끼움') : '없음';
}
function depthTexts() {
  const pc = G.depthMode === 'pct', ed = effDepth();
  el.depthVal.textContent = pc ? G.depthPct + '% · 약 ' + rigDepth().toFixed(1) + 'm' : G.depth.toFixed(1) + 'm';
  el.depthHint.textContent = '현재 수심 ' + ed.toFixed(1) + 'm' + (pc ? ' · 물때 따라 자동' : '');
}
function syncDepth() {
  const sp = spot(), pc = G.depthMode === 'pct';
  $('dm-m').classList.toggle('on', !pc); $('dm-p').classList.toggle('on', pc);
  if (pc) { el.depth.min = 10; el.depth.max = 95; el.depth.step = 5; el.depth.value = G.depthPct; }
  else { el.depth.min = .5; el.depth.step = .5; el.depth.max = sp.depth - .5; if (G.depth > sp.depth - .5) G.depth = sp.depth - .5; el.depth.value = G.depth; }
  depthTexts(); el.depth.disabled = G.mode !== 'idle';
}
$('dm-m').addEventListener('click', () => { if (G.mode !== 'idle') return; G.depthMode = 'm'; syncDepth(); save(); });
$('dm-p').addEventListener('click', () => { if (G.mode !== 'idle') return; G.depthMode = 'pct'; syncDepth(); save(); });
el.depth.addEventListener('input', () => { if (G.depthMode === 'pct') G.depthPct = +el.depth.value; else G.depth = +el.depth.value; syncDepth(); save(); });
el.chum.addEventListener('click', () => { throwChum(); renderChum(); });
let shopSlot = 'rod';
const SHOP_CATS = [['rod', '낚싯대'], ['reel', '릴'], ['tackle', '채비'], ['box', '가방·상자'], ['hat', '모자'], ['top', '옷'], ['vest', '구명조끼'], ['boots', '신발']];
const hexOf = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const brandChip = b => b ? '<span class="brand" style="background:' + BRANDS[b].col + '">' + BRANDS[b].name + '</span>' : '';
const qLabel = q => q > .85 ? '카랑카랑 · 경쾌' : q > .6 ? '맑고 높음' : q > .35 ? '보통' : '낮고 투박';
function previewReel(q) { SFX.unlock(); SFX.setDrag(.7, q); setTimeout(() => SFX.setDrag(0, q), 900); }
function buyMsg(t) { say(t); renderShop(); renderRigSum(); }
function card(html, cls, it) { const d = document.createElement('div'); d.className = 'item' + (cls ? ' ' + cls : ''); d.innerHTML = it ? '<div class="ihead"><img class="ico" alt="" src="' + itemURL(it, it.slot || it.type) + '"><div class="itx">' + html + '</div></div>' : html; return d; }
function rowOf(d, left, btns) { const r = document.createElement('div'); r.className = 'row'; const sp = document.createElement('span'); sp.className = 'mono'; sp.style.cssText = 'color:var(--tip);font-size:12.5px'; sp.innerHTML = left; r.appendChild(sp); const w = document.createElement('span'); w.style.cssText = 'display:flex;gap:6px'; btns.forEach(b => w.appendChild(b)); r.appendChild(w); d.appendChild(r); }
function mkBtn(txt, fn, o) { const b = document.createElement('button'); b.textContent = txt; if (o && o.buy) b.className = 'buy'; b.disabled = !!(o && o.dis); if (fn) b.onclick = fn; return b; }
let gearTab = false;
function renderShop() {
  const GEAR = gearTab, P = $(GEAR ? 'p-gear' : 'p-shop'), lv = levelOf(G.xp); P.innerHTML = '';
  const sub = document.createElement('div'); sub.className = 'shop-sub';
  SHOP_CATS.forEach(([k, n]) => { const b = document.createElement('button'); b.textContent = n; b.className = k === shopSlot ? 'on' : ''; b.onclick = () => { shopSlot = k; renderShop(); }; sub.appendChild(b); });
  const mo = document.createElement('span'); mo.className = 'shop-money mono'; mo.textContent = '소지금 ' + won(G.money); sub.appendChild(mo); P.appendChild(sub);
  const grid = document.createElement('div'); grid.className = 'items';
  if (shopSlot === 'tackle') {
    const used = boxUsed(), cap = boxCap(), info = document.createElement('div'); info.style.gridColumn = '1/-1';
    info.innerHTML = '<div class="stat">태클박스 <b class="mono">' + used + ' / ' + cap + '칸</b> <span style="color:var(--mute)">· 가방·상자 탭에서 더 큰 태클박스를 살 수 있어요</span></div><div class="tbar"><i style="width:' + Math.min(100, used / cap * 100) + '%"></i></div>';
    grid.appendChild(info);
    Object.keys(TACKLE_TYPE).forEach(t => {
      const h = document.createElement('div'); h.className = 'sect'; h.textContent = TACKLE_TYPE[t] + ' · 사용 중: ' + rigItem(t).name; grid.appendChild(h);
      TACKLE.filter(x => x.type === t).forEach(it => {
        const have = it.free ? Infinity : (G.stock[it.id] || 0), eq = G.rig[t] === it.id && (it.free || have > 0), lock = (it.lv || 1) > lv;
        if (GEAR && !(it.free || have > 0)) return;
        let fx = it.type === 'hook' ? '챔질 관대 +' + it.g * 10 + '%' : it.type === 'leader' ? '강도 ' + (it.str >= 0 ? '+' : '') + Math.round(it.str * 100) + '% · 입질 ' + (it.bite >= 0 ? '+' : '') + Math.round(it.bite * 100) + '%' : it.type === 'main' ? '강도 ' + (it.str >= 0 ? '+' : '') + Math.round(it.str * 100) + '% · 캐스팅 ' + (it.cast >= 0 ? '+' : '') + Math.round(it.cast * 100) + '%' : it.type === 'swivel' ? '과부하 감소 ' + Math.round(it.over * 100) + '%' : '캐스팅 ' + (it.dist >= 1 ? '+' : '') + Math.round((it.dist - 1) * 100) + '% · 시인성 ' + (it.vis >= 1 ? '+' : '') + Math.round((it.vis - 1) * 100) + '%';
        const d = card('<h5>' + brandChip(it.brand) + it.name + '</h5><p>' + it.desc + '</p><div class="stat">' + fx + '</div>' + (it.free ? '<div class="own">기본 · 무제한</div>' : have ? '<div class="own">보유 ' + have + '개</div>' : ''), eq ? 'eq' : '', it);
        const btns = [];
        if (!it.free && !GEAR) { const full = used + it.pack > cap; btns.push(mkBtn('+' + it.pack + ' 구매', () => { if (G.money < it.price) return; if (boxUsed() + it.pack > boxCap()) return say('태클박스가 가득 찼어요'); G.money -= it.price; G.stock[it.id] = (G.stock[it.id] || 0) + it.pack; save(); buyMsg(it.name + ' ' + it.pack + '개 구매'); }, { buy: true, dis: lock || G.money < it.price || full })); }
        if (GEAR && (it.free || have > 0)) btns.push(mkBtn(eq ? '사용 중' : '장착', () => { if (G.mode !== 'idle') return; (it.type === 'float') ? setFloatItem(it.id) : G.rig[t] = it.id; save(); renderShop(); renderRigSum(); renderFloats(); }, { dis: eq || G.mode !== 'idle' }));
        rowOf(d, GEAR ? (it.free ? '' : '보유 ' + have + '개') : it.free ? '' : lock ? '🔒 Lv.' + it.lv : won(it.price) + ' / ' + it.pack + '개', btns); grid.appendChild(d);
      });
    });
  } else if (shopSlot === 'box') {
    ['tbox', 'bag', 'case'].forEach(sl => {
      const h = document.createElement('div'); h.className = 'sect'; h.textContent = BOX_NAME[sl] + ' · 현재 용량 ' + bestCap(sl) + (sl === 'tbox' ? '칸' : sl === 'bag' ? '개 (밑밥 재료)' : '개 (보유 낚싯대)'); grid.appendChild(h);
      SHOP_ITEMS.filter(x => x.slot === sl).forEach(it => {
        const own = !!G.owned[it.id], lock = it.lv > lv, best = own && it.cap === bestCap(sl);
        if (GEAR && !own) return;
        const d = card('<h5>' + brandChip(it.brand) + it.name + '</h5><p>' + it.desc + '</p>', best ? 'eq' : '', it);
        rowOf(d, own ? (best ? '사용 중' : '보유') : lock ? '🔒 Lv.' + it.lv : won(it.price), [mkBtn(own ? '보유' : '구매', () => { if (G.money < it.price) return; G.money -= it.price; G.owned[it.id] = true; save(); buyMsg(it.name + ' 구매 · 용량 ' + it.cap); }, { buy: !own, dis: own || lock || G.money < it.price })]);
        grid.appendChild(d);
      });
    });
  } else {
    if (shopSlot === 'rod') { const info = document.createElement('div'); info.style.gridColumn = '1/-1'; info.innerHTML = '<div class="stat">보유 낚싯대 <b class="mono">' + rodCount() + ' / ' + rodCap() + '개</b> <span style="color:var(--mute)">· 낚싯대 가방이 클수록 더 많이 가질 수 있어요 (가방·상자 탭)</span></div>'; grid.appendChild(info); }
    SHOP_ITEMS.filter(it => it.slot === shopSlot).forEach(it => {
      const own = !!G.owned[it.id], eq = G.equip[it.slot] === it.id, lock = it.lv > lv, br = brandChip(it.brand);
      if (GEAR && !own) return;
      let stat = '';
      if (it.slot === 'rod') stat = '<div class="stat">파이팅 <i>' + (it.ease ? '+' + Math.round(it.ease * 100) + '%' : '기본') + '</i> · 캐스팅 거리 <i>' + (it.cast > 1 ? '+' + Math.round((it.cast - 1) * 100) + '%' : '기본') + '</i></div>';
      else if (it.slot === 'reel') stat = '<div class="stat">' + (it.type === 'lever' ? '<b style="color:var(--tip)">브레이크레버릴</b>' : '일반 드랙릴') + ' · 감기 <i>' + (it.speed ? '+' + Math.round(it.speed * 100) + '%' : '기본') + '</i> · 드랙음 <i>' + qLabel(it.q) + '</i></div>';
      else { const cs = it.slot === 'top' ? [it.c, it.p] : [it.c]; stat = '<div class="stat">색상<span class="sw">' + cs.map(c => '<i style="background:' + hexOf(c) + '"></i>').join('') + '</span>' + (it.style ? ' · ' + ({ cap: '캡', bucket: '버킷햇', wide: '와이드햇' })[it.style] : '') + '</div>'; }
      const d = card('<h5>' + br + it.name + '</h5><p>' + it.desc + (it.brand ? ' · ' + BRANDS[it.brand].tag : '') + (it.type === 'lever' ? ' · Lv.' + LEVER_MIN_LV + '부터' : '') + '</p>' + stat, eq ? 'eq' : '', it);
      const btns = [];
      if (it.slot === 'reel') btns.push(mkBtn('🔊', () => previewReel(it.q), {}));
      let left;
      if (eq) { left = '장착 중'; btns.push(mkBtn('장착됨', null, { dis: true })); }
      else if (own && !GEAR) { left = '보유'; btns.push(mkBtn('보유', null, { dis: true })); }
      else if (own) {
        left = '보유'; btns.push(mkBtn('장착', () => { G.equip[it.slot] = it.id; save(); buyMsg(it.name + ' 장착'); renderRodName(); }, { dis: G.mode !== 'idle' }));
        if (it.slot === 'rod' || it.slot === 'reel') btns.push(mkBtn('판매', () => { G.owned[it.id] = false; delete G.owned[it.id]; G.money += Math.round(it.price * .5); save(); buyMsg(it.name + ' 판매 ' + won(it.price * .5)); }, { dis: it.price === 0 }));
      } else if (lock) { left = '🔒 Lv.' + it.lv; btns.push(mkBtn('레벨 부족', null, { dis: true })); }
      else {
        left = won(it.price); const capFull = it.slot === 'rod' && rodCount() >= rodCap();
        btns.push(mkBtn(capFull ? '가방 가득' : '구매', () => { if (G.money < it.price) return; G.money -= it.price; G.owned[it.id] = true; if (G.mode === 'idle') G.equip[it.slot] = it.id; save(); buyMsg(it.name + ' 구매' + (G.mode === 'idle' ? ' · 장착했어요' : '')); renderRodName(); }, { buy: true, dis: G.money < it.price || capFull }));
      }
      rowOf(d, left, btns); grid.appendChild(d);
    });
  }
  P.appendChild(grid);
}
/* 찌 선택: 보유한 가장 좋은 찌를 우선 사용 */
function setFloatItem(id) { const it = tackleById(id); G.rig.float = id; if (it.kind === 'hole') G.floatKind = 'hole'; else { G.floatKind = 'rod'; G.rodType = it.kind; } }
function chooseFloat(kind) {
  const best = TACKLE.filter(x => x.type === 'float' && x.kind === kind && (x.free || (G.stock[x.id] || 0) > 0)).pop(); setFloatItem(best.id);
}
function renderRigSum() {
  const R = reelItem(), nm = t => { const it = rigItem(t); return it.free ? it.name : it.name + ' ×' + (G.stock[it.id] || 0); };
  $('rig-sum').innerHTML = '릴 <b>' + R.name + '</b> (' + (R.type === 'lever' ? '레버' : '드랙') + ')<br>바늘 <b>' + nm('hook') + '</b><br>목줄 <b>' + nm('leader') + '</b><br>원줄 <b>' + nm('main') + '</b> · 도래 <b>' + nm('swivel') + '</b><br>찌 <b>' + nm('float') + '</b><br><span style="color:var(--mute)">태클박스 ' + boxUsed() + ' / ' + boxCap() + '칸</span>';
}
function renderRodName() { const r = rodItem(); $('rod-name').textContent = r.name; }
$('shop-open').addEventListener('click', () => { $('menu').hidden = false; openTab('gear'); });
function openTab(name) {
  document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', String(x.dataset.tab === name)));
  $('p-spots').hidden = name !== 'spots'; $('p-chum').hidden = name !== 'chum'; $('p-shop').hidden = name !== 'shop'; $('p-gear').hidden = name !== 'gear'; $('p-drag').hidden = name !== 'drag'; el.pCatch.hidden = name !== 'catch'; el.pDex.hidden = name !== 'dex';
  if (name === 'drag') renderDrag(); if (name === 'chum') renderChum(); if (name === 'shop' || name === 'gear') { gearTab = name === 'gear'; renderShop(); } if (name === 'catch') renderCatch(); if (name === 'dex') renderDex(); if (name === 'spots') renderSpots();
}
const recipeText = () => CHUM_ING.filter(g => G.recipe[g.id]).map(g => g.name.replace('용 파우더', '파우더') + G.recipe[g.id]).join(' · ') || '재료 없음';
function renderChum() {
  const P = $('p-chum'), r = G.recipe, m = chumMix(r), T = m.T; P.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'chum-wrap';
  const left = document.createElement('div'), right = document.createElement('div'); right.className = 'mixbox';
  const pre = document.createElement('div'); pre.className = 'presets'; pre.innerHTML = '<small style="color:var(--mute);align-self:center">추천 배합</small>';
  CHUM_PRESETS.forEach(pr => { const b = document.createElement('button'); b.textContent = pr.name; b.onclick = () => { Object.assign(G.recipe, { krill: 0, bread: 0, pgam: 0, pbeng: 0 }, pr.r); save(); renderChum(); renderChumBtn(); }; pre.appendChild(b); });
  left.appendChild(pre);
  CHUM_ING.forEach(g => {
    const row = document.createElement('div'); row.className = 'ci';
    row.innerHTML = '<span><b>' + g.name + '</b><span class="pr mono">' + won(g.price) + '</span></span><small>' + g.note + '</small>';
    const st = document.createElement('div'); st.className = 'step';
    const mk = (t, d) => { const b = document.createElement('button'); b.textContent = t; b.disabled = d < 0 ? !r[g.id] : T >= chumCap(); b.onclick = () => { r[g.id] = Math.max(0, (r[g.id] || 0) + d); save(); renderChum(); renderChumBtn(); }; return b; };
    const n = document.createElement('span'); n.className = 'n mono'; n.textContent = r[g.id] || 0;
    st.append(mk('−', -1), n, mk('+', 1)); row.appendChild(st); left.appendChild(row);
  });
  const bar = CHUM_ING.map(g => '<i style="flex:' + (r[g.id] || 0) + ';background:' + g.col + '"></i>').join('');
  const top = FISH.map(f => ({ f, x: m.mul[f.id] || 1, ok: (spot().mult[f.id] || 0) > 0 })).filter(o => o.ok && o.x >= 1.25).sort((a, b) => b.x - a.x).slice(0, 5);
  right.innerHTML = '<b>지금 배합</b><div class="mixbar">' + (T ? bar : '') + '</div><div class="fx-li">재료 ' + T + ' / ' + chumCap() + '개 · ' + recipeText() + '</div>' +
    (T ? '<div class="fx-li">효과 지속 <i class="mono">' + m.dur + '초</i> · 비용 <i class="mono">' + won(m.cost) + '</i></div>' : '') +
    '<div class="fx-li" style="color:var(--mute)">' + (T ? '이 포인트에서 잘 모이는 고기' : '재료를 담아보세요') + '</div>' +
    top.map(o => '<div class="fx-li">' + o.f.name + ' <i class="mono">×' + o.x.toFixed(1) + '</i></div>').join('') + (m.warn ? '<div class="fx-li" style="color:var(--danger)">' + m.warn + '</div>' : '');
  const go = document.createElement('button'); go.className = 'ghost'; go.style.marginTop = '4px'; go.style.fontWeight = '600';
  go.textContent = G.chum > 0 ? '다시 뿌리기 (남은 ' + Math.ceil(G.chum) + '초)' : '이 배합으로 밑밥 뿌리기'; go.disabled = !T || ['casting', 'fight', 'flying'].includes(G.mode);
  go.onclick = () => { throwChum(); renderChum(); };
  right.appendChild(go); wrap.append(left, right); P.appendChild(wrap);
}
function renderChumBtn() { $('chum-sum').textContent = ''; }

function renderCatch() {
  if (!G.catches.length) { el.pCatch.innerHTML = '<div class="empty">아직 잡은 고기가 없어요. 찌를 지켜보세요.</div>'; return; }
  const total = G.catches.reduce((s, c) => s + c.value, 0);
  el.pCatch.innerHTML = '<div class="empty">최근 ' + G.catches.length + '마리 · 합계 <b class="mono">' + won(total) + '</b></div><ul class="list">' +
    G.catches.map(c => '<li><span>' + c.name + ' ' + c.L + 'cm · ' + c.kg.toFixed(2) + 'kg <small style="color:var(--mute)">' + c.spot + '</small></span><span class="mono">' + (c.value ? won(c.value) : '방생') + '</span></li>').join('') + '</ul>';
}
function renderDex() {
  const grid = document.createElement('div'); grid.className = 'dex';
  FISH.forEach(f => {
    const d = G.dex[f.id], card = document.createElement('div'); card.className = 'card' + (d ? '' : ' lock');
    if (d) {
      const top2 = Object.keys(f.baits).sort((a, b) => f.baits[b] - f.baits[a]).slice(0, 2).map(id => BAITS.find(x => x.id === id).name).join('·');
      card.innerHTML = '<img class="fimg" alt="' + f.name + '" src="' + fishURL(f, false) + '"><h3>' + f.name + (f.junk ? ' <small style="color:var(--mute);font-weight:400">잡어</small>' : '') + '</h3><p>' + f.tip + '</p><p class="mono">최대 ' + d.maxL + 'cm · ' + d.n + '마리</p><p>수심 ' + f.depth[0] + '~' + f.depth[1] + 'm · ' + top2 + '</p>';
    } else card.innerHTML = '<img class="fimg" alt="미발견" src="' + fishURL(f, true) + '"><h3>???</h3><p>아직 만나지 못했어요</p>';
    grid.appendChild(card);
  });
  el.pDex.innerHTML = ''; el.pDex.appendChild(grid);
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
$('btn-menu').addEventListener('click', () => { $('menu').hidden = false; openTab(document.querySelector('.tab[aria-selected=true]').dataset.tab); });
$('btn-close').addEventListener('click', () => { $('menu').hidden = true; });
$('menu').addEventListener('pointerdown', e => { if (e.target === $('menu')) $('menu').hidden = true; });

/* 찌 선택 */
function renderFloats() {
  const mk = (id, txt, on, fn) => { const b = document.createElement('button'); b.className = 'seg2' + (on ? ' on' : ''); b.textContent = txt; b.disabled = G.mode !== 'idle'; b.onclick = fn; $(id).appendChild(b); };
  $('f-kind').innerHTML = ''; $('f-type').innerHTML = '';
  mk('f-kind', '구멍찌', G.floatKind === 'hole', () => { chooseFloat('hole'); renderFloats(); renderRigSum(); save(); });
  mk('f-kind', '막대찌', G.floatKind === 'rod', () => { chooseFloat(G.rodType); renderFloats(); renderRigSum(); save(); });
  $('f-type').hidden = G.floatKind !== 'rod';
  mk('f-type', '자립', G.rodType === 'self', () => { chooseFloat('self'); renderFloats(); renderRigSum(); save(); });
  mk('f-type', '비자립', G.rodType === 'non', () => { chooseFloat('non'); renderFloats(); renderRigSum(); save(); });
  $('f-note').textContent = FT().note;
}

/* 조작 */
function primaryDown() {
  switch (G.mode) {
    case 'idle': if (!G.baitId) return say('먼저 미끼를 고르세요'); el.result.hidden = true; startCast(); break;
    case 'casting': throwCast(); break;
    case 'waiting': case 'bite': strike(); break;
    case 'fight': G.reeling = true; break;
  }
}
function primaryUp() { if (G.mode === 'fight') G.reeling = false; }
el.main.addEventListener('pointerdown', e => { e.preventDefault(); try { el.main.setPointerCapture(e.pointerId); } catch (x) {} primaryDown(); });
['pointerup', 'pointercancel'].forEach(n => el.main.addEventListener(n, primaryUp));
el.alt.addEventListener('click', retrieve);
window.addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.repeat) return;
  const t = e.target;
  if (t.tagName === 'INPUT' || (t.tagName === 'BUTTON' && t.id !== 'btn-main')) return;
  e.preventDefault(); primaryDown();
});
window.addEventListener('keyup', e => { if (e.code === 'Space') primaryUp(); });

/* 매 프레임 UI 동기화 */
const last = {};
function setIf(k, v, fn) { if (last[k] !== v) { last[k] = v; fn(v); } }
function syncUI() {
  const m = G.mode;
  let label = '', dis = false;
  if (m === 'idle') { label = G.baitId ? '캐스팅' : '미끼를 고르세요'; dis = !G.baitId; }
  else if (m === 'casting') label = '지금 던지기!';
  else if (m === 'flying') { label = '…'; dis = true; }
  else if (m === 'waiting') label = '챔질';
  else if (m === 'bite') label = '챔질!';
  else label = '감기 (누르고 있기)';
  setIf('label', label, v => { el.main.textContent = v; });
  setIf('dis', dis, v => { el.main.disabled = v; });
  setIf('alt', m === 'waiting' || m === 'bite', v => { el.alt.hidden = !v; });
  setIf('mode', m, () => { renderSpots(); renderBaits(); renderFloats(); syncDepth(); });
  document.body.classList.toggle('clean', m === 'casting' || m === 'flying' || m === 'waiting'); $('rig').classList.toggle('off', m !== 'idle'); $('rail').classList.toggle('off', m !== 'idle'); if (m !== 'idle') document.querySelectorAll('.pop').forEach(p => p.hidden = true);
  el.meter.hidden = m !== 'casting'; el.gauge.hidden = m !== 'fight';
  if (m === 'idle' && !G.baited && G.money < BAITS[0].price) { G.money += 5000; say('용돈 ' + won(5000) + '을 받았어요'); save(); }
  if (m === 'casting') {
    const c = G.cast; el.mzone.style.left = c.zone[0] * 100 + '%'; el.mzone.style.width = (c.zone[1] - c.zone[0]) * 100 + '%'; el.mcur.style.left = c.pos * 100 + '%';
  } else if (m === 'fight') {
    const F = G.fight;
    { const thr = (.8 + rodItem().ease * .15) * 100; setIf('thr', thr, v => { document.querySelector('.z-red').style.cssText = 'left:' + v + '%;width:' + (100 - v) + '%'; document.querySelector('.z-ok').style.cssText = 'left:10%;width:' + (v - 10) + '%'; }); }
    el.gneedle.style.left = Math.min(100, F.tension * 100) + '%';
    el.gdist.style.width = Math.max(0, Math.min(100, F.dist * 100)) + '%';
    el.glen.textContent = '남은 거리 ' + Math.max(0, F.dist * 15).toFixed(0) + 'm';
    el.gstate.textContent = F.st === 'run' ? (F.lat < -.2 ? '왼쪽으로 달려요! 줄을 풀어주세요' : F.lat > .2 ? '오른쪽으로 달려요! 줄을 풀어주세요' : '저항! 줄을 풀어주세요') : F.st === 'turn' ? '방향을 틀어 달려들어요! 빨리 감으세요' : F.st === 'shake' ? '머리를 흔들어요! 버티세요' : F.warn ? '곧 달아나요. 버튼에서 손 뗄 준비' : G.reeling ? '감는 중' : '쉬는 중. 지금 감으세요';
  }
}

let hudT = 0;
function hud(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = .25;
  const mn = Math.floor(G.min);
  el.time.textContent = String(Math.floor(mn / 60) % 24).padStart(2, '0') + ':' + String(mn % 60).padStart(2, '0');
  el.date.textContent = (G.date.getMonth() + 1) + '월 ' + G.date.getDate() + '일 · ' + BAND_KO[band()];
  const T = tideInfo();
  el.tide.textContent = T.m + '물 · ' + T.stage; el.wx.textContent = WX[G.wx].name;
  const ta = spot().tideAmp, tr = tideInfo(), lvl = G.tide;
  el.cond.textContent = T.size + ' · 조류 ' + (T.flow > .8 ? '세다' : T.flow > .4 ? '보통' : '약하다') + ' · 수위 ' + (lvl >= 0 ? '+' : '') + lvl.toFixed(1) + 'm ' + (Math.abs(T.flow) < .08 ? '' : tr.rising ? '▲' : '▼');
  depthTexts();
  el.money.textContent = won(G.money);
  const L = levelOf(G.xp), a = xpFor(L), n = L >= MAX_LV ? a + 1 : xpFor(L + 1); $('hud-lv').textContent = 'Lv.' + L; $('hud-xp').style.width = (L >= MAX_LV ? 100 : (G.xp - a) / (n - a) * 100) + '%'; $('hud-xp-t').textContent = (L >= MAX_LV ? 'MAX' : (G.xp - a) + ' / ' + (n - a));
  const cm = chumMix(G.recipe);
  el.chum.style.setProperty('--p', (G.chum / (G.chumMax || 60) * 100) + '%');
  { const ht = G.chum > 0 ? '<span class="ti">🧪</span><b>효과 ' + Math.ceil(G.chum) + '초</b><small>다시 ' + won(cm.cost) + '</small>' : '<span class="ti">🧪</span><b>밑밥 뿌리기</b><small>' + won(cm.cost) + '</small>'; if (el.chum._h !== ht) { el.chum._h = ht; el.chum.innerHTML = ht; } }
  { const bi = BAITS.find(x => x.id === G.baitId); $('tile-bait-t').textContent = bi ? bi.name : '미끼 선택'; $('tile-rig-t').textContent = rigItem('float').name; }
  $('chum-sum').textContent = recipeText();
  el.chum.disabled = G.mode === 'casting' || G.mode === 'fight' || G.mode === 'flying';
}

/* 시작 */
load(); rigFix(); { const f = tackleById(G.rig.float); if (f) setFloatItem(f.id); } renderRodName(); renderRigSum(); renderFloats(); renderSpots(); renderCatch(); renderDex(); hud(1);
const GLOK = sceneInit($('gl'));
if (!GLOK) { document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;display:grid;place-items:center;background:#04141b;color:#e4f1ee;text-align:center;padding:24px;z-index:99">이 기기는 WebGL2를 지원하지 않아 게임을 실행할 수 없어요.</div>'); }
say('미끼를 고르고 캐스팅하세요', 3500);
let prev = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - prev) / 1000); prev = now;
  update(dt);
  if (GLOK) { sceneStep(dt); sceneFx(dt); sceneRender(); overlayDraw(dt); }
  SFX.update(dt); dragUI(); { const F = G.fight, w = $('warn'); const on = G.mode === 'fight' && !!F && F.tension > (F.SN || .9) * .88; SFX._warn = on; if (w) w.classList.toggle('on', on); }
  syncUI(); hud(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);


/* ===== 드랙 · 레버 · 소리 조작 ===== */
let dragTimer = 0;
function nudgeDrag(d) { if (G.mode === 'fight' && G.fight && G.fight.manual) { G.drag = clamp(G.drag + d, 0, 1); } }
function holdDrag(btn, d) {
  const stop = () => { clearInterval(dragTimer); };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); nudgeDrag(d); stop(); dragTimer = setInterval(() => nudgeDrag(d), 70); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => btn.addEventListener(n, stop));
}
holdDrag($('drag-up'), .035); holdDrag($('drag-dn'), -.035);
const leverBtn = $('btn-lever');
function leverSet(v) { if (G.mode !== 'fight' || reelItem().type !== 'lever') v = false; if (v && !G.lever) sfx('lever'); G.lever = v; leverBtn.classList.toggle('on', v); }
leverBtn.addEventListener('pointerdown', e => { e.preventDefault(); try { leverBtn.setPointerCapture(e.pointerId); } catch (x) {} leverSet(true); });
['pointerup', 'pointercancel'].forEach(n => leverBtn.addEventListener(n, () => leverSet(false)));
window.addEventListener('keydown', e => {
  if (e.repeat) { if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault(); }
  if (e.code === 'ArrowUp') { nudgeDrag(.04); e.preventDefault(); } else if (e.code === 'ArrowDown') { nudgeDrag(-.04); e.preventDefault(); }
  else if ((e.code === 'KeyB' || e.code === 'ShiftLeft') && !e.repeat) leverSet(true);
});
window.addEventListener('keyup', e => { if (e.code === 'KeyB' || e.code === 'ShiftLeft') leverSet(false); });
$('stage').addEventListener('wheel', e => { if (G.mode === 'fight') nudgeDrag(e.deltaY < 0 ? .04 : -.04); }, { passive: true });
const qBtn = $('btn-q');
function setQuality(q) { ENV.q = q; qBtn.textContent = q > .5 ? '고화질' : '절전'; resizeGL(); try { localStorage.setItem('jjinaksi.q', q > .5 ? '1' : '0'); } catch (e) {} }
qBtn.addEventListener('click', () => setQuality(ENV.q > .5 ? 0 : 1));
try { if (localStorage.getItem('jjinaksi.q') === '0') setQuality(0); } catch (e) {}
const sndBtn = $('btn-snd');
try { if (localStorage.getItem('jjinaksi.mute') === '1') { SFX.on = false; sndBtn.textContent = '🔇'; } } catch (e) {}
sndBtn.addEventListener('click', () => { SFX.unlock(); SFX.setOn(!SFX.on); sndBtn.textContent = SFX.on ? '🔊' : '🔇'; try { localStorage.setItem('jjinaksi.mute', SFX.on ? '0' : '1'); } catch (e) {} });
function dragUI() {
  const F = G.fight, show = G.mode === 'fight' && !!F; $('dragbox').hidden = !(show && F.manual);
  leverBtn.hidden = !(show && reelItem().type === 'lever'); if (!show) { if (G.lever) leverSet(false); return; }
  if (!F.manual) return;
  const R = reelItem(), auto = false, thr = auto ? .72 + R.q * .08 + rodItem().ease * .05 : .35 + G.drag * .55, pos = clamp((thr - .35) / .55, 0, 1);
  $('dragbox').classList.toggle('auto', auto); $('drag-mode').textContent = auto ? '자동 세팅' : '수동 조절';
  $('drag-thumb').style.top = ((1 - pos) * 100) + '%'; $('drag-auto').style.top = ((1 - clamp((.72 + R.q * .08 + rodItem().ease * .05 - .35) / .55, 0, 1)) * 100) + '%';
  $('drag-hint').textContent = auto ? '보통 고기는 릴이 알아서 맞춰요' : F.dragOut > .1 ? '줄이 풀려나가는 중!' : F.tension > .7 ? '위험! 드랙을 풀어요 ▼' : '대물이에요. 조이면 강하게, 풀면 줄이 나가요';
}

/* 모바일 레이아웃: 좌측 메뉴 · 하단 퀵슬롯 · 팝업 */
document.querySelectorAll('#rail [data-open]').forEach(b => b.addEventListener('click', () => { $('rail').classList.remove('open'); $('menu').hidden = false; openTab(b.dataset.open); }));
$('rail-t').addEventListener('click', e => { e.stopPropagation(); $('rail').classList.toggle('open'); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('#rail')) $('rail').classList.remove('open'); });
document.querySelectorAll('[data-pop]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const id = b.dataset.pop; document.querySelectorAll('.pop').forEach(p => { p.hidden = p.id === id ? !p.hidden : true; }); }));
document.addEventListener('pointerdown', e => { if (!e.target.closest('.pop') && !e.target.closest('[data-pop]')) document.querySelectorAll('.pop').forEach(p => p.hidden = true); });
$('baits').addEventListener('click', () => setTimeout(() => { $('pop-bait').hidden = true; }, 120));

/* 드랙 설정 탭 */
function renderDrag() {
  const P = $('p-drag'), R = reelItem(), lv = R.type === 'lever'; P.innerHTML = '';
  const w = document.createElement('div'); w.className = 'dragtab';
  const mk = (on, t, d, fn) => { const b = document.createElement('button'); b.className = 'dmode' + (on ? ' on' : ''); b.innerHTML = '<b>' + t + '</b><small>' + d + '</small>'; b.onclick = fn; return b; };
  const row = document.createElement('div'); row.className = 'dmodes';
  row.appendChild(mk(G.dragAuto, '자동 드랙', '릴이 알아서 맞춰요. 파이팅 중 드랙 조작 화면이 나오지 않아요', () => { if (G.mode === 'fight') return; G.dragAuto = true; save(); renderDrag(); }));
  row.appendChild(mk(!G.dragAuto, '수동 드랙', '파이팅 중 ▲▼로 직접 조절해요. 잘 쓰면 대물도 안전하게 잡아요', () => { if (G.mode === 'fight') return; G.dragAuto = false; save(); renderDrag(); }));
  w.appendChild(row);
  if (!G.dragAuto) {
    const b = document.createElement('div'); b.className = 'dset';
    b.innerHTML = '<h4><span>시작 드랙 세기</span><b class="mono" id="dbase-v">' + Math.round(G.dragBase * 100) + '%</b></h4><input type="range" id="dbase" min="0" max="100" step="5" value="' + Math.round(G.dragBase * 100) + '"><small>고기가 걸렸을 때 드랙이 이 세기에서 시작해요. 세게 잡으면 힘 센 고기에 줄이 터질 수 있고, 약하면 줄이 계속 풀려요.</small>';
    w.appendChild(b);
    setTimeout(() => { const r = $('dbase'); if (r) r.oninput = () => { G.dragBase = +r.value / 100; $('dbase-v').textContent = r.value + '%'; save(); }; });
  }
  const c = document.createElement('div'); c.className = 'dset';
  c.innerHTML = '<h4><span>현재 릴</span><b>' + R.name + '</b></h4><div class="stat">' + (lv ? '<b style="color:var(--tip)">브레이크레버릴</b>' : '일반 드랙릴') + ' · 드랙음 <i>' + qLabel(R.q) + '</i></div>';
  const pv = document.createElement('button'); pv.className = 'dmode'; pv.style.cssText = 'width:auto;padding:6px 14px;margin-top:6px'; pv.textContent = '🔊 드랙음 들어보기'; pv.onclick = () => previewReel(R.q); c.appendChild(pv);
  w.appendChild(c);
  const tip = document.createElement('div'); tip.className = 'dset'; tip.innerHTML = '<small>' + (G.dragAuto ? '자동 드랙에서는 파이팅 화면에 드랙 조작부가 없어요.' : '수동 드랙에서는 파이팅 때마다 드랙 조작부가 나와요. 방향키 ↑↓ 또는 마우스 휠로도 조절할 수 있어요.') + (lv ? ' 레버릴은 브레이크 레버로 줄을 즉시 풀어줄 수 있어요.' : '') + '</small>';
  w.appendChild(tip); P.appendChild(w);
}
$('shop-drag').addEventListener('click', () => { $('menu').hidden = false; openTab('drag'); });

/* 배경음악 버튼 · 터치음 · 날씨 순환(테스트) */
const bgmBtn = $('btn-bgm');
try { if (localStorage.getItem('jjinaksi.bgm') === '0') { SFX.musicOn = false; bgmBtn.classList.add('off'); } } catch (e) {}
bgmBtn.addEventListener('click', () => { SFX.unlock(); SFX.setMusic(!SFX.musicOn); bgmBtn.classList.toggle('off', !SFX.musicOn); try { localStorage.setItem('jjinaksi.bgm', SFX.musicOn ? '1' : '0'); } catch (e) {} });
document.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b || b.id === 'btn-main' || b.id === 'btn-lever' || b.id === 'drag-up' || b.id === 'drag-dn' || b.disabled) return; SFX.unlock(); SFX.tap(b.classList.contains('tab') ? 1 : 0); }, true);
{ const ev = $('hud-wx').parentElement; let evT = 0; ev.addEventListener('click', e => { if (!ev.classList.contains('open')) { ev.classList.add('open'); document.body.classList.add('envopen'); clearTimeout(evT); evT = setTimeout(() => { ev.classList.remove('open'); document.body.classList.remove('envopen'); }, 4500); e.stopImmediatePropagation(); } }, true); }
$('hud-wx').parentElement.addEventListener('click', () => { if (!TEST_MAXLEVEL) return; const L = ['calm', 'clear', 'cloud', 'rough', 'rain']; G.wx = L[(L.indexOf(G.wx) + 1) % L.length]; say('날씨: ' + WX[G.wx].name + ' (테스트)'); });


/* ================= 보상 시스템 (초기 지급 · 접속 · 7일 출석 · 광고) =================
   금액은 아래 REWARD 에서 한 번에 조정하세요. */
const REWARD = {
  START_MONEY: 50000,                                   // 처음 시작할 때 지급
  LOGIN_BONUS: 3000, LOGIN_GAP_H: 4,                    // 접속 보상: 마지막 접속 보상 후 4시간이 지나 다시 들어오면 지급
  DAILY: [5000, 8000, 10000, 15000, 20000, 30000, 50000],   // 7일 연속 출석 보상 (7일째 후 다시 1일차)
  AD_REWARD: 10000, AD_PER_DAY: 15, AD_COOLDOWN_S: 20   // 광고 시청 보상 / 하루 최대 횟수 / 연속 시청 대기
};
const RWKEY = 'jjinaksi.rw';
const ymd = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const RW = (() => { let s = null; try { s = JSON.parse(localStorage.getItem(RWKEY) || 'null'); } catch (e) {} return Object.assign({ day: 0, lastClaim: '', lastLogin: 0, adDay: '', adCount: 0, adLast: 0 }, s || {}); })();
const rwSave = () => { try { localStorage.setItem(RWKEY, JSON.stringify(RW)); } catch (e) {} };
function rwPay(n, msg) { G.money += n; save(); rwSave(); if (msg) say(msg + ' +' + won(n), 3200); SFX && SFX.tap && SFX.tap(1); renderRewardBadge(); }

/* 처음 시작: 저장 기록이 하나도 없을 때만 */
let rwFirst = false;
try { rwFirst = !localStorage.getItem(KEY) && !localStorage.getItem(RWKEY); } catch (e) {}
if (rwFirst && !TEST_MAXLEVEL) { G.money = REWARD.START_MONEY; save(); rwSave(); }

/* 오늘 출석 상태 */
function dailyState() {
  const t = ymd(), y = ymd(new Date(Date.now() - 864e5));
  const cont = RW.lastClaim === t || RW.lastClaim === y;
  const idx = RW.lastClaim === t ? (RW.day + 6) % 7 : (cont ? RW.day % 7 : 0);   // 오늘 받을(또는 받은) 칸
  return { claimed: RW.lastClaim === t, idx, today: t };
}
function claimDaily() {
  const s = dailyState(); if (s.claimed) return say('오늘 출석 보상은 이미 받았어요');
  const idx = s.idx; RW.day = (idx + 1) % 7; RW.lastClaim = s.today; rwPay(REWARD.DAILY[idx], (idx + 1) + '일차 출석 보상'); renderReward();
}
/* 접속 보상 */
function loginBonus() {
  const now = Date.now();
  if (!rwFirst && now - RW.lastLogin < REWARD.LOGIN_GAP_H * 36e5) return;
  RW.lastLogin = now; if (rwFirst) { rwSave(); return; }
  rwPay(REWARD.LOGIN_BONUS, '접속 보상');
}
/* 광고 */
const Ads = {
  left() { if (RW.adDay !== ymd()) { RW.adDay = ymd(); RW.adCount = 0; } return Math.max(0, REWARD.AD_PER_DAY - RW.adCount); },
  wait() { return Math.max(0, Math.ceil((RW.adLast + REWARD.AD_COOLDOWN_S * 1000 - Date.now()) / 1000)); },
  busy: false,
  preload() { try { if (window.AIT && AIT.preloadAd) AIT.preloadAd(); } catch (e) {} },
  async show() {
    if (this.busy) return false; this.busy = true;
    try {
      if (window.AIT && AIT.showAd) return !!(await AIT.showAd());
      return await mockAd();                       // 웹/테스트 환경: 가짜 광고 화면
    } catch (e) { return false; } finally { this.busy = false; this.preload(); }
  }
};
function mockAd() {
  return new Promise(res => {
    const o = document.createElement('div'); o.id = 'mockad';
    o.innerHTML = '<div><small>테스트 광고</small><b id="mk-t">3</b><p>광고를 끝까지 보면 보상을 받아요</p><button id="mk-x" disabled>닫기</button></div>';
    $('stage').appendChild(o); let n = 3; const b = o.querySelector('#mk-x'), t = o.querySelector('#mk-t');
    const iv = setInterval(() => { n--; t.textContent = Math.max(n, 0); if (n <= 0) { clearInterval(iv); b.disabled = false; b.textContent = '보상 받기'; } }, 1000);
    b.onclick = () => { o.remove(); res(true); };
  });
}
async function watchAd() {
  if (!Ads.left()) return say('오늘 광고 보상은 모두 받았어요');
  if (Ads.wait()) return say(Ads.wait() + '초 뒤에 다시 볼 수 있어요');
  const ok = await Ads.show();
  if (ok) { RW.adCount++; RW.adLast = Date.now(); rwPay(REWARD.AD_REWARD, '광고 보상'); }
  else say('광고를 끝까지 보지 않아 보상이 없어요');
  renderReward();
}

/* 화면 */
function renderRewardBadge() {
  const b = $('btn-gift'); if (!b) return;
  const dot = !dailyState().claimed || (Ads.left() > 0 && !Ads.wait());
  b.classList.toggle('dot', !dailyState().claimed);
}
function renderReward() {
  const P = $('p-reward'); if (!P) return; const s = dailyState(), left = Ads.left(), w = Ads.wait();
  let h = '<div class="rw"><section><h3>7일 출석 보상</h3><p class="rwsub">매일 접속해서 받아 가세요. 하루를 거르면 1일차부터 다시 시작해요.</p><div class="days">';
  REWARD.DAILY.forEach((v, i) => {
    const done = s.claimed ? i <= s.idx : i < s.idx, now = !s.claimed && i === s.idx;
    h += '<div class="day' + (done ? ' done' : '') + (now ? ' now' : '') + '"><small>' + (i + 1) + '일차</small><span>' + (done ? '✔' : i === 6 ? '🎁' : '🪙') + '</span><b>' + (v / 1000) + '천</b></div>';
  });
  h += '</div><button class="rwbtn" id="rw-claim"' + (s.claimed ? ' disabled' : '') + '>' + (s.claimed ? '오늘 출석 완료' : (s.idx + 1) + '일차 보상 받기 · ' + won(REWARD.DAILY[s.idx])) + '</button></section>';
  h += '<section><h3>광고 보고 받기</h3><p class="rwsub">광고를 끝까지 보면 ' + won(REWARD.AD_REWARD) + '을 받아요 · 오늘 남은 횟수 <b>' + left + '/' + REWARD.AD_PER_DAY + '</b></p><button class="rwbtn ad" id="rw-ad"' + (left && !w ? '' : ' disabled') + '>▶ ' + (left ? (w ? w + '초 뒤 가능' : '광고 보고 ' + won(REWARD.AD_REWARD) + ' 받기') : '오늘은 모두 받았어요') + '</button></section>';
  h += '<section><h3>접속 보상</h3><p class="rwsub">게임에 들어올 때마다(' + REWARD.LOGIN_GAP_H + '시간에 한 번) ' + won(REWARD.LOGIN_BONUS) + '이 자동으로 지급돼요.</p></section></div>';
  P.innerHTML = h; const c = $('rw-claim'), a = $('rw-ad'); if (c) c.onclick = claimDaily; if (a) a.onclick = watchAd;
}
{ const _ot = openTab; openTab = function (n) { _ot(n === 'reward' ? 'dex' : n); const P = $('p-reward'); document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', String(x.dataset.tab === n))); if (n === 'reward') { el.pDex.hidden = true; P.hidden = false; renderReward(); } else P.hidden = true; }; }
document.querySelectorAll('[data-open="reward"]').forEach(b => b.addEventListener('click', () => { $('rail').classList.remove('open'); $('menu').hidden = false; openTab('reward'); }));
{ const g = $('btn-gift'); if (g) g.addEventListener('click', () => { $('menu').hidden = false; openTab('reward'); }); }
setInterval(() => { renderRewardBadge(); if (!$('p-reward').hidden && !$('menu').hidden) { const a = $('rw-ad'); if (a && Ads.wait()) renderReward(); } }, 1000);
Ads.preload(); loginBonus(); renderRewardBadge();
if (!dailyState().claimed && !rwFirst) setTimeout(() => say('🎁 오늘의 출석 보상을 받을 수 있어요', 3500), 2500);


/* ================= 첫 플레이 안내 · 자연스러운 광고 자리 · 통계 ================= */
const STKEY = 'jjinaksi.stats';
const ST = (() => { let s = null; try { s = JSON.parse(localStorage.getItem(STKEY) || 'null'); } catch (e) {} return Object.assign({ sessions: 0, casts: 0, bites: 0, catches: 0, offers: 0, adClick: 0, adDone: 0, first: Date.now(), tutOff: false }, s || {}); })();
const stSave = () => { try { localStorage.setItem(STKEY, JSON.stringify(ST)); } catch (e) {} };
function track(name, props) { try { if (window.AIT && AIT.track) AIT.track(name, props || {}); } catch (e) {} }
ST.sessions++; stSave(); track('session_start', { n: ST.sessions });
window.__stats = () => JSON.parse(JSON.stringify(ST));

/* 1) 쉬운 시작: 첫 5마리까지 입질이 빨리 오고, 물고기 힘이 약해요 */
const totalCatch = () => Object.values(G.dex).reduce((a, d) => a + (d.n || 0), 0);
const easy = () => !ST.tutOff && totalCatch() < 5;
{ const _br = biteRate; biteRate = c => _br(c) * (easy() ? 3 : 1) * (G.boost > 0 ? 4 : 1);
  const _nf = newFight; newFight = (f, L, frac) => { const F = _nf(f, L, frac); if (easy()) F.power *= .6; return F; };
  const _sc = startCast; startCast = function () { if (G.mode === 'idle' && !G.baitId && easy()) G.baitId = 'krill'; const m0 = G.mode; _sc(); if (m0 === 'idle' && G.mode === 'casting') { ST.casts++; stSave(); if (ST.casts === 1) track('first_cast'); } };
  const _hk = hooked; hooked = f => { ST.bites++; stSave(); if (ST.bites === 1) track('first_bite'); _hk(f); };
  const _lf = landFish; landFish = F => { ST.catches++; stSave(); if (ST.catches === 1) track('first_catch', { sec: Math.round((Date.now() - ST.first) / 1000) }); _lf(F); };
}
if (!G.baitId && easy()) G.baitId = 'krill';

/* 코치 말풍선 (팝업이 아니라 가벼운 안내 띠) */
{ const c = document.createElement('div'); c.id = 'coach'; c.innerHTML = '<span id="coach-t"></span><button id="coach-x" aria-label="안내 끄기">×</button>'; $('stage').appendChild(c);
  $('coach-x').onclick = () => { ST.tutOff = true; stSave(); c.classList.remove('on'); track('tutorial_skip'); };
  const T = { idle: '① 오른쪽 아래 버튼으로 캐스팅해요', casting: '게이지가 초록일 때 놓으면 멀리 날아가요', flying: '', waiting: '② 찌가 움직이면 곧 입질이에요. 기다려요', bite: '③ 찌가 쑥 잠기면 지금! 챔질!', fight: '④ 감기 버튼을 꾹 누르면 끌려와요. 줄이 터질 듯하면 놓아요' };
  setInterval(() => { const t = easy() ? T[G.mode] : ''; $('coach-t').textContent = t || ''; c.classList.toggle('on', !!t && $('menu').hidden); document.body.classList.toggle('hint-bite', easy() && G.mode === 'bite'); }, 400); }

/* 2) 광고 제안: 놓치거나 돈이 모자랄 때, 대어를 잡았을 때 */
{ const o = document.createElement('div'); o.id = 'adoffer'; o.innerHTML = '<button id="adoffer-b"></button><button id="adoffer-x" aria-label="닫기">×</button>'; $('stage').appendChild(o);
  let hideT = 0, cur = null;
  const hide = () => { o.classList.remove('on'); cur = null; };
  window.offerAd = (text, fn, key) => { if (!Ads.left() || Ads.wait() || Ads.busy) return; cur = key; $('adoffer-b').textContent = '▶ ' + text; o.classList.add('on'); ST.offers++; stSave(); track('ad_offer', { key }); clearTimeout(hideT); hideT = setTimeout(hide, 7000); o._fn = fn; };
  $('adoffer-x').onclick = hide;
  $('adoffer-b').onclick = async () => { const fn = o._fn; hide(); ST.adClick++; stSave(); track('ad_click', { key: cur }); const ok = await Ads.show(); if (ok) { RW.adCount++; RW.adLast = Date.now(); rwSave(); ST.adDone++; stSave(); track('ad_done'); fn && fn(); renderRewardBadge(); } else say('광고를 끝까지 보지 않아 보상이 없어요'); };
  { const _say = say; say = function (m, ms) { _say(m, ms); if (typeof m !== 'string') return; if (m === '돈이 모자라요') offerAd('광고 보고 ' + won(REWARD.AD_REWARD) + ' 받기', () => rwPay(REWARD.AD_REWARD, '광고 보상'), 'poor'); else if (/줄이 터|바늘이 빠|놓쳤어요. 너무/.test(m)) setTimeout(() => offerAd('광고 보고 행운 입질 60초', () => { G.boost = 60; say('행운 입질! 60초 동안 입질이 빨라져요', 3000); }, 'boost'), 1200); }; }
  setInterval(() => { if (G.boost > 0) G.boost -= .5; }, 500);
  /* 조과 카드: 광고 보면 2배 */
  { const r = $('result'), b = document.createElement('button'); b.id = 'res-ad'; b.hidden = true; r.appendChild(b);
    b.addEventListener('pointerdown', e => e.stopPropagation());
    const _sr = showResult; showResult = function (x) { _sr(x); b.hidden = true; if (x.value >= 5000 && Ads.left() && !Ads.wait()) { b.hidden = false; b.textContent = '▶ 광고 보고 ' + won(x.value) + ' 더 받기'; b.onclick = async () => { b.hidden = true; ST.adClick++; track('ad_click', { key: 'double' }); const ok = await Ads.show(); if (ok) { RW.adCount++; RW.adLast = Date.now(); rwSave(); ST.adDone++; stSave(); track('ad_done'); rwPay(x.value, '2배 보상'); } r.hidden = true; }; clearTimeout(resT); resT = setTimeout(() => { r.hidden = true; }, 7000); } }; }
}
/* 로딩 화면 정리 */
setTimeout(() => { const s = $('splash'); if (s) { s.classList.add('off'); setTimeout(() => s.remove(), 600); } }, 700);


/* ================= 모바일 최적화 ================= */
(() => {
  // PWA: 홈 화면 추가용 아이콘/매니페스트
  const ic = document.createElement('canvas'); ic.width = ic.height = 192; const c = ic.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 192); g.addColorStop(0, '#2a8fb0'); g.addColorStop(1, '#0a2f3d'); c.fillStyle = g; c.fillRect(0, 0, 192, 192);
  c.fillStyle = '#ff6a3d'; c.beginPath(); c.arc(96, 78, 26, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(93, 30, 6, 30);
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 4; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(96, 150 + i * 6, 40 + i * 14, 3.5, 5.9); c.stroke(); }
  const iu = ic.toDataURL('image/png'), H = document.head;
  const add = (tag, at) => { const e = document.createElement(tag); for (const k in at) e.setAttribute(k, at[k]); H.appendChild(e); };
  add('link', { rel: 'apple-touch-icon', href: iu }); add('link', { rel: 'icon', href: iu });
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }); add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }); add('meta', { name: 'theme-color', content: '#04141b' });
  try { const mf = { name: '바다 찌낚시', short_name: '찌낚시', display: 'fullscreen', orientation: 'landscape', background_color: '#04141b', theme_color: '#04141b', start_url: '.', icons: [{ src: iu, sizes: '192x192', type: 'image/png' }] };
    add('link', { rel: 'manifest', href: 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(mf)) }); } catch (e) {}
  const st = document.createElement('style');
  st.textContent = 'html,body{position:fixed;inset:0;width:100%;height:100%;overscroll-behavior:none;-webkit-touch-callout:none}#gl{touch-action:none}';
  H.appendChild(st);
  ['contextmenu', 'gesturestart', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  // 기본 화질: 처음엔 절전, 사용자가 직접 고르면 그 값 유지
  let userQ = false; try { userQ = localStorage.getItem('jjinaksi.q') !== null; } catch (e) {}
  if (!userQ) setQuality(0);
  qBtn.addEventListener('click', () => { userQ = true; });
  // 프레임 느리면 자동 절전
  let ema = 16, slow = 0, last = performance.now();
  (function mon(now) { const d = now - last; last = now; if (d < 250) { ema += (d - ema) * .05; slow = ema > 38 ? slow + d : 0; if (slow > 4000 && ENV.q > .5 && !userQ) { setQuality(0); say('기기가 느려서 절전 모드로 바꿨어요', 3000); slow = 0; } } requestAnimationFrame(mon); })(last);

  // 전체화면 · 가로 고정 · 화면 꺼짐 방지 (첫 터치 때)
  let wl = null; const keep = async () => { try { if (navigator.wakeLock && document.visibilityState === 'visible') wl = await navigator.wakeLock.request('screen'); } catch (e) {} };
  const first = async () => {
    window.removeEventListener('pointerup', first);
    try { const el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) {}
    keep();
  };
  window.addEventListener('pointerup', first);
  // 백그라운드로 가면 소리 멈춤
  document.addEventListener('visibilitychange', () => {
    const ctx = SFX.ctx; if (!ctx) return;
    if (document.hidden) ctx.suspend && ctx.suspend(); else { ctx.resume && ctx.resume(); keep(); }
  });
})();

