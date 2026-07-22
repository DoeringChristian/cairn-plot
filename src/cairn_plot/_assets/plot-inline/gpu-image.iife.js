var ma=Object.defineProperty;var ga=(u,a,Ke)=>a in u?ma(u,a,{enumerable:!0,configurable:!0,writable:!0,value:Ke}):u[a]=Ke;var ie=(u,a,Ke)=>ga(u,typeof a!="symbol"?a+"":a,Ke);(function(u,a){"use strict";const Ke=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function hn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Ke}),{hdr:!1,format:n}}function Qr(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Ke}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Ke}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return hn(e,t)}}}const jr=`
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
`;function Lt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function mn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Jr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const eo={texture:0,sampler:1,uniform:2};function It(e,t){return e*3+eo[t]}const to={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function no(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),i=r[2]!==void 0,s=r[3].trim();if(i){const l=to[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class gn{constructor(t,n,r,o){ie(this,"width");ie(this,"height");ie(this,"format");ie(this,"gpuTexture");ie(this,"device");ie(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Lt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*mn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class xn{constructor(t){ie(this,"_s");ie(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class ro{constructor(t,n,r,o,i){ie(this,"_p");ie(this,"gpuPipeline");ie(this,"bindings");ie(this,"bindGroupLayout");ie(this,"variants");ie(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=i,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function oo(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class so{constructor(t){ie(this,"_c");ie(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class io{constructor(t,n){ie(this,"_b");ie(this,"gpuBindGroup");ie(this,"ownedBuffers");ie(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class ao{constructor(t,n,r,o){ie(this,"canvas");ie(this,"hdr");ie(this,"format");ie(this,"context");ie(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function ut(e){return"canvas"in e}async function co(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function i(h){return ut(h)?h.getCurrentTextureView():h.gpuTexture.createView()}function s(h){if(ut(h))return{width:h.canvas.width,height:h.canvas.height};const v=h;return{width:v.width,height:v.height}}let l=!1,c=null;function f(){var v,m;if(c!==null)return c;let h=!1;try{if(typeof document<"u"){const x=document.createElement("canvas");x.width=1,x.height=1;const E=x.getContext("webgpu");if(E)try{E.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const M=(v=E.getConfiguration)==null?void 0:v.call(E);h=((m=M==null?void 0:M.toneMapping)==null?void 0:m.mode)==="extended"}catch{h=!1}finally{try{E.unconfigure()}catch{}}}}catch{h=!1}return c=h,h}const p=256;let b=null,d=null;function g(){if(!b||!d){const h=t.createShaderModule({code:jr});d=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const v=t.createPipelineLayout({bindGroupLayouts:[d]});b=t.createComputePipeline({layout:v,compute:{module:h,entryPoint:"cs_main"}})}return{pipeline:b,layout:d}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:f,createTexture(h,v,m){return new gn(t,h,v,m)},createSampler(h){const v=(h==null?void 0:h.filter)==="linear"?"linear":"nearest",m=t.createSampler({magFilter:v,minFilter:v,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new xn(m)},createRenderPipeline(h){const v=t.createShaderModule({code:h.shaderWGSL}),m=no(h.shaderWGSL),x=Lt(h.targetFormat),E=oo(t,m),M=t.createPipelineLayout({bindGroupLayouts:[E]}),_=C=>t.createRenderPipeline({layout:M,vertex:{module:v,entryPoint:"vs_main"},fragment:{module:v,entryPoint:"fs_main",targets:[{format:C}]},primitive:{topology:"triangle-list"}}),y=_(x);return new ro(y,m,E,x,_)},createComputePipeline(h){const v=t.createShaderModule({code:h.shaderWGSL}),m=t.createComputePipeline({layout:"auto",compute:{module:v,entryPoint:"cs_main"}});return new so(m)},createBindGroup(h,v){const m=h,x=new Map,E=[];for(const[_,y]of m.bindings)if(y.kind==="uniform"){const C=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});E.push(C),x.set(_,{binding:_,resource:{buffer:C}})}else y.kind==="sampler"&&x.set(_,{binding:_,resource:o()});for(const _ of v){const y=_.resource;if(y instanceof gn){const C=It(_.binding,"texture");m.bindings.has(C)&&x.set(C,{binding:C,resource:y.gpuTexture.createView()})}else if(y instanceof xn){const C=It(_.binding,"sampler");m.bindings.has(C)&&x.set(C,{binding:C,resource:y.gpuSampler})}else{const C=It(_.binding,"uniform"),T=m.bindings.get(C);if(T&&T.kind==="uniform"){const P=y.uniform,D=t.createBuffer({size:Math.max(T.sizeBytes,P.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(D,0,P.buffer,P.byteOffset,P.byteLength),E.push(D),x.set(C,{binding:C,resource:{buffer:D}})}}}const M=t.createBindGroup({layout:m.bindGroupLayout,entries:Array.from(x.values())});return new io(M,E)},createSurface(h,v){const m=h.getContext("webgpu");if(!m)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const x=v.hdr&&n.hdr,E=()=>x?Qr(m,t):hn(m,t),M=E();return new ao(h,m,M,E)},renderFullscreen(h,v,m){const x=v,E=m,M=i(h),{width:_,height:y}=s(h),C=ut(h)?h.format:Lt(h.format),T=x.pipelineFor(C),P=t.createCommandEncoder(),D=P.beginRenderPass({colorAttachments:[{view:M,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});D.setPipeline(T),D.setBindGroup(0,E.gpuBindGroup),D.setViewport(0,0,_,y,0,1),D.draw(3),D.end(),t.queue.submit([P.finish()])},async readback(h){const v=ut(h),{width:m,height:x}=s(h),E=v?h.hdr?"rgba16float":"rgba8unorm":h.format,M=v&&h.format==="bgra8unorm",_=v?h.getCurrentGPUTexture():h.gpuTexture,y=mn(E),C=m*y,T=256,P=Math.ceil(C/T)*T,D=P*x,I=t.createBuffer({size:D,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),R=t.createCommandEncoder();R.copyTextureToBuffer({texture:_},{buffer:I,bytesPerRow:P,rowsPerImage:x},{width:m,height:x,depthOrArrayLayers:1}),t.queue.submit([R.finish()]),await I.mapAsync(GPUMapMode.READ);const S=new Uint8Array(I.getMappedRange()),B=new Uint8Array(C*x);for(let A=0;A<x;A++){const O=A*P,U=A*C;B.set(S.subarray(O,O+C),U)}if(I.unmap(),I.destroy(),E==="rgba8unorm"){if(M)for(let A=0;A<B.length;A+=4){const O=B[A],U=B[A+2];B[A]=U,B[A+2]=O}return B}if(E==="rgba16float"){const A=new Uint16Array(B.buffer,B.byteOffset,B.byteLength/2),O=new Float32Array(A.length);for(let U=0;U<A.length;U++)O[U]=Jr(A[U]);return O}return new Float32Array(B.buffer,B.byteOffset,B.byteLength/4)},async reduceDiffSumSquaredAbs(h,v,m,x){const E=h,M=v,_=Math.max(0,m*x),y=Math.max(1,Math.ceil(_/p)),{pipeline:C,layout:T}=g(),P=y*2*4,D=t.createBuffer({size:P,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),I=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(I,0,new Uint32Array([Math.max(1,m),Math.max(1,x),_,0]));const R=t.createBindGroup({layout:T,entries:[{binding:0,resource:E.gpuTexture.createView()},{binding:1,resource:M.gpuTexture.createView()},{binding:2,resource:{buffer:D}},{binding:3,resource:{buffer:I}}]}),S=t.createBuffer({size:P,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),B=t.createCommandEncoder(),A=B.beginComputePass();A.setPipeline(C),A.setBindGroup(0,R),A.dispatchWorkgroups(y),A.end(),B.copyBufferToBuffer(D,0,S,0,P),t.queue.submit([B.finish()]),await S.mapAsync(GPUMapMode.READ);const U=new Float32Array(S.getMappedRange()).slice();S.unmap(),S.destroy(),D.destroy(),I.destroy();let de=0,Q=0;for(let re=0;re<y;re++)de+=U[re*2],Q+=U[re*2+1];return{sumSq:de,sumAbs:Q}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let Bt=null;async function lo(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return co()}function ft(){return Bt||(Bt=lo()),Bt}function uo(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function fo(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),i=Math.floor(o),s=Math.min(i+1,e.length-1),l=o-i,[c,f,p]=uo(e[i],e[s],l);t[n*3]=Math.round(c),t[n*3+1]=Math.round(f),t[n*3+2]=Math.round(p)}return t}const bn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},po=new Set(["red-green","red-blue"]),vn=new Map;function Ot(e){let t=vn.get(e);if(!t){const n=bn[e]??bn.viridis;t=fo(n),vn.set(e,t)}return t}const ze=e=>e<0?0:e>1?1:e,Ft=e=>{const t=e<0?0:e;return t/(1+t)},Ut=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return ze(n/r)},wn={linear:([e,t,n])=>[ze(e),ze(t),ze(n)],srgb:([e,t,n])=>[ze(e),ze(t),ze(n)],reinhard:([e,t,n])=>[Ft(e),Ft(t),Ft(n)],aces:([e,t,n])=>[Ut(e),Ut(t),Ut(n)],extended:([e,t,n])=>[e,t,n]},ho="srgb";function mo(e){return e&&wn[e]||wn[ho]}function dt(e,t,n){return e*2**t+n}function go(e){const t=ze(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Nt(e,t){return typeof t=="number"&&t>0?ze(Math.pow(ze(e),1/t)):go(e)}function Gt(e,t,n="linear",r=0,o=0){const i=Ot(t),s=new ImageData(e.width,e.height),l=e.data,c=s.data,f=r!==0||o!==0;for(let p=0;p<l.length;p+=4){let b=(l[p]+l[p+1]+l[p+2])/3;f&&(b=Math.max(0,Math.min(255,dt(b/255,r,o)*255)));let d;n==="positive"?d=Math.round(128+b/255*127):d=Math.round(b),d=Math.max(0,Math.min(255,d)),c[p]=i[d*3],c[p+1]=i[d*3+1],c[p+2]=i[d*3+2],c[p+3]=l[p+3]}return s}function xo(e,t){return e==="signed"||e==="relative"?"signed":zt(t)}function zt(e){return po.has(e??"")?"positive":"linear"}function yn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const En=yn(50);function Vt(e){return En.get(e)}function $t(e,t){En.set(e,t)}const _n=yn(100);function bo(e){return _n.get(e)}function vo(e,t){_n.set(e,t)}function wo(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),i=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const c=(s*e.width+l)*4,f=(s*t.width+l)*4,p=(s*r+l)*4;for(let b=0;b<3;b++){const d=e.data[c+b],g=t.data[f+b],w=d-g,h=Math.abs(w),v=Math.max(d,1);let m;switch(n){case"signed":m=(w+255)/2;break;case"absolute":m=h;break;case"squared":m=w*w/255;break;case"relative_signed":m=(w/v+1)*127.5;break;case"relative_absolute":m=h/v*255;break;case"relative_squared":m=w*w/(v*v)*255;break}i.data[p+b]=Math.min(255,Math.max(0,Math.round(m)))}i.data[p+3]=255}return i}async function Je(e){const t=bo(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const i=o.getContext("2d");if(!i){n(null);return}i.drawImage(r,0,0);const s=i.getImageData(0,0,o.width,o.height);vo(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const yo={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Eo={linear:0,signed:1,positive:2},_o=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Mo=`#version 300 es
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
}`;let et=null,Y=null,Ce=null,pt=null;function So(){if(Y)return Y;try{if(typeof OffscreenCanvas<"u"?et=new OffscreenCanvas(1,1):et=document.createElement("canvas"),Y=et.getContext("webgl2",{preserveDrawingBuffer:!0}),!Y)return console.warn("[cairn] WebGL 2 not available"),null;const e=Y.createShader(Y.VERTEX_SHADER);if(Y.shaderSource(e,_o),Y.compileShader(e),!Y.getShaderParameter(e,Y.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Y.getShaderInfoLog(e)),null;const t=Y.createShader(Y.FRAGMENT_SHADER);if(Y.shaderSource(t,Mo),Y.compileShader(t),!Y.getShaderParameter(t,Y.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Y.getShaderInfoLog(t)),null;if(Ce=Y.createProgram(),Y.attachShader(Ce,e),Y.attachShader(Ce,t),Y.linkProgram(Ce),!Y.getProgramParameter(Ce,Y.LINK_STATUS))return console.error("[cairn] WebGL program link:",Y.getProgramInfoLog(Ce)),null;pt=Y.createVertexArray(),Y.bindVertexArray(pt);const n=Y.createBuffer();Y.bindBuffer(Y.ARRAY_BUFFER,n),Y.bufferData(Y.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Y.STATIC_DRAW);const r=Y.getAttribLocation(Ce,"a_pos");return Y.enableVertexAttribArray(r),Y.vertexAttribPointer(r,2,Y.FLOAT,!1,0,0),Y.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Y}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Mn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function To(e,t,n){const r=new Uint8Array(1024);for(let i=0;i<256;i++)r[i*4]=t[i*3],r[i*4+1]=t[i*3+1],r[i*4+2]=t[i*3+2],r[i*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Ao(e,t,n,r){const o=So();if(!o||!Ce||!pt||!et)return null;const i=Math.min(e.width,t.width),s=Math.min(e.height,t.height);et.width=i,et.height=s,o.viewport(0,0,i,s);const l=Mn(o,e,0),c=Mn(o,t,1);let f=null;n.colormap?f=To(o,n.colormap,2):(f=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,f),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ce),o.uniform1i(o.getUniformLocation(Ce,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ce,"u_other"),1),o.uniform1i(o.getUniformLocation(Ce,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ce,"u_diff_mode"),yo[n.diffMode]),o.uniform1i(o.getUniformLocation(Ce,"u_cmap_mode"),Eo[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ce,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(pt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=i,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(et,0,0,i,s,0,-s,i,s),p.restore()),o.deleteTexture(l),o.deleteTexture(c),o.deleteTexture(f),{width:i,height:s}}const Po="cairn:render-mode";function Co(){try{const e=localStorage.getItem(Po);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const ht=15360;function mt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Sn=globalThis.Float16Array;function Tn(e,t=e.length){if(Sn){const r=new Sn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=mt(e[r]);return n}const Ve=new Uint32Array(512),$e=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ve[e]=0,Ve[e|256]=32768,$e[e]=24,$e[e|256]=24):t<-14?(Ve[e]=1024>>-t-14,Ve[e|256]=1024>>-t-14|32768,$e[e]=-t-1,$e[e|256]=-t-1):t<=15?(Ve[e]=t+15<<10,Ve[e|256]=t+15<<10|32768,$e[e]=13,$e[e|256]=13):t<128?(Ve[e]=31744,Ve[e|256]=64512,$e[e]=24,$e[e|256]=24):(Ve[e]=31744,Ve[e|256]=64512,$e[e]=13,$e[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var at=Uint8Array,An=Uint16Array,Ro=Int32Array,Do=new at([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),ko=new at([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Pn=function(e,t){for(var n=new An(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Ro(n[30]),r=1;r<30;++r)for(var i=n[r];i<n[r+1];++i)o[i]=i-n[r]<<5|r;return{b:n,r:o}},Cn=Pn(Do,2),Lo=Cn.b,Io=Cn.r;Lo[28]=258,Io[258]=28,Pn(ko,0);for(var Bo=new An(32768),fe=0;fe<32768;++fe){var qe=(fe&43690)>>1|(fe&21845)<<1;qe=(qe&52428)>>2|(qe&13107)<<2,qe=(qe&61680)>>4|(qe&3855)<<4,Bo[fe]=((qe&65280)>>8|(qe&255)<<8)>>1}for(var gt=new at(288),fe=0;fe<144;++fe)gt[fe]=8;for(var fe=144;fe<256;++fe)gt[fe]=9;for(var fe=256;fe<280;++fe)gt[fe]=7;for(var fe=280;fe<288;++fe)gt[fe]=8;for(var Oo=new at(32),fe=0;fe<32;++fe)Oo[fe]=5;var Fo=new at(0),Uo=typeof TextDecoder<"u"&&new TextDecoder,No=0;try{Uo.decode(Fo,{stream:!0}),No=1}catch{}const Rn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Xt(e){const t=Rn.length;return Rn[(e%t+t)%t]}function Go(e){const n=a.useRef(null),[r,o]=a.useState({w:0,h:0}),i=a.useRef(null),s=a.useRef(null),l=a.useRef(null),c=a.useCallback((f,p)=>{o(b=>b.w===f&&b.h===p?b:{w:f,h:p})},[]);return a.useLayoutEffect(()=>{const f=n.current;if(!f||f===l.current)return;const p=f.getBoundingClientRect();(p.width>0||p.height>0)&&(l.current=f,c(p.width,p.height))}),a.useEffect(()=>{var b;const f=n.current;if(f===s.current||((b=i.current)==null||b.disconnect(),i.current=null,s.current=f,!f))return;const p=new ResizeObserver(d=>{for(const g of d)c(g.contentRect.width,g.contentRect.height)});i.current=p,p.observe(f)}),a.useEffect(()=>()=>{var f;return(f=i.current)==null?void 0:f.disconnect()},[]),{ref:n,size:r}}function zo(){const[e,t]=a.useState(!1);return a.useEffect(()=>{const n=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!0)},r=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Vo=.001;function $o(e,t=Vo){return Math.exp(-e*t)}function Dn(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function kn(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Xo(e,t,n,r,o,i,s){const l=t>0&&r>0?r/t:1,c=Math.max(i,Math.min(s,e.zoom*l)),f=(n.x-e.pan.x)/e.zoom,p=(n.y-e.pan.y)/e.zoom;return{zoom:c,pan:{x:o.x-f*c,y:o.y-p*c}}}const Wo=.25,Wt=64;function Ht(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Wt;const o=Math.min(n/e,r/t);return o<=0?Wt:Math.max(Math.max(n,r)/o,8)}function Ln(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:i=Wo,maxZoom:s=Wt,naturalWidth:l,naturalHeight:c}=e,f=zo(),p=a.useRef(f);p.current=f;const b=a.useRef({zoom:n,pan:r});b.current={zoom:n,pan:r};const d=a.useRef(o);d.current=o,a.useEffect(()=>{const T=t.current;if(!T||!o)return;const P=D=>{var re;if(!D.ctrlKey&&!p.current)return;D.preventDefault(),D.stopPropagation();const I=$o(D.deltaY),R=b.current,S=T.getBoundingClientRect(),B=l&&c?Ht(l,c,S.width,S.height):s,A=Math.max(i,Math.min(B,R.zoom*I));if(R.zoom===A)return;const O=D.clientX-S.left,U=D.clientY-S.top,de=O-(O-R.pan.x)/R.zoom*A,Q=U-(U-R.pan.y)/R.zoom*A;(re=d.current)==null||re.call(d,{zoom:A,pan:{x:de,y:Q}})};return T.addEventListener("wheel",P,{passive:!1}),()=>T.removeEventListener("wheel",P)},[t,!!o,i,s,l,c]);const g=a.useRef(new Map),w=a.useRef(null),h=a.useRef(null),v=a.useCallback((T,P,D)=>{const I=T.getBoundingClientRect();return{x:P-I.left,y:D-I.top}},[]),m=a.useCallback(T=>{if(!l||!c)return s;const P=T.getBoundingClientRect();return Ht(l,c,P.width,P.height)},[l,c,s]),x=a.useCallback((T,P)=>{const D=g.current,I=D.get(T),R=D.get(P);!I||!R||(w.current=null,h.current={idA:T,idB:P,startDist:Dn(I,R),startMid:kn(I,R),startZoom:b.current.zoom,startPan:{...b.current.pan}})},[]),E=a.useCallback(T=>{const P=g.current.get(T);P&&(w.current={pointerId:T,startX:P.x,startY:P.y,panX:b.current.pan.x,panY:b.current.pan.y})},[]),M=a.useCallback(T=>{if(!d.current)return;const P=T.pointerType==="touch";if(!P&&!p.current)return;const D=T.currentTarget;if(D.setPointerCapture(T.pointerId),g.current.set(T.pointerId,v(D,T.clientX,T.clientY)),P&&g.current.size>=2){const I=[...g.current.keys()];x(I[I.length-2],I[I.length-1]);return}E(T.pointerId)},[v,x,E]),_=a.useCallback(T=>{var S,B;const P=T.currentTarget,D=g.current.get(T.pointerId);if(D){const A=v(P,T.clientX,T.clientY);D.x=A.x,D.y=A.y}const I=h.current;if(I){const A=g.current.get(I.idA),O=g.current.get(I.idB);if(!A||!O)return;const U=Xo({zoom:I.startZoom,pan:I.startPan},I.startDist,I.startMid,Dn(A,O),kn(A,O),i,m(P));(S=d.current)==null||S.call(d,U);return}const R=w.current;!R||R.pointerId!==T.pointerId||!D||(B=d.current)==null||B.call(d,{zoom:b.current.zoom,pan:{x:R.panX+(D.x-R.startX),y:R.panY+(D.y-R.startY)}})},[v,i,m]),y=a.useCallback(T=>{var D;try{T.currentTarget.releasePointerCapture(T.pointerId)}catch{}g.current.delete(T.pointerId);const P=h.current;if(P&&(T.pointerId===P.idA||T.pointerId===P.idB)){h.current=null;const I=[...g.current.keys()];I.length===1&&E(I[0]);return}((D=w.current)==null?void 0:D.pointerId)===T.pointerId&&(w.current=null)},[E]);return{containerProps:{onPointerDown:M,onPointerMove:_,onPointerUp:y,onPointerCancel:y,style:{cursor:f&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:f}}function Yt(){const[e,t]=a.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return a.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),i())};function i(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return i(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ct(e){const t=a.useRef(e),[n,r]=a.useState(e),o=a.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Ho(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function In(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Kt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:i}=Go(),s=a.useRef(null),l=a.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),c=a.useMemo(()=>{const h=i.w,v=i.h;if(h<=0||v<=0||n<=0||r<=0)return null;const m=Math.min(h/n,v/r),x=n*m,E=r*m;return{left:(h-x)/2,top:(v-E)/2,width:x,height:E}},[i.w,i.h,n,r]),f=e.masks,p=t.showMasks&&!!f&&f.length>0,b=a.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(a.useEffect(()=>{if(!p||!f)return;const h=s.current;if(!h)return;(h.width!==n||h.height!==r)&&(h.width=n,h.height=r);const v=h.getContext("2d");if(!v)return;v.clearRect(0,0,h.width,h.height);let m=!1;const x=v.createImageData(n,r),E=x.data;let M=f.length,_=!1;const y=()=>{m||_&&v.putImageData(x,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const T=C.getContext("2d",{willReadFrequently:!0});for(const P of f){const D=new Image;D.onload=()=>{if(!m){if(T){T.clearRect(0,0,n,r),T.drawImage(D,0,0,n,r);const I=T.getImageData(0,0,n,r).data;for(let R=0;R<n*r;R++){const S=I[R*4];if(S===0||l.has(S))continue;const[B,A,O]=Ho(Xt(S));E[R*4]=B,E[R*4+1]=A,E[R*4+2]=O,E[R*4+3]=255,_=!0}}M-=1,M===0&&y()}},D.onerror=()=>{M-=1,M===0&&y()},D.src=`data:image/png;base64,${P.png_b64}`}return()=>{m=!0}},[p,f,n,r,b]),!c)return u.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const d=e.boxes??[],g=t.showBoxes&&d.length>0,w=e.class_labels??{};return u.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&u.jsx("canvas",{ref:s,className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),g&&u.jsx("svg",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:d.map((h,v)=>{if(!In(h,t,l))return null;const m=h.domain==="pixel"?1:n,x=h.domain==="pixel"?1:r,E=h.position.minX*m,M=h.position.minY*x,_=(h.position.maxX-h.position.minX)*m,y=(h.position.maxY-h.position.minY)*x;return u.jsx("rect",{x:E,y:M,width:_,height:y,fill:"none",stroke:Xt(h.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},v)})}),g&&u.jsx("div",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height},children:d.map((h,v)=>{if(!In(h,t,l))return null;const m=h.domain==="pixel"?1/n:1,x=h.domain==="pixel"?1/r:1,E=h.position.minX*m*100,M=h.position.minY*x*100,_=h.label??w[String(h.class_id)]??`#${h.class_id}`,y=h.score!=null?` ${(h.score*100).toFixed(0)}%`:"";return!_&&!y?null:u.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${E}%`,top:`${M}%`,transform:"translateY(-100%)",backgroundColor:Xt(h.class_id)},children:u.jsxs("span",{className:"mono",children:[_,y]})},v)})})]})}const qt=30,xt=["#ff5a5a","#39d353","#5b9bff"];function Zt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function rt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Zt(e/255):Zt(n==="int"?e*255:e)}function tt(e,t,n,r){return e.length===1?{lines:[rt(e[0],t,n)],luminance:r}:{lines:e.map(o=>rt(o,t,n)),luminance:r,colors:e.map((o,i)=>xt[i]??null)}}const Yo={x:0,y:0,w:1,h:1};function nt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:i,notation:s="decimal",version:l=0,onActiveChange:c,sourceWindow:f=Yo}){const p=a.useRef(null),b=a.useRef(!1),d=Yt(),g=a.useRef(c);g.current=c;const w=a.useCallback(v=>{var m;v!==b.current&&(b.current=v,(m=g.current)==null||m.call(g,v))},[]),h=a.useCallback(()=>{var Re;const v=p.current,m=e.current;if(!v)return;const x=window.devicePixelRatio||1,E=v.clientWidth,M=v.clientHeight;if(E===0||M===0)return;v.width!==Math.round(E*x)&&(v.width=Math.round(E*x)),v.height!==Math.round(M*x)&&(v.height=Math.round(M*x));const _=v.getContext("2d");if(!_)return;if(_.setTransform(x,0,0,x,0,0),_.clearRect(0,0,E,M),!m||t<=0||n<=0){w(!1);return}const y=m.getBoundingClientRect(),C=v.getBoundingClientRect();if(y.width===0||y.height===0){w(!1);return}const T=f.x*t,P=f.y*n,D=f.w*t,I=f.h*n;if(D<=0||I<=0){w(!1);return}const R=Math.min(y.width/D,y.height/I);if(R<qt){w(!1);return}const S=D*R,B=I*R,A=y.left+(y.width-S)/2-C.left,O=y.top+(y.height-B)/2-C.top,U=Math.max(Math.floor(T),Math.floor(T+(0-A)/R)),de=Math.min(Math.ceil(T+D),Math.ceil(T+(E-A)/R)),Q=Math.max(Math.floor(P),Math.floor(P+(0-O)/R)),re=Math.min(Math.ceil(P+I),Math.ceil(P+(M-O)/R));if(de<=U||re<=Q){w(!1);return}w(!0);const ye=A+(0-T)*R,Se=O+(0-P)*R,le=A+(t-T)*R,Ae=O+(n-P)*R;_.save(),_.beginPath(),_.rect(ye,Se,le-ye,Ae-Se),_.clip(),_.textAlign="center",_.textBaseline="middle",_.lineJoin="round";const ve=R*.14,Ee=R-ve*2;for(let pe=Q;pe<re;pe++)for(let he=U;he<de;he++){if(he<0||pe<0||he>=t||pe>=n)continue;const j=i(he,pe,s);if(!j||j.lines.length===0)continue;const $=j.lines.length;let N=1;for(const K of j.lines)K.length>N&&(N=K.length);const _e=Ee/($*1.15),xe=Ee/(N*.62)||_e,me=Math.min(_e,xe,24);if(me<6)continue;const ge=A+(he-T+.5)*R,Me=O+(pe-P+.5)*R,X=me*1.15,H=j.luminance<=.55,oe=H?"#ffffff":"#000000";_.font=`${me}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.lineWidth=Math.max(1.4,me*.16),_.strokeStyle=H?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let G=Me-$*X/2+X/2;for(let K=0;K<j.lines.length;K++){const L=j.lines[K];_.strokeText(L,ge,G),_.fillStyle=((Re=j.colors)==null?void 0:Re[K])??oe,_.fillText(L,ge,G),G+=X}}_.restore()},[e,t,n,i,s,w,f]);return a.useEffect(()=>{h()},[h,r,o.x,o.y,l,s,f,d]),a.useEffect(()=>{const v=p.current;if(!v)return;const m=new ResizeObserver(()=>h());return m.observe(v),()=>m.disconnect()},[h]),u.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Bn({notation:e,onChange:t,className:n=""}){return u.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Ko=`
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
`,Ie=`
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
`,ot=`
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
`,bt=`
fn mapSample(
  tex: texture_2d<f32>, resultPx: vec2<i32>,
  offX: f32, offY: f32, resW: f32, resH: f32, fitFill: f32,
) -> vec4<f32> {
  let dims = vec2<i32>(textureDimensions(tex));
  if (fitFill > 0.5) {
    let uv = (vec2<f32>(resultPx) + vec2<f32>(0.5)) / vec2<f32>(resW, resH);
    return sampleBilinearOf(tex, uv, vec2<f32>(dims));
  }
  let off = vec2<i32>(i32(round(offX)), i32(round(offY)));
  let p = clamp(resultPx + off, vec2<i32>(0), dims - vec2<i32>(1));
  return textureLoad(tex, p, 0);
}
`,qo=`
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
`,vt=`
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
`;function On(e){return`
${Ie}
${ot}
${qo}

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
`}const Zo=On("select(colorB, colorA, uv.x < split)"),Qo=On("mix(colorA, colorB, alpha)");function jo(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Fn(e,t,n){const{v:r,h:o}=jo(n),i=e.w-t.w,s=e.h-t.h,l=o==="left"?0:o==="right"?i:Math.floor(i/2),c=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:l,y:c}}function wt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const i={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:i,offsetA:Fn(e,i,n),offsetB:Fn(t,i,n)}}function Jo(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const Qt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Un=new WeakMap;function es(e,t){let n=Un.get(e);n||(n=new Map,Un.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Ko,targetFormat:t}),n.set(t,r)),r}function Nn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Gn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ts(e,t,n,r){var h;const o=Nn(t),i=es(e,o),s=Gn(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,c=Qt[r.operator]??Qt.srgb,f=new Float32Array([r.exposureEV,c,l,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),b=new Float32Array([r.hdrOut?1:0]),d=new Float32Array([r.filter==="nearest"?0:1]),g=new Float32Array([r.offset??0]);let w;try{w=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:f}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:d}},{binding:6,resource:{uniform:g}}]),e.renderFullscreen(t,i,w)}finally{(h=w==null?void 0:w.destroy)==null||h.call(w),s.destroy()}}const zn=new WeakMap;function ns(e,t,n){let r=zn.get(e);r||(r=new Map,zn.set(e,r));const o=`${t}:${n}`;let i=r.get(o);return i||(i=e.createRenderPipeline({shaderWGSL:t==="split"?Zo:Qo,targetFormat:n}),r.set(o,i)),i}function rs(e,t,n,r,o){var h;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const i=Nn(t),s=ns(e,o.mode,i),l=Gn(e,void 0),c=o.gamma,f=Qt[o.operator],p=new Float32Array([o.exposureEV,f,c,0]),b=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),g=new Float32Array([o.offset??0,0,0,0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:d}},{binding:6,resource:{uniform:g}}]),e.renderFullscreen(t,s,w)}finally{(h=w==null?void 0:w.destroy)==null||h.call(w),l.destroy()}}function Vn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,i=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:i,mae:o}}async function $n(e,t,n,r){const o=r??wt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=o.result.w,s=o.result.h,l=i*s*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:E,sumAbs:M}=await e.reduceDiffSumSquaredAbs(t,n,i,s);return Vn(E,M,l)}const f=await e.readback(t),p=await e.readback(n),b=f instanceof Uint8Array?255:1,d=p instanceof Uint8Array?255:1,g=Xn(f,t.width,t.height,b,o.offsetA,o.fit==="fill",i,s),w=Xn(p,n.width,n.height,d,o.offsetB,o.fit==="fill",i,s);let h=0,v=0;const m=[0,0,0],x=[0,0,0];for(let E=0;E<s;E++)for(let M=0;M<i;M++){g(M,E,m),w(M,E,x);for(let _=0;_<3;_++){const y=m[_]-x[_];h+=y*y,v+=Math.abs(y)}}return Vn(h,v,l)}function Xn(e,t,n,r,o,i,s,l){const c=(b,d,g)=>e[(d*t+b)*4+g]??0;if(!i)return(b,d,g)=>{const w=Math.min(Math.max(b+o.x,0),t-1),h=Math.min(Math.max(d+o.y,0),n-1);g[0]=c(w,h,0)/r,g[1]=c(w,h,1)/r,g[2]=c(w,h,2)/r};const f=t-1,p=n-1;return(b,d,g)=>{const w=(b+.5)/s,h=(d+.5)/l,v=w*t-.5,m=h*n-.5,x=Math.floor(v),E=Math.floor(m),M=v-x,_=m-E,y=Math.min(Math.max(x,0),f),C=Math.min(Math.max(x+1,0),f),T=Math.min(Math.max(E,0),p),P=Math.min(Math.max(E+1,0),p);for(let D=0;D<3;D++){const I=c(y,T,D),R=c(C,T,D),S=c(y,P,D),B=c(C,P,D),A=I+(R-I)*M,O=S+(B-S)*M;g[D]=(A+(O-A)*_)/r}}}function Wn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const os=12,Ze=[];function Hn(e){const t=Ze.indexOf(e);t!==-1&&Ze.splice(t,1),Ze.push(e)}function ss(e){const t=Ze.indexOf(e);t!==-1&&Ze.splice(t,1)}function yt(e){e.parked||(ss(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Yn(e){for(;Ze.length>os;){const t=Ze.find(n=>n!==e&&!n.visible)??Ze.find(n=>n!==e);if(!t)break;yt(t)}}function Kn(e){var o,i;if(e.disposed)return;if(Wn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Hn(e),Yn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((i=e.source)==null?void 0:i.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,Hn(e),Yn(e)}function is(e,t){if(e.disposed||!e.source)return!0;try{return Kn(e),!e.surface||!e.srcTexture?!1:(ts(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,yt(e),!1}}function as(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return is(e,t)},park(){e.disposed||yt(e)},restore(){e.disposed||!e.source||Kn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(yt(e),e.source=null,e.disposed=!0)}}}async function cs(e,t){const n=await ft(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return as(r)}function qn(e){e.dispose()}function ls(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:i}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...i?["invert(1)"]:[]].join(" ")}function Zn(e){const n=`cairn-gamma-${a.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:i,exposure:s,offset:l,flipSign:c}=e,f=a.useMemo(()=>ls(e,n),[n,r,o,s,c]);return{gammaFilterId:n,filterStr:f,gamma:i,offset:l}}function Qn({id:e,gamma:t,offset:n}){return u.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:u.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:u.jsxs("feComponentTransfer",{children:[u.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),u.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),u.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function jn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function us({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=jn(e),i=jn(t),s=[];for(let x=0;x<=e;x+=o)s.push(x);const l=[];for(let x=0;x<=t;x+=i)l.push(x);const c=1/n,f=8*c,p=-12*c,b=-2*c,d=r==null?void 0:r.current;let g=0,w=0,h=0,v=0;if(d){const x=d.clientWidth,E=d.clientHeight,M=x/e,_=E/t,y=Math.min(M,_);h=e*y,v=t*y,g=(x-h)/2,w=(E-v)/2}const m=d&&h>0;return u.jsxs(u.Fragment,{children:[u.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?w:0,transform:`translateY(${p}px)`,fontSize:f},children:s.map(x=>u.jsx("span",{className:"mono",style:{position:"absolute",left:m?g+x/e*h:`${x/e*100}%`,transform:"translateX(-50%)"},children:x},x))}),u.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?g:0,transform:`translateX(${b}px)`,fontSize:f},children:l.map(x=>u.jsx("span",{className:"mono",style:{position:"absolute",top:m?w+x/t*v:`${x/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*c}px`},children:x},x))})]})}function fs({label:e,isDraggable:t,onDragStart:n}){return u.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&u.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const ds=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Jn(e,t){const n=getComputedStyle(e),r=ds.map(c=>`${c}:${n.getPropertyValue(c)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const i=e.children,s=t.children,l=Math.min(i.length,s.length);for(let c=0;c<l;c++)Jn(i[c],s[c])}function jt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Jt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function en(e,t,n,r,o){const i=document.createElement("canvas");i.width=Math.max(1,Math.round(e*n)),i.height=Math.max(1,Math.round(t*n));const s=i.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,c)=>i.toBlob(f=>f?l(f):c(new Error("plot-to-png: toBlob returned null")),"image/png"))}function ps(e,t,n){const r=e.cloneNode(!0);Jn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),i="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const c=new Image;c.onload=()=>s(c),c.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),c.src=i})}async function er(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,i=(t==null?void 0:t.background)??jt(e);return en(r,o,Jt(t),i,s=>s.drawImage(e,0,0,r,o))}async function hs(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,i=(t==null?void 0:t.background)??jt(e);try{return await en(r,o,Jt(t),i,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function ms(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const i=o.getBoundingClientRect(),s=i.width*i.height;s>r&&(r=s,n=o)}return n}async function gs(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),i=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??jt(e);if(n){const f=n.getBoundingClientRect(),p=await ps(n,f.width||i,f.height||s);return en(i,s,Jt(t),l,b=>{for(const d of r){const g=d.getBoundingClientRect();b.drawImage(d,g.left-o.left,g.top-o.top,g.width,g.height)}b.drawImage(p,f.left-o.left,f.top-o.top,f.width,f.height)})}if(r.length)return er(r[0],t);const c=ms(e);if(c)return hs(c,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function xs(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const bs=8;function vs(e,t,n,r=bs){return!(t>0)||!(e>0)?n:e<t+r}function tr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function ws(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function ys(e,t){const n=ws(e);return n===null?t:n}function Es(e){return String(e)}const _s={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Ms={boxZoom:u.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:u.jsxs(u.Fragment,{children:[u.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),u.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),u.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),u.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 2v20M2 12h20"}),u.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),u.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),u.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:u.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:u.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),u.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:u.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),u.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),u.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"12",cy:"12",r:"4"}),u.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M4 7h6M7 4v6"}),u.jsx("path",{d:"M14 17h6"}),u.jsx("path",{d:"M6 20l12-16"})]}),layers:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),u.jsx("path",{d:"M3 13l9 5 9-5"})]})};function He({name:e}){return u.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Ms[e]??null})}function nr({icon:e,label:t,title:n,active:r,disabled:o,onClick:i}){return u.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&i()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?u.jsx("span",{"aria-hidden":"true",children:t}):u.jsx(He,{name:e??""})})}function rr(){return u.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Ss({icon:e,title:t,menu:n}){var v;const{options:r,value:o,onSelect:i}=n,[s,l]=a.useState(!1),[c,f]=a.useState(0),p=a.useRef(null),b=tr(r,o),d=e?void 0:((v=r[b])==null?void 0:v.label)??"",g=a.useCallback(()=>{l(m=>{const x=!m;return x&&f(b),x})},[b]),w=a.useCallback(m=>{i(m),l(!1)},[i]);a.useEffect(()=>{if(!s)return;const m=E=>{p.current&&!p.current.contains(E.target)&&l(!1)},x=E=>{E.key==="Escape"&&(E.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",x,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",x,!0)}},[s]);const h=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),f(b),l(!0));return}if(m.key==="ArrowDown")m.preventDefault(),f(x=>(x+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),f(x=>(x-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const x=r[c];x&&w(x.id)}};return u.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[u.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),g()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:h,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",d?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[d?u.jsx("span",{"aria-hidden":"true",children:d}):u.jsx(He,{name:e??""}),u.jsx(He,{name:"caret"})]}),s&&u.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,x)=>{const E=m.id===o,M=x===c;return u.jsx("li",{role:"option","aria-selected":E,children:u.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),w(m.id)},onPointerEnter:()=>f(x),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",M?"bg-bg-hover":"",E?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const Ts=e=>e.format?e.format(e.value):String(e.value);function or({spec:e}){const[t,n]=a.useState(!1),[r,o]=a.useState(""),i=a.useRef(null),s=a.useCallback(()=>{o(Es(e.value)),n(!0)},[e.value]);a.useEffect(()=>{t&&i.current&&(i.current.focus(),i.current.select())},[t]);const l=a.useCallback(()=>{n(f=>(f&&e.onChange(ys(r,e.value)),!1))},[r,e]),c=a.useCallback(()=>n(!1),[]);return u.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:f=>f.stopPropagation(),onDoubleClick:f=>{f.stopPropagation(),t||s()},children:[e.icon?u.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:u.jsx(He,{name:e.icon})}):u.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?u.jsx("input",{ref:i,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:f=>o(f.target.value),onPointerDown:f=>f.stopPropagation(),onDoubleClick:f=>f.stopPropagation(),onKeyDown:f=>{f.stopPropagation(),f.key==="Enter"?(f.preventDefault(),l()):f.key==="Escape"&&(f.preventDefault(),c())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):u.jsxs(u.Fragment,{children:[u.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:f=>e.onChange(Number(f.target.value)),onPointerDown:f=>f.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),u.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ts(e)})]})]})}function As({icon:e,title:t,menu:n,onClose:r}){var b;const{options:o,value:i,onSelect:s}=n,[l,c]=a.useState(!1),f=tr(o,i),p=((b=o[f])==null?void 0:b.label)??"";return u.jsxs("div",{children:[u.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:d=>{d.stopPropagation(),c(g=>!g)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?u.jsx(He,{name:e}):u.jsx("span",{className:"w-[13px]"}),u.jsx("span",{className:"flex-1",children:t}),u.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),u.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:u.jsx(He,{name:"caret"})})]}),l&&o.map(d=>{const g=d.id===i;return u.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":g,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(d.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",g?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[u.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:g?"✓":""}),u.jsx("span",{children:d.label})]},d.id)})]})}function Ps({actions:e,leading:t,sliders:n}){const[r,o]=a.useState(!1),i=a.useRef(null);return a.useEffect(()=>{if(!r)return;const s=c=>{i.current&&!i.current.contains(c.target)&&o(!1)},l=c=>{c.key==="Escape"&&(c.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),u.jsxs("div",{ref:i,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[u.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:u.jsx(He,{name:"ellipsis"})}),r&&u.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?u.jsx(As,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):u.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var c;l.stopPropagation(),!s.disabled&&((c=s.onClick)==null||c.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?u.jsx(He,{name:s.icon}):u.jsx("span",{className:"w-[13px]"}),u.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&u.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>u.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?u.jsx(He,{name:s.icon}):u.jsx("span",{className:"w-[13px]"}),u.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&u.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>u.jsx("div",{className:"px-2 py-1",children:u.jsx(or,{spec:s})},s.id))]})]})}function Cs({controller:e,config:t}){var I,R;const n=a.useRef(null),[r,o]=a.useState(!1),i=a.useRef(r);i.current=r;const s=a.useRef(0),l=`${((I=t==null?void 0:t.leadingButtons)==null?void 0:I.length)??0}:${((R=t==null?void 0:t.sliders)==null?void 0:R.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(a.useEffect(()=>{const S=n.current,B=S==null?void 0:S.parentElement;if(!B)return;const A=()=>{const Q=B.clientWidth;if(!i.current&&n.current){const re=n.current.scrollWidth;re>0&&(s.current=re)}o(vs(Q,s.current,i.current))};let O=0;const U=()=>{O||(O=requestAnimationFrame(()=>{O=0,A()}))},de=new ResizeObserver(U);return de.observe(B),A(),()=>{de.disconnect(),O&&cancelAnimationFrame(O)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const c=e.capabilities,f=t==null?void 0:t.buttons,p=(S,B)=>B&&(f==null?void 0:f[S])!==!1,b=S=>()=>e.setDragMode(S),d=()=>{e.toPNG({filename:"plot"}).then(S=>xs(S,"plot.png")).catch(()=>{})},g=[];p("zoom",c.zoom)&&g.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:b("zoom")}),p("pan",c.pan)&&g.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:b("pan")}),p("select",c.select)&&g.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:b("select")}),p("lasso",c.lasso)&&g.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:b("lasso")});const w=[];p("zoomIn",c.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",c.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const h=[];p("autoscale",c.autoscale)&&h.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",c.reset)&&h.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const v=[];p("screenshot",c.screenshot)&&v.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:d});const m=[g,w,h,v].filter(S=>S.length>0),x=m.flat(),E=(t==null?void 0:t.leadingButtons)??[],M=(t==null?void 0:t.sliders)??[];if(!E.length&&x.length===0&&M.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",C=_==="top-right"||_==="bottom-right",P=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),D={position:"absolute",pointerEvents:"auto",..._s[_]};return r?u.jsx("div",{ref:n,style:D,className:`${P} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:u.jsx(Ps,{actions:x,leading:E,sliders:M})}):u.jsxs("div",{ref:n,style:D,className:`${P} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[u.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[E.length>0&&u.jsxs(u.Fragment,{children:[E.map(S=>S.menu?u.jsx(Ss,{icon:S.icon,title:S.title,menu:S.menu},S.id):u.jsx(nr,{icon:S.icon,label:S.label,title:S.title,active:S.active,disabled:S.disabled,onClick:S.onClick??(()=>{})},S.id)),m.length>0&&u.jsx(rr,{})]}),m.map((S,B)=>u.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[B>0&&u.jsx(rr,{}),S.map(A=>u.jsx(nr,{icon:A.icon,title:A.title,active:A.active,disabled:A.disabled,onClick:A.onClick},A.id))]},S[0].id))]}),M.length>0&&u.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:M.map(S=>u.jsx(or,{spec:S},S.id))})]})}const Rs={zoom:1,pan:{x:0,y:0}},sr=1.3,Ds=.25,ks=64,Ls={buttons:{zoom:!1}};function Is(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Bs=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function tn(e,t){return{id:"colormap",title:"Colormap",menu:{options:Bs,value:e,onSelect:t}}}function Os({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:i,naturalHeight:s,minZoom:l=Ds,maxZoom:c=ks,requestRender:f,onReset:p,extraModified:b=!1}){const d=a.useCallback(y=>{var O;if(!o)return;const C=(O=e.current)==null?void 0:O.getBoundingClientRect(),T=(C==null?void 0:C.width)??0,P=(C==null?void 0:C.height)??0,D=i&&s&&T>0&&P>0?Ht(i,s,T,P):c,I=Math.max(l,Math.min(D,n*y));if(I===n)return;const R=T/2,S=P/2,B=R-(R-r.x)/n*I,A=S-(S-r.y)/n*I;o({zoom:I,pan:{x:B,y:A}})},[o,e,i,s,c,l,n,r.x,r.y]),g=a.useCallback(()=>d(sr),[d]),w=a.useCallback(()=>d(1/sr),[d]),h=a.useCallback(()=>{o==null||o(Rs),p==null||p()},[o,p]),v=a.useCallback(y=>{const C={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};f==null||f();const T=t==null?void 0:t.current;if(T)return er(T,C);const P=e.current;return P?gs(P,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,f]),m=a.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),x=n!==1||r.x!==0||r.y!==0||b,E=a.useCallback(y=>{},[]),M=a.useCallback(y=>{},[]),_=a.useCallback(()=>{},[]);return a.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:x,setDragMode:E,setHoverMode:M,toggleSpikelines:_,zoomIn:g,zoomOut:w,autoscale:h,reset:h,toPNG:v}),[m,x,E,M,_,g,w,h,v])}const Fs={zoom:1,pan:{x:0,y:0}};function Et({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:i,pan:s,onViewportChange:l,naturalDims:c,checkerboard:f,wrapperClassName:p,wrapperStyle:b,viewportPadding:d,header:g,surface:w,showAxes:h,overlayNode:v,overlay:m,notationSeed:x,exportCanvasRef:E,requestRender:M,leadingMenus:_,displayAdjust:y,depthSlider:C,onReset:T,extraModified:P,label:D,showLabelChip:I,isDraggable:R=!1,onDragStart:S,extraChips:B}){const[A,O]=a.useState(x),[U,de]=a.useState(!1),{containerProps:Q}=Ln({containerRef:r,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h}),re=a.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),T==null||T()},[y,T]),ye=a.useCallback(()=>{l==null||l(Fs),re()},[l,re]),Se=Os({rootRef:r,canvasRef:E,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h,requestRender:M,onReset:re,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!P}),le=a.useMemo(()=>{const he=[];if(C&&he.push(C),!y)return he.length?he:void 0;const j=($,N)=>`${$>=0?"+":"−"}${Math.abs($).toFixed(N)}`;return he.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:$=>j($,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:$=>j($,2)}),he},[y,C]),Ae=a.useMemo(()=>({...Ls,leadingButtons:[..._??[],...U?[Is(A,O)]:[]],sliders:le}),[U,A,_,le]),ve=" cairn-checkerboard",Ee="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(f==="pane"?ve:""),Re=p+(f==="wrapper"?ve:""),pe="render"in m?m.render({notation:A,setOverlayActive:de}):m.hasSource&&c?u.jsx(nt,{imageElRef:m.displayElRef,naturalWidth:c.w,naturalHeight:c.h,zoom:i,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:A,version:m.version,onActiveChange:de}):null;return u.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[g,n&&u.jsx(Cs,{controller:Se,config:Ae}),u.jsxs("div",{ref:r,className:Ee,style:{padding:d,...Q.style},onPointerDown:Q.onPointerDown,onPointerMove:Q.onPointerMove,onPointerUp:Q.onPointerUp,onPointerCancel:Q.onPointerCancel,onDoubleClick:ye,...t,children:[u.jsxs("div",{ref:o,className:Re,style:b,children:[w,h&&c&&u.jsx(us,{naturalWidth:c.w,naturalHeight:c.h,zoom:i,containerRef:o}),v]}),pe,!n&&U&&u.jsx(Bn,{notation:A,onChange:O})]}),I&&u.jsx(fs,{label:D,isDraggable:R,onDragStart:S}),B]})}const ir={inFlight:!1,pending:null};function Us(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function Ns(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:ir,launch:null}}const Gs=1e3,zs=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),ar=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function cr(e){const t=e.deep,n=(t==null?void 0:t.zMin)??0,r=(t==null?void 0:t.zMax)??0,[o,i,s]=ct(r),[l,c]=a.useState(null),f=a.useRef(t);f.current=t;const p=a.useRef(r);p.current=r;const b=a.useRef(o),d=a.useRef(ir),g=a.useRef(null),w=a.useCallback(M=>{const _=f.current;if(!_)return;const y=()=>{const C=Ns(d.current);d.current=C.state,C.launch!=null&&w(C.launch)};_.flatten(M).then(C=>{b.current===M&&M<p.current&&(g.current!=null&&ar(g.current),g.current=zs(()=>{g.current=null,c(C)})),y()}).catch(y)},[]),h=a.useCallback(M=>{const _=Us(d.current,M);d.current=_.state,_.launch!=null&&w(_.launch)},[w]);a.useEffect(()=>()=>{g.current!=null&&ar(g.current),t==null||t.dispose()},[t]),a.useEffect(()=>{if(t){if(b.current=o,o>=r){c(null);return}h(o)}},[t,o,r,h]);const v=a.useMemo(()=>t&&l!=null?{...e,data:l}:e,[e,t,l]),m=t!=null&&n>0&&r/n>Gs,x=a.useMemo(()=>{if(!t||!(r>n))return;const M=_=>Math.abs(_)>=1e3||Math.abs(_)<.01?_.toExponential(2):_.toFixed(3);if(m){const _=Math.log10(n),y=Math.log10(r);return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this (log scale). Double-click to type a Z.",min:_,max:y,step:(y-_)/200,value:Math.log10(Math.max(n,Math.min(o,r))),onChange:C=>i(10**C),format:C=>M(10**C)}}return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this. Double-click to type a Z.",min:n,max:r,step:(r-n)/200,value:o,onChange:_=>i(_),format:_=>M(_)}},[t,n,r,o,m,i]),E=a.useCallback(()=>{s.reset(),c(null)},[s]);return{hdr:v,slider:x,reset:E,isModified:s.isModified}}function lr(e){return"hdr"in e&&e.hdr!=null}function ur(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Pe(e){return Number.isFinite(e)?e:0}const Vs={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function $s(e,t,n,r,o=0){const{h:i,w:s,c:l}=ur(e.shape),c=e.precision==="f16-bits"?Tn(e.data):e.data,f=mo(t),p=new Uint8ClampedArray(s*i*4);for(let b=0;b<s*i;b++){const d=b*l;let g,w,h,v=1;l===1?g=w=h=Pe(c[d]):l===3?(g=Pe(c[d]),w=Pe(c[d+1]),h=Pe(c[d+2])):(g=Pe(c[d]),w=Pe(c[d+1]),h=Pe(c[d+2]),v=Pe(c[d+3]));const m=[dt(g,n,o),dt(w,n,o),dt(h,n,o)],[x,E,M]=f(m),_=b*4;p[_]=255*Nt(x,r),p[_+1]=255*Nt(E,r),p[_+2]=255*Nt(M,r),p[_+3]=255*(v<0?0:v>1?1:v)}return new ImageData(p,s,i)}function Xs(e){var G,K;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:i="auto",colormap:s="none",showAxes:l=!1,processing:c=Vs,zoom:f=1,pan:p={x:0,y:0},onViewportChange:b,onNaturalSize:d,label:g,isDraggable:w=!1,onDragStart:h,overlay:v,overlaySettings:m,pixelValueNotation:x="decimal",toolbar:E=!0}=e,[M,_,y]=ct(s);a.useEffect(()=>{_(s)},[s,_]);const C=a.useRef(null),T=a.useRef(null),P=a.useRef(null),D=a.useRef(null),I=a.useRef(null),R=a.useRef(null),S=a.useRef(null),[B,A]=a.useState(0),O=a.useCallback(()=>A(L=>L+1),[]),U=a.useMemo(()=>({get current(){const L=I.current;return L instanceof HTMLCanvasElement?L:null}}),[]),de=a.useCallback(L=>{C.current=L,L&&(I.current=L)},[]),Q=a.useCallback(L=>{T.current=L,L&&(I.current=L)},[]),re=a.useCallback(L=>{L&&(I.current=L)},[]),[ye,Se]=a.useState(!1),[le,Ae]=a.useState(!1),[ve,Ee]=a.useState(null),{flipSign:Re}=c,{gammaFilterId:pe,filterStr:he,gamma:j,offset:$}=Zn(c),N=!r&&o!=="none"&&n!=null&&t!=null,_e=o!=="none"&&n!=null,xe=M!=="none"&&!N&&!(r&&_e)&&t!=null;a.useEffect(()=>{if(!xe||!t){Ae(!1);return}let L=!1;Ae(!1);const q=`${t}::${M}`,te=Vt(q);if(te){const W=T.current;if(W){W.width=te.width,W.height=te.height;const ne=W.getContext("2d");ne&&ne.putImageData(te,0,0),S.current=te,O(),Ee({w:te.width,h:te.height}),d==null||d(te.width,te.height),Ae(!0)}return}const J=new Image;return J.onload=()=>{if(L)return;const W=document.createElement("canvas");W.width=J.naturalWidth,W.height=J.naturalHeight;const ne=W.getContext("2d");if(!ne)return;ne.drawImage(J,0,0);const we=ne.getImageData(0,0,W.width,W.height),De=zt(M),ae=Gt(we,M,De);$t(q,ae);const Te=T.current;if(!Te||L)return;Te.width=ae.width,Te.height=ae.height;const ce=Te.getContext("2d");ce&&ce.putImageData(ae,0,0),S.current=ae,O(),Ee({w:ae.width,h:ae.height}),d==null||d(ae.width,ae.height),Ae(!0)},J.src=t,()=>{L=!0}},[xe,t,M]);const me=a.useCallback((L,q)=>{Ee(te=>te&&te.w===L&&te.h===q?te:{w:L,h:q}),d==null||d(L,q)},[]);a.useEffect(()=>{if(!t){R.current=null,S.current=null,O();return}let L=!1;return Je(t).then(q=>{L||(R.current=q,M==="none"&&(S.current=q),O())}),()=>{L=!0}},[t,M,O]);const ge=a.useCallback((L,q,te)=>{const J=R.current;if(!J||L<0||q<0||L>=J.width||q>=J.height)return null;const W=(q*J.width+L)*4,ne=J.data[W],we=J.data[W+1],De=J.data[W+2],ae=S.current;let Te=ne,ce=we,Be=De;if(ae&&ae.width===J.width&&ae.height===J.height){const Fe=(q*ae.width+L)*4;Te=ae.data[Fe],ce=ae.data[Fe+1],Be=ae.data[Fe+2]}const Ye=(.299*Te+.587*ce+.114*Be)/255;return tt(M!=="none"||ne===we&&we===De?[ne]:[ne,we,De],"uint8",te,Ye)},[M]);a.useEffect(()=>{if(!N){Se(!1);return}let L=!1;const q=Co(),te=q==="gpu"||q==="auto",J=`${n}::${t}::${o}::${M}`;if(q!=="gpu"){const W=Vt(J);if(W){const ne=C.current;if(ne){(ne.width!==W.width||ne.height!==W.height)&&(ne.width=W.width,ne.height=W.height);const we=ne.getContext("2d");we&&we.putImageData(W,0,0),me(W.width,W.height),Se(!0)}return}}return(async()=>{const[W,ne]=await Promise.all([Je(n),Je(t)]);if(L||!W||!ne)return;const De=o.includes("signed")?"signed":"positive",ae=M!=="none"?Ot(M):null,Te={diffMode:o,colormap:ae,cmapMode:De};if(te)try{const Oe=C.current;if(Oe){const Fe=Ao(W,ne,Te,Oe);if(Fe){if(L)return;me(Fe.width,Fe.height),Se(!0);return}}}catch(Oe){console.warn("[cairn] WebGL 2 diff error:",Oe)}if(q==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let ce=wo(W,ne,o);M!=="none"&&(ce=Gt(ce,M,De)),$t(J,ce);const Be=C.current;if(!Be||L)return;(Be.width!==ce.width||Be.height!==ce.height)&&(Be.width=ce.width,Be.height=ce.height);const Ye=Be.getContext("2d");Ye&&Ye.putImageData(ce,0,0),me(ce.width,ce.height),Se(!0)})(),()=>{L=!0}},[n,t,o,N,M,d]);const Me=i==="auto"?void 0:i,X=Re?{filter:"invert(1)"}:{},H=v&&(m!=null&&m.enabled)&&ve&&t&&((((G=v.boxes)==null?void 0:G.length)??0)>0||(((K=v.masks)==null?void 0:K.length)??0)>0)?u.jsx(Kt,{data:v,settings:m,naturalWidth:ve.w,naturalHeight:ve.h}):void 0,oe=t?N?u.jsxs(u.Fragment,{children:[!ye&&u.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),u.jsx("canvas",{ref:de,className:"w-full h-full object-contain block",style:{display:ye?"block":"none",imageRendering:Me,...X}})]}):xe?u.jsxs(u.Fragment,{children:[!le&&u.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),u.jsx("canvas",{ref:Q,className:"w-full h-full object-contain block",style:{display:le?"block":"none",imageRendering:Me,...X}})]}):u.jsx("img",{ref:re,src:t,alt:g,className:"w-full h-full object-contain block",draggable:!1,style:{filter:he,imageRendering:Me},onLoad:L=>{const q=L.currentTarget;Ee({w:q.naturalWidth,h:q.naturalHeight}),d==null||d(q.naturalWidth,q.naturalHeight)}}):u.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return u.jsx(Et,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:E,paneRef:P,wrapperRef:D,zoom:f,pan:p,onViewportChange:b,naturalDims:ve,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${f})`,transformOrigin:"0 0"},viewportPadding:l&&ve?"16px 4px 4px 28px":"4px",header:u.jsx(Qn,{id:pe,gamma:j,offset:$}),surface:oe,showAxes:l,overlayNode:H,overlay:{displayElRef:I,sample:ge,version:B,hasSource:!!t},notationSeed:x,exportCanvasRef:U,leadingMenus:[tn(M,L=>_(L))],onReset:y.reset,extraModified:y.isModified,label:g,showLabelChip:!0,isDraggable:w,onDragStart:h})}function Ws(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:i="",interpolation:s="auto",zoom:l=1,pan:c={x:0,y:0},onViewportChange:f,pixelValueNotation:p="decimal",toolbar:b=!0}=e,d=cr(e.hdr),g=d.hdr,w=a.useRef(null),h=a.useRef(null),v=a.useRef(null),[m,x]=a.useState(null),E=a.useRef(null),[M,_]=a.useState(0),[y,C]=a.useState(0),[T,P]=a.useState(0);a.useEffect(()=>{const R=w.current;if(!R)return;let S;try{S=$s(g,t,n+y,r,T)}catch(A){console.error("[cairn] HDR tone-map error:",A);return}(R.width!==S.width||R.height!==S.height)&&(R.width=S.width,R.height=S.height);const B=R.getContext("2d");B&&(B.putImageData(S,0,0),E.current=S,_(A=>A+1),x(A=>A&&A.w===S.width&&A.h===S.height?A:{w:S.width,h:S.height}))},[g,t,n,r,y,T]);const D=a.useCallback((R,S,B)=>{const A=m;if(!A||R<0||S<0||R>=A.w||S>=A.h)return null;const O=g.shape.length===2?1:g.shape[2]??1,U=(S*A.w+R)*O,de=g.data,Q=g.precision==="f16-bits"?le=>mt(de[le]??0):le=>de[le]??0,re=E.current;let ye=.5;if(re&&re.width===A.w&&re.height===A.h){const le=(S*A.w+R)*4;ye=(.299*re.data[le]+.587*re.data[le+1]+.114*re.data[le+2])/255}const Se=O===1?[Q(U)]:[Q(U),Q(U+1),Q(U+2)];return tt(Se,"unit",B,ye)},[g,m]),I=s==="auto"?void 0:s;return u.jsx(Et,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:h,wrapperRef:v,zoom:l,pan:c,onViewportChange:f,naturalDims:m,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${c.x}px, ${c.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:o&&m?"16px 4px 4px 28px":"4px",surface:u.jsx("canvas",{ref:w,className:"w-full h-full object-contain block",style:{imageRendering:I}}),showAxes:o,overlay:{displayElRef:w,sample:D,version:M,hasSource:!0},notationSeed:p,exportCanvasRef:w,displayAdjust:{exposureEV:y,offset:T,onExposureChange:C,onOffsetChange:P},depthSlider:d.slider,onReset:d.reset,extraModified:d.isModified,label:i,showLabelChip:!!i})}function nn(e){return lr(e)?u.jsx(Ws,{...e}):u.jsx(Xs,{...e})}const fr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Hs="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function Ys(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Ks(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function qs(e,t){if(e==="no-hdr-display")switch(Ks(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=Ys(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Zs(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function dr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const pr=new Set;function hr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return pr.has(e)}function Qs(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}pr.add(e)}const mr=new Set;let _t=null,st=null;function gr(){st&&st.parentNode&&st.parentNode.removeChild(st),st=null,_t=null}function js(e){const t=dr(e,window.location.pathname),n=qs(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Zs(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const i=document.createElement("div");i.textContent=n,i.style.marginBottom="4px";const s=document.createElement("a");s.href=Hs,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{Qs(t),gr()}),r.appendChild(o),r.appendChild(i),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),st=r,_t=e}function xr(e){if(typeof document>"u"||typeof window>"u"||mr.has(e))return;mr.add(e);const t=dr(e,window.location.pathname);if(hr(t))return;const n=()=>{if(!hr(t)){if(_t!==null)if(fr[e]<fr[_t])gr();else return;js(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Js={data:new Float32Array(0),shape:[0,0],dtype:"<f4"},ei=["linear","srgb","reinhard","aces"];function ti(e){return e&&ei.includes(e)?e:"srgb"}function ni(e){const{h:t,w:n,c:r}=ur(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let c=0;c<n*t;c++){const f=c*r,p=c*4;if(r===1){const b=s[f];l[p]=b,l[p+1]=b,l[p+2]=b,l[p+3]=ht}else l[p]=s[f],l[p+1]=s[f+1],l[p+2]=s[f+2],l[p+3]=r>=4?s[f+3]:ht}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,i=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let c,f,p,b=1;r===1?c=f=p=Pe(o[l]):r===3?(c=Pe(o[l]),f=Pe(o[l+1]),p=Pe(o[l+2])):(c=Pe(o[l]),f=Pe(o[l+1]),p=Pe(o[l+2]),b=Pe(o[l+3]));const d=s*4;i[d]=c,i[d+1]=f,i[d+2]=p,i[d+3]=b}return{data:i,width:n,height:t,format:"rgba32float"}}function br(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),i=n*o,s=r*o,l=(t.width-i)/2,c=(t.height-s)/2,f=Math.max(e.zoom,1e-6),p=t.width/(f*i),b=t.height/(f*s),d=-l/i-e.pan.x/(f*i),g=-c/s-e.pan.y/(f*s);return{x:d,y:g,w:p,h:b}}function vr(e,t,n,r){const o=e.w*n,i=e.h*r;return o<=0||i<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/i)}function ri(e){var ge,Me;const t=lr(e),n=cr(t?e.hdr:Js),r=a.useRef(null),o=a.useRef(null),i=a.useRef(null),s=a.useRef(null),l=a.useRef(!1),[c,f]=a.useState(!1),[p,b]=a.useState(!1),[d,g]=a.useState(null),[w,h]=a.useState(0),[v,m]=a.useState(0),[x,E]=a.useState({x:0,y:0,w:1,h:1}),M=a.useRef(null),_=a.useRef(null),[y,C]=a.useState(0),T=e.zoom??1,P=e.pan??{x:0,y:0},D=e.onViewportChange,I=t?"none":e.colormap??"none",[R,S]=a.useState(I);a.useEffect(()=>{S(I)},[I]);const B=t?"none":R,A=a.useRef(I),O=a.useCallback(()=>{S(A.current)},[]),[U,de]=a.useState(0),[Q,re]=a.useState(0),ye=Yt();a.useEffect(()=>{const X=r.current;if(!X)return;let H=!1;return ft().then(oe=>{var q;if(H)return;const G=((q=oe.probeExtendedToneMapping)==null?void 0:q.call(oe))??!1,K=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,L=G&&K&&t;l.current=L,t&&!L&&xr(G?"no-hdr-display":"no-hdr-browser"),cs(X,{hdr:L}).then(te=>{if(H){qn(te);return}s.current=te,b(!0)}).catch(te=>{H||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",te),f(!0))})}).catch(oe=>{H||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",oe),f(!0))}),()=>{H=!0,s.current&&(qn(s.current),s.current=null)}},[]),a.useEffect(()=>{const X=o.current;if(!X)return;const H=new ResizeObserver(()=>m(oe=>oe+1));return H.observe(X),()=>H.disconnect()},[]),a.useEffect(()=>{const X=o.current;if(!X)return;const H=new IntersectionObserver(oe=>{const G=oe[0];if(!G)return;const K=s.current;K&&(K.setVisible(G.isIntersecting),G.isIntersecting?K.isParked&&(K.restore(),m(L=>L+1)):K.park())},{threshold:0});return H.observe(X),()=>H.disconnect()},[]),a.useEffect(()=>{var oe;if(!t||!p)return;const X=n.hdr;M.current=X;const H=ni(X);(oe=s.current)==null||oe.setSource(H),g(G=>G&&G.w===H.width&&G.h===H.height?G:{w:H.width,h:H.height}),C(G=>G+1),h(G=>G+1)},[t,p,t?n.hdr:null]),a.useEffect(()=>{if(t||!p)return;const X=e,H=X.imageUrl,oe=R;if(!H){_.current=null,g(null),C(K=>K+1);return}let G=!1;return Je(H).then(K=>{var te,J;if(G||!K)return;let L=K;if(oe!=="none"){const W=`gpu::${H}::${oe}::ev${U}::off${Q}`,ne=Vt(W);if(ne)L=ne;else{const we=zt(oe);L=Gt(K,oe,we,U,Q),$t(W,L)}}_.current=K;const q={data:L.data,width:L.width,height:L.height,format:"rgba8unorm"};(te=s.current)==null||te.setSource(q),g(W=>W&&W.w===L.width&&W.h===L.height?W:{w:L.width,h:L.height}),(J=X.onNaturalSize)==null||J.call(X,L.width,L.height),C(W=>W+1),h(W=>W+1)}),()=>{G=!0}},[t,p,t?null:e.imageUrl,t?null:R,t?0:U,t?0:Q]);const Se=t?e.exposure??0:0,le=t?e.tonemap:void 0,Ae=t?e.gamma:void 0,ve=a.useCallback(()=>{const X=s.current;if(!X||!p||!d)return;const H=o.current,oe=i.current,G=oe?oe.getBoundingClientRect():H?H.getBoundingClientRect():{width:d.w,height:d.h},K=br({zoom:T,pan:P},G,d.w,d.h);E(J=>J.x===K.x&&J.y===K.y&&J.w===K.w&&J.h===K.h?J:K),G.width>0&&G.height>0&&X.resize(Math.round(G.width*ye),Math.round(G.height*ye));const L=vr(K,G,d.w,d.h)>=qt?"nearest":"linear",q=K,te=t?{exposureEV:Se+U,offset:Q,operator:l.current?"extended":ti(le),gamma:Ae,isScalar:!1,hdrOut:l.current,uv:q,filter:L}:{exposureEV:B!=="none"?0:U,offset:B!=="none"?0:Q,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:q,filter:L};try{X.render(te)||f(!0)}catch(J){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",J),f(!0)}},[p,d,T,P.x,P.y,Se,U,Q,le,Ae,t,B,ye]);a.useEffect(()=>{ve()},[ve,w,v]);const Ee=a.useCallback((X,H,oe)=>{if(t){const ne=M.current,we=d;if(!ne||!we||X<0||H<0||X>=we.w||H>=we.h)return null;const De=ne.shape.length===2?1:ne.shape[2]??1,ae=(H*we.w+X)*De,Te=ne.data,ce=ne.precision==="f16-bits"?Oe=>mt(Te[Oe]??0):Oe=>Te[Oe]??0,Be=.5,Ye=De===1?[ce(ae)]:[ce(ae),ce(ae+1),ce(ae+2)];return tt(Ye,"unit",oe,Be)}const G=_.current;if(!G||X<0||H<0||X>=G.width||H>=G.height)return null;const K=(H*G.width+X)*4,L=G.data[K],q=G.data[K+1],te=G.data[K+2],J=(.299*L+.587*q+.114*te)/255;return tt(B!=="none"||L===q&&q===te?[L]:[L,q,te],"uint8",oe,J)},[t,d,B]),Re=e.showAxes??!1,pe=t?e.label??"":e.label,he=e.interpolation??"auto",j=he==="auto"?void 0:he,$=t?void 0:e.overlay,N=t?void 0:e.overlaySettings,_e=t?!1:e.isDraggable??!1,xe=t?void 0:e.onDragStart;if(c)return t?u.jsx(nn,{...e}):u.jsx(nn,{...e});const me=$&&(N!=null&&N.enabled)&&d&&((((ge=$.boxes)==null?void 0:ge.length)??0)>0||(((Me=$.masks)==null?void 0:Me.length)??0)>0)?u.jsx(Kt,{data:$,settings:N,naturalWidth:d.w,naturalHeight:d.h}):void 0;return u.jsx(Et,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":p},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:o,wrapperRef:i,zoom:T,pan:P,onViewportChange:D,naturalDims:d,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Re&&d?"16px 4px 4px 28px":0,surface:u.jsx("canvas",{ref:r,className:"w-full h-full block",style:{imageRendering:j},"data-gpu-image-canvas":!0}),showAxes:Re,overlayNode:me,overlay:{displayElRef:r,sample:Ee,version:y,hasSource:!0,sourceWindow:x},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:r,requestRender:ve,leadingMenus:t?void 0:[tn(B,X=>S(X))],displayAdjust:{exposureEV:U,offset:Q,onExposureChange:de,onOffsetChange:re},depthSlider:n.slider,onReset:()=>{O(),n.reset()},extraModified:R!==A.current||n.isModified,label:pe,showLabelChip:!!pe,isDraggable:_e,onDragStart:xe})}const Mt=new Map;function Xe(e){if(Mt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Mt.set(e.id,e)}function Qe(e){return Mt.get(e)}function oi(){return Array.from(Mt.values())}function wr(e,t){return{...e.params??{},...t??{}}}const si={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ii={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},ai={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},ci={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},li={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},ui={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},yr=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];di(yr);const rn=[1.052156925,1,.91835767],fi=.7;function di(e){const[t,n,r]=e[0],[o,i,s]=e[1],[l,c,f]=e[2],p=i*f-s*c,b=-(o*f-s*l),d=o*c-i*l,w=1/(t*p+n*b+r*d);return[[p*w,-(n*f-r*c)*w,(n*s-r*i)*w],[b*w,(t*f-r*l)*w,-(t*s-r*o)*w],[d*w,-(t*c-n*l)*w,(t*i-n*o)*w]]}function pi(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const on=6/29;function sn(e){return e>on**3?Math.cbrt(e):e/(3*on*on)+4/29}function Er(e,t,n){const[r,o,i]=pi(yr,e,t,n),s=sn(r*rn[0]),l=sn(o*rn[1]),c=sn(i*rn[2]),f=116*l-16,p=500*(s-l),b=200*(l-c);return[f,.01*f*p,.01*f*b]}function hi(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function mi(){const e=Er(0,1,0),t=Er(0,0,1);return Math.pow(hi(e,t),fi)}const _r=mi(),gi=.082;function Mr(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],i=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(i/(2*Math.PI**2))*e),l=1/e,c=Math.PI**2,f=[0,0,0];for(let p=-s;p<=s;p++)for(let b=-s;b<=s;b++){const d=(b*l)**2+(p*l)**2;for(let g=0;g<3;g++)f[g]+=t[g]*Math.sqrt(Math.PI/n[g])*Math.exp(-c*d/n[g])+r[g]*Math.sqrt(Math.PI/o[g])*Math.exp(-c*d/o[g])}return{r:s,deltaX:l,sums:f}}function Sr(e){const t=.5*gi*e,n=Math.ceil(3*t);let r=0,o=0,i=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const c=Math.exp(-(l*l+s*s)/(2*t*t)),f=-l*c,p=(l*l/(t*t)-1)*c;f>0&&(r+=f),p>0?o+=p:i-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:i}}const xi=`
${Ie}
${vt}
${ot}
${bt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,bi=`
${Ie}
${vt}
${ot}
${bt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,St=`
${Ie}
${vt}
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
`,Tr=`
${Ie}
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
`;function We(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Tt(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},i=r!=null&&r.fill?1:0;return[We(e,[o.x,o.y,i,0]),We(e+1,[n.width,n.height,0,0])]}function At(e){return[We(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),We(2,[e.sums[2],0,0,0])]}function Ar(e){return[We(4,[_r,e.sd,e.r,e.edgeNorm]),We(5,[e.pointPos,e.pointNeg,0,0])]}function Pr(e,t,n,r,o,i=""){const s=Mr(e),l=Sr(e),c=`ycxczA${i}`,f=`ycxczB${i}`,p=`labA${i}`,b=`labB${i}`,d=`flip${i}`;return{passes:[{name:c,shader:t,inputs:[n],output:c,uniforms:()=>Tt(1,"a",o)},{name:f,shader:t,inputs:[r],output:f,uniforms:()=>Tt(1,"b",o)},{name:p,shader:St,inputs:[c],output:p,uniforms:()=>At(s)},{name:b,shader:St,inputs:[f],output:b,uniforms:()=>At(s)},{name:d,shader:Tr,inputs:[p,b,c,f],output:d,uniforms:()=>Ar(l)}],flipRef:d}}const vi={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Pr(t,xi,"srcA","srcB",e);return{passes:n,final:r}}},wi={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Pr(t,bi,"srcA","srcB",e);return{passes:n,final:r}}},Cr=`
${Ie}
${vt}
${ot}
${bt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_exp: vec4<f32>; // exposure (c_i), 0, 0, 0
@group(0) @binding(8) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(11) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0

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
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z).rgb;
  let scale = exp2(u_exp.x);
  let x = scale * s;
  let tm = vec3<f32>(aces(x.r), aces(x.g), aces(x.b));
  return vec4<f32>(flip_linrgb2ycxcz(tm), 1.0);
}
`,yi=`
${Ie}
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
`,Ei={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),i=(r-n)/Math.max(o-1,1),s=Mr(t),l=Sr(t),c=[];let f=null;for(let p=0;p<o;p++){const b=n+p*i,d=`_e${p}`,g=`ycxczA${d}`,w=`ycxczB${d}`,h=`labA${d}`,v=`labB${d}`,m=`acc${d}`;c.push({name:g,shader:Cr,inputs:["srcA"],output:g,uniforms:()=>[We(1,[b,0,0,0]),...Tt(2,"a",e)]},{name:w,shader:Cr,inputs:["srcB"],output:w,uniforms:()=>[We(1,[b,0,0,0]),...Tt(2,"b",e)]},{name:h,shader:St,inputs:[g],output:h,uniforms:()=>At(s)},{name:v,shader:St,inputs:[w],output:v,uniforms:()=>At(s)}),f===null?c.push({name:m,shader:Tr,inputs:[h,v,g,w],output:m,uniforms:()=>Ar(l)}):c.push({name:m,shader:yi,inputs:[h,v,g,w,f],output:m,uniforms:()=>[We(5,[_r,l.sd,l.r,l.edgeNorm]),We(6,[l.pointPos,l.pointNeg,0,0])]}),f=m}return{passes:c,final:f}}},_i=.01,Mi=.03,Rr=1,Dr=1.5,kr=5,Lr=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,Si=`
${Ie}
${Lr}
@group(0) @binding(0) var srcA: texture_2d<f32>;
@group(0) @binding(3) var srcB: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dimsA = vec2<i32>(textureDimensions(srcA));
  let dimsB = vec2<i32>(textureDimensions(srcB));
  let px = vec2<i32>(in.position.xy);
  let ya = ssim_luma(textureLoad(srcA, clamp(px, vec2<i32>(0), dimsA - vec2<i32>(1)), 0).rgb);
  let yb = ssim_luma(textureLoad(srcB, clamp(px, vec2<i32>(0), dimsB - vec2<i32>(1)), 0).rgb);
  return vec4<f32>(ya, yb, ya * ya, yb * yb);
}
`,Ti=`
${Ie}
${Lr}
@group(0) @binding(0) var srcA: texture_2d<f32>;
@group(0) @binding(3) var srcB: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dimsA = vec2<i32>(textureDimensions(srcA));
  let dimsB = vec2<i32>(textureDimensions(srcB));
  let px = vec2<i32>(in.position.xy);
  let ya = ssim_luma(textureLoad(srcA, clamp(px, vec2<i32>(0), dimsA - vec2<i32>(1)), 0).rgb);
  let yb = ssim_luma(textureLoad(srcB, clamp(px, vec2<i32>(0), dimsB - vec2<i32>(1)), 0).rgb);
  return vec4<f32>(ya * yb, 0.0, 0.0, 0.0);
}
`,Ir=`
${Ie}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_blur: vec4<f32>;

fn ssim_reflect(i: i32, n: i32) -> i32 {
  if (n == 1) { return 0; }
  let period = 2 * n;
  var p = ((i % period) + period) % period;
  if (p >= n) { p = period - 1 - p; }
  return p;
}

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dims = vec2<i32>(textureDimensions(src));
  let px = vec2<i32>(in.position.xy);
  let dir = vec2<i32>(i32(round(u_blur.x)), i32(round(u_blur.y)));
  let r = i32(round(u_blur.z));
  let sigma = u_blur.w;
  var acc = vec4<f32>(0.0);
  var wsum = 0.0;
  for (var k = -r; k <= r; k = k + 1) {
    let g = exp(-0.5 * f32(k * k) / (sigma * sigma));
    let sx = ssim_reflect(px.x + dir.x * k, dims.x);
    let sy = ssim_reflect(px.y + dir.y * k, dims.y);
    acc = acc + g * textureLoad(src, vec2<i32>(sx, sy), 0);
    wsum = wsum + g;
  }
  return acc / wsum;
}
`,Ai=`
${Ie}
@group(0) @binding(0) var statsA: texture_2d<f32>; // (ux, uy, E[x^2], E[y^2])
@group(0) @binding(3) var statsB: texture_2d<f32>; // (E[xy], .., .., ..)
@group(0) @binding(8) var<uniform> u_c: vec4<f32>; // C1, C2, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(statsA, px, 0);
  let exy = textureLoad(statsB, px, 0).x;
  let ux = s.x;
  let uy = s.y;
  let vx = s.z - ux * ux;
  let vy = s.w - uy * uy;
  let vxy = exy - ux * uy;
  let c1 = u_c.x;
  let c2 = u_c.y;
  let a1 = 2.0 * ux * uy + c1;
  let a2 = 2.0 * vxy + c2;
  let b1 = ux * ux + uy * uy + c1;
  let b2 = vx + vy + c2;
  let ssim = (a1 * a2) / (b1 * b2);
  let err = 1.0 - ssim;
  return vec4<f32>(err, err, err, 1.0);
}
`;function an(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Br(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Ir,inputs:[e],output:n,uniforms:()=>[an(1,[1,0,kr,Dr])]},{name:r,shader:Ir,inputs:[n],output:r,uniforms:()=>[an(1,[0,1,kr,Dr])]}],out:r}}const Pi={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(_i*Rr)**2,n=(Mi*Rr)**2,r=Br("momA","statsA"),o=Br("momB","statsB");return{passes:[{name:"momA",shader:Si,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:Ti,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:Ai,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[an(2,[t,n,0,0])]}],final:"ssim"}}};let Or=!1;function Ci(){Or||(Or=!0,Xe(ii),Xe(si),Xe(ai),Xe(li),Xe(ci),Xe(ui),Xe(vi),Xe(Ei),Xe(wi),Xe(Pi))}Ci();function Fr(){const e=[];for(const n of oi())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=Qe("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Ri(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Ur=new WeakMap;function cn(e,t,n,r){let o=Ur.get(e);o||(o=new Map,Ur.set(e,o));const i=`${t}::${r}`;let s=o.get(i);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(i,s)),s}function Di(e){return`
${Ie}
${ot}
${bt}
@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_map: vec4<f32>;  // offAx, offAy, offBx, offBy
@group(0) @binding(11) var<uniform> u_res: vec4<f32>; // resultW, resultH, fitFill, 0
${e}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  // px is the RESULT/overlap-grid pixel. Each source is sampled through the
  // align/fit mapping (integer texel offset per source under crop; normalized-uv
  // bilinear rescale under fill) -- see SOURCE_MAP_WGSL / compare-align.ts.
  let px = vec2<i32>(in.position.xy);
  let a = mapSample(texA, px, u_map.x, u_map.y, u_res.x, u_res.y, u_res.z);
  let b = mapSample(texB, px, u_map.z, u_map.w, u_res.x, u_res.y, u_res.z);
  return kernel(a, b);
}
`}const Pt="rgba16float";function ki(e,t,n,r,o,i){var v,m;const s=Qe(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=i??wt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),c=l.result.w,f=l.result.h,p=l.fit==="fill"?1:0,b=wr(s,o);if(s.kind==="pointwise"){const x=e.createTexture(c,f,Pt),E=cn(e,`pw:${s.id}`,Di(s.source),Pt),M=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),_=new Float32Array([c,f,p,0]);let y;try{y=e.createBindGroup(E,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:M}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(x,E,y)}finally{(v=y==null?void 0:y.destroy)==null||v.call(y)}return x}const d={width:c,height:f,params:b,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},g=s.buildPasses(d),w=new Map([["srcA",t],["srcB",n]]),h=[];try{for(const E of g.passes){const M=e.createTexture(c,f,Pt);h.push(M),w.set(E.output,M);const _=cn(e,`mp:${s.id}:${E.name}`,E.shader,Pt),y=E.inputs.map((T,P)=>{const D=w.get(T);if(!D)throw new Error(`computeDiff: pass "${E.name}" input "${T}" not produced yet`);return{binding:P,resource:D}});E.uniforms&&y.push(...E.uniforms(d));let C;try{C=e.createBindGroup(_,y),e.renderFullscreen(M,_,C)}finally{(m=C==null?void 0:C.destroy)==null||m.call(C)}}const x=w.get(g.final);if(!x)throw new Error(`computeDiff: final ref "${g.final}" not produced`);for(const E of h)E!==x&&E.destroy();return x}catch(x){for(const E of h)E.destroy();throw x}}const Li=8,Ii=256*1024*1024;class Bi{constructor(t=Li,n=Ii){ie(this,"map",new Map);ie(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Nr=new WeakMap;function Gr(e){let t=Nr.get(e);return t||(t=new Bi,Nr.set(e,t)),t}function Oi(e,t){const n=wr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Fi(e,t,n,r,o){const i=Qe(n),s=i?Oi(i,r):"",l=o?Jo(o):"";return`${e}|${t}|${n}|${s}|${l}`}function Ui(e,t,n,r,o,i,s,l){const c=Qe(r);if(!c)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const f=Gr(e),p=l??wt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),b=Fi(i,s,r,o,p),d=f.get(b);if(d)return d;const g=ki(e,t,n,r,o,p),w=p.result.w,h=p.result.h,v={texture:g,width:w,height:h,displayRange:c.displayRange,bytes:w*h*8};return f.set(b,v),v}async function Ni(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=$n(e,n,r,o).then(i=>(t.scalars=i,i))),t.scalarsPending)}async function Gi(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Gr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const zi=`
${Ie}
${ot}
@group(0) @binding(0) var resultTex: texture_2d<f32>;
@group(0) @binding(3) var lut: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_uv: vec4<f32>;   // uvRect.xy, uvRect.wh
@group(0) @binding(11) var<uniform> u_disp: vec4<f32>; // displayRangeId, cmapModeId, useColormap, filterMode
@group(0) @binding(14) var<uniform> u_expo: vec4<f32>; // exposureEV, offset, 0, 0
@group(0) @binding(17) var<uniform> u_src: vec4<f32>;  // primaryW, primaryH, 0, 0 (source footprint)

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(0.999999));
  let uvRect = u_uv;
  let rawSrcUV = uvRect.xy + uv * uvRect.zw;
  if (rawSrcUV.x < 0.0 || rawSrcUV.x >= 1.0 || rawSrcUV.y < 0.0 || rawSrcUV.y >= 1.0) {
    return vec4<f32>(0.0);
  }
  let srcUV = clamp(rawSrcUV, vec2<f32>(0.0), vec2<f32>(0.999999));
  let dims = vec2<f32>(textureDimensions(resultTex));
  // The diff RESULT is min-cropped to min(A,B), TOP-LEFT aligned. The pane's
  // uv-rect and this fragment's srcUV live in the PRIMARY source's normalized
  // space (u_src.xy = the primary/foreground dims that drive the overlay grid
  // and viewport). Map srcUV to a PRIMARY pixel and show the result 1:1 in the
  // crop's top-left; a fragment beyond the crop (primary pixel >= result dims)
  // has NO diff value, so it is transparent -- matching sampleDiff, which
  // returns null there (never a fake zero). For an EQUAL-size pair primaryDims
  // == dims, so this collapses to the identity mapping (unchanged behavior).
  let primaryDims = select(dims, u_src.xy, u_src.x > 0.5);
  let primaryPixel = srcUV * primaryDims;
  if (primaryPixel.x >= dims.x || primaryPixel.y >= dims.y) {
    return vec4<f32>(0.0);
  }
  let filterLinear = u_disp.w > 0.5;
  var raw: vec4<f32>;
  if (filterLinear) {
    raw = sampleBilinearOf(resultTex, primaryPixel / dims, dims);
  } else {
    raw = textureLoad(resultTex, vec2<i32>(primaryPixel), 0);
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
`,Vi={unit:0,signed:1,relative:2},$i={linear:0,signed:1,positive:2};function Xi(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Wi(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Hi(e,t,n,r,o){var g,w,h;const i=Wi(t),s=cn(e,"diff-display",zi,i),l=Xi(e,o.colormap),c=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),f=new Float32Array([Vi[r],$i[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),b=new Float32Array([((g=o.sourceDims)==null?void 0:g.w)??0,((w=o.sourceDims)==null?void 0:w.h)??0,0,0]);let d;try{d=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:f}},{binding:4,resource:{uniform:p}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,s,d)}finally{(h=d==null?void 0:d.destroy)==null||h.call(d),l.destroy()}}const zr=.6*.6*2.51,Yi=.6*.03,Ki=0,Vr=.6*.6*2.43,qi=.6*.59,Zi=.14;function $r(e){const t=(Yi-qi*e)/(zr-Vr*e),n=(Ki-Zi*e)/(zr-Vr*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Qi=.85,ji=.85,Xr=11920928955078125e-23,ln=[.2126,.7152,.0722];function Ji(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function ea(e,t,n,r=3,o={}){const i=t*n,s=$r(Qi),l=$r(ji),c=new Float64Array(i);let f=0;for(let x=0;x<i;x++){const[E,M,_]=Ji(e,x,r),y=E*ln[0]+M*ln[1]+_*ln[2];c[x]=y,y>f&&(f=y)}const p=Float64Array.from(c).sort(),b=i>>1,d=i%2===1?p[b]:p[b-1],g=Math.max(d,Xr),w=Math.max(f,Xr),h=o.startExposure??Math.log2(s/w),v=o.stopExposure??Math.log2(l/g),m=Math.max(2,Math.ceil(v-h));return{startExposure:h,stopExposure:v,numExposures:m}}const ta={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function na({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:i,zoom:s,pan:l,onViewportChange:c,processing:f=ta,interpolation:p="auto",label:b="",isDraggable:d=!1,onDragStart:g,overlay:w,overlaySettings:h,pixelValueNotation:v="decimal"}){var pe,he;const m=a.useRef(null),[x,E]=a.useState(null),[M,_]=a.useState(null),[y,C]=a.useState(v),[T,P]=a.useState(!1),D=a.useRef(null),I=a.useRef(null),R=a.useRef(null),S=a.useRef(null),[B,A]=a.useState(0);a.useEffect(()=>{if(!e){R.current=null,A($=>$+1);return}let j=!1;return Je(e).then($=>{j||(R.current=$,A(N=>N+1))}),()=>{j=!0}},[e]),a.useEffect(()=>{if(!t){S.current=null,A($=>$+1);return}let j=!1;return Je(t).then($=>{j||(S.current=$,A(N=>N+1))}),()=>{j=!0}},[t]);const O=j=>($,N,_e)=>{const xe=j.current;if(!xe||$<0||N<0||$>=xe.width||N>=xe.height)return null;const me=(N*xe.width+$)*4,ge=xe.data[me],Me=xe.data[me+1],X=xe.data[me+2],H=(.299*ge+.587*Me+.114*X)/255;return ge===Me&&Me===X?{lines:[rt(ge,"uint8",_e)],luminance:H}:{lines:[rt(ge,"uint8",_e),rt(Me,"uint8",_e),rt(X,"uint8",_e)],luminance:H,colors:[xt[0],xt[1],xt[2]]}},U=a.useMemo(()=>O(R),[]),de=a.useMemo(()=>O(S),[]),Q=!!w&&!!(h!=null&&h.enabled)&&!!x&&!!e&&((((pe=w.boxes)==null?void 0:pe.length)??0)>0||(((he=w.masks)==null?void 0:he.length)??0)>0),{gammaFilterId:re,filterStr:ye,gamma:Se,offset:le}=Zn(f),Ae=`translate(${l.x}px, ${l.y}px) scale(${s})`,ve=p==="auto"?void 0:p,{containerProps:Ee,modifierActive:Re}=Ln({containerRef:m,zoom:s,pan:l,onViewportChange:c});return u.jsxs("div",{className:"relative flex flex-col h-full",children:[u.jsx(Qn,{id:re,gamma:Se,offset:le}),u.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...Ee.style},onPointerDown:Ee.onPointerDown,onPointerMove:Ee.onPointerMove,onPointerUp:Ee.onPointerUp,onPointerCancel:Ee.onPointerCancel,children:[u.jsxs("div",{className:"relative w-full h-full",children:[u.jsxs("div",{className:"relative w-full h-full",style:{transform:Ae,transformOrigin:"0 0"},children:[u.jsx("img",{ref:D,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ye,imageRendering:ve,...n==="blend"?{opacity:o}:{}},onLoad:j=>{const $=j.currentTarget;E({w:$.naturalWidth,h:$.naturalHeight})}}),Q&&u.jsx(Kt,{data:w,settings:h,naturalWidth:x.w,naturalHeight:x.h})]}),u.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:u.jsx("div",{className:"w-full h-full",style:{transform:Ae,transformOrigin:"0 0"},children:u.jsx("img",{ref:I,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ye,imageRendering:ve,...n==="blend"?{opacity:1-o}:{}},onLoad:j=>{const $=j.currentTarget;_({w:$.naturalWidth,h:$.naturalHeight})}})})}),n==="split"&&u.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>i==null?void 0:i(.5),onPointerDown:j=>{j.stopPropagation(),j.preventDefault();const $=j.currentTarget;try{$.setPointerCapture(j.pointerId)}catch{}const _e=$.parentElement.getBoundingClientRect(),xe=ge=>{i==null||i(Math.max(0,Math.min(1,(ge.clientX-_e.left)/_e.width)))},me=()=>{window.removeEventListener("pointermove",xe),window.removeEventListener("pointerup",me)};window.addEventListener("pointermove",xe),window.addEventListener("pointerup",me)},children:u.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?u.jsxs(u.Fragment,{children:[t&&M&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:u.jsx(nt,{imageElRef:I,naturalWidth:M.w,naturalHeight:M.h,zoom:s,pan:l,sample:de,notation:y,version:B})}),e&&x&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:u.jsx(nt,{imageElRef:D,naturalWidth:x.w,naturalHeight:x.h,zoom:s,pan:l,sample:U,notation:y,version:B,onActiveChange:P})})]}):e&&x&&u.jsx(nt,{imageElRef:D,naturalWidth:x.w,naturalHeight:x.h,zoom:s,pan:l,sample:U,notation:y,version:B,onActiveChange:P}),T&&u.jsx(Bn,{notation:y,onChange:C})]}),n==="split"&&u.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),u.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${d&&!Re?" cairn-drag-grip":""}`,draggable:d&&!Re,onDragStart:g,style:{cursor:d&&!Re?"grab":void 0},children:[u.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),b]})]})}function ra(){return u.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function oa({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:i,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:f=>{f==="side"?s==null||s():f==="slide"?r():f==="blend"?o():i(f)}}}}function sa(e){const t=Ot(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function ia(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const c=e.data,f=new Uint16Array(o*4);for(let p=0;p<o;p++){const b=p*r,d=p*4;if(r===1){const g=c[b];f[d]=g,f[d+1]=g,f[d+2]=g,f[d+3]=ht}else f[d]=c[b],f[d+1]=c[b+1],f[d+2]=c[b+2],f[d+3]=r>=4?c[b+3]:ht}return{data:f,format:"rgba16float"}}const i=e.data,s=new Float32Array(o*4),l=c=>Number.isFinite(c)?c:0;for(let c=0;c<o;c++){const f=c*r;let p,b,d,g=1;r===1?p=b=d=l(i[f]):r===3?(p=l(i[f]),b=l(i[f+1]),d=l(i[f+2])):(p=l(i[f]),b=l(i[f+1]),d=l(i[f+2]),g=l(i[f+3]));const w=c*4;s[w]=p,s[w+1]=b,s[w+2]=d,s[w+3]=g}return{data:s,format:"rgba32float"}}function aa({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,diffSubmode:c,colormap:f="none",align:p="top-left",fit:b="crop",diffKernel:d,onDiffKernelChange:g,onCompareModeChange:w,onRequestSide:h,zoom:v,pan:m,onViewportChange:x,interpolation:E="auto",label:M="",pixelValueNotation:_="decimal"}){var Kr;const y=a.useRef(null),C=a.useRef(null),T=a.useRef(null),P=a.useRef(null),D=a.useRef(null),[I,R]=a.useState(!1),[S,B]=a.useState(!1),[A,O]=a.useState(null),[U,de]=a.useState(null),[Q,re]=a.useState(0),[ye,Se]=a.useState(0),[le,Ae]=a.useState(null),[ve,Ee]=a.useState({x:0,y:0,w:1,h:1}),Re=d??c??"absolute",[pe,he,j]=ct(Re);a.useEffect(()=>{he(d??c??"absolute")},[d,c,he]);const $=a.useCallback(k=>{he(k),g==null||g(k)},[g,he]);a.useEffect(()=>{const k=y.current;if(k)return k.__cairnDiffKernel={current:pe,set:$},()=>{k&&delete k.__cairnDiffKernel}},[pe,$]);const[N,_e,xe]=ct(o);a.useEffect(()=>{_e(o)},[o,_e]);const me=a.useCallback(k=>{_e(k),w==null||w(k)},[w,_e]),[ge,Me,X]=ct(f);a.useEffect(()=>{Me(f)},[f,Me]);const H=a.useCallback(()=>{me(xe.default),Me(X.default),$(j.default)},[me,Me,$,xe.default,X.default,j.default]),oe=xe.isModified||X.isModified||j.isModified,[G,K]=a.useState(0),[L,q]=a.useState(0),te=a.useMemo(()=>{const z=[oa({mode:N,kernel:pe,kernelOptions:Fr().map(V=>({id:V.id,label:V.label})),onSide:h,onSlide:()=>me("split"),onBlend:()=>me("blend"),onKernel:V=>{me("diff"),$(V)}})];return N==="diff"&&z.push(tn(ge,V=>Me(V))),z},[N,pe,ge,$,me,h]),J=a.useRef(null),W=a.useRef(null),ne=a.useRef(null),we=a.useRef(null),[De,ae]=a.useState(0),Te=a.useRef(null),ce=a.useRef(null),[Be,Ye]=a.useState(0),Oe=Yt();a.useEffect(()=>{const k=T.current;if(!k)return;let z=!1;return ft().then(V=>{if(!z)try{if(Wn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const F=V.createSurface(k,{hdr:!1});P.current={device:V,surface:F,texA:null,texB:null},B(!0)}catch(F){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",F),R(!0)}}).catch(V=>{z||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",V),R(!0))}),()=>{var F,Z;z=!0;const V=P.current;V&&((F=V.texA)==null||F.destroy(),(Z=V.texB)==null||Z.destroy(),P.current=null)}},[]),a.useEffect(()=>{const k=y.current;if(!k)return;const z=new ResizeObserver(()=>Se(V=>V+1));return z.observe(k),()=>z.disconnect()},[]),a.useEffect(()=>{if(!S)return;let k=!1;if(!P.current)return;async function V(F,Z){if(Z){const ue=ia(Z);return{width:Z.width,height:Z.height,imageData:null,make:be=>{const se=be.createTexture(Z.width,Z.height,ue.format);return se.write(ue.data),se}}}if(!F)return null;const ee=await Je(F);return ee?{width:ee.width,height:ee.height,imageData:ee,make:ue=>{const be=ue.createTexture(ee.width,ee.height,"rgba8unorm");return be.write(ee.data),be}}:null}return Promise.all([V(e,n),V(t,r)]).then(([F,Z])=>{var ke,Ge;if(k||!P.current)return;const ee=P.current;J.current=(F==null?void 0:F.imageData)??null,W.current=(Z==null?void 0:Z.imageData)??null,ne.current=n??null,we.current=r??null,(ke=ee.texA)==null||ke.destroy(),(Ge=ee.texB)==null||Ge.destroy(),ee.texA=null,ee.texB=null;const ue=F??Z;if(!ue){O(null),de(null),ae(Ne=>Ne+1);return}const be=Z??ue,se=F??ue;ee.texA=be.make(ee.device),ee.texB=se.make(ee.device),de({a:{w:be.width,h:be.height},b:{w:se.width,h:se.height}}),O({w:ue.width,h:ue.height}),ae(Ne=>Ne+1),re(Ne=>Ne+1)}),()=>{k=!0}},[S,e,t,n,r]);const Fe=n!=null||r!=null,Ue=a.useMemo(()=>Ri(pe,Fe),[pe,Fe]),lt=a.useMemo(()=>{if(!Fe)return null;const k=r??n;if(!k)return null;const z=k.precision==="f16-bits"?Tn(k.data):k.data;return ea(z,k.width,k.height,k.channels)},[Fe,r,n]),Wr=a.useMemo(()=>{var k;return xo(((k=Qe(Ue))==null?void 0:k.displayRange)??"unit",ge==="none"?null:ge)},[Ue,ge]),Hr=a.useMemo(()=>ge!=="none"?sa(ge):void 0,[ge]),je=a.useMemo(()=>U?wt(U.a,U.b,p,b,"b"):null,[U,p,b]),Le=a.useMemo(()=>A?N==="diff"&&je?je.result:A:null,[N,je,A]),un=a.useCallback(()=>{const k=P.current;if(!S||!k||!k.surface||!k.texA||!k.texB||!A)return;const z=Le??A,V=y.current,F=V?V.getBoundingClientRect():{width:z.w,height:z.h},Z=br({zoom:v,pan:m},F,z.w,z.h);Ee(se=>se.x===Z.x&&se.y===Z.y&&se.w===Z.w&&se.h===Z.h?se:Z);const ee=T.current;if(F.width>0&&F.height>0&&ee&&k.surface){const se=Math.max(1,Math.round(F.width*Oe)),ke=Math.max(1,Math.round(F.height*Oe));(ee.width!==se||ee.height!==ke)&&(ee.width=se,ee.height=ke,k.surface.configure(se,ke))}const ue=vr(Z,F,z.w,z.h)>=qt?"nearest":"linear",be=Z;try{if(N==="diff"){const se=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",ke=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ge=Qe(Ue)?Ue:"absolute",Ne=Ge==="hdr-flip"&&lt?{ppd:67,startExposure:lt.startExposure,stopExposure:lt.stopExposure,numExposures:lt.numExposures}:void 0,it=Ui(k.device,k.texA,k.texB,Ge,Ne,se,ke,je??void 0);D.current=it,Hi(k.device,k.surface,it.texture,it.displayRange,{uv:be,cmapMode:Wr,colormap:Hr,filter:ue,exposureEV:G,offset:L})}else{const se={exposureEV:G,offset:L,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:be,filter:ue,mode:N,split:i,alpha:s};rs(k.device,k.surface,k.texA,k.texB,se)}}catch(se){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",se),R(!0)}},[S,A,Le,je,v,m.x,m.y,N,i,s,G,L,pe,Ue,lt,Wr,Hr,e,t,n,r,Oe]);a.useEffect(()=>{un()},[un,Q,ye]);const Ct=t!=null||r!=null;a.useEffect(()=>{const k=P.current;if(!S||!k||!k.texA||!k.texB||!Ct){Ae(null);return}let z=!1;const V=k.texA,F=k.texB,Z=D.current,ee=N==="diff"?je??void 0:void 0;return(N==="diff"&&Z?Ni(k.device,Z,V,F,ee):$n(k.device,V,F,ee)).then(be=>{z||Ae(be)}),()=>{z=!0}},[S,Q,Ct,N,pe,je]),a.useEffect(()=>{if(N!=="diff"){Te.current=null,ce.current=null;return}const k=P.current,z=D.current;if(!S||!k||!z)return;let V=!1;return Te.current=null,ce.current=null,Ye(F=>F+1),Gi(k.device,z).then(F=>{V||(Te.current=F,ce.current={w:z.width,h:z.height},Ye(Z=>Z+1))}).catch(()=>{}),()=>{V=!0}},[S,N,Ue,Q,je]);const Yr=(k,z)=>(V,F,Z)=>{const ee=z.current;if(ee){const{data:it,width:qr,height:da,channels:Zr}=ee;if(V<0||F<0||V>=qr||F>=da)return null;const Dt=(F*qr+V)*Zr,kt=ee.precision==="f16-bits"?pn=>mt(it[pn]??0):pn=>it[pn]??0,pa=.5,ha=Zr===1?[kt(Dt)]:[kt(Dt),kt(Dt+1),kt(Dt+2)];return tt(ha,"unit",Z,pa)}const ue=k.current;if(!ue||V<0||F<0||V>=ue.width||F>=ue.height)return null;const be=(F*ue.width+V)*4,se=ue.data[be],ke=ue.data[be+1],Ge=ue.data[be+2],Ne=(.299*se+.587*ke+.114*Ge)/255;return tt(se===ke&&ke===Ge?[se]:[se,ke,Ge],"uint8",Z,Ne)},Rt=a.useMemo(()=>Yr(J,ne),[]),fn=a.useMemo(()=>Yr(W,we),[]),dn=a.useMemo(()=>(k,z,V)=>{var Ne;const F=Te.current,Z=ce.current;if(!F||!Z)return null;const{w:ee,h:ue}=Z;if(k<0||z<0||k>=ee||z>=ue)return null;const be=(z*ee+k)*4,se=((Ne=Qe(Ue))==null?void 0:Ne.output)??"per-channel",ke=.5,Ge=se==="scalar"?[F[be]??0]:[F[be]??0,F[be+1]??0,F[be+2]??0];return tt(Ge,"unit",V,ke)},[Ue]);a.useEffect(()=>{const k=y.current;if(k)return k.__cairnCompareProbe={sampleDiff:(z,V,F="decimal")=>dn(z,V,F),sampleFg:(z,V,F="decimal")=>Rt(z,V,F),sampleRef:(z,V,F="decimal")=>fn(z,V,F),get diffSamples(){return Te.current},get dims(){return Le},get primaryDims(){return A},get diffResultDims(){return ce.current},get align(){return p},get fit(){return b},get resolvedKernelId(){return Ue},get compareMode(){return N}},()=>{k&&delete k.__cairnCompareProbe}},[dn,Rt,fn,A,Le,p,b,Ue,N]);const ua=E==="auto"?void 0:E;if(I)return n!=null||r!=null?u.jsx(ra,{}):N==="diff"?u.jsx(nn,{imageUrl:e,baselineUrl:t,diffMode:((Kr=Qe(Ue))==null?void 0:Kr.kind)==="pointwise"?Ue:"absolute",interpolation:E,colormap:ge,showAxes:!1,zoom:v,pan:m,onViewportChange:x,label:M,pixelValueNotation:_}):u.jsx(na,{imageUrl:e,baselineUrl:t,mode:N,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,zoom:v,pan:m,onViewportChange:x,interpolation:E,label:M,pixelValueNotation:_});const fa=u.jsxs(u.Fragment,{children:[u.jsx("canvas",{ref:T,className:"w-full h-full block",style:{imageRendering:ua},"data-gpu-compare-canvas":!0}),N==="split"&&u.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${i*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:k=>{k.stopPropagation(),l==null||l(.5)},onPointerDown:k=>{k.stopPropagation(),k.preventDefault();const z=k.currentTarget;try{z.setPointerCapture(k.pointerId)}catch{}const F=z.parentElement.getBoundingClientRect(),Z=ue=>{l==null||l(Math.max(0,Math.min(1,(ue.clientX-F.left)/F.width)))},ee=()=>{window.removeEventListener("pointermove",Z),window.removeEventListener("pointerup",ee)};window.addEventListener("pointermove",Z),window.addEventListener("pointerup",ee)},children:u.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return u.jsx(Et,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":S},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:y,wrapperRef:C,zoom:v,pan:m,onViewportChange:x,naturalDims:Le,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:fa,showAxes:!1,notationSeed:_,onReset:H,extraModified:oe,exportCanvasRef:T,requestRender:un,leadingMenus:te,displayAdjust:{exposureEV:G,offset:L,onExposureChange:K,onOffsetChange:q},label:"",showLabelChip:!1,overlay:{render:({notation:k,setOverlayActive:z})=>N==="split"?u.jsxs(u.Fragment,{children:[Ct&&Le&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-i)*100}% 0 0)`},children:u.jsx(nt,{imageElRef:T,naturalWidth:Le.w,naturalHeight:Le.h,zoom:v,pan:m,sourceWindow:ve,sample:fn,notation:k,version:De})}),Ct&&Le&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${i*100}%)`},children:u.jsx(nt,{imageElRef:T,naturalWidth:Le.w,naturalHeight:Le.h,zoom:v,pan:m,sourceWindow:ve,sample:Rt,notation:k,version:De,onActiveChange:z})})]}):Le&&u.jsx(nt,{imageElRef:T,naturalWidth:Le.w,naturalHeight:Le.h,zoom:v,pan:m,sourceWindow:ve,sample:N==="diff"?dn:Rt,notation:k,version:N==="diff"?Be:De,onActiveChange:z})},extraChips:u.jsxs(u.Fragment,{children:[N==="split"&&u.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),M?u.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:M}):null,le&&u.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${M?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",le.mse.toExponential(2)," · PSNR ",Number.isFinite(le.psnr)?le.psnr.toFixed(1):"∞"," dB · MAE"," ",le.mae.toExponential(2)]})]})})}const ca="cairn-plot:gpu-image-ready";async function la(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await ft(),window.__cairnPlotGpuImagePane=ri,window.__cairnPlotGpuComparePane=aa,window.__cairnPlotDiffMenuModes=Fr(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(ca))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),xr("no-webgpu")}}}la()})(__cairnPlotJsxRuntime,__cairnPlotReact);
