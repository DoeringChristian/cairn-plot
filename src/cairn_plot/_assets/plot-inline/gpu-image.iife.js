var wa=Object.defineProperty;var ya=(i,c,Ve)=>c in i?wa(i,c,{enumerable:!0,configurable:!0,writable:!0,value:Ve}):i[c]=Ve;var ce=(i,c,Ve)=>ya(i,typeof c!="symbol"?c+"":c,Ve);(function(i,c){"use strict";const Ve=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function qt(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Ve}),{hdr:!1,format:n}}function vr(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Ve}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Ve}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return qt(e,t)}}}const wr=`
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
`;function yt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Zt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function yr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Er={texture:0,sampler:1,uniform:2};function Et(e,t){return e*3+Er[t]}const _r={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Mr(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const u=_r[s];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Qt{constructor(t,n,r,o){ce(this,"width");ce(this,"height");ce(this,"format");ce(this,"gpuTexture");ce(this,"device");ce(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:yt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Zt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class jt{constructor(t){ce(this,"_s");ce(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Tr{constructor(t,n,r,o,a){ce(this,"_p");ce(this,"gpuPipeline");ce(this,"bindings");ce(this,"bindGroupLayout");ce(this,"variants");ce(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Sr(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Pr{constructor(t){ce(this,"_c");ce(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Cr{constructor(t,n){ce(this,"_b");ce(this,"gpuBindGroup");ce(this,"ownedBuffers");ce(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Ar{constructor(t,n,r,o){ce(this,"canvas");ce(this,"hdr");ce(this,"format");ce(this,"context");ce(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function rt(e){return"canvas"in e}async function Rr(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(f){return rt(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function s(f){if(rt(f))return{width:f.canvas.width,height:f.canvas.height};const b=f;return{width:b.width,height:b.height}}let u=!1,l=null;function d(){var b,p;if(l!==null)return l;let f=!1;try{if(typeof document<"u"){const m=document.createElement("canvas");m.width=1,m.height=1;const E=m.getContext("webgpu");if(E)try{E.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const _=(b=E.getConfiguration)==null?void 0:b.call(E);f=((p=_==null?void 0:_.toneMapping)==null?void 0:p.mode)==="extended"}catch{f=!1}finally{try{E.unconfigure()}catch{}}}}catch{f=!1}return l=f,f}const h=256;let x=null,g=null;function y(){if(!x||!g){const f=t.createShaderModule({code:wr});g=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const b=t.createPipelineLayout({bindGroupLayouts:[g]});x=t.createComputePipeline({layout:b,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:x,layout:g}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(f,b,p){return new Qt(t,f,b,p)},createSampler(f){const b=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",p=t.createSampler({magFilter:b,minFilter:b,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new jt(p)},createRenderPipeline(f){const b=t.createShaderModule({code:f.shaderWGSL}),p=Mr(f.shaderWGSL),m=yt(f.targetFormat),E=Sr(t,p),_=t.createPipelineLayout({bindGroupLayouts:[E]}),T=S=>t.createRenderPipeline({layout:_,vertex:{module:b,entryPoint:"vs_main"},fragment:{module:b,entryPoint:"fs_main",targets:[{format:S}]},primitive:{topology:"triangle-list"}}),w=T(m);return new Tr(w,p,E,m,T)},createComputePipeline(f){const b=t.createShaderModule({code:f.shaderWGSL}),p=t.createComputePipeline({layout:"auto",compute:{module:b,entryPoint:"cs_main"}});return new Pr(p)},createBindGroup(f,b){const p=f,m=new Map,E=[];for(const[T,w]of p.bindings)if(w.kind==="uniform"){const S=t.createBuffer({size:w.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});E.push(S),m.set(T,{binding:T,resource:{buffer:S}})}else w.kind==="sampler"&&m.set(T,{binding:T,resource:o()});for(const T of b){const w=T.resource;if(w instanceof Qt){const S=Et(T.binding,"texture");p.bindings.has(S)&&m.set(S,{binding:S,resource:w.gpuTexture.createView()})}else if(w instanceof jt){const S=Et(T.binding,"sampler");p.bindings.has(S)&&m.set(S,{binding:S,resource:w.gpuSampler})}else{const S=Et(T.binding,"uniform"),O=p.bindings.get(S);if(O&&O.kind==="uniform"){const L=w.uniform,B=t.createBuffer({size:Math.max(O.sizeBytes,L.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,L.buffer,L.byteOffset,L.byteLength),E.push(B),m.set(S,{binding:S,resource:{buffer:B}})}}}const _=t.createBindGroup({layout:p.bindGroupLayout,entries:Array.from(m.values())});return new Cr(_,E)},createSurface(f,b){const p=f.getContext("webgpu");if(!p)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const m=b.hdr&&n.hdr,E=()=>m?vr(p,t):qt(p,t),_=E();return new Ar(f,p,_,E)},renderFullscreen(f,b,p){const m=b,E=p,_=a(f),{width:T,height:w}=s(f),S=rt(f)?f.format:yt(f.format),O=m.pipelineFor(S),L=t.createCommandEncoder(),B=L.beginRenderPass({colorAttachments:[{view:_,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});B.setPipeline(O),B.setBindGroup(0,E.gpuBindGroup),B.setViewport(0,0,T,w,0,1),B.draw(3),B.end(),t.queue.submit([L.finish()])},async readback(f){const b=rt(f),{width:p,height:m}=s(f),E=b?f.hdr?"rgba16float":"rgba8unorm":f.format,_=b&&f.format==="bgra8unorm",T=b?f.getCurrentGPUTexture():f.gpuTexture,w=Zt(E),S=p*w,O=256,L=Math.ceil(S/O)*O,B=L*m,R=t.createBuffer({size:B,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),C=t.createCommandEncoder();C.copyTextureToBuffer({texture:T},{buffer:R,bytesPerRow:L,rowsPerImage:m},{width:p,height:m,depthOrArrayLayers:1}),t.queue.submit([C.finish()]),await R.mapAsync(GPUMapMode.READ);const M=new Uint8Array(R.getMappedRange()),A=new Uint8Array(S*m);for(let k=0;k<m;k++){const I=k*L,ne=k*S;A.set(M.subarray(I,I+S),ne)}if(R.unmap(),R.destroy(),E==="rgba8unorm"){if(_)for(let k=0;k<A.length;k+=4){const I=A[k],ne=A[k+2];A[k]=ne,A[k+2]=I}return A}if(E==="rgba16float"){const k=new Uint16Array(A.buffer,A.byteOffset,A.byteLength/2),I=new Float32Array(k.length);for(let ne=0;ne<k.length;ne++)I[ne]=yr(k[ne]);return I}return new Float32Array(A.buffer,A.byteOffset,A.byteLength/4)},async reduceDiffSumSquaredAbs(f,b,p,m){const E=f,_=b,T=Math.max(0,p*m),w=Math.max(1,Math.ceil(T/h)),{pipeline:S,layout:O}=y(),L=w*2*4,B=t.createBuffer({size:L,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),R=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(R,0,new Uint32Array([Math.max(1,p),Math.max(1,m),T,0]));const C=t.createBindGroup({layout:O,entries:[{binding:0,resource:E.gpuTexture.createView()},{binding:1,resource:_.gpuTexture.createView()},{binding:2,resource:{buffer:B}},{binding:3,resource:{buffer:R}}]}),M=t.createBuffer({size:L,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),A=t.createCommandEncoder(),k=A.beginComputePass();k.setPipeline(S),k.setBindGroup(0,C),k.dispatchWorkgroups(w),k.end(),A.copyBufferToBuffer(B,0,M,0,L),t.queue.submit([A.finish()]),await M.mapAsync(GPUMapMode.READ);const ne=new Float32Array(M.getMappedRange()).slice();M.unmap(),M.destroy(),B.destroy(),R.destroy();let K=0,de=0;for(let pe=0;pe<w;pe++)K+=ne[pe*2],de+=ne[pe*2+1];return{sumSq:K,sumAbs:de}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let _t=null;async function kr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Rr()}function ot(){return _t||(_t=kr()),_t}function Dr(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Lr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),u=o-a,[l,d,h]=Dr(e[a],e[s],u);t[n*3]=Math.round(l),t[n*3+1]=Math.round(d),t[n*3+2]=Math.round(h)}return t}const Jt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Ir=new Set(["red-green","red-blue"]),en=new Map;function Mt(e){let t=en.get(e);if(!t){const n=Jt[e]??Jt.viridis;t=Lr(n),en.set(e,t)}return t}const Oe=e=>e<0?0:e>1?1:e,Tt=e=>{const t=e<0?0:e;return t/(1+t)},St=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Oe(n/r)},tn={linear:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],srgb:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],reinhard:([e,t,n])=>[Tt(e),Tt(t),Tt(n)],aces:([e,t,n])=>[St(e),St(t),St(n)],extended:([e,t,n])=>[e,t,n]},Or="srgb";function Br(e){return e&&tn[e]||tn[Or]}function st(e,t,n){return e*2**t+n}function Nr(e){const t=Oe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Pt(e,t){return typeof t=="number"&&t>0?Oe(Math.pow(Oe(e),1/t)):Nr(e)}function Ct(e,t,n="linear",r=0,o=0){const a=Mt(t),s=new ImageData(e.width,e.height),u=e.data,l=s.data,d=r!==0||o!==0;for(let h=0;h<u.length;h+=4){let x=(u[h]+u[h+1]+u[h+2])/3;d&&(x=Math.max(0,Math.min(255,st(x/255,r,o)*255)));let g;n==="positive"?g=Math.round(128+x/255*127):g=Math.round(x),g=Math.max(0,Math.min(255,g)),l[h]=a[g*3],l[h+1]=a[g*3+1],l[h+2]=a[g*3+2],l[h+3]=u[h+3]}return s}function Ur(e,t){return e==="signed"||e==="relative"?"signed":At(t)}function At(e){return Ir.has(e??"")?"positive":"linear"}function nn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const rn=nn(50);function Rt(e){return rn.get(e)}function kt(e,t){rn.set(e,t)}const on=nn(100);function Fr(e){return on.get(e)}function Gr(e,t){on.set(e,t)}function Vr(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let u=0;u<r;u++){const l=(s*e.width+u)*4,d=(s*t.width+u)*4,h=(s*r+u)*4;for(let x=0;x<3;x++){const g=e.data[l+x],y=t.data[d+x],v=g-y,f=Math.abs(v),b=Math.max(g,1);let p;switch(n){case"signed":p=(v+255)/2;break;case"absolute":p=f;break;case"squared":p=v*v/255;break;case"relative_signed":p=(v/b+1)*127.5;break;case"relative_absolute":p=f/b*255;break;case"relative_squared":p=v*v/(b*b)*255;break}a.data[h+x]=Math.min(255,Math.max(0,Math.round(p)))}a.data[h+3]=255}return a}async function Ye(e){const t=Fr(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Gr(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const zr={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},$r={linear:0,signed:1,positive:2},Xr=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Wr=`#version 300 es
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
}`;let Ke=null,$=null,Ce=null,at=null;function Hr(){if($)return $;try{if(typeof OffscreenCanvas<"u"?Ke=new OffscreenCanvas(1,1):Ke=document.createElement("canvas"),$=Ke.getContext("webgl2",{preserveDrawingBuffer:!0}),!$)return console.warn("[cairn] WebGL 2 not available"),null;const e=$.createShader($.VERTEX_SHADER);if($.shaderSource(e,Xr),$.compileShader(e),!$.getShaderParameter(e,$.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",$.getShaderInfoLog(e)),null;const t=$.createShader($.FRAGMENT_SHADER);if($.shaderSource(t,Wr),$.compileShader(t),!$.getShaderParameter(t,$.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",$.getShaderInfoLog(t)),null;if(Ce=$.createProgram(),$.attachShader(Ce,e),$.attachShader(Ce,t),$.linkProgram(Ce),!$.getProgramParameter(Ce,$.LINK_STATUS))return console.error("[cairn] WebGL program link:",$.getProgramInfoLog(Ce)),null;at=$.createVertexArray(),$.bindVertexArray(at);const n=$.createBuffer();$.bindBuffer($.ARRAY_BUFFER,n),$.bufferData($.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),$.STATIC_DRAW);const r=$.getAttribLocation(Ce,"a_pos");return $.enableVertexAttribArray(r),$.vertexAttribPointer(r,2,$.FLOAT,!1,0,0),$.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),$}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function sn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Yr(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Kr(e,t,n,r){const o=Hr();if(!o||!Ce||!at||!Ke)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);Ke.width=a,Ke.height=s,o.viewport(0,0,a,s);const u=sn(o,e,0),l=sn(o,t,1);let d=null;n.colormap?d=Yr(o,n.colormap,2):(d=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,d),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ce),o.uniform1i(o.getUniformLocation(Ce,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ce,"u_other"),1),o.uniform1i(o.getUniformLocation(Ce,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ce,"u_diff_mode"),zr[n.diffMode]),o.uniform1i(o.getUniformLocation(Ce,"u_cmap_mode"),$r[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ce,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(at),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const h=r.getContext("2d");return h&&(h.save(),h.scale(1,-1),h.drawImage(Ke,0,0,a,s,0,-s,a,s),h.restore()),o.deleteTexture(u),o.deleteTexture(l),o.deleteTexture(d),{width:a,height:s}}const qr="cairn:render-mode";function Zr(){try{const e=localStorage.getItem(qr);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Be=new Uint32Array(512),Ne=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Be[e]=0,Be[e|256]=32768,Ne[e]=24,Ne[e|256]=24):t<-14?(Be[e]=1024>>-t-14,Be[e|256]=1024>>-t-14|32768,Ne[e]=-t-1,Ne[e|256]=-t-1):t<=15?(Be[e]=t+15<<10,Be[e|256]=t+15<<10|32768,Ne[e]=13,Ne[e|256]=13):t<128?(Be[e]=31744,Be[e|256]=64512,Ne[e]=24,Ne[e|256]=24):(Be[e]=31744,Be[e|256]=64512,Ne[e]=13,Ne[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var tt=Uint8Array,an=Uint16Array,Qr=Int32Array,jr=new tt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Jr=new tt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),cn=function(e,t){for(var n=new an(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Qr(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},ln=cn(jr,2),eo=ln.b,to=ln.r;eo[28]=258,to[258]=28,cn(Jr,0);for(var no=new an(32768),fe=0;fe<32768;++fe){var ze=(fe&43690)>>1|(fe&21845)<<1;ze=(ze&52428)>>2|(ze&13107)<<2,ze=(ze&61680)>>4|(ze&3855)<<4,no[fe]=((ze&65280)>>8|(ze&255)<<8)>>1}for(var it=new tt(288),fe=0;fe<144;++fe)it[fe]=8;for(var fe=144;fe<256;++fe)it[fe]=9;for(var fe=256;fe<280;++fe)it[fe]=7;for(var fe=280;fe<288;++fe)it[fe]=8;for(var ro=new tt(32),fe=0;fe<32;++fe)ro[fe]=5;var oo=new tt(0),so=typeof TextDecoder<"u"&&new TextDecoder,ao=0;try{so.decode(oo,{stream:!0}),ao=1}catch{}const un=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Dt(e){const t=un.length;return un[(e%t+t)%t]}function io(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),u=c.useRef(null),l=c.useCallback((d,h)=>{o(x=>x.w===d&&x.h===h?x:{w:d,h})},[]);return c.useLayoutEffect(()=>{const d=n.current;if(!d||d===u.current)return;const h=d.getBoundingClientRect();(h.width>0||h.height>0)&&(u.current=d,l(h.width,h.height))}),c.useEffect(()=>{var x;const d=n.current;if(d===s.current||((x=a.current)==null||x.disconnect(),a.current=null,s.current=d,!d))return;const h=new ResizeObserver(g=>{for(const y of g)l(y.contentRect.width,y.contentRect.height)});a.current=h,h.observe(d)}),c.useEffect(()=>()=>{var d;return(d=a.current)==null?void 0:d.disconnect()},[]),{ref:n,size:r}}function co(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const lo=.25,Lt=64;function dn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Lt;const o=Math.min(n/e,r/t);return o<=0?Lt:Math.max(Math.max(n,r)/o,8)}function fn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=lo,maxZoom:s=Lt,naturalWidth:u,naturalHeight:l}=e,d=co(),h=c.useRef(d);h.current=d;const x=c.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const g=c.useRef(o);g.current=o,c.useEffect(()=>{const m=t.current;if(!m||!o)return;const E=_=>{var A;if(!h.current)return;_.preventDefault(),_.stopPropagation();const T=_.deltaY<0?1.1:1/1.1,w=x.current,S=m.getBoundingClientRect(),O=u&&l?dn(u,l,S.width,S.height):s,L=Math.max(a,Math.min(O,w.zoom*T));if(w.zoom===L)return;const B=_.clientX-S.left,R=_.clientY-S.top,C=B-(B-w.pan.x)/w.zoom*L,M=R-(R-w.pan.y)/w.zoom*L;(A=g.current)==null||A.call(g,{zoom:L,pan:{x:C,y:M}})};return m.addEventListener("wheel",E,{passive:!1}),()=>m.removeEventListener("wheel",E)},[t,!!o,a,s,u,l]);const y=c.useRef(null),v=c.useCallback(m=>{!h.current||!g.current||(m.currentTarget.setPointerCapture(m.pointerId),y.current={pointerId:m.pointerId,startX:m.clientX,startY:m.clientY,panX:x.current.pan.x,panY:x.current.pan.y})},[]),f=c.useCallback(m=>{var w;const E=y.current;if(!E||E.pointerId!==m.pointerId)return;const _=m.clientX-E.startX,T=m.clientY-E.startY;(w=g.current)==null||w.call(g,{zoom:x.current.zoom,pan:{x:E.panX+_,y:E.panY+T}})},[]),b=c.useCallback(m=>{const E=y.current;if(!(!E||E.pointerId!==m.pointerId)){try{m.currentTarget.releasePointerCapture(m.pointerId)}catch{}y.current=null}},[]),p=d&&!!o;return{containerProps:{onPointerDown:v,onPointerMove:f,onPointerUp:b,onPointerCancel:b,style:{cursor:p?"move":void 0,touchAction:p?"none":void 0}},modifierActive:d}}function It(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ct(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function uo(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function pn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Ot({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=io(),s=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),l=c.useMemo(()=>{const f=a.w,b=a.h;if(f<=0||b<=0||n<=0||r<=0)return null;const p=Math.min(f/n,b/r),m=n*p,E=r*p;return{left:(f-m)/2,top:(b-E)/2,width:m,height:E}},[a.w,a.h,n,r]),d=e.masks,h=t.showMasks&&!!d&&d.length>0,x=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!h||!d)return;const f=s.current;if(!f)return;(f.width!==n||f.height!==r)&&(f.width=n,f.height=r);const b=f.getContext("2d");if(!b)return;b.clearRect(0,0,f.width,f.height);let p=!1;const m=b.createImageData(n,r),E=m.data;let _=d.length,T=!1;const w=()=>{p||T&&b.putImageData(m,0,0)},S=document.createElement("canvas");S.width=n,S.height=r;const O=S.getContext("2d",{willReadFrequently:!0});for(const L of d){const B=new Image;B.onload=()=>{if(!p){if(O){O.clearRect(0,0,n,r),O.drawImage(B,0,0,n,r);const R=O.getImageData(0,0,n,r).data;for(let C=0;C<n*r;C++){const M=R[C*4];if(M===0||u.has(M))continue;const[A,k,I]=uo(Dt(M));E[C*4]=A,E[C*4+1]=k,E[C*4+2]=I,E[C*4+3]=255,T=!0}}_-=1,_===0&&w()}},B.onerror=()=>{_-=1,_===0&&w()},B.src=`data:image/png;base64,${L.png_b64}`}return()=>{p=!0}},[h,d,n,r,x]),!l)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const g=e.boxes??[],y=t.showBoxes&&g.length>0,v=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[h&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),y&&i.jsx("svg",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:g.map((f,b)=>{if(!pn(f,t,u))return null;const p=f.domain==="pixel"?1:n,m=f.domain==="pixel"?1:r,E=f.position.minX*p,_=f.position.minY*m,T=(f.position.maxX-f.position.minX)*p,w=(f.position.maxY-f.position.minY)*m;return i.jsx("rect",{x:E,y:_,width:T,height:w,fill:"none",stroke:Dt(f.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),y&&i.jsx("div",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height},children:g.map((f,b)=>{if(!pn(f,t,u))return null;const p=f.domain==="pixel"?1/n:1,m=f.domain==="pixel"?1/r:1,E=f.position.minX*p*100,_=f.position.minY*m*100,T=f.label??v[String(f.class_id)]??`#${f.class_id}`,w=f.score!=null?` ${(f.score*100).toFixed(0)}%`:"";return!T&&!w?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${E}%`,top:`${_}%`,transform:"translateY(-100%)",backgroundColor:Dt(f.class_id)},children:i.jsxs("span",{className:"mono",children:[T,w]})},b)})})]})}const Bt=30,lt=["#ff5a5a","#39d353","#5b9bff"];function Nt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function Je(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Nt(e/255):Nt(n==="int"?e*255:e)}function qe(e,t,n,r){return e.length===1?{lines:[Je(e[0],t,n)],luminance:r}:{lines:e.map(o=>Je(o,t,n)),luminance:r,colors:e.map((o,a)=>lt[a]??null)}}const fo={x:0,y:0,w:1,h:1};function Ze({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:u=0,onActiveChange:l,sourceWindow:d=fo}){const h=c.useRef(null),x=c.useRef(!1),g=It(),y=c.useRef(l);y.current=l;const v=c.useCallback(b=>{var p;b!==x.current&&(x.current=b,(p=y.current)==null||p.call(y,b))},[]),f=c.useCallback(()=>{var ve;const b=h.current,p=e.current;if(!b)return;const m=window.devicePixelRatio||1,E=b.clientWidth,_=b.clientHeight;if(E===0||_===0)return;b.width!==Math.round(E*m)&&(b.width=Math.round(E*m)),b.height!==Math.round(_*m)&&(b.height=Math.round(_*m));const T=b.getContext("2d");if(!T)return;if(T.setTransform(m,0,0,m,0,0),T.clearRect(0,0,E,_),!p||t<=0||n<=0){v(!1);return}const w=p.getBoundingClientRect(),S=b.getBoundingClientRect();if(w.width===0||w.height===0){v(!1);return}const O=d.x*t,L=d.y*n,B=d.w*t,R=d.h*n;if(B<=0||R<=0){v(!1);return}const C=Math.min(w.width/B,w.height/R);if(C<Bt){v(!1);return}const M=B*C,A=R*C,k=w.left+(w.width-M)/2-S.left,I=w.top+(w.height-A)/2-S.top,ne=Math.max(Math.floor(O),Math.floor(O+(0-k)/C)),K=Math.min(Math.ceil(O+B),Math.ceil(O+(E-k)/C)),de=Math.max(Math.floor(L),Math.floor(L+(0-I)/C)),pe=Math.min(Math.ceil(L+R),Math.ceil(L+(_-I)/C));if(K<=ne||pe<=de){v(!1);return}v(!0);const be=k+(0-O)*C,Me=I+(0-L)*C,Le=k+(t-O)*C,he=I+(n-L)*C;T.save(),T.beginPath(),T.rect(be,Me,Le-be,he-Me),T.clip(),T.textAlign="center",T.textBaseline="middle",T.lineJoin="round";const ye=C*.14,me=C-ye*2;for(let q=de;q<pe;q++)for(let ge=ne;ge<K;ge++){if(ge<0||q<0||ge>=t||q>=n)continue;const H=a(ge,q,s);if(!H||H.lines.length===0)continue;const Z=H.lines.length;let re=1;for(const z of H.lines)z.length>re&&(re=z.length);const we=me/(Z*1.15),xe=me/(re*.62)||we,Ee=Math.min(we,xe,24);if(Ee<6)continue;const De=k+(ge-O+.5)*C,U=I+(q-L+.5)*C,G=Ee*1.15,Y=H.luminance<=.55,X=Y?"#ffffff":"#000000";T.font=`${Ee}px ui-monospace, SFMono-Regular, Menlo, monospace`,T.lineWidth=Math.max(1.4,Ee*.16),T.strokeStyle=Y?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Q=U-Z*G/2+G/2;for(let z=0;z<H.lines.length;z++){const D=H.lines[z];T.strokeText(D,De,Q),T.fillStyle=((ve=H.colors)==null?void 0:ve[z])??X,T.fillText(D,De,Q),Q+=G}}T.restore()},[e,t,n,a,s,v,d]);return c.useEffect(()=>{f()},[f,r,o.x,o.y,u,s,d,g]),c.useEffect(()=>{const b=h.current;if(!b)return;const p=new ResizeObserver(()=>f());return p.observe(b),()=>p.disconnect()},[f]),i.jsx("canvas",{ref:h,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function hn({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const po=`
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
`,gn=`
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
`,ho=`
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
`,ut=`
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
`;function mn(e){return`
${Ue}
${gn}
${ho}

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
`}const go=mn("select(colorB, colorA, uv.x < split)"),mo=mn("mix(colorA, colorB, alpha)"),Ut={linear:0,srgb:1,reinhard:2,aces:3,extended:4},xn=new WeakMap;function xo(e,t){let n=xn.get(e);n||(n=new Map,xn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:po,targetFormat:t}),n.set(t,r)),r}function bn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function vn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function bo(e,t,n,r){var f;const o=bn(t),a=xo(e,o),s=vn(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,l=Ut[r.operator]??Ut.srgb,d=new Float32Array([r.exposureEV,l,u,r.isScalar?1:0]),h=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),g=new Float32Array([r.filter==="nearest"?0:1]),y=new Float32Array([r.offset??0]);let v;try{v=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:d}},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:g}},{binding:6,resource:{uniform:y}}]),e.renderFullscreen(t,a,v)}finally{(f=v==null?void 0:v.destroy)==null||f.call(v),s.destroy()}}const wn=new WeakMap;function vo(e,t,n){let r=wn.get(e);r||(r=new Map,wn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?go:mo,targetFormat:n}),r.set(o,a)),a}function wo(e,t,n,r,o){var f;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=bn(t),s=vo(e,o.mode,a),u=vn(e,void 0),l=o.gamma,d=Ut[o.operator],h=new Float32Array([o.exposureEV,d,l,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),g=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),y=new Float32Array([o.offset??0,0,0,0]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:g}},{binding:6,resource:{uniform:y}}]),e.renderFullscreen(t,s,v)}finally{(f=v==null?void 0:v.destroy)==null||f.call(v),u.destroy()}}function yn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function En(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:g,sumAbs:y}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return yn(g,y,a)}const s=await e.readback(t),u=await e.readback(n),l=s instanceof Uint8Array,d=u instanceof Uint8Array;let h=0,x=0;for(let g=0;g<o;g++)for(let y=0;y<r;y++){const v=(g*t.width+y)*4,f=(g*n.width+y)*4;for(let b=0;b<3;b++){const p=(s[v+b]??0)/(l?255:1),m=(u[f+b]??0)/(d?255:1),E=p-m;h+=E*E,x+=Math.abs(E)}}return yn(h,x,a)}function _n(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const yo=12,$e=[];function Mn(e){const t=$e.indexOf(e);t!==-1&&$e.splice(t,1),$e.push(e)}function Eo(e){const t=$e.indexOf(e);t!==-1&&$e.splice(t,1)}function dt(e){e.parked||(Eo(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Tn(e){for(;$e.length>yo;){const t=$e.find(n=>n!==e&&!n.visible)??$e.find(n=>n!==e);if(!t)break;dt(t)}}function Sn(e){var o,a;if(e.disposed)return;if(_n())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Mn(e),Tn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,Mn(e),Tn(e)}function _o(e,t){if(e.disposed||!e.source)return!0;try{return Sn(e),!e.surface||!e.srcTexture?!1:(bo(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,dt(e),!1}}function Mo(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return _o(e,t)},park(){e.disposed||dt(e)},restore(){e.disposed||!e.source||Sn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(dt(e),e.source=null,e.disposed=!0)}}}async function To(e,t){const n=await ot(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Mo(r)}function Pn(e){e.dispose()}function So(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function Cn(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:u,flipSign:l}=e,d=c.useMemo(()=>So(e,n),[n,r,o,s,l]);return{gammaFilterId:n,filterStr:d,gamma:a,offset:u}}function An({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Rn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Po({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Rn(e),a=Rn(t),s=[];for(let m=0;m<=e;m+=o)s.push(m);const u=[];for(let m=0;m<=t;m+=a)u.push(m);const l=1/n,d=8*l,h=-12*l,x=-2*l,g=r==null?void 0:r.current;let y=0,v=0,f=0,b=0;if(g){const m=g.clientWidth,E=g.clientHeight,_=m/e,T=E/t,w=Math.min(_,T);f=e*w,b=t*w,y=(m-f)/2,v=(E-b)/2}const p=g&&f>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:p?v:0,transform:`translateY(${h}px)`,fontSize:d},children:s.map(m=>i.jsx("span",{className:"mono",style:{position:"absolute",left:p?y+m/e*f:`${m/e*100}%`,transform:"translateX(-50%)"},children:m},m))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:p?y:0,transform:`translateX(${x}px)`,fontSize:d},children:u.map(m=>i.jsx("span",{className:"mono",style:{position:"absolute",top:p?v+m/t*b:`${m/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*l}px`},children:m},m))})]})}function Co({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Ao=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function kn(e,t){const n=getComputedStyle(e),r=Ao.map(l=>`${l}:${n.getPropertyValue(l)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,u=Math.min(a.length,s.length);for(let l=0;l<u;l++)kn(a[l],s[l])}function Ft(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Gt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Vt(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((u,l)=>a.toBlob(d=>d?u(d):l(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Ro(e,t,n){const r=e.cloneNode(!0);kn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,u)=>{const l=new Image;l.onload=()=>s(l),l.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),l.src=a})}async function Dn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Ft(e);return Vt(r,o,Gt(t),a,s=>s.drawImage(e,0,0,r,o))}async function ko(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Ft(e);try{return await Vt(r,o,Gt(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Do(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function Lo(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,u=(t==null?void 0:t.background)??Ft(e);if(n){const d=n.getBoundingClientRect(),h=await Ro(n,d.width||a,d.height||s);return Vt(a,s,Gt(t),u,x=>{for(const g of r){const y=g.getBoundingClientRect();x.drawImage(g,y.left-o.left,y.top-o.top,y.width,y.height)}x.drawImage(h,d.left-o.left,d.top-o.top,d.width,d.height)})}if(r.length)return Dn(r[0],t);const l=Do(e);if(l)return ko(l,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Io(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Oo=8;function Bo(e,t,n,r=Oo){return!(t>0)||!(e>0)?n:e<t+r}function Ln(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}const No={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Uo={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function Fe({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Uo[e]??null})}function In({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(Fe,{name:e??""})})}function On(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Fo({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:a}=n,[s,u]=c.useState(!1),[l,d]=c.useState(0),h=c.useRef(null),x=Ln(r,o),g=e?void 0:((b=r[x])==null?void 0:b.label)??"",y=c.useCallback(()=>{u(p=>{const m=!p;return m&&d(x),m})},[x]),v=c.useCallback(p=>{a(p),u(!1)},[a]);c.useEffect(()=>{if(!s)return;const p=E=>{h.current&&!h.current.contains(E.target)&&u(!1)},m=E=>{E.key==="Escape"&&(E.stopPropagation(),u(!1))};return document.addEventListener("pointerdown",p,!0),document.addEventListener("keydown",m,!0),()=>{document.removeEventListener("pointerdown",p,!0),document.removeEventListener("keydown",m,!0)}},[s]);const f=p=>{if(!s){(p.key==="ArrowDown"||p.key==="Enter"||p.key===" ")&&(p.preventDefault(),d(x),u(!0));return}if(p.key==="ArrowDown")p.preventDefault(),d(m=>(m+1)%r.length);else if(p.key==="ArrowUp")p.preventDefault(),d(m=>(m-1+r.length)%r.length);else if(p.key==="Enter"||p.key===" "){p.preventDefault();const m=r[l];m&&v(m.id)}};return i.jsxs("div",{ref:h,className:"relative inline-flex",onPointerDown:p=>p.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:p=>{p.stopPropagation(),y()},onDoubleClick:p=>p.stopPropagation(),onKeyDown:f,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",g?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[g?i.jsx("span",{"aria-hidden":"true",children:g}):i.jsx(Fe,{name:e??""}),i.jsx(Fe,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((p,m)=>{const E=p.id===o,_=m===l;return i.jsx("li",{role:"option","aria-selected":E,children:i.jsx("button",{type:"button",onClick:T=>{T.stopPropagation(),v(p.id)},onPointerEnter:()=>d(m),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",_?"bg-bg-hover":"",E?"text-accent font-medium":"text-fg"].join(" "),children:p.label})},p.id)})})]})}const Go=e=>e.format?e.format(e.value):String(e.value);function Bn({spec:e}){return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:t=>t.stopPropagation(),onDoubleClick:t=>{t.stopPropagation(),e.defaultValue!==void 0&&e.onChange(e.defaultValue)},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx(Fe,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:t=>e.onChange(Number(t.target.value)),onPointerDown:t=>t.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Go(e)})]})}function Vo({icon:e,title:t,menu:n,onClose:r}){var x;const{options:o,value:a,onSelect:s}=n,[u,l]=c.useState(!1),d=Ln(o,a),h=((x=o[d])==null?void 0:x.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:g=>{g.stopPropagation(),l(y=>!y)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx(Fe,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:h}),i.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:i.jsx(Fe,{name:"caret"})})]}),u&&o.map(g=>{const y=g.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":y,"data-menu-option":"",onClick:v=>{v.stopPropagation(),s(g.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",y?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:y?"✓":""}),i.jsx("span",{children:g.label})]},g.id)})]})}function zo({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return c.useEffect(()=>{if(!r)return;const s=l=>{a.current&&!a.current.contains(l.target)&&o(!1)},u=l=>{l.key==="Escape"&&(l.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",u,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",u,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(u=>!u)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx(Fe,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(Vo,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:u=>{var l;u.stopPropagation(),!s.disabled&&((l=s.onClick)==null||l.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Fe,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:u=>{u.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Fe,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(Bn,{spec:s})},s.id))]})]})}function $o({controller:e,config:t}){var R,C;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),u=`${((R=t==null?void 0:t.leadingButtons)==null?void 0:R.length)??0}:${((C=t==null?void 0:t.sliders)==null?void 0:C.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const M=n.current,A=M==null?void 0:M.parentElement;if(!A)return;const k=()=>{const de=A.clientWidth;if(!a.current&&n.current){const pe=n.current.scrollWidth;pe>0&&(s.current=pe)}o(Bo(de,s.current,a.current))};let I=0;const ne=()=>{I||(I=requestAnimationFrame(()=>{I=0,k()}))},K=new ResizeObserver(ne);return K.observe(A),k(),()=>{K.disconnect(),I&&cancelAnimationFrame(I)}},[u]),(t==null?void 0:t.enabled)===!1)return null;const l=e.capabilities,d=t==null?void 0:t.buttons,h=(M,A)=>A&&(d==null?void 0:d[M])!==!1,x=M=>()=>e.setDragMode(M),g=()=>{e.toPNG({filename:"plot"}).then(M=>Io(M,"plot.png")).catch(()=>{})},y=[];h("zoom",l.zoom)&&y.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:x("zoom")}),h("pan",l.pan)&&y.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:x("pan")}),h("select",l.select)&&y.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:x("select")}),h("lasso",l.lasso)&&y.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:x("lasso")});const v=[];h("zoomIn",l.zoom)&&v.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),h("zoomOut",l.zoom)&&v.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const f=[];h("autoscale",l.autoscale)&&f.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),h("reset",l.reset)&&f.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const b=[];h("screenshot",l.screenshot)&&b.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:g});const p=[y,v,f,b].filter(M=>M.length>0),m=p.flat(),E=(t==null?void 0:t.leadingButtons)??[],_=(t==null?void 0:t.sliders)??[];if(!E.length&&m.length===0&&_.length===0)return null;const T=(t==null?void 0:t.position)??"top-right",w=(t==null?void 0:t.visibility)==="always",S=T==="top-right"||T==="bottom-right",L=["z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",w?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),B={position:"absolute",pointerEvents:"auto",...No[T]};return r?i.jsx("div",{ref:n,style:B,className:`${L} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(zo,{actions:m,leading:E,sliders:_})}):i.jsxs("div",{ref:n,style:B,className:`${L} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${S?"justify-end":"justify-start"}`,children:[E.length>0&&i.jsxs(i.Fragment,{children:[E.map(M=>M.menu?i.jsx(Fo,{icon:M.icon,title:M.title,menu:M.menu},M.id):i.jsx(In,{icon:M.icon,label:M.label,title:M.title,active:M.active,disabled:M.disabled,onClick:M.onClick??(()=>{})},M.id)),p.length>0&&i.jsx(On,{})]}),p.map((M,A)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[A>0&&i.jsx(On,{}),M.map(k=>i.jsx(In,{icon:k.icon,title:k.title,active:k.active,disabled:k.disabled,onClick:k.onClick},k.id))]},M[0].id))]}),_.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${S?"justify-end":"justify-start"}`,children:_.map(M=>i.jsx(Bn,{spec:M},M.id))})]})}const Xo={zoom:1,pan:{x:0,y:0}},Nn=1.3,Wo=.25,Ho=64,Yo={buttons:{zoom:!1}};function Ko(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const qo=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function zt(e,t){return{id:"colormap",title:"Colormap",menu:{options:qo,value:e,onSelect:t}}}function Zo({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:u=Wo,maxZoom:l=Ho,requestRender:d,onReset:h,extraModified:x=!1}){const g=c.useCallback(w=>{var I;if(!o)return;const S=(I=e.current)==null?void 0:I.getBoundingClientRect(),O=(S==null?void 0:S.width)??0,L=(S==null?void 0:S.height)??0,B=a&&s&&O>0&&L>0?dn(a,s,O,L):l,R=Math.max(u,Math.min(B,n*w));if(R===n)return;const C=O/2,M=L/2,A=C-(C-r.x)/n*R,k=M-(M-r.y)/n*R;o({zoom:R,pan:{x:A,y:k}})},[o,e,a,s,l,u,n,r.x,r.y]),y=c.useCallback(()=>g(Nn),[g]),v=c.useCallback(()=>g(1/Nn),[g]),f=c.useCallback(()=>{o==null||o(Xo),h==null||h()},[o,h]),b=c.useCallback(w=>{const S={scale:w==null?void 0:w.scale,filename:w==null?void 0:w.filename};d==null||d();const O=t==null?void 0:t.current;if(O)return Dn(O,S);const L=e.current;return L?Lo(L,S):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,d]),p=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),m=n!==1||r.x!==0||r.y!==0||x,E=c.useCallback(w=>{},[]),_=c.useCallback(w=>{},[]),T=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:p,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:m,setDragMode:E,setHoverMode:_,toggleSpikelines:T,zoomIn:y,zoomOut:v,autoscale:f,reset:f,toPNG:b}),[p,m,E,_,T,y,v,f,b])}const Qo={zoom:1,pan:{x:0,y:0}};function ft({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:u,naturalDims:l,checkerboard:d,wrapperClassName:h,wrapperStyle:x,viewportPadding:g,header:y,surface:v,showAxes:f,overlayNode:b,overlay:p,notationSeed:m,exportCanvasRef:E,requestRender:_,leadingMenus:T,displayAdjust:w,onReset:S,extraModified:O,label:L,showLabelChip:B,isDraggable:R=!1,onDragStart:C,extraChips:M}){const[A,k]=c.useState(m),[I,ne]=c.useState(!1),{containerProps:K}=fn({containerRef:r,zoom:a,pan:s,onViewportChange:u,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h}),de=c.useCallback(()=>{w==null||w.onExposureChange(0),w==null||w.onOffsetChange(0),S==null||S()},[w,S]),pe=c.useCallback(()=>{u==null||u(Qo),de()},[u,de]),be=Zo({rootRef:r,canvasRef:E,zoom:a,pan:s,onViewportChange:u,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h,requestRender:_,onReset:de,extraModified:((w==null?void 0:w.exposureEV)??0)!==0||((w==null?void 0:w.offset)??0)!==0||!!O}),Me=c.useMemo(()=>{if(!w)return;const q=(ge,H)=>`${ge>=0?"+":"−"}${Math.abs(ge).toFixed(H)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to reset.",min:-8,max:8,step:.1,value:w.exposureEV,onChange:w.onExposureChange,format:ge=>q(ge,1),defaultValue:0},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to reset.",min:-1,max:1,step:.01,value:w.offset,onChange:w.onOffsetChange,format:ge=>q(ge,2),defaultValue:0}]},[w]),Le=c.useMemo(()=>({...Yo,leadingButtons:[...T??[],...I?[Ko(A,k)]:[]],sliders:Me}),[I,A,T,Me]),he=" cairn-checkerboard",ye="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(d==="pane"?he:""),me=h+(d==="wrapper"?he:""),ve="render"in p?p.render({notation:A,setOverlayActive:ne}):p.hasSource&&l?i.jsx(Ze,{imageElRef:p.displayElRef,naturalWidth:l.w,naturalHeight:l.h,zoom:a,pan:s,sourceWindow:p.sourceWindow,sample:p.sample,notation:A,version:p.version,onActiveChange:ne}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[y,n&&i.jsx($o,{controller:be,config:Le}),i.jsxs("div",{ref:r,className:ye,style:{padding:g,...K.style},onPointerDown:K.onPointerDown,onPointerMove:K.onPointerMove,onPointerUp:K.onPointerUp,onPointerCancel:K.onPointerCancel,onDoubleClick:pe,...t,children:[i.jsxs("div",{ref:o,className:me,style:x,children:[v,f&&l&&i.jsx(Po,{naturalWidth:l.w,naturalHeight:l.h,zoom:a,containerRef:o}),b]}),ve,!n&&I&&i.jsx(hn,{notation:A,onChange:k})]}),B&&i.jsx(Co,{label:L,isDraggable:R,onDragStart:C}),M]})}function Un(e){return"hdr"in e&&e.hdr!=null}function Fn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Te(e){return Number.isFinite(e)?e:0}const jo={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Jo(e,t,n,r,o=0){const{h:a,w:s,c:u}=Fn(e.shape),l=e.data,d=Br(t),h=new Uint8ClampedArray(s*a*4);for(let x=0;x<s*a;x++){const g=x*u;let y,v,f,b=1;u===1?y=v=f=Te(l[g]):u===3?(y=Te(l[g]),v=Te(l[g+1]),f=Te(l[g+2])):(y=Te(l[g]),v=Te(l[g+1]),f=Te(l[g+2]),b=Te(l[g+3]));const p=[st(y,n,o),st(v,n,o),st(f,n,o)],[m,E,_]=d(p),T=x*4;h[T]=255*Pt(m,r),h[T+1]=255*Pt(E,r),h[T+2]=255*Pt(_,r),h[T+3]=255*(b<0?0:b>1?1:b)}return new ImageData(h,s,a)}function es(e){var Q,z;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:u=!1,processing:l=jo,zoom:d=1,pan:h={x:0,y:0},onViewportChange:x,onNaturalSize:g,label:y,isDraggable:v=!1,onDragStart:f,overlay:b,overlaySettings:p,pixelValueNotation:m="decimal",toolbar:E=!0}=e,[_,T,w]=ct(s);c.useEffect(()=>{T(s)},[s,T]);const S=c.useRef(null),O=c.useRef(null),L=c.useRef(null),B=c.useRef(null),R=c.useRef(null),C=c.useRef(null),M=c.useRef(null),[A,k]=c.useState(0),I=c.useCallback(()=>k(D=>D+1),[]),ne=c.useMemo(()=>({get current(){const D=R.current;return D instanceof HTMLCanvasElement?D:null}}),[]),K=c.useCallback(D=>{S.current=D,D&&(R.current=D)},[]),de=c.useCallback(D=>{O.current=D,D&&(R.current=D)},[]),pe=c.useCallback(D=>{D&&(R.current=D)},[]),[be,Me]=c.useState(!1),[Le,he]=c.useState(!1),[ye,me]=c.useState(null),{flipSign:ve}=l,{gammaFilterId:q,filterStr:ge,gamma:H,offset:Z}=Cn(l),re=!r&&o!=="none"&&n!=null&&t!=null,we=o!=="none"&&n!=null,xe=_!=="none"&&!re&&!(r&&we)&&t!=null;c.useEffect(()=>{if(!xe||!t){he(!1);return}let D=!1;he(!1);const V=`${t}::${_}`,j=Rt(V);if(j){const W=O.current;if(W){W.width=j.width,W.height=j.height;const te=W.getContext("2d");te&&te.putImageData(j,0,0),M.current=j,I(),me({w:j.width,h:j.height}),g==null||g(j.width,j.height),he(!0)}return}const J=new Image;return J.onload=()=>{if(D)return;const W=document.createElement("canvas");W.width=J.naturalWidth,W.height=J.naturalHeight;const te=W.getContext("2d");if(!te)return;te.drawImage(J,0,0);const Ae=te.getImageData(0,0,W.width,W.height),Se=At(_),ie=Ct(Ae,_,Se);kt(V,ie);const Pe=O.current;if(!Pe||D)return;Pe.width=ie.width,Pe.height=ie.height;const oe=Pe.getContext("2d");oe&&oe.putImageData(ie,0,0),M.current=ie,I(),me({w:ie.width,h:ie.height}),g==null||g(ie.width,ie.height),he(!0)},J.src=t,()=>{D=!0}},[xe,t,_]);const Ee=c.useCallback((D,V)=>{me(j=>j&&j.w===D&&j.h===V?j:{w:D,h:V}),g==null||g(D,V)},[]);c.useEffect(()=>{if(!t){C.current=null,M.current=null,I();return}let D=!1;return Ye(t).then(V=>{D||(C.current=V,_==="none"&&(M.current=V),I())}),()=>{D=!0}},[t,_,I]);const De=c.useCallback((D,V,j)=>{const J=C.current;if(!J||D<0||V<0||D>=J.width||V>=J.height)return null;const W=(V*J.width+D)*4,te=J.data[W],Ae=J.data[W+1],Se=J.data[W+2],ie=M.current;let Pe=te,oe=Ae,Re=Se;if(ie&&ie.width===J.width&&ie.height===J.height){const Ie=(V*ie.width+D)*4;Pe=ie.data[Ie],oe=ie.data[Ie+1],Re=ie.data[Ie+2]}const je=(.299*Pe+.587*oe+.114*Re)/255;return qe(_!=="none"||te===Ae&&Ae===Se?[te]:[te,Ae,Se],"uint8",j,je)},[_]);c.useEffect(()=>{if(!re){Me(!1);return}let D=!1;const V=Zr(),j=V==="gpu"||V==="auto",J=`${n}::${t}::${o}::${_}`;if(V!=="gpu"){const W=Rt(J);if(W){const te=S.current;if(te){(te.width!==W.width||te.height!==W.height)&&(te.width=W.width,te.height=W.height);const Ae=te.getContext("2d");Ae&&Ae.putImageData(W,0,0),Ee(W.width,W.height),Me(!0)}return}}return(async()=>{const[W,te]=await Promise.all([Ye(n),Ye(t)]);if(D||!W||!te)return;const Se=o.includes("signed")?"signed":"positive",ie=_!=="none"?Mt(_):null,Pe={diffMode:o,colormap:ie,cmapMode:Se};if(j)try{const We=S.current;if(We){const Ie=Kr(W,te,Pe,We);if(Ie){if(D)return;Ee(Ie.width,Ie.height),Me(!0);return}}}catch(We){console.warn("[cairn] WebGL 2 diff error:",We)}if(V==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let oe=Vr(W,te,o);_!=="none"&&(oe=Ct(oe,_,Se)),kt(J,oe);const Re=S.current;if(!Re||D)return;(Re.width!==oe.width||Re.height!==oe.height)&&(Re.width=oe.width,Re.height=oe.height);const je=Re.getContext("2d");je&&je.putImageData(oe,0,0),Ee(oe.width,oe.height),Me(!0)})(),()=>{D=!0}},[n,t,o,re,_,g]);const U=a==="auto"?void 0:a,G=ve?{filter:"invert(1)"}:{},Y=b&&(p!=null&&p.enabled)&&ye&&t&&((((Q=b.boxes)==null?void 0:Q.length)??0)>0||(((z=b.masks)==null?void 0:z.length)??0)>0)?i.jsx(Ot,{data:b,settings:p,naturalWidth:ye.w,naturalHeight:ye.h}):void 0,X=t?re?i.jsxs(i.Fragment,{children:[!be&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:K,className:"w-full h-full object-contain block",style:{display:be?"block":"none",imageRendering:U,...G}})]}):xe?i.jsxs(i.Fragment,{children:[!Le&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:de,className:"w-full h-full object-contain block",style:{display:Le?"block":"none",imageRendering:U,...G}})]}):i.jsx("img",{ref:pe,src:t,alt:y,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ge,imageRendering:U},onLoad:D=>{const V=D.currentTarget;me({w:V.naturalWidth,h:V.naturalHeight}),g==null||g(V.naturalWidth,V.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:E,paneRef:L,wrapperRef:B,zoom:d,pan:h,onViewportChange:x,naturalDims:ye,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:u&&ye?"16px 4px 4px 28px":"4px",header:i.jsx(An,{id:q,gamma:H,offset:Z}),surface:X,showAxes:u,overlayNode:Y,overlay:{displayElRef:R,sample:De,version:A,hasSource:!!t},notationSeed:m,exportCanvasRef:ne,leadingMenus:[zt(_,D=>T(D))],onReset:w.reset,extraModified:w.isModified,label:y,showLabelChip:!0,isDraggable:v,onDragStart:f})}function ts(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:u="auto",zoom:l=1,pan:d={x:0,y:0},onViewportChange:h,pixelValueNotation:x="decimal",toolbar:g=!0}=e,y=c.useRef(null),v=c.useRef(null),f=c.useRef(null),[b,p]=c.useState(null),m=c.useRef(null),[E,_]=c.useState(0),[T,w]=c.useState(0),[S,O]=c.useState(0);c.useEffect(()=>{const R=y.current;if(!R)return;let C;try{C=Jo(t,n,r+T,o,S)}catch(A){console.error("[cairn] HDR tone-map error:",A);return}(R.width!==C.width||R.height!==C.height)&&(R.width=C.width,R.height=C.height);const M=R.getContext("2d");M&&(M.putImageData(C,0,0),m.current=C,_(A=>A+1),p(A=>A&&A.w===C.width&&A.h===C.height?A:{w:C.width,h:C.height}))},[t,n,r,o,T,S]);const L=c.useCallback((R,C,M)=>{const A=b;if(!A||R<0||C<0||R>=A.w||C>=A.h)return null;const k=t.shape.length===2?1:t.shape[2]??1,I=(C*A.w+R)*k,ne=t.data,K=m.current;let de=.5;if(K&&K.width===A.w&&K.height===A.h){const be=(C*A.w+R)*4;de=(.299*K.data[be]+.587*K.data[be+1]+.114*K.data[be+2])/255}const pe=k===1?[ne[I]??0]:[ne[I]??0,ne[I+1]??0,ne[I+2]??0];return qe(pe,"unit",M,de)},[t,b]),B=u==="auto"?void 0:u;return i.jsx(ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:g,paneRef:v,wrapperRef:f,zoom:l,pan:d,onViewportChange:h,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:a&&b?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:y,className:"w-full h-full object-contain block",style:{imageRendering:B}}),showAxes:a,overlay:{displayElRef:y,sample:L,version:E,hasSource:!0},notationSeed:x,exportCanvasRef:y,displayAdjust:{exposureEV:T,offset:S,onExposureChange:w,onOffsetChange:O},label:s,showLabelChip:!!s})}function $t(e){return Un(e)?i.jsx(ts,{...e}):i.jsx(es,{...e})}const Gn={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},ns="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function rs(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function os(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function ss(e,t){if(e==="no-hdr-display")switch(os(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=rs(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function as(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Vn(e,t){return`cairn-plot:capnotice:${e}:${t}`}const zn=new Set;function $n(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return zn.has(e)}function is(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}zn.add(e)}const Xn=new Set;let pt=null,et=null;function Wn(){et&&et.parentNode&&et.parentNode.removeChild(et),et=null,pt=null}function cs(e){const t=Vn(e,window.location.pathname),n=ss(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=as(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=ns,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const u=document.createElement("button");u.type="button",u.textContent="×",u.setAttribute("aria-label","Dismiss browser capability notice"),u.title="Dismiss",Object.assign(u.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),u.addEventListener("click",()=>{is(t),Wn()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(u),document.body.appendChild(r),et=r,pt=e}function Hn(e){if(typeof document>"u"||typeof window>"u"||Xn.has(e))return;Xn.add(e);const t=Vn(e,window.location.pathname);if($n(t))return;const n=()=>{if(!$n(t)){if(pt!==null)if(Gn[e]<Gn[pt])Wn();else return;cs(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const ls=["linear","srgb","reinhard","aces"];function us(e){return e&&ls.includes(e)?e:"srgb"}function ds(e){const{h:t,w:n,c:r}=Fn(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const u=s*r;let l,d,h,x=1;r===1?l=d=h=Te(o[u]):r===3?(l=Te(o[u]),d=Te(o[u+1]),h=Te(o[u+2])):(l=Te(o[u]),d=Te(o[u+1]),h=Te(o[u+2]),x=Te(o[u+3]));const g=s*4;a[g]=l,a[g+1]=d,a[g+2]=h,a[g+3]=x}return{data:a,width:n,height:t,format:"rgba32float"}}function Yn(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,u=(t.width-a)/2,l=(t.height-s)/2,d=Math.max(e.zoom,1e-6),h=t.width/(d*a),x=t.height/(d*s),g=-u/a-e.pan.x/(d*a),y=-l/s-e.pan.y/(d*s);return{x:g,y,w:h,h:x}}function Kn(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function fs(e){var Ee,De;const t=Un(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(!1),[u,l]=c.useState(!1),[d,h]=c.useState(!1),[x,g]=c.useState(null),[y,v]=c.useState(0),[f,b]=c.useState(0),[p,m]=c.useState({x:0,y:0,w:1,h:1}),E=c.useRef(null),_=c.useRef(null),[T,w]=c.useState(0),S=e.zoom??1,O=e.pan??{x:0,y:0},L=e.onViewportChange,B=t?"none":e.colormap??"none",[R,C]=c.useState(B);c.useEffect(()=>{C(B)},[B]);const M=t?"none":R,A=c.useRef(B),k=c.useCallback(()=>{C(A.current)},[]),[I,ne]=c.useState(0),[K,de]=c.useState(0),pe=It();c.useEffect(()=>{const U=n.current;if(!U)return;let G=!1;return ot().then(Y=>{var D;if(G)return;const X=((D=Y.probeExtendedToneMapping)==null?void 0:D.call(Y))??!1,Q=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,z=X&&Q&&t;s.current=z,t&&!z&&Hn(X?"no-hdr-display":"no-hdr-browser"),To(U,{hdr:z}).then(V=>{if(G){Pn(V);return}a.current=V,h(!0)}).catch(V=>{G||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",V),l(!0))})}).catch(Y=>{G||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",Y),l(!0))}),()=>{G=!0,a.current&&(Pn(a.current),a.current=null)}},[]),c.useEffect(()=>{const U=r.current;if(!U)return;const G=new ResizeObserver(()=>b(Y=>Y+1));return G.observe(U),()=>G.disconnect()},[]),c.useEffect(()=>{const U=r.current;if(!U)return;const G=new IntersectionObserver(Y=>{const X=Y[0];if(!X)return;const Q=a.current;Q&&(Q.setVisible(X.isIntersecting),X.isIntersecting?Q.isParked&&(Q.restore(),b(z=>z+1)):Q.park())},{threshold:0});return G.observe(U),()=>G.disconnect()},[]),c.useEffect(()=>{var Y;if(!t||!d)return;const U=e.hdr;E.current=U;const G=ds(U);(Y=a.current)==null||Y.setSource(G),g(X=>X&&X.w===G.width&&X.h===G.height?X:{w:G.width,h:G.height}),w(X=>X+1),v(X=>X+1)},[t,d,t?e.hdr:null]),c.useEffect(()=>{if(t||!d)return;const U=e,G=U.imageUrl,Y=R;if(!G){_.current=null,g(null),w(Q=>Q+1);return}let X=!1;return Ye(G).then(Q=>{var V,j;if(X||!Q)return;let z=Q;if(Y!=="none"){const J=`gpu::${G}::${Y}::ev${I}::off${K}`,W=Rt(J);if(W)z=W;else{const te=At(Y);z=Ct(Q,Y,te,I,K),kt(J,z)}}_.current=Q;const D={data:z.data,width:z.width,height:z.height,format:"rgba8unorm"};(V=a.current)==null||V.setSource(D),g(J=>J&&J.w===z.width&&J.h===z.height?J:{w:z.width,h:z.height}),(j=U.onNaturalSize)==null||j.call(U,z.width,z.height),w(J=>J+1),v(J=>J+1)}),()=>{X=!0}},[t,d,t?null:e.imageUrl,t?null:R,t?0:I,t?0:K]);const be=t?e.exposure??0:0,Me=t?e.tonemap:void 0,Le=t?e.gamma:void 0,he=c.useCallback(()=>{const U=a.current;if(!U||!d||!x)return;const G=r.current,Y=o.current,X=Y?Y.getBoundingClientRect():G?G.getBoundingClientRect():{width:x.w,height:x.h},Q=Yn({zoom:S,pan:O},X,x.w,x.h);m(j=>j.x===Q.x&&j.y===Q.y&&j.w===Q.w&&j.h===Q.h?j:Q),X.width>0&&X.height>0&&U.resize(Math.round(X.width*pe),Math.round(X.height*pe));const z=Kn(Q,X,x.w,x.h)>=Bt?"nearest":"linear",D=Q,V=t?{exposureEV:be+I,offset:K,operator:s.current?"extended":us(Me),gamma:Le,isScalar:!1,hdrOut:s.current,uv:D,filter:z}:{exposureEV:M!=="none"?0:I,offset:M!=="none"?0:K,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:D,filter:z};try{U.render(V)||l(!0)}catch(j){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",j),l(!0)}},[d,x,S,O.x,O.y,be,I,K,Me,Le,t,M,pe]);c.useEffect(()=>{he()},[he,y,f]);const ye=c.useCallback((U,G,Y)=>{if(t){const W=E.current,te=x;if(!W||!te||U<0||G<0||U>=te.w||G>=te.h)return null;const Ae=W.shape.length===2?1:W.shape[2]??1,Se=(G*te.w+U)*Ae,ie=W.data,Pe=.5,oe=Ae===1?[ie[Se]??0]:[ie[Se]??0,ie[Se+1]??0,ie[Se+2]??0];return qe(oe,"unit",Y,Pe)}const X=_.current;if(!X||U<0||G<0||U>=X.width||G>=X.height)return null;const Q=(G*X.width+U)*4,z=X.data[Q],D=X.data[Q+1],V=X.data[Q+2],j=(.299*z+.587*D+.114*V)/255;return qe(M!=="none"||z===D&&D===V?[z]:[z,D,V],"uint8",Y,j)},[t,x,M]),me=e.showAxes??!1,ve=t?e.label??"":e.label,q=e.interpolation??"auto",ge=q==="auto"?void 0:q,H=t?void 0:e.overlay,Z=t?void 0:e.overlaySettings,re=t?!1:e.isDraggable??!1,we=t?void 0:e.onDragStart;if(u)return t?i.jsx($t,{...e}):i.jsx($t,{...e});const xe=H&&(Z!=null&&Z.enabled)&&x&&((((Ee=H.boxes)==null?void 0:Ee.length)??0)>0||(((De=H.masks)==null?void 0:De.length)??0)>0)?i.jsx(Ot,{data:H,settings:Z,naturalWidth:x.w,naturalHeight:x.h}):void 0;return i.jsx(ft,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":d},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:S,pan:O,onViewportChange:L,naturalDims:x,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:me&&x?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:ge},"data-gpu-image-canvas":!0}),showAxes:me,overlayNode:xe,overlay:{displayElRef:n,sample:ye,version:T,hasSource:!0,sourceWindow:p},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:he,leadingMenus:t?void 0:[zt(M,U=>C(U))],displayAdjust:{exposureEV:I,offset:K,onExposureChange:ne,onOffsetChange:de},onReset:k,extraModified:R!==A.current,label:ve,showLabelChip:!!ve,isDraggable:re,onDragStart:we})}const ht=new Map;function Ge(e){if(ht.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);ht.set(e.id,e)}function Qe(e){return ht.get(e)}function ps(){return Array.from(ht.values())}function qn(e,t){return{...e.params??{},...t??{}}}const hs={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},gs={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},ms={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},xs={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},bs={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},vs={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Zn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];ys(Zn);const Xt=[1.052156925,1,.91835767],ws=.7;function ys(e){const[t,n,r]=e[0],[o,a,s]=e[1],[u,l,d]=e[2],h=a*d-s*l,x=-(o*d-s*u),g=o*l-a*u,v=1/(t*h+n*x+r*g);return[[h*v,-(n*d-r*l)*v,(n*s-r*a)*v],[x*v,(t*d-r*u)*v,-(t*s-r*o)*v],[g*v,-(t*l-n*u)*v,(t*a-n*o)*v]]}function Es(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Wt=6/29;function Ht(e){return e>Wt**3?Math.cbrt(e):e/(3*Wt*Wt)+4/29}function Qn(e,t,n){const[r,o,a]=Es(Zn,e,t,n),s=Ht(r*Xt[0]),u=Ht(o*Xt[1]),l=Ht(a*Xt[2]),d=116*u-16,h=500*(s-u),x=200*(u-l);return[d,.01*d*h,.01*d*x]}function _s(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Ms(){const e=Qn(0,1,0),t=Qn(0,0,1);return Math.pow(_s(e,t),ws)}const jn=Ms(),Ts=.082;function Jn(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),u=1/e,l=Math.PI**2,d=[0,0,0];for(let h=-s;h<=s;h++)for(let x=-s;x<=s;x++){const g=(x*u)**2+(h*u)**2;for(let y=0;y<3;y++)d[y]+=t[y]*Math.sqrt(Math.PI/n[y])*Math.exp(-l*g/n[y])+r[y]*Math.sqrt(Math.PI/o[y])*Math.exp(-l*g/o[y])}return{r:s,deltaX:u,sums:d}}function er(e){const t=.5*Ts*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let u=-n;u<=n;u++){const l=Math.exp(-(u*u+s*s)/(2*t*t)),d=-u*l,h=(u*u/(t*t)-1)*l;d>0&&(r+=d),h>0?o+=h:a-=h}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const Ss=`
${Ue}
${ut}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Ps=`
${Ue}
${ut}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,gt=`
${Ue}
${ut}
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
`,tr=`
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
`;function Xe(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function mt(e){return[Xe(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Xe(2,[e.sums[2],0,0,0])]}function nr(e){return[Xe(4,[jn,e.sd,e.r,e.edgeNorm]),Xe(5,[e.pointPos,e.pointNeg,0,0])]}function rr(e,t,n,r,o=""){const a=Jn(e),s=er(e),u=`ycxczA${o}`,l=`ycxczB${o}`,d=`labA${o}`,h=`labB${o}`,x=`flip${o}`;return{passes:[{name:u,shader:t,inputs:[n],output:u},{name:l,shader:t,inputs:[r],output:l},{name:d,shader:gt,inputs:[u],output:d,uniforms:()=>mt(a)},{name:h,shader:gt,inputs:[l],output:h,uniforms:()=>mt(a)},{name:x,shader:tr,inputs:[d,h,u,l],output:x,uniforms:()=>nr(s)}],flipRef:x}}const Cs={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=rr(t,Ss,"srcA","srcB");return{passes:n,final:r}}},As={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=rr(t,Ps,"srcA","srcB");return{passes:n,final:r}}},or=`
${Ue}
${ut}
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
`,Rs=`
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
`,ks={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=Jn(t),u=er(t),l=[];let d=null;for(let h=0;h<o;h++){const x=n+h*a,g=`_e${h}`,y=`ycxczA${g}`,v=`ycxczB${g}`,f=`labA${g}`,b=`labB${g}`,p=`acc${g}`;l.push({name:y,shader:or,inputs:["srcA"],output:y,uniforms:()=>[Xe(1,[x,0,0,0])]},{name:v,shader:or,inputs:["srcB"],output:v,uniforms:()=>[Xe(1,[x,0,0,0])]},{name:f,shader:gt,inputs:[y],output:f,uniforms:()=>mt(s)},{name:b,shader:gt,inputs:[v],output:b,uniforms:()=>mt(s)}),d===null?l.push({name:p,shader:tr,inputs:[f,b,y,v],output:p,uniforms:()=>nr(u)}):l.push({name:p,shader:Rs,inputs:[f,b,y,v,d],output:p,uniforms:()=>[Xe(5,[jn,u.sd,u.r,u.edgeNorm]),Xe(6,[u.pointPos,u.pointNeg,0,0])]}),d=p}return{passes:l,final:d}}};let sr=!1;function Ds(){sr||(sr=!0,Ge(gs),Ge(hs),Ge(ms),Ge(bs),Ge(xs),Ge(vs),Ge(Cs),Ge(ks),Ge(As))}Ds();function ar(){const e=[];for(const t of ps())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function Ls(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const ir=new WeakMap;function Yt(e,t,n,r){let o=ir.get(e);o||(o=new Map,ir.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Is(e){return`
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
`}const xt="rgba16float";function Os(e,t,n,r,o){var y,v;const a=Qe(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),u=Math.min(t.height,n.height),l=qn(a,o);if(a.kind==="pointwise"){const f=e.createTexture(s,u,xt),b=Yt(e,`pw:${a.id}`,Is(a.source),xt);let p;try{p=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(f,b,p)}finally{(y=p==null?void 0:p.destroy)==null||y.call(p)}return f}const d={width:s,height:u,params:l},h=a.buildPasses(d),x=new Map([["srcA",t],["srcB",n]]),g=[];try{for(const b of h.passes){const p=e.createTexture(s,u,xt);g.push(p),x.set(b.output,p);const m=Yt(e,`mp:${a.id}:${b.name}`,b.shader,xt),E=b.inputs.map((T,w)=>{const S=x.get(T);if(!S)throw new Error(`computeDiff: pass "${b.name}" input "${T}" not produced yet`);return{binding:w,resource:S}});b.uniforms&&E.push(...b.uniforms(d));let _;try{_=e.createBindGroup(m,E),e.renderFullscreen(p,m,_)}finally{(v=_==null?void 0:_.destroy)==null||v.call(_)}}const f=x.get(h.final);if(!f)throw new Error(`computeDiff: final ref "${h.final}" not produced`);for(const b of g)b!==f&&b.destroy();return f}catch(f){for(const b of g)b.destroy();throw f}}const Bs=8,Ns=256*1024*1024;class Us{constructor(t=Bs,n=Ns){ce(this,"map",new Map);ce(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const cr=new WeakMap;function lr(e){let t=cr.get(e);return t||(t=new Us,cr.set(e,t)),t}function Fs(e,t){const n=qn(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Gs(e,t,n,r){const o=Qe(n),a=o?Fs(o,r):"";return`${e}|${t}|${n}|${a}`}function Vs(e,t,n,r,o,a,s){const u=Qe(r);if(!u)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=lr(e),d=Gs(a,s,r,o),h=l.get(d);if(h)return h;const x=Os(e,t,n,r,o),g=Math.min(t.width,n.width),y=Math.min(t.height,n.height),v={texture:x,width:g,height:y,displayRange:u.displayRange,bytes:g*y*8};return l.set(d,v),v}async function zs(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=En(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function $s(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,lr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const Xs=`
${Ue}
${gn}
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
`,Ws={unit:0,signed:1,relative:2},Hs={linear:0,signed:1,positive:2};function Ys(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ks(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function qs(e,t,n,r,o){var g;const a=Ks(t),s=Yt(e,"diff-display",Xs,a),u=Ys(e,o.colormap),l=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([Ws[r],Hs[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),h=new Float32Array([o.exposureEV??0,o.offset??0,0,0]);let x;try{x=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:h}}]),e.renderFullscreen(t,s,x)}finally{(g=x==null?void 0:x.destroy)==null||g.call(x),u.destroy()}}const ur=.6*.6*2.51,Zs=.6*.03,Qs=0,dr=.6*.6*2.43,js=.6*.59,Js=.14;function fr(e){const t=(Zs-js*e)/(ur-dr*e),n=(Qs-Js*e)/(ur-dr*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const ea=.85,ta=.85,pr=11920928955078125e-23,Kt=[.2126,.7152,.0722];function na(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function ra(e,t,n,r=3,o={}){const a=t*n,s=fr(ea),u=fr(ta),l=new Float64Array(a);let d=0;for(let m=0;m<a;m++){const[E,_,T]=na(e,m,r),w=E*Kt[0]+_*Kt[1]+T*Kt[2];l[m]=w,w>d&&(d=w)}const h=Float64Array.from(l).sort(),x=a>>1,g=a%2===1?h[x]:h[x-1],y=Math.max(g,pr),v=Math.max(d,pr),f=o.startExposure??Math.log2(s/v),b=o.stopExposure??Math.log2(u/y),p=Math.max(2,Math.ceil(b-f));return{startExposure:f,stopExposure:b,numExposures:p}}const oa={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function sa({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:u,onViewportChange:l,processing:d=oa,interpolation:h="auto",label:x="",isDraggable:g=!1,onDragStart:y,overlay:v,overlaySettings:f,pixelValueNotation:b="decimal"}){var q,ge;const p=c.useRef(null),[m,E]=c.useState(null),[_,T]=c.useState(null),[w,S]=c.useState(b),[O,L]=c.useState(!1),B=c.useRef(null),R=c.useRef(null),C=c.useRef(null),M=c.useRef(null),[A,k]=c.useState(0);c.useEffect(()=>{if(!e){C.current=null,k(Z=>Z+1);return}let H=!1;return Ye(e).then(Z=>{H||(C.current=Z,k(re=>re+1))}),()=>{H=!0}},[e]),c.useEffect(()=>{if(!t){M.current=null,k(Z=>Z+1);return}let H=!1;return Ye(t).then(Z=>{H||(M.current=Z,k(re=>re+1))}),()=>{H=!0}},[t]);const I=H=>(Z,re,we)=>{const xe=H.current;if(!xe||Z<0||re<0||Z>=xe.width||re>=xe.height)return null;const Ee=(re*xe.width+Z)*4,De=xe.data[Ee],U=xe.data[Ee+1],G=xe.data[Ee+2],Y=(.299*De+.587*U+.114*G)/255;return De===U&&U===G?{lines:[Je(De,"uint8",we)],luminance:Y}:{lines:[Je(De,"uint8",we),Je(U,"uint8",we),Je(G,"uint8",we)],luminance:Y,colors:[lt[0],lt[1],lt[2]]}},ne=c.useMemo(()=>I(C),[]),K=c.useMemo(()=>I(M),[]),de=!!v&&!!(f!=null&&f.enabled)&&!!m&&!!e&&((((q=v.boxes)==null?void 0:q.length)??0)>0||(((ge=v.masks)==null?void 0:ge.length)??0)>0),{gammaFilterId:pe,filterStr:be,gamma:Me,offset:Le}=Cn(d),he=`translate(${u.x}px, ${u.y}px) scale(${s})`,ye=h==="auto"?void 0:h,{containerProps:me,modifierActive:ve}=fn({containerRef:p,zoom:s,pan:u,onViewportChange:l});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(An,{id:pe,gamma:Me,offset:Le}),i.jsxs("div",{ref:p,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...me.style},onPointerDown:me.onPointerDown,onPointerMove:me.onPointerMove,onPointerUp:me.onPointerUp,onPointerCancel:me.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:he,transformOrigin:"0 0"},children:[i.jsx("img",{ref:B,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:be,imageRendering:ye,...n==="blend"?{opacity:o}:{}},onLoad:H=>{const Z=H.currentTarget;E({w:Z.naturalWidth,h:Z.naturalHeight})}}),de&&i.jsx(Ot,{data:v,settings:f,naturalWidth:m.w,naturalHeight:m.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:he,transformOrigin:"0 0"},children:i.jsx("img",{ref:R,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:be,imageRendering:ye,...n==="blend"?{opacity:1-o}:{}},onLoad:H=>{const Z=H.currentTarget;T({w:Z.naturalWidth,h:Z.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:H=>{H.stopPropagation(),H.preventDefault();const re=H.currentTarget.parentElement.getBoundingClientRect(),we=Ee=>{a==null||a(Math.max(0,Math.min(1,(Ee.clientX-re.left)/re.width)))},xe=()=>{window.removeEventListener("pointermove",we),window.removeEventListener("pointerup",xe)};window.addEventListener("pointermove",we),window.addEventListener("pointerup",xe)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&_&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:R,naturalWidth:_.w,naturalHeight:_.h,zoom:s,pan:u,sample:K,notation:w,version:A})}),e&&m&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Ze,{imageElRef:B,naturalWidth:m.w,naturalHeight:m.h,zoom:s,pan:u,sample:ne,notation:w,version:A,onActiveChange:L})})]}):e&&m&&i.jsx(Ze,{imageElRef:B,naturalWidth:m.w,naturalHeight:m.h,zoom:s,pan:u,sample:ne,notation:w,version:A,onActiveChange:L}),O&&i.jsx(hn,{notation:w,onChange:S})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${g&&!ve?" cairn-drag-grip":""}`,draggable:g&&!ve,onDragStart:y,style:{cursor:g&&!ve?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),x]})]})}function aa(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function ia({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:d=>{d==="side"?s==null||s():d==="slide"?r():d==="blend"?o():a(d)}}}}function ca(e){const t=Mt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function la(e){const{data:t,width:n,height:r,channels:o}=e,a=n*r,s=new Float32Array(a*4),u=l=>Number.isFinite(l)?l:0;for(let l=0;l<a;l++){const d=l*o;let h,x,g,y=1;o===1?h=x=g=u(t[d]):o===3?(h=u(t[d]),x=u(t[d+1]),g=u(t[d+2])):(h=u(t[d]),x=u(t[d+1]),g=u(t[d+2]),y=u(t[d+3]));const v=l*4;s[v]=h,s[v+1]=x,s[v+2]=g,s[v+3]=y}return s}function ua({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,diffSubmode:l,colormap:d="none",diffKernel:h,onDiffKernelChange:x,onCompareModeChange:g,onRequestSide:y,zoom:v,pan:f,onViewportChange:b,interpolation:p="auto",label:m="",pixelValueNotation:E="decimal"}){var mr;const _=c.useRef(null),T=c.useRef(null),w=c.useRef(null),S=c.useRef(null),O=c.useRef(null),[L,B]=c.useState(!1),[R,C]=c.useState(!1),[M,A]=c.useState(null),[k,I]=c.useState(0),[ne,K]=c.useState(0),[de,pe]=c.useState(null),[be,Me]=c.useState({x:0,y:0,w:1,h:1}),Le=h??l??"absolute",[he,ye,me]=ct(Le);c.useEffect(()=>{ye(h??l??"absolute")},[h,l,ye]);const ve=c.useCallback(P=>{ye(P),x==null||x(P)},[x,ye]);c.useEffect(()=>{const P=_.current;if(P)return P.__cairnDiffKernel={current:he,set:ve},()=>{P&&delete P.__cairnDiffKernel}},[he,ve]);const[q,ge,H]=ct(o);c.useEffect(()=>{ge(o)},[o,ge]);const Z=c.useCallback(P=>{ge(P),g==null||g(P)},[g,ge]),[re,we,xe]=ct(d);c.useEffect(()=>{we(d)},[d,we]);const Ee=c.useCallback(()=>{Z(H.default),we(xe.default),ve(me.default)},[Z,we,ve,H.default,xe.default,me.default]),De=H.isModified||xe.isModified||me.isModified,[U,G]=c.useState(0),[Y,X]=c.useState(0),Q=c.useMemo(()=>{const se=[ia({mode:q,kernel:he,kernelOptions:ar().map(F=>({id:F.id,label:F.label})),onSide:y,onSlide:()=>Z("split"),onBlend:()=>Z("blend"),onKernel:F=>{Z("diff"),ve(F)}})];return q==="diff"&&se.push(zt(re,F=>we(F))),se},[q,he,re,ve,Z,y]),z=c.useRef(null),D=c.useRef(null),V=c.useRef(null),j=c.useRef(null),[J,W]=c.useState(0),te=c.useRef(null),[Ae,Se]=c.useState(0),ie=It();c.useEffect(()=>{const P=w.current;if(!P)return;let se=!1;return ot().then(F=>{if(!se)try{if(_n())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const N=F.createSurface(P,{hdr:!1});S.current={device:F,surface:N,texA:null,texB:null},C(!0)}catch(N){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",N),B(!0)}}).catch(F=>{se||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",F),B(!0))}),()=>{var N,ee;se=!0;const F=S.current;F&&((N=F.texA)==null||N.destroy(),(ee=F.texB)==null||ee.destroy(),S.current=null)}},[]),c.useEffect(()=>{const P=_.current;if(!P)return;const se=new ResizeObserver(()=>K(F=>F+1));return se.observe(P),()=>se.disconnect()},[]),c.useEffect(()=>{if(!R)return;let P=!1;if(!S.current)return;async function F(N,ee){if(ee){const ue=la(ee);return{width:ee.width,height:ee.height,imageData:null,make:ae=>{const _e=ae.createTexture(ee.width,ee.height,"rgba32float");return _e.write(ue),_e}}}if(!N)return null;const le=await Ye(N);return le?{width:le.width,height:le.height,imageData:le,make:ue=>{const ae=ue.createTexture(le.width,le.height,"rgba8unorm");return ae.write(le.data),ae}}:null}return Promise.all([F(e,n),F(t,r)]).then(([N,ee])=>{var ae,_e;if(P||!S.current)return;const le=S.current;z.current=(N==null?void 0:N.imageData)??null,D.current=(ee==null?void 0:ee.imageData)??null,V.current=n??null,j.current=r??null,(ae=le.texA)==null||ae.destroy(),(_e=le.texB)==null||_e.destroy(),le.texA=null,le.texB=null;const ue=N??ee;if(!ue){A(null),W(ke=>ke+1);return}le.texA=(ee??ue).make(le.device),le.texB=(N??ue).make(le.device),A({w:ue.width,h:ue.height}),W(ke=>ke+1),I(ke=>ke+1)}),()=>{P=!0}},[R,e,t,n,r]);const Pe=n!=null||r!=null,oe=c.useMemo(()=>Ls(he,Pe),[he,Pe]),Re=c.useMemo(()=>{if(!Pe)return null;const P=r??n;return P?ra(P.data,P.width,P.height,P.channels):null},[Pe,r,n]),je=c.useMemo(()=>{var P;return Ur(((P=Qe(oe))==null?void 0:P.displayRange)??"unit",re==="none"?null:re)},[oe,re]),We=c.useMemo(()=>re!=="none"?ca(re):void 0,[re]),Ie=c.useCallback(()=>{const P=S.current;if(!R||!P||!P.surface||!P.texA||!P.texB||!M)return;const se=_.current,F=se?se.getBoundingClientRect():{width:M.w,height:M.h},N=Yn({zoom:v,pan:f},F,M.w,M.h);Me(ae=>ae.x===N.x&&ae.y===N.y&&ae.w===N.w&&ae.h===N.h?ae:N);const ee=w.current;if(F.width>0&&F.height>0&&ee&&P.surface){const ae=Math.max(1,Math.round(F.width*ie)),_e=Math.max(1,Math.round(F.height*ie));(ee.width!==ae||ee.height!==_e)&&(ee.width=ae,ee.height=_e,P.surface.configure(ae,_e))}const le=Kn(N,F,M.w,M.h)>=Bt?"nearest":"linear",ue=N;try{if(q==="diff"){const ae=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",_e=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ke=Qe(oe)?oe:"absolute",He=ke==="hdr-flip"&&Re?{ppd:67,startExposure:Re.startExposure,stopExposure:Re.stopExposure,numExposures:Re.numExposures}:void 0,nt=Vs(P.device,P.texA,P.texB,ke,He,ae,_e);O.current=nt,qs(P.device,P.surface,nt.texture,nt.displayRange,{uv:ue,cmapMode:je,colormap:We,filter:le,exposureEV:U,offset:Y})}else{const ae={exposureEV:U,offset:Y,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ue,filter:le,mode:q,split:a,alpha:s};wo(P.device,P.surface,P.texA,P.texB,ae)}}catch(ae){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ae),B(!0)}},[R,M,v,f.x,f.y,q,a,s,U,Y,he,oe,Re,je,We,e,t,n,r,ie]);c.useEffect(()=>{Ie()},[Ie,k,ne]);const bt=t!=null||r!=null;c.useEffect(()=>{const P=S.current;if(!R||!P||!P.texA||!P.texB||!bt){pe(null);return}let se=!1;const F=P.texA,N=P.texB,ee=O.current;return(q==="diff"&&ee?zs(P.device,ee,F,N):En(P.device,F,N)).then(ue=>{se||pe(ue)}),()=>{se=!0}},[R,k,bt,q,he]),c.useEffect(()=>{if(q!=="diff"){te.current=null;return}const P=S.current,se=O.current;if(!R||!P||!se)return;let F=!1;return te.current=null,Se(N=>N+1),$s(P.device,se).then(N=>{F||(te.current=N,Se(ee=>ee+1))}).catch(()=>{}),()=>{F=!0}},[R,q,oe,k]);const hr=(P,se)=>(F,N,ee)=>{const le=se.current;if(le){const{data:vt,width:xr,height:xa,channels:br}=le;if(F<0||N<0||F>=xr||N>=xa)return null;const wt=(N*xr+F)*br,ba=.5,va=br===1?[vt[wt]??0]:[vt[wt]??0,vt[wt+1]??0,vt[wt+2]??0];return qe(va,"unit",ee,ba)}const ue=P.current;if(!ue||F<0||N<0||F>=ue.width||N>=ue.height)return null;const ae=(N*ue.width+F)*4,_e=ue.data[ae],ke=ue.data[ae+1],He=ue.data[ae+2],nt=(.299*_e+.587*ke+.114*He)/255;return qe(_e===ke&&ke===He?[_e]:[_e,ke,He],"uint8",ee,nt)},gr=c.useMemo(()=>hr(z,V),[]),pa=c.useMemo(()=>hr(D,j),[]),ha=c.useMemo(()=>(P,se,F)=>{var He;const N=te.current;if(!N||!M)return null;const{w:ee,h:le}=M;if(P<0||se<0||P>=ee||se>=le)return null;const ue=(se*ee+P)*4,ae=((He=Qe(oe))==null?void 0:He.output)??"per-channel",_e=.5,ke=ae==="scalar"?[N[ue]??0]:[N[ue]??0,N[ue+1]??0,N[ue+2]??0];return qe(ke,"unit",F,_e)},[M,oe]),ga=p==="auto"?void 0:p;if(L)return n!=null||r!=null?i.jsx(aa,{}):q==="diff"?i.jsx($t,{imageUrl:e,baselineUrl:t,diffMode:((mr=Qe(oe))==null?void 0:mr.kind)==="pointwise"?oe:"absolute",interpolation:p,colormap:re,showAxes:!1,zoom:v,pan:f,onViewportChange:b,label:m,pixelValueNotation:E}):i.jsx(sa,{imageUrl:e,baselineUrl:t,mode:q,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,zoom:v,pan:f,onViewportChange:b,interpolation:p,label:m,pixelValueNotation:E});const ma=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:w,className:"w-full h-full block",style:{imageRendering:ga},"data-gpu-compare-canvas":!0}),q==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:P=>{P.stopPropagation(),u==null||u(.5)},onPointerDown:P=>{P.stopPropagation(),P.preventDefault();const F=P.currentTarget.parentElement.getBoundingClientRect(),N=le=>{u==null||u(Math.max(0,Math.min(1,(le.clientX-F.left)/F.width)))},ee=()=>{window.removeEventListener("pointermove",N),window.removeEventListener("pointerup",ee)};window.addEventListener("pointermove",N),window.addEventListener("pointerup",ee)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(ft,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":R},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:_,wrapperRef:T,zoom:v,pan:f,onViewportChange:b,naturalDims:M,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:ma,showAxes:!1,notationSeed:E,onReset:Ee,extraModified:De,exportCanvasRef:w,requestRender:Ie,leadingMenus:Q,displayAdjust:{exposureEV:U,offset:Y,onExposureChange:G,onOffsetChange:X},label:"",showLabelChip:!1,overlay:{render:({notation:P,setOverlayActive:se})=>q==="split"?i.jsxs(i.Fragment,{children:[bt&&M&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:w,naturalWidth:M.w,naturalHeight:M.h,zoom:v,pan:f,sourceWindow:be,sample:pa,notation:P,version:J})}),bt&&M&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(Ze,{imageElRef:w,naturalWidth:M.w,naturalHeight:M.h,zoom:v,pan:f,sourceWindow:be,sample:gr,notation:P,version:J,onActiveChange:se})})]}):M&&i.jsx(Ze,{imageElRef:w,naturalWidth:M.w,naturalHeight:M.h,zoom:v,pan:f,sourceWindow:be,sample:q==="diff"?ha:gr,notation:P,version:q==="diff"?Ae:J,onActiveChange:se})},extraChips:i.jsxs(i.Fragment,{children:[q==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),m?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:m}):null,de&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${m?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",de.mse.toExponential(2)," · PSNR ",Number.isFinite(de.psnr)?de.psnr.toFixed(1):"∞"," dB · MAE"," ",de.mae.toExponential(2)]})]})})}const da="cairn-plot:gpu-image-ready";async function fa(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await ot(),window.__cairnPlotGpuImagePane=fs,window.__cairnPlotGpuComparePane=ua,window.__cairnPlotDiffMenuModes=ar(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(da))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Hn("no-webgpu")}}}fa()})(__cairnPlotJsxRuntime,__cairnPlotReact);
