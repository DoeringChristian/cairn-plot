var Yo=Object.defineProperty;var Ho=(i,c,Ce)=>c in i?Yo(i,c,{enumerable:!0,configurable:!0,writable:!0,value:Ce}):i[c]=Ce;var j=(i,c,Ce)=>Ho(i,typeof c!="symbol"?c+"":c,Ce);(function(i,c){"use strict";const Ce=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function St(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Ce}),{hdr:!1,format:n}}function Tn(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Ce}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Ce}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return St(e,t)}}}const Sn=`
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
`;function Qe(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Pt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Pn(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const An={texture:0,sampler:1,uniform:2};function Je(e,t){return e*3+An[t]}const Cn={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Rn(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const d=Cn[s];if(d===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:d})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class At{constructor(t,n,r,o){j(this,"width");j(this,"height");j(this,"format");j(this,"gpuTexture");j(this,"device");j(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Qe(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Pt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Ct{constructor(t){j(this,"_s");j(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class kn{constructor(t,n,r,o,a){j(this,"_p");j(this,"gpuPipeline");j(this,"bindings");j(this,"bindGroupLayout");j(this,"variants");j(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Ln(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Dn{constructor(t){j(this,"_c");j(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class In{constructor(t,n){j(this,"_b");j(this,"gpuBindGroup");j(this,"ownedBuffers");j(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Bn{constructor(t,n,r,o){j(this,"canvas");j(this,"hdr");j(this,"format");j(this,"context");j(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function $e(e){return"canvas"in e}async function Un(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(l){return $e(l)?l.getCurrentTextureView():l.gpuTexture.createView()}function s(l){if($e(l))return{width:l.canvas.width,height:l.canvas.height};const w=l;return{width:w.width,height:w.height}}let d=!1;const f=256;let u=null,h=null;function x(){if(!u||!h){const l=t.createShaderModule({code:Sn});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const w=t.createPipelineLayout({bindGroupLayouts:[h]});u=t.createComputePipeline({layout:w,compute:{module:l,entryPoint:"cs_main"}})}return{pipeline:u,layout:h}}return{backend:"webgpu",capabilities:n,createTexture(l,w,m){return new At(t,l,w,m)},createSampler(l){const w=(l==null?void 0:l.filter)==="linear"?"linear":"nearest",m=t.createSampler({magFilter:w,minFilter:w,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Ct(m)},createRenderPipeline(l){const w=t.createShaderModule({code:l.shaderWGSL}),m=Rn(l.shaderWGSL),v=Qe(l.targetFormat),p=Ln(t,m),g=t.createPipelineLayout({bindGroupLayouts:[p]}),_=M=>t.createRenderPipeline({layout:g,vertex:{module:w,entryPoint:"vs_main"},fragment:{module:w,entryPoint:"fs_main",targets:[{format:M}]},primitive:{topology:"triangle-list"}}),E=_(v);return new kn(E,m,p,v,_)},createComputePipeline(l){const w=t.createShaderModule({code:l.shaderWGSL}),m=t.createComputePipeline({layout:"auto",compute:{module:w,entryPoint:"cs_main"}});return new Dn(m)},createBindGroup(l,w){const m=l,v=new Map,p=[];for(const[_,E]of m.bindings)if(E.kind==="uniform"){const M=t.createBuffer({size:E.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});p.push(M),v.set(_,{binding:_,resource:{buffer:M}})}else E.kind==="sampler"&&v.set(_,{binding:_,resource:o()});for(const _ of w){const E=_.resource;if(E instanceof At){const M=Je(_.binding,"texture");m.bindings.has(M)&&v.set(M,{binding:M,resource:E.gpuTexture.createView()})}else if(E instanceof Ct){const M=Je(_.binding,"sampler");m.bindings.has(M)&&v.set(M,{binding:M,resource:E.gpuSampler})}else{const M=Je(_.binding,"uniform"),T=m.bindings.get(M);if(T&&T.kind==="uniform"){const S=E.uniform,R=t.createBuffer({size:Math.max(T.sizeBytes,S.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(R,0,S.buffer,S.byteOffset,S.byteLength),p.push(R),v.set(M,{binding:M,resource:{buffer:R}})}}}const g=t.createBindGroup({layout:m.bindGroupLayout,entries:Array.from(v.values())});return new In(g,p)},createSurface(l,w){const m=l.getContext("webgpu");if(!m)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const v=w.hdr&&n.hdr,p=()=>v?Tn(m,t):St(m,t),g=p();return new Bn(l,m,g,p)},renderFullscreen(l,w,m){const v=w,p=m,g=a(l),{width:_,height:E}=s(l),M=$e(l)?l.format:Qe(l.format),T=v.pipelineFor(M),S=t.createCommandEncoder(),R=S.beginRenderPass({colorAttachments:[{view:g,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});R.setPipeline(T),R.setBindGroup(0,p.gpuBindGroup),R.setViewport(0,0,_,E,0,1),R.draw(3),R.end(),t.queue.submit([S.finish()])},async readback(l){const w=$e(l),{width:m,height:v}=s(l),p=w?l.hdr?"rgba16float":"rgba8unorm":l.format,g=w&&l.format==="bgra8unorm",_=w?l.getCurrentGPUTexture():l.gpuTexture,E=Pt(p),M=m*E,T=256,S=Math.ceil(M/T)*T,R=S*v,C=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),I=t.createCommandEncoder();I.copyTextureToBuffer({texture:_},{buffer:C,bytesPerRow:S,rowsPerImage:v},{width:m,height:v,depthOrArrayLayers:1}),t.queue.submit([I.finish()]),await C.mapAsync(GPUMapMode.READ);const V=new Uint8Array(C.getMappedRange()),P=new Uint8Array(M*v);for(let G=0;G<v;G++){const X=G*S,F=G*M;P.set(V.subarray(X,X+M),F)}if(C.unmap(),C.destroy(),p==="rgba8unorm"){if(g)for(let G=0;G<P.length;G+=4){const X=P[G],F=P[G+2];P[G]=F,P[G+2]=X}return P}if(p==="rgba16float"){const G=new Uint16Array(P.buffer,P.byteOffset,P.byteLength/2),X=new Float32Array(G.length);for(let F=0;F<G.length;F++)X[F]=Pn(G[F]);return X}return new Float32Array(P.buffer,P.byteOffset,P.byteLength/4)},async reduceDiffSumSquaredAbs(l,w,m,v){const p=l,g=w,_=Math.max(0,m*v),E=Math.max(1,Math.ceil(_/f)),{pipeline:M,layout:T}=x(),S=E*2*4,R=t.createBuffer({size:S,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),C=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(C,0,new Uint32Array([Math.max(1,m),Math.max(1,v),_,0]));const I=t.createBindGroup({layout:T,entries:[{binding:0,resource:p.gpuTexture.createView()},{binding:1,resource:g.gpuTexture.createView()},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:C}}]}),V=t.createBuffer({size:S,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),P=t.createCommandEncoder(),G=P.beginComputePass();G.setPipeline(M),G.setBindGroup(0,I),G.dispatchWorkgroups(E),G.end(),P.copyBufferToBuffer(R,0,V,0,S),t.queue.submit([P.finish()]),await V.mapAsync(GPUMapMode.READ);const F=new Float32Array(V.getMappedRange()).slice();V.unmap(),V.destroy(),R.destroy(),C.destroy();let Q=0,le=0;for(let ue=0;ue<E;ue++)Q+=F[ue*2],le+=F[ue*2+1];return{sumSq:Q,sumAbs:le}},destroy(){d||(t.destroy(),d=!0)},isContextLost(){return!1}}}let et=null;async function On(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Un()}function Xe(){return et||(et=On()),et}function Gn(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Fn(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),d=o-a,[f,u,h]=Gn(e[a],e[s],d);t[n*3]=Math.round(f),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(h)}return t}const Rt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},kt=new Set(["red-green","red-blue"]),Lt=new Map;function tt(e){let t=Lt.get(e);if(!t){const n=Rt[e]??Rt.viridis;t=Fn(n),Lt.set(e,t)}return t}function nt(e,t,n="linear"){const r=tt(t),o=new ImageData(e.width,e.height),a=e.data,s=o.data;for(let d=0;d<a.length;d+=4){const f=(a[d]+a[d+1]+a[d+2])/3;let u;n==="positive"?u=Math.round(128+f/255*127):u=Math.round(f),u=Math.max(0,Math.min(255,u)),s[d]=r[u*3],s[d+1]=r[u*3+1],s[d+2]=r[u*3+2],s[d+3]=a[d+3]}return o}function Dt(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const It=Dt(50);function rt(e){return It.get(e)}function ot(e,t){It.set(e,t)}const Bt=Dt(100);function Nn(e){return Bt.get(e)}function zn(e,t){Bt.set(e,t)}function Vn(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let d=0;d<r;d++){const f=(s*e.width+d)*4,u=(s*t.width+d)*4,h=(s*r+d)*4;for(let x=0;x<3;x++){const y=e.data[f+x],l=t.data[u+x],w=y-l,m=Math.abs(w),v=Math.max(y,1);let p;switch(n){case"signed":p=(w+255)/2;break;case"absolute":p=m;break;case"squared":p=w*w/255;break;case"relative_signed":p=(w/v+1)*127.5;break;case"relative_absolute":p=m/v*255;break;case"relative_squared":p=w*w/(v*v)*255;break}a.data[h+x]=Math.min(255,Math.max(0,Math.round(p)))}a.data[h+3]=255}return a}async function Le(e){const t=Nn(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);zn(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const $n={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Xn={linear:0,signed:1,positive:2},Wn=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Yn=`#version 300 es
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
}`;let De=null,Y=null,we=null,We=null;function Hn(){if(Y)return Y;try{if(typeof OffscreenCanvas<"u"?De=new OffscreenCanvas(1,1):De=document.createElement("canvas"),Y=De.getContext("webgl2",{preserveDrawingBuffer:!0}),!Y)return console.warn("[cairn] WebGL 2 not available"),null;const e=Y.createShader(Y.VERTEX_SHADER);if(Y.shaderSource(e,Wn),Y.compileShader(e),!Y.getShaderParameter(e,Y.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Y.getShaderInfoLog(e)),null;const t=Y.createShader(Y.FRAGMENT_SHADER);if(Y.shaderSource(t,Yn),Y.compileShader(t),!Y.getShaderParameter(t,Y.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Y.getShaderInfoLog(t)),null;if(we=Y.createProgram(),Y.attachShader(we,e),Y.attachShader(we,t),Y.linkProgram(we),!Y.getProgramParameter(we,Y.LINK_STATUS))return console.error("[cairn] WebGL program link:",Y.getProgramInfoLog(we)),null;We=Y.createVertexArray(),Y.bindVertexArray(We);const n=Y.createBuffer();Y.bindBuffer(Y.ARRAY_BUFFER,n),Y.bufferData(Y.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Y.STATIC_DRAW);const r=Y.getAttribLocation(we,"a_pos");return Y.enableVertexAttribArray(r),Y.vertexAttribPointer(r,2,Y.FLOAT,!1,0,0),Y.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Y}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Ut(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function qn(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Kn(e,t,n,r){const o=Hn();if(!o||!we||!We||!De)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);De.width=a,De.height=s,o.viewport(0,0,a,s);const d=Ut(o,e,0),f=Ut(o,t,1);let u=null;n.colormap?u=qn(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(we),o.uniform1i(o.getUniformLocation(we,"u_baseline"),0),o.uniform1i(o.getUniformLocation(we,"u_other"),1),o.uniform1i(o.getUniformLocation(we,"u_lut"),2),o.uniform1i(o.getUniformLocation(we,"u_diff_mode"),$n[n.diffMode]),o.uniform1i(o.getUniformLocation(we,"u_cmap_mode"),Xn[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(we,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(We),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const h=r.getContext("2d");return h&&(h.save(),h.scale(1,-1),h.drawImage(De,0,0,a,s,0,-s,a,s),h.restore()),o.deleteTexture(d),o.deleteTexture(f),o.deleteTexture(u),{width:a,height:s}}const Zn="cairn:render-mode";function jn(){try{const e=localStorage.getItem(Zn);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Te=e=>e<0?0:e>1?1:e,at=e=>{const t=e<0?0:e;return t/(1+t)},st=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Te(n/r)},Ot={linear:([e,t,n])=>[Te(e),Te(t),Te(n)],srgb:([e,t,n])=>[Te(e),Te(t),Te(n)],reinhard:([e,t,n])=>[at(e),at(t),at(n)],aces:([e,t,n])=>[st(e),st(t),st(n)],extended:([e,t,n])=>[e,t,n]},Qn="srgb";function Jn(e){return e&&Ot[e]||Ot[Qn]}function it(e,t){return e*2**t}function er(e){const t=Te(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function ct(e,t){return typeof t=="number"&&t>0?Te(Math.pow(Te(e),1/t)):er(e)}const Se=new Uint32Array(512),Pe=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Se[e]=0,Se[e|256]=32768,Pe[e]=24,Pe[e|256]=24):t<-14?(Se[e]=1024>>-t-14,Se[e|256]=1024>>-t-14|32768,Pe[e]=-t-1,Pe[e|256]=-t-1):t<=15?(Se[e]=t+15<<10,Se[e|256]=t+15<<10|32768,Pe[e]=13,Pe[e|256]=13):t<128?(Se[e]=31744,Se[e|256]=64512,Pe[e]=24,Pe[e|256]=24):(Se[e]=31744,Se[e|256]=64512,Pe[e]=13,Pe[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Ne=Uint8Array,Gt=Uint16Array,tr=Int32Array,nr=new Ne([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),rr=new Ne([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Ft=function(e,t){for(var n=new Gt(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new tr(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},Nt=Ft(nr,2),or=Nt.b,ar=Nt.r;or[28]=258,ar[258]=28,Ft(rr,0);for(var sr=new Gt(32768),ee=0;ee<32768;++ee){var Re=(ee&43690)>>1|(ee&21845)<<1;Re=(Re&52428)>>2|(Re&13107)<<2,Re=(Re&61680)>>4|(Re&3855)<<4,sr[ee]=((Re&65280)>>8|(Re&255)<<8)>>1}for(var Ye=new Ne(288),ee=0;ee<144;++ee)Ye[ee]=8;for(var ee=144;ee<256;++ee)Ye[ee]=9;for(var ee=256;ee<280;++ee)Ye[ee]=7;for(var ee=280;ee<288;++ee)Ye[ee]=8;for(var ir=new Ne(32),ee=0;ee<32;++ee)ir[ee]=5;var cr=new Ne(0),lr=typeof TextDecoder<"u"&&new TextDecoder,ur=0;try{lr.decode(cr,{stream:!0}),ur=1}catch{}const zt=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function lt(e){const t=zt.length;return zt[(e%t+t)%t]}function dr(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),d=c.useRef(null),f=c.useCallback((u,h)=>{o(x=>x.w===u&&x.h===h?x:{w:u,h})},[]);return c.useLayoutEffect(()=>{const u=n.current;if(!u||u===d.current)return;const h=u.getBoundingClientRect();(h.width>0||h.height>0)&&(d.current=u,f(h.width,h.height))}),c.useEffect(()=>{var x;const u=n.current;if(u===s.current||((x=a.current)==null||x.disconnect(),a.current=null,s.current=u,!u))return;const h=new ResizeObserver(y=>{for(const l of y)f(l.contentRect.width,l.contentRect.height)});a.current=h,h.observe(u)}),c.useEffect(()=>()=>{var u;return(u=a.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function fr(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const pr=.25,ut=64;function Vt(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return ut;const o=Math.min(n/e,r/t);return o<=0?ut:Math.max(Math.max(n,r)/o,8)}function $t(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=pr,maxZoom:s=ut,naturalWidth:d,naturalHeight:f}=e,u=fr(),h=c.useRef(u);h.current=u;const x=c.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const y=c.useRef(o);y.current=o,c.useEffect(()=>{const g=t.current;if(!g||!o)return;const _=E=>{var X;if(!h.current)return;E.preventDefault(),E.stopPropagation();const M=E.deltaY<0?1.1:1/1.1,T=x.current,S=g.getBoundingClientRect(),R=d&&f?Vt(d,f,S.width,S.height):s,C=Math.max(a,Math.min(R,T.zoom*M));if(T.zoom===C)return;const I=E.clientX-S.left,V=E.clientY-S.top,P=I-(I-T.pan.x)/T.zoom*C,G=V-(V-T.pan.y)/T.zoom*C;(X=y.current)==null||X.call(y,{zoom:C,pan:{x:P,y:G}})};return g.addEventListener("wheel",_,{passive:!1}),()=>g.removeEventListener("wheel",_)},[t,!!o,a,s,d,f]);const l=c.useRef(null),w=c.useCallback(g=>{!h.current||!y.current||(g.currentTarget.setPointerCapture(g.pointerId),l.current={pointerId:g.pointerId,startX:g.clientX,startY:g.clientY,panX:x.current.pan.x,panY:x.current.pan.y})},[]),m=c.useCallback(g=>{var T;const _=l.current;if(!_||_.pointerId!==g.pointerId)return;const E=g.clientX-_.startX,M=g.clientY-_.startY;(T=y.current)==null||T.call(y,{zoom:x.current.zoom,pan:{x:_.panX+E,y:_.panY+M}})},[]),v=c.useCallback(g=>{const _=l.current;if(!(!_||_.pointerId!==g.pointerId)){try{g.currentTarget.releasePointerCapture(g.pointerId)}catch{}l.current=null}},[]),p=u&&!!o;return{containerProps:{onPointerDown:w,onPointerMove:m,onPointerUp:v,onPointerCancel:v,style:{cursor:p?"move":void 0,touchAction:p?"none":void 0}},modifierActive:u}}function dt(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function hr(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Xt(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function ft({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=dr(),s=c.useRef(null),d=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),f=c.useMemo(()=>{const m=a.w,v=a.h;if(m<=0||v<=0||n<=0||r<=0)return null;const p=Math.min(m/n,v/r),g=n*p,_=r*p;return{left:(m-g)/2,top:(v-_)/2,width:g,height:_}},[a.w,a.h,n,r]),u=e.masks,h=t.showMasks&&!!u&&u.length>0,x=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!h||!u)return;const m=s.current;if(!m)return;(m.width!==n||m.height!==r)&&(m.width=n,m.height=r);const v=m.getContext("2d");if(!v)return;v.clearRect(0,0,m.width,m.height);let p=!1;const g=v.createImageData(n,r),_=g.data;let E=u.length,M=!1;const T=()=>{p||M&&v.putImageData(g,0,0)},S=document.createElement("canvas");S.width=n,S.height=r;const R=S.getContext("2d",{willReadFrequently:!0});for(const C of u){const I=new Image;I.onload=()=>{if(!p){if(R){R.clearRect(0,0,n,r),R.drawImage(I,0,0,n,r);const V=R.getImageData(0,0,n,r).data;for(let P=0;P<n*r;P++){const G=V[P*4];if(G===0||d.has(G))continue;const[X,F,Q]=hr(lt(G));_[P*4]=X,_[P*4+1]=F,_[P*4+2]=Q,_[P*4+3]=255,M=!0}}E-=1,E===0&&T()}},I.onerror=()=>{E-=1,E===0&&T()},I.src=`data:image/png;base64,${C.png_b64}`}return()=>{p=!0}},[h,u,n,r,x]),!f)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const y=e.boxes??[],l=t.showBoxes&&y.length>0,w=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[h&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),l&&i.jsx("svg",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:y.map((m,v)=>{if(!Xt(m,t,d))return null;const p=m.domain==="pixel"?1:n,g=m.domain==="pixel"?1:r,_=m.position.minX*p,E=m.position.minY*g,M=(m.position.maxX-m.position.minX)*p,T=(m.position.maxY-m.position.minY)*g;return i.jsx("rect",{x:_,y:E,width:M,height:T,fill:"none",stroke:lt(m.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},v)})}),l&&i.jsx("div",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height},children:y.map((m,v)=>{if(!Xt(m,t,d))return null;const p=m.domain==="pixel"?1/n:1,g=m.domain==="pixel"?1/r:1,_=m.position.minX*p*100,E=m.position.minY*g*100,M=m.label??w[String(m.class_id)]??`#${m.class_id}`,T=m.score!=null?` ${(m.score*100).toFixed(0)}%`:"";return!M&&!T?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${_}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:lt(m.class_id)},children:i.jsxs("span",{className:"mono",children:[M,T]})},v)})})]})}const pt=30,fe=["#ff5a5a","#39d353","#5b9bff"];function ht(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function ne(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):ht(e/255):ht(n==="int"?e*255:e)}const gr={x:0,y:0,w:1,h:1};function Ie({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:d=0,onActiveChange:f,sourceWindow:u=gr}){const h=c.useRef(null),x=c.useRef(!1),y=dt(),l=c.useRef(f);l.current=f;const w=c.useCallback(v=>{var p;v!==x.current&&(x.current=v,(p=l.current)==null||p.call(l,v))},[]),m=c.useCallback(()=>{var _e;const v=h.current,p=e.current;if(!v)return;const g=window.devicePixelRatio||1,_=v.clientWidth,E=v.clientHeight;if(_===0||E===0)return;v.width!==Math.round(_*g)&&(v.width=Math.round(_*g)),v.height!==Math.round(E*g)&&(v.height=Math.round(E*g));const M=v.getContext("2d");if(!M)return;if(M.setTransform(g,0,0,g,0,0),M.clearRect(0,0,_,E),!p||t<=0||n<=0){w(!1);return}const T=p.getBoundingClientRect(),S=v.getBoundingClientRect();if(T.width===0||T.height===0){w(!1);return}const R=u.x*t,C=u.y*n,I=u.w*t,V=u.h*n;if(I<=0||V<=0){w(!1);return}const P=Math.min(T.width/I,T.height/V);if(P<pt){w(!1);return}const G=I*P,X=V*P,F=T.left+(T.width-G)/2-S.left,Q=T.top+(T.height-X)/2-S.top,le=Math.max(Math.floor(R),Math.floor(R+(0-F)/P)),ue=Math.min(Math.ceil(R+I),Math.ceil(R+(_-F)/P)),Ee=Math.max(Math.floor(C),Math.floor(C+(0-Q)/P)),te=Math.min(Math.ceil(C+V),Math.ceil(C+(E-Q)/P));if(ue<=le||te<=Ee){w(!1);return}w(!0);const pe=F+(0-R)*P,he=Q+(0-C)*P,re=F+(t-R)*P,ie=Q+(n-C)*P;M.save(),M.beginPath(),M.rect(pe,he,re-pe,ie-he),M.clip(),M.textAlign="center",M.textBaseline="middle",M.lineJoin="round";const se=P*.14,ye=P-se*2;for(let be=Ee;be<te;be++)for(let ge=le;ge<ue;ge++){if(ge<0||be<0||ge>=t||be>=n)continue;const H=a(ge,be,s);if(!H||H.lines.length===0)continue;const k=H.lines.length;let U=1;for(const b of H.lines)b.length>U&&(U=b.length);const N=ye/(k*1.15),O=ye/(U*.62)||N,z=Math.min(N,O,24);if(z<6)continue;const $=F+(ge-R+.5)*P,ae=Q+(be-C+.5)*P,ce=z*1.15,oe=H.luminance<=.55,de=oe?"#ffffff":"#000000";M.font=`${z}px ui-monospace, SFMono-Regular, Menlo, monospace`,M.lineWidth=Math.max(1.4,z*.16),M.strokeStyle=oe?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let me=ae-k*ce/2+ce/2;for(let b=0;b<H.lines.length;b++){const B=H.lines[b];M.strokeText(B,$,me),M.fillStyle=((_e=H.colors)==null?void 0:_e[b])??de,M.fillText(B,$,me),me+=ce}}M.restore()},[e,t,n,a,s,w,u]);return c.useEffect(()=>{m()},[m,r,o.x,o.y,d,s,u,y]),c.useEffect(()=>{const v=h.current;if(!v)return;const p=new ResizeObserver(()=>m());return p.observe(v),()=>p.disconnect()},[m]),i.jsx("canvas",{ref:h,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Wt({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const mr=`
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

  // 1) exposure, in scene-linear space: v * 2^EV.
  var rgb = sampled.rgb * exp2(exposureEV);

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
`,Oe=`
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
`,Yt=`
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
`,vr=`
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

// Per-side exposure -> [scalar LUT] -> operator -> encode. The lut is only
// read when isScalar. Verbatim behavior from compare.wgsl.ts's processSide.
fn processSide(lut: texture_2d<f32>, sampled: vec4<f32>, exposureEV: f32, operatorId: i32, gamma: f32, isScalar: bool, hdrOut: bool) -> vec3<f32> {
  var rgb = sampled.rgb * exp2(exposureEV);
  if (isScalar) { rgb = sampleLUT(lut, rgb.x); }
  rgb = applyOperator(rgb, operatorId);
  if (hdrOut) { return rgb; }
  let hasGamma = gamma > 0.0;
  return vec3<f32>(outputEncodeF(rgb.r, gamma, hasGamma), outputEncodeF(rgb.g, gamma, hasGamma), outputEncodeF(rgb.b, gamma, hasGamma));
}
`,Ht=`
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
fn flip_rgb2ycxcz(srgb: vec3<f32>) -> vec3<f32> {
  let lin = vec3<f32>(flip_srgb2linear(srgb.r), flip_srgb2linear(srgb.g), flip_srgb2linear(srgb.b));
  let xyz = M_RGB2XYZ * lin;
  let n = xyz * WHITE_INV;
  return vec3<f32>(116.0 * n.y - 16.0, 500.0 * (n.x - n.y), 200.0 * (n.y - n.z));
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
`;function qt(e){return`
${Oe}
${Yt}
${vr}

@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(6) var lut: texture_2d<f32>;
@group(0) @binding(11) var<uniform> u_img: vec4<f32>;     // exposureEV, operatorId, gamma, isScalar
@group(0) @binding(14) var<uniform> u_uv: vec4<f32>;      // uvRect.xy, uvRect.wh
@group(0) @binding(17) var<uniform> u_compose: vec4<f32>; // split, alpha, hdrOut, filterMode

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

  let colorA = processSide(lut, sampledA, exposureEV, operatorId, gamma, isScalar, hdrOut);
  let colorB = processSide(lut, sampledB, exposureEV, operatorId, gamma, isScalar, hdrOut);

  let split = u_compose.x;
  let alpha = u_compose.y;
  let outColor = ${e};
  return vec4<f32>(outColor, 1.0);
}
`}const xr=qt("select(colorB, colorA, uv.x < split)"),br=qt("mix(colorA, colorB, alpha)"),gt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Kt=new WeakMap;function wr(e,t){let n=Kt.get(e);n||(n=new Map,Kt.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:mr,targetFormat:t}),n.set(t,r)),r}function Zt(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function jt(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function yr(e,t,n,r){var w;const o=Zt(t),a=wr(e,o),s=jt(e,r.isScalar?r.colormap:void 0),d=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,f=gt[r.operator]??gt.srgb,u=new Float32Array([r.exposureEV,f,d,r.isScalar?1:0]),h=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),y=new Float32Array([r.filter==="nearest"?0:1]);let l;try{l=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:y}}]),e.renderFullscreen(t,a,l)}finally{(w=l==null?void 0:l.destroy)==null||w.call(l),s.destroy()}}const Qt=new WeakMap;function Er(e,t,n){let r=Qt.get(e);r||(r=new Map,Qt.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?xr:br,targetFormat:n}),r.set(o,a)),a}function _r(e,t,n,r,o){var w;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Zt(t),s=Er(e,o.mode,a),d=jt(e,void 0),f=o.gamma,u=gt[o.operator],h=new Float32Array([o.exposureEV,u,f,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),y=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]);let l;try{l=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:d},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:y}}]),e.renderFullscreen(t,s,l)}finally{(w=l==null?void 0:l.destroy)==null||w.call(l),d.destroy()}}function Jt(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function en(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:y,sumAbs:l}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return Jt(y,l,a)}const s=await e.readback(t),d=await e.readback(n),f=s instanceof Uint8Array,u=d instanceof Uint8Array;let h=0,x=0;for(let y=0;y<o;y++)for(let l=0;l<r;l++){const w=(y*t.width+l)*4,m=(y*n.width+l)*4;for(let v=0;v<3;v++){const p=(s[w+v]??0)/(f?255:1),g=(d[m+v]??0)/(u?255:1),_=p-g;h+=_*_,x+=Math.abs(_)}}return Jt(h,x,a)}function tn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Mr=12,ke=[];function nn(e){const t=ke.indexOf(e);t!==-1&&ke.splice(t,1),ke.push(e)}function Tr(e){const t=ke.indexOf(e);t!==-1&&ke.splice(t,1)}function He(e){e.parked||(Tr(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function rn(e){for(;ke.length>Mr;){const t=ke.find(n=>n!==e&&!n.visible)??ke.find(n=>n!==e);if(!t)break;He(t)}}function on(e){var o,a;if(e.disposed)return;if(tn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){nn(e),rn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,nn(e),rn(e)}function Sr(e,t){if(e.disposed||!e.source)return!0;try{return on(e),!e.surface||!e.srcTexture?!1:(yr(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,He(e),!1}}function Pr(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Sr(e,t)},park(){e.disposed||He(e)},restore(){e.disposed||!e.source||on(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(He(e),e.source=null,e.disposed=!0)}}}async function Ar(e,t){const n=await Xe(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Pr(r)}function an(e){e.dispose()}function Cr(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function sn(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:d,flipSign:f}=e,u=c.useMemo(()=>Cr(e,n),[n,r,o,s,f]);return{gammaFilterId:n,filterStr:u,gamma:a,offset:d}}function cn({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function ln(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Rr({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=ln(e),a=ln(t),s=[];for(let g=0;g<=e;g+=o)s.push(g);const d=[];for(let g=0;g<=t;g+=a)d.push(g);const f=1/n,u=8*f,h=-12*f,x=-2*f,y=r==null?void 0:r.current;let l=0,w=0,m=0,v=0;if(y){const g=y.clientWidth,_=y.clientHeight,E=g/e,M=_/t,T=Math.min(E,M);m=e*T,v=t*T,l=(g-m)/2,w=(_-v)/2}const p=y&&m>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:p?w:0,transform:`translateY(${h}px)`,fontSize:u},children:s.map(g=>i.jsx("span",{className:"mono",style:{position:"absolute",left:p?l+g/e*m:`${g/e*100}%`,transform:"translateX(-50%)"},children:g},g))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:p?l:0,transform:`translateX(${x}px)`,fontSize:u},children:d.map(g=>i.jsx("span",{className:"mono",style:{position:"absolute",top:p?w+g/t*v:`${g/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*f}px`},children:g},g))})]})}function kr({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Lr=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function un(e,t){const n=getComputedStyle(e),r=Lr.map(f=>`${f}:${n.getPropertyValue(f)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,d=Math.min(a.length,s.length);for(let f=0;f<d;f++)un(a[f],s[f])}function mt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function vt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function xt(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((d,f)=>a.toBlob(u=>u?d(u):f(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Dr(e,t,n){const r=e.cloneNode(!0);un(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,d)=>{const f=new Image;f.onload=()=>s(f),f.onerror=()=>d(new Error("plot-to-png: SVG rasterization failed")),f.src=a})}async function dn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??mt(e);return xt(r,o,vt(t),a,s=>s.drawImage(e,0,0,r,o))}async function Ir(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??mt(e);try{return await xt(r,o,vt(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Br(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function Ur(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,d=(t==null?void 0:t.background)??mt(e);if(n){const u=n.getBoundingClientRect(),h=await Dr(n,u.width||a,u.height||s);return xt(a,s,vt(t),d,x=>{for(const y of r){const l=y.getBoundingClientRect();x.drawImage(y,l.left-o.left,l.top-o.top,l.width,l.height)}x.drawImage(h,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return dn(r[0],t);const f=Br(e);if(f)return Ir(f,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Or(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Gr={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Fr={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"})};function bt({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Fr[e]??null})}function Ae({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(bt,{name:e??""})})}function qe(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Nr({icon:e,title:t,menu:n}){var v;const{options:r,value:o,onSelect:a}=n,[s,d]=c.useState(!1),[f,u]=c.useState(0),h=c.useRef(null),x=Math.max(0,r.findIndex(p=>p.id===o)),y=e?void 0:((v=r[x])==null?void 0:v.label)??"",l=c.useCallback(()=>{d(p=>{const g=!p;return g&&u(x),g})},[x]),w=c.useCallback(p=>{a(p),d(!1)},[a]);c.useEffect(()=>{if(!s)return;const p=_=>{h.current&&!h.current.contains(_.target)&&d(!1)},g=_=>{_.key==="Escape"&&(_.stopPropagation(),d(!1))};return document.addEventListener("pointerdown",p,!0),document.addEventListener("keydown",g,!0),()=>{document.removeEventListener("pointerdown",p,!0),document.removeEventListener("keydown",g,!0)}},[s]);const m=p=>{if(!s){(p.key==="ArrowDown"||p.key==="Enter"||p.key===" ")&&(p.preventDefault(),u(x),d(!0));return}if(p.key==="ArrowDown")p.preventDefault(),u(g=>(g+1)%r.length);else if(p.key==="ArrowUp")p.preventDefault(),u(g=>(g-1+r.length)%r.length);else if(p.key==="Enter"||p.key===" "){p.preventDefault();const g=r[f];g&&w(g.id)}};return i.jsxs("div",{ref:h,className:"relative inline-flex",onPointerDown:p=>p.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:p=>{p.stopPropagation(),l()},onDoubleClick:p=>p.stopPropagation(),onKeyDown:m,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",y?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[y?i.jsx("span",{"aria-hidden":"true",children:y}):i.jsx(bt,{name:e??""}),i.jsx(bt,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((p,g)=>{const _=p.id===o,E=g===f;return i.jsx("li",{role:"option","aria-selected":_,children:i.jsx("button",{type:"button",onClick:M=>{M.stopPropagation(),w(p.id)},onPointerEnter:()=>u(g),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",_?"text-accent font-medium":"text-fg"].join(" "),children:p.label})},p.id)})})]})}function zr({controller:e,config:t}){if((t==null?void 0:t.enabled)===!1)return null;const n=e.capabilities,r=t==null?void 0:t.buttons,o=(l,w)=>w&&(r==null?void 0:r[l])!==!1,a=l=>()=>e.setDragMode(l),s=o("zoom",n.zoom)||o("pan",n.pan)||o("select",n.select)||o("lasso",n.lasso),d=o("zoomIn",n.zoom)||o("zoomOut",n.zoom),f=o("autoscale",n.autoscale)||o("reset",n.reset),u=o("screenshot",n.screenshot),h=(t==null?void 0:t.leadingButtons)??[];if(!h.length&&!s&&!d&&!f&&!u)return null;const x=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always";return i.jsxs("div",{style:{position:"absolute",pointerEvents:"auto",...Gr[x]},className:["z-30 flex items-center gap-0.5 rounded border border-border","bg-bg-elevated/90 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),role:"toolbar","aria-label":"Plot controls",children:[h.length>0&&i.jsxs(i.Fragment,{children:[h.map(l=>l.menu?i.jsx(Nr,{icon:l.icon,title:l.title,menu:l.menu},l.id):i.jsx(Ae,{icon:l.icon,label:l.label,title:l.title,active:l.active,disabled:l.disabled,onClick:l.onClick??(()=>{})},l.id)),(s||d||f||u)&&i.jsx(qe,{})]}),s&&i.jsxs(i.Fragment,{children:[o("zoom",n.zoom)&&i.jsx(Ae,{icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:a("zoom")}),o("pan",n.pan)&&i.jsx(Ae,{icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:a("pan")}),o("select",n.select)&&i.jsx(Ae,{icon:"select",title:"Box select",active:e.dragMode==="select",onClick:a("select")}),o("lasso",n.lasso)&&i.jsx(Ae,{icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:a("lasso")})]}),d&&i.jsxs(i.Fragment,{children:[s&&i.jsx(qe,{}),o("zoomIn",n.zoom)&&i.jsx(Ae,{icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),o("zoomOut",n.zoom)&&i.jsx(Ae,{icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()})]}),f&&i.jsxs(i.Fragment,{children:[(s||d)&&i.jsx(qe,{}),o("autoscale",n.autoscale)&&i.jsx(Ae,{icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),o("reset",n.reset)&&i.jsx(Ae,{icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()})]}),u&&i.jsxs(i.Fragment,{children:[(s||d||f)&&i.jsx(qe,{}),i.jsx(Ae,{icon:"camera",title:"Download plot as PNG",onClick:()=>{e.toPNG({filename:"plot"}).then(l=>Or(l,"plot.png")).catch(()=>{})}})]})]})}const Vr={zoom:1,pan:{x:0,y:0}},fn=1.3,$r=.25,Xr=64,Wr={buttons:{zoom:!1}};function Yr(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Hr=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function wt(e,t){return{id:"colormap",title:"Colormap",menu:{options:Hr,value:e,onSelect:t}}}function qr({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:d=$r,maxZoom:f=Xr,requestRender:u}){const h=c.useCallback(E=>{var X;if(!o)return;const M=(X=e.current)==null?void 0:X.getBoundingClientRect(),T=(M==null?void 0:M.width)??0,S=(M==null?void 0:M.height)??0,R=a&&s&&T>0&&S>0?Vt(a,s,T,S):f,C=Math.max(d,Math.min(R,n*E));if(C===n)return;const I=T/2,V=S/2,P=I-(I-r.x)/n*C,G=V-(V-r.y)/n*C;o({zoom:C,pan:{x:P,y:G}})},[o,e,a,s,f,d,n,r.x,r.y]),x=c.useCallback(()=>h(fn),[h]),y=c.useCallback(()=>h(1/fn),[h]),l=c.useCallback(()=>o==null?void 0:o(Vr),[o]),w=c.useCallback(E=>{const M={scale:E==null?void 0:E.scale,filename:E==null?void 0:E.filename};u==null||u();const T=t==null?void 0:t.current;if(T)return dn(T,M);const S=e.current;return S?Ur(S,M):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),v=n!==1||r.x!==0||r.y!==0,p=c.useCallback(E=>{},[]),g=c.useCallback(E=>{},[]),_=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:v,setDragMode:p,setHoverMode:g,toggleSpikelines:_,zoomIn:x,zoomOut:y,autoscale:l,reset:l,toPNG:w}),[m,v,p,g,_,x,y,l,w])}const Kr={zoom:1,pan:{x:0,y:0}};function Ke({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:d,naturalDims:f,checkerboard:u,wrapperClassName:h,wrapperStyle:x,viewportPadding:y,header:l,surface:w,showAxes:m,overlayNode:v,overlay:p,notationSeed:g,exportCanvasRef:_,requestRender:E,leadingMenus:M,label:T,showLabelChip:S,isDraggable:R=!1,onDragStart:C,extraChips:I}){const[V,P]=c.useState(g),[G,X]=c.useState(!1),{containerProps:F}=$t({containerRef:r,zoom:a,pan:s,onViewportChange:d,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h}),Q=c.useCallback(()=>{d==null||d(Kr)},[d]),le=qr({rootRef:r,canvasRef:_,zoom:a,pan:s,onViewportChange:d,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h,requestRender:E}),ue=c.useMemo(()=>({...Wr,leadingButtons:[...M??[],...G?[Yr(V,P)]:[]]}),[G,V,M]),Ee=" cairn-checkerboard",te="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?Ee:""),pe=h+(u==="wrapper"?Ee:""),he="render"in p?p.render({notation:V,setOverlayActive:X}):p.hasSource&&f?i.jsx(Ie,{imageElRef:p.displayElRef,naturalWidth:f.w,naturalHeight:f.h,zoom:a,pan:s,sourceWindow:p.sourceWindow,sample:p.sample,notation:V,version:p.version,onActiveChange:X}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[l,n&&i.jsx(zr,{controller:le,config:ue}),i.jsxs("div",{ref:r,className:te,style:{padding:y,...F.style},onPointerDown:F.onPointerDown,onPointerMove:F.onPointerMove,onPointerUp:F.onPointerUp,onPointerCancel:F.onPointerCancel,onDoubleClick:Q,...t,children:[i.jsxs("div",{ref:o,className:pe,style:x,children:[w,m&&f&&i.jsx(Rr,{naturalWidth:f.w,naturalHeight:f.h,zoom:a,containerRef:o}),v]}),he,!n&&G&&i.jsx(Wt,{notation:V,onChange:P})]}),S&&i.jsx(kr,{label:T,isDraggable:R,onDragStart:C}),I]})}function pn(e){return"hdr"in e&&e.hdr!=null}function hn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function xe(e){return Number.isFinite(e)?e:0}const Zr={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function jr(e,t,n,r){const{h:o,w:a,c:s}=hn(e.shape),d=e.data,f=Jn(t),u=new Uint8ClampedArray(a*o*4);for(let h=0;h<a*o;h++){const x=h*s;let y,l,w,m=1;s===1?y=l=w=xe(d[x]):s===3?(y=xe(d[x]),l=xe(d[x+1]),w=xe(d[x+2])):(y=xe(d[x]),l=xe(d[x+1]),w=xe(d[x+2]),m=xe(d[x+3]));const v=[it(y,n),it(l,n),it(w,n)],[p,g,_]=f(v),E=h*4;u[E]=255*ct(p,r),u[E+1]=255*ct(g,r),u[E+2]=255*ct(_,r),u[E+3]=255*(m<0?0:m>1?1:m)}return new ImageData(u,a,o)}function Qr(e){var de,me;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:d=!1,processing:f=Zr,zoom:u=1,pan:h={x:0,y:0},onViewportChange:x,onNaturalSize:y,label:l,isDraggable:w=!1,onDragStart:m,overlay:v,overlaySettings:p,pixelValueNotation:g="decimal",toolbar:_=!0}=e,[E,M]=c.useState(s);c.useEffect(()=>{M(s)},[s]);const T=c.useRef(null),S=c.useRef(null),R=c.useRef(null),C=c.useRef(null),I=c.useRef(null),V=c.useRef(null),P=c.useRef(null),[G,X]=c.useState(0),F=c.useCallback(()=>X(b=>b+1),[]),Q=c.useMemo(()=>({get current(){const b=I.current;return b instanceof HTMLCanvasElement?b:null}}),[]),le=c.useCallback(b=>{T.current=b,b&&(I.current=b)},[]),ue=c.useCallback(b=>{S.current=b,b&&(I.current=b)},[]),Ee=c.useCallback(b=>{b&&(I.current=b)},[]),[te,pe]=c.useState(!1),[he,re]=c.useState(!1),[ie,se]=c.useState(null),{flipSign:ye}=f,{gammaFilterId:_e,filterStr:be,gamma:ge,offset:H}=sn(f),k=!r&&o!=="none"&&n!=null&&t!=null,U=o!=="none"&&n!=null,N=E!=="none"&&!k&&!(r&&U)&&t!=null;c.useEffect(()=>{if(!N||!t){re(!1);return}let b=!1;re(!1);const B=`${t}::${E}`,D=rt(B);if(D){const A=S.current;if(A){A.width=D.width,A.height=D.height;const W=A.getContext("2d");W&&W.putImageData(D,0,0),P.current=D,F(),se({w:D.width,h:D.height}),y==null||y(D.width,D.height),re(!0)}return}const L=new Image;return L.onload=()=>{if(b)return;const A=document.createElement("canvas");A.width=L.naturalWidth,A.height=L.naturalHeight;const W=A.getContext("2d");if(!W)return;W.drawImage(L,0,0);const J=W.getImageData(0,0,A.width,A.height),q=kt.has(E)?"positive":"linear",K=nt(J,E,q);ot(B,K);const ve=S.current;if(!ve||b)return;ve.width=K.width,ve.height=K.height;const Z=ve.getContext("2d");Z&&Z.putImageData(K,0,0),P.current=K,F(),se({w:K.width,h:K.height}),y==null||y(K.width,K.height),re(!0)},L.src=t,()=>{b=!0}},[N,t,E]);const O=c.useCallback((b,B)=>{se(D=>D&&D.w===b&&D.h===B?D:{w:b,h:B}),y==null||y(b,B)},[]);c.useEffect(()=>{if(!t){V.current=null,P.current=null,F();return}let b=!1;return Le(t).then(B=>{b||(V.current=B,E==="none"&&(P.current=B),F())}),()=>{b=!0}},[t,E,F]);const z=c.useCallback((b,B,D)=>{const L=V.current;if(!L||b<0||B<0||b>=L.width||B>=L.height)return null;const A=(B*L.width+b)*4,W=L.data[A],J=L.data[A+1],q=L.data[A+2],K=P.current;let ve=W,Z=J,Me=q;if(K&&K.width===L.width&&K.height===L.height){const Ue=(B*K.width+b)*4;ve=K.data[Ue],Z=K.data[Ue+1],Me=K.data[Ue+2]}const ze=(.299*ve+.587*Z+.114*Me)/255;return E!=="none"||W===J&&J===q?{lines:[ne(W,"uint8",D)],luminance:ze}:{lines:[ne(W,"uint8",D),ne(J,"uint8",D),ne(q,"uint8",D)],luminance:ze,colors:[fe[0],fe[1],fe[2]]}},[E]);c.useEffect(()=>{if(!k){pe(!1);return}let b=!1;const B=jn(),D=B==="gpu"||B==="auto",L=`${n}::${t}::${o}::${E}`;if(B!=="gpu"){const A=rt(L);if(A){const W=T.current;if(W){(W.width!==A.width||W.height!==A.height)&&(W.width=A.width,W.height=A.height);const J=W.getContext("2d");J&&J.putImageData(A,0,0),O(A.width,A.height),pe(!0)}return}}return(async()=>{const[A,W]=await Promise.all([Le(n),Le(t)]);if(b||!A||!W)return;const q=o.includes("signed")?"signed":"positive",K=E!=="none"?tt(E):null,ve={diffMode:o,colormap:K,cmapMode:q};if(D)try{const Ve=T.current;if(Ve){const Ue=Kn(A,W,ve,Ve);if(Ue){if(b)return;O(Ue.width,Ue.height),pe(!0);return}}}catch(Ve){console.warn("[cairn] WebGL 2 diff error:",Ve)}if(B==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let Z=Vn(A,W,o);E!=="none"&&(Z=nt(Z,E,q)),ot(L,Z);const Me=T.current;if(!Me||b)return;(Me.width!==Z.width||Me.height!==Z.height)&&(Me.width=Z.width,Me.height=Z.height);const ze=Me.getContext("2d");ze&&ze.putImageData(Z,0,0),O(Z.width,Z.height),pe(!0)})(),()=>{b=!0}},[n,t,o,k,E,y]);const $=a==="auto"?void 0:a,ae=ye?{filter:"invert(1)"}:{},ce=v&&(p!=null&&p.enabled)&&ie&&t&&((((de=v.boxes)==null?void 0:de.length)??0)>0||(((me=v.masks)==null?void 0:me.length)??0)>0)?i.jsx(ft,{data:v,settings:p,naturalWidth:ie.w,naturalHeight:ie.h}):void 0,oe=t?k?i.jsxs(i.Fragment,{children:[!te&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:le,className:"w-full h-full object-contain block",style:{display:te?"block":"none",imageRendering:$,...ae}})]}):N?i.jsxs(i.Fragment,{children:[!he&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:ue,className:"w-full h-full object-contain block",style:{display:he?"block":"none",imageRendering:$,...ae}})]}):i.jsx("img",{ref:Ee,src:t,alt:l,className:"w-full h-full object-contain block",draggable:!1,style:{filter:be,imageRendering:$},onLoad:b=>{const B=b.currentTarget;se({w:B.naturalWidth,h:B.naturalHeight}),y==null||y(B.naturalWidth,B.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(Ke,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:R,wrapperRef:C,zoom:u,pan:h,onViewportChange:x,naturalDims:ie,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:d&&ie?"16px 4px 4px 28px":"4px",header:i.jsx(cn,{id:_e,gamma:ge,offset:H}),surface:oe,showAxes:d,overlayNode:ce,overlay:{displayElRef:I,sample:z,version:G,hasSource:!!t},notationSeed:g,exportCanvasRef:Q,leadingMenus:[wt(E,b=>M(b))],label:l,showLabelChip:!0,isDraggable:w,onDragStart:m})}function Jr(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:d="auto",zoom:f=1,pan:u={x:0,y:0},onViewportChange:h,pixelValueNotation:x="decimal",toolbar:y=!0}=e,l=c.useRef(null),w=c.useRef(null),m=c.useRef(null),[v,p]=c.useState(null),g=c.useRef(null),[_,E]=c.useState(0);c.useEffect(()=>{const S=l.current;if(!S)return;let R;try{R=jr(t,n,r,o)}catch(I){console.error("[cairn] HDR tone-map error:",I);return}(S.width!==R.width||S.height!==R.height)&&(S.width=R.width,S.height=R.height);const C=S.getContext("2d");C&&(C.putImageData(R,0,0),g.current=R,E(I=>I+1),p(I=>I&&I.w===R.width&&I.h===R.height?I:{w:R.width,h:R.height}))},[t,n,r,o]);const M=c.useCallback((S,R,C)=>{const I=v;if(!I||S<0||R<0||S>=I.w||R>=I.h)return null;const V=t.shape.length===2?1:t.shape[2]??1,P=(R*I.w+S)*V,G=t.data,X=g.current;let F=.5;if(X&&X.width===I.w&&X.height===I.h){const Q=(R*I.w+S)*4;F=(.299*X.data[Q]+.587*X.data[Q+1]+.114*X.data[Q+2])/255}return V===1?{lines:[ne(G[P]??0,"unit",C)],luminance:F}:{lines:[ne(G[P]??0,"unit",C),ne(G[P+1]??0,"unit",C),ne(G[P+2]??0,"unit",C)],luminance:F,colors:[fe[0],fe[1],fe[2]]}},[t,v]),T=d==="auto"?void 0:d;return i.jsx(Ke,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:y,paneRef:w,wrapperRef:m,zoom:f,pan:u,onViewportChange:h,naturalDims:v,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${u.x}px, ${u.y}px) scale(${f})`,transformOrigin:"0 0"},viewportPadding:a&&v?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:l,className:"w-full h-full object-contain block",style:{imageRendering:T}}),showAxes:a,overlay:{displayElRef:l,sample:M,version:_,hasSource:!0},notationSeed:x,exportCanvasRef:l,label:s,showLabelChip:!!s})}function yt(e){return pn(e)?i.jsx(Jr,{...e}):i.jsx(Qr,{...e})}const eo=["linear","srgb","reinhard","aces"];function to(e){return e&&eo.includes(e)?e:"srgb"}function no(e){const{h:t,w:n,c:r}=hn(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const d=s*r;let f,u,h,x=1;r===1?f=u=h=xe(o[d]):r===3?(f=xe(o[d]),u=xe(o[d+1]),h=xe(o[d+2])):(f=xe(o[d]),u=xe(o[d+1]),h=xe(o[d+2]),x=xe(o[d+3]));const y=s*4;a[y]=f,a[y+1]=u,a[y+2]=h,a[y+3]=x}return{data:a,width:n,height:t,format:"rgba32float"}}function gn(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,d=(t.width-a)/2,f=(t.height-s)/2,u=Math.max(e.zoom,1e-6),h=t.width/(u*a),x=t.height/(u*s),y=-d/a-e.pan.x/(u*a),l=-f/s-e.pan.y/(u*s);return{x:y,y:l,w:h,h:x}}function mn(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function ro(e){var ge,H;const t=pn(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(!1),[d,f]=c.useState(!1),[u,h]=c.useState(!1),[x,y]=c.useState(null),[l,w]=c.useState(0),[m,v]=c.useState(0),[p,g]=c.useState({x:0,y:0,w:1,h:1}),_=c.useRef(null),E=c.useRef(null),[M,T]=c.useState(0),S=e.zoom??1,R=e.pan??{x:0,y:0},C=e.onViewportChange,I=t?"none":e.colormap??"none",[V,P]=c.useState(I);c.useEffect(()=>{P(I)},[I]);const G=t?"none":V,X=dt();c.useEffect(()=>{const k=n.current;if(!k)return;let U=!1;return Xe().then(N=>{if(U)return;const O=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,z=N.capabilities.hdr&&O&&t;s.current=z,Ar(k,{hdr:z}).then($=>{if(U){an($);return}a.current=$,h(!0)}).catch($=>{U||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",$),f(!0))})}).catch(N=>{U||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",N),f(!0))}),()=>{U=!0,a.current&&(an(a.current),a.current=null)}},[]),c.useEffect(()=>{const k=r.current;if(!k)return;const U=new ResizeObserver(()=>v(N=>N+1));return U.observe(k),()=>U.disconnect()},[]),c.useEffect(()=>{const k=r.current;if(!k)return;const U=new IntersectionObserver(N=>{const O=N[0];if(!O)return;const z=a.current;z&&(z.setVisible(O.isIntersecting),O.isIntersecting?z.isParked&&(z.restore(),v($=>$+1)):z.park())},{threshold:0});return U.observe(k),()=>U.disconnect()},[]),c.useEffect(()=>{var N;if(!t||!u)return;const k=e.hdr;_.current=k;const U=no(k);(N=a.current)==null||N.setSource(U),y(O=>O&&O.w===U.width&&O.h===U.height?O:{w:U.width,h:U.height}),T(O=>O+1),w(O=>O+1)},[t,u,t?e.hdr:null]),c.useEffect(()=>{if(t||!u)return;const k=e,U=k.imageUrl,N=V;if(!U){E.current=null,y(null),T(z=>z+1);return}let O=!1;return Le(U).then(z=>{var ce,oe;if(O||!z)return;let $=z;if(N!=="none"){const de=`gpu::${U}::${N}`,me=rt(de);if(me)$=me;else{const b=kt.has(N)?"positive":"linear";$=nt(z,N,b),ot(de,$)}}E.current=z;const ae={data:$.data,width:$.width,height:$.height,format:"rgba8unorm"};(ce=a.current)==null||ce.setSource(ae),y(de=>de&&de.w===$.width&&de.h===$.height?de:{w:$.width,h:$.height}),(oe=k.onNaturalSize)==null||oe.call(k,$.width,$.height),T(de=>de+1),w(de=>de+1)}),()=>{O=!0}},[t,u,t?null:e.imageUrl,t?null:V]);const F=t?e.exposure??0:0,Q=t?e.tonemap:void 0,le=t?e.gamma:void 0,ue=c.useCallback(()=>{const k=a.current;if(!k||!u||!x)return;const U=r.current,N=o.current,O=N?N.getBoundingClientRect():U?U.getBoundingClientRect():{width:x.w,height:x.h},z=gn({zoom:S,pan:R},O,x.w,x.h);g(oe=>oe.x===z.x&&oe.y===z.y&&oe.w===z.w&&oe.h===z.h?oe:z),O.width>0&&O.height>0&&k.resize(Math.round(O.width*X),Math.round(O.height*X));const $=mn(z,O,x.w,x.h)>=pt?"nearest":"linear",ae=z,ce=t?{exposureEV:F,operator:s.current?"extended":to(Q),gamma:le,isScalar:!1,hdrOut:s.current,uv:ae,filter:$}:{exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ae,filter:$};try{k.render(ce)||f(!0)}catch(oe){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",oe),f(!0)}},[u,x,S,R.x,R.y,F,Q,le,t,X]);c.useEffect(()=>{ue()},[ue,l,m]);const Ee=c.useCallback((k,U,N)=>{if(t){const me=_.current,b=x;if(!me||!b||k<0||U<0||k>=b.w||U>=b.h)return null;const B=me.shape.length===2?1:me.shape[2]??1,D=(U*b.w+k)*B,L=me.data,A=.5;return B===1?{lines:[ne(L[D]??0,"unit",N)],luminance:A}:{lines:[ne(L[D]??0,"unit",N),ne(L[D+1]??0,"unit",N),ne(L[D+2]??0,"unit",N)],luminance:A,colors:[fe[0],fe[1],fe[2]]}}const O=E.current;if(!O||k<0||U<0||k>=O.width||U>=O.height)return null;const z=(U*O.width+k)*4,$=O.data[z],ae=O.data[z+1],ce=O.data[z+2],oe=(.299*$+.587*ae+.114*ce)/255;return G!=="none"||$===ae&&ae===ce?{lines:[ne($,"uint8",N)],luminance:oe}:{lines:[ne($,"uint8",N),ne(ae,"uint8",N),ne(ce,"uint8",N)],luminance:oe,colors:[fe[0],fe[1],fe[2]]}},[t,x,G]),te=e.showAxes??!1,pe=t?e.label??"":e.label,he=e.interpolation??"auto",re=he==="auto"?void 0:he,ie=t?void 0:e.overlay,se=t?void 0:e.overlaySettings,ye=t?!1:e.isDraggable??!1,_e=t?void 0:e.onDragStart;if(d)return t?i.jsx(yt,{...e}):i.jsx(yt,{...e});const be=ie&&(se!=null&&se.enabled)&&x&&((((ge=ie.boxes)==null?void 0:ge.length)??0)>0||(((H=ie.masks)==null?void 0:H.length)??0)>0)?i.jsx(ft,{data:ie,settings:se,naturalWidth:x.w,naturalHeight:x.h}):void 0;return i.jsx(Ke,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":u},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:S,pan:R,onViewportChange:C,naturalDims:x,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:te&&x?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:re},"data-gpu-image-canvas":!0}),showAxes:te,overlayNode:be,overlay:{displayElRef:n,sample:Ee,version:M,hasSource:!0,sourceWindow:p},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ue,leadingMenus:t?void 0:[wt(G,k=>P(k))],label:pe,showLabelChip:!!pe,isDraggable:ye,onDragStart:_e})}const Ze=new Map;function Be(e){if(Ze.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Ze.set(e.id,e)}function Ge(e){return Ze.get(e)}function oo(){return Array.from(Ze.values())}function vn(e,t){return{...e.params??{}}}const ao={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},so={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},io={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},co={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},lo={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},uo={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},xn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];po(xn);const Et=[1.052156925,1,.91835767],fo=.7;function po(e){const[t,n,r]=e[0],[o,a,s]=e[1],[d,f,u]=e[2],h=a*u-s*f,x=-(o*u-s*d),y=o*f-a*d,w=1/(t*h+n*x+r*y);return[[h*w,-(n*u-r*f)*w,(n*s-r*a)*w],[x*w,(t*u-r*d)*w,-(t*s-r*o)*w],[y*w,-(t*f-n*d)*w,(t*a-n*o)*w]]}function ho(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const _t=6/29;function Mt(e){return e>_t**3?Math.cbrt(e):e/(3*_t*_t)+4/29}function bn(e,t,n){const[r,o,a]=ho(xn,e,t,n),s=Mt(r*Et[0]),d=Mt(o*Et[1]),f=Mt(a*Et[2]),u=116*d-16,h=500*(s-d),x=200*(d-f);return[u,.01*u*h,.01*u*x]}function go(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function mo(){const e=bn(0,1,0),t=bn(0,0,1);return Math.pow(go(e,t),fo)}const vo=mo(),xo=.082;function bo(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),d=1/e,f=Math.PI**2,u=[0,0,0];for(let h=-s;h<=s;h++)for(let x=-s;x<=s;x++){const y=(x*d)**2+(h*d)**2;for(let l=0;l<3;l++)u[l]+=t[l]*Math.sqrt(Math.PI/n[l])*Math.exp(-f*y/n[l])+r[l]*Math.sqrt(Math.PI/o[l])*Math.exp(-f*y/o[l])}return{r:s,deltaX:d,sums:u}}function wo(e){const t=.5*xo*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let d=-n;d<=n;d++){const f=Math.exp(-(d*d+s*s)/(2*t*t)),u=-d*f,h=(d*d/(t*t)-1)*f;u>0&&(r+=u),h>0?o+=h:a-=h}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const wn=`
${Oe}
${Ht}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,yn=`
${Oe}
${Ht}
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
`,yo=`
${Oe}
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
`;function Fe(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}const Eo={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,n=bo(t),r=wo(t);return{passes:[{name:"ycxczA",shader:wn,inputs:["srcA"],output:"ycxczA"},{name:"ycxczB",shader:wn,inputs:["srcB"],output:"ycxczB"},{name:"labA",shader:yn,inputs:["ycxczA"],output:"labA",uniforms:()=>[Fe(1,[n.deltaX,n.r,n.sums[0],n.sums[1]]),Fe(2,[n.sums[2],0,0,0])]},{name:"labB",shader:yn,inputs:["ycxczB"],output:"labB",uniforms:()=>[Fe(1,[n.deltaX,n.r,n.sums[0],n.sums[1]]),Fe(2,[n.sums[2],0,0,0])]},{name:"combine",shader:yo,inputs:["labA","labB","ycxczA","ycxczB"],output:"flip",uniforms:()=>[Fe(4,[vo,r.sd,r.r,r.edgeNorm]),Fe(5,[r.pointPos,r.pointNeg,0,0])]}],final:"flip"}}};let En=!1;function _o(){En||(En=!0,Be(so),Be(ao),Be(io),Be(lo),Be(co),Be(uo),Be(Eo))}_o();const _n=new WeakMap;function Tt(e,t,n,r){let o=_n.get(e);o||(o=new Map,_n.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Mo(e){return`
${Oe}
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
`}const je="rgba16float";function To(e,t,n,r,o){var l,w;const a=Ge(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),d=Math.min(t.height,n.height),f=vn(a);if(a.kind==="pointwise"){const m=e.createTexture(s,d,je),v=Tt(e,`pw:${a.id}`,Mo(a.source),je);let p;try{p=e.createBindGroup(v,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(m,v,p)}finally{(l=p==null?void 0:p.destroy)==null||l.call(p)}return m}const u={width:s,height:d,params:f},h=a.buildPasses(u),x=new Map([["srcA",t],["srcB",n]]),y=[];try{for(const v of h.passes){const p=e.createTexture(s,d,je);y.push(p),x.set(v.output,p);const g=Tt(e,`mp:${a.id}:${v.name}`,v.shader,je),_=v.inputs.map((M,T)=>{const S=x.get(M);if(!S)throw new Error(`computeDiff: pass "${v.name}" input "${M}" not produced yet`);return{binding:T,resource:S}});v.uniforms&&_.push(...v.uniforms(u));let E;try{E=e.createBindGroup(g,_),e.renderFullscreen(p,g,E)}finally{(w=E==null?void 0:E.destroy)==null||w.call(E)}}const m=x.get(h.final);if(!m)throw new Error(`computeDiff: final ref "${h.final}" not produced`);for(const v of y)v!==m&&v.destroy();return m}catch(m){for(const v of y)v.destroy();throw m}}const So=8,Po=256*1024*1024;class Ao{constructor(t=So,n=Po){j(this,"map",new Map);j(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Mn=new WeakMap;function Co(e){let t=Mn.get(e);return t||(t=new Ao,Mn.set(e,t)),t}function Ro(e,t){const n=vn(e);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function ko(e,t,n,r){const o=Ge(n),a=o?Ro(o):"";return`${e}|${t}|${n}|${a}`}function Lo(e,t,n,r,o,a,s){const d=Ge(r);if(!d)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const f=Co(e),u=ko(a,s,r),h=f.get(u);if(h)return h;const x=To(e,t,n,r),y=Math.min(t.width,n.width),l=Math.min(t.height,n.height),w={texture:x,width:y,height:l,displayRange:d.displayRange,bytes:y*l*8};return f.set(u,w),w}async function Do(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=en(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}const Io=`
${Oe}
${Yt}
@group(0) @binding(0) var resultTex: texture_2d<f32>;
@group(0) @binding(3) var lut: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_uv: vec4<f32>;   // uvRect.xy, uvRect.wh
@group(0) @binding(11) var<uniform> u_disp: vec4<f32>; // displayRangeId, cmapModeId, useColormap, filterMode

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
  var v = raw.rgb;
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
`,Bo={unit:0,signed:1,relative:2},Uo={linear:0,signed:1,positive:2};function Oo(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Go(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Fo(e,t,n,r,o){var x;const a=Go(t),s=Tt(e,"diff-display",Io,a),d=Oo(e,o.colormap),f=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([Bo[r],Uo[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]);let h;try{h=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:d},{binding:2,resource:{uniform:f}},{binding:3,resource:{uniform:u}}]),e.renderFullscreen(t,s,h)}finally{(x=h==null?void 0:h.destroy)==null||x.call(h),d.destroy()}}const No={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function zo({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:d,onViewportChange:f,processing:u=No,interpolation:h="auto",label:x="",isDraggable:y=!1,onDragStart:l,overlay:w,overlaySettings:m,pixelValueNotation:v="decimal"}){var be,ge;const p=c.useRef(null),[g,_]=c.useState(null),[E,M]=c.useState(null),[T,S]=c.useState(v),[R,C]=c.useState(!1),I=c.useRef(null),V=c.useRef(null),P=c.useRef(null),G=c.useRef(null),[X,F]=c.useState(0);c.useEffect(()=>{if(!e){P.current=null,F(k=>k+1);return}let H=!1;return Le(e).then(k=>{H||(P.current=k,F(U=>U+1))}),()=>{H=!0}},[e]),c.useEffect(()=>{if(!t){G.current=null,F(k=>k+1);return}let H=!1;return Le(t).then(k=>{H||(G.current=k,F(U=>U+1))}),()=>{H=!0}},[t]);const Q=H=>(k,U,N)=>{const O=H.current;if(!O||k<0||U<0||k>=O.width||U>=O.height)return null;const z=(U*O.width+k)*4,$=O.data[z],ae=O.data[z+1],ce=O.data[z+2],oe=(.299*$+.587*ae+.114*ce)/255;return $===ae&&ae===ce?{lines:[ne($,"uint8",N)],luminance:oe}:{lines:[ne($,"uint8",N),ne(ae,"uint8",N),ne(ce,"uint8",N)],luminance:oe,colors:[fe[0],fe[1],fe[2]]}},le=c.useMemo(()=>Q(P),[]),ue=c.useMemo(()=>Q(G),[]),Ee=!!w&&!!(m!=null&&m.enabled)&&!!g&&!!e&&((((be=w.boxes)==null?void 0:be.length)??0)>0||(((ge=w.masks)==null?void 0:ge.length)??0)>0),{gammaFilterId:te,filterStr:pe,gamma:he,offset:re}=sn(u),ie=`translate(${d.x}px, ${d.y}px) scale(${s})`,se=h==="auto"?void 0:h,{containerProps:ye,modifierActive:_e}=$t({containerRef:p,zoom:s,pan:d,onViewportChange:f});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(cn,{id:te,gamma:he,offset:re}),i.jsxs("div",{ref:p,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...ye.style},onPointerDown:ye.onPointerDown,onPointerMove:ye.onPointerMove,onPointerUp:ye.onPointerUp,onPointerCancel:ye.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:ie,transformOrigin:"0 0"},children:[i.jsx("img",{ref:I,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:pe,imageRendering:se,...n==="blend"?{opacity:o}:{}},onLoad:H=>{const k=H.currentTarget;_({w:k.naturalWidth,h:k.naturalHeight})}}),Ee&&i.jsx(ft,{data:w,settings:m,naturalWidth:g.w,naturalHeight:g.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:ie,transformOrigin:"0 0"},children:i.jsx("img",{ref:V,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:pe,imageRendering:se,...n==="blend"?{opacity:1-o}:{}},onLoad:H=>{const k=H.currentTarget;M({w:k.naturalWidth,h:k.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:H=>{H.stopPropagation(),H.preventDefault();const U=H.currentTarget.parentElement.getBoundingClientRect(),N=z=>{a==null||a(Math.max(0,Math.min(1,(z.clientX-U.left)/U.width)))},O=()=>{window.removeEventListener("pointermove",N),window.removeEventListener("pointerup",O)};window.addEventListener("pointermove",N),window.addEventListener("pointerup",O)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&E&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Ie,{imageElRef:V,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:d,sample:ue,notation:T,version:X})}),e&&g&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Ie,{imageElRef:I,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:d,sample:le,notation:T,version:X,onActiveChange:C})})]}):e&&g&&i.jsx(Ie,{imageElRef:I,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:d,sample:le,notation:T,version:X,onActiveChange:C}),R&&i.jsx(Wt,{notation:T,onChange:S})]}),i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${y&&!_e?" cairn-drag-grip":""}`,draggable:y&&!_e,onDragStart:l,style:{cursor:y&&!_e?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),x]})]})}function Vo(e){const t=tt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function $o({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,diffSubmode:s,colormap:d="none",diffKernel:f,onDiffKernelChange:u,zoom:h,pan:x,onViewportChange:y,interpolation:l="auto",label:w="",pixelValueNotation:m="decimal"}){var me;const v=c.useRef(null),p=c.useRef(null),g=c.useRef(null),_=c.useRef(null),E=c.useRef(null),[M,T]=c.useState(!1),[S,R]=c.useState(!1),[C,I]=c.useState(null),[V,P]=c.useState(0),[G,X]=c.useState(0),[F,Q]=c.useState(null),[le,ue]=c.useState({x:0,y:0,w:1,h:1}),Ee=f??s??"absolute",[te,pe]=c.useState(Ee);c.useEffect(()=>{pe(f??s??"absolute")},[f,s]);const he=c.useCallback(b=>{pe(b),u==null||u(b)},[u]);c.useEffect(()=>{const b=v.current;if(b)return b.__cairnDiffKernel={current:te,set:he},()=>{b&&delete b.__cairnDiffKernel}},[te,he]);const[re,ie]=c.useState(n);c.useEffect(()=>{ie(n)},[n]);const[se,ye]=c.useState(d);c.useEffect(()=>{ye(d)},[d]);const _e=c.useMemo(()=>{const L=[{id:"compare-mode",title:"Compare / diff mode",menu:{options:[{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...oo().map(A=>({id:A.id,label:A.label}))],value:re==="diff"?te:re==="split"?"slide":"blend",onSelect:A=>{A==="slide"?ie("split"):A==="blend"?ie("blend"):(ie("diff"),he(A))}}}];return re==="diff"&&L.push(wt(se,A=>ye(A))),L},[re,te,se,he]),be=c.useRef(null),ge=c.useRef(null),[H,k]=c.useState(0),U=dt();c.useEffect(()=>{const b=g.current;if(!b)return;let B=!1;return Xe().then(D=>{if(!B)try{if(tn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const L=D.createSurface(b,{hdr:!1});_.current={device:D,surface:L,texA:null,texB:null},R(!0)}catch(L){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",L),T(!0)}}).catch(D=>{B||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",D),T(!0))}),()=>{var L,A;B=!0;const D=_.current;D&&((L=D.texA)==null||L.destroy(),(A=D.texB)==null||A.destroy(),_.current=null)}},[]),c.useEffect(()=>{const b=v.current;if(!b)return;const B=new ResizeObserver(()=>X(D=>D+1));return B.observe(b),()=>B.disconnect()},[]),c.useEffect(()=>{if(!S)return;let b=!1;if(!_.current)return;async function D(L){return L?Le(L):null}return Promise.all([D(e),D(t)]).then(([L,A])=>{var K,ve;if(b||!_.current)return;const W=_.current;be.current=L,ge.current=A,(K=W.texA)==null||K.destroy(),(ve=W.texB)==null||ve.destroy(),W.texA=null,W.texB=null;const J=L??A;if(!J){I(null),k(Z=>Z+1);return}const q=Z=>{const Me=W.device.createTexture(Z.width,Z.height,"rgba8unorm");return Me.write(Z.data),Me};W.texA=q(A??J),W.texB=q(L??J),I({w:J.width,h:J.height}),k(Z=>Z+1),P(Z=>Z+1)}),()=>{b=!0}},[S,e,t]);const N=c.useMemo(()=>{var B;return(((B=Ge(te))==null?void 0:B.displayRange)??"unit")==="signed"?"signed":"positive"},[te]),O=c.useMemo(()=>se!=="none"?Vo(se):void 0,[se]),z=c.useCallback(()=>{const b=_.current;if(!S||!b||!b.surface||!b.texA||!b.texB||!C)return;const B=v.current,D=B?B.getBoundingClientRect():{width:C.w,height:C.h},L=gn({zoom:h,pan:x},D,C.w,C.h);ue(q=>q.x===L.x&&q.y===L.y&&q.w===L.w&&q.h===L.h?q:L);const A=g.current;if(D.width>0&&D.height>0&&A&&b.surface){const q=Math.max(1,Math.round(D.width*U)),K=Math.max(1,Math.round(D.height*U));(A.width!==q||A.height!==K)&&(A.width=q,A.height=K,b.surface.configure(q,K))}const W=mn(L,D,C.w,C.h)>=pt?"nearest":"linear",J=L;try{if(re==="diff"){const q=t??e??"none",K=e??t??"none",ve=Ge(te),Z=Lo(b.device,b.texA,b.texB,ve?te:"absolute",void 0,q,K);E.current=Z,Fo(b.device,b.surface,Z.texture,Z.displayRange,{uv:J,cmapMode:N,colormap:O,filter:W})}else{const q={exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:J,filter:W,mode:re,split:r,alpha:o};_r(b.device,b.surface,b.texA,b.texB,q)}}catch(q){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",q),T(!0)}},[S,C,h,x.x,x.y,re,r,o,te,N,O,e,t,U]);c.useEffect(()=>{z()},[z,V,G]),c.useEffect(()=>{const b=_.current;if(!S||!b||!b.texA||!b.texB||!t){Q(null);return}let B=!1;const D=b.texA,L=b.texB,A=E.current;return(re==="diff"&&A?Do(b.device,A,D,L):en(b.device,D,L)).then(J=>{B||Q(J)}),()=>{B=!0}},[S,V,t,re,te]);const $=b=>(B,D,L)=>{const A=b.current;if(!A||B<0||D<0||B>=A.width||D>=A.height)return null;const W=(D*A.width+B)*4,J=A.data[W],q=A.data[W+1],K=A.data[W+2],ve=(.299*J+.587*q+.114*K)/255;return J===q&&q===K?{lines:[ne(J,"uint8",L)],luminance:ve}:{lines:[ne(J,"uint8",L),ne(q,"uint8",L),ne(K,"uint8",L)],luminance:ve,colors:[fe[0],fe[1],fe[2]]}},ae=c.useMemo(()=>$(be),[]),ce=c.useMemo(()=>$(ge),[]),oe=l==="auto"?void 0:l;if(M)return re==="diff"?i.jsx(yt,{imageUrl:e,baselineUrl:t,diffMode:((me=Ge(te))==null?void 0:me.kind)==="pointwise"?te:"absolute",interpolation:l,colormap:se,showAxes:!1,zoom:h,pan:x,onViewportChange:y,label:w,pixelValueNotation:m}):i.jsx(zo,{imageUrl:e,baselineUrl:t,mode:re,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:h,pan:x,onViewportChange:y,interpolation:l,label:w,pixelValueNotation:m});const de=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:g,className:"w-full h-full block",style:{imageRendering:oe},"data-gpu-compare-canvas":!0}),re==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:b=>{b.stopPropagation(),a==null||a(.5)},onPointerDown:b=>{b.stopPropagation(),b.preventDefault();const D=b.currentTarget.parentElement.getBoundingClientRect(),L=W=>{a==null||a(Math.max(0,Math.min(1,(W.clientX-D.left)/D.width)))},A=()=>{window.removeEventListener("pointermove",L),window.removeEventListener("pointerup",A)};window.addEventListener("pointermove",L),window.addEventListener("pointerup",A)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(Ke,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":S},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:v,wrapperRef:p,zoom:h,pan:x,onViewportChange:y,naturalDims:C,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:de,showAxes:!1,notationSeed:m,exportCanvasRef:g,requestRender:z,leadingMenus:_e,label:"",showLabelChip:!1,overlay:{render:({notation:b,setOverlayActive:B})=>re==="split"?i.jsxs(i.Fragment,{children:[t&&C&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Ie,{imageElRef:g,naturalWidth:C.w,naturalHeight:C.h,zoom:h,pan:x,sourceWindow:le,sample:ce,notation:b,version:H})}),t&&C&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Ie,{imageElRef:g,naturalWidth:C.w,naturalHeight:C.h,zoom:h,pan:x,sourceWindow:le,sample:ae,notation:b,version:H,onActiveChange:B})})]}):C&&i.jsx(Ie,{imageElRef:g,naturalWidth:C.w,naturalHeight:C.h,zoom:h,pan:x,sourceWindow:le,sample:ae,notation:b,version:H,onActiveChange:B})},extraChips:i.jsxs(i.Fragment,{children:[i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),w?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:w}):null,F&&i.jsxs("span",{className:"absolute right-1.5 top-9 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono","data-gpu-compare-metrics":!0,children:["MSE ",F.mse.toExponential(2)," · PSNR ",Number.isFinite(F.psnr)?F.psnr.toFixed(1):"∞"," dB · MAE"," ",F.mae.toExponential(2)]})]})})}const Xo="cairn-plot:gpu-image-ready";async function Wo(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Xe(),window.__cairnPlotGpuImagePane=ro,window.__cairnPlotGpuComparePane=$o,window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Xo))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}Wo()})(__cairnPlotJsxRuntime,__cairnPlotReact);
