var da=Object.defineProperty;var fa=(i,c,We)=>c in i?da(i,c,{enumerable:!0,configurable:!0,writable:!0,value:We}):i[c]=We;var ae=(i,c,We)=>fa(i,typeof c!="symbol"?c+"":c,We);(function(i,c){"use strict";const We=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Ht(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:We}),{hdr:!1,format:n}}function hr(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:We}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:We}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Ht(e,t)}}}const gr=`
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
`;function vt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Kt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function mr(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const xr={texture:0,sampler:1,uniform:2};function bt(e,t){return e*3+xr[t]}const vr={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function br(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const l=vr[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class qt{constructor(t,n,r,o){ae(this,"width");ae(this,"height");ae(this,"format");ae(this,"gpuTexture");ae(this,"device");ae(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:vt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Kt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Zt{constructor(t){ae(this,"_s");ae(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class wr{constructor(t,n,r,o,a){ae(this,"_p");ae(this,"gpuPipeline");ae(this,"bindings");ae(this,"bindGroupLayout");ae(this,"variants");ae(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function yr(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Er{constructor(t){ae(this,"_c");ae(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class _r{constructor(t,n){ae(this,"_b");ae(this,"gpuBindGroup");ae(this,"ownedBuffers");ae(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Mr{constructor(t,n,r,o){ae(this,"canvas");ae(this,"hdr");ae(this,"format");ae(this,"context");ae(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function ot(e){return"canvas"in e}async function Tr(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(f){return ot(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function s(f){if(ot(f))return{width:f.canvas.width,height:f.canvas.height};const v=f;return{width:v.width,height:v.height}}let l=!1;const u=256;let d=null,p=null;function g(){if(!d||!p){const f=t.createShaderModule({code:gr});p=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const v=t.createPipelineLayout({bindGroupLayouts:[p]});d=t.createComputePipeline({layout:v,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:d,layout:p}}return{backend:"webgpu",capabilities:n,createTexture(f,v,h){return new qt(t,f,v,h)},createSampler(f){const v=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",h=t.createSampler({magFilter:v,minFilter:v,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Zt(h)},createRenderPipeline(f){const v=t.createShaderModule({code:f.shaderWGSL}),h=br(f.shaderWGSL),b=vt(f.targetFormat),m=yr(t,h),w=t.createPipelineLayout({bindGroupLayouts:[m]}),M=T=>t.createRenderPipeline({layout:w,vertex:{module:v,entryPoint:"vs_main"},fragment:{module:v,entryPoint:"fs_main",targets:[{format:T}]},primitive:{topology:"triangle-list"}}),E=M(b);return new wr(E,h,m,b,M)},createComputePipeline(f){const v=t.createShaderModule({code:f.shaderWGSL}),h=t.createComputePipeline({layout:"auto",compute:{module:v,entryPoint:"cs_main"}});return new Er(h)},createBindGroup(f,v){const h=f,b=new Map,m=[];for(const[M,E]of h.bindings)if(E.kind==="uniform"){const T=t.createBuffer({size:E.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});m.push(T),b.set(M,{binding:M,resource:{buffer:T}})}else E.kind==="sampler"&&b.set(M,{binding:M,resource:o()});for(const M of v){const E=M.resource;if(E instanceof qt){const T=bt(M.binding,"texture");h.bindings.has(T)&&b.set(T,{binding:T,resource:E.gpuTexture.createView()})}else if(E instanceof Zt){const T=bt(M.binding,"sampler");h.bindings.has(T)&&b.set(T,{binding:T,resource:E.gpuSampler})}else{const T=bt(M.binding,"uniform"),_=h.bindings.get(T);if(_&&_.kind==="uniform"){const C=E.uniform,k=t.createBuffer({size:Math.max(_.sizeBytes,C.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(k,0,C.buffer,C.byteOffset,C.byteLength),m.push(k),b.set(T,{binding:T,resource:{buffer:k}})}}}const w=t.createBindGroup({layout:h.bindGroupLayout,entries:Array.from(b.values())});return new _r(w,m)},createSurface(f,v){const h=f.getContext("webgpu");if(!h)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const b=v.hdr&&n.hdr,m=()=>b?hr(h,t):Ht(h,t),w=m();return new Mr(f,h,w,m)},renderFullscreen(f,v,h){const b=v,m=h,w=a(f),{width:M,height:E}=s(f),T=ot(f)?f.format:vt(f.format),_=b.pipelineFor(T),C=t.createCommandEncoder(),k=C.beginRenderPass({colorAttachments:[{view:w,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});k.setPipeline(_),k.setBindGroup(0,m.gpuBindGroup),k.setViewport(0,0,M,E,0,1),k.draw(3),k.end(),t.queue.submit([C.finish()])},async readback(f){const v=ot(f),{width:h,height:b}=s(f),m=v?f.hdr?"rgba16float":"rgba8unorm":f.format,w=v&&f.format==="bgra8unorm",M=v?f.getCurrentGPUTexture():f.gpuTexture,E=Kt(m),T=h*E,_=256,C=Math.ceil(T/_)*_,k=C*b,O=t.createBuffer({size:k,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),z=t.createCommandEncoder();z.copyTextureToBuffer({texture:M},{buffer:O,bytesPerRow:C,rowsPerImage:b},{width:h,height:b,depthOrArrayLayers:1}),t.queue.submit([z.finish()]),await O.mapAsync(GPUMapMode.READ);const R=new Uint8Array(O.getMappedRange()),S=new Uint8Array(T*b);for(let y=0;y<b;y++){const A=y*C,I=y*T;S.set(R.subarray(A,A+T),I)}if(O.unmap(),O.destroy(),m==="rgba8unorm"){if(w)for(let y=0;y<S.length;y+=4){const A=S[y],I=S[y+2];S[y]=I,S[y+2]=A}return S}if(m==="rgba16float"){const y=new Uint16Array(S.buffer,S.byteOffset,S.byteLength/2),A=new Float32Array(y.length);for(let I=0;I<y.length;I++)A[I]=mr(y[I]);return A}return new Float32Array(S.buffer,S.byteOffset,S.byteLength/4)},async reduceDiffSumSquaredAbs(f,v,h,b){const m=f,w=v,M=Math.max(0,h*b),E=Math.max(1,Math.ceil(M/u)),{pipeline:T,layout:_}=g(),C=E*2*4,k=t.createBuffer({size:C,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),O=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(O,0,new Uint32Array([Math.max(1,h),Math.max(1,b),M,0]));const z=t.createBindGroup({layout:_,entries:[{binding:0,resource:m.gpuTexture.createView()},{binding:1,resource:w.gpuTexture.createView()},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:O}}]}),R=t.createBuffer({size:C,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),S=t.createCommandEncoder(),y=S.beginComputePass();y.setPipeline(T),y.setBindGroup(0,z),y.dispatchWorkgroups(E),y.end(),S.copyBufferToBuffer(k,0,R,0,C),t.queue.submit([S.finish()]),await R.mapAsync(GPUMapMode.READ);const I=new Float32Array(R.getMappedRange()).slice();R.unmap(),R.destroy(),k.destroy(),O.destroy();let X=0,re=0;for(let q=0;q<E;q++)X+=I[q*2],re+=I[q*2+1];return{sumSq:X,sumAbs:re}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let wt=null;async function Sr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Tr()}function st(){return wt||(wt=Sr()),wt}function Pr(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Cr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),l=o-a,[u,d,p]=Pr(e[a],e[s],l);t[n*3]=Math.round(u),t[n*3+1]=Math.round(d),t[n*3+2]=Math.round(p)}return t}const Qt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},yt=new Set(["red-green","red-blue"]),jt=new Map;function Et(e){let t=jt.get(e);if(!t){const n=Qt[e]??Qt.viridis;t=Cr(n),jt.set(e,t)}return t}function _t(e,t,n="linear",r=0,o=0){const a=Et(t),s=new ImageData(e.width,e.height),l=e.data,u=s.data,d=Math.pow(2,r),p=r!==0||o!==0;for(let g=0;g<l.length;g+=4){let x=(l[g]+l[g+1]+l[g+2])/3;p&&(x=Math.max(0,Math.min(255,(x/255*d+o)*255)));let f;n==="positive"?f=Math.round(128+x/255*127):f=Math.round(x),f=Math.max(0,Math.min(255,f)),u[g]=a[f*3],u[g+1]=a[f*3+1],u[g+2]=a[f*3+2],u[g+3]=l[g+3]}return s}function Jt(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const en=Jt(50);function Mt(e){return en.get(e)}function Tt(e,t){en.set(e,t)}const tn=Jt(100);function Ar(e){return tn.get(e)}function Rr(e,t){tn.set(e,t)}function kr(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const u=(s*e.width+l)*4,d=(s*t.width+l)*4,p=(s*r+l)*4;for(let g=0;g<3;g++){const x=e.data[u+g],f=t.data[d+g],v=x-f,h=Math.abs(v),b=Math.max(x,1);let m;switch(n){case"signed":m=(v+255)/2;break;case"absolute":m=h;break;case"squared":m=v*v/255;break;case"relative_signed":m=(v/b+1)*127.5;break;case"relative_absolute":m=h/b*255;break;case"relative_squared":m=v*v/(b*b)*255;break}a.data[p+g]=Math.min(255,Math.max(0,Math.round(m)))}a.data[p+3]=255}return a}async function Ze(e){const t=Ar(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Rr(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Dr={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Lr={linear:0,signed:1,positive:2},Ir=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Or=`#version 300 es
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
}`;let Qe=null,W=null,De=null,at=null;function Br(){if(W)return W;try{if(typeof OffscreenCanvas<"u"?Qe=new OffscreenCanvas(1,1):Qe=document.createElement("canvas"),W=Qe.getContext("webgl2",{preserveDrawingBuffer:!0}),!W)return console.warn("[cairn] WebGL 2 not available"),null;const e=W.createShader(W.VERTEX_SHADER);if(W.shaderSource(e,Ir),W.compileShader(e),!W.getShaderParameter(e,W.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",W.getShaderInfoLog(e)),null;const t=W.createShader(W.FRAGMENT_SHADER);if(W.shaderSource(t,Or),W.compileShader(t),!W.getShaderParameter(t,W.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",W.getShaderInfoLog(t)),null;if(De=W.createProgram(),W.attachShader(De,e),W.attachShader(De,t),W.linkProgram(De),!W.getProgramParameter(De,W.LINK_STATUS))return console.error("[cairn] WebGL program link:",W.getProgramInfoLog(De)),null;at=W.createVertexArray(),W.bindVertexArray(at);const n=W.createBuffer();W.bindBuffer(W.ARRAY_BUFFER,n),W.bufferData(W.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),W.STATIC_DRAW);const r=W.getAttribLocation(De,"a_pos");return W.enableVertexAttribArray(r),W.vertexAttribPointer(r,2,W.FLOAT,!1,0,0),W.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),W}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function nn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Nr(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Ur(e,t,n,r){const o=Br();if(!o||!De||!at||!Qe)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);Qe.width=a,Qe.height=s,o.viewport(0,0,a,s);const l=nn(o,e,0),u=nn(o,t,1);let d=null;n.colormap?d=Nr(o,n.colormap,2):(d=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,d),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(De),o.uniform1i(o.getUniformLocation(De,"u_baseline"),0),o.uniform1i(o.getUniformLocation(De,"u_other"),1),o.uniform1i(o.getUniformLocation(De,"u_lut"),2),o.uniform1i(o.getUniformLocation(De,"u_diff_mode"),Dr[n.diffMode]),o.uniform1i(o.getUniformLocation(De,"u_cmap_mode"),Lr[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(De,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(at),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(Qe,0,0,a,s,0,-s,a,s),p.restore()),o.deleteTexture(l),o.deleteTexture(u),o.deleteTexture(d),{width:a,height:s}}const Fr="cairn:render-mode";function Gr(){try{const e=localStorage.getItem(Fr);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Ne=e=>e<0?0:e>1?1:e,St=e=>{const t=e<0?0:e;return t/(1+t)},Pt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Ne(n/r)},rn={linear:([e,t,n])=>[Ne(e),Ne(t),Ne(n)],srgb:([e,t,n])=>[Ne(e),Ne(t),Ne(n)],reinhard:([e,t,n])=>[St(e),St(t),St(n)],aces:([e,t,n])=>[Pt(e),Pt(t),Pt(n)],extended:([e,t,n])=>[e,t,n]},Vr="srgb";function zr(e){return e&&rn[e]||rn[Vr]}function Ct(e,t,n){return e*2**t+n}function $r(e){const t=Ne(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function At(e,t){return typeof t=="number"&&t>0?Ne(Math.pow(Ne(e),1/t)):$r(e)}const Ue=new Uint32Array(512),Fe=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ue[e]=0,Ue[e|256]=32768,Fe[e]=24,Fe[e|256]=24):t<-14?(Ue[e]=1024>>-t-14,Ue[e|256]=1024>>-t-14|32768,Fe[e]=-t-1,Fe[e|256]=-t-1):t<=15?(Ue[e]=t+15<<10,Ue[e|256]=t+15<<10|32768,Fe[e]=13,Fe[e|256]=13):t<128?(Ue[e]=31744,Ue[e|256]=64512,Fe[e]=24,Fe[e|256]=24):(Ue[e]=31744,Ue[e|256]=64512,Fe[e]=13,Fe[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var nt=Uint8Array,on=Uint16Array,Xr=Int32Array,Wr=new nt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Yr=new nt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),sn=function(e,t){for(var n=new on(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Xr(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},an=sn(Wr,2),Hr=an.b,Kr=an.r;Hr[28]=258,Kr[258]=28,sn(Yr,0);for(var qr=new on(32768),fe=0;fe<32768;++fe){var Ye=(fe&43690)>>1|(fe&21845)<<1;Ye=(Ye&52428)>>2|(Ye&13107)<<2,Ye=(Ye&61680)>>4|(Ye&3855)<<4,qr[fe]=((Ye&65280)>>8|(Ye&255)<<8)>>1}for(var it=new nt(288),fe=0;fe<144;++fe)it[fe]=8;for(var fe=144;fe<256;++fe)it[fe]=9;for(var fe=256;fe<280;++fe)it[fe]=7;for(var fe=280;fe<288;++fe)it[fe]=8;for(var Zr=new nt(32),fe=0;fe<32;++fe)Zr[fe]=5;var Qr=new nt(0),jr=typeof TextDecoder<"u"&&new TextDecoder,Jr=0;try{jr.decode(Qr,{stream:!0}),Jr=1}catch{}const cn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Rt(e){const t=cn.length;return cn[(e%t+t)%t]}function eo(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),l=c.useRef(null),u=c.useCallback((d,p)=>{o(g=>g.w===d&&g.h===p?g:{w:d,h:p})},[]);return c.useLayoutEffect(()=>{const d=n.current;if(!d||d===l.current)return;const p=d.getBoundingClientRect();(p.width>0||p.height>0)&&(l.current=d,u(p.width,p.height))}),c.useEffect(()=>{var g;const d=n.current;if(d===s.current||((g=a.current)==null||g.disconnect(),a.current=null,s.current=d,!d))return;const p=new ResizeObserver(x=>{for(const f of x)u(f.contentRect.width,f.contentRect.height)});a.current=p,p.observe(d)}),c.useEffect(()=>()=>{var d;return(d=a.current)==null?void 0:d.disconnect()},[]),{ref:n,size:r}}function to(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const no=.25,kt=64;function ln(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return kt;const o=Math.min(n/e,r/t);return o<=0?kt:Math.max(Math.max(n,r)/o,8)}function un(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=no,maxZoom:s=kt,naturalWidth:l,naturalHeight:u}=e,d=to(),p=c.useRef(d);p.current=d;const g=c.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const x=c.useRef(o);x.current=o,c.useEffect(()=>{const w=t.current;if(!w||!o)return;const M=E=>{var A;if(!p.current)return;E.preventDefault(),E.stopPropagation();const T=E.deltaY<0?1.1:1/1.1,_=g.current,C=w.getBoundingClientRect(),k=l&&u?ln(l,u,C.width,C.height):s,O=Math.max(a,Math.min(k,_.zoom*T));if(_.zoom===O)return;const z=E.clientX-C.left,R=E.clientY-C.top,S=z-(z-_.pan.x)/_.zoom*O,y=R-(R-_.pan.y)/_.zoom*O;(A=x.current)==null||A.call(x,{zoom:O,pan:{x:S,y}})};return w.addEventListener("wheel",M,{passive:!1}),()=>w.removeEventListener("wheel",M)},[t,!!o,a,s,l,u]);const f=c.useRef(null),v=c.useCallback(w=>{!p.current||!x.current||(w.currentTarget.setPointerCapture(w.pointerId),f.current={pointerId:w.pointerId,startX:w.clientX,startY:w.clientY,panX:g.current.pan.x,panY:g.current.pan.y})},[]),h=c.useCallback(w=>{var _;const M=f.current;if(!M||M.pointerId!==w.pointerId)return;const E=w.clientX-M.startX,T=w.clientY-M.startY;(_=x.current)==null||_.call(x,{zoom:g.current.zoom,pan:{x:M.panX+E,y:M.panY+T}})},[]),b=c.useCallback(w=>{const M=f.current;if(!(!M||M.pointerId!==w.pointerId)){try{w.currentTarget.releasePointerCapture(w.pointerId)}catch{}f.current=null}},[]),m=d&&!!o;return{containerProps:{onPointerDown:v,onPointerMove:h,onPointerUp:b,onPointerCancel:b,style:{cursor:m?"move":void 0,touchAction:m?"none":void 0}},modifierActive:d}}function Dt(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ro(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function dn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Lt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=eo(),s=c.useRef(null),l=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),u=c.useMemo(()=>{const h=a.w,b=a.h;if(h<=0||b<=0||n<=0||r<=0)return null;const m=Math.min(h/n,b/r),w=n*m,M=r*m;return{left:(h-w)/2,top:(b-M)/2,width:w,height:M}},[a.w,a.h,n,r]),d=e.masks,p=t.showMasks&&!!d&&d.length>0,g=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!p||!d)return;const h=s.current;if(!h)return;(h.width!==n||h.height!==r)&&(h.width=n,h.height=r);const b=h.getContext("2d");if(!b)return;b.clearRect(0,0,h.width,h.height);let m=!1;const w=b.createImageData(n,r),M=w.data;let E=d.length,T=!1;const _=()=>{m||T&&b.putImageData(w,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const k=C.getContext("2d",{willReadFrequently:!0});for(const O of d){const z=new Image;z.onload=()=>{if(!m){if(k){k.clearRect(0,0,n,r),k.drawImage(z,0,0,n,r);const R=k.getImageData(0,0,n,r).data;for(let S=0;S<n*r;S++){const y=R[S*4];if(y===0||l.has(y))continue;const[A,I,X]=ro(Rt(y));M[S*4]=A,M[S*4+1]=I,M[S*4+2]=X,M[S*4+3]=255,T=!0}}E-=1,E===0&&_()}},z.onerror=()=>{E-=1,E===0&&_()},z.src=`data:image/png;base64,${O.png_b64}`}return()=>{m=!0}},[p,d,n,r,g]),!u)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const x=e.boxes??[],f=t.showBoxes&&x.length>0,v=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),f&&i.jsx("svg",{className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:x.map((h,b)=>{if(!dn(h,t,l))return null;const m=h.domain==="pixel"?1:n,w=h.domain==="pixel"?1:r,M=h.position.minX*m,E=h.position.minY*w,T=(h.position.maxX-h.position.minX)*m,_=(h.position.maxY-h.position.minY)*w;return i.jsx("rect",{x:M,y:E,width:T,height:_,fill:"none",stroke:Rt(h.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),f&&i.jsx("div",{className:"absolute",style:{left:u.left,top:u.top,width:u.width,height:u.height},children:x.map((h,b)=>{if(!dn(h,t,l))return null;const m=h.domain==="pixel"?1/n:1,w=h.domain==="pixel"?1/r:1,M=h.position.minX*m*100,E=h.position.minY*w*100,T=h.label??v[String(h.class_id)]??`#${h.class_id}`,_=h.score!=null?` ${(h.score*100).toFixed(0)}%`:"";return!T&&!_?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${M}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Rt(h.class_id)},children:i.jsxs("span",{className:"mono",children:[T,_]})},b)})})]})}const It=30,pe=["#ff5a5a","#39d353","#5b9bff"];function Ot(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function J(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Ot(e/255):Ot(n==="int"?e*255:e)}const oo={x:0,y:0,w:1,h:1};function je({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:l=0,onActiveChange:u,sourceWindow:d=oo}){const p=c.useRef(null),g=c.useRef(!1),x=Dt(),f=c.useRef(u);f.current=u;const v=c.useCallback(b=>{var m;b!==g.current&&(g.current=b,(m=f.current)==null||m.call(f,b))},[]),h=c.useCallback(()=>{var j;const b=p.current,m=e.current;if(!b)return;const w=window.devicePixelRatio||1,M=b.clientWidth,E=b.clientHeight;if(M===0||E===0)return;b.width!==Math.round(M*w)&&(b.width=Math.round(M*w)),b.height!==Math.round(E*w)&&(b.height=Math.round(E*w));const T=b.getContext("2d");if(!T)return;if(T.setTransform(w,0,0,w,0,0),T.clearRect(0,0,M,E),!m||t<=0||n<=0){v(!1);return}const _=m.getBoundingClientRect(),C=b.getBoundingClientRect();if(_.width===0||_.height===0){v(!1);return}const k=d.x*t,O=d.y*n,z=d.w*t,R=d.h*n;if(z<=0||R<=0){v(!1);return}const S=Math.min(_.width/z,_.height/R);if(S<It){v(!1);return}const y=z*S,A=R*S,I=_.left+(_.width-y)/2-C.left,X=_.top+(_.height-A)/2-C.top,re=Math.max(Math.floor(k),Math.floor(k+(0-I)/S)),q=Math.min(Math.ceil(k+z),Math.ceil(k+(M-I)/S)),xe=Math.max(Math.floor(O),Math.floor(O+(0-X)/S)),ye=Math.min(Math.ceil(O+R),Math.ceil(O+(E-X)/S));if(q<=re||ye<=xe){v(!1);return}v(!0);const Ce=I+(0-k)*S,Le=X+(0-O)*S,Ie=I+(t-k)*S,he=X+(n-O)*S;T.save(),T.beginPath(),T.rect(Ce,Le,Ie-Ce,he-Le),T.clip(),T.textAlign="center",T.textBaseline="middle",T.lineJoin="round";const Ae=S*.14,de=S-Ae*2;for(let be=xe;be<ye;be++)for(let ie=re;ie<q;ie++){if(ie<0||be<0||ie>=t||be>=n)continue;const U=a(ie,be,s);if(!U||U.lines.length===0)continue;const ee=U.lines.length;let me=1;for(const $ of U.lines)$.length>me&&(me=$.length);const Ee=de/(ee*1.15),Te=de/(me*.62)||Ee,ve=Math.min(Ee,Te,24);if(ve<6)continue;const Re=I+(ie-k+.5)*S,F=X+(be-O+.5)*S,N=ve*1.15,K=U.luminance<=.55,Y=K?"#ffffff":"#000000";T.font=`${ve}px ui-monospace, SFMono-Regular, Menlo, monospace`,T.lineWidth=Math.max(1.4,ve*.16),T.strokeStyle=K?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Z=F-ee*N/2+N/2;for(let $=0;$<U.lines.length;$++){const Se=U.lines[$];T.strokeText(Se,Re,Z),T.fillStyle=((j=U.colors)==null?void 0:j[$])??Y,T.fillText(Se,Re,Z),Z+=N}}T.restore()},[e,t,n,a,s,v,d]);return c.useEffect(()=>{h()},[h,r,o.x,o.y,l,s,d,x]),c.useEffect(()=>{const b=p.current;if(!b)return;const m=new ResizeObserver(()=>h());return m.observe(b),()=>m.disconnect()},[h]),i.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function fn({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const so=`
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
`,pn=`
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
`,ao=`
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
`,ct=`
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
`;function hn(e){return`
${ze}
${pn}
${ao}

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
`}const io=hn("select(colorB, colorA, uv.x < split)"),co=hn("mix(colorA, colorB, alpha)"),Bt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},gn=new WeakMap;function lo(e,t){let n=gn.get(e);n||(n=new Map,gn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:so,targetFormat:t}),n.set(t,r)),r}function mn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function xn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function uo(e,t,n,r){var h;const o=mn(t),a=lo(e,o),s=xn(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,u=Bt[r.operator]??Bt.srgb,d=new Float32Array([r.exposureEV,u,l,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),x=new Float32Array([r.filter==="nearest"?0:1]),f=new Float32Array([r.offset??0]);let v;try{v=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:d}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:x}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,a,v)}finally{(h=v==null?void 0:v.destroy)==null||h.call(v),s.destroy()}}const vn=new WeakMap;function fo(e,t,n){let r=vn.get(e);r||(r=new Map,vn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?io:co,targetFormat:n}),r.set(o,a)),a}function po(e,t,n,r,o){var h;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=mn(t),s=fo(e,o.mode,a),l=xn(e,void 0),u=o.gamma,d=Bt[o.operator],p=new Float32Array([o.exposureEV,d,u,0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),x=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),f=new Float32Array([o.offset??0,0,0,0]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:x}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,s,v)}finally{(h=v==null?void 0:v.destroy)==null||h.call(v),l.destroy()}}function bn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function wn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:x,sumAbs:f}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return bn(x,f,a)}const s=await e.readback(t),l=await e.readback(n),u=s instanceof Uint8Array,d=l instanceof Uint8Array;let p=0,g=0;for(let x=0;x<o;x++)for(let f=0;f<r;f++){const v=(x*t.width+f)*4,h=(x*n.width+f)*4;for(let b=0;b<3;b++){const m=(s[v+b]??0)/(u?255:1),w=(l[h+b]??0)/(d?255:1),M=m-w;p+=M*M,g+=Math.abs(M)}}return bn(p,g,a)}function yn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const ho=12,He=[];function En(e){const t=He.indexOf(e);t!==-1&&He.splice(t,1),He.push(e)}function go(e){const t=He.indexOf(e);t!==-1&&He.splice(t,1)}function lt(e){e.parked||(go(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function _n(e){for(;He.length>ho;){const t=He.find(n=>n!==e&&!n.visible)??He.find(n=>n!==e);if(!t)break;lt(t)}}function Mn(e){var o,a;if(e.disposed)return;if(yn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){En(e),_n(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,En(e),_n(e)}function mo(e,t){if(e.disposed||!e.source)return!0;try{return Mn(e),!e.surface||!e.srcTexture?!1:(uo(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,lt(e),!1}}function xo(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return mo(e,t)},park(){e.disposed||lt(e)},restore(){e.disposed||!e.source||Mn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(lt(e),e.source=null,e.disposed=!0)}}}async function vo(e,t){const n=await st(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return xo(r)}function Tn(e){e.dispose()}function bo(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function Sn(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:l,flipSign:u}=e,d=c.useMemo(()=>bo(e,n),[n,r,o,s,u]);return{gammaFilterId:n,filterStr:d,gamma:a,offset:l}}function Pn({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Cn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function wo({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Cn(e),a=Cn(t),s=[];for(let w=0;w<=e;w+=o)s.push(w);const l=[];for(let w=0;w<=t;w+=a)l.push(w);const u=1/n,d=8*u,p=-12*u,g=-2*u,x=r==null?void 0:r.current;let f=0,v=0,h=0,b=0;if(x){const w=x.clientWidth,M=x.clientHeight,E=w/e,T=M/t,_=Math.min(E,T);h=e*_,b=t*_,f=(w-h)/2,v=(M-b)/2}const m=x&&h>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?v:0,transform:`translateY(${p}px)`,fontSize:d},children:s.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",left:m?f+w/e*h:`${w/e*100}%`,transform:"translateX(-50%)"},children:w},w))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?f:0,transform:`translateX(${g}px)`,fontSize:d},children:l.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",top:m?v+w/t*b:`${w/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*u}px`},children:w},w))})]})}function yo({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Eo=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function An(e,t){const n=getComputedStyle(e),r=Eo.map(u=>`${u}:${n.getPropertyValue(u)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,l=Math.min(a.length,s.length);for(let u=0;u<l;u++)An(a[u],s[u])}function Nt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Ut(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Ft(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,u)=>a.toBlob(d=>d?l(d):u(new Error("plot-to-png: toBlob returned null")),"image/png"))}function _o(e,t,n){const r=e.cloneNode(!0);An(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const u=new Image;u.onload=()=>s(u),u.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),u.src=a})}async function Rn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Nt(e);return Ft(r,o,Ut(t),a,s=>s.drawImage(e,0,0,r,o))}async function Mo(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Nt(e);try{return await Ft(r,o,Ut(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function To(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function So(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??Nt(e);if(n){const d=n.getBoundingClientRect(),p=await _o(n,d.width||a,d.height||s);return Ft(a,s,Ut(t),l,g=>{for(const x of r){const f=x.getBoundingClientRect();g.drawImage(x,f.left-o.left,f.top-o.top,f.width,f.height)}g.drawImage(p,d.left-o.left,d.top-o.top,d.width,d.height)})}if(r.length)return Rn(r[0],t);const u=To(e);if(u)return Mo(u,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Po(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Co=8;function Ao(e,t,n,r=Co){return!(t>0)||!(e>0)?n:e<t+r}function kn(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}const Ro={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},ko={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function $e({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:ko[e]??null})}function Dn({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx($e,{name:e??""})})}function Ln(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Do({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:a}=n,[s,l]=c.useState(!1),[u,d]=c.useState(0),p=c.useRef(null),g=kn(r,o),x=e?void 0:((b=r[g])==null?void 0:b.label)??"",f=c.useCallback(()=>{l(m=>{const w=!m;return w&&d(g),w})},[g]),v=c.useCallback(m=>{a(m),l(!1)},[a]);c.useEffect(()=>{if(!s)return;const m=M=>{p.current&&!p.current.contains(M.target)&&l(!1)},w=M=>{M.key==="Escape"&&(M.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",w,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",w,!0)}},[s]);const h=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),d(g),l(!0));return}if(m.key==="ArrowDown")m.preventDefault(),d(w=>(w+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),d(w=>(w-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const w=r[u];w&&v(w.id)}};return i.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),f()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:h,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",x?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[x?i.jsx("span",{"aria-hidden":"true",children:x}):i.jsx($e,{name:e??""}),i.jsx($e,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,w)=>{const M=m.id===o,E=w===u;return i.jsx("li",{role:"option","aria-selected":M,children:i.jsx("button",{type:"button",onClick:T=>{T.stopPropagation(),v(m.id)},onPointerEnter:()=>d(w),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",M?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const Lo=e=>e.format?e.format(e.value):String(e.value);function In({spec:e}){return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:t=>t.stopPropagation(),onDoubleClick:t=>{t.stopPropagation(),e.defaultValue!==void 0&&e.onChange(e.defaultValue)},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx($e,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:t=>e.onChange(Number(t.target.value)),onPointerDown:t=>t.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Lo(e)})]})}function Io({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:a,onSelect:s}=n,[l,u]=c.useState(!1),d=kn(o,a),p=((g=o[d])==null?void 0:g.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:x=>{x.stopPropagation(),u(f=>!f)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx($e,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),i.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:i.jsx($e,{name:"caret"})})]}),l&&o.map(x=>{const f=x.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":f,"data-menu-option":"",onClick:v=>{v.stopPropagation(),s(x.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",f?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:f?"✓":""}),i.jsx("span",{children:x.label})]},x.id)})]})}function Oo({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return c.useEffect(()=>{if(!r)return;const s=u=>{a.current&&!a.current.contains(u.target)&&o(!1)},l=u=>{u.key==="Escape"&&(u.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx($e,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(Io,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var u;l.stopPropagation(),!s.disabled&&((u=s.onClick)==null||u.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx($e,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx($e,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(In,{spec:s})},s.id))]})]})}function Bo({controller:e,config:t}){var R,S;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),l=`${((R=t==null?void 0:t.leadingButtons)==null?void 0:R.length)??0}:${((S=t==null?void 0:t.sliders)==null?void 0:S.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const y=n.current,A=y==null?void 0:y.parentElement;if(!A)return;const I=()=>{const re=A.clientWidth;if(!a.current&&n.current){const q=n.current.scrollWidth;q>0&&(s.current=q)}o(Ao(re,s.current,a.current))},X=new ResizeObserver(I);return X.observe(A),I(),()=>X.disconnect()},[l]),(t==null?void 0:t.enabled)===!1)return null;const u=e.capabilities,d=t==null?void 0:t.buttons,p=(y,A)=>A&&(d==null?void 0:d[y])!==!1,g=y=>()=>e.setDragMode(y),x=()=>{e.toPNG({filename:"plot"}).then(y=>Po(y,"plot.png")).catch(()=>{})},f=[];p("zoom",u.zoom)&&f.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),p("pan",u.pan)&&f.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),p("select",u.select)&&f.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),p("lasso",u.lasso)&&f.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const v=[];p("zoomIn",u.zoom)&&v.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",u.zoom)&&v.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const h=[];p("autoscale",u.autoscale)&&h.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",u.reset)&&h.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const b=[];p("screenshot",u.screenshot)&&b.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:x});const m=[f,v,h,b].filter(y=>y.length>0),w=m.flat(),M=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!M.length&&w.length===0&&E.length===0)return null;const T=(t==null?void 0:t.position)??"top-right",_=(t==null?void 0:t.visibility)==="always",C=T==="top-right"||T==="bottom-right",O=["z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",_?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),z={position:"absolute",pointerEvents:"auto",...Ro[T]};return r?i.jsx("div",{ref:n,style:z,className:`${O} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(Oo,{actions:w,leading:M,sliders:E})}):i.jsxs("div",{ref:n,style:z,className:`${O} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[M.length>0&&i.jsxs(i.Fragment,{children:[M.map(y=>y.menu?i.jsx(Do,{icon:y.icon,title:y.title,menu:y.menu},y.id):i.jsx(Dn,{icon:y.icon,label:y.label,title:y.title,active:y.active,disabled:y.disabled,onClick:y.onClick??(()=>{})},y.id)),m.length>0&&i.jsx(Ln,{})]}),m.map((y,A)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[A>0&&i.jsx(Ln,{}),y.map(I=>i.jsx(Dn,{icon:I.icon,title:I.title,active:I.active,disabled:I.disabled,onClick:I.onClick},I.id))]},y[0].id))]}),E.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:E.map(y=>i.jsx(In,{spec:y},y.id))})]})}const No={zoom:1,pan:{x:0,y:0}},On=1.3,Uo=.25,Fo=64,Go={buttons:{zoom:!1}};function Vo(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const zo=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Gt(e,t){return{id:"colormap",title:"Colormap",menu:{options:zo,value:e,onSelect:t}}}function $o({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:l=Uo,maxZoom:u=Fo,requestRender:d,onReset:p,extraModified:g=!1}){const x=c.useCallback(_=>{var X;if(!o)return;const C=(X=e.current)==null?void 0:X.getBoundingClientRect(),k=(C==null?void 0:C.width)??0,O=(C==null?void 0:C.height)??0,z=a&&s&&k>0&&O>0?ln(a,s,k,O):u,R=Math.max(l,Math.min(z,n*_));if(R===n)return;const S=k/2,y=O/2,A=S-(S-r.x)/n*R,I=y-(y-r.y)/n*R;o({zoom:R,pan:{x:A,y:I}})},[o,e,a,s,u,l,n,r.x,r.y]),f=c.useCallback(()=>x(On),[x]),v=c.useCallback(()=>x(1/On),[x]),h=c.useCallback(()=>{o==null||o(No),p==null||p()},[o,p]),b=c.useCallback(_=>{const C={scale:_==null?void 0:_.scale,filename:_==null?void 0:_.filename};d==null||d();const k=t==null?void 0:t.current;if(k)return Rn(k,C);const O=e.current;return O?So(O,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,d]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),w=n!==1||r.x!==0||r.y!==0||g,M=c.useCallback(_=>{},[]),E=c.useCallback(_=>{},[]),T=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:w,setDragMode:M,setHoverMode:E,toggleSpikelines:T,zoomIn:f,zoomOut:v,autoscale:h,reset:h,toPNG:b}),[m,w,M,E,T,f,v,h,b])}const Xo={zoom:1,pan:{x:0,y:0}};function ut({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:l,naturalDims:u,checkerboard:d,wrapperClassName:p,wrapperStyle:g,viewportPadding:x,header:f,surface:v,showAxes:h,overlayNode:b,overlay:m,notationSeed:w,exportCanvasRef:M,requestRender:E,leadingMenus:T,displayAdjust:_,onReset:C,extraModified:k,label:O,showLabelChip:z,isDraggable:R=!1,onDragStart:S,extraChips:y}){const[A,I]=c.useState(w),[X,re]=c.useState(!1),{containerProps:q}=un({containerRef:r,zoom:a,pan:s,onViewportChange:l,naturalWidth:u==null?void 0:u.w,naturalHeight:u==null?void 0:u.h}),xe=c.useCallback(()=>{_==null||_.onExposureChange(0),_==null||_.onOffsetChange(0),C==null||C()},[_,C]),ye=c.useCallback(()=>{l==null||l(Xo),xe()},[l,xe]),Ce=$o({rootRef:r,canvasRef:M,zoom:a,pan:s,onViewportChange:l,naturalWidth:u==null?void 0:u.w,naturalHeight:u==null?void 0:u.h,requestRender:E,onReset:xe,extraModified:((_==null?void 0:_.exposureEV)??0)!==0||((_==null?void 0:_.offset)??0)!==0||!!k}),Le=c.useMemo(()=>{if(!_)return;const be=(ie,U)=>`${ie>=0?"+":"−"}${Math.abs(ie).toFixed(U)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to reset.",min:-8,max:8,step:.1,value:_.exposureEV,onChange:_.onExposureChange,format:ie=>be(ie,1),defaultValue:0},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to reset.",min:-1,max:1,step:.01,value:_.offset,onChange:_.onOffsetChange,format:ie=>be(ie,2),defaultValue:0}]},[_]),Ie=c.useMemo(()=>({...Go,leadingButtons:[...T??[],...X?[Vo(A,I)]:[]],sliders:Le}),[X,A,T,Le]),he=" cairn-checkerboard",Ae="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(d==="pane"?he:""),de=p+(d==="wrapper"?he:""),j="render"in m?m.render({notation:A,setOverlayActive:re}):m.hasSource&&u?i.jsx(je,{imageElRef:m.displayElRef,naturalWidth:u.w,naturalHeight:u.h,zoom:a,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:A,version:m.version,onActiveChange:re}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[f,n&&i.jsx(Bo,{controller:Ce,config:Ie}),i.jsxs("div",{ref:r,className:Ae,style:{padding:x,...q.style},onPointerDown:q.onPointerDown,onPointerMove:q.onPointerMove,onPointerUp:q.onPointerUp,onPointerCancel:q.onPointerCancel,onDoubleClick:ye,...t,children:[i.jsxs("div",{ref:o,className:de,style:g,children:[v,h&&u&&i.jsx(wo,{naturalWidth:u.w,naturalHeight:u.h,zoom:a,containerRef:o}),b]}),j,!n&&X&&i.jsx(fn,{notation:A,onChange:I})]}),z&&i.jsx(yo,{label:O,isDraggable:R,onDragStart:S}),y]})}function Bn(e){return"hdr"in e&&e.hdr!=null}function Nn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Pe(e){return Number.isFinite(e)?e:0}const Wo={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Yo(e,t,n,r,o=0){const{h:a,w:s,c:l}=Nn(e.shape),u=e.data,d=zr(t),p=new Uint8ClampedArray(s*a*4);for(let g=0;g<s*a;g++){const x=g*l;let f,v,h,b=1;l===1?f=v=h=Pe(u[x]):l===3?(f=Pe(u[x]),v=Pe(u[x+1]),h=Pe(u[x+2])):(f=Pe(u[x]),v=Pe(u[x+1]),h=Pe(u[x+2]),b=Pe(u[x+3]));const m=[Ct(f,n,o),Ct(v,n,o),Ct(h,n,o)],[w,M,E]=d(m),T=g*4;p[T]=255*At(w,r),p[T+1]=255*At(M,r),p[T+2]=255*At(E,r),p[T+3]=255*(b<0?0:b>1?1:b)}return new ImageData(p,s,a)}function Ho(e){var $,Se;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:l=!1,processing:u=Wo,zoom:d=1,pan:p={x:0,y:0},onViewportChange:g,onNaturalSize:x,label:f,isDraggable:v=!1,onDragStart:h,overlay:b,overlaySettings:m,pixelValueNotation:w="decimal",toolbar:M=!0}=e,[E,T]=c.useState(s);c.useEffect(()=>{T(s)},[s]);const _=c.useRef(s),C=c.useCallback(()=>{T(_.current)},[]),k=c.useRef(null),O=c.useRef(null),z=c.useRef(null),R=c.useRef(null),S=c.useRef(null),y=c.useRef(null),A=c.useRef(null),[I,X]=c.useState(0),re=c.useCallback(()=>X(D=>D+1),[]),q=c.useMemo(()=>({get current(){const D=S.current;return D instanceof HTMLCanvasElement?D:null}}),[]),xe=c.useCallback(D=>{k.current=D,D&&(S.current=D)},[]),ye=c.useCallback(D=>{O.current=D,D&&(S.current=D)},[]),Ce=c.useCallback(D=>{D&&(S.current=D)},[]),[Le,Ie]=c.useState(!1),[he,Ae]=c.useState(!1),[de,j]=c.useState(null),{flipSign:be}=u,{gammaFilterId:ie,filterStr:U,gamma:ee,offset:me}=Sn(u),Ee=!r&&o!=="none"&&n!=null&&t!=null,Te=o!=="none"&&n!=null,ve=E!=="none"&&!Ee&&!(r&&Te)&&t!=null;c.useEffect(()=>{if(!ve||!t){Ae(!1);return}let D=!1;Ae(!1);const G=`${t}::${E}`,H=Mt(G);if(H){const Q=O.current;if(Q){Q.width=H.width,Q.height=H.height;const te=Q.getContext("2d");te&&te.putImageData(H,0,0),A.current=H,re(),j({w:H.width,h:H.height}),x==null||x(H.width,H.height),Ae(!0)}return}const oe=new Image;return oe.onload=()=>{if(D)return;const Q=document.createElement("canvas");Q.width=oe.naturalWidth,Q.height=oe.naturalHeight;const te=Q.getContext("2d");if(!te)return;te.drawImage(oe,0,0);const we=te.getImageData(0,0,Q.width,Q.height),ge=yt.has(E)?"positive":"linear",se=_t(we,E,ge);Tt(G,se);const Be=O.current;if(!Be||D)return;Be.width=se.width,Be.height=se.height;const _e=Be.getContext("2d");_e&&_e.putImageData(se,0,0),A.current=se,re(),j({w:se.width,h:se.height}),x==null||x(se.width,se.height),Ae(!0)},oe.src=t,()=>{D=!0}},[ve,t,E]);const Re=c.useCallback((D,G)=>{j(H=>H&&H.w===D&&H.h===G?H:{w:D,h:G}),x==null||x(D,G)},[]);c.useEffect(()=>{if(!t){y.current=null,A.current=null,re();return}let D=!1;return Ze(t).then(G=>{D||(y.current=G,E==="none"&&(A.current=G),re())}),()=>{D=!0}},[t,E,re]);const F=c.useCallback((D,G,H)=>{const oe=y.current;if(!oe||D<0||G<0||D>=oe.width||G>=oe.height)return null;const Q=(G*oe.width+D)*4,te=oe.data[Q],we=oe.data[Q+1],ge=oe.data[Q+2],se=A.current;let Be=te,_e=we,Oe=ge;if(se&&se.width===oe.width&&se.height===oe.height){const Ve=(G*se.width+D)*4;Be=se.data[Ve],_e=se.data[Ve+1],Oe=se.data[Ve+2]}const Ge=(.299*Be+.587*_e+.114*Oe)/255;return E!=="none"||te===we&&we===ge?{lines:[J(te,"uint8",H)],luminance:Ge}:{lines:[J(te,"uint8",H),J(we,"uint8",H),J(ge,"uint8",H)],luminance:Ge,colors:[pe[0],pe[1],pe[2]]}},[E]);c.useEffect(()=>{if(!Ee){Ie(!1);return}let D=!1;const G=Gr(),H=G==="gpu"||G==="auto",oe=`${n}::${t}::${o}::${E}`;if(G!=="gpu"){const Q=Mt(oe);if(Q){const te=k.current;if(te){(te.width!==Q.width||te.height!==Q.height)&&(te.width=Q.width,te.height=Q.height);const we=te.getContext("2d");we&&we.putImageData(Q,0,0),Re(Q.width,Q.height),Ie(!0)}return}}return(async()=>{const[Q,te]=await Promise.all([Ze(n),Ze(t)]);if(D||!Q||!te)return;const ge=o.includes("signed")?"signed":"positive",se=E!=="none"?Et(E):null,Be={diffMode:o,colormap:se,cmapMode:ge};if(H)try{const qe=k.current;if(qe){const Ve=Ur(Q,te,Be,qe);if(Ve){if(D)return;Re(Ve.width,Ve.height),Ie(!0);return}}}catch(qe){console.warn("[cairn] WebGL 2 diff error:",qe)}if(G==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let _e=kr(Q,te,o);E!=="none"&&(_e=_t(_e,E,ge)),Tt(oe,_e);const Oe=k.current;if(!Oe||D)return;(Oe.width!==_e.width||Oe.height!==_e.height)&&(Oe.width=_e.width,Oe.height=_e.height);const Ge=Oe.getContext("2d");Ge&&Ge.putImageData(_e,0,0),Re(_e.width,_e.height),Ie(!0)})(),()=>{D=!0}},[n,t,o,Ee,E,x]);const N=a==="auto"?void 0:a,K=be?{filter:"invert(1)"}:{},Y=b&&(m!=null&&m.enabled)&&de&&t&&(((($=b.boxes)==null?void 0:$.length)??0)>0||(((Se=b.masks)==null?void 0:Se.length)??0)>0)?i.jsx(Lt,{data:b,settings:m,naturalWidth:de.w,naturalHeight:de.h}):void 0,Z=t?Ee?i.jsxs(i.Fragment,{children:[!Le&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:xe,className:"w-full h-full object-contain block",style:{display:Le?"block":"none",imageRendering:N,...K}})]}):ve?i.jsxs(i.Fragment,{children:[!he&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:ye,className:"w-full h-full object-contain block",style:{display:he?"block":"none",imageRendering:N,...K}})]}):i.jsx("img",{ref:Ce,src:t,alt:f,className:"w-full h-full object-contain block",draggable:!1,style:{filter:U,imageRendering:N},onLoad:D=>{const G=D.currentTarget;j({w:G.naturalWidth,h:G.naturalHeight}),x==null||x(G.naturalWidth,G.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(ut,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:M,paneRef:z,wrapperRef:R,zoom:d,pan:p,onViewportChange:g,naturalDims:de,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:l&&de?"16px 4px 4px 28px":"4px",header:i.jsx(Pn,{id:ie,gamma:ee,offset:me}),surface:Z,showAxes:l,overlayNode:Y,overlay:{displayElRef:S,sample:F,version:I,hasSource:!!t},notationSeed:w,exportCanvasRef:q,leadingMenus:[Gt(E,D=>T(D))],onReset:C,extraModified:E!==_.current,label:f,showLabelChip:!0,isDraggable:v,onDragStart:h})}function Ko(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:l="auto",zoom:u=1,pan:d={x:0,y:0},onViewportChange:p,pixelValueNotation:g="decimal",toolbar:x=!0}=e,f=c.useRef(null),v=c.useRef(null),h=c.useRef(null),[b,m]=c.useState(null),w=c.useRef(null),[M,E]=c.useState(0),[T,_]=c.useState(0),[C,k]=c.useState(0);c.useEffect(()=>{const R=f.current;if(!R)return;let S;try{S=Yo(t,n,r+T,o,C)}catch(A){console.error("[cairn] HDR tone-map error:",A);return}(R.width!==S.width||R.height!==S.height)&&(R.width=S.width,R.height=S.height);const y=R.getContext("2d");y&&(y.putImageData(S,0,0),w.current=S,E(A=>A+1),m(A=>A&&A.w===S.width&&A.h===S.height?A:{w:S.width,h:S.height}))},[t,n,r,o,T,C]);const O=c.useCallback((R,S,y)=>{const A=b;if(!A||R<0||S<0||R>=A.w||S>=A.h)return null;const I=t.shape.length===2?1:t.shape[2]??1,X=(S*A.w+R)*I,re=t.data,q=w.current;let xe=.5;if(q&&q.width===A.w&&q.height===A.h){const ye=(S*A.w+R)*4;xe=(.299*q.data[ye]+.587*q.data[ye+1]+.114*q.data[ye+2])/255}return I===1?{lines:[J(re[X]??0,"unit",y)],luminance:xe}:{lines:[J(re[X]??0,"unit",y),J(re[X+1]??0,"unit",y),J(re[X+2]??0,"unit",y)],luminance:xe,colors:[pe[0],pe[1],pe[2]]}},[t,b]),z=l==="auto"?void 0:l;return i.jsx(ut,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:v,wrapperRef:h,zoom:u,pan:d,onViewportChange:p,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:a&&b?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:f,className:"w-full h-full object-contain block",style:{imageRendering:z}}),showAxes:a,overlay:{displayElRef:f,sample:O,version:M,hasSource:!0},notationSeed:g,exportCanvasRef:f,displayAdjust:{exposureEV:T,offset:C,onExposureChange:_,onOffsetChange:k},label:s,showLabelChip:!!s})}function Vt(e){return Bn(e)?i.jsx(Ko,{...e}):i.jsx(Ho,{...e})}const qo="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function Zo(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Qo(e,t){switch(Zo(t.userAgent,t.isBrave)){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return e==="no-hdr"?"Chrome/Edge: requires an HDR display with OS HDR enabled.":"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function jo(e){return e==="no-webgpu"?"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.":"true HDR output unsupported by this browser → HDR images tone-mapped to SDR."}function Un(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Fn=new Set;function Gn(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Fn.has(e)}function Jo(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Fn.add(e)}const Vn=new Set;let dt=null,et=null;function zn(){et&&et.parentNode&&et.parentNode.removeChild(et),et=null,dt=null}function es(e){const t=Un(e,window.location.pathname),n=Qo(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=jo(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=qo,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{Jo(t),zn()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),et=r,dt=e}function $n(e){if(typeof document>"u"||typeof window>"u"||Vn.has(e))return;Vn.add(e);const t=Un(e,window.location.pathname);if(Gn(t))return;const n=()=>{if(!Gn(t)){if(dt!==null)if(e==="no-webgpu"&&dt==="no-hdr")zn();else return;es(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const ts=["linear","srgb","reinhard","aces"];function ns(e){return e&&ts.includes(e)?e:"srgb"}function rs(e){const{h:t,w:n,c:r}=Nn(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let u,d,p,g=1;r===1?u=d=p=Pe(o[l]):r===3?(u=Pe(o[l]),d=Pe(o[l+1]),p=Pe(o[l+2])):(u=Pe(o[l]),d=Pe(o[l+1]),p=Pe(o[l+2]),g=Pe(o[l+3]));const x=s*4;a[x]=u,a[x+1]=d,a[x+2]=p,a[x+3]=g}return{data:a,width:n,height:t,format:"rgba32float"}}function Xn(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,l=(t.width-a)/2,u=(t.height-s)/2,d=Math.max(e.zoom,1e-6),p=t.width/(d*a),g=t.height/(d*s),x=-l/a-e.pan.x/(d*a),f=-u/s-e.pan.y/(d*s);return{x,y:f,w:p,h:g}}function Wn(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function os(e){var ve,Re;const t=Bn(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(!1),[l,u]=c.useState(!1),[d,p]=c.useState(!1),[g,x]=c.useState(null),[f,v]=c.useState(0),[h,b]=c.useState(0),[m,w]=c.useState({x:0,y:0,w:1,h:1}),M=c.useRef(null),E=c.useRef(null),[T,_]=c.useState(0),C=e.zoom??1,k=e.pan??{x:0,y:0},O=e.onViewportChange,z=t?"none":e.colormap??"none",[R,S]=c.useState(z);c.useEffect(()=>{S(z)},[z]);const y=t?"none":R,A=c.useRef(z),I=c.useCallback(()=>{S(A.current)},[]),[X,re]=c.useState(0),[q,xe]=c.useState(0),ye=Dt();c.useEffect(()=>{const F=n.current;if(!F)return;let N=!1;return st().then(K=>{if(N)return;const Y=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,Z=K.capabilities.hdr&&Y&&t;s.current=Z,t&&!Z&&$n("no-hdr"),vo(F,{hdr:Z}).then($=>{if(N){Tn($);return}a.current=$,p(!0)}).catch($=>{N||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",$),u(!0))})}).catch(K=>{N||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",K),u(!0))}),()=>{N=!0,a.current&&(Tn(a.current),a.current=null)}},[]),c.useEffect(()=>{const F=r.current;if(!F)return;const N=new ResizeObserver(()=>b(K=>K+1));return N.observe(F),()=>N.disconnect()},[]),c.useEffect(()=>{const F=r.current;if(!F)return;const N=new IntersectionObserver(K=>{const Y=K[0];if(!Y)return;const Z=a.current;Z&&(Z.setVisible(Y.isIntersecting),Y.isIntersecting?Z.isParked&&(Z.restore(),b($=>$+1)):Z.park())},{threshold:0});return N.observe(F),()=>N.disconnect()},[]),c.useEffect(()=>{var K;if(!t||!d)return;const F=e.hdr;M.current=F;const N=rs(F);(K=a.current)==null||K.setSource(N),x(Y=>Y&&Y.w===N.width&&Y.h===N.height?Y:{w:N.width,h:N.height}),_(Y=>Y+1),v(Y=>Y+1)},[t,d,t?e.hdr:null]),c.useEffect(()=>{if(t||!d)return;const F=e,N=F.imageUrl,K=R;if(!N){E.current=null,x(null),_(Z=>Z+1);return}let Y=!1;return Ze(N).then(Z=>{var D,G;if(Y||!Z)return;let $=Z;if(K!=="none"){const H=`gpu::${N}::${K}::ev${X}::off${q}`,oe=Mt(H);if(oe)$=oe;else{const Q=yt.has(K)?"positive":"linear";$=_t(Z,K,Q,X,q),Tt(H,$)}}E.current=Z;const Se={data:$.data,width:$.width,height:$.height,format:"rgba8unorm"};(D=a.current)==null||D.setSource(Se),x(H=>H&&H.w===$.width&&H.h===$.height?H:{w:$.width,h:$.height}),(G=F.onNaturalSize)==null||G.call(F,$.width,$.height),_(H=>H+1),v(H=>H+1)}),()=>{Y=!0}},[t,d,t?null:e.imageUrl,t?null:R,t?0:X,t?0:q]);const Ce=t?e.exposure??0:0,Le=t?e.tonemap:void 0,Ie=t?e.gamma:void 0,he=c.useCallback(()=>{const F=a.current;if(!F||!d||!g)return;const N=r.current,K=o.current,Y=K?K.getBoundingClientRect():N?N.getBoundingClientRect():{width:g.w,height:g.h},Z=Xn({zoom:C,pan:k},Y,g.w,g.h);w(G=>G.x===Z.x&&G.y===Z.y&&G.w===Z.w&&G.h===Z.h?G:Z),Y.width>0&&Y.height>0&&F.resize(Math.round(Y.width*ye),Math.round(Y.height*ye));const $=Wn(Z,Y,g.w,g.h)>=It?"nearest":"linear",Se=Z,D=t?{exposureEV:Ce+X,offset:q,operator:s.current?"extended":ns(Le),gamma:Ie,isScalar:!1,hdrOut:s.current,uv:Se,filter:$}:{exposureEV:y!=="none"?0:X,offset:y!=="none"?0:q,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Se,filter:$};try{F.render(D)||u(!0)}catch(G){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",G),u(!0)}},[d,g,C,k.x,k.y,Ce,X,q,Le,Ie,t,y,ye]);c.useEffect(()=>{he()},[he,f,h]);const Ae=c.useCallback((F,N,K)=>{if(t){const oe=M.current,Q=g;if(!oe||!Q||F<0||N<0||F>=Q.w||N>=Q.h)return null;const te=oe.shape.length===2?1:oe.shape[2]??1,we=(N*Q.w+F)*te,ge=oe.data,se=.5;return te===1?{lines:[J(ge[we]??0,"unit",K)],luminance:se}:{lines:[J(ge[we]??0,"unit",K),J(ge[we+1]??0,"unit",K),J(ge[we+2]??0,"unit",K)],luminance:se,colors:[pe[0],pe[1],pe[2]]}}const Y=E.current;if(!Y||F<0||N<0||F>=Y.width||N>=Y.height)return null;const Z=(N*Y.width+F)*4,$=Y.data[Z],Se=Y.data[Z+1],D=Y.data[Z+2],G=(.299*$+.587*Se+.114*D)/255;return y!=="none"||$===Se&&Se===D?{lines:[J($,"uint8",K)],luminance:G}:{lines:[J($,"uint8",K),J(Se,"uint8",K),J(D,"uint8",K)],luminance:G,colors:[pe[0],pe[1],pe[2]]}},[t,g,y]),de=e.showAxes??!1,j=t?e.label??"":e.label,be=e.interpolation??"auto",ie=be==="auto"?void 0:be,U=t?void 0:e.overlay,ee=t?void 0:e.overlaySettings,me=t?!1:e.isDraggable??!1,Ee=t?void 0:e.onDragStart;if(l)return t?i.jsx(Vt,{...e}):i.jsx(Vt,{...e});const Te=U&&(ee!=null&&ee.enabled)&&g&&((((ve=U.boxes)==null?void 0:ve.length)??0)>0||(((Re=U.masks)==null?void 0:Re.length)??0)>0)?i.jsx(Lt,{data:U,settings:ee,naturalWidth:g.w,naturalHeight:g.h}):void 0;return i.jsx(ut,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":d},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:C,pan:k,onViewportChange:O,naturalDims:g,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:de&&g?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:ie},"data-gpu-image-canvas":!0}),showAxes:de,overlayNode:Te,overlay:{displayElRef:n,sample:Ae,version:T,hasSource:!0,sourceWindow:m},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:he,leadingMenus:t?void 0:[Gt(y,F=>S(F))],displayAdjust:{exposureEV:X,offset:q,onExposureChange:re,onOffsetChange:xe},onReset:I,extraModified:R!==A.current,label:j,showLabelChip:!!j,isDraggable:me,onDragStart:Ee})}const ft=new Map;function Xe(e){if(ft.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);ft.set(e.id,e)}function Je(e){return ft.get(e)}function ss(){return Array.from(ft.values())}function Yn(e,t){return{...e.params??{},...t??{}}}const as={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},is={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},cs={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},ls={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},us={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},ds={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Hn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];ps(Hn);const zt=[1.052156925,1,.91835767],fs=.7;function ps(e){const[t,n,r]=e[0],[o,a,s]=e[1],[l,u,d]=e[2],p=a*d-s*u,g=-(o*d-s*l),x=o*u-a*l,v=1/(t*p+n*g+r*x);return[[p*v,-(n*d-r*u)*v,(n*s-r*a)*v],[g*v,(t*d-r*l)*v,-(t*s-r*o)*v],[x*v,-(t*u-n*l)*v,(t*a-n*o)*v]]}function hs(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const $t=6/29;function Xt(e){return e>$t**3?Math.cbrt(e):e/(3*$t*$t)+4/29}function Kn(e,t,n){const[r,o,a]=hs(Hn,e,t,n),s=Xt(r*zt[0]),l=Xt(o*zt[1]),u=Xt(a*zt[2]),d=116*l-16,p=500*(s-l),g=200*(l-u);return[d,.01*d*p,.01*d*g]}function gs(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function ms(){const e=Kn(0,1,0),t=Kn(0,0,1);return Math.pow(gs(e,t),fs)}const qn=ms(),xs=.082;function Zn(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),l=1/e,u=Math.PI**2,d=[0,0,0];for(let p=-s;p<=s;p++)for(let g=-s;g<=s;g++){const x=(g*l)**2+(p*l)**2;for(let f=0;f<3;f++)d[f]+=t[f]*Math.sqrt(Math.PI/n[f])*Math.exp(-u*x/n[f])+r[f]*Math.sqrt(Math.PI/o[f])*Math.exp(-u*x/o[f])}return{r:s,deltaX:l,sums:d}}function Qn(e){const t=.5*xs*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const u=Math.exp(-(l*l+s*s)/(2*t*t)),d=-l*u,p=(l*l/(t*t)-1)*u;d>0&&(r+=d),p>0?o+=p:a-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const vs=`
${ze}
${ct}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,bs=`
${ze}
${ct}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,pt=`
${ze}
${ct}
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
`,jn=`
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
`;function Ke(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function ht(e){return[Ke(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ke(2,[e.sums[2],0,0,0])]}function Jn(e){return[Ke(4,[qn,e.sd,e.r,e.edgeNorm]),Ke(5,[e.pointPos,e.pointNeg,0,0])]}function er(e,t,n,r,o=""){const a=Zn(e),s=Qn(e),l=`ycxczA${o}`,u=`ycxczB${o}`,d=`labA${o}`,p=`labB${o}`,g=`flip${o}`;return{passes:[{name:l,shader:t,inputs:[n],output:l},{name:u,shader:t,inputs:[r],output:u},{name:d,shader:pt,inputs:[l],output:d,uniforms:()=>ht(a)},{name:p,shader:pt,inputs:[u],output:p,uniforms:()=>ht(a)},{name:g,shader:jn,inputs:[d,p,l,u],output:g,uniforms:()=>Jn(s)}],flipRef:g}}const ws={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=er(t,vs,"srcA","srcB");return{passes:n,final:r}}},ys={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=er(t,bs,"srcA","srcB");return{passes:n,final:r}}},tr=`
${ze}
${ct}
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
`,Es=`
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
`,_s={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=Zn(t),l=Qn(t),u=[];let d=null;for(let p=0;p<o;p++){const g=n+p*a,x=`_e${p}`,f=`ycxczA${x}`,v=`ycxczB${x}`,h=`labA${x}`,b=`labB${x}`,m=`acc${x}`;u.push({name:f,shader:tr,inputs:["srcA"],output:f,uniforms:()=>[Ke(1,[g,0,0,0])]},{name:v,shader:tr,inputs:["srcB"],output:v,uniforms:()=>[Ke(1,[g,0,0,0])]},{name:h,shader:pt,inputs:[f],output:h,uniforms:()=>ht(s)},{name:b,shader:pt,inputs:[v],output:b,uniforms:()=>ht(s)}),d===null?u.push({name:m,shader:jn,inputs:[h,b,f,v],output:m,uniforms:()=>Jn(l)}):u.push({name:m,shader:Es,inputs:[h,b,f,v,d],output:m,uniforms:()=>[Ke(5,[qn,l.sd,l.r,l.edgeNorm]),Ke(6,[l.pointPos,l.pointNeg,0,0])]}),d=m}return{passes:u,final:d}}};let nr=!1;function Ms(){nr||(nr=!0,Xe(is),Xe(as),Xe(cs),Xe(us),Xe(ls),Xe(ds),Xe(ws),Xe(_s),Xe(ys))}Ms();function rr(){const e=[];for(const t of ss())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function Ts(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function Ss(e,t){return e==="signed"||e==="relative"?"signed":yt.has(t??"")?"positive":"linear"}const or=new WeakMap;function Wt(e,t,n,r){let o=or.get(e);o||(o=new Map,or.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Ps(e){return`
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
`}const gt="rgba16float";function Cs(e,t,n,r,o){var f,v;const a=Je(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),l=Math.min(t.height,n.height),u=Yn(a,o);if(a.kind==="pointwise"){const h=e.createTexture(s,l,gt),b=Wt(e,`pw:${a.id}`,Ps(a.source),gt);let m;try{m=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(h,b,m)}finally{(f=m==null?void 0:m.destroy)==null||f.call(m)}return h}const d={width:s,height:l,params:u},p=a.buildPasses(d),g=new Map([["srcA",t],["srcB",n]]),x=[];try{for(const b of p.passes){const m=e.createTexture(s,l,gt);x.push(m),g.set(b.output,m);const w=Wt(e,`mp:${a.id}:${b.name}`,b.shader,gt),M=b.inputs.map((T,_)=>{const C=g.get(T);if(!C)throw new Error(`computeDiff: pass "${b.name}" input "${T}" not produced yet`);return{binding:_,resource:C}});b.uniforms&&M.push(...b.uniforms(d));let E;try{E=e.createBindGroup(w,M),e.renderFullscreen(m,w,E)}finally{(v=E==null?void 0:E.destroy)==null||v.call(E)}}const h=g.get(p.final);if(!h)throw new Error(`computeDiff: final ref "${p.final}" not produced`);for(const b of x)b!==h&&b.destroy();return h}catch(h){for(const b of x)b.destroy();throw h}}const As=8,Rs=256*1024*1024;class ks{constructor(t=As,n=Rs){ae(this,"map",new Map);ae(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const sr=new WeakMap;function Ds(e){let t=sr.get(e);return t||(t=new ks,sr.set(e,t)),t}function Ls(e,t){const n=Yn(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Is(e,t,n,r){const o=Je(n),a=o?Ls(o,r):"";return`${e}|${t}|${n}|${a}`}function Os(e,t,n,r,o,a,s){const l=Je(r);if(!l)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=Ds(e),d=Is(a,s,r,o),p=u.get(d);if(p)return p;const g=Cs(e,t,n,r,o),x=Math.min(t.width,n.width),f=Math.min(t.height,n.height),v={texture:g,width:x,height:f,displayRange:l.displayRange,bytes:x*f*8};return u.set(d,v),v}async function Bs(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=wn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function Ns(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,r})),t.resultSamplesPending)}const Us=`
${ze}
${pn}
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
`,Fs={unit:0,signed:1,relative:2},Gs={linear:0,signed:1,positive:2};function Vs(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function zs(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function $s(e,t,n,r,o){var x;const a=zs(t),s=Wt(e,"diff-display",Us,a),l=Vs(e,o.colormap),u=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([Fs[r],Gs[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]);let g;try{g=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:p}}]),e.renderFullscreen(t,s,g)}finally{(x=g==null?void 0:g.destroy)==null||x.call(g),l.destroy()}}const ar=.6*.6*2.51,Xs=.6*.03,Ws=0,ir=.6*.6*2.43,Ys=.6*.59,Hs=.14;function cr(e){const t=(Xs-Ys*e)/(ar-ir*e),n=(Ws-Hs*e)/(ar-ir*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Ks=.85,qs=.85,lr=11920928955078125e-23,Yt=[.2126,.7152,.0722];function Zs(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Qs(e,t,n,r=3,o={}){const a=t*n,s=cr(Ks),l=cr(qs),u=new Float64Array(a);let d=0;for(let w=0;w<a;w++){const[M,E,T]=Zs(e,w,r),_=M*Yt[0]+E*Yt[1]+T*Yt[2];u[w]=_,_>d&&(d=_)}const p=Float64Array.from(u).sort(),g=a>>1,x=a%2===1?p[g]:p[g-1],f=Math.max(x,lr),v=Math.max(d,lr),h=o.startExposure??Math.log2(s/v),b=o.stopExposure??Math.log2(l/f),m=Math.max(2,Math.ceil(b-h));return{startExposure:h,stopExposure:b,numExposures:m}}const js={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Js({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:l,onViewportChange:u,processing:d=js,interpolation:p="auto",label:g="",isDraggable:x=!1,onDragStart:f,overlay:v,overlaySettings:h,pixelValueNotation:b="decimal"}){var be,ie;const m=c.useRef(null),[w,M]=c.useState(null),[E,T]=c.useState(null),[_,C]=c.useState(b),[k,O]=c.useState(!1),z=c.useRef(null),R=c.useRef(null),S=c.useRef(null),y=c.useRef(null),[A,I]=c.useState(0);c.useEffect(()=>{if(!e){S.current=null,I(ee=>ee+1);return}let U=!1;return Ze(e).then(ee=>{U||(S.current=ee,I(me=>me+1))}),()=>{U=!0}},[e]),c.useEffect(()=>{if(!t){y.current=null,I(ee=>ee+1);return}let U=!1;return Ze(t).then(ee=>{U||(y.current=ee,I(me=>me+1))}),()=>{U=!0}},[t]);const X=U=>(ee,me,Ee)=>{const Te=U.current;if(!Te||ee<0||me<0||ee>=Te.width||me>=Te.height)return null;const ve=(me*Te.width+ee)*4,Re=Te.data[ve],F=Te.data[ve+1],N=Te.data[ve+2],K=(.299*Re+.587*F+.114*N)/255;return Re===F&&F===N?{lines:[J(Re,"uint8",Ee)],luminance:K}:{lines:[J(Re,"uint8",Ee),J(F,"uint8",Ee),J(N,"uint8",Ee)],luminance:K,colors:[pe[0],pe[1],pe[2]]}},re=c.useMemo(()=>X(S),[]),q=c.useMemo(()=>X(y),[]),xe=!!v&&!!(h!=null&&h.enabled)&&!!w&&!!e&&((((be=v.boxes)==null?void 0:be.length)??0)>0||(((ie=v.masks)==null?void 0:ie.length)??0)>0),{gammaFilterId:ye,filterStr:Ce,gamma:Le,offset:Ie}=Sn(d),he=`translate(${l.x}px, ${l.y}px) scale(${s})`,Ae=p==="auto"?void 0:p,{containerProps:de,modifierActive:j}=un({containerRef:m,zoom:s,pan:l,onViewportChange:u});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(Pn,{id:ye,gamma:Le,offset:Ie}),i.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...de.style},onPointerDown:de.onPointerDown,onPointerMove:de.onPointerMove,onPointerUp:de.onPointerUp,onPointerCancel:de.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:he,transformOrigin:"0 0"},children:[i.jsx("img",{ref:z,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ce,imageRendering:Ae,...n==="blend"?{opacity:o}:{}},onLoad:U=>{const ee=U.currentTarget;M({w:ee.naturalWidth,h:ee.naturalHeight})}}),xe&&i.jsx(Lt,{data:v,settings:h,naturalWidth:w.w,naturalHeight:w.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:he,transformOrigin:"0 0"},children:i.jsx("img",{ref:R,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ce,imageRendering:Ae,...n==="blend"?{opacity:1-o}:{}},onLoad:U=>{const ee=U.currentTarget;T({w:ee.naturalWidth,h:ee.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:U=>{U.stopPropagation(),U.preventDefault();const me=U.currentTarget.parentElement.getBoundingClientRect(),Ee=ve=>{a==null||a(Math.max(0,Math.min(1,(ve.clientX-me.left)/me.width)))},Te=()=>{window.removeEventListener("pointermove",Ee),window.removeEventListener("pointerup",Te)};window.addEventListener("pointermove",Ee),window.addEventListener("pointerup",Te)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&E&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(je,{imageElRef:R,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:l,sample:q,notation:_,version:A})}),e&&w&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(je,{imageElRef:z,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:l,sample:re,notation:_,version:A,onActiveChange:O})})]}):e&&w&&i.jsx(je,{imageElRef:z,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:l,sample:re,notation:_,version:A,onActiveChange:O}),k&&i.jsx(fn,{notation:_,onChange:C})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${x&&!j?" cairn-drag-grip":""}`,draggable:x&&!j,onDragStart:f,style:{cursor:x&&!j?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),g]})]})}function ea(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function ta(e){const t=Et(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function na(e){const{data:t,width:n,height:r,channels:o}=e,a=n*r,s=new Float32Array(a*4),l=u=>Number.isFinite(u)?u:0;for(let u=0;u<a;u++){const d=u*o;let p,g,x,f=1;o===1?p=g=x=l(t[d]):o===3?(p=l(t[d]),g=l(t[d+1]),x=l(t[d+2])):(p=l(t[d]),g=l(t[d+1]),x=l(t[d+2]),f=l(t[d+3]));const v=u*4;s[v]=p,s[v+1]=g,s[v+2]=x,s[v+3]=f}return s}function ra({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,diffSubmode:u,colormap:d="none",diffKernel:p,onDiffKernelChange:g,onCompareModeChange:x,onRequestSide:f,zoom:v,pan:h,onViewportChange:b,interpolation:m="auto",label:w="",pixelValueNotation:M="decimal"}){var ur;const E=c.useRef(null),T=c.useRef(null),_=c.useRef(null),C=c.useRef(null),k=c.useRef(null),[O,z]=c.useState(!1),[R,S]=c.useState(!1),[y,A]=c.useState(null),[I,X]=c.useState(0),[re,q]=c.useState(0),[xe,ye]=c.useState(null),[Ce,Le]=c.useState({x:0,y:0,w:1,h:1}),Ie=p??u??"absolute",[he,Ae]=c.useState(Ie);c.useEffect(()=>{Ae(p??u??"absolute")},[p,u]);const de=c.useCallback(P=>{Ae(P),g==null||g(P)},[g]);c.useEffect(()=>{const P=E.current;if(P)return P.__cairnDiffKernel={current:he,set:de},()=>{P&&delete P.__cairnDiffKernel}},[he,de]);const[j,be]=c.useState(o);c.useEffect(()=>{be(o)},[o]);const ie=c.useCallback(P=>{be(P),x==null||x(P)},[x]),[U,ee]=c.useState(d);c.useEffect(()=>{ee(d)},[d]);const me=c.useRef({mode:o,colormap:d,kernel:p??u??"absolute"}),Ee=c.useCallback(()=>{const P=me.current;ie(P.mode),ee(P.colormap),de(P.kernel)},[ie,de]),Te=j!==me.current.mode||U!==me.current.colormap||he!==me.current.kernel,[ve,Re]=c.useState(0),[F,N]=c.useState(0),K=c.useMemo(()=>{const B=[{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...f?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...rr().map(L=>({id:L.id,label:L.label}))],value:j==="diff"?he:j==="split"?"slide":"blend",onSelect:L=>{L==="side"?f==null||f():L==="slide"?ie("split"):L==="blend"?ie("blend"):(ie("diff"),de(L))}}}];return j==="diff"&&B.push(Gt(U,L=>ee(L))),B},[j,he,U,de,ie,f]),Y=c.useRef(null),Z=c.useRef(null),$=c.useRef(null),Se=c.useRef(null),[D,G]=c.useState(0),H=c.useRef(null),[oe,Q]=c.useState(0),te=Dt();c.useEffect(()=>{const P=_.current;if(!P)return;let ce=!1;return st().then(V=>{if(!ce)try{if(yn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const B=V.createSurface(P,{hdr:!1});C.current={device:V,surface:B,texA:null,texB:null},S(!0)}catch(B){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",B),z(!0)}}).catch(V=>{ce||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",V),z(!0))}),()=>{var B,L;ce=!0;const V=C.current;V&&((B=V.texA)==null||B.destroy(),(L=V.texB)==null||L.destroy(),C.current=null)}},[]),c.useEffect(()=>{const P=E.current;if(!P)return;const ce=new ResizeObserver(()=>q(V=>V+1));return ce.observe(P),()=>ce.disconnect()},[]),c.useEffect(()=>{if(!R)return;let P=!1;if(!C.current)return;async function V(B,L){if(L){const ue=na(L);return{width:L.width,height:L.height,imageData:null,make:ne=>{const Me=ne.createTexture(L.width,L.height,"rgba32float");return Me.write(ue),Me}}}if(!B)return null;const le=await Ze(B);return le?{width:le.width,height:le.height,imageData:le,make:ue=>{const ne=ue.createTexture(le.width,le.height,"rgba8unorm");return ne.write(le.data),ne}}:null}return Promise.all([V(e,n),V(t,r)]).then(([B,L])=>{var ne,Me;if(P||!C.current)return;const le=C.current;Y.current=(B==null?void 0:B.imageData)??null,Z.current=(L==null?void 0:L.imageData)??null,$.current=n??null,Se.current=r??null,(ne=le.texA)==null||ne.destroy(),(Me=le.texB)==null||Me.destroy(),le.texA=null,le.texB=null;const ue=B??L;if(!ue){A(null),G(ke=>ke+1);return}le.texA=(L??ue).make(le.device),le.texB=(B??ue).make(le.device),A({w:ue.width,h:ue.height}),G(ke=>ke+1),X(ke=>ke+1)}),()=>{P=!0}},[R,e,t,n,r]);const we=n!=null||r!=null,ge=c.useMemo(()=>Ts(he,we),[he,we]),se=c.useMemo(()=>{if(!we)return null;const P=r??n;return P?Qs(P.data,P.width,P.height,P.channels):null},[we,r,n]),Be=c.useMemo(()=>{var P;return Ss(((P=Je(ge))==null?void 0:P.displayRange)??"unit",U==="none"?null:U)},[ge,U]),_e=c.useMemo(()=>U!=="none"?ta(U):void 0,[U]),Oe=c.useCallback(()=>{const P=C.current;if(!R||!P||!P.surface||!P.texA||!P.texB||!y)return;const ce=E.current,V=ce?ce.getBoundingClientRect():{width:y.w,height:y.h},B=Xn({zoom:v,pan:h},V,y.w,y.h);Le(ne=>ne.x===B.x&&ne.y===B.y&&ne.w===B.w&&ne.h===B.h?ne:B);const L=_.current;if(V.width>0&&V.height>0&&L&&P.surface){const ne=Math.max(1,Math.round(V.width*te)),Me=Math.max(1,Math.round(V.height*te));(L.width!==ne||L.height!==Me)&&(L.width=ne,L.height=Me,P.surface.configure(ne,Me))}const le=Wn(B,V,y.w,y.h)>=It?"nearest":"linear",ue=B;try{if(j==="diff"){const ne=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Me=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ke=Je(ge)?ge:"absolute",rt=ke==="hdr-flip"&&se?{ppd:67,startExposure:se.startExposure,stopExposure:se.stopExposure,numExposures:se.numExposures}:void 0,tt=Os(P.device,P.texA,P.texB,ke,rt,ne,Me);k.current=tt,$s(P.device,P.surface,tt.texture,tt.displayRange,{uv:ue,cmapMode:Be,colormap:_e,filter:le,exposureEV:ve,offset:F})}else{const ne={exposureEV:ve,offset:F,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ue,filter:le,mode:j,split:a,alpha:s};po(P.device,P.surface,P.texA,P.texB,ne)}}catch(ne){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ne),z(!0)}},[R,y,v,h.x,h.y,j,a,s,ve,F,he,ge,se,Be,_e,e,t,n,r,te]);c.useEffect(()=>{Oe()},[Oe,I,re]);const Ge=t!=null||r!=null;c.useEffect(()=>{const P=C.current;if(!R||!P||!P.texA||!P.texB||!Ge){ye(null);return}let ce=!1;const V=P.texA,B=P.texB,L=k.current;return(j==="diff"&&L?Bs(P.device,L,V,B):wn(P.device,V,B)).then(ue=>{ce||ye(ue)}),()=>{ce=!0}},[R,I,Ge,j,he]),c.useEffect(()=>{if(j!=="diff"){H.current=null;return}const P=C.current,ce=k.current;if(!R||!P||!ce)return;let V=!1;return H.current=null,Q(B=>B+1),Ns(P.device,ce).then(B=>{V||(H.current=B,Q(L=>L+1))}).catch(()=>{}),()=>{V=!0}},[R,j,ge,I]);const qe=(P,ce)=>(V,B,L)=>{const le=ce.current;if(le){const{data:mt,width:dr,height:ua,channels:fr}=le;if(V<0||B<0||V>=dr||B>=ua)return null;const xt=(B*dr+V)*fr,pr=.5;return fr===1?{lines:[J(mt[xt]??0,"unit",L)],luminance:pr}:{lines:[J(mt[xt]??0,"unit",L),J(mt[xt+1]??0,"unit",L),J(mt[xt+2]??0,"unit",L)],luminance:pr,colors:[pe[0],pe[1],pe[2]]}}const ue=P.current;if(!ue||V<0||B<0||V>=ue.width||B>=ue.height)return null;const ne=(B*ue.width+V)*4,Me=ue.data[ne],ke=ue.data[ne+1],rt=ue.data[ne+2],tt=(.299*Me+.587*ke+.114*rt)/255;return Me===ke&&ke===rt?{lines:[J(Me,"uint8",L)],luminance:tt}:{lines:[J(Me,"uint8",L),J(ke,"uint8",L),J(rt,"uint8",L)],luminance:tt,colors:[pe[0],pe[1],pe[2]]}},Ve=c.useMemo(()=>qe(Y,$),[]),aa=c.useMemo(()=>qe(Z,Se),[]),ia=c.useMemo(()=>(P,ce,V)=>{var ke;const B=H.current;if(!B||!y)return null;const{w:L,h:le}=y;if(P<0||ce<0||P>=L||ce>=le)return null;const ue=(ce*L+P)*4,ne=((ke=Je(ge))==null?void 0:ke.output)??"per-channel",Me=.5;return ne==="scalar"?{lines:[J(B[ue]??0,"unit",V)],luminance:Me}:{lines:[J(B[ue]??0,"unit",V),J(B[ue+1]??0,"unit",V),J(B[ue+2]??0,"unit",V)],luminance:Me,colors:[pe[0],pe[1],pe[2]]}},[y,ge]),ca=m==="auto"?void 0:m;if(O)return n!=null||r!=null?i.jsx(ea,{}):j==="diff"?i.jsx(Vt,{imageUrl:e,baselineUrl:t,diffMode:((ur=Je(ge))==null?void 0:ur.kind)==="pointwise"?ge:"absolute",interpolation:m,colormap:U,showAxes:!1,zoom:v,pan:h,onViewportChange:b,label:w,pixelValueNotation:M}):i.jsx(Js,{imageUrl:e,baselineUrl:t,mode:j,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,zoom:v,pan:h,onViewportChange:b,interpolation:m,label:w,pixelValueNotation:M});const la=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:_,className:"w-full h-full block",style:{imageRendering:ca},"data-gpu-compare-canvas":!0}),j==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:P=>{P.stopPropagation(),l==null||l(.5)},onPointerDown:P=>{P.stopPropagation(),P.preventDefault();const V=P.currentTarget.parentElement.getBoundingClientRect(),B=le=>{l==null||l(Math.max(0,Math.min(1,(le.clientX-V.left)/V.width)))},L=()=>{window.removeEventListener("pointermove",B),window.removeEventListener("pointerup",L)};window.addEventListener("pointermove",B),window.addEventListener("pointerup",L)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(ut,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":R},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:E,wrapperRef:T,zoom:v,pan:h,onViewportChange:b,naturalDims:y,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:la,showAxes:!1,notationSeed:M,onReset:Ee,extraModified:Te,exportCanvasRef:_,requestRender:Oe,leadingMenus:K,displayAdjust:{exposureEV:ve,offset:F,onExposureChange:Re,onOffsetChange:N},label:"",showLabelChip:!1,overlay:{render:({notation:P,setOverlayActive:ce})=>j==="split"?i.jsxs(i.Fragment,{children:[Ge&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(je,{imageElRef:_,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:Ce,sample:aa,notation:P,version:D})}),Ge&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(je,{imageElRef:_,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:Ce,sample:Ve,notation:P,version:D,onActiveChange:ce})})]}):y&&i.jsx(je,{imageElRef:_,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:Ce,sample:j==="diff"?ia:Ve,notation:P,version:j==="diff"?oe:D,onActiveChange:ce})},extraChips:i.jsxs(i.Fragment,{children:[j==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),w?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:w}):null,xe&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${w?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",xe.mse.toExponential(2)," · PSNR ",Number.isFinite(xe.psnr)?xe.psnr.toFixed(1):"∞"," dB · MAE"," ",xe.mae.toExponential(2)]})]})})}const oa="cairn-plot:gpu-image-ready";async function sa(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await st(),window.__cairnPlotGpuImagePane=os,window.__cairnPlotGpuComparePane=ra,window.__cairnPlotDiffMenuModes=rr(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(oa))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),$n("no-webgpu")}}}sa()})(__cairnPlotJsxRuntime,__cairnPlotReact);
