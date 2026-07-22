var Za=Object.defineProperty;var Qa=(i,l,Ve)=>l in i?Za(i,l,{enumerable:!0,configurable:!0,writable:!0,value:Ve}):i[l]=Ve;var le=(i,l,Ve)=>Qa(i,typeof l!="symbol"?l+"":l,Ve);(function(i,l){"use strict";const Ve=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function on(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Ve}),{hdr:!1,format:n}}function Ur(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Ve}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Ve}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return on(e,t)}}}const Fr=`
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
`;function Mt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function sn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Gr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const zr={texture:0,sampler:1,uniform:2};function St(e,t){return e*3+zr[t]}const Vr={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function $r(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const d=Vr[s];if(d===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:d})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class an{constructor(t,n,r,o){le(this,"width");le(this,"height");le(this,"format");le(this,"gpuTexture");le(this,"device");le(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Mt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*sn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class cn{constructor(t){le(this,"_s");le(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Xr{constructor(t,n,r,o,a){le(this,"_p");le(this,"gpuPipeline");le(this,"bindings");le(this,"bindGroupLayout");le(this,"variants");le(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Wr(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Hr{constructor(t){le(this,"_c");le(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Kr{constructor(t,n){le(this,"_b");le(this,"gpuBindGroup");le(this,"ownedBuffers");le(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Yr{constructor(t,n,r,o){le(this,"canvas");le(this,"hdr");le(this,"format");le(this,"context");le(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function rt(e){return"canvas"in e}async function qr(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(f){return rt(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function s(f){if(rt(f))return{width:f.canvas.width,height:f.canvas.height};const x=f;return{width:x.width,height:x.height}}let d=!1,u=null;function c(){var x,m;if(u!==null)return u;let f=!1;try{if(typeof document<"u"){const b=document.createElement("canvas");b.width=1,b.height=1;const _=b.getContext("webgpu");if(_)try{_.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const M=(x=_.getConfiguration)==null?void 0:x.call(_);f=((m=M==null?void 0:M.toneMapping)==null?void 0:m.mode)==="extended"}catch{f=!1}finally{try{_.unconfigure()}catch{}}}}catch{f=!1}return u=f,f}const p=256;let g=null,h=null;function v(){if(!g||!h){const f=t.createShaderModule({code:Fr});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const x=t.createPipelineLayout({bindGroupLayouts:[h]});g=t.createComputePipeline({layout:x,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:g,layout:h}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:c,createTexture(f,x,m){return new an(t,f,x,m)},createSampler(f){const x=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",m=t.createSampler({magFilter:x,minFilter:x,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new cn(m)},createRenderPipeline(f){const x=t.createShaderModule({code:f.shaderWGSL}),m=$r(f.shaderWGSL),b=Mt(f.targetFormat),_=Wr(t,m),M=t.createPipelineLayout({bindGroupLayouts:[_]}),P=R=>t.createRenderPipeline({layout:M,vertex:{module:x,entryPoint:"vs_main"},fragment:{module:x,entryPoint:"fs_main",targets:[{format:R}]},primitive:{topology:"triangle-list"}}),y=P(b);return new Xr(y,m,_,b,P)},createComputePipeline(f){const x=t.createShaderModule({code:f.shaderWGSL}),m=t.createComputePipeline({layout:"auto",compute:{module:x,entryPoint:"cs_main"}});return new Hr(m)},createBindGroup(f,x){const m=f,b=new Map,_=[];for(const[P,y]of m.bindings)if(y.kind==="uniform"){const R=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});_.push(R),b.set(P,{binding:P,resource:{buffer:R}})}else y.kind==="sampler"&&b.set(P,{binding:P,resource:o()});for(const P of x){const y=P.resource;if(y instanceof an){const R=St(P.binding,"texture");m.bindings.has(R)&&b.set(R,{binding:R,resource:y.gpuTexture.createView()})}else if(y instanceof cn){const R=St(P.binding,"sampler");m.bindings.has(R)&&b.set(R,{binding:R,resource:y.gpuSampler})}else{const R=St(P.binding,"uniform"),T=m.bindings.get(R);if(T&&T.kind==="uniform"){const k=y.uniform,D=t.createBuffer({size:Math.max(T.sizeBytes,k.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(D,0,k.buffer,k.byteOffset,k.byteLength),_.push(D),b.set(R,{binding:R,resource:{buffer:D}})}}}const M=t.createBindGroup({layout:m.bindGroupLayout,entries:Array.from(b.values())});return new Kr(M,_)},createSurface(f,x){const m=f.getContext("webgpu");if(!m)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const b=x.hdr&&n.hdr,_=()=>b?Ur(m,t):on(m,t),M=_();return new Yr(f,m,M,_)},renderFullscreen(f,x,m){const b=x,_=m,M=a(f),{width:P,height:y}=s(f),R=rt(f)?f.format:Mt(f.format),T=b.pipelineFor(R),k=t.createCommandEncoder(),D=k.beginRenderPass({colorAttachments:[{view:M,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});D.setPipeline(T),D.setBindGroup(0,_.gpuBindGroup),D.setViewport(0,0,P,y,0,1),D.draw(3),D.end(),t.queue.submit([k.finish()])},async readback(f){const x=rt(f),{width:m,height:b}=s(f),_=x?f.hdr?"rgba16float":"rgba8unorm":f.format,M=x&&f.format==="bgra8unorm",P=x?f.getCurrentGPUTexture():f.gpuTexture,y=sn(_),R=m*y,T=256,k=Math.ceil(R/T)*T,D=k*b,S=t.createBuffer({size:D,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),A=t.createCommandEncoder();A.copyTextureToBuffer({texture:P},{buffer:S,bytesPerRow:k,rowsPerImage:b},{width:m,height:b,depthOrArrayLayers:1}),t.queue.submit([A.finish()]),await S.mapAsync(GPUMapMode.READ);const E=new Uint8Array(S.getMappedRange()),L=new Uint8Array(R*b);for(let I=0;I<b;I++){const B=I*k,Z=I*R;L.set(E.subarray(B,B+R),Z)}if(S.unmap(),S.destroy(),_==="rgba8unorm"){if(M)for(let I=0;I<L.length;I+=4){const B=L[I],Z=L[I+2];L[I]=Z,L[I+2]=B}return L}if(_==="rgba16float"){const I=new Uint16Array(L.buffer,L.byteOffset,L.byteLength/2),B=new Float32Array(I.length);for(let Z=0;Z<I.length;Z++)B[Z]=Gr(I[Z]);return B}return new Float32Array(L.buffer,L.byteOffset,L.byteLength/4)},async reduceDiffSumSquaredAbs(f,x,m,b){const _=f,M=x,P=Math.max(0,m*b),y=Math.max(1,Math.ceil(P/p)),{pipeline:R,layout:T}=v(),k=y*2*4,D=t.createBuffer({size:k,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),S=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(S,0,new Uint32Array([Math.max(1,m),Math.max(1,b),P,0]));const A=t.createBindGroup({layout:T,entries:[{binding:0,resource:_.gpuTexture.createView()},{binding:1,resource:M.gpuTexture.createView()},{binding:2,resource:{buffer:D}},{binding:3,resource:{buffer:S}}]}),E=t.createBuffer({size:k,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),L=t.createCommandEncoder(),I=L.beginComputePass();I.setPipeline(R),I.setBindGroup(0,A),I.dispatchWorkgroups(y),I.end(),L.copyBufferToBuffer(D,0,E,0,k),t.queue.submit([L.finish()]),await E.mapAsync(GPUMapMode.READ);const Z=new Float32Array(E.getMappedRange()).slice();E.unmap(),E.destroy(),D.destroy(),S.destroy();let j=0,oe=0;for(let ie=0;ie<y;ie++)j+=Z[ie*2],oe+=Z[ie*2+1];return{sumSq:j,sumAbs:oe}},destroy(){d||(t.destroy(),d=!0)},isContextLost(){return!1}}}let Tt=null;async function Zr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return qr()}function ot(){return Tt||(Tt=Zr()),Tt}function Qr(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function jr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),d=o-a,[u,c,p]=Qr(e[a],e[s],d);t[n*3]=Math.round(u),t[n*3+1]=Math.round(c),t[n*3+2]=Math.round(p)}return t}const ln={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Jr=new Set(["red-green","red-blue"]),un=new Map;function Pt(e){let t=un.get(e);if(!t){const n=ln[e]??ln.viridis;t=jr(n),un.set(e,t)}return t}const Oe=e=>e<0?0:e>1?1:e,At=e=>{const t=e<0?0:e;return t/(1+t)},Ct=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Oe(n/r)},dn={linear:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],srgb:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],reinhard:([e,t,n])=>[At(e),At(t),At(n)],aces:([e,t,n])=>[Ct(e),Ct(t),Ct(n)],extended:([e,t,n])=>[e,t,n]},eo="srgb";function to(e){return e&&dn[e]||dn[eo]}function st(e,t,n){return e*2**t+n}function no(e){const t=Oe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Rt(e,t){return typeof t=="number"&&t>0?Oe(Math.pow(Oe(e),1/t)):no(e)}function Dt(e,t,n="linear",r=0,o=0){const a=Pt(t),s=new ImageData(e.width,e.height),d=e.data,u=s.data,c=r!==0||o!==0;for(let p=0;p<d.length;p+=4){let g=(d[p]+d[p+1]+d[p+2])/3;c&&(g=Math.max(0,Math.min(255,st(g/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+g/255*127):h=Math.round(g),h=Math.max(0,Math.min(255,h)),u[p]=a[h*3],u[p+1]=a[h*3+1],u[p+2]=a[h*3+2],u[p+3]=d[p+3]}return s}function ro(e,t){return e==="signed"||e==="relative"?"signed":kt(t)}function kt(e){return Jr.has(e??"")?"positive":"linear"}function fn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const pn=fn(50);function Lt(e){return pn.get(e)}function It(e,t){pn.set(e,t)}const hn=fn(100);function oo(e){return hn.get(e)}function so(e,t){hn.set(e,t)}function ao(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let d=0;d<r;d++){const u=(s*e.width+d)*4,c=(s*t.width+d)*4,p=(s*r+d)*4;for(let g=0;g<3;g++){const h=e.data[u+g],v=t.data[c+g],w=h-v,f=Math.abs(w),x=Math.max(h,1);let m;switch(n){case"signed":m=(w+255)/2;break;case"absolute":m=f;break;case"squared":m=w*w/255;break;case"relative_signed":m=(w/x+1)*127.5;break;case"relative_absolute":m=f/x*255;break;case"relative_squared":m=w*w/(x*x)*255;break}a.data[p+g]=Math.min(255,Math.max(0,Math.round(m)))}a.data[p+3]=255}return a}async function qe(e){const t=oo(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);so(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const io={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},co={linear:0,signed:1,positive:2},lo=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,uo=`#version 300 es
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
}`;let Ze=null,X=null,Re=null,at=null;function fo(){if(X)return X;try{if(typeof OffscreenCanvas<"u"?Ze=new OffscreenCanvas(1,1):Ze=document.createElement("canvas"),X=Ze.getContext("webgl2",{preserveDrawingBuffer:!0}),!X)return console.warn("[cairn] WebGL 2 not available"),null;const e=X.createShader(X.VERTEX_SHADER);if(X.shaderSource(e,lo),X.compileShader(e),!X.getShaderParameter(e,X.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",X.getShaderInfoLog(e)),null;const t=X.createShader(X.FRAGMENT_SHADER);if(X.shaderSource(t,uo),X.compileShader(t),!X.getShaderParameter(t,X.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",X.getShaderInfoLog(t)),null;if(Re=X.createProgram(),X.attachShader(Re,e),X.attachShader(Re,t),X.linkProgram(Re),!X.getProgramParameter(Re,X.LINK_STATUS))return console.error("[cairn] WebGL program link:",X.getProgramInfoLog(Re)),null;at=X.createVertexArray(),X.bindVertexArray(at);const n=X.createBuffer();X.bindBuffer(X.ARRAY_BUFFER,n),X.bufferData(X.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),X.STATIC_DRAW);const r=X.getAttribLocation(Re,"a_pos");return X.enableVertexAttribArray(r),X.vertexAttribPointer(r,2,X.FLOAT,!1,0,0),X.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),X}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function mn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function po(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function ho(e,t,n,r){const o=fo();if(!o||!Re||!at||!Ze)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);Ze.width=a,Ze.height=s,o.viewport(0,0,a,s);const d=mn(o,e,0),u=mn(o,t,1);let c=null;n.colormap?c=po(o,n.colormap,2):(c=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,c),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Re),o.uniform1i(o.getUniformLocation(Re,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Re,"u_other"),1),o.uniform1i(o.getUniformLocation(Re,"u_lut"),2),o.uniform1i(o.getUniformLocation(Re,"u_diff_mode"),io[n.diffMode]),o.uniform1i(o.getUniformLocation(Re,"u_cmap_mode"),co[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Re,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(at),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(Ze,0,0,a,s,0,-s,a,s),p.restore()),o.deleteTexture(d),o.deleteTexture(u),o.deleteTexture(c),{width:a,height:s}}const mo="cairn:render-mode";function go(){try{const e=localStorage.getItem(mo);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const it=15360;function ct(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const gn=globalThis.Float16Array;function xn(e,t=e.length){if(gn){const r=new gn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=ct(e[r]);return n}const Ne=new Uint32Array(512),Ue=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ne[e]=0,Ne[e|256]=32768,Ue[e]=24,Ue[e|256]=24):t<-14?(Ne[e]=1024>>-t-14,Ne[e|256]=1024>>-t-14|32768,Ue[e]=-t-1,Ue[e|256]=-t-1):t<=15?(Ne[e]=t+15<<10,Ne[e|256]=t+15<<10|32768,Ue[e]=13,Ue[e|256]=13):t<128?(Ne[e]=31744,Ne[e|256]=64512,Ue[e]=24,Ue[e|256]=24):(Ne[e]=31744,Ne[e|256]=64512,Ue[e]=13,Ue[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var nt=Uint8Array,bn=Uint16Array,xo=Int32Array,bo=new nt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),vo=new nt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),vn=function(e,t){for(var n=new bn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new xo(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},wn=vn(bo,2),wo=wn.b,yo=wn.r;wo[28]=258,yo[258]=28,vn(vo,0);for(var Eo=new bn(32768),de=0;de<32768;++de){var $e=(de&43690)>>1|(de&21845)<<1;$e=($e&52428)>>2|($e&13107)<<2,$e=($e&61680)>>4|($e&3855)<<4,Eo[de]=(($e&65280)>>8|($e&255)<<8)>>1}for(var lt=new nt(288),de=0;de<144;++de)lt[de]=8;for(var de=144;de<256;++de)lt[de]=9;for(var de=256;de<280;++de)lt[de]=7;for(var de=280;de<288;++de)lt[de]=8;for(var _o=new nt(32),de=0;de<32;++de)_o[de]=5;var Mo=new nt(0),So=typeof TextDecoder<"u"&&new TextDecoder,To=0;try{So.decode(Mo,{stream:!0}),To=1}catch{}typeof FinalizationRegistry>"u"||new FinalizationRegistry(e=>Po.__wbg_decodedimage_free(e,1));let yn=new Array(1024).fill(void 0);yn.push(void 0,null,!0,!1),yn.length,new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}).decode();let Po;const En=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Bt(e){const t=En.length;return En[(e%t+t)%t]}function Ao(e){const n=l.useRef(null),[r,o]=l.useState({w:0,h:0}),a=l.useRef(null),s=l.useRef(null),d=l.useRef(null),u=l.useCallback((c,p)=>{o(g=>g.w===c&&g.h===p?g:{w:c,h:p})},[]);return l.useLayoutEffect(()=>{const c=n.current;if(!c||c===d.current)return;const p=c.getBoundingClientRect();(p.width>0||p.height>0)&&(d.current=c,u(p.width,p.height))}),l.useEffect(()=>{var g;const c=n.current;if(c===s.current||((g=a.current)==null||g.disconnect(),a.current=null,s.current=c,!c))return;const p=new ResizeObserver(h=>{for(const v of h)u(v.contentRect.width,v.contentRect.height)});a.current=p,p.observe(c)}),l.useEffect(()=>()=>{var c;return(c=a.current)==null?void 0:c.disconnect()},[]),{ref:n,size:r}}function Co(){const[e,t]=l.useState(!1);return l.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Ro=.001;function Do(e,t=Ro){return Math.exp(-e*t)}function _n(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function Mn(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function ko(e,t,n,r,o,a,s){const d=t>0&&r>0?r/t:1,u=Math.max(a,Math.min(s,e.zoom*d)),c=(n.x-e.pan.x)/e.zoom,p=(n.y-e.pan.y)/e.zoom;return{zoom:u,pan:{x:o.x-c*u,y:o.y-p*u}}}const Lo=.25,Ot=64;function Nt(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Ot;const o=Math.min(n/e,r/t);return o<=0?Ot:Math.max(Math.max(n,r)/o,8)}function Sn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=Lo,maxZoom:s=Ot,naturalWidth:d,naturalHeight:u}=e,c=Co(),p=l.useRef(c);p.current=c;const g=l.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const h=l.useRef(o);h.current=o,l.useEffect(()=>{const T=t.current;if(!T||!o)return;const k=D=>{var ie;if(!D.ctrlKey&&!p.current)return;D.preventDefault(),D.stopPropagation();const S=Do(D.deltaY),A=g.current,E=T.getBoundingClientRect(),L=d&&u?Nt(d,u,E.width,E.height):s,I=Math.max(a,Math.min(L,A.zoom*S));if(A.zoom===I)return;const B=D.clientX-E.left,Z=D.clientY-E.top,j=B-(B-A.pan.x)/A.zoom*I,oe=Z-(Z-A.pan.y)/A.zoom*I;(ie=h.current)==null||ie.call(h,{zoom:I,pan:{x:j,y:oe}})};return T.addEventListener("wheel",k,{passive:!1}),()=>T.removeEventListener("wheel",k)},[t,!!o,a,s,d,u]);const v=l.useRef(new Map),w=l.useRef(null),f=l.useRef(null),x=l.useCallback((T,k,D)=>{const S=T.getBoundingClientRect();return{x:k-S.left,y:D-S.top}},[]),m=l.useCallback(T=>{if(!d||!u)return s;const k=T.getBoundingClientRect();return Nt(d,u,k.width,k.height)},[d,u,s]),b=l.useCallback((T,k)=>{const D=v.current,S=D.get(T),A=D.get(k);!S||!A||(w.current=null,f.current={idA:T,idB:k,startDist:_n(S,A),startMid:Mn(S,A),startZoom:g.current.zoom,startPan:{...g.current.pan}})},[]),_=l.useCallback(T=>{const k=v.current.get(T);k&&(w.current={pointerId:T,startX:k.x,startY:k.y,panX:g.current.pan.x,panY:g.current.pan.y})},[]),M=l.useCallback(T=>{if(!h.current)return;const k=T.pointerType==="touch";if(!k&&!p.current)return;const D=T.currentTarget;if(D.setPointerCapture(T.pointerId),v.current.set(T.pointerId,x(D,T.clientX,T.clientY)),k&&v.current.size>=2){const S=[...v.current.keys()];b(S[S.length-2],S[S.length-1]);return}_(T.pointerId)},[x,b,_]),P=l.useCallback(T=>{var E,L;const k=T.currentTarget,D=v.current.get(T.pointerId);if(D){const I=x(k,T.clientX,T.clientY);D.x=I.x,D.y=I.y}const S=f.current;if(S){const I=v.current.get(S.idA),B=v.current.get(S.idB);if(!I||!B)return;const Z=ko({zoom:S.startZoom,pan:S.startPan},S.startDist,S.startMid,_n(I,B),Mn(I,B),a,m(k));(E=h.current)==null||E.call(h,Z);return}const A=w.current;!A||A.pointerId!==T.pointerId||!D||(L=h.current)==null||L.call(h,{zoom:g.current.zoom,pan:{x:A.panX+(D.x-A.startX),y:A.panY+(D.y-A.startY)}})},[x,a,m]),y=l.useCallback(T=>{var D;try{T.currentTarget.releasePointerCapture(T.pointerId)}catch{}v.current.delete(T.pointerId);const k=f.current;if(k&&(T.pointerId===k.idA||T.pointerId===k.idB)){f.current=null;const S=[...v.current.keys()];S.length===1&&_(S[0]);return}((D=w.current)==null?void 0:D.pointerId)===T.pointerId&&(w.current=null)},[_]);return{containerProps:{onPointerDown:M,onPointerMove:P,onPointerUp:y,onPointerCancel:y,style:{cursor:c&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:c}}function Ut(){const[e,t]=l.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return l.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ut(e){const t=l.useRef(e),[n,r]=l.useState(e),o=l.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Io(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Tn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Ft({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=Ao(),s=l.useRef(null),d=l.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),u=l.useMemo(()=>{const f=a.w,x=a.h;if(f<=0||x<=0||n<=0||r<=0)return null;const m=Math.min(f/n,x/r),b=n*m,_=r*m;return{left:(f-b)/2,top:(x-_)/2,width:b,height:_}},[a.w,a.h,n,r]),c=e.masks,p=t.showMasks&&!!c&&c.length>0,g=l.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(l.useEffect(()=>{if(!p||!c)return;const f=s.current;if(!f)return;(f.width!==n||f.height!==r)&&(f.width=n,f.height=r);const x=f.getContext("2d");if(!x)return;x.clearRect(0,0,f.width,f.height);let m=!1;const b=x.createImageData(n,r),_=b.data;let M=c.length,P=!1;const y=()=>{m||P&&x.putImageData(b,0,0)},R=document.createElement("canvas");R.width=n,R.height=r;const T=R.getContext("2d",{willReadFrequently:!0});for(const k of c){const D=new Image;D.onload=()=>{if(!m){if(T){T.clearRect(0,0,n,r),T.drawImage(D,0,0,n,r);const S=T.getImageData(0,0,n,r).data;for(let A=0;A<n*r;A++){const E=S[A*4];if(E===0||d.has(E))continue;const[L,I,B]=Io(Bt(E));_[A*4]=L,_[A*4+1]=I,_[A*4+2]=B,_[A*4+3]=255,P=!0}}M-=1,M===0&&y()}},D.onerror=()=>{M-=1,M===0&&y()},D.src=`data:image/png;base64,${k.png_b64}`}return()=>{m=!0}},[p,c,n,r,g]),!u)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],v=t.showBoxes&&h.length>0,w=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),v&&i.jsx("svg",{className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((f,x)=>{if(!Tn(f,t,d))return null;const m=f.domain==="pixel"?1:n,b=f.domain==="pixel"?1:r,_=f.position.minX*m,M=f.position.minY*b,P=(f.position.maxX-f.position.minX)*m,y=(f.position.maxY-f.position.minY)*b;return i.jsx("rect",{x:_,y:M,width:P,height:y,fill:"none",stroke:Bt(f.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},x)})}),v&&i.jsx("div",{className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height},children:h.map((f,x)=>{if(!Tn(f,t,d))return null;const m=f.domain==="pixel"?1/n:1,b=f.domain==="pixel"?1/r:1,_=f.position.minX*m*100,M=f.position.minY*b*100,P=f.label??w[String(f.class_id)]??`#${f.class_id}`,y=f.score!=null?` ${(f.score*100).toFixed(0)}%`:"";return!P&&!y?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${_}%`,top:`${M}%`,transform:"translateY(-100%)",backgroundColor:Bt(f.class_id)},children:i.jsxs("span",{className:"mono",children:[P,y]})},x)})})]})}const Gt=30,dt=["#ff5a5a","#39d353","#5b9bff"];function zt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function et(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):zt(e/255):zt(n==="int"?e*255:e)}function Qe(e,t,n,r){return e.length===1?{lines:[et(e[0],t,n)],luminance:r}:{lines:e.map(o=>et(o,t,n)),luminance:r,colors:e.map((o,a)=>dt[a]??null)}}const Bo={x:0,y:0,w:1,h:1};function je({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:d=0,onActiveChange:u,sourceWindow:c=Bo}){const p=l.useRef(null),g=l.useRef(!1),h=Ut(),v=l.useRef(u);v.current=u;const w=l.useCallback(x=>{var m;x!==g.current&&(g.current=x,(m=v.current)==null||m.call(v,x))},[]),f=l.useCallback(()=>{var we;const x=p.current,m=e.current;if(!x)return;const b=window.devicePixelRatio||1,_=x.clientWidth,M=x.clientHeight;if(_===0||M===0)return;x.width!==Math.round(_*b)&&(x.width=Math.round(_*b)),x.height!==Math.round(M*b)&&(x.height=Math.round(M*b));const P=x.getContext("2d");if(!P)return;if(P.setTransform(b,0,0,b,0,0),P.clearRect(0,0,_,M),!m||t<=0||n<=0){w(!1);return}const y=m.getBoundingClientRect(),R=x.getBoundingClientRect();if(y.width===0||y.height===0){w(!1);return}const T=c.x*t,k=c.y*n,D=c.w*t,S=c.h*n;if(D<=0||S<=0){w(!1);return}const A=Math.min(y.width/D,y.height/S);if(A<Gt){w(!1);return}const E=D*A,L=S*A,I=y.left+(y.width-E)/2-R.left,B=y.top+(y.height-L)/2-R.top,Z=Math.max(Math.floor(T),Math.floor(T+(0-I)/A)),j=Math.min(Math.ceil(T+D),Math.ceil(T+(_-I)/A)),oe=Math.max(Math.floor(k),Math.floor(k+(0-B)/A)),ie=Math.min(Math.ceil(k+S),Math.ceil(k+(M-B)/A));if(j<=Z||ie<=oe){w(!1);return}w(!0);const _e=I+(0-T)*A,fe=B+(0-k)*A,Be=I+(t-T)*A,pe=B+(n-k)*A;P.save(),P.beginPath(),P.rect(_e,fe,Be-_e,pe-fe),P.clip(),P.textAlign="center",P.textBaseline="middle",P.lineJoin="round";const Me=A*.14,be=A-Me*2;for(let Y=oe;Y<ie;Y++)for(let he=Z;he<j;he++){if(he<0||Y<0||he>=t||Y>=n)continue;const K=a(he,Y,s);if(!K||K.lines.length===0)continue;const q=K.lines.length;let ce=1;for(const $ of K.lines)$.length>ce&&(ce=$.length);const ye=be/(q*1.15),ve=be/(ce*.62)||ye,Ee=Math.min(ye,ve,24);if(Ee<6)continue;const Ce=I+(he-T+.5)*A,F=B+(Y-k+.5)*A,G=Ee*1.15,Q=K.luminance<=.55,W=Q?"#ffffff":"#000000";P.font=`${Ee}px ui-monospace, SFMono-Regular, Menlo, monospace`,P.lineWidth=Math.max(1.4,Ee*.16),P.strokeStyle=Q?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let J=F-q*G/2+G/2;for(let $=0;$<K.lines.length;$++){const O=K.lines[$];P.strokeText(O,Ce,J),P.fillStyle=((we=K.colors)==null?void 0:we[$])??W,P.fillText(O,Ce,J),J+=G}}P.restore()},[e,t,n,a,s,w,c]);return l.useEffect(()=>{f()},[f,r,o.x,o.y,d,s,c,h]),l.useEffect(()=>{const x=p.current;if(!x)return;const m=new ResizeObserver(()=>f());return m.observe(x),()=>m.disconnect()},[f]),i.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Pn({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Oo=`
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
`,An=`
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
`,No=`
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
`;function Cn(e){return`
${Ie}
${An}
${No}

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
`}const Uo=Cn("select(colorB, colorA, uv.x < split)"),Fo=Cn("mix(colorA, colorB, alpha)"),Vt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Rn=new WeakMap;function Go(e,t){let n=Rn.get(e);n||(n=new Map,Rn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Oo,targetFormat:t}),n.set(t,r)),r}function Dn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function kn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function zo(e,t,n,r){var f;const o=Dn(t),a=Go(e,o),s=kn(e,r.isScalar?r.colormap:void 0),d=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,u=Vt[r.operator]??Vt.srgb,c=new Float32Array([r.exposureEV,u,d,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),v=new Float32Array([r.offset??0]);let w;try{w=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,a,w)}finally{(f=w==null?void 0:w.destroy)==null||f.call(w),s.destroy()}}const Ln=new WeakMap;function Vo(e,t,n){let r=Ln.get(e);r||(r=new Map,Ln.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?Uo:Fo,targetFormat:n}),r.set(o,a)),a}function $o(e,t,n,r,o){var f;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Dn(t),s=Vo(e,o.mode,a),d=kn(e,void 0),u=o.gamma,c=Vt[o.operator],p=new Float32Array([o.exposureEV,c,u,0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),v=new Float32Array([o.offset??0,0,0,0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:d},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,s,w)}finally{(f=w==null?void 0:w.destroy)==null||f.call(w),d.destroy()}}function In(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function Bn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:h,sumAbs:v}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return In(h,v,a)}const s=await e.readback(t),d=await e.readback(n),u=s instanceof Uint8Array,c=d instanceof Uint8Array;let p=0,g=0;for(let h=0;h<o;h++)for(let v=0;v<r;v++){const w=(h*t.width+v)*4,f=(h*n.width+v)*4;for(let x=0;x<3;x++){const m=(s[w+x]??0)/(u?255:1),b=(d[f+x]??0)/(c?255:1),_=m-b;p+=_*_,g+=Math.abs(_)}}return In(p,g,a)}function On(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Xo=12,Xe=[];function Nn(e){const t=Xe.indexOf(e);t!==-1&&Xe.splice(t,1),Xe.push(e)}function Wo(e){const t=Xe.indexOf(e);t!==-1&&Xe.splice(t,1)}function pt(e){e.parked||(Wo(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Un(e){for(;Xe.length>Xo;){const t=Xe.find(n=>n!==e&&!n.visible)??Xe.find(n=>n!==e);if(!t)break;pt(t)}}function Fn(e){var o,a;if(e.disposed)return;if(On())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Nn(e),Un(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,Nn(e),Un(e)}function Ho(e,t){if(e.disposed||!e.source)return!0;try{return Fn(e),!e.surface||!e.srcTexture?!1:(zo(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,pt(e),!1}}function Ko(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Ho(e,t)},park(){e.disposed||pt(e)},restore(){e.disposed||!e.source||Fn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(pt(e),e.source=null,e.disposed=!0)}}}async function Yo(e,t){const n=await ot(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Ko(r)}function Gn(e){e.dispose()}function qo(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function zn(e){const n=`cairn-gamma-${l.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:d,flipSign:u}=e,c=l.useMemo(()=>qo(e,n),[n,r,o,s,u]);return{gammaFilterId:n,filterStr:c,gamma:a,offset:d}}function Vn({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function $n(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Zo({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=$n(e),a=$n(t),s=[];for(let b=0;b<=e;b+=o)s.push(b);const d=[];for(let b=0;b<=t;b+=a)d.push(b);const u=1/n,c=8*u,p=-12*u,g=-2*u,h=r==null?void 0:r.current;let v=0,w=0,f=0,x=0;if(h){const b=h.clientWidth,_=h.clientHeight,M=b/e,P=_/t,y=Math.min(M,P);f=e*y,x=t*y,v=(b-f)/2,w=(_-x)/2}const m=h&&f>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?w:0,transform:`translateY(${p}px)`,fontSize:c},children:s.map(b=>i.jsx("span",{className:"mono",style:{position:"absolute",left:m?v+b/e*f:`${b/e*100}%`,transform:"translateX(-50%)"},children:b},b))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?v:0,transform:`translateX(${g}px)`,fontSize:c},children:d.map(b=>i.jsx("span",{className:"mono",style:{position:"absolute",top:m?w+b/t*x:`${b/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*u}px`},children:b},b))})]})}function Qo({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const jo=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Xn(e,t){const n=getComputedStyle(e),r=jo.map(u=>`${u}:${n.getPropertyValue(u)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,d=Math.min(a.length,s.length);for(let u=0;u<d;u++)Xn(a[u],s[u])}function $t(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Xt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Wt(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((d,u)=>a.toBlob(c=>c?d(c):u(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Jo(e,t,n){const r=e.cloneNode(!0);Xn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,d)=>{const u=new Image;u.onload=()=>s(u),u.onerror=()=>d(new Error("plot-to-png: SVG rasterization failed")),u.src=a})}async function Wn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??$t(e);return Wt(r,o,Xt(t),a,s=>s.drawImage(e,0,0,r,o))}async function es(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??$t(e);try{return await Wt(r,o,Xt(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function ts(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function ns(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,d=(t==null?void 0:t.background)??$t(e);if(n){const c=n.getBoundingClientRect(),p=await Jo(n,c.width||a,c.height||s);return Wt(a,s,Xt(t),d,g=>{for(const h of r){const v=h.getBoundingClientRect();g.drawImage(h,v.left-o.left,v.top-o.top,v.width,v.height)}g.drawImage(p,c.left-o.left,c.top-o.top,c.width,c.height)})}if(r.length)return Wn(r[0],t);const u=ts(e);if(u)return es(u,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function rs(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const os=8;function ss(e,t,n,r=os){return!(t>0)||!(e>0)?n:e<t+r}function Hn(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function as(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function is(e,t){const n=as(e);return n===null?t:n}function cs(e){return String(e)}const ls={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},us={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function ze({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:us[e]??null})}function Kn({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(ze,{name:e??""})})}function Yn(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function ds({icon:e,title:t,menu:n}){var x;const{options:r,value:o,onSelect:a}=n,[s,d]=l.useState(!1),[u,c]=l.useState(0),p=l.useRef(null),g=Hn(r,o),h=e?void 0:((x=r[g])==null?void 0:x.label)??"",v=l.useCallback(()=>{d(m=>{const b=!m;return b&&c(g),b})},[g]),w=l.useCallback(m=>{a(m),d(!1)},[a]);l.useEffect(()=>{if(!s)return;const m=_=>{p.current&&!p.current.contains(_.target)&&d(!1)},b=_=>{_.key==="Escape"&&(_.stopPropagation(),d(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",b,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",b,!0)}},[s]);const f=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),c(g),d(!0));return}if(m.key==="ArrowDown")m.preventDefault(),c(b=>(b+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),c(b=>(b-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const b=r[u];b&&w(b.id)}};return i.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),v()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:f,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?i.jsx("span",{"aria-hidden":"true",children:h}):i.jsx(ze,{name:e??""}),i.jsx(ze,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,b)=>{const _=m.id===o,M=b===u;return i.jsx("li",{role:"option","aria-selected":_,children:i.jsx("button",{type:"button",onClick:P=>{P.stopPropagation(),w(m.id)},onPointerEnter:()=>c(b),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",M?"bg-bg-hover":"",_?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const fs=e=>e.format?e.format(e.value):String(e.value);function qn({spec:e}){const[t,n]=l.useState(!1),[r,o]=l.useState(""),a=l.useRef(null),s=l.useCallback(()=>{o(cs(e.value)),n(!0)},[e.value]);l.useEffect(()=>{t&&a.current&&(a.current.focus(),a.current.select())},[t]);const d=l.useCallback(()=>{n(c=>(c&&e.onChange(is(r,e.value)),!1))},[r,e]),u=l.useCallback(()=>n(!1),[]);return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:c=>c.stopPropagation(),onDoubleClick:c=>{c.stopPropagation(),t||s()},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx(ze,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?i.jsx("input",{ref:a,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:c=>o(c.target.value),onPointerDown:c=>c.stopPropagation(),onDoubleClick:c=>c.stopPropagation(),onKeyDown:c=>{c.stopPropagation(),c.key==="Enter"?(c.preventDefault(),d()):c.key==="Escape"&&(c.preventDefault(),u())},onBlur:d,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):i.jsxs(i.Fragment,{children:[i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:c=>e.onChange(Number(c.target.value)),onPointerDown:c=>c.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:fs(e)})]})]})}function ps({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:a,onSelect:s}=n,[d,u]=l.useState(!1),c=Hn(o,a),p=((g=o[c])==null?void 0:g.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":d,"aria-label":t,onClick:h=>{h.stopPropagation(),u(v=>!v)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",d?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx(ze,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),i.jsx("span",{className:d?"rotate-180 transition-transform":"transition-transform",children:i.jsx(ze,{name:"caret"})})]}),d&&o.map(h=>{const v=h.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":v,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",v?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:v?"✓":""}),i.jsx("span",{children:h.label})]},h.id)})]})}function hs({actions:e,leading:t,sliders:n}){const[r,o]=l.useState(!1),a=l.useRef(null);return l.useEffect(()=>{if(!r)return;const s=u=>{a.current&&!a.current.contains(u.target)&&o(!1)},d=u=>{u.key==="Escape"&&(u.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",d,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",d,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(d=>!d)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx(ze,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(ps,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:d=>{var u;d.stopPropagation(),!s.disabled&&((u=s.onClick)==null||u.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(ze,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:d=>{d.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(ze,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(qn,{spec:s})},s.id))]})]})}function ms({controller:e,config:t}){var S,A;const n=l.useRef(null),[r,o]=l.useState(!1),a=l.useRef(r);a.current=r;const s=l.useRef(0),d=`${((S=t==null?void 0:t.leadingButtons)==null?void 0:S.length)??0}:${((A=t==null?void 0:t.sliders)==null?void 0:A.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(l.useEffect(()=>{const E=n.current,L=E==null?void 0:E.parentElement;if(!L)return;const I=()=>{const oe=L.clientWidth;if(!a.current&&n.current){const ie=n.current.scrollWidth;ie>0&&(s.current=ie)}o(ss(oe,s.current,a.current))};let B=0;const Z=()=>{B||(B=requestAnimationFrame(()=>{B=0,I()}))},j=new ResizeObserver(Z);return j.observe(L),I(),()=>{j.disconnect(),B&&cancelAnimationFrame(B)}},[d]),(t==null?void 0:t.enabled)===!1)return null;const u=e.capabilities,c=t==null?void 0:t.buttons,p=(E,L)=>L&&(c==null?void 0:c[E])!==!1,g=E=>()=>e.setDragMode(E),h=()=>{e.toPNG({filename:"plot"}).then(E=>rs(E,"plot.png")).catch(()=>{})},v=[];p("zoom",u.zoom)&&v.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),p("pan",u.pan)&&v.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),p("select",u.select)&&v.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),p("lasso",u.lasso)&&v.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const w=[];p("zoomIn",u.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",u.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const f=[];p("autoscale",u.autoscale)&&f.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",u.reset)&&f.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const x=[];p("screenshot",u.screenshot)&&x.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[v,w,f,x].filter(E=>E.length>0),b=m.flat(),_=(t==null?void 0:t.leadingButtons)??[],M=(t==null?void 0:t.sliders)??[];if(!_.length&&b.length===0&&M.length===0)return null;const P=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",R=P==="top-right"||P==="bottom-right",k=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),D={position:"absolute",pointerEvents:"auto",...ls[P]};return r?i.jsx("div",{ref:n,style:D,className:`${k} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(hs,{actions:b,leading:_,sliders:M})}):i.jsxs("div",{ref:n,style:D,className:`${k} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${R?"justify-end":"justify-start"}`,children:[_.length>0&&i.jsxs(i.Fragment,{children:[_.map(E=>E.menu?i.jsx(ds,{icon:E.icon,title:E.title,menu:E.menu},E.id):i.jsx(Kn,{icon:E.icon,label:E.label,title:E.title,active:E.active,disabled:E.disabled,onClick:E.onClick??(()=>{})},E.id)),m.length>0&&i.jsx(Yn,{})]}),m.map((E,L)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[L>0&&i.jsx(Yn,{}),E.map(I=>i.jsx(Kn,{icon:I.icon,title:I.title,active:I.active,disabled:I.disabled,onClick:I.onClick},I.id))]},E[0].id))]}),M.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${R?"justify-end":"justify-start"}`,children:M.map(E=>i.jsx(qn,{spec:E},E.id))})]})}const gs={zoom:1,pan:{x:0,y:0}},Zn=1.3,xs=.25,bs=64,vs={buttons:{zoom:!1}};function ws(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const ys=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Ht(e,t){return{id:"colormap",title:"Colormap",menu:{options:ys,value:e,onSelect:t}}}function Es({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:d=xs,maxZoom:u=bs,requestRender:c,onReset:p,extraModified:g=!1}){const h=l.useCallback(y=>{var B;if(!o)return;const R=(B=e.current)==null?void 0:B.getBoundingClientRect(),T=(R==null?void 0:R.width)??0,k=(R==null?void 0:R.height)??0,D=a&&s&&T>0&&k>0?Nt(a,s,T,k):u,S=Math.max(d,Math.min(D,n*y));if(S===n)return;const A=T/2,E=k/2,L=A-(A-r.x)/n*S,I=E-(E-r.y)/n*S;o({zoom:S,pan:{x:L,y:I}})},[o,e,a,s,u,d,n,r.x,r.y]),v=l.useCallback(()=>h(Zn),[h]),w=l.useCallback(()=>h(1/Zn),[h]),f=l.useCallback(()=>{o==null||o(gs),p==null||p()},[o,p]),x=l.useCallback(y=>{const R={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};c==null||c();const T=t==null?void 0:t.current;if(T)return Wn(T,R);const k=e.current;return k?ns(k,R):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,c]),m=l.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),b=n!==1||r.x!==0||r.y!==0||g,_=l.useCallback(y=>{},[]),M=l.useCallback(y=>{},[]),P=l.useCallback(()=>{},[]);return l.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:b,setDragMode:_,setHoverMode:M,toggleSpikelines:P,zoomIn:v,zoomOut:w,autoscale:f,reset:f,toPNG:x}),[m,b,_,M,P,v,w,f,x])}const _s={zoom:1,pan:{x:0,y:0}};function ht({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:d,naturalDims:u,checkerboard:c,wrapperClassName:p,wrapperStyle:g,viewportPadding:h,header:v,surface:w,showAxes:f,overlayNode:x,overlay:m,notationSeed:b,exportCanvasRef:_,requestRender:M,leadingMenus:P,displayAdjust:y,onReset:R,extraModified:T,label:k,showLabelChip:D,isDraggable:S=!1,onDragStart:A,extraChips:E}){const[L,I]=l.useState(b),[B,Z]=l.useState(!1),{containerProps:j}=Sn({containerRef:r,zoom:a,pan:s,onViewportChange:d,naturalWidth:u==null?void 0:u.w,naturalHeight:u==null?void 0:u.h}),oe=l.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),R==null||R()},[y,R]),ie=l.useCallback(()=>{d==null||d(_s),oe()},[d,oe]),_e=Es({rootRef:r,canvasRef:_,zoom:a,pan:s,onViewportChange:d,naturalWidth:u==null?void 0:u.w,naturalHeight:u==null?void 0:u.h,requestRender:M,onReset:oe,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!T}),fe=l.useMemo(()=>{if(!y)return;const Y=(he,K)=>`${he>=0?"+":"−"}${Math.abs(he).toFixed(K)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:he=>Y(he,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:he=>Y(he,2)}]},[y]),Be=l.useMemo(()=>({...vs,leadingButtons:[...P??[],...B?[ws(L,I)]:[]],sliders:fe}),[B,L,P,fe]),pe=" cairn-checkerboard",Me="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(c==="pane"?pe:""),be=p+(c==="wrapper"?pe:""),we="render"in m?m.render({notation:L,setOverlayActive:Z}):m.hasSource&&u?i.jsx(je,{imageElRef:m.displayElRef,naturalWidth:u.w,naturalHeight:u.h,zoom:a,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:L,version:m.version,onActiveChange:Z}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[v,n&&i.jsx(ms,{controller:_e,config:Be}),i.jsxs("div",{ref:r,className:Me,style:{padding:h,...j.style},onPointerDown:j.onPointerDown,onPointerMove:j.onPointerMove,onPointerUp:j.onPointerUp,onPointerCancel:j.onPointerCancel,onDoubleClick:ie,...t,children:[i.jsxs("div",{ref:o,className:be,style:g,children:[w,f&&u&&i.jsx(Zo,{naturalWidth:u.w,naturalHeight:u.h,zoom:a,containerRef:o}),x]}),we,!n&&B&&i.jsx(Pn,{notation:L,onChange:I})]}),D&&i.jsx(Qo,{label:k,isDraggable:S,onDragStart:A}),E]})}function Qn(e){return"hdr"in e&&e.hdr!=null}function jn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Ae(e){return Number.isFinite(e)?e:0}const Ms={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ss(e,t,n,r,o=0){const{h:a,w:s,c:d}=jn(e.shape),u=e.precision==="f16-bits"?xn(e.data):e.data,c=to(t),p=new Uint8ClampedArray(s*a*4);for(let g=0;g<s*a;g++){const h=g*d;let v,w,f,x=1;d===1?v=w=f=Ae(u[h]):d===3?(v=Ae(u[h]),w=Ae(u[h+1]),f=Ae(u[h+2])):(v=Ae(u[h]),w=Ae(u[h+1]),f=Ae(u[h+2]),x=Ae(u[h+3]));const m=[st(v,n,o),st(w,n,o),st(f,n,o)],[b,_,M]=c(m),P=g*4;p[P]=255*Rt(b,r),p[P+1]=255*Rt(_,r),p[P+2]=255*Rt(M,r),p[P+3]=255*(x<0?0:x>1?1:x)}return new ImageData(p,s,a)}function Ts(e){var J,$;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:d=!1,processing:u=Ms,zoom:c=1,pan:p={x:0,y:0},onViewportChange:g,onNaturalSize:h,label:v,isDraggable:w=!1,onDragStart:f,overlay:x,overlaySettings:m,pixelValueNotation:b="decimal",toolbar:_=!0}=e,[M,P,y]=ut(s);l.useEffect(()=>{P(s)},[s,P]);const R=l.useRef(null),T=l.useRef(null),k=l.useRef(null),D=l.useRef(null),S=l.useRef(null),A=l.useRef(null),E=l.useRef(null),[L,I]=l.useState(0),B=l.useCallback(()=>I(O=>O+1),[]),Z=l.useMemo(()=>({get current(){const O=S.current;return O instanceof HTMLCanvasElement?O:null}}),[]),j=l.useCallback(O=>{R.current=O,O&&(S.current=O)},[]),oe=l.useCallback(O=>{T.current=O,O&&(S.current=O)},[]),ie=l.useCallback(O=>{O&&(S.current=O)},[]),[_e,fe]=l.useState(!1),[Be,pe]=l.useState(!1),[Me,be]=l.useState(null),{flipSign:we}=u,{gammaFilterId:Y,filterStr:he,gamma:K,offset:q}=zn(u),ce=!r&&o!=="none"&&n!=null&&t!=null,ye=o!=="none"&&n!=null,ve=M!=="none"&&!ce&&!(r&&ye)&&t!=null;l.useEffect(()=>{if(!ve||!t){pe(!1);return}let O=!1;pe(!1);const z=`${t}::${M}`,ee=Lt(z);if(ee){const H=T.current;if(H){H.width=ee.width,H.height=ee.height;const ne=H.getContext("2d");ne&&ne.putImageData(ee,0,0),E.current=ee,B(),be({w:ee.width,h:ee.height}),h==null||h(ee.width,ee.height),pe(!0)}return}const te=new Image;return te.onload=()=>{if(O)return;const H=document.createElement("canvas");H.width=te.naturalWidth,H.height=te.naturalHeight;const ne=H.getContext("2d");if(!ne)return;ne.drawImage(te,0,0);const Se=ne.getImageData(0,0,H.width,H.height),De=kt(M),me=Dt(Se,M,De);It(z,me);const Te=T.current;if(!Te||O)return;Te.width=me.width,Te.height=me.height;const xe=Te.getContext("2d");xe&&xe.putImageData(me,0,0),E.current=me,B(),be({w:me.width,h:me.height}),h==null||h(me.width,me.height),pe(!0)},te.src=t,()=>{O=!0}},[ve,t,M]);const Ee=l.useCallback((O,z)=>{be(ee=>ee&&ee.w===O&&ee.h===z?ee:{w:O,h:z}),h==null||h(O,z)},[]);l.useEffect(()=>{if(!t){A.current=null,E.current=null,B();return}let O=!1;return qe(t).then(z=>{O||(A.current=z,M==="none"&&(E.current=z),B())}),()=>{O=!0}},[t,M,B]);const Ce=l.useCallback((O,z,ee)=>{const te=A.current;if(!te||O<0||z<0||O>=te.width||z>=te.height)return null;const H=(z*te.width+O)*4,ne=te.data[H],Se=te.data[H+1],De=te.data[H+2],me=E.current;let Te=ne,xe=Se,ge=De;if(me&&me.width===te.width&&me.height===te.height){const Ge=(z*me.width+O)*4;Te=me.data[Ge],xe=me.data[Ge+1],ge=me.data[Ge+2]}const Le=(.299*Te+.587*xe+.114*ge)/255;return Qe(M!=="none"||ne===Se&&Se===De?[ne]:[ne,Se,De],"uint8",ee,Le)},[M]);l.useEffect(()=>{if(!ce){fe(!1);return}let O=!1;const z=go(),ee=z==="gpu"||z==="auto",te=`${n}::${t}::${o}::${M}`;if(z!=="gpu"){const H=Lt(te);if(H){const ne=R.current;if(ne){(ne.width!==H.width||ne.height!==H.height)&&(ne.width=H.width,ne.height=H.height);const Se=ne.getContext("2d");Se&&Se.putImageData(H,0,0),Ee(H.width,H.height),fe(!0)}return}}return(async()=>{const[H,ne]=await Promise.all([qe(n),qe(t)]);if(O||!H||!ne)return;const De=o.includes("signed")?"signed":"positive",me=M!=="none"?Pt(M):null,Te={diffMode:o,colormap:me,cmapMode:De};if(ee)try{const Ke=R.current;if(Ke){const Ge=ho(H,ne,Te,Ke);if(Ge){if(O)return;Ee(Ge.width,Ge.height),fe(!0);return}}}catch(Ke){console.warn("[cairn] WebGL 2 diff error:",Ke)}if(z==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let xe=ao(H,ne,o);M!=="none"&&(xe=Dt(xe,M,De)),It(te,xe);const ge=R.current;if(!ge||O)return;(ge.width!==xe.width||ge.height!==xe.height)&&(ge.width=xe.width,ge.height=xe.height);const Le=ge.getContext("2d");Le&&Le.putImageData(xe,0,0),Ee(xe.width,xe.height),fe(!0)})(),()=>{O=!0}},[n,t,o,ce,M,h]);const F=a==="auto"?void 0:a,G=we?{filter:"invert(1)"}:{},Q=x&&(m!=null&&m.enabled)&&Me&&t&&((((J=x.boxes)==null?void 0:J.length)??0)>0||((($=x.masks)==null?void 0:$.length)??0)>0)?i.jsx(Ft,{data:x,settings:m,naturalWidth:Me.w,naturalHeight:Me.h}):void 0,W=t?ce?i.jsxs(i.Fragment,{children:[!_e&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:j,className:"w-full h-full object-contain block",style:{display:_e?"block":"none",imageRendering:F,...G}})]}):ve?i.jsxs(i.Fragment,{children:[!Be&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:oe,className:"w-full h-full object-contain block",style:{display:Be?"block":"none",imageRendering:F,...G}})]}):i.jsx("img",{ref:ie,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:he,imageRendering:F},onLoad:O=>{const z=O.currentTarget;be({w:z.naturalWidth,h:z.naturalHeight}),h==null||h(z.naturalWidth,z.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(ht,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:k,wrapperRef:D,zoom:c,pan:p,onViewportChange:g,naturalDims:Me,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${c})`,transformOrigin:"0 0"},viewportPadding:d&&Me?"16px 4px 4px 28px":"4px",header:i.jsx(Vn,{id:Y,gamma:K,offset:q}),surface:W,showAxes:d,overlayNode:Q,overlay:{displayElRef:S,sample:Ce,version:L,hasSource:!!t},notationSeed:b,exportCanvasRef:Z,leadingMenus:[Ht(M,O=>P(O))],onReset:y.reset,extraModified:y.isModified,label:v,showLabelChip:!0,isDraggable:w,onDragStart:f})}function Ps(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:d="auto",zoom:u=1,pan:c={x:0,y:0},onViewportChange:p,pixelValueNotation:g="decimal",toolbar:h=!0}=e,v=l.useRef(null),w=l.useRef(null),f=l.useRef(null),[x,m]=l.useState(null),b=l.useRef(null),[_,M]=l.useState(0),[P,y]=l.useState(0),[R,T]=l.useState(0);l.useEffect(()=>{const S=v.current;if(!S)return;let A;try{A=Ss(t,n,r+P,o,R)}catch(L){console.error("[cairn] HDR tone-map error:",L);return}(S.width!==A.width||S.height!==A.height)&&(S.width=A.width,S.height=A.height);const E=S.getContext("2d");E&&(E.putImageData(A,0,0),b.current=A,M(L=>L+1),m(L=>L&&L.w===A.width&&L.h===A.height?L:{w:A.width,h:A.height}))},[t,n,r,o,P,R]);const k=l.useCallback((S,A,E)=>{const L=x;if(!L||S<0||A<0||S>=L.w||A>=L.h)return null;const I=t.shape.length===2?1:t.shape[2]??1,B=(A*L.w+S)*I,Z=t.data,j=t.precision==="f16-bits"?fe=>ct(Z[fe]??0):fe=>Z[fe]??0,oe=b.current;let ie=.5;if(oe&&oe.width===L.w&&oe.height===L.h){const fe=(A*L.w+S)*4;ie=(.299*oe.data[fe]+.587*oe.data[fe+1]+.114*oe.data[fe+2])/255}const _e=I===1?[j(B)]:[j(B),j(B+1),j(B+2)];return Qe(_e,"unit",E,ie)},[t,x]),D=d==="auto"?void 0:d;return i.jsx(ht,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:h,paneRef:w,wrapperRef:f,zoom:u,pan:c,onViewportChange:p,naturalDims:x,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${c.x}px, ${c.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:a&&x?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:v,className:"w-full h-full object-contain block",style:{imageRendering:D}}),showAxes:a,overlay:{displayElRef:v,sample:k,version:_,hasSource:!0},notationSeed:g,exportCanvasRef:v,displayAdjust:{exposureEV:P,offset:R,onExposureChange:y,onOffsetChange:T},label:s,showLabelChip:!!s})}function Kt(e){return Qn(e)?i.jsx(Ps,{...e}):i.jsx(Ts,{...e})}const Jn={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},As="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function Cs(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Rs(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Ds(e,t){if(e==="no-hdr-display")switch(Rs(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=Cs(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function ks(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function er(e,t){return`cairn-plot:capnotice:${e}:${t}`}const tr=new Set;function nr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return tr.has(e)}function Ls(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}tr.add(e)}const rr=new Set;let mt=null,tt=null;function or(){tt&&tt.parentNode&&tt.parentNode.removeChild(tt),tt=null,mt=null}function Is(e){const t=er(e,window.location.pathname),n=Ds(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=ks(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=As,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const d=document.createElement("button");d.type="button",d.textContent="×",d.setAttribute("aria-label","Dismiss browser capability notice"),d.title="Dismiss",Object.assign(d.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),d.addEventListener("click",()=>{Ls(t),or()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(d),document.body.appendChild(r),tt=r,mt=e}function sr(e){if(typeof document>"u"||typeof window>"u"||rr.has(e))return;rr.add(e);const t=er(e,window.location.pathname);if(nr(t))return;const n=()=>{if(!nr(t)){if(mt!==null)if(Jn[e]<Jn[mt])or();else return;Is(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Bs=["linear","srgb","reinhard","aces"];function Os(e){return e&&Bs.includes(e)?e:"srgb"}function Ns(e){const{h:t,w:n,c:r}=jn(e.shape);if(e.precision==="f16-bits"){const s=e.data,d=new Uint16Array(n*t*4);for(let u=0;u<n*t;u++){const c=u*r,p=u*4;if(r===1){const g=s[c];d[p]=g,d[p+1]=g,d[p+2]=g,d[p+3]=it}else d[p]=s[c],d[p+1]=s[c+1],d[p+2]=s[c+2],d[p+3]=r>=4?s[c+3]:it}return{data:d,width:n,height:t,format:"rgba16float"}}const o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const d=s*r;let u,c,p,g=1;r===1?u=c=p=Ae(o[d]):r===3?(u=Ae(o[d]),c=Ae(o[d+1]),p=Ae(o[d+2])):(u=Ae(o[d]),c=Ae(o[d+1]),p=Ae(o[d+2]),g=Ae(o[d+3]));const h=s*4;a[h]=u,a[h+1]=c,a[h+2]=p,a[h+3]=g}return{data:a,width:n,height:t,format:"rgba32float"}}function ar(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,d=(t.width-a)/2,u=(t.height-s)/2,c=Math.max(e.zoom,1e-6),p=t.width/(c*a),g=t.height/(c*s),h=-d/a-e.pan.x/(c*a),v=-u/s-e.pan.y/(c*s);return{x:h,y:v,w:p,h:g}}function ir(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function Us(e){var Ee,Ce;const t=Qn(e),n=l.useRef(null),r=l.useRef(null),o=l.useRef(null),a=l.useRef(null),s=l.useRef(!1),[d,u]=l.useState(!1),[c,p]=l.useState(!1),[g,h]=l.useState(null),[v,w]=l.useState(0),[f,x]=l.useState(0),[m,b]=l.useState({x:0,y:0,w:1,h:1}),_=l.useRef(null),M=l.useRef(null),[P,y]=l.useState(0),R=e.zoom??1,T=e.pan??{x:0,y:0},k=e.onViewportChange,D=t?"none":e.colormap??"none",[S,A]=l.useState(D);l.useEffect(()=>{A(D)},[D]);const E=t?"none":S,L=l.useRef(D),I=l.useCallback(()=>{A(L.current)},[]),[B,Z]=l.useState(0),[j,oe]=l.useState(0),ie=Ut();l.useEffect(()=>{const F=n.current;if(!F)return;let G=!1;return ot().then(Q=>{var O;if(G)return;const W=((O=Q.probeExtendedToneMapping)==null?void 0:O.call(Q))??!1,J=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,$=W&&J&&t;s.current=$,t&&!$&&sr(W?"no-hdr-display":"no-hdr-browser"),Yo(F,{hdr:$}).then(z=>{if(G){Gn(z);return}a.current=z,p(!0)}).catch(z=>{G||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",z),u(!0))})}).catch(Q=>{G||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",Q),u(!0))}),()=>{G=!0,a.current&&(Gn(a.current),a.current=null)}},[]),l.useEffect(()=>{const F=r.current;if(!F)return;const G=new ResizeObserver(()=>x(Q=>Q+1));return G.observe(F),()=>G.disconnect()},[]),l.useEffect(()=>{const F=r.current;if(!F)return;const G=new IntersectionObserver(Q=>{const W=Q[0];if(!W)return;const J=a.current;J&&(J.setVisible(W.isIntersecting),W.isIntersecting?J.isParked&&(J.restore(),x($=>$+1)):J.park())},{threshold:0});return G.observe(F),()=>G.disconnect()},[]),l.useEffect(()=>{var Q;if(!t||!c)return;const F=e.hdr;_.current=F;const G=Ns(F);(Q=a.current)==null||Q.setSource(G),h(W=>W&&W.w===G.width&&W.h===G.height?W:{w:G.width,h:G.height}),y(W=>W+1),w(W=>W+1)},[t,c,t?e.hdr:null]),l.useEffect(()=>{if(t||!c)return;const F=e,G=F.imageUrl,Q=S;if(!G){M.current=null,h(null),y(J=>J+1);return}let W=!1;return qe(G).then(J=>{var z,ee;if(W||!J)return;let $=J;if(Q!=="none"){const te=`gpu::${G}::${Q}::ev${B}::off${j}`,H=Lt(te);if(H)$=H;else{const ne=kt(Q);$=Dt(J,Q,ne,B,j),It(te,$)}}M.current=J;const O={data:$.data,width:$.width,height:$.height,format:"rgba8unorm"};(z=a.current)==null||z.setSource(O),h(te=>te&&te.w===$.width&&te.h===$.height?te:{w:$.width,h:$.height}),(ee=F.onNaturalSize)==null||ee.call(F,$.width,$.height),y(te=>te+1),w(te=>te+1)}),()=>{W=!0}},[t,c,t?null:e.imageUrl,t?null:S,t?0:B,t?0:j]);const _e=t?e.exposure??0:0,fe=t?e.tonemap:void 0,Be=t?e.gamma:void 0,pe=l.useCallback(()=>{const F=a.current;if(!F||!c||!g)return;const G=r.current,Q=o.current,W=Q?Q.getBoundingClientRect():G?G.getBoundingClientRect():{width:g.w,height:g.h},J=ar({zoom:R,pan:T},W,g.w,g.h);b(ee=>ee.x===J.x&&ee.y===J.y&&ee.w===J.w&&ee.h===J.h?ee:J),W.width>0&&W.height>0&&F.resize(Math.round(W.width*ie),Math.round(W.height*ie));const $=ir(J,W,g.w,g.h)>=Gt?"nearest":"linear",O=J,z=t?{exposureEV:_e+B,offset:j,operator:s.current?"extended":Os(fe),gamma:Be,isScalar:!1,hdrOut:s.current,uv:O,filter:$}:{exposureEV:E!=="none"?0:B,offset:E!=="none"?0:j,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:O,filter:$};try{F.render(z)||u(!0)}catch(ee){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",ee),u(!0)}},[c,g,R,T.x,T.y,_e,B,j,fe,Be,t,E,ie]);l.useEffect(()=>{pe()},[pe,v,f]);const Me=l.useCallback((F,G,Q)=>{if(t){const H=_.current,ne=g;if(!H||!ne||F<0||G<0||F>=ne.w||G>=ne.h)return null;const Se=H.shape.length===2?1:H.shape[2]??1,De=(G*ne.w+F)*Se,me=H.data,Te=H.precision==="f16-bits"?Le=>ct(me[Le]??0):Le=>me[Le]??0,xe=.5,ge=Se===1?[Te(De)]:[Te(De),Te(De+1),Te(De+2)];return Qe(ge,"unit",Q,xe)}const W=M.current;if(!W||F<0||G<0||F>=W.width||G>=W.height)return null;const J=(G*W.width+F)*4,$=W.data[J],O=W.data[J+1],z=W.data[J+2],ee=(.299*$+.587*O+.114*z)/255;return Qe(E!=="none"||$===O&&O===z?[$]:[$,O,z],"uint8",Q,ee)},[t,g,E]),be=e.showAxes??!1,we=t?e.label??"":e.label,Y=e.interpolation??"auto",he=Y==="auto"?void 0:Y,K=t?void 0:e.overlay,q=t?void 0:e.overlaySettings,ce=t?!1:e.isDraggable??!1,ye=t?void 0:e.onDragStart;if(d)return t?i.jsx(Kt,{...e}):i.jsx(Kt,{...e});const ve=K&&(q!=null&&q.enabled)&&g&&((((Ee=K.boxes)==null?void 0:Ee.length)??0)>0||(((Ce=K.masks)==null?void 0:Ce.length)??0)>0)?i.jsx(Ft,{data:K,settings:q,naturalWidth:g.w,naturalHeight:g.h}):void 0;return i.jsx(ht,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":c},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:R,pan:T,onViewportChange:k,naturalDims:g,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:be&&g?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:he},"data-gpu-image-canvas":!0}),showAxes:be,overlayNode:ve,overlay:{displayElRef:n,sample:Me,version:P,hasSource:!0,sourceWindow:m},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:pe,leadingMenus:t?void 0:[Ht(E,F=>A(F))],displayAdjust:{exposureEV:B,offset:j,onExposureChange:Z,onOffsetChange:oe},onReset:I,extraModified:S!==L.current,label:we,showLabelChip:!!we,isDraggable:ce,onDragStart:ye})}const gt=new Map;function Fe(e){if(gt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);gt.set(e.id,e)}function We(e){return gt.get(e)}function Fs(){return Array.from(gt.values())}function cr(e,t){return{...e.params??{},...t??{}}}const Gs={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},zs={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Vs={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},$s={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Xs={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},Ws={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},lr=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Ks(lr);const Yt=[1.052156925,1,.91835767],Hs=.7;function Ks(e){const[t,n,r]=e[0],[o,a,s]=e[1],[d,u,c]=e[2],p=a*c-s*u,g=-(o*c-s*d),h=o*u-a*d,w=1/(t*p+n*g+r*h);return[[p*w,-(n*c-r*u)*w,(n*s-r*a)*w],[g*w,(t*c-r*d)*w,-(t*s-r*o)*w],[h*w,-(t*u-n*d)*w,(t*a-n*o)*w]]}function Ys(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const qt=6/29;function Zt(e){return e>qt**3?Math.cbrt(e):e/(3*qt*qt)+4/29}function ur(e,t,n){const[r,o,a]=Ys(lr,e,t,n),s=Zt(r*Yt[0]),d=Zt(o*Yt[1]),u=Zt(a*Yt[2]),c=116*d-16,p=500*(s-d),g=200*(d-u);return[c,.01*c*p,.01*c*g]}function qs(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Zs(){const e=ur(0,1,0),t=ur(0,0,1);return Math.pow(qs(e,t),Hs)}const dr=Zs(),Qs=.082;function fr(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),d=1/e,u=Math.PI**2,c=[0,0,0];for(let p=-s;p<=s;p++)for(let g=-s;g<=s;g++){const h=(g*d)**2+(p*d)**2;for(let v=0;v<3;v++)c[v]+=t[v]*Math.sqrt(Math.PI/n[v])*Math.exp(-u*h/n[v])+r[v]*Math.sqrt(Math.PI/o[v])*Math.exp(-u*h/o[v])}return{r:s,deltaX:d,sums:c}}function pr(e){const t=.5*Qs*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let d=-n;d<=n;d++){const u=Math.exp(-(d*d+s*s)/(2*t*t)),c=-d*u,p=(d*d/(t*t)-1)*u;c>0&&(r+=c),p>0?o+=p:a-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const js=`
${Ie}
${ft}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Js=`
${Ie}
${ft}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,xt=`
${Ie}
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
`,hr=`
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
`;function He(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function bt(e){return[He(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),He(2,[e.sums[2],0,0,0])]}function mr(e){return[He(4,[dr,e.sd,e.r,e.edgeNorm]),He(5,[e.pointPos,e.pointNeg,0,0])]}function gr(e,t,n,r,o=""){const a=fr(e),s=pr(e),d=`ycxczA${o}`,u=`ycxczB${o}`,c=`labA${o}`,p=`labB${o}`,g=`flip${o}`;return{passes:[{name:d,shader:t,inputs:[n],output:d},{name:u,shader:t,inputs:[r],output:u},{name:c,shader:xt,inputs:[d],output:c,uniforms:()=>bt(a)},{name:p,shader:xt,inputs:[u],output:p,uniforms:()=>bt(a)},{name:g,shader:hr,inputs:[c,p,d,u],output:g,uniforms:()=>mr(s)}],flipRef:g}}const ea={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=gr(t,js,"srcA","srcB");return{passes:n,final:r}}},ta={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=gr(t,Js,"srcA","srcB");return{passes:n,final:r}}},xr=`
${Ie}
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
`,na=`
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
`,ra={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=fr(t),d=pr(t),u=[];let c=null;for(let p=0;p<o;p++){const g=n+p*a,h=`_e${p}`,v=`ycxczA${h}`,w=`ycxczB${h}`,f=`labA${h}`,x=`labB${h}`,m=`acc${h}`;u.push({name:v,shader:xr,inputs:["srcA"],output:v,uniforms:()=>[He(1,[g,0,0,0])]},{name:w,shader:xr,inputs:["srcB"],output:w,uniforms:()=>[He(1,[g,0,0,0])]},{name:f,shader:xt,inputs:[v],output:f,uniforms:()=>bt(s)},{name:x,shader:xt,inputs:[w],output:x,uniforms:()=>bt(s)}),c===null?u.push({name:m,shader:hr,inputs:[f,x,v,w],output:m,uniforms:()=>mr(d)}):u.push({name:m,shader:na,inputs:[f,x,v,w,c],output:m,uniforms:()=>[He(5,[dr,d.sd,d.r,d.edgeNorm]),He(6,[d.pointPos,d.pointNeg,0,0])]}),c=m}return{passes:u,final:c}}},oa=.01,sa=.03,br=1,vr=1.5,wr=5,yr=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,aa=`
${Ie}
${yr}
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
`,ia=`
${Ie}
${yr}
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
`,Er=`
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
`,ca=`
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
`;function Qt(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function _r(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Er,inputs:[e],output:n,uniforms:()=>[Qt(1,[1,0,wr,vr])]},{name:r,shader:Er,inputs:[n],output:r,uniforms:()=>[Qt(1,[0,1,wr,vr])]}],out:r}}const la={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(oa*br)**2,n=(sa*br)**2,r=_r("momA","statsA"),o=_r("momB","statsB");return{passes:[{name:"momA",shader:aa,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:ia,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:ca,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[Qt(2,[t,n,0,0])]}],final:"ssim"}}};let Mr=!1;function ua(){Mr||(Mr=!0,Fe(zs),Fe(Gs),Fe(Vs),Fe(Xs),Fe($s),Fe(Ws),Fe(ea),Fe(ra),Fe(ta),Fe(la))}ua();function Sr(){const e=[];for(const n of Fs())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=We("ssim");return t&&e.push({id:t.id,label:t.label}),e}function da(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Tr=new WeakMap;function jt(e,t,n,r){let o=Tr.get(e);o||(o=new Map,Tr.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function fa(e){return`
${Ie}
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
`}const vt="rgba16float";function pa(e,t,n,r,o){var v,w;const a=We(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),d=Math.min(t.height,n.height),u=cr(a,o);if(a.kind==="pointwise"){const f=e.createTexture(s,d,vt),x=jt(e,`pw:${a.id}`,fa(a.source),vt);let m;try{m=e.createBindGroup(x,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(f,x,m)}finally{(v=m==null?void 0:m.destroy)==null||v.call(m)}return f}const c={width:s,height:d,params:u},p=a.buildPasses(c),g=new Map([["srcA",t],["srcB",n]]),h=[];try{for(const x of p.passes){const m=e.createTexture(s,d,vt);h.push(m),g.set(x.output,m);const b=jt(e,`mp:${a.id}:${x.name}`,x.shader,vt),_=x.inputs.map((P,y)=>{const R=g.get(P);if(!R)throw new Error(`computeDiff: pass "${x.name}" input "${P}" not produced yet`);return{binding:y,resource:R}});x.uniforms&&_.push(...x.uniforms(c));let M;try{M=e.createBindGroup(b,_),e.renderFullscreen(m,b,M)}finally{(w=M==null?void 0:M.destroy)==null||w.call(M)}}const f=g.get(p.final);if(!f)throw new Error(`computeDiff: final ref "${p.final}" not produced`);for(const x of h)x!==f&&x.destroy();return f}catch(f){for(const x of h)x.destroy();throw f}}const ha=8,ma=256*1024*1024;class ga{constructor(t=ha,n=ma){le(this,"map",new Map);le(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Pr=new WeakMap;function Ar(e){let t=Pr.get(e);return t||(t=new ga,Pr.set(e,t)),t}function xa(e,t){const n=cr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function ba(e,t,n,r){const o=We(n),a=o?xa(o,r):"";return`${e}|${t}|${n}|${a}`}function va(e,t,n,r,o,a,s){const d=We(r);if(!d)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=Ar(e),c=ba(a,s,r,o),p=u.get(c);if(p)return p;const g=pa(e,t,n,r,o),h=Math.min(t.width,n.width),v=Math.min(t.height,n.height),w={texture:g,width:h,height:v,displayRange:d.displayRange,bytes:h*v*8};return u.set(c,w),w}async function wa(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Bn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function ya(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Ar(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const Ea=`
${Ie}
${An}
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
`,_a={unit:0,signed:1,relative:2},Ma={linear:0,signed:1,positive:2};function Sa(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ta(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Pa(e,t,n,r,o){var v,w,f;const a=Ta(t),s=jt(e,"diff-display",Ea,a),d=Sa(e,o.colormap),u=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),c=new Float32Array([_a[r],Ma[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),g=new Float32Array([((v=o.sourceDims)==null?void 0:v.w)??0,((w=o.sourceDims)==null?void 0:w.h)??0,0,0]);let h;try{h=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:d},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:c}},{binding:4,resource:{uniform:p}},{binding:5,resource:{uniform:g}}]),e.renderFullscreen(t,s,h)}finally{(f=h==null?void 0:h.destroy)==null||f.call(h),d.destroy()}}const Cr=.6*.6*2.51,Aa=.6*.03,Ca=0,Rr=.6*.6*2.43,Ra=.6*.59,Da=.14;function Dr(e){const t=(Aa-Ra*e)/(Cr-Rr*e),n=(Ca-Da*e)/(Cr-Rr*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const ka=.85,La=.85,kr=11920928955078125e-23,Jt=[.2126,.7152,.0722];function Ia(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Ba(e,t,n,r=3,o={}){const a=t*n,s=Dr(ka),d=Dr(La),u=new Float64Array(a);let c=0;for(let b=0;b<a;b++){const[_,M,P]=Ia(e,b,r),y=_*Jt[0]+M*Jt[1]+P*Jt[2];u[b]=y,y>c&&(c=y)}const p=Float64Array.from(u).sort(),g=a>>1,h=a%2===1?p[g]:p[g-1],v=Math.max(h,kr),w=Math.max(c,kr),f=o.startExposure??Math.log2(s/w),x=o.stopExposure??Math.log2(d/v),m=Math.max(2,Math.ceil(x-f));return{startExposure:f,stopExposure:x,numExposures:m}}const Oa={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Na({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:d,onViewportChange:u,processing:c=Oa,interpolation:p="auto",label:g="",isDraggable:h=!1,onDragStart:v,overlay:w,overlaySettings:f,pixelValueNotation:x="decimal"}){var Y,he;const m=l.useRef(null),[b,_]=l.useState(null),[M,P]=l.useState(null),[y,R]=l.useState(x),[T,k]=l.useState(!1),D=l.useRef(null),S=l.useRef(null),A=l.useRef(null),E=l.useRef(null),[L,I]=l.useState(0);l.useEffect(()=>{if(!e){A.current=null,I(q=>q+1);return}let K=!1;return qe(e).then(q=>{K||(A.current=q,I(ce=>ce+1))}),()=>{K=!0}},[e]),l.useEffect(()=>{if(!t){E.current=null,I(q=>q+1);return}let K=!1;return qe(t).then(q=>{K||(E.current=q,I(ce=>ce+1))}),()=>{K=!0}},[t]);const B=K=>(q,ce,ye)=>{const ve=K.current;if(!ve||q<0||ce<0||q>=ve.width||ce>=ve.height)return null;const Ee=(ce*ve.width+q)*4,Ce=ve.data[Ee],F=ve.data[Ee+1],G=ve.data[Ee+2],Q=(.299*Ce+.587*F+.114*G)/255;return Ce===F&&F===G?{lines:[et(Ce,"uint8",ye)],luminance:Q}:{lines:[et(Ce,"uint8",ye),et(F,"uint8",ye),et(G,"uint8",ye)],luminance:Q,colors:[dt[0],dt[1],dt[2]]}},Z=l.useMemo(()=>B(A),[]),j=l.useMemo(()=>B(E),[]),oe=!!w&&!!(f!=null&&f.enabled)&&!!b&&!!e&&((((Y=w.boxes)==null?void 0:Y.length)??0)>0||(((he=w.masks)==null?void 0:he.length)??0)>0),{gammaFilterId:ie,filterStr:_e,gamma:fe,offset:Be}=zn(c),pe=`translate(${d.x}px, ${d.y}px) scale(${s})`,Me=p==="auto"?void 0:p,{containerProps:be,modifierActive:we}=Sn({containerRef:m,zoom:s,pan:d,onViewportChange:u});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(Vn,{id:ie,gamma:fe,offset:Be}),i.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...be.style},onPointerDown:be.onPointerDown,onPointerMove:be.onPointerMove,onPointerUp:be.onPointerUp,onPointerCancel:be.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:pe,transformOrigin:"0 0"},children:[i.jsx("img",{ref:D,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:_e,imageRendering:Me,...n==="blend"?{opacity:o}:{}},onLoad:K=>{const q=K.currentTarget;_({w:q.naturalWidth,h:q.naturalHeight})}}),oe&&i.jsx(Ft,{data:w,settings:f,naturalWidth:b.w,naturalHeight:b.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:pe,transformOrigin:"0 0"},children:i.jsx("img",{ref:S,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:_e,imageRendering:Me,...n==="blend"?{opacity:1-o}:{}},onLoad:K=>{const q=K.currentTarget;P({w:q.naturalWidth,h:q.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:K=>{K.stopPropagation(),K.preventDefault();const q=K.currentTarget;try{q.setPointerCapture(K.pointerId)}catch{}const ye=q.parentElement.getBoundingClientRect(),ve=Ce=>{a==null||a(Math.max(0,Math.min(1,(Ce.clientX-ye.left)/ye.width)))},Ee=()=>{window.removeEventListener("pointermove",ve),window.removeEventListener("pointerup",Ee)};window.addEventListener("pointermove",ve),window.addEventListener("pointerup",Ee)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&M&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(je,{imageElRef:S,naturalWidth:M.w,naturalHeight:M.h,zoom:s,pan:d,sample:j,notation:y,version:L})}),e&&b&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(je,{imageElRef:D,naturalWidth:b.w,naturalHeight:b.h,zoom:s,pan:d,sample:Z,notation:y,version:L,onActiveChange:k})})]}):e&&b&&i.jsx(je,{imageElRef:D,naturalWidth:b.w,naturalHeight:b.h,zoom:s,pan:d,sample:Z,notation:y,version:L,onActiveChange:k}),T&&i.jsx(Pn,{notation:y,onChange:R})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!we?" cairn-drag-grip":""}`,draggable:h&&!we,onDragStart:v,style:{cursor:h&&!we?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),g]})]})}function Ua(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Fa({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:c=>{c==="side"?s==null||s():c==="slide"?r():c==="blend"?o():a(c)}}}}function Ga(e){const t=Pt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function za(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const u=e.data,c=new Uint16Array(o*4);for(let p=0;p<o;p++){const g=p*r,h=p*4;if(r===1){const v=u[g];c[h]=v,c[h+1]=v,c[h+2]=v,c[h+3]=it}else c[h]=u[g],c[h+1]=u[g+1],c[h+2]=u[g+2],c[h+3]=r>=4?u[g+3]:it}return{data:c,format:"rgba16float"}}const a=e.data,s=new Float32Array(o*4),d=u=>Number.isFinite(u)?u:0;for(let u=0;u<o;u++){const c=u*r;let p,g,h,v=1;r===1?p=g=h=d(a[c]):r===3?(p=d(a[c]),g=d(a[c+1]),h=d(a[c+2])):(p=d(a[c]),g=d(a[c+1]),h=d(a[c+2]),v=d(a[c+3]));const w=u*4;s[w]=p,s[w+1]=g,s[w+2]=h,s[w+3]=v}return{data:s,format:"rgba32float"}}function Va({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:d,diffSubmode:u,colormap:c="none",diffKernel:p,onDiffKernelChange:g,onCompareModeChange:h,onRequestSide:v,zoom:w,pan:f,onViewportChange:x,interpolation:m="auto",label:b="",pixelValueNotation:_="decimal"}){var Ir;const M=l.useRef(null),P=l.useRef(null),y=l.useRef(null),R=l.useRef(null),T=l.useRef(null),[k,D]=l.useState(!1),[S,A]=l.useState(!1),[E,L]=l.useState(null),[I,B]=l.useState(0),[Z,j]=l.useState(0),[oe,ie]=l.useState(null),[_e,fe]=l.useState({x:0,y:0,w:1,h:1}),Be=p??u??"absolute",[pe,Me,be]=ut(Be);l.useEffect(()=>{Me(p??u??"absolute")},[p,u,Me]);const we=l.useCallback(C=>{Me(C),g==null||g(C)},[g,Me]);l.useEffect(()=>{const C=M.current;if(C)return C.__cairnDiffKernel={current:pe,set:we},()=>{C&&delete C.__cairnDiffKernel}},[pe,we]);const[Y,he,K]=ut(o);l.useEffect(()=>{he(o)},[o,he]);const q=l.useCallback(C=>{he(C),h==null||h(C)},[h,he]),[ce,ye,ve]=ut(c);l.useEffect(()=>{ye(c)},[c,ye]);const Ee=l.useCallback(()=>{q(K.default),ye(ve.default),we(be.default)},[q,ye,we,K.default,ve.default,be.default]),Ce=K.isModified||ve.isModified||be.isModified,[F,G]=l.useState(0),[Q,W]=l.useState(0),J=l.useMemo(()=>{const V=[Fa({mode:Y,kernel:pe,kernelOptions:Sr().map(U=>({id:U.id,label:U.label})),onSide:v,onSlide:()=>q("split"),onBlend:()=>q("blend"),onKernel:U=>{q("diff"),we(U)}})];return Y==="diff"&&V.push(Ht(ce,U=>ye(U))),V},[Y,pe,ce,we,q,v]),$=l.useRef(null),O=l.useRef(null),z=l.useRef(null),ee=l.useRef(null),[te,H]=l.useState(0),ne=l.useRef(null),Se=l.useRef(null),[De,me]=l.useState(0),Te=Ut();l.useEffect(()=>{const C=y.current;if(!C)return;let V=!1;return ot().then(U=>{if(!V)try{if(On())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const N=U.createSurface(C,{hdr:!1});R.current={device:U,surface:N,texA:null,texB:null},A(!0)}catch(N){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",N),D(!0)}}).catch(U=>{V||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",U),D(!0))}),()=>{var N,re;V=!0;const U=R.current;U&&((N=U.texA)==null||N.destroy(),(re=U.texB)==null||re.destroy(),R.current=null)}},[]),l.useEffect(()=>{const C=M.current;if(!C)return;const V=new ResizeObserver(()=>j(U=>U+1));return V.observe(C),()=>V.disconnect()},[]),l.useEffect(()=>{if(!S)return;let C=!1;if(!R.current)return;async function U(N,re){if(re){const ue=za(re);return{width:re.width,height:re.height,imageData:null,make:se=>{const Pe=se.createTexture(re.width,re.height,ue.format);return Pe.write(ue.data),Pe}}}if(!N)return null;const ae=await qe(N);return ae?{width:ae.width,height:ae.height,imageData:ae,make:ue=>{const se=ue.createTexture(ae.width,ae.height,"rgba8unorm");return se.write(ae.data),se}}:null}return Promise.all([U(e,n),U(t,r)]).then(([N,re])=>{var se,Pe;if(C||!R.current)return;const ae=R.current;$.current=(N==null?void 0:N.imageData)??null,O.current=(re==null?void 0:re.imageData)??null,z.current=n??null,ee.current=r??null,(se=ae.texA)==null||se.destroy(),(Pe=ae.texB)==null||Pe.destroy(),ae.texA=null,ae.texB=null;const ue=N??re;if(!ue){L(null),H(ke=>ke+1);return}ae.texA=(re??ue).make(ae.device),ae.texB=(N??ue).make(ae.device),L({w:ue.width,h:ue.height}),H(ke=>ke+1),B(ke=>ke+1)}),()=>{C=!0}},[S,e,t,n,r]);const xe=n!=null||r!=null,ge=l.useMemo(()=>da(pe,xe),[pe,xe]),Le=l.useMemo(()=>{if(!xe)return null;const C=r??n;if(!C)return null;const V=C.precision==="f16-bits"?xn(C.data):C.data;return Ba(V,C.width,C.height,C.channels)},[xe,r,n]),Ke=l.useMemo(()=>{var C;return ro(((C=We(ge))==null?void 0:C.displayRange)??"unit",ce==="none"?null:ce)},[ge,ce]),Ge=l.useMemo(()=>ce!=="none"?Ga(ce):void 0,[ce]),en=l.useCallback(()=>{const C=R.current;if(!S||!C||!C.surface||!C.texA||!C.texB||!E)return;const V=M.current,U=V?V.getBoundingClientRect():{width:E.w,height:E.h},N=ar({zoom:w,pan:f},U,E.w,E.h);fe(se=>se.x===N.x&&se.y===N.y&&se.w===N.w&&se.h===N.h?se:N);const re=y.current;if(U.width>0&&U.height>0&&re&&C.surface){const se=Math.max(1,Math.round(U.width*Te)),Pe=Math.max(1,Math.round(U.height*Te));(re.width!==se||re.height!==Pe)&&(re.width=se,re.height=Pe,C.surface.configure(se,Pe))}const ae=ir(N,U,E.w,E.h)>=Gt?"nearest":"linear",ue=N;try{if(Y==="diff"){const se=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Pe=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ke=We(ge)?ge:"absolute",Je=ke==="hdr-flip"&&Le?{ppd:67,startExposure:Le.startExposure,stopExposure:Le.stopExposure,numExposures:Le.numExposures}:void 0,Ye=va(C.device,C.texA,C.texB,ke,Je,se,Pe);T.current=Ye,Pa(C.device,C.surface,Ye.texture,Ye.displayRange,{uv:ue,cmapMode:Ke,colormap:Ge,filter:ae,sourceDims:E,exposureEV:F,offset:Q})}else{const se={exposureEV:F,offset:Q,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ue,filter:ae,mode:Y,split:a,alpha:s};$o(C.device,C.surface,C.texA,C.texB,se)}}catch(se){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",se),D(!0)}},[S,E,w,f.x,f.y,Y,a,s,F,Q,pe,ge,Le,Ke,Ge,e,t,n,r,Te]);l.useEffect(()=>{en()},[en,I,Z]);const wt=t!=null||r!=null;l.useEffect(()=>{const C=R.current;if(!S||!C||!C.texA||!C.texB||!wt){ie(null);return}let V=!1;const U=C.texA,N=C.texB,re=T.current;return(Y==="diff"&&re?wa(C.device,re,U,N):Bn(C.device,U,N)).then(ue=>{V||ie(ue)}),()=>{V=!0}},[S,I,wt,Y,pe]),l.useEffect(()=>{if(Y!=="diff"){ne.current=null,Se.current=null;return}const C=R.current,V=T.current;if(!S||!C||!V)return;let U=!1;return ne.current=null,Se.current=null,me(N=>N+1),ya(C.device,V).then(N=>{U||(ne.current=N,Se.current={w:V.width,h:V.height},me(re=>re+1))}).catch(()=>{}),()=>{U=!0}},[S,Y,ge,I]);const Lr=(C,V)=>(U,N,re)=>{const ae=V.current;if(ae){const{data:Br,width:Or,height:Ka,channels:Nr}=ae;if(U<0||N<0||U>=Or||N>=Ka)return null;const Et=(N*Or+U)*Nr,_t=ae.precision==="f16-bits"?rn=>ct(Br[rn]??0):rn=>Br[rn]??0,Ya=.5,qa=Nr===1?[_t(Et)]:[_t(Et),_t(Et+1),_t(Et+2)];return Qe(qa,"unit",re,Ya)}const ue=C.current;if(!ue||U<0||N<0||U>=ue.width||N>=ue.height)return null;const se=(N*ue.width+U)*4,Pe=ue.data[se],ke=ue.data[se+1],Je=ue.data[se+2],Ye=(.299*Pe+.587*ke+.114*Je)/255;return Qe(Pe===ke&&ke===Je?[Pe]:[Pe,ke,Je],"uint8",re,Ye)},yt=l.useMemo(()=>Lr($,z),[]),tn=l.useMemo(()=>Lr(O,ee),[]),nn=l.useMemo(()=>(C,V,U)=>{var Ye;const N=ne.current,re=Se.current;if(!N||!re)return null;const{w:ae,h:ue}=re;if(C<0||V<0||C>=ae||V>=ue)return null;const se=(V*ae+C)*4,Pe=((Ye=We(ge))==null?void 0:Ye.output)??"per-channel",ke=.5,Je=Pe==="scalar"?[N[se]??0]:[N[se]??0,N[se+1]??0,N[se+2]??0];return Qe(Je,"unit",U,ke)},[ge]);l.useEffect(()=>{const C=M.current;if(C)return C.__cairnCompareProbe={sampleDiff:(V,U,N="decimal")=>nn(V,U,N),sampleFg:(V,U,N="decimal")=>yt(V,U,N),sampleRef:(V,U,N="decimal")=>tn(V,U,N),get diffSamples(){return ne.current},get dims(){return E},get diffResultDims(){return Se.current},get resolvedKernelId(){return ge},get compareMode(){return Y}},()=>{C&&delete C.__cairnCompareProbe}},[nn,yt,tn,E,ge,Y]);const Wa=m==="auto"?void 0:m;if(k)return n!=null||r!=null?i.jsx(Ua,{}):Y==="diff"?i.jsx(Kt,{imageUrl:e,baselineUrl:t,diffMode:((Ir=We(ge))==null?void 0:Ir.kind)==="pointwise"?ge:"absolute",interpolation:m,colormap:ce,showAxes:!1,zoom:w,pan:f,onViewportChange:x,label:b,pixelValueNotation:_}):i.jsx(Na,{imageUrl:e,baselineUrl:t,mode:Y,splitPosition:a,blendAlpha:s,onSplitPositionChange:d,zoom:w,pan:f,onViewportChange:x,interpolation:m,label:b,pixelValueNotation:_});const Ha=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:y,className:"w-full h-full block",style:{imageRendering:Wa},"data-gpu-compare-canvas":!0}),Y==="split"&&i.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:C=>{C.stopPropagation(),d==null||d(.5)},onPointerDown:C=>{C.stopPropagation(),C.preventDefault();const V=C.currentTarget;try{V.setPointerCapture(C.pointerId)}catch{}const N=V.parentElement.getBoundingClientRect(),re=ue=>{d==null||d(Math.max(0,Math.min(1,(ue.clientX-N.left)/N.width)))},ae=()=>{window.removeEventListener("pointermove",re),window.removeEventListener("pointerup",ae)};window.addEventListener("pointermove",re),window.addEventListener("pointerup",ae)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return i.jsx(ht,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":S},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:M,wrapperRef:P,zoom:w,pan:f,onViewportChange:x,naturalDims:E,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Ha,showAxes:!1,notationSeed:_,onReset:Ee,extraModified:Ce,exportCanvasRef:y,requestRender:en,leadingMenus:J,displayAdjust:{exposureEV:F,offset:Q,onExposureChange:G,onOffsetChange:W},label:"",showLabelChip:!1,overlay:{render:({notation:C,setOverlayActive:V})=>Y==="split"?i.jsxs(i.Fragment,{children:[wt&&E&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(je,{imageElRef:y,naturalWidth:E.w,naturalHeight:E.h,zoom:w,pan:f,sourceWindow:_e,sample:tn,notation:C,version:te})}),wt&&E&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(je,{imageElRef:y,naturalWidth:E.w,naturalHeight:E.h,zoom:w,pan:f,sourceWindow:_e,sample:yt,notation:C,version:te,onActiveChange:V})})]}):E&&i.jsx(je,{imageElRef:y,naturalWidth:E.w,naturalHeight:E.h,zoom:w,pan:f,sourceWindow:_e,sample:Y==="diff"?nn:yt,notation:C,version:Y==="diff"?De:te,onActiveChange:V})},extraChips:i.jsxs(i.Fragment,{children:[Y==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),b?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:b}):null,oe&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${b?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",oe.mse.toExponential(2)," · PSNR ",Number.isFinite(oe.psnr)?oe.psnr.toFixed(1):"∞"," dB · MAE"," ",oe.mae.toExponential(2)]})]})})}const $a="cairn-plot:gpu-image-ready";async function Xa(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await ot(),window.__cairnPlotGpuImagePane=Us,window.__cairnPlotGpuComparePane=Va,window.__cairnPlotDiffMenuModes=Sr(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event($a))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),sr("no-webgpu")}}}Xa()})(__cairnPlotJsxRuntime,__cairnPlotReact);
