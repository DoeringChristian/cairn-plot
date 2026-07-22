var aa=Object.defineProperty;var ca=(u,f,Ke)=>f in u?aa(u,f,{enumerable:!0,configurable:!0,writable:!0,value:Ke}):u[f]=Ke;var ce=(u,f,Ke)=>ca(u,typeof f!="symbol"?f+"":f,Ke);(function(u,f){"use strict";const Ke=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function hn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Ke}),{hdr:!1,format:n}}function Kr(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Ke}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Ke}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return hn(e,t)}}}const qr=`
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
`;function Lt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function mn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Zr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Qr={texture:0,sampler:1,uniform:2};function It(e,t){return e*3+Qr[t]}const jr={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Jr(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),i=r[2]!==void 0,s=r[3].trim();if(i){const l=jr[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class gn{constructor(t,n,r,o){ce(this,"width");ce(this,"height");ce(this,"format");ce(this,"gpuTexture");ce(this,"device");ce(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Lt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*mn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class xn{constructor(t){ce(this,"_s");ce(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class eo{constructor(t,n,r,o,i){ce(this,"_p");ce(this,"gpuPipeline");ce(this,"bindings");ce(this,"bindGroupLayout");ce(this,"variants");ce(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=i,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function to(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class no{constructor(t){ce(this,"_c");ce(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class ro{constructor(t,n){ce(this,"_b");ce(this,"gpuBindGroup");ce(this,"ownedBuffers");ce(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class oo{constructor(t,n,r,o){ce(this,"canvas");ce(this,"hdr");ce(this,"format");ce(this,"context");ce(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function lt(e){return"canvas"in e}async function so(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function i(p){return lt(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function s(p){if(lt(p))return{width:p.canvas.width,height:p.canvas.height};const b=p;return{width:b.width,height:b.height}}let l=!1,a=null;function c(){var b,m;if(a!==null)return a;let p=!1;try{if(typeof document<"u"){const x=document.createElement("canvas");x.width=1,x.height=1;const E=x.getContext("webgpu");if(E)try{E.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const _=(b=E.getConfiguration)==null?void 0:b.call(E);p=((m=_==null?void 0:_.toneMapping)==null?void 0:m.mode)==="extended"}catch{p=!1}finally{try{E.unconfigure()}catch{}}}}catch{p=!1}return a=p,p}const d=256;let g=null,h=null;function v(){if(!g||!h){const p=t.createShaderModule({code:qr});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const b=t.createPipelineLayout({bindGroupLayouts:[h]});g=t.createComputePipeline({layout:b,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:g,layout:h}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:c,createTexture(p,b,m){return new gn(t,p,b,m)},createSampler(p){const b=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",m=t.createSampler({magFilter:b,minFilter:b,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new xn(m)},createRenderPipeline(p){const b=t.createShaderModule({code:p.shaderWGSL}),m=Jr(p.shaderWGSL),x=Lt(p.targetFormat),E=to(t,m),_=t.createPipelineLayout({bindGroupLayouts:[E]}),M=k=>t.createRenderPipeline({layout:_,vertex:{module:b,entryPoint:"vs_main"},fragment:{module:b,entryPoint:"fs_main",targets:[{format:k}]},primitive:{topology:"triangle-list"}}),y=M(x);return new eo(y,m,E,x,M)},createComputePipeline(p){const b=t.createShaderModule({code:p.shaderWGSL}),m=t.createComputePipeline({layout:"auto",compute:{module:b,entryPoint:"cs_main"}});return new no(m)},createBindGroup(p,b){const m=p,x=new Map,E=[];for(const[M,y]of m.bindings)if(y.kind==="uniform"){const k=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});E.push(k),x.set(M,{binding:M,resource:{buffer:k}})}else y.kind==="sampler"&&x.set(M,{binding:M,resource:o()});for(const M of b){const y=M.resource;if(y instanceof gn){const k=It(M.binding,"texture");m.bindings.has(k)&&x.set(k,{binding:k,resource:y.gpuTexture.createView()})}else if(y instanceof xn){const k=It(M.binding,"sampler");m.bindings.has(k)&&x.set(k,{binding:k,resource:y.gpuSampler})}else{const k=It(M.binding,"uniform"),S=m.bindings.get(k);if(S&&S.kind==="uniform"){const A=y.uniform,C=t.createBuffer({size:Math.max(S.sizeBytes,A.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(C,0,A.buffer,A.byteOffset,A.byteLength),E.push(C),x.set(k,{binding:k,resource:{buffer:C}})}}}const _=t.createBindGroup({layout:m.bindGroupLayout,entries:Array.from(x.values())});return new ro(_,E)},createSurface(p,b){const m=p.getContext("webgpu");if(!m)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const x=b.hdr&&n.hdr,E=()=>x?Kr(m,t):hn(m,t),_=E();return new oo(p,m,_,E)},renderFullscreen(p,b,m){const x=b,E=m,_=i(p),{width:M,height:y}=s(p),k=lt(p)?p.format:Lt(p.format),S=x.pipelineFor(k),A=t.createCommandEncoder(),C=A.beginRenderPass({colorAttachments:[{view:_,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});C.setPipeline(S),C.setBindGroup(0,E.gpuBindGroup),C.setViewport(0,0,M,y,0,1),C.draw(3),C.end(),t.queue.submit([A.finish()])},async readback(p){const b=lt(p),{width:m,height:x}=s(p),E=b?p.hdr?"rgba16float":"rgba8unorm":p.format,_=b&&p.format==="bgra8unorm",M=b?p.getCurrentGPUTexture():p.gpuTexture,y=mn(E),k=m*y,S=256,A=Math.ceil(k/S)*S,C=A*x,R=t.createBuffer({size:C,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),P=t.createCommandEncoder();P.copyTextureToBuffer({texture:M},{buffer:R,bytesPerRow:A,rowsPerImage:x},{width:m,height:x,depthOrArrayLayers:1}),t.queue.submit([P.finish()]),await R.mapAsync(GPUMapMode.READ);const T=new Uint8Array(R.getMappedRange()),I=new Uint8Array(k*x);for(let L=0;L<x;L++){const B=L*A,W=L*k;I.set(T.subarray(B,B+k),W)}if(R.unmap(),R.destroy(),E==="rgba8unorm"){if(_)for(let L=0;L<I.length;L+=4){const B=I[L],W=I[L+2];I[L]=W,I[L+2]=B}return I}if(E==="rgba16float"){const L=new Uint16Array(I.buffer,I.byteOffset,I.byteLength/2),B=new Float32Array(L.length);for(let W=0;W<L.length;W++)B[W]=Zr(L[W]);return B}return new Float32Array(I.buffer,I.byteOffset,I.byteLength/4)},async reduceDiffSumSquaredAbs(p,b,m,x){const E=p,_=b,M=Math.max(0,m*x),y=Math.max(1,Math.ceil(M/d)),{pipeline:k,layout:S}=v(),A=y*2*4,C=t.createBuffer({size:A,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),R=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(R,0,new Uint32Array([Math.max(1,m),Math.max(1,x),M,0]));const P=t.createBindGroup({layout:S,entries:[{binding:0,resource:E.gpuTexture.createView()},{binding:1,resource:_.gpuTexture.createView()},{binding:2,resource:{buffer:C}},{binding:3,resource:{buffer:R}}]}),T=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),I=t.createCommandEncoder(),L=I.beginComputePass();L.setPipeline(k),L.setBindGroup(0,P),L.dispatchWorkgroups(y),L.end(),I.copyBufferToBuffer(C,0,T,0,A),t.queue.submit([I.finish()]),await T.mapAsync(GPUMapMode.READ);const W=new Float32Array(T.getMappedRange()).slice();T.unmap(),T.destroy(),C.destroy(),R.destroy();let J=0,se=0;for(let ae=0;ae<y;ae++)J+=W[ae*2],se+=W[ae*2+1];return{sumSq:J,sumAbs:se}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let Bt=null;async function io(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return so()}function ut(){return Bt||(Bt=io()),Bt}function ao(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function co(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),i=Math.floor(o),s=Math.min(i+1,e.length-1),l=o-i,[a,c,d]=ao(e[i],e[s],l);t[n*3]=Math.round(a),t[n*3+1]=Math.round(c),t[n*3+2]=Math.round(d)}return t}const bn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},lo=new Set(["red-green","red-blue"]),vn=new Map;function Ot(e){let t=vn.get(e);if(!t){const n=bn[e]??bn.viridis;t=co(n),vn.set(e,t)}return t}const ze=e=>e<0?0:e>1?1:e,Ut=e=>{const t=e<0?0:e;return t/(1+t)},Nt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return ze(n/r)},wn={linear:([e,t,n])=>[ze(e),ze(t),ze(n)],srgb:([e,t,n])=>[ze(e),ze(t),ze(n)],reinhard:([e,t,n])=>[Ut(e),Ut(t),Ut(n)],aces:([e,t,n])=>[Nt(e),Nt(t),Nt(n)],extended:([e,t,n])=>[e,t,n]},uo="srgb";function fo(e){return e&&wn[e]||wn[uo]}function ft(e,t,n){return e*2**t+n}function po(e){const t=ze(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Ft(e,t){return typeof t=="number"&&t>0?ze(Math.pow(ze(e),1/t)):po(e)}function Gt(e,t,n="linear",r=0,o=0){const i=Ot(t),s=new ImageData(e.width,e.height),l=e.data,a=s.data,c=r!==0||o!==0;for(let d=0;d<l.length;d+=4){let g=(l[d]+l[d+1]+l[d+2])/3;c&&(g=Math.max(0,Math.min(255,ft(g/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+g/255*127):h=Math.round(g),h=Math.max(0,Math.min(255,h)),a[d]=i[h*3],a[d+1]=i[h*3+1],a[d+2]=i[h*3+2],a[d+3]=l[d+3]}return s}function ho(e,t){return e==="signed"||e==="relative"?"signed":zt(t)}function zt(e){return lo.has(e??"")?"positive":"linear"}function yn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const En=yn(50);function Vt(e){return En.get(e)}function $t(e,t){En.set(e,t)}const _n=yn(100);function mo(e){return _n.get(e)}function go(e,t){_n.set(e,t)}function xo(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),i=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const a=(s*e.width+l)*4,c=(s*t.width+l)*4,d=(s*r+l)*4;for(let g=0;g<3;g++){const h=e.data[a+g],v=t.data[c+g],w=h-v,p=Math.abs(w),b=Math.max(h,1);let m;switch(n){case"signed":m=(w+255)/2;break;case"absolute":m=p;break;case"squared":m=w*w/255;break;case"relative_signed":m=(w/b+1)*127.5;break;case"relative_absolute":m=p/b*255;break;case"relative_squared":m=w*w/(b*b)*255;break}i.data[d+g]=Math.min(255,Math.max(0,Math.round(m)))}i.data[d+3]=255}return i}async function Je(e){const t=mo(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const i=o.getContext("2d");if(!i){n(null);return}i.drawImage(r,0,0);const s=i.getImageData(0,0,o.width,o.height);go(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const bo={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},vo={linear:0,signed:1,positive:2},wo=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,yo=`#version 300 es
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
}`;let et=null,X=null,Re=null,dt=null;function Eo(){if(X)return X;try{if(typeof OffscreenCanvas<"u"?et=new OffscreenCanvas(1,1):et=document.createElement("canvas"),X=et.getContext("webgl2",{preserveDrawingBuffer:!0}),!X)return console.warn("[cairn] WebGL 2 not available"),null;const e=X.createShader(X.VERTEX_SHADER);if(X.shaderSource(e,wo),X.compileShader(e),!X.getShaderParameter(e,X.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",X.getShaderInfoLog(e)),null;const t=X.createShader(X.FRAGMENT_SHADER);if(X.shaderSource(t,yo),X.compileShader(t),!X.getShaderParameter(t,X.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",X.getShaderInfoLog(t)),null;if(Re=X.createProgram(),X.attachShader(Re,e),X.attachShader(Re,t),X.linkProgram(Re),!X.getProgramParameter(Re,X.LINK_STATUS))return console.error("[cairn] WebGL program link:",X.getProgramInfoLog(Re)),null;dt=X.createVertexArray(),X.bindVertexArray(dt);const n=X.createBuffer();X.bindBuffer(X.ARRAY_BUFFER,n),X.bufferData(X.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),X.STATIC_DRAW);const r=X.getAttribLocation(Re,"a_pos");return X.enableVertexAttribArray(r),X.vertexAttribPointer(r,2,X.FLOAT,!1,0,0),X.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),X}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Mn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function _o(e,t,n){const r=new Uint8Array(1024);for(let i=0;i<256;i++)r[i*4]=t[i*3],r[i*4+1]=t[i*3+1],r[i*4+2]=t[i*3+2],r[i*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Mo(e,t,n,r){const o=Eo();if(!o||!Re||!dt||!et)return null;const i=Math.min(e.width,t.width),s=Math.min(e.height,t.height);et.width=i,et.height=s,o.viewport(0,0,i,s);const l=Mn(o,e,0),a=Mn(o,t,1);let c=null;n.colormap?c=_o(o,n.colormap,2):(c=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,c),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Re),o.uniform1i(o.getUniformLocation(Re,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Re,"u_other"),1),o.uniform1i(o.getUniformLocation(Re,"u_lut"),2),o.uniform1i(o.getUniformLocation(Re,"u_diff_mode"),bo[n.diffMode]),o.uniform1i(o.getUniformLocation(Re,"u_cmap_mode"),vo[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Re,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(dt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=i,r.height=s;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(et,0,0,i,s,0,-s,i,s),d.restore()),o.deleteTexture(l),o.deleteTexture(a),o.deleteTexture(c),{width:i,height:s}}const So="cairn:render-mode";function To(){try{const e=localStorage.getItem(So);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const pt=15360;function ht(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Sn=globalThis.Float16Array;function Tn(e,t=e.length){if(Sn){const r=new Sn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=ht(e[r]);return n}const Ve=new Uint32Array(512),$e=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ve[e]=0,Ve[e|256]=32768,$e[e]=24,$e[e|256]=24):t<-14?(Ve[e]=1024>>-t-14,Ve[e|256]=1024>>-t-14|32768,$e[e]=-t-1,$e[e|256]=-t-1):t<=15?(Ve[e]=t+15<<10,Ve[e|256]=t+15<<10|32768,$e[e]=13,$e[e|256]=13):t<128?(Ve[e]=31744,Ve[e|256]=64512,$e[e]=24,$e[e|256]=24):(Ve[e]=31744,Ve[e|256]=64512,$e[e]=13,$e[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var at=Uint8Array,Pn=Uint16Array,Po=Int32Array,Ao=new at([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Co=new at([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),An=function(e,t){for(var n=new Pn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Po(n[30]),r=1;r<30;++r)for(var i=n[r];i<n[r+1];++i)o[i]=i-n[r]<<5|r;return{b:n,r:o}},Cn=An(Ao,2),Ro=Cn.b,Do=Cn.r;Ro[28]=258,Do[258]=28,An(Co,0);for(var ko=new Pn(32768),fe=0;fe<32768;++fe){var qe=(fe&43690)>>1|(fe&21845)<<1;qe=(qe&52428)>>2|(qe&13107)<<2,qe=(qe&61680)>>4|(qe&3855)<<4,ko[fe]=((qe&65280)>>8|(qe&255)<<8)>>1}for(var mt=new at(288),fe=0;fe<144;++fe)mt[fe]=8;for(var fe=144;fe<256;++fe)mt[fe]=9;for(var fe=256;fe<280;++fe)mt[fe]=7;for(var fe=280;fe<288;++fe)mt[fe]=8;for(var Lo=new at(32),fe=0;fe<32;++fe)Lo[fe]=5;var Io=new at(0),Bo=typeof TextDecoder<"u"&&new TextDecoder,Oo=0;try{Bo.decode(Io,{stream:!0}),Oo=1}catch{}const Rn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Xt(e){const t=Rn.length;return Rn[(e%t+t)%t]}function Uo(e){const n=f.useRef(null),[r,o]=f.useState({w:0,h:0}),i=f.useRef(null),s=f.useRef(null),l=f.useRef(null),a=f.useCallback((c,d)=>{o(g=>g.w===c&&g.h===d?g:{w:c,h:d})},[]);return f.useLayoutEffect(()=>{const c=n.current;if(!c||c===l.current)return;const d=c.getBoundingClientRect();(d.width>0||d.height>0)&&(l.current=c,a(d.width,d.height))}),f.useEffect(()=>{var g;const c=n.current;if(c===s.current||((g=i.current)==null||g.disconnect(),i.current=null,s.current=c,!c))return;const d=new ResizeObserver(h=>{for(const v of h)a(v.contentRect.width,v.contentRect.height)});i.current=d,d.observe(c)}),f.useEffect(()=>()=>{var c;return(c=i.current)==null?void 0:c.disconnect()},[]),{ref:n,size:r}}function No(){const[e,t]=f.useState(!1);return f.useEffect(()=>{const n=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!0)},r=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Fo=.001;function Go(e,t=Fo){return Math.exp(-e*t)}function Dn(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function kn(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function zo(e,t,n,r,o,i,s){const l=t>0&&r>0?r/t:1,a=Math.max(i,Math.min(s,e.zoom*l)),c=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:a,pan:{x:o.x-c*a,y:o.y-d*a}}}const Vo=.25,Wt=64;function Ht(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Wt;const o=Math.min(n/e,r/t);return o<=0?Wt:Math.max(Math.max(n,r)/o,8)}function Ln(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:i=Vo,maxZoom:s=Wt,naturalWidth:l,naturalHeight:a}=e,c=No(),d=f.useRef(c);d.current=c;const g=f.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const h=f.useRef(o);h.current=o,f.useEffect(()=>{const S=t.current;if(!S||!o)return;const A=C=>{var ae;if(!C.ctrlKey&&!d.current)return;C.preventDefault(),C.stopPropagation();const R=Go(C.deltaY),P=g.current,T=S.getBoundingClientRect(),I=l&&a?Ht(l,a,T.width,T.height):s,L=Math.max(i,Math.min(I,P.zoom*R));if(P.zoom===L)return;const B=C.clientX-T.left,W=C.clientY-T.top,J=B-(B-P.pan.x)/P.zoom*L,se=W-(W-P.pan.y)/P.zoom*L;(ae=h.current)==null||ae.call(h,{zoom:L,pan:{x:J,y:se}})};return S.addEventListener("wheel",A,{passive:!1}),()=>S.removeEventListener("wheel",A)},[t,!!o,i,s,l,a]);const v=f.useRef(new Map),w=f.useRef(null),p=f.useRef(null),b=f.useCallback((S,A,C)=>{const R=S.getBoundingClientRect();return{x:A-R.left,y:C-R.top}},[]),m=f.useCallback(S=>{if(!l||!a)return s;const A=S.getBoundingClientRect();return Ht(l,a,A.width,A.height)},[l,a,s]),x=f.useCallback((S,A)=>{const C=v.current,R=C.get(S),P=C.get(A);!R||!P||(w.current=null,p.current={idA:S,idB:A,startDist:Dn(R,P),startMid:kn(R,P),startZoom:g.current.zoom,startPan:{...g.current.pan}})},[]),E=f.useCallback(S=>{const A=v.current.get(S);A&&(w.current={pointerId:S,startX:A.x,startY:A.y,panX:g.current.pan.x,panY:g.current.pan.y})},[]),_=f.useCallback(S=>{if(!h.current)return;const A=S.pointerType==="touch";if(!A&&!d.current)return;const C=S.currentTarget;if(C.setPointerCapture(S.pointerId),v.current.set(S.pointerId,b(C,S.clientX,S.clientY)),A&&v.current.size>=2){const R=[...v.current.keys()];x(R[R.length-2],R[R.length-1]);return}E(S.pointerId)},[b,x,E]),M=f.useCallback(S=>{var T,I;const A=S.currentTarget,C=v.current.get(S.pointerId);if(C){const L=b(A,S.clientX,S.clientY);C.x=L.x,C.y=L.y}const R=p.current;if(R){const L=v.current.get(R.idA),B=v.current.get(R.idB);if(!L||!B)return;const W=zo({zoom:R.startZoom,pan:R.startPan},R.startDist,R.startMid,Dn(L,B),kn(L,B),i,m(A));(T=h.current)==null||T.call(h,W);return}const P=w.current;!P||P.pointerId!==S.pointerId||!C||(I=h.current)==null||I.call(h,{zoom:g.current.zoom,pan:{x:P.panX+(C.x-P.startX),y:P.panY+(C.y-P.startY)}})},[b,i,m]),y=f.useCallback(S=>{var C;try{S.currentTarget.releasePointerCapture(S.pointerId)}catch{}v.current.delete(S.pointerId);const A=p.current;if(A&&(S.pointerId===A.idA||S.pointerId===A.idB)){p.current=null;const R=[...v.current.keys()];R.length===1&&E(R[0]);return}((C=w.current)==null?void 0:C.pointerId)===S.pointerId&&(w.current=null)},[E]);return{containerProps:{onPointerDown:_,onPointerMove:M,onPointerUp:y,onPointerCancel:y,style:{cursor:c&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:c}}function Yt(){const[e,t]=f.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return f.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),i())};function i(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return i(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function gt(e){const t=f.useRef(e),[n,r]=f.useState(e),o=f.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function $o(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function In(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Kt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:i}=Uo(),s=f.useRef(null),l=f.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),a=f.useMemo(()=>{const p=i.w,b=i.h;if(p<=0||b<=0||n<=0||r<=0)return null;const m=Math.min(p/n,b/r),x=n*m,E=r*m;return{left:(p-x)/2,top:(b-E)/2,width:x,height:E}},[i.w,i.h,n,r]),c=e.masks,d=t.showMasks&&!!c&&c.length>0,g=f.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(f.useEffect(()=>{if(!d||!c)return;const p=s.current;if(!p)return;(p.width!==n||p.height!==r)&&(p.width=n,p.height=r);const b=p.getContext("2d");if(!b)return;b.clearRect(0,0,p.width,p.height);let m=!1;const x=b.createImageData(n,r),E=x.data;let _=c.length,M=!1;const y=()=>{m||M&&b.putImageData(x,0,0)},k=document.createElement("canvas");k.width=n,k.height=r;const S=k.getContext("2d",{willReadFrequently:!0});for(const A of c){const C=new Image;C.onload=()=>{if(!m){if(S){S.clearRect(0,0,n,r),S.drawImage(C,0,0,n,r);const R=S.getImageData(0,0,n,r).data;for(let P=0;P<n*r;P++){const T=R[P*4];if(T===0||l.has(T))continue;const[I,L,B]=$o(Xt(T));E[P*4]=I,E[P*4+1]=L,E[P*4+2]=B,E[P*4+3]=255,M=!0}}_-=1,_===0&&y()}},C.onerror=()=>{_-=1,_===0&&y()},C.src=`data:image/png;base64,${A.png_b64}`}return()=>{m=!0}},[d,c,n,r,g]),!a)return u.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],v=t.showBoxes&&h.length>0,w=e.class_labels??{};return u.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&u.jsx("canvas",{ref:s,className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),v&&u.jsx("svg",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((p,b)=>{if(!In(p,t,l))return null;const m=p.domain==="pixel"?1:n,x=p.domain==="pixel"?1:r,E=p.position.minX*m,_=p.position.minY*x,M=(p.position.maxX-p.position.minX)*m,y=(p.position.maxY-p.position.minY)*x;return u.jsx("rect",{x:E,y:_,width:M,height:y,fill:"none",stroke:Xt(p.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),v&&u.jsx("div",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height},children:h.map((p,b)=>{if(!In(p,t,l))return null;const m=p.domain==="pixel"?1/n:1,x=p.domain==="pixel"?1/r:1,E=p.position.minX*m*100,_=p.position.minY*x*100,M=p.label??w[String(p.class_id)]??`#${p.class_id}`,y=p.score!=null?` ${(p.score*100).toFixed(0)}%`:"";return!M&&!y?null:u.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${E}%`,top:`${_}%`,transform:"translateY(-100%)",backgroundColor:Xt(p.class_id)},children:u.jsxs("span",{className:"mono",children:[M,y]})},b)})})]})}const qt=30,xt=["#ff5a5a","#39d353","#5b9bff"];function Zt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function rt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Zt(e/255):Zt(n==="int"?e*255:e)}function tt(e,t,n,r){return e.length===1?{lines:[rt(e[0],t,n)],luminance:r}:{lines:e.map(o=>rt(o,t,n)),luminance:r,colors:e.map((o,i)=>xt[i]??null)}}const Xo={x:0,y:0,w:1,h:1};function nt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:i,notation:s="decimal",version:l=0,onActiveChange:a,sourceWindow:c=Xo}){const d=f.useRef(null),g=f.useRef(!1),h=Yt(),v=f.useRef(a);v.current=a;const w=f.useCallback(b=>{var m;b!==g.current&&(g.current=b,(m=v.current)==null||m.call(v,b))},[]),p=f.useCallback(()=>{var De;const b=d.current,m=e.current;if(!b)return;const x=window.devicePixelRatio||1,E=b.clientWidth,_=b.clientHeight;if(E===0||_===0)return;b.width!==Math.round(E*x)&&(b.width=Math.round(E*x)),b.height!==Math.round(_*x)&&(b.height=Math.round(_*x));const M=b.getContext("2d");if(!M)return;if(M.setTransform(x,0,0,x,0,0),M.clearRect(0,0,E,_),!m||t<=0||n<=0){w(!1);return}const y=m.getBoundingClientRect(),k=b.getBoundingClientRect();if(y.width===0||y.height===0){w(!1);return}const S=c.x*t,A=c.y*n,C=c.w*t,R=c.h*n;if(C<=0||R<=0){w(!1);return}const P=Math.min(y.width/C,y.height/R);if(P<qt){w(!1);return}const T=C*P,I=R*P,L=y.left+(y.width-T)/2-k.left,B=y.top+(y.height-I)/2-k.top,W=Math.max(Math.floor(S),Math.floor(S+(0-L)/P)),J=Math.min(Math.ceil(S+C),Math.ceil(S+(E-L)/P)),se=Math.max(Math.floor(A),Math.floor(A+(0-B)/P)),ae=Math.min(Math.ceil(A+R),Math.ceil(A+(_-B)/P));if(J<=W||ae<=se){w(!1);return}w(!0);const Se=L+(0-S)*P,de=B+(0-A)*P,Te=L+(t-S)*P,Ee=B+(n-A)*P;M.save(),M.beginPath(),M.rect(Se,de,Te-Se,Ee-de),M.clip(),M.textAlign="center",M.textBaseline="middle",M.lineJoin="round";const Me=P*.14,we=P-Me*2;for(let le=se;le<ae;le++)for(let pe=W;pe<J;pe++){if(pe<0||le<0||pe>=t||le>=n)continue;const q=i(pe,le,s);if(!q||q.lines.length===0)continue;const Q=q.lines.length;let V=1;for(const Y of q.lines)Y.length>V&&(V=Y.length);const _e=we/(Q*1.15),be=we/(V*.62)||_e,he=Math.min(_e,be,24);if(he<6)continue;const ge=L+(pe-S+.5)*P,N=B+(le-A+.5)*P,F=he*1.15,re=q.luminance<=.55,H=re?"#ffffff":"#000000";M.font=`${he}px ui-monospace, SFMono-Regular, Menlo, monospace`,M.lineWidth=Math.max(1.4,he*.16),M.strokeStyle=re?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Z=N-Q*F/2+F/2;for(let Y=0;Y<q.lines.length;Y++){const O=q.lines[Y];M.strokeText(O,ge,Z),M.fillStyle=((De=q.colors)==null?void 0:De[Y])??H,M.fillText(O,ge,Z),Z+=F}}M.restore()},[e,t,n,i,s,w,c]);return f.useEffect(()=>{p()},[p,r,o.x,o.y,l,s,c,h]),f.useEffect(()=>{const b=d.current;if(!b)return;const m=new ResizeObserver(()=>p());return m.observe(b),()=>m.disconnect()},[p]),u.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Bn({notation:e,onChange:t,className:n=""}){return u.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Wo=`
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
`,Ho=`
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
${Ho}

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
`}const Yo=On("select(colorB, colorA, uv.x < split)"),Ko=On("mix(colorA, colorB, alpha)");function qo(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Un(e,t,n){const{v:r,h:o}=qo(n),i=e.w-t.w,s=e.h-t.h,l=o==="left"?0:o==="right"?i:Math.floor(i/2),a=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:l,y:a}}function wt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const i={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:i,offsetA:Un(e,i,n),offsetB:Un(t,i,n)}}function Zo(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const Qt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Nn=new WeakMap;function Qo(e,t){let n=Nn.get(e);n||(n=new Map,Nn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Wo,targetFormat:t}),n.set(t,r)),r}function Fn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Gn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function jo(e,t,n,r){var p;const o=Fn(t),i=Qo(e,o),s=Gn(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,a=Qt[r.operator]??Qt.srgb,c=new Float32Array([r.exposureEV,a,l,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),v=new Float32Array([r.offset??0]);let w;try{w=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,i,w)}finally{(p=w==null?void 0:w.destroy)==null||p.call(w),s.destroy()}}const zn=new WeakMap;function Jo(e,t,n){let r=zn.get(e);r||(r=new Map,zn.set(e,r));const o=`${t}:${n}`;let i=r.get(o);return i||(i=e.createRenderPipeline({shaderWGSL:t==="split"?Yo:Ko,targetFormat:n}),r.set(o,i)),i}function es(e,t,n,r,o){var p;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const i=Fn(t),s=Jo(e,o.mode,i),l=Gn(e,void 0),a=o.gamma,c=Qt[o.operator],d=new Float32Array([o.exposureEV,c,a,0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),v=new Float32Array([o.offset??0,0,0,0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,s,w)}finally{(p=w==null?void 0:w.destroy)==null||p.call(w),l.destroy()}}function Vn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,i=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:i,mae:o}}async function $n(e,t,n,r){const o=r??wt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=o.result.w,s=o.result.h,l=i*s*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:E,sumAbs:_}=await e.reduceDiffSumSquaredAbs(t,n,i,s);return Vn(E,_,l)}const c=await e.readback(t),d=await e.readback(n),g=c instanceof Uint8Array?255:1,h=d instanceof Uint8Array?255:1,v=Xn(c,t.width,t.height,g,o.offsetA,o.fit==="fill",i,s),w=Xn(d,n.width,n.height,h,o.offsetB,o.fit==="fill",i,s);let p=0,b=0;const m=[0,0,0],x=[0,0,0];for(let E=0;E<s;E++)for(let _=0;_<i;_++){v(_,E,m),w(_,E,x);for(let M=0;M<3;M++){const y=m[M]-x[M];p+=y*y,b+=Math.abs(y)}}return Vn(p,b,l)}function Xn(e,t,n,r,o,i,s,l){const a=(g,h,v)=>e[(h*t+g)*4+v]??0;if(!i)return(g,h,v)=>{const w=Math.min(Math.max(g+o.x,0),t-1),p=Math.min(Math.max(h+o.y,0),n-1);v[0]=a(w,p,0)/r,v[1]=a(w,p,1)/r,v[2]=a(w,p,2)/r};const c=t-1,d=n-1;return(g,h,v)=>{const w=(g+.5)/s,p=(h+.5)/l,b=w*t-.5,m=p*n-.5,x=Math.floor(b),E=Math.floor(m),_=b-x,M=m-E,y=Math.min(Math.max(x,0),c),k=Math.min(Math.max(x+1,0),c),S=Math.min(Math.max(E,0),d),A=Math.min(Math.max(E+1,0),d);for(let C=0;C<3;C++){const R=a(y,S,C),P=a(k,S,C),T=a(y,A,C),I=a(k,A,C),L=R+(P-R)*_,B=T+(I-T)*_;v[C]=(L+(B-L)*M)/r}}}function Wn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const ts=12,Ze=[];function Hn(e){const t=Ze.indexOf(e);t!==-1&&Ze.splice(t,1),Ze.push(e)}function ns(e){const t=Ze.indexOf(e);t!==-1&&Ze.splice(t,1)}function yt(e){e.parked||(ns(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Yn(e){for(;Ze.length>ts;){const t=Ze.find(n=>n!==e&&!n.visible)??Ze.find(n=>n!==e);if(!t)break;yt(t)}}function Kn(e){var o,i;if(e.disposed)return;if(Wn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Hn(e),Yn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((i=e.source)==null?void 0:i.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,Hn(e),Yn(e)}function rs(e,t){if(e.disposed||!e.source)return!0;try{return Kn(e),!e.surface||!e.srcTexture?!1:(jo(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,yt(e),!1}}function os(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return rs(e,t)},park(){e.disposed||yt(e)},restore(){e.disposed||!e.source||Kn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(yt(e),e.source=null,e.disposed=!0)}}}async function ss(e,t){const n=await ut(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return os(r)}function qn(e){e.dispose()}function is(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:i}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...i?["invert(1)"]:[]].join(" ")}function Zn(e){const n=`cairn-gamma-${f.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:i,exposure:s,offset:l,flipSign:a}=e,c=f.useMemo(()=>is(e,n),[n,r,o,s,a]);return{gammaFilterId:n,filterStr:c,gamma:i,offset:l}}function Qn({id:e,gamma:t,offset:n}){return u.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:u.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:u.jsxs("feComponentTransfer",{children:[u.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),u.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),u.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function jn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function as({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=jn(e),i=jn(t),s=[];for(let x=0;x<=e;x+=o)s.push(x);const l=[];for(let x=0;x<=t;x+=i)l.push(x);const a=1/n,c=8*a,d=-12*a,g=-2*a,h=r==null?void 0:r.current;let v=0,w=0,p=0,b=0;if(h){const x=h.clientWidth,E=h.clientHeight,_=x/e,M=E/t,y=Math.min(_,M);p=e*y,b=t*y,v=(x-p)/2,w=(E-b)/2}const m=h&&p>0;return u.jsxs(u.Fragment,{children:[u.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?w:0,transform:`translateY(${d}px)`,fontSize:c},children:s.map(x=>u.jsx("span",{className:"mono",style:{position:"absolute",left:m?v+x/e*p:`${x/e*100}%`,transform:"translateX(-50%)"},children:x},x))}),u.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?v:0,transform:`translateX(${g}px)`,fontSize:c},children:l.map(x=>u.jsx("span",{className:"mono",style:{position:"absolute",top:m?w+x/t*b:`${x/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*a}px`},children:x},x))})]})}function cs({label:e,isDraggable:t,onDragStart:n}){return u.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&u.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const ls=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Jn(e,t){const n=getComputedStyle(e),r=ls.map(a=>`${a}:${n.getPropertyValue(a)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const i=e.children,s=t.children,l=Math.min(i.length,s.length);for(let a=0;a<l;a++)Jn(i[a],s[a])}function jt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Jt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function en(e,t,n,r,o){const i=document.createElement("canvas");i.width=Math.max(1,Math.round(e*n)),i.height=Math.max(1,Math.round(t*n));const s=i.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,a)=>i.toBlob(c=>c?l(c):a(new Error("plot-to-png: toBlob returned null")),"image/png"))}function us(e,t,n){const r=e.cloneNode(!0);Jn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),i="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const a=new Image;a.onload=()=>s(a),a.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),a.src=i})}async function er(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,i=(t==null?void 0:t.background)??jt(e);return en(r,o,Jt(t),i,s=>s.drawImage(e,0,0,r,o))}async function fs(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,i=(t==null?void 0:t.background)??jt(e);try{return await en(r,o,Jt(t),i,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function ds(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const i=o.getBoundingClientRect(),s=i.width*i.height;s>r&&(r=s,n=o)}return n}async function ps(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),i=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??jt(e);if(n){const c=n.getBoundingClientRect(),d=await us(n,c.width||i,c.height||s);return en(i,s,Jt(t),l,g=>{for(const h of r){const v=h.getBoundingClientRect();g.drawImage(h,v.left-o.left,v.top-o.top,v.width,v.height)}g.drawImage(d,c.left-o.left,c.top-o.top,c.width,c.height)})}if(r.length)return er(r[0],t);const a=ds(e);if(a)return fs(a,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function hs(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const ms=8;function gs(e,t,n,r=ms){return!(t>0)||!(e>0)?n:e<t+r}function tr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function xs(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function bs(e,t){const n=xs(e);return n===null?t:n}function vs(e){return String(e)}const ws={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},ys={boxZoom:u.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:u.jsxs(u.Fragment,{children:[u.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),u.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),u.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),u.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 2v20M2 12h20"}),u.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),u.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),u.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:u.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:u.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),u.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:u.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),u.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),u.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"12",cy:"12",r:"4"}),u.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M4 7h6M7 4v6"}),u.jsx("path",{d:"M14 17h6"}),u.jsx("path",{d:"M6 20l12-16"})]})};function He({name:e}){return u.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:ys[e]??null})}function nr({icon:e,label:t,title:n,active:r,disabled:o,onClick:i}){return u.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&i()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?u.jsx("span",{"aria-hidden":"true",children:t}):u.jsx(He,{name:e??""})})}function rr(){return u.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Es({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:i}=n,[s,l]=f.useState(!1),[a,c]=f.useState(0),d=f.useRef(null),g=tr(r,o),h=e?void 0:((b=r[g])==null?void 0:b.label)??"",v=f.useCallback(()=>{l(m=>{const x=!m;return x&&c(g),x})},[g]),w=f.useCallback(m=>{i(m),l(!1)},[i]);f.useEffect(()=>{if(!s)return;const m=E=>{d.current&&!d.current.contains(E.target)&&l(!1)},x=E=>{E.key==="Escape"&&(E.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",x,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",x,!0)}},[s]);const p=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),c(g),l(!0));return}if(m.key==="ArrowDown")m.preventDefault(),c(x=>(x+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),c(x=>(x-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const x=r[a];x&&w(x.id)}};return u.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[u.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),v()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:p,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?u.jsx("span",{"aria-hidden":"true",children:h}):u.jsx(He,{name:e??""}),u.jsx(He,{name:"caret"})]}),s&&u.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,x)=>{const E=m.id===o,_=x===a;return u.jsx("li",{role:"option","aria-selected":E,children:u.jsx("button",{type:"button",onClick:M=>{M.stopPropagation(),w(m.id)},onPointerEnter:()=>c(x),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",_?"bg-bg-hover":"",E?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const _s=e=>e.format?e.format(e.value):String(e.value);function or({spec:e}){const[t,n]=f.useState(!1),[r,o]=f.useState(""),i=f.useRef(null),s=f.useCallback(()=>{o(vs(e.value)),n(!0)},[e.value]);f.useEffect(()=>{t&&i.current&&(i.current.focus(),i.current.select())},[t]);const l=f.useCallback(()=>{n(c=>(c&&e.onChange(bs(r,e.value)),!1))},[r,e]),a=f.useCallback(()=>n(!1),[]);return u.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:c=>c.stopPropagation(),onDoubleClick:c=>{c.stopPropagation(),t||s()},children:[e.icon?u.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:u.jsx(He,{name:e.icon})}):u.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?u.jsx("input",{ref:i,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:c=>o(c.target.value),onPointerDown:c=>c.stopPropagation(),onDoubleClick:c=>c.stopPropagation(),onKeyDown:c=>{c.stopPropagation(),c.key==="Enter"?(c.preventDefault(),l()):c.key==="Escape"&&(c.preventDefault(),a())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):u.jsxs(u.Fragment,{children:[u.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:c=>e.onChange(Number(c.target.value)),onPointerDown:c=>c.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),u.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:_s(e)})]})]})}function Ms({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:i,onSelect:s}=n,[l,a]=f.useState(!1),c=tr(o,i),d=((g=o[c])==null?void 0:g.label)??"";return u.jsxs("div",{children:[u.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:h=>{h.stopPropagation(),a(v=>!v)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?u.jsx(He,{name:e}):u.jsx("span",{className:"w-[13px]"}),u.jsx("span",{className:"flex-1",children:t}),u.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),u.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:u.jsx(He,{name:"caret"})})]}),l&&o.map(h=>{const v=h.id===i;return u.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":v,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",v?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[u.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:v?"✓":""}),u.jsx("span",{children:h.label})]},h.id)})]})}function Ss({actions:e,leading:t,sliders:n}){const[r,o]=f.useState(!1),i=f.useRef(null);return f.useEffect(()=>{if(!r)return;const s=a=>{i.current&&!i.current.contains(a.target)&&o(!1)},l=a=>{a.key==="Escape"&&(a.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),u.jsxs("div",{ref:i,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[u.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:u.jsx(He,{name:"ellipsis"})}),r&&u.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?u.jsx(Ms,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):u.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var a;l.stopPropagation(),!s.disabled&&((a=s.onClick)==null||a.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?u.jsx(He,{name:s.icon}):u.jsx("span",{className:"w-[13px]"}),u.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&u.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>u.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?u.jsx(He,{name:s.icon}):u.jsx("span",{className:"w-[13px]"}),u.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&u.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>u.jsx("div",{className:"px-2 py-1",children:u.jsx(or,{spec:s})},s.id))]})]})}function Ts({controller:e,config:t}){var R,P;const n=f.useRef(null),[r,o]=f.useState(!1),i=f.useRef(r);i.current=r;const s=f.useRef(0),l=`${((R=t==null?void 0:t.leadingButtons)==null?void 0:R.length)??0}:${((P=t==null?void 0:t.sliders)==null?void 0:P.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(f.useEffect(()=>{const T=n.current,I=T==null?void 0:T.parentElement;if(!I)return;const L=()=>{const se=I.clientWidth;if(!i.current&&n.current){const ae=n.current.scrollWidth;ae>0&&(s.current=ae)}o(gs(se,s.current,i.current))};let B=0;const W=()=>{B||(B=requestAnimationFrame(()=>{B=0,L()}))},J=new ResizeObserver(W);return J.observe(I),L(),()=>{J.disconnect(),B&&cancelAnimationFrame(B)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const a=e.capabilities,c=t==null?void 0:t.buttons,d=(T,I)=>I&&(c==null?void 0:c[T])!==!1,g=T=>()=>e.setDragMode(T),h=()=>{e.toPNG({filename:"plot"}).then(T=>hs(T,"plot.png")).catch(()=>{})},v=[];d("zoom",a.zoom)&&v.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),d("pan",a.pan)&&v.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),d("select",a.select)&&v.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),d("lasso",a.lasso)&&v.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const w=[];d("zoomIn",a.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",a.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const p=[];d("autoscale",a.autoscale)&&p.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",a.reset)&&p.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const b=[];d("screenshot",a.screenshot)&&b.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[v,w,p,b].filter(T=>T.length>0),x=m.flat(),E=(t==null?void 0:t.leadingButtons)??[],_=(t==null?void 0:t.sliders)??[];if(!E.length&&x.length===0&&_.length===0)return null;const M=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",k=M==="top-right"||M==="bottom-right",A=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),C={position:"absolute",pointerEvents:"auto",...ws[M]};return r?u.jsx("div",{ref:n,style:C,className:`${A} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:u.jsx(Ss,{actions:x,leading:E,sliders:_})}):u.jsxs("div",{ref:n,style:C,className:`${A} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[u.jsxs("div",{className:`flex items-center gap-0.5 ${k?"justify-end":"justify-start"}`,children:[E.length>0&&u.jsxs(u.Fragment,{children:[E.map(T=>T.menu?u.jsx(Es,{icon:T.icon,title:T.title,menu:T.menu},T.id):u.jsx(nr,{icon:T.icon,label:T.label,title:T.title,active:T.active,disabled:T.disabled,onClick:T.onClick??(()=>{})},T.id)),m.length>0&&u.jsx(rr,{})]}),m.map((T,I)=>u.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[I>0&&u.jsx(rr,{}),T.map(L=>u.jsx(nr,{icon:L.icon,title:L.title,active:L.active,disabled:L.disabled,onClick:L.onClick},L.id))]},T[0].id))]}),_.length>0&&u.jsx("div",{className:`flex items-center gap-2 ${k?"justify-end":"justify-start"}`,children:_.map(T=>u.jsx(or,{spec:T},T.id))})]})}const Ps={zoom:1,pan:{x:0,y:0}},sr=1.3,As=.25,Cs=64,Rs={buttons:{zoom:!1}};function Ds(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const ks=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function tn(e,t){return{id:"colormap",title:"Colormap",menu:{options:ks,value:e,onSelect:t}}}function Ls({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:i,naturalHeight:s,minZoom:l=As,maxZoom:a=Cs,requestRender:c,onReset:d,extraModified:g=!1}){const h=f.useCallback(y=>{var B;if(!o)return;const k=(B=e.current)==null?void 0:B.getBoundingClientRect(),S=(k==null?void 0:k.width)??0,A=(k==null?void 0:k.height)??0,C=i&&s&&S>0&&A>0?Ht(i,s,S,A):a,R=Math.max(l,Math.min(C,n*y));if(R===n)return;const P=S/2,T=A/2,I=P-(P-r.x)/n*R,L=T-(T-r.y)/n*R;o({zoom:R,pan:{x:I,y:L}})},[o,e,i,s,a,l,n,r.x,r.y]),v=f.useCallback(()=>h(sr),[h]),w=f.useCallback(()=>h(1/sr),[h]),p=f.useCallback(()=>{o==null||o(Ps),d==null||d()},[o,d]),b=f.useCallback(y=>{const k={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};c==null||c();const S=t==null?void 0:t.current;if(S)return er(S,k);const A=e.current;return A?ps(A,k):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,c]),m=f.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),x=n!==1||r.x!==0||r.y!==0||g,E=f.useCallback(y=>{},[]),_=f.useCallback(y=>{},[]),M=f.useCallback(()=>{},[]);return f.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:x,setDragMode:E,setHoverMode:_,toggleSpikelines:M,zoomIn:v,zoomOut:w,autoscale:p,reset:p,toPNG:b}),[m,x,E,_,M,v,w,p,b])}const Is={zoom:1,pan:{x:0,y:0}};function Et({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:i,pan:s,onViewportChange:l,naturalDims:a,checkerboard:c,wrapperClassName:d,wrapperStyle:g,viewportPadding:h,header:v,surface:w,showAxes:p,overlayNode:b,overlay:m,notationSeed:x,exportCanvasRef:E,requestRender:_,leadingMenus:M,displayAdjust:y,onReset:k,extraModified:S,label:A,showLabelChip:C,isDraggable:R=!1,onDragStart:P,extraChips:T}){const[I,L]=f.useState(x),[B,W]=f.useState(!1),{containerProps:J}=Ln({containerRef:r,zoom:i,pan:s,onViewportChange:l,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h}),se=f.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),k==null||k()},[y,k]),ae=f.useCallback(()=>{l==null||l(Is),se()},[l,se]),Se=Ls({rootRef:r,canvasRef:E,zoom:i,pan:s,onViewportChange:l,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h,requestRender:_,onReset:se,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!S}),de=f.useMemo(()=>{if(!y)return;const le=(pe,q)=>`${pe>=0?"+":"−"}${Math.abs(pe).toFixed(q)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:pe=>le(pe,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:pe=>le(pe,2)}]},[y]),Te=f.useMemo(()=>({...Rs,leadingButtons:[...M??[],...B?[Ds(I,L)]:[]],sliders:de}),[B,I,M,de]),Ee=" cairn-checkerboard",Me="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(c==="pane"?Ee:""),we=d+(c==="wrapper"?Ee:""),De="render"in m?m.render({notation:I,setOverlayActive:W}):m.hasSource&&a?u.jsx(nt,{imageElRef:m.displayElRef,naturalWidth:a.w,naturalHeight:a.h,zoom:i,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:I,version:m.version,onActiveChange:W}):null;return u.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[v,n&&u.jsx(Ts,{controller:Se,config:Te}),u.jsxs("div",{ref:r,className:Me,style:{padding:h,...J.style},onPointerDown:J.onPointerDown,onPointerMove:J.onPointerMove,onPointerUp:J.onPointerUp,onPointerCancel:J.onPointerCancel,onDoubleClick:ae,...t,children:[u.jsxs("div",{ref:o,className:we,style:g,children:[w,p&&a&&u.jsx(as,{naturalWidth:a.w,naturalHeight:a.h,zoom:i,containerRef:o}),b]}),De,!n&&B&&u.jsx(Bn,{notation:I,onChange:L})]}),C&&u.jsx(cs,{label:A,isDraggable:R,onDragStart:P}),T]})}function ir(e){return"hdr"in e&&e.hdr!=null}function ar(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Ae(e){return Number.isFinite(e)?e:0}const Bs={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Os(e,t,n,r,o=0){const{h:i,w:s,c:l}=ar(e.shape),a=e.precision==="f16-bits"?Tn(e.data):e.data,c=fo(t),d=new Uint8ClampedArray(s*i*4);for(let g=0;g<s*i;g++){const h=g*l;let v,w,p,b=1;l===1?v=w=p=Ae(a[h]):l===3?(v=Ae(a[h]),w=Ae(a[h+1]),p=Ae(a[h+2])):(v=Ae(a[h]),w=Ae(a[h+1]),p=Ae(a[h+2]),b=Ae(a[h+3]));const m=[ft(v,n,o),ft(w,n,o),ft(p,n,o)],[x,E,_]=c(m),M=g*4;d[M]=255*Ft(x,r),d[M+1]=255*Ft(E,r),d[M+2]=255*Ft(_,r),d[M+3]=255*(b<0?0:b>1?1:b)}return new ImageData(d,s,i)}function Us(e){var Z,Y;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:i="auto",colormap:s="none",showAxes:l=!1,processing:a=Bs,zoom:c=1,pan:d={x:0,y:0},onViewportChange:g,onNaturalSize:h,label:v,isDraggable:w=!1,onDragStart:p,overlay:b,overlaySettings:m,pixelValueNotation:x="decimal",toolbar:E=!0}=e,[_,M,y]=gt(s);f.useEffect(()=>{M(s)},[s,M]);const k=f.useRef(null),S=f.useRef(null),A=f.useRef(null),C=f.useRef(null),R=f.useRef(null),P=f.useRef(null),T=f.useRef(null),[I,L]=f.useState(0),B=f.useCallback(()=>L(O=>O+1),[]),W=f.useMemo(()=>({get current(){const O=R.current;return O instanceof HTMLCanvasElement?O:null}}),[]),J=f.useCallback(O=>{k.current=O,O&&(R.current=O)},[]),se=f.useCallback(O=>{S.current=O,O&&(R.current=O)},[]),ae=f.useCallback(O=>{O&&(R.current=O)},[]),[Se,de]=f.useState(!1),[Te,Ee]=f.useState(!1),[Me,we]=f.useState(null),{flipSign:De}=a,{gammaFilterId:le,filterStr:pe,gamma:q,offset:Q}=Zn(a),V=!r&&o!=="none"&&n!=null&&t!=null,_e=o!=="none"&&n!=null,be=_!=="none"&&!V&&!(r&&_e)&&t!=null;f.useEffect(()=>{if(!be||!t){Ee(!1);return}let O=!1;Ee(!1);const $=`${t}::${_}`,te=Vt($);if(te){const K=S.current;if(K){K.width=te.width,K.height=te.height;const oe=K.getContext("2d");oe&&oe.putImageData(te,0,0),T.current=te,B(),we({w:te.width,h:te.height}),h==null||h(te.width,te.height),Ee(!0)}return}const ne=new Image;return ne.onload=()=>{if(O)return;const K=document.createElement("canvas");K.width=ne.naturalWidth,K.height=ne.naturalHeight;const oe=K.getContext("2d");if(!oe)return;oe.drawImage(ne,0,0);const Ce=oe.getImageData(0,0,K.width,K.height),Pe=zt(_),me=Gt(Ce,_,Pe);$t($,me);const ye=S.current;if(!ye||O)return;ye.width=me.width,ye.height=me.height;const xe=ye.getContext("2d");xe&&xe.putImageData(me,0,0),T.current=me,B(),we({w:me.width,h:me.height}),h==null||h(me.width,me.height),Ee(!0)},ne.src=t,()=>{O=!0}},[be,t,_]);const he=f.useCallback((O,$)=>{we(te=>te&&te.w===O&&te.h===$?te:{w:O,h:$}),h==null||h(O,$)},[]);f.useEffect(()=>{if(!t){P.current=null,T.current=null,B();return}let O=!1;return Je(t).then($=>{O||(P.current=$,_==="none"&&(T.current=$),B())}),()=>{O=!0}},[t,_,B]);const ge=f.useCallback((O,$,te)=>{const ne=P.current;if(!ne||O<0||$<0||O>=ne.width||$>=ne.height)return null;const K=($*ne.width+O)*4,oe=ne.data[K],Ce=ne.data[K+1],Pe=ne.data[K+2],me=T.current;let ye=oe,xe=Ce,Be=Pe;if(me&&me.width===ne.width&&me.height===ne.height){const Oe=($*me.width+O)*4;ye=me.data[Oe],xe=me.data[Oe+1],Be=me.data[Oe+2]}const Fe=(.299*ye+.587*xe+.114*Be)/255;return tt(_!=="none"||oe===Ce&&Ce===Pe?[oe]:[oe,Ce,Pe],"uint8",te,Fe)},[_]);f.useEffect(()=>{if(!V){de(!1);return}let O=!1;const $=To(),te=$==="gpu"||$==="auto",ne=`${n}::${t}::${o}::${_}`;if($!=="gpu"){const K=Vt(ne);if(K){const oe=k.current;if(oe){(oe.width!==K.width||oe.height!==K.height)&&(oe.width=K.width,oe.height=K.height);const Ce=oe.getContext("2d");Ce&&Ce.putImageData(K,0,0),he(K.width,K.height),de(!0)}return}}return(async()=>{const[K,oe]=await Promise.all([Je(n),Je(t)]);if(O||!K||!oe)return;const Pe=o.includes("signed")?"signed":"positive",me=_!=="none"?Ot(_):null,ye={diffMode:o,colormap:me,cmapMode:Pe};if(te)try{const Ye=k.current;if(Ye){const Oe=Mo(K,oe,ye,Ye);if(Oe){if(O)return;he(Oe.width,Oe.height),de(!0);return}}}catch(Ye){console.warn("[cairn] WebGL 2 diff error:",Ye)}if($==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let xe=xo(K,oe,o);_!=="none"&&(xe=Gt(xe,_,Pe)),$t(ne,xe);const Be=k.current;if(!Be||O)return;(Be.width!==xe.width||Be.height!==xe.height)&&(Be.width=xe.width,Be.height=xe.height);const Fe=Be.getContext("2d");Fe&&Fe.putImageData(xe,0,0),he(xe.width,xe.height),de(!0)})(),()=>{O=!0}},[n,t,o,V,_,h]);const N=i==="auto"?void 0:i,F=De?{filter:"invert(1)"}:{},re=b&&(m!=null&&m.enabled)&&Me&&t&&((((Z=b.boxes)==null?void 0:Z.length)??0)>0||(((Y=b.masks)==null?void 0:Y.length)??0)>0)?u.jsx(Kt,{data:b,settings:m,naturalWidth:Me.w,naturalHeight:Me.h}):void 0,H=t?V?u.jsxs(u.Fragment,{children:[!Se&&u.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),u.jsx("canvas",{ref:J,className:"w-full h-full object-contain block",style:{display:Se?"block":"none",imageRendering:N,...F}})]}):be?u.jsxs(u.Fragment,{children:[!Te&&u.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),u.jsx("canvas",{ref:se,className:"w-full h-full object-contain block",style:{display:Te?"block":"none",imageRendering:N,...F}})]}):u.jsx("img",{ref:ae,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:pe,imageRendering:N},onLoad:O=>{const $=O.currentTarget;we({w:$.naturalWidth,h:$.naturalHeight}),h==null||h($.naturalWidth,$.naturalHeight)}}):u.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return u.jsx(Et,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:E,paneRef:A,wrapperRef:C,zoom:c,pan:d,onViewportChange:g,naturalDims:Me,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${c})`,transformOrigin:"0 0"},viewportPadding:l&&Me?"16px 4px 4px 28px":"4px",header:u.jsx(Qn,{id:le,gamma:q,offset:Q}),surface:H,showAxes:l,overlayNode:re,overlay:{displayElRef:R,sample:ge,version:I,hasSource:!!t},notationSeed:x,exportCanvasRef:W,leadingMenus:[tn(_,O=>M(O))],onReset:y.reset,extraModified:y.isModified,label:v,showLabelChip:!0,isDraggable:w,onDragStart:p})}function Ns(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:i=!1,label:s="",interpolation:l="auto",zoom:a=1,pan:c={x:0,y:0},onViewportChange:d,pixelValueNotation:g="decimal",toolbar:h=!0}=e,v=f.useRef(null),w=f.useRef(null),p=f.useRef(null),[b,m]=f.useState(null),x=f.useRef(null),[E,_]=f.useState(0),[M,y]=f.useState(0),[k,S]=f.useState(0);f.useEffect(()=>{const R=v.current;if(!R)return;let P;try{P=Os(t,n,r+M,o,k)}catch(I){console.error("[cairn] HDR tone-map error:",I);return}(R.width!==P.width||R.height!==P.height)&&(R.width=P.width,R.height=P.height);const T=R.getContext("2d");T&&(T.putImageData(P,0,0),x.current=P,_(I=>I+1),m(I=>I&&I.w===P.width&&I.h===P.height?I:{w:P.width,h:P.height}))},[t,n,r,o,M,k]);const A=f.useCallback((R,P,T)=>{const I=b;if(!I||R<0||P<0||R>=I.w||P>=I.h)return null;const L=t.shape.length===2?1:t.shape[2]??1,B=(P*I.w+R)*L,W=t.data,J=t.precision==="f16-bits"?de=>ht(W[de]??0):de=>W[de]??0,se=x.current;let ae=.5;if(se&&se.width===I.w&&se.height===I.h){const de=(P*I.w+R)*4;ae=(.299*se.data[de]+.587*se.data[de+1]+.114*se.data[de+2])/255}const Se=L===1?[J(B)]:[J(B),J(B+1),J(B+2)];return tt(Se,"unit",T,ae)},[t,b]),C=l==="auto"?void 0:l;return u.jsx(Et,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:h,paneRef:w,wrapperRef:p,zoom:a,pan:c,onViewportChange:d,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${c.x}px, ${c.y}px) scale(${a})`,transformOrigin:"0 0"},viewportPadding:i&&b?"16px 4px 4px 28px":"4px",surface:u.jsx("canvas",{ref:v,className:"w-full h-full object-contain block",style:{imageRendering:C}}),showAxes:i,overlay:{displayElRef:v,sample:A,version:E,hasSource:!0},notationSeed:g,exportCanvasRef:v,displayAdjust:{exposureEV:M,offset:k,onExposureChange:y,onOffsetChange:S},label:s,showLabelChip:!!s})}function nn(e){return ir(e)?u.jsx(Ns,{...e}):u.jsx(Us,{...e})}const cr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Fs="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function Gs(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function zs(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Vs(e,t){if(e==="no-hdr-display")switch(zs(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=Gs(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function $s(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function lr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const ur=new Set;function fr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return ur.has(e)}function Xs(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}ur.add(e)}const dr=new Set;let _t=null,st=null;function pr(){st&&st.parentNode&&st.parentNode.removeChild(st),st=null,_t=null}function Ws(e){const t=lr(e,window.location.pathname),n=Vs(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=$s(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const i=document.createElement("div");i.textContent=n,i.style.marginBottom="4px";const s=document.createElement("a");s.href=Fs,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{Xs(t),pr()}),r.appendChild(o),r.appendChild(i),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),st=r,_t=e}function hr(e){if(typeof document>"u"||typeof window>"u"||dr.has(e))return;dr.add(e);const t=lr(e,window.location.pathname);if(fr(t))return;const n=()=>{if(!fr(t)){if(_t!==null)if(cr[e]<cr[_t])pr();else return;Ws(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Hs=["linear","srgb","reinhard","aces"];function Ys(e){return e&&Hs.includes(e)?e:"srgb"}function Ks(e){const{h:t,w:n,c:r}=ar(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let a=0;a<n*t;a++){const c=a*r,d=a*4;if(r===1){const g=s[c];l[d]=g,l[d+1]=g,l[d+2]=g,l[d+3]=pt}else l[d]=s[c],l[d+1]=s[c+1],l[d+2]=s[c+2],l[d+3]=r>=4?s[c+3]:pt}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,i=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let a,c,d,g=1;r===1?a=c=d=Ae(o[l]):r===3?(a=Ae(o[l]),c=Ae(o[l+1]),d=Ae(o[l+2])):(a=Ae(o[l]),c=Ae(o[l+1]),d=Ae(o[l+2]),g=Ae(o[l+3]));const h=s*4;i[h]=a,i[h+1]=c,i[h+2]=d,i[h+3]=g}return{data:i,width:n,height:t,format:"rgba32float"}}function mr(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),i=n*o,s=r*o,l=(t.width-i)/2,a=(t.height-s)/2,c=Math.max(e.zoom,1e-6),d=t.width/(c*i),g=t.height/(c*s),h=-l/i-e.pan.x/(c*i),v=-a/s-e.pan.y/(c*s);return{x:h,y:v,w:d,h:g}}function gr(e,t,n,r){const o=e.w*n,i=e.h*r;return o<=0||i<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/i)}function qs(e){var he,ge;const t=ir(e),n=f.useRef(null),r=f.useRef(null),o=f.useRef(null),i=f.useRef(null),s=f.useRef(!1),[l,a]=f.useState(!1),[c,d]=f.useState(!1),[g,h]=f.useState(null),[v,w]=f.useState(0),[p,b]=f.useState(0),[m,x]=f.useState({x:0,y:0,w:1,h:1}),E=f.useRef(null),_=f.useRef(null),[M,y]=f.useState(0),k=e.zoom??1,S=e.pan??{x:0,y:0},A=e.onViewportChange,C=t?"none":e.colormap??"none",[R,P]=f.useState(C);f.useEffect(()=>{P(C)},[C]);const T=t?"none":R,I=f.useRef(C),L=f.useCallback(()=>{P(I.current)},[]),[B,W]=f.useState(0),[J,se]=f.useState(0),ae=Yt();f.useEffect(()=>{const N=n.current;if(!N)return;let F=!1;return ut().then(re=>{var O;if(F)return;const H=((O=re.probeExtendedToneMapping)==null?void 0:O.call(re))??!1,Z=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,Y=H&&Z&&t;s.current=Y,t&&!Y&&hr(H?"no-hdr-display":"no-hdr-browser"),ss(N,{hdr:Y}).then($=>{if(F){qn($);return}i.current=$,d(!0)}).catch($=>{F||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",$),a(!0))})}).catch(re=>{F||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",re),a(!0))}),()=>{F=!0,i.current&&(qn(i.current),i.current=null)}},[]),f.useEffect(()=>{const N=r.current;if(!N)return;const F=new ResizeObserver(()=>b(re=>re+1));return F.observe(N),()=>F.disconnect()},[]),f.useEffect(()=>{const N=r.current;if(!N)return;const F=new IntersectionObserver(re=>{const H=re[0];if(!H)return;const Z=i.current;Z&&(Z.setVisible(H.isIntersecting),H.isIntersecting?Z.isParked&&(Z.restore(),b(Y=>Y+1)):Z.park())},{threshold:0});return F.observe(N),()=>F.disconnect()},[]),f.useEffect(()=>{var re;if(!t||!c)return;const N=e.hdr;E.current=N;const F=Ks(N);(re=i.current)==null||re.setSource(F),h(H=>H&&H.w===F.width&&H.h===F.height?H:{w:F.width,h:F.height}),y(H=>H+1),w(H=>H+1)},[t,c,t?e.hdr:null]),f.useEffect(()=>{if(t||!c)return;const N=e,F=N.imageUrl,re=R;if(!F){_.current=null,h(null),y(Z=>Z+1);return}let H=!1;return Je(F).then(Z=>{var $,te;if(H||!Z)return;let Y=Z;if(re!=="none"){const ne=`gpu::${F}::${re}::ev${B}::off${J}`,K=Vt(ne);if(K)Y=K;else{const oe=zt(re);Y=Gt(Z,re,oe,B,J),$t(ne,Y)}}_.current=Z;const O={data:Y.data,width:Y.width,height:Y.height,format:"rgba8unorm"};($=i.current)==null||$.setSource(O),h(ne=>ne&&ne.w===Y.width&&ne.h===Y.height?ne:{w:Y.width,h:Y.height}),(te=N.onNaturalSize)==null||te.call(N,Y.width,Y.height),y(ne=>ne+1),w(ne=>ne+1)}),()=>{H=!0}},[t,c,t?null:e.imageUrl,t?null:R,t?0:B,t?0:J]);const Se=t?e.exposure??0:0,de=t?e.tonemap:void 0,Te=t?e.gamma:void 0,Ee=f.useCallback(()=>{const N=i.current;if(!N||!c||!g)return;const F=r.current,re=o.current,H=re?re.getBoundingClientRect():F?F.getBoundingClientRect():{width:g.w,height:g.h},Z=mr({zoom:k,pan:S},H,g.w,g.h);x(te=>te.x===Z.x&&te.y===Z.y&&te.w===Z.w&&te.h===Z.h?te:Z),H.width>0&&H.height>0&&N.resize(Math.round(H.width*ae),Math.round(H.height*ae));const Y=gr(Z,H,g.w,g.h)>=qt?"nearest":"linear",O=Z,$=t?{exposureEV:Se+B,offset:J,operator:s.current?"extended":Ys(de),gamma:Te,isScalar:!1,hdrOut:s.current,uv:O,filter:Y}:{exposureEV:T!=="none"?0:B,offset:T!=="none"?0:J,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:O,filter:Y};try{N.render($)||a(!0)}catch(te){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",te),a(!0)}},[c,g,k,S.x,S.y,Se,B,J,de,Te,t,T,ae]);f.useEffect(()=>{Ee()},[Ee,v,p]);const Me=f.useCallback((N,F,re)=>{if(t){const K=E.current,oe=g;if(!K||!oe||N<0||F<0||N>=oe.w||F>=oe.h)return null;const Ce=K.shape.length===2?1:K.shape[2]??1,Pe=(F*oe.w+N)*Ce,me=K.data,ye=K.precision==="f16-bits"?Fe=>ht(me[Fe]??0):Fe=>me[Fe]??0,xe=.5,Be=Ce===1?[ye(Pe)]:[ye(Pe),ye(Pe+1),ye(Pe+2)];return tt(Be,"unit",re,xe)}const H=_.current;if(!H||N<0||F<0||N>=H.width||F>=H.height)return null;const Z=(F*H.width+N)*4,Y=H.data[Z],O=H.data[Z+1],$=H.data[Z+2],te=(.299*Y+.587*O+.114*$)/255;return tt(T!=="none"||Y===O&&O===$?[Y]:[Y,O,$],"uint8",re,te)},[t,g,T]),we=e.showAxes??!1,De=t?e.label??"":e.label,le=e.interpolation??"auto",pe=le==="auto"?void 0:le,q=t?void 0:e.overlay,Q=t?void 0:e.overlaySettings,V=t?!1:e.isDraggable??!1,_e=t?void 0:e.onDragStart;if(l)return t?u.jsx(nn,{...e}):u.jsx(nn,{...e});const be=q&&(Q!=null&&Q.enabled)&&g&&((((he=q.boxes)==null?void 0:he.length)??0)>0||(((ge=q.masks)==null?void 0:ge.length)??0)>0)?u.jsx(Kt,{data:q,settings:Q,naturalWidth:g.w,naturalHeight:g.h}):void 0;return u.jsx(Et,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":c},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:k,pan:S,onViewportChange:A,naturalDims:g,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:we&&g?"16px 4px 4px 28px":0,surface:u.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:pe},"data-gpu-image-canvas":!0}),showAxes:we,overlayNode:be,overlay:{displayElRef:n,sample:Me,version:M,hasSource:!0,sourceWindow:m},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Ee,leadingMenus:t?void 0:[tn(T,N=>P(N))],displayAdjust:{exposureEV:B,offset:J,onExposureChange:W,onOffsetChange:se},onReset:L,extraModified:R!==I.current,label:De,showLabelChip:!!De,isDraggable:V,onDragStart:_e})}const Mt=new Map;function Xe(e){if(Mt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Mt.set(e.id,e)}function Qe(e){return Mt.get(e)}function Zs(){return Array.from(Mt.values())}function xr(e,t){return{...e.params??{},...t??{}}}const Qs={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},js={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Js={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},ei={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},ti={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},ni={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},br=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];oi(br);const rn=[1.052156925,1,.91835767],ri=.7;function oi(e){const[t,n,r]=e[0],[o,i,s]=e[1],[l,a,c]=e[2],d=i*c-s*a,g=-(o*c-s*l),h=o*a-i*l,w=1/(t*d+n*g+r*h);return[[d*w,-(n*c-r*a)*w,(n*s-r*i)*w],[g*w,(t*c-r*l)*w,-(t*s-r*o)*w],[h*w,-(t*a-n*l)*w,(t*i-n*o)*w]]}function si(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const on=6/29;function sn(e){return e>on**3?Math.cbrt(e):e/(3*on*on)+4/29}function vr(e,t,n){const[r,o,i]=si(br,e,t,n),s=sn(r*rn[0]),l=sn(o*rn[1]),a=sn(i*rn[2]),c=116*l-16,d=500*(s-l),g=200*(l-a);return[c,.01*c*d,.01*c*g]}function ii(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function ai(){const e=vr(0,1,0),t=vr(0,0,1);return Math.pow(ii(e,t),ri)}const wr=ai(),ci=.082;function yr(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],i=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(i/(2*Math.PI**2))*e),l=1/e,a=Math.PI**2,c=[0,0,0];for(let d=-s;d<=s;d++)for(let g=-s;g<=s;g++){const h=(g*l)**2+(d*l)**2;for(let v=0;v<3;v++)c[v]+=t[v]*Math.sqrt(Math.PI/n[v])*Math.exp(-a*h/n[v])+r[v]*Math.sqrt(Math.PI/o[v])*Math.exp(-a*h/o[v])}return{r:s,deltaX:l,sums:c}}function Er(e){const t=.5*ci*e,n=Math.ceil(3*t);let r=0,o=0,i=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const a=Math.exp(-(l*l+s*s)/(2*t*t)),c=-l*a,d=(l*l/(t*t)-1)*a;c>0&&(r+=c),d>0?o+=d:i-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:i}}const li=`
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
`,ui=`
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
`,_r=`
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
`;function We(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Tt(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},i=r!=null&&r.fill?1:0;return[We(e,[o.x,o.y,i,0]),We(e+1,[n.width,n.height,0,0])]}function Pt(e){return[We(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),We(2,[e.sums[2],0,0,0])]}function Mr(e){return[We(4,[wr,e.sd,e.r,e.edgeNorm]),We(5,[e.pointPos,e.pointNeg,0,0])]}function Sr(e,t,n,r,o,i=""){const s=yr(e),l=Er(e),a=`ycxczA${i}`,c=`ycxczB${i}`,d=`labA${i}`,g=`labB${i}`,h=`flip${i}`;return{passes:[{name:a,shader:t,inputs:[n],output:a,uniforms:()=>Tt(1,"a",o)},{name:c,shader:t,inputs:[r],output:c,uniforms:()=>Tt(1,"b",o)},{name:d,shader:St,inputs:[a],output:d,uniforms:()=>Pt(s)},{name:g,shader:St,inputs:[c],output:g,uniforms:()=>Pt(s)},{name:h,shader:_r,inputs:[d,g,a,c],output:h,uniforms:()=>Mr(l)}],flipRef:h}}const fi={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Sr(t,li,"srcA","srcB",e);return{passes:n,final:r}}},di={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Sr(t,ui,"srcA","srcB",e);return{passes:n,final:r}}},Tr=`
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
`,pi=`
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
`,hi={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),i=(r-n)/Math.max(o-1,1),s=yr(t),l=Er(t),a=[];let c=null;for(let d=0;d<o;d++){const g=n+d*i,h=`_e${d}`,v=`ycxczA${h}`,w=`ycxczB${h}`,p=`labA${h}`,b=`labB${h}`,m=`acc${h}`;a.push({name:v,shader:Tr,inputs:["srcA"],output:v,uniforms:()=>[We(1,[g,0,0,0]),...Tt(2,"a",e)]},{name:w,shader:Tr,inputs:["srcB"],output:w,uniforms:()=>[We(1,[g,0,0,0]),...Tt(2,"b",e)]},{name:p,shader:St,inputs:[v],output:p,uniforms:()=>Pt(s)},{name:b,shader:St,inputs:[w],output:b,uniforms:()=>Pt(s)}),c===null?a.push({name:m,shader:_r,inputs:[p,b,v,w],output:m,uniforms:()=>Mr(l)}):a.push({name:m,shader:pi,inputs:[p,b,v,w,c],output:m,uniforms:()=>[We(5,[wr,l.sd,l.r,l.edgeNorm]),We(6,[l.pointPos,l.pointNeg,0,0])]}),c=m}return{passes:a,final:c}}},mi=.01,gi=.03,Pr=1,Ar=1.5,Cr=5,Rr=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,xi=`
${Ie}
${Rr}
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
`,bi=`
${Ie}
${Rr}
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
`,Dr=`
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
`,vi=`
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
`;function an(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function kr(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Dr,inputs:[e],output:n,uniforms:()=>[an(1,[1,0,Cr,Ar])]},{name:r,shader:Dr,inputs:[n],output:r,uniforms:()=>[an(1,[0,1,Cr,Ar])]}],out:r}}const wi={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(mi*Pr)**2,n=(gi*Pr)**2,r=kr("momA","statsA"),o=kr("momB","statsB");return{passes:[{name:"momA",shader:xi,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:bi,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:vi,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[an(2,[t,n,0,0])]}],final:"ssim"}}};let Lr=!1;function yi(){Lr||(Lr=!0,Xe(js),Xe(Qs),Xe(Js),Xe(ti),Xe(ei),Xe(ni),Xe(fi),Xe(hi),Xe(di),Xe(wi))}yi();function Ir(){const e=[];for(const n of Zs())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=Qe("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Ei(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Br=new WeakMap;function cn(e,t,n,r){let o=Br.get(e);o||(o=new Map,Br.set(e,o));const i=`${t}::${r}`;let s=o.get(i);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(i,s)),s}function _i(e){return`
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
`}const At="rgba16float";function Mi(e,t,n,r,o,i){var b,m;const s=Qe(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=i??wt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=l.result.w,c=l.result.h,d=l.fit==="fill"?1:0,g=xr(s,o);if(s.kind==="pointwise"){const x=e.createTexture(a,c,At),E=cn(e,`pw:${s.id}`,_i(s.source),At),_=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),M=new Float32Array([a,c,d,0]);let y;try{y=e.createBindGroup(E,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:_}},{binding:3,resource:{uniform:M}}]),e.renderFullscreen(x,E,y)}finally{(b=y==null?void 0:y.destroy)==null||b.call(y)}return x}const h={width:a,height:c,params:g,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},v=s.buildPasses(h),w=new Map([["srcA",t],["srcB",n]]),p=[];try{for(const E of v.passes){const _=e.createTexture(a,c,At);p.push(_),w.set(E.output,_);const M=cn(e,`mp:${s.id}:${E.name}`,E.shader,At),y=E.inputs.map((S,A)=>{const C=w.get(S);if(!C)throw new Error(`computeDiff: pass "${E.name}" input "${S}" not produced yet`);return{binding:A,resource:C}});E.uniforms&&y.push(...E.uniforms(h));let k;try{k=e.createBindGroup(M,y),e.renderFullscreen(_,M,k)}finally{(m=k==null?void 0:k.destroy)==null||m.call(k)}}const x=w.get(v.final);if(!x)throw new Error(`computeDiff: final ref "${v.final}" not produced`);for(const E of p)E!==x&&E.destroy();return x}catch(x){for(const E of p)E.destroy();throw x}}const Si=8,Ti=256*1024*1024;class Pi{constructor(t=Si,n=Ti){ce(this,"map",new Map);ce(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Or=new WeakMap;function Ur(e){let t=Or.get(e);return t||(t=new Pi,Or.set(e,t)),t}function Ai(e,t){const n=xr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Ci(e,t,n,r,o){const i=Qe(n),s=i?Ai(i,r):"",l=o?Zo(o):"";return`${e}|${t}|${n}|${s}|${l}`}function Ri(e,t,n,r,o,i,s,l){const a=Qe(r);if(!a)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const c=Ur(e),d=l??wt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),g=Ci(i,s,r,o,d),h=c.get(g);if(h)return h;const v=Mi(e,t,n,r,o,d),w=d.result.w,p=d.result.h,b={texture:v,width:w,height:p,displayRange:a.displayRange,bytes:w*p*8};return c.set(g,b),b}async function Di(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=$n(e,n,r,o).then(i=>(t.scalars=i,i))),t.scalarsPending)}async function ki(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Ur(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const Li=`
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
`,Ii={unit:0,signed:1,relative:2},Bi={linear:0,signed:1,positive:2};function Oi(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ui(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Ni(e,t,n,r,o){var v,w,p;const i=Ui(t),s=cn(e,"diff-display",Li,i),l=Oi(e,o.colormap),a=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),c=new Float32Array([Ii[r],Bi[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),g=new Float32Array([((v=o.sourceDims)==null?void 0:v.w)??0,((w=o.sourceDims)==null?void 0:w.h)??0,0,0]);let h;try{h=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:a}},{binding:3,resource:{uniform:c}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:g}}]),e.renderFullscreen(t,s,h)}finally{(p=h==null?void 0:h.destroy)==null||p.call(h),l.destroy()}}const Nr=.6*.6*2.51,Fi=.6*.03,Gi=0,Fr=.6*.6*2.43,zi=.6*.59,Vi=.14;function Gr(e){const t=(Fi-zi*e)/(Nr-Fr*e),n=(Gi-Vi*e)/(Nr-Fr*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const $i=.85,Xi=.85,zr=11920928955078125e-23,ln=[.2126,.7152,.0722];function Wi(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Hi(e,t,n,r=3,o={}){const i=t*n,s=Gr($i),l=Gr(Xi),a=new Float64Array(i);let c=0;for(let x=0;x<i;x++){const[E,_,M]=Wi(e,x,r),y=E*ln[0]+_*ln[1]+M*ln[2];a[x]=y,y>c&&(c=y)}const d=Float64Array.from(a).sort(),g=i>>1,h=i%2===1?d[g]:d[g-1],v=Math.max(h,zr),w=Math.max(c,zr),p=o.startExposure??Math.log2(s/w),b=o.stopExposure??Math.log2(l/v),m=Math.max(2,Math.ceil(b-p));return{startExposure:p,stopExposure:b,numExposures:m}}const Yi={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ki({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:i,zoom:s,pan:l,onViewportChange:a,processing:c=Yi,interpolation:d="auto",label:g="",isDraggable:h=!1,onDragStart:v,overlay:w,overlaySettings:p,pixelValueNotation:b="decimal"}){var le,pe;const m=f.useRef(null),[x,E]=f.useState(null),[_,M]=f.useState(null),[y,k]=f.useState(b),[S,A]=f.useState(!1),C=f.useRef(null),R=f.useRef(null),P=f.useRef(null),T=f.useRef(null),[I,L]=f.useState(0);f.useEffect(()=>{if(!e){P.current=null,L(Q=>Q+1);return}let q=!1;return Je(e).then(Q=>{q||(P.current=Q,L(V=>V+1))}),()=>{q=!0}},[e]),f.useEffect(()=>{if(!t){T.current=null,L(Q=>Q+1);return}let q=!1;return Je(t).then(Q=>{q||(T.current=Q,L(V=>V+1))}),()=>{q=!0}},[t]);const B=q=>(Q,V,_e)=>{const be=q.current;if(!be||Q<0||V<0||Q>=be.width||V>=be.height)return null;const he=(V*be.width+Q)*4,ge=be.data[he],N=be.data[he+1],F=be.data[he+2],re=(.299*ge+.587*N+.114*F)/255;return ge===N&&N===F?{lines:[rt(ge,"uint8",_e)],luminance:re}:{lines:[rt(ge,"uint8",_e),rt(N,"uint8",_e),rt(F,"uint8",_e)],luminance:re,colors:[xt[0],xt[1],xt[2]]}},W=f.useMemo(()=>B(P),[]),J=f.useMemo(()=>B(T),[]),se=!!w&&!!(p!=null&&p.enabled)&&!!x&&!!e&&((((le=w.boxes)==null?void 0:le.length)??0)>0||(((pe=w.masks)==null?void 0:pe.length)??0)>0),{gammaFilterId:ae,filterStr:Se,gamma:de,offset:Te}=Zn(c),Ee=`translate(${l.x}px, ${l.y}px) scale(${s})`,Me=d==="auto"?void 0:d,{containerProps:we,modifierActive:De}=Ln({containerRef:m,zoom:s,pan:l,onViewportChange:a});return u.jsxs("div",{className:"relative flex flex-col h-full",children:[u.jsx(Qn,{id:ae,gamma:de,offset:Te}),u.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...we.style},onPointerDown:we.onPointerDown,onPointerMove:we.onPointerMove,onPointerUp:we.onPointerUp,onPointerCancel:we.onPointerCancel,children:[u.jsxs("div",{className:"relative w-full h-full",children:[u.jsxs("div",{className:"relative w-full h-full",style:{transform:Ee,transformOrigin:"0 0"},children:[u.jsx("img",{ref:C,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Se,imageRendering:Me,...n==="blend"?{opacity:o}:{}},onLoad:q=>{const Q=q.currentTarget;E({w:Q.naturalWidth,h:Q.naturalHeight})}}),se&&u.jsx(Kt,{data:w,settings:p,naturalWidth:x.w,naturalHeight:x.h})]}),u.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:u.jsx("div",{className:"w-full h-full",style:{transform:Ee,transformOrigin:"0 0"},children:u.jsx("img",{ref:R,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Se,imageRendering:Me,...n==="blend"?{opacity:1-o}:{}},onLoad:q=>{const Q=q.currentTarget;M({w:Q.naturalWidth,h:Q.naturalHeight})}})})}),n==="split"&&u.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>i==null?void 0:i(.5),onPointerDown:q=>{q.stopPropagation(),q.preventDefault();const Q=q.currentTarget;try{Q.setPointerCapture(q.pointerId)}catch{}const _e=Q.parentElement.getBoundingClientRect(),be=ge=>{i==null||i(Math.max(0,Math.min(1,(ge.clientX-_e.left)/_e.width)))},he=()=>{window.removeEventListener("pointermove",be),window.removeEventListener("pointerup",he)};window.addEventListener("pointermove",be),window.addEventListener("pointerup",he)},children:u.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?u.jsxs(u.Fragment,{children:[t&&_&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:u.jsx(nt,{imageElRef:R,naturalWidth:_.w,naturalHeight:_.h,zoom:s,pan:l,sample:J,notation:y,version:I})}),e&&x&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:u.jsx(nt,{imageElRef:C,naturalWidth:x.w,naturalHeight:x.h,zoom:s,pan:l,sample:W,notation:y,version:I,onActiveChange:A})})]}):e&&x&&u.jsx(nt,{imageElRef:C,naturalWidth:x.w,naturalHeight:x.h,zoom:s,pan:l,sample:W,notation:y,version:I,onActiveChange:A}),S&&u.jsx(Bn,{notation:y,onChange:k})]}),n==="split"&&u.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),u.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!De?" cairn-drag-grip":""}`,draggable:h&&!De,onDragStart:v,style:{cursor:h&&!De?"grab":void 0},children:[u.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),g]})]})}function qi(){return u.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Zi({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:i,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:c=>{c==="side"?s==null||s():c==="slide"?r():c==="blend"?o():i(c)}}}}function Qi(e){const t=Ot(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function ji(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const a=e.data,c=new Uint16Array(o*4);for(let d=0;d<o;d++){const g=d*r,h=d*4;if(r===1){const v=a[g];c[h]=v,c[h+1]=v,c[h+2]=v,c[h+3]=pt}else c[h]=a[g],c[h+1]=a[g+1],c[h+2]=a[g+2],c[h+3]=r>=4?a[g+3]:pt}return{data:c,format:"rgba16float"}}const i=e.data,s=new Float32Array(o*4),l=a=>Number.isFinite(a)?a:0;for(let a=0;a<o;a++){const c=a*r;let d,g,h,v=1;r===1?d=g=h=l(i[c]):r===3?(d=l(i[c]),g=l(i[c+1]),h=l(i[c+2])):(d=l(i[c]),g=l(i[c+1]),h=l(i[c+2]),v=l(i[c+3]));const w=a*4;s[w]=d,s[w+1]=g,s[w+2]=h,s[w+3]=v}return{data:s,format:"rgba32float"}}function Ji({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,diffSubmode:a,colormap:c="none",align:d="top-left",fit:g="crop",diffKernel:h,onDiffKernelChange:v,onCompareModeChange:w,onRequestSide:p,zoom:b,pan:m,onViewportChange:x,interpolation:E="auto",label:_="",pixelValueNotation:M="decimal"}){var Wr;const y=f.useRef(null),k=f.useRef(null),S=f.useRef(null),A=f.useRef(null),C=f.useRef(null),[R,P]=f.useState(!1),[T,I]=f.useState(!1),[L,B]=f.useState(null),[W,J]=f.useState(null),[se,ae]=f.useState(0),[Se,de]=f.useState(0),[Te,Ee]=f.useState(null),[Me,we]=f.useState({x:0,y:0,w:1,h:1}),De=h??a??"absolute",[le,pe,q]=gt(De);f.useEffect(()=>{pe(h??a??"absolute")},[h,a,pe]);const Q=f.useCallback(D=>{pe(D),v==null||v(D)},[v,pe]);f.useEffect(()=>{const D=y.current;if(D)return D.__cairnDiffKernel={current:le,set:Q},()=>{D&&delete D.__cairnDiffKernel}},[le,Q]);const[V,_e,be]=gt(o);f.useEffect(()=>{_e(o)},[o,_e]);const he=f.useCallback(D=>{_e(D),w==null||w(D)},[w,_e]),[ge,N,F]=gt(c);f.useEffect(()=>{N(c)},[c,N]);const re=f.useCallback(()=>{he(be.default),N(F.default),Q(q.default)},[he,N,Q,be.default,F.default,q.default]),H=be.isModified||F.isModified||q.isModified,[Z,Y]=f.useState(0),[O,$]=f.useState(0),te=f.useMemo(()=>{const G=[Zi({mode:V,kernel:le,kernelOptions:Ir().map(z=>({id:z.id,label:z.label})),onSide:p,onSlide:()=>he("split"),onBlend:()=>he("blend"),onKernel:z=>{he("diff"),Q(z)}})];return V==="diff"&&G.push(tn(ge,z=>N(z))),G},[V,le,ge,Q,he,p]),ne=f.useRef(null),K=f.useRef(null),oe=f.useRef(null),Ce=f.useRef(null),[Pe,me]=f.useState(0),ye=f.useRef(null),xe=f.useRef(null),[Be,Fe]=f.useState(0),Ye=Yt();f.useEffect(()=>{const D=S.current;if(!D)return;let G=!1;return ut().then(z=>{if(!G)try{if(Wn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const U=z.createSurface(D,{hdr:!1});A.current={device:z,surface:U,texA:null,texB:null},I(!0)}catch(U){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",U),P(!0)}}).catch(z=>{G||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",z),P(!0))}),()=>{var U,j;G=!0;const z=A.current;z&&((U=z.texA)==null||U.destroy(),(j=z.texB)==null||j.destroy(),A.current=null)}},[]),f.useEffect(()=>{const D=y.current;if(!D)return;const G=new ResizeObserver(()=>de(z=>z+1));return G.observe(D),()=>G.disconnect()},[]),f.useEffect(()=>{if(!T)return;let D=!1;if(!A.current)return;async function z(U,j){if(j){const ue=ji(j);return{width:j.width,height:j.height,imageData:null,make:ve=>{const ie=ve.createTexture(j.width,j.height,ue.format);return ie.write(ue.data),ie}}}if(!U)return null;const ee=await Je(U);return ee?{width:ee.width,height:ee.height,imageData:ee,make:ue=>{const ve=ue.createTexture(ee.width,ee.height,"rgba8unorm");return ve.write(ee.data),ve}}:null}return Promise.all([z(e,n),z(t,r)]).then(([U,j])=>{var ke,Ge;if(D||!A.current)return;const ee=A.current;ne.current=(U==null?void 0:U.imageData)??null,K.current=(j==null?void 0:j.imageData)??null,oe.current=n??null,Ce.current=r??null,(ke=ee.texA)==null||ke.destroy(),(Ge=ee.texB)==null||Ge.destroy(),ee.texA=null,ee.texB=null;const ue=U??j;if(!ue){B(null),J(null),me(Ne=>Ne+1);return}const ve=j??ue,ie=U??ue;ee.texA=ve.make(ee.device),ee.texB=ie.make(ee.device),J({a:{w:ve.width,h:ve.height},b:{w:ie.width,h:ie.height}}),B({w:ue.width,h:ue.height}),me(Ne=>Ne+1),ae(Ne=>Ne+1)}),()=>{D=!0}},[T,e,t,n,r]);const Oe=n!=null||r!=null,Ue=f.useMemo(()=>Ei(le,Oe),[le,Oe]),ct=f.useMemo(()=>{if(!Oe)return null;const D=r??n;if(!D)return null;const G=D.precision==="f16-bits"?Tn(D.data):D.data;return Hi(G,D.width,D.height,D.channels)},[Oe,r,n]),Vr=f.useMemo(()=>{var D;return ho(((D=Qe(Ue))==null?void 0:D.displayRange)??"unit",ge==="none"?null:ge)},[Ue,ge]),$r=f.useMemo(()=>ge!=="none"?Qi(ge):void 0,[ge]),je=f.useMemo(()=>W?wt(W.a,W.b,d,g,"b"):null,[W,d,g]),Le=f.useMemo(()=>L?V==="diff"&&je?je.result:L:null,[V,je,L]),un=f.useCallback(()=>{const D=A.current;if(!T||!D||!D.surface||!D.texA||!D.texB||!L)return;const G=Le??L,z=y.current,U=z?z.getBoundingClientRect():{width:G.w,height:G.h},j=mr({zoom:b,pan:m},U,G.w,G.h);we(ie=>ie.x===j.x&&ie.y===j.y&&ie.w===j.w&&ie.h===j.h?ie:j);const ee=S.current;if(U.width>0&&U.height>0&&ee&&D.surface){const ie=Math.max(1,Math.round(U.width*Ye)),ke=Math.max(1,Math.round(U.height*Ye));(ee.width!==ie||ee.height!==ke)&&(ee.width=ie,ee.height=ke,D.surface.configure(ie,ke))}const ue=gr(j,U,G.w,G.h)>=qt?"nearest":"linear",ve=j;try{if(V==="diff"){const ie=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",ke=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ge=Qe(Ue)?Ue:"absolute",Ne=Ge==="hdr-flip"&&ct?{ppd:67,startExposure:ct.startExposure,stopExposure:ct.stopExposure,numExposures:ct.numExposures}:void 0,it=Ri(D.device,D.texA,D.texB,Ge,Ne,ie,ke,je??void 0);C.current=it,Ni(D.device,D.surface,it.texture,it.displayRange,{uv:ve,cmapMode:Vr,colormap:$r,filter:ue,exposureEV:Z,offset:O})}else{const ie={exposureEV:Z,offset:O,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ve,filter:ue,mode:V,split:i,alpha:s};es(D.device,D.surface,D.texA,D.texB,ie)}}catch(ie){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ie),P(!0)}},[T,L,Le,je,b,m.x,m.y,V,i,s,Z,O,le,Ue,ct,Vr,$r,e,t,n,r,Ye]);f.useEffect(()=>{un()},[un,se,Se]);const Ct=t!=null||r!=null;f.useEffect(()=>{const D=A.current;if(!T||!D||!D.texA||!D.texB||!Ct){Ee(null);return}let G=!1;const z=D.texA,U=D.texB,j=C.current,ee=V==="diff"?je??void 0:void 0;return(V==="diff"&&j?Di(D.device,j,z,U,ee):$n(D.device,z,U,ee)).then(ve=>{G||Ee(ve)}),()=>{G=!0}},[T,se,Ct,V,le,je]),f.useEffect(()=>{if(V!=="diff"){ye.current=null,xe.current=null;return}const D=A.current,G=C.current;if(!T||!D||!G)return;let z=!1;return ye.current=null,xe.current=null,Fe(U=>U+1),ki(D.device,G).then(U=>{z||(ye.current=U,xe.current={w:G.width,h:G.height},Fe(j=>j+1))}).catch(()=>{}),()=>{z=!0}},[T,V,Ue,se,je]);const Xr=(D,G)=>(z,U,j)=>{const ee=G.current;if(ee){const{data:it,width:Hr,height:oa,channels:Yr}=ee;if(z<0||U<0||z>=Hr||U>=oa)return null;const Dt=(U*Hr+z)*Yr,kt=ee.precision==="f16-bits"?pn=>ht(it[pn]??0):pn=>it[pn]??0,sa=.5,ia=Yr===1?[kt(Dt)]:[kt(Dt),kt(Dt+1),kt(Dt+2)];return tt(ia,"unit",j,sa)}const ue=D.current;if(!ue||z<0||U<0||z>=ue.width||U>=ue.height)return null;const ve=(U*ue.width+z)*4,ie=ue.data[ve],ke=ue.data[ve+1],Ge=ue.data[ve+2],Ne=(.299*ie+.587*ke+.114*Ge)/255;return tt(ie===ke&&ke===Ge?[ie]:[ie,ke,Ge],"uint8",j,Ne)},Rt=f.useMemo(()=>Xr(ne,oe),[]),fn=f.useMemo(()=>Xr(K,Ce),[]),dn=f.useMemo(()=>(D,G,z)=>{var Ne;const U=ye.current,j=xe.current;if(!U||!j)return null;const{w:ee,h:ue}=j;if(D<0||G<0||D>=ee||G>=ue)return null;const ve=(G*ee+D)*4,ie=((Ne=Qe(Ue))==null?void 0:Ne.output)??"per-channel",ke=.5,Ge=ie==="scalar"?[U[ve]??0]:[U[ve]??0,U[ve+1]??0,U[ve+2]??0];return tt(Ge,"unit",z,ke)},[Ue]);f.useEffect(()=>{const D=y.current;if(D)return D.__cairnCompareProbe={sampleDiff:(G,z,U="decimal")=>dn(G,z,U),sampleFg:(G,z,U="decimal")=>Rt(G,z,U),sampleRef:(G,z,U="decimal")=>fn(G,z,U),get diffSamples(){return ye.current},get dims(){return Le},get primaryDims(){return L},get diffResultDims(){return xe.current},get align(){return d},get fit(){return g},get resolvedKernelId(){return Ue},get compareMode(){return V}},()=>{D&&delete D.__cairnCompareProbe}},[dn,Rt,fn,L,Le,d,g,Ue,V]);const na=E==="auto"?void 0:E;if(R)return n!=null||r!=null?u.jsx(qi,{}):V==="diff"?u.jsx(nn,{imageUrl:e,baselineUrl:t,diffMode:((Wr=Qe(Ue))==null?void 0:Wr.kind)==="pointwise"?Ue:"absolute",interpolation:E,colormap:ge,showAxes:!1,zoom:b,pan:m,onViewportChange:x,label:_,pixelValueNotation:M}):u.jsx(Ki,{imageUrl:e,baselineUrl:t,mode:V,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,zoom:b,pan:m,onViewportChange:x,interpolation:E,label:_,pixelValueNotation:M});const ra=u.jsxs(u.Fragment,{children:[u.jsx("canvas",{ref:S,className:"w-full h-full block",style:{imageRendering:na},"data-gpu-compare-canvas":!0}),V==="split"&&u.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${i*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:D=>{D.stopPropagation(),l==null||l(.5)},onPointerDown:D=>{D.stopPropagation(),D.preventDefault();const G=D.currentTarget;try{G.setPointerCapture(D.pointerId)}catch{}const U=G.parentElement.getBoundingClientRect(),j=ue=>{l==null||l(Math.max(0,Math.min(1,(ue.clientX-U.left)/U.width)))},ee=()=>{window.removeEventListener("pointermove",j),window.removeEventListener("pointerup",ee)};window.addEventListener("pointermove",j),window.addEventListener("pointerup",ee)},children:u.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return u.jsx(Et,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":T},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:y,wrapperRef:k,zoom:b,pan:m,onViewportChange:x,naturalDims:Le,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:ra,showAxes:!1,notationSeed:M,onReset:re,extraModified:H,exportCanvasRef:S,requestRender:un,leadingMenus:te,displayAdjust:{exposureEV:Z,offset:O,onExposureChange:Y,onOffsetChange:$},label:"",showLabelChip:!1,overlay:{render:({notation:D,setOverlayActive:G})=>V==="split"?u.jsxs(u.Fragment,{children:[Ct&&Le&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-i)*100}% 0 0)`},children:u.jsx(nt,{imageElRef:S,naturalWidth:Le.w,naturalHeight:Le.h,zoom:b,pan:m,sourceWindow:Me,sample:fn,notation:D,version:Pe})}),Ct&&Le&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${i*100}%)`},children:u.jsx(nt,{imageElRef:S,naturalWidth:Le.w,naturalHeight:Le.h,zoom:b,pan:m,sourceWindow:Me,sample:Rt,notation:D,version:Pe,onActiveChange:G})})]}):Le&&u.jsx(nt,{imageElRef:S,naturalWidth:Le.w,naturalHeight:Le.h,zoom:b,pan:m,sourceWindow:Me,sample:V==="diff"?dn:Rt,notation:D,version:V==="diff"?Be:Pe,onActiveChange:G})},extraChips:u.jsxs(u.Fragment,{children:[V==="split"&&u.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),_?u.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:_}):null,Te&&u.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${_?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",Te.mse.toExponential(2)," · PSNR ",Number.isFinite(Te.psnr)?Te.psnr.toFixed(1):"∞"," dB · MAE"," ",Te.mae.toExponential(2)]})]})})}const ea="cairn-plot:gpu-image-ready";async function ta(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await ut(),window.__cairnPlotGpuImagePane=qs,window.__cairnPlotGpuComparePane=Ji,window.__cairnPlotDiffMenuModes=Ir(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(ea))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),hr("no-webgpu")}}}ta()})(__cairnPlotJsxRuntime,__cairnPlotReact);
