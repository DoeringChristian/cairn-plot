var fa=Object.defineProperty;var da=(u,l,Ke)=>l in u?fa(u,l,{enumerable:!0,configurable:!0,writable:!0,value:Ke}):u[l]=Ke;var ie=(u,l,Ke)=>da(u,typeof l!="symbol"?l+"":l,Ke);(function(u,l){"use strict";const Ke=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function hn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Ke}),{hdr:!1,format:n}}function qr(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Ke}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Ke}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return hn(e,t)}}}const Zr=`
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
`;function Lt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function mn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Qr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const jr={texture:0,sampler:1,uniform:2};function It(e,t){return e*3+jr[t]}const Jr={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function eo(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),i=r[2]!==void 0,s=r[3].trim();if(i){const c=Jr[s];if(c===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:c})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class gn{constructor(t,n,r,o){ie(this,"width");ie(this,"height");ie(this,"format");ie(this,"gpuTexture");ie(this,"device");ie(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Lt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*mn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class xn{constructor(t){ie(this,"_s");ie(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class to{constructor(t,n,r,o,i){ie(this,"_p");ie(this,"gpuPipeline");ie(this,"bindings");ie(this,"bindGroupLayout");ie(this,"variants");ie(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=i,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function no(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class ro{constructor(t){ie(this,"_c");ie(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class oo{constructor(t,n){ie(this,"_b");ie(this,"gpuBindGroup");ie(this,"ownedBuffers");ie(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class so{constructor(t,n,r,o){ie(this,"canvas");ie(this,"hdr");ie(this,"format");ie(this,"context");ie(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function ut(e){return"canvas"in e}async function io(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function i(p){return ut(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function s(p){if(ut(p))return{width:p.canvas.width,height:p.canvas.height};const v=p;return{width:v.width,height:v.height}}let c=!1,a=null;function f(){var v,m;if(a!==null)return a;let p=!1;try{if(typeof document<"u"){const x=document.createElement("canvas");x.width=1,x.height=1;const E=x.getContext("webgpu");if(E)try{E.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const S=(v=E.getConfiguration)==null?void 0:v.call(E);p=((m=S==null?void 0:S.toneMapping)==null?void 0:m.mode)==="extended"}catch{p=!1}finally{try{E.unconfigure()}catch{}}}}catch{p=!1}return a=p,p}const h=256;let g=null,d=null;function b(){if(!g||!d){const p=t.createShaderModule({code:Zr});d=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const v=t.createPipelineLayout({bindGroupLayouts:[d]});g=t.createComputePipeline({layout:v,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:g,layout:d}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:f,createTexture(p,v,m){return new gn(t,p,v,m)},createSampler(p){const v=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",m=t.createSampler({magFilter:v,minFilter:v,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new xn(m)},createRenderPipeline(p){const v=t.createShaderModule({code:p.shaderWGSL}),m=eo(p.shaderWGSL),x=Lt(p.targetFormat),E=no(t,m),S=t.createPipelineLayout({bindGroupLayouts:[E]}),P=k=>t.createRenderPipeline({layout:S,vertex:{module:v,entryPoint:"vs_main"},fragment:{module:v,entryPoint:"fs_main",targets:[{format:k}]},primitive:{topology:"triangle-list"}}),y=P(x);return new to(y,m,E,x,P)},createComputePipeline(p){const v=t.createShaderModule({code:p.shaderWGSL}),m=t.createComputePipeline({layout:"auto",compute:{module:v,entryPoint:"cs_main"}});return new ro(m)},createBindGroup(p,v){const m=p,x=new Map,E=[];for(const[P,y]of m.bindings)if(y.kind==="uniform"){const k=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});E.push(k),x.set(P,{binding:P,resource:{buffer:k}})}else y.kind==="sampler"&&x.set(P,{binding:P,resource:o()});for(const P of v){const y=P.resource;if(y instanceof gn){const k=It(P.binding,"texture");m.bindings.has(k)&&x.set(k,{binding:k,resource:y.gpuTexture.createView()})}else if(y instanceof xn){const k=It(P.binding,"sampler");m.bindings.has(k)&&x.set(k,{binding:k,resource:y.gpuSampler})}else{const k=It(P.binding,"uniform"),M=m.bindings.get(k);if(M&&M.kind==="uniform"){const A=y.uniform,R=t.createBuffer({size:Math.max(M.sizeBytes,A.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(R,0,A.buffer,A.byteOffset,A.byteLength),E.push(R),x.set(k,{binding:k,resource:{buffer:R}})}}}const S=t.createBindGroup({layout:m.bindGroupLayout,entries:Array.from(x.values())});return new oo(S,E)},createSurface(p,v){const m=p.getContext("webgpu");if(!m)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const x=v.hdr&&n.hdr,E=()=>x?qr(m,t):hn(m,t),S=E();return new so(p,m,S,E)},renderFullscreen(p,v,m){const x=v,E=m,S=i(p),{width:P,height:y}=s(p),k=ut(p)?p.format:Lt(p.format),M=x.pipelineFor(k),A=t.createCommandEncoder(),R=A.beginRenderPass({colorAttachments:[{view:S,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});R.setPipeline(M),R.setBindGroup(0,E.gpuBindGroup),R.setViewport(0,0,P,y,0,1),R.draw(3),R.end(),t.queue.submit([A.finish()])},async readback(p){const v=ut(p),{width:m,height:x}=s(p),E=v?p.hdr?"rgba16float":"rgba8unorm":p.format,S=v&&p.format==="bgra8unorm",P=v?p.getCurrentGPUTexture():p.gpuTexture,y=mn(E),k=m*y,M=256,A=Math.ceil(k/M)*M,R=A*x,I=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),C=t.createCommandEncoder();C.copyTextureToBuffer({texture:P},{buffer:I,bytesPerRow:A,rowsPerImage:x},{width:m,height:x,depthOrArrayLayers:1}),t.queue.submit([C.finish()]),await I.mapAsync(GPUMapMode.READ);const _=new Uint8Array(I.getMappedRange()),B=new Uint8Array(k*x);for(let T=0;T<x;T++){const O=T*A,F=T*k;B.set(_.subarray(O,O+k),F)}if(I.unmap(),I.destroy(),E==="rgba8unorm"){if(S)for(let T=0;T<B.length;T+=4){const O=B[T],F=B[T+2];B[T]=F,B[T+2]=O}return B}if(E==="rgba16float"){const T=new Uint16Array(B.buffer,B.byteOffset,B.byteLength/2),O=new Float32Array(T.length);for(let F=0;F<T.length;F++)O[F]=Qr(T[F]);return O}return new Float32Array(B.buffer,B.byteOffset,B.byteLength/4)},async reduceDiffSumSquaredAbs(p,v,m,x){const E=p,S=v,P=Math.max(0,m*x),y=Math.max(1,Math.ceil(P/h)),{pipeline:k,layout:M}=b(),A=y*2*4,R=t.createBuffer({size:A,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),I=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(I,0,new Uint32Array([Math.max(1,m),Math.max(1,x),P,0]));const C=t.createBindGroup({layout:M,entries:[{binding:0,resource:E.gpuTexture.createView()},{binding:1,resource:S.gpuTexture.createView()},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:I}}]}),_=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),B=t.createCommandEncoder(),T=B.beginComputePass();T.setPipeline(k),T.setBindGroup(0,C),T.dispatchWorkgroups(y),T.end(),B.copyBufferToBuffer(R,0,_,0,A),t.queue.submit([B.finish()]),await _.mapAsync(GPUMapMode.READ);const F=new Float32Array(_.getMappedRange()).slice();_.unmap(),_.destroy(),R.destroy(),I.destroy();let de=0,Q=0;for(let re=0;re<y;re++)de+=F[re*2],Q+=F[re*2+1];return{sumSq:de,sumAbs:Q}},destroy(){c||(t.destroy(),c=!0)},isContextLost(){return!1}}}let Bt=null;async function ao(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return io()}function ft(){return Bt||(Bt=ao()),Bt}function co(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function lo(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),i=Math.floor(o),s=Math.min(i+1,e.length-1),c=o-i,[a,f,h]=co(e[i],e[s],c);t[n*3]=Math.round(a),t[n*3+1]=Math.round(f),t[n*3+2]=Math.round(h)}return t}const bn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},uo=new Set(["red-green","red-blue"]),vn=new Map;function Ot(e){let t=vn.get(e);if(!t){const n=bn[e]??bn.viridis;t=lo(n),vn.set(e,t)}return t}const ze=e=>e<0?0:e>1?1:e,Ut=e=>{const t=e<0?0:e;return t/(1+t)},Ft=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return ze(n/r)},wn={linear:([e,t,n])=>[ze(e),ze(t),ze(n)],srgb:([e,t,n])=>[ze(e),ze(t),ze(n)],reinhard:([e,t,n])=>[Ut(e),Ut(t),Ut(n)],aces:([e,t,n])=>[Ft(e),Ft(t),Ft(n)],extended:([e,t,n])=>[e,t,n]},fo="srgb";function po(e){return e&&wn[e]||wn[fo]}function dt(e,t,n){return e*2**t+n}function ho(e){const t=ze(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Nt(e,t){return typeof t=="number"&&t>0?ze(Math.pow(ze(e),1/t)):ho(e)}function Gt(e,t,n="linear",r=0,o=0){const i=Ot(t),s=new ImageData(e.width,e.height),c=e.data,a=s.data,f=r!==0||o!==0;for(let h=0;h<c.length;h+=4){let g=(c[h]+c[h+1]+c[h+2])/3;f&&(g=Math.max(0,Math.min(255,dt(g/255,r,o)*255)));let d;n==="positive"?d=Math.round(128+g/255*127):d=Math.round(g),d=Math.max(0,Math.min(255,d)),a[h]=i[d*3],a[h+1]=i[d*3+1],a[h+2]=i[d*3+2],a[h+3]=c[h+3]}return s}function mo(e,t){return e==="signed"||e==="relative"?"signed":zt(t)}function zt(e){return uo.has(e??"")?"positive":"linear"}function yn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const En=yn(50);function Vt(e){return En.get(e)}function $t(e,t){En.set(e,t)}const _n=yn(100);function go(e){return _n.get(e)}function xo(e,t){_n.set(e,t)}function bo(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),i=new ImageData(r,o);for(let s=0;s<o;s++)for(let c=0;c<r;c++){const a=(s*e.width+c)*4,f=(s*t.width+c)*4,h=(s*r+c)*4;for(let g=0;g<3;g++){const d=e.data[a+g],b=t.data[f+g],w=d-b,p=Math.abs(w),v=Math.max(d,1);let m;switch(n){case"signed":m=(w+255)/2;break;case"absolute":m=p;break;case"squared":m=w*w/255;break;case"relative_signed":m=(w/v+1)*127.5;break;case"relative_absolute":m=p/v*255;break;case"relative_squared":m=w*w/(v*v)*255;break}i.data[h+g]=Math.min(255,Math.max(0,Math.round(m)))}i.data[h+3]=255}return i}async function Je(e){const t=go(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const i=o.getContext("2d");if(!i){n(null);return}i.drawImage(r,0,0);const s=i.getImageData(0,0,o.width,o.height);xo(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const vo={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},wo={linear:0,signed:1,positive:2},yo=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Eo=`#version 300 es
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
}`;let et=null,Y=null,Ce=null,pt=null;function _o(){if(Y)return Y;try{if(typeof OffscreenCanvas<"u"?et=new OffscreenCanvas(1,1):et=document.createElement("canvas"),Y=et.getContext("webgl2",{preserveDrawingBuffer:!0}),!Y)return console.warn("[cairn] WebGL 2 not available"),null;const e=Y.createShader(Y.VERTEX_SHADER);if(Y.shaderSource(e,yo),Y.compileShader(e),!Y.getShaderParameter(e,Y.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Y.getShaderInfoLog(e)),null;const t=Y.createShader(Y.FRAGMENT_SHADER);if(Y.shaderSource(t,Eo),Y.compileShader(t),!Y.getShaderParameter(t,Y.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Y.getShaderInfoLog(t)),null;if(Ce=Y.createProgram(),Y.attachShader(Ce,e),Y.attachShader(Ce,t),Y.linkProgram(Ce),!Y.getProgramParameter(Ce,Y.LINK_STATUS))return console.error("[cairn] WebGL program link:",Y.getProgramInfoLog(Ce)),null;pt=Y.createVertexArray(),Y.bindVertexArray(pt);const n=Y.createBuffer();Y.bindBuffer(Y.ARRAY_BUFFER,n),Y.bufferData(Y.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Y.STATIC_DRAW);const r=Y.getAttribLocation(Ce,"a_pos");return Y.enableVertexAttribArray(r),Y.vertexAttribPointer(r,2,Y.FLOAT,!1,0,0),Y.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Y}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Mn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Mo(e,t,n){const r=new Uint8Array(1024);for(let i=0;i<256;i++)r[i*4]=t[i*3],r[i*4+1]=t[i*3+1],r[i*4+2]=t[i*3+2],r[i*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function So(e,t,n,r){const o=_o();if(!o||!Ce||!pt||!et)return null;const i=Math.min(e.width,t.width),s=Math.min(e.height,t.height);et.width=i,et.height=s,o.viewport(0,0,i,s);const c=Mn(o,e,0),a=Mn(o,t,1);let f=null;n.colormap?f=Mo(o,n.colormap,2):(f=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,f),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ce),o.uniform1i(o.getUniformLocation(Ce,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ce,"u_other"),1),o.uniform1i(o.getUniformLocation(Ce,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ce,"u_diff_mode"),vo[n.diffMode]),o.uniform1i(o.getUniformLocation(Ce,"u_cmap_mode"),wo[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ce,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(pt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=i,r.height=s;const h=r.getContext("2d");return h&&(h.save(),h.scale(1,-1),h.drawImage(et,0,0,i,s,0,-s,i,s),h.restore()),o.deleteTexture(c),o.deleteTexture(a),o.deleteTexture(f),{width:i,height:s}}const To="cairn:render-mode";function Po(){try{const e=localStorage.getItem(To);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const ht=15360;function mt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Sn=globalThis.Float16Array;function Tn(e,t=e.length){if(Sn){const r=new Sn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=mt(e[r]);return n}const Ve=new Uint32Array(512),$e=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ve[e]=0,Ve[e|256]=32768,$e[e]=24,$e[e|256]=24):t<-14?(Ve[e]=1024>>-t-14,Ve[e|256]=1024>>-t-14|32768,$e[e]=-t-1,$e[e|256]=-t-1):t<=15?(Ve[e]=t+15<<10,Ve[e|256]=t+15<<10|32768,$e[e]=13,$e[e|256]=13):t<128?(Ve[e]=31744,Ve[e|256]=64512,$e[e]=24,$e[e|256]=24):(Ve[e]=31744,Ve[e|256]=64512,$e[e]=13,$e[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var at=Uint8Array,Pn=Uint16Array,Ao=Int32Array,Co=new at([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Ro=new at([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),An=function(e,t){for(var n=new Pn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Ao(n[30]),r=1;r<30;++r)for(var i=n[r];i<n[r+1];++i)o[i]=i-n[r]<<5|r;return{b:n,r:o}},Cn=An(Co,2),Do=Cn.b,ko=Cn.r;Do[28]=258,ko[258]=28,An(Ro,0);for(var Lo=new Pn(32768),fe=0;fe<32768;++fe){var qe=(fe&43690)>>1|(fe&21845)<<1;qe=(qe&52428)>>2|(qe&13107)<<2,qe=(qe&61680)>>4|(qe&3855)<<4,Lo[fe]=((qe&65280)>>8|(qe&255)<<8)>>1}for(var gt=new at(288),fe=0;fe<144;++fe)gt[fe]=8;for(var fe=144;fe<256;++fe)gt[fe]=9;for(var fe=256;fe<280;++fe)gt[fe]=7;for(var fe=280;fe<288;++fe)gt[fe]=8;for(var Io=new at(32),fe=0;fe<32;++fe)Io[fe]=5;var Bo=new at(0),Oo=typeof TextDecoder<"u"&&new TextDecoder,Uo=0;try{Oo.decode(Bo,{stream:!0}),Uo=1}catch{}const Rn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Xt(e){const t=Rn.length;return Rn[(e%t+t)%t]}function Fo(e){const n=l.useRef(null),[r,o]=l.useState({w:0,h:0}),i=l.useRef(null),s=l.useRef(null),c=l.useRef(null),a=l.useCallback((f,h)=>{o(g=>g.w===f&&g.h===h?g:{w:f,h})},[]);return l.useLayoutEffect(()=>{const f=n.current;if(!f||f===c.current)return;const h=f.getBoundingClientRect();(h.width>0||h.height>0)&&(c.current=f,a(h.width,h.height))}),l.useEffect(()=>{var g;const f=n.current;if(f===s.current||((g=i.current)==null||g.disconnect(),i.current=null,s.current=f,!f))return;const h=new ResizeObserver(d=>{for(const b of d)a(b.contentRect.width,b.contentRect.height)});i.current=h,h.observe(f)}),l.useEffect(()=>()=>{var f;return(f=i.current)==null?void 0:f.disconnect()},[]),{ref:n,size:r}}function No(){const[e,t]=l.useState(!1);return l.useEffect(()=>{const n=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!0)},r=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Go=.001;function zo(e,t=Go){return Math.exp(-e*t)}function Dn(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function kn(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Vo(e,t,n,r,o,i,s){const c=t>0&&r>0?r/t:1,a=Math.max(i,Math.min(s,e.zoom*c)),f=(n.x-e.pan.x)/e.zoom,h=(n.y-e.pan.y)/e.zoom;return{zoom:a,pan:{x:o.x-f*a,y:o.y-h*a}}}const $o=.25,Wt=64;function Ht(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Wt;const o=Math.min(n/e,r/t);return o<=0?Wt:Math.max(Math.max(n,r)/o,8)}function Ln(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:i=$o,maxZoom:s=Wt,naturalWidth:c,naturalHeight:a}=e,f=No(),h=l.useRef(f);h.current=f;const g=l.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const d=l.useRef(o);d.current=o,l.useEffect(()=>{const M=t.current;if(!M||!o)return;const A=R=>{var re;if(!R.ctrlKey&&!h.current)return;R.preventDefault(),R.stopPropagation();const I=zo(R.deltaY),C=g.current,_=M.getBoundingClientRect(),B=c&&a?Ht(c,a,_.width,_.height):s,T=Math.max(i,Math.min(B,C.zoom*I));if(C.zoom===T)return;const O=R.clientX-_.left,F=R.clientY-_.top,de=O-(O-C.pan.x)/C.zoom*T,Q=F-(F-C.pan.y)/C.zoom*T;(re=d.current)==null||re.call(d,{zoom:T,pan:{x:de,y:Q}})};return M.addEventListener("wheel",A,{passive:!1}),()=>M.removeEventListener("wheel",A)},[t,!!o,i,s,c,a]);const b=l.useRef(new Map),w=l.useRef(null),p=l.useRef(null),v=l.useCallback((M,A,R)=>{const I=M.getBoundingClientRect();return{x:A-I.left,y:R-I.top}},[]),m=l.useCallback(M=>{if(!c||!a)return s;const A=M.getBoundingClientRect();return Ht(c,a,A.width,A.height)},[c,a,s]),x=l.useCallback((M,A)=>{const R=b.current,I=R.get(M),C=R.get(A);!I||!C||(w.current=null,p.current={idA:M,idB:A,startDist:Dn(I,C),startMid:kn(I,C),startZoom:g.current.zoom,startPan:{...g.current.pan}})},[]),E=l.useCallback(M=>{const A=b.current.get(M);A&&(w.current={pointerId:M,startX:A.x,startY:A.y,panX:g.current.pan.x,panY:g.current.pan.y})},[]),S=l.useCallback(M=>{if(!d.current)return;const A=M.pointerType==="touch";if(!A&&!h.current)return;const R=M.currentTarget;if(R.setPointerCapture(M.pointerId),b.current.set(M.pointerId,v(R,M.clientX,M.clientY)),A&&b.current.size>=2){const I=[...b.current.keys()];x(I[I.length-2],I[I.length-1]);return}E(M.pointerId)},[v,x,E]),P=l.useCallback(M=>{var _,B;const A=M.currentTarget,R=b.current.get(M.pointerId);if(R){const T=v(A,M.clientX,M.clientY);R.x=T.x,R.y=T.y}const I=p.current;if(I){const T=b.current.get(I.idA),O=b.current.get(I.idB);if(!T||!O)return;const F=Vo({zoom:I.startZoom,pan:I.startPan},I.startDist,I.startMid,Dn(T,O),kn(T,O),i,m(A));(_=d.current)==null||_.call(d,F);return}const C=w.current;!C||C.pointerId!==M.pointerId||!R||(B=d.current)==null||B.call(d,{zoom:g.current.zoom,pan:{x:C.panX+(R.x-C.startX),y:C.panY+(R.y-C.startY)}})},[v,i,m]),y=l.useCallback(M=>{var R;try{M.currentTarget.releasePointerCapture(M.pointerId)}catch{}b.current.delete(M.pointerId);const A=p.current;if(A&&(M.pointerId===A.idA||M.pointerId===A.idB)){p.current=null;const I=[...b.current.keys()];I.length===1&&E(I[0]);return}((R=w.current)==null?void 0:R.pointerId)===M.pointerId&&(w.current=null)},[E]);return{containerProps:{onPointerDown:S,onPointerMove:P,onPointerUp:y,onPointerCancel:y,style:{cursor:f&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:f}}function Yt(){const[e,t]=l.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return l.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),i())};function i(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return i(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ct(e){const t=l.useRef(e),[n,r]=l.useState(e),o=l.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Xo(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function In(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Kt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:i}=Fo(),s=l.useRef(null),c=l.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),a=l.useMemo(()=>{const p=i.w,v=i.h;if(p<=0||v<=0||n<=0||r<=0)return null;const m=Math.min(p/n,v/r),x=n*m,E=r*m;return{left:(p-x)/2,top:(v-E)/2,width:x,height:E}},[i.w,i.h,n,r]),f=e.masks,h=t.showMasks&&!!f&&f.length>0,g=l.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(l.useEffect(()=>{if(!h||!f)return;const p=s.current;if(!p)return;(p.width!==n||p.height!==r)&&(p.width=n,p.height=r);const v=p.getContext("2d");if(!v)return;v.clearRect(0,0,p.width,p.height);let m=!1;const x=v.createImageData(n,r),E=x.data;let S=f.length,P=!1;const y=()=>{m||P&&v.putImageData(x,0,0)},k=document.createElement("canvas");k.width=n,k.height=r;const M=k.getContext("2d",{willReadFrequently:!0});for(const A of f){const R=new Image;R.onload=()=>{if(!m){if(M){M.clearRect(0,0,n,r),M.drawImage(R,0,0,n,r);const I=M.getImageData(0,0,n,r).data;for(let C=0;C<n*r;C++){const _=I[C*4];if(_===0||c.has(_))continue;const[B,T,O]=Xo(Xt(_));E[C*4]=B,E[C*4+1]=T,E[C*4+2]=O,E[C*4+3]=255,P=!0}}S-=1,S===0&&y()}},R.onerror=()=>{S-=1,S===0&&y()},R.src=`data:image/png;base64,${A.png_b64}`}return()=>{m=!0}},[h,f,n,r,g]),!a)return u.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const d=e.boxes??[],b=t.showBoxes&&d.length>0,w=e.class_labels??{};return u.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[h&&u.jsx("canvas",{ref:s,className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),b&&u.jsx("svg",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:d.map((p,v)=>{if(!In(p,t,c))return null;const m=p.domain==="pixel"?1:n,x=p.domain==="pixel"?1:r,E=p.position.minX*m,S=p.position.minY*x,P=(p.position.maxX-p.position.minX)*m,y=(p.position.maxY-p.position.minY)*x;return u.jsx("rect",{x:E,y:S,width:P,height:y,fill:"none",stroke:Xt(p.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},v)})}),b&&u.jsx("div",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height},children:d.map((p,v)=>{if(!In(p,t,c))return null;const m=p.domain==="pixel"?1/n:1,x=p.domain==="pixel"?1/r:1,E=p.position.minX*m*100,S=p.position.minY*x*100,P=p.label??w[String(p.class_id)]??`#${p.class_id}`,y=p.score!=null?` ${(p.score*100).toFixed(0)}%`:"";return!P&&!y?null:u.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${E}%`,top:`${S}%`,transform:"translateY(-100%)",backgroundColor:Xt(p.class_id)},children:u.jsxs("span",{className:"mono",children:[P,y]})},v)})})]})}const qt=30,xt=["#ff5a5a","#39d353","#5b9bff"];function Zt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function rt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Zt(e/255):Zt(n==="int"?e*255:e)}function tt(e,t,n,r){return e.length===1?{lines:[rt(e[0],t,n)],luminance:r}:{lines:e.map(o=>rt(o,t,n)),luminance:r,colors:e.map((o,i)=>xt[i]??null)}}const Wo={x:0,y:0,w:1,h:1};function nt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:i,notation:s="decimal",version:c=0,onActiveChange:a,sourceWindow:f=Wo}){const h=l.useRef(null),g=l.useRef(!1),d=Yt(),b=l.useRef(a);b.current=a;const w=l.useCallback(v=>{var m;v!==g.current&&(g.current=v,(m=b.current)==null||m.call(b,v))},[]),p=l.useCallback(()=>{var Re;const v=h.current,m=e.current;if(!v)return;const x=window.devicePixelRatio||1,E=v.clientWidth,S=v.clientHeight;if(E===0||S===0)return;v.width!==Math.round(E*x)&&(v.width=Math.round(E*x)),v.height!==Math.round(S*x)&&(v.height=Math.round(S*x));const P=v.getContext("2d");if(!P)return;if(P.setTransform(x,0,0,x,0,0),P.clearRect(0,0,E,S),!m||t<=0||n<=0){w(!1);return}const y=m.getBoundingClientRect(),k=v.getBoundingClientRect();if(y.width===0||y.height===0){w(!1);return}const M=f.x*t,A=f.y*n,R=f.w*t,I=f.h*n;if(R<=0||I<=0){w(!1);return}const C=Math.min(y.width/R,y.height/I);if(C<qt){w(!1);return}const _=R*C,B=I*C,T=y.left+(y.width-_)/2-k.left,O=y.top+(y.height-B)/2-k.top,F=Math.max(Math.floor(M),Math.floor(M+(0-T)/C)),de=Math.min(Math.ceil(M+R),Math.ceil(M+(E-T)/C)),Q=Math.max(Math.floor(A),Math.floor(A+(0-O)/C)),re=Math.min(Math.ceil(A+I),Math.ceil(A+(S-O)/C));if(de<=F||re<=Q){w(!1);return}w(!0);const ye=T+(0-M)*C,Se=O+(0-A)*C,le=T+(t-M)*C,Pe=O+(n-A)*C;P.save(),P.beginPath(),P.rect(ye,Se,le-ye,Pe-Se),P.clip(),P.textAlign="center",P.textBaseline="middle",P.lineJoin="round";const ve=C*.14,Ee=C-ve*2;for(let pe=Q;pe<re;pe++)for(let he=F;he<de;he++){if(he<0||pe<0||he>=t||pe>=n)continue;const j=i(he,pe,s);if(!j||j.lines.length===0)continue;const $=j.lines.length;let N=1;for(const K of j.lines)K.length>N&&(N=K.length);const _e=Ee/($*1.15),xe=Ee/(N*.62)||_e,me=Math.min(_e,xe,24);if(me<6)continue;const ge=T+(he-M+.5)*C,Me=O+(pe-A+.5)*C,X=me*1.15,H=j.luminance<=.55,oe=H?"#ffffff":"#000000";P.font=`${me}px ui-monospace, SFMono-Regular, Menlo, monospace`,P.lineWidth=Math.max(1.4,me*.16),P.strokeStyle=H?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let G=Me-$*X/2+X/2;for(let K=0;K<j.lines.length;K++){const L=j.lines[K];P.strokeText(L,ge,G),P.fillStyle=((Re=j.colors)==null?void 0:Re[K])??oe,P.fillText(L,ge,G),G+=X}}P.restore()},[e,t,n,i,s,w,f]);return l.useEffect(()=>{p()},[p,r,o.x,o.y,c,s,f,d]),l.useEffect(()=>{const v=h.current;if(!v)return;const m=new ResizeObserver(()=>p());return m.observe(v),()=>m.disconnect()},[p]),u.jsx("canvas",{ref:h,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Bn({notation:e,onChange:t,className:n=""}){return u.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Ho=`
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
`,Yo=`
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
${Yo}

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
`}const Ko=On("select(colorB, colorA, uv.x < split)"),qo=On("mix(colorA, colorB, alpha)");function Zo(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Un(e,t,n){const{v:r,h:o}=Zo(n),i=e.w-t.w,s=e.h-t.h,c=o==="left"?0:o==="right"?i:Math.floor(i/2),a=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:c,y:a}}function wt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const i={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:i,offsetA:Un(e,i,n),offsetB:Un(t,i,n)}}function Qo(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const Qt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Fn=new WeakMap;function jo(e,t){let n=Fn.get(e);n||(n=new Map,Fn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Ho,targetFormat:t}),n.set(t,r)),r}function Nn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Gn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Jo(e,t,n,r){var p;const o=Nn(t),i=jo(e,o),s=Gn(e,r.isScalar?r.colormap:void 0),c=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,a=Qt[r.operator]??Qt.srgb,f=new Float32Array([r.exposureEV,a,c,r.isScalar?1:0]),h=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),d=new Float32Array([r.filter==="nearest"?0:1]),b=new Float32Array([r.offset??0]);let w;try{w=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:f}},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:d}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,i,w)}finally{(p=w==null?void 0:w.destroy)==null||p.call(w),s.destroy()}}const zn=new WeakMap;function es(e,t,n){let r=zn.get(e);r||(r=new Map,zn.set(e,r));const o=`${t}:${n}`;let i=r.get(o);return i||(i=e.createRenderPipeline({shaderWGSL:t==="split"?Ko:qo,targetFormat:n}),r.set(o,i)),i}function ts(e,t,n,r,o){var p;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const i=Nn(t),s=es(e,o.mode,i),c=Gn(e,void 0),a=o.gamma,f=Qt[o.operator],h=new Float32Array([o.exposureEV,f,a,0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),b=new Float32Array([o.offset??0,0,0,0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:c},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:d}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,s,w)}finally{(p=w==null?void 0:w.destroy)==null||p.call(w),c.destroy()}}function Vn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,i=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:i,mae:o}}async function $n(e,t,n,r){const o=r??wt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=o.result.w,s=o.result.h,c=i*s*3;if(c<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:E,sumAbs:S}=await e.reduceDiffSumSquaredAbs(t,n,i,s);return Vn(E,S,c)}const f=await e.readback(t),h=await e.readback(n),g=f instanceof Uint8Array?255:1,d=h instanceof Uint8Array?255:1,b=Xn(f,t.width,t.height,g,o.offsetA,o.fit==="fill",i,s),w=Xn(h,n.width,n.height,d,o.offsetB,o.fit==="fill",i,s);let p=0,v=0;const m=[0,0,0],x=[0,0,0];for(let E=0;E<s;E++)for(let S=0;S<i;S++){b(S,E,m),w(S,E,x);for(let P=0;P<3;P++){const y=m[P]-x[P];p+=y*y,v+=Math.abs(y)}}return Vn(p,v,c)}function Xn(e,t,n,r,o,i,s,c){const a=(g,d,b)=>e[(d*t+g)*4+b]??0;if(!i)return(g,d,b)=>{const w=Math.min(Math.max(g+o.x,0),t-1),p=Math.min(Math.max(d+o.y,0),n-1);b[0]=a(w,p,0)/r,b[1]=a(w,p,1)/r,b[2]=a(w,p,2)/r};const f=t-1,h=n-1;return(g,d,b)=>{const w=(g+.5)/s,p=(d+.5)/c,v=w*t-.5,m=p*n-.5,x=Math.floor(v),E=Math.floor(m),S=v-x,P=m-E,y=Math.min(Math.max(x,0),f),k=Math.min(Math.max(x+1,0),f),M=Math.min(Math.max(E,0),h),A=Math.min(Math.max(E+1,0),h);for(let R=0;R<3;R++){const I=a(y,M,R),C=a(k,M,R),_=a(y,A,R),B=a(k,A,R),T=I+(C-I)*S,O=_+(B-_)*S;b[R]=(T+(O-T)*P)/r}}}function Wn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const ns=12,Ze=[];function Hn(e){const t=Ze.indexOf(e);t!==-1&&Ze.splice(t,1),Ze.push(e)}function rs(e){const t=Ze.indexOf(e);t!==-1&&Ze.splice(t,1)}function yt(e){e.parked||(rs(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Yn(e){for(;Ze.length>ns;){const t=Ze.find(n=>n!==e&&!n.visible)??Ze.find(n=>n!==e);if(!t)break;yt(t)}}function Kn(e){var o,i;if(e.disposed)return;if(Wn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Hn(e),Yn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((i=e.source)==null?void 0:i.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,Hn(e),Yn(e)}function os(e,t){if(e.disposed||!e.source)return!0;try{return Kn(e),!e.surface||!e.srcTexture?!1:(Jo(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,yt(e),!1}}function ss(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return os(e,t)},park(){e.disposed||yt(e)},restore(){e.disposed||!e.source||Kn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(yt(e),e.source=null,e.disposed=!0)}}}async function is(e,t){const n=await ft(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return ss(r)}function qn(e){e.dispose()}function as(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:i}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...i?["invert(1)"]:[]].join(" ")}function Zn(e){const n=`cairn-gamma-${l.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:i,exposure:s,offset:c,flipSign:a}=e,f=l.useMemo(()=>as(e,n),[n,r,o,s,a]);return{gammaFilterId:n,filterStr:f,gamma:i,offset:c}}function Qn({id:e,gamma:t,offset:n}){return u.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:u.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:u.jsxs("feComponentTransfer",{children:[u.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),u.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),u.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function jn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function cs({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=jn(e),i=jn(t),s=[];for(let x=0;x<=e;x+=o)s.push(x);const c=[];for(let x=0;x<=t;x+=i)c.push(x);const a=1/n,f=8*a,h=-12*a,g=-2*a,d=r==null?void 0:r.current;let b=0,w=0,p=0,v=0;if(d){const x=d.clientWidth,E=d.clientHeight,S=x/e,P=E/t,y=Math.min(S,P);p=e*y,v=t*y,b=(x-p)/2,w=(E-v)/2}const m=d&&p>0;return u.jsxs(u.Fragment,{children:[u.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?w:0,transform:`translateY(${h}px)`,fontSize:f},children:s.map(x=>u.jsx("span",{className:"mono",style:{position:"absolute",left:m?b+x/e*p:`${x/e*100}%`,transform:"translateX(-50%)"},children:x},x))}),u.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?b:0,transform:`translateX(${g}px)`,fontSize:f},children:c.map(x=>u.jsx("span",{className:"mono",style:{position:"absolute",top:m?w+x/t*v:`${x/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*a}px`},children:x},x))})]})}function ls({label:e,isDraggable:t,onDragStart:n}){return u.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&u.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const us=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Jn(e,t){const n=getComputedStyle(e),r=us.map(a=>`${a}:${n.getPropertyValue(a)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const i=e.children,s=t.children,c=Math.min(i.length,s.length);for(let a=0;a<c;a++)Jn(i[a],s[a])}function jt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Jt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function en(e,t,n,r,o){const i=document.createElement("canvas");i.width=Math.max(1,Math.round(e*n)),i.height=Math.max(1,Math.round(t*n));const s=i.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((c,a)=>i.toBlob(f=>f?c(f):a(new Error("plot-to-png: toBlob returned null")),"image/png"))}function fs(e,t,n){const r=e.cloneNode(!0);Jn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),i="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,c)=>{const a=new Image;a.onload=()=>s(a),a.onerror=()=>c(new Error("plot-to-png: SVG rasterization failed")),a.src=i})}async function er(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,i=(t==null?void 0:t.background)??jt(e);return en(r,o,Jt(t),i,s=>s.drawImage(e,0,0,r,o))}async function ds(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,i=(t==null?void 0:t.background)??jt(e);try{return await en(r,o,Jt(t),i,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function ps(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const i=o.getBoundingClientRect(),s=i.width*i.height;s>r&&(r=s,n=o)}return n}async function hs(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),i=o.width||300,s=o.height||150,c=(t==null?void 0:t.background)??jt(e);if(n){const f=n.getBoundingClientRect(),h=await fs(n,f.width||i,f.height||s);return en(i,s,Jt(t),c,g=>{for(const d of r){const b=d.getBoundingClientRect();g.drawImage(d,b.left-o.left,b.top-o.top,b.width,b.height)}g.drawImage(h,f.left-o.left,f.top-o.top,f.width,f.height)})}if(r.length)return er(r[0],t);const a=ps(e);if(a)return ds(a,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function ms(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const gs=8;function xs(e,t,n,r=gs){return!(t>0)||!(e>0)?n:e<t+r}function tr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function bs(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function vs(e,t){const n=bs(e);return n===null?t:n}function ws(e){return String(e)}const ys={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Es={boxZoom:u.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:u.jsxs(u.Fragment,{children:[u.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),u.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),u.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),u.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 2v20M2 12h20"}),u.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),u.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),u.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:u.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:u.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),u.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:u.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),u.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),u.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"12",cy:"12",r:"4"}),u.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M4 7h6M7 4v6"}),u.jsx("path",{d:"M14 17h6"}),u.jsx("path",{d:"M6 20l12-16"})]}),layers:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),u.jsx("path",{d:"M3 13l9 5 9-5"})]})};function He({name:e}){return u.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Es[e]??null})}function nr({icon:e,label:t,title:n,active:r,disabled:o,onClick:i}){return u.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&i()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?u.jsx("span",{"aria-hidden":"true",children:t}):u.jsx(He,{name:e??""})})}function rr(){return u.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function _s({icon:e,title:t,menu:n}){var v;const{options:r,value:o,onSelect:i}=n,[s,c]=l.useState(!1),[a,f]=l.useState(0),h=l.useRef(null),g=tr(r,o),d=e?void 0:((v=r[g])==null?void 0:v.label)??"",b=l.useCallback(()=>{c(m=>{const x=!m;return x&&f(g),x})},[g]),w=l.useCallback(m=>{i(m),c(!1)},[i]);l.useEffect(()=>{if(!s)return;const m=E=>{h.current&&!h.current.contains(E.target)&&c(!1)},x=E=>{E.key==="Escape"&&(E.stopPropagation(),c(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",x,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",x,!0)}},[s]);const p=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),f(g),c(!0));return}if(m.key==="ArrowDown")m.preventDefault(),f(x=>(x+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),f(x=>(x-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const x=r[a];x&&w(x.id)}};return u.jsxs("div",{ref:h,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[u.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),b()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:p,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",d?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[d?u.jsx("span",{"aria-hidden":"true",children:d}):u.jsx(He,{name:e??""}),u.jsx(He,{name:"caret"})]}),s&&u.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,x)=>{const E=m.id===o,S=x===a;return u.jsx("li",{role:"option","aria-selected":E,children:u.jsx("button",{type:"button",onClick:P=>{P.stopPropagation(),w(m.id)},onPointerEnter:()=>f(x),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",S?"bg-bg-hover":"",E?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const Ms=e=>e.format?e.format(e.value):String(e.value);function or({spec:e}){const[t,n]=l.useState(!1),[r,o]=l.useState(""),i=l.useRef(null),s=l.useCallback(()=>{o(ws(e.value)),n(!0)},[e.value]);l.useEffect(()=>{t&&i.current&&(i.current.focus(),i.current.select())},[t]);const c=l.useCallback(()=>{n(f=>(f&&e.onChange(vs(r,e.value)),!1))},[r,e]),a=l.useCallback(()=>n(!1),[]);return u.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:f=>f.stopPropagation(),onDoubleClick:f=>{f.stopPropagation(),t||s()},children:[e.icon?u.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:u.jsx(He,{name:e.icon})}):u.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?u.jsx("input",{ref:i,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:f=>o(f.target.value),onPointerDown:f=>f.stopPropagation(),onDoubleClick:f=>f.stopPropagation(),onKeyDown:f=>{f.stopPropagation(),f.key==="Enter"?(f.preventDefault(),c()):f.key==="Escape"&&(f.preventDefault(),a())},onBlur:c,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):u.jsxs(u.Fragment,{children:[u.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:f=>e.onChange(Number(f.target.value)),onPointerDown:f=>f.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),u.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ms(e)})]})]})}function Ss({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:i,onSelect:s}=n,[c,a]=l.useState(!1),f=tr(o,i),h=((g=o[f])==null?void 0:g.label)??"";return u.jsxs("div",{children:[u.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":c,"aria-label":t,onClick:d=>{d.stopPropagation(),a(b=>!b)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",c?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?u.jsx(He,{name:e}):u.jsx("span",{className:"w-[13px]"}),u.jsx("span",{className:"flex-1",children:t}),u.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:h}),u.jsx("span",{className:c?"rotate-180 transition-transform":"transition-transform",children:u.jsx(He,{name:"caret"})})]}),c&&o.map(d=>{const b=d.id===i;return u.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":b,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(d.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",b?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[u.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:b?"✓":""}),u.jsx("span",{children:d.label})]},d.id)})]})}function Ts({actions:e,leading:t,sliders:n}){const[r,o]=l.useState(!1),i=l.useRef(null);return l.useEffect(()=>{if(!r)return;const s=a=>{i.current&&!i.current.contains(a.target)&&o(!1)},c=a=>{a.key==="Escape"&&(a.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",c,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",c,!0)}},[r]),u.jsxs("div",{ref:i,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[u.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(c=>!c)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:u.jsx(He,{name:"ellipsis"})}),r&&u.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?u.jsx(Ss,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):u.jsxs("button",{type:"button",disabled:s.disabled,onClick:c=>{var a;c.stopPropagation(),!s.disabled&&((a=s.onClick)==null||a.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?u.jsx(He,{name:s.icon}):u.jsx("span",{className:"w-[13px]"}),u.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&u.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>u.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:c=>{c.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?u.jsx(He,{name:s.icon}):u.jsx("span",{className:"w-[13px]"}),u.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&u.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>u.jsx("div",{className:"px-2 py-1",children:u.jsx(or,{spec:s})},s.id))]})]})}function Ps({controller:e,config:t}){var I,C;const n=l.useRef(null),[r,o]=l.useState(!1),i=l.useRef(r);i.current=r;const s=l.useRef(0),c=`${((I=t==null?void 0:t.leadingButtons)==null?void 0:I.length)??0}:${((C=t==null?void 0:t.sliders)==null?void 0:C.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(l.useEffect(()=>{const _=n.current,B=_==null?void 0:_.parentElement;if(!B)return;const T=()=>{const Q=B.clientWidth;if(!i.current&&n.current){const re=n.current.scrollWidth;re>0&&(s.current=re)}o(xs(Q,s.current,i.current))};let O=0;const F=()=>{O||(O=requestAnimationFrame(()=>{O=0,T()}))},de=new ResizeObserver(F);return de.observe(B),T(),()=>{de.disconnect(),O&&cancelAnimationFrame(O)}},[c]),(t==null?void 0:t.enabled)===!1)return null;const a=e.capabilities,f=t==null?void 0:t.buttons,h=(_,B)=>B&&(f==null?void 0:f[_])!==!1,g=_=>()=>e.setDragMode(_),d=()=>{e.toPNG({filename:"plot"}).then(_=>ms(_,"plot.png")).catch(()=>{})},b=[];h("zoom",a.zoom)&&b.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),h("pan",a.pan)&&b.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),h("select",a.select)&&b.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),h("lasso",a.lasso)&&b.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const w=[];h("zoomIn",a.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),h("zoomOut",a.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const p=[];h("autoscale",a.autoscale)&&p.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),h("reset",a.reset)&&p.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const v=[];h("screenshot",a.screenshot)&&v.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:d});const m=[b,w,p,v].filter(_=>_.length>0),x=m.flat(),E=(t==null?void 0:t.leadingButtons)??[],S=(t==null?void 0:t.sliders)??[];if(!E.length&&x.length===0&&S.length===0)return null;const P=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",k=P==="top-right"||P==="bottom-right",A=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),R={position:"absolute",pointerEvents:"auto",...ys[P]};return r?u.jsx("div",{ref:n,style:R,className:`${A} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:u.jsx(Ts,{actions:x,leading:E,sliders:S})}):u.jsxs("div",{ref:n,style:R,className:`${A} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[u.jsxs("div",{className:`flex items-center gap-0.5 ${k?"justify-end":"justify-start"}`,children:[E.length>0&&u.jsxs(u.Fragment,{children:[E.map(_=>_.menu?u.jsx(_s,{icon:_.icon,title:_.title,menu:_.menu},_.id):u.jsx(nr,{icon:_.icon,label:_.label,title:_.title,active:_.active,disabled:_.disabled,onClick:_.onClick??(()=>{})},_.id)),m.length>0&&u.jsx(rr,{})]}),m.map((_,B)=>u.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[B>0&&u.jsx(rr,{}),_.map(T=>u.jsx(nr,{icon:T.icon,title:T.title,active:T.active,disabled:T.disabled,onClick:T.onClick},T.id))]},_[0].id))]}),S.length>0&&u.jsx("div",{className:`flex items-center gap-2 ${k?"justify-end":"justify-start"}`,children:S.map(_=>u.jsx(or,{spec:_},_.id))})]})}const As={zoom:1,pan:{x:0,y:0}},sr=1.3,Cs=.25,Rs=64,Ds={buttons:{zoom:!1}};function ks(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Ls=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function tn(e,t){return{id:"colormap",title:"Colormap",menu:{options:Ls,value:e,onSelect:t}}}function Is({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:i,naturalHeight:s,minZoom:c=Cs,maxZoom:a=Rs,requestRender:f,onReset:h,extraModified:g=!1}){const d=l.useCallback(y=>{var O;if(!o)return;const k=(O=e.current)==null?void 0:O.getBoundingClientRect(),M=(k==null?void 0:k.width)??0,A=(k==null?void 0:k.height)??0,R=i&&s&&M>0&&A>0?Ht(i,s,M,A):a,I=Math.max(c,Math.min(R,n*y));if(I===n)return;const C=M/2,_=A/2,B=C-(C-r.x)/n*I,T=_-(_-r.y)/n*I;o({zoom:I,pan:{x:B,y:T}})},[o,e,i,s,a,c,n,r.x,r.y]),b=l.useCallback(()=>d(sr),[d]),w=l.useCallback(()=>d(1/sr),[d]),p=l.useCallback(()=>{o==null||o(As),h==null||h()},[o,h]),v=l.useCallback(y=>{const k={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};f==null||f();const M=t==null?void 0:t.current;if(M)return er(M,k);const A=e.current;return A?hs(A,k):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,f]),m=l.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),x=n!==1||r.x!==0||r.y!==0||g,E=l.useCallback(y=>{},[]),S=l.useCallback(y=>{},[]),P=l.useCallback(()=>{},[]);return l.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:x,setDragMode:E,setHoverMode:S,toggleSpikelines:P,zoomIn:b,zoomOut:w,autoscale:p,reset:p,toPNG:v}),[m,x,E,S,P,b,w,p,v])}const Bs={zoom:1,pan:{x:0,y:0}};function Et({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:i,pan:s,onViewportChange:c,naturalDims:a,checkerboard:f,wrapperClassName:h,wrapperStyle:g,viewportPadding:d,header:b,surface:w,showAxes:p,overlayNode:v,overlay:m,notationSeed:x,exportCanvasRef:E,requestRender:S,leadingMenus:P,displayAdjust:y,depthSlider:k,onReset:M,extraModified:A,label:R,showLabelChip:I,isDraggable:C=!1,onDragStart:_,extraChips:B}){const[T,O]=l.useState(x),[F,de]=l.useState(!1),{containerProps:Q}=Ln({containerRef:r,zoom:i,pan:s,onViewportChange:c,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h}),re=l.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),M==null||M()},[y,M]),ye=l.useCallback(()=>{c==null||c(Bs),re()},[c,re]),Se=Is({rootRef:r,canvasRef:E,zoom:i,pan:s,onViewportChange:c,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h,requestRender:S,onReset:re,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!A}),le=l.useMemo(()=>{const he=[];if(k&&he.push(k),!y)return he.length?he:void 0;const j=($,N)=>`${$>=0?"+":"−"}${Math.abs($).toFixed(N)}`;return he.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:$=>j($,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:$=>j($,2)}),he},[y,k]),Pe=l.useMemo(()=>({...Ds,leadingButtons:[...P??[],...F?[ks(T,O)]:[]],sliders:le}),[F,T,P,le]),ve=" cairn-checkerboard",Ee="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(f==="pane"?ve:""),Re=h+(f==="wrapper"?ve:""),pe="render"in m?m.render({notation:T,setOverlayActive:de}):m.hasSource&&a?u.jsx(nt,{imageElRef:m.displayElRef,naturalWidth:a.w,naturalHeight:a.h,zoom:i,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:T,version:m.version,onActiveChange:de}):null;return u.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[b,n&&u.jsx(Ps,{controller:Se,config:Pe}),u.jsxs("div",{ref:r,className:Ee,style:{padding:d,...Q.style},onPointerDown:Q.onPointerDown,onPointerMove:Q.onPointerMove,onPointerUp:Q.onPointerUp,onPointerCancel:Q.onPointerCancel,onDoubleClick:ye,...t,children:[u.jsxs("div",{ref:o,className:Re,style:g,children:[w,p&&a&&u.jsx(cs,{naturalWidth:a.w,naturalHeight:a.h,zoom:i,containerRef:o}),v]}),pe,!n&&F&&u.jsx(Bn,{notation:T,onChange:O})]}),I&&u.jsx(ls,{label:R,isDraggable:C,onDragStart:_}),B]})}const Os=100,Us=1e3;function ir(e){const t=e.deep,n=(t==null?void 0:t.zMin)??0,r=(t==null?void 0:t.zMax)??0,[o,i,s]=ct(r),[c,a]=l.useState(null),f=l.useRef(0);l.useEffect(()=>()=>t==null?void 0:t.dispose(),[t]),l.useEffect(()=>{if(!t)return;if(o>=r){a(null);return}const w=++f.current,p=setTimeout(()=>{t.flatten(o).then(v=>{f.current===w&&a(v)}).catch(()=>{})},Os);return()=>clearTimeout(p)},[t,o,r]);const h=l.useMemo(()=>t&&c!=null?{...e,data:c}:e,[e,t,c]),g=t!=null&&n>0&&r/n>Us,d=l.useMemo(()=>{if(!t||!(r>n))return;const w=p=>Math.abs(p)>=1e3||Math.abs(p)<.01?p.toExponential(2):p.toFixed(3);if(g){const p=Math.log10(n),v=Math.log10(r);return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this (log scale). Double-click to type a Z.",min:p,max:v,step:(v-p)/200,value:Math.log10(Math.max(n,Math.min(o,r))),onChange:m=>i(10**m),format:m=>w(10**m)}}return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this. Double-click to type a Z.",min:n,max:r,step:(r-n)/200,value:o,onChange:p=>i(p),format:p=>w(p)}},[t,n,r,o,g,i]),b=l.useCallback(()=>{s.reset(),a(null)},[s]);return{hdr:h,slider:d,reset:b,isModified:s.isModified}}function ar(e){return"hdr"in e&&e.hdr!=null}function cr(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Ae(e){return Number.isFinite(e)?e:0}const Fs={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ns(e,t,n,r,o=0){const{h:i,w:s,c}=cr(e.shape),a=e.precision==="f16-bits"?Tn(e.data):e.data,f=po(t),h=new Uint8ClampedArray(s*i*4);for(let g=0;g<s*i;g++){const d=g*c;let b,w,p,v=1;c===1?b=w=p=Ae(a[d]):c===3?(b=Ae(a[d]),w=Ae(a[d+1]),p=Ae(a[d+2])):(b=Ae(a[d]),w=Ae(a[d+1]),p=Ae(a[d+2]),v=Ae(a[d+3]));const m=[dt(b,n,o),dt(w,n,o),dt(p,n,o)],[x,E,S]=f(m),P=g*4;h[P]=255*Nt(x,r),h[P+1]=255*Nt(E,r),h[P+2]=255*Nt(S,r),h[P+3]=255*(v<0?0:v>1?1:v)}return new ImageData(h,s,i)}function Gs(e){var G,K;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:i="auto",colormap:s="none",showAxes:c=!1,processing:a=Fs,zoom:f=1,pan:h={x:0,y:0},onViewportChange:g,onNaturalSize:d,label:b,isDraggable:w=!1,onDragStart:p,overlay:v,overlaySettings:m,pixelValueNotation:x="decimal",toolbar:E=!0}=e,[S,P,y]=ct(s);l.useEffect(()=>{P(s)},[s,P]);const k=l.useRef(null),M=l.useRef(null),A=l.useRef(null),R=l.useRef(null),I=l.useRef(null),C=l.useRef(null),_=l.useRef(null),[B,T]=l.useState(0),O=l.useCallback(()=>T(L=>L+1),[]),F=l.useMemo(()=>({get current(){const L=I.current;return L instanceof HTMLCanvasElement?L:null}}),[]),de=l.useCallback(L=>{k.current=L,L&&(I.current=L)},[]),Q=l.useCallback(L=>{M.current=L,L&&(I.current=L)},[]),re=l.useCallback(L=>{L&&(I.current=L)},[]),[ye,Se]=l.useState(!1),[le,Pe]=l.useState(!1),[ve,Ee]=l.useState(null),{flipSign:Re}=a,{gammaFilterId:pe,filterStr:he,gamma:j,offset:$}=Zn(a),N=!r&&o!=="none"&&n!=null&&t!=null,_e=o!=="none"&&n!=null,xe=S!=="none"&&!N&&!(r&&_e)&&t!=null;l.useEffect(()=>{if(!xe||!t){Pe(!1);return}let L=!1;Pe(!1);const q=`${t}::${S}`,te=Vt(q);if(te){const W=M.current;if(W){W.width=te.width,W.height=te.height;const ne=W.getContext("2d");ne&&ne.putImageData(te,0,0),_.current=te,O(),Ee({w:te.width,h:te.height}),d==null||d(te.width,te.height),Pe(!0)}return}const J=new Image;return J.onload=()=>{if(L)return;const W=document.createElement("canvas");W.width=J.naturalWidth,W.height=J.naturalHeight;const ne=W.getContext("2d");if(!ne)return;ne.drawImage(J,0,0);const we=ne.getImageData(0,0,W.width,W.height),De=zt(S),ae=Gt(we,S,De);$t(q,ae);const Te=M.current;if(!Te||L)return;Te.width=ae.width,Te.height=ae.height;const ce=Te.getContext("2d");ce&&ce.putImageData(ae,0,0),_.current=ae,O(),Ee({w:ae.width,h:ae.height}),d==null||d(ae.width,ae.height),Pe(!0)},J.src=t,()=>{L=!0}},[xe,t,S]);const me=l.useCallback((L,q)=>{Ee(te=>te&&te.w===L&&te.h===q?te:{w:L,h:q}),d==null||d(L,q)},[]);l.useEffect(()=>{if(!t){C.current=null,_.current=null,O();return}let L=!1;return Je(t).then(q=>{L||(C.current=q,S==="none"&&(_.current=q),O())}),()=>{L=!0}},[t,S,O]);const ge=l.useCallback((L,q,te)=>{const J=C.current;if(!J||L<0||q<0||L>=J.width||q>=J.height)return null;const W=(q*J.width+L)*4,ne=J.data[W],we=J.data[W+1],De=J.data[W+2],ae=_.current;let Te=ne,ce=we,Be=De;if(ae&&ae.width===J.width&&ae.height===J.height){const Ue=(q*ae.width+L)*4;Te=ae.data[Ue],ce=ae.data[Ue+1],Be=ae.data[Ue+2]}const Ye=(.299*Te+.587*ce+.114*Be)/255;return tt(S!=="none"||ne===we&&we===De?[ne]:[ne,we,De],"uint8",te,Ye)},[S]);l.useEffect(()=>{if(!N){Se(!1);return}let L=!1;const q=Po(),te=q==="gpu"||q==="auto",J=`${n}::${t}::${o}::${S}`;if(q!=="gpu"){const W=Vt(J);if(W){const ne=k.current;if(ne){(ne.width!==W.width||ne.height!==W.height)&&(ne.width=W.width,ne.height=W.height);const we=ne.getContext("2d");we&&we.putImageData(W,0,0),me(W.width,W.height),Se(!0)}return}}return(async()=>{const[W,ne]=await Promise.all([Je(n),Je(t)]);if(L||!W||!ne)return;const De=o.includes("signed")?"signed":"positive",ae=S!=="none"?Ot(S):null,Te={diffMode:o,colormap:ae,cmapMode:De};if(te)try{const Oe=k.current;if(Oe){const Ue=So(W,ne,Te,Oe);if(Ue){if(L)return;me(Ue.width,Ue.height),Se(!0);return}}}catch(Oe){console.warn("[cairn] WebGL 2 diff error:",Oe)}if(q==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let ce=bo(W,ne,o);S!=="none"&&(ce=Gt(ce,S,De)),$t(J,ce);const Be=k.current;if(!Be||L)return;(Be.width!==ce.width||Be.height!==ce.height)&&(Be.width=ce.width,Be.height=ce.height);const Ye=Be.getContext("2d");Ye&&Ye.putImageData(ce,0,0),me(ce.width,ce.height),Se(!0)})(),()=>{L=!0}},[n,t,o,N,S,d]);const Me=i==="auto"?void 0:i,X=Re?{filter:"invert(1)"}:{},H=v&&(m!=null&&m.enabled)&&ve&&t&&((((G=v.boxes)==null?void 0:G.length)??0)>0||(((K=v.masks)==null?void 0:K.length)??0)>0)?u.jsx(Kt,{data:v,settings:m,naturalWidth:ve.w,naturalHeight:ve.h}):void 0,oe=t?N?u.jsxs(u.Fragment,{children:[!ye&&u.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),u.jsx("canvas",{ref:de,className:"w-full h-full object-contain block",style:{display:ye?"block":"none",imageRendering:Me,...X}})]}):xe?u.jsxs(u.Fragment,{children:[!le&&u.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),u.jsx("canvas",{ref:Q,className:"w-full h-full object-contain block",style:{display:le?"block":"none",imageRendering:Me,...X}})]}):u.jsx("img",{ref:re,src:t,alt:b,className:"w-full h-full object-contain block",draggable:!1,style:{filter:he,imageRendering:Me},onLoad:L=>{const q=L.currentTarget;Ee({w:q.naturalWidth,h:q.naturalHeight}),d==null||d(q.naturalWidth,q.naturalHeight)}}):u.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return u.jsx(Et,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:E,paneRef:A,wrapperRef:R,zoom:f,pan:h,onViewportChange:g,naturalDims:ve,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${f})`,transformOrigin:"0 0"},viewportPadding:c&&ve?"16px 4px 4px 28px":"4px",header:u.jsx(Qn,{id:pe,gamma:j,offset:$}),surface:oe,showAxes:c,overlayNode:H,overlay:{displayElRef:I,sample:ge,version:B,hasSource:!!t},notationSeed:x,exportCanvasRef:F,leadingMenus:[tn(S,L=>P(L))],onReset:y.reset,extraModified:y.isModified,label:b,showLabelChip:!0,isDraggable:w,onDragStart:p})}function zs(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:i="",interpolation:s="auto",zoom:c=1,pan:a={x:0,y:0},onViewportChange:f,pixelValueNotation:h="decimal",toolbar:g=!0}=e,d=ir(e.hdr),b=d.hdr,w=l.useRef(null),p=l.useRef(null),v=l.useRef(null),[m,x]=l.useState(null),E=l.useRef(null),[S,P]=l.useState(0),[y,k]=l.useState(0),[M,A]=l.useState(0);l.useEffect(()=>{const C=w.current;if(!C)return;let _;try{_=Ns(b,t,n+y,r,M)}catch(T){console.error("[cairn] HDR tone-map error:",T);return}(C.width!==_.width||C.height!==_.height)&&(C.width=_.width,C.height=_.height);const B=C.getContext("2d");B&&(B.putImageData(_,0,0),E.current=_,P(T=>T+1),x(T=>T&&T.w===_.width&&T.h===_.height?T:{w:_.width,h:_.height}))},[b,t,n,r,y,M]);const R=l.useCallback((C,_,B)=>{const T=m;if(!T||C<0||_<0||C>=T.w||_>=T.h)return null;const O=b.shape.length===2?1:b.shape[2]??1,F=(_*T.w+C)*O,de=b.data,Q=b.precision==="f16-bits"?le=>mt(de[le]??0):le=>de[le]??0,re=E.current;let ye=.5;if(re&&re.width===T.w&&re.height===T.h){const le=(_*T.w+C)*4;ye=(.299*re.data[le]+.587*re.data[le+1]+.114*re.data[le+2])/255}const Se=O===1?[Q(F)]:[Q(F),Q(F+1),Q(F+2)];return tt(Se,"unit",B,ye)},[b,m]),I=s==="auto"?void 0:s;return u.jsx(Et,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:g,paneRef:p,wrapperRef:v,zoom:c,pan:a,onViewportChange:f,naturalDims:m,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${a.x}px, ${a.y}px) scale(${c})`,transformOrigin:"0 0"},viewportPadding:o&&m?"16px 4px 4px 28px":"4px",surface:u.jsx("canvas",{ref:w,className:"w-full h-full object-contain block",style:{imageRendering:I}}),showAxes:o,overlay:{displayElRef:w,sample:R,version:S,hasSource:!0},notationSeed:h,exportCanvasRef:w,displayAdjust:{exposureEV:y,offset:M,onExposureChange:k,onOffsetChange:A},depthSlider:d.slider,onReset:d.reset,extraModified:d.isModified,label:i,showLabelChip:!!i})}function nn(e){return ar(e)?u.jsx(zs,{...e}):u.jsx(Gs,{...e})}const lr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Vs="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function $s(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Xs(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Ws(e,t){if(e==="no-hdr-display")switch(Xs(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=$s(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Hs(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function ur(e,t){return`cairn-plot:capnotice:${e}:${t}`}const fr=new Set;function dr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return fr.has(e)}function Ys(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}fr.add(e)}const pr=new Set;let _t=null,st=null;function hr(){st&&st.parentNode&&st.parentNode.removeChild(st),st=null,_t=null}function Ks(e){const t=ur(e,window.location.pathname),n=Ws(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Hs(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const i=document.createElement("div");i.textContent=n,i.style.marginBottom="4px";const s=document.createElement("a");s.href=Vs,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const c=document.createElement("button");c.type="button",c.textContent="×",c.setAttribute("aria-label","Dismiss browser capability notice"),c.title="Dismiss",Object.assign(c.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),c.addEventListener("click",()=>{Ys(t),hr()}),r.appendChild(o),r.appendChild(i),r.appendChild(s),r.appendChild(c),document.body.appendChild(r),st=r,_t=e}function mr(e){if(typeof document>"u"||typeof window>"u"||pr.has(e))return;pr.add(e);const t=ur(e,window.location.pathname);if(dr(t))return;const n=()=>{if(!dr(t)){if(_t!==null)if(lr[e]<lr[_t])hr();else return;Ks(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const qs={data:new Float32Array(0),shape:[0,0],dtype:"<f4"},Zs=["linear","srgb","reinhard","aces"];function Qs(e){return e&&Zs.includes(e)?e:"srgb"}function js(e){const{h:t,w:n,c:r}=cr(e.shape);if(e.precision==="f16-bits"){const s=e.data,c=new Uint16Array(n*t*4);for(let a=0;a<n*t;a++){const f=a*r,h=a*4;if(r===1){const g=s[f];c[h]=g,c[h+1]=g,c[h+2]=g,c[h+3]=ht}else c[h]=s[f],c[h+1]=s[f+1],c[h+2]=s[f+2],c[h+3]=r>=4?s[f+3]:ht}return{data:c,width:n,height:t,format:"rgba16float"}}const o=e.data,i=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const c=s*r;let a,f,h,g=1;r===1?a=f=h=Ae(o[c]):r===3?(a=Ae(o[c]),f=Ae(o[c+1]),h=Ae(o[c+2])):(a=Ae(o[c]),f=Ae(o[c+1]),h=Ae(o[c+2]),g=Ae(o[c+3]));const d=s*4;i[d]=a,i[d+1]=f,i[d+2]=h,i[d+3]=g}return{data:i,width:n,height:t,format:"rgba32float"}}function gr(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),i=n*o,s=r*o,c=(t.width-i)/2,a=(t.height-s)/2,f=Math.max(e.zoom,1e-6),h=t.width/(f*i),g=t.height/(f*s),d=-c/i-e.pan.x/(f*i),b=-a/s-e.pan.y/(f*s);return{x:d,y:b,w:h,h:g}}function xr(e,t,n,r){const o=e.w*n,i=e.h*r;return o<=0||i<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/i)}function Js(e){var ge,Me;const t=ar(e),n=ir(t?e.hdr:qs),r=l.useRef(null),o=l.useRef(null),i=l.useRef(null),s=l.useRef(null),c=l.useRef(!1),[a,f]=l.useState(!1),[h,g]=l.useState(!1),[d,b]=l.useState(null),[w,p]=l.useState(0),[v,m]=l.useState(0),[x,E]=l.useState({x:0,y:0,w:1,h:1}),S=l.useRef(null),P=l.useRef(null),[y,k]=l.useState(0),M=e.zoom??1,A=e.pan??{x:0,y:0},R=e.onViewportChange,I=t?"none":e.colormap??"none",[C,_]=l.useState(I);l.useEffect(()=>{_(I)},[I]);const B=t?"none":C,T=l.useRef(I),O=l.useCallback(()=>{_(T.current)},[]),[F,de]=l.useState(0),[Q,re]=l.useState(0),ye=Yt();l.useEffect(()=>{const X=r.current;if(!X)return;let H=!1;return ft().then(oe=>{var q;if(H)return;const G=((q=oe.probeExtendedToneMapping)==null?void 0:q.call(oe))??!1,K=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,L=G&&K&&t;c.current=L,t&&!L&&mr(G?"no-hdr-display":"no-hdr-browser"),is(X,{hdr:L}).then(te=>{if(H){qn(te);return}s.current=te,g(!0)}).catch(te=>{H||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",te),f(!0))})}).catch(oe=>{H||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",oe),f(!0))}),()=>{H=!0,s.current&&(qn(s.current),s.current=null)}},[]),l.useEffect(()=>{const X=o.current;if(!X)return;const H=new ResizeObserver(()=>m(oe=>oe+1));return H.observe(X),()=>H.disconnect()},[]),l.useEffect(()=>{const X=o.current;if(!X)return;const H=new IntersectionObserver(oe=>{const G=oe[0];if(!G)return;const K=s.current;K&&(K.setVisible(G.isIntersecting),G.isIntersecting?K.isParked&&(K.restore(),m(L=>L+1)):K.park())},{threshold:0});return H.observe(X),()=>H.disconnect()},[]),l.useEffect(()=>{var oe;if(!t||!h)return;const X=n.hdr;S.current=X;const H=js(X);(oe=s.current)==null||oe.setSource(H),b(G=>G&&G.w===H.width&&G.h===H.height?G:{w:H.width,h:H.height}),k(G=>G+1),p(G=>G+1)},[t,h,t?n.hdr:null]),l.useEffect(()=>{if(t||!h)return;const X=e,H=X.imageUrl,oe=C;if(!H){P.current=null,b(null),k(K=>K+1);return}let G=!1;return Je(H).then(K=>{var te,J;if(G||!K)return;let L=K;if(oe!=="none"){const W=`gpu::${H}::${oe}::ev${F}::off${Q}`,ne=Vt(W);if(ne)L=ne;else{const we=zt(oe);L=Gt(K,oe,we,F,Q),$t(W,L)}}P.current=K;const q={data:L.data,width:L.width,height:L.height,format:"rgba8unorm"};(te=s.current)==null||te.setSource(q),b(W=>W&&W.w===L.width&&W.h===L.height?W:{w:L.width,h:L.height}),(J=X.onNaturalSize)==null||J.call(X,L.width,L.height),k(W=>W+1),p(W=>W+1)}),()=>{G=!0}},[t,h,t?null:e.imageUrl,t?null:C,t?0:F,t?0:Q]);const Se=t?e.exposure??0:0,le=t?e.tonemap:void 0,Pe=t?e.gamma:void 0,ve=l.useCallback(()=>{const X=s.current;if(!X||!h||!d)return;const H=o.current,oe=i.current,G=oe?oe.getBoundingClientRect():H?H.getBoundingClientRect():{width:d.w,height:d.h},K=gr({zoom:M,pan:A},G,d.w,d.h);E(J=>J.x===K.x&&J.y===K.y&&J.w===K.w&&J.h===K.h?J:K),G.width>0&&G.height>0&&X.resize(Math.round(G.width*ye),Math.round(G.height*ye));const L=xr(K,G,d.w,d.h)>=qt?"nearest":"linear",q=K,te=t?{exposureEV:Se+F,offset:Q,operator:c.current?"extended":Qs(le),gamma:Pe,isScalar:!1,hdrOut:c.current,uv:q,filter:L}:{exposureEV:B!=="none"?0:F,offset:B!=="none"?0:Q,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:q,filter:L};try{X.render(te)||f(!0)}catch(J){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",J),f(!0)}},[h,d,M,A.x,A.y,Se,F,Q,le,Pe,t,B,ye]);l.useEffect(()=>{ve()},[ve,w,v]);const Ee=l.useCallback((X,H,oe)=>{if(t){const ne=S.current,we=d;if(!ne||!we||X<0||H<0||X>=we.w||H>=we.h)return null;const De=ne.shape.length===2?1:ne.shape[2]??1,ae=(H*we.w+X)*De,Te=ne.data,ce=ne.precision==="f16-bits"?Oe=>mt(Te[Oe]??0):Oe=>Te[Oe]??0,Be=.5,Ye=De===1?[ce(ae)]:[ce(ae),ce(ae+1),ce(ae+2)];return tt(Ye,"unit",oe,Be)}const G=P.current;if(!G||X<0||H<0||X>=G.width||H>=G.height)return null;const K=(H*G.width+X)*4,L=G.data[K],q=G.data[K+1],te=G.data[K+2],J=(.299*L+.587*q+.114*te)/255;return tt(B!=="none"||L===q&&q===te?[L]:[L,q,te],"uint8",oe,J)},[t,d,B]),Re=e.showAxes??!1,pe=t?e.label??"":e.label,he=e.interpolation??"auto",j=he==="auto"?void 0:he,$=t?void 0:e.overlay,N=t?void 0:e.overlaySettings,_e=t?!1:e.isDraggable??!1,xe=t?void 0:e.onDragStart;if(a)return t?u.jsx(nn,{...e}):u.jsx(nn,{...e});const me=$&&(N!=null&&N.enabled)&&d&&((((ge=$.boxes)==null?void 0:ge.length)??0)>0||(((Me=$.masks)==null?void 0:Me.length)??0)>0)?u.jsx(Kt,{data:$,settings:N,naturalWidth:d.w,naturalHeight:d.h}):void 0;return u.jsx(Et,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":h},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:o,wrapperRef:i,zoom:M,pan:A,onViewportChange:R,naturalDims:d,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Re&&d?"16px 4px 4px 28px":0,surface:u.jsx("canvas",{ref:r,className:"w-full h-full block",style:{imageRendering:j},"data-gpu-image-canvas":!0}),showAxes:Re,overlayNode:me,overlay:{displayElRef:r,sample:Ee,version:y,hasSource:!0,sourceWindow:x},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:r,requestRender:ve,leadingMenus:t?void 0:[tn(B,X=>_(X))],displayAdjust:{exposureEV:F,offset:Q,onExposureChange:de,onOffsetChange:re},depthSlider:n.slider,onReset:()=>{O(),n.reset()},extraModified:C!==T.current||n.isModified,label:pe,showLabelChip:!!pe,isDraggable:_e,onDragStart:xe})}const Mt=new Map;function Xe(e){if(Mt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Mt.set(e.id,e)}function Qe(e){return Mt.get(e)}function ei(){return Array.from(Mt.values())}function br(e,t){return{...e.params??{},...t??{}}}const ti={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ni={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},ri={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},oi={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},si={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},ii={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},vr=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];ci(vr);const rn=[1.052156925,1,.91835767],ai=.7;function ci(e){const[t,n,r]=e[0],[o,i,s]=e[1],[c,a,f]=e[2],h=i*f-s*a,g=-(o*f-s*c),d=o*a-i*c,w=1/(t*h+n*g+r*d);return[[h*w,-(n*f-r*a)*w,(n*s-r*i)*w],[g*w,(t*f-r*c)*w,-(t*s-r*o)*w],[d*w,-(t*a-n*c)*w,(t*i-n*o)*w]]}function li(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const on=6/29;function sn(e){return e>on**3?Math.cbrt(e):e/(3*on*on)+4/29}function wr(e,t,n){const[r,o,i]=li(vr,e,t,n),s=sn(r*rn[0]),c=sn(o*rn[1]),a=sn(i*rn[2]),f=116*c-16,h=500*(s-c),g=200*(c-a);return[f,.01*f*h,.01*f*g]}function ui(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function fi(){const e=wr(0,1,0),t=wr(0,0,1);return Math.pow(ui(e,t),ai)}const yr=fi(),di=.082;function Er(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],i=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(i/(2*Math.PI**2))*e),c=1/e,a=Math.PI**2,f=[0,0,0];for(let h=-s;h<=s;h++)for(let g=-s;g<=s;g++){const d=(g*c)**2+(h*c)**2;for(let b=0;b<3;b++)f[b]+=t[b]*Math.sqrt(Math.PI/n[b])*Math.exp(-a*d/n[b])+r[b]*Math.sqrt(Math.PI/o[b])*Math.exp(-a*d/o[b])}return{r:s,deltaX:c,sums:f}}function _r(e){const t=.5*di*e,n=Math.ceil(3*t);let r=0,o=0,i=0;for(let s=-n;s<=n;s++)for(let c=-n;c<=n;c++){const a=Math.exp(-(c*c+s*s)/(2*t*t)),f=-c*a,h=(c*c/(t*t)-1)*a;f>0&&(r+=f),h>0?o+=h:i-=h}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:i}}const pi=`
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
`,hi=`
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
`,Mr=`
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
`;function We(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Tt(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},i=r!=null&&r.fill?1:0;return[We(e,[o.x,o.y,i,0]),We(e+1,[n.width,n.height,0,0])]}function Pt(e){return[We(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),We(2,[e.sums[2],0,0,0])]}function Sr(e){return[We(4,[yr,e.sd,e.r,e.edgeNorm]),We(5,[e.pointPos,e.pointNeg,0,0])]}function Tr(e,t,n,r,o,i=""){const s=Er(e),c=_r(e),a=`ycxczA${i}`,f=`ycxczB${i}`,h=`labA${i}`,g=`labB${i}`,d=`flip${i}`;return{passes:[{name:a,shader:t,inputs:[n],output:a,uniforms:()=>Tt(1,"a",o)},{name:f,shader:t,inputs:[r],output:f,uniforms:()=>Tt(1,"b",o)},{name:h,shader:St,inputs:[a],output:h,uniforms:()=>Pt(s)},{name:g,shader:St,inputs:[f],output:g,uniforms:()=>Pt(s)},{name:d,shader:Mr,inputs:[h,g,a,f],output:d,uniforms:()=>Sr(c)}],flipRef:d}}const mi={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Tr(t,pi,"srcA","srcB",e);return{passes:n,final:r}}},gi={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Tr(t,hi,"srcA","srcB",e);return{passes:n,final:r}}},Pr=`
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
`,xi=`
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
`,bi={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),i=(r-n)/Math.max(o-1,1),s=Er(t),c=_r(t),a=[];let f=null;for(let h=0;h<o;h++){const g=n+h*i,d=`_e${h}`,b=`ycxczA${d}`,w=`ycxczB${d}`,p=`labA${d}`,v=`labB${d}`,m=`acc${d}`;a.push({name:b,shader:Pr,inputs:["srcA"],output:b,uniforms:()=>[We(1,[g,0,0,0]),...Tt(2,"a",e)]},{name:w,shader:Pr,inputs:["srcB"],output:w,uniforms:()=>[We(1,[g,0,0,0]),...Tt(2,"b",e)]},{name:p,shader:St,inputs:[b],output:p,uniforms:()=>Pt(s)},{name:v,shader:St,inputs:[w],output:v,uniforms:()=>Pt(s)}),f===null?a.push({name:m,shader:Mr,inputs:[p,v,b,w],output:m,uniforms:()=>Sr(c)}):a.push({name:m,shader:xi,inputs:[p,v,b,w,f],output:m,uniforms:()=>[We(5,[yr,c.sd,c.r,c.edgeNorm]),We(6,[c.pointPos,c.pointNeg,0,0])]}),f=m}return{passes:a,final:f}}},vi=.01,wi=.03,Ar=1,Cr=1.5,Rr=5,Dr=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,yi=`
${Ie}
${Dr}
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
`,Ei=`
${Ie}
${Dr}
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
`,kr=`
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
`,_i=`
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
`;function an(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Lr(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:kr,inputs:[e],output:n,uniforms:()=>[an(1,[1,0,Rr,Cr])]},{name:r,shader:kr,inputs:[n],output:r,uniforms:()=>[an(1,[0,1,Rr,Cr])]}],out:r}}const Mi={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(vi*Ar)**2,n=(wi*Ar)**2,r=Lr("momA","statsA"),o=Lr("momB","statsB");return{passes:[{name:"momA",shader:yi,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:Ei,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:_i,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[an(2,[t,n,0,0])]}],final:"ssim"}}};let Ir=!1;function Si(){Ir||(Ir=!0,Xe(ni),Xe(ti),Xe(ri),Xe(si),Xe(oi),Xe(ii),Xe(mi),Xe(bi),Xe(gi),Xe(Mi))}Si();function Br(){const e=[];for(const n of ei())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=Qe("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Ti(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Or=new WeakMap;function cn(e,t,n,r){let o=Or.get(e);o||(o=new Map,Or.set(e,o));const i=`${t}::${r}`;let s=o.get(i);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(i,s)),s}function Pi(e){return`
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
`}const At="rgba16float";function Ai(e,t,n,r,o,i){var v,m;const s=Qe(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const c=i??wt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=c.result.w,f=c.result.h,h=c.fit==="fill"?1:0,g=br(s,o);if(s.kind==="pointwise"){const x=e.createTexture(a,f,At),E=cn(e,`pw:${s.id}`,Pi(s.source),At),S=new Float32Array([c.offsetA.x,c.offsetA.y,c.offsetB.x,c.offsetB.y]),P=new Float32Array([a,f,h,0]);let y;try{y=e.createBindGroup(E,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:S}},{binding:3,resource:{uniform:P}}]),e.renderFullscreen(x,E,y)}finally{(v=y==null?void 0:y.destroy)==null||v.call(y)}return x}const d={width:a,height:f,params:g,sourceMap:{fill:c.fit==="fill",offsetA:c.offsetA,offsetB:c.offsetB}},b=s.buildPasses(d),w=new Map([["srcA",t],["srcB",n]]),p=[];try{for(const E of b.passes){const S=e.createTexture(a,f,At);p.push(S),w.set(E.output,S);const P=cn(e,`mp:${s.id}:${E.name}`,E.shader,At),y=E.inputs.map((M,A)=>{const R=w.get(M);if(!R)throw new Error(`computeDiff: pass "${E.name}" input "${M}" not produced yet`);return{binding:A,resource:R}});E.uniforms&&y.push(...E.uniforms(d));let k;try{k=e.createBindGroup(P,y),e.renderFullscreen(S,P,k)}finally{(m=k==null?void 0:k.destroy)==null||m.call(k)}}const x=w.get(b.final);if(!x)throw new Error(`computeDiff: final ref "${b.final}" not produced`);for(const E of p)E!==x&&E.destroy();return x}catch(x){for(const E of p)E.destroy();throw x}}const Ci=8,Ri=256*1024*1024;class Di{constructor(t=Ci,n=Ri){ie(this,"map",new Map);ie(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Ur=new WeakMap;function Fr(e){let t=Ur.get(e);return t||(t=new Di,Ur.set(e,t)),t}function ki(e,t){const n=br(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Li(e,t,n,r,o){const i=Qe(n),s=i?ki(i,r):"",c=o?Qo(o):"";return`${e}|${t}|${n}|${s}|${c}`}function Ii(e,t,n,r,o,i,s,c){const a=Qe(r);if(!a)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const f=Fr(e),h=c??wt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),g=Li(i,s,r,o,h),d=f.get(g);if(d)return d;const b=Ai(e,t,n,r,o,h),w=h.result.w,p=h.result.h,v={texture:b,width:w,height:p,displayRange:a.displayRange,bytes:w*p*8};return f.set(g,v),v}async function Bi(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=$n(e,n,r,o).then(i=>(t.scalars=i,i))),t.scalarsPending)}async function Oi(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Fr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const Ui=`
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
`,Fi={unit:0,signed:1,relative:2},Ni={linear:0,signed:1,positive:2};function Gi(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function zi(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Vi(e,t,n,r,o){var b,w,p;const i=zi(t),s=cn(e,"diff-display",Ui,i),c=Gi(e,o.colormap),a=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),f=new Float32Array([Fi[r],Ni[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),h=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),g=new Float32Array([((b=o.sourceDims)==null?void 0:b.w)??0,((w=o.sourceDims)==null?void 0:w.h)??0,0,0]);let d;try{d=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:c},{binding:2,resource:{uniform:a}},{binding:3,resource:{uniform:f}},{binding:4,resource:{uniform:h}},{binding:5,resource:{uniform:g}}]),e.renderFullscreen(t,s,d)}finally{(p=d==null?void 0:d.destroy)==null||p.call(d),c.destroy()}}const Nr=.6*.6*2.51,$i=.6*.03,Xi=0,Gr=.6*.6*2.43,Wi=.6*.59,Hi=.14;function zr(e){const t=($i-Wi*e)/(Nr-Gr*e),n=(Xi-Hi*e)/(Nr-Gr*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Yi=.85,Ki=.85,Vr=11920928955078125e-23,ln=[.2126,.7152,.0722];function qi(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Zi(e,t,n,r=3,o={}){const i=t*n,s=zr(Yi),c=zr(Ki),a=new Float64Array(i);let f=0;for(let x=0;x<i;x++){const[E,S,P]=qi(e,x,r),y=E*ln[0]+S*ln[1]+P*ln[2];a[x]=y,y>f&&(f=y)}const h=Float64Array.from(a).sort(),g=i>>1,d=i%2===1?h[g]:h[g-1],b=Math.max(d,Vr),w=Math.max(f,Vr),p=o.startExposure??Math.log2(s/w),v=o.stopExposure??Math.log2(c/b),m=Math.max(2,Math.ceil(v-p));return{startExposure:p,stopExposure:v,numExposures:m}}const Qi={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ji({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:i,zoom:s,pan:c,onViewportChange:a,processing:f=Qi,interpolation:h="auto",label:g="",isDraggable:d=!1,onDragStart:b,overlay:w,overlaySettings:p,pixelValueNotation:v="decimal"}){var pe,he;const m=l.useRef(null),[x,E]=l.useState(null),[S,P]=l.useState(null),[y,k]=l.useState(v),[M,A]=l.useState(!1),R=l.useRef(null),I=l.useRef(null),C=l.useRef(null),_=l.useRef(null),[B,T]=l.useState(0);l.useEffect(()=>{if(!e){C.current=null,T($=>$+1);return}let j=!1;return Je(e).then($=>{j||(C.current=$,T(N=>N+1))}),()=>{j=!0}},[e]),l.useEffect(()=>{if(!t){_.current=null,T($=>$+1);return}let j=!1;return Je(t).then($=>{j||(_.current=$,T(N=>N+1))}),()=>{j=!0}},[t]);const O=j=>($,N,_e)=>{const xe=j.current;if(!xe||$<0||N<0||$>=xe.width||N>=xe.height)return null;const me=(N*xe.width+$)*4,ge=xe.data[me],Me=xe.data[me+1],X=xe.data[me+2],H=(.299*ge+.587*Me+.114*X)/255;return ge===Me&&Me===X?{lines:[rt(ge,"uint8",_e)],luminance:H}:{lines:[rt(ge,"uint8",_e),rt(Me,"uint8",_e),rt(X,"uint8",_e)],luminance:H,colors:[xt[0],xt[1],xt[2]]}},F=l.useMemo(()=>O(C),[]),de=l.useMemo(()=>O(_),[]),Q=!!w&&!!(p!=null&&p.enabled)&&!!x&&!!e&&((((pe=w.boxes)==null?void 0:pe.length)??0)>0||(((he=w.masks)==null?void 0:he.length)??0)>0),{gammaFilterId:re,filterStr:ye,gamma:Se,offset:le}=Zn(f),Pe=`translate(${c.x}px, ${c.y}px) scale(${s})`,ve=h==="auto"?void 0:h,{containerProps:Ee,modifierActive:Re}=Ln({containerRef:m,zoom:s,pan:c,onViewportChange:a});return u.jsxs("div",{className:"relative flex flex-col h-full",children:[u.jsx(Qn,{id:re,gamma:Se,offset:le}),u.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...Ee.style},onPointerDown:Ee.onPointerDown,onPointerMove:Ee.onPointerMove,onPointerUp:Ee.onPointerUp,onPointerCancel:Ee.onPointerCancel,children:[u.jsxs("div",{className:"relative w-full h-full",children:[u.jsxs("div",{className:"relative w-full h-full",style:{transform:Pe,transformOrigin:"0 0"},children:[u.jsx("img",{ref:R,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ye,imageRendering:ve,...n==="blend"?{opacity:o}:{}},onLoad:j=>{const $=j.currentTarget;E({w:$.naturalWidth,h:$.naturalHeight})}}),Q&&u.jsx(Kt,{data:w,settings:p,naturalWidth:x.w,naturalHeight:x.h})]}),u.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:u.jsx("div",{className:"w-full h-full",style:{transform:Pe,transformOrigin:"0 0"},children:u.jsx("img",{ref:I,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ye,imageRendering:ve,...n==="blend"?{opacity:1-o}:{}},onLoad:j=>{const $=j.currentTarget;P({w:$.naturalWidth,h:$.naturalHeight})}})})}),n==="split"&&u.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>i==null?void 0:i(.5),onPointerDown:j=>{j.stopPropagation(),j.preventDefault();const $=j.currentTarget;try{$.setPointerCapture(j.pointerId)}catch{}const _e=$.parentElement.getBoundingClientRect(),xe=ge=>{i==null||i(Math.max(0,Math.min(1,(ge.clientX-_e.left)/_e.width)))},me=()=>{window.removeEventListener("pointermove",xe),window.removeEventListener("pointerup",me)};window.addEventListener("pointermove",xe),window.addEventListener("pointerup",me)},children:u.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?u.jsxs(u.Fragment,{children:[t&&S&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:u.jsx(nt,{imageElRef:I,naturalWidth:S.w,naturalHeight:S.h,zoom:s,pan:c,sample:de,notation:y,version:B})}),e&&x&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:u.jsx(nt,{imageElRef:R,naturalWidth:x.w,naturalHeight:x.h,zoom:s,pan:c,sample:F,notation:y,version:B,onActiveChange:A})})]}):e&&x&&u.jsx(nt,{imageElRef:R,naturalWidth:x.w,naturalHeight:x.h,zoom:s,pan:c,sample:F,notation:y,version:B,onActiveChange:A}),M&&u.jsx(Bn,{notation:y,onChange:k})]}),n==="split"&&u.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),u.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${d&&!Re?" cairn-drag-grip":""}`,draggable:d&&!Re,onDragStart:b,style:{cursor:d&&!Re?"grab":void 0},children:[u.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),g]})]})}function Ji(){return u.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function ea({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:i,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:f=>{f==="side"?s==null||s():f==="slide"?r():f==="blend"?o():i(f)}}}}function ta(e){const t=Ot(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function na(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const a=e.data,f=new Uint16Array(o*4);for(let h=0;h<o;h++){const g=h*r,d=h*4;if(r===1){const b=a[g];f[d]=b,f[d+1]=b,f[d+2]=b,f[d+3]=ht}else f[d]=a[g],f[d+1]=a[g+1],f[d+2]=a[g+2],f[d+3]=r>=4?a[g+3]:ht}return{data:f,format:"rgba16float"}}const i=e.data,s=new Float32Array(o*4),c=a=>Number.isFinite(a)?a:0;for(let a=0;a<o;a++){const f=a*r;let h,g,d,b=1;r===1?h=g=d=c(i[f]):r===3?(h=c(i[f]),g=c(i[f+1]),d=c(i[f+2])):(h=c(i[f]),g=c(i[f+1]),d=c(i[f+2]),b=c(i[f+3]));const w=a*4;s[w]=h,s[w+1]=g,s[w+2]=d,s[w+3]=b}return{data:s,format:"rgba32float"}}function ra({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:i,blendAlpha:s,onSplitPositionChange:c,diffSubmode:a,colormap:f="none",align:h="top-left",fit:g="crop",diffKernel:d,onDiffKernelChange:b,onCompareModeChange:w,onRequestSide:p,zoom:v,pan:m,onViewportChange:x,interpolation:E="auto",label:S="",pixelValueNotation:P="decimal"}){var Hr;const y=l.useRef(null),k=l.useRef(null),M=l.useRef(null),A=l.useRef(null),R=l.useRef(null),[I,C]=l.useState(!1),[_,B]=l.useState(!1),[T,O]=l.useState(null),[F,de]=l.useState(null),[Q,re]=l.useState(0),[ye,Se]=l.useState(0),[le,Pe]=l.useState(null),[ve,Ee]=l.useState({x:0,y:0,w:1,h:1}),Re=d??a??"absolute",[pe,he,j]=ct(Re);l.useEffect(()=>{he(d??a??"absolute")},[d,a,he]);const $=l.useCallback(D=>{he(D),b==null||b(D)},[b,he]);l.useEffect(()=>{const D=y.current;if(D)return D.__cairnDiffKernel={current:pe,set:$},()=>{D&&delete D.__cairnDiffKernel}},[pe,$]);const[N,_e,xe]=ct(o);l.useEffect(()=>{_e(o)},[o,_e]);const me=l.useCallback(D=>{_e(D),w==null||w(D)},[w,_e]),[ge,Me,X]=ct(f);l.useEffect(()=>{Me(f)},[f,Me]);const H=l.useCallback(()=>{me(xe.default),Me(X.default),$(j.default)},[me,Me,$,xe.default,X.default,j.default]),oe=xe.isModified||X.isModified||j.isModified,[G,K]=l.useState(0),[L,q]=l.useState(0),te=l.useMemo(()=>{const z=[ea({mode:N,kernel:pe,kernelOptions:Br().map(V=>({id:V.id,label:V.label})),onSide:p,onSlide:()=>me("split"),onBlend:()=>me("blend"),onKernel:V=>{me("diff"),$(V)}})];return N==="diff"&&z.push(tn(ge,V=>Me(V))),z},[N,pe,ge,$,me,p]),J=l.useRef(null),W=l.useRef(null),ne=l.useRef(null),we=l.useRef(null),[De,ae]=l.useState(0),Te=l.useRef(null),ce=l.useRef(null),[Be,Ye]=l.useState(0),Oe=Yt();l.useEffect(()=>{const D=M.current;if(!D)return;let z=!1;return ft().then(V=>{if(!z)try{if(Wn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const U=V.createSurface(D,{hdr:!1});A.current={device:V,surface:U,texA:null,texB:null},B(!0)}catch(U){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",U),C(!0)}}).catch(V=>{z||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",V),C(!0))}),()=>{var U,Z;z=!0;const V=A.current;V&&((U=V.texA)==null||U.destroy(),(Z=V.texB)==null||Z.destroy(),A.current=null)}},[]),l.useEffect(()=>{const D=y.current;if(!D)return;const z=new ResizeObserver(()=>Se(V=>V+1));return z.observe(D),()=>z.disconnect()},[]),l.useEffect(()=>{if(!_)return;let D=!1;if(!A.current)return;async function V(U,Z){if(Z){const ue=na(Z);return{width:Z.width,height:Z.height,imageData:null,make:be=>{const se=be.createTexture(Z.width,Z.height,ue.format);return se.write(ue.data),se}}}if(!U)return null;const ee=await Je(U);return ee?{width:ee.width,height:ee.height,imageData:ee,make:ue=>{const be=ue.createTexture(ee.width,ee.height,"rgba8unorm");return be.write(ee.data),be}}:null}return Promise.all([V(e,n),V(t,r)]).then(([U,Z])=>{var ke,Ge;if(D||!A.current)return;const ee=A.current;J.current=(U==null?void 0:U.imageData)??null,W.current=(Z==null?void 0:Z.imageData)??null,ne.current=n??null,we.current=r??null,(ke=ee.texA)==null||ke.destroy(),(Ge=ee.texB)==null||Ge.destroy(),ee.texA=null,ee.texB=null;const ue=U??Z;if(!ue){O(null),de(null),ae(Ne=>Ne+1);return}const be=Z??ue,se=U??ue;ee.texA=be.make(ee.device),ee.texB=se.make(ee.device),de({a:{w:be.width,h:be.height},b:{w:se.width,h:se.height}}),O({w:ue.width,h:ue.height}),ae(Ne=>Ne+1),re(Ne=>Ne+1)}),()=>{D=!0}},[_,e,t,n,r]);const Ue=n!=null||r!=null,Fe=l.useMemo(()=>Ti(pe,Ue),[pe,Ue]),lt=l.useMemo(()=>{if(!Ue)return null;const D=r??n;if(!D)return null;const z=D.precision==="f16-bits"?Tn(D.data):D.data;return Zi(z,D.width,D.height,D.channels)},[Ue,r,n]),$r=l.useMemo(()=>{var D;return mo(((D=Qe(Fe))==null?void 0:D.displayRange)??"unit",ge==="none"?null:ge)},[Fe,ge]),Xr=l.useMemo(()=>ge!=="none"?ta(ge):void 0,[ge]),je=l.useMemo(()=>F?wt(F.a,F.b,h,g,"b"):null,[F,h,g]),Le=l.useMemo(()=>T?N==="diff"&&je?je.result:T:null,[N,je,T]),un=l.useCallback(()=>{const D=A.current;if(!_||!D||!D.surface||!D.texA||!D.texB||!T)return;const z=Le??T,V=y.current,U=V?V.getBoundingClientRect():{width:z.w,height:z.h},Z=gr({zoom:v,pan:m},U,z.w,z.h);Ee(se=>se.x===Z.x&&se.y===Z.y&&se.w===Z.w&&se.h===Z.h?se:Z);const ee=M.current;if(U.width>0&&U.height>0&&ee&&D.surface){const se=Math.max(1,Math.round(U.width*Oe)),ke=Math.max(1,Math.round(U.height*Oe));(ee.width!==se||ee.height!==ke)&&(ee.width=se,ee.height=ke,D.surface.configure(se,ke))}const ue=xr(Z,U,z.w,z.h)>=qt?"nearest":"linear",be=Z;try{if(N==="diff"){const se=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",ke=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ge=Qe(Fe)?Fe:"absolute",Ne=Ge==="hdr-flip"&&lt?{ppd:67,startExposure:lt.startExposure,stopExposure:lt.stopExposure,numExposures:lt.numExposures}:void 0,it=Ii(D.device,D.texA,D.texB,Ge,Ne,se,ke,je??void 0);R.current=it,Vi(D.device,D.surface,it.texture,it.displayRange,{uv:be,cmapMode:$r,colormap:Xr,filter:ue,exposureEV:G,offset:L})}else{const se={exposureEV:G,offset:L,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:be,filter:ue,mode:N,split:i,alpha:s};ts(D.device,D.surface,D.texA,D.texB,se)}}catch(se){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",se),C(!0)}},[_,T,Le,je,v,m.x,m.y,N,i,s,G,L,pe,Fe,lt,$r,Xr,e,t,n,r,Oe]);l.useEffect(()=>{un()},[un,Q,ye]);const Ct=t!=null||r!=null;l.useEffect(()=>{const D=A.current;if(!_||!D||!D.texA||!D.texB||!Ct){Pe(null);return}let z=!1;const V=D.texA,U=D.texB,Z=R.current,ee=N==="diff"?je??void 0:void 0;return(N==="diff"&&Z?Bi(D.device,Z,V,U,ee):$n(D.device,V,U,ee)).then(be=>{z||Pe(be)}),()=>{z=!0}},[_,Q,Ct,N,pe,je]),l.useEffect(()=>{if(N!=="diff"){Te.current=null,ce.current=null;return}const D=A.current,z=R.current;if(!_||!D||!z)return;let V=!1;return Te.current=null,ce.current=null,Ye(U=>U+1),Oi(D.device,z).then(U=>{V||(Te.current=U,ce.current={w:z.width,h:z.height},Ye(Z=>Z+1))}).catch(()=>{}),()=>{V=!0}},[_,N,Fe,Q,je]);const Wr=(D,z)=>(V,U,Z)=>{const ee=z.current;if(ee){const{data:it,width:Yr,height:ca,channels:Kr}=ee;if(V<0||U<0||V>=Yr||U>=ca)return null;const Dt=(U*Yr+V)*Kr,kt=ee.precision==="f16-bits"?pn=>mt(it[pn]??0):pn=>it[pn]??0,la=.5,ua=Kr===1?[kt(Dt)]:[kt(Dt),kt(Dt+1),kt(Dt+2)];return tt(ua,"unit",Z,la)}const ue=D.current;if(!ue||V<0||U<0||V>=ue.width||U>=ue.height)return null;const be=(U*ue.width+V)*4,se=ue.data[be],ke=ue.data[be+1],Ge=ue.data[be+2],Ne=(.299*se+.587*ke+.114*Ge)/255;return tt(se===ke&&ke===Ge?[se]:[se,ke,Ge],"uint8",Z,Ne)},Rt=l.useMemo(()=>Wr(J,ne),[]),fn=l.useMemo(()=>Wr(W,we),[]),dn=l.useMemo(()=>(D,z,V)=>{var Ne;const U=Te.current,Z=ce.current;if(!U||!Z)return null;const{w:ee,h:ue}=Z;if(D<0||z<0||D>=ee||z>=ue)return null;const be=(z*ee+D)*4,se=((Ne=Qe(Fe))==null?void 0:Ne.output)??"per-channel",ke=.5,Ge=se==="scalar"?[U[be]??0]:[U[be]??0,U[be+1]??0,U[be+2]??0];return tt(Ge,"unit",V,ke)},[Fe]);l.useEffect(()=>{const D=y.current;if(D)return D.__cairnCompareProbe={sampleDiff:(z,V,U="decimal")=>dn(z,V,U),sampleFg:(z,V,U="decimal")=>Rt(z,V,U),sampleRef:(z,V,U="decimal")=>fn(z,V,U),get diffSamples(){return Te.current},get dims(){return Le},get primaryDims(){return T},get diffResultDims(){return ce.current},get align(){return h},get fit(){return g},get resolvedKernelId(){return Fe},get compareMode(){return N}},()=>{D&&delete D.__cairnCompareProbe}},[dn,Rt,fn,T,Le,h,g,Fe,N]);const ia=E==="auto"?void 0:E;if(I)return n!=null||r!=null?u.jsx(Ji,{}):N==="diff"?u.jsx(nn,{imageUrl:e,baselineUrl:t,diffMode:((Hr=Qe(Fe))==null?void 0:Hr.kind)==="pointwise"?Fe:"absolute",interpolation:E,colormap:ge,showAxes:!1,zoom:v,pan:m,onViewportChange:x,label:S,pixelValueNotation:P}):u.jsx(ji,{imageUrl:e,baselineUrl:t,mode:N,splitPosition:i,blendAlpha:s,onSplitPositionChange:c,zoom:v,pan:m,onViewportChange:x,interpolation:E,label:S,pixelValueNotation:P});const aa=u.jsxs(u.Fragment,{children:[u.jsx("canvas",{ref:M,className:"w-full h-full block",style:{imageRendering:ia},"data-gpu-compare-canvas":!0}),N==="split"&&u.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${i*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:D=>{D.stopPropagation(),c==null||c(.5)},onPointerDown:D=>{D.stopPropagation(),D.preventDefault();const z=D.currentTarget;try{z.setPointerCapture(D.pointerId)}catch{}const U=z.parentElement.getBoundingClientRect(),Z=ue=>{c==null||c(Math.max(0,Math.min(1,(ue.clientX-U.left)/U.width)))},ee=()=>{window.removeEventListener("pointermove",Z),window.removeEventListener("pointerup",ee)};window.addEventListener("pointermove",Z),window.addEventListener("pointerup",ee)},children:u.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return u.jsx(Et,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":_},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:y,wrapperRef:k,zoom:v,pan:m,onViewportChange:x,naturalDims:Le,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:aa,showAxes:!1,notationSeed:P,onReset:H,extraModified:oe,exportCanvasRef:M,requestRender:un,leadingMenus:te,displayAdjust:{exposureEV:G,offset:L,onExposureChange:K,onOffsetChange:q},label:"",showLabelChip:!1,overlay:{render:({notation:D,setOverlayActive:z})=>N==="split"?u.jsxs(u.Fragment,{children:[Ct&&Le&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-i)*100}% 0 0)`},children:u.jsx(nt,{imageElRef:M,naturalWidth:Le.w,naturalHeight:Le.h,zoom:v,pan:m,sourceWindow:ve,sample:fn,notation:D,version:De})}),Ct&&Le&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${i*100}%)`},children:u.jsx(nt,{imageElRef:M,naturalWidth:Le.w,naturalHeight:Le.h,zoom:v,pan:m,sourceWindow:ve,sample:Rt,notation:D,version:De,onActiveChange:z})})]}):Le&&u.jsx(nt,{imageElRef:M,naturalWidth:Le.w,naturalHeight:Le.h,zoom:v,pan:m,sourceWindow:ve,sample:N==="diff"?dn:Rt,notation:D,version:N==="diff"?Be:De,onActiveChange:z})},extraChips:u.jsxs(u.Fragment,{children:[N==="split"&&u.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),S?u.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:S}):null,le&&u.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${S?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",le.mse.toExponential(2)," · PSNR ",Number.isFinite(le.psnr)?le.psnr.toFixed(1):"∞"," dB · MAE"," ",le.mae.toExponential(2)]})]})})}const oa="cairn-plot:gpu-image-ready";async function sa(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await ft(),window.__cairnPlotGpuImagePane=Js,window.__cairnPlotGpuComparePane=ra,window.__cairnPlotDiffMenuModes=Br(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(oa))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),mr("no-webgpu")}}}sa()})(__cairnPlotJsxRuntime,__cairnPlotReact);
