var qs=Object.defineProperty;var Zs=(i,c,$e)=>c in i?qs(i,c,{enumerable:!0,configurable:!0,writable:!0,value:$e}):i[c]=$e;var se=(i,c,$e)=>Zs(i,typeof c!="symbol"?c+"":c,$e);(function(i,c){"use strict";const $e=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function $t(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:$e}),{hdr:!1,format:n}}function or(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:$e}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:$e}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return $t(e,t)}}}const sr=`
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
`;function ht(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Xt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function ar(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const ir={texture:0,sampler:1,uniform:2};function gt(e,t){return e*3+ir[t]}const cr={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function lr(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const u=cr[s];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Wt{constructor(t,n,r,o){se(this,"width");se(this,"height");se(this,"format");se(this,"gpuTexture");se(this,"device");se(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:ht(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Xt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Yt{constructor(t){se(this,"_s");se(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class ur{constructor(t,n,r,o,a){se(this,"_p");se(this,"gpuPipeline");se(this,"bindings");se(this,"bindGroupLayout");se(this,"variants");se(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function dr(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class fr{constructor(t){se(this,"_c");se(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class pr{constructor(t,n){se(this,"_b");se(this,"gpuBindGroup");se(this,"ownedBuffers");se(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class hr{constructor(t,n,r,o){se(this,"canvas");se(this,"hdr");se(this,"format");se(this,"context");se(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function tt(e){return"canvas"in e}async function gr(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(f){return tt(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function s(f){if(tt(f))return{width:f.canvas.width,height:f.canvas.height};const v=f;return{width:v.width,height:v.height}}let u=!1;const l=256;let d=null,p=null;function g(){if(!d||!p){const f=t.createShaderModule({code:sr});p=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const v=t.createPipelineLayout({bindGroupLayouts:[p]});d=t.createComputePipeline({layout:v,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:d,layout:p}}return{backend:"webgpu",capabilities:n,createTexture(f,v,h){return new Wt(t,f,v,h)},createSampler(f){const v=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",h=t.createSampler({magFilter:v,minFilter:v,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Yt(h)},createRenderPipeline(f){const v=t.createShaderModule({code:f.shaderWGSL}),h=lr(f.shaderWGSL),b=ht(f.targetFormat),m=dr(t,h),w=t.createPipelineLayout({bindGroupLayouts:[m]}),M=T=>t.createRenderPipeline({layout:w,vertex:{module:v,entryPoint:"vs_main"},fragment:{module:v,entryPoint:"fs_main",targets:[{format:T}]},primitive:{topology:"triangle-list"}}),_=M(b);return new ur(_,h,m,b,M)},createComputePipeline(f){const v=t.createShaderModule({code:f.shaderWGSL}),h=t.createComputePipeline({layout:"auto",compute:{module:v,entryPoint:"cs_main"}});return new fr(h)},createBindGroup(f,v){const h=f,b=new Map,m=[];for(const[M,_]of h.bindings)if(_.kind==="uniform"){const T=t.createBuffer({size:_.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});m.push(T),b.set(M,{binding:M,resource:{buffer:T}})}else _.kind==="sampler"&&b.set(M,{binding:M,resource:o()});for(const M of v){const _=M.resource;if(_ instanceof Wt){const T=gt(M.binding,"texture");h.bindings.has(T)&&b.set(T,{binding:T,resource:_.gpuTexture.createView()})}else if(_ instanceof Yt){const T=gt(M.binding,"sampler");h.bindings.has(T)&&b.set(T,{binding:T,resource:_.gpuSampler})}else{const T=gt(M.binding,"uniform"),E=h.bindings.get(T);if(E&&E.kind==="uniform"){const S=_.uniform,L=t.createBuffer({size:Math.max(E.sizeBytes,S.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(L,0,S.buffer,S.byteOffset,S.byteLength),m.push(L),b.set(T,{binding:T,resource:{buffer:L}})}}}const w=t.createBindGroup({layout:h.bindGroupLayout,entries:Array.from(b.values())});return new pr(w,m)},createSurface(f,v){const h=f.getContext("webgpu");if(!h)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const b=v.hdr&&n.hdr,m=()=>b?or(h,t):$t(h,t),w=m();return new hr(f,h,w,m)},renderFullscreen(f,v,h){const b=v,m=h,w=a(f),{width:M,height:_}=s(f),T=tt(f)?f.format:ht(f.format),E=b.pipelineFor(T),S=t.createCommandEncoder(),L=S.beginRenderPass({colorAttachments:[{view:w,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});L.setPipeline(E),L.setBindGroup(0,m.gpuBindGroup),L.setViewport(0,0,M,_,0,1),L.draw(3),L.end(),t.queue.submit([S.finish()])},async readback(f){const v=tt(f),{width:h,height:b}=s(f),m=v?f.hdr?"rgba16float":"rgba8unorm":f.format,w=v&&f.format==="bgra8unorm",M=v?f.getCurrentGPUTexture():f.gpuTexture,_=Xt(m),T=h*_,E=256,S=Math.ceil(T/E)*E,L=S*b,B=t.createBuffer({size:L,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),V=t.createCommandEncoder();V.copyTextureToBuffer({texture:M},{buffer:B,bytesPerRow:S,rowsPerImage:b},{width:h,height:b,depthOrArrayLayers:1}),t.queue.submit([V.finish()]),await B.mapAsync(GPUMapMode.READ);const R=new Uint8Array(B.getMappedRange()),P=new Uint8Array(T*b);for(let y=0;y<b;y++){const A=y*S,D=y*T;P.set(R.subarray(A,A+T),D)}if(B.unmap(),B.destroy(),m==="rgba8unorm"){if(w)for(let y=0;y<P.length;y+=4){const A=P[y],D=P[y+2];P[y]=D,P[y+2]=A}return P}if(m==="rgba16float"){const y=new Uint16Array(P.buffer,P.byteOffset,P.byteLength/2),A=new Float32Array(y.length);for(let D=0;D<y.length;D++)A[D]=ar(y[D]);return A}return new Float32Array(P.buffer,P.byteOffset,P.byteLength/4)},async reduceDiffSumSquaredAbs(f,v,h,b){const m=f,w=v,M=Math.max(0,h*b),_=Math.max(1,Math.ceil(M/l)),{pipeline:T,layout:E}=g(),S=_*2*4,L=t.createBuffer({size:S,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),B=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,new Uint32Array([Math.max(1,h),Math.max(1,b),M,0]));const V=t.createBindGroup({layout:E,entries:[{binding:0,resource:m.gpuTexture.createView()},{binding:1,resource:w.gpuTexture.createView()},{binding:2,resource:{buffer:L}},{binding:3,resource:{buffer:B}}]}),R=t.createBuffer({size:S,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),P=t.createCommandEncoder(),y=P.beginComputePass();y.setPipeline(T),y.setBindGroup(0,V),y.dispatchWorkgroups(_),y.end(),P.copyBufferToBuffer(L,0,R,0,S),t.queue.submit([P.finish()]),await R.mapAsync(GPUMapMode.READ);const D=new Float32Array(R.getMappedRange()).slice();R.unmap(),R.destroy(),L.destroy(),B.destroy();let X=0,ae=0;for(let ee=0;ee<_;ee++)X+=D[ee*2],ae+=D[ee*2+1];return{sumSq:X,sumAbs:ae}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let mt=null;async function mr(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return gr()}function nt(){return mt||(mt=mr()),mt}function xr(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function vr(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),u=o-a,[l,d,p]=xr(e[a],e[s],u);t[n*3]=Math.round(l),t[n*3+1]=Math.round(d),t[n*3+2]=Math.round(p)}return t}const Ht={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},xt=new Set(["red-green","red-blue"]),Kt=new Map;function vt(e){let t=Kt.get(e);if(!t){const n=Ht[e]??Ht.viridis;t=vr(n),Kt.set(e,t)}return t}function bt(e,t,n="linear",r=0,o=0){const a=vt(t),s=new ImageData(e.width,e.height),u=e.data,l=s.data,d=Math.pow(2,r),p=r!==0||o!==0;for(let g=0;g<u.length;g+=4){let x=(u[g]+u[g+1]+u[g+2])/3;p&&(x=Math.max(0,Math.min(255,(x/255*d+o)*255)));let f;n==="positive"?f=Math.round(128+x/255*127):f=Math.round(x),f=Math.max(0,Math.min(255,f)),l[g]=a[f*3],l[g+1]=a[f*3+1],l[g+2]=a[f*3+2],l[g+3]=u[g+3]}return s}function qt(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Zt=qt(50);function wt(e){return Zt.get(e)}function yt(e,t){Zt.set(e,t)}const Qt=qt(100);function br(e){return Qt.get(e)}function wr(e,t){Qt.set(e,t)}function yr(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let u=0;u<r;u++){const l=(s*e.width+u)*4,d=(s*t.width+u)*4,p=(s*r+u)*4;for(let g=0;g<3;g++){const x=e.data[l+g],f=t.data[d+g],v=x-f,h=Math.abs(v),b=Math.max(x,1);let m;switch(n){case"signed":m=(v+255)/2;break;case"absolute":m=h;break;case"squared":m=v*v/255;break;case"relative_signed":m=(v/b+1)*127.5;break;case"relative_absolute":m=h/b*255;break;case"relative_squared":m=v*v/(b*b)*255;break}a.data[p+g]=Math.min(255,Math.max(0,Math.round(m)))}a.data[p+3]=255}return a}async function Ke(e){const t=br(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);wr(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Er={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},_r={linear:0,signed:1,positive:2},Mr=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Tr=`#version 300 es
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
}`;let qe=null,$=null,ke=null,rt=null;function Pr(){if($)return $;try{if(typeof OffscreenCanvas<"u"?qe=new OffscreenCanvas(1,1):qe=document.createElement("canvas"),$=qe.getContext("webgl2",{preserveDrawingBuffer:!0}),!$)return console.warn("[cairn] WebGL 2 not available"),null;const e=$.createShader($.VERTEX_SHADER);if($.shaderSource(e,Mr),$.compileShader(e),!$.getShaderParameter(e,$.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",$.getShaderInfoLog(e)),null;const t=$.createShader($.FRAGMENT_SHADER);if($.shaderSource(t,Tr),$.compileShader(t),!$.getShaderParameter(t,$.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",$.getShaderInfoLog(t)),null;if(ke=$.createProgram(),$.attachShader(ke,e),$.attachShader(ke,t),$.linkProgram(ke),!$.getProgramParameter(ke,$.LINK_STATUS))return console.error("[cairn] WebGL program link:",$.getProgramInfoLog(ke)),null;rt=$.createVertexArray(),$.bindVertexArray(rt);const n=$.createBuffer();$.bindBuffer($.ARRAY_BUFFER,n),$.bufferData($.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),$.STATIC_DRAW);const r=$.getAttribLocation(ke,"a_pos");return $.enableVertexAttribArray(r),$.vertexAttribPointer(r,2,$.FLOAT,!1,0,0),$.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),$}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function jt(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Sr(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Cr(e,t,n,r){const o=Pr();if(!o||!ke||!rt||!qe)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);qe.width=a,qe.height=s,o.viewport(0,0,a,s);const u=jt(o,e,0),l=jt(o,t,1);let d=null;n.colormap?d=Sr(o,n.colormap,2):(d=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,d),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(ke),o.uniform1i(o.getUniformLocation(ke,"u_baseline"),0),o.uniform1i(o.getUniformLocation(ke,"u_other"),1),o.uniform1i(o.getUniformLocation(ke,"u_lut"),2),o.uniform1i(o.getUniformLocation(ke,"u_diff_mode"),Er[n.diffMode]),o.uniform1i(o.getUniformLocation(ke,"u_cmap_mode"),_r[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(ke,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(rt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(qe,0,0,a,s,0,-s,a,s),p.restore()),o.deleteTexture(u),o.deleteTexture(l),o.deleteTexture(d),{width:a,height:s}}const Ar="cairn:render-mode";function kr(){try{const e=localStorage.getItem(Ar);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Oe=e=>e<0?0:e>1?1:e,Et=e=>{const t=e<0?0:e;return t/(1+t)},_t=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Oe(n/r)},Jt={linear:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],srgb:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],reinhard:([e,t,n])=>[Et(e),Et(t),Et(n)],aces:([e,t,n])=>[_t(e),_t(t),_t(n)],extended:([e,t,n])=>[e,t,n]},Rr="srgb";function Lr(e){return e&&Jt[e]||Jt[Rr]}function Mt(e,t,n){return e*2**t+n}function Dr(e){const t=Oe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Tt(e,t){return typeof t=="number"&&t>0?Oe(Math.pow(Oe(e),1/t)):Dr(e)}const Be=new Uint32Array(512),Ne=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Be[e]=0,Be[e|256]=32768,Ne[e]=24,Ne[e|256]=24):t<-14?(Be[e]=1024>>-t-14,Be[e|256]=1024>>-t-14|32768,Ne[e]=-t-1,Ne[e|256]=-t-1):t<=15?(Be[e]=t+15<<10,Be[e|256]=t+15<<10|32768,Ne[e]=13,Ne[e|256]=13):t<128?(Be[e]=31744,Be[e|256]=64512,Ne[e]=24,Ne[e|256]=24):(Be[e]=31744,Be[e|256]=64512,Ne[e]=13,Ne[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Je=Uint8Array,en=Uint16Array,Ir=Int32Array,Or=new Je([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Br=new Je([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),tn=function(e,t){for(var n=new en(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Ir(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},nn=tn(Or,2),Nr=nn.b,Ur=nn.r;Nr[28]=258,Ur[258]=28,tn(Br,0);for(var Gr=new en(32768),de=0;de<32768;++de){var Xe=(de&43690)>>1|(de&21845)<<1;Xe=(Xe&52428)>>2|(Xe&13107)<<2,Xe=(Xe&61680)>>4|(Xe&3855)<<4,Gr[de]=((Xe&65280)>>8|(Xe&255)<<8)>>1}for(var ot=new Je(288),de=0;de<144;++de)ot[de]=8;for(var de=144;de<256;++de)ot[de]=9;for(var de=256;de<280;++de)ot[de]=7;for(var de=280;de<288;++de)ot[de]=8;for(var Fr=new Je(32),de=0;de<32;++de)Fr[de]=5;var Vr=new Je(0),zr=typeof TextDecoder<"u"&&new TextDecoder,$r=0;try{zr.decode(Vr,{stream:!0}),$r=1}catch{}const rn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Pt(e){const t=rn.length;return rn[(e%t+t)%t]}function Xr(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),u=c.useRef(null),l=c.useCallback((d,p)=>{o(g=>g.w===d&&g.h===p?g:{w:d,h:p})},[]);return c.useLayoutEffect(()=>{const d=n.current;if(!d||d===u.current)return;const p=d.getBoundingClientRect();(p.width>0||p.height>0)&&(u.current=d,l(p.width,p.height))}),c.useEffect(()=>{var g;const d=n.current;if(d===s.current||((g=a.current)==null||g.disconnect(),a.current=null,s.current=d,!d))return;const p=new ResizeObserver(x=>{for(const f of x)l(f.contentRect.width,f.contentRect.height)});a.current=p,p.observe(d)}),c.useEffect(()=>()=>{var d;return(d=a.current)==null?void 0:d.disconnect()},[]),{ref:n,size:r}}function Wr(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Yr=.25,St=64;function on(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return St;const o=Math.min(n/e,r/t);return o<=0?St:Math.max(Math.max(n,r)/o,8)}function sn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=Yr,maxZoom:s=St,naturalWidth:u,naturalHeight:l}=e,d=Wr(),p=c.useRef(d);p.current=d;const g=c.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const x=c.useRef(o);x.current=o,c.useEffect(()=>{const w=t.current;if(!w||!o)return;const M=_=>{var A;if(!p.current)return;_.preventDefault(),_.stopPropagation();const T=_.deltaY<0?1.1:1/1.1,E=g.current,S=w.getBoundingClientRect(),L=u&&l?on(u,l,S.width,S.height):s,B=Math.max(a,Math.min(L,E.zoom*T));if(E.zoom===B)return;const V=_.clientX-S.left,R=_.clientY-S.top,P=V-(V-E.pan.x)/E.zoom*B,y=R-(R-E.pan.y)/E.zoom*B;(A=x.current)==null||A.call(x,{zoom:B,pan:{x:P,y}})};return w.addEventListener("wheel",M,{passive:!1}),()=>w.removeEventListener("wheel",M)},[t,!!o,a,s,u,l]);const f=c.useRef(null),v=c.useCallback(w=>{!p.current||!x.current||(w.currentTarget.setPointerCapture(w.pointerId),f.current={pointerId:w.pointerId,startX:w.clientX,startY:w.clientY,panX:g.current.pan.x,panY:g.current.pan.y})},[]),h=c.useCallback(w=>{var E;const M=f.current;if(!M||M.pointerId!==w.pointerId)return;const _=w.clientX-M.startX,T=w.clientY-M.startY;(E=x.current)==null||E.call(x,{zoom:g.current.zoom,pan:{x:M.panX+_,y:M.panY+T}})},[]),b=c.useCallback(w=>{const M=f.current;if(!(!M||M.pointerId!==w.pointerId)){try{w.currentTarget.releasePointerCapture(w.pointerId)}catch{}f.current=null}},[]),m=d&&!!o;return{containerProps:{onPointerDown:v,onPointerMove:h,onPointerUp:b,onPointerCancel:b,style:{cursor:m?"move":void 0,touchAction:m?"none":void 0}},modifierActive:d}}function Ct(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Hr(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function an(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function At({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=Xr(),s=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),l=c.useMemo(()=>{const h=a.w,b=a.h;if(h<=0||b<=0||n<=0||r<=0)return null;const m=Math.min(h/n,b/r),w=n*m,M=r*m;return{left:(h-w)/2,top:(b-M)/2,width:w,height:M}},[a.w,a.h,n,r]),d=e.masks,p=t.showMasks&&!!d&&d.length>0,g=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!p||!d)return;const h=s.current;if(!h)return;(h.width!==n||h.height!==r)&&(h.width=n,h.height=r);const b=h.getContext("2d");if(!b)return;b.clearRect(0,0,h.width,h.height);let m=!1;const w=b.createImageData(n,r),M=w.data;let _=d.length,T=!1;const E=()=>{m||T&&b.putImageData(w,0,0)},S=document.createElement("canvas");S.width=n,S.height=r;const L=S.getContext("2d",{willReadFrequently:!0});for(const B of d){const V=new Image;V.onload=()=>{if(!m){if(L){L.clearRect(0,0,n,r),L.drawImage(V,0,0,n,r);const R=L.getImageData(0,0,n,r).data;for(let P=0;P<n*r;P++){const y=R[P*4];if(y===0||u.has(y))continue;const[A,D,X]=Hr(Pt(y));M[P*4]=A,M[P*4+1]=D,M[P*4+2]=X,M[P*4+3]=255,T=!0}}_-=1,_===0&&E()}},V.onerror=()=>{_-=1,_===0&&E()},V.src=`data:image/png;base64,${B.png_b64}`}return()=>{m=!0}},[p,d,n,r,g]),!l)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const x=e.boxes??[],f=t.showBoxes&&x.length>0,v=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),f&&i.jsx("svg",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:x.map((h,b)=>{if(!an(h,t,u))return null;const m=h.domain==="pixel"?1:n,w=h.domain==="pixel"?1:r,M=h.position.minX*m,_=h.position.minY*w,T=(h.position.maxX-h.position.minX)*m,E=(h.position.maxY-h.position.minY)*w;return i.jsx("rect",{x:M,y:_,width:T,height:E,fill:"none",stroke:Pt(h.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},b)})}),f&&i.jsx("div",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height},children:x.map((h,b)=>{if(!an(h,t,u))return null;const m=h.domain==="pixel"?1/n:1,w=h.domain==="pixel"?1/r:1,M=h.position.minX*m*100,_=h.position.minY*w*100,T=h.label??v[String(h.class_id)]??`#${h.class_id}`,E=h.score!=null?` ${(h.score*100).toFixed(0)}%`:"";return!T&&!E?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${M}%`,top:`${_}%`,transform:"translateY(-100%)",backgroundColor:Pt(h.class_id)},children:i.jsxs("span",{className:"mono",children:[T,E]})},b)})})]})}const kt=30,pe=["#ff5a5a","#39d353","#5b9bff"];function Rt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function Q(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Rt(e/255):Rt(n==="int"?e*255:e)}const Kr={x:0,y:0,w:1,h:1};function Ze({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:u=0,onActiveChange:l,sourceWindow:d=Kr}){const p=c.useRef(null),g=c.useRef(!1),x=Ct(),f=c.useRef(l);f.current=l;const v=c.useCallback(b=>{var m;b!==g.current&&(g.current=b,(m=f.current)==null||m.call(f,b))},[]),h=c.useCallback(()=>{var j;const b=p.current,m=e.current;if(!b)return;const w=window.devicePixelRatio||1,M=b.clientWidth,_=b.clientHeight;if(M===0||_===0)return;b.width!==Math.round(M*w)&&(b.width=Math.round(M*w)),b.height!==Math.round(_*w)&&(b.height=Math.round(_*w));const T=b.getContext("2d");if(!T)return;if(T.setTransform(w,0,0,w,0,0),T.clearRect(0,0,M,_),!m||t<=0||n<=0){v(!1);return}const E=m.getBoundingClientRect(),S=b.getBoundingClientRect();if(E.width===0||E.height===0){v(!1);return}const L=d.x*t,B=d.y*n,V=d.w*t,R=d.h*n;if(V<=0||R<=0){v(!1);return}const P=Math.min(E.width/V,E.height/R);if(P<kt){v(!1);return}const y=V*P,A=R*P,D=E.left+(E.width-y)/2-S.left,X=E.top+(E.height-A)/2-S.top,ae=Math.max(Math.floor(L),Math.floor(L+(0-D)/P)),ee=Math.min(Math.ceil(L+V),Math.ceil(L+(M-D)/P)),ve=Math.max(Math.floor(B),Math.floor(B+(0-X)/P)),_e=Math.min(Math.ceil(B+R),Math.ceil(B+(_-X)/P));if(ee<=ae||_e<=ve){v(!1);return}v(!0);const we=D+(0-L)*P,Re=X+(0-B)*P,Le=D+(t-L)*P,he=X+(n-B)*P;T.save(),T.beginPath(),T.rect(we,Re,Le-we,he-Re),T.clip(),T.textAlign="center",T.textBaseline="middle",T.lineJoin="round";const Se=P*.14,me=P-Se*2;for(let ue=ve;ue<_e;ue++)for(let fe=ae;fe<ee;fe++){if(fe<0||ue<0||fe>=t||ue>=n)continue;const H=a(fe,ue,s);if(!H||H.lines.length===0)continue;const J=H.lines.length;let ye=1;for(const k of H.lines)k.length>ye&&(ye=k.length);const xe=me/(J*1.15),be=me/(ye*.62)||xe,N=Math.min(xe,be,24);if(N<6)continue;const U=D+(fe-L+.5)*P,W=X+(ue-B+.5)*P,G=N*1.15,K=H.luminance<=.55,Z=K?"#ffffff":"#000000";T.font=`${N}px ui-monospace, SFMono-Regular, Menlo, monospace`,T.lineWidth=Math.max(1.4,N*.16),T.strokeStyle=K?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Me=W-J*G/2+G/2;for(let k=0;k<H.lines.length;k++){const F=H.lines[k];T.strokeText(F,U,Me),T.fillStyle=((j=H.colors)==null?void 0:j[k])??Z,T.fillText(F,U,Me),Me+=G}}T.restore()},[e,t,n,a,s,v,d]);return c.useEffect(()=>{h()},[h,r,o.x,o.y,u,s,d,x]),c.useEffect(()=>{const b=p.current;if(!b)return;const m=new ResizeObserver(()=>h());return m.observe(b),()=>m.disconnect()},[h]),i.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function cn({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const qr=`
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
`,ln=`
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
`,Zr=`
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
`,st=`
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
`;function un(e){return`
${Fe}
${ln}
${Zr}

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
`}const Qr=un("select(colorB, colorA, uv.x < split)"),jr=un("mix(colorA, colorB, alpha)"),Lt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},dn=new WeakMap;function Jr(e,t){let n=dn.get(e);n||(n=new Map,dn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:qr,targetFormat:t}),n.set(t,r)),r}function fn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function pn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function eo(e,t,n,r){var h;const o=fn(t),a=Jr(e,o),s=pn(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,l=Lt[r.operator]??Lt.srgb,d=new Float32Array([r.exposureEV,l,u,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),x=new Float32Array([r.filter==="nearest"?0:1]),f=new Float32Array([r.offset??0]);let v;try{v=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:d}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:x}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,a,v)}finally{(h=v==null?void 0:v.destroy)==null||h.call(v),s.destroy()}}const hn=new WeakMap;function to(e,t,n){let r=hn.get(e);r||(r=new Map,hn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?Qr:jr,targetFormat:n}),r.set(o,a)),a}function no(e,t,n,r,o){var h;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=fn(t),s=to(e,o.mode,a),u=pn(e,void 0),l=o.gamma,d=Lt[o.operator],p=new Float32Array([o.exposureEV,d,l,0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),x=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),f=new Float32Array([o.offset??0,0,0,0]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:x}},{binding:6,resource:{uniform:f}}]),e.renderFullscreen(t,s,v)}finally{(h=v==null?void 0:v.destroy)==null||h.call(v),u.destroy()}}function gn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function mn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:x,sumAbs:f}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return gn(x,f,a)}const s=await e.readback(t),u=await e.readback(n),l=s instanceof Uint8Array,d=u instanceof Uint8Array;let p=0,g=0;for(let x=0;x<o;x++)for(let f=0;f<r;f++){const v=(x*t.width+f)*4,h=(x*n.width+f)*4;for(let b=0;b<3;b++){const m=(s[v+b]??0)/(l?255:1),w=(u[h+b]??0)/(d?255:1),M=m-w;p+=M*M,g+=Math.abs(M)}}return gn(p,g,a)}function xn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const ro=12,We=[];function vn(e){const t=We.indexOf(e);t!==-1&&We.splice(t,1),We.push(e)}function oo(e){const t=We.indexOf(e);t!==-1&&We.splice(t,1)}function at(e){e.parked||(oo(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function bn(e){for(;We.length>ro;){const t=We.find(n=>n!==e&&!n.visible)??We.find(n=>n!==e);if(!t)break;at(t)}}function wn(e){var o,a;if(e.disposed)return;if(xn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){vn(e),bn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,vn(e),bn(e)}function so(e,t){if(e.disposed||!e.source)return!0;try{return wn(e),!e.surface||!e.srcTexture?!1:(eo(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,at(e),!1}}function ao(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return so(e,t)},park(){e.disposed||at(e)},restore(){e.disposed||!e.source||wn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(at(e),e.source=null,e.disposed=!0)}}}async function io(e,t){const n=await nt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return ao(r)}function yn(e){e.dispose()}function co(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function En(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:u,flipSign:l}=e,d=c.useMemo(()=>co(e,n),[n,r,o,s,l]);return{gammaFilterId:n,filterStr:d,gamma:a,offset:u}}function _n({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Mn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function lo({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Mn(e),a=Mn(t),s=[];for(let w=0;w<=e;w+=o)s.push(w);const u=[];for(let w=0;w<=t;w+=a)u.push(w);const l=1/n,d=8*l,p=-12*l,g=-2*l,x=r==null?void 0:r.current;let f=0,v=0,h=0,b=0;if(x){const w=x.clientWidth,M=x.clientHeight,_=w/e,T=M/t,E=Math.min(_,T);h=e*E,b=t*E,f=(w-h)/2,v=(M-b)/2}const m=x&&h>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?v:0,transform:`translateY(${p}px)`,fontSize:d},children:s.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",left:m?f+w/e*h:`${w/e*100}%`,transform:"translateX(-50%)"},children:w},w))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?f:0,transform:`translateX(${g}px)`,fontSize:d},children:u.map(w=>i.jsx("span",{className:"mono",style:{position:"absolute",top:m?v+w/t*b:`${w/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*l}px`},children:w},w))})]})}function uo({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const fo=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Tn(e,t){const n=getComputedStyle(e),r=fo.map(l=>`${l}:${n.getPropertyValue(l)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,u=Math.min(a.length,s.length);for(let l=0;l<u;l++)Tn(a[l],s[l])}function Dt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function It(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Ot(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((u,l)=>a.toBlob(d=>d?u(d):l(new Error("plot-to-png: toBlob returned null")),"image/png"))}function po(e,t,n){const r=e.cloneNode(!0);Tn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,u)=>{const l=new Image;l.onload=()=>s(l),l.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),l.src=a})}async function Pn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Dt(e);return Ot(r,o,It(t),a,s=>s.drawImage(e,0,0,r,o))}async function ho(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Dt(e);try{return await Ot(r,o,It(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function go(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function mo(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,u=(t==null?void 0:t.background)??Dt(e);if(n){const d=n.getBoundingClientRect(),p=await po(n,d.width||a,d.height||s);return Ot(a,s,It(t),u,g=>{for(const x of r){const f=x.getBoundingClientRect();g.drawImage(x,f.left-o.left,f.top-o.top,f.width,f.height)}g.drawImage(p,d.left-o.left,d.top-o.top,d.width,d.height)})}if(r.length)return Pn(r[0],t);const l=go(e);if(l)return ho(l,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function xo(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const vo=8;function bo(e,t,n,r=vo){return!(t>0)||!(e>0)?n:e<t+r}function Sn(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}const wo={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},yo={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),i.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"12",cy:"12",r:"4"}),i.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 7h6M7 4v6"}),i.jsx("path",{d:"M14 17h6"}),i.jsx("path",{d:"M6 20l12-16"})]})};function Ve({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:yo[e]??null})}function Cn({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(Ve,{name:e??""})})}function An(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Eo({icon:e,title:t,menu:n}){var b;const{options:r,value:o,onSelect:a}=n,[s,u]=c.useState(!1),[l,d]=c.useState(0),p=c.useRef(null),g=Sn(r,o),x=e?void 0:((b=r[g])==null?void 0:b.label)??"",f=c.useCallback(()=>{u(m=>{const w=!m;return w&&d(g),w})},[g]),v=c.useCallback(m=>{a(m),u(!1)},[a]);c.useEffect(()=>{if(!s)return;const m=M=>{p.current&&!p.current.contains(M.target)&&u(!1)},w=M=>{M.key==="Escape"&&(M.stopPropagation(),u(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",w,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",w,!0)}},[s]);const h=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),d(g),u(!0));return}if(m.key==="ArrowDown")m.preventDefault(),d(w=>(w+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),d(w=>(w-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const w=r[l];w&&v(w.id)}};return i.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),f()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:h,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",x?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[x?i.jsx("span",{"aria-hidden":"true",children:x}):i.jsx(Ve,{name:e??""}),i.jsx(Ve,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,w)=>{const M=m.id===o,_=w===l;return i.jsx("li",{role:"option","aria-selected":M,children:i.jsx("button",{type:"button",onClick:T=>{T.stopPropagation(),v(m.id)},onPointerEnter:()=>d(w),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",_?"bg-bg-hover":"",M?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const _o=e=>e.format?e.format(e.value):String(e.value);function kn({spec:e}){return i.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:t=>t.stopPropagation(),onDoubleClick:t=>{t.stopPropagation(),e.defaultValue!==void 0&&e.onChange(e.defaultValue)},children:[e.icon?i.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:i.jsx(Ve,{name:e.icon})}):i.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),i.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:t=>e.onChange(Number(t.target.value)),onPointerDown:t=>t.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),i.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:_o(e)})]})}function Mo({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:a,onSelect:s}=n,[u,l]=c.useState(!1),d=Sn(o,a),p=((g=o[d])==null?void 0:g.label)??"";return i.jsxs("div",{children:[i.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:x=>{x.stopPropagation(),l(f=>!f)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?i.jsx(Ve,{name:e}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{className:"flex-1",children:t}),i.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),i.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:i.jsx(Ve,{name:"caret"})})]}),u&&o.map(x=>{const f=x.id===a;return i.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":f,"data-menu-option":"",onClick:v=>{v.stopPropagation(),s(x.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",f?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[i.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:f?"✓":""}),i.jsx("span",{children:x.label})]},x.id)})]})}function To({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return c.useEffect(()=>{if(!r)return;const s=l=>{a.current&&!a.current.contains(l.target)&&o(!1)},u=l=>{l.key==="Escape"&&(l.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",u,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",u,!0)}},[r]),i.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[i.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(u=>!u)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:i.jsx(Ve,{name:"ellipsis"})}),r&&i.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?i.jsx(Mo,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):i.jsxs("button",{type:"button",disabled:s.disabled,onClick:u=>{var l;u.stopPropagation(),!s.disabled&&((l=s.onClick)==null||l.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Ve,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>i.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:u=>{u.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?i.jsx(Ve,{name:s.icon}):i.jsx("span",{className:"w-[13px]"}),i.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&i.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>i.jsx("div",{className:"px-2 py-1",children:i.jsx(kn,{spec:s})},s.id))]})]})}function Po({controller:e,config:t}){var R,P;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),u=`${((R=t==null?void 0:t.leadingButtons)==null?void 0:R.length)??0}:${((P=t==null?void 0:t.sliders)==null?void 0:P.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const y=n.current,A=y==null?void 0:y.parentElement;if(!A)return;const D=()=>{const ae=A.clientWidth;if(!a.current&&n.current){const ee=n.current.scrollWidth;ee>0&&(s.current=ee)}o(bo(ae,s.current,a.current))},X=new ResizeObserver(D);return X.observe(A),D(),()=>X.disconnect()},[u]),(t==null?void 0:t.enabled)===!1)return null;const l=e.capabilities,d=t==null?void 0:t.buttons,p=(y,A)=>A&&(d==null?void 0:d[y])!==!1,g=y=>()=>e.setDragMode(y),x=()=>{e.toPNG({filename:"plot"}).then(y=>xo(y,"plot.png")).catch(()=>{})},f=[];p("zoom",l.zoom)&&f.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),p("pan",l.pan)&&f.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),p("select",l.select)&&f.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),p("lasso",l.lasso)&&f.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const v=[];p("zoomIn",l.zoom)&&v.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",l.zoom)&&v.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const h=[];p("autoscale",l.autoscale)&&h.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",l.reset)&&h.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const b=[];p("screenshot",l.screenshot)&&b.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:x});const m=[f,v,h,b].filter(y=>y.length>0),w=m.flat(),M=(t==null?void 0:t.leadingButtons)??[],_=(t==null?void 0:t.sliders)??[];if(!M.length&&w.length===0&&_.length===0)return null;const T=(t==null?void 0:t.position)??"top-right",E=(t==null?void 0:t.visibility)==="always",S=T==="top-right"||T==="bottom-right",B=["z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",E?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),V={position:"absolute",pointerEvents:"auto",...wo[T]};return r?i.jsx("div",{ref:n,style:V,className:`${B} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:i.jsx(To,{actions:w,leading:M,sliders:_})}):i.jsxs("div",{ref:n,style:V,className:`${B} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[i.jsxs("div",{className:`flex items-center gap-0.5 ${S?"justify-end":"justify-start"}`,children:[M.length>0&&i.jsxs(i.Fragment,{children:[M.map(y=>y.menu?i.jsx(Eo,{icon:y.icon,title:y.title,menu:y.menu},y.id):i.jsx(Cn,{icon:y.icon,label:y.label,title:y.title,active:y.active,disabled:y.disabled,onClick:y.onClick??(()=>{})},y.id)),m.length>0&&i.jsx(An,{})]}),m.map((y,A)=>i.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[A>0&&i.jsx(An,{}),y.map(D=>i.jsx(Cn,{icon:D.icon,title:D.title,active:D.active,disabled:D.disabled,onClick:D.onClick},D.id))]},y[0].id))]}),_.length>0&&i.jsx("div",{className:`flex items-center gap-2 ${S?"justify-end":"justify-start"}`,children:_.map(y=>i.jsx(kn,{spec:y},y.id))})]})}const So={zoom:1,pan:{x:0,y:0}},Rn=1.3,Co=.25,Ao=64,ko={buttons:{zoom:!1}};function Ro(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Lo=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Bt(e,t){return{id:"colormap",title:"Colormap",menu:{options:Lo,value:e,onSelect:t}}}function Do({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:u=Co,maxZoom:l=Ao,requestRender:d,onReset:p,extraModified:g=!1}){const x=c.useCallback(E=>{var X;if(!o)return;const S=(X=e.current)==null?void 0:X.getBoundingClientRect(),L=(S==null?void 0:S.width)??0,B=(S==null?void 0:S.height)??0,V=a&&s&&L>0&&B>0?on(a,s,L,B):l,R=Math.max(u,Math.min(V,n*E));if(R===n)return;const P=L/2,y=B/2,A=P-(P-r.x)/n*R,D=y-(y-r.y)/n*R;o({zoom:R,pan:{x:A,y:D}})},[o,e,a,s,l,u,n,r.x,r.y]),f=c.useCallback(()=>x(Rn),[x]),v=c.useCallback(()=>x(1/Rn),[x]),h=c.useCallback(()=>{o==null||o(So),p==null||p()},[o,p]),b=c.useCallback(E=>{const S={scale:E==null?void 0:E.scale,filename:E==null?void 0:E.filename};d==null||d();const L=t==null?void 0:t.current;if(L)return Pn(L,S);const B=e.current;return B?mo(B,S):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,d]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),w=n!==1||r.x!==0||r.y!==0||g,M=c.useCallback(E=>{},[]),_=c.useCallback(E=>{},[]),T=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:w,setDragMode:M,setHoverMode:_,toggleSpikelines:T,zoomIn:f,zoomOut:v,autoscale:h,reset:h,toPNG:b}),[m,w,M,_,T,f,v,h,b])}const Io={zoom:1,pan:{x:0,y:0}};function it({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:u,naturalDims:l,checkerboard:d,wrapperClassName:p,wrapperStyle:g,viewportPadding:x,header:f,surface:v,showAxes:h,overlayNode:b,overlay:m,notationSeed:w,exportCanvasRef:M,requestRender:_,leadingMenus:T,displayAdjust:E,onReset:S,label:L,showLabelChip:B,isDraggable:V=!1,onDragStart:R,extraChips:P}){const[y,A]=c.useState(w),[D,X]=c.useState(!1),{containerProps:ae}=sn({containerRef:r,zoom:a,pan:s,onViewportChange:u,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h}),ee=c.useCallback(()=>{E==null||E.onExposureChange(0),E==null||E.onOffsetChange(0),S==null||S()},[E,S]),ve=c.useCallback(()=>{u==null||u(Io),ee()},[u,ee]),_e=Do({rootRef:r,canvasRef:M,zoom:a,pan:s,onViewportChange:u,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h,requestRender:_,onReset:ee,extraModified:((E==null?void 0:E.exposureEV)??0)!==0||((E==null?void 0:E.offset)??0)!==0}),we=c.useMemo(()=>{if(!E)return;const j=(ue,fe)=>`${ue>=0?"+":"−"}${Math.abs(ue).toFixed(fe)}`;return[{id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to reset.",min:-8,max:8,step:.1,value:E.exposureEV,onChange:E.onExposureChange,format:ue=>j(ue,1),defaultValue:0},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to reset.",min:-1,max:1,step:.01,value:E.offset,onChange:E.onOffsetChange,format:ue=>j(ue,2),defaultValue:0}]},[E]),Re=c.useMemo(()=>({...ko,leadingButtons:[...T??[],...D?[Ro(y,A)]:[]],sliders:we}),[D,y,T,we]),Le=" cairn-checkerboard",he="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(d==="pane"?Le:""),Se=p+(d==="wrapper"?Le:""),me="render"in m?m.render({notation:y,setOverlayActive:X}):m.hasSource&&l?i.jsx(Ze,{imageElRef:m.displayElRef,naturalWidth:l.w,naturalHeight:l.h,zoom:a,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:y,version:m.version,onActiveChange:X}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[f,n&&i.jsx(Po,{controller:_e,config:Re}),i.jsxs("div",{ref:r,className:he,style:{padding:x,...ae.style},onPointerDown:ae.onPointerDown,onPointerMove:ae.onPointerMove,onPointerUp:ae.onPointerUp,onPointerCancel:ae.onPointerCancel,onDoubleClick:ve,...t,children:[i.jsxs("div",{ref:o,className:Se,style:g,children:[v,h&&l&&i.jsx(lo,{naturalWidth:l.w,naturalHeight:l.h,zoom:a,containerRef:o}),b]}),me,!n&&D&&i.jsx(cn,{notation:y,onChange:A})]}),B&&i.jsx(uo,{label:L,isDraggable:V,onDragStart:R}),P]})}function Ln(e){return"hdr"in e&&e.hdr!=null}function Dn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Ce(e){return Number.isFinite(e)?e:0}const Oo={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Bo(e,t,n,r,o=0){const{h:a,w:s,c:u}=Dn(e.shape),l=e.data,d=Lr(t),p=new Uint8ClampedArray(s*a*4);for(let g=0;g<s*a;g++){const x=g*u;let f,v,h,b=1;u===1?f=v=h=Ce(l[x]):u===3?(f=Ce(l[x]),v=Ce(l[x+1]),h=Ce(l[x+2])):(f=Ce(l[x]),v=Ce(l[x+1]),h=Ce(l[x+2]),b=Ce(l[x+3]));const m=[Mt(f,n,o),Mt(v,n,o),Mt(h,n,o)],[w,M,_]=d(m),T=g*4;p[T]=255*Tt(w,r),p[T+1]=255*Tt(M,r),p[T+2]=255*Tt(_,r),p[T+3]=255*(b<0?0:b>1?1:b)}return new ImageData(p,s,a)}function No(e){var Z,Me;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:u=!1,processing:l=Oo,zoom:d=1,pan:p={x:0,y:0},onViewportChange:g,onNaturalSize:x,label:f,isDraggable:v=!1,onDragStart:h,overlay:b,overlaySettings:m,pixelValueNotation:w="decimal",toolbar:M=!0}=e,[_,T]=c.useState(s);c.useEffect(()=>{T(s)},[s]);const E=c.useRef(null),S=c.useRef(null),L=c.useRef(null),B=c.useRef(null),V=c.useRef(null),R=c.useRef(null),P=c.useRef(null),[y,A]=c.useState(0),D=c.useCallback(()=>A(k=>k+1),[]),X=c.useMemo(()=>({get current(){const k=V.current;return k instanceof HTMLCanvasElement?k:null}}),[]),ae=c.useCallback(k=>{E.current=k,k&&(V.current=k)},[]),ee=c.useCallback(k=>{S.current=k,k&&(V.current=k)},[]),ve=c.useCallback(k=>{k&&(V.current=k)},[]),[_e,we]=c.useState(!1),[Re,Le]=c.useState(!1),[he,Se]=c.useState(null),{flipSign:me}=l,{gammaFilterId:j,filterStr:ue,gamma:fe,offset:H}=En(l),J=!r&&o!=="none"&&n!=null&&t!=null,ye=o!=="none"&&n!=null,xe=_!=="none"&&!J&&!(r&&ye)&&t!=null;c.useEffect(()=>{if(!xe||!t){Le(!1);return}let k=!1;Le(!1);const F=`${t}::${_}`,Y=wt(F);if(Y){const q=S.current;if(q){q.width=Y.width,q.height=Y.height;const te=q.getContext("2d");te&&te.putImageData(Y,0,0),P.current=Y,D(),Se({w:Y.width,h:Y.height}),x==null||x(Y.width,Y.height),Le(!0)}return}const re=new Image;return re.onload=()=>{if(k)return;const q=document.createElement("canvas");q.width=re.naturalWidth,q.height=re.naturalHeight;const te=q.getContext("2d");if(!te)return;te.drawImage(re,0,0);const Ee=te.getImageData(0,0,q.width,q.height),ge=xt.has(_)?"positive":"linear",oe=bt(Ee,_,ge);yt(F,oe);const Ie=S.current;if(!Ie||k)return;Ie.width=oe.width,Ie.height=oe.height;const Te=Ie.getContext("2d");Te&&Te.putImageData(oe,0,0),P.current=oe,D(),Se({w:oe.width,h:oe.height}),x==null||x(oe.width,oe.height),Le(!0)},re.src=t,()=>{k=!0}},[xe,t,_]);const be=c.useCallback((k,F)=>{Se(Y=>Y&&Y.w===k&&Y.h===F?Y:{w:k,h:F}),x==null||x(k,F)},[]);c.useEffect(()=>{if(!t){R.current=null,P.current=null,D();return}let k=!1;return Ke(t).then(F=>{k||(R.current=F,_==="none"&&(P.current=F),D())}),()=>{k=!0}},[t,_,D]);const N=c.useCallback((k,F,Y)=>{const re=R.current;if(!re||k<0||F<0||k>=re.width||F>=re.height)return null;const q=(F*re.width+k)*4,te=re.data[q],Ee=re.data[q+1],ge=re.data[q+2],oe=P.current;let Ie=te,Te=Ee,De=ge;if(oe&&oe.width===re.width&&oe.height===re.height){const Ge=(F*oe.width+k)*4;Ie=oe.data[Ge],Te=oe.data[Ge+1],De=oe.data[Ge+2]}const Ue=(.299*Ie+.587*Te+.114*De)/255;return _!=="none"||te===Ee&&Ee===ge?{lines:[Q(te,"uint8",Y)],luminance:Ue}:{lines:[Q(te,"uint8",Y),Q(Ee,"uint8",Y),Q(ge,"uint8",Y)],luminance:Ue,colors:[pe[0],pe[1],pe[2]]}},[_]);c.useEffect(()=>{if(!J){we(!1);return}let k=!1;const F=kr(),Y=F==="gpu"||F==="auto",re=`${n}::${t}::${o}::${_}`;if(F!=="gpu"){const q=wt(re);if(q){const te=E.current;if(te){(te.width!==q.width||te.height!==q.height)&&(te.width=q.width,te.height=q.height);const Ee=te.getContext("2d");Ee&&Ee.putImageData(q,0,0),be(q.width,q.height),we(!0)}return}}return(async()=>{const[q,te]=await Promise.all([Ke(n),Ke(t)]);if(k||!q||!te)return;const ge=o.includes("signed")?"signed":"positive",oe=_!=="none"?vt(_):null,Ie={diffMode:o,colormap:oe,cmapMode:ge};if(Y)try{const He=E.current;if(He){const Ge=Cr(q,te,Ie,He);if(Ge){if(k)return;be(Ge.width,Ge.height),we(!0);return}}}catch(He){console.warn("[cairn] WebGL 2 diff error:",He)}if(F==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let Te=yr(q,te,o);_!=="none"&&(Te=bt(Te,_,ge)),yt(re,Te);const De=E.current;if(!De||k)return;(De.width!==Te.width||De.height!==Te.height)&&(De.width=Te.width,De.height=Te.height);const Ue=De.getContext("2d");Ue&&Ue.putImageData(Te,0,0),be(Te.width,Te.height),we(!0)})(),()=>{k=!0}},[n,t,o,J,_,x]);const U=a==="auto"?void 0:a,W=me?{filter:"invert(1)"}:{},G=b&&(m!=null&&m.enabled)&&he&&t&&((((Z=b.boxes)==null?void 0:Z.length)??0)>0||(((Me=b.masks)==null?void 0:Me.length)??0)>0)?i.jsx(At,{data:b,settings:m,naturalWidth:he.w,naturalHeight:he.h}):void 0,K=t?J?i.jsxs(i.Fragment,{children:[!_e&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:ae,className:"w-full h-full object-contain block",style:{display:_e?"block":"none",imageRendering:U,...W}})]}):xe?i.jsxs(i.Fragment,{children:[!Re&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:ee,className:"w-full h-full object-contain block",style:{display:Re?"block":"none",imageRendering:U,...W}})]}):i.jsx("img",{ref:ve,src:t,alt:f,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ue,imageRendering:U},onLoad:k=>{const F=k.currentTarget;Se({w:F.naturalWidth,h:F.naturalHeight}),x==null||x(F.naturalWidth,F.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(it,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:M,paneRef:L,wrapperRef:B,zoom:d,pan:p,onViewportChange:g,naturalDims:he,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:u&&he?"16px 4px 4px 28px":"4px",header:i.jsx(_n,{id:j,gamma:fe,offset:H}),surface:K,showAxes:u,overlayNode:G,overlay:{displayElRef:V,sample:N,version:y,hasSource:!!t},notationSeed:w,exportCanvasRef:X,leadingMenus:[Bt(_,k=>T(k))],label:f,showLabelChip:!0,isDraggable:v,onDragStart:h})}function Uo(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:u="auto",zoom:l=1,pan:d={x:0,y:0},onViewportChange:p,pixelValueNotation:g="decimal",toolbar:x=!0}=e,f=c.useRef(null),v=c.useRef(null),h=c.useRef(null),[b,m]=c.useState(null),w=c.useRef(null),[M,_]=c.useState(0),[T,E]=c.useState(0),[S,L]=c.useState(0);c.useEffect(()=>{const R=f.current;if(!R)return;let P;try{P=Bo(t,n,r+T,o,S)}catch(A){console.error("[cairn] HDR tone-map error:",A);return}(R.width!==P.width||R.height!==P.height)&&(R.width=P.width,R.height=P.height);const y=R.getContext("2d");y&&(y.putImageData(P,0,0),w.current=P,_(A=>A+1),m(A=>A&&A.w===P.width&&A.h===P.height?A:{w:P.width,h:P.height}))},[t,n,r,o,T,S]);const B=c.useCallback((R,P,y)=>{const A=b;if(!A||R<0||P<0||R>=A.w||P>=A.h)return null;const D=t.shape.length===2?1:t.shape[2]??1,X=(P*A.w+R)*D,ae=t.data,ee=w.current;let ve=.5;if(ee&&ee.width===A.w&&ee.height===A.h){const _e=(P*A.w+R)*4;ve=(.299*ee.data[_e]+.587*ee.data[_e+1]+.114*ee.data[_e+2])/255}return D===1?{lines:[Q(ae[X]??0,"unit",y)],luminance:ve}:{lines:[Q(ae[X]??0,"unit",y),Q(ae[X+1]??0,"unit",y),Q(ae[X+2]??0,"unit",y)],luminance:ve,colors:[pe[0],pe[1],pe[2]]}},[t,b]),V=u==="auto"?void 0:u;return i.jsx(it,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:v,wrapperRef:h,zoom:l,pan:d,onViewportChange:p,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:a&&b?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:f,className:"w-full h-full object-contain block",style:{imageRendering:V}}),showAxes:a,overlay:{displayElRef:f,sample:B,version:M,hasSource:!0},notationSeed:g,exportCanvasRef:f,displayAdjust:{exposureEV:T,offset:S,onExposureChange:E,onOffsetChange:L},label:s,showLabelChip:!!s})}function Nt(e){return Ln(e)?i.jsx(Uo,{...e}):i.jsx(No,{...e})}const Go=["linear","srgb","reinhard","aces"];function Fo(e){return e&&Go.includes(e)?e:"srgb"}function Vo(e){const{h:t,w:n,c:r}=Dn(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const u=s*r;let l,d,p,g=1;r===1?l=d=p=Ce(o[u]):r===3?(l=Ce(o[u]),d=Ce(o[u+1]),p=Ce(o[u+2])):(l=Ce(o[u]),d=Ce(o[u+1]),p=Ce(o[u+2]),g=Ce(o[u+3]));const x=s*4;a[x]=l,a[x+1]=d,a[x+2]=p,a[x+3]=g}return{data:a,width:n,height:t,format:"rgba32float"}}function In(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,u=(t.width-a)/2,l=(t.height-s)/2,d=Math.max(e.zoom,1e-6),p=t.width/(d*a),g=t.height/(d*s),x=-u/a-e.pan.x/(d*a),f=-l/s-e.pan.y/(d*s);return{x,y:f,w:p,h:g}}function On(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function zo(e){var xe,be;const t=Ln(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(!1),[u,l]=c.useState(!1),[d,p]=c.useState(!1),[g,x]=c.useState(null),[f,v]=c.useState(0),[h,b]=c.useState(0),[m,w]=c.useState({x:0,y:0,w:1,h:1}),M=c.useRef(null),_=c.useRef(null),[T,E]=c.useState(0),S=e.zoom??1,L=e.pan??{x:0,y:0},B=e.onViewportChange,V=t?"none":e.colormap??"none",[R,P]=c.useState(V);c.useEffect(()=>{P(V)},[V]);const y=t?"none":R,[A,D]=c.useState(0),[X,ae]=c.useState(0),ee=Ct();c.useEffect(()=>{const N=n.current;if(!N)return;let U=!1;return nt().then(W=>{if(U)return;const G=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,K=W.capabilities.hdr&&G&&t;s.current=K,io(N,{hdr:K}).then(Z=>{if(U){yn(Z);return}a.current=Z,p(!0)}).catch(Z=>{U||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Z),l(!0))})}).catch(W=>{U||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",W),l(!0))}),()=>{U=!0,a.current&&(yn(a.current),a.current=null)}},[]),c.useEffect(()=>{const N=r.current;if(!N)return;const U=new ResizeObserver(()=>b(W=>W+1));return U.observe(N),()=>U.disconnect()},[]),c.useEffect(()=>{const N=r.current;if(!N)return;const U=new IntersectionObserver(W=>{const G=W[0];if(!G)return;const K=a.current;K&&(K.setVisible(G.isIntersecting),G.isIntersecting?K.isParked&&(K.restore(),b(Z=>Z+1)):K.park())},{threshold:0});return U.observe(N),()=>U.disconnect()},[]),c.useEffect(()=>{var W;if(!t||!d)return;const N=e.hdr;M.current=N;const U=Vo(N);(W=a.current)==null||W.setSource(U),x(G=>G&&G.w===U.width&&G.h===U.height?G:{w:U.width,h:U.height}),E(G=>G+1),v(G=>G+1)},[t,d,t?e.hdr:null]),c.useEffect(()=>{if(t||!d)return;const N=e,U=N.imageUrl,W=R;if(!U){_.current=null,x(null),E(K=>K+1);return}let G=!1;return Ke(U).then(K=>{var k,F;if(G||!K)return;let Z=K;if(W!=="none"){const Y=`gpu::${U}::${W}::ev${A}::off${X}`,re=wt(Y);if(re)Z=re;else{const q=xt.has(W)?"positive":"linear";Z=bt(K,W,q,A,X),yt(Y,Z)}}_.current=K;const Me={data:Z.data,width:Z.width,height:Z.height,format:"rgba8unorm"};(k=a.current)==null||k.setSource(Me),x(Y=>Y&&Y.w===Z.width&&Y.h===Z.height?Y:{w:Z.width,h:Z.height}),(F=N.onNaturalSize)==null||F.call(N,Z.width,Z.height),E(Y=>Y+1),v(Y=>Y+1)}),()=>{G=!0}},[t,d,t?null:e.imageUrl,t?null:R,t?0:A,t?0:X]);const ve=t?e.exposure??0:0,_e=t?e.tonemap:void 0,we=t?e.gamma:void 0,Re=c.useCallback(()=>{const N=a.current;if(!N||!d||!g)return;const U=r.current,W=o.current,G=W?W.getBoundingClientRect():U?U.getBoundingClientRect():{width:g.w,height:g.h},K=In({zoom:S,pan:L},G,g.w,g.h);w(F=>F.x===K.x&&F.y===K.y&&F.w===K.w&&F.h===K.h?F:K),G.width>0&&G.height>0&&N.resize(Math.round(G.width*ee),Math.round(G.height*ee));const Z=On(K,G,g.w,g.h)>=kt?"nearest":"linear",Me=K,k=t?{exposureEV:ve+A,offset:X,operator:s.current?"extended":Fo(_e),gamma:we,isScalar:!1,hdrOut:s.current,uv:Me,filter:Z}:{exposureEV:y!=="none"?0:A,offset:y!=="none"?0:X,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Me,filter:Z};try{N.render(k)||l(!0)}catch(F){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",F),l(!0)}},[d,g,S,L.x,L.y,ve,A,X,_e,we,t,y,ee]);c.useEffect(()=>{Re()},[Re,f,h]);const Le=c.useCallback((N,U,W)=>{if(t){const re=M.current,q=g;if(!re||!q||N<0||U<0||N>=q.w||U>=q.h)return null;const te=re.shape.length===2?1:re.shape[2]??1,Ee=(U*q.w+N)*te,ge=re.data,oe=.5;return te===1?{lines:[Q(ge[Ee]??0,"unit",W)],luminance:oe}:{lines:[Q(ge[Ee]??0,"unit",W),Q(ge[Ee+1]??0,"unit",W),Q(ge[Ee+2]??0,"unit",W)],luminance:oe,colors:[pe[0],pe[1],pe[2]]}}const G=_.current;if(!G||N<0||U<0||N>=G.width||U>=G.height)return null;const K=(U*G.width+N)*4,Z=G.data[K],Me=G.data[K+1],k=G.data[K+2],F=(.299*Z+.587*Me+.114*k)/255;return y!=="none"||Z===Me&&Me===k?{lines:[Q(Z,"uint8",W)],luminance:F}:{lines:[Q(Z,"uint8",W),Q(Me,"uint8",W),Q(k,"uint8",W)],luminance:F,colors:[pe[0],pe[1],pe[2]]}},[t,g,y]),he=e.showAxes??!1,Se=t?e.label??"":e.label,me=e.interpolation??"auto",j=me==="auto"?void 0:me,ue=t?void 0:e.overlay,fe=t?void 0:e.overlaySettings,H=t?!1:e.isDraggable??!1,J=t?void 0:e.onDragStart;if(u)return t?i.jsx(Nt,{...e}):i.jsx(Nt,{...e});const ye=ue&&(fe!=null&&fe.enabled)&&g&&((((xe=ue.boxes)==null?void 0:xe.length)??0)>0||(((be=ue.masks)==null?void 0:be.length)??0)>0)?i.jsx(At,{data:ue,settings:fe,naturalWidth:g.w,naturalHeight:g.h}):void 0;return i.jsx(it,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":d},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:S,pan:L,onViewportChange:B,naturalDims:g,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:he&&g?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:j},"data-gpu-image-canvas":!0}),showAxes:he,overlayNode:ye,overlay:{displayElRef:n,sample:Le,version:T,hasSource:!0,sourceWindow:m},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Re,leadingMenus:t?void 0:[Bt(y,N=>P(N))],displayAdjust:{exposureEV:A,offset:X,onExposureChange:D,onOffsetChange:ae},label:Se,showLabelChip:!!Se,isDraggable:H,onDragStart:J})}const ct=new Map;function ze(e){if(ct.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);ct.set(e.id,e)}function Qe(e){return ct.get(e)}function $o(){return Array.from(ct.values())}function Bn(e,t){return{...e.params??{},...t??{}}}const Xo={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},Wo={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Yo={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Ho={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Ko={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},qo={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Nn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Qo(Nn);const Ut=[1.052156925,1,.91835767],Zo=.7;function Qo(e){const[t,n,r]=e[0],[o,a,s]=e[1],[u,l,d]=e[2],p=a*d-s*l,g=-(o*d-s*u),x=o*l-a*u,v=1/(t*p+n*g+r*x);return[[p*v,-(n*d-r*l)*v,(n*s-r*a)*v],[g*v,(t*d-r*u)*v,-(t*s-r*o)*v],[x*v,-(t*l-n*u)*v,(t*a-n*o)*v]]}function jo(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Gt=6/29;function Ft(e){return e>Gt**3?Math.cbrt(e):e/(3*Gt*Gt)+4/29}function Un(e,t,n){const[r,o,a]=jo(Nn,e,t,n),s=Ft(r*Ut[0]),u=Ft(o*Ut[1]),l=Ft(a*Ut[2]),d=116*u-16,p=500*(s-u),g=200*(u-l);return[d,.01*d*p,.01*d*g]}function Jo(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function es(){const e=Un(0,1,0),t=Un(0,0,1);return Math.pow(Jo(e,t),Zo)}const Gn=es(),ts=.082;function Fn(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),u=1/e,l=Math.PI**2,d=[0,0,0];for(let p=-s;p<=s;p++)for(let g=-s;g<=s;g++){const x=(g*u)**2+(p*u)**2;for(let f=0;f<3;f++)d[f]+=t[f]*Math.sqrt(Math.PI/n[f])*Math.exp(-l*x/n[f])+r[f]*Math.sqrt(Math.PI/o[f])*Math.exp(-l*x/o[f])}return{r:s,deltaX:u,sums:d}}function Vn(e){const t=.5*ts*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let u=-n;u<=n;u++){const l=Math.exp(-(u*u+s*s)/(2*t*t)),d=-u*l,p=(u*u/(t*t)-1)*l;d>0&&(r+=d),p>0?o+=p:a-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const ns=`
${Fe}
${st}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,rs=`
${Fe}
${st}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,lt=`
${Fe}
${st}
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
`,zn=`
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
`;function Ye(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function ut(e){return[Ye(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ye(2,[e.sums[2],0,0,0])]}function $n(e){return[Ye(4,[Gn,e.sd,e.r,e.edgeNorm]),Ye(5,[e.pointPos,e.pointNeg,0,0])]}function Xn(e,t,n,r,o=""){const a=Fn(e),s=Vn(e),u=`ycxczA${o}`,l=`ycxczB${o}`,d=`labA${o}`,p=`labB${o}`,g=`flip${o}`;return{passes:[{name:u,shader:t,inputs:[n],output:u},{name:l,shader:t,inputs:[r],output:l},{name:d,shader:lt,inputs:[u],output:d,uniforms:()=>ut(a)},{name:p,shader:lt,inputs:[l],output:p,uniforms:()=>ut(a)},{name:g,shader:zn,inputs:[d,p,u,l],output:g,uniforms:()=>$n(s)}],flipRef:g}}const os={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Xn(t,ns,"srcA","srcB");return{passes:n,final:r}}},ss={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Xn(t,rs,"srcA","srcB");return{passes:n,final:r}}},Wn=`
${Fe}
${st}
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
`,as=`
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
`,is={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=Fn(t),u=Vn(t),l=[];let d=null;for(let p=0;p<o;p++){const g=n+p*a,x=`_e${p}`,f=`ycxczA${x}`,v=`ycxczB${x}`,h=`labA${x}`,b=`labB${x}`,m=`acc${x}`;l.push({name:f,shader:Wn,inputs:["srcA"],output:f,uniforms:()=>[Ye(1,[g,0,0,0])]},{name:v,shader:Wn,inputs:["srcB"],output:v,uniforms:()=>[Ye(1,[g,0,0,0])]},{name:h,shader:lt,inputs:[f],output:h,uniforms:()=>ut(s)},{name:b,shader:lt,inputs:[v],output:b,uniforms:()=>ut(s)}),d===null?l.push({name:m,shader:zn,inputs:[h,b,f,v],output:m,uniforms:()=>$n(u)}):l.push({name:m,shader:as,inputs:[h,b,f,v,d],output:m,uniforms:()=>[Ye(5,[Gn,u.sd,u.r,u.edgeNorm]),Ye(6,[u.pointPos,u.pointNeg,0,0])]}),d=m}return{passes:l,final:d}}};let Yn=!1;function cs(){Yn||(Yn=!0,ze(Wo),ze(Xo),ze(Yo),ze(Ko),ze(Ho),ze(qo),ze(os),ze(is),ze(ss))}cs();function Hn(){const e=[];for(const t of $o())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function ls(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function us(e,t){return e==="signed"||e==="relative"?"signed":xt.has(t??"")?"positive":"linear"}const Kn=new WeakMap;function Vt(e,t,n,r){let o=Kn.get(e);o||(o=new Map,Kn.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function ds(e){return`
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
`}const dt="rgba16float";function fs(e,t,n,r,o){var f,v;const a=Qe(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),u=Math.min(t.height,n.height),l=Bn(a,o);if(a.kind==="pointwise"){const h=e.createTexture(s,u,dt),b=Vt(e,`pw:${a.id}`,ds(a.source),dt);let m;try{m=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(h,b,m)}finally{(f=m==null?void 0:m.destroy)==null||f.call(m)}return h}const d={width:s,height:u,params:l},p=a.buildPasses(d),g=new Map([["srcA",t],["srcB",n]]),x=[];try{for(const b of p.passes){const m=e.createTexture(s,u,dt);x.push(m),g.set(b.output,m);const w=Vt(e,`mp:${a.id}:${b.name}`,b.shader,dt),M=b.inputs.map((T,E)=>{const S=g.get(T);if(!S)throw new Error(`computeDiff: pass "${b.name}" input "${T}" not produced yet`);return{binding:E,resource:S}});b.uniforms&&M.push(...b.uniforms(d));let _;try{_=e.createBindGroup(w,M),e.renderFullscreen(m,w,_)}finally{(v=_==null?void 0:_.destroy)==null||v.call(_)}}const h=g.get(p.final);if(!h)throw new Error(`computeDiff: final ref "${p.final}" not produced`);for(const b of x)b!==h&&b.destroy();return h}catch(h){for(const b of x)b.destroy();throw h}}const ps=8,hs=256*1024*1024;class gs{constructor(t=ps,n=hs){se(this,"map",new Map);se(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const qn=new WeakMap;function ms(e){let t=qn.get(e);return t||(t=new gs,qn.set(e,t)),t}function xs(e,t){const n=Bn(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function vs(e,t,n,r){const o=Qe(n),a=o?xs(o,r):"";return`${e}|${t}|${n}|${a}`}function bs(e,t,n,r,o,a,s){const u=Qe(r);if(!u)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=ms(e),d=vs(a,s,r,o),p=l.get(d);if(p)return p;const g=fs(e,t,n,r,o),x=Math.min(t.width,n.width),f=Math.min(t.height,n.height),v={texture:g,width:x,height:f,displayRange:u.displayRange,bytes:x*f*8};return l.set(d,v),v}async function ws(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=mn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}async function ys(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,r})),t.resultSamplesPending)}const Es=`
${Fe}
${ln}
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
`,_s={unit:0,signed:1,relative:2},Ms={linear:0,signed:1,positive:2};function Ts(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ps(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Ss(e,t,n,r,o){var x;const a=Ps(t),s=Vt(e,"diff-display",Es,a),u=Ts(e,o.colormap),l=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([_s[r],Ms[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]);let g;try{g=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:p}}]),e.renderFullscreen(t,s,g)}finally{(x=g==null?void 0:g.destroy)==null||x.call(g),u.destroy()}}const Zn=.6*.6*2.51,Cs=.6*.03,As=0,Qn=.6*.6*2.43,ks=.6*.59,Rs=.14;function jn(e){const t=(Cs-ks*e)/(Zn-Qn*e),n=(As-Rs*e)/(Zn-Qn*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Ls=.85,Ds=.85,Jn=11920928955078125e-23,zt=[.2126,.7152,.0722];function Is(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Os(e,t,n,r=3,o={}){const a=t*n,s=jn(Ls),u=jn(Ds),l=new Float64Array(a);let d=0;for(let w=0;w<a;w++){const[M,_,T]=Is(e,w,r),E=M*zt[0]+_*zt[1]+T*zt[2];l[w]=E,E>d&&(d=E)}const p=Float64Array.from(l).sort(),g=a>>1,x=a%2===1?p[g]:p[g-1],f=Math.max(x,Jn),v=Math.max(d,Jn),h=o.startExposure??Math.log2(s/v),b=o.stopExposure??Math.log2(u/f),m=Math.max(2,Math.ceil(b-h));return{startExposure:h,stopExposure:b,numExposures:m}}const Bs={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ns({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:u,onViewportChange:l,processing:d=Bs,interpolation:p="auto",label:g="",isDraggable:x=!1,onDragStart:f,overlay:v,overlaySettings:h,pixelValueNotation:b="decimal"}){var ue,fe;const m=c.useRef(null),[w,M]=c.useState(null),[_,T]=c.useState(null),[E,S]=c.useState(b),[L,B]=c.useState(!1),V=c.useRef(null),R=c.useRef(null),P=c.useRef(null),y=c.useRef(null),[A,D]=c.useState(0);c.useEffect(()=>{if(!e){P.current=null,D(J=>J+1);return}let H=!1;return Ke(e).then(J=>{H||(P.current=J,D(ye=>ye+1))}),()=>{H=!0}},[e]),c.useEffect(()=>{if(!t){y.current=null,D(J=>J+1);return}let H=!1;return Ke(t).then(J=>{H||(y.current=J,D(ye=>ye+1))}),()=>{H=!0}},[t]);const X=H=>(J,ye,xe)=>{const be=H.current;if(!be||J<0||ye<0||J>=be.width||ye>=be.height)return null;const N=(ye*be.width+J)*4,U=be.data[N],W=be.data[N+1],G=be.data[N+2],K=(.299*U+.587*W+.114*G)/255;return U===W&&W===G?{lines:[Q(U,"uint8",xe)],luminance:K}:{lines:[Q(U,"uint8",xe),Q(W,"uint8",xe),Q(G,"uint8",xe)],luminance:K,colors:[pe[0],pe[1],pe[2]]}},ae=c.useMemo(()=>X(P),[]),ee=c.useMemo(()=>X(y),[]),ve=!!v&&!!(h!=null&&h.enabled)&&!!w&&!!e&&((((ue=v.boxes)==null?void 0:ue.length)??0)>0||(((fe=v.masks)==null?void 0:fe.length)??0)>0),{gammaFilterId:_e,filterStr:we,gamma:Re,offset:Le}=En(d),he=`translate(${u.x}px, ${u.y}px) scale(${s})`,Se=p==="auto"?void 0:p,{containerProps:me,modifierActive:j}=sn({containerRef:m,zoom:s,pan:u,onViewportChange:l});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(_n,{id:_e,gamma:Re,offset:Le}),i.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...me.style},onPointerDown:me.onPointerDown,onPointerMove:me.onPointerMove,onPointerUp:me.onPointerUp,onPointerCancel:me.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:he,transformOrigin:"0 0"},children:[i.jsx("img",{ref:V,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:we,imageRendering:Se,...n==="blend"?{opacity:o}:{}},onLoad:H=>{const J=H.currentTarget;M({w:J.naturalWidth,h:J.naturalHeight})}}),ve&&i.jsx(At,{data:v,settings:h,naturalWidth:w.w,naturalHeight:w.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:he,transformOrigin:"0 0"},children:i.jsx("img",{ref:R,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:we,imageRendering:Se,...n==="blend"?{opacity:1-o}:{}},onLoad:H=>{const J=H.currentTarget;T({w:J.naturalWidth,h:J.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:H=>{H.stopPropagation(),H.preventDefault();const ye=H.currentTarget.parentElement.getBoundingClientRect(),xe=N=>{a==null||a(Math.max(0,Math.min(1,(N.clientX-ye.left)/ye.width)))},be=()=>{window.removeEventListener("pointermove",xe),window.removeEventListener("pointerup",be)};window.addEventListener("pointermove",xe),window.addEventListener("pointerup",be)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&_&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:R,naturalWidth:_.w,naturalHeight:_.h,zoom:s,pan:u,sample:ee,notation:E,version:A})}),e&&w&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Ze,{imageElRef:V,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:u,sample:ae,notation:E,version:A,onActiveChange:B})})]}):e&&w&&i.jsx(Ze,{imageElRef:V,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:u,sample:ae,notation:E,version:A,onActiveChange:B}),L&&i.jsx(cn,{notation:E,onChange:S})]}),n==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${x&&!j?" cairn-drag-grip":""}`,draggable:x&&!j,onDragStart:f,style:{cursor:x&&!j?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),g]})]})}function Us(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Gs(e){const t=vt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Fs(e){const{data:t,width:n,height:r,channels:o}=e,a=n*r,s=new Float32Array(a*4),u=l=>Number.isFinite(l)?l:0;for(let l=0;l<a;l++){const d=l*o;let p,g,x,f=1;o===1?p=g=x=u(t[d]):o===3?(p=u(t[d]),g=u(t[d+1]),x=u(t[d+2])):(p=u(t[d]),g=u(t[d+1]),x=u(t[d+2]),f=u(t[d+3]));const v=l*4;s[v]=p,s[v+1]=g,s[v+2]=x,s[v+3]=f}return s}function Vs({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,diffSubmode:l,colormap:d="none",diffKernel:p,onDiffKernelChange:g,onCompareModeChange:x,onRequestSide:f,zoom:v,pan:h,onViewportChange:b,interpolation:m="auto",label:w="",pixelValueNotation:M="decimal"}){var er;const _=c.useRef(null),T=c.useRef(null),E=c.useRef(null),S=c.useRef(null),L=c.useRef(null),[B,V]=c.useState(!1),[R,P]=c.useState(!1),[y,A]=c.useState(null),[D,X]=c.useState(0),[ae,ee]=c.useState(0),[ve,_e]=c.useState(null),[we,Re]=c.useState({x:0,y:0,w:1,h:1}),Le=p??l??"absolute",[he,Se]=c.useState(Le);c.useEffect(()=>{Se(p??l??"absolute")},[p,l]);const me=c.useCallback(C=>{Se(C),g==null||g(C)},[g]);c.useEffect(()=>{const C=_.current;if(C)return C.__cairnDiffKernel={current:he,set:me},()=>{C&&delete C.__cairnDiffKernel}},[he,me]);const[j,ue]=c.useState(o);c.useEffect(()=>{ue(o)},[o]);const fe=c.useCallback(C=>{ue(C),x==null||x(C)},[x]),[H,J]=c.useState(d);c.useEffect(()=>{J(d)},[d]);const ye=c.useCallback(()=>{fe(o),J(d),me(p??l??"absolute")},[o,d,p,l,fe,me]),[xe,be]=c.useState(0),[N,U]=c.useState(0),W=c.useMemo(()=>{const O=[{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...f?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...Hn().map(I=>({id:I.id,label:I.label}))],value:j==="diff"?he:j==="split"?"slide":"blend",onSelect:I=>{I==="side"?f==null||f():I==="slide"?fe("split"):I==="blend"?fe("blend"):(fe("diff"),me(I))}}}];return j==="diff"&&O.push(Bt(H,I=>J(I))),O},[j,he,H,me,fe,f]),G=c.useRef(null),K=c.useRef(null),Z=c.useRef(null),Me=c.useRef(null),[k,F]=c.useState(0),Y=c.useRef(null),[re,q]=c.useState(0),te=Ct();c.useEffect(()=>{const C=E.current;if(!C)return;let ie=!1;return nt().then(z=>{if(!ie)try{if(xn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const O=z.createSurface(C,{hdr:!1});S.current={device:z,surface:O,texA:null,texB:null},P(!0)}catch(O){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",O),V(!0)}}).catch(z=>{ie||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",z),V(!0))}),()=>{var O,I;ie=!0;const z=S.current;z&&((O=z.texA)==null||O.destroy(),(I=z.texB)==null||I.destroy(),S.current=null)}},[]),c.useEffect(()=>{const C=_.current;if(!C)return;const ie=new ResizeObserver(()=>ee(z=>z+1));return ie.observe(C),()=>ie.disconnect()},[]),c.useEffect(()=>{if(!R)return;let C=!1;if(!S.current)return;async function z(O,I){if(I){const le=Fs(I);return{width:I.width,height:I.height,imageData:null,make:ne=>{const Pe=ne.createTexture(I.width,I.height,"rgba32float");return Pe.write(le),Pe}}}if(!O)return null;const ce=await Ke(O);return ce?{width:ce.width,height:ce.height,imageData:ce,make:le=>{const ne=le.createTexture(ce.width,ce.height,"rgba8unorm");return ne.write(ce.data),ne}}:null}return Promise.all([z(e,n),z(t,r)]).then(([O,I])=>{var ne,Pe;if(C||!S.current)return;const ce=S.current;G.current=(O==null?void 0:O.imageData)??null,K.current=(I==null?void 0:I.imageData)??null,Z.current=n??null,Me.current=r??null,(ne=ce.texA)==null||ne.destroy(),(Pe=ce.texB)==null||Pe.destroy(),ce.texA=null,ce.texB=null;const le=O??I;if(!le){A(null),F(Ae=>Ae+1);return}ce.texA=(I??le).make(ce.device),ce.texB=(O??le).make(ce.device),A({w:le.width,h:le.height}),F(Ae=>Ae+1),X(Ae=>Ae+1)}),()=>{C=!0}},[R,e,t,n,r]);const Ee=n!=null||r!=null,ge=c.useMemo(()=>ls(he,Ee),[he,Ee]),oe=c.useMemo(()=>{if(!Ee)return null;const C=r??n;return C?Os(C.data,C.width,C.height,C.channels):null},[Ee,r,n]),Ie=c.useMemo(()=>{var C;return us(((C=Qe(ge))==null?void 0:C.displayRange)??"unit",H==="none"?null:H)},[ge,H]),Te=c.useMemo(()=>H!=="none"?Gs(H):void 0,[H]),De=c.useCallback(()=>{const C=S.current;if(!R||!C||!C.surface||!C.texA||!C.texB||!y)return;const ie=_.current,z=ie?ie.getBoundingClientRect():{width:y.w,height:y.h},O=In({zoom:v,pan:h},z,y.w,y.h);Re(ne=>ne.x===O.x&&ne.y===O.y&&ne.w===O.w&&ne.h===O.h?ne:O);const I=E.current;if(z.width>0&&z.height>0&&I&&C.surface){const ne=Math.max(1,Math.round(z.width*te)),Pe=Math.max(1,Math.round(z.height*te));(I.width!==ne||I.height!==Pe)&&(I.width=ne,I.height=Pe,C.surface.configure(ne,Pe))}const ce=On(O,z,y.w,y.h)>=kt?"nearest":"linear",le=O;try{if(j==="diff"){const ne=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Pe=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ae=Qe(ge)?ge:"absolute",et=Ae==="hdr-flip"&&oe?{ppd:67,startExposure:oe.startExposure,stopExposure:oe.stopExposure,numExposures:oe.numExposures}:void 0,je=bs(C.device,C.texA,C.texB,Ae,et,ne,Pe);L.current=je,Ss(C.device,C.surface,je.texture,je.displayRange,{uv:le,cmapMode:Ie,colormap:Te,filter:ce,exposureEV:xe,offset:N})}else{const ne={exposureEV:xe,offset:N,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:le,filter:ce,mode:j,split:a,alpha:s};no(C.device,C.surface,C.texA,C.texB,ne)}}catch(ne){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ne),V(!0)}},[R,y,v,h.x,h.y,j,a,s,xe,N,he,ge,oe,Ie,Te,e,t,n,r,te]);c.useEffect(()=>{De()},[De,D,ae]);const Ue=t!=null||r!=null;c.useEffect(()=>{const C=S.current;if(!R||!C||!C.texA||!C.texB||!Ue){_e(null);return}let ie=!1;const z=C.texA,O=C.texB,I=L.current;return(j==="diff"&&I?ws(C.device,I,z,O):mn(C.device,z,O)).then(le=>{ie||_e(le)}),()=>{ie=!0}},[R,D,Ue,j,he]),c.useEffect(()=>{if(j!=="diff"){Y.current=null;return}const C=S.current,ie=L.current;if(!R||!C||!ie)return;let z=!1;return Y.current=null,q(O=>O+1),ys(C.device,ie).then(O=>{z||(Y.current=O,q(I=>I+1))}).catch(()=>{}),()=>{z=!0}},[R,j,ge,D]);const He=(C,ie)=>(z,O,I)=>{const ce=ie.current;if(ce){const{data:ft,width:tr,height:Ks,channels:nr}=ce;if(z<0||O<0||z>=tr||O>=Ks)return null;const pt=(O*tr+z)*nr,rr=.5;return nr===1?{lines:[Q(ft[pt]??0,"unit",I)],luminance:rr}:{lines:[Q(ft[pt]??0,"unit",I),Q(ft[pt+1]??0,"unit",I),Q(ft[pt+2]??0,"unit",I)],luminance:rr,colors:[pe[0],pe[1],pe[2]]}}const le=C.current;if(!le||z<0||O<0||z>=le.width||O>=le.height)return null;const ne=(O*le.width+z)*4,Pe=le.data[ne],Ae=le.data[ne+1],et=le.data[ne+2],je=(.299*Pe+.587*Ae+.114*et)/255;return Pe===Ae&&Ae===et?{lines:[Q(Pe,"uint8",I)],luminance:je}:{lines:[Q(Pe,"uint8",I),Q(Ae,"uint8",I),Q(et,"uint8",I)],luminance:je,colors:[pe[0],pe[1],pe[2]]}},Ge=c.useMemo(()=>He(G,Z),[]),Xs=c.useMemo(()=>He(K,Me),[]),Ws=c.useMemo(()=>(C,ie,z)=>{var Ae;const O=Y.current;if(!O||!y)return null;const{w:I,h:ce}=y;if(C<0||ie<0||C>=I||ie>=ce)return null;const le=(ie*I+C)*4,ne=((Ae=Qe(ge))==null?void 0:Ae.output)??"per-channel",Pe=.5;return ne==="scalar"?{lines:[Q(O[le]??0,"unit",z)],luminance:Pe}:{lines:[Q(O[le]??0,"unit",z),Q(O[le+1]??0,"unit",z),Q(O[le+2]??0,"unit",z)],luminance:Pe,colors:[pe[0],pe[1],pe[2]]}},[y,ge]),Ys=m==="auto"?void 0:m;if(B)return n!=null||r!=null?i.jsx(Us,{}):j==="diff"?i.jsx(Nt,{imageUrl:e,baselineUrl:t,diffMode:((er=Qe(ge))==null?void 0:er.kind)==="pointwise"?ge:"absolute",interpolation:m,colormap:H,showAxes:!1,zoom:v,pan:h,onViewportChange:b,label:w,pixelValueNotation:M}):i.jsx(Ns,{imageUrl:e,baselineUrl:t,mode:j,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,zoom:v,pan:h,onViewportChange:b,interpolation:m,label:w,pixelValueNotation:M});const Hs=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:E,className:"w-full h-full block",style:{imageRendering:Ys},"data-gpu-compare-canvas":!0}),j==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:C=>{C.stopPropagation(),u==null||u(.5)},onPointerDown:C=>{C.stopPropagation(),C.preventDefault();const z=C.currentTarget.parentElement.getBoundingClientRect(),O=ce=>{u==null||u(Math.max(0,Math.min(1,(ce.clientX-z.left)/z.width)))},I=()=>{window.removeEventListener("pointermove",O),window.removeEventListener("pointerup",I)};window.addEventListener("pointermove",O),window.addEventListener("pointerup",I)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(it,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":R},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:_,wrapperRef:T,zoom:v,pan:h,onViewportChange:b,naturalDims:y,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Hs,showAxes:!1,notationSeed:M,onReset:ye,exportCanvasRef:E,requestRender:De,leadingMenus:W,displayAdjust:{exposureEV:xe,offset:N,onExposureChange:be,onOffsetChange:U},label:"",showLabelChip:!1,overlay:{render:({notation:C,setOverlayActive:ie})=>j==="split"?i.jsxs(i.Fragment,{children:[Ue&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(Ze,{imageElRef:E,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:we,sample:Xs,notation:C,version:k})}),Ue&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(Ze,{imageElRef:E,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:we,sample:Ge,notation:C,version:k,onActiveChange:ie})})]}):y&&i.jsx(Ze,{imageElRef:E,naturalWidth:y.w,naturalHeight:y.h,zoom:v,pan:h,sourceWindow:we,sample:j==="diff"?Ws:Ge,notation:C,version:j==="diff"?re:k,onActiveChange:ie})},extraChips:i.jsxs(i.Fragment,{children:[j==="split"&&i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),w?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:w}):null,ve&&i.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${w?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",ve.mse.toExponential(2)," · PSNR ",Number.isFinite(ve.psnr)?ve.psnr.toFixed(1):"∞"," dB · MAE"," ",ve.mae.toExponential(2)]})]})})}const zs="cairn-plot:gpu-image-ready";async function $s(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await nt(),window.__cairnPlotGpuImagePane=zo,window.__cairnPlotGpuComparePane=Vs,window.__cairnPlotDiffMenuModes=Hn(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(zs))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}$s()})(__cairnPlotJsxRuntime,__cairnPlotReact);
