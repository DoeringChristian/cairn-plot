var va=Object.defineProperty;var ba=(i,c,Ve)=>c in i?va(i,c,{enumerable:!0,configurable:!0,writable:!0,value:Ve}):i[c]=Ve;var ie=(i,c,Ve)=>ba(i,typeof c!="symbol"?c+"":c,Ve);(function(i,c){"use strict";const Ve=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function qt(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Ve}),{hdr:!1,format:n}}function vr(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Ve}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Ve}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return qt(e,t)}}}const br=`
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
`;function yt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Zt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function wr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const yr={texture:0,sampler:1,uniform:2};function Et(e,t){return e*3+yr[t]}const Er={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function _r(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const l=Er[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Qt{constructor(t,n,r,o){ie(this,"width");ie(this,"height");ie(this,"format");ie(this,"gpuTexture");ie(this,"device");ie(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:yt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Zt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class jt{constructor(t){ie(this,"_s");ie(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Mr{constructor(t,n,r,o,a){ie(this,"_p");ie(this,"gpuPipeline");ie(this,"bindings");ie(this,"bindGroupLayout");ie(this,"variants");ie(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Sr(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Tr{constructor(t){ie(this,"_c");ie(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Pr{constructor(t,n){ie(this,"_b");ie(this,"gpuBindGroup");ie(this,"ownedBuffers");ie(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Cr{constructor(t,n,r,o){ie(this,"canvas");ie(this,"hdr");ie(this,"format");ie(this,"context");ie(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function rt(e){return"canvas"in e}async function Ar(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(p){return rt(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function s(p){if(rt(p))return{width:p.canvas.width,height:p.canvas.height};const x=p;return{width:x.width,height:x.height}}let l=!1;const u=256;let d=null,f=null;function v(){if(!d||!f){const p=t.createShaderModule({code:br});f=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const x=t.createPipelineLayout({bindGroupLayouts:[f]});d=t.createComputePipeline({layout:x,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:d,layout:f}}return{backend:"webgpu",capabilities:n,createTexture(p,x,g){return new Qt(t,p,x,g)},createSampler(p){const x=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",g=t.createSampler({magFilter:x,minFilter:x,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new jt(g)},createRenderPipeline(p){const x=t.createShaderModule({code:p.shaderWGSL}),g=_r(p.shaderWGSL),b=yt(p.targetFormat),m=Sr(t,g),w=t.createPipelineLayout({bindGroupLayouts:[m]}),M=S=>t.createRenderPipeline({layout:w,vertex:{module:x,entryPoint:"vs_main"},fragment:{module:x,entryPoint:"fs_main",targets:[{format:S}]},primitive:{topology:"triangle-list"}}),_=M(b);return new Mr(_,g,m,b,M)},createComputePipeline(p){const x=t.createShaderModule({code:p.shaderWGSL}),g=t.createComputePipeline({layout:"auto",compute:{module:x,entryPoint:"cs_main"}});return new Tr(g)},createBindGroup(p,x){const g=p,b=new Map,m=[];for(const[M,_]of g.bindings)if(_.kind==="uniform"){const S=t.createBuffer({size:_.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});m.push(S),b.set(M,{binding:M,resource:{buffer:S}})}else _.kind==="sampler"&&b.set(M,{binding:M,resource:o()});for(const M of x){const _=M.resource;if(_ instanceof Qt){const S=Et(M.binding,"texture");g.bindings.has(S)&&b.set(S,{binding:S,resource:_.gpuTexture.createView()})}else if(_ instanceof jt){const S=Et(M.binding,"sampler");g.bindings.has(S)&&b.set(S,{binding:S,resource:_.gpuSampler})}else{const S=Et(M.binding,"uniform"),E=g.bindings.get(S);if(E&&E.kind==="uniform"){const P=_.uniform,k=t.createBuffer({size:Math.max(E.sizeBytes,P.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(k,0,P.buffer,P.byteOffset,P.byteLength),m.push(k),b.set(S,{binding:S,resource:{buffer:k}})}}}const w=t.createBindGroup({layout:g.bindGroupLayout,entries:Array.from(b.values())});return new Pr(w,m)},createSurface(p,x){const g=p.getContext("webgpu");if(!g)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const b=x.hdr&&n.hdr,m=()=>b?vr(g,t):qt(g,t),w=m();return new Cr(p,g,w,m)},renderFullscreen(p,x,g){const b=x,m=g,w=a(p),{width:M,height:_}=s(p),S=rt(p)?p.format:yt(p.format),E=b.pipelineFor(S),P=t.createCommandEncoder(),k=P.beginRenderPass({colorAttachments:[{view:w,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});k.setPipeline(E),k.setBindGroup(0,m.gpuBindGroup),k.setViewport(0,0,M,_,0,1),k.draw(3),k.end(),t.queue.submit([P.finish()])},async readback(p){const x=rt(p),{width:g,height:b}=s(p),m=x?p.hdr?"rgba16float":"rgba8unorm":p.format,w=x&&p.format==="bgra8unorm",M=x?p.getCurrentGPUTexture():p.gpuTexture,_=Zt(m),S=g*_,E=256,P=Math.ceil(S/E)*E,k=P*b,I=t.createBuffer({size:k,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),G=t.createCommandEncoder();G.copyTextureToBuffer({texture:M},{buffer:I,bytesPerRow:P,rowsPerImage:b},{width:g,height:b,depthOrArrayLayers:1}),t.queue.submit([G.finish()]),await I.mapAsync(GPUMapMode.READ);const A=new Uint8Array(I.getMappedRange()),T=new Uint8Array(S*b);for(let y=0;y<b;y++){const R=y*P,D=y*S;T.set(A.subarray(R,R+S),D)}if(I.unmap(),I.destroy(),m==="rgba8unorm"){if(w)for(let y=0;y<T.length;y+=4){const R=T[y],D=T[y+2];T[y]=D,T[y+2]=R}return T}if(m==="rgba16float"){const y=new Uint16Array(T.buffer,T.byteOffset,T.byteLength/2),R=new Float32Array(y.length);for(let D=0;D<y.length;D++)R[D]=wr(y[D]);return R}return new Float32Array(T.buffer,T.byteOffset,T.byteLength/4)},async reduceDiffSumSquaredAbs(p,x,g,b){const m=p,w=x,M=Math.max(0,g*b),_=Math.max(1,Math.ceil(M/u)),{pipeline:S,layout:E}=v(),P=_*2*4,k=t.createBuffer({size:P,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),I=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(I,0,new Uint32Array([Math.max(1,g),Math.max(1,b),M,0]));const G=t.createBindGroup({layout:E,entries:[{binding:0,resource:m.gpuTexture.createView()},{binding:1,resource:w.gpuTexture.createView()},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:I}}]}),A=t.createBuffer({size:P,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),T=t.createCommandEncoder(),y=T.beginComputePass();y.setPipeline(S),y.setBindGroup(0,G),y.dispatchWorkgroups(_),y.end(),T.copyBufferToBuffer(k,0,A,0,P),t.queue.submit([T.finish()]),await A.mapAsync(GPUMapMode.READ);const D=new Float32Array(A.getMappedRange()).slice();A.unmap(),A.destroy(),k.destroy(),I.destroy();let O=0,pe=0;for(let W=0;W<_;W++)O+=D[W*2],pe+=D[W*2+1];return{sumSq:O,sumAbs:pe}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let _t=null;async function Rr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Ar()}function ot(){return _t||(_t=Rr()),_t}function kr(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Lr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),l=o-a,[u,d,f]=kr(e[a],e[s],l);t[n*3]=Math.round(u),t[n*3+1]=Math.round(d),t[n*3+2]=Math.round(f)}return t}const Jt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Dr=new Set(["red-green","red-blue"]),en=new Map;function Mt(e){let t=en.get(e);if(!t){const n=Jt[e]??Jt.viridis;t=Lr(n),en.set(e,t)}return t}const Oe=e=>e<0?0:e>1?1:e,St=e=>{const t=e<0?0:e;return t/(1+t)},Tt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Oe(n/r)},tn={linear:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],srgb:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],reinhard:([e,t,n])=>[St(e),St(t),St(n)],aces:([e,t,n])=>[Tt(e),Tt(t),Tt(n)],extended:([e,t,n])=>[e,t,n]},Ir="srgb";function Or(e){return e&&tn[e]||tn[Ir]}function st(e,t,n){return e*2**t+n}function Br(e){const t=Oe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Pt(e,t){return typeof t=="number"&&t>0?Oe(Math.pow(Oe(e),1/t)):Br(e)}function Ct(e,t,n="linear",r=0,o=0){const a=Mt(t),s=new ImageData(e.width,e.height),l=e.data,u=s.data,d=r!==0||o!==0;for(let f=0;f<l.length;f+=4){let v=(l[f]+l[f+1]+l[f+2])/3;d&&(v=Math.max(0,Math.min(255,st(v/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+v/255*127):h=Math.round(v),h=Math.max(0,Math.min(255,h)),u[f]=a[h*3],u[f+1]=a[h*3+1],u[f+2]=a[h*3+2],u[f+3]=l[f+3]}return s}function Nr(e,t){return e==="signed"||e==="relative"?"signed":At(t)}function At(e){return Dr.has(e??"")?"positive":"linear"}function nn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const rn=nn(50);function Rt(e){return rn.get(e)}function kt(e,t){rn.set(e,t)}const on=nn(100);function Ur(e){return on.get(e)}function Fr(e,t){on.set(e,t)}function Gr(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const u=(s*e.width+l)*4,d=(s*t.width+l)*4,f=(s*r+l)*4;for(let v=0;v<3;v++){const h=e.data[u+v],p=t.data[d+v],x=h-p,g=Math.abs(x),b=Math.max(h,1);let m;switch(n){case"signed":m=(x+255)/2;break;case"absolute":m=g;break;case"squared":m=x*x/255;break;case"relative_signed":m=(x/b+1)*127.5;break;case"relative_absolute":m=g/b*255;break;case"relative_squared":m=x*x/(b*b)*255;break}a.data[f+v]=Math.min(255,Math.max(0,Math.round(m)))}a.data[f+3]=255}return a}async function He(e){const t=Ur(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Fr(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Vr={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},zr={linear:0,signed:1,positive:2},$r=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Xr=`#version 300 es
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
}`;let Ke=null,z=null,Ce=null,at=null;function Wr(){if(z)return z;try{if(typeof OffscreenCanvas<"u"?Ke=new OffscreenCanvas(1,1):Ke=document.createElement("canvas"),z=Ke.getContext("webgl2",{preserveDrawingBuffer:!0}),!z)return console.warn("[cairn] WebGL 2 not available"),null;const e=z.createShader(z.VERTEX_SHADER);if(z.shaderSource(e,$r),z.compileShader(e),!z.getShaderParameter(e,z.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",z.getShaderInfoLog(e)),null;const t=z.createShader(z.FRAGMENT_SHADER);if(z.shaderSource(t,Xr),z.compileShader(t),!z.getShaderParameter(t,z.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",z.getShaderInfoLog(t)),null;if(Ce=z.createProgram(),z.attachShader(Ce,e),z.attachShader(Ce,t),z.linkProgram(Ce),!z.getProgramParameter(Ce,z.LINK_STATUS))return console.error("[cairn] WebGL program link:",z.getProgramInfoLog(Ce)),null;at=z.createVertexArray(),z.bindVertexArray(at);const n=z.createBuffer();z.bindBuffer(z.ARRAY_BUFFER,n),z.bufferData(z.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),z.STATIC_DRAW);const r=z.getAttribLocation(Ce,"a_pos");return z.enableVertexAttribArray(r),z.vertexAttribPointer(r,2,z.FLOAT,!1,0,0),z.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),z}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function sn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Yr(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Hr(e,t,n,r){const o=Wr();if(!o||!Ce||!at||!Ke)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);Ke.width=a,Ke.height=s,o.viewport(0,0,a,s);const l=sn(o,e,0),u=sn(o,t,1);let d=null;n.colormap?d=Yr(o,n.colormap,2):(d=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,d),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ce),o.uniform1i(o.getUniformLocation(Ce,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ce,"u_other"),1),o.uniform1i(o.getUniformLocation(Ce,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ce,"u_diff_mode"),Vr[n.diffMode]),o.uniform1i(o.getUniformLocation(Ce,"u_cmap_mode"),zr[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ce,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(at),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const f=r.getContext("2d");return f&&(f.save(),f.scale(1,-1),f.drawImage(Ke,0,0,a,s,0,-s,a,s),f.restore()),o.deleteTexture(l),o.deleteTexture(u),o.deleteTexture(d),{width:a,height:s}}const Kr="cairn:render-mode";function qr(){try{const e=localStorage.getItem(Kr);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Be=new Uint32Array(512),Ne=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Be[e]=0,Be[e|256]=32768,Ne[e]=24,Ne[e|256]=24):t<-14?(Be[e]=1024>>-t-14,Be[e|256]=1024>>-t-14|32768,Ne[e]=-t-1,Ne[e|256]=-t-1):t<=15?(Be[e]=t+15<<10,Be[e|256]=t+15<<10|32768,Ne[e]=13,Ne[e|256]=13):t<128?(Be[e]=31744,Be[e|256]=64512,Ne[e]=24,Ne[e|256]=24):(Be[e]=31744,Be[e|256]=64512,Ne[e]=13,Ne[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var tt=Uint8Array,an=Uint16Array,Zr=Int32Array,Qr=new tt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),jr=new tt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),cn=function(e,t){for(var n=new an(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Zr(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},ln=cn(Qr,2),Jr=ln.b,eo=ln.r;Jr[28]=258,eo[258]=28,cn(jr,0);for(var to=new an(32768),ue=0;ue<32768;++ue){var ze=(ue&43690)>>1|(ue&21845)<<1;ze=(ze&52428)>>2|(ze&13107)<<2,ze=(ze&61680)>>4|(ze&3855)<<4,to[ue]=((ze&65280)>>8|(ze&255)<<8)>>1}for(var it=new tt(288),ue=0;ue<144;++ue)it[ue]=8;for(var ue=144;ue<256;++ue)it[ue]=9;for(var ue=256;ue<280;++ue)it[ue]=7;for(var ue=280;ue<288;++ue)it[ue]=8;for(var no=new tt(32),ue=0;ue<32;++ue)no[ue]=5;var ro=new tt(0),oo=typeof TextDecoder<"u"&&new TextDecoder,so=0;try{oo.decode(ro,{stream:!0}),so=1}catch{}const un=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Lt(e){const t=un.length;return un[(e%t+t)%t]}function ao(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),l=c.useRef(null),u=c.useCallback((d,f)=>{o(v=>v.w===d&&v.h===f?v:{w:d,h:f})},[]);return c.useLayoutEffect(()=>{const d=n.current;if(!d||d===l.current)return;const f=d.getBoundingClientRect();(f.width>0||f.height>0)&&(l.current=d,u(f.width,f.height))}),c.useEffect(()=>{var v;const d=n.current;if(d===s.current||((v=a.current)==null||v.disconnect(),a.current=null,s.current=d,!d))return;const f=new ResizeObserver(h=>{for(const p of h)u(p.contentRect.width,p.contentRect.height)});a.current=f,f.observe(d)}),c.useEffect(()=>()=>{var d;return(d=a.current)==null?void 0:d.disconnect()},[]),{ref:n,size:r}}function io(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const co=.25,Dt=64;function dn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Dt;const o=Math.min(n/e,r/t);return o<=0?Dt:Math.max(Math.max(n,r)/o,8)}function fn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=co,maxZoom:s=Dt,naturalWidth:l,naturalHeight:u}=e,d=io(),f=c.useRef(d);f.current=d;const v=c.useRef({zoom:n,pan:r});v.current={zoom:n,pan:r};const h=c.useRef(o);h.current=o,c.useEffect(()=>{const w=t.current;if(!w||!o)return;const M=_=>{var R;if(!f.current)return;_.preventDefault(),_.stopPropagation();const S=_.deltaY<0?1.1:1/1.1,E=v.current,P=w.getBoundingClientRect(),k=l&&u?dn(l,u,P.width,P.height):s,I=Math.max(a,Math.min(k,E.zoom*S));if(E.zoom===I)return;const G=_.clientX-P.left,A=_.clientY-P.top,T=G-(G-E.pan.x)/E.zoom*I,y=A-(A-E.pan.y)/E.zoom*I;(R=h.current)==null||R.call(h,{zoom:I,pan:{x:T,y}})};return w.addEventListener("wheel",M,{passive:!1}),()=>w.removeEventListener("wheel",M)},[t,!!o,a,s,l,u]);const p=c.useRef(null),x=c.useCallback(w=>{!f.current||!h.current||(w.currentTarget.setPointerCapture(w.pointerId),p.current={pointerId:w.pointerId,startX:w.clientX,startY:w.clientY,panX:v.current.pan.x,panY:v.current.pan.y})},[]),g=c.useCallback(w=>{var E;const M=p.current;if(!M||M.pointerId!==w.pointerId)return;const _=w.clientX-M.startX,S=w.clientY-M.startY;(E=h.current)==null||E.call(h,{zoom:v.current.zoom,pan:{x:M.panX+_,y:M.panY+S}})},[]),b=c.useCallback(w=>{const M=p.current;if(!(!M||M.pointerId!==w.pointerId)){try{w.currentTarget.releasePointerCapture(w.pointerId)}catch{}p.current=null}},[]),m=d&&!!o;return{containerProps:{onPointerDown:x,onPointerMove:g,onPointerUp:b,onPointerCancel:b,style:{cursor:m?"move":void 0,touchAction:m?"none":void 0}},modifierActive:d}}function It(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ct(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function lo(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function pn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Ot({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=ao(),s=c.useRef(null),l=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),u=c.useMemo(()=>{const g=a.w,b=a.h;if(g<=0||b<=0||n<=0||r<=0)return null;const m=Math.min(g/n,b/r),w=n*m,M=r*m;return{left:(g-w)/2,top:(b-M)/2,width:w,height:M}},[a.w,a.h,n,r]),d=e.masks,f=t.showMasks&&!!d&&d.length>0,v=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!f||!d)return;const g=s.current;if(!g)return;(g.width!==n||g.height!==r)&&(g.width=n,g.height=r);const b=g.getContext("2d");if(!b)return;b.clearRect(0,0,g.width,g.height);let m=!1;const w=b.createImageData(n,r),M=w.data;let _=d.length,S=!1;const E=()=>{m||S&&b.putImageData(w,0,0)},P=document.createElement("canvas");P.width=n,P.height=r;const k=P.getContext("2d",{willReadFrequently:!0});for(const I of d){const G=new Image;G.onload=()=>{if(!m){if(k){k.clearRect(0,0,n,r),k.drawImage(G,0,0,n,r);const A=k.getImageData(0,0,n,r).data;for(let T=0;T<n*r;T++){const y=A[T*4];if(y===0||l.has(y))continue;const[R,D,O]=lo(Lt(y));M[T*4]=R,M[T*4+1]=D,M[T*4+2]=O,M[T*4+3]=255,S=!0}}_-=1,_===0&&E()}},G.onerror=()=>{_-=1,_===0&&E()},G.src=`data:image/png;base64,${I.png_b64}`}return()=>{m=!0}},[f,d,n,r,v]),!u)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],p=t.showBoxes&&h.length>0,x=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[f&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),p&&i.jsx("svg",{className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((g,b)=>{if(!pn(g,t,l))return null;const m=g.domain==="pixel"?1:n,w=g.domain==="pixel"?1:r,M=g.position.minX*m,_=g.position.minY*w,S=(g.position.maxX-g.position.minX)*m,E=(g.position.maxY-g.position.minY)*w;return i.jsx("rect",{x:M,y:_,width:S,height:E,fill:"none",stroke:Lt(g.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),p&&i.jsx("div",{className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height},children:h.map((g,b)=>{if(!pn(g,t,l))return null;const m=g.domain==="pixel"?1/n:1,w=g.domain==="pixel"?1/r:1,M=g.position.minX*m*100,_=g.position.minY*w*100,S=g.label??x[String(g.class_id)]??`#${g.class_id}`,E=g.score!=null?` ${(g.score*100).toFixed(0)}%`:"";return!S&&!E?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${M}%`,top:`${_}%`,transform:"translateY(-100%)",backgroundColor:Lt(g.class_id)},children:i.jsxs("span",{className:"mono",children:[S,E]})},b)})})]})}const Bt=30,lt=["#ff5a5a","#39d353","#5b9bff"];function Nt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function Je(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Nt(e/255):Nt(n==="int"?e*255:e)}function qe(e,t,n,r){return e.length===1?{lines:[Je(e[0],t,n)],luminance:r}:{lines:e.map(o=>Je(o,t,n)),luminance:r,colors:e.map((o,a)=>lt[a]??null)}}const uo={x:0,y:0,w:1,h:1};function Ze({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:l=0,onActiveChange:u,sourceWindow:d=uo}){const f=c.useRef(null),v=c.useRef(!1),h=It(),p=c.useRef(u);p.current=u;const x=c.useCallback(b=>{var m;b!==v.current&&(v.current=b,(m=p.current)==null||m.call(p,b))},[]),g=c.useCallback(()=>{var be;const b=f.current,m=e.current;if(!b)return;const w=window.devicePixelRatio||1,M=b.clientWidth,_=b.clientHeight;if(M===0||_===0)return;b.width!==Math.round(M*w)&&(b.width=Math.round(M*w)),b.height!==Math.round(_*w)&&(b.height=Math.round(_*w));const S=b.getContext("2d");if(!S)return;if(S.setTransform(w,0,0,w,0,0),S.clearRect(0,0,M,_),!m||t<=0||n<=0){x(!1);return}const E=m.getBoundingClientRect(),P=b.getBoundingClientRect();if(E.width===0||E.height===0){x(!1);return}const k=d.x*t,I=d.y*n,G=d.w*t,A=d.h*n;if(G<=0||A<=0){x(!1);return}const T=Math.min(E.width/G,E.height/A);if(T<Bt){x(!1);return}const y=G*T,R=A*T,D=E.left+(E.width-y)/2-P.left,O=E.top+(E.height-R)/2-P.top,pe=Math.max(Math.floor(k),Math.floor(k+(0-D)/T)),W=Math.min(Math.ceil(k+G),Math.ceil(k+(M-D)/T)),he=Math.max(Math.floor(I),Math.floor(I+(0-O)/T)),ve=Math.min(Math.ceil(I+A),Math.ceil(I+(_-O)/T));if(W<=pe||ve<=he){x(!1);return}x(!0);const xe=D+(0-k)*T,Me=O+(0-I)*T,De=D+(t-k)*T,de=O+(n-I)*T;S.save(),S.beginPath(),S.rect(xe,Me,De-xe,de-Me),S.clip(),S.textAlign="center",S.textBaseline="middle",S.lineJoin="round";const ye=T*.14,ge=T-ye*2;for(let q=he;q<ve;q++)for(let fe=pe;fe<W;fe++){if(fe<0||q<0||fe>=t||q>=n)continue;const Y=a(fe,q,s);if(!Y||Y.lines.length===0)continue;const Z=Y.lines.length;let ne=1;for(const V of Y.lines)V.length>ne&&(ne=V.length);const we=ge/(Z*1.15),me=ge/(ne*.62)||we,Ee=Math.min(we,me,24);if(Ee<6)continue;const Le=D+(fe-k+.5)*T,N=O+(q-I+.5)*T,F=Ee*1.15,ee=Y.luminance<=.55,$=ee?"#ffffff":"#000000";S.font=`${Ee}px ui-monospace, SFMono-Regular, Menlo, monospace`,S.lineWidth=Math.max(1.4,Ee*.16),S.strokeStyle=ee?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let H=N-Z*F/2+F/2;for(let V=0;V<Y.lines.length;V++){const L=Y.lines[V];S.strokeText(L,Le,H),S.fillStyle=((be=Y.colors)==null?void 0:be[V])??$,S.fillText(L,Le,H),H+=F}}S.restore()},[e,t,n,a,s,x,d]);return c.useEffect(()=>{g()},[g,r,o.x,o.y,l,s,d,h]),c.useEffect(()=>{const b=f.current;if(!b)return;const m=new ResizeObserver(()=>g());return m.observe(b),()=>m.disconnect()},[g]),i.jsx("canvas",{ref:f,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function hn({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const fo=`
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
`,po=`
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
${po}

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
`}const ho=mn("select(colorB, colorA, uv.x < split)"),go=mn("mix(colorA, colorB, alpha)"),Ut={linear:0,srgb:1,reinhard:2,aces:3,extended:4},xn=new WeakMap;function mo(e,t){let n=xn.get(e);n||(n=new Map,xn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:fo,targetFormat:t}),n.set(t,r)),r}function vn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function bn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function xo(e,t,n,r){var g;const o=vn(t),a=mo(e,o),s=bn(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,u=Ut[r.operator]??Ut.srgb,d=new Float32Array([r.exposureEV,u,l,r.isScalar?1:0]),f=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),v=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),p=new Float32Array([r.offset??0]);let x;try{x=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:d}},{binding:3,resource:{uniform:f}},{binding:4,resource:{uniform:v}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:p}}]),e.renderFullscreen(t,a,x)}finally{(g=x==null?void 0:x.destroy)==null||g.call(x),s.destroy()}}const wn=new WeakMap;function vo(e,t,n){let r=wn.get(e);r||(r=new Map,wn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?ho:go,targetFormat:n}),r.set(o,a)),a}function bo(e,t,n,r,o){var g;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=vn(t),s=vo(e,o.mode,a),l=bn(e,void 0),u=o.gamma,d=Ut[o.operator],f=new Float32Array([o.exposureEV,d,u,0]),v=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),p=new Float32Array([o.offset??0,0,0,0]);let x;try{x=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:f}},{binding:4,resource:{uniform:v}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:p}}]),e.renderFullscreen(t,s,x)}finally{(g=x==null?void 0:x.destroy)==null||g.call(x),l.destroy()}}function yn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function En(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:h,sumAbs:p}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return yn(h,p,a)}const s=await e.readback(t),l=await e.readback(n),u=s instanceof Uint8Array,d=l instanceof Uint8Array;let f=0,v=0;for(let h=0;h<o;h++)for(let p=0;p<r;p++){const x=(h*t.width+p)*4,g=(h*n.width+p)*4;for(let b=0;b<3;b++){const m=(s[x+b]??0)/(u?255:1),w=(l[g+b]??0)/(d?255:1),M=m-w;f+=M*M,v+=Math.abs(M)}}return yn(f,v,a)}function _n(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const wo=12,$e=[];function Mn(e){const t=$e.indexOf(e);t!==-1&&$e.splice(t,1),$e.push(e)}function yo(e){const t=$e.indexOf(e);t!==-1&&$e.splice(t,1)}function dt(e){e.parked||(yo(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Sn(e){for(;$e.length>wo;){const t=$e.find(n=>n!==e&&!n.visible)??$e.find(n=>n!==e);if(!t)break;dt(t)}}function Tn(e){var o,a;if(e.disposed)return;if(_n())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Mn(e),Sn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,Mn(e),Sn(e)}function Eo(e,t){if(e.disposed||!e.source)return!0;try{return Tn(e),!e.surface||!e.srcTexture?!1:(xo(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,dt(e),!1}}function _o(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Eo(e,t)},park(){e.disposed||dt(e)},restore(){e.disposed||!e.source||Tn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(dt(e),e.source=null,e.disposed=!0)}}}async function Mo(e,t){const n=await ot(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return _o(r)}function Pn(e){e.dispose()}function So(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function Cn(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:l,flipSign:u}=e,d=c.useMemo(()=>So(e,n),[n,r,o,s,u]);return{gammaFilterId:n,filterStr:d,gamma:a,offset:l}}function An({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Rn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function To({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Rn(e),a=Rn(t),s=[];for(let w=0;w<=e;w+=o)s.push(w);const l=[];for(let w=0;w<=t;w+=a)l.push(w);const u=1/n,d=8*u,f=-12*u,v=-2*u,h=r==null?void 0:r.current;let p=0,x=0,g=0,b=0;if(h){const w=h.clientWidth,M=h.clientHeight,_=w/e,S=M/t,E=Math.min(_,S);g=e*E,b=t*E,p=(w-g)/2,x=(M-b)/2}const m=h&&g>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?x:0,transform:`translateY(${f}px)`,fontSize:d},children:s.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",left:m?p+w/e*g:`${w/e*100}%`,transform:"translateX(-50%)"},children:w},w))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?p:0,transform:`translateX(${v}px)`,fontSize:d},children:l.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",top:m?x+w/t*b:`${w/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*u}px`},children:w},w))})]})}function Po({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Co=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function kn(e,t){const n=getComputedStyle(e),r=Co.map(u=>`${u}:${n.getPropertyValue(u)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,l=Math.min(a.length,s.length);for(let u=0;u<l;u++)kn(a[u],s[u])}function Ft(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Gt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Vt(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,u)=>a.toBlob(d=>d?l(d):u(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Ao(e,t,n){const r=e.cloneNode(!0);kn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const u=new Image;u.onload=()=>s(u),u.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),u.src=a})}async function Ln(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Ft(e);return Vt(r,o,Gt(t),a,s=>s.drawImage(e,0,0,r,o))}async function Ro(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Ft(e);try{return await Vt(r,o,Gt(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function ko(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function Lo(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??Ft(e);if(n){const d=n.getBoundingClientRect(),f=await Ao(n,d.width||a,d.height||s);return Vt(a,s,Gt(t),l,v=>{for(const h of r){const p=h.getBoundingClientRect();v.drawImage(h,p.left-o.left,p.top-o.top,p.width,p.height)}v.drawImage(f,d.left-o.left,d.top-o.top,d.width,d.height)})}if(r.length)return Ln(r[0],t);const u=ko(e);if(u)return Ro(u,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Do(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Io=8;function Oo(e,t,n,r=Io){return!(t>0)||!(e>0)?n:e<t+r}function Dn(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}const Bo={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},No={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function Fe({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:No[e]??null})}function In({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(Fe,{name:e??""})})}function On(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Uo({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:a}=n,[s,l]=c.useState(!1),[u,d]=c.useState(0),f=c.useRef(null),v=Dn(r,o),h=e?void 0:((b=r[v])==null?void 0:b.label)??"",p=c.useCallback(()=>{l(m=>{const w=!m;return w&&d(v),w})},[v]),x=c.useCallback(m=>{a(m),l(!1)},[a]);c.useEffect(()=>{if(!s)return;const m=M=>{f.current&&!f.current.contains(M.target)&&l(!1)},w=M=>{M.key==="Escape"&&(M.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",w,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",w,!0)}},[s]);const g=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),d(v),l(!0));return}if(m.key==="ArrowDown")m.preventDefault(),d(w=>(w+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),d(w=>(w-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const w=r[u];w&&x(w.id)}};return i.jsxs("div",{ref:f,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),p()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:g,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?i.jsx("span",{"aria-hidden":"true",children:h}):i.jsx(Fe,{name:e??""}),i.jsx(Fe,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,w)=>{const M=m.id===o,_=w===u;return i.jsx("li",{role:"option","aria-selected":M,children:i.jsx("button",{type:"button",onClick:S=>{S.stopPropagation(),x(m.id)},onPointerEnter:()=>d(w),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",_?"bg-bg-hover":"",M?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const Fo=e=>e.format?e.format(e.value):String(e.value);function Bn({spec:e}){return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:t=>t.stopPropagation(),onDoubleClick:t=>{t.stopPropagation(),e.defaultValue!==void 0&&e.onChange(e.defaultValue)},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx(Fe,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:t=>e.onChange(Number(t.target.value)),onPointerDown:t=>t.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Fo(e)})]})}function Go({icon:e,title:t,menu:n,onClose:r}){var v;const{options:o,value:a,onSelect:s}=n,[l,u]=c.useState(!1),d=Dn(o,a),f=((v=o[d])==null?void 0:v.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:h=>{h.stopPropagation(),u(p=>!p)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx(Fe,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:f}),i.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:i.jsx(Fe,{name:"caret"})})]}),l&&o.map(h=>{const p=h.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":p,"data-menu-option":"",onClick:x=>{x.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",p?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:p?"✓":""}),i.jsx("span",{children:h.label})]},h.id)})]})}function Vo({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return c.useEffect(()=>{if(!r)return;const s=u=>{a.current&&!a.current.contains(u.target)&&o(!1)},l=u=>{u.key==="Escape"&&(u.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx(Fe,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(Go,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var u;l.stopPropagation(),!s.disabled&&((u=s.onClick)==null||u.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Fe,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Fe,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(Bn,{spec:s})},s.id))]})]})}function zo({controller:e,config:t}){var A,T;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),l=`${((A=t==null?void 0:t.leadingButtons)==null?void 0:A.length)??0}:${((T=t==null?void 0:t.sliders)==null?void 0:T.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const y=n.current,R=y==null?void 0:y.parentElement;if(!R)return;const D=()=>{const he=R.clientWidth;if(!a.current&&n.current){const ve=n.current.scrollWidth;ve>0&&(s.current=ve)}o(Oo(he,s.current,a.current))};let O=0;const pe=()=>{O||(O=requestAnimationFrame(()=>{O=0,D()}))},W=new ResizeObserver(pe);return W.observe(R),D(),()=>{W.disconnect(),O&&cancelAnimationFrame(O)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const u=e.capabilities,d=t==null?void 0:t.buttons,f=(y,R)=>R&&(d==null?void 0:d[y])!==!1,v=y=>()=>e.setDragMode(y),h=()=>{e.toPNG({filename:"plot"}).then(y=>Do(y,"plot.png")).catch(()=>{})},p=[];f("zoom",u.zoom)&&p.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:v("zoom")}),f("pan",u.pan)&&p.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:v("pan")}),f("select",u.select)&&p.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:v("select")}),f("lasso",u.lasso)&&p.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:v("lasso")});const x=[];f("zoomIn",u.zoom)&&x.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),f("zoomOut",u.zoom)&&x.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const g=[];f("autoscale",u.autoscale)&&g.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),f("reset",u.reset)&&g.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const b=[];f("screenshot",u.screenshot)&&b.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[p,x,g,b].filter(y=>y.length>0),w=m.flat(),M=(t==null?void 0:t.leadingButtons)??[],_=(t==null?void 0:t.sliders)??[];if(!M.length&&w.length===0&&_.length===0)return null;const S=(t==null?void 0:t.position)??"top-right",E=(t==null?void 0:t.visibility)==="always",P=S==="top-right"||S==="bottom-right",I=["z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",E?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),G={position:"absolute",pointerEvents:"auto",...Bo[S]};return r?i.jsx("div",{ref:n,style:G,className:`${I} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(Vo,{actions:w,leading:M,sliders:_})}):i.jsxs("div",{ref:n,style:G,className:`${I} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${P?"justify-end":"justify-start"}`,children:[M.length>0&&i.jsxs(i.Fragment,{children:[M.map(y=>y.menu?i.jsx(Uo,{icon:y.icon,title:y.title,menu:y.menu},y.id):i.jsx(In,{icon:y.icon,label:y.label,title:y.title,active:y.active,disabled:y.disabled,onClick:y.onClick??(()=>{})},y.id)),m.length>0&&i.jsx(On,{})]}),m.map((y,R)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[R>0&&i.jsx(On,{}),y.map(D=>i.jsx(In,{icon:D.icon,title:D.title,active:D.active,disabled:D.disabled,onClick:D.onClick},D.id))]},y[0].id))]}),_.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${P?"justify-end":"justify-start"}`,children:_.map(y=>i.jsx(Bn,{spec:y},y.id))})]})}const $o={zoom:1,pan:{x:0,y:0}},Nn=1.3,Xo=.25,Wo=64,Yo={buttons:{zoom:!1}};function Ho(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Ko=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function zt(e,t){return{id:"colormap",title:"Colormap",menu:{options:Ko,value:e,onSelect:t}}}function qo({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:l=Xo,maxZoom:u=Wo,requestRender:d,onReset:f,extraModified:v=!1}){const h=c.useCallback(E=>{var O;if(!o)return;const P=(O=e.current)==null?void 0:O.getBoundingClientRect(),k=(P==null?void 0:P.width)??0,I=(P==null?void 0:P.height)??0,G=a&&s&&k>0&&I>0?dn(a,s,k,I):u,A=Math.max(l,Math.min(G,n*E));if(A===n)return;const T=k/2,y=I/2,R=T-(T-r.x)/n*A,D=y-(y-r.y)/n*A;o({zoom:A,pan:{x:R,y:D}})},[o,e,a,s,u,l,n,r.x,r.y]),p=c.useCallback(()=>h(Nn),[h]),x=c.useCallback(()=>h(1/Nn),[h]),g=c.useCallback(()=>{o==null||o($o),f==null||f()},[o,f]),b=c.useCallback(E=>{const P={scale:E==null?void 0:E.scale,filename:E==null?void 0:E.filename};d==null||d();const k=t==null?void 0:t.current;if(k)return Ln(k,P);const I=e.current;return I?Lo(I,P):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,d]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),w=n!==1||r.x!==0||r.y!==0||v,M=c.useCallback(E=>{},[]),_=c.useCallback(E=>{},[]),S=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:w,setDragMode:M,setHoverMode:_,toggleSpikelines:S,zoomIn:p,zoomOut:x,autoscale:g,reset:g,toPNG:b}),[m,w,M,_,S,p,x,g,b])}const Zo={zoom:1,pan:{x:0,y:0}};function ft({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:l,naturalDims:u,checkerboard:d,wrapperClassName:f,wrapperStyle:v,viewportPadding:h,header:p,surface:x,showAxes:g,overlayNode:b,overlay:m,notationSeed:w,exportCanvasRef:M,requestRender:_,leadingMenus:S,displayAdjust:E,onReset:P,extraModified:k,label:I,showLabelChip:G,isDraggable:A=!1,onDragStart:T,extraChips:y}){const[R,D]=c.useState(w),[O,pe]=c.useState(!1),{containerProps:W}=fn({containerRef:r,zoom:a,pan:s,onViewportChange:l,naturalWidth:u==null?void 0:u.w,naturalHeight:u==null?void 0:u.h}),he=c.useCallback(()=>{E==null||E.onExposureChange(0),E==null||E.onOffsetChange(0),P==null||P()},[E,P]),ve=c.useCallback(()=>{l==null||l(Zo),he()},[l,he]),xe=qo({rootRef:r,canvasRef:M,zoom:a,pan:s,onViewportChange:l,naturalWidth:u==null?void 0:u.w,naturalHeight:u==null?void 0:u.h,requestRender:_,onReset:he,extraModified:((E==null?void 0:E.exposureEV)??0)!==0||((E==null?void 0:E.offset)??0)!==0||!!k}),Me=c.useMemo(()=>{if(!E)return;const q=(fe,Y)=>`${fe>=0?"+":"−"}${Math.abs(fe).toFixed(Y)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to reset.",min:-8,max:8,step:.1,value:E.exposureEV,onChange:E.onExposureChange,format:fe=>q(fe,1),defaultValue:0},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to reset.",min:-1,max:1,step:.01,value:E.offset,onChange:E.onOffsetChange,format:fe=>q(fe,2),defaultValue:0}]},[E]),De=c.useMemo(()=>({...Yo,leadingButtons:[...S??[],...O?[Ho(R,D)]:[]],sliders:Me}),[O,R,S,Me]),de=" cairn-checkerboard",ye="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(d==="pane"?de:""),ge=f+(d==="wrapper"?de:""),be="render"in m?m.render({notation:R,setOverlayActive:pe}):m.hasSource&&u?i.jsx(Ze,{imageElRef:m.displayElRef,naturalWidth:u.w,naturalHeight:u.h,zoom:a,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:R,version:m.version,onActiveChange:pe}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[p,n&&i.jsx(zo,{controller:xe,config:De}),i.jsxs("div",{ref:r,className:ye,style:{padding:h,...W.style},onPointerDown:W.onPointerDown,onPointerMove:W.onPointerMove,onPointerUp:W.onPointerUp,onPointerCancel:W.onPointerCancel,onDoubleClick:ve,...t,children:[i.jsxs("div",{ref:o,className:ge,style:v,children:[x,g&&u&&i.jsx(To,{naturalWidth:u.w,naturalHeight:u.h,zoom:a,containerRef:o}),b]}),be,!n&&O&&i.jsx(hn,{notation:R,onChange:D})]}),G&&i.jsx(Po,{label:I,isDraggable:A,onDragStart:T}),y]})}function Un(e){return"hdr"in e&&e.hdr!=null}function Fn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Se(e){return Number.isFinite(e)?e:0}const Qo={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function jo(e,t,n,r,o=0){const{h:a,w:s,c:l}=Fn(e.shape),u=e.data,d=Or(t),f=new Uint8ClampedArray(s*a*4);for(let v=0;v<s*a;v++){const h=v*l;let p,x,g,b=1;l===1?p=x=g=Se(u[h]):l===3?(p=Se(u[h]),x=Se(u[h+1]),g=Se(u[h+2])):(p=Se(u[h]),x=Se(u[h+1]),g=Se(u[h+2]),b=Se(u[h+3]));const m=[st(p,n,o),st(x,n,o),st(g,n,o)],[w,M,_]=d(m),S=v*4;f[S]=255*Pt(w,r),f[S+1]=255*Pt(M,r),f[S+2]=255*Pt(_,r),f[S+3]=255*(b<0?0:b>1?1:b)}return new ImageData(f,s,a)}function Jo(e){var H,V;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:l=!1,processing:u=Qo,zoom:d=1,pan:f={x:0,y:0},onViewportChange:v,onNaturalSize:h,label:p,isDraggable:x=!1,onDragStart:g,overlay:b,overlaySettings:m,pixelValueNotation:w="decimal",toolbar:M=!0}=e,[_,S,E]=ct(s);c.useEffect(()=>{S(s)},[s,S]);const P=c.useRef(null),k=c.useRef(null),I=c.useRef(null),G=c.useRef(null),A=c.useRef(null),T=c.useRef(null),y=c.useRef(null),[R,D]=c.useState(0),O=c.useCallback(()=>D(L=>L+1),[]),pe=c.useMemo(()=>({get current(){const L=A.current;return L instanceof HTMLCanvasElement?L:null}}),[]),W=c.useCallback(L=>{P.current=L,L&&(A.current=L)},[]),he=c.useCallback(L=>{k.current=L,L&&(A.current=L)},[]),ve=c.useCallback(L=>{L&&(A.current=L)},[]),[xe,Me]=c.useState(!1),[De,de]=c.useState(!1),[ye,ge]=c.useState(null),{flipSign:be}=u,{gammaFilterId:q,filterStr:fe,gamma:Y,offset:Z}=Cn(u),ne=!r&&o!=="none"&&n!=null&&t!=null,we=o!=="none"&&n!=null,me=_!=="none"&&!ne&&!(r&&we)&&t!=null;c.useEffect(()=>{if(!me||!t){de(!1);return}let L=!1;de(!1);const K=`${t}::${_}`,Q=Rt(K);if(Q){const X=k.current;if(X){X.width=Q.width,X.height=Q.height;const te=X.getContext("2d");te&&te.putImageData(Q,0,0),y.current=Q,O(),ge({w:Q.width,h:Q.height}),h==null||h(Q.width,Q.height),de(!0)}return}const j=new Image;return j.onload=()=>{if(L)return;const X=document.createElement("canvas");X.width=j.naturalWidth,X.height=j.naturalHeight;const te=X.getContext("2d");if(!te)return;te.drawImage(j,0,0);const Ae=te.getImageData(0,0,X.width,X.height),Te=At(_),ae=Ct(Ae,_,Te);kt(K,ae);const Pe=k.current;if(!Pe||L)return;Pe.width=ae.width,Pe.height=ae.height;const re=Pe.getContext("2d");re&&re.putImageData(ae,0,0),y.current=ae,O(),ge({w:ae.width,h:ae.height}),h==null||h(ae.width,ae.height),de(!0)},j.src=t,()=>{L=!0}},[me,t,_]);const Ee=c.useCallback((L,K)=>{ge(Q=>Q&&Q.w===L&&Q.h===K?Q:{w:L,h:K}),h==null||h(L,K)},[]);c.useEffect(()=>{if(!t){T.current=null,y.current=null,O();return}let L=!1;return He(t).then(K=>{L||(T.current=K,_==="none"&&(y.current=K),O())}),()=>{L=!0}},[t,_,O]);const Le=c.useCallback((L,K,Q)=>{const j=T.current;if(!j||L<0||K<0||L>=j.width||K>=j.height)return null;const X=(K*j.width+L)*4,te=j.data[X],Ae=j.data[X+1],Te=j.data[X+2],ae=y.current;let Pe=te,re=Ae,Re=Te;if(ae&&ae.width===j.width&&ae.height===j.height){const Ie=(K*ae.width+L)*4;Pe=ae.data[Ie],re=ae.data[Ie+1],Re=ae.data[Ie+2]}const je=(.299*Pe+.587*re+.114*Re)/255;return qe(_!=="none"||te===Ae&&Ae===Te?[te]:[te,Ae,Te],"uint8",Q,je)},[_]);c.useEffect(()=>{if(!ne){Me(!1);return}let L=!1;const K=qr(),Q=K==="gpu"||K==="auto",j=`${n}::${t}::${o}::${_}`;if(K!=="gpu"){const X=Rt(j);if(X){const te=P.current;if(te){(te.width!==X.width||te.height!==X.height)&&(te.width=X.width,te.height=X.height);const Ae=te.getContext("2d");Ae&&Ae.putImageData(X,0,0),Ee(X.width,X.height),Me(!0)}return}}return(async()=>{const[X,te]=await Promise.all([He(n),He(t)]);if(L||!X||!te)return;const Te=o.includes("signed")?"signed":"positive",ae=_!=="none"?Mt(_):null,Pe={diffMode:o,colormap:ae,cmapMode:Te};if(Q)try{const We=P.current;if(We){const Ie=Hr(X,te,Pe,We);if(Ie){if(L)return;Ee(Ie.width,Ie.height),Me(!0);return}}}catch(We){console.warn("[cairn] WebGL 2 diff error:",We)}if(K==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let re=Gr(X,te,o);_!=="none"&&(re=Ct(re,_,Te)),kt(j,re);const Re=P.current;if(!Re||L)return;(Re.width!==re.width||Re.height!==re.height)&&(Re.width=re.width,Re.height=re.height);const je=Re.getContext("2d");je&&je.putImageData(re,0,0),Ee(re.width,re.height),Me(!0)})(),()=>{L=!0}},[n,t,o,ne,_,h]);const N=a==="auto"?void 0:a,F=be?{filter:"invert(1)"}:{},ee=b&&(m!=null&&m.enabled)&&ye&&t&&((((H=b.boxes)==null?void 0:H.length)??0)>0||(((V=b.masks)==null?void 0:V.length)??0)>0)?i.jsx(Ot,{data:b,settings:m,naturalWidth:ye.w,naturalHeight:ye.h}):void 0,$=t?ne?i.jsxs(i.Fragment,{children:[!xe&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:W,className:"w-full h-full object-contain block",style:{display:xe?"block":"none",imageRendering:N,...F}})]}):me?i.jsxs(i.Fragment,{children:[!De&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:he,className:"w-full h-full object-contain block",style:{display:De?"block":"none",imageRendering:N,...F}})]}):i.jsx("img",{ref:ve,src:t,alt:p,className:"w-full h-full object-contain block",draggable:!1,style:{filter:fe,imageRendering:N},onLoad:L=>{const K=L.currentTarget;ge({w:K.naturalWidth,h:K.naturalHeight}),h==null||h(K.naturalWidth,K.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:M,paneRef:I,wrapperRef:G,zoom:d,pan:f,onViewportChange:v,naturalDims:ye,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${f.x}px, ${f.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:l&&ye?"16px 4px 4px 28px":"4px",header:i.jsx(An,{id:q,gamma:Y,offset:Z}),surface:$,showAxes:l,overlayNode:ee,overlay:{displayElRef:A,sample:Le,version:R,hasSource:!!t},notationSeed:w,exportCanvasRef:pe,leadingMenus:[zt(_,L=>S(L))],onReset:E.reset,extraModified:E.isModified,label:p,showLabelChip:!0,isDraggable:x,onDragStart:g})}function es(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:l="auto",zoom:u=1,pan:d={x:0,y:0},onViewportChange:f,pixelValueNotation:v="decimal",toolbar:h=!0}=e,p=c.useRef(null),x=c.useRef(null),g=c.useRef(null),[b,m]=c.useState(null),w=c.useRef(null),[M,_]=c.useState(0),[S,E]=c.useState(0),[P,k]=c.useState(0);c.useEffect(()=>{const A=p.current;if(!A)return;let T;try{T=jo(t,n,r+S,o,P)}catch(R){console.error("[cairn] HDR tone-map error:",R);return}(A.width!==T.width||A.height!==T.height)&&(A.width=T.width,A.height=T.height);const y=A.getContext("2d");y&&(y.putImageData(T,0,0),w.current=T,_(R=>R+1),m(R=>R&&R.w===T.width&&R.h===T.height?R:{w:T.width,h:T.height}))},[t,n,r,o,S,P]);const I=c.useCallback((A,T,y)=>{const R=b;if(!R||A<0||T<0||A>=R.w||T>=R.h)return null;const D=t.shape.length===2?1:t.shape[2]??1,O=(T*R.w+A)*D,pe=t.data,W=w.current;let he=.5;if(W&&W.width===R.w&&W.height===R.h){const xe=(T*R.w+A)*4;he=(.299*W.data[xe]+.587*W.data[xe+1]+.114*W.data[xe+2])/255}const ve=D===1?[pe[O]??0]:[pe[O]??0,pe[O+1]??0,pe[O+2]??0];return qe(ve,"unit",y,he)},[t,b]),G=l==="auto"?void 0:l;return i.jsx(ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:h,paneRef:x,wrapperRef:g,zoom:u,pan:d,onViewportChange:f,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:a&&b?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:p,className:"w-full h-full object-contain block",style:{imageRendering:G}}),showAxes:a,overlay:{displayElRef:p,sample:I,version:M,hasSource:!0},notationSeed:v,exportCanvasRef:p,displayAdjust:{exposureEV:S,offset:P,onExposureChange:E,onOffsetChange:k},label:s,showLabelChip:!!s})}function $t(e){return Un(e)?i.jsx(es,{...e}):i.jsx(Jo,{...e})}const ts="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function ns(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function rs(e,t){switch(ns(t.userAgent,t.isBrave)){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return e==="no-hdr"?"Chrome/Edge: requires an HDR display with OS HDR enabled.":"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function os(e){return e==="no-webgpu"?"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.":"true HDR output unsupported by this browser → HDR images tone-mapped to SDR."}function Gn(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Vn=new Set;function zn(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Vn.has(e)}function ss(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Vn.add(e)}const $n=new Set;let pt=null,et=null;function Xn(){et&&et.parentNode&&et.parentNode.removeChild(et),et=null,pt=null}function as(e){const t=Gn(e,window.location.pathname),n=rs(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=os(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=ts,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{ss(t),Xn()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),et=r,pt=e}function Wn(e){if(typeof document>"u"||typeof window>"u"||$n.has(e))return;$n.add(e);const t=Gn(e,window.location.pathname);if(zn(t))return;const n=()=>{if(!zn(t)){if(pt!==null)if(e==="no-webgpu"&&pt==="no-hdr")Xn();else return;as(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const is=["linear","srgb","reinhard","aces"];function cs(e){return e&&is.includes(e)?e:"srgb"}function ls(e){const{h:t,w:n,c:r}=Fn(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let u,d,f,v=1;r===1?u=d=f=Se(o[l]):r===3?(u=Se(o[l]),d=Se(o[l+1]),f=Se(o[l+2])):(u=Se(o[l]),d=Se(o[l+1]),f=Se(o[l+2]),v=Se(o[l+3]));const h=s*4;a[h]=u,a[h+1]=d,a[h+2]=f,a[h+3]=v}return{data:a,width:n,height:t,format:"rgba32float"}}function Yn(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,l=(t.width-a)/2,u=(t.height-s)/2,d=Math.max(e.zoom,1e-6),f=t.width/(d*a),v=t.height/(d*s),h=-l/a-e.pan.x/(d*a),p=-u/s-e.pan.y/(d*s);return{x:h,y:p,w:f,h:v}}function Hn(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function us(e){var Ee,Le;const t=Un(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(!1),[l,u]=c.useState(!1),[d,f]=c.useState(!1),[v,h]=c.useState(null),[p,x]=c.useState(0),[g,b]=c.useState(0),[m,w]=c.useState({x:0,y:0,w:1,h:1}),M=c.useRef(null),_=c.useRef(null),[S,E]=c.useState(0),P=e.zoom??1,k=e.pan??{x:0,y:0},I=e.onViewportChange,G=t?"none":e.colormap??"none",[A,T]=c.useState(G);c.useEffect(()=>{T(G)},[G]);const y=t?"none":A,R=c.useRef(G),D=c.useCallback(()=>{T(R.current)},[]),[O,pe]=c.useState(0),[W,he]=c.useState(0),ve=It();c.useEffect(()=>{const N=n.current;if(!N)return;let F=!1;return ot().then(ee=>{if(F)return;const $=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,H=ee.capabilities.hdr&&$&&t;s.current=H,t&&!H&&Wn("no-hdr"),Mo(N,{hdr:H}).then(V=>{if(F){Pn(V);return}a.current=V,f(!0)}).catch(V=>{F||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",V),u(!0))})}).catch(ee=>{F||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",ee),u(!0))}),()=>{F=!0,a.current&&(Pn(a.current),a.current=null)}},[]),c.useEffect(()=>{const N=r.current;if(!N)return;const F=new ResizeObserver(()=>b(ee=>ee+1));return F.observe(N),()=>F.disconnect()},[]),c.useEffect(()=>{const N=r.current;if(!N)return;const F=new IntersectionObserver(ee=>{const $=ee[0];if(!$)return;const H=a.current;H&&(H.setVisible($.isIntersecting),$.isIntersecting?H.isParked&&(H.restore(),b(V=>V+1)):H.park())},{threshold:0});return F.observe(N),()=>F.disconnect()},[]),c.useEffect(()=>{var ee;if(!t||!d)return;const N=e.hdr;M.current=N;const F=ls(N);(ee=a.current)==null||ee.setSource(F),h($=>$&&$.w===F.width&&$.h===F.height?$:{w:F.width,h:F.height}),E($=>$+1),x($=>$+1)},[t,d,t?e.hdr:null]),c.useEffect(()=>{if(t||!d)return;const N=e,F=N.imageUrl,ee=A;if(!F){_.current=null,h(null),E(H=>H+1);return}let $=!1;return He(F).then(H=>{var K,Q;if($||!H)return;let V=H;if(ee!=="none"){const j=`gpu::${F}::${ee}::ev${O}::off${W}`,X=Rt(j);if(X)V=X;else{const te=At(ee);V=Ct(H,ee,te,O,W),kt(j,V)}}_.current=H;const L={data:V.data,width:V.width,height:V.height,format:"rgba8unorm"};(K=a.current)==null||K.setSource(L),h(j=>j&&j.w===V.width&&j.h===V.height?j:{w:V.width,h:V.height}),(Q=N.onNaturalSize)==null||Q.call(N,V.width,V.height),E(j=>j+1),x(j=>j+1)}),()=>{$=!0}},[t,d,t?null:e.imageUrl,t?null:A,t?0:O,t?0:W]);const xe=t?e.exposure??0:0,Me=t?e.tonemap:void 0,De=t?e.gamma:void 0,de=c.useCallback(()=>{const N=a.current;if(!N||!d||!v)return;const F=r.current,ee=o.current,$=ee?ee.getBoundingClientRect():F?F.getBoundingClientRect():{width:v.w,height:v.h},H=Yn({zoom:P,pan:k},$,v.w,v.h);w(Q=>Q.x===H.x&&Q.y===H.y&&Q.w===H.w&&Q.h===H.h?Q:H),$.width>0&&$.height>0&&N.resize(Math.round($.width*ve),Math.round($.height*ve));const V=Hn(H,$,v.w,v.h)>=Bt?"nearest":"linear",L=H,K=t?{exposureEV:xe+O,offset:W,operator:s.current?"extended":cs(Me),gamma:De,isScalar:!1,hdrOut:s.current,uv:L,filter:V}:{exposureEV:y!=="none"?0:O,offset:y!=="none"?0:W,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:L,filter:V};try{N.render(K)||u(!0)}catch(Q){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",Q),u(!0)}},[d,v,P,k.x,k.y,xe,O,W,Me,De,t,y,ve]);c.useEffect(()=>{de()},[de,p,g]);const ye=c.useCallback((N,F,ee)=>{if(t){const X=M.current,te=v;if(!X||!te||N<0||F<0||N>=te.w||F>=te.h)return null;const Ae=X.shape.length===2?1:X.shape[2]??1,Te=(F*te.w+N)*Ae,ae=X.data,Pe=.5,re=Ae===1?[ae[Te]??0]:[ae[Te]??0,ae[Te+1]??0,ae[Te+2]??0];return qe(re,"unit",ee,Pe)}const $=_.current;if(!$||N<0||F<0||N>=$.width||F>=$.height)return null;const H=(F*$.width+N)*4,V=$.data[H],L=$.data[H+1],K=$.data[H+2],Q=(.299*V+.587*L+.114*K)/255;return qe(y!=="none"||V===L&&L===K?[V]:[V,L,K],"uint8",ee,Q)},[t,v,y]),ge=e.showAxes??!1,be=t?e.label??"":e.label,q=e.interpolation??"auto",fe=q==="auto"?void 0:q,Y=t?void 0:e.overlay,Z=t?void 0:e.overlaySettings,ne=t?!1:e.isDraggable??!1,we=t?void 0:e.onDragStart;if(l)return t?i.jsx($t,{...e}):i.jsx($t,{...e});const me=Y&&(Z!=null&&Z.enabled)&&v&&((((Ee=Y.boxes)==null?void 0:Ee.length)??0)>0||(((Le=Y.masks)==null?void 0:Le.length)??0)>0)?i.jsx(Ot,{data:Y,settings:Z,naturalWidth:v.w,naturalHeight:v.h}):void 0;return i.jsx(ft,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":d},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:P,pan:k,onViewportChange:I,naturalDims:v,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:ge&&v?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:fe},"data-gpu-image-canvas":!0}),showAxes:ge,overlayNode:me,overlay:{displayElRef:n,sample:ye,version:S,hasSource:!0,sourceWindow:m},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:de,leadingMenus:t?void 0:[zt(y,N=>T(N))],displayAdjust:{exposureEV:O,offset:W,onExposureChange:pe,onOffsetChange:he},onReset:D,extraModified:A!==R.current,label:be,showLabelChip:!!be,isDraggable:ne,onDragStart:we})}const ht=new Map;function Ge(e){if(ht.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);ht.set(e.id,e)}function Qe(e){return ht.get(e)}function ds(){return Array.from(ht.values())}function Kn(e,t){return{...e.params??{},...t??{}}}const fs={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ps={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},hs={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},gs={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},ms={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},xs={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},qn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];bs(qn);const Xt=[1.052156925,1,.91835767],vs=.7;function bs(e){const[t,n,r]=e[0],[o,a,s]=e[1],[l,u,d]=e[2],f=a*d-s*u,v=-(o*d-s*l),h=o*u-a*l,x=1/(t*f+n*v+r*h);return[[f*x,-(n*d-r*u)*x,(n*s-r*a)*x],[v*x,(t*d-r*l)*x,-(t*s-r*o)*x],[h*x,-(t*u-n*l)*x,(t*a-n*o)*x]]}function ws(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Wt=6/29;function Yt(e){return e>Wt**3?Math.cbrt(e):e/(3*Wt*Wt)+4/29}function Zn(e,t,n){const[r,o,a]=ws(qn,e,t,n),s=Yt(r*Xt[0]),l=Yt(o*Xt[1]),u=Yt(a*Xt[2]),d=116*l-16,f=500*(s-l),v=200*(l-u);return[d,.01*d*f,.01*d*v]}function ys(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Es(){const e=Zn(0,1,0),t=Zn(0,0,1);return Math.pow(ys(e,t),vs)}const Qn=Es(),_s=.082;function jn(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),l=1/e,u=Math.PI**2,d=[0,0,0];for(let f=-s;f<=s;f++)for(let v=-s;v<=s;v++){const h=(v*l)**2+(f*l)**2;for(let p=0;p<3;p++)d[p]+=t[p]*Math.sqrt(Math.PI/n[p])*Math.exp(-u*h/n[p])+r[p]*Math.sqrt(Math.PI/o[p])*Math.exp(-u*h/o[p])}return{r:s,deltaX:l,sums:d}}function Jn(e){const t=.5*_s*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const u=Math.exp(-(l*l+s*s)/(2*t*t)),d=-l*u,f=(l*l/(t*t)-1)*u;d>0&&(r+=d),f>0?o+=f:a-=f}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const Ms=`
${Ue}
${ut}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Ss=`
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
`,er=`
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
`;function Xe(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function mt(e){return[Xe(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Xe(2,[e.sums[2],0,0,0])]}function tr(e){return[Xe(4,[Qn,e.sd,e.r,e.edgeNorm]),Xe(5,[e.pointPos,e.pointNeg,0,0])]}function nr(e,t,n,r,o=""){const a=jn(e),s=Jn(e),l=`ycxczA${o}`,u=`ycxczB${o}`,d=`labA${o}`,f=`labB${o}`,v=`flip${o}`;return{passes:[{name:l,shader:t,inputs:[n],output:l},{name:u,shader:t,inputs:[r],output:u},{name:d,shader:gt,inputs:[l],output:d,uniforms:()=>mt(a)},{name:f,shader:gt,inputs:[u],output:f,uniforms:()=>mt(a)},{name:v,shader:er,inputs:[d,f,l,u],output:v,uniforms:()=>tr(s)}],flipRef:v}}const Ts={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=nr(t,Ms,"srcA","srcB");return{passes:n,final:r}}},Ps={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=nr(t,Ss,"srcA","srcB");return{passes:n,final:r}}},rr=`
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
`,Cs=`
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
`,As={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=jn(t),l=Jn(t),u=[];let d=null;for(let f=0;f<o;f++){const v=n+f*a,h=`_e${f}`,p=`ycxczA${h}`,x=`ycxczB${h}`,g=`labA${h}`,b=`labB${h}`,m=`acc${h}`;u.push({name:p,shader:rr,inputs:["srcA"],output:p,uniforms:()=>[Xe(1,[v,0,0,0])]},{name:x,shader:rr,inputs:["srcB"],output:x,uniforms:()=>[Xe(1,[v,0,0,0])]},{name:g,shader:gt,inputs:[p],output:g,uniforms:()=>mt(s)},{name:b,shader:gt,inputs:[x],output:b,uniforms:()=>mt(s)}),d===null?u.push({name:m,shader:er,inputs:[g,b,p,x],output:m,uniforms:()=>tr(l)}):u.push({name:m,shader:Cs,inputs:[g,b,p,x,d],output:m,uniforms:()=>[Xe(5,[Qn,l.sd,l.r,l.edgeNorm]),Xe(6,[l.pointPos,l.pointNeg,0,0])]}),d=m}return{passes:u,final:d}}};let or=!1;function Rs(){or||(or=!0,Ge(ps),Ge(fs),Ge(hs),Ge(ms),Ge(gs),Ge(xs),Ge(Ts),Ge(As),Ge(Ps))}Rs();function sr(){const e=[];for(const t of ds())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function ks(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const ar=new WeakMap;function Ht(e,t,n,r){let o=ar.get(e);o||(o=new Map,ar.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Ls(e){return`
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
`}const xt="rgba16float";function Ds(e,t,n,r,o){var p,x;const a=Qe(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),l=Math.min(t.height,n.height),u=Kn(a,o);if(a.kind==="pointwise"){const g=e.createTexture(s,l,xt),b=Ht(e,`pw:${a.id}`,Ls(a.source),xt);let m;try{m=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(g,b,m)}finally{(p=m==null?void 0:m.destroy)==null||p.call(m)}return g}const d={width:s,height:l,params:u},f=a.buildPasses(d),v=new Map([["srcA",t],["srcB",n]]),h=[];try{for(const b of f.passes){const m=e.createTexture(s,l,xt);h.push(m),v.set(b.output,m);const w=Ht(e,`mp:${a.id}:${b.name}`,b.shader,xt),M=b.inputs.map((S,E)=>{const P=v.get(S);if(!P)throw new Error(`computeDiff: pass "${b.name}" input "${S}" not produced yet`);return{binding:E,resource:P}});b.uniforms&&M.push(...b.uniforms(d));let _;try{_=e.createBindGroup(w,M),e.renderFullscreen(m,w,_)}finally{(x=_==null?void 0:_.destroy)==null||x.call(_)}}const g=v.get(f.final);if(!g)throw new Error(`computeDiff: final ref "${f.final}" not produced`);for(const b of h)b!==g&&b.destroy();return g}catch(g){for(const b of h)b.destroy();throw g}}const Is=8,Os=256*1024*1024;class Bs{constructor(t=Is,n=Os){ie(this,"map",new Map);ie(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const ir=new WeakMap;function cr(e){let t=ir.get(e);return t||(t=new Bs,ir.set(e,t)),t}function Ns(e,t){const n=Kn(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Us(e,t,n,r){const o=Qe(n),a=o?Ns(o,r):"";return`${e}|${t}|${n}|${a}`}function Fs(e,t,n,r,o,a,s){const l=Qe(r);if(!l)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=cr(e),d=Us(a,s,r,o),f=u.get(d);if(f)return f;const v=Ds(e,t,n,r,o),h=Math.min(t.width,n.width),p=Math.min(t.height,n.height),x={texture:v,width:h,height:p,displayRange:l.displayRange,bytes:h*p*8};return u.set(d,x),x}async function Gs(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=En(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function Vs(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,cr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const zs=`
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
`,$s={unit:0,signed:1,relative:2},Xs={linear:0,signed:1,positive:2};function Ws(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ys(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Hs(e,t,n,r,o){var h;const a=Ys(t),s=Ht(e,"diff-display",zs,a),l=Ws(e,o.colormap),u=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([$s[r],Xs[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),f=new Float32Array([o.exposureEV??0,o.offset??0,0,0]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:f}}]),e.renderFullscreen(t,s,v)}finally{(h=v==null?void 0:v.destroy)==null||h.call(v),l.destroy()}}const lr=.6*.6*2.51,Ks=.6*.03,qs=0,ur=.6*.6*2.43,Zs=.6*.59,Qs=.14;function dr(e){const t=(Ks-Zs*e)/(lr-ur*e),n=(qs-Qs*e)/(lr-ur*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const js=.85,Js=.85,fr=11920928955078125e-23,Kt=[.2126,.7152,.0722];function ea(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function ta(e,t,n,r=3,o={}){const a=t*n,s=dr(js),l=dr(Js),u=new Float64Array(a);let d=0;for(let w=0;w<a;w++){const[M,_,S]=ea(e,w,r),E=M*Kt[0]+_*Kt[1]+S*Kt[2];u[w]=E,E>d&&(d=E)}const f=Float64Array.from(u).sort(),v=a>>1,h=a%2===1?f[v]:f[v-1],p=Math.max(h,fr),x=Math.max(d,fr),g=o.startExposure??Math.log2(s/x),b=o.stopExposure??Math.log2(l/p),m=Math.max(2,Math.ceil(b-g));return{startExposure:g,stopExposure:b,numExposures:m}}const na={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ra({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:l,onViewportChange:u,processing:d=na,interpolation:f="auto",label:v="",isDraggable:h=!1,onDragStart:p,overlay:x,overlaySettings:g,pixelValueNotation:b="decimal"}){var q,fe;const m=c.useRef(null),[w,M]=c.useState(null),[_,S]=c.useState(null),[E,P]=c.useState(b),[k,I]=c.useState(!1),G=c.useRef(null),A=c.useRef(null),T=c.useRef(null),y=c.useRef(null),[R,D]=c.useState(0);c.useEffect(()=>{if(!e){T.current=null,D(Z=>Z+1);return}let Y=!1;return He(e).then(Z=>{Y||(T.current=Z,D(ne=>ne+1))}),()=>{Y=!0}},[e]),c.useEffect(()=>{if(!t){y.current=null,D(Z=>Z+1);return}let Y=!1;return He(t).then(Z=>{Y||(y.current=Z,D(ne=>ne+1))}),()=>{Y=!0}},[t]);const O=Y=>(Z,ne,we)=>{const me=Y.current;if(!me||Z<0||ne<0||Z>=me.width||ne>=me.height)return null;const Ee=(ne*me.width+Z)*4,Le=me.data[Ee],N=me.data[Ee+1],F=me.data[Ee+2],ee=(.299*Le+.587*N+.114*F)/255;return Le===N&&N===F?{lines:[Je(Le,"uint8",we)],luminance:ee}:{lines:[Je(Le,"uint8",we),Je(N,"uint8",we),Je(F,"uint8",we)],luminance:ee,colors:[lt[0],lt[1],lt[2]]}},pe=c.useMemo(()=>O(T),[]),W=c.useMemo(()=>O(y),[]),he=!!x&&!!(g!=null&&g.enabled)&&!!w&&!!e&&((((q=x.boxes)==null?void 0:q.length)??0)>0||(((fe=x.masks)==null?void 0:fe.length)??0)>0),{gammaFilterId:ve,filterStr:xe,gamma:Me,offset:De}=Cn(d),de=`translate(${l.x}px, ${l.y}px) scale(${s})`,ye=f==="auto"?void 0:f,{containerProps:ge,modifierActive:be}=fn({containerRef:m,zoom:s,pan:l,onViewportChange:u});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(An,{id:ve,gamma:Me,offset:De}),i.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...ge.style},onPointerDown:ge.onPointerDown,onPointerMove:ge.onPointerMove,onPointerUp:ge.onPointerUp,onPointerCancel:ge.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:de,transformOrigin:"0 0"},children:[i.jsx("img",{ref:G,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:xe,imageRendering:ye,...n==="blend"?{opacity:o}:{}},onLoad:Y=>{const Z=Y.currentTarget;M({w:Z.naturalWidth,h:Z.naturalHeight})}}),he&&i.jsx(Ot,{data:x,settings:g,naturalWidth:w.w,naturalHeight:w.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:de,transformOrigin:"0 0"},children:i.jsx("img",{ref:A,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:xe,imageRendering:ye,...n==="blend"?{opacity:1-o}:{}},onLoad:Y=>{const Z=Y.currentTarget;S({w:Z.naturalWidth,h:Z.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:Y=>{Y.stopPropagation(),Y.preventDefault();const ne=Y.currentTarget.parentElement.getBoundingClientRect(),we=Ee=>{a==null||a(Math.max(0,Math.min(1,(Ee.clientX-ne.left)/ne.width)))},me=()=>{window.removeEventListener("pointermove",we),window.removeEventListener("pointerup",me)};window.addEventListener("pointermove",we),window.addEventListener("pointerup",me)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&_&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:A,naturalWidth:_.w,naturalHeight:_.h,zoom:s,pan:l,sample:W,notation:E,version:R})}),e&&w&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Ze,{imageElRef:G,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:l,sample:pe,notation:E,version:R,onActiveChange:I})})]}):e&&w&&i.jsx(Ze,{imageElRef:G,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:l,sample:pe,notation:E,version:R,onActiveChange:I}),k&&i.jsx(hn,{notation:E,onChange:P})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!be?" cairn-drag-grip":""}`,draggable:h&&!be,onDragStart:p,style:{cursor:h&&!be?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),v]})]})}function oa(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function sa({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:d=>{d==="side"?s==null||s():d==="slide"?r():d==="blend"?o():a(d)}}}}function aa(e){const t=Mt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function ia(e){const{data:t,width:n,height:r,channels:o}=e,a=n*r,s=new Float32Array(a*4),l=u=>Number.isFinite(u)?u:0;for(let u=0;u<a;u++){const d=u*o;let f,v,h,p=1;o===1?f=v=h=l(t[d]):o===3?(f=l(t[d]),v=l(t[d+1]),h=l(t[d+2])):(f=l(t[d]),v=l(t[d+1]),h=l(t[d+2]),p=l(t[d+3]));const x=u*4;s[x]=f,s[x+1]=v,s[x+2]=h,s[x+3]=p}return s}function ca({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,diffSubmode:u,colormap:d="none",diffKernel:f,onDiffKernelChange:v,onCompareModeChange:h,onRequestSide:p,zoom:x,pan:g,onViewportChange:b,interpolation:m="auto",label:w="",pixelValueNotation:M="decimal"}){var gr;const _=c.useRef(null),S=c.useRef(null),E=c.useRef(null),P=c.useRef(null),k=c.useRef(null),[I,G]=c.useState(!1),[A,T]=c.useState(!1),[y,R]=c.useState(null),[D,O]=c.useState(0),[pe,W]=c.useState(0),[he,ve]=c.useState(null),[xe,Me]=c.useState({x:0,y:0,w:1,h:1}),De=f??u??"absolute",[de,ye,ge]=ct(De);c.useEffect(()=>{ye(f??u??"absolute")},[f,u,ye]);const be=c.useCallback(C=>{ye(C),v==null||v(C)},[v,ye]);c.useEffect(()=>{const C=_.current;if(C)return C.__cairnDiffKernel={current:de,set:be},()=>{C&&delete C.__cairnDiffKernel}},[de,be]);const[q,fe,Y]=ct(o);c.useEffect(()=>{fe(o)},[o,fe]);const Z=c.useCallback(C=>{fe(C),h==null||h(C)},[h,fe]),[ne,we,me]=ct(d);c.useEffect(()=>{we(d)},[d,we]);const Ee=c.useCallback(()=>{Z(Y.default),we(me.default),be(ge.default)},[Z,we,be,Y.default,me.default,ge.default]),Le=Y.isModified||me.isModified||ge.isModified,[N,F]=c.useState(0),[ee,$]=c.useState(0),H=c.useMemo(()=>{const oe=[sa({mode:q,kernel:de,kernelOptions:sr().map(U=>({id:U.id,label:U.label})),onSide:p,onSlide:()=>Z("split"),onBlend:()=>Z("blend"),onKernel:U=>{Z("diff"),be(U)}})];return q==="diff"&&oe.push(zt(ne,U=>we(U))),oe},[q,de,ne,be,Z,p]),V=c.useRef(null),L=c.useRef(null),K=c.useRef(null),Q=c.useRef(null),[j,X]=c.useState(0),te=c.useRef(null),[Ae,Te]=c.useState(0),ae=It();c.useEffect(()=>{const C=E.current;if(!C)return;let oe=!1;return ot().then(U=>{if(!oe)try{if(_n())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const B=U.createSurface(C,{hdr:!1});P.current={device:U,surface:B,texA:null,texB:null},T(!0)}catch(B){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",B),G(!0)}}).catch(U=>{oe||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",U),G(!0))}),()=>{var B,J;oe=!0;const U=P.current;U&&((B=U.texA)==null||B.destroy(),(J=U.texB)==null||J.destroy(),P.current=null)}},[]),c.useEffect(()=>{const C=_.current;if(!C)return;const oe=new ResizeObserver(()=>W(U=>U+1));return oe.observe(C),()=>oe.disconnect()},[]),c.useEffect(()=>{if(!A)return;let C=!1;if(!P.current)return;async function U(B,J){if(J){const le=ia(J);return{width:J.width,height:J.height,imageData:null,make:se=>{const _e=se.createTexture(J.width,J.height,"rgba32float");return _e.write(le),_e}}}if(!B)return null;const ce=await He(B);return ce?{width:ce.width,height:ce.height,imageData:ce,make:le=>{const se=le.createTexture(ce.width,ce.height,"rgba8unorm");return se.write(ce.data),se}}:null}return Promise.all([U(e,n),U(t,r)]).then(([B,J])=>{var se,_e;if(C||!P.current)return;const ce=P.current;V.current=(B==null?void 0:B.imageData)??null,L.current=(J==null?void 0:J.imageData)??null,K.current=n??null,Q.current=r??null,(se=ce.texA)==null||se.destroy(),(_e=ce.texB)==null||_e.destroy(),ce.texA=null,ce.texB=null;const le=B??J;if(!le){R(null),X(ke=>ke+1);return}ce.texA=(J??le).make(ce.device),ce.texB=(B??le).make(ce.device),R({w:le.width,h:le.height}),X(ke=>ke+1),O(ke=>ke+1)}),()=>{C=!0}},[A,e,t,n,r]);const Pe=n!=null||r!=null,re=c.useMemo(()=>ks(de,Pe),[de,Pe]),Re=c.useMemo(()=>{if(!Pe)return null;const C=r??n;return C?ta(C.data,C.width,C.height,C.channels):null},[Pe,r,n]),je=c.useMemo(()=>{var C;return Nr(((C=Qe(re))==null?void 0:C.displayRange)??"unit",ne==="none"?null:ne)},[re,ne]),We=c.useMemo(()=>ne!=="none"?aa(ne):void 0,[ne]),Ie=c.useCallback(()=>{const C=P.current;if(!A||!C||!C.surface||!C.texA||!C.texB||!y)return;const oe=_.current,U=oe?oe.getBoundingClientRect():{width:y.w,height:y.h},B=Yn({zoom:x,pan:g},U,y.w,y.h);Me(se=>se.x===B.x&&se.y===B.y&&se.w===B.w&&se.h===B.h?se:B);const J=E.current;if(U.width>0&&U.height>0&&J&&C.surface){const se=Math.max(1,Math.round(U.width*ae)),_e=Math.max(1,Math.round(U.height*ae));(J.width!==se||J.height!==_e)&&(J.width=se,J.height=_e,C.surface.configure(se,_e))}const ce=Hn(B,U,y.w,y.h)>=Bt?"nearest":"linear",le=B;try{if(q==="diff"){const se=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",_e=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ke=Qe(re)?re:"absolute",Ye=ke==="hdr-flip"&&Re?{ppd:67,startExposure:Re.startExposure,stopExposure:Re.stopExposure,numExposures:Re.numExposures}:void 0,nt=Fs(C.device,C.texA,C.texB,ke,Ye,se,_e);k.current=nt,Hs(C.device,C.surface,nt.texture,nt.displayRange,{uv:le,cmapMode:je,colormap:We,filter:ce,exposureEV:N,offset:ee})}else{const se={exposureEV:N,offset:ee,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:le,filter:ce,mode:q,split:a,alpha:s};bo(C.device,C.surface,C.texA,C.texB,se)}}catch(se){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",se),G(!0)}},[A,y,x,g.x,g.y,q,a,s,N,ee,de,re,Re,je,We,e,t,n,r,ae]);c.useEffect(()=>{Ie()},[Ie,D,pe]);const vt=t!=null||r!=null;c.useEffect(()=>{const C=P.current;if(!A||!C||!C.texA||!C.texB||!vt){ve(null);return}let oe=!1;const U=C.texA,B=C.texB,J=k.current;return(q==="diff"&&J?Gs(C.device,J,U,B):En(C.device,U,B)).then(le=>{oe||ve(le)}),()=>{oe=!0}},[A,D,vt,q,de]),c.useEffect(()=>{if(q!=="diff"){te.current=null;return}const C=P.current,oe=k.current;if(!A||!C||!oe)return;let U=!1;return te.current=null,Te(B=>B+1),Vs(C.device,oe).then(B=>{U||(te.current=B,Te(J=>J+1))}).catch(()=>{}),()=>{U=!0}},[A,q,re,D]);const pr=(C,oe)=>(U,B,J)=>{const ce=oe.current;if(ce){const{data:bt,width:mr,height:ga,channels:xr}=ce;if(U<0||B<0||U>=mr||B>=ga)return null;const wt=(B*mr+U)*xr,ma=.5,xa=xr===1?[bt[wt]??0]:[bt[wt]??0,bt[wt+1]??0,bt[wt+2]??0];return qe(xa,"unit",J,ma)}const le=C.current;if(!le||U<0||B<0||U>=le.width||B>=le.height)return null;const se=(B*le.width+U)*4,_e=le.data[se],ke=le.data[se+1],Ye=le.data[se+2],nt=(.299*_e+.587*ke+.114*Ye)/255;return qe(_e===ke&&ke===Ye?[_e]:[_e,ke,Ye],"uint8",J,nt)},hr=c.useMemo(()=>pr(V,K),[]),da=c.useMemo(()=>pr(L,Q),[]),fa=c.useMemo(()=>(C,oe,U)=>{var Ye;const B=te.current;if(!B||!y)return null;const{w:J,h:ce}=y;if(C<0||oe<0||C>=J||oe>=ce)return null;const le=(oe*J+C)*4,se=((Ye=Qe(re))==null?void 0:Ye.output)??"per-channel",_e=.5,ke=se==="scalar"?[B[le]??0]:[B[le]??0,B[le+1]??0,B[le+2]??0];return qe(ke,"unit",U,_e)},[y,re]),pa=m==="auto"?void 0:m;if(I)return n!=null||r!=null?i.jsx(oa,{}):q==="diff"?i.jsx($t,{imageUrl:e,baselineUrl:t,diffMode:((gr=Qe(re))==null?void 0:gr.kind)==="pointwise"?re:"absolute",interpolation:m,colormap:ne,showAxes:!1,zoom:x,pan:g,onViewportChange:b,label:w,pixelValueNotation:M}):i.jsx(ra,{imageUrl:e,baselineUrl:t,mode:q,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,zoom:x,pan:g,onViewportChange:b,interpolation:m,label:w,pixelValueNotation:M});const ha=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:E,className:"w-full h-full block",style:{imageRendering:pa},"data-gpu-compare-canvas":!0}),q==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:C=>{C.stopPropagation(),l==null||l(.5)},onPointerDown:C=>{C.stopPropagation(),C.preventDefault();const U=C.currentTarget.parentElement.getBoundingClientRect(),B=ce=>{l==null||l(Math.max(0,Math.min(1,(ce.clientX-U.left)/U.width)))},J=()=>{window.removeEventListener("pointermove",B),window.removeEventListener("pointerup",J)};window.addEventListener("pointermove",B),window.addEventListener("pointerup",J)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(ft,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":A},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:_,wrapperRef:S,zoom:x,pan:g,onViewportChange:b,naturalDims:y,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:ha,showAxes:!1,notationSeed:M,onReset:Ee,extraModified:Le,exportCanvasRef:E,requestRender:Ie,leadingMenus:H,displayAdjust:{exposureEV:N,offset:ee,onExposureChange:F,onOffsetChange:$},label:"",showLabelChip:!1,overlay:{render:({notation:C,setOverlayActive:oe})=>q==="split"?i.jsxs(i.Fragment,{children:[vt&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:E,naturalWidth:y.w,naturalHeight:y.h,zoom:x,pan:g,sourceWindow:xe,sample:da,notation:C,version:j})}),vt&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(Ze,{imageElRef:E,naturalWidth:y.w,naturalHeight:y.h,zoom:x,pan:g,sourceWindow:xe,sample:hr,notation:C,version:j,onActiveChange:oe})})]}):y&&i.jsx(Ze,{imageElRef:E,naturalWidth:y.w,naturalHeight:y.h,zoom:x,pan:g,sourceWindow:xe,sample:q==="diff"?fa:hr,notation:C,version:q==="diff"?Ae:j,onActiveChange:oe})},extraChips:i.jsxs(i.Fragment,{children:[q==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),w?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:w}):null,he&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${w?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",he.mse.toExponential(2)," · PSNR ",Number.isFinite(he.psnr)?he.psnr.toFixed(1):"∞"," dB · MAE"," ",he.mae.toExponential(2)]})]})})}const la="cairn-plot:gpu-image-ready";async function ua(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await ot(),window.__cairnPlotGpuImagePane=us,window.__cairnPlotGpuComparePane=ca,window.__cairnPlotDiffMenuModes=sr(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(la))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Wn("no-webgpu")}}}ua()})(__cairnPlotJsxRuntime,__cairnPlotReact);
