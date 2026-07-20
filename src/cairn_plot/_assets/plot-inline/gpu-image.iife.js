var qo=Object.defineProperty;var Ko=(i,l,Re)=>l in i?qo(i,l,{enumerable:!0,configurable:!0,writable:!0,value:Re}):i[l]=Re;var ee=(i,l,Re)=>Ko(i,typeof l!="symbol"?l+"":l,Re);(function(i,l){"use strict";const Re=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function St(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Re}),{hdr:!1,format:n}}function Tn(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Re}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Re}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return St(e,t)}}}const Sn=`
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
`;function Qe(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Pt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Pn(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const An={texture:0,sampler:1,uniform:2};function Je(e,t){return e*3+An[t]}const Cn={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function kn(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const u=Cn[s];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class At{constructor(t,n,r,o){ee(this,"width");ee(this,"height");ee(this,"format");ee(this,"gpuTexture");ee(this,"device");ee(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Qe(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Pt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Ct{constructor(t){ee(this,"_s");ee(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Rn{constructor(t,n,r,o,a){ee(this,"_p");ee(this,"gpuPipeline");ee(this,"bindings");ee(this,"bindGroupLayout");ee(this,"variants");ee(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Ln(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Dn{constructor(t){ee(this,"_c");ee(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class In{constructor(t,n){ee(this,"_b");ee(this,"gpuBindGroup");ee(this,"ownedBuffers");ee(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Un{constructor(t,n,r,o){ee(this,"canvas");ee(this,"hdr");ee(this,"format");ee(this,"context");ee(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function $e(e){return"canvas"in e}async function Bn(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(c){return $e(c)?c.getCurrentTextureView():c.gpuTexture.createView()}function s(c){if($e(c))return{width:c.canvas.width,height:c.canvas.height};const w=c;return{width:w.width,height:w.height}}let u=!1;const f=256;let d=null,h=null;function x(){if(!d||!h){const c=t.createShaderModule({code:Sn});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const w=t.createPipelineLayout({bindGroupLayouts:[h]});d=t.createComputePipeline({layout:w,compute:{module:c,entryPoint:"cs_main"}})}return{pipeline:d,layout:h}}return{backend:"webgpu",capabilities:n,createTexture(c,w,m){return new At(t,c,w,m)},createSampler(c){const w=(c==null?void 0:c.filter)==="linear"?"linear":"nearest",m=t.createSampler({magFilter:w,minFilter:w,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Ct(m)},createRenderPipeline(c){const w=t.createShaderModule({code:c.shaderWGSL}),m=kn(c.shaderWGSL),v=Qe(c.targetFormat),p=Ln(t,m),g=t.createPipelineLayout({bindGroupLayouts:[p]}),_=E=>t.createRenderPipeline({layout:g,vertex:{module:w,entryPoint:"vs_main"},fragment:{module:w,entryPoint:"fs_main",targets:[{format:E}]},primitive:{topology:"triangle-list"}}),y=_(v);return new Rn(y,m,p,v,_)},createComputePipeline(c){const w=t.createShaderModule({code:c.shaderWGSL}),m=t.createComputePipeline({layout:"auto",compute:{module:w,entryPoint:"cs_main"}});return new Dn(m)},createBindGroup(c,w){const m=c,v=new Map,p=[];for(const[_,y]of m.bindings)if(y.kind==="uniform"){const E=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});p.push(E),v.set(_,{binding:_,resource:{buffer:E}})}else y.kind==="sampler"&&v.set(_,{binding:_,resource:o()});for(const _ of w){const y=_.resource;if(y instanceof At){const E=Je(_.binding,"texture");m.bindings.has(E)&&v.set(E,{binding:E,resource:y.gpuTexture.createView()})}else if(y instanceof Ct){const E=Je(_.binding,"sampler");m.bindings.has(E)&&v.set(E,{binding:E,resource:y.gpuSampler})}else{const E=Je(_.binding,"uniform"),T=m.bindings.get(E);if(T&&T.kind==="uniform"){const A=y.uniform,P=t.createBuffer({size:Math.max(T.sizeBytes,A.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(P,0,A.buffer,A.byteOffset,A.byteLength),p.push(P),v.set(E,{binding:E,resource:{buffer:P}})}}}const g=t.createBindGroup({layout:m.bindGroupLayout,entries:Array.from(v.values())});return new In(g,p)},createSurface(c,w){const m=c.getContext("webgpu");if(!m)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const v=w.hdr&&n.hdr,p=()=>v?Tn(m,t):St(m,t),g=p();return new Un(c,m,g,p)},renderFullscreen(c,w,m){const v=w,p=m,g=a(c),{width:_,height:y}=s(c),E=$e(c)?c.format:Qe(c.format),T=v.pipelineFor(E),A=t.createCommandEncoder(),P=A.beginRenderPass({colorAttachments:[{view:g,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(T),P.setBindGroup(0,p.gpuBindGroup),P.setViewport(0,0,_,y,0,1),P.draw(3),P.end(),t.queue.submit([A.finish()])},async readback(c){const w=$e(c),{width:m,height:v}=s(c),p=w?c.hdr?"rgba16float":"rgba8unorm":c.format,g=w&&c.format==="bgra8unorm",_=w?c.getCurrentGPUTexture():c.gpuTexture,y=Pt(p),E=m*y,T=256,A=Math.ceil(E/T)*T,P=A*v,I=t.createBuffer({size:P,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),D=t.createCommandEncoder();D.copyTextureToBuffer({texture:_},{buffer:I,bytesPerRow:A,rowsPerImage:v},{width:m,height:v,depthOrArrayLayers:1}),t.queue.submit([D.finish()]),await I.mapAsync(GPUMapMode.READ);const C=new Uint8Array(I.getMappedRange()),S=new Uint8Array(E*v);for(let G=0;G<v;G++){const H=G*A,V=G*E;S.set(C.subarray(H,H+E),V)}if(I.unmap(),I.destroy(),p==="rgba8unorm"){if(g)for(let G=0;G<S.length;G+=4){const H=S[G],V=S[G+2];S[G]=V,S[G+2]=H}return S}if(p==="rgba16float"){const G=new Uint16Array(S.buffer,S.byteOffset,S.byteLength/2),H=new Float32Array(G.length);for(let V=0;V<G.length;V++)H[V]=Pn(G[V]);return H}return new Float32Array(S.buffer,S.byteOffset,S.byteLength/4)},async reduceDiffSumSquaredAbs(c,w,m,v){const p=c,g=w,_=Math.max(0,m*v),y=Math.max(1,Math.ceil(_/f)),{pipeline:E,layout:T}=x(),A=y*2*4,P=t.createBuffer({size:A,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),I=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(I,0,new Uint32Array([Math.max(1,m),Math.max(1,v),_,0]));const D=t.createBindGroup({layout:T,entries:[{binding:0,resource:p.gpuTexture.createView()},{binding:1,resource:g.gpuTexture.createView()},{binding:2,resource:{buffer:P}},{binding:3,resource:{buffer:I}}]}),C=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),S=t.createCommandEncoder(),G=S.beginComputePass();G.setPipeline(E),G.setBindGroup(0,D),G.dispatchWorkgroups(y),G.end(),S.copyBufferToBuffer(P,0,C,0,A),t.queue.submit([S.finish()]),await C.mapAsync(GPUMapMode.READ);const V=new Float32Array(C.getMappedRange()).slice();C.unmap(),C.destroy(),P.destroy(),I.destroy();let te=0,le=0;for(let ue=0;ue<y;ue++)te+=V[ue*2],le+=V[ue*2+1];return{sumSq:te,sumAbs:le}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let et=null;async function On(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Bn()}function Xe(){return et||(et=On()),et}function Gn(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Nn(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),u=o-a,[f,d,h]=Gn(e[a],e[s],u);t[n*3]=Math.round(f),t[n*3+1]=Math.round(d),t[n*3+2]=Math.round(h)}return t}const kt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Rt=new Set(["red-green","red-blue"]),Lt=new Map;function tt(e){let t=Lt.get(e);if(!t){const n=kt[e]??kt.viridis;t=Nn(n),Lt.set(e,t)}return t}function nt(e,t,n="linear"){const r=tt(t),o=new ImageData(e.width,e.height),a=e.data,s=o.data;for(let u=0;u<a.length;u+=4){const f=(a[u]+a[u+1]+a[u+2])/3;let d;n==="positive"?d=Math.round(128+f/255*127):d=Math.round(f),d=Math.max(0,Math.min(255,d)),s[u]=r[d*3],s[u+1]=r[d*3+1],s[u+2]=r[d*3+2],s[u+3]=a[u+3]}return o}function Dt(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const It=Dt(50);function rt(e){return It.get(e)}function ot(e,t){It.set(e,t)}const Ut=Dt(100);function Fn(e){return Ut.get(e)}function zn(e,t){Ut.set(e,t)}function Vn(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let u=0;u<r;u++){const f=(s*e.width+u)*4,d=(s*t.width+u)*4,h=(s*r+u)*4;for(let x=0;x<3;x++){const b=e.data[f+x],c=t.data[d+x],w=b-c,m=Math.abs(w),v=Math.max(b,1);let p;switch(n){case"signed":p=(w+255)/2;break;case"absolute":p=m;break;case"squared":p=w*w/255;break;case"relative_signed":p=(w/v+1)*127.5;break;case"relative_absolute":p=m/v*255;break;case"relative_squared":p=w*w/(v*v)*255;break}a.data[h+x]=Math.min(255,Math.max(0,Math.round(p)))}a.data[h+3]=255}return a}async function Ie(e){const t=Fn(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);zn(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const $n={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Xn={linear:0,signed:1,positive:2},Wn=`#version 300 es
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
}`;let Ue=null,q=null,Ee=null,We=null;function Hn(){if(q)return q;try{if(typeof OffscreenCanvas<"u"?Ue=new OffscreenCanvas(1,1):Ue=document.createElement("canvas"),q=Ue.getContext("webgl2",{preserveDrawingBuffer:!0}),!q)return console.warn("[cairn] WebGL 2 not available"),null;const e=q.createShader(q.VERTEX_SHADER);if(q.shaderSource(e,Wn),q.compileShader(e),!q.getShaderParameter(e,q.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",q.getShaderInfoLog(e)),null;const t=q.createShader(q.FRAGMENT_SHADER);if(q.shaderSource(t,Yn),q.compileShader(t),!q.getShaderParameter(t,q.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",q.getShaderInfoLog(t)),null;if(Ee=q.createProgram(),q.attachShader(Ee,e),q.attachShader(Ee,t),q.linkProgram(Ee),!q.getProgramParameter(Ee,q.LINK_STATUS))return console.error("[cairn] WebGL program link:",q.getProgramInfoLog(Ee)),null;We=q.createVertexArray(),q.bindVertexArray(We);const n=q.createBuffer();q.bindBuffer(q.ARRAY_BUFFER,n),q.bufferData(q.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),q.STATIC_DRAW);const r=q.getAttribLocation(Ee,"a_pos");return q.enableVertexAttribArray(r),q.vertexAttribPointer(r,2,q.FLOAT,!1,0,0),q.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),q}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Bt(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function qn(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Kn(e,t,n,r){const o=Hn();if(!o||!Ee||!We||!Ue)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);Ue.width=a,Ue.height=s,o.viewport(0,0,a,s);const u=Bt(o,e,0),f=Bt(o,t,1);let d=null;n.colormap?d=qn(o,n.colormap,2):(d=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,d),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ee),o.uniform1i(o.getUniformLocation(Ee,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ee,"u_other"),1),o.uniform1i(o.getUniformLocation(Ee,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ee,"u_diff_mode"),$n[n.diffMode]),o.uniform1i(o.getUniformLocation(Ee,"u_cmap_mode"),Xn[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ee,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(We),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const h=r.getContext("2d");return h&&(h.save(),h.scale(1,-1),h.drawImage(Ue,0,0,a,s,0,-s,a,s),h.restore()),o.deleteTexture(u),o.deleteTexture(f),o.deleteTexture(d),{width:a,height:s}}const Zn="cairn:render-mode";function jn(){try{const e=localStorage.getItem(Zn);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Se=e=>e<0?0:e>1?1:e,at=e=>{const t=e<0?0:e;return t/(1+t)},st=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Se(n/r)},Ot={linear:([e,t,n])=>[Se(e),Se(t),Se(n)],srgb:([e,t,n])=>[Se(e),Se(t),Se(n)],reinhard:([e,t,n])=>[at(e),at(t),at(n)],aces:([e,t,n])=>[st(e),st(t),st(n)],extended:([e,t,n])=>[e,t,n]},Qn="srgb";function Jn(e){return e&&Ot[e]||Ot[Qn]}function it(e,t){return e*2**t}function er(e){const t=Se(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function ct(e,t){return typeof t=="number"&&t>0?Se(Math.pow(Se(e),1/t)):er(e)}const Pe=new Uint32Array(512),Ae=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Pe[e]=0,Pe[e|256]=32768,Ae[e]=24,Ae[e|256]=24):t<-14?(Pe[e]=1024>>-t-14,Pe[e|256]=1024>>-t-14|32768,Ae[e]=-t-1,Ae[e|256]=-t-1):t<=15?(Pe[e]=t+15<<10,Pe[e|256]=t+15<<10|32768,Ae[e]=13,Ae[e|256]=13):t<128?(Pe[e]=31744,Pe[e|256]=64512,Ae[e]=24,Ae[e|256]=24):(Pe[e]=31744,Pe[e|256]=64512,Ae[e]=13,Ae[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Ve=Uint8Array,Gt=Uint16Array,tr=Int32Array,nr=new Ve([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),rr=new Ve([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Nt=function(e,t){for(var n=new Gt(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new tr(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},Ft=Nt(nr,2),or=Ft.b,ar=Ft.r;or[28]=258,ar[258]=28,Nt(rr,0);for(var sr=new Gt(32768),ne=0;ne<32768;++ne){var Le=(ne&43690)>>1|(ne&21845)<<1;Le=(Le&52428)>>2|(Le&13107)<<2,Le=(Le&61680)>>4|(Le&3855)<<4,sr[ne]=((Le&65280)>>8|(Le&255)<<8)>>1}for(var Ye=new Ve(288),ne=0;ne<144;++ne)Ye[ne]=8;for(var ne=144;ne<256;++ne)Ye[ne]=9;for(var ne=256;ne<280;++ne)Ye[ne]=7;for(var ne=280;ne<288;++ne)Ye[ne]=8;for(var ir=new Ve(32),ne=0;ne<32;++ne)ir[ne]=5;var cr=new Ve(0),lr=typeof TextDecoder<"u"&&new TextDecoder,ur=0;try{lr.decode(cr,{stream:!0}),ur=1}catch{}const zt=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function lt(e){const t=zt.length;return zt[(e%t+t)%t]}function dr(e){const n=l.useRef(null),[r,o]=l.useState({w:0,h:0}),a=l.useRef(null),s=l.useRef(null),u=l.useRef(null),f=l.useCallback((d,h)=>{o(x=>x.w===d&&x.h===h?x:{w:d,h})},[]);return l.useLayoutEffect(()=>{const d=n.current;if(!d||d===u.current)return;const h=d.getBoundingClientRect();(h.width>0||h.height>0)&&(u.current=d,f(h.width,h.height))}),l.useEffect(()=>{var x;const d=n.current;if(d===s.current||((x=a.current)==null||x.disconnect(),a.current=null,s.current=d,!d))return;const h=new ResizeObserver(b=>{for(const c of b)f(c.contentRect.width,c.contentRect.height)});a.current=h,h.observe(d)}),l.useEffect(()=>()=>{var d;return(d=a.current)==null?void 0:d.disconnect()},[]),{ref:n,size:r}}function fr(){const[e,t]=l.useState(!1);return l.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const pr=.25,ut=64;function Vt(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return ut;const o=Math.min(n/e,r/t);return o<=0?ut:Math.max(Math.max(n,r)/o,8)}function $t(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=pr,maxZoom:s=ut,naturalWidth:u,naturalHeight:f}=e,d=fr(),h=l.useRef(d);h.current=d;const x=l.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const b=l.useRef(o);b.current=o,l.useEffect(()=>{const g=t.current;if(!g||!o)return;const _=y=>{var H;if(!h.current)return;y.preventDefault(),y.stopPropagation();const E=y.deltaY<0?1.1:1/1.1,T=x.current,A=g.getBoundingClientRect(),P=u&&f?Vt(u,f,A.width,A.height):s,I=Math.max(a,Math.min(P,T.zoom*E));if(T.zoom===I)return;const D=y.clientX-A.left,C=y.clientY-A.top,S=D-(D-T.pan.x)/T.zoom*I,G=C-(C-T.pan.y)/T.zoom*I;(H=b.current)==null||H.call(b,{zoom:I,pan:{x:S,y:G}})};return g.addEventListener("wheel",_,{passive:!1}),()=>g.removeEventListener("wheel",_)},[t,!!o,a,s,u,f]);const c=l.useRef(null),w=l.useCallback(g=>{!h.current||!b.current||(g.currentTarget.setPointerCapture(g.pointerId),c.current={pointerId:g.pointerId,startX:g.clientX,startY:g.clientY,panX:x.current.pan.x,panY:x.current.pan.y})},[]),m=l.useCallback(g=>{var T;const _=c.current;if(!_||_.pointerId!==g.pointerId)return;const y=g.clientX-_.startX,E=g.clientY-_.startY;(T=b.current)==null||T.call(b,{zoom:x.current.zoom,pan:{x:_.panX+y,y:_.panY+E}})},[]),v=l.useCallback(g=>{const _=c.current;if(!(!_||_.pointerId!==g.pointerId)){try{g.currentTarget.releasePointerCapture(g.pointerId)}catch{}c.current=null}},[]),p=d&&!!o;return{containerProps:{onPointerDown:w,onPointerMove:m,onPointerUp:v,onPointerCancel:v,style:{cursor:p?"move":void 0,touchAction:p?"none":void 0}},modifierActive:d}}function dt(){const[e,t]=l.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return l.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function hr(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Xt(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function ft({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=dr(),s=l.useRef(null),u=l.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),f=l.useMemo(()=>{const m=a.w,v=a.h;if(m<=0||v<=0||n<=0||r<=0)return null;const p=Math.min(m/n,v/r),g=n*p,_=r*p;return{left:(m-g)/2,top:(v-_)/2,width:g,height:_}},[a.w,a.h,n,r]),d=e.masks,h=t.showMasks&&!!d&&d.length>0,x=l.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(l.useEffect(()=>{if(!h||!d)return;const m=s.current;if(!m)return;(m.width!==n||m.height!==r)&&(m.width=n,m.height=r);const v=m.getContext("2d");if(!v)return;v.clearRect(0,0,m.width,m.height);let p=!1;const g=v.createImageData(n,r),_=g.data;let y=d.length,E=!1;const T=()=>{p||E&&v.putImageData(g,0,0)},A=document.createElement("canvas");A.width=n,A.height=r;const P=A.getContext("2d",{willReadFrequently:!0});for(const I of d){const D=new Image;D.onload=()=>{if(!p){if(P){P.clearRect(0,0,n,r),P.drawImage(D,0,0,n,r);const C=P.getImageData(0,0,n,r).data;for(let S=0;S<n*r;S++){const G=C[S*4];if(G===0||u.has(G))continue;const[H,V,te]=hr(lt(G));_[S*4]=H,_[S*4+1]=V,_[S*4+2]=te,_[S*4+3]=255,E=!0}}y-=1,y===0&&T()}},D.onerror=()=>{y-=1,y===0&&T()},D.src=`data:image/png;base64,${I.png_b64}`}return()=>{p=!0}},[h,d,n,r,x]),!f)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const b=e.boxes??[],c=t.showBoxes&&b.length>0,w=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[h&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),c&&i.jsx("svg",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:b.map((m,v)=>{if(!Xt(m,t,u))return null;const p=m.domain==="pixel"?1:n,g=m.domain==="pixel"?1:r,_=m.position.minX*p,y=m.position.minY*g,E=(m.position.maxX-m.position.minX)*p,T=(m.position.maxY-m.position.minY)*g;return i.jsx("rect",{x:_,y,width:E,height:T,fill:"none",stroke:lt(m.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},v)})}),c&&i.jsx("div",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height},children:b.map((m,v)=>{if(!Xt(m,t,u))return null;const p=m.domain==="pixel"?1/n:1,g=m.domain==="pixel"?1/r:1,_=m.position.minX*p*100,y=m.position.minY*g*100,E=m.label??w[String(m.class_id)]??`#${m.class_id}`,T=m.score!=null?` ${(m.score*100).toFixed(0)}%`:"";return!E&&!T?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${_}%`,top:`${y}%`,transform:"translateY(-100%)",backgroundColor:lt(m.class_id)},children:i.jsxs("span",{className:"mono",children:[E,T]})},v)})})]})}const pt=30,pe=["#ff5a5a","#39d353","#5b9bff"];function ht(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function se(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):ht(e/255):ht(n==="int"?e*255:e)}const gr={x:0,y:0,w:1,h:1};function Be({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:u=0,onActiveChange:f,sourceWindow:d=gr}){const h=l.useRef(null),x=l.useRef(!1),b=dt(),c=l.useRef(f);c.current=f;const w=l.useCallback(v=>{var p;v!==x.current&&(x.current=v,(p=c.current)==null||p.call(c,v))},[]),m=l.useCallback(()=>{var me;const v=h.current,p=e.current;if(!v)return;const g=window.devicePixelRatio||1,_=v.clientWidth,y=v.clientHeight;if(_===0||y===0)return;v.width!==Math.round(_*g)&&(v.width=Math.round(_*g)),v.height!==Math.round(y*g)&&(v.height=Math.round(y*g));const E=v.getContext("2d");if(!E)return;if(E.setTransform(g,0,0,g,0,0),E.clearRect(0,0,_,y),!p||t<=0||n<=0){w(!1);return}const T=p.getBoundingClientRect(),A=v.getBoundingClientRect();if(T.width===0||T.height===0){w(!1);return}const P=d.x*t,I=d.y*n,D=d.w*t,C=d.h*n;if(D<=0||C<=0){w(!1);return}const S=Math.min(T.width/D,T.height/C);if(S<pt){w(!1);return}const G=D*S,H=C*S,V=T.left+(T.width-G)/2-A.left,te=T.top+(T.height-H)/2-A.top,le=Math.max(Math.floor(P),Math.floor(P+(0-V)/S)),ue=Math.min(Math.ceil(P+D),Math.ceil(P+(_-V)/S)),_e=Math.max(Math.floor(I),Math.floor(I+(0-te)/S)),Me=Math.min(Math.ceil(I+C),Math.ceil(I+(y-te)/S));if(ue<=le||Me<=_e){w(!1);return}w(!0);const he=V+(0-P)*S,re=te+(0-I)*S,Te=V+(t-P)*S,de=te+(n-I)*S;E.save(),E.beginPath(),E.rect(he,re,Te-he,de-re),E.clip(),E.textAlign="center",E.textBaseline="middle",E.lineJoin="round";const J=S*.14,ge=S-J*2;for(let xe=_e;xe<Me;xe++)for(let be=le;be<ue;be++){if(be<0||xe<0||be>=t||xe>=n)continue;const K=a(be,xe,s);if(!K||K.lines.length===0)continue;const k=K.lines.length;let N=1;for(const R of K.lines)R.length>N&&(N=R.length);const $=ge/(k*1.15),B=ge/(N*.62)||$,W=Math.min($,B,24);if(W<6)continue;const Y=V+(be-P+.5)*S,ie=te+(xe-I+.5)*S,ce=W*1.15,oe=K.luminance<=.55,fe=oe?"#ffffff":"#000000";E.font=`${W}px ui-monospace, SFMono-Regular, Menlo, monospace`,E.lineWidth=Math.max(1.4,W*.16),E.strokeStyle=oe?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let we=ie-k*ce/2+ce/2;for(let R=0;R<K.lines.length;R++){const Z=K.lines[R];E.strokeText(Z,Y,we),E.fillStyle=((me=K.colors)==null?void 0:me[R])??fe,E.fillText(Z,Y,we),we+=ce}}E.restore()},[e,t,n,a,s,w,d]);return l.useEffect(()=>{m()},[m,r,o.x,o.y,u,s,d,b]),l.useEffect(()=>{const v=h.current;if(!v)return;const p=new ResizeObserver(()=>m());return p.observe(v),()=>p.disconnect()},[m]),i.jsx("canvas",{ref:h,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Wt({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const mr=`
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
`,Ne=`
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
${Ne}
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
`}const xr=qt("select(colorB, colorA, uv.x < split)"),br=qt("mix(colorA, colorB, alpha)"),gt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Kt=new WeakMap;function wr(e,t){let n=Kt.get(e);n||(n=new Map,Kt.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:mr,targetFormat:t}),n.set(t,r)),r}function Zt(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function jt(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function yr(e,t,n,r){var w;const o=Zt(t),a=wr(e,o),s=jt(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,f=gt[r.operator]??gt.srgb,d=new Float32Array([r.exposureEV,f,u,r.isScalar?1:0]),h=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),b=new Float32Array([r.filter==="nearest"?0:1]);let c;try{c=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:d}},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,a,c)}finally{(w=c==null?void 0:c.destroy)==null||w.call(c),s.destroy()}}const Qt=new WeakMap;function Er(e,t,n){let r=Qt.get(e);r||(r=new Map,Qt.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?xr:br,targetFormat:n}),r.set(o,a)),a}function _r(e,t,n,r,o){var w;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Zt(t),s=Er(e,o.mode,a),u=jt(e,void 0),f=o.gamma,d=gt[o.operator],h=new Float32Array([o.exposureEV,d,f,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),b=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]);let c;try{c=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,s,c)}finally{(w=c==null?void 0:c.destroy)==null||w.call(c),u.destroy()}}function Jt(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function en(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:b,sumAbs:c}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return Jt(b,c,a)}const s=await e.readback(t),u=await e.readback(n),f=s instanceof Uint8Array,d=u instanceof Uint8Array;let h=0,x=0;for(let b=0;b<o;b++)for(let c=0;c<r;c++){const w=(b*t.width+c)*4,m=(b*n.width+c)*4;for(let v=0;v<3;v++){const p=(s[w+v]??0)/(f?255:1),g=(u[m+v]??0)/(d?255:1),_=p-g;h+=_*_,x+=Math.abs(_)}}return Jt(h,x,a)}function tn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Mr=12,De=[];function nn(e){const t=De.indexOf(e);t!==-1&&De.splice(t,1),De.push(e)}function Tr(e){const t=De.indexOf(e);t!==-1&&De.splice(t,1)}function He(e){e.parked||(Tr(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function rn(e){for(;De.length>Mr;){const t=De.find(n=>n!==e&&!n.visible)??De.find(n=>n!==e);if(!t)break;He(t)}}function on(e){var o,a;if(e.disposed)return;if(tn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){nn(e),rn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,nn(e),rn(e)}function Sr(e,t){if(e.disposed||!e.source)return!0;try{return on(e),!e.surface||!e.srcTexture?!1:(yr(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,He(e),!1}}function Pr(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Sr(e,t)},park(){e.disposed||He(e)},restore(){e.disposed||!e.source||on(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(He(e),e.source=null,e.disposed=!0)}}}async function Ar(e,t){const n=await Xe(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Pr(r)}function an(e){e.dispose()}function Cr(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function sn(e){const n=`cairn-gamma-${l.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:u,flipSign:f}=e,d=l.useMemo(()=>Cr(e,n),[n,r,o,s,f]);return{gammaFilterId:n,filterStr:d,gamma:a,offset:u}}function cn({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function ln(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function kr({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=ln(e),a=ln(t),s=[];for(let g=0;g<=e;g+=o)s.push(g);const u=[];for(let g=0;g<=t;g+=a)u.push(g);const f=1/n,d=8*f,h=-12*f,x=-2*f,b=r==null?void 0:r.current;let c=0,w=0,m=0,v=0;if(b){const g=b.clientWidth,_=b.clientHeight,y=g/e,E=_/t,T=Math.min(y,E);m=e*T,v=t*T,c=(g-m)/2,w=(_-v)/2}const p=b&&m>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:p?w:0,transform:`translateY(${h}px)`,fontSize:d},children:s.map(g=>i.jsx("span",{className:"mono",style:{position:"absolute",left:p?c+g/e*m:`${g/e*100}%`,transform:"translateX(-50%)"},children:g},g))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:p?c:0,transform:`translateX(${x}px)`,fontSize:d},children:u.map(g=>i.jsx("span",{className:"mono",style:{position:"absolute",top:p?w+g/t*v:`${g/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*f}px`},children:g},g))})]})}function Rr({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Lr=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function un(e,t){const n=getComputedStyle(e),r=Lr.map(f=>`${f}:${n.getPropertyValue(f)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,u=Math.min(a.length,s.length);for(let f=0;f<u;f++)un(a[f],s[f])}function mt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function vt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function xt(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((u,f)=>a.toBlob(d=>d?u(d):f(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Dr(e,t,n){const r=e.cloneNode(!0);un(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,u)=>{const f=new Image;f.onload=()=>s(f),f.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),f.src=a})}async function dn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??mt(e);return xt(r,o,vt(t),a,s=>s.drawImage(e,0,0,r,o))}async function Ir(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??mt(e);try{return await xt(r,o,vt(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Ur(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function Br(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,u=(t==null?void 0:t.background)??mt(e);if(n){const d=n.getBoundingClientRect(),h=await Dr(n,d.width||a,d.height||s);return xt(a,s,vt(t),u,x=>{for(const b of r){const c=b.getBoundingClientRect();x.drawImage(b,c.left-o.left,c.top-o.top,c.width,c.height)}x.drawImage(h,d.left-o.left,d.top-o.top,d.width,d.height)})}if(r.length)return dn(r[0],t);const f=Ur(e);if(f)return Ir(f,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Or(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Gr={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Nr={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:i.jsx("path",{d:"M6 9l6 6 6-6"})};function bt({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Nr[e]??null})}function Ce({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(bt,{name:e??""})})}function qe(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Fr({icon:e,title:t,menu:n}){var v;const{options:r,value:o,onSelect:a}=n,[s,u]=l.useState(!1),[f,d]=l.useState(0),h=l.useRef(null),x=Math.max(0,r.findIndex(p=>p.id===o)),b=e?void 0:((v=r[x])==null?void 0:v.label)??"",c=l.useCallback(()=>{u(p=>{const g=!p;return g&&d(x),g})},[x]),w=l.useCallback(p=>{a(p),u(!1)},[a]);l.useEffect(()=>{if(!s)return;const p=_=>{h.current&&!h.current.contains(_.target)&&u(!1)},g=_=>{_.key==="Escape"&&(_.stopPropagation(),u(!1))};return document.addEventListener("pointerdown",p,!0),document.addEventListener("keydown",g,!0),()=>{document.removeEventListener("pointerdown",p,!0),document.removeEventListener("keydown",g,!0)}},[s]);const m=p=>{if(!s){(p.key==="ArrowDown"||p.key==="Enter"||p.key===" ")&&(p.preventDefault(),d(x),u(!0));return}if(p.key==="ArrowDown")p.preventDefault(),d(g=>(g+1)%r.length);else if(p.key==="ArrowUp")p.preventDefault(),d(g=>(g-1+r.length)%r.length);else if(p.key==="Enter"||p.key===" "){p.preventDefault();const g=r[f];g&&w(g.id)}};return i.jsxs("div",{ref:h,className:"relative inline-flex",onPointerDown:p=>p.stopPropagation(),children:[i.jsxs("button",{type:"button",onClick:p=>{p.stopPropagation(),c()},onDoubleClick:p=>p.stopPropagation(),onKeyDown:m,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",b?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[b?i.jsx("span",{"aria-hidden":"true",children:b}):i.jsx(bt,{name:e??""}),i.jsx(bt,{name:"caret"})]}),s&&i.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((p,g)=>{const _=p.id===o,y=g===f;return i.jsx("li",{role:"option","aria-selected":_,children:i.jsx("button",{type:"button",onClick:E=>{E.stopPropagation(),w(p.id)},onPointerEnter:()=>d(g),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",y?"bg-bg-hover":"",_?"text-accent font-medium":"text-fg"].join(" "),children:p.label})},p.id)})})]})}function zr({controller:e,config:t}){if((t==null?void 0:t.enabled)===!1)return null;const n=e.capabilities,r=t==null?void 0:t.buttons,o=(c,w)=>w&&(r==null?void 0:r[c])!==!1,a=c=>()=>e.setDragMode(c),s=o("zoom",n.zoom)||o("pan",n.pan)||o("select",n.select)||o("lasso",n.lasso),u=o("zoomIn",n.zoom)||o("zoomOut",n.zoom),f=o("autoscale",n.autoscale)||o("reset",n.reset),d=o("screenshot",n.screenshot),h=(t==null?void 0:t.leadingButtons)??[];if(!h.length&&!s&&!u&&!f&&!d)return null;const x=(t==null?void 0:t.position)??"top-right",b=(t==null?void 0:t.visibility)==="always";return i.jsxs("div",{style:{position:"absolute",pointerEvents:"auto",...Gr[x]},className:["z-30 flex items-center gap-0.5 rounded border border-border","bg-bg-elevated/90 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-opacity",b?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),role:"toolbar","aria-label":"Plot controls",children:[h.length>0&&i.jsxs(i.Fragment,{children:[h.map(c=>c.menu?i.jsx(Fr,{icon:c.icon,title:c.title,menu:c.menu},c.id):i.jsx(Ce,{icon:c.icon,label:c.label,title:c.title,active:c.active,disabled:c.disabled,onClick:c.onClick??(()=>{})},c.id)),(s||u||f||d)&&i.jsx(qe,{})]}),s&&i.jsxs(i.Fragment,{children:[o("zoom",n.zoom)&&i.jsx(Ce,{icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:a("zoom")}),o("pan",n.pan)&&i.jsx(Ce,{icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:a("pan")}),o("select",n.select)&&i.jsx(Ce,{icon:"select",title:"Box select",active:e.dragMode==="select",onClick:a("select")}),o("lasso",n.lasso)&&i.jsx(Ce,{icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:a("lasso")})]}),u&&i.jsxs(i.Fragment,{children:[s&&i.jsx(qe,{}),o("zoomIn",n.zoom)&&i.jsx(Ce,{icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),o("zoomOut",n.zoom)&&i.jsx(Ce,{icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()})]}),f&&i.jsxs(i.Fragment,{children:[(s||u)&&i.jsx(qe,{}),o("autoscale",n.autoscale)&&i.jsx(Ce,{icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),o("reset",n.reset)&&i.jsx(Ce,{icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()})]}),d&&i.jsxs(i.Fragment,{children:[(s||u||f)&&i.jsx(qe,{}),i.jsx(Ce,{icon:"camera",title:"Download plot as PNG",onClick:()=>{e.toPNG({filename:"plot"}).then(c=>Or(c,"plot.png")).catch(()=>{})}})]})]})}const Vr={zoom:1,pan:{x:0,y:0}},fn=1.3,$r=.25,Xr=64,Wr={buttons:{zoom:!1}};function Yr(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Hr=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function wt(e,t){return{id:"colormap",title:"Colormap",menu:{options:Hr,value:e,onSelect:t}}}function qr({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:u=$r,maxZoom:f=Xr,requestRender:d}){const h=l.useCallback(y=>{var H;if(!o)return;const E=(H=e.current)==null?void 0:H.getBoundingClientRect(),T=(E==null?void 0:E.width)??0,A=(E==null?void 0:E.height)??0,P=a&&s&&T>0&&A>0?Vt(a,s,T,A):f,I=Math.max(u,Math.min(P,n*y));if(I===n)return;const D=T/2,C=A/2,S=D-(D-r.x)/n*I,G=C-(C-r.y)/n*I;o({zoom:I,pan:{x:S,y:G}})},[o,e,a,s,f,u,n,r.x,r.y]),x=l.useCallback(()=>h(fn),[h]),b=l.useCallback(()=>h(1/fn),[h]),c=l.useCallback(()=>o==null?void 0:o(Vr),[o]),w=l.useCallback(y=>{const E={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};d==null||d();const T=t==null?void 0:t.current;if(T)return dn(T,E);const A=e.current;return A?Br(A,E):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,d]),m=l.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),v=n!==1||r.x!==0||r.y!==0,p=l.useCallback(y=>{},[]),g=l.useCallback(y=>{},[]),_=l.useCallback(()=>{},[]);return l.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:v,setDragMode:p,setHoverMode:g,toggleSpikelines:_,zoomIn:x,zoomOut:b,autoscale:c,reset:c,toPNG:w}),[m,v,p,g,_,x,b,c,w])}const Kr={zoom:1,pan:{x:0,y:0}};function Ke({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:u,naturalDims:f,checkerboard:d,wrapperClassName:h,wrapperStyle:x,viewportPadding:b,header:c,surface:w,showAxes:m,overlayNode:v,overlay:p,notationSeed:g,exportCanvasRef:_,requestRender:y,leadingMenus:E,label:T,showLabelChip:A,isDraggable:P=!1,onDragStart:I,extraChips:D}){const[C,S]=l.useState(g),[G,H]=l.useState(!1),{containerProps:V}=$t({containerRef:r,zoom:a,pan:s,onViewportChange:u,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h}),te=l.useCallback(()=>{u==null||u(Kr)},[u]),le=qr({rootRef:r,canvasRef:_,zoom:a,pan:s,onViewportChange:u,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h,requestRender:y}),ue=l.useMemo(()=>({...Wr,leadingButtons:[...E??[],...G?[Yr(C,S)]:[]]}),[G,C,E]),_e=" cairn-checkerboard",Me="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(d==="pane"?_e:""),he=h+(d==="wrapper"?_e:""),re="render"in p?p.render({notation:C,setOverlayActive:H}):p.hasSource&&f?i.jsx(Be,{imageElRef:p.displayElRef,naturalWidth:f.w,naturalHeight:f.h,zoom:a,pan:s,sourceWindow:p.sourceWindow,sample:p.sample,notation:C,version:p.version,onActiveChange:H}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[c,n&&i.jsx(zr,{controller:le,config:ue}),i.jsxs("div",{ref:r,className:Me,style:{padding:b,...V.style},onPointerDown:V.onPointerDown,onPointerMove:V.onPointerMove,onPointerUp:V.onPointerUp,onPointerCancel:V.onPointerCancel,onDoubleClick:te,...t,children:[i.jsxs("div",{ref:o,className:he,style:x,children:[w,m&&f&&i.jsx(kr,{naturalWidth:f.w,naturalHeight:f.h,zoom:a,containerRef:o}),v]}),re,!n&&G&&i.jsx(Wt,{notation:C,onChange:S})]}),A&&i.jsx(Rr,{label:T,isDraggable:P,onDragStart:I}),D]})}function pn(e){return"hdr"in e&&e.hdr!=null}function hn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function ve(e){return Number.isFinite(e)?e:0}const Zr={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function jr(e,t,n,r){const{h:o,w:a,c:s}=hn(e.shape),u=e.data,f=Jn(t),d=new Uint8ClampedArray(a*o*4);for(let h=0;h<a*o;h++){const x=h*s;let b,c,w,m=1;s===1?b=c=w=ve(u[x]):s===3?(b=ve(u[x]),c=ve(u[x+1]),w=ve(u[x+2])):(b=ve(u[x]),c=ve(u[x+1]),w=ve(u[x+2]),m=ve(u[x+3]));const v=[it(b,n),it(c,n),it(w,n)],[p,g,_]=f(v),y=h*4;d[y]=255*ct(p,r),d[y+1]=255*ct(g,r),d[y+2]=255*ct(_,r),d[y+3]=255*(m<0?0:m>1?1:m)}return new ImageData(d,a,o)}function Qr(e){var fe,we;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:u=!1,processing:f=Zr,zoom:d=1,pan:h={x:0,y:0},onViewportChange:x,onNaturalSize:b,label:c,isDraggable:w=!1,onDragStart:m,overlay:v,overlaySettings:p,pixelValueNotation:g="decimal",toolbar:_=!0}=e,[y,E]=l.useState(s);l.useEffect(()=>{E(s)},[s]);const T=l.useRef(null),A=l.useRef(null),P=l.useRef(null),I=l.useRef(null),D=l.useRef(null),C=l.useRef(null),S=l.useRef(null),[G,H]=l.useState(0),V=l.useCallback(()=>H(R=>R+1),[]),te=l.useMemo(()=>({get current(){const R=D.current;return R instanceof HTMLCanvasElement?R:null}}),[]),le=l.useCallback(R=>{T.current=R,R&&(D.current=R)},[]),ue=l.useCallback(R=>{A.current=R,R&&(D.current=R)},[]),_e=l.useCallback(R=>{R&&(D.current=R)},[]),[Me,he]=l.useState(!1),[re,Te]=l.useState(!1),[de,J]=l.useState(null),{flipSign:ge}=f,{gammaFilterId:me,filterStr:xe,gamma:be,offset:K}=sn(f),k=!r&&o!=="none"&&n!=null&&t!=null,N=o!=="none"&&n!=null,$=y!=="none"&&!k&&!(r&&N)&&t!=null;l.useEffect(()=>{if(!$||!t){Te(!1);return}let R=!1;Te(!1);const Z=`${t}::${y}`,j=rt(Z);if(j){const L=A.current;if(L){L.width=j.width,L.height=j.height;const U=L.getContext("2d");U&&U.putImageData(j,0,0),S.current=j,V(),J({w:j.width,h:j.height}),b==null||b(j.width,j.height),Te(!0)}return}const M=new Image;return M.onload=()=>{if(R)return;const L=document.createElement("canvas");L.width=M.naturalWidth,L.height=M.naturalHeight;const U=L.getContext("2d");if(!U)return;U.drawImage(M,0,0);const F=U.getImageData(0,0,L.width,L.height),O=Rt.has(y)?"positive":"linear",z=nt(F,y,O);ot(Z,z);const Q=A.current;if(!Q||R)return;Q.width=z.width,Q.height=z.height;const X=Q.getContext("2d");X&&X.putImageData(z,0,0),S.current=z,V(),J({w:z.width,h:z.height}),b==null||b(z.width,z.height),Te(!0)},M.src=t,()=>{R=!0}},[$,t,y]);const B=l.useCallback((R,Z)=>{J(j=>j&&j.w===R&&j.h===Z?j:{w:R,h:Z}),b==null||b(R,Z)},[]);l.useEffect(()=>{if(!t){C.current=null,S.current=null,V();return}let R=!1;return Ie(t).then(Z=>{R||(C.current=Z,y==="none"&&(S.current=Z),V())}),()=>{R=!0}},[t,y,V]);const W=l.useCallback((R,Z,j)=>{const M=C.current;if(!M||R<0||Z<0||R>=M.width||Z>=M.height)return null;const L=(Z*M.width+R)*4,U=M.data[L],F=M.data[L+1],O=M.data[L+2],z=S.current;let Q=U,X=F,ae=O;if(z&&z.width===M.width&&z.height===M.height){const Ge=(Z*z.width+R)*4;Q=z.data[Ge],X=z.data[Ge+1],ae=z.data[Ge+2]}const ye=(.299*Q+.587*X+.114*ae)/255;return y!=="none"||U===F&&F===O?{lines:[se(U,"uint8",j)],luminance:ye}:{lines:[se(U,"uint8",j),se(F,"uint8",j),se(O,"uint8",j)],luminance:ye,colors:[pe[0],pe[1],pe[2]]}},[y]);l.useEffect(()=>{if(!k){he(!1);return}let R=!1;const Z=jn(),j=Z==="gpu"||Z==="auto",M=`${n}::${t}::${o}::${y}`;if(Z!=="gpu"){const L=rt(M);if(L){const U=T.current;if(U){(U.width!==L.width||U.height!==L.height)&&(U.width=L.width,U.height=L.height);const F=U.getContext("2d");F&&F.putImageData(L,0,0),B(L.width,L.height),he(!0)}return}}return(async()=>{const[L,U]=await Promise.all([Ie(n),Ie(t)]);if(R||!L||!U)return;const O=o.includes("signed")?"signed":"positive",z=y!=="none"?tt(y):null,Q={diffMode:o,colormap:z,cmapMode:O};if(j)try{const ke=T.current;if(ke){const Ge=Kn(L,U,Q,ke);if(Ge){if(R)return;B(Ge.width,Ge.height),he(!0);return}}}catch(ke){console.warn("[cairn] WebGL 2 diff error:",ke)}if(Z==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let X=Vn(L,U,o);y!=="none"&&(X=nt(X,y,O)),ot(M,X);const ae=T.current;if(!ae||R)return;(ae.width!==X.width||ae.height!==X.height)&&(ae.width=X.width,ae.height=X.height);const ye=ae.getContext("2d");ye&&ye.putImageData(X,0,0),B(X.width,X.height),he(!0)})(),()=>{R=!0}},[n,t,o,k,y,b]);const Y=a==="auto"?void 0:a,ie=ge?{filter:"invert(1)"}:{},ce=v&&(p!=null&&p.enabled)&&de&&t&&((((fe=v.boxes)==null?void 0:fe.length)??0)>0||(((we=v.masks)==null?void 0:we.length)??0)>0)?i.jsx(ft,{data:v,settings:p,naturalWidth:de.w,naturalHeight:de.h}):void 0,oe=t?k?i.jsxs(i.Fragment,{children:[!Me&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:le,className:"w-full h-full object-contain block",style:{display:Me?"block":"none",imageRendering:Y,...ie}})]}):$?i.jsxs(i.Fragment,{children:[!re&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:ue,className:"w-full h-full object-contain block",style:{display:re?"block":"none",imageRendering:Y,...ie}})]}):i.jsx("img",{ref:_e,src:t,alt:c,className:"w-full h-full object-contain block",draggable:!1,style:{filter:xe,imageRendering:Y},onLoad:R=>{const Z=R.currentTarget;J({w:Z.naturalWidth,h:Z.naturalHeight}),b==null||b(Z.naturalWidth,Z.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(Ke,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:P,wrapperRef:I,zoom:d,pan:h,onViewportChange:x,naturalDims:de,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${d})`,transformOrigin:"0 0"},viewportPadding:u&&de?"16px 4px 4px 28px":"4px",header:i.jsx(cn,{id:me,gamma:be,offset:K}),surface:oe,showAxes:u,overlayNode:ce,overlay:{displayElRef:D,sample:W,version:G,hasSource:!!t},notationSeed:g,exportCanvasRef:te,leadingMenus:[wt(y,R=>E(R))],label:c,showLabelChip:!0,isDraggable:w,onDragStart:m})}function Jr(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:u="auto",zoom:f=1,pan:d={x:0,y:0},onViewportChange:h,pixelValueNotation:x="decimal",toolbar:b=!0}=e,c=l.useRef(null),w=l.useRef(null),m=l.useRef(null),[v,p]=l.useState(null),g=l.useRef(null),[_,y]=l.useState(0);l.useEffect(()=>{const A=c.current;if(!A)return;let P;try{P=jr(t,n,r,o)}catch(D){console.error("[cairn] HDR tone-map error:",D);return}(A.width!==P.width||A.height!==P.height)&&(A.width=P.width,A.height=P.height);const I=A.getContext("2d");I&&(I.putImageData(P,0,0),g.current=P,y(D=>D+1),p(D=>D&&D.w===P.width&&D.h===P.height?D:{w:P.width,h:P.height}))},[t,n,r,o]);const E=l.useCallback((A,P,I)=>{const D=v;if(!D||A<0||P<0||A>=D.w||P>=D.h)return null;const C=t.shape.length===2?1:t.shape[2]??1,S=(P*D.w+A)*C,G=t.data,H=g.current;let V=.5;if(H&&H.width===D.w&&H.height===D.h){const te=(P*D.w+A)*4;V=(.299*H.data[te]+.587*H.data[te+1]+.114*H.data[te+2])/255}return C===1?{lines:[se(G[S]??0,"unit",I)],luminance:V}:{lines:[se(G[S]??0,"unit",I),se(G[S+1]??0,"unit",I),se(G[S+2]??0,"unit",I)],luminance:V,colors:[pe[0],pe[1],pe[2]]}},[t,v]),T=u==="auto"?void 0:u;return i.jsx(Ke,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:w,wrapperRef:m,zoom:f,pan:d,onViewportChange:h,naturalDims:v,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${f})`,transformOrigin:"0 0"},viewportPadding:a&&v?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:c,className:"w-full h-full object-contain block",style:{imageRendering:T}}),showAxes:a,overlay:{displayElRef:c,sample:E,version:_,hasSource:!0},notationSeed:x,exportCanvasRef:c,label:s,showLabelChip:!!s})}function yt(e){return pn(e)?i.jsx(Jr,{...e}):i.jsx(Qr,{...e})}const eo=["linear","srgb","reinhard","aces"];function to(e){return e&&eo.includes(e)?e:"srgb"}function no(e){const{h:t,w:n,c:r}=hn(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const u=s*r;let f,d,h,x=1;r===1?f=d=h=ve(o[u]):r===3?(f=ve(o[u]),d=ve(o[u+1]),h=ve(o[u+2])):(f=ve(o[u]),d=ve(o[u+1]),h=ve(o[u+2]),x=ve(o[u+3]));const b=s*4;a[b]=f,a[b+1]=d,a[b+2]=h,a[b+3]=x}return{data:a,width:n,height:t,format:"rgba32float"}}function gn(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,u=(t.width-a)/2,f=(t.height-s)/2,d=Math.max(e.zoom,1e-6),h=t.width/(d*a),x=t.height/(d*s),b=-u/a-e.pan.x/(d*a),c=-f/s-e.pan.y/(d*s);return{x:b,y:c,w:h,h:x}}function mn(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function ro(e){var be,K;const t=pn(e),n=l.useRef(null),r=l.useRef(null),o=l.useRef(null),a=l.useRef(null),s=l.useRef(!1),[u,f]=l.useState(!1),[d,h]=l.useState(!1),[x,b]=l.useState(null),[c,w]=l.useState(0),[m,v]=l.useState(0),[p,g]=l.useState({x:0,y:0,w:1,h:1}),_=l.useRef(null),y=l.useRef(null),[E,T]=l.useState(0),A=e.zoom??1,P=e.pan??{x:0,y:0},I=e.onViewportChange,D=t?"none":e.colormap??"none",[C,S]=l.useState(D);l.useEffect(()=>{S(D)},[D]);const G=t?"none":C,H=dt();l.useEffect(()=>{const k=n.current;if(!k)return;let N=!1;return Xe().then($=>{if(N)return;const B=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,W=$.capabilities.hdr&&B&&t;s.current=W,Ar(k,{hdr:W}).then(Y=>{if(N){an(Y);return}a.current=Y,h(!0)}).catch(Y=>{N||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Y),f(!0))})}).catch($=>{N||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",$),f(!0))}),()=>{N=!0,a.current&&(an(a.current),a.current=null)}},[]),l.useEffect(()=>{const k=r.current;if(!k)return;const N=new ResizeObserver(()=>v($=>$+1));return N.observe(k),()=>N.disconnect()},[]),l.useEffect(()=>{const k=r.current;if(!k)return;const N=new IntersectionObserver($=>{const B=$[0];if(!B)return;const W=a.current;W&&(W.setVisible(B.isIntersecting),B.isIntersecting?W.isParked&&(W.restore(),v(Y=>Y+1)):W.park())},{threshold:0});return N.observe(k),()=>N.disconnect()},[]),l.useEffect(()=>{var $;if(!t||!d)return;const k=e.hdr;_.current=k;const N=no(k);($=a.current)==null||$.setSource(N),b(B=>B&&B.w===N.width&&B.h===N.height?B:{w:N.width,h:N.height}),T(B=>B+1),w(B=>B+1)},[t,d,t?e.hdr:null]),l.useEffect(()=>{if(t||!d)return;const k=e,N=k.imageUrl,$=C;if(!N){y.current=null,b(null),T(W=>W+1);return}let B=!1;return Ie(N).then(W=>{var ce,oe;if(B||!W)return;let Y=W;if($!=="none"){const fe=`gpu::${N}::${$}`,we=rt(fe);if(we)Y=we;else{const R=Rt.has($)?"positive":"linear";Y=nt(W,$,R),ot(fe,Y)}}y.current=W;const ie={data:Y.data,width:Y.width,height:Y.height,format:"rgba8unorm"};(ce=a.current)==null||ce.setSource(ie),b(fe=>fe&&fe.w===Y.width&&fe.h===Y.height?fe:{w:Y.width,h:Y.height}),(oe=k.onNaturalSize)==null||oe.call(k,Y.width,Y.height),T(fe=>fe+1),w(fe=>fe+1)}),()=>{B=!0}},[t,d,t?null:e.imageUrl,t?null:C]);const V=t?e.exposure??0:0,te=t?e.tonemap:void 0,le=t?e.gamma:void 0,ue=l.useCallback(()=>{const k=a.current;if(!k||!d||!x)return;const N=r.current,$=o.current,B=$?$.getBoundingClientRect():N?N.getBoundingClientRect():{width:x.w,height:x.h},W=gn({zoom:A,pan:P},B,x.w,x.h);g(oe=>oe.x===W.x&&oe.y===W.y&&oe.w===W.w&&oe.h===W.h?oe:W),B.width>0&&B.height>0&&k.resize(Math.round(B.width*H),Math.round(B.height*H));const Y=mn(W,B,x.w,x.h)>=pt?"nearest":"linear",ie=W,ce=t?{exposureEV:V,operator:s.current?"extended":to(te),gamma:le,isScalar:!1,hdrOut:s.current,uv:ie,filter:Y}:{exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ie,filter:Y};try{k.render(ce)||f(!0)}catch(oe){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",oe),f(!0)}},[d,x,A,P.x,P.y,V,te,le,t,H]);l.useEffect(()=>{ue()},[ue,c,m]);const _e=l.useCallback((k,N,$)=>{if(t){const we=_.current,R=x;if(!we||!R||k<0||N<0||k>=R.w||N>=R.h)return null;const Z=we.shape.length===2?1:we.shape[2]??1,j=(N*R.w+k)*Z,M=we.data,L=.5;return Z===1?{lines:[se(M[j]??0,"unit",$)],luminance:L}:{lines:[se(M[j]??0,"unit",$),se(M[j+1]??0,"unit",$),se(M[j+2]??0,"unit",$)],luminance:L,colors:[pe[0],pe[1],pe[2]]}}const B=y.current;if(!B||k<0||N<0||k>=B.width||N>=B.height)return null;const W=(N*B.width+k)*4,Y=B.data[W],ie=B.data[W+1],ce=B.data[W+2],oe=(.299*Y+.587*ie+.114*ce)/255;return G!=="none"||Y===ie&&ie===ce?{lines:[se(Y,"uint8",$)],luminance:oe}:{lines:[se(Y,"uint8",$),se(ie,"uint8",$),se(ce,"uint8",$)],luminance:oe,colors:[pe[0],pe[1],pe[2]]}},[t,x,G]),Me=e.showAxes??!1,he=t?e.label??"":e.label,re=e.interpolation??"auto",Te=re==="auto"?void 0:re,de=t?void 0:e.overlay,J=t?void 0:e.overlaySettings,ge=t?!1:e.isDraggable??!1,me=t?void 0:e.onDragStart;if(u)return t?i.jsx(yt,{...e}):i.jsx(yt,{...e});const xe=de&&(J!=null&&J.enabled)&&x&&((((be=de.boxes)==null?void 0:be.length)??0)>0||(((K=de.masks)==null?void 0:K.length)??0)>0)?i.jsx(ft,{data:de,settings:J,naturalWidth:x.w,naturalHeight:x.h}):void 0;return i.jsx(Ke,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":d},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:P,onViewportChange:I,naturalDims:x,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Me&&x?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Te},"data-gpu-image-canvas":!0}),showAxes:Me,overlayNode:xe,overlay:{displayElRef:n,sample:_e,version:E,hasSource:!0,sourceWindow:p},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ue,leadingMenus:t?void 0:[wt(G,k=>S(k))],label:he,showLabelChip:!!he,isDraggable:ge,onDragStart:me})}const Ze=new Map;function Oe(e){if(Ze.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Ze.set(e.id,e)}function Fe(e){return Ze.get(e)}function oo(){return Array.from(Ze.values())}function vn(e,t){return{...e.params??{}}}const ao={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",source:`
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
`},xn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];po(xn);const Et=[1.052156925,1,.91835767],fo=.7;function po(e){const[t,n,r]=e[0],[o,a,s]=e[1],[u,f,d]=e[2],h=a*d-s*f,x=-(o*d-s*u),b=o*f-a*u,w=1/(t*h+n*x+r*b);return[[h*w,-(n*d-r*f)*w,(n*s-r*a)*w],[x*w,(t*d-r*u)*w,-(t*s-r*o)*w],[b*w,-(t*f-n*u)*w,(t*a-n*o)*w]]}function ho(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const _t=6/29;function Mt(e){return e>_t**3?Math.cbrt(e):e/(3*_t*_t)+4/29}function bn(e,t,n){const[r,o,a]=ho(xn,e,t,n),s=Mt(r*Et[0]),u=Mt(o*Et[1]),f=Mt(a*Et[2]),d=116*u-16,h=500*(s-u),x=200*(u-f);return[d,.01*d*h,.01*d*x]}function go(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function mo(){const e=bn(0,1,0),t=bn(0,0,1);return Math.pow(go(e,t),fo)}const vo=mo(),xo=.082;function bo(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),u=1/e,f=Math.PI**2,d=[0,0,0];for(let h=-s;h<=s;h++)for(let x=-s;x<=s;x++){const b=(x*u)**2+(h*u)**2;for(let c=0;c<3;c++)d[c]+=t[c]*Math.sqrt(Math.PI/n[c])*Math.exp(-f*b/n[c])+r[c]*Math.sqrt(Math.PI/o[c])*Math.exp(-f*b/o[c])}return{r:s,deltaX:u,sums:d}}function wo(e){const t=.5*xo*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let u=-n;u<=n;u++){const f=Math.exp(-(u*u+s*s)/(2*t*t)),d=-u*f,h=(u*u/(t*t)-1)*f;d>0&&(r+=d),h>0?o+=h:a-=h}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const wn=`
${Ne}
${Ht}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,yn=`
${Ne}
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
${Ne}
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
`;function ze(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}const Eo={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,n=bo(t),r=wo(t);return{passes:[{name:"ycxczA",shader:wn,inputs:["srcA"],output:"ycxczA"},{name:"ycxczB",shader:wn,inputs:["srcB"],output:"ycxczB"},{name:"labA",shader:yn,inputs:["ycxczA"],output:"labA",uniforms:()=>[ze(1,[n.deltaX,n.r,n.sums[0],n.sums[1]]),ze(2,[n.sums[2],0,0,0])]},{name:"labB",shader:yn,inputs:["ycxczB"],output:"labB",uniforms:()=>[ze(1,[n.deltaX,n.r,n.sums[0],n.sums[1]]),ze(2,[n.sums[2],0,0,0])]},{name:"combine",shader:yo,inputs:["labA","labB","ycxczA","ycxczB"],output:"flip",uniforms:()=>[ze(4,[vo,r.sd,r.r,r.edgeNorm]),ze(5,[r.pointPos,r.pointNeg,0,0])]}],final:"flip"}}};let En=!1;function _o(){En||(En=!0,Oe(so),Oe(ao),Oe(io),Oe(lo),Oe(co),Oe(uo),Oe(Eo))}_o();const _n=new WeakMap;function Tt(e,t,n,r){let o=_n.get(e);o||(o=new Map,_n.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Mo(e){return`
${Ne}
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
`}const je="rgba16float";function To(e,t,n,r,o){var c,w;const a=Fe(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),u=Math.min(t.height,n.height),f=vn(a);if(a.kind==="pointwise"){const m=e.createTexture(s,u,je),v=Tt(e,`pw:${a.id}`,Mo(a.source),je);let p;try{p=e.createBindGroup(v,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(m,v,p)}finally{(c=p==null?void 0:p.destroy)==null||c.call(p)}return m}const d={width:s,height:u,params:f},h=a.buildPasses(d),x=new Map([["srcA",t],["srcB",n]]),b=[];try{for(const v of h.passes){const p=e.createTexture(s,u,je);b.push(p),x.set(v.output,p);const g=Tt(e,`mp:${a.id}:${v.name}`,v.shader,je),_=v.inputs.map((E,T)=>{const A=x.get(E);if(!A)throw new Error(`computeDiff: pass "${v.name}" input "${E}" not produced yet`);return{binding:T,resource:A}});v.uniforms&&_.push(...v.uniforms(d));let y;try{y=e.createBindGroup(g,_),e.renderFullscreen(p,g,y)}finally{(w=y==null?void 0:y.destroy)==null||w.call(y)}}const m=x.get(h.final);if(!m)throw new Error(`computeDiff: final ref "${h.final}" not produced`);for(const v of b)v!==m&&v.destroy();return m}catch(m){for(const v of b)v.destroy();throw m}}const So=8,Po=256*1024*1024;class Ao{constructor(t=So,n=Po){ee(this,"map",new Map);ee(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Mn=new WeakMap;function Co(e){let t=Mn.get(e);return t||(t=new Ao,Mn.set(e,t)),t}function ko(e,t){const n=vn(e);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Ro(e,t,n,r){const o=Fe(n),a=o?ko(o):"";return`${e}|${t}|${n}|${a}`}function Lo(e,t,n,r,o,a,s){const u=Fe(r);if(!u)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const f=Co(e),d=Ro(a,s,r),h=f.get(d);if(h)return h;const x=To(e,t,n,r),b=Math.min(t.width,n.width),c=Math.min(t.height,n.height),w={texture:x,width:b,height:c,displayRange:u.displayRange,bytes:b*c*8};return f.set(d,w),w}async function Do(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=en(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}const Io=`
${Ne}
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
`,Uo={unit:0,signed:1,relative:2},Bo={linear:0,signed:1,positive:2};function Oo(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Go(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function No(e,t,n,r,o){var x;const a=Go(t),s=Tt(e,"diff-display",Io,a),u=Oo(e,o.colormap),f=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([Uo[r],Bo[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]);let h;try{h=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:f}},{binding:3,resource:{uniform:d}}]),e.renderFullscreen(t,s,h)}finally{(x=h==null?void 0:h.destroy)==null||x.call(h),u.destroy()}}const Fo={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function zo({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:u,onViewportChange:f,processing:d=Fo,interpolation:h="auto",label:x="",isDraggable:b=!1,onDragStart:c,overlay:w,overlaySettings:m,pixelValueNotation:v="decimal"}){var xe,be;const p=l.useRef(null),[g,_]=l.useState(null),[y,E]=l.useState(null),[T,A]=l.useState(v),[P,I]=l.useState(!1),D=l.useRef(null),C=l.useRef(null),S=l.useRef(null),G=l.useRef(null),[H,V]=l.useState(0);l.useEffect(()=>{if(!e){S.current=null,V(k=>k+1);return}let K=!1;return Ie(e).then(k=>{K||(S.current=k,V(N=>N+1))}),()=>{K=!0}},[e]),l.useEffect(()=>{if(!t){G.current=null,V(k=>k+1);return}let K=!1;return Ie(t).then(k=>{K||(G.current=k,V(N=>N+1))}),()=>{K=!0}},[t]);const te=K=>(k,N,$)=>{const B=K.current;if(!B||k<0||N<0||k>=B.width||N>=B.height)return null;const W=(N*B.width+k)*4,Y=B.data[W],ie=B.data[W+1],ce=B.data[W+2],oe=(.299*Y+.587*ie+.114*ce)/255;return Y===ie&&ie===ce?{lines:[se(Y,"uint8",$)],luminance:oe}:{lines:[se(Y,"uint8",$),se(ie,"uint8",$),se(ce,"uint8",$)],luminance:oe,colors:[pe[0],pe[1],pe[2]]}},le=l.useMemo(()=>te(S),[]),ue=l.useMemo(()=>te(G),[]),_e=!!w&&!!(m!=null&&m.enabled)&&!!g&&!!e&&((((xe=w.boxes)==null?void 0:xe.length)??0)>0||(((be=w.masks)==null?void 0:be.length)??0)>0),{gammaFilterId:Me,filterStr:he,gamma:re,offset:Te}=sn(d),de=`translate(${u.x}px, ${u.y}px) scale(${s})`,J=h==="auto"?void 0:h,{containerProps:ge,modifierActive:me}=$t({containerRef:p,zoom:s,pan:u,onViewportChange:f});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(cn,{id:Me,gamma:re,offset:Te}),i.jsxs("div",{ref:p,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...ge.style},onPointerDown:ge.onPointerDown,onPointerMove:ge.onPointerMove,onPointerUp:ge.onPointerUp,onPointerCancel:ge.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:de,transformOrigin:"0 0"},children:[i.jsx("img",{ref:D,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:he,imageRendering:J,...n==="blend"?{opacity:o}:{}},onLoad:K=>{const k=K.currentTarget;_({w:k.naturalWidth,h:k.naturalHeight})}}),_e&&i.jsx(ft,{data:w,settings:m,naturalWidth:g.w,naturalHeight:g.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:de,transformOrigin:"0 0"},children:i.jsx("img",{ref:C,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:he,imageRendering:J,...n==="blend"?{opacity:1-o}:{}},onLoad:K=>{const k=K.currentTarget;E({w:k.naturalWidth,h:k.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:K=>{K.stopPropagation(),K.preventDefault();const N=K.currentTarget.parentElement.getBoundingClientRect(),$=W=>{a==null||a(Math.max(0,Math.min(1,(W.clientX-N.left)/N.width)))},B=()=>{window.removeEventListener("pointermove",$),window.removeEventListener("pointerup",B)};window.addEventListener("pointermove",$),window.addEventListener("pointerup",B)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Be,{imageElRef:C,naturalWidth:y.w,naturalHeight:y.h,zoom:s,pan:u,sample:ue,notation:T,version:H})}),e&&g&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Be,{imageElRef:D,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:u,sample:le,notation:T,version:H,onActiveChange:I})})]}):e&&g&&i.jsx(Be,{imageElRef:D,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:u,sample:le,notation:T,version:H,onActiveChange:I}),P&&i.jsx(Wt,{notation:T,onChange:A})]}),i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${b&&!me?" cairn-drag-grip":""}`,draggable:b&&!me,onDragStart:c,style:{cursor:b&&!me?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),x]})]})}function Vo(){return i.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function $o(e){const t=tt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Xo(e){const{data:t,width:n,height:r,channels:o}=e,a=n*r,s=new Float32Array(a*4),u=f=>Number.isFinite(f)?f:0;for(let f=0;f<a;f++){const d=f*o;let h,x,b,c=1;o===1?h=x=b=u(t[d]):o===3?(h=u(t[d]),x=u(t[d+1]),b=u(t[d+2])):(h=u(t[d]),x=u(t[d+1]),b=u(t[d+2]),c=u(t[d+3]));const w=f*4;s[w]=h,s[w+1]=x,s[w+2]=b,s[w+3]=c}return s}function Wo({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,diffSubmode:f,colormap:d="none",diffKernel:h,onDiffKernelChange:x,zoom:b,pan:c,onViewportChange:w,interpolation:m="auto",label:v="",pixelValueNotation:p="decimal"}){var j;const g=l.useRef(null),_=l.useRef(null),y=l.useRef(null),E=l.useRef(null),T=l.useRef(null),[A,P]=l.useState(!1),[I,D]=l.useState(!1),[C,S]=l.useState(null),[G,H]=l.useState(0),[V,te]=l.useState(0),[le,ue]=l.useState(null),[_e,Me]=l.useState({x:0,y:0,w:1,h:1}),he=h??f??"absolute",[re,Te]=l.useState(he);l.useEffect(()=>{Te(h??f??"absolute")},[h,f]);const de=l.useCallback(M=>{Te(M),x==null||x(M)},[x]);l.useEffect(()=>{const M=g.current;if(M)return M.__cairnDiffKernel={current:re,set:de},()=>{M&&delete M.__cairnDiffKernel}},[re,de]);const[J,ge]=l.useState(o);l.useEffect(()=>{ge(o)},[o]);const[me,xe]=l.useState(d);l.useEffect(()=>{xe(d)},[d]);const be=l.useMemo(()=>{const F=[{id:"compare-mode",title:"Compare / diff mode",menu:{options:[{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...oo().map(O=>({id:O.id,label:O.label}))],value:J==="diff"?re:J==="split"?"slide":"blend",onSelect:O=>{O==="slide"?ge("split"):O==="blend"?ge("blend"):(ge("diff"),de(O))}}}];return J==="diff"&&F.push(wt(me,O=>xe(O))),F},[J,re,me,de]),K=l.useRef(null),k=l.useRef(null),[N,$]=l.useState(0),B=dt();l.useEffect(()=>{const M=y.current;if(!M)return;let L=!1;return Xe().then(U=>{if(!L)try{if(tn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const F=U.createSurface(M,{hdr:!1});E.current={device:U,surface:F,texA:null,texB:null},D(!0)}catch(F){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",F),P(!0)}}).catch(U=>{L||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",U),P(!0))}),()=>{var F,O;L=!0;const U=E.current;U&&((F=U.texA)==null||F.destroy(),(O=U.texB)==null||O.destroy(),E.current=null)}},[]),l.useEffect(()=>{const M=g.current;if(!M)return;const L=new ResizeObserver(()=>te(U=>U+1));return L.observe(M),()=>L.disconnect()},[]),l.useEffect(()=>{if(!I)return;let M=!1;if(!E.current)return;async function U(F,O){if(O){const Q=Xo(O);return{width:O.width,height:O.height,imageData:null,make:X=>{const ae=X.createTexture(O.width,O.height,"rgba32float");return ae.write(Q),ae}}}if(!F)return null;const z=await Ie(F);return z?{width:z.width,height:z.height,imageData:z,make:Q=>{const X=Q.createTexture(z.width,z.height,"rgba8unorm");return X.write(z.data),X}}:null}return Promise.all([U(e,n),U(t,r)]).then(([F,O])=>{var X,ae;if(M||!E.current)return;const z=E.current;K.current=(F==null?void 0:F.imageData)??null,k.current=(O==null?void 0:O.imageData)??null,(X=z.texA)==null||X.destroy(),(ae=z.texB)==null||ae.destroy(),z.texA=null,z.texB=null;const Q=F??O;if(!Q){S(null),$(ye=>ye+1);return}z.texA=(O??Q).make(z.device),z.texB=(F??Q).make(z.device),S({w:Q.width,h:Q.height}),$(ye=>ye+1),H(ye=>ye+1)}),()=>{M=!0}},[I,e,t,n,r]);const W=l.useMemo(()=>{var L;return(((L=Fe(re))==null?void 0:L.displayRange)??"unit")==="signed"?"signed":"positive"},[re]),Y=l.useMemo(()=>me!=="none"?$o(me):void 0,[me]),ie=l.useCallback(()=>{const M=E.current;if(!I||!M||!M.surface||!M.texA||!M.texB||!C)return;const L=g.current,U=L?L.getBoundingClientRect():{width:C.w,height:C.h},F=gn({zoom:b,pan:c},U,C.w,C.h);Me(X=>X.x===F.x&&X.y===F.y&&X.w===F.w&&X.h===F.h?X:F);const O=y.current;if(U.width>0&&U.height>0&&O&&M.surface){const X=Math.max(1,Math.round(U.width*B)),ae=Math.max(1,Math.round(U.height*B));(O.width!==X||O.height!==ae)&&(O.width=X,O.height=ae,M.surface.configure(X,ae))}const z=mn(F,U,C.w,C.h)>=pt?"nearest":"linear",Q=F;try{if(J==="diff"){const X=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",ae=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ye=Fe(re),ke=Lo(M.device,M.texA,M.texB,ye?re:"absolute",void 0,X,ae);T.current=ke,No(M.device,M.surface,ke.texture,ke.displayRange,{uv:Q,cmapMode:W,colormap:Y,filter:z})}else{const X={exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Q,filter:z,mode:J,split:a,alpha:s};_r(M.device,M.surface,M.texA,M.texB,X)}}catch(X){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",X),P(!0)}},[I,C,b,c.x,c.y,J,a,s,re,W,Y,e,t,n,r,B]);l.useEffect(()=>{ie()},[ie,G,V]);const ce=t!=null||r!=null;l.useEffect(()=>{const M=E.current;if(!I||!M||!M.texA||!M.texB||!ce){ue(null);return}let L=!1;const U=M.texA,F=M.texB,O=T.current;return(J==="diff"&&O?Do(M.device,O,U,F):en(M.device,U,F)).then(Q=>{L||ue(Q)}),()=>{L=!0}},[I,G,ce,J,re]);const oe=M=>(L,U,F)=>{const O=M.current;if(!O||L<0||U<0||L>=O.width||U>=O.height)return null;const z=(U*O.width+L)*4,Q=O.data[z],X=O.data[z+1],ae=O.data[z+2],ye=(.299*Q+.587*X+.114*ae)/255;return Q===X&&X===ae?{lines:[se(Q,"uint8",F)],luminance:ye}:{lines:[se(Q,"uint8",F),se(X,"uint8",F),se(ae,"uint8",F)],luminance:ye,colors:[pe[0],pe[1],pe[2]]}},fe=l.useMemo(()=>oe(K),[]),we=l.useMemo(()=>oe(k),[]),R=m==="auto"?void 0:m;if(A)return n!=null||r!=null?i.jsx(Vo,{}):J==="diff"?i.jsx(yt,{imageUrl:e,baselineUrl:t,diffMode:((j=Fe(re))==null?void 0:j.kind)==="pointwise"?re:"absolute",interpolation:m,colormap:me,showAxes:!1,zoom:b,pan:c,onViewportChange:w,label:v,pixelValueNotation:p}):i.jsx(zo,{imageUrl:e,baselineUrl:t,mode:J,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,zoom:b,pan:c,onViewportChange:w,interpolation:m,label:v,pixelValueNotation:p});const Z=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:y,className:"w-full h-full block",style:{imageRendering:R},"data-gpu-compare-canvas":!0}),J==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:M=>{M.stopPropagation(),u==null||u(.5)},onPointerDown:M=>{M.stopPropagation(),M.preventDefault();const U=M.currentTarget.parentElement.getBoundingClientRect(),F=z=>{u==null||u(Math.max(0,Math.min(1,(z.clientX-U.left)/U.width)))},O=()=>{window.removeEventListener("pointermove",F),window.removeEventListener("pointerup",O)};window.addEventListener("pointermove",F),window.addEventListener("pointerup",O)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(Ke,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":I},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:g,wrapperRef:_,zoom:b,pan:c,onViewportChange:w,naturalDims:C,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Z,showAxes:!1,notationSeed:p,exportCanvasRef:y,requestRender:ie,leadingMenus:be,label:"",showLabelChip:!1,overlay:{render:({notation:M,setOverlayActive:L})=>J==="split"?i.jsxs(i.Fragment,{children:[ce&&C&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:i.jsx(Be,{imageElRef:y,naturalWidth:C.w,naturalHeight:C.h,zoom:b,pan:c,sourceWindow:_e,sample:we,notation:M,version:N})}),ce&&C&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:i.jsx(Be,{imageElRef:y,naturalWidth:C.w,naturalHeight:C.h,zoom:b,pan:c,sourceWindow:_e,sample:fe,notation:M,version:N,onActiveChange:L})})]}):C&&i.jsx(Be,{imageElRef:y,naturalWidth:C.w,naturalHeight:C.h,zoom:b,pan:c,sourceWindow:_e,sample:fe,notation:M,version:N,onActiveChange:L})},extraChips:i.jsxs(i.Fragment,{children:[i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),v?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:v}):null,le&&i.jsxs("span",{className:"absolute right-1.5 top-9 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono","data-gpu-compare-metrics":!0,children:["MSE ",le.mse.toExponential(2)," · PSNR ",Number.isFinite(le.psnr)?le.psnr.toFixed(1):"∞"," dB · MAE"," ",le.mae.toExponential(2)]})]})})}const Yo="cairn-plot:gpu-image-ready";async function Ho(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Xe(),window.__cairnPlotGpuImagePane=ro,window.__cairnPlotGpuComparePane=Wo,window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Yo))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}Ho()})(__cairnPlotJsxRuntime,__cairnPlotReact);
