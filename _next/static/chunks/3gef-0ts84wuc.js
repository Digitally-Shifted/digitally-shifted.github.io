(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,50049,e=>{"use strict";var t=e.i(43476),n=e.i(75056),o=e.i(98903),r=e.i(38408),l=e.i(71645),i=e.i(90072),a=e.i(4535);e.i(83479);var u=e.i(44164),v=e.i(72350),f=e.i(35980);let s=`
  attribute vec3 aCell;           // grid x, grid y, random 0..1
  uniform float uTime;
  uniform float uCut;             // cut position along the shift normal (1,1)/√2
  uniform float uCell;
  uniform float uMotion;          // 0 under reduced motion
  uniform vec2 uPointer;
  uniform float uPointerOn;
  uniform vec4 uRipples[4]; // xy origin, z start time, w strength
  varying vec3 vN;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vBase;
  varying float vShift;
  varying float vBand;
  varying float vHover;
  varying float vRipple;
  varying float vDepth;
  varying float vLit;

  void main() {
    float rnd = aCell.z;
    float t = (aCell.x + aCell.y) * 0.70710678;
    float behind = uCut - t;
    float k = smoothstep(-0.4, 3.2, behind);
    float band = exp(-pow(behind / 1.25, 2.0));

    float hOld = 0.05 + rnd * 0.24;
    float hNew = 0.4 + 0.07 * sin(uTime * 0.55 + rnd * 6.2831) * uMotion;
    float h = mix(hOld, hNew, k) + band * (1.05 + 0.5 * rnd);

    vec2 d = aCell.xy - uPointer;
    float hover = uPointerOn * exp(-dot(d, d) / 4.5);
    h += hover * 0.85;

    // Shift pulses: an L1 (diamond) wavefront, so its edges run on the 45\xb0 diagonals.
    float ripple = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (r.w > 0.0 && age >= 0.0 && age < 4.0) {
        float dist = abs(aCell.x - r.x) + abs(aCell.y - r.y);
        float front = age * 11.0;
        float w = exp(-pow((dist - front) / 1.3, 2.0)) * exp(-age * 0.9) * r.w;
        ripple = max(ripple, w);
      }
    }
    h += ripple * 1.35 * uMotion;

    // Old cells wait on the diagonal, one step down-left; the shift moves them up-right into the grid.
    vec2 offset = (1.0 - k) * vec2(-0.2) * uCell;

    vec3 p = position;
    vBase = p.z;                  // 0 at the floor, 1 at the top face (before scaling)
    p.xy *= uCell;
    p.z *= h;
    p.xy += aCell.xy + offset;

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;

    vN = normal;
    vUv = uv;
    vWorld = world.xyz;
    vShift = k;
    vBand = band;
    vHover = hover;
    vRipple = ripple * uMotion;
    vDepth = -mv.z;
    float flicker = 0.65 + 0.35 * sin(uTime * 1.1 + rnd * 40.0) * uMotion;
    vLit = step(0.968, fract(rnd * 91.7)) * k * flicker;
  }
`,c=`
  uniform vec3 uCarbon;
  uniform vec3 uG900;
  uniform vec3 uG800;
  uniform vec3 uG500;
  uniform vec3 uG300;
  uniform vec3 uPaper;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uCut;
  varying vec3 vN;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vBase;
  varying float vShift;
  varying float vBand;
  varying float vHover;
  varying float vRipple;
  varying float vDepth;
  varying float vLit;

  void main() {
    vec3 n = normalize(vN);
    vec3 L = normalize(vec3(-0.35, -0.6, 0.72));
    float diff = clamp(dot(n, L), 0.0, 1.0);
    float top = step(0.5, n.z);

    vec3 col = mix(uCarbon, uG900, 0.35 + 0.65 * diff);
    col = mix(col, uG800, vShift * top * 0.55);

    // Grounding: side faces darken toward the floor.
    col *= mix(1.0, mix(0.5, 1.0, smoothstep(0.0, 0.75, vBase)), 1.0 - top);

    // 1px edges on every face: Paper lines on Ink.
    vec2 g = min(vUv, 1.0 - vUv);
    float e = min(g.x, g.y);
    float w = fwidth(e) * 1.2;
    float edge = 1.0 - smoothstep(0.0, w, e);
    vec3 edgeCol = mix(uG800, uG500, vShift);
    edgeCol = mix(edgeCol, uPaper, clamp(vBand * 0.95 + vHover * 0.8 + vRipple, 0.0, 1.0));
    col = mix(col, edgeCol, edge * mix(0.5, 1.0, top));

    col = mix(col, uG300, vLit * top * (1.0 - edge) * 0.45);

    // The cut itself: a crisp 1.5px line along the crest, on the 45\xb0 diagonal.
    float tw = (vWorld.x + vWorld.y) * 0.70710678;
    float dl = abs(tw - uCut);
    float lw = fwidth(tw) * 1.5;
    float laser = (1.0 - smoothstep(0.0, lw, dl)) * smoothstep(0.35, 0.9, vBand);
    col = mix(col, uPaper, laser * 0.85);

    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    col = mix(col, uCarbon, fog);
    gl_FragColor = vec4(col, 1.0);
  }
`;function d({progress:e,reduced:n,dense:f,onFirstFrame:m,onLowPower:p,onLost:g}){let{camera:w,gl:h,invalidate:x}=(0,r.f)(),y=(0,r.f)(e=>e.setDpr),M=(0,l.useRef)(null),C=(0,l.useRef)(!0);(0,v.f)(C,g);let b=(0,l.useRef)(+!!n),E=(0,l.useRef)(0),L=(0,l.useRef)({ndc:new i.wq(0,0),world:new i.wq(0,0),on:0,target:0}),P=(0,l.useRef)(0),R=(0,l.useRef)({frames:0,time:0,level:0,warm:0}),F=f?{cell:1,xMin:-24,xMax:24,yMin:-9,yMax:30}:{cell:1.35,xMin:-14,xMax:14,yMin:-9,yMax:26},{geometry:k,count:G}=(0,l.useMemo)(()=>{let e=new i.kG(.88,.88,1);e.translate(0,0,.5);let t=[];for(let e=F.yMin;e<=F.yMax;e+=F.cell)for(let n=F.xMin;n<=F.xMax;n+=F.cell){let o=Math.abs(43758.5453*Math.sin(12.9898*n+78.233*e))%1;t.push(n,e,o)}return e.setAttribute("aCell",new i.VZ(new Float32Array(t),3)),{geometry:e,count:t.length/3}},[F.cell,F.xMin,F.xMax,F.yMin,F.yMax]),z=(0,l.useMemo)(()=>({uTime:{value:0},uCut:{value:-16},uCell:{value:F.cell},uMotion:{value:+!n},uPointer:{value:new i.wq(999,999)},uPointerOn:{value:0},uRipples:{value:Array.from({length:4},()=>new i.$i(0,0,-100,0))},uCarbon:{value:new i.cE(...(0,u.s)(a.L.carbon))},uG900:{value:new i.cE(...(0,u.s)(a.L.grey900))},uG800:{value:new i.cE(...(0,u.s)(a.L.grey800))},uG500:{value:new i.cE(...(0,u.s)(a.L.grey500))},uG300:{value:new i.cE(...(0,u.s)(a.L.grey300))},uPaper:{value:new i.cE(...(0,u.s)(a.L.paper))},uFogNear:{value:20},uFogFar:{value:46}}),[]),B=(0,l.useMemo)(()=>new i.zx,[]),T=(0,l.useMemo)(()=>new i._m(new i.cE(0,0,1),0),[]),S=(0,l.useMemo)(()=>new i.cE,[]),N=(0,l.useMemo)(()=>new i.wq,[]),O=(0,l.useMemo)(()=>new i.cE(0,-17.5,12.5),[]),A=(0,l.useMemo)(()=>new i.cE,[]);return(0,l.useEffect)(()=>{if(n)return;let e=h.domElement,t=(t,n)=>{let o=e.getBoundingClientRect();return n.set((t.clientX-o.left)/o.width*2-1,-(2*((t.clientY-o.top)/o.height))+1),t.clientX>=o.left&&t.clientX<=o.right&&t.clientY>=o.top&&t.clientY<=o.bottom},o=e=>{"mouse"===e.pointerType&&(L.current.target=+!!t(e,L.current.ndc))},r=()=>L.current.target=0,l=(e,t)=>{let n=M.current;n&&(n.uniforms.uRipples.value[P.current%4].set(e,t,n.uniforms.uTime.value,1),P.current++,x())},a=e=>{if(e.target?.closest?.("a, button, input, select, textarea, label"))return;let n=new i.wq;!t(e,n)||(B.setFromCamera(n,w),B.ray.intersectPlane(T,S)&&l(S.x,S.y))},u=t=>{if("Shift"!==t.key||t.repeat||t.target?.closest?.("input, select, textarea, [contenteditable]"))return;let n=e.getBoundingClientRect();if(n.bottom<=0||n.top>=window.innerHeight)return;let o=L.current;if(o.on>.5)return l(o.world.x,o.world.y);let r=((M.current?.uniforms.uCut.value??0)*Math.SQRT2-(A.x+A.y))/2;l(A.x+r,A.y+r)};return window.addEventListener("pointermove",o,{passive:!0}),window.addEventListener("pointerdown",a,{passive:!0}),window.addEventListener("keydown",u),document.documentElement.addEventListener("pointerleave",r),()=>{window.removeEventListener("pointermove",o),window.removeEventListener("pointerdown",a),window.removeEventListener("keydown",u),document.documentElement.removeEventListener("pointerleave",r)}},[h,n,w,B,T,S,x,A]),(0,l.useEffect)(()=>{let e=M.current;e&&(e.uniforms.uMotion.value=+!n,x())},[n,x]),(0,l.useEffect)(()=>e.on("change",()=>x()),[e,x]),(0,o.f)((t,o)=>{let r=M.current;if(!r)return;let l=Math.min(o,.05),a=e=>1-Math.exp(-l*e),u=e.get(),v=R.current;if(!n&&v.level<2){if(v.warm<30)v.warm++;else if(v.frames++,v.time+=o,v.frames>=120){let e=v.frames/v.time;e<45&&0===v.level?(v.level=1,y(1)):e<24&&1===v.level&&(v.level=2,p()),v.frames=0,v.time=0}}n||(r.uniforms.uTime.value+=l,b.current=Math.min(1,b.current+l/2.4));let s=-16+((f?5.5:4)+16)*function(e){let t=(e,t,n)=>3*(1-e)*(1-e)*e*t+3*(1-e)*e*e*n+e*e*e,n=0,o=1;for(let r=0;r<18;r++){let r=(n+o)/2;t(r,.2,0)<e?n=r:o=r}return t((n+o)/2,0,1)}(b.current)+30*u,c=L.current;if(c.on+=(c.target-c.on)*a(5),!n&&c.on>.001&&(B.setFromCamera(c.ndc,w),B.ray.intersectPlane(T,S))){c.world.lerp(N.set(S.x,S.y),a(9));let e=(c.world.x+c.world.y)*.70710678;s+=i.rB.clamp((e-s)*.3,-4,4)*c.on}E.current=n||2===v.level?s:E.current+(s-E.current)*a(3.2),C.current&&(E.current=s),r.uniforms.uCut.value=E.current,r.uniforms.uPointer.value.copy(c.world),r.uniforms.uPointerOn.value=c.on;let d=n?0:c.ndc.x*c.on,g=n?0:c.ndc.y*c.on;w.position.set(O.x+.9*d,O.y+.5*g+3*u,O.z-2.2*u),A.set(.5*d,3+5*u,0),w.lookAt(A),C.current&&(C.current=!1,requestAnimationFrame(m))}),(0,t.jsx)("instancedMesh",{args:[k,void 0,G],frustumCulled:!1,children:(0,t.jsx)("shaderMaterial",{ref:M,vertexShader:s,fragmentShader:c,uniforms:z})})}e.s(["default",0,function({progress:e,reduced:o,running:r,onReady:i,onLost:a}){let[u,v]=(0,l.useState)(!1),s=window.matchMedia("(min-width: 768px)").matches,c=o||u?"demand":r?"always":"never";return(0,t.jsx)(n.f,{className:"!absolute inset-0",dpr:[1,s?1.75:1.5],resize:{offsetSize:!0,scroll:!1},flat:!0,gl:e=>(0,f.f)(e,{antialias:!0,alpha:!0,powerPreference:"high-performance",stencil:!1}),camera:{fov:32,near:.5,far:80,position:[0,-17.5,12.5],up:[0,0,1]},frameloop:c,"aria-hidden":"true",fallback:null,children:(0,t.jsx)(d,{progress:e,reduced:o,dense:s,onFirstFrame:i,onLowPower:()=>v(!0),onLost:a})})}])},8715,function(e){e.n(e.i(50049))}]);