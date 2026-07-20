var No=Object.defineProperty;var zo=(i,l,Pe)=>l in i?No(i,l,{enumerable:!0,configurable:!0,writable:!0,value:Pe}):i[l]=Pe;var j=(i,l,Pe)=>zo(i,typeof l!="symbol"?l+"":l,Pe);(function(i,l){"use strict";const Pe=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Et(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Pe}),{hdr:!1,format:n}}function yn(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Pe}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Pe}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Et(e,t)}}}const En=`
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
`;function Ke(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function _t(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function _n(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Mn={texture:0,sampler:1,uniform:2};function Ze(e,t){return e*3+Mn[t]}const Tn={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Sn(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const d=Tn[s];if(d===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:d})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Mt{constructor(t,n,r,o){j(this,"width");j(this,"height");j(this,"format");j(this,"gpuTexture");j(this,"device");j(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Ke(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*_t(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Tt{constructor(t){j(this,"_s");j(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Pn{constructor(t,n,r,o,a){j(this,"_p");j(this,"gpuPipeline");j(this,"bindings");j(this,"bindGroupLayout");j(this,"variants");j(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function An(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Cn{constructor(t){j(this,"_c");j(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Rn{constructor(t,n){j(this,"_b");j(this,"gpuBindGroup");j(this,"ownedBuffers");j(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class kn{constructor(t,n,r,o){j(this,"canvas");j(this,"hdr");j(this,"format");j(this,"context");j(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function ze(e){return"canvas"in e}async function Ln(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(c){return ze(c)?c.getCurrentTextureView():c.gpuTexture.createView()}function s(c){if(ze(c))return{width:c.canvas.width,height:c.canvas.height};const x=c;return{width:x.width,height:x.height}}let d=!1;const f=256;let u=null,p=null;function m(){if(!u||!p){const c=t.createShaderModule({code:En});p=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const x=t.createPipelineLayout({bindGroupLayouts:[p]});u=t.createComputePipeline({layout:x,compute:{module:c,entryPoint:"cs_main"}})}return{pipeline:u,layout:p}}return{backend:"webgpu",capabilities:n,createTexture(c,x,h){return new Mt(t,c,x,h)},createSampler(c){const x=(c==null?void 0:c.filter)==="linear"?"linear":"nearest",h=t.createSampler({magFilter:x,minFilter:x,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Tt(h)},createRenderPipeline(c){const x=t.createShaderModule({code:c.shaderWGSL}),h=Sn(c.shaderWGSL),g=Ke(c.targetFormat),w=An(t,h),v=t.createPipelineLayout({bindGroupLayouts:[w]}),E=_=>t.createRenderPipeline({layout:v,vertex:{module:x,entryPoint:"vs_main"},fragment:{module:x,entryPoint:"fs_main",targets:[{format:_}]},primitive:{topology:"triangle-list"}}),y=E(g);return new Pn(y,h,w,g,E)},createComputePipeline(c){const x=t.createShaderModule({code:c.shaderWGSL}),h=t.createComputePipeline({layout:"auto",compute:{module:x,entryPoint:"cs_main"}});return new Cn(h)},createBindGroup(c,x){const h=c,g=new Map,w=[];for(const[E,y]of h.bindings)if(y.kind==="uniform"){const _=t.createBuffer({size:y.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});w.push(_),g.set(E,{binding:E,resource:{buffer:_}})}else y.kind==="sampler"&&g.set(E,{binding:E,resource:o()});for(const E of x){const y=E.resource;if(y instanceof Mt){const _=Ze(E.binding,"texture");h.bindings.has(_)&&g.set(_,{binding:_,resource:y.gpuTexture.createView()})}else if(y instanceof Tt){const _=Ze(E.binding,"sampler");h.bindings.has(_)&&g.set(_,{binding:_,resource:y.gpuSampler})}else{const _=Ze(E.binding,"uniform"),S=h.bindings.get(_);if(S&&S.kind==="uniform"){const P=y.uniform,C=t.createBuffer({size:Math.max(S.sizeBytes,P.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(C,0,P.buffer,P.byteOffset,P.byteLength),w.push(C),g.set(_,{binding:_,resource:{buffer:C}})}}}const v=t.createBindGroup({layout:h.bindGroupLayout,entries:Array.from(g.values())});return new Rn(v,w)},createSurface(c,x){const h=c.getContext("webgpu");if(!h)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const g=x.hdr&&n.hdr,w=()=>g?yn(h,t):Et(h,t),v=w();return new kn(c,h,v,w)},renderFullscreen(c,x,h){const g=x,w=h,v=a(c),{width:E,height:y}=s(c),_=ze(c)?c.format:Ke(c.format),S=g.pipelineFor(_),P=t.createCommandEncoder(),C=P.beginRenderPass({colorAttachments:[{view:v,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});C.setPipeline(S),C.setBindGroup(0,w.gpuBindGroup),C.setViewport(0,0,E,y,0,1),C.draw(3),C.end(),t.queue.submit([P.finish()])},async readback(c){const x=ze(c),{width:h,height:g}=s(c),w=x?c.hdr?"rgba16float":"rgba8unorm":c.format,v=x&&c.format==="bgra8unorm",E=x?c.getCurrentGPUTexture():c.gpuTexture,y=_t(w),_=h*y,S=256,P=Math.ceil(_/S)*S,C=P*g,A=t.createBuffer({size:C,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),I=t.createCommandEncoder();I.copyTextureToBuffer({texture:E},{buffer:A,bytesPerRow:P,rowsPerImage:g},{width:h,height:g,depthOrArrayLayers:1}),t.queue.submit([I.finish()]),await A.mapAsync(GPUMapMode.READ);const H=new Uint8Array(A.getMappedRange()),R=new Uint8Array(_*g);for(let U=0;U<g;U++){const $=U*P,X=U*_;R.set(H.subarray($,$+_),X)}if(A.unmap(),A.destroy(),w==="rgba8unorm"){if(v)for(let U=0;U<R.length;U+=4){const $=R[U],X=R[U+2];R[U]=X,R[U+2]=$}return R}if(w==="rgba16float"){const U=new Uint16Array(R.buffer,R.byteOffset,R.byteLength/2),$=new Float32Array(U.length);for(let X=0;X<U.length;X++)$[X]=_n(U[X]);return $}return new Float32Array(R.buffer,R.byteOffset,R.byteLength/4)},async reduceDiffSumSquaredAbs(c,x,h,g){const w=c,v=x,E=Math.max(0,h*g),y=Math.max(1,Math.ceil(E/f)),{pipeline:_,layout:S}=m(),P=y*2*4,C=t.createBuffer({size:P,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),A=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(A,0,new Uint32Array([Math.max(1,h),Math.max(1,g),E,0]));const I=t.createBindGroup({layout:S,entries:[{binding:0,resource:w.gpuTexture.createView()},{binding:1,resource:v.gpuTexture.createView()},{binding:2,resource:{buffer:C}},{binding:3,resource:{buffer:A}}]}),H=t.createBuffer({size:P,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),R=t.createCommandEncoder(),U=R.beginComputePass();U.setPipeline(_),U.setBindGroup(0,I),U.dispatchWorkgroups(y),U.end(),R.copyBufferToBuffer(C,0,H,0,P),t.queue.submit([R.finish()]),await H.mapAsync(GPUMapMode.READ);const X=new Float32Array(H.getMappedRange()).slice();H.unmap(),H.destroy(),C.destroy(),A.destroy();let J=0,ce=0;for(let se=0;se<y;se++)J+=X[se*2],ce+=X[se*2+1];return{sumSq:J,sumAbs:ce}},destroy(){d||(t.destroy(),d=!0)},isContextLost(){return!1}}}let je=null;async function In(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Ln()}function Ve(){return je||(je=In()),je}function Dn(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Un(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),d=o-a,[f,u,p]=Dn(e[a],e[s],d);t[n*3]=Math.round(f),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(p)}return t}const St={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Pt=new Set(["red-green","red-blue"]),At=new Map;function Qe(e){let t=At.get(e);if(!t){const n=St[e]??St.viridis;t=Un(n),At.set(e,t)}return t}function Je(e,t,n="linear"){const r=Qe(t),o=new ImageData(e.width,e.height),a=e.data,s=o.data;for(let d=0;d<a.length;d+=4){const f=(a[d]+a[d+1]+a[d+2])/3;let u;n==="positive"?u=Math.round(128+f/255*127):u=Math.round(f),u=Math.max(0,Math.min(255,u)),s[d]=r[u*3],s[d+1]=r[u*3+1],s[d+2]=r[u*3+2],s[d+3]=a[d+3]}return o}function Ct(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Rt=Ct(50);function et(e){return Rt.get(e)}function tt(e,t){Rt.set(e,t)}const kt=Ct(100);function Bn(e){return kt.get(e)}function Gn(e,t){kt.set(e,t)}function On(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let d=0;d<r;d++){const f=(s*e.width+d)*4,u=(s*t.width+d)*4,p=(s*r+d)*4;for(let m=0;m<3;m++){const b=e.data[f+m],c=t.data[u+m],x=b-c,h=Math.abs(x),g=Math.max(b,1);let w;switch(n){case"signed":w=(x+255)/2;break;case"absolute":w=h;break;case"squared":w=x*x/255;break;case"relative_signed":w=(x/g+1)*127.5;break;case"relative_absolute":w=h/g*255;break;case"relative_squared":w=x*x/(g*g)*255;break}a.data[p+m]=Math.min(255,Math.max(0,Math.round(w)))}a.data[p+3]=255}return a}async function Re(e){const t=Bn(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Gn(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Fn={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Nn={linear:0,signed:1,positive:2},zn=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Vn=`#version 300 es
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
}`;let ke=null,q=null,me=null,$e=null;function $n(){if(q)return q;try{if(typeof OffscreenCanvas<"u"?ke=new OffscreenCanvas(1,1):ke=document.createElement("canvas"),q=ke.getContext("webgl2",{preserveDrawingBuffer:!0}),!q)return console.warn("[cairn] WebGL 2 not available"),null;const e=q.createShader(q.VERTEX_SHADER);if(q.shaderSource(e,zn),q.compileShader(e),!q.getShaderParameter(e,q.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",q.getShaderInfoLog(e)),null;const t=q.createShader(q.FRAGMENT_SHADER);if(q.shaderSource(t,Vn),q.compileShader(t),!q.getShaderParameter(t,q.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",q.getShaderInfoLog(t)),null;if(me=q.createProgram(),q.attachShader(me,e),q.attachShader(me,t),q.linkProgram(me),!q.getProgramParameter(me,q.LINK_STATUS))return console.error("[cairn] WebGL program link:",q.getProgramInfoLog(me)),null;$e=q.createVertexArray(),q.bindVertexArray($e);const n=q.createBuffer();q.bindBuffer(q.ARRAY_BUFFER,n),q.bufferData(q.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),q.STATIC_DRAW);const r=q.getAttribLocation(me,"a_pos");return q.enableVertexAttribArray(r),q.vertexAttribPointer(r,2,q.FLOAT,!1,0,0),q.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),q}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Lt(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Xn(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Wn(e,t,n,r){const o=$n();if(!o||!me||!$e||!ke)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);ke.width=a,ke.height=s,o.viewport(0,0,a,s);const d=Lt(o,e,0),f=Lt(o,t,1);let u=null;n.colormap?u=Xn(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(me),o.uniform1i(o.getUniformLocation(me,"u_baseline"),0),o.uniform1i(o.getUniformLocation(me,"u_other"),1),o.uniform1i(o.getUniformLocation(me,"u_lut"),2),o.uniform1i(o.getUniformLocation(me,"u_diff_mode"),Fn[n.diffMode]),o.uniform1i(o.getUniformLocation(me,"u_cmap_mode"),Nn[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(me,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray($e),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(ke,0,0,a,s,0,-s,a,s),p.restore()),o.deleteTexture(d),o.deleteTexture(f),o.deleteTexture(u),{width:a,height:s}}const Yn="cairn:render-mode";function qn(){try{const e=localStorage.getItem(Yn);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const ye=e=>e<0?0:e>1?1:e,nt=e=>{const t=e<0?0:e;return t/(1+t)},rt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return ye(n/r)},It={linear:([e,t,n])=>[ye(e),ye(t),ye(n)],srgb:([e,t,n])=>[ye(e),ye(t),ye(n)],reinhard:([e,t,n])=>[nt(e),nt(t),nt(n)],aces:([e,t,n])=>[rt(e),rt(t),rt(n)],extended:([e,t,n])=>[e,t,n]},Hn="srgb";function Kn(e){return e&&It[e]||It[Hn]}function ot(e,t){return e*2**t}function Zn(e){const t=ye(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function at(e,t){return typeof t=="number"&&t>0?ye(Math.pow(ye(e),1/t)):Zn(e)}const Ee=new Uint32Array(512),_e=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ee[e]=0,Ee[e|256]=32768,_e[e]=24,_e[e|256]=24):t<-14?(Ee[e]=1024>>-t-14,Ee[e|256]=1024>>-t-14|32768,_e[e]=-t-1,_e[e|256]=-t-1):t<=15?(Ee[e]=t+15<<10,Ee[e|256]=t+15<<10|32768,_e[e]=13,_e[e|256]=13):t<128?(Ee[e]=31744,Ee[e|256]=64512,_e[e]=24,_e[e|256]=24):(Ee[e]=31744,Ee[e|256]=64512,_e[e]=13,_e[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Oe=Uint8Array,Dt=Uint16Array,jn=Int32Array,Qn=new Oe([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Jn=new Oe([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Ut=function(e,t){for(var n=new Dt(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new jn(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},Bt=Ut(Qn,2),er=Bt.b,tr=Bt.r;er[28]=258,tr[258]=28,Ut(Jn,0);for(var nr=new Dt(32768),ee=0;ee<32768;++ee){var Ae=(ee&43690)>>1|(ee&21845)<<1;Ae=(Ae&52428)>>2|(Ae&13107)<<2,Ae=(Ae&61680)>>4|(Ae&3855)<<4,nr[ee]=((Ae&65280)>>8|(Ae&255)<<8)>>1}for(var Xe=new Oe(288),ee=0;ee<144;++ee)Xe[ee]=8;for(var ee=144;ee<256;++ee)Xe[ee]=9;for(var ee=256;ee<280;++ee)Xe[ee]=7;for(var ee=280;ee<288;++ee)Xe[ee]=8;for(var rr=new Oe(32),ee=0;ee<32;++ee)rr[ee]=5;var or=new Oe(0),ar=typeof TextDecoder<"u"&&new TextDecoder,sr=0;try{ar.decode(or,{stream:!0}),sr=1}catch{}const Gt=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function st(e){const t=Gt.length;return Gt[(e%t+t)%t]}function ir(e){const n=l.useRef(null),[r,o]=l.useState({w:0,h:0}),a=l.useRef(null),s=l.useRef(null),d=l.useRef(null),f=l.useCallback((u,p)=>{o(m=>m.w===u&&m.h===p?m:{w:u,h:p})},[]);return l.useLayoutEffect(()=>{const u=n.current;if(!u||u===d.current)return;const p=u.getBoundingClientRect();(p.width>0||p.height>0)&&(d.current=u,f(p.width,p.height))}),l.useEffect(()=>{var m;const u=n.current;if(u===s.current||((m=a.current)==null||m.disconnect(),a.current=null,s.current=u,!u))return;const p=new ResizeObserver(b=>{for(const c of b)f(c.contentRect.width,c.contentRect.height)});a.current=p,p.observe(u)}),l.useEffect(()=>()=>{var u;return(u=a.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function cr(){const[e,t]=l.useState(!1);return l.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const lr=.25,it=64;function Ot(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return it;const o=Math.min(n/e,r/t);return o<=0?it:Math.max(Math.max(n,r)/o,8)}function Ft(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=lr,maxZoom:s=it,naturalWidth:d,naturalHeight:f}=e,u=cr(),p=l.useRef(u);p.current=u;const m=l.useRef({zoom:n,pan:r});m.current={zoom:n,pan:r};const b=l.useRef(o);b.current=o,l.useEffect(()=>{const v=t.current;if(!v||!o)return;const E=y=>{var $;if(!p.current)return;y.preventDefault(),y.stopPropagation();const _=y.deltaY<0?1.1:1/1.1,S=m.current,P=v.getBoundingClientRect(),C=d&&f?Ot(d,f,P.width,P.height):s,A=Math.max(a,Math.min(C,S.zoom*_));if(S.zoom===A)return;const I=y.clientX-P.left,H=y.clientY-P.top,R=I-(I-S.pan.x)/S.zoom*A,U=H-(H-S.pan.y)/S.zoom*A;($=b.current)==null||$.call(b,{zoom:A,pan:{x:R,y:U}})};return v.addEventListener("wheel",E,{passive:!1}),()=>v.removeEventListener("wheel",E)},[t,!!o,a,s,d,f]);const c=l.useRef(null),x=l.useCallback(v=>{!p.current||!b.current||(v.currentTarget.setPointerCapture(v.pointerId),c.current={pointerId:v.pointerId,startX:v.clientX,startY:v.clientY,panX:m.current.pan.x,panY:m.current.pan.y})},[]),h=l.useCallback(v=>{var S;const E=c.current;if(!E||E.pointerId!==v.pointerId)return;const y=v.clientX-E.startX,_=v.clientY-E.startY;(S=b.current)==null||S.call(b,{zoom:m.current.zoom,pan:{x:E.panX+y,y:E.panY+_}})},[]),g=l.useCallback(v=>{const E=c.current;if(!(!E||E.pointerId!==v.pointerId)){try{v.currentTarget.releasePointerCapture(v.pointerId)}catch{}c.current=null}},[]),w=u&&!!o;return{containerProps:{onPointerDown:x,onPointerMove:h,onPointerUp:g,onPointerCancel:g,style:{cursor:w?"move":void 0,touchAction:w?"none":void 0}},modifierActive:u}}function ct(){const[e,t]=l.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return l.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ur(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Nt(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function lt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=ir(),s=l.useRef(null),d=l.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),f=l.useMemo(()=>{const h=a.w,g=a.h;if(h<=0||g<=0||n<=0||r<=0)return null;const w=Math.min(h/n,g/r),v=n*w,E=r*w;return{left:(h-v)/2,top:(g-E)/2,width:v,height:E}},[a.w,a.h,n,r]),u=e.masks,p=t.showMasks&&!!u&&u.length>0,m=l.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(l.useEffect(()=>{if(!p||!u)return;const h=s.current;if(!h)return;(h.width!==n||h.height!==r)&&(h.width=n,h.height=r);const g=h.getContext("2d");if(!g)return;g.clearRect(0,0,h.width,h.height);let w=!1;const v=g.createImageData(n,r),E=v.data;let y=u.length,_=!1;const S=()=>{w||_&&g.putImageData(v,0,0)},P=document.createElement("canvas");P.width=n,P.height=r;const C=P.getContext("2d",{willReadFrequently:!0});for(const A of u){const I=new Image;I.onload=()=>{if(!w){if(C){C.clearRect(0,0,n,r),C.drawImage(I,0,0,n,r);const H=C.getImageData(0,0,n,r).data;for(let R=0;R<n*r;R++){const U=H[R*4];if(U===0||d.has(U))continue;const[$,X,J]=ur(st(U));E[R*4]=$,E[R*4+1]=X,E[R*4+2]=J,E[R*4+3]=255,_=!0}}y-=1,y===0&&S()}},I.onerror=()=>{y-=1,y===0&&S()},I.src=`data:image/png;base64,${A.png_b64}`}return()=>{w=!0}},[p,u,n,r,m]),!f)return i.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const b=e.boxes??[],c=t.showBoxes&&b.length>0,x=e.class_labels??{};return i.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&i.jsx("canvas",{ref:s,className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),c&&i.jsx("svg",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:b.map((h,g)=>{if(!Nt(h,t,d))return null;const w=h.domain==="pixel"?1:n,v=h.domain==="pixel"?1:r,E=h.position.minX*w,y=h.position.minY*v,_=(h.position.maxX-h.position.minX)*w,S=(h.position.maxY-h.position.minY)*v;return i.jsx("rect",{x:E,y,width:_,height:S,fill:"none",stroke:st(h.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},g)})}),c&&i.jsx("div",{className:"absolute",style:{left:f.left,top:f.top,width:f.width,height:f.height},children:b.map((h,g)=>{if(!Nt(h,t,d))return null;const w=h.domain==="pixel"?1/n:1,v=h.domain==="pixel"?1/r:1,E=h.position.minX*w*100,y=h.position.minY*v*100,_=h.label??x[String(h.class_id)]??`#${h.class_id}`,S=h.score!=null?` ${(h.score*100).toFixed(0)}%`:"";return!_&&!S?null:i.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${E}%`,top:`${y}%`,transform:"translateY(-100%)",backgroundColor:st(h.class_id)},children:i.jsxs("span",{className:"mono",children:[_,S]})},g)})})]})}const ut=30,le=["#ff5a5a","#39d353","#5b9bff"];function dt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function te(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):dt(e/255):dt(n==="int"?e*255:e)}const dr={x:0,y:0,w:1,h:1};function Le({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:d=0,onActiveChange:f,sourceWindow:u=dr}){const p=l.useRef(null),m=l.useRef(!1),b=ct(),c=l.useRef(f);c.current=f;const x=l.useCallback(g=>{var w;g!==m.current&&(m.current=g,(w=c.current)==null||w.call(c,g))},[]),h=l.useCallback(()=>{var ve;const g=p.current,w=e.current;if(!g)return;const v=window.devicePixelRatio||1,E=g.clientWidth,y=g.clientHeight;if(E===0||y===0)return;g.width!==Math.round(E*v)&&(g.width=Math.round(E*v)),g.height!==Math.round(y*v)&&(g.height=Math.round(y*v));const _=g.getContext("2d");if(!_)return;if(_.setTransform(v,0,0,v,0,0),_.clearRect(0,0,E,y),!w||t<=0||n<=0){x(!1);return}const S=w.getBoundingClientRect(),P=g.getBoundingClientRect();if(S.width===0||S.height===0){x(!1);return}const C=u.x*t,A=u.y*n,I=u.w*t,H=u.h*n;if(I<=0||H<=0){x(!1);return}const R=Math.min(S.width/I,S.height/H);if(R<ut){x(!1);return}const U=I*R,$=H*R,X=S.left+(S.width-U)/2-P.left,J=S.top+(S.height-$)/2-P.top,ce=Math.max(Math.floor(C),Math.floor(C+(0-X)/R)),se=Math.min(Math.ceil(C+I),Math.ceil(C+(E-X)/R)),pe=Math.max(Math.floor(A),Math.floor(A+(0-J)/R)),re=Math.min(Math.ceil(A+H),Math.ceil(A+(y-J)/R));if(se<=ce||re<=pe){x(!1);return}x(!0);const ie=X+(0-C)*R,ue=J+(0-A)*R,xe=X+(t-C)*R,we=J+(n-A)*R;_.save(),_.beginPath(),_.rect(ie,ue,xe-ie,we-ue),_.clip(),_.textAlign="center",_.textBaseline="middle",_.lineJoin="round";const be=R*.14,he=R-be*2;for(let z=pe;z<re;z++)for(let O=ce;O<se;O++){if(O<0||z<0||O>=t||z>=n)continue;const D=a(O,z,s);if(!D||D.lines.length===0)continue;const k=D.lines.length;let F=1;for(const B of D.lines)B.length>F&&(F=B.length);const W=he/(k*1.15),Z=he/(F*.62)||W,ne=Math.min(W,Z,24);if(ne<6)continue;const Q=X+(O-C+.5)*R,T=J+(z-A+.5)*R,V=ne*1.15,N=D.luminance<=.55,M=N?"#ffffff":"#000000";_.font=`${ne}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.lineWidth=Math.max(1.4,ne*.16),_.strokeStyle=N?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let L=T-k*V/2+V/2;for(let B=0;B<D.lines.length;B++){const Y=D.lines[B];_.strokeText(Y,Q,L),_.fillStyle=((ve=D.colors)==null?void 0:ve[B])??M,_.fillText(Y,Q,L),L+=V}}_.restore()},[e,t,n,a,s,x,u]);return l.useEffect(()=>{h()},[h,r,o.x,o.y,d,s,u,b]),l.useEffect(()=>{const g=p.current;if(!g)return;const w=new ResizeObserver(()=>h());return w.observe(g),()=>w.disconnect()},[h]),i.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function zt({notation:e,onChange:t,className:n=""}){return i.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const fr=`
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
`,Vt=`
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
`,pr=`
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
`,$t=`
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
`;function Xt(e){return`
${Ue}
${Vt}
${pr}

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
`}const hr=Xt("select(colorB, colorA, uv.x < split)"),gr=Xt("mix(colorA, colorB, alpha)"),ft={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Wt=new WeakMap;function mr(e,t){let n=Wt.get(e);n||(n=new Map,Wt.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:fr,targetFormat:t}),n.set(t,r)),r}function Yt(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function qt(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function vr(e,t,n,r){var x;const o=Yt(t),a=mr(e,o),s=qt(e,r.isScalar?r.colormap:void 0),d=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,f=ft[r.operator]??ft.srgb,u=new Float32Array([r.exposureEV,f,d,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),m=new Float32Array([r.hdrOut?1:0]),b=new Float32Array([r.filter==="nearest"?0:1]);let c;try{c=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:m}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,a,c)}finally{(x=c==null?void 0:c.destroy)==null||x.call(c),s.destroy()}}const Ht=new WeakMap;function xr(e,t,n){let r=Ht.get(e);r||(r=new Map,Ht.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?hr:gr,targetFormat:n}),r.set(o,a)),a}function br(e,t,n,r,o){var x;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Yt(t),s=xr(e,o.mode,a),d=qt(e,void 0),f=o.gamma,u=ft[o.operator],p=new Float32Array([o.exposureEV,u,f,0]),m=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),b=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]);let c;try{c=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:d},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:m}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,s,c)}finally{(x=c==null?void 0:c.destroy)==null||x.call(c),d.destroy()}}function Kt(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function Zt(e,t,n){const r=Math.min(t.width,n.width),o=Math.min(t.height,n.height),a=r*o*3;if(a<=0)return{mse:0,psnr:1/0,mae:0};if(e.reduceDiffSumSquaredAbs){const{sumSq:b,sumAbs:c}=await e.reduceDiffSumSquaredAbs(t,n,r,o);return Kt(b,c,a)}const s=await e.readback(t),d=await e.readback(n),f=s instanceof Uint8Array,u=d instanceof Uint8Array;let p=0,m=0;for(let b=0;b<o;b++)for(let c=0;c<r;c++){const x=(b*t.width+c)*4,h=(b*n.width+c)*4;for(let g=0;g<3;g++){const w=(s[x+g]??0)/(f?255:1),v=(d[h+g]??0)/(u?255:1),E=w-v;p+=E*E,m+=Math.abs(E)}}return Kt(p,m,a)}function jt(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const wr=12,Ce=[];function Qt(e){const t=Ce.indexOf(e);t!==-1&&Ce.splice(t,1),Ce.push(e)}function yr(e){const t=Ce.indexOf(e);t!==-1&&Ce.splice(t,1)}function We(e){e.parked||(yr(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.surface=null,e.parked=!0)}function Jt(e){for(;Ce.length>wr;){const t=Ce.find(n=>n!==e&&!n.visible)??Ce.find(n=>n!==e);if(!t)break;We(t)}}function en(e){var o,a;if(e.disposed)return;if(jt())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Qt(e),Jt(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.source){const s=t.createTexture(e.source.width,e.source.height,e.source.format);s.write(e.source.data),e.srcTexture=s}e.parked=!1,Qt(e),Jt(e)}function Er(e,t){if(e.disposed||!e.source)return!0;try{return en(e),!e.surface||!e.srcTexture?!1:(vr(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,We(e),!1}}function _r(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Er(e,t)},park(){e.disposed||We(e)},restore(){e.disposed||!e.source||en(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(We(e),e.source=null,e.disposed=!0)}}}async function Mr(e,t){const n=await Ve(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return _r(r)}function tn(e){e.dispose()}function Tr(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function nn(e){const n=`cairn-gamma-${l.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:d,flipSign:f}=e,u=l.useMemo(()=>Tr(e,n),[n,r,o,s,f]);return{gammaFilterId:n,filterStr:u,gamma:a,offset:d}}function rn({id:e,gamma:t,offset:n}){return i.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:i.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:i.jsxs("feComponentTransfer",{children:[i.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),i.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function on(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Sr({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=on(e),a=on(t),s=[];for(let v=0;v<=e;v+=o)s.push(v);const d=[];for(let v=0;v<=t;v+=a)d.push(v);const f=1/n,u=8*f,p=-12*f,m=-2*f,b=r==null?void 0:r.current;let c=0,x=0,h=0,g=0;if(b){const v=b.clientWidth,E=b.clientHeight,y=v/e,_=E/t,S=Math.min(y,_);h=e*S,g=t*S,c=(v-h)/2,x=(E-g)/2}const w=b&&h>0;return i.jsxs(i.Fragment,{children:[i.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:w?x:0,transform:`translateY(${p}px)`,fontSize:u},children:s.map(v=>i.jsx("span",{className:"mono",style:{position:"absolute",left:w?c+v/e*h:`${v/e*100}%`,transform:"translateX(-50%)"},children:v},v))}),i.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:w?c:0,transform:`translateX(${m}px)`,fontSize:u},children:d.map(v=>i.jsx("span",{className:"mono",style:{position:"absolute",top:w?x+v/t*g:`${v/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*f}px`},children:v},v))})]})}function Pr({label:e,isDraggable:t,onDragStart:n}){return i.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Ar=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function an(e,t){const n=getComputedStyle(e),r=Ar.map(f=>`${f}:${n.getPropertyValue(f)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,d=Math.min(a.length,s.length);for(let f=0;f<d;f++)an(a[f],s[f])}function pt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function ht(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function gt(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((d,f)=>a.toBlob(u=>u?d(u):f(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Cr(e,t,n){const r=e.cloneNode(!0);an(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,d)=>{const f=new Image;f.onload=()=>s(f),f.onerror=()=>d(new Error("plot-to-png: SVG rasterization failed")),f.src=a})}async function sn(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??pt(e);return gt(r,o,ht(t),a,s=>s.drawImage(e,0,0,r,o))}async function Rr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??pt(e);try{return await gt(r,o,ht(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function kr(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function Lr(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,d=(t==null?void 0:t.background)??pt(e);if(n){const u=n.getBoundingClientRect(),p=await Cr(n,u.width||a,u.height||s);return gt(a,s,ht(t),d,m=>{for(const b of r){const c=b.getBoundingClientRect();m.drawImage(b,c.left-o.left,c.top-o.top,c.width,c.height)}m.drawImage(p,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return sn(r[0],t);const f=kr(e);if(f)return Rr(f,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Ir(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Dr={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Ur={boxZoom:i.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:i.jsxs(i.Fragment,{children:[i.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),i.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),i.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),i.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M12 2v20M2 12h20"}),i.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:i.jsxs(i.Fragment,{children:[i.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),i.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:i.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:i.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:i.jsxs(i.Fragment,{children:[i.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),i.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]})};function Br({name:e}){return i.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Ur[e]??null})}function Me({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return i.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?i.jsx("span",{"aria-hidden":"true",children:t}):i.jsx(Br,{name:e??""})})}function Ye(){return i.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Gr({controller:e,config:t}){if((t==null?void 0:t.enabled)===!1)return null;const n=e.capabilities,r=t==null?void 0:t.buttons,o=(c,x)=>x&&(r==null?void 0:r[c])!==!1,a=c=>()=>e.setDragMode(c),s=o("zoom",n.zoom)||o("pan",n.pan)||o("select",n.select)||o("lasso",n.lasso),d=o("zoomIn",n.zoom)||o("zoomOut",n.zoom),f=o("autoscale",n.autoscale)||o("reset",n.reset),u=o("screenshot",n.screenshot),p=(t==null?void 0:t.leadingButtons)??[];if(!p.length&&!s&&!d&&!f&&!u)return null;const m=(t==null?void 0:t.position)??"top-right",b=(t==null?void 0:t.visibility)==="always";return i.jsxs("div",{style:{position:"absolute",pointerEvents:"auto",...Dr[m]},className:["z-20 flex items-center gap-0.5 rounded border border-border","bg-bg-elevated/90 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-opacity",b?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),role:"toolbar","aria-label":"Plot controls",children:[p.length>0&&i.jsxs(i.Fragment,{children:[p.map(c=>i.jsx(Me,{icon:c.icon,label:c.label,title:c.title,active:c.active,disabled:c.disabled,onClick:c.onClick},c.id)),(s||d||f||u)&&i.jsx(Ye,{})]}),s&&i.jsxs(i.Fragment,{children:[o("zoom",n.zoom)&&i.jsx(Me,{icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:a("zoom")}),o("pan",n.pan)&&i.jsx(Me,{icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:a("pan")}),o("select",n.select)&&i.jsx(Me,{icon:"select",title:"Box select",active:e.dragMode==="select",onClick:a("select")}),o("lasso",n.lasso)&&i.jsx(Me,{icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:a("lasso")})]}),d&&i.jsxs(i.Fragment,{children:[s&&i.jsx(Ye,{}),o("zoomIn",n.zoom)&&i.jsx(Me,{icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),o("zoomOut",n.zoom)&&i.jsx(Me,{icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()})]}),f&&i.jsxs(i.Fragment,{children:[(s||d)&&i.jsx(Ye,{}),o("autoscale",n.autoscale)&&i.jsx(Me,{icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),o("reset",n.reset)&&i.jsx(Me,{icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()})]}),u&&i.jsxs(i.Fragment,{children:[(s||d||f)&&i.jsx(Ye,{}),i.jsx(Me,{icon:"camera",title:"Download plot as PNG",onClick:()=>{e.toPNG({filename:"plot"}).then(c=>Ir(c,"plot.png")).catch(()=>{})}})]})]})}const Or={zoom:1,pan:{x:0,y:0}},cn=1.3,Fr=.25,Nr=64,zr={buttons:{zoom:!1}};function Vr(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}function $r({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:d=Fr,maxZoom:f=Nr,requestRender:u}){const p=l.useCallback(y=>{var $;if(!o)return;const _=($=e.current)==null?void 0:$.getBoundingClientRect(),S=(_==null?void 0:_.width)??0,P=(_==null?void 0:_.height)??0,C=a&&s&&S>0&&P>0?Ot(a,s,S,P):f,A=Math.max(d,Math.min(C,n*y));if(A===n)return;const I=S/2,H=P/2,R=I-(I-r.x)/n*A,U=H-(H-r.y)/n*A;o({zoom:A,pan:{x:R,y:U}})},[o,e,a,s,f,d,n,r.x,r.y]),m=l.useCallback(()=>p(cn),[p]),b=l.useCallback(()=>p(1/cn),[p]),c=l.useCallback(()=>o==null?void 0:o(Or),[o]),x=l.useCallback(y=>{const _={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};u==null||u();const S=t==null?void 0:t.current;if(S)return sn(S,_);const P=e.current;return P?Lr(P,_):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),h=l.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),g=n!==1||r.x!==0||r.y!==0,w=l.useCallback(y=>{},[]),v=l.useCallback(y=>{},[]),E=l.useCallback(()=>{},[]);return l.useMemo(()=>({capabilities:h,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:g,setDragMode:w,setHoverMode:v,toggleSpikelines:E,zoomIn:m,zoomOut:b,autoscale:c,reset:c,toPNG:x}),[h,g,w,v,E,m,b,c,x])}const Xr={zoom:1,pan:{x:0,y:0}};function qe({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:d,naturalDims:f,checkerboard:u,wrapperClassName:p,wrapperStyle:m,viewportPadding:b,header:c,surface:x,showAxes:h,overlayNode:g,overlay:w,notationSeed:v,exportCanvasRef:E,requestRender:y,label:_,showLabelChip:S,isDraggable:P=!1,onDragStart:C,extraChips:A}){const[I,H]=l.useState(v),[R,U]=l.useState(!1),{containerProps:$}=Ft({containerRef:r,zoom:a,pan:s,onViewportChange:d,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h}),X=l.useCallback(()=>{d==null||d(Xr)},[d]),J=$r({rootRef:r,canvasRef:E,zoom:a,pan:s,onViewportChange:d,naturalWidth:f==null?void 0:f.w,naturalHeight:f==null?void 0:f.h,requestRender:y}),ce=l.useMemo(()=>({...zr,leadingButtons:R?[Vr(I,H)]:[]}),[R,I]),se=" cairn-checkerboard",pe="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?se:""),re=p+(u==="wrapper"?se:""),ie="render"in w?w.render({notation:I,setOverlayActive:U}):w.hasSource&&f?i.jsx(Le,{imageElRef:w.displayElRef,naturalWidth:f.w,naturalHeight:f.h,zoom:a,pan:s,sourceWindow:w.sourceWindow,sample:w.sample,notation:I,version:w.version,onActiveChange:U}):null;return i.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[c,n&&i.jsx(Gr,{controller:J,config:ce}),i.jsxs("div",{ref:r,className:pe,style:{padding:b,...$.style},onPointerDown:$.onPointerDown,onPointerMove:$.onPointerMove,onPointerUp:$.onPointerUp,onPointerCancel:$.onPointerCancel,onDoubleClick:X,...t,children:[i.jsxs("div",{ref:o,className:re,style:m,children:[x,h&&f&&i.jsx(Sr,{naturalWidth:f.w,naturalHeight:f.h,zoom:a,containerRef:o}),g]}),ie,!n&&R&&i.jsx(zt,{notation:I,onChange:H})]}),S&&i.jsx(Pr,{label:_,isDraggable:P,onDragStart:C}),A]})}function ln(e){return"hdr"in e&&e.hdr!=null}function un(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function fe(e){return Number.isFinite(e)?e:0}const Wr={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Yr(e,t,n,r){const{h:o,w:a,c:s}=un(e.shape),d=e.data,f=Kn(t),u=new Uint8ClampedArray(a*o*4);for(let p=0;p<a*o;p++){const m=p*s;let b,c,x,h=1;s===1?b=c=x=fe(d[m]):s===3?(b=fe(d[m]),c=fe(d[m+1]),x=fe(d[m+2])):(b=fe(d[m]),c=fe(d[m+1]),x=fe(d[m+2]),h=fe(d[m+3]));const g=[ot(b,n),ot(c,n),ot(x,n)],[w,v,E]=f(g),y=p*4;u[y]=255*at(w,r),u[y+1]=255*at(v,r),u[y+2]=255*at(E,r),u[y+3]=255*(h<0?0:h>1?1:h)}return new ImageData(u,a,o)}function qr(e){var V,N;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:d=!1,processing:f=Wr,zoom:u=1,pan:p={x:0,y:0},onViewportChange:m,onNaturalSize:b,label:c,isDraggable:x=!1,onDragStart:h,overlay:g,overlaySettings:w,pixelValueNotation:v="decimal",toolbar:E=!0}=e,y=l.useRef(null),_=l.useRef(null),S=l.useRef(null),P=l.useRef(null),C=l.useRef(null),A=l.useRef(null),I=l.useRef(null),[H,R]=l.useState(0),U=l.useCallback(()=>R(M=>M+1),[]),$=l.useMemo(()=>({get current(){const M=C.current;return M instanceof HTMLCanvasElement?M:null}}),[]),X=l.useCallback(M=>{y.current=M,M&&(C.current=M)},[]),J=l.useCallback(M=>{_.current=M,M&&(C.current=M)},[]),ce=l.useCallback(M=>{M&&(C.current=M)},[]),[se,pe]=l.useState(!1),[re,ie]=l.useState(!1),[ue,xe]=l.useState(null),{flipSign:we}=f,{gammaFilterId:be,filterStr:he,gamma:ve,offset:z}=nn(f),O=!r&&o!=="none"&&n!=null&&t!=null,D=o!=="none"&&n!=null,k=s!=="none"&&!O&&!(r&&D)&&t!=null;l.useEffect(()=>{if(!k||!t){ie(!1);return}let M=!1;ie(!1);const L=`${t}::${s}`,B=et(L);if(B){const G=_.current;if(G){G.width=B.width,G.height=B.height;const K=G.getContext("2d");K&&K.putImageData(B,0,0),I.current=B,U(),xe({w:B.width,h:B.height}),b==null||b(B.width,B.height),ie(!0)}return}const Y=new Image;return Y.onload=()=>{if(M)return;const G=document.createElement("canvas");G.width=Y.naturalWidth,G.height=Y.naturalHeight;const K=G.getContext("2d");if(!K)return;K.drawImage(Y,0,0);const de=K.getImageData(0,0,G.width,G.height),oe=Pt.has(s)?"positive":"linear",ae=Je(de,s,oe);tt(L,ae);const Te=_.current;if(!Te||M)return;Te.width=ae.width,Te.height=ae.height;const ge=Te.getContext("2d");ge&&ge.putImageData(ae,0,0),I.current=ae,U(),xe({w:ae.width,h:ae.height}),b==null||b(ae.width,ae.height),ie(!0)},Y.src=t,()=>{M=!0}},[k,t,s]);const F=l.useCallback((M,L)=>{xe(B=>B&&B.w===M&&B.h===L?B:{w:M,h:L}),b==null||b(M,L)},[]);l.useEffect(()=>{if(!t){A.current=null,I.current=null,U();return}let M=!1;return Re(t).then(L=>{M||(A.current=L,s==="none"&&(I.current=L),U())}),()=>{M=!0}},[t,s,U]);const W=l.useCallback((M,L,B)=>{const Y=A.current;if(!Y||M<0||L<0||M>=Y.width||L>=Y.height)return null;const G=(L*Y.width+M)*4,K=Y.data[G],de=Y.data[G+1],oe=Y.data[G+2],ae=I.current;let Te=K,ge=de,Se=oe;if(ae&&ae.width===Y.width&&ae.height===Y.height){const De=(L*ae.width+M)*4;Te=ae.data[De],ge=ae.data[De+1],Se=ae.data[De+2]}const Fe=(.299*Te+.587*ge+.114*Se)/255;return s!=="none"||K===de&&de===oe?{lines:[te(K,"uint8",B)],luminance:Fe}:{lines:[te(K,"uint8",B),te(de,"uint8",B),te(oe,"uint8",B)],luminance:Fe,colors:[le[0],le[1],le[2]]}},[s]);l.useEffect(()=>{if(!O){pe(!1);return}let M=!1;const L=qn(),B=L==="gpu"||L==="auto",Y=`${n}::${t}::${o}::${s}`;if(L!=="gpu"){const G=et(Y);if(G){const K=y.current;if(K){(K.width!==G.width||K.height!==G.height)&&(K.width=G.width,K.height=G.height);const de=K.getContext("2d");de&&de.putImageData(G,0,0),F(G.width,G.height),pe(!0)}return}}return(async()=>{const[G,K]=await Promise.all([Re(n),Re(t)]);if(M||!G||!K)return;const oe=o.includes("signed")?"signed":"positive",ae=s!=="none"?Qe(s):null,Te={diffMode:o,colormap:ae,cmapMode:oe};if(B)try{const Ne=y.current;if(Ne){const De=Wn(G,K,Te,Ne);if(De){if(M)return;F(De.width,De.height),pe(!0);return}}}catch(Ne){console.warn("[cairn] WebGL 2 diff error:",Ne)}if(L==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let ge=On(G,K,o);s!=="none"&&(ge=Je(ge,s,oe)),tt(Y,ge);const Se=y.current;if(!Se||M)return;(Se.width!==ge.width||Se.height!==ge.height)&&(Se.width=ge.width,Se.height=ge.height);const Fe=Se.getContext("2d");Fe&&Fe.putImageData(ge,0,0),F(ge.width,ge.height),pe(!0)})(),()=>{M=!0}},[n,t,o,O,s,b]);const Z=a==="auto"?void 0:a,ne=we?{filter:"invert(1)"}:{},Q=g&&(w!=null&&w.enabled)&&ue&&t&&((((V=g.boxes)==null?void 0:V.length)??0)>0||(((N=g.masks)==null?void 0:N.length)??0)>0)?i.jsx(lt,{data:g,settings:w,naturalWidth:ue.w,naturalHeight:ue.h}):void 0,T=t?O?i.jsxs(i.Fragment,{children:[!se&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),i.jsx("canvas",{ref:X,className:"w-full h-full object-contain block",style:{display:se?"block":"none",imageRendering:Z,...ne}})]}):k?i.jsxs(i.Fragment,{children:[!re&&i.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),i.jsx("canvas",{ref:J,className:"w-full h-full object-contain block",style:{display:re?"block":"none",imageRendering:Z,...ne}})]}):i.jsx("img",{ref:ce,src:t,alt:c,className:"w-full h-full object-contain block",draggable:!1,style:{filter:he,imageRendering:Z},onLoad:M=>{const L=M.currentTarget;xe({w:L.naturalWidth,h:L.naturalHeight}),b==null||b(L.naturalWidth,L.naturalHeight)}}):i.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return i.jsx(qe,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:E,paneRef:S,wrapperRef:P,zoom:u,pan:p,onViewportChange:m,naturalDims:ue,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:d&&ue?"16px 4px 4px 28px":"4px",header:i.jsx(rn,{id:be,gamma:ve,offset:z}),surface:T,showAxes:d,overlayNode:Q,overlay:{displayElRef:C,sample:W,version:H,hasSource:!!t},notationSeed:v,exportCanvasRef:$,label:c,showLabelChip:!0,isDraggable:x,onDragStart:h})}function Hr(e){const{hdr:t,tonemap:n="srgb",exposure:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:d="auto",zoom:f=1,pan:u={x:0,y:0},onViewportChange:p,pixelValueNotation:m="decimal",toolbar:b=!0}=e,c=l.useRef(null),x=l.useRef(null),h=l.useRef(null),[g,w]=l.useState(null),v=l.useRef(null),[E,y]=l.useState(0);l.useEffect(()=>{const P=c.current;if(!P)return;let C;try{C=Yr(t,n,r,o)}catch(I){console.error("[cairn] HDR tone-map error:",I);return}(P.width!==C.width||P.height!==C.height)&&(P.width=C.width,P.height=C.height);const A=P.getContext("2d");A&&(A.putImageData(C,0,0),v.current=C,y(I=>I+1),w(I=>I&&I.w===C.width&&I.h===C.height?I:{w:C.width,h:C.height}))},[t,n,r,o]);const _=l.useCallback((P,C,A)=>{const I=g;if(!I||P<0||C<0||P>=I.w||C>=I.h)return null;const H=t.shape.length===2?1:t.shape[2]??1,R=(C*I.w+P)*H,U=t.data,$=v.current;let X=.5;if($&&$.width===I.w&&$.height===I.h){const J=(C*I.w+P)*4;X=(.299*$.data[J]+.587*$.data[J+1]+.114*$.data[J+2])/255}return H===1?{lines:[te(U[R]??0,"unit",A)],luminance:X}:{lines:[te(U[R]??0,"unit",A),te(U[R+1]??0,"unit",A),te(U[R+2]??0,"unit",A)],luminance:X,colors:[le[0],le[1],le[2]]}},[t,g]),S=d==="auto"?void 0:d;return i.jsx(qe,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:x,wrapperRef:h,zoom:f,pan:u,onViewportChange:p,naturalDims:g,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${u.x}px, ${u.y}px) scale(${f})`,transformOrigin:"0 0"},viewportPadding:a&&g?"16px 4px 4px 28px":"4px",surface:i.jsx("canvas",{ref:c,className:"w-full h-full object-contain block",style:{imageRendering:S}}),showAxes:a,overlay:{displayElRef:c,sample:_,version:E,hasSource:!0},notationSeed:m,exportCanvasRef:c,label:s,showLabelChip:!!s})}function mt(e){return ln(e)?i.jsx(Hr,{...e}):i.jsx(qr,{...e})}const Kr=["linear","srgb","reinhard","aces"];function Zr(e){return e&&Kr.includes(e)?e:"srgb"}function jr(e){const{h:t,w:n,c:r}=un(e.shape),o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const d=s*r;let f,u,p,m=1;r===1?f=u=p=fe(o[d]):r===3?(f=fe(o[d]),u=fe(o[d+1]),p=fe(o[d+2])):(f=fe(o[d]),u=fe(o[d+1]),p=fe(o[d+2]),m=fe(o[d+3]));const b=s*4;a[b]=f,a[b+1]=u,a[b+2]=p,a[b+3]=m}return{data:a,width:n,height:t,format:"rgba32float"}}function dn(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,d=(t.width-a)/2,f=(t.height-s)/2,u=Math.max(e.zoom,1e-6),p=t.width/(u*a),m=t.height/(u*s),b=-d/a-e.pan.x/(u*a),c=-f/s-e.pan.y/(u*s);return{x:b,y:c,w:p,h:m}}function fn(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function Qr(e){var he,ve;const t=ln(e),n=l.useRef(null),r=l.useRef(null),o=l.useRef(null),a=l.useRef(null),s=l.useRef(!1),[d,f]=l.useState(!1),[u,p]=l.useState(!1),[m,b]=l.useState(null),[c,x]=l.useState(0),[h,g]=l.useState(0),[w,v]=l.useState({x:0,y:0,w:1,h:1}),E=l.useRef(null),y=l.useRef(null),[_,S]=l.useState(0),P=e.zoom??1,C=e.pan??{x:0,y:0},A=e.onViewportChange,I=t?"none":e.colormap??"none",H=ct();l.useEffect(()=>{const z=n.current;if(!z)return;let O=!1;return Ve().then(D=>{if(O)return;const k=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,F=D.capabilities.hdr&&k&&t;s.current=F,Mr(z,{hdr:F}).then(W=>{if(O){tn(W);return}a.current=W,p(!0)}).catch(W=>{O||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",W),f(!0))})}).catch(D=>{O||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",D),f(!0))}),()=>{O=!0,a.current&&(tn(a.current),a.current=null)}},[]),l.useEffect(()=>{const z=r.current;if(!z)return;const O=new ResizeObserver(()=>g(D=>D+1));return O.observe(z),()=>O.disconnect()},[]),l.useEffect(()=>{const z=r.current;if(!z)return;const O=new IntersectionObserver(D=>{const k=D[0];if(!k)return;const F=a.current;F&&(F.setVisible(k.isIntersecting),k.isIntersecting?F.isParked&&(F.restore(),g(W=>W+1)):F.park())},{threshold:0});return O.observe(z),()=>O.disconnect()},[]),l.useEffect(()=>{var D;if(!t||!u)return;const z=e.hdr;E.current=z;const O=jr(z);(D=a.current)==null||D.setSource(O),b(k=>k&&k.w===O.width&&k.h===O.height?k:{w:O.width,h:O.height}),S(k=>k+1),x(k=>k+1)},[t,u,t?e.hdr:null]),l.useEffect(()=>{if(t||!u)return;const z=e,O=z.imageUrl,D=z.colormap??"none";if(!O){y.current=null,b(null),S(F=>F+1);return}let k=!1;return Re(O).then(F=>{var ne,Q;if(k||!F)return;let W=F;if(D!=="none"){const T=`gpu::${O}::${D}`,V=et(T);if(V)W=V;else{const N=Pt.has(D)?"positive":"linear";W=Je(F,D,N),tt(T,W)}}y.current=F;const Z={data:W.data,width:W.width,height:W.height,format:"rgba8unorm"};(ne=a.current)==null||ne.setSource(Z),b(T=>T&&T.w===W.width&&T.h===W.height?T:{w:W.width,h:W.height}),(Q=z.onNaturalSize)==null||Q.call(z,W.width,W.height),S(T=>T+1),x(T=>T+1)}),()=>{k=!0}},[t,u,t?null:e.imageUrl,t?null:e.colormap]);const R=t?e.exposure??0:0,U=t?e.tonemap:void 0,$=t?e.gamma:void 0,X=l.useCallback(()=>{const z=a.current;if(!z||!u||!m)return;const O=r.current,D=o.current,k=D?D.getBoundingClientRect():O?O.getBoundingClientRect():{width:m.w,height:m.h},F=dn({zoom:P,pan:C},k,m.w,m.h);v(Q=>Q.x===F.x&&Q.y===F.y&&Q.w===F.w&&Q.h===F.h?Q:F),k.width>0&&k.height>0&&z.resize(Math.round(k.width*H),Math.round(k.height*H));const W=fn(F,k,m.w,m.h)>=ut?"nearest":"linear",Z=F,ne=t?{exposureEV:R,operator:s.current?"extended":Zr(U),gamma:$,isScalar:!1,hdrOut:s.current,uv:Z,filter:W}:{exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Z,filter:W};try{z.render(ne)||f(!0)}catch(Q){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",Q),f(!0)}},[u,m,P,C.x,C.y,R,U,$,t,H]);l.useEffect(()=>{X()},[X,c,h]);const J=l.useCallback((z,O,D)=>{if(t){const V=E.current,N=m;if(!V||!N||z<0||O<0||z>=N.w||O>=N.h)return null;const M=V.shape.length===2?1:V.shape[2]??1,L=(O*N.w+z)*M,B=V.data,Y=.5;return M===1?{lines:[te(B[L]??0,"unit",D)],luminance:Y}:{lines:[te(B[L]??0,"unit",D),te(B[L+1]??0,"unit",D),te(B[L+2]??0,"unit",D)],luminance:Y,colors:[le[0],le[1],le[2]]}}const k=y.current;if(!k||z<0||O<0||z>=k.width||O>=k.height)return null;const F=(O*k.width+z)*4,W=k.data[F],Z=k.data[F+1],ne=k.data[F+2],Q=(.299*W+.587*Z+.114*ne)/255;return I!=="none"||W===Z&&Z===ne?{lines:[te(W,"uint8",D)],luminance:Q}:{lines:[te(W,"uint8",D),te(Z,"uint8",D),te(ne,"uint8",D)],luminance:Q,colors:[le[0],le[1],le[2]]}},[t,m,I]),ce=e.showAxes??!1,se=t?e.label??"":e.label,pe=e.interpolation??"auto",re=pe==="auto"?void 0:pe,ie=t?void 0:e.overlay,ue=t?void 0:e.overlaySettings,xe=t?!1:e.isDraggable??!1,we=t?void 0:e.onDragStart;if(d)return t?i.jsx(mt,{...e}):i.jsx(mt,{...e});const be=ie&&(ue!=null&&ue.enabled)&&m&&((((he=ie.boxes)==null?void 0:he.length)??0)>0||(((ve=ie.masks)==null?void 0:ve.length)??0)>0)?i.jsx(lt,{data:ie,settings:ue,naturalWidth:m.w,naturalHeight:m.h}):void 0;return i.jsx(qe,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":u},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:P,pan:C,onViewportChange:A,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:ce&&m?"16px 4px 4px 28px":0,surface:i.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:re},"data-gpu-image-canvas":!0}),showAxes:ce,overlayNode:be,overlay:{displayElRef:n,sample:J,version:_,hasSource:!0,sourceWindow:w},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:X,label:se,showLabelChip:!!se,isDraggable:xe,onDragStart:we})}const vt=new Map;function Ie(e){if(vt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);vt.set(e.id,e)}function Be(e){return vt.get(e)}function pn(e,t){return{...e.params??{}}}const Jr={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},eo={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},to={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},no={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},ro={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},oo={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},hn=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];so(hn);const xt=[1.052156925,1,.91835767],ao=.7;function so(e){const[t,n,r]=e[0],[o,a,s]=e[1],[d,f,u]=e[2],p=a*u-s*f,m=-(o*u-s*d),b=o*f-a*d,x=1/(t*p+n*m+r*b);return[[p*x,-(n*u-r*f)*x,(n*s-r*a)*x],[m*x,(t*u-r*d)*x,-(t*s-r*o)*x],[b*x,-(t*f-n*d)*x,(t*a-n*o)*x]]}function io(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const bt=6/29;function wt(e){return e>bt**3?Math.cbrt(e):e/(3*bt*bt)+4/29}function gn(e,t,n){const[r,o,a]=io(hn,e,t,n),s=wt(r*xt[0]),d=wt(o*xt[1]),f=wt(a*xt[2]),u=116*d-16,p=500*(s-d),m=200*(d-f);return[u,.01*u*p,.01*u*m]}function co(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function lo(){const e=gn(0,1,0),t=gn(0,0,1);return Math.pow(co(e,t),ao)}const uo=lo(),fo=.082;function po(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),d=1/e,f=Math.PI**2,u=[0,0,0];for(let p=-s;p<=s;p++)for(let m=-s;m<=s;m++){const b=(m*d)**2+(p*d)**2;for(let c=0;c<3;c++)u[c]+=t[c]*Math.sqrt(Math.PI/n[c])*Math.exp(-f*b/n[c])+r[c]*Math.sqrt(Math.PI/o[c])*Math.exp(-f*b/o[c])}return{r:s,deltaX:d,sums:u}}function ho(e){const t=.5*fo*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let d=-n;d<=n;d++){const f=Math.exp(-(d*d+s*s)/(2*t*t)),u=-d*f,p=(d*d/(t*t)-1)*f;u>0&&(r+=u),p>0?o+=p:a-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const mn=`
${Ue}
${$t}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,vn=`
${Ue}
${$t}
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
`,go=`
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
`;function Ge(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}const mo={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,n=po(t),r=ho(t);return{passes:[{name:"ycxczA",shader:mn,inputs:["srcA"],output:"ycxczA"},{name:"ycxczB",shader:mn,inputs:["srcB"],output:"ycxczB"},{name:"labA",shader:vn,inputs:["ycxczA"],output:"labA",uniforms:()=>[Ge(1,[n.deltaX,n.r,n.sums[0],n.sums[1]]),Ge(2,[n.sums[2],0,0,0])]},{name:"labB",shader:vn,inputs:["ycxczB"],output:"labB",uniforms:()=>[Ge(1,[n.deltaX,n.r,n.sums[0],n.sums[1]]),Ge(2,[n.sums[2],0,0,0])]},{name:"combine",shader:go,inputs:["labA","labB","ycxczA","ycxczB"],output:"flip",uniforms:()=>[Ge(4,[uo,r.sd,r.r,r.edgeNorm]),Ge(5,[r.pointPos,r.pointNeg,0,0])]}],final:"flip"}}};let xn=!1;function vo(){xn||(xn=!0,Ie(eo),Ie(Jr),Ie(to),Ie(ro),Ie(no),Ie(oo),Ie(mo))}vo();const bn=new WeakMap;function yt(e,t,n,r){let o=bn.get(e);o||(o=new Map,bn.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function xo(e){return`
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
`}const He="rgba16float";function bo(e,t,n,r,o){var c,x;const a=Be(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const s=Math.min(t.width,n.width),d=Math.min(t.height,n.height),f=pn(a);if(a.kind==="pointwise"){const h=e.createTexture(s,d,He),g=yt(e,`pw:${a.id}`,xo(a.source),He);let w;try{w=e.createBindGroup(g,[{binding:0,resource:t},{binding:1,resource:n}]),e.renderFullscreen(h,g,w)}finally{(c=w==null?void 0:w.destroy)==null||c.call(w)}return h}const u={width:s,height:d,params:f},p=a.buildPasses(u),m=new Map([["srcA",t],["srcB",n]]),b=[];try{for(const g of p.passes){const w=e.createTexture(s,d,He);b.push(w),m.set(g.output,w);const v=yt(e,`mp:${a.id}:${g.name}`,g.shader,He),E=g.inputs.map((_,S)=>{const P=m.get(_);if(!P)throw new Error(`computeDiff: pass "${g.name}" input "${_}" not produced yet`);return{binding:S,resource:P}});g.uniforms&&E.push(...g.uniforms(u));let y;try{y=e.createBindGroup(v,E),e.renderFullscreen(w,v,y)}finally{(x=y==null?void 0:y.destroy)==null||x.call(y)}}const h=m.get(p.final);if(!h)throw new Error(`computeDiff: final ref "${p.final}" not produced`);for(const g of b)g!==h&&g.destroy();return h}catch(h){for(const g of b)g.destroy();throw h}}const wo=8,yo=256*1024*1024;class Eo{constructor(t=wo,n=yo){j(this,"map",new Map);j(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const wn=new WeakMap;function _o(e){let t=wn.get(e);return t||(t=new Eo,wn.set(e,t)),t}function Mo(e,t){const n=pn(e);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function To(e,t,n,r){const o=Be(n),a=o?Mo(o):"";return`${e}|${t}|${n}|${a}`}function So(e,t,n,r,o,a,s){const d=Be(r);if(!d)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const f=_o(e),u=To(a,s,r),p=f.get(u);if(p)return p;const m=bo(e,t,n,r),b=Math.min(t.width,n.width),c=Math.min(t.height,n.height),x={texture:m,width:b,height:c,displayRange:d.displayRange,bytes:b*c*8};return f.set(u,x),x}async function Po(e,t,n,r){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Zt(e,n,r).then(o=>(t.scalars=o,o))),t.scalarsPending)}const Ao=`
${Ue}
${Vt}
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
`,Co={unit:0,signed:1,relative:2},Ro={linear:0,signed:1,positive:2};function ko(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Lo(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Io(e,t,n,r,o){var m;const a=Lo(t),s=yt(e,"diff-display",Ao,a),d=ko(e,o.colormap),f=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([Co[r],Ro[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]);let p;try{p=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:d},{binding:2,resource:{uniform:f}},{binding:3,resource:{uniform:u}}]),e.renderFullscreen(t,s,p)}finally{(m=p==null?void 0:p.destroy)==null||m.call(p),d.destroy()}}const Do={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Uo({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:d,onViewportChange:f,processing:u=Do,interpolation:p="auto",label:m="",isDraggable:b=!1,onDragStart:c,overlay:x,overlaySettings:h,pixelValueNotation:g="decimal"}){var z,O;const w=l.useRef(null),[v,E]=l.useState(null),[y,_]=l.useState(null),[S,P]=l.useState(g),[C,A]=l.useState(!1),I=l.useRef(null),H=l.useRef(null),R=l.useRef(null),U=l.useRef(null),[$,X]=l.useState(0);l.useEffect(()=>{if(!e){R.current=null,X(k=>k+1);return}let D=!1;return Re(e).then(k=>{D||(R.current=k,X(F=>F+1))}),()=>{D=!0}},[e]),l.useEffect(()=>{if(!t){U.current=null,X(k=>k+1);return}let D=!1;return Re(t).then(k=>{D||(U.current=k,X(F=>F+1))}),()=>{D=!0}},[t]);const J=D=>(k,F,W)=>{const Z=D.current;if(!Z||k<0||F<0||k>=Z.width||F>=Z.height)return null;const ne=(F*Z.width+k)*4,Q=Z.data[ne],T=Z.data[ne+1],V=Z.data[ne+2],N=(.299*Q+.587*T+.114*V)/255;return Q===T&&T===V?{lines:[te(Q,"uint8",W)],luminance:N}:{lines:[te(Q,"uint8",W),te(T,"uint8",W),te(V,"uint8",W)],luminance:N,colors:[le[0],le[1],le[2]]}},ce=l.useMemo(()=>J(R),[]),se=l.useMemo(()=>J(U),[]),pe=!!x&&!!(h!=null&&h.enabled)&&!!v&&!!e&&((((z=x.boxes)==null?void 0:z.length)??0)>0||(((O=x.masks)==null?void 0:O.length)??0)>0),{gammaFilterId:re,filterStr:ie,gamma:ue,offset:xe}=nn(u),we=`translate(${d.x}px, ${d.y}px) scale(${s})`,be=p==="auto"?void 0:p,{containerProps:he,modifierActive:ve}=Ft({containerRef:w,zoom:s,pan:d,onViewportChange:f});return i.jsxs("div",{className:"relative flex flex-col h-full",children:[i.jsx(rn,{id:re,gamma:ue,offset:xe}),i.jsxs("div",{ref:w,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...he.style},onPointerDown:he.onPointerDown,onPointerMove:he.onPointerMove,onPointerUp:he.onPointerUp,onPointerCancel:he.onPointerCancel,children:[i.jsxs("div",{className:"relative w-full h-full",children:[i.jsxs("div",{className:"relative w-full h-full",style:{transform:we,transformOrigin:"0 0"},children:[i.jsx("img",{ref:I,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ie,imageRendering:be,...n==="blend"?{opacity:o}:{}},onLoad:D=>{const k=D.currentTarget;E({w:k.naturalWidth,h:k.naturalHeight})}}),pe&&i.jsx(lt,{data:x,settings:h,naturalWidth:v.w,naturalHeight:v.h})]}),i.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:i.jsx("div",{className:"w-full h-full",style:{transform:we,transformOrigin:"0 0"},children:i.jsx("img",{ref:H,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ie,imageRendering:be,...n==="blend"?{opacity:1-o}:{}},onLoad:D=>{const k=D.currentTarget;_({w:k.naturalWidth,h:k.naturalHeight})}})})}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:D=>{D.stopPropagation(),D.preventDefault();const F=D.currentTarget.parentElement.getBoundingClientRect(),W=ne=>{a==null||a(Math.max(0,Math.min(1,(ne.clientX-F.left)/F.width)))},Z=()=>{window.removeEventListener("pointermove",W),window.removeEventListener("pointerup",Z)};window.addEventListener("pointermove",W),window.addEventListener("pointerup",Z)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]}),n==="split"?i.jsxs(i.Fragment,{children:[t&&y&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Le,{imageElRef:H,naturalWidth:y.w,naturalHeight:y.h,zoom:s,pan:d,sample:se,notation:S,version:$})}),e&&v&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Le,{imageElRef:I,naturalWidth:v.w,naturalHeight:v.h,zoom:s,pan:d,sample:ce,notation:S,version:$,onActiveChange:A})})]}):e&&v&&i.jsx(Le,{imageElRef:I,naturalWidth:v.w,naturalHeight:v.h,zoom:s,pan:d,sample:ce,notation:S,version:$,onActiveChange:A}),C&&i.jsx(zt,{notation:S,onChange:P})]}),i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),i.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${b&&!ve?" cairn-drag-grip":""}`,draggable:b&&!ve,onDragStart:c,style:{cursor:b&&!ve?"grab":void 0},children:[i.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),m]})]})}function Bo(e){const t=Qe(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Go({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,diffSubmode:s,colormap:d="none",diffKernel:f,onDiffKernelChange:u,zoom:p,pan:m,onViewportChange:b,interpolation:c="auto",label:x="",pixelValueNotation:h="decimal"}){var Q;const g=l.useRef(null),w=l.useRef(null),v=l.useRef(null),E=l.useRef(null),y=l.useRef(null),[_,S]=l.useState(!1),[P,C]=l.useState(!1),[A,I]=l.useState(null),[H,R]=l.useState(0),[U,$]=l.useState(0),[X,J]=l.useState(null),[ce,se]=l.useState({x:0,y:0,w:1,h:1}),pe=f??s??"absolute",[re,ie]=l.useState(pe);l.useEffect(()=>{ie(f??s??"absolute")},[f,s]);const ue=l.useCallback(T=>{ie(T),u==null||u(T)},[u]);l.useEffect(()=>{const T=g.current;if(T)return T.__cairnDiffKernel={current:re,set:ue},()=>{T&&delete T.__cairnDiffKernel}},[re,ue]);const xe=l.useRef(null),we=l.useRef(null),[be,he]=l.useState(0),ve=ct();l.useEffect(()=>{const T=v.current;if(!T)return;let V=!1;return Ve().then(N=>{if(!V)try{if(jt())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const M=N.createSurface(T,{hdr:!1});E.current={device:N,surface:M,texA:null,texB:null},C(!0)}catch(M){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",M),S(!0)}}).catch(N=>{V||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",N),S(!0))}),()=>{var M,L;V=!0;const N=E.current;N&&((M=N.texA)==null||M.destroy(),(L=N.texB)==null||L.destroy(),E.current=null)}},[]),l.useEffect(()=>{const T=g.current;if(!T)return;const V=new ResizeObserver(()=>$(N=>N+1));return V.observe(T),()=>V.disconnect()},[]),l.useEffect(()=>{if(!P)return;let T=!1;if(!E.current)return;async function N(M){return M?Re(M):null}return Promise.all([N(e),N(t)]).then(([M,L])=>{var K,de;if(T||!E.current)return;const B=E.current;xe.current=M,we.current=L,(K=B.texA)==null||K.destroy(),(de=B.texB)==null||de.destroy(),B.texA=null,B.texB=null;const Y=M??L;if(!Y){I(null),he(oe=>oe+1);return}const G=oe=>{const ae=B.device.createTexture(oe.width,oe.height,"rgba8unorm");return ae.write(oe.data),ae};B.texA=G(L??Y),B.texB=G(M??Y),I({w:Y.width,h:Y.height}),he(oe=>oe+1),R(oe=>oe+1)}),()=>{T=!0}},[P,e,t]);const z=l.useMemo(()=>{var V;return(((V=Be(re))==null?void 0:V.displayRange)??"unit")==="signed"?"signed":"positive"},[re]),O=l.useMemo(()=>d!=="none"?Bo(d):void 0,[d]),D=l.useCallback(()=>{const T=E.current;if(!P||!T||!T.surface||!T.texA||!T.texB||!A)return;const V=g.current,N=V?V.getBoundingClientRect():{width:A.w,height:A.h},M=dn({zoom:p,pan:m},N,A.w,A.h);se(G=>G.x===M.x&&G.y===M.y&&G.w===M.w&&G.h===M.h?G:M);const L=v.current;if(N.width>0&&N.height>0&&L&&T.surface){const G=Math.max(1,Math.round(N.width*ve)),K=Math.max(1,Math.round(N.height*ve));(L.width!==G||L.height!==K)&&(L.width=G,L.height=K,T.surface.configure(G,K))}const B=fn(M,N,A.w,A.h)>=ut?"nearest":"linear",Y=M;try{if(n==="diff"){const G=t??e??"none",K=e??t??"none",de=Be(re),oe=So(T.device,T.texA,T.texB,de?re:"absolute",void 0,G,K);y.current=oe,Io(T.device,T.surface,oe.texture,oe.displayRange,{uv:Y,cmapMode:z,colormap:O,filter:B})}else{const G={exposureEV:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Y,filter:B,mode:n,split:r,alpha:o};br(T.device,T.surface,T.texA,T.texB,G)}}catch(G){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",G),S(!0)}},[P,A,p,m.x,m.y,n,r,o,re,z,O,e,t,ve]);l.useEffect(()=>{D()},[D,H,U]),l.useEffect(()=>{const T=E.current;if(!P||!T||!T.texA||!T.texB||!t){J(null);return}let V=!1;const N=T.texA,M=T.texB,L=y.current;return(n==="diff"&&L?Po(T.device,L,N,M):Zt(T.device,N,M)).then(Y=>{V||J(Y)}),()=>{V=!0}},[P,H,t,n,re]);const k=T=>(V,N,M)=>{const L=T.current;if(!L||V<0||N<0||V>=L.width||N>=L.height)return null;const B=(N*L.width+V)*4,Y=L.data[B],G=L.data[B+1],K=L.data[B+2],de=(.299*Y+.587*G+.114*K)/255;return Y===G&&G===K?{lines:[te(Y,"uint8",M)],luminance:de}:{lines:[te(Y,"uint8",M),te(G,"uint8",M),te(K,"uint8",M)],luminance:de,colors:[le[0],le[1],le[2]]}},F=l.useMemo(()=>k(xe),[]),W=l.useMemo(()=>k(we),[]),Z=c==="auto"?void 0:c;if(_)return n==="diff"?i.jsx(mt,{imageUrl:e,baselineUrl:t,diffMode:((Q=Be(re))==null?void 0:Q.kind)==="pointwise"?re:"absolute",interpolation:c,colormap:d,showAxes:!1,zoom:p,pan:m,onViewportChange:b,label:x,pixelValueNotation:h}):i.jsx(Uo,{imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:p,pan:m,onViewportChange:b,interpolation:c,label:x,pixelValueNotation:h});const ne=i.jsxs(i.Fragment,{children:[i.jsx("canvas",{ref:v,className:"w-full h-full block",style:{imageRendering:Z},"data-gpu-compare-canvas":!0}),n==="split"&&i.jsx("div",{className:"absolute top-0 bottom-0 z-20 flex items-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize"},onDoubleClick:T=>{T.stopPropagation(),a==null||a(.5)},onPointerDown:T=>{T.stopPropagation(),T.preventDefault();const N=T.currentTarget.parentElement.getBoundingClientRect(),M=B=>{a==null||a(Math.max(0,Math.min(1,(B.clientX-N.left)/N.width)))},L=()=>{window.removeEventListener("pointermove",M),window.removeEventListener("pointerup",L)};window.addEventListener("pointermove",M),window.addEventListener("pointerup",L)},children:i.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full"})})]});return i.jsx(qe,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":P},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:g,wrapperRef:w,zoom:p,pan:m,onViewportChange:b,naturalDims:A,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:ne,showAxes:!1,notationSeed:h,exportCanvasRef:v,requestRender:D,label:"",showLabelChip:!1,overlay:{render:({notation:T,setOverlayActive:V})=>n==="split"?i.jsxs(i.Fragment,{children:[t&&A&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:i.jsx(Le,{imageElRef:v,naturalWidth:A.w,naturalHeight:A.h,zoom:p,pan:m,sourceWindow:ce,sample:W,notation:T,version:be})}),t&&A&&i.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:i.jsx(Le,{imageElRef:v,naturalWidth:A.w,naturalHeight:A.h,zoom:p,pan:m,sourceWindow:ce,sample:F,notation:T,version:be,onActiveChange:V})})]}):A&&i.jsx(Le,{imageElRef:v,naturalWidth:A.w,naturalHeight:A.h,zoom:p,pan:m,sourceWindow:ce,sample:F,notation:T,version:be,onActiveChange:V})},extraChips:i.jsxs(i.Fragment,{children:[i.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),x?i.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:x}):null,X&&i.jsxs("span",{className:"absolute right-1.5 top-9 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono","data-gpu-compare-metrics":!0,children:["MSE ",X.mse.toExponential(2)," · PSNR ",Number.isFinite(X.psnr)?X.psnr.toFixed(1):"∞"," dB · MAE"," ",X.mae.toExponential(2)]})]})})}const Oo="cairn-plot:gpu-image-ready";async function Fo(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Ve(),window.__cairnPlotGpuImagePane=Qr,window.__cairnPlotGpuComparePane=Go,window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Oo))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e)}}}Fo()})(__cairnPlotJsxRuntime,__cairnPlotReact);
