var Qs=Object.defineProperty;var js=(i,c,$e)=>c in i?Qs(i,c,{enumerable:!0,configurable:!0,writable:!0,value:$e}):i[c]=$e;var oe=(i,c,$e)=>js(i,typeof c!="symbol"?c+"":c,$e);(function(i,c){"use strict";const $e=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function $t(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:$e}),{hdr:!1,format:n}}function ar(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:$e}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:$e}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return $t(e,t)}}}const ir=`
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
`;function ht(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Xt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function cr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const lr={texture:0,sampler:1,uniform:2};function gt(e,t){return e*3+lr[t]}const ur={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function dr(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const u=ur[s];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Wt{constructor(t,n,r,o){oe(this,"width");oe(this,"height");oe(this,"format");oe(this,"gpuTexture");oe(this,"device");oe(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:ht(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Xt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Yt{constructor(t){oe(this,"_s");oe(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class fr{constructor(t,n,r,o,a){oe(this,"_p");oe(this,"gpuPipeline");oe(this,"bindings");oe(this,"bindGroupLayout");oe(this,"variants");oe(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function pr(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class hr{constructor(t){oe(this,"_c");oe(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class gr{constructor(t,n){oe(this,"_b");oe(this,"gpuBindGroup");oe(this,"ownedBuffers");oe(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class mr{constructor(t,n,r,o){oe(this,"canvas");oe(this,"hdr");oe(this,"format");oe(this,"context");oe(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function tt(e){return"canvas"in e}async function xr(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(f){return tt(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function s(f){if(tt(f))return{width:f.canvas.width,height:f.canvas.height};const v=f;return{width:v.width,height:v.height}}let u=!1;const l=256;let d=null,p=null;function g(){if(!d||!p){const f=t.createShaderModule({code:ir});p=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const v=t.createPipelineLayout({bindGroupLayouts:[p]});d=t.createComputePipeline({layout:v,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:d,layout:p}}return{backend:"webgpu",capabilities:n,createTexture(f,v,h){return new Wt(t,f,v,h)},createSampler(f){const v=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",h=t.createSampler({magFilter:v,minFilter:v,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Yt(h)},createRenderPipeline(f){const v=t.createShaderModule({code:f.shaderWGSL}),h=dr(f.shaderWGSL),b=ht(f.targetFormat),m=pr(t,h),w=t.createPipelineLayout({bindGroupLayouts:[m]}),M=T=>t.createRenderPipeline({layout:w,vertex:{module:v,entryPoint:"vs_main"},fragment:{module:v,entryPoint:"fs_main",targets:[{format:T}]},primitive:{topology:"triangle-list"}}),_=M(b);return new fr(_,h,m,b,M)},createComputePipeline(f){const v=t.createShaderModule({code:f.shaderWGSL}),h=t.createComputePipeline({layout:"auto",compute:{module:v,entryPoint:"cs_main"}});return new hr(h)},createBindGroup(f,v){const h=f,b=new Map,m=[];for(const[M,_]of h.bindings)if(_.kind==="uniform"){const T=t.createBuffer({size:_.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});m.push(T),b.set(M,{binding:M,resource:{buffer:T}})}else _.kind==="sampler"&&b.set(M,{binding:M,resource:o()});for(const M of v){const _=M.resource;if(_ instanceof Wt){const T=gt(M.binding,"texture");h.bindings.has(T)&&b.set(T,{binding:T,resource:_.gpuTexture.createView()})}else if(_ instanceof Yt){const T=gt(M.binding,"sampler");h.bindings.has(T)&&b.set(T,{binding:T,resource:_.gpuSampler})}else{const T=gt(M.binding,"uniform"),E=h.bindings.get(T);if(E&&E.kind==="uniform"){const C=_.uniform,L=t.createBuffer({size:Math.max(E.sizeBytes,C.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(L,0,C.buffer,C.byteOffset,C.byteLength),m.push(L),b.set(T,{binding:T,resource:{buffer:L}})}}}const w=t.createBindGroup({layout:h.bindGroupLayout,entries:Array.from(b.values())});return new gr(w,m)},createSurface(f,v){const h=f.getContext("webgpu");if(!h)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const b=v.hdr&&n.hdr,m=()=>b?ar(h,t):$t(h,t),w=m();return new mr(f,h,w,m)},renderFullscreen(f,v,h){const b=v,m=h,w=a(f),{width:M,height:_}=s(f),T=tt(f)?f.format:ht(f.format),E=b.pipelineFor(T),C=t.createCommandEncoder(),L=C.beginRenderPass({colorAttachments:[{view:w,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});L.setPipeline(E),L.setBindGroup(0,m.gpuBindGroup),L.setViewport(0,0,M,_,0,1),L.draw(3),L.end(),t.queue.submit([C.finish()])},async readback(f){const v=tt(f),{width:h,height:b}=s(f),m=v?f.hdr?"rgba16float":"rgba8unorm":f.format,w=v&&f.format==="bgra8unorm",M=v?f.getCurrentGPUTexture():f.gpuTexture,_=Xt(m),T=h*_,E=256,C=Math.ceil(T/E)*E,L=C*b,B=t.createBuffer({size:L,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),F=t.createCommandEncoder();F.copyTextureToBuffer({texture:M},{buffer:B,bytesPerRow:C,rowsPerImage:b},{width:h,height:b,depthOrArrayLayers:1}),t.queue.submit([F.finish()]),await B.mapAsync(GPUMapMode.READ);const k=new Uint8Array(B.getMappedRange()),P=new Uint8Array(T*b);for(let y=0;y<b;y++){const A=y*C,D=y*T;P.set(k.subarray(A,A+T),D)}if(B.unmap(),B.destroy(),m==="rgba8unorm"){if(w)for(let y=0;y<P.length;y+=4){const A=P[y],D=P[y+2];P[y]=D,P[y+2]=A}return P}if(m==="rgba16float"){const y=new Uint16Array(P.buffer,P.byteOffset,P.byteLength/2),A=new Float32Array(y.length);for(let D=0;D<y.length;D++)A[D]=cr(y[D]);return A}return new Float32Array(P.buffer,P.byteOffset,P.byteLength/4)},async reduceDiffSumSquaredAbs(f,v,h,b){const m=f,w=v,M=Math.max(0,h*b),_=Math.max(1,Math.ceil(M/l)),{pipeline:T,layout:E}=g(),C=_*2*4,L=t.createBuffer({size:C,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),B=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,new Uint32Array([Math.max(1,h),Math.max(1,b),M,0]));const F=t.createBindGroup({layout:E,entries:[{binding:0,resource:m.gpuTexture.createView()},{binding:1,resource:w.gpuTexture.createView()},{binding:2,resource:{buffer:L}},{binding:3,resource:{buffer:B}}]}),k=t.createBuffer({size:C,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),P=t.createCommandEncoder(),y=P.beginComputePass();y.setPipeline(T),y.setBindGroup(0,F),y.dispatchWorkgroups(_),y.end(),P.copyBufferToBuffer(L,0,k,0,C),t.queue.submit([P.finish()]),await k.mapAsync(GPUMapMode.READ);const D=new Float32Array(k.getMappedRange()).slice();k.unmap(),k.destroy(),L.destroy(),B.destroy();let W=0,pe=0;for(let Q=0;Q<_;Q++)W+=D[Q*2],pe+=D[Q*2+1];return{sumSq:W,sumAbs:pe}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let mt=null;async function vr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return xr()}function nt(){return mt||(mt=vr()),mt}function br(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function wr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),u=o-a,[l,d,p]=br(e[a],e[s],u);t[n*3]=Math.round(l),t[n*3+1]=Math.round(d),t[n*3+2]=Math.round(p)}return t}const Kt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},xt=new Set(["red-green","red-blue"]),Ht=new Map;function vt(e){let t=Ht.get(e);if(!t){const n=Kt[e]??Kt.viridis;t=wr(n),Ht.set(e,t)}return t}function bt(e,t,n="linear",r=0,o=0){const a=vt(t),s=new ImageData(e.width,e.height),u=e.data,l=s.data,d=Math.pow(2,r),p=r!==0||o!==0;for(let g=0;g<u.length;g+=4){let x=(u[g]+u[g+1]+u[g+2])/3;p&&(x=Math.max(0,Math.min(255,(x/255*d+o)*255)));let f;n==="positive"?f=Math.round(128+x/255*127):f=Math.round(x),f=Math.max(0,Math.min(255,f)),l[g]=a[f*3],l[g+1]=a[f*3+1],l[g+2]=a[f*3+2],l[g+3]=u[g+3]}return s}function qt(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Zt=qt(50);function wt(e){return Zt.get(e)}function yt(e,t){Zt.set(e,t)}const Qt=qt(100);function yr(e){return Qt.get(e)}function Er(e,t){Qt.set(e,t)}function _r(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let u=0;u<r;u++){const l=(s*e.width+u)*4,d=(s*t.width+u)*4,p=(s*r+u)*4;for(let g=0;g<3;g++){const x=e.data[l+g],f=t.data[d+g],v=x-f,h=Math.abs(v),b=Math.max(x,1);let m;switch(n){case"signed":m=(v+255)/2;break;case"absolute":m=h;break;case"squared":m=v*v/255;break;case"relative_signed":m=(v/b+1)*127.5;break;case"relative_absolute":m=h/b*255;break;case"relative_squared":m=v*v/(b*b)*255;break}a.data[p+g]=Math.min(255,Math.max(0,Math.round(m)))}a.data[p+3]=255}return a}async function He(e){const t=yr(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Er(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Mr={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Tr={linear:0,signed:1,positive:2},Pr=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Sr=`#version 300 es
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
}`;let qe=null,Y=null,Le=null,rt=null;function Cr(){if(Y)return Y;try{if(typeof OffscreenCanvas<"u"?qe=new OffscreenCanvas(1,1):qe=document.createElement("canvas"),Y=qe.getContext("webgl2",{preserveDrawingBuffer:!0}),!Y)return console.warn("[cairn] WebGL 2 not available"),null;const e=Y.createShader(Y.VERTEX_SHADER);if(Y.shaderSource(e,Pr),Y.compileShader(e),!Y.getShaderParameter(e,Y.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Y.getShaderInfoLog(e)),null;const t=Y.createShader(Y.FRAGMENT_SHADER);if(Y.shaderSource(t,Sr),Y.compileShader(t),!Y.getShaderParameter(t,Y.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Y.getShaderInfoLog(t)),null;if(Le=Y.createProgram(),Y.attachShader(Le,e),Y.attachShader(Le,t),Y.linkProgram(Le),!Y.getProgramParameter(Le,Y.LINK_STATUS))return console.error("[cairn] WebGL program link:",Y.getProgramInfoLog(Le)),null;rt=Y.createVertexArray(),Y.bindVertexArray(rt);const n=Y.createBuffer();Y.bindBuffer(Y.ARRAY_BUFFER,n),Y.bufferData(Y.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Y.STATIC_DRAW);const r=Y.getAttribLocation(Le,"a_pos");return Y.enableVertexAttribArray(r),Y.vertexAttribPointer(r,2,Y.FLOAT,!1,0,0),Y.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Y}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function jt(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Ar(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function kr(e,t,n,r){const o=Cr();if(!o||!Le||!rt||!qe)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);qe.width=a,qe.height=s,o.viewport(0,0,a,s);const u=jt(o,e,0),l=jt(o,t,1);let d=null;n.colormap?d=Ar(o,n.colormap,2):(d=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,d),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Le),o.uniform1i(o.getUniformLocation(Le,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Le,"u_other"),1),o.uniform1i(o.getUniformLocation(Le,"u_lut"),2),o.uniform1i(o.getUniformLocation(Le,"u_diff_mode"),Mr[n.diffMode]),o.uniform1i(o.getUniformLocation(Le,"u_cmap_mode"),Tr[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Le,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(rt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(qe,0,0,a,s,0,-s,a,s),p.restore()),o.deleteTexture(u),o.deleteTexture(l),o.deleteTexture(d),{width:a,height:s}}const Rr="cairn:render-mode";function Lr(){try{const e=localStorage.getItem(Rr);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Be=e=>e<0?0:e>1?1:e,Et=e=>{const t=e<0?0:e;return t/(1+t)},_t=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Be(n/r)},Jt={linear:([e,t,n])=>[Be(e),Be(t),Be(n)],srgb:([e,t,n])=>[Be(e),Be(t),Be(n)],reinhard:([e,t,n])=>[Et(e),Et(t),Et(n)],aces:([e,t,n])=>[_t(e),_t(t),_t(n)],extended:([e,t,n])=>[e,t,n]},Dr="srgb";function Ir(e){return e&&Jt[e]||Jt[Dr]}function Mt(e,t,n){return e*2**t+n}function Or(e){const t=Be(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Tt(e,t){return typeof t=="number"&&t>0?Be(Math.pow(Be(e),1/t)):Or(e)}const Ne=new Uint32Array(512),Ue=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ne[e]=0,Ne[e|256]=32768,Ue[e]=24,Ue[e|256]=24):t<-14?(Ne[e]=1024>>-t-14,Ne[e|256]=1024>>-t-14|32768,Ue[e]=-t-1,Ue[e|256]=-t-1):t<=15?(Ne[e]=t+15<<10,Ne[e|256]=t+15<<10|32768,Ue[e]=13,Ue[e|256]=13):t<128?(Ne[e]=31744,Ne[e|256]=64512,Ue[e]=24,Ue[e|256]=24):(Ne[e]=31744,Ne[e|256]=64512,Ue[e]=13,Ue[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Je=Uint8Array,en=Uint16Array,Br=Int32Array,Nr=new Je([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Ur=new Je([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),tn=function(e,t){for(var n=new en(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Br(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},nn=tn(Nr,2),Gr=nn.b,Fr=nn.r;Gr[28]=258,Fr[258]=28,tn(Ur,0);for(var Vr=new en(32768),de=0;de<32768;++de){var Xe=(de&43690)>>1|(de&21845)<<1;Xe=(Xe&52428)>>2|(Xe&13107)<<2,Xe=(Xe&61680)>>4|(Xe&3855)<<4,Vr[de]=((Xe&65280)>>8|(Xe&255)<<8)>>1}for(var ot=new Je(288),de=0;de<144;++de)ot[de]=8;for(var de=144;de<256;++de)ot[de]=9;for(var de=256;de<280;++de)ot[de]=7;for(var de=280;de<288;++de)ot[de]=8;for(var zr=new Je(32),de=0;de<32;++de)zr[de]=5;var $r=new Je(0),Xr=typeof TextDecoder<"u"&&new TextDecoder,Wr=0;try{Xr.decode($r,{stream:!0}),Wr=1}catch{}const rn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Pt(e){const t=rn.length;return rn[(e%t+t)%t]}function Yr(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),u=c.useRef(null),l=c.useCallback((d,p)=>{o(g=>g.w===d&&g.h===p?g:{w:d,h:p})},[]);return c.useLayoutEffect(()=>{const d=n.current;if(!d||d===u.current)return;const p=d.getBoundingClientRect();(p.width>0||p.height>0)&&(u.current=d,l(p.width,p.height))}),c.useEffect(()=>{var g;const d=n.current;if(d===s.current||((g=a.current)==null||g.disconnect(),a.current=null,s.current=d,!d))return;const p=new ResizeObserver(x=>{for(const f of x)l(f.contentRect.width,f.contentRect.height)});a.current=p,p.observe(d)}),c.useEffect(()=>()=>{var d;return(d=a.current)==null?void 0:d.disconnect()},[]),{ref:n,size:r}}function Kr(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Hr=.25,St=64;function on(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return St;const o=Math.min(n/e,r/t);return o<=0?St:Math.max(Math.max(n,r)/o,8)}function sn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=Hr,maxZoom:s=St,naturalWidth:u,naturalHeight:l}=e,d=Kr(),p=c.useRef(d);p.current=d;const g=c.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const x=c.useRef(o);x.current=o,c.useEffect(()=>{const w=t.current;if(!w||!o)return;const M=_=>{var A;if(!p.current)return;_.preventDefault(),_.stopPropagation();const T=_.deltaY<0?1.1:1/1.1,E=g.current,C=w.getBoundingClientRect(),L=u&&l?on(u,l,C.width,C.height):s,B=Math.max(a,Math.min(L,E.zoom*T));if(E.zoom===B)return;const F=_.clientX-C.left,k=_.clientY-C.top,P=F-(F-E.pan.x)/E.zoom*B,y=k-(k-E.pan.y)/E.zoom*B;(A=x.current)==null||A.call(x,{zoom:B,pan:{x:P,y}})};return w.addEventListener("wheel",M,{passive:!1}),()=>w.removeEventListener("wheel",M)},[t,!!o,a,s,u,l]);const f=c.useRef(null),v=c.useCallback(w=>{!p.current||!x.current||(w.currentTarget.setPointerCapture(w.pointerId),f.current={pointerId:w.pointerId,startX:w.clientX,startY:w.clientY,panX:g.current.pan.x,panY:g.current.pan.y})},[]),h=c.useCallback(w=>{var E;const M=f.current;if(!M||M.pointerId!==w.pointerId)return;const _=w.clientX-M.startX,T=w.clientY-M.startY;(E=x.current)==null||E.call(x,{zoom:g.current.zoom,pan:{x:M.panX+_,y:M.panY+T}})},[]),b=c.useCallback(w=>{const M=f.current;if(!(!M||M.pointerId!==w.pointerId)){try{w.currentTarget.releasePointerCapture(w.pointerId)}catch{}f.current=null}},[]),m=d&&!!o;return{containerProps:{onPointerDown:v,onPointerMove:h,onPointerUp:b,onPointerCancel:b,style:{cursor:m?"move":void 0,touchAction:m?"none":void 0}},modifierActive:d}}function Ct(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function qr(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function an(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function At({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=Yr(),s=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),l=c.useMemo(()=>{const h=a.w,b=a.h;if(h<=0||b<=0||n<=0||r<=0)return null;const m=Math.min(h/n,b/r),w=n*m,M=r*m;return{left:(h-w)/2,top:(b-M)/2,width:w,height:M}},[a.w,a.h,n,r]),d=e.masks,p=t.showMasks&&!!d&&d.length>0,g=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!p||!d)return;const h=s.current;if(!h)return;(h.width!==n||h.height!==r)&&(h.width=n,h.height=r);const b=h.getContext("2d");if(!b)return;b.clearRect(0,0,h.width,h.height);let m=!1;const w=b.createImageData(n,r),M=w.data;let _=d.length,T=!1;const E=()=>{m||T&&b.putImageData(w,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const L=C.getContext("2d",{willReadFrequently:!0});for(const B of d){const F=new Image;F.onload=()=>{if(!m){if(L){L.clearRect(0,0,n,r),L.drawImage(F,0,0,n,r);const k=L.getImageData(0,0,n,r).data;for(let P=0;P<n*r;P++){const y=k[P*4];if(y===0||u.has(y))continue;const[A,D,W]=qr(Pt(y));M[P*4]=A,M[P*4+1]=D,M[P*4+2]=W,M[P*4+3]=255,T=!0}}_-=1,_===0&&E()}},F.onerror=()=>{_-=1,_===0&&E()},F.src=`data:image/png;base64,${B.png_b64}`}return()=>{m=!0}},[p,d,n,r,g]),!l)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const x=e.boxes??[],f=t.showBoxes&&x.length>0,v=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),f&&i.jsx("svg",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:x.map((h,b)=>{if(!an(h,t,u))return null;const m=h.domain==="pixel"?1:n,w=h.domain==="pixel"?1:r,M=h.position.minX*m,_=h.position.minY*w,T=(h.position.maxX-h.position.minX)*m,E=(h.position.maxY-h.position.minY)*w;return i.jsx("rect",{x:M,y:_,width:T,height:E,fill:"none",stroke:Pt(h.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),f&&i.jsx("div",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height},children:x.map((h,b)=>{if(!an(h,t,u))return null;const m=h.domain==="pixel"?1/n:1,w=h.domain==="pixel"?1/r:1,M=h.position.minX*m*100,_=h.position.minY*w*100,T=h.label??v[String(h.class_id)]??`#${h.class_id}`,E=h.score!=null?` ${(h.score*100).toFixed(0)}%`:"";return!T&&!E?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${M}%`,top:`${_}%`,transform:"translateY(-100%)",backgroundColor:Pt(h.class_id)},children:i.jsxs("span",{className:"mono",children:[T,E]})},b)})})]})}const kt=30,fe=["#ff5a5a","#39d353","#5b9bff"];function Rt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function j(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Rt(e/255):Rt(n==="int"?e*255:e)}const Zr={x:0,y:0,w:1,h:1};function Ze({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:u=0,onActiveChange:l,sourceWindow:d=Zr}){const p=c.useRef(null),g=c.useRef(!1),x=Ct(),f=c.useRef(l);f.current=l;const v=c.useCallback(b=>{var m;b!==g.current&&(g.current=b,(m=f.current)==null||m.call(f,b))},[]),h=c.useCallback(()=>{var J;const b=p.current,m=e.current;if(!b)return;const w=window.devicePixelRatio||1,M=b.clientWidth,_=b.clientHeight;if(M===0||_===0)return;b.width!==Math.round(M*w)&&(b.width=Math.round(M*w)),b.height!==Math.round(_*w)&&(b.height=Math.round(_*w));const T=b.getContext("2d");if(!T)return;if(T.setTransform(w,0,0,w,0,0),T.clearRect(0,0,M,_),!m||t<=0||n<=0){v(!1);return}const E=m.getBoundingClientRect(),C=b.getBoundingClientRect();if(E.width===0||E.height===0){v(!1);return}const L=d.x*t,B=d.y*n,F=d.w*t,k=d.h*n;if(F<=0||k<=0){v(!1);return}const P=Math.min(E.width/F,E.height/k);if(P<kt){v(!1);return}const y=F*P,A=k*P,D=E.left+(E.width-y)/2-C.left,W=E.top+(E.height-A)/2-C.top,pe=Math.max(Math.floor(L),Math.floor(L+(0-D)/P)),Q=Math.min(Math.ceil(L+F),Math.ceil(L+(M-D)/P)),he=Math.max(Math.floor(B),Math.floor(B+(0-W)/P)),ye=Math.min(Math.ceil(B+k),Math.ceil(B+(_-W)/P));if(Q<=pe||ye<=he){v(!1);return}v(!0);const Ee=D+(0-L)*P,ke=W+(0-B)*P,De=D+(t-L)*P,ue=W+(n-B)*P;T.save(),T.beginPath(),T.rect(Ee,ke,De-Ee,ue-ke),T.clip(),T.textAlign="center",T.textBaseline="middle",T.lineJoin="round";const Se=P*.14,me=P-Se*2;for(let xe=he;xe<ye;xe++)for(let te=pe;te<Q;te++){if(te<0||xe<0||te>=t||xe>=n)continue;const X=a(te,xe,s);if(!X||X.lines.length===0)continue;const ee=X.lines.length;let ge=1;for(const R of X.lines)R.length>ge&&(ge=R.length);const _e=me/(ee*1.15),be=me/(ge*.62)||_e,N=Math.min(_e,be,24);if(N<6)continue;const U=D+(te-L+.5)*P,z=W+(xe-B+.5)*P,V=N*1.15,q=X.luminance<=.55,Z=q?"#ffffff":"#000000";T.font=`${N}px ui-monospace, SFMono-Regular, Menlo, monospace`,T.lineWidth=Math.max(1.4,N*.16),T.strokeStyle=q?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Me=z-ee*V/2+V/2;for(let R=0;R<X.lines.length;R++){const G=X.lines[R];T.strokeText(G,U,Me),T.fillStyle=((J=X.colors)==null?void 0:J[R])??Z,T.fillText(G,U,Me),Me+=V}}T.restore()},[e,t,n,a,s,v,d]);return c.useEffect(()=>{h()},[h,r,o.x,o.y,u,s,d,x]),c.useEffect(()=>{const b=p.current;if(!b)return;const m=new ResizeObserver(()=>h());return m.observe(b),()=>m.disconnect()},[h]),i.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function cn({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Qr=`
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
`,jr=`
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
${Ge}
${ln}
${jr}

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
`}const Jr=un("select(colorB, colorA, uv.x < split)"),eo=un("mix(colorA, colorB, alpha)"),Lt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},dn=new WeakMap;function to(e,t){let n=dn.get(e);n||(n=new Map,dn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Qr,targetFormat:t}),n.set(t,r)),r}function fn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function pn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function no(e,t,n,r){var h;const o=fn(t),a=to(e,o),s=pn(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,l=Lt[r.operator]??Lt.srgb,d=new Float32Array([r.exposureEV,l,u,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),x=new Float32Array([r.filter==="nearest"?0:1]),f=new Float32Array([r.offset??0]);let v;try{v=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:d}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:x}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,a,v)}finally{(h=v==null?void 0:v.destroy)==null||h.call(v),s.destroy()}}const hn=new WeakMap;function ro(e,t,n){let r=hn.get(e);r||(r=new Map,hn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?Jr:eo,targetFormat:n}),r.set(o,a)),a}function oo(e,t,n,r,o){var h;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=fn(t),s=ro(e,o.mode,a),u=pn(e,void 0),l=o.gamma,d=Lt[o.operator],p=new Float32Array([o.exposureEV,d,l,0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),x=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),f=new Float32Array([o.offset??0,0,0,0]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:x}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,s,v)}finally{(h=v==null?void 0:v.destroy)==null||h.call(v),u.destroy()}}function gn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function mn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:x,sumAbs:f}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return gn(x,f,a)}const s=await e.readback(t),u=await e.readback(n),l=s instanceof Uint8Array,d=u instanceof Uint8Array;let p=0,g=0;for(let x=0;x<o;x++)for(let f=0;f<r;f++){const v=(x*t.width+f)*4,h=(x*n.width+f)*4;for(let b=0;b<3;b++){const m=(s[v+b]??0)/(l?255:1),w=(u[h+b]??0)/(d?255:1),M=m-w;p+=M*M,g+=Math.abs(M)}}return gn(p,g,a)}function xn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const so=12,We=[];function vn(e){const t=We.indexOf(e);t!==-1&&We.splice(t,1),We.push(e)}function ao(e){const t=We.indexOf(e);t!==-1&&We.splice(t,1)}function at(e){e.parked||(ao(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function bn(e){for(;We.length>so;){const t=We.find(n=>n!==e&&!n.visible)??We.find(n=>n!==e);if(!t)break;at(t)}}function wn(e){var o,a;if(e.disposed)return;if(xn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){vn(e),bn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,vn(e),bn(e)}function io(e,t){if(e.disposed||!e.source)return!0;try{return wn(e),!e.surface||!e.srcTexture?!1:(no(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,at(e),!1}}function co(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return io(e,t)},park(){e.disposed||at(e)},restore(){e.disposed||!e.source||wn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(at(e),e.source=null,e.disposed=!0)}}}async function lo(e,t){const n=await nt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return co(r)}function yn(e){e.dispose()}function uo(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function En(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:u,flipSign:l}=e,d=c.useMemo(()=>uo(e,n),[n,r,o,s,l]);return{gammaFilterId:n,filterStr:d,gamma:a,offset:u}}function _n({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Mn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function fo({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Mn(e),a=Mn(t),s=[];for(let w=0;w<=e;w+=o)s.push(w);const u=[];for(let w=0;w<=t;w+=a)u.push(w);const l=1/n,d=8*l,p=-12*l,g=-2*l,x=r==null?void 0:r.current;let f=0,v=0,h=0,b=0;if(x){const w=x.clientWidth,M=x.clientHeight,_=w/e,T=M/t,E=Math.min(_,T);h=e*E,b=t*E,f=(w-h)/2,v=(M-b)/2}const m=x&&h>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?v:0,transform:`translateY(${p}px)`,fontSize:d},children:s.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",left:m?f+w/e*h:`${w/e*100}%`,transform:"translateX(-50%)"},children:w},w))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?f:0,transform:`translateX(${g}px)`,fontSize:d},children:u.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",top:m?v+w/t*b:`${w/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*l}px`},children:w},w))})]})}function po({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const ho=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Tn(e,t){const n=getComputedStyle(e),r=ho.map(l=>`${l}:${n.getPropertyValue(l)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,u=Math.min(a.length,s.length);for(let l=0;l<u;l++)Tn(a[l],s[l])}function Dt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function It(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Ot(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((u,l)=>a.toBlob(d=>d?u(d):l(new Error("plot-to-png: toBlob returned null")),"image/png"))}function go(e,t,n){const r=e.cloneNode(!0);Tn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,u)=>{const l=new Image;l.onload=()=>s(l),l.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),l.src=a})}async function Pn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Dt(e);return Ot(r,o,It(t),a,s=>s.drawImage(e,0,0,r,o))}async function mo(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Dt(e);try{return await Ot(r,o,It(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function xo(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function vo(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,u=(t==null?void 0:t.background)??Dt(e);if(n){const d=n.getBoundingClientRect(),p=await go(n,d.width||a,d.height||s);return Ot(a,s,It(t),u,g=>{for(const x of r){const f=x.getBoundingClientRect();g.drawImage(x,f.left-o.left,f.top-o.top,f.width,f.height)}g.drawImage(p,d.left-o.left,d.top-o.top,d.width,d.height)})}if(r.length)return Pn(r[0],t);const l=xo(e);if(l)return mo(l,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function bo(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const wo=8;function yo(e,t,n,r=wo){return!(t>0)||!(e>0)?n:e<t+r}function Sn(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}const Eo={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},_o={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function Fe({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:_o[e]??null})}function Cn({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(Fe,{name:e??""})})}function An(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Mo({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:a}=n,[s,u]=c.useState(!1),[l,d]=c.useState(0),p=c.useRef(null),g=Sn(r,o),x=e?void 0:((b=r[g])==null?void 0:b.label)??"",f=c.useCallback(()=>{u(m=>{const w=!m;return w&&d(g),w})},[g]),v=c.useCallback(m=>{a(m),u(!1)},[a]);c.useEffect(()=>{if(!s)return;const m=M=>{p.current&&!p.current.contains(M.target)&&u(!1)},w=M=>{M.key==="Escape"&&(M.stopPropagation(),u(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",w,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",w,!0)}},[s]);const h=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),d(g),u(!0));return}if(m.key==="ArrowDown")m.preventDefault(),d(w=>(w+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),d(w=>(w-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const w=r[l];w&&v(w.id)}};return i.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),f()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:h,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",x?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[x?i.jsx("span",{"aria-hidden":"true",children:x}):i.jsx(Fe,{name:e??""}),i.jsx(Fe,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,w)=>{const M=m.id===o,_=w===l;return i.jsx("li",{role:"option","aria-selected":M,children:i.jsx("button",{type:"button",onClick:T=>{T.stopPropagation(),v(m.id)},onPointerEnter:()=>d(w),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",_?"bg-bg-hover":"",M?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const To=e=>e.format?e.format(e.value):String(e.value);function kn({spec:e}){return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:t=>t.stopPropagation(),onDoubleClick:t=>{t.stopPropagation(),e.defaultValue!==void 0&&e.onChange(e.defaultValue)},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx(Fe,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:t=>e.onChange(Number(t.target.value)),onPointerDown:t=>t.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:To(e)})]})}function Po({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:a,onSelect:s}=n,[u,l]=c.useState(!1),d=Sn(o,a),p=((g=o[d])==null?void 0:g.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:x=>{x.stopPropagation(),l(f=>!f)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx(Fe,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),i.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:i.jsx(Fe,{name:"caret"})})]}),u&&o.map(x=>{const f=x.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":f,"data-menu-option":"",onClick:v=>{v.stopPropagation(),s(x.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",f?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:f?"✓":""}),i.jsx("span",{children:x.label})]},x.id)})]})}function So({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return c.useEffect(()=>{if(!r)return;const s=l=>{a.current&&!a.current.contains(l.target)&&o(!1)},u=l=>{l.key==="Escape"&&(l.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",u,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",u,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(u=>!u)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx(Fe,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(Po,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:u=>{var l;u.stopPropagation(),!s.disabled&&((l=s.onClick)==null||l.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Fe,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:u=>{u.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Fe,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(kn,{spec:s})},s.id))]})]})}function Co({controller:e,config:t}){var k,P;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),u=`${((k=t==null?void 0:t.leadingButtons)==null?void 0:k.length)??0}:${((P=t==null?void 0:t.sliders)==null?void 0:P.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const y=n.current,A=y==null?void 0:y.parentElement;if(!A)return;const D=()=>{const pe=A.clientWidth;if(!a.current&&n.current){const Q=n.current.scrollWidth;Q>0&&(s.current=Q)}o(yo(pe,s.current,a.current))},W=new ResizeObserver(D);return W.observe(A),D(),()=>W.disconnect()},[u]),(t==null?void 0:t.enabled)===!1)return null;const l=e.capabilities,d=t==null?void 0:t.buttons,p=(y,A)=>A&&(d==null?void 0:d[y])!==!1,g=y=>()=>e.setDragMode(y),x=()=>{e.toPNG({filename:"plot"}).then(y=>bo(y,"plot.png")).catch(()=>{})},f=[];p("zoom",l.zoom)&&f.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),p("pan",l.pan)&&f.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),p("select",l.select)&&f.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),p("lasso",l.lasso)&&f.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const v=[];p("zoomIn",l.zoom)&&v.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",l.zoom)&&v.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const h=[];p("autoscale",l.autoscale)&&h.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",l.reset)&&h.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const b=[];p("screenshot",l.screenshot)&&b.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:x});const m=[f,v,h,b].filter(y=>y.length>0),w=m.flat(),M=(t==null?void 0:t.leadingButtons)??[],_=(t==null?void 0:t.sliders)??[];if(!M.length&&w.length===0&&_.length===0)return null;const T=(t==null?void 0:t.position)??"top-right",E=(t==null?void 0:t.visibility)==="always",C=T==="top-right"||T==="bottom-right",B=["z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",E?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),F={position:"absolute",pointerEvents:"auto",...Eo[T]};return r?i.jsx("div",{ref:n,style:F,className:`${B} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(So,{actions:w,leading:M,sliders:_})}):i.jsxs("div",{ref:n,style:F,className:`${B} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[M.length>0&&i.jsxs(i.Fragment,{children:[M.map(y=>y.menu?i.jsx(Mo,{icon:y.icon,title:y.title,menu:y.menu},y.id):i.jsx(Cn,{icon:y.icon,label:y.label,title:y.title,active:y.active,disabled:y.disabled,onClick:y.onClick??(()=>{})},y.id)),m.length>0&&i.jsx(An,{})]}),m.map((y,A)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[A>0&&i.jsx(An,{}),y.map(D=>i.jsx(Cn,{icon:D.icon,title:D.title,active:D.active,disabled:D.disabled,onClick:D.onClick},D.id))]},y[0].id))]}),_.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:_.map(y=>i.jsx(kn,{spec:y},y.id))})]})}const Ao={zoom:1,pan:{x:0,y:0}},Rn=1.3,ko=.25,Ro=64,Lo={buttons:{zoom:!1}};function Do(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Io=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Bt(e,t){return{id:"colormap",title:"Colormap",menu:{options:Io,value:e,onSelect:t}}}function Oo({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:u=ko,maxZoom:l=Ro,requestRender:d,onReset:p,extraModified:g=!1}){const x=c.useCallback(E=>{var W;if(!o)return;const C=(W=e.current)==null?void 0:W.getBoundingClientRect(),L=(C==null?void 0:C.width)??0,B=(C==null?void 0:C.height)??0,F=a&&s&&L>0&&B>0?on(a,s,L,B):l,k=Math.max(u,Math.min(F,n*E));if(k===n)return;const P=L/2,y=B/2,A=P-(P-r.x)/n*k,D=y-(y-r.y)/n*k;o({zoom:k,pan:{x:A,y:D}})},[o,e,a,s,l,u,n,r.x,r.y]),f=c.useCallback(()=>x(Rn),[x]),v=c.useCallback(()=>x(1/Rn),[x]),h=c.useCallback(()=>{o==null||o(Ao),p==null||p()},[o,p]),b=c.useCallback(E=>{const C={scale:E==null?void 0:E.scale,filename:E==null?void 0:E.filename};d==null||d();const L=t==null?void 0:t.current;if(L)return Pn(L,C);const B=e.current;return B?vo(B,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,d]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),w=n!==1||r.x!==0||r.y!==0||g,M=c.useCallback(E=>{},[]),_=c.useCallback(E=>{},[]),T=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:w,setDragMode:M,setHoverMode:_,toggleSpikelines:T,zoomIn:f,zoomOut:v,autoscale:h,reset:h,toPNG:b}),[m,w,M,_,T,f,v,h,b])}const Bo={zoom:1,pan:{x:0,y:0}};function it({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:u,naturalDims:l,checkerboard:d,wrapperClassName:p,wrapperStyle:g,viewportPadding:x,header:f,surface:v,showAxes:h,overlayNode:b,overlay:m,notationSeed:w,exportCanvasRef:M,requestRender:_,leadingMenus:T,displayAdjust:E,onReset:C,extraModified:L,label:B,showLabelChip:F,isDraggable:k=!1,onDragStart:P,extraChips:y}){const[A,D]=c.useState(w),[W,pe]=c.useState(!1),{containerProps:Q}=sn({containerRef:r,zoom:a,pan:s,onViewportChange:u,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h}),he=c.useCallback(()=>{E==null||E.onExposureChange(0),E==null||E.onOffsetChange(0),C==null||C()},[E,C]),ye=c.useCallback(()=>{u==null||u(Bo),he()},[u,he]),Ee=Oo({rootRef:r,canvasRef:M,zoom:a,pan:s,onViewportChange:u,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h,requestRender:_,onReset:he,extraModified:((E==null?void 0:E.exposureEV)??0)!==0||((E==null?void 0:E.offset)??0)!==0||!!L}),ke=c.useMemo(()=>{if(!E)return;const xe=(te,X)=>`${te>=0?"+":"−"}${Math.abs(te).toFixed(X)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to reset.",min:-8,max:8,step:.1,value:E.exposureEV,onChange:E.onExposureChange,format:te=>xe(te,1),defaultValue:0},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to reset.",min:-1,max:1,step:.01,value:E.offset,onChange:E.onOffsetChange,format:te=>xe(te,2),defaultValue:0}]},[E]),De=c.useMemo(()=>({...Lo,leadingButtons:[...T??[],...W?[Do(A,D)]:[]],sliders:ke}),[W,A,T,ke]),ue=" cairn-checkerboard",Se="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(d==="pane"?ue:""),me=p+(d==="wrapper"?ue:""),J="render"in m?m.render({notation:A,setOverlayActive:pe}):m.hasSource&&l?i.jsx(Ze,{imageElRef:m.displayElRef,naturalWidth:l.w,naturalHeight:l.h,zoom:a,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:A,version:m.version,onActiveChange:pe}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[f,n&&i.jsx(Co,{controller:Ee,config:De}),i.jsxs("div",{ref:r,className:Se,style:{padding:x,...Q.style},onPointerDown:Q.onPointerDown,onPointerMove:Q.onPointerMove,onPointerUp:Q.onPointerUp,onPointerCancel:Q.onPointerCancel,onDoubleClick:ye,...t,children:[i.jsxs("div",{ref:o,className:me,style:g,children:[v,h&&l&&i.jsx(fo,{naturalWidth:l.w,naturalHeight:l.h,zoom:a,containerRef:o}),b]}),J,!n&&W&&i.jsx(cn,{notation:A,onChange:D})]}),F&&i.jsx(po,{label:B,isDraggable:k,onDragStart:P}),y]})}function Ln(e){return"hdr"in e&&e.hdr!=null}function Dn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Ae(e){return Number.isFinite(e)?e:0}const No={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Uo(e,t,n,r,o=0){const{h:a,w:s,c:u}=Dn(e.shape),l=e.data,d=Ir(t),p=new Uint8ClampedArray(s*a*4);for(let g=0;g<s*a;g++){const x=g*u;let f,v,h,b=1;u===1?f=v=h=Ae(l[x]):u===3?(f=Ae(l[x]),v=Ae(l[x+1]),h=Ae(l[x+2])):(f=Ae(l[x]),v=Ae(l[x+1]),h=Ae(l[x+2]),b=Ae(l[x+3]));const m=[Mt(f,n,o),Mt(v,n,o),Mt(h,n,o)],[w,M,_]=d(m),T=g*4;p[T]=255*Tt(w,r),p[T+1]=255*Tt(M,r),p[T+2]=255*Tt(_,r),p[T+3]=255*(b<0?0:b>1?1:b)}return new ImageData(p,s,a)}function Go(e){var Z,Me;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:u=!1,processing:l=No,zoom:d=1,pan:p={x:0,y:0},onViewportChange:g,onNaturalSize:x,label:f,isDraggable:v=!1,onDragStart:h,overlay:b,overlaySettings:m,pixelValueNotation:w="decimal",toolbar:M=!0}=e,[_,T]=c.useState(s);c.useEffect(()=>{T(s)},[s]);const E=c.useRef(null),C=c.useRef(null),L=c.useRef(null),B=c.useRef(null),F=c.useRef(null),k=c.useRef(null),P=c.useRef(null),[y,A]=c.useState(0),D=c.useCallback(()=>A(R=>R+1),[]),W=c.useMemo(()=>({get current(){const R=F.current;return R instanceof HTMLCanvasElement?R:null}}),[]),pe=c.useCallback(R=>{E.current=R,R&&(F.current=R)},[]),Q=c.useCallback(R=>{C.current=R,R&&(F.current=R)},[]),he=c.useCallback(R=>{R&&(F.current=R)},[]),[ye,Ee]=c.useState(!1),[ke,De]=c.useState(!1),[ue,Se]=c.useState(null),{flipSign:me}=l,{gammaFilterId:J,filterStr:xe,gamma:te,offset:X}=En(l),ee=!r&&o!=="none"&&n!=null&&t!=null,ge=o!=="none"&&n!=null,_e=_!=="none"&&!ee&&!(r&&ge)&&t!=null;c.useEffect(()=>{if(!_e||!t){De(!1);return}let R=!1;De(!1);const G=`${t}::${_}`,H=wt(G);if(H){const K=C.current;if(K){K.width=H.width,K.height=H.height;const se=K.getContext("2d");se&&se.putImageData(H,0,0),P.current=H,D(),Se({w:H.width,h:H.height}),x==null||x(H.width,H.height),De(!0)}return}const ne=new Image;return ne.onload=()=>{if(R)return;const K=document.createElement("canvas");K.width=ne.naturalWidth,K.height=ne.naturalHeight;const se=K.getContext("2d");if(!se)return;se.drawImage(ne,0,0);const Pe=se.getImageData(0,0,K.width,K.height),Ce=xt.has(_)?"positive":"linear",ae=bt(Pe,_,Ce);yt(G,ae);const we=C.current;if(!we||R)return;we.width=ae.width,we.height=ae.height;const ve=we.getContext("2d");ve&&ve.putImageData(ae,0,0),P.current=ae,D(),Se({w:ae.width,h:ae.height}),x==null||x(ae.width,ae.height),De(!0)},ne.src=t,()=>{R=!0}},[_e,t,_]);const be=c.useCallback((R,G)=>{Se(H=>H&&H.w===R&&H.h===G?H:{w:R,h:G}),x==null||x(R,G)},[]);c.useEffect(()=>{if(!t){k.current=null,P.current=null,D();return}let R=!1;return He(t).then(G=>{R||(k.current=G,_==="none"&&(P.current=G),D())}),()=>{R=!0}},[t,_,D]);const N=c.useCallback((R,G,H)=>{const ne=k.current;if(!ne||R<0||G<0||R>=ne.width||G>=ne.height)return null;const K=(G*ne.width+R)*4,se=ne.data[K],Pe=ne.data[K+1],Ce=ne.data[K+2],ae=P.current;let we=se,ve=Pe,Ie=Ce;if(ae&&ae.width===ne.width&&ae.height===ne.height){const Oe=(G*ae.width+R)*4;we=ae.data[Oe],ve=ae.data[Oe+1],Ie=ae.data[Oe+2]}const Ke=(.299*we+.587*ve+.114*Ie)/255;return _!=="none"||se===Pe&&Pe===Ce?{lines:[j(se,"uint8",H)],luminance:Ke}:{lines:[j(se,"uint8",H),j(Pe,"uint8",H),j(Ce,"uint8",H)],luminance:Ke,colors:[fe[0],fe[1],fe[2]]}},[_]);c.useEffect(()=>{if(!ee){Ee(!1);return}let R=!1;const G=Lr(),H=G==="gpu"||G==="auto",ne=`${n}::${t}::${o}::${_}`;if(G!=="gpu"){const K=wt(ne);if(K){const se=E.current;if(se){(se.width!==K.width||se.height!==K.height)&&(se.width=K.width,se.height=K.height);const Pe=se.getContext("2d");Pe&&Pe.putImageData(K,0,0),be(K.width,K.height),Ee(!0)}return}}return(async()=>{const[K,se]=await Promise.all([He(n),He(t)]);if(R||!K||!se)return;const Ce=o.includes("signed")?"signed":"positive",ae=_!=="none"?vt(_):null,we={diffMode:o,colormap:ae,cmapMode:Ce};if(H)try{const ze=E.current;if(ze){const Oe=kr(K,se,we,ze);if(Oe){if(R)return;be(Oe.width,Oe.height),Ee(!0);return}}}catch(ze){console.warn("[cairn] WebGL 2 diff error:",ze)}if(G==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let ve=_r(K,se,o);_!=="none"&&(ve=bt(ve,_,Ce)),yt(ne,ve);const Ie=E.current;if(!Ie||R)return;(Ie.width!==ve.width||Ie.height!==ve.height)&&(Ie.width=ve.width,Ie.height=ve.height);const Ke=Ie.getContext("2d");Ke&&Ke.putImageData(ve,0,0),be(ve.width,ve.height),Ee(!0)})(),()=>{R=!0}},[n,t,o,ee,_,x]);const U=a==="auto"?void 0:a,z=me?{filter:"invert(1)"}:{},V=b&&(m!=null&&m.enabled)&&ue&&t&&((((Z=b.boxes)==null?void 0:Z.length)??0)>0||(((Me=b.masks)==null?void 0:Me.length)??0)>0)?i.jsx(At,{data:b,settings:m,naturalWidth:ue.w,naturalHeight:ue.h}):void 0,q=t?ee?i.jsxs(i.Fragment,{children:[!ye&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:pe,className:"w-full h-full object-contain block",style:{display:ye?"block":"none",imageRendering:U,...z}})]}):_e?i.jsxs(i.Fragment,{children:[!ke&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:Q,className:"w-full h-full object-contain block",style:{display:ke?"block":"none",imageRendering:U,...z}})]}):i.jsx("img",{ref:he,src:t,alt:f,className:"w-full h-full object-contain block",draggable:!1,style:{filter:xe,imageRendering:U},onLoad:R=>{const G=R.currentTarget;Se({w:G.naturalWidth,h:G.naturalHeight}),x==null||x(G.naturalWidth,G.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(it,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:M,paneRef:L,wrapperRef:B,zoom:d,pan:p,onViewportChange:g,naturalDims:ue,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:u&&ue?"16px 4px 4px 28px":"4px",header:i.jsx(_n,{id:J,gamma:te,offset:X}),surface:q,showAxes:u,overlayNode:V,overlay:{displayElRef:F,sample:N,version:y,hasSource:!!t},notationSeed:w,exportCanvasRef:W,leadingMenus:[Bt(_,R=>T(R))],label:f,showLabelChip:!0,isDraggable:v,onDragStart:h})}function Fo(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:u="auto",zoom:l=1,pan:d={x:0,y:0},onViewportChange:p,pixelValueNotation:g="decimal",toolbar:x=!0}=e,f=c.useRef(null),v=c.useRef(null),h=c.useRef(null),[b,m]=c.useState(null),w=c.useRef(null),[M,_]=c.useState(0),[T,E]=c.useState(0),[C,L]=c.useState(0);c.useEffect(()=>{const k=f.current;if(!k)return;let P;try{P=Uo(t,n,r+T,o,C)}catch(A){console.error("[cairn] HDR tone-map error:",A);return}(k.width!==P.width||k.height!==P.height)&&(k.width=P.width,k.height=P.height);const y=k.getContext("2d");y&&(y.putImageData(P,0,0),w.current=P,_(A=>A+1),m(A=>A&&A.w===P.width&&A.h===P.height?A:{w:P.width,h:P.height}))},[t,n,r,o,T,C]);const B=c.useCallback((k,P,y)=>{const A=b;if(!A||k<0||P<0||k>=A.w||P>=A.h)return null;const D=t.shape.length===2?1:t.shape[2]??1,W=(P*A.w+k)*D,pe=t.data,Q=w.current;let he=.5;if(Q&&Q.width===A.w&&Q.height===A.h){const ye=(P*A.w+k)*4;he=(.299*Q.data[ye]+.587*Q.data[ye+1]+.114*Q.data[ye+2])/255}return D===1?{lines:[j(pe[W]??0,"unit",y)],luminance:he}:{lines:[j(pe[W]??0,"unit",y),j(pe[W+1]??0,"unit",y),j(pe[W+2]??0,"unit",y)],luminance:he,colors:[fe[0],fe[1],fe[2]]}},[t,b]),F=u==="auto"?void 0:u;return i.jsx(it,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:v,wrapperRef:h,zoom:l,pan:d,onViewportChange:p,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:a&&b?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:f,className:"w-full h-full object-contain block",style:{imageRendering:F}}),showAxes:a,overlay:{displayElRef:f,sample:B,version:M,hasSource:!0},notationSeed:g,exportCanvasRef:f,displayAdjust:{exposureEV:T,offset:C,onExposureChange:E,onOffsetChange:L},label:s,showLabelChip:!!s})}function Nt(e){return Ln(e)?i.jsx(Fo,{...e}):i.jsx(Go,{...e})}const Vo=["linear","srgb","reinhard","aces"];function zo(e){return e&&Vo.includes(e)?e:"srgb"}function $o(e){const{h:t,w:n,c:r}=Dn(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const u=s*r;let l,d,p,g=1;r===1?l=d=p=Ae(o[u]):r===3?(l=Ae(o[u]),d=Ae(o[u+1]),p=Ae(o[u+2])):(l=Ae(o[u]),d=Ae(o[u+1]),p=Ae(o[u+2]),g=Ae(o[u+3]));const x=s*4;a[x]=l,a[x+1]=d,a[x+2]=p,a[x+3]=g}return{data:a,width:n,height:t,format:"rgba32float"}}function In(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,u=(t.width-a)/2,l=(t.height-s)/2,d=Math.max(e.zoom,1e-6),p=t.width/(d*a),g=t.height/(d*s),x=-u/a-e.pan.x/(d*a),f=-l/s-e.pan.y/(d*s);return{x,y:f,w:p,h:g}}function On(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function Xo(e){var _e,be;const t=Ln(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(!1),[u,l]=c.useState(!1),[d,p]=c.useState(!1),[g,x]=c.useState(null),[f,v]=c.useState(0),[h,b]=c.useState(0),[m,w]=c.useState({x:0,y:0,w:1,h:1}),M=c.useRef(null),_=c.useRef(null),[T,E]=c.useState(0),C=e.zoom??1,L=e.pan??{x:0,y:0},B=e.onViewportChange,F=t?"none":e.colormap??"none",[k,P]=c.useState(F);c.useEffect(()=>{P(F)},[F]);const y=t?"none":k,[A,D]=c.useState(0),[W,pe]=c.useState(0),Q=Ct();c.useEffect(()=>{const N=n.current;if(!N)return;let U=!1;return nt().then(z=>{if(U)return;const V=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,q=z.capabilities.hdr&&V&&t;s.current=q,lo(N,{hdr:q}).then(Z=>{if(U){yn(Z);return}a.current=Z,p(!0)}).catch(Z=>{U||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Z),l(!0))})}).catch(z=>{U||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",z),l(!0))}),()=>{U=!0,a.current&&(yn(a.current),a.current=null)}},[]),c.useEffect(()=>{const N=r.current;if(!N)return;const U=new ResizeObserver(()=>b(z=>z+1));return U.observe(N),()=>U.disconnect()},[]),c.useEffect(()=>{const N=r.current;if(!N)return;const U=new IntersectionObserver(z=>{const V=z[0];if(!V)return;const q=a.current;q&&(q.setVisible(V.isIntersecting),V.isIntersecting?q.isParked&&(q.restore(),b(Z=>Z+1)):q.park())},{threshold:0});return U.observe(N),()=>U.disconnect()},[]),c.useEffect(()=>{var z;if(!t||!d)return;const N=e.hdr;M.current=N;const U=$o(N);(z=a.current)==null||z.setSource(U),x(V=>V&&V.w===U.width&&V.h===U.height?V:{w:U.width,h:U.height}),E(V=>V+1),v(V=>V+1)},[t,d,t?e.hdr:null]),c.useEffect(()=>{if(t||!d)return;const N=e,U=N.imageUrl,z=k;if(!U){_.current=null,x(null),E(q=>q+1);return}let V=!1;return He(U).then(q=>{var R,G;if(V||!q)return;let Z=q;if(z!=="none"){const H=`gpu::${U}::${z}::ev${A}::off${W}`,ne=wt(H);if(ne)Z=ne;else{const K=xt.has(z)?"positive":"linear";Z=bt(q,z,K,A,W),yt(H,Z)}}_.current=q;const Me={data:Z.data,width:Z.width,height:Z.height,format:"rgba8unorm"};(R=a.current)==null||R.setSource(Me),x(H=>H&&H.w===Z.width&&H.h===Z.height?H:{w:Z.width,h:Z.height}),(G=N.onNaturalSize)==null||G.call(N,Z.width,Z.height),E(H=>H+1),v(H=>H+1)}),()=>{V=!0}},[t,d,t?null:e.imageUrl,t?null:k,t?0:A,t?0:W]);const he=t?e.exposure??0:0,ye=t?e.tonemap:void 0,Ee=t?e.gamma:void 0,ke=c.useCallback(()=>{const N=a.current;if(!N||!d||!g)return;const U=r.current,z=o.current,V=z?z.getBoundingClientRect():U?U.getBoundingClientRect():{width:g.w,height:g.h},q=In({zoom:C,pan:L},V,g.w,g.h);w(G=>G.x===q.x&&G.y===q.y&&G.w===q.w&&G.h===q.h?G:q),V.width>0&&V.height>0&&N.resize(Math.round(V.width*Q),Math.round(V.height*Q));const Z=On(q,V,g.w,g.h)>=kt?"nearest":"linear",Me=q,R=t?{exposureEV:he+A,offset:W,operator:s.current?"extended":zo(ye),gamma:Ee,isScalar:!1,hdrOut:s.current,uv:Me,filter:Z}:{exposureEV:y!=="none"?0:A,offset:y!=="none"?0:W,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Me,filter:Z};try{N.render(R)||l(!0)}catch(G){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",G),l(!0)}},[d,g,C,L.x,L.y,he,A,W,ye,Ee,t,y,Q]);c.useEffect(()=>{ke()},[ke,f,h]);const De=c.useCallback((N,U,z)=>{if(t){const ne=M.current,K=g;if(!ne||!K||N<0||U<0||N>=K.w||U>=K.h)return null;const se=ne.shape.length===2?1:ne.shape[2]??1,Pe=(U*K.w+N)*se,Ce=ne.data,ae=.5;return se===1?{lines:[j(Ce[Pe]??0,"unit",z)],luminance:ae}:{lines:[j(Ce[Pe]??0,"unit",z),j(Ce[Pe+1]??0,"unit",z),j(Ce[Pe+2]??0,"unit",z)],luminance:ae,colors:[fe[0],fe[1],fe[2]]}}const V=_.current;if(!V||N<0||U<0||N>=V.width||U>=V.height)return null;const q=(U*V.width+N)*4,Z=V.data[q],Me=V.data[q+1],R=V.data[q+2],G=(.299*Z+.587*Me+.114*R)/255;return y!=="none"||Z===Me&&Me===R?{lines:[j(Z,"uint8",z)],luminance:G}:{lines:[j(Z,"uint8",z),j(Me,"uint8",z),j(R,"uint8",z)],luminance:G,colors:[fe[0],fe[1],fe[2]]}},[t,g,y]),ue=e.showAxes??!1,Se=t?e.label??"":e.label,me=e.interpolation??"auto",J=me==="auto"?void 0:me,xe=t?void 0:e.overlay,te=t?void 0:e.overlaySettings,X=t?!1:e.isDraggable??!1,ee=t?void 0:e.onDragStart;if(u)return t?i.jsx(Nt,{...e}):i.jsx(Nt,{...e});const ge=xe&&(te!=null&&te.enabled)&&g&&((((_e=xe.boxes)==null?void 0:_e.length)??0)>0||(((be=xe.masks)==null?void 0:be.length)??0)>0)?i.jsx(At,{data:xe,settings:te,naturalWidth:g.w,naturalHeight:g.h}):void 0;return i.jsx(it,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":d},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:C,pan:L,onViewportChange:B,naturalDims:g,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:ue&&g?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:J},"data-gpu-image-canvas":!0}),showAxes:ue,overlayNode:ge,overlay:{displayElRef:n,sample:De,version:T,hasSource:!0,sourceWindow:m},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ke,leadingMenus:t?void 0:[Bt(y,N=>P(N))],displayAdjust:{exposureEV:A,offset:W,onExposureChange:D,onOffsetChange:pe},label:Se,showLabelChip:!!Se,isDraggable:X,onDragStart:ee})}const ct=new Map;function Ve(e){if(ct.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);ct.set(e.id,e)}function Qe(e){return ct.get(e)}function Wo(){return Array.from(ct.values())}function Bn(e,t){return{...e.params??{},...t??{}}}const Yo={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},Ko={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Ho={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},qo={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Zo={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},Qo={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Nn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Jo(Nn);const Ut=[1.052156925,1,.91835767],jo=.7;function Jo(e){const[t,n,r]=e[0],[o,a,s]=e[1],[u,l,d]=e[2],p=a*d-s*l,g=-(o*d-s*u),x=o*l-a*u,v=1/(t*p+n*g+r*x);return[[p*v,-(n*d-r*l)*v,(n*s-r*a)*v],[g*v,(t*d-r*u)*v,-(t*s-r*o)*v],[x*v,-(t*l-n*u)*v,(t*a-n*o)*v]]}function es(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Gt=6/29;function Ft(e){return e>Gt**3?Math.cbrt(e):e/(3*Gt*Gt)+4/29}function Un(e,t,n){const[r,o,a]=es(Nn,e,t,n),s=Ft(r*Ut[0]),u=Ft(o*Ut[1]),l=Ft(a*Ut[2]),d=116*u-16,p=500*(s-u),g=200*(u-l);return[d,.01*d*p,.01*d*g]}function ts(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function ns(){const e=Un(0,1,0),t=Un(0,0,1);return Math.pow(ts(e,t),jo)}const Gn=ns(),rs=.082;function Fn(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),u=1/e,l=Math.PI**2,d=[0,0,0];for(let p=-s;p<=s;p++)for(let g=-s;g<=s;g++){const x=(g*u)**2+(p*u)**2;for(let f=0;f<3;f++)d[f]+=t[f]*Math.sqrt(Math.PI/n[f])*Math.exp(-l*x/n[f])+r[f]*Math.sqrt(Math.PI/o[f])*Math.exp(-l*x/o[f])}return{r:s,deltaX:u,sums:d}}function Vn(e){const t=.5*rs*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let u=-n;u<=n;u++){const l=Math.exp(-(u*u+s*s)/(2*t*t)),d=-u*l,p=(u*u/(t*t)-1)*l;d>0&&(r+=d),p>0?o+=p:a-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const os=`
${Ge}
${st}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,ss=`
${Ge}
${st}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,lt=`
${Ge}
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
`;function Ye(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function ut(e){return[Ye(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ye(2,[e.sums[2],0,0,0])]}function $n(e){return[Ye(4,[Gn,e.sd,e.r,e.edgeNorm]),Ye(5,[e.pointPos,e.pointNeg,0,0])]}function Xn(e,t,n,r,o=""){const a=Fn(e),s=Vn(e),u=`ycxczA${o}`,l=`ycxczB${o}`,d=`labA${o}`,p=`labB${o}`,g=`flip${o}`;return{passes:[{name:u,shader:t,inputs:[n],output:u},{name:l,shader:t,inputs:[r],output:l},{name:d,shader:lt,inputs:[u],output:d,uniforms:()=>ut(a)},{name:p,shader:lt,inputs:[l],output:p,uniforms:()=>ut(a)},{name:g,shader:zn,inputs:[d,p,u,l],output:g,uniforms:()=>$n(s)}],flipRef:g}}const as={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Xn(t,os,"srcA","srcB");return{passes:n,final:r}}},is={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Xn(t,ss,"srcA","srcB");return{passes:n,final:r}}},Wn=`
${Ge}
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
`,cs=`
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
`,ls={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=Fn(t),u=Vn(t),l=[];let d=null;for(let p=0;p<o;p++){const g=n+p*a,x=`_e${p}`,f=`ycxczA${x}`,v=`ycxczB${x}`,h=`labA${x}`,b=`labB${x}`,m=`acc${x}`;l.push({name:f,shader:Wn,inputs:["srcA"],output:f,uniforms:()=>[Ye(1,[g,0,0,0])]},{name:v,shader:Wn,inputs:["srcB"],output:v,uniforms:()=>[Ye(1,[g,0,0,0])]},{name:h,shader:lt,inputs:[f],output:h,uniforms:()=>ut(s)},{name:b,shader:lt,inputs:[v],output:b,uniforms:()=>ut(s)}),d===null?l.push({name:m,shader:zn,inputs:[h,b,f,v],output:m,uniforms:()=>$n(u)}):l.push({name:m,shader:cs,inputs:[h,b,f,v,d],output:m,uniforms:()=>[Ye(5,[Gn,u.sd,u.r,u.edgeNorm]),Ye(6,[u.pointPos,u.pointNeg,0,0])]}),d=m}return{passes:l,final:d}}};let Yn=!1;function us(){Yn||(Yn=!0,Ve(Ko),Ve(Yo),Ve(Ho),Ve(Zo),Ve(qo),Ve(Qo),Ve(as),Ve(ls),Ve(is))}us();function Kn(){const e=[];for(const t of Wo())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function ds(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function fs(e,t){return e==="signed"||e==="relative"?"signed":xt.has(t??"")?"positive":"linear"}const Hn=new WeakMap;function Vt(e,t,n,r){let o=Hn.get(e);o||(o=new Map,Hn.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function ps(e){return`
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
`}const dt="rgba16float";function hs(e,t,n,r,o){var f,v;const a=Qe(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),u=Math.min(t.height,n.height),l=Bn(a,o);if(a.kind==="pointwise"){const h=e.createTexture(s,u,dt),b=Vt(e,`pw:${a.id}`,ps(a.source),dt);let m;try{m=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(h,b,m)}finally{(f=m==null?void 0:m.destroy)==null||f.call(m)}return h}const d={width:s,height:u,params:l},p=a.buildPasses(d),g=new Map([["srcA",t],["srcB",n]]),x=[];try{for(const b of p.passes){const m=e.createTexture(s,u,dt);x.push(m),g.set(b.output,m);const w=Vt(e,`mp:${a.id}:${b.name}`,b.shader,dt),M=b.inputs.map((T,E)=>{const C=g.get(T);if(!C)throw new Error(`computeDiff: pass "${b.name}" input "${T}" not produced yet`);return{binding:E,resource:C}});b.uniforms&&M.push(...b.uniforms(d));let _;try{_=e.createBindGroup(w,M),e.renderFullscreen(m,w,_)}finally{(v=_==null?void 0:_.destroy)==null||v.call(_)}}const h=g.get(p.final);if(!h)throw new Error(`computeDiff: final ref "${p.final}" not produced`);for(const b of x)b!==h&&b.destroy();return h}catch(h){for(const b of x)b.destroy();throw h}}const gs=8,ms=256*1024*1024;class xs{constructor(t=gs,n=ms){oe(this,"map",new Map);oe(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const qn=new WeakMap;function vs(e){let t=qn.get(e);return t||(t=new xs,qn.set(e,t)),t}function bs(e,t){const n=Bn(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function ws(e,t,n,r){const o=Qe(n),a=o?bs(o,r):"";return`${e}|${t}|${n}|${a}`}function ys(e,t,n,r,o,a,s){const u=Qe(r);if(!u)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=vs(e),d=ws(a,s,r,o),p=l.get(d);if(p)return p;const g=hs(e,t,n,r,o),x=Math.min(t.width,n.width),f=Math.min(t.height,n.height),v={texture:g,width:x,height:f,displayRange:u.displayRange,bytes:x*f*8};return l.set(d,v),v}async function Es(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=mn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function _s(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,r})),t.resultSamplesPending)}const Ms=`
${Ge}
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
`,Ts={unit:0,signed:1,relative:2},Ps={linear:0,signed:1,positive:2};function Ss(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Cs(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function As(e,t,n,r,o){var x;const a=Cs(t),s=Vt(e,"diff-display",Ms,a),u=Ss(e,o.colormap),l=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([Ts[r],Ps[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]);let g;try{g=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:p}}]),e.renderFullscreen(t,s,g)}finally{(x=g==null?void 0:g.destroy)==null||x.call(g),u.destroy()}}const Zn=.6*.6*2.51,ks=.6*.03,Rs=0,Qn=.6*.6*2.43,Ls=.6*.59,Ds=.14;function jn(e){const t=(ks-Ls*e)/(Zn-Qn*e),n=(Rs-Ds*e)/(Zn-Qn*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Is=.85,Os=.85,Jn=11920928955078125e-23,zt=[.2126,.7152,.0722];function Bs(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Ns(e,t,n,r=3,o={}){const a=t*n,s=jn(Is),u=jn(Os),l=new Float64Array(a);let d=0;for(let w=0;w<a;w++){const[M,_,T]=Bs(e,w,r),E=M*zt[0]+_*zt[1]+T*zt[2];l[w]=E,E>d&&(d=E)}const p=Float64Array.from(l).sort(),g=a>>1,x=a%2===1?p[g]:p[g-1],f=Math.max(x,Jn),v=Math.max(d,Jn),h=o.startExposure??Math.log2(s/v),b=o.stopExposure??Math.log2(u/f),m=Math.max(2,Math.ceil(b-h));return{startExposure:h,stopExposure:b,numExposures:m}}const Us={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Gs({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:u,onViewportChange:l,processing:d=Us,interpolation:p="auto",label:g="",isDraggable:x=!1,onDragStart:f,overlay:v,overlaySettings:h,pixelValueNotation:b="decimal"}){var xe,te;const m=c.useRef(null),[w,M]=c.useState(null),[_,T]=c.useState(null),[E,C]=c.useState(b),[L,B]=c.useState(!1),F=c.useRef(null),k=c.useRef(null),P=c.useRef(null),y=c.useRef(null),[A,D]=c.useState(0);c.useEffect(()=>{if(!e){P.current=null,D(ee=>ee+1);return}let X=!1;return He(e).then(ee=>{X||(P.current=ee,D(ge=>ge+1))}),()=>{X=!0}},[e]),c.useEffect(()=>{if(!t){y.current=null,D(ee=>ee+1);return}let X=!1;return He(t).then(ee=>{X||(y.current=ee,D(ge=>ge+1))}),()=>{X=!0}},[t]);const W=X=>(ee,ge,_e)=>{const be=X.current;if(!be||ee<0||ge<0||ee>=be.width||ge>=be.height)return null;const N=(ge*be.width+ee)*4,U=be.data[N],z=be.data[N+1],V=be.data[N+2],q=(.299*U+.587*z+.114*V)/255;return U===z&&z===V?{lines:[j(U,"uint8",_e)],luminance:q}:{lines:[j(U,"uint8",_e),j(z,"uint8",_e),j(V,"uint8",_e)],luminance:q,colors:[fe[0],fe[1],fe[2]]}},pe=c.useMemo(()=>W(P),[]),Q=c.useMemo(()=>W(y),[]),he=!!v&&!!(h!=null&&h.enabled)&&!!w&&!!e&&((((xe=v.boxes)==null?void 0:xe.length)??0)>0||(((te=v.masks)==null?void 0:te.length)??0)>0),{gammaFilterId:ye,filterStr:Ee,gamma:ke,offset:De}=En(d),ue=`translate(${u.x}px, ${u.y}px) scale(${s})`,Se=p==="auto"?void 0:p,{containerProps:me,modifierActive:J}=sn({containerRef:m,zoom:s,pan:u,onViewportChange:l});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(_n,{id:ye,gamma:ke,offset:De}),i.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...me.style},onPointerDown:me.onPointerDown,onPointerMove:me.onPointerMove,onPointerUp:me.onPointerUp,onPointerCancel:me.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:ue,transformOrigin:"0 0"},children:[i.jsx("img",{ref:F,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ee,imageRendering:Se,...n==="blend"?{opacity:o}:{}},onLoad:X=>{const ee=X.currentTarget;M({w:ee.naturalWidth,h:ee.naturalHeight})}}),he&&i.jsx(At,{data:v,settings:h,naturalWidth:w.w,naturalHeight:w.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:ue,transformOrigin:"0 0"},children:i.jsx("img",{ref:k,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ee,imageRendering:Se,...n==="blend"?{opacity:1-o}:{}},onLoad:X=>{const ee=X.currentTarget;T({w:ee.naturalWidth,h:ee.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:X=>{X.stopPropagation(),X.preventDefault();const ge=X.currentTarget.parentElement.getBoundingClientRect(),_e=N=>{a==null||a(Math.max(0,Math.min(1,(N.clientX-ge.left)/ge.width)))},be=()=>{window.removeEventListener("pointermove",_e),window.removeEventListener("pointerup",be)};window.addEventListener("pointermove",_e),window.addEventListener("pointerup",be)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&_&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:k,naturalWidth:_.w,naturalHeight:_.h,zoom:s,pan:u,sample:Q,notation:E,version:A})}),e&&w&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Ze,{imageElRef:F,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:u,sample:pe,notation:E,version:A,onActiveChange:B})})]}):e&&w&&i.jsx(Ze,{imageElRef:F,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:u,sample:pe,notation:E,version:A,onActiveChange:B}),L&&i.jsx(cn,{notation:E,onChange:C})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${x&&!J?" cairn-drag-grip":""}`,draggable:x&&!J,onDragStart:f,style:{cursor:x&&!J?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),g]})]})}function Fs(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Vs(e){const t=vt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function zs(e){const{data:t,width:n,height:r,channels:o}=e,a=n*r,s=new Float32Array(a*4),u=l=>Number.isFinite(l)?l:0;for(let l=0;l<a;l++){const d=l*o;let p,g,x,f=1;o===1?p=g=x=u(t[d]):o===3?(p=u(t[d]),g=u(t[d+1]),x=u(t[d+2])):(p=u(t[d]),g=u(t[d+1]),x=u(t[d+2]),f=u(t[d+3]));const v=l*4;s[v]=p,s[v+1]=g,s[v+2]=x,s[v+3]=f}return s}function $s({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,diffSubmode:l,colormap:d="none",diffKernel:p,onDiffKernelChange:g,onCompareModeChange:x,onRequestSide:f,zoom:v,pan:h,onViewportChange:b,interpolation:m="auto",label:w="",pixelValueNotation:M="decimal"}){var nr;const _=c.useRef(null),T=c.useRef(null),E=c.useRef(null),C=c.useRef(null),L=c.useRef(null),[B,F]=c.useState(!1),[k,P]=c.useState(!1),[y,A]=c.useState(null),[D,W]=c.useState(0),[pe,Q]=c.useState(0),[he,ye]=c.useState(null),[Ee,ke]=c.useState({x:0,y:0,w:1,h:1}),De=p??l??"absolute",[ue,Se]=c.useState(De);c.useEffect(()=>{Se(p??l??"absolute")},[p,l]);const me=c.useCallback(S=>{Se(S),g==null||g(S)},[g]);c.useEffect(()=>{const S=_.current;if(S)return S.__cairnDiffKernel={current:ue,set:me},()=>{S&&delete S.__cairnDiffKernel}},[ue,me]);const[J,xe]=c.useState(o);c.useEffect(()=>{xe(o)},[o]);const te=c.useCallback(S=>{xe(S),x==null||x(S)},[x]),[X,ee]=c.useState(d);c.useEffect(()=>{ee(d)},[d]);const ge=c.useRef({mode:o,colormap:d,kernel:p??l??"absolute"}),_e=c.useCallback(()=>{const S=ge.current;te(S.mode),ee(S.colormap),me(S.kernel)},[te,me]),be=J!==ge.current.mode||X!==ge.current.colormap||ue!==ge.current.kernel,[N,U]=c.useState(0),[z,V]=c.useState(0),q=c.useMemo(()=>{const O=[{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...f?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...Kn().map(I=>({id:I.id,label:I.label}))],value:J==="diff"?ue:J==="split"?"slide":"blend",onSelect:I=>{I==="side"?f==null||f():I==="slide"?te("split"):I==="blend"?te("blend"):(te("diff"),me(I))}}}];return J==="diff"&&O.push(Bt(X,I=>ee(I))),O},[J,ue,X,me,te,f]),Z=c.useRef(null),Me=c.useRef(null),R=c.useRef(null),G=c.useRef(null),[H,ne]=c.useState(0),K=c.useRef(null),[se,Pe]=c.useState(0),Ce=Ct();c.useEffect(()=>{const S=E.current;if(!S)return;let ie=!1;return nt().then($=>{if(!ie)try{if(xn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const O=$.createSurface(S,{hdr:!1});C.current={device:$,surface:O,texA:null,texB:null},P(!0)}catch(O){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",O),F(!0)}}).catch($=>{ie||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",$),F(!0))}),()=>{var O,I;ie=!0;const $=C.current;$&&((O=$.texA)==null||O.destroy(),(I=$.texB)==null||I.destroy(),C.current=null)}},[]),c.useEffect(()=>{const S=_.current;if(!S)return;const ie=new ResizeObserver(()=>Q($=>$+1));return ie.observe(S),()=>ie.disconnect()},[]),c.useEffect(()=>{if(!k)return;let S=!1;if(!C.current)return;async function $(O,I){if(I){const le=zs(I);return{width:I.width,height:I.height,imageData:null,make:re=>{const Te=re.createTexture(I.width,I.height,"rgba32float");return Te.write(le),Te}}}if(!O)return null;const ce=await He(O);return ce?{width:ce.width,height:ce.height,imageData:ce,make:le=>{const re=le.createTexture(ce.width,ce.height,"rgba8unorm");return re.write(ce.data),re}}:null}return Promise.all([$(e,n),$(t,r)]).then(([O,I])=>{var re,Te;if(S||!C.current)return;const ce=C.current;Z.current=(O==null?void 0:O.imageData)??null,Me.current=(I==null?void 0:I.imageData)??null,R.current=n??null,G.current=r??null,(re=ce.texA)==null||re.destroy(),(Te=ce.texB)==null||Te.destroy(),ce.texA=null,ce.texB=null;const le=O??I;if(!le){A(null),ne(Re=>Re+1);return}ce.texA=(I??le).make(ce.device),ce.texB=(O??le).make(ce.device),A({w:le.width,h:le.height}),ne(Re=>Re+1),W(Re=>Re+1)}),()=>{S=!0}},[k,e,t,n,r]);const ae=n!=null||r!=null,we=c.useMemo(()=>ds(ue,ae),[ue,ae]),ve=c.useMemo(()=>{if(!ae)return null;const S=r??n;return S?Ns(S.data,S.width,S.height,S.channels):null},[ae,r,n]),Ie=c.useMemo(()=>{var S;return fs(((S=Qe(we))==null?void 0:S.displayRange)??"unit",X==="none"?null:X)},[we,X]),Ke=c.useMemo(()=>X!=="none"?Vs(X):void 0,[X]),ze=c.useCallback(()=>{const S=C.current;if(!k||!S||!S.surface||!S.texA||!S.texB||!y)return;const ie=_.current,$=ie?ie.getBoundingClientRect():{width:y.w,height:y.h},O=In({zoom:v,pan:h},$,y.w,y.h);ke(re=>re.x===O.x&&re.y===O.y&&re.w===O.w&&re.h===O.h?re:O);const I=E.current;if($.width>0&&$.height>0&&I&&S.surface){const re=Math.max(1,Math.round($.width*Ce)),Te=Math.max(1,Math.round($.height*Ce));(I.width!==re||I.height!==Te)&&(I.width=re,I.height=Te,S.surface.configure(re,Te))}const ce=On(O,$,y.w,y.h)>=kt?"nearest":"linear",le=O;try{if(J==="diff"){const re=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Te=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Re=Qe(we)?we:"absolute",et=Re==="hdr-flip"&&ve?{ppd:67,startExposure:ve.startExposure,stopExposure:ve.stopExposure,numExposures:ve.numExposures}:void 0,je=ys(S.device,S.texA,S.texB,Re,et,re,Te);L.current=je,As(S.device,S.surface,je.texture,je.displayRange,{uv:le,cmapMode:Ie,colormap:Ke,filter:ce,exposureEV:N,offset:z})}else{const re={exposureEV:N,offset:z,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:le,filter:ce,mode:J,split:a,alpha:s};oo(S.device,S.surface,S.texA,S.texB,re)}}catch(re){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",re),F(!0)}},[k,y,v,h.x,h.y,J,a,s,N,z,ue,we,ve,Ie,Ke,e,t,n,r,Ce]);c.useEffect(()=>{ze()},[ze,D,pe]);const Oe=t!=null||r!=null;c.useEffect(()=>{const S=C.current;if(!k||!S||!S.texA||!S.texB||!Oe){ye(null);return}let ie=!1;const $=S.texA,O=S.texB,I=L.current;return(J==="diff"&&I?Es(S.device,I,$,O):mn(S.device,$,O)).then(le=>{ie||ye(le)}),()=>{ie=!0}},[k,D,Oe,J,ue]),c.useEffect(()=>{if(J!=="diff"){K.current=null;return}const S=C.current,ie=L.current;if(!k||!S||!ie)return;let $=!1;return K.current=null,Pe(O=>O+1),_s(S.device,ie).then(O=>{$||(K.current=O,Pe(I=>I+1))}).catch(()=>{}),()=>{$=!0}},[k,J,we,D]);const er=(S,ie)=>($,O,I)=>{const ce=ie.current;if(ce){const{data:ft,width:rr,height:Zs,channels:or}=ce;if($<0||O<0||$>=rr||O>=Zs)return null;const pt=(O*rr+$)*or,sr=.5;return or===1?{lines:[j(ft[pt]??0,"unit",I)],luminance:sr}:{lines:[j(ft[pt]??0,"unit",I),j(ft[pt+1]??0,"unit",I),j(ft[pt+2]??0,"unit",I)],luminance:sr,colors:[fe[0],fe[1],fe[2]]}}const le=S.current;if(!le||$<0||O<0||$>=le.width||O>=le.height)return null;const re=(O*le.width+$)*4,Te=le.data[re],Re=le.data[re+1],et=le.data[re+2],je=(.299*Te+.587*Re+.114*et)/255;return Te===Re&&Re===et?{lines:[j(Te,"uint8",I)],luminance:je}:{lines:[j(Te,"uint8",I),j(Re,"uint8",I),j(et,"uint8",I)],luminance:je,colors:[fe[0],fe[1],fe[2]]}},tr=c.useMemo(()=>er(Z,R),[]),Ys=c.useMemo(()=>er(Me,G),[]),Ks=c.useMemo(()=>(S,ie,$)=>{var Re;const O=K.current;if(!O||!y)return null;const{w:I,h:ce}=y;if(S<0||ie<0||S>=I||ie>=ce)return null;const le=(ie*I+S)*4,re=((Re=Qe(we))==null?void 0:Re.output)??"per-channel",Te=.5;return re==="scalar"?{lines:[j(O[le]??0,"unit",$)],luminance:Te}:{lines:[j(O[le]??0,"unit",$),j(O[le+1]??0,"unit",$),j(O[le+2]??0,"unit",$)],luminance:Te,colors:[fe[0],fe[1],fe[2]]}},[y,we]),Hs=m==="auto"?void 0:m;if(B)return n!=null||r!=null?i.jsx(Fs,{}):J==="diff"?i.jsx(Nt,{imageUrl:e,baselineUrl:t,diffMode:((nr=Qe(we))==null?void 0:nr.kind)==="pointwise"?we:"absolute",interpolation:m,colormap:X,showAxes:!1,zoom:v,pan:h,onViewportChange:b,label:w,pixelValueNotation:M}):i.jsx(Gs,{imageUrl:e,baselineUrl:t,mode:J,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,zoom:v,pan:h,onViewportChange:b,interpolation:m,label:w,pixelValueNotation:M});const qs=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:E,className:"w-full h-full block",style:{imageRendering:Hs},"data-gpu-compare-canvas":!0}),J==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:S=>{S.stopPropagation(),u==null||u(.5)},onPointerDown:S=>{S.stopPropagation(),S.preventDefault();const $=S.currentTarget.parentElement.getBoundingClientRect(),O=ce=>{u==null||u(Math.max(0,Math.min(1,(ce.clientX-$.left)/$.width)))},I=()=>{window.removeEventListener("pointermove",O),window.removeEventListener("pointerup",I)};window.addEventListener("pointermove",O),window.addEventListener("pointerup",I)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(it,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":k},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:_,wrapperRef:T,zoom:v,pan:h,onViewportChange:b,naturalDims:y,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:qs,showAxes:!1,notationSeed:M,onReset:_e,extraModified:be,exportCanvasRef:E,requestRender:ze,leadingMenus:q,displayAdjust:{exposureEV:N,offset:z,onExposureChange:U,onOffsetChange:V},label:"",showLabelChip:!1,overlay:{render:({notation:S,setOverlayActive:ie})=>J==="split"?i.jsxs(i.Fragment,{children:[Oe&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:E,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:Ee,sample:Ys,notation:S,version:H})}),Oe&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(Ze,{imageElRef:E,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:Ee,sample:tr,notation:S,version:H,onActiveChange:ie})})]}):y&&i.jsx(Ze,{imageElRef:E,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:Ee,sample:J==="diff"?Ks:tr,notation:S,version:J==="diff"?se:H,onActiveChange:ie})},extraChips:i.jsxs(i.Fragment,{children:[J==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),w?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:w}):null,he&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${w?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",he.mse.toExponential(2)," · PSNR ",Number.isFinite(he.psnr)?he.psnr.toFixed(1):"∞"," dB · MAE"," ",he.mae.toExponential(2)]})]})})}const Xs="cairn-plot:gpu-image-ready";async function Ws(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await nt(),window.__cairnPlotGpuImagePane=Xo,window.__cairnPlotGpuComparePane=$s,window.__cairnPlotDiffMenuModes=Kn(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Xs))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}Ws()})(__cairnPlotJsxRuntime,__cairnPlotReact);
