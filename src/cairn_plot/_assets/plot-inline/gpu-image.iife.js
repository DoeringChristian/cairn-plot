var Ls=Object.defineProperty;var ks=(l,d,Fe)=>d in l?Ls(l,d,{enumerable:!0,configurable:!0,writable:!0,value:Fe}):l[d]=Fe;var Q=(l,d,Fe)=>ks(l,typeof d!="symbol"?d+"":d,Fe);(function(l,d){"use strict";const Fe=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Ft(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Fe}),{hdr:!1,format:n}}function jn(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Fe}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Fe}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Ft(e,t)}}}const Qn=`
const WORKGROUP_SIZE: u32 = 256u;

@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(1) var texB: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> partial: array<f32>;

struct Dims {
  width: u32,
  height: u32,
  count: u32,
  _pad: u32,
};
@group(0) @binding(3) var<uniform> dims: Dims;

var<workgroup> sqShared: array<f32, 256>;
var<workgroup> absShared: array<f32, 256>;

@compute @workgroup_size(256)
fn cs_main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(workgroup_id) wgid: vec3<u32>,
) {
  let idx = gid.x;
  var sq = 0.0;
  var ab = 0.0;
  if (idx < dims.count) {
    let x = i32(idx % dims.width);
    let y = i32(idx / dims.width);
    let a = textureLoad(texA, vec2<i32>(x, y), 0);
    let b = textureLoad(texB, vec2<i32>(x, y), 0);
    let d = a.rgb - b.rgb;
    sq = dot(d, d);
    ab = abs(d.x) + abs(d.y) + abs(d.z);
  }
  sqShared[lid.x] = sq;
  absShared[lid.x] = ab;
  workgroupBarrier();

  var stride = WORKGROUP_SIZE / 2u;
  loop {
    if (stride == 0u) {
      break;
    }
    if (lid.x < stride) {
      sqShared[lid.x] = sqShared[lid.x] + sqShared[lid.x + stride];
      absShared[lid.x] = absShared[lid.x] + absShared[lid.x + stride];
    }
    workgroupBarrier();
    stride = stride / 2u;
  }

  if (lid.x == 0u) {
    partial[wgid.x * 2u] = sqShared[0];
    partial[wgid.x * 2u + 1u] = absShared[0];
  }
}
`;function dt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function zt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Jn(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const er={texture:0,sampler:1,uniform:2};function ft(e,t){return e*3+er[t]}const tr={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function nr(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),s=r[2]!==void 0,a=r[3].trim();if(s){const i=tr[a];if(i===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${a}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:i})}else a==="sampler"||a==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Vt{constructor(t,n,r,o){Q(this,"width");Q(this,"height");Q(this,"format");Q(this,"gpuTexture");Q(this,"device");Q(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:dt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*zt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class $t{constructor(t){Q(this,"_s");Q(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class rr{constructor(t,n,r,o,s){Q(this,"_p");Q(this,"gpuPipeline");Q(this,"bindings");Q(this,"bindGroupLayout");Q(this,"variants");Q(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=s,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function or(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class sr{constructor(t){Q(this,"_c");Q(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class ar{constructor(t,n){Q(this,"_b");Q(this,"gpuBindGroup");Q(this,"ownedBuffers");Q(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class ir{constructor(t,n,r,o){Q(this,"canvas");Q(this,"hdr");Q(this,"format");Q(this,"context");Q(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function je(e){return"canvas"in e}async function cr(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function s(u){return je(u)?u.getCurrentTextureView():u.gpuTexture.createView()}function a(u){if(je(u))return{width:u.canvas.width,height:u.canvas.height};const v=u;return{width:v.width,height:v.height}}let i=!1;const f=256;let c=null,h=null;function x(){if(!c||!h){const u=t.createShaderModule({code:Qn});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const v=t.createPipelineLayout({bindGroupLayouts:[h]});c=t.createComputePipeline({layout:v,compute:{module:u,entryPoint:"cs_main"}})}return{pipeline:c,layout:h}}return{backend:"webgpu",capabilities:n,createTexture(u,v,g){return new Vt(t,u,v,g)},createSampler(u){const v=(u==null?void 0:u.filter)==="linear"?"linear":"nearest",g=t.createSampler({magFilter:v,minFilter:v,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new $t(g)},createRenderPipeline(u){const v=t.createShaderModule({code:u.shaderWGSL}),g=nr(u.shaderWGSL),b=dt(u.targetFormat),p=or(t,g),m=t.createPipelineLayout({bindGroupLayouts:[p]}),E=_=>t.createRenderPipeline({layout:m,vertex:{module:v,entryPoint:"vs_main"},fragment:{module:v,entryPoint:"fs_main",targets:[{format:_}]},primitive:{topology:"triangle-list"}}),y=E(b);return new rr(y,g,p,b,E)},createComputePipeline(u){const v=t.createShaderModule({code:u.shaderWGSL}),g=t.createComputePipeline({layout:"auto",compute:{module:v,entryPoint:"cs_main"}});return new sr(g)},createBindGroup(u,v){const g=u,b=new Map,p=[];for(const[E,y]of g.bindings)if(y.kind==="uniform"){const _=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});p.push(_),b.set(E,{binding:E,resource:{buffer:_}})}else y.kind==="sampler"&&b.set(E,{binding:E,resource:o()});for(const E of v){const y=E.resource;if(y instanceof Vt){const _=ft(E.binding,"texture");g.bindings.has(_)&&b.set(_,{binding:_,resource:y.gpuTexture.createView()})}else if(y instanceof $t){const _=ft(E.binding,"sampler");g.bindings.has(_)&&b.set(_,{binding:_,resource:y.gpuSampler})}else{const _=ft(E.binding,"uniform"),M=g.bindings.get(_);if(M&&M.kind==="uniform"){const P=y.uniform,R=t.createBuffer({size:Math.max(M.sizeBytes,P.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(R,0,P.buffer,P.byteOffset,P.byteLength),p.push(R),b.set(_,{binding:_,resource:{buffer:R}})}}}const m=t.createBindGroup({layout:g.bindGroupLayout,entries:Array.from(b.values())});return new ar(m,p)},createSurface(u,v){const g=u.getContext("webgpu");if(!g)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const b=v.hdr&&n.hdr,p=()=>b?jn(g,t):Ft(g,t),m=p();return new ir(u,g,m,p)},renderFullscreen(u,v,g){const b=v,p=g,m=s(u),{width:E,height:y}=a(u),_=je(u)?u.format:dt(u.format),M=b.pipelineFor(_),P=t.createCommandEncoder(),R=P.beginRenderPass({colorAttachments:[{view:m,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});R.setPipeline(M),R.setBindGroup(0,p.gpuBindGroup),R.setViewport(0,0,E,y,0,1),R.draw(3),R.end(),t.queue.submit([P.finish()])},async readback(u){const v=je(u),{width:g,height:b}=a(u),p=v?u.hdr?"rgba16float":"rgba8unorm":u.format,m=v&&u.format==="bgra8unorm",E=v?u.getCurrentGPUTexture():u.gpuTexture,y=zt(p),_=g*y,M=256,P=Math.ceil(_/M)*M,R=P*b,B=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),k=t.createCommandEncoder();k.copyTextureToBuffer({texture:E},{buffer:B,bytesPerRow:P,rowsPerImage:b},{width:g,height:b,depthOrArrayLayers:1}),t.queue.submit([k.finish()]),await B.mapAsync(GPUMapMode.READ);const U=new Uint8Array(B.getMappedRange()),S=new Uint8Array(_*b);for(let A=0;A<b;A++){const $=A*P,G=A*_;S.set(U.subarray($,$+_),G)}if(B.unmap(),B.destroy(),p==="rgba8unorm"){if(m)for(let A=0;A<S.length;A+=4){const $=S[A],G=S[A+2];S[A]=G,S[A+2]=$}return S}if(p==="rgba16float"){const A=new Uint16Array(S.buffer,S.byteOffset,S.byteLength/2),$=new Float32Array(A.length);for(let G=0;G<A.length;G++)$[G]=Jn(A[G]);return $}return new Float32Array(S.buffer,S.byteOffset,S.byteLength/4)},async reduceDiffSumSquaredAbs(u,v,g,b){const p=u,m=v,E=Math.max(0,g*b),y=Math.max(1,Math.ceil(E/f)),{pipeline:_,layout:M}=x(),P=y*2*4,R=t.createBuffer({size:P,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),B=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,new Uint32Array([Math.max(1,g),Math.max(1,b),E,0]));const k=t.createBindGroup({layout:M,entries:[{binding:0,resource:p.gpuTexture.createView()},{binding:1,resource:m.gpuTexture.createView()},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:B}}]}),U=t.createBuffer({size:P,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),S=t.createCommandEncoder(),A=S.beginComputePass();A.setPipeline(_),A.setBindGroup(0,k),A.dispatchWorkgroups(y),A.end(),S.copyBufferToBuffer(R,0,U,0,P),t.queue.submit([S.finish()]),await U.mapAsync(GPUMapMode.READ);const G=new Float32Array(U.getMappedRange()).slice();U.unmap(),U.destroy(),R.destroy(),B.destroy();let te=0,be=0;for(let ge=0;ge<y;ge++)te+=G[ge*2],be+=G[ge*2+1];return{sumSq:te,sumAbs:be}},destroy(){i||(t.destroy(),i=!0)},isContextLost(){return!1}}}let pt=null;async function lr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return cr()}function Qe(){return pt||(pt=lr()),pt}function ur(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function dr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),s=Math.floor(o),a=Math.min(s+1,e.length-1),i=o-s,[f,c,h]=ur(e[s],e[a],i);t[n*3]=Math.round(f),t[n*3+1]=Math.round(c),t[n*3+2]=Math.round(h)}return t}const Xt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Wt=new Set(["red-green","red-blue"]),Yt=new Map;function ht(e){let t=Yt.get(e);if(!t){const n=Xt[e]??Xt.viridis;t=dr(n),Yt.set(e,t)}return t}function gt(e,t,n="linear"){const r=ht(t),o=new ImageData(e.width,e.height),s=e.data,a=o.data;for(let i=0;i<s.length;i+=4){const f=(s[i]+s[i+1]+s[i+2])/3;let c;n==="positive"?c=Math.round(128+f/255*127):c=Math.round(f),c=Math.max(0,Math.min(255,c)),a[i]=r[c*3],a[i+1]=r[c*3+1],a[i+2]=r[c*3+2],a[i+3]=s[i+3]}return o}function Ht(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Kt=Ht(50);function mt(e){return Kt.get(e)}function xt(e,t){Kt.set(e,t)}const qt=Ht(100);function fr(e){return qt.get(e)}function pr(e,t){qt.set(e,t)}function hr(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),s=new ImageData(r,o);for(let a=0;a<o;a++)for(let i=0;i<r;i++){const f=(a*e.width+i)*4,c=(a*t.width+i)*4,h=(a*r+i)*4;for(let x=0;x<3;x++){const w=e.data[f+x],u=t.data[c+x],v=w-u,g=Math.abs(v),b=Math.max(w,1);let p;switch(n){case"signed":p=(v+255)/2;break;case"absolute":p=g;break;case"squared":p=v*v/255;break;case"relative_signed":p=(v/b+1)*127.5;break;case"relative_absolute":p=g/b*255;break;case"relative_squared":p=v*v/(b*b)*255;break}s.data[h+x]=Math.min(255,Math.max(0,Math.round(p)))}s.data[h+3]=255}return s}async function Xe(e){const t=fr(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const s=o.getContext("2d");if(!s){n(null);return}s.drawImage(r,0,0);const a=s.getImageData(0,0,o.width,o.height);pr(e,a),n(a)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const gr={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},mr={linear:0,signed:1,positive:2},xr=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,vr=`#version 300 es
precision highp float;

uniform sampler2D u_baseline;
uniform sampler2D u_other;
uniform sampler2D u_lut;
uniform int u_diff_mode;
uniform int u_cmap_mode;
uniform bool u_use_colormap;

in vec2 v_uv;
out vec4 fragColor;

float computeDiffChannel(float a, float b, int mode) {
  float diff = a - b;
  float absDiff = abs(diff);
  float denom = max(a, 1.0 / 255.0);
  if (mode == 0) return (diff + 1.0) / 2.0;
  if (mode == 1) return absDiff;
  if (mode == 2) return diff * diff;
  if (mode == 3) return (diff / denom + 1.0) / 2.0;
  if (mode == 4) return absDiff / denom;
  if (mode == 5) return (diff * diff) / (denom * denom);
  return absDiff;
}

void main() {
  vec4 base = texture(u_baseline, v_uv);
  vec4 other = texture(u_other, v_uv);

  float dr = computeDiffChannel(base.r, other.r, u_diff_mode);
  float dg = computeDiffChannel(base.g, other.g, u_diff_mode);
  float db = computeDiffChannel(base.b, other.b, u_diff_mode);

  vec3 result = clamp(vec3(dr, dg, db), 0.0, 1.0);

  if (u_use_colormap) {
    float avg = (result.r + result.g + result.b) / 3.0;
    float idx;
    if (u_cmap_mode == 2) {
      idx = 0.5 + avg * 0.5;
    } else {
      idx = avg;
    }
    result = texture(u_lut, vec2(clamp(idx, 0.0, 1.0), 0.5)).rgb;
  }

  fragColor = vec4(result, 1.0);
}`;let We=null,W=null,Pe=null,Je=null;function br(){if(W)return W;try{if(typeof OffscreenCanvas<"u"?We=new OffscreenCanvas(1,1):We=document.createElement("canvas"),W=We.getContext("webgl2",{preserveDrawingBuffer:!0}),!W)return console.warn("[cairn] WebGL 2 not available"),null;const e=W.createShader(W.VERTEX_SHADER);if(W.shaderSource(e,xr),W.compileShader(e),!W.getShaderParameter(e,W.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",W.getShaderInfoLog(e)),null;const t=W.createShader(W.FRAGMENT_SHADER);if(W.shaderSource(t,vr),W.compileShader(t),!W.getShaderParameter(t,W.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",W.getShaderInfoLog(t)),null;if(Pe=W.createProgram(),W.attachShader(Pe,e),W.attachShader(Pe,t),W.linkProgram(Pe),!W.getProgramParameter(Pe,W.LINK_STATUS))return console.error("[cairn] WebGL program link:",W.getProgramInfoLog(Pe)),null;Je=W.createVertexArray(),W.bindVertexArray(Je);const n=W.createBuffer();W.bindBuffer(W.ARRAY_BUFFER,n),W.bufferData(W.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),W.STATIC_DRAW);const r=W.getAttribLocation(Pe,"a_pos");return W.enableVertexAttribArray(r),W.vertexAttribPointer(r,2,W.FLOAT,!1,0,0),W.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),W}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Zt(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function wr(e,t,n){const r=new Uint8Array(1024);for(let s=0;s<256;s++)r[s*4]=t[s*3],r[s*4+1]=t[s*3+1],r[s*4+2]=t[s*3+2],r[s*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function yr(e,t,n,r){const o=br();if(!o||!Pe||!Je||!We)return null;const s=Math.min(e.width,t.width),a=Math.min(e.height,t.height);We.width=s,We.height=a,o.viewport(0,0,s,a);const i=Zt(o,e,0),f=Zt(o,t,1);let c=null;n.colormap?c=wr(o,n.colormap,2):(c=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,c),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Pe),o.uniform1i(o.getUniformLocation(Pe,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Pe,"u_other"),1),o.uniform1i(o.getUniformLocation(Pe,"u_lut"),2),o.uniform1i(o.getUniformLocation(Pe,"u_diff_mode"),gr[n.diffMode]),o.uniform1i(o.getUniformLocation(Pe,"u_cmap_mode"),mr[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Pe,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Je),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=s,r.height=a;const h=r.getContext("2d");return h&&(h.save(),h.scale(1,-1),h.drawImage(We,0,0,s,a,0,-a,s,a),h.restore()),o.deleteTexture(i),o.deleteTexture(f),o.deleteTexture(c),{width:s,height:a}}const Er="cairn:render-mode";function _r(){try{const e=localStorage.getItem(Er);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const De=e=>e<0?0:e>1?1:e,vt=e=>{const t=e<0?0:e;return t/(1+t)},bt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return De(n/r)},jt={linear:([e,t,n])=>[De(e),De(t),De(n)],srgb:([e,t,n])=>[De(e),De(t),De(n)],reinhard:([e,t,n])=>[vt(e),vt(t),vt(n)],aces:([e,t,n])=>[bt(e),bt(t),bt(n)],extended:([e,t,n])=>[e,t,n]},Mr="srgb";function Tr(e){return e&&jt[e]||jt[Mr]}function wt(e,t){return e*2**t}function Pr(e){const t=De(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function yt(e,t){return typeof t=="number"&&t>0?De(Math.pow(De(e),1/t)):Pr(e)}const Ie=new Uint32Array(512),Be=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ie[e]=0,Ie[e|256]=32768,Be[e]=24,Be[e|256]=24):t<-14?(Ie[e]=1024>>-t-14,Ie[e|256]=1024>>-t-14|32768,Be[e]=-t-1,Be[e|256]=-t-1):t<=15?(Ie[e]=t+15<<10,Ie[e|256]=t+15<<10|32768,Be[e]=13,Be[e|256]=13):t<128?(Ie[e]=31744,Ie[e|256]=64512,Be[e]=24,Be[e|256]=24):(Ie[e]=31744,Ie[e|256]=64512,Be[e]=13,Be[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var qe=Uint8Array,Qt=Uint16Array,Sr=Int32Array,Ar=new qe([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Rr=new qe([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Jt=function(e,t){for(var n=new Qt(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Sr(n[30]),r=1;r<30;++r)for(var s=n[r];s<n[r+1];++s)o[s]=s-n[r]<<5|r;return{b:n,r:o}},en=Jt(Ar,2),Cr=en.b,Lr=en.r;Cr[28]=258,Lr[258]=28,Jt(Rr,0);for(var kr=new Qt(32768),re=0;re<32768;++re){var ze=(re&43690)>>1|(re&21845)<<1;ze=(ze&52428)>>2|(ze&13107)<<2,ze=(ze&61680)>>4|(ze&3855)<<4,kr[re]=((ze&65280)>>8|(ze&255)<<8)>>1}for(var et=new qe(288),re=0;re<144;++re)et[re]=8;for(var re=144;re<256;++re)et[re]=9;for(var re=256;re<280;++re)et[re]=7;for(var re=280;re<288;++re)et[re]=8;for(var Dr=new qe(32),re=0;re<32;++re)Dr[re]=5;var Ir=new qe(0),Br=typeof TextDecoder<"u"&&new TextDecoder,Ur=0;try{Br.decode(Ir,{stream:!0}),Ur=1}catch{}const tn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Et(e){const t=tn.length;return tn[(e%t+t)%t]}function Or(e){const n=d.useRef(null),[r,o]=d.useState({w:0,h:0}),s=d.useRef(null),a=d.useRef(null),i=d.useRef(null),f=d.useCallback((c,h)=>{o(x=>x.w===c&&x.h===h?x:{w:c,h})},[]);return d.useLayoutEffect(()=>{const c=n.current;if(!c||c===i.current)return;const h=c.getBoundingClientRect();(h.width>0||h.height>0)&&(i.current=c,f(h.width,h.height))}),d.useEffect(()=>{var x;const c=n.current;if(c===a.current||((x=s.current)==null||x.disconnect(),s.current=null,a.current=c,!c))return;const h=new ResizeObserver(w=>{for(const u of w)f(u.contentRect.width,u.contentRect.height)});s.current=h,h.observe(c)}),d.useEffect(()=>()=>{var c;return(c=s.current)==null?void 0:c.disconnect()},[]),{ref:n,size:r}}function Gr(){const[e,t]=d.useState(!1);return d.useEffect(()=>{const n=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!0)},r=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Nr=.25,_t=64;function nn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return _t;const o=Math.min(n/e,r/t);return o<=0?_t:Math.max(Math.max(n,r)/o,8)}function rn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:s=Nr,maxZoom:a=_t,naturalWidth:i,naturalHeight:f}=e,c=Gr(),h=d.useRef(c);h.current=c;const x=d.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const w=d.useRef(o);w.current=o,d.useEffect(()=>{const m=t.current;if(!m||!o)return;const E=y=>{var $;if(!h.current)return;y.preventDefault(),y.stopPropagation();const _=y.deltaY<0?1.1:1/1.1,M=x.current,P=m.getBoundingClientRect(),R=i&&f?nn(i,f,P.width,P.height):a,B=Math.max(s,Math.min(R,M.zoom*_));if(M.zoom===B)return;const k=y.clientX-P.left,U=y.clientY-P.top,S=k-(k-M.pan.x)/M.zoom*B,A=U-(U-M.pan.y)/M.zoom*B;($=w.current)==null||$.call(w,{zoom:B,pan:{x:S,y:A}})};return m.addEventListener("wheel",E,{passive:!1}),()=>m.removeEventListener("wheel",E)},[t,!!o,s,a,i,f]);const u=d.useRef(null),v=d.useCallback(m=>{!h.current||!w.current||(m.currentTarget.setPointerCapture(m.pointerId),u.current={pointerId:m.pointerId,startX:m.clientX,startY:m.clientY,panX:x.current.pan.x,panY:x.current.pan.y})},[]),g=d.useCallback(m=>{var M;const E=u.current;if(!E||E.pointerId!==m.pointerId)return;const y=m.clientX-E.startX,_=m.clientY-E.startY;(M=w.current)==null||M.call(w,{zoom:x.current.zoom,pan:{x:E.panX+y,y:E.panY+_}})},[]),b=d.useCallback(m=>{const E=u.current;if(!(!E||E.pointerId!==m.pointerId)){try{m.currentTarget.releasePointerCapture(m.pointerId)}catch{}u.current=null}},[]),p=c&&!!o;return{containerProps:{onPointerDown:v,onPointerMove:g,onPointerUp:b,onPointerCancel:b,style:{cursor:p?"move":void 0,touchAction:p?"none":void 0}},modifierActive:c}}function Mt(){const[e,t]=d.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return d.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),s())};function s(){if(n)return;const a=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${a}dppx)`),r.addEventListener("change",o,{once:!0})}return s(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Fr(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function on(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Tt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:s}=Or(),a=d.useRef(null),i=d.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),f=d.useMemo(()=>{const g=s.w,b=s.h;if(g<=0||b<=0||n<=0||r<=0)return null;const p=Math.min(g/n,b/r),m=n*p,E=r*p;return{left:(g-m)/2,top:(b-E)/2,width:m,height:E}},[s.w,s.h,n,r]),c=e.masks,h=t.showMasks&&!!c&&c.length>0,x=d.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(d.useEffect(()=>{if(!h||!c)return;const g=a.current;if(!g)return;(g.width!==n||g.height!==r)&&(g.width=n,g.height=r);const b=g.getContext("2d");if(!b)return;b.clearRect(0,0,g.width,g.height);let p=!1;const m=b.createImageData(n,r),E=m.data;let y=c.length,_=!1;const M=()=>{p||_&&b.putImageData(m,0,0)},P=document.createElement("canvas");P.width=n,P.height=r;const R=P.getContext("2d",{willReadFrequently:!0});for(const B of c){const k=new Image;k.onload=()=>{if(!p){if(R){R.clearRect(0,0,n,r),R.drawImage(k,0,0,n,r);const U=R.getImageData(0,0,n,r).data;for(let S=0;S<n*r;S++){const A=U[S*4];if(A===0||i.has(A))continue;const[$,G,te]=Fr(Et(A));E[S*4]=$,E[S*4+1]=G,E[S*4+2]=te,E[S*4+3]=255,_=!0}}y-=1,y===0&&M()}},k.onerror=()=>{y-=1,y===0&&M()},k.src=`data:image/png;base64,${B.png_b64}`}return()=>{p=!0}},[h,c,n,r,x]),!f)return l.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const w=e.boxes??[],u=t.showBoxes&&w.length>0,v=e.class_labels??{};return l.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[h&&l.jsx("canvas",{ref:a,className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),u&&l.jsx("svg",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:w.map((g,b)=>{if(!on(g,t,i))return null;const p=g.domain==="pixel"?1:n,m=g.domain==="pixel"?1:r,E=g.position.minX*p,y=g.position.minY*m,_=(g.position.maxX-g.position.minX)*p,M=(g.position.maxY-g.position.minY)*m;return l.jsx("rect",{x:E,y,width:_,height:M,fill:"none",stroke:Et(g.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),u&&l.jsx("div",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height},children:w.map((g,b)=>{if(!on(g,t,i))return null;const p=g.domain==="pixel"?1/n:1,m=g.domain==="pixel"?1/r:1,E=g.position.minX*p*100,y=g.position.minY*m*100,_=g.label??v[String(g.class_id)]??`#${g.class_id}`,M=g.score!=null?` ${(g.score*100).toFixed(0)}%`:"";return!_&&!M?null:l.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${E}%`,top:`${y}%`,transform:"translateY(-100%)",backgroundColor:Et(g.class_id)},children:l.jsxs("span",{className:"mono",children:[_,M]})},b)})})]})}const Pt=30,fe=["#ff5a5a","#39d353","#5b9bff"];function St(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function j(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):St(e/255):St(n==="int"?e*255:e)}const zr={x:0,y:0,w:1,h:1};function Ye({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:s,notation:a="decimal",version:i=0,onActiveChange:f,sourceWindow:c=zr}){const h=d.useRef(null),x=d.useRef(!1),w=Mt(),u=d.useRef(f);u.current=f;const v=d.useCallback(b=>{var p;b!==x.current&&(x.current=b,(p=u.current)==null||p.call(u,b))},[]),g=d.useCallback(()=>{var oe;const b=h.current,p=e.current;if(!b)return;const m=window.devicePixelRatio||1,E=b.clientWidth,y=b.clientHeight;if(E===0||y===0)return;b.width!==Math.round(E*m)&&(b.width=Math.round(E*m)),b.height!==Math.round(y*m)&&(b.height=Math.round(y*m));const _=b.getContext("2d");if(!_)return;if(_.setTransform(m,0,0,m,0,0),_.clearRect(0,0,E,y),!p||t<=0||n<=0){v(!1);return}const M=p.getBoundingClientRect(),P=b.getBoundingClientRect();if(M.width===0||M.height===0){v(!1);return}const R=c.x*t,B=c.y*n,k=c.w*t,U=c.h*n;if(k<=0||U<=0){v(!1);return}const S=Math.min(M.width/k,M.height/U);if(S<Pt){v(!1);return}const A=k*S,$=U*S,G=M.left+(M.width-A)/2-P.left,te=M.top+(M.height-$)/2-P.top,be=Math.max(Math.floor(R),Math.floor(R+(0-G)/S)),ge=Math.min(Math.ceil(R+k),Math.ceil(R+(E-G)/S)),we=Math.max(Math.floor(B),Math.floor(B+(0-te)/S)),Se=Math.min(Math.ceil(B+U),Math.ceil(B+(y-te)/S));if(ge<=be||Se<=we){v(!1);return}v(!0);const me=G+(0-R)*S,Ae=te+(0-B)*S,Le=G+(t-R)*S,ie=te+(n-B)*S;_.save(),_.beginPath(),_.rect(me,Ae,Le-me,ie-Ae),_.clip(),_.textAlign="center",_.textBaseline="middle",_.lineJoin="round";const ye=S*.14,Ee=S-ye*2;for(let Me=we;Me<Se;Me++)for(let xe=be;xe<ge;xe++){if(xe<0||Me<0||xe>=t||Me>=n)continue;const Y=s(xe,Me,a);if(!Y||Y.lines.length===0)continue;const L=Y.lines.length;let I=1;for(const C of Y.lines)C.length>I&&(I=C.length);const F=Ee/(L*1.15),D=Ee/(I*.62)||F,z=Math.min(F,D,24);if(z<6)continue;const V=G+(xe-R+.5)*S,ce=te+(Me-B+.5)*S,pe=z*1.15,ne=Y.luminance<=.55,le=ne?"#ffffff":"#000000";_.font=`${z}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.lineWidth=Math.max(1.4,z*.16),_.strokeStyle=ne?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let ue=ce-L*pe/2+pe/2;for(let C=0;C<Y.lines.length;C++){const K=Y.lines[C];_.strokeText(K,V,ue),_.fillStyle=((oe=Y.colors)==null?void 0:oe[C])??le,_.fillText(K,V,ue),ue+=pe}}_.restore()},[e,t,n,s,a,v,c]);return d.useEffect(()=>{g()},[g,r,o.x,o.y,i,a,c,w]),d.useEffect(()=>{const b=h.current;if(!b)return;const p=new ResizeObserver(()=>g());return p.observe(b),()=>p.disconnect()},[g]),l.jsx("canvas",{ref:h,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function sn({notation:e,onChange:t,className:n=""}){return l.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Vr=`
struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  let xRaw = f32((vertexIndex << 1u) & 2u);
  let yRaw = f32(vertexIndex & 2u);
  var out: VSOut;
  // Y-flip vs the GLSL sibling shader's v_uv — see module doc comment.
  out.uv = vec2<f32>(xRaw, 1.0 - yRaw);
  out.position = vec4<f32>(xRaw * 2.0 - 1.0, yRaw * 2.0 - 1.0, 0.0, 1.0);
  return out;
}

// Logical binding 0 (texture, source image) -> native binding 0*3+0 = 0.
@group(0) @binding(0) var t_bind0: texture_2d<f32>;
// Logical binding 1 (texture, colormap LUT 256x1) -> native binding 1*3+0 = 3.
@group(0) @binding(3) var t_bind1: texture_2d<f32>;
// Logical binding 2 (uniform vec4: exposureEV, operator, gamma, isScalar) -> native binding 2*3+2 = 8.
@group(0) @binding(8) var<uniform> u_bind2: vec4<f32>;
// Logical binding 3 (uniform vec4: uvRect.x, uvRect.y, uvRect.w, uvRect.h) -> native binding 3*3+2 = 11.
@group(0) @binding(11) var<uniform> u_bind3: vec4<f32>;
// Logical binding 4 (uniform f32: hdrOut) -> native binding 4*3+2 = 14.
@group(0) @binding(14) var<uniform> u_bind4: f32;
// Logical binding 5 (uniform f32: filterMode, 0=nearest/1=linear) -> native binding 5*3+2 = 17.
@group(0) @binding(17) var<uniform> u_bind5: f32;

// --- ported verbatim from image/tonemap.ts ---

fn srgbOetf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.0031308) {
    return 12.92 * v;
  }
  return 1.055 * pow(v, 1.0 / 2.4) - 0.055;
}

fn outputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 {
  if (hasGamma) {
    return clamp(pow(clamp(x, 0.0, 1.0), 1.0 / gamma), 0.0, 1.0);
  }
  return srgbOetf(x);
}

fn reinhardCurve(x: f32) -> f32 {
  let v = max(x, 0.0);
  return v / (1.0 + v);
}

fn acesCurve(x: f32) -> f32 {
  let v = max(x, 0.0);
  let num = v * (2.51 * v + 0.03);
  let den = v * (2.43 * v + 0.59) + 0.14;
  return clamp(num / den, 0.0, 1.0);
}

// Manual bilinear blend of the 4 texels surrounding 'uv' (source-space
// [0,1]) — see module doc comment's "Source filtering" section for why this
// is hand-rolled instead of a real Sampler+textureSample. 'uv' is assumed
// already inside [0,1) (the OOB-transparent check runs before this is
// called); neighbor indices are clamped to the texture's own edge (standard
// filter-kernel clamp-to-edge, NOT the Q18 uvRect-window OOB check above).
fn sampleBilinearF(uv: vec2<f32>, dims: vec2<f32>) -> vec4<f32> {
  let texel = uv * dims - vec2<f32>(0.5);
  let base = floor(texel);
  let frac = texel - base;
  let maxX = i32(dims.x) - 1;
  let maxY = i32(dims.y) - 1;
  let x0 = clamp(i32(base.x), 0, maxX);
  let x1 = clamp(i32(base.x) + 1, 0, maxX);
  let y0 = clamp(i32(base.y), 0, maxY);
  let y1 = clamp(i32(base.y) + 1, 0, maxY);
  let c00 = textureLoad(t_bind0, vec2<i32>(x0, y0), 0);
  let c10 = textureLoad(t_bind0, vec2<i32>(x1, y0), 0);
  let c01 = textureLoad(t_bind0, vec2<i32>(x0, y1), 0);
  let c11 = textureLoad(t_bind0, vec2<i32>(x1, y1), 0);
  let top = mix(c00, c10, frac.x);
  let bot = mix(c01, c11, frac.x);
  return mix(top, bot, frac.y);
}

// operatorId: 0=linear, 1=srgb, 2=reinhard, 3=aces, 4=extended (matches
// TONEMAP_OPERATORS key order in image/tonemap.ts). linear/srgb are the SAME
// clamp — the sRGB OETF lives in outputEncodeF, not here. 4 (extended) is a
// pure identity — no compression, no clamp — deliberately preserving values
// above 1.0 for a real HDR (hdrOut) target; see image/tonemap.ts's doc
// comment on the "extended" entry for why.
fn applyOperator(rgb: vec3<f32>, operatorId: i32) -> vec3<f32> {
  if (operatorId == 2) {
    return vec3<f32>(reinhardCurve(rgb.x), reinhardCurve(rgb.y), reinhardCurve(rgb.z));
  }
  if (operatorId == 3) {
    return vec3<f32>(acesCurve(rgb.x), acesCurve(rgb.y), acesCurve(rgb.z));
  }
  if (operatorId == 4) {
    return rgb;
  }
  // 0 (linear) and 1 (srgb), and any unrecognized id, fall back to the clamp.
  return clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let srcDims = vec2<f32>(textureDimensions(t_bind0));
  let uvRect = u_bind3;
  let uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(0.999999));
  // Image-space UV, UNCLAMPED — Q18: test this against [0,1) before doing
  // anything else. Zoomed-out (uvRect.zw > 1-uvRect.xy) pushes this outside
  // [0,1] on purpose; that region must render fully transparent, not a
  // clamped-edge smear.
  let rawSrcUV = uvRect.xy + uv * uvRect.zw;
  if (rawSrcUV.x < 0.0 || rawSrcUV.x >= 1.0 || rawSrcUV.y < 0.0 || rawSrcUV.y >= 1.0) {
    return vec4<f32>(0.0);
  }
  let srcUV = clamp(rawSrcUV, vec2<f32>(0.0), vec2<f32>(0.999999));

  let filterLinear = u_bind5 > 0.5;
  var sampled: vec4<f32>;
  if (filterLinear) {
    sampled = sampleBilinearF(srcUV, srcDims);
  } else {
    let coord = vec2<i32>(srcUV * srcDims);
    sampled = textureLoad(t_bind0, coord, 0);
  }

  let exposureEV = u_bind2.x;
  let operatorId = i32(round(u_bind2.y));
  let gamma = u_bind2.z;
  let isScalar = u_bind2.w > 0.5;
  let hdrOut = u_bind4 > 0.5;

  // 1) exposure, in scene-linear space: v * 2^EV.
  var rgb = sampled.rgb * exp2(exposureEV);

  // 2) scalar image + colormap LUT (GPU-only pipeline stage; see module doc).
  if (isScalar) {
    let idxF = clamp(rgb.x, 0.0, 1.0) * 255.0;
    // Deterministic round-half-up (matches CPU Math.round for non-negative
    // inputs) — WGSL's round() is round-half-to-EVEN, which disagrees with
    // Math.round (and with GLSL's implementation-defined round()) exactly at
    // k+0.5 boundaries. See image.glsl.ts for the mirrored fix.
    let idx = clamp(i32(floor(idxF + 0.5)), 0, 255);
    let lutColor = textureLoad(t_bind1, vec2<i32>(idx, 0), 0);
    rgb = lutColor.rgb;
  }

  // 3) tone-map operator: HDR [0,inf) -> display-linear [0,1].
  rgb = applyOperator(rgb, operatorId);

  // 4) output-encode (skipped for an HDR-linear target).
  if (hdrOut) {
    return vec4<f32>(rgb, 1.0);
  }
  let hasGamma = gamma > 0.0;
  return vec4<f32>(
    outputEncodeF(rgb.r, gamma, hasGamma),
    outputEncodeF(rgb.g, gamma, hasGamma),
    outputEncodeF(rgb.b, gamma, hasGamma),
    1.0,
  );
}
`,Ge=`
struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  let xRaw = f32((vertexIndex << 1u) & 2u);
  let yRaw = f32(vertexIndex & 2u);
  var out: VSOut;
  out.uv = vec2<f32>(xRaw, 1.0 - yRaw);
  out.position = vec4<f32>(xRaw * 2.0 - 1.0, yRaw * 2.0 - 1.0, 0.0, 1.0);
  return out;
}
`,an=`
// Manual bilinear blend over a source texture (see image.wgsl.ts's
// sampleBilinearF doc comment for why this is hand-rolled).
fn sampleBilinearOf(tex: texture_2d<f32>, uv: vec2<f32>, dims: vec2<f32>) -> vec4<f32> {
  let texel = uv * dims - vec2<f32>(0.5);
  let base = floor(texel);
  let frac = texel - base;
  let maxX = i32(dims.x) - 1;
  let maxY = i32(dims.y) - 1;
  let x0 = clamp(i32(base.x), 0, maxX);
  let x1 = clamp(i32(base.x) + 1, 0, maxX);
  let y0 = clamp(i32(base.y), 0, maxY);
  let y1 = clamp(i32(base.y) + 1, 0, maxY);
  let c00 = textureLoad(tex, vec2<i32>(x0, y0), 0);
  let c10 = textureLoad(tex, vec2<i32>(x1, y0), 0);
  let c01 = textureLoad(tex, vec2<i32>(x0, y1), 0);
  let c11 = textureLoad(tex, vec2<i32>(x1, y1), 0);
  let top = mix(c00, c10, frac.x);
  let bot = mix(c01, c11, frac.x);
  return mix(top, bot, frac.y);
}

// Nearest-texelFetch LUT lookup, round-half-up index (see image.wgsl.ts).
fn sampleLUT(lut: texture_2d<f32>, valueUnit: f32) -> vec3<f32> {
  let idxF = clamp(valueUnit, 0.0, 1.0) * 255.0;
  let idx = clamp(i32(floor(idxF + 0.5)), 0, 255);
  return textureLoad(lut, vec2<i32>(idx, 0), 0).rgb;
}
`,$r=`
fn srgbOetf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.0031308) { return 12.92 * v; }
  return 1.055 * pow(v, 1.0 / 2.4) - 0.055;
}

fn outputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 {
  if (hasGamma) { return clamp(pow(clamp(x, 0.0, 1.0), 1.0 / gamma), 0.0, 1.0); }
  return srgbOetf(x);
}

fn reinhardCurve(x: f32) -> f32 { let v = max(x, 0.0); return v / (1.0 + v); }
fn acesCurve(x: f32) -> f32 {
  let v = max(x, 0.0);
  let num = v * (2.51 * v + 0.03);
  let den = v * (2.43 * v + 0.59) + 0.14;
  return clamp(num / den, 0.0, 1.0);
}
fn applyOperator(rgb: vec3<f32>, operatorId: i32) -> vec3<f32> {
  if (operatorId == 2) { return vec3<f32>(reinhardCurve(rgb.x), reinhardCurve(rgb.y), reinhardCurve(rgb.z)); }
  if (operatorId == 3) { return vec3<f32>(acesCurve(rgb.x), acesCurve(rgb.y), acesCurve(rgb.z)); }
  return clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
}

// Per-side exposure -> [scalar LUT] -> operator -> encode. The lut is only
// read when isScalar. Verbatim behavior from compare.wgsl.ts's processSide.
fn processSide(lut: texture_2d<f32>, sampled: vec4<f32>, exposureEV: f32, operatorId: i32, gamma: f32, isScalar: bool, hdrOut: bool) -> vec3<f32> {
  var rgb = sampled.rgb * exp2(exposureEV);
  if (isScalar) { rgb = sampleLUT(lut, rgb.x); }
  rgb = applyOperator(rgb, operatorId);
  if (hdrOut) { return rgb; }
  let hasGamma = gamma > 0.0;
  return vec3<f32>(outputEncodeF(rgb.r, gamma, hasGamma), outputEncodeF(rgb.g, gamma, hasGamma), outputEncodeF(rgb.b, gamma, hasGamma));
}
`,tt=`
const M_RGB2XYZ = mat3x3<f32>(
  // column-major: WGSL mat3x3 columns are the 3 args; we store rows via transpose usage below.
  vec3<f32>(10135552.0/24577794.0, 2613072.0/12288897.0, 1425312.0/73733382.0),
  vec3<f32>(8788810.0/24577794.0, 8788810.0/12288897.0, 8788810.0/73733382.0),
  vec3<f32>(4435075.0/24577794.0, 887015.0/12288897.0, 70074185.0/73733382.0)
);
// Exact inverse of M_RGB2XYZ (columns), so ycxcz->linrgb round-trips the
// forward transform used in flip-reference.ts.
const M_XYZ2RGB = mat3x3<f32>(
  vec3<f32>(3.241003232976358, -0.9692242522025163, 0.0556394198519754),
  vec3<f32>(-1.537398969488785, 1.875929983695176, -0.2040112061239099),
  vec3<f32>(-0.4986158819963628, 0.04155422634008469, 1.057148977187533)
);
const WHITE_INV = vec3<f32>(1.052156925, 1.0, 0.918357670);
const LAB_DELTA = 6.0 / 29.0;

fn flip_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
// Linear RGB -> YCxCz (no OETF decode). Used by HDR-FLIP (tone-mapped, already
// linear inputs, hdr-flip.ts) and forced-LDR-on-float (linear-clamp input,
// flip.wgsl.ts); matches flip-reference.ts's linrgb2ycxcz.
fn flip_linrgb2ycxcz(lin: vec3<f32>) -> vec3<f32> {
  let xyz = M_RGB2XYZ * lin;
  let n = xyz * WHITE_INV;
  return vec3<f32>(116.0 * n.y - 16.0, 500.0 * (n.x - n.y), 200.0 * (n.y - n.z));
}
fn flip_rgb2ycxcz(srgb: vec3<f32>) -> vec3<f32> {
  let lin = vec3<f32>(flip_srgb2linear(srgb.r), flip_srgb2linear(srgb.g), flip_srgb2linear(srgb.b));
  return flip_linrgb2ycxcz(lin);
}
fn flip_ycxcz2linrgb(yc: vec3<f32>) -> vec3<f32> {
  let yy = (yc.x + 16.0) / 116.0;
  let x = (yy + yc.y / 500.0) / WHITE_INV.x;
  let yN = yy / WHITE_INV.y;
  let z = (yy - yc.z / 200.0) / WHITE_INV.z;
  return M_XYZ2RGB * vec3<f32>(x, yN, z);
}
fn flip_labF(t: f32) -> f32 {
  if (t > LAB_DELTA * LAB_DELTA * LAB_DELTA) { return pow(t, 1.0 / 3.0); }
  return t / (3.0 * LAB_DELTA * LAB_DELTA) + 4.0 / 29.0;
}
fn flip_linrgb2huntlab(rgb: vec3<f32>) -> vec3<f32> {
  let xyz = M_RGB2XYZ * clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
  let n = xyz * WHITE_INV;
  let fx = flip_labF(n.x);
  let fy = flip_labF(n.y);
  let fz = flip_labF(n.z);
  let L = 116.0 * fy - 16.0;
  let a = 500.0 * (fx - fy);
  let b = 200.0 * (fy - fz);
  return vec3<f32>(L, 0.01 * L * a, 0.01 * L * b);
}
fn flip_hyab(l1: vec3<f32>, l2: vec3<f32>) -> f32 {
  let d = l1 - l2;
  return abs(d.x) + sqrt(d.y * d.y + d.z * d.z);
}
`;function cn(e){return`
${Ge}
${an}
${$r}

@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(6) var lut: texture_2d<f32>;
@group(0) @binding(11) var<uniform> u_img: vec4<f32>;     // exposureEV, operatorId, gamma, isScalar
@group(0) @binding(14) var<uniform> u_uv: vec4<f32>;      // uvRect.xy, uvRect.wh
@group(0) @binding(17) var<uniform> u_compose: vec4<f32>; // split, alpha, hdrOut, filterMode

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(0.999999));
  let uvRect = u_uv;
  let rawSrcUV = uvRect.xy + uv * uvRect.zw;
  if (rawSrcUV.x < 0.0 || rawSrcUV.x >= 1.0 || rawSrcUV.y < 0.0 || rawSrcUV.y >= 1.0) {
    return vec4<f32>(0.0);
  }
  let srcUV = clamp(rawSrcUV, vec2<f32>(0.0), vec2<f32>(0.999999));
  let filterLinear = u_compose.w > 0.5;

  let dimsA = vec2<f32>(textureDimensions(texA));
  var sampledA: vec4<f32>;
  if (filterLinear) { sampledA = sampleBilinearOf(texA, srcUV, dimsA); }
  else { sampledA = textureLoad(texA, vec2<i32>(srcUV * dimsA), 0); }

  let dimsB = vec2<f32>(textureDimensions(texB));
  var sampledB: vec4<f32>;
  if (filterLinear) { sampledB = sampleBilinearOf(texB, srcUV, dimsB); }
  else { sampledB = textureLoad(texB, vec2<i32>(srcUV * dimsB), 0); }

  let exposureEV = u_img.x;
  let operatorId = i32(round(u_img.y));
  let gamma = u_img.z;
  let isScalar = u_img.w > 0.5;
  let hdrOut = u_compose.z > 0.5;

  let colorA = processSide(lut, sampledA, exposureEV, operatorId, gamma, isScalar, hdrOut);
  let colorB = processSide(lut, sampledB, exposureEV, operatorId, gamma, isScalar, hdrOut);

  let split = u_compose.x;
  let alpha = u_compose.y;
  let outColor = ${e};
  return vec4<f32>(outColor, 1.0);
}
`}const Xr=cn("select(colorB, colorA, uv.x < split)"),Wr=cn("mix(colorA, colorB, alpha)"),At={linear:0,srgb:1,reinhard:2,aces:3,extended:4},ln=new WeakMap;function Yr(e,t){let n=ln.get(e);n||(n=new Map,ln.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Vr,targetFormat:t}),n.set(t,r)),r}function un(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function dn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Hr(e,t,n,r){var v;const o=un(t),s=Yr(e,o),a=dn(e,r.isScalar?r.colormap:void 0),i=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,f=At[r.operator]??At.srgb,c=new Float32Array([r.exposureEV,f,i,r.isScalar?1:0]),h=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),w=new Float32Array([r.filter==="nearest"?0:1]);let u;try{u=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:a},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:w}}]),e.renderFullscreen(t,s,u)}finally{(v=u==null?void 0:u.destroy)==null||v.call(u),a.destroy()}}const fn=new WeakMap;function Kr(e,t,n){let r=fn.get(e);r||(r=new Map,fn.set(e,r));const o=`${t}:${n}`;let s=r.get(o);return s||(s=e.createRenderPipeline({shaderWGSL:t==="split"?Xr:Wr,targetFormat:n}),r.set(o,s)),s}function qr(e,t,n,r,o){var v;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const s=un(t),a=Kr(e,o.mode,s),i=dn(e,void 0),f=o.gamma,c=At[o.operator],h=new Float32Array([o.exposureEV,c,f,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),w=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]);let u;try{u=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:i},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:w}}]),e.renderFullscreen(t,a,u)}finally{(v=u==null?void 0:u.destroy)==null||v.call(u),i.destroy()}}function pn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,s=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:s,mae:o}}async function hn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),s=r*o*3;if(s<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:w,sumAbs:u}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return pn(w,u,s)}const a=await e.readback(t),i=await e.readback(n),f=a instanceof Uint8Array,c=i instanceof Uint8Array;let h=0,x=0;for(let w=0;w<o;w++)for(let u=0;u<r;u++){const v=(w*t.width+u)*4,g=(w*n.width+u)*4;for(let b=0;b<3;b++){const p=(a[v+b]??0)/(f?255:1),m=(i[g+b]??0)/(c?255:1),E=p-m;h+=E*E,x+=Math.abs(E)}}return pn(h,x,s)}function gn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Zr=12,Ve=[];function mn(e){const t=Ve.indexOf(e);t!==-1&&Ve.splice(t,1),Ve.push(e)}function jr(e){const t=Ve.indexOf(e);t!==-1&&Ve.splice(t,1)}function nt(e){e.parked||(jr(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function xn(e){for(;Ve.length>Zr;){const t=Ve.find(n=>n!==e&&!n.visible)??Ve.find(n=>n!==e);if(!t)break;nt(t)}}function vn(e){var o,s;if(e.disposed)return;if(gn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){mn(e),xn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const a=t.createTexture(e.source.width,e.source.height,e.source.format);a.write(e.source.data),e.srcTexture=a}e.parked=!1,mn(e),xn(e)}function Qr(e,t){if(e.disposed||!e.source)return!0;try{return vn(e),!e.surface||!e.srcTexture?!1:(Hr(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,nt(e),!1}}function Jr(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Qr(e,t)},park(){e.disposed||nt(e)},restore(){e.disposed||!e.source||vn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(nt(e),e.source=null,e.disposed=!0)}}}async function eo(e,t){const n=await Qe(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Jr(r)}function bn(e){e.dispose()}function to(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:s}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...s?["invert(1)"]:[]].join(" ")}function wn(e){const n=`cairn-gamma-${d.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:s,exposure:a,offset:i,flipSign:f}=e,c=d.useMemo(()=>to(e,n),[n,r,o,a,f]);return{gammaFilterId:n,filterStr:c,gamma:s,offset:i}}function yn({id:e,gamma:t,offset:n}){return l.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:l.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:l.jsxs("feComponentTransfer",{children:[l.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),l.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),l.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function En(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function no({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=En(e),s=En(t),a=[];for(let m=0;m<=e;m+=o)a.push(m);const i=[];for(let m=0;m<=t;m+=s)i.push(m);const f=1/n,c=8*f,h=-12*f,x=-2*f,w=r==null?void 0:r.current;let u=0,v=0,g=0,b=0;if(w){const m=w.clientWidth,E=w.clientHeight,y=m/e,_=E/t,M=Math.min(y,_);g=e*M,b=t*M,u=(m-g)/2,v=(E-b)/2}const p=w&&g>0;return l.jsxs(l.Fragment,{children:[l.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:p?v:0,transform:`translateY(${h}px)`,fontSize:c},children:a.map(m=>l.jsx("span",{className:"mono",style:{position:"absolute",left:p?u+m/e*g:`${m/e*100}%`,transform:"translateX(-50%)"},children:m},m))}),l.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:p?u:0,transform:`translateX(${x}px)`,fontSize:c},children:i.map(m=>l.jsx("span",{className:"mono",style:{position:"absolute",top:p?v+m/t*b:`${m/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*f}px`},children:m},m))})]})}function ro({label:e,isDraggable:t,onDragStart:n}){return l.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&l.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const oo=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function _n(e,t){const n=getComputedStyle(e),r=oo.map(f=>`${f}:${n.getPropertyValue(f)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const s=e.children,a=t.children,i=Math.min(s.length,a.length);for(let f=0;f<i;f++)_n(s[f],a[f])}function Rt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Ct(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Lt(e,t,n,r,o){const s=document.createElement("canvas");s.width=Math.max(1,Math.round(e*n)),s.height=Math.max(1,Math.round(t*n));const a=s.getContext("2d");if(!a)throw new Error("plot-to-png: 2D canvas context unavailable");return a.scale(n,n),r&&(a.fillStyle=r,a.fillRect(0,0,e,t)),o(a),await new Promise((i,f)=>s.toBlob(c=>c?i(c):f(new Error("plot-to-png: toBlob returned null")),"image/png"))}function so(e,t,n){const r=e.cloneNode(!0);_n(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),s="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((a,i)=>{const f=new Image;f.onload=()=>a(f),f.onerror=()=>i(new Error("plot-to-png: SVG rasterization failed")),f.src=s})}async function Mn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,s=(t==null?void 0:t.background)??Rt(e);return Lt(r,o,Ct(t),s,a=>a.drawImage(e,0,0,r,o))}async function ao(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,s=(t==null?void 0:t.background)??Rt(e);try{return await Lt(r,o,Ct(t),s,a=>a.drawImage(e,0,0,r,o))}catch(a){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${a instanceof Error?a.message:String(a)})`)}}function io(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const s=o.getBoundingClientRect(),a=s.width*s.height;a>r&&(r=a,n=o)}return n}async function co(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),s=o.width||300,a=o.height||150,i=(t==null?void 0:t.background)??Rt(e);if(n){const c=n.getBoundingClientRect(),h=await so(n,c.width||s,c.height||a);return Lt(s,a,Ct(t),i,x=>{for(const w of r){const u=w.getBoundingClientRect();x.drawImage(w,u.left-o.left,u.top-o.top,u.width,u.height)}x.drawImage(h,c.left-o.left,c.top-o.top,c.width,c.height)})}if(r.length)return Mn(r[0],t);const f=io(e);if(f)return ao(f,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function lo(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const uo={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},fo={boxZoom:l.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:l.jsxs(l.Fragment,{children:[l.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),l.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:l.jsxs(l.Fragment,{children:[l.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),l.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),l.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:l.jsxs(l.Fragment,{children:[l.jsx("path",{d:"M12 2v20M2 12h20"}),l.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:l.jsxs(l.Fragment,{children:[l.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),l.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:l.jsxs(l.Fragment,{children:[l.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),l.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:l.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:l.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:l.jsxs(l.Fragment,{children:[l.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),l.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:l.jsx("path",{d:"M6 9l6 6 6-6"})};function kt({name:e}){return l.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:fo[e]??null})}function Ue({icon:e,label:t,title:n,active:r,disabled:o,onClick:s}){return l.jsx("button",{type:"button",disabled:o,onClick:a=>{a.stopPropagation(),!o&&s()},onPointerDown:a=>a.stopPropagation(),onDoubleClick:a=>a.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?l.jsx("span",{"aria-hidden":"true",children:t}):l.jsx(kt,{name:e??""})})}function rt(){return l.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function po({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:s}=n,[a,i]=d.useState(!1),[f,c]=d.useState(0),h=d.useRef(null),x=Math.max(0,r.findIndex(p=>p.id===o)),w=e?void 0:((b=r[x])==null?void 0:b.label)??"",u=d.useCallback(()=>{i(p=>{const m=!p;return m&&c(x),m})},[x]),v=d.useCallback(p=>{s(p),i(!1)},[s]);d.useEffect(()=>{if(!a)return;const p=E=>{h.current&&!h.current.contains(E.target)&&i(!1)},m=E=>{E.key==="Escape"&&(E.stopPropagation(),i(!1))};return document.addEventListener("pointerdown",p,!0),document.addEventListener("keydown",m,!0),()=>{document.removeEventListener("pointerdown",p,!0),document.removeEventListener("keydown",m,!0)}},[a]);const g=p=>{if(!a){(p.key==="ArrowDown"||p.key==="Enter"||p.key===" ")&&(p.preventDefault(),c(x),i(!0));return}if(p.key==="ArrowDown")p.preventDefault(),c(m=>(m+1)%r.length);else if(p.key==="ArrowUp")p.preventDefault(),c(m=>(m-1+r.length)%r.length);else if(p.key==="Enter"||p.key===" "){p.preventDefault();const m=r[f];m&&v(m.id)}};return l.jsxs("div",{ref:h,className:"relative inline-flex",onPointerDown:p=>p.stopPropagation(),children:[l.jsxs("button",{type:"button",onClick:p=>{p.stopPropagation(),u()},onDoubleClick:p=>p.stopPropagation(),onKeyDown:g,"aria-haspopup":"listbox","aria-expanded":a,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",w?"px-1.5 text-[10px] font-mono":"px-1 text-xs",a?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[w?l.jsx("span",{"aria-hidden":"true",children:w}):l.jsx(kt,{name:e??""}),l.jsx(kt,{name:"caret"})]}),a&&l.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((p,m)=>{const E=p.id===o,y=m===f;return l.jsx("li",{role:"option","aria-selected":E,children:l.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),v(p.id)},onPointerEnter:()=>c(m),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",y?"bg-bg-hover":"",E?"text-accent font-medium":"text-fg"].join(" "),children:p.label})},p.id)})})]})}function ho({controller:e,config:t}){if((t==null?void 0:t.enabled)===!1)return null;const n=e.capabilities,r=t==null?void 0:t.buttons,o=(u,v)=>v&&(r==null?void 0:r[u])!==!1,s=u=>()=>e.setDragMode(u),a=o("zoom",n.zoom)||o("pan",n.pan)||o("select",n.select)||o("lasso",n.lasso),i=o("zoomIn",n.zoom)||o("zoomOut",n.zoom),f=o("autoscale",n.autoscale)||o("reset",n.reset),c=o("screenshot",n.screenshot),h=(t==null?void 0:t.leadingButtons)??[];if(!h.length&&!a&&!i&&!f&&!c)return null;const x=(t==null?void 0:t.position)??"top-right",w=(t==null?void 0:t.visibility)==="always";return l.jsxs("div",{style:{position:"absolute",pointerEvents:"auto",...uo[x]},className:["z-30 flex items-center gap-0.5 rounded border border-border","bg-bg-elevated/90 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-opacity",w?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),role:"toolbar","aria-label":"Plot controls",children:[h.length>0&&l.jsxs(l.Fragment,{children:[h.map(u=>u.menu?l.jsx(po,{icon:u.icon,title:u.title,menu:u.menu},u.id):l.jsx(Ue,{icon:u.icon,label:u.label,title:u.title,active:u.active,disabled:u.disabled,onClick:u.onClick??(()=>{})},u.id)),(a||i||f||c)&&l.jsx(rt,{})]}),a&&l.jsxs(l.Fragment,{children:[o("zoom",n.zoom)&&l.jsx(Ue,{icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:s("zoom")}),o("pan",n.pan)&&l.jsx(Ue,{icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:s("pan")}),o("select",n.select)&&l.jsx(Ue,{icon:"select",title:"Box select",active:e.dragMode==="select",onClick:s("select")}),o("lasso",n.lasso)&&l.jsx(Ue,{icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:s("lasso")})]}),i&&l.jsxs(l.Fragment,{children:[a&&l.jsx(rt,{}),o("zoomIn",n.zoom)&&l.jsx(Ue,{icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),o("zoomOut",n.zoom)&&l.jsx(Ue,{icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()})]}),f&&l.jsxs(l.Fragment,{children:[(a||i)&&l.jsx(rt,{}),o("autoscale",n.autoscale)&&l.jsx(Ue,{icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),o("reset",n.reset)&&l.jsx(Ue,{icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()})]}),c&&l.jsxs(l.Fragment,{children:[(a||i||f)&&l.jsx(rt,{}),l.jsx(Ue,{icon:"camera",title:"Download plot as PNG",onClick:()=>{e.toPNG({filename:"plot"}).then(u=>lo(u,"plot.png")).catch(()=>{})}})]})]})}const go={zoom:1,pan:{x:0,y:0}},Tn=1.3,mo=.25,xo=64,vo={buttons:{zoom:!1}};function bo(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const wo=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Dt(e,t){return{id:"colormap",title:"Colormap",menu:{options:wo,value:e,onSelect:t}}}function yo({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:s,naturalHeight:a,minZoom:i=mo,maxZoom:f=xo,requestRender:c}){const h=d.useCallback(y=>{var $;if(!o)return;const _=($=e.current)==null?void 0:$.getBoundingClientRect(),M=(_==null?void 0:_.width)??0,P=(_==null?void 0:_.height)??0,R=s&&a&&M>0&&P>0?nn(s,a,M,P):f,B=Math.max(i,Math.min(R,n*y));if(B===n)return;const k=M/2,U=P/2,S=k-(k-r.x)/n*B,A=U-(U-r.y)/n*B;o({zoom:B,pan:{x:S,y:A}})},[o,e,s,a,f,i,n,r.x,r.y]),x=d.useCallback(()=>h(Tn),[h]),w=d.useCallback(()=>h(1/Tn),[h]),u=d.useCallback(()=>o==null?void 0:o(go),[o]),v=d.useCallback(y=>{const _={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};c==null||c();const M=t==null?void 0:t.current;if(M)return Mn(M,_);const P=e.current;return P?co(P,_):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,c]),g=d.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),b=n!==1||r.x!==0||r.y!==0,p=d.useCallback(y=>{},[]),m=d.useCallback(y=>{},[]),E=d.useCallback(()=>{},[]);return d.useMemo(()=>({capabilities:g,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:b,setDragMode:p,setHoverMode:m,toggleSpikelines:E,zoomIn:x,zoomOut:w,autoscale:u,reset:u,toPNG:v}),[g,b,p,m,E,x,w,u,v])}const Eo={zoom:1,pan:{x:0,y:0}};function ot({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:s,pan:a,onViewportChange:i,naturalDims:f,checkerboard:c,wrapperClassName:h,wrapperStyle:x,viewportPadding:w,header:u,surface:v,showAxes:g,overlayNode:b,overlay:p,notationSeed:m,exportCanvasRef:E,requestRender:y,leadingMenus:_,label:M,showLabelChip:P,isDraggable:R=!1,onDragStart:B,extraChips:k}){const[U,S]=d.useState(m),[A,$]=d.useState(!1),{containerProps:G}=rn({containerRef:r,zoom:s,pan:a,onViewportChange:i,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h}),te=d.useCallback(()=>{i==null||i(Eo)},[i]),be=yo({rootRef:r,canvasRef:E,zoom:s,pan:a,onViewportChange:i,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h,requestRender:y}),ge=d.useMemo(()=>({...vo,leadingButtons:[..._??[],...A?[bo(U,S)]:[]]}),[A,U,_]),we=" cairn-checkerboard",Se="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(c==="pane"?we:""),me=h+(c==="wrapper"?we:""),Ae="render"in p?p.render({notation:U,setOverlayActive:$}):p.hasSource&&f?l.jsx(Ye,{imageElRef:p.displayElRef,naturalWidth:f.w,naturalHeight:f.h,zoom:s,pan:a,sourceWindow:p.sourceWindow,sample:p.sample,notation:U,version:p.version,onActiveChange:$}):null;return l.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[u,n&&l.jsx(ho,{controller:be,config:ge}),l.jsxs("div",{ref:r,className:Se,style:{padding:w,...G.style},onPointerDown:G.onPointerDown,onPointerMove:G.onPointerMove,onPointerUp:G.onPointerUp,onPointerCancel:G.onPointerCancel,onDoubleClick:te,...t,children:[l.jsxs("div",{ref:o,className:me,style:x,children:[v,g&&f&&l.jsx(no,{naturalWidth:f.w,naturalHeight:f.h,zoom:s,containerRef:o}),b]}),Ae,!n&&A&&l.jsx(sn,{notation:U,onChange:S})]}),P&&l.jsx(ro,{label:M,isDraggable:R,onDragStart:B}),k]})}function Pn(e){return"hdr"in e&&e.hdr!=null}function Sn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function _e(e){return Number.isFinite(e)?e:0}const _o={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Mo(e,t,n,r){const{h:o,w:s,c:a}=Sn(e.shape),i=e.data,f=Tr(t),c=new Uint8ClampedArray(s*o*4);for(let h=0;h<s*o;h++){const x=h*a;let w,u,v,g=1;a===1?w=u=v=_e(i[x]):a===3?(w=_e(i[x]),u=_e(i[x+1]),v=_e(i[x+2])):(w=_e(i[x]),u=_e(i[x+1]),v=_e(i[x+2]),g=_e(i[x+3]));const b=[wt(w,n),wt(u,n),wt(v,n)],[p,m,E]=f(b),y=h*4;c[y]=255*yt(p,r),c[y+1]=255*yt(m,r),c[y+2]=255*yt(E,r),c[y+3]=255*(g<0?0:g>1?1:g)}return new ImageData(c,s,o)}function To(e){var le,ue;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:s="auto",colormap:a="none",showAxes:i=!1,processing:f=_o,zoom:c=1,pan:h={x:0,y:0},onViewportChange:x,onNaturalSize:w,label:u,isDraggable:v=!1,onDragStart:g,overlay:b,overlaySettings:p,pixelValueNotation:m="decimal",toolbar:E=!0}=e,[y,_]=d.useState(a);d.useEffect(()=>{_(a)},[a]);const M=d.useRef(null),P=d.useRef(null),R=d.useRef(null),B=d.useRef(null),k=d.useRef(null),U=d.useRef(null),S=d.useRef(null),[A,$]=d.useState(0),G=d.useCallback(()=>$(C=>C+1),[]),te=d.useMemo(()=>({get current(){const C=k.current;return C instanceof HTMLCanvasElement?C:null}}),[]),be=d.useCallback(C=>{M.current=C,C&&(k.current=C)},[]),ge=d.useCallback(C=>{P.current=C,C&&(k.current=C)},[]),we=d.useCallback(C=>{C&&(k.current=C)},[]),[Se,me]=d.useState(!1),[Ae,Le]=d.useState(!1),[ie,ye]=d.useState(null),{flipSign:Ee}=f,{gammaFilterId:oe,filterStr:Me,gamma:xe,offset:Y}=wn(f),L=!r&&o!=="none"&&n!=null&&t!=null,I=o!=="none"&&n!=null,F=y!=="none"&&!L&&!(r&&I)&&t!=null;d.useEffect(()=>{if(!F||!t){Le(!1);return}let C=!1;Le(!1);const K=`${t}::${y}`,q=mt(K);if(q){const H=P.current;if(H){H.width=q.width,H.height=q.height;const se=H.getContext("2d");se&&se.putImageData(q,0,0),S.current=q,G(),ye({w:q.width,h:q.height}),w==null||w(q.width,q.height),Le(!0)}return}const J=new Image;return J.onload=()=>{if(C)return;const H=document.createElement("canvas");H.width=J.naturalWidth,H.height=J.naturalHeight;const se=H.getContext("2d");if(!se)return;se.drawImage(J,0,0);const Re=se.getImageData(0,0,H.width,H.height),Oe=Wt.has(y)?"positive":"linear",he=gt(Re,y,Oe);xt(K,he);const ke=P.current;if(!ke||C)return;ke.width=he.width,ke.height=he.height;const ve=ke.getContext("2d");ve&&ve.putImageData(he,0,0),S.current=he,G(),ye({w:he.width,h:he.height}),w==null||w(he.width,he.height),Le(!0)},J.src=t,()=>{C=!0}},[F,t,y]);const D=d.useCallback((C,K)=>{ye(q=>q&&q.w===C&&q.h===K?q:{w:C,h:K}),w==null||w(C,K)},[]);d.useEffect(()=>{if(!t){U.current=null,S.current=null,G();return}let C=!1;return Xe(t).then(K=>{C||(U.current=K,y==="none"&&(S.current=K),G())}),()=>{C=!0}},[t,y,G]);const z=d.useCallback((C,K,q)=>{const J=U.current;if(!J||C<0||K<0||C>=J.width||K>=J.height)return null;const H=(K*J.width+C)*4,se=J.data[H],Re=J.data[H+1],Oe=J.data[H+2],he=S.current;let ke=se,ve=Re,T=Oe;if(he&&he.width===J.width&&he.height===J.height){const O=(K*he.width+C)*4;ke=he.data[O],ve=he.data[O+1],T=he.data[O+2]}const Z=(.299*ke+.587*ve+.114*T)/255;return y!=="none"||se===Re&&Re===Oe?{lines:[j(se,"uint8",q)],luminance:Z}:{lines:[j(se,"uint8",q),j(Re,"uint8",q),j(Oe,"uint8",q)],luminance:Z,colors:[fe[0],fe[1],fe[2]]}},[y]);d.useEffect(()=>{if(!L){me(!1);return}let C=!1;const K=_r(),q=K==="gpu"||K==="auto",J=`${n}::${t}::${o}::${y}`;if(K!=="gpu"){const H=mt(J);if(H){const se=M.current;if(se){(se.width!==H.width||se.height!==H.height)&&(se.width=H.width,se.height=H.height);const Re=se.getContext("2d");Re&&Re.putImageData(H,0,0),D(H.width,H.height),me(!0)}return}}return(async()=>{const[H,se]=await Promise.all([Xe(n),Xe(t)]);if(C||!H||!se)return;const Oe=o.includes("signed")?"signed":"positive",he=y!=="none"?ht(y):null,ke={diffMode:o,colormap:he,cmapMode:Oe};if(q)try{const X=M.current;if(X){const O=yr(H,se,ke,X);if(O){if(C)return;D(O.width,O.height),me(!0);return}}}catch(X){console.warn("[cairn] WebGL 2 diff error:",X)}if(K==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let ve=hr(H,se,o);y!=="none"&&(ve=gt(ve,y,Oe)),xt(J,ve);const T=M.current;if(!T||C)return;(T.width!==ve.width||T.height!==ve.height)&&(T.width=ve.width,T.height=ve.height);const Z=T.getContext("2d");Z&&Z.putImageData(ve,0,0),D(ve.width,ve.height),me(!0)})(),()=>{C=!0}},[n,t,o,L,y,w]);const V=s==="auto"?void 0:s,ce=Ee?{filter:"invert(1)"}:{},pe=b&&(p!=null&&p.enabled)&&ie&&t&&((((le=b.boxes)==null?void 0:le.length)??0)>0||(((ue=b.masks)==null?void 0:ue.length)??0)>0)?l.jsx(Tt,{data:b,settings:p,naturalWidth:ie.w,naturalHeight:ie.h}):void 0,ne=t?L?l.jsxs(l.Fragment,{children:[!Se&&l.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),l.jsx("canvas",{ref:be,className:"w-full h-full object-contain block",style:{display:Se?"block":"none",imageRendering:V,...ce}})]}):F?l.jsxs(l.Fragment,{children:[!Ae&&l.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),l.jsx("canvas",{ref:ge,className:"w-full h-full object-contain block",style:{display:Ae?"block":"none",imageRendering:V,...ce}})]}):l.jsx("img",{ref:we,src:t,alt:u,className:"w-full h-full object-contain block",draggable:!1,style:{filter:Me,imageRendering:V},onLoad:C=>{const K=C.currentTarget;ye({w:K.naturalWidth,h:K.naturalHeight}),w==null||w(K.naturalWidth,K.naturalHeight)}}):l.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return l.jsx(ot,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:E,paneRef:R,wrapperRef:B,zoom:c,pan:h,onViewportChange:x,naturalDims:ie,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${c})`,transformOrigin:"0 0"},viewportPadding:i&&ie?"16px 4px 4px 28px":"4px",header:l.jsx(yn,{id:oe,gamma:xe,offset:Y}),surface:ne,showAxes:i,overlayNode:pe,overlay:{displayElRef:k,sample:z,version:A,hasSource:!!t},notationSeed:m,exportCanvasRef:te,leadingMenus:[Dt(y,C=>_(C))],label:u,showLabelChip:!0,isDraggable:v,onDragStart:g})}function Po(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:s=!1,label:a="",interpolation:i="auto",zoom:f=1,pan:c={x:0,y:0},onViewportChange:h,pixelValueNotation:x="decimal",toolbar:w=!0}=e,u=d.useRef(null),v=d.useRef(null),g=d.useRef(null),[b,p]=d.useState(null),m=d.useRef(null),[E,y]=d.useState(0);d.useEffect(()=>{const P=u.current;if(!P)return;let R;try{R=Mo(t,n,r,o)}catch(k){console.error("[cairn] HDR tone-map error:",k);return}(P.width!==R.width||P.height!==R.height)&&(P.width=R.width,P.height=R.height);const B=P.getContext("2d");B&&(B.putImageData(R,0,0),m.current=R,y(k=>k+1),p(k=>k&&k.w===R.width&&k.h===R.height?k:{w:R.width,h:R.height}))},[t,n,r,o]);const _=d.useCallback((P,R,B)=>{const k=b;if(!k||P<0||R<0||P>=k.w||R>=k.h)return null;const U=t.shape.length===2?1:t.shape[2]??1,S=(R*k.w+P)*U,A=t.data,$=m.current;let G=.5;if($&&$.width===k.w&&$.height===k.h){const te=(R*k.w+P)*4;G=(.299*$.data[te]+.587*$.data[te+1]+.114*$.data[te+2])/255}return U===1?{lines:[j(A[S]??0,"unit",B)],luminance:G}:{lines:[j(A[S]??0,"unit",B),j(A[S+1]??0,"unit",B),j(A[S+2]??0,"unit",B)],luminance:G,colors:[fe[0],fe[1],fe[2]]}},[t,b]),M=i==="auto"?void 0:i;return l.jsx(ot,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:w,paneRef:v,wrapperRef:g,zoom:f,pan:c,onViewportChange:h,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${c.x}px, ${c.y}px) scale(${f})`,transformOrigin:"0 0"},viewportPadding:s&&b?"16px 4px 4px 28px":"4px",surface:l.jsx("canvas",{ref:u,className:"w-full h-full object-contain block",style:{imageRendering:M}}),showAxes:s,overlay:{displayElRef:u,sample:_,version:E,hasSource:!0},notationSeed:x,exportCanvasRef:u,label:a,showLabelChip:!!a})}function It(e){return Pn(e)?l.jsx(Po,{...e}):l.jsx(To,{...e})}const So=["linear","srgb","reinhard","aces"];function Ao(e){return e&&So.includes(e)?e:"srgb"}function Ro(e){const{h:t,w:n,c:r}=Sn(e.shape),o=e.data,s=new Float32Array(n*t*4);for(let a=0;a<n*t;a++){const i=a*r;let f,c,h,x=1;r===1?f=c=h=_e(o[i]):r===3?(f=_e(o[i]),c=_e(o[i+1]),h=_e(o[i+2])):(f=_e(o[i]),c=_e(o[i+1]),h=_e(o[i+2]),x=_e(o[i+3]));const w=a*4;s[w]=f,s[w+1]=c,s[w+2]=h,s[w+3]=x}return{data:s,width:n,height:t,format:"rgba32float"}}function An(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),s=n*o,a=r*o,i=(t.width-s)/2,f=(t.height-a)/2,c=Math.max(e.zoom,1e-6),h=t.width/(c*s),x=t.height/(c*a),w=-i/s-e.pan.x/(c*s),u=-f/a-e.pan.y/(c*a);return{x:w,y:u,w:h,h:x}}function Rn(e,t,n,r){const o=e.w*n,s=e.h*r;return o<=0||s<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/s)}function Co(e){var xe,Y;const t=Pn(e),n=d.useRef(null),r=d.useRef(null),o=d.useRef(null),s=d.useRef(null),a=d.useRef(!1),[i,f]=d.useState(!1),[c,h]=d.useState(!1),[x,w]=d.useState(null),[u,v]=d.useState(0),[g,b]=d.useState(0),[p,m]=d.useState({x:0,y:0,w:1,h:1}),E=d.useRef(null),y=d.useRef(null),[_,M]=d.useState(0),P=e.zoom??1,R=e.pan??{x:0,y:0},B=e.onViewportChange,k=t?"none":e.colormap??"none",[U,S]=d.useState(k);d.useEffect(()=>{S(k)},[k]);const A=t?"none":U,$=Mt();d.useEffect(()=>{const L=n.current;if(!L)return;let I=!1;return Qe().then(F=>{if(I)return;const D=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,z=F.capabilities.hdr&&D&&t;a.current=z,eo(L,{hdr:z}).then(V=>{if(I){bn(V);return}s.current=V,h(!0)}).catch(V=>{I||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",V),f(!0))})}).catch(F=>{I||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",F),f(!0))}),()=>{I=!0,s.current&&(bn(s.current),s.current=null)}},[]),d.useEffect(()=>{const L=r.current;if(!L)return;const I=new ResizeObserver(()=>b(F=>F+1));return I.observe(L),()=>I.disconnect()},[]),d.useEffect(()=>{const L=r.current;if(!L)return;const I=new IntersectionObserver(F=>{const D=F[0];if(!D)return;const z=s.current;z&&(z.setVisible(D.isIntersecting),D.isIntersecting?z.isParked&&(z.restore(),b(V=>V+1)):z.park())},{threshold:0});return I.observe(L),()=>I.disconnect()},[]),d.useEffect(()=>{var F;if(!t||!c)return;const L=e.hdr;E.current=L;const I=Ro(L);(F=s.current)==null||F.setSource(I),w(D=>D&&D.w===I.width&&D.h===I.height?D:{w:I.width,h:I.height}),M(D=>D+1),v(D=>D+1)},[t,c,t?e.hdr:null]),d.useEffect(()=>{if(t||!c)return;const L=e,I=L.imageUrl,F=U;if(!I){y.current=null,w(null),M(z=>z+1);return}let D=!1;return Xe(I).then(z=>{var pe,ne;if(D||!z)return;let V=z;if(F!=="none"){const le=`gpu::${I}::${F}`,ue=mt(le);if(ue)V=ue;else{const C=Wt.has(F)?"positive":"linear";V=gt(z,F,C),xt(le,V)}}y.current=z;const ce={data:V.data,width:V.width,height:V.height,format:"rgba8unorm"};(pe=s.current)==null||pe.setSource(ce),w(le=>le&&le.w===V.width&&le.h===V.height?le:{w:V.width,h:V.height}),(ne=L.onNaturalSize)==null||ne.call(L,V.width,V.height),M(le=>le+1),v(le=>le+1)}),()=>{D=!0}},[t,c,t?null:e.imageUrl,t?null:U]);const G=t?e.exposure??0:0,te=t?e.tonemap:void 0,be=t?e.gamma:void 0,ge=d.useCallback(()=>{const L=s.current;if(!L||!c||!x)return;const I=r.current,F=o.current,D=F?F.getBoundingClientRect():I?I.getBoundingClientRect():{width:x.w,height:x.h},z=An({zoom:P,pan:R},D,x.w,x.h);m(ne=>ne.x===z.x&&ne.y===z.y&&ne.w===z.w&&ne.h===z.h?ne:z),D.width>0&&D.height>0&&L.resize(Math.round(D.width*$),Math.round(D.height*$));const V=Rn(z,D,x.w,x.h)>=Pt?"nearest":"linear",ce=z,pe=t?{exposureEV:G,operator:a.current?"extended":Ao(te),gamma:be,isScalar:!1,hdrOut:a.current,uv:ce,filter:V}:{exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ce,filter:V};try{L.render(pe)||f(!0)}catch(ne){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",ne),f(!0)}},[c,x,P,R.x,R.y,G,te,be,t,$]);d.useEffect(()=>{ge()},[ge,u,g]);const we=d.useCallback((L,I,F)=>{if(t){const ue=E.current,C=x;if(!ue||!C||L<0||I<0||L>=C.w||I>=C.h)return null;const K=ue.shape.length===2?1:ue.shape[2]??1,q=(I*C.w+L)*K,J=ue.data,H=.5;return K===1?{lines:[j(J[q]??0,"unit",F)],luminance:H}:{lines:[j(J[q]??0,"unit",F),j(J[q+1]??0,"unit",F),j(J[q+2]??0,"unit",F)],luminance:H,colors:[fe[0],fe[1],fe[2]]}}const D=y.current;if(!D||L<0||I<0||L>=D.width||I>=D.height)return null;const z=(I*D.width+L)*4,V=D.data[z],ce=D.data[z+1],pe=D.data[z+2],ne=(.299*V+.587*ce+.114*pe)/255;return A!=="none"||V===ce&&ce===pe?{lines:[j(V,"uint8",F)],luminance:ne}:{lines:[j(V,"uint8",F),j(ce,"uint8",F),j(pe,"uint8",F)],luminance:ne,colors:[fe[0],fe[1],fe[2]]}},[t,x,A]),Se=e.showAxes??!1,me=t?e.label??"":e.label,Ae=e.interpolation??"auto",Le=Ae==="auto"?void 0:Ae,ie=t?void 0:e.overlay,ye=t?void 0:e.overlaySettings,Ee=t?!1:e.isDraggable??!1,oe=t?void 0:e.onDragStart;if(i)return t?l.jsx(It,{...e}):l.jsx(It,{...e});const Me=ie&&(ye!=null&&ye.enabled)&&x&&((((xe=ie.boxes)==null?void 0:xe.length)??0)>0||(((Y=ie.masks)==null?void 0:Y.length)??0)>0)?l.jsx(Tt,{data:ie,settings:ye,naturalWidth:x.w,naturalHeight:x.h}):void 0;return l.jsx(ot,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":c},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:P,pan:R,onViewportChange:B,naturalDims:x,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Se&&x?"16px 4px 4px 28px":0,surface:l.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Le},"data-gpu-image-canvas":!0}),showAxes:Se,overlayNode:Me,overlay:{displayElRef:n,sample:we,version:_,hasSource:!0,sourceWindow:p},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ge,leadingMenus:t?void 0:[Dt(A,L=>S(L))],label:me,showLabelChip:!!me,isDraggable:Ee,onDragStart:oe})}const st=new Map;function Ne(e){if(st.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);st.set(e.id,e)}function He(e){return st.get(e)}function Lo(){return Array.from(st.values())}function Cn(e,t){return{...e.params??{},...t??{}}}const ko={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},Do={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Io={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Bo={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Uo={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},Oo={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Ln=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];No(Ln);const Bt=[1.052156925,1,.91835767],Go=.7;function No(e){const[t,n,r]=e[0],[o,s,a]=e[1],[i,f,c]=e[2],h=s*c-a*f,x=-(o*c-a*i),w=o*f-s*i,v=1/(t*h+n*x+r*w);return[[h*v,-(n*c-r*f)*v,(n*a-r*s)*v],[x*v,(t*c-r*i)*v,-(t*a-r*o)*v],[w*v,-(t*f-n*i)*v,(t*s-n*o)*v]]}function Fo(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Ut=6/29;function Ot(e){return e>Ut**3?Math.cbrt(e):e/(3*Ut*Ut)+4/29}function kn(e,t,n){const[r,o,s]=Fo(Ln,e,t,n),a=Ot(r*Bt[0]),i=Ot(o*Bt[1]),f=Ot(s*Bt[2]),c=116*i-16,h=500*(a-i),x=200*(i-f);return[c,.01*c*h,.01*c*x]}function zo(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Vo(){const e=kn(0,1,0),t=kn(0,0,1);return Math.pow(zo(e,t),Go)}const Dn=Vo(),$o=.082;function In(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],s=Math.max(...n,...o),a=Math.ceil(3*Math.sqrt(s/(2*Math.PI**2))*e),i=1/e,f=Math.PI**2,c=[0,0,0];for(let h=-a;h<=a;h++)for(let x=-a;x<=a;x++){const w=(x*i)**2+(h*i)**2;for(let u=0;u<3;u++)c[u]+=t[u]*Math.sqrt(Math.PI/n[u])*Math.exp(-f*w/n[u])+r[u]*Math.sqrt(Math.PI/o[u])*Math.exp(-f*w/o[u])}return{r:a,deltaX:i,sums:c}}function Bn(e){const t=.5*$o*e,n=Math.ceil(3*t);let r=0,o=0,s=0;for(let a=-n;a<=n;a++)for(let i=-n;i<=n;i++){const f=Math.exp(-(i*i+a*a)/(2*t*t)),c=-i*f,h=(i*i/(t*t)-1)*f;c>0&&(r+=c),h>0?o+=h:s-=h}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:s}}const Xo=`
${Ge}
${tt}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Wo=`
${Ge}
${tt}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,at=`
${Ge}
${tt}
@group(0) @binding(0) var ycxcz: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_csf0: vec4<f32>; // deltaX, r, sumA, sumRG
@group(0) @binding(8) var<uniform> u_csf1: vec4<f32>; // sumBY, 0, 0, 0

const A1 = vec3<f32>(1.0, 1.0, 34.1);
const B1 = vec3<f32>(0.0047, 0.0053, 0.04);
const A2 = vec3<f32>(0.0, 0.0, 13.5);
const B2 = vec3<f32>(1e-5, 1e-5, 0.025);
const PI = 3.14159265358979;

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dims = vec2<i32>(textureDimensions(ycxcz));
  let px = vec2<i32>(in.position.xy);
  let deltaX = u_csf0.x;
  let r = i32(u_csf0.y);
  let sums = vec3<f32>(u_csf0.z, u_csf0.w, u_csf1.x);
  let pi2 = PI * PI;
  var acc = vec3<f32>(0.0);
  for (var dy = -r; dy <= r; dy = dy + 1) {
    for (var dx = -r; dx <= r; dx = dx + 1) {
      let sx = clamp(px.x + dx, 0, dims.x - 1);
      let sy = clamp(px.y + dy, 0, dims.y - 1);
      let v = textureLoad(ycxcz, vec2<i32>(sx, sy), 0).rgb;
      let z = f32(dx * dx) * deltaX * deltaX + f32(dy * dy) * deltaX * deltaX;
      let w = A1 * sqrt(PI / B1) * exp(-pi2 * z / B1) + A2 * sqrt(PI / B2) * exp(-pi2 * z / B2);
      acc = acc + (w / sums) * v;
    }
  }
  let lin = clamp(flip_ycxcz2linrgb(acc), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(flip_linrgb2huntlab(lin), 1.0);
}
`,Un=`
${Ge}
@group(0) @binding(0) var labA: texture_2d<f32>;
@group(0) @binding(3) var labB: texture_2d<f32>;
@group(0) @binding(6) var ycxczA: texture_2d<f32>;
@group(0) @binding(9) var ycxczB: texture_2d<f32>;
@group(0) @binding(14) var<uniform> u0: vec4<f32>; // cmax, sd, rF, edgeNorm
@group(0) @binding(17) var<uniform> u1: vec4<f32>; // pointPos, pointNeg, 0, 0

const QC = 0.7;
const PC = 0.4;
const PT = 0.95;
const QF = 0.5;

fn hyab(l1: vec3<f32>, l2: vec3<f32>) -> f32 {
  let d = l1 - l2;
  return abs(d.x) + sqrt(d.y * d.y + d.z * d.z);
}

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dims = vec2<i32>(textureDimensions(labA));
  let px = vec2<i32>(in.position.xy);

  // --- color difference (HyAB, redistributed) ---
  let la = textureLoad(labA, px, 0).rgb;
  let lb = textureLoad(labB, px, 0).rgb;
  let cmax = u0.x;
  let pccmax = PC * cmax;
  let power = pow(hyab(la, lb), QC);
  var deltaEc: f32;
  if (power < pccmax) {
    deltaEc = (PT / pccmax) * power;
  } else {
    deltaEc = PT + ((power - pccmax) / (cmax - pccmax)) * (1.0 - PT);
  }

  // --- feature difference (edge/point on unfiltered achromatic channel) ---
  let sd = u0.y;
  let rF = i32(u0.z);
  let edgeNorm = u0.w;
  let pointPos = u1.x;
  let pointNeg = u1.y;
  var exR = 0.0; var eyR = 0.0; var pxR = 0.0; var pyR = 0.0;
  var exT = 0.0; var eyT = 0.0; var pxT = 0.0; var pyT = 0.0;
  for (var dy = -rF; dy <= rF; dy = dy + 1) {
    for (var dx = -rF; dx <= rF; dx = dx + 1) {
      let sx = clamp(px.x + dx, 0, dims.x - 1);
      let sy = clamp(px.y + dy, 0, dims.y - 1);
      let yr = (textureLoad(ycxczA, vec2<i32>(sx, sy), 0).x + 16.0) / 116.0;
      let yt = (textureLoad(ycxczB, vec2<i32>(sx, sy), 0).x + 16.0) / 116.0;
      let fx = f32(dx); let fy = f32(dy);
      let g = exp(-(fx * fx + fy * fy) / (2.0 * sd * sd));
      // edge (1st deriv), pos/neg symmetric -> single norm
      let ex = (-fx * g) / edgeNorm;
      let ey = (-fy * g) / edgeNorm;
      // point (2nd deriv), pos/neg separate norm
      let pRawX = (fx * fx / (sd * sd) - 1.0) * g;
      let pRawY = (fy * fy / (sd * sd) - 1.0) * g;
      let pxw = select(pRawX / pointNeg, pRawX / pointPos, pRawX > 0.0);
      let pyw = select(pRawY / pointNeg, pRawY / pointPos, pRawY > 0.0);
      exR = exR + ex * yr; eyR = eyR + ey * yr; pxR = pxR + pxw * yr; pyR = pyR + pyw * yr;
      exT = exT + ex * yt; eyT = eyT + ey * yt; pxT = pxT + pxw * yt; pyT = pyT + pyw * yt;
    }
  }
  let edgesR = sqrt(exR * exR + eyR * eyR);
  let edgesT = sqrt(exT * exT + eyT * eyT);
  let pointsR = sqrt(pxR * pxR + pyR * pyR);
  let pointsT = sqrt(pxT * pxT + pyT * pyT);
  let df = max(abs(edgesR - edgesT), abs(pointsR - pointsT));
  let deltaEf = pow((1.0 / sqrt(2.0)) * df, QF);

  let flip = pow(deltaEc, 1.0 - deltaEf);
  return vec4<f32>(flip, flip, flip, 1.0);
}
`;function $e(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function it(e){return[$e(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),$e(2,[e.sums[2],0,0,0])]}function On(e){return[$e(4,[Dn,e.sd,e.r,e.edgeNorm]),$e(5,[e.pointPos,e.pointNeg,0,0])]}function Gn(e,t,n,r,o=""){const s=In(e),a=Bn(e),i=`ycxczA${o}`,f=`ycxczB${o}`,c=`labA${o}`,h=`labB${o}`,x=`flip${o}`;return{passes:[{name:i,shader:t,inputs:[n],output:i},{name:f,shader:t,inputs:[r],output:f},{name:c,shader:at,inputs:[i],output:c,uniforms:()=>it(s)},{name:h,shader:at,inputs:[f],output:h,uniforms:()=>it(s)},{name:x,shader:Un,inputs:[c,h,i,f],output:x,uniforms:()=>On(a)}],flipRef:x}}const Yo={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Gn(t,Xo,"srcA","srcB");return{passes:n,final:r}}},Ho={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Gn(t,Wo,"srcA","srcB");return{passes:n,final:r}}},Nn=`
${Ge}
${tt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_exp: vec4<f32>; // exposure (c_i), 0, 0, 0

const AK0 = 0.6 * 0.6 * 2.51;
const AK1 = 0.6 * 0.03;
const AK2 = 0.0;
const AK3 = 0.6 * 0.6 * 2.43;
const AK4 = 0.6 * 0.59;
const AK5 = 0.14;

fn aces(x: f32) -> f32 {
  let x2 = x * x;
  let nom = AK0 * x2 + AK1 * x + AK2;
  let denom = AK3 * x2 + AK4 * x + AK5;
  let y = nom / denom;
  return clamp(y, 0.0, 1.0);
}

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0).rgb;
  let scale = exp2(u_exp.x);
  let x = scale * s;
  let tm = vec3<f32>(aces(x.r), aces(x.g), aces(x.b));
  return vec4<f32>(flip_linrgb2ycxcz(tm), 1.0);
}
`,Ko=`
${Ge}
@group(0) @binding(0) var labA: texture_2d<f32>;
@group(0) @binding(3) var labB: texture_2d<f32>;
@group(0) @binding(6) var ycxczA: texture_2d<f32>;
@group(0) @binding(9) var ycxczB: texture_2d<f32>;
@group(0) @binding(12) var prevMax: texture_2d<f32>;
@group(0) @binding(17) var<uniform> u0: vec4<f32>; // cmax, sd, rF, edgeNorm
@group(0) @binding(20) var<uniform> u1: vec4<f32>; // pointPos, pointNeg, 0, 0

const QC = 0.7;
const PC = 0.4;
const PT = 0.95;
const QF = 0.5;

fn hyab(l1: vec3<f32>, l2: vec3<f32>) -> f32 {
  let d = l1 - l2;
  return abs(d.x) + sqrt(d.y * d.y + d.z * d.z);
}

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dims = vec2<i32>(textureDimensions(labA));
  let px = vec2<i32>(in.position.xy);

  let la = textureLoad(labA, px, 0).rgb;
  let lb = textureLoad(labB, px, 0).rgb;
  let cmax = u0.x;
  let pccmax = PC * cmax;
  let power = pow(hyab(la, lb), QC);
  var deltaEc: f32;
  if (power < pccmax) {
    deltaEc = (PT / pccmax) * power;
  } else {
    deltaEc = PT + ((power - pccmax) / (cmax - pccmax)) * (1.0 - PT);
  }

  let sd = u0.y;
  let rF = i32(u0.z);
  let edgeNorm = u0.w;
  let pointPos = u1.x;
  let pointNeg = u1.y;
  var exR = 0.0; var eyR = 0.0; var pxR = 0.0; var pyR = 0.0;
  var exT = 0.0; var eyT = 0.0; var pxT = 0.0; var pyT = 0.0;
  for (var dy = -rF; dy <= rF; dy = dy + 1) {
    for (var dx = -rF; dx <= rF; dx = dx + 1) {
      let sx = clamp(px.x + dx, 0, dims.x - 1);
      let sy = clamp(px.y + dy, 0, dims.y - 1);
      let yr = (textureLoad(ycxczA, vec2<i32>(sx, sy), 0).x + 16.0) / 116.0;
      let yt = (textureLoad(ycxczB, vec2<i32>(sx, sy), 0).x + 16.0) / 116.0;
      let fx = f32(dx); let fy = f32(dy);
      let g = exp(-(fx * fx + fy * fy) / (2.0 * sd * sd));
      let ex = (-fx * g) / edgeNorm;
      let ey = (-fy * g) / edgeNorm;
      let pRawX = (fx * fx / (sd * sd) - 1.0) * g;
      let pRawY = (fy * fy / (sd * sd) - 1.0) * g;
      let pxw = select(pRawX / pointNeg, pRawX / pointPos, pRawX > 0.0);
      let pyw = select(pRawY / pointNeg, pRawY / pointPos, pRawY > 0.0);
      exR = exR + ex * yr; eyR = eyR + ey * yr; pxR = pxR + pxw * yr; pyR = pyR + pyw * yr;
      exT = exT + ex * yt; eyT = eyT + ey * yt; pxT = pxT + pxw * yt; pyT = pyT + pyw * yt;
    }
  }
  let edgesR = sqrt(exR * exR + eyR * eyR);
  let edgesT = sqrt(exT * exT + eyT * eyT);
  let pointsR = sqrt(pxR * pxR + pyR * pyR);
  let pointsT = sqrt(pxT * pxT + pyT * pyT);
  let df = max(abs(edgesR - edgesT), abs(pointsR - pointsT));
  let deltaEf = pow((1.0 / sqrt(2.0)) * df, QF);

  let flip = pow(deltaEc, 1.0 - deltaEf);
  let prev = textureLoad(prevMax, px, 0).x;
  let m = max(flip, prev);
  return vec4<f32>(m, m, m, 1.0);
}
`,qo={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),s=(r-n)/Math.max(o-1,1),a=In(t),i=Bn(t),f=[];let c=null;for(let h=0;h<o;h++){const x=n+h*s,w=`_e${h}`,u=`ycxczA${w}`,v=`ycxczB${w}`,g=`labA${w}`,b=`labB${w}`,p=`acc${w}`;f.push({name:u,shader:Nn,inputs:["srcA"],output:u,uniforms:()=>[$e(1,[x,0,0,0])]},{name:v,shader:Nn,inputs:["srcB"],output:v,uniforms:()=>[$e(1,[x,0,0,0])]},{name:g,shader:at,inputs:[u],output:g,uniforms:()=>it(a)},{name:b,shader:at,inputs:[v],output:b,uniforms:()=>it(a)}),c===null?f.push({name:p,shader:Un,inputs:[g,b,u,v],output:p,uniforms:()=>On(i)}):f.push({name:p,shader:Ko,inputs:[g,b,u,v,c],output:p,uniforms:()=>[$e(5,[Dn,i.sd,i.r,i.edgeNorm]),$e(6,[i.pointPos,i.pointNeg,0,0])]}),c=p}return{passes:f,final:c}}};let Fn=!1;function Zo(){Fn||(Fn=!0,Ne(Do),Ne(ko),Ne(Io),Ne(Uo),Ne(Bo),Ne(Oo),Ne(Yo),Ne(qo),Ne(Ho))}Zo();function zn(){const e=[];for(const t of Lo())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function jo(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Vn=new WeakMap;function Gt(e,t,n,r){let o=Vn.get(e);o||(o=new Map,Vn.set(e,o));const s=`${t}::${r}`;let a=o.get(s);return a||(a=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(s,a)),a}function Qo(e){return`
${Ge}
@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
${e}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dimsA = vec2<i32>(textureDimensions(texA));
  let dimsB = vec2<i32>(textureDimensions(texB));
  let px = vec2<i32>(in.position.xy);
  let a = textureLoad(texA, clamp(px, vec2<i32>(0), dimsA - vec2<i32>(1)), 0);
  let b = textureLoad(texB, clamp(px, vec2<i32>(0), dimsB - vec2<i32>(1)), 0);
  return kernel(a, b);
}
`}const ct="rgba16float";function Jo(e,t,n,r,o){var u,v;const s=He(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const a=Math.min(t.width,n.width),i=Math.min(t.height,n.height),f=Cn(s,o);if(s.kind==="pointwise"){const g=e.createTexture(a,i,ct),b=Gt(e,`pw:${s.id}`,Qo(s.source),ct);let p;try{p=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(g,b,p)}finally{(u=p==null?void 0:p.destroy)==null||u.call(p)}return g}const c={width:a,height:i,params:f},h=s.buildPasses(c),x=new Map([["srcA",t],["srcB",n]]),w=[];try{for(const b of h.passes){const p=e.createTexture(a,i,ct);w.push(p),x.set(b.output,p);const m=Gt(e,`mp:${s.id}:${b.name}`,b.shader,ct),E=b.inputs.map((_,M)=>{const P=x.get(_);if(!P)throw new Error(`computeDiff: pass "${b.name}" input "${_}" not produced yet`);return{binding:M,resource:P}});b.uniforms&&E.push(...b.uniforms(c));let y;try{y=e.createBindGroup(m,E),e.renderFullscreen(p,m,y)}finally{(v=y==null?void 0:y.destroy)==null||v.call(y)}}const g=x.get(h.final);if(!g)throw new Error(`computeDiff: final ref "${h.final}" not produced`);for(const b of w)b!==g&&b.destroy();return g}catch(g){for(const b of w)b.destroy();throw g}}const es=8,ts=256*1024*1024;class ns{constructor(t=es,n=ts){Q(this,"map",new Map);Q(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const $n=new WeakMap;function rs(e){let t=$n.get(e);return t||(t=new ns,$n.set(e,t)),t}function os(e,t){const n=Cn(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function ss(e,t,n,r){const o=He(n),s=o?os(o,r):"";return`${e}|${t}|${n}|${s}`}function as(e,t,n,r,o,s,a){const i=He(r);if(!i)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const f=rs(e),c=ss(s,a,r,o),h=f.get(c);if(h)return h;const x=Jo(e,t,n,r,o),w=Math.min(t.width,n.width),u=Math.min(t.height,n.height),v={texture:x,width:w,height:u,displayRange:i.displayRange,bytes:w*u*8};return f.set(c,v),v}async function is(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=hn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}const cs=`
${Ge}
${an}
@group(0) @binding(0) var resultTex: texture_2d<f32>;
@group(0) @binding(3) var lut: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_uv: vec4<f32>;   // uvRect.xy, uvRect.wh
@group(0) @binding(11) var<uniform> u_disp: vec4<f32>; // displayRangeId, cmapModeId, useColormap, filterMode

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(0.999999));
  let uvRect = u_uv;
  let rawSrcUV = uvRect.xy + uv * uvRect.zw;
  if (rawSrcUV.x < 0.0 || rawSrcUV.x >= 1.0 || rawSrcUV.y < 0.0 || rawSrcUV.y >= 1.0) {
    return vec4<f32>(0.0);
  }
  let srcUV = clamp(rawSrcUV, vec2<f32>(0.0), vec2<f32>(0.999999));
  let dims = vec2<f32>(textureDimensions(resultTex));
  let filterLinear = u_disp.w > 0.5;
  var raw: vec4<f32>;
  if (filterLinear) {
    raw = sampleBilinearOf(resultTex, srcUV, dims);
  } else {
    raw = textureLoad(resultTex, vec2<i32>(srcUV * dims), 0);
  }
  let displayRangeId = i32(round(u_disp.x));
  var v = raw.rgb;
  if (displayRangeId == 1 || displayRangeId == 2) {
    v = (v + vec3<f32>(1.0)) * 0.5; // signed / relative -> [0,1] about 0.5
  }
  let disp = clamp(v, vec3<f32>(0.0), vec3<f32>(1.0));
  let cmapModeId = i32(round(u_disp.y));
  let useColormap = u_disp.z > 0.5;
  var outColor: vec3<f32>;
  if (useColormap) {
    let avg = (disp.r + disp.g + disp.b) / 3.0;
    var idx = avg;
    if (cmapModeId == 2) { idx = 0.5 + avg * 0.5; } // "positive"
    outColor = sampleLUT(lut, idx);
  } else {
    outColor = disp;
  }
  return vec4<f32>(outColor, 1.0);
}
`,ls={unit:0,signed:1,relative:2},us={linear:0,signed:1,positive:2};function ds(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function fs(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function ps(e,t,n,r,o){var x;const s=fs(t),a=Gt(e,"diff-display",cs,s),i=ds(e,o.colormap),f=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),c=new Float32Array([ls[r],us[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]);let h;try{h=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:i},{binding:2,resource:{uniform:f}},{binding:3,resource:{uniform:c}}]),e.renderFullscreen(t,a,h)}finally{(x=h==null?void 0:h.destroy)==null||x.call(h),i.destroy()}}const Xn=.6*.6*2.51,hs=.6*.03,gs=0,Wn=.6*.6*2.43,ms=.6*.59,xs=.14;function Yn(e){const t=(hs-ms*e)/(Xn-Wn*e),n=(gs-xs*e)/(Xn-Wn*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const vs=.85,bs=.85,Hn=11920928955078125e-23,Nt=[.2126,.7152,.0722];function ws(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function ys(e,t,n,r=3,o={}){const s=t*n,a=Yn(vs),i=Yn(bs),f=new Float64Array(s);let c=0;for(let m=0;m<s;m++){const[E,y,_]=ws(e,m,r),M=E*Nt[0]+y*Nt[1]+_*Nt[2];f[m]=M,M>c&&(c=M)}const h=Float64Array.from(f).sort(),x=s>>1,w=s%2===1?h[x]:h[x-1],u=Math.max(w,Hn),v=Math.max(c,Hn),g=o.startExposure??Math.log2(a/v),b=o.stopExposure??Math.log2(i/u),p=Math.max(2,Math.ceil(b-g));return{startExposure:g,stopExposure:b,numExposures:p}}const Es={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function _s({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:s,zoom:a,pan:i,onViewportChange:f,processing:c=Es,interpolation:h="auto",label:x="",isDraggable:w=!1,onDragStart:u,overlay:v,overlaySettings:g,pixelValueNotation:b="decimal"}){var Me,xe;const p=d.useRef(null),[m,E]=d.useState(null),[y,_]=d.useState(null),[M,P]=d.useState(b),[R,B]=d.useState(!1),k=d.useRef(null),U=d.useRef(null),S=d.useRef(null),A=d.useRef(null),[$,G]=d.useState(0);d.useEffect(()=>{if(!e){S.current=null,G(L=>L+1);return}let Y=!1;return Xe(e).then(L=>{Y||(S.current=L,G(I=>I+1))}),()=>{Y=!0}},[e]),d.useEffect(()=>{if(!t){A.current=null,G(L=>L+1);return}let Y=!1;return Xe(t).then(L=>{Y||(A.current=L,G(I=>I+1))}),()=>{Y=!0}},[t]);const te=Y=>(L,I,F)=>{const D=Y.current;if(!D||L<0||I<0||L>=D.width||I>=D.height)return null;const z=(I*D.width+L)*4,V=D.data[z],ce=D.data[z+1],pe=D.data[z+2],ne=(.299*V+.587*ce+.114*pe)/255;return V===ce&&ce===pe?{lines:[j(V,"uint8",F)],luminance:ne}:{lines:[j(V,"uint8",F),j(ce,"uint8",F),j(pe,"uint8",F)],luminance:ne,colors:[fe[0],fe[1],fe[2]]}},be=d.useMemo(()=>te(S),[]),ge=d.useMemo(()=>te(A),[]),we=!!v&&!!(g!=null&&g.enabled)&&!!m&&!!e&&((((Me=v.boxes)==null?void 0:Me.length)??0)>0||(((xe=v.masks)==null?void 0:xe.length)??0)>0),{gammaFilterId:Se,filterStr:me,gamma:Ae,offset:Le}=wn(c),ie=`translate(${i.x}px, ${i.y}px) scale(${a})`,ye=h==="auto"?void 0:h,{containerProps:Ee,modifierActive:oe}=rn({containerRef:p,zoom:a,pan:i,onViewportChange:f});return l.jsxs("div",{className:"relative flex flex-col h-full",children:[l.jsx(yn,{id:Se,gamma:Ae,offset:Le}),l.jsxs("div",{ref:p,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...Ee.style},onPointerDown:Ee.onPointerDown,onPointerMove:Ee.onPointerMove,onPointerUp:Ee.onPointerUp,onPointerCancel:Ee.onPointerCancel,children:[l.jsxs("div",{className:"relative w-full h-full",children:[l.jsxs("div",{className:"relative w-full h-full",style:{transform:ie,transformOrigin:"0 0"},children:[l.jsx("img",{ref:k,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:me,imageRendering:ye,...n==="blend"?{opacity:o}:{}},onLoad:Y=>{const L=Y.currentTarget;E({w:L.naturalWidth,h:L.naturalHeight})}}),we&&l.jsx(Tt,{data:v,settings:g,naturalWidth:m.w,naturalHeight:m.h})]}),l.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:l.jsx("div",{className:"w-full h-full",style:{transform:ie,transformOrigin:"0 0"},children:l.jsx("img",{ref:U,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:me,imageRendering:ye,...n==="blend"?{opacity:1-o}:{}},onLoad:Y=>{const L=Y.currentTarget;_({w:L.naturalWidth,h:L.naturalHeight})}})})}),n==="split"&&l.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>s==null?void 0:s(.5),onPointerDown:Y=>{Y.stopPropagation(),Y.preventDefault();const I=Y.currentTarget.parentElement.getBoundingClientRect(),F=z=>{s==null||s(Math.max(0,Math.min(1,(z.clientX-I.left)/I.width)))},D=()=>{window.removeEventListener("pointermove",F),window.removeEventListener("pointerup",D)};window.addEventListener("pointermove",F),window.addEventListener("pointerup",D)},children:l.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?l.jsxs(l.Fragment,{children:[t&&y&&l.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:l.jsx(Ye,{imageElRef:U,naturalWidth:y.w,naturalHeight:y.h,zoom:a,pan:i,sample:ge,notation:M,version:$})}),e&&m&&l.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:l.jsx(Ye,{imageElRef:k,naturalWidth:m.w,naturalHeight:m.h,zoom:a,pan:i,sample:be,notation:M,version:$,onActiveChange:B})})]}):e&&m&&l.jsx(Ye,{imageElRef:k,naturalWidth:m.w,naturalHeight:m.h,zoom:a,pan:i,sample:be,notation:M,version:$,onActiveChange:B}),R&&l.jsx(sn,{notation:M,onChange:P})]}),n==="split"&&l.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),l.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${w&&!oe?" cairn-drag-grip":""}`,draggable:w&&!oe,onDragStart:u,style:{cursor:w&&!oe?"grab":void 0},children:[l.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),x]})]})}function Ms(){return l.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Ts(e){const t=ht(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Ps(e){const{data:t,width:n,height:r,channels:o}=e,s=n*r,a=new Float32Array(s*4),i=f=>Number.isFinite(f)?f:0;for(let f=0;f<s;f++){const c=f*o;let h,x,w,u=1;o===1?h=x=w=i(t[c]):o===3?(h=i(t[c]),x=i(t[c+1]),w=i(t[c+2])):(h=i(t[c]),x=i(t[c+1]),w=i(t[c+2]),u=i(t[c+3]));const v=f*4;a[v]=h,a[v+1]=x,a[v+2]=w,a[v+3]=u}return a}function Ss({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:s,blendAlpha:a,onSplitPositionChange:i,diffSubmode:f,colormap:c="none",diffKernel:h,onDiffKernelChange:x,onCompareModeChange:w,onRequestSide:u,zoom:v,pan:g,onViewportChange:b,interpolation:p="auto",label:m="",pixelValueNotation:E="decimal"}){var ve;const y=d.useRef(null),_=d.useRef(null),M=d.useRef(null),P=d.useRef(null),R=d.useRef(null),[B,k]=d.useState(!1),[U,S]=d.useState(!1),[A,$]=d.useState(null),[G,te]=d.useState(0),[be,ge]=d.useState(0),[we,Se]=d.useState(null),[me,Ae]=d.useState({x:0,y:0,w:1,h:1}),Le=h??f??"absolute",[ie,ye]=d.useState(Le);d.useEffect(()=>{ye(h??f??"absolute")},[h,f]);const Ee=d.useCallback(T=>{ye(T),x==null||x(T)},[x]);d.useEffect(()=>{const T=y.current;if(T)return T.__cairnDiffKernel={current:ie,set:Ee},()=>{T&&delete T.__cairnDiffKernel}},[ie,Ee]);const[oe,Me]=d.useState(o);d.useEffect(()=>{Me(o)},[o]);const xe=d.useCallback(T=>{Me(T),w==null||w(T)},[w]),[Y,L]=d.useState(c);d.useEffect(()=>{L(c)},[c]);const I=d.useMemo(()=>{const O=[{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...u?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...zn().map(N=>({id:N.id,label:N.label}))],value:oe==="diff"?ie:oe==="split"?"slide":"blend",onSelect:N=>{N==="side"?u==null||u():N==="slide"?xe("split"):N==="blend"?xe("blend"):(xe("diff"),Ee(N))}}}];return oe==="diff"&&O.push(Dt(Y,N=>L(N))),O},[oe,ie,Y,Ee,xe,u]),F=d.useRef(null),D=d.useRef(null),z=d.useRef(null),V=d.useRef(null),[ce,pe]=d.useState(0),ne=Mt();d.useEffect(()=>{const T=M.current;if(!T)return;let Z=!1;return Qe().then(X=>{if(!Z)try{if(gn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const O=X.createSurface(T,{hdr:!1});P.current={device:X,surface:O,texA:null,texB:null},S(!0)}catch(O){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",O),k(!0)}}).catch(X=>{Z||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",X),k(!0))}),()=>{var O,N;Z=!0;const X=P.current;X&&((O=X.texA)==null||O.destroy(),(N=X.texB)==null||N.destroy(),P.current=null)}},[]),d.useEffect(()=>{const T=y.current;if(!T)return;const Z=new ResizeObserver(()=>ge(X=>X+1));return Z.observe(T),()=>Z.disconnect()},[]),d.useEffect(()=>{if(!U)return;let T=!1;if(!P.current)return;async function X(O,N){if(N){const de=Ps(N);return{width:N.width,height:N.height,imageData:null,make:ee=>{const Te=ee.createTexture(N.width,N.height,"rgba32float");return Te.write(de),Te}}}if(!O)return null;const ae=await Xe(O);return ae?{width:ae.width,height:ae.height,imageData:ae,make:de=>{const ee=de.createTexture(ae.width,ae.height,"rgba8unorm");return ee.write(ae.data),ee}}:null}return Promise.all([X(e,n),X(t,r)]).then(([O,N])=>{var ee,Te;if(T||!P.current)return;const ae=P.current;F.current=(O==null?void 0:O.imageData)??null,D.current=(N==null?void 0:N.imageData)??null,z.current=n??null,V.current=r??null,(ee=ae.texA)==null||ee.destroy(),(Te=ae.texB)==null||Te.destroy(),ae.texA=null,ae.texB=null;const de=O??N;if(!de){$(null),pe(Ce=>Ce+1);return}ae.texA=(N??de).make(ae.device),ae.texB=(O??de).make(ae.device),$({w:de.width,h:de.height}),pe(Ce=>Ce+1),te(Ce=>Ce+1)}),()=>{T=!0}},[U,e,t,n,r]);const le=n!=null||r!=null,ue=d.useMemo(()=>jo(ie,le),[ie,le]),C=d.useMemo(()=>{if(!le)return null;const T=r??n;return T?ys(T.data,T.width,T.height,T.channels):null},[le,r,n]),K=d.useMemo(()=>{var Z;return(((Z=He(ue))==null?void 0:Z.displayRange)??"unit")==="signed"?"signed":"positive"},[ue]),q=d.useMemo(()=>Y!=="none"?Ts(Y):void 0,[Y]),J=d.useCallback(()=>{const T=P.current;if(!U||!T||!T.surface||!T.texA||!T.texB||!A)return;const Z=y.current,X=Z?Z.getBoundingClientRect():{width:A.w,height:A.h},O=An({zoom:v,pan:g},X,A.w,A.h);Ae(ee=>ee.x===O.x&&ee.y===O.y&&ee.w===O.w&&ee.h===O.h?ee:O);const N=M.current;if(X.width>0&&X.height>0&&N&&T.surface){const ee=Math.max(1,Math.round(X.width*ne)),Te=Math.max(1,Math.round(X.height*ne));(N.width!==ee||N.height!==Te)&&(N.width=ee,N.height=Te,T.surface.configure(ee,Te))}const ae=Rn(O,X,A.w,A.h)>=Pt?"nearest":"linear",de=O;try{if(oe==="diff"){const ee=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Te=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ce=He(ue)?ue:"absolute",Ze=Ce==="hdr-flip"&&C?{ppd:67,startExposure:C.startExposure,stopExposure:C.stopExposure,numExposures:C.numExposures}:void 0,Ke=as(T.device,T.texA,T.texB,Ce,Ze,ee,Te);R.current=Ke,ps(T.device,T.surface,Ke.texture,Ke.displayRange,{uv:de,cmapMode:K,colormap:q,filter:ae})}else{const ee={exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:de,filter:ae,mode:oe,split:s,alpha:a};qr(T.device,T.surface,T.texA,T.texB,ee)}}catch(ee){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ee),k(!0)}},[U,A,v,g.x,g.y,oe,s,a,ie,ue,C,K,q,e,t,n,r,ne]);d.useEffect(()=>{J()},[J,G,be]);const H=t!=null||r!=null;d.useEffect(()=>{const T=P.current;if(!U||!T||!T.texA||!T.texB||!H){Se(null);return}let Z=!1;const X=T.texA,O=T.texB,N=R.current;return(oe==="diff"&&N?is(T.device,N,X,O):hn(T.device,X,O)).then(de=>{Z||Se(de)}),()=>{Z=!0}},[U,G,H,oe,ie]);const se=(T,Z)=>(X,O,N)=>{const ae=Z.current;if(ae){const{data:lt,width:Kn,height:Cs,channels:qn}=ae;if(X<0||O<0||X>=Kn||O>=Cs)return null;const ut=(O*Kn+X)*qn,Zn=.5;return qn===1?{lines:[j(lt[ut]??0,"unit",N)],luminance:Zn}:{lines:[j(lt[ut]??0,"unit",N),j(lt[ut+1]??0,"unit",N),j(lt[ut+2]??0,"unit",N)],luminance:Zn,colors:[fe[0],fe[1],fe[2]]}}const de=T.current;if(!de||X<0||O<0||X>=de.width||O>=de.height)return null;const ee=(O*de.width+X)*4,Te=de.data[ee],Ce=de.data[ee+1],Ze=de.data[ee+2],Ke=(.299*Te+.587*Ce+.114*Ze)/255;return Te===Ce&&Ce===Ze?{lines:[j(Te,"uint8",N)],luminance:Ke}:{lines:[j(Te,"uint8",N),j(Ce,"uint8",N),j(Ze,"uint8",N)],luminance:Ke,colors:[fe[0],fe[1],fe[2]]}},Re=d.useMemo(()=>se(F,z),[]),Oe=d.useMemo(()=>se(D,V),[]),he=p==="auto"?void 0:p;if(B)return n!=null||r!=null?l.jsx(Ms,{}):oe==="diff"?l.jsx(It,{imageUrl:e,baselineUrl:t,diffMode:((ve=He(ue))==null?void 0:ve.kind)==="pointwise"?ue:"absolute",interpolation:p,colormap:Y,showAxes:!1,zoom:v,pan:g,onViewportChange:b,label:m,pixelValueNotation:E}):l.jsx(_s,{imageUrl:e,baselineUrl:t,mode:oe,splitPosition:s,blendAlpha:a,onSplitPositionChange:i,zoom:v,pan:g,onViewportChange:b,interpolation:p,label:m,pixelValueNotation:E});const ke=l.jsxs(l.Fragment,{children:[l.jsx("canvas",{ref:M,className:"w-full h-full block",style:{imageRendering:he},"data-gpu-compare-canvas":!0}),oe==="split"&&l.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${s*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:T=>{T.stopPropagation(),i==null||i(.5)},onPointerDown:T=>{T.stopPropagation(),T.preventDefault();const X=T.currentTarget.parentElement.getBoundingClientRect(),O=ae=>{i==null||i(Math.max(0,Math.min(1,(ae.clientX-X.left)/X.width)))},N=()=>{window.removeEventListener("pointermove",O),window.removeEventListener("pointerup",N)};window.addEventListener("pointermove",O),window.addEventListener("pointerup",N)},children:l.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return l.jsx(ot,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":U},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:y,wrapperRef:_,zoom:v,pan:g,onViewportChange:b,naturalDims:A,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:ke,showAxes:!1,notationSeed:E,exportCanvasRef:M,requestRender:J,leadingMenus:I,label:"",showLabelChip:!1,overlay:{render:({notation:T,setOverlayActive:Z})=>oe==="split"?l.jsxs(l.Fragment,{children:[H&&A&&l.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-s)*100}% 0 0)`},children:l.jsx(Ye,{imageElRef:M,naturalWidth:A.w,naturalHeight:A.h,zoom:v,pan:g,sourceWindow:me,sample:Oe,notation:T,version:ce})}),H&&A&&l.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${s*100}%)`},children:l.jsx(Ye,{imageElRef:M,naturalWidth:A.w,naturalHeight:A.h,zoom:v,pan:g,sourceWindow:me,sample:Re,notation:T,version:ce,onActiveChange:Z})})]}):A&&l.jsx(Ye,{imageElRef:M,naturalWidth:A.w,naturalHeight:A.h,zoom:v,pan:g,sourceWindow:me,sample:Re,notation:T,version:ce,onActiveChange:Z})},extraChips:l.jsxs(l.Fragment,{children:[oe==="split"&&l.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),m?l.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:m}):null,we&&l.jsxs("span",{className:"absolute right-1.5 top-9 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono","data-gpu-compare-metrics":!0,children:["MSE ",we.mse.toExponential(2)," · PSNR ",Number.isFinite(we.psnr)?we.psnr.toFixed(1):"∞"," dB · MAE"," ",we.mae.toExponential(2)]})]})})}const As="cairn-plot:gpu-image-ready";async function Rs(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Qe(),window.__cairnPlotGpuImagePane=Co,window.__cairnPlotGpuComparePane=Ss,window.__cairnPlotDiffMenuModes=zn(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(As))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}Rs()})(__cairnPlotJsxRuntime,__cairnPlotReact);
