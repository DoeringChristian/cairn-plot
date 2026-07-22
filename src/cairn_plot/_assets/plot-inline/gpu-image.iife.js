var xa=Object.defineProperty;var ba=(f,c,Ye)=>c in f?xa(f,c,{enumerable:!0,configurable:!0,writable:!0,value:Ye}):f[c]=Ye;var re=(f,c,Ye)=>ba(f,typeof c!="symbol"?c+"":c,Ye);(function(f,c){"use strict";const Ye=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function mn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:Ye}),{hdr:!1,format:n}}function Qr(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:Ye}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:Ye}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return mn(e,t)}}}const jr=`
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
`,Jr=`
struct Params { dims: vec4<f32> }; // x=width, y=height, z=zClip, w=unused

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
  let zClip = params.dims.z;
  // Front-to-back OVER over premultiplied samples: acc += (1 - acc.a) * sample.
  var acc = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  for (var s: u32 = start; s < end; s = s + 1u) {
    if (zs[s] > zClip) { break; } // samples ascending in Z ⇒ the rest are farther
    let c = colors[s];
    let wgt = 1.0 - acc.a;
    acc = acc + wgt * c;
  }
  return acc;
}
`;function Bt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function gn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function eo(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const to={texture:0,sampler:1,uniform:2};function It(e,t){return e*3+to[t]}const no={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function ro(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),i=r[2]!==void 0,s=r[3].trim();if(i){const l=no[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class xn{constructor(t,n,r,o){re(this,"width");re(this,"height");re(this,"format");re(this,"gpuTexture");re(this,"device");re(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Bt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*gn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class bn{constructor(t){re(this,"_s");re(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class oo{constructor(t,n,r,o,i){re(this,"_p");re(this,"gpuPipeline");re(this,"bindings");re(this,"bindGroupLayout");re(this,"variants");re(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=i,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function so(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class io{constructor(t){re(this,"_c");re(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class ao{constructor(t,n,r,o,i){re(this,"width");re(this,"height");re(this,"paramsBuffer");re(this,"bindGroup");re(this,"buffers");re(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=i}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class co{constructor(t,n){re(this,"_b");re(this,"gpuBindGroup");re(this,"ownedBuffers");re(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class lo{constructor(t,n,r,o){re(this,"canvas");re(this,"hdr");re(this,"format");re(this,"context");re(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function ft(e){return"canvas"in e}async function uo(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function i(p){return ft(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function s(p){if(ft(p))return{width:p.canvas.width,height:p.canvas.height};const y=p;return{width:y.width,height:y.height}}let l=!1,a=null;function u(){var y,E;if(a!==null)return a;let p=!1;try{if(typeof document<"u"){const M=document.createElement("canvas");M.width=1,M.height=1;const x=M.getContext("webgpu");if(x)try{x.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const R=(y=x.getConfiguration)==null?void 0:y.call(x);p=((E=R==null?void 0:R.toneMapping)==null?void 0:E.mode)==="extended"}catch{p=!1}finally{try{x.unconfigure()}catch{}}}}catch{p=!1}return a=p,p}const d=256;let b=null,h=null;function g(){if(!b||!h){const p=t.createShaderModule({code:jr});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const y=t.createPipelineLayout({bindGroupLayouts:[h]});b=t.createComputePipeline({layout:y,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:b,layout:h}}let v=null,m=null;function S(){if(!v||!m){const p=t.createShaderModule({code:Jr});m=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const y=t.createPipelineLayout({bindGroupLayouts:[m]});v=t.createRenderPipeline({layout:y,vertex:{module:p,entryPoint:"vs_main"},fragment:{module:p,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:v,layout:m}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:u,createTexture(p,y,E){return new xn(t,p,y,E)},createSampler(p){const y=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",E=t.createSampler({magFilter:y,minFilter:y,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new bn(E)},createRenderPipeline(p){const y=t.createShaderModule({code:p.shaderWGSL}),E=ro(p.shaderWGSL),M=Bt(p.targetFormat),x=so(t,E),R=t.createPipelineLayout({bindGroupLayouts:[x]}),_=A=>t.createRenderPipeline({layout:R,vertex:{module:y,entryPoint:"vs_main"},fragment:{module:y,entryPoint:"fs_main",targets:[{format:A}]},primitive:{topology:"triangle-list"}}),P=_(M);return new oo(P,E,x,M,_)},createComputePipeline(p){const y=t.createShaderModule({code:p.shaderWGSL}),E=t.createComputePipeline({layout:"auto",compute:{module:y,entryPoint:"cs_main"}});return new io(E)},createBindGroup(p,y){const E=p,M=new Map,x=[];for(const[_,P]of E.bindings)if(P.kind==="uniform"){const A=t.createBuffer({size:P.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});x.push(A),M.set(_,{binding:_,resource:{buffer:A}})}else P.kind==="sampler"&&M.set(_,{binding:_,resource:o()});for(const _ of y){const P=_.resource;if(P instanceof xn){const A=It(_.binding,"texture");E.bindings.has(A)&&M.set(A,{binding:A,resource:P.gpuTexture.createView()})}else if(P instanceof bn){const A=It(_.binding,"sampler");E.bindings.has(A)&&M.set(A,{binding:A,resource:P.gpuSampler})}else{const A=It(_.binding,"uniform"),B=E.bindings.get(A);if(B&&B.kind==="uniform"){const C=P.uniform,T=t.createBuffer({size:Math.max(B.sizeBytes,C.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(T,0,C.buffer,C.byteOffset,C.byteLength),x.push(T),M.set(A,{binding:A,resource:{buffer:T}})}}}const R=t.createBindGroup({layout:E.bindGroupLayout,entries:Array.from(M.values())});return new co(R,x)},createSurface(p,y){const E=p.getContext("webgpu");if(!E)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const M=y.hdr&&n.hdr,x=()=>M?Qr(E,t):mn(E,t),R=x();return new lo(p,E,R,x)},renderFullscreen(p,y,E){const M=y,x=E,R=i(p),{width:_,height:P}=s(p),A=ft(p)?p.format:Bt(p.format),B=M.pipelineFor(A),C=t.createCommandEncoder(),T=C.beginRenderPass({colorAttachments:[{view:R,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});T.setPipeline(B),T.setBindGroup(0,x.gpuBindGroup),T.setViewport(0,0,_,P,0,1),T.draw(3),T.end(),t.queue.submit([C.finish()])},createDeepSampleBuffers(p){const{layout:y}=S(),E=A=>{const B=t.createBuffer({size:A.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(B,0,A.buffer,A.byteOffset,A.byteLength),B},M=E(p.offsets),x=E(p.colors),R=E(p.zs),_=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),P=t.createBindGroup({layout:y,entries:[{binding:0,resource:{buffer:M}},{binding:1,resource:{buffer:x}},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:_}}]});return new ao(p.width,p.height,[M,x,R],_,P)},compositeDeep(p,y,E){const M=p,x=y,{pipeline:R}=S();t.queue.writeBuffer(M.paramsBuffer,0,new Float32Array([M.width,M.height,E,0]));const _=t.createCommandEncoder(),P=_.beginRenderPass({colorAttachments:[{view:x.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(R),P.setBindGroup(0,M.bindGroup),P.setViewport(0,0,x.width,x.height,0,1),P.draw(3),P.end(),t.queue.submit([_.finish()])},async readback(p){const y=ft(p),{width:E,height:M}=s(p),x=y?p.hdr?"rgba16float":"rgba8unorm":p.format,R=y&&p.format==="bgra8unorm",_=y?p.getCurrentGPUTexture():p.gpuTexture,P=gn(x),A=E*P,B=256,C=Math.ceil(A/B)*B,T=C*M,V=t.createBuffer({size:T,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),k=t.createCommandEncoder();k.copyTextureToBuffer({texture:_},{buffer:V,bytesPerRow:C,rowsPerImage:M},{width:E,height:M,depthOrArrayLayers:1}),t.queue.submit([k.finish()]),await V.mapAsync(GPUMapMode.READ);const U=new Uint8Array(V.getMappedRange()),N=new Uint8Array(A*M);for(let K=0;K<M;K++){const ee=K*C,X=K*A;N.set(U.subarray(ee,ee+A),X)}if(V.unmap(),V.destroy(),x==="rgba8unorm"){if(R)for(let K=0;K<N.length;K+=4){const ee=N[K],X=N[K+2];N[K]=X,N[K+2]=ee}return N}if(x==="rgba16float"){const K=new Uint16Array(N.buffer,N.byteOffset,N.byteLength/2),ee=new Float32Array(K.length);for(let X=0;X<K.length;X++)ee[X]=eo(K[X]);return ee}return new Float32Array(N.buffer,N.byteOffset,N.byteLength/4)},async reduceDiffSumSquaredAbs(p,y,E,M){const x=p,R=y,_=Math.max(0,E*M),P=Math.max(1,Math.ceil(_/d)),{pipeline:A,layout:B}=g(),C=P*2*4,T=t.createBuffer({size:C,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),V=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(V,0,new Uint32Array([Math.max(1,E),Math.max(1,M),_,0]));const k=t.createBindGroup({layout:B,entries:[{binding:0,resource:x.gpuTexture.createView()},{binding:1,resource:R.gpuTexture.createView()},{binding:2,resource:{buffer:T}},{binding:3,resource:{buffer:V}}]}),U=t.createBuffer({size:C,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),N=t.createCommandEncoder(),K=N.beginComputePass();K.setPipeline(A),K.setBindGroup(0,k),K.dispatchWorkgroups(P),K.end(),N.copyBufferToBuffer(T,0,U,0,C),t.queue.submit([N.finish()]),await U.mapAsync(GPUMapMode.READ);const X=new Float32Array(U.getMappedRange()).slice();U.unmap(),U.destroy(),T.destroy(),V.destroy();let ve=0,ue=0;for(let oe=0;oe<P;oe++)ve+=X[oe*2],ue+=X[oe*2+1];return{sumSq:ve,sumAbs:ue}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let Ot=null;async function fo(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return uo()}function dt(){return Ot||(Ot=fo()),Ot}function po(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function ho(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),i=Math.floor(o),s=Math.min(i+1,e.length-1),l=o-i,[a,u,d]=po(e[i],e[s],l);t[n*3]=Math.round(a),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(d)}return t}const vn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},mo=new Set(["red-green","red-blue"]),wn=new Map;function Ft(e){let t=wn.get(e);if(!t){const n=vn[e]??vn.viridis;t=ho(n),wn.set(e,t)}return t}const ze=e=>e<0?0:e>1?1:e,Ut=e=>{const t=e<0?0:e;return t/(1+t)},Nt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return ze(n/r)},yn={linear:([e,t,n])=>[ze(e),ze(t),ze(n)],srgb:([e,t,n])=>[ze(e),ze(t),ze(n)],reinhard:([e,t,n])=>[Ut(e),Ut(t),Ut(n)],aces:([e,t,n])=>[Nt(e),Nt(t),Nt(n)],extended:([e,t,n])=>[e,t,n]},go="srgb";function xo(e){return e&&yn[e]||yn[go]}function pt(e,t,n){return e*2**t+n}function bo(e){const t=ze(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Gt(e,t){return typeof t=="number"&&t>0?ze(Math.pow(ze(e),1/t)):bo(e)}function zt(e,t,n="linear",r=0,o=0){const i=Ft(t),s=new ImageData(e.width,e.height),l=e.data,a=s.data,u=r!==0||o!==0;for(let d=0;d<l.length;d+=4){let b=(l[d]+l[d+1]+l[d+2])/3;u&&(b=Math.max(0,Math.min(255,pt(b/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+b/255*127):h=Math.round(b),h=Math.max(0,Math.min(255,h)),a[d]=i[h*3],a[d+1]=i[h*3+1],a[d+2]=i[h*3+2],a[d+3]=l[d+3]}return s}function vo(e,t){return e==="signed"||e==="relative"?"signed":Vt(t)}function Vt(e){return mo.has(e??"")?"positive":"linear"}function En(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const _n=En(50);function $t(e){return _n.get(e)}function Xt(e,t){_n.set(e,t)}const Mn=En(100);function wo(e){return Mn.get(e)}function yo(e,t){Mn.set(e,t)}function Eo(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),i=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const a=(s*e.width+l)*4,u=(s*t.width+l)*4,d=(s*r+l)*4;for(let b=0;b<3;b++){const h=e.data[a+b],g=t.data[u+b],v=h-g,m=Math.abs(v),S=Math.max(h,1);let w;switch(n){case"signed":w=(v+255)/2;break;case"absolute":w=m;break;case"squared":w=v*v/255;break;case"relative_signed":w=(v/S+1)*127.5;break;case"relative_absolute":w=m/S*255;break;case"relative_squared":w=v*v/(S*S)*255;break}i.data[d+b]=Math.min(255,Math.max(0,Math.round(w)))}i.data[d+3]=255}return i}async function Je(e){const t=wo(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const i=o.getContext("2d");if(!i){n(null);return}i.drawImage(r,0,0);const s=i.getImageData(0,0,o.width,o.height);yo(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const _o={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Mo={linear:0,signed:1,positive:2},So=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Po=`#version 300 es
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
}`;let et=null,Z=null,Ae=null,ht=null;function To(){if(Z)return Z;try{if(typeof OffscreenCanvas<"u"?et=new OffscreenCanvas(1,1):et=document.createElement("canvas"),Z=et.getContext("webgl2",{preserveDrawingBuffer:!0}),!Z)return console.warn("[cairn] WebGL 2 not available"),null;const e=Z.createShader(Z.VERTEX_SHADER);if(Z.shaderSource(e,So),Z.compileShader(e),!Z.getShaderParameter(e,Z.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Z.getShaderInfoLog(e)),null;const t=Z.createShader(Z.FRAGMENT_SHADER);if(Z.shaderSource(t,Po),Z.compileShader(t),!Z.getShaderParameter(t,Z.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Z.getShaderInfoLog(t)),null;if(Ae=Z.createProgram(),Z.attachShader(Ae,e),Z.attachShader(Ae,t),Z.linkProgram(Ae),!Z.getProgramParameter(Ae,Z.LINK_STATUS))return console.error("[cairn] WebGL program link:",Z.getProgramInfoLog(Ae)),null;ht=Z.createVertexArray(),Z.bindVertexArray(ht);const n=Z.createBuffer();Z.bindBuffer(Z.ARRAY_BUFFER,n),Z.bufferData(Z.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Z.STATIC_DRAW);const r=Z.getAttribLocation(Ae,"a_pos");return Z.enableVertexAttribArray(r),Z.vertexAttribPointer(r,2,Z.FLOAT,!1,0,0),Z.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Z}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Sn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Ao(e,t,n){const r=new Uint8Array(1024);for(let i=0;i<256;i++)r[i*4]=t[i*3],r[i*4+1]=t[i*3+1],r[i*4+2]=t[i*3+2],r[i*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Co(e,t,n,r){const o=To();if(!o||!Ae||!ht||!et)return null;const i=Math.min(e.width,t.width),s=Math.min(e.height,t.height);et.width=i,et.height=s,o.viewport(0,0,i,s);const l=Sn(o,e,0),a=Sn(o,t,1);let u=null;n.colormap?u=Ao(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ae),o.uniform1i(o.getUniformLocation(Ae,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ae,"u_other"),1),o.uniform1i(o.getUniformLocation(Ae,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ae,"u_diff_mode"),_o[n.diffMode]),o.uniform1i(o.getUniformLocation(Ae,"u_cmap_mode"),Mo[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ae,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(ht),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=i,r.height=s;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(et,0,0,i,s,0,-s,i,s),d.restore()),o.deleteTexture(l),o.deleteTexture(a),o.deleteTexture(u),{width:i,height:s}}const Ro="cairn:render-mode";function Do(){try{const e=localStorage.getItem(Ro);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const mt=15360;function gt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Pn=globalThis.Float16Array;function Tn(e,t=e.length){if(Pn){const r=new Pn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=gt(e[r]);return n}const Ve=new Uint32Array(512),$e=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ve[e]=0,Ve[e|256]=32768,$e[e]=24,$e[e|256]=24):t<-14?(Ve[e]=1024>>-t-14,Ve[e|256]=1024>>-t-14|32768,$e[e]=-t-1,$e[e|256]=-t-1):t<=15?(Ve[e]=t+15<<10,Ve[e|256]=t+15<<10|32768,$e[e]=13,$e[e|256]=13):t<128?(Ve[e]=31744,Ve[e|256]=64512,$e[e]=24,$e[e|256]=24):(Ve[e]=31744,Ve[e|256]=64512,$e[e]=13,$e[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var lt=Uint8Array,An=Uint16Array,ko=Int32Array,Lo=new lt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Bo=new lt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Cn=function(e,t){for(var n=new An(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new ko(n[30]),r=1;r<30;++r)for(var i=n[r];i<n[r+1];++i)o[i]=i-n[r]<<5|r;return{b:n,r:o}},Rn=Cn(Lo,2),Io=Rn.b,Oo=Rn.r;Io[28]=258,Oo[258]=28,Cn(Bo,0);for(var Fo=new An(32768),pe=0;pe<32768;++pe){var Ke=(pe&43690)>>1|(pe&21845)<<1;Ke=(Ke&52428)>>2|(Ke&13107)<<2,Ke=(Ke&61680)>>4|(Ke&3855)<<4,Fo[pe]=((Ke&65280)>>8|(Ke&255)<<8)>>1}for(var xt=new lt(288),pe=0;pe<144;++pe)xt[pe]=8;for(var pe=144;pe<256;++pe)xt[pe]=9;for(var pe=256;pe<280;++pe)xt[pe]=7;for(var pe=280;pe<288;++pe)xt[pe]=8;for(var Uo=new lt(32),pe=0;pe<32;++pe)Uo[pe]=5;var No=new lt(0),Go=typeof TextDecoder<"u"&&new TextDecoder,zo=0;try{Go.decode(No,{stream:!0}),zo=1}catch{}const Dn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Wt(e){const t=Dn.length;return Dn[(e%t+t)%t]}function Vo(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),i=c.useRef(null),s=c.useRef(null),l=c.useRef(null),a=c.useCallback((u,d)=>{o(b=>b.w===u&&b.h===d?b:{w:u,h:d})},[]);return c.useLayoutEffect(()=>{const u=n.current;if(!u||u===l.current)return;const d=u.getBoundingClientRect();(d.width>0||d.height>0)&&(l.current=u,a(d.width,d.height))}),c.useEffect(()=>{var b;const u=n.current;if(u===s.current||((b=i.current)==null||b.disconnect(),i.current=null,s.current=u,!u))return;const d=new ResizeObserver(h=>{for(const g of h)a(g.contentRect.width,g.contentRect.height)});i.current=d,d.observe(u)}),c.useEffect(()=>()=>{var u;return(u=i.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function $o(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!0)},r=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Xo=.001;function Wo(e,t=Xo){return Math.exp(-e*t)}function kn(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function Ln(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Ho(e,t,n,r,o,i,s){const l=t>0&&r>0?r/t:1,a=Math.max(i,Math.min(s,e.zoom*l)),u=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:a,pan:{x:o.x-u*a,y:o.y-d*a}}}const Yo=.25,Ht=64;function Yt(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Ht;const o=Math.min(n/e,r/t);return o<=0?Ht:Math.max(Math.max(n,r)/o,8)}function Bn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:i=Yo,maxZoom:s=Ht,naturalWidth:l,naturalHeight:a}=e,u=$o(),d=c.useRef(u);d.current=u;const b=c.useRef({zoom:n,pan:r});b.current={zoom:n,pan:r};const h=c.useRef(o);h.current=o,c.useEffect(()=>{const _=t.current;if(!_||!o)return;const P=A=>{var X;if(!A.ctrlKey&&!d.current)return;A.preventDefault(),A.stopPropagation();const B=Wo(A.deltaY),C=b.current,T=_.getBoundingClientRect(),V=l&&a?Yt(l,a,T.width,T.height):s,k=Math.max(i,Math.min(V,C.zoom*B));if(C.zoom===k)return;const U=A.clientX-T.left,N=A.clientY-T.top,K=U-(U-C.pan.x)/C.zoom*k,ee=N-(N-C.pan.y)/C.zoom*k;(X=h.current)==null||X.call(h,{zoom:k,pan:{x:K,y:ee}})};return _.addEventListener("wheel",P,{passive:!1}),()=>_.removeEventListener("wheel",P)},[t,!!o,i,s,l,a]);const g=c.useRef(new Map),v=c.useRef(null),m=c.useRef(null),S=c.useCallback((_,P,A)=>{const B=_.getBoundingClientRect();return{x:P-B.left,y:A-B.top}},[]),w=c.useCallback(_=>{if(!l||!a)return s;const P=_.getBoundingClientRect();return Yt(l,a,P.width,P.height)},[l,a,s]),p=c.useCallback((_,P)=>{const A=g.current,B=A.get(_),C=A.get(P);!B||!C||(v.current=null,m.current={idA:_,idB:P,startDist:kn(B,C),startMid:Ln(B,C),startZoom:b.current.zoom,startPan:{...b.current.pan}})},[]),y=c.useCallback(_=>{const P=g.current.get(_);P&&(v.current={pointerId:_,startX:P.x,startY:P.y,panX:b.current.pan.x,panY:b.current.pan.y})},[]),E=c.useCallback(_=>{if(!h.current)return;const P=_.pointerType==="touch";if(!P&&!d.current)return;const A=_.currentTarget;if(A.setPointerCapture(_.pointerId),g.current.set(_.pointerId,S(A,_.clientX,_.clientY)),P&&g.current.size>=2){const B=[...g.current.keys()];p(B[B.length-2],B[B.length-1]);return}y(_.pointerId)},[S,p,y]),M=c.useCallback(_=>{var T,V;const P=_.currentTarget,A=g.current.get(_.pointerId);if(A){const k=S(P,_.clientX,_.clientY);A.x=k.x,A.y=k.y}const B=m.current;if(B){const k=g.current.get(B.idA),U=g.current.get(B.idB);if(!k||!U)return;const N=Ho({zoom:B.startZoom,pan:B.startPan},B.startDist,B.startMid,kn(k,U),Ln(k,U),i,w(P));(T=h.current)==null||T.call(h,N);return}const C=v.current;!C||C.pointerId!==_.pointerId||!A||(V=h.current)==null||V.call(h,{zoom:b.current.zoom,pan:{x:C.panX+(A.x-C.startX),y:C.panY+(A.y-C.startY)}})},[S,i,w]),x=c.useCallback(_=>{var A;try{_.currentTarget.releasePointerCapture(_.pointerId)}catch{}g.current.delete(_.pointerId);const P=m.current;if(P&&(_.pointerId===P.idA||_.pointerId===P.idB)){m.current=null;const B=[...g.current.keys()];B.length===1&&y(B[0]);return}((A=v.current)==null?void 0:A.pointerId)===_.pointerId&&(v.current=null)},[y]);return{containerProps:{onPointerDown:E,onPointerMove:M,onPointerUp:x,onPointerCancel:x,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function Kt(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),i())};function i(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return i(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ut(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Ko(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function In(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function qt({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:i}=Vo(),s=c.useRef(null),l=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),a=c.useMemo(()=>{const m=i.w,S=i.h;if(m<=0||S<=0||n<=0||r<=0)return null;const w=Math.min(m/n,S/r),p=n*w,y=r*w;return{left:(m-p)/2,top:(S-y)/2,width:p,height:y}},[i.w,i.h,n,r]),u=e.masks,d=t.showMasks&&!!u&&u.length>0,b=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!d||!u)return;const m=s.current;if(!m)return;(m.width!==n||m.height!==r)&&(m.width=n,m.height=r);const S=m.getContext("2d");if(!S)return;S.clearRect(0,0,m.width,m.height);let w=!1;const p=S.createImageData(n,r),y=p.data;let E=u.length,M=!1;const x=()=>{w||M&&S.putImageData(p,0,0)},R=document.createElement("canvas");R.width=n,R.height=r;const _=R.getContext("2d",{willReadFrequently:!0});for(const P of u){const A=new Image;A.onload=()=>{if(!w){if(_){_.clearRect(0,0,n,r),_.drawImage(A,0,0,n,r);const B=_.getImageData(0,0,n,r).data;for(let C=0;C<n*r;C++){const T=B[C*4];if(T===0||l.has(T))continue;const[V,k,U]=Ko(Wt(T));y[C*4]=V,y[C*4+1]=k,y[C*4+2]=U,y[C*4+3]=255,M=!0}}E-=1,E===0&&x()}},A.onerror=()=>{E-=1,E===0&&x()},A.src=`data:image/png;base64,${P.png_b64}`}return()=>{w=!0}},[d,u,n,r,b]),!a)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],g=t.showBoxes&&h.length>0,v=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),g&&f.jsx("svg",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((m,S)=>{if(!In(m,t,l))return null;const w=m.domain==="pixel"?1:n,p=m.domain==="pixel"?1:r,y=m.position.minX*w,E=m.position.minY*p,M=(m.position.maxX-m.position.minX)*w,x=(m.position.maxY-m.position.minY)*p;return f.jsx("rect",{x:y,y:E,width:M,height:x,fill:"none",stroke:Wt(m.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},S)})}),g&&f.jsx("div",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height},children:h.map((m,S)=>{if(!In(m,t,l))return null;const w=m.domain==="pixel"?1/n:1,p=m.domain==="pixel"?1/r:1,y=m.position.minX*w*100,E=m.position.minY*p*100,M=m.label??v[String(m.class_id)]??`#${m.class_id}`,x=m.score!=null?` ${(m.score*100).toFixed(0)}%`:"";return!M&&!x?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${y}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Wt(m.class_id)},children:f.jsxs("span",{className:"mono",children:[M,x]})},S)})})]})}const Zt=30,bt=["#ff5a5a","#39d353","#5b9bff"];function Qt(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function ot(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Qt(e/255):Qt(n==="int"?e*255:e)}function tt(e,t,n,r){return e.length===1?{lines:[ot(e[0],t,n)],luminance:r}:{lines:e.map(o=>ot(o,t,n)),luminance:r,colors:e.map((o,i)=>bt[i]??null)}}const qo={x:0,y:0,w:1,h:1};function nt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:i,notation:s="decimal",version:l=0,onActiveChange:a,sourceWindow:u=qo}){const d=c.useRef(null),b=c.useRef(!1),h=Kt(),g=c.useRef(a);g.current=a;const v=c.useCallback(S=>{var w;S!==b.current&&(b.current=S,(w=g.current)==null||w.call(g,S))},[]),m=c.useCallback(()=>{var Ce;const S=d.current,w=e.current;if(!S)return;const p=window.devicePixelRatio||1,y=S.clientWidth,E=S.clientHeight;if(y===0||E===0)return;S.width!==Math.round(y*p)&&(S.width=Math.round(y*p)),S.height!==Math.round(E*p)&&(S.height=Math.round(E*p));const M=S.getContext("2d");if(!M)return;if(M.setTransform(p,0,0,p,0,0),M.clearRect(0,0,y,E),!w||t<=0||n<=0){v(!1);return}const x=w.getBoundingClientRect(),R=S.getBoundingClientRect();if(x.width===0||x.height===0){v(!1);return}const _=u.x*t,P=u.y*n,A=u.w*t,B=u.h*n;if(A<=0||B<=0){v(!1);return}const C=Math.min(x.width/A,x.height/B);if(C<Zt){v(!1);return}const T=A*C,V=B*C,k=x.left+(x.width-T)/2-R.left,U=x.top+(x.height-V)/2-R.top,N=Math.max(Math.floor(_),Math.floor(_+(0-k)/C)),K=Math.min(Math.ceil(_+A),Math.ceil(_+(y-k)/C)),ee=Math.max(Math.floor(P),Math.floor(P+(0-U)/C)),X=Math.min(Math.ceil(P+B),Math.ceil(P+(E-U)/C));if(K<=N||X<=ee){v(!1);return}v(!0);const ve=k+(0-_)*C,ue=U+(0-P)*C,oe=k+(t-_)*C,_e=U+(n-P)*C;M.save(),M.beginPath(),M.rect(ve,ue,oe-ve,_e-ue),M.clip(),M.textAlign="center",M.textBaseline="middle",M.lineJoin="round";const we=C*.14,ye=C-we*2;for(let ae=ee;ae<X;ae++)for(let me=N;me<K;me++){if(me<0||ae<0||me>=t||ae>=n)continue;const j=i(me,ae,s);if(!j||j.lines.length===0)continue;const q=j.lines.length;let W=1;for(const $ of j.lines)$.length>W&&(W=$.length);const Ee=ye/(q*1.15),he=ye/(W*.62)||Ee,ce=Math.min(Ee,he,24);if(ce<6)continue;const xe=k+(me-_+.5)*C,Me=U+(ae-P+.5)*C,Te=ce*1.15,Oe=j.luminance<=.55,Qe=Oe?"#ffffff":"#000000";M.font=`${ce}px ui-monospace, SFMono-Regular, Menlo, monospace`,M.lineWidth=Math.max(1.4,ce*.16),M.strokeStyle=Oe?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let De=Me-q*Te/2+Te/2;for(let $=0;$<j.lines.length;$++){const D=j.lines[$];M.strokeText(D,xe,De),M.fillStyle=((Ce=j.colors)==null?void 0:Ce[$])??Qe,M.fillText(D,xe,De),De+=Te}}M.restore()},[e,t,n,i,s,v,u]);return c.useEffect(()=>{m()},[m,r,o.x,o.y,l,s,u,h]),c.useEffect(()=>{const S=d.current;if(!S)return;const w=new ResizeObserver(()=>m());return w.observe(S),()=>w.disconnect()},[m]),f.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function On({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Zo=`
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
`,st=`
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
`,vt=`
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
`,Qo=`
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
`,wt=`
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
`;function Fn(e){return`
${Ie}
${st}
${Qo}

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
`}const jo=Fn("select(colorB, colorA, uv.x < split)"),Jo=Fn("mix(colorA, colorB, alpha)");function es(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Un(e,t,n){const{v:r,h:o}=es(n),i=e.w-t.w,s=e.h-t.h,l=o==="left"?0:o==="right"?i:Math.floor(i/2),a=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:l,y:a}}function yt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const i={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:i,offsetA:Un(e,i,n),offsetB:Un(t,i,n)}}function ts(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const jt={linear:0,srgb:1,reinhard:2,aces:3,extended:4},Nn=new WeakMap;function ns(e,t){let n=Nn.get(e);n||(n=new Map,Nn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Zo,targetFormat:t}),n.set(t,r)),r}function Gn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function zn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function rs(e,t,n,r){var m;const o=Gn(t),i=ns(e,o),s=zn(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,a=jt[r.operator]??jt.srgb,u=new Float32Array([r.exposureEV,a,l,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),b=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),g=new Float32Array([r.offset??0]);let v;try{v=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:g}}]),e.renderFullscreen(t,i,v)}finally{(m=v==null?void 0:v.destroy)==null||m.call(v),s.destroy()}}const Vn=new WeakMap;function os(e,t,n){let r=Vn.get(e);r||(r=new Map,Vn.set(e,r));const o=`${t}:${n}`;let i=r.get(o);return i||(i=e.createRenderPipeline({shaderWGSL:t==="split"?jo:Jo,targetFormat:n}),r.set(o,i)),i}function ss(e,t,n,r,o){var m;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const i=Gn(t),s=os(e,o.mode,i),l=zn(e,void 0),a=o.gamma,u=jt[o.operator],d=new Float32Array([o.exposureEV,u,a,0]),b=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),g=new Float32Array([o.offset??0,0,0,0]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:g}}]),e.renderFullscreen(t,s,v)}finally{(m=v==null?void 0:v.destroy)==null||m.call(v),l.destroy()}}function $n(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,i=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:i,mae:o}}async function Xn(e,t,n,r){const o=r??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=o.result.w,s=o.result.h,l=i*s*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:y,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,i,s);return $n(y,E,l)}const u=await e.readback(t),d=await e.readback(n),b=u instanceof Uint8Array?255:1,h=d instanceof Uint8Array?255:1,g=Wn(u,t.width,t.height,b,o.offsetA,o.fit==="fill",i,s),v=Wn(d,n.width,n.height,h,o.offsetB,o.fit==="fill",i,s);let m=0,S=0;const w=[0,0,0],p=[0,0,0];for(let y=0;y<s;y++)for(let E=0;E<i;E++){g(E,y,w),v(E,y,p);for(let M=0;M<3;M++){const x=w[M]-p[M];m+=x*x,S+=Math.abs(x)}}return $n(m,S,l)}function Wn(e,t,n,r,o,i,s,l){const a=(b,h,g)=>e[(h*t+b)*4+g]??0;if(!i)return(b,h,g)=>{const v=Math.min(Math.max(b+o.x,0),t-1),m=Math.min(Math.max(h+o.y,0),n-1);g[0]=a(v,m,0)/r,g[1]=a(v,m,1)/r,g[2]=a(v,m,2)/r};const u=t-1,d=n-1;return(b,h,g)=>{const v=(b+.5)/s,m=(h+.5)/l,S=v*t-.5,w=m*n-.5,p=Math.floor(S),y=Math.floor(w),E=S-p,M=w-y,x=Math.min(Math.max(p,0),u),R=Math.min(Math.max(p+1,0),u),_=Math.min(Math.max(y,0),d),P=Math.min(Math.max(y+1,0),d);for(let A=0;A<3;A++){const B=a(x,_,A),C=a(R,_,A),T=a(x,P,A),V=a(R,P,A),k=B+(C-B)*E,U=T+(V-T)*E;g[A]=(k+(U-k)*M)/r}}}function Hn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const is=12,qe=[];function Yn(e){const t=qe.indexOf(e);t!==-1&&qe.splice(t,1),qe.push(e)}function as(e){const t=qe.indexOf(e);t!==-1&&qe.splice(t,1)}function Et(e){e.parked||(as(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function Kn(e){for(;qe.length>is;){const t=qe.find(n=>n!==e&&!n.visible)??qe.find(n=>n!==e);if(!t)break;Et(t)}}function qn(e){var o,i,s,l;if(e.disposed)return;if(Hn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Yn(e),Kn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((i=e.deep)==null?void 0:i.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((l=e.deep)==null?void 0:l.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const a=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=a,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,a,e.deepZClip)}else if(e.source){const a=t.createTexture(e.source.width,e.source.height,e.source.format);a.write(e.source.data),e.srcTexture=a}e.parked=!1,Yn(e),Kn(e)}function cs(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return qn(e),!e.surface||!e.srcTexture?!1:(rs(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,Et(e),!1}}function ls(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n){if(!e.disposed&&(e.deep=t,e.deepZClip=n,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const r=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=r,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,r,n)}},setDeepZClip(t){e.disposed||(e.deepZClip=t,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return cs(e,t)},park(){e.disposed||Et(e)},restore(){e.disposed||!e.source&&!e.deep||qn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(Et(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function us(e,t){const n=await dt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZClip:0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return ls(r)}function Zn(e){e.dispose()}function fs(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:i}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...i?["invert(1)"]:[]].join(" ")}function Qn(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:i,exposure:s,offset:l,flipSign:a}=e,u=c.useMemo(()=>fs(e,n),[n,r,o,s,a]);return{gammaFilterId:n,filterStr:u,gamma:i,offset:l}}function jn({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function Jn(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function ds({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Jn(e),i=Jn(t),s=[];for(let p=0;p<=e;p+=o)s.push(p);const l=[];for(let p=0;p<=t;p+=i)l.push(p);const a=1/n,u=8*a,d=-12*a,b=-2*a,h=r==null?void 0:r.current;let g=0,v=0,m=0,S=0;if(h){const p=h.clientWidth,y=h.clientHeight,E=p/e,M=y/t,x=Math.min(E,M);m=e*x,S=t*x,g=(p-m)/2,v=(y-S)/2}const w=h&&m>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:w?v:0,transform:`translateY(${d}px)`,fontSize:u},children:s.map(p=>f.jsx("span",{className:"mono",style:{position:"absolute",left:w?g+p/e*m:`${p/e*100}%`,transform:"translateX(-50%)"},children:p},p))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:w?g:0,transform:`translateX(${b}px)`,fontSize:u},children:l.map(p=>f.jsx("span",{className:"mono",style:{position:"absolute",top:w?v+p/t*S:`${p/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*a}px`},children:p},p))})]})}function ps({label:e,isDraggable:t,onDragStart:n}){return f.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const hs=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function er(e,t){const n=getComputedStyle(e),r=hs.map(a=>`${a}:${n.getPropertyValue(a)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const i=e.children,s=t.children,l=Math.min(i.length,s.length);for(let a=0;a<l;a++)er(i[a],s[a])}function Jt(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function en(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function tn(e,t,n,r,o){const i=document.createElement("canvas");i.width=Math.max(1,Math.round(e*n)),i.height=Math.max(1,Math.round(t*n));const s=i.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,a)=>i.toBlob(u=>u?l(u):a(new Error("plot-to-png: toBlob returned null")),"image/png"))}function ms(e,t,n){const r=e.cloneNode(!0);er(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),i="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const a=new Image;a.onload=()=>s(a),a.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),a.src=i})}async function tr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,i=(t==null?void 0:t.background)??Jt(e);return tn(r,o,en(t),i,s=>s.drawImage(e,0,0,r,o))}async function gs(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,i=(t==null?void 0:t.background)??Jt(e);try{return await tn(r,o,en(t),i,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function xs(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const i=o.getBoundingClientRect(),s=i.width*i.height;s>r&&(r=s,n=o)}return n}async function bs(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),i=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??Jt(e);if(n){const u=n.getBoundingClientRect(),d=await ms(n,u.width||i,u.height||s);return tn(i,s,en(t),l,b=>{for(const h of r){const g=h.getBoundingClientRect();b.drawImage(h,g.left-o.left,g.top-o.top,g.width,g.height)}b.drawImage(d,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return tr(r[0],t);const a=xs(e);if(a)return gs(a,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function vs(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const ws=8;function ys(e,t,n,r=ws){return!(t>0)||!(e>0)?n:e<t+r}function nr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function Es(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function _s(e,t){const n=Es(e);return n===null?t:n}function Ms(e){return String(e)}const Ss={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Ps={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function He({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Ps[e]??null})}function rr({icon:e,label:t,title:n,active:r,disabled:o,onClick:i}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&i()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(He,{name:e??""})})}function or(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Ts({icon:e,title:t,menu:n}){var S;const{options:r,value:o,onSelect:i}=n,[s,l]=c.useState(!1),[a,u]=c.useState(0),d=c.useRef(null),b=nr(r,o),h=e?void 0:((S=r[b])==null?void 0:S.label)??"",g=c.useCallback(()=>{l(w=>{const p=!w;return p&&u(b),p})},[b]),v=c.useCallback(w=>{i(w),l(!1)},[i]);c.useEffect(()=>{if(!s)return;const w=y=>{d.current&&!d.current.contains(y.target)&&l(!1)},p=y=>{y.key==="Escape"&&(y.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",w,!0),document.addEventListener("keydown",p,!0),()=>{document.removeEventListener("pointerdown",w,!0),document.removeEventListener("keydown",p,!0)}},[s]);const m=w=>{if(!s){(w.key==="ArrowDown"||w.key==="Enter"||w.key===" ")&&(w.preventDefault(),u(b),l(!0));return}if(w.key==="ArrowDown")w.preventDefault(),u(p=>(p+1)%r.length);else if(w.key==="ArrowUp")w.preventDefault(),u(p=>(p-1+r.length)%r.length);else if(w.key==="Enter"||w.key===" "){w.preventDefault();const p=r[a];p&&v(p.id)}};return f.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:w=>w.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:w=>{w.stopPropagation(),g()},onDoubleClick:w=>w.stopPropagation(),onKeyDown:m,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?f.jsx("span",{"aria-hidden":"true",children:h}):f.jsx(He,{name:e??""}),f.jsx(He,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((w,p)=>{const y=w.id===o,E=p===a;return f.jsx("li",{role:"option","aria-selected":y,children:f.jsx("button",{type:"button",onClick:M=>{M.stopPropagation(),v(w.id)},onPointerEnter:()=>u(p),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",y?"text-accent font-medium":"text-fg"].join(" "),children:w.label})},w.id)})})]})}const As=e=>e.format?e.format(e.value):String(e.value);function sr({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),i=c.useRef(null),s=c.useCallback(()=>{o(Ms(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&i.current&&(i.current.focus(),i.current.select())},[t]);const l=c.useCallback(()=>{n(u=>(u&&e.onChange(_s(r,e.value)),!1))},[r,e]),a=c.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(He,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:i,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),l()):u.key==="Escape"&&(u.preventDefault(),a())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:As(e)})]})]})}function Cs({icon:e,title:t,menu:n,onClose:r}){var b;const{options:o,value:i,onSelect:s}=n,[l,a]=c.useState(!1),u=nr(o,i),d=((b=o[u])==null?void 0:b.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:h=>{h.stopPropagation(),a(g=>!g)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(He,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),f.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:f.jsx(He,{name:"caret"})})]}),l&&o.map(h=>{const g=h.id===i;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":g,"data-menu-option":"",onClick:v=>{v.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",g?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:g?"✓":""}),f.jsx("span",{children:h.label})]},h.id)})]})}function Rs({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),i=c.useRef(null);return c.useEffect(()=>{if(!r)return;const s=a=>{i.current&&!i.current.contains(a.target)&&o(!1)},l=a=>{a.key==="Escape"&&(a.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),f.jsxs("div",{ref:i,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(He,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(Cs,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var a;l.stopPropagation(),!s.disabled&&((a=s.onClick)==null||a.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(He,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(He,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(sr,{spec:s})},s.id))]})]})}function Ds({controller:e,config:t}){var B,C;const n=c.useRef(null),[r,o]=c.useState(!1),i=c.useRef(r);i.current=r;const s=c.useRef(0),l=`${((B=t==null?void 0:t.leadingButtons)==null?void 0:B.length)??0}:${((C=t==null?void 0:t.sliders)==null?void 0:C.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const T=n.current,V=T==null?void 0:T.parentElement;if(!V)return;const k=()=>{const ee=V.clientWidth;if(!i.current&&n.current){const X=n.current.scrollWidth;X>0&&(s.current=X)}o(ys(ee,s.current,i.current))};let U=0;const N=()=>{U||(U=requestAnimationFrame(()=>{U=0,k()}))},K=new ResizeObserver(N);return K.observe(V),k(),()=>{K.disconnect(),U&&cancelAnimationFrame(U)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const a=e.capabilities,u=t==null?void 0:t.buttons,d=(T,V)=>V&&(u==null?void 0:u[T])!==!1,b=T=>()=>e.setDragMode(T),h=()=>{e.toPNG({filename:"plot"}).then(T=>vs(T,"plot.png")).catch(()=>{})},g=[];d("zoom",a.zoom)&&g.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:b("zoom")}),d("pan",a.pan)&&g.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:b("pan")}),d("select",a.select)&&g.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:b("select")}),d("lasso",a.lasso)&&g.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:b("lasso")});const v=[];d("zoomIn",a.zoom)&&v.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",a.zoom)&&v.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const m=[];d("autoscale",a.autoscale)&&m.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",a.reset)&&m.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const S=[];d("screenshot",a.screenshot)&&S.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const w=[g,v,m,S].filter(T=>T.length>0),p=w.flat(),y=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!y.length&&p.length===0&&E.length===0)return null;const M=(t==null?void 0:t.position)??"top-right",x=(t==null?void 0:t.visibility)==="always",R=M==="top-right"||M==="bottom-right",P=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",x?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),A={position:"absolute",pointerEvents:"auto",...Ss[M]};return r?f.jsx("div",{ref:n,style:A,className:`${P} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(Rs,{actions:p,leading:y,sliders:E})}):f.jsxs("div",{ref:n,style:A,className:`${P} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${R?"justify-end":"justify-start"}`,children:[y.length>0&&f.jsxs(f.Fragment,{children:[y.map(T=>T.menu?f.jsx(Ts,{icon:T.icon,title:T.title,menu:T.menu},T.id):f.jsx(rr,{icon:T.icon,label:T.label,title:T.title,active:T.active,disabled:T.disabled,onClick:T.onClick??(()=>{})},T.id)),w.length>0&&f.jsx(or,{})]}),w.map((T,V)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[V>0&&f.jsx(or,{}),T.map(k=>f.jsx(rr,{icon:k.icon,title:k.title,active:k.active,disabled:k.disabled,onClick:k.onClick},k.id))]},T[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${R?"justify-end":"justify-start"}`,children:E.map(T=>f.jsx(sr,{spec:T},T.id))})]})}const ks={zoom:1,pan:{x:0,y:0}},ir=1.3,Ls=.25,Bs=64,Is={buttons:{zoom:!1}};function Os(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Fs=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function nn(e,t){return{id:"colormap",title:"Colormap",menu:{options:Fs,value:e,onSelect:t}}}function Us({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:i,naturalHeight:s,minZoom:l=Ls,maxZoom:a=Bs,requestRender:u,onReset:d,extraModified:b=!1}){const h=c.useCallback(x=>{var U;if(!o)return;const R=(U=e.current)==null?void 0:U.getBoundingClientRect(),_=(R==null?void 0:R.width)??0,P=(R==null?void 0:R.height)??0,A=i&&s&&_>0&&P>0?Yt(i,s,_,P):a,B=Math.max(l,Math.min(A,n*x));if(B===n)return;const C=_/2,T=P/2,V=C-(C-r.x)/n*B,k=T-(T-r.y)/n*B;o({zoom:B,pan:{x:V,y:k}})},[o,e,i,s,a,l,n,r.x,r.y]),g=c.useCallback(()=>h(ir),[h]),v=c.useCallback(()=>h(1/ir),[h]),m=c.useCallback(()=>{o==null||o(ks),d==null||d()},[o,d]),S=c.useCallback(x=>{const R={scale:x==null?void 0:x.scale,filename:x==null?void 0:x.filename};u==null||u();const _=t==null?void 0:t.current;if(_)return tr(_,R);const P=e.current;return P?bs(P,R):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),w=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),p=n!==1||r.x!==0||r.y!==0||b,y=c.useCallback(x=>{},[]),E=c.useCallback(x=>{},[]),M=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:w,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:p,setDragMode:y,setHoverMode:E,toggleSpikelines:M,zoomIn:g,zoomOut:v,autoscale:m,reset:m,toPNG:S}),[w,p,y,E,M,g,v,m,S])}const Ns={zoom:1,pan:{x:0,y:0}};function _t({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:i,pan:s,onViewportChange:l,naturalDims:a,checkerboard:u,wrapperClassName:d,wrapperStyle:b,viewportPadding:h,header:g,surface:v,showAxes:m,overlayNode:S,overlay:w,notationSeed:p,exportCanvasRef:y,requestRender:E,leadingMenus:M,displayAdjust:x,depthSlider:R,onReset:_,extraModified:P,label:A,showLabelChip:B,isDraggable:C=!1,onDragStart:T,extraChips:V}){const[k,U]=c.useState(p),[N,K]=c.useState(!1),{containerProps:ee}=Bn({containerRef:r,zoom:i,pan:s,onViewportChange:l,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h}),X=c.useCallback(()=>{x==null||x.onExposureChange(0),x==null||x.onOffsetChange(0),_==null||_()},[x,_]),ve=c.useCallback(()=>{l==null||l(Ns),X()},[l,X]),ue=Us({rootRef:r,canvasRef:y,zoom:i,pan:s,onViewportChange:l,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h,requestRender:E,onReset:X,extraModified:((x==null?void 0:x.exposureEV)??0)!==0||((x==null?void 0:x.offset)??0)!==0||!!P}),oe=c.useMemo(()=>{const me=[];if(R&&me.push(R),!x)return me.length?me:void 0;const j=(q,W)=>`${q>=0?"+":"−"}${Math.abs(q).toFixed(W)}`;return me.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:x.exposureEV,onChange:x.onExposureChange,format:q=>j(q,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:x.offset,onChange:x.onOffsetChange,format:q=>j(q,2)}),me},[x,R]),_e=c.useMemo(()=>({...Is,leadingButtons:[...M??[],...N?[Os(k,U)]:[]],sliders:oe}),[N,k,M,oe]),we=" cairn-checkerboard",ye="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?we:""),Ce=d+(u==="wrapper"?we:""),ae="render"in w?w.render({notation:k,setOverlayActive:K}):w.hasSource&&a?f.jsx(nt,{imageElRef:w.displayElRef,naturalWidth:a.w,naturalHeight:a.h,zoom:i,pan:s,sourceWindow:w.sourceWindow,sample:w.sample,notation:k,version:w.version,onActiveChange:K}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[g,n&&f.jsx(Ds,{controller:ue,config:_e}),f.jsxs("div",{ref:r,className:ye,style:{padding:h,...ee.style},onPointerDown:ee.onPointerDown,onPointerMove:ee.onPointerMove,onPointerUp:ee.onPointerUp,onPointerCancel:ee.onPointerCancel,onDoubleClick:ve,...t,children:[f.jsxs("div",{ref:o,className:Ce,style:b,children:[v,m&&a&&f.jsx(ds,{naturalWidth:a.w,naturalHeight:a.h,zoom:i,containerRef:o}),S]}),ae,!n&&N&&f.jsx(On,{notation:k,onChange:U})]}),B&&f.jsx(ps,{label:A,isDraggable:C,onDragStart:T}),V]})}const ar={inFlight:!1,pending:null};function Gs(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function zs(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:ar,launch:null}}const Vs=1e3,$s=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),cr=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function lr(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,i=t!=null,[s,l,a]=ut(o),[u,d]=c.useState(null),b=c.useRef(n);b.current=n;const h=c.useRef(o);h.current=o;const g=c.useRef(s),v=c.useRef(ar),m=c.useRef(null),S=c.useCallback(x=>{const R=b.current;if(!R)return;const _=()=>{const P=zs(v.current);v.current=P.state,P.launch!=null&&S(P.launch)};R.flatten(x).then(P=>{g.current===x&&x<h.current&&(m.current!=null&&cr(m.current),m.current=$s(()=>{m.current=null,d(P)})),_()}).catch(_)},[]),w=c.useCallback(x=>{const R=Gs(v.current,x);v.current=R.state,R.launch!=null&&S(R.launch)},[S]);c.useEffect(()=>()=>{m.current!=null&&cr(m.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(n){if(g.current=s,i){t(s);return}if(s>=o){d(null);return}w(s)}},[n,s,o,w,i,t]);const p=c.useMemo(()=>n&&!i&&u!=null?{...e,data:u}:e,[e,n,i,u]),y=n!=null&&r>0&&o/r>Vs,E=c.useMemo(()=>{if(!n||!(o>r))return;const x=R=>Math.abs(R)>=1e3||Math.abs(R)<.01?R.toExponential(2):R.toFixed(3);if(y){const R=Math.log10(r),_=Math.log10(o);return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this (log scale). Double-click to type a Z.",min:R,max:_,step:(_-R)/200,value:Math.log10(Math.max(r,Math.min(s,o))),onChange:P=>l(10**P),format:P=>x(10**P)}}return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this. Double-click to type a Z.",min:r,max:o,step:(o-r)/200,value:s,onChange:R=>l(R),format:R=>x(R)}},[n,r,o,s,y,l]),M=c.useCallback(()=>{a.reset(),d(null)},[a]);return{hdr:p,slider:E,reset:M,isModified:a.isModified}}function ur(e){return"hdr"in e&&e.hdr!=null}function fr(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Pe(e){return Number.isFinite(e)?e:0}const Xs={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ws(e,t,n,r,o=0){const{h:i,w:s,c:l}=fr(e.shape),a=e.precision==="f16-bits"?Tn(e.data):e.data,u=xo(t),d=new Uint8ClampedArray(s*i*4);for(let b=0;b<s*i;b++){const h=b*l;let g,v,m,S=1;l===1?g=v=m=Pe(a[h]):l===3?(g=Pe(a[h]),v=Pe(a[h+1]),m=Pe(a[h+2])):(g=Pe(a[h]),v=Pe(a[h+1]),m=Pe(a[h+2]),S=Pe(a[h+3]));const w=[pt(g,n,o),pt(v,n,o),pt(m,n,o)],[p,y,E]=u(w),M=b*4;d[M]=255*Gt(p,r),d[M+1]=255*Gt(y,r),d[M+2]=255*Gt(E,r),d[M+3]=255*(S<0?0:S>1?1:S)}return new ImageData(d,s,i)}function Hs(e){var De,$;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:i="auto",colormap:s="none",showAxes:l=!1,processing:a=Xs,zoom:u=1,pan:d={x:0,y:0},onViewportChange:b,onNaturalSize:h,label:g,isDraggable:v=!1,onDragStart:m,overlay:S,overlaySettings:w,pixelValueNotation:p="decimal",toolbar:y=!0}=e,[E,M,x]=ut(s);c.useEffect(()=>{M(s)},[s,M]);const R=c.useRef(null),_=c.useRef(null),P=c.useRef(null),A=c.useRef(null),B=c.useRef(null),C=c.useRef(null),T=c.useRef(null),[V,k]=c.useState(0),U=c.useCallback(()=>k(D=>D+1),[]),N=c.useMemo(()=>({get current(){const D=B.current;return D instanceof HTMLCanvasElement?D:null}}),[]),K=c.useCallback(D=>{R.current=D,D&&(B.current=D)},[]),ee=c.useCallback(D=>{_.current=D,D&&(B.current=D)},[]),X=c.useCallback(D=>{D&&(B.current=D)},[]),[ve,ue]=c.useState(!1),[oe,_e]=c.useState(!1),[we,ye]=c.useState(null),{flipSign:Ce}=a,{gammaFilterId:ae,filterStr:me,gamma:j,offset:q}=Qn(a),W=!r&&o!=="none"&&n!=null&&t!=null,Ee=o!=="none"&&n!=null,he=E!=="none"&&!W&&!(r&&Ee)&&t!=null;c.useEffect(()=>{if(!he||!t){_e(!1);return}let D=!1;_e(!1);const F=`${t}::${E}`,O=$t(F);if(O){const I=_.current;if(I){I.width=O.width,I.height=O.height;const Q=I.getContext("2d");Q&&Q.putImageData(O,0,0),T.current=O,U(),ye({w:O.width,h:O.height}),h==null||h(O.width,O.height),_e(!0)}return}const G=new Image;return G.onload=()=>{if(D)return;const I=document.createElement("canvas");I.width=G.naturalWidth,I.height=G.naturalHeight;const Q=I.getContext("2d");if(!Q)return;Q.drawImage(G,0,0);const le=Q.getImageData(0,0,I.width,I.height),fe=Vt(E),te=zt(le,E,fe);Xt(F,te);const ge=_.current;if(!ge||D)return;ge.width=te.width,ge.height=te.height;const se=ge.getContext("2d");se&&se.putImageData(te,0,0),T.current=te,U(),ye({w:te.width,h:te.height}),h==null||h(te.width,te.height),_e(!0)},G.src=t,()=>{D=!0}},[he,t,E]);const ce=c.useCallback((D,F)=>{ye(O=>O&&O.w===D&&O.h===F?O:{w:D,h:F}),h==null||h(D,F)},[]);c.useEffect(()=>{if(!t){C.current=null,T.current=null,U();return}let D=!1;return Je(t).then(F=>{D||(C.current=F,E==="none"&&(T.current=F),U())}),()=>{D=!0}},[t,E,U]);const xe=c.useCallback((D,F,O)=>{const G=C.current;if(!G||D<0||F<0||D>=G.width||F>=G.height)return null;const I=(F*G.width+D)*4,Q=G.data[I],le=G.data[I+1],fe=G.data[I+2],te=T.current;let ge=Q,se=le,ke=fe;if(te&&te.width===G.width&&te.height===G.height){const Se=(F*te.width+D)*4;ge=te.data[Se],se=te.data[Se+1],ke=te.data[Se+2]}const Fe=(.299*ge+.587*se+.114*ke)/255;return tt(E!=="none"||Q===le&&le===fe?[Q]:[Q,le,fe],"uint8",O,Fe)},[E]);c.useEffect(()=>{if(!W){ue(!1);return}let D=!1;const F=Do(),O=F==="gpu"||F==="auto",G=`${n}::${t}::${o}::${E}`;if(F!=="gpu"){const I=$t(G);if(I){const Q=R.current;if(Q){(Q.width!==I.width||Q.height!==I.height)&&(Q.width=I.width,Q.height=I.height);const le=Q.getContext("2d");le&&le.putImageData(I,0,0),ce(I.width,I.height),ue(!0)}return}}return(async()=>{const[I,Q]=await Promise.all([Je(n),Je(t)]);if(D||!I||!Q)return;const fe=o.includes("signed")?"signed":"positive",te=E!=="none"?Ft(E):null,ge={diffMode:o,colormap:te,cmapMode:fe};if(O)try{const Ue=R.current;if(Ue){const Se=Co(I,Q,ge,Ue);if(Se){if(D)return;ce(Se.width,Se.height),ue(!0);return}}}catch(Ue){console.warn("[cairn] WebGL 2 diff error:",Ue)}if(F==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let se=Eo(I,Q,o);E!=="none"&&(se=zt(se,E,fe)),Xt(G,se);const ke=R.current;if(!ke||D)return;(ke.width!==se.width||ke.height!==se.height)&&(ke.width=se.width,ke.height=se.height);const Fe=ke.getContext("2d");Fe&&Fe.putImageData(se,0,0),ce(se.width,se.height),ue(!0)})(),()=>{D=!0}},[n,t,o,W,E,h]);const Me=i==="auto"?void 0:i,Te=Ce?{filter:"invert(1)"}:{},Oe=S&&(w!=null&&w.enabled)&&we&&t&&((((De=S.boxes)==null?void 0:De.length)??0)>0||((($=S.masks)==null?void 0:$.length)??0)>0)?f.jsx(qt,{data:S,settings:w,naturalWidth:we.w,naturalHeight:we.h}):void 0,Qe=t?W?f.jsxs(f.Fragment,{children:[!ve&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:K,className:"w-full h-full object-contain block",style:{display:ve?"block":"none",imageRendering:Me,...Te}})]}):he?f.jsxs(f.Fragment,{children:[!oe&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:ee,className:"w-full h-full object-contain block",style:{display:oe?"block":"none",imageRendering:Me,...Te}})]}):f.jsx("img",{ref:X,src:t,alt:g,className:"w-full h-full object-contain block",draggable:!1,style:{filter:me,imageRendering:Me},onLoad:D=>{const F=D.currentTarget;ye({w:F.naturalWidth,h:F.naturalHeight}),h==null||h(F.naturalWidth,F.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(_t,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:y,paneRef:P,wrapperRef:A,zoom:u,pan:d,onViewportChange:b,naturalDims:we,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:l&&we?"16px 4px 4px 28px":"4px",header:f.jsx(jn,{id:ae,gamma:j,offset:q}),surface:Qe,showAxes:l,overlayNode:Oe,overlay:{displayElRef:B,sample:xe,version:V,hasSource:!!t},notationSeed:p,exportCanvasRef:N,leadingMenus:[nn(E,D=>M(D))],onReset:x.reset,extraModified:x.isModified,label:g,showLabelChip:!0,isDraggable:v,onDragStart:m})}function Ys(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:i="",interpolation:s="auto",zoom:l=1,pan:a={x:0,y:0},onViewportChange:u,pixelValueNotation:d="decimal",toolbar:b=!0}=e,h=lr(e.hdr),g=h.hdr,v=c.useRef(null),m=c.useRef(null),S=c.useRef(null),[w,p]=c.useState(null),y=c.useRef(null),[E,M]=c.useState(0),[x,R]=c.useState(0),[_,P]=c.useState(0);c.useEffect(()=>{const C=v.current;if(!C)return;let T;try{T=Ws(g,t,n+x,r,_)}catch(k){console.error("[cairn] HDR tone-map error:",k);return}(C.width!==T.width||C.height!==T.height)&&(C.width=T.width,C.height=T.height);const V=C.getContext("2d");V&&(V.putImageData(T,0,0),y.current=T,M(k=>k+1),p(k=>k&&k.w===T.width&&k.h===T.height?k:{w:T.width,h:T.height}))},[g,t,n,r,x,_]);const A=c.useCallback((C,T,V)=>{const k=w;if(!k||C<0||T<0||C>=k.w||T>=k.h)return null;const U=g.shape.length===2?1:g.shape[2]??1,N=(T*k.w+C)*U,K=g.data,ee=g.precision==="f16-bits"?oe=>gt(K[oe]??0):oe=>K[oe]??0,X=y.current;let ve=.5;if(X&&X.width===k.w&&X.height===k.h){const oe=(T*k.w+C)*4;ve=(.299*X.data[oe]+.587*X.data[oe+1]+.114*X.data[oe+2])/255}const ue=U===1?[ee(N)]:[ee(N),ee(N+1),ee(N+2)];return tt(ue,"unit",V,ve)},[g,w]),B=s==="auto"?void 0:s;return f.jsx(_t,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:m,wrapperRef:S,zoom:l,pan:a,onViewportChange:u,naturalDims:w,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${a.x}px, ${a.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:o&&w?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:v,className:"w-full h-full object-contain block",style:{imageRendering:B}}),showAxes:o,overlay:{displayElRef:v,sample:A,version:E,hasSource:!0},notationSeed:d,exportCanvasRef:v,displayAdjust:{exposureEV:x,offset:_,onExposureChange:R,onOffsetChange:P},depthSlider:h.slider,onReset:h.reset,extraModified:h.isModified,label:i,showLabelChip:!!i})}function rn(e){return ur(e)?f.jsx(Ys,{...e}):f.jsx(Hs,{...e})}const dr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Ks="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function qs(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Zs(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Qs(e,t){if(e==="no-hdr-display")switch(Zs(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=qs(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function js(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function pr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const hr=new Set;function mr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return hr.has(e)}function Js(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}hr.add(e)}const gr=new Set;let Mt=null,it=null;function xr(){it&&it.parentNode&&it.parentNode.removeChild(it),it=null,Mt=null}function ei(e){const t=pr(e,window.location.pathname),n=Qs(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=js(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const i=document.createElement("div");i.textContent=n,i.style.marginBottom="4px";const s=document.createElement("a");s.href=Ks,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{Js(t),xr()}),r.appendChild(o),r.appendChild(i),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),it=r,Mt=e}function br(e){if(typeof document>"u"||typeof window>"u"||gr.has(e))return;gr.add(e);const t=pr(e,window.location.pathname);if(mr(t))return;const n=()=>{if(!mr(t)){if(Mt!==null)if(dr[e]<dr[Mt])xr();else return;ei(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const ti={data:new Float32Array(0),shape:[0,0],dtype:"<f4"},ni=["linear","srgb","reinhard","aces"];function ri(e){return e&&ni.includes(e)?e:"srgb"}function oi(e){const{h:t,w:n,c:r}=fr(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let a=0;a<n*t;a++){const u=a*r,d=a*4;if(r===1){const b=s[u];l[d]=b,l[d+1]=b,l[d+2]=b,l[d+3]=mt}else l[d]=s[u],l[d+1]=s[u+1],l[d+2]=s[u+2],l[d+3]=r>=4?s[u+3]:mt}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,i=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let a,u,d,b=1;r===1?a=u=d=Pe(o[l]):r===3?(a=Pe(o[l]),u=Pe(o[l+1]),d=Pe(o[l+2])):(a=Pe(o[l]),u=Pe(o[l+1]),d=Pe(o[l+2]),b=Pe(o[l+3]));const h=s*4;i[h]=a,i[h+1]=u,i[h+2]=d,i[h+3]=b}return{data:i,width:n,height:t,format:"rgba32float"}}function vr(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),i=n*o,s=r*o,l=(t.width-i)/2,a=(t.height-s)/2,u=Math.max(e.zoom,1e-6),d=t.width/(u*i),b=t.height/(u*s),h=-l/i-e.pan.x/(u*i),g=-a/s-e.pan.y/(u*s);return{x:h,y:g,w:d,h:b}}function wr(e,t,n,r){const o=e.w*n,i=e.h*r;return o<=0||i<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/i)}function si(e){var Oe,Qe,De;const t=ur(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),i=c.useRef(null),s=c.useRef(null),l=t&&!!((Oe=e.hdr)!=null&&Oe.deep),a=c.useCallback($=>{var D,F;(D=i.current)==null||D.setDeepZClip($),(F=s.current)==null||F.call(s)},[]),u=lr(t?e.hdr:ti,l?a:void 0),d=c.useRef(!1),[b,h]=c.useState(!1),[g,v]=c.useState(!1),[m,S]=c.useState(null),[w,p]=c.useState(0),[y,E]=c.useState(0),[M,x]=c.useState({x:0,y:0,w:1,h:1}),R=c.useRef(null),_=c.useRef(null),[P,A]=c.useState(0),B=e.zoom??1,C=e.pan??{x:0,y:0},T=e.onViewportChange,V=t?"none":e.colormap??"none",[k,U]=c.useState(V);c.useEffect(()=>{U(V)},[V]);const N=t?"none":k,K=c.useRef(V),ee=c.useCallback(()=>{U(K.current)},[]),[X,ve]=c.useState(0),[ue,oe]=c.useState(0),_e=Kt();c.useEffect(()=>{const $=n.current;if(!$)return;let D=!1;return dt().then(F=>{var Q;if(D)return;const O=((Q=F.probeExtendedToneMapping)==null?void 0:Q.call(F))??!1,G=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,I=O&&G&&t;d.current=I,t&&!I&&br(O?"no-hdr-display":"no-hdr-browser"),us($,{hdr:I}).then(le=>{if(D){Zn(le);return}i.current=le,v(!0)}).catch(le=>{D||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",le),h(!0))})}).catch(F=>{D||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",F),h(!0))}),()=>{D=!0,i.current&&(Zn(i.current),i.current=null)}},[]),c.useEffect(()=>{const $=r.current;if(!$)return;const D=new ResizeObserver(()=>E(F=>F+1));return D.observe($),()=>D.disconnect()},[]),c.useEffect(()=>{const $=r.current;if(!$)return;const D=new IntersectionObserver(F=>{const O=F[0];if(!O)return;const G=i.current;G&&(G.setVisible(O.isIntersecting),O.isIntersecting?G.isParked&&(G.restore(),E(I=>I+1)):G.park())},{threshold:0});return D.observe($),()=>D.disconnect()},[]),c.useEffect(()=>{var F;if(!t||!g||l)return;const $=u.hdr;R.current=$;const D=oi($);(F=i.current)==null||F.setSource(D),S(O=>O&&O.w===D.width&&O.h===D.height?O:{w:D.width,h:D.height}),A(O=>O+1),p(O=>O+1)},[t,g,l,t?u.hdr:null]),c.useEffect(()=>{if(!t||!g||!l)return;const $=e.hdr,D=$.deep;R.current=$;let F=!1;return D.getGpuCsr().then(O=>{var G;F||((G=i.current)==null||G.setDeepSource(O,D.zMax),S(I=>I&&I.w===O.width&&I.h===O.height?I:{w:O.width,h:O.height}),A(I=>I+1),p(I=>I+1))}).catch(O=>{F||console.warn("[cairn] deep GPU CSR upload failed:",O)}),()=>{F=!0}},[t,g,l,t?e.hdr.deep:null]),c.useEffect(()=>{if(t||!g)return;const $=e,D=$.imageUrl,F=k;if(!D){_.current=null,S(null),A(G=>G+1);return}let O=!1;return Je(D).then(G=>{var le,fe;if(O||!G)return;let I=G;if(F!=="none"){const te=`gpu::${D}::${F}::ev${X}::off${ue}`,ge=$t(te);if(ge)I=ge;else{const se=Vt(F);I=zt(G,F,se,X,ue),Xt(te,I)}}_.current=G;const Q={data:I.data,width:I.width,height:I.height,format:"rgba8unorm"};(le=i.current)==null||le.setSource(Q),S(te=>te&&te.w===I.width&&te.h===I.height?te:{w:I.width,h:I.height}),(fe=$.onNaturalSize)==null||fe.call($,I.width,I.height),A(te=>te+1),p(te=>te+1)}),()=>{O=!0}},[t,g,t?null:e.imageUrl,t?null:k,t?0:X,t?0:ue]);const we=t?e.exposure??0:0,ye=t?e.tonemap:void 0,Ce=t?e.gamma:void 0,ae=c.useCallback(()=>{const $=i.current;if(!$||!g||!m)return;const D=r.current,F=o.current,O=F?F.getBoundingClientRect():D?D.getBoundingClientRect():{width:m.w,height:m.h},G=vr({zoom:B,pan:C},O,m.w,m.h);x(fe=>fe.x===G.x&&fe.y===G.y&&fe.w===G.w&&fe.h===G.h?fe:G),O.width>0&&O.height>0&&$.resize(Math.round(O.width*_e),Math.round(O.height*_e));const I=wr(G,O,m.w,m.h)>=Zt?"nearest":"linear",Q=G,le=t?{exposureEV:we+X,offset:ue,operator:d.current?"extended":ri(ye),gamma:Ce,isScalar:!1,hdrOut:d.current,uv:Q,filter:I}:{exposureEV:N!=="none"?0:X,offset:N!=="none"?0:ue,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Q,filter:I};try{$.render(le)||h(!0)}catch(fe){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",fe),h(!0)}},[g,m,B,C.x,C.y,we,X,ue,ye,Ce,t,N,_e]);s.current=ae,c.useEffect(()=>{ae()},[ae,w,y]);const me=c.useCallback(($,D,F)=>{if(t){const ge=R.current,se=m;if(!ge||!se||$<0||D<0||$>=se.w||D>=se.h)return null;const ke=ge.shape.length===2?1:ge.shape[2]??1,Fe=(D*se.w+$)*ke,Ue=ge.data,Se=ge.precision==="f16-bits"?at=>gt(Ue[at]??0):at=>Ue[at]??0,Le=.5,rt=ke===1?[Se(Fe)]:[Se(Fe),Se(Fe+1),Se(Fe+2)];return tt(rt,"unit",F,Le)}const O=_.current;if(!O||$<0||D<0||$>=O.width||D>=O.height)return null;const G=(D*O.width+$)*4,I=O.data[G],Q=O.data[G+1],le=O.data[G+2],fe=(.299*I+.587*Q+.114*le)/255;return tt(N!=="none"||I===Q&&Q===le?[I]:[I,Q,le],"uint8",F,fe)},[t,m,N]),j=e.showAxes??!1,q=t?e.label??"":e.label,W=e.interpolation??"auto",Ee=W==="auto"?void 0:W,he=t?void 0:e.overlay,ce=t?void 0:e.overlaySettings,xe=t?!1:e.isDraggable??!1,Me=t?void 0:e.onDragStart;if(b)return t?f.jsx(rn,{...e}):f.jsx(rn,{...e});const Te=he&&(ce!=null&&ce.enabled)&&m&&((((Qe=he.boxes)==null?void 0:Qe.length)??0)>0||(((De=he.masks)==null?void 0:De.length)??0)>0)?f.jsx(qt,{data:he,settings:ce,naturalWidth:m.w,naturalHeight:m.h}):void 0;return f.jsx(_t,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":g},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:B,pan:C,onViewportChange:T,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:j&&m?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Ee},"data-gpu-image-canvas":!0}),showAxes:j,overlayNode:Te,overlay:{displayElRef:n,sample:me,version:P,hasSource:!0,sourceWindow:M},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ae,leadingMenus:t?void 0:[nn(N,$=>U($))],displayAdjust:{exposureEV:X,offset:ue,onExposureChange:ve,onOffsetChange:oe},depthSlider:u.slider,onReset:()=>{ee(),u.reset()},extraModified:k!==K.current||u.isModified,label:q,showLabelChip:!!q,isDraggable:xe,onDragStart:Me})}const St=new Map;function Xe(e){if(St.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);St.set(e.id,e)}function Ze(e){return St.get(e)}function ii(){return Array.from(St.values())}function yr(e,t){return{...e.params??{},...t??{}}}const ai={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ci={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},li={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},ui={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},fi={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},di={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Er=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];hi(Er);const on=[1.052156925,1,.91835767],pi=.7;function hi(e){const[t,n,r]=e[0],[o,i,s]=e[1],[l,a,u]=e[2],d=i*u-s*a,b=-(o*u-s*l),h=o*a-i*l,v=1/(t*d+n*b+r*h);return[[d*v,-(n*u-r*a)*v,(n*s-r*i)*v],[b*v,(t*u-r*l)*v,-(t*s-r*o)*v],[h*v,-(t*a-n*l)*v,(t*i-n*o)*v]]}function mi(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const sn=6/29;function an(e){return e>sn**3?Math.cbrt(e):e/(3*sn*sn)+4/29}function _r(e,t,n){const[r,o,i]=mi(Er,e,t,n),s=an(r*on[0]),l=an(o*on[1]),a=an(i*on[2]),u=116*l-16,d=500*(s-l),b=200*(l-a);return[u,.01*u*d,.01*u*b]}function gi(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function xi(){const e=_r(0,1,0),t=_r(0,0,1);return Math.pow(gi(e,t),pi)}const Mr=xi(),bi=.082;function Sr(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],i=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(i/(2*Math.PI**2))*e),l=1/e,a=Math.PI**2,u=[0,0,0];for(let d=-s;d<=s;d++)for(let b=-s;b<=s;b++){const h=(b*l)**2+(d*l)**2;for(let g=0;g<3;g++)u[g]+=t[g]*Math.sqrt(Math.PI/n[g])*Math.exp(-a*h/n[g])+r[g]*Math.sqrt(Math.PI/o[g])*Math.exp(-a*h/o[g])}return{r:s,deltaX:l,sums:u}}function Pr(e){const t=.5*bi*e,n=Math.ceil(3*t);let r=0,o=0,i=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const a=Math.exp(-(l*l+s*s)/(2*t*t)),u=-l*a,d=(l*l/(t*t)-1)*a;u>0&&(r+=u),d>0?o+=d:i-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:i}}const vi=`
${Ie}
${wt}
${st}
${vt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,wi=`
${Ie}
${wt}
${st}
${vt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,Pt=`
${Ie}
${wt}
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
`,Tr=`
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
`;function We(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Tt(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},i=r!=null&&r.fill?1:0;return[We(e,[o.x,o.y,i,0]),We(e+1,[n.width,n.height,0,0])]}function At(e){return[We(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),We(2,[e.sums[2],0,0,0])]}function Ar(e){return[We(4,[Mr,e.sd,e.r,e.edgeNorm]),We(5,[e.pointPos,e.pointNeg,0,0])]}function Cr(e,t,n,r,o,i=""){const s=Sr(e),l=Pr(e),a=`ycxczA${i}`,u=`ycxczB${i}`,d=`labA${i}`,b=`labB${i}`,h=`flip${i}`;return{passes:[{name:a,shader:t,inputs:[n],output:a,uniforms:()=>Tt(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>Tt(1,"b",o)},{name:d,shader:Pt,inputs:[a],output:d,uniforms:()=>At(s)},{name:b,shader:Pt,inputs:[u],output:b,uniforms:()=>At(s)},{name:h,shader:Tr,inputs:[d,b,a,u],output:h,uniforms:()=>Ar(l)}],flipRef:h}}const yi={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Cr(t,vi,"srcA","srcB",e);return{passes:n,final:r}}},Ei={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Cr(t,wi,"srcA","srcB",e);return{passes:n,final:r}}},Rr=`
${Ie}
${wt}
${st}
${vt}
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
`,_i=`
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
`,Mi={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),i=(r-n)/Math.max(o-1,1),s=Sr(t),l=Pr(t),a=[];let u=null;for(let d=0;d<o;d++){const b=n+d*i,h=`_e${d}`,g=`ycxczA${h}`,v=`ycxczB${h}`,m=`labA${h}`,S=`labB${h}`,w=`acc${h}`;a.push({name:g,shader:Rr,inputs:["srcA"],output:g,uniforms:()=>[We(1,[b,0,0,0]),...Tt(2,"a",e)]},{name:v,shader:Rr,inputs:["srcB"],output:v,uniforms:()=>[We(1,[b,0,0,0]),...Tt(2,"b",e)]},{name:m,shader:Pt,inputs:[g],output:m,uniforms:()=>At(s)},{name:S,shader:Pt,inputs:[v],output:S,uniforms:()=>At(s)}),u===null?a.push({name:w,shader:Tr,inputs:[m,S,g,v],output:w,uniforms:()=>Ar(l)}):a.push({name:w,shader:_i,inputs:[m,S,g,v,u],output:w,uniforms:()=>[We(5,[Mr,l.sd,l.r,l.edgeNorm]),We(6,[l.pointPos,l.pointNeg,0,0])]}),u=w}return{passes:a,final:u}}},Si=.01,Pi=.03,Dr=1,kr=1.5,Lr=5,Br=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,Ti=`
${Ie}
${Br}
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
`,Ai=`
${Ie}
${Br}
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
`,Ir=`
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
`,Ci=`
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
`;function cn(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Or(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Ir,inputs:[e],output:n,uniforms:()=>[cn(1,[1,0,Lr,kr])]},{name:r,shader:Ir,inputs:[n],output:r,uniforms:()=>[cn(1,[0,1,Lr,kr])]}],out:r}}const Ri={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(Si*Dr)**2,n=(Pi*Dr)**2,r=Or("momA","statsA"),o=Or("momB","statsB");return{passes:[{name:"momA",shader:Ti,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:Ai,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:Ci,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[cn(2,[t,n,0,0])]}],final:"ssim"}}};let Fr=!1;function Di(){Fr||(Fr=!0,Xe(ci),Xe(ai),Xe(li),Xe(fi),Xe(ui),Xe(di),Xe(yi),Xe(Mi),Xe(Ei),Xe(Ri))}Di();function Ur(){const e=[];for(const n of ii())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=Ze("ssim");return t&&e.push({id:t.id,label:t.label}),e}function ki(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Nr=new WeakMap;function ln(e,t,n,r){let o=Nr.get(e);o||(o=new Map,Nr.set(e,o));const i=`${t}::${r}`;let s=o.get(i);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(i,s)),s}function Li(e){return`
${Ie}
${st}
${vt}
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
`}const Ct="rgba16float";function Bi(e,t,n,r,o,i){var S,w;const s=Ze(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=i??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=l.result.w,u=l.result.h,d=l.fit==="fill"?1:0,b=yr(s,o);if(s.kind==="pointwise"){const p=e.createTexture(a,u,Ct),y=ln(e,`pw:${s.id}`,Li(s.source),Ct),E=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),M=new Float32Array([a,u,d,0]);let x;try{x=e.createBindGroup(y,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:M}}]),e.renderFullscreen(p,y,x)}finally{(S=x==null?void 0:x.destroy)==null||S.call(x)}return p}const h={width:a,height:u,params:b,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},g=s.buildPasses(h),v=new Map([["srcA",t],["srcB",n]]),m=[];try{for(const y of g.passes){const E=e.createTexture(a,u,Ct);m.push(E),v.set(y.output,E);const M=ln(e,`mp:${s.id}:${y.name}`,y.shader,Ct),x=y.inputs.map((_,P)=>{const A=v.get(_);if(!A)throw new Error(`computeDiff: pass "${y.name}" input "${_}" not produced yet`);return{binding:P,resource:A}});y.uniforms&&x.push(...y.uniforms(h));let R;try{R=e.createBindGroup(M,x),e.renderFullscreen(E,M,R)}finally{(w=R==null?void 0:R.destroy)==null||w.call(R)}}const p=v.get(g.final);if(!p)throw new Error(`computeDiff: final ref "${g.final}" not produced`);for(const y of m)y!==p&&y.destroy();return p}catch(p){for(const y of m)y.destroy();throw p}}const Ii=8,Oi=256*1024*1024;class Fi{constructor(t=Ii,n=Oi){re(this,"map",new Map);re(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Gr=new WeakMap;function zr(e){let t=Gr.get(e);return t||(t=new Fi,Gr.set(e,t)),t}function Ui(e,t){const n=yr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Ni(e,t,n,r,o){const i=Ze(n),s=i?Ui(i,r):"",l=o?ts(o):"";return`${e}|${t}|${n}|${s}|${l}`}function Gi(e,t,n,r,o,i,s,l){const a=Ze(r);if(!a)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=zr(e),d=l??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),b=Ni(i,s,r,o,d),h=u.get(b);if(h)return h;const g=Bi(e,t,n,r,o,d),v=d.result.w,m=d.result.h,S={texture:g,width:v,height:m,displayRange:a.displayRange,bytes:v*m*8};return u.set(b,S),S}async function zi(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Xn(e,n,r,o).then(i=>(t.scalars=i,i))),t.scalarsPending)}async function Vi(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,zr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const $i=`
${Ie}
${st}
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
`,Xi={unit:0,signed:1,relative:2},Wi={linear:0,signed:1,positive:2};function Hi(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Yi(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Ki(e,t,n,r,o){var g,v,m;const i=Yi(t),s=ln(e,"diff-display",$i,i),l=Hi(e,o.colormap),a=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([Xi[r],Wi[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),b=new Float32Array([((g=o.sourceDims)==null?void 0:g.w)??0,((v=o.sourceDims)==null?void 0:v.h)??0,0,0]);let h;try{h=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:a}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,s,h)}finally{(m=h==null?void 0:h.destroy)==null||m.call(h),l.destroy()}}const Vr=.6*.6*2.51,qi=.6*.03,Zi=0,$r=.6*.6*2.43,Qi=.6*.59,ji=.14;function Xr(e){const t=(qi-Qi*e)/(Vr-$r*e),n=(Zi-ji*e)/(Vr-$r*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Ji=.85,ea=.85,Wr=11920928955078125e-23,un=[.2126,.7152,.0722];function ta(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function na(e,t,n,r=3,o={}){const i=t*n,s=Xr(Ji),l=Xr(ea),a=new Float64Array(i);let u=0;for(let p=0;p<i;p++){const[y,E,M]=ta(e,p,r),x=y*un[0]+E*un[1]+M*un[2];a[p]=x,x>u&&(u=x)}const d=Float64Array.from(a).sort(),b=i>>1,h=i%2===1?d[b]:d[b-1],g=Math.max(h,Wr),v=Math.max(u,Wr),m=o.startExposure??Math.log2(s/v),S=o.stopExposure??Math.log2(l/g),w=Math.max(2,Math.ceil(S-m));return{startExposure:m,stopExposure:S,numExposures:w}}const ra={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function oa({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:i,zoom:s,pan:l,onViewportChange:a,processing:u=ra,interpolation:d="auto",label:b="",isDraggable:h=!1,onDragStart:g,overlay:v,overlaySettings:m,pixelValueNotation:S="decimal"}){var ae,me;const w=c.useRef(null),[p,y]=c.useState(null),[E,M]=c.useState(null),[x,R]=c.useState(S),[_,P]=c.useState(!1),A=c.useRef(null),B=c.useRef(null),C=c.useRef(null),T=c.useRef(null),[V,k]=c.useState(0);c.useEffect(()=>{if(!e){C.current=null,k(q=>q+1);return}let j=!1;return Je(e).then(q=>{j||(C.current=q,k(W=>W+1))}),()=>{j=!0}},[e]),c.useEffect(()=>{if(!t){T.current=null,k(q=>q+1);return}let j=!1;return Je(t).then(q=>{j||(T.current=q,k(W=>W+1))}),()=>{j=!0}},[t]);const U=j=>(q,W,Ee)=>{const he=j.current;if(!he||q<0||W<0||q>=he.width||W>=he.height)return null;const ce=(W*he.width+q)*4,xe=he.data[ce],Me=he.data[ce+1],Te=he.data[ce+2],Oe=(.299*xe+.587*Me+.114*Te)/255;return xe===Me&&Me===Te?{lines:[ot(xe,"uint8",Ee)],luminance:Oe}:{lines:[ot(xe,"uint8",Ee),ot(Me,"uint8",Ee),ot(Te,"uint8",Ee)],luminance:Oe,colors:[bt[0],bt[1],bt[2]]}},N=c.useMemo(()=>U(C),[]),K=c.useMemo(()=>U(T),[]),ee=!!v&&!!(m!=null&&m.enabled)&&!!p&&!!e&&((((ae=v.boxes)==null?void 0:ae.length)??0)>0||(((me=v.masks)==null?void 0:me.length)??0)>0),{gammaFilterId:X,filterStr:ve,gamma:ue,offset:oe}=Qn(u),_e=`translate(${l.x}px, ${l.y}px) scale(${s})`,we=d==="auto"?void 0:d,{containerProps:ye,modifierActive:Ce}=Bn({containerRef:w,zoom:s,pan:l,onViewportChange:a});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(jn,{id:X,gamma:ue,offset:oe}),f.jsxs("div",{ref:w,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...ye.style},onPointerDown:ye.onPointerDown,onPointerMove:ye.onPointerMove,onPointerUp:ye.onPointerUp,onPointerCancel:ye.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:_e,transformOrigin:"0 0"},children:[f.jsx("img",{ref:A,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ve,imageRendering:we,...n==="blend"?{opacity:o}:{}},onLoad:j=>{const q=j.currentTarget;y({w:q.naturalWidth,h:q.naturalHeight})}}),ee&&f.jsx(qt,{data:v,settings:m,naturalWidth:p.w,naturalHeight:p.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:_e,transformOrigin:"0 0"},children:f.jsx("img",{ref:B,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ve,imageRendering:we,...n==="blend"?{opacity:1-o}:{}},onLoad:j=>{const q=j.currentTarget;M({w:q.naturalWidth,h:q.naturalHeight})}})})}),n==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>i==null?void 0:i(.5),onPointerDown:j=>{j.stopPropagation(),j.preventDefault();const q=j.currentTarget;try{q.setPointerCapture(j.pointerId)}catch{}const Ee=q.parentElement.getBoundingClientRect(),he=xe=>{i==null||i(Math.max(0,Math.min(1,(xe.clientX-Ee.left)/Ee.width)))},ce=()=>{window.removeEventListener("pointermove",he),window.removeEventListener("pointerup",ce)};window.addEventListener("pointermove",he),window.addEventListener("pointerup",ce)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(nt,{imageElRef:B,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:l,sample:K,notation:x,version:V})}),e&&p&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(nt,{imageElRef:A,naturalWidth:p.w,naturalHeight:p.h,zoom:s,pan:l,sample:N,notation:x,version:V,onActiveChange:P})})]}):e&&p&&f.jsx(nt,{imageElRef:A,naturalWidth:p.w,naturalHeight:p.h,zoom:s,pan:l,sample:N,notation:x,version:V,onActiveChange:P}),_&&f.jsx(On,{notation:x,onChange:R})]}),n==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),f.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!Ce?" cairn-drag-grip":""}`,draggable:h&&!Ce,onDragStart:g,style:{cursor:h&&!Ce?"grab":void 0},children:[f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),b]})]})}function sa(){return f.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function ia({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:i,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?s==null||s():u==="slide"?r():u==="blend"?o():i(u)}}}}function aa(e){const t=Ft(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function ca(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const a=e.data,u=new Uint16Array(o*4);for(let d=0;d<o;d++){const b=d*r,h=d*4;if(r===1){const g=a[b];u[h]=g,u[h+1]=g,u[h+2]=g,u[h+3]=mt}else u[h]=a[b],u[h+1]=a[b+1],u[h+2]=a[b+2],u[h+3]=r>=4?a[b+3]:mt}return{data:u,format:"rgba16float"}}const i=e.data,s=new Float32Array(o*4),l=a=>Number.isFinite(a)?a:0;for(let a=0;a<o;a++){const u=a*r;let d,b,h,g=1;r===1?d=b=h=l(i[u]):r===3?(d=l(i[u]),b=l(i[u+1]),h=l(i[u+2])):(d=l(i[u]),b=l(i[u+1]),h=l(i[u+2]),g=l(i[u+3]));const v=a*4;s[v]=d,s[v+1]=b,s[v+2]=h,s[v+3]=g}return{data:s,format:"rgba32float"}}function la({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,diffSubmode:a,colormap:u="none",align:d="top-left",fit:b="crop",diffKernel:h,onDiffKernelChange:g,onCompareModeChange:v,onRequestSide:m,zoom:S,pan:w,onViewportChange:p,interpolation:y="auto",label:E="",pixelValueNotation:M="decimal"}){var Kr;const x=c.useRef(null),R=c.useRef(null),_=c.useRef(null),P=c.useRef(null),A=c.useRef(null),[B,C]=c.useState(!1),[T,V]=c.useState(!1),[k,U]=c.useState(null),[N,K]=c.useState(null),[ee,X]=c.useState(0),[ve,ue]=c.useState(0),[oe,_e]=c.useState(null),[we,ye]=c.useState({x:0,y:0,w:1,h:1}),Ce=h??a??"absolute",[ae,me,j]=ut(Ce);c.useEffect(()=>{me(h??a??"absolute")},[h,a,me]);const q=c.useCallback(L=>{me(L),g==null||g(L)},[g,me]);c.useEffect(()=>{const L=x.current;if(L)return L.__cairnDiffKernel={current:ae,set:q},()=>{L&&delete L.__cairnDiffKernel}},[ae,q]);const[W,Ee,he]=ut(o);c.useEffect(()=>{Ee(o)},[o,Ee]);const ce=c.useCallback(L=>{Ee(L),v==null||v(L)},[v,Ee]),[xe,Me,Te]=ut(u);c.useEffect(()=>{Me(u)},[u,Me]);const Oe=c.useCallback(()=>{ce(he.default),Me(Te.default),q(j.default)},[ce,Me,q,he.default,Te.default,j.default]),Qe=he.isModified||Te.isModified||j.isModified,[De,$]=c.useState(0),[D,F]=c.useState(0),O=c.useMemo(()=>{const H=[ia({mode:W,kernel:ae,kernelOptions:Ur().map(Y=>({id:Y.id,label:Y.label})),onSide:m,onSlide:()=>ce("split"),onBlend:()=>ce("blend"),onKernel:Y=>{ce("diff"),q(Y)}})];return W==="diff"&&H.push(nn(xe,Y=>Me(Y))),H},[W,ae,xe,q,ce,m]),G=c.useRef(null),I=c.useRef(null),Q=c.useRef(null),le=c.useRef(null),[fe,te]=c.useState(0),ge=c.useRef(null),se=c.useRef(null),[ke,Fe]=c.useState(0),Ue=Kt();c.useEffect(()=>{const L=_.current;if(!L)return;let H=!1;return dt().then(Y=>{if(!H)try{if(Hn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const z=Y.createSurface(L,{hdr:!1});P.current={device:Y,surface:z,texA:null,texB:null},V(!0)}catch(z){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",z),C(!0)}}).catch(Y=>{H||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",Y),C(!0))}),()=>{var z,J;H=!0;const Y=P.current;Y&&((z=Y.texA)==null||z.destroy(),(J=Y.texB)==null||J.destroy(),P.current=null)}},[]),c.useEffect(()=>{const L=x.current;if(!L)return;const H=new ResizeObserver(()=>ue(Y=>Y+1));return H.observe(L),()=>H.disconnect()},[]),c.useEffect(()=>{if(!T)return;let L=!1;if(!P.current)return;async function Y(z,J){if(J){const de=ca(J);return{width:J.width,height:J.height,imageData:null,make:be=>{const ie=be.createTexture(J.width,J.height,de.format);return ie.write(de.data),ie}}}if(!z)return null;const ne=await Je(z);return ne?{width:ne.width,height:ne.height,imageData:ne,make:de=>{const be=de.createTexture(ne.width,ne.height,"rgba8unorm");return be.write(ne.data),be}}:null}return Promise.all([Y(e,n),Y(t,r)]).then(([z,J])=>{var Re,Ge;if(L||!P.current)return;const ne=P.current;G.current=(z==null?void 0:z.imageData)??null,I.current=(J==null?void 0:J.imageData)??null,Q.current=n??null,le.current=r??null,(Re=ne.texA)==null||Re.destroy(),(Ge=ne.texB)==null||Ge.destroy(),ne.texA=null,ne.texB=null;const de=z??J;if(!de){U(null),K(null),te(Ne=>Ne+1);return}const be=J??de,ie=z??de;ne.texA=be.make(ne.device),ne.texB=ie.make(ne.device),K({a:{w:be.width,h:be.height},b:{w:ie.width,h:ie.height}}),U({w:de.width,h:de.height}),te(Ne=>Ne+1),X(Ne=>Ne+1)}),()=>{L=!0}},[T,e,t,n,r]);const Se=n!=null||r!=null,Le=c.useMemo(()=>ki(ae,Se),[ae,Se]),rt=c.useMemo(()=>{if(!Se)return null;const L=r??n;if(!L)return null;const H=L.precision==="f16-bits"?Tn(L.data):L.data;return na(H,L.width,L.height,L.channels)},[Se,r,n]),at=c.useMemo(()=>{var L;return vo(((L=Ze(Le))==null?void 0:L.displayRange)??"unit",xe==="none"?null:xe)},[Le,xe]),Hr=c.useMemo(()=>xe!=="none"?aa(xe):void 0,[xe]),je=c.useMemo(()=>N?yt(N.a,N.b,d,b,"b"):null,[N,d,b]),Be=c.useMemo(()=>k?W==="diff"&&je?je.result:k:null,[W,je,k]),fn=c.useCallback(()=>{const L=P.current;if(!T||!L||!L.surface||!L.texA||!L.texB||!k)return;const H=Be??k,Y=x.current,z=Y?Y.getBoundingClientRect():{width:H.w,height:H.h},J=vr({zoom:S,pan:w},z,H.w,H.h);ye(ie=>ie.x===J.x&&ie.y===J.y&&ie.w===J.w&&ie.h===J.h?ie:J);const ne=_.current;if(z.width>0&&z.height>0&&ne&&L.surface){const ie=Math.max(1,Math.round(z.width*Ue)),Re=Math.max(1,Math.round(z.height*Ue));(ne.width!==ie||ne.height!==Re)&&(ne.width=ie,ne.height=Re,L.surface.configure(ie,Re))}const de=wr(J,z,H.w,H.h)>=Zt?"nearest":"linear",be=J;try{if(W==="diff"){const ie=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Re=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ge=Ze(Le)?Le:"absolute",Ne=Ge==="hdr-flip"&&rt?{ppd:67,startExposure:rt.startExposure,stopExposure:rt.stopExposure,numExposures:rt.numExposures}:void 0,ct=Gi(L.device,L.texA,L.texB,Ge,Ne,ie,Re,je??void 0);A.current=ct,Ki(L.device,L.surface,ct.texture,ct.displayRange,{uv:be,cmapMode:at,colormap:Hr,filter:de,exposureEV:De,offset:D})}else{const ie={exposureEV:De,offset:D,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:be,filter:de,mode:W,split:i,alpha:s};ss(L.device,L.surface,L.texA,L.texB,ie)}}catch(ie){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ie),C(!0)}},[T,k,Be,je,S,w.x,w.y,W,i,s,De,D,ae,Le,rt,at,Hr,e,t,n,r,Ue]);c.useEffect(()=>{fn()},[fn,ee,ve]);const Rt=t!=null||r!=null;c.useEffect(()=>{const L=P.current;if(!T||!L||!L.texA||!L.texB||!Rt){_e(null);return}let H=!1;const Y=L.texA,z=L.texB,J=A.current,ne=W==="diff"?je??void 0:void 0;return(W==="diff"&&J?zi(L.device,J,Y,z,ne):Xn(L.device,Y,z,ne)).then(be=>{H||_e(be)}),()=>{H=!0}},[T,ee,Rt,W,ae,je]),c.useEffect(()=>{if(W!=="diff"){ge.current=null,se.current=null;return}const L=P.current,H=A.current;if(!T||!L||!H)return;let Y=!1;return ge.current=null,se.current=null,Fe(z=>z+1),Vi(L.device,H).then(z=>{Y||(ge.current=z,se.current={w:H.width,h:H.height},Fe(J=>J+1))}).catch(()=>{}),()=>{Y=!0}},[T,W,Le,ee,je]);const Yr=(L,H)=>(Y,z,J)=>{const ne=H.current;if(ne){const{data:ct,width:qr,height:ha,channels:Zr}=ne;if(Y<0||z<0||Y>=qr||z>=ha)return null;const kt=(z*qr+Y)*Zr,Lt=ne.precision==="f16-bits"?hn=>gt(ct[hn]??0):hn=>ct[hn]??0,ma=.5,ga=Zr===1?[Lt(kt)]:[Lt(kt),Lt(kt+1),Lt(kt+2)];return tt(ga,"unit",J,ma)}const de=L.current;if(!de||Y<0||z<0||Y>=de.width||z>=de.height)return null;const be=(z*de.width+Y)*4,ie=de.data[be],Re=de.data[be+1],Ge=de.data[be+2],Ne=(.299*ie+.587*Re+.114*Ge)/255;return tt(ie===Re&&Re===Ge?[ie]:[ie,Re,Ge],"uint8",J,Ne)},Dt=c.useMemo(()=>Yr(G,Q),[]),dn=c.useMemo(()=>Yr(I,le),[]),pn=c.useMemo(()=>(L,H,Y)=>{var Ne;const z=ge.current,J=se.current;if(!z||!J)return null;const{w:ne,h:de}=J;if(L<0||H<0||L>=ne||H>=de)return null;const be=(H*ne+L)*4,ie=((Ne=Ze(Le))==null?void 0:Ne.output)??"per-channel",Re=.5,Ge=ie==="scalar"?[z[be]??0]:[z[be]??0,z[be+1]??0,z[be+2]??0];return tt(Ge,"unit",Y,Re)},[Le]);c.useEffect(()=>{const L=x.current;if(L)return L.__cairnCompareProbe={sampleDiff:(H,Y,z="decimal")=>pn(H,Y,z),sampleFg:(H,Y,z="decimal")=>Dt(H,Y,z),sampleRef:(H,Y,z="decimal")=>dn(H,Y,z),get diffSamples(){return ge.current},get dims(){return Be},get primaryDims(){return k},get diffResultDims(){return se.current},get align(){return d},get fit(){return b},get resolvedKernelId(){return Le},get compareMode(){return W}},()=>{L&&delete L.__cairnCompareProbe}},[pn,Dt,dn,k,Be,d,b,Le,W]);const da=y==="auto"?void 0:y;if(B)return n!=null||r!=null?f.jsx(sa,{}):W==="diff"?f.jsx(rn,{imageUrl:e,baselineUrl:t,diffMode:((Kr=Ze(Le))==null?void 0:Kr.kind)==="pointwise"?Le:"absolute",interpolation:y,colormap:xe,showAxes:!1,zoom:S,pan:w,onViewportChange:p,label:E,pixelValueNotation:M}):f.jsx(oa,{imageUrl:e,baselineUrl:t,mode:W,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,zoom:S,pan:w,onViewportChange:p,interpolation:y,label:E,pixelValueNotation:M});const pa=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:_,className:"w-full h-full block",style:{imageRendering:da},"data-gpu-compare-canvas":!0}),W==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${i*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:L=>{L.stopPropagation(),l==null||l(.5)},onPointerDown:L=>{L.stopPropagation(),L.preventDefault();const H=L.currentTarget;try{H.setPointerCapture(L.pointerId)}catch{}const z=H.parentElement.getBoundingClientRect(),J=de=>{l==null||l(Math.max(0,Math.min(1,(de.clientX-z.left)/z.width)))},ne=()=>{window.removeEventListener("pointermove",J),window.removeEventListener("pointerup",ne)};window.addEventListener("pointermove",J),window.addEventListener("pointerup",ne)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return f.jsx(_t,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":T},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:x,wrapperRef:R,zoom:S,pan:w,onViewportChange:p,naturalDims:Be,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:pa,showAxes:!1,notationSeed:M,onReset:Oe,extraModified:Qe,exportCanvasRef:_,requestRender:fn,leadingMenus:O,displayAdjust:{exposureEV:De,offset:D,onExposureChange:$,onOffsetChange:F},label:"",showLabelChip:!1,overlay:{render:({notation:L,setOverlayActive:H})=>W==="split"?f.jsxs(f.Fragment,{children:[Rt&&Be&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-i)*100}% 0 0)`},children:f.jsx(nt,{imageElRef:_,naturalWidth:Be.w,naturalHeight:Be.h,zoom:S,pan:w,sourceWindow:we,sample:dn,notation:L,version:fe})}),Rt&&Be&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${i*100}%)`},children:f.jsx(nt,{imageElRef:_,naturalWidth:Be.w,naturalHeight:Be.h,zoom:S,pan:w,sourceWindow:we,sample:Dt,notation:L,version:fe,onActiveChange:H})})]}):Be&&f.jsx(nt,{imageElRef:_,naturalWidth:Be.w,naturalHeight:Be.h,zoom:S,pan:w,sourceWindow:we,sample:W==="diff"?pn:Dt,notation:L,version:W==="diff"?ke:fe,onActiveChange:H})},extraChips:f.jsxs(f.Fragment,{children:[W==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),E?f.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:E}):null,oe&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${E?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",oe.mse.toExponential(2)," · PSNR ",Number.isFinite(oe.psnr)?oe.psnr.toFixed(1):"∞"," dB · MAE"," ",oe.mae.toExponential(2)]})]})})}const ua="cairn-plot:gpu-image-ready";async function fa(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await dt(),window.__cairnPlotGpuImagePane=si,window.__cairnPlotGpuComparePane=la,window.__cairnPlotDiffMenuModes=Ur(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(ua))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),br("no-webgpu")}}}fa()})(__cairnPlotJsxRuntime,__cairnPlotReact);
