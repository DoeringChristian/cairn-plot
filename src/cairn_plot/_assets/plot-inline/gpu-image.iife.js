var Br=Object.defineProperty;var Nr=(i,c,Pe)=>c in i?Br(i,c,{enumerable:!0,configurable:!0,writable:!0,value:Pe}):i[c]=Pe;var j=(i,c,Pe)=>Nr(i,typeof c!="symbol"?c+"":c,Pe);(function(i,c){"use strict";const Pe=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function ft(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Pe}),{hdr:!1,format:n}}function Qt(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Pe}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Pe}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return ft(e,t)}}}const Jt=`
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
`;function $e(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function ht(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function en(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const tn={texture:0,sampler:1,uniform:2};function Ye(e,t){return e*3+tn[t]}const nn={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function rn(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const f=nn[s];if(f===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:f})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class gt{constructor(t,n,r,o){j(this,"width");j(this,"height");j(this,"format");j(this,"gpuTexture");j(this,"device");j(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:$e(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*ht(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class pt{constructor(t){j(this,"_s");j(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class on{constructor(t,n,r,o,a){j(this,"_p");j(this,"gpuPipeline");j(this,"bindings");j(this,"bindGroupLayout");j(this,"variants");j(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function an(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class sn{constructor(t){j(this,"_c");j(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class cn{constructor(t,n){j(this,"_b");j(this,"gpuBindGroup");j(this,"ownedBuffers");j(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class ln{constructor(t,n,r,o){j(this,"canvas");j(this,"hdr");j(this,"format");j(this,"context");j(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function Ge(e){return"canvas"in e}async function un(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(u){return Ge(u)?u.getCurrentTextureView():u.gpuTexture.createView()}function s(u){if(Ge(u))return{width:u.canvas.width,height:u.canvas.height};const E=u;return{width:E.width,height:E.height}}let f=!1;const d=256;let l=null,v=null;function y(){if(!l||!v){const u=t.createShaderModule({code:Jt});v=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[v]});l=t.createComputePipeline({layout:E,compute:{module:u,entryPoint:"cs_main"}})}return{pipeline:l,layout:v}}return{backend:"webgpu",capabilities:n,createTexture(u,E,h){return new gt(t,u,E,h)},createSampler(u){const E=(u==null?void 0:u.filter)==="linear"?"linear":"nearest",h=t.createSampler({magFilter:E,minFilter:E,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new pt(h)},createRenderPipeline(u){const E=t.createShaderModule({code:u.shaderWGSL}),h=rn(u.shaderWGSL),g=$e(u.targetFormat),m=an(t,h),p=t.createPipelineLayout({bindGroupLayouts:[m]}),P=M=>t.createRenderPipeline({layout:p,vertex:{module:E,entryPoint:"vs_main"},fragment:{module:E,entryPoint:"fs_main",targets:[{format:M}]},primitive:{topology:"triangle-list"}}),_=P(g);return new on(_,h,m,g,P)},createComputePipeline(u){const E=t.createShaderModule({code:u.shaderWGSL}),h=t.createComputePipeline({layout:"auto",compute:{module:E,entryPoint:"cs_main"}});return new sn(h)},createBindGroup(u,E){const h=u,g=new Map,m=[];for(const[P,_]of h.bindings)if(_.kind==="uniform"){const M=t.createBuffer({size:_.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});m.push(M),g.set(P,{binding:P,resource:{buffer:M}})}else _.kind==="sampler"&&g.set(P,{binding:P,resource:o()});for(const P of E){const _=P.resource;if(_ instanceof gt){const M=Ye(P.binding,"texture");h.bindings.has(M)&&g.set(M,{binding:M,resource:_.gpuTexture.createView()})}else if(_ instanceof pt){const M=Ye(P.binding,"sampler");h.bindings.has(M)&&g.set(M,{binding:M,resource:_.gpuSampler})}else{const M=Ye(P.binding,"uniform"),S=h.bindings.get(M);if(S&&S.kind==="uniform"){const D=_.uniform,k=t.createBuffer({size:Math.max(S.sizeBytes,D.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(k,0,D.buffer,D.byteOffset,D.byteLength),m.push(k),g.set(M,{binding:M,resource:{buffer:k}})}}}const p=t.createBindGroup({layout:h.bindGroupLayout,entries:Array.from(g.values())});return new cn(p,m)},createSurface(u,E){const h=u.getContext("webgpu");if(!h)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const g=E.hdr&&n.hdr,m=()=>g?Qt(h,t):ft(h,t),p=m();return new ln(u,h,p,m)},renderFullscreen(u,E,h){const g=E,m=h,p=a(u),{width:P,height:_}=s(u),M=Ge(u)?u.format:$e(u.format),S=g.pipelineFor(M),D=t.createCommandEncoder(),k=D.beginRenderPass({colorAttachments:[{view:p,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});k.setPipeline(S),k.setBindGroup(0,m.gpuBindGroup),k.setViewport(0,0,P,_,0,1),k.draw(3),k.end(),t.queue.submit([D.finish()])},async readback(u){const E=Ge(u),{width:h,height:g}=s(u),m=E?u.hdr?"rgba16float":"rgba8unorm":u.format,p=E&&u.format==="bgra8unorm",P=E?u.getCurrentGPUTexture():u.gpuTexture,_=ht(m),M=h*_,S=256,D=Math.ceil(M/S)*S,k=D*g,L=t.createBuffer({size:k,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),U=t.createCommandEncoder();U.copyTextureToBuffer({texture:P},{buffer:L,bytesPerRow:D,rowsPerImage:g},{width:h,height:g,depthOrArrayLayers:1}),t.queue.submit([U.finish()]),await L.mapAsync(GPUMapMode.READ);const X=new Uint8Array(L.getMappedRange()),A=new Uint8Array(M*g);for(let R=0;R<g;R++){const G=R*D,z=R*M;A.set(X.subarray(G,G+M),z)}if(L.unmap(),L.destroy(),m==="rgba8unorm"){if(p)for(let R=0;R<A.length;R+=4){const G=A[R],z=A[R+2];A[R]=z,A[R+2]=G}return A}if(m==="rgba16float"){const R=new Uint16Array(A.buffer,A.byteOffset,A.byteLength/2),G=new Float32Array(R.length);for(let z=0;z<R.length;z++)G[z]=en(R[z]);return G}return new Float32Array(A.buffer,A.byteOffset,A.byteLength/4)},async reduceDiffSumSquaredAbs(u,E,h,g){const m=u,p=E,P=Math.max(0,h*g),_=Math.max(1,Math.ceil(P/d)),{pipeline:M,layout:S}=y(),D=_*2*4,k=t.createBuffer({size:D,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),L=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(L,0,new Uint32Array([Math.max(1,h),Math.max(1,g),P,0]));const U=t.createBindGroup({layout:S,entries:[{binding:0,resource:m.gpuTexture.createView()},{binding:1,resource:p.gpuTexture.createView()},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:L}}]}),X=t.createBuffer({size:D,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),A=t.createCommandEncoder(),R=A.beginComputePass();R.setPipeline(M),R.setBindGroup(0,U),R.dispatchWorkgroups(_),R.end(),A.copyBufferToBuffer(k,0,X,0,D),t.queue.submit([A.finish()]),await X.mapAsync(GPUMapMode.READ);const z=new Float32Array(X.getMappedRange()).slice();X.unmap(),X.destroy(),k.destroy(),L.destroy();let K=0,se=0;for(let ne=0;ne<_;ne++)K+=z[ne*2],se+=z[ne*2+1];return{sumSq:K,sumAbs:se}},destroy(){f||(t.destroy(),f=!0)},isContextLost(){return!1}}}let He=null;async function dn(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return un()}function Fe(){return He||(He=dn()),He}function fn(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function hn(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),f=o-a,[d,l,v]=fn(e[a],e[s],f);t[n*3]=Math.round(d),t[n*3+1]=Math.round(l),t[n*3+2]=Math.round(v)}return t}const mt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},bt=new Set(["red-green","red-blue"]),vt=new Map;function qe(e){let t=vt.get(e);if(!t){const n=mt[e]??mt.viridis;t=hn(n),vt.set(e,t)}return t}function Ze(e,t,n="linear"){const r=qe(t),o=new ImageData(e.width,e.height),a=e.data,s=o.data;for(let f=0;f<a.length;f+=4){const d=(a[f]+a[f+1]+a[f+2])/3;let l;n==="positive"?l=Math.round(128+d/255*127):l=Math.round(d),l=Math.max(0,Math.min(255,l)),s[f]=r[l*3],s[f+1]=r[l*3+1],s[f+2]=r[l*3+2],s[f+3]=a[f+3]}return o}function wt(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const xt=wt(50);function Ke(e){return xt.get(e)}function je(e,t){xt.set(e,t)}const yt=wt(100);function gn(e){return yt.get(e)}function pn(e,t){yt.set(e,t)}function mn(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let f=0;f<r;f++){const d=(s*e.width+f)*4,l=(s*t.width+f)*4,v=(s*r+f)*4;for(let y=0;y<3;y++){const w=e.data[d+y],u=t.data[l+y],E=w-u,h=Math.abs(E),g=Math.max(w,1);let m;switch(n){case"signed":m=(E+255)/2;break;case"absolute":m=h;break;case"squared":m=E*E/255;break;case"relative_signed":m=(E/g+1)*127.5;break;case"relative_absolute":m=h/g*255;break;case"relative_squared":m=E*E/(g*g)*255;break}a.data[v+y]=Math.min(255,Math.max(0,Math.round(m)))}a.data[v+3]=255}return a}async function ke(e){const t=gn(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);pn(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const bn={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},vn={linear:0,signed:1,positive:2},wn=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,xn=`#version 300 es
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
}`;let Ie=null,V=null,fe=null,Be=null;function yn(){if(V)return V;try{if(typeof OffscreenCanvas<"u"?Ie=new OffscreenCanvas(1,1):Ie=document.createElement("canvas"),V=Ie.getContext("webgl2",{preserveDrawingBuffer:!0}),!V)return console.warn("[cairn] WebGL 2 not available"),null;const e=V.createShader(V.VERTEX_SHADER);if(V.shaderSource(e,wn),V.compileShader(e),!V.getShaderParameter(e,V.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",V.getShaderInfoLog(e)),null;const t=V.createShader(V.FRAGMENT_SHADER);if(V.shaderSource(t,xn),V.compileShader(t),!V.getShaderParameter(t,V.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",V.getShaderInfoLog(t)),null;if(fe=V.createProgram(),V.attachShader(fe,e),V.attachShader(fe,t),V.linkProgram(fe),!V.getProgramParameter(fe,V.LINK_STATUS))return console.error("[cairn] WebGL program link:",V.getProgramInfoLog(fe)),null;Be=V.createVertexArray(),V.bindVertexArray(Be);const n=V.createBuffer();V.bindBuffer(V.ARRAY_BUFFER,n),V.bufferData(V.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),V.STATIC_DRAW);const r=V.getAttribLocation(fe,"a_pos");return V.enableVertexAttribArray(r),V.vertexAttribPointer(r,2,V.FLOAT,!1,0,0),V.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),V}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Et(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function En(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function _n(e,t,n,r){const o=yn();if(!o||!fe||!Be||!Ie)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);Ie.width=a,Ie.height=s,o.viewport(0,0,a,s);const f=Et(o,e,0),d=Et(o,t,1);let l=null;n.colormap?l=En(o,n.colormap,2):(l=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,l),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(fe),o.uniform1i(o.getUniformLocation(fe,"u_baseline"),0),o.uniform1i(o.getUniformLocation(fe,"u_other"),1),o.uniform1i(o.getUniformLocation(fe,"u_lut"),2),o.uniform1i(o.getUniformLocation(fe,"u_diff_mode"),bn[n.diffMode]),o.uniform1i(o.getUniformLocation(fe,"u_cmap_mode"),vn[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(fe,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Be),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const v=r.getContext("2d");return v&&(v.save(),v.scale(1,-1),v.drawImage(Ie,0,0,a,s,0,-s,a,s),v.restore()),o.deleteTexture(f),o.deleteTexture(d),o.deleteTexture(l),{width:a,height:s}}const Mn="cairn:render-mode";function Sn(){try{const e=localStorage.getItem(Mn);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const we=e=>e<0?0:e>1?1:e,Qe=e=>{const t=e<0?0:e;return t/(1+t)},Je=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return we(n/r)},_t={linear:([e,t,n])=>[we(e),we(t),we(n)],srgb:([e,t,n])=>[we(e),we(t),we(n)],reinhard:([e,t,n])=>[Qe(e),Qe(t),Qe(n)],aces:([e,t,n])=>[Je(e),Je(t),Je(n)],extended:([e,t,n])=>[e,t,n]},Pn="srgb";function Cn(e){return e&&_t[e]||_t[Pn]}function et(e,t){return e*2**t}function Tn(e){const t=we(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function tt(e,t){return typeof t=="number"&&t>0?we(Math.pow(we(e),1/t)):Tn(e)}const xe=new Uint32Array(512),ye=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(xe[e]=0,xe[e|256]=32768,ye[e]=24,ye[e|256]=24):t<-14?(xe[e]=1024>>-t-14,xe[e|256]=1024>>-t-14|32768,ye[e]=-t-1,ye[e|256]=-t-1):t<=15?(xe[e]=t+15<<10,xe[e|256]=t+15<<10|32768,ye[e]=13,ye[e|256]=13):t<128?(xe[e]=31744,xe[e|256]=64512,ye[e]=24,ye[e|256]=24):(xe[e]=31744,xe[e|256]=64512,ye[e]=13,ye[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Re=Uint8Array,Mt=Uint16Array,An=Int32Array,kn=new Re([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),In=new Re([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),St=function(e,t){for(var n=new Mt(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new An(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},Pt=St(kn,2),Dn=Pt.b,Un=Pt.r;Dn[28]=258,Un[258]=28,St(In,0);for(var Rn=new Mt(32768),Q=0;Q<32768;++Q){var Ce=(Q&43690)>>1|(Q&21845)<<1;Ce=(Ce&52428)>>2|(Ce&13107)<<2,Ce=(Ce&61680)>>4|(Ce&3855)<<4,Rn[Q]=((Ce&65280)>>8|(Ce&255)<<8)>>1}for(var Ne=new Re(288),Q=0;Q<144;++Q)Ne[Q]=8;for(var Q=144;Q<256;++Q)Ne[Q]=9;for(var Q=256;Q<280;++Q)Ne[Q]=7;for(var Q=280;Q<288;++Q)Ne[Q]=8;for(var Ln=new Re(32),Q=0;Q<32;++Q)Ln[Q]=5;var On=new Re(0),Gn=typeof TextDecoder<"u"&&new TextDecoder,Fn=0;try{Gn.decode(On,{stream:!0}),Fn=1}catch{}const Ct=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function nt(e){const t=Ct.length;return Ct[(e%t+t)%t]}function Bn(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),f=c.useRef(null),d=c.useCallback((l,v)=>{o(y=>y.w===l&&y.h===v?y:{w:l,h:v})},[]);return c.useLayoutEffect(()=>{const l=n.current;if(!l||l===f.current)return;const v=l.getBoundingClientRect();(v.width>0||v.height>0)&&(f.current=l,d(v.width,v.height))}),c.useEffect(()=>{var y;const l=n.current;if(l===s.current||((y=a.current)==null||y.disconnect(),a.current=null,s.current=l,!l))return;const v=new ResizeObserver(w=>{for(const u of w)d(u.contentRect.width,u.contentRect.height)});a.current=v,v.observe(l)}),c.useEffect(()=>()=>{var l;return(l=a.current)==null?void 0:l.disconnect()},[]),{ref:n,size:r}}function Nn(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Vn=.25,rt=64;function Tt(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return rt;const o=Math.min(n/e,r/t);return o<=0?rt:Math.max(Math.max(n,r)/o,8)}function At(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=Vn,maxZoom:s=rt,naturalWidth:f,naturalHeight:d}=e,l=Nn(),v=c.useRef(l);v.current=l;const y=c.useRef({zoom:n,pan:r});y.current={zoom:n,pan:r};const w=c.useRef(o);w.current=o,c.useEffect(()=>{const p=t.current;if(!p||!o)return;const P=_=>{var G;if(!v.current)return;_.preventDefault(),_.stopPropagation();const M=_.deltaY<0?1.1:1/1.1,S=y.current,D=p.getBoundingClientRect(),k=f&&d?Tt(f,d,D.width,D.height):s,L=Math.max(a,Math.min(k,S.zoom*M));if(S.zoom===L)return;const U=_.clientX-D.left,X=_.clientY-D.top,A=U-(U-S.pan.x)/S.zoom*L,R=X-(X-S.pan.y)/S.zoom*L;(G=w.current)==null||G.call(w,{zoom:L,pan:{x:A,y:R}})};return p.addEventListener("wheel",P,{passive:!1}),()=>p.removeEventListener("wheel",P)},[t,!!o,a,s,f,d]);const u=c.useRef(null),E=c.useCallback(p=>{!v.current||!w.current||(p.currentTarget.setPointerCapture(p.pointerId),u.current={pointerId:p.pointerId,startX:p.clientX,startY:p.clientY,panX:y.current.pan.x,panY:y.current.pan.y})},[]),h=c.useCallback(p=>{var S;const P=u.current;if(!P||P.pointerId!==p.pointerId)return;const _=p.clientX-P.startX,M=p.clientY-P.startY;(S=w.current)==null||S.call(w,{zoom:y.current.zoom,pan:{x:P.panX+_,y:P.panY+M}})},[]),g=c.useCallback(p=>{const P=u.current;if(!(!P||P.pointerId!==p.pointerId)){try{p.currentTarget.releasePointerCapture(p.pointerId)}catch{}u.current=null}},[]),m=l&&!!o;return{containerProps:{onPointerDown:E,onPointerMove:h,onPointerUp:g,onPointerCancel:g,style:{cursor:m?"move":void 0,touchAction:m?"none":void 0}},modifierActive:l}}function ot(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function zn(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function kt(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function at({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=Bn(),s=c.useRef(null),f=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),d=c.useMemo(()=>{const h=a.w,g=a.h;if(h<=0||g<=0||n<=0||r<=0)return null;const m=Math.min(h/n,g/r),p=n*m,P=r*m;return{left:(h-p)/2,top:(g-P)/2,width:p,height:P}},[a.w,a.h,n,r]),l=e.masks,v=t.showMasks&&!!l&&l.length>0,y=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!v||!l)return;const h=s.current;if(!h)return;(h.width!==n||h.height!==r)&&(h.width=n,h.height=r);const g=h.getContext("2d");if(!g)return;g.clearRect(0,0,h.width,h.height);let m=!1;const p=g.createImageData(n,r),P=p.data;let _=l.length,M=!1;const S=()=>{m||M&&g.putImageData(p,0,0)},D=document.createElement("canvas");D.width=n,D.height=r;const k=D.getContext("2d",{willReadFrequently:!0});for(const L of l){const U=new Image;U.onload=()=>{if(!m){if(k){k.clearRect(0,0,n,r),k.drawImage(U,0,0,n,r);const X=k.getImageData(0,0,n,r).data;for(let A=0;A<n*r;A++){const R=X[A*4];if(R===0||f.has(R))continue;const[G,z,K]=zn(nt(R));P[A*4]=G,P[A*4+1]=z,P[A*4+2]=K,P[A*4+3]=255,M=!0}}_-=1,_===0&&S()}},U.onerror=()=>{_-=1,_===0&&S()},U.src=`data:image/png;base64,${L.png_b64}`}return()=>{m=!0}},[v,l,n,r,y]),!d)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const w=e.boxes??[],u=t.showBoxes&&w.length>0,E=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[v&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:d.left,top:d.top,width:d.width,height:d.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),u&&i.jsx("svg",{className:"absolute",style:{left:d.left,top:d.top,width:d.width,height:d.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:w.map((h,g)=>{if(!kt(h,t,f))return null;const m=h.domain==="pixel"?1:n,p=h.domain==="pixel"?1:r,P=h.position.minX*m,_=h.position.minY*p,M=(h.position.maxX-h.position.minX)*m,S=(h.position.maxY-h.position.minY)*p;return i.jsx("rect",{x:P,y:_,width:M,height:S,fill:"none",stroke:nt(h.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},g)})}),u&&i.jsx("div",{className:"absolute",style:{left:d.left,top:d.top,width:d.width,height:d.height},children:w.map((h,g)=>{if(!kt(h,t,f))return null;const m=h.domain==="pixel"?1/n:1,p=h.domain==="pixel"?1/r:1,P=h.position.minX*m*100,_=h.position.minY*p*100,M=h.label??E[String(h.class_id)]??`#${h.class_id}`,S=h.score!=null?` ${(h.score*100).toFixed(0)}%`:"";return!M&&!S?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${P}%`,top:`${_}%`,transform:"translateY(-100%)",backgroundColor:nt(h.class_id)},children:i.jsxs("span",{className:"mono",children:[M,S]})},g)})})]})}const it=30,ie=["#ff5a5a","#39d353","#5b9bff"];function st(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function ee(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):st(e/255):st(n==="int"?e*255:e)}const Xn={x:0,y:0,w:1,h:1};function De({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:f=0,onActiveChange:d,sourceWindow:l=Xn}){const v=c.useRef(null),y=c.useRef(!1),w=ot(),u=c.useRef(d);u.current=d;const E=c.useCallback(g=>{var m;g!==y.current&&(y.current=g,(m=u.current)==null||m.call(u,g))},[]),h=c.useCallback(()=>{var me;const g=v.current,m=e.current;if(!g)return;const p=window.devicePixelRatio||1,P=g.clientWidth,_=g.clientHeight;if(P===0||_===0)return;g.width!==Math.round(P*p)&&(g.width=Math.round(P*p)),g.height!==Math.round(_*p)&&(g.height=Math.round(_*p));const M=g.getContext("2d");if(!M)return;if(M.setTransform(p,0,0,p,0,0),M.clearRect(0,0,P,_),!m||t<=0||n<=0){E(!1);return}const S=m.getBoundingClientRect(),D=g.getBoundingClientRect();if(S.width===0||S.height===0){E(!1);return}const k=l.x*t,L=l.y*n,U=l.w*t,X=l.h*n;if(U<=0||X<=0){E(!1);return}const A=Math.min(S.width/U,S.height/X);if(A<it){E(!1);return}const R=U*A,G=X*A,z=S.left+(S.width-R)/2-D.left,K=S.top+(S.height-G)/2-D.top,se=Math.max(Math.floor(k),Math.floor(k+(0-z)/A)),ne=Math.min(Math.ceil(k+U),Math.ceil(k+(P-z)/A)),le=Math.max(Math.floor(L),Math.floor(L+(0-K)/A)),he=Math.min(Math.ceil(L+X),Math.ceil(L+(_-K)/A));if(ne<=se||he<=le){E(!1);return}E(!0);const oe=z+(0-k)*A,ce=K+(0-L)*A,pe=z+(t-k)*A,be=K+(n-L)*A;M.save(),M.beginPath(),M.rect(oe,ce,pe-oe,be-ce),M.clip(),M.textAlign="center",M.textBaseline="middle",M.lineJoin="round";const ve=A*.14,ge=A-ve*2;for(let F=le;F<he;F++)for(let x=se;x<ne;x++){if(x<0||F<0||x>=t||F>=n)continue;const C=a(x,F,s);if(!C||C.lines.length===0)continue;const b=C.lines.length;let T=1;for(const Y of C.lines)Y.length>T&&(T=Y.length);const I=ge/(b*1.15),B=ge/(T*.62)||I,W=Math.min(I,B,24);if(W<6)continue;const $=z+(x-k+.5)*A,N=K+(F-L+.5)*A,q=W*1.15,J=C.luminance<=.55,O=J?"#ffffff":"#000000";M.font=`${W}px ui-monospace, SFMono-Regular, Menlo, monospace`,M.lineWidth=Math.max(1.4,W*.16),M.strokeStyle=J?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let H=N-b*q/2+q/2;for(let Y=0;Y<C.lines.length;Y++){const te=C.lines[Y];M.strokeText(te,$,H),M.fillStyle=((me=C.colors)==null?void 0:me[Y])??O,M.fillText(te,$,H),H+=q}}M.restore()},[e,t,n,a,s,E,l]);return c.useEffect(()=>{h()},[h,r,o.x,o.y,f,s,l,w]),c.useEffect(()=>{const g=v.current;if(!g)return;const m=new ResizeObserver(()=>h());return m.observe(g),()=>m.disconnect()},[h]),i.jsx("canvas",{ref:v,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function It({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Wn=`
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
`,$n=`
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

@group(0) @binding(0) var t_bind0: texture_2d<f32>; // texA
@group(0) @binding(3) var t_bind1: texture_2d<f32>; // texB
@group(0) @binding(6) var t_bind2: texture_2d<f32>; // LUT
@group(0) @binding(11) var<uniform> u_bind3: vec4<f32>; // exposureEV, operatorId, gamma, isScalar
@group(0) @binding(14) var<uniform> u_bind4: vec4<f32>; // uvRect.xy, uvRect.wh
@group(0) @binding(17) var<uniform> u_bind5: vec4<f32>; // modeId, split, alpha, diffSubmodeId
@group(0) @binding(20) var<uniform> u_bind6: vec4<f32>; // diffCmapModeId, hdrOut, useColormap, unused
@group(0) @binding(23) var<uniform> u_bind7: f32; // filterMode (0=nearest, 1=linear)

// --- ported verbatim from image/tonemap.ts (see image.wgsl.ts's doc comment) ---

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

fn applyOperator(rgb: vec3<f32>, operatorId: i32) -> vec3<f32> {
  if (operatorId == 2) {
    return vec3<f32>(reinhardCurve(rgb.x), reinhardCurve(rgb.y), reinhardCurve(rgb.z));
  }
  if (operatorId == 3) {
    return vec3<f32>(acesCurve(rgb.x), acesCurve(rgb.y), acesCurve(rgb.z));
  }
  return clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
}

// Nearest-texelFetch LUT lookup, round-half-up index (see image.wgsl.ts's doc
// comment) — shared by the scalar-image path (processSide) and the diff
// colormap path.
fn sampleLUT(valueUnit: f32) -> vec3<f32> {
  let idxF = clamp(valueUnit, 0.0, 1.0) * 255.0;
  let idx = clamp(i32(floor(idxF + 0.5)), 0, 255);
  return textureLoad(t_bind2, vec2<i32>(idx, 0), 0).rgb;
}

// Manual bilinear blend over EITHER source texture (texA or texB — see
// image.wgsl.ts's sampleBilinearF doc comment for the full rationale; this
// is parameterized over which texture since compare.wgsl.ts has two).
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

// image.wgsl.ts's fs_main body, factored out so it can run once per side.
fn processSide(sampled: vec4<f32>, exposureEV: f32, operatorId: i32, gamma: f32, isScalar: bool, hdrOut: bool) -> vec3<f32> {
  var rgb = sampled.rgb * exp2(exposureEV);
  if (isScalar) {
    rgb = sampleLUT(rgb.x);
  }
  rgb = applyOperator(rgb, operatorId);
  if (hdrOut) {
    return rgb;
  }
  let hasGamma = gamma > 0.0;
  return vec3<f32>(
    outputEncodeF(rgb.r, gamma, hasGamma),
    outputEncodeF(rgb.g, gamma, hasGamma),
    outputEncodeF(rgb.b, gamma, hasGamma),
  );
}

// Ported verbatim from image/webgl-diff.ts's computeDiffChannel (already
// [0,1]-normalized-float semantics) — mode: 0=signed,1=absolute,2=squared,
// 3=relative_signed,4=relative_absolute,5=relative_squared (DIFF_MODE_MAP order).
fn diffChannel(a: f32, b: f32, mode: i32) -> f32 {
  let diff = a - b;
  let absDiff = abs(diff);
  let denom = max(a, 1.0 / 255.0);
  if (mode == 0) {
    return (diff + 1.0) / 2.0;
  }
  if (mode == 1) {
    return absDiff;
  }
  if (mode == 2) {
    return diff * diff;
  }
  if (mode == 3) {
    return (diff / denom + 1.0) / 2.0;
  }
  if (mode == 4) {
    return absDiff / denom;
  }
  if (mode == 5) {
    return (diff * diff) / (denom * denom);
  }
  return absDiff;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(0.999999));
  let uvRect = u_bind4;
  // Image-space UV, UNCLAMPED — Q18 (see image.wgsl.ts's doc comment). texA
  // and texB share one uvRect/srcUV, so this is a single in/out-of-bounds
  // decision for the whole fragment.
  let rawSrcUV = uvRect.xy + uv * uvRect.zw;
  if (rawSrcUV.x < 0.0 || rawSrcUV.x >= 1.0 || rawSrcUV.y < 0.0 || rawSrcUV.y >= 1.0) {
    return vec4<f32>(0.0);
  }
  let srcUV = clamp(rawSrcUV, vec2<f32>(0.0), vec2<f32>(0.999999));
  let filterLinear = u_bind7 > 0.5;

  let dimsA = vec2<f32>(textureDimensions(t_bind0));
  var sampledA: vec4<f32>;
  if (filterLinear) {
    sampledA = sampleBilinearOf(t_bind0, srcUV, dimsA);
  } else {
    sampledA = textureLoad(t_bind0, vec2<i32>(srcUV * dimsA), 0);
  }

  let dimsB = vec2<f32>(textureDimensions(t_bind1));
  var sampledB: vec4<f32>;
  if (filterLinear) {
    sampledB = sampleBilinearOf(t_bind1, srcUV, dimsB);
  } else {
    sampledB = textureLoad(t_bind1, vec2<i32>(srcUV * dimsB), 0);
  }

  let exposureEV = u_bind3.x;
  let operatorId = i32(round(u_bind3.y));
  let gamma = u_bind3.z;
  let isScalar = u_bind3.w > 0.5;
  let hdrOut = u_bind6.y > 0.5;

  let colorA = processSide(sampledA, exposureEV, operatorId, gamma, isScalar, hdrOut);
  let colorB = processSide(sampledB, exposureEV, operatorId, gamma, isScalar, hdrOut);

  let modeId = i32(round(u_bind5.x));
  let split = u_bind5.y;
  let alpha = u_bind5.z;
  let diffSubmodeId = i32(round(u_bind5.w));
  let diffCmapModeId = i32(round(u_bind6.x));
  let useColormap = u_bind6.z > 0.5;

  var outColor: vec3<f32>;
  if (modeId == 1) {
    // blend
    outColor = mix(colorA, colorB, alpha);
  } else if (modeId == 2) {
    // diff
    let dr = diffChannel(colorA.r, colorB.r, diffSubmodeId);
    let dg = diffChannel(colorA.g, colorB.g, diffSubmodeId);
    let db = diffChannel(colorA.b, colorB.b, diffSubmodeId);
    let diffRGB = clamp(vec3<f32>(dr, dg, db), vec3<f32>(0.0), vec3<f32>(1.0));
    if (useColormap) {
      let avg = (diffRGB.r + diffRGB.g + diffRGB.b) / 3.0;
      var idx = avg;
      if (diffCmapModeId == 2) {
        idx = 0.5 + avg * 0.5;
      }
      outColor = sampleLUT(idx);
    } else {
      outColor = diffRGB;
    }
  } else {
    // split (default)
    outColor = select(colorB, colorA, uv.x < split);
  }

  return vec4<f32>(outColor, 1.0);
}
`,Ve={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Dt=new WeakMap;function Yn(e,t){let n=Dt.get(e);n||(n=new Map,Dt.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Wn,targetFormat:t}),n.set(t,r)),r}function Ut(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Rt(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Hn(e,t,n,r){var E;const o=Ut(t),a=Yn(e,o),s=Rt(e,r.isScalar?r.colormap:void 0),f=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,d=Ve[r.operator]??Ve.srgb,l=new Float32Array([r.exposureEV,d,f,r.isScalar?1:0]),v=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),y=new Float32Array([r.hdrOut?1:0]),w=new Float32Array([r.filter==="nearest"?0:1]);let u;try{u=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:v}},{binding:4,resource:{uniform:y}},{binding:5,resource:{uniform:w}}]),e.renderFullscreen(t,a,u)}finally{(E=u==null?void 0:u.destroy)==null||E.call(u),s.destroy()}}const qn={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Zn={linear:0,signed:1,positive:2},Kn={split:0,blend:1,diff:2},Lt=new WeakMap;function jn(e,t){let n=Lt.get(e);n||(n=new Map,Lt.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:$n,targetFormat:t}),n.set(t,r)),r}function Qn(e,t,n,r,o){var p;const a=Ut(t),s=jn(e,a),f=o.mode==="diff"&&!!o.diffColormap,d=o.isScalar?o.colormap:f?o.diffColormap:void 0,l=Rt(e,d),v=typeof o.gamma=="number"&&o.gamma>0?o.gamma:0,y=Ve[o.operator]??Ve.srgb,w=new Float32Array([o.exposureEV,y,v,o.isScalar?1:0]),u=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),E=new Float32Array([Kn[o.mode],o.split,o.alpha,qn[o.diffSubmode]??0]),h=new Float32Array([Zn[o.diffCmapMode??"linear"]??0,o.hdrOut?1:0,f?1:0,0]),g=new Float32Array([o.filter==="nearest"?0:1]);let m;try{m=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:w}},{binding:4,resource:{uniform:u}},{binding:5,resource:{uniform:E}},{binding:6,resource:{uniform:h}},{binding:7,resource:{uniform:g}}]),e.renderFullscreen(t,s,m)}finally{(p=m==null?void 0:m.destroy)==null||p.call(m),l.destroy()}}function Ot(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function Jn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:w,sumAbs:u}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return Ot(w,u,a)}const s=await e.readback(t),f=await e.readback(n),d=s instanceof Uint8Array,l=f instanceof Uint8Array;let v=0,y=0;for(let w=0;w<o;w++)for(let u=0;u<r;u++){const E=(w*t.width+u)*4,h=(w*n.width+u)*4;for(let g=0;g<3;g++){const m=(s[E+g]??0)/(d?255:1),p=(f[h+g]??0)/(l?255:1),P=m-p;v+=P*P,y+=Math.abs(P)}}return Ot(v,y,a)}function Gt(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const er=12,Te=[];function Ft(e){const t=Te.indexOf(e);t!==-1&&Te.splice(t,1),Te.push(e)}function tr(e){const t=Te.indexOf(e);t!==-1&&Te.splice(t,1)}function ze(e){e.parked||(tr(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Bt(e){for(;Te.length>er;){const t=Te.find(n=>n!==e&&!n.visible)??Te.find(n=>n!==e);if(!t)break;ze(t)}}function Nt(e){var o,a;if(e.disposed)return;if(Gt())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Ft(e),Bt(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,Ft(e),Bt(e)}function nr(e,t){if(e.disposed||!e.source)return!0;try{return Nt(e),!e.surface||!e.srcTexture?!1:(Hn(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,ze(e),!1}}function rr(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return nr(e,t)},park(){e.disposed||ze(e)},restore(){e.disposed||!e.source||Nt(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(ze(e),e.source=null,e.disposed=!0)}}}async function or(e,t){const n=await Fe(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return rr(r)}function Vt(e){e.dispose()}function ar(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function zt(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:f,flipSign:d}=e,l=c.useMemo(()=>ar(e,n),[n,r,o,s,d]);return{gammaFilterId:n,filterStr:l,gamma:a,offset:f}}function Xt({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Wt(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function ir({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Wt(e),a=Wt(t),s=[];for(let p=0;p<=e;p+=o)s.push(p);const f=[];for(let p=0;p<=t;p+=a)f.push(p);const d=1/n,l=8*d,v=-12*d,y=-2*d,w=r==null?void 0:r.current;let u=0,E=0,h=0,g=0;if(w){const p=w.clientWidth,P=w.clientHeight,_=p/e,M=P/t,S=Math.min(_,M);h=e*S,g=t*S,u=(p-h)/2,E=(P-g)/2}const m=w&&h>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?E:0,transform:`translateY(${v}px)`,fontSize:l},children:s.map(p=>i.jsx("span",{className:"mono",style:{position:"absolute",left:m?u+p/e*h:`${p/e*100}%`,transform:"translateX(-50%)"},children:p},p))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?u:0,transform:`translateX(${y}px)`,fontSize:l},children:f.map(p=>i.jsx("span",{className:"mono",style:{position:"absolute",top:m?E+p/t*g:`${p/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*d}px`},children:p},p))})]})}function sr({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const cr=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function $t(e,t){const n=getComputedStyle(e),r=cr.map(d=>`${d}:${n.getPropertyValue(d)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,f=Math.min(a.length,s.length);for(let d=0;d<f;d++)$t(a[d],s[d])}function ct(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function lt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function ut(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((f,d)=>a.toBlob(l=>l?f(l):d(new Error("plot-to-png: toBlob returned null")),"image/png"))}function lr(e,t,n){const r=e.cloneNode(!0);$t(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,f)=>{const d=new Image;d.onload=()=>s(d),d.onerror=()=>f(new Error("plot-to-png: SVG rasterization failed")),d.src=a})}async function Yt(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??ct(e);return ut(r,o,lt(t),a,s=>s.drawImage(e,0,0,r,o))}async function ur(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??ct(e);try{return await ut(r,o,lt(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function dr(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function fr(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,f=(t==null?void 0:t.background)??ct(e);if(n){const l=n.getBoundingClientRect(),v=await lr(n,l.width||a,l.height||s);return ut(a,s,lt(t),f,y=>{for(const w of r){const u=w.getBoundingClientRect();y.drawImage(w,u.left-o.left,u.top-o.top,u.width,u.height)}y.drawImage(v,l.left-o.left,l.top-o.top,l.width,l.height)})}if(r.length)return Yt(r[0],t);const d=dr(e);if(d)return ur(d,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function hr(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const gr={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},pr={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]})};function mr({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:pr[e]??null})}function Ee({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(mr,{name:e??""})})}function Xe(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function br({controller:e,config:t}){if((t==null?void 0:t.enabled)===!1)return null;const n=e.capabilities,r=t==null?void 0:t.buttons,o=(u,E)=>E&&(r==null?void 0:r[u])!==!1,a=u=>()=>e.setDragMode(u),s=o("zoom",n.zoom)||o("pan",n.pan)||o("select",n.select)||o("lasso",n.lasso),f=o("zoomIn",n.zoom)||o("zoomOut",n.zoom),d=o("autoscale",n.autoscale)||o("reset",n.reset),l=o("screenshot",n.screenshot),v=(t==null?void 0:t.leadingButtons)??[];if(!v.length&&!s&&!f&&!d&&!l)return null;const y=(t==null?void 0:t.position)??"top-right",w=(t==null?void 0:t.visibility)==="always";return i.jsxs("div",{style:{position:"absolute",pointerEvents:"auto",...gr[y]},className:["z-20 flex items-center gap-0.5 rounded border border-border","bg-bg-elevated/90 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-opacity",w?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),role:"toolbar","aria-label":"Plot controls",children:[v.length>0&&i.jsxs(i.Fragment,{children:[v.map(u=>i.jsx(Ee,{icon:u.icon,label:u.label,title:u.title,active:u.active,disabled:u.disabled,onClick:u.onClick},u.id)),(s||f||d||l)&&i.jsx(Xe,{})]}),s&&i.jsxs(i.Fragment,{children:[o("zoom",n.zoom)&&i.jsx(Ee,{icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:a("zoom")}),o("pan",n.pan)&&i.jsx(Ee,{icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:a("pan")}),o("select",n.select)&&i.jsx(Ee,{icon:"select",title:"Box select",active:e.dragMode==="select",onClick:a("select")}),o("lasso",n.lasso)&&i.jsx(Ee,{icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:a("lasso")})]}),f&&i.jsxs(i.Fragment,{children:[s&&i.jsx(Xe,{}),o("zoomIn",n.zoom)&&i.jsx(Ee,{icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),o("zoomOut",n.zoom)&&i.jsx(Ee,{icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()})]}),d&&i.jsxs(i.Fragment,{children:[(s||f)&&i.jsx(Xe,{}),o("autoscale",n.autoscale)&&i.jsx(Ee,{icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),o("reset",n.reset)&&i.jsx(Ee,{icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()})]}),l&&i.jsxs(i.Fragment,{children:[(s||f||d)&&i.jsx(Xe,{}),i.jsx(Ee,{icon:"camera",title:"Download plot as PNG",onClick:()=>{e.toPNG({filename:"plot"}).then(u=>hr(u,"plot.png")).catch(()=>{})}})]})]})}const vr={zoom:1,pan:{x:0,y:0}},Ht=1.3,wr=.25,xr=64,yr={buttons:{zoom:!1}};function Er(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}function _r({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:f=wr,maxZoom:d=xr,requestRender:l}){const v=c.useCallback(_=>{var G;if(!o)return;const M=(G=e.current)==null?void 0:G.getBoundingClientRect(),S=(M==null?void 0:M.width)??0,D=(M==null?void 0:M.height)??0,k=a&&s&&S>0&&D>0?Tt(a,s,S,D):d,L=Math.max(f,Math.min(k,n*_));if(L===n)return;const U=S/2,X=D/2,A=U-(U-r.x)/n*L,R=X-(X-r.y)/n*L;o({zoom:L,pan:{x:A,y:R}})},[o,e,a,s,d,f,n,r.x,r.y]),y=c.useCallback(()=>v(Ht),[v]),w=c.useCallback(()=>v(1/Ht),[v]),u=c.useCallback(()=>o==null?void 0:o(vr),[o]),E=c.useCallback(_=>{const M={scale:_==null?void 0:_.scale,filename:_==null?void 0:_.filename};l==null||l();const S=t==null?void 0:t.current;if(S)return Yt(S,M);const D=e.current;return D?fr(D,M):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,l]),h=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),g=n!==1||r.x!==0||r.y!==0,m=c.useCallback(_=>{},[]),p=c.useCallback(_=>{},[]),P=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:h,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:g,setDragMode:m,setHoverMode:p,toggleSpikelines:P,zoomIn:y,zoomOut:w,autoscale:u,reset:u,toPNG:E}),[h,g,m,p,P,y,w,u,E])}const Mr={zoom:1,pan:{x:0,y:0}};function We({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:f,naturalDims:d,checkerboard:l,wrapperClassName:v,wrapperStyle:y,viewportPadding:w,header:u,surface:E,showAxes:h,overlayNode:g,overlay:m,notationSeed:p,exportCanvasRef:P,requestRender:_,label:M,showLabelChip:S,isDraggable:D=!1,onDragStart:k,extraChips:L}){const[U,X]=c.useState(p),[A,R]=c.useState(!1),{containerProps:G}=At({containerRef:r,zoom:a,pan:s,onViewportChange:f,naturalWidth:d==null?void 0:d.w,naturalHeight:d==null?void 0:d.h}),z=c.useCallback(()=>{f==null||f(Mr)},[f]),K=_r({rootRef:r,canvasRef:P,zoom:a,pan:s,onViewportChange:f,naturalWidth:d==null?void 0:d.w,naturalHeight:d==null?void 0:d.h,requestRender:_}),se=c.useMemo(()=>({...yr,leadingButtons:A?[Er(U,X)]:[]}),[A,U]),ne=" cairn-checkerboard",le="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(l==="pane"?ne:""),he=v+(l==="wrapper"?ne:""),oe="render"in m?m.render({notation:U,setOverlayActive:R}):m.hasSource&&d?i.jsx(De,{imageElRef:m.displayElRef,naturalWidth:d.w,naturalHeight:d.h,zoom:a,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:U,version:m.version,onActiveChange:R}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[u,n&&i.jsx(br,{controller:K,config:se}),i.jsxs("div",{ref:r,className:le,style:{padding:w,...G.style},onPointerDown:G.onPointerDown,onPointerMove:G.onPointerMove,onPointerUp:G.onPointerUp,onPointerCancel:G.onPointerCancel,onDoubleClick:z,...t,children:[i.jsxs("div",{ref:o,className:he,style:y,children:[E,h&&d&&i.jsx(ir,{naturalWidth:d.w,naturalHeight:d.h,zoom:a,containerRef:o}),g]}),oe,!n&&A&&i.jsx(It,{notation:U,onChange:X})]}),S&&i.jsx(sr,{label:M,isDraggable:D,onDragStart:k}),L]})}function qt(e){return"hdr"in e&&e.hdr!=null}function Zt(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function ue(e){return Number.isFinite(e)?e:0}const Sr={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Pr(e,t,n,r){const{h:o,w:a,c:s}=Zt(e.shape),f=e.data,d=Cn(t),l=new Uint8ClampedArray(a*o*4);for(let v=0;v<a*o;v++){const y=v*s;let w,u,E,h=1;s===1?w=u=E=ue(f[y]):s===3?(w=ue(f[y]),u=ue(f[y+1]),E=ue(f[y+2])):(w=ue(f[y]),u=ue(f[y+1]),E=ue(f[y+2]),h=ue(f[y+3]));const g=[et(w,n),et(u,n),et(E,n)],[m,p,P]=d(g),_=v*4;l[_]=255*tt(m,r),l[_+1]=255*tt(p,r),l[_+2]=255*tt(P,r),l[_+3]=255*(h<0?0:h>1?1:h)}return new ImageData(l,a,o)}function Cr(e){var q,J;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:f=!1,processing:d=Sr,zoom:l=1,pan:v={x:0,y:0},onViewportChange:y,onNaturalSize:w,label:u,isDraggable:E=!1,onDragStart:h,overlay:g,overlaySettings:m,pixelValueNotation:p="decimal",toolbar:P=!0}=e,_=c.useRef(null),M=c.useRef(null),S=c.useRef(null),D=c.useRef(null),k=c.useRef(null),L=c.useRef(null),U=c.useRef(null),[X,A]=c.useState(0),R=c.useCallback(()=>A(O=>O+1),[]),G=c.useMemo(()=>({get current(){const O=k.current;return O instanceof HTMLCanvasElement?O:null}}),[]),z=c.useCallback(O=>{_.current=O,O&&(k.current=O)},[]),K=c.useCallback(O=>{M.current=O,O&&(k.current=O)},[]),se=c.useCallback(O=>{O&&(k.current=O)},[]),[ne,le]=c.useState(!1),[he,oe]=c.useState(!1),[ce,pe]=c.useState(null),{flipSign:be}=d,{gammaFilterId:ve,filterStr:ge,gamma:me,offset:F}=zt(d),x=!r&&o!=="none"&&n!=null&&t!=null,C=o!=="none"&&n!=null,b=s!=="none"&&!x&&!(r&&C)&&t!=null;c.useEffect(()=>{if(!b||!t){oe(!1);return}let O=!1;oe(!1);const H=`${t}::${s}`,Y=Ke(H);if(Y){const Z=M.current;if(Z){Z.width=Y.width,Z.height=Y.height;const re=Z.getContext("2d");re&&re.putImageData(Y,0,0),U.current=Y,R(),pe({w:Y.width,h:Y.height}),w==null||w(Y.width,Y.height),oe(!0)}return}const te=new Image;return te.onload=()=>{if(O)return;const Z=document.createElement("canvas");Z.width=te.naturalWidth,Z.height=te.naturalHeight;const re=Z.getContext("2d");if(!re)return;re.drawImage(te,0,0);const _e=re.getImageData(0,0,Z.width,Z.height),Ae=bt.has(s)?"positive":"linear",ae=Ze(_e,s,Ae);je(H,ae);const Me=M.current;if(!Me||O)return;Me.width=ae.width,Me.height=ae.height;const de=Me.getContext("2d");de&&de.putImageData(ae,0,0),U.current=ae,R(),pe({w:ae.width,h:ae.height}),w==null||w(ae.width,ae.height),oe(!0)},te.src=t,()=>{O=!0}},[b,t,s]);const T=c.useCallback((O,H)=>{pe(Y=>Y&&Y.w===O&&Y.h===H?Y:{w:O,h:H}),w==null||w(O,H)},[]);c.useEffect(()=>{if(!t){L.current=null,U.current=null,R();return}let O=!1;return ke(t).then(H=>{O||(L.current=H,s==="none"&&(U.current=H),R())}),()=>{O=!0}},[t,s,R]);const I=c.useCallback((O,H,Y)=>{const te=L.current;if(!te||O<0||H<0||O>=te.width||H>=te.height)return null;const Z=(H*te.width+O)*4,re=te.data[Z],_e=te.data[Z+1],Ae=te.data[Z+2],ae=U.current;let Me=re,de=_e,Se=Ae;if(ae&&ae.width===te.width&&ae.height===te.height){const Ue=(H*ae.width+O)*4;Me=ae.data[Ue],de=ae.data[Ue+1],Se=ae.data[Ue+2]}const Le=(.299*Me+.587*de+.114*Se)/255;return s!=="none"||re===_e&&_e===Ae?{lines:[ee(re,"uint8",Y)],luminance:Le}:{lines:[ee(re,"uint8",Y),ee(_e,"uint8",Y),ee(Ae,"uint8",Y)],luminance:Le,colors:[ie[0],ie[1],ie[2]]}},[s]);c.useEffect(()=>{if(!x){le(!1);return}let O=!1;const H=Sn(),Y=H==="gpu"||H==="auto",te=`${n}::${t}::${o}::${s}`;if(H!=="gpu"){const Z=Ke(te);if(Z){const re=_.current;if(re){(re.width!==Z.width||re.height!==Z.height)&&(re.width=Z.width,re.height=Z.height);const _e=re.getContext("2d");_e&&_e.putImageData(Z,0,0),T(Z.width,Z.height),le(!0)}return}}return(async()=>{const[Z,re]=await Promise.all([ke(n),ke(t)]);if(O||!Z||!re)return;const Ae=o.includes("signed")?"signed":"positive",ae=s!=="none"?qe(s):null,Me={diffMode:o,colormap:ae,cmapMode:Ae};if(Y)try{const Oe=_.current;if(Oe){const Ue=_n(Z,re,Me,Oe);if(Ue){if(O)return;T(Ue.width,Ue.height),le(!0);return}}}catch(Oe){console.warn("[cairn] WebGL 2 diff error:",Oe)}if(H==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let de=mn(Z,re,o);s!=="none"&&(de=Ze(de,s,Ae)),je(te,de);const Se=_.current;if(!Se||O)return;(Se.width!==de.width||Se.height!==de.height)&&(Se.width=de.width,Se.height=de.height);const Le=Se.getContext("2d");Le&&Le.putImageData(de,0,0),T(de.width,de.height),le(!0)})(),()=>{O=!0}},[n,t,o,x,s,w]);const B=a==="auto"?void 0:a,W=be?{filter:"invert(1)"}:{},$=g&&(m!=null&&m.enabled)&&ce&&t&&((((q=g.boxes)==null?void 0:q.length)??0)>0||(((J=g.masks)==null?void 0:J.length)??0)>0)?i.jsx(at,{data:g,settings:m,naturalWidth:ce.w,naturalHeight:ce.h}):void 0,N=t?x?i.jsxs(i.Fragment,{children:[!ne&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:z,className:"w-full h-full object-contain block",style:{display:ne?"block":"none",imageRendering:B,...W}})]}):b?i.jsxs(i.Fragment,{children:[!he&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:K,className:"w-full h-full object-contain block",style:{display:he?"block":"none",imageRendering:B,...W}})]}):i.jsx("img",{ref:se,src:t,alt:u,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ge,imageRendering:B},onLoad:O=>{const H=O.currentTarget;pe({w:H.naturalWidth,h:H.naturalHeight}),w==null||w(H.naturalWidth,H.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(We,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:P,paneRef:S,wrapperRef:D,zoom:l,pan:v,onViewportChange:y,naturalDims:ce,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${v.x}px, ${v.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:f&&ce?"16px 4px 4px 28px":"4px",header:i.jsx(Xt,{id:ve,gamma:me,offset:F}),surface:N,showAxes:f,overlayNode:$,overlay:{displayElRef:k,sample:I,version:X,hasSource:!!t},notationSeed:p,exportCanvasRef:G,label:u,showLabelChip:!0,isDraggable:E,onDragStart:h})}function Tr(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:f="auto",zoom:d=1,pan:l={x:0,y:0},onViewportChange:v,pixelValueNotation:y="decimal",toolbar:w=!0}=e,u=c.useRef(null),E=c.useRef(null),h=c.useRef(null),[g,m]=c.useState(null),p=c.useRef(null),[P,_]=c.useState(0);c.useEffect(()=>{const D=u.current;if(!D)return;let k;try{k=Pr(t,n,r,o)}catch(U){console.error("[cairn] HDR tone-map error:",U);return}(D.width!==k.width||D.height!==k.height)&&(D.width=k.width,D.height=k.height);const L=D.getContext("2d");L&&(L.putImageData(k,0,0),p.current=k,_(U=>U+1),m(U=>U&&U.w===k.width&&U.h===k.height?U:{w:k.width,h:k.height}))},[t,n,r,o]);const M=c.useCallback((D,k,L)=>{const U=g;if(!U||D<0||k<0||D>=U.w||k>=U.h)return null;const X=t.shape.length===2?1:t.shape[2]??1,A=(k*U.w+D)*X,R=t.data,G=p.current;let z=.5;if(G&&G.width===U.w&&G.height===U.h){const K=(k*U.w+D)*4;z=(.299*G.data[K]+.587*G.data[K+1]+.114*G.data[K+2])/255}return X===1?{lines:[ee(R[A]??0,"unit",L)],luminance:z}:{lines:[ee(R[A]??0,"unit",L),ee(R[A+1]??0,"unit",L),ee(R[A+2]??0,"unit",L)],luminance:z,colors:[ie[0],ie[1],ie[2]]}},[t,g]),S=f==="auto"?void 0:f;return i.jsx(We,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:w,paneRef:E,wrapperRef:h,zoom:d,pan:l,onViewportChange:v,naturalDims:g,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${l.x}px, ${l.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:a&&g?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:u,className:"w-full h-full object-contain block",style:{imageRendering:S}}),showAxes:a,overlay:{displayElRef:u,sample:M,version:P,hasSource:!0},notationSeed:y,exportCanvasRef:u,label:s,showLabelChip:!!s})}function dt(e){return qt(e)?i.jsx(Tr,{...e}):i.jsx(Cr,{...e})}const Ar=["linear","srgb","reinhard","aces"];function kr(e){return e&&Ar.includes(e)?e:"srgb"}function Ir(e){const{h:t,w:n,c:r}=Zt(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const f=s*r;let d,l,v,y=1;r===1?d=l=v=ue(o[f]):r===3?(d=ue(o[f]),l=ue(o[f+1]),v=ue(o[f+2])):(d=ue(o[f]),l=ue(o[f+1]),v=ue(o[f+2]),y=ue(o[f+3]));const w=s*4;a[w]=d,a[w+1]=l,a[w+2]=v,a[w+3]=y}return{data:a,width:n,height:t,format:"rgba32float"}}function Kt(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,f=(t.width-a)/2,d=(t.height-s)/2,l=Math.max(e.zoom,1e-6),v=t.width/(l*a),y=t.height/(l*s),w=-f/a-e.pan.x/(l*a),u=-d/s-e.pan.y/(l*s);return{x:w,y:u,w:v,h:y}}function jt(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function Dr(e){var ge,me;const t=qt(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(!1),[f,d]=c.useState(!1),[l,v]=c.useState(!1),[y,w]=c.useState(null),[u,E]=c.useState(0),[h,g]=c.useState(0),[m,p]=c.useState({x:0,y:0,w:1,h:1}),P=c.useRef(null),_=c.useRef(null),[M,S]=c.useState(0),D=e.zoom??1,k=e.pan??{x:0,y:0},L=e.onViewportChange,U=t?"none":e.colormap??"none",X=ot();c.useEffect(()=>{const F=n.current;if(!F)return;let x=!1;return Fe().then(C=>{if(x)return;const b=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,T=C.capabilities.hdr&&b&&t;s.current=T,or(F,{hdr:T}).then(I=>{if(x){Vt(I);return}a.current=I,v(!0)}).catch(I=>{x||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",I),d(!0))})}).catch(C=>{x||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",C),d(!0))}),()=>{x=!0,a.current&&(Vt(a.current),a.current=null)}},[]),c.useEffect(()=>{const F=r.current;if(!F)return;const x=new ResizeObserver(()=>g(C=>C+1));return x.observe(F),()=>x.disconnect()},[]),c.useEffect(()=>{const F=r.current;if(!F)return;const x=new IntersectionObserver(C=>{const b=C[0];if(!b)return;const T=a.current;T&&(T.setVisible(b.isIntersecting),b.isIntersecting?T.isParked&&(T.restore(),g(I=>I+1)):T.park())},{threshold:0});return x.observe(F),()=>x.disconnect()},[]),c.useEffect(()=>{var C;if(!t||!l)return;const F=e.hdr;P.current=F;const x=Ir(F);(C=a.current)==null||C.setSource(x),w(b=>b&&b.w===x.width&&b.h===x.height?b:{w:x.width,h:x.height}),S(b=>b+1),E(b=>b+1)},[t,l,t?e.hdr:null]),c.useEffect(()=>{if(t||!l)return;const F=e,x=F.imageUrl,C=F.colormap??"none";if(!x){_.current=null,w(null),S(T=>T+1);return}let b=!1;return ke(x).then(T=>{var W,$;if(b||!T)return;let I=T;if(C!=="none"){const N=`gpu::${x}::${C}`,q=Ke(N);if(q)I=q;else{const J=bt.has(C)?"positive":"linear";I=Ze(T,C,J),je(N,I)}}_.current=T;const B={data:I.data,width:I.width,height:I.height,format:"rgba8unorm"};(W=a.current)==null||W.setSource(B),w(N=>N&&N.w===I.width&&N.h===I.height?N:{w:I.width,h:I.height}),($=F.onNaturalSize)==null||$.call(F,I.width,I.height),S(N=>N+1),E(N=>N+1)}),()=>{b=!0}},[t,l,t?null:e.imageUrl,t?null:e.colormap]);const A=t?e.exposure??0:0,R=t?e.tonemap:void 0,G=t?e.gamma:void 0,z=c.useCallback(()=>{const F=a.current;if(!F||!l||!y)return;const x=r.current,C=o.current,b=C?C.getBoundingClientRect():x?x.getBoundingClientRect():{width:y.w,height:y.h},T=Kt({zoom:D,pan:k},b,y.w,y.h);p($=>$.x===T.x&&$.y===T.y&&$.w===T.w&&$.h===T.h?$:T),b.width>0&&b.height>0&&F.resize(Math.round(b.width*X),Math.round(b.height*X));const I=jt(T,b,y.w,y.h)>=it?"nearest":"linear",B=T,W=t?{exposureEV:A,operator:s.current?"extended":kr(R),gamma:G,isScalar:!1,hdrOut:s.current,uv:B,filter:I}:{exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:B,filter:I};try{F.render(W)||d(!0)}catch($){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",$),d(!0)}},[l,y,D,k.x,k.y,A,R,G,t,X]);c.useEffect(()=>{z()},[z,u,h]);const K=c.useCallback((F,x,C)=>{if(t){const q=P.current,J=y;if(!q||!J||F<0||x<0||F>=J.w||x>=J.h)return null;const O=q.shape.length===2?1:q.shape[2]??1,H=(x*J.w+F)*O,Y=q.data,te=.5;return O===1?{lines:[ee(Y[H]??0,"unit",C)],luminance:te}:{lines:[ee(Y[H]??0,"unit",C),ee(Y[H+1]??0,"unit",C),ee(Y[H+2]??0,"unit",C)],luminance:te,colors:[ie[0],ie[1],ie[2]]}}const b=_.current;if(!b||F<0||x<0||F>=b.width||x>=b.height)return null;const T=(x*b.width+F)*4,I=b.data[T],B=b.data[T+1],W=b.data[T+2],$=(.299*I+.587*B+.114*W)/255;return U!=="none"||I===B&&B===W?{lines:[ee(I,"uint8",C)],luminance:$}:{lines:[ee(I,"uint8",C),ee(B,"uint8",C),ee(W,"uint8",C)],luminance:$,colors:[ie[0],ie[1],ie[2]]}},[t,y,U]),se=e.showAxes??!1,ne=t?e.label??"":e.label,le=e.interpolation??"auto",he=le==="auto"?void 0:le,oe=t?void 0:e.overlay,ce=t?void 0:e.overlaySettings,pe=t?!1:e.isDraggable??!1,be=t?void 0:e.onDragStart;if(f)return t?i.jsx(dt,{...e}):i.jsx(dt,{...e});const ve=oe&&(ce!=null&&ce.enabled)&&y&&((((ge=oe.boxes)==null?void 0:ge.length)??0)>0||(((me=oe.masks)==null?void 0:me.length)??0)>0)?i.jsx(at,{data:oe,settings:ce,naturalWidth:y.w,naturalHeight:y.h}):void 0;return i.jsx(We,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":l},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:D,pan:k,onViewportChange:L,naturalDims:y,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:se&&y?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:he},"data-gpu-image-canvas":!0}),showAxes:se,overlayNode:ve,overlay:{displayElRef:n,sample:K,version:M,hasSource:!0,sourceWindow:m},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:z,label:ne,showLabelChip:!!ne,isDraggable:pe,onDragStart:be})}const Ur={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Rr({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:f,onViewportChange:d,processing:l=Ur,interpolation:v="auto",label:y="",isDraggable:w=!1,onDragStart:u,overlay:E,overlaySettings:h,pixelValueNotation:g="decimal"}){var F,x;const m=c.useRef(null),[p,P]=c.useState(null),[_,M]=c.useState(null),[S,D]=c.useState(g),[k,L]=c.useState(!1),U=c.useRef(null),X=c.useRef(null),A=c.useRef(null),R=c.useRef(null),[G,z]=c.useState(0);c.useEffect(()=>{if(!e){A.current=null,z(b=>b+1);return}let C=!1;return ke(e).then(b=>{C||(A.current=b,z(T=>T+1))}),()=>{C=!0}},[e]),c.useEffect(()=>{if(!t){R.current=null,z(b=>b+1);return}let C=!1;return ke(t).then(b=>{C||(R.current=b,z(T=>T+1))}),()=>{C=!0}},[t]);const K=C=>(b,T,I)=>{const B=C.current;if(!B||b<0||T<0||b>=B.width||T>=B.height)return null;const W=(T*B.width+b)*4,$=B.data[W],N=B.data[W+1],q=B.data[W+2],J=(.299*$+.587*N+.114*q)/255;return $===N&&N===q?{lines:[ee($,"uint8",I)],luminance:J}:{lines:[ee($,"uint8",I),ee(N,"uint8",I),ee(q,"uint8",I)],luminance:J,colors:[ie[0],ie[1],ie[2]]}},se=c.useMemo(()=>K(A),[]),ne=c.useMemo(()=>K(R),[]),le=!!E&&!!(h!=null&&h.enabled)&&!!p&&!!e&&((((F=E.boxes)==null?void 0:F.length)??0)>0||(((x=E.masks)==null?void 0:x.length)??0)>0),{gammaFilterId:he,filterStr:oe,gamma:ce,offset:pe}=zt(l),be=`translate(${f.x}px, ${f.y}px) scale(${s})`,ve=v==="auto"?void 0:v,{containerProps:ge,modifierActive:me}=At({containerRef:m,zoom:s,pan:f,onViewportChange:d});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(Xt,{id:he,gamma:ce,offset:pe}),i.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...ge.style},onPointerDown:ge.onPointerDown,onPointerMove:ge.onPointerMove,onPointerUp:ge.onPointerUp,onPointerCancel:ge.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:be,transformOrigin:"0 0"},children:[i.jsx("img",{ref:U,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:oe,imageRendering:ve,...n==="blend"?{opacity:o}:{}},onLoad:C=>{const b=C.currentTarget;P({w:b.naturalWidth,h:b.naturalHeight})}}),le&&i.jsx(at,{data:E,settings:h,naturalWidth:p.w,naturalHeight:p.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:be,transformOrigin:"0 0"},children:i.jsx("img",{ref:X,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:oe,imageRendering:ve,...n==="blend"?{opacity:1-o}:{}},onLoad:C=>{const b=C.currentTarget;M({w:b.naturalWidth,h:b.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:C=>{C.stopPropagation(),C.preventDefault();const T=C.currentTarget.parentElement.getBoundingClientRect(),I=W=>{a==null||a(Math.max(0,Math.min(1,(W.clientX-T.left)/T.width)))},B=()=>{window.removeEventListener("pointermove",I),window.removeEventListener("pointerup",B)};window.addEventListener("pointermove",I),window.addEventListener("pointerup",B)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&_&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(De,{imageElRef:X,naturalWidth:_.w,naturalHeight:_.h,zoom:s,pan:f,sample:ne,notation:S,version:G})}),e&&p&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(De,{imageElRef:U,naturalWidth:p.w,naturalHeight:p.h,zoom:s,pan:f,sample:se,notation:S,version:G,onActiveChange:L})})]}):e&&p&&i.jsx(De,{imageElRef:U,naturalWidth:p.w,naturalHeight:p.h,zoom:s,pan:f,sample:se,notation:S,version:G,onActiveChange:L}),k&&i.jsx(It,{notation:S,onChange:D})]}),i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${w&&!me?" cairn-drag-grip":""}`,draggable:w&&!me,onDragStart:u,style:{cursor:w&&!me?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),y]})]})}function Lr(e){const t=qe(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Or({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,diffSubmode:s,colormap:f="none",zoom:d,pan:l,onViewportChange:v,interpolation:y="auto",label:w="",pixelValueNotation:u="decimal"}){const E=c.useRef(null),h=c.useRef(null),g=c.useRef(null),m=c.useRef(null),[p,P]=c.useState(!1),[_,M]=c.useState(!1),[S,D]=c.useState(null),[k,L]=c.useState(0),[U,X]=c.useState(0),[A,R]=c.useState(null),[G,z]=c.useState({x:0,y:0,w:1,h:1}),K=c.useRef(null),se=c.useRef(null),[ne,le]=c.useState(0),he=ot();c.useEffect(()=>{const x=g.current;if(!x)return;let C=!1;return Fe().then(b=>{if(!C)try{if(Gt())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const T=b.createSurface(x,{hdr:!1});m.current={device:b,surface:T,texA:null,texB:null},M(!0)}catch(T){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",T),P(!0)}}).catch(b=>{C||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",b),P(!0))}),()=>{var T,I;C=!0;const b=m.current;b&&((T=b.texA)==null||T.destroy(),(I=b.texB)==null||I.destroy(),m.current=null)}},[]),c.useEffect(()=>{const x=E.current;if(!x)return;const C=new ResizeObserver(()=>X(b=>b+1));return C.observe(x),()=>C.disconnect()},[]),c.useEffect(()=>{if(!_)return;let x=!1;if(!m.current)return;async function b(T){return T?ke(T):null}return Promise.all([b(e),b(t)]).then(([T,I])=>{var N,q;if(x||!m.current)return;const B=m.current;K.current=T,se.current=I,(N=B.texA)==null||N.destroy(),(q=B.texB)==null||q.destroy(),B.texA=null,B.texB=null;const W=T??I;if(!W){D(null),le(J=>J+1);return}const $=J=>{const O=B.device.createTexture(J.width,J.height,"rgba8unorm");return O.write(J.data),O};B.texA=$(I??W),B.texB=$(T??W),D({w:W.width,h:W.height}),le(J=>J+1),L(J=>J+1)}),()=>{x=!0}},[_,e,t]);const oe=c.useMemo(()=>(s??"").includes("signed")?"signed":"positive",[s]),ce=c.useMemo(()=>f!=="none"?Lr(f):void 0,[f]),pe=c.useCallback(()=>{const x=m.current;if(!_||!x||!x.surface||!x.texA||!x.texB||!S)return;const C=E.current,b=C?C.getBoundingClientRect():{width:S.w,height:S.h},T=Kt({zoom:d,pan:l},b,S.w,S.h);z(N=>N.x===T.x&&N.y===T.y&&N.w===T.w&&N.h===T.h?N:T);const I=g.current;if(b.width>0&&b.height>0&&I&&x.surface){const N=Math.max(1,Math.round(b.width*he)),q=Math.max(1,Math.round(b.height*he));(I.width!==N||I.height!==q)&&(I.width=N,I.height=q,x.surface.configure(N,q))}const B=jt(T,b,S.w,S.h)>=it?"nearest":"linear",$={exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:T,filter:B,mode:n,split:r,alpha:o,diffSubmode:s??"absolute",diffCmapMode:oe,diffColormap:n==="diff"?ce:void 0};try{Qn(x.device,x.surface,x.texA,x.texB,$)}catch(N){console.warn("cairn-plot: GpuComparePane renderCompare failed, falling back to legacy pane",N),P(!0)}},[_,S,d,l.x,l.y,n,r,o,s,oe,ce,he]);c.useEffect(()=>{pe()},[pe,k,U]),c.useEffect(()=>{const x=m.current;if(!_||!x||!x.texA||!x.texB||!t){R(null);return}let C=!1;return Jn(x.device,x.texA,x.texB).then(b=>{C||R(b)}),()=>{C=!0}},[_,k,t]);const be=x=>(C,b,T)=>{const I=x.current;if(!I||C<0||b<0||C>=I.width||b>=I.height)return null;const B=(b*I.width+C)*4,W=I.data[B],$=I.data[B+1],N=I.data[B+2],q=(.299*W+.587*$+.114*N)/255;return W===$&&$===N?{lines:[ee(W,"uint8",T)],luminance:q}:{lines:[ee(W,"uint8",T),ee($,"uint8",T),ee(N,"uint8",T)],luminance:q,colors:[ie[0],ie[1],ie[2]]}},ve=c.useMemo(()=>be(K),[]),ge=c.useMemo(()=>be(se),[]),me=y==="auto"?void 0:y;if(p)return n==="diff"?i.jsx(dt,{imageUrl:e,baselineUrl:t,diffMode:s??"signed",interpolation:y,colormap:f,showAxes:!1,zoom:d,pan:l,onViewportChange:v,label:w,pixelValueNotation:u}):i.jsx(Rr,{imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:d,pan:l,onViewportChange:v,interpolation:y,label:w,pixelValueNotation:u});const F=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:g,className:"w-full h-full block",style:{imageRendering:me},"data-gpu-compare-canvas":!0}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:x=>{x.stopPropagation(),a==null||a(.5)},onPointerDown:x=>{x.stopPropagation(),x.preventDefault();const b=x.currentTarget.parentElement.getBoundingClientRect(),T=B=>{a==null||a(Math.max(0,Math.min(1,(B.clientX-b.left)/b.width)))},I=()=>{window.removeEventListener("pointermove",T),window.removeEventListener("pointerup",I)};window.addEventListener("pointermove",T),window.addEventListener("pointerup",I)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(We,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":_},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:E,wrapperRef:h,zoom:d,pan:l,onViewportChange:v,naturalDims:S,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:F,showAxes:!1,notationSeed:u,exportCanvasRef:g,requestRender:pe,label:"",showLabelChip:!1,overlay:{render:({notation:x,setOverlayActive:C})=>n==="split"?i.jsxs(i.Fragment,{children:[t&&S&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(De,{imageElRef:g,naturalWidth:S.w,naturalHeight:S.h,zoom:d,pan:l,sourceWindow:G,sample:ge,notation:x,version:ne})}),t&&S&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(De,{imageElRef:g,naturalWidth:S.w,naturalHeight:S.h,zoom:d,pan:l,sourceWindow:G,sample:ve,notation:x,version:ne,onActiveChange:C})})]}):S&&i.jsx(De,{imageElRef:g,naturalWidth:S.w,naturalHeight:S.h,zoom:d,pan:l,sourceWindow:G,sample:ve,notation:x,version:ne,onActiveChange:C})},extraChips:i.jsxs(i.Fragment,{children:[i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),w?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:w}):null,A&&i.jsxs("span",{className:"absolute right-1.5 top-9 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono","data-gpu-compare-metrics":!0,children:["MSE ",A.mse.toExponential(2)," · PSNR ",Number.isFinite(A.psnr)?A.psnr.toFixed(1):"∞"," dB · MAE"," ",A.mae.toExponential(2)]})]})})}const Gr="cairn-plot:gpu-image-ready";async function Fr(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Fe(),window.__cairnPlotGpuImagePane=Dr,window.__cairnPlotGpuComparePane=Or,window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Gr))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}Fr()})(__cairnPlotJsxRuntime,__cairnPlotReact);
