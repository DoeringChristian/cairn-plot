var Hs=Object.defineProperty;var qs=(i,c,ze)=>c in i?Hs(i,c,{enumerable:!0,configurable:!0,writable:!0,value:ze}):i[c]=ze;var oe=(i,c,ze)=>qs(i,typeof c!="symbol"?c+"":c,ze);(function(i,c){"use strict";const ze=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function $t(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:ze}),{hdr:!1,format:n}}function or(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:ze}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:ze}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return $t(e,t)}}}const sr=`
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
`;function ht(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Xt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function ar(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const ir={texture:0,sampler:1,uniform:2};function gt(e,t){return e*3+ir[t]}const cr={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function lr(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const l=cr[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Wt{constructor(t,n,r,o){oe(this,"width");oe(this,"height");oe(this,"format");oe(this,"gpuTexture");oe(this,"device");oe(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:ht(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Xt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Yt{constructor(t){oe(this,"_s");oe(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class ur{constructor(t,n,r,o,a){oe(this,"_p");oe(this,"gpuPipeline");oe(this,"bindings");oe(this,"bindGroupLayout");oe(this,"variants");oe(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function dr(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class fr{constructor(t){oe(this,"_c");oe(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class pr{constructor(t,n){oe(this,"_b");oe(this,"gpuBindGroup");oe(this,"ownedBuffers");oe(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class hr{constructor(t,n,r,o){oe(this,"canvas");oe(this,"hdr");oe(this,"format");oe(this,"context");oe(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function tt(e){return"canvas"in e}async function gr(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(f){return tt(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function s(f){if(tt(f))return{width:f.canvas.width,height:f.canvas.height};const m=f;return{width:m.width,height:m.height}}let l=!1;const u=256;let d=null,g=null;function x(){if(!d||!g){const f=t.createShaderModule({code:sr});g=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const m=t.createPipelineLayout({bindGroupLayouts:[g]});d=t.createComputePipeline({layout:m,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:d,layout:g}}return{backend:"webgpu",capabilities:n,createTexture(f,m,p){return new Wt(t,f,m,p)},createSampler(f){const m=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",p=t.createSampler({magFilter:m,minFilter:m,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Yt(p)},createRenderPipeline(f){const m=t.createShaderModule({code:f.shaderWGSL}),p=lr(f.shaderWGSL),b=ht(f.targetFormat),h=dr(t,p),w=t.createPipelineLayout({bindGroupLayouts:[h]}),T=_=>t.createRenderPipeline({layout:w,vertex:{module:m,entryPoint:"vs_main"},fragment:{module:m,entryPoint:"fs_main",targets:[{format:_}]},primitive:{topology:"triangle-list"}}),E=T(b);return new ur(E,p,h,b,T)},createComputePipeline(f){const m=t.createShaderModule({code:f.shaderWGSL}),p=t.createComputePipeline({layout:"auto",compute:{module:m,entryPoint:"cs_main"}});return new fr(p)},createBindGroup(f,m){const p=f,b=new Map,h=[];for(const[T,E]of p.bindings)if(E.kind==="uniform"){const _=t.createBuffer({size:E.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});h.push(_),b.set(T,{binding:T,resource:{buffer:_}})}else E.kind==="sampler"&&b.set(T,{binding:T,resource:o()});for(const T of m){const E=T.resource;if(E instanceof Wt){const _=gt(T.binding,"texture");p.bindings.has(_)&&b.set(_,{binding:_,resource:E.gpuTexture.createView()})}else if(E instanceof Yt){const _=gt(T.binding,"sampler");p.bindings.has(_)&&b.set(_,{binding:_,resource:E.gpuSampler})}else{const _=gt(T.binding,"uniform"),M=p.bindings.get(_);if(M&&M.kind==="uniform"){const A=E.uniform,L=t.createBuffer({size:Math.max(M.sizeBytes,A.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(L,0,A.buffer,A.byteOffset,A.byteLength),h.push(L),b.set(_,{binding:_,resource:{buffer:L}})}}}const w=t.createBindGroup({layout:p.bindGroupLayout,entries:Array.from(b.values())});return new pr(w,h)},createSurface(f,m){const p=f.getContext("webgpu");if(!p)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const b=m.hdr&&n.hdr,h=()=>b?or(p,t):$t(p,t),w=h();return new hr(f,p,w,h)},renderFullscreen(f,m,p){const b=m,h=p,w=a(f),{width:T,height:E}=s(f),_=tt(f)?f.format:ht(f.format),M=b.pipelineFor(_),A=t.createCommandEncoder(),L=A.beginRenderPass({colorAttachments:[{view:w,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});L.setPipeline(M),L.setBindGroup(0,h.gpuBindGroup),L.setViewport(0,0,T,E,0,1),L.draw(3),L.end(),t.queue.submit([A.finish()])},async readback(f){const m=tt(f),{width:p,height:b}=s(f),h=m?f.hdr?"rgba16float":"rgba8unorm":f.format,w=m&&f.format==="bgra8unorm",T=m?f.getCurrentGPUTexture():f.gpuTexture,E=Xt(h),_=p*E,M=256,A=Math.ceil(_/M)*M,L=A*b,V=t.createBuffer({size:L,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),B=t.createCommandEncoder();B.copyTextureToBuffer({texture:T},{buffer:V,bytesPerRow:A,rowsPerImage:b},{width:p,height:b,depthOrArrayLayers:1}),t.queue.submit([B.finish()]),await V.mapAsync(GPUMapMode.READ);const R=new Uint8Array(V.getMappedRange()),P=new Uint8Array(_*b);for(let y=0;y<b;y++){const C=y*A,D=y*_;P.set(R.subarray(C,C+_),D)}if(V.unmap(),V.destroy(),h==="rgba8unorm"){if(w)for(let y=0;y<P.length;y+=4){const C=P[y],D=P[y+2];P[y]=D,P[y+2]=C}return P}if(h==="rgba16float"){const y=new Uint16Array(P.buffer,P.byteOffset,P.byteLength/2),C=new Float32Array(y.length);for(let D=0;D<y.length;D++)C[D]=ar(y[D]);return C}return new Float32Array(P.buffer,P.byteOffset,P.byteLength/4)},async reduceDiffSumSquaredAbs(f,m,p,b){const h=f,w=m,T=Math.max(0,p*b),E=Math.max(1,Math.ceil(T/u)),{pipeline:_,layout:M}=x(),A=E*2*4,L=t.createBuffer({size:A,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),V=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(V,0,new Uint32Array([Math.max(1,p),Math.max(1,b),T,0]));const B=t.createBindGroup({layout:M,entries:[{binding:0,resource:h.gpuTexture.createView()},{binding:1,resource:w.gpuTexture.createView()},{binding:2,resource:{buffer:L}},{binding:3,resource:{buffer:V}}]}),R=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),P=t.createCommandEncoder(),y=P.beginComputePass();y.setPipeline(_),y.setBindGroup(0,B),y.dispatchWorkgroups(E),y.end(),P.copyBufferToBuffer(L,0,R,0,A),t.queue.submit([P.finish()]),await R.mapAsync(GPUMapMode.READ);const D=new Float32Array(R.getMappedRange()).slice();R.unmap(),R.destroy(),L.destroy(),V.destroy();let H=0,ue=0;for(let te=0;te<E;te++)H+=D[te*2],ue+=D[te*2+1];return{sumSq:H,sumAbs:ue}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let mt=null;async function mr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return gr()}function nt(){return mt||(mt=mr()),mt}function xr(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function vr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),l=o-a,[u,d,g]=xr(e[a],e[s],l);t[n*3]=Math.round(u),t[n*3+1]=Math.round(d),t[n*3+2]=Math.round(g)}return t}const Kt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},xt=new Set(["red-green","red-blue"]),Ht=new Map;function vt(e){let t=Ht.get(e);if(!t){const n=Kt[e]??Kt.viridis;t=vr(n),Ht.set(e,t)}return t}function bt(e,t,n="linear"){const r=vt(t),o=new ImageData(e.width,e.height),a=e.data,s=o.data;for(let l=0;l<a.length;l+=4){const u=(a[l]+a[l+1]+a[l+2])/3;let d;n==="positive"?d=Math.round(128+u/255*127):d=Math.round(u),d=Math.max(0,Math.min(255,d)),s[l]=r[d*3],s[l+1]=r[d*3+1],s[l+2]=r[d*3+2],s[l+3]=a[l+3]}return o}function qt(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Zt=qt(50);function wt(e){return Zt.get(e)}function yt(e,t){Zt.set(e,t)}const jt=qt(100);function br(e){return jt.get(e)}function wr(e,t){jt.set(e,t)}function yr(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const u=(s*e.width+l)*4,d=(s*t.width+l)*4,g=(s*r+l)*4;for(let x=0;x<3;x++){const v=e.data[u+x],f=t.data[d+x],m=v-f,p=Math.abs(m),b=Math.max(v,1);let h;switch(n){case"signed":h=(m+255)/2;break;case"absolute":h=p;break;case"squared":h=m*m/255;break;case"relative_signed":h=(m/b+1)*127.5;break;case"relative_absolute":h=p/b*255;break;case"relative_squared":h=m*m/(b*b)*255;break}a.data[g+x]=Math.min(255,Math.max(0,Math.round(h)))}a.data[g+3]=255}return a}async function He(e){const t=br(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);wr(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Er={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},_r={linear:0,signed:1,positive:2},Mr=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Tr=`#version 300 es
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
}`;let qe=null,X=null,Re=null,rt=null;function Pr(){if(X)return X;try{if(typeof OffscreenCanvas<"u"?qe=new OffscreenCanvas(1,1):qe=document.createElement("canvas"),X=qe.getContext("webgl2",{preserveDrawingBuffer:!0}),!X)return console.warn("[cairn] WebGL 2 not available"),null;const e=X.createShader(X.VERTEX_SHADER);if(X.shaderSource(e,Mr),X.compileShader(e),!X.getShaderParameter(e,X.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",X.getShaderInfoLog(e)),null;const t=X.createShader(X.FRAGMENT_SHADER);if(X.shaderSource(t,Tr),X.compileShader(t),!X.getShaderParameter(t,X.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",X.getShaderInfoLog(t)),null;if(Re=X.createProgram(),X.attachShader(Re,e),X.attachShader(Re,t),X.linkProgram(Re),!X.getProgramParameter(Re,X.LINK_STATUS))return console.error("[cairn] WebGL program link:",X.getProgramInfoLog(Re)),null;rt=X.createVertexArray(),X.bindVertexArray(rt);const n=X.createBuffer();X.bindBuffer(X.ARRAY_BUFFER,n),X.bufferData(X.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),X.STATIC_DRAW);const r=X.getAttribLocation(Re,"a_pos");return X.enableVertexAttribArray(r),X.vertexAttribPointer(r,2,X.FLOAT,!1,0,0),X.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),X}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Qt(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Sr(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Ar(e,t,n,r){const o=Pr();if(!o||!Re||!rt||!qe)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);qe.width=a,qe.height=s,o.viewport(0,0,a,s);const l=Qt(o,e,0),u=Qt(o,t,1);let d=null;n.colormap?d=Sr(o,n.colormap,2):(d=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,d),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Re),o.uniform1i(o.getUniformLocation(Re,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Re,"u_other"),1),o.uniform1i(o.getUniformLocation(Re,"u_lut"),2),o.uniform1i(o.getUniformLocation(Re,"u_diff_mode"),Er[n.diffMode]),o.uniform1i(o.getUniformLocation(Re,"u_cmap_mode"),_r[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Re,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(rt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const g=r.getContext("2d");return g&&(g.save(),g.scale(1,-1),g.drawImage(qe,0,0,a,s,0,-s,a,s),g.restore()),o.deleteTexture(l),o.deleteTexture(u),o.deleteTexture(d),{width:a,height:s}}const Cr="cairn:render-mode";function kr(){try{const e=localStorage.getItem(Cr);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Oe=e=>e<0?0:e>1?1:e,Et=e=>{const t=e<0?0:e;return t/(1+t)},_t=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Oe(n/r)},Jt={linear:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],srgb:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],reinhard:([e,t,n])=>[Et(e),Et(t),Et(n)],aces:([e,t,n])=>[_t(e),_t(t),_t(n)],extended:([e,t,n])=>[e,t,n]},Rr="srgb";function Lr(e){return e&&Jt[e]||Jt[Rr]}function Mt(e,t,n){return e*2**t+n}function Dr(e){const t=Oe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Tt(e,t){return typeof t=="number"&&t>0?Oe(Math.pow(Oe(e),1/t)):Dr(e)}const Be=new Uint32Array(512),Ne=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Be[e]=0,Be[e|256]=32768,Ne[e]=24,Ne[e|256]=24):t<-14?(Be[e]=1024>>-t-14,Be[e|256]=1024>>-t-14|32768,Ne[e]=-t-1,Ne[e|256]=-t-1):t<=15?(Be[e]=t+15<<10,Be[e|256]=t+15<<10|32768,Ne[e]=13,Ne[e|256]=13):t<128?(Be[e]=31744,Be[e|256]=64512,Ne[e]=24,Ne[e|256]=24):(Be[e]=31744,Be[e|256]=64512,Ne[e]=13,Ne[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Je=Uint8Array,en=Uint16Array,Ir=Int32Array,Or=new Je([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Br=new Je([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),tn=function(e,t){for(var n=new en(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Ir(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},nn=tn(Or,2),Nr=nn.b,Ur=nn.r;Nr[28]=258,Ur[258]=28,tn(Br,0);for(var Gr=new en(32768),le=0;le<32768;++le){var $e=(le&43690)>>1|(le&21845)<<1;$e=($e&52428)>>2|($e&13107)<<2,$e=($e&61680)>>4|($e&3855)<<4,Gr[le]=(($e&65280)>>8|($e&255)<<8)>>1}for(var ot=new Je(288),le=0;le<144;++le)ot[le]=8;for(var le=144;le<256;++le)ot[le]=9;for(var le=256;le<280;++le)ot[le]=7;for(var le=280;le<288;++le)ot[le]=8;for(var Fr=new Je(32),le=0;le<32;++le)Fr[le]=5;var Vr=new Je(0),zr=typeof TextDecoder<"u"&&new TextDecoder,$r=0;try{zr.decode(Vr,{stream:!0}),$r=1}catch{}const rn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Pt(e){const t=rn.length;return rn[(e%t+t)%t]}function Xr(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),l=c.useRef(null),u=c.useCallback((d,g)=>{o(x=>x.w===d&&x.h===g?x:{w:d,h:g})},[]);return c.useLayoutEffect(()=>{const d=n.current;if(!d||d===l.current)return;const g=d.getBoundingClientRect();(g.width>0||g.height>0)&&(l.current=d,u(g.width,g.height))}),c.useEffect(()=>{var x;const d=n.current;if(d===s.current||((x=a.current)==null||x.disconnect(),a.current=null,s.current=d,!d))return;const g=new ResizeObserver(v=>{for(const f of v)u(f.contentRect.width,f.contentRect.height)});a.current=g,g.observe(d)}),c.useEffect(()=>()=>{var d;return(d=a.current)==null?void 0:d.disconnect()},[]),{ref:n,size:r}}function Wr(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Yr=.25,St=64;function on(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return St;const o=Math.min(n/e,r/t);return o<=0?St:Math.max(Math.max(n,r)/o,8)}function sn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=Yr,maxZoom:s=St,naturalWidth:l,naturalHeight:u}=e,d=Wr(),g=c.useRef(d);g.current=d;const x=c.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const v=c.useRef(o);v.current=o,c.useEffect(()=>{const w=t.current;if(!w||!o)return;const T=E=>{var C;if(!g.current)return;E.preventDefault(),E.stopPropagation();const _=E.deltaY<0?1.1:1/1.1,M=x.current,A=w.getBoundingClientRect(),L=l&&u?on(l,u,A.width,A.height):s,V=Math.max(a,Math.min(L,M.zoom*_));if(M.zoom===V)return;const B=E.clientX-A.left,R=E.clientY-A.top,P=B-(B-M.pan.x)/M.zoom*V,y=R-(R-M.pan.y)/M.zoom*V;(C=v.current)==null||C.call(v,{zoom:V,pan:{x:P,y}})};return w.addEventListener("wheel",T,{passive:!1}),()=>w.removeEventListener("wheel",T)},[t,!!o,a,s,l,u]);const f=c.useRef(null),m=c.useCallback(w=>{!g.current||!v.current||(w.currentTarget.setPointerCapture(w.pointerId),f.current={pointerId:w.pointerId,startX:w.clientX,startY:w.clientY,panX:x.current.pan.x,panY:x.current.pan.y})},[]),p=c.useCallback(w=>{var M;const T=f.current;if(!T||T.pointerId!==w.pointerId)return;const E=w.clientX-T.startX,_=w.clientY-T.startY;(M=v.current)==null||M.call(v,{zoom:x.current.zoom,pan:{x:T.panX+E,y:T.panY+_}})},[]),b=c.useCallback(w=>{const T=f.current;if(!(!T||T.pointerId!==w.pointerId)){try{w.currentTarget.releasePointerCapture(w.pointerId)}catch{}f.current=null}},[]),h=d&&!!o;return{containerProps:{onPointerDown:m,onPointerMove:p,onPointerUp:b,onPointerCancel:b,style:{cursor:h?"move":void 0,touchAction:h?"none":void 0}},modifierActive:d}}function At(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Kr(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function an(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Ct({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=Xr(),s=c.useRef(null),l=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),u=c.useMemo(()=>{const p=a.w,b=a.h;if(p<=0||b<=0||n<=0||r<=0)return null;const h=Math.min(p/n,b/r),w=n*h,T=r*h;return{left:(p-w)/2,top:(b-T)/2,width:w,height:T}},[a.w,a.h,n,r]),d=e.masks,g=t.showMasks&&!!d&&d.length>0,x=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!g||!d)return;const p=s.current;if(!p)return;(p.width!==n||p.height!==r)&&(p.width=n,p.height=r);const b=p.getContext("2d");if(!b)return;b.clearRect(0,0,p.width,p.height);let h=!1;const w=b.createImageData(n,r),T=w.data;let E=d.length,_=!1;const M=()=>{h||_&&b.putImageData(w,0,0)},A=document.createElement("canvas");A.width=n,A.height=r;const L=A.getContext("2d",{willReadFrequently:!0});for(const V of d){const B=new Image;B.onload=()=>{if(!h){if(L){L.clearRect(0,0,n,r),L.drawImage(B,0,0,n,r);const R=L.getImageData(0,0,n,r).data;for(let P=0;P<n*r;P++){const y=R[P*4];if(y===0||l.has(y))continue;const[C,D,H]=Kr(Pt(y));T[P*4]=C,T[P*4+1]=D,T[P*4+2]=H,T[P*4+3]=255,_=!0}}E-=1,E===0&&M()}},B.onerror=()=>{E-=1,E===0&&M()},B.src=`data:image/png;base64,${V.png_b64}`}return()=>{h=!0}},[g,d,n,r,x]),!u)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const v=e.boxes??[],f=t.showBoxes&&v.length>0,m=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[g&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),f&&i.jsx("svg",{className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:v.map((p,b)=>{if(!an(p,t,l))return null;const h=p.domain==="pixel"?1:n,w=p.domain==="pixel"?1:r,T=p.position.minX*h,E=p.position.minY*w,_=(p.position.maxX-p.position.minX)*h,M=(p.position.maxY-p.position.minY)*w;return i.jsx("rect",{x:T,y:E,width:_,height:M,fill:"none",stroke:Pt(p.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),f&&i.jsx("div",{className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height},children:v.map((p,b)=>{if(!an(p,t,l))return null;const h=p.domain==="pixel"?1/n:1,w=p.domain==="pixel"?1/r:1,T=p.position.minX*h*100,E=p.position.minY*w*100,_=p.label??m[String(p.class_id)]??`#${p.class_id}`,M=p.score!=null?` ${(p.score*100).toFixed(0)}%`:"";return!_&&!M?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${T}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Pt(p.class_id)},children:i.jsxs("span",{className:"mono",children:[_,M]})},b)})})]})}const kt=30,fe=["#ff5a5a","#39d353","#5b9bff"];function Rt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function Q(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Rt(e/255):Rt(n==="int"?e*255:e)}const Hr={x:0,y:0,w:1,h:1};function Ze({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:l=0,onActiveChange:u,sourceWindow:d=Hr}){const g=c.useRef(null),x=c.useRef(!1),v=At(),f=c.useRef(u);f.current=u;const m=c.useCallback(b=>{var h;b!==x.current&&(x.current=b,(h=f.current)==null||h.call(f,b))},[]),p=c.useCallback(()=>{var q;const b=g.current,h=e.current;if(!b)return;const w=window.devicePixelRatio||1,T=b.clientWidth,E=b.clientHeight;if(T===0||E===0)return;b.width!==Math.round(T*w)&&(b.width=Math.round(T*w)),b.height!==Math.round(E*w)&&(b.height=Math.round(E*w));const _=b.getContext("2d");if(!_)return;if(_.setTransform(w,0,0,w,0,0),_.clearRect(0,0,T,E),!h||t<=0||n<=0){m(!1);return}const M=h.getBoundingClientRect(),A=b.getBoundingClientRect();if(M.width===0||M.height===0){m(!1);return}const L=d.x*t,V=d.y*n,B=d.w*t,R=d.h*n;if(B<=0||R<=0){m(!1);return}const P=Math.min(M.width/B,M.height/R);if(P<kt){m(!1);return}const y=B*P,C=R*P,D=M.left+(M.width-y)/2-A.left,H=M.top+(M.height-C)/2-A.top,ue=Math.max(Math.floor(L),Math.floor(L+(0-D)/P)),te=Math.min(Math.ceil(L+B),Math.ceil(L+(T-D)/P)),me=Math.max(Math.floor(V),Math.floor(V+(0-H)/P)),we=Math.min(Math.ceil(V+R),Math.ceil(V+(E-H)/P));if(te<=ue||we<=me){m(!1);return}m(!0);const _e=D+(0-L)*P,Ce=H+(0-V)*P,Le=D+(t-L)*P,pe=H+(n-V)*P;_.save(),_.beginPath(),_.rect(_e,Ce,Le-_e,pe-Ce),_.clip(),_.textAlign="center",_.textBaseline="middle",_.lineJoin="round";const Se=P*.14,xe=P-Se*2;for(let ve=me;ve<we;ve++)for(let be=ue;be<te;be++){if(be<0||ve<0||be>=t||ve>=n)continue;const W=a(be,ve,s);if(!W||W.lines.length===0)continue;const J=W.lines.length;let ge=1;for(const k of W.lines)k.length>ge&&(ge=k.length);const Me=xe/(J*1.15),he=xe/(ge*.62)||Me,F=Math.min(Me,he,24);if(F<6)continue;const U=D+(be-L+.5)*P,$=H+(ve-V+.5)*P,G=F*1.15,Y=W.luminance<=.55,j=Y?"#ffffff":"#000000";_.font=`${F}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.lineWidth=Math.max(1.4,F*.16),_.strokeStyle=Y?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let ye=$-J*G/2+G/2;for(let k=0;k<W.lines.length;k++){const N=W.lines[k];_.strokeText(N,U,ye),_.fillStyle=((q=W.colors)==null?void 0:q[k])??j,_.fillText(N,U,ye),ye+=G}}_.restore()},[e,t,n,a,s,m,d]);return c.useEffect(()=>{p()},[p,r,o.x,o.y,l,s,d,v]),c.useEffect(()=>{const b=g.current;if(!b)return;const h=new ResizeObserver(()=>p());return h.observe(b),()=>h.disconnect()},[p]),i.jsx("canvas",{ref:g,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function cn({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const qr=`
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
// Logical binding 6 (uniform f32: display OFFSET, TEV convention — added after
// exposure, before colormap/tonemap/encode) -> native binding 6*3+2 = 20.
// Defaults to 0 (the bind-group builder zero-fills any binding the caller omits),
// so an image with no offset renders bit-for-bit as before.
@group(0) @binding(20) var<uniform> u_bind6: f32;

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
  let offset = u_bind6;

  // 1) exposure + offset (TEV convention), in scene-linear space:
  //    v * 2^EV + offset. Offset is additive AFTER exposure, BEFORE the
  //    colormap / tone-map / output-encode stages below.
  var rgb = sampled.rgb * exp2(exposureEV) + vec3<f32>(offset);

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
`,Ue=`
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
`,ln=`
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
`,Zr=`
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

// Per-side exposure+offset -> [scalar LUT] -> operator -> encode. The lut is
// only read when isScalar. offset is the TEV display offset, added AFTER
// exposure and BEFORE the colormap/tonemap/encode stages (default 0 = identity).
fn processSide(lut: texture_2d<f32>, sampled: vec4<f32>, exposureEV: f32, offset: f32, operatorId: i32, gamma: f32, isScalar: bool, hdrOut: bool) -> vec3<f32> {
  var rgb = sampled.rgb * exp2(exposureEV) + vec3<f32>(offset);
  if (isScalar) { rgb = sampleLUT(lut, rgb.x); }
  rgb = applyOperator(rgb, operatorId);
  if (hdrOut) { return rgb; }
  let hasGamma = gamma > 0.0;
  return vec3<f32>(outputEncodeF(rgb.r, gamma, hasGamma), outputEncodeF(rgb.g, gamma, hasGamma), outputEncodeF(rgb.b, gamma, hasGamma));
}
`,st=`
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
`;function un(e){return`
${Ue}
${ln}
${Zr}

@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(6) var lut: texture_2d<f32>;
@group(0) @binding(11) var<uniform> u_img: vec4<f32>;     // exposureEV, operatorId, gamma, isScalar
@group(0) @binding(14) var<uniform> u_uv: vec4<f32>;      // uvRect.xy, uvRect.wh
@group(0) @binding(17) var<uniform> u_compose: vec4<f32>; // split, alpha, hdrOut, filterMode
@group(0) @binding(20) var<uniform> u_extra: vec4<f32>;   // offset, _, _, _ (TEV display offset; default 0)

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
  let offset = u_extra.x;

  let colorA = processSide(lut, sampledA, exposureEV, offset, operatorId, gamma, isScalar, hdrOut);
  let colorB = processSide(lut, sampledB, exposureEV, offset, operatorId, gamma, isScalar, hdrOut);

  let split = u_compose.x;
  let alpha = u_compose.y;
  let outColor = ${e};
  return vec4<f32>(outColor, 1.0);
}
`}const jr=un("select(colorB, colorA, uv.x < split)"),Qr=un("mix(colorA, colorB, alpha)"),Lt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},dn=new WeakMap;function Jr(e,t){let n=dn.get(e);n||(n=new Map,dn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:qr,targetFormat:t}),n.set(t,r)),r}function fn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function pn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function eo(e,t,n,r){var p;const o=fn(t),a=Jr(e,o),s=pn(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,u=Lt[r.operator]??Lt.srgb,d=new Float32Array([r.exposureEV,u,l,r.isScalar?1:0]),g=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),v=new Float32Array([r.filter==="nearest"?0:1]),f=new Float32Array([r.offset??0]);let m;try{m=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:d}},{binding:3,resource:{uniform:g}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:v}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,a,m)}finally{(p=m==null?void 0:m.destroy)==null||p.call(m),s.destroy()}}const hn=new WeakMap;function to(e,t,n){let r=hn.get(e);r||(r=new Map,hn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?jr:Qr,targetFormat:n}),r.set(o,a)),a}function no(e,t,n,r,o){var p;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=fn(t),s=to(e,o.mode,a),l=pn(e,void 0),u=o.gamma,d=Lt[o.operator],g=new Float32Array([o.exposureEV,d,u,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),v=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),f=new Float32Array([o.offset??0,0,0,0]);let m;try{m=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:g}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:v}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,s,m)}finally{(p=m==null?void 0:m.destroy)==null||p.call(m),l.destroy()}}function gn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function mn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:v,sumAbs:f}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return gn(v,f,a)}const s=await e.readback(t),l=await e.readback(n),u=s instanceof Uint8Array,d=l instanceof Uint8Array;let g=0,x=0;for(let v=0;v<o;v++)for(let f=0;f<r;f++){const m=(v*t.width+f)*4,p=(v*n.width+f)*4;for(let b=0;b<3;b++){const h=(s[m+b]??0)/(u?255:1),w=(l[p+b]??0)/(d?255:1),T=h-w;g+=T*T,x+=Math.abs(T)}}return gn(g,x,a)}function xn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const ro=12,Xe=[];function vn(e){const t=Xe.indexOf(e);t!==-1&&Xe.splice(t,1),Xe.push(e)}function oo(e){const t=Xe.indexOf(e);t!==-1&&Xe.splice(t,1)}function at(e){e.parked||(oo(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function bn(e){for(;Xe.length>ro;){const t=Xe.find(n=>n!==e&&!n.visible)??Xe.find(n=>n!==e);if(!t)break;at(t)}}function wn(e){var o,a;if(e.disposed)return;if(xn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){vn(e),bn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,vn(e),bn(e)}function so(e,t){if(e.disposed||!e.source)return!0;try{return wn(e),!e.surface||!e.srcTexture?!1:(eo(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,at(e),!1}}function ao(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return so(e,t)},park(){e.disposed||at(e)},restore(){e.disposed||!e.source||wn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(at(e),e.source=null,e.disposed=!0)}}}async function io(e,t){const n=await nt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return ao(r)}function yn(e){e.dispose()}function co(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function En(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:l,flipSign:u}=e,d=c.useMemo(()=>co(e,n),[n,r,o,s,u]);return{gammaFilterId:n,filterStr:d,gamma:a,offset:l}}function _n({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Mn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function lo({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Mn(e),a=Mn(t),s=[];for(let w=0;w<=e;w+=o)s.push(w);const l=[];for(let w=0;w<=t;w+=a)l.push(w);const u=1/n,d=8*u,g=-12*u,x=-2*u,v=r==null?void 0:r.current;let f=0,m=0,p=0,b=0;if(v){const w=v.clientWidth,T=v.clientHeight,E=w/e,_=T/t,M=Math.min(E,_);p=e*M,b=t*M,f=(w-p)/2,m=(T-b)/2}const h=v&&p>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:h?m:0,transform:`translateY(${g}px)`,fontSize:d},children:s.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",left:h?f+w/e*p:`${w/e*100}%`,transform:"translateX(-50%)"},children:w},w))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:h?f:0,transform:`translateX(${x}px)`,fontSize:d},children:l.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",top:h?m+w/t*b:`${w/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*u}px`},children:w},w))})]})}function uo({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const fo=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Tn(e,t){const n=getComputedStyle(e),r=fo.map(u=>`${u}:${n.getPropertyValue(u)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,l=Math.min(a.length,s.length);for(let u=0;u<l;u++)Tn(a[u],s[u])}function Dt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function It(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Ot(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,u)=>a.toBlob(d=>d?l(d):u(new Error("plot-to-png: toBlob returned null")),"image/png"))}function po(e,t,n){const r=e.cloneNode(!0);Tn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const u=new Image;u.onload=()=>s(u),u.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),u.src=a})}async function Pn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Dt(e);return Ot(r,o,It(t),a,s=>s.drawImage(e,0,0,r,o))}async function ho(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Dt(e);try{return await Ot(r,o,It(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function go(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function mo(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??Dt(e);if(n){const d=n.getBoundingClientRect(),g=await po(n,d.width||a,d.height||s);return Ot(a,s,It(t),l,x=>{for(const v of r){const f=v.getBoundingClientRect();x.drawImage(v,f.left-o.left,f.top-o.top,f.width,f.height)}x.drawImage(g,d.left-o.left,d.top-o.top,d.width,d.height)})}if(r.length)return Pn(r[0],t);const u=go(e);if(u)return ho(u,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function xo(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const vo=8;function bo(e,t,n,r=vo){return!(t>0)||!(e>0)?n:e<t+r}function Sn(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}const wo={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},yo={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function Ge({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:yo[e]??null})}function An({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(Ge,{name:e??""})})}function Cn(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Eo({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:a}=n,[s,l]=c.useState(!1),[u,d]=c.useState(0),g=c.useRef(null),x=Sn(r,o),v=e?void 0:((b=r[x])==null?void 0:b.label)??"",f=c.useCallback(()=>{l(h=>{const w=!h;return w&&d(x),w})},[x]),m=c.useCallback(h=>{a(h),l(!1)},[a]);c.useEffect(()=>{if(!s)return;const h=T=>{g.current&&!g.current.contains(T.target)&&l(!1)},w=T=>{T.key==="Escape"&&(T.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",h,!0),document.addEventListener("keydown",w,!0),()=>{document.removeEventListener("pointerdown",h,!0),document.removeEventListener("keydown",w,!0)}},[s]);const p=h=>{if(!s){(h.key==="ArrowDown"||h.key==="Enter"||h.key===" ")&&(h.preventDefault(),d(x),l(!0));return}if(h.key==="ArrowDown")h.preventDefault(),d(w=>(w+1)%r.length);else if(h.key==="ArrowUp")h.preventDefault(),d(w=>(w-1+r.length)%r.length);else if(h.key==="Enter"||h.key===" "){h.preventDefault();const w=r[u];w&&m(w.id)}};return i.jsxs("div",{ref:g,className:"relative inline-flex",onPointerDown:h=>h.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:h=>{h.stopPropagation(),f()},onDoubleClick:h=>h.stopPropagation(),onKeyDown:p,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",v?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[v?i.jsx("span",{"aria-hidden":"true",children:v}):i.jsx(Ge,{name:e??""}),i.jsx(Ge,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((h,w)=>{const T=h.id===o,E=w===u;return i.jsx("li",{role:"option","aria-selected":T,children:i.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),m(h.id)},onPointerEnter:()=>d(w),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",T?"text-accent font-medium":"text-fg"].join(" "),children:h.label})},h.id)})})]})}const _o=e=>e.format?e.format(e.value):String(e.value);function kn({spec:e}){return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:t=>t.stopPropagation(),onDoubleClick:t=>{t.stopPropagation(),e.defaultValue!==void 0&&e.onChange(e.defaultValue)},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx(Ge,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:t=>e.onChange(Number(t.target.value)),onPointerDown:t=>t.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:_o(e)})]})}function Mo({icon:e,title:t,menu:n,onClose:r}){var x;const{options:o,value:a,onSelect:s}=n,[l,u]=c.useState(!1),d=Sn(o,a),g=((x=o[d])==null?void 0:x.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:v=>{v.stopPropagation(),u(f=>!f)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx(Ge,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:g}),i.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:i.jsx(Ge,{name:"caret"})})]}),l&&o.map(v=>{const f=v.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":f,"data-menu-option":"",onClick:m=>{m.stopPropagation(),s(v.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",f?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:f?"✓":""}),i.jsx("span",{children:v.label})]},v.id)})]})}function To({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return c.useEffect(()=>{if(!r)return;const s=u=>{a.current&&!a.current.contains(u.target)&&o(!1)},l=u=>{u.key==="Escape"&&(u.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx(Ge,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(Mo,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var u;l.stopPropagation(),!s.disabled&&((u=s.onClick)==null||u.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Ge,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Ge,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(kn,{spec:s})},s.id))]})]})}function Po({controller:e,config:t}){var R,P;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),l=`${((R=t==null?void 0:t.leadingButtons)==null?void 0:R.length)??0}:${((P=t==null?void 0:t.sliders)==null?void 0:P.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const y=n.current,C=y==null?void 0:y.parentElement;if(!C)return;const D=()=>{const ue=C.clientWidth;if(!a.current&&n.current){const te=n.current.scrollWidth;te>0&&(s.current=te)}o(bo(ue,s.current,a.current))},H=new ResizeObserver(D);return H.observe(C),D(),()=>H.disconnect()},[l]),(t==null?void 0:t.enabled)===!1)return null;const u=e.capabilities,d=t==null?void 0:t.buttons,g=(y,C)=>C&&(d==null?void 0:d[y])!==!1,x=y=>()=>e.setDragMode(y),v=()=>{e.toPNG({filename:"plot"}).then(y=>xo(y,"plot.png")).catch(()=>{})},f=[];g("zoom",u.zoom)&&f.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:x("zoom")}),g("pan",u.pan)&&f.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:x("pan")}),g("select",u.select)&&f.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:x("select")}),g("lasso",u.lasso)&&f.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:x("lasso")});const m=[];g("zoomIn",u.zoom)&&m.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),g("zoomOut",u.zoom)&&m.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const p=[];g("autoscale",u.autoscale)&&p.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),g("reset",u.reset)&&p.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const b=[];g("screenshot",u.screenshot)&&b.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:v});const h=[f,m,p,b].filter(y=>y.length>0),w=h.flat(),T=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!T.length&&w.length===0&&E.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",M=(t==null?void 0:t.visibility)==="always",A=_==="top-right"||_==="bottom-right",V=["z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",M?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),B={position:"absolute",pointerEvents:"auto",...wo[_]};return r?i.jsx("div",{ref:n,style:B,className:`${V} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(To,{actions:w,leading:T,sliders:E})}):i.jsxs("div",{ref:n,style:B,className:`${V} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${A?"justify-end":"justify-start"}`,children:[T.length>0&&i.jsxs(i.Fragment,{children:[T.map(y=>y.menu?i.jsx(Eo,{icon:y.icon,title:y.title,menu:y.menu},y.id):i.jsx(An,{icon:y.icon,label:y.label,title:y.title,active:y.active,disabled:y.disabled,onClick:y.onClick??(()=>{})},y.id)),h.length>0&&i.jsx(Cn,{})]}),h.map((y,C)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[C>0&&i.jsx(Cn,{}),y.map(D=>i.jsx(An,{icon:D.icon,title:D.title,active:D.active,disabled:D.disabled,onClick:D.onClick},D.id))]},y[0].id))]}),E.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${A?"justify-end":"justify-start"}`,children:E.map(y=>i.jsx(kn,{spec:y},y.id))})]})}const So={zoom:1,pan:{x:0,y:0}},Rn=1.3,Ao=.25,Co=64,ko={buttons:{zoom:!1}};function Ro(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Lo=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Bt(e,t){return{id:"colormap",title:"Colormap",menu:{options:Lo,value:e,onSelect:t}}}function Do({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:l=Ao,maxZoom:u=Co,requestRender:d,onReset:g}){const x=c.useCallback(_=>{var D;if(!o)return;const M=(D=e.current)==null?void 0:D.getBoundingClientRect(),A=(M==null?void 0:M.width)??0,L=(M==null?void 0:M.height)??0,V=a&&s&&A>0&&L>0?on(a,s,A,L):u,B=Math.max(l,Math.min(V,n*_));if(B===n)return;const R=A/2,P=L/2,y=R-(R-r.x)/n*B,C=P-(P-r.y)/n*B;o({zoom:B,pan:{x:y,y:C}})},[o,e,a,s,u,l,n,r.x,r.y]),v=c.useCallback(()=>x(Rn),[x]),f=c.useCallback(()=>x(1/Rn),[x]),m=c.useCallback(()=>{o==null||o(So),g==null||g()},[o,g]),p=c.useCallback(_=>{const M={scale:_==null?void 0:_.scale,filename:_==null?void 0:_.filename};d==null||d();const A=t==null?void 0:t.current;if(A)return Pn(A,M);const L=e.current;return L?mo(L,M):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,d]),b=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),h=n!==1||r.x!==0||r.y!==0,w=c.useCallback(_=>{},[]),T=c.useCallback(_=>{},[]),E=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:b,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:h,setDragMode:w,setHoverMode:T,toggleSpikelines:E,zoomIn:v,zoomOut:f,autoscale:m,reset:m,toPNG:p}),[b,h,w,T,E,v,f,m,p])}const Io={zoom:1,pan:{x:0,y:0}};function it({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:l,naturalDims:u,checkerboard:d,wrapperClassName:g,wrapperStyle:x,viewportPadding:v,header:f,surface:m,showAxes:p,overlayNode:b,overlay:h,notationSeed:w,exportCanvasRef:T,requestRender:E,leadingMenus:_,displayAdjust:M,label:A,showLabelChip:L,isDraggable:V=!1,onDragStart:B,extraChips:R}){const[P,y]=c.useState(w),[C,D]=c.useState(!1),{containerProps:H}=sn({containerRef:r,zoom:a,pan:s,onViewportChange:l,naturalWidth:u==null?void 0:u.w,naturalHeight:u==null?void 0:u.h}),ue=c.useCallback(()=>{M==null||M.onExposureChange(0),M==null||M.onOffsetChange(0)},[M]),te=c.useCallback(()=>{l==null||l(Io),ue()},[l,ue]),me=Do({rootRef:r,canvasRef:T,zoom:a,pan:s,onViewportChange:l,naturalWidth:u==null?void 0:u.w,naturalHeight:u==null?void 0:u.h,requestRender:E,onReset:ue}),we=c.useMemo(()=>{if(!M)return;const xe=(q,ve)=>`${q>=0?"+":"−"}${Math.abs(q).toFixed(ve)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to reset.",min:-8,max:8,step:.1,value:M.exposureEV,onChange:M.onExposureChange,format:q=>xe(q,1),defaultValue:0},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to reset.",min:-1,max:1,step:.01,value:M.offset,onChange:M.onOffsetChange,format:q=>xe(q,2),defaultValue:0}]},[M]),_e=c.useMemo(()=>({...ko,leadingButtons:[..._??[],...C?[Ro(P,y)]:[]],sliders:we}),[C,P,_,we]),Ce=" cairn-checkerboard",Le="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(d==="pane"?Ce:""),pe=g+(d==="wrapper"?Ce:""),Se="render"in h?h.render({notation:P,setOverlayActive:D}):h.hasSource&&u?i.jsx(Ze,{imageElRef:h.displayElRef,naturalWidth:u.w,naturalHeight:u.h,zoom:a,pan:s,sourceWindow:h.sourceWindow,sample:h.sample,notation:P,version:h.version,onActiveChange:D}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[f,n&&i.jsx(Po,{controller:me,config:_e}),i.jsxs("div",{ref:r,className:Le,style:{padding:v,...H.style},onPointerDown:H.onPointerDown,onPointerMove:H.onPointerMove,onPointerUp:H.onPointerUp,onPointerCancel:H.onPointerCancel,onDoubleClick:te,...t,children:[i.jsxs("div",{ref:o,className:pe,style:x,children:[m,p&&u&&i.jsx(lo,{naturalWidth:u.w,naturalHeight:u.h,zoom:a,containerRef:o}),b]}),Se,!n&&C&&i.jsx(cn,{notation:P,onChange:y})]}),L&&i.jsx(uo,{label:A,isDraggable:V,onDragStart:B}),R]})}function Ln(e){return"hdr"in e&&e.hdr!=null}function Dn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Ae(e){return Number.isFinite(e)?e:0}const Oo={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Bo(e,t,n,r,o=0){const{h:a,w:s,c:l}=Dn(e.shape),u=e.data,d=Lr(t),g=new Uint8ClampedArray(s*a*4);for(let x=0;x<s*a;x++){const v=x*l;let f,m,p,b=1;l===1?f=m=p=Ae(u[v]):l===3?(f=Ae(u[v]),m=Ae(u[v+1]),p=Ae(u[v+2])):(f=Ae(u[v]),m=Ae(u[v+1]),p=Ae(u[v+2]),b=Ae(u[v+3]));const h=[Mt(f,n,o),Mt(m,n,o),Mt(p,n,o)],[w,T,E]=d(h),_=x*4;g[_]=255*Tt(w,r),g[_+1]=255*Tt(T,r),g[_+2]=255*Tt(E,r),g[_+3]=255*(b<0?0:b>1?1:b)}return new ImageData(g,s,a)}function No(e){var j,ye;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:l=!1,processing:u=Oo,zoom:d=1,pan:g={x:0,y:0},onViewportChange:x,onNaturalSize:v,label:f,isDraggable:m=!1,onDragStart:p,overlay:b,overlaySettings:h,pixelValueNotation:w="decimal",toolbar:T=!0}=e,[E,_]=c.useState(s);c.useEffect(()=>{_(s)},[s]);const M=c.useRef(null),A=c.useRef(null),L=c.useRef(null),V=c.useRef(null),B=c.useRef(null),R=c.useRef(null),P=c.useRef(null),[y,C]=c.useState(0),D=c.useCallback(()=>C(k=>k+1),[]),H=c.useMemo(()=>({get current(){const k=B.current;return k instanceof HTMLCanvasElement?k:null}}),[]),ue=c.useCallback(k=>{M.current=k,k&&(B.current=k)},[]),te=c.useCallback(k=>{A.current=k,k&&(B.current=k)},[]),me=c.useCallback(k=>{k&&(B.current=k)},[]),[we,_e]=c.useState(!1),[Ce,Le]=c.useState(!1),[pe,Se]=c.useState(null),{flipSign:xe}=u,{gammaFilterId:q,filterStr:ve,gamma:be,offset:W}=En(u),J=!r&&o!=="none"&&n!=null&&t!=null,ge=o!=="none"&&n!=null,Me=E!=="none"&&!J&&!(r&&ge)&&t!=null;c.useEffect(()=>{if(!Me||!t){Le(!1);return}let k=!1;Le(!1);const N=`${t}::${E}`,Z=wt(N);if(Z){const K=A.current;if(K){K.width=Z.width,K.height=Z.height;const ee=K.getContext("2d");ee&&ee.putImageData(Z,0,0),P.current=Z,D(),Se({w:Z.width,h:Z.height}),v==null||v(Z.width,Z.height),Le(!0)}return}const ne=new Image;return ne.onload=()=>{if(k)return;const K=document.createElement("canvas");K.width=ne.naturalWidth,K.height=ne.naturalHeight;const ee=K.getContext("2d");if(!ee)return;ee.drawImage(ne,0,0);const ce=ee.getImageData(0,0,K.width,K.height),Te=xt.has(E)?"positive":"linear",de=bt(ce,E,Te);yt(N,de);const Ie=A.current;if(!Ie||k)return;Ie.width=de.width,Ie.height=de.height;const Ee=Ie.getContext("2d");Ee&&Ee.putImageData(de,0,0),P.current=de,D(),Se({w:de.width,h:de.height}),v==null||v(de.width,de.height),Le(!0)},ne.src=t,()=>{k=!0}},[Me,t,E]);const he=c.useCallback((k,N)=>{Se(Z=>Z&&Z.w===k&&Z.h===N?Z:{w:k,h:N}),v==null||v(k,N)},[]);c.useEffect(()=>{if(!t){R.current=null,P.current=null,D();return}let k=!1;return He(t).then(N=>{k||(R.current=N,E==="none"&&(P.current=N),D())}),()=>{k=!0}},[t,E,D]);const F=c.useCallback((k,N,Z)=>{const ne=R.current;if(!ne||k<0||N<0||k>=ne.width||N>=ne.height)return null;const K=(N*ne.width+k)*4,ee=ne.data[K],ce=ne.data[K+1],Te=ne.data[K+2],de=P.current;let Ie=ee,Ee=ce,De=Te;if(de&&de.width===ne.width&&de.height===ne.height){const Ve=(N*de.width+k)*4;Ie=de.data[Ve],Ee=de.data[Ve+1],De=de.data[Ve+2]}const Ye=(.299*Ie+.587*Ee+.114*De)/255;return E!=="none"||ee===ce&&ce===Te?{lines:[Q(ee,"uint8",Z)],luminance:Ye}:{lines:[Q(ee,"uint8",Z),Q(ce,"uint8",Z),Q(Te,"uint8",Z)],luminance:Ye,colors:[fe[0],fe[1],fe[2]]}},[E]);c.useEffect(()=>{if(!J){_e(!1);return}let k=!1;const N=kr(),Z=N==="gpu"||N==="auto",ne=`${n}::${t}::${o}::${E}`;if(N!=="gpu"){const K=wt(ne);if(K){const ee=M.current;if(ee){(ee.width!==K.width||ee.height!==K.height)&&(ee.width=K.width,ee.height=K.height);const ce=ee.getContext("2d");ce&&ce.putImageData(K,0,0),he(K.width,K.height),_e(!0)}return}}return(async()=>{const[K,ee]=await Promise.all([He(n),He(t)]);if(k||!K||!ee)return;const Te=o.includes("signed")?"signed":"positive",de=E!=="none"?vt(E):null,Ie={diffMode:o,colormap:de,cmapMode:Te};if(Z)try{const Ke=M.current;if(Ke){const Ve=Ar(K,ee,Ie,Ke);if(Ve){if(k)return;he(Ve.width,Ve.height),_e(!0);return}}}catch(Ke){console.warn("[cairn] WebGL 2 diff error:",Ke)}if(N==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let Ee=yr(K,ee,o);E!=="none"&&(Ee=bt(Ee,E,Te)),yt(ne,Ee);const De=M.current;if(!De||k)return;(De.width!==Ee.width||De.height!==Ee.height)&&(De.width=Ee.width,De.height=Ee.height);const Ye=De.getContext("2d");Ye&&Ye.putImageData(Ee,0,0),he(Ee.width,Ee.height),_e(!0)})(),()=>{k=!0}},[n,t,o,J,E,v]);const U=a==="auto"?void 0:a,$=xe?{filter:"invert(1)"}:{},G=b&&(h!=null&&h.enabled)&&pe&&t&&((((j=b.boxes)==null?void 0:j.length)??0)>0||(((ye=b.masks)==null?void 0:ye.length)??0)>0)?i.jsx(Ct,{data:b,settings:h,naturalWidth:pe.w,naturalHeight:pe.h}):void 0,Y=t?J?i.jsxs(i.Fragment,{children:[!we&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:ue,className:"w-full h-full object-contain block",style:{display:we?"block":"none",imageRendering:U,...$}})]}):Me?i.jsxs(i.Fragment,{children:[!Ce&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:te,className:"w-full h-full object-contain block",style:{display:Ce?"block":"none",imageRendering:U,...$}})]}):i.jsx("img",{ref:me,src:t,alt:f,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ve,imageRendering:U},onLoad:k=>{const N=k.currentTarget;Se({w:N.naturalWidth,h:N.naturalHeight}),v==null||v(N.naturalWidth,N.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(it,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:T,paneRef:L,wrapperRef:V,zoom:d,pan:g,onViewportChange:x,naturalDims:pe,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${g.x}px, ${g.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:l&&pe?"16px 4px 4px 28px":"4px",header:i.jsx(_n,{id:q,gamma:be,offset:W}),surface:Y,showAxes:l,overlayNode:G,overlay:{displayElRef:B,sample:F,version:y,hasSource:!!t},notationSeed:w,exportCanvasRef:H,leadingMenus:[Bt(E,k=>_(k))],label:f,showLabelChip:!0,isDraggable:m,onDragStart:p})}function Uo(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:l="auto",zoom:u=1,pan:d={x:0,y:0},onViewportChange:g,pixelValueNotation:x="decimal",toolbar:v=!0}=e,f=c.useRef(null),m=c.useRef(null),p=c.useRef(null),[b,h]=c.useState(null),w=c.useRef(null),[T,E]=c.useState(0),[_,M]=c.useState(0),[A,L]=c.useState(0);c.useEffect(()=>{const R=f.current;if(!R)return;let P;try{P=Bo(t,n,r+_,o,A)}catch(C){console.error("[cairn] HDR tone-map error:",C);return}(R.width!==P.width||R.height!==P.height)&&(R.width=P.width,R.height=P.height);const y=R.getContext("2d");y&&(y.putImageData(P,0,0),w.current=P,E(C=>C+1),h(C=>C&&C.w===P.width&&C.h===P.height?C:{w:P.width,h:P.height}))},[t,n,r,o,_,A]);const V=c.useCallback((R,P,y)=>{const C=b;if(!C||R<0||P<0||R>=C.w||P>=C.h)return null;const D=t.shape.length===2?1:t.shape[2]??1,H=(P*C.w+R)*D,ue=t.data,te=w.current;let me=.5;if(te&&te.width===C.w&&te.height===C.h){const we=(P*C.w+R)*4;me=(.299*te.data[we]+.587*te.data[we+1]+.114*te.data[we+2])/255}return D===1?{lines:[Q(ue[H]??0,"unit",y)],luminance:me}:{lines:[Q(ue[H]??0,"unit",y),Q(ue[H+1]??0,"unit",y),Q(ue[H+2]??0,"unit",y)],luminance:me,colors:[fe[0],fe[1],fe[2]]}},[t,b]),B=l==="auto"?void 0:l;return i.jsx(it,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:v,paneRef:m,wrapperRef:p,zoom:u,pan:d,onViewportChange:g,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:a&&b?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:f,className:"w-full h-full object-contain block",style:{imageRendering:B}}),showAxes:a,overlay:{displayElRef:f,sample:V,version:T,hasSource:!0},notationSeed:x,exportCanvasRef:f,displayAdjust:{exposureEV:_,offset:A,onExposureChange:M,onOffsetChange:L},label:s,showLabelChip:!!s})}function Nt(e){return Ln(e)?i.jsx(Uo,{...e}):i.jsx(No,{...e})}const Go=["linear","srgb","reinhard","aces"];function Fo(e){return e&&Go.includes(e)?e:"srgb"}function Vo(e){const{h:t,w:n,c:r}=Dn(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let u,d,g,x=1;r===1?u=d=g=Ae(o[l]):r===3?(u=Ae(o[l]),d=Ae(o[l+1]),g=Ae(o[l+2])):(u=Ae(o[l]),d=Ae(o[l+1]),g=Ae(o[l+2]),x=Ae(o[l+3]));const v=s*4;a[v]=u,a[v+1]=d,a[v+2]=g,a[v+3]=x}return{data:a,width:n,height:t,format:"rgba32float"}}function In(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,l=(t.width-a)/2,u=(t.height-s)/2,d=Math.max(e.zoom,1e-6),g=t.width/(d*a),x=t.height/(d*s),v=-l/a-e.pan.x/(d*a),f=-u/s-e.pan.y/(d*s);return{x:v,y:f,w:g,h:x}}function On(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function zo(e){var Me,he;const t=Ln(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(!1),[l,u]=c.useState(!1),[d,g]=c.useState(!1),[x,v]=c.useState(null),[f,m]=c.useState(0),[p,b]=c.useState(0),[h,w]=c.useState({x:0,y:0,w:1,h:1}),T=c.useRef(null),E=c.useRef(null),[_,M]=c.useState(0),A=e.zoom??1,L=e.pan??{x:0,y:0},V=e.onViewportChange,B=t?"none":e.colormap??"none",[R,P]=c.useState(B);c.useEffect(()=>{P(B)},[B]);const y=t?"none":R,[C,D]=c.useState(0),[H,ue]=c.useState(0),te=At();c.useEffect(()=>{const F=n.current;if(!F)return;let U=!1;return nt().then($=>{if(U)return;const G=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,Y=$.capabilities.hdr&&G&&t;s.current=Y,io(F,{hdr:Y}).then(j=>{if(U){yn(j);return}a.current=j,g(!0)}).catch(j=>{U||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",j),u(!0))})}).catch($=>{U||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",$),u(!0))}),()=>{U=!0,a.current&&(yn(a.current),a.current=null)}},[]),c.useEffect(()=>{const F=r.current;if(!F)return;const U=new ResizeObserver(()=>b($=>$+1));return U.observe(F),()=>U.disconnect()},[]),c.useEffect(()=>{const F=r.current;if(!F)return;const U=new IntersectionObserver($=>{const G=$[0];if(!G)return;const Y=a.current;Y&&(Y.setVisible(G.isIntersecting),G.isIntersecting?Y.isParked&&(Y.restore(),b(j=>j+1)):Y.park())},{threshold:0});return U.observe(F),()=>U.disconnect()},[]),c.useEffect(()=>{var $;if(!t||!d)return;const F=e.hdr;T.current=F;const U=Vo(F);($=a.current)==null||$.setSource(U),v(G=>G&&G.w===U.width&&G.h===U.height?G:{w:U.width,h:U.height}),M(G=>G+1),m(G=>G+1)},[t,d,t?e.hdr:null]),c.useEffect(()=>{if(t||!d)return;const F=e,U=F.imageUrl,$=R;if(!U){E.current=null,v(null),M(Y=>Y+1);return}let G=!1;return He(U).then(Y=>{var k,N;if(G||!Y)return;let j=Y;if($!=="none"){const Z=`gpu::${U}::${$}`,ne=wt(Z);if(ne)j=ne;else{const K=xt.has($)?"positive":"linear";j=bt(Y,$,K),yt(Z,j)}}E.current=Y;const ye={data:j.data,width:j.width,height:j.height,format:"rgba8unorm"};(k=a.current)==null||k.setSource(ye),v(Z=>Z&&Z.w===j.width&&Z.h===j.height?Z:{w:j.width,h:j.height}),(N=F.onNaturalSize)==null||N.call(F,j.width,j.height),M(Z=>Z+1),m(Z=>Z+1)}),()=>{G=!0}},[t,d,t?null:e.imageUrl,t?null:R]);const me=t?e.exposure??0:0,we=t?e.tonemap:void 0,_e=t?e.gamma:void 0,Ce=c.useCallback(()=>{const F=a.current;if(!F||!d||!x)return;const U=r.current,$=o.current,G=$?$.getBoundingClientRect():U?U.getBoundingClientRect():{width:x.w,height:x.h},Y=In({zoom:A,pan:L},G,x.w,x.h);w(N=>N.x===Y.x&&N.y===Y.y&&N.w===Y.w&&N.h===Y.h?N:Y),G.width>0&&G.height>0&&F.resize(Math.round(G.width*te),Math.round(G.height*te));const j=On(Y,G,x.w,x.h)>=kt?"nearest":"linear",ye=Y,k=t?{exposureEV:me+C,offset:H,operator:s.current?"extended":Fo(we),gamma:_e,isScalar:!1,hdrOut:s.current,uv:ye,filter:j}:{exposureEV:C,offset:H,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ye,filter:j};try{F.render(k)||u(!0)}catch(N){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",N),u(!0)}},[d,x,A,L.x,L.y,me,C,H,we,_e,t,te]);c.useEffect(()=>{Ce()},[Ce,f,p]);const Le=c.useCallback((F,U,$)=>{if(t){const ne=T.current,K=x;if(!ne||!K||F<0||U<0||F>=K.w||U>=K.h)return null;const ee=ne.shape.length===2?1:ne.shape[2]??1,ce=(U*K.w+F)*ee,Te=ne.data,de=.5;return ee===1?{lines:[Q(Te[ce]??0,"unit",$)],luminance:de}:{lines:[Q(Te[ce]??0,"unit",$),Q(Te[ce+1]??0,"unit",$),Q(Te[ce+2]??0,"unit",$)],luminance:de,colors:[fe[0],fe[1],fe[2]]}}const G=E.current;if(!G||F<0||U<0||F>=G.width||U>=G.height)return null;const Y=(U*G.width+F)*4,j=G.data[Y],ye=G.data[Y+1],k=G.data[Y+2],N=(.299*j+.587*ye+.114*k)/255;return y!=="none"||j===ye&&ye===k?{lines:[Q(j,"uint8",$)],luminance:N}:{lines:[Q(j,"uint8",$),Q(ye,"uint8",$),Q(k,"uint8",$)],luminance:N,colors:[fe[0],fe[1],fe[2]]}},[t,x,y]),pe=e.showAxes??!1,Se=t?e.label??"":e.label,xe=e.interpolation??"auto",q=xe==="auto"?void 0:xe,ve=t?void 0:e.overlay,be=t?void 0:e.overlaySettings,W=t?!1:e.isDraggable??!1,J=t?void 0:e.onDragStart;if(l)return t?i.jsx(Nt,{...e}):i.jsx(Nt,{...e});const ge=ve&&(be!=null&&be.enabled)&&x&&((((Me=ve.boxes)==null?void 0:Me.length)??0)>0||(((he=ve.masks)==null?void 0:he.length)??0)>0)?i.jsx(Ct,{data:ve,settings:be,naturalWidth:x.w,naturalHeight:x.h}):void 0;return i.jsx(it,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":d},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:L,onViewportChange:V,naturalDims:x,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:pe&&x?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:q},"data-gpu-image-canvas":!0}),showAxes:pe,overlayNode:ge,overlay:{displayElRef:n,sample:Le,version:_,hasSource:!0,sourceWindow:h},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Ce,leadingMenus:t?void 0:[Bt(y,F=>P(F))],displayAdjust:{exposureEV:C,offset:H,onExposureChange:D,onOffsetChange:ue},label:Se,showLabelChip:!!Se,isDraggable:W,onDragStart:J})}const ct=new Map;function Fe(e){if(ct.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);ct.set(e.id,e)}function je(e){return ct.get(e)}function $o(){return Array.from(ct.values())}function Bn(e,t){return{...e.params??{},...t??{}}}const Xo={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},Wo={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Yo={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Ko={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Ho={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},qo={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Nn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];jo(Nn);const Ut=[1.052156925,1,.91835767],Zo=.7;function jo(e){const[t,n,r]=e[0],[o,a,s]=e[1],[l,u,d]=e[2],g=a*d-s*u,x=-(o*d-s*l),v=o*u-a*l,m=1/(t*g+n*x+r*v);return[[g*m,-(n*d-r*u)*m,(n*s-r*a)*m],[x*m,(t*d-r*l)*m,-(t*s-r*o)*m],[v*m,-(t*u-n*l)*m,(t*a-n*o)*m]]}function Qo(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Gt=6/29;function Ft(e){return e>Gt**3?Math.cbrt(e):e/(3*Gt*Gt)+4/29}function Un(e,t,n){const[r,o,a]=Qo(Nn,e,t,n),s=Ft(r*Ut[0]),l=Ft(o*Ut[1]),u=Ft(a*Ut[2]),d=116*l-16,g=500*(s-l),x=200*(l-u);return[d,.01*d*g,.01*d*x]}function Jo(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function es(){const e=Un(0,1,0),t=Un(0,0,1);return Math.pow(Jo(e,t),Zo)}const Gn=es(),ts=.082;function Fn(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),l=1/e,u=Math.PI**2,d=[0,0,0];for(let g=-s;g<=s;g++)for(let x=-s;x<=s;x++){const v=(x*l)**2+(g*l)**2;for(let f=0;f<3;f++)d[f]+=t[f]*Math.sqrt(Math.PI/n[f])*Math.exp(-u*v/n[f])+r[f]*Math.sqrt(Math.PI/o[f])*Math.exp(-u*v/o[f])}return{r:s,deltaX:l,sums:d}}function Vn(e){const t=.5*ts*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const u=Math.exp(-(l*l+s*s)/(2*t*t)),d=-l*u,g=(l*l/(t*t)-1)*u;d>0&&(r+=d),g>0?o+=g:a-=g}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const ns=`
${Ue}
${st}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,rs=`
${Ue}
${st}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,lt=`
${Ue}
${st}
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
`,zn=`
${Ue}
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
`;function We(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function ut(e){return[We(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),We(2,[e.sums[2],0,0,0])]}function $n(e){return[We(4,[Gn,e.sd,e.r,e.edgeNorm]),We(5,[e.pointPos,e.pointNeg,0,0])]}function Xn(e,t,n,r,o=""){const a=Fn(e),s=Vn(e),l=`ycxczA${o}`,u=`ycxczB${o}`,d=`labA${o}`,g=`labB${o}`,x=`flip${o}`;return{passes:[{name:l,shader:t,inputs:[n],output:l},{name:u,shader:t,inputs:[r],output:u},{name:d,shader:lt,inputs:[l],output:d,uniforms:()=>ut(a)},{name:g,shader:lt,inputs:[u],output:g,uniforms:()=>ut(a)},{name:x,shader:zn,inputs:[d,g,l,u],output:x,uniforms:()=>$n(s)}],flipRef:x}}const os={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Xn(t,ns,"srcA","srcB");return{passes:n,final:r}}},ss={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Xn(t,rs,"srcA","srcB");return{passes:n,final:r}}},Wn=`
${Ue}
${st}
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
`,as=`
${Ue}
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
`,is={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=Fn(t),l=Vn(t),u=[];let d=null;for(let g=0;g<o;g++){const x=n+g*a,v=`_e${g}`,f=`ycxczA${v}`,m=`ycxczB${v}`,p=`labA${v}`,b=`labB${v}`,h=`acc${v}`;u.push({name:f,shader:Wn,inputs:["srcA"],output:f,uniforms:()=>[We(1,[x,0,0,0])]},{name:m,shader:Wn,inputs:["srcB"],output:m,uniforms:()=>[We(1,[x,0,0,0])]},{name:p,shader:lt,inputs:[f],output:p,uniforms:()=>ut(s)},{name:b,shader:lt,inputs:[m],output:b,uniforms:()=>ut(s)}),d===null?u.push({name:h,shader:zn,inputs:[p,b,f,m],output:h,uniforms:()=>$n(l)}):u.push({name:h,shader:as,inputs:[p,b,f,m,d],output:h,uniforms:()=>[We(5,[Gn,l.sd,l.r,l.edgeNorm]),We(6,[l.pointPos,l.pointNeg,0,0])]}),d=h}return{passes:u,final:d}}};let Yn=!1;function cs(){Yn||(Yn=!0,Fe(Wo),Fe(Xo),Fe(Yo),Fe(Ho),Fe(Ko),Fe(qo),Fe(os),Fe(is),Fe(ss))}cs();function Kn(){const e=[];for(const t of $o())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function ls(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function us(e,t){return e==="signed"||e==="relative"?"signed":xt.has(t??"")?"positive":"linear"}const Hn=new WeakMap;function Vt(e,t,n,r){let o=Hn.get(e);o||(o=new Map,Hn.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function ds(e){return`
${Ue}
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
`}const dt="rgba16float";function fs(e,t,n,r,o){var f,m;const a=je(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),l=Math.min(t.height,n.height),u=Bn(a,o);if(a.kind==="pointwise"){const p=e.createTexture(s,l,dt),b=Vt(e,`pw:${a.id}`,ds(a.source),dt);let h;try{h=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(p,b,h)}finally{(f=h==null?void 0:h.destroy)==null||f.call(h)}return p}const d={width:s,height:l,params:u},g=a.buildPasses(d),x=new Map([["srcA",t],["srcB",n]]),v=[];try{for(const b of g.passes){const h=e.createTexture(s,l,dt);v.push(h),x.set(b.output,h);const w=Vt(e,`mp:${a.id}:${b.name}`,b.shader,dt),T=b.inputs.map((_,M)=>{const A=x.get(_);if(!A)throw new Error(`computeDiff: pass "${b.name}" input "${_}" not produced yet`);return{binding:M,resource:A}});b.uniforms&&T.push(...b.uniforms(d));let E;try{E=e.createBindGroup(w,T),e.renderFullscreen(h,w,E)}finally{(m=E==null?void 0:E.destroy)==null||m.call(E)}}const p=x.get(g.final);if(!p)throw new Error(`computeDiff: final ref "${g.final}" not produced`);for(const b of v)b!==p&&b.destroy();return p}catch(p){for(const b of v)b.destroy();throw p}}const ps=8,hs=256*1024*1024;class gs{constructor(t=ps,n=hs){oe(this,"map",new Map);oe(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const qn=new WeakMap;function ms(e){let t=qn.get(e);return t||(t=new gs,qn.set(e,t)),t}function xs(e,t){const n=Bn(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function vs(e,t,n,r){const o=je(n),a=o?xs(o,r):"";return`${e}|${t}|${n}|${a}`}function bs(e,t,n,r,o,a,s){const l=je(r);if(!l)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=ms(e),d=vs(a,s,r,o),g=u.get(d);if(g)return g;const x=fs(e,t,n,r,o),v=Math.min(t.width,n.width),f=Math.min(t.height,n.height),m={texture:x,width:v,height:f,displayRange:l.displayRange,bytes:v*f*8};return u.set(d,m),m}async function ws(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=mn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function ys(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,r})),t.resultSamplesPending)}const Es=`
${Ue}
${ln}
@group(0) @binding(0) var resultTex: texture_2d<f32>;
@group(0) @binding(3) var lut: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_uv: vec4<f32>;   // uvRect.xy, uvRect.wh
@group(0) @binding(11) var<uniform> u_disp: vec4<f32>; // displayRangeId, cmapModeId, useColormap, filterMode
@group(0) @binding(14) var<uniform> u_expo: vec4<f32>; // exposureEV, offset, 0, 0

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
  // Exposure/offset adjust the RAW metric value BEFORE the cmap-mode index
  // mapping and LUT — i.e. they change the colormap SENSITIVITY (value * 2^EV +
  // offset), not the final RGB. Display-only: the cached diff RESULT is never
  // touched, so this never triggers a recompute.
  var v = raw.rgb * exp2(u_expo.x) + vec3<f32>(u_expo.y);
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
`,_s={unit:0,signed:1,relative:2},Ms={linear:0,signed:1,positive:2};function Ts(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ps(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Ss(e,t,n,r,o){var v;const a=Ps(t),s=Vt(e,"diff-display",Es,a),l=Ts(e,o.colormap),u=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([_s[r],Ms[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),g=new Float32Array([o.exposureEV??0,o.offset??0,0,0]);let x;try{x=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:g}}]),e.renderFullscreen(t,s,x)}finally{(v=x==null?void 0:x.destroy)==null||v.call(x),l.destroy()}}const Zn=.6*.6*2.51,As=.6*.03,Cs=0,jn=.6*.6*2.43,ks=.6*.59,Rs=.14;function Qn(e){const t=(As-ks*e)/(Zn-jn*e),n=(Cs-Rs*e)/(Zn-jn*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Ls=.85,Ds=.85,Jn=11920928955078125e-23,zt=[.2126,.7152,.0722];function Is(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Os(e,t,n,r=3,o={}){const a=t*n,s=Qn(Ls),l=Qn(Ds),u=new Float64Array(a);let d=0;for(let w=0;w<a;w++){const[T,E,_]=Is(e,w,r),M=T*zt[0]+E*zt[1]+_*zt[2];u[w]=M,M>d&&(d=M)}const g=Float64Array.from(u).sort(),x=a>>1,v=a%2===1?g[x]:g[x-1],f=Math.max(v,Jn),m=Math.max(d,Jn),p=o.startExposure??Math.log2(s/m),b=o.stopExposure??Math.log2(l/f),h=Math.max(2,Math.ceil(b-p));return{startExposure:p,stopExposure:b,numExposures:h}}const Bs={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ns({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:l,onViewportChange:u,processing:d=Bs,interpolation:g="auto",label:x="",isDraggable:v=!1,onDragStart:f,overlay:m,overlaySettings:p,pixelValueNotation:b="decimal"}){var ve,be;const h=c.useRef(null),[w,T]=c.useState(null),[E,_]=c.useState(null),[M,A]=c.useState(b),[L,V]=c.useState(!1),B=c.useRef(null),R=c.useRef(null),P=c.useRef(null),y=c.useRef(null),[C,D]=c.useState(0);c.useEffect(()=>{if(!e){P.current=null,D(J=>J+1);return}let W=!1;return He(e).then(J=>{W||(P.current=J,D(ge=>ge+1))}),()=>{W=!0}},[e]),c.useEffect(()=>{if(!t){y.current=null,D(J=>J+1);return}let W=!1;return He(t).then(J=>{W||(y.current=J,D(ge=>ge+1))}),()=>{W=!0}},[t]);const H=W=>(J,ge,Me)=>{const he=W.current;if(!he||J<0||ge<0||J>=he.width||ge>=he.height)return null;const F=(ge*he.width+J)*4,U=he.data[F],$=he.data[F+1],G=he.data[F+2],Y=(.299*U+.587*$+.114*G)/255;return U===$&&$===G?{lines:[Q(U,"uint8",Me)],luminance:Y}:{lines:[Q(U,"uint8",Me),Q($,"uint8",Me),Q(G,"uint8",Me)],luminance:Y,colors:[fe[0],fe[1],fe[2]]}},ue=c.useMemo(()=>H(P),[]),te=c.useMemo(()=>H(y),[]),me=!!m&&!!(p!=null&&p.enabled)&&!!w&&!!e&&((((ve=m.boxes)==null?void 0:ve.length)??0)>0||(((be=m.masks)==null?void 0:be.length)??0)>0),{gammaFilterId:we,filterStr:_e,gamma:Ce,offset:Le}=En(d),pe=`translate(${l.x}px, ${l.y}px) scale(${s})`,Se=g==="auto"?void 0:g,{containerProps:xe,modifierActive:q}=sn({containerRef:h,zoom:s,pan:l,onViewportChange:u});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(_n,{id:we,gamma:Ce,offset:Le}),i.jsxs("div",{ref:h,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...xe.style},onPointerDown:xe.onPointerDown,onPointerMove:xe.onPointerMove,onPointerUp:xe.onPointerUp,onPointerCancel:xe.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:pe,transformOrigin:"0 0"},children:[i.jsx("img",{ref:B,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:_e,imageRendering:Se,...n==="blend"?{opacity:o}:{}},onLoad:W=>{const J=W.currentTarget;T({w:J.naturalWidth,h:J.naturalHeight})}}),me&&i.jsx(Ct,{data:m,settings:p,naturalWidth:w.w,naturalHeight:w.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:pe,transformOrigin:"0 0"},children:i.jsx("img",{ref:R,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:_e,imageRendering:Se,...n==="blend"?{opacity:1-o}:{}},onLoad:W=>{const J=W.currentTarget;_({w:J.naturalWidth,h:J.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:W=>{W.stopPropagation(),W.preventDefault();const ge=W.currentTarget.parentElement.getBoundingClientRect(),Me=F=>{a==null||a(Math.max(0,Math.min(1,(F.clientX-ge.left)/ge.width)))},he=()=>{window.removeEventListener("pointermove",Me),window.removeEventListener("pointerup",he)};window.addEventListener("pointermove",Me),window.addEventListener("pointerup",he)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&E&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:R,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:l,sample:te,notation:M,version:C})}),e&&w&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Ze,{imageElRef:B,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:l,sample:ue,notation:M,version:C,onActiveChange:V})})]}):e&&w&&i.jsx(Ze,{imageElRef:B,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:l,sample:ue,notation:M,version:C,onActiveChange:V}),L&&i.jsx(cn,{notation:M,onChange:A})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${v&&!q?" cairn-drag-grip":""}`,draggable:v&&!q,onDragStart:f,style:{cursor:v&&!q?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),x]})]})}function Us(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Gs(e){const t=vt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Fs(e){const{data:t,width:n,height:r,channels:o}=e,a=n*r,s=new Float32Array(a*4),l=u=>Number.isFinite(u)?u:0;for(let u=0;u<a;u++){const d=u*o;let g,x,v,f=1;o===1?g=x=v=l(t[d]):o===3?(g=l(t[d]),x=l(t[d+1]),v=l(t[d+2])):(g=l(t[d]),x=l(t[d+1]),v=l(t[d+2]),f=l(t[d+3]));const m=u*4;s[m]=g,s[m+1]=x,s[m+2]=v,s[m+3]=f}return s}function Vs({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,diffSubmode:u,colormap:d="none",diffKernel:g,onDiffKernelChange:x,onCompareModeChange:v,onRequestSide:f,zoom:m,pan:p,onViewportChange:b,interpolation:h="auto",label:w="",pixelValueNotation:T="decimal"}){var er;const E=c.useRef(null),_=c.useRef(null),M=c.useRef(null),A=c.useRef(null),L=c.useRef(null),[V,B]=c.useState(!1),[R,P]=c.useState(!1),[y,C]=c.useState(null),[D,H]=c.useState(0),[ue,te]=c.useState(0),[me,we]=c.useState(null),[_e,Ce]=c.useState({x:0,y:0,w:1,h:1}),Le=g??u??"absolute",[pe,Se]=c.useState(Le);c.useEffect(()=>{Se(g??u??"absolute")},[g,u]);const xe=c.useCallback(S=>{Se(S),x==null||x(S)},[x]);c.useEffect(()=>{const S=E.current;if(S)return S.__cairnDiffKernel={current:pe,set:xe},()=>{S&&delete S.__cairnDiffKernel}},[pe,xe]);const[q,ve]=c.useState(o);c.useEffect(()=>{ve(o)},[o]);const be=c.useCallback(S=>{ve(S),v==null||v(S)},[v]),[W,J]=c.useState(d);c.useEffect(()=>{J(d)},[d]);const[ge,Me]=c.useState(0),[he,F]=c.useState(0),U=c.useMemo(()=>{const O=[{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...f?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...Kn().map(I=>({id:I.id,label:I.label}))],value:q==="diff"?pe:q==="split"?"slide":"blend",onSelect:I=>{I==="side"?f==null||f():I==="slide"?be("split"):I==="blend"?be("blend"):(be("diff"),xe(I))}}}];return q==="diff"&&O.push(Bt(W,I=>J(I))),O},[q,pe,W,xe,be,f]),$=c.useRef(null),G=c.useRef(null),Y=c.useRef(null),j=c.useRef(null),[ye,k]=c.useState(0),N=c.useRef(null),[Z,ne]=c.useState(0),K=At();c.useEffect(()=>{const S=M.current;if(!S)return;let se=!1;return nt().then(z=>{if(!se)try{if(xn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const O=z.createSurface(S,{hdr:!1});A.current={device:z,surface:O,texA:null,texB:null},P(!0)}catch(O){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",O),B(!0)}}).catch(z=>{se||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",z),B(!0))}),()=>{var O,I;se=!0;const z=A.current;z&&((O=z.texA)==null||O.destroy(),(I=z.texB)==null||I.destroy(),A.current=null)}},[]),c.useEffect(()=>{const S=E.current;if(!S)return;const se=new ResizeObserver(()=>te(z=>z+1));return se.observe(S),()=>se.disconnect()},[]),c.useEffect(()=>{if(!R)return;let S=!1;if(!A.current)return;async function z(O,I){if(I){const ie=Fs(I);return{width:I.width,height:I.height,imageData:null,make:re=>{const Pe=re.createTexture(I.width,I.height,"rgba32float");return Pe.write(ie),Pe}}}if(!O)return null;const ae=await He(O);return ae?{width:ae.width,height:ae.height,imageData:ae,make:ie=>{const re=ie.createTexture(ae.width,ae.height,"rgba8unorm");return re.write(ae.data),re}}:null}return Promise.all([z(e,n),z(t,r)]).then(([O,I])=>{var re,Pe;if(S||!A.current)return;const ae=A.current;$.current=(O==null?void 0:O.imageData)??null,G.current=(I==null?void 0:I.imageData)??null,Y.current=n??null,j.current=r??null,(re=ae.texA)==null||re.destroy(),(Pe=ae.texB)==null||Pe.destroy(),ae.texA=null,ae.texB=null;const ie=O??I;if(!ie){C(null),k(ke=>ke+1);return}ae.texA=(I??ie).make(ae.device),ae.texB=(O??ie).make(ae.device),C({w:ie.width,h:ie.height}),k(ke=>ke+1),H(ke=>ke+1)}),()=>{S=!0}},[R,e,t,n,r]);const ee=n!=null||r!=null,ce=c.useMemo(()=>ls(pe,ee),[pe,ee]),Te=c.useMemo(()=>{if(!ee)return null;const S=r??n;return S?Os(S.data,S.width,S.height,S.channels):null},[ee,r,n]),de=c.useMemo(()=>{var S;return us(((S=je(ce))==null?void 0:S.displayRange)??"unit",W==="none"?null:W)},[ce,W]),Ie=c.useMemo(()=>W!=="none"?Gs(W):void 0,[W]),Ee=c.useCallback(()=>{const S=A.current;if(!R||!S||!S.surface||!S.texA||!S.texB||!y)return;const se=E.current,z=se?se.getBoundingClientRect():{width:y.w,height:y.h},O=In({zoom:m,pan:p},z,y.w,y.h);Ce(re=>re.x===O.x&&re.y===O.y&&re.w===O.w&&re.h===O.h?re:O);const I=M.current;if(z.width>0&&z.height>0&&I&&S.surface){const re=Math.max(1,Math.round(z.width*K)),Pe=Math.max(1,Math.round(z.height*K));(I.width!==re||I.height!==Pe)&&(I.width=re,I.height=Pe,S.surface.configure(re,Pe))}const ae=On(O,z,y.w,y.h)>=kt?"nearest":"linear",ie=O;try{if(q==="diff"){const re=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Pe=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ke=je(ce)?ce:"absolute",et=ke==="hdr-flip"&&Te?{ppd:67,startExposure:Te.startExposure,stopExposure:Te.stopExposure,numExposures:Te.numExposures}:void 0,Qe=bs(S.device,S.texA,S.texB,ke,et,re,Pe);L.current=Qe,Ss(S.device,S.surface,Qe.texture,Qe.displayRange,{uv:ie,cmapMode:de,colormap:Ie,filter:ae,exposureEV:ge,offset:he})}else{const re={exposureEV:ge,offset:he,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ie,filter:ae,mode:q,split:a,alpha:s};no(S.device,S.surface,S.texA,S.texB,re)}}catch(re){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",re),B(!0)}},[R,y,m,p.x,p.y,q,a,s,ge,he,pe,ce,Te,de,Ie,e,t,n,r,K]);c.useEffect(()=>{Ee()},[Ee,D,ue]);const De=t!=null||r!=null;c.useEffect(()=>{const S=A.current;if(!R||!S||!S.texA||!S.texB||!De){we(null);return}let se=!1;const z=S.texA,O=S.texB,I=L.current;return(q==="diff"&&I?ws(S.device,I,z,O):mn(S.device,z,O)).then(ie=>{se||we(ie)}),()=>{se=!0}},[R,D,De,q,pe]),c.useEffect(()=>{if(q!=="diff"){N.current=null;return}const S=A.current,se=L.current;if(!R||!S||!se)return;let z=!1;return N.current=null,ne(O=>O+1),ys(S.device,se).then(O=>{z||(N.current=O,ne(I=>I+1))}).catch(()=>{}),()=>{z=!0}},[R,q,ce,D]);const Ye=(S,se)=>(z,O,I)=>{const ae=se.current;if(ae){const{data:ft,width:tr,height:Ks,channels:nr}=ae;if(z<0||O<0||z>=tr||O>=Ks)return null;const pt=(O*tr+z)*nr,rr=.5;return nr===1?{lines:[Q(ft[pt]??0,"unit",I)],luminance:rr}:{lines:[Q(ft[pt]??0,"unit",I),Q(ft[pt+1]??0,"unit",I),Q(ft[pt+2]??0,"unit",I)],luminance:rr,colors:[fe[0],fe[1],fe[2]]}}const ie=S.current;if(!ie||z<0||O<0||z>=ie.width||O>=ie.height)return null;const re=(O*ie.width+z)*4,Pe=ie.data[re],ke=ie.data[re+1],et=ie.data[re+2],Qe=(.299*Pe+.587*ke+.114*et)/255;return Pe===ke&&ke===et?{lines:[Q(Pe,"uint8",I)],luminance:Qe}:{lines:[Q(Pe,"uint8",I),Q(ke,"uint8",I),Q(et,"uint8",I)],luminance:Qe,colors:[fe[0],fe[1],fe[2]]}},Ke=c.useMemo(()=>Ye($,Y),[]),Ve=c.useMemo(()=>Ye(G,j),[]),Xs=c.useMemo(()=>(S,se,z)=>{var ke;const O=N.current;if(!O||!y)return null;const{w:I,h:ae}=y;if(S<0||se<0||S>=I||se>=ae)return null;const ie=(se*I+S)*4,re=((ke=je(ce))==null?void 0:ke.output)??"per-channel",Pe=.5;return re==="scalar"?{lines:[Q(O[ie]??0,"unit",z)],luminance:Pe}:{lines:[Q(O[ie]??0,"unit",z),Q(O[ie+1]??0,"unit",z),Q(O[ie+2]??0,"unit",z)],luminance:Pe,colors:[fe[0],fe[1],fe[2]]}},[y,ce]),Ws=h==="auto"?void 0:h;if(V)return n!=null||r!=null?i.jsx(Us,{}):q==="diff"?i.jsx(Nt,{imageUrl:e,baselineUrl:t,diffMode:((er=je(ce))==null?void 0:er.kind)==="pointwise"?ce:"absolute",interpolation:h,colormap:W,showAxes:!1,zoom:m,pan:p,onViewportChange:b,label:w,pixelValueNotation:T}):i.jsx(Ns,{imageUrl:e,baselineUrl:t,mode:q,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,zoom:m,pan:p,onViewportChange:b,interpolation:h,label:w,pixelValueNotation:T});const Ys=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:M,className:"w-full h-full block",style:{imageRendering:Ws},"data-gpu-compare-canvas":!0}),q==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:S=>{S.stopPropagation(),l==null||l(.5)},onPointerDown:S=>{S.stopPropagation(),S.preventDefault();const z=S.currentTarget.parentElement.getBoundingClientRect(),O=ae=>{l==null||l(Math.max(0,Math.min(1,(ae.clientX-z.left)/z.width)))},I=()=>{window.removeEventListener("pointermove",O),window.removeEventListener("pointerup",I)};window.addEventListener("pointermove",O),window.addEventListener("pointerup",I)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(it,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":R},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:E,wrapperRef:_,zoom:m,pan:p,onViewportChange:b,naturalDims:y,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Ys,showAxes:!1,notationSeed:T,exportCanvasRef:M,requestRender:Ee,leadingMenus:U,displayAdjust:{exposureEV:ge,offset:he,onExposureChange:Me,onOffsetChange:F},label:"",showLabelChip:!1,overlay:{render:({notation:S,setOverlayActive:se})=>q==="split"?i.jsxs(i.Fragment,{children:[De&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:M,naturalWidth:y.w,naturalHeight:y.h,zoom:m,pan:p,sourceWindow:_e,sample:Ve,notation:S,version:ye})}),De&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(Ze,{imageElRef:M,naturalWidth:y.w,naturalHeight:y.h,zoom:m,pan:p,sourceWindow:_e,sample:Ke,notation:S,version:ye,onActiveChange:se})})]}):y&&i.jsx(Ze,{imageElRef:M,naturalWidth:y.w,naturalHeight:y.h,zoom:m,pan:p,sourceWindow:_e,sample:q==="diff"?Xs:Ke,notation:S,version:q==="diff"?Z:ye,onActiveChange:se})},extraChips:i.jsxs(i.Fragment,{children:[q==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),w?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:w}):null,me&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${w?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",me.mse.toExponential(2)," · PSNR ",Number.isFinite(me.psnr)?me.psnr.toFixed(1):"∞"," dB · MAE"," ",me.mae.toExponential(2)]})]})})}const zs="cairn-plot:gpu-image-ready";async function $s(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await nt(),window.__cairnPlotGpuImagePane=zo,window.__cairnPlotGpuComparePane=Vs,window.__cairnPlotDiffMenuModes=Kn(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(zs))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}$s()})(__cairnPlotJsxRuntime,__cairnPlotReact);
