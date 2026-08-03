var gc=Object.defineProperty;var xc=(d,c,tt)=>c in d?gc(d,c,{enumerable:!0,configurable:!0,writable:!0,value:tt}):d[c]=tt;var oe=(d,c,tt)=>xc(d,typeof c!="symbol"?c+"":c,tt);(function(d,c){"use strict";const tt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function In(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:tt}),{hdr:!1,format:n}}function Bo(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return In(e,t)}}}const Oo=`
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
`,Io=`
struct Params { dims: vec4<f32> }; // x=width, y=height, z=zFar, w=zNear

@group(0) @binding(0) var<storage, read> offsets: array<u32>;
@group(0) @binding(1) var<storage, read> colors: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> zs: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  // Single oversized triangle covering the viewport.
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0),
  );
  return vec4<f32>(p[vid], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) frag: vec4<f32>) -> @location(0) vec4<f32> {
  let w = u32(params.dims.x);
  let h = u32(params.dims.y);
  let x = u32(frag.x);
  let y = u32(frag.y);
  if (x >= w || y >= h) { return vec4<f32>(0.0, 0.0, 0.0, 0.0); }
  let idx = y * w + x;
  let start = offsets[idx];
  let end = offsets[idx + 1u];
  let zFar = params.dims.z;
  let zNear = params.dims.w;
  // Front-to-back OVER over the Z WINDOW [zNear, zFar]: skip samples nearer than
  // zNear, break past zFar (samples ascending in Z). acc += (1 - acc.a) * sample.
  var acc = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  for (var s: u32 = start; s < end; s = s + 1u) {
    let z = zs[s];
    if (z < zNear) { continue; }
    if (z > zFar) { break; }
    let c = colors[s];
    let wgt = 1.0 - acc.a;
    acc = acc + wgt * c;
  }
  return acc;
}
`;function qt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Nn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function No(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Fo={texture:0,sampler:1,uniform:2};function Zt(e,t){return e*3+Fo[t]}const Uo={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Go(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),s=r[2]!==void 0,i=r[3].trim();if(s){const l=Uo[i];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${i}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else i==="sampler"||i==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Fn{constructor(t,n,r,o){oe(this,"width");oe(this,"height");oe(this,"format");oe(this,"gpuTexture");oe(this,"device");oe(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:qt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Nn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Un{constructor(t){oe(this,"_s");oe(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class zo{constructor(t,n,r,o,s){oe(this,"_p");oe(this,"gpuPipeline");oe(this,"bindings");oe(this,"bindGroupLayout");oe(this,"variants");oe(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=s,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Vo(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class $o{constructor(t){oe(this,"_c");oe(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Xo{constructor(t,n,r,o,s){oe(this,"width");oe(this,"height");oe(this,"paramsBuffer");oe(this,"bindGroup");oe(this,"buffers");oe(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=s}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class Wo{constructor(t,n){oe(this,"_b");oe(this,"gpuBindGroup");oe(this,"ownedBuffers");oe(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Ho{constructor(t,n,r,o){oe(this,"canvas");oe(this,"hdr");oe(this,"format");oe(this,"context");oe(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function St(e){return"canvas"in e}async function Yo(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function s(f){return St(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function i(f){if(St(f))return{width:f.canvas.width,height:f.canvas.height};const x=f;return{width:x.width,height:x.height}}let l=!1,a=null;function u(){var x,b;if(a!==null)return a;let f=!1;try{if(typeof document<"u"){const _=document.createElement("canvas");_.width=1,_.height=1;const y=_.getContext("webgpu");if(y)try{y.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const k=(x=y.getConfiguration)==null?void 0:x.call(y);f=((b=k==null?void 0:k.toneMapping)==null?void 0:b.mode)==="extended"}catch{f=!1}finally{try{y.unconfigure()}catch{}}}}catch{f=!1}return a=f,f}const p=256;let g=null,h=null;function w(){if(!g||!h){const f=t.createShaderModule({code:Oo});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const x=t.createPipelineLayout({bindGroupLayouts:[h]});g=t.createComputePipeline({layout:x,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:g,layout:h}}let E=null,v=null;function S(){if(!E||!v){const f=t.createShaderModule({code:Io});v=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const x=t.createPipelineLayout({bindGroupLayouts:[v]});E=t.createRenderPipeline({layout:x,vertex:{module:f,entryPoint:"vs_main"},fragment:{module:f,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:E,layout:v}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:u,createTexture(f,x,b){return new Fn(t,f,x,b)},createSampler(f){const x=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",b=t.createSampler({magFilter:x,minFilter:x,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Un(b)},createRenderPipeline(f){const x=t.createShaderModule({code:f.shaderWGSL}),b=Go(f.shaderWGSL),_=qt(f.targetFormat),y=Vo(t,b),k=t.createPipelineLayout({bindGroupLayouts:[y]}),T=P=>t.createRenderPipeline({layout:k,vertex:{module:x,entryPoint:"vs_main"},fragment:{module:x,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),M=T(_);return new zo(M,b,y,_,T)},createComputePipeline(f){const x=t.createShaderModule({code:f.shaderWGSL}),b=t.createComputePipeline({layout:"auto",compute:{module:x,entryPoint:"cs_main"}});return new $o(b)},createBindGroup(f,x){const b=f,_=new Map,y=[];for(const[T,M]of b.bindings)if(M.kind==="uniform"){const P=t.createBuffer({size:M.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});y.push(P),_.set(T,{binding:T,resource:{buffer:P}})}else M.kind==="sampler"&&_.set(T,{binding:T,resource:o()});for(const T of x){const M=T.resource;if(M instanceof Fn){const P=Zt(T.binding,"texture");b.bindings.has(P)&&_.set(P,{binding:P,resource:M.gpuTexture.createView()})}else if(M instanceof Un){const P=Zt(T.binding,"sampler");b.bindings.has(P)&&_.set(P,{binding:P,resource:M.gpuSampler})}else{const P=Zt(T.binding,"uniform"),D=b.bindings.get(P);if(D&&D.kind==="uniform"){const R=M.uniform,A=t.createBuffer({size:Math.max(D.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(A,0,R.buffer,R.byteOffset,R.byteLength),y.push(A),_.set(P,{binding:P,resource:{buffer:A}})}}}const k=t.createBindGroup({layout:b.bindGroupLayout,entries:Array.from(_.values())});return new Wo(k,y)},createSurface(f,x){const b=f.getContext("webgpu");if(!b)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const _=x.hdr&&n.hdr,y=()=>_?Bo(b,t):In(b,t),k=y();return new Ho(f,b,k,y)},renderFullscreen(f,x,b){const _=x,y=b,k=s(f),{width:T,height:M}=i(f),P=St(f)?f.format:qt(f.format),D=_.pipelineFor(P),R=t.createCommandEncoder(),A=R.beginRenderPass({colorAttachments:[{view:k,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(D),A.setBindGroup(0,y.gpuBindGroup),A.setViewport(0,0,T,M,0,1),A.draw(3),A.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(f){const{layout:x}=S(),b=P=>{const D=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(D,0,P.buffer,P.byteOffset,P.byteLength),D},_=b(f.offsets),y=b(f.colors),k=b(f.zs),T=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),M=t.createBindGroup({layout:x,entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:T}}]});return new Xo(f.width,f.height,[_,y,k],T,M)},compositeDeep(f,x,b,_){const y=f,k=x,{pipeline:T}=S();t.queue.writeBuffer(y.paramsBuffer,0,new Float32Array([y.width,y.height,_,b]));const M=t.createCommandEncoder(),P=M.beginRenderPass({colorAttachments:[{view:k.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(T),P.setBindGroup(0,y.bindGroup),P.setViewport(0,0,k.width,k.height,0,1),P.draw(3),P.end(),t.queue.submit([M.finish()])},async readback(f){const x=St(f),{width:b,height:_}=i(f),y=x?f.hdr?"rgba16float":"rgba8unorm":f.format,k=x&&f.format==="bgra8unorm",T=x?f.getCurrentGPUTexture():f.gpuTexture,M=Nn(y),P=b*M,D=256,R=Math.ceil(P/D)*D,A=R*_,X=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),L=t.createCommandEncoder();L.copyTextureToBuffer({texture:T},{buffer:X,bytesPerRow:R,rowsPerImage:_},{width:b,height:_,depthOrArrayLayers:1}),t.queue.submit([L.finish()]),await X.mapAsync(GPUMapMode.READ);const B=new Uint8Array(X.getMappedRange()),I=new Uint8Array(P*_);for(let O=0;O<_;O++){const q=O*R,Z=O*P;I.set(B.subarray(q,q+P),Z)}if(X.unmap(),X.destroy(),y==="rgba8unorm"){if(k)for(let O=0;O<I.length;O+=4){const q=I[O],Z=I[O+2];I[O]=Z,I[O+2]=q}return I}if(y==="rgba16float"){const O=new Uint16Array(I.buffer,I.byteOffset,I.byteLength/2),q=new Float32Array(O.length);for(let Z=0;Z<O.length;Z++)q[Z]=No(O[Z]);return q}return new Float32Array(I.buffer,I.byteOffset,I.byteLength/4)},async reduceDiffSumSquaredAbs(f,x,b,_){const y=f,k=x,T=Math.max(0,b*_),M=Math.max(1,Math.ceil(T/p)),{pipeline:P,layout:D}=w(),R=M*2*4,A=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),X=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(X,0,new Uint32Array([Math.max(1,b),Math.max(1,_),T,0]));const L=t.createBindGroup({layout:D,entries:[{binding:0,resource:y.gpuTexture.createView()},{binding:1,resource:k.gpuTexture.createView()},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:X}}]}),B=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),I=t.createCommandEncoder(),O=I.beginComputePass();O.setPipeline(P),O.setBindGroup(0,L),O.dispatchWorkgroups(M),O.end(),I.copyBufferToBuffer(A,0,B,0,R),t.queue.submit([I.finish()]),await B.mapAsync(GPUMapMode.READ);const Z=new Float32Array(B.getMappedRange()).slice();B.unmap(),B.destroy(),A.destroy(),X.destroy();let be=0,xe=0;for(let ee=0;ee<M;ee++)be+=Z[ee*2],xe+=Z[ee*2+1];return{sumSq:be,sumAbs:xe}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let jt=null;async function Ko(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Yo()}function Tt(){return jt||(jt=Ko()),jt}function qo(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Zo(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),s=Math.floor(o),i=Math.min(s+1,e.length-1),l=o-s,[a,u,p]=qo(e[s],e[i],l);t[n*3]=Math.round(a),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(p)}return t}const Gn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},jo=new Set(["red-green","red-blue"]),zn=new Map;function Qt(e){let t=zn.get(e);if(!t){const n=Gn[e]??Gn.viridis;t=Zo(n),zn.set(e,t)}return t}const We=e=>e<0?0:e>1?1:e,Jt=e=>{const t=e<0?0:e;return t/(1+t)},en=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return We(n/r)},Pt=4,Qo=1,Jo=16,es=.5,Vn={linear:([e,t,n])=>[We(e),We(t),We(n)],srgb:([e,t,n])=>[We(e),We(t),We(n)],reinhard:([e,t,n])=>[Jt(e),Jt(t),Jt(n)],aces:([e,t,n])=>[en(e),en(t),en(n)],extended:([e,t,n])=>[e,t,n]},$n="srgb",ts=["linear","srgb","reinhard","aces"],ns=["extended","extended-reinhard","extended-aces"],rs=["extended-reinhard","extended-aces"];function Xn(e){return!!e&&ns.includes(e)}function os(e){return!!e&&rs.includes(e)}const Wn={extended:"linear","extended-reinhard":"reinhard","extended-aces":"aces"};function ss(e){return e&&Vn[e]||Vn[$n]}function tn(e){return e&&Wn[e]?Wn[e]:e&&ts.includes(e)?e:$n}function is(e,t){return t?Xn(e)?e:"extended":tn(e)}function At(e,t,n){return e*2**t+n}function as(e){const t=We(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function nn(e,t){return typeof t=="number"&&t>0?We(Math.pow(We(e),1/t)):as(e)}function rn(e,t,n="linear",r=0,o=0){const s=Qt(t),i=new ImageData(e.width,e.height),l=e.data,a=i.data,u=r!==0||o!==0;for(let p=0;p<l.length;p+=4){let g=(l[p]+l[p+1]+l[p+2])/3;u&&(g=Math.max(0,Math.min(255,At(g/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+g/255*127):h=Math.round(g),h=Math.max(0,Math.min(255,h)),a[p]=s[h*3],a[p+1]=s[h*3+1],a[p+2]=s[h*3+2],a[p+3]=l[p+3]}return i}function cs(e,t){return e==="signed"||e==="relative"?"signed":on(t)}function on(e){return jo.has(e??"")?"positive":"linear"}function Hn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Yn=Hn(50);function sn(e){return Yn.get(e)}function an(e,t){Yn.set(e,t)}const Kn=Hn(100);function ls(e){return Kn.get(e)}function us(e,t){Kn.set(e,t)}function fs(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),s=new ImageData(r,o);for(let i=0;i<o;i++)for(let l=0;l<r;l++){const a=(i*e.width+l)*4,u=(i*t.width+l)*4,p=(i*r+l)*4;for(let g=0;g<3;g++){const h=e.data[a+g],w=t.data[u+g],E=h-w,v=Math.abs(E),S=Math.max(h,1);let m;switch(n){case"signed":m=(E+255)/2;break;case"absolute":m=v;break;case"squared":m=E*E/255;break;case"relative_signed":m=(E/S+1)*127.5;break;case"relative_absolute":m=v/S*255;break;case"relative_squared":m=E*E/(S*S)*255;break}s.data[p+g]=Math.min(255,Math.max(0,Math.round(m)))}s.data[p+3]=255}return s}async function ut(e){const t=ls(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const s=o.getContext("2d");if(!s){n(null);return}s.drawImage(r,0,0);const i=s.getImageData(0,0,o.width,o.height);us(e,i),n(i)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const ds={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},ps={linear:0,signed:1,positive:2},hs=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,ms=`#version 300 es
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
}`;let ft=null,Q=null,Ne=null,Rt=null;function gs(){if(Q)return Q;try{if(typeof OffscreenCanvas<"u"?ft=new OffscreenCanvas(1,1):ft=document.createElement("canvas"),Q=ft.getContext("webgl2",{preserveDrawingBuffer:!0}),!Q)return console.warn("[cairn] WebGL 2 not available"),null;const e=Q.createShader(Q.VERTEX_SHADER);if(Q.shaderSource(e,hs),Q.compileShader(e),!Q.getShaderParameter(e,Q.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Q.getShaderInfoLog(e)),null;const t=Q.createShader(Q.FRAGMENT_SHADER);if(Q.shaderSource(t,ms),Q.compileShader(t),!Q.getShaderParameter(t,Q.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Q.getShaderInfoLog(t)),null;if(Ne=Q.createProgram(),Q.attachShader(Ne,e),Q.attachShader(Ne,t),Q.linkProgram(Ne),!Q.getProgramParameter(Ne,Q.LINK_STATUS))return console.error("[cairn] WebGL program link:",Q.getProgramInfoLog(Ne)),null;Rt=Q.createVertexArray(),Q.bindVertexArray(Rt);const n=Q.createBuffer();Q.bindBuffer(Q.ARRAY_BUFFER,n),Q.bufferData(Q.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Q.STATIC_DRAW);const r=Q.getAttribLocation(Ne,"a_pos");return Q.enableVertexAttribArray(r),Q.vertexAttribPointer(r,2,Q.FLOAT,!1,0,0),Q.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Q}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function qn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function xs(e,t,n){const r=new Uint8Array(1024);for(let s=0;s<256;s++)r[s*4]=t[s*3],r[s*4+1]=t[s*3+1],r[s*4+2]=t[s*3+2],r[s*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function bs(e,t,n,r){const o=gs();if(!o||!Ne||!Rt||!ft)return null;const s=Math.min(e.width,t.width),i=Math.min(e.height,t.height);ft.width=s,ft.height=i,o.viewport(0,0,s,i);const l=qn(o,e,0),a=qn(o,t,1);let u=null;n.colormap?u=xs(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ne),o.uniform1i(o.getUniformLocation(Ne,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ne,"u_other"),1),o.uniform1i(o.getUniformLocation(Ne,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ne,"u_diff_mode"),ds[n.diffMode]),o.uniform1i(o.getUniformLocation(Ne,"u_cmap_mode"),ps[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ne,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Rt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=s,r.height=i;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(ft,0,0,s,i,0,-i,s,i),p.restore()),o.deleteTexture(l),o.deleteTexture(a),o.deleteTexture(u),{width:s,height:i}}const vs="cairn:render-mode";function ws(){try{const e=localStorage.getItem(vs);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Ct=15360;function kt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Zn=globalThis.Float16Array;function jn(e,t=e.length){if(Zn){const r=new Zn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=kt(e[r]);return n}const He=new Uint32Array(512),Ye=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(He[e]=0,He[e|256]=32768,Ye[e]=24,Ye[e|256]=24):t<-14?(He[e]=1024>>-t-14,He[e|256]=1024>>-t-14|32768,Ye[e]=-t-1,Ye[e|256]=-t-1):t<=15?(He[e]=t+15<<10,He[e|256]=t+15<<10|32768,Ye[e]=13,Ye[e|256]=13):t<128?(He[e]=31744,He[e|256]=64512,Ye[e]=24,Ye[e|256]=24):(He[e]=31744,He[e|256]=64512,Ye[e]=13,Ye[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var wt=Uint8Array,Qn=Uint16Array,ys=Int32Array,Es=new wt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),_s=new wt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Jn=function(e,t){for(var n=new Qn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new ys(n[30]),r=1;r<30;++r)for(var s=n[r];s<n[r+1];++s)o[s]=s-n[r]<<5|r;return{b:n,r:o}},er=Jn(Es,2),Ms=er.b,Ss=er.r;Ms[28]=258,Ss[258]=28,Jn(_s,0);for(var Ts=new Qn(32768),Ee=0;Ee<32768;++Ee){var nt=(Ee&43690)>>1|(Ee&21845)<<1;nt=(nt&52428)>>2|(nt&13107)<<2,nt=(nt&61680)>>4|(nt&3855)<<4,Ts[Ee]=((nt&65280)>>8|(nt&255)<<8)>>1}for(var Dt=new wt(288),Ee=0;Ee<144;++Ee)Dt[Ee]=8;for(var Ee=144;Ee<256;++Ee)Dt[Ee]=9;for(var Ee=256;Ee<280;++Ee)Dt[Ee]=7;for(var Ee=280;Ee<288;++Ee)Dt[Ee]=8;for(var Ps=new wt(32),Ee=0;Ee<32;++Ee)Ps[Ee]=5;var As=new wt(0),Rs=typeof TextDecoder<"u"&&new TextDecoder,Cs=0;try{Rs.decode(As,{stream:!0}),Cs=1}catch{}const tr=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function cn(e){const t=tr.length;return tr[(e%t+t)%t]}function ks(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),s=c.useRef(null),i=c.useRef(null),l=c.useRef(null),a=c.useCallback((u,p)=>{o(g=>g.w===u&&g.h===p?g:{w:u,h:p})},[]);return c.useLayoutEffect(()=>{const u=n.current;if(!u||u===l.current)return;const p=u.getBoundingClientRect();(p.width>0||p.height>0)&&(l.current=u,a(p.width,p.height))}),c.useEffect(()=>{var g;const u=n.current;if(u===i.current||((g=s.current)==null||g.disconnect(),s.current=null,i.current=u,!u))return;const p=new ResizeObserver(h=>{for(const w of h)a(w.contentRect.width,w.contentRect.height)});s.current=p,p.observe(u)}),c.useEffect(()=>()=>{var u;return(u=s.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function Ds(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!0)},r=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Ls=.001;function Bs(e,t=Ls){return Math.exp(-e*t)}function nr(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function rr(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Os(e,t,n,r,o,s,i){const l=t>0&&r>0?r/t:1,a=Math.max(s,Math.min(i,e.zoom*l)),u=(n.x-e.pan.x)/e.zoom,p=(n.y-e.pan.y)/e.zoom;return{zoom:a,pan:{x:o.x-u*a,y:o.y-p*a}}}const Is=.25,ln=64;function un(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return ln;const o=Math.min(n/e,r/t);return o<=0?ln:Math.max(Math.max(n,r)/o,8)}function or(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:s=Is,maxZoom:i=ln,naturalWidth:l,naturalHeight:a}=e,u=Ds(),p=c.useRef(u);p.current=u;const g=c.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const h=c.useRef(o);h.current=o,c.useEffect(()=>{const T=t.current;if(!T||!o)return;const M=P=>{var Z;if(!P.ctrlKey&&!p.current)return;P.preventDefault(),P.stopPropagation();const D=Bs(P.deltaY),R=g.current,A=T.getBoundingClientRect(),X=l&&a?un(l,a,A.width,A.height):i,L=Math.max(s,Math.min(X,R.zoom*D));if(R.zoom===L)return;const B=P.clientX-A.left,I=P.clientY-A.top,O=B-(B-R.pan.x)/R.zoom*L,q=I-(I-R.pan.y)/R.zoom*L;(Z=h.current)==null||Z.call(h,{zoom:L,pan:{x:O,y:q}})};return T.addEventListener("wheel",M,{passive:!1}),()=>T.removeEventListener("wheel",M)},[t,!!o,s,i,l,a]);const w=c.useRef(new Map),E=c.useRef(null),v=c.useRef(null),S=c.useCallback((T,M,P)=>{const D=T.getBoundingClientRect();return{x:M-D.left,y:P-D.top}},[]),m=c.useCallback(T=>{if(!l||!a)return i;const M=T.getBoundingClientRect();return un(l,a,M.width,M.height)},[l,a,i]),f=c.useCallback((T,M)=>{const P=w.current,D=P.get(T),R=P.get(M);!D||!R||(E.current=null,v.current={idA:T,idB:M,startDist:nr(D,R),startMid:rr(D,R),startZoom:g.current.zoom,startPan:{...g.current.pan}})},[]),x=c.useCallback(T=>{const M=w.current.get(T);M&&(E.current={pointerId:T,startX:M.x,startY:M.y,panX:g.current.pan.x,panY:g.current.pan.y})},[]),b=c.useCallback(T=>{if(!h.current)return;const M=T.pointerType==="touch";if(!M&&!p.current)return;const P=T.currentTarget;if(P.setPointerCapture(T.pointerId),w.current.set(T.pointerId,S(P,T.clientX,T.clientY)),M&&w.current.size>=2){const D=[...w.current.keys()];f(D[D.length-2],D[D.length-1]);return}x(T.pointerId)},[S,f,x]),_=c.useCallback(T=>{var A,X;const M=T.currentTarget,P=w.current.get(T.pointerId);if(P){const L=S(M,T.clientX,T.clientY);P.x=L.x,P.y=L.y}const D=v.current;if(D){const L=w.current.get(D.idA),B=w.current.get(D.idB);if(!L||!B)return;const I=Os({zoom:D.startZoom,pan:D.startPan},D.startDist,D.startMid,nr(L,B),rr(L,B),s,m(M));(A=h.current)==null||A.call(h,I);return}const R=E.current;!R||R.pointerId!==T.pointerId||!P||(X=h.current)==null||X.call(h,{zoom:g.current.zoom,pan:{x:R.panX+(P.x-R.startX),y:R.panY+(P.y-R.startY)}})},[S,s,m]),y=c.useCallback(T=>{var P;try{T.currentTarget.releasePointerCapture(T.pointerId)}catch{}w.current.delete(T.pointerId);const M=v.current;if(M&&(T.pointerId===M.idA||T.pointerId===M.idB)){v.current=null;const D=[...w.current.keys()];D.length===1&&x(D[0]);return}((P=E.current)==null?void 0:P.pointerId)===T.pointerId&&(E.current=null)},[x]);return{containerProps:{onPointerDown:b,onPointerMove:_,onPointerUp:y,onPointerCancel:y,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function fn(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),s())};function s(){if(n)return;const i=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${i}dppx)`),r.addEventListener("change",o,{once:!0})}return s(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function dt(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Ns(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function sr(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function dn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:s}=ks(),i=c.useRef(null),l=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),a=c.useMemo(()=>{const v=s.w,S=s.h;if(v<=0||S<=0||n<=0||r<=0)return null;const m=Math.min(v/n,S/r),f=n*m,x=r*m;return{left:(v-f)/2,top:(S-x)/2,width:f,height:x}},[s.w,s.h,n,r]),u=e.masks,p=t.showMasks&&!!u&&u.length>0,g=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!p||!u)return;const v=i.current;if(!v)return;(v.width!==n||v.height!==r)&&(v.width=n,v.height=r);const S=v.getContext("2d");if(!S)return;S.clearRect(0,0,v.width,v.height);let m=!1;const f=S.createImageData(n,r),x=f.data;let b=u.length,_=!1;const y=()=>{m||_&&S.putImageData(f,0,0)},k=document.createElement("canvas");k.width=n,k.height=r;const T=k.getContext("2d",{willReadFrequently:!0});for(const M of u){const P=new Image;P.onload=()=>{if(!m){if(T){T.clearRect(0,0,n,r),T.drawImage(P,0,0,n,r);const D=T.getImageData(0,0,n,r).data;for(let R=0;R<n*r;R++){const A=D[R*4];if(A===0||l.has(A))continue;const[X,L,B]=Ns(cn(A));x[R*4]=X,x[R*4+1]=L,x[R*4+2]=B,x[R*4+3]=255,_=!0}}b-=1,b===0&&y()}},P.onerror=()=>{b-=1,b===0&&y()},P.src=`data:image/png;base64,${M.png_b64}`}return()=>{m=!0}},[p,u,n,r,g]),!a)return d.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],w=t.showBoxes&&h.length>0,E=e.class_labels??{};return d.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&d.jsx("canvas",{ref:i,className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),w&&d.jsx("svg",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((v,S)=>{if(!sr(v,t,l))return null;const m=v.domain==="pixel"?1:n,f=v.domain==="pixel"?1:r,x=v.position.minX*m,b=v.position.minY*f,_=(v.position.maxX-v.position.minX)*m,y=(v.position.maxY-v.position.minY)*f;return d.jsx("rect",{x,y:b,width:_,height:y,fill:"none",stroke:cn(v.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},S)})}),w&&d.jsx("div",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height},children:h.map((v,S)=>{if(!sr(v,t,l))return null;const m=v.domain==="pixel"?1/n:1,f=v.domain==="pixel"?1/r:1,x=v.position.minX*m*100,b=v.position.minY*f*100,_=v.label??E[String(v.class_id)]??`#${v.class_id}`,y=v.score!=null?` ${(v.score*100).toFixed(0)}%`:"";return!_&&!y?null:d.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${x}%`,top:`${b}%`,transform:"translateY(-100%)",backgroundColor:cn(v.class_id)},children:d.jsxs("span",{className:"mono",children:[_,y]})},S)})})]})}const pn=30,Lt=["#ff5a5a","#39d353","#5b9bff"];function hn(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function xt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):hn(e/255):hn(n==="int"?e*255:e)}function pt(e,t,n,r){return e.length===1?{lines:[xt(e[0],t,n)],luminance:r}:{lines:e.map(o=>xt(o,t,n)),luminance:r,colors:e.map((o,s)=>Lt[s]??null)}}const Fs={x:0,y:0,w:1,h:1};function ht({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:s,notation:i="decimal",version:l=0,onActiveChange:a,sourceWindow:u=Fs}){const p=c.useRef(null),g=c.useRef(!1),h=fn(),w=c.useRef(a);w.current=a;const E=c.useCallback(S=>{var m;S!==g.current&&(g.current=S,(m=w.current)==null||m.call(w,S))},[]),v=c.useCallback(()=>{var J;const S=p.current,m=e.current;if(!S)return;const f=window.devicePixelRatio||1,x=S.clientWidth,b=S.clientHeight;if(x===0||b===0)return;S.width!==Math.round(x*f)&&(S.width=Math.round(x*f)),S.height!==Math.round(b*f)&&(S.height=Math.round(b*f));const _=S.getContext("2d");if(!_)return;if(_.setTransform(f,0,0,f,0,0),_.clearRect(0,0,x,b),!m||t<=0||n<=0){E(!1);return}const y=m.getBoundingClientRect(),k=S.getBoundingClientRect();if(y.width===0||y.height===0){E(!1);return}const T=u.x*t,M=u.y*n,P=u.w*t,D=u.h*n;if(P<=0||D<=0){E(!1);return}const R=Math.min(y.width/P,y.height/D);if(R<pn){E(!1);return}const A=P*R,X=D*R,L=y.left+(y.width-A)/2-k.left,B=y.top+(y.height-X)/2-k.top,I=Math.max(Math.floor(T),Math.floor(T+(0-L)/R)),O=Math.min(Math.ceil(T+P),Math.ceil(T+(x-L)/R)),q=Math.max(Math.floor(M),Math.floor(M+(0-B)/R)),Z=Math.min(Math.ceil(M+D),Math.ceil(M+(b-B)/R));if(O<=I||Z<=q){E(!1);return}E(!0);const be=L+(0-T)*R,xe=B+(0-M)*R,ee=L+(t-T)*R,Pe=B+(n-M)*R;_.save(),_.beginPath(),_.rect(be,xe,ee-be,Pe-xe),_.clip(),_.textAlign="center",_.textBaseline="middle",_.lineJoin="round";const $=R*.14,F=R-$*2;for(let se=q;se<Z;se++)for(let ce=I;ce<O;ce++){if(ce<0||se<0||ce>=t||se>=n)continue;const U=s(ce,se,i);if(!U||U.lines.length===0)continue;const ne=U.lines.length;let he=1;for(const Fe of U.lines)Fe.length>he&&(he=Fe.length);const ue=F/(ne*1.15),W=F/(he*.62)||ue,de=Math.min(ue,W,24);if(de<6)continue;const me=L+(ce-T+.5)*R,we=B+(se-M+.5)*R,fe=de*1.15,De=U.luminance<=.55,$e=De?"#ffffff":"#000000";_.font=`${de}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.lineWidth=Math.max(1.4,de*.16),_.strokeStyle=De?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Ze=we-ne*fe/2+fe/2;for(let Fe=0;Fe<U.lines.length;Fe++){const V=U.lines[Fe];_.strokeText(V,me,Ze),_.fillStyle=((J=U.colors)==null?void 0:J[Fe])??$e,_.fillText(V,me,Ze),Ze+=fe}}_.restore()},[e,t,n,s,i,E,u]);return c.useEffect(()=>{v()},[v,r,o.x,o.y,l,i,u,h]),c.useEffect(()=>{const S=p.current;if(!S)return;const m=new ResizeObserver(()=>v());return m.observe(S),()=>m.disconnect()},[v]),d.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function ir({notation:e,onChange:t,className:n=""}){return d.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Us=`
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
// Logical binding 7 (uniform f32: PEAK white, ×SDR white — for the extended
// roll-off operators extended-reinhard(5)/extended-aces(6)) -> native binding
// 7*3+2 = 23. Defaults to 0 when the caller omits it (zero-filled); the engine
// always writes EXTENDED_TONEMAP_PEAK_DEFAULT (4), and the roll-off curves guard
// peak<=0 anyway.
@group(0) @binding(23) var<uniform> u_bind7: f32;

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

// --- HDR-out roll-off operators (peak-parameterized) — ported verbatim from
// image/tonemap.ts's extendedReinhardCurve / extendedAcesCurve. ---

// Extended Reinhard with display peak P: y = x/(1 + x/P) — identity slope at
// 0, asymptote P. Mirrors image/tonemap.ts's extendedReinhardCurve exactly
// (see its doc for why the SDR white-point form x*(1+x/P^2)/(1+x) is wrong
// for extended output: it targets x=P -> 1 and darkens the midrange).
fn extendedReinhardCurve(x: f32, peak: f32) -> f32 {
  let v = max(x, 0.0);
  let p = max(peak, 1e-6);
  return v / (1.0 + v / p);
}

// The reciprocal of acesCurve's slope at 0 (0.03/0.14) — makes the low-x slope
// of extendedAcesCurve exactly 1 (identity-like). Matches ACES_IDENTITY_SCALE.
const ACES_IDENTITY_SCALE: f32 = 0.14 / 0.03;

// ACES fit rescaled to the peak: y = P * acesCurve(x * S / P). Saturates at P.
fn extendedAcesCurve(x: f32, peak: f32) -> f32 {
  let v = max(x, 0.0);
  let p = max(peak, 1e-6);
  return p * acesCurve((v * ACES_IDENTITY_SCALE) / p);
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

// operatorId: 0=linear, 1=srgb, 2=reinhard, 3=aces, 4=extended (Extended·Linear),
// 5=extended-reinhard, 6=extended-aces (matches OPERATOR_ID in image-engine.ts /
// TONEMAP_OPERATORS + the extended curves in image/tonemap.ts). linear/srgb are
// the SAME clamp — the sRGB OETF lives in outputEncodeF, not here. 4 (extended)
// is a pure identity — no compression, no clamp — deliberately preserving values
// above 1.0 for a real HDR (hdrOut) target. 5/6 are the peak-parameterized HDR
// roll-off operators (see image/tonemap.ts's doc comments).
fn applyOperator(rgb: vec3<f32>, operatorId: i32, peak: f32) -> vec3<f32> {
  if (operatorId == 2) {
    return vec3<f32>(reinhardCurve(rgb.x), reinhardCurve(rgb.y), reinhardCurve(rgb.z));
  }
  if (operatorId == 3) {
    return vec3<f32>(acesCurve(rgb.x), acesCurve(rgb.y), acesCurve(rgb.z));
  }
  if (operatorId == 4) {
    return rgb;
  }
  if (operatorId == 5) {
    return vec3<f32>(extendedReinhardCurve(rgb.x, peak), extendedReinhardCurve(rgb.y, peak), extendedReinhardCurve(rgb.z, peak));
  }
  if (operatorId == 6) {
    return vec3<f32>(extendedAcesCurve(rgb.x, peak), extendedAcesCurve(rgb.y, peak), extendedAcesCurve(rgb.z, peak));
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
  let peak = u_bind7;

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

  // 3) tone-map operator: HDR [0,inf) -> display-linear [0,1] (or [0,peak] for
  //    the extended roll-off operators, which stay HDR-out).
  rgb = applyOperator(rgb, operatorId, peak);

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
`,Ve=`
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
`,mt=`
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
`,yt=`
fn mapSample(
  tex: texture_2d<f32>, resultPx: vec2<i32>,
  offX: f32, offY: f32, resW: f32, resH: f32, fitFill: f32,
) -> vec4<f32> {
  let dims = vec2<i32>(textureDimensions(tex));
  if (fitFill > 0.5) {
    let uv = (vec2<f32>(resultPx) + vec2<f32>(0.5)) / vec2<f32>(resW, resH);
    return sampleBilinearOf(tex, uv, vec2<f32>(dims));
  }
  let off = vec2<i32>(i32(round(offX)), i32(round(offY)));
  let p = clamp(resultPx + off, vec2<i32>(0), dims - vec2<i32>(1));
  return textureLoad(tex, p, 0);
}
`,Gs=`
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
`,Bt=`
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
`;function ar(e){return`
${Ve}
${mt}
${Gs}

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
`}const zs=ar("select(colorB, colorA, uv.x < split)"),Vs=ar("mix(colorA, colorB, alpha)");function $s(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function cr(e,t,n){const{v:r,h:o}=$s(n),s=e.w-t.w,i=e.h-t.h,l=o==="left"?0:o==="right"?s:Math.floor(s/2),a=r==="top"?0:r==="bottom"?i:Math.floor(i/2);return{x:l,y:a}}function Et(e,t,n,r,o="b"){if(r==="fill"){const i=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:i,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const s={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:s,offsetA:cr(e,s,n),offsetB:cr(t,s,n)}}function mn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const gn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6},lr=new WeakMap;function Xs(e,t){let n=lr.get(e);n||(n=new Map,lr.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Us,targetFormat:t}),n.set(t,r)),r}function ur(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function fr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ws(e,t,n,r){var S;const o=ur(t),s=Xs(e,o),i=fr(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,a=gn[r.operator]??gn.srgb,u=new Float32Array([r.exposureEV,a,l,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),w=new Float32Array([r.offset??0]),E=new Float32Array([r.peak??Pt]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:i},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:w}},{binding:7,resource:{uniform:E}}]),e.renderFullscreen(t,s,v)}finally{(S=v==null?void 0:v.destroy)==null||S.call(v),i.destroy()}}const dr=new WeakMap;function Hs(e,t,n){let r=dr.get(e);r||(r=new Map,dr.set(e,r));const o=`${t}:${n}`;let s=r.get(o);return s||(s=e.createRenderPipeline({shaderWGSL:t==="split"?zs:Vs,targetFormat:n}),r.set(o,s)),s}function Ys(e,t,n,r,o){var v;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const s=ur(t),i=Hs(e,o.mode,s),l=fr(e,void 0),a=o.gamma,u=gn[o.operator],p=new Float32Array([o.exposureEV,u,a,0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),w=new Float32Array([o.offset??0,0,0,0]);let E;try{E=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:w}}]),e.renderFullscreen(t,i,E)}finally{(v=E==null?void 0:E.destroy)==null||v.call(E),l.destroy()}}function pr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,s=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:s,mae:o}}async function hr(e,t,n,r){const o=r??Et({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,i=o.result.h,l=s*i*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:x,sumAbs:b}=await e.reduceDiffSumSquaredAbs(t,n,s,i);return pr(x,b,l)}const u=await e.readback(t),p=await e.readback(n),g=u instanceof Uint8Array?255:1,h=p instanceof Uint8Array?255:1,w=Ot(u,t.width,t.height,g,o.offsetA,o.fit==="fill",s,i),E=Ot(p,n.width,n.height,h,o.offsetB,o.fit==="fill",s,i);let v=0,S=0;const m=[0,0,0],f=[0,0,0];for(let x=0;x<i;x++)for(let b=0;b<s;b++){w(b,x,m),E(b,x,f);for(let _=0;_<3;_++){const y=m[_]-f[_];v+=y*y,S+=Math.abs(y)}}return pr(v,S,l)}function Ot(e,t,n,r,o,s,i,l){const a=(g,h,w)=>e[(h*t+g)*4+w]??0;if(!s)return(g,h,w)=>{const E=Math.min(Math.max(g+o.x,0),t-1),v=Math.min(Math.max(h+o.y,0),n-1);w[0]=a(E,v,0)/r,w[1]=a(E,v,1)/r,w[2]=a(E,v,2)/r};const u=t-1,p=n-1;return(g,h,w)=>{const E=(g+.5)/i,v=(h+.5)/l,S=E*t-.5,m=v*n-.5,f=Math.floor(S),x=Math.floor(m),b=S-f,_=m-x,y=Math.min(Math.max(f,0),u),k=Math.min(Math.max(f+1,0),u),T=Math.min(Math.max(x,0),p),M=Math.min(Math.max(x+1,0),p);for(let P=0;P<3;P++){const D=a(y,T,P),R=a(k,T,P),A=a(y,M,P),X=a(k,M,P),L=D+(R-D)*b,B=A+(X-A)*b;w[P]=(L+(B-L)*_)/r}}}function mr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Ks=12,rt=[];function gr(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1),rt.push(e)}function qs(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1)}function It(e){e.parked||(qs(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function xr(e){for(;rt.length>Ks;){const t=rt.find(n=>n!==e&&!n.visible)??rt.find(n=>n!==e);if(!t)break;It(t)}}function br(e){var o,s,i,l;if(e.disposed)return;if(mr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){gr(e),xr(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((s=e.deep)==null?void 0:s.width)||1,r=e.backingHeight||((i=e.source)==null?void 0:i.height)||((l=e.deep)==null?void 0:l.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const a=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=a,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,a,e.deepZNear,e.deepZFar)}else if(e.source){const a=t.createTexture(e.source.width,e.source.height,e.source.format);a.write(e.source.data),e.srcTexture=a}e.parked=!1,gr(e),xr(e)}function Zs(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return br(e),!e.surface||!e.srcTexture?!1:(Ws(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,It(e),!1}}function js(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Zs(e,t)},park(){e.disposed||It(e)},restore(){e.disposed||!e.source&&!e.deep||br(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(It(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function Qs(e,t){const n=await Tt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return js(r)}function vr(e){e.dispose()}function Js(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:s}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...s?["invert(1)"]:[]].join(" ")}function wr(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:s,exposure:i,offset:l,flipSign:a}=e,u=c.useMemo(()=>Js(e,n),[n,r,o,i,a]);return{gammaFilterId:n,filterStr:u,gamma:s,offset:l}}function yr({id:e,gamma:t,offset:n}){return d.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:d.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:d.jsxs("feComponentTransfer",{children:[d.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),d.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),d.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const ei={x:0,y:0,w:1,h:1};function xn(e){const t=e.sourceWindow??ei,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,s=t.h*e.naturalHeight,i=Math.min(e.box.width/o,e.box.height/s),l=o*i,a=s*i;return{scale:i,imgLeft:e.box.left+(e.box.width-l)/2,imgTop:e.box.top+(e.box.height-a)/2,srcOriginX:n,srcOriginY:r}}function ti(e){return xn(e).scale}function Er(e,t,n){const r=xn(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function _r(e,t,n){const r=xn(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function ni(e,t){const n=_r(e.x0,e.y0,t),r=_r(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}const Nt=(e,t,n)=>Math.max(t,Math.min(n,Math.floor(e)));function Mr(e,t,n,r,o){const s=Er(e,t,o),i=Er(n,r,o),l=o.naturalWidth-1,a=o.naturalHeight-1,u=Math.min(s.x,i.x),p=Math.max(s.x,i.x),g=Math.min(s.y,i.y),h=Math.max(s.y,i.y);return p<0||u>l||h<0||g>a?null:{x0:Nt(u,0,l),y0:Nt(g,0,a),x1:Nt(p,0,l),y1:Nt(h,0,a)}}const ri=["nw","n","ne","e","se","s","sw","w"],bt=(e,t,n)=>e<t?t:e>n?n:e;function oi(e,t,n,r,o,s=1){const i=o.w-1,l=o.h-1,a=Math.round(n),u=Math.round(r);if(t==="move"){const f=e.x1-e.x0,x=e.y1-e.y0,b=bt(e.x0+a,0,i-f),_=bt(e.y0+u,0,l-x);return{x0:b,y0:_,x1:b+f,y1:_+x}}let{x0:p,y0:g,x1:h,y1:w}=e;const E=t==="nw"||t==="w"||t==="sw",v=t==="ne"||t==="e"||t==="se",S=t==="nw"||t==="n"||t==="ne",m=t==="sw"||t==="s"||t==="se";return E&&(p=bt(p+a,0,h-(s-1))),v&&(h=bt(h+a,p+(s-1),i)),S&&(g=bt(g+u,0,w-(s-1))),m&&(w=bt(w+u,g+(s-1),l)),{x0:p,y0:g,x1:h,y1:w}}function Sr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function si({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Sr(e),s=Sr(t),i=[];for(let f=0;f<=e;f+=o)i.push(f);const l=[];for(let f=0;f<=t;f+=s)l.push(f);const a=1/n,u=8*a,p=-12*a,g=-2*a,h=r==null?void 0:r.current;let w=0,E=0,v=0,S=0;if(h){const f=h.clientWidth,x=h.clientHeight,b=f/e,_=x/t,y=Math.min(b,_);v=e*y,S=t*y,w=(f-v)/2,E=(x-S)/2}const m=h&&v>0;return d.jsxs(d.Fragment,{children:[d.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?E:0,transform:`translateY(${p}px)`,fontSize:u},children:i.map(f=>d.jsx("span",{className:"mono",style:{position:"absolute",left:m?w+f/e*v:`${f/e*100}%`,transform:"translateX(-50%)"},children:f},f))}),d.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?w:0,transform:`translateX(${g}px)`,fontSize:u},children:l.map(f=>d.jsx("span",{className:"mono",style:{position:"absolute",top:m?E+f/t*S:`${f/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*a}px`},children:f},f))})]})}function ii({label:e,isDraggable:t,onDragStart:n}){return d.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&d.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const ai=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Tr(e,t){const n=getComputedStyle(e),r=ai.map(a=>`${a}:${n.getPropertyValue(a)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const s=e.children,i=t.children,l=Math.min(s.length,i.length);for(let a=0;a<l;a++)Tr(s[a],i[a])}function bn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function vn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function wn(e,t,n,r,o){const s=document.createElement("canvas");s.width=Math.max(1,Math.round(e*n)),s.height=Math.max(1,Math.round(t*n));const i=s.getContext("2d");if(!i)throw new Error("plot-to-png: 2D canvas context unavailable");return i.scale(n,n),r&&(i.fillStyle=r,i.fillRect(0,0,e,t)),o(i),await new Promise((l,a)=>s.toBlob(u=>u?l(u):a(new Error("plot-to-png: toBlob returned null")),"image/png"))}function ci(e,t,n){const r=e.cloneNode(!0);Tr(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),s="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((i,l)=>{const a=new Image;a.onload=()=>i(a),a.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),a.src=s})}async function Pr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,s=(t==null?void 0:t.background)??bn(e);return wn(r,o,vn(t),s,i=>i.drawImage(e,0,0,r,o))}async function li(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,s=(t==null?void 0:t.background)??bn(e);try{return await wn(r,o,vn(t),s,i=>i.drawImage(e,0,0,r,o))}catch(i){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${i instanceof Error?i.message:String(i)})`)}}function ui(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const s=o.getBoundingClientRect(),i=s.width*s.height;i>r&&(r=i,n=o)}return n}async function fi(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),s=o.width||300,i=o.height||150,l=(t==null?void 0:t.background)??bn(e);if(n){const u=n.getBoundingClientRect(),p=await ci(n,u.width||s,u.height||i);return wn(s,i,vn(t),l,g=>{for(const h of r){const w=h.getBoundingClientRect();g.drawImage(h,w.left-o.left,w.top-o.top,w.width,w.height)}g.drawImage(p,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return Pr(r[0],t);const a=ui(e);if(a)return li(a,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function di(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const pi=8;function hi(e,t,n,r=pi){return!(t>0)||!(e>0)?n:e<t+r}function Ar(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function mi(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function gi(e,t){const n=mi(e);return n===null?t:n}function xi(e){return String(e)}const bi={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},vi={boxZoom:d.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:d.jsxs(d.Fragment,{children:[d.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),d.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),d.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),d.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M12 2v20M2 12h20"}),d.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:d.jsxs(d.Fragment,{children:[d.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),d.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:d.jsxs(d.Fragment,{children:[d.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),d.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:d.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:d.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),d.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:d.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:d.jsxs(d.Fragment,{children:[d.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),d.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),d.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:d.jsxs(d.Fragment,{children:[d.jsx("circle",{cx:"12",cy:"12",r:"4"}),d.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M4 7h6M7 4v6"}),d.jsx("path",{d:"M14 17h6"}),d.jsx("path",{d:"M6 20l12-16"})]}),layers:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),d.jsx("path",{d:"M3 13l9 5 9-5"})]})};function Qe({name:e}){return d.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:vi[e]??null})}function Rr({icon:e,label:t,title:n,active:r,disabled:o,onClick:s}){return d.jsx("button",{type:"button",disabled:o,onClick:i=>{i.stopPropagation(),!o&&s()},onPointerDown:i=>i.stopPropagation(),onDoubleClick:i=>i.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?d.jsx("span",{"aria-hidden":"true",children:t}):d.jsx(Qe,{name:e??""})})}function Cr(){return d.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function wi({icon:e,title:t,menu:n}){var S;const{options:r,value:o,onSelect:s}=n,[i,l]=c.useState(!1),[a,u]=c.useState(0),p=c.useRef(null),g=Ar(r,o),h=e?void 0:((S=r[g])==null?void 0:S.label)??"",w=c.useCallback(()=>{l(m=>{const f=!m;return f&&u(g),f})},[g]),E=c.useCallback(m=>{s(m),l(!1)},[s]);c.useEffect(()=>{if(!i)return;const m=x=>{p.current&&!p.current.contains(x.target)&&l(!1)},f=x=>{x.key==="Escape"&&(x.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",f,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",f,!0)}},[i]);const v=m=>{if(!i){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),u(g),l(!0));return}if(m.key==="ArrowDown")m.preventDefault(),u(f=>(f+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),u(f=>(f-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const f=r[a];f&&E(f.id)}};return d.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[d.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),w()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:v,"aria-haspopup":"listbox","aria-expanded":i,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",i?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?d.jsx("span",{"aria-hidden":"true",children:h}):d.jsx(Qe,{name:e??""}),d.jsx(Qe,{name:"caret"})]}),i&&d.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,f)=>{const x=m.id===o,b=f===a;return d.jsx("li",{role:"option","aria-selected":x,children:d.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),E(m.id)},onPointerEnter:()=>u(f),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",b?"bg-bg-hover":"",x?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const yi=e=>e.format?e.format(e.value):String(e.value);function kr({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),s=c.useRef(null),i=c.useCallback(()=>{o(xi(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&s.current&&(s.current.focus(),s.current.select())},[t]);const l=c.useCallback(()=>{n(u=>(u&&e.onChange(gi(r,e.value)),!1))},[r,e]),a=c.useCallback(()=>n(!1),[]);return d.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||i()},children:[e.icon?d.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:d.jsx(Qe,{name:e.icon})}):d.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?d.jsx("input",{ref:s,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),l()):u.key==="Escape"&&(u.preventDefault(),a())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):d.jsxs(d.Fragment,{children:[d.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),d.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:yi(e)})]})]})}function Ei({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:s,onSelect:i}=n,[l,a]=c.useState(!1),u=Ar(o,s),p=((g=o[u])==null?void 0:g.label)??"";return d.jsxs("div",{children:[d.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:h=>{h.stopPropagation(),a(w=>!w)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?d.jsx(Qe,{name:e}):d.jsx("span",{className:"w-[13px]"}),d.jsx("span",{className:"flex-1",children:t}),d.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),d.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:d.jsx(Qe,{name:"caret"})})]}),l&&o.map(h=>{const w=h.id===s;return d.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":w,"data-menu-option":"",onClick:E=>{E.stopPropagation(),i(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",w?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[d.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:w?"✓":""}),d.jsx("span",{children:h.label})]},h.id)})]})}function _i({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),s=c.useRef(null);return c.useEffect(()=>{if(!r)return;const i=a=>{s.current&&!s.current.contains(a.target)&&o(!1)},l=a=>{a.key==="Escape"&&(a.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",i,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",i,!0),document.removeEventListener("keydown",l,!0)}},[r]),d.jsxs("div",{ref:s,className:"relative inline-flex",onPointerDown:i=>i.stopPropagation(),children:[d.jsx("button",{type:"button",onClick:i=>{i.stopPropagation(),o(l=>!l)},onDoubleClick:i=>i.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:d.jsx(Qe,{name:"ellipsis"})}),r&&d.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(i=>i.menu?d.jsx(Ei,{icon:i.icon,title:i.title,menu:i.menu,onClose:()=>o(!1)},i.id):d.jsxs("button",{type:"button",disabled:i.disabled,onClick:l=>{var a;l.stopPropagation(),!i.disabled&&((a=i.onClick)==null||a.call(i),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",i.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",i.active?"text-accent":""].join(" "),children:[i.icon?d.jsx(Qe,{name:i.icon}):d.jsx("span",{className:"w-[13px]"}),d.jsx("span",{children:i.label??i.title})]},i.id)),t.length>0&&e.length>0&&d.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(i=>d.jsxs("button",{type:"button",role:"menuitem",disabled:i.disabled,onClick:l=>{l.stopPropagation(),!i.disabled&&(i.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",i.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",i.active?"text-accent":""].join(" "),children:[i.icon?d.jsx(Qe,{name:i.icon}):d.jsx("span",{className:"w-[13px]"}),d.jsx("span",{children:i.title})]},i.id)),n.length>0&&(e.length>0||t.length>0)&&d.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(i=>d.jsx("div",{className:"px-2 py-1",children:d.jsx(kr,{spec:i})},i.id))]})]})}function Mi({controller:e,config:t}){var D,R;const n=c.useRef(null),[r,o]=c.useState(!1),s=c.useRef(r);s.current=r;const i=c.useRef(0),l=`${((D=t==null?void 0:t.leadingButtons)==null?void 0:D.length)??0}:${((R=t==null?void 0:t.sliders)==null?void 0:R.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const A=n.current,X=A==null?void 0:A.parentElement;if(!X)return;const L=()=>{const q=X.clientWidth;if(!s.current&&n.current){const Z=n.current.scrollWidth;Z>0&&(i.current=Z)}o(hi(q,i.current,s.current))};let B=0;const I=()=>{B||(B=requestAnimationFrame(()=>{B=0,L()}))},O=new ResizeObserver(I);return O.observe(X),L(),()=>{O.disconnect(),B&&cancelAnimationFrame(B)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const a=e.capabilities,u=t==null?void 0:t.buttons,p=(A,X)=>X&&(u==null?void 0:u[A])!==!1,g=A=>()=>e.setDragMode(A),h=()=>{e.toPNG({filename:"plot"}).then(A=>di(A,"plot.png")).catch(()=>{})},w=[];p("zoom",a.zoom)&&w.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),p("pan",a.pan)&&w.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),p("select",a.select)&&w.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),p("lasso",a.lasso)&&w.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const E=[];p("zoomIn",a.zoom)&&E.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",a.zoom)&&E.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const v=[];p("autoscale",a.autoscale)&&v.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",a.reset)&&v.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const S=[];p("screenshot",a.screenshot)&&S.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[w,E,v,S].filter(A=>A.length>0),f=m.flat(),x=(t==null?void 0:t.leadingButtons)??[],b=(t==null?void 0:t.sliders)??[];if(!x.length&&f.length===0&&b.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",k=_==="top-right"||_==="bottom-right",M=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),P={position:"absolute",pointerEvents:"auto",...bi[_]};return r?d.jsx("div",{ref:n,style:P,className:`${M} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:d.jsx(_i,{actions:f,leading:x,sliders:b})}):d.jsxs("div",{ref:n,style:P,className:`${M} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[d.jsxs("div",{className:`flex items-center gap-0.5 ${k?"justify-end":"justify-start"}`,children:[x.length>0&&d.jsxs(d.Fragment,{children:[x.map(A=>A.menu?d.jsx(wi,{icon:A.icon,title:A.title,menu:A.menu},A.id):d.jsx(Rr,{icon:A.icon,label:A.label,title:A.title,active:A.active,disabled:A.disabled,onClick:A.onClick??(()=>{})},A.id)),m.length>0&&d.jsx(Cr,{})]}),m.map((A,X)=>d.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[X>0&&d.jsx(Cr,{}),A.map(L=>d.jsx(Rr,{icon:L.icon,title:L.title,active:L.active,disabled:L.disabled,onClick:L.onClick},L.id))]},A[0].id))]}),b.length>0&&d.jsx("div",{className:`flex items-center gap-2 ${k?"justify-end":"justify-start"}`,children:b.map(A=>d.jsx(kr,{spec:A},A.id))})]})}const Si={zoom:1,pan:{x:0,y:0}},Dr=1.3,Ti=.25,Pi=64,Ai={buttons:{zoom:!1}};function Ri(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Ci=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function yn(e,t){return{id:"colormap",title:"Colormap",menu:{options:Ci,value:e,onSelect:t}}}const Lr=[{id:"linear",label:"Linear"},{id:"srgb",label:"sRGB"},{id:"reinhard",label:"Reinhard"},{id:"aces",label:"ACES"}],ki=[{id:"extended",label:"Extended · Linear"},{id:"extended-reinhard",label:"Extended · Reinhard"},{id:"extended-aces",label:"Extended · ACES"}];function Br(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...Lr,...ki]:Lr,value:e,onSelect:t}}}function Di({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:s,naturalHeight:i,minZoom:l=Ti,maxZoom:a=Pi,requestRender:u,onReset:p,extraModified:g=!1}){const h=c.useCallback(y=>{var B;if(!o)return;const k=(B=e.current)==null?void 0:B.getBoundingClientRect(),T=(k==null?void 0:k.width)??0,M=(k==null?void 0:k.height)??0,P=s&&i&&T>0&&M>0?un(s,i,T,M):a,D=Math.max(l,Math.min(P,n*y));if(D===n)return;const R=T/2,A=M/2,X=R-(R-r.x)/n*D,L=A-(A-r.y)/n*D;o({zoom:D,pan:{x:X,y:L}})},[o,e,s,i,a,l,n,r.x,r.y]),w=c.useCallback(()=>h(Dr),[h]),E=c.useCallback(()=>h(1/Dr),[h]),v=c.useCallback(()=>{o==null||o(Si),p==null||p()},[o,p]),S=c.useCallback(y=>{const k={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};u==null||u();const T=t==null?void 0:t.current;if(T)return Pr(T,k);const M=e.current;return M?fi(M,k):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),f=n!==1||r.x!==0||r.y!==0||g,x=c.useCallback(y=>{},[]),b=c.useCallback(y=>{},[]),_=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:f,setDragMode:x,setHoverMode:b,toggleSpikelines:_,zoomIn:w,zoomOut:E,autoscale:v,reset:v,toPNG:S}),[m,f,x,b,_,w,E,v,S])}const Li={zoom:1,pan:{x:0,y:0}};function Ft({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:s,pan:i,onViewportChange:l,naturalDims:a,checkerboard:u,wrapperClassName:p,wrapperStyle:g,viewportPadding:h,header:w,surface:E,showAxes:v,overlayNode:S,overlay:m,notationSeed:f,exportCanvasRef:x,requestRender:b,leadingMenus:_,displayAdjust:y,depthSliders:k,extraSliders:T,regionSelect:M,onReset:P,extraModified:D,label:R,showLabelChip:A,isDraggable:X=!1,onDragStart:L,extraChips:B}){const[I,O]=c.useState(f),[q,Z]=c.useState(!1),[be,xe]=c.useState(!1),ee="render"in m?null:m,Pe=!!M&&!!ee,{containerProps:$}=or({containerRef:r,zoom:s,pan:i,onViewportChange:l,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h}),F=c.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),P==null||P()},[y,P]),J=c.useCallback(()=>{l==null||l(Li),F()},[l,F]),se=Di({rootRef:r,canvasRef:x,zoom:s,pan:i,onViewportChange:l,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h,requestRender:b,onReset:F,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!D}),ce=c.useMemo(()=>{const me=[];if(k&&me.push(...k),!y)return T&&me.push(...T),me.length?me:void 0;const we=(fe,De)=>`${fe>=0?"+":"−"}${Math.abs(fe).toFixed(De)}`;return me.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:fe=>we(fe,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:fe=>we(fe,2)}),T&&me.push(...T),me},[y,k,T]),U=c.useMemo(()=>Pe?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:be,onClick:()=>xe(me=>!me)}:null,[Pe,be]),ne=c.useMemo(()=>({...Ai,leadingButtons:[..._??[],...U?[U]:[],...q?[Ri(I,O)]:[]],sliders:ce}),[q,I,_,U,ce]),he=" cairn-checkerboard",ue="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?he:""),W=p+(u==="wrapper"?he:""),de="render"in m?m.render({notation:I,setOverlayActive:Z}):m.hasSource&&a?d.jsx(ht,{imageElRef:m.displayElRef,naturalWidth:a.w,naturalHeight:a.h,zoom:s,pan:i,sourceWindow:m.sourceWindow,sample:m.sample,notation:I,version:m.version,onActiveChange:Z}):null;return d.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[w,n&&d.jsx(Mi,{controller:se,config:ne}),d.jsxs("div",{ref:r,className:ue,style:{padding:h,...$.style},onPointerDown:$.onPointerDown,onPointerMove:$.onPointerMove,onPointerUp:$.onPointerUp,onPointerCancel:$.onPointerCancel,onDoubleClick:J,...t,children:[d.jsxs("div",{ref:o,className:W,style:g,children:[E,v&&a&&d.jsx(si,{naturalWidth:a.w,naturalHeight:a.h,zoom:s,containerRef:o}),S]}),de,!n&&q&&d.jsx(ir,{notation:I,onChange:O}),be&&M&&ee&&a&&d.jsx(Bi,{imageElRef:ee.displayElRef,naturalDims:a,sourceWindow:ee.sourceWindow,onQueryLive:M.queryLive,onSelect:(me,we,fe,De)=>{xe(!1),M.commit(me,we,fe,De)},onExit:()=>xe(!1)}),!be&&(M==null?void 0:M.rect)&&ee&&a&&d.jsx(Ii,{rect:M.rect,imageElRef:ee.displayElRef,naturalDims:a,sourceWindow:ee.sourceWindow,zoom:s,pan:i,onQueryLive:M.queryLive,onCommit:M.commit,onRemove:M.remove})]}),A&&d.jsx(ii,{label:R,isDraggable:X,onDragStart:L}),B]})}function Bi({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:s}){var S;const i=c.useRef(null),l=c.useRef(null),[a,u]=c.useState(null),p=c.useCallback((m,f,x,b)=>{const _=e.current;return _?Mr(m,f,x,b,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);c.useEffect(()=>{const m=f=>{f.key==="Escape"&&s()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[s]);const g=c.useCallback(m=>{var f,x;(x=(f=m.target).setPointerCapture)==null||x.call(f,m.pointerId),l.current={x:m.clientX,y:m.clientY},u({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),h=c.useCallback(m=>{const f=l.current;if(!f)return;u({x0:f.x,y0:f.y,x1:m.clientX,y1:m.clientY});const x=p(f.x,f.y,m.clientX,m.clientY);x&&r(x.x0,x.y0,x.x1,x.y1)},[p,r]),w=c.useCallback(m=>{const f=l.current;l.current=null,u(null);const x=e.current;if(!f||!x){s();return}if(Math.abs(m.clientX-f.x)<3&&Math.abs(m.clientY-f.y)<3){s();return}const b=x.getBoundingClientRect(),_=Mr(f.x,f.y,m.clientX,m.clientY,{box:b,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){s();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,s]),E=(S=i.current)==null?void 0:S.getBoundingClientRect(),v=a&&E?{left:Math.min(a.x0,a.x1)-E.left,top:Math.min(a.y0,a.y1)-E.top,width:Math.abs(a.x1-a.x0),height:Math.abs(a.y1-a.y0)}:null;return d.jsx("div",{ref:i,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:g,onPointerMove:h,onPointerUp:w,children:v&&d.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:v})})}const Oi={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function Ii({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:s,onQueryLive:i,onCommit:l,onRemove:a}){const u=c.useRef(null),[p,g]=c.useState(null),h=c.useRef(null),[w,E]=c.useState(null),v=p??e;c.useLayoutEffect(()=>{const x=()=>{const y=t.current,k=u.current;if(!y||!k)return;const T=y.getBoundingClientRect(),M=k.getBoundingClientRect(),P=ni(v,{box:T,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});E({left:P.left-M.left,top:P.top-M.top,width:P.width,height:P.height})};x();const b=t.current;if(!b||typeof ResizeObserver>"u")return;const _=new ResizeObserver(x);return _.observe(b),()=>_.disconnect()},[v,n.w,n.h,r,o,s.x,s.y]);const S=c.useCallback(x=>b=>{var _,y;b.stopPropagation(),(y=(_=b.target).setPointerCapture)==null||y.call(_,b.pointerId),h.current={handle:x,sx:b.clientX,sy:b.clientY,start:v},g(v)},[v]),m=c.useCallback(x=>{const b=h.current,_=t.current;if(!b||!_)return;const y=ti({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),k=(x.clientX-b.sx)/(y||1),T=(x.clientY-b.sy)/(y||1),M=oi(b.start,b.handle,k,T,{w:n.w,h:n.h},1);g(M),i(M.x0,M.y0,M.x1,M.y1)},[t,n.w,n.h,r,i]),f=c.useCallback(()=>{const x=h.current;h.current=null;const b=p;g(null),x&&b&&l(b.x0,b.y0,b.x1,b.y1)},[p,l]);return w?d.jsxs("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[d.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...w,cursor:"move",touchAction:"none"},onPointerDown:S("move"),onPointerMove:m,onPointerUp:f}),ri.map(x=>{const b=Oi[x];return d.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:w.left+b.fx*w.width-12,top:w.top+b.fy*w.height-12,width:24,height:24,cursor:b.cursor,touchAction:"none"},onPointerDown:S(x),onPointerMove:m,onPointerUp:f,children:d.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},x)}),d.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:w.left+w.width-8,top:w.top-32,width:40,height:40},onPointerDown:x=>x.stopPropagation(),onClick:a,children:d.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):d.jsx("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none"})}const En={inFlight:!1,pending:null};function Or(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function Ir(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:En,launch:null}}const Ni=1e3,Fi=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),Nr=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function Fr(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,s=t!=null,[i,l,a]=dt(r),[u,p,g]=dt(o),[h,w]=c.useState(null),[E,v]=c.useState(null),S=c.useRef(n);S.current=n;const m=c.useRef(r);m.current=r;const f=c.useRef(o);f.current=o;const x=c.useRef(i);x.current=i;const b=c.useRef(u);b.current=u;const _=c.useRef({near:i,far:u,ver:0}),y=c.useRef(0),k=c.useRef(!0),T=c.useRef(En),M=c.useRef(null),P=l,D=p,R=c.useCallback(()=>{const $=S.current;if(!$)return;const{near:F,far:J,ver:se}=_.current,ce=()=>{const U=Ir(T.current);T.current=U.state,U.launch!=null&&R()};$.flatten(F,J).then(U=>{_.current.ver===se&&!k.current&&(M.current!=null&&Nr(M.current),M.current=Fi(()=>{M.current=null,w(U)})),ce()}).catch(ce)},[]),A=c.useCallback(()=>{const $=Or(T.current,1);T.current=$.state,$.launch!=null&&R()},[R]);c.useEffect(()=>()=>{M.current!=null&&Nr(M.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(!n)return;const $=i<=r&&u>=o;if(k.current=$,y.current+=1,_.current={near:i,far:u,ver:y.current},s){t(i,u);return}if($){w(null);return}A()},[n,i,u,r,o,A,s,t]);const X=c.useMemo(()=>n&&!s&&h!=null?{...e,data:h}:e,[e,n,s,h]),L=n!=null&&r>0&&o/r>Ni,B=c.useMemo(()=>{if(!n||!(o>r))return;const $=J=>Math.abs(J)>=1e3||Math.abs(J)<.01&&J!==0?J.toExponential(2):J.toFixed(3),F=(J,se,ce,U,ne)=>{if(L){const he=Math.log10(r),ue=Math.log10(o);return{id:J,icon:"layers",label:se,title:`${ce} (log scale). Double-click to type a Z.`,min:he,max:ue,step:(ue-he)/200,value:Math.log10(Math.max(r,Math.min(U,o))),onChange:W=>ne(10**W),format:W=>$(10**W)}}return{id:J,icon:"layers",label:se,title:`${ce}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:U,onChange:ne,format:$}};return[F("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",i,P),F("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",u,D)]},[n,r,o,i,u,L,P,D]),I=c.useCallback($=>{if($.count===0){const se=m.current,ce=f.current,U=ce>se?0:1;l(ce+U),p(se-U);return}const F=f.current-m.current,J=Math.max(Math.abs(F)*1e-4,1e-4);l($.zMin-J),p($.zMax+J)},[l,p]),O=c.useRef(null),q=c.useRef(En),Z=c.useCallback(()=>{const $=S.current,F=O.current,J=()=>{const se=Ir(q.current);q.current=se.state,se.launch!=null&&Z()};if(!$||!F){J();return}$.zRangeInRect(F.x0,F.y0,F.x1,F.y1).then(se=>{I(se),J()}).catch(J)},[I]),be=c.useCallback(($,F,J,se)=>{O.current={x0:$,y0:F,x1:J,y1:se};const ce=Or(q.current,1);q.current=ce.state,ce.launch!=null&&Z()},[Z]),xe=c.useCallback(($,F,J,se)=>{v({x0:$,y0:F,x1:J,y1:se}),be($,F,J,se)},[be]),ee=c.useCallback(()=>{v(null),a.reset(),g.reset(),w(null)},[a,g]),Pe=c.useCallback(()=>{a.reset(),g.reset(),v(null),w(null)},[a,g]);return{hdr:X,sliders:B,hasDeep:n!=null,region:E,queryRegionWindow:be,commitRegion:xe,removeRegion:ee,reset:Pe,isModified:a.isModified||g.isModified}}function Ur(e){return"hdr"in e&&e.hdr!=null}function Gr(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Oe(e){return Number.isFinite(e)?e:0}const Ui={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Gi(e,t,n,r,o=0){const{h:s,w:i,c:l}=Gr(e.shape),a=e.precision==="f16-bits"?jn(e.data):e.data,u=ss(t),p=new Uint8ClampedArray(i*s*4);for(let g=0;g<i*s;g++){const h=g*l;let w,E,v,S=1;l===1?w=E=v=Oe(a[h]):l===3?(w=Oe(a[h]),E=Oe(a[h+1]),v=Oe(a[h+2])):(w=Oe(a[h]),E=Oe(a[h+1]),v=Oe(a[h+2]),S=Oe(a[h+3]));const m=[At(w,n,o),At(E,n,o),At(v,n,o)],[f,x,b]=u(m),_=g*4;p[_]=255*nn(f,r),p[_+1]=255*nn(x,r),p[_+2]=255*nn(b,r),p[_+3]=255*(S<0?0:S>1?1:S)}return new ImageData(p,i,s)}function zi(e){var Ze,Fe;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:s="auto",colormap:i="none",showAxes:l=!1,processing:a=Ui,zoom:u=1,pan:p={x:0,y:0},onViewportChange:g,onNaturalSize:h,label:w,isDraggable:E=!1,onDragStart:v,overlay:S,overlaySettings:m,pixelValueNotation:f="decimal",toolbar:x=!0}=e,[b,_,y]=dt(i);c.useEffect(()=>{_(i)},[i,_]);const k=c.useRef(null),T=c.useRef(null),M=c.useRef(null),P=c.useRef(null),D=c.useRef(null),R=c.useRef(null),A=c.useRef(null),[X,L]=c.useState(0),B=c.useCallback(()=>L(V=>V+1),[]),I=c.useMemo(()=>({get current(){const V=D.current;return V instanceof HTMLCanvasElement?V:null}}),[]),O=c.useCallback(V=>{k.current=V,V&&(D.current=V)},[]),q=c.useCallback(V=>{T.current=V,V&&(D.current=V)},[]),Z=c.useCallback(V=>{V&&(D.current=V)},[]),[be,xe]=c.useState(!1),[ee,Pe]=c.useState(!1),[$,F]=c.useState(null),{flipSign:J}=a,{gammaFilterId:se,filterStr:ce,gamma:U,offset:ne}=wr(a),he=!r&&o!=="none"&&n!=null&&t!=null,ue=o!=="none"&&n!=null,W=b!=="none"&&!he&&!(r&&ue)&&t!=null;c.useEffect(()=>{if(!W||!t){Pe(!1);return}let V=!1;Pe(!1);const ge=`${t}::${b}`,_e=sn(ge);if(_e){const ae=T.current;if(ae){ae.width=_e.width,ae.height=_e.height;const ve=ae.getContext("2d");ve&&ve.putImageData(_e,0,0),A.current=_e,B(),F({w:_e.width,h:_e.height}),h==null||h(_e.width,_e.height),Pe(!0)}return}const Me=new Image;return Me.onload=()=>{if(V)return;const ae=document.createElement("canvas");ae.width=Me.naturalWidth,ae.height=Me.naturalHeight;const ve=ae.getContext("2d");if(!ve)return;ve.drawImage(Me,0,0);const Ue=ve.getImageData(0,0,ae.width,ae.height),ze=on(b),Se=rn(Ue,b,ze);an(ge,Se);const Ie=T.current;if(!Ie||V)return;Ie.width=Se.width,Ie.height=Se.height;const Re=Ie.getContext("2d");Re&&Re.putImageData(Se,0,0),A.current=Se,B(),F({w:Se.width,h:Se.height}),h==null||h(Se.width,Se.height),Pe(!0)},Me.src=t,()=>{V=!0}},[W,t,b]);const de=c.useCallback((V,ge)=>{F(_e=>_e&&_e.w===V&&_e.h===ge?_e:{w:V,h:ge}),h==null||h(V,ge)},[]);c.useEffect(()=>{if(!t){R.current=null,A.current=null,B();return}let V=!1;return ut(t).then(ge=>{V||(R.current=ge,b==="none"&&(A.current=ge),B())}),()=>{V=!0}},[t,b,B]);const me=c.useCallback((V,ge,_e)=>{const Me=R.current;if(!Me||V<0||ge<0||V>=Me.width||ge>=Me.height)return null;const ae=(ge*Me.width+V)*4,ve=Me.data[ae],Ue=Me.data[ae+1],ze=Me.data[ae+2],Se=A.current;let Ie=ve,Re=Ue,G=ze;if(Se&&Se.width===Me.width&&Se.height===Me.height){const N=(ge*Se.width+V)*4;Ie=Se.data[N],Re=Se.data[N+1],G=Se.data[N+2]}const Y=(.299*Ie+.587*Re+.114*G)/255;return pt(b!=="none"||ve===Ue&&Ue===ze?[ve]:[ve,Ue,ze],"uint8",_e,Y)},[b]);c.useEffect(()=>{if(!he){xe(!1);return}let V=!1;const ge=ws(),_e=ge==="gpu"||ge==="auto",Me=`${n}::${t}::${o}::${b}`;if(ge!=="gpu"){const ae=sn(Me);if(ae){const ve=k.current;if(ve){(ve.width!==ae.width||ve.height!==ae.height)&&(ve.width=ae.width,ve.height=ae.height);const Ue=ve.getContext("2d");Ue&&Ue.putImageData(ae,0,0),de(ae.width,ae.height),xe(!0)}return}}return(async()=>{const[ae,ve]=await Promise.all([ut(n),ut(t)]);if(V||!ae||!ve)return;const ze=o.includes("signed")?"signed":"positive",Se=b!=="none"?Qt(b):null,Ie={diffMode:o,colormap:Se,cmapMode:ze};if(_e)try{const te=k.current;if(te){const N=bs(ae,ve,Ie,te);if(N){if(V)return;de(N.width,N.height),xe(!0);return}}}catch(te){console.warn("[cairn] WebGL 2 diff error:",te)}if(ge==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let Re=fs(ae,ve,o);b!=="none"&&(Re=rn(Re,b,ze)),an(Me,Re);const G=k.current;if(!G||V)return;(G.width!==Re.width||G.height!==Re.height)&&(G.width=Re.width,G.height=Re.height);const Y=G.getContext("2d");Y&&Y.putImageData(Re,0,0),de(Re.width,Re.height),xe(!0)})(),()=>{V=!0}},[n,t,o,he,b,h]);const we=s==="auto"?void 0:s,fe=J?{filter:"invert(1)"}:{},De=S&&(m!=null&&m.enabled)&&$&&t&&((((Ze=S.boxes)==null?void 0:Ze.length)??0)>0||(((Fe=S.masks)==null?void 0:Fe.length)??0)>0)?d.jsx(dn,{data:S,settings:m,naturalWidth:$.w,naturalHeight:$.h}):void 0,$e=t?he?d.jsxs(d.Fragment,{children:[!be&&d.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),d.jsx("canvas",{ref:O,className:"w-full h-full object-contain block",style:{display:be?"block":"none",imageRendering:we,...fe}})]}):W?d.jsxs(d.Fragment,{children:[!ee&&d.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),d.jsx("canvas",{ref:q,className:"w-full h-full object-contain block",style:{display:ee?"block":"none",imageRendering:we,...fe}})]}):d.jsx("img",{ref:Z,src:t,alt:w,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ce,imageRendering:we},onLoad:V=>{const ge=V.currentTarget;F({w:ge.naturalWidth,h:ge.naturalHeight}),h==null||h(ge.naturalWidth,ge.naturalHeight)}}):d.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return d.jsx(Ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:M,wrapperRef:P,zoom:u,pan:p,onViewportChange:g,naturalDims:$,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:l&&$?"16px 4px 4px 28px":"4px",header:d.jsx(yr,{id:se,gamma:U,offset:ne}),surface:$e,showAxes:l,overlayNode:De,overlay:{displayElRef:D,sample:me,version:X,hasSource:!!t},notationSeed:f,exportCanvasRef:I,leadingMenus:[yn(b,V=>_(V))],onReset:y.reset,extraModified:y.isModified,label:w,showLabelChip:!!w,isDraggable:E,onDragStart:v})}function Vi(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:s="",interpolation:i="auto",zoom:l=1,pan:a={x:0,y:0},onViewportChange:u,pixelValueNotation:p="decimal",toolbar:g=!0}=e,h=Fr(e.hdr),w=h.hdr,[E,v,S]=dt(tn(t));c.useEffect(()=>{v(tn(t))},[t,v]);const m=c.useRef(null),f=c.useRef(null),x=c.useRef(null),[b,_]=c.useState(null),y=c.useRef(null),[k,T]=c.useState(0),[M,P]=c.useState(0),[D,R]=c.useState(0);c.useEffect(()=>{const L=m.current;if(!L)return;let B;try{B=Gi(w,E,n+M,r,D)}catch(O){console.error("[cairn] HDR tone-map error:",O);return}(L.width!==B.width||L.height!==B.height)&&(L.width=B.width,L.height=B.height);const I=L.getContext("2d");I&&(I.putImageData(B,0,0),y.current=B,T(O=>O+1),_(O=>O&&O.w===B.width&&O.h===B.height?O:{w:B.width,h:B.height}))},[w,E,n,r,M,D]);const A=c.useCallback((L,B,I)=>{const O=b;if(!O||L<0||B<0||L>=O.w||B>=O.h)return null;const q=w.shape.length===2?1:w.shape[2]??1,Z=(B*O.w+L)*q,be=w.data,xe=w.precision==="f16-bits"?F=>kt(be[F]??0):F=>be[F]??0,ee=y.current;let Pe=.5;if(ee&&ee.width===O.w&&ee.height===O.h){const F=(B*O.w+L)*4;Pe=(.299*ee.data[F]+.587*ee.data[F+1]+.114*ee.data[F+2])/255}const $=q===1?[xe(Z)]:[xe(Z),xe(Z+1),xe(Z+2)];return pt($,"unit",I,Pe)},[w,b]),X=i==="auto"?void 0:i;return d.jsx(Ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:g,paneRef:f,wrapperRef:x,zoom:l,pan:a,onViewportChange:u,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${a.x}px, ${a.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:o&&b?"16px 4px 4px 28px":"4px",surface:d.jsx("canvas",{ref:m,className:"w-full h-full object-contain block",style:{imageRendering:X}}),showAxes:o,overlay:{displayElRef:m,sample:A,version:k,hasSource:!0},notationSeed:p,exportCanvasRef:m,leadingMenus:[Br(E,L=>v(L),!1)],displayAdjust:{exposureEV:M,offset:D,onExposureChange:P,onOffsetChange:R},depthSliders:h.sliders,regionSelect:h.hasDeep?{rect:h.region,queryLive:h.queryRegionWindow,commit:h.commitRegion,remove:h.removeRegion}:void 0,onReset:()=>{h.reset(),S.reset()},extraModified:h.isModified||S.isModified,label:s,showLabelChip:!!s})}function _n(e){return Ur(e)?d.jsx(Vi,{...e}):d.jsx(zi,{...e})}const zr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},$i="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function Xi(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Wi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Hi(e,t){if(e==="no-hdr-display")switch(Wi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=Xi(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Yi(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Vr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const $r=new Set;function Xr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return $r.has(e)}function Ki(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}$r.add(e)}const Wr=new Set;let Ut=null,vt=null;function Hr(){vt&&vt.parentNode&&vt.parentNode.removeChild(vt),vt=null,Ut=null}function qi(e){const t=Vr(e,window.location.pathname),n=Hi(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Yi(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const s=document.createElement("div");s.textContent=n,s.style.marginBottom="4px";const i=document.createElement("a");i.href=$i,i.target="_blank",i.rel="noopener noreferrer",i.textContent="Learn more",Object.assign(i.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{Ki(t),Hr()}),r.appendChild(o),r.appendChild(s),r.appendChild(i),r.appendChild(l),document.body.appendChild(r),vt=r,Ut=e}function Yr(e){if(typeof document>"u"||typeof window>"u"||Wr.has(e))return;Wr.add(e);const t=Vr(e,window.location.pathname);if(Xr(t))return;const n=()=>{if(!Xr(t)){if(Ut!==null)if(zr[e]<zr[Ut])Hr();else return;qi(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Zi={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function ji(e){const{h:t,w:n,c:r}=Gr(e.shape);if(e.precision==="f16-bits"){const i=e.data,l=new Uint16Array(n*t*4);for(let a=0;a<n*t;a++){const u=a*r,p=a*4;if(r===1){const g=i[u];l[p]=g,l[p+1]=g,l[p+2]=g,l[p+3]=Ct}else l[p]=i[u],l[p+1]=i[u+1],l[p+2]=i[u+2],l[p+3]=r>=4?i[u+3]:Ct}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,s=new Float32Array(n*t*4);for(let i=0;i<n*t;i++){const l=i*r;let a,u,p,g=1;r===1?a=u=p=Oe(o[l]):r===3?(a=Oe(o[l]),u=Oe(o[l+1]),p=Oe(o[l+2])):(a=Oe(o[l]),u=Oe(o[l+1]),p=Oe(o[l+2]),g=Oe(o[l+3]));const h=i*4;s[h]=a,s[h+1]=u,s[h+2]=p,s[h+3]=g}return{data:s,width:n,height:t,format:"rgba32float"}}function Kr(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),s=n*o,i=r*o,l=(t.width-s)/2,a=(t.height-i)/2,u=Math.max(e.zoom,1e-6),p=t.width/(u*s),g=t.height/(u*i),h=-l/s-e.pan.x/(u*s),w=-a/i-e.pan.y/(u*i);return{x:h,y:w,w:p,h:g}}function qr(e,t,n,r){const o=e.w*n,s=e.h*r;return o<=0||s<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/s)}function Qi(e){var Se,Ie,Re;const t=Ur(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),s=c.useRef(null),i=c.useRef(null),l=t&&!!((Se=e.hdr)!=null&&Se.deep),a=c.useCallback((G,Y)=>{var te,N;(te=s.current)==null||te.setDeepWindow(G,Y),(N=i.current)==null||N.call(i)},[]),u=Fr(t?e.hdr:Zi,l?a:void 0),p=c.useRef(!1),[g,h]=c.useState(!1),[w,E]=c.useState(!1),[v,S]=c.useState(!1),[m,f]=c.useState(null),[x,b]=c.useState(0),[_,y]=c.useState(0),[k,T]=c.useState({x:0,y:0,w:1,h:1}),M=c.useRef(null),P=c.useRef(null),[D,R]=c.useState(0),A=e.zoom??1,X=e.pan??{x:0,y:0},L=e.onViewportChange,B=t?"none":e.colormap??"none",[I,O]=c.useState(B);c.useEffect(()=>{O(B)},[B]);const q=t?"none":I,Z=c.useRef(B),be=c.useCallback(()=>{O(Z.current)},[]),xe=t?e.tonemap:void 0,[ee,Pe]=c.useState(null);c.useEffect(()=>{Pe(null)},[xe]);const $=is(xe,g),F=ee??$,J=ee!==null&&ee!==$,se=c.useCallback(()=>Pe(null),[]),[ce,U]=c.useState(Pt),ne=ce!==Pt,he=c.useCallback(()=>U(Pt),[]),[ue,W]=c.useState(0),[de,me]=c.useState(0),we=fn();c.useEffect(()=>{const G=n.current;if(!G)return;let Y=!1;return Tt().then(te=>{var Te;if(Y)return;const N=((Te=te.probeExtendedToneMapping)==null?void 0:Te.call(te))??!1,le=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,j=N&&le&&t;p.current=j,h(j),t&&!j&&Yr(N?"no-hdr-display":"no-hdr-browser"),Qs(G,{hdr:j}).then(Le=>{if(Y){vr(Le);return}s.current=Le,S(!0)}).catch(Le=>{Y||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Le),E(!0))})}).catch(te=>{Y||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",te),E(!0))}),()=>{Y=!0,s.current&&(vr(s.current),s.current=null)}},[]),c.useEffect(()=>{const G=r.current;if(!G)return;const Y=new ResizeObserver(()=>y(te=>te+1));return Y.observe(G),()=>Y.disconnect()},[]),c.useEffect(()=>{const G=r.current;if(!G)return;const Y=new IntersectionObserver(te=>{const N=te[0];if(!N)return;const le=s.current;le&&(le.setVisible(N.isIntersecting),N.isIntersecting?le.isParked&&(le.restore(),y(j=>j+1)):le.park())},{threshold:0});return Y.observe(G),()=>Y.disconnect()},[]),c.useEffect(()=>{var te;if(!t||!v||l)return;const G=u.hdr;M.current=G;const Y=ji(G);(te=s.current)==null||te.setSource(Y),f(N=>N&&N.w===Y.width&&N.h===Y.height?N:{w:Y.width,h:Y.height}),R(N=>N+1),b(N=>N+1)},[t,v,l,t?u.hdr:null]),c.useEffect(()=>{if(!t||!v||!l)return;const G=e.hdr,Y=G.deep;M.current=G;let te=!1;return Y.getGpuCsr().then(N=>{var le;te||((le=s.current)==null||le.setDeepSource(N,Y.zMin,Y.zMax),f(j=>j&&j.w===N.width&&j.h===N.height?j:{w:N.width,h:N.height}),R(j=>j+1),b(j=>j+1))}).catch(N=>{te||console.warn("[cairn] deep GPU CSR upload failed:",N)}),()=>{te=!0}},[t,v,l,t?e.hdr.deep:null]),c.useEffect(()=>{if(t||!v)return;const G=e,Y=G.imageUrl,te=I;if(!Y){P.current=null,f(null),R(le=>le+1);return}let N=!1;return ut(Y).then(le=>{var Le,Je;if(N||!le)return;let j=le;if(te!=="none"){const Ae=`gpu::${Y}::${te}::ev${ue}::off${de}`,ke=sn(Ae);if(ke)j=ke;else{const it=on(te);j=rn(le,te,it,ue,de),an(Ae,j)}}P.current=le;const Te={data:j.data,width:j.width,height:j.height,format:"rgba8unorm"};(Le=s.current)==null||Le.setSource(Te),f(Ae=>Ae&&Ae.w===j.width&&Ae.h===j.height?Ae:{w:j.width,h:j.height}),(Je=G.onNaturalSize)==null||Je.call(G,j.width,j.height),R(Ae=>Ae+1),b(Ae=>Ae+1)}),()=>{N=!0}},[t,v,t?null:e.imageUrl,t?null:I,t?0:ue,t?0:de]);const fe=t?e.exposure??0:0,De=t?e.gamma:void 0,$e=c.useCallback(()=>{const G=s.current;if(!G||!v||!m)return;const Y=r.current,te=o.current,N=te?te.getBoundingClientRect():Y?Y.getBoundingClientRect():{width:m.w,height:m.h},le=Kr({zoom:A,pan:X},N,m.w,m.h);T(Ae=>Ae.x===le.x&&Ae.y===le.y&&Ae.w===le.w&&Ae.h===le.h?Ae:le),N.width>0&&N.height>0&&G.resize(Math.round(N.width*we),Math.round(N.height*we));const j=qr(le,N,m.w,m.h)>=pn?"nearest":"linear",Te=le,Le=p.current&&Xn(F),Je=t?{exposureEV:fe+ue,offset:de,operator:F,gamma:De,isScalar:!1,hdrOut:Le,peak:ce,uv:Te,filter:j}:{exposureEV:q!=="none"?0:ue,offset:q!=="none"?0:de,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Te,filter:j};try{G.render(Je)||E(!0)}catch(Ae){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",Ae),E(!0)}},[v,m,A,X.x,X.y,fe,ue,de,F,ce,De,t,q,we]);i.current=$e,c.useEffect(()=>{$e()},[$e,x,_]);const Ze=c.useCallback((G,Y,te)=>{if(t){const ke=M.current,it=m;if(!ke||!it||G<0||Y<0||G>=it.w||Y>=it.h)return null;const gt=ke.shape.length===2?1:ke.shape[2]??1,et=(Y*it.w+G)*gt,Be=ke.data,at=ke.precision==="f16-bits"?lt=>kt(Be[lt]??0):lt=>Be[lt]??0,ct=.5,Ht=gt===1?[at(et)]:[at(et),at(et+1),at(et+2)];return pt(Ht,"unit",te,ct)}const N=P.current;if(!N||G<0||Y<0||G>=N.width||Y>=N.height)return null;const le=(Y*N.width+G)*4,j=N.data[le],Te=N.data[le+1],Le=N.data[le+2],Je=(.299*j+.587*Te+.114*Le)/255;return pt(q!=="none"||j===Te&&Te===Le?[j]:[j,Te,Le],"uint8",te,Je)},[t,m,q]),Fe=e.showAxes??!1,V=t?e.label??"":e.label,ge=e.interpolation??"auto",_e=ge==="auto"?void 0:ge,Me=t?void 0:e.overlay,ae=t?void 0:e.overlaySettings,ve=t?!1:e.isDraggable??!1,Ue=t?void 0:e.onDragStart;if(w)return t?d.jsx(_n,{...e}):d.jsx(_n,{...e});const ze=Me&&(ae!=null&&ae.enabled)&&m&&((((Ie=Me.boxes)==null?void 0:Ie.length)??0)>0||(((Re=Me.masks)==null?void 0:Re.length)??0)>0)?d.jsx(dn,{data:Me,settings:ae,naturalWidth:m.w,naturalHeight:m.h}):void 0;return d.jsx(Ft,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":v},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:X,onViewportChange:L,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Fe&&m?"16px 4px 4px 28px":0,surface:d.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:_e},"data-gpu-image-canvas":!0}),showAxes:Fe,overlayNode:ze,overlay:{displayElRef:n,sample:Ze,version:D,hasSource:!0,sourceWindow:k},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:$e,leadingMenus:t?[Br(F,G=>Pe(G),g)]:[yn(q,G=>O(G))],displayAdjust:{exposureEV:ue,offset:de,onExposureChange:W,onOffsetChange:me},extraSliders:t&&os(F)?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — HDR roll-off shoulder for the extended Reinhard/ACES operators. Double-click to type a value.",min:Qo,max:Jo,step:es,value:ce,onChange:U,format:G=>`${G.toFixed(1)}×`}]:void 0,depthSliders:u.sliders,regionSelect:l?{rect:u.region,queryLive:u.queryRegionWindow,commit:u.commitRegion,remove:u.removeRegion}:void 0,onReset:()=>{be(),se(),he(),u.reset()},extraModified:I!==Z.current||J||ne||u.isModified,label:V,showLabelChip:!!V,isDraggable:ve,onDragStart:Ue})}const Gt=new Map;function Ke(e){if(Gt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Gt.set(e.id,e)}function ot(e){return Gt.get(e)}function Ji(){return Array.from(Gt.values())}function Zr(e,t){return{...e.params??{},...t??{}}}const ea={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ta={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},na={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},ra={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},oa={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},sa={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},jr=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];aa(jr);const Mn=[1.052156925,1,.91835767],ia=.7;function aa(e){const[t,n,r]=e[0],[o,s,i]=e[1],[l,a,u]=e[2],p=s*u-i*a,g=-(o*u-i*l),h=o*a-s*l,E=1/(t*p+n*g+r*h);return[[p*E,-(n*u-r*a)*E,(n*i-r*s)*E],[g*E,(t*u-r*l)*E,-(t*i-r*o)*E],[h*E,-(t*a-n*l)*E,(t*s-n*o)*E]]}function ca(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Sn=6/29;function Tn(e){return e>Sn**3?Math.cbrt(e):e/(3*Sn*Sn)+4/29}function Qr(e,t,n){const[r,o,s]=ca(jr,e,t,n),i=Tn(r*Mn[0]),l=Tn(o*Mn[1]),a=Tn(s*Mn[2]),u=116*l-16,p=500*(i-l),g=200*(l-a);return[u,.01*u*p,.01*u*g]}function la(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function ua(){const e=Qr(0,1,0),t=Qr(0,0,1);return Math.pow(la(e,t),ia)}const Jr=ua(),fa=.082;function eo(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],s=Math.max(...n,...o),i=Math.ceil(3*Math.sqrt(s/(2*Math.PI**2))*e),l=1/e,a=Math.PI**2,u=[0,0,0];for(let p=-i;p<=i;p++)for(let g=-i;g<=i;g++){const h=(g*l)**2+(p*l)**2;for(let w=0;w<3;w++)u[w]+=t[w]*Math.sqrt(Math.PI/n[w])*Math.exp(-a*h/n[w])+r[w]*Math.sqrt(Math.PI/o[w])*Math.exp(-a*h/o[w])}return{r:i,deltaX:l,sums:u}}function to(e){const t=.5*fa*e,n=Math.ceil(3*t);let r=0,o=0,s=0;for(let i=-n;i<=n;i++)for(let l=-n;l<=n;l++){const a=Math.exp(-(l*l+i*i)/(2*t*t)),u=-l*a,p=(l*l/(t*t)-1)*a;u>0&&(r+=u),p>0?o+=p:s-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:s}}const da=`
${Ve}
${Bt}
${mt}
${yt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,pa=`
${Ve}
${Bt}
${mt}
${yt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,zt=`
${Ve}
${Bt}
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
`,no=`
${Ve}
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
`;function qe(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Vt(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},s=r!=null&&r.fill?1:0;return[qe(e,[o.x,o.y,s,0]),qe(e+1,[n.width,n.height,0,0])]}function $t(e){return[qe(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),qe(2,[e.sums[2],0,0,0])]}function ro(e){return[qe(4,[Jr,e.sd,e.r,e.edgeNorm]),qe(5,[e.pointPos,e.pointNeg,0,0])]}function oo(e,t,n,r,o,s=""){const i=eo(e),l=to(e),a=`ycxczA${s}`,u=`ycxczB${s}`,p=`labA${s}`,g=`labB${s}`,h=`flip${s}`;return{passes:[{name:a,shader:t,inputs:[n],output:a,uniforms:()=>Vt(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>Vt(1,"b",o)},{name:p,shader:zt,inputs:[a],output:p,uniforms:()=>$t(i)},{name:g,shader:zt,inputs:[u],output:g,uniforms:()=>$t(i)},{name:h,shader:no,inputs:[p,g,a,u],output:h,uniforms:()=>ro(l)}],flipRef:h}}const ha={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=oo(t,da,"srcA","srcB",e);return{passes:n,final:r}}},ma={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=oo(t,pa,"srcA","srcB",e);return{passes:n,final:r}}},so=`
${Ve}
${Bt}
${mt}
${yt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_exp: vec4<f32>; // exposure (c_i), 0, 0, 0
@group(0) @binding(8) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(11) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0

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
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z).rgb;
  let scale = exp2(u_exp.x);
  let x = scale * s;
  let tm = vec3<f32>(aces(x.r), aces(x.g), aces(x.b));
  return vec4<f32>(flip_linrgb2ycxcz(tm), 1.0);
}
`,ga=`
${Ve}
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
`,xa={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),s=(r-n)/Math.max(o-1,1),i=eo(t),l=to(t),a=[];let u=null;for(let p=0;p<o;p++){const g=n+p*s,h=`_e${p}`,w=`ycxczA${h}`,E=`ycxczB${h}`,v=`labA${h}`,S=`labB${h}`,m=`acc${h}`;a.push({name:w,shader:so,inputs:["srcA"],output:w,uniforms:()=>[qe(1,[g,0,0,0]),...Vt(2,"a",e)]},{name:E,shader:so,inputs:["srcB"],output:E,uniforms:()=>[qe(1,[g,0,0,0]),...Vt(2,"b",e)]},{name:v,shader:zt,inputs:[w],output:v,uniforms:()=>$t(i)},{name:S,shader:zt,inputs:[E],output:S,uniforms:()=>$t(i)}),u===null?a.push({name:m,shader:no,inputs:[v,S,w,E],output:m,uniforms:()=>ro(l)}):a.push({name:m,shader:ga,inputs:[v,S,w,E,u],output:m,uniforms:()=>[qe(5,[Jr,l.sd,l.r,l.edgeNorm]),qe(6,[l.pointPos,l.pointNeg,0,0])]}),u=m}return{passes:a,final:u}}},io=.01,ao=.03,Xt=1,Pn=1.5,st=5,An=[.2126,.7152,.0722];function Rn(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function co(e,t,n){const r=An[0]*Rn(e)+An[1]*Rn(t)+An[2]*Rn(n);return Math.min(1,Math.max(0,r))}function ba(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let s=-t,i=0;s<=t;s++,i++){const l=Math.exp(-.5*s*s/(e*e));r[i]=l,o+=l}for(let s=0;s<n;s++)r[s]=r[s]/o;return r}function lo(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const uo=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),Cn=64;async function _t(e,t,n,r,o,s){const i=new Float64Array(t*n);for(let a=0;a<n;a++){for(let u=0;u<t;u++){let p=0;for(let g=-o,h=0;g<=o;g++,h++)p+=r[h]*e[a*t+lo(u+g,t)];i[a*t+u]=p}(a+1)%Cn===0&&await s()}const l=new Float64Array(t*n);for(let a=0;a<n;a++){for(let u=0;u<t;u++){let p=0;for(let g=-o,h=0;g<=o;g++,h++)p+=r[h]*i[lo(a+g,n)*t+u];l[a*t+u]=p}(a+1)%Cn===0&&await s()}return l}async function va(e,t,n,r,o=uo){const s=n*r;if(s<=0)return NaN;const i=ba(Pn,st),l=new Float64Array(s),a=new Float64Array(s),u=new Float64Array(s);for(let f=0;f<s;f++)l[f]=e[f]*e[f],a[f]=t[f]*t[f],u[f]=e[f]*t[f];const p=await _t(e,n,r,i,st,o),g=await _t(t,n,r,i,st,o),h=await _t(l,n,r,i,st,o),w=await _t(a,n,r,i,st,o),E=await _t(u,n,r,i,st,o),v=(io*Xt)**2,S=(ao*Xt)**2;let m=0;for(let f=0;f<s;f++){const x=h[f]-p[f]*p[f],b=w[f]-g[f]*g[f],_=E[f]-p[f]*g[f],y=2*p[f]*g[f]+v,k=2*_+S,T=p[f]*p[f]+g[f]*g[f]+v,M=x+b+S;m+=y*k/(T*M)}return m/s}const fo=`
${Ve}

fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

${mt}
${yt}
@group(0) @binding(0) var srcA: texture_2d<f32>;
@group(0) @binding(3) var srcB: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_map: vec4<f32>;  // offAx, offAy, offBx, offBy
@group(0) @binding(11) var<uniform> u_res: vec4<f32>; // resultW, resultH, fitFill, 0
fn ssim_moment_luma(in: VSOut) -> vec2<f32> {
  let px = vec2<i32>(in.position.xy);
  let a = mapSample(srcA, px, u_map.x, u_map.y, u_res.x, u_res.y, u_res.z);
  let b = mapSample(srcB, px, u_map.z, u_map.w, u_res.x, u_res.y, u_res.z);
  return vec2<f32>(ssim_luma(a.rgb), ssim_luma(b.rgb));
}
`,wa=`
${fo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,ya=`
${fo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,po=`
${Ve}
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
`,Ea=`
${Ve}
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
`;function Mt(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function ho(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[Mt(2,[n.x,n.y,r.x,r.y]),Mt(3,[e.width,e.height,o,0])]}function mo(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:po,inputs:[e],output:n,uniforms:()=>[Mt(1,[1,0,st,Pn])]},{name:r,shader:po,inputs:[n],output:r,uniforms:()=>[Mt(1,[0,1,st,Pn])]}],out:r}}const _a={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(io*Xt)**2,n=(ao*Xt)**2,r=mo("momA","statsA"),o=mo("momB","statsB");return{passes:[{name:"momA",shader:wa,inputs:["srcA","srcB"],output:"momA",uniforms:ho},{name:"momB",shader:ya,inputs:["srcA","srcB"],output:"momB",uniforms:ho},...r.passes,...o.passes,{name:"ssim",shader:Ea,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[Mt(2,[t,n,0,0])]}],final:"ssim"}}};let go=!1;function Ma(){go||(go=!0,Ke(ta),Ke(ea),Ke(na),Ke(oa),Ke(ra),Ke(sa),Ke(ha),Ke(xa),Ke(ma),Ke(_a))}Ma();function xo(){const e=[];for(const n of Ji())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=ot("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Sa(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function Ta(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let s=0;s<r;s++)o+=e[s*4]??0;return 1-o/r}function bo(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const vo=new WeakMap;function Pa(e,t,n){let r=vo.get(e);r||(r=new Map,vo.set(e,r));const o=r.get(t);if(o)return o;const s=n().catch(i=>{throw r.get(t)===s&&r.delete(t),i});return r.set(t,s),s}const wo=new WeakMap;function kn(e,t,n,r){let o=wo.get(e);o||(o=new Map,wo.set(e,o));const s=`${t}::${r}`;let i=o.get(s);return i||(i=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(s,i)),i}function Aa(e){return`
${Ve}
${mt}
${yt}
@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_map: vec4<f32>;  // offAx, offAy, offBx, offBy
@group(0) @binding(11) var<uniform> u_res: vec4<f32>; // resultW, resultH, fitFill, 0
${e}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  // px is the RESULT/overlap-grid pixel. Each source is sampled through the
  // align/fit mapping (integer texel offset per source under crop; normalized-uv
  // bilinear rescale under fill) -- see SOURCE_MAP_WGSL / compare-align.ts.
  let px = vec2<i32>(in.position.xy);
  let a = mapSample(texA, px, u_map.x, u_map.y, u_res.x, u_res.y, u_res.z);
  let b = mapSample(texB, px, u_map.z, u_map.w, u_res.x, u_res.y, u_res.z);
  return kernel(a, b);
}
`}const Wt="rgba16float";function Ra(e,t,n,r,o,s){var S,m;const i=ot(r);if(!i)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=s??Et({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=l.result.w,u=l.result.h,p=l.fit==="fill"?1:0,g=Zr(i,o);if(i.kind==="pointwise"){const f=e.createTexture(a,u,Wt),x=kn(e,`pw:${i.id}`,Aa(i.source),Wt),b=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),_=new Float32Array([a,u,p,0]);let y;try{y=e.createBindGroup(x,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:b}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(f,x,y)}finally{(S=y==null?void 0:y.destroy)==null||S.call(y)}return f}const h={width:a,height:u,params:g,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},w=i.buildPasses(h),E=new Map([["srcA",t],["srcB",n]]),v=[];try{for(const x of w.passes){const b=e.createTexture(a,u,Wt);v.push(b),E.set(x.output,b);const _=kn(e,`mp:${i.id}:${x.name}`,x.shader,Wt),y=x.inputs.map((T,M)=>{const P=E.get(T);if(!P)throw new Error(`computeDiff: pass "${x.name}" input "${T}" not produced yet`);return{binding:M,resource:P}});x.uniforms&&y.push(...x.uniforms(h));let k;try{k=e.createBindGroup(_,y),e.renderFullscreen(b,_,k)}finally{(m=k==null?void 0:k.destroy)==null||m.call(k)}}const f=E.get(w.final);if(!f)throw new Error(`computeDiff: final ref "${w.final}" not produced`);for(const x of v)x!==f&&x.destroy();return f}catch(f){for(const x of v)x.destroy();throw f}}const Ca=8,ka=256*1024*1024;class Da{constructor(t=Ca,n=ka){oe(this,"map",new Map);oe(this,"totalBytes",0);oe(this,"maxEntries");oe(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const yo=new WeakMap;function Eo(e){let t=yo.get(e);return t||(t=new Da,yo.set(e,t)),t}function La(e,t){const n=Zr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Ba(e,t,n,r,o){const s=ot(n),i=s?La(s,r):"",l=o?mn(o):"";return`${e}|${t}|${n}|${i}|${l}`}function _o(e,t,n,r,o,s,i,l){const a=ot(r);if(!a)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=Eo(e),p=l??Et({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),g=Ba(s,i,r,o,p),h=u.get(g);if(h)return h;const w=Ra(e,t,n,r,o,p),E=p.result.w,v=p.result.h,S={texture:w,width:E,height:v,displayRange:a.displayRange,bytes:E*v*8};return u.set(g,S),S}function Oa(e,t,n){return`${e}|${t}|${n?mn(n):""}`}function Ia(e,t,n,r,o,s){return Pa(e,Oa(r,o,s),()=>Na(e,t,n,r,o,s))}async function Na(e,t,n,r,o,s){try{const i=_o(e,t,n,"ssim",void 0,r,o,s);return i.ssimMean!==void 0?i.ssimMean:(i.ssimMeanPending||(i.ssimMeanPending=Mo(e,i).then(l=>{const a=Ta(l,i.width,i.height);return i.ssimMean=a,a})),await i.ssimMeanPending)}catch{return Fa(e,t,n,s)}}async function Fa(e,t,n,r){const o=r??Et({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,i=o.result.h,l=s*i;if(l<=0)return NaN;const a=await e.readback(t),u=await e.readback(n),p=a instanceof Uint8Array?255:1,g=u instanceof Uint8Array?255:1,h=o.fit==="fill",w=Ot(a,t.width,t.height,p,o.offsetA,h,s,i),E=Ot(u,n.width,n.height,g,o.offsetB,h,s,i),v=new Float64Array(l),S=new Float64Array(l),m=[0,0,0],f=[0,0,0];for(let x=0;x<i;x++){for(let b=0;b<s;b++){w(b,x,m),E(b,x,f);const _=x*s+b;v[_]=co(m[0],m[1],m[2]),S[_]=co(f[0],f[1],f[2])}(x+1)%Cn===0&&await uo()}return va(v,S,s,i)}async function Ua(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=hr(e,n,r,o).then(s=>(t.scalars=s,s))),t.scalarsPending)}async function Mo(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Eo(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const Ga=`
${Ve}
${mt}
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
`,za={unit:0,signed:1,relative:2},Va={linear:0,signed:1,positive:2};function $a(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Xa(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Wa(e,t,n,r,o){var w,E,v;const s=Xa(t),i=kn(e,"diff-display",Ga,s),l=$a(e,o.colormap),a=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([za[r],Va[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),g=new Float32Array([((w=o.sourceDims)==null?void 0:w.w)??0,((E=o.sourceDims)==null?void 0:E.h)??0,0,0]);let h;try{h=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:a}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:p}},{binding:5,resource:{uniform:g}}]),e.renderFullscreen(t,i,h)}finally{(v=h==null?void 0:h.destroy)==null||v.call(h),l.destroy()}}const So=.6*.6*2.51,Ha=.6*.03,Ya=0,To=.6*.6*2.43,Ka=.6*.59,qa=.14;function Po(e){const t=(Ha-Ka*e)/(So-To*e),n=(Ya-qa*e)/(So-To*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Za=.85,ja=.85,Ao=11920928955078125e-23,Dn=[.2126,.7152,.0722];function Qa(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Ja(e,t,n,r=3,o={}){const s=t*n,i=Po(Za),l=Po(ja),a=new Float64Array(s);let u=0;for(let f=0;f<s;f++){const[x,b,_]=Qa(e,f,r),y=x*Dn[0]+b*Dn[1]+_*Dn[2];a[f]=y,y>u&&(u=y)}const p=Float64Array.from(a).sort(),g=s>>1,h=s%2===1?p[g]:p[g-1],w=Math.max(h,Ao),E=Math.max(u,Ao),v=o.startExposure??Math.log2(i/E),S=o.stopExposure??Math.log2(l/w),m=Math.max(2,Math.ceil(S-v));return{startExposure:v,stopExposure:S,numExposures:m}}const ec="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",tc="REF";function Ro(){return d.jsx("span",{className:ec,children:tc})}const nc={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function rc({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:s,zoom:i,pan:l,onViewportChange:a,processing:u=nc,interpolation:p="auto",label:g="",isDraggable:h=!1,onDragStart:w,overlay:E,overlaySettings:v,pixelValueNotation:S="decimal"}){var se,ce;const m=c.useRef(null),[f,x]=c.useState(null),[b,_]=c.useState(null),[y,k]=c.useState(S),[T,M]=c.useState(!1),P=c.useRef(null),D=c.useRef(null),R=c.useRef(null),A=c.useRef(null),[X,L]=c.useState(0);c.useEffect(()=>{if(!e){R.current=null,L(ne=>ne+1);return}let U=!1;return ut(e).then(ne=>{U||(R.current=ne,L(he=>he+1))}),()=>{U=!0}},[e]),c.useEffect(()=>{if(!t){A.current=null,L(ne=>ne+1);return}let U=!1;return ut(t).then(ne=>{U||(A.current=ne,L(he=>he+1))}),()=>{U=!0}},[t]);const B=U=>(ne,he,ue)=>{const W=U.current;if(!W||ne<0||he<0||ne>=W.width||he>=W.height)return null;const de=(he*W.width+ne)*4,me=W.data[de],we=W.data[de+1],fe=W.data[de+2],De=(.299*me+.587*we+.114*fe)/255;return me===we&&we===fe?{lines:[xt(me,"uint8",ue)],luminance:De}:{lines:[xt(me,"uint8",ue),xt(we,"uint8",ue),xt(fe,"uint8",ue)],luminance:De,colors:[Lt[0],Lt[1],Lt[2]]}},I=c.useMemo(()=>B(R),[]),O=c.useMemo(()=>B(A),[]),q=!!E&&!!(v!=null&&v.enabled)&&!!f&&!!e&&((((se=E.boxes)==null?void 0:se.length)??0)>0||(((ce=E.masks)==null?void 0:ce.length)??0)>0),{gammaFilterId:Z,filterStr:be,gamma:xe,offset:ee}=wr(u),Pe=`translate(${l.x}px, ${l.y}px) scale(${i})`,$=p==="auto"?void 0:p,{containerProps:F,modifierActive:J}=or({containerRef:m,zoom:i,pan:l,onViewportChange:a});return d.jsxs("div",{className:"relative flex flex-col h-full",children:[d.jsx(yr,{id:Z,gamma:xe,offset:ee}),d.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...F.style},onPointerDown:F.onPointerDown,onPointerMove:F.onPointerMove,onPointerUp:F.onPointerUp,onPointerCancel:F.onPointerCancel,children:[d.jsxs("div",{className:"relative w-full h-full",children:[d.jsxs("div",{className:"relative w-full h-full",style:{transform:Pe,transformOrigin:"0 0"},children:[d.jsx("img",{ref:P,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:be,imageRendering:$,...n==="blend"?{opacity:o}:{}},onLoad:U=>{const ne=U.currentTarget;x({w:ne.naturalWidth,h:ne.naturalHeight})}}),q&&d.jsx(dn,{data:E,settings:v,naturalWidth:f.w,naturalHeight:f.h})]}),d.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:d.jsx("div",{className:"w-full h-full",style:{transform:Pe,transformOrigin:"0 0"},children:d.jsx("img",{ref:D,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:be,imageRendering:$,...n==="blend"?{opacity:1-o}:{}},onLoad:U=>{const ne=U.currentTarget;_({w:ne.naturalWidth,h:ne.naturalHeight})}})})}),n==="split"&&d.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>s==null?void 0:s(.5),onPointerDown:U=>{U.stopPropagation(),U.preventDefault();const ne=U.currentTarget;try{ne.setPointerCapture(U.pointerId)}catch{}const ue=ne.parentElement.getBoundingClientRect(),W=me=>{s==null||s(Math.max(0,Math.min(1,(me.clientX-ue.left)/ue.width)))},de=()=>{window.removeEventListener("pointermove",W),window.removeEventListener("pointerup",de)};window.addEventListener("pointermove",W),window.addEventListener("pointerup",de)},children:d.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?d.jsxs(d.Fragment,{children:[t&&b&&d.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:d.jsx(ht,{imageElRef:D,naturalWidth:b.w,naturalHeight:b.h,zoom:i,pan:l,sample:O,notation:y,version:X})}),e&&f&&d.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:d.jsx(ht,{imageElRef:P,naturalWidth:f.w,naturalHeight:f.h,zoom:i,pan:l,sample:I,notation:y,version:X,onActiveChange:M})})]}):e&&f&&d.jsx(ht,{imageElRef:P,naturalWidth:f.w,naturalHeight:f.h,zoom:i,pan:l,sample:I,notation:y,version:X,onActiveChange:M}),T&&d.jsx(ir,{notation:y,onChange:k})]}),n==="split"&&d.jsx(Ro,{}),d.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!J?" cairn-drag-grip":""}`,draggable:h&&!J,onDragStart:w,style:{cursor:h&&!J?"grab":void 0},children:[d.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),g]})]})}function oc(){return d.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function sc({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:s,onSide:i}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...i?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?i==null||i():u==="slide"?r():u==="blend"?o():s(u)}}}}function ic(e){const t=Qt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function ac(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const a=e.data,u=new Uint16Array(o*4);for(let p=0;p<o;p++){const g=p*r,h=p*4;if(r===1){const w=a[g];u[h]=w,u[h+1]=w,u[h+2]=w,u[h+3]=Ct}else u[h]=a[g],u[h+1]=a[g+1],u[h+2]=a[g+2],u[h+3]=r>=4?a[g+3]:Ct}return{data:u,format:"rgba16float"}}const s=e.data,i=new Float32Array(o*4),l=a=>Number.isFinite(a)?a:0;for(let a=0;a<o;a++){const u=a*r;let p,g,h,w=1;r===1?p=g=h=l(s[u]):r===3?(p=l(s[u]),g=l(s[u+1]),h=l(s[u+2])):(p=l(s[u]),g=l(s[u+1]),h=l(s[u+2]),w=l(s[u+3]));const E=a*4;i[E]=p,i[E+1]=g,i[E+2]=h,i[E+3]=w}return{data:i,format:"rgba32float"}}function cc({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:s,blendAlpha:i,onSplitPositionChange:l,diffSubmode:a,colormap:u="none",align:p="top-left",fit:g="crop",diffKernel:h,onDiffKernelChange:w,onCompareModeChange:E,onRequestSide:v,zoom:S,pan:m,onViewportChange:f,interpolation:x="auto",label:b="",pixelValueNotation:_="decimal"}){var Co;const y=c.useRef(null),k=c.useRef(null),T=c.useRef(null),M=c.useRef(null),P=c.useRef(null),[D,R]=c.useState(!1),[A,X]=c.useState(!1),[L,B]=c.useState(null),[I,O]=c.useState(null),[q,Z]=c.useState(0),[be,xe]=c.useState(0),[ee,Pe]=c.useState(null),[$,F]=c.useState(null),[J,se]=c.useState({x:0,y:0,w:1,h:1}),ce=h??a??"absolute",[U,ne,he]=dt(ce);c.useEffect(()=>{ne(h??a??"absolute")},[h,a,ne]);const ue=c.useCallback(C=>{ne(C),w==null||w(C)},[w,ne]);c.useEffect(()=>{const C=y.current;if(C)return C.__cairnDiffKernel={current:U,set:ue},()=>{C&&delete C.__cairnDiffKernel}},[U,ue]);const[W,de,me]=dt(o);c.useEffect(()=>{de(o)},[o,de]);const we=c.useCallback(C=>{de(C),E==null||E(C)},[E,de]),[fe,De,$e]=dt(u);c.useEffect(()=>{De(u)},[u,De]);const Ze=c.useCallback(()=>{we(me.default),De($e.default),ue(he.default)},[we,De,ue,me.default,$e.default,he.default]),Fe=me.isModified||$e.isModified||he.isModified,[V,ge]=c.useState(0),[_e,Me]=c.useState(0),ae=c.useMemo(()=>{const H=[sc({mode:W,kernel:U,kernelOptions:xo().map(K=>({id:K.id,label:K.label})),onSide:v,onSlide:()=>we("split"),onBlend:()=>we("blend"),onKernel:K=>{we("diff"),ue(K)}})];return W==="diff"&&H.push(yn(fe,K=>De(K))),H},[W,U,fe,ue,we,v]),ve=c.useRef(null),Ue=c.useRef(null),ze=c.useRef(null),Se=c.useRef(null),[Ie,Re]=c.useState(0),G=c.useRef(null),Y=c.useRef(null),[te,N]=c.useState(0),le=fn();c.useEffect(()=>{const C=T.current;if(!C)return;let H=!1;return Tt().then(K=>{if(!H)try{if(mr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const z=K.createSurface(C,{hdr:!1});M.current={device:K,surface:z,texA:null,texB:null},X(!0)}catch(z){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",z),R(!0)}}).catch(K=>{H||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",K),R(!0))}),()=>{var z,re;H=!0;const K=M.current;K&&((z=K.texA)==null||z.destroy(),(re=K.texB)==null||re.destroy(),M.current=null)}},[]),c.useEffect(()=>{const C=y.current;if(!C)return;const H=new ResizeObserver(()=>xe(K=>K+1));return H.observe(C),()=>H.disconnect()},[]),c.useEffect(()=>{if(!A)return;let C=!1;if(!M.current)return;async function K(z,re){if(re){const ye=ac(re);return{width:re.width,height:re.height,imageData:null,make:Ce=>{const pe=Ce.createTexture(re.width,re.height,ye.format);return pe.write(ye.data),pe}}}if(!z)return null;const ie=await ut(z);return ie?{width:ie.width,height:ie.height,imageData:ie,make:ye=>{const Ce=ye.createTexture(ie.width,ie.height,"rgba8unorm");return Ce.write(ie.data),Ce}}:null}return Promise.all([K(e,n),K(t,r)]).then(([z,re])=>{var Ge,Xe;if(C||!M.current)return;const ie=M.current;ve.current=(z==null?void 0:z.imageData)??null,Ue.current=(re==null?void 0:re.imageData)??null,ze.current=n??null,Se.current=r??null,(Ge=ie.texA)==null||Ge.destroy(),(Xe=ie.texB)==null||Xe.destroy(),ie.texA=null,ie.texB=null;const ye=z??re;if(!ye){B(null),O(null),Re(je=>je+1);return}const Ce=re??ye,pe=z??ye;ie.texA=Ce.make(ie.device),ie.texB=pe.make(ie.device),O({a:{w:Ce.width,h:Ce.height},b:{w:pe.width,h:pe.height}}),B({w:ye.width,h:ye.height}),Re(je=>je+1),Z(je=>je+1)}),()=>{C=!0}},[A,e,t,n,r]);const j=n!=null||r!=null,Te=c.useMemo(()=>Sa(U,j),[U,j]),Le=c.useMemo(()=>{if(!j)return null;const C=r??n;if(!C)return null;const H=C.precision==="f16-bits"?jn(C.data):C.data;return Ja(H,C.width,C.height,C.channels)},[j,r,n]),Je=c.useMemo(()=>{var C;return cs(((C=ot(Te))==null?void 0:C.displayRange)??"unit",fe==="none"?null:fe)},[Te,fe]),Ae=c.useMemo(()=>fe!=="none"?ic(fe):void 0,[fe]),ke=c.useMemo(()=>I?Et(I.a,I.b,p,g,"b"):null,[I,p,g]),it=c.useMemo(()=>ke?mn(ke):"none",[ke]),gt=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",et=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Be=c.useMemo(()=>L?W==="diff"&&ke?ke.result:L:null,[W,ke,L]),at=c.useCallback(()=>{const C=M.current;if(!A||!C||!C.surface||!C.texA||!C.texB||!L)return;const H=Be??L,K=y.current,z=K?K.getBoundingClientRect():{width:H.w,height:H.h},re=Kr({zoom:S,pan:m},z,H.w,H.h);se(pe=>pe.x===re.x&&pe.y===re.y&&pe.w===re.w&&pe.h===re.h?pe:re);const ie=T.current;if(z.width>0&&z.height>0&&ie&&C.surface){const pe=Math.max(1,Math.round(z.width*le)),Ge=Math.max(1,Math.round(z.height*le));(ie.width!==pe||ie.height!==Ge)&&(ie.width=pe,ie.height=Ge,C.surface.configure(pe,Ge))}const ye=qr(re,z,H.w,H.h)>=pn?"nearest":"linear",Ce=re;try{if(W==="diff"){const pe=ot(Te)?Te:"absolute",Ge=pe==="hdr-flip"&&Le?{ppd:67,startExposure:Le.startExposure,stopExposure:Le.stopExposure,numExposures:Le.numExposures}:void 0,Xe=_o(C.device,C.texA,C.texB,pe,Ge,gt,et,ke??void 0);P.current=Xe,Wa(C.device,C.surface,Xe.texture,Xe.displayRange,{uv:Ce,cmapMode:Je,colormap:Ae,filter:ye,exposureEV:V,offset:_e})}else{const pe={exposureEV:V,offset:_e,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ce,filter:ye,mode:W,split:s,alpha:i};Ys(C.device,C.surface,C.texA,C.texB,pe)}}catch(pe){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",pe),R(!0)}},[A,L,Be,ke,S,m.x,m.y,W,s,i,V,_e,U,Te,Le,Je,Ae,e,t,n,r,gt,et,le]);c.useEffect(()=>{at()},[at,q,be]);const ct=t!=null||r!=null;c.useEffect(()=>{const C=M.current;if(!A||!C||!C.texA||!C.texB||!ct){Pe(null);return}let H=!1;const K=C.texA,z=C.texB,re=P.current,ie=W==="diff"?ke??void 0:void 0;return(W==="diff"&&re?Ua(C.device,re,K,z,ie):hr(C.device,K,z,ie)).then(Ce=>{H||Pe(Ce)}),()=>{H=!0}},[A,q,ct,W,U,ke]),c.useEffect(()=>{const C=M.current;if(!A||!C||!C.texA||!C.texB||!ct){F(null);return}let H=!1;F(null);const K=W==="diff"?ke??void 0:void 0;return Ia(C.device,C.texA,C.texB,gt,et,K).then(z=>{H||F(z)}).catch(()=>{H||F(null)}),()=>{H=!0}},[A,q,ct,W,it,gt,et]),c.useEffect(()=>{if(W!=="diff"){G.current=null,Y.current=null;return}const C=M.current,H=P.current;if(!A||!C||!H)return;let K=!1;return G.current=null,Y.current=null,N(z=>z+1),Mo(C.device,H).then(z=>{K||(G.current=z,Y.current={w:H.width,h:H.height},N(re=>re+1))}).catch(()=>{}),()=>{K=!0}},[A,W,Te,q,ke]);const Ht=(C,H)=>(K,z,re)=>{const ie=H.current;if(ie){const{data:ko,width:Do,height:pc,channels:Lo}=ie;if(K<0||z<0||K>=Do||z>=pc)return null;const Yt=(z*Do+K)*Lo,Kt=ie.precision==="f16-bits"?On=>kt(ko[On]??0):On=>ko[On]??0,hc=.5,mc=Lo===1?[Kt(Yt)]:[Kt(Yt),Kt(Yt+1),Kt(Yt+2)];return pt(mc,"unit",re,hc)}const ye=C.current;if(!ye||K<0||z<0||K>=ye.width||z>=ye.height)return null;const Ce=(z*ye.width+K)*4,pe=ye.data[Ce],Ge=ye.data[Ce+1],Xe=ye.data[Ce+2],je=(.299*pe+.587*Ge+.114*Xe)/255;return pt(pe===Ge&&Ge===Xe?[pe]:[pe,Ge,Xe],"uint8",re,je)},lt=c.useMemo(()=>Ht(ve,ze),[]),Ln=c.useMemo(()=>Ht(Ue,Se),[]),Bn=c.useMemo(()=>(C,H,K)=>{var je;const z=G.current,re=Y.current;if(!z||!re)return null;const{w:ie,h:ye}=re;if(C<0||H<0||C>=ie||H>=ye)return null;const Ce=(H*ie+C)*4,pe=((je=ot(Te))==null?void 0:je.output)??"per-channel",Ge=.5,Xe=pe==="scalar"?[z[Ce]??0]:[z[Ce]??0,z[Ce+1]??0,z[Ce+2]??0];return pt(Xe,"unit",K,Ge)},[Te]);c.useEffect(()=>{const C=y.current;if(C)return C.__cairnCompareProbe={sampleDiff:(H,K,z="decimal")=>Bn(H,K,z),sampleFg:(H,K,z="decimal")=>lt(H,K,z),sampleRef:(H,K,z="decimal")=>Ln(H,K,z),get diffSamples(){return G.current},get dims(){return Be},get primaryDims(){return L},get diffResultDims(){return Y.current},get align(){return p},get fit(){return g},get resolvedKernelId(){return Te},get compareMode(){return W},get ssimScalar(){return $},get ssimText(){return bo($)}},()=>{C&&delete C.__cairnCompareProbe}},[Bn,lt,Ln,L,Be,p,g,Te,W,$]);const fc=x==="auto"?void 0:x;if(D)return n!=null||r!=null?d.jsx(oc,{}):W==="diff"?d.jsx(_n,{imageUrl:e,baselineUrl:t,diffMode:((Co=ot(Te))==null?void 0:Co.kind)==="pointwise"?Te:"absolute",interpolation:x,colormap:fe,showAxes:!1,zoom:S,pan:m,onViewportChange:f,label:b,pixelValueNotation:_}):d.jsx(rc,{imageUrl:e,baselineUrl:t,mode:W,splitPosition:s,blendAlpha:i,onSplitPositionChange:l,zoom:S,pan:m,onViewportChange:f,interpolation:x,label:b,pixelValueNotation:_});const dc=d.jsxs(d.Fragment,{children:[d.jsx("canvas",{ref:T,className:"w-full h-full block",style:{imageRendering:fc},"data-gpu-compare-canvas":!0}),W==="split"&&d.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${s*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:C=>{C.stopPropagation(),l==null||l(.5)},onPointerDown:C=>{C.stopPropagation(),C.preventDefault();const H=C.currentTarget;try{H.setPointerCapture(C.pointerId)}catch{}const z=H.parentElement.getBoundingClientRect(),re=ye=>{l==null||l(Math.max(0,Math.min(1,(ye.clientX-z.left)/z.width)))},ie=()=>{window.removeEventListener("pointermove",re),window.removeEventListener("pointerup",ie)};window.addEventListener("pointermove",re),window.addEventListener("pointerup",ie)},children:d.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return d.jsx(Ft,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":A},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:y,wrapperRef:k,zoom:S,pan:m,onViewportChange:f,naturalDims:Be,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:dc,showAxes:!1,notationSeed:_,onReset:Ze,extraModified:Fe,exportCanvasRef:T,requestRender:at,leadingMenus:ae,displayAdjust:{exposureEV:V,offset:_e,onExposureChange:ge,onOffsetChange:Me},label:"",showLabelChip:!1,overlay:{render:({notation:C,setOverlayActive:H})=>W==="split"?d.jsxs(d.Fragment,{children:[ct&&Be&&d.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-s)*100}% 0 0)`},children:d.jsx(ht,{imageElRef:T,naturalWidth:Be.w,naturalHeight:Be.h,zoom:S,pan:m,sourceWindow:J,sample:Ln,notation:C,version:Ie})}),ct&&Be&&d.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${s*100}%)`},children:d.jsx(ht,{imageElRef:T,naturalWidth:Be.w,naturalHeight:Be.h,zoom:S,pan:m,sourceWindow:J,sample:lt,notation:C,version:Ie,onActiveChange:H})})]}):Be&&d.jsx(ht,{imageElRef:T,naturalWidth:Be.w,naturalHeight:Be.h,zoom:S,pan:m,sourceWindow:J,sample:W==="diff"?Bn:lt,notation:C,version:W==="diff"?te:Ie,onActiveChange:H})},extraChips:d.jsxs(d.Fragment,{children:[W==="split"&&d.jsx(Ro,{}),b?d.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:b}):null,ee&&d.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${b?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",ee.mse.toExponential(2)," · PSNR ",Number.isFinite(ee.psnr)?ee.psnr.toFixed(1):"∞"," dB · MAE"," ",ee.mae.toExponential(2)," · SSIM ",bo($)]})]})})}const lc="cairn-plot:gpu-image-ready";async function uc(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Tt(),window.__cairnPlotGpuImagePane=Qi,window.__cairnPlotGpuComparePane=cc,window.__cairnPlotDiffMenuModes=xo(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(lc))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Yr("no-webgpu")}}}uc()})(__cairnPlotJsxRuntime,__cairnPlotReact);
