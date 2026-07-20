var Qs=Object.defineProperty;var js=(i,c,We)=>c in i?Qs(i,c,{enumerable:!0,configurable:!0,writable:!0,value:We}):i[c]=We;var ae=(i,c,We)=>js(i,typeof c!="symbol"?c+"":c,We);(function(i,c){"use strict";const We=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Wt(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:We}),{hdr:!1,format:n}}function ar(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:We}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:We}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Wt(e,t)}}}const ir=`
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
`;function mt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Yt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function cr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const lr={texture:0,sampler:1,uniform:2};function xt(e,t){return e*3+lr[t]}const ur={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function dr(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const u=ur[s];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Kt{constructor(t,n,r,o){ae(this,"width");ae(this,"height");ae(this,"format");ae(this,"gpuTexture");ae(this,"device");ae(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:mt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Yt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Ht{constructor(t){ae(this,"_s");ae(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class fr{constructor(t,n,r,o,a){ae(this,"_p");ae(this,"gpuPipeline");ae(this,"bindings");ae(this,"bindGroupLayout");ae(this,"variants");ae(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function pr(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class hr{constructor(t){ae(this,"_c");ae(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class gr{constructor(t,n){ae(this,"_b");ae(this,"gpuBindGroup");ae(this,"ownedBuffers");ae(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class mr{constructor(t,n,r,o){ae(this,"canvas");ae(this,"hdr");ae(this,"format");ae(this,"context");ae(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function rt(e){return"canvas"in e}async function xr(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(f){return rt(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function s(f){if(rt(f))return{width:f.canvas.width,height:f.canvas.height};const v=f;return{width:v.width,height:v.height}}let u=!1;const l=256;let d=null,p=null;function g(){if(!d||!p){const f=t.createShaderModule({code:ir});p=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const v=t.createPipelineLayout({bindGroupLayouts:[p]});d=t.createComputePipeline({layout:v,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:d,layout:p}}return{backend:"webgpu",capabilities:n,createTexture(f,v,h){return new Kt(t,f,v,h)},createSampler(f){const v=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",h=t.createSampler({magFilter:v,minFilter:v,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Ht(h)},createRenderPipeline(f){const v=t.createShaderModule({code:f.shaderWGSL}),h=dr(f.shaderWGSL),b=mt(f.targetFormat),m=pr(t,h),w=t.createPipelineLayout({bindGroupLayouts:[m]}),M=T=>t.createRenderPipeline({layout:w,vertex:{module:v,entryPoint:"vs_main"},fragment:{module:v,entryPoint:"fs_main",targets:[{format:T}]},primitive:{topology:"triangle-list"}}),E=M(b);return new fr(E,h,m,b,M)},createComputePipeline(f){const v=t.createShaderModule({code:f.shaderWGSL}),h=t.createComputePipeline({layout:"auto",compute:{module:v,entryPoint:"cs_main"}});return new hr(h)},createBindGroup(f,v){const h=f,b=new Map,m=[];for(const[M,E]of h.bindings)if(E.kind==="uniform"){const T=t.createBuffer({size:E.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});m.push(T),b.set(M,{binding:M,resource:{buffer:T}})}else E.kind==="sampler"&&b.set(M,{binding:M,resource:o()});for(const M of v){const E=M.resource;if(E instanceof Kt){const T=xt(M.binding,"texture");h.bindings.has(T)&&b.set(T,{binding:T,resource:E.gpuTexture.createView()})}else if(E instanceof Ht){const T=xt(M.binding,"sampler");h.bindings.has(T)&&b.set(T,{binding:T,resource:E.gpuSampler})}else{const T=xt(M.binding,"uniform"),_=h.bindings.get(T);if(_&&_.kind==="uniform"){const C=E.uniform,R=t.createBuffer({size:Math.max(_.sizeBytes,C.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(R,0,C.buffer,C.byteOffset,C.byteLength),m.push(R),b.set(T,{binding:T,resource:{buffer:R}})}}}const w=t.createBindGroup({layout:h.bindGroupLayout,entries:Array.from(b.values())});return new gr(w,m)},createSurface(f,v){const h=f.getContext("webgpu");if(!h)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const b=v.hdr&&n.hdr,m=()=>b?ar(h,t):Wt(h,t),w=m();return new mr(f,h,w,m)},renderFullscreen(f,v,h){const b=v,m=h,w=a(f),{width:M,height:E}=s(f),T=rt(f)?f.format:mt(f.format),_=b.pipelineFor(T),C=t.createCommandEncoder(),R=C.beginRenderPass({colorAttachments:[{view:w,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});R.setPipeline(_),R.setBindGroup(0,m.gpuBindGroup),R.setViewport(0,0,M,E,0,1),R.draw(3),R.end(),t.queue.submit([C.finish()])},async readback(f){const v=rt(f),{width:h,height:b}=s(f),m=v?f.hdr?"rgba16float":"rgba8unorm":f.format,w=v&&f.format==="bgra8unorm",M=v?f.getCurrentGPUTexture():f.gpuTexture,E=Yt(m),T=h*E,_=256,C=Math.ceil(T/_)*_,R=C*b,O=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),z=t.createCommandEncoder();z.copyTextureToBuffer({texture:M},{buffer:O,bytesPerRow:C,rowsPerImage:b},{width:h,height:b,depthOrArrayLayers:1}),t.queue.submit([z.finish()]),await O.mapAsync(GPUMapMode.READ);const k=new Uint8Array(O.getMappedRange()),P=new Uint8Array(T*b);for(let y=0;y<b;y++){const A=y*C,I=y*T;P.set(k.subarray(A,A+T),I)}if(O.unmap(),O.destroy(),m==="rgba8unorm"){if(w)for(let y=0;y<P.length;y+=4){const A=P[y],I=P[y+2];P[y]=I,P[y+2]=A}return P}if(m==="rgba16float"){const y=new Uint16Array(P.buffer,P.byteOffset,P.byteLength/2),A=new Float32Array(y.length);for(let I=0;I<y.length;I++)A[I]=cr(y[I]);return A}return new Float32Array(P.buffer,P.byteOffset,P.byteLength/4)},async reduceDiffSumSquaredAbs(f,v,h,b){const m=f,w=v,M=Math.max(0,h*b),E=Math.max(1,Math.ceil(M/l)),{pipeline:T,layout:_}=g(),C=E*2*4,R=t.createBuffer({size:C,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),O=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(O,0,new Uint32Array([Math.max(1,h),Math.max(1,b),M,0]));const z=t.createBindGroup({layout:_,entries:[{binding:0,resource:m.gpuTexture.createView()},{binding:1,resource:w.gpuTexture.createView()},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:O}}]}),k=t.createBuffer({size:C,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),P=t.createCommandEncoder(),y=P.beginComputePass();y.setPipeline(T),y.setBindGroup(0,z),y.dispatchWorkgroups(E),y.end(),P.copyBufferToBuffer(R,0,k,0,C),t.queue.submit([P.finish()]),await k.mapAsync(GPUMapMode.READ);const I=new Float32Array(k.getMappedRange()).slice();k.unmap(),k.destroy(),R.destroy(),O.destroy();let X=0,re=0;for(let q=0;q<E;q++)X+=I[q*2],re+=I[q*2+1];return{sumSq:X,sumAbs:re}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let vt=null;async function vr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return xr()}function ot(){return vt||(vt=vr()),vt}function br(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function wr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),u=o-a,[l,d,p]=br(e[a],e[s],u);t[n*3]=Math.round(l),t[n*3+1]=Math.round(d),t[n*3+2]=Math.round(p)}return t}const qt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},bt=new Set(["red-green","red-blue"]),Zt=new Map;function wt(e){let t=Zt.get(e);if(!t){const n=qt[e]??qt.viridis;t=wr(n),Zt.set(e,t)}return t}function yt(e,t,n="linear",r=0,o=0){const a=wt(t),s=new ImageData(e.width,e.height),u=e.data,l=s.data,d=Math.pow(2,r),p=r!==0||o!==0;for(let g=0;g<u.length;g+=4){let x=(u[g]+u[g+1]+u[g+2])/3;p&&(x=Math.max(0,Math.min(255,(x/255*d+o)*255)));let f;n==="positive"?f=Math.round(128+x/255*127):f=Math.round(x),f=Math.max(0,Math.min(255,f)),l[g]=a[f*3],l[g+1]=a[f*3+1],l[g+2]=a[f*3+2],l[g+3]=u[g+3]}return s}function Qt(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const jt=Qt(50);function Et(e){return jt.get(e)}function _t(e,t){jt.set(e,t)}const Jt=Qt(100);function yr(e){return Jt.get(e)}function Er(e,t){Jt.set(e,t)}function _r(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let u=0;u<r;u++){const l=(s*e.width+u)*4,d=(s*t.width+u)*4,p=(s*r+u)*4;for(let g=0;g<3;g++){const x=e.data[l+g],f=t.data[d+g],v=x-f,h=Math.abs(v),b=Math.max(x,1);let m;switch(n){case"signed":m=(v+255)/2;break;case"absolute":m=h;break;case"squared":m=v*v/255;break;case"relative_signed":m=(v/b+1)*127.5;break;case"relative_absolute":m=h/b*255;break;case"relative_squared":m=v*v/(b*b)*255;break}a.data[p+g]=Math.min(255,Math.max(0,Math.round(m)))}a.data[p+3]=255}return a}async function Ze(e){const t=yr(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Er(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Mr={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Tr={linear:0,signed:1,positive:2},Pr=`#version 300 es
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
}`;let Qe=null,W=null,Le=null,st=null;function Cr(){if(W)return W;try{if(typeof OffscreenCanvas<"u"?Qe=new OffscreenCanvas(1,1):Qe=document.createElement("canvas"),W=Qe.getContext("webgl2",{preserveDrawingBuffer:!0}),!W)return console.warn("[cairn] WebGL 2 not available"),null;const e=W.createShader(W.VERTEX_SHADER);if(W.shaderSource(e,Pr),W.compileShader(e),!W.getShaderParameter(e,W.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",W.getShaderInfoLog(e)),null;const t=W.createShader(W.FRAGMENT_SHADER);if(W.shaderSource(t,Sr),W.compileShader(t),!W.getShaderParameter(t,W.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",W.getShaderInfoLog(t)),null;if(Le=W.createProgram(),W.attachShader(Le,e),W.attachShader(Le,t),W.linkProgram(Le),!W.getProgramParameter(Le,W.LINK_STATUS))return console.error("[cairn] WebGL program link:",W.getProgramInfoLog(Le)),null;st=W.createVertexArray(),W.bindVertexArray(st);const n=W.createBuffer();W.bindBuffer(W.ARRAY_BUFFER,n),W.bufferData(W.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),W.STATIC_DRAW);const r=W.getAttribLocation(Le,"a_pos");return W.enableVertexAttribArray(r),W.vertexAttribPointer(r,2,W.FLOAT,!1,0,0),W.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),W}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function en(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Ar(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function kr(e,t,n,r){const o=Cr();if(!o||!Le||!st||!Qe)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);Qe.width=a,Qe.height=s,o.viewport(0,0,a,s);const u=en(o,e,0),l=en(o,t,1);let d=null;n.colormap?d=Ar(o,n.colormap,2):(d=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,d),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Le),o.uniform1i(o.getUniformLocation(Le,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Le,"u_other"),1),o.uniform1i(o.getUniformLocation(Le,"u_lut"),2),o.uniform1i(o.getUniformLocation(Le,"u_diff_mode"),Mr[n.diffMode]),o.uniform1i(o.getUniformLocation(Le,"u_cmap_mode"),Tr[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Le,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(st),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(Qe,0,0,a,s,0,-s,a,s),p.restore()),o.deleteTexture(u),o.deleteTexture(l),o.deleteTexture(d),{width:a,height:s}}const Rr="cairn:render-mode";function Lr(){try{const e=localStorage.getItem(Rr);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Ne=e=>e<0?0:e>1?1:e,Mt=e=>{const t=e<0?0:e;return t/(1+t)},Tt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Ne(n/r)},tn={linear:([e,t,n])=>[Ne(e),Ne(t),Ne(n)],srgb:([e,t,n])=>[Ne(e),Ne(t),Ne(n)],reinhard:([e,t,n])=>[Mt(e),Mt(t),Mt(n)],aces:([e,t,n])=>[Tt(e),Tt(t),Tt(n)],extended:([e,t,n])=>[e,t,n]},Dr="srgb";function Ir(e){return e&&tn[e]||tn[Dr]}function Pt(e,t,n){return e*2**t+n}function Or(e){const t=Ne(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function St(e,t){return typeof t=="number"&&t>0?Ne(Math.pow(Ne(e),1/t)):Or(e)}const Ue=new Uint32Array(512),Ge=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ue[e]=0,Ue[e|256]=32768,Ge[e]=24,Ge[e|256]=24):t<-14?(Ue[e]=1024>>-t-14,Ue[e|256]=1024>>-t-14|32768,Ge[e]=-t-1,Ge[e|256]=-t-1):t<=15?(Ue[e]=t+15<<10,Ue[e|256]=t+15<<10|32768,Ge[e]=13,Ge[e|256]=13):t<128?(Ue[e]=31744,Ue[e|256]=64512,Ge[e]=24,Ge[e|256]=24):(Ue[e]=31744,Ue[e|256]=64512,Ge[e]=13,Ge[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var tt=Uint8Array,nn=Uint16Array,Br=Int32Array,Nr=new tt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Ur=new tt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),rn=function(e,t){for(var n=new nn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Br(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},on=rn(Nr,2),Gr=on.b,Fr=on.r;Gr[28]=258,Fr[258]=28,rn(Ur,0);for(var Vr=new nn(32768),fe=0;fe<32768;++fe){var Ye=(fe&43690)>>1|(fe&21845)<<1;Ye=(Ye&52428)>>2|(Ye&13107)<<2,Ye=(Ye&61680)>>4|(Ye&3855)<<4,Vr[fe]=((Ye&65280)>>8|(Ye&255)<<8)>>1}for(var at=new tt(288),fe=0;fe<144;++fe)at[fe]=8;for(var fe=144;fe<256;++fe)at[fe]=9;for(var fe=256;fe<280;++fe)at[fe]=7;for(var fe=280;fe<288;++fe)at[fe]=8;for(var zr=new tt(32),fe=0;fe<32;++fe)zr[fe]=5;var $r=new tt(0),Xr=typeof TextDecoder<"u"&&new TextDecoder,Wr=0;try{Xr.decode($r,{stream:!0}),Wr=1}catch{}const sn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Ct(e){const t=sn.length;return sn[(e%t+t)%t]}function Yr(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),u=c.useRef(null),l=c.useCallback((d,p)=>{o(g=>g.w===d&&g.h===p?g:{w:d,h:p})},[]);return c.useLayoutEffect(()=>{const d=n.current;if(!d||d===u.current)return;const p=d.getBoundingClientRect();(p.width>0||p.height>0)&&(u.current=d,l(p.width,p.height))}),c.useEffect(()=>{var g;const d=n.current;if(d===s.current||((g=a.current)==null||g.disconnect(),a.current=null,s.current=d,!d))return;const p=new ResizeObserver(x=>{for(const f of x)l(f.contentRect.width,f.contentRect.height)});a.current=p,p.observe(d)}),c.useEffect(()=>()=>{var d;return(d=a.current)==null?void 0:d.disconnect()},[]),{ref:n,size:r}}function Kr(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Hr=.25,At=64;function an(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return At;const o=Math.min(n/e,r/t);return o<=0?At:Math.max(Math.max(n,r)/o,8)}function cn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=Hr,maxZoom:s=At,naturalWidth:u,naturalHeight:l}=e,d=Kr(),p=c.useRef(d);p.current=d;const g=c.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const x=c.useRef(o);x.current=o,c.useEffect(()=>{const w=t.current;if(!w||!o)return;const M=E=>{var A;if(!p.current)return;E.preventDefault(),E.stopPropagation();const T=E.deltaY<0?1.1:1/1.1,_=g.current,C=w.getBoundingClientRect(),R=u&&l?an(u,l,C.width,C.height):s,O=Math.max(a,Math.min(R,_.zoom*T));if(_.zoom===O)return;const z=E.clientX-C.left,k=E.clientY-C.top,P=z-(z-_.pan.x)/_.zoom*O,y=k-(k-_.pan.y)/_.zoom*O;(A=x.current)==null||A.call(x,{zoom:O,pan:{x:P,y}})};return w.addEventListener("wheel",M,{passive:!1}),()=>w.removeEventListener("wheel",M)},[t,!!o,a,s,u,l]);const f=c.useRef(null),v=c.useCallback(w=>{!p.current||!x.current||(w.currentTarget.setPointerCapture(w.pointerId),f.current={pointerId:w.pointerId,startX:w.clientX,startY:w.clientY,panX:g.current.pan.x,panY:g.current.pan.y})},[]),h=c.useCallback(w=>{var _;const M=f.current;if(!M||M.pointerId!==w.pointerId)return;const E=w.clientX-M.startX,T=w.clientY-M.startY;(_=x.current)==null||_.call(x,{zoom:g.current.zoom,pan:{x:M.panX+E,y:M.panY+T}})},[]),b=c.useCallback(w=>{const M=f.current;if(!(!M||M.pointerId!==w.pointerId)){try{w.currentTarget.releasePointerCapture(w.pointerId)}catch{}f.current=null}},[]),m=d&&!!o;return{containerProps:{onPointerDown:v,onPointerMove:h,onPointerUp:b,onPointerCancel:b,style:{cursor:m?"move":void 0,touchAction:m?"none":void 0}},modifierActive:d}}function kt(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function qr(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function ln(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Rt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=Yr(),s=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),l=c.useMemo(()=>{const h=a.w,b=a.h;if(h<=0||b<=0||n<=0||r<=0)return null;const m=Math.min(h/n,b/r),w=n*m,M=r*m;return{left:(h-w)/2,top:(b-M)/2,width:w,height:M}},[a.w,a.h,n,r]),d=e.masks,p=t.showMasks&&!!d&&d.length>0,g=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!p||!d)return;const h=s.current;if(!h)return;(h.width!==n||h.height!==r)&&(h.width=n,h.height=r);const b=h.getContext("2d");if(!b)return;b.clearRect(0,0,h.width,h.height);let m=!1;const w=b.createImageData(n,r),M=w.data;let E=d.length,T=!1;const _=()=>{m||T&&b.putImageData(w,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const R=C.getContext("2d",{willReadFrequently:!0});for(const O of d){const z=new Image;z.onload=()=>{if(!m){if(R){R.clearRect(0,0,n,r),R.drawImage(z,0,0,n,r);const k=R.getImageData(0,0,n,r).data;for(let P=0;P<n*r;P++){const y=k[P*4];if(y===0||u.has(y))continue;const[A,I,X]=qr(Ct(y));M[P*4]=A,M[P*4+1]=I,M[P*4+2]=X,M[P*4+3]=255,T=!0}}E-=1,E===0&&_()}},z.onerror=()=>{E-=1,E===0&&_()},z.src=`data:image/png;base64,${O.png_b64}`}return()=>{m=!0}},[p,d,n,r,g]),!l)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const x=e.boxes??[],f=t.showBoxes&&x.length>0,v=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),f&&i.jsx("svg",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:x.map((h,b)=>{if(!ln(h,t,u))return null;const m=h.domain==="pixel"?1:n,w=h.domain==="pixel"?1:r,M=h.position.minX*m,E=h.position.minY*w,T=(h.position.maxX-h.position.minX)*m,_=(h.position.maxY-h.position.minY)*w;return i.jsx("rect",{x:M,y:E,width:T,height:_,fill:"none",stroke:Ct(h.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),f&&i.jsx("div",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height},children:x.map((h,b)=>{if(!ln(h,t,u))return null;const m=h.domain==="pixel"?1/n:1,w=h.domain==="pixel"?1/r:1,M=h.position.minX*m*100,E=h.position.minY*w*100,T=h.label??v[String(h.class_id)]??`#${h.class_id}`,_=h.score!=null?` ${(h.score*100).toFixed(0)}%`:"";return!T&&!_?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${M}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Ct(h.class_id)},children:i.jsxs("span",{className:"mono",children:[T,_]})},b)})})]})}const Lt=30,pe=["#ff5a5a","#39d353","#5b9bff"];function Dt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function J(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Dt(e/255):Dt(n==="int"?e*255:e)}const Zr={x:0,y:0,w:1,h:1};function je({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:u=0,onActiveChange:l,sourceWindow:d=Zr}){const p=c.useRef(null),g=c.useRef(!1),x=kt(),f=c.useRef(l);f.current=l;const v=c.useCallback(b=>{var m;b!==g.current&&(g.current=b,(m=f.current)==null||m.call(f,b))},[]),h=c.useCallback(()=>{var Q;const b=p.current,m=e.current;if(!b)return;const w=window.devicePixelRatio||1,M=b.clientWidth,E=b.clientHeight;if(M===0||E===0)return;b.width!==Math.round(M*w)&&(b.width=Math.round(M*w)),b.height!==Math.round(E*w)&&(b.height=Math.round(E*w));const T=b.getContext("2d");if(!T)return;if(T.setTransform(w,0,0,w,0,0),T.clearRect(0,0,M,E),!m||t<=0||n<=0){v(!1);return}const _=m.getBoundingClientRect(),C=b.getBoundingClientRect();if(_.width===0||_.height===0){v(!1);return}const R=d.x*t,O=d.y*n,z=d.w*t,k=d.h*n;if(z<=0||k<=0){v(!1);return}const P=Math.min(_.width/z,_.height/k);if(P<Lt){v(!1);return}const y=z*P,A=k*P,I=_.left+(_.width-y)/2-C.left,X=_.top+(_.height-A)/2-C.top,re=Math.max(Math.floor(R),Math.floor(R+(0-I)/P)),q=Math.min(Math.ceil(R+z),Math.ceil(R+(M-I)/P)),xe=Math.max(Math.floor(O),Math.floor(O+(0-X)/P)),ye=Math.min(Math.ceil(O+k),Math.ceil(O+(E-X)/P));if(q<=re||ye<=xe){v(!1);return}v(!0);const Ce=I+(0-R)*P,De=X+(0-O)*P,Ie=I+(t-R)*P,he=X+(n-O)*P;T.save(),T.beginPath(),T.rect(Ce,De,Ie-Ce,he-De),T.clip(),T.textAlign="center",T.textBaseline="middle",T.lineJoin="round";const Ae=P*.14,de=P-Ae*2;for(let be=xe;be<ye;be++)for(let ie=re;ie<q;ie++){if(ie<0||be<0||ie>=t||be>=n)continue;const U=a(ie,be,s);if(!U||U.lines.length===0)continue;const ee=U.lines.length;let me=1;for(const $ of U.lines)$.length>me&&(me=$.length);const Ee=de/(ee*1.15),Te=de/(me*.62)||Ee,ve=Math.min(Ee,Te,24);if(ve<6)continue;const ke=I+(ie-R+.5)*P,G=X+(be-O+.5)*P,N=ve*1.15,H=U.luminance<=.55,Y=H?"#ffffff":"#000000";T.font=`${ve}px ui-monospace, SFMono-Regular, Menlo, monospace`,T.lineWidth=Math.max(1.4,ve*.16),T.strokeStyle=H?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let j=G-ee*N/2+N/2;for(let $=0;$<U.lines.length;$++){const Pe=U.lines[$];T.strokeText(Pe,ke,j),T.fillStyle=((Q=U.colors)==null?void 0:Q[$])??Y,T.fillText(Pe,ke,j),j+=N}}T.restore()},[e,t,n,a,s,v,d]);return c.useEffect(()=>{h()},[h,r,o.x,o.y,u,s,d,x]),c.useEffect(()=>{const b=p.current;if(!b)return;const m=new ResizeObserver(()=>h());return m.observe(b),()=>m.disconnect()},[h]),i.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function un({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Qr=`
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
`,ze=`
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
`,dn=`
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
`,it=`
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
`;function fn(e){return`
${ze}
${dn}
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
`}const Jr=fn("select(colorB, colorA, uv.x < split)"),eo=fn("mix(colorA, colorB, alpha)"),It={linear:0,srgb:1,reinhard:2,aces:3,extended:4},pn=new WeakMap;function to(e,t){let n=pn.get(e);n||(n=new Map,pn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Qr,targetFormat:t}),n.set(t,r)),r}function hn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function gn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function no(e,t,n,r){var h;const o=hn(t),a=to(e,o),s=gn(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,l=It[r.operator]??It.srgb,d=new Float32Array([r.exposureEV,l,u,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),x=new Float32Array([r.filter==="nearest"?0:1]),f=new Float32Array([r.offset??0]);let v;try{v=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:d}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:x}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,a,v)}finally{(h=v==null?void 0:v.destroy)==null||h.call(v),s.destroy()}}const mn=new WeakMap;function ro(e,t,n){let r=mn.get(e);r||(r=new Map,mn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?Jr:eo,targetFormat:n}),r.set(o,a)),a}function oo(e,t,n,r,o){var h;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=hn(t),s=ro(e,o.mode,a),u=gn(e,void 0),l=o.gamma,d=It[o.operator],p=new Float32Array([o.exposureEV,d,l,0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),x=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),f=new Float32Array([o.offset??0,0,0,0]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:x}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,s,v)}finally{(h=v==null?void 0:v.destroy)==null||h.call(v),u.destroy()}}function xn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function vn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:x,sumAbs:f}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return xn(x,f,a)}const s=await e.readback(t),u=await e.readback(n),l=s instanceof Uint8Array,d=u instanceof Uint8Array;let p=0,g=0;for(let x=0;x<o;x++)for(let f=0;f<r;f++){const v=(x*t.width+f)*4,h=(x*n.width+f)*4;for(let b=0;b<3;b++){const m=(s[v+b]??0)/(l?255:1),w=(u[h+b]??0)/(d?255:1),M=m-w;p+=M*M,g+=Math.abs(M)}}return xn(p,g,a)}function bn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const so=12,Ke=[];function wn(e){const t=Ke.indexOf(e);t!==-1&&Ke.splice(t,1),Ke.push(e)}function ao(e){const t=Ke.indexOf(e);t!==-1&&Ke.splice(t,1)}function ct(e){e.parked||(ao(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function yn(e){for(;Ke.length>so;){const t=Ke.find(n=>n!==e&&!n.visible)??Ke.find(n=>n!==e);if(!t)break;ct(t)}}function En(e){var o,a;if(e.disposed)return;if(bn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){wn(e),yn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,wn(e),yn(e)}function io(e,t){if(e.disposed||!e.source)return!0;try{return En(e),!e.surface||!e.srcTexture?!1:(no(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,ct(e),!1}}function co(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return io(e,t)},park(){e.disposed||ct(e)},restore(){e.disposed||!e.source||En(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(ct(e),e.source=null,e.disposed=!0)}}}async function lo(e,t){const n=await ot(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return co(r)}function _n(e){e.dispose()}function uo(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function Mn(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:u,flipSign:l}=e,d=c.useMemo(()=>uo(e,n),[n,r,o,s,l]);return{gammaFilterId:n,filterStr:d,gamma:a,offset:u}}function Tn({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Pn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function fo({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Pn(e),a=Pn(t),s=[];for(let w=0;w<=e;w+=o)s.push(w);const u=[];for(let w=0;w<=t;w+=a)u.push(w);const l=1/n,d=8*l,p=-12*l,g=-2*l,x=r==null?void 0:r.current;let f=0,v=0,h=0,b=0;if(x){const w=x.clientWidth,M=x.clientHeight,E=w/e,T=M/t,_=Math.min(E,T);h=e*_,b=t*_,f=(w-h)/2,v=(M-b)/2}const m=x&&h>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?v:0,transform:`translateY(${p}px)`,fontSize:d},children:s.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",left:m?f+w/e*h:`${w/e*100}%`,transform:"translateX(-50%)"},children:w},w))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?f:0,transform:`translateX(${g}px)`,fontSize:d},children:u.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",top:m?v+w/t*b:`${w/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*l}px`},children:w},w))})]})}function po({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const ho=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Sn(e,t){const n=getComputedStyle(e),r=ho.map(l=>`${l}:${n.getPropertyValue(l)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,u=Math.min(a.length,s.length);for(let l=0;l<u;l++)Sn(a[l],s[l])}function Ot(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Bt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Nt(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((u,l)=>a.toBlob(d=>d?u(d):l(new Error("plot-to-png: toBlob returned null")),"image/png"))}function go(e,t,n){const r=e.cloneNode(!0);Sn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,u)=>{const l=new Image;l.onload=()=>s(l),l.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),l.src=a})}async function Cn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Ot(e);return Nt(r,o,Bt(t),a,s=>s.drawImage(e,0,0,r,o))}async function mo(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Ot(e);try{return await Nt(r,o,Bt(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function xo(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function vo(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,u=(t==null?void 0:t.background)??Ot(e);if(n){const d=n.getBoundingClientRect(),p=await go(n,d.width||a,d.height||s);return Nt(a,s,Bt(t),u,g=>{for(const x of r){const f=x.getBoundingClientRect();g.drawImage(x,f.left-o.left,f.top-o.top,f.width,f.height)}g.drawImage(p,d.left-o.left,d.top-o.top,d.width,d.height)})}if(r.length)return Cn(r[0],t);const l=xo(e);if(l)return mo(l,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function bo(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const wo=8;function yo(e,t,n,r=wo){return!(t>0)||!(e>0)?n:e<t+r}function An(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}const Eo={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},_o={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function $e({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:_o[e]??null})}function kn({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx($e,{name:e??""})})}function Rn(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Mo({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:a}=n,[s,u]=c.useState(!1),[l,d]=c.useState(0),p=c.useRef(null),g=An(r,o),x=e?void 0:((b=r[g])==null?void 0:b.label)??"",f=c.useCallback(()=>{u(m=>{const w=!m;return w&&d(g),w})},[g]),v=c.useCallback(m=>{a(m),u(!1)},[a]);c.useEffect(()=>{if(!s)return;const m=M=>{p.current&&!p.current.contains(M.target)&&u(!1)},w=M=>{M.key==="Escape"&&(M.stopPropagation(),u(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",w,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",w,!0)}},[s]);const h=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),d(g),u(!0));return}if(m.key==="ArrowDown")m.preventDefault(),d(w=>(w+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),d(w=>(w-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const w=r[l];w&&v(w.id)}};return i.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),f()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:h,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",x?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[x?i.jsx("span",{"aria-hidden":"true",children:x}):i.jsx($e,{name:e??""}),i.jsx($e,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,w)=>{const M=m.id===o,E=w===l;return i.jsx("li",{role:"option","aria-selected":M,children:i.jsx("button",{type:"button",onClick:T=>{T.stopPropagation(),v(m.id)},onPointerEnter:()=>d(w),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",M?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const To=e=>e.format?e.format(e.value):String(e.value);function Ln({spec:e}){return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:t=>t.stopPropagation(),onDoubleClick:t=>{t.stopPropagation(),e.defaultValue!==void 0&&e.onChange(e.defaultValue)},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx($e,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:t=>e.onChange(Number(t.target.value)),onPointerDown:t=>t.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:To(e)})]})}function Po({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:a,onSelect:s}=n,[u,l]=c.useState(!1),d=An(o,a),p=((g=o[d])==null?void 0:g.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:x=>{x.stopPropagation(),l(f=>!f)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx($e,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),i.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:i.jsx($e,{name:"caret"})})]}),u&&o.map(x=>{const f=x.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":f,"data-menu-option":"",onClick:v=>{v.stopPropagation(),s(x.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",f?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:f?"✓":""}),i.jsx("span",{children:x.label})]},x.id)})]})}function So({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return c.useEffect(()=>{if(!r)return;const s=l=>{a.current&&!a.current.contains(l.target)&&o(!1)},u=l=>{l.key==="Escape"&&(l.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",u,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",u,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(u=>!u)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx($e,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(Po,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:u=>{var l;u.stopPropagation(),!s.disabled&&((l=s.onClick)==null||l.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx($e,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:u=>{u.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx($e,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(Ln,{spec:s})},s.id))]})]})}function Co({controller:e,config:t}){var k,P;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),u=`${((k=t==null?void 0:t.leadingButtons)==null?void 0:k.length)??0}:${((P=t==null?void 0:t.sliders)==null?void 0:P.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const y=n.current,A=y==null?void 0:y.parentElement;if(!A)return;const I=()=>{const re=A.clientWidth;if(!a.current&&n.current){const q=n.current.scrollWidth;q>0&&(s.current=q)}o(yo(re,s.current,a.current))},X=new ResizeObserver(I);return X.observe(A),I(),()=>X.disconnect()},[u]),(t==null?void 0:t.enabled)===!1)return null;const l=e.capabilities,d=t==null?void 0:t.buttons,p=(y,A)=>A&&(d==null?void 0:d[y])!==!1,g=y=>()=>e.setDragMode(y),x=()=>{e.toPNG({filename:"plot"}).then(y=>bo(y,"plot.png")).catch(()=>{})},f=[];p("zoom",l.zoom)&&f.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),p("pan",l.pan)&&f.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),p("select",l.select)&&f.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),p("lasso",l.lasso)&&f.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const v=[];p("zoomIn",l.zoom)&&v.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",l.zoom)&&v.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const h=[];p("autoscale",l.autoscale)&&h.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",l.reset)&&h.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const b=[];p("screenshot",l.screenshot)&&b.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:x});const m=[f,v,h,b].filter(y=>y.length>0),w=m.flat(),M=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!M.length&&w.length===0&&E.length===0)return null;const T=(t==null?void 0:t.position)??"top-right",_=(t==null?void 0:t.visibility)==="always",C=T==="top-right"||T==="bottom-right",O=["z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",_?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),z={position:"absolute",pointerEvents:"auto",...Eo[T]};return r?i.jsx("div",{ref:n,style:z,className:`${O} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(So,{actions:w,leading:M,sliders:E})}):i.jsxs("div",{ref:n,style:z,className:`${O} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[M.length>0&&i.jsxs(i.Fragment,{children:[M.map(y=>y.menu?i.jsx(Mo,{icon:y.icon,title:y.title,menu:y.menu},y.id):i.jsx(kn,{icon:y.icon,label:y.label,title:y.title,active:y.active,disabled:y.disabled,onClick:y.onClick??(()=>{})},y.id)),m.length>0&&i.jsx(Rn,{})]}),m.map((y,A)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[A>0&&i.jsx(Rn,{}),y.map(I=>i.jsx(kn,{icon:I.icon,title:I.title,active:I.active,disabled:I.disabled,onClick:I.onClick},I.id))]},y[0].id))]}),E.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:E.map(y=>i.jsx(Ln,{spec:y},y.id))})]})}const Ao={zoom:1,pan:{x:0,y:0}},Dn=1.3,ko=.25,Ro=64,Lo={buttons:{zoom:!1}};function Do(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Io=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Ut(e,t){return{id:"colormap",title:"Colormap",menu:{options:Io,value:e,onSelect:t}}}function Oo({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:u=ko,maxZoom:l=Ro,requestRender:d,onReset:p,extraModified:g=!1}){const x=c.useCallback(_=>{var X;if(!o)return;const C=(X=e.current)==null?void 0:X.getBoundingClientRect(),R=(C==null?void 0:C.width)??0,O=(C==null?void 0:C.height)??0,z=a&&s&&R>0&&O>0?an(a,s,R,O):l,k=Math.max(u,Math.min(z,n*_));if(k===n)return;const P=R/2,y=O/2,A=P-(P-r.x)/n*k,I=y-(y-r.y)/n*k;o({zoom:k,pan:{x:A,y:I}})},[o,e,a,s,l,u,n,r.x,r.y]),f=c.useCallback(()=>x(Dn),[x]),v=c.useCallback(()=>x(1/Dn),[x]),h=c.useCallback(()=>{o==null||o(Ao),p==null||p()},[o,p]),b=c.useCallback(_=>{const C={scale:_==null?void 0:_.scale,filename:_==null?void 0:_.filename};d==null||d();const R=t==null?void 0:t.current;if(R)return Cn(R,C);const O=e.current;return O?vo(O,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,d]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),w=n!==1||r.x!==0||r.y!==0||g,M=c.useCallback(_=>{},[]),E=c.useCallback(_=>{},[]),T=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:w,setDragMode:M,setHoverMode:E,toggleSpikelines:T,zoomIn:f,zoomOut:v,autoscale:h,reset:h,toPNG:b}),[m,w,M,E,T,f,v,h,b])}const Bo={zoom:1,pan:{x:0,y:0}};function lt({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:u,naturalDims:l,checkerboard:d,wrapperClassName:p,wrapperStyle:g,viewportPadding:x,header:f,surface:v,showAxes:h,overlayNode:b,overlay:m,notationSeed:w,exportCanvasRef:M,requestRender:E,leadingMenus:T,displayAdjust:_,onReset:C,extraModified:R,label:O,showLabelChip:z,isDraggable:k=!1,onDragStart:P,extraChips:y}){const[A,I]=c.useState(w),[X,re]=c.useState(!1),{containerProps:q}=cn({containerRef:r,zoom:a,pan:s,onViewportChange:u,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h}),xe=c.useCallback(()=>{_==null||_.onExposureChange(0),_==null||_.onOffsetChange(0),C==null||C()},[_,C]),ye=c.useCallback(()=>{u==null||u(Bo),xe()},[u,xe]),Ce=Oo({rootRef:r,canvasRef:M,zoom:a,pan:s,onViewportChange:u,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h,requestRender:E,onReset:xe,extraModified:((_==null?void 0:_.exposureEV)??0)!==0||((_==null?void 0:_.offset)??0)!==0||!!R}),De=c.useMemo(()=>{if(!_)return;const be=(ie,U)=>`${ie>=0?"+":"−"}${Math.abs(ie).toFixed(U)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to reset.",min:-8,max:8,step:.1,value:_.exposureEV,onChange:_.onExposureChange,format:ie=>be(ie,1),defaultValue:0},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to reset.",min:-1,max:1,step:.01,value:_.offset,onChange:_.onOffsetChange,format:ie=>be(ie,2),defaultValue:0}]},[_]),Ie=c.useMemo(()=>({...Lo,leadingButtons:[...T??[],...X?[Do(A,I)]:[]],sliders:De}),[X,A,T,De]),he=" cairn-checkerboard",Ae="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(d==="pane"?he:""),de=p+(d==="wrapper"?he:""),Q="render"in m?m.render({notation:A,setOverlayActive:re}):m.hasSource&&l?i.jsx(je,{imageElRef:m.displayElRef,naturalWidth:l.w,naturalHeight:l.h,zoom:a,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:A,version:m.version,onActiveChange:re}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[f,n&&i.jsx(Co,{controller:Ce,config:Ie}),i.jsxs("div",{ref:r,className:Ae,style:{padding:x,...q.style},onPointerDown:q.onPointerDown,onPointerMove:q.onPointerMove,onPointerUp:q.onPointerUp,onPointerCancel:q.onPointerCancel,onDoubleClick:ye,...t,children:[i.jsxs("div",{ref:o,className:de,style:g,children:[v,h&&l&&i.jsx(fo,{naturalWidth:l.w,naturalHeight:l.h,zoom:a,containerRef:o}),b]}),Q,!n&&X&&i.jsx(un,{notation:A,onChange:I})]}),z&&i.jsx(po,{label:O,isDraggable:k,onDragStart:P}),y]})}function In(e){return"hdr"in e&&e.hdr!=null}function On(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Se(e){return Number.isFinite(e)?e:0}const No={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Uo(e,t,n,r,o=0){const{h:a,w:s,c:u}=On(e.shape),l=e.data,d=Ir(t),p=new Uint8ClampedArray(s*a*4);for(let g=0;g<s*a;g++){const x=g*u;let f,v,h,b=1;u===1?f=v=h=Se(l[x]):u===3?(f=Se(l[x]),v=Se(l[x+1]),h=Se(l[x+2])):(f=Se(l[x]),v=Se(l[x+1]),h=Se(l[x+2]),b=Se(l[x+3]));const m=[Pt(f,n,o),Pt(v,n,o),Pt(h,n,o)],[w,M,E]=d(m),T=g*4;p[T]=255*St(w,r),p[T+1]=255*St(M,r),p[T+2]=255*St(E,r),p[T+3]=255*(b<0?0:b>1?1:b)}return new ImageData(p,s,a)}function Go(e){var $,Pe;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:u=!1,processing:l=No,zoom:d=1,pan:p={x:0,y:0},onViewportChange:g,onNaturalSize:x,label:f,isDraggable:v=!1,onDragStart:h,overlay:b,overlaySettings:m,pixelValueNotation:w="decimal",toolbar:M=!0}=e,[E,T]=c.useState(s);c.useEffect(()=>{T(s)},[s]);const _=c.useRef(s),C=c.useCallback(()=>{T(_.current)},[]),R=c.useRef(null),O=c.useRef(null),z=c.useRef(null),k=c.useRef(null),P=c.useRef(null),y=c.useRef(null),A=c.useRef(null),[I,X]=c.useState(0),re=c.useCallback(()=>X(L=>L+1),[]),q=c.useMemo(()=>({get current(){const L=P.current;return L instanceof HTMLCanvasElement?L:null}}),[]),xe=c.useCallback(L=>{R.current=L,L&&(P.current=L)},[]),ye=c.useCallback(L=>{O.current=L,L&&(P.current=L)},[]),Ce=c.useCallback(L=>{L&&(P.current=L)},[]),[De,Ie]=c.useState(!1),[he,Ae]=c.useState(!1),[de,Q]=c.useState(null),{flipSign:be}=l,{gammaFilterId:ie,filterStr:U,gamma:ee,offset:me}=Mn(l),Ee=!r&&o!=="none"&&n!=null&&t!=null,Te=o!=="none"&&n!=null,ve=E!=="none"&&!Ee&&!(r&&Te)&&t!=null;c.useEffect(()=>{if(!ve||!t){Ae(!1);return}let L=!1;Ae(!1);const F=`${t}::${E}`,K=Et(F);if(K){const Z=O.current;if(Z){Z.width=K.width,Z.height=K.height;const te=Z.getContext("2d");te&&te.putImageData(K,0,0),A.current=K,re(),Q({w:K.width,h:K.height}),x==null||x(K.width,K.height),Ae(!0)}return}const oe=new Image;return oe.onload=()=>{if(L)return;const Z=document.createElement("canvas");Z.width=oe.naturalWidth,Z.height=oe.naturalHeight;const te=Z.getContext("2d");if(!te)return;te.drawImage(oe,0,0);const we=te.getImageData(0,0,Z.width,Z.height),ge=bt.has(E)?"positive":"linear",se=yt(we,E,ge);_t(F,se);const Be=O.current;if(!Be||L)return;Be.width=se.width,Be.height=se.height;const _e=Be.getContext("2d");_e&&_e.putImageData(se,0,0),A.current=se,re(),Q({w:se.width,h:se.height}),x==null||x(se.width,se.height),Ae(!0)},oe.src=t,()=>{L=!0}},[ve,t,E]);const ke=c.useCallback((L,F)=>{Q(K=>K&&K.w===L&&K.h===F?K:{w:L,h:F}),x==null||x(L,F)},[]);c.useEffect(()=>{if(!t){y.current=null,A.current=null,re();return}let L=!1;return Ze(t).then(F=>{L||(y.current=F,E==="none"&&(A.current=F),re())}),()=>{L=!0}},[t,E,re]);const G=c.useCallback((L,F,K)=>{const oe=y.current;if(!oe||L<0||F<0||L>=oe.width||F>=oe.height)return null;const Z=(F*oe.width+L)*4,te=oe.data[Z],we=oe.data[Z+1],ge=oe.data[Z+2],se=A.current;let Be=te,_e=we,Oe=ge;if(se&&se.width===oe.width&&se.height===oe.height){const Ve=(F*se.width+L)*4;Be=se.data[Ve],_e=se.data[Ve+1],Oe=se.data[Ve+2]}const Fe=(.299*Be+.587*_e+.114*Oe)/255;return E!=="none"||te===we&&we===ge?{lines:[J(te,"uint8",K)],luminance:Fe}:{lines:[J(te,"uint8",K),J(we,"uint8",K),J(ge,"uint8",K)],luminance:Fe,colors:[pe[0],pe[1],pe[2]]}},[E]);c.useEffect(()=>{if(!Ee){Ie(!1);return}let L=!1;const F=Lr(),K=F==="gpu"||F==="auto",oe=`${n}::${t}::${o}::${E}`;if(F!=="gpu"){const Z=Et(oe);if(Z){const te=R.current;if(te){(te.width!==Z.width||te.height!==Z.height)&&(te.width=Z.width,te.height=Z.height);const we=te.getContext("2d");we&&we.putImageData(Z,0,0),ke(Z.width,Z.height),Ie(!0)}return}}return(async()=>{const[Z,te]=await Promise.all([Ze(n),Ze(t)]);if(L||!Z||!te)return;const ge=o.includes("signed")?"signed":"positive",se=E!=="none"?wt(E):null,Be={diffMode:o,colormap:se,cmapMode:ge};if(K)try{const qe=R.current;if(qe){const Ve=kr(Z,te,Be,qe);if(Ve){if(L)return;ke(Ve.width,Ve.height),Ie(!0);return}}}catch(qe){console.warn("[cairn] WebGL 2 diff error:",qe)}if(F==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let _e=_r(Z,te,o);E!=="none"&&(_e=yt(_e,E,ge)),_t(oe,_e);const Oe=R.current;if(!Oe||L)return;(Oe.width!==_e.width||Oe.height!==_e.height)&&(Oe.width=_e.width,Oe.height=_e.height);const Fe=Oe.getContext("2d");Fe&&Fe.putImageData(_e,0,0),ke(_e.width,_e.height),Ie(!0)})(),()=>{L=!0}},[n,t,o,Ee,E,x]);const N=a==="auto"?void 0:a,H=be?{filter:"invert(1)"}:{},Y=b&&(m!=null&&m.enabled)&&de&&t&&(((($=b.boxes)==null?void 0:$.length)??0)>0||(((Pe=b.masks)==null?void 0:Pe.length)??0)>0)?i.jsx(Rt,{data:b,settings:m,naturalWidth:de.w,naturalHeight:de.h}):void 0,j=t?Ee?i.jsxs(i.Fragment,{children:[!De&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:xe,className:"w-full h-full object-contain block",style:{display:De?"block":"none",imageRendering:N,...H}})]}):ve?i.jsxs(i.Fragment,{children:[!he&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:ye,className:"w-full h-full object-contain block",style:{display:he?"block":"none",imageRendering:N,...H}})]}):i.jsx("img",{ref:Ce,src:t,alt:f,className:"w-full h-full object-contain block",draggable:!1,style:{filter:U,imageRendering:N},onLoad:L=>{const F=L.currentTarget;Q({w:F.naturalWidth,h:F.naturalHeight}),x==null||x(F.naturalWidth,F.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(lt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:M,paneRef:z,wrapperRef:k,zoom:d,pan:p,onViewportChange:g,naturalDims:de,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:u&&de?"16px 4px 4px 28px":"4px",header:i.jsx(Tn,{id:ie,gamma:ee,offset:me}),surface:j,showAxes:u,overlayNode:Y,overlay:{displayElRef:P,sample:G,version:I,hasSource:!!t},notationSeed:w,exportCanvasRef:q,leadingMenus:[Ut(E,L=>T(L))],onReset:C,extraModified:E!==_.current,label:f,showLabelChip:!0,isDraggable:v,onDragStart:h})}function Fo(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:u="auto",zoom:l=1,pan:d={x:0,y:0},onViewportChange:p,pixelValueNotation:g="decimal",toolbar:x=!0}=e,f=c.useRef(null),v=c.useRef(null),h=c.useRef(null),[b,m]=c.useState(null),w=c.useRef(null),[M,E]=c.useState(0),[T,_]=c.useState(0),[C,R]=c.useState(0);c.useEffect(()=>{const k=f.current;if(!k)return;let P;try{P=Uo(t,n,r+T,o,C)}catch(A){console.error("[cairn] HDR tone-map error:",A);return}(k.width!==P.width||k.height!==P.height)&&(k.width=P.width,k.height=P.height);const y=k.getContext("2d");y&&(y.putImageData(P,0,0),w.current=P,E(A=>A+1),m(A=>A&&A.w===P.width&&A.h===P.height?A:{w:P.width,h:P.height}))},[t,n,r,o,T,C]);const O=c.useCallback((k,P,y)=>{const A=b;if(!A||k<0||P<0||k>=A.w||P>=A.h)return null;const I=t.shape.length===2?1:t.shape[2]??1,X=(P*A.w+k)*I,re=t.data,q=w.current;let xe=.5;if(q&&q.width===A.w&&q.height===A.h){const ye=(P*A.w+k)*4;xe=(.299*q.data[ye]+.587*q.data[ye+1]+.114*q.data[ye+2])/255}return I===1?{lines:[J(re[X]??0,"unit",y)],luminance:xe}:{lines:[J(re[X]??0,"unit",y),J(re[X+1]??0,"unit",y),J(re[X+2]??0,"unit",y)],luminance:xe,colors:[pe[0],pe[1],pe[2]]}},[t,b]),z=u==="auto"?void 0:u;return i.jsx(lt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:v,wrapperRef:h,zoom:l,pan:d,onViewportChange:p,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:a&&b?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:f,className:"w-full h-full object-contain block",style:{imageRendering:z}}),showAxes:a,overlay:{displayElRef:f,sample:O,version:M,hasSource:!0},notationSeed:g,exportCanvasRef:f,displayAdjust:{exposureEV:T,offset:C,onExposureChange:_,onOffsetChange:R},label:s,showLabelChip:!!s})}function Gt(e){return In(e)?i.jsx(Fo,{...e}):i.jsx(Go,{...e})}const Vo=["linear","srgb","reinhard","aces"];function zo(e){return e&&Vo.includes(e)?e:"srgb"}function $o(e){const{h:t,w:n,c:r}=On(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const u=s*r;let l,d,p,g=1;r===1?l=d=p=Se(o[u]):r===3?(l=Se(o[u]),d=Se(o[u+1]),p=Se(o[u+2])):(l=Se(o[u]),d=Se(o[u+1]),p=Se(o[u+2]),g=Se(o[u+3]));const x=s*4;a[x]=l,a[x+1]=d,a[x+2]=p,a[x+3]=g}return{data:a,width:n,height:t,format:"rgba32float"}}function Bn(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,u=(t.width-a)/2,l=(t.height-s)/2,d=Math.max(e.zoom,1e-6),p=t.width/(d*a),g=t.height/(d*s),x=-u/a-e.pan.x/(d*a),f=-l/s-e.pan.y/(d*s);return{x,y:f,w:p,h:g}}function Nn(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function Xo(e){var ve,ke;const t=In(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(!1),[u,l]=c.useState(!1),[d,p]=c.useState(!1),[g,x]=c.useState(null),[f,v]=c.useState(0),[h,b]=c.useState(0),[m,w]=c.useState({x:0,y:0,w:1,h:1}),M=c.useRef(null),E=c.useRef(null),[T,_]=c.useState(0),C=e.zoom??1,R=e.pan??{x:0,y:0},O=e.onViewportChange,z=t?"none":e.colormap??"none",[k,P]=c.useState(z);c.useEffect(()=>{P(z)},[z]);const y=t?"none":k,A=c.useRef(z),I=c.useCallback(()=>{P(A.current)},[]),[X,re]=c.useState(0),[q,xe]=c.useState(0),ye=kt();c.useEffect(()=>{const G=n.current;if(!G)return;let N=!1;return ot().then(H=>{if(N)return;const Y=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,j=H.capabilities.hdr&&Y&&t;s.current=j,lo(G,{hdr:j}).then($=>{if(N){_n($);return}a.current=$,p(!0)}).catch($=>{N||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",$),l(!0))})}).catch(H=>{N||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",H),l(!0))}),()=>{N=!0,a.current&&(_n(a.current),a.current=null)}},[]),c.useEffect(()=>{const G=r.current;if(!G)return;const N=new ResizeObserver(()=>b(H=>H+1));return N.observe(G),()=>N.disconnect()},[]),c.useEffect(()=>{const G=r.current;if(!G)return;const N=new IntersectionObserver(H=>{const Y=H[0];if(!Y)return;const j=a.current;j&&(j.setVisible(Y.isIntersecting),Y.isIntersecting?j.isParked&&(j.restore(),b($=>$+1)):j.park())},{threshold:0});return N.observe(G),()=>N.disconnect()},[]),c.useEffect(()=>{var H;if(!t||!d)return;const G=e.hdr;M.current=G;const N=$o(G);(H=a.current)==null||H.setSource(N),x(Y=>Y&&Y.w===N.width&&Y.h===N.height?Y:{w:N.width,h:N.height}),_(Y=>Y+1),v(Y=>Y+1)},[t,d,t?e.hdr:null]),c.useEffect(()=>{if(t||!d)return;const G=e,N=G.imageUrl,H=k;if(!N){E.current=null,x(null),_(j=>j+1);return}let Y=!1;return Ze(N).then(j=>{var L,F;if(Y||!j)return;let $=j;if(H!=="none"){const K=`gpu::${N}::${H}::ev${X}::off${q}`,oe=Et(K);if(oe)$=oe;else{const Z=bt.has(H)?"positive":"linear";$=yt(j,H,Z,X,q),_t(K,$)}}E.current=j;const Pe={data:$.data,width:$.width,height:$.height,format:"rgba8unorm"};(L=a.current)==null||L.setSource(Pe),x(K=>K&&K.w===$.width&&K.h===$.height?K:{w:$.width,h:$.height}),(F=G.onNaturalSize)==null||F.call(G,$.width,$.height),_(K=>K+1),v(K=>K+1)}),()=>{Y=!0}},[t,d,t?null:e.imageUrl,t?null:k,t?0:X,t?0:q]);const Ce=t?e.exposure??0:0,De=t?e.tonemap:void 0,Ie=t?e.gamma:void 0,he=c.useCallback(()=>{const G=a.current;if(!G||!d||!g)return;const N=r.current,H=o.current,Y=H?H.getBoundingClientRect():N?N.getBoundingClientRect():{width:g.w,height:g.h},j=Bn({zoom:C,pan:R},Y,g.w,g.h);w(F=>F.x===j.x&&F.y===j.y&&F.w===j.w&&F.h===j.h?F:j),Y.width>0&&Y.height>0&&G.resize(Math.round(Y.width*ye),Math.round(Y.height*ye));const $=Nn(j,Y,g.w,g.h)>=Lt?"nearest":"linear",Pe=j,L=t?{exposureEV:Ce+X,offset:q,operator:s.current?"extended":zo(De),gamma:Ie,isScalar:!1,hdrOut:s.current,uv:Pe,filter:$}:{exposureEV:y!=="none"?0:X,offset:y!=="none"?0:q,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Pe,filter:$};try{G.render(L)||l(!0)}catch(F){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",F),l(!0)}},[d,g,C,R.x,R.y,Ce,X,q,De,Ie,t,y,ye]);c.useEffect(()=>{he()},[he,f,h]);const Ae=c.useCallback((G,N,H)=>{if(t){const oe=M.current,Z=g;if(!oe||!Z||G<0||N<0||G>=Z.w||N>=Z.h)return null;const te=oe.shape.length===2?1:oe.shape[2]??1,we=(N*Z.w+G)*te,ge=oe.data,se=.5;return te===1?{lines:[J(ge[we]??0,"unit",H)],luminance:se}:{lines:[J(ge[we]??0,"unit",H),J(ge[we+1]??0,"unit",H),J(ge[we+2]??0,"unit",H)],luminance:se,colors:[pe[0],pe[1],pe[2]]}}const Y=E.current;if(!Y||G<0||N<0||G>=Y.width||N>=Y.height)return null;const j=(N*Y.width+G)*4,$=Y.data[j],Pe=Y.data[j+1],L=Y.data[j+2],F=(.299*$+.587*Pe+.114*L)/255;return y!=="none"||$===Pe&&Pe===L?{lines:[J($,"uint8",H)],luminance:F}:{lines:[J($,"uint8",H),J(Pe,"uint8",H),J(L,"uint8",H)],luminance:F,colors:[pe[0],pe[1],pe[2]]}},[t,g,y]),de=e.showAxes??!1,Q=t?e.label??"":e.label,be=e.interpolation??"auto",ie=be==="auto"?void 0:be,U=t?void 0:e.overlay,ee=t?void 0:e.overlaySettings,me=t?!1:e.isDraggable??!1,Ee=t?void 0:e.onDragStart;if(u)return t?i.jsx(Gt,{...e}):i.jsx(Gt,{...e});const Te=U&&(ee!=null&&ee.enabled)&&g&&((((ve=U.boxes)==null?void 0:ve.length)??0)>0||(((ke=U.masks)==null?void 0:ke.length)??0)>0)?i.jsx(Rt,{data:U,settings:ee,naturalWidth:g.w,naturalHeight:g.h}):void 0;return i.jsx(lt,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":d},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:C,pan:R,onViewportChange:O,naturalDims:g,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:de&&g?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:ie},"data-gpu-image-canvas":!0}),showAxes:de,overlayNode:Te,overlay:{displayElRef:n,sample:Ae,version:T,hasSource:!0,sourceWindow:m},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:he,leadingMenus:t?void 0:[Ut(y,G=>P(G))],displayAdjust:{exposureEV:X,offset:q,onExposureChange:re,onOffsetChange:xe},onReset:I,extraModified:k!==A.current,label:Q,showLabelChip:!!Q,isDraggable:me,onDragStart:Ee})}const ut=new Map;function Xe(e){if(ut.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);ut.set(e.id,e)}function Je(e){return ut.get(e)}function Wo(){return Array.from(ut.values())}function Un(e,t){return{...e.params??{},...t??{}}}const Yo={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
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
`},Gn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Jo(Gn);const Ft=[1.052156925,1,.91835767],jo=.7;function Jo(e){const[t,n,r]=e[0],[o,a,s]=e[1],[u,l,d]=e[2],p=a*d-s*l,g=-(o*d-s*u),x=o*l-a*u,v=1/(t*p+n*g+r*x);return[[p*v,-(n*d-r*l)*v,(n*s-r*a)*v],[g*v,(t*d-r*u)*v,-(t*s-r*o)*v],[x*v,-(t*l-n*u)*v,(t*a-n*o)*v]]}function es(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Vt=6/29;function zt(e){return e>Vt**3?Math.cbrt(e):e/(3*Vt*Vt)+4/29}function Fn(e,t,n){const[r,o,a]=es(Gn,e,t,n),s=zt(r*Ft[0]),u=zt(o*Ft[1]),l=zt(a*Ft[2]),d=116*u-16,p=500*(s-u),g=200*(u-l);return[d,.01*d*p,.01*d*g]}function ts(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function ns(){const e=Fn(0,1,0),t=Fn(0,0,1);return Math.pow(ts(e,t),jo)}const Vn=ns(),rs=.082;function zn(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),u=1/e,l=Math.PI**2,d=[0,0,0];for(let p=-s;p<=s;p++)for(let g=-s;g<=s;g++){const x=(g*u)**2+(p*u)**2;for(let f=0;f<3;f++)d[f]+=t[f]*Math.sqrt(Math.PI/n[f])*Math.exp(-l*x/n[f])+r[f]*Math.sqrt(Math.PI/o[f])*Math.exp(-l*x/o[f])}return{r:s,deltaX:u,sums:d}}function $n(e){const t=.5*rs*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let u=-n;u<=n;u++){const l=Math.exp(-(u*u+s*s)/(2*t*t)),d=-u*l,p=(u*u/(t*t)-1)*l;d>0&&(r+=d),p>0?o+=p:a-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const os=`
${ze}
${it}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,ss=`
${ze}
${it}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,dt=`
${ze}
${it}
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
`,Xn=`
${ze}
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
`;function He(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function ft(e){return[He(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),He(2,[e.sums[2],0,0,0])]}function Wn(e){return[He(4,[Vn,e.sd,e.r,e.edgeNorm]),He(5,[e.pointPos,e.pointNeg,0,0])]}function Yn(e,t,n,r,o=""){const a=zn(e),s=$n(e),u=`ycxczA${o}`,l=`ycxczB${o}`,d=`labA${o}`,p=`labB${o}`,g=`flip${o}`;return{passes:[{name:u,shader:t,inputs:[n],output:u},{name:l,shader:t,inputs:[r],output:l},{name:d,shader:dt,inputs:[u],output:d,uniforms:()=>ft(a)},{name:p,shader:dt,inputs:[l],output:p,uniforms:()=>ft(a)},{name:g,shader:Xn,inputs:[d,p,u,l],output:g,uniforms:()=>Wn(s)}],flipRef:g}}const as={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Yn(t,os,"srcA","srcB");return{passes:n,final:r}}},is={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Yn(t,ss,"srcA","srcB");return{passes:n,final:r}}},Kn=`
${ze}
${it}
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
${ze}
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
`,ls={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=zn(t),u=$n(t),l=[];let d=null;for(let p=0;p<o;p++){const g=n+p*a,x=`_e${p}`,f=`ycxczA${x}`,v=`ycxczB${x}`,h=`labA${x}`,b=`labB${x}`,m=`acc${x}`;l.push({name:f,shader:Kn,inputs:["srcA"],output:f,uniforms:()=>[He(1,[g,0,0,0])]},{name:v,shader:Kn,inputs:["srcB"],output:v,uniforms:()=>[He(1,[g,0,0,0])]},{name:h,shader:dt,inputs:[f],output:h,uniforms:()=>ft(s)},{name:b,shader:dt,inputs:[v],output:b,uniforms:()=>ft(s)}),d===null?l.push({name:m,shader:Xn,inputs:[h,b,f,v],output:m,uniforms:()=>Wn(u)}):l.push({name:m,shader:cs,inputs:[h,b,f,v,d],output:m,uniforms:()=>[He(5,[Vn,u.sd,u.r,u.edgeNorm]),He(6,[u.pointPos,u.pointNeg,0,0])]}),d=m}return{passes:l,final:d}}};let Hn=!1;function us(){Hn||(Hn=!0,Xe(Ko),Xe(Yo),Xe(Ho),Xe(Zo),Xe(qo),Xe(Qo),Xe(as),Xe(ls),Xe(is))}us();function qn(){const e=[];for(const t of Wo())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function ds(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function fs(e,t){return e==="signed"||e==="relative"?"signed":bt.has(t??"")?"positive":"linear"}const Zn=new WeakMap;function $t(e,t,n,r){let o=Zn.get(e);o||(o=new Map,Zn.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function ps(e){return`
${ze}
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
`}const pt="rgba16float";function hs(e,t,n,r,o){var f,v;const a=Je(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),u=Math.min(t.height,n.height),l=Un(a,o);if(a.kind==="pointwise"){const h=e.createTexture(s,u,pt),b=$t(e,`pw:${a.id}`,ps(a.source),pt);let m;try{m=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(h,b,m)}finally{(f=m==null?void 0:m.destroy)==null||f.call(m)}return h}const d={width:s,height:u,params:l},p=a.buildPasses(d),g=new Map([["srcA",t],["srcB",n]]),x=[];try{for(const b of p.passes){const m=e.createTexture(s,u,pt);x.push(m),g.set(b.output,m);const w=$t(e,`mp:${a.id}:${b.name}`,b.shader,pt),M=b.inputs.map((T,_)=>{const C=g.get(T);if(!C)throw new Error(`computeDiff: pass "${b.name}" input "${T}" not produced yet`);return{binding:_,resource:C}});b.uniforms&&M.push(...b.uniforms(d));let E;try{E=e.createBindGroup(w,M),e.renderFullscreen(m,w,E)}finally{(v=E==null?void 0:E.destroy)==null||v.call(E)}}const h=g.get(p.final);if(!h)throw new Error(`computeDiff: final ref "${p.final}" not produced`);for(const b of x)b!==h&&b.destroy();return h}catch(h){for(const b of x)b.destroy();throw h}}const gs=8,ms=256*1024*1024;class xs{constructor(t=gs,n=ms){ae(this,"map",new Map);ae(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Qn=new WeakMap;function vs(e){let t=Qn.get(e);return t||(t=new xs,Qn.set(e,t)),t}function bs(e,t){const n=Un(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function ws(e,t,n,r){const o=Je(n),a=o?bs(o,r):"";return`${e}|${t}|${n}|${a}`}function ys(e,t,n,r,o,a,s){const u=Je(r);if(!u)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=vs(e),d=ws(a,s,r,o),p=l.get(d);if(p)return p;const g=hs(e,t,n,r,o),x=Math.min(t.width,n.width),f=Math.min(t.height,n.height),v={texture:g,width:x,height:f,displayRange:u.displayRange,bytes:x*f*8};return l.set(d,v),v}async function Es(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=vn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function _s(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,r})),t.resultSamplesPending)}const Ms=`
${ze}
${dn}
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
`,Ts={unit:0,signed:1,relative:2},Ps={linear:0,signed:1,positive:2};function Ss(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Cs(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function As(e,t,n,r,o){var x;const a=Cs(t),s=$t(e,"diff-display",Ms,a),u=Ss(e,o.colormap),l=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([Ts[r],Ps[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]);let g;try{g=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:p}}]),e.renderFullscreen(t,s,g)}finally{(x=g==null?void 0:g.destroy)==null||x.call(g),u.destroy()}}const jn=.6*.6*2.51,ks=.6*.03,Rs=0,Jn=.6*.6*2.43,Ls=.6*.59,Ds=.14;function er(e){const t=(ks-Ls*e)/(jn-Jn*e),n=(Rs-Ds*e)/(jn-Jn*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Is=.85,Os=.85,tr=11920928955078125e-23,Xt=[.2126,.7152,.0722];function Bs(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Ns(e,t,n,r=3,o={}){const a=t*n,s=er(Is),u=er(Os),l=new Float64Array(a);let d=0;for(let w=0;w<a;w++){const[M,E,T]=Bs(e,w,r),_=M*Xt[0]+E*Xt[1]+T*Xt[2];l[w]=_,_>d&&(d=_)}const p=Float64Array.from(l).sort(),g=a>>1,x=a%2===1?p[g]:p[g-1],f=Math.max(x,tr),v=Math.max(d,tr),h=o.startExposure??Math.log2(s/v),b=o.stopExposure??Math.log2(u/f),m=Math.max(2,Math.ceil(b-h));return{startExposure:h,stopExposure:b,numExposures:m}}const Us={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Gs({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:u,onViewportChange:l,processing:d=Us,interpolation:p="auto",label:g="",isDraggable:x=!1,onDragStart:f,overlay:v,overlaySettings:h,pixelValueNotation:b="decimal"}){var be,ie;const m=c.useRef(null),[w,M]=c.useState(null),[E,T]=c.useState(null),[_,C]=c.useState(b),[R,O]=c.useState(!1),z=c.useRef(null),k=c.useRef(null),P=c.useRef(null),y=c.useRef(null),[A,I]=c.useState(0);c.useEffect(()=>{if(!e){P.current=null,I(ee=>ee+1);return}let U=!1;return Ze(e).then(ee=>{U||(P.current=ee,I(me=>me+1))}),()=>{U=!0}},[e]),c.useEffect(()=>{if(!t){y.current=null,I(ee=>ee+1);return}let U=!1;return Ze(t).then(ee=>{U||(y.current=ee,I(me=>me+1))}),()=>{U=!0}},[t]);const X=U=>(ee,me,Ee)=>{const Te=U.current;if(!Te||ee<0||me<0||ee>=Te.width||me>=Te.height)return null;const ve=(me*Te.width+ee)*4,ke=Te.data[ve],G=Te.data[ve+1],N=Te.data[ve+2],H=(.299*ke+.587*G+.114*N)/255;return ke===G&&G===N?{lines:[J(ke,"uint8",Ee)],luminance:H}:{lines:[J(ke,"uint8",Ee),J(G,"uint8",Ee),J(N,"uint8",Ee)],luminance:H,colors:[pe[0],pe[1],pe[2]]}},re=c.useMemo(()=>X(P),[]),q=c.useMemo(()=>X(y),[]),xe=!!v&&!!(h!=null&&h.enabled)&&!!w&&!!e&&((((be=v.boxes)==null?void 0:be.length)??0)>0||(((ie=v.masks)==null?void 0:ie.length)??0)>0),{gammaFilterId:ye,filterStr:Ce,gamma:De,offset:Ie}=Mn(d),he=`translate(${u.x}px, ${u.y}px) scale(${s})`,Ae=p==="auto"?void 0:p,{containerProps:de,modifierActive:Q}=cn({containerRef:m,zoom:s,pan:u,onViewportChange:l});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(Tn,{id:ye,gamma:De,offset:Ie}),i.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...de.style},onPointerDown:de.onPointerDown,onPointerMove:de.onPointerMove,onPointerUp:de.onPointerUp,onPointerCancel:de.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:he,transformOrigin:"0 0"},children:[i.jsx("img",{ref:z,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ce,imageRendering:Ae,...n==="blend"?{opacity:o}:{}},onLoad:U=>{const ee=U.currentTarget;M({w:ee.naturalWidth,h:ee.naturalHeight})}}),xe&&i.jsx(Rt,{data:v,settings:h,naturalWidth:w.w,naturalHeight:w.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:he,transformOrigin:"0 0"},children:i.jsx("img",{ref:k,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ce,imageRendering:Ae,...n==="blend"?{opacity:1-o}:{}},onLoad:U=>{const ee=U.currentTarget;T({w:ee.naturalWidth,h:ee.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:U=>{U.stopPropagation(),U.preventDefault();const me=U.currentTarget.parentElement.getBoundingClientRect(),Ee=ve=>{a==null||a(Math.max(0,Math.min(1,(ve.clientX-me.left)/me.width)))},Te=()=>{window.removeEventListener("pointermove",Ee),window.removeEventListener("pointerup",Te)};window.addEventListener("pointermove",Ee),window.addEventListener("pointerup",Te)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&E&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(je,{imageElRef:k,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:u,sample:q,notation:_,version:A})}),e&&w&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(je,{imageElRef:z,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:u,sample:re,notation:_,version:A,onActiveChange:O})})]}):e&&w&&i.jsx(je,{imageElRef:z,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:u,sample:re,notation:_,version:A,onActiveChange:O}),R&&i.jsx(un,{notation:_,onChange:C})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${x&&!Q?" cairn-drag-grip":""}`,draggable:x&&!Q,onDragStart:f,style:{cursor:x&&!Q?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),g]})]})}function Fs(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Vs(e){const t=wt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function zs(e){const{data:t,width:n,height:r,channels:o}=e,a=n*r,s=new Float32Array(a*4),u=l=>Number.isFinite(l)?l:0;for(let l=0;l<a;l++){const d=l*o;let p,g,x,f=1;o===1?p=g=x=u(t[d]):o===3?(p=u(t[d]),g=u(t[d+1]),x=u(t[d+2])):(p=u(t[d]),g=u(t[d+1]),x=u(t[d+2]),f=u(t[d+3]));const v=l*4;s[v]=p,s[v+1]=g,s[v+2]=x,s[v+3]=f}return s}function $s({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,diffSubmode:l,colormap:d="none",diffKernel:p,onDiffKernelChange:g,onCompareModeChange:x,onRequestSide:f,zoom:v,pan:h,onViewportChange:b,interpolation:m="auto",label:w="",pixelValueNotation:M="decimal"}){var nr;const E=c.useRef(null),T=c.useRef(null),_=c.useRef(null),C=c.useRef(null),R=c.useRef(null),[O,z]=c.useState(!1),[k,P]=c.useState(!1),[y,A]=c.useState(null),[I,X]=c.useState(0),[re,q]=c.useState(0),[xe,ye]=c.useState(null),[Ce,De]=c.useState({x:0,y:0,w:1,h:1}),Ie=p??l??"absolute",[he,Ae]=c.useState(Ie);c.useEffect(()=>{Ae(p??l??"absolute")},[p,l]);const de=c.useCallback(S=>{Ae(S),g==null||g(S)},[g]);c.useEffect(()=>{const S=E.current;if(S)return S.__cairnDiffKernel={current:he,set:de},()=>{S&&delete S.__cairnDiffKernel}},[he,de]);const[Q,be]=c.useState(o);c.useEffect(()=>{be(o)},[o]);const ie=c.useCallback(S=>{be(S),x==null||x(S)},[x]),[U,ee]=c.useState(d);c.useEffect(()=>{ee(d)},[d]);const me=c.useRef({mode:o,colormap:d,kernel:p??l??"absolute"}),Ee=c.useCallback(()=>{const S=me.current;ie(S.mode),ee(S.colormap),de(S.kernel)},[ie,de]),Te=Q!==me.current.mode||U!==me.current.colormap||he!==me.current.kernel,[ve,ke]=c.useState(0),[G,N]=c.useState(0),H=c.useMemo(()=>{const B=[{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...f?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...qn().map(D=>({id:D.id,label:D.label}))],value:Q==="diff"?he:Q==="split"?"slide":"blend",onSelect:D=>{D==="side"?f==null||f():D==="slide"?ie("split"):D==="blend"?ie("blend"):(ie("diff"),de(D))}}}];return Q==="diff"&&B.push(Ut(U,D=>ee(D))),B},[Q,he,U,de,ie,f]),Y=c.useRef(null),j=c.useRef(null),$=c.useRef(null),Pe=c.useRef(null),[L,F]=c.useState(0),K=c.useRef(null),[oe,Z]=c.useState(0),te=kt();c.useEffect(()=>{const S=_.current;if(!S)return;let ce=!1;return ot().then(V=>{if(!ce)try{if(bn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const B=V.createSurface(S,{hdr:!1});C.current={device:V,surface:B,texA:null,texB:null},P(!0)}catch(B){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",B),z(!0)}}).catch(V=>{ce||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",V),z(!0))}),()=>{var B,D;ce=!0;const V=C.current;V&&((B=V.texA)==null||B.destroy(),(D=V.texB)==null||D.destroy(),C.current=null)}},[]),c.useEffect(()=>{const S=E.current;if(!S)return;const ce=new ResizeObserver(()=>q(V=>V+1));return ce.observe(S),()=>ce.disconnect()},[]),c.useEffect(()=>{if(!k)return;let S=!1;if(!C.current)return;async function V(B,D){if(D){const ue=zs(D);return{width:D.width,height:D.height,imageData:null,make:ne=>{const Me=ne.createTexture(D.width,D.height,"rgba32float");return Me.write(ue),Me}}}if(!B)return null;const le=await Ze(B);return le?{width:le.width,height:le.height,imageData:le,make:ue=>{const ne=ue.createTexture(le.width,le.height,"rgba8unorm");return ne.write(le.data),ne}}:null}return Promise.all([V(e,n),V(t,r)]).then(([B,D])=>{var ne,Me;if(S||!C.current)return;const le=C.current;Y.current=(B==null?void 0:B.imageData)??null,j.current=(D==null?void 0:D.imageData)??null,$.current=n??null,Pe.current=r??null,(ne=le.texA)==null||ne.destroy(),(Me=le.texB)==null||Me.destroy(),le.texA=null,le.texB=null;const ue=B??D;if(!ue){A(null),F(Re=>Re+1);return}le.texA=(D??ue).make(le.device),le.texB=(B??ue).make(le.device),A({w:ue.width,h:ue.height}),F(Re=>Re+1),X(Re=>Re+1)}),()=>{S=!0}},[k,e,t,n,r]);const we=n!=null||r!=null,ge=c.useMemo(()=>ds(he,we),[he,we]),se=c.useMemo(()=>{if(!we)return null;const S=r??n;return S?Ns(S.data,S.width,S.height,S.channels):null},[we,r,n]),Be=c.useMemo(()=>{var S;return fs(((S=Je(ge))==null?void 0:S.displayRange)??"unit",U==="none"?null:U)},[ge,U]),_e=c.useMemo(()=>U!=="none"?Vs(U):void 0,[U]),Oe=c.useCallback(()=>{const S=C.current;if(!k||!S||!S.surface||!S.texA||!S.texB||!y)return;const ce=E.current,V=ce?ce.getBoundingClientRect():{width:y.w,height:y.h},B=Bn({zoom:v,pan:h},V,y.w,y.h);De(ne=>ne.x===B.x&&ne.y===B.y&&ne.w===B.w&&ne.h===B.h?ne:B);const D=_.current;if(V.width>0&&V.height>0&&D&&S.surface){const ne=Math.max(1,Math.round(V.width*te)),Me=Math.max(1,Math.round(V.height*te));(D.width!==ne||D.height!==Me)&&(D.width=ne,D.height=Me,S.surface.configure(ne,Me))}const le=Nn(B,V,y.w,y.h)>=Lt?"nearest":"linear",ue=B;try{if(Q==="diff"){const ne=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Me=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Re=Je(ge)?ge:"absolute",nt=Re==="hdr-flip"&&se?{ppd:67,startExposure:se.startExposure,stopExposure:se.stopExposure,numExposures:se.numExposures}:void 0,et=ys(S.device,S.texA,S.texB,Re,nt,ne,Me);R.current=et,As(S.device,S.surface,et.texture,et.displayRange,{uv:ue,cmapMode:Be,colormap:_e,filter:le,exposureEV:ve,offset:G})}else{const ne={exposureEV:ve,offset:G,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ue,filter:le,mode:Q,split:a,alpha:s};oo(S.device,S.surface,S.texA,S.texB,ne)}}catch(ne){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ne),z(!0)}},[k,y,v,h.x,h.y,Q,a,s,ve,G,he,ge,se,Be,_e,e,t,n,r,te]);c.useEffect(()=>{Oe()},[Oe,I,re]);const Fe=t!=null||r!=null;c.useEffect(()=>{const S=C.current;if(!k||!S||!S.texA||!S.texB||!Fe){ye(null);return}let ce=!1;const V=S.texA,B=S.texB,D=R.current;return(Q==="diff"&&D?Es(S.device,D,V,B):vn(S.device,V,B)).then(ue=>{ce||ye(ue)}),()=>{ce=!0}},[k,I,Fe,Q,he]),c.useEffect(()=>{if(Q!=="diff"){K.current=null;return}const S=C.current,ce=R.current;if(!k||!S||!ce)return;let V=!1;return K.current=null,Z(B=>B+1),_s(S.device,ce).then(B=>{V||(K.current=B,Z(D=>D+1))}).catch(()=>{}),()=>{V=!0}},[k,Q,ge,I]);const qe=(S,ce)=>(V,B,D)=>{const le=ce.current;if(le){const{data:ht,width:rr,height:Zs,channels:or}=le;if(V<0||B<0||V>=rr||B>=Zs)return null;const gt=(B*rr+V)*or,sr=.5;return or===1?{lines:[J(ht[gt]??0,"unit",D)],luminance:sr}:{lines:[J(ht[gt]??0,"unit",D),J(ht[gt+1]??0,"unit",D),J(ht[gt+2]??0,"unit",D)],luminance:sr,colors:[pe[0],pe[1],pe[2]]}}const ue=S.current;if(!ue||V<0||B<0||V>=ue.width||B>=ue.height)return null;const ne=(B*ue.width+V)*4,Me=ue.data[ne],Re=ue.data[ne+1],nt=ue.data[ne+2],et=(.299*Me+.587*Re+.114*nt)/255;return Me===Re&&Re===nt?{lines:[J(Me,"uint8",D)],luminance:et}:{lines:[J(Me,"uint8",D),J(Re,"uint8",D),J(nt,"uint8",D)],luminance:et,colors:[pe[0],pe[1],pe[2]]}},Ve=c.useMemo(()=>qe(Y,$),[]),Ys=c.useMemo(()=>qe(j,Pe),[]),Ks=c.useMemo(()=>(S,ce,V)=>{var Re;const B=K.current;if(!B||!y)return null;const{w:D,h:le}=y;if(S<0||ce<0||S>=D||ce>=le)return null;const ue=(ce*D+S)*4,ne=((Re=Je(ge))==null?void 0:Re.output)??"per-channel",Me=.5;return ne==="scalar"?{lines:[J(B[ue]??0,"unit",V)],luminance:Me}:{lines:[J(B[ue]??0,"unit",V),J(B[ue+1]??0,"unit",V),J(B[ue+2]??0,"unit",V)],luminance:Me,colors:[pe[0],pe[1],pe[2]]}},[y,ge]),Hs=m==="auto"?void 0:m;if(O)return n!=null||r!=null?i.jsx(Fs,{}):Q==="diff"?i.jsx(Gt,{imageUrl:e,baselineUrl:t,diffMode:((nr=Je(ge))==null?void 0:nr.kind)==="pointwise"?ge:"absolute",interpolation:m,colormap:U,showAxes:!1,zoom:v,pan:h,onViewportChange:b,label:w,pixelValueNotation:M}):i.jsx(Gs,{imageUrl:e,baselineUrl:t,mode:Q,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,zoom:v,pan:h,onViewportChange:b,interpolation:m,label:w,pixelValueNotation:M});const qs=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:_,className:"w-full h-full block",style:{imageRendering:Hs},"data-gpu-compare-canvas":!0}),Q==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:S=>{S.stopPropagation(),u==null||u(.5)},onPointerDown:S=>{S.stopPropagation(),S.preventDefault();const V=S.currentTarget.parentElement.getBoundingClientRect(),B=le=>{u==null||u(Math.max(0,Math.min(1,(le.clientX-V.left)/V.width)))},D=()=>{window.removeEventListener("pointermove",B),window.removeEventListener("pointerup",D)};window.addEventListener("pointermove",B),window.addEventListener("pointerup",D)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(lt,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":k},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:E,wrapperRef:T,zoom:v,pan:h,onViewportChange:b,naturalDims:y,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:qs,showAxes:!1,notationSeed:M,onReset:Ee,extraModified:Te,exportCanvasRef:_,requestRender:Oe,leadingMenus:H,displayAdjust:{exposureEV:ve,offset:G,onExposureChange:ke,onOffsetChange:N},label:"",showLabelChip:!1,overlay:{render:({notation:S,setOverlayActive:ce})=>Q==="split"?i.jsxs(i.Fragment,{children:[Fe&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(je,{imageElRef:_,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:Ce,sample:Ys,notation:S,version:L})}),Fe&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(je,{imageElRef:_,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:Ce,sample:Ve,notation:S,version:L,onActiveChange:ce})})]}):y&&i.jsx(je,{imageElRef:_,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:Ce,sample:Q==="diff"?Ks:Ve,notation:S,version:Q==="diff"?oe:L,onActiveChange:ce})},extraChips:i.jsxs(i.Fragment,{children:[Q==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),w?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:w}):null,xe&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${w?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",xe.mse.toExponential(2)," · PSNR ",Number.isFinite(xe.psnr)?xe.psnr.toFixed(1):"∞"," dB · MAE"," ",xe.mae.toExponential(2)]})]})})}const Xs="cairn-plot:gpu-image-ready";async function Ws(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await ot(),window.__cairnPlotGpuImagePane=Xo,window.__cairnPlotGpuComparePane=$s,window.__cairnPlotDiffMenuModes=qn(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Xs))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}Ws()})(__cairnPlotJsxRuntime,__cairnPlotReact);
