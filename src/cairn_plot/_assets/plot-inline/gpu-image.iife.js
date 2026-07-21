var Sa=Object.defineProperty;var Pa=(i,u,ze)=>u in i?Sa(i,u,{enumerable:!0,configurable:!0,writable:!0,value:ze}):i[u]=ze;var ue=(i,u,ze)=>Pa(i,typeof u!="symbol"?u+"":u,ze);(function(i,u){"use strict";const ze=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function jt(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:ze}),{hdr:!1,format:n}}function Tr(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:ze}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:ze}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return jt(e,t)}}}const Sr=`
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
`;function _t(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Jt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Pr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Cr={texture:0,sampler:1,uniform:2};function Mt(e,t){return e*3+Cr[t]}const Ar={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Rr(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const l=Ar[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class en{constructor(t,n,r,o){ue(this,"width");ue(this,"height");ue(this,"format");ue(this,"gpuTexture");ue(this,"device");ue(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:_t(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Jt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class tn{constructor(t){ue(this,"_s");ue(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class kr{constructor(t,n,r,o,a){ue(this,"_p");ue(this,"gpuPipeline");ue(this,"bindings");ue(this,"bindGroupLayout");ue(this,"variants");ue(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Dr(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Lr{constructor(t){ue(this,"_c");ue(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Ir{constructor(t,n){ue(this,"_b");ue(this,"gpuBindGroup");ue(this,"ownedBuffers");ue(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Or{constructor(t,n,r,o){ue(this,"canvas");ue(this,"hdr");ue(this,"format");ue(this,"context");ue(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function rt(e){return"canvas"in e}async function Br(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(f){return rt(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function s(f){if(rt(f))return{width:f.canvas.width,height:f.canvas.height};const b=f;return{width:b.width,height:b.height}}let l=!1,c=null;function d(){var b,g;if(c!==null)return c;let f=!1;try{if(typeof document<"u"){const x=document.createElement("canvas");x.width=1,x.height=1;const E=x.getContext("webgpu");if(E)try{E.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const _=(b=E.getConfiguration)==null?void 0:b.call(E);f=((g=_==null?void 0:_.toneMapping)==null?void 0:g.mode)==="extended"}catch{f=!1}finally{try{E.unconfigure()}catch{}}}}catch{f=!1}return c=f,f}const p=256;let m=null,h=null;function v(){if(!m||!h){const f=t.createShaderModule({code:Sr});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const b=t.createPipelineLayout({bindGroupLayouts:[h]});m=t.createComputePipeline({layout:b,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:m,layout:h}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(f,b,g){return new en(t,f,b,g)},createSampler(f){const b=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",g=t.createSampler({magFilter:b,minFilter:b,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new tn(g)},createRenderPipeline(f){const b=t.createShaderModule({code:f.shaderWGSL}),g=Rr(f.shaderWGSL),x=_t(f.targetFormat),E=Dr(t,g),_=t.createPipelineLayout({bindGroupLayouts:[E]}),T=S=>t.createRenderPipeline({layout:_,vertex:{module:b,entryPoint:"vs_main"},fragment:{module:b,entryPoint:"fs_main",targets:[{format:S}]},primitive:{topology:"triangle-list"}}),y=T(x);return new kr(y,g,E,x,T)},createComputePipeline(f){const b=t.createShaderModule({code:f.shaderWGSL}),g=t.createComputePipeline({layout:"auto",compute:{module:b,entryPoint:"cs_main"}});return new Lr(g)},createBindGroup(f,b){const g=f,x=new Map,E=[];for(const[T,y]of g.bindings)if(y.kind==="uniform"){const S=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});E.push(S),x.set(T,{binding:T,resource:{buffer:S}})}else y.kind==="sampler"&&x.set(T,{binding:T,resource:o()});for(const T of b){const y=T.resource;if(y instanceof en){const S=Mt(T.binding,"texture");g.bindings.has(S)&&x.set(S,{binding:S,resource:y.gpuTexture.createView()})}else if(y instanceof tn){const S=Mt(T.binding,"sampler");g.bindings.has(S)&&x.set(S,{binding:S,resource:y.gpuSampler})}else{const S=Mt(T.binding,"uniform"),O=g.bindings.get(S);if(O&&O.kind==="uniform"){const L=y.uniform,B=t.createBuffer({size:Math.max(O.sizeBytes,L.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,L.buffer,L.byteOffset,L.byteLength),E.push(B),x.set(S,{binding:S,resource:{buffer:B}})}}}const _=t.createBindGroup({layout:g.bindGroupLayout,entries:Array.from(x.values())});return new Ir(_,E)},createSurface(f,b){const g=f.getContext("webgpu");if(!g)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const x=b.hdr&&n.hdr,E=()=>x?Tr(g,t):jt(g,t),_=E();return new Or(f,g,_,E)},renderFullscreen(f,b,g){const x=b,E=g,_=a(f),{width:T,height:y}=s(f),S=rt(f)?f.format:_t(f.format),O=x.pipelineFor(S),L=t.createCommandEncoder(),B=L.beginRenderPass({colorAttachments:[{view:_,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});B.setPipeline(O),B.setBindGroup(0,E.gpuBindGroup),B.setViewport(0,0,T,y,0,1),B.draw(3),B.end(),t.queue.submit([L.finish()])},async readback(f){const b=rt(f),{width:g,height:x}=s(f),E=b?f.hdr?"rgba16float":"rgba8unorm":f.format,_=b&&f.format==="bgra8unorm",T=b?f.getCurrentGPUTexture():f.gpuTexture,y=Jt(E),S=g*y,O=256,L=Math.ceil(S/O)*O,B=L*x,R=t.createBuffer({size:B,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),C=t.createCommandEncoder();C.copyTextureToBuffer({texture:T},{buffer:R,bytesPerRow:L,rowsPerImage:x},{width:g,height:x,depthOrArrayLayers:1}),t.queue.submit([C.finish()]),await R.mapAsync(GPUMapMode.READ);const M=new Uint8Array(R.getMappedRange()),A=new Uint8Array(S*x);for(let k=0;k<x;k++){const I=k*L,ne=k*S;A.set(M.subarray(I,I+S),ne)}if(R.unmap(),R.destroy(),E==="rgba8unorm"){if(_)for(let k=0;k<A.length;k+=4){const I=A[k],ne=A[k+2];A[k]=ne,A[k+2]=I}return A}if(E==="rgba16float"){const k=new Uint16Array(A.buffer,A.byteOffset,A.byteLength/2),I=new Float32Array(k.length);for(let ne=0;ne<k.length;ne++)I[ne]=Pr(k[ne]);return I}return new Float32Array(A.buffer,A.byteOffset,A.byteLength/4)},async reduceDiffSumSquaredAbs(f,b,g,x){const E=f,_=b,T=Math.max(0,g*x),y=Math.max(1,Math.ceil(T/p)),{pipeline:S,layout:O}=v(),L=y*2*4,B=t.createBuffer({size:L,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),R=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(R,0,new Uint32Array([Math.max(1,g),Math.max(1,x),T,0]));const C=t.createBindGroup({layout:O,entries:[{binding:0,resource:E.gpuTexture.createView()},{binding:1,resource:_.gpuTexture.createView()},{binding:2,resource:{buffer:B}},{binding:3,resource:{buffer:R}}]}),M=t.createBuffer({size:L,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),A=t.createCommandEncoder(),k=A.beginComputePass();k.setPipeline(S),k.setBindGroup(0,C),k.dispatchWorkgroups(y),k.end(),A.copyBufferToBuffer(B,0,M,0,L),t.queue.submit([A.finish()]),await M.mapAsync(GPUMapMode.READ);const ne=new Float32Array(M.getMappedRange()).slice();M.unmap(),M.destroy(),B.destroy(),R.destroy();let te=0,se=0;for(let de=0;de<y;de++)te+=ne[de*2],se+=ne[de*2+1];return{sumSq:te,sumAbs:se}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let Tt=null;async function Nr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Br()}function ot(){return Tt||(Tt=Nr()),Tt}function Ur(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Fr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),l=o-a,[c,d,p]=Ur(e[a],e[s],l);t[n*3]=Math.round(c),t[n*3+1]=Math.round(d),t[n*3+2]=Math.round(p)}return t}const nn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Gr=new Set(["red-green","red-blue"]),rn=new Map;function St(e){let t=rn.get(e);if(!t){const n=nn[e]??nn.viridis;t=Fr(n),rn.set(e,t)}return t}const Be=e=>e<0?0:e>1?1:e,Pt=e=>{const t=e<0?0:e;return t/(1+t)},Ct=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Be(n/r)},on={linear:([e,t,n])=>[Be(e),Be(t),Be(n)],srgb:([e,t,n])=>[Be(e),Be(t),Be(n)],reinhard:([e,t,n])=>[Pt(e),Pt(t),Pt(n)],aces:([e,t,n])=>[Ct(e),Ct(t),Ct(n)],extended:([e,t,n])=>[e,t,n]},Vr="srgb";function zr(e){return e&&on[e]||on[Vr]}function st(e,t,n){return e*2**t+n}function $r(e){const t=Be(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function At(e,t){return typeof t=="number"&&t>0?Be(Math.pow(Be(e),1/t)):$r(e)}function Rt(e,t,n="linear",r=0,o=0){const a=St(t),s=new ImageData(e.width,e.height),l=e.data,c=s.data,d=r!==0||o!==0;for(let p=0;p<l.length;p+=4){let m=(l[p]+l[p+1]+l[p+2])/3;d&&(m=Math.max(0,Math.min(255,st(m/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+m/255*127):h=Math.round(m),h=Math.max(0,Math.min(255,h)),c[p]=a[h*3],c[p+1]=a[h*3+1],c[p+2]=a[h*3+2],c[p+3]=l[p+3]}return s}function Xr(e,t){return e==="signed"||e==="relative"?"signed":kt(t)}function kt(e){return Gr.has(e??"")?"positive":"linear"}function sn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const an=sn(50);function Dt(e){return an.get(e)}function Lt(e,t){an.set(e,t)}const cn=sn(100);function Wr(e){return cn.get(e)}function Hr(e,t){cn.set(e,t)}function Yr(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const c=(s*e.width+l)*4,d=(s*t.width+l)*4,p=(s*r+l)*4;for(let m=0;m<3;m++){const h=e.data[c+m],v=t.data[d+m],w=h-v,f=Math.abs(w),b=Math.max(h,1);let g;switch(n){case"signed":g=(w+255)/2;break;case"absolute":g=f;break;case"squared":g=w*w/255;break;case"relative_signed":g=(w/b+1)*127.5;break;case"relative_absolute":g=f/b*255;break;case"relative_squared":g=w*w/(b*b)*255;break}a.data[p+m]=Math.min(255,Math.max(0,Math.round(g)))}a.data[p+3]=255}return a}async function Ke(e){const t=Wr(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Hr(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Kr={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},qr={linear:0,signed:1,positive:2},Zr=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Qr=`#version 300 es
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
}`;let qe=null,$=null,Ae=null,at=null;function jr(){if($)return $;try{if(typeof OffscreenCanvas<"u"?qe=new OffscreenCanvas(1,1):qe=document.createElement("canvas"),$=qe.getContext("webgl2",{preserveDrawingBuffer:!0}),!$)return console.warn("[cairn] WebGL 2 not available"),null;const e=$.createShader($.VERTEX_SHADER);if($.shaderSource(e,Zr),$.compileShader(e),!$.getShaderParameter(e,$.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",$.getShaderInfoLog(e)),null;const t=$.createShader($.FRAGMENT_SHADER);if($.shaderSource(t,Qr),$.compileShader(t),!$.getShaderParameter(t,$.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",$.getShaderInfoLog(t)),null;if(Ae=$.createProgram(),$.attachShader(Ae,e),$.attachShader(Ae,t),$.linkProgram(Ae),!$.getProgramParameter(Ae,$.LINK_STATUS))return console.error("[cairn] WebGL program link:",$.getProgramInfoLog(Ae)),null;at=$.createVertexArray(),$.bindVertexArray(at);const n=$.createBuffer();$.bindBuffer($.ARRAY_BUFFER,n),$.bufferData($.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),$.STATIC_DRAW);const r=$.getAttribLocation(Ae,"a_pos");return $.enableVertexAttribArray(r),$.vertexAttribPointer(r,2,$.FLOAT,!1,0,0),$.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),$}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function ln(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Jr(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function eo(e,t,n,r){const o=jr();if(!o||!Ae||!at||!qe)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);qe.width=a,qe.height=s,o.viewport(0,0,a,s);const l=ln(o,e,0),c=ln(o,t,1);let d=null;n.colormap?d=Jr(o,n.colormap,2):(d=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,d),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ae),o.uniform1i(o.getUniformLocation(Ae,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ae,"u_other"),1),o.uniform1i(o.getUniformLocation(Ae,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ae,"u_diff_mode"),Kr[n.diffMode]),o.uniform1i(o.getUniformLocation(Ae,"u_cmap_mode"),qr[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ae,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(at),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(qe,0,0,a,s,0,-s,a,s),p.restore()),o.deleteTexture(l),o.deleteTexture(c),o.deleteTexture(d),{width:a,height:s}}const to="cairn:render-mode";function no(){try{const e=localStorage.getItem(to);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Ne=new Uint32Array(512),Ue=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ne[e]=0,Ne[e|256]=32768,Ue[e]=24,Ue[e|256]=24):t<-14?(Ne[e]=1024>>-t-14,Ne[e|256]=1024>>-t-14|32768,Ue[e]=-t-1,Ue[e|256]=-t-1):t<=15?(Ne[e]=t+15<<10,Ne[e|256]=t+15<<10|32768,Ue[e]=13,Ue[e|256]=13):t<128?(Ne[e]=31744,Ne[e|256]=64512,Ue[e]=24,Ue[e|256]=24):(Ne[e]=31744,Ne[e|256]=64512,Ue[e]=13,Ue[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var tt=Uint8Array,un=Uint16Array,ro=Int32Array,oo=new tt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),so=new tt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),dn=function(e,t){for(var n=new un(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new ro(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},fn=dn(oo,2),ao=fn.b,io=fn.r;ao[28]=258,io[258]=28,dn(so,0);for(var co=new un(32768),pe=0;pe<32768;++pe){var $e=(pe&43690)>>1|(pe&21845)<<1;$e=($e&52428)>>2|($e&13107)<<2,$e=($e&61680)>>4|($e&3855)<<4,co[pe]=(($e&65280)>>8|($e&255)<<8)>>1}for(var it=new tt(288),pe=0;pe<144;++pe)it[pe]=8;for(var pe=144;pe<256;++pe)it[pe]=9;for(var pe=256;pe<280;++pe)it[pe]=7;for(var pe=280;pe<288;++pe)it[pe]=8;for(var lo=new tt(32),pe=0;pe<32;++pe)lo[pe]=5;var uo=new tt(0),fo=typeof TextDecoder<"u"&&new TextDecoder,po=0;try{fo.decode(uo,{stream:!0}),po=1}catch{}const ct=15360;function lt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const pn=globalThis.Float16Array;function hn(e,t=e.length){if(pn){const r=new pn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=lt(e[r]);return n}const gn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function It(e){const t=gn.length;return gn[(e%t+t)%t]}function ho(e){const n=u.useRef(null),[r,o]=u.useState({w:0,h:0}),a=u.useRef(null),s=u.useRef(null),l=u.useRef(null),c=u.useCallback((d,p)=>{o(m=>m.w===d&&m.h===p?m:{w:d,h:p})},[]);return u.useLayoutEffect(()=>{const d=n.current;if(!d||d===l.current)return;const p=d.getBoundingClientRect();(p.width>0||p.height>0)&&(l.current=d,c(p.width,p.height))}),u.useEffect(()=>{var m;const d=n.current;if(d===s.current||((m=a.current)==null||m.disconnect(),a.current=null,s.current=d,!d))return;const p=new ResizeObserver(h=>{for(const v of h)c(v.contentRect.width,v.contentRect.height)});a.current=p,p.observe(d)}),u.useEffect(()=>()=>{var d;return(d=a.current)==null?void 0:d.disconnect()},[]),{ref:n,size:r}}function go(){const[e,t]=u.useState(!1);return u.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const mo=.25,Ot=64;function mn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Ot;const o=Math.min(n/e,r/t);return o<=0?Ot:Math.max(Math.max(n,r)/o,8)}function xn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=mo,maxZoom:s=Ot,naturalWidth:l,naturalHeight:c}=e,d=go(),p=u.useRef(d);p.current=d;const m=u.useRef({zoom:n,pan:r});m.current={zoom:n,pan:r};const h=u.useRef(o);h.current=o,u.useEffect(()=>{const x=t.current;if(!x||!o)return;const E=_=>{var A;if(!p.current)return;_.preventDefault(),_.stopPropagation();const T=_.deltaY<0?1.1:1/1.1,y=m.current,S=x.getBoundingClientRect(),O=l&&c?mn(l,c,S.width,S.height):s,L=Math.max(a,Math.min(O,y.zoom*T));if(y.zoom===L)return;const B=_.clientX-S.left,R=_.clientY-S.top,C=B-(B-y.pan.x)/y.zoom*L,M=R-(R-y.pan.y)/y.zoom*L;(A=h.current)==null||A.call(h,{zoom:L,pan:{x:C,y:M}})};return x.addEventListener("wheel",E,{passive:!1}),()=>x.removeEventListener("wheel",E)},[t,!!o,a,s,l,c]);const v=u.useRef(null),w=u.useCallback(x=>{!p.current||!h.current||(x.currentTarget.setPointerCapture(x.pointerId),v.current={pointerId:x.pointerId,startX:x.clientX,startY:x.clientY,panX:m.current.pan.x,panY:m.current.pan.y})},[]),f=u.useCallback(x=>{var y;const E=v.current;if(!E||E.pointerId!==x.pointerId)return;const _=x.clientX-E.startX,T=x.clientY-E.startY;(y=h.current)==null||y.call(h,{zoom:m.current.zoom,pan:{x:E.panX+_,y:E.panY+T}})},[]),b=u.useCallback(x=>{const E=v.current;if(!(!E||E.pointerId!==x.pointerId)){try{x.currentTarget.releasePointerCapture(x.pointerId)}catch{}v.current=null}},[]),g=d&&!!o;return{containerProps:{onPointerDown:w,onPointerMove:f,onPointerUp:b,onPointerCancel:b,style:{cursor:g?"move":void 0,touchAction:g?"none":void 0}},modifierActive:d}}function Bt(){const[e,t]=u.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return u.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ut(e){const t=u.useRef(e),[n,r]=u.useState(e),o=u.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function xo(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function bn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Nt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=ho(),s=u.useRef(null),l=u.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),c=u.useMemo(()=>{const f=a.w,b=a.h;if(f<=0||b<=0||n<=0||r<=0)return null;const g=Math.min(f/n,b/r),x=n*g,E=r*g;return{left:(f-x)/2,top:(b-E)/2,width:x,height:E}},[a.w,a.h,n,r]),d=e.masks,p=t.showMasks&&!!d&&d.length>0,m=u.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(u.useEffect(()=>{if(!p||!d)return;const f=s.current;if(!f)return;(f.width!==n||f.height!==r)&&(f.width=n,f.height=r);const b=f.getContext("2d");if(!b)return;b.clearRect(0,0,f.width,f.height);let g=!1;const x=b.createImageData(n,r),E=x.data;let _=d.length,T=!1;const y=()=>{g||T&&b.putImageData(x,0,0)},S=document.createElement("canvas");S.width=n,S.height=r;const O=S.getContext("2d",{willReadFrequently:!0});for(const L of d){const B=new Image;B.onload=()=>{if(!g){if(O){O.clearRect(0,0,n,r),O.drawImage(B,0,0,n,r);const R=O.getImageData(0,0,n,r).data;for(let C=0;C<n*r;C++){const M=R[C*4];if(M===0||l.has(M))continue;const[A,k,I]=xo(It(M));E[C*4]=A,E[C*4+1]=k,E[C*4+2]=I,E[C*4+3]=255,T=!0}}_-=1,_===0&&y()}},B.onerror=()=>{_-=1,_===0&&y()},B.src=`data:image/png;base64,${L.png_b64}`}return()=>{g=!0}},[p,d,n,r,m]),!c)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],v=t.showBoxes&&h.length>0,w=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),v&&i.jsx("svg",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((f,b)=>{if(!bn(f,t,l))return null;const g=f.domain==="pixel"?1:n,x=f.domain==="pixel"?1:r,E=f.position.minX*g,_=f.position.minY*x,T=(f.position.maxX-f.position.minX)*g,y=(f.position.maxY-f.position.minY)*x;return i.jsx("rect",{x:E,y:_,width:T,height:y,fill:"none",stroke:It(f.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),v&&i.jsx("div",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height},children:h.map((f,b)=>{if(!bn(f,t,l))return null;const g=f.domain==="pixel"?1/n:1,x=f.domain==="pixel"?1/r:1,E=f.position.minX*g*100,_=f.position.minY*x*100,T=f.label??w[String(f.class_id)]??`#${f.class_id}`,y=f.score!=null?` ${(f.score*100).toFixed(0)}%`:"";return!T&&!y?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${E}%`,top:`${_}%`,transform:"translateY(-100%)",backgroundColor:It(f.class_id)},children:i.jsxs("span",{className:"mono",children:[T,y]})},b)})})]})}const Ut=30,dt=["#ff5a5a","#39d353","#5b9bff"];function Ft(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function Je(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Ft(e/255):Ft(n==="int"?e*255:e)}function Ze(e,t,n,r){return e.length===1?{lines:[Je(e[0],t,n)],luminance:r}:{lines:e.map(o=>Je(o,t,n)),luminance:r,colors:e.map((o,a)=>dt[a]??null)}}const bo={x:0,y:0,w:1,h:1};function Qe({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:l=0,onActiveChange:c,sourceWindow:d=bo}){const p=u.useRef(null),m=u.useRef(!1),h=Bt(),v=u.useRef(c);v.current=c;const w=u.useCallback(b=>{var g;b!==m.current&&(m.current=b,(g=v.current)==null||g.call(v,b))},[]),f=u.useCallback(()=>{var ve;const b=p.current,g=e.current;if(!b)return;const x=window.devicePixelRatio||1,E=b.clientWidth,_=b.clientHeight;if(E===0||_===0)return;b.width!==Math.round(E*x)&&(b.width=Math.round(E*x)),b.height!==Math.round(_*x)&&(b.height=Math.round(_*x));const T=b.getContext("2d");if(!T)return;if(T.setTransform(x,0,0,x,0,0),T.clearRect(0,0,E,_),!g||t<=0||n<=0){w(!1);return}const y=g.getBoundingClientRect(),S=b.getBoundingClientRect();if(y.width===0||y.height===0){w(!1);return}const O=d.x*t,L=d.y*n,B=d.w*t,R=d.h*n;if(B<=0||R<=0){w(!1);return}const C=Math.min(y.width/B,y.height/R);if(C<Ut){w(!1);return}const M=B*C,A=R*C,k=y.left+(y.width-M)/2-S.left,I=y.top+(y.height-A)/2-S.top,ne=Math.max(Math.floor(O),Math.floor(O+(0-k)/C)),te=Math.min(Math.ceil(O+B),Math.ceil(O+(E-k)/C)),se=Math.max(Math.floor(L),Math.floor(L+(0-I)/C)),de=Math.min(Math.ceil(L+R),Math.ceil(L+(_-I)/C));if(te<=ne||de<=se){w(!1);return}w(!0);const ye=k+(0-O)*C,he=I+(0-L)*C,Le=k+(t-O)*C,ge=I+(n-L)*C;T.save(),T.beginPath(),T.rect(ye,he,Le-ye,ge-he),T.clip(),T.textAlign="center",T.textBaseline="middle",T.lineJoin="round";const Ee=C*.14,xe=C-Ee*2;for(let K=se;K<de;K++)for(let me=ne;me<te;me++){if(me<0||K<0||me>=t||K>=n)continue;const H=a(me,K,s);if(!H||H.lines.length===0)continue;const q=H.lines.length;let re=1;for(const z of H.lines)z.length>re&&(re=z.length);const we=xe/(q*1.15),be=xe/(re*.62)||we,_e=Math.min(we,be,24);if(_e<6)continue;const De=k+(me-O+.5)*C,U=I+(K-L+.5)*C,G=_e*1.15,Y=H.luminance<=.55,X=Y?"#ffffff":"#000000";T.font=`${_e}px ui-monospace, SFMono-Regular, Menlo, monospace`,T.lineWidth=Math.max(1.4,_e*.16),T.strokeStyle=Y?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Z=U-q*G/2+G/2;for(let z=0;z<H.lines.length;z++){const D=H.lines[z];T.strokeText(D,De,Z),T.fillStyle=((ve=H.colors)==null?void 0:ve[z])??X,T.fillText(D,De,Z),Z+=G}}T.restore()},[e,t,n,a,s,w,d]);return u.useEffect(()=>{f()},[f,r,o.x,o.y,l,s,d,h]),u.useEffect(()=>{const b=p.current;if(!b)return;const g=new ResizeObserver(()=>f());return g.observe(b),()=>g.disconnect()},[f]),i.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function vn({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const vo=`
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
`,Fe=`
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
`,wn=`
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
`,wo=`
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
`,ft=`
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
`;function yn(e){return`
${Fe}
${wn}
${wo}

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
`}const yo=yn("select(colorB, colorA, uv.x < split)"),Eo=yn("mix(colorA, colorB, alpha)"),Gt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},En=new WeakMap;function _o(e,t){let n=En.get(e);n||(n=new Map,En.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:vo,targetFormat:t}),n.set(t,r)),r}function _n(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Mn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Mo(e,t,n,r){var f;const o=_n(t),a=_o(e,o),s=Mn(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,c=Gt[r.operator]??Gt.srgb,d=new Float32Array([r.exposureEV,c,l,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),m=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),v=new Float32Array([r.offset??0]);let w;try{w=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:d}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:m}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,a,w)}finally{(f=w==null?void 0:w.destroy)==null||f.call(w),s.destroy()}}const Tn=new WeakMap;function To(e,t,n){let r=Tn.get(e);r||(r=new Map,Tn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?yo:Eo,targetFormat:n}),r.set(o,a)),a}function So(e,t,n,r,o){var f;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=_n(t),s=To(e,o.mode,a),l=Mn(e,void 0),c=o.gamma,d=Gt[o.operator],p=new Float32Array([o.exposureEV,d,c,0]),m=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),v=new Float32Array([o.offset??0,0,0,0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:m}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,s,w)}finally{(f=w==null?void 0:w.destroy)==null||f.call(w),l.destroy()}}function Sn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function Pn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:h,sumAbs:v}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return Sn(h,v,a)}const s=await e.readback(t),l=await e.readback(n),c=s instanceof Uint8Array,d=l instanceof Uint8Array;let p=0,m=0;for(let h=0;h<o;h++)for(let v=0;v<r;v++){const w=(h*t.width+v)*4,f=(h*n.width+v)*4;for(let b=0;b<3;b++){const g=(s[w+b]??0)/(c?255:1),x=(l[f+b]??0)/(d?255:1),E=g-x;p+=E*E,m+=Math.abs(E)}}return Sn(p,m,a)}function Cn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Po=12,Xe=[];function An(e){const t=Xe.indexOf(e);t!==-1&&Xe.splice(t,1),Xe.push(e)}function Co(e){const t=Xe.indexOf(e);t!==-1&&Xe.splice(t,1)}function pt(e){e.parked||(Co(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Rn(e){for(;Xe.length>Po;){const t=Xe.find(n=>n!==e&&!n.visible)??Xe.find(n=>n!==e);if(!t)break;pt(t)}}function kn(e){var o,a;if(e.disposed)return;if(Cn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){An(e),Rn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,An(e),Rn(e)}function Ao(e,t){if(e.disposed||!e.source)return!0;try{return kn(e),!e.surface||!e.srcTexture?!1:(Mo(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,pt(e),!1}}function Ro(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Ao(e,t)},park(){e.disposed||pt(e)},restore(){e.disposed||!e.source||kn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(pt(e),e.source=null,e.disposed=!0)}}}async function ko(e,t){const n=await ot(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Ro(r)}function Dn(e){e.dispose()}function Do(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function Ln(e){const n=`cairn-gamma-${u.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:l,flipSign:c}=e,d=u.useMemo(()=>Do(e,n),[n,r,o,s,c]);return{gammaFilterId:n,filterStr:d,gamma:a,offset:l}}function In({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function On(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Lo({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=On(e),a=On(t),s=[];for(let x=0;x<=e;x+=o)s.push(x);const l=[];for(let x=0;x<=t;x+=a)l.push(x);const c=1/n,d=8*c,p=-12*c,m=-2*c,h=r==null?void 0:r.current;let v=0,w=0,f=0,b=0;if(h){const x=h.clientWidth,E=h.clientHeight,_=x/e,T=E/t,y=Math.min(_,T);f=e*y,b=t*y,v=(x-f)/2,w=(E-b)/2}const g=h&&f>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:g?w:0,transform:`translateY(${p}px)`,fontSize:d},children:s.map(x=>i.jsx("span",{className:"mono",style:{position:"absolute",left:g?v+x/e*f:`${x/e*100}%`,transform:"translateX(-50%)"},children:x},x))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:g?v:0,transform:`translateX(${m}px)`,fontSize:d},children:l.map(x=>i.jsx("span",{className:"mono",style:{position:"absolute",top:g?w+x/t*b:`${x/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*c}px`},children:x},x))})]})}function Io({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Oo=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Bn(e,t){const n=getComputedStyle(e),r=Oo.map(c=>`${c}:${n.getPropertyValue(c)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,l=Math.min(a.length,s.length);for(let c=0;c<l;c++)Bn(a[c],s[c])}function Vt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function zt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function $t(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,c)=>a.toBlob(d=>d?l(d):c(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Bo(e,t,n){const r=e.cloneNode(!0);Bn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const c=new Image;c.onload=()=>s(c),c.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),c.src=a})}async function Nn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Vt(e);return $t(r,o,zt(t),a,s=>s.drawImage(e,0,0,r,o))}async function No(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Vt(e);try{return await $t(r,o,zt(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Uo(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function Fo(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??Vt(e);if(n){const d=n.getBoundingClientRect(),p=await Bo(n,d.width||a,d.height||s);return $t(a,s,zt(t),l,m=>{for(const h of r){const v=h.getBoundingClientRect();m.drawImage(h,v.left-o.left,v.top-o.top,v.width,v.height)}m.drawImage(p,d.left-o.left,d.top-o.top,d.width,d.height)})}if(r.length)return Nn(r[0],t);const c=Uo(e);if(c)return No(c,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Go(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Vo=8;function zo(e,t,n,r=Vo){return!(t>0)||!(e>0)?n:e<t+r}function Un(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}const $o={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Xo={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function Ge({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Xo[e]??null})}function Fn({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(Ge,{name:e??""})})}function Gn(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Wo({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:a}=n,[s,l]=u.useState(!1),[c,d]=u.useState(0),p=u.useRef(null),m=Un(r,o),h=e?void 0:((b=r[m])==null?void 0:b.label)??"",v=u.useCallback(()=>{l(g=>{const x=!g;return x&&d(m),x})},[m]),w=u.useCallback(g=>{a(g),l(!1)},[a]);u.useEffect(()=>{if(!s)return;const g=E=>{p.current&&!p.current.contains(E.target)&&l(!1)},x=E=>{E.key==="Escape"&&(E.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",g,!0),document.addEventListener("keydown",x,!0),()=>{document.removeEventListener("pointerdown",g,!0),document.removeEventListener("keydown",x,!0)}},[s]);const f=g=>{if(!s){(g.key==="ArrowDown"||g.key==="Enter"||g.key===" ")&&(g.preventDefault(),d(m),l(!0));return}if(g.key==="ArrowDown")g.preventDefault(),d(x=>(x+1)%r.length);else if(g.key==="ArrowUp")g.preventDefault(),d(x=>(x-1+r.length)%r.length);else if(g.key==="Enter"||g.key===" "){g.preventDefault();const x=r[c];x&&w(x.id)}};return i.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:g=>g.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:g=>{g.stopPropagation(),v()},onDoubleClick:g=>g.stopPropagation(),onKeyDown:f,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?i.jsx("span",{"aria-hidden":"true",children:h}):i.jsx(Ge,{name:e??""}),i.jsx(Ge,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((g,x)=>{const E=g.id===o,_=x===c;return i.jsx("li",{role:"option","aria-selected":E,children:i.jsx("button",{type:"button",onClick:T=>{T.stopPropagation(),w(g.id)},onPointerEnter:()=>d(x),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",_?"bg-bg-hover":"",E?"text-accent font-medium":"text-fg"].join(" "),children:g.label})},g.id)})})]})}const Ho=e=>e.format?e.format(e.value):String(e.value);function Vn({spec:e}){return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:t=>t.stopPropagation(),onDoubleClick:t=>{t.stopPropagation(),e.defaultValue!==void 0&&e.onChange(e.defaultValue)},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx(Ge,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:t=>e.onChange(Number(t.target.value)),onPointerDown:t=>t.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ho(e)})]})}function Yo({icon:e,title:t,menu:n,onClose:r}){var m;const{options:o,value:a,onSelect:s}=n,[l,c]=u.useState(!1),d=Un(o,a),p=((m=o[d])==null?void 0:m.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:h=>{h.stopPropagation(),c(v=>!v)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx(Ge,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),i.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:i.jsx(Ge,{name:"caret"})})]}),l&&o.map(h=>{const v=h.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":v,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",v?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:v?"✓":""}),i.jsx("span",{children:h.label})]},h.id)})]})}function Ko({actions:e,leading:t,sliders:n}){const[r,o]=u.useState(!1),a=u.useRef(null);return u.useEffect(()=>{if(!r)return;const s=c=>{a.current&&!a.current.contains(c.target)&&o(!1)},l=c=>{c.key==="Escape"&&(c.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx(Ge,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(Yo,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var c;l.stopPropagation(),!s.disabled&&((c=s.onClick)==null||c.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Ge,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Ge,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(Vn,{spec:s})},s.id))]})]})}function qo({controller:e,config:t}){var R,C;const n=u.useRef(null),[r,o]=u.useState(!1),a=u.useRef(r);a.current=r;const s=u.useRef(0),l=`${((R=t==null?void 0:t.leadingButtons)==null?void 0:R.length)??0}:${((C=t==null?void 0:t.sliders)==null?void 0:C.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(u.useEffect(()=>{const M=n.current,A=M==null?void 0:M.parentElement;if(!A)return;const k=()=>{const se=A.clientWidth;if(!a.current&&n.current){const de=n.current.scrollWidth;de>0&&(s.current=de)}o(zo(se,s.current,a.current))};let I=0;const ne=()=>{I||(I=requestAnimationFrame(()=>{I=0,k()}))},te=new ResizeObserver(ne);return te.observe(A),k(),()=>{te.disconnect(),I&&cancelAnimationFrame(I)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const c=e.capabilities,d=t==null?void 0:t.buttons,p=(M,A)=>A&&(d==null?void 0:d[M])!==!1,m=M=>()=>e.setDragMode(M),h=()=>{e.toPNG({filename:"plot"}).then(M=>Go(M,"plot.png")).catch(()=>{})},v=[];p("zoom",c.zoom)&&v.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:m("zoom")}),p("pan",c.pan)&&v.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:m("pan")}),p("select",c.select)&&v.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:m("select")}),p("lasso",c.lasso)&&v.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:m("lasso")});const w=[];p("zoomIn",c.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",c.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const f=[];p("autoscale",c.autoscale)&&f.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",c.reset)&&f.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const b=[];p("screenshot",c.screenshot)&&b.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const g=[v,w,f,b].filter(M=>M.length>0),x=g.flat(),E=(t==null?void 0:t.leadingButtons)??[],_=(t==null?void 0:t.sliders)??[];if(!E.length&&x.length===0&&_.length===0)return null;const T=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",S=T==="top-right"||T==="bottom-right",L=["z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),B={position:"absolute",pointerEvents:"auto",...$o[T]};return r?i.jsx("div",{ref:n,style:B,className:`${L} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(Ko,{actions:x,leading:E,sliders:_})}):i.jsxs("div",{ref:n,style:B,className:`${L} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${S?"justify-end":"justify-start"}`,children:[E.length>0&&i.jsxs(i.Fragment,{children:[E.map(M=>M.menu?i.jsx(Wo,{icon:M.icon,title:M.title,menu:M.menu},M.id):i.jsx(Fn,{icon:M.icon,label:M.label,title:M.title,active:M.active,disabled:M.disabled,onClick:M.onClick??(()=>{})},M.id)),g.length>0&&i.jsx(Gn,{})]}),g.map((M,A)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[A>0&&i.jsx(Gn,{}),M.map(k=>i.jsx(Fn,{icon:k.icon,title:k.title,active:k.active,disabled:k.disabled,onClick:k.onClick},k.id))]},M[0].id))]}),_.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${S?"justify-end":"justify-start"}`,children:_.map(M=>i.jsx(Vn,{spec:M},M.id))})]})}const Zo={zoom:1,pan:{x:0,y:0}},zn=1.3,Qo=.25,jo=64,Jo={buttons:{zoom:!1}};function es(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const ts=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Xt(e,t){return{id:"colormap",title:"Colormap",menu:{options:ts,value:e,onSelect:t}}}function ns({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:l=Qo,maxZoom:c=jo,requestRender:d,onReset:p,extraModified:m=!1}){const h=u.useCallback(y=>{var I;if(!o)return;const S=(I=e.current)==null?void 0:I.getBoundingClientRect(),O=(S==null?void 0:S.width)??0,L=(S==null?void 0:S.height)??0,B=a&&s&&O>0&&L>0?mn(a,s,O,L):c,R=Math.max(l,Math.min(B,n*y));if(R===n)return;const C=O/2,M=L/2,A=C-(C-r.x)/n*R,k=M-(M-r.y)/n*R;o({zoom:R,pan:{x:A,y:k}})},[o,e,a,s,c,l,n,r.x,r.y]),v=u.useCallback(()=>h(zn),[h]),w=u.useCallback(()=>h(1/zn),[h]),f=u.useCallback(()=>{o==null||o(Zo),p==null||p()},[o,p]),b=u.useCallback(y=>{const S={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};d==null||d();const O=t==null?void 0:t.current;if(O)return Nn(O,S);const L=e.current;return L?Fo(L,S):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,d]),g=u.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),x=n!==1||r.x!==0||r.y!==0||m,E=u.useCallback(y=>{},[]),_=u.useCallback(y=>{},[]),T=u.useCallback(()=>{},[]);return u.useMemo(()=>({capabilities:g,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:x,setDragMode:E,setHoverMode:_,toggleSpikelines:T,zoomIn:v,zoomOut:w,autoscale:f,reset:f,toPNG:b}),[g,x,E,_,T,v,w,f,b])}const rs={zoom:1,pan:{x:0,y:0}};function ht({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:l,naturalDims:c,checkerboard:d,wrapperClassName:p,wrapperStyle:m,viewportPadding:h,header:v,surface:w,showAxes:f,overlayNode:b,overlay:g,notationSeed:x,exportCanvasRef:E,requestRender:_,leadingMenus:T,displayAdjust:y,onReset:S,extraModified:O,label:L,showLabelChip:B,isDraggable:R=!1,onDragStart:C,extraChips:M}){const[A,k]=u.useState(x),[I,ne]=u.useState(!1),{containerProps:te}=xn({containerRef:r,zoom:a,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h}),se=u.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),S==null||S()},[y,S]),de=u.useCallback(()=>{l==null||l(rs),se()},[l,se]),ye=ns({rootRef:r,canvasRef:E,zoom:a,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h,requestRender:_,onReset:se,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!O}),he=u.useMemo(()=>{if(!y)return;const K=(me,H)=>`${me>=0?"+":"−"}${Math.abs(me).toFixed(H)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to reset.",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:me=>K(me,1),defaultValue:0},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to reset.",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:me=>K(me,2),defaultValue:0}]},[y]),Le=u.useMemo(()=>({...Jo,leadingButtons:[...T??[],...I?[es(A,k)]:[]],sliders:he}),[I,A,T,he]),ge=" cairn-checkerboard",Ee="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(d==="pane"?ge:""),xe=p+(d==="wrapper"?ge:""),ve="render"in g?g.render({notation:A,setOverlayActive:ne}):g.hasSource&&c?i.jsx(Qe,{imageElRef:g.displayElRef,naturalWidth:c.w,naturalHeight:c.h,zoom:a,pan:s,sourceWindow:g.sourceWindow,sample:g.sample,notation:A,version:g.version,onActiveChange:ne}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[v,n&&i.jsx(qo,{controller:ye,config:Le}),i.jsxs("div",{ref:r,className:Ee,style:{padding:h,...te.style},onPointerDown:te.onPointerDown,onPointerMove:te.onPointerMove,onPointerUp:te.onPointerUp,onPointerCancel:te.onPointerCancel,onDoubleClick:de,...t,children:[i.jsxs("div",{ref:o,className:xe,style:m,children:[w,f&&c&&i.jsx(Lo,{naturalWidth:c.w,naturalHeight:c.h,zoom:a,containerRef:o}),b]}),ve,!n&&I&&i.jsx(vn,{notation:A,onChange:k})]}),B&&i.jsx(Io,{label:L,isDraggable:R,onDragStart:C}),M]})}function $n(e){return"hdr"in e&&e.hdr!=null}function Xn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Pe(e){return Number.isFinite(e)?e:0}const os={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ss(e,t,n,r,o=0){const{h:a,w:s,c:l}=Xn(e.shape),c=e.precision==="f16-bits"?hn(e.data):e.data,d=zr(t),p=new Uint8ClampedArray(s*a*4);for(let m=0;m<s*a;m++){const h=m*l;let v,w,f,b=1;l===1?v=w=f=Pe(c[h]):l===3?(v=Pe(c[h]),w=Pe(c[h+1]),f=Pe(c[h+2])):(v=Pe(c[h]),w=Pe(c[h+1]),f=Pe(c[h+2]),b=Pe(c[h+3]));const g=[st(v,n,o),st(w,n,o),st(f,n,o)],[x,E,_]=d(g),T=m*4;p[T]=255*At(x,r),p[T+1]=255*At(E,r),p[T+2]=255*At(_,r),p[T+3]=255*(b<0?0:b>1?1:b)}return new ImageData(p,s,a)}function as(e){var Z,z;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:l=!1,processing:c=os,zoom:d=1,pan:p={x:0,y:0},onViewportChange:m,onNaturalSize:h,label:v,isDraggable:w=!1,onDragStart:f,overlay:b,overlaySettings:g,pixelValueNotation:x="decimal",toolbar:E=!0}=e,[_,T,y]=ut(s);u.useEffect(()=>{T(s)},[s,T]);const S=u.useRef(null),O=u.useRef(null),L=u.useRef(null),B=u.useRef(null),R=u.useRef(null),C=u.useRef(null),M=u.useRef(null),[A,k]=u.useState(0),I=u.useCallback(()=>k(D=>D+1),[]),ne=u.useMemo(()=>({get current(){const D=R.current;return D instanceof HTMLCanvasElement?D:null}}),[]),te=u.useCallback(D=>{S.current=D,D&&(R.current=D)},[]),se=u.useCallback(D=>{O.current=D,D&&(R.current=D)},[]),de=u.useCallback(D=>{D&&(R.current=D)},[]),[ye,he]=u.useState(!1),[Le,ge]=u.useState(!1),[Ee,xe]=u.useState(null),{flipSign:ve}=c,{gammaFilterId:K,filterStr:me,gamma:H,offset:q}=Ln(c),re=!r&&o!=="none"&&n!=null&&t!=null,we=o!=="none"&&n!=null,be=_!=="none"&&!re&&!(r&&we)&&t!=null;u.useEffect(()=>{if(!be||!t){ge(!1);return}let D=!1;ge(!1);const V=`${t}::${_}`,Q=Dt(V);if(Q){const W=O.current;if(W){W.width=Q.width,W.height=Q.height;const ee=W.getContext("2d");ee&&ee.putImageData(Q,0,0),M.current=Q,I(),xe({w:Q.width,h:Q.height}),h==null||h(Q.width,Q.height),ge(!0)}return}const j=new Image;return j.onload=()=>{if(D)return;const W=document.createElement("canvas");W.width=j.naturalWidth,W.height=j.naturalHeight;const ee=W.getContext("2d");if(!ee)return;ee.drawImage(j,0,0);const Re=ee.getImageData(0,0,W.width,W.height),Ce=kt(_),fe=Rt(Re,_,Ce);Lt(V,fe);const Me=O.current;if(!Me||D)return;Me.width=fe.width,Me.height=fe.height;const ae=Me.getContext("2d");ae&&ae.putImageData(fe,0,0),M.current=fe,I(),xe({w:fe.width,h:fe.height}),h==null||h(fe.width,fe.height),ge(!0)},j.src=t,()=>{D=!0}},[be,t,_]);const _e=u.useCallback((D,V)=>{xe(Q=>Q&&Q.w===D&&Q.h===V?Q:{w:D,h:V}),h==null||h(D,V)},[]);u.useEffect(()=>{if(!t){C.current=null,M.current=null,I();return}let D=!1;return Ke(t).then(V=>{D||(C.current=V,_==="none"&&(M.current=V),I())}),()=>{D=!0}},[t,_,I]);const De=u.useCallback((D,V,Q)=>{const j=C.current;if(!j||D<0||V<0||D>=j.width||V>=j.height)return null;const W=(V*j.width+D)*4,ee=j.data[W],Re=j.data[W+1],Ce=j.data[W+2],fe=M.current;let Me=ee,ae=Re,Se=Ce;if(fe&&fe.width===j.width&&fe.height===j.height){const Oe=(V*fe.width+D)*4;Me=fe.data[Oe],ae=fe.data[Oe+1],Se=fe.data[Oe+2]}const Ie=(.299*Me+.587*ae+.114*Se)/255;return Ze(_!=="none"||ee===Re&&Re===Ce?[ee]:[ee,Re,Ce],"uint8",Q,Ie)},[_]);u.useEffect(()=>{if(!re){he(!1);return}let D=!1;const V=no(),Q=V==="gpu"||V==="auto",j=`${n}::${t}::${o}::${_}`;if(V!=="gpu"){const W=Dt(j);if(W){const ee=S.current;if(ee){(ee.width!==W.width||ee.height!==W.height)&&(ee.width=W.width,ee.height=W.height);const Re=ee.getContext("2d");Re&&Re.putImageData(W,0,0),_e(W.width,W.height),he(!0)}return}}return(async()=>{const[W,ee]=await Promise.all([Ke(n),Ke(t)]);if(D||!W||!ee)return;const Ce=o.includes("signed")?"signed":"positive",fe=_!=="none"?St(_):null,Me={diffMode:o,colormap:fe,cmapMode:Ce};if(Q)try{const He=S.current;if(He){const Oe=eo(W,ee,Me,He);if(Oe){if(D)return;_e(Oe.width,Oe.height),he(!0);return}}}catch(He){console.warn("[cairn] WebGL 2 diff error:",He)}if(V==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let ae=Yr(W,ee,o);_!=="none"&&(ae=Rt(ae,_,Ce)),Lt(j,ae);const Se=S.current;if(!Se||D)return;(Se.width!==ae.width||Se.height!==ae.height)&&(Se.width=ae.width,Se.height=ae.height);const Ie=Se.getContext("2d");Ie&&Ie.putImageData(ae,0,0),_e(ae.width,ae.height),he(!0)})(),()=>{D=!0}},[n,t,o,re,_,h]);const U=a==="auto"?void 0:a,G=ve?{filter:"invert(1)"}:{},Y=b&&(g!=null&&g.enabled)&&Ee&&t&&((((Z=b.boxes)==null?void 0:Z.length)??0)>0||(((z=b.masks)==null?void 0:z.length)??0)>0)?i.jsx(Nt,{data:b,settings:g,naturalWidth:Ee.w,naturalHeight:Ee.h}):void 0,X=t?re?i.jsxs(i.Fragment,{children:[!ye&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:te,className:"w-full h-full object-contain block",style:{display:ye?"block":"none",imageRendering:U,...G}})]}):be?i.jsxs(i.Fragment,{children:[!Le&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:se,className:"w-full h-full object-contain block",style:{display:Le?"block":"none",imageRendering:U,...G}})]}):i.jsx("img",{ref:de,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:me,imageRendering:U},onLoad:D=>{const V=D.currentTarget;xe({w:V.naturalWidth,h:V.naturalHeight}),h==null||h(V.naturalWidth,V.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(ht,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:E,paneRef:L,wrapperRef:B,zoom:d,pan:p,onViewportChange:m,naturalDims:Ee,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:l&&Ee?"16px 4px 4px 28px":"4px",header:i.jsx(In,{id:K,gamma:H,offset:q}),surface:X,showAxes:l,overlayNode:Y,overlay:{displayElRef:R,sample:De,version:A,hasSource:!!t},notationSeed:x,exportCanvasRef:ne,leadingMenus:[Xt(_,D=>T(D))],onReset:y.reset,extraModified:y.isModified,label:v,showLabelChip:!0,isDraggable:w,onDragStart:f})}function is(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:l="auto",zoom:c=1,pan:d={x:0,y:0},onViewportChange:p,pixelValueNotation:m="decimal",toolbar:h=!0}=e,v=u.useRef(null),w=u.useRef(null),f=u.useRef(null),[b,g]=u.useState(null),x=u.useRef(null),[E,_]=u.useState(0),[T,y]=u.useState(0),[S,O]=u.useState(0);u.useEffect(()=>{const R=v.current;if(!R)return;let C;try{C=ss(t,n,r+T,o,S)}catch(A){console.error("[cairn] HDR tone-map error:",A);return}(R.width!==C.width||R.height!==C.height)&&(R.width=C.width,R.height=C.height);const M=R.getContext("2d");M&&(M.putImageData(C,0,0),x.current=C,_(A=>A+1),g(A=>A&&A.w===C.width&&A.h===C.height?A:{w:C.width,h:C.height}))},[t,n,r,o,T,S]);const L=u.useCallback((R,C,M)=>{const A=b;if(!A||R<0||C<0||R>=A.w||C>=A.h)return null;const k=t.shape.length===2?1:t.shape[2]??1,I=(C*A.w+R)*k,ne=t.data,te=t.precision==="f16-bits"?he=>lt(ne[he]??0):he=>ne[he]??0,se=x.current;let de=.5;if(se&&se.width===A.w&&se.height===A.h){const he=(C*A.w+R)*4;de=(.299*se.data[he]+.587*se.data[he+1]+.114*se.data[he+2])/255}const ye=k===1?[te(I)]:[te(I),te(I+1),te(I+2)];return Ze(ye,"unit",M,de)},[t,b]),B=l==="auto"?void 0:l;return i.jsx(ht,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:h,paneRef:w,wrapperRef:f,zoom:c,pan:d,onViewportChange:p,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${c})`,transformOrigin:"0 0"},viewportPadding:a&&b?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:v,className:"w-full h-full object-contain block",style:{imageRendering:B}}),showAxes:a,overlay:{displayElRef:v,sample:L,version:E,hasSource:!0},notationSeed:m,exportCanvasRef:v,displayAdjust:{exposureEV:T,offset:S,onExposureChange:y,onOffsetChange:O},label:s,showLabelChip:!!s})}function Wt(e){return $n(e)?i.jsx(is,{...e}):i.jsx(as,{...e})}const Wn={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},cs="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function ls(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function us(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function ds(e,t){if(e==="no-hdr-display")switch(us(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=ls(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function fs(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Hn(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Yn=new Set;function Kn(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Yn.has(e)}function ps(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Yn.add(e)}const qn=new Set;let gt=null,et=null;function Zn(){et&&et.parentNode&&et.parentNode.removeChild(et),et=null,gt=null}function hs(e){const t=Hn(e,window.location.pathname),n=ds(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=fs(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=cs,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{ps(t),Zn()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),et=r,gt=e}function Qn(e){if(typeof document>"u"||typeof window>"u"||qn.has(e))return;qn.add(e);const t=Hn(e,window.location.pathname);if(Kn(t))return;const n=()=>{if(!Kn(t)){if(gt!==null)if(Wn[e]<Wn[gt])Zn();else return;hs(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const gs=["linear","srgb","reinhard","aces"];function ms(e){return e&&gs.includes(e)?e:"srgb"}function xs(e){const{h:t,w:n,c:r}=Xn(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let c=0;c<n*t;c++){const d=c*r,p=c*4;if(r===1){const m=s[d];l[p]=m,l[p+1]=m,l[p+2]=m,l[p+3]=ct}else l[p]=s[d],l[p+1]=s[d+1],l[p+2]=s[d+2],l[p+3]=r>=4?s[d+3]:ct}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let c,d,p,m=1;r===1?c=d=p=Pe(o[l]):r===3?(c=Pe(o[l]),d=Pe(o[l+1]),p=Pe(o[l+2])):(c=Pe(o[l]),d=Pe(o[l+1]),p=Pe(o[l+2]),m=Pe(o[l+3]));const h=s*4;a[h]=c,a[h+1]=d,a[h+2]=p,a[h+3]=m}return{data:a,width:n,height:t,format:"rgba32float"}}function jn(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,l=(t.width-a)/2,c=(t.height-s)/2,d=Math.max(e.zoom,1e-6),p=t.width/(d*a),m=t.height/(d*s),h=-l/a-e.pan.x/(d*a),v=-c/s-e.pan.y/(d*s);return{x:h,y:v,w:p,h:m}}function Jn(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function bs(e){var _e,De;const t=$n(e),n=u.useRef(null),r=u.useRef(null),o=u.useRef(null),a=u.useRef(null),s=u.useRef(!1),[l,c]=u.useState(!1),[d,p]=u.useState(!1),[m,h]=u.useState(null),[v,w]=u.useState(0),[f,b]=u.useState(0),[g,x]=u.useState({x:0,y:0,w:1,h:1}),E=u.useRef(null),_=u.useRef(null),[T,y]=u.useState(0),S=e.zoom??1,O=e.pan??{x:0,y:0},L=e.onViewportChange,B=t?"none":e.colormap??"none",[R,C]=u.useState(B);u.useEffect(()=>{C(B)},[B]);const M=t?"none":R,A=u.useRef(B),k=u.useCallback(()=>{C(A.current)},[]),[I,ne]=u.useState(0),[te,se]=u.useState(0),de=Bt();u.useEffect(()=>{const U=n.current;if(!U)return;let G=!1;return ot().then(Y=>{var D;if(G)return;const X=((D=Y.probeExtendedToneMapping)==null?void 0:D.call(Y))??!1,Z=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,z=X&&Z&&t;s.current=z,t&&!z&&Qn(X?"no-hdr-display":"no-hdr-browser"),ko(U,{hdr:z}).then(V=>{if(G){Dn(V);return}a.current=V,p(!0)}).catch(V=>{G||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",V),c(!0))})}).catch(Y=>{G||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",Y),c(!0))}),()=>{G=!0,a.current&&(Dn(a.current),a.current=null)}},[]),u.useEffect(()=>{const U=r.current;if(!U)return;const G=new ResizeObserver(()=>b(Y=>Y+1));return G.observe(U),()=>G.disconnect()},[]),u.useEffect(()=>{const U=r.current;if(!U)return;const G=new IntersectionObserver(Y=>{const X=Y[0];if(!X)return;const Z=a.current;Z&&(Z.setVisible(X.isIntersecting),X.isIntersecting?Z.isParked&&(Z.restore(),b(z=>z+1)):Z.park())},{threshold:0});return G.observe(U),()=>G.disconnect()},[]),u.useEffect(()=>{var Y;if(!t||!d)return;const U=e.hdr;E.current=U;const G=xs(U);(Y=a.current)==null||Y.setSource(G),h(X=>X&&X.w===G.width&&X.h===G.height?X:{w:G.width,h:G.height}),y(X=>X+1),w(X=>X+1)},[t,d,t?e.hdr:null]),u.useEffect(()=>{if(t||!d)return;const U=e,G=U.imageUrl,Y=R;if(!G){_.current=null,h(null),y(Z=>Z+1);return}let X=!1;return Ke(G).then(Z=>{var V,Q;if(X||!Z)return;let z=Z;if(Y!=="none"){const j=`gpu::${G}::${Y}::ev${I}::off${te}`,W=Dt(j);if(W)z=W;else{const ee=kt(Y);z=Rt(Z,Y,ee,I,te),Lt(j,z)}}_.current=Z;const D={data:z.data,width:z.width,height:z.height,format:"rgba8unorm"};(V=a.current)==null||V.setSource(D),h(j=>j&&j.w===z.width&&j.h===z.height?j:{w:z.width,h:z.height}),(Q=U.onNaturalSize)==null||Q.call(U,z.width,z.height),y(j=>j+1),w(j=>j+1)}),()=>{X=!0}},[t,d,t?null:e.imageUrl,t?null:R,t?0:I,t?0:te]);const ye=t?e.exposure??0:0,he=t?e.tonemap:void 0,Le=t?e.gamma:void 0,ge=u.useCallback(()=>{const U=a.current;if(!U||!d||!m)return;const G=r.current,Y=o.current,X=Y?Y.getBoundingClientRect():G?G.getBoundingClientRect():{width:m.w,height:m.h},Z=jn({zoom:S,pan:O},X,m.w,m.h);x(Q=>Q.x===Z.x&&Q.y===Z.y&&Q.w===Z.w&&Q.h===Z.h?Q:Z),X.width>0&&X.height>0&&U.resize(Math.round(X.width*de),Math.round(X.height*de));const z=Jn(Z,X,m.w,m.h)>=Ut?"nearest":"linear",D=Z,V=t?{exposureEV:ye+I,offset:te,operator:s.current?"extended":ms(he),gamma:Le,isScalar:!1,hdrOut:s.current,uv:D,filter:z}:{exposureEV:M!=="none"?0:I,offset:M!=="none"?0:te,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:D,filter:z};try{U.render(V)||c(!0)}catch(Q){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",Q),c(!0)}},[d,m,S,O.x,O.y,ye,I,te,he,Le,t,M,de]);u.useEffect(()=>{ge()},[ge,v,f]);const Ee=u.useCallback((U,G,Y)=>{if(t){const W=E.current,ee=m;if(!W||!ee||U<0||G<0||U>=ee.w||G>=ee.h)return null;const Re=W.shape.length===2?1:W.shape[2]??1,Ce=(G*ee.w+U)*Re,fe=W.data,Me=W.precision==="f16-bits"?Ie=>lt(fe[Ie]??0):Ie=>fe[Ie]??0,ae=.5,Se=Re===1?[Me(Ce)]:[Me(Ce),Me(Ce+1),Me(Ce+2)];return Ze(Se,"unit",Y,ae)}const X=_.current;if(!X||U<0||G<0||U>=X.width||G>=X.height)return null;const Z=(G*X.width+U)*4,z=X.data[Z],D=X.data[Z+1],V=X.data[Z+2],Q=(.299*z+.587*D+.114*V)/255;return Ze(M!=="none"||z===D&&D===V?[z]:[z,D,V],"uint8",Y,Q)},[t,m,M]),xe=e.showAxes??!1,ve=t?e.label??"":e.label,K=e.interpolation??"auto",me=K==="auto"?void 0:K,H=t?void 0:e.overlay,q=t?void 0:e.overlaySettings,re=t?!1:e.isDraggable??!1,we=t?void 0:e.onDragStart;if(l)return t?i.jsx(Wt,{...e}):i.jsx(Wt,{...e});const be=H&&(q!=null&&q.enabled)&&m&&((((_e=H.boxes)==null?void 0:_e.length)??0)>0||(((De=H.masks)==null?void 0:De.length)??0)>0)?i.jsx(Nt,{data:H,settings:q,naturalWidth:m.w,naturalHeight:m.h}):void 0;return i.jsx(ht,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":d},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:S,pan:O,onViewportChange:L,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:xe&&m?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:me},"data-gpu-image-canvas":!0}),showAxes:xe,overlayNode:be,overlay:{displayElRef:n,sample:Ee,version:T,hasSource:!0,sourceWindow:g},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ge,leadingMenus:t?void 0:[Xt(M,U=>C(U))],displayAdjust:{exposureEV:I,offset:te,onExposureChange:ne,onOffsetChange:se},onReset:k,extraModified:R!==A.current,label:ve,showLabelChip:!!ve,isDraggable:re,onDragStart:we})}const mt=new Map;function Ve(e){if(mt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);mt.set(e.id,e)}function je(e){return mt.get(e)}function vs(){return Array.from(mt.values())}function er(e,t){return{...e.params??{},...t??{}}}const ws={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ys={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Es={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},_s={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Ms={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},Ts={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},tr=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Ps(tr);const Ht=[1.052156925,1,.91835767],Ss=.7;function Ps(e){const[t,n,r]=e[0],[o,a,s]=e[1],[l,c,d]=e[2],p=a*d-s*c,m=-(o*d-s*l),h=o*c-a*l,w=1/(t*p+n*m+r*h);return[[p*w,-(n*d-r*c)*w,(n*s-r*a)*w],[m*w,(t*d-r*l)*w,-(t*s-r*o)*w],[h*w,-(t*c-n*l)*w,(t*a-n*o)*w]]}function Cs(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Yt=6/29;function Kt(e){return e>Yt**3?Math.cbrt(e):e/(3*Yt*Yt)+4/29}function nr(e,t,n){const[r,o,a]=Cs(tr,e,t,n),s=Kt(r*Ht[0]),l=Kt(o*Ht[1]),c=Kt(a*Ht[2]),d=116*l-16,p=500*(s-l),m=200*(l-c);return[d,.01*d*p,.01*d*m]}function As(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Rs(){const e=nr(0,1,0),t=nr(0,0,1);return Math.pow(As(e,t),Ss)}const rr=Rs(),ks=.082;function or(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),l=1/e,c=Math.PI**2,d=[0,0,0];for(let p=-s;p<=s;p++)for(let m=-s;m<=s;m++){const h=(m*l)**2+(p*l)**2;for(let v=0;v<3;v++)d[v]+=t[v]*Math.sqrt(Math.PI/n[v])*Math.exp(-c*h/n[v])+r[v]*Math.sqrt(Math.PI/o[v])*Math.exp(-c*h/o[v])}return{r:s,deltaX:l,sums:d}}function sr(e){const t=.5*ks*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const c=Math.exp(-(l*l+s*s)/(2*t*t)),d=-l*c,p=(l*l/(t*t)-1)*c;d>0&&(r+=d),p>0?o+=p:a-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const Ds=`
${Fe}
${ft}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Ls=`
${Fe}
${ft}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,xt=`
${Fe}
${ft}
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
`,ar=`
${Fe}
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
`;function We(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function bt(e){return[We(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),We(2,[e.sums[2],0,0,0])]}function ir(e){return[We(4,[rr,e.sd,e.r,e.edgeNorm]),We(5,[e.pointPos,e.pointNeg,0,0])]}function cr(e,t,n,r,o=""){const a=or(e),s=sr(e),l=`ycxczA${o}`,c=`ycxczB${o}`,d=`labA${o}`,p=`labB${o}`,m=`flip${o}`;return{passes:[{name:l,shader:t,inputs:[n],output:l},{name:c,shader:t,inputs:[r],output:c},{name:d,shader:xt,inputs:[l],output:d,uniforms:()=>bt(a)},{name:p,shader:xt,inputs:[c],output:p,uniforms:()=>bt(a)},{name:m,shader:ar,inputs:[d,p,l,c],output:m,uniforms:()=>ir(s)}],flipRef:m}}const Is={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=cr(t,Ds,"srcA","srcB");return{passes:n,final:r}}},Os={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=cr(t,Ls,"srcA","srcB");return{passes:n,final:r}}},lr=`
${Fe}
${ft}
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
`,Bs=`
${Fe}
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
`,Ns={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=or(t),l=sr(t),c=[];let d=null;for(let p=0;p<o;p++){const m=n+p*a,h=`_e${p}`,v=`ycxczA${h}`,w=`ycxczB${h}`,f=`labA${h}`,b=`labB${h}`,g=`acc${h}`;c.push({name:v,shader:lr,inputs:["srcA"],output:v,uniforms:()=>[We(1,[m,0,0,0])]},{name:w,shader:lr,inputs:["srcB"],output:w,uniforms:()=>[We(1,[m,0,0,0])]},{name:f,shader:xt,inputs:[v],output:f,uniforms:()=>bt(s)},{name:b,shader:xt,inputs:[w],output:b,uniforms:()=>bt(s)}),d===null?c.push({name:g,shader:ar,inputs:[f,b,v,w],output:g,uniforms:()=>ir(l)}):c.push({name:g,shader:Bs,inputs:[f,b,v,w,d],output:g,uniforms:()=>[We(5,[rr,l.sd,l.r,l.edgeNorm]),We(6,[l.pointPos,l.pointNeg,0,0])]}),d=g}return{passes:c,final:d}}};let ur=!1;function Us(){ur||(ur=!0,Ve(ys),Ve(ws),Ve(Es),Ve(Ms),Ve(_s),Ve(Ts),Ve(Is),Ve(Ns),Ve(Os))}Us();function dr(){const e=[];for(const t of vs())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function Fs(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const fr=new WeakMap;function qt(e,t,n,r){let o=fr.get(e);o||(o=new Map,fr.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Gs(e){return`
${Fe}
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
`}const vt="rgba16float";function Vs(e,t,n,r,o){var v,w;const a=je(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),l=Math.min(t.height,n.height),c=er(a,o);if(a.kind==="pointwise"){const f=e.createTexture(s,l,vt),b=qt(e,`pw:${a.id}`,Gs(a.source),vt);let g;try{g=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(f,b,g)}finally{(v=g==null?void 0:g.destroy)==null||v.call(g)}return f}const d={width:s,height:l,params:c},p=a.buildPasses(d),m=new Map([["srcA",t],["srcB",n]]),h=[];try{for(const b of p.passes){const g=e.createTexture(s,l,vt);h.push(g),m.set(b.output,g);const x=qt(e,`mp:${a.id}:${b.name}`,b.shader,vt),E=b.inputs.map((T,y)=>{const S=m.get(T);if(!S)throw new Error(`computeDiff: pass "${b.name}" input "${T}" not produced yet`);return{binding:y,resource:S}});b.uniforms&&E.push(...b.uniforms(d));let _;try{_=e.createBindGroup(x,E),e.renderFullscreen(g,x,_)}finally{(w=_==null?void 0:_.destroy)==null||w.call(_)}}const f=m.get(p.final);if(!f)throw new Error(`computeDiff: final ref "${p.final}" not produced`);for(const b of h)b!==f&&b.destroy();return f}catch(f){for(const b of h)b.destroy();throw f}}const zs=8,$s=256*1024*1024;class Xs{constructor(t=zs,n=$s){ue(this,"map",new Map);ue(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const pr=new WeakMap;function hr(e){let t=pr.get(e);return t||(t=new Xs,pr.set(e,t)),t}function Ws(e,t){const n=er(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Hs(e,t,n,r){const o=je(n),a=o?Ws(o,r):"";return`${e}|${t}|${n}|${a}`}function Ys(e,t,n,r,o,a,s){const l=je(r);if(!l)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const c=hr(e),d=Hs(a,s,r,o),p=c.get(d);if(p)return p;const m=Vs(e,t,n,r,o),h=Math.min(t.width,n.width),v=Math.min(t.height,n.height),w={texture:m,width:h,height:v,displayRange:l.displayRange,bytes:h*v*8};return c.set(d,w),w}async function Ks(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Pn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function qs(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,hr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const Zs=`
${Fe}
${wn}
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
`,Qs={unit:0,signed:1,relative:2},js={linear:0,signed:1,positive:2};function Js(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ea(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function ta(e,t,n,r,o){var h;const a=ea(t),s=qt(e,"diff-display",Zs,a),l=Js(e,o.colormap),c=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([Qs[r],js[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]);let m;try{m=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:p}}]),e.renderFullscreen(t,s,m)}finally{(h=m==null?void 0:m.destroy)==null||h.call(m),l.destroy()}}const gr=.6*.6*2.51,na=.6*.03,ra=0,mr=.6*.6*2.43,oa=.6*.59,sa=.14;function xr(e){const t=(na-oa*e)/(gr-mr*e),n=(ra-sa*e)/(gr-mr*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const aa=.85,ia=.85,br=11920928955078125e-23,Zt=[.2126,.7152,.0722];function ca(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function la(e,t,n,r=3,o={}){const a=t*n,s=xr(aa),l=xr(ia),c=new Float64Array(a);let d=0;for(let x=0;x<a;x++){const[E,_,T]=ca(e,x,r),y=E*Zt[0]+_*Zt[1]+T*Zt[2];c[x]=y,y>d&&(d=y)}const p=Float64Array.from(c).sort(),m=a>>1,h=a%2===1?p[m]:p[m-1],v=Math.max(h,br),w=Math.max(d,br),f=o.startExposure??Math.log2(s/w),b=o.stopExposure??Math.log2(l/v),g=Math.max(2,Math.ceil(b-f));return{startExposure:f,stopExposure:b,numExposures:g}}const ua={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function da({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:l,onViewportChange:c,processing:d=ua,interpolation:p="auto",label:m="",isDraggable:h=!1,onDragStart:v,overlay:w,overlaySettings:f,pixelValueNotation:b="decimal"}){var K,me;const g=u.useRef(null),[x,E]=u.useState(null),[_,T]=u.useState(null),[y,S]=u.useState(b),[O,L]=u.useState(!1),B=u.useRef(null),R=u.useRef(null),C=u.useRef(null),M=u.useRef(null),[A,k]=u.useState(0);u.useEffect(()=>{if(!e){C.current=null,k(q=>q+1);return}let H=!1;return Ke(e).then(q=>{H||(C.current=q,k(re=>re+1))}),()=>{H=!0}},[e]),u.useEffect(()=>{if(!t){M.current=null,k(q=>q+1);return}let H=!1;return Ke(t).then(q=>{H||(M.current=q,k(re=>re+1))}),()=>{H=!0}},[t]);const I=H=>(q,re,we)=>{const be=H.current;if(!be||q<0||re<0||q>=be.width||re>=be.height)return null;const _e=(re*be.width+q)*4,De=be.data[_e],U=be.data[_e+1],G=be.data[_e+2],Y=(.299*De+.587*U+.114*G)/255;return De===U&&U===G?{lines:[Je(De,"uint8",we)],luminance:Y}:{lines:[Je(De,"uint8",we),Je(U,"uint8",we),Je(G,"uint8",we)],luminance:Y,colors:[dt[0],dt[1],dt[2]]}},ne=u.useMemo(()=>I(C),[]),te=u.useMemo(()=>I(M),[]),se=!!w&&!!(f!=null&&f.enabled)&&!!x&&!!e&&((((K=w.boxes)==null?void 0:K.length)??0)>0||(((me=w.masks)==null?void 0:me.length)??0)>0),{gammaFilterId:de,filterStr:ye,gamma:he,offset:Le}=Ln(d),ge=`translate(${l.x}px, ${l.y}px) scale(${s})`,Ee=p==="auto"?void 0:p,{containerProps:xe,modifierActive:ve}=xn({containerRef:g,zoom:s,pan:l,onViewportChange:c});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(In,{id:de,gamma:he,offset:Le}),i.jsxs("div",{ref:g,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...xe.style},onPointerDown:xe.onPointerDown,onPointerMove:xe.onPointerMove,onPointerUp:xe.onPointerUp,onPointerCancel:xe.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:[i.jsx("img",{ref:B,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ye,imageRendering:Ee,...n==="blend"?{opacity:o}:{}},onLoad:H=>{const q=H.currentTarget;E({w:q.naturalWidth,h:q.naturalHeight})}}),se&&i.jsx(Nt,{data:w,settings:f,naturalWidth:x.w,naturalHeight:x.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:i.jsx("img",{ref:R,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ye,imageRendering:Ee,...n==="blend"?{opacity:1-o}:{}},onLoad:H=>{const q=H.currentTarget;T({w:q.naturalWidth,h:q.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:H=>{H.stopPropagation(),H.preventDefault();const re=H.currentTarget.parentElement.getBoundingClientRect(),we=_e=>{a==null||a(Math.max(0,Math.min(1,(_e.clientX-re.left)/re.width)))},be=()=>{window.removeEventListener("pointermove",we),window.removeEventListener("pointerup",be)};window.addEventListener("pointermove",we),window.addEventListener("pointerup",be)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&_&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Qe,{imageElRef:R,naturalWidth:_.w,naturalHeight:_.h,zoom:s,pan:l,sample:te,notation:y,version:A})}),e&&x&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Qe,{imageElRef:B,naturalWidth:x.w,naturalHeight:x.h,zoom:s,pan:l,sample:ne,notation:y,version:A,onActiveChange:L})})]}):e&&x&&i.jsx(Qe,{imageElRef:B,naturalWidth:x.w,naturalHeight:x.h,zoom:s,pan:l,sample:ne,notation:y,version:A,onActiveChange:L}),O&&i.jsx(vn,{notation:y,onChange:S})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!ve?" cairn-drag-grip":""}`,draggable:h&&!ve,onDragStart:v,style:{cursor:h&&!ve?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),m]})]})}function fa(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function pa({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:d=>{d==="side"?s==null||s():d==="slide"?r():d==="blend"?o():a(d)}}}}function ha(e){const t=St(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function ga(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const c=e.data,d=new Uint16Array(o*4);for(let p=0;p<o;p++){const m=p*r,h=p*4;if(r===1){const v=c[m];d[h]=v,d[h+1]=v,d[h+2]=v,d[h+3]=ct}else d[h]=c[m],d[h+1]=c[m+1],d[h+2]=c[m+2],d[h+3]=r>=4?c[m+3]:ct}return{data:d,format:"rgba16float"}}const a=e.data,s=new Float32Array(o*4),l=c=>Number.isFinite(c)?c:0;for(let c=0;c<o;c++){const d=c*r;let p,m,h,v=1;r===1?p=m=h=l(a[d]):r===3?(p=l(a[d]),m=l(a[d+1]),h=l(a[d+2])):(p=l(a[d]),m=l(a[d+1]),h=l(a[d+2]),v=l(a[d+3]));const w=c*4;s[w]=p,s[w+1]=m,s[w+2]=h,s[w+3]=v}return{data:s,format:"rgba32float"}}function ma({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,diffSubmode:c,colormap:d="none",diffKernel:p,onDiffKernelChange:m,onCompareModeChange:h,onRequestSide:v,zoom:w,pan:f,onViewportChange:b,interpolation:g="auto",label:x="",pixelValueNotation:E="decimal"}){var yr;const _=u.useRef(null),T=u.useRef(null),y=u.useRef(null),S=u.useRef(null),O=u.useRef(null),[L,B]=u.useState(!1),[R,C]=u.useState(!1),[M,A]=u.useState(null),[k,I]=u.useState(0),[ne,te]=u.useState(0),[se,de]=u.useState(null),[ye,he]=u.useState({x:0,y:0,w:1,h:1}),Le=p??c??"absolute",[ge,Ee,xe]=ut(Le);u.useEffect(()=>{Ee(p??c??"absolute")},[p,c,Ee]);const ve=u.useCallback(P=>{Ee(P),m==null||m(P)},[m,Ee]);u.useEffect(()=>{const P=_.current;if(P)return P.__cairnDiffKernel={current:ge,set:ve},()=>{P&&delete P.__cairnDiffKernel}},[ge,ve]);const[K,me,H]=ut(o);u.useEffect(()=>{me(o)},[o,me]);const q=u.useCallback(P=>{me(P),h==null||h(P)},[h,me]),[re,we,be]=ut(d);u.useEffect(()=>{we(d)},[d,we]);const _e=u.useCallback(()=>{q(H.default),we(be.default),ve(xe.default)},[q,we,ve,H.default,be.default,xe.default]),De=H.isModified||be.isModified||xe.isModified,[U,G]=u.useState(0),[Y,X]=u.useState(0),Z=u.useMemo(()=>{const oe=[pa({mode:K,kernel:ge,kernelOptions:dr().map(F=>({id:F.id,label:F.label})),onSide:v,onSlide:()=>q("split"),onBlend:()=>q("blend"),onKernel:F=>{q("diff"),ve(F)}})];return K==="diff"&&oe.push(Xt(re,F=>we(F))),oe},[K,ge,re,ve,q,v]),z=u.useRef(null),D=u.useRef(null),V=u.useRef(null),Q=u.useRef(null),[j,W]=u.useState(0),ee=u.useRef(null),[Re,Ce]=u.useState(0),fe=Bt();u.useEffect(()=>{const P=y.current;if(!P)return;let oe=!1;return ot().then(F=>{if(!oe)try{if(Cn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const N=F.createSurface(P,{hdr:!1});S.current={device:F,surface:N,texA:null,texB:null},C(!0)}catch(N){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",N),B(!0)}}).catch(F=>{oe||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",F),B(!0))}),()=>{var N,J;oe=!0;const F=S.current;F&&((N=F.texA)==null||N.destroy(),(J=F.texB)==null||J.destroy(),S.current=null)}},[]),u.useEffect(()=>{const P=_.current;if(!P)return;const oe=new ResizeObserver(()=>te(F=>F+1));return oe.observe(P),()=>oe.disconnect()},[]),u.useEffect(()=>{if(!R)return;let P=!1;if(!S.current)return;async function F(N,J){if(J){const le=ga(J);return{width:J.width,height:J.height,imageData:null,make:ie=>{const Te=ie.createTexture(J.width,J.height,le.format);return Te.write(le.data),Te}}}if(!N)return null;const ce=await Ke(N);return ce?{width:ce.width,height:ce.height,imageData:ce,make:le=>{const ie=le.createTexture(ce.width,ce.height,"rgba8unorm");return ie.write(ce.data),ie}}:null}return Promise.all([F(e,n),F(t,r)]).then(([N,J])=>{var ie,Te;if(P||!S.current)return;const ce=S.current;z.current=(N==null?void 0:N.imageData)??null,D.current=(J==null?void 0:J.imageData)??null,V.current=n??null,Q.current=r??null,(ie=ce.texA)==null||ie.destroy(),(Te=ce.texB)==null||Te.destroy(),ce.texA=null,ce.texB=null;const le=N??J;if(!le){A(null),W(ke=>ke+1);return}ce.texA=(J??le).make(ce.device),ce.texB=(N??le).make(ce.device),A({w:le.width,h:le.height}),W(ke=>ke+1),I(ke=>ke+1)}),()=>{P=!0}},[R,e,t,n,r]);const Me=n!=null||r!=null,ae=u.useMemo(()=>Fs(ge,Me),[ge,Me]),Se=u.useMemo(()=>{if(!Me)return null;const P=r??n;if(!P)return null;const oe=P.precision==="f16-bits"?hn(P.data):P.data;return la(oe,P.width,P.height,P.channels)},[Me,r,n]),Ie=u.useMemo(()=>{var P;return Xr(((P=je(ae))==null?void 0:P.displayRange)??"unit",re==="none"?null:re)},[ae,re]),He=u.useMemo(()=>re!=="none"?ha(re):void 0,[re]),Oe=u.useCallback(()=>{const P=S.current;if(!R||!P||!P.surface||!P.texA||!P.texB||!M)return;const oe=_.current,F=oe?oe.getBoundingClientRect():{width:M.w,height:M.h},N=jn({zoom:w,pan:f},F,M.w,M.h);he(ie=>ie.x===N.x&&ie.y===N.y&&ie.w===N.w&&ie.h===N.h?ie:N);const J=y.current;if(F.width>0&&F.height>0&&J&&P.surface){const ie=Math.max(1,Math.round(F.width*fe)),Te=Math.max(1,Math.round(F.height*fe));(J.width!==ie||J.height!==Te)&&(J.width=ie,J.height=Te,P.surface.configure(ie,Te))}const ce=Jn(N,F,M.w,M.h)>=Ut?"nearest":"linear",le=N;try{if(K==="diff"){const ie=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Te=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ke=je(ae)?ae:"absolute",Ye=ke==="hdr-flip"&&Se?{ppd:67,startExposure:Se.startExposure,stopExposure:Se.stopExposure,numExposures:Se.numExposures}:void 0,nt=Ys(P.device,P.texA,P.texB,ke,Ye,ie,Te);O.current=nt,ta(P.device,P.surface,nt.texture,nt.displayRange,{uv:le,cmapMode:Ie,colormap:He,filter:ce,exposureEV:U,offset:Y})}else{const ie={exposureEV:U,offset:Y,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:le,filter:ce,mode:K,split:a,alpha:s};So(P.device,P.surface,P.texA,P.texB,ie)}}catch(ie){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ie),B(!0)}},[R,M,w,f.x,f.y,K,a,s,U,Y,ge,ae,Se,Ie,He,e,t,n,r,fe]);u.useEffect(()=>{Oe()},[Oe,k,ne]);const wt=t!=null||r!=null;u.useEffect(()=>{const P=S.current;if(!R||!P||!P.texA||!P.texB||!wt){de(null);return}let oe=!1;const F=P.texA,N=P.texB,J=O.current;return(K==="diff"&&J?Ks(P.device,J,F,N):Pn(P.device,F,N)).then(le=>{oe||de(le)}),()=>{oe=!0}},[R,k,wt,K,ge]),u.useEffect(()=>{if(K!=="diff"){ee.current=null;return}const P=S.current,oe=O.current;if(!R||!P||!oe)return;let F=!1;return ee.current=null,Ce(N=>N+1),qs(P.device,oe).then(N=>{F||(ee.current=N,Ce(J=>J+1))}).catch(()=>{}),()=>{F=!0}},[R,K,ae,k]);const vr=(P,oe)=>(F,N,J)=>{const ce=oe.current;if(ce){const{data:Er,width:_r,height:_a,channels:Mr}=ce;if(F<0||N<0||F>=_r||N>=_a)return null;const yt=(N*_r+F)*Mr,Et=ce.precision==="f16-bits"?Qt=>lt(Er[Qt]??0):Qt=>Er[Qt]??0,Ma=.5,Ta=Mr===1?[Et(yt)]:[Et(yt),Et(yt+1),Et(yt+2)];return Ze(Ta,"unit",J,Ma)}const le=P.current;if(!le||F<0||N<0||F>=le.width||N>=le.height)return null;const ie=(N*le.width+F)*4,Te=le.data[ie],ke=le.data[ie+1],Ye=le.data[ie+2],nt=(.299*Te+.587*ke+.114*Ye)/255;return Ze(Te===ke&&ke===Ye?[Te]:[Te,ke,Ye],"uint8",J,nt)},wr=u.useMemo(()=>vr(z,V),[]),va=u.useMemo(()=>vr(D,Q),[]),wa=u.useMemo(()=>(P,oe,F)=>{var Ye;const N=ee.current;if(!N||!M)return null;const{w:J,h:ce}=M;if(P<0||oe<0||P>=J||oe>=ce)return null;const le=(oe*J+P)*4,ie=((Ye=je(ae))==null?void 0:Ye.output)??"per-channel",Te=.5,ke=ie==="scalar"?[N[le]??0]:[N[le]??0,N[le+1]??0,N[le+2]??0];return Ze(ke,"unit",F,Te)},[M,ae]),ya=g==="auto"?void 0:g;if(L)return n!=null||r!=null?i.jsx(fa,{}):K==="diff"?i.jsx(Wt,{imageUrl:e,baselineUrl:t,diffMode:((yr=je(ae))==null?void 0:yr.kind)==="pointwise"?ae:"absolute",interpolation:g,colormap:re,showAxes:!1,zoom:w,pan:f,onViewportChange:b,label:x,pixelValueNotation:E}):i.jsx(da,{imageUrl:e,baselineUrl:t,mode:K,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,zoom:w,pan:f,onViewportChange:b,interpolation:g,label:x,pixelValueNotation:E});const Ea=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:y,className:"w-full h-full block",style:{imageRendering:ya},"data-gpu-compare-canvas":!0}),K==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:P=>{P.stopPropagation(),l==null||l(.5)},onPointerDown:P=>{P.stopPropagation(),P.preventDefault();const F=P.currentTarget.parentElement.getBoundingClientRect(),N=ce=>{l==null||l(Math.max(0,Math.min(1,(ce.clientX-F.left)/F.width)))},J=()=>{window.removeEventListener("pointermove",N),window.removeEventListener("pointerup",J)};window.addEventListener("pointermove",N),window.addEventListener("pointerup",J)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(ht,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":R},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:_,wrapperRef:T,zoom:w,pan:f,onViewportChange:b,naturalDims:M,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Ea,showAxes:!1,notationSeed:E,onReset:_e,extraModified:De,exportCanvasRef:y,requestRender:Oe,leadingMenus:Z,displayAdjust:{exposureEV:U,offset:Y,onExposureChange:G,onOffsetChange:X},label:"",showLabelChip:!1,overlay:{render:({notation:P,setOverlayActive:oe})=>K==="split"?i.jsxs(i.Fragment,{children:[wt&&M&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(Qe,{imageElRef:y,naturalWidth:M.w,naturalHeight:M.h,zoom:w,pan:f,sourceWindow:ye,sample:va,notation:P,version:j})}),wt&&M&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(Qe,{imageElRef:y,naturalWidth:M.w,naturalHeight:M.h,zoom:w,pan:f,sourceWindow:ye,sample:wr,notation:P,version:j,onActiveChange:oe})})]}):M&&i.jsx(Qe,{imageElRef:y,naturalWidth:M.w,naturalHeight:M.h,zoom:w,pan:f,sourceWindow:ye,sample:K==="diff"?wa:wr,notation:P,version:K==="diff"?Re:j,onActiveChange:oe})},extraChips:i.jsxs(i.Fragment,{children:[K==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),x?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:x}):null,se&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${x?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",se.mse.toExponential(2)," · PSNR ",Number.isFinite(se.psnr)?se.psnr.toFixed(1):"∞"," dB · MAE"," ",se.mae.toExponential(2)]})]})})}const xa="cairn-plot:gpu-image-ready";async function ba(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await ot(),window.__cairnPlotGpuImagePane=bs,window.__cairnPlotGpuComparePane=ma,window.__cairnPlotDiffMenuModes=dr(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(xa))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Qn("no-webgpu")}}}ba()})(__cairnPlotJsxRuntime,__cairnPlotReact);
