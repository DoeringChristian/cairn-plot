var Ba=Object.defineProperty;var Na=(i,u,Ve)=>u in i?Ba(i,u,{enumerable:!0,configurable:!0,writable:!0,value:Ve}):i[u]=Ve;var de=(i,u,Ve)=>Na(i,typeof u!="symbol"?u+"":u,Ve);(function(i,u){"use strict";const Ve=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Jt(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Ve}),{hdr:!1,format:n}}function Cr(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Ve}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Ve}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Jt(e,t)}}}const Ar=`
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
`;function _t(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function en(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Rr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const kr={texture:0,sampler:1,uniform:2};function Mt(e,t){return e*3+kr[t]}const Dr={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Lr(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const d=Dr[s];if(d===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:d})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class tn{constructor(t,n,r,o){de(this,"width");de(this,"height");de(this,"format");de(this,"gpuTexture");de(this,"device");de(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:_t(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*en(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class nn{constructor(t){de(this,"_s");de(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Ir{constructor(t,n,r,o,a){de(this,"_p");de(this,"gpuPipeline");de(this,"bindings");de(this,"bindGroupLayout");de(this,"variants");de(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Or(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Br{constructor(t){de(this,"_c");de(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Nr{constructor(t,n){de(this,"_b");de(this,"gpuBindGroup");de(this,"ownedBuffers");de(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Ur{constructor(t,n,r,o){de(this,"canvas");de(this,"hdr");de(this,"format");de(this,"context");de(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function rt(e){return"canvas"in e}async function Fr(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(f){return rt(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function s(f){if(rt(f))return{width:f.canvas.width,height:f.canvas.height};const x=f;return{width:x.width,height:x.height}}let d=!1,l=null;function c(){var x,g;if(l!==null)return l;let f=!1;try{if(typeof document<"u"){const b=document.createElement("canvas");b.width=1,b.height=1;const _=b.getContext("webgpu");if(_)try{_.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const M=(x=_.getConfiguration)==null?void 0:x.call(_);f=((g=M==null?void 0:M.toneMapping)==null?void 0:g.mode)==="extended"}catch{f=!1}finally{try{_.unconfigure()}catch{}}}}catch{f=!1}return l=f,f}const p=256;let m=null,h=null;function v(){if(!m||!h){const f=t.createShaderModule({code:Ar});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const x=t.createPipelineLayout({bindGroupLayouts:[h]});m=t.createComputePipeline({layout:x,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:m,layout:h}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:c,createTexture(f,x,g){return new tn(t,f,x,g)},createSampler(f){const x=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",g=t.createSampler({magFilter:x,minFilter:x,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new nn(g)},createRenderPipeline(f){const x=t.createShaderModule({code:f.shaderWGSL}),g=Lr(f.shaderWGSL),b=_t(f.targetFormat),_=Or(t,g),M=t.createPipelineLayout({bindGroupLayouts:[_]}),P=A=>t.createRenderPipeline({layout:M,vertex:{module:x,entryPoint:"vs_main"},fragment:{module:x,entryPoint:"fs_main",targets:[{format:A}]},primitive:{topology:"triangle-list"}}),y=P(b);return new Ir(y,g,_,b,P)},createComputePipeline(f){const x=t.createShaderModule({code:f.shaderWGSL}),g=t.createComputePipeline({layout:"auto",compute:{module:x,entryPoint:"cs_main"}});return new Br(g)},createBindGroup(f,x){const g=f,b=new Map,_=[];for(const[P,y]of g.bindings)if(y.kind==="uniform"){const A=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});_.push(A),b.set(P,{binding:P,resource:{buffer:A}})}else y.kind==="sampler"&&b.set(P,{binding:P,resource:o()});for(const P of x){const y=P.resource;if(y instanceof tn){const A=Mt(P.binding,"texture");g.bindings.has(A)&&b.set(A,{binding:A,resource:y.gpuTexture.createView()})}else if(y instanceof nn){const A=Mt(P.binding,"sampler");g.bindings.has(A)&&b.set(A,{binding:A,resource:y.gpuSampler})}else{const A=Mt(P.binding,"uniform"),S=g.bindings.get(A);if(S&&S.kind==="uniform"){const D=y.uniform,k=t.createBuffer({size:Math.max(S.sizeBytes,D.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(k,0,D.buffer,D.byteOffset,D.byteLength),_.push(k),b.set(A,{binding:A,resource:{buffer:k}})}}}const M=t.createBindGroup({layout:g.bindGroupLayout,entries:Array.from(b.values())});return new Nr(M,_)},createSurface(f,x){const g=f.getContext("webgpu");if(!g)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const b=x.hdr&&n.hdr,_=()=>b?Cr(g,t):Jt(g,t),M=_();return new Ur(f,g,M,_)},renderFullscreen(f,x,g){const b=x,_=g,M=a(f),{width:P,height:y}=s(f),A=rt(f)?f.format:_t(f.format),S=b.pipelineFor(A),D=t.createCommandEncoder(),k=D.beginRenderPass({colorAttachments:[{view:M,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});k.setPipeline(S),k.setBindGroup(0,_.gpuBindGroup),k.setViewport(0,0,P,y,0,1),k.draw(3),k.end(),t.queue.submit([D.finish()])},async readback(f){const x=rt(f),{width:g,height:b}=s(f),_=x?f.hdr?"rgba16float":"rgba8unorm":f.format,M=x&&f.format==="bgra8unorm",P=x?f.getCurrentGPUTexture():f.gpuTexture,y=en(_),A=g*y,S=256,D=Math.ceil(A/S)*S,k=D*b,T=t.createBuffer({size:k,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),C=t.createCommandEncoder();C.copyTextureToBuffer({texture:P},{buffer:T,bytesPerRow:D,rowsPerImage:b},{width:g,height:b,depthOrArrayLayers:1}),t.queue.submit([C.finish()]),await T.mapAsync(GPUMapMode.READ);const E=new Uint8Array(T.getMappedRange()),L=new Uint8Array(A*b);for(let I=0;I<b;I++){const O=I*D,K=I*A;L.set(E.subarray(O,O+A),K)}if(T.unmap(),T.destroy(),_==="rgba8unorm"){if(M)for(let I=0;I<L.length;I+=4){const O=L[I],K=L[I+2];L[I]=K,L[I+2]=O}return L}if(_==="rgba16float"){const I=new Uint16Array(L.buffer,L.byteOffset,L.byteLength/2),O=new Float32Array(I.length);for(let K=0;K<I.length;K++)O[K]=Rr(I[K]);return O}return new Float32Array(L.buffer,L.byteOffset,L.byteLength/4)},async reduceDiffSumSquaredAbs(f,x,g,b){const _=f,M=x,P=Math.max(0,g*b),y=Math.max(1,Math.ceil(P/p)),{pipeline:A,layout:S}=v(),D=y*2*4,k=t.createBuffer({size:D,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),T=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(T,0,new Uint32Array([Math.max(1,g),Math.max(1,b),P,0]));const C=t.createBindGroup({layout:S,entries:[{binding:0,resource:_.gpuTexture.createView()},{binding:1,resource:M.gpuTexture.createView()},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:T}}]}),E=t.createBuffer({size:D,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),L=t.createCommandEncoder(),I=L.beginComputePass();I.setPipeline(A),I.setBindGroup(0,C),I.dispatchWorkgroups(y),I.end(),L.copyBufferToBuffer(k,0,E,0,D),t.queue.submit([L.finish()]),await E.mapAsync(GPUMapMode.READ);const K=new Float32Array(E.getMappedRange()).slice();E.unmap(),E.destroy(),k.destroy(),T.destroy();let Z=0,oe=0;for(let ae=0;ae<y;ae++)Z+=K[ae*2],oe+=K[ae*2+1];return{sumSq:Z,sumAbs:oe}},destroy(){d||(t.destroy(),d=!0)},isContextLost(){return!1}}}let Tt=null;async function Gr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Fr()}function ot(){return Tt||(Tt=Gr()),Tt}function zr(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Vr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),d=o-a,[l,c,p]=zr(e[a],e[s],d);t[n*3]=Math.round(l),t[n*3+1]=Math.round(c),t[n*3+2]=Math.round(p)}return t}const rn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},$r=new Set(["red-green","red-blue"]),on=new Map;function St(e){let t=on.get(e);if(!t){const n=rn[e]??rn.viridis;t=Vr(n),on.set(e,t)}return t}const Be=e=>e<0?0:e>1?1:e,Pt=e=>{const t=e<0?0:e;return t/(1+t)},Ct=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Be(n/r)},sn={linear:([e,t,n])=>[Be(e),Be(t),Be(n)],srgb:([e,t,n])=>[Be(e),Be(t),Be(n)],reinhard:([e,t,n])=>[Pt(e),Pt(t),Pt(n)],aces:([e,t,n])=>[Ct(e),Ct(t),Ct(n)],extended:([e,t,n])=>[e,t,n]},Xr="srgb";function Wr(e){return e&&sn[e]||sn[Xr]}function st(e,t,n){return e*2**t+n}function Hr(e){const t=Be(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function At(e,t){return typeof t=="number"&&t>0?Be(Math.pow(Be(e),1/t)):Hr(e)}function Rt(e,t,n="linear",r=0,o=0){const a=St(t),s=new ImageData(e.width,e.height),d=e.data,l=s.data,c=r!==0||o!==0;for(let p=0;p<d.length;p+=4){let m=(d[p]+d[p+1]+d[p+2])/3;c&&(m=Math.max(0,Math.min(255,st(m/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+m/255*127):h=Math.round(m),h=Math.max(0,Math.min(255,h)),l[p]=a[h*3],l[p+1]=a[h*3+1],l[p+2]=a[h*3+2],l[p+3]=d[p+3]}return s}function Yr(e,t){return e==="signed"||e==="relative"?"signed":kt(t)}function kt(e){return $r.has(e??"")?"positive":"linear"}function an(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const cn=an(50);function Dt(e){return cn.get(e)}function Lt(e,t){cn.set(e,t)}const ln=an(100);function Kr(e){return ln.get(e)}function qr(e,t){ln.set(e,t)}function Zr(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let d=0;d<r;d++){const l=(s*e.width+d)*4,c=(s*t.width+d)*4,p=(s*r+d)*4;for(let m=0;m<3;m++){const h=e.data[l+m],v=t.data[c+m],w=h-v,f=Math.abs(w),x=Math.max(h,1);let g;switch(n){case"signed":g=(w+255)/2;break;case"absolute":g=f;break;case"squared":g=w*w/255;break;case"relative_signed":g=(w/x+1)*127.5;break;case"relative_absolute":g=f/x*255;break;case"relative_squared":g=w*w/(x*x)*255;break}a.data[p+m]=Math.min(255,Math.max(0,Math.round(g)))}a.data[p+3]=255}return a}async function Ke(e){const t=Kr(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);qr(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Qr={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},jr={linear:0,signed:1,positive:2},Jr=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,eo=`#version 300 es
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
}`;let qe=null,$=null,Re=null,at=null;function to(){if($)return $;try{if(typeof OffscreenCanvas<"u"?qe=new OffscreenCanvas(1,1):qe=document.createElement("canvas"),$=qe.getContext("webgl2",{preserveDrawingBuffer:!0}),!$)return console.warn("[cairn] WebGL 2 not available"),null;const e=$.createShader($.VERTEX_SHADER);if($.shaderSource(e,Jr),$.compileShader(e),!$.getShaderParameter(e,$.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",$.getShaderInfoLog(e)),null;const t=$.createShader($.FRAGMENT_SHADER);if($.shaderSource(t,eo),$.compileShader(t),!$.getShaderParameter(t,$.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",$.getShaderInfoLog(t)),null;if(Re=$.createProgram(),$.attachShader(Re,e),$.attachShader(Re,t),$.linkProgram(Re),!$.getProgramParameter(Re,$.LINK_STATUS))return console.error("[cairn] WebGL program link:",$.getProgramInfoLog(Re)),null;at=$.createVertexArray(),$.bindVertexArray(at);const n=$.createBuffer();$.bindBuffer($.ARRAY_BUFFER,n),$.bufferData($.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),$.STATIC_DRAW);const r=$.getAttribLocation(Re,"a_pos");return $.enableVertexAttribArray(r),$.vertexAttribPointer(r,2,$.FLOAT,!1,0,0),$.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),$}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function un(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function no(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function ro(e,t,n,r){const o=to();if(!o||!Re||!at||!qe)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);qe.width=a,qe.height=s,o.viewport(0,0,a,s);const d=un(o,e,0),l=un(o,t,1);let c=null;n.colormap?c=no(o,n.colormap,2):(c=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,c),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Re),o.uniform1i(o.getUniformLocation(Re,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Re,"u_other"),1),o.uniform1i(o.getUniformLocation(Re,"u_lut"),2),o.uniform1i(o.getUniformLocation(Re,"u_diff_mode"),Qr[n.diffMode]),o.uniform1i(o.getUniformLocation(Re,"u_cmap_mode"),jr[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Re,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(at),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(qe,0,0,a,s,0,-s,a,s),p.restore()),o.deleteTexture(d),o.deleteTexture(l),o.deleteTexture(c),{width:a,height:s}}const oo="cairn:render-mode";function so(){try{const e=localStorage.getItem(oo);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const it=15360;function ct(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const dn=globalThis.Float16Array;function fn(e,t=e.length){if(dn){const r=new dn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=ct(e[r]);return n}const Ne=new Uint32Array(512),Ue=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ne[e]=0,Ne[e|256]=32768,Ue[e]=24,Ue[e|256]=24):t<-14?(Ne[e]=1024>>-t-14,Ne[e|256]=1024>>-t-14|32768,Ue[e]=-t-1,Ue[e|256]=-t-1):t<=15?(Ne[e]=t+15<<10,Ne[e|256]=t+15<<10|32768,Ue[e]=13,Ue[e|256]=13):t<128?(Ne[e]=31744,Ne[e|256]=64512,Ue[e]=24,Ue[e|256]=24):(Ne[e]=31744,Ne[e|256]=64512,Ue[e]=13,Ue[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var tt=Uint8Array,pn=Uint16Array,ao=Int32Array,io=new tt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),co=new tt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),hn=function(e,t){for(var n=new pn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new ao(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},gn=hn(io,2),lo=gn.b,uo=gn.r;lo[28]=258,uo[258]=28,hn(co,0);for(var fo=new pn(32768),pe=0;pe<32768;++pe){var $e=(pe&43690)>>1|(pe&21845)<<1;$e=($e&52428)>>2|($e&13107)<<2,$e=($e&61680)>>4|($e&3855)<<4,fo[pe]=(($e&65280)>>8|($e&255)<<8)>>1}for(var lt=new tt(288),pe=0;pe<144;++pe)lt[pe]=8;for(var pe=144;pe<256;++pe)lt[pe]=9;for(var pe=256;pe<280;++pe)lt[pe]=7;for(var pe=280;pe<288;++pe)lt[pe]=8;for(var po=new tt(32),pe=0;pe<32;++pe)po[pe]=5;var ho=new tt(0),go=typeof TextDecoder<"u"&&new TextDecoder,mo=0;try{go.decode(ho,{stream:!0}),mo=1}catch{}typeof FinalizationRegistry>"u"||new FinalizationRegistry(e=>xo.__wbg_decodedimage_free(e,1));let mn=new Array(1024).fill(void 0);mn.push(void 0,null,!0,!1),mn.length,new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}).decode();let xo;const xn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function It(e){const t=xn.length;return xn[(e%t+t)%t]}function bo(e){const n=u.useRef(null),[r,o]=u.useState({w:0,h:0}),a=u.useRef(null),s=u.useRef(null),d=u.useRef(null),l=u.useCallback((c,p)=>{o(m=>m.w===c&&m.h===p?m:{w:c,h:p})},[]);return u.useLayoutEffect(()=>{const c=n.current;if(!c||c===d.current)return;const p=c.getBoundingClientRect();(p.width>0||p.height>0)&&(d.current=c,l(p.width,p.height))}),u.useEffect(()=>{var m;const c=n.current;if(c===s.current||((m=a.current)==null||m.disconnect(),a.current=null,s.current=c,!c))return;const p=new ResizeObserver(h=>{for(const v of h)l(v.contentRect.width,v.contentRect.height)});a.current=p,p.observe(c)}),u.useEffect(()=>()=>{var c;return(c=a.current)==null?void 0:c.disconnect()},[]),{ref:n,size:r}}function vo(){const[e,t]=u.useState(!1);return u.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const wo=.001;function yo(e,t=wo){return Math.exp(-e*t)}function bn(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function vn(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Eo(e,t,n,r,o,a,s){const d=t>0&&r>0?r/t:1,l=Math.max(a,Math.min(s,e.zoom*d)),c=(n.x-e.pan.x)/e.zoom,p=(n.y-e.pan.y)/e.zoom;return{zoom:l,pan:{x:o.x-c*l,y:o.y-p*l}}}const _o=.25,Ot=64;function Bt(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Ot;const o=Math.min(n/e,r/t);return o<=0?Ot:Math.max(Math.max(n,r)/o,8)}function wn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=_o,maxZoom:s=Ot,naturalWidth:d,naturalHeight:l}=e,c=vo(),p=u.useRef(c);p.current=c;const m=u.useRef({zoom:n,pan:r});m.current={zoom:n,pan:r};const h=u.useRef(o);h.current=o,u.useEffect(()=>{const S=t.current;if(!S||!o)return;const D=k=>{var ae;if(!k.ctrlKey&&!p.current)return;k.preventDefault(),k.stopPropagation();const T=yo(k.deltaY),C=m.current,E=S.getBoundingClientRect(),L=d&&l?Bt(d,l,E.width,E.height):s,I=Math.max(a,Math.min(L,C.zoom*T));if(C.zoom===I)return;const O=k.clientX-E.left,K=k.clientY-E.top,Z=O-(O-C.pan.x)/C.zoom*I,oe=K-(K-C.pan.y)/C.zoom*I;(ae=h.current)==null||ae.call(h,{zoom:I,pan:{x:Z,y:oe}})};return S.addEventListener("wheel",D,{passive:!1}),()=>S.removeEventListener("wheel",D)},[t,!!o,a,s,d,l]);const v=u.useRef(new Map),w=u.useRef(null),f=u.useRef(null),x=u.useCallback((S,D,k)=>{const T=S.getBoundingClientRect();return{x:D-T.left,y:k-T.top}},[]),g=u.useCallback(S=>{if(!d||!l)return s;const D=S.getBoundingClientRect();return Bt(d,l,D.width,D.height)},[d,l,s]),b=u.useCallback((S,D)=>{const k=v.current,T=k.get(S),C=k.get(D);!T||!C||(w.current=null,f.current={idA:S,idB:D,startDist:bn(T,C),startMid:vn(T,C),startZoom:m.current.zoom,startPan:{...m.current.pan}})},[]),_=u.useCallback(S=>{const D=v.current.get(S);D&&(w.current={pointerId:S,startX:D.x,startY:D.y,panX:m.current.pan.x,panY:m.current.pan.y})},[]),M=u.useCallback(S=>{if(!h.current)return;const D=S.pointerType==="touch";if(!D&&!p.current)return;const k=S.currentTarget;if(k.setPointerCapture(S.pointerId),v.current.set(S.pointerId,x(k,S.clientX,S.clientY)),D&&v.current.size>=2){const T=[...v.current.keys()];b(T[T.length-2],T[T.length-1]);return}_(S.pointerId)},[x,b,_]),P=u.useCallback(S=>{var E,L;const D=S.currentTarget,k=v.current.get(S.pointerId);if(k){const I=x(D,S.clientX,S.clientY);k.x=I.x,k.y=I.y}const T=f.current;if(T){const I=v.current.get(T.idA),O=v.current.get(T.idB);if(!I||!O)return;const K=Eo({zoom:T.startZoom,pan:T.startPan},T.startDist,T.startMid,bn(I,O),vn(I,O),a,g(D));(E=h.current)==null||E.call(h,K);return}const C=w.current;!C||C.pointerId!==S.pointerId||!k||(L=h.current)==null||L.call(h,{zoom:m.current.zoom,pan:{x:C.panX+(k.x-C.startX),y:C.panY+(k.y-C.startY)}})},[x,a,g]),y=u.useCallback(S=>{var k;try{S.currentTarget.releasePointerCapture(S.pointerId)}catch{}v.current.delete(S.pointerId);const D=f.current;if(D&&(S.pointerId===D.idA||S.pointerId===D.idB)){f.current=null;const T=[...v.current.keys()];T.length===1&&_(T[0]);return}((k=w.current)==null?void 0:k.pointerId)===S.pointerId&&(w.current=null)},[_]);return{containerProps:{onPointerDown:M,onPointerMove:P,onPointerUp:y,onPointerCancel:y,style:{cursor:c&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:c}}function Nt(){const[e,t]=u.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return u.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ut(e){const t=u.useRef(e),[n,r]=u.useState(e),o=u.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Mo(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function yn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Ut({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=bo(),s=u.useRef(null),d=u.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),l=u.useMemo(()=>{const f=a.w,x=a.h;if(f<=0||x<=0||n<=0||r<=0)return null;const g=Math.min(f/n,x/r),b=n*g,_=r*g;return{left:(f-b)/2,top:(x-_)/2,width:b,height:_}},[a.w,a.h,n,r]),c=e.masks,p=t.showMasks&&!!c&&c.length>0,m=u.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(u.useEffect(()=>{if(!p||!c)return;const f=s.current;if(!f)return;(f.width!==n||f.height!==r)&&(f.width=n,f.height=r);const x=f.getContext("2d");if(!x)return;x.clearRect(0,0,f.width,f.height);let g=!1;const b=x.createImageData(n,r),_=b.data;let M=c.length,P=!1;const y=()=>{g||P&&x.putImageData(b,0,0)},A=document.createElement("canvas");A.width=n,A.height=r;const S=A.getContext("2d",{willReadFrequently:!0});for(const D of c){const k=new Image;k.onload=()=>{if(!g){if(S){S.clearRect(0,0,n,r),S.drawImage(k,0,0,n,r);const T=S.getImageData(0,0,n,r).data;for(let C=0;C<n*r;C++){const E=T[C*4];if(E===0||d.has(E))continue;const[L,I,O]=Mo(It(E));_[C*4]=L,_[C*4+1]=I,_[C*4+2]=O,_[C*4+3]=255,P=!0}}M-=1,M===0&&y()}},k.onerror=()=>{M-=1,M===0&&y()},k.src=`data:image/png;base64,${D.png_b64}`}return()=>{g=!0}},[p,c,n,r,m]),!l)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],v=t.showBoxes&&h.length>0,w=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),v&&i.jsx("svg",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((f,x)=>{if(!yn(f,t,d))return null;const g=f.domain==="pixel"?1:n,b=f.domain==="pixel"?1:r,_=f.position.minX*g,M=f.position.minY*b,P=(f.position.maxX-f.position.minX)*g,y=(f.position.maxY-f.position.minY)*b;return i.jsx("rect",{x:_,y:M,width:P,height:y,fill:"none",stroke:It(f.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},x)})}),v&&i.jsx("div",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height},children:h.map((f,x)=>{if(!yn(f,t,d))return null;const g=f.domain==="pixel"?1/n:1,b=f.domain==="pixel"?1/r:1,_=f.position.minX*g*100,M=f.position.minY*b*100,P=f.label??w[String(f.class_id)]??`#${f.class_id}`,y=f.score!=null?` ${(f.score*100).toFixed(0)}%`:"";return!P&&!y?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${_}%`,top:`${M}%`,transform:"translateY(-100%)",backgroundColor:It(f.class_id)},children:i.jsxs("span",{className:"mono",children:[P,y]})},x)})})]})}const Ft=30,dt=["#ff5a5a","#39d353","#5b9bff"];function Gt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function Je(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Gt(e/255):Gt(n==="int"?e*255:e)}function Ze(e,t,n,r){return e.length===1?{lines:[Je(e[0],t,n)],luminance:r}:{lines:e.map(o=>Je(o,t,n)),luminance:r,colors:e.map((o,a)=>dt[a]??null)}}const To={x:0,y:0,w:1,h:1};function Qe({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:d=0,onActiveChange:l,sourceWindow:c=To}){const p=u.useRef(null),m=u.useRef(!1),h=Nt(),v=u.useRef(l);v.current=l;const w=u.useCallback(x=>{var g;x!==m.current&&(m.current=x,(g=v.current)==null||g.call(v,x))},[]),f=u.useCallback(()=>{var ve;const x=p.current,g=e.current;if(!x)return;const b=window.devicePixelRatio||1,_=x.clientWidth,M=x.clientHeight;if(_===0||M===0)return;x.width!==Math.round(_*b)&&(x.width=Math.round(_*b)),x.height!==Math.round(M*b)&&(x.height=Math.round(M*b));const P=x.getContext("2d");if(!P)return;if(P.setTransform(b,0,0,b,0,0),P.clearRect(0,0,_,M),!g||t<=0||n<=0){w(!1);return}const y=g.getBoundingClientRect(),A=x.getBoundingClientRect();if(y.width===0||y.height===0){w(!1);return}const S=c.x*t,D=c.y*n,k=c.w*t,T=c.h*n;if(k<=0||T<=0){w(!1);return}const C=Math.min(y.width/k,y.height/T);if(C<Ft){w(!1);return}const E=k*C,L=T*C,I=y.left+(y.width-E)/2-A.left,O=y.top+(y.height-L)/2-A.top,K=Math.max(Math.floor(S),Math.floor(S+(0-I)/C)),Z=Math.min(Math.ceil(S+k),Math.ceil(S+(_-I)/C)),oe=Math.max(Math.floor(D),Math.floor(D+(0-O)/C)),ae=Math.min(Math.ceil(D+T),Math.ceil(D+(M-O)/C));if(Z<=K||ae<=oe){w(!1);return}w(!0);const Ee=I+(0-S)*C,he=O+(0-D)*C,Le=I+(t-S)*C,ge=O+(n-D)*C;P.save(),P.beginPath(),P.rect(Ee,he,Le-Ee,ge-he),P.clip(),P.textAlign="center",P.textBaseline="middle",P.lineJoin="round";const _e=C*.14,xe=C-_e*2;for(let Q=oe;Q<ae;Q++)for(let me=K;me<Z;me++){if(me<0||Q<0||me>=t||Q>=n)continue;const H=a(me,Q,s);if(!H||H.lines.length===0)continue;const Y=H.lines.length;let ie=1;for(const V of H.lines)V.length>ie&&(ie=V.length);const we=xe/(Y*1.15),be=xe/(ie*.62)||we,ye=Math.min(we,be,24);if(ye<6)continue;const Ce=I+(me-S+.5)*C,U=O+(Q-D+.5)*C,F=ye*1.15,q=H.luminance<=.55,X=q?"#ffffff":"#000000";P.font=`${ye}px ui-monospace, SFMono-Regular, Menlo, monospace`,P.lineWidth=Math.max(1.4,ye*.16),P.strokeStyle=q?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let j=U-Y*F/2+F/2;for(let V=0;V<H.lines.length;V++){const B=H.lines[V];P.strokeText(B,Ce,j),P.fillStyle=((ve=H.colors)==null?void 0:ve[V])??X,P.fillText(B,Ce,j),j+=F}}P.restore()},[e,t,n,a,s,w,c]);return u.useEffect(()=>{f()},[f,r,o.x,o.y,d,s,c,h]),u.useEffect(()=>{const x=p.current;if(!x)return;const g=new ResizeObserver(()=>f());return g.observe(x),()=>g.disconnect()},[f]),i.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function En({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const So=`
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
`,_n=`
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
`,Po=`
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
`;function Mn(e){return`
${Fe}
${_n}
${Po}

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
`}const Co=Mn("select(colorB, colorA, uv.x < split)"),Ao=Mn("mix(colorA, colorB, alpha)"),zt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Tn=new WeakMap;function Ro(e,t){let n=Tn.get(e);n||(n=new Map,Tn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:So,targetFormat:t}),n.set(t,r)),r}function Sn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Pn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ko(e,t,n,r){var f;const o=Sn(t),a=Ro(e,o),s=Pn(e,r.isScalar?r.colormap:void 0),d=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,l=zt[r.operator]??zt.srgb,c=new Float32Array([r.exposureEV,l,d,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),m=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),v=new Float32Array([r.offset??0]);let w;try{w=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:m}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,a,w)}finally{(f=w==null?void 0:w.destroy)==null||f.call(w),s.destroy()}}const Cn=new WeakMap;function Do(e,t,n){let r=Cn.get(e);r||(r=new Map,Cn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?Co:Ao,targetFormat:n}),r.set(o,a)),a}function Lo(e,t,n,r,o){var f;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Sn(t),s=Do(e,o.mode,a),d=Pn(e,void 0),l=o.gamma,c=zt[o.operator],p=new Float32Array([o.exposureEV,c,l,0]),m=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),v=new Float32Array([o.offset??0,0,0,0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:d},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:m}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,s,w)}finally{(f=w==null?void 0:w.destroy)==null||f.call(w),d.destroy()}}function An(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function Rn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:h,sumAbs:v}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return An(h,v,a)}const s=await e.readback(t),d=await e.readback(n),l=s instanceof Uint8Array,c=d instanceof Uint8Array;let p=0,m=0;for(let h=0;h<o;h++)for(let v=0;v<r;v++){const w=(h*t.width+v)*4,f=(h*n.width+v)*4;for(let x=0;x<3;x++){const g=(s[w+x]??0)/(l?255:1),b=(d[f+x]??0)/(c?255:1),_=g-b;p+=_*_,m+=Math.abs(_)}}return An(p,m,a)}function kn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Io=12,Xe=[];function Dn(e){const t=Xe.indexOf(e);t!==-1&&Xe.splice(t,1),Xe.push(e)}function Oo(e){const t=Xe.indexOf(e);t!==-1&&Xe.splice(t,1)}function pt(e){e.parked||(Oo(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Ln(e){for(;Xe.length>Io;){const t=Xe.find(n=>n!==e&&!n.visible)??Xe.find(n=>n!==e);if(!t)break;pt(t)}}function In(e){var o,a;if(e.disposed)return;if(kn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Dn(e),Ln(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,Dn(e),Ln(e)}function Bo(e,t){if(e.disposed||!e.source)return!0;try{return In(e),!e.surface||!e.srcTexture?!1:(ko(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,pt(e),!1}}function No(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Bo(e,t)},park(){e.disposed||pt(e)},restore(){e.disposed||!e.source||In(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(pt(e),e.source=null,e.disposed=!0)}}}async function Uo(e,t){const n=await ot(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return No(r)}function On(e){e.dispose()}function Fo(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function Bn(e){const n=`cairn-gamma-${u.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:d,flipSign:l}=e,c=u.useMemo(()=>Fo(e,n),[n,r,o,s,l]);return{gammaFilterId:n,filterStr:c,gamma:a,offset:d}}function Nn({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Un(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Go({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Un(e),a=Un(t),s=[];for(let b=0;b<=e;b+=o)s.push(b);const d=[];for(let b=0;b<=t;b+=a)d.push(b);const l=1/n,c=8*l,p=-12*l,m=-2*l,h=r==null?void 0:r.current;let v=0,w=0,f=0,x=0;if(h){const b=h.clientWidth,_=h.clientHeight,M=b/e,P=_/t,y=Math.min(M,P);f=e*y,x=t*y,v=(b-f)/2,w=(_-x)/2}const g=h&&f>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:g?w:0,transform:`translateY(${p}px)`,fontSize:c},children:s.map(b=>i.jsx("span",{className:"mono",style:{position:"absolute",left:g?v+b/e*f:`${b/e*100}%`,transform:"translateX(-50%)"},children:b},b))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:g?v:0,transform:`translateX(${m}px)`,fontSize:c},children:d.map(b=>i.jsx("span",{className:"mono",style:{position:"absolute",top:g?w+b/t*x:`${b/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*l}px`},children:b},b))})]})}function zo({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Vo=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Fn(e,t){const n=getComputedStyle(e),r=Vo.map(l=>`${l}:${n.getPropertyValue(l)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,d=Math.min(a.length,s.length);for(let l=0;l<d;l++)Fn(a[l],s[l])}function Vt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function $t(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Xt(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((d,l)=>a.toBlob(c=>c?d(c):l(new Error("plot-to-png: toBlob returned null")),"image/png"))}function $o(e,t,n){const r=e.cloneNode(!0);Fn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,d)=>{const l=new Image;l.onload=()=>s(l),l.onerror=()=>d(new Error("plot-to-png: SVG rasterization failed")),l.src=a})}async function Gn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Vt(e);return Xt(r,o,$t(t),a,s=>s.drawImage(e,0,0,r,o))}async function Xo(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Vt(e);try{return await Xt(r,o,$t(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Wo(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function Ho(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,d=(t==null?void 0:t.background)??Vt(e);if(n){const c=n.getBoundingClientRect(),p=await $o(n,c.width||a,c.height||s);return Xt(a,s,$t(t),d,m=>{for(const h of r){const v=h.getBoundingClientRect();m.drawImage(h,v.left-o.left,v.top-o.top,v.width,v.height)}m.drawImage(p,c.left-o.left,c.top-o.top,c.width,c.height)})}if(r.length)return Gn(r[0],t);const l=Wo(e);if(l)return Xo(l,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Yo(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Ko=8;function qo(e,t,n,r=Ko){return!(t>0)||!(e>0)?n:e<t+r}function zn(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function Zo(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function Qo(e,t){const n=Zo(e);return n===null?t:n}function jo(e){return String(e)}const Jo={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},es={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function Ge({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:es[e]??null})}function Vn({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(Ge,{name:e??""})})}function $n(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function ts({icon:e,title:t,menu:n}){var x;const{options:r,value:o,onSelect:a}=n,[s,d]=u.useState(!1),[l,c]=u.useState(0),p=u.useRef(null),m=zn(r,o),h=e?void 0:((x=r[m])==null?void 0:x.label)??"",v=u.useCallback(()=>{d(g=>{const b=!g;return b&&c(m),b})},[m]),w=u.useCallback(g=>{a(g),d(!1)},[a]);u.useEffect(()=>{if(!s)return;const g=_=>{p.current&&!p.current.contains(_.target)&&d(!1)},b=_=>{_.key==="Escape"&&(_.stopPropagation(),d(!1))};return document.addEventListener("pointerdown",g,!0),document.addEventListener("keydown",b,!0),()=>{document.removeEventListener("pointerdown",g,!0),document.removeEventListener("keydown",b,!0)}},[s]);const f=g=>{if(!s){(g.key==="ArrowDown"||g.key==="Enter"||g.key===" ")&&(g.preventDefault(),c(m),d(!0));return}if(g.key==="ArrowDown")g.preventDefault(),c(b=>(b+1)%r.length);else if(g.key==="ArrowUp")g.preventDefault(),c(b=>(b-1+r.length)%r.length);else if(g.key==="Enter"||g.key===" "){g.preventDefault();const b=r[l];b&&w(b.id)}};return i.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:g=>g.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:g=>{g.stopPropagation(),v()},onDoubleClick:g=>g.stopPropagation(),onKeyDown:f,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?i.jsx("span",{"aria-hidden":"true",children:h}):i.jsx(Ge,{name:e??""}),i.jsx(Ge,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((g,b)=>{const _=g.id===o,M=b===l;return i.jsx("li",{role:"option","aria-selected":_,children:i.jsx("button",{type:"button",onClick:P=>{P.stopPropagation(),w(g.id)},onPointerEnter:()=>c(b),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",M?"bg-bg-hover":"",_?"text-accent font-medium":"text-fg"].join(" "),children:g.label})},g.id)})})]})}const ns=e=>e.format?e.format(e.value):String(e.value);function Xn({spec:e}){const[t,n]=u.useState(!1),[r,o]=u.useState(""),a=u.useRef(null),s=u.useCallback(()=>{o(jo(e.value)),n(!0)},[e.value]);u.useEffect(()=>{t&&a.current&&(a.current.focus(),a.current.select())},[t]);const d=u.useCallback(()=>{n(c=>(c&&e.onChange(Qo(r,e.value)),!1))},[r,e]),l=u.useCallback(()=>n(!1),[]);return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:c=>c.stopPropagation(),onDoubleClick:c=>{c.stopPropagation(),t||s()},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx(Ge,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?i.jsx("input",{ref:a,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:c=>o(c.target.value),onPointerDown:c=>c.stopPropagation(),onDoubleClick:c=>c.stopPropagation(),onKeyDown:c=>{c.stopPropagation(),c.key==="Enter"?(c.preventDefault(),d()):c.key==="Escape"&&(c.preventDefault(),l())},onBlur:d,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):i.jsxs(i.Fragment,{children:[i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:c=>e.onChange(Number(c.target.value)),onPointerDown:c=>c.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:ns(e)})]})]})}function rs({icon:e,title:t,menu:n,onClose:r}){var m;const{options:o,value:a,onSelect:s}=n,[d,l]=u.useState(!1),c=zn(o,a),p=((m=o[c])==null?void 0:m.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":d,"aria-label":t,onClick:h=>{h.stopPropagation(),l(v=>!v)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",d?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx(Ge,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),i.jsx("span",{className:d?"rotate-180 transition-transform":"transition-transform",children:i.jsx(Ge,{name:"caret"})})]}),d&&o.map(h=>{const v=h.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":v,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",v?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:v?"✓":""}),i.jsx("span",{children:h.label})]},h.id)})]})}function os({actions:e,leading:t,sliders:n}){const[r,o]=u.useState(!1),a=u.useRef(null);return u.useEffect(()=>{if(!r)return;const s=l=>{a.current&&!a.current.contains(l.target)&&o(!1)},d=l=>{l.key==="Escape"&&(l.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",d,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",d,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(d=>!d)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx(Ge,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(rs,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:d=>{var l;d.stopPropagation(),!s.disabled&&((l=s.onClick)==null||l.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Ge,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:d=>{d.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Ge,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(Xn,{spec:s})},s.id))]})]})}function ss({controller:e,config:t}){var T,C;const n=u.useRef(null),[r,o]=u.useState(!1),a=u.useRef(r);a.current=r;const s=u.useRef(0),d=`${((T=t==null?void 0:t.leadingButtons)==null?void 0:T.length)??0}:${((C=t==null?void 0:t.sliders)==null?void 0:C.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(u.useEffect(()=>{const E=n.current,L=E==null?void 0:E.parentElement;if(!L)return;const I=()=>{const oe=L.clientWidth;if(!a.current&&n.current){const ae=n.current.scrollWidth;ae>0&&(s.current=ae)}o(qo(oe,s.current,a.current))};let O=0;const K=()=>{O||(O=requestAnimationFrame(()=>{O=0,I()}))},Z=new ResizeObserver(K);return Z.observe(L),I(),()=>{Z.disconnect(),O&&cancelAnimationFrame(O)}},[d]),(t==null?void 0:t.enabled)===!1)return null;const l=e.capabilities,c=t==null?void 0:t.buttons,p=(E,L)=>L&&(c==null?void 0:c[E])!==!1,m=E=>()=>e.setDragMode(E),h=()=>{e.toPNG({filename:"plot"}).then(E=>Yo(E,"plot.png")).catch(()=>{})},v=[];p("zoom",l.zoom)&&v.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:m("zoom")}),p("pan",l.pan)&&v.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:m("pan")}),p("select",l.select)&&v.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:m("select")}),p("lasso",l.lasso)&&v.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:m("lasso")});const w=[];p("zoomIn",l.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",l.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const f=[];p("autoscale",l.autoscale)&&f.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",l.reset)&&f.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const x=[];p("screenshot",l.screenshot)&&x.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const g=[v,w,f,x].filter(E=>E.length>0),b=g.flat(),_=(t==null?void 0:t.leadingButtons)??[],M=(t==null?void 0:t.sliders)??[];if(!_.length&&b.length===0&&M.length===0)return null;const P=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",A=P==="top-right"||P==="bottom-right",D=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),k={position:"absolute",pointerEvents:"auto",...Jo[P]};return r?i.jsx("div",{ref:n,style:k,className:`${D} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(os,{actions:b,leading:_,sliders:M})}):i.jsxs("div",{ref:n,style:k,className:`${D} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${A?"justify-end":"justify-start"}`,children:[_.length>0&&i.jsxs(i.Fragment,{children:[_.map(E=>E.menu?i.jsx(ts,{icon:E.icon,title:E.title,menu:E.menu},E.id):i.jsx(Vn,{icon:E.icon,label:E.label,title:E.title,active:E.active,disabled:E.disabled,onClick:E.onClick??(()=>{})},E.id)),g.length>0&&i.jsx($n,{})]}),g.map((E,L)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[L>0&&i.jsx($n,{}),E.map(I=>i.jsx(Vn,{icon:I.icon,title:I.title,active:I.active,disabled:I.disabled,onClick:I.onClick},I.id))]},E[0].id))]}),M.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${A?"justify-end":"justify-start"}`,children:M.map(E=>i.jsx(Xn,{spec:E},E.id))})]})}const as={zoom:1,pan:{x:0,y:0}},Wn=1.3,is=.25,cs=64,ls={buttons:{zoom:!1}};function us(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const ds=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Wt(e,t){return{id:"colormap",title:"Colormap",menu:{options:ds,value:e,onSelect:t}}}function fs({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:d=is,maxZoom:l=cs,requestRender:c,onReset:p,extraModified:m=!1}){const h=u.useCallback(y=>{var O;if(!o)return;const A=(O=e.current)==null?void 0:O.getBoundingClientRect(),S=(A==null?void 0:A.width)??0,D=(A==null?void 0:A.height)??0,k=a&&s&&S>0&&D>0?Bt(a,s,S,D):l,T=Math.max(d,Math.min(k,n*y));if(T===n)return;const C=S/2,E=D/2,L=C-(C-r.x)/n*T,I=E-(E-r.y)/n*T;o({zoom:T,pan:{x:L,y:I}})},[o,e,a,s,l,d,n,r.x,r.y]),v=u.useCallback(()=>h(Wn),[h]),w=u.useCallback(()=>h(1/Wn),[h]),f=u.useCallback(()=>{o==null||o(as),p==null||p()},[o,p]),x=u.useCallback(y=>{const A={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};c==null||c();const S=t==null?void 0:t.current;if(S)return Gn(S,A);const D=e.current;return D?Ho(D,A):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,c]),g=u.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),b=n!==1||r.x!==0||r.y!==0||m,_=u.useCallback(y=>{},[]),M=u.useCallback(y=>{},[]),P=u.useCallback(()=>{},[]);return u.useMemo(()=>({capabilities:g,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:b,setDragMode:_,setHoverMode:M,toggleSpikelines:P,zoomIn:v,zoomOut:w,autoscale:f,reset:f,toPNG:x}),[g,b,_,M,P,v,w,f,x])}const ps={zoom:1,pan:{x:0,y:0}};function ht({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:d,naturalDims:l,checkerboard:c,wrapperClassName:p,wrapperStyle:m,viewportPadding:h,header:v,surface:w,showAxes:f,overlayNode:x,overlay:g,notationSeed:b,exportCanvasRef:_,requestRender:M,leadingMenus:P,displayAdjust:y,onReset:A,extraModified:S,label:D,showLabelChip:k,isDraggable:T=!1,onDragStart:C,extraChips:E}){const[L,I]=u.useState(b),[O,K]=u.useState(!1),{containerProps:Z}=wn({containerRef:r,zoom:a,pan:s,onViewportChange:d,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h}),oe=u.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),A==null||A()},[y,A]),ae=u.useCallback(()=>{d==null||d(ps),oe()},[d,oe]),Ee=fs({rootRef:r,canvasRef:_,zoom:a,pan:s,onViewportChange:d,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h,requestRender:M,onReset:oe,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!S}),he=u.useMemo(()=>{if(!y)return;const Q=(me,H)=>`${me>=0?"+":"−"}${Math.abs(me).toFixed(H)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:me=>Q(me,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:me=>Q(me,2)}]},[y]),Le=u.useMemo(()=>({...ls,leadingButtons:[...P??[],...O?[us(L,I)]:[]],sliders:he}),[O,L,P,he]),ge=" cairn-checkerboard",_e="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(c==="pane"?ge:""),xe=p+(c==="wrapper"?ge:""),ve="render"in g?g.render({notation:L,setOverlayActive:K}):g.hasSource&&l?i.jsx(Qe,{imageElRef:g.displayElRef,naturalWidth:l.w,naturalHeight:l.h,zoom:a,pan:s,sourceWindow:g.sourceWindow,sample:g.sample,notation:L,version:g.version,onActiveChange:K}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[v,n&&i.jsx(ss,{controller:Ee,config:Le}),i.jsxs("div",{ref:r,className:_e,style:{padding:h,...Z.style},onPointerDown:Z.onPointerDown,onPointerMove:Z.onPointerMove,onPointerUp:Z.onPointerUp,onPointerCancel:Z.onPointerCancel,onDoubleClick:ae,...t,children:[i.jsxs("div",{ref:o,className:xe,style:m,children:[w,f&&l&&i.jsx(Go,{naturalWidth:l.w,naturalHeight:l.h,zoom:a,containerRef:o}),x]}),ve,!n&&O&&i.jsx(En,{notation:L,onChange:I})]}),k&&i.jsx(zo,{label:D,isDraggable:T,onDragStart:C}),E]})}function Hn(e){return"hdr"in e&&e.hdr!=null}function Yn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Pe(e){return Number.isFinite(e)?e:0}const hs={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function gs(e,t,n,r,o=0){const{h:a,w:s,c:d}=Yn(e.shape),l=e.precision==="f16-bits"?fn(e.data):e.data,c=Wr(t),p=new Uint8ClampedArray(s*a*4);for(let m=0;m<s*a;m++){const h=m*d;let v,w,f,x=1;d===1?v=w=f=Pe(l[h]):d===3?(v=Pe(l[h]),w=Pe(l[h+1]),f=Pe(l[h+2])):(v=Pe(l[h]),w=Pe(l[h+1]),f=Pe(l[h+2]),x=Pe(l[h+3]));const g=[st(v,n,o),st(w,n,o),st(f,n,o)],[b,_,M]=c(g),P=m*4;p[P]=255*At(b,r),p[P+1]=255*At(_,r),p[P+2]=255*At(M,r),p[P+3]=255*(x<0?0:x>1?1:x)}return new ImageData(p,s,a)}function ms(e){var j,V;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:d=!1,processing:l=hs,zoom:c=1,pan:p={x:0,y:0},onViewportChange:m,onNaturalSize:h,label:v,isDraggable:w=!1,onDragStart:f,overlay:x,overlaySettings:g,pixelValueNotation:b="decimal",toolbar:_=!0}=e,[M,P,y]=ut(s);u.useEffect(()=>{P(s)},[s,P]);const A=u.useRef(null),S=u.useRef(null),D=u.useRef(null),k=u.useRef(null),T=u.useRef(null),C=u.useRef(null),E=u.useRef(null),[L,I]=u.useState(0),O=u.useCallback(()=>I(B=>B+1),[]),K=u.useMemo(()=>({get current(){const B=T.current;return B instanceof HTMLCanvasElement?B:null}}),[]),Z=u.useCallback(B=>{A.current=B,B&&(T.current=B)},[]),oe=u.useCallback(B=>{S.current=B,B&&(T.current=B)},[]),ae=u.useCallback(B=>{B&&(T.current=B)},[]),[Ee,he]=u.useState(!1),[Le,ge]=u.useState(!1),[_e,xe]=u.useState(null),{flipSign:ve}=l,{gammaFilterId:Q,filterStr:me,gamma:H,offset:Y}=Bn(l),ie=!r&&o!=="none"&&n!=null&&t!=null,we=o!=="none"&&n!=null,be=M!=="none"&&!ie&&!(r&&we)&&t!=null;u.useEffect(()=>{if(!be||!t){ge(!1);return}let B=!1;ge(!1);const z=`${t}::${M}`,J=Dt(z);if(J){const W=S.current;if(W){W.width=J.width,W.height=J.height;const ne=W.getContext("2d");ne&&ne.putImageData(J,0,0),E.current=J,O(),xe({w:J.width,h:J.height}),h==null||h(J.width,J.height),ge(!0)}return}const ee=new Image;return ee.onload=()=>{if(B)return;const W=document.createElement("canvas");W.width=ee.naturalWidth,W.height=ee.naturalHeight;const ne=W.getContext("2d");if(!ne)return;ne.drawImage(ee,0,0);const ke=ne.getImageData(0,0,W.width,W.height),Ae=kt(M),fe=Rt(ke,M,Ae);Lt(z,fe);const Me=S.current;if(!Me||B)return;Me.width=fe.width,Me.height=fe.height;const ce=Me.getContext("2d");ce&&ce.putImageData(fe,0,0),E.current=fe,O(),xe({w:fe.width,h:fe.height}),h==null||h(fe.width,fe.height),ge(!0)},ee.src=t,()=>{B=!0}},[be,t,M]);const ye=u.useCallback((B,z)=>{xe(J=>J&&J.w===B&&J.h===z?J:{w:B,h:z}),h==null||h(B,z)},[]);u.useEffect(()=>{if(!t){C.current=null,E.current=null,O();return}let B=!1;return Ke(t).then(z=>{B||(C.current=z,M==="none"&&(E.current=z),O())}),()=>{B=!0}},[t,M,O]);const Ce=u.useCallback((B,z,J)=>{const ee=C.current;if(!ee||B<0||z<0||B>=ee.width||z>=ee.height)return null;const W=(z*ee.width+B)*4,ne=ee.data[W],ke=ee.data[W+1],Ae=ee.data[W+2],fe=E.current;let Me=ne,ce=ke,Se=Ae;if(fe&&fe.width===ee.width&&fe.height===ee.height){const Oe=(z*fe.width+B)*4;Me=fe.data[Oe],ce=fe.data[Oe+1],Se=fe.data[Oe+2]}const Ie=(.299*Me+.587*ce+.114*Se)/255;return Ze(M!=="none"||ne===ke&&ke===Ae?[ne]:[ne,ke,Ae],"uint8",J,Ie)},[M]);u.useEffect(()=>{if(!ie){he(!1);return}let B=!1;const z=so(),J=z==="gpu"||z==="auto",ee=`${n}::${t}::${o}::${M}`;if(z!=="gpu"){const W=Dt(ee);if(W){const ne=A.current;if(ne){(ne.width!==W.width||ne.height!==W.height)&&(ne.width=W.width,ne.height=W.height);const ke=ne.getContext("2d");ke&&ke.putImageData(W,0,0),ye(W.width,W.height),he(!0)}return}}return(async()=>{const[W,ne]=await Promise.all([Ke(n),Ke(t)]);if(B||!W||!ne)return;const Ae=o.includes("signed")?"signed":"positive",fe=M!=="none"?St(M):null,Me={diffMode:o,colormap:fe,cmapMode:Ae};if(J)try{const He=A.current;if(He){const Oe=ro(W,ne,Me,He);if(Oe){if(B)return;ye(Oe.width,Oe.height),he(!0);return}}}catch(He){console.warn("[cairn] WebGL 2 diff error:",He)}if(z==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let ce=Zr(W,ne,o);M!=="none"&&(ce=Rt(ce,M,Ae)),Lt(ee,ce);const Se=A.current;if(!Se||B)return;(Se.width!==ce.width||Se.height!==ce.height)&&(Se.width=ce.width,Se.height=ce.height);const Ie=Se.getContext("2d");Ie&&Ie.putImageData(ce,0,0),ye(ce.width,ce.height),he(!0)})(),()=>{B=!0}},[n,t,o,ie,M,h]);const U=a==="auto"?void 0:a,F=ve?{filter:"invert(1)"}:{},q=x&&(g!=null&&g.enabled)&&_e&&t&&((((j=x.boxes)==null?void 0:j.length)??0)>0||(((V=x.masks)==null?void 0:V.length)??0)>0)?i.jsx(Ut,{data:x,settings:g,naturalWidth:_e.w,naturalHeight:_e.h}):void 0,X=t?ie?i.jsxs(i.Fragment,{children:[!Ee&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:Z,className:"w-full h-full object-contain block",style:{display:Ee?"block":"none",imageRendering:U,...F}})]}):be?i.jsxs(i.Fragment,{children:[!Le&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:oe,className:"w-full h-full object-contain block",style:{display:Le?"block":"none",imageRendering:U,...F}})]}):i.jsx("img",{ref:ae,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:me,imageRendering:U},onLoad:B=>{const z=B.currentTarget;xe({w:z.naturalWidth,h:z.naturalHeight}),h==null||h(z.naturalWidth,z.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(ht,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:D,wrapperRef:k,zoom:c,pan:p,onViewportChange:m,naturalDims:_e,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${c})`,transformOrigin:"0 0"},viewportPadding:d&&_e?"16px 4px 4px 28px":"4px",header:i.jsx(Nn,{id:Q,gamma:H,offset:Y}),surface:X,showAxes:d,overlayNode:q,overlay:{displayElRef:T,sample:Ce,version:L,hasSource:!!t},notationSeed:b,exportCanvasRef:K,leadingMenus:[Wt(M,B=>P(B))],onReset:y.reset,extraModified:y.isModified,label:v,showLabelChip:!0,isDraggable:w,onDragStart:f})}function xs(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:d="auto",zoom:l=1,pan:c={x:0,y:0},onViewportChange:p,pixelValueNotation:m="decimal",toolbar:h=!0}=e,v=u.useRef(null),w=u.useRef(null),f=u.useRef(null),[x,g]=u.useState(null),b=u.useRef(null),[_,M]=u.useState(0),[P,y]=u.useState(0),[A,S]=u.useState(0);u.useEffect(()=>{const T=v.current;if(!T)return;let C;try{C=gs(t,n,r+P,o,A)}catch(L){console.error("[cairn] HDR tone-map error:",L);return}(T.width!==C.width||T.height!==C.height)&&(T.width=C.width,T.height=C.height);const E=T.getContext("2d");E&&(E.putImageData(C,0,0),b.current=C,M(L=>L+1),g(L=>L&&L.w===C.width&&L.h===C.height?L:{w:C.width,h:C.height}))},[t,n,r,o,P,A]);const D=u.useCallback((T,C,E)=>{const L=x;if(!L||T<0||C<0||T>=L.w||C>=L.h)return null;const I=t.shape.length===2?1:t.shape[2]??1,O=(C*L.w+T)*I,K=t.data,Z=t.precision==="f16-bits"?he=>ct(K[he]??0):he=>K[he]??0,oe=b.current;let ae=.5;if(oe&&oe.width===L.w&&oe.height===L.h){const he=(C*L.w+T)*4;ae=(.299*oe.data[he]+.587*oe.data[he+1]+.114*oe.data[he+2])/255}const Ee=I===1?[Z(O)]:[Z(O),Z(O+1),Z(O+2)];return Ze(Ee,"unit",E,ae)},[t,x]),k=d==="auto"?void 0:d;return i.jsx(ht,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:h,paneRef:w,wrapperRef:f,zoom:l,pan:c,onViewportChange:p,naturalDims:x,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${c.x}px, ${c.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:a&&x?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:v,className:"w-full h-full object-contain block",style:{imageRendering:k}}),showAxes:a,overlay:{displayElRef:v,sample:D,version:_,hasSource:!0},notationSeed:m,exportCanvasRef:v,displayAdjust:{exposureEV:P,offset:A,onExposureChange:y,onOffsetChange:S},label:s,showLabelChip:!!s})}function Ht(e){return Hn(e)?i.jsx(xs,{...e}):i.jsx(ms,{...e})}const Kn={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},bs="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function vs(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function ws(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function ys(e,t){if(e==="no-hdr-display")switch(ws(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=vs(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Es(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function qn(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Zn=new Set;function Qn(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Zn.has(e)}function _s(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Zn.add(e)}const jn=new Set;let gt=null,et=null;function Jn(){et&&et.parentNode&&et.parentNode.removeChild(et),et=null,gt=null}function Ms(e){const t=qn(e,window.location.pathname),n=ys(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Es(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=bs,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const d=document.createElement("button");d.type="button",d.textContent="×",d.setAttribute("aria-label","Dismiss browser capability notice"),d.title="Dismiss",Object.assign(d.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),d.addEventListener("click",()=>{_s(t),Jn()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(d),document.body.appendChild(r),et=r,gt=e}function er(e){if(typeof document>"u"||typeof window>"u"||jn.has(e))return;jn.add(e);const t=qn(e,window.location.pathname);if(Qn(t))return;const n=()=>{if(!Qn(t)){if(gt!==null)if(Kn[e]<Kn[gt])Jn();else return;Ms(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Ts=["linear","srgb","reinhard","aces"];function Ss(e){return e&&Ts.includes(e)?e:"srgb"}function Ps(e){const{h:t,w:n,c:r}=Yn(e.shape);if(e.precision==="f16-bits"){const s=e.data,d=new Uint16Array(n*t*4);for(let l=0;l<n*t;l++){const c=l*r,p=l*4;if(r===1){const m=s[c];d[p]=m,d[p+1]=m,d[p+2]=m,d[p+3]=it}else d[p]=s[c],d[p+1]=s[c+1],d[p+2]=s[c+2],d[p+3]=r>=4?s[c+3]:it}return{data:d,width:n,height:t,format:"rgba16float"}}const o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const d=s*r;let l,c,p,m=1;r===1?l=c=p=Pe(o[d]):r===3?(l=Pe(o[d]),c=Pe(o[d+1]),p=Pe(o[d+2])):(l=Pe(o[d]),c=Pe(o[d+1]),p=Pe(o[d+2]),m=Pe(o[d+3]));const h=s*4;a[h]=l,a[h+1]=c,a[h+2]=p,a[h+3]=m}return{data:a,width:n,height:t,format:"rgba32float"}}function tr(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,d=(t.width-a)/2,l=(t.height-s)/2,c=Math.max(e.zoom,1e-6),p=t.width/(c*a),m=t.height/(c*s),h=-d/a-e.pan.x/(c*a),v=-l/s-e.pan.y/(c*s);return{x:h,y:v,w:p,h:m}}function nr(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function Cs(e){var ye,Ce;const t=Hn(e),n=u.useRef(null),r=u.useRef(null),o=u.useRef(null),a=u.useRef(null),s=u.useRef(!1),[d,l]=u.useState(!1),[c,p]=u.useState(!1),[m,h]=u.useState(null),[v,w]=u.useState(0),[f,x]=u.useState(0),[g,b]=u.useState({x:0,y:0,w:1,h:1}),_=u.useRef(null),M=u.useRef(null),[P,y]=u.useState(0),A=e.zoom??1,S=e.pan??{x:0,y:0},D=e.onViewportChange,k=t?"none":e.colormap??"none",[T,C]=u.useState(k);u.useEffect(()=>{C(k)},[k]);const E=t?"none":T,L=u.useRef(k),I=u.useCallback(()=>{C(L.current)},[]),[O,K]=u.useState(0),[Z,oe]=u.useState(0),ae=Nt();u.useEffect(()=>{const U=n.current;if(!U)return;let F=!1;return ot().then(q=>{var B;if(F)return;const X=((B=q.probeExtendedToneMapping)==null?void 0:B.call(q))??!1,j=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,V=X&&j&&t;s.current=V,t&&!V&&er(X?"no-hdr-display":"no-hdr-browser"),Uo(U,{hdr:V}).then(z=>{if(F){On(z);return}a.current=z,p(!0)}).catch(z=>{F||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",z),l(!0))})}).catch(q=>{F||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",q),l(!0))}),()=>{F=!0,a.current&&(On(a.current),a.current=null)}},[]),u.useEffect(()=>{const U=r.current;if(!U)return;const F=new ResizeObserver(()=>x(q=>q+1));return F.observe(U),()=>F.disconnect()},[]),u.useEffect(()=>{const U=r.current;if(!U)return;const F=new IntersectionObserver(q=>{const X=q[0];if(!X)return;const j=a.current;j&&(j.setVisible(X.isIntersecting),X.isIntersecting?j.isParked&&(j.restore(),x(V=>V+1)):j.park())},{threshold:0});return F.observe(U),()=>F.disconnect()},[]),u.useEffect(()=>{var q;if(!t||!c)return;const U=e.hdr;_.current=U;const F=Ps(U);(q=a.current)==null||q.setSource(F),h(X=>X&&X.w===F.width&&X.h===F.height?X:{w:F.width,h:F.height}),y(X=>X+1),w(X=>X+1)},[t,c,t?e.hdr:null]),u.useEffect(()=>{if(t||!c)return;const U=e,F=U.imageUrl,q=T;if(!F){M.current=null,h(null),y(j=>j+1);return}let X=!1;return Ke(F).then(j=>{var z,J;if(X||!j)return;let V=j;if(q!=="none"){const ee=`gpu::${F}::${q}::ev${O}::off${Z}`,W=Dt(ee);if(W)V=W;else{const ne=kt(q);V=Rt(j,q,ne,O,Z),Lt(ee,V)}}M.current=j;const B={data:V.data,width:V.width,height:V.height,format:"rgba8unorm"};(z=a.current)==null||z.setSource(B),h(ee=>ee&&ee.w===V.width&&ee.h===V.height?ee:{w:V.width,h:V.height}),(J=U.onNaturalSize)==null||J.call(U,V.width,V.height),y(ee=>ee+1),w(ee=>ee+1)}),()=>{X=!0}},[t,c,t?null:e.imageUrl,t?null:T,t?0:O,t?0:Z]);const Ee=t?e.exposure??0:0,he=t?e.tonemap:void 0,Le=t?e.gamma:void 0,ge=u.useCallback(()=>{const U=a.current;if(!U||!c||!m)return;const F=r.current,q=o.current,X=q?q.getBoundingClientRect():F?F.getBoundingClientRect():{width:m.w,height:m.h},j=tr({zoom:A,pan:S},X,m.w,m.h);b(J=>J.x===j.x&&J.y===j.y&&J.w===j.w&&J.h===j.h?J:j),X.width>0&&X.height>0&&U.resize(Math.round(X.width*ae),Math.round(X.height*ae));const V=nr(j,X,m.w,m.h)>=Ft?"nearest":"linear",B=j,z=t?{exposureEV:Ee+O,offset:Z,operator:s.current?"extended":Ss(he),gamma:Le,isScalar:!1,hdrOut:s.current,uv:B,filter:V}:{exposureEV:E!=="none"?0:O,offset:E!=="none"?0:Z,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:B,filter:V};try{U.render(z)||l(!0)}catch(J){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",J),l(!0)}},[c,m,A,S.x,S.y,Ee,O,Z,he,Le,t,E,ae]);u.useEffect(()=>{ge()},[ge,v,f]);const _e=u.useCallback((U,F,q)=>{if(t){const W=_.current,ne=m;if(!W||!ne||U<0||F<0||U>=ne.w||F>=ne.h)return null;const ke=W.shape.length===2?1:W.shape[2]??1,Ae=(F*ne.w+U)*ke,fe=W.data,Me=W.precision==="f16-bits"?Ie=>ct(fe[Ie]??0):Ie=>fe[Ie]??0,ce=.5,Se=ke===1?[Me(Ae)]:[Me(Ae),Me(Ae+1),Me(Ae+2)];return Ze(Se,"unit",q,ce)}const X=M.current;if(!X||U<0||F<0||U>=X.width||F>=X.height)return null;const j=(F*X.width+U)*4,V=X.data[j],B=X.data[j+1],z=X.data[j+2],J=(.299*V+.587*B+.114*z)/255;return Ze(E!=="none"||V===B&&B===z?[V]:[V,B,z],"uint8",q,J)},[t,m,E]),xe=e.showAxes??!1,ve=t?e.label??"":e.label,Q=e.interpolation??"auto",me=Q==="auto"?void 0:Q,H=t?void 0:e.overlay,Y=t?void 0:e.overlaySettings,ie=t?!1:e.isDraggable??!1,we=t?void 0:e.onDragStart;if(d)return t?i.jsx(Ht,{...e}):i.jsx(Ht,{...e});const be=H&&(Y!=null&&Y.enabled)&&m&&((((ye=H.boxes)==null?void 0:ye.length)??0)>0||(((Ce=H.masks)==null?void 0:Ce.length)??0)>0)?i.jsx(Ut,{data:H,settings:Y,naturalWidth:m.w,naturalHeight:m.h}):void 0;return i.jsx(ht,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":c},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:S,onViewportChange:D,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:xe&&m?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:me},"data-gpu-image-canvas":!0}),showAxes:xe,overlayNode:be,overlay:{displayElRef:n,sample:_e,version:P,hasSource:!0,sourceWindow:g},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ge,leadingMenus:t?void 0:[Wt(E,U=>C(U))],displayAdjust:{exposureEV:O,offset:Z,onExposureChange:K,onOffsetChange:oe},onReset:I,extraModified:T!==L.current,label:ve,showLabelChip:!!ve,isDraggable:ie,onDragStart:we})}const mt=new Map;function ze(e){if(mt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);mt.set(e.id,e)}function je(e){return mt.get(e)}function As(){return Array.from(mt.values())}function rr(e,t){return{...e.params??{},...t??{}}}const Rs={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ks={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Ds={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Ls={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Is={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},Os={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},or=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Ns(or);const Yt=[1.052156925,1,.91835767],Bs=.7;function Ns(e){const[t,n,r]=e[0],[o,a,s]=e[1],[d,l,c]=e[2],p=a*c-s*l,m=-(o*c-s*d),h=o*l-a*d,w=1/(t*p+n*m+r*h);return[[p*w,-(n*c-r*l)*w,(n*s-r*a)*w],[m*w,(t*c-r*d)*w,-(t*s-r*o)*w],[h*w,-(t*l-n*d)*w,(t*a-n*o)*w]]}function Us(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Kt=6/29;function qt(e){return e>Kt**3?Math.cbrt(e):e/(3*Kt*Kt)+4/29}function sr(e,t,n){const[r,o,a]=Us(or,e,t,n),s=qt(r*Yt[0]),d=qt(o*Yt[1]),l=qt(a*Yt[2]),c=116*d-16,p=500*(s-d),m=200*(d-l);return[c,.01*c*p,.01*c*m]}function Fs(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Gs(){const e=sr(0,1,0),t=sr(0,0,1);return Math.pow(Fs(e,t),Bs)}const ar=Gs(),zs=.082;function ir(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),d=1/e,l=Math.PI**2,c=[0,0,0];for(let p=-s;p<=s;p++)for(let m=-s;m<=s;m++){const h=(m*d)**2+(p*d)**2;for(let v=0;v<3;v++)c[v]+=t[v]*Math.sqrt(Math.PI/n[v])*Math.exp(-l*h/n[v])+r[v]*Math.sqrt(Math.PI/o[v])*Math.exp(-l*h/o[v])}return{r:s,deltaX:d,sums:c}}function cr(e){const t=.5*zs*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let d=-n;d<=n;d++){const l=Math.exp(-(d*d+s*s)/(2*t*t)),c=-d*l,p=(d*d/(t*t)-1)*l;c>0&&(r+=c),p>0?o+=p:a-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const Vs=`
${Fe}
${ft}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,$s=`
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
`,lr=`
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
`;function We(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function bt(e){return[We(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),We(2,[e.sums[2],0,0,0])]}function ur(e){return[We(4,[ar,e.sd,e.r,e.edgeNorm]),We(5,[e.pointPos,e.pointNeg,0,0])]}function dr(e,t,n,r,o=""){const a=ir(e),s=cr(e),d=`ycxczA${o}`,l=`ycxczB${o}`,c=`labA${o}`,p=`labB${o}`,m=`flip${o}`;return{passes:[{name:d,shader:t,inputs:[n],output:d},{name:l,shader:t,inputs:[r],output:l},{name:c,shader:xt,inputs:[d],output:c,uniforms:()=>bt(a)},{name:p,shader:xt,inputs:[l],output:p,uniforms:()=>bt(a)},{name:m,shader:lr,inputs:[c,p,d,l],output:m,uniforms:()=>ur(s)}],flipRef:m}}const Xs={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=dr(t,Vs,"srcA","srcB");return{passes:n,final:r}}},Ws={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=dr(t,$s,"srcA","srcB");return{passes:n,final:r}}},fr=`
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
`,Hs=`
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
`,Ys={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=ir(t),d=cr(t),l=[];let c=null;for(let p=0;p<o;p++){const m=n+p*a,h=`_e${p}`,v=`ycxczA${h}`,w=`ycxczB${h}`,f=`labA${h}`,x=`labB${h}`,g=`acc${h}`;l.push({name:v,shader:fr,inputs:["srcA"],output:v,uniforms:()=>[We(1,[m,0,0,0])]},{name:w,shader:fr,inputs:["srcB"],output:w,uniforms:()=>[We(1,[m,0,0,0])]},{name:f,shader:xt,inputs:[v],output:f,uniforms:()=>bt(s)},{name:x,shader:xt,inputs:[w],output:x,uniforms:()=>bt(s)}),c===null?l.push({name:g,shader:lr,inputs:[f,x,v,w],output:g,uniforms:()=>ur(d)}):l.push({name:g,shader:Hs,inputs:[f,x,v,w,c],output:g,uniforms:()=>[We(5,[ar,d.sd,d.r,d.edgeNorm]),We(6,[d.pointPos,d.pointNeg,0,0])]}),c=g}return{passes:l,final:c}}};let pr=!1;function Ks(){pr||(pr=!0,ze(ks),ze(Rs),ze(Ds),ze(Is),ze(Ls),ze(Os),ze(Xs),ze(Ys),ze(Ws))}Ks();function hr(){const e=[];for(const t of As())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function qs(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const gr=new WeakMap;function Zt(e,t,n,r){let o=gr.get(e);o||(o=new Map,gr.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Zs(e){return`
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
`}const vt="rgba16float";function Qs(e,t,n,r,o){var v,w;const a=je(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),d=Math.min(t.height,n.height),l=rr(a,o);if(a.kind==="pointwise"){const f=e.createTexture(s,d,vt),x=Zt(e,`pw:${a.id}`,Zs(a.source),vt);let g;try{g=e.createBindGroup(x,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(f,x,g)}finally{(v=g==null?void 0:g.destroy)==null||v.call(g)}return f}const c={width:s,height:d,params:l},p=a.buildPasses(c),m=new Map([["srcA",t],["srcB",n]]),h=[];try{for(const x of p.passes){const g=e.createTexture(s,d,vt);h.push(g),m.set(x.output,g);const b=Zt(e,`mp:${a.id}:${x.name}`,x.shader,vt),_=x.inputs.map((P,y)=>{const A=m.get(P);if(!A)throw new Error(`computeDiff: pass "${x.name}" input "${P}" not produced yet`);return{binding:y,resource:A}});x.uniforms&&_.push(...x.uniforms(c));let M;try{M=e.createBindGroup(b,_),e.renderFullscreen(g,b,M)}finally{(w=M==null?void 0:M.destroy)==null||w.call(M)}}const f=m.get(p.final);if(!f)throw new Error(`computeDiff: final ref "${p.final}" not produced`);for(const x of h)x!==f&&x.destroy();return f}catch(f){for(const x of h)x.destroy();throw f}}const js=8,Js=256*1024*1024;class ea{constructor(t=js,n=Js){de(this,"map",new Map);de(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const mr=new WeakMap;function xr(e){let t=mr.get(e);return t||(t=new ea,mr.set(e,t)),t}function ta(e,t){const n=rr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function na(e,t,n,r){const o=je(n),a=o?ta(o,r):"";return`${e}|${t}|${n}|${a}`}function ra(e,t,n,r,o,a,s){const d=je(r);if(!d)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=xr(e),c=na(a,s,r,o),p=l.get(c);if(p)return p;const m=Qs(e,t,n,r,o),h=Math.min(t.width,n.width),v=Math.min(t.height,n.height),w={texture:m,width:h,height:v,displayRange:d.displayRange,bytes:h*v*8};return l.set(c,w),w}async function oa(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Rn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function sa(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,xr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const aa=`
${Fe}
${_n}
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
`,ia={unit:0,signed:1,relative:2},ca={linear:0,signed:1,positive:2};function la(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ua(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function da(e,t,n,r,o){var h;const a=ua(t),s=Zt(e,"diff-display",aa,a),d=la(e,o.colormap),l=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),c=new Float32Array([ia[r],ca[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]);let m;try{m=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:d},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:c}},{binding:4,resource:{uniform:p}}]),e.renderFullscreen(t,s,m)}finally{(h=m==null?void 0:m.destroy)==null||h.call(m),d.destroy()}}const br=.6*.6*2.51,fa=.6*.03,pa=0,vr=.6*.6*2.43,ha=.6*.59,ga=.14;function wr(e){const t=(fa-ha*e)/(br-vr*e),n=(pa-ga*e)/(br-vr*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const ma=.85,xa=.85,yr=11920928955078125e-23,Qt=[.2126,.7152,.0722];function ba(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function va(e,t,n,r=3,o={}){const a=t*n,s=wr(ma),d=wr(xa),l=new Float64Array(a);let c=0;for(let b=0;b<a;b++){const[_,M,P]=ba(e,b,r),y=_*Qt[0]+M*Qt[1]+P*Qt[2];l[b]=y,y>c&&(c=y)}const p=Float64Array.from(l).sort(),m=a>>1,h=a%2===1?p[m]:p[m-1],v=Math.max(h,yr),w=Math.max(c,yr),f=o.startExposure??Math.log2(s/w),x=o.stopExposure??Math.log2(d/v),g=Math.max(2,Math.ceil(x-f));return{startExposure:f,stopExposure:x,numExposures:g}}const wa={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ya({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:d,onViewportChange:l,processing:c=wa,interpolation:p="auto",label:m="",isDraggable:h=!1,onDragStart:v,overlay:w,overlaySettings:f,pixelValueNotation:x="decimal"}){var Q,me;const g=u.useRef(null),[b,_]=u.useState(null),[M,P]=u.useState(null),[y,A]=u.useState(x),[S,D]=u.useState(!1),k=u.useRef(null),T=u.useRef(null),C=u.useRef(null),E=u.useRef(null),[L,I]=u.useState(0);u.useEffect(()=>{if(!e){C.current=null,I(Y=>Y+1);return}let H=!1;return Ke(e).then(Y=>{H||(C.current=Y,I(ie=>ie+1))}),()=>{H=!0}},[e]),u.useEffect(()=>{if(!t){E.current=null,I(Y=>Y+1);return}let H=!1;return Ke(t).then(Y=>{H||(E.current=Y,I(ie=>ie+1))}),()=>{H=!0}},[t]);const O=H=>(Y,ie,we)=>{const be=H.current;if(!be||Y<0||ie<0||Y>=be.width||ie>=be.height)return null;const ye=(ie*be.width+Y)*4,Ce=be.data[ye],U=be.data[ye+1],F=be.data[ye+2],q=(.299*Ce+.587*U+.114*F)/255;return Ce===U&&U===F?{lines:[Je(Ce,"uint8",we)],luminance:q}:{lines:[Je(Ce,"uint8",we),Je(U,"uint8",we),Je(F,"uint8",we)],luminance:q,colors:[dt[0],dt[1],dt[2]]}},K=u.useMemo(()=>O(C),[]),Z=u.useMemo(()=>O(E),[]),oe=!!w&&!!(f!=null&&f.enabled)&&!!b&&!!e&&((((Q=w.boxes)==null?void 0:Q.length)??0)>0||(((me=w.masks)==null?void 0:me.length)??0)>0),{gammaFilterId:ae,filterStr:Ee,gamma:he,offset:Le}=Bn(c),ge=`translate(${d.x}px, ${d.y}px) scale(${s})`,_e=p==="auto"?void 0:p,{containerProps:xe,modifierActive:ve}=wn({containerRef:g,zoom:s,pan:d,onViewportChange:l});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(Nn,{id:ae,gamma:he,offset:Le}),i.jsxs("div",{ref:g,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...xe.style},onPointerDown:xe.onPointerDown,onPointerMove:xe.onPointerMove,onPointerUp:xe.onPointerUp,onPointerCancel:xe.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:[i.jsx("img",{ref:k,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ee,imageRendering:_e,...n==="blend"?{opacity:o}:{}},onLoad:H=>{const Y=H.currentTarget;_({w:Y.naturalWidth,h:Y.naturalHeight})}}),oe&&i.jsx(Ut,{data:w,settings:f,naturalWidth:b.w,naturalHeight:b.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:i.jsx("img",{ref:T,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ee,imageRendering:_e,...n==="blend"?{opacity:1-o}:{}},onLoad:H=>{const Y=H.currentTarget;P({w:Y.naturalWidth,h:Y.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:H=>{H.stopPropagation(),H.preventDefault();const Y=H.currentTarget;try{Y.setPointerCapture(H.pointerId)}catch{}const we=Y.parentElement.getBoundingClientRect(),be=Ce=>{a==null||a(Math.max(0,Math.min(1,(Ce.clientX-we.left)/we.width)))},ye=()=>{window.removeEventListener("pointermove",be),window.removeEventListener("pointerup",ye)};window.addEventListener("pointermove",be),window.addEventListener("pointerup",ye)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&M&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Qe,{imageElRef:T,naturalWidth:M.w,naturalHeight:M.h,zoom:s,pan:d,sample:Z,notation:y,version:L})}),e&&b&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Qe,{imageElRef:k,naturalWidth:b.w,naturalHeight:b.h,zoom:s,pan:d,sample:K,notation:y,version:L,onActiveChange:D})})]}):e&&b&&i.jsx(Qe,{imageElRef:k,naturalWidth:b.w,naturalHeight:b.h,zoom:s,pan:d,sample:K,notation:y,version:L,onActiveChange:D}),S&&i.jsx(En,{notation:y,onChange:A})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!ve?" cairn-drag-grip":""}`,draggable:h&&!ve,onDragStart:v,style:{cursor:h&&!ve?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),m]})]})}function Ea(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function _a({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:c=>{c==="side"?s==null||s():c==="slide"?r():c==="blend"?o():a(c)}}}}function Ma(e){const t=St(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Ta(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const l=e.data,c=new Uint16Array(o*4);for(let p=0;p<o;p++){const m=p*r,h=p*4;if(r===1){const v=l[m];c[h]=v,c[h+1]=v,c[h+2]=v,c[h+3]=it}else c[h]=l[m],c[h+1]=l[m+1],c[h+2]=l[m+2],c[h+3]=r>=4?l[m+3]:it}return{data:c,format:"rgba16float"}}const a=e.data,s=new Float32Array(o*4),d=l=>Number.isFinite(l)?l:0;for(let l=0;l<o;l++){const c=l*r;let p,m,h,v=1;r===1?p=m=h=d(a[c]):r===3?(p=d(a[c]),m=d(a[c+1]),h=d(a[c+2])):(p=d(a[c]),m=d(a[c+1]),h=d(a[c+2]),v=d(a[c+3]));const w=l*4;s[w]=p,s[w+1]=m,s[w+2]=h,s[w+3]=v}return{data:s,format:"rgba32float"}}function Sa({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:d,diffSubmode:l,colormap:c="none",diffKernel:p,onDiffKernelChange:m,onCompareModeChange:h,onRequestSide:v,zoom:w,pan:f,onViewportChange:x,interpolation:g="auto",label:b="",pixelValueNotation:_="decimal"}){var Mr;const M=u.useRef(null),P=u.useRef(null),y=u.useRef(null),A=u.useRef(null),S=u.useRef(null),[D,k]=u.useState(!1),[T,C]=u.useState(!1),[E,L]=u.useState(null),[I,O]=u.useState(0),[K,Z]=u.useState(0),[oe,ae]=u.useState(null),[Ee,he]=u.useState({x:0,y:0,w:1,h:1}),Le=p??l??"absolute",[ge,_e,xe]=ut(Le);u.useEffect(()=>{_e(p??l??"absolute")},[p,l,_e]);const ve=u.useCallback(R=>{_e(R),m==null||m(R)},[m,_e]);u.useEffect(()=>{const R=M.current;if(R)return R.__cairnDiffKernel={current:ge,set:ve},()=>{R&&delete R.__cairnDiffKernel}},[ge,ve]);const[Q,me,H]=ut(o);u.useEffect(()=>{me(o)},[o,me]);const Y=u.useCallback(R=>{me(R),h==null||h(R)},[h,me]),[ie,we,be]=ut(c);u.useEffect(()=>{we(c)},[c,we]);const ye=u.useCallback(()=>{Y(H.default),we(be.default),ve(xe.default)},[Y,we,ve,H.default,be.default,xe.default]),Ce=H.isModified||be.isModified||xe.isModified,[U,F]=u.useState(0),[q,X]=u.useState(0),j=u.useMemo(()=>{const re=[_a({mode:Q,kernel:ge,kernelOptions:hr().map(G=>({id:G.id,label:G.label})),onSide:v,onSlide:()=>Y("split"),onBlend:()=>Y("blend"),onKernel:G=>{Y("diff"),ve(G)}})];return Q==="diff"&&re.push(Wt(ie,G=>we(G))),re},[Q,ge,ie,ve,Y,v]),V=u.useRef(null),B=u.useRef(null),z=u.useRef(null),J=u.useRef(null),[ee,W]=u.useState(0),ne=u.useRef(null),[ke,Ae]=u.useState(0),fe=Nt();u.useEffect(()=>{const R=y.current;if(!R)return;let re=!1;return ot().then(G=>{if(!re)try{if(kn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const N=G.createSurface(R,{hdr:!1});A.current={device:G,surface:N,texA:null,texB:null},C(!0)}catch(N){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",N),k(!0)}}).catch(G=>{re||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",G),k(!0))}),()=>{var N,te;re=!0;const G=A.current;G&&((N=G.texA)==null||N.destroy(),(te=G.texB)==null||te.destroy(),A.current=null)}},[]),u.useEffect(()=>{const R=M.current;if(!R)return;const re=new ResizeObserver(()=>Z(G=>G+1));return re.observe(R),()=>re.disconnect()},[]),u.useEffect(()=>{if(!T)return;let R=!1;if(!A.current)return;async function G(N,te){if(te){const se=Ta(te);return{width:te.width,height:te.height,imageData:null,make:ue=>{const Te=ue.createTexture(te.width,te.height,se.format);return Te.write(se.data),Te}}}if(!N)return null;const le=await Ke(N);return le?{width:le.width,height:le.height,imageData:le,make:se=>{const ue=se.createTexture(le.width,le.height,"rgba8unorm");return ue.write(le.data),ue}}:null}return Promise.all([G(e,n),G(t,r)]).then(([N,te])=>{var ue,Te;if(R||!A.current)return;const le=A.current;V.current=(N==null?void 0:N.imageData)??null,B.current=(te==null?void 0:te.imageData)??null,z.current=n??null,J.current=r??null,(ue=le.texA)==null||ue.destroy(),(Te=le.texB)==null||Te.destroy(),le.texA=null,le.texB=null;const se=N??te;if(!se){L(null),W(De=>De+1);return}le.texA=(te??se).make(le.device),le.texB=(N??se).make(le.device),L({w:se.width,h:se.height}),W(De=>De+1),O(De=>De+1)}),()=>{R=!0}},[T,e,t,n,r]);const Me=n!=null||r!=null,ce=u.useMemo(()=>qs(ge,Me),[ge,Me]),Se=u.useMemo(()=>{if(!Me)return null;const R=r??n;if(!R)return null;const re=R.precision==="f16-bits"?fn(R.data):R.data;return va(re,R.width,R.height,R.channels)},[Me,r,n]),Ie=u.useMemo(()=>{var R;return Yr(((R=je(ce))==null?void 0:R.displayRange)??"unit",ie==="none"?null:ie)},[ce,ie]),He=u.useMemo(()=>ie!=="none"?Ma(ie):void 0,[ie]),Oe=u.useCallback(()=>{const R=A.current;if(!T||!R||!R.surface||!R.texA||!R.texB||!E)return;const re=M.current,G=re?re.getBoundingClientRect():{width:E.w,height:E.h},N=tr({zoom:w,pan:f},G,E.w,E.h);he(ue=>ue.x===N.x&&ue.y===N.y&&ue.w===N.w&&ue.h===N.h?ue:N);const te=y.current;if(G.width>0&&G.height>0&&te&&R.surface){const ue=Math.max(1,Math.round(G.width*fe)),Te=Math.max(1,Math.round(G.height*fe));(te.width!==ue||te.height!==Te)&&(te.width=ue,te.height=Te,R.surface.configure(ue,Te))}const le=nr(N,G,E.w,E.h)>=Ft?"nearest":"linear",se=N;try{if(Q==="diff"){const ue=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Te=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",De=je(ce)?ce:"absolute",Ye=De==="hdr-flip"&&Se?{ppd:67,startExposure:Se.startExposure,stopExposure:Se.stopExposure,numExposures:Se.numExposures}:void 0,nt=ra(R.device,R.texA,R.texB,De,Ye,ue,Te);S.current=nt,da(R.device,R.surface,nt.texture,nt.displayRange,{uv:se,cmapMode:Ie,colormap:He,filter:le,exposureEV:U,offset:q})}else{const ue={exposureEV:U,offset:q,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:se,filter:le,mode:Q,split:a,alpha:s};Lo(R.device,R.surface,R.texA,R.texB,ue)}}catch(ue){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ue),k(!0)}},[T,E,w,f.x,f.y,Q,a,s,U,q,ge,ce,Se,Ie,He,e,t,n,r,fe]);u.useEffect(()=>{Oe()},[Oe,I,K]);const wt=t!=null||r!=null;u.useEffect(()=>{const R=A.current;if(!T||!R||!R.texA||!R.texB||!wt){ae(null);return}let re=!1;const G=R.texA,N=R.texB,te=S.current;return(Q==="diff"&&te?oa(R.device,te,G,N):Rn(R.device,G,N)).then(se=>{re||ae(se)}),()=>{re=!0}},[T,I,wt,Q,ge]),u.useEffect(()=>{if(Q!=="diff"){ne.current=null;return}const R=A.current,re=S.current;if(!T||!R||!re)return;let G=!1;return ne.current=null,Ae(N=>N+1),sa(R.device,re).then(N=>{G||(ne.current=N,Ae(te=>te+1))}).catch(()=>{}),()=>{G=!0}},[T,Q,ce,I]);const Er=(R,re)=>(G,N,te)=>{const le=re.current;if(le){const{data:Tr,width:Sr,height:La,channels:Pr}=le;if(G<0||N<0||G>=Sr||N>=La)return null;const yt=(N*Sr+G)*Pr,Et=le.precision==="f16-bits"?jt=>ct(Tr[jt]??0):jt=>Tr[jt]??0,Ia=.5,Oa=Pr===1?[Et(yt)]:[Et(yt),Et(yt+1),Et(yt+2)];return Ze(Oa,"unit",te,Ia)}const se=R.current;if(!se||G<0||N<0||G>=se.width||N>=se.height)return null;const ue=(N*se.width+G)*4,Te=se.data[ue],De=se.data[ue+1],Ye=se.data[ue+2],nt=(.299*Te+.587*De+.114*Ye)/255;return Ze(Te===De&&De===Ye?[Te]:[Te,De,Ye],"uint8",te,nt)},_r=u.useMemo(()=>Er(V,z),[]),Aa=u.useMemo(()=>Er(B,J),[]),Ra=u.useMemo(()=>(R,re,G)=>{var Ye;const N=ne.current;if(!N||!E)return null;const{w:te,h:le}=E;if(R<0||re<0||R>=te||re>=le)return null;const se=(re*te+R)*4,ue=((Ye=je(ce))==null?void 0:Ye.output)??"per-channel",Te=.5,De=ue==="scalar"?[N[se]??0]:[N[se]??0,N[se+1]??0,N[se+2]??0];return Ze(De,"unit",G,Te)},[E,ce]),ka=g==="auto"?void 0:g;if(D)return n!=null||r!=null?i.jsx(Ea,{}):Q==="diff"?i.jsx(Ht,{imageUrl:e,baselineUrl:t,diffMode:((Mr=je(ce))==null?void 0:Mr.kind)==="pointwise"?ce:"absolute",interpolation:g,colormap:ie,showAxes:!1,zoom:w,pan:f,onViewportChange:x,label:b,pixelValueNotation:_}):i.jsx(ya,{imageUrl:e,baselineUrl:t,mode:Q,splitPosition:a,blendAlpha:s,onSplitPositionChange:d,zoom:w,pan:f,onViewportChange:x,interpolation:g,label:b,pixelValueNotation:_});const Da=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:y,className:"w-full h-full block",style:{imageRendering:ka},"data-gpu-compare-canvas":!0}),Q==="split"&&i.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:R=>{R.stopPropagation(),d==null||d(.5)},onPointerDown:R=>{R.stopPropagation(),R.preventDefault();const re=R.currentTarget;try{re.setPointerCapture(R.pointerId)}catch{}const N=re.parentElement.getBoundingClientRect(),te=se=>{d==null||d(Math.max(0,Math.min(1,(se.clientX-N.left)/N.width)))},le=()=>{window.removeEventListener("pointermove",te),window.removeEventListener("pointerup",le)};window.addEventListener("pointermove",te),window.addEventListener("pointerup",le)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return i.jsx(ht,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":T},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:M,wrapperRef:P,zoom:w,pan:f,onViewportChange:x,naturalDims:E,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Da,showAxes:!1,notationSeed:_,onReset:ye,extraModified:Ce,exportCanvasRef:y,requestRender:Oe,leadingMenus:j,displayAdjust:{exposureEV:U,offset:q,onExposureChange:F,onOffsetChange:X},label:"",showLabelChip:!1,overlay:{render:({notation:R,setOverlayActive:re})=>Q==="split"?i.jsxs(i.Fragment,{children:[wt&&E&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(Qe,{imageElRef:y,naturalWidth:E.w,naturalHeight:E.h,zoom:w,pan:f,sourceWindow:Ee,sample:Aa,notation:R,version:ee})}),wt&&E&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(Qe,{imageElRef:y,naturalWidth:E.w,naturalHeight:E.h,zoom:w,pan:f,sourceWindow:Ee,sample:_r,notation:R,version:ee,onActiveChange:re})})]}):E&&i.jsx(Qe,{imageElRef:y,naturalWidth:E.w,naturalHeight:E.h,zoom:w,pan:f,sourceWindow:Ee,sample:Q==="diff"?Ra:_r,notation:R,version:Q==="diff"?ke:ee,onActiveChange:re})},extraChips:i.jsxs(i.Fragment,{children:[Q==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),b?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:b}):null,oe&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${b?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",oe.mse.toExponential(2)," · PSNR ",Number.isFinite(oe.psnr)?oe.psnr.toFixed(1):"∞"," dB · MAE"," ",oe.mae.toExponential(2)]})]})})}const Pa="cairn-plot:gpu-image-ready";async function Ca(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await ot(),window.__cairnPlotGpuImagePane=Cs,window.__cairnPlotGpuComparePane=Sa,window.__cairnPlotDiffMenuModes=hr(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Pa))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),er("no-webgpu")}}}Ca()})(__cairnPlotJsxRuntime,__cairnPlotReact);
