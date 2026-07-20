var ws=Object.defineProperty;var ys=(u,d,Be)=>d in u?ws(u,d,{enumerable:!0,configurable:!0,writable:!0,value:Be}):u[d]=Be;var ee=(u,d,Be)=>ys(u,typeof d!="symbol"?d+"":d,Be);(function(u,d){"use strict";const Be=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function kt(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Be}),{hdr:!1,format:n}}function Nn(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Be}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Be}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return kt(e,t)}}}const Fn=`
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
`;function nt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Dt(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function zn(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Vn={texture:0,sampler:1,uniform:2};function rt(e,t){return e*3+Vn[t]}const $n={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Xn(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),s=r[2]!==void 0,a=r[3].trim();if(s){const i=$n[a];if(i===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${a}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:i})}else a==="sampler"||a==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class It{constructor(t,n,r,o){ee(this,"width");ee(this,"height");ee(this,"format");ee(this,"gpuTexture");ee(this,"device");ee(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:nt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Dt(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Bt{constructor(t){ee(this,"_s");ee(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Wn{constructor(t,n,r,o,s){ee(this,"_p");ee(this,"gpuPipeline");ee(this,"bindings");ee(this,"bindGroupLayout");ee(this,"variants");ee(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=s,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Yn(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Hn{constructor(t){ee(this,"_c");ee(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Kn{constructor(t,n){ee(this,"_b");ee(this,"gpuBindGroup");ee(this,"ownedBuffers");ee(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class qn{constructor(t,n,r,o){ee(this,"canvas");ee(this,"hdr");ee(this,"format");ee(this,"context");ee(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function Xe(e){return"canvas"in e}async function Zn(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function s(c){return Xe(c)?c.getCurrentTextureView():c.gpuTexture.createView()}function a(c){if(Xe(c))return{width:c.canvas.width,height:c.canvas.height};const w=c;return{width:w.width,height:w.height}}let i=!1;const f=256;let l=null,h=null;function x(){if(!l||!h){const c=t.createShaderModule({code:Fn});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const w=t.createPipelineLayout({bindGroupLayouts:[h]});l=t.createComputePipeline({layout:w,compute:{module:c,entryPoint:"cs_main"}})}return{pipeline:l,layout:h}}return{backend:"webgpu",capabilities:n,createTexture(c,w,g){return new It(t,c,w,g)},createSampler(c){const w=(c==null?void 0:c.filter)==="linear"?"linear":"nearest",g=t.createSampler({magFilter:w,minFilter:w,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Bt(g)},createRenderPipeline(c){const w=t.createShaderModule({code:c.shaderWGSL}),g=Xn(c.shaderWGSL),v=nt(c.targetFormat),p=Yn(t,g),m=t.createPipelineLayout({bindGroupLayouts:[p]}),_=E=>t.createRenderPipeline({layout:m,vertex:{module:w,entryPoint:"vs_main"},fragment:{module:w,entryPoint:"fs_main",targets:[{format:E}]},primitive:{topology:"triangle-list"}}),y=_(v);return new Wn(y,g,p,v,_)},createComputePipeline(c){const w=t.createShaderModule({code:c.shaderWGSL}),g=t.createComputePipeline({layout:"auto",compute:{module:w,entryPoint:"cs_main"}});return new Hn(g)},createBindGroup(c,w){const g=c,v=new Map,p=[];for(const[_,y]of g.bindings)if(y.kind==="uniform"){const E=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});p.push(E),v.set(_,{binding:_,resource:{buffer:E}})}else y.kind==="sampler"&&v.set(_,{binding:_,resource:o()});for(const _ of w){const y=_.resource;if(y instanceof It){const E=rt(_.binding,"texture");g.bindings.has(E)&&v.set(E,{binding:E,resource:y.gpuTexture.createView()})}else if(y instanceof Bt){const E=rt(_.binding,"sampler");g.bindings.has(E)&&v.set(E,{binding:E,resource:y.gpuSampler})}else{const E=rt(_.binding,"uniform"),M=g.bindings.get(E);if(M&&M.kind==="uniform"){const A=y.uniform,S=t.createBuffer({size:Math.max(M.sizeBytes,A.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(S,0,A.buffer,A.byteOffset,A.byteLength),p.push(S),v.set(E,{binding:E,resource:{buffer:S}})}}}const m=t.createBindGroup({layout:g.bindGroupLayout,entries:Array.from(v.values())});return new Kn(m,p)},createSurface(c,w){const g=c.getContext("webgpu");if(!g)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const v=w.hdr&&n.hdr,p=()=>v?Nn(g,t):kt(g,t),m=p();return new qn(c,g,m,p)},renderFullscreen(c,w,g){const v=w,p=g,m=s(c),{width:_,height:y}=a(c),E=Xe(c)?c.format:nt(c.format),M=v.pipelineFor(E),A=t.createCommandEncoder(),S=A.beginRenderPass({colorAttachments:[{view:m,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});S.setPipeline(M),S.setBindGroup(0,p.gpuBindGroup),S.setViewport(0,0,_,y,0,1),S.draw(3),S.end(),t.queue.submit([A.finish()])},async readback(c){const w=Xe(c),{width:g,height:v}=a(c),p=w?c.hdr?"rgba16float":"rgba8unorm":c.format,m=w&&c.format==="bgra8unorm",_=w?c.getCurrentGPUTexture():c.gpuTexture,y=Dt(p),E=g*y,M=256,A=Math.ceil(E/M)*M,S=A*v,I=t.createBuffer({size:S,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),D=t.createCommandEncoder();D.copyTextureToBuffer({texture:_},{buffer:I,bytesPerRow:A,rowsPerImage:v},{width:g,height:v,depthOrArrayLayers:1}),t.queue.submit([D.finish()]),await I.mapAsync(GPUMapMode.READ);const C=new Uint8Array(I.getMappedRange()),P=new Uint8Array(E*v);for(let U=0;U<v;U++){const X=U*A,z=U*E;P.set(C.subarray(X,X+E),z)}if(I.unmap(),I.destroy(),p==="rgba8unorm"){if(m)for(let U=0;U<P.length;U+=4){const X=P[U],z=P[U+2];P[U]=z,P[U+2]=X}return P}if(p==="rgba16float"){const U=new Uint16Array(P.buffer,P.byteOffset,P.byteLength/2),X=new Float32Array(U.length);for(let z=0;z<U.length;z++)X[z]=zn(U[z]);return X}return new Float32Array(P.buffer,P.byteOffset,P.byteLength/4)},async reduceDiffSumSquaredAbs(c,w,g,v){const p=c,m=w,_=Math.max(0,g*v),y=Math.max(1,Math.ceil(_/f)),{pipeline:E,layout:M}=x(),A=y*2*4,S=t.createBuffer({size:A,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),I=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(I,0,new Uint32Array([Math.max(1,g),Math.max(1,v),_,0]));const D=t.createBindGroup({layout:M,entries:[{binding:0,resource:p.gpuTexture.createView()},{binding:1,resource:m.gpuTexture.createView()},{binding:2,resource:{buffer:S}},{binding:3,resource:{buffer:I}}]}),C=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),P=t.createCommandEncoder(),U=P.beginComputePass();U.setPipeline(E),U.setBindGroup(0,D),U.dispatchWorkgroups(y),U.end(),P.copyBufferToBuffer(S,0,C,0,A),t.queue.submit([P.finish()]),await C.mapAsync(GPUMapMode.READ);const z=new Float32Array(C.getMappedRange()).slice();C.unmap(),C.destroy(),S.destroy(),I.destroy();let te=0,ue=0;for(let he=0;he<y;he++)te+=z[he*2],ue+=z[he*2+1];return{sumSq:te,sumAbs:ue}},destroy(){i||(t.destroy(),i=!0)},isContextLost(){return!1}}}let ot=null;async function jn(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Zn()}function We(){return ot||(ot=jn()),ot}function Qn(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Jn(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),s=Math.floor(o),a=Math.min(s+1,e.length-1),i=o-s,[f,l,h]=Qn(e[s],e[a],i);t[n*3]=Math.round(f),t[n*3+1]=Math.round(l),t[n*3+2]=Math.round(h)}return t}const Ut={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Ot=new Set(["red-green","red-blue"]),Gt=new Map;function st(e){let t=Gt.get(e);if(!t){const n=Ut[e]??Ut.viridis;t=Jn(n),Gt.set(e,t)}return t}function at(e,t,n="linear"){const r=st(t),o=new ImageData(e.width,e.height),s=e.data,a=o.data;for(let i=0;i<s.length;i+=4){const f=(s[i]+s[i+1]+s[i+2])/3;let l;n==="positive"?l=Math.round(128+f/255*127):l=Math.round(f),l=Math.max(0,Math.min(255,l)),a[i]=r[l*3],a[i+1]=r[l*3+1],a[i+2]=r[l*3+2],a[i+3]=s[i+3]}return o}function Nt(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Ft=Nt(50);function it(e){return Ft.get(e)}function ct(e,t){Ft.set(e,t)}const zt=Nt(100);function er(e){return zt.get(e)}function tr(e,t){zt.set(e,t)}function nr(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),s=new ImageData(r,o);for(let a=0;a<o;a++)for(let i=0;i<r;i++){const f=(a*e.width+i)*4,l=(a*t.width+i)*4,h=(a*r+i)*4;for(let x=0;x<3;x++){const b=e.data[f+x],c=t.data[l+x],w=b-c,g=Math.abs(w),v=Math.max(b,1);let p;switch(n){case"signed":p=(w+255)/2;break;case"absolute":p=g;break;case"squared":p=w*w/255;break;case"relative_signed":p=(w/v+1)*127.5;break;case"relative_absolute":p=g/v*255;break;case"relative_squared":p=w*w/(v*v)*255;break}s.data[h+x]=Math.min(255,Math.max(0,Math.round(p)))}s.data[h+3]=255}return s}async function Ne(e){const t=er(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const s=o.getContext("2d");if(!s){n(null);return}s.drawImage(r,0,0);const a=s.getImageData(0,0,o.width,o.height);tr(e,a),n(a)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const rr={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},or={linear:0,signed:1,positive:2},sr=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,ar=`#version 300 es
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
}`;let Fe=null,W=null,Me=null,Ye=null;function ir(){if(W)return W;try{if(typeof OffscreenCanvas<"u"?Fe=new OffscreenCanvas(1,1):Fe=document.createElement("canvas"),W=Fe.getContext("webgl2",{preserveDrawingBuffer:!0}),!W)return console.warn("[cairn] WebGL 2 not available"),null;const e=W.createShader(W.VERTEX_SHADER);if(W.shaderSource(e,sr),W.compileShader(e),!W.getShaderParameter(e,W.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",W.getShaderInfoLog(e)),null;const t=W.createShader(W.FRAGMENT_SHADER);if(W.shaderSource(t,ar),W.compileShader(t),!W.getShaderParameter(t,W.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",W.getShaderInfoLog(t)),null;if(Me=W.createProgram(),W.attachShader(Me,e),W.attachShader(Me,t),W.linkProgram(Me),!W.getProgramParameter(Me,W.LINK_STATUS))return console.error("[cairn] WebGL program link:",W.getProgramInfoLog(Me)),null;Ye=W.createVertexArray(),W.bindVertexArray(Ye);const n=W.createBuffer();W.bindBuffer(W.ARRAY_BUFFER,n),W.bufferData(W.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),W.STATIC_DRAW);const r=W.getAttribLocation(Me,"a_pos");return W.enableVertexAttribArray(r),W.vertexAttribPointer(r,2,W.FLOAT,!1,0,0),W.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),W}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Vt(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function cr(e,t,n){const r=new Uint8Array(1024);for(let s=0;s<256;s++)r[s*4]=t[s*3],r[s*4+1]=t[s*3+1],r[s*4+2]=t[s*3+2],r[s*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function lr(e,t,n,r){const o=ir();if(!o||!Me||!Ye||!Fe)return null;const s=Math.min(e.width,t.width),a=Math.min(e.height,t.height);Fe.width=s,Fe.height=a,o.viewport(0,0,s,a);const i=Vt(o,e,0),f=Vt(o,t,1);let l=null;n.colormap?l=cr(o,n.colormap,2):(l=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,l),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Me),o.uniform1i(o.getUniformLocation(Me,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Me,"u_other"),1),o.uniform1i(o.getUniformLocation(Me,"u_lut"),2),o.uniform1i(o.getUniformLocation(Me,"u_diff_mode"),rr[n.diffMode]),o.uniform1i(o.getUniformLocation(Me,"u_cmap_mode"),or[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Me,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Ye),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=s,r.height=a;const h=r.getContext("2d");return h&&(h.save(),h.scale(1,-1),h.drawImage(Fe,0,0,s,a,0,-a,s,a),h.restore()),o.deleteTexture(i),o.deleteTexture(f),o.deleteTexture(l),{width:s,height:a}}const ur="cairn:render-mode";function dr(){try{const e=localStorage.getItem(ur);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Re=e=>e<0?0:e>1?1:e,lt=e=>{const t=e<0?0:e;return t/(1+t)},ut=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Re(n/r)},$t={linear:([e,t,n])=>[Re(e),Re(t),Re(n)],srgb:([e,t,n])=>[Re(e),Re(t),Re(n)],reinhard:([e,t,n])=>[lt(e),lt(t),lt(n)],aces:([e,t,n])=>[ut(e),ut(t),ut(n)],extended:([e,t,n])=>[e,t,n]},fr="srgb";function pr(e){return e&&$t[e]||$t[fr]}function dt(e,t){return e*2**t}function hr(e){const t=Re(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function ft(e,t){return typeof t=="number"&&t>0?Re(Math.pow(Re(e),1/t)):hr(e)}const Ce=new Uint32Array(512),Le=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ce[e]=0,Ce[e|256]=32768,Le[e]=24,Le[e|256]=24):t<-14?(Ce[e]=1024>>-t-14,Ce[e|256]=1024>>-t-14|32768,Le[e]=-t-1,Le[e|256]=-t-1):t<=15?(Ce[e]=t+15<<10,Ce[e|256]=t+15<<10|32768,Le[e]=13,Le[e|256]=13):t<128?(Ce[e]=31744,Ce[e|256]=64512,Le[e]=24,Le[e|256]=24):(Ce[e]=31744,Ce[e|256]=64512,Le[e]=13,Le[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var $e=Uint8Array,Xt=Uint16Array,gr=Int32Array,mr=new $e([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),xr=new $e([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Wt=function(e,t){for(var n=new Xt(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new gr(n[30]),r=1;r<30;++r)for(var s=n[r];s<n[r+1];++s)o[s]=s-n[r]<<5|r;return{b:n,r:o}},Yt=Wt(mr,2),vr=Yt.b,br=Yt.r;vr[28]=258,br[258]=28,Wt(xr,0);for(var wr=new Xt(32768),ne=0;ne<32768;++ne){var Ue=(ne&43690)>>1|(ne&21845)<<1;Ue=(Ue&52428)>>2|(Ue&13107)<<2,Ue=(Ue&61680)>>4|(Ue&3855)<<4,wr[ne]=((Ue&65280)>>8|(Ue&255)<<8)>>1}for(var He=new $e(288),ne=0;ne<144;++ne)He[ne]=8;for(var ne=144;ne<256;++ne)He[ne]=9;for(var ne=256;ne<280;++ne)He[ne]=7;for(var ne=280;ne<288;++ne)He[ne]=8;for(var yr=new $e(32),ne=0;ne<32;++ne)yr[ne]=5;var Er=new $e(0),_r=typeof TextDecoder<"u"&&new TextDecoder,Mr=0;try{_r.decode(Er,{stream:!0}),Mr=1}catch{}const Ht=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function pt(e){const t=Ht.length;return Ht[(e%t+t)%t]}function Tr(e){const n=d.useRef(null),[r,o]=d.useState({w:0,h:0}),s=d.useRef(null),a=d.useRef(null),i=d.useRef(null),f=d.useCallback((l,h)=>{o(x=>x.w===l&&x.h===h?x:{w:l,h})},[]);return d.useLayoutEffect(()=>{const l=n.current;if(!l||l===i.current)return;const h=l.getBoundingClientRect();(h.width>0||h.height>0)&&(i.current=l,f(h.width,h.height))}),d.useEffect(()=>{var x;const l=n.current;if(l===a.current||((x=s.current)==null||x.disconnect(),s.current=null,a.current=l,!l))return;const h=new ResizeObserver(b=>{for(const c of b)f(c.contentRect.width,c.contentRect.height)});s.current=h,h.observe(l)}),d.useEffect(()=>()=>{var l;return(l=s.current)==null?void 0:l.disconnect()},[]),{ref:n,size:r}}function Pr(){const[e,t]=d.useState(!1);return d.useEffect(()=>{const n=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!0)},r=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Sr=.25,ht=64;function Kt(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return ht;const o=Math.min(n/e,r/t);return o<=0?ht:Math.max(Math.max(n,r)/o,8)}function qt(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:s=Sr,maxZoom:a=ht,naturalWidth:i,naturalHeight:f}=e,l=Pr(),h=d.useRef(l);h.current=l;const x=d.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const b=d.useRef(o);b.current=o,d.useEffect(()=>{const m=t.current;if(!m||!o)return;const _=y=>{var X;if(!h.current)return;y.preventDefault(),y.stopPropagation();const E=y.deltaY<0?1.1:1/1.1,M=x.current,A=m.getBoundingClientRect(),S=i&&f?Kt(i,f,A.width,A.height):a,I=Math.max(s,Math.min(S,M.zoom*E));if(M.zoom===I)return;const D=y.clientX-A.left,C=y.clientY-A.top,P=D-(D-M.pan.x)/M.zoom*I,U=C-(C-M.pan.y)/M.zoom*I;(X=b.current)==null||X.call(b,{zoom:I,pan:{x:P,y:U}})};return m.addEventListener("wheel",_,{passive:!1}),()=>m.removeEventListener("wheel",_)},[t,!!o,s,a,i,f]);const c=d.useRef(null),w=d.useCallback(m=>{!h.current||!b.current||(m.currentTarget.setPointerCapture(m.pointerId),c.current={pointerId:m.pointerId,startX:m.clientX,startY:m.clientY,panX:x.current.pan.x,panY:x.current.pan.y})},[]),g=d.useCallback(m=>{var M;const _=c.current;if(!_||_.pointerId!==m.pointerId)return;const y=m.clientX-_.startX,E=m.clientY-_.startY;(M=b.current)==null||M.call(b,{zoom:x.current.zoom,pan:{x:_.panX+y,y:_.panY+E}})},[]),v=d.useCallback(m=>{const _=c.current;if(!(!_||_.pointerId!==m.pointerId)){try{m.currentTarget.releasePointerCapture(m.pointerId)}catch{}c.current=null}},[]),p=l&&!!o;return{containerProps:{onPointerDown:w,onPointerMove:g,onPointerUp:v,onPointerCancel:v,style:{cursor:p?"move":void 0,touchAction:p?"none":void 0}},modifierActive:l}}function gt(){const[e,t]=d.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return d.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),s())};function s(){if(n)return;const a=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${a}dppx)`),r.addEventListener("change",o,{once:!0})}return s(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Ar(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Zt(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function mt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:s}=Tr(),a=d.useRef(null),i=d.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),f=d.useMemo(()=>{const g=s.w,v=s.h;if(g<=0||v<=0||n<=0||r<=0)return null;const p=Math.min(g/n,v/r),m=n*p,_=r*p;return{left:(g-m)/2,top:(v-_)/2,width:m,height:_}},[s.w,s.h,n,r]),l=e.masks,h=t.showMasks&&!!l&&l.length>0,x=d.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(d.useEffect(()=>{if(!h||!l)return;const g=a.current;if(!g)return;(g.width!==n||g.height!==r)&&(g.width=n,g.height=r);const v=g.getContext("2d");if(!v)return;v.clearRect(0,0,g.width,g.height);let p=!1;const m=v.createImageData(n,r),_=m.data;let y=l.length,E=!1;const M=()=>{p||E&&v.putImageData(m,0,0)},A=document.createElement("canvas");A.width=n,A.height=r;const S=A.getContext("2d",{willReadFrequently:!0});for(const I of l){const D=new Image;D.onload=()=>{if(!p){if(S){S.clearRect(0,0,n,r),S.drawImage(D,0,0,n,r);const C=S.getImageData(0,0,n,r).data;for(let P=0;P<n*r;P++){const U=C[P*4];if(U===0||i.has(U))continue;const[X,z,te]=Ar(pt(U));_[P*4]=X,_[P*4+1]=z,_[P*4+2]=te,_[P*4+3]=255,E=!0}}y-=1,y===0&&M()}},D.onerror=()=>{y-=1,y===0&&M()},D.src=`data:image/png;base64,${I.png_b64}`}return()=>{p=!0}},[h,l,n,r,x]),!f)return u.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const b=e.boxes??[],c=t.showBoxes&&b.length>0,w=e.class_labels??{};return u.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[h&&u.jsx("canvas",{ref:a,className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),c&&u.jsx("svg",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:b.map((g,v)=>{if(!Zt(g,t,i))return null;const p=g.domain==="pixel"?1:n,m=g.domain==="pixel"?1:r,_=g.position.minX*p,y=g.position.minY*m,E=(g.position.maxX-g.position.minX)*p,M=(g.position.maxY-g.position.minY)*m;return u.jsx("rect",{x:_,y,width:E,height:M,fill:"none",stroke:pt(g.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},v)})}),c&&u.jsx("div",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height},children:b.map((g,v)=>{if(!Zt(g,t,i))return null;const p=g.domain==="pixel"?1/n:1,m=g.domain==="pixel"?1/r:1,_=g.position.minX*p*100,y=g.position.minY*m*100,E=g.label??w[String(g.class_id)]??`#${g.class_id}`,M=g.score!=null?` ${(g.score*100).toFixed(0)}%`:"";return!E&&!M?null:u.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${_}%`,top:`${y}%`,transform:"translateY(-100%)",backgroundColor:pt(g.class_id)},children:u.jsxs("span",{className:"mono",children:[E,M]})},v)})})]})}const xt=30,xe=["#ff5a5a","#39d353","#5b9bff"];function vt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function ce(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):vt(e/255):vt(n==="int"?e*255:e)}const Rr={x:0,y:0,w:1,h:1};function ze({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:s,notation:a="decimal",version:i=0,onActiveChange:f,sourceWindow:l=Rr}){const h=d.useRef(null),x=d.useRef(!1),b=gt(),c=d.useRef(f);c.current=f;const w=d.useCallback(v=>{var p;v!==x.current&&(x.current=v,(p=c.current)==null||p.call(c,v))},[]),g=d.useCallback(()=>{var we;const v=h.current,p=e.current;if(!v)return;const m=window.devicePixelRatio||1,_=v.clientWidth,y=v.clientHeight;if(_===0||y===0)return;v.width!==Math.round(_*m)&&(v.width=Math.round(_*m)),v.height!==Math.round(y*m)&&(v.height=Math.round(y*m));const E=v.getContext("2d");if(!E)return;if(E.setTransform(m,0,0,m,0,0),E.clearRect(0,0,_,y),!p||t<=0||n<=0){w(!1);return}const M=p.getBoundingClientRect(),A=v.getBoundingClientRect();if(M.width===0||M.height===0){w(!1);return}const S=l.x*t,I=l.y*n,D=l.w*t,C=l.h*n;if(D<=0||C<=0){w(!1);return}const P=Math.min(M.width/D,M.height/C);if(P<xt){w(!1);return}const U=D*P,X=C*P,z=M.left+(M.width-U)/2-A.left,te=M.top+(M.height-X)/2-A.top,ue=Math.max(Math.floor(S),Math.floor(S+(0-z)/P)),he=Math.min(Math.ceil(S+D),Math.ceil(S+(_-z)/P)),Te=Math.max(Math.floor(I),Math.floor(I+(0-te)/P)),Pe=Math.min(Math.ceil(I+C),Math.ceil(I+(y-te)/P));if(he<=ue||Pe<=Te){w(!1);return}w(!0);const ve=z+(0-S)*P,de=te+(0-I)*P,Se=z+(t-S)*P,ge=te+(n-I)*P;E.save(),E.beginPath(),E.rect(ve,de,Se-ve,ge-de),E.clip(),E.textAlign="center",E.textBaseline="middle",E.lineJoin="round";const Q=P*.14,be=P-Q*2;for(let Ee=Te;Ee<Pe;Ee++)for(let _e=ue;_e<he;_e++){if(_e<0||Ee<0||_e>=t||Ee>=n)continue;const Z=s(_e,Ee,a);if(!Z||Z.lines.length===0)continue;const L=Z.lines.length;let O=1;for(const k of Z.lines)k.length>O&&(O=k.length);const V=be/(L*1.15),B=be/(O*.62)||V,$=Math.min(V,B,24);if($<6)continue;const N=z+(_e-S+.5)*P,re=te+(Ee-I+.5)*P,fe=$*1.15,oe=Z.luminance<=.55,pe=oe?"#ffffff":"#000000";E.font=`${$}px ui-monospace, SFMono-Regular, Menlo, monospace`,E.lineWidth=Math.max(1.4,$*.16),E.strokeStyle=oe?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let me=re-L*fe/2+fe/2;for(let k=0;k<Z.lines.length;k++){const q=Z.lines[k];E.strokeText(q,N,me),E.fillStyle=((we=Z.colors)==null?void 0:we[k])??pe,E.fillText(q,N,me),me+=fe}}E.restore()},[e,t,n,s,a,w,l]);return d.useEffect(()=>{g()},[g,r,o.x,o.y,i,a,l,b]),d.useEffect(()=>{const v=h.current;if(!v)return;const p=new ResizeObserver(()=>g());return p.observe(v),()=>p.disconnect()},[g]),u.jsx("canvas",{ref:h,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function jt({notation:e,onChange:t,className:n=""}){return u.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Cr=`
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
`,De=`
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
`,Qt=`
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
`,Lr=`
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
`,Ke=`
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
`;function Jt(e){return`
${De}
${Qt}
${Lr}

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
`}const kr=Jt("select(colorB, colorA, uv.x < split)"),Dr=Jt("mix(colorA, colorB, alpha)"),bt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},en=new WeakMap;function Ir(e,t){let n=en.get(e);n||(n=new Map,en.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Cr,targetFormat:t}),n.set(t,r)),r}function tn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function nn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Br(e,t,n,r){var w;const o=tn(t),s=Ir(e,o),a=nn(e,r.isScalar?r.colormap:void 0),i=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,f=bt[r.operator]??bt.srgb,l=new Float32Array([r.exposureEV,f,i,r.isScalar?1:0]),h=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),b=new Float32Array([r.filter==="nearest"?0:1]);let c;try{c=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:a},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,s,c)}finally{(w=c==null?void 0:c.destroy)==null||w.call(c),a.destroy()}}const rn=new WeakMap;function Ur(e,t,n){let r=rn.get(e);r||(r=new Map,rn.set(e,r));const o=`${t}:${n}`;let s=r.get(o);return s||(s=e.createRenderPipeline({shaderWGSL:t==="split"?kr:Dr,targetFormat:n}),r.set(o,s)),s}function Or(e,t,n,r,o){var w;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const s=tn(t),a=Ur(e,o.mode,s),i=nn(e,void 0),f=o.gamma,l=bt[o.operator],h=new Float32Array([o.exposureEV,l,f,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),b=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]);let c;try{c=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:i},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,a,c)}finally{(w=c==null?void 0:c.destroy)==null||w.call(c),i.destroy()}}function on(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,s=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:s,mae:o}}async function sn(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),s=r*o*3;if(s<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:b,sumAbs:c}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return on(b,c,s)}const a=await e.readback(t),i=await e.readback(n),f=a instanceof Uint8Array,l=i instanceof Uint8Array;let h=0,x=0;for(let b=0;b<o;b++)for(let c=0;c<r;c++){const w=(b*t.width+c)*4,g=(b*n.width+c)*4;for(let v=0;v<3;v++){const p=(a[w+v]??0)/(f?255:1),m=(i[g+v]??0)/(l?255:1),_=p-m;h+=_*_,x+=Math.abs(_)}}return on(h,x,s)}function an(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Gr=12,Oe=[];function cn(e){const t=Oe.indexOf(e);t!==-1&&Oe.splice(t,1),Oe.push(e)}function Nr(e){const t=Oe.indexOf(e);t!==-1&&Oe.splice(t,1)}function qe(e){e.parked||(Nr(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function ln(e){for(;Oe.length>Gr;){const t=Oe.find(n=>n!==e&&!n.visible)??Oe.find(n=>n!==e);if(!t)break;qe(t)}}function un(e){var o,s;if(e.disposed)return;if(an())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){cn(e),ln(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const a=t.createTexture(e.source.width,e.source.height,e.source.format);a.write(e.source.data),e.srcTexture=a}e.parked=!1,cn(e),ln(e)}function Fr(e,t){if(e.disposed||!e.source)return!0;try{return un(e),!e.surface||!e.srcTexture?!1:(Br(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,qe(e),!1}}function zr(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Fr(e,t)},park(){e.disposed||qe(e)},restore(){e.disposed||!e.source||un(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(qe(e),e.source=null,e.disposed=!0)}}}async function Vr(e,t){const n=await We(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return zr(r)}function dn(e){e.dispose()}function $r(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:s}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...s?["invert(1)"]:[]].join(" ")}function fn(e){const n=`cairn-gamma-${d.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:s,exposure:a,offset:i,flipSign:f}=e,l=d.useMemo(()=>$r(e,n),[n,r,o,a,f]);return{gammaFilterId:n,filterStr:l,gamma:s,offset:i}}function pn({id:e,gamma:t,offset:n}){return u.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:u.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:u.jsxs("feComponentTransfer",{children:[u.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),u.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),u.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function hn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Xr({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=hn(e),s=hn(t),a=[];for(let m=0;m<=e;m+=o)a.push(m);const i=[];for(let m=0;m<=t;m+=s)i.push(m);const f=1/n,l=8*f,h=-12*f,x=-2*f,b=r==null?void 0:r.current;let c=0,w=0,g=0,v=0;if(b){const m=b.clientWidth,_=b.clientHeight,y=m/e,E=_/t,M=Math.min(y,E);g=e*M,v=t*M,c=(m-g)/2,w=(_-v)/2}const p=b&&g>0;return u.jsxs(u.Fragment,{children:[u.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:p?w:0,transform:`translateY(${h}px)`,fontSize:l},children:a.map(m=>u.jsx("span",{className:"mono",style:{position:"absolute",left:p?c+m/e*g:`${m/e*100}%`,transform:"translateX(-50%)"},children:m},m))}),u.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:p?c:0,transform:`translateX(${x}px)`,fontSize:l},children:i.map(m=>u.jsx("span",{className:"mono",style:{position:"absolute",top:p?w+m/t*v:`${m/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*f}px`},children:m},m))})]})}function Wr({label:e,isDraggable:t,onDragStart:n}){return u.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&u.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Yr=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function gn(e,t){const n=getComputedStyle(e),r=Yr.map(f=>`${f}:${n.getPropertyValue(f)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const s=e.children,a=t.children,i=Math.min(s.length,a.length);for(let f=0;f<i;f++)gn(s[f],a[f])}function wt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function yt(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Et(e,t,n,r,o){const s=document.createElement("canvas");s.width=Math.max(1,Math.round(e*n)),s.height=Math.max(1,Math.round(t*n));const a=s.getContext("2d");if(!a)throw new Error("plot-to-png: 2D canvas context unavailable");return a.scale(n,n),r&&(a.fillStyle=r,a.fillRect(0,0,e,t)),o(a),await new Promise((i,f)=>s.toBlob(l=>l?i(l):f(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Hr(e,t,n){const r=e.cloneNode(!0);gn(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),s="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((a,i)=>{const f=new Image;f.onload=()=>a(f),f.onerror=()=>i(new Error("plot-to-png: SVG rasterization failed")),f.src=s})}async function mn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,s=(t==null?void 0:t.background)??wt(e);return Et(r,o,yt(t),s,a=>a.drawImage(e,0,0,r,o))}async function Kr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,s=(t==null?void 0:t.background)??wt(e);try{return await Et(r,o,yt(t),s,a=>a.drawImage(e,0,0,r,o))}catch(a){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${a instanceof Error?a.message:String(a)})`)}}function qr(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const s=o.getBoundingClientRect(),a=s.width*s.height;a>r&&(r=a,n=o)}return n}async function Zr(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),s=o.width||300,a=o.height||150,i=(t==null?void 0:t.background)??wt(e);if(n){const l=n.getBoundingClientRect(),h=await Hr(n,l.width||s,l.height||a);return Et(s,a,yt(t),i,x=>{for(const b of r){const c=b.getBoundingClientRect();x.drawImage(b,c.left-o.left,c.top-o.top,c.width,c.height)}x.drawImage(h,l.left-o.left,l.top-o.top,l.width,l.height)})}if(r.length)return mn(r[0],t);const f=qr(e);if(f)return Kr(f,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function jr(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Qr={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Jr={boxZoom:u.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:u.jsxs(u.Fragment,{children:[u.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),u.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),u.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),u.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M12 2v20M2 12h20"}),u.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),u.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:u.jsxs(u.Fragment,{children:[u.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),u.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:u.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:u.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:u.jsxs(u.Fragment,{children:[u.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),u.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:u.jsx("path",{d:"M6 9l6 6 6-6"})};function _t({name:e}){return u.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Jr[e]??null})}function ke({icon:e,label:t,title:n,active:r,disabled:o,onClick:s}){return u.jsx("button",{type:"button",disabled:o,onClick:a=>{a.stopPropagation(),!o&&s()},onPointerDown:a=>a.stopPropagation(),onDoubleClick:a=>a.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?u.jsx("span",{"aria-hidden":"true",children:t}):u.jsx(_t,{name:e??""})})}function Ze(){return u.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function eo({icon:e,title:t,menu:n}){var v;const{options:r,value:o,onSelect:s}=n,[a,i]=d.useState(!1),[f,l]=d.useState(0),h=d.useRef(null),x=Math.max(0,r.findIndex(p=>p.id===o)),b=e?void 0:((v=r[x])==null?void 0:v.label)??"",c=d.useCallback(()=>{i(p=>{const m=!p;return m&&l(x),m})},[x]),w=d.useCallback(p=>{s(p),i(!1)},[s]);d.useEffect(()=>{if(!a)return;const p=_=>{h.current&&!h.current.contains(_.target)&&i(!1)},m=_=>{_.key==="Escape"&&(_.stopPropagation(),i(!1))};return document.addEventListener("pointerdown",p,!0),document.addEventListener("keydown",m,!0),()=>{document.removeEventListener("pointerdown",p,!0),document.removeEventListener("keydown",m,!0)}},[a]);const g=p=>{if(!a){(p.key==="ArrowDown"||p.key==="Enter"||p.key===" ")&&(p.preventDefault(),l(x),i(!0));return}if(p.key==="ArrowDown")p.preventDefault(),l(m=>(m+1)%r.length);else if(p.key==="ArrowUp")p.preventDefault(),l(m=>(m-1+r.length)%r.length);else if(p.key==="Enter"||p.key===" "){p.preventDefault();const m=r[f];m&&w(m.id)}};return u.jsxs("div",{ref:h,className:"relative inline-flex",onPointerDown:p=>p.stopPropagation(),children:[u.jsxs("button",{type:"button",onClick:p=>{p.stopPropagation(),c()},onDoubleClick:p=>p.stopPropagation(),onKeyDown:g,"aria-haspopup":"listbox","aria-expanded":a,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",b?"px-1.5 text-[10px] font-mono":"px-1 text-xs",a?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[b?u.jsx("span",{"aria-hidden":"true",children:b}):u.jsx(_t,{name:e??""}),u.jsx(_t,{name:"caret"})]}),a&&u.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((p,m)=>{const _=p.id===o,y=m===f;return u.jsx("li",{role:"option","aria-selected":_,children:u.jsx("button",{type:"button",onClick:E=>{E.stopPropagation(),w(p.id)},onPointerEnter:()=>l(m),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",y?"bg-bg-hover":"",_?"text-accent font-medium":"text-fg"].join(" "),children:p.label})},p.id)})})]})}function to({controller:e,config:t}){if((t==null?void 0:t.enabled)===!1)return null;const n=e.capabilities,r=t==null?void 0:t.buttons,o=(c,w)=>w&&(r==null?void 0:r[c])!==!1,s=c=>()=>e.setDragMode(c),a=o("zoom",n.zoom)||o("pan",n.pan)||o("select",n.select)||o("lasso",n.lasso),i=o("zoomIn",n.zoom)||o("zoomOut",n.zoom),f=o("autoscale",n.autoscale)||o("reset",n.reset),l=o("screenshot",n.screenshot),h=(t==null?void 0:t.leadingButtons)??[];if(!h.length&&!a&&!i&&!f&&!l)return null;const x=(t==null?void 0:t.position)??"top-right",b=(t==null?void 0:t.visibility)==="always";return u.jsxs("div",{style:{position:"absolute",pointerEvents:"auto",...Qr[x]},className:["z-30 flex items-center gap-0.5 rounded border border-border","bg-bg-elevated/90 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-opacity",b?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),role:"toolbar","aria-label":"Plot controls",children:[h.length>0&&u.jsxs(u.Fragment,{children:[h.map(c=>c.menu?u.jsx(eo,{icon:c.icon,title:c.title,menu:c.menu},c.id):u.jsx(ke,{icon:c.icon,label:c.label,title:c.title,active:c.active,disabled:c.disabled,onClick:c.onClick??(()=>{})},c.id)),(a||i||f||l)&&u.jsx(Ze,{})]}),a&&u.jsxs(u.Fragment,{children:[o("zoom",n.zoom)&&u.jsx(ke,{icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:s("zoom")}),o("pan",n.pan)&&u.jsx(ke,{icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:s("pan")}),o("select",n.select)&&u.jsx(ke,{icon:"select",title:"Box select",active:e.dragMode==="select",onClick:s("select")}),o("lasso",n.lasso)&&u.jsx(ke,{icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:s("lasso")})]}),i&&u.jsxs(u.Fragment,{children:[a&&u.jsx(Ze,{}),o("zoomIn",n.zoom)&&u.jsx(ke,{icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),o("zoomOut",n.zoom)&&u.jsx(ke,{icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()})]}),f&&u.jsxs(u.Fragment,{children:[(a||i)&&u.jsx(Ze,{}),o("autoscale",n.autoscale)&&u.jsx(ke,{icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),o("reset",n.reset)&&u.jsx(ke,{icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()})]}),l&&u.jsxs(u.Fragment,{children:[(a||i||f)&&u.jsx(Ze,{}),u.jsx(ke,{icon:"camera",title:"Download plot as PNG",onClick:()=>{e.toPNG({filename:"plot"}).then(c=>jr(c,"plot.png")).catch(()=>{})}})]})]})}const no={zoom:1,pan:{x:0,y:0}},xn=1.3,ro=.25,oo=64,so={buttons:{zoom:!1}};function ao(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const io=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function Mt(e,t){return{id:"colormap",title:"Colormap",menu:{options:io,value:e,onSelect:t}}}function co({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:s,naturalHeight:a,minZoom:i=ro,maxZoom:f=oo,requestRender:l}){const h=d.useCallback(y=>{var X;if(!o)return;const E=(X=e.current)==null?void 0:X.getBoundingClientRect(),M=(E==null?void 0:E.width)??0,A=(E==null?void 0:E.height)??0,S=s&&a&&M>0&&A>0?Kt(s,a,M,A):f,I=Math.max(i,Math.min(S,n*y));if(I===n)return;const D=M/2,C=A/2,P=D-(D-r.x)/n*I,U=C-(C-r.y)/n*I;o({zoom:I,pan:{x:P,y:U}})},[o,e,s,a,f,i,n,r.x,r.y]),x=d.useCallback(()=>h(xn),[h]),b=d.useCallback(()=>h(1/xn),[h]),c=d.useCallback(()=>o==null?void 0:o(no),[o]),w=d.useCallback(y=>{const E={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};l==null||l();const M=t==null?void 0:t.current;if(M)return mn(M,E);const A=e.current;return A?Zr(A,E):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,l]),g=d.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),v=n!==1||r.x!==0||r.y!==0,p=d.useCallback(y=>{},[]),m=d.useCallback(y=>{},[]),_=d.useCallback(()=>{},[]);return d.useMemo(()=>({capabilities:g,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:v,setDragMode:p,setHoverMode:m,toggleSpikelines:_,zoomIn:x,zoomOut:b,autoscale:c,reset:c,toPNG:w}),[g,v,p,m,_,x,b,c,w])}const lo={zoom:1,pan:{x:0,y:0}};function je({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:s,pan:a,onViewportChange:i,naturalDims:f,checkerboard:l,wrapperClassName:h,wrapperStyle:x,viewportPadding:b,header:c,surface:w,showAxes:g,overlayNode:v,overlay:p,notationSeed:m,exportCanvasRef:_,requestRender:y,leadingMenus:E,label:M,showLabelChip:A,isDraggable:S=!1,onDragStart:I,extraChips:D}){const[C,P]=d.useState(m),[U,X]=d.useState(!1),{containerProps:z}=qt({containerRef:r,zoom:s,pan:a,onViewportChange:i,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h}),te=d.useCallback(()=>{i==null||i(lo)},[i]),ue=co({rootRef:r,canvasRef:_,zoom:s,pan:a,onViewportChange:i,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h,requestRender:y}),he=d.useMemo(()=>({...so,leadingButtons:[...E??[],...U?[ao(C,P)]:[]]}),[U,C,E]),Te=" cairn-checkerboard",Pe="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(l==="pane"?Te:""),ve=h+(l==="wrapper"?Te:""),de="render"in p?p.render({notation:C,setOverlayActive:X}):p.hasSource&&f?u.jsx(ze,{imageElRef:p.displayElRef,naturalWidth:f.w,naturalHeight:f.h,zoom:s,pan:a,sourceWindow:p.sourceWindow,sample:p.sample,notation:C,version:p.version,onActiveChange:X}):null;return u.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[c,n&&u.jsx(to,{controller:ue,config:he}),u.jsxs("div",{ref:r,className:Pe,style:{padding:b,...z.style},onPointerDown:z.onPointerDown,onPointerMove:z.onPointerMove,onPointerUp:z.onPointerUp,onPointerCancel:z.onPointerCancel,onDoubleClick:te,...t,children:[u.jsxs("div",{ref:o,className:ve,style:x,children:[w,g&&f&&u.jsx(Xr,{naturalWidth:f.w,naturalHeight:f.h,zoom:s,containerRef:o}),v]}),de,!n&&U&&u.jsx(jt,{notation:C,onChange:P})]}),A&&u.jsx(Wr,{label:M,isDraggable:S,onDragStart:I}),D]})}function vn(e){return"hdr"in e&&e.hdr!=null}function bn(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function ye(e){return Number.isFinite(e)?e:0}const uo={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function fo(e,t,n,r){const{h:o,w:s,c:a}=bn(e.shape),i=e.data,f=pr(t),l=new Uint8ClampedArray(s*o*4);for(let h=0;h<s*o;h++){const x=h*a;let b,c,w,g=1;a===1?b=c=w=ye(i[x]):a===3?(b=ye(i[x]),c=ye(i[x+1]),w=ye(i[x+2])):(b=ye(i[x]),c=ye(i[x+1]),w=ye(i[x+2]),g=ye(i[x+3]));const v=[dt(b,n),dt(c,n),dt(w,n)],[p,m,_]=f(v),y=h*4;l[y]=255*ft(p,r),l[y+1]=255*ft(m,r),l[y+2]=255*ft(_,r),l[y+3]=255*(g<0?0:g>1?1:g)}return new ImageData(l,s,o)}function po(e){var pe,me;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:s="auto",colormap:a="none",showAxes:i=!1,processing:f=uo,zoom:l=1,pan:h={x:0,y:0},onViewportChange:x,onNaturalSize:b,label:c,isDraggable:w=!1,onDragStart:g,overlay:v,overlaySettings:p,pixelValueNotation:m="decimal",toolbar:_=!0}=e,[y,E]=d.useState(a);d.useEffect(()=>{E(a)},[a]);const M=d.useRef(null),A=d.useRef(null),S=d.useRef(null),I=d.useRef(null),D=d.useRef(null),C=d.useRef(null),P=d.useRef(null),[U,X]=d.useState(0),z=d.useCallback(()=>X(k=>k+1),[]),te=d.useMemo(()=>({get current(){const k=D.current;return k instanceof HTMLCanvasElement?k:null}}),[]),ue=d.useCallback(k=>{M.current=k,k&&(D.current=k)},[]),he=d.useCallback(k=>{A.current=k,k&&(D.current=k)},[]),Te=d.useCallback(k=>{k&&(D.current=k)},[]),[Pe,ve]=d.useState(!1),[de,Se]=d.useState(!1),[ge,Q]=d.useState(null),{flipSign:be}=f,{gammaFilterId:we,filterStr:Ee,gamma:_e,offset:Z}=fn(f),L=!r&&o!=="none"&&n!=null&&t!=null,O=o!=="none"&&n!=null,V=y!=="none"&&!L&&!(r&&O)&&t!=null;d.useEffect(()=>{if(!V||!t){Se(!1);return}let k=!1;Se(!1);const q=`${t}::${y}`,J=it(q);if(J){const j=A.current;if(j){j.width=J.width,j.height=J.height;const ae=j.getContext("2d");ae&&ae.putImageData(J,0,0),P.current=J,z(),Q({w:J.width,h:J.height}),b==null||b(J.width,J.height),Se(!0)}return}const se=new Image;return se.onload=()=>{if(k)return;const j=document.createElement("canvas");j.width=se.naturalWidth,j.height=se.naturalHeight;const ae=j.getContext("2d");if(!ae)return;ae.drawImage(se,0,0);const T=ae.getImageData(0,0,j.width,j.height),H=Ot.has(y)?"positive":"linear",G=at(T,y,H);ct(q,G);const F=A.current;if(!F||k)return;F.width=G.width,F.height=G.height;const R=F.getContext("2d");R&&R.putImageData(G,0,0),P.current=G,z(),Q({w:G.width,h:G.height}),b==null||b(G.width,G.height),Se(!0)},se.src=t,()=>{k=!0}},[V,t,y]);const B=d.useCallback((k,q)=>{Q(J=>J&&J.w===k&&J.h===q?J:{w:k,h:q}),b==null||b(k,q)},[]);d.useEffect(()=>{if(!t){C.current=null,P.current=null,z();return}let k=!1;return Ne(t).then(q=>{k||(C.current=q,y==="none"&&(P.current=q),z())}),()=>{k=!0}},[t,y,z]);const $=d.useCallback((k,q,J)=>{const se=C.current;if(!se||k<0||q<0||k>=se.width||q>=se.height)return null;const j=(q*se.width+k)*4,ae=se.data[j],T=se.data[j+1],H=se.data[j+2],G=P.current;let F=ae,R=T,Y=H;if(G&&G.width===se.width&&G.height===se.height){const le=(q*G.width+k)*4;F=G.data[le],R=G.data[le+1],Y=G.data[le+2]}const ie=(.299*F+.587*R+.114*Y)/255;return y!=="none"||ae===T&&T===H?{lines:[ce(ae,"uint8",J)],luminance:ie}:{lines:[ce(ae,"uint8",J),ce(T,"uint8",J),ce(H,"uint8",J)],luminance:ie,colors:[xe[0],xe[1],xe[2]]}},[y]);d.useEffect(()=>{if(!L){ve(!1);return}let k=!1;const q=dr(),J=q==="gpu"||q==="auto",se=`${n}::${t}::${o}::${y}`;if(q!=="gpu"){const j=it(se);if(j){const ae=M.current;if(ae){(ae.width!==j.width||ae.height!==j.height)&&(ae.width=j.width,ae.height=j.height);const T=ae.getContext("2d");T&&T.putImageData(j,0,0),B(j.width,j.height),ve(!0)}return}}return(async()=>{const[j,ae]=await Promise.all([Ne(n),Ne(t)]);if(k||!j||!ae)return;const H=o.includes("signed")?"signed":"positive",G=y!=="none"?st(y):null,F={diffMode:o,colormap:G,cmapMode:H};if(J)try{const K=M.current;if(K){const le=lr(j,ae,F,K);if(le){if(k)return;B(le.width,le.height),ve(!0);return}}}catch(K){console.warn("[cairn] WebGL 2 diff error:",K)}if(q==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let R=nr(j,ae,o);y!=="none"&&(R=at(R,y,H)),ct(se,R);const Y=M.current;if(!Y||k)return;(Y.width!==R.width||Y.height!==R.height)&&(Y.width=R.width,Y.height=R.height);const ie=Y.getContext("2d");ie&&ie.putImageData(R,0,0),B(R.width,R.height),ve(!0)})(),()=>{k=!0}},[n,t,o,L,y,b]);const N=s==="auto"?void 0:s,re=be?{filter:"invert(1)"}:{},fe=v&&(p!=null&&p.enabled)&&ge&&t&&((((pe=v.boxes)==null?void 0:pe.length)??0)>0||(((me=v.masks)==null?void 0:me.length)??0)>0)?u.jsx(mt,{data:v,settings:p,naturalWidth:ge.w,naturalHeight:ge.h}):void 0,oe=t?L?u.jsxs(u.Fragment,{children:[!Pe&&u.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),u.jsx("canvas",{ref:ue,className:"w-full h-full object-contain block",style:{display:Pe?"block":"none",imageRendering:N,...re}})]}):V?u.jsxs(u.Fragment,{children:[!de&&u.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),u.jsx("canvas",{ref:he,className:"w-full h-full object-contain block",style:{display:de?"block":"none",imageRendering:N,...re}})]}):u.jsx("img",{ref:Te,src:t,alt:c,className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ee,imageRendering:N},onLoad:k=>{const q=k.currentTarget;Q({w:q.naturalWidth,h:q.naturalHeight}),b==null||b(q.naturalWidth,q.naturalHeight)}}):u.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return u.jsx(je,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:S,wrapperRef:I,zoom:l,pan:h,onViewportChange:x,naturalDims:ge,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:i&&ge?"16px 4px 4px 28px":"4px",header:u.jsx(pn,{id:we,gamma:_e,offset:Z}),surface:oe,showAxes:i,overlayNode:fe,overlay:{displayElRef:D,sample:$,version:U,hasSource:!!t},notationSeed:m,exportCanvasRef:te,leadingMenus:[Mt(y,k=>E(k))],label:c,showLabelChip:!0,isDraggable:w,onDragStart:g})}function ho(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:s=!1,label:a="",interpolation:i="auto",zoom:f=1,pan:l={x:0,y:0},onViewportChange:h,pixelValueNotation:x="decimal",toolbar:b=!0}=e,c=d.useRef(null),w=d.useRef(null),g=d.useRef(null),[v,p]=d.useState(null),m=d.useRef(null),[_,y]=d.useState(0);d.useEffect(()=>{const A=c.current;if(!A)return;let S;try{S=fo(t,n,r,o)}catch(D){console.error("[cairn] HDR tone-map error:",D);return}(A.width!==S.width||A.height!==S.height)&&(A.width=S.width,A.height=S.height);const I=A.getContext("2d");I&&(I.putImageData(S,0,0),m.current=S,y(D=>D+1),p(D=>D&&D.w===S.width&&D.h===S.height?D:{w:S.width,h:S.height}))},[t,n,r,o]);const E=d.useCallback((A,S,I)=>{const D=v;if(!D||A<0||S<0||A>=D.w||S>=D.h)return null;const C=t.shape.length===2?1:t.shape[2]??1,P=(S*D.w+A)*C,U=t.data,X=m.current;let z=.5;if(X&&X.width===D.w&&X.height===D.h){const te=(S*D.w+A)*4;z=(.299*X.data[te]+.587*X.data[te+1]+.114*X.data[te+2])/255}return C===1?{lines:[ce(U[P]??0,"unit",I)],luminance:z}:{lines:[ce(U[P]??0,"unit",I),ce(U[P+1]??0,"unit",I),ce(U[P+2]??0,"unit",I)],luminance:z,colors:[xe[0],xe[1],xe[2]]}},[t,v]),M=i==="auto"?void 0:i;return u.jsx(je,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:w,wrapperRef:g,zoom:f,pan:l,onViewportChange:h,naturalDims:v,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${l.x}px, ${l.y}px) scale(${f})`,transformOrigin:"0 0"},viewportPadding:s&&v?"16px 4px 4px 28px":"4px",surface:u.jsx("canvas",{ref:c,className:"w-full h-full object-contain block",style:{imageRendering:M}}),showAxes:s,overlay:{displayElRef:c,sample:E,version:_,hasSource:!0},notationSeed:x,exportCanvasRef:c,label:a,showLabelChip:!!a})}function Tt(e){return vn(e)?u.jsx(ho,{...e}):u.jsx(po,{...e})}const go=["linear","srgb","reinhard","aces"];function mo(e){return e&&go.includes(e)?e:"srgb"}function xo(e){const{h:t,w:n,c:r}=bn(e.shape),o=e.data,s=new Float32Array(n*t*4);for(let a=0;a<n*t;a++){const i=a*r;let f,l,h,x=1;r===1?f=l=h=ye(o[i]):r===3?(f=ye(o[i]),l=ye(o[i+1]),h=ye(o[i+2])):(f=ye(o[i]),l=ye(o[i+1]),h=ye(o[i+2]),x=ye(o[i+3]));const b=a*4;s[b]=f,s[b+1]=l,s[b+2]=h,s[b+3]=x}return{data:s,width:n,height:t,format:"rgba32float"}}function wn(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),s=n*o,a=r*o,i=(t.width-s)/2,f=(t.height-a)/2,l=Math.max(e.zoom,1e-6),h=t.width/(l*s),x=t.height/(l*a),b=-i/s-e.pan.x/(l*s),c=-f/a-e.pan.y/(l*a);return{x:b,y:c,w:h,h:x}}function yn(e,t,n,r){const o=e.w*n,s=e.h*r;return o<=0||s<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/s)}function vo(e){var _e,Z;const t=vn(e),n=d.useRef(null),r=d.useRef(null),o=d.useRef(null),s=d.useRef(null),a=d.useRef(!1),[i,f]=d.useState(!1),[l,h]=d.useState(!1),[x,b]=d.useState(null),[c,w]=d.useState(0),[g,v]=d.useState(0),[p,m]=d.useState({x:0,y:0,w:1,h:1}),_=d.useRef(null),y=d.useRef(null),[E,M]=d.useState(0),A=e.zoom??1,S=e.pan??{x:0,y:0},I=e.onViewportChange,D=t?"none":e.colormap??"none",[C,P]=d.useState(D);d.useEffect(()=>{P(D)},[D]);const U=t?"none":C,X=gt();d.useEffect(()=>{const L=n.current;if(!L)return;let O=!1;return We().then(V=>{if(O)return;const B=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,$=V.capabilities.hdr&&B&&t;a.current=$,Vr(L,{hdr:$}).then(N=>{if(O){dn(N);return}s.current=N,h(!0)}).catch(N=>{O||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",N),f(!0))})}).catch(V=>{O||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",V),f(!0))}),()=>{O=!0,s.current&&(dn(s.current),s.current=null)}},[]),d.useEffect(()=>{const L=r.current;if(!L)return;const O=new ResizeObserver(()=>v(V=>V+1));return O.observe(L),()=>O.disconnect()},[]),d.useEffect(()=>{const L=r.current;if(!L)return;const O=new IntersectionObserver(V=>{const B=V[0];if(!B)return;const $=s.current;$&&($.setVisible(B.isIntersecting),B.isIntersecting?$.isParked&&($.restore(),v(N=>N+1)):$.park())},{threshold:0});return O.observe(L),()=>O.disconnect()},[]),d.useEffect(()=>{var V;if(!t||!l)return;const L=e.hdr;_.current=L;const O=xo(L);(V=s.current)==null||V.setSource(O),b(B=>B&&B.w===O.width&&B.h===O.height?B:{w:O.width,h:O.height}),M(B=>B+1),w(B=>B+1)},[t,l,t?e.hdr:null]),d.useEffect(()=>{if(t||!l)return;const L=e,O=L.imageUrl,V=C;if(!O){y.current=null,b(null),M($=>$+1);return}let B=!1;return Ne(O).then($=>{var fe,oe;if(B||!$)return;let N=$;if(V!=="none"){const pe=`gpu::${O}::${V}`,me=it(pe);if(me)N=me;else{const k=Ot.has(V)?"positive":"linear";N=at($,V,k),ct(pe,N)}}y.current=$;const re={data:N.data,width:N.width,height:N.height,format:"rgba8unorm"};(fe=s.current)==null||fe.setSource(re),b(pe=>pe&&pe.w===N.width&&pe.h===N.height?pe:{w:N.width,h:N.height}),(oe=L.onNaturalSize)==null||oe.call(L,N.width,N.height),M(pe=>pe+1),w(pe=>pe+1)}),()=>{B=!0}},[t,l,t?null:e.imageUrl,t?null:C]);const z=t?e.exposure??0:0,te=t?e.tonemap:void 0,ue=t?e.gamma:void 0,he=d.useCallback(()=>{const L=s.current;if(!L||!l||!x)return;const O=r.current,V=o.current,B=V?V.getBoundingClientRect():O?O.getBoundingClientRect():{width:x.w,height:x.h},$=wn({zoom:A,pan:S},B,x.w,x.h);m(oe=>oe.x===$.x&&oe.y===$.y&&oe.w===$.w&&oe.h===$.h?oe:$),B.width>0&&B.height>0&&L.resize(Math.round(B.width*X),Math.round(B.height*X));const N=yn($,B,x.w,x.h)>=xt?"nearest":"linear",re=$,fe=t?{exposureEV:z,operator:a.current?"extended":mo(te),gamma:ue,isScalar:!1,hdrOut:a.current,uv:re,filter:N}:{exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:re,filter:N};try{L.render(fe)||f(!0)}catch(oe){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",oe),f(!0)}},[l,x,A,S.x,S.y,z,te,ue,t,X]);d.useEffect(()=>{he()},[he,c,g]);const Te=d.useCallback((L,O,V)=>{if(t){const me=_.current,k=x;if(!me||!k||L<0||O<0||L>=k.w||O>=k.h)return null;const q=me.shape.length===2?1:me.shape[2]??1,J=(O*k.w+L)*q,se=me.data,j=.5;return q===1?{lines:[ce(se[J]??0,"unit",V)],luminance:j}:{lines:[ce(se[J]??0,"unit",V),ce(se[J+1]??0,"unit",V),ce(se[J+2]??0,"unit",V)],luminance:j,colors:[xe[0],xe[1],xe[2]]}}const B=y.current;if(!B||L<0||O<0||L>=B.width||O>=B.height)return null;const $=(O*B.width+L)*4,N=B.data[$],re=B.data[$+1],fe=B.data[$+2],oe=(.299*N+.587*re+.114*fe)/255;return U!=="none"||N===re&&re===fe?{lines:[ce(N,"uint8",V)],luminance:oe}:{lines:[ce(N,"uint8",V),ce(re,"uint8",V),ce(fe,"uint8",V)],luminance:oe,colors:[xe[0],xe[1],xe[2]]}},[t,x,U]),Pe=e.showAxes??!1,ve=t?e.label??"":e.label,de=e.interpolation??"auto",Se=de==="auto"?void 0:de,ge=t?void 0:e.overlay,Q=t?void 0:e.overlaySettings,be=t?!1:e.isDraggable??!1,we=t?void 0:e.onDragStart;if(i)return t?u.jsx(Tt,{...e}):u.jsx(Tt,{...e});const Ee=ge&&(Q!=null&&Q.enabled)&&x&&((((_e=ge.boxes)==null?void 0:_e.length)??0)>0||(((Z=ge.masks)==null?void 0:Z.length)??0)>0)?u.jsx(mt,{data:ge,settings:Q,naturalWidth:x.w,naturalHeight:x.h}):void 0;return u.jsx(je,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":l},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:S,onViewportChange:I,naturalDims:x,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Pe&&x?"16px 4px 4px 28px":0,surface:u.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Se},"data-gpu-image-canvas":!0}),showAxes:Pe,overlayNode:Ee,overlay:{displayElRef:n,sample:Te,version:E,hasSource:!0,sourceWindow:p},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:he,leadingMenus:t?void 0:[Mt(U,L=>P(L))],label:ve,showLabelChip:!!ve,isDraggable:be,onDragStart:we})}const Qe=new Map;function Ie(e){if(Qe.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Qe.set(e.id,e)}function Ve(e){return Qe.get(e)}function bo(){return Array.from(Qe.values())}function En(e,t){return{...e.params??{},...t??{}}}const wo={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},yo={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Eo={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},_o={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Mo={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},To={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},_n=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];So(_n);const Pt=[1.052156925,1,.91835767],Po=.7;function So(e){const[t,n,r]=e[0],[o,s,a]=e[1],[i,f,l]=e[2],h=s*l-a*f,x=-(o*l-a*i),b=o*f-s*i,w=1/(t*h+n*x+r*b);return[[h*w,-(n*l-r*f)*w,(n*a-r*s)*w],[x*w,(t*l-r*i)*w,-(t*a-r*o)*w],[b*w,-(t*f-n*i)*w,(t*s-n*o)*w]]}function Ao(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const St=6/29;function At(e){return e>St**3?Math.cbrt(e):e/(3*St*St)+4/29}function Mn(e,t,n){const[r,o,s]=Ao(_n,e,t,n),a=At(r*Pt[0]),i=At(o*Pt[1]),f=At(s*Pt[2]),l=116*i-16,h=500*(a-i),x=200*(i-f);return[l,.01*l*h,.01*l*x]}function Ro(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Co(){const e=Mn(0,1,0),t=Mn(0,0,1);return Math.pow(Ro(e,t),Po)}const Tn=Co(),Lo=.082;function Pn(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],s=Math.max(...n,...o),a=Math.ceil(3*Math.sqrt(s/(2*Math.PI**2))*e),i=1/e,f=Math.PI**2,l=[0,0,0];for(let h=-a;h<=a;h++)for(let x=-a;x<=a;x++){const b=(x*i)**2+(h*i)**2;for(let c=0;c<3;c++)l[c]+=t[c]*Math.sqrt(Math.PI/n[c])*Math.exp(-f*b/n[c])+r[c]*Math.sqrt(Math.PI/o[c])*Math.exp(-f*b/o[c])}return{r:a,deltaX:i,sums:l}}function Sn(e){const t=.5*Lo*e,n=Math.ceil(3*t);let r=0,o=0,s=0;for(let a=-n;a<=n;a++)for(let i=-n;i<=n;i++){const f=Math.exp(-(i*i+a*a)/(2*t*t)),l=-i*f,h=(i*i/(t*t)-1)*f;l>0&&(r+=l),h>0?o+=h:s-=h}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:s}}const ko=`
${De}
${Ke}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Do=`
${De}
${Ke}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,Je=`
${De}
${Ke}
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
`,An=`
${De}
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
`;function Ge(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function et(e){return[Ge(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ge(2,[e.sums[2],0,0,0])]}function Rn(e){return[Ge(4,[Tn,e.sd,e.r,e.edgeNorm]),Ge(5,[e.pointPos,e.pointNeg,0,0])]}function Cn(e,t,n,r,o=""){const s=Pn(e),a=Sn(e),i=`ycxczA${o}`,f=`ycxczB${o}`,l=`labA${o}`,h=`labB${o}`,x=`flip${o}`;return{passes:[{name:i,shader:t,inputs:[n],output:i},{name:f,shader:t,inputs:[r],output:f},{name:l,shader:Je,inputs:[i],output:l,uniforms:()=>et(s)},{name:h,shader:Je,inputs:[f],output:h,uniforms:()=>et(s)},{name:x,shader:An,inputs:[l,h,i,f],output:x,uniforms:()=>Rn(a)}],flipRef:x}}const Io={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Cn(t,ko,"srcA","srcB");return{passes:n,final:r}}},Bo={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Cn(t,Do,"srcA","srcB");return{passes:n,final:r}}},Ln=`
${De}
${Ke}
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
`,Uo=`
${De}
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
`,Oo={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),s=(r-n)/Math.max(o-1,1),a=Pn(t),i=Sn(t),f=[];let l=null;for(let h=0;h<o;h++){const x=n+h*s,b=`_e${h}`,c=`ycxczA${b}`,w=`ycxczB${b}`,g=`labA${b}`,v=`labB${b}`,p=`acc${b}`;f.push({name:c,shader:Ln,inputs:["srcA"],output:c,uniforms:()=>[Ge(1,[x,0,0,0])]},{name:w,shader:Ln,inputs:["srcB"],output:w,uniforms:()=>[Ge(1,[x,0,0,0])]},{name:g,shader:Je,inputs:[c],output:g,uniforms:()=>et(a)},{name:v,shader:Je,inputs:[w],output:v,uniforms:()=>et(a)}),l===null?f.push({name:p,shader:An,inputs:[g,v,c,w],output:p,uniforms:()=>Rn(i)}):f.push({name:p,shader:Uo,inputs:[g,v,c,w,l],output:p,uniforms:()=>[Ge(5,[Tn,i.sd,i.r,i.edgeNorm]),Ge(6,[i.pointPos,i.pointNeg,0,0])]}),l=p}return{passes:f,final:l}}};let kn=!1;function Go(){kn||(kn=!0,Ie(yo),Ie(wo),Ie(Eo),Ie(Mo),Ie(_o),Ie(To),Ie(Io),Ie(Oo),Ie(Bo))}Go();function No(){const e=[];for(const t of bo())t.kind==="pointwise"&&e.push({id:t.id,label:t.label});return e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"}),e}function Fo(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Dn=new WeakMap;function Rt(e,t,n,r){let o=Dn.get(e);o||(o=new Map,Dn.set(e,o));const s=`${t}::${r}`;let a=o.get(s);return a||(a=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(s,a)),a}function zo(e){return`
${De}
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
`}const tt="rgba16float";function Vo(e,t,n,r,o){var c,w;const s=Ve(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const a=Math.min(t.width,n.width),i=Math.min(t.height,n.height),f=En(s,o);if(s.kind==="pointwise"){const g=e.createTexture(a,i,tt),v=Rt(e,`pw:${s.id}`,zo(s.source),tt);let p;try{p=e.createBindGroup(v,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(g,v,p)}finally{(c=p==null?void 0:p.destroy)==null||c.call(p)}return g}const l={width:a,height:i,params:f},h=s.buildPasses(l),x=new Map([["srcA",t],["srcB",n]]),b=[];try{for(const v of h.passes){const p=e.createTexture(a,i,tt);b.push(p),x.set(v.output,p);const m=Rt(e,`mp:${s.id}:${v.name}`,v.shader,tt),_=v.inputs.map((E,M)=>{const A=x.get(E);if(!A)throw new Error(`computeDiff: pass "${v.name}" input "${E}" not produced yet`);return{binding:M,resource:A}});v.uniforms&&_.push(...v.uniforms(l));let y;try{y=e.createBindGroup(m,_),e.renderFullscreen(p,m,y)}finally{(w=y==null?void 0:y.destroy)==null||w.call(y)}}const g=x.get(h.final);if(!g)throw new Error(`computeDiff: final ref "${h.final}" not produced`);for(const v of b)v!==g&&v.destroy();return g}catch(g){for(const v of b)v.destroy();throw g}}const $o=8,Xo=256*1024*1024;class Wo{constructor(t=$o,n=Xo){ee(this,"map",new Map);ee(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const In=new WeakMap;function Yo(e){let t=In.get(e);return t||(t=new Wo,In.set(e,t)),t}function Ho(e,t){const n=En(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Ko(e,t,n,r){const o=Ve(n),s=o?Ho(o,r):"";return`${e}|${t}|${n}|${s}`}function qo(e,t,n,r,o,s,a){const i=Ve(r);if(!i)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const f=Yo(e),l=Ko(s,a,r,o),h=f.get(l);if(h)return h;const x=Vo(e,t,n,r,o),b=Math.min(t.width,n.width),c=Math.min(t.height,n.height),w={texture:x,width:b,height:c,displayRange:i.displayRange,bytes:b*c*8};return f.set(l,w),w}async function Zo(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=sn(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}const jo=`
${De}
${Qt}
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
`,Qo={unit:0,signed:1,relative:2},Jo={linear:0,signed:1,positive:2};function es(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ts(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function ns(e,t,n,r,o){var x;const s=ts(t),a=Rt(e,"diff-display",jo,s),i=es(e,o.colormap),f=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),l=new Float32Array([Qo[r],Jo[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]);let h;try{h=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:i},{binding:2,resource:{uniform:f}},{binding:3,resource:{uniform:l}}]),e.renderFullscreen(t,a,h)}finally{(x=h==null?void 0:h.destroy)==null||x.call(h),i.destroy()}}const Bn=.6*.6*2.51,rs=.6*.03,os=0,Un=.6*.6*2.43,ss=.6*.59,as=.14;function On(e){const t=(rs-ss*e)/(Bn-Un*e),n=(os-as*e)/(Bn-Un*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const is=.85,cs=.85,Gn=11920928955078125e-23,Ct=[.2126,.7152,.0722];function ls(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function us(e,t,n,r=3,o={}){const s=t*n,a=On(is),i=On(cs),f=new Float64Array(s);let l=0;for(let m=0;m<s;m++){const[_,y,E]=ls(e,m,r),M=_*Ct[0]+y*Ct[1]+E*Ct[2];f[m]=M,M>l&&(l=M)}const h=Float64Array.from(f).sort(),x=s>>1,b=s%2===1?h[x]:h[x-1],c=Math.max(b,Gn),w=Math.max(l,Gn),g=o.startExposure??Math.log2(a/w),v=o.stopExposure??Math.log2(i/c),p=Math.max(2,Math.ceil(v-g));return{startExposure:g,stopExposure:v,numExposures:p}}const ds={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function fs({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:s,zoom:a,pan:i,onViewportChange:f,processing:l=ds,interpolation:h="auto",label:x="",isDraggable:b=!1,onDragStart:c,overlay:w,overlaySettings:g,pixelValueNotation:v="decimal"}){var Ee,_e;const p=d.useRef(null),[m,_]=d.useState(null),[y,E]=d.useState(null),[M,A]=d.useState(v),[S,I]=d.useState(!1),D=d.useRef(null),C=d.useRef(null),P=d.useRef(null),U=d.useRef(null),[X,z]=d.useState(0);d.useEffect(()=>{if(!e){P.current=null,z(L=>L+1);return}let Z=!1;return Ne(e).then(L=>{Z||(P.current=L,z(O=>O+1))}),()=>{Z=!0}},[e]),d.useEffect(()=>{if(!t){U.current=null,z(L=>L+1);return}let Z=!1;return Ne(t).then(L=>{Z||(U.current=L,z(O=>O+1))}),()=>{Z=!0}},[t]);const te=Z=>(L,O,V)=>{const B=Z.current;if(!B||L<0||O<0||L>=B.width||O>=B.height)return null;const $=(O*B.width+L)*4,N=B.data[$],re=B.data[$+1],fe=B.data[$+2],oe=(.299*N+.587*re+.114*fe)/255;return N===re&&re===fe?{lines:[ce(N,"uint8",V)],luminance:oe}:{lines:[ce(N,"uint8",V),ce(re,"uint8",V),ce(fe,"uint8",V)],luminance:oe,colors:[xe[0],xe[1],xe[2]]}},ue=d.useMemo(()=>te(P),[]),he=d.useMemo(()=>te(U),[]),Te=!!w&&!!(g!=null&&g.enabled)&&!!m&&!!e&&((((Ee=w.boxes)==null?void 0:Ee.length)??0)>0||(((_e=w.masks)==null?void 0:_e.length)??0)>0),{gammaFilterId:Pe,filterStr:ve,gamma:de,offset:Se}=fn(l),ge=`translate(${i.x}px, ${i.y}px) scale(${a})`,Q=h==="auto"?void 0:h,{containerProps:be,modifierActive:we}=qt({containerRef:p,zoom:a,pan:i,onViewportChange:f});return u.jsxs("div",{className:"relative flex flex-col h-full",children:[u.jsx(pn,{id:Pe,gamma:de,offset:Se}),u.jsxs("div",{ref:p,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...be.style},onPointerDown:be.onPointerDown,onPointerMove:be.onPointerMove,onPointerUp:be.onPointerUp,onPointerCancel:be.onPointerCancel,children:[u.jsxs("div",{className:"relative w-full h-full",children:[u.jsxs("div",{className:"relative w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:[u.jsx("img",{ref:D,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ve,imageRendering:Q,...n==="blend"?{opacity:o}:{}},onLoad:Z=>{const L=Z.currentTarget;_({w:L.naturalWidth,h:L.naturalHeight})}}),Te&&u.jsx(mt,{data:w,settings:g,naturalWidth:m.w,naturalHeight:m.h})]}),u.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:u.jsx("div",{className:"w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:u.jsx("img",{ref:C,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ve,imageRendering:Q,...n==="blend"?{opacity:1-o}:{}},onLoad:Z=>{const L=Z.currentTarget;E({w:L.naturalWidth,h:L.naturalHeight})}})})}),n==="split"&&u.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>s==null?void 0:s(.5),onPointerDown:Z=>{Z.stopPropagation(),Z.preventDefault();const O=Z.currentTarget.parentElement.getBoundingClientRect(),V=$=>{s==null||s(Math.max(0,Math.min(1,($.clientX-O.left)/O.width)))},B=()=>{window.removeEventListener("pointermove",V),window.removeEventListener("pointerup",B)};window.addEventListener("pointermove",V),window.addEventListener("pointerup",B)},children:u.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?u.jsxs(u.Fragment,{children:[t&&y&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:u.jsx(ze,{imageElRef:C,naturalWidth:y.w,naturalHeight:y.h,zoom:a,pan:i,sample:he,notation:M,version:X})}),e&&m&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:u.jsx(ze,{imageElRef:D,naturalWidth:m.w,naturalHeight:m.h,zoom:a,pan:i,sample:ue,notation:M,version:X,onActiveChange:I})})]}):e&&m&&u.jsx(ze,{imageElRef:D,naturalWidth:m.w,naturalHeight:m.h,zoom:a,pan:i,sample:ue,notation:M,version:X,onActiveChange:I}),S&&u.jsx(jt,{notation:M,onChange:A})]}),u.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),u.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${b&&!we?" cairn-drag-grip":""}`,draggable:b&&!we,onDragStart:c,style:{cursor:b&&!we?"grab":void 0},children:[u.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),x]})]})}function ps(){return u.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function hs(e){const t=st(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function gs(e){const{data:t,width:n,height:r,channels:o}=e,s=n*r,a=new Float32Array(s*4),i=f=>Number.isFinite(f)?f:0;for(let f=0;f<s;f++){const l=f*o;let h,x,b,c=1;o===1?h=x=b=i(t[l]):o===3?(h=i(t[l]),x=i(t[l+1]),b=i(t[l+2])):(h=i(t[l]),x=i(t[l+1]),b=i(t[l+2]),c=i(t[l+3]));const w=f*4;a[w]=h,a[w+1]=x,a[w+2]=b,a[w+3]=c}return a}function ms({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:s,blendAlpha:a,onSplitPositionChange:i,diffSubmode:f,colormap:l="none",diffKernel:h,onDiffKernelChange:x,zoom:b,pan:c,onViewportChange:w,interpolation:g="auto",label:v="",pixelValueNotation:p="decimal"}){var ae;const m=d.useRef(null),_=d.useRef(null),y=d.useRef(null),E=d.useRef(null),M=d.useRef(null),[A,S]=d.useState(!1),[I,D]=d.useState(!1),[C,P]=d.useState(null),[U,X]=d.useState(0),[z,te]=d.useState(0),[ue,he]=d.useState(null),[Te,Pe]=d.useState({x:0,y:0,w:1,h:1}),ve=h??f??"absolute",[de,Se]=d.useState(ve);d.useEffect(()=>{Se(h??f??"absolute")},[h,f]);const ge=d.useCallback(T=>{Se(T),x==null||x(T)},[x]);d.useEffect(()=>{const T=m.current;if(T)return T.__cairnDiffKernel={current:de,set:ge},()=>{T&&delete T.__cairnDiffKernel}},[de,ge]);const[Q,be]=d.useState(o);d.useEffect(()=>{be(o)},[o]);const[we,Ee]=d.useState(l);d.useEffect(()=>{Ee(l)},[l]);const _e=d.useMemo(()=>{const F=[{id:"compare-mode",title:"Compare / diff mode",menu:{options:[{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...No().map(R=>({id:R.id,label:R.label}))],value:Q==="diff"?de:Q==="split"?"slide":"blend",onSelect:R=>{R==="slide"?be("split"):R==="blend"?be("blend"):(be("diff"),ge(R))}}}];return Q==="diff"&&F.push(Mt(we,R=>Ee(R))),F},[Q,de,we,ge]),Z=d.useRef(null),L=d.useRef(null),[O,V]=d.useState(0),B=gt();d.useEffect(()=>{const T=y.current;if(!T)return;let H=!1;return We().then(G=>{if(!H)try{if(an())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const F=G.createSurface(T,{hdr:!1});E.current={device:G,surface:F,texA:null,texB:null},D(!0)}catch(F){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",F),S(!0)}}).catch(G=>{H||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",G),S(!0))}),()=>{var F,R;H=!0;const G=E.current;G&&((F=G.texA)==null||F.destroy(),(R=G.texB)==null||R.destroy(),E.current=null)}},[]),d.useEffect(()=>{const T=m.current;if(!T)return;const H=new ResizeObserver(()=>te(G=>G+1));return H.observe(T),()=>H.disconnect()},[]),d.useEffect(()=>{if(!I)return;let T=!1;if(!E.current)return;async function G(F,R){if(R){const ie=gs(R);return{width:R.width,height:R.height,imageData:null,make:K=>{const le=K.createTexture(R.width,R.height,"rgba32float");return le.write(ie),le}}}if(!F)return null;const Y=await Ne(F);return Y?{width:Y.width,height:Y.height,imageData:Y,make:ie=>{const K=ie.createTexture(Y.width,Y.height,"rgba8unorm");return K.write(Y.data),K}}:null}return Promise.all([G(e,n),G(t,r)]).then(([F,R])=>{var K,le;if(T||!E.current)return;const Y=E.current;Z.current=(F==null?void 0:F.imageData)??null,L.current=(R==null?void 0:R.imageData)??null,(K=Y.texA)==null||K.destroy(),(le=Y.texB)==null||le.destroy(),Y.texA=null,Y.texB=null;const ie=F??R;if(!ie){P(null),V(Ae=>Ae+1);return}Y.texA=(R??ie).make(Y.device),Y.texB=(F??ie).make(Y.device),P({w:ie.width,h:ie.height}),V(Ae=>Ae+1),X(Ae=>Ae+1)}),()=>{T=!0}},[I,e,t,n,r]);const $=n!=null||r!=null,N=d.useMemo(()=>Fo(de,$),[de,$]),re=d.useMemo(()=>{if(!$)return null;const T=r??n;return T?us(T.data,T.width,T.height,T.channels):null},[$,r,n]),fe=d.useMemo(()=>{var H;return(((H=Ve(N))==null?void 0:H.displayRange)??"unit")==="signed"?"signed":"positive"},[N]),oe=d.useMemo(()=>we!=="none"?hs(we):void 0,[we]),pe=d.useCallback(()=>{const T=E.current;if(!I||!T||!T.surface||!T.texA||!T.texB||!C)return;const H=m.current,G=H?H.getBoundingClientRect():{width:C.w,height:C.h},F=wn({zoom:b,pan:c},G,C.w,C.h);Pe(K=>K.x===F.x&&K.y===F.y&&K.w===F.w&&K.h===F.h?K:F);const R=y.current;if(G.width>0&&G.height>0&&R&&T.surface){const K=Math.max(1,Math.round(G.width*B)),le=Math.max(1,Math.round(G.height*B));(R.width!==K||R.height!==le)&&(R.width=K,R.height=le,T.surface.configure(K,le))}const Y=yn(F,G,C.w,C.h)>=xt?"nearest":"linear",ie=F;try{if(Q==="diff"){const K=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",le=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ae=Ve(N)?N:"absolute",bs=Ae==="hdr-flip"&&re?{ppd:67,startExposure:re.startExposure,stopExposure:re.stopExposure,numExposures:re.numExposures}:void 0,Lt=qo(T.device,T.texA,T.texB,Ae,bs,K,le);M.current=Lt,ns(T.device,T.surface,Lt.texture,Lt.displayRange,{uv:ie,cmapMode:fe,colormap:oe,filter:Y})}else{const K={exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:ie,filter:Y,mode:Q,split:s,alpha:a};Or(T.device,T.surface,T.texA,T.texB,K)}}catch(K){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",K),S(!0)}},[I,C,b,c.x,c.y,Q,s,a,de,N,re,fe,oe,e,t,n,r,B]);d.useEffect(()=>{pe()},[pe,U,z]);const me=t!=null||r!=null;d.useEffect(()=>{const T=E.current;if(!I||!T||!T.texA||!T.texB||!me){he(null);return}let H=!1;const G=T.texA,F=T.texB,R=M.current;return(Q==="diff"&&R?Zo(T.device,R,G,F):sn(T.device,G,F)).then(ie=>{H||he(ie)}),()=>{H=!0}},[I,U,me,Q,de]);const k=T=>(H,G,F)=>{const R=T.current;if(!R||H<0||G<0||H>=R.width||G>=R.height)return null;const Y=(G*R.width+H)*4,ie=R.data[Y],K=R.data[Y+1],le=R.data[Y+2],Ae=(.299*ie+.587*K+.114*le)/255;return ie===K&&K===le?{lines:[ce(ie,"uint8",F)],luminance:Ae}:{lines:[ce(ie,"uint8",F),ce(K,"uint8",F),ce(le,"uint8",F)],luminance:Ae,colors:[xe[0],xe[1],xe[2]]}},q=d.useMemo(()=>k(Z),[]),J=d.useMemo(()=>k(L),[]),se=g==="auto"?void 0:g;if(A)return n!=null||r!=null?u.jsx(ps,{}):Q==="diff"?u.jsx(Tt,{imageUrl:e,baselineUrl:t,diffMode:((ae=Ve(N))==null?void 0:ae.kind)==="pointwise"?N:"absolute",interpolation:g,colormap:we,showAxes:!1,zoom:b,pan:c,onViewportChange:w,label:v,pixelValueNotation:p}):u.jsx(fs,{imageUrl:e,baselineUrl:t,mode:Q,splitPosition:s,blendAlpha:a,onSplitPositionChange:i,zoom:b,pan:c,onViewportChange:w,interpolation:g,label:v,pixelValueNotation:p});const j=u.jsxs(u.Fragment,{children:[u.jsx("canvas",{ref:y,className:"w-full h-full block",style:{imageRendering:se},"data-gpu-compare-canvas":!0}),Q==="split"&&u.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${s*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:T=>{T.stopPropagation(),i==null||i(.5)},onPointerDown:T=>{T.stopPropagation(),T.preventDefault();const G=T.currentTarget.parentElement.getBoundingClientRect(),F=Y=>{i==null||i(Math.max(0,Math.min(1,(Y.clientX-G.left)/G.width)))},R=()=>{window.removeEventListener("pointermove",F),window.removeEventListener("pointerup",R)};window.addEventListener("pointermove",F),window.addEventListener("pointerup",R)},children:u.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return u.jsx(je,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":I},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:m,wrapperRef:_,zoom:b,pan:c,onViewportChange:w,naturalDims:C,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:j,showAxes:!1,notationSeed:p,exportCanvasRef:y,requestRender:pe,leadingMenus:_e,label:"",showLabelChip:!1,overlay:{render:({notation:T,setOverlayActive:H})=>Q==="split"?u.jsxs(u.Fragment,{children:[me&&C&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-s)*100}% 0 0)`},children:u.jsx(ze,{imageElRef:y,naturalWidth:C.w,naturalHeight:C.h,zoom:b,pan:c,sourceWindow:Te,sample:J,notation:T,version:O})}),me&&C&&u.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${s*100}%)`},children:u.jsx(ze,{imageElRef:y,naturalWidth:C.w,naturalHeight:C.h,zoom:b,pan:c,sourceWindow:Te,sample:q,notation:T,version:O,onActiveChange:H})})]}):C&&u.jsx(ze,{imageElRef:y,naturalWidth:C.w,naturalHeight:C.h,zoom:b,pan:c,sourceWindow:Te,sample:q,notation:T,version:O,onActiveChange:H})},extraChips:u.jsxs(u.Fragment,{children:[u.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),v?u.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:v}):null,ue&&u.jsxs("span",{className:"absolute right-1.5 top-9 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono","data-gpu-compare-metrics":!0,children:["MSE ",ue.mse.toExponential(2)," · PSNR ",Number.isFinite(ue.psnr)?ue.psnr.toFixed(1):"∞"," dB · MAE"," ",ue.mae.toExponential(2)]})]})})}const xs="cairn-plot:gpu-image-ready";async function vs(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await We(),window.__cairnPlotGpuImagePane=vo,window.__cairnPlotGpuComparePane=ms,window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(xs))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}vs()})(__cairnPlotJsxRuntime,__cairnPlotReact);
