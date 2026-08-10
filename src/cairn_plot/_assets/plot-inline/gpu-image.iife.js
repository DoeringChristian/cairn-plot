var Ml=Object.defineProperty;var Sl=(f,c,st)=>c in f?Ml(f,c,{enumerable:!0,configurable:!0,writable:!0,value:st}):f[c]=st;var se=(f,c,st)=>Sl(f,typeof c!="symbol"?c+"":c,st);(function(f,c){"use strict";const st=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function lr(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:st}),{hdr:!1,format:n}}function _s(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:st}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:st}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return lr(e,t)}}}const Ms=`
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
`,Ss=`
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
`;class As extends Error{constructor(n){super(n);se(this,"deviceLost",!0);this.name="DeviceLostError"}}async function ur(e,t){try{await e.mapAsync(GPUMapMode.READ)}catch(n){if((n instanceof Error?n.name:"")==="AbortError"){const o=t.info;throw new As("webgpu readback: buffer map aborted — device lost or destroyed mid-readback"+(o?` (reason=${String(o.reason)}${o.message?`: ${o.message}`:""})`:"")+`: ${n instanceof Error?n.message:String(n)}`)}throw n instanceof Error?n:new Error(String(n))}}function _n(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function fr(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Ts(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Ps={texture:0,sampler:1,uniform:2};function Mn(e,t){return e*3+Ps[t]}const Rs={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Cs(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const l=Rs[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class dr{constructor(t,n,r,o){se(this,"width");se(this,"height");se(this,"format");se(this,"gpuTexture");se(this,"device");se(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:_n(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*fr(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class pr{constructor(t){se(this,"_s");se(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Ds{constructor(t,n,r,o,a){se(this,"_p");se(this,"gpuPipeline");se(this,"bindings");se(this,"bindGroupLayout");se(this,"variants");se(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function ks(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Ls{constructor(t){se(this,"_c");se(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Os{constructor(t,n,r,o,a){se(this,"width");se(this,"height");se(this,"paramsBuffer");se(this,"bindGroup");se(this,"buffers");se(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=a}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class Bs{constructor(t,n){se(this,"_b");se(this,"gpuBindGroup");se(this,"ownedBuffers");se(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Ns{constructor(t,n,r,o){se(this,"canvas");se(this,"hdr");se(this,"format");se(this,"context");se(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function Gt(e){return"canvas"in e}async function Is(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(p){return Gt(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function s(p){if(Gt(p))return{width:p.canvas.width,height:p.canvas.height};const E=p;return{width:E.width,height:E.height}}let l=!1;const i={};t.lost.then(p=>{i.info=p},()=>{});let u=null;function d(){var E,_;if(u!==null)return u;let p=!1;try{if(typeof document<"u"){const w=document.createElement("canvas");w.width=1,w.height=1;const C=w.getContext("webgpu");if(C)try{C.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const S=(E=C.getConfiguration)==null?void 0:E.call(C);p=((_=S==null?void 0:S.toneMapping)==null?void 0:_.mode)==="extended"}catch{p=!1}finally{try{C.unconfigure()}catch{}}}}catch{p=!1}return u=p,p}const g=256;let m=null,b=null;function v(){if(!m||!b){const p=t.createShaderModule({code:Ms});b=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[b]});m=t.createComputePipeline({layout:E,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:m,layout:b}}let y=null,M=null;function x(){if(!y||!M){const p=t.createShaderModule({code:Ss});M=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[M]});y=t.createRenderPipeline({layout:E,vertex:{module:p,entryPoint:"vs_main"},fragment:{module:p,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:y,layout:M}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(p,E,_){return new dr(t,p,E,_)},createSampler(p){const E=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",_=t.createSampler({magFilter:E,minFilter:E,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new pr(_)},createRenderPipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=Cs(p.shaderWGSL),w=_n(p.targetFormat),C=ks(t,_),S=t.createPipelineLayout({bindGroupLayouts:[C]}),A=P=>t.createRenderPipeline({layout:S,vertex:{module:E,entryPoint:"vs_main"},fragment:{module:E,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),T=A(w);return new Ds(T,_,C,w,A)},createComputePipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=t.createComputePipeline({layout:"auto",compute:{module:E,entryPoint:"cs_main"}});return new Ls(_)},createBindGroup(p,E){const _=p,w=new Map,C=[];for(const[A,T]of _.bindings)if(T.kind==="uniform"){const P=t.createBuffer({size:T.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});C.push(P),w.set(A,{binding:A,resource:{buffer:P}})}else T.kind==="sampler"&&w.set(A,{binding:A,resource:o()});for(const A of E){const T=A.resource;if(T instanceof dr){const P=Mn(A.binding,"texture");_.bindings.has(P)&&w.set(P,{binding:P,resource:T.gpuTexture.createView()})}else if(T instanceof pr){const P=Mn(A.binding,"sampler");_.bindings.has(P)&&w.set(P,{binding:P,resource:T.gpuSampler})}else{const P=Mn(A.binding,"uniform"),k=_.bindings.get(P);if(k&&k.kind==="uniform"){const R=T.uniform,L=t.createBuffer({size:Math.max(k.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(L,0,R.buffer,R.byteOffset,R.byteLength),C.push(L),w.set(P,{binding:P,resource:{buffer:L}})}}}const S=t.createBindGroup({layout:_.bindGroupLayout,entries:Array.from(w.values())});return new Bs(S,C)},createSurface(p,E){const _=p.getContext("webgpu");if(!_)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const w=E.hdr&&n.hdr,C=()=>w?_s(_,t):lr(_,t),S=C();return new Ns(p,_,S,C)},renderFullscreen(p,E,_){const w=E,C=_,S=a(p),{width:A,height:T}=s(p),P=Gt(p)?p.format:_n(p.format),k=w.pipelineFor(P),R=t.createCommandEncoder(),L=R.beginRenderPass({colorAttachments:[{view:S,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});L.setPipeline(k),L.setBindGroup(0,C.gpuBindGroup),L.setViewport(0,0,A,T,0,1),L.draw(3),L.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(p){const{layout:E}=x(),_=P=>{const k=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(k,0,P.buffer,P.byteOffset,P.byteLength),k},w=_(p.offsets),C=_(p.colors),S=_(p.zs),A=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),T=t.createBindGroup({layout:E,entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:C}},{binding:2,resource:{buffer:S}},{binding:3,resource:{buffer:A}}]});return new Os(p.width,p.height,[w,C,S],A,T)},compositeDeep(p,E,_,w){const C=p,S=E,{pipeline:A}=x();t.queue.writeBuffer(C.paramsBuffer,0,new Float32Array([C.width,C.height,w,_]));const T=t.createCommandEncoder(),P=T.beginRenderPass({colorAttachments:[{view:S.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(A),P.setBindGroup(0,C.bindGroup),P.setViewport(0,0,S.width,S.height,0,1),P.draw(3),P.end(),t.queue.submit([T.finish()])},async readback(p){const E=Gt(p),{width:_,height:w}=s(p),C=E?p.hdr?"rgba16float":"rgba8unorm":p.format,S=E&&p.format==="bgra8unorm",A=E?p.getCurrentGPUTexture():p.gpuTexture,T=fr(C),P=_*T,k=256,R=Math.ceil(P/k)*k,L=R*w,N=t.createBuffer({size:L,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),X=t.createCommandEncoder();X.copyTextureToBuffer({texture:A},{buffer:N,bytesPerRow:R,rowsPerImage:w},{width:_,height:w,depthOrArrayLayers:1}),t.queue.submit([X.finish()]);try{await ur(N,i)}catch(I){try{N.destroy()}catch{}throw I}const W=new Uint8Array(N.getMappedRange()),G=new Uint8Array(P*w);for(let I=0;I<w;I++){const j=I*R,Y=I*P;G.set(W.subarray(j,j+P),Y)}if(N.unmap(),N.destroy(),C==="rgba8unorm"){if(S)for(let I=0;I<G.length;I+=4){const j=G[I],Y=G[I+2];G[I]=Y,G[I+2]=j}return G}if(C==="rgba16float"){const I=new Uint16Array(G.buffer,G.byteOffset,G.byteLength/2),j=new Float32Array(I.length);for(let Y=0;Y<I.length;Y++)j[Y]=Ts(I[Y]);return j}return new Float32Array(G.buffer,G.byteOffset,G.byteLength/4)},async reduceDiffSumSquaredAbs(p,E,_,w){const C=p,S=E,A=Math.max(0,_*w),T=Math.max(1,Math.ceil(A/g)),{pipeline:P,layout:k}=v(),R=T*2*4,L=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),N=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(N,0,new Uint32Array([Math.max(1,_),Math.max(1,w),A,0]));const X=t.createBindGroup({layout:k,entries:[{binding:0,resource:C.gpuTexture.createView()},{binding:1,resource:S.gpuTexture.createView()},{binding:2,resource:{buffer:L}},{binding:3,resource:{buffer:N}}]}),W=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),G=t.createCommandEncoder(),I=G.beginComputePass();I.setPipeline(P),I.setBindGroup(0,X),I.dispatchWorkgroups(T),I.end(),G.copyBufferToBuffer(L,0,W,0,R),t.queue.submit([G.finish()]);try{await ur(W,i)}catch(ae){for(const V of[W,L,N])try{V.destroy()}catch{}throw ae}const Y=new Float32Array(W.getMappedRange()).slice();W.unmap(),W.destroy(),L.destroy(),N.destroy();let ie=0,te=0;for(let ae=0;ae<T;ae++)ie+=Y[ae*2],te+=Y[ae*2+1];return{sumSq:ie,sumAbs:te}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let Sn=null;async function Fs(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Is()}function zt(){return Sn||(Sn=Fs()),Sn}function Us(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Gs(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),l=o-a,[i,u,d]=Us(e[a],e[s],l);t[n*3]=Math.round(i),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(d)}return t}const An={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},zs=Object.keys(An),Vs={viridis:"Viridis",plasma:"Plasma",magma:"Magma","red-green":"Red–Green","red-blue":"Red–Blue"},$s=zs.map(e=>({id:e,label:Vs[e]})),Xs=new Set(["red-green","red-blue"]),hr=new Map;function Tn(e){let t=hr.get(e);if(!t){const n=An[e]??An.viridis;t=Gs(n),hr.set(e,t)}return t}function xt(e,t,n){return e<t?t:e>n?n:e}function Fe(e){return e<0?0:e>1?1:e}function Vt(e,t,n){return xt(Math.floor(e),t,n)}const Pn=e=>{const t=e<0?0:e;return t/(1+t)},Rn=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Fe(n/r)},$t=4,mr=1,Ct=16,gr=.5,xr={linear:([e,t,n])=>[Fe(e),Fe(t),Fe(n)],srgb:([e,t,n])=>[Fe(e),Fe(t),Fe(n)],gamma:([e,t,n])=>[Fe(e),Fe(t),Fe(n)],reinhard:([e,t,n])=>[Pn(e),Pn(t),Pn(n)],aces:([e,t,n])=>[Rn(e),Rn(t),Rn(n)],extended:([e,t,n])=>[e,t,n]},br="srgb",vr=["linear","srgb","gamma","reinhard","aces"],Ws=["srgb","gamma","linear"],yr={extended:"linear","extended-clamp":"linear","extended-reinhard":"reinhard","extended-aces":"aces","extended-gamma":"gamma"};function Hs(e){return e&&xr[e]||xr[br]}function Xt(e){return e&&yr[e]?yr[e]:e&&vr.includes(e)?e:br}const wr=Xt;function Er(e){return e==="extended"?Ks:void 0}function _r(e,t){return e==null?"srgb":wr(e)}function Wt(e,t,n){return e*2**t+n}function Ys(e){const t=Fe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Cn(e){const t=Fe(e);return t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function Mt(e,t){return typeof t=="number"&&t>0?Fe(Math.pow(Fe(e),1/t)):Ys(e)}const St=2.2,Ht=.5,Yt=4,Kt=.1;function qt(e){return e==="gamma"}function Dn(e,t){if(e==="gamma")return t>0?t:St;if(e==="linear")return 1}const Ks=1/0;function Mr(e,t,n,r){const o=wr(e),a=Dn(o,r);if(!n||Number.isFinite(t)&&t<=1)return{operator:o,hdrOut:!1,peak:1,gamma:a};const s=!Number.isFinite(t);switch(o){case"reinhard":return s?{operator:"extended",hdrOut:!0,peak:Ct,gamma:void 0}:{operator:"extended-reinhard",hdrOut:!0,peak:t,gamma:void 0};case"aces":return{operator:"extended-aces",hdrOut:!0,peak:s?Ct:t,gamma:void 0};default:return s?{operator:"extended",hdrOut:!0,peak:Ct,gamma:a}:{operator:"extended-clamp",hdrOut:!0,peak:t,gamma:a}}}function kn(e,t,n="linear",r=0,o=0){const a=Tn(t),s=new ImageData(e.width,e.height),l=e.data,i=s.data,u=r!==0||o!==0;for(let d=0;d<l.length;d+=4){let g=(l[d]+l[d+1]+l[d+2])/3;u&&(g=Math.max(0,Math.min(255,Wt(g/255,r,o)*255)));let m;n==="positive"?m=Math.round(128+g/255*127):m=Math.round(g),m=Math.max(0,Math.min(255,m)),i[d]=a[m*3],i[d+1]=a[m*3+1],i[d+2]=a[m*3+2],i[d+3]=l[d+3]}return s}function qs(e,t){return e==="signed"||e==="relative"?"signed":Ln(t)}function Ln(e){return Xs.has(e??"")?"positive":"linear"}function Sr(e,t){const n=new Map;return{get(r){const o=n.get(r);if(o!==void 0)return n.delete(r),n.set(r,o),o},set(r,o){for(n.get(r)!==void 0&&n.delete(r),n.set(r,o);n.size>e;){const s=n.keys().next().value;if(s===void 0)break;n.get(s),n.delete(s)}},has(r){return n.has(r)},get size(){return n.size}}}const Ar=Sr(50);function On(e){return Ar.get(e)}function Bn(e,t){Ar.set(e,t)}const Tr=Sr(100);function Zs(e){return Tr.get(e)}function js(e,t){Tr.set(e,t)}function Qs(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const i=(s*e.width+l)*4,u=(s*t.width+l)*4,d=(s*r+l)*4;for(let g=0;g<3;g++){const m=e.data[i+g],b=t.data[u+g],v=m-b,y=Math.abs(v),M=Math.max(m,1);let x;switch(n){case"signed":x=(v+255)/2;break;case"absolute":x=y;break;case"squared":x=v*v/255;break;case"relative_signed":x=(v/M+1)*127.5;break;case"relative_absolute":x=y/M*255;break;case"relative_squared":x=v*v/(M*M)*255;break}a.data[d+g]=Math.min(255,Math.max(0,Math.round(x)))}a.data[d+3]=255}return a}async function at(e){const t=Zs(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);js(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Js={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},ea={linear:0,signed:1,positive:2},ta=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,na=`#version 300 es
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
}`;let bt=null,J=null,Be=null,Zt=null;function ra(){if(J)return J;try{if(typeof OffscreenCanvas<"u"?bt=new OffscreenCanvas(1,1):bt=document.createElement("canvas"),J=bt.getContext("webgl2",{preserveDrawingBuffer:!0}),!J)return console.warn("[cairn] WebGL 2 not available"),null;const e=J.createShader(J.VERTEX_SHADER);if(J.shaderSource(e,ta),J.compileShader(e),!J.getShaderParameter(e,J.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",J.getShaderInfoLog(e)),null;const t=J.createShader(J.FRAGMENT_SHADER);if(J.shaderSource(t,na),J.compileShader(t),!J.getShaderParameter(t,J.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",J.getShaderInfoLog(t)),null;if(Be=J.createProgram(),J.attachShader(Be,e),J.attachShader(Be,t),J.linkProgram(Be),!J.getProgramParameter(Be,J.LINK_STATUS))return console.error("[cairn] WebGL program link:",J.getProgramInfoLog(Be)),null;Zt=J.createVertexArray(),J.bindVertexArray(Zt);const n=J.createBuffer();J.bindBuffer(J.ARRAY_BUFFER,n),J.bufferData(J.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),J.STATIC_DRAW);const r=J.getAttribLocation(Be,"a_pos");return J.enableVertexAttribArray(r),J.vertexAttribPointer(r,2,J.FLOAT,!1,0,0),J.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),J}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Pr(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function oa(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function sa(e,t,n,r){const o=ra();if(!o||!Be||!Zt||!bt)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);bt.width=a,bt.height=s,o.viewport(0,0,a,s);const l=Pr(o,e,0),i=Pr(o,t,1);let u=null;n.colormap?u=oa(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Be),o.uniform1i(o.getUniformLocation(Be,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Be,"u_other"),1),o.uniform1i(o.getUniformLocation(Be,"u_lut"),2),o.uniform1i(o.getUniformLocation(Be,"u_diff_mode"),Js[n.diffMode]),o.uniform1i(o.getUniformLocation(Be,"u_cmap_mode"),ea[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Be,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Zt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(bt,0,0,a,s,0,-s,a,s),d.restore()),o.deleteTexture(l),o.deleteTexture(i),o.deleteTexture(u),{width:a,height:s}}const aa="cairn:render-mode";function ia(){try{const e=localStorage.getItem(aa);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const jt=15360;function Qt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Rr=globalThis.Float16Array;function Cr(e,t=e.length){if(Rr){const r=new Rr(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=Qt(e[r]);return n}const Ye=new Uint32Array(512),Ke=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ye[e]=0,Ye[e|256]=32768,Ke[e]=24,Ke[e|256]=24):t<-14?(Ye[e]=1024>>-t-14,Ye[e|256]=1024>>-t-14|32768,Ke[e]=-t-1,Ke[e|256]=-t-1):t<=15?(Ye[e]=t+15<<10,Ye[e|256]=t+15<<10|32768,Ke[e]=13,Ke[e|256]=13):t<128?(Ye[e]=31744,Ye[e|256]=64512,Ke[e]=24,Ke[e|256]=24):(Ye[e]=31744,Ye[e|256]=64512,Ke[e]=13,Ke[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Dt=Uint8Array,Dr=Uint16Array,ca=Int32Array,la=new Dt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),ua=new Dt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),kr=function(e,t){for(var n=new Dr(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new ca(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},Lr=kr(la,2),fa=Lr.b,da=Lr.r;fa[28]=258,da[258]=28,kr(ua,0);for(var pa=new Dr(32768),Me=0;Me<32768;++Me){var it=(Me&43690)>>1|(Me&21845)<<1;it=(it&52428)>>2|(it&13107)<<2,it=(it&61680)>>4|(it&3855)<<4,pa[Me]=((it&65280)>>8|(it&255)<<8)>>1}for(var Jt=new Dt(288),Me=0;Me<144;++Me)Jt[Me]=8;for(var Me=144;Me<256;++Me)Jt[Me]=9;for(var Me=256;Me<280;++Me)Jt[Me]=7;for(var Me=280;Me<288;++Me)Jt[Me]=8;for(var ha=new Dt(32),Me=0;Me<32;++Me)ha[Me]=5;var ma=new Dt(0),ga=typeof TextDecoder<"u"&&new TextDecoder,xa=0;try{ga.decode(ma,{stream:!0}),xa=1}catch{}const Or=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Nn(e){const t=Or.length;return Or[(e%t+t)%t]}function ba(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),l=c.useRef(null),i=c.useCallback((u,d)=>{o(g=>g.w===u&&g.h===d?g:{w:u,h:d})},[]);return c.useLayoutEffect(()=>{const u=n.current;if(!u||u===l.current)return;const d=u.getBoundingClientRect();(d.width>0||d.height>0)&&(l.current=u,i(d.width,d.height))}),c.useEffect(()=>{var g;const u=n.current;if(u===s.current||((g=a.current)==null||g.disconnect(),a.current=null,s.current=u,!u))return;const d=new ResizeObserver(m=>{for(const b of m)i(b.contentRect.width,b.contentRect.height)});a.current=d,d.observe(u)}),c.useEffect(()=>()=>{var u;return(u=a.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function va(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const ya=.001;function wa(e,t=ya){return Math.exp(-e*t)}function Br(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function Nr(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Ea(e,t,n,r,o,a,s){const l=t>0&&r>0?r/t:1,i=Math.max(a,Math.min(s,e.zoom*l)),u=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:i,pan:{x:o.x-u*i,y:o.y-d*i}}}const _a=.25,In=64;function Fn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return In;const o=Math.min(n/e,r/t);return o<=0?In:Math.max(Math.max(n,r)/o,8)}function Ir(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=_a,maxZoom:s=In,naturalWidth:l,naturalHeight:i}=e,u=va(),d=c.useRef(u);d.current=u;const g=c.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const m=c.useRef(o);m.current=o,c.useEffect(()=>{const S=t.current;if(!S||!o)return;const A=T=>{var j;if(!T.ctrlKey&&!d.current)return;T.preventDefault(),T.stopPropagation();const P=wa(T.deltaY),k=g.current,R=S.getBoundingClientRect(),L=l&&i?Fn(l,i,R.width,R.height):s,N=Math.max(a,Math.min(L,k.zoom*P));if(k.zoom===N)return;const X=T.clientX-R.left,W=T.clientY-R.top,G=X-(X-k.pan.x)/k.zoom*N,I=W-(W-k.pan.y)/k.zoom*N;(j=m.current)==null||j.call(m,{zoom:N,pan:{x:G,y:I}})};return S.addEventListener("wheel",A,{passive:!1}),()=>S.removeEventListener("wheel",A)},[t,!!o,a,s,l,i]);const b=c.useRef(new Map),v=c.useRef(null),y=c.useRef(null),M=c.useCallback((S,A,T)=>{const P=S.getBoundingClientRect();return{x:A-P.left,y:T-P.top}},[]),x=c.useCallback(S=>{if(!l||!i)return s;const A=S.getBoundingClientRect();return Fn(l,i,A.width,A.height)},[l,i,s]),h=c.useCallback((S,A)=>{const T=b.current,P=T.get(S),k=T.get(A);!P||!k||(v.current=null,y.current={idA:S,idB:A,startDist:Br(P,k),startMid:Nr(P,k),startZoom:g.current.zoom,startPan:{...g.current.pan}})},[]),p=c.useCallback(S=>{const A=b.current.get(S);A&&(v.current={pointerId:S,startX:A.x,startY:A.y,panX:g.current.pan.x,panY:g.current.pan.y})},[]),E=c.useCallback(S=>{if(!m.current)return;const A=S.pointerType==="touch";if(!A&&!d.current)return;const T=S.currentTarget;if(T.setPointerCapture(S.pointerId),b.current.set(S.pointerId,M(T,S.clientX,S.clientY)),A&&b.current.size>=2){const P=[...b.current.keys()];h(P[P.length-2],P[P.length-1]);return}p(S.pointerId)},[M,h,p]),_=c.useCallback(S=>{var R,L;const A=S.currentTarget,T=b.current.get(S.pointerId);if(T){const N=M(A,S.clientX,S.clientY);T.x=N.x,T.y=N.y}const P=y.current;if(P){const N=b.current.get(P.idA),X=b.current.get(P.idB);if(!N||!X)return;const W=Ea({zoom:P.startZoom,pan:P.startPan},P.startDist,P.startMid,Br(N,X),Nr(N,X),a,x(A));(R=m.current)==null||R.call(m,W);return}const k=v.current;!k||k.pointerId!==S.pointerId||!T||(L=m.current)==null||L.call(m,{zoom:g.current.zoom,pan:{x:k.panX+(T.x-k.startX),y:k.panY+(T.y-k.startY)}})},[M,a,x]),w=c.useCallback(S=>{var T;try{S.currentTarget.releasePointerCapture(S.pointerId)}catch{}b.current.delete(S.pointerId);const A=y.current;if(A&&(S.pointerId===A.idA||S.pointerId===A.idB)){y.current=null;const P=[...b.current.keys()];P.length===1&&p(P[0]);return}((T=v.current)==null?void 0:T.pointerId)===S.pointerId&&(v.current=null)},[p]);return{containerProps:{onPointerDown:E,onPointerMove:_,onPointerUp:w,onPointerCancel:w,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function Un(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Ne(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Ma(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Fr(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Gn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=ba(),s=c.useRef(null),l=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),i=c.useMemo(()=>{const y=a.w,M=a.h;if(y<=0||M<=0||n<=0||r<=0)return null;const x=Math.min(y/n,M/r),h=n*x,p=r*x;return{left:(y-h)/2,top:(M-p)/2,width:h,height:p}},[a.w,a.h,n,r]),u=e.masks,d=t.showMasks&&!!u&&u.length>0,g=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!d||!u)return;const y=s.current;if(!y)return;(y.width!==n||y.height!==r)&&(y.width=n,y.height=r);const M=y.getContext("2d");if(!M)return;M.clearRect(0,0,y.width,y.height);let x=!1;const h=M.createImageData(n,r),p=h.data;let E=u.length,_=!1;const w=()=>{x||_&&M.putImageData(h,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const S=C.getContext("2d",{willReadFrequently:!0});for(const A of u){const T=new Image;T.onload=()=>{if(!x){if(S){S.clearRect(0,0,n,r),S.drawImage(T,0,0,n,r);const P=S.getImageData(0,0,n,r).data;for(let k=0;k<n*r;k++){const R=P[k*4];if(R===0||l.has(R))continue;const[L,N,X]=Ma(Nn(R));p[k*4]=L,p[k*4+1]=N,p[k*4+2]=X,p[k*4+3]=255,_=!0}}E-=1,E===0&&w()}},T.onerror=()=>{E-=1,E===0&&w()},T.src=`data:image/png;base64,${A.png_b64}`}return()=>{x=!0}},[d,u,n,r,g]),!i)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const m=e.boxes??[],b=t.showBoxes&&m.length>0,v=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),b&&f.jsx("svg",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:m.map((y,M)=>{if(!Fr(y,t,l))return null;const x=y.domain==="pixel"?1:n,h=y.domain==="pixel"?1:r,p=y.position.minX*x,E=y.position.minY*h,_=(y.position.maxX-y.position.minX)*x,w=(y.position.maxY-y.position.minY)*h;return f.jsx("rect",{x:p,y:E,width:_,height:w,fill:"none",stroke:Nn(y.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},M)})}),b&&f.jsx("div",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height},children:m.map((y,M)=>{if(!Fr(y,t,l))return null;const x=y.domain==="pixel"?1/n:1,h=y.domain==="pixel"?1/r:1,p=y.position.minX*x*100,E=y.position.minY*h*100,_=y.label??v[String(y.class_id)]??`#${y.class_id}`,w=y.score!=null?` ${(y.score*100).toFixed(0)}%`:"";return!_&&!w?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${p}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Nn(y.class_id)},children:f.jsxs("span",{className:"mono",children:[_,w]})},M)})})]})}function Sa(e,t){const n=t==null?void 0:t.precision,r=Aa(e,n);return t!=null&&t.minus?r.replace("-","−"):r}function Aa(e,t){if(!Number.isFinite(e))return String(e);if(e===0)return"0";const n=Math.abs(e);return n>=1e3||n<.001?e.toExponential(Math.max(0,t-2)):Number(e.toPrecision(t)).toString()}const Ta={x:0,y:0,w:1,h:1};function en(e){const t=e.sourceWindow??Ta,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,a=t.h*e.naturalHeight,s=Math.min(e.box.width/o,e.box.height/a),l=o*s,i=a*s;return{scale:s,imgLeft:e.box.left+(e.box.width-l)/2,imgTop:e.box.top+(e.box.height-i)/2,srcOriginX:n,srcOriginY:r,visibleW:o,visibleH:a}}function Pa(e){return en(e).scale}function Ur(e,t,n){const r=en(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function Gr(e,t,n){const r=en(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function Ra(e,t){const n=Gr(e.x0,e.y0,t),r=Gr(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}function zr(e,t,n,r,o){const a=Ur(e,t,o),s=Ur(n,r,o),l=o.naturalWidth-1,i=o.naturalHeight-1,u=Math.min(a.x,s.x),d=Math.max(a.x,s.x),g=Math.min(a.y,s.y),m=Math.max(a.y,s.y);return d<0||u>l||m<0||g>i?null:{x0:Vt(u,0,l),y0:Vt(g,0,i),x1:Vt(d,0,l),y1:Vt(m,0,i)}}const tn=30,Ca=.14,Vr=1.15,Da=.62,ka=4,La=24,Oa=6;function Ba(e,t,n=ka){if(e<=0||t<=0)return 0;const r=Math.max(1,n),o=e*(1-2*Ca),a=o/(t*Vr),s=o/(r*Da);return Math.min(a,s,La)}function Na(e){return e>=tn}const nn=["#ff5a5a","#39d353","#5b9bff"],Ia="#ffffff",Fa="rgba(0,0,0,0.9)",Ua=.15,Ga=.06;function zn(e){return Sa(e,{precision:3})}function At(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):zn(e/255):zn(n==="int"?e*255:e)}function vt(e,t,n){return e.length===1?{lines:[At(e[0],t,n)]}:{lines:e.map(r=>At(r,t,n)),colors:e.map((r,o)=>nn[o]??null)}}const za={x:0,y:0,w:1,h:1};function yt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:l=0,onActiveChange:i,sourceWindow:u=za}){const d=c.useRef(null),g=c.useRef(!1),m=Un(),b=c.useRef(i);b.current=i;const v=c.useCallback(M=>{var x;M!==g.current&&(g.current=M,(x=b.current)==null||x.call(b,M))},[]),y=c.useCallback(()=>{var ne;const M=d.current,x=e.current;if(!M)return;const h=window.devicePixelRatio||1,p=M.clientWidth,E=M.clientHeight;if(p===0||E===0)return;M.width!==Math.round(p*h)&&(M.width=Math.round(p*h)),M.height!==Math.round(E*h)&&(M.height=Math.round(E*h));const _=M.getContext("2d");if(!_)return;if(_.setTransform(h,0,0,h,0,0),_.clearRect(0,0,p,E),!x||t<=0||n<=0){v(!1);return}const w=x.getBoundingClientRect(),C=M.getBoundingClientRect();if(w.width===0||w.height===0){v(!1);return}const A=en({box:w,naturalWidth:t,naturalHeight:n,sourceWindow:u}),{srcOriginX:T,srcOriginY:P,visibleW:k,visibleH:R,scale:L}=A;if(k<=0||R<=0){v(!1);return}if(!Na(L)){v(!1);return}const N=A.imgLeft-C.left,X=A.imgTop-C.top,W=Math.max(Math.floor(T),Math.floor(T+(0-N)/L)),G=Math.min(Math.ceil(T+k),Math.ceil(T+(p-N)/L)),I=Math.max(Math.floor(P),Math.floor(P+(0-X)/L)),j=Math.min(Math.ceil(P+R),Math.ceil(P+(E-X)/L));if(G<=W||j<=I){v(!1);return}const Y=[];let ie=1,te=1;for(let re=I;re<j;re++)for(let ce=W;ce<G;ce++){if(ce<0||re<0||ce>=t||re>=n)continue;const ge=a(ce,re,s);if(!(!ge||ge.lines.length===0)){ge.lines.length>te&&(te=ge.lines.length);for(const me of ge.lines)me.length>ie&&(ie=me.length);Y.push({px:ce,py:re,s:ge})}}if(Y.length===0){v(!1);return}const ae=Ba(L,te,ie);if(ae<Oa){v(!1);return}v(!0);const V=N+(0-T)*L,Q=X+(0-P)*L,Z=N+(t-T)*L,ue=X+(n-P)*L;_.save(),_.beginPath(),_.rect(V,Q,Z-V,ue-Q),_.clip(),_.textAlign="center",_.textBaseline="middle";const we=ae*Vr;_.font=`${ae}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.shadowColor=Fa,_.shadowBlur=Math.max(2,ae*Ua),_.shadowOffsetX=0,_.shadowOffsetY=Math.max(1,ae*Ga);for(const{px:re,py:ce,s:ge}of Y){const me=ge.lines.length,Ae=N+(re-T+.5)*L;let Pe=X+(ce-P+.5)*L-me*we/2+we/2;for(let _e=0;_e<ge.lines.length;_e++){const ve=ge.lines[_e];_.fillStyle=((ne=ge.colors)==null?void 0:ne[_e])??Ia,_.fillText(ve,Ae,Pe),Pe+=we}}_.restore()},[e,t,n,a,s,v,u]);return c.useEffect(()=>{y()},[y,r,o.x,o.y,l,s,u,m]),c.useEffect(()=>{const M=d.current;if(!M)return;const x=new ResizeObserver(()=>y());return x.observe(M),()=>x.disconnect()},[y]),f.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function $r({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Va=`
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
// Logical binding 7 (uniform f32: PEAK white, ×SDR white — for the peak-
// parameterized extended operators extended-reinhard(5)/extended-aces(6)/
// extended-clamp(7)) -> native binding 7*3+2 = 23. Defaults to 0 when the caller
// omits it (zero-filled); the engine
// always writes EXTENDED_TONEMAP_PEAK_DEFAULT (4), and the roll-off curves guard
// peak<=0 anyway.
@group(0) @binding(23) var<uniform> u_bind7: f32;
// Logical binding 8 (uniform f32: srgbDecode, 0/1) -> native binding 8*3+2 = 26.
// When 1, sRGB-DECODE the sampled source to linear light BEFORE exposure (an
// 8-bit sRGB source going through the display-transfer pipeline). Default 0
// (zero-filled when the caller omits it) — the HDR/float path leaves it off, so
// a scene-linear source is untouched and every existing case renders as before.
@group(0) @binding(26) var<uniform> u_bind8: f32;

// --- ported verbatim from image/tonemap.ts ---

fn srgbOetf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.0031308) {
    return 12.92 * v;
  }
  return 1.055 * pow(v, 1.0 / 2.4) - 0.055;
}

// sRGB EOTF (sRGB code -> linear) — the exact inverse of srgbOetf. Mirrors
// image/tonemap.ts's srgbEotf. Used to LINEARIZE an 8-bit sRGB source at the
// front of the pipeline when srgbDecode (u_bind8) is set (SDR display-transfer
// panes), so exposure/offset + the chosen transfer operate on linear light,
// tev-style.
fn srgbEotf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.04045) {
    return v / 12.92;
  }
  return pow((v + 0.055) / 1.055, 2.4);
}

fn outputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 {
  if (hasGamma) {
    return clamp(pow(clamp(x, 0.0, 1.0), 1.0 / gamma), 0.0, 1.0);
  }
  return srgbOetf(x);
}

// --- EXTENDED output-encode (HDR-out / extended-surface transfer) — ported
// BYTE-IDENTICALLY from image/tonemap.ts's extendedSrgbOetf / extendedGammaEncode
// / extendedOutputEncode. See that file's doc block for WHY: a float16 canvas in
// "srgb"/"display-p3" (the hdrOut surface) stores TRANSFER-ENCODED (non-linear)
// signals per W3C ColorWeb-CG, so the hdrOut path must ENCODE the display-linear
// light the operator produced, not hand over raw scene-linear values. Same
// piecewise sRGB / power curves as the SDR encoders but UNCLAMPED (values past 1
// survive as extended brightness) and MIRRORED through the origin for negatives
// (sign(x)*f(|x|)). ---

fn extendedSrgbOetf(x: f32) -> f32 {
  let a = abs(x);
  let s = sign(x);
  if (a <= 0.0031308) { return s * 12.92 * a; }
  return s * (1.055 * pow(a, 1.0 / 2.4) - 0.055);
}

fn extendedGammaEncode(x: f32, gamma: f32) -> f32 {
  let a = abs(x);
  let s = sign(x);
  return s * pow(a, 1.0 / gamma);
}

fn extendedOutputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 {
  if (hasGamma) { return extendedGammaEncode(x, gamma); }
  return extendedSrgbOetf(x);
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

// ACES fit peak-parameterized as the CANONICAL curve scaled to P: y = P*aces(x/P).
// Mirrors image/tonemap.ts's extendedAcesCurve EXACTLY. INVARIANT: at P=1 this
// is 1*aces(x/1) = aces(x) — the SDR ACES operator exactly, so the only
// difference between SDR and extended ACES is the peak P (parity-tested). Keeps
// y→P as x→∞ and monotone. (Replaces the earlier P*aces(x*S/P), S=0.14/0.03,
// which normalized the low-x slope to 1 but broke the P=1 equivalence.)
fn extendedAcesCurve(x: f32, peak: f32) -> f32 {
  let v = max(x, 0.0);
  let p = max(peak, 1e-6);
  return p * acesCurve(v / p);
}

// Extended · Linear (MANAGED) with display peak P: y = min(max(x,0), P) —
// identity below P, hard ceiling at P. Mirrors image/tonemap.ts's
// extendedClampCurve exactly. This is the cross-browser-deterministic sibling of
// operator 4 (extended / raw Linear): 4 hands raw values to the compositor which
// clips at its own headroom estimate; this clips in-shader at the shared P.
fn extendedClampCurve(x: f32, peak: f32) -> f32 {
  let v = max(x, 0.0);
  let p = max(peak, 1e-6);
  return min(v, p);
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

// Colormap LUT lookup, two variants selected by the SAME filter flag (u_bind5)
// that picks nearest/bilinear source sampling — so a colormapped image shares
// ONE interpolation decision with the plain path, never diverging.
//
//  sampleLutNearestF: the crisp per-texel mapping. Round-half-UP index (matches
//    the CPU Math.round reference — WGSL round() is round-half-to-EVEN), exact
//    texel fetch. Used at the pixelated zoom (source sampled nearest), where
//    each source texel is a solid on-screen block anyway.
//  sampleLutLinearF: blends the TWO adjacent LUT entries by the fractional
//    index. Used at moderate zoom (source sampled bilinearly). Without this a
//    bilinearly-interpolated scalar still SNAPS to one of 256 discrete LUT bins,
//    reintroducing stair-step banding whose iso-value contours follow the texel
//    grid — the "sharp corners that should not be there" the plain (non-LUT)
//    path never shows. Interpolating the scalar across texels AND interpolating
//    the LUT across its entries is the intended smooth false-color pipeline.
// At a texel-aligned 8-bit scalar (idxF integer, frac==0) the linear variant
// degenerates to the exact entry, so the two agree wherever the source is
// texel-aligned.
fn sampleLutNearestF(valueUnit: f32) -> vec3<f32> {
  let idxF = clamp(valueUnit, 0.0, 1.0) * 255.0;
  let idx = clamp(i32(floor(idxF + 0.5)), 0, 255);
  return textureLoad(t_bind1, vec2<i32>(idx, 0), 0).rgb;
}

fn sampleLutLinearF(valueUnit: f32) -> vec3<f32> {
  let idxF = clamp(valueUnit, 0.0, 1.0) * 255.0;
  let base = floor(idxF);
  let i0 = clamp(i32(base), 0, 255);
  let i1 = min(i0 + 1, 255);
  let frac = idxF - base;
  let c0 = textureLoad(t_bind1, vec2<i32>(i0, 0), 0).rgb;
  let c1 = textureLoad(t_bind1, vec2<i32>(i1, 0), 0).rgb;
  return mix(c0, c1, frac);
}

// operatorId: 0=linear, 1=srgb, 2=reinhard, 3=aces, 4=extended (Extended·Linear),
// 5=extended-reinhard, 6=extended-aces, 7=extended-clamp (Extended·Linear
// managed), 8=gamma (matches OPERATOR_ID in image-engine.ts / TONEMAP_OPERATORS +
// the extended curves in image/tonemap.ts). linear/srgb/gamma are the SAME clamp
// (the RANGE-MAP) — the display transfer (sRGB OETF, identity, or the gamma power
// curve) lives in outputEncodeF, selected by the gamma uniform the renderer
// packs per operator (see image/tonemap.ts's resolveEncodeGamma). 4 (extended) is a pure identity —
// no compression, no clamp — deliberately preserving values above 1.0 for a real
// HDR (hdrOut) target. 5/6 are the peak-parameterized HDR roll-off operators;
// 7 is the peak-parameterized HARD clamp (managed linear) — all three read
// the peak uniform (see image/tonemap.ts's doc comments).
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
  if (operatorId == 7) {
    return vec3<f32>(extendedClampCurve(rgb.x, peak), extendedClampCurve(rgb.y, peak), extendedClampCurve(rgb.z, peak));
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
  let srgbDecode = u_bind8 > 0.5;

  // 0) [SDR display-transfer path] sRGB-DECODE the sampled 8-bit source to
  //    linear light so exposure/offset + the chosen transfer operate on linear
  //    values (tev-style). Off for the HDR/float path (scene-linear already).
  var src = sampled.rgb;
  if (srgbDecode) {
    src = vec3<f32>(srgbEotf(src.r), srgbEotf(src.g), srgbEotf(src.b));
  }

  // 1) exposure + offset (TEV convention), in scene-linear space:
  //    v * 2^EV + offset. Offset is additive AFTER exposure, BEFORE the
  //    colormap / tone-map / output-encode stages below.
  var rgb = src * exp2(exposureEV) + vec3<f32>(offset);

  // 2) scalar image + colormap LUT (GPU-only pipeline stage; see module doc).
  //    The LUT lookup mirrors the SOURCE filter: bilinear source sampling pairs
  //    with a LINEAR LUT lookup (interpolate the scalar across texels, THEN
  //    interpolate the LUT across its entries — the smooth false-color path),
  //    nearest source sampling pairs with the crisp round-half-up NEAREST index.
  //    Keying both off the one filterLinear flag keeps colormapped rendering
  //    from diverging from the plain path's interpolation at any zoom.
  if (isScalar) {
    if (filterLinear) {
      rgb = sampleLutLinearF(rgb.x);
    } else {
      rgb = sampleLutNearestF(rgb.x);
    }
  }

  // 3) tone-map operator: HDR [0,inf) -> display-linear [0,1] (or [0,peak] for
  //    the extended roll-off operators, which stay HDR-out).
  rgb = applyOperator(rgb, operatorId, peak);

  // 4) output-encode.
  let hasGamma = gamma > 0.0;
  if (hdrOut) {
    // EXTENDED HDR surface (rgba16float, srgb/display-p3): the canvas stores
    // TRANSFER-ENCODED (non-linear) signals per W3C ColorWeb-CG, so ENCODE the
    // display-linear light the operator produced — the extended (unclamped,
    // origin-mirrored) sRGB OETF, or the extended power curve for the Gamma
    // operator (hasGamma). Values above 1 / below 0 survive as extended
    // brightness. See extendedOutputEncodeF + image/tonemap.ts's doc block.
    return vec4<f32>(
      extendedOutputEncodeF(rgb.r, gamma, hasGamma),
      extendedOutputEncodeF(rgb.g, gamma, hasGamma),
      extendedOutputEncodeF(rgb.b, gamma, hasGamma),
      1.0,
    );
  }
  return vec4<f32>(
    outputEncodeF(rgb.r, gamma, hasGamma),
    outputEncodeF(rgb.g, gamma, hasGamma),
    outputEncodeF(rgb.b, gamma, hasGamma),
    1.0,
  );
}
`,Ge=`
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
`,wt=`
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

// Colormap LUT lookup, nearest and linear variants (see image.wgsl.ts's
// sampleLutNearestF/sampleLutLinearF doc). Callers pick the variant with the
// SAME filterMode flag that selects nearest vs. bilinear source sampling, so a
// colormapped result shares one interpolation decision with the plain path:
//  - NEAREST (round-half-up index) at the pixelated zoom — crisp per-texel color.
//  - LINEAR (blend adjacent entries by the fractional index) at moderate zoom —
//    so a bilinearly-interpolated scalar yields a smooth color rather than
//    snapping to one of 256 discrete bins (the per-texel banding / blocky
//    corners bug). At a texel-aligned 8-bit scalar the fraction is 0, so LINEAR
//    degenerates to the exact NEAREST entry.
fn sampleLUT(lut: texture_2d<f32>, valueUnit: f32) -> vec3<f32> {
  let idxF = clamp(valueUnit, 0.0, 1.0) * 255.0;
  let idx = clamp(i32(floor(idxF + 0.5)), 0, 255);
  return textureLoad(lut, vec2<i32>(idx, 0), 0).rgb;
}

fn sampleLUTLinear(lut: texture_2d<f32>, valueUnit: f32) -> vec3<f32> {
  let idxF = clamp(valueUnit, 0.0, 1.0) * 255.0;
  let base = floor(idxF);
  let i0 = clamp(i32(base), 0, 255);
  let i1 = min(i0 + 1, 255);
  let frac = idxF - base;
  let c0 = textureLoad(lut, vec2<i32>(i0, 0), 0).rgb;
  let c1 = textureLoad(lut, vec2<i32>(i1, 0), 0).rgb;
  return mix(c0, c1, frac);
}
`,kt=`
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
`,$a=`
fn srgbOetf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.0031308) { return 12.92 * v; }
  return 1.055 * pow(v, 1.0 / 2.4) - 0.055;
}

// sRGB EOTF (sRGB code -> linear) — inverse of srgbOetf. LINEARIZES an 8-bit
// sRGB compare side when srgbDecode is set (a u8 source going through the
// display-transfer pipeline), so exposure/offset + the operator act on linear
// light. A float side leaves srgbDecode off (already scene-linear).
fn srgbEotf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.04045) { return v / 12.92; }
  return pow((v + 0.055) / 1.055, 2.4);
}

fn outputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 {
  if (hasGamma) { return clamp(pow(clamp(x, 0.0, 1.0), 1.0 / gamma), 0.0, 1.0); }
  return srgbOetf(x);
}

// EXTENDED output-encode (HDR-out / extended-surface transfer) — unclamped,
// origin-mirrored sRGB OETF / power curve (values past 1 survive as extended
// brightness). Mirrors image.wgsl.ts's extendedSrgbOetf/extendedGammaEncode/
// extendedOutputEncodeF exactly.
fn extendedSrgbOetf(x: f32) -> f32 {
  let a = abs(x);
  let s = sign(x);
  if (a <= 0.0031308) { return s * 12.92 * a; }
  return s * (1.055 * pow(a, 1.0 / 2.4) - 0.055);
}
fn extendedGammaEncode(x: f32, gamma: f32) -> f32 {
  let a = abs(x);
  let s = sign(x);
  return s * pow(a, 1.0 / gamma);
}
fn extendedOutputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 {
  if (hasGamma) { return extendedGammaEncode(x, gamma); }
  return extendedSrgbOetf(x);
}

fn reinhardCurve(x: f32) -> f32 { let v = max(x, 0.0); return v / (1.0 + v); }
fn acesCurve(x: f32) -> f32 {
  let v = max(x, 0.0);
  let num = v * (2.51 * v + 0.03);
  let den = v * (2.43 * v + 0.59) + 0.14;
  return clamp(num / den, 0.0, 1.0);
}

// Peak-parameterized extended operators (ids 5/6/7) — mirror image.wgsl.ts
// exactly: Reinhard rescaled to asymptote P, ACES canonical-scaled to P, and the
// managed hard clamp at P.
fn extendedReinhardCurve(x: f32, peak: f32) -> f32 { let v = max(x, 0.0); let p = max(peak, 1e-6); return v / (1.0 + v / p); }
fn extendedAcesCurve(x: f32, peak: f32) -> f32 { let v = max(x, 0.0); let p = max(peak, 1e-6); return p * acesCurve(v / p); }
fn extendedClampCurve(x: f32, peak: f32) -> f32 { let v = max(x, 0.0); let p = max(peak, 1e-6); return min(v, p); }

// operatorId: 0=linear, 1=srgb, 2=reinhard, 3=aces, 4=extended (pure identity),
// 5=extended-reinhard, 6=extended-aces, 7=extended-clamp, 8=gamma (clamp; γ in
// the encode). Ids 5/6/7 read the peak uniform. Matches image.wgsl.ts's
// applyOperator + OPERATOR_ID in image-engine.ts.
fn applyOperator(rgb: vec3<f32>, operatorId: i32, peak: f32) -> vec3<f32> {
  if (operatorId == 2) { return vec3<f32>(reinhardCurve(rgb.x), reinhardCurve(rgb.y), reinhardCurve(rgb.z)); }
  if (operatorId == 3) { return vec3<f32>(acesCurve(rgb.x), acesCurve(rgb.y), acesCurve(rgb.z)); }
  if (operatorId == 4) { return rgb; }
  if (operatorId == 5) { return vec3<f32>(extendedReinhardCurve(rgb.x, peak), extendedReinhardCurve(rgb.y, peak), extendedReinhardCurve(rgb.z, peak)); }
  if (operatorId == 6) { return vec3<f32>(extendedAcesCurve(rgb.x, peak), extendedAcesCurve(rgb.y, peak), extendedAcesCurve(rgb.z, peak)); }
  if (operatorId == 7) { return vec3<f32>(extendedClampCurve(rgb.x, peak), extendedClampCurve(rgb.y, peak), extendedClampCurve(rgb.z, peak)); }
  return clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
}

// Per-side [sRGB-DECODE] -> exposure+offset -> [scalar LUT] -> operator(peak) ->
// encode. srgbDecode LINEARIZES a u8 side first (a float side passes it 0). The
// lut is only read when isScalar. offset is the TEV display offset (added AFTER
// exposure, BEFORE colormap/tonemap/encode). On hdrOut the EXTENDED (unclamped)
// encode runs so values past P survive to the extended HDR surface.
fn processSide(lut: texture_2d<f32>, sampled: vec4<f32>, exposureEV: f32, offset: f32, operatorId: i32, gamma: f32, isScalar: bool, hdrOut: bool, peak: f32, srgbDecode: bool, filterLinear: bool) -> vec3<f32> {
  var src = sampled.rgb;
  if (srgbDecode) { src = vec3<f32>(srgbEotf(src.r), srgbEotf(src.g), srgbEotf(src.b)); }
  var rgb = src * exp2(exposureEV) + vec3<f32>(offset);
  // LUT lookup mirrors the source filter (see sampleLUT/sampleLUTLinear doc):
  // bilinear source sampling -> linear LUT, nearest -> nearest, so colormapped
  // compare sides interpolate exactly like the plain single-image path.
  if (isScalar) {
    if (filterLinear) { rgb = sampleLUTLinear(lut, rgb.x); }
    else { rgb = sampleLUT(lut, rgb.x); }
  }
  rgb = applyOperator(rgb, operatorId, peak);
  let hasGamma = gamma > 0.0;
  if (hdrOut) {
    return vec3<f32>(extendedOutputEncodeF(rgb.r, gamma, hasGamma), extendedOutputEncodeF(rgb.g, gamma, hasGamma), extendedOutputEncodeF(rgb.b, gamma, hasGamma));
  }
  return vec3<f32>(outputEncodeF(rgb.r, gamma, hasGamma), outputEncodeF(rgb.g, gamma, hasGamma), outputEncodeF(rgb.b, gamma, hasGamma));
}
`,rn=`
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
`;function Xr(e){return`
${Ge}
${wt}
${$a}

@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(6) var lut: texture_2d<f32>;
@group(0) @binding(11) var<uniform> u_img: vec4<f32>;     // exposureEV, operatorId, gamma, isScalar
@group(0) @binding(14) var<uniform> u_uv: vec4<f32>;      // uvRect.xy, uvRect.wh
@group(0) @binding(17) var<uniform> u_compose: vec4<f32>; // split, alpha, hdrOut, filterMode
@group(0) @binding(20) var<uniform> u_extra: vec4<f32>;   // offset, peak, srgbDecodeA, srgbDecodeB

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
  let peak = u_extra.y;
  let srgbDecodeA = u_extra.z > 0.5;
  let srgbDecodeB = u_extra.w > 0.5;

  let colorA = processSide(lut, sampledA, exposureEV, offset, operatorId, gamma, isScalar, hdrOut, peak, srgbDecodeA, filterLinear);
  let colorB = processSide(lut, sampledB, exposureEV, offset, operatorId, gamma, isScalar, hdrOut, peak, srgbDecodeB, filterLinear);

  let split = u_compose.x;
  let alpha = u_compose.y;
  let outColor = ${e};
  return vec4<f32>(outColor, 1.0);
}
`}const Xa=Xr("select(colorB, colorA, uv.x < split)"),Wa=Xr("mix(colorA, colorB, alpha)");function Ha(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Wr(e,t,n){const{v:r,h:o}=Ha(n),a=e.w-t.w,s=e.h-t.h,l=o==="left"?0:o==="right"?a:Math.floor(a/2),i=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:l,y:i}}function Lt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const a={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:a,offsetA:Wr(e,a,n),offsetB:Wr(t,a,n)}}function Vn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const on={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6,"extended-clamp":7,gamma:8},Hr=new WeakMap;function Ya(e,t){let n=Hr.get(e);n||(n=new Map,Hr.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Va,targetFormat:t}),n.set(t,r)),r}function Yr(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Kr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ka(e,t,n,r){var x;const o=Yr(t),a=Ya(e,o),s=Kr(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,i=on[r.operator]??on.srgb,u=new Float32Array([r.exposureEV,i,l,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),m=new Float32Array([r.filter==="nearest"?0:1]),b=new Float32Array([r.offset??0]),v=new Float32Array([r.peak??$t]),y=new Float32Array([r.srgbDecode?1:0]);let M;try{M=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:m}},{binding:6,resource:{uniform:b}},{binding:7,resource:{uniform:v}},{binding:8,resource:{uniform:y}}]),e.renderFullscreen(t,a,M)}finally{(x=M==null?void 0:M.destroy)==null||x.call(M),s.destroy()}}const qr=new WeakMap;function qa(e,t,n){let r=qr.get(e);r||(r=new Map,qr.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?Xa:Wa,targetFormat:n}),r.set(o,a)),a}function Za(e,t,n,r,o){var y;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Yr(t),s=qa(e,o.mode,a),l=Kr(e,o.isScalar?o.colormap:void 0),i=typeof o.gamma=="number"&&o.gamma>0?o.gamma:0,u=on[o.operator]??on.srgb,d=new Float32Array([o.exposureEV,u,i,o.isScalar?1:0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),m=new Float32Array([o.split,o.alpha,o.hdrOut?1:0,o.filter==="nearest"?0:1]),b=new Float32Array([o.offset??0,o.peak??$t,o.srgbDecodeA?1:0,o.srgbDecodeB?1:0]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:m}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,s,v)}finally{(y=v==null?void 0:v.destroy)==null||y.call(v),l.destroy()}}function Zr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function jr(e,t,n,r){const o=r??Lt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,l=a*s*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:p,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,a,s);return Zr(p,E,l)}const u=await e.readback(t),d=await e.readback(n),g=u instanceof Uint8Array?255:1,m=d instanceof Uint8Array?255:1,b=sn(u,t.width,t.height,g,o.offsetA,o.fit==="fill",a,s),v=sn(d,n.width,n.height,m,o.offsetB,o.fit==="fill",a,s);let y=0,M=0;const x=[0,0,0],h=[0,0,0];for(let p=0;p<s;p++)for(let E=0;E<a;E++){b(E,p,x),v(E,p,h);for(let _=0;_<3;_++){const w=x[_]-h[_];y+=w*w,M+=Math.abs(w)}}return Zr(y,M,l)}function sn(e,t,n,r,o,a,s,l){const i=(g,m,b)=>e[(m*t+g)*4+b]??0;if(!a)return(g,m,b)=>{const v=Math.min(Math.max(g+o.x,0),t-1),y=Math.min(Math.max(m+o.y,0),n-1);b[0]=i(v,y,0)/r,b[1]=i(v,y,1)/r,b[2]=i(v,y,2)/r};const u=t-1,d=n-1;return(g,m,b)=>{const v=(g+.5)/s,y=(m+.5)/l,M=v*t-.5,x=y*n-.5,h=Math.floor(M),p=Math.floor(x),E=M-h,_=x-p,w=Math.min(Math.max(h,0),u),C=Math.min(Math.max(h+1,0),u),S=Math.min(Math.max(p,0),d),A=Math.min(Math.max(p+1,0),d);for(let T=0;T<3;T++){const P=i(w,S,T),k=i(C,S,T),R=i(w,A,T),L=i(C,A,T),N=P+(k-P)*E,X=R+(L-R)*E;b[T]=(N+(X-N)*_)/r}}}function Qr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const ja=12,ct=[];function Jr(e){const t=ct.indexOf(e);t!==-1&&ct.splice(t,1),ct.push(e)}function Qa(e){const t=ct.indexOf(e);t!==-1&&ct.splice(t,1)}function an(e){e.parked||(Qa(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function eo(e){for(;ct.length>ja;){const t=ct.find(n=>n!==e&&!n.visible)??ct.find(n=>n!==e);if(!t)break;an(t)}}function to(e){var o,a,s,l;if(e.disposed)return;if(Qr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Jr(e),eo(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((a=e.deep)==null?void 0:a.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((l=e.deep)==null?void 0:l.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const i=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=i,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,i,e.deepZNear,e.deepZFar)}else if(e.source){const i=t.createTexture(e.source.width,e.source.height,e.source.format);i.write(e.source.data),e.srcTexture=i}e.parked=!1,Jr(e),eo(e)}function Ja(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return to(e),!e.surface||!e.srcTexture?!1:(Ka(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,an(e),!1}}function ei(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Ja(e,t)},park(){e.disposed||an(e)},restore(){e.disposed||!e.source&&!e.deep||to(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(an(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function ti(e,t){const n=await zt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return ei(r)}function no(e){e.dispose()}function ro({title:e,body:t,className:n}){return f.jsx("div",{className:n??"relative h-full w-full",children:f.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[f.jsx("div",{className:"text-sm font-semibold text-fg",children:e}),f.jsx("div",{className:"text-xs text-fg-muted",children:t})]})})}function ni(e,t,n){return t<=0||n<=0||e.width<=0||e.height<=0?0:Math.min(e.width/t,e.height/n)}function ri(e,t){return e>=t?"pixelated":void 0}function oi(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function oo(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:l,flipSign:i}=e,u=c.useMemo(()=>oi(e,n),[n,r,o,s,i]);return{gammaFilterId:n,filterStr:u,gamma:a,offset:l}}function so({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const si=["nw","n","ne","e","se","s","sw","w"];function ai(e,t,n,r,o,a=1){const s=o.w-1,l=o.h-1,i=Math.round(n),u=Math.round(r);if(t==="move"){const h=e.x1-e.x0,p=e.y1-e.y0,E=xt(e.x0+i,0,s-h),_=xt(e.y0+u,0,l-p);return{x0:E,y0:_,x1:E+h,y1:_+p}}let{x0:d,y0:g,x1:m,y1:b}=e;const v=t==="nw"||t==="w"||t==="sw",y=t==="ne"||t==="e"||t==="se",M=t==="nw"||t==="n"||t==="ne",x=t==="sw"||t==="s"||t==="se";return v&&(d=xt(d+i,0,m-(a-1))),y&&(m=xt(m+i,d+(a-1),s)),M&&(g=xt(g+u,0,b-(a-1))),x&&(b=xt(b+u,g+(a-1),l)),{x0:d,y0:g,x1:m,y1:b}}function ao(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function ii({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=ao(e),a=ao(t),s=[];for(let h=0;h<=e;h+=o)s.push(h);const l=[];for(let h=0;h<=t;h+=a)l.push(h);const i=1/n,u=8*i,d=-12*i,g=-2*i,m=r==null?void 0:r.current;let b=0,v=0,y=0,M=0;if(m){const h=m.clientWidth,p=m.clientHeight,E=h/e,_=p/t,w=Math.min(E,_);y=e*w,M=t*w,b=(h-y)/2,v=(p-M)/2}const x=m&&y>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:x?v:0,transform:`translateY(${d}px)`,fontSize:u},children:s.map(h=>f.jsx("span",{className:"mono",style:{position:"absolute",left:x?b+h/e*y:`${h/e*100}%`,transform:"translateX(-50%)"},children:h},h))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:x?b:0,transform:`translateX(${g}px)`,fontSize:u},children:l.map(h=>f.jsx("span",{className:"mono",style:{position:"absolute",top:x?v+h/t*M:`${h/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*i}px`},children:h},h))})]})}function $n({label:e,corner:t="bottom-left",isDraggable:n=!1,grip:r=n,onDragStart:o}){const a=t==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return f.jsxs("span",{className:`absolute ${a} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:o,style:{cursor:n?"grab":void 0},children:[r&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const ci=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function io(e,t){const n=getComputedStyle(e),r=ci.map(i=>`${i}:${n.getPropertyValue(i)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,l=Math.min(a.length,s.length);for(let i=0;i<l;i++)io(a[i],s[i])}function Xn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Wn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Hn(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,i)=>a.toBlob(u=>u?l(u):i(new Error("plot-to-png: toBlob returned null")),"image/png"))}function li(e,t,n){const r=e.cloneNode(!0);io(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const i=new Image;i.onload=()=>s(i),i.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),i.src=a})}async function co(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??Xn(e);return Hn(r,o,Wn(t),a,s=>s.drawImage(e,0,0,r,o))}async function ui(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??Xn(e);try{return await Hn(r,o,Wn(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function fi(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function di(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??Xn(e);if(n){const u=n.getBoundingClientRect(),d=await li(n,u.width||a,u.height||s);return Hn(a,s,Wn(t),l,g=>{for(const m of r){const b=m.getBoundingClientRect();g.drawImage(m,b.left-o.left,b.top-o.top,b.width,b.height)}g.drawImage(d,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return co(r[0],t);const i=fi(e);if(i)return ui(i,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function pi(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const hi=8;function mi(e,t,n,r=hi){return!(t>0)||!(e>0)?n:e<t+r}function lo(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function gi(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=/^([+-]?)(inf(?:inity)?|∞)$/i.exec(n);if(r)return r[1]==="-"?-1/0:1/0;const o=Number(n);return Number.isNaN(o)?null:o}function xi(e,t){const n=gi(e);return n===null?t:n}function bi(e){return String(e)}const vi={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},yi={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function tt({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:yi[e]??null})}function uo({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(tt,{name:e??""})})}function fo(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function po(e,t,n){const r=c.useRef(n);r.current=n,c.useEffect(()=>{if(!e)return;const o=s=>{t.current&&!t.current.contains(s.target)&&r.current()},a=s=>{s.key==="Escape"&&(s.stopPropagation(),r.current())};return document.addEventListener("pointerdown",o,!0),document.addEventListener("keydown",a,!0),()=>{document.removeEventListener("pointerdown",o,!0),document.removeEventListener("keydown",a,!0)}},[e,t])}function wi({icon:e,title:t,menu:n}){var M;const{options:r,value:o,onSelect:a}=n,[s,l]=c.useState(!1),[i,u]=c.useState(0),d=c.useRef(null),g=lo(r,o),m=e?void 0:((M=r[g])==null?void 0:M.label)??"",b=c.useCallback(()=>{l(x=>{const h=!x;return h&&u(g),h})},[g]),v=c.useCallback(x=>{a(x),l(!1)},[a]);po(s,d,()=>l(!1));const y=x=>{if(!s){(x.key==="ArrowDown"||x.key==="Enter"||x.key===" ")&&(x.preventDefault(),u(g),l(!0));return}if(x.key==="ArrowDown")x.preventDefault(),u(h=>(h+1)%r.length);else if(x.key==="ArrowUp")x.preventDefault(),u(h=>(h-1+r.length)%r.length);else if(x.key==="Enter"||x.key===" "){x.preventDefault();const h=r[i];h&&v(h.id)}};return f.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:x=>x.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:x=>{x.stopPropagation(),b()},onDoubleClick:x=>x.stopPropagation(),onKeyDown:y,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",m?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[m?f.jsx("span",{"aria-hidden":"true",children:m}):f.jsx(tt,{name:e??""}),f.jsx(tt,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((x,h)=>{const p=x.id===o,E=h===i;return f.jsx("li",{role:"option","aria-selected":p,children:f.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),v(x.id)},onPointerEnter:()=>u(h),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",p?"text-accent font-medium":"text-fg"].join(" "),children:x.label})},x.id)})})]})}const Ei=e=>e.format?e.format(e.value):String(e.value);function ho({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),a=c.useRef(null),s=c.useCallback(()=>{o(bi(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&a.current&&(a.current.focus(),a.current.select())},[t]);const l=c.useCallback(()=>{n(u=>(u&&e.onChange(xi(r,e.value)),!1))},[r,e]),i=c.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(tt,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:a,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),l()):u.key==="Escape"&&(u.preventDefault(),i())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ei(e)})]})]})}function _i({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:a,onSelect:s}=n,[l,i]=c.useState(!1),u=lo(o,a),d=((g=o[u])==null?void 0:g.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:m=>{m.stopPropagation(),i(b=>!b)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(tt,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),f.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:f.jsx(tt,{name:"caret"})})]}),l&&o.map(m=>{const b=m.id===a;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":b,"data-menu-option":"",onClick:v=>{v.stopPropagation(),s(m.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",b?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:b?"✓":""}),f.jsx("span",{children:m.label})]},m.id)})]})}function Mi({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return po(r,a,()=>o(!1)),f.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(tt,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(_i,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var i;l.stopPropagation(),!s.disabled&&((i=s.onClick)==null||i.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(tt,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(tt,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(ho,{spec:s})},s.id))]})]})}function Si({controller:e,config:t}){var P,k;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),l=`${((P=t==null?void 0:t.leadingButtons)==null?void 0:P.length)??0}:${((k=t==null?void 0:t.sliders)==null?void 0:k.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const R=n.current,L=R==null?void 0:R.parentElement;if(!L)return;const N=()=>{const I=L.clientWidth;if(!a.current&&n.current){const j=n.current.scrollWidth;j>0&&(s.current=j)}o(mi(I,s.current,a.current))};let X=0;const W=()=>{X||(X=requestAnimationFrame(()=>{X=0,N()}))},G=new ResizeObserver(W);return G.observe(L),N(),()=>{G.disconnect(),X&&cancelAnimationFrame(X)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const i=e.capabilities,u=t==null?void 0:t.buttons,d=(R,L)=>L&&(u==null?void 0:u[R])!==!1,g=R=>()=>e.setDragMode(R),m=()=>{e.toPNG({filename:"plot"}).then(R=>pi(R,"plot.png")).catch(()=>{})},b=[];d("zoom",i.zoom)&&b.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),d("pan",i.pan)&&b.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),d("select",i.select)&&b.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),d("lasso",i.lasso)&&b.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const v=[];d("zoomIn",i.zoom)&&v.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",i.zoom)&&v.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const y=[];d("autoscale",i.autoscale)&&y.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",i.reset)&&y.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const M=[];d("screenshot",i.screenshot)&&M.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:m});const x=[b,v,y,M].filter(R=>R.length>0),h=x.flat(),p=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!p.length&&h.length===0&&E.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",w=(t==null?void 0:t.visibility)==="always",C=_==="top-right"||_==="bottom-right",A=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",w?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),T={position:"absolute",pointerEvents:"auto",...vi[_]};return r?f.jsx("div",{ref:n,style:T,className:`${A} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(Mi,{actions:h,leading:p,sliders:E})}):f.jsxs("div",{ref:n,style:T,className:`${A} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[p.length>0&&f.jsxs(f.Fragment,{children:[p.map(R=>R.menu?f.jsx(wi,{icon:R.icon,title:R.title,menu:R.menu},R.id):f.jsx(uo,{icon:R.icon,label:R.label,title:R.title,active:R.active,disabled:R.disabled,onClick:R.onClick??(()=>{})},R.id)),x.length>0&&f.jsx(fo,{})]}),x.map((R,L)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[L>0&&f.jsx(fo,{}),R.map(N=>f.jsx(uo,{icon:N.icon,title:N.title,active:N.active,disabled:N.disabled,onClick:N.onClick},N.id))]},R[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:E.map(R=>f.jsx(ho,{spec:R},R.id))})]})}const Ai={zoom:1,pan:{x:0,y:0}},mo=1.3,Ti=.25,Pi=64,Ri={buttons:{zoom:!1}};function Ci(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Di=[{id:"none",label:"None"},...$s];function Ot(e,t){return{id:"colormap",title:"Colormap",menu:{options:Di,value:e,onSelect:t}}}const go={linear:"Linear",srgb:"sRGB",gamma:"Gamma",reinhard:"Reinhard",aces:"ACES",extended:"Extended · Linear","extended-clamp":"Extended · Linear (managed)","extended-reinhard":"Extended · Reinhard","extended-aces":"Extended · ACES"},ki=vr.map(e=>({id:e,label:go[e]}));function cn(e,t){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:ki,value:e,onSelect:t}}}const Li=Ws.map(e=>({id:e,label:go[e]}));function Oi(e,t){return{id:"tonemap",title:"Display transfer (sRGB · Gamma · Linear)",menu:{options:Li,value:e,onSelect:t}}}function Bi({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:l=Ti,maxZoom:i=Pi,requestRender:u,onReset:d,extraModified:g=!1}){const m=c.useCallback(w=>{var X;if(!o)return;const C=(X=e.current)==null?void 0:X.getBoundingClientRect(),S=(C==null?void 0:C.width)??0,A=(C==null?void 0:C.height)??0,T=a&&s&&S>0&&A>0?Fn(a,s,S,A):i,P=Math.max(l,Math.min(T,n*w));if(P===n)return;const k=S/2,R=A/2,L=k-(k-r.x)/n*P,N=R-(R-r.y)/n*P;o({zoom:P,pan:{x:L,y:N}})},[o,e,a,s,i,l,n,r.x,r.y]),b=c.useCallback(()=>m(mo),[m]),v=c.useCallback(()=>m(1/mo),[m]),y=c.useCallback(()=>{o==null||o(Ai),d==null||d()},[o,d]),M=c.useCallback(w=>{const C={scale:w==null?void 0:w.scale,filename:w==null?void 0:w.filename};u==null||u();const S=t==null?void 0:t.current;if(S)return co(S,C);const A=e.current;return A?di(A,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),x=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),h=n!==1||r.x!==0||r.y!==0||g,p=c.useCallback(w=>{},[]),E=c.useCallback(w=>{},[]),_=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:x,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:h,setDragMode:p,setHoverMode:E,toggleSpikelines:_,zoomIn:b,zoomOut:v,autoscale:y,reset:y,toPNG:M}),[x,h,p,E,_,b,v,y,M])}const Ni={zoom:1,pan:{x:0,y:0}};function ln({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:l,naturalDims:i,checkerboard:u,wrapperClassName:d,wrapperStyle:g,viewportPadding:m,header:b,surface:v,showAxes:y,overlayNode:M,overlay:x,notationSeed:h,exportCanvasRef:p,requestRender:E,leadingMenus:_,displayAdjust:w,depthSliders:C,extraSliders:S,regionSelect:A,onReset:T,extraModified:P,label:k,showLabelChip:R,isDraggable:L=!1,onDragStart:N,extraChips:X}){const[W,G]=c.useState(h),[I,j]=c.useState(!1),[Y,ie]=c.useState(!1),te="render"in x?null:x,ae=!!A&&!!te,{containerProps:V}=Ir({containerRef:r,zoom:a,pan:s,onViewportChange:l,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h}),Q=c.useCallback(()=>{w==null||w.onExposureChange(0),w==null||w.onOffsetChange(0),T==null||T()},[w,T]),Z=c.useCallback(()=>{l==null||l(Ni),Q()},[l,Q]),ue=Bi({rootRef:r,canvasRef:p,zoom:a,pan:s,onViewportChange:l,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h,requestRender:E,onReset:Q,extraModified:((w==null?void 0:w.exposureEV)??0)!==0||((w==null?void 0:w.offset)??0)!==0||!!P}),we=c.useMemo(()=>{const Ee=[];if(C&&Ee.push(...C),!w)return S&&Ee.push(...S),Ee.length?Ee:void 0;const Pe=(_e,ve)=>`${_e>=0?"+":"−"}${Math.abs(_e).toFixed(ve)}`;return Ee.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:w.exposureEV,onChange:w.onExposureChange,format:_e=>Pe(_e,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:w.offset,onChange:w.onOffsetChange,format:_e=>Pe(_e,2)}),S&&Ee.push(...S),Ee},[w,C,S]),ne=c.useMemo(()=>ae?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:Y,onClick:()=>ie(Ee=>!Ee)}:null,[ae,Y]),re=c.useMemo(()=>({...Ri,leadingButtons:[..._??[],...ne?[ne]:[],...I?[Ci(W,G)]:[]],sliders:we}),[I,W,_,ne,we]),ce=" cairn-checkerboard",ge="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?ce:""),me=d+(u==="wrapper"?ce:""),Ae="render"in x?x.render({notation:W,setOverlayActive:j}):x.hasSource&&i?f.jsx(yt,{imageElRef:x.displayElRef,naturalWidth:i.w,naturalHeight:i.h,zoom:a,pan:s,sourceWindow:x.sourceWindow,sample:x.sample,notation:W,version:x.version,onActiveChange:j}):null;return f.jsxs("div",{className:`relative isolate flex flex-col h-full${n?" group":""}`,...e,children:[b,n&&f.jsx(Si,{controller:ue,config:re}),f.jsxs("div",{ref:r,className:ge,style:{padding:m,...V.style},onPointerDown:V.onPointerDown,onPointerMove:V.onPointerMove,onPointerUp:V.onPointerUp,onPointerCancel:V.onPointerCancel,onDoubleClick:Z,...t,children:[f.jsxs("div",{ref:o,className:me,style:g,children:[v,y&&i&&f.jsx(ii,{naturalWidth:i.w,naturalHeight:i.h,zoom:a,containerRef:o}),M]}),Ae,!n&&I&&f.jsx($r,{notation:W,onChange:G}),Y&&A&&te&&i&&f.jsx(Ii,{imageElRef:te.displayElRef,naturalDims:i,sourceWindow:te.sourceWindow,onQueryLive:A.queryLive,onSelect:(Ee,Pe,_e,ve)=>{ie(!1),A.commit(Ee,Pe,_e,ve)},onExit:()=>ie(!1)}),!Y&&(A==null?void 0:A.rect)&&te&&i&&f.jsx(Ui,{rect:A.rect,imageElRef:te.displayElRef,naturalDims:i,sourceWindow:te.sourceWindow,zoom:a,pan:s,onQueryLive:A.queryLive,onCommit:A.commit,onRemove:A.remove})]}),R&&f.jsx($n,{label:k,isDraggable:L,onDragStart:N}),X]})}function Ii({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:a}){var M;const s=c.useRef(null),l=c.useRef(null),[i,u]=c.useState(null),d=c.useCallback((x,h,p,E)=>{const _=e.current;return _?zr(x,h,p,E,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);c.useEffect(()=>{const x=h=>{h.key==="Escape"&&a()};return window.addEventListener("keydown",x),()=>window.removeEventListener("keydown",x)},[a]);const g=c.useCallback(x=>{var h,p;(p=(h=x.target).setPointerCapture)==null||p.call(h,x.pointerId),l.current={x:x.clientX,y:x.clientY},u({x0:x.clientX,y0:x.clientY,x1:x.clientX,y1:x.clientY})},[]),m=c.useCallback(x=>{const h=l.current;if(!h)return;u({x0:h.x,y0:h.y,x1:x.clientX,y1:x.clientY});const p=d(h.x,h.y,x.clientX,x.clientY);p&&r(p.x0,p.y0,p.x1,p.y1)},[d,r]),b=c.useCallback(x=>{const h=l.current;l.current=null,u(null);const p=e.current;if(!h||!p){a();return}if(Math.abs(x.clientX-h.x)<3&&Math.abs(x.clientY-h.y)<3){a();return}const E=p.getBoundingClientRect(),_=zr(h.x,h.y,x.clientX,x.clientY,{box:E,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){a();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,a]),v=(M=s.current)==null?void 0:M.getBoundingClientRect(),y=i&&v?{left:Math.min(i.x0,i.x1)-v.left,top:Math.min(i.y0,i.y1)-v.top,width:Math.abs(i.x1-i.x0),height:Math.abs(i.y1-i.y0)}:null;return f.jsx("div",{ref:s,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:g,onPointerMove:m,onPointerUp:b,children:y&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:y})})}const Fi={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function Ui({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:a,onQueryLive:s,onCommit:l,onRemove:i}){const u=c.useRef(null),[d,g]=c.useState(null),m=c.useRef(null),[b,v]=c.useState(null),y=d??e;c.useLayoutEffect(()=>{const p=()=>{const w=t.current,C=u.current;if(!w||!C)return;const S=w.getBoundingClientRect(),A=C.getBoundingClientRect(),T=Ra(y,{box:S,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});v({left:T.left-A.left,top:T.top-A.top,width:T.width,height:T.height})};p();const E=t.current;if(!E||typeof ResizeObserver>"u")return;const _=new ResizeObserver(p);return _.observe(E),()=>_.disconnect()},[y,n.w,n.h,r,o,a.x,a.y]);const M=c.useCallback(p=>E=>{var _,w;E.stopPropagation(),(w=(_=E.target).setPointerCapture)==null||w.call(_,E.pointerId),m.current={handle:p,sx:E.clientX,sy:E.clientY,start:y},g(y)},[y]),x=c.useCallback(p=>{const E=m.current,_=t.current;if(!E||!_)return;const w=Pa({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),C=(p.clientX-E.sx)/(w||1),S=(p.clientY-E.sy)/(w||1),A=ai(E.start,E.handle,C,S,{w:n.w,h:n.h},1);g(A),s(A.x0,A.y0,A.x1,A.y1)},[t,n.w,n.h,r,s]),h=c.useCallback(()=>{const p=m.current;m.current=null;const E=d;g(null),p&&E&&l(E.x0,E.y0,E.x1,E.y1)},[d,l]);return b?f.jsxs("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...b,cursor:"move",touchAction:"none"},onPointerDown:M("move"),onPointerMove:x,onPointerUp:h}),si.map(p=>{const E=Fi[p];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:b.left+E.fx*b.width-12,top:b.top+E.fy*b.height-12,width:24,height:24,cursor:E.cursor,touchAction:"none"},onPointerDown:M(p),onPointerMove:x,onPointerUp:h,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},p)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:b.left+b.width-8,top:b.top-32,width:40,height:40},onPointerDown:p=>p.stopPropagation(),onClick:i,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none"})}const Yn={inFlight:!1,pending:null};function xo(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function bo(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:Yn,launch:null}}const Gi=1e3,zi=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),vo=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function yo(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,a=t!=null,[s,l,i]=Ne(r),[u,d,g]=Ne(o),[m,b]=c.useState(null),[v,y]=c.useState(null),M=c.useRef(n);M.current=n;const x=c.useRef(r);x.current=r;const h=c.useRef(o);h.current=o;const p=c.useRef(s);p.current=s;const E=c.useRef(u);E.current=u;const _=c.useRef({near:s,far:u,ver:0}),w=c.useRef(0),C=c.useRef(!0),S=c.useRef(Yn),A=c.useRef(null),T=l,P=d,k=c.useCallback(()=>{const V=M.current;if(!V)return;const{near:Q,far:Z,ver:ue}=_.current,we=()=>{const ne=bo(S.current);S.current=ne.state,ne.launch!=null&&k()};V.flatten(Q,Z).then(ne=>{_.current.ver===ue&&!C.current&&(A.current!=null&&vo(A.current),A.current=zi(()=>{A.current=null,b(ne)})),we()}).catch(we)},[]),R=c.useCallback(()=>{const V=xo(S.current,1);S.current=V.state,V.launch!=null&&k()},[k]);c.useEffect(()=>()=>{A.current!=null&&vo(A.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(!n)return;const V=s<=r&&u>=o;if(C.current=V,w.current+=1,_.current={near:s,far:u,ver:w.current},a){t(s,u);return}if(V){b(null);return}R()},[n,s,u,r,o,R,a,t]);const L=c.useMemo(()=>n&&!a&&m!=null?{...e,data:m}:e,[e,n,a,m]),N=n!=null&&r>0&&o/r>Gi,X=c.useMemo(()=>{if(!n||!(o>r))return;const V=Z=>Math.abs(Z)>=1e3||Math.abs(Z)<.01&&Z!==0?Z.toExponential(2):Z.toFixed(3),Q=(Z,ue,we,ne,re)=>{if(N){const ce=Math.log10(r),ge=Math.log10(o);return{id:Z,icon:"layers",label:ue,title:`${we} (log scale). Double-click to type a Z.`,min:ce,max:ge,step:(ge-ce)/200,value:Math.log10(Math.max(r,Math.min(ne,o))),onChange:me=>re(10**me),format:me=>V(10**me)}}return{id:Z,icon:"layers",label:ue,title:`${we}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:ne,onChange:re,format:V}};return[Q("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",s,T),Q("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",u,P)]},[n,r,o,s,u,N,T,P]),W=c.useCallback(V=>{if(V.count===0){const ue=x.current,we=h.current,ne=we>ue?0:1;l(we+ne),d(ue-ne);return}const Q=h.current-x.current,Z=Math.max(Math.abs(Q)*1e-4,1e-4);l(V.zMin-Z),d(V.zMax+Z)},[l,d]),G=c.useRef(null),I=c.useRef(Yn),j=c.useCallback(()=>{const V=M.current,Q=G.current,Z=()=>{const ue=bo(I.current);I.current=ue.state,ue.launch!=null&&j()};if(!V||!Q){Z();return}V.zRangeInRect(Q.x0,Q.y0,Q.x1,Q.y1).then(ue=>{W(ue),Z()}).catch(Z)},[W]),Y=c.useCallback((V,Q,Z,ue)=>{G.current={x0:V,y0:Q,x1:Z,y1:ue};const we=xo(I.current,1);I.current=we.state,we.launch!=null&&j()},[j]),ie=c.useCallback((V,Q,Z,ue)=>{y({x0:V,y0:Q,x1:Z,y1:ue}),Y(V,Q,Z,ue)},[Y]),te=c.useCallback(()=>{y(null),i.reset(),g.reset(),b(null)},[i,g]),ae=c.useCallback(()=>{i.reset(),g.reset(),y(null),b(null)},[i,g]);return{hdr:L,sliders:X,hasDeep:n!=null,region:v,queryRegionWindow:Y,commitRegion:ie,removeRegion:te,reset:ae,isModified:i.isModified||g.isModified}}function wo(e){return"hdr"in e&&e.hdr!=null}function Vi(e){return{dtype:"uint8",url:e}}function Eo(e){const t=e.source,n=t.dtype==="float"?t.data:null,r=t.dtype==="float"?t.shape:null,o=t.dtype==="float"?t.precision:void 0,a=t.dtype==="float"?t.numpyDtype:void 0,s=t.dtype==="float"?t.deep:void 0,l=c.useMemo(()=>n?{data:n,shape:r??[],dtype:a??"<f4",precision:o,deep:s}:null,[n,r,o,a,s]);return l?{hdr:l,tonemap:e.tonemap,exposure:e.exposure,offset:e.offset,gamma:e.gamma,peak:e.peak,showAxes:e.showAxes,label:e.label,interpolation:e.interpolation,zoom:e.zoom,pan:e.pan,onViewportChange:e.onViewportChange,pixelValueNotation:e.pixelValueNotation,toolbar:e.toolbar}:{imageUrl:t.dtype==="uint8"?t.url:null,baselineUrl:e.baselineUrl,isBaseline:e.isBaseline,diffMode:e.diffMode,interpolation:e.interpolation,tonemap:e.tonemap,gamma:e.gamma,peak:e.peak,exposure:e.exposure,offset:e.offset,colormap:e.colormap,showAxes:e.showAxes,processing:e.processing,zoom:e.zoom,pan:e.pan,onViewportChange:e.onViewportChange,onNaturalSize:e.onNaturalSize,label:e.label??"",isDraggable:e.isDraggable,onDragStart:e.onDragStart,className:e.className,overlay:e.overlay,overlaySettings:e.overlaySettings,pixelValueNotation:e.pixelValueNotation,toolbar:e.toolbar}}function _o(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function De(e){return Number.isFinite(e)?e:0}const $i={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Xi(e,t,n,r,o=0){const{h:a,w:s,c:l}=_o(e.shape),i=e.precision==="f16-bits"?Cr(e.data):e.data,u=Hs(t),d=new Uint8ClampedArray(s*a*4);for(let g=0;g<s*a;g++){const m=g*l;let b,v,y,M=1;l===1?b=v=y=De(i[m]):l===3?(b=De(i[m]),v=De(i[m+1]),y=De(i[m+2])):(b=De(i[m]),v=De(i[m+1]),y=De(i[m+2]),M=De(i[m+3]));const x=[Wt(b,n,o),Wt(v,n,o),Wt(y,n,o)],[h,p,E]=u(x),_=g*4;d[_]=255*Mt(h,r),d[_+1]=255*Mt(p,r),d[_+2]=255*Mt(E,r),d[_+3]=255*(M<0?0:M>1?1:M)}return new ImageData(d,s,a)}function Wi(e,t,n){const r=Dn(t,n??St),o=new Uint8ClampedArray(e.data.length),a=e.data;for(let s=0;s<a.length;s+=4)o[s]=255*Mt(Cn(a[s]/255),r),o[s+1]=255*Mt(Cn(a[s+1]/255),r),o[s+2]=255*Mt(Cn(a[s+2]/255),r),o[s+3]=a[s+3];return new ImageData(o,e.width,e.height)}function Mo(e,t,n,r){const[o,a]=c.useState(null);if(c.useEffect(()=>{const l=e.current;if(!l||typeof ResizeObserver>"u")return;const i=new ResizeObserver(u=>{var g;const d=(g=u[u.length-1])==null?void 0:g.contentRect;d&&a(m=>m&&m.width===d.width&&m.height===d.height?m:{width:d.width,height:d.height})});return i.observe(l),()=>i.disconnect()},[e]),r!=="auto")return r;if(!o||!n)return;const s=ni({width:o.width*t,height:o.height*t},n.w,n.h);return ri(s,tn)}function Hi(e){var ht,Et;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",tonemap:l,gamma:i,showAxes:u=!1,processing:d=$i,zoom:g=1,pan:m={x:0,y:0},onViewportChange:b,onNaturalSize:v,label:y,isDraggable:M=!1,onDragStart:x,overlay:h,overlaySettings:p,pixelValueNotation:E="decimal",toolbar:_=!0}=e,[w,C,S]=Ne(s);c.useEffect(()=>{C(s)},[s,C]);const A=(()=>{const F=Xt(l);return F==="gamma"||F==="linear"?F:"srgb"})(),[T,P,k]=Ne(A);c.useEffect(()=>{P(A)},[l]);const[R,L,N]=Ne(i&&i>0?i:St);c.useEffect(()=>{i&&i>0&&L(i)},[i,L]);const X=c.useRef(null),W=c.useRef(null),G=c.useRef(null),[I,j]=c.useState(!1),Y=c.useRef(null),ie=c.useRef(null),te=c.useRef(null),ae=c.useRef(null),[V,Q]=c.useState(0),Z=c.useCallback(()=>Q(F=>F+1),[]),ue=c.useMemo(()=>({get current(){const F=te.current;return F instanceof HTMLCanvasElement?F:null}}),[]),we=c.useCallback(F=>{X.current=F,F&&(te.current=F)},[]),ne=c.useCallback(F=>{W.current=F,F&&(te.current=F)},[]),re=c.useCallback(F=>{G.current=F,F&&(te.current=F)},[]),ce=c.useCallback(F=>{F&&(te.current=F)},[]),[ge,me]=c.useState(!1),[Ae,Ee]=c.useState(!1),[Pe,_e]=c.useState(!1),[ve,ze]=c.useState(null),{flipSign:Ve}=d,{gammaFilterId:je,filterStr:xe,gamma:nt,offset:ft}=oo(d),Ce=!r&&o!=="none"&&n!=null&&t!=null,ke=o!=="none"&&n!=null,$e=w!=="none"&&!Ce&&!(r&&ke)&&t!=null;c.useEffect(()=>{if(!$e||!t){_e(!1);return}let F=!1;_e(!1);const fe=`${t}::${w}`,de=On(fe);if(de){const B=W.current;if(B){B.width=de.width,B.height=de.height;const z=B.getContext("2d");z&&z.putImageData(de,0,0),Z(),ze({w:de.width,h:de.height}),v==null||v(de.width,de.height),_e(!0)}return}const O=new Image;return O.onload=()=>{if(F)return;const B=document.createElement("canvas");B.width=O.naturalWidth,B.height=O.naturalHeight;const z=B.getContext("2d");if(!z)return;z.drawImage(O,0,0);const U=z.getImageData(0,0,B.width,B.height),ee=Ln(w),K=kn(U,w,ee);Bn(fe,K);const Te=W.current;if(!Te||F)return;Te.width=K.width,Te.height=K.height;const be=Te.getContext("2d");be&&be.putImageData(K,0,0),Z(),ze({w:K.width,h:K.height}),v==null||v(K.width,K.height),_e(!0)},O.src=t,()=>{F=!0}},[$e,t,w]);const Qe=t!=null&&!Ce&&!$e&&T!=="srgb";c.useEffect(()=>{if(!Qe||!t){j(!1);return}let F=!1;return j(!1),at(t).then(fe=>{if(F||!fe)return;const de=Wi(fe,T,R),O=G.current;if(!O)return;O.width=de.width,O.height=de.height;const B=O.getContext("2d");B&&B.putImageData(de,0,0),Z(),ze({w:de.width,h:de.height}),v==null||v(de.width,de.height),j(!0)}),()=>{F=!0}},[Qe,t,T,R]);const Je=c.useCallback((F,fe)=>{ze(de=>de&&de.w===F&&de.h===fe?de:{w:F,h:fe}),v==null||v(F,fe)},[]);c.useEffect(()=>{if(!t){ae.current=null,Z();return}let F=!1;return at(t).then(fe=>{F||(ae.current=fe,Z())}),()=>{F=!0}},[t,Z]);const dt=c.useCallback((F,fe,de)=>{const O=ae.current;if(!O||F<0||fe<0||F>=O.width||fe>=O.height)return null;const B=(fe*O.width+F)*4,z=O.data[B],U=O.data[B+1],ee=O.data[B+2];return vt(w!=="none"||z===U&&U===ee?[z]:[z,U,ee],"uint8",de)},[w]);c.useEffect(()=>{if(Ee(!1),!Ce){me(!1);return}let F=!1;const fe=ia(),de=fe==="gpu"||fe==="auto",O=`${n}::${t}::${o}::${w}`;if(fe!=="gpu"){const B=On(O);if(B){const z=X.current;if(z){(z.width!==B.width||z.height!==B.height)&&(z.width=B.width,z.height=B.height);const U=z.getContext("2d");U&&U.putImageData(B,0,0),Je(B.width,B.height),me(!0)}return}}return(async()=>{const[B,z]=await Promise.all([at(n),at(t)]);if(F||!B||!z)return;const ee=o.includes("signed")?"signed":"positive",K=w!=="none"?Tn(w):null,Te={diffMode:o,colormap:K,cmapMode:ee};if(de)try{const Ie=X.current;if(Ie){const He=sa(B,z,Te,Ie);if(He){if(F)return;Je(He.width,He.height),me(!0);return}}}catch(Ie){console.warn("[cairn] WebGL 2 diff error:",Ie)}if(fe==="gpu"){F||Ee(!0);return}let be=Qs(B,z,o);w!=="none"&&(be=kn(be,w,ee)),Bn(O,be);const Re=X.current;if(!Re||F)return;(Re.width!==be.width||Re.height!==be.height)&&(Re.width=be.width,Re.height=be.height);const pe=Re.getContext("2d");pe&&pe.putImageData(be,0,0),Je(be.width,be.height),me(!0)})(),()=>{F=!0}},[n,t,o,Ce,w,v]);const rt=Mo(ie,g,ve,a),Le=Ve?{filter:"invert(1)"}:{},pt=h&&(p!=null&&p.enabled)&&ve&&t&&((((ht=h.boxes)==null?void 0:ht.length)??0)>0||(((Et=h.masks)==null?void 0:Et.length)??0)>0)?f.jsx(Gn,{data:h,settings:p,naturalWidth:ve.w,naturalHeight:ve.h}):void 0,Pt=t?Ce&&Ae?f.jsx(ro,{title:"WebGL 2 unavailable",body:"GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."}):Ce?f.jsxs(f.Fragment,{children:[!ge&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:we,className:"w-full h-full object-contain block",style:{display:ge?"block":"none",imageRendering:rt,...Le}})]}):$e?f.jsxs(f.Fragment,{children:[!Pe&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:ne,className:"w-full h-full object-contain block",style:{display:Pe?"block":"none",imageRendering:rt,...Le}})]}):Qe?f.jsxs(f.Fragment,{children:[!I&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying transfer..."}),f.jsx("canvas",{ref:re,className:"w-full h-full object-contain block",style:{display:I?"block":"none",imageRendering:rt,...Le}})]}):f.jsx("img",{ref:ce,src:t,alt:y,className:"w-full h-full object-contain block",draggable:!1,style:{filter:xe,imageRendering:rt},onLoad:F=>{const fe=F.currentTarget;ze({w:fe.naturalWidth,h:fe.naturalHeight}),v==null||v(fe.naturalWidth,fe.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(ln,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:Y,wrapperRef:ie,zoom:g,pan:m,onViewportChange:b,naturalDims:ve,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${m.x}px, ${m.y}px) scale(${g})`,transformOrigin:"0 0"},viewportPadding:u&&ve?"16px 4px 4px 28px":"4px",header:f.jsx(so,{id:je,gamma:nt,offset:ft}),surface:Pt,showAxes:u,overlayNode:pt,overlay:{displayElRef:te,sample:dt,version:V,hasSource:!!t},notationSeed:E,exportCanvasRef:ue,leadingMenus:w==="none"?[Ot(w,F=>C(F)),Oi(T,F=>P(F))]:[Ot(w,F=>C(F))],extraSliders:w==="none"&&qt(T)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Ht,max:Yt,step:Kt,value:R,onChange:L,format:F=>F.toFixed(1)}]:void 0,onReset:()=>{S.reset(),k.reset(),N.reset()},extraModified:S.isModified||k.isModified||N.isModified,label:y,showLabelChip:!!y,isDraggable:M,onDragStart:x})}function Yi(e){const{tonemap:t="srgb",exposure:n=0,offset:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:l="auto",zoom:i=1,pan:u={x:0,y:0},onViewportChange:d,pixelValueNotation:g="decimal",toolbar:m=!0}=e,b=yo(e.hdr),v=b.hdr,[y,M,x]=Ne(Xt(t));c.useEffect(()=>{M(Xt(t))},[t,M]);const[h,p,E]=Ne(o&&o>0?o:St);c.useEffect(()=>{o&&o>0&&p(o)},[o,p]);const _=c.useRef(null),w=c.useRef(null),C=c.useRef(null),[S,A]=c.useState(null),[T,P]=c.useState(0),[k,R]=c.useState(0),[L,N]=c.useState(0);c.useEffect(()=>{const G=_.current;if(!G)return;let I;try{I=Xi(v,y,n+k,Dn(y,h),r+L)}catch(Y){console.error("[cairn] HDR tone-map error:",Y);return}(G.width!==I.width||G.height!==I.height)&&(G.width=I.width,G.height=I.height);const j=G.getContext("2d");j&&(j.putImageData(I,0,0),P(Y=>Y+1),A(Y=>Y&&Y.w===I.width&&Y.h===I.height?Y:{w:I.width,h:I.height}))},[v,y,n,r,h,k,L]);const X=c.useCallback((G,I,j)=>{const Y=S;if(!Y||G<0||I<0||G>=Y.w||I>=Y.h)return null;const ie=v.shape.length===2?1:v.shape[2]??1,te=(I*Y.w+G)*ie,ae=v.data,V=v.precision==="f16-bits"?Z=>Qt(ae[Z]??0):Z=>ae[Z]??0,Q=ie===1?[V(te)]:[V(te),V(te+1),V(te+2)];return vt(Q,"unit",j)},[v,S]),W=Mo(C,i,S,l);return f.jsx(ln,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:m,paneRef:w,wrapperRef:C,zoom:i,pan:u,onViewportChange:d,naturalDims:S,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${u.x}px, ${u.y}px) scale(${i})`,transformOrigin:"0 0"},viewportPadding:a&&S?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:_,className:"w-full h-full object-contain block",style:{imageRendering:W}}),showAxes:a,overlay:{displayElRef:_,sample:X,version:T,hasSource:!0},notationSeed:g,exportCanvasRef:_,leadingMenus:[cn(y,G=>M(G))],displayAdjust:{exposureEV:k,offset:L,onExposureChange:R,onOffsetChange:N},extraSliders:qt(y)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Ht,max:Yt,step:Kt,value:h,onChange:p,format:G=>G.toFixed(1)}]:void 0,depthSliders:b.sliders,regionSelect:b.hasDeep?{rect:b.region,queryLive:b.queryRegionWindow,commit:b.commitRegion,remove:b.removeRegion}:void 0,onReset:()=>{b.reset(),x.reset(),E.reset()},extraModified:b.isModified||x.isModified||E.isModified,label:s,showLabelChip:!!s})}function So(e){const t=Eo(e);return wo(t)?f.jsx(Yi,{...t}):f.jsx(Hi,{...t})}const Ao={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Ki="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function qi(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Zi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function ji(e,t){if(e==="no-hdr-display")switch(Zi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=qi(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Qi(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function To(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Po=new Set;function Ro(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Po.has(e)}function Ji(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Po.add(e)}const Co=new Set;let un=null,Tt=null;function Do(){Tt&&Tt.parentNode&&Tt.parentNode.removeChild(Tt),Tt=null,un=null}function ec(e){const t=To(e,window.location.pathname),n=ji(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Qi(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=Ki,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{Ji(t),Do()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),Tt=r,un=e}function ko(e){if(typeof document>"u"||typeof window>"u"||Co.has(e))return;Co.add(e);const t=To(e,window.location.pathname);if(Ro(t))return;const n=()=>{if(!Ro(t)){if(un!==null)if(Ao[e]<Ao[un])Do();else return;ec(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const tc={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function nc(e){const{h:t,w:n,c:r}=_o(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let i=0;i<n*t;i++){const u=i*r,d=i*4;if(r===1){const g=s[u];l[d]=g,l[d+1]=g,l[d+2]=g,l[d+3]=jt}else l[d]=s[u],l[d+1]=s[u+1],l[d+2]=s[u+2],l[d+3]=r>=4?s[u+3]:jt}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let i,u,d,g=1;r===1?i=u=d=De(o[l]):r===3?(i=De(o[l]),u=De(o[l+1]),d=De(o[l+2])):(i=De(o[l]),u=De(o[l+1]),d=De(o[l+2]),g=De(o[l+3]));const m=s*4;a[m]=i,a[m+1]=u,a[m+2]=d,a[m+3]=g}return{data:a,width:n,height:t,format:"rgba32float"}}function Lo(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,l=(t.width-a)/2,i=(t.height-s)/2,u=Math.max(e.zoom,1e-6),d=t.width/(u*a),g=t.height/(u*s),m=-l/a-e.pan.x/(u*a),b=-i/s-e.pan.y/(u*s);return{x:m,y:b,w:d,h:g}}function Oo(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function rc(e){var F,fe,de;const t=Eo(e),n=wo(t),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(null),l=c.useRef(null),i=n&&!!((F=t.hdr)!=null&&F.deep),u=c.useCallback((O,B)=>{var z,U;(z=s.current)==null||z.setDeepWindow(O,B),(U=l.current)==null||U.call(l)},[]),d=yo(n?t.hdr:tc,i?u:void 0),g=c.useRef(!1),[m,b]=c.useState(!1),[v,y]=c.useState(!1),[M,x]=c.useState(!1),[h,p]=c.useState(null),[E,_]=c.useState(0),[w,C]=c.useState(0),[S,A]=c.useState({x:0,y:0,w:1,h:1}),T=c.useRef(null),P=c.useRef(null),[k,R]=c.useState(0),L=t.zoom??1,N=t.pan??{x:0,y:0},X=t.onViewportChange,W=t.toolbar??!0,G=n?"none":t.colormap??"none",[I,j,Y]=Ne(G);c.useEffect(()=>{j(G)},[G,j]);const ie=n?"none":I,te=t.tonemap,[ae,V]=c.useState(null);c.useEffect(()=>{V(null)},[te]);const Q=_r(te),Z=ae??Q,ue=ae!==null&&ae!==Q,we=c.useCallback(()=>V(null),[]),ne=t.peak,re=()=>ne!=null&&ne>0?ne:Er(te)??$t,[ce,ge,me]=Ne(re());c.useEffect(()=>{ge(re())},[ne,te]);const Ae=t.gamma,[Ee,Pe,_e]=Ne(Ae&&Ae>0?Ae:St);c.useEffect(()=>{Ae&&Ae>0&&Pe(Ae)},[Ae,Pe]);const[ve,ze]=c.useState(0),[Ve,je]=c.useState(0),xe=Un();c.useEffect(()=>{const O=r.current;if(!O)return;let B=!1;return zt().then(z=>{var be;if(B)return;const U=((be=z.probeExtendedToneMapping)==null?void 0:be.call(z))??!1,ee=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,Te=U&&ee&&(n||G==="none");g.current=Te,b(Te),n&&!Te&&ko(U?"no-hdr-display":"no-hdr-browser"),ti(O,{hdr:Te}).then(Re=>{if(B){no(Re);return}s.current=Re,x(!0)}).catch(Re=>{B||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Re),y(!0))})}).catch(z=>{B||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",z),y(!0))}),()=>{B=!0,s.current&&(no(s.current),s.current=null)}},[]),c.useEffect(()=>{const O=o.current;if(!O)return;const B=new ResizeObserver(()=>C(z=>z+1));return B.observe(O),()=>B.disconnect()},[]),c.useEffect(()=>{const O=o.current;if(!O)return;const B=new IntersectionObserver(z=>{const U=z[0];if(!U)return;const ee=s.current;ee&&(ee.setVisible(U.isIntersecting),U.isIntersecting?ee.isParked&&(ee.restore(),C(K=>K+1)):ee.park())},{threshold:0});return B.observe(O),()=>B.disconnect()},[]),c.useEffect(()=>{var z;if(!n||!M||i)return;const O=d.hdr;T.current=O;const B=nc(O);(z=s.current)==null||z.setSource(B),p(U=>U&&U.w===B.width&&U.h===B.height?U:{w:B.width,h:B.height}),R(U=>U+1),_(U=>U+1)},[n,M,i,n?d.hdr:null]),c.useEffect(()=>{if(!n||!M||!i)return;const O=t.hdr,B=O.deep;T.current=O;let z=!1;return B.getGpuCsr().then(U=>{var ee;z||((ee=s.current)==null||ee.setDeepSource(U,B.zMin,B.zMax),p(K=>K&&K.w===U.width&&K.h===U.height?K:{w:U.width,h:U.height}),R(K=>K+1),_(K=>K+1))}).catch(U=>{z||console.warn("[cairn] deep GPU CSR upload failed:",U)}),()=>{z=!0}},[n,M,i,n?t.hdr.deep:null]),c.useEffect(()=>{if(n||!M)return;const O=t,B=O.imageUrl,z=I;if(!B){P.current=null,p(null),R(ee=>ee+1);return}let U=!1;return at(B).then(ee=>{var be,Re;if(U||!ee)return;let K=ee;if(z!=="none"){const pe=`gpu::${B}::${z}::ev${ve}::off${Ve}`,Ie=On(pe);if(Ie)K=Ie;else{const He=Ln(z);K=kn(ee,z,He,ve,Ve),Bn(pe,K)}}P.current=ee;const Te={data:K.data,width:K.width,height:K.height,format:"rgba8unorm"};(be=s.current)==null||be.setSource(Te),p(pe=>pe&&pe.w===K.width&&pe.h===K.height?pe:{w:K.width,h:K.height}),(Re=O.onNaturalSize)==null||Re.call(O,K.width,K.height),R(pe=>pe+1),_(pe=>pe+1)}),()=>{U=!0}},[n,M,n?null:t.imageUrl,n?null:I,n?0:ve,n?0:Ve]);const nt=t.exposure??0,ft=t.offset??0,Ce=!n&&ie==="none",ke=c.useCallback(()=>{const O=s.current;if(!O||!M||!h)return;const B=o.current,z=a.current,U=z?z.getBoundingClientRect():B?B.getBoundingClientRect():{width:h.w,height:h.h},ee=Lo({zoom:L,pan:N},U,h.w,h.h);A(pe=>pe.x===ee.x&&pe.y===ee.y&&pe.w===ee.w&&pe.h===ee.h?pe:ee),U.width>0&&U.height>0&&O.resize(Math.round(U.width*xe),Math.round(U.height*xe));const K=Oo(ee,U,h.w,h.h)>=tn?"nearest":"linear",Te=ee,be=Mr(Z,g.current?ce:1,g.current,Ee),Re=n||Ce?{exposureEV:nt+ve,offset:ft+Ve,operator:be.operator,gamma:be.gamma,isScalar:!1,hdrOut:be.hdrOut,peak:be.peak,srgbDecode:!n,uv:Te,filter:K}:{exposureEV:0,offset:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,srgbDecode:!1,uv:Te,filter:K};try{O.render(Re)||y(!0)}catch(pe){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",pe),y(!0)}},[M,h,L,N.x,N.y,nt,ft,ve,Ve,Z,ce,Ee,Ce,n,ie,xe]);l.current=ke,c.useEffect(()=>{ke()},[ke,E,w]);const $e=c.useCallback((O,B,z)=>{if(n){const pe=T.current,Ie=h;if(!pe||!Ie||O<0||B<0||O>=Ie.w||B>=Ie.h)return null;const He=pe.shape.length===2?1:pe.shape[2]??1,mt=(B*Ie.w+O)*He,It=pe.data,et=pe.precision==="f16-bits"?Ft=>Qt(It[Ft]??0):Ft=>It[Ft]??0,_t=He===1?[et(mt)]:[et(mt),et(mt+1),et(mt+2)];return vt(_t,"unit",z)}const U=P.current;if(!U||O<0||B<0||O>=U.width||B>=U.height)return null;const ee=(B*U.width+O)*4,K=U.data[ee],Te=U.data[ee+1],be=U.data[ee+2];return vt(ie!=="none"||K===Te&&Te===be?[K]:[K,Te,be],"uint8",z)},[n,h,ie]),Qe=t.showAxes??!1,Je=n?t.label??"":t.label,dt=t.interpolation??"auto",rt=dt==="auto"?void 0:dt,Le=n?void 0:t.overlay,pt=n?void 0:t.overlaySettings,Pt=n?!1:t.isDraggable??!1,ht=n?void 0:t.onDragStart;if(v)return f.jsx(So,{...e});const Et=Le&&(pt!=null&&pt.enabled)&&h&&((((fe=Le.boxes)==null?void 0:fe.length)??0)>0||(((de=Le.masks)==null?void 0:de.length)??0)>0)?f.jsx(Gn,{data:Le,settings:pt,naturalWidth:h.w,naturalHeight:h.h}):void 0;return f.jsx(ln,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":M},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:W,paneRef:o,wrapperRef:a,zoom:L,pan:N,onViewportChange:X,naturalDims:h,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Qe&&h?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:r,className:"w-full h-full block",style:{imageRendering:rt},"data-gpu-image-canvas":!0}),showAxes:Qe,overlayNode:Et,overlay:{displayElRef:r,sample:$e,version:k,hasSource:!0,sourceWindow:S},notationSeed:t.pixelValueNotation??"decimal",exportCanvasRef:r,requestRender:ke,leadingMenus:n?[cn(Z,O=>V(O))]:Ce?[Ot(ie,O=>j(O)),cn(Z,O=>V(O))]:[Ot(ie,O=>j(O))],displayAdjust:{exposureEV:ve,offset:Ve,onExposureChange:ze,onOffsetChange:je},extraSliders:[...(n||Ce)&&m?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:mr,max:Ct,step:gr,value:ce,onChange:ge,format:O=>Number.isFinite(O)?`${O.toFixed(1)}×`:"∞"}]:[],...(n||Ce)&&qt(Z)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Ht,max:Yt,step:Kt,value:Ee,onChange:Pe,format:O=>O.toFixed(1)}]:[]],depthSliders:d.sliders,regionSelect:i?{rect:d.region,queryLive:d.queryRegionWindow,commit:d.commitRegion,remove:d.removeRegion}:void 0,onReset:()=>{Y.reset(),we(),me.reset(),_e.reset(),d.reset()},extraModified:Y.isModified||ue||me.isModified||_e.isModified||d.isModified,label:Je,showLabelChip:!!Je,isDraggable:Pt,onDragStart:ht})}const fn=new Map;function qe(e){if(fn.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);fn.set(e.id,e)}function lt(e){return fn.get(e)}function oc(){return Array.from(fn.values())}function Bo(e,t){return{...e.params??{},...t??{}}}const sc={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ac={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},ic={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},cc={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},lc={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},uc={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},No=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];dc(No);const Kn=[1.052156925,1,.91835767],fc=.7;function dc(e){const[t,n,r]=e[0],[o,a,s]=e[1],[l,i,u]=e[2],d=a*u-s*i,g=-(o*u-s*l),m=o*i-a*l,v=1/(t*d+n*g+r*m);return[[d*v,-(n*u-r*i)*v,(n*s-r*a)*v],[g*v,(t*u-r*l)*v,-(t*s-r*o)*v],[m*v,-(t*i-n*l)*v,(t*a-n*o)*v]]}function pc(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const qn=6/29;function Zn(e){return e>qn**3?Math.cbrt(e):e/(3*qn*qn)+4/29}function Io(e,t,n){const[r,o,a]=pc(No,e,t,n),s=Zn(r*Kn[0]),l=Zn(o*Kn[1]),i=Zn(a*Kn[2]),u=116*l-16,d=500*(s-l),g=200*(l-i);return[u,.01*u*d,.01*u*g]}function hc(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function mc(){const e=Io(0,1,0),t=Io(0,0,1);return Math.pow(hc(e,t),fc)}const Fo=mc(),gc=.082;function Uo(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),l=1/e,i=Math.PI**2,u=[0,0,0];for(let d=-s;d<=s;d++)for(let g=-s;g<=s;g++){const m=(g*l)**2+(d*l)**2;for(let b=0;b<3;b++)u[b]+=t[b]*Math.sqrt(Math.PI/n[b])*Math.exp(-i*m/n[b])+r[b]*Math.sqrt(Math.PI/o[b])*Math.exp(-i*m/o[b])}return{r:s,deltaX:l,sums:u}}function Go(e){const t=.5*gc*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const i=Math.exp(-(l*l+s*s)/(2*t*t)),u=-l*i,d=(l*l/(t*t)-1)*i;u>0&&(r+=u),d>0?o+=d:a-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const xc=`
${Ge}
${rn}
${wt}
${kt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,bc=`
${Ge}
${rn}
${wt}
${kt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,dn=`
${Ge}
${rn}
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
`,zo=`
${Ge}
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
`;function Ze(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function pn(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},a=r!=null&&r.fill?1:0;return[Ze(e,[o.x,o.y,a,0]),Ze(e+1,[n.width,n.height,0,0])]}function hn(e){return[Ze(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ze(2,[e.sums[2],0,0,0])]}function Vo(e){return[Ze(4,[Fo,e.sd,e.r,e.edgeNorm]),Ze(5,[e.pointPos,e.pointNeg,0,0])]}function $o(e,t,n,r,o,a=""){const s=Uo(e),l=Go(e),i=`ycxczA${a}`,u=`ycxczB${a}`,d=`labA${a}`,g=`labB${a}`,m=`flip${a}`;return{passes:[{name:i,shader:t,inputs:[n],output:i,uniforms:()=>pn(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>pn(1,"b",o)},{name:d,shader:dn,inputs:[i],output:d,uniforms:()=>hn(s)},{name:g,shader:dn,inputs:[u],output:g,uniforms:()=>hn(s)},{name:m,shader:zo,inputs:[d,g,i,u],output:m,uniforms:()=>Vo(l)}],flipRef:m}}const vc={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=$o(t,xc,"srcA","srcB",e);return{passes:n,final:r}}},yc={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=$o(t,bc,"srcA","srcB",e);return{passes:n,final:r}}},Xo=`
${Ge}
${rn}
${wt}
${kt}
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
`,wc=`
${Ge}
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
`,Ec={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=Uo(t),l=Go(t),i=[];let u=null;for(let d=0;d<o;d++){const g=n+d*a,m=`_e${d}`,b=`ycxczA${m}`,v=`ycxczB${m}`,y=`labA${m}`,M=`labB${m}`,x=`acc${m}`;i.push({name:b,shader:Xo,inputs:["srcA"],output:b,uniforms:()=>[Ze(1,[g,0,0,0]),...pn(2,"a",e)]},{name:v,shader:Xo,inputs:["srcB"],output:v,uniforms:()=>[Ze(1,[g,0,0,0]),...pn(2,"b",e)]},{name:y,shader:dn,inputs:[b],output:y,uniforms:()=>hn(s)},{name:M,shader:dn,inputs:[v],output:M,uniforms:()=>hn(s)}),u===null?i.push({name:x,shader:zo,inputs:[y,M,b,v],output:x,uniforms:()=>Vo(l)}):i.push({name:x,shader:wc,inputs:[y,M,b,v,u],output:x,uniforms:()=>[Ze(5,[Fo,l.sd,l.r,l.edgeNorm]),Ze(6,[l.pointPos,l.pointNeg,0,0])]}),u=x}return{passes:i,final:u}}},Wo=.01,Ho=.03,mn=1,jn=1.5,ut=5,Qn=[.2126,.7152,.0722];function Jn(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function Yo(e,t,n){const r=Qn[0]*Jn(e)+Qn[1]*Jn(t)+Qn[2]*Jn(n);return Math.min(1,Math.max(0,r))}function _c(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let a=-t,s=0;a<=t;a++,s++){const l=Math.exp(-.5*a*a/(e*e));r[s]=l,o+=l}for(let a=0;a<n;a++)r[a]=r[a]/o;return r}function Ko(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const qo=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),er=64;async function Bt(e,t,n,r,o,a){const s=new Float64Array(t*n);for(let i=0;i<n;i++){for(let u=0;u<t;u++){let d=0;for(let g=-o,m=0;g<=o;g++,m++)d+=r[m]*e[i*t+Ko(u+g,t)];s[i*t+u]=d}(i+1)%er===0&&await a()}const l=new Float64Array(t*n);for(let i=0;i<n;i++){for(let u=0;u<t;u++){let d=0;for(let g=-o,m=0;g<=o;g++,m++)d+=r[m]*s[Ko(i+g,n)*t+u];l[i*t+u]=d}(i+1)%er===0&&await a()}return l}async function Mc(e,t,n,r,o=qo){const a=n*r;if(a<=0)return NaN;const s=_c(jn,ut),l=new Float64Array(a),i=new Float64Array(a),u=new Float64Array(a);for(let h=0;h<a;h++)l[h]=e[h]*e[h],i[h]=t[h]*t[h],u[h]=e[h]*t[h];const d=await Bt(e,n,r,s,ut,o),g=await Bt(t,n,r,s,ut,o),m=await Bt(l,n,r,s,ut,o),b=await Bt(i,n,r,s,ut,o),v=await Bt(u,n,r,s,ut,o),y=(Wo*mn)**2,M=(Ho*mn)**2;let x=0;for(let h=0;h<a;h++){const p=m[h]-d[h]*d[h],E=b[h]-g[h]*g[h],_=v[h]-d[h]*g[h],w=2*d[h]*g[h]+y,C=2*_+M,S=d[h]*d[h]+g[h]*g[h]+y,A=p+E+M;x+=w*C/(S*A)}return x/a}const Zo=`
${Ge}

fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

${wt}
${kt}
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
`,Sc=`
${Zo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,Ac=`
${Zo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,jo=`
${Ge}
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
`,Tc=`
${Ge}
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
`;function Nt(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Qo(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[Nt(2,[n.x,n.y,r.x,r.y]),Nt(3,[e.width,e.height,o,0])]}function Jo(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:jo,inputs:[e],output:n,uniforms:()=>[Nt(1,[1,0,ut,jn])]},{name:r,shader:jo,inputs:[n],output:r,uniforms:()=>[Nt(1,[0,1,ut,jn])]}],out:r}}const Pc={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(Wo*mn)**2,n=(Ho*mn)**2,r=Jo("momA","statsA"),o=Jo("momB","statsB");return{passes:[{name:"momA",shader:Sc,inputs:["srcA","srcB"],output:"momA",uniforms:Qo},{name:"momB",shader:Ac,inputs:["srcA","srcB"],output:"momB",uniforms:Qo},...r.passes,...o.passes,{name:"ssim",shader:Tc,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[Nt(2,[t,n,0,0])]}],final:"ssim"}}};let es=!1;function Rc(){es||(es=!0,qe(ac),qe(sc),qe(ic),qe(lc),qe(cc),qe(uc),qe(vc),qe(Ec),qe(yc),qe(Pc))}Rc();function ts(){const e=[];for(const n of oc())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=lt("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Cc(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Dc=128,kc=512*1024*1024;class Lc{constructor(t=Dc,n=kc){se(this,"map",new Map);se(this,"totalBytes",0);se(this,"maxEntries");se(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const ns=new WeakMap;function tr(e){let t=ns.get(e);return t||(t=new Lc,ns.set(e,t)),t}function Oc(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let a=0;a<r;a++)o+=e[a*4]??0;return 1-o/r}function rs(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const os=new WeakMap;function Bc(e,t,n){let r=os.get(e);r||(r=new Map,os.set(e,r));const o=r.get(t);if(o)return o;const a=n().catch(s=>{throw r.get(t)===a&&r.delete(t),s});return r.set(t,a),a}const ss=new WeakMap;function nr(e,t,n,r){let o=ss.get(e);o||(o=new Map,ss.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Nc(e){return`
${Ge}
${wt}
${kt}
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
`}const gn="rgba16float";let as=0;function Ic(){return as}function Fc(e,t,n,r,o,a){var M,x;const s=lt(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=a??Lt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=l.result.w,u=l.result.h,d=l.fit==="fill"?1:0,g=Bo(s,o);if(as++,s.kind==="pointwise"){const h=e.createTexture(i,u,gn),p=nr(e,`pw:${s.id}`,Nc(s.source),gn),E=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),_=new Float32Array([i,u,d,0]);let w;try{w=e.createBindGroup(p,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(h,p,w)}finally{(M=w==null?void 0:w.destroy)==null||M.call(w)}return h}const m={width:i,height:u,params:g,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},b=s.buildPasses(m),v=new Map([["srcA",t],["srcB",n]]),y=[];try{for(const p of b.passes){const E=e.createTexture(i,u,gn);y.push(E),v.set(p.output,E);const _=nr(e,`mp:${s.id}:${p.name}`,p.shader,gn),w=p.inputs.map((S,A)=>{const T=v.get(S);if(!T)throw new Error(`computeDiff: pass "${p.name}" input "${S}" not produced yet`);return{binding:A,resource:T}});p.uniforms&&w.push(...p.uniforms(m));let C;try{C=e.createBindGroup(_,w),e.renderFullscreen(E,_,C)}finally{(x=C==null?void 0:C.destroy)==null||x.call(C)}}const h=v.get(b.final);if(!h)throw new Error(`computeDiff: final ref "${b.final}" not produced`);for(const p of y)p!==h&&p.destroy();return h}catch(h){for(const p of y)p.destroy();throw h}}function Uc(e,t){const n=Bo(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Gc(e,t,n,r,o){const a=lt(n),s=a?Uc(a,r):"",l=o?Vn(o):"";return`${e}|${t}|${n}|${s}|${l}`}function is(e,t,n,r,o,a,s,l){const i=lt(r);if(!i)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=tr(e),d=l??Lt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),g=Gc(a,s,r,o,d),m=u.get(g);if(m)return m;const b=Fc(e,t,n,r,o,d),v=d.result.w,y=d.result.h,M={texture:b,width:v,height:y,displayRange:i.displayRange,bytes:v*y*8};return u.set(g,M),M}function zc(e,t,n){return`${e}|${t}|${n?Vn(n):""}`}function Vc(e,t,n,r,o,a){return Bc(e,zc(r,o,a),()=>$c(e,t,n,r,o,a))}async function $c(e,t,n,r,o,a){try{const s=is(e,t,n,"ssim",void 0,r,o,a);return s.ssimMean!==void 0?s.ssimMean:(s.ssimMeanPending||(s.ssimMeanPending=cs(e,s).then(l=>{const i=Oc(l,s.width,s.height);return s.ssimMean=i,i})),await s.ssimMeanPending)}catch{return Xc(e,t,n,a)}}async function Xc(e,t,n,r){const o=r??Lt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,l=a*s;if(l<=0)return NaN;const i=await e.readback(t),u=await e.readback(n),d=i instanceof Uint8Array?255:1,g=u instanceof Uint8Array?255:1,m=o.fit==="fill",b=sn(i,t.width,t.height,d,o.offsetA,m,a,s),v=sn(u,n.width,n.height,g,o.offsetB,m,a,s),y=new Float64Array(l),M=new Float64Array(l),x=[0,0,0],h=[0,0,0];for(let p=0;p<s;p++){for(let E=0;E<a;E++){b(E,p,x),v(E,p,h);const _=p*a+E;y[_]=Yo(x[0],x[1],x[2]),M[_]=Yo(h[0],h[1],h[2])}(p+1)%er===0&&await qo()}return Mc(y,M,a,s)}async function Wc(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=jr(e,n,r,o).then(a=>(t.scalars=a,a))),t.scalarsPending)}async function cs(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,tr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}function Hc(e){return tr(e).size}const Yc=`
${Ge}
${wt}
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
    // Mirror the source filter: when the diff RESULT is sampled bilinearly
    // (moderate zoom), interpolate the LUT too — otherwise the smooth diff
    // magnitude snaps to one of 256 discrete colormap bins, banding the
    // false-color image into blocky per-texel cells (the colormap-interp bug).
    // At the pixelated zoom the nearest fetch keeps crisp per-texel color.
    if (filterLinear) { outColor = sampleLUTLinear(lut, idx); }
    else { outColor = sampleLUT(lut, idx); }
  } else {
    outColor = disp;
  }
  return vec4<f32>(outColor, 1.0);
}
`,Kc={unit:0,signed:1,relative:2},qc={linear:0,signed:1,positive:2};function Zc(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function jc(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Qc(e,t,n,r,o){var b,v,y;const a=jc(t),s=nr(e,"diff-display",Yc,a),l=Zc(e,o.colormap),i=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([Kc[r],qc[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),g=new Float32Array([((b=o.sourceDims)==null?void 0:b.w)??0,((v=o.sourceDims)==null?void 0:v.h)??0,0,0]);let m;try{m=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:i}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:g}}]),e.renderFullscreen(t,s,m)}finally{(y=m==null?void 0:m.destroy)==null||y.call(m),l.destroy()}}const ls=.6*.6*2.51,Jc=.6*.03,el=0,us=.6*.6*2.43,tl=.6*.59,nl=.14;function fs(e){const t=(Jc-tl*e)/(ls-us*e),n=(el-nl*e)/(ls-us*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const rl=.85,ol=.85,ds=11920928955078125e-23,rr=[.2126,.7152,.0722];function sl(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function al(e,t,n,r=3,o={}){const a=t*n,s=fs(rl),l=fs(ol),i=new Float64Array(a);let u=0;for(let h=0;h<a;h++){const[p,E,_]=sl(e,h,r),w=p*rr[0]+E*rr[1]+_*rr[2];i[h]=w,w>u&&(u=w)}const d=Float64Array.from(i).sort(),g=a>>1,m=a%2===1?d[g]:d[g-1],b=Math.max(m,ds),v=Math.max(u,ds),y=o.startExposure??Math.log2(s/v),M=o.stopExposure??Math.log2(l/b),x=Math.max(2,Math.ceil(M-y));return{startExposure:y,stopExposure:M,numExposures:x}}const il="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",cl="REF";function ps(){return f.jsx("span",{className:il,children:cl})}function hs({splitPosition:e,onChange:t,onReset:n}){return f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${e*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:r=>{r.stopPropagation(),n==null||n()},onPointerDown:r=>{r.stopPropagation(),r.preventDefault();const o=r.currentTarget;try{o.setPointerCapture(r.pointerId)}catch{}const s=o.parentElement.getBoundingClientRect(),l=u=>{t==null||t(Math.max(0,Math.min(1,(u.clientX-s.left)/s.width)))},i=()=>{window.removeEventListener("pointermove",l),window.removeEventListener("pointerup",i)};window.addEventListener("pointermove",l),window.addEventListener("pointerup",i)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})}const ll={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ul({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:l,onViewportChange:i,processing:u=ll,interpolation:d="auto",label:g="",isDraggable:m=!1,onDragStart:b,overlay:v,overlaySettings:y,pixelValueNotation:M="decimal"}){var ue,we;const x=c.useRef(null),[h,p]=c.useState(null),[E,_]=c.useState(null),[w,C]=c.useState(M),[S,A]=c.useState(!1),T=c.useRef(null),P=c.useRef(null),k=c.useRef(null),R=c.useRef(null),[L,N]=c.useState(0);c.useEffect(()=>{if(!e){k.current=null,N(re=>re+1);return}let ne=!1;return at(e).then(re=>{ne||(k.current=re,N(ce=>ce+1))}),()=>{ne=!0}},[e]),c.useEffect(()=>{if(!t){R.current=null,N(re=>re+1);return}let ne=!1;return at(t).then(re=>{ne||(R.current=re,N(ce=>ce+1))}),()=>{ne=!0}},[t]);const X=ne=>(re,ce,ge)=>{const me=ne.current;if(!me||re<0||ce<0||re>=me.width||ce>=me.height)return null;const Ae=(ce*me.width+re)*4,Ee=me.data[Ae],Pe=me.data[Ae+1],_e=me.data[Ae+2];return Ee===Pe&&Pe===_e?{lines:[At(Ee,"uint8",ge)]}:{lines:[At(Ee,"uint8",ge),At(Pe,"uint8",ge),At(_e,"uint8",ge)],colors:[nn[0],nn[1],nn[2]]}},W=c.useMemo(()=>X(k),[]),G=c.useMemo(()=>X(R),[]),I=!!v&&!!(y!=null&&y.enabled)&&!!h&&!!e&&((((ue=v.boxes)==null?void 0:ue.length)??0)>0||(((we=v.masks)==null?void 0:we.length)??0)>0),{gammaFilterId:j,filterStr:Y,gamma:ie,offset:te}=oo(u),ae=`translate(${l.x}px, ${l.y}px) scale(${s})`,V=d==="auto"?void 0:d,{containerProps:Q,modifierActive:Z}=Ir({containerRef:x,zoom:s,pan:l,onViewportChange:i});return f.jsxs("div",{className:"relative isolate flex flex-col h-full",children:[f.jsx(so,{id:j,gamma:ie,offset:te}),f.jsxs("div",{ref:x,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...Q.style},onPointerDown:Q.onPointerDown,onPointerMove:Q.onPointerMove,onPointerUp:Q.onPointerUp,onPointerCancel:Q.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:ae,transformOrigin:"0 0"},children:[f.jsx("img",{ref:T,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Y,imageRendering:V,...n==="blend"?{opacity:o}:{}},onLoad:ne=>{const re=ne.currentTarget;p({w:re.naturalWidth,h:re.naturalHeight})}}),I&&f.jsx(Gn,{data:v,settings:y,naturalWidth:h.w,naturalHeight:h.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:ae,transformOrigin:"0 0"},children:f.jsx("img",{ref:P,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Y,imageRendering:V,...n==="blend"?{opacity:1-o}:{}},onLoad:ne=>{const re=ne.currentTarget;_({w:re.naturalWidth,h:re.naturalHeight})}})})}),n==="split"&&f.jsx(hs,{splitPosition:r,onChange:a,onReset:()=>a==null?void 0:a(.5)})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(yt,{imageElRef:P,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:l,sample:G,notation:w,version:L})}),e&&h&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(yt,{imageElRef:T,naturalWidth:h.w,naturalHeight:h.h,zoom:s,pan:l,sample:W,notation:w,version:L,onActiveChange:A})})]}):e&&h&&f.jsx(yt,{imageElRef:T,naturalWidth:h.w,naturalHeight:h.h,zoom:s,pan:l,sample:W,notation:w,version:L,onActiveChange:A}),S&&f.jsx($r,{notation:w,onChange:C})]}),n==="split"&&f.jsx(ps,{}),f.jsx($n,{label:g,corner:"bottom-right",isDraggable:m&&!Z,grip:!0,onDragStart:b})]})}function fl(){return f.jsx(ro,{title:"GPU compare unavailable",body:"Float image sources need the GPU compare (WebGPU), which isn't available in this browser."})}function dl({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?s==null||s():u==="slide"?r():u==="blend"?o():a(u)}}}}function pl(e){const t=Tn(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function hl(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const i=e.data,u=new Uint16Array(o*4);for(let d=0;d<o;d++){const g=d*r,m=d*4;if(r===1){const b=i[g];u[m]=b,u[m+1]=b,u[m+2]=b,u[m+3]=jt}else u[m]=i[g],u[m+1]=i[g+1],u[m+2]=i[g+2],u[m+3]=r>=4?i[g+3]:jt}return{data:u,format:"rgba16float"}}const a=e.data,s=new Float32Array(o*4),l=i=>Number.isFinite(i)?i:0;for(let i=0;i<o;i++){const u=i*r;let d,g,m,b=1;r===1?d=g=m=l(a[u]):r===3?(d=l(a[u]),g=l(a[u+1]),m=l(a[u+2])):(d=l(a[u]),g=l(a[u+1]),m=l(a[u+2]),b=l(a[u+3]));const v=i*4;s[v]=d,s[v+1]=g,s[v+2]=m,s[v+3]=b}return{data:s,format:"rgba32float"}}function ml({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,diffSubmode:i,colormap:u="none",align:d="top-left",fit:g="crop",diffKernel:m,onDiffKernelChange:b,onCompareModeChange:v,onRequestSide:y,zoom:M,pan:x,onViewportChange:h,interpolation:p="auto",label:E="",pixelValueNotation:_="decimal",tonemap:w,peak:C,gamma:S,toolbar:A=!0}){var ys;const T=c.useRef(null),P=c.useRef(null),k=c.useRef(null),R=c.useRef(null),L=c.useRef(null),[N,X]=c.useState(!1),[W,G]=c.useState(!1),I=c.useRef(!1),[j,Y]=c.useState(!1),[ie,te]=c.useState(null),[ae,V]=c.useState(null),[Q,Z]=c.useState({a:!1,b:!1}),[ue,we]=c.useState(0),[ne,re]=c.useState(0),[ce,ge]=c.useState(null),[me,Ae]=c.useState(null),[Ee,Pe]=c.useState({x:0,y:0,w:1,h:1}),_e=m??i??"absolute",[ve,ze,Ve]=Ne(_e);c.useEffect(()=>{ze(m??i??"absolute")},[m,i,ze]);const je=c.useCallback(D=>{ze(D),b==null||b(D)},[b,ze]);c.useEffect(()=>{const D=T.current;if(D)return D.__cairnDiffKernel={current:ve,set:je},()=>{D&&delete D.__cairnDiffKernel}},[ve,je]);const[xe,nt,ft]=Ne(o);c.useEffect(()=>{nt(o)},[o,nt]);const Ce=c.useCallback(D=>{nt(D),v==null||v(D)},[v,nt]),[ke,$e,Qe]=Ne(u);c.useEffect(()=>{$e(u)},[u,$e]);const[Je,dt]=c.useState(null);c.useEffect(()=>{dt(null)},[w]);const rt=_r(w),Le=Je??rt,pt=Je!==null&&Je!==rt,Pt=()=>C!=null&&C>0?C:Er(w)??$t,[ht,Et,F]=Ne(Pt()),[fe,de,O]=Ne(S&&S>0?S:St);c.useEffect(()=>{Et(Pt())},[C,w]),c.useEffect(()=>{S&&S>0&&de(S)},[S,de]);const B=c.useCallback(()=>{Ce(ft.default),$e(Qe.default),je(Ve.default),dt(null),F.reset(),O.reset()},[Ce,$e,je,ft.default,Qe.default,Ve.default,F,O]),z=ft.isModified||Qe.isModified||Ve.isModified||pt||F.isModified||O.isModified,[U,ee]=c.useState(0),[K,Te]=c.useState(0),be=c.useMemo(()=>{const q=[dl({mode:xe,kernel:ve,kernelOptions:ts().map($=>({id:$.id,label:$.label})),onSide:y,onSlide:()=>Ce("split"),onBlend:()=>Ce("blend"),onKernel:$=>{Ce("diff"),je($)}})];return xe==="diff"?q.push(Ot(ke,$=>$e($))):q.push(cn(Le,$=>dt($))),q},[xe,ve,ke,Le,je,Ce,y]),Re=c.useRef(null),pe=c.useRef(null),Ie=c.useRef(null),He=c.useRef(null),[mt,It]=c.useState(0),et=c.useRef(null),_t=c.useRef(null),[Ft,ms]=c.useState(0),or=Un();c.useEffect(()=>{const D=k.current;if(!D)return;let q=!1;return zt().then($=>{var H;if(!q)try{if(Qr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const oe=((H=$.probeExtendedToneMapping)==null?void 0:H.call($))??!1,le=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,ye=oe&&le;I.current=ye,Y(ye);const Se=$.createSurface(D,{hdr:ye});R.current={device:$,surface:Se,texA:null,texB:null},G(!0)}catch(oe){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",oe),X(!0)}}).catch($=>{q||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",$),X(!0))}),()=>{var H,oe;q=!0;const $=R.current;$&&((H=$.texA)==null||H.destroy(),(oe=$.texB)==null||oe.destroy(),R.current=null)}},[]),c.useEffect(()=>{const D=T.current;if(!D)return;const q=new ResizeObserver(()=>re($=>$+1));return q.observe(D),()=>q.disconnect()},[]),c.useEffect(()=>{if(!W)return;let D=!1;if(!R.current)return;async function $(H,oe){if(oe){const ye=hl(oe);return{width:oe.width,height:oe.height,imageData:null,make:Se=>{const he=Se.createTexture(oe.width,oe.height,ye.format);return he.write(ye.data),he}}}if(!H)return null;const le=await at(H);return le?{width:le.width,height:le.height,imageData:le,make:ye=>{const Se=ye.createTexture(le.width,le.height,"rgba8unorm");return Se.write(le.data),Se}}:null}return Promise.all([$(e,n),$(t,r)]).then(([H,oe])=>{var Oe,We;if(D||!R.current)return;const le=R.current;Re.current=(H==null?void 0:H.imageData)??null,pe.current=(oe==null?void 0:oe.imageData)??null,Ie.current=n??null,He.current=r??null,(Oe=le.texA)==null||Oe.destroy(),(We=le.texB)==null||We.destroy(),le.texA=null,le.texB=null;const ye=H??oe;if(!ye){te(null),V(null),It(gt=>gt+1);return}const Se=oe??ye,he=H??ye;le.texA=Se.make(le.device),le.texB=he.make(le.device),V({a:{w:Se.width,h:Se.height},b:{w:he.width,h:he.height}}),Z({a:Se.imageData!=null,b:he.imageData!=null}),te({w:ye.width,h:ye.height}),It(gt=>gt+1),we(gt=>gt+1)}),()=>{D=!0}},[W,e,t,n,r]);const xn=n!=null||r!=null,Xe=c.useMemo(()=>Cc(ve,xn),[ve,xn]),Ut=c.useMemo(()=>{if(!xn)return null;const D=r??n;if(!D)return null;const q=D.precision==="f16-bits"?Cr(D.data):D.data;return al(q,D.width,D.height,D.channels)},[xn,r,n]),gs=c.useMemo(()=>{var D;return qs(((D=lt(Xe))==null?void 0:D.displayRange)??"unit",ke==="none"?null:ke)},[Xe,ke]),xs=c.useMemo(()=>ke!=="none"?pl(ke):void 0,[ke]),ot=c.useMemo(()=>ae?Lt(ae.a,ae.b,d,g,"b"):null,[ae,d,g]),bl=c.useMemo(()=>ot?Vn(ot):"none",[ot]),bn=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",vn=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ue=ie,sr=c.useCallback(()=>{const D=R.current;if(!W||!D||!D.surface||!D.texA||!D.texB||!ie)return;const q=Ue??ie,$=T.current,H=$?$.getBoundingClientRect():{width:q.w,height:q.h},oe=Lo({zoom:M,pan:x},H,q.w,q.h);Pe(he=>he.x===oe.x&&he.y===oe.y&&he.w===oe.w&&he.h===oe.h?he:oe);const le=k.current;if(H.width>0&&H.height>0&&le&&D.surface){const he=Math.max(1,Math.round(H.width*or)),Oe=Math.max(1,Math.round(H.height*or));(le.width!==he||le.height!==Oe)&&(le.width=he,le.height=Oe,D.surface.configure(he,Oe))}const ye=Oo(oe,H,q.w,q.h)>=tn?"nearest":"linear",Se=oe;try{if(xe==="diff"){const he=lt(Xe)?Xe:"absolute",Oe=he==="hdr-flip"&&Ut?{ppd:67,startExposure:Ut.startExposure,stopExposure:Ut.stopExposure,numExposures:Ut.numExposures}:void 0,We=is(D.device,D.texA,D.texB,he,Oe,bn,vn,ot??void 0);L.current=We,Qc(D.device,D.surface,We.texture,We.displayRange,{uv:Se,cmapMode:gs,colormap:xs,filter:ye,sourceDims:q,exposureEV:U,offset:K})}else{const he=Mr(Le,I.current?ht:1,I.current,fe),Oe={exposureEV:U,offset:K,operator:he.operator,gamma:he.gamma,isScalar:!1,hdrOut:he.hdrOut,peak:he.peak,srgbDecodeA:Q.a,srgbDecodeB:Q.b,uv:Se,filter:ye,mode:xe,split:a,alpha:s};Za(D.device,D.surface,D.texA,D.texB,Oe)}}catch(he){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",he),X(!0)}},[W,ie,Ue,ot,M,x.x,x.y,xe,a,s,U,K,Le,ht,fe,Q,ve,Xe,Ut,gs,xs,e,t,n,r,bn,vn,or]);c.useEffect(()=>{sr()},[sr,ue,ne]);const Rt=t!=null||r!=null;c.useEffect(()=>{const D=R.current;if(!W||!D||!D.texA||!D.texB||!Rt){ge(null);return}let q=!1;const $=D.texA,H=D.texB,oe=L.current,le=xe==="diff"?ot??void 0:void 0;return(xe==="diff"&&oe?Wc(D.device,oe,$,H,le):jr(D.device,$,H,le)).then(Se=>{q||ge(Se)}),()=>{q=!0}},[W,ue,Rt,xe,ve,ot]),c.useEffect(()=>{const D=R.current;if(!W||!D||!D.texA||!D.texB||!Rt){Ae(null);return}let q=!1;Ae(null);const $=xe==="diff"?ot??void 0:void 0;return Vc(D.device,D.texA,D.texB,bn,vn,$).then(H=>{q||Ae(H)}).catch(()=>{q||Ae(null)}),()=>{q=!0}},[W,ue,Rt,xe,bl,bn,vn]),c.useEffect(()=>{if(xe!=="diff"){et.current=null,_t.current=null;return}const D=R.current,q=L.current;if(!W||!D||!q)return;let $=!1;return et.current=null,_t.current=null,ms(H=>H+1),cs(D.device,q).then(H=>{$||(et.current=H,_t.current={w:q.width,h:q.height},ms(oe=>oe+1))}).catch(()=>{}),()=>{$=!0}},[W,xe,Xe,ue,ot]);const bs=(D,q)=>($,H,oe)=>{const le=q.current;if(le){const{data:gt,width:ws,height:El,channels:Es}=le;if($<0||H<0||$>=ws||H>=El)return null;const wn=(H*ws+$)*Es,En=le.precision==="f16-bits"?cr=>Qt(gt[cr]??0):cr=>gt[cr]??0,_l=Es===1?[En(wn)]:[En(wn),En(wn+1),En(wn+2)];return vt(_l,"unit",oe)}const ye=D.current;if(!ye||$<0||H<0||$>=ye.width||H>=ye.height)return null;const Se=(H*ye.width+$)*4,he=ye.data[Se],Oe=ye.data[Se+1],We=ye.data[Se+2];return vt(he===Oe&&Oe===We?[he]:[he,Oe,We],"uint8",oe)},yn=c.useMemo(()=>bs(Re,Ie),[]),ar=c.useMemo(()=>bs(pe,He),[]),ir=c.useMemo(()=>(D,q,$)=>{var We;const H=et.current,oe=_t.current;if(!H||!oe)return null;const{w:le,h:ye}=oe;if(D<0||q<0||D>=le||q>=ye)return null;const Se=(q*le+D)*4,Oe=(((We=lt(Xe))==null?void 0:We.output)??"per-channel")==="scalar"?[H[Se]??0]:[H[Se]??0,H[Se+1]??0,H[Se+2]??0];return vt(Oe,"unit",$)},[Xe]);c.useEffect(()=>{const D=T.current;if(D)return D.__cairnCompareProbe={sampleDiff:(q,$,H="decimal")=>ir(q,$,H),sampleFg:(q,$,H="decimal")=>yn(q,$,H),sampleRef:(q,$,H="decimal")=>ar(q,$,H),get diffSamples(){return et.current},get dims(){return Ue},get primaryDims(){return ie},get diffResultDims(){return _t.current},get align(){return d},get fit(){return g},get resolvedKernelId(){return Xe},get compareMode(){return xe},computeCount:()=>Ic(),cacheSize:()=>R.current?Hc(R.current.device):0,get ssimScalar(){return me},get ssimText(){return rs(me)},get effectiveTonemap(){return Le},get hdrEngaged(){return j}},()=>{D&&delete D.__cairnCompareProbe}},[ir,yn,ar,ie,Ue,d,g,Xe,xe,me,Le,j]);const vl=p==="auto"?void 0:p;if(N)return n!=null||r!=null?f.jsx(fl,{}):xe==="diff"?f.jsx(So,{toolbar:A,source:Vi(e),baselineUrl:t,diffMode:((ys=lt(Xe))==null?void 0:ys.kind)==="pointwise"?Xe:"absolute",interpolation:p,colormap:ke,showAxes:!1,zoom:M,pan:x,onViewportChange:h,label:E,pixelValueNotation:_}):f.jsx(ul,{imageUrl:e,baselineUrl:t,mode:xe,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,zoom:M,pan:x,onViewportChange:h,interpolation:p,label:E,pixelValueNotation:_});const yl=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:k,className:"w-full h-full block",style:{imageRendering:vl},"data-gpu-compare-canvas":!0}),xe==="split"&&f.jsx(hs,{splitPosition:a,onChange:l,onReset:()=>l==null?void 0:l(.5)})]}),vs=!!E,wl=vs?"bottom-7":"bottom-1";return f.jsx(ln,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":W},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:A,paneRef:T,wrapperRef:P,zoom:M,pan:x,onViewportChange:h,naturalDims:Ue,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:yl,showAxes:!1,notationSeed:_,onReset:B,extraModified:z,exportCanvasRef:k,requestRender:sr,leadingMenus:be,displayAdjust:{exposureEV:U,offset:K,onExposureChange:ee,onOffsetChange:Te},extraSliders:[...j&&xe!=="diff"?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:mr,max:Ct,step:gr,value:ht,onChange:Et,format:D=>Number.isFinite(D)?`${D.toFixed(1)}×`:"∞"}]:[],...xe!=="diff"&&qt(Le)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Ht,max:Yt,step:Kt,value:fe,onChange:de,format:D=>D.toFixed(1)}]:[]],label:"",showLabelChip:!1,overlay:{render:({notation:D,setOverlayActive:q})=>xe==="split"?f.jsxs(f.Fragment,{children:[Rt&&Ue&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:f.jsx(yt,{imageElRef:k,naturalWidth:Ue.w,naturalHeight:Ue.h,zoom:M,pan:x,sourceWindow:Ee,sample:ar,notation:D,version:mt})}),Rt&&Ue&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:f.jsx(yt,{imageElRef:k,naturalWidth:Ue.w,naturalHeight:Ue.h,zoom:M,pan:x,sourceWindow:Ee,sample:yn,notation:D,version:mt,onActiveChange:q})})]}):Ue&&f.jsx(yt,{imageElRef:k,naturalWidth:Ue.w,naturalHeight:Ue.h,zoom:M,pan:x,sourceWindow:Ee,sample:xe==="diff"?ir:yn,notation:D,version:xe==="diff"?Ft:mt,onActiveChange:q})},extraChips:f.jsxs(f.Fragment,{children:[xe==="split"&&f.jsx(ps,{}),vs?f.jsx($n,{label:E,corner:"bottom-right"}):null,ce&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${wl}`,"data-gpu-compare-metrics":!0,children:["MSE ",ce.mse.toExponential(2)," · PSNR ",Number.isFinite(ce.psnr)?ce.psnr.toFixed(1):"∞"," dB · MAE"," ",ce.mae.toExponential(2)," · SSIM ",rs(me)]})]})})}const gl="cairn-plot:gpu-image-ready";async function xl(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await zt(),window.__cairnPlotGpuImagePane=rc,window.__cairnPlotGpuComparePane=ml,window.__cairnPlotDiffMenuModes=ts(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(gl))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),ko("no-webgpu")}}}xl()})(__cairnPlotJsxRuntime,__cairnPlotReact);
